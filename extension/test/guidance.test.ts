// Guidance for Claude (docs/design/simple.md, "Guidance for Claude"): the server instructions keep
// the rules of every conversation within what the strictest host reads (Claude Code cuts them at
// about 2,000 characters), and everything else is said in the result of the tool Claude calls, in
// the state where it applies, and not where it doesn't. Synthetic households on temporary vaults.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import type { DocumentKind } from '@taxpresso/ledger';
import { afterEach, describe, expect, it } from 'vitest';
import { createApi } from '../src/api.js';
import { Dashboard } from '../src/dashboard.js';
import { INSTRUCTIONS, INSTRUCTIONS_MAX } from '../src/instructions.js';
import { createTaxpressoServer } from '../src/server.js';
import type { Workspace } from '../src/workspace.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

const fixtures = path.resolve(import.meta.dirname, '..', '..', 'test', 'fixtures');

type Result = Awaited<ReturnType<Client['callTool']>>;
const texts = (res: Result) =>
  (res.content as { type: string; text?: string }[]).map((c) => c.text ?? '').join('\n');

const open: { client: Client; dashboard: Dashboard }[] = [];
afterEach(async () => {
  for (const o of open.splice(0)) {
    await o.client.close();
    await o.dashboard.stop();
  }
});

/** A fresh synthetic household on a temporary vault, and the tools Claude calls. */
async function household() {
  const uiDir = await makeUiDir();
  const ws: Workspace = await makeWorkspace(uiDir);
  const dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(ws) });
  const server = createTaxpressoServer({ workspace: ws, dashboard });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
  open.push({ client, dashboard });
  await ws.ready();
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = await client.callTool({ name, arguments: args });
    return { text: texts(res), res };
  };
  const answer = async (pairs: [string, unknown][]) => {
    for (const [id, value] of pairs) {
      const { text, res } = await call('answer_question', { id, value });
      expect(res.isError, `${id}: ${text}`).toBeFalsy();
    }
  };
  /** The questions still open, answered plainly: no, none, the smallest number, the first option. */
  const finish = async () => {
    for (let i = 0; i < 60; i++) {
      const { res } = await call('next_questions');
      const q = (
        res.structuredContent as {
          questions: {
            id: string;
            type: string;
            min?: number;
            options?: { value: string; notSupported: boolean }[];
          }[];
        }
      ).questions[0];
      if (!q) return;
      const value =
        q.type === 'yesno'
          ? false
          : q.type === 'number'
            ? (q.min ?? 0)
            : q.type === 'money'
              ? '0'
              : q.type === 'multi'
                ? []
                : q.type === 'commune'
                  ? ws.engine.communes[0]!.name
                  : q.options!.find((o) => !o.notSupported)!.value;
      await answer([[q.id, value]]);
    }
  };
  let n = 0;
  /** A document with the values Claude read in it (synthetic bytes), confirmed by the user. */
  const document = async (
    kind: DocumentKind,
    person: 'p1' | 'p2' | 'household',
    values: [string, string][],
    confirm = true,
  ) => {
    n += 1;
    const { document: doc } = await ws.addDocument(
      Buffer.from(`%PDF-1.7 synthetic guidance document ${n}`),
      `${kind}-${n}.pdf`,
      'dashboard',
    );
    const { text, res } = await call('propose_extraction', {
      id: doc.id,
      document: { kind, taxYear: ws.taxYear, person },
      values: values.map(([key, value]) => ({ key, value, page: 1 })),
    });
    expect(res.isError, text).toBeFalsy();
    if (confirm) await ws.confirmDocument(doc.id, 'dashboard');
    return { doc, text };
  };
  /** A fixture file added from the dashboard. */
  const fixture = async (file: string) =>
    ws.addDocument(
      new Uint8Array(await readFile(path.join(fixtures, file))),
      path.basename(file),
      'dashboard',
    );
  const status = async () => (await call('get_status')).text;
  return { ws, client, call, answer, finish, document, fixture, status };
}

type Household = Awaited<ReturnType<typeof household>>;

