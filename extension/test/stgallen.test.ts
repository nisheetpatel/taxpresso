// A St. Gallen return end to end through the extension (docs/design/cantons.md, "As built: St.
// Gallen"): the questions, the estimate (cantonal, communal and church tax, and the federal tax the
// tax office derives from the same return) for Claude (compute_tax) and the dashboard, the final
// check, the plans and the values to type. Synthetic households on a temporary vault, never the real
// one: the Steiner family in Wil and Nina Brunner, single, in the city of St. Gallen.
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
    Buffer.from(`%PDF-1.7 synthetic St. Gallen document ${n}`),
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
 * The Steiner family of Wil: two salaries, two children (one in school with education costs, one
 * not yet of school age with a crèche), both Catholic.
 */
async function steiner(church: [string, string] = ['catholic', 'catholic']) {
  await answer([
    ['canton', 'SG'],
    ['civil_status', 'married'],
    ['children', 2],
    ['children_custody', 'with_household'],
    ['child_stage:child1', 'school'],
    ['child_minor:child1', true],
    ['child_education:child1', 6_000],
    ['child_scholarships:child1', 0],
    ['child_stage:child2', 'preschool'],
    ['childcare', 'creche_or_daycare'],
    ['child_care:child1', 0],
    ['child_care:child2', 15_000],
    ['commune', 'Wil'],
    ['moved', 'no'],
    ['church:p1', church[0]],
    ['church:p2', church[1]],
    ['income_sources:p1', ['salary']],
    ['employers:p1', 1],
    ['taxed_at_source:p1', false],
    ['income_sources:p2', ['salary']],
    ['employers:p2', 1],
    ['taxed_at_source:p2', false],
    ['commute:p1', 'public_transport'],
    ['commute_transit_cost:p1', 1_200],
    ['meal_days:p1', 200],
    ['commute:p2', 'bike'],
    ['meal_days:p2', 0],
    ['pillar3a:p1', true],
    ['pillar3a:p2', false],
    ['lpp_buyin:p1', false],
    ['lpp_buyin:p2', false],
    ['payments', ['donations']],
    ['banks', 0],
    ['crypto', false],
    ['special', []],
  ]);
  await confirmed('salary_certificate', 'p1', [
    ['salary.base', "108'000.00"],
    ['salary.gross', "108'000.00"],
    ['salary.social_contributions', "6'910.00"],
    ['salary.lpp_ordinary', "6'500.00"],
    ['salary.net', "94'590.00"],
  ]);
  await confirmed('salary_certificate', 'p2', [
    ['salary.base', "48'000.00"],
    ['salary.gross', "48'000.00"],
    ['salary.social_contributions', "3'070.00"],
    ['salary.lpp_ordinary', "1'900.00"],
    ['salary.net', "43'030.00"],
  ]);
  await confirmed('pillar3a_attestation', 'p1', [['pillar3a.paid', "7'258.00"]]);
  await confirmed('health_premiums', 'household', [['health.premiums', "12'600.00"]]);
  await confirmed('childcare_invoice', 'household', [['childcare.costs', "15'000.00"]]);
  await confirmed('donation_receipt', 'household', [['donation.amount', "1'200.00"]]);
}

/** Nina Brunner, single, in the city of St. Gallen: one salary, 3a, no church. */
const BRUNNER: [string, unknown][] = [
  ['civil_status', 'single'],
  ['children', 0],
  ['commune', 'St. Gallen'],
  ['moved', 'no'],
  ['church:p1', 'none'],
  ['income_sources:p1', ['salary']],
  ['employers:p1', 1],
  ['taxed_at_source:p1', false],
  ['commute:p1', 'public_transport'],
  ['commute_transit_cost:p1', 800],
  ['meal_days:p1', 180],
  ['pillar3a:p1', true],
  ['lpp_buyin:p1', false],
  ['payments', []],
  ['banks', 0],
  ['crypto', false],
  ['special', []],
];

