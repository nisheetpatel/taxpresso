// A property in Geneva end to end (SPEC.md section 1, the simple case): the questions, the
// property's documents (the AFC's letter, upkeep invoices, the management account, the mortgage
// statement), the tax for Claude (compute_tax) and the dashboard, "About you", the copy panel's
// annexe D and E1, the final check, and the 3a plan at the household's real rate. Synthetic
// households on a temporary vault, never the real one: Julien and Anaïs Chevalley in Lancy (their
// PPE flat, a mortgage), Nadia Bertholet in Thônex (her house, actual upkeep), Olivier Sandoz in
// Carouge (a flat let), Georges and Monique Perrenoud in Onex (the taux d'effort: fail closed),
// Antoine and Claire Vuilleumier in Meyrin (a house here and a holiday home in France). Their taxes
// were derived by hand from the official documents in packages/rules-ge/test/property.test.ts (P1
// to P5), whose figures these must match.
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
    Buffer.from(`%PDF-1.7 synthetic property document ${n}`),
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

/** The answers of one salaried person who walks to work and has no 3a or buy-in. */
const worker = (p: 'p1' | 'p2'): [string, unknown][] => [
  [`income_sources:${p}`, ['salary']],
  [`employers:${p}`, 1],
  ...(p === 'p1' ? ([[`residence:${p}`, 'swiss']] as [string, unknown][]) : []),
];
const plain = (people: ('p1' | 'p2')[]): [string, unknown][] => [
  ...people.flatMap((p): [string, unknown][] => [
    [`pillar3a:${p}`, false],
    [`lpp_buyin:${p}`, false],
    [`commute:${p}`, 'walk'],
    [`meal_days:${p}`, 0],
  ]),
  ['banks', 1],
  ['crypto', false],
  ['payments', []],
];

const PROPERTY = (
  what: 'own_house' | 'own_flat' | 'let',
  owner: string,
  more: [string, unknown][],
): [string, unknown][] => [
  ['swiss_property', what],
  ['swiss_property_owner', owner],
  ...more,
  ['swiss_property_special', []],
];

/** P1. Julien and Anaïs Chevalley, married, Lancy: their PPE flat since 2019, a mortgage. */
async function chevalley() {
  await answer([
    ['canton', 'GE'],
    ['civil_status', 'married'],
    ['children', 0],
    ['commune', 'Lancy'],
    ['moved', 'no'],
    ...worker('p1'),
    ...worker('p2'),
    ...plain(['p1', 'p2']),
    ['special', ['real_estate']],
    ...PROPERTY('own_flat', 'both', [
      ['swiss_property_since', 2019],
      ['swiss_property_old', true],
      ['swiss_property_loan', true],
    ]),
  ]);
  await salary('p1', "118'000.00", "7'434.00", "8'260.00");
  await salary('p2', "82'000.00", "5'166.00", "4'920.00");
  await document('health_premiums', 'household', [['health.premiums', "11'600.00"]]);
  await document('bank_attestation', 'household', [
    ['bank.balance', "35'000.00"],
    ['bank.interest_gross', '0.00'],
  ]);
  // The AFC's letter: the flat's tax value and rental value for the year, and its parcel.
  await document('property_values', 'household', [
    ['property.tax_value', "930'000.00"],
    ['property.rental_value', "27'600.00"],
    ['property.parcel', 'Lancy 4521'],
  ]);
  await document('mortgage_statement', 'household', [
    ['debt.balance', "450'000.00"],
    ['debt.interest', "6'750.00"],
  ]);
}

/** P2. Nadia Bertholet, single, Thônex: her house since 2004, actual upkeep above the flat. */
async function bertholet() {
  await answer([
    ['canton', 'GE'],
    ['civil_status', 'single'],
    ['children', 0],
    ['commune', 'Thônex'],
    ['moved', 'no'],
    ...worker('p1'),
    ...plain(['p1']),
    ['special', ['real_estate']],
    ...PROPERTY('own_house', 'p1', [
      ['swiss_property_since', 2004],
      ['swiss_property_old', true],
      ['swiss_property_loan', false],
    ]),
  ]);
  await salary('p1', "136'000.00", "8'568.00", "10'880.00");
  await document('health_premiums', 'household', [['health.premiums', "6'200.00"]]);
  await document('bank_attestation', 'p1', [
    ['bank.balance', "120'000.00"],
    ['bank.interest_gross', '0.00'],
  ]);
  await document('property_values', 'household', [
    ['property.tax_value', "1'150'000.00"],
    ['property.rental_value', "32'400.00"],
  ]);
  // Two invoices of the year: the roof, and the building's insurance with the IIC billed.
  await document('property_upkeep_invoices', 'household', [['property.upkeep', "9'800.00"]]);
  await document('property_upkeep_invoices', 'household', [['property.upkeep', "5'000.00"]]);
}

