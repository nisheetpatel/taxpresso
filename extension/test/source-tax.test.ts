// Tax at source as facts, end to end through the MCP tools and the dashboard API: who is taxed at
// source follows from a plain question (Swiss, a C permit or another permit) and the income; the
// barème follows from the household; the tax withheld comes from the documents, else from the
// official tables (flagged), else Taxpresso says what it needs. TOU already in place or compulsory
// is a fact; only a real choice shows the comparison and the decision. Synthetic households only.
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import { createApi, type DashboardState } from '../src/api.js';
import { Dashboard } from '../src/dashboard.js';
import type { ApiRequest } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import type { Workspace } from '../src/workspace.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

const req = (method: 'GET' | 'POST', p: string, body: unknown = {}, lang = 'en'): ApiRequest => ({
  method,
  path: p,
  query: new URLSearchParams(`lang=${lang}`),
  headers: {},
  body: Buffer.from(JSON.stringify(body)),
  csrf: 'csrf-token',
});

async function connect() {
  const uiDir = await makeUiDir();
  const ws = await makeWorkspace(uiDir);
  const dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(ws) });
  const server = createTaxpressoServer({ workspace: ws, dashboard });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = await client.callTool({ name, arguments: args });
    const text = (res.content as { text: string }[])[0]!.text;
    return {
      text,
      structured: res.structuredContent as Record<string, unknown>,
      error: res.isError,
    };
  };
  const api = createApi(ws);
  const state = async (lang = 'en') =>
    (await api(req('GET', '/state', {}, lang))).body as DashboardState;
  return { ws, call, api, state, close: () => client.close() };
}

/** Answers in the order Taxpresso asks; fails on a question that isn't in `answers`. */
async function answerAll(
  call: Awaited<ReturnType<typeof connect>>['call'],
  answers: Record<string, unknown>,
): Promise<string[]> {
  const asked: string[] = [];
  for (let i = 0; i < 60; i++) {
    const next = await call('next_questions');
    const q = (next.structured.questions as { id: string }[])[0];
    if (!q || !(q.id in answers)) return asked;
    asked.push(q.id);
    const saved = await call('answer_question', { id: q.id, value: answers[q.id] });
    expect(saved.error, `${q.id}: ${saved.text}`).toBeFalsy();
  }
  return asked;
}

/** A document of the year, read by "Claude" and confirmed by the user (synthetic). */
async function confirmed(
  ws: Workspace,
  kind: string,
  person: 'p1' | 'p2',
  values: [string, string | boolean][],
) {
  const { document } = await ws.addDocument(
    Buffer.from(`%PDF-1.7 synthetic ${kind} ${person} ${values.map((v) => v[1]).join(' ')}`),
    `${kind}-${person}.pdf`,
    'dashboard',
  );
  await ws.proposeExtraction(
    document.id,
    { kind: kind as never, taxYear: 2026, person },
    values.map(([key, value]) => ({ key, value, page: 1 })),
  );
  await ws.confirmDocument(document.id, 'dashboard');
}

/** What every household answers after the permit, so the questions end (synthetic). */
const REST = {
  'pillar3a:p1': false,
  'pillar3a:p2': false,
  'lpp_buyin:p1': false,
  'lpp_buyin:p2': false,
  'commute:p1': 'walk',
  'commute:p2': 'walk',
  'meal_days:p1': 0,
  'meal_days:p2': 0,
  banks: 0,
  crypto: false,
  payments: [],
  special: [],
};

