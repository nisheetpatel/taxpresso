// The tax year the user prepares (docs/design/tax-years.md): the registry of years, the user's
// choice in the chat and in the dashboard (the same record), each year its own folder, and a Geneva
// return for 2025 end to end through the tools and the dashboard. Always on a temporary vault.
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { SUPPORTED_CANTONS } from '@taxpresso/rules-ch';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApi, type DashboardState } from '../src/api.js';
import { CANTONS } from '../src/cantons.js';
import { readConfig } from '../src/config.js';
import { type ApiRequest, Dashboard } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import { isYearOver } from '../src/year-over.js';
import {
  cantonsForYear,
  DEFAULT_TAX_YEAR,
  offeredYears,
  OPEN_YEAR_FILE,
  TaxYears,
} from '../src/years.js';
import { makeUiDir } from './helpers.js';

const FIXTURES = path.resolve(import.meta.dirname, '../../test/fixtures');
const fixture = (name: string) => new Uint8Array(readFileSync(path.join(FIXTURES, name)));

async function freshYears(uiDir?: string): Promise<TaxYears> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'taxpresso-ws-'));
  return new TaxYears(
    readConfig({
      TAXPRESSO_VAULT_PATH: path.join(root, 'Taxpresso'),
      ...(uiDir ? { TAXPRESSO_UI_DIR: uiDir } : {}),
    }),
  );
}

describe('the registry of years', () => {
  it('offers 2026 by default and 2025 for Geneva only', () => {
    expect(DEFAULT_TAX_YEAR).toBe(2026);
    expect(offeredYears()).toEqual([2026, 2025]);
    expect(cantonsForYear(2026)).toEqual([...SUPPORTED_CANTONS]);
    expect(cantonsForYear(2025)).toEqual(['GE']);
    expect(isYearOver(2025)).toBe(true);
    expect(isYearOver(2026)).toBe(false);
  });

  it('lists a year for a canton only when its rules, form map and questions all cover it', () => {
    for (const code of SUPPORTED_CANTONS) {
      const c = CANTONS[code];
      for (const year of c.years) {
        expect(c.rules.taxYears, `${code} rules ${year}`).toContain(year);
        const form = c.filing.formMap(year);
        expect(form.taxYear, `${code} form ${year}`).toBe(year);
        // A year that is over has its own published form, never a provisional one.
        if (isYearOver(year)) expect(form.provisional, `${code} form ${year}`).toBe(false);
        expect(c.questionnaire(year)?.taxYear, `${code} questions ${year}`).toBe(year);
        expect(() => c.keys(year)).not.toThrow();
      }
    }
  });

  it('fails closed for a year the Geneva form map does not have', () => {
    expect(() => CANTONS.GE.filing.formMap(2024)).toThrow(/no Geneva form map for 2024/);
    expect(CANTONS.GE.questionnaire(2024)).toBeUndefined();
  });
});

describe('the open year: the user’s choice, kept in the folder', () => {
  it('opens 2026 without a choice, and reads nothing it does not have', async () => {
    const years = await freshYears();
    expect(years.year).toBe(2026);
    expect(years.current.taxYear).toBe(2026);
    expect(existsSync(years.root)).toBe(false);
    expect(years.list().map((y) => [y.year, y.open, y.over])).toEqual([
      [2026, true, false],
      [2025, false, true],
    ]);
  });

  it('keeps the year chosen, for the next start, and each year in its own folder', async () => {
    const years = await freshYears();
    const y2026 = years.current;
    await y2026.answer('canton', 'GE', 'chat');
    const y2025 = await years.open(2025, 'dashboard');
    expect(years.year).toBe(2025);
    expect(y2025).not.toBe(y2026);
    expect(y2025.vault.dir).toBe(path.join(years.root, '2025'));
    const kept = JSON.parse(await readFile(path.join(years.root, OPEN_YEAR_FILE), 'utf8')) as {
      via: string;
    };
    expect(kept).toMatchObject({ version: 1, taxYear: 2025, via: 'dashboard' });
    // The next start of the extension opens 2025.
    const again = new TaxYears(years.config);
    expect(again.year).toBe(2025);
    // The canton of 2026 is not 2025's: 2025 asks it again.
    await y2025.ready();
    expect(y2025.canton().canton).toBeUndefined();
    await y2025.answer('canton', 'GE', 'chat');
    await y2025.answer('civil_status', 'married', 'chat');
    const ledger = (year: number) =>
      JSON.parse(readFileSync(path.join(years.root, String(year), 'ledger.json'), 'utf8')) as {
        taxYear: number;
        facts: { key: string; taxYear: number }[];
      };
    expect(ledger(2026).facts.map((f) => f.key)).toEqual(['profile.canton']);
    expect(ledger(2025).facts.map((f) => f.key)).toEqual([
      'profile.canton',
      'profile.civil_status',
    ]);
    expect(ledger(2025).facts.every((f) => f.taxYear === 2025)).toBe(true);
    // The activity of the year says who opened it.
    expect(y2025.activity()[0]?.what).not.toBeUndefined();
    expect(y2025.activity().some((a) => a.what === 'year' && a.by === 'you')).toBe(true);
  });

  it('refuses a year it does not prepare, and drops a kept year it no longer offers', async () => {
    const years = await freshYears();
    await expect(years.open(2024, 'chat')).rejects.toThrow(/prepares 2026 and 2025/);
    await years.open(2025, 'chat');
    await writeFile(
      path.join(years.root, OPEN_YEAR_FILE),
      JSON.stringify({ version: 1, taxYear: 2019, via: 'chat', at: '' }),
    );
    const later = new TaxYears(years.config);
    expect(later.year).toBe(2026);
    expect(later.dropped).toBe(2019);
  });
});

