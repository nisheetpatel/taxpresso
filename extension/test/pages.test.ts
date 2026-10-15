// What the three pages need (docs/design/three-pages.md, section 4): the page the panel opens on,
// how sure the tax is, the questions by where they are asked, each person's rough income, and the
// rough benefits and pensions themselves, used as estimates until their attestation is in, in
// Geneva and in Zurich alike. Synthetic households only (the Martin and Keller households are made
// up). Temporary folders, never the real one.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import type { DocumentKind } from '@taxpresso/ledger';
import { QUESTION_GROUPS } from '@taxpresso/questionnaire';
import { describe, expect, it } from 'vitest';
import { createApi, PLAN_FIELD, type DashboardState } from '../src/api.js';
import { CANTONS, CantonRegistry } from '../src/cantons.js';
import { readConfig } from '../src/config.js';
import { Dashboard, type ApiRequest } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import { makeUiDir } from './helpers.js';
import { saveHolding } from '../src/holdings.js';
import { pageOf, STAGE_OF, type NextId } from '../src/journey.js';
import { ROUGH_INCOME } from '../src/pages.js';
import { Workspace, yearOverPlans } from '../src/workspace.js';

/** A workspace on a temporary folder, on a fixed day; `repo`: the folder is inside a git repo. */
async function workspace(opts: { today?: string; year?: number; repo?: boolean } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'taxpresso-ws-'));
  if (opts.repo) await mkdir(path.join(root, '.git'));
  const config = {
    ...readConfig({ TAXPRESSO_VAULT_PATH: path.join(root, 'Taxpresso') }),
    today: () => opts.today ?? '2026-10-14',
  };
  const ws = new Workspace(config, new CantonRegistry(opts.year ?? config.taxYear));
  await ws.ready();
  return ws;
}

const req = (method: 'GET' | 'POST', p: string, body: unknown, lang: string): ApiRequest => ({
  method,
  path: p,
  query: new URLSearchParams({ lang }),
  headers: {},
  body: Buffer.from(body === undefined ? '' : JSON.stringify(body)),
  csrf: 'csrf-token',
});

async function post(ws: Workspace, p: string, body: unknown, lang = 'en') {
  const res = await createApi(ws)(req('POST', p, body, lang));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as DashboardState;
}

async function state(ws: Workspace, lang = 'en') {
  const res = await createApi(ws)(req('GET', '/state', undefined, lang));
  expect(res.status).toBe(200);
  return res.body as DashboardState;
}

/**
 * Answers the questions in the order they come: the given answers, else the first plain answer
 * (no, none, zero, the first option), as a careful user who has nothing special to say.
 */
async function answerAll(ws: Workspace, given: Record<string, unknown>) {
  for (let i = 0; i < 80; i++) {
    const next = ws.next();
    if (!next || ws.skipped.includes(next.id)) return;
    const q = next.question;
    const value =
      next.id in given
        ? given[next.id]
        : q.type === 'yesno'
          ? false
          : q.type === 'number' || q.type === 'money'
            ? (q.min ?? 0)
            : q.type === 'multi'
              ? []
              : q.type === 'commune'
                ? ws.engine.communes[0]!.slug
                : q.options?.find((o) => !o.notSupported)?.value;
    await post(ws, '/answer', { id: next.id, value });
  }
}

/** A document read by Claude (synthetic bytes), its values given, then confirmed by the user. */
async function document(
  ws: Workspace,
  kind: DocumentKind,
  person: 'p1' | 'p2' | 'household',
  values: [string, string][],
  confirm = true,
) {
  const name = `${kind}-${person}-${values.map((v) => v[1]).join('-')}.pdf`;
  const { document: doc } = await ws.addDocument(
    new TextEncoder().encode(`%PDF-1.7 synthetic ${name}`),
    name,
    'dashboard',
  );
  await ws.proposeExtraction(
    doc.id,
    { kind, taxYear: ws.taxYear, person },
    values.map(([key, value]) => ({ key, value, page: 1 })),
  );
  if (confirm) await ws.confirmDocument(doc.id, 'dashboard');
  return doc.id;
}

/** The Martin household: one person in Meyrin, a salary, nothing special. */
const MARTIN = {
  canton: 'GE',
  civil_status: 'single',
  children: 0,
  commune: 'meyrin',
  moved: 'no',
  'income_sources:p1': ['salary'],
  'employers:p1': 1,
  'residence:p1': 'swiss',
};

