// A Ticino return end to end through the extension (docs/design/cantons.md, "As built: Ticino"): the
// questions, the estimate (cantonal and communal tax with the personal tax, and the federal tax the
// authority derives from the same return) for Claude (compute_tax) and the dashboard, in Italian,
// the final check, the plans and the values to type. Synthetic households on a temporary vault,
// never the real one: the Bernasconi family in Bellinzona and Giulia Ferrari, single, in Lugano.
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import type { DocumentKind } from '@taxpresso/ledger';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FinalCheckState } from '../../ui/src/dashboard/types-final-check.js';
import { createApi, type DashboardState } from '../src/api.js';
import { type ApiRequest, Dashboard } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import type { Workspace } from '../src/workspace.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

let client: Client;
let dashboard: Dashboard;
let ws: Workspace;

type Result = Awaited<ReturnType<Client['callTool']>>;
const texts = (res: Result) =>
  (res.content as { type: string; text?: string }[]).map((c) => c.text ?? '').join('\n');
const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args });
const state = async (lang = 'en'): Promise<DashboardState> => {
  const req: ApiRequest = {
    method: 'GET',
    path: '/state',
    query: new URLSearchParams(`lang=${lang}`),
    headers: {},
    body: Buffer.from('{}'),
    csrf: 'csrf-token',
  };
  const res = await createApi(ws)(req);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as DashboardState;
};

async function connect() {
  const uiDir = await makeUiDir();
  ws = await makeWorkspace(uiDir);
  dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(ws) });
  const server = createTaxpressoServer({ workspace: ws, dashboard });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
  await ws.ready();
}

beforeEach(connect);

afterEach(async () => {
  await client.close();
  await dashboard.stop();
});

let n = 0;
/** A document of the user's with the values they confirmed (synthetic bytes). */
async function confirmed(
  kind: DocumentKind,
  person: 'p1' | 'p2' | 'household',
  values: [string, string][],
) {
  n += 1;
  const { document } = await ws.addDocument(
    Buffer.from(`%PDF-1.7 synthetic Ticino document ${n}`),
    `${kind}-${n}.pdf`,
    'dashboard',
  );
  await ws.proposeExtraction(
    document.id,
    { kind, taxYear: 2026, person },
    values.map(([key, value]) => ({ key, value, page: 1 })),
  );
  await ws.confirmDocument(document.id, 'dashboard');
  return document;
}

async function answer(pairs: [string, unknown][]) {
  for (const [id, value] of pairs) {
    const res = await call('answer_question', { id, value });
    expect(res.isError, `${id}: ${texts(res)}`).toBeFalsy();
  }
}

/**
 * The Bernasconi family of Bellinzona: two salaries, two minor children (the younger in a crèche),
 * the bus and a walk to work, 3a, health premiums and donations.
 */
async function bernasconi() {
  await answer([
    ['canton', 'TI'],
    ['civil_status', 'married'],
    ['children', 2],
    ['children_custody', 'with_household'],
    ['child_minor:child1', true],
    ['child_minor:child2', true],
    ['childcare', 'creche_or_daycare'],
    ['child_care:child1', 0],
    ['child_care:child2', 15_000],
    ['commune', 'Bellinzona'],
    ['moved', 'no'],
    ['income_sources:p1', ['salary']],
    ['employers:p1', 1],
    ['work_rate:p1', 100],
    ['full_year:p1', true],
    ['taxed_at_source:p1', false],
    ['income_sources:p2', ['salary']],
    ['employers:p2', 1],
    ['work_rate:p2', 60],
    ['full_year:p2', true],
    ['taxed_at_source:p2', false],
    ['commute:p1', 'public_transport'],
    ['commute_transit_cost:p1', 1_200],
    ['meal_days:p1', 200],
    ['commute:p2', 'walk'],
    ['meal_days:p2', 0],
    ['pillar3a:p1', true],
    ['pillar3a:p2', false],
    ['lpp_buyin:p1', false],
    ['lpp_buyin:p2', false],
    ['payments', ['donations']],
    ['banks', 0],
    ['crypto', false],
    ['special', []],
  ]);
  await confirmed('salary_certificate', 'p1', [
    ['salary.base', "108'000.00"],
    ['salary.gross', "108'000.00"],
    ['salary.social_contributions', "6'910.00"],
    ['salary.lpp_ordinary', "6'500.00"],
    ['salary.net', "94'590.00"],
  ]);
  await confirmed('salary_certificate', 'p2', [
    ['salary.base', "48'000.00"],
    ['salary.gross', "48'000.00"],
    ['salary.social_contributions', "3'070.00"],
    ['salary.lpp_ordinary', "1'900.00"],
    ['salary.net', "43'030.00"],
  ]);
  await confirmed('pillar3a_attestation', 'p1', [['pillar3a.paid', "7'258.00"]]);
  await confirmed('health_premiums', 'household', [['health.premiums', "12'600.00"]]);
  await confirmed('childcare_invoice', 'household', [['childcare.costs', "15'000.00"]]);
  await confirmed('donation_receipt', 'household', [['donation.amount', "1'200.00"]]);
}

