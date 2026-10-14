// A year of arrival from abroad or of departure abroad in Geneva, end to end (SPEC.md section 1):
// the questions (the day, per person), the documents (a salary certificate for the period), the
// tax for Claude (compute_tax) and the dashboard, "About you", the TOU of an arrival taxed at
// source (the CHF 120,000 converted to a year, both ways), the copy panel's day of arrival and
// lines for the rate, the cross-document check, the final check and the plans. Synthetic
// households on a temporary vault, never the real one: Lena Brandt (Genève, arrived on 1 April),
// Noor and Samir Haddad (Meyrin, arrived on 1 July, taxed at source), Jonas Lindqvist (Carouge,
// left on 30 September). Their taxes were derived by hand from the official documents in
// packages/rules-ge/test/part-year.test.ts, whose figures these must match.
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import type { DocumentKind } from '@taxpresso/ledger';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApi, type DashboardState } from '../src/api.js';
import { readConfig } from '../src/config.js';
import { type ApiRequest, Dashboard } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import type { Workspace } from '../src/workspace.js';
import { TaxYears } from '../src/years.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

let client: Client;
let dashboard: Dashboard;
let ws: Workspace;
let year = 2026;

type Result = Awaited<ReturnType<Client['callTool']>>;
const texts = (res: Result) =>
  (res.content as { type: string; text?: string }[]).map((c) => c.text ?? '').join('\n');
const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args });
const req = (
  method: 'GET' | 'POST',
  route: string,
  body: unknown = {},
  lang = 'en',
): ApiRequest => ({
  method,
  path: route,
  query: new URLSearchParams(`lang=${lang}`),
  headers: {},
  body: Buffer.from(JSON.stringify(body)),
  csrf: 'csrf-token',
});
const state = async (lang = 'en'): Promise<DashboardState> => {
  const res = await createApi(ws)(req('GET', '/state', {}, lang));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as DashboardState;
};

async function connect(years?: TaxYears, given?: Workspace) {
  const uiDir = await makeUiDir();
  const api = years ? createApi(years) : createApi(given!);
  dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api });
  const server = createTaxpressoServer(
    years ? { years, dashboard } : { workspace: given!, dashboard },
  );
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
}

/** A fresh vault on the open year: 2026, or 2025 opened with open_tax_year. */
async function open(y: 2025 | 2026) {
  year = y;
  const uiDir = await makeUiDir();
  const root = await mkdtemp(path.join(os.tmpdir(), 'taxpresso-ws-'));
  const years = new TaxYears(
    readConfig({ TAXPRESSO_VAULT_PATH: path.join(root, 'Taxpresso'), TAXPRESSO_UI_DIR: uiDir }),
  );
  await connect(years);
  if (y === 2025) {
    const opened = await call('open_tax_year', { year: 2025 });
    expect(opened.isError, texts(opened)).toBeFalsy();
  }
  ws = years.current;
  await ws.ready();
}

beforeEach(async () => {
  year = 2026;
  const uiDir = await makeUiDir();
  ws = await makeWorkspace(uiDir);
  await connect(undefined, ws);
  await ws.ready();
});

afterEach(async () => {
  await client.close();
  await dashboard.stop();
});

/** Answers in order, through the tool, each answer accepted. */
async function answer(pairs: [string, unknown][]) {
  for (const [id, value] of pairs) {
    const res = await call('answer_question', { id, value });
    expect(res.isError, `${id}: ${texts(res)}`).toBeFalsy();
  }
}

/** The questions still open, answered plainly: no, none, the smallest number, the first option. */
async function finish() {
  for (let i = 0; i < 60; i++) {
    const res = await call('next_questions');
    const q = (
      res.structuredContent as {
        questions: {
          id: string;
          type: string;
          min?: number;
          options?: { value: string; notSupported: boolean }[];
        }[];
      }
    ).questions[0];
    if (!q) return;
    const value =
      q.type === 'yesno'
        ? false
        : q.type === 'number'
          ? (q.min ?? 0)
          : q.type === 'money'
            ? '0'
            : q.type === 'multi'
              ? []
              : q.options!.find((o) => !o.notSupported)!.value;
    await answer([[q.id, value]]);
  }
}

