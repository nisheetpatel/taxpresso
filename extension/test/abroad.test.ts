// A home or land abroad in Geneva end to end (SPEC.md section 1, the simple case): the questions,
// the property's documents in euros, the tax for Claude (compute_tax) and the dashboard, "About
// you", the copy panel's annexe D and 97.00, the final check, and the 3a plan at the household's
// real rate. Synthetic households on a temporary vault, never the real one: Inès Varela in
// Carouge (a flat let in Portugal), Tomas and Ilse Varga in Lancy (a holiday home in France with a
// mortgage there, a car loan here), Paolo Ferri in Meyrin (a holiday home in Italy whose mortgage
// makes a loss abroad: fail closed). Their taxes were derived by hand from the official documents
// in packages/rules-ge/test/abroad.test.ts (A1 to A3), whose figures these must match; the 2026
// cantonal figures again here, step by step at A1 and A2, with Geneva's 2026 scales and amounts
// (ge-2026-rcepf art. 17: cumulative tax 3,149.00 at 48,441 and 7,015.15 at 77,730; art. 18: wealth
// 1.49 per mille up to 118,722, 403.65 at 237,443 then 2.34 per mille; supplementary 11.35 at
// 237,443 then 0.1169 per mille). The federal tax is the same as before.
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import type { DocumentKind } from '@taxpresso/ledger';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApi, type DashboardState } from '../src/api.js';
import { readConfig } from '../src/config.js';
import { type ApiRequest, Dashboard } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import type { Workspace } from '../src/workspace.js';
import { TaxYears } from '../src/years.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

let client: Client;
let dashboard: Dashboard;
let ws: Workspace;
/** The tax year of the documents dropped in the folder: the open year's. */
let docYear = 2026;

type Result = Awaited<ReturnType<Client['callTool']>>;
const texts = (res: Result) =>
  (res.content as { type: string; text?: string }[]).map((c) => c.text ?? '').join('\n');
const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args });
const req = (
  method: 'GET' | 'POST',
  route: string,
  body: unknown = {},
  lang = 'en',
): ApiRequest => ({
  method,
  path: route,
  query: new URLSearchParams(`lang=${lang}`),
  headers: {},
  body: Buffer.from(JSON.stringify(body)),
  csrf: 'csrf-token',
});
const state = async (lang = 'en'): Promise<DashboardState> => {
  const res = await createApi(ws)(req('GET', '/state', {}, lang));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as DashboardState;
};

async function connect(years?: TaxYears, given?: Workspace) {
  const uiDir = await makeUiDir();
  const api = years ? createApi(years) : createApi(given!);
  dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api });
  const server = createTaxpressoServer(
    years ? { years, dashboard } : { workspace: given!, dashboard },
  );
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
}

beforeEach(async () => {
  docYear = 2026;
  const uiDir = await makeUiDir();
  ws = await makeWorkspace(uiDir);
  await connect(undefined, ws);
  await ws.ready();
});

afterEach(async () => {
  await client.close();
  await dashboard.stop();
});

/** Answers in order, through the tool, each answer accepted. */
async function answer(pairs: [string, unknown][]) {
  for (const [id, value] of pairs) {
    const res = await call('answer_question', { id, value });
    expect(res.isError, `${id}: ${texts(res)}`).toBeFalsy();
  }
}

let n = 0;
/** A document of the user's with the values Claude read in it (synthetic bytes), confirmed. */
async function document(
  kind: DocumentKind,
  person: 'p1' | 'p2' | 'household',
  values: [string, string][],
) {
  n += 1;
  const { document: doc } = await ws.addDocument(
    Buffer.from(`%PDF-1.7 synthetic property abroad document ${n}`),
    `${kind}-${n}.pdf`,
    'dashboard',
  );
  const res = await call('propose_extraction', {
    id: doc.id,
    document: { kind, taxYear: docYear, person },
    values: values.map(([key, value]) => ({ key, value, page: 1 })),
  });
  expect(res.isError, texts(res)).toBeFalsy();
  await ws.confirmDocument(doc.id, 'dashboard');
  return doc;
}