/** P3. Olivier Sandoz, single, Carouge: a flat let all year in Carouge, a mortgage on it. */
async function sandoz() {
  await answer([
    ['canton', 'GE'],
    ['civil_status', 'single'],
    ['children', 0],
    ['commune', 'Carouge'],
    ['moved', 'no'],
    ...worker('p1'),
    ...plain(['p1']),
    ['special', ['real_estate']],
    ...PROPERTY('let', 'p1', [
      ['swiss_property_old', false],
      ['swiss_property_other_commune', false],
      ['swiss_property_loan', true],
    ]),
  ]);
  await salary('p1', "92'000.00", "5'796.00", "5'520.00");
  await document('health_premiums', 'household', [['health.premiums', "5'400.00"]]);
  await document('bank_attestation', 'p1', [
    ['bank.balance', "40'000.00"],
    ['bank.interest_gross', '0.00'],
  ]);
  await document('property_values', 'household', [['property.tax_value', "640'000.00"]]);
  await document('property_rent_statement', 'household', [
    ['property.rents', "26'400.00"],
    ['property.costs', "2'150.00"],
  ]);
  await document('mortgage_statement', 'p1', [
    ['debt.balance', "380'000.00"],
    ['debt.interest', "4'940.00"],
  ]);
}

/** P4. Georges and Monique Perrenoud, married, Onex, retired: their house since 1990. */
async function perrenoud() {
  await answer([
    ['canton', 'GE'],
    ['civil_status', 'married'],
    ['children', 0],
    ['commune', 'Onex'],
    ['moved', 'no'],
    ['income_sources:p1', ['pension']],
    ['residence:p1', 'swiss'],
    ['income_sources:p2', ['pension']],
    ['banks', 1],
    ['crypto', false],
    ['payments', []],
    ['special', ['real_estate']],
    ...PROPERTY('own_house', 'both', [
      ['swiss_property_since', 1990],
      ['swiss_property_old', true],
      ['swiss_property_loan', false],
    ]),
  ]);
  await document('pension_certificate', 'p1', [
    ['pension.amount', "24'000.00"],
    ['pension.type', 'avs_ai'],
  ]);
  await document('pension_certificate', 'p2', [
    ['pension.amount', "18'000.00"],
    ['pension.type', 'avs_ai'],
  ]);
  await document('health_premiums', 'household', [['health.premiums', "9'000.00"]]);
  await document('property_values', 'household', [
    ['property.tax_value', "780'000.00"],
    ['property.rental_value', "26'000.00"],
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
const at = (s: DashboardState, page: string) =>
  rowsOf(s)
    .filter((r) => r.page === page)
    .map((r) => [r.ref, r.copy, r.columns.map((c) => c.id).join('+')]);

describe('a property in Geneva, end to end (2026)', () => {
  it('P1: the PPE flat and its mortgage give the tax derived by hand, for Claude and the dashboard', async () => {
    await chevalley();
    expect(ws.snapshot().slots.filter((s) => s.value === undefined)).toEqual([]);
    expect(ws.engine.notSupported(ws.snapshot())).toEqual([]);
    const res = await call('compute_tax', { detail: true });
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, unsupported: [], notSupported: [] });
    expect(out.icc!.total).toBe(2_760_970);
    expect(out.icc!.taxableIncome).toBe(16_527_100);
    expect(out.icc!.taxableWealth).toBe(4_213_600);
    expect(out.ifd).toMatchObject({ tax: 716_100, taxableIncome: 16_372_400, scale: 'married' });
    expect(out.total).toBe(2_760_970 + 716_100);
    const text = texts(res);
    expect(text).toMatch(/15\.10 Valeur locative après abattement \(15\.10\)/);
    expect(text).toMatch(
      /Property in Geneva \(annexe D\)[\s\S]*impôt immobilier complémentaire \(IIC\), CHF 186\.00, is a tax of its own, not in the total/,
    );
    expect(text).toMatch(/Intérêts chirographaires et hypothécaires/);

    // get_status: the fact in "About you", with its source.
    const status = texts(await call('get_status'));
    expect(status).toMatch(
      /Your home in Geneva is declared on annexe D \(immeubles occupés par le propriétaire\)\. Its value CHF.632’400 \(after the 32 % abattement\) and its rental value CHF.27’600, CHF.18’768 for the cantonal tax: the AFC’s figures for the year\. \[ge-2025-guide-declaration-pp p\. 32 to 34/,
    );

    // The dashboard: the fact in each language, the kinds of the property's documents, the IIC
    // apart from the total, and the copy panel's annexe D and E1.
    const s = await state();
    expect(s.estimate).toMatchObject({ total: 2_760_970 + 716_100 });
    const est = s.estimate as { rows: { id: string; label: string; amount: number }[] };
    expect(est.rows.find((r) => r.id === 'iic')).toMatchObject({
      amount: 18_600,
      label: 'Impôt immobilier complémentaire (IIC), on your property (not in the total)',
    });
    const fact = s.journey.about.find((f) => f.id === 'property')!;
    expect(fact.text!.fr).toMatch(/^Votre logement à Genève est déclaré à l’annexe D/);
    expect(fact.text!.de).toMatch(/^Deine Wohnung in Genf wird in der annexe D deklariert/);
    expect(fact.text!.it).toMatch(/^La tua abitazione a Ginevra si dichiara nell’annexe D/);
    // One short sentence; its figures behind "Why?", its sources by their titles, linked.
    expect(fact.why!.fr).toMatch(
      /^Sa valeur CHF.632’400 \(après l’abattement de 32.%\) et sa valeur locative CHF.27’600, CHF.18’768 pour l’impôt cantonal.: les chiffres de l’AFC pour l’année\.$/,
    );
    expect(fact.sources!.map((x) => x.id)).toEqual([
      'ge-2025-guide-declaration-pp',
      'ge-na-law-lipp',
    ]);
    expect(fact.sources![0]!.url).toMatch(/^https:\/\/www\.ge\.ch\//);
    expect(s.kinds.map((k) => k.value)).toEqual(
      expect.arrayContaining([
        'property_values',
        'property_upkeep_invoices',
        'ppe_charges_statement',
        'mortgage_statement',
      ]),
    );
    expect(at(s, 'D1')).toEqual([
      ['15.10-1', '632400', 'wealth'],
      ['15.10-1', '27600', 'ifd'],
      ['15.10-1', '18768', 'icc'],
    ]);
    const d1 = rowsOf(s).find((r) => r.page === 'D1')!;
    expect(d1.fields.map((f) => [f.label, f.value])).toEqual([
      ['Code lieu', '6628'],
      ['Commune cadastrale/Numéro de parcelle', 'Lancy 4521'],
      ['Occupé dès le', '2019'],
      ['Capital selon estimation fiscale', '930000'],
      ['Abattement', '32'],
      ['Valeur locative brute', '27600'],
      ['Valeur locative après abattement', '18768'],
      ['Charges et frais d’entretien (IFD)', '5520'],
      ['Charges et frais d’entretien (ICC)', '4692'],
    ]);
    // In the order the statement gave them: the debt, then the interest.
    expect(at(s, 'E1')).toEqual([
      ['55.20-1', '450000', 'wealth'],
      ['55.20-1', '6750', 'icc_ifd'],
    ]);
    expect(at(s, 'PG2')).toEqual(expect.arrayContaining([['15.00', '18768', 'icc']]));
    expect(at(s, 'PG3')).toEqual(
      expect.arrayContaining([
        ['58.00', '4692', 'icc'],
        ['58.00', '5520', 'ifd'],
        ['99.00', '165271', 'icc'],
        ['99.00', '163724', 'ifd'],
      ]),
    );
    expect(at(s, 'PG4')).toEqual(
      expect.arrayContaining([
        ['15.00', '632400', 'wealth'],
        ['99.00', '42136', 'wealth'],
      ]),
    );
    expect(s.copyPanel.unplaced).toEqual([]);
    // For Claude: the same lines, page by page.
    expect(texts(await call('get_form_values', { section: 'D1' }))).toMatch(
      /15\.10-1 Immeubles occupés par le propriétaire/,
    );

    // The final check: the home, its upkeep, the IIC apart, each with its documents.
    const check = (await call('final_check', { detail: true })).structuredContent as {
      know: { id: string; kind: string; title: string; sources: { id: string }[] }[];
    };
    const home = check.know.find((i) => i.id === 'property:home')!;
    expect(home.title).toBe('15.10 Your home in Geneva (immeubles occupés par le propriétaire)');
    expect(home.sources.map((x) => x.id)).toEqual(
      expect.arrayContaining([
        'ge-2025-guide-declaration-pp',
        'ge-na-revenu-immobilier-page',
        'ge-na-valeur-fiscale-page',
        'ge-na-law-lipp',
      ]),
    );
    expect(check.know.map((i) => i.id)).toEqual(
      expect.arrayContaining(['property:upkeep', 'property:iic']),
    );
  });

  it('P1: the 3a plan is at the household’s real rate, the property counted', async () => {
    await chevalley();
    await ws.setPlan('p1', 'plan.gross_salary', 118_000, 'chat');
    await ws.setPlan('p2', 'plan.gross_salary', 82_000, 'chat');
    type Plans = { pillar3a: { saving?: { totalCentimes: number } } };
    const plans = async () => (await call('list_optimizations')).structuredContent as Plans;
    const withIt = (await plans()).pillar3a.saving!.totalCentimes;
    // The same household without its property: no rental value, no interest, another saving.
    await answer([['special', []]]);
    const without = (await plans()).pillar3a.saving!.totalCentimes;
    expect(withIt).not.toBe(without);
    expect(withIt).toBeGreaterThan(0);
  });

  it('P2: actual upkeep from two invoices, higher than the flat rate in both taxes', async () => {
    await bertholet();
    const out = (await call('compute_tax')).structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, unsupported: [] });
    expect(out.icc!.total).toBe(2_444_820);
    expect(out.ifd).toMatchObject({ tax: 502_295, taxableIncome: 12_885_500, scale: 'single' });
    const s = await state();
    const d1 = rowsOf(s).find((r) => r.page === 'D1')!;
    expect(d1.fields.find((f) => f.label === 'Abattement')!.value).toBe('40');
    expect(at(s, 'PG3')).toEqual(
      expect.arrayContaining([
        ['58.00', '14800', 'icc'],
        ['58.00', '14800', 'ifd'],
      ]),
    );
    // The final check says the actual costs count, and what to do with the invoices.
    const check = (await call('final_check')).structuredContent as {
      know: { id: string; detail: string; todo?: string }[];
    };
    const upkeep = check.know.find((i) => i.id === 'property:upkeep')!;
    expect(upkeep.detail).toMatch(
      /Cantonal: your actual costs, CHF 14’800\.00; federal: your actual costs/,
    );
    expect(upkeep.todo).toMatch(/annexe D4, déductions sur immeubles/);
  });

  it('P4: the taux d’effort lowers the rental value: the cantonal tax fails closed, said plainly', async () => {
    await perrenoud();
    const out = (await call('compute_tax')).structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, icc: null, total: null });
    expect(out.ifd).toMatchObject({ tax: 25_700, taxableIncome: 5_445_000 });
    expect(out.unsupported).toEqual([
      expect.stringMatching(/^Your home’s rental value is lowered by the taux d’effort/),
    ]);
    const s = await state('fr');
    const fact = s.journey.about.find((f) => f.id === 'property')!;
    expect(fact.text!.fr).toBe(
      'Le taux d’effort réduit la valeur locative de votre logement, d’un montant que Taxpresso ne sait pas encore calculer.',
    );
    expect(fact.why!.fr).toMatch(
      /^La valeur locative de votre logement est réduite par le taux d’effort/,
    );
    const check = (await call('final_check')).structuredContent as {
      fix: { kind: string; detail: string }[];
    };
    expect(check.fix.find((i) => i.kind === 'not_computed')!.detail).toMatch(/taux d’effort/);
  });

  it('a property in another canton: not supported, the next step says so', async () => {
    await answer([
      ['canton', 'GE'],
      ['civil_status', 'single'],
      ['special', ['real_estate']],
      ['swiss_property', 'other_canton'],
    ]);
    const status = await call('get_status');
    expect(texts(status)).toMatch(/A property in another canton/);
    expect((status.structuredContent as { next: { id: string } }).next.id).toBe('not_supported');
  });

  it('until the documents are in: the user’s rough figures, as estimates', async () => {
    await answer([
      ['canton', 'GE'],
      ['civil_status', 'single'],
      ['children', 0],
      ['commune', 'Thônex'],
      ['moved', 'no'],
      ...worker('p1'),
      ...plain(['p1']),
      ['special', ['real_estate']],
      ...PROPERTY('own_house', 'p1', [
        ['swiss_property_since', 2004],
        ['swiss_property_old', true],
        ['swiss_property_loan', true],
      ]),
    ]);
    await salary('p1', "136'000.00", "8'568.00", "10'880.00");
    for (const [key, value] of [
      ['plan.property_value', 1_150_000],
      ['plan.property_rental_value', 32_400],
      ['plan.mortgage_balance', 300_000],
      ['plan.mortgage_interest', 4_500],
    ] as const) {
      const res = await call('set_fact', { key, value });
      expect(texts(res)).toMatch(/Saved as an estimate until its document is in/);
    }
    const res = await call('compute_tax');
    const out = res.structuredContent as TaxOut;
    expect(out.computed).toBe(true);
    expect(texts(res)).toMatch(/Estimates: .*15\.10/);
    const s = await state();
    expect(at(s, 'D1')[0]).toEqual(['15.10-1', '690000', 'wealth']);
    expect(s.journey.about.find((f) => f.id === 'property')!.estimate).toBe(true);
  });

  it('without a property in Geneva, its documents are not offered', async () => {
    await answer([
      ['canton', 'GE'],
      ['special', []],
    ]);
    const kinds = (await state()).kinds.map((k) => k.value);
    expect(kinds.some((k) => k.startsWith('property_') || k === 'mortgage_statement')).toBe(false);
  });
});