describe('the page the panel opens on', () => {
  it('is Start for "start" and a folder that can’t be used, else the page of the next step’s stage', () => {
    const expected: Record<NextId, 'start' | 'tax' | 'save' | 'file'> = {
      folder: 'start',
      start: 'start',
      not_supported: 'tax',
      read: 'tax',
      whose: 'tax',
      canton: 'tax',
      prior: 'tax',
      questions: 'tax',
      confirm: 'tax',
      checks: 'tax',
      identify: 'tax',
      assessment: 'file',
      documents: 'tax',
      income: 'tax',
      save: 'save',
      later: 'tax',
      file: 'file',
    };
    for (const id of Object.keys(STAGE_OF) as NextId[]) {
      const page = pageOf({ id, stage: STAGE_OF[id], vars: {} });
      expect(page, id).toEqual({ current: expected[id], tabs: expected[id] !== 'start' });
    }
  });

  it('follows the next step from Start to Your tax, Pay less and File', async () => {
    // Nothing known: Start, no tabs.
    const ws = await workspace();
    expect((await state(ws)).page).toEqual({ current: 'start', tabs: false });
    // Something known: the questions are on Your tax, with the tabs.
    let s = await post(ws, '/answer', { id: 'canton', value: 'GE' });
    expect(s.journey.next.id).toBe('prior');
    expect(s.page).toEqual({ current: 'tax', tabs: true });
    await answerAll(ws, MARTIN);
    s = await state(ws);
    expect([s.journey.next.id, s.page.current]).toEqual(['income', 'tax']);
    // A rough salary before 31 December: what to pay in by then, on Pay less.
    s = await post(ws, '/plan', { person: 'p1', field: 'gross', value: 90_000 });
    expect([s.journey.next.id, s.page]).toEqual(['save', { current: 'save', tabs: true }]);
    // A document to check: back on Your tax.
    await document(ws, 'salary_certificate', 'p1', [['salary.gross', "90'000.00"]], false);
    s = await state(ws);
    expect([s.journey.next.id, s.page.current]).toEqual(['confirm', 'tax']);
  });

  it('is File once everything is in after 31 December, and Start for a folder that can’t be used', async () => {
    const ws = await workspace({ today: '2027-02-10' });
    await answerAll(ws, MARTIN);
    await document(ws, 'salary_certificate', 'p1', [['salary.gross', "90'000.00"]]);
    await document(ws, 'health_premiums', 'p1', [['health.premiums', "4'800.00"]]);
    const s = await state(ws);
    expect([s.journey.next.id, s.page]).toEqual(['file', { current: 'file', tabs: true }]);
    const repo = await workspace({ repo: true });
    const r = await state(repo);
    expect([r.journey.next.id, r.page]).toEqual(['folder', { current: 'start', tabs: false }]);
  });
});

describe('how sure the tax is', () => {
  it('goes from none to rough, close and exact as the documents come in', async () => {
    const ws = await workspace({ today: '2027-02-10' });
    await answerAll(ws, MARTIN);
    // No income yet: no tax, so no word on the bar.
    let s = await state(ws);
    expect(s.journey.stages.find((x) => x.id === 'tax')?.status).toBe('waiting');
    expect(s.confidence).toBeNull();
    // A rough salary: Rough estimate. Through set_fact or the card, the same.
    await ws.setPlan('p1', 'plan.gross_salary', 90_000, 'chat');
    s = await state(ws);
    expect(s.confidence).toBe('rough');
    // The certificate replaces the rough salary on its own; its values wait for the user's OK.
    const cert = await document(
      ws,
      'salary_certificate',
      'p1',
      [['salary.gross', "88'000.00"]],
      false,
    );
    expect((await state(ws)).confidence).toBe('close');
    // Confirmed, but the health insurance statement, a required document, is missing.
    await ws.confirmDocument(cert, 'dashboard');
    s = await state(ws);
    expect(s.requirements.find((r) => r.id === 'health_premiums:p1')?.status).toBe('missing');
    expect(s.confidence).toBe('close');
    // Everything in and confirmed, nothing estimated: Exact.
    await document(ws, 'health_premiums', 'p1', [['health.premiums', "4'800.00"]]);
    s = await state(ws);
    expect(s.confidence).toBe('exact');
    // Any income figure from a rough number makes it rough again: a pension without its attestation.
    await ws.setPlan('p1', 'plan.pension_income', 12_000, 'chat');
    expect((await state(ws)).confidence).toBe('rough');
    await ws.setPlan('p1', 'plan.pension_income', 0, 'chat');
    expect((await state(ws)).confidence).toBe('exact');
  });

  it('is close, not exact, while an input is an estimate', async () => {
    const ws = await workspace({ today: '2027-02-10' });
    await answerAll(ws, MARTIN);
    await document(ws, 'salary_certificate', 'p1', [['salary.gross', "88'000.00"]]);
    await document(ws, 'health_premiums', 'p1', [['health.premiums', "4'800.00"]]);
    expect((await state(ws)).confidence).toBe('exact');
    // A bank account the user describes roughly, without a statement: an estimate the tax rests on.
    await saveHolding(
      ws,
      {
        item: 'savings-1',
        kind: 'bank_account',
        name: 'Savings account',
        value: "20'000.00",
        owner: 'p1',
        estimate: true,
      },
      'chat',
    );
    const e = ws.estimate();
    const lines = e.entry!.view.allLines(e.result!);
    expect(lines.some((l) => l.estimates?.includes('input-estimate'))).toBe(true);
    expect((await state(ws)).confidence).toBe('close');
  });
});