describe('a canton Taxpresso covers, but not for 2025', () => {
  it('fails closed: not supported, nothing computed, nothing to type', async () => {
    const years = await freshYears();
    const ws = await years.open(2025, 'chat');
    await ws.ready();
    await ws.answer('canton', 'ZH', 'chat');
    const state = ws.canton();
    expect(state.canton).toBeUndefined();
    expect(state.notOffered?.code).toBe('ZH');
    expect(ws.engine.notSupported(ws.snapshot()).map((n) => n.what.en)).toEqual([
      'Zurich: Taxpresso can’t prepare a 2025 return there yet',
    ]);
    const estimate = ws.estimate();
    expect(estimate.result).toBeNull();
    expect(estimate.missing[0]?.en).toMatch(/2025 returns for \(Zurich isn't one yet\)/);
  });
});

// ---- A Geneva return for 2025, through the tools and the dashboard -------------------------------

let client: Client;
let dashboard: Dashboard;
let years: TaxYears;

type Result = Awaited<ReturnType<Client['callTool']>>;
const text = (res: Result) => (res.content as { text: string }[])[0]!.text;
const structured = <T>(res: Result) => res.structuredContent as T;
const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args });

const csrf = 'x';
async function api(
  method: 'GET' | 'POST',
  p: string,
  body?: unknown,
  query: Record<string, string> = {},
): Promise<{ status: number; body: DashboardState & { error?: string } }> {
  const req: ApiRequest = {
    method,
    path: p,
    query: new URLSearchParams({ lang: 'en', ...query }),
    headers: {},
    body: Buffer.from(body === undefined ? '' : JSON.stringify(body)),
    csrf,
  };
  const res = await createApi(years)(req);
  return res as { status: number; body: DashboardState & { error?: string } };
}

beforeEach(async () => {
  const uiDir = await makeUiDir();
  years = await freshYears(uiDir);
  dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(years) });
  const server = createTaxpressoServer({ years, dashboard });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
});

afterEach(async () => {
  await client.close();
  await dashboard.stop();
});

/** The Ribeiro-like household of the 2025 tests: single in Meyrin, one employer. */
const GIVEN: Record<string, unknown> = {
  canton: 'GE',
  civil_status: 'single',
  children: 0,
  commune: 'Meyrin',
  moved: 'no',
  income_sources: ['salary'],
  employers: 1,
  taxed_at_source: false,
  pillar3a: true,
  lpp_buyin: false,
  commute: 'public_transport',
  commute_transit_cost: 800,
  commute_transit_usable: false,
  meal_days: 0,
  banks: 0,
  crypto: false,
  payments: [],
  special: [],
};

async function answerAll(): Promise<string[]> {
  const asked: string[] = [];
  for (let i = 0; i < 40; i++) {
    const next = await call('next_questions');
    const q = structured<{ questions: { id: string; text: { en: string } }[] }>(next).questions[0];
    if (!q) break;
    asked.push(q.text.en);
    const id = q.id.split(':')[0]!;
    expect(id in GIVEN, q.id).toBe(true);
    // Every other answer from the dashboard: both write the same record.
    if (i % 2) {
      const res = await api('POST', '/answer', { id: q.id, value: GIVEN[id] }, { year: '2025' });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
    } else {
      const res = await call('answer_question', { id: q.id, value: GIVEN[id] });
      expect(res.isError, text(res)).toBeFalsy();
    }
  }
  return asked;
}

