// Lump sums from the 2nd pillar and pillar 3a in Geneva, end to end through the extension: the
// questions, the attestations, the separate tax for Claude (compute_tax) and the dashboard, the
// final check and the values to type (98.12). Synthetic households on a temporary vault, made-up
// people: Hélène Favre (Carouge), Lucas Morel (Lancy), Pierre and Anne Rochat (Vernier). Their
// figures are worked out by hand in packages/rules-ge/test/capital.test.ts.
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

beforeEach(async () => {
  const uiDir = await makeUiDir();
  ws = await makeWorkspace(uiDir);
  dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(ws) });
  const server = createTaxpressoServer({ workspace: ws, dashboard });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
  await ws.ready();
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
  const { document } = await ws.addDocument(
    Buffer.from(`%PDF-1.7 synthetic pension capital document ${n}`),
    `${kind}-${n}.pdf`,
    'dashboard',
  );
  await ws.proposeExtraction(
    document.id,
    { kind, taxYear: 2026, person },
    values.map(([key, value]) => ({ key, value, page: 1 })),
  );
  if (confirm) await ws.confirmDocument(document.id, 'dashboard');
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
  ws
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
    ['special', ['pension_capital']],
    ['pension_capital:p1', ['pillar3a']],
    ['pension_capital_reason:p1', ['retirement']],
  ]);
  await confirmed('pension_certificate', 'p1', [
    ['pension.amount', "30'240.00"],
    ['pension.type', 'avs_ai'],
  ]);
}

describe('a pillar 3a paid out at retirement (Favre)', () => {
  it('asks who received which and why, then the attestation', async () => {
    await favre();
    expect(missing()).toContain('pillar3a_capital:p1');
    const req = ws.requirements().find((r) => r.id === 'pillar3a_capital:p1')!;
    expect(req.label).toEqual({
      en: 'Pension capital attestation, pillar 3a',
      fr: 'Attestation de prestation en capital du 3e pilier A',
      de: 'Bescheinigung Kapitalleistung Säule 3a',
      it: 'Attestazione di prestazione in capitale, pilastro 3a',
    });
    expect(req.source).toMatch(/ch-na-law-lifd art\. 129/);
    // Nothing unsupported in the answers.
    expect(ws.engine.notSupported(ws.snapshot())).toEqual([]);
    // Without the attestation, no tax on it yet, and Taxpresso says so.
    const before = await call('compute_tax');
    expect(texts(before)).toMatch(/no attestation read yet for a lump sum/);
    expect(before.structuredContent).not.toHaveProperty('capital');

    await confirmed('pillar3a_capital_attestation', 'p1', [
      ['capital.amount', "85'000.00"],
      ['capital.date', '30.06.2026'],
    ]);
    expect(missing()).not.toContain('pillar3a_capital:p1');
  });

  it('computes the tax apart, for Claude and the dashboard, never in the total', async () => {
    await favre();
    await confirmed('pillar3a_capital_attestation', 'p1', [
      ['capital.amount', "85'000.00"],
      ['capital.date', '2026-06-30'],
    ]);
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
      /Pension capital of the year \(prestations en capital du 2e et 3e pilier A, 98\.12\): CHF 85’000\.00 \(98\.12 \(you\) CHF 85’000\.00\)\. A tax of its own, apart from the tax on income, at a fifth of the scale, never in the total: Cantonal and communal tax on it \(ICC\) CHF 2’752\.80, Federal direct tax on it \(IFD\) CHF 338\.85; together CHF 3’091\.65\./,
    );
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

    // The dashboard: its own block, in every language.
    const en = await estimate();
    expect(en.capital).toMatchObject({
      amount: { id: 'capital.amount', amount: 8_500_000 },
      rows: [
        { id: 'capital.icc', label: 'Cantonal and communal tax on it (ICC)', amount: 275_280 },
        { id: 'capital.ifd', label: 'Federal direct tax on it (IFD)', amount: 33_885 },
      ],
      total: { id: 'capital.total', amount: 309_165, estimate: true },
    });
    expect(en.total).toBe(out.total);
    const fr = await estimate('fr');
    expect(fr.capital?.amount.label).toBe('Prestations en capital du 2e et 3e pilier A (98.12)');
    expect(fr.capital?.rows[0]?.label).toBe('Impôt cantonal et communal (ICC)');
    const de = await estimate('de');
    expect(de.capital?.rows.map((r) => r.amount)).toEqual([275_280, 33_885]);
    // Geneva's content reads in English on German and Italian pages (extension/src/lang.ts).
    const it = await estimate('it');
    expect(it.capital?.rows.map((r) => [r.label, r.amount])).toEqual([
      ['Cantonal and communal tax on it (ICC)', 275_280],
      ['Federal direct tax on it (IFD)', 33_885],
    ]);
  });

  it('lists it in the final check with its rules, and in the values to type at 98.12', async () => {
    await favre();
    await confirmed('pillar3a_capital_attestation', 'p1', [
      ['capital.amount', "85'000.00"],
      ['capital.date', '2026-06-30'],
    ]);
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
      ['taxed_at_source:p1', false],
      ['special', special],
      ['pension_capital:p1', ['pillar2']],
      ['pension_capital_reason:p1', ['home']],
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
    expect(ws.engine.notSupported(ws.snapshot()).map((x) => x.what.en)).toEqual([
      'Real estate (annexe D)',
    ]);
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
      ['pension_capital_reason:p1', ['retirement']],
      ['pension_capital_reason:p2', ['retirement']],
    ]);
    expect(missing()).toEqual(expect.arrayContaining(['lpp_capital:p1', 'pillar3a_capital:p2']));
    await confirmed('lpp_capital_attestation', 'p1', [
      ['capital.amount', "300'000.00"],
      ['capital.date', '2026-09-30'],
    ]);
    await confirmed('pillar3a_capital_attestation', 'p2', [
      ['capital.amount', "60'000.00"],
      ['capital.date', '2026-11-15'],
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
    expect(en.capital?.items.map((i) => [i.who, i.amount])).toEqual([
      ['you', 30_000_000],
      ['your spouse', 6_000_000],
    ]);
    const form = await call('get_form_values', { section: 'PG2' });
    const rows = (form.structuredContent as { rows: { ref: string; copy?: string }[] }).rows;
    expect(rows.filter((r) => r.ref === '98.12')).toEqual([
      expect.objectContaining({ copy: '360000' }),
    ]);
  });
});