/** Giulia Ferrari, single, in Lugano: one salary and 3a. */
const FERRARI: [string, unknown][] = [
  ['civil_status', 'single'],
  ['children', 0],
  ['commune', 'Lugano'],
  ['moved', 'no'],
  ['income_sources:p1', ['salary']],
  ['employers:p1', 1],
  ['taxed_at_source:p1', false],
  ['commute:p1', 'public_transport'],
  ['commute_transit_cost:p1', 800],
  ['meal_days:p1', 180],
  ['pillar3a:p1', true],
  ['lpp_buyin:p1', false],
  ['payments', []],
  ['banks', 0],
  ['crypto', false],
  ['special', []],
];

type Canton = 'TI' | 'SG' | 'ZG' | 'BL' | 'BE' | 'GE' | 'ZH';

async function ferrari(canton: Canton = 'TI') {
  const commune = {
    TI: 'Lugano',
    SG: 'St. Gallen',
    ZG: 'Zug',
    BL: 'Liestal',
    BE: 'Biel/Bienne',
    ZH: 'Zürich',
    GE: 'Vernier',
  }[canton];
  // What each canton asks besides: Ticino the work rate and the whole year; the church where it is
  // asked; Bern your own household; Zug the rent and the Bürgergemeinde.
  const extra: Record<Canton, [string, unknown][]> = {
    TI: [
      ['work_rate:p1', 100],
      ['full_year:p1', true],
    ],
    SG: [['church:p1', 'none']],
    ZG: [
      ['church:p1', 'none'],
      ['rent', 0],
      ['citizen_of:p1', 'none'],
    ],
    BL: [['church:p1', 'none']],
    BE: [
      ['church:p1', 'none'],
      ['own_household', true],
    ],
    ZH: [['church:p1', 'none']],
    GE: [],
  };
  await answer([
    ['canton', canton],
    ...FERRARI.map(([id, v]): [string, unknown] => [id, id === 'commune' ? commune : v]),
    ...extra[canton],
  ]);
  await confirmed('salary_certificate', 'p1', [
    ['salary.base', "82'000.00"],
    ['salary.gross', "82'000.00"],
    ['salary.social_contributions', "5'250.00"],
    ['salary.lpp_ordinary', "4'100.00"],
    ['salary.net', "72'650.00"],
  ]);
  await confirmed('pillar3a_attestation', 'p1', [['pillar3a.paid', "7'258.00"]]);
}

interface TaxOut {
  computed: boolean;
  canton?: string;
  commune: { bfs: number | null; name: string; rate: number | null };
  total: number;
  icc: {
    total: number;
    incomeBase: number;
    wealthBase: number;
    cantonalIncome: number;
    communalIncome: number;
    cantonalWealth: number;
    communalWealth: number;
    personal: number;
    taxableIncome: number;
    taxableWealth: number;
    incomeTariff: string;
  };
  ifd: { tax: number; taxableIncome: number; scale: string };
  unverifiedRules: string[];
  unsupported: string[];
  notSupported: string[];
}

