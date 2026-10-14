// A Vaud return end to end through the extension (docs/design/cantons.md, "As built: Vaud"): the
// questions, the estimate (the cantonal and communal tax, and the federal tax of the guide's
// worksheet) for Claude (compute_tax) and the dashboard, the final check, the plans and the values
// to type. Synthetic households on a temporary vault, never the real one: the Exemple family in
// Nyon and Léa Modèle, single, in Lausanne.
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
    Buffer.from(`%PDF-1.7 synthetic Vaud document ${n}`),
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
 * The Exemple family of Nyon: two salaries, two children, one at a daycare, a car to work for one
 * (no usable public transport) and the other on foot, a rented flat, a savings account.
 */
async function exemple() {
  await answer([
    ['canton', 'VD'],
    ['civil_status', 'married'],
    ['children', 2],
    ['children_custody', 'with_household'],
    ['childcare', 'creche_or_daycare'],
    ['child_care:child1', 9_000],
    ['child_care:child2', 0],
    ['commune', 'Nyon'],
    ['moved', 'no'],
    ['income_sources:p1', ['salary']],
    ['income_sources:p2', ['salary']],
    ['employers:p1', 1],
    ['employers:p2', 1],
    ['residence:p1', 'swiss'],
    ['pillar3a:p1', true],
    ['pillar3a:p2', false],
    ['lpp_buyin:p1', false],
    ['lpp_buyin:p2', false],
    ['commute:p1', 'car'],
    ['commute_transit_usable:p1', 'no'],
    ['commute_distance:p1', 14],
    ['commute_drive_days:p1', 210],
    ['meal_days:p1', 200],
    ['commute:p2', 'walk'],
    ['meal_days:p2', 0],
    ['banks', 1],
    ['savings_interest', 150],
    ['crypto', false],
    ['payments', []],
    ['special', []],
    ['rent', 18_000],
    ['contents_high', false],
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
  await confirmed('childcare_invoice', 'household', [['childcare.costs', "9'000.00"]]);
  await confirmed('bank_attestation', 'household', [
    ['bank.balance', "45'000.00"],
    ['bank.interest_gross', '150.00'],
  ]);
}

/** Léa Modèle, single, in Lausanne: one salary, on foot to work, 3a. */
const MODELE: [string, unknown][] = [
  ['civil_status', 'single'],
  ['children', 0],
  ['commune', 'Lausanne'],
  ['moved', 'no'],
  ['income_sources:p1', ['salary']],
  ['employers:p1', 1],
  ['residence:p1', 'swiss'],
  ['pillar3a:p1', true],
  ['lpp_buyin:p1', false],
  ['commute:p1', 'walk'],
  ['meal_days:p1', 180],
  ['banks', 0],
  ['crypto', false],
  ['payments', []],
  ['special', []],
  ['rent', 10_000],
  ['contents_high', false],
];

/** The questions only Vaud asks, left out for another canton. */
const VAUD_ONLY = new Set(['rent', 'contents_high', 'contents_value', 'savings_interest']);

async function modele(canton: 'VD' | 'GE' | 'BE' = 'VD') {
  const commune = canton === 'VD' ? 'Lausanne' : canton === 'BE' ? 'Biel/Bienne' : 'Vernier';
  const asked = ([id]: [string, unknown]) => canton === 'VD' || !VAUD_ONLY.has(id);
  await answer([
    ['canton', canton],
    ...MODELE.filter(asked).map(([id, v]): [string, unknown] => [
      id,
      id === 'commune' ? commune : v,
    ]),
    // Bern asks, besides, your own household (form 1.2) and the church.
    ...(canton === 'BE'
      ? ([
          ['own_household', true],
          ['church:p1', 'none'],
        ] as [string, unknown][])
      : []),
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
  commune: { bfs: null; name: string; rate: number };
  total: number;
  icc: {
    total: number;
    cantonalIncome: number;
    communalIncome: number;
    cantonalWealth: number;
    communalWealth: number;
    taxableIncome: number;
    parts: number;
  };
  ifd: { tax: number; taxableIncome: number; scale: string };
  unsupported: string[];
  unverifiedRules: string[];
  notSupported: string[];
}

describe('a Vaud return', () => {
  it('asks Vaud’s questions, then computes the cantonal and communal tax and the federal tax', async () => {
    await exemple();
    const status = await call('get_status');
    expect(status.structuredContent).toMatchObject({ canton: 'VD' });
    expect(texts(status)).toMatch(/tax year 2026, Vaud/);
    expect(ws.snapshot().slots.filter((s) => s.value === undefined)).toEqual([]);

    const res = await call('compute_tax');
    const out = res.structuredContent as TaxOut;
    expect(out, texts(res)).toMatchObject({ computed: true, canton: 'VD' });
    expect(out.commune).toMatchObject({ bfs: null, name: 'Nyon' });
    expect(out.unsupported).toEqual([]);
    // Married with two children: 1.8 + 2 x 0.5 parts of the quotient familial.
    expect(out.icc.parts).toBe(2.8);
    expect(out.icc.total).toBe(
      out.icc.cantonalIncome +
        out.icc.communalIncome +
        out.icc.cantonalWealth +
        out.icc.communalWealth,
    );
    expect(out.ifd.scale).toBe('married');
    expect(out.total).toBe(out.icc.total + out.ifd.tax);
    expect(out.unverifiedRules.length).toBeGreaterThan(0);
    expect(out.notSupported).toEqual([]);
    const text = texts(res);
    expect(text).toMatch(
      /canton of Vaud, commune Nyon \(communal rate [\d.]+ % of the cantonal base tax\)/,
    );
    expect(text).toMatch(/impôt cantonal et communal/);
    expect(text).toMatch(/quotient familial/);
    expect(text).toMatch(/impôt fédéral direct/);
    expect(text).toMatch(/Vaud is a preview/);
    // The 2026 guide is not published: its methods are the 2025 guide's, and said so.
    expect(text).toMatch(/2026 guide \(instructions générales\) is not published/);

    // With detail, every item with its source, in both taxes.
    const detail = await call('compute_tax', { detail: true });
    const d = (detail.structuredContent as { detail: Record<string, { code: string }[]> }).detail;
    expect(d.iccItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        '100',
        '140',
        '150',
        '160',
        '235',
        '300',
        '310',
        '480',
        '670',
        '725',
      ]),
    );
    expect(d.ifdItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining(['100', '140', '235', '300', 'deduction-maries', 'deduction-enfants']),
    );
    expect(texts(detail)).toMatch(/- IFD deduction-maries Déductions sociales pour les personnes/);
  });

  it('shows the estimate in the dashboard, with the official French terms', async () => {
    await exemple();
    const s = await state('fr');
    expect(s.canton).toMatchObject({ code: 'VD', name: 'Vaud' });
    const est = s.estimate as
      (DashboardState['estimate'] & { canton?: string; unverified?: string[] }) | undefined;
    expect(est?.computed).toBe(true);
    if (!est?.computed) return;
    expect(est.canton).toBe('VD');
    expect(est.rows.map((r) => r.label)).toEqual([
      'Impôt cantonal et communal',
      'Impôt fédéral direct',
    ]);
    expect(est.parts.map((r) => r.id)).toEqual([
      'cantonalIncome',
      'communalIncome',
      'cantonalWealth',
      'communalWealth',
    ]);
    expect(est.unverified?.length).toBeGreaterThan(0);
    expect(est.lastYear).toEqual([]);
    // A German page reads Vaud's content in English (its form is French), with the French terms.
    const de = await state('de');
    expect(de.canton).toMatchObject({ code: 'VD', name: 'Waadt' });
    const estDe = de.estimate;
    if (!estDe?.computed) throw new Error('not computed');
    expect(estDe.rows.map((r) => r.label)).toEqual([
      'Cantonal and communal tax (impôt cantonal et communal)',
      'Federal direct tax (impôt fédéral direct)',
    ]);
  });

  it('asks Vaud’s own questions only where they apply', async () => {
    await answer([
      ['canton', 'VD'],
      ['civil_status', 'divorced'],
      ['children', 2],
      ['children_custody', 'shared'],
      ['child_support', 'none_i_earn_more'],
    ]);
    // Not married, with children: a household alone with them (annex 03), then who bears their
    // upkeep, shared custody without child support (RIFam art. 5 al. 2).
    let ids = ws.snapshot().slots.map((s) => s.id);
    expect(ids).toContain('own_household');
    expect(ids).not.toContain('main_upkeep');
    await answer([['own_household', true]]);
    expect(ws.snapshot().slots.map((s) => s.id)).toContain('main_upkeep');
    await answer([
      ['main_upkeep', true],
      ['childcare', 'nanny'],
    ]);
    ids = ws.snapshot().slots.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['child_care:child1', 'child_care:child2']));
    const q = await call('next_questions', { limit: 5 });
    expect(texts(q)).not.toMatch(/\{n\}/);
    // The part of the commune: only in L'Abbaye and Le Chenit, their own parts only.
    await answer([
      ['child_care:child1', 0],
      ['child_care:child2', 0],
      ['commune', 'Le Chenit'],
    ]);
    const part = ws.snapshot().slots.find((s) => s.id === 'commune_part');
    expect(part).toBeDefined();
    const options = ws.render(part!, 'en').options!.map((o) => o.value);
    expect(options).toEqual([
      'le-chenit:le-chenit',
      'le-chenit:le-brassus',
      'le-chenit:le-sentier',
      'le-chenit:l-orient',
    ]);
    await answer([['commune', 'Lausanne']]);
    expect(ws.snapshot().slots.some((s) => s.id === 'commune_part')).toBe(false);
    // The household contents' value: only when they may be taxed.
    await answer([['contents_high', true]]);
    expect(ws.snapshot().slots.some((s) => s.id === 'contents_value')).toBe(true);
  });

  it('adds the fraction’s rate to the commune’s in Le Chenit', async () => {
    await modele();
    const lausanne = (await call('compute_tax')).structuredContent as TaxOut;
    await answer([
      ['commune', 'Le Chenit'],
      ['commune_part', 'le-chenit:le-brassus'],
    ]);
    const brassus = (await call('compute_tax')).structuredContent as TaxOut;
    expect(brassus.commune.name).toBe('Le Chenit');
    await answer([['commune_part', 'le-chenit:le-chenit']]);
    const rest = (await call('compute_tax')).structuredContent as TaxOut;
    // The commune's own rate, plus the fraction's in Le Brassus (vd-na-law-licom art. 1 al. 1).
    expect(brassus.commune.rate).toBeGreaterThan(rest.commune.rate);
    expect(brassus.icc.communalIncome).toBeGreaterThan(rest.icc.communalIncome);
    expect(lausanne.ifd.tax).toBe(rest.ifd.tax);
  });

  it('fails closed in 2026 for travel by public transport, whose flat amounts are not published', async () => {
    await modele();
    await answer([
      ['commute:p1', 'public_transport'],
      ['commute_transit_cost:p1', 880],
    ]);
    const res = await call('compute_tax');
    const out = res.structuredContent as { icc: unknown };
    expect(out.icc).toBeNull();
    expect(texts(res)).toMatch(/Travel to work \(code 140\) not computed for 2026/);
  });

  it('runs the final check with Vaud’s lines, software and terms', async () => {
    await exemple();
    await ws.setPlan('p2', 'plan.gross_salary', 46_000, 'chat');
    const res = await call('final_check');
    const out = res.structuredContent as FinalCheckState;
    // The 3a of person 1 is at the cap in both taxes: said once, for both.
    const pillar = out.know.find((i) => i.kind === 'limit' && i.code === '310');
    expect(pillar?.title).toMatch(/Prévoyance individuelle liée \(3e pilier A\)/);
    expect(pillar?.title).toMatch(/cantonal and federal tax/);
    const pdf = out.know.find((i) => i.kind === 'official_pdf');
    expect(pdf?.detail).toMatch(/Taxpresso checks Geneva declarations only/);
    expect(out.know.some((i) => i.kind === 'form_provisional')).toBe(true);
    expect(texts(res)).not.toMatch(/GeTax|ZHprivateTax|TaxMe/);
    for (const i of [...out.fix, ...out.know]) {
      for (const src of i.sources) {
        if (src.id.startsWith('vd-')) expect(src.url, src.id).toMatch(/^https:\/\//);
      }
    }
  });

  it('plans 3a, a buy-in and the 3a catch-up on Vaud’s tax, and keeps TOU Geneva’s', async () => {
    await modele();
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
    expect(out.pillar3a.assumptions).toContain('vd_preview');
    expect(out.pillar3a.sources.join(' ')).toMatch(/vd-2026-/);
    expect(out.lppBuyIn.saving?.cantonalCentimes).toBeGreaterThan(0);
    // The cantonal law takes the federal 3a limits (LI art. 37 al. 1 lit. e): a saving.
    expect(out.pillar3aCatchUp.saving?.totalCentimes).toBeGreaterThan(0);
    expect(out.tou.applies).toBe(false);
    const text = texts(res);
    expect(text).toMatch(/Rachats? d’années d’assurance \(2e pilier\)/i);
    expect(text).toMatch(/For Vaud, taxation at source/);
    expect(text).toMatch(/Vaud is a preview/);
  });

  it('gives the values to type page by page, in the chat and the dashboard', async () => {
    await exemple();
    const list = await call('get_form_values');
    const out = list.structuredContent as { sections: { page: string }[]; provisional: boolean };
    expect(out.sections.length).toBeGreaterThan(2);
    expect(out.provisional).toBe(true);
    expect(texts(list)).toMatch(/VaudTax/);
    const panel = (await state('fr')).copyPanel;
    expect(panel.unplaced).toEqual([]);
    expect(panel.total).toBeGreaterThan(0);
    // The PDF check is Geneva's only: said plainly, in both places.
    const pdf = await call('reconcile_official_pdf');
    expect(texts(pdf)).toMatch(/reads Geneva declarations only/);
    expect(texts(pdf)).toMatch(/VaudTax/);
    expect((await state()).declarationCheck.status).toBe('not_available');
  });

  it('gives the same federal tax as Geneva and Bern for the same household', async () => {
    await modele('VD');
    const vd = (await call('compute_tax')).structuredContent as TaxOut;
    expect(vd.computed).toBe(true);
    const federal: TaxOut['ifd'][] = [];
    for (const canton of ['GE', 'BE'] as const) {
      await client.close();
      await dashboard.stop();
      await connect();
      await modele(canton);
      federal.push(((await call('compute_tax')).structuredContent as TaxOut).ifd);
    }
    for (const other of federal) {
      expect(other.taxableIncome).toBe(vd.ifd.taxableIncome);
      expect(other.tax).toBe(vd.ifd.tax);
    }
  });
});