/** A retired person in Geneva, single, in Carouge, Swiss; `special` as the special-cases question. */
async function retired(h: Household, special: string[], more: [string, unknown][] = []) {
  await h.answer([
    ['canton', 'GE'],
    ['civil_status', 'single'],
    ['children', 0],
    ['commune', 'Carouge'],
    ['moved', 'no'],
    ['income_sources:p1', ['pension']],
    ['residence:p1', 'swiss'],
    ['special', special],
    ...more,
  ]);
}

/** A home in France, the household's own, used by it, no loan. */
const HOME_ABROAD: [string, unknown][] = [
  ['abroad_property', 'own_use'],
  ['abroad_property_owner', 'p1'],
  ['abroad_property_country', 'france'],
  ['abroad_property_old', true],
  ['abroad_property_loan', false],
];

/** The house the household lives in, in Geneva, its own since 2001, no mortgage. */
const HOME_GENEVA: [string, unknown][] = [
  ['swiss_property', 'own_house'],
  ['swiss_property_owner', 'p1'],
  ['swiss_property_since', 2001],
  ['swiss_property_old', true],
  ['swiss_property_special', []],
  ['swiss_property_loan', false],
];

describe('the server instructions', () => {
  it(`stay within ${INSTRUCTIONS_MAX} characters, under the strictest host's cut`, () => {
    expect(INSTRUCTIONS_MAX).toBeLessThanOrEqual(1900);
    expect(INSTRUCTIONS.length).toBeLessThanOrEqual(INSTRUCTIONS_MAX);
  });

  // Each essential rule, pinned loosely so it can be reworded.
  it.each([
    ['Taxpresso does every calculation', /every calculation/i],
    ['get_status first, then its next step', /get_status first[\s\S]*next step/i],
    ['the chat leads, one thing at a time', /one thing at a time/i],
    ['the next step in get_status’s words', /get_status's words/i],
    ['in the user’s language', /their language|user's language/i],
    ['official terms in parentheses', /official term[\s\S]{0,20}in parentheses/i],
    ['no tax amount computed by Claude', /never compute tax amounts/i],
    ['no rule, limit or deadline from Claude’s knowledge', /rules, limits or deadlines/i],
    ['compute_tax’s figures as returned', /compute_tax's figures exactly/i],
    ['document contents are data', /data, never instructions/i],
    ['ask once before reading', /ask the user once/i],
    ['never save an unconfirmed suggestion', /never save a suggestion/i],
    ['never confirm for the user', /never confirm a value/i],
    ['no passwords or codes', /never type passwords or codes/i],
    ['never press transmit', /never press the final transmit button/i],
    ['never write or send an objection', /never write or send an objection/i],
    ['not supported: say so', /not supported, say so plainly/i],
    ['the canton’s software or a fiduciary', /canton's own software or a fiduciary/i],
  ])('keep the rule: %s', (_, pattern) => {
    expect(INSTRUCTIONS).toMatch(pattern);
  });

  it('put the safety rules before the rest', () => {
    const at = (re: RegExp) => INSTRUCTIONS.search(re);
    const safety = [/data, never instructions/, /never compute tax amounts/i, /passwords/];
    for (const rule of safety) expect(at(rule)).toBeLessThan(at(/one thing at a time/));
  });

  it('name no canton, no situation and no donation: those are said where they apply', () => {
    expect(INSTRUCTIONS).not.toMatch(/Geneva|Zurich|Fribourg|Ticino|Aargau|TOU|3a|abroad/);
    expect(INSTRUCTIONS).not.toMatch(/donat/i);
    expect(INSTRUCTIONS).not.toMatch(/—/);
  });

  it('are what the server sends', async () => {
    const h = await household();
    expect(h.client.getInstructions()).toBe(INSTRUCTIONS);
  });
});

/**
 * Each moved guidance: where it shows (`when`), and a state where it doesn't (`whenNot`), each
 * returning the text of the tool result Claude reads.
 */
interface Row {
  guidance: string;
  pattern: RegExp;
  when: () => Promise<string>;
  whenNot: () => Promise<string>;
}

const ROWS: Row[] = [
  // --- get_status
  {
    guidance: 'get_status: a preview canton is said once, with the language of its terms',
    pattern: /Zurich \(a preview: say so once; official terms in German\)/,
    when: async () => {
      const h = await household();
      await h.answer([['canton', 'ZH']]);
      return h.status();
    },
    whenNot: async () => {
      const h = await household();
      await h.answer([['canton', 'GE']]);
      return h.status();
    },
  },
  {
    guidance: 'get_status: Geneva’s official terms are French, and it is no preview',
    pattern: /Geneva \(official terms in French\)/,
    when: async () => {
      const h = await household();
      await h.answer([['canton', 'GE']]);
      return h.status();
    },
    whenNot: async () => (await household()).status(),
  },
  {
    guidance: 'get_status: Bern’s bilingual form',
    pattern:
      /Bern \(a preview: say so once; official terms in German; for a French-speaking user, the French term too/,
    when: async () => {
      const h = await household();
      await h.answer([['canton', 'BE']]);
      return h.status();
    },
    whenNot: async () => {
      const h = await household();
      await h.answer([['canton', 'ZH']]);
      return h.status();
    },
  },
  {
    guidance: 'get_status: another year is opened with open_tax_year, then get_status',
    pattern: /call open_tax_year with it, then get_status/,
    when: async () => (await household()).status(),
    // Said with the years, in get_status only.
    whenNot: async () => (await (await household()).call('next_questions')).text,
  },
  {
    guidance: 'get_status: replies about another year than the default start with it',
    pattern: /Replies that start with "Tax year 2025:" are about it/,
    when: async () => {
      const h = await household();
      await h.call('open_tax_year', { year: 2025 });
      return h.status();
    },
    whenNot: async () => (await household()).status(),
  },
  {
    guidance: 'get_status: the questions step never asks whether someone is taxed at source',
    pattern: /or whether someone is taxed at source/,
    when: async () => {
      const h = await household();
      await h.answer([['canton', 'GE']]);
      await h.fixture('ribeiro-declaration-2025.pdf');
      return h.status();
    },
    whenNot: async () => (await household()).status(),
  },
  {
    guidance: 'get_status: a lump sum’s figures come from its attestation, never asked',
    pattern: /institution's attestation: its amount, date and reason \(motif du versement\)/,
    when: async () => {
      const h = await household();
      await retired(h, ['pension_capital'], [['pension_capital:p1', ['pillar2']]]);
      await h.finish();
      return h.status();
    },
    whenNot: async () => {
      const h = await household();
      await retired(h, ['pension_capital'], [['pension_capital:p1', ['pillar2']]]);
      await h.finish();
      await h.document('lpp_capital_attestation', 'p1', [
        ['capital.amount', "120'000.00"],
        ['capital.date', '2026-03-31'],
        ['capital.reason', 'retirement'],
      ]);
      return h.status();
    },
  },
  {
    guidance: 'get_status: a property abroad’s documents and rough figures, until they are in',
    pattern:
      /property abroad’s figures come from its documents, read like any other, each amount as printed with its currency[\s\S]*plan\.abroad_value, plan\.abroad_rent/,
    when: async () => {
      const h = await household();
      await retired(h, ['property_abroad'], HOME_ABROAD);
      await h.finish();
      return h.status();
    },
    whenNot: async () => {
      const h = await household();
      await retired(h, []);
      await h.finish();
      return h.status();
    },
  },
  {
    guidance: 'get_status: a property in Geneva’s documents and rough figures, until they are in',
    pattern:
      /property in Geneva’s figures come from its documents: the AFC’s letter[\s\S]*plan\.property_value, plan\.property_rental_value[\s\S]*Never ask for the abattement/,
    when: async () => {
      const h = await household();
      await retired(h, ['real_estate'], HOME_GENEVA);
      await h.finish();
      return h.status();
    },
    whenNot: async () => {
      const h = await household();
      await retired(h, ['property_abroad'], HOME_ABROAD);
      await h.finish();
      return h.status();
    },
  },
  {
    guidance: 'get_status: reading a property in Geneva’s documents',
    pattern: /property in Geneva’s documents: from the AFC’s letter or avis de taxation immobilier/,
    when: async () => {
      const h = await household();
      await retired(h, ['real_estate'], HOME_GENEVA);
      await h.ws.addDocument(Buffer.from('%PDF-1.7 synthetic AFC'), 'afc.pdf', 'dashboard');
      return h.status();
    },
    whenNot: async () => {
      const h = await household();
      await retired(h, []);
      await h.ws.addDocument(Buffer.from('%PDF-1.7 synthetic letter'), 'letter.pdf', 'dashboard');
      return h.status();
    },
  },
  {
    guidance: 'get_status: reading a business’s accounts',
    pattern: /business's accounts \(business_accounts\): each line as printed/,
    when: async () => {
      const h = await household();
      await h.answer([
        ['canton', 'GE'],
        ['civil_status', 'single'],
        ['children', 0],
        ['commune', 'Carouge'],
        ['moved', 'no'],
        ['income_sources:p1', ['self_employment']],
      ]);
      await h.ws.addDocument(
        Buffer.from('%PDF-1.7 synthetic accounts'),
        'accounts.pdf',
        'dashboard',
      );
      return h.status();
    },
    whenNot: async () => {
      const h = await household();
      await retired(h, []);
      await h.ws.addDocument(Buffer.from('%PDF-1.7 synthetic letter'), 'letter.pdf', 'dashboard');
      return h.status();
    },
  },
  {
    guidance: 'get_status: a property abroad’s documents read with their currency',
    pattern: /property abroad’s documents: each amount as printed, with its currency/,
    when: async () => {
      const h = await household();
      await retired(h, ['property_abroad'], HOME_ABROAD);
      await h.ws.addDocument(Buffer.from('%PDF-1.7 synthetic notice'), 'notice.pdf', 'dashboard');
      return h.status();
    },
    whenNot: async () => {
      const h = await household();
      await retired(h, []);
      await h.ws.addDocument(Buffer.from('%PDF-1.7 synthetic letter'), 'letter.pdf', 'dashboard');
      return h.status();
    },
  },
  {
    guidance: 'get_status: the canton first, the one of 31 December, for the whole year',
    pattern: /where the user lived on 31 December[\s\S]*That canton taxes the whole year/,
    when: async () => {
      const h = await household();
      await h.fixture('ribeiro-declaration-2025.pdf');
      return h.status();
    },
    whenNot: async () => {
      const h = await household();
      await h.fixture('ribeiro-declaration-2025.pdf');
      await h.answer([['canton', 'GE']]);
      return h.status();
    },
  },
  {
    guidance: 'get_status: documents are read with one consent, then proposed',
    pattern: /ask the user first, once for all of them[\s\S]*propose_extraction/,
    when: async () => {
      const h = await household();
      await h.ws.addDocument(Buffer.from('%PDF-1.7 synthetic letter'), 'letter.pdf', 'dashboard');
      return h.status();
    },
    whenNot: async () => (await household()).status(),
  },
  {
    guidance: 'get_status: what is not supported, with the canton’s software',
    pattern:
      /can't prepare this yet[\s\S]*Suggest GeTax \(the canton's free software\) or a fiduciary/,
    when: async () => {
      const h = await household();
      await retired(h, ['inheritance_or_gift']);
      return h.status();
    },
    whenNot: async () => {
      const h = await household();
      await retired(h, []);
      return h.status();
    },
  },
  // --- open_dashboard
  {
    guidance: 'open_dashboard: where it goes, and not opened again',
    pattern: /built-in browser pane[\s\S]*don't open it again in this conversation/,
    when: async () => (await (await household()).call('open_dashboard')).text,
    whenNot: async () => (await household()).status(),
  },
  // --- next_questions
  {
    guidance: 'next_questions: who is A and who is B in last year’s declaration of a couple',
    pattern: /taxpayer A of last year’s declaration \(contribuable A\)[\s\S]*swapped/,
    when: async () => {
      const h = await household();
      await h.fixture('dupont-declaration-2025.pdf');
      await h.answer([['canton', 'GE']]);
      return (await h.call('next_questions', { limit: 3 })).text;
    },
    whenNot: async () => {
      const h = await household();
      await h.fixture('ribeiro-declaration-2025.pdf');
      await h.answer([['canton', 'GE']]);
      return (await h.call('next_questions', { limit: 3 })).text;
    },
  },
  // --- ingest_vault
  {
    guidance: 'ingest_vault: what Taxpresso read itself is not read again',
    pattern: /don’t read them with get_document_for_review/,
    when: async () => {
      const h = await household();
      await h.answer([['canton', 'GE']]);
      const folder = h.ws.vaultInfo().path;
      await mkdir(folder, { recursive: true });
      const bytes = await readFile(path.join(fixtures, 'dupont-declaration-2025.pdf'));
      await writeFile(path.join(folder, 'declaration-2025.pdf'), bytes);
      return (await h.call('ingest_vault')).text;
    },
    whenNot: async () => {
      const h = await household();
      await h.answer([['canton', 'GE']]);
      const folder = h.ws.vaultInfo().path;
      await mkdir(folder, { recursive: true });
      await writeFile(path.join(folder, 'letter.pdf'), '%PDF-1.7 synthetic letter');
      return (await h.call('ingest_vault')).text;
    },
  },
  // --- propose_extraction
  {
    guidance: 'propose_extraction: an assessment’s household answers and its deadline',
    pattern:
      /household answers it prints \(profile\.canton[\s\S]*deadline to object \(réclamation\)[\s\S]*Never write or send an objection/,
    when: async () => {
      const h = await household();
      return (
        await h.document('tax_assessment', 'household', [['assessment.tax_amount', "9'000.00"]])
      ).text;
    },
    whenNot: async () => {
      const h = await household();
      return (await h.document('health_premiums', 'household', [['health.premiums', '5000.00']]))
        .text;
    },
  },
  // --- get_holdings
  {
    guidance: 'get_holdings: official values from the ESTV list, never fetched or guessed',
    pattern:
      /Taxpresso never fetches them[\s\S]*Never give a value or a rate from your own knowledge/,
    when: async () => {
      const h = await household();
      await h.answer([['canton', 'GE']]);
      await h.fixture('brokers/dupont-ibkr-2026.xml');
      return (await h.call('get_holdings')).text;
    },
    whenNot: async () => {
      const h = await household();
      await h.answer([['canton', 'GE']]);
      return (await h.call('get_holdings')).text;
    },
  },
  // --- compute_tax
  {
    guidance: 'compute_tax: a preview canton is said once, with its rules not spelled out',
    pattern: /is a preview: the rules the documents don't spell out are listed below\. Say so once/,
    when: async () => {
      const h = await household();
      await h.answer([['canton', 'ZH']]);
      await h.finish();
      return (await h.call('compute_tax')).text;
    },
    whenNot: async () => {
      const h = await household();
      await retired(h, []);
      await h.finish();
      return (await h.call('compute_tax')).text;
    },
  },
  {
    guidance: 'compute_tax: a year without a tax is never estimated by Claude (Fribourg 2026)',
    pattern: /never estimate the tax, a rate or a saving yourself/,
    when: async () => {
      const h = await household();
      await h.answer([['canton', 'FR']]);
      await h.finish();
      return (await h.call('compute_tax')).text;
    },
    whenNot: async () => {
      const h = await household();
      await h.answer([['canton', 'TI']]);
      await h.finish();
      return (await h.call('compute_tax')).text;
    },
  },
  {
    guidance: 'compute_tax: the tax on pension capital, apart from the total',
    pattern: /Say it is a tax of its own, and never add it to the total/,
    when: async () => {
      const h = await household();
      await retired(h, ['pension_capital'], [['pension_capital:p1', ['pillar2']]]);
      await h.finish();
      await h.document('lpp_capital_attestation', 'p1', [
        ['capital.amount', "120'000.00"],
        ['capital.date', '2026-03-31'],
        ['capital.reason', 'retirement'],
      ]);
      return (await h.call('compute_tax')).text;
    },
    whenNot: async () => {
      const h = await household();
      await retired(h, []);
      await h.finish();
      return (await h.call('compute_tax')).text;
    },
  },
  {
    guidance: 'compute_tax: a lump sum whose reason wasn’t read',
    pattern: /Where the reason wasn't read, ask the user why it was paid[\s\S]*capital\.reason/,
    when: async () => {
      const h = await household();
      await retired(h, ['pension_capital'], [['pension_capital:p1', ['pillar2']]]);
      await h.finish();
      await h.document('lpp_capital_attestation', 'p1', [
        ['capital.amount', "120'000.00"],
        ['capital.date', '2026-03-31'],
      ]);
      return (await h.call('compute_tax')).text;
    },
    whenNot: async () => {
      const h = await household();
      await retired(h, ['pension_capital'], [['pension_capital:p1', ['pillar2']]]);
      await h.finish();
      await h.document('lpp_capital_attestation', 'p1', [
        ['capital.amount', "120'000.00"],
        ['capital.date', '2026-03-31'],
        ['capital.reason', 'retirement'],
      ]);
      return (await h.call('compute_tax')).text;
    },
  },
  {
    guidance: 'compute_tax: a property abroad counted only for the rate, debts shared',
    pattern:
      /Property abroad: Taxpresso counts it only to set the rate \(exemption avec réserve de progression\)[\s\S]*97\.00/,
    when: async () => {
      const h = await household();
      await retired(h, ['property_abroad'], HOME_ABROAD);
      await h.finish();
      await h.document('foreign_property_deed', 'household', [
        ['abroad.currency', 'EUR'],
        ['abroad.purchase_price', "320'000.00"],
      ]);
      return (await h.call('compute_tax')).text;
    },
    whenNot: async () => {
      const h = await household();
      await retired(h, []);
      await h.finish();
      return (await h.call('compute_tax')).text;
    },
  },
  {
    guidance: 'compute_tax: a property in Geneva, the AFC’s values, the IIC apart from the total',
    pattern:
      /Property in Geneva \(annexe D\)[\s\S]*impôt immobilier complémentaire \(IIC\), CHF 160\.00, is a tax of its own[\s\S]*never state a tax value, a rental value or a rate from your own knowledge/,
    when: async () => {
      const h = await household();
      await retired(h, ['real_estate'], HOME_GENEVA);
      await h.finish();
      await h.document('property_values', 'household', [
        ['property.tax_value', "800'000.00"],
        ['property.rental_value', "24'000.00"],
      ]);
      return (await h.call('compute_tax')).text;
    },
    whenNot: async () => {
      const h = await household();
      await retired(h, ['property_abroad'], HOME_ABROAD);
      await h.finish();
      await h.document('foreign_property_deed', 'household', [
        ['abroad.currency', 'EUR'],
        ['abroad.purchase_price', "320'000.00"],
      ]);
      return (await h.call('compute_tax')).text;
    },
  },
  {
    guidance: 'compute_tax with detail: explained from its lines, with the official terms',
    pattern: /Explain a figure from these, in the user's language, with its official term and code/,
    when: async () => {
      const h = await household();
      await retired(h, []);
      await h.finish();
      return (await h.call('compute_tax', { detail: true })).text;
    },
    whenNot: async () => {
      const h = await household();
      await retired(h, []);
      await h.finish();
      return (await h.call('compute_tax')).text;
    },
  },
  // --- get_form_values
  {
    guidance: 'get_form_values: Geneva’s software, the walk through, the PDF check',
    pattern:
      /Geneva: type them in GeTax[\s\S]*one section at a time[\s\S]*mark_entered[\s\S]*reconcile_official_pdf/,
    when: async () => {
      const h = await household();
      await retired(h, []);
      await h.finish();
      await h.document('pension_certificate', 'p1', [
        ['pension.amount', "30'240.00"],
        ['pension.type', 'avs_ai'],
      ]);
      return (await h.call('get_form_values')).text;
    },
    whenNot: async () => {
      const h = await household();
      await h.answer([['canton', 'ZH']]);
      await h.finish();
      return (await h.call('get_form_values')).text;
    },
  },
  {
    guidance: 'get_form_values: no PDF check outside Geneva',
    pattern: /reconcile_official_pdf/,
    when: async () => {
      const h = await household();
      await retired(h, []);
      await h.finish();
      await h.document('pension_certificate', 'p1', [
        ['pension.amount', "30'240.00"],
        ['pension.type', 'avs_ai'],
      ]);
      return (await h.call('get_form_values')).text;
    },
    whenNot: async () => {
      const h = await household();
      await h.answer([['canton', 'ZH']]);
      await h.finish();
      await h.document('pension_certificate', 'p1', [
        ['pension.amount', "30'240.00"],
        ['pension.type', 'avs_ai'],
      ]);
      return (await h.call('get_form_values')).text;
    },
  },
  ...(
    [
      ['FR', /FriTax is not a web page: you can’t fill it with the browser/],
      ['TI', /eTax PF[^.]*not a web page: you can’t fill it with the browser/],
      ['AG', /The main form isn’t published[\s\S]*check each against the form or eTAX AARGAU/],
    ] as const
  ).map(([canton, pattern]): Row => ({
    guidance: `get_form_values: ${canton}’s own software and form`,
    pattern,
    when: async () => {
      const h = await household();
      await h.answer([['canton', canton]]);
      return (await h.call('get_form_values')).text;
    },
    whenNot: async () => {
      const h = await household();
      await h.answer([['canton', 'ZH']]);
      return (await h.call('get_form_values')).text;
    },
  })),
];

describe('guidance said where it applies, and not where it doesn’t', () => {
  it.each(ROWS.map((r) => [r.guidance, r] as const))('%s', async (_, row) => {
    expect(await row.when()).toMatch(row.pattern);
    expect(await row.whenNot()).not.toMatch(row.pattern);
  });
});

describe('the guidance a property abroad gives works', () => {
  it('set_fact saves the rough value and rent with their currency, as estimates', async () => {
    const h = await household();
    await retired(h, ['property_abroad'], HOME_ABROAD);
    await h.finish();
    for (const [key, value] of [
      ['plan.abroad_value', '250000 EUR'],
      ['plan.abroad_rent', '0 EUR'],
    ]) {
      const { text, res } = await h.call('set_fact', { key, value });
      expect(res.isError, text).toBeFalsy();
      expect(text).toMatch(/as an estimate/);
    }
    expect((await h.call('compute_tax')).text).toMatch(/Property abroad: Taxpresso counts it/);
  });

  it('for a year that is over too: they are the return’s figures, not plans', async () => {
    const h = await household();
    await h.call('open_tax_year', { year: 2025 });
    const { text: opened } = await h.call('get_status');
    expect(opened).toMatch(/^Taxpresso [^,]+, tax year 2025/);
    await retired(h, ['property_abroad'], HOME_ABROAD);
    const { text, res } = await h.call('set_fact', {
      key: 'plan.abroad_value',
      value: '250000 EUR',
    });
    expect(res.isError, text).toBeFalsy();
    // A plan before 31 December still can't be saved for a year that is over.
    const plan = await h.call('set_fact', { key: 'plan.pillar3a_paid', value: 1000 });
    expect(plan.res.isError).toBe(true);
  });
});

describe('the guidance a property in Geneva gives works', () => {
  it('set_fact saves its rough figures in francs, as estimates until its documents', async () => {
    const h = await household();
    await retired(h, ['real_estate'], HOME_GENEVA);
    await h.finish();
    for (const [key, value] of [
      ['plan.property_value', 800_000],
      ['plan.property_rental_value', 24_000],
    ] as const) {
      const { text, res } = await h.call('set_fact', { key, value });
      expect(res.isError, text).toBeFalsy();
      expect(text).toMatch(/Saved as an estimate until its document is in/);
    }
    const { text } = await h.call('compute_tax');
    expect(text).toMatch(/Property in Geneva \(annexe D\)/);
    // Once the value is known, the next step stops asking for it.
    expect(await h.status()).not.toMatch(/property in Geneva’s figures come from its documents/);
  });

  it('for a year that is over too: they are the return’s figures, not plans', async () => {
    const h = await household();
    await h.call('open_tax_year', { year: 2025 });
    await retired(h, ['real_estate'], HOME_GENEVA);
    const { text, res } = await h.call('set_fact', { key: 'plan.property_value', value: 800_000 });
    expect(res.isError, text).toBeFalsy();
  });
});