describe('a Ticino return', () => {
  it('asks Ticino’s questions, then computes every tax and the federal tax', async () => {
    await bernasconi();
    const status = await call('get_status');
    expect(status.structuredContent).toMatchObject({ canton: 'TI' });
    expect(texts(status)).toMatch(/tax year 2026, Ticino/);
    expect(ws.snapshot().slots.filter((s) => s.value === undefined)).toEqual([]);

    const res = await call('compute_tax');
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, canton: 'TI' });
    expect(out.commune).toMatchObject({ bfs: null, name: 'BELLINZONA' });
    // Married with two children: the family tariff, and the personal tax for both of you.
    expect(out.icc.incomeTariff).toBe('family');
    expect(out.icc.personal).toBe(8_000);
    expect(out.icc.total).toBe(
      out.icc.cantonalIncome +
        out.icc.communalIncome +
        out.icc.cantonalWealth +
        out.icc.communalWealth +
        out.icc.personal,
    );
    expect(out.ifd.scale).toBe('married');
    expect(out.total).toBe(out.icc.total + out.ifd.tax);
    expect(out.unverifiedRules.length).toBeGreaterThan(0);
    expect(out.unsupported).toEqual([]);
    expect(out.notSupported).toEqual([]);
    const text = texts(res);
    expect(text).toMatch(/canton of Ticino, commune BELLINZONA \(moltiplicatore [\d.]+\s% of the/);
    expect(text).toMatch(/imposta cantonale e comunale/);
    expect(text).toMatch(/imposta federale diretta/);
    expect(text).toMatch(/Ticino is a preview/);

    // With detail, every item with its source, for both taxes.
    const detail = await call('compute_tax', { detail: true });
    const d = (detail.structuredContent as { detail: Record<string, { code: string }[]> }).detail;
    expect(d.iccItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining(['1.1', '9.1', '9.2', '11.1', '12', '15.5', '20', '24', '25.1']),
    );
    expect(d.ifdItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining(['1.1', '400', '408', '420', '470', '11.1', '12', 'coniugi', '25.1']),
    );
    expect(texts(detail)).toMatch(
      /- IFD coniugi Deduzione dal reddito dei coniugi\/partner registrati, solo imposta federale diretta/,
    );
  });

  it('speaks Italian in the dashboard: the questions, the canton, the documents, the estimate', async () => {
    await answer([['canton', 'TI']]);
    const first = await state('it');
    expect(first.lang).toBe('it');
    expect(first.canton).toMatchObject({ code: 'TI', name: 'Ticino' });
    expect(first.question?.text).toBe('Qual era il tuo stato civile al 31 dicembre 2026?');
    expect(first.kinds.find((k) => k.value === 'salary_certificate')?.label).toBe(
      'Certificato di salario',
    );
    await client.close();
    await dashboard.stop();
    await connect();
    await bernasconi();
    const s = await state('it');
    expect(s.chips).toEqual(expect.arrayContaining(['Bellinzona', 'Lavora al 100 %']));
    const est = s.estimate as
      (DashboardState['estimate'] & { canton?: string; unverified?: string[] }) | undefined;
    expect(est?.computed).toBe(true);
    if (!est?.computed) return;
    expect(est.canton).toBe('TI');
    expect(est.rows.map((r) => r.label)).toEqual([
      'Imposta cantonale e comunale',
      'Imposta federale diretta',
    ]);
    expect(est.parts.map((r) => r.label)).toEqual([
      'Imposta cantonale sul reddito',
      'Imposta comunale sul reddito',
      'Imposta personale',
    ]);
    expect(est.items.find((i) => i.code === '1.1')?.label).toBe(
      'Attività dipendente principale, salario netto',
    );
    expect(est.unverified?.join(' ')).toMatch(/Tariffa: la legge tributaria/);
    expect(est.notes.join(' ')).toMatch(/Imposta di culto/);
    // A German page shows Ticino's content in English, with the Italian terms.
    const de = await state('de');
    if (!de.estimate?.computed) throw new Error('not computed');
    expect(de.estimate.rows.map((r) => r.label)).toEqual([
      'Cantonal and communal tax (imposta cantonale e comunale)',
      'Federal direct tax (imposta federale diretta)',
    ]);
    expect(de.question).toBeNull();
    const fr = await state('fr');
    expect(fr.canton).toMatchObject({ code: 'TI', name: 'Tessin' });
  });

  it('asks Ticino’s own questions only where they apply, and fails closed on part of a year', async () => {
    await answer([
      ['canton', 'TI'],
      ['civil_status', 'divorced'],
    ]);
    expect(ws.next()?.id).toBe('status_change');
    await answer([
      ['status_change', false],
      ['children', 1],
      ['children_custody', 'shared'],
      ['child_support', 'none_i_earn_more'],
    ]);
    expect(ws.next()?.id).toBe('child_minor:child1');
    await answer([
      ['child_minor:child1', true],
      ['childcare', 'none'],
      ['commune', 'Locarno'],
      ['moved', 'no'],
      ['income_sources:p1', ['salary']],
      ['employers:p1', 1],
      ['work_rate:p1', 80],
      ['full_year:p1', false],
    ]);
    expect(ws.next()?.id).toBe('months_worked:p1');
    await answer([
      ['months_worked:p1', 7],
      ...FERRARI.filter(([id]) =>
        [
          'taxed_at_source:p1',
          'commute:p1',
          'commute_transit_cost:p1',
          'meal_days:p1',
          'pillar3a:p1',
          'lpp_buyin:p1',
          'payments',
          'banks',
          'crypto',
          'special',
        ].includes(id),
      ),
    ]);
    expect(ws.ledger.get('ti.months_worked', 'p1')?.value).toBe(7);
    await confirmed('salary_certificate', 'p1', [['salary.gross', "52'000.00"]]);
    const out = (await call('compute_tax')).structuredContent as Omit<TaxOut, 'icc'> & {
      icc: null;
    };
    expect(out.icc).toBeNull();
    expect(out.unsupported.join(' ')).toMatch(/part of the year/);
  });

  it('asks the childcare per child when it decides the deduction, and computes it then', async () => {
    await answer([
      ['canton', 'TI'],
      ['civil_status', 'married'],
      ['children', 2],
      ['children_custody', 'with_household'],
      ['child_minor:child1', true],
      ['child_minor:child2', true],
      ['childcare', 'creche_or_daycare'],
    ]);
    await call('skip_question', { id: 'child_care:child1' });
    await call('skip_question', { id: 'child_care:child2' });
    await answer(
      FERRARI.filter(([id]) => !['civil_status', 'children'].includes(id)).map(([id, v]) => [
        id,
        id === 'commune' ? 'Mendrisio' : v,
      ]),
    );
    await answer([
      ['work_rate:p1', 100],
      ['full_year:p1', true],
      ['income_sources:p2', ['salary']],
      ['employers:p2', 1],
      ['work_rate:p2', 100],
      ['full_year:p2', true],
      ['taxed_at_source:p2', false],
      ['commute:p2', 'walk'],
      ['meal_days:p2', 0],
      ['pillar3a:p2', false],
      ['lpp_buyin:p2', false],
    ]);
    await confirmed('salary_certificate', 'p1', [['salary.gross', "90'000.00"]]);
    await confirmed('salary_certificate', 'p2', [['salary.gross', "60'000.00"]]);
    await confirmed('childcare_invoice', 'household', [['childcare.costs', "40'000.00"]]);
    const before = (await call('compute_tax')).structuredContent as Omit<TaxOut, 'icc'> & {
      icc: null;
    };
    expect(before.icc).toBeNull();
    expect(before.unsupported.join(' ')).toMatch(/limit is per child/);
    await answer([
      ['child_care:child1', 30_000],
      ['child_care:child2', 10_000],
    ]);
    const after = (await call('compute_tax', { detail: true })).structuredContent as {
      detail: { iccItems: { code: string; amount: number }[] };
    };
    // At most the limit per child (26,200, LT art. 32a) for the first, all of it for the second.
    expect(after.detail.iccItems.find((i) => i.code === '20')?.amount).toBe(-3_620_000);
  });

  it('runs the final check with Ticino’s lines, software and terms', async () => {
    await bernasconi();
    const res = await call('final_check');
    const out = res.structuredContent as FinalCheckState;
    // The 3a of the taxpayer is at the cap in both taxes: said once, for both.
    const pillar = out.know.find((i) => i.kind === 'limit' && i.code === '11.1');
    expect(pillar?.title).toMatch(/previdenza individuale vincolata/);
    expect(pillar?.title).toMatch(/imposta cantonale, comunale e federale diretta/);
    const pdf = out.know.find((i) => i.kind === 'official_pdf');
    expect(pdf?.detail).toMatch(/Taxpresso checks Geneva declarations only/);
    expect(out.know.some((i) => i.kind === 'form_provisional')).toBe(true);
    expect(texts(res)).not.toMatch(/GeTax|ZHprivateTax|TaxMe|E-Tax BL|eTax\.zug|E-Tax SG/);
    for (const i of [...out.fix, ...out.know]) {
      for (const src of i.sources) {
        if (src.id.startsWith('ti-')) expect(src.url, src.id).toMatch(/^https:\/\//);
      }
    }
  });

  it('plans 3a, a buy-in and the 3a catch-up on Ticino’s tax, and keeps TOU Geneva’s', async () => {
    await ferrari();
    await ws.setPlan('p1', 'plan.gross_salary', 82_000, 'chat');
    await ws.setPlan('p1', 'plan.pillar3a_paid', 3_000, 'chat');
    await ws.setPlan('p1', 'plan.lpp_buyin_amount', 10_000, 'chat');
    await ws.setPlan('p1', 'plan.lpp_buyin_capacity', 40_000, 'chat');
    await ws.setPlan('p1', 'plan.pillar3a_paid_2025', 2_000, 'chat');
    const res = await call('list_optimizations');
    const out = res.structuredContent as {
      pillar3a: { saving?: { totalCentimes: number }; assumptions: string[]; sources: string[] };
      lppBuyIn: { saving?: { totalCentimes: number; cantonalCentimes: number } };
      pillar3aCatchUp: { saving?: { totalCentimes: number }; assumptions: string[] };
      tou: { applies: boolean };
    };
    expect(out.pillar3a.saving?.totalCentimes).toBeGreaterThan(0);
    expect(out.pillar3a.assumptions).toContain('ti_preview');
    expect(out.pillar3a.assumptions).not.toContain('ti_commune_default');
    expect(out.pillar3a.sources.join(' ')).toMatch(/ti-2026-/);
    expect(out.lppBuyIn.saving?.cantonalCentimes).toBeGreaterThan(0);
    expect(out.pillar3aCatchUp.saving?.totalCentimes).toBeGreaterThan(0);
    expect(out.tou.applies).toBe(false);
    const text = texts(res);
    expect(text).toMatch(/Previdenza individuale vincolata \(3° pilastro A\)/);
    expect(text).toMatch(/For Ticino, taxation at source \(imposta alla fonte\)/);
    expect(text).toMatch(/Ticino is a preview/);
  });

  it('gives the values to type form by form, in the chat and the dashboard', async () => {
    await bernasconi();
    const list = await call('get_form_values');
    const out = list.structuredContent as { sections: { page: string }[]; provisional: boolean };
    expect(out.sections.map((s) => s.page)).toEqual(
      expect.arrayContaining(['M4-1', 'M4-2', 'M6', 'M5', 'P2', 'P3']),
    );
    expect(out.provisional).toBe(true);
    expect(texts(list)).toMatch(/eTax PF/);
    const page3 = await call('get_form_values', { section: 'P3' });
    expect(texts(page3)).toMatch(/11\.1 11\.1 Previdenza individuale vincolata/);
    const modulo4 = await call('get_form_values', { section: 'M4-1' });
    expect(texts(modulo4)).toMatch(/438 7\. Totale delle spese professionali/);
    const panel = (await state('fr')).copyPanel;
    expect(panel.unplaced).toEqual([]);
    expect(panel.total).toBeGreaterThan(0);
    const pdf = await call('reconcile_official_pdf');
    expect(texts(pdf)).toMatch(/reads Geneva declarations only/);
    expect(texts(pdf)).toMatch(/eTax PF/);
    expect((await state()).declarationCheck.status).toBe('not_available');
  });

  it('gives the same federal tax as Geneva, Zurich, Bern, Basel-Landschaft, Zug and St. Gallen for the same household', async () => {
    await ferrari('TI');
    const ti = (await call('compute_tax')).structuredContent as TaxOut;
    expect(ti.icc.incomeTariff).toBe('single');
    const federal: TaxOut['ifd'][] = [];
    for (const canton of ['GE', 'ZH', 'BE', 'BL', 'ZG', 'SG'] as const) {
      await client.close();
      await dashboard.stop();
      await connect();
      await ferrari(canton);
      const other = (await call('compute_tax')).structuredContent as TaxOut;
      expect(other.computed, canton).toBe(true);
      federal.push(other.ifd);
    }
    for (const other of federal) {
      expect(other.taxableIncome).toBe(ti.ifd.taxableIncome);
      expect(other.tax).toBe(ti.ifd.tax);
    }
  });
});