describe('the questions by group', () => {
  it('lists only the questions that apply, by where they are asked, in the questionnaire’s order', async () => {
    const ws = await workspace();
    await post(ws, '/answer', { id: 'canton', value: 'GE' });
    await post(ws, '/answer', { id: 'civil_status', value: 'married' });
    const s = await state(ws, 'fr');
    expect(Object.keys(s.groups)).toEqual([...QUESTION_GROUPS]);
    const snap = ws.snapshot();
    const listed = QUESTION_GROUPS.flatMap((g) => s.groups[g].map((q) => q.id));
    expect([...listed].sort()).toEqual(snap.slots.map((x) => x.id).sort());
    for (const g of QUESTION_GROUPS) {
      const order = snap.slots.filter((x) => x.question.group === g).map((x) => x.id);
      expect(
        s.groups[g].map((q) => q.id),
        g,
      ).toEqual(order);
    }
    // Rendered as today, in the page's language, with the answer and whether it is answered.
    const [canton, civil] = s.groups.basics;
    expect(canton).toMatchObject({ id: 'canton', value: 'GE', answered: true });
    expect(civil).toMatchObject({ id: 'civil_status', value: 'married', answered: true });
    const children = s.groups.basics.find((q) => q.id === 'children')!;
    expect(children).toMatchObject({ answered: false, type: 'number' });
    expect(children).not.toHaveProperty('value');
    expect(children.text).toBe(
      ws.render(
        snap.slots.find((x) => x.id === 'children')!,
        'fr',
      ).text,
    );
    // Each person's own: both of a couple, with whose it is.
    expect(
      s.groups.basics.filter((q) => q.questionId === 'income_sources').map((q) => q.id),
    ).toEqual(['income_sources:p1', 'income_sources:p2']);
    // Only what applies: the plans once someone has a salary, then for that person only.
    expect(s.groups.plan).toEqual([]);
    const salaried = await post(ws, '/answer', { id: 'income_sources:p2', value: ['salary'] });
    expect(salaried.groups.plan.map((q) => q.id)).toEqual(['pillar3a:p2', 'lpp_buyin:p2']);
    expect(salaried.groups.detail.map((q) => q.id)).toContain('employers:p2');
    // A question skipped for now says so.
    const skipped = await post(ws, '/skip', { id: 'children' });
    expect(skipped.groups.basics.find((q) => q.id === 'children')).toMatchObject({ skipped: true });
  });

  it('leaves out what is worked out, never asked: taxed at source', async () => {
    const ws = await workspace();
    await answerAll(ws, {
      ...MARTIN,
      'residence:p1': 'permit_other',
      'employer_in_switzerland:p1': true,
    });
    const s = await state(ws);
    expect(ws.snapshot().derived.map((x) => x.id)).toContain('taxed_at_source:p1');
    const all = QUESTION_GROUPS.flatMap((g) => s.groups[g].map((q) => q.id));
    expect(all).not.toContain('taxed_at_source:p1');
    // Whether a Swiss employer pays the salary and whether TOU is in place: on the basics card.
    expect(s.groups.basics.map((q) => q.questionId)).toEqual(
      expect.arrayContaining(['residence', 'employer_in_switzerland', 'tou']),
    );
  });

  it('asks each canton’s own questions where they belong (Zurich: the church among the details)', async () => {
    const ws = await workspace();
    await answerAll(ws, {
      canton: 'ZH',
      civil_status: 'single',
      children: 0,
      commune: 'Winterthur',
      moved: 'no',
      'church:p1': 'reformed',
      'income_sources:p1': ['salary'],
    });
    const s = await state(ws, 'de');
    expect(s.groups.detail.map((q) => q.questionId)).toContain('church');
    expect(s.groups.basics.map((q) => q.questionId)).toContain('commune');
    expect(s.groups.special.map((q) => q.questionId)).toEqual(['moved', 'special']);
    const commune = s.groups.basics.find((q) => q.questionId === 'commune')!;
    expect(commune.text).toMatch(/Gemeinde/);
    expect(commune).toMatchObject({
      value: ws.snapshot().answers.get('profile.commune|household'),
      answered: true,
    });
    // Its long list of communes isn't read every second: GET /question gives it.
    expect(commune.options).toBeUndefined();
    const full = await createApi(ws)({
      ...req('GET', '/question', undefined, 'de'),
      query: new URLSearchParams({ lang: 'de', id: 'commune' }),
    });
    expect((full.body as { options: unknown[] }).options.length).toBeGreaterThan(100);
  });
});