let n = 0;
/** A document of the user's with the values Claude read in it (synthetic bytes), confirmed. */
async function document(
  kind: DocumentKind,
  person: 'p1' | 'p2' | 'household',
  values: [string, string][],
  period?: [string, string],
) {
  n += 1;
  const { document: doc } = await ws.addDocument(
    Buffer.from(`%PDF-1.7 synthetic part-year document ${n}`),
    `${kind}-${n}.pdf`,
    'dashboard',
  );
  const res = await call('propose_extraction', {
    id: doc.id,
    document: {
      kind,
      taxYear: year,
      person,
      ...(period ? { periodFrom: period[0], periodTo: period[1] } : {}),
    },
    values: values.map(([key, value]) => ({ key, value, page: 1 })),
  });
  expect(res.isError, texts(res)).toBeFalsy();
  await ws.confirmDocument(doc.id, 'dashboard');
  return doc;
}

const salary = (
  person: 'p1' | 'p2',
  gross: string,
  social: string,
  lpp: string,
  period: [string, string],
  extra: [string, string][] = [],
) =>
  document(
    'salary_certificate',
    person,
    [
      ['salary.base', gross],
      ['salary.gross', gross],
      ['salary.social_contributions', social],
      ['salary.lpp_ordinary', lpp],
      ...extra,
    ],
    period,
  );

/** Lena Brandt, single, Swiss, back from abroad on 1 April, Ville de Genève. */
async function brandt() {
  await answer([
    ['canton', 'GE'],
    ['civil_status', 'single'],
    ['children', 0],
    ['commune', 'Genève'],
    ['moved', 'from_abroad'],
    ['arrival_date:p1', `${year}-04-01`],
    ['income_sources:p1', ['salary']],
    ['employers:p1', 1],
    ['residence:p1', 'swiss'],
    ['pillar3a:p1', true],
    ['lpp_buyin:p1', false],
    ['commute:p1', 'public_transport'],
    ['commute_transit_cost:p1', '400'],
    ['meal_days:p1', 0],
    ['banks', 1],
    ['crypto', false],
    ['payments', []],
    ['special', []],
  ]);
  await finish();
  await salary('p1', "72'000.00", "4'608.00", "3'600.00", [`${year}-04-01`, `${year}-12-31`]);
  await document('pillar3a_attestation', 'p1', [['pillar3a.paid', "7'258.00"]]);
  await document('health_premiums', 'household', [['health.premiums', "4'500.00"]]);
  await document('bank_attestation', 'p1', [
    ['bank.balance', "12'000.00"],
    ['bank.interest_gross', '0.00'],
  ]);
}

/** Jonas Lindqvist, single, Swiss, leaving Switzerland on 30 September, Carouge. */
async function lindqvist() {
  await answer([
    ['canton', 'GE'],
    ['civil_status', 'single'],
    ['children', 0],
    ['commune', 'Carouge'],
    ['moved', 'leaving_switzerland'],
    ['departure_date:p1', `${year}-09-30`],
    ['income_sources:p1', ['salary']],
    ['employers:p1', 1],
    ['residence:p1', 'swiss'],
    ['pillar3a:p1', true],
    ['lpp_buyin:p1', false],
    ['commute:p1', 'walk'],
    ['meal_days:p1', 0],
    ['banks', 1],
    ['crypto', false],
    ['payments', []],
    ['special', []],
  ]);
  await finish();
  await salary('p1', "90'000.00", "5'760.00", "4'500.00", [`${year}-01-01`, `${year}-09-30`]);
  await document('pillar3a_attestation', 'p1', [['pillar3a.paid', "7'258.00"]]);
  await document('health_premiums', 'household', [['health.premiums', "3'600.00"]]);
  await document('bank_attestation', 'p1', [
    ['bank.balance', "20'000.00"],
    ['bank.interest_gross', '0.00'],
  ]);
}

