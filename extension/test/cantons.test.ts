// The canton question (docs/design/cantons.md, section 3): asked first, nothing computed without
// it, a canton Taxpresso doesn't cover said plainly, and a Geneva return started before the
// question kept as Geneva's, saying so. Synthetic households only.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it } from 'vitest';
import { createApi, type DashboardState } from '../src/api.js';
import { CantonRegistry, mergeKeys } from '../src/cantons.js';
import { readConfig } from '../src/config.js';
import { Dashboard } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import { Workspace } from '../src/workspace.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

const text = (res: { content: unknown }) => (res.content as { text: string }[])[0]!.text;
const structured = <T>(res: { structuredContent?: unknown }) => res.structuredContent as T;

const open: { close: () => Promise<void> }[] = [];
afterEach(async () => {
  for (const x of open.splice(0)) await x.close();
});

async function connect(ws: Workspace) {
  const uiDir = await makeUiDir();
  const dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(ws) });
  const server = createTaxpressoServer({ workspace: ws, dashboard });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
  open.push(client, { close: () => dashboard.stop() });
  return (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args });
}

const state = async (ws: Workspace, lang = 'en') =>
  (
    await createApi(ws)({
      method: 'GET',
      path: '/state',
      query: new URLSearchParams({ lang }),
      headers: {},
      body: Buffer.alloc(0),
      csrf: 'csrf-token',
    })
  ).body as DashboardState;

interface Status {
  canton: string | null;
  cantonFrom: string;
  cantonBecause: string[];
  nextStep: string;
  notSupported: string[];
  progress: { questionsAnswered: number; questionsOpen: number };
}

