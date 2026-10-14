// An Aargau return end to end through the extension (docs/design/cantons.md, "As built: Aargau"):
// the questions, the estimate (cantonal, communal and church tax, and the federal tax, which the
// Aargau return leaves to the tax office) for Claude (compute_tax) and the dashboard, the final
// check, the plans and the values to type. Synthetic households on a temporary vault, never the real
// one: the Keller family in Baden and Lea Huber, single, in Aarau.
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
    Buffer.from(`%PDF-1.7 synthetic Aargau document ${n}`),
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
 * The Keller family of Baden: two salaries, two children (one under 14, one 14 to 17), a crèche
 * for the younger one, both Roman Catholic, in Baden's own parish.
 */
async function keller(church: [string, string] = ['catholic', 'catholic'], parish = true) {
  await answer([
    ['canton', 'AG'],
    ['civil_status', 'married'],
    ['children', 2],
    ['children_custody', 'with_household'],
    ['child_band:child1', 'under14'],
    ['child_band:child2', 'under18'],
    ['childcare', 'creche_or_daycare'],
    ['child_care:child1', 9_000],
    ['child_care:child2', 0],
    ['commune', 'Baden'],
    ['moved', 'no'],
    ['church:p1', church[0]],
    ['church:p2', church[1]],
    ...(parish ? ([['parish', 'baden:Baden']] as [string, unknown][]) : []),
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
    ['commute_transit_cost:p1', 1_200],
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
  await confirmed('childcare_invoice', 'household', [['childcare.costs', "9'000.00"]]);
  await confirmed('donation_receipt', 'household', [['donation.amount', "1'200.00"]]);
}

/** Lea Huber, single, in Aarau: one salary, on foot to work, 3a, no church. */
const HUBER: [string, unknown][] = [
  ['civil_status', 'single'],
  ['children', 0],
  ['commune', 'Aarau'],
  ['moved', 'no'],
  ['church:p1', 'none'],
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
];

type Canton = 'AG' | 'BL' | 'BE' | 'GE' | 'ZH' | 'VD';

async function huber(canton: Canton = 'AG') {
  const commune = {
    AG: 'Aarau',
    BL: 'Liestal',
    BE: 'Biel/Bienne',
    ZH: 'Zürich',
    GE: 'Vernier',
    VD: 'Lausanne',
  }[canton];
  // Geneva and Vaud ask no church; Bern asks your own household too; Vaud the rent.
  const asked = ([id]: [string, unknown]) =>
    !(canton === 'GE' || canton === 'VD') || !id.startsWith('church');
  await answer([
    ['canton', canton],
    ...HUBER.filter(asked).flatMap(([id, v]): [string, unknown][] => [
      [id, id === 'commune' ? commune : v],
      ...(canton === 'BE' && id === 'civil_status'
        ? [['own_household', true] as [string, unknown]]
        : []),
    ]),
    ...(canton === 'VD'
      ? ([
          ['rent', 10_000],
          ['contents_high', false],
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
  await confirmed('health_premiums', 'household', [['health.premiums', "4'800.00"]]);
}

interface TaxOut {
  computed: boolean;
  canton?: string;
  commune: { bfs: number | null; name: string; rate: number | null };
  total: number;
  icc: {
    total: number;
    cantonal: number;
    communal: number;
    church: number | null;
    maxBurden: number | null;
    simpleIncome: number;
    simpleWealth: number;
    taxableIncome: number;
    taxableWealth: number;
    tariff: 'A' | 'B';
  };
  ifd: { tax: number; taxableIncome: number; scale: string };
  unverifiedRules: string[];
  unsupported: string[];
  notSupported: string[];
}

describe('an Aargau return', () => {
  it('asks Aargau’s questions, then computes every tax and the federal tax', async () => {
    await keller();
    const status = await call('get_status');
    expect(status.structuredContent).toMatchObject({ canton: 'AG' });
    expect(texts(status)).toMatch(/tax year 2026, Aargau/);
    expect(ws.snapshot().slots.filter((s) => s.value === undefined)).toEqual([]);

    const res = await call('compute_tax');
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, canton: 'AG' });
    expect(out.commune).toMatchObject({ bfs: null, name: 'Baden' });
    // Married with two children: Tarif B, the Roman Catholic church tax of Baden's own parish.
    expect(out.icc.tariff).toBe('B');
    expect(out.icc.church).toBeGreaterThan(0);
    expect(out.icc.total).toBe(
      out.icc.cantonal + out.icc.communal + (out.icc.church ?? 0) + (out.icc.maxBurden ?? 0),
    );
    expect(out.ifd.scale).toBe('married');
    expect(out.total).toBe(out.icc.total + out.ifd.tax);
    expect(out.unverifiedRules.length).toBeGreaterThan(0);
    expect(out.unsupported).toEqual([]);
    expect(out.notSupported).toEqual([]);
    const text = texts(res);
    expect(text).toMatch(/canton of Aargau, commune Baden \(Steuerfuss \d+ % of the simple tax\)/);
    expect(text).toMatch(/Kantons-, Gemeinde- und Kirchensteuern/);
    expect(text).toMatch(/Kirchensteuer/);
    expect(text).toMatch(/direkte Bundessteuer/);
    expect(text).toMatch(/the Aargau return has no federal column/);
    expect(text).toMatch(/Aargau is a preview/);

    // With detail, every item with its source, the federal ones on the same lines.
    const detail = await call('compute_tax', { detail: true });
    const d = (detail.structuredContent as { detail: Record<string, { code: string }[]> }).detail;
    expect(d.iccItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining(['1.1', '10.1', '10.2', '13.2', '14', '15.0', '15.3', '16', '19.1']),
    );
    expect(d.ifdItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining(['1.1', '13.2', '14', '15.0', '16', 'bund-ehepaar', '19.1']),
    );
    expect(texts(detail)).toMatch(/- Bund bund-ehepaar Abzug für Verheiratete/);
  });

  it('leads with one next step and the five stages, as every canton does', async () => {
    await keller();
    const status = (await call('get_status')).structuredContent as {
      next: { id: string; stage: string | null };
      stages: { id: string; status: string }[];
    };
    expect(status.stages.map((x) => x.id)).toEqual(['about', 'documents', 'tax', 'save', 'file']);
    expect(status.stages.find((x) => x.id === 'about')?.status).toBe('done');
    // Computed from the confirmed salary certificates, not an estimate.
    expect(status.stages.find((x) => x.id === 'tax')?.status).toBe('computed');
    // The dashboard leads with the same single next step.
    const s = await state();
    expect(s.journey.next.id).toBe(status.next.id);
    expect(s.journey.stages.map((x) => x.id)).toEqual(status.stages.map((x) => x.id));
  });

  it('shows the estimate in the dashboard, in the official German terms', async () => {
    await keller();
    const s = await state('fr');
    expect(s.canton).toMatchObject({ code: 'AG', name: 'Argovie' });
    const est = s.estimate as
      (DashboardState['estimate'] & { canton?: string; unverified?: string[] }) | undefined;
    expect(est?.computed).toBe(true);
    if (!est?.computed) return;
    expect(est.canton).toBe('AG');
    expect(est.rows.map((r) => r.label)).toEqual([
      'Impôts cantonal, communal et ecclésiastique (Kantons-, Gemeinde- und Kirchensteuern)',
      'Impôt fédéral direct (direkte Bundessteuer)',
    ]);
    expect(est.parts.map((r) => r.id)).toEqual(['cantonal', 'communal', 'church']);
    expect(est.unverified?.length).toBeGreaterThan(0);
    expect(est.lastYear).toEqual([]);
    const de = await state('de');
    const estDe = de.estimate;
    if (!estDe?.computed) throw new Error('not computed');
    expect(estDe.rows.map((r) => r.label)).toEqual([
      'Kantons-, Gemeinde- und Kirchensteuern',
      'Direkte Bundessteuer',
    ]);
    expect(estDe.items.find((i) => i.code === '13.2')?.label).toBe('Beiträge Säule 3a');
  });

  it('asks Aargau’s own questions only where they apply', async () => {
    await answer([
      ['canton', 'AG'],
      ['civil_status', 'divorced'],
      ['children', 2],
      ['children_custody', 'shared'],
      ['child_support', 'none_i_earn_more'],
    ]);
    // Shared custody without child support: who mainly bears the upkeep; each child's age band.
    expect(ws.next()?.id).toBe('main_upkeep');
    await answer([['main_upkeep', true]]);
    const ids = ws.snapshot().slots.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['child_band:child1', 'child_band:child2']));
    await answer([
      ['child_band:child1', 'under14'],
      ['child_band:child2', 'adult'],
      ['childcare', 'none'],
      ['commune', 'Aarau'],
      ['moved', 'no'],
      ['church:p1', 'reformed'],
    ]);
    // Aarau has a further Reformed parish (ref. Kirche Rohr): which one?
    expect(ws.next()?.id).toBe('parish');
    const q = await call('next_questions');
    expect(texts(q)).toMatch(/aarau:ref\. Kirche Rohr = Aarau: ref\. Kirche Rohr/);
    expect(texts(q)).not.toMatch(/\{n\}/);
    await answer([['parish', 'aarau:ref. Kirche Rohr']]);
    expect(ws.ledger.get('ag.parish')?.value).toBe('aarau:ref. Kirche Rohr');
    expect(ws.ledger.get('ag.main_upkeep')?.value).toBe(true);
    expect(ws.ledger.get('ag.child_band', 'child2')?.value).toBe('adult');
  });

  it('fails closed where its rules do: spouses of different churches, a parish not said', async () => {
    await keller(['catholic', 'reformed']);
    const out = (await call('compute_tax')).structuredContent as Omit<TaxOut, 'icc'> & {
      icc: null;
    };
    expect(out.computed).toBe(true);
    expect(out.icc).toBeNull();
    expect(out.unsupported.join(' ')).toMatch(/different churches/);
    const s = await state();
    expect(s.estimate?.computed).toBe(true);
  });

  it('asks the parish before computing the church tax of a commune with a further parish', async () => {
    await keller(['catholic', 'catholic'], false);
    expect(ws.next()?.id).toBe('parish');
    const out = (await call('compute_tax')).structuredContent as Omit<TaxOut, 'icc'> & {
      icc: null;
    };
    expect(out.icc).toBeNull();
    expect(out.unsupported.join(' ')).toMatch(/further parish of your church \(Zusatzkirche\)/);
  });

  it('runs the final check with Aargau’s lines, software and terms', async () => {
    await keller();
    await ws.setPlan('p2', 'plan.gross_salary', 46_000, 'chat');
    const res = await call('final_check');
    const out = res.structuredContent as FinalCheckState;
    // The 3a of person 1 is at the cap in both taxes: said once, for both.
    const pillar = out.know.find((i) => i.kind === 'limit' && i.code === '13.2');
    expect(pillar?.title).toMatch(/Beiträge Säule 3a/);
    expect(pillar?.title).toMatch(/Kantons- und Gemeindesteuern und direkte Bundessteuer/);
    expect(pillar?.detail).toMatch(/^Paid into pillar 3a \(Beiträge Säule 3a\): CHF 7’258\.00/);
    const pdf = out.know.find((i) => i.kind === 'official_pdf');
    expect(pdf?.detail).toMatch(/Taxpresso checks Geneva declarations only/);
    expect(out.know.some((i) => i.kind === 'form_provisional')).toBe(true);
    expect(texts(res)).not.toMatch(/GeTax|ZHprivateTax|TaxMe|E-Tax BL|VaudTax/);
    for (const i of [...out.fix, ...out.know]) {
      for (const src of i.sources) {
        if (src.id.startsWith('ag-')) expect(src.url, src.id).toMatch(/^https:\/\//);
      }
    }
  });

  it('plans 3a, a buy-in and the 3a catch-up on Aargau’s tax, and keeps TOU Geneva’s', async () => {
    await answer([['canton', 'AG'], ...HUBER]);
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
    expect(out.pillar3a.assumptions).toContain('ag_preview');
    expect(out.pillar3a.assumptions).not.toContain('ag_commune_default');
    expect(out.pillar3a.sources.join(' ')).toMatch(/ag-2026-communal-steuerfuesse/);
    expect(out.lppBuyIn.saving?.cantonalCentimes).toBeGreaterThan(0);
    // The federal 3a limits, which StG § 40 Abs. 1 lit. e takes over, catch-up included: a saving.
    expect(out.pillar3aCatchUp.saving?.totalCentimes).toBeGreaterThan(0);
    expect(out.tou.applies).toBe(false);
    const text = texts(res);
    expect(text).toMatch(/pillar 3a \(Säule 3a\)/);
    expect(text).toMatch(/Einkäufe Säule 2/);
    expect(text).toMatch(/For Aargau, taxation at source \(Quellensteuer\)/);
    expect(text).toMatch(/Aargau is a preview/);
    const decided = await call('decide_optimization', {
      id: 'tou',
      choice: 'decline',
      confirmed: false,
    });
    expect(decided.isError).toBe(true);
    expect(texts(decided)).toMatch(/TOU is Geneva’s procedure\. For Aargau/);
  });

  it('gives the values to type, with the codes to check against the form or eTAX AARGAU', async () => {
    await keller();
    const list = await call('get_form_values');
    const out = list.structuredContent as { sections: { page: string }[]; provisional: boolean };
    expect(out.sections.map((s) => s.page)).toEqual(expect.arrayContaining(['EK', 'AB', 'SO']));
    expect(out.provisional).toBe(true);
    expect(texts(list)).toMatch(/eTAX AARGAU/);
    expect(texts(list)).toMatch(/check each against the form or eTAX AARGAU/);
    const page = await call('get_form_values', { section: 'AB' });
    expect(texts(page)).toMatch(/13\.2 Beiträge Säule 3a, Person 1/);
    const panel = (await state('fr')).copyPanel;
    expect(panel.unplaced).toEqual([]);
    expect(panel.total).toBeGreaterThan(0);
    expect(panel.provisional).toBe(true);
    // The dashboard keeps the note on the form for when it is filled in, after the year ends
    // (docs/design/simple.md); the chat's values to type say it now.
    expect(panel.note).toBeUndefined();
    expect(texts(list)).toMatch(/101\.01/);
    // The PDF check is Geneva's only: said plainly, in both places.
    const pdf = await call('reconcile_official_pdf');
    expect(texts(pdf)).toMatch(/reads Geneva declarations only/);
    expect(texts(pdf)).toMatch(/eTAX AARGAU/);
    expect((await state()).declarationCheck.status).toBe('not_available');
  });

  it('gives the same federal tax as Geneva, Zurich, Bern, Basel-Landschaft and Vaud for the same household', async () => {
    await huber('AG');
    const ag = (await call('compute_tax')).structuredContent as TaxOut;
    expect(ag.icc.church).toBeNull();
    expect(ag.icc.tariff).toBe('A');
    const federal: TaxOut['ifd'][] = [];
    for (const canton of ['GE', 'ZH', 'BE', 'BL', 'VD'] as const) {
      await client.close();
      await dashboard.stop();
      await connect();
      await huber(canton);
      const out = (await call('compute_tax')).structuredContent as TaxOut;
      expect(out.computed, canton).toBe(true);
      expect(out.ifd, canton).not.toBeNull();
      federal.push(out.ifd);
    }
    for (const other of federal) {
      expect(other.taxableIncome).toBe(ag.ifd.taxableIncome);
      expect(other.tax).toBe(ag.ifd.tax);
    }
  });
});