/**
 * Noor and Samir Haddad, married, both with a B permit and an employer in Switzerland (taxed at
 * source), arrived together on 1 July 2026, Meyrin, one child in a crèche. Samir earns `g1` from
 * July: 66,000 (132,000 converted to a year: TOU compulsory) or 54,000 (108,000: a choice).
 */
async function haddad(g1: number) {
  await answer([
    ['canton', 'GE'],
    ['civil_status', 'married'],
    ['children', 1],
    ['children_custody', 'with_household'],
    ['childcare', 'creche_or_daycare'],
    ['commune', 'Meyrin'],
    ['moved', 'from_abroad'],
    ['arrival_date:p1', '2026-07-01'],
    ['arrival_date:p2', '2026-07-01'],
    ['income_sources:p1', ['salary']],
    ['employers:p1', 1],
    ['residence:p1', 'permit_other'],
    ['employer_in_switzerland:p1', true],
    ['income_sources:p2', ['salary']],
    ['employers:p2', 1],
    ['residence:p2', 'permit_other'],
    ['employer_in_switzerland:p2', true],
    ['tou:p1', 'no'],
    ['tou:p2', 'no'],
    ['pillar3a:p1', true],
    ['pillar3a:p2', false],
    ['lpp_buyin:p1', false],
    ['lpp_buyin:p2', false],
    ['commute:p1', 'walk'],
    ['meal_days:p1', 0],
    ['commute:p2', 'walk'],
    ['meal_days:p2', 0],
    ['banks', 0],
    ['crypto', false],
    ['payments', []],
    ['special', []],
  ]);
  await finish();
  const july: [string, string] = ['2026-07-01', '2026-12-31'];
  const f = (x: number) => `${x.toFixed(2)}`;
  await salary('p1', f(g1), f(g1 * 0.064), f(g1 * 0.05), july, [
    ['salary.source_tax', f(g1 * 0.08)],
  ]);
  await salary('p2', '30000.00', '1920.00', '1500.00', july, [['salary.source_tax', '1800.00']]);
  await document('pillar3a_attestation', 'p1', [['pillar3a.paid', '3000.00']]);
  await document('health_premiums', 'household', [['health.premiums', '4200.00']]);
  await document('childcare_invoice', 'household', [['childcare.costs', '6000.00']]);
}

interface TaxOut {
  taxYear: number;
  computed: boolean;
  total: number | null;
  icc: { total: number; taxableIncome: number; taxableWealth: number } | null;
  ifd: { tax: number; taxableIncome: number; scale: string } | null;
  unsupported: string[];
  notSupported: string[];
  assumptions: string[];
}

const rowsOf = (s: DashboardState) =>
  s.copyPanel.sections.flatMap((x) =>
    x.groups.flatMap((g) => g.rows.map((r) => ({ page: x.page, ...r }))),
  );

