// A Bern return end to end through the extension (docs/design/cantons.md, "As built: Bern"): the
// questions, the estimate (cantonal, communal and church tax, and the federal tax of TaxMe's
// federal summary) for Claude (compute_tax) and the dashboard, the final check, the plans and the
// values to type. Synthetic households on a temporary vault, never the real one: the Beispiel
// family in Köniz and Mia Muster, single, in Biel/Bienne.
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
    Buffer.from(`%PDF-1.7 synthetic Bern document ${n}`),
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
 * The Beispiel family of Köniz: two salaries, two children, one at a daycare and one studying away
 * from home, the reformed church for both, party dues for one.
 */
async function beispiel() {
  await answer([
    ['canton', 'BE'],
    ['civil_status', 'married'],
    ['children', 2],
    ['children_custody', 'with_household'],
    ['childcare', 'creche_or_daycare'],
    ['child_care:child1', 9_000],
    ['child_care:child2', 0],
    ['education', true],
    ['child_education:child1', 0],
    ['child_education:child2', 3_000],
    ['commune', 'Köniz'],
    ['moved', 'no'],
    ['church:p1', 'reformed'],
    ['church:p2', 'reformed'],
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
    ['commute_transit_cost:p1', 1_700],
    ['meal_days:p1', 200],
    ['commute:p2', 'bike'],
    ['meal_days:p2', 0],
    ['banks', 0],
    ['crypto', false],
    ['payments', ['political_party']],
    ['party:p1', 800],
    ['party:p2', 0],
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
}

/** Mia Muster, single, in Biel/Bienne: one salary, her own household, no church, 3a. */
const MUSTER: [string, unknown][] = [
  ['civil_status', 'single'],
  ['own_household', true],
  ['children', 0],
  ['commune', 'Biel/Bienne'],
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

async function muster(canton: 'BE' | 'GE' | 'ZH' = 'BE') {
  const commune = canton === 'BE' ? 'Biel/Bienne' : canton === 'ZH' ? 'Zürich' : 'Vernier';
  // Geneva asks neither the household nor the church; Zurich asks the church, not the household.
  const asked = ([id]: [string, unknown]) =>
    canton === 'BE' || (id !== 'own_household' && (canton === 'ZH' || !id.startsWith('church')));
  await answer([
    ['canton', canton],
    ...MUSTER.filter(asked).map(([id, v]): [string, unknown] => [
      id,
      id === 'commune' ? commune : v,
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
  commune: { bfs: number; name: string; rate: number | null };
  total: number;
  icc: {
    total: number;
    cantonal: number;
    communal: number;
    church: number | null;
    wealthCap: number | null;
    taxableIncome: number;
    tariff: string;
  };
  ifd: { tax: number; taxableIncome: number; scale: string };
  unverifiedRules: string[];
  notSupported: string[];
}

describe('a Bern return', () => {
  it('asks Bern’s questions, then computes every Bern tax and the federal tax', async () => {
    await beispiel();
    const status = await call('get_status');
    expect(status.structuredContent).toMatchObject({ canton: 'BE' });
    expect(texts(status)).toMatch(/tax year 2026, Bern/);
    expect(ws.snapshot().slots.filter((s) => s.value === undefined)).toEqual([]);

    const res = await call('compute_tax');
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, canton: 'BE' });
    expect(out.commune).toMatchObject({ name: 'Köniz' });
    // Married with children: the tariff of Art. 42 Abs. 1, church tax for both members.
    expect(out.icc.tariff).toBe('married');
    expect(out.icc.church).toBeGreaterThan(0);
    expect(out.icc.total).toBe(out.icc.cantonal + out.icc.communal + (out.icc.church ?? 0));
    expect(out.ifd.scale).toBe('married');
    expect(out.total).toBe(out.icc.total + out.ifd.tax);
    expect(out.unverifiedRules.length).toBeGreaterThan(0);
    expect(out.notSupported).toEqual([]);
    const text = texts(res);
    expect(text).toMatch(/canton of Bern, commune Köniz \(BFS \d+, Steueranlage [\d.]+\)/);
    expect(text).toMatch(/Kantons-, Gemeinde- und Kirchensteuern/);
    expect(text).toMatch(/Kirchensteuer/);
    expect(text).toMatch(/direkte Bundessteuer/);
    expect(text).toMatch(/Bern is a preview/);

    // With detail, every item with its source, in both columns.
    const detail = await call('compute_tax', { detail: true });
    const d = (detail.structuredContent as { detail: Record<string, { code: string }[]> }).detail;
    expect(d.iccItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        '2.21-haupt',
        '6.1',
        'saeule-3a',
        '4.2',
        '4.4',
        '2.1-betreuung',
        '2.1-kinder',
        '2.1-ausbildung',
        'zweiverdiener',
      ]),
    );
    expect(d.ifdItems!.map((i) => i.code)).toEqual(
      expect.arrayContaining(['2.21-haupt', 'verheiratet', '2.1-kinder', '4.4']),
    );
    expect(texts(detail)).toMatch(/- Bund verheiratet Abzug für Verheiratete/);
  });

  it('shows the estimate in the dashboard, in the official German terms', async () => {
    await beispiel();
    const s = await state('fr');
    expect(s.canton).toMatchObject({ code: 'BE', name: 'Berne' });
    const est = s.estimate as
      (DashboardState['estimate'] & { canton?: string; unverified?: string[] }) | undefined;
    expect(est?.computed).toBe(true);
    if (!est?.computed) return;
    expect(est.canton).toBe('BE');
    expect(est.rows.map((r) => r.label)).toEqual([
      'Impôts cantonal, communal et paroissial (Kantons-, Gemeinde- und Kirchensteuern)',
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
    expect(estDe.items.find((i) => i.code === 'saeule-3a')?.label).toBe('Beiträge Säule 3a');
  });

  it('asks Bern’s own questions only where they apply', async () => {
    await answer([
      ['canton', 'BE'],
      ['civil_status', 'divorced'],
    ]);
    // Not married: whether you keep your own household alone (form 1.2).
    expect(ws.next()?.id).toBe('own_household');
    await answer([
      ['own_household', true],
      ['children', 2],
      ['children_custody', 'shared'],
      ['child_support', 'none_i_earn_more'],
    ]);
    const ids = ws.snapshot().slots.map((s) => s.id);
    // Shared custody without child support: the tariff and the wealth deduction of the last
    // assessment; education costs asked once per child.
    expect(ids).toEqual(expect.arrayContaining(['married_tariff', 'child_wealth']));
    await answer([
      ['married_tariff', true],
      ['child_wealth', 'half'],
      ['childcare', 'none'],
      ['education', true],
    ]);
    const after = ws.snapshot().slots.map((s) => s.id);
    expect(after).toEqual(
      expect.arrayContaining(['child_education:child1', 'child_education:child2']),
    );
    const q = await call('next_questions');
    expect(texts(q)).not.toMatch(/\{n\}/);
    // The parish question: only in a commune whose parts' parishes differ, its own parts only.
    await answer([
      ['child_education:child1', 0],
      ['child_education:child2', 0],
      ['commune', '304'],
      ['moved', 'no'],
      ['church:p1', 'reformed'],
    ]);
    const parish = ws.snapshot().slots.find((s) => s.id === 'parish');
    expect(parish).toBeDefined();
    const options = ws.render(parish!, 'en').options!.map((o) => o.value);
    expect(options.length).toBeGreaterThan(1);
    expect(options.every((v) => v.startsWith('304:'))).toBe(true);
  });

  it('runs the final check with Bern’s lines, software and terms', async () => {
    await beispiel();
    await ws.setPlan('p2', 'plan.gross_salary', 46_000, 'chat');
    const res = await call('final_check');
    const out = res.structuredContent as FinalCheckState;
    // The 3a of person 1 is at the cap in both taxes: said once, for both.
    const pillar = out.know.find((i) => i.kind === 'limit' && i.code === 'saeule-3a');
    expect(pillar?.title).toMatch(/Beiträge Säule 3a/);
    expect(pillar?.title).toMatch(/cantonal and federal tax/);
    expect(pillar?.detail).toMatch(/^Paid into pillar 3a \(Beiträge Säule 3a\): CHF 7’258\.00/);
    const pdf = out.know.find((i) => i.kind === 'official_pdf');
    expect(pdf?.detail).toMatch(/Taxpresso checks Geneva declarations only/);
    expect(out.know.some((i) => i.kind === 'form_provisional')).toBe(true);
    expect(texts(res)).not.toMatch(/GeTax|ZHprivateTax/);
    for (const i of [...out.fix, ...out.know]) {
      for (const src of i.sources) {
        if (src.id.startsWith('be-')) expect(src.url, src.id).toMatch(/^https:\/\//);
      }
    }
  });

  it('plans 3a, a buy-in and the 3a catch-up on Bern’s tax, and keeps TOU Geneva’s', async () => {
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
    expect(out.pillar3a.assumptions).toContain('be_preview');
    expect(out.pillar3a.sources.join(' ')).toMatch(/be-2026-/);
    expect(out.lppBuyIn.saving?.cantonalCentimes).toBeGreaterThan(0);
    // Bern gives its rule for a 3a catch-up (TaxInfo): a saving, unlike Zurich.
    expect(out.pillar3aCatchUp.assumptions).not.toContain('be_catchup_rule');
    expect(out.tou.applies).toBe(false);
    const text = texts(res);
    expect(text).toMatch(/pillar 3a \(Säule 3a\)/);
    expect(text).toMatch(/Einkauf 2\. Säule \(Pensionskasse\)/);
    expect(text).toMatch(/For Bern, taxation at source \(Quellensteuer\)/);
    expect(text).toMatch(/Bern is a preview/);
    const decided = await call('decide_optimization', {
      id: 'tou',
      choice: 'decline',
      confirmed: false,
    });
    expect(decided.isError).toBe(true);
    expect(texts(decided)).toMatch(/TOU is Geneva’s procedure\. For Bern/);
  });

  it('gives the values to type form by form, in the chat and the dashboard', async () => {
    await beispiel();
    const list = await call('get_form_values');
    const out = list.structuredContent as { sections: { page: string }[]; provisional: boolean };
    expect(out.sections.length).toBeGreaterThan(2);
    expect(out.provisional).toBe(true);
    expect(texts(list)).toMatch(/TaxMe/);
    const panel = (await state('fr')).copyPanel;
    expect(panel.unplaced).toEqual([]);
    expect(panel.total).toBeGreaterThan(0);
    // The PDF check is Geneva's only: said plainly, in both places.
    const pdf = await call('reconcile_official_pdf');
    expect(texts(pdf)).toMatch(/reads Geneva declarations only/);
    expect(texts(pdf)).toMatch(/TaxMe-Online/);
    expect((await state()).declarationCheck.status).toBe('not_available');
  });

  it('gives the same federal tax as Geneva and Zurich for the same household', async () => {
    await muster('BE');
    const be = (await call('compute_tax')).structuredContent as TaxOut;
    expect(be.icc.church).toBeNull();
    expect(be.icc.tariff).toBe('other');
    const federal: TaxOut['ifd'][] = [];
    for (const canton of ['GE', 'ZH'] as const) {
      await client.close();
      await dashboard.stop();
      await connect();
      await muster(canton);
      federal.push(((await call('compute_tax')).structuredContent as TaxOut).ifd);
    }
    for (const other of federal) {
      expect(other.taxableIncome).toBe(be.ifd.taxableIncome);
      expect(other.tax).toBe(be.ifd.tax);
    }
  });
});