describe('rough income', () => {
  it('shows each person’s rough income and its kind, the latest given, and what the canton takes', async () => {
    const ws = await workspace();
    await answerAll(ws, {
      ...MARTIN,
      civil_status: 'married',
      'income_sources:p2': ['pension'],
      'employers:p2': 1,
      'residence:p2': 'swiss',
    });
    let s = await state(ws);
    expect(s.rough.open).toBe(true);
    expect(s.rough.kinds).toEqual(
      ROUGH_INCOME.map(({ kind, key, field }) => ({ kind, key, field })),
    );
    expect(s.rough.people).toEqual([
      { person: 'p1', amount: null, kind: null, figures: [] },
      { person: 'p2', amount: null, kind: null, figures: [] },
    ]);
    // The basics card: a salary for one, a pension for the other.
    await post(ws, '/plan', { person: 'p1', field: 'gross', value: 90_000 });
    s = await post(ws, '/plan', { person: 'p2', field: 'pension', value: 30_000 });
    expect(s.rough.people).toEqual([
      {
        person: 'p1',
        amount: 9_000_000,
        kind: 'salary',
        figures: [{ kind: 'salary', amount: 9_000_000, used: true }],
      },
      {
        person: 'p2',
        amount: 3_000_000,
        kind: 'pension',
        figures: [{ kind: 'pension', amount: 3_000_000, used: true }],
      },
    ]);
    expect(ws.ledger.get('plan.pension_income', 'p2')).toMatchObject({
      value: 3_000_000,
      status: 'estimate',
      source: { method: 'user', via: 'dashboard' },
    });
    // The card shows the kind given last; a document replaces its figure.
    await new Promise((r) => setTimeout(r, 5));
    s = await post(ws, '/plan', { person: 'p1', field: 'benefits', value: 20_000 });
    expect(s.rough.people[0]).toMatchObject({ kind: 'replacement_income', amount: 2_000_000 });
    await document(ws, 'salary_certificate', 'p1', [['salary.gross', "88'000.00"]]);
    s = await state(ws);
    expect(s.rough.people[0]!.figures).toEqual([
      { kind: 'salary', amount: 9_000_000, used: false },
      { kind: 'replacement_income', amount: 2_000_000, used: true },
    ]);
    // 0 clears a figure, as for the salary.
    s = await post(ws, '/plan', { person: 'p1', field: 'benefits', value: 0 });
    expect(s.rough.people[0]).toMatchObject({ kind: 'salary', amount: 9_000_000 });
  });

  it('takes a business’s profit in Geneva only, and no rough income for a year that is over', async () => {
    const zh = await workspace();
    await answerAll(zh, { canton: 'ZH', civil_status: 'single', commune: 'Winterthur' });
    expect((await state(zh)).rough.kinds.map((k) => k.kind)).toEqual([
      'salary',
      'replacement_income',
      'pension',
    ]);
    const refused = await createApi(zh)(
      req('POST', '/plan', { person: 'p1', field: 'business', value: 1 }, 'en'),
    );
    expect(refused.status).toBe(400);
    // 2025 is over: its documents give the figures.
    const over = await workspace({ year: 2025, today: '2026-10-14' });
    await answerAll(over, MARTIN);
    expect((await state(over)).rough.open).toBe(false);
    for (const field of ['benefits', 'pension'] as const) {
      const res = await createApi(over)(
        req('POST', '/plan', { person: 'p1', field, value: 1 }, 'en'),
      );
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toBe(yearOverPlans(2025));
    }
    await expect(over.setPlan('p1', 'plan.replacement_income', 1, 'chat')).rejects.toThrow(
      yearOverPlans(2025),
    );
    expect(PLAN_FIELD).toMatchObject({
      benefits: 'plan.replacement_income',
      pension: 'plan.pension_income',
    });
  });
});