describe('a couple with B permits, one salaried, the other on unemployment benefits', () => {
  it('both are taxed at source, never asked; the benefits count; no "only one of you"', async () => {
    const { ws, call, api, state, close } = await connect();
    try {
      const asked = await answerAll(call, {
        canton: 'GE',
        civil_status: 'married',
        children: 0,
        commune: 'Carouge',
        moved: 'no',
        'income_sources:p1': ['salary'],
        'income_sources:p2': ['replacement_income'],
        'employers:p1': 1,
        'residence:p1': 'permit_other',
        'residence:p2': 'permit_other',
        'tou:p1': 'no',
        'tou:p2': 'no',
        ...REST,
      });
      expect(asked.filter((id) => id.startsWith('taxed_at_source'))).toEqual([]);
      expect(asked).toEqual(expect.arrayContaining(['residence:p1', 'residence:p2']));

      // Before any document: who is taxed at source and the barème are known; the tax withheld
      // is said in plain words to come from the documents.
      const status = await call('get_status');
      expect(status.structured.sourceTax).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^You are taxed at source: without a C permit/),
          expect.stringMatching(/^Your spouse or partner is taxed at source: without a C permit/),
          expect.stringMatching(/^Barème C0N: married, both of you with income/),
        ]),
      );
      expect(status.text).toMatch(/don't ask the user for it/);
      let s = await state();
      expect(s.planning!.tou.problem).toBe('benefits_unknown');
      expect(s.sourceTax!.people.find((p) => p.person === 'p2')?.missing).toEqual(['benefits']);
      expect(s.sourceTax!.lines.map((l) => l.text).join(' ')).toMatch(
        /not known yet\. The attestation of the fund that paid your benefits .* shows the tax it took at source/,
      );

      await confirmed(ws, 'salary_certificate', 'p1', [
        ['salary.gross', "72'000.00"],
        ['salary.net', "63'360.00"],
        ['salary.source_tax', "6'480.00"],
      ]);
      await confirmed(ws, 'replacement_income_certificate', 'p2', [
        ['replacement.amount', "28'000.00"],
        ['replacement.source_tax', "1'120.00"],
      ]);
      await api(req('POST', '/planning', { field: 'otherIncome', value: false }));
      await api(req('POST', '/planning', { field: 'taxableWealth', value: false }));
      s = await state();
      const tou = s.planning!.tou;
      expect(tou).toMatchObject({ applies: true, mode: 'choice', compulsory: 'no' });
      expect(tou.problem).toBeUndefined();
      expect(tou.withheld?.totalCentimes).toBe(648_000 + 112_000);
      expect(tou.withheld?.people.map((p) => p.from)).toEqual(['certificate', 'certificate']);
      expect(tou.differenceCentimes).toBe(760_000 - tou.ordinary!.totalCentimes);
      // The benefits are income for the ordinary tax: without them it would be lower.
      expect(tou.assumptions).not.toContain('no_income_for_some');
      const list = await call('list_optimizations');
      expect(list.text).not.toMatch(/Only one of the couple/);
      expect(list.text).toMatch(/Tax taken at source for 2026: CHF 1,120, from your documents/);
      expect(list.text).toMatch(/With TOU: about CHF/);
      expect(list.text).toMatch(/A choice only once none of the compulsory cases applies/);
      // The dashboard in French: the same facts, in French, with their sources.
      const fr = await state('fr');
      expect(fr.sourceTax!.lines[0]?.text).toMatch(/^Vous êtes imposé à la source/);
      expect(fr.sourceTax!.lines[0]?.source).toMatch(/ge-na-law-lisp art\. 1/);
    } finally {
      await close();
    }
  });
});

describe('a Swiss spouse and a spouse with a B permit', () => {
  it('neither is taxed at source: the spouse is not asked, nothing about TOU shows', async () => {
    const { call, state, close } = await connect();
    try {
      const asked = await answerAll(call, {
        canton: 'GE',
        civil_status: 'married',
        children: 0,
        commune: 'Lancy',
        moved: 'no',
        'income_sources:p1': ['salary'],
        'income_sources:p2': ['salary'],
        'employers:p1': 1,
        'employers:p2': 1,
        'residence:p1': 'swiss',
        ...REST,
      });
      expect(asked).not.toContain('residence:p2');
      expect(
        asked.filter((id) => id.startsWith('taxed_at_source') || id.startsWith('tou')),
      ).toEqual([]);
      const status = await call('get_status');
      expect(status.structured.sourceTax).toBeUndefined();
      expect(status.text).not.toMatch(/Tax at source/);
      const s = await state();
      expect(s.sourceTax).toBeUndefined();
      expect(s.planning!.tou.applies).toBe(false);
      expect(s.planning!.inputs.map((i) => i.taxedAtSource)).toEqual([false, false]);
      expect((await call('list_optimizations')).text).not.toMatch(/TOU \(taxation ordinaire/);
    } finally {
      await close();
    }
  });
});

describe('a single parent with a B permit and two children', () => {
  it('H2 from the household, the tax withheld estimated from the tables and flagged', async () => {
    const { call, state, close } = await connect();
    try {
      await answerAll(call, {
        canton: 'GE',
        civil_status: 'divorced',
        children: 2,
        children_custody: 'with_household',
        childcare: 'creche_or_daycare',
        commune: 'Meyrin',
        moved: 'no',
        'income_sources:p1': ['salary'],
        'employers:p1': 1,
        'residence:p1': 'permit_other',
        'tou:p1': 'no',
        lives_with_other_parent: false,
        ...REST,
      });
      await call('set_fact', { key: 'plan.gross_salary', value: 68_000 });
      const status = await call('get_status');
      const lines = status.structured.sourceTax as string[];
      expect(lines).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            /^Barème H2N: single parent, the children living with you; it counts each child as under 25/,
          ),
          expect.stringMatching(
            /^Tax taken at source for 2026: about CHF [\d,]+, estimated with barème H2N on the gross salary\. \(an estimate\)/,
          ),
        ]),
      );
      const s = await state('de');
      expect(s.sourceTax!.lines.find((l) => l.estimate)?.text).toMatch(
        /^An der Quelle abgezogene Steuer 2026: etwa CHF .* geschätzt mit Tarif H2N/,
      );
      expect(s.planning!.tou.withheld?.people[0]).toMatchObject({ from: 'tariff', tariff: 'H2N' });
      // Whether TOU is compulsory isn't known yet: no decision before the two plain questions.
      expect(s.planning!.tou.mode).toBe('unknown');
      const refused = await call('decide_optimization', {
        id: 'tou',
        choice: 'decline',
        confirmed: false,
      });
      expect(refused.error).toBe(true);
      expect(refused.text).toMatch(/needs to know first whether TOU is compulsory/);
    } finally {
      await close();
    }
  });
});

