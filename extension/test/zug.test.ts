// A Zug return end to end through the extension (docs/design/cantons.md, "As built: Zug"): the
// questions, the estimate (cantonal and communal tax, the church and Bürgergemeinde tax, and the
// federal tax of form K's Bund column) for Claude (compute_tax) and the dashboard, the final check,
// the plans and the values to type. Synthetic households on a temporary vault, never the real one:
// the Muster family in Baar and Lea Keller, single, in Zug.
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
    Buffer.from(`%PDF-1.7 synthetic Zug document ${n}`),
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
 * The Muster family of Baar: two salaries, two children (16 and 3), a crèche for the younger, both
 * Roman Catholic, person 1 an Ortsbürger of Baar, renting.
 */
async function muster(
  church: [string, string] = ['catholic', 'catholic'],
  citizens: [string, string] = ['baar', 'none'],
) {
  await answer([
    ['canton', 'ZG'],
    ['civil_status', 'married'],
    ['children', 2],
    ['children_custody', 'with_household'],
    ['child_under15:child1', false],
    ['child_minor:child1', true],
    ['child_under15:child2', true],
    ['childcare', 'creche_or_daycare'],
    ['child_care:child1', 0],
    ['child_care:child2', 18_000],
    ['commune', 'Baar'],
    ['moved', 'no'],
    ['rent', 30_000],
    ['church:p1', church[0]],
    ['church:p2', church[1]],
    ['citizen_of:p1', citizens[0]],
    ['citizen_of:p2', citizens[1]],
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
    ['commute_transit_cost:p1', 729],
    ['meal_days:p1', 200],
    ['commute:p2', 'bike'],
    ['meal_days:p2', 0],
    ['banks', 0],
    ['crypto', false],
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
  await confirmed('health_premiums', 'household', [['health.premiums', "13'800.00"]]);
  await confirmed('childcare_invoice', 'household', [['childcare.costs', "18'000.00"]]);
  await confirmed('donation_receipt', 'household', [['donation.amount', "1'500.00"]]);
}

/** Lea Keller, single, in Zug: one salary, 3a, no parish, not an Ortsbürger of a Zug commune. */
const KELLER: [string, unknown][] = [
  ['civil_status', 'single'],
  ['children', 0],
  ['commune', 'Zug'],
  ['moved', 'no'],
  ['rent', 24_000],
  ['church:p1', 'none'],
  ['citizen_of:p1', 'none'],
  ['income_sources:p1', ['salary']],
  ['employers:p1', 1],
  ['residence:p1', 'swiss'],
  ['pillar3a:p1', true],
  ['lpp_buyin:p1', false],
  ['commute:p1', 'public_transport'],
  ['commute_transit_cost:p1', 729],
  ['meal_days:p1', 180],
  ['banks', 0],
  ['crypto', false],
  ['payments', []],
  ['special', []],
];

async function keller(canton: 'ZG' | 'BL' | 'BE' | 'GE' | 'ZH' = 'ZG') {
  const commune = { ZG: 'Zug', BL: 'Liestal', BE: 'Biel/Bienne', ZH: 'Zürich', GE: 'Vernier' }[
    canton
  ];
  // Only Zug asks the rent and the Bürgergemeinde; Geneva asks no church; Bern asks your own
  // household too.
  const zugOnly = new Set(['rent', 'citizen_of:p1']);
  const asked = ([id]: [string, unknown]) =>
    (canton === 'ZG' || !zugOnly.has(id)) && (canton !== 'GE' || !id.startsWith('church'));
  await answer([
    ['canton', canton],
    ...KELLER.filter(asked).flatMap(([id, v]): [string, unknown][] => [
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
    simple: number;
    cantonal: number;
    communal: number;
    church: number | null;
    citizens: number | null;
    taxableIncome: number;
    taxableWealth: number;
    tariff: string;
  };
  ifd: { tax: number; taxableIncome: number; scale: string };
  unverifiedRules: string[];
  unsupported: string[];
  notSupported: string[];
}

describe('a Zug return', () => {
  it('asks Zug’s questions, then computes every tax and the federal tax', async () => {
    await muster();
    const status = await call('get_status');
    expect(status.structuredContent).toMatchObject({ canton: 'ZG' });
    expect(texts(status)).toMatch(/tax year 2026, Zug/);
    expect(ws.snapshot().slots.filter((s) => s.value === undefined)).toEqual([]);

    const res = await call('compute_tax');
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, canton: 'ZG' });
    expect(out.commune).toMatchObject({ bfs: null, name: 'Baar' });
    // Married with two children: the Mehrpersonentarif, the Roman Catholic parish of Baar and half
    // the Bürgergemeinde tax (only person 1 is an Ortsbürger of Baar).
    expect(out.icc.tariff).toBe('married');
    expect(out.icc.church).toBeGreaterThan(0);
    expect(out.icc.citizens).toBeGreaterThan(0);
    expect(out.icc.total).toBe(
      out.icc.cantonal + out.icc.communal + (out.icc.church ?? 0) + (out.icc.citizens ?? 0),
    );
    expect(out.ifd.scale).toBe('married');
    expect(out.total).toBe(out.icc.total + out.ifd.tax);
    expect(out.unverifiedRules.length).toBeGreaterThan(0);
    expect(out.unsupported).toEqual([]);
    expect(out.notSupported).toEqual([]);
    const text = texts(res);
    expect(text).toMatch(/canton of Zug, commune Baar \(Steuerfuss [\d.]+\s% of the simple tax\)/);
    expect(text).toMatch(/Kantons- und Gemeindesteuern/);
    expect(text).toMatch(/Kirchensteuer/);
    expect(text).toMatch(/Bürgersteuer/);
    expect(text).toMatch(/direkte Bundessteuer/);
    expect(text).toMatch(/Zug is a preview/);

    // With detail, every item with its source, in both columns.
    const detail = await call('compute_tax', { detail: true });
    const d = (detail.structuredContent as { detail: Record<string, { code: string }[]> }).detail;
    expect(d.iccItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        '100',
        '101',
        '201',
        '220',
        '230',
        '253',
        '260',
        '296',
        '400',
        '403',
        '403a',
        '407',
      ]),
    );
    // The crèche (18,000) is more than own care for the younger child; the older one is 15 or more.
    expect(d.iccItems!.find((i) => i.code === '404')).toBeUndefined();
    expect(d.ifdItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining(['100', '201', '230', '253', '260', '296', '401', '403']),
    );
    expect(texts(detail)).toMatch(/- Bund 401 Abzug für Ehepaare/);
  });

  it('shows the estimate in the dashboard, in the official German terms', async () => {
    await muster();
    const s = await state('fr');
    expect(s.canton).toMatchObject({ code: 'ZG', name: 'Zoug' });
    const est = s.estimate as
      (DashboardState['estimate'] & { canton?: string; unverified?: string[] }) | undefined;
    expect(est?.computed).toBe(true);
    if (!est?.computed) return;
    expect(est.canton).toBe('ZG');
    expect(est.rows.map((r) => r.label)).toEqual([
      'Impôts cantonal et communal (Kantons- und Gemeindesteuern)',
      'Impôt fédéral direct (direkte Bundessteuer)',
    ]);
    expect(est.parts.map((r) => r.id)).toEqual(['cantonal', 'communal', 'church', 'citizens']);
    expect(est.unverified?.length).toBeGreaterThan(0);
    expect(est.lastYear).toEqual([]);
    const de = await state('de');
    const estDe = de.estimate;
    if (!estDe?.computed) throw new Error('not computed');
    expect(estDe.rows.map((r) => r.label)).toEqual([
      'Kantons- und Gemeindesteuern',
      'Direkte Bundessteuer',
    ]);
    expect(estDe.items.find((i) => i.code === '100')?.label).toBe('Haupterwerb, Person 1');
  });

  it('asks Zug’s own questions only where they apply', async () => {
    await answer([
      ['canton', 'ZG'],
      ['civil_status', 'divorced'],
      ['children', 2],
      ['children_custody', 'shared'],
      ['child_support', 'none_i_earn_more'],
    ]);
    // Shared custody without child support: who has the larger share of the care; each child's age.
    expect(ws.next()?.id).toBe('main_care');
    await answer([['main_care', true]]);
    const ids = ws.snapshot().slots.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['child_under15:child1', 'child_under15:child2']));
    await answer([
      ['child_under15:child1', true],
      ['child_under15:child2', false],
    ]);
    // Whether a minor only for the child aged 15 or more.
    expect(
      ws
        .snapshot()
        .slots.filter((s) => s.id.startsWith('child_minor'))
        .map((s) => s.id),
    ).toEqual(['child_minor:child2']);
    await answer([
      ['child_minor:child2', true],
      ['childcare', 'none'],
      ['commune', 'Unterägeri'],
      ['moved', 'no'],
    ]);
    // The rent, the parish and the Bürgergemeinde.
    expect(ws.next()?.id).toBe('rent');
    const q = await call('next_questions');
    expect(texts(q)).toMatch(/Mietzinsabzug/);
    await answer([
      ['rent', 21_600],
      ['church:p1', 'reformed'],
    ]);
    expect(ws.next()?.id).toBe('citizen_of:p1');
    await answer([['citizen_of:p1', 'Oberägeri']]);
    expect(ws.ledger.get('zg.citizen_of', 'p1')?.value).toBe('oberageri');
    expect(ws.ledger.get('zg.main_care')?.value).toBe(true);
    expect(ws.ledger.get('zg.rent')?.value).toBe(2_160_000);
  });

  it('asks the childcare per child when it decides the deduction, and computes it then', async () => {
    await answer([
      ['canton', 'ZG'],
      ['civil_status', 'married'],
      ['children', 2],
      ['children_custody', 'with_household'],
      ['child_under15:child1', true],
      ['child_under15:child2', true],
      ['childcare', 'creche_or_daycare'],
    ]);
    // Skip the split for now: the household's 20,000 for two children under 15 is more than the
    // own care deduction, so how it splits decides the deduction (fail closed).
    await call('skip_question', { id: 'child_care:child1' });
    await call('skip_question', { id: 'child_care:child2' });
    await answer(
      KELLER.filter(([id]) => !['civil_status', 'children'].includes(id)).map(([id, v]) => [
        id,
        id === 'church:p1' || id === 'citizen_of:p1' ? 'none' : v,
      ]),
    );
    await answer([
      ['church:p2', 'none'],
      ['citizen_of:p2', 'none'],
      ['income_sources:p2', ['salary']],
      ['employers:p2', 1],
      ['pillar3a:p2', false],
      ['lpp_buyin:p2', false],
      ['commute:p2', 'walk'],
      ['meal_days:p2', 0],
    ]);
    await confirmed('salary_certificate', 'p1', [['salary.gross', "90'000.00"]]);
    await confirmed('salary_certificate', 'p2', [['salary.gross', "40'000.00"]]);
    await confirmed('childcare_invoice', 'household', [['childcare.costs', "20'000.00"]]);
    const before = (await call('compute_tax')).structuredContent as Omit<TaxOut, 'icc'> & {
      icc: null;
    };
    expect(before.icc).toBeNull();
    expect(before.unsupported.join(' ')).toMatch(/limit is per child/);
    await answer([
      ['child_care:child1', 20_000],
      ['child_care:child2', 0],
    ]);
    const after = (await call('compute_tax', { detail: true })).structuredContent as {
      detail: { iccItems: { code: string; amount: number }[] };
    };
    const at = (code: string) => after.detail.iccItems.find((i) => i.code === code)?.amount;
    expect(at('253')).toBe(-2_000_000);
    expect(at('404')).toBe(-1_220_000);
  });

  it('fails closed where its rules do: spouses Ortsbürger of two different Zug communes', async () => {
    await muster(['catholic', 'catholic'], ['baar', 'cham']);
    const out = (await call('compute_tax')).structuredContent as Omit<TaxOut, 'icc'> & {
      icc: null;
    };
    expect(out.computed).toBe(true);
    expect(out.icc).toBeNull();
    expect(out.unsupported.join(' ')).toMatch(/two different Zug communes/);
    const s = await state();
    expect(s.estimate?.computed).toBe(true);
  });

  it('runs the final check with Zug’s lines, software and terms', async () => {
    await muster();
    await ws.setPlan('p2', 'plan.gross_salary', 52_000, 'chat');
    const res = await call('final_check');
    const out = res.structuredContent as FinalCheckState;
    // The 3a of person 1 is at the cap in both taxes: said once, for both.
    const pillar = out.know.find((i) => i.kind === 'limit' && i.code === '220');
    expect(pillar?.title).toMatch(/Beiträge gebundene Vorsorge/);
    expect(pillar?.title).toMatch(/Kanton und Bund/);
    expect(pillar?.detail).toMatch(
      /^Paid into pillar 3a \(Beiträge gebundene Vorsorge \(Säule 3a\)\): CHF 7’258\.00/,
    );
    const pdf = out.know.find((i) => i.kind === 'official_pdf');
    expect(pdf?.detail).toMatch(/Taxpresso checks Geneva declarations only/);
    expect(out.know.some((i) => i.kind === 'form_provisional')).toBe(true);
    expect(texts(res)).not.toMatch(/GeTax|ZHprivateTax|TaxMe|E-Tax BL/);
    for (const i of [...out.fix, ...out.know]) {
      for (const src of i.sources) {
        if (src.id.startsWith('zg-')) expect(src.url, src.id).toMatch(/^https:\/\//);
      }
    }
  });

  it('plans 3a, a buy-in and the 3a catch-up on Zug’s tax, and keeps TOU Geneva’s', async () => {
    await answer([['canton', 'ZG'], ...KELLER]);
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
    expect(out.pillar3a.assumptions).toContain('zg_preview');
    expect(out.pillar3a.assumptions).not.toContain('zg_commune_default');
    expect(out.pillar3a.sources.join(' ')).toMatch(/zg-2026-/);
    expect(out.lppBuyIn.saving?.cantonalCentimes).toBeGreaterThan(0);
    // Zug follows the federal rules for 3a, so the catch-up from 2026 too: a saving.
    expect(out.pillar3aCatchUp.saving?.totalCentimes).toBeGreaterThan(0);
    expect(out.tou.applies).toBe(false);
    const text = texts(res);
    expect(text).toMatch(/pillar 3a \(Säule 3a\)/);
    expect(text).toMatch(/Beiträge an die 2\. Säule \(Einkaufsbeiträge\)/);
    expect(text).toMatch(/For Zug, taxation at source \(Quellensteuer\)/);
    expect(text).toMatch(/Zug is a preview/);
    const decided = await call('decide_optimization', {
      id: 'tou',
      choice: 'decline',
      confirmed: false,
    });
    expect(decided.isError).toBe(true);
    expect(texts(decided)).toMatch(/TOU is Geneva’s procedure\. For Zug/);
  });

  it('gives the values to type page by page, in the chat and the dashboard', async () => {
    await muster();
    const list = await call('get_form_values');
    const out = list.structuredContent as { sections: { page: string }[]; provisional: boolean };
    expect(out.sections.map((s) => s.page)).toEqual(expect.arrayContaining(['K2', 'K3']));
    expect(out.provisional).toBe(true);
    expect(texts(list)).toMatch(/eTax\.zug/);
    const page3 = await call('get_form_values', { section: 'K3' });
    expect(texts(page3)).toMatch(
      /220 Beiträge gebundene Vorsorge gemäss Bescheinigungen \(VO\), Person 1/,
    );
    const panel = (await state('fr')).copyPanel;
    expect(panel.unplaced).toEqual([]);
    expect(panel.total).toBeGreaterThan(0);
    // The PDF check is Geneva's only: said plainly, in both places.
    const pdf = await call('reconcile_official_pdf');
    expect(texts(pdf)).toMatch(/reads Geneva declarations only/);
    expect(texts(pdf)).toMatch(/eTax\.zug/);
    expect((await state()).declarationCheck.status).toBe('not_available');
  });

  it('gives the same federal tax as Geneva, Zurich, Bern and Basel-Landschaft for the same household', async () => {
    await keller('ZG');
    const zg = (await call('compute_tax')).structuredContent as TaxOut;
    expect(zg.icc.church).toBeNull();
    expect(zg.icc.citizens).toBeNull();
    expect(zg.icc.tariff).toBe('single');
    const federal: TaxOut['ifd'][] = [];
    for (const canton of ['GE', 'ZH', 'BE', 'BL'] as const) {
      await client.close();
      await dashboard.stop();
      await connect();
      await keller(canton);
      federal.push(((await call('compute_tax')).structuredContent as TaxOut).ifd);
    }
    for (const other of federal) {
      expect(other.taxableIncome).toBe(zg.ifd.taxableIncome);
      expect(other.tax).toBe(zg.ifd.tax);
    }
  });
});