describe('rough benefits and pensions in the chat', () => {
  /** Claude's tools on a workspace (no dashboard page, no folder watch). */
  async function chat(ws: Workspace) {
    const uiDir = await makeUiDir();
    const dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(ws) });
    const server = createTaxpressoServer({ workspace: ws, dashboard });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(clientSide);
    return {
      call: (name: string, args: Record<string, unknown> = {}) =>
        client.callTool({ name, arguments: args }) as Promise<{
          isError?: boolean;
          content: { text: string }[];
          structuredContent?: Record<string, unknown>;
        }>,
      close: async () => {
        await client.close();
        await dashboard.stop();
      },
    };
  }

  it('asks for them in plain words, saves them with set_fact, and refuses them for a year over', async () => {
    const ws = await workspace();
    await answerAll(ws, { ...MARTIN, 'income_sources:p1': ['pension', 'replacement_income'] });
    const { call, close } = await chat(ws);
    try {
      const status = await call('get_status');
      expect(status.structuredContent?.next).toMatchObject({ id: 'income' });
      expect(status.structuredContent?.nextStep).toMatch(
        /Save benefits \(unemployment, sickness, accident\) as plan\.replacement_income and a pension as plan\.pension_income, estimates too, never as a salary\./,
      );
      const saved = await call('set_fact', { key: 'plan.pension_income', value: 30_000 });
      expect(saved.isError).toBeFalsy();
      expect(saved.content[0]!.text).toBe(
        'Saved as an estimate until its document is in. Call compute_tax for the updated tax.',
      );
      expect(ws.ledger.get('plan.pension_income', 'p1')).toMatchObject({
        value: 3_000_000,
        status: 'estimate',
        source: { method: 'user', via: 'chat' },
      });
      const tax = await call('compute_tax');
      expect(tax.structuredContent?.computed).toBe(true);
      expect(tax.content[0]!.text).toMatch(/No pension attestation yet/);
    } finally {
      await close();
    }
    const over = await workspace({ year: 2025 });
    await answerAll(over, { ...MARTIN, 'income_sources:p1': ['pension'] });
    const old = await chat(over);
    try {
      const refused = await old.call('set_fact', { key: 'plan.pension_income', value: 30_000 });
      expect(refused.isError).toBe(true);
      expect(refused.content[0]!.text).toMatch(/^2025 is over/);
      const status = await old.call('get_status');
      expect(status.structuredContent?.nextStep).not.toMatch(/plan\.pension_income/);
    } finally {
      await old.close();
    }
  });
});

