// A Basel-Stadt return end to end through the extension (docs/design/cantons.md, the generic
// canton): the questions, the estimate (the canton's and the commune's tax on income and wealth,
// and the federal tax of the Bund column) for Claude (compute_tax) and the dashboard, the final
// check, the plans and the values to type. Synthetic households on a temporary vault, never the
// real one: the Exempel family in Riehen and Lea Muster, single, in Basel.
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
    Buffer.from(`%PDF-1.7 synthetic Basel-Stadt document ${n}`),
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
 * The Exempel family of Riehen: two salaries (one part-time), two children under 18, one at a
 * crèche, one of the couple a church member, 3a for one, a bank account, medical costs, donations
 * and a party.
 */
async function exempel() {
  await answer([
    ['canton', 'BS'],
    ['civil_status', 'married'],
    ['children', 2],
    ['children_custody', 'with_household'],
    ['child_minor:child1', true],
    ['child_minor:child2', true],
    ['childcare', 'creche_or_daycare'],
    ['child_care:child1', 14_000],
    ['child_care:child2', 0],
    ['commune', 'Riehen'],
    ['moved', 'no'],
    ['church:p1', false],
    ['church:p2', true],
    ['income_sources:p1', ['salary']],
    ['income_sources:p2', ['salary']],
    ['employers:p1', 1],
    ['employers:p2', 1],
    ['work_rate:p1', 100],
    ['work_rate:p2', 50],
    ['taxed_at_source:p1', false],
    ['taxed_at_source:p2', false],
    ['pillar3a:p1', true],
    ['pillar3a:p2', false],
    ['lpp_buyin:p1', false],
    ['lpp_buyin:p2', false],
    ['commute:p1', 'public_transport'],
    ['commute_transit_cost:p1', 824],
    ['meal_days:p1', 200],
    ['commute:p2', 'bike'],
    ['meal_days:p2', 0],
    ['banks', 1],
    ['crypto', false],
    ['payments', ['medical_costs', 'donations', 'political_party']],
    ['party', 500],
    ['special', []],
  ]);
  await confirmed('salary_certificate', 'p1', [
    ['salary.base', "112'000.00"],
    ['salary.gross', "112'000.00"],
    ['salary.social_contributions', "7'170.00"],
    ['salary.lpp_ordinary', "7'800.00"],
    ['salary.net', "97'030.00"],
  ]);
  await confirmed('salary_certificate', 'p2', [
    ['salary.base', "42'000.00"],
    ['salary.gross', "42'000.00"],
    ['salary.social_contributions', "2'690.00"],
    ['salary.lpp_ordinary', "1'500.00"],
    ['salary.net', "37'810.00"],
  ]);
  await confirmed('pillar3a_attestation', 'p1', [['pillar3a.paid', "7'258.00"]]);
  await confirmed('health_premiums', 'household', [['health.premiums', "13'200.00"]]);
  await confirmed('childcare_invoice', 'household', [['childcare.costs', "14'000.00"]]);
  await confirmed('donation_receipt', 'household', [['donation.amount', "1'200.00"]]);
  await confirmed('medical_invoice', 'household', [['medical.costs', "9'500.00"]]);
  await confirmed('bank_attestation', 'household', [
    ['bank.balance', "48'000.00"],
    ['bank.interest_gross', '96.00'],
  ]);
}

/** Lea Muster, single, in Basel: one salary, no church, 3a. */
const MUSTER: [string, unknown][] = [
  ['civil_status', 'single'],
  ['reference_age:p1', false],
  ['children', 0],
  ['commune', 'Basel'],
  ['moved', 'no'],
  ['church:p1', false],
  ['income_sources:p1', ['salary']],
  ['employers:p1', 1],
  ['work_rate:p1', 100],
  ['taxed_at_source:p1', false],
  ['pillar3a:p1', true],
  ['lpp_buyin:p1', false],
  ['commute:p1', 'public_transport'],
  ['commute_transit_cost:p1', 880],
  ['meal_days:p1', 180],
  ['banks', 0],
  ['crypto', false],
  ['payments', []],
  ['special', []],
];