describe('the canton question', () => {
  it('comes first, and nothing is computed before it', async () => {
    const ws = await makeWorkspace();
    const call = await connect(ws);
    const status = structured<Status>(await call('get_status'));
    expect(status).toMatchObject({ canton: null, cantonFrom: 'none' });
    expect(status.nextStep).toMatch(/where the user lived on 31 December/);
    expect(text(await call('get_status'))).toMatch(/tax year 2026, canton not known yet/);
    const q = await call('next_questions');
    // The canton first; before it, only the questions every canton shares.
    expect(text(q)).toMatch(/^0 answered, \d+ to go\.\n\n\[canton\]/);
    expect(structured<{ open: number }>(q).open).toBe(ws.snapshot().slots.length);
    expect(ws.snapshot().slots.map((s) => s.question.key)).not.toContain('profile.commune');
    expect(text(q)).toMatch(/it taxes the whole year, as if you had lived there since January/);
    const tax = await call('compute_tax');
    expect(structured<{ computed: boolean }>(tax).computed).toBe(false);
    expect(text(tax)).toMatch(/the canton where you lived on 31 December/);
    expect((await state(ws)).canton).toBeNull();
  });

  it('says plainly when the canton is not covered yet, and stops', async () => {
    const ws = await makeWorkspace();
    const call = await connect(ws);
    const saved = await call('answer_question', { id: 'canton', value: 'Valais' });
    expect(saved.isError).toBe(true);
    const other = await call('answer_question', { id: 'canton', value: 'other' });
    expect(text(other)).toMatch(
      /Not supported yet: A canton other than Geneva, Zurich, Bern, Basel-Landschaft, Vaud, Basel-Stadt, Zug, Lucerne or Aargau/,
    );
    const status = structured<Status>(await call('get_status'));
    expect(status.canton).toBeNull();
    expect(status.notSupported).toEqual([
      'A canton other than Geneva, Zurich, Bern, Basel-Landschaft, Vaud, Basel-Stadt, Zug, Lucerne or Aargau',
    ]);
    expect(status.nextStep).toMatch(/their canton's free tax software or a fiduciary/);
    expect(structured<{ computed: boolean }>(await call('compute_tax')).computed).toBe(false);
  });

  it('takes Geneva and asks the Geneva questions, with GeTax for what it can’t do', async () => {
    const ws = await makeWorkspace();
    const call = await connect(ws);
    await call('answer_question', { id: 'canton', value: 'GE' });
    const status = structured<Status>(await call('get_status'));
    expect(status).toMatchObject({ canton: 'GE', cantonFrom: 'answer' });
    expect(text(await call('get_status'))).toMatch(/tax year 2026, Geneva/);
    const s = await state(ws, 'fr');
    expect(s.canton).toEqual({ code: 'GE', name: 'Genève', from: 'answer', because: [] });
    expect(s.chips).toEqual(['Genève']);
    await call('answer_question', { id: 'civil_status', value: 'single' });
    await call('answer_question', { id: 'children', value: 0 });
    const commune = await call('answer_question', { id: 'commune', value: 'Lausanne' });
    expect(text(commune)).toMatch(/not a Geneva commune/);
  });

  it('keeps a Geneva return started before the question as Geneva’s, and says so', async () => {
    // A ledger written by an earlier version: Geneva answers, no canton.
    const root = path.join(
      (await makeWorkspace()).config.vaultPath,
      '..',
      `upgrade-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(path.join(root, '2026'), { recursive: true });
    const fact = (key: string, value: unknown, n: number) => ({
      id: `f_${String(n).padStart(16, '0')}`,
      key,
      person: 'household',
      taxYear: 2026,
      value,
      status: 'stated',
      source: { method: 'user', via: 'chat' },
      createdAt: '2026-10-01T00:00:00.000Z',
    });
    await writeFile(
      path.join(root, '2026', 'ledger.json'),
      JSON.stringify({
        version: 1,
        taxYear: 2026,
        facts: [
          fact('profile.civil_status', 'single', 1),
          fact('profile.children_count', 0, 2),
          fact('profile.commune', 'vernier', 3),
        ],
      }),
    );
    const ws = new Workspace(readConfig({ TAXPRESSO_VAULT_PATH: root }), new CantonRegistry(2026));
    const call = await connect(ws);
    const status = structured<Status>(await call('get_status'));
    expect(status).toMatchObject({
      canton: 'GE',
      cantonFrom: 'earlier_answers',
      cantonBecause: ['your commune is in Geneva'],
    });
    expect(status.progress.questionsAnswered).toBe(4);
    expect(text(await call('get_status'))).toMatch(
      /Canton: Geneva, taken from the user's earlier answers \(your commune is in Geneva\)/,
    );
    // The return goes on where it was: the next question is the next Geneva one.
    expect(text(await call('next_questions'))).toMatch(/\[moved\]/);
    const s = await state(ws);
    expect(s.canton).toMatchObject({ code: 'GE', from: 'earlier_answers' });
    expect(s.answers[0]).toMatchObject({ id: 'canton', answer: 'Canton of Geneva', assumed: true });
    // Nothing was written: the canton is not an answer until the user gives it.
    expect(ws.ledger.get('profile.canton')).toBeUndefined();
    await call('set_fact', { key: 'plan.gross_salary', value: 80_000 });
    expect(structured<{ computed: boolean }>(await call('compute_tax')).computed).toBe(true);

    // Once the user answers, it is their answer.
    await call('answer_question', { id: 'canton', value: 'GE' });
    expect(structured<Status>(await call('get_status'))).toMatchObject({
      canton: 'GE',
      cantonFrom: 'answer',
    });
  });

  it('keeps the facts when the user changes the canton, and asks again what differs', async () => {
    const ws = await makeWorkspace();
    const call = await connect(ws);
    await call('answer_question', { id: 'canton', value: 'GE' });
    await call('answer_question', { id: 'civil_status', value: 'married' });
    await call('answer_question', { id: 'children', value: 0 });
    await call('answer_question', { id: 'commune', value: 'Carouge' });
    await call('answer_question', { id: 'canton', value: 'other' });
    // The answers stay in the ledger; the canton question says it is not covered.
    expect(ws.ledger.get('profile.commune')?.value).toBe('carouge');
    expect(structured<Status>(await call('get_status')).notSupported).toEqual([
      'A canton other than Geneva, Zurich, Bern, Basel-Landschaft, Vaud, Basel-Stadt, Zug, Lucerne or Aargau',
    ]);
    await call('answer_question', { id: 'canton', value: 'GE' });
    expect(structured<Status>(await call('get_status')).progress.questionsAnswered).toBe(4);
  });

  it('takes Zurich and asks the Zurich questions, keeping the shared answers', async () => {
    const ws = await makeWorkspace();
    const call = await connect(ws);
    // The questions every canton shares can come before the canton.
    await call('answer_question', { id: 'civil_status', value: 'married' });
    await call('answer_question', { id: 'canton', value: 'ZH' });
    expect(structured<Status>(await call('get_status'))).toMatchObject({
      canton: 'ZH',
      cantonFrom: 'answer',
    });
    expect(text(await call('get_status'))).toMatch(/tax year 2026, Zurich/);
    await call('answer_question', { id: 'children', value: 0 });
    const q = await call('next_questions');
    expect(text(q)).toMatch(/\[commune\][\s\S]*Official page \(Current communal multipliers/);
    const uster = await call('answer_question', { id: 'commune', value: 'Uster' });
    expect(uster.isError).toBe(true);
    expect(text(uster)).toMatch(/"Uster" has 2 parts/);
    await call('answer_question', { id: 'commune', value: 'Uster, Teil 1 (Steuerfuss 112 %)' });
    await call('answer_question', { id: 'moved', value: 'from_other_canton' });
    const church = await call('next_questions');
    expect(text(church)).toMatch(/\[church:p1\]/);
    expect(text(church)).toMatch(/reformed = Reformed \(evangelisch-reformiert\)/);
    await call('answer_question', { id: 'church:p1', value: 'reformed' });
    await call('answer_question', { id: 'church:p2', value: 'none' });
    const status = structured<Status & { household: { summary: string[] } }>(
      await call('get_status'),
    );
    expect(status.notSupported).toEqual([]);
    expect(status.household.summary).toEqual([
      'Zurich',
      'Married',
      'No children',
      'Uster, Teil 1 (Steuerfuss 112 %)',
      'Moved from another canton',
      'Reformed',
    ]);
    // The same answers in the dashboard, in French.
    const s = await state(ws, 'fr');
    expect(s.canton).toMatchObject({ code: 'ZH', name: 'Zurich' });
    expect(s.question?.id).toBe('income_sources:p1');
    // Taxed at source: not covered in Zurich yet, said plainly with Zurich's own software.
    await call('answer_question', { id: 'income_sources:p1', value: ['salary'] });
    await call('answer_question', { id: 'employers:p1', value: 1 });
    const source = await call('answer_question', { id: 'taxed_at_source:p1', value: true });
    expect(text(source)).toMatch(/Not supported yet: Tax at source in Zurich .*ZHprivateTax/);
  });
});

describe('the canton registry', () => {
  it('gives the ledger every key of every canton, joining the choices of a shared key', () => {
    const r = new CantonRegistry(2026);
    expect(r.ledgerKeys['profile.canton']?.values).toEqual([
      'GE',
      'ZH',
      'BE',
      'BL',
      'VD',
      'BS',
      'ZG',
      'LU',
      'AG',
      'other',
    ]);
    expect(r.ledgerKeys['salary.gross']?.type).toBe('money');
    const joined = mergeKeys([
      { k: { type: 'enum', values: ['a'], perPerson: false, label: { en: 'K', fr: 'K' } } },
      { k: { type: 'enum', values: ['b'], perPerson: false, label: { en: 'K', fr: 'K' } } },
    ]);
    expect(joined.k?.values).toEqual(['a', 'b']);
    expect(() =>
      mergeKeys([
        { k: { type: 'enum', values: ['a'], perPerson: false, label: { en: 'K', fr: 'K' } } },
        { k: { type: 'money', perPerson: false, label: { en: 'K', fr: 'K' } } },
      ]),
    ).toThrow(/differs between cantons/);
  });
});