describe('Lena Brandt, arrived from abroad on 1 April 2026', () => {
  it('asks the day, and Geneva taxes her months here at a full year’s rate', async () => {
    await answer([
      ['canton', 'GE'],
      ['civil_status', 'single'],
      ['children', 0],
      ['commune', 'Genève'],
      ['moved', 'from_abroad'],
    ]);
    // The day comes next, as a date of the tax year; a day of another year is refused.
    const next = await call('next_questions');
    const q = (next.structuredContent as { questions: { id: string; type: string }[] })
      .questions[0]!;
    expect(q).toMatchObject({ id: 'arrival_date:p1', type: 'date' });
    expect(texts(next)).toMatch(/On what date did you arrive in Switzerland\?/);
    expect(texts(next)).toMatch(/Answer: the day, YYYY-MM-DD, in 2026/);
    const wrong = await call('answer_question', { id: 'arrival_date:p1', value: '2025-04-01' });
    expect(wrong.isError).toBe(true);
    expect(ws.engine.notSupported(ws.snapshot())).toEqual([]);
  });

  it('gives the tax derived by hand, for Claude and the dashboard', async () => {
    await brandt();
    expect(ws.engine.notSupported(ws.snapshot())).toEqual([]);
    const res = await call('compute_tax', { detail: true });
    const out = res.structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, unsupported: [], notSupported: [] });
    expect(out.icc).toMatchObject({ total: 761_750, taxableIncome: 5_022_200, taxableWealth: 0 });
    expect(out.ifd).toMatchObject({ tax: 76_375, taxableIncome: 5_287_000, scale: 'single' });
    expect(out.total).toBe(761_750 + 76_375);
    expect(texts(res)).toMatch(
      /A year of arrival from abroad: the taxes are on the income of 2026-04-01 to 2026-12-31 \(270 of 360 days\), at the rate of a full year's income \(revenu net pour le taux, 95\.00: CHF 69,986 cantonal, CHF 72,913 federal\)\. Say it as it is; never present a full year's tax/,
    );

    // get_status and the dashboard: the fact in "About you", in every language.
    const status = texts(await call('get_status'));
    expect(status).toMatch(
      /You arrived on 1 April 2026: Geneva taxes your income from then, at the rate of a full year’s income \(CHF.69’986 for the rate, revenu net pour le taux\), and your wealth on 31 December\./,
    );
    const s = await state();
    const fact = s.journey.about.find((f) => f.id === 'part_year')!;
    expect(fact.text!.fr).toMatch(/^Vous êtes arrivé le 1er avril 2026/);
    expect(fact.text!.de).toMatch(/^Du bist am 1\. April 2026 zugezogen/);
    expect(fact.text!.it).toMatch(/^Sei arrivato il 1° aprile 2026/);
    expect(s.estimate).toMatchObject({ total: 761_750 + 76_375 });

    // The salary certificate matches the day of arrival: nothing to check.
    expect(ws.checks().filter((c) => c.rule === 'salary_period')).toEqual([]);

    // The copy panel: the day of arrival on PG1, 95.00 for the rate, 97.00 the rest, 99.00 the
    // income of the period, in both columns.
    const rows = rowsOf(s);
    expect(rows.find((r) => r.key === 'PG1-ARRIVEE')).toMatchObject({
      label: 'Date d’arrivée',
      copy: '01.04.2026',
    });
    const recap = rows
      .filter((r) => r.page === 'PG3' && ['95.00', '97.00', '99.00'].includes(r.ref))
      .map((r) => [r.ref, r.columns.map((c) => c.id).join('+'), r.copy, r.noCheck ?? false]);
    expect(recap).toEqual(
      expect.arrayContaining([
        ['95.00', 'icc', '69986', true],
        ['97.00', 'icc', '19764', true],
        ['99.00', 'icc', '50222', false],
        ['95.00', 'ifd', '72913', true],
        ['97.00', 'ifd', '20043', true],
        ['99.00', 'ifd', '52870', false],
      ]),
    );

    // The final check says it, with the documents that govern it.
    const fc = s.finalCheck;
    const item = fc.know.find((i) => i.kind === 'part_year')!;
    expect(item.title).toMatch(/You arrived on 1 April 2026/);
    expect(item.sources.map((x) => x.id)).toEqual(
      expect.arrayContaining(['ge-2025-guide-declaration-pp', 'ch-na-law-lifd']),
    );

    // The plans: the year's 3a maximum, the buy-in limit for arrivals, at the real rate.
    const plans = texts(await call('list_optimizations'));
    expect(plans).toMatch(
      /A year of arrival from abroad: the pillar 3a maximum is the whole year's/,
    );
    expect(plans).toMatch(/ch-na-law-lpp art\. 79b al\. 2/);
  });

  it('a certificate for the whole year while she arrived on 1 April: not prepared', async () => {
    await brandt();
    await salary('p1', "20'000.00", "1'280.00", '0.00', ['2026-01-01', '2026-03-31']);
    const out = (await call('compute_tax')).structuredContent as TaxOut;
    expect(out).toMatchObject({ icc: null, ifd: null });
    expect(out.unsupported.join(' ')).toMatch(/starts before the day you arrived/);
    const s = await state();
    expect(s.journey.about.map((f) => f.text?.en ?? '').join(' ')).toMatch(
      /starts before the day you arrived/,
    );
  });
});