describe('what fails closed', () => {
  it('a lump sum paid on leaving Switzerland: not supported, and not computed', async () => {
    await favre();
    await answer([['pension_capital_reason:p1', ['leaving']]]);
    expect(ws.engine.notSupported(ws.snapshot()).map((x) => x.what.en)).toEqual([
      'A lump sum paid on leaving Switzerland (taxed at source)',
    ]);
    await confirmed('pillar3a_capital_attestation', 'p1', [['capital.amount', "85'000.00"]]);
    const res = await call('compute_tax');
    expect((res.structuredContent as { capital: unknown }).capital).toMatchObject({
      amount: 8_500_000,
      icc: null,
      ifd: null,
      total: null,
    });
    expect(texts(res)).toMatch(
      /Not computed: Tax on pension capital not computed: a lump sum paid on leaving Switzerland/,
    );
    const check = await finalCheck();
    expect(check.fix.some((i) => i.kind === 'not_computed')).toBe(true);
  });

  it('another canton keeps it not supported, and never leaves it out silently', async () => {
    await answer([
      ['canton', 'ZH'],
      ['civil_status', 'single'],
      ['children', 0],
    ]);
    const special = ws
      .snapshot()
      .slots.find((s) => s.question.id === 'special')!
      .question.options!.find((o) => o.value === 'pension_capital')!;
    expect(special.notSupported).toBeDefined();
    // Zurich's return doesn't read the attestation's values: refused, with a reason.
    const { document } = await ws.addDocument(
      Buffer.from('%PDF-1.7 synthetic 3a capital, Zurich'),
      'capital-zh.pdf',
      'dashboard',
    );
    await expect(
      ws.proposeExtraction(document.id, { kind: 'pillar3a_capital_attestation', taxYear: 2026 }, [
        { key: 'capital.amount', value: "40'000.00", page: 1 },
      ]),
    ).rejects.toThrow(/not a value Taxpresso reads in this canton yet/);
  });

  it('a return moved to another canton after its attestation: said, never left out', async () => {
    await favre();
    await confirmed('pillar3a_capital_attestation', 'p1', [['capital.amount', "85'000.00"]]);
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
