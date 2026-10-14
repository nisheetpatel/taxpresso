// A Fribourg return end to end through the extension (docs/design/cantons.md, "As built: Fribourg"):
// the questions, the documents, the values to type and the plans of tax year 2026, whose communal
// coefficients are not published (the estimate, the final check and the plans say so, in the user's
// language, and never guess them); then the same households on the 2025 rules through the engine,
// where the coefficients are published, through the same tools and the dashboard (the app prepares
// 2026 only, so the test reads the ledger as 2025's). Synthetic households on a temporary vault,
// never the real one: the Berset family in Bulle and Léa Rossier, single, in Fribourg.
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import type { DocumentKind } from '@taxpresso/ledger';
import { NOTE } from '@taxpresso/rules-fr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  vi.restoreAllMocks();
  await client.close();
  await dashboard.stop();
});

let n = 0;
/**
 * A document of the user's with the values they confirmed (synthetic bytes). Without a tax year,
 * so the same documents serve the 2025 reading below.
 */
async function confirmed(
  kind: DocumentKind,
  person: 'p1' | 'p2' | 'household',
  values: [string, string][],
) {
  n += 1;
  const { document } = await ws.addDocument(
    Buffer.from(`%PDF-1.7 synthetic Fribourg document ${n}`),
    `${kind}-${n}.pdf`,
    'dashboard',
  );
  await ws.proposeExtraction(
    document.id,
    { kind, person },
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
 * The Berset family of Bulle: two salaries, two children (15 and 3) living with them, a crèche for
 * the younger, both Roman Catholic, a life insurance, savings, donations.
 */
async function berset() {
  await answer([
    ['canton', 'FR'],
    ['civil_status', 'married'],
    ['children', 2],
    ['children_custody', 'with_household'],
    ['child_age:child1', 'minor'],
    ['child_age:child2', 'under14'],
    ['childcare', 'creche_or_daycare'],
    ['child_care:child1', 0],
    ['child_care:child2', 9_000],
    ['commune', 'Bulle'],
    ['moved', 'no'],
    ['church:p1', 'catholic'],
    ['church:p2', 'catholic'],
    ['income_sources:p1', ['salary']],
    ['employers:p1', 1],
    ['taxed_at_source:p1', false],
    ['income_sources:p2', ['salary']],
    ['employers:p2', 1],
    ['taxed_at_source:p2', false],
    ['commute:p1', 'public_transport'],
    ['commute_transit_cost:p1', 900],
    ['meal_days:p1', 200],
    ['commute:p2', 'bike'],
    ['meal_days:p2', 0],
    ['banks', 0],
    ['crypto', false],
    ['health_subsidy', 0],
    ['life_insurance', 1_200],
    ['pillar3a:p1', true],
    ['pillar3a:p2', false],
    ['lpp_buyin:p1', false],
    ['lpp_buyin:p2', false],
    ['payments', ['donations']],
    ['special', []],
  ]);
  await confirmed('salary_certificate', 'p1', [
    ['salary.base', "112'000.00"],
    ['salary.gross', "112'000.00"],
    ['salary.social_contributions', "7'170.00"],
    ['salary.lpp_ordinary', "6'800.00"],
    ['salary.net', "98'030.00"],
  ]);
  await confirmed('salary_certificate', 'p2', [
    ['salary.base', "52'000.00"],
    ['salary.gross', "52'000.00"],
    ['salary.social_contributions', "3'330.00"],
    ['salary.lpp_ordinary', "2'100.00"],
    ['salary.net', "46'570.00"],
  ]);
  await confirmed('pillar3a_attestation', 'p1', [['pillar3a.paid', "7'258.00"]]);
  await confirmed('childcare_invoice', 'household', [['childcare.costs', "9'000.00"]]);
  await confirmed('donation_receipt', 'household', [['donation.amount', "1'500.00"]]);
}

/** Léa Rossier, single, in Fribourg: one salary, 3a, no church. */
async function rossier() {
  await answer([
    ['canton', 'FR'],
    ['civil_status', 'single'],
    ['children', 0],
    ['commune', 'Fribourg'],
    ['moved', 'no'],
    ['church:p1', 'none'],
    ['income_sources:p1', ['salary']],
    ['employers:p1', 1],
    ['taxed_at_source:p1', false],
    ['commute:p1', 'public_transport'],
    ['commute_transit_cost:p1', 900],
    ['meal_days:p1', 180],
    ['banks', 0],
    ['crypto', false],
    ['health_subsidy', 0],
    ['life_insurance', 0],
    ['pillar3a:p1', true],
    ['lpp_buyin:p1', false],
    ['payments', []],
    ['special', []],
  ]);
  await confirmed('salary_certificate', 'p1', [
    ['salary.base', "85'000.00"],
    ['salary.gross', "85'000.00"],
    ['salary.social_contributions', "5'440.00"],
    ['salary.lpp_ordinary', "4'250.00"],
    ['salary.net', "75'310.00"],
  ]);
  await confirmed('pillar3a_attestation', 'p1', [['pillar3a.paid', "3'000.00"]]);
}

/**
 * The 2025 rules through the engine: the ledger read as tax year 2025's, whose communal
 * coefficients are published. The app prepares 2026 only (config.ts, CURRENT_TAX_YEAR).
 */
function as2025() {
  const read = ws.ledgerContext.bind(ws);
  vi.spyOn(ws, 'ledgerContext').mockImplementation(() => ({ ...read(), taxYear: 2025 }));
}

interface TaxOut {
  computed: boolean;
  canton?: string;
  commune: { bfs: number | null; name: string; rate: number | null };
  total: number | null;
  icc: {
    total: number;
    cantonalIncome: number;
    communalIncome: number;
    cantonalWealth: number;
    communalWealth: number;
    church: number | null;
    taxableIncome: number;
    taxableWealth: number;
  } | null;
  ifd: { tax: number; taxableIncome: number; scale: string } | null;
  unverifiedRules: string[];
  unsupported: string[];
  notSupported: string[];
}

describe('a Fribourg return, tax year 2026: no communal coefficients yet', () => {
  it('asks Fribourg’s questions, then says plainly why the estimate waits, and never guesses', async () => {
    await berset();
    const status = await call('get_status');
    expect(status.structuredContent).toMatchObject({ canton: 'FR' });
    expect(texts(status)).toMatch(/tax year 2026, Fribourg/);
    expect(ws.snapshot().slots.filter((s) => s.value === undefined)).toEqual([]);

    const res = await call('compute_tax');
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, canton: 'FR', total: null, icc: null, ifd: null });
    expect(out.commune).toEqual({ bfs: 2125, name: 'Bulle', rate: null });
    expect(out.unsupported).toEqual([NOTE.communes2026.en]);
    expect(out.notSupported).toEqual([]);
    const text = texts(res);
    expect(text).toMatch(/its communal coefficient for 2026 is not published yet/);
    expect(text).toMatch(
      /Not computed: Tax year 2026: Fribourg’s communal tax rates for 2026 \(coefficients communaux\) aren’t published yet/,
    );
    expect(text).toMatch(/your estimate comes once they are/);
    expect(text).toMatch(/node scripts\/fr-communes\.mjs/);
    expect(text).not.toMatch(/Total:/);
  });

  it('says it in the dashboard in the user’s language', async () => {
    await berset();
    for (const [lang, words] of [
      ['en', /aren’t published yet/],
      ['fr', /ne sont pas encore publiés/],
      ['de', /noch nicht veröffentlicht/],
    ] as const) {
      const s = await state(lang);
      expect(s.canton).toMatchObject({ code: 'FR' });
      const est = s.estimate as (DashboardState['estimate'] & { canton?: string }) | undefined;
      if (!est?.computed) throw new Error(`${lang}: no estimate`);
      expect(est.canton).toBe('FR');
      expect(est.total).toBeNull();
      expect(est.rows).toEqual([]);
      expect(est.notes[0], lang).toMatch(words);
    }
    expect((await state('de')).canton).toMatchObject({ name: 'Freiburg' });
  });

  it('gives the values to type all the same, code by code, flagged provisional', async () => {
    await berset();
    const list = await call('get_form_values');
    const out = list.structuredContent as { sections: { page: string }[]; provisional: boolean };
    // No pension, account or wealth: nothing on the pages of annexes 01, 02 and the codes 3.xxx.
    expect(out.sections.map((s) => s.page)).toEqual(['V', 'VI', 'VIII', 'IX']);
    expect(out.provisional).toBe(true);
    expect(texts(list)).toMatch(/FriTax is not a web page/);
    expect(texts(list)).toMatch(/2026 guide and FriTax 2026 are not published yet/);
    const salaries = await call('get_form_values', { section: 'V' });
    expect(texts(salaries)).toMatch(
      /1\.110 Activité salariée principale \(.*\) \[Personne 1, Revenu\]: 98030/,
    );
    expect(texts(salaries)).toMatch(/\[Personne 2, Revenu\]: 46570/);
    const deductions = await call('get_form_values', { section: 'VIII' });
    // The crèche of the younger child, its 9,000 within the limit; life insurance at its cap.
    expect(texts(deductions)).toMatch(/4\.380 Frais de garde des enfants .*: 9000/);
    expect(texts(deductions)).toMatch(
      /4\.120 Autres primes et cotisations \(3e pilier b\) .*: 1200/,
    );
    const panel = (await state('fr')).copyPanel;
    expect(panel.unplaced).toEqual([]);
    expect(panel.total).toBeGreaterThanOrEqual(10);
    // The PDF check is Geneva's only: said plainly.
    const pdf = await call('reconcile_official_pdf');
    expect(texts(pdf)).toMatch(/reads Geneva declarations only/);
    expect(texts(pdf)).toMatch(/FriTax/);
  });

  it('fails the final check closed, with the same explanation', async () => {
    await berset();
    const res = await call('final_check');
    const out = res.structuredContent as FinalCheckState;
    expect(out.verdict).toBe('not_ready');
    const waits = out.fix.find((i) => i.kind === 'not_computed');
    expect(waits?.detail).toBe(NOTE.communes2026.en);
    expect(texts(res)).toMatch(/A tax not computed: Tax year 2026: Fribourg’s communal tax rates/);
    expect(texts(res)).not.toMatch(/GeTax|ZHprivateTax|TaxMe|E-Tax|eTax\.zug|eSteuern/);
    // The limits the lines applied are still there to know (the 3a at its cap, both taxes).
    expect(out.know.some((i) => i.kind === 'limit' && i.code === '4.130')).toBe(true);
  });

  it('fails the plans closed: the room, no saving, and why', async () => {
    await rossier();
    await ws.setPlan('p1', 'plan.gross_salary', 85_000, 'chat');
    await ws.setPlan('p1', 'plan.pillar3a_paid', 3_000, 'chat');
    await ws.setPlan('p1', 'plan.lpp_buyin_amount', 10_000, 'chat');
    await ws.setPlan('p1', 'plan.lpp_buyin_capacity', 40_000, 'chat');
    await ws.setPlan('p1', 'plan.pillar3a_paid_2025', 2_000, 'chat');
    const res = await call('list_optimizations');
    const out = res.structuredContent as {
      pillar3a: { saving?: unknown; assumptions: string[]; roomCentimes: number };
      lppBuyIn: { saving?: unknown; problem?: string; assumptions: string[] };
      pillar3aCatchUp: { saving?: unknown; assumptions: string[] };
      tou: { applies: boolean };
    };
    expect(out.pillar3a.roomCentimes).toBe(725_800 - 300_000);
    expect(out.pillar3a.saving).toBeUndefined();
    expect(out.pillar3a.assumptions).toContain('fr_no_tax');
    expect(out.lppBuyIn).toMatchObject({ problem: 'no_tax', assumptions: ['fr_no_tax'] });
    expect(out.lppBuyIn.saving).toBeUndefined();
    expect(out.pillar3aCatchUp.saving).toBeUndefined();
    expect(out.pillar3aCatchUp.assumptions).toContain('fr_no_tax');
    const text = texts(res);
    expect(text).toMatch(/room left CHF 4,258/);
    expect(text).toMatch(/No saving shown: Tax year 2026: Fribourg’s communal tax rates/);
    expect(text).not.toMatch(/No salary yet/);
    expect(text).toMatch(/For Fribourg, taxation at source \(impôt à la source\)/);
    const decided = await call('decide_optimization', {
      id: 'tou',
      choice: 'decline',
      confirmed: false,
    });
    expect(texts(decided)).toMatch(/TOU is Geneva’s procedure\. For Fribourg/);
    const plan = (await state('fr')).plan;
    expect(plan.result.saving).toBeUndefined();
    expect(plan.result.assumptions).toContain('fr_no_tax');
  });

  it('asks Fribourg’s own questions only where they apply', async () => {
    await answer([
      ['canton', 'FR'],
      ['civil_status', 'married'],
      ['children', 1],
      ['children_custody', 'with_household'],
    ]);
    expect(ws.next()?.id).toBe('child_age:child1');
    await answer([
      ['child_age:child1', 'young'],
      ['childcare', 'none'],
      ['commune', 'Düdingen'],
      ['moved', 'no'],
      ['church:p1', 'reformed'],
      ['church:p2', 'reformed'],
    ]);
    // Düdingen has two Reformed parishes with different coefficients: which one.
    expect(ws.next()?.id).toBe('parish');
    const q = await call('next_questions');
    expect(texts(q)).toMatch(/Düdingen: St\. Antoni/);
    await answer([['parish', '2293:reformed:St. Antoni']]);
    expect(ws.ledger.get('profile.commune')?.value).toBe('2293');
    expect(ws.ledger.get('fr.child_age', 'child1')?.value).toBe('young');
    // Savings interest only with accounts.
    expect(ws.snapshot().slots.map((s) => s.id)).not.toContain('savings_interest');
    await answer([
      ['income_sources:p1', ['salary']],
      ['employers:p1', 1],
      ['taxed_at_source:p1', false],
      ['income_sources:p2', []],
      ['commute:p1', 'walk'],
      ['meal_days:p1', 0],
      ['banks', 2],
    ]);
    expect(ws.snapshot().slots.map((s) => s.id)).toContain('savings_interest');
    // A move between Fribourg communes: not supported (the communal tax is shared).
    await answer([['moved', 'within_fr']]);
    const status = await call('get_status');
    expect((status.structuredContent as { notSupported: string[] }).notSupported).toEqual([
      'A move between Fribourg communes during the year (the communal tax is shared between them)',
    ]);
  });
});