const salary = (person: 'p1' | 'p2', gross: string, social: string, lpp: string) =>
  document('salary_certificate', person, [
    ['salary.base', gross],
    ['salary.gross', gross],
    ['salary.social_contributions', social],
    ['salary.lpp_ordinary', lpp],
  ]);

const ABROAD = (
  use: 'own_use' | 'let' | 'land',
  owner: string,
  country: string,
  loan: boolean,
): [string, unknown][] => [
  ['special', ['property_abroad']],
  ['abroad_property', use],
  ['abroad_property_owner', owner],
  ['abroad_property_country', country],
  ...(use === 'land' ? [] : ([['abroad_property_old', true]] as [string, unknown][])),
  ['abroad_property_loan', loan],
];

/** A1. Inès Varela, single, Carouge: a salary, and a flat in Portugal let all year. */
async function varela() {
  await answer([
    ['canton', 'GE'],
    ['civil_status', 'single'],
    ['children', 0],
    ['commune', 'Carouge'],
    ['moved', 'no'],
    ['income_sources:p1', ['salary']],
    ['employers:p1', 1],
    ['work_commune:p1', 'Carouge'],
    ['residence:p1', 'swiss'],
    ['pillar3a:p1', false],
    ['lpp_buyin:p1', false],
    ['commute:p1', 'walk'],
    ['meal_days:p1', 0],
    ['banks', 1],
    ['crypto', false],
    ['payments', []],
    ...ABROAD('let', 'p1', 'portugal', false),
  ]);
  await salary('p1', "98'000.00", "6'174.00", "5'400.00");
  await document('health_premiums', 'household', [['health.premiums', "5'880.00"]]);
  await document('bank_attestation', 'p1', [
    ['bank.balance', "24'000.00"],
    ['bank.interest_gross', '0.00'],
  ]);
  // Portugal's tax notice: its tax value; the agent's management account: rents and costs.
  await document('foreign_property_tax_notice', 'household', [
    ['abroad.currency', 'EUR'],
    ['abroad.tax_value', "150'000.00"],
  ]);
  await document('foreign_property_rent_statement', 'household', [
    ['abroad.currency', 'EUR'],
    ['abroad.rents', "9'000.00"],
    ['abroad.costs', "1'350.00"],
  ]);
}

/** A2. Tomas and Ilse Varga, married, Lancy: a holiday home in France, a mortgage there. */
async function varga() {
  await answer([
    ['canton', 'GE'],
    ['civil_status', 'married'],
    ['children', 0],
    ['commune', 'Lancy'],
    ['moved', 'no'],
    ['income_sources:p1', ['salary']],
    ['employers:p1', 1],
    ['work_commune:p1', 'Lancy'],
    ['residence:p1', 'swiss'],
    ['income_sources:p2', ['salary']],
    ['employers:p2', 1],
    ['work_commune:p2', 'Lancy'],
    ['pillar3a:p1', false],
    ['pillar3a:p2', false],
    ['lpp_buyin:p1', false],
    ['lpp_buyin:p2', false],
    ['commute:p1', 'walk'],
    ['meal_days:p1', 0],
    ['commute:p2', 'walk'],
    ['meal_days:p2', 0],
    ['banks', 1],
    ['crypto', false],
    ['payments', ['loan_interest']],
    ...ABROAD('own_use', 'both', 'france', true),
  ]);
  await salary('p1', "130'000.00", "8'190.00", "9'750.00");
  await salary('p2', "64'000.00", "4'032.00", "3'200.00");
  await document('health_premiums', 'household', [['health.premiums', "11'000.00"]]);
  await document('bank_attestation', 'p1', [
    ['bank.balance', "280'000.00"],
    ['bank.interest_gross', "2'800.00"],
    ['bank.withholding_swiss', '980.00'],
  ]);
  // The car loan here, and the mortgage in France, in euros.
  await document('debt_interest', 'household', [
    ['debt.balance', "18'000.00"],
    ['debt.interest', '720.00'],
  ]);
  await document('debt_interest', 'household', [
    ['debt.currency', 'EUR'],
    ['debt.balance_in_currency', "150'000.00"],
    ['debt.interest_in_currency', "3'300.00"],
  ]);
  // France sets no tax value: the deed; the taxe d'habitation gives the rental value.
  await document('foreign_property_deed', 'household', [
    ['abroad.currency', 'EUR'],
    ['abroad.purchase_price', "320'000.00"],
  ]);
  await document('foreign_property_tax_notice', 'household', [
    ['abroad.currency', 'EUR'],
    ['abroad.rental_value', "6'200.00"],
  ]);
}

