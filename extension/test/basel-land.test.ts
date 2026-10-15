// A Basel-Landschaft return end to end through the extension (docs/design/cantons.md, "As built:
// Basel-Landschaft"): the questions, the estimate (state, communal and church tax, and the federal
// tax of the return's Bundessteuer column) for Claude (compute_tax) and the dashboard, the final
// check, the plans and the values to type. Synthetic households on a temporary vault, never the real
// one: the Muster family in Allschwil and Mia Meier, single, in Liestal.
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
    Buffer.from(`%PDF-1.7 synthetic Basel-Landschaft document ${n}`),
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
 * The Muster family of Allschwil: two salaries, two children, a crèche for both (the invoices'
 * total split per child), both Roman Catholic.
 */
async function muster(church: [string, string] = ['catholic', 'catholic']) {
  await answer([
    ['canton', 'BL'],
    ['civil_status', 'married'],
    ['children', 2],
    ['children_custody', 'with_household'],
    ['child_income:child1', false],
    ['child_income:child2', false],
    ['childcare', 'creche_or_daycare'],
    ['child_care:child1', 9_000],
    ['child_care:child2', 6_000],
    ['commune', 'Allschwil'],
    ['moved', 'no'],
    ['church:p1', church[0]],
    ['church:p2', church[1]],
    ['income_sources:p1', ['salary']],
    ['employers:p1', 1],
    ['residence:p1', 'swiss'],
    ['income_sources:p2', ['salary']],
    ['employers:p2', 1],
    ['pillar3a:p1', true],
    ['pillar3a:p2', false],
    ['lpp_buyin:p1', false],
    ['lpp_buyin:p2', false],
    ['commute:p1', 'public_transport'],
    ['commute_transit_cost:p1', 1_032],
    ['meal_days:p1', 200],
    ['commute:p2', 'bike'],
    ['meal_days:p2', 0],
    ['banks', 0],
    ['crypto', false],
    ['payments', ['donations']],
    ['special', []],
  ]);
  await confirmed('salary_certificate', 'p1', [
    ['salary.base', "98'000.00"],
    ['salary.gross', "98'000.00"],
    ['salary.social_contributions', "6'270.00"],
    ['salary.lpp_ordinary', "5'400.00"],
    ['salary.net', "86'330.00"],
  ]);
  await confirmed('salary_certificate', 'p2', [
    ['salary.base', "46'000.00"],
    ['salary.gross', "46'000.00"],
    ['salary.social_contributions', "2'940.00"],
    ['salary.lpp_ordinary', "1'800.00"],
    ['salary.net', "41'260.00"],
  ]);
  await confirmed('pillar3a_attestation', 'p1', [['pillar3a.paid', "7'258.00"]]);
  await confirmed('health_premiums', 'household', [['health.premiums', "12'600.00"]]);
  await confirmed('childcare_invoice', 'household', [['childcare.costs', "15'000.00"]]);
  await confirmed('donation_receipt', 'household', [['donation.amount', "1'200.00"]]);
}

