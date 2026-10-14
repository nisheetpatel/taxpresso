// Self-employment in Geneva end to end (SPEC.md section 1, the simple case): the questions, the
// business's documents, the tax for Claude (compute_tax) and the dashboard, the final check, the
// copy panel's annexe B, and the 3a room before 31 December. Synthetic households on a temporary
// vault, never the real one: Léa Martin in Carouge, Marc and Sofia Dupuis in Vernier, Noé Favre in
// Onex. Their taxes were derived by hand from the official documents in
// packages/rules-ge/test/self-employment.test.ts (S1 to S3), whose figures these must match.
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import type { DocumentKind } from '@taxpresso/ledger';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
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

beforeEach(async () => {
  docYear = 2026;
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

/** Answers in order, through the tool, each answer accepted. */
async function answer(pairs: [string, unknown][]) {
  for (const [id, value] of pairs) {
    const res = await call('answer_question', { id, value });
    expect(res.isError, `${id}: ${texts(res)}`).toBeFalsy();
  }
}

let n = 0;
/** A document of the user's with the values Claude read in it (synthetic bytes), confirmed or not. */
async function document(
  kind: DocumentKind,
  person: 'p1' | 'p2' | 'household',
  values: [string, string][],
  confirm = true,
) {
  n += 1;
  const { document: doc } = await ws.addDocument(
    Buffer.from(`%PDF-1.7 synthetic self-employment document ${n}`),
    `${kind}-${n}.pdf`,
    'dashboard',
  );
  // As Claude would: what the document is, and each value with its page.
  const res = await call('propose_extraction', {
    id: doc.id,
    document: { kind, taxYear: docYear, person },
    values: values.map(([key, value]) => ({ key, value, page: 1 })),
  });
  expect(res.isError, texts(res)).toBeFalsy();
  if (confirm) await ws.confirmDocument(doc.id, 'dashboard');
  return doc;
}

const BUSINESS = (who: string): [string, unknown][] => [
  [`business_form:${who}`, 'sole_proprietor'],
  [`business_year:${who}`, 'calendar'],
  [`business_place:${who}`, 'home_commune'],
  [`business_method:${who}`, 'invoice'],
  [`business_special:${who}`, []],
];

/** S1. Léa Martin, single, Carouge: a graphic design studio in her own name, no pension fund. */
async function lea({ confirmAvs = true } = {}) {
  await answer([
    ['canton', 'GE'],
    ['civil_status', 'single'],
    ['children', 0],
    ['commune', 'Carouge'],
    ['moved', 'no'],
    ['income_sources:p1', ['self_employment']],
    ...BUSINESS('p1'),
    ['business_losses:p1', false],
    ['pillar3a:p1', true],
    ['banks', 0],
    ['crypto', false],
    ['payments', []],
    ['special', []],
  ]);
  await document('business_accounts', 'p1', [
    ['business.name', 'Atelier Léa Martin, graphisme'],
    ['business.period_from', `01.01.${docYear}`],
    ['business.period_to', `31.12.${docYear}`],
    ['business.turnover', "120'000.00"],
    ['business.other_income', '500.00'],
    ['business.costs_goods', "8'000.00"],
    ['business.depreciation', "3'000.00"],
    ['business.costs_other', "14'500.00"],
    ['business.current_assets', "230'000.00"],
    ['business.fixed_assets', "20'000.00"],
    ['business.liabilities', "10'000.00"],
  ]);
  await document('avs_contributions', 'p1', [['avs.contributions_year', "9'000.00"]], confirmAvs);
  await document('pillar3a_attestation', 'p1', [['pillar3a.paid', "18'000.00"]]);
  await document('health_premiums', 'household', [['health.premiums', "6'000.00"]]);
}

/** S2. Marc (salaried) and Sofia Dupuis (self-employed, no pension fund), Vernier. */
async function dupuis() {
  await answer([
    ['canton', 'GE'],
    ['civil_status', 'married'],
    ['children', 0],
    ['commune', 'Vernier'],
    ['moved', 'no'],
    ['income_sources:p1', ['salary']],
    ['employers:p1', 1],
    ['taxed_at_source:p1', false],
    ['income_sources:p2', ['self_employment']],
    ...BUSINESS('p2'),
    ['business_losses:p2', false],
    ['pillar3a:p1', true],
    ['pillar3a:p2', true],
    ['lpp_buyin:p1', false],
    ['commute:p1', 'walk'],
    ['meal_days:p1', 0],
    ['banks', 0],
    ['crypto', false],
    ['payments', []],
    ['special', []],
  ]);
  await document('salary_certificate', 'p1', [
    ['salary.base', "90'000.00"],
    ['salary.gross', "90'000.00"],
    ['salary.social_contributions', "5'800.00"],
    ['salary.lpp_ordinary', "6'500.00"],
  ]);
  await document('pillar3a_attestation', 'p1', [['pillar3a.paid', "7'258.00"]]);
  await document('business_accounts', 'p2', [
    ['business.name', 'Dupuis Traductions'],
    ['business.turnover', "48'000.00"],
    ['business.costs_goods', "2'000.00"],
    ['business.costs_other', "6'000.00"],
    ['business.current_assets', "15'000.00"],
    ['business.liabilities', "3'000.00"],
  ]);
  await document('avs_contributions', 'p2', [['avs.contributions_year', "4'000.00"]]);
  await document('pillar3a_attestation', 'p2', [['pillar3a.paid', "6'000.00"]]);
  await document('health_premiums', 'household', [['health.premiums', "9'000.00"]]);
}

/** S3. Noé Favre, single, Onex: a part-time salary and a small repair business with a loss. */
async function favre() {
  await answer([
    ['canton', 'GE'],
    ['civil_status', 'single'],
    ['children', 0],
    ['commune', 'Onex'],
    ['moved', 'no'],
    ['income_sources:p1', ['salary', 'self_employment']],
    ['employers:p1', 1],
    ['taxed_at_source:p1', false],
    ...BUSINESS('p1'),
    ['business_losses:p1', true],
    ['business_losses_icc:p1', 2_000],
    ['business_losses_ifd:p1', 2_000],
    ['pillar3a:p1', true],
    ['lpp_buyin:p1', false],
    ['commute:p1', 'walk'],
    ['meal_days:p1', 0],
    ['banks', 0],
    ['crypto', false],
    ['payments', []],
    ['special', []],
  ]);
  await document('salary_certificate', 'p1', [
    ['salary.base', "50'000.00"],
    ['salary.gross', "50'000.00"],
    ['salary.social_contributions', "3'200.00"],
    ['salary.lpp_ordinary', "2'500.00"],
  ]);
  await document('business_accounts', 'p1', [
    ['business.turnover', "20'000.00"],
    ['business.costs_other', "26'000.00"],
    ['business.current_assets', "4'000.00"],
    ['business.liabilities', "1'000.00"],
  ]);
  await document('avs_contributions', 'p1', [['avs.contributions_year', '800.00']]);
  await document('pillar3a_attestation', 'p1', [['pillar3a.paid', "3'000.00"]]);
  await document('health_premiums', 'household', [['health.premiums', "4'000.00"]]);
}

interface TaxOut {
  computed: boolean;
  total: number;
  icc: { total: number; taxableIncome: number; taxableWealth: number };
  ifd: { tax: number; taxableIncome: number; scale: string };
  unsupported: string[];
  notSupported: string[];
  unverifiedRules: string[];
}

const rowsOf = (s: DashboardState) =>
  s.copyPanel.sections.flatMap((x) =>
    x.groups.flatMap((g) => g.rows.map((r) => ({ page: x.page, section: g.section, ...r }))),
  );

describe('self-employment in Geneva, end to end', () => {
  it('S1: the studio’s accounts give the tax derived by hand, for Claude and the dashboard', async () => {
    await lea();
    expect(ws.snapshot().slots.filter((s) => s.value === undefined)).toEqual([]);
    const status = await call('get_status');
    expect(texts(status)).not.toMatch(/Not supported/);
    const res = await call('compute_tax', { detail: true });
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, unsupported: [], notSupported: [] });
    expect(out.icc.total).toBe(874_685);
    expect(out.icc.taxableIncome).toBe(6_280_000);
    expect(out.icc.taxableWealth).toBe(3_236_800);
    expect(out.ifd).toMatchObject({ tax: 87_930, taxableIncome: 6_700_000, scale: 'single' });
    expect(out.total).toBe(874_685 + 87_930);
    expect(out.unverifiedRules.join(' ')).toMatch(/51\.60/);
    const text = texts(res);
    expect(text).toMatch(/12\.01 Bénéfice net \(you\) CHF 95’000/);
    expect(text).toMatch(/32\.40 Cotisations au 3ème pilier A/);

    // The dashboard: the same tax, and annexe B on the copy panel in the form's order.
    const s = await state();
    expect(s.estimate).toMatchObject({ total: 874_685 + 87_930 });
    const rows = rowsOf(s);
    const at = (page: string) => rows.filter((r) => r.page === page).map((r) => [r.ref, r.copy]);
    expect(at('B1')).toEqual([
      ['B1-A', undefined],
      ['B1-NOM', 'Atelier Léa Martin, graphisme'],
      ['B1-COMMUNE', '6608'],
      ['B1-RI', undefined],
      ['B1-DU', '01.01.2026'],
      ['B1-AU', '31.12.2026'],
      ['B1-FACT', undefined],
      ['B1-DEBUT', 'Non'],
      ['B1-FIN', 'Non'],
    ]);
    expect(at('B2')).toEqual([
      ['12.08', '120000'],
      ['12.16', '500'],
      ['12.17', '120500'],
      ['12.21', '8000'],
      ['12.23', '3000'],
      ['12.42', '14500'],
      ['12.45', '25500'],
      ['12.46', '95000'],
      ['12.01', '95000'],
      ['12.48', '230000'],
      ['12.49', '20000'],
      ['12.50', '250000'],
      ['57.50', '10000'],
      ['12.52', '240000'],
    ]);
    expect(at('B4')).toEqual([
      ['32.10', '9000'],
      ['32.40', '18000'],
      ['32.00', '26200'],
    ]);
    // Every B2 and B4 line sits in taxpayer A's sheet, in both columns where the form has two.
    expect(rows.filter((r) => /^B[124]$/.test(r.page)).every((r) => r.person === 'A')).toBe(true);
    expect(rows.find((r) => r.ref === '12.08')!.columns.map((c) => c.id)).toEqual(['icc', 'ifd']);
    expect(rows.find((r) => r.ref === '12.50')!.columns.map((c) => c.id)).toEqual(['wealth']);
    // The totals carried to the summary pages, and the deduction on business wealth.
    expect(rows.filter((r) => r.page === 'PG2').map((r) => [r.ref, r.copy])).toEqual([
      ['12.00', '95000'],
    ]);
    expect(rows.filter((r) => r.page === 'PG3' && r.ref === '32.00').map((r) => r.copy)).toEqual([
      '26200',
    ]);
    expect(
      rows.filter((r) => r.page === 'PG4').map((r) => [r.ref, r.copy, r.person, r.role]),
    ).toEqual(
      expect.arrayContaining([
        ['12.00', '250000', 'household', 'report'],
        ['57.00', '10000', 'household', 'report'],
        ['51.60', '120000', 'A', 'computed'],
      ]),
    );
    expect(s.copyPanel.unplaced).toEqual([]);
    // For Claude: the same values, page by page.
    const b2 = await call('get_form_values', { section: 'B2' });
    expect(texts(b2)).toMatch(/12\.46 Bénéfice\/\(Perte\)/);
    expect(texts(b2)).toMatch(/12\.52 Capital propre/);
    // The 3a limit before 31 December, from the year's accounts once read: 20 % of 95'000 less
    // 9'000 of AVS contributions, 17'200.
    const plan = (await call('list_optimizations')).structuredContent as {
      pillar3a: { people: { capCentimes: number; capIsMaximum: boolean }[] };
    };
    expect(plan.pillar3a.people[0]).toMatchObject({ capCentimes: 1_720_000, capIsMaximum: false });
  });

  it('S1: the final check names the limits, the rule to check and the value still to confirm', async () => {
    await lea({ confirmAvs: false });
    const res = await call('final_check', { detail: true });
    const check = res.structuredContent as {
      verdict: string;
      fix: { kind: string; code?: string; title: string }[];
      know: { kind: string; code?: string; title: string; detail: string }[];
    };
    expect(check.verdict).toBe('not_ready');
    // The AVS statement still needs the user's OK.
    expect(check.fix.some((i) => i.kind === 'needs_ok' && /^32\.10 .*AVS/.test(i.title))).toBe(
      true,
    );
    // 3a over its limit without a pension fund, 20 % of 86'000 = 17'200.
    const p3a = check.know.find((i) => i.kind === 'limit' && i.code === '32.40')!;
    expect(p3a.detail).toMatch(/CHF 18’000\.00; the limit is CHF 17’200\.00/);
    // The deduction on business wealth and the reading Taxpresso takes of it.
    expect(check.know.some((i) => i.kind === 'unverified_rule' && /51\.60/.test(i.detail))).toBe(
      true,
    );
    expect(check.know.some((i) => i.kind === 'assumption' && /accounts/.test(i.detail))).toBe(true);
  });

  it('S2: the couple’s tax derived by hand, the two-earner deduction on annexe B', async () => {
    await dupuis();
    const out = (await call('compute_tax')).structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, unsupported: [], notSupported: [] });
    expect(out.icc.total).toBe(952_035);
    expect(out.icc.taxableIncome).toBe(8_857_900);
    expect(out.ifd).toMatchObject({ tax: 88_100, taxableIncome: 7_751_100, scale: 'married' });
    const rows = rowsOf(await state('fr'));
    // Sofia's sheet is taxpayer B's; Marc's 3a stays on A1, hers goes to B4.
    expect(rows.filter((r) => r.page === 'B2').every((r) => r.person === 'B')).toBe(true);
    expect(
      rows
        .filter((r) => r.page === 'B4')
        .map((r) => [r.ref, r.copy, r.columns.map((c) => c.id).join('+')]),
    ).toEqual([
      ['32.10', '4000', 'icc+ifd'],
      ['32.40', '6000', 'icc+ifd'],
      ['32.90', '14100', 'ifd'],
      ['32.95', '1051', 'icc'],
      ['32.00', '11051', 'icc'],
      ['32.00', '24100', 'ifd'],
    ]);
    expect(rows.find((r) => r.page === 'A1' && r.ref === '31.40')!.copy).toBe('7258');
    expect(rows.some((r) => r.ref === '41.40')).toBe(false);
    expect(rows.find((r) => r.ref === 'B1-B')).toBeDefined();
  });

  it('S3: a loss and earlier losses, derived by hand, on 57.10, 57.20 and 57.00', async () => {
    await favre();
    const out = (await call('compute_tax')).structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, unsupported: [] });
    expect(out.icc.total).toBe(127_310);
    expect(out.icc.taxableIncome).toBe(2_717_100);
    expect(out.ifd).toMatchObject({ tax: 10_395, taxableIncome: 2_870_000 });
    const rows = rowsOf(await state());
    expect(rows.filter((r) => r.page === 'B2').map((r) => [r.ref, r.copy])).toEqual([
      ['12.08', '20000'],
      ['12.17', '20000'],
      ['12.42', '26000'],
      ['12.45', '26000'],
      ['12.46', '6000'],
      ['57.10', '6000'],
      ['57.20', '2000'],
      ['57.00', '8000'],
      ['12.48', '4000'],
      ['12.50', '4000'],
      ['57.50', '1000'],
      ['12.52', '3000'],
    ]);
    // With a salary, the 3a stays on A1 (31.40); the loss reaches PG3 57.00.
    expect(rows.find((r) => r.ref === '31.40')!.copy).toBe('3000');
    expect(rows.find((r) => r.page === 'PG3' && r.ref === '57.00')!.copy).toBe('8000');
  });

  it('fails closed with plain words beyond the simple case', async () => {
    await lea();
    await answer([['business_special:p1', ['vat']]]);
    const out = (await call('compute_tax')).structuredContent as TaxOut;
    expect(out.computed).toBe(true);
    expect(out.icc).toBeNull();
    expect(out.ifd).toBeNull();
    expect(out.notSupported).toEqual(['VAT (TVA)']);
    expect(out.unsupported.join(' ')).toMatch(
      /can’t prepare VAT \(TVA\) yet, so no tax is computed/,
    );
    const status = await call('get_status');
    expect(texts(status)).toMatch(/Not supported yet: VAT \(TVA\)/);
    const check = (await call('final_check')).structuredContent as {
      fix: { kind: string }[];
    };
    expect(check.fix.map((i) => i.kind)).toEqual(
      expect.arrayContaining(['not_supported', 'not_computed']),
    );
  });

  it('plans the 3a room of a self-employed person from the year’s expected profit', async () => {
    await answer([
      ['canton', 'GE'],
      ['civil_status', 'single'],
      ['children', 0],
      ['commune', 'Carouge'],
      ['moved', 'no'],
      ['income_sources:p1', ['self_employment']],
    ]);
    // Before the profit is known: the most a person without a pension fund can pay.
    let plan = (await call('list_optimizations')).structuredContent as {
      pillar3a: { people: { capCentimes: number; capIsMaximum: boolean }[] };
    };
    expect(plan.pillar3a.people[0]).toMatchObject({ capCentimes: 3_628_800, capIsMaximum: true });
    expect(texts(await call('list_optimizations'))).toMatch(/plan\.business_profit/);
    // The dashboard has no field of its own for it: the existing 3a plan, without a pension fund.
    let s = await state();
    expect(s.plan!.inputs[0]).toEqual({
      person: 'p1',
      gross: null,
      net: null,
      hasPensionFund: false,
      paid: 0,
    });
    const refused = await createApi(ws)(
      req('POST', '/plan', { person: 'p1', field: 'business', value: 70_000 }),
    );
    expect(refused.status).toBe(400);
    // Asked in the chat in plain words: the profit after AVS, 70'000, gives 20 % = 14'000.
    const said = await call('set_fact', { key: 'plan.business_profit', value: 70_000 });
    expect(said.isError, texts(said)).toBeFalsy();
    s = await state();
    expect(s.plan!.result.people[0]).toMatchObject({ capCentimes: 1_400_000, capIsMaximum: false });
    await call('set_fact', { key: 'plan.pillar3a_paid', value: 4_000 });
    plan = (await call('list_optimizations')).structuredContent as typeof plan;
    expect(plan.pillar3a.people[0]).toMatchObject({ capCentimes: 1_400_000 });
    expect(
      (plan.pillar3a as unknown as { saving?: { totalCentimes: number } }).saving!.totalCentimes,
    ).toBeGreaterThan(0);
  });

  it('a seeded fuzz through the tools: no error, no negative tax, fail closed where expected', async () => {
    const rng = (seed: number) => {
      let a = seed >>> 0;
      return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
    for (let seed = 1; seed <= 12; seed++) {
      if (seed > 1) {
        await client.close();
        await dashboard.stop();
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
      const r = rng(seed * 7_919);
      const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
      let outside = false;
      // Every question as the next one comes, a business for p1 and maybe for p2.
      await answer([['canton', 'GE']]);
      for (let i = 0; i < 60; i++) {
        const next = (await call('next_questions')).structuredContent as {
          questions: {
            id: string;
            type: string;
            options?: { value: string; notSupported: boolean }[];
            min?: number;
          }[];
        };
        const q = next.questions[0];
        if (!q) break;
        const options = q.options ?? [];
        const ok = options.filter((o) => !o.notSupported);
        let value: unknown;
        if (q.id.startsWith('income_sources')) {
          value = [
            ...(r() < 0.4 ? ['salary'] : []),
            ...(q.id.endsWith('p1') || r() < 0.5 ? ['self_employment'] : []),
          ];
        } else if (q.id === 'civil_status') value = pick(['single', 'married']);
        else if (q.id === 'commune') value = pick(['Carouge', 'Onex', 'Vernier', 'Meyrin']);
        else if (q.id === 'special') value = [];
        else if (q.type === 'multi') {
          value =
            r() < 0.1 && options.some((o) => o.notSupported)
              ? [pick(options.filter((o) => o.notSupported)).value]
              : [];
        } else if (q.type === 'yesno')
          value = q.id.startsWith('taxed_at_source') ? r() < 0.1 : r() < 0.4;
        else if (q.type === 'number') value = q.min ?? 0;
        else if (q.type === 'money') value = Math.floor(r() * 30_000);
        else
          value =
            r() < 0.08 && options.some((o) => o.notSupported)
              ? pick(options.filter((o) => o.notSupported)).value
              : pick(ok).value;
        const res = await call('answer_question', { id: q.id, value });
        expect(res.isError, `seed ${seed} ${q.id}: ${texts(res)}`).toBeFalsy();
        if ((res.structuredContent as { notSupported: string[] }).notSupported.length)
          outside = true;
        if (q.id.startsWith('taxed_at_source') && value === true) outside = true;
      }
      const people = ws.snapshot().people.filter((p): p is 'p1' | 'p2' => p === 'p1' || p === 'p2');
      for (const p of people) {
        const sources = ws.snapshot().answers.get(`profile.income_sources|${p}`) as string[];
        if (sources.includes('salary')) {
          const gross = 30_000 + Math.floor(r() * 150_000);
          await document('salary_certificate', p, [
            ['salary.gross', `${gross}.00`],
            ['salary.base', `${gross}.00`],
            ['salary.social_contributions', `${Math.round(gross * 0.064)}.00`],
          ]);
        }
        if (sources.includes('self_employment')) {
          await document(
            'business_accounts',
            p,
            [
              ['business.turnover', `${Math.floor(r() * 300_000)}.00`],
              ['business.costs_other', `${Math.floor(r() * 150_000)}.00`],
              ['business.current_assets', `${Math.floor(r() * 400_000)}.00`],
              ['business.liabilities', `${Math.floor(r() * 100_000)}.00`],
            ],
            r() < 0.7,
          );
          await document('avs_contributions', p, [
            ['avs.contributions_year', `${500 + Math.floor(r() * 20_000)}.00`],
          ]);
        }
        await document('pillar3a_attestation', p, [
          ['pillar3a.paid', `${Math.floor(r() * 30_000)}.00`],
        ]);
      }
      const out = (await call('compute_tax')).structuredContent as TaxOut & {
        icc: TaxOut['icc'] | null;
        ifd: TaxOut['ifd'] | null;
      };
      expect(out.computed, `seed ${seed}`).toBe(true);
      if (outside) {
        expect(out.icc, `seed ${seed}`).toBeNull();
        expect(out.ifd, `seed ${seed}`).toBeNull();
        expect(out.unsupported.join(' ')).toMatch(/no tax is computed/);
      } else if (out.icc) {
        expect(out.icc.total, `seed ${seed}`).toBeGreaterThanOrEqual(0);
        expect(out.ifd.tax, `seed ${seed}`).toBeGreaterThanOrEqual(0);
      } else {
        expect(out.unsupported.join(' '), `seed ${seed}`).toMatch(/tax shield/);
      }
      for (const tool of ['get_status', 'final_check', 'list_optimizations', 'get_form_values']) {
        const res = await call(tool);
        expect(res.isError, `seed ${seed} ${tool}: ${texts(res)}`).toBeFalsy();
      }
      const s = await state('fr');
      expect(s.copyPanel.unplaced, `seed ${seed}`).toEqual([]);
    }
  });

  it('offers the business documents in Geneva only', async () => {
    await answer([['canton', 'GE']]);
    expect((await state()).kinds.map((k) => k.value)).toEqual(
      expect.arrayContaining(['business_accounts', 'avs_contributions']),
    );
    await answer([['canton', 'ZH']]);
    const zh = await state();
    expect(zh.kinds.map((k) => k.value)).not.toContain('business_accounts');
    // Zurich still says plainly that self-employment is not supported.
    await answer([
      ['civil_status', 'single'],
      ['children', 0],
      ['commune', 'Zürich'],
    ]);
    const self = await call('answer_question', {
      id: 'income_sources:p1',
      value: ['self_employment'],
    });
    expect(texts(self)).toMatch(/Not supported yet/);
  });
});

