// Lump sums from the 2nd pillar and pillar 3a in Geneva, end to end through the extension, for 2026
// and 2025: the questions (who received which, nothing more), the attestations (amount, date and
// reason read there), the separate tax for Claude (compute_tax) and in the dashboard's estimate, the
// final check and the values to type (98.12). Synthetic households on a temporary vault, made-up
// people: Hélène Favre (Carouge), Lucas Morel (Lancy), Pierre and Anne Rochat (Vernier). Their
// figures are worked out by hand in packages/rules-ge/test/capital.test.ts.
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import type { DocumentKind } from '@taxpresso/ledger';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FinalCheckState } from '../../ui/src/dashboard/types-final-check.js';
import { createApi, type DashboardState } from '../src/api.js';
import { readConfig } from '../src/config.js';
import { type ApiRequest, Dashboard } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import { TaxYears } from '../src/years.js';
import { makeUiDir } from './helpers.js';

let client: Client;
let dashboard: Dashboard;
let years: TaxYears;
/** The open year's workspace. */
const ws = () => years.current;

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
  const res = await createApi(years)(req);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as DashboardState;
};

beforeEach(async () => {
  const uiDir = await makeUiDir();
  const root = await mkdtemp(path.join(os.tmpdir(), 'taxpresso-ws-'));
  years = new TaxYears(
    readConfig({ TAXPRESSO_VAULT_PATH: path.join(root, 'Taxpresso'), TAXPRESSO_UI_DIR: uiDir }),
  );
  dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(years) });
  const server = createTaxpressoServer({ years, dashboard });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
  await ws().ready();
});

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
  confirm = true,
) {
  n += 1;
  const w = ws();
  const { document } = await w.addDocument(
    Buffer.from(`%PDF-1.7 synthetic pension capital document ${n}`),
    `${kind}-${n}.pdf`,
    'dashboard',
  );
  await w.proposeExtraction(
    document.id,
    { kind, taxYear: w.taxYear, person },
    values.map(([key, value]) => ({ key, value, page: 1 })),
  );
  if (confirm) await w.confirmDocument(document.id, 'dashboard');
  return document;
}

async function answer(pairs: [string, unknown][]) {
  for (const [id, value] of pairs) {
    const res = await call('answer_question', { id, value });
    expect(res.isError, `${id}: ${texts(res)}`).toBeFalsy();
  }
}

type Estimate = Extract<DashboardState['estimate'], { computed: true }>;
const estimate = async (lang = 'en') => (await state(lang)).estimate as Estimate;
const finalCheck = async () => (await call('final_check')).structuredContent as FinalCheckState;
const missing = () =>
  ws()
    .requirements()
    .filter((r) => r.status === 'missing')
    .map((r) => r.id);

/** Hélène Favre, single, Carouge, retired: her AVS pension and her pillar 3a paid out. */
async function favre() {
  await answer([
    ['canton', 'GE'],
    ['civil_status', 'single'],
    ['children', 0],
    ['commune', 'Carouge'],
    ['moved', 'no'],
    ['income_sources:p1', ['pension']],
    // Swiss: not taxed at source (a pension is asked about since it can be, ge-na-law-risp art. 3).
    ['residence:p1', 'swiss'],
    ['special', ['pension_capital']],
    ['pension_capital:p1', ['pillar3a']],
  ]);
  await confirmed('pension_certificate', 'p1', [
    ['pension.amount', "30'240.00"],
    ['pension.type', 'avs_ai'],
  ]);
}

/** Her attestation: the amount, the date and the reason, as printed. */
const favreAttestation = (year = 2026, reason = 'retirement'): [string, string][] => [
  ['capital.amount', "85'000.00"],
  ['capital.date', `${year}-06-30`],
  ['capital.reason', reason],
];