describe('a couple already in TOU', () => {
  it('is a fact: no comparison, nothing to decide, the declaration comes every year', async () => {
    const { ws, call, api, state, close } = await connect();
    try {
      await answerAll(call, {
        canton: 'GE',
        civil_status: 'married',
        children: 0,
        commune: 'Onex',
        moved: 'no',
        'income_sources:p1': ['salary'],
        'income_sources:p2': ['salary'],
        'employers:p1': 1,
        'employers:p2': 1,
        'residence:p1': 'permit_other',
        'residence:p2': 'permit_other',
        'tou:p1': 'already',
        'tou:p2': 'already',
        ...REST,
      });
      await confirmed(ws, 'salary_certificate', 'p1', [
        ['salary.gross', "61'000.00"],
        ['salary.source_tax', "4'270.00"],
      ]);
      const s = await state();
      expect(s.planning!.tou).toMatchObject({ mode: 'in_place', compulsory: 'yes' });
      expect(s.planning!.tou.ordinary).toBeUndefined();
      expect(s.planning!.needsTou).toBe(false);
      const list = await call('list_optimizations');
      expect(list.text).toMatch(/A fact, not a choice: TOU is already in place/);
      expect(list.text).not.toMatch(/can't be withdrawn/);
      const refused = await api(
        req('POST', '/decide', { id: 'tou', choice: 'decline', confirmed: false }),
      );
      expect(refused.status).toBe(400);
      expect((refused.body as { error: string }).error).toMatch(/already in place/);
    } finally {
      await close();
    }
  });
});

describe('a couple whose income makes TOU compulsory', () => {
  it('is a fact: announce it by 31 March, nothing to compare or decide', async () => {
    const { ws, call, state, close } = await connect();
    try {
      await answerAll(call, {
        canton: 'GE',
        civil_status: 'married',
        children: 1,
        children_custody: 'with_household',
        childcare: 'none',
        commune: 'Geneve',
        moved: 'no',
        'income_sources:p1': ['salary'],
        'income_sources:p2': [],
        'employers:p1': 1,
        'residence:p1': 'permit_other',
        'residence:p2': 'permit_other',
        'tou:p1': 'no',
        ...REST,
      });
      await confirmed(ws, 'salary_certificate', 'p1', [
        ['salary.gross', "130'000.00"],
        ['salary.source_tax', "16'900.00"],
      ]);
      const s = await state();
      // The spouse has no income: barème B1, and that is no "only one of you is taxed at source".
      expect(s.sourceTax!.people[0]).toMatchObject({ derivedTariff: 'B1N', atSource: true });
      expect(s.sourceTax!.people[1]).toMatchObject({ atSource: false });
      expect(s.planning!.tou).toMatchObject({ mode: 'compulsory' });
      expect(s.planning!.tou.problem).toBeUndefined();
      expect(s.planning!.tou.reasons.find((r) => r.id === 'gross')?.status).toBe('yes');
      const list = await call('list_optimizations');
      expect(list.text).toMatch(
        /A fact, not a choice: TOU is compulsory .* announces it by 2027-03-31/,
      );
      const refused = await call('decide_optimization', {
        id: 'tou',
        choice: 'request',
        confirmed: true,
      });
      expect(refused.text).toMatch(/compulsory here/);
    } finally {
      await close();
    }
  });
});

describe('where the law leaves it open', () => {
  it('asks the plain question, and says "only one of you" only when the facts say so', async () => {
    const { ws, call, state, close } = await connect();
    try {
      const asked = await answerAll(call, {
        canton: 'GE',
        civil_status: 'married',
        children: 0,
        commune: 'Vernier',
        moved: 'no',
        'income_sources:p1': ['salary'],
        'income_sources:p2': ['salary'],
        'employers:p1': 1,
        'employers:p2': 1,
        'residence:p1': 'permit_other',
        // An international civil servant: a legitimation card, not taxed at source.
        'residence:p2': 'other',
        'taxed_at_source:p2': false,
        'tou:p1': 'no',
        ...REST,
      });
      expect(asked).toContain('taxed_at_source:p2');
      expect(asked).not.toContain('taxed_at_source:p1');
      await ws.setPlan('p1', 'plan.gross_salary', 70_000, 'chat');
      await ws.setPlan('p1', 'plan.tou_other_income', false, 'chat');
      await ws.setPlan('p1', 'plan.tou_taxable_wealth', false, 'chat');
      const s = await state();
      expect(s.planning!.tou.problem).toBe('mixed_couple');
      expect(s.sourceTax!.lines.map((l) => l.text)).toContain(
        'Your spouse or partner is not taxed at source: as you said',
      );
      const list = await call('list_optimizations');
      expect(list.text).toMatch(
        /Only one of the couple is taxed at source; the other isn't and has income of their own .*ge-2026-source-directives p\. 25 and 26/,
      );
    } finally {
      await close();
    }
  });
});