// The 2025 return (docs/design/tax-years.md): its own folder, the 2025 rules and the 2025 form map.
describe('self-employment in Geneva, tax year 2025', () => {
  let years: TaxYears;
  beforeEach(async () => {
    await client.close();
    await dashboard.stop();
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
    const opened = await call('open_tax_year', { year: 2025 });
    expect(opened.isError, texts(opened)).toBeFalsy();
    ws = years.current;
    await ws.ready();
    docYear = 2025;
  });

  it('S1 in 2025: the tax derived by hand, annexe B on the 2025 form, no 2026 document', async () => {
    expect(ws.taxYear).toBe(2025);
    await lea();
    expect(ws.snapshot().slots.filter((s) => s.value === undefined)).toEqual([]);
    const next = texts(await call('next_questions'));
    expect(next).not.toMatch(/2026/);
    const res = await call('compute_tax', { detail: true });
    const out = res.structuredContent as TaxOut & { taxYear: number };
    expect(out).toMatchObject({ taxYear: 2025, computed: true, unsupported: [] });
    // The same figures as 2026: Carouge's rates and the tariffs at these incomes are the same
    // (packages/rules-ge/test/self-employment.test.ts, S1).
    expect(out.icc.total).toBe(874_685);
    expect(out.icc.taxableWealth).toBe(3_236_800);
    expect(out.ifd).toMatchObject({ tax: 87_930, taxableIncome: 6_700_000 });
    const all = JSON.stringify(res.structuredContent);
    expect(all).not.toMatch(/ge-2026-unpublished|ch-2026-/);
    expect(all).toMatch(/ge-2025-guide-independants/);
    // The 2025 form, not provisional: annexe B with the year's dates.
    const s = await state();
    const rows = rowsOf(s);
    expect(rows.filter((r) => r.page === 'B1').map((r) => [r.ref, r.copy])).toEqual(
      expect.arrayContaining([
        ['B1-DU', '01.01.2025'],
        ['B1-AU', '31.12.2025'],
      ]),
    );
    expect(rows.filter((r) => r.page === 'B4').map((r) => [r.ref, r.copy])).toEqual([
      ['32.10', '9000'],
      ['32.40', '18000'],
      ['32.00', '26200'],
    ]);
    expect(s.copyPanel.unplaced).toEqual([]);
    // The plans before 31 December are 2026's.
    expect(s.plan).toBeNull();
  });
});