describe('rough benefits and pensions in the tax', () => {
  /** The tax total and the result's flags of one household, from its answers and income. */
  async function taxOf(
    canton: 'GE' | 'ZH',
    income: 'replacement_income' | 'pension',
    give: (ws: Workspace) => Promise<unknown>,
  ) {
    const ws = await workspace();
    await answerAll(ws, {
      canton,
      civil_status: 'single',
      children: 0,
      commune: canton === 'GE' ? 'meyrin' : 'Winterthur',
      moved: 'no',
      ...(canton === 'ZH' ? { 'church:p1': 'none' } : {}),
      'income_sources:p1': [income],
      'residence:p1': 'swiss',
    });
    await give(ws);
    const e = ws.estimate();
    expect(e.result, JSON.stringify(e.missing)).not.toBeNull();
    return { ws, result: e.result!, notes: e.notes.map((n) => n.en) };
  }

  const attestation = (kind: DocumentKind, values: [string, string][]) => (ws: Workspace) =>
    document(ws, kind, 'p1', values);

  for (const canton of ['GE', 'ZH'] as const) {
    it(`${canton}: a rough pension is taxed as its attestation would be, flagged as an estimate`, async () => {
      const rough = await taxOf(canton, 'pension', (ws) =>
        ws.setPlan('p1', 'plan.pension_income', 36_000, 'chat'),
      );
      const read = await taxOf(
        canton,
        'pension',
        attestation('pension_certificate', [
          ['pension.amount', "36'000.00"],
          ['pension.type', 'other'],
        ]),
      );
      expect(rough.result.total).toBeGreaterThan(0);
      expect(rough.result.total).toBe(read.result.total);
      expect(rough.result.estimates.map((e) => e.id)).toContain('input-estimate');
      expect(read.result.estimates.map((e) => e.id)).not.toContain('input-estimate');
      expect(rough.notes.join(' ')).toMatch(/No pension attestation yet/);
      expect((await state(rough.ws)).confidence).toBe('rough');
      // Its attestation in, the rough figure no longer counts.
      await document(rough.ws, 'pension_certificate', 'p1', [
        ['pension.amount', "30'000.00"],
        ['pension.type', 'occupational'],
      ]);
      const replaced = await taxOf(
        canton,
        'pension',
        attestation('pension_certificate', [
          ['pension.amount', "30'000.00"],
          ['pension.type', 'occupational'],
        ]),
      );
      expect(rough.ws.estimate().result!.total).toBe(replaced.result.total);
      expect((await state(rough.ws)).confidence).not.toBe('rough');
    });

    it(`${canton}: rough benefits are taxed as their attestation would be, flagged as an estimate`, async () => {
      const rough = await taxOf(canton, 'replacement_income', (ws) =>
        ws.setPlan('p1', 'plan.replacement_income', 24_000, 'chat'),
      );
      const read = await taxOf(
        canton,
        'replacement_income',
        attestation('replacement_income_certificate', [
          ['replacement.amount', "24'000.00"],
          ['replacement.type', 'sickness_accident'],
        ]),
      );
      expect(rough.result.total).toBeGreaterThan(0);
      expect(rough.result.total).toBe(read.result.total);
      expect(rough.result.estimates.map((e) => e.id)).toContain('input-estimate');
      expect(rough.notes.join(' ')).toMatch(/No benefits attestation yet/);
      expect((await state(rough.ws)).rough.people[0]).toMatchObject({
        kind: 'replacement_income',
        amount: 2_400_000,
        figures: [{ kind: 'replacement_income', amount: 2_400_000, used: true }],
      });
    });
  }

  it('gives every canton the same tax from a rough figure as from its attestation', async () => {
    const computed: string[] = [];
    for (const canton of Object.keys(CANTONS)) {
      for (const [income, key, kind, values] of [
        [
          'pension',
          'plan.pension_income',
          'pension_certificate',
          [
            ['pension.amount', "36'000.00"],
            ['pension.type', 'other'],
          ],
        ],
        [
          'replacement_income',
          'plan.replacement_income',
          'replacement_income_certificate',
          [
            ['replacement.amount', "24'000.00"],
            ['replacement.type', 'sickness_accident'],
          ],
        ],
      ] as const) {
        const household = async (give: (ws: Workspace) => Promise<unknown>) => {
          const ws = await workspace();
          await answerAll(ws, {
            canton,
            civil_status: 'single',
            children: 0,
            moved: 'no',
            'income_sources:p1': [income],
            'residence:p1': 'swiss',
          });
          await give(ws);
          return ws.estimate();
        };
        const amount = Number(values[0][1].replace(/[^\d.]/g, ''));
        const rough = await household((ws) => ws.setPlan('p1', key, amount, 'chat'));
        const read = await household((ws) =>
          document(
            ws,
            kind,
            'p1',
            values.map(([k, v]) => [k, v] as [string, string]),
          ),
        );
        // Where the canton computes no tax yet (Fribourg 2026), neither does: for the same reasons.
        expect(rough.result?.total ?? null, `${canton} ${income}`).toBe(read.result?.total ?? null);
        expect(rough.missing.map((m) => m.en)).toEqual(read.missing.map((m) => m.en));
        if (rough.result?.total) {
          computed.push(`${canton} ${income}`);
          expect(rough.result.estimates.map((e) => e.id)).toContain('input-estimate');
        }
      }
    }
    expect(computed.length).toBeGreaterThanOrEqual(20);
  });
});