describe('a Geneva return for 2025, in the chat and the dashboard', () => {
  it('opens 2025 in the chat, says so everywhere, and asks its questions with its year', async () => {
    const before = await call('get_status');
    expect(structured<{ taxYear: number }>(before).taxYear).toBe(2026);
    expect(text(before)).toMatch(/Tax year 2026 is open; also 2025 \(Geneva only\)/);

    const opened = await call('open_tax_year', { year: 2025 });
    expect(opened.isError).toBeFalsy();
    expect(text(opened)).toMatch(/Tax year 2025 is open now \(it was 2026\)/);
    expect(text(opened)).toMatch(
      /Bern.*say plainly that the 2025 return isn't available there yet/,
    );
    expect(text(opened)).toMatch(/open_tax_year 2026/);
    expect(text(opened)).not.toMatch(/2024/);

    const status = await call('get_status');
    expect(structured<{ taxYear: number }>(status).taxYear).toBe(2025);
    expect(text(status)).toMatch(/^Taxpresso [^\n]*, tax year 2025, canton not known yet/);
    expect(text(status)).toMatch(
      /Tax year 2025 is open \(it is over: the plans before 31 December are 2026's\); also 2026/,
    );

    const asked = await answerAll();
    expect(asked[0]).toBe('Where did you live on 31 December 2025?');
    expect(asked).toContain('Did you move in 2025?');
    expect(asked.join('\n')).not.toMatch(/2026/);

    // The ledger of 2025 holds the answers, with where each was given; 2026 has none.
    const ledger = JSON.parse(
      readFileSync(path.join(years.root, '2025', 'ledger.json'), 'utf8'),
    ) as { facts: { key: string; source: { via: string } }[] };
    expect(new Set(ledger.facts.map((f) => f.source.via))).toEqual(new Set(['chat', 'dashboard']));
    expect(existsSync(path.join(years.root, '2026', 'ledger.json'))).toBe(false);

    const state = await api('GET', '/state');
    expect(state.body.taxYear).toBe(2025);
    expect(state.body.years.map((y) => [y.year, y.open])).toEqual([
      [2026, false],
      [2025, true],
    ]);
    expect(state.body.yearOver).toMatchObject({ year: 2025, plansIn: 2026 });
    expect(state.body.plan).toBeNull();
    expect(state.body.planning).toBeNull();
    expect(state.body.chips).not.toContain('Arrived in 2026');
  });

  it('computes 2025 from published values only, with no estimate flag and no 2026 source', async () => {
    await call('open_tax_year', { year: 2025 });
    await answerAll();
    const ws = years.current;
    await ws.addDocument(fixture('dupont-certificat-salaire-2026.pdf'), 'certificat.pdf', 'chat');
    const listed = structured<{ documents: { id: string }[] }>(await call('list_documents'));
    const doc = listed.documents[0]!.id;
    const proposed = await call('propose_extraction', {
      id: doc,
      document: { kind: 'salary_certificate', taxYear: 2025, person: 'p1' },
      values: [
        { key: 'salary.gross', value: "85'000.00", page: 1, box: '8' },
        { key: 'salary.social_contributions', value: "4'505.00", page: 1, box: '9' },
        { key: 'salary.net', value: "75'000.00", page: 1, box: '11' },
      ],
    });
    expect(proposed.isError, text(proposed)).toBeFalsy();
    await call('set_fact', { instance: doc, confirm: true });
    const tax = await call('compute_tax', { detail: true });
    const out = structured<{ taxYear: number; computed: boolean; estimates?: unknown[] }>(tax);
    expect(out.taxYear).toBe(2025);
    expect(out.computed).toBe(true);
    expect(text(tax)).toMatch(/^Tax year 2025, .* From official values only\./);
    expect(text(tax)).not.toMatch(/2026|janvier 2027|January 2027/);
    expect(JSON.stringify(tax.structuredContent)).not.toMatch(/ge-2026-unpublished/);
  });

  it('points the plans to 2026, refuses planning figures and TOU decisions for 2025', async () => {
    await call('open_tax_year', { year: 2025 });
    await answerAll();
    const plans = await call('list_optimizations');
    const over = structured<{ yearOver: { plansIn: number } }>(plans).yearOver;
    expect(over.plansIn).toBe(2026);
    expect(text(plans)).toMatch(
      /say these plans apply to 2026, and offer to switch to 2026 in one step: open_tax_year with year 2026/,
    );
    const figure = await call('set_fact', { key: 'plan.pillar3a_paid', value: 7000 });
    expect(figure.isError).toBe(true);
    expect(text(figure)).toMatch(/plans are 2026's\. Offer to open 2026/);
    const dashboardFigure = await api(
      'POST',
      '/plan',
      { person: 'p1', field: 'gross', value: 90000 },
      { year: '2025' },
    );
    expect(dashboardFigure.status).toBe(400);
    const decide = await call('decide_optimization', {
      id: 'tou',
      choice: 'request',
      confirmed: true,
    });
    expect(decide.isError).toBe(true);
    expect(text(decide)).toMatch(
      /had to reach the tax office by 2026-03-31 \(ge-na-law-risp art\. 8 al\. 1/,
    );

    // One step back to 2026 from the dashboard, where the plans work as before.
    const back = await api('POST', '/year', { year: 2026 });
    expect(back.status).toBe(200);
    expect(back.body.taxYear).toBe(2026);
    expect(back.body.yearOver).toBeNull();
    expect(back.body.plan).not.toBeNull();
    const kept = JSON.parse(readFileSync(path.join(years.root, OPEN_YEAR_FILE), 'utf8')) as {
      via: string;
    };
    expect(kept.via).toBe('dashboard');
    const status = await call('get_status');
    expect(structured<{ taxYear: number }>(status).taxYear).toBe(2026);
  });

  it('refuses a change from a page that still shows the other year', async () => {
    const shown = await api('GET', '/state');
    expect(shown.body.taxYear).toBe(2026);
    await call('open_tax_year', { year: 2025 });
    const stale = await api('POST', '/answer', { id: 'canton', value: 'GE' }, { year: '2026' });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toMatch(/This page showed 2026, but 2025 is open now/);
    expect(existsSync(path.join(years.root, '2025', 'ledger.json'))).toBe(false);
  });

  it("reads the 2024 declaration as last year's, and the 2025 one as the declaration to check", async () => {
    await call('open_tax_year', { year: 2025 });
    const ws = years.current;
    await ws.ready();
    const prior = await ws.addDocument(
      fixture('dupont-declaration-2024.pdf'),
      'decl-2024.pdf',
      'chat',
    );
    expect(prior.document.kind).toBe('prior_declaration');
    expect(prior.document.taxYear).toBe(2024);
    expect(prior.document.parse.ok).toBe(true);
    // Its answers come back as suggestions for 2025's questions.
    await call('answer_question', { id: 'canton', value: 'GE' });
    const next = await call('next_questions');
    expect(text(next)).toMatch(/Suggested from last year's declaration \(2024\)/);

    const own = await ws.addDocument(
      fixture('dupont-declaration-2025.pdf'),
      'decl-2025.pdf',
      'chat',
    );
    expect(own.document.kind).toBe('official_declaration');
    expect(own.document.taxYear).toBe(2025);
    const check = await call('reconcile_official_pdf');
    expect(check.isError, text(check)).toBeFalsy();
    expect(text(check)).toMatch(/This year's declaration \(2025\)/);

    // A 2026 document in the 2025 return is a "Check this" item.
    await ws.addDocument(fixture('dupont-scan-3a-2026.pdf'), 'scan.pdf', 'chat');
    const scan = ws.activeDocuments().find((d) => d.filename === 'scan.pdf')!;
    await call('propose_extraction', {
      id: scan.id,
      document: { kind: 'pillar3a_attestation', taxYear: 2026, person: 'p1' },
    });
    const checks = ws.checks().map((c) => [c.rule, c.source]);
    expect(checks).toContainEqual(['pillar3a_year', 'ge-2025-guide-declaration-pp p. 18']);
  });

  it('exports the open year only', async () => {
    await call('open_tax_year', { year: 2025 });
    await call('answer_question', { id: 'canton', value: 'GE' });
    const res = await call('export_bundle');
    expect(res.isError, text(res)).toBeFalsy();
    expect(structured<{ file: string }>(res).file).toMatch(/^Taxpresso-2025-export-/);
    expect(text(res)).toMatch(/Saved a copy of the 2025 folder/);
  });
});