/** Mia Meier, single, in Liestal: one salary, 3a, no church. */
const MEIER: [string, unknown][] = [
  ['civil_status', 'single'],
  ['children', 0],
  ['commune', 'Liestal'],
  ['moved', 'no'],
  ['church:p1', 'none'],
  ['income_sources:p1', ['salary']],
  ['employers:p1', 1],
  ['residence:p1', 'swiss'],
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

async function meier(canton: 'BL' | 'BE' | 'GE' | 'ZH' = 'BL') {
  const commune = { BL: 'Liestal', BE: 'Biel/Bienne', ZH: 'Zürich', GE: 'Vernier' }[canton];
  // Geneva asks no church; Bern asks your own household too.
  const asked = ([id]: [string, unknown]) => canton !== 'GE' || !id.startsWith('church');
  await answer([
    ['canton', canton],
    ...MEIER.filter(asked).flatMap(([id, v]): [string, unknown][] => [
      [id, id === 'commune' ? commune : v],
      ...(canton === 'BE' && id === 'civil_status'
        ? [['own_household', true] as [string, unknown]]
        : []),
    ]),
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
    church: number | null;
    childReduction: number;
    taxableIncome: number;
    splitting: boolean;
  };
  ifd: { tax: number; taxableIncome: number; scale: string };
  unverifiedRules: string[];
  unsupported: string[];
  notSupported: string[];
}

describe('a Basel-Landschaft return', () => {
  it('asks Basel-Landschaft’s questions, then computes every tax and the federal tax', async () => {
    await muster();
    const status = await call('get_status');
    expect(status.structuredContent).toMatchObject({ canton: 'BL' });
    expect(texts(status)).toMatch(/tax year 2026, Basel-Landschaft/);
    expect(ws.snapshot().slots.filter((s) => s.value === undefined)).toEqual([]);

    const res = await call('compute_tax');
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, canton: 'BL' });
    expect(out.commune).toMatchObject({ bfs: null, name: 'Allschwil' });
    // Married with two children: Vollsplitting, the child reduction, the Roman Catholic church tax.
    expect(out.icc.splitting).toBe(true);
    expect(out.icc.childReduction).toBeLessThan(0);
    expect(out.icc.church).toBeGreaterThan(0);
    expect(out.icc.total).toBe(
      out.icc.cantonalIncome +
        out.icc.communalIncome +
        out.icc.cantonalWealth +
        out.icc.communalWealth +
        (out.icc.church ?? 0),
    );
    expect(out.ifd.scale).toBe('married');
    expect(out.total).toBe(out.icc.total + out.ifd.tax);
    expect(out.unverifiedRules.length).toBeGreaterThan(0);
    expect(out.unsupported).toEqual([]);
    expect(out.notSupported).toEqual([]);
    const text = texts(res);
    expect(text).toMatch(
      /canton of Basel-Landschaft, commune Allschwil \(Steuerfuss [\d.]+\s% of the state tax\)/,
    );
    expect(text).toMatch(/Staats-, Gemeinde- und Kirchensteuer/);
    expect(text).toMatch(/Kirchensteuer/);
    expect(text).toMatch(/direkte Bundessteuer/);
    expect(text).toMatch(/Basel-Landschaft is a preview/);

    // With detail, every item with its source, in both columns.
    const detail = await call('compute_tax', { detail: true });
    const d = (detail.structuredContent as { detail: Record<string, { code: string }[]> }).detail;
    expect(d.iccItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining(['100', '105', '500', '610', '620', '630', '640', '680', '738']),
    );
    expect(d.ifdItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining(['100', '620', '640', '680', '738', '750', '775']),
    );
    expect(texts(detail)).toMatch(/- Bund 775 Sozialabzug für Ehepaare/);
  });

  it('shows the estimate in the dashboard, in the official German terms', async () => {
    await muster();
    const s = await state('fr');
    expect(s.canton).toMatchObject({ code: 'BL', name: 'Bâle-Campagne' });
    const est = s.estimate as
      (DashboardState['estimate'] & { canton?: string; unverified?: string[] }) | undefined;
    expect(est?.computed).toBe(true);
    if (!est?.computed) return;
    expect(est.canton).toBe('BL');
    expect(est.rows.map((r) => r.label)).toEqual([
      'Impôts cantonal, communal et ecclésiastique (Staats-, Gemeinde- und Kirchensteuer)',
      'Impôt fédéral direct (direkte Bundessteuer)',
    ]);
    expect(est.parts.map((r) => r.id)).toEqual(['cantonalIncome', 'communalIncome', 'church']);
    expect(est.unverified?.length).toBeGreaterThan(0);
    expect(est.lastYear).toEqual([]);
    const de = await state('de');
    const estDe = de.estimate;
    if (!estDe?.computed) throw new Error('not computed');
    expect(estDe.rows.map((r) => r.label)).toEqual([
      'Staats-, Gemeinde- und Kirchensteuer',
      'Direkte Bundessteuer',
    ]);
    expect(estDe.items.find((i) => i.code === '610')?.label).toBe('Beiträge 3. Säule, Person 1');
  });

  it('asks Basel-Landschaft’s own questions only where they apply', async () => {
    await answer([
      ['canton', 'BL'],
      ['civil_status', 'divorced'],
      ['children', 2],
      ['children_custody', 'shared'],
      ['child_support', 'none_i_earn_more'],
    ]);
    // Shared custody without child support: who mainly bears the upkeep; each child's income.
    expect(ws.next()?.id).toBe('main_upkeep');
    await answer([['main_upkeep', true]]);
    const ids = ws.snapshot().slots.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['child_income:child1', 'child_income:child2']));
    await answer([
      ['child_income:child1', false],
      ['child_income:child2', false],
      ['childcare', 'none'],
      ['commune', 'Pratteln'],
      ['moved', 'no'],
      ['church:p1', 'none'],
      ['income_sources:p1', ['pension']],
    ]);
    // A pension: is it an AHV or an IV pension (770 or 771 from 2026)?
    expect(ws.next()?.id).toBe('pension_kind:p1');
    const q = await call('next_questions');
    expect(texts(q)).not.toMatch(/\{n\}/);
    await answer([['pension_kind:p1', 'iv']]);
    expect(ws.ledger.get('bl.pension_kind', 'p1')?.value).toBe('iv');
    expect(ws.ledger.get('bl.main_upkeep')?.value).toBe(true);
  });

  it('fails closed where its rules do: spouses in different churches are not computed', async () => {
    await muster(['catholic', 'reformed']);
    const out = (await call('compute_tax')).structuredContent as Omit<TaxOut, 'icc'> & {
      icc: null;
    };
    expect(out.computed).toBe(true);
    expect(out.icc).toBeNull();
    expect(out.unsupported.join(' ')).toMatch(/not members of the same church/);
    const s = await state();
    expect(s.estimate?.computed).toBe(true);
  });

  it('runs the final check with Basel-Landschaft’s lines, software and terms', async () => {
    await muster();
    await ws.setPlan('p2', 'plan.gross_salary', 46_000, 'chat');
    const res = await call('final_check');
    const out = res.structuredContent as FinalCheckState;
    // The 3a of person 1 is at the cap in both taxes: said once, for both.
    const pillar = out.know.find((i) => i.kind === 'limit' && i.code === '610');
    expect(pillar?.title).toMatch(/Beiträge 3\. Säule/);
    expect(pillar?.title).toMatch(/Staatssteuer und Bundessteuer/);
    expect(pillar?.detail).toMatch(/^Paid into pillar 3a \(Beiträge 3\. Säule\): CHF 7’258\.00/);
    const pdf = out.know.find((i) => i.kind === 'official_pdf');
    expect(pdf?.detail).toMatch(/Taxpresso checks Geneva declarations only/);
    expect(out.know.some((i) => i.kind === 'form_provisional')).toBe(true);
    expect(texts(res)).not.toMatch(/GeTax|ZHprivateTax|TaxMe/);
    for (const i of [...out.fix, ...out.know]) {
      for (const src of i.sources) {
        if (src.id.startsWith('bl-')) expect(src.url, src.id).toMatch(/^https:\/\//);
      }
    }
  });

  it('plans 3a, a buy-in and the 3a catch-up on Basel-Landschaft’s tax, and keeps TOU Geneva’s', async () => {
    await answer([['canton', 'BL'], ...MEIER]);
    await confirmed('salary_certificate', 'p1', [
      ['salary.base', "85'000.00"],
      ['salary.gross', "85'000.00"],
      ['salary.social_contributions', "5'440.00"],
      ['salary.lpp_ordinary', "4'250.00"],
    ]);
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
    expect(out.pillar3a.assumptions).toContain('bl_preview');
    expect(out.pillar3a.assumptions).not.toContain('bl_commune_default');
    expect(out.pillar3a.sources.join(' ')).toMatch(/bl-2026-/);
    expect(out.lppBuyIn.saving?.cantonalCentimes).toBeGreaterThan(0);
    // Basel-Landschaft gives its rule for a 3a catch-up (bl-2026-wegleitung p. 31): a saving.
    expect(out.pillar3aCatchUp.saving?.totalCentimes).toBeGreaterThan(0);
    expect(out.tou.applies).toBe(false);
    const text = texts(res);
    expect(text).toMatch(/pillar 3a \(Säule 3a\)/);
    expect(text).toMatch(/Einkäufe 2\. Säule \(Pensionskasse\)/);
    expect(text).toMatch(/For Basel-Landschaft, taxation at source \(Quellensteuer\)/);
    expect(text).toMatch(/Basel-Landschaft is a preview/);
    const decided = await call('decide_optimization', {
      id: 'tou',
      choice: 'decline',
      confirmed: false,
    });
    expect(decided.isError).toBe(true);
    expect(texts(decided)).toMatch(/TOU is Geneva’s procedure\. For Basel-Landschaft/);
  });

  it('gives the values to type page by page, in the chat and the dashboard', async () => {
    await muster();
    const list = await call('get_form_values');
    const out = list.structuredContent as { sections: { page: string }[]; provisional: boolean };
    expect(out.sections.map((s) => s.page)).toEqual(expect.arrayContaining(['S2', 'S3']));
    expect(out.provisional).toBe(true);
    expect(texts(list)).toMatch(/E-Tax BL/);
    const page3 = await call('get_form_values', { section: 'S3' });
    expect(texts(page3)).toMatch(/610 Beiträge 3\. Säule, Person 1/);
    const panel = (await state('fr')).copyPanel;
    expect(panel.unplaced).toEqual([]);
    expect(panel.total).toBeGreaterThan(0);
    // The PDF check is Geneva's only: said plainly, in both places.
    const pdf = await call('reconcile_official_pdf');
    expect(texts(pdf)).toMatch(/reads Geneva declarations only/);
    expect(texts(pdf)).toMatch(/E-Tax BL/);
    expect((await state()).declarationCheck.status).toBe('not_available');
  });

  it('gives the same federal tax as Geneva, Zurich and Bern for the same household', async () => {
    await meier('BL');
    const bl = (await call('compute_tax')).structuredContent as TaxOut;
    expect(bl.icc.church).toBeNull();
    expect(bl.icc.splitting).toBe(false);
    const federal: TaxOut['ifd'][] = [];
    for (const canton of ['GE', 'ZH', 'BE'] as const) {
      await client.close();
      await dashboard.stop();
      await connect();
      await meier(canton);
      federal.push(((await call('compute_tax')).structuredContent as TaxOut).ifd);
    }
    for (const other of federal) {
      expect(other.taxableIncome).toBe(bl.ifd.taxableIncome);
      expect(other.tax).toBe(bl.ifd.tax);
    }
  });
});
