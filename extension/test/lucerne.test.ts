// A Lucerne return end to end through the extension (docs/design/cantons.md, "As built: Lucerne"):
// the questions, the estimate (the state, communal and church tax with the Personalsteuer, and the
// federal tax as the Ergänzungsblatt derives it from the return) for Claude (compute_tax) and the
// dashboard, the final check, the plans and the values to type. Synthetic households on a temporary
// vault, never the real one: the Meier family in Kriens and Anna Huber, single, in Luzern.
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
    Buffer.from(`%PDF-1.7 synthetic Lucerne document ${n}`),
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
 * The Meier family of Kriens: two salaries, two children (16 and 3) living with them, a crèche for
 * the younger, person 1 Roman Catholic, person 2 Evangelical Reformed, the children one each.
 */
async function meier(childChurch: [string, string] = ['catholic', 'reformed']) {
  await answer([
    ['canton', 'LU'],
    ['civil_status', 'married'],
    ['children', 2],
    ['children_custody', 'with_household'],
    ['child_lives_with_you:child1', true],
    ['child_lives_with_you:child2', true],
    ['child_under14:child1', false],
    ['child_away:child1', false],
    ['child_under14:child2', true],
    ['childcare', 'creche_or_daycare'],
    ['child_care:child1', 0],
    ['child_care:child2', 12_000],
    ['commune', 'Kriens'],
    ['moved', 'no'],
    ['church:p1', 'catholic'],
    ['church:p2', 'reformed'],
    ['child_church:child1', childChurch[0]],
    ['child_church:child2', childChurch[1]],
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
    ['commute_transit_cost:p1', 900],
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
  await confirmed('childcare_invoice', 'household', [['childcare.costs', "12'000.00"]]);
  await confirmed('donation_receipt', 'household', [['donation.amount', "1'500.00"]]);
}

/** Anna Huber, single, in Luzern: one salary, 3a, no church. */
const HUBER: [string, unknown][] = [
  ['civil_status', 'single'],
  ['children', 0],
  ['commune', 'Luzern'],
  ['moved', 'no'],
  ['church:p1', 'none'],
  ['income_sources:p1', ['salary']],
  ['employers:p1', 1],
  ['residence:p1', 'swiss'],
  ['pillar3a:p1', true],
  ['lpp_buyin:p1', false],
  ['commute:p1', 'public_transport'],
  ['commute_transit_cost:p1', 900],
  ['meal_days:p1', 180],
  ['banks', 0],
  ['crypto', false],
  ['payments', []],
  ['special', []],
];

type Canton = 'LU' | 'ZG' | 'BL' | 'BE' | 'GE' | 'ZH';

async function huber(canton: Canton = 'LU') {
  const commune = {
    LU: 'Luzern',
    ZG: 'Zug',
    BL: 'Liestal',
    BE: 'Biel/Bienne',
    ZH: 'Zürich',
    GE: 'Vernier',
  }[canton];
  // Geneva asks no church; Zug asks the rent and the Bürgergemeinde too; Bern your own household.
  await answer([
    ['canton', canton],
    ...HUBER.filter(([id]) => canton !== 'GE' || !id.startsWith('church')).flatMap(
      ([id, v]): [string, unknown][] => [
        [id, id === 'commune' ? commune : v],
        ...(canton === 'BE' && id === 'civil_status'
          ? [['own_household', true] as [string, unknown]]
          : []),
        ...(canton === 'ZG' && id === 'church:p1'
          ? ([
              ['rent', 24_000],
              ['citizen_of:p1', 'none'],
            ] as [string, unknown][])
          : []),
      ],
    ),
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
    perUnit: number;
    cantonal: number;
    communal: number;
    church: number | null;
    personal: number;
    maximumBurden: number;
    taxableIncome: number;
    taxableWealth: number;
    tariff: string;
  };
  ifd: { tax: number; taxableIncome: number; scale: string };
  unverifiedRules: string[];
  unsupported: string[];
  notSupported: string[];
}

describe('a Lucerne return', () => {
  it('asks Lucerne’s questions, then computes every tax and the federal tax', async () => {
    await meier();
    const status = await call('get_status');
    expect(status.structuredContent).toMatchObject({ canton: 'LU' });
    expect(texts(status)).toMatch(/tax year 2026, Lucerne/);
    expect(ws.snapshot().slots.filter((s) => s.value === undefined)).toEqual([]);

    const res = await call('compute_tax');
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, canton: 'LU' });
    expect(out.commune).toMatchObject({ bfs: null, name: 'Kriens' });
    // Married with two children: the family tariff, the church tax shared between the Roman
    // Catholic and the Reformed parish of Kriens by the family's members, the Personalsteuer.
    expect(out.icc.tariff).toBe('family');
    expect(out.icc.church).toBeGreaterThan(0);
    expect(out.icc.personal).toBe(5_000);
    expect(out.icc.total).toBe(
      out.icc.cantonal +
        out.icc.communal +
        (out.icc.church ?? 0) +
        out.icc.maximumBurden +
        out.icc.personal,
    );
    expect(out.ifd.scale).toBe('married');
    expect(out.total).toBe(out.icc.total + out.ifd.tax);
    expect(out.unverifiedRules.join(' ')).toMatch(/StG § 240 Abs\. 2/);
    expect(out.unsupported).toEqual([]);
    expect(out.notSupported).toEqual([]);
    const text = texts(res);
    expect(text).toMatch(/canton of Lucerne, commune Kriens \(it levies [\d.]+ units/);
    expect(text).toMatch(/Staats- und Gemeindesteuern/);
    expect(text).toMatch(/Kirchensteuer/);
    expect(text).toMatch(/Personalsteuer/);
    expect(text).toMatch(/direkte Bundessteuer/);
    expect(text).toMatch(/Ergänzungsblatt Direkte Bundessteuer/);
    expect(text).toMatch(/Lucerne is a preview/);

    // With detail, every item with its source: the return's lines and the Ergänzungsblatt's.
    const detail = await call('compute_tax', { detail: true });
    const d = (detail.structuredContent as { detail: Record<string, { code: string }[]> }).detail;
    expect(d.iccItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        '100',
        '101',
        '208t',
        '209t',
        '212',
        '220',
        '221',
        '260',
        '270',
        '324',
        '326',
        '350',
        '353',
        '360',
      ]),
    );
    expect(d.ifdItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining(['E1', 'E2', 'E3', 'E5', 'E8', 'E10', 'E15', 'E17', 'E20', 'E22']),
    );
    expect(texts(detail)).toMatch(/- Ergänzungsblatt E22 Abzug für Ehegatten/);
  });

  it('shows the estimate in the dashboard, in the official German terms', async () => {
    await meier();
    const s = await state('fr');
    expect(s.canton).toMatchObject({ code: 'LU', name: 'Lucerne' });
    const est = s.estimate as
      (DashboardState['estimate'] & { canton?: string; unverified?: string[] }) | undefined;
    expect(est?.computed).toBe(true);
    if (!est?.computed) return;
    expect(est.canton).toBe('LU');
    expect(est.rows.map((r) => r.label)).toEqual([
      'Impôts cantonal et communal (Staats- und Gemeindesteuern)',
      'Impôt fédéral direct (direkte Bundessteuer)',
    ]);
    expect(est.parts.map((r) => r.id)).toEqual(['cantonal', 'communal', 'church', 'personal']);
    expect(est.unverified?.length).toBeGreaterThan(0);
    expect(est.lastYear).toEqual([]);
    const de = await state('de');
    expect(de.canton).toMatchObject({ code: 'LU', name: 'Luzern' });
    const estDe = de.estimate;
    if (!estDe?.computed) throw new Error('not computed');
    expect(estDe.rows.map((r) => r.label)).toEqual([
      'Staats- und Gemeindesteuern',
      'Direkte Bundessteuer',
    ]);
    expect(estDe.items.find((i) => i.code === '100')?.label).toBe('Haupterwerb Person 1');
  });

  it('asks Lucerne’s own questions only where they apply', async () => {
    await answer([
      ['canton', 'LU'],
      ['civil_status', 'divorced'],
      ['children', 2],
      ['children_custody', 'shared'],
      ['child_support', 'none_i_earn_more'],
    ]);
    // Shared custody without child support: the family tariff; then each child's household.
    expect(ws.next()?.id).toBe('family_tariff');
    await answer([['family_tariff', true]]);
    const ids = ws.snapshot().slots.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining(['child_lives_with_you:child1', 'child_lives_with_you:child2']),
    );
    await answer([
      ['child_lives_with_you:child1', true],
      ['child_lives_with_you:child2', true],
      ['child_under14:child1', true],
      ['child_under14:child2', false],
    ]);
    // Away for its education only for the child of 14 or more.
    expect(
      ws
        .snapshot()
        .slots.filter((s) => s.id.startsWith('child_away'))
        .map((s) => s.id),
    ).toEqual(['child_away:child2']);
    await answer([
      ['child_away:child2', true],
      ['childcare', 'none'],
      ['commune', 'Escholzmatt-Marbach'],
      ['moved', 'no'],
    ]);
    // Each adult's confession, then each child's.
    expect(ws.next()?.id).toBe('church:p1');
    const q = await call('next_questions');
    expect(texts(q)).toMatch(/Kirchensteuer/);
    await answer([['church:p1', 'christ_catholic']]);
    expect(ws.next()?.id).toBe('child_church:child1');
    await answer([
      ['child_church:child1', 'christ_catholic'],
      ['child_church:child2', 'none'],
    ]);
    expect(ws.ledger.get('profile.commune')?.value).toBe('escholzmatt-marbach');
    expect(ws.ledger.get('lu.family_tariff')?.value).toBe(true);
    expect(ws.ledger.get('lu.child_away', 'child2')?.value).toBe(true);
    expect(ws.ledger.get('lu.child_church', 'child1')?.value).toBe('christ_catholic');
  });

  it('asks the childcare per child when it decides the deduction, and computes it then', async () => {
    await answer([
      ['canton', 'LU'],
      ['civil_status', 'married'],
      ['children', 2],
      ['children_custody', 'with_household'],
      ['child_lives_with_you:child1', true],
      ['child_lives_with_you:child2', true],
      ['child_under14:child1', true],
      ['child_under14:child2', true],
      ['childcare', 'creche_or_daycare'],
    ]);
    // Skip the split for now: the household's 30,000 for two children under 14 is above one
    // child's limit, so how it splits decides the deduction (fail closed).
    await call('skip_question', { id: 'child_care:child1' });
    await call('skip_question', { id: 'child_care:child2' });
    await answer(
      HUBER.filter(([id]) => !['civil_status', 'children'].includes(id)).map(([id, v]) => [id, v]),
    );
    await answer([
      ['church:p2', 'none'],
      ['child_church:child1', 'none'],
      ['child_church:child2', 'none'],
      ['income_sources:p2', ['salary']],
      ['employers:p2', 1],
      ['pillar3a:p2', false],
      ['lpp_buyin:p2', false],
      ['commute:p2', 'walk'],
      ['meal_days:p2', 0],
    ]);
    await confirmed('salary_certificate', 'p1', [['salary.gross', "90'000.00"]]);
    await confirmed('salary_certificate', 'p2', [['salary.gross', "40'000.00"]]);
    await confirmed('childcare_invoice', 'household', [['childcare.costs', "30'000.00"]]);
    const before = (await call('compute_tax')).structuredContent as Omit<TaxOut, 'icc'> & {
      icc: null;
    };
    expect(before.icc).toBeNull();
    expect(before.unsupported.join(' ')).toMatch(/limit is per child/);
    await answer([
      ['child_care:child1', 20_000],
      ['child_care:child2', 10_000],
    ]);
    const after = (await call('compute_tax', { detail: true })).structuredContent as {
      detail: { iccItems: { code: string; amount: number }[] };
    };
    const at = (code: string) => after.detail.iccItems.find((i) => i.code === code)?.amount;
    // 2026: own care 2,000 each, and childcare up to 18,200 per child on top.
    expect(at('353')).toBe(-400_000);
    expect(at('360')).toBe(-(1_820_000 + 1_000_000));
  });

  it('fails closed where its rules do: a child’s confession not answered', async () => {
    await answer([
      ['canton', 'LU'],
      ['civil_status', 'single'],
      ['children', 1],
      ['children_custody', 'with_household'],
      ['child_lives_with_you:child1', true],
      ['child_under14:child1', true],
      ['childcare', 'none'],
      ['commune', 'Luzern'],
      ['moved', 'no'],
      ['church:p1', 'catholic'],
    ]);
    await call('skip_question', { id: 'child_church:child1' });
    await confirmed('salary_certificate', 'p1', [['salary.gross', "70'000.00"]]);
    const out = (await call('compute_tax')).structuredContent as Omit<TaxOut, 'icc'> & {
      icc: null;
    };
    expect(out.computed).toBe(true);
    expect(out.icc).toBeNull();
    expect(out.unsupported.join(' ')).toMatch(/each child’s confession/);
    const s = await state();
    expect(s.estimate?.computed).toBe(true);
  });

  it('runs the final check with Lucerne’s lines, software and terms', async () => {
    await meier();
    await ws.setPlan('p2', 'plan.gross_salary', 52_000, 'chat');
    const res = await call('final_check');
    const out = res.structuredContent as FinalCheckState;
    // The 3a of person 1 is at the cap, the same in both taxes: said once, for both.
    const pillar = out.know.find((i) => i.kind === 'limit' && i.code === '260');
    expect(pillar?.title).toMatch(/Säule 3a/);
    expect(pillar?.title).toMatch(/Staats- und Gemeindesteuern und direkte Bundessteuer/);
    const pdf = out.know.find((i) => i.kind === 'official_pdf');
    expect(pdf?.detail).toMatch(/Taxpresso checks Geneva declarations only/);
    expect(out.know.some((i) => i.kind === 'form_provisional')).toBe(true);
    expect(texts(res)).not.toMatch(/GeTax|ZHprivateTax|TaxMe|E-Tax BL|eTax\.zug/);
    for (const i of [...out.fix, ...out.know]) {
      for (const src of i.sources) {
        if (src.id.startsWith('lu-')) expect(src.url, src.id).toMatch(/^https:\/\//);
      }
    }
  });

  it('plans 3a and a buy-in on Lucerne’s tax, no catch-up saving, and keeps TOU Geneva’s', async () => {
    await answer([['canton', 'LU'], ...HUBER]);
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
    expect(out.pillar3a.assumptions).toContain('lu_preview');
    expect(out.pillar3a.assumptions).not.toContain('lu_commune_default');
    expect(out.pillar3a.sources.join(' ')).toMatch(/lu-2026-/);
    expect(out.lppBuyIn.saving?.cantonalCentimes).toBeGreaterThan(0);
    // No Lucerne document gives the cantonal rule of a 3a catch-up: no saving (fail closed).
    expect(out.pillar3aCatchUp.saving).toBeUndefined();
    expect(out.pillar3aCatchUp.assumptions).toContain('lu_catchup_rule');
    expect(out.tou.applies).toBe(false);
    const text = texts(res);
    expect(text).toMatch(/pillar 3a \(Säule 3a\)/);
    expect(text).toMatch(/Beiträge an 2\. Säule \(Einkauf\)/);
    expect(text).toMatch(/No saving shown for Lucerne/);
    expect(text).toMatch(/For Lucerne, taxation at source \(Quellensteuer\)/);
    expect(text).toMatch(/Lucerne is a preview/);
    const decided = await call('decide_optimization', {
      id: 'tou',
      choice: 'decline',
      confirmed: false,
    });
    expect(decided.isError).toBe(true);
    expect(texts(decided)).toMatch(/TOU is Geneva’s procedure\. For Lucerne/);
  });

  it('gives the values to type form by form, in the chat and the dashboard', async () => {
    await meier();
    const list = await call('get_form_values');
    const out = list.structuredContent as { sections: { page: string }[]; provisional: boolean };
    // No wealth to declare: no page 4; the securities list neither (no accounts given).
    expect(out.sections.map((s) => s.page)).toEqual(['B', 'S2', 'S3', 'EB']);
    expect(out.provisional).toBe(true);
    expect(texts(list)).toMatch(/eSteuern\.LU/);
    const page3 = await call('get_form_values', { section: 'S3' });
    expect(texts(page3)).toMatch(
      /260 Beiträge an anerkannte Formen der gebundenen Selbstvorsorge \(Säule 3a\), Person 1/,
    );
    const sheet = await call('get_form_values', { section: 'EB' });
    expect(texts(sheet)).toMatch(/22 Abzug für Ehegatten/);
    const panel = (await state('fr')).copyPanel;
    expect(panel.unplaced).toEqual([]);
    expect(panel.total).toBeGreaterThan(0);
    // The PDF check is Geneva's only: said plainly, in both places.
    const pdf = await call('reconcile_official_pdf');
    expect(texts(pdf)).toMatch(/reads Geneva declarations only/);
    expect(texts(pdf)).toMatch(/eSteuern\.LU/);
    expect((await state()).declarationCheck.status).toBe('not_available');
  });

  it('gives the same federal tax as Geneva, Zurich, Bern, Basel-Landschaft and Zug for the same household', async () => {
    await huber('LU');
    const lu = (await call('compute_tax')).structuredContent as TaxOut;
    expect(lu.icc.church).toBeNull();
    expect(lu.icc.tariff).toBe('single');
    const federal: TaxOut['ifd'][] = [];
    for (const canton of ['GE', 'ZH', 'BE', 'BL', 'ZG'] as const) {
      await client.close();
      await dashboard.stop();
      await connect();
      await huber(canton);
      const out = (await call('compute_tax')).structuredContent as TaxOut;
      expect(out.computed, canton).toBe(true);
      federal.push(out.ifd);
    }
    for (const other of federal) {
      expect(other.taxableIncome).toBe(lu.ifd.taxableIncome);
      expect(other.tax).toBe(lu.ifd.tax);
    }
  });
});
