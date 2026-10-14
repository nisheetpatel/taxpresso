// Simple first (docs/design/simple.md): one next step and five stages, the same in get_status and
// the dashboard; nothing shown from nothing; facts as sentences, a TOU choice only when there is
// one; the household answers an assessment prints, as suggestions. Synthetic households only: the
// Keller couple (made up, both taxed at source and in TOU) and Ana Ribeiro.
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it } from 'vitest';
import { createApi, type DashboardState } from '../src/api.js';
import { CantonRegistry } from '../src/cantons.js';
import { readConfig } from '../src/config.js';
import { Dashboard } from '../src/dashboard.js';
import type { ApiRequest } from '../src/dashboard.js';
import { STAGES, type NextId } from '../src/journey.js';
import { planningReady } from '../src/planning.js';
import { createTaxpressoServer } from '../src/server.js';
import { Workspace } from '../src/workspace.js';
import { messages as uiText } from '../../ui/src/dashboard/i18n-journey.js';
import { makeUiDir } from './helpers.js';

const fixture = (name: string) =>
  readFile(path.join(import.meta.dirname, '..', '..', 'test', 'fixtures', name));
const text = (res: { content: unknown }) => (res.content as { text: string }[])[0]!.text;
const structured = <T>(res: { structuredContent?: unknown }) => res.structuredContent as T;

interface Status {
  next: { id: NextId; stage: string | null; text: string };
  stage: string;
  stages: { id: string; status: string }[];
  about: string[];
  nextStep: string;
}

let client: Client;
let dashboard: Dashboard;
let ws: Workspace;

/** A workspace on a temporary folder, on a fixed day in October (before 31 December). */
async function connect(today = '2026-10-14') {
  const uiDir = await makeUiDir();
  const root = await mkdtemp(path.join(os.tmpdir(), 'taxpresso-ws-'));
  const config = {
    ...readConfig({
      TAXPRESSO_VAULT_PATH: path.join(root, 'Taxpresso'),
      TAXPRESSO_UI_DIR: uiDir,
    }),
    today: () => today,
  };
  ws = new Workspace(config, new CantonRegistry(config.taxYear));
  dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(ws) });
  const server = createTaxpressoServer({ workspace: ws, dashboard });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
  await ws.ready();
  return (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args });
}

afterEach(async () => {
  await client?.close();
  await dashboard?.stop();
});

const req = (method: 'GET' | 'POST', p: string, body: unknown = {}): ApiRequest => ({
  method,
  path: p,
  query: new URLSearchParams('lang=en'),
  headers: {},
  body: Buffer.from(JSON.stringify(body)),
  csrf: 'csrf-token',
});
const state = async () => {
  const res = await createApi(ws)(req('GET', '/state'));
  expect(res.status).toBe(200);
  return res.body as DashboardState;
};

/** The Keller couple's first answers: both taxed at source, both already in TOU. */
const KELLER: [string, unknown][] = [
  ['canton', 'GE'],
  ['civil_status', 'married'],
  ['children', 0],
  ['commune', 'lancy'],
  ['moved', 'no'],
  ['income_sources:p1', ['salary']],
  ['income_sources:p2', ['salary']],
  ['employers:p1', 1],
  ['employers:p2', 1],
  ['taxed_at_source:p1', true],
  ['taxed_at_source:p2', true],
  ['tou:p1', 'already'],
  ['tou:p2', 'already'],
];

/** Every other question, answered with its first plain option (no, none, zero). */
async function answerTheRest() {
  for (let i = 0; i < 60; i++) {
    const slot = ws.next();
    if (!slot) return;
    const q = slot.question;
    const value =
      q.type === 'yesno'
        ? false
        : q.type === 'multi'
          ? []
          : q.type === 'number'
            ? (q.min ?? 0)
            : q.type === 'money'
              ? 790
              : q.options?.find((o) => !o.notSupported)?.value;
    try {
      await ws.answer(slot.id, value, 'chat');
    } catch {
      await ws.skip(slot.id);
    }
  }
}