describe('Noor and Samir Haddad, arrived together on 1 July 2026, taxed at source', () => {
  it('66,000 from July is 132,000 for a year: TOU is compulsory, a fact', async () => {
    await haddad(66_000);
    const out = (await call('compute_tax')).structuredContent as TaxOut;
    expect(out.icc!.total).toBe(904_650);
    expect(out.ifd!.tax).toBe(134_725);
    const status = texts(await call('get_status'));
    expect(status).toMatch(/TOU is compulsory/);
    const s = await state();
    expect(s.journey.touChoice).toBe(false);
    expect(s.journey.about.map((f) => f.id)).toEqual(
      expect.arrayContaining(['part_year', 'tou_compulsory']),
    );
    expect(s.journey.about.find((f) => f.id === 'part_year')!.text!.en).toMatch(
      /^You both arrived on 1 July 2026/,
    );
  });

  it('54,000 from July is 108,000 for a year: TOU is a choice, with the comparison', async () => {
    await haddad(54_000);
    const out = (await call('compute_tax')).structuredContent as TaxOut;
    expect(out.icc!.total).toBe(670_875);
    expect(out.ifd!.tax).toBe(77_280);
    const s = await state();
    expect(s.journey.touChoice).toBe(true);
    const plans = texts(await call('list_optimizations'));
    expect(plans).toMatch(/TOU/);
    expect(plans).not.toMatch(/TOU is compulsory here/);
  });
});

describe('Jonas Lindqvist, leaving Switzerland on 30 September 2026', () => {
  it('his income to the day he leaves, at a full year’s rate; no day of arrival', async () => {
    await lindqvist();
    const out = (await call('compute_tax')).structuredContent as TaxOut;
    expect(out).toMatchObject({ computed: true, unsupported: [] });
    expect(out.icc).toMatchObject({ total: 1_132_120, taxableIncome: 6_707_000 });
    expect(out.ifd).toMatchObject({ tax: 167_240, taxableIncome: 6_874_000 });
    const s = await state();
    expect(s.journey.about.find((f) => f.id === 'part_year')!.text!.en).toMatch(
      /^You leave Switzerland on 30 September 2026: Geneva taxes your income from 1 January to then/,
    );
    const rows = rowsOf(s);
    expect(rows.find((r) => r.key === 'PG1-ARRIVEE')).toBeUndefined();
    expect(ws.checks().filter((c) => c.rule === 'salary_period')).toEqual([]);
    expect(s.finalCheck.know.find((i) => i.kind === 'part_year')!.todo).toMatch(
      /questionnaire de départ/,
    );
  });
});

describe('tax year 2025', () => {
  it('Lena Brandt and Jonas Lindqvist in 2025: the 2025 rules and scales', async () => {
    await client.close();
    await dashboard.stop();
    await open(2025);
    await brandt();
    let out = (await call('compute_tax')).structuredContent as TaxOut;
    expect(out).toMatchObject({ taxYear: 2025, computed: true, unsupported: [] });
    expect(out.icc!.total).toBe(761_750);
    expect(out.ifd!.tax).toBe(76_375);
    await client.close();
    await dashboard.stop();
    await open(2025);
    await lindqvist();
    out = (await call('compute_tax')).structuredContent as TaxOut;
    expect(out.icc!.total).toBe(1_132_120);
    expect(out.ifd!.tax).toBe(167_510);
  });
});

describe('other cantons', () => {
  it('still say an arrival or a departure is not supported', async () => {
    for (const canton of ['ZH', 'BE', 'BL', 'VD', 'BS', 'ZG', 'LU', 'SG', 'FR', 'TI', 'AG']) {
      await client.close();
      await dashboard.stop();
      const uiDir = await makeUiDir();
      ws = await makeWorkspace(uiDir);
      await connect(undefined, ws);
      await ws.ready();
      await answer([['canton', canton]]);
      const moved = ws.snapshot().slots.find((s) => s.question.key === 'profile.moved')!;
      const options = moved.question.options!;
      for (const v of ['from_abroad', 'leaving_switzerland']) {
        expect(options.find((o) => o.value === v)?.notSupported, `${canton} ${v}`).toBeDefined();
      }
    }
  });
});