/** A3. Paolo Ferri, single, Meyrin: a holiday home in Italy whose mortgage makes a loss abroad. */
async function ferri() {
  await answer([
    ['canton', 'GE'],
    ['civil_status', 'single'],
    ['children', 0],
    ['commune', 'Meyrin'],
    ['moved', 'no'],
    ['income_sources:p1', ['salary']],
    ['employers:p1', 1],
    ['work_commune:p1', 'Meyrin'],
    ['residence:p1', 'permit_c'],
    ['pillar3a:p1', false],
    ['lpp_buyin:p1', false],
    ['commute:p1', 'walk'],
    ['meal_days:p1', 0],
    ['banks', 1],
    ['crypto', false],
    ['payments', []],
    ...ABROAD('own_use', 'p1', 'italy', true),
  ]);
  await salary('p1', "72'000.00", "4'536.00", "3'600.00");
  await document('health_premiums', 'household', [['health.premiums', "5'400.00"]]);
  await document('bank_attestation', 'p1', [
    ['bank.balance', "10'000.00"],
    ['bank.interest_gross', '0.00'],
  ]);
  await document('foreign_property_tax_notice', 'household', [
    ['abroad.currency', 'EUR'],
    ['abroad.tax_value', "120'000.00"],
  ]);
  await document('debt_interest', 'household', [
    ['debt.currency', 'EUR'],
    ['debt.balance_in_currency', "110'000.00"],
    ['debt.interest_in_currency', "6'600.00"],
  ]);
}

interface TaxOut {
  taxYear: number;
  computed: boolean;
  total: number | null;
  icc: { total: number; taxableIncome: number; taxableWealth: number } | null;
  ifd: { tax: number; taxableIncome: number; scale: string } | null;
  unsupported: string[];
  notSupported: string[];
  unverifiedRules: string[];
  assumptions: string[];
}

const rowsOf = (s: DashboardState) =>
  s.copyPanel.sections.flatMap((x) =>
    x.groups.flatMap((g) => g.rows.map((r) => ({ page: x.page, section: g.section, ...r }))),
  );