async function muster(canton: 'BS' | 'GE' | 'ZH' = 'BS') {
  const commune = canton === 'BS' ? 'Basel' : canton === 'ZH' ? 'Zürich' : 'Vernier';
  // Geneva and Zurich ask neither the reference age nor the work rate; Geneva no church, and
  // Zurich asks the church by name.
  const asked = ([id]: [string, unknown]) =>
    canton === 'BS' ||
    (!id.startsWith('reference_age') && !id.startsWith('work_rate') && !id.startsWith('church'));
  await answer([
    ['canton', canton],
    ...MUSTER.filter(asked).map(([id, v]): [string, unknown] => [
      id,
      id === 'commune' ? commune : v,
    ]),
    ...(canton === 'ZH' ? [['church:p1', 'none'] as [string, unknown]] : []),
  ]);
  await confirmed('salary_certificate', 'p1', [
    ['salary.base', "85'000.00"],
    ['salary.gross', "85'000.00"],
    ['salary.social_contributions', "5'440.00"],
    ['salary.lpp_ordinary', "4'250.00"],
    ['salary.net', "75'310.00"],
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
    cantonalIncome: number;
    communalIncome: number;
    cantonalWealth: number;
    communalWealth: number;
    taxableIncome: number;
    taxableWealth: number;
    incomeTariff: string;
    wealthTariff: string;
  };
  ifd: { tax: number; taxableIncome: number; scale: string };
  notCounted: string[];
  unverifiedRules: string[];
  notSupported: string[];
  unsupported: string[];
}

describe('a Basel-Stadt return', () => {
  it('asks Basel-Stadt’s questions, then computes the canton’s, the commune’s and the federal tax', async () => {
    await exempel();
    const status = await call('get_status');
    expect(status.structuredContent).toMatchObject({ canton: 'BS' });
    expect(texts(status)).toMatch(/tax year 2026, Basel-Stadt/);
    expect(ws.snapshot().slots.filter((s) => s.value === undefined)).toEqual([]);

    const res = await call('compute_tax');
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, canton: 'BS' });
    expect(out.commune).toMatchObject({ bfs: null, name: 'Riehen' });
    expect(out.unsupported).toEqual([]);
    expect(out.notSupported).toEqual([]);
    // Married with children: tariff B for income and wealth; Riehen levies its own tax.
    expect(out.icc.incomeTariff).toBe('B');
    expect(out.icc.communalIncome).toBeGreaterThan(0);
    expect(out.icc.total).toBe(
      out.icc.cantonalIncome +
        out.icc.communalIncome +
        out.icc.cantonalWealth +
        out.icc.communalWealth,
    );
    expect(out.ifd.scale).toBe('married');
    expect(out.total).toBe(out.icc.total + out.ifd.tax);
    expect(out.unverifiedRules.length).toBeGreaterThan(0);
    // One of the couple is a church member: the church tax is not in the calculation, said so.
    expect(out.notCounted.join(' ')).toMatch(/church tax \(Kirchensteuer\)/);
    const text = texts(res);
    expect(text).toMatch(/canton of Basel-Stadt, commune Riehen \(Gemeindesteuer 40 %/);
    expect(text).toMatch(/Kantons- und Gemeindesteuern/);
    expect(text).toMatch(/direkte Bundessteuer/);
    expect(text).toMatch(/Basel-Stadt is a preview/);

    // With detail, every item with its source, in both columns.
    const detail = await call('compute_tax', { detail: true });
    const d = (detail.structuredContent as { detail: Record<string, { code: string }[]> }).detail;
    expect(d.iccItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        '100',
        '105',
        '369',
        '519',
        '539',
        '620',
        '630',
        '660',
        '670',
        '680',
      ]),
    );
    expect(d.iccItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining(['725', '732', '750', '760']),
    );
    expect(d.wealthItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining(['800', '890', '892']),
    );
    expect(d.ifdItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining(['100', '630', '632', '670', '680', '750', '760']),
    );
    expect(texts(detail)).toMatch(/- Bund 760 Abzug für Ehegatten/);
  });

  it('shows the estimate in the dashboard, in the official German terms', async () => {
    await exempel();
    const s = await state('fr');
    expect(s.canton).toMatchObject({ code: 'BS', name: 'Bâle-Ville' });
    const est = s.estimate as
      (DashboardState['estimate'] & { canton?: string; unverified?: string[] }) | undefined;
    expect(est?.computed).toBe(true);
    if (!est?.computed) return;
    expect(est.canton).toBe('BS');
    expect(est.rows.map((r) => r.label)).toEqual([
      'Impôts cantonal et communal (Kantons- und Gemeindesteuern)',
      'Impôt fédéral direct (direkte Bundessteuer)',
    ]);
    expect(est.parts.map((r) => r.id)).toEqual([
      'cantonalIncome',
      'communalIncome',
      'cantonalWealth',
      'communalWealth',
    ]);
    expect(est.unverified?.length).toBeGreaterThan(0);
    expect(est.lastYear).toEqual([]);
    const de = await state('de');
    const estDe = de.estimate;
    if (!estDe?.computed) throw new Error('not computed');
    expect(estDe.rows.map((r) => r.label)).toEqual([
      'Kantons- und Gemeindesteuern',
      'Direkte Bundessteuer',
    ]);
    expect(estDe.items.find((i) => i.code === '620')?.label).toBe(
      'Gebundene Selbstvorsorge (Säule 3a), Person 1',
    );
  });

  it('asks Basel-Stadt’s own questions only where they apply', async () => {
    await answer([
      ['canton', 'BS'],
      ['civil_status', 'divorced'],
    ]);
    // Filing alone: whether you reached the AHV reference age (line 770).
    expect(ws.next()?.id).toBe('reference_age:p1');
    await answer([
      ['reference_age:p1', false],
      ['children', 2],
      ['children_custody', 'shared'],
      ['child_support', 'none_i_earn_more'],
    ]);
    // A single parent: living as a couple, and with shared custody, the main upkeep.
    expect(ws.next()?.id).toBe('cohabiting');
    await answer([['cohabiting', false]]);
    expect(ws.next()?.id).toBe('main_upkeep');
    await answer([['main_upkeep', true]]);
    const ids = ws.snapshot().slots.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['child_minor:child1', 'child_minor:child2']));
    const q = await call('next_questions');
    expect(texts(q)).not.toMatch(/\{n\}/);
    // The commune: Basel, Riehen or Bettingen only.
    const commune = await call('answer_question', { id: 'commune', value: 'Liestal' });
    expect(commune.isError).toBe(true);
    expect(texts(commune)).toMatch(/not a Basel-Stadt commune/);
    // Living as a couple with children is not supported yet: said plainly.
    await answer([['cohabiting', true]]);
    const status = await call('get_status');
    expect((status.structuredContent as { notSupported: string[] }).notSupported).toEqual([
      'A single parent living as a couple with children (Konkubinat mit Kindern)',
    ]);
  });

  it('runs the final check with Basel-Stadt’s lines, software and terms', async () => {
    await exempel();
    await ws.setPlan('p2', 'plan.gross_salary', 42_000, 'chat');
    const res = await call('final_check');
    const out = res.structuredContent as FinalCheckState;
    // The 3a of person 1 is at the cap in both taxes: said once, for both.
    const pillar = out.know.find((i) => i.kind === 'limit' && i.code === '620');
    expect(pillar?.title).toMatch(/Gebundene Selbstvorsorge \(Säule 3a\)/);
    expect(pillar?.title).toMatch(/cantonal and federal tax/);
    const pdf = out.know.find((i) => i.kind === 'official_pdf');
    expect(pdf?.detail).toMatch(/Taxpresso checks Geneva declarations only/);
    expect(out.know.some((i) => i.kind === 'form_provisional')).toBe(true);
    expect(texts(res)).not.toMatch(/GeTax|ZHprivateTax|TaxMe/);
    for (const i of [...out.fix, ...out.know]) {
      for (const src of i.sources) {
        if (src.id.startsWith('bs-')) expect(src.url, src.id).toMatch(/^https:\/\//);
      }
    }
  });

  it('plans 3a, a buy-in and the 3a catch-up on Basel-Stadt’s tax, and keeps TOU Geneva’s', async () => {
    await muster();
    await ws.setPlan('p1', 'plan.gross_salary', 85_000, 'chat');
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
    expect(out.pillar3a.assumptions).toContain('bs_preview');
    expect(out.pillar3a.assumptions).not.toContain('bs_commune_default');
    expect(out.pillar3a.sources.join(' ')).toMatch(/bs-2026-/);
    expect(out.lppBuyIn.saving?.cantonalCentimes).toBeGreaterThan(0);
    // Basel-Stadt gives its rule for a 3a catch-up from 2026: a saving, unlike Zurich.
    expect(out.pillar3aCatchUp.assumptions).not.toContain('bs_catchup_rule');
    expect(out.tou.applies).toBe(false);
    const text = texts(res);
    expect(text).toMatch(/Einkauf in die berufliche Vorsorge \(Pensionskasse\)/);
    expect(text).toMatch(/For Basel-Stadt, taxation at source \(Quellensteuer\)/);
    expect(text).toMatch(/Basel-Stadt is a preview/);
    const decided = await call('decide_optimization', {
      id: 'tou',
      choice: 'decline',
      confirmed: false,
    });
    expect(decided.isError).toBe(true);
    expect(texts(decided)).toMatch(/TOU is Geneva’s procedure\. For Basel-Stadt/);
  });

  it('shows no saving until the work rate and the commune are known (fail closed)', async () => {
    await answer([
      ['canton', 'BS'],
      ['civil_status', 'single'],
      ['reference_age:p1', false],
      ['children', 0],
      ['income_sources:p1', ['salary']],
      ['employers:p1', 1],
    ]);
    await ws.setPlan('p1', 'plan.gross_salary', 90_000, 'chat');
    type Plans = { pillar3a: { saving?: { totalCentimes: number }; assumptions: string[] } };
    // The canton's flat professional costs depend on the work rate, which Taxpresso reads with
    // the commune: without them, no saving is shown rather than a guess.
    const plans = async () => (await call('list_optimizations')).structuredContent as Plans;
    expect((await plans()).pillar3a.saving).toBeUndefined();
    await answer([['work_rate:p1', 100]]);
    expect((await plans()).pillar3a.saving).toBeUndefined();
    await answer([['commune', 'Bettingen']]);
    const after = await plans();
    expect(after.pillar3a.saving?.totalCentimes).toBeGreaterThan(0);
    expect(after.pillar3a.assumptions).toContain('bs_preview');
    expect(after.pillar3a.assumptions).not.toContain('bs_commune_default');
  });

  it('gives the values to type form by form, in the chat and the dashboard', async () => {
    await exempel();
    const list = await call('get_form_values');
    const out = list.structuredContent as { sections: { page: string }[]; provisional: boolean };
    expect(out.sections.map((s) => s.page)).toEqual(
      expect.arrayContaining(['W', 'B1', 'B2', 'K', 'Z', 'F', 'H2', 'H3', 'H4']),
    );
    expect(out.provisional).toBe(true);
    expect(texts(list)).toMatch(/BalTax Online/);
    const h3 = await call('get_form_values', { section: 'H3' });
    expect(texts(h3)).toMatch(/Abzug für Versicherungen Ehegatten/);
    const panel = (await state('fr')).copyPanel;
    expect(panel.unplaced).toEqual([]);
    expect(panel.total).toBeGreaterThan(0);
    // The PDF check is Geneva's only: said plainly, in both places.
    const pdf = await call('reconcile_official_pdf');
    expect(texts(pdf)).toMatch(/reads Geneva declarations only/);
    expect(texts(pdf)).toMatch(/BalTax Online/);
    expect((await state()).declarationCheck.status).toBe('not_available');
  });

  it('gives the same federal tax as Geneva and Zurich for the same household', async () => {
    await muster('BS');
    const bs = (await call('compute_tax')).structuredContent as TaxOut;
    expect(bs.icc.incomeTariff).toBe('A');
    expect(bs.icc.communalIncome).toBe(0);
    const federal: TaxOut['ifd'][] = [];
    for (const canton of ['GE', 'ZH'] as const) {
      await client.close();
      await dashboard.stop();
      await connect();
      await muster(canton);
      federal.push(((await call('compute_tax')).structuredContent as TaxOut).ifd);
    }
    for (const other of federal) {
      expect(other.taxableIncome).toBe(bs.ifd.taxableIncome);
      expect(other.tax).toBe(bs.ifd.tax);
    }
  });
});