type Canton = 'SG' | 'ZG' | 'BL' | 'BE' | 'GE' | 'ZH';

async function brunner(canton: Canton = 'SG') {
  const commune = {
    SG: 'St. Gallen',
    ZG: 'Zug',
    BL: 'Liestal',
    BE: 'Biel/Bienne',
    ZH: 'Zürich',
    GE: 'Vernier',
  }[canton];
  // Geneva asks no church; Bern asks your own household too; Zug the rent and the Bürgergemeinde.
  const extra: Record<Canton, [string, unknown][]> = {
    SG: [],
    ZG: [
      ['rent', 0],
      ['citizen_of:p1', 'none'],
    ],
    BL: [],
    BE: [['own_household', true]],
    ZH: [],
    GE: [],
  };
  await answer([
    ['canton', canton],
    ...BRUNNER.filter(([id]) => canton !== 'GE' || !id.startsWith('church')).map(
      ([id, v]): [string, unknown] => [id, id === 'commune' ? commune : v],
    ),
    ...extra[canton],
  ]);
  await confirmed('salary_certificate', 'p1', [
    ['salary.base', "82'000.00"],
    ['salary.gross', "82'000.00"],
    ['salary.social_contributions', "5'250.00"],
    ['salary.lpp_ordinary', "4'100.00"],
    ['salary.net', "72'650.00"],
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
    simpleIncome: number;
    simpleWealth: number;
    cantonalIncome: number;
    communalIncome: number;
    cantonalWealth: number;
    communalWealth: number;
    church: number | null;
    taxableIncome: number;
    taxableWealth: number;
    splitting: boolean;
  };
  ifd: { tax: number; taxableIncome: number; scale: string };
  unverifiedRules: string[];
  unsupported: string[];
  notSupported: string[];
}

describe('a St. Gallen return', () => {
  it('asks St. Gallen’s questions, then computes every tax and the federal tax', async () => {
    await steiner();
    const status = await call('get_status');
    expect(status.structuredContent).toMatchObject({ canton: 'SG' });
    expect(texts(status)).toMatch(/tax year 2026, St\. Gallen/);
    expect(ws.snapshot().slots.filter((s) => s.value === undefined)).toEqual([]);

    const res = await call('compute_tax');
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, canton: 'SG' });
    expect(out.commune).toMatchObject({ bfs: null, name: 'Wil' });
    // Married with two children: Vollsplitting, and the Catholic church of Wil.
    expect(out.icc.splitting).toBe(true);
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
      /canton of St\. Gallen, commune Wil \(Gesamtsteuerfuss [\d.]+\s% of the simple tax\)/,
    );
    expect(text).toMatch(/Kantons-, Gemeinde- und Kirchensteuer/);
    expect(text).toMatch(/direkte Bundessteuer/);
    expect(text).toMatch(/St\. Gallen is a preview/);

    // With detail, every item with its source, for both taxes.
    const detail = await call('compute_tax', { detail: true });
    const d = (detail.structuredContent as { detail: Record<string, { code: string }[]> }).detail;
    expect(d.iccItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        '100',
        '102',
        '406',
        '408',
        '416',
        '456',
        '466',
        '208',
        '600',
        '258',
        '226',
        '244',
        '252',
        '254',
        '256',
      ]),
    );
    expect(d.ifdItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining(['100', '406', '208', '600', '258', '226', '23.1-23.3', 'Ehepaare']),
    );
    expect(texts(detail)).toMatch(/- DBSt Ehepaare Abzug für Ehepaare, nur direkte Bundessteuer/);
  });

  it('shows the estimate in the dashboard, in the official German terms', async () => {
    await steiner();
    const s = await state('fr');
    expect(s.canton).toMatchObject({ code: 'SG', name: 'Saint-Gall' });
    const est = s.estimate as
      (DashboardState['estimate'] & { canton?: string; unverified?: string[] }) | undefined;
    expect(est?.computed).toBe(true);
    if (!est?.computed) return;
    expect(est.canton).toBe('SG');
    expect(est.rows.map((r) => r.label)).toEqual([
      'Impôts cantonal, communal et ecclésiastique (Kantons-, Gemeinde- und Kirchensteuer)',
      'Impôt fédéral direct (direkte Bundessteuer)',
    ]);
    expect(est.parts.map((r) => r.id)).toEqual(['cantonalIncome', 'communalIncome', 'church']);
    expect(est.unverified?.length).toBeGreaterThan(0);
    expect(est.lastYear).toEqual([]);
    const de = await state('de');
    const estDe = de.estimate;
    if (!estDe?.computed) throw new Error('not computed');
    expect(estDe.rows.map((r) => r.label)).toEqual([
      'Kantons-, Gemeinde- und Kirchensteuer',
      'Direkte Bundessteuer',
    ]);
    expect(estDe.items.find((i) => i.code === '100')?.label).toBe('1.1 Haupterwerb, Person 1');
  });

  it('asks St. Gallen’s own questions only where they apply', async () => {
    await answer([
      ['canton', 'SG'],
      ['civil_status', 'divorced'],
      ['children', 2],
      ['children_custody', 'shared'],
      ['child_support', 'none_i_earn_more'],
    ]);
    // Shared custody without child support: who mainly bears the upkeep; each child's stage.
    expect(ws.next()?.id).toBe('main_upkeep');
    await answer([['main_upkeep', true]]);
    const ids = ws.snapshot().slots.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['child_stage:child1', 'child_stage:child2']));
    await answer([
      ['child_stage:child1', 'preschool'],
      ['child_stage:child2', 'school'],
    ]);
    // Whether a minor, and the education costs, only for the child in school.
    const perChild = (prefix: string) =>
      ws
        .snapshot()
        .slots.filter((s) => s.id.startsWith(prefix))
        .map((s) => s.id);
    expect(perChild('child_minor')).toEqual(['child_minor:child2']);
    expect(perChild('child_education')).toEqual(['child_education:child2']);
    // Scholarships only once there are education costs.
    expect(perChild('child_scholarships')).toEqual([]);
    await answer([
      ['child_minor:child2', true],
      ['child_education:child2', 5_000],
    ]);
    expect(perChild('child_scholarships')).toEqual(['child_scholarships:child2']);
    await answer([
      ['child_scholarships:child2', 1_000],
      ['childcare', 'none'],
      ['commune', 'St. Gallen'],
      ['moved', 'no'],
      ['church:p1', 'catholic'],
    ]);
    // The city's areas levy the same Catholic rate: no church area asked.
    expect(ws.snapshot().slots.map((s) => s.id)).not.toContain('church_area');
    // Its areas levy different Evangelical rates: asked, with the city's own areas.
    await answer([['church:p1', 'reformed']]);
    expect(ws.next()?.id).toBe('church_area');
    const q = await call('next_questions');
    expect(texts(q)).toMatch(/St\. Gallen Tablat \(O\)/);
    expect(texts(q)).not.toMatch(/Heerbrugg/);
    await answer([['church_area', 'st-gallen:St. Gallen Tablat (O)']]);
    expect(ws.ledger.get('sg.church_area')?.value).toBe('st-gallen:St. Gallen Tablat (O)');
    expect(ws.ledger.get('sg.main_upkeep')?.value).toBe(true);
    expect(ws.ledger.get('sg.child_education', 'child2')?.value).toBe(500_000);
  });

  it('asks the childcare per child when it decides the deduction, and computes it then', async () => {
    await answer([
      ['canton', 'SG'],
      ['civil_status', 'married'],
      ['children', 2],
      ['children_custody', 'with_household'],
      ['child_stage:child1', 'preschool'],
      ['child_stage:child2', 'preschool'],
      ['childcare', 'creche_or_daycare'],
    ]);
    // Skip the split for now: the household's 40,000 for two children under 14 is more than one
    // child's limit, so how it splits decides the deduction (fail closed).
    await call('skip_question', { id: 'child_care:child1' });
    await call('skip_question', { id: 'child_care:child2' });
    await answer(
      BRUNNER.filter(([id]) => !['civil_status', 'children'].includes(id)).map(([id, v]) => [
        id,
        id === 'commune' ? 'Wil' : v,
      ]),
    );
    await answer([
      ['church:p2', 'none'],
      ['income_sources:p2', ['salary']],
      ['employers:p2', 1],
      ['taxed_at_source:p2', false],
      ['commute:p2', 'walk'],
      ['meal_days:p2', 0],
      ['pillar3a:p2', false],
      ['lpp_buyin:p2', false],
    ]);
    await confirmed('salary_certificate', 'p1', [['salary.gross', "90'000.00"]]);
    await confirmed('salary_certificate', 'p2', [['salary.gross', "40'000.00"]]);
    await confirmed('childcare_invoice', 'household', [['childcare.costs', "40'000.00"]]);
    const before = (await call('compute_tax')).structuredContent as Omit<TaxOut, 'icc'> & {
      icc: null;
    };
    expect(before.icc).toBeNull();
    expect(before.unsupported.join(' ')).toMatch(/limit is per child/);
    await answer([
      ['child_care:child1', 30_000],
      ['child_care:child2', 10_000],
    ]);
    const after = (await call('compute_tax', { detail: true })).structuredContent as {
      detail: { iccItems: { code: string; amount: number }[] };
    };
    // At most the limit per child (26,800 in 2026, sg-2026-guide-merkblatt-unterjaehrig p. 4)
    // for the first, all of it for the second.
    expect(after.detail.iccItems.find((i) => i.code === '258')?.amount).toBe(-3_680_000);
  });

  it('fails closed where its rules do: the Jewish community’s church tax', async () => {
    await answer([['canton', 'SG'], ...BRUNNER]);
    await confirmed('salary_certificate', 'p1', [['salary.gross', "82'000.00"]]);
    const saved = await call('answer_question', { id: 'church:p1', value: 'jewish' });
    expect(texts(saved)).toMatch(/Not supported yet/);
    const out = (await call('compute_tax')).structuredContent as Omit<TaxOut, 'icc'> & {
      icc: null;
    };
    expect(out.icc).toBeNull();
    expect(out.unsupported.join(' ')).toMatch(/Jewish community/);
  });

  it('runs the final check with St. Gallen’s lines, software and terms', async () => {
    await steiner();
    await ws.setPlan('p2', 'plan.gross_salary', 48_000, 'chat');
    const res = await call('final_check');
    const out = res.structuredContent as FinalCheckState;
    // The 3a of person 1 is at the cap in both taxes: said once, for both.
    const pillar = out.know.find((i) => i.kind === 'limit' && i.code === '208');
    expect(pillar?.title).toMatch(/Säule 3a/);
    expect(pillar?.title).toMatch(/Kantons-, Gemeinde- und direkte Bundessteuer/);
    expect(pillar?.detail).toMatch(/^Paid into pillar 3a \(Säule 3a\): CHF 7’258\.00/);
    const pdf = out.know.find((i) => i.kind === 'official_pdf');
    expect(pdf?.detail).toMatch(/Taxpresso checks Geneva declarations only/);
    expect(out.know.some((i) => i.kind === 'form_provisional')).toBe(true);
    expect(texts(res)).not.toMatch(/GeTax|ZHprivateTax|TaxMe|E-Tax BL|eTax\.zug/);
    for (const i of [...out.fix, ...out.know]) {
      for (const src of i.sources) {
        if (src.id.startsWith('sg-')) expect(src.url, src.id).toMatch(/^https:\/\//);
      }
    }
  });

  it('plans 3a, a buy-in and the 3a catch-up on St. Gallen’s tax, and keeps TOU Geneva’s', async () => {
    await answer([['canton', 'SG'], ...BRUNNER]);
    await confirmed('salary_certificate', 'p1', [
      ['salary.base', "82'000.00"],
      ['salary.gross', "82'000.00"],
      ['salary.social_contributions', "5'250.00"],
      ['salary.lpp_ordinary', "4'100.00"],
    ]);
    await ws.setPlan('p1', 'plan.gross_salary', 82_000, 'chat');
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
    expect(out.pillar3a.assumptions).toContain('sg_preview');
    expect(out.pillar3a.assumptions).not.toContain('sg_commune_default');
    expect(out.pillar3a.sources.join(' ')).toMatch(/sg-2026-/);
    expect(out.lppBuyIn.saving?.cantonalCentimes).toBeGreaterThan(0);
    // St. Gallen deducts the 3a catch-up from the 2026 return: a saving.
    expect(out.pillar3aCatchUp.saving?.totalCentimes).toBeGreaterThan(0);
    expect(out.tou.applies).toBe(false);
    const text = texts(res);
    expect(text).toMatch(/pillar 3a \(Säule 3a\)/);
    expect(text).toMatch(/Säule 2 \(BVG\) inkl\. Einkaufsbeiträge/);
    expect(text).toMatch(/For St\. Gallen, taxation at source \(Quellensteuer\)/);
    expect(text).toMatch(/St\. Gallen is a preview/);
    const decided = await call('decide_optimization', {
      id: 'tou',
      choice: 'decline',
      confirmed: false,
    });
    expect(decided.isError).toBe(true);
    expect(texts(decided)).toMatch(/TOU is Geneva’s procedure\. For St\. Gallen/);
  });

  it('gives the values to type form by form, in the chat and the dashboard', async () => {
    await steiner();
    const list = await call('get_form_values');
    const out = list.structuredContent as { sections: { page: string }[]; provisional: boolean };
    expect(out.sections.map((s) => s.page)).toEqual(
      expect.arrayContaining(['F4-1', 'F4-2', 'S2', 'S3']),
    );
    expect(out.provisional).toBe(true);
    expect(texts(list)).toMatch(/E-Tax SG/);
    const page3 = await call('get_form_values', { section: 'S3' });
    expect(texts(page3)).toMatch(/208 13\.1 Säule 3a, Person 1/);
    const panel = (await state('fr')).copyPanel;
    expect(panel.unplaced).toEqual([]);
    expect(panel.total).toBeGreaterThan(0);
    // The PDF check is Geneva's only: said plainly, in both places.
    const pdf = await call('reconcile_official_pdf');
    expect(texts(pdf)).toMatch(/reads Geneva declarations only/);
    expect(texts(pdf)).toMatch(/E-Tax SG/);
    expect((await state()).declarationCheck.status).toBe('not_available');
  });

  it('gives the same federal tax as Geneva, Zurich, Bern, Basel-Landschaft and Zug for the same household', async () => {
    await brunner('SG');
    const sg = (await call('compute_tax')).structuredContent as TaxOut;
    expect(sg.icc.church).toBeNull();
    expect(sg.icc.splitting).toBe(false);
    const federal: TaxOut['ifd'][] = [];
    for (const canton of ['GE', 'ZH', 'BE', 'BL', 'ZG'] as const) {
      await client.close();
      await dashboard.stop();
      await connect();
      await brunner(canton);
      const other = (await call('compute_tax')).structuredContent as TaxOut;
      expect(other.computed, canton).toBe(true);
      federal.push(other.ifd);
    }
    for (const other of federal) {
      expect(other.taxableIncome).toBe(sg.ifd.taxableIncome);
      expect(other.tax).toBe(sg.ifd.tax);
    }
  });
});