describe('a property abroad in Geneva, end to end (2026)', () => {
  it('A1: the flat let in Portugal gives the tax derived by hand, for Claude and the dashboard', async () => {
    await varela();
    expect(ws.snapshot().slots.filter((s) => s.value === undefined)).toEqual([]);
    expect(ws.engine.notSupported(ws.snapshot())).toEqual([]);
    const res = await call('compute_tax', { detail: true });
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, unsupported: [], notSupported: [] });
    // 2026: the euros at the 2025 rates as estimates (value 139,575.00, rents 8,433.31, costs
    // 1,265.00); Geneva's own 2026 scales and amounts. By hand:
    // ICC: 98,000 - 6,174 - 5,400 - 1,817 (3 % x 86,426, at most 1,817: ge-2026-rcepf art. 6 al. 2)
    // + 8,433.31 - 1,265 = 91,777.31, the whole net income; less the premiums 5,880: 95.00 =
    // 85,897.31. The flat's net income 7,168.31: 97.00 = 85,897 x 7,168.31 / 91,777.31 = 6,709.03
    // -> 6,709; 99.00 = 79,188. Rate on 85,897: 7,015.15 + 8,167 x 14.20 % = 1,159.714 -> 1,159.70:
    // 8,174.85. Base 79,188 x 8,174.85 / 85,897 = 7,536.352 -> 7,536.35. Centimes 3,579.766 ->
    // 3,579.75; reduction 12 % of 11,116.10 = 1,333.932 -> 1,333.95; home care 75.3635 -> 75.35;
    // cantonal 9,857.50. Carouge: 27 % x 7,536.35 = 2,034.8145 -> 2,034.80, x 40 % = 813.92 ->
    // 813.90; rest 5,501.55 x 40 % = 2,200.62 -> 2,200.60: 3,014.50.
    // Wealth: 24,000 + 139,575 = 163,575, less 87,872 (ge-2026-rcepf art. 16 al. 1): 95.00 = 75,703;
    // 97.00 = 75,703 x 139,575 / 163,575 = 64,595.7 -> 64,596; 99.00 = 11,107. Base: the scale at
    // 75,703, 1.49 per mille = 112.797 -> 112.80, x 11,107 / 75,703 = 16.5498 -> 16.55; centimes
    // 7.861 -> 7.85; home care 0.1655 -> 0.15; supplementary 0: 24.55. Communal: 27 % x 16.55 =
    // 4.4685 -> 4.45, x 40 % = 1.78 -> 1.80; rest 12.10 x 40 % = 4.84 -> 4.85: 6.65.
    // ICC 9,857.50 + 24.55 + 3,014.50 + 6.65 + 25 = 12,928.20. IFD as before: 1,794.30.
    expect(out.icc!.total).toBe(1_292_820);
    expect(out.icc!.taxableIncome).toBe(7_918_800);
    expect(out.icc!.taxableWealth).toBe(1_110_700);
    expect(out.ifd).toMatchObject({ tax: 179_430, taxableIncome: 8_216_700, scale: 'single' });
    expect(out.total).toBe(1_292_820 + 179_430);
    expect(out.unverifiedRules.join(' ')).toMatch(/97\.00/);
    const text = texts(res);
    expect(text).toMatch(/15\.20 Immeubles locatifs ou loués/);
    expect(text).toMatch(/converted at the official 2025 rates, as estimates/);

    // get_status: the fact in "About you", why, and its source.
    const status = texts(await call('get_status'));
    expect(status).toMatch(
      /Your property let abroad is taxed in its country, and counts here only for your rate\. Switzerland doesn’t tax it, but counts it to set the rate of your tax \(exemption avec réserve de progression\): its rents CHF.8’433 and its value CHF.139’575\. \(an estimate\) \[ge-na-law-lipp art\. 5 and 6/,
    );

    // The dashboard: the same fact in each language, one short sentence with its figures behind
    // "Why?", the kinds of the property's documents, the estimate, and the copy panel's annexe D
    // and 97.00.
    const s = await state();
    expect(s.estimate).toMatchObject({ total: 1_292_820 + 179_430 });
    const facts = s.journey.about.filter((f) => f.id === 'abroad');
    expect(facts).toHaveLength(1);
    expect(facts[0]!.text!.fr).toBe(
      'Votre immeuble loué à l’étranger est imposé dans son pays et ne compte ici que pour votre taux.',
    );
    expect(facts[0]!.why!.fr).toMatch(/exemption avec réserve de progression\).: ses loyers/);
    expect(facts[0]!.text!.de).toBe(
      'Deine vermietete Liegenschaft im Ausland wird in ihrem Land besteuert und zählt hier nur für deinen Steuersatz.',
    );
    expect(facts[0]!.text!.it).toBe(
      'Il tuo immobile affittato all’estero è tassato nel suo Paese e qui conta solo per la tua aliquota.',
    );
    expect(facts[0]!.sources!.map((x) => [x.id, x.where])).toEqual([
      ['ge-na-law-lipp', 'art. 5 and 6'],
      ['ch-na-law-lifd', 'art. 6 al. 1 and art. 7 al. 1'],
    ]);
    expect(s.kinds.map((k) => k.value)).toEqual(
      expect.arrayContaining([
        'foreign_property_tax_notice',
        'foreign_property_deed',
        'foreign_property_rent_statement',
      ]),
    );
    const rows = rowsOf(s);
    const at = (page: string) =>
      rows
        .filter((r) => r.page === page)
        .map((r) => [r.ref, r.copy, r.columns.map((c) => c.id).join('+')]);
    expect(at('D2')).toEqual([
      ['15.20-1', '139575', 'wealth'],
      ['15.20-1', '8433', 'ifd'],
      ['15.20-1', '8433', 'icc'],
    ]);
    const d2 = rows.find((r) => r.page === 'D2')!;
    expect(d2.fields.map((f) => [f.label, f.value])).toEqual([
      ['Situation (adresse exacte)', 'Portugal'],
      ['Part contr. A', '100'],
      ['Etat des loyers capitalisés ou capital selon estimation', '139575'],
      ['Charges et frais d’entretien (IFD)', '1687'],
      ['Charges et frais d’entretien (ICC)', '1265'],
    ]);
    expect(at('PG2')).toEqual(expect.arrayContaining([['15.00', '8433', 'icc']]));
    expect(at('PG3')).toEqual(
      expect.arrayContaining([
        ['58.00', '1265', 'icc'],
        ['58.00', '1687', 'ifd'],
        ['95.00', '85897', 'icc'],
        ['97.00', '6709', 'icc'],
        ['99.00', '79188', 'icc'],
        ['97.00', '6612', 'ifd'],
        ['99.00', '82167', 'ifd'],
      ]),
    );
    expect(at('PG4')).toEqual(
      expect.arrayContaining([
        ['15.00', '139575', 'wealth'],
        ['95.00', '75703', 'wealth'],
        ['97.00', '64596', 'wealth'],
        ['99.00', '11107', 'wealth'],
      ]),
    );
    expect(s.copyPanel.unplaced).toEqual([]);
    // For Claude: the same lines, page by page.
    expect(texts(await call('get_form_values', { section: 'D2' }))).toMatch(
      /15\.20-1 Immeubles locatifs ou loués/,
    );

    // The final check: the property counted for the rate, with its rules, and the estimates.
    const check = (await call('final_check', { detail: true })).structuredContent as {
      fix: { kind: string; title: string }[];
      know: {
        kind: string;
        code?: string;
        title: string;
        detail: string;
        sources: { id: string }[];
      }[];
    };
    const item = check.know.find((i) => i.kind === 'abroad')!;
    expect(item.title).toMatch(
      /^15\.20 Your property abroad in Portugal, counted for the rate only/,
    );
    expect(item.sources.map((x) => x.id)).toEqual(
      expect.arrayContaining([
        'ge-2025-guide-declaration-pp',
        'ge-na-revenu-immobilier-page',
        'ge-na-valeur-fiscale-page',
        'ge-na-law-lipp',
        'ch-na-law-lifd',
      ]),
    );
    expect(check.fix.some((i) => i.kind === 'estimate' || i.kind === 'estimate_rule')).toBe(true);
  });

  it('A1: the 3a plan is at the household’s real rate, the property abroad counted', async () => {
    await varela();
    await ws.setPlan('p1', 'plan.gross_salary', 98_000, 'chat');
    type Plans = { pillar3a: { saving?: { totalCentimes: number } } };
    const plans = async () => (await call('list_optimizations')).structuredContent as Plans;
    const withIt = (await plans()).pillar3a.saving!.totalCentimes;
    // The same household without the property abroad: a lower rate, a smaller saving.
    await answer([['special', []]]);
    const without = (await plans()).pillar3a.saving!.totalCentimes;
    expect(withIt).toBeGreaterThan(without);
  });

  it('A3: a loss abroad fails closed, said plainly to Claude and in the dashboard', async () => {
    await ferri();
    const out = (await call('compute_tax')).structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, icc: null, ifd: null, total: null });
    expect(out.unsupported).toEqual([
      expect.stringMatching(/^Your property abroad: .*\(a loss abroad\)\..*no tax is computed\.$/),
    ]);
    const s = await state('fr');
    const fact = s.journey.about.find((f) => f.id === 'abroad')!;
    expect(fact.text!.fr).toMatch(/une perte à l’étranger/);
    const check = (await call('final_check')).structuredContent as {
      fix: { kind: string; detail: string }[];
    };
    expect(check.fix.find((i) => i.kind === 'not_computed')!.detail).toMatch(/a loss abroad/);
  });

  it('A2 in 2026: the euros at the 2025 rates as estimates, the 2026 federal scale', async () => {
    await varga();
    const out = (await call('compute_tax')).structuredContent as TaxOut;
    expect(out).toMatchObject({ taxYear: 2026, computed: true, unsupported: [] });
    // By hand, 2026 (the split of the debts as in 2025: 1,964.59 of interest abroad).
    // ICC: 130,000 - 8,190 - 9,750 - 1,817 (ge-2026-rcepf art. 6 al. 2); 64,000 - 4,032 - 3,200 -
    // 1,703; 2,800; 5,809.62 - 1,452 (25 %); two earners -1,054 (art. 10); interest -3,812: the
    // whole net income 167,599.62; less 11,000 premiums and 2,800 savings interest: 95.00 =
    // 153,799.62. The home's net income 2,393.03: 97.00 = 153,799 x 2,393.03 / 167,599.62 = 2,195.98
    // -> 2,196; 99.00 = 151,603. Rate: 50 % of 153,799 = 76,899.5 -> 76,900: 3,149.00 + 28,459 x
    // 13.20 % = 3,756.588 -> 3,756.60: 6,905.60. Base 151,603 x 6,905.60 / 76,900 = 13,613.91 ->
    // 13,613.90. Centimes 6,466.6025 -> 6,466.60; reduction 12 % of 20,080.50 = 2,409.66 ->
    // 2,409.65; home care 136.139 -> 136.15; cantonal 17,807.00. Lancy 2026 (47, privileged share
    // 51 %): 6,943.089 -> 6,943.10, x 47 % = 3,263.257 -> 3,263.25; rest 6,670.80 x 47 % =
    // 3,135.276 -> 3,135.30: 6,398.55.
    // Wealth: 577,760 - 157,575 = 420,185; couple 175,743 (art. 16 al. 1): 95.00 = 244,442; 97.00 =
    // 244,442 x 297,760 / 577,760 = 125,978.0; 99.00 = 118,464. Base: the scale at 244,442 = 403.65
    // + 6,999 x 2.34 per mille = 16.378 -> 16.40: 420.05, x 118,464 / 244,442 = 203.569 -> 203.55;
    // centimes 96.686 -> 96.70; home care 2.0355 -> 2.05; supplementary 11.35 + 6,999 x 0.1169 per
    // mille = 0.818 -> 0.80: 12.15, x 118,464 / 244,442 = 5.888 -> 5.90: cantonal 308.20. Communal:
    // 51 % x 203.55 = 103.8105 -> 103.80, x 47 % = 48.786 -> 48.80; rest 99.75 x 47 % = 46.8825 ->
    // 46.90: 95.70. ICC 17,807.00 + 308.20 + 6,398.55 + 95.70 + 25 = 24,634.45. IFD as before.
    expect(out.icc!.total).toBe(2_463_445);
    expect(out.ifd).toMatchObject({ tax: 495_150, taxableIncome: 14_393_200 });
    expect(out.assumptions.join(' ')).toMatch(/exemption avec réserve de progression/);
  });

  it('several properties abroad: not supported, the next step says so', async () => {
    await answer([
      ['canton', 'GE'],
      ['civil_status', 'single'],
      ['special', ['property_abroad']],
      ['abroad_property', 'several'],
    ]);
    const status = await call('get_status');
    expect(texts(status)).toMatch(/More than one property abroad/);
    expect((status.structuredContent as { next: { id: string } }).next.id).toBe('not_supported');
  });

  it('without a property abroad, its documents are not offered', async () => {
    await answer([
      ['canton', 'GE'],
      ['special', []],
    ]);
    const kinds = (await state()).kinds.map((k) => k.value);
    expect(kinds.some((k) => k.startsWith('foreign_property_'))).toBe(false);
  });
});