// The 2025 return (docs/design/tax-years.md): its own folder, the 2025 rules and form map.
describe('a property in Geneva, tax year 2025', () => {
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

  it('P1 in 2025: 7 years of use, 28 %, the 2025 federal scale, no estimate', async () => {
    expect(ws.taxYear).toBe(2025);
    await chevalley();
    const res = await call('compute_tax', { detail: true });
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ taxYear: 2025, computed: true, unsupported: [] });
    expect(out.icc!.total).toBe(2_792_715);
    expect(out.ifd).toMatchObject({ tax: 716_800, taxableIncome: 16_372_400 });
    expect(JSON.stringify(res.structuredContent)).not.toMatch(/ch-2026-|ge-2026-unpublished/);
    const s = await state();
    expect(at(s, 'D1')).toEqual([
      ['15.10-1', '669600', 'wealth'],
      ['15.10-1', '27600', 'ifd'],
      ['15.10-1', '19872', 'icc'],
    ]);
    // The plans before 31 December are 2026's.
    expect(s.plan).toBeNull();
  });

  it('P3 in 2025: the flat let in Carouge, on D2, the IFD flat rate on the rents', async () => {
    await sandoz();
    const out = (await call('compute_tax')).structuredContent as TaxOut;
    expect(out).toMatchObject({ taxYear: 2025, computed: true, unsupported: [] });
    expect(out.icc!.total).toBe(1_635_610);
    expect(out.ifd).toMatchObject({ tax: 237_120, taxableIncome: 9_528_300 });
    const s = await state();
    expect(at(s, 'D2')).toEqual([
      ['15.20-1', '640000', 'wealth'],
      ['15.20-1', '26400', 'ifd'],
      ['15.20-1', '26400', 'icc'],
    ]);
    const d2 = rowsOf(s).find((r) => r.page === 'D2')!;
    expect(d2.fields.map((f) => [f.label, f.value])).toEqual([
      ['Code lieu', '6608'],
      ['Part contr. A', '100'],
      ['Etat des loyers capitalisés ou capital selon estimation', '640000'],
      ['Charges et frais d’entretien (IFD)', '2640'],
      ['Charges et frais d’entretien (ICC)', '2150'],
    ]);
    expect(at(s, 'E1')).toEqual([
      ['55.20-1', '380000', 'wealth'],
      ['55.20-1', '4940', 'icc_ifd'],
    ]);
    const check = (await call('final_check')).structuredContent as {
      know: { id: string; todo?: string }[];
    };
    expect(check.know.find((i) => i.id === 'property:let')!.todo).toMatch(/compte de gestion/);
  });
});