describe('a pillar 3a paid out at retirement (Favre)', () => {
  it('asks only who received which, then the attestation', async () => {
    await favre();
    // Nothing more to ask about it: the amount, the date and the reason are on the attestation.
    const next = (await call('next_questions')).structuredContent as {
      questions: { id: string }[];
    };
    expect(next.questions.map((q) => q.id)).toEqual(['banks']);
    expect(
      ws()
        .snapshot()
        .slots.filter((x) => x.question.id.startsWith('pension_capital')),
    ).toEqual([expect.objectContaining({ id: 'pension_capital:p1', value: ['pillar3a'] })]);
    expect(missing()).toContain('pillar3a_capital:p1');
    const req = ws()
      .requirements()
      .find((r) => r.id === 'pillar3a_capital:p1')!;
    expect(req.label).toEqual({
      en: 'Pension capital attestation, pillar 3a',
      fr: 'Attestation de prestation en capital du 3e pilier A',
      de: 'Bescheinigung Kapitalleistung Säule 3a',
      it: 'Attestazione di prestazione in capitale, pilastro 3a',
    });
    expect(req.source).toMatch(/ch-na-law-lifd art\. 129/);
    // Nothing unsupported in the answers.
    expect(ws().engine.notSupported(ws().snapshot())).toEqual([]);
    // Without the attestation, no tax on it yet, and Taxpresso says so.
    const before = await call('compute_tax');
    expect(texts(before)).toMatch(/no attestation read yet for a lump sum/);
    expect(before.structuredContent).not.toHaveProperty('capital');

    await confirmed('pillar3a_capital_attestation', 'p1', [
      ['capital.amount', "85'000.00"],
      ['capital.date', '30.06.2026'],
      ['capital.reason', 'retirement'],
    ]);
    expect(missing()).not.toContain('pillar3a_capital:p1');
  });

  it('computes the tax apart, for Claude and the dashboard, never in the total', async () => {
    await favre();
    await confirmed('pillar3a_capital_attestation', 'p1', favreAttestation());
    const res = await call('compute_tax');
    const out = res.structuredContent as Record<string, unknown>;
    expect(out.capital).toEqual({
      amount: 8_500_000,
      items: [{ code: '98.12', person: 'p1', amount: 8_500_000 }],
      icc: 275_280,
      ifd: 33_885,
      total: 309_165,
    });
    const text = texts(res);
    expect(text).toMatch(
      /Pension capital of the year \(prestations en capital du 2e et 3e pilier A, 98\.12\): CHF 85’000\.00 \(98\.12 \(you\) CHF 85’000\.00\)\. A tax of its own, apart from the tax on income, at a fifth of the scale, never in the total: cantonal and communal CHF 2’752\.80, federal CHF 338\.85; together CHF 3’091\.65\./,
    );
    // Nothing assumed: the reason was read on the attestation.
    expect(text).not.toMatch(/motif du versement/);
    // The return's own total is the income and wealth tax only.
    const icc = (out.icc as { total: number }).total;
    const ifd = (out.ifd as { tax: number }).tax;
    expect(out.total).toBe(icc + ifd);
    // Each line of it, with its source, in the detail.
    const detail = await call('compute_tax', { detail: true });
    const lines = (
      detail.structuredContent as { detail: { lines: { id: string; sources: string[] }[] } }
    ).detail.lines.filter((l) => l.id.startsWith('capital.'));
    expect(lines.map((l) => l.id)).toEqual([
      'capital.amount',
      'capital.rateIncome',
      'capital.scaleTax',
      'capital.base',
      'capital.cantonalCentimes',
      'capital.reduction12',
      'capital.homeCare',
      'capital.cantonal',
      'capital.communal',
      'capital.icc',
      'capital.ifd.scaleIncome',
      'capital.ifd.scaleTax',
      'capital.ifd',
      'capital.total',
    ]);
    for (const l of lines) expect(l.sources.length, l.id).toBeGreaterThan(0);
    expect(texts(detail)).toMatch(
      /- Base tax on pension capital .*: CHF 1’611\.70\. A fifth of CHF 8’058\.45/,
    );
    expect(texts(detail)).toMatch(/ge-na-law-lipp art\. 45 al\. 2/);
    expect(texts(detail)).toMatch(/ge-na-law-ldirpp art\. 1/);

    // The dashboard: two lines in the estimate, after the return's own, each saying it is not in
    // the total; the lump sum among the form's lines (98.12). In every language.
    const en = await estimate();
    const capitalRows = (v: Estimate) => v.rows.filter((r) => r.id.startsWith('capital.'));
    expect(capitalRows(en)).toMatchObject([
      {
        id: 'capital.icc',
        label: 'Pension capital, cantonal and communal tax (not in the total)',
        amount: 275_280,
      },
      {
        id: 'capital.ifd',
        label: 'Pension capital, federal direct tax (not in the total)',
        amount: 33_885,
      },
    ]);
    expect(en.rows.slice(0, -2).some((r) => r.id.startsWith('capital.'))).toBe(false);
    expect(en.items.at(-1)).toMatchObject({
      code: '98.12',
      label:
        'Pension capital, taxed apart (Prestations en capital du 2ème et 3ème pilier A imposées au 1/5ème du barème)',
      amount: 8_500_000,
    });
    expect(en.total).toBe(out.total);
    expect(en).not.toHaveProperty('capital');
    const fr = await estimate('fr');
    expect(capitalRows(fr).map((r) => r.label)).toEqual([
      'Prestations en capital, impôt cantonal et communal (non compris dans le total)',
      'Prestations en capital, impôt fédéral direct (non compris dans le total)',
    ]);
    const de = await estimate('de');
    expect(capitalRows(de).map((r) => r.amount)).toEqual([275_280, 33_885]);
    // Geneva's content reads in English on German and Italian pages (extension/src/lang.ts).
    const it = await estimate('it');
    expect(capitalRows(it).map((r) => [r.label, r.amount])).toEqual([
      ['Pension capital, cantonal and communal tax (not in the total)', 275_280],
      ['Pension capital, federal direct tax (not in the total)', 33_885],
    ]);
  });

  it('lists it in the final check with its rules, and in the values to type at 98.12', async () => {
    await favre();
    await confirmed('pillar3a_capital_attestation', 'p1', favreAttestation());
    const check = await finalCheck();
    const item = check.know.find((i) => i.id === 'capital:taxed_apart')!;
    expect(item).toMatchObject({ kind: 'capital', code: '98.12' });
    expect(item.detail).toMatch(/CHF 85’000\.00 received this year/);
    expect(item.detail).toMatch(/CHF 3’091\.65 together/);
    expect(item.sources.map((s) => s.id)).toEqual([
      'ge-2025-guide-declaration-pp',
      'ge-na-law-lipp',
      'ch-na-law-lifd',
      'ch-2026-ifd-instructions-personnes-physiques',
    ]);
    expect(item.sources[0]?.url).toMatch(/#page=13$/);
    // A pillar 3a lump sum: no buy-in rule.
    expect(check.know.some((i) => i.id === 'capital:buy_ins')).toBe(false);
    // The rounding the documents don't spell out is said.
    expect(check.know.some((i) => i.kind === 'unverified_rule' && /fifth/.test(i.detail))).toBe(
      true,
    );

    const form = await call('get_form_values', { section: 'PG2' });
    const rows = (form.structuredContent as { rows: { ref: string; copy?: string }[] }).rows;
    expect(rows.find((r) => r.ref === '98.12')).toMatchObject({
      label: 'Prestations en capital du 2ème et 3ème pilier A imposées au 1/5ème du barème',
      copy: '85000',
    });
  });
});

describe('a 2nd pillar lump sum for a home (Morel)', () => {
  async function morel(special: string[] = ['pension_capital']) {
    await answer([
      ['canton', 'GE'],
      ['civil_status', 'single'],
      ['children', 1],
      ['children_custody', 'with_household'],
      ['commune', 'Lancy'],
      ['moved', 'no'],
      ['income_sources:p1', ['salary']],
      ['employers:p1', 1],
      ['residence:p1', 'swiss'],
      ['special', special],
      ['pension_capital:p1', ['pillar2']],
    ]);
    await confirmed('salary_certificate', 'p1', [
      ['salary.base', "95'000.00"],
      ['salary.gross', "95'000.00"],
      ['salary.social_contributions', "6'080.00"],
      ['salary.lpp_ordinary', "6'650.00"],
    ]);
    await confirmed('lpp_capital_attestation', 'p1', [
      ['capital.amount', "120'000.00"],
      ['capital.date', '15.03.2026'],
      ['capital.reason', 'home'],
    ]);
  }

  it('taxes it on the parental scale and full splitting, and recalls the buy-in rule', async () => {
    await morel();
    const out = (await call('compute_tax')).structuredContent as { capital: unknown };
    expect(out.capital).toMatchObject({
      amount: 12_000_000,
      icc: 333_100,
      ifd: 58_580,
      total: 391_680,
    });
    const check = await finalCheck();
    const buyIns = check.know.find((i) => i.id === 'capital:buy_ins')!;
    expect(buyIns.sources.map((s) => `${s.id} ${s.where}`)).toEqual([
      'ge-2025-guide-declaration-pp p. 18',
      'ch-na-law-lpp art. 79b al. 3 (p. 66)',
    ]);
  });

  it('still taxes the lump sum when the home itself is not supported yet', async () => {
    await morel(['real_estate', 'pension_capital']);
    // A property in Geneva is prepared (property.test.ts); one in another canton is not.
    await answer([['swiss_property', 'other_canton']]);
    expect(
      ws()
        .engine.notSupported(ws().snapshot())
        .map((x) => x.what.en),
    ).toEqual(['A property in another canton']);
    const out = (await call('compute_tax')).structuredContent as { capital: { total: number } };
    expect(out.capital.total).toBe(391_680);
  });

  it('stops the income tax when a buy-in falls in the same year', async () => {
    await morel();
    await confirmed('lpp_buyin', 'p1', [['lpp.buyin', "10'000.00"]]);
    const res = await call('compute_tax');
    const out = res.structuredContent as { total: number | null; capital: { total: number } };
    expect(out.total).toBeNull();
    expect(out.capital.total).toBe(391_680);
    expect(texts(res)).toMatch(/Not computed: .*LPP art\. 79b al\. 3/);
  });
});

describe('two lump sums of a married couple in the same year (Rochat)', () => {
  it('adds them up for one tax, and asks one amount at 98.12', async () => {
    await answer([
      ['canton', 'GE'],
      ['civil_status', 'married'],
      ['children', 0],
      ['commune', 'Vernier'],
      ['moved', 'no'],
      ['income_sources:p1', ['pension']],
      ['income_sources:p2', ['pension']],
      ['special', ['pension_capital']],
      ['pension_capital:p1', ['pillar2']],
      ['pension_capital:p2', ['pillar3a']],
    ]);
    expect(missing()).toEqual(expect.arrayContaining(['lpp_capital:p1', 'pillar3a_capital:p2']));
    await confirmed('lpp_capital_attestation', 'p1', [
      ['capital.amount', "300'000.00"],
      ['capital.date', '2026-09-30'],
      ['capital.reason', 'retirement'],
    ]);
    await confirmed('pillar3a_capital_attestation', 'p2', [
      ['capital.amount', "60'000.00"],
      ['capital.date', '2026-11-15'],
      ['capital.reason', 'retirement'],
    ]);
    const out = (await call('compute_tax')).structuredContent as { capital: unknown };
    expect(out.capital).toEqual({
      amount: 36_000_000,
      items: [
        { code: '98.12', person: 'p1', amount: 30_000_000 },
        { code: '98.12', person: 'p2', amount: 6_000_000 },
      ],
      icc: 1_593_080,
      ifd: 653_600,
      total: 2_246_680,
    });
    const en = await estimate();
    expect(en.items.filter((i) => i.code === '98.12').map((i) => [i.who, i.amount])).toEqual([
      ['you', 30_000_000],
      ['your spouse', 6_000_000],
    ]);
    expect(en.rows.filter((r) => r.id.startsWith('capital.')).map((r) => r.amount)).toEqual([
      1_593_080, 653_600,
    ]);
    const form = await call('get_form_values', { section: 'PG2' });
    const rows = (form.structuredContent as { rows: { ref: string; copy?: string }[] }).rows;
    expect(rows.filter((r) => r.ref === '98.12')).toEqual([
      expect.objectContaining({ copy: '360000' }),
    ]);
  });
});

describe('what fails closed', () => {
  it('a lump sum paid on leaving Switzerland, as its attestation says: not computed', async () => {
    await favre();
    await confirmed('pillar3a_capital_attestation', 'p1', favreAttestation(2026, 'leaving'));
    const res = await call('compute_tax');
    expect((res.structuredContent as { capital: unknown }).capital).toMatchObject({
      amount: 8_500_000,
      icc: null,
      ifd: null,
      total: null,
    });
    expect(texts(res)).toMatch(
      /Not computed: Tax on pension capital not computed: a lump sum paid on leaving Switzerland is taxed at source \(ge-2026-source-directives p\. 39\)/,
    );
    // The income tax is still there; the estimate shows no capital line, and says why.
    const en = await estimate();
    expect(en.total).not.toBeNull();
    expect(en.rows.some((r) => r.id.startsWith('capital.'))).toBe(false);
    expect(en.notes.some((n) => /leaving Switzerland/.test(n))).toBe(true);
    const check = await finalCheck();
    expect(check.fix.some((i) => i.kind === 'not_computed')).toBe(true);
  });

  it('another reason on the attestation: not computed either', async () => {
    await favre();
    await confirmed('pillar3a_capital_attestation', 'p1', favreAttestation(2026, 'other'));
    const res = await call('compute_tax');
    expect((res.structuredContent as { capital: { total: unknown } }).capital.total).toBeNull();
    expect(texts(res)).toMatch(/another rubric \(98\.75\)/);
  });

  it('an attestation that gives no reason: computed, and the assumption said', async () => {
    await favre();
    await confirmed('pillar3a_capital_attestation', 'p1', favreAttestation().slice(0, 2));
    const res = await call('compute_tax');
    expect((res.structuredContent as { capital: { total: number } }).capital.total).toBe(309_165);
    const check = await finalCheck();
    expect(
      check.know.some((i) => i.kind === 'assumption' && /motif du versement/.test(i.detail)),
    ).toBe(true);
  });

  it('another canton keeps it not supported, and never leaves it out silently', async () => {
    await answer([
      ['canton', 'ZH'],
      ['civil_status', 'single'],
      ['children', 0],
    ]);
    const special = ws()
      .snapshot()
      .slots.find((s) => s.question.id === 'special')!
      .question.options!.find((o) => o.value === 'pension_capital')!;
    expect(special.notSupported).toBeDefined();
    // Zurich's return doesn't read the attestation's values: refused, with a reason.
    const { document } = await ws().addDocument(
      Buffer.from('%PDF-1.7 synthetic 3a capital, Zurich'),
      'capital-zh.pdf',
      'dashboard',
    );
    await expect(
      ws().proposeExtraction(document.id, { kind: 'pillar3a_capital_attestation', taxYear: 2026 }, [
        { key: 'capital.amount', value: "40'000.00", page: 1 },
      ]),
    ).rejects.toThrow(/not a value Taxpresso reads in this canton yet/);
  });

  it('a return moved to another canton after its attestation: said, never left out', async () => {
    await favre();
    await confirmed('pillar3a_capital_attestation', 'p1', favreAttestation());
    await answer([
      ['canton', 'ZH'],
      ['commune', 'Winterthur'],
    ]);
    const res = await call('compute_tax');
    expect(texts(res)).toMatch(
      /Tax on pension capital \(a lump sum from the 2nd pillar or pillar 3a\) not computed: Taxpresso computes it for Geneva only so far/,
    );
  });
});

describe('the 2025 return (the 2025 rules, the 2025 form)', () => {
  it('computes Favre’s 2025 lump sum, with 2025 documents only', async () => {
    const opened = await call('open_tax_year', { year: 2025 });
    expect(opened.isError, texts(opened)).toBeFalsy();
    expect(ws().taxYear).toBe(2025);
    await favre();
    // An attestation of 2026 doesn't count for 2025 (LIFD art. 38 al. 1bis): said, not taxed.
    await confirmed('pillar3a_capital_attestation', 'p1', favreAttestation(2026));
    const early = await call('compute_tax');
    expect(early.structuredContent).not.toHaveProperty('capital');
    expect(texts(early)).toMatch(/paid on 2026-06-30: it belongs to the tax of 2026, not 2025/);

    await confirmed('pillar3a_capital_attestation', 'p1', favreAttestation(2025));
    const res = await call('compute_tax', { detail: true });
    const out = res.structuredContent as Record<string, unknown>;
    expect(out.taxYear).toBe(2025);
    // Hand-checked: ICC 2’752.80 (the same scale both years), IFD 2025 1’698.00 / 5 = 339.60.
    expect(out.capital).toEqual({
      amount: 8_500_000,
      items: [{ code: '98.12', person: 'p1', amount: 8_500_000 }],
      icc: 275_280,
      ifd: 33_960,
      total: 309_240,
    });
    const capitalLines = (
      out as { detail: { lines: { id: string; sources: string[] }[] } }
    ).detail.lines.filter((l) => l.id.startsWith('capital.'));
    expect(capitalLines.length).toBeGreaterThan(10);
    expect(capitalLines.flatMap((l) => l.sources).join('\n')).not.toMatch(/2026/);

    const check = await finalCheck();
    const item = check.know.find((i) => i.id === 'capital:taxed_apart')!;
    expect(item.sources.map((s) => s.id)).toEqual([
      'ge-2025-guide-declaration-pp',
      'ge-na-law-lipp',
      'ch-na-law-lifd',
    ]);
    // The 2025 form: 98.12 with its printed label, the amount to type.
    const form = await call('get_form_values', { section: 'PG2' });
    const rows = (form.structuredContent as { rows: { ref: string; copy?: string }[] }).rows;
    expect(rows.find((r) => r.ref === '98.12')).toMatchObject({
      label: 'Prestations en capital du 2ème et 3ème pilier A imposées au 1/5ème du barème',
      copy: '85000',
    });
    const en = await estimate();
    expect(en.taxYear).toBe(2025);
    expect(en.rows.filter((r) => r.id.startsWith('capital.')).map((r) => r.amount)).toEqual([
      275_280, 33_960,
    ]);
  });
});
