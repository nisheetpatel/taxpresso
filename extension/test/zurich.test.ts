// A Zurich return end to end through the extension (docs/design/cantons.md): the questions, the
// estimate (cantonal, communal, church and personal tax, and the federal tax of the Bundessteuer
// column) for Claude (compute_tax) and the dashboard, the final check and the plans. Synthetic
// households on a temporary vault, never the real one: the Muster family in Winterthur and Lea
// Beispiel, single, in Zürich.
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
) {
  n += 1;
  const { document } = await ws.addDocument(
    Buffer.from(`%PDF-1.7 synthetic Zurich document ${n}`),
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

/** The Muster family of Winterthur: two salaries, two children in a crèche, one church member. */
async function muster() {
  await answer([
    ['canton', 'ZH'],
    ['civil_status', 'married'],
    ['children', 2],
    ['children_custody', 'with_household'],
    ['childcare', 'creche_or_daycare'],
    ['commune', 'Winterthur'],
    ['moved', 'no'],
    ['church:p1', 'reformed'],
    ['church:p2', 'none'],
    ['income_sources:p1', ['salary']],
    ['income_sources:p2', ['salary']],
    ['employers:p1', 1],
    ['employers:p2', 1],
    ['taxed_at_source:p1', false],
    ['taxed_at_source:p2', false],
    ['pillar3a:p1', true],
    ['pillar3a:p2', false],
    ['lpp_buyin:p1', false],
    ['lpp_buyin:p2', false],
    ['commute:p1', 'public_transport'],
    ['commute_transit_cost:p1', 2_200],
    ['meal_days:p1', 200],
    ['commute:p2', 'bike'],
    ['meal_days:p2', 0],
    ['banks', 0],
    ['crypto', false],
    ['payments', []],
    ['special', []],
  ]);
  await confirmed('salary_certificate', 'p1', [
    ['salary.base', "95'000.00"],
    ['salary.gross', "95'000.00"],
    ['salary.social_contributions', "6'080.00"],
    ['salary.lpp_ordinary', "5'200.00"],
    ['salary.net', "83'720.00"],
  ]);
  await confirmed('salary_certificate', 'p2', [
    ['salary.base', "42'000.00"],
    ['salary.gross', "42'000.00"],
    ['salary.social_contributions', "2'690.00"],
    ['salary.lpp_ordinary', "1'500.00"],
    ['salary.net', "37'810.00"],
  ]);
  await confirmed('pillar3a_attestation', 'p1', [['pillar3a.paid', "7'258.00"]]);
  await confirmed('health_premiums', 'household', [['health.premiums', "11'400.00"]]);
  await confirmed('childcare_invoice', 'household', [['childcare.costs', "14'000.00"]]);
}

/** Lea Beispiel, single, in Zürich: one salary, pillar 3a, the train to work. */
const BEISPIEL: [string, unknown][] = [
  ['civil_status', 'single'],
  ['children', 0],
  ['moved', 'no'],
  ['church:p1', 'none'],
  ['income_sources:p1', ['salary']],
  ['employers:p1', 1],
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

async function beispiel(canton: 'ZH' | 'GE' = 'ZH') {
  await answer([
    ['canton', canton],
    ['commune', canton === 'ZH' ? 'Zürich' : 'Vernier'],
    ...BEISPIEL.filter(([id]) => canton === 'ZH' || !id.startsWith('church')),
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
  commune: { bfs: number; name: string; rate: number | null };
  total: number;
  icc: {
    total: number;
    cantonal: number;
    communal: number;
    church: number | null;
    personalTax: number;
    taxableIncome: number;
    tariff: string;
  };
  ifd: { tax: number; taxableIncome: number; scale: string };
  unverifiedRules: string[];
  notSupported: string[];
}

describe('a Zurich return', () => {
  it('asks Zurich’s questions, then computes every Zurich tax and the federal tax', async () => {
    await muster();
    const status = await call('get_status');
    expect(status.structuredContent).toMatchObject({ canton: 'ZH' });
    expect(ws.snapshot().slots.filter((s) => s.value === undefined)).toEqual([]);

    const res = await call('compute_tax');
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, canton: 'ZH' });
    expect(out.commune).toMatchObject({ bfs: 230, name: 'Winterthur' });
    // Married with children: the married tariff, church tax for the member only.
    expect(out.icc.tariff).toBe('married');
    expect(out.icc.church).toBeGreaterThan(0);
    expect(out.icc.total).toBe(
      out.icc.cantonal + out.icc.communal + (out.icc.church ?? 0) + out.icc.personalTax,
    );
    expect(out.ifd.scale).toBe('married');
    expect(out.total).toBe(out.icc.total + out.ifd.tax);
    // The open points of the preview are said, never hidden.
    expect(out.unverifiedRules.length).toBeGreaterThan(0);
    expect(out.notSupported).toEqual([]);
    const text = texts(res);
    expect(text).toMatch(/canton of Zurich, commune Winterthur \(BFS 230, Steuerfuss \d+ %\)/);
    expect(text).toMatch(/Staats- und Gemeindesteuern/);
    expect(text).toMatch(/Kirchensteuer/);
    expect(text).toMatch(/direkte Bundessteuer/);
    expect(text).toMatch(/Rules the documents don't spell out:/);

    // With detail, every item with its source, in both columns.
    const detail = await call('compute_tax', { detail: true });
    const d = (detail.structuredContent as { detail: Record<string, { code: string }[]> }).detail;
    expect(d.iccItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining(['100', '101', '220', '260', '270', '376', '370']),
    );
    expect(d.ifdItems!.map((i) => i.code)).toEqual(expect.arrayContaining(['100', '101', '365']));
    expect(texts(detail)).toMatch(/- Bund 365 Abzug für Ehegatten/);
  });

  it('shows the estimate in the dashboard, in the official German terms', async () => {
    await muster();
    const s = await state('fr');
    expect(s.canton).toMatchObject({ code: 'ZH', name: 'Zurich' });
    // Zurich's view adds its canton and the preview's notes to Geneva's shape.
    const est = s.estimate as
      (DashboardState['estimate'] & { canton?: string; unverified?: string[] }) | undefined;
    expect(est?.computed).toBe(true);
    if (!est?.computed) return;
    expect(est.canton).toBe('ZH');
    expect(est.rows.map((r) => r.label)).toEqual([
      'Impôt cantonal et communal (Staats- und Gemeindesteuern)',
      'Impôt fédéral direct (direkte Bundessteuer)',
    ]);
    expect(est.parts.map((r) => r.id)).toEqual(['cantonal', 'communal', 'church', 'personal']);
    expect(est.items.some((i) => /\(Kinderdrittbetreuungskosten|fremdbetreute/.test(i.label))).toBe(
      true,
    );
    expect(est.unverified?.length).toBeGreaterThan(0);
    expect(est.lastYear).toEqual([]);
  });

  it('speaks German in the dashboard: the questions, the canton, the documents, the estimate', async () => {
    await answer([['canton', 'ZH']]);
    let s = await state('de');
    expect(s.lang).toBe('de');
    expect(s.canton).toMatchObject({ code: 'ZH', name: 'Zürich' });
    expect(s.question?.text).toMatch(/Zivilstand|verheiratet|ledig/i);
    expect(s.answers[0]).toMatchObject({ answer: 'Kanton Zürich' });
    await muster();
    s = await state('de');
    expect(s.kinds.find((k) => k.value === 'salary_certificate')?.label).toBe('Lohnausweis');
    expect(s.documents.find((d) => d.kind === 'pillar3a_attestation')?.kindLabel).toBe(
      'Bescheinigung Säule 3a',
    );
    const est = s.estimate;
    expect(est?.computed).toBe(true);
    if (!est?.computed) return;
    expect(est.rows.map((r) => r.label)).toEqual([
      'Staats- und Gemeindesteuern',
      'Direkte Bundessteuer',
    ]);
    expect(est.items.find((i) => i.code === '260')?.label).toBe(
      'Beiträge an die 3. Säule a, Person 1',
    );
    // Views with English and French content only show English on a German page.
    expect(s.finalCheck.know.find((i) => i.kind === 'official_pdf')?.detail).toMatch(
      /Geneva declarations only/,
    );
    // Asked for a language Taxpresso doesn't have, the page gets the configured one.
    const res = await createApi(ws)({
      method: 'GET',
      path: '/state',
      query: new URLSearchParams('lang=es'),
      headers: {},
      body: Buffer.from('{}'),
      csrf: 'csrf-token',
    });
    expect((res.body as DashboardState).lang).toBe('en');
  });

  it('runs the final check with Zurich’s lines, software and terms', async () => {
    await muster();
    const res = await call('final_check');
    const out = res.structuredContent as FinalCheckState;
    // The 3a of person 1 is at the cap in both taxes: said once, for both.
    const pillar = out.know.find((i) => i.kind === 'limit' && i.code === '260');
    expect(pillar?.title).toBe(
      '260 Pillar 3a, person 1 (Beiträge an die 3. Säule a), you, cantonal and federal tax (Staats- und Bundessteuer)',
    );
    expect(pillar?.detail).toBe(
      'Paid into pillar 3a (Beiträge an die 3. Säule a): CHF 7’258.00, exactly the limit: all of it is deducted.',
    );
    // The declaration PDF check is Geneva's only: said, not blocking.
    const pdf = out.know.find((i) => i.kind === 'official_pdf');
    expect(pdf?.detail).toMatch(/Taxpresso checks Geneva declarations only/);
    expect(out.know.find((i) => i.kind === 'form_provisional')?.detail).toMatch(
      /2025 Zurich return/,
    );
    expect(out.know.some((i) => i.kind === 'unverified_rule')).toBe(true);
    expect(texts(res)).not.toMatch(/GeTax/);
    // Every Zurich rule cited links to its official document.
    for (const i of [...out.fix, ...out.know]) {
      for (const src of i.sources) {
        if (src.id.startsWith('zh-')) expect(src.url, src.id).toMatch(/^https:\/\//);
      }
    }
    expect((await state()).finalCheck.know.map((i) => i.id)).toEqual(out.know.map((i) => i.id));
  });

  it('plans 3a and a buy-in on Zurich’s tax, and keeps TOU Geneva’s', async () => {
    await muster();
    await ws.setPlan('p1', 'plan.gross_salary', 95_000, 'chat');
    await ws.setPlan('p2', 'plan.gross_salary', 42_000, 'chat');
    await ws.setPlan('p1', 'plan.pillar3a_paid', 7_258, 'chat');
    await ws.setPlan('p2', 'plan.lpp_buyin_amount', 10_000, 'chat');
    await ws.setPlan('p2', 'plan.lpp_buyin_capacity', 40_000, 'chat');
    const res = await call('list_optimizations');
    const out = res.structuredContent as {
      pillar3a: { saving?: { totalCentimes: number }; assumptions: string[]; sources: string[] };
      lppBuyIn: { saving?: { totalCentimes: number; cantonalCentimes: number } };
      tou: { applies: boolean };
    };
    // Person 2 paid no 3a: the room has a saving, on Zurich's tax.
    expect(out.pillar3a.saving?.totalCentimes).toBeGreaterThan(0);
    expect(out.pillar3a.assumptions).toContain('zh_preview');
    expect(out.pillar3a.assumptions).not.toContain('icc_2025_scale');
    expect(out.pillar3a.sources.join(' ')).toMatch(/zh-2026-/);
    expect(out.lppBuyIn.saving?.cantonalCentimes).toBeGreaterThan(0);
    expect(out.tou.applies).toBe(false);
    const text = texts(res);
    expect(text).toMatch(/pillar 3a \(Säule 3a\)/);
    expect(text).toMatch(/Einkauf in die Pensionskasse/);
    expect(text).toMatch(/TOU \(taxation ordinaire ultérieure\) is Geneva’s/);
    const decided = await call('decide_optimization', {
      id: 'tou',
      choice: 'decline',
      confirmed: false,
    });
    expect(decided.isError).toBe(true);
    expect(texts(decided)).toMatch(/TOU is Geneva’s procedure/);
  });

  it('gives the values to type in the Zurich form’s order, in the chat and the dashboard', async () => {
    await muster();
    const list = await call('get_form_values');
    const out = list.structuredContent as { sections: { page: string }[]; provisional: boolean };
    expect(out.sections.map((s) => s.page)).toEqual(['S2', 'BA1', 'BA2', 'VP', 'S3']);
    expect(out.provisional).toBe(true);
    expect(texts(list)).toMatch(/ZHprivateTax/);
    expect(texts(list)).toMatch(/Person 1 is you \(p1\)/);
    const s2 = await call('get_form_values', { section: 'S2' });
    expect(texts(s2)).toMatch(/- 100 Haupterwerb, Person 1 \(.*\) \[CHF ohne Rappen\]: 83720\./);
    const s3 = await call('get_form_values', { section: 's3' });
    expect(texts(s3)).toMatch(
      /- 260 Beiträge an anerkannte Formen der geb\. Selbstvorsorge \(3\. Säule a\), Person 1 .*\[Staatssteuer \+ Bundessteuer\]: 7258\./,
    );
    expect(texts(s3)).toMatch(/- 365 Abzug für Ehegatten \/ Partn\. .*\[Bundessteuer\]: 2800\./);

    // The dashboard's copy panel: the same rows, each with the document it was read from.
    const panel = (await state('fr')).copyPanel;
    expect(panel.unplaced).toEqual([]);
    const row = panel.sections[0]!.groups[0]!.rows[0]!;
    expect(row).toMatchObject({ ref: '100', label: 'Haupterwerb, Person 1', copy: '83720' });
    expect(row.columns[0]!.label).toBe('CHF ohne Rappen');
    expect(row.documents[0]!.filename).toMatch(/^salary_certificate-\d+\.pdf$/);
    // Ticked as typed, then kept while the value doesn't change.
    const api = createApi(ws);
    const res = await api({
      method: 'POST',
      path: '/form/entered',
      query: new URLSearchParams('lang=en'),
      headers: {},
      body: Buffer.from(JSON.stringify({ id: row.id, entered: true })),
      csrf: 'csrf-token',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect((await state()).copyPanel.entered).toBe(1);

    // The PDF check is Geneva's only: said plainly, in both places.
    const pdf = await call('reconcile_official_pdf');
    expect(texts(pdf)).toMatch(/reads Geneva declarations only/);
    expect((await state()).declarationCheck.status).toBe('not_available');
  });

  it('gives the 3a catch-up no Zurich saving: no Zurich document gives its rule yet', async () => {
    await beispiel();
    await ws.setPlan('p1', 'plan.pillar3a_paid_2025', 2_000, 'chat');
    const res = await call('list_optimizations');
    const cu = (
      res.structuredContent as { pillar3aCatchUp: { saving?: unknown; assumptions: string[] } }
    ).pillar3aCatchUp;
    expect(cu.saving).toBeUndefined();
    expect(cu.assumptions).toContain('zh_catchup_rule');
    expect(texts(res)).toMatch(/No saving shown for Zurich/);
  });

  it('gives the same federal tax as Geneva for the same household', async () => {
    await beispiel('ZH');
    const zh = (await call('compute_tax')).structuredContent as TaxOut;
    expect(zh.icc.church).toBeNull();
    expect(zh.icc.tariff).toBe('basic');

    // The same answers and documents, living in Vernier instead.
    await ws.ready();
    const twin = await makeWorkspace();
    const before = ws;
    ws = twin;
    const uiDir = await makeUiDir();
    const board = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(ws) });
    const server = createTaxpressoServer({ workspace: ws, dashboard: board });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const other = new Client({ name: 'test', version: '0' });
    await other.connect(clientSide);
    const previous = client;
    client = other;
    try {
      await beispiel('GE');
      const ge = (await call('compute_tax')).structuredContent as TaxOut;
      expect(ge.ifd.taxableIncome).toBe(zh.ifd.taxableIncome);
      expect(ge.ifd.tax).toBe(zh.ifd.tax);
    } finally {
      await other.close();
      await board.stop();
      client = previous;
      ws = before;
    }
  });
});