describe('the next step and the stages', () => {
  it('start with "drop what you have, or tell me about yourself", the same in the chat and the dashboard', async () => {
    const call = await connect();
    const status = structured<Status>(await call('get_status'));
    expect(status.next).toMatchObject({ id: 'start', stage: 'about' });
    expect(status.next.text).toMatch(/last year’s declaration or tax bill/);
    expect(status.nextStep).toMatch(/where the user lived on 31 December \(next_questions\)/);
    expect(status.stages.map((s) => s.id)).toEqual([...STAGES]);
    // get_status says the year first, then the next step and the stages.
    const lines = text(await call('get_status')).split('\n');
    expect(lines[0]).toMatch(/^Taxpresso [^,]+, tax year 2026/);
    expect(lines[2]).toMatch(/^Next step: Nothing yet/);
    expect(lines.find((l) => l.startsWith('Stages'))).toMatch(/\[About you: nothing yet\]/);
    const s = await state();
    expect(s.journey.next).toMatchObject({ id: 'start', stage: 'about' });
    expect(s.journey.stage).toBe('about');
  });

  it('read a document nobody has read first, with one consent for all of them', async () => {
    const call = await connect();
    await ws.addDocument(await fixture('keller-avis-taxation-2025.pdf'), 'avis.pdf', 'dashboard');
    const status = structured<Status>(await call('get_status'));
    expect(status.next).toMatchObject({ id: 'read', stage: 'documents' });
    expect(status.next.text).toBe(
      'Taxpresso has a document to read. Ask Claude to read it, or say what it is.',
    );
    expect(status.nextStep).toMatch(/ask the user first, once for all of them/);
  });

  it('say TOU in place is a fact, not a choice, and show no tax and no saving from nothing', async () => {
    const call = await connect();
    for (const [id, value] of KELLER) await ws.answer(id, value, 'chat');
    let status = structured<Status>(await call('get_status'));
    expect(status.about).toEqual(['tou_already']);
    expect(status.next.id).toBe('questions');
    await answerTheRest();
    status = structured<Status>(await call('get_status'));
    expect(status.next).toMatchObject({ id: 'income', stage: 'tax' });
    expect(status.nextStep).toMatch(/Never|plan\.gross_salary/);
    const s = await state();
    expect(s.journey.about).toEqual([{ id: 'tou_already', who: 'both', vars: {} }]);
    expect(s.journey.touChoice).toBe(false);
    expect(s.journey.hasFigures).toBe(false);
    expect(s.journey.savings).toBeNull();
    expect(s.journey.stages.find((x) => x.id === 'tax')).toMatchObject({ status: 'waiting' });
    expect(s.journey.stages.find((x) => x.id === 'save')).toMatchObject({ status: 'ask' });
    // Documents come after the year ends: nothing to do about them in October.
    expect(s.journey.stages.find((x) => x.id === 'documents')).toMatchObject({
      status: 'later',
    });
    expect(s.journey.stages.find((x) => x.id === 'file')).toMatchObject({ status: 'later' });
    // The copy panel computes no line from nothing: no net or taxable income, no deduction.
    const rows = s.copyPanel.sections.flatMap((x) => x.groups.flatMap((g) => g.rows));
    expect(rows.map((r) => r.code).filter((c) => c === '95.00' || c === '99.00')).toEqual([]);
    expect(rows.every((r) => r.status !== 'computed' || r.role === 'input')).toBe(true);
    // compute_tax itself is unchanged: it still computes, with no income.
    expect(structured<{ computed: boolean }>(await call('compute_tax')).computed).toBe(true);
  });

  it('show the tax and one savings total once there is an income, then offer it once', async () => {
    const call = await connect();
    for (const [id, value] of KELLER) await ws.answer(id, value, 'chat');
    await answerTheRest();
    await call('set_fact', { key: 'plan.gross_salary', person: 'p1', value: 95_000 });
    await call('set_fact', { key: 'plan.gross_salary', person: 'p2', value: 82_000 });
    await planningReady(ws);
    const s = await state();
    expect(s.journey.hasFigures).toBe(true);
    expect(s.journey.savings).toMatchObject({ parts: ['pillar3a'], onlyWithTou: false });
    expect(s.journey.savings!.totalCentimes).toBeGreaterThan(0);
    expect(s.journey.savings!.totalCentimes).toBe(
      s.journey.savings!.cantonalCentimes + s.journey.savings!.federalCentimes,
    );
    // The two pillar 3a rooms together, as the 3a card's own saving on the same household.
    expect(s.journey.savings!.totalCentimes).toBe(s.plan!.result.saving!.totalCentimes);
    expect(s.journey.stages.find((x) => x.id === 'tax')).toMatchObject({ status: 'estimate' });
    const status = structured<Status>(await call('get_status'));
    expect(status.next).toMatchObject({ id: 'save', stage: 'save' });
    expect(status.nextStep).toMatch(/Want to see how to lower this before 31 December\?/);
    expect(status.nextStep).toMatch(/If not, move on: their documents come after 31 December/);
  });

  it('keep the minus sign of a negative total in the values to type', async () => {
    const call = await connect();
    for (const [id, value] of KELLER) await ws.answer(id, value, 'chat');
    await call('set_fact', { key: 'plan.gross_salary', person: 'p1', value: 1_000 });
    await call('set_fact', { key: 'plan.gross_salary', person: 'p2', value: 1_000 });
    const s = await state();
    const net = s.copyPanel.sections
      .flatMap((x) => x.groups.flatMap((g) => g.rows))
      .filter((r) => r.code === '95.00');
    const ifd = net.find((r) => r.columns.some((c) => c.id === 'ifd'))!;
    // Deductions beyond the income: the federal net income is below zero, and says so.
    expect(ifd.centimes).toBeLessThan(0);
    expect(ifd.copy).toMatch(/^-\d+$/);
    expect(text(await call('get_form_values', { section: 'PG3' }))).toMatch(
      /95\.00 Revenu net total \(Total net income\) \[IFD\]: -\d+\./,
    );
  });

  it('offer no saving before 31 December once the year has ended', async () => {
    const call = await connect('2027-01-15');
    for (const [id, value] of KELLER) await ws.answer(id, value, 'chat');
    await answerTheRest();
    await call('set_fact', { key: 'plan.gross_salary', person: 'p1', value: 95_000 });
    const s = await state();
    expect(s.journey.savings).toBeNull();
    expect(s.journey.next).toMatchObject({ id: 'documents' });
    expect(s.journey.stages.find((x) => x.id === 'documents')).toMatchObject({
      status: 'missing',
    });
  });

  it('show the TOU card only when there is a real choice', async () => {
    const call = await connect();
    for (const [id, value] of [
      ['canton', 'GE'],
      ['civil_status', 'single'],
      ['children', 0],
      ['commune', 'meyrin'],
      ['moved', 'no'],
      ['income_sources:p1', ['salary']],
      ['employers:p1', 1],
      ['taxed_at_source:p1', true],
      ['tou:p1', 'considering'],
    ] as const) {
      await ws.answer(id, value, 'chat');
    }
    await call('set_fact', { key: 'plan.gross_salary', value: 72_000 });
    await call('set_fact', { key: 'plan.source_tax_withheld', value: 6_000 });
    await call('set_fact', { key: 'plan.tou_other_income', value: false });
    await call('set_fact', { key: 'plan.tou_taxable_wealth', value: false });
    await planningReady(ws);
    let s = await state();
    expect(s.journey.touChoice).toBe(true);
    expect(s.journey.about).toEqual([]);
    // A gross salary over the limit makes TOU compulsory: a fact, no card.
    await call('set_fact', { key: 'plan.gross_salary', value: 150_000 });
    s = await state();
    expect(s.journey.touChoice).toBe(false);
    expect(s.journey.about).toMatchObject([{ id: 'tou_compulsory', vars: { date: '2027-03-31' } }]);
  });
});