describe('a Fribourg return on the 2025 rules, through the engine', () => {
  it('computes the cantonal, communal and church tax and the federal tax the tax office derives', async () => {
    await berset();
    as2025();
    const res = await call('compute_tax');
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, canton: 'FR' });
    expect(out.commune).toEqual({ bfs: 2125, name: 'Bulle', rate: 7_430 });
    expect(out.unsupported).toEqual([]);
    const icc = out.icc!;
    expect(icc.church).toBeGreaterThan(0);
    expect(icc.total).toBe(
      icc.cantonalIncome +
        icc.communalIncome +
        icc.cantonalWealth +
        icc.communalWealth +
        (icc.church ?? 0),
    );
    expect(out.ifd!.scale).toBe('married');
    expect(out.total).toBe(icc.total + out.ifd!.tax);
    const text = texts(res);
    expect(text).toMatch(
      /canton of Fribourg, commune Bulle \(BFS 2125; communal coefficient 74\.3/,
    );
    expect(text).toMatch(/impôts cantonal et communal/);
    expect(text).toMatch(/church tax \(impôt ecclésiastique\)/);
    expect(text).toMatch(/as the tax office derives it from the return/);
    expect(text).toMatch(/Fribourg is a preview/);
    const detail = await call('compute_tax', { detail: true });
    const d = (detail.structuredContent as { detail: Record<string, { code: string }[]> }).detail;
    expect(d.iccItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        '1.110',
        '2.110',
        '2.130',
        '2.510',
        '4.110',
        '4.120',
        '4.130',
        '4.380',
        '5.120',
        '6.110',
      ]),
    );
    expect(d.ifdItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining(['1.110', '2.110', '2.510', '4.110', '4.380', '6.110', '6.150']),
    );
    expect(texts(detail)).toMatch(
      /- IFD 6\.150 Déduction pour les époux vivant en ménage commun \(IFD\)/,
    );
  });

  it('shows the estimate in the dashboard, with the French terms of the return', async () => {
    await berset();
    as2025();
    const s = await state('fr');
    const est = s.estimate;
    if (!est?.computed) throw new Error('not computed');
    expect(est.rows.map((r) => r.label)).toEqual([
      'Impôts cantonal et communal',
      'Impôt fédéral direct',
    ]);
    expect(est.parts.map((r) => r.id)).toEqual([
      'cantonalIncome',
      'communalIncome',
      'cantonalWealth',
      'communalWealth',
      'churchIncome',
      'churchWealth',
    ]);
    const de = (await state('de')).estimate;
    if (!de?.computed) throw new Error('not computed');
    expect(de.rows.map((r) => r.label)).toEqual([
      'Kantons- und Gemeindesteuern (impôts cantonal et communal)',
      'Direkte Bundessteuer (impôt fédéral direct)',
    ]);
  });

  it('runs the final check with Fribourg’s codes, software and terms', async () => {
    await berset();
    as2025();
    const res = await call('final_check');
    const out = res.structuredContent as FinalCheckState;
    expect(out.fix.some((i) => i.kind === 'not_computed')).toBe(false);
    const pillar = out.know.find((i) => i.kind === 'limit' && i.code === '4.130');
    expect(pillar?.title).toMatch(/3e pilier a/);
    expect(pillar?.title).toMatch(/impôts cantonal et communal et impôt fédéral direct/);
    expect(out.know.some((i) => i.kind === 'form_provisional')).toBe(true);
    expect(texts(res)).not.toMatch(/GeTax|ZHprivateTax|TaxMe|E-Tax|eTax\.zug|eSteuern/);
    for (const i of [...out.fix, ...out.know]) {
      for (const src of i.sources) {
        if (src.id.startsWith('fr-')) expect(src.url, src.id).toMatch(/^https:\/\//);
      }
    }
  });

  it('plans 3a and a buy-in on Fribourg’s tax', async () => {
    await rossier();
    as2025();
    await ws.setPlan('p1', 'plan.gross_salary', 85_000, 'chat');
    await ws.setPlan('p1', 'plan.pillar3a_paid', 3_000, 'chat');
    await ws.setPlan('p1', 'plan.lpp_buyin_amount', 10_000, 'chat');
    await ws.setPlan('p1', 'plan.lpp_buyin_capacity', 40_000, 'chat');
    const res = await call('list_optimizations');
    const out = res.structuredContent as {
      pillar3a: { saving?: { totalCentimes: number }; assumptions: string[]; sources: string[] };
      lppBuyIn: { saving?: { cantonalCentimes: number; federalCentimes: number } };
    };
    expect(out.pillar3a.saving?.totalCentimes).toBeGreaterThan(0);
    expect(out.pillar3a.assumptions).toContain('fr_preview');
    expect(out.pillar3a.assumptions).not.toContain('fr_no_tax');
    expect(out.pillar3a.sources.join(' ')).toMatch(/fr-2025-bareme-revenu/);
    expect(out.lppBuyIn.saving?.cantonalCentimes).toBeGreaterThan(0);
    expect(out.lppBuyIn.saving?.federalCentimes).toBeGreaterThan(0);
    expect(texts(res)).toMatch(/Fribourg is a preview/);
  });

  it('gives the 2025 values to type, the same lines as 2026', async () => {
    await berset();
    const lines2026 = (await state()).copyPanel.total;
    as2025();
    const panel = (await state()).copyPanel;
    expect(panel.unplaced).toEqual([]);
    expect(panel.total).toBe(lines2026);
  });
});