// The 2025 return (docs/design/tax-years.md): its own folder, the 2025 rules, rates and form map.
describe('a property abroad in Geneva, tax year 2025', () => {
  beforeEach(async () => {
    await client.close();
    await dashboard.stop();
    const uiDir = await makeUiDir();
    const root = await mkdtemp(path.join(os.tmpdir(), 'taxpresso-ws-'));
    const years = new TaxYears(
      readConfig({ TAXPRESSO_VAULT_PATH: path.join(root, 'Taxpresso'), TAXPRESSO_UI_DIR: uiDir }),
    );
    await connect(years);
    const opened = await call('open_tax_year', { year: 2025 });
    expect(opened.isError, texts(opened)).toBeFalsy();
    ws = years.current;
    await ws.ready();
    docYear = 2025;
  });

  it('A2: the debts and interest split by the assets, the tax derived by hand', async () => {
    expect(ws.taxYear).toBe(2025);
    await varga();
    expect(ws.snapshot().slots.filter((s) => s.value === undefined)).toEqual([]);
    const res = await call('compute_tax', { detail: true });
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ taxYear: 2025, computed: true, unsupported: [] });
    expect(out.icc!.total).toBe(2_466_870);
    expect(out.icc!.taxableIncome).toBe(15_161_100);
    expect(out.icc!.taxableWealth).toBe(11_869_600);
    expect(out.ifd).toMatchObject({ tax: 495_545, taxableIncome: 14_393_200, scale: 'married' });
    expect(JSON.stringify(res.structuredContent)).not.toMatch(/ch-2026-|ge-2026-unpublished/);

    const status = texts(await call('get_status'));
    expect(status).toMatch(
      /CHF.1’965 of the interest on your debts goes abroad\. Your debts and their interest are shared with it by where your assets lie \(51\.5 % abroad\), wherever the loan was taken out\./,
    );
    const s = await state();
    const rows = rowsOf(s);
    const at = (page: string) =>
      rows
        .filter((r) => r.page === page)
        .map((r) => [r.ref, r.copy, r.columns.map((c) => c.id).join('+')]);
    expect(at('D1')).toEqual([
      ['15.10-1', '297760', 'wealth'],
      ['15.10-1', '5810', 'ifd'],
      ['15.10-1', '5810', 'icc'],
    ]);
    // The mortgage in France on E1 55.20, converted; the car loan on 55.10.
    expect(at('E1')).toEqual([
      ['55.10-1', '18000', 'wealth'],
      ['55.10-1', '720', 'icc_ifd'],
      ['55.20-1', '3092', 'icc_ifd'],
      ['55.20-1', '139575', 'wealth'],
    ]);
    expect(at('PG3')).toEqual(
      expect.arrayContaining([
        ['97.00', '2196', 'icc'],
        ['99.00', '151611', 'icc'],
        ['97.00', '2569', 'ifd'],
      ]),
    );
    expect(at('PG4')).toEqual(
      expect.arrayContaining([
        ['95.00', '244921', 'wealth'],
        ['97.00', '126225', 'wealth'],
        ['99.00', '118696', 'wealth'],
      ]),
    );
    expect(s.copyPanel.unplaced).toEqual([]);
    // The final check: the debts shared, with the law that says so.
    const check = (await call('final_check')).structuredContent as {
      know: { kind: string; code?: string; detail: string; sources: { id: string }[] }[];
    };
    const debts = check.know.find((i) => i.kind === 'abroad' && i.code === '55.00')!;
    expect(debts.detail).toMatch(
      /CHF 81’209\.38 of your debts and CHF 1’964\.59 of your interest go abroad/,
    );
    expect(debts.sources.map((x) => x.id)).toEqual([
      'ge-na-law-lipp',
      'ch-na-law-lifd',
      'zh-na-zstb-5-3',
    ]);
    // The plans before 31 December are 2026's.
    expect(s.plan).toBeNull();
  });

  it('A1 in 2025: the official 2025 rates, no estimate, the 2025 federal scale', async () => {
    await varela();
    const res = await call('compute_tax', { detail: true });
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ taxYear: 2025, computed: true, unsupported: [] });
    expect(out.icc!.total).toBe(1_294_690);
    expect(out.ifd).toMatchObject({ tax: 179_765, taxableIncome: 8_216_700 });
    expect(texts(res)).not.toMatch(/as estimates/);
    const facts = (await state()).journey.about.filter((f) => f.id === 'abroad');
    expect(facts.map((f) => f.estimate)).toEqual([undefined]);
  });

  it('A3 in 2025: the loss abroad fails closed too', async () => {
    await ferri();
    const out = (await call('compute_tax')).structuredContent as TaxOut;
    expect(out).toMatchObject({ taxYear: 2025, icc: null, ifd: null });
    expect(out.unsupported.join(' ')).toMatch(/a loss abroad/);
  });
});