describe('an assessment (avis de taxation)', () => {
  it('suggests the household answers it prints, cited, never over an answer', async () => {
    const call = await connect();
    const { document } = await ws.addDocument(
      await fixture('keller-avis-taxation-2025.pdf'),
      'avis.pdf',
      'dashboard',
    );
    const res = await call('propose_extraction', {
      id: document.id,
      document: { kind: 'tax_assessment', taxYear: 2025, person: 'household' },
      values: [
        { key: 'assessment.taxable_income', value: "131'540.00", page: 1 },
        { key: 'profile.canton', value: 'GE', page: 1 },
        { key: 'profile.civil_status', value: 'married', page: 1 },
        { key: 'profile.children_count', value: 0, page: 1 },
        { key: 'profile.commune', value: 'Lancy', page: 1 },
      ],
    });
    expect(res.isError).toBeFalsy();
    // The commune's question comes with the canton: saved later, never guessed.
    expect(text(res)).toMatch(/Not saved yet: profile\.commune/);
    expect(text(res)).toMatch(/answers? suggested from this document wait in the questions/);
    // The canton comes as a suggestion with its page, not as an answer.
    const canton = ws.snapshot().slots.find((s) => s.id === 'canton')!;
    expect(canton.value).toBeUndefined();
    expect(canton.suggested).toBe('GE');
    expect(canton.suggestion?.source).toMatchObject({ docId: document.id, page: 1 });
    const q = (await state()).question!;
    expect(q.suggestedFrom).toMatchObject({ kind: 'tax_assessment', year: 2025, page: 1 });
    // Suggestions wait in the questions; they are not values to confirm in Documents.
    expect(ws.toConfirm().map((f) => f.key)).toEqual(['assessment.taxable_income']);
    // Last year's assessment is no "document for another year" to replace.
    expect(ws.checks().map((c) => c.rule)).toEqual([]);

    await call('answer_question', { id: 'canton', value: 'GE' });
    await call('answer_question', { id: 'civil_status', value: 'single' });
    // The civil status read in it: still a suggestion... but the user's answer stays.
    const again = await call('propose_extraction', {
      id: document.id,
      values: [
        { key: 'profile.civil_status', value: 'married', page: 1 },
        { key: 'profile.commune', value: 'Lancy', page: 1 },
      ],
    });
    expect(text(again)).toMatch(/Kept what the user already confirmed/);
    expect(ws.snapshot().answers.get('profile.civil_status|household')).toBe('single');
    const commune = ws.snapshot().slots.find((s) => s.id === 'commune')!;
    expect(commune.suggested).toBe('lancy');
  });
});

describe('the dashboard words every step and stage', () => {
  it('has a text for each next step and each stage status, in English, French, German and Italian', () => {
    const ids: NextId[] = [
      'folder',
      'not_supported',
      'start',
      'read',
      'whose',
      'canton',
      'prior',
      'questions',
      'confirm',
      'checks',
      'identify',
      'assessment',
      'documents',
      'income',
      'save',
      'later',
      'file',
    ];
    const statuses: Record<string, string[]> = {
      about: ['start', 'open', 'done', 'not_supported'],
      documents: [
        'read',
        'whose',
        'confirm',
        'checks',
        'identify',
        'missing',
        'later',
        'done',
        'empty',
      ],
      tax: ['estimate', 'computed', 'waiting'],
      save: ['total', 'tou', 'ask', 'over'],
      file: ['later', 'open'],
    };
    for (const lang of ['en', 'fr', 'de', 'it'] as const) {
      const table = uiText[lang] as Record<string, string>;
      for (const id of ids) expect(table[`next.${id}`], `${lang} next.${id}`).toBeTruthy();
      for (const [stage, list] of Object.entries(statuses)) {
        expect(table[`stage.${stage}`]).toBeTruthy();
        for (const st of list) {
          expect(table[`line.${stage}.${st}`], `${lang} line.${stage}.${st}`).toBeTruthy();
        }
      }
    }
  });
});
