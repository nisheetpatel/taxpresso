// The no-change proof of the derived source tax (docs/sources/ge/NOTES.md, "Source tax from plain
// facts"): records every tool result, dashboard state and API response for the synthetic
// households (Dupont, Ribeiro) and a seeded fuzz of households in every canton, normalized for
// random ids, tokens, times and temporary paths. Unlike record-years.test.ts, every answer and
// every figure is drawn from the household's seed and the question's id (not from a running
// sequence), so a question added or removed doesn't change any other answer: the records of a
// household before and after a change of the questions can be compared one by one.
//
// The same question in both versions: "taxed at source?" was asked (before), "Swiss, C permit or
// another permit?" is asked (after). A person is drawn as taxed at source with a fixed chance; the
// answer to either question follows from it, so a household taxed at source in one version is in
// the other too, and one that isn't, isn't.
//
// Skipped unless TAXPRESSO_RECORD_ST names the output file (it takes a few minutes):
//
//   TAXPRESSO_RECORD_ST=/tmp/before.jsonl TAXPRESSO_RECORD_N=8 pnpm vitest run extension/test/record-source-tax.test.ts
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { documentFields } from '@taxpresso/rules-ge';
import { describe, it } from 'vitest';
import { createApi } from '../src/api.js';
import { Dashboard } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

const OUT = process.env.TAXPRESSO_RECORD_ST;
const N = Number(process.env.TAXPRESSO_RECORD_N ?? 8);
const CANTONS = (process.env.TAXPRESSO_RECORD_CANTONS ?? 'GE,ZH,BE,BL,VD,BS,ZG,LU,SG,FR,TI').split(
  ',',
);
/** The chance that a person with a salary is taxed at source. */
const AT_SOURCE = 0.3;
const fixtures = path.resolve(import.meta.dirname, '..', '..', 'test', 'fixtures');

/** A number in [0, 1) from the household's seed and a label: the same label, the same number. */
function draw(seed: number, label: string): number {
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let t = (h + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Random ids, tokens, times and temporary paths out of a record. */
function normalize(value: unknown, root: string): string {
  return JSON.stringify(value)
    .split(root)
    .join('<ROOT>')
    .replace(/\/(private\/)?var\/folders\/[^"\\ ]+?taxpresso-(ws|ui)-[A-Za-z0-9]+/g, '<TMP>')
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z\b/g, '<TIME>')
    .replace(/\bf_[A-Za-z0-9_-]{6,}\b/g, '<FACT>')
    .replace(/"csrf":"[^"]*"/g, '"csrf":"<CSRF>"')
    .replace(/http:\/\/127\.0\.0\.1:\d+\/[^"\\ ]*/g, '<URL>')
    .replace(
      /Taxpresso-(\d{4})-export-\d{4}-\d{2}-\d{2}(-\d+)?\.zip/g,
      'Taxpresso-$1-export-<DAY>.zip',
    )
    .replace(/"etag":"[^"]*"/g, '"etag":"<ETAG>"');
}

interface Household {
  id: string;
  canton: string;
  seed: number;
  documents: string[];
}

const SCENARIOS: Household[] = [
  {
    id: 'dupont',
    canton: 'GE',
    seed: 1,
    documents: [
      'dupont-declaration-2025.pdf',
      'dupont-certificat-salaire-2026.pdf',
      'brokers/dupont-ibkr-2026.xml',
      'brokers/dupont-degiro-portfolio.csv',
      'brokers/dupont-degiro-account.csv',
      'dupont-declaration-2026.pdf',
    ],
  },
  { id: 'ribeiro', canton: 'GE', seed: 2, documents: ['ribeiro-declaration-2025.pdf'] },
  {
    id: 'dupont-two-employers',
    canton: 'GE',
    seed: 3,
    documents: ['dupont-declaration-2025-two-employers.pdf', 'dupont-scan-3a-2026.pdf'],
  },
  {
    id: 'dupont-barcodes',
    canton: 'GE',
    seed: 4,
    documents: [
      'barcodes/dupont-certificat-salaire-2026-vectoriel.pdf',
      'barcodes/dupont-releve-fiscal-2026.pdf',
      'brokers/dupont-ibkr-2026-usd-base.xml',
    ],
  },
];

const POOL = [
  'dupont-certificat-salaire-2026.pdf',
  'dupont-declaration-2025.pdf',
  'ribeiro-declaration-2025.pdf',
  'dupont-scan-3a-2026.pdf',
  'brokers/dupont-ibkr-2026.xml',
  'brokers/dupont-degiro-portfolio.csv',
];

interface QuestionOut {
  id: string;
  type: string;
  options?: { value: string }[];
  min?: number;
  max?: number;
}

async function run(h: Household): Promise<void> {
  const uiDir = await makeUiDir();
  const ws = await makeWorkspace(uiDir);
  const root = path.dirname(ws.vault.root);
  const dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(ws) });
  const server = createTaxpressoServer({ workspace: ws, dashboard });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'record', version: '0' });
  await client.connect(clientSide);
  const d = (label: string) => draw(h.seed, label);
  const pick = <T>(label: string, xs: readonly T[]): T => xs[Math.floor(d(label) * xs.length)]!;
  let phase = 'questions';
  const record = (kind: string, name: string, args: unknown, result: unknown) =>
    appendFileSync(
      OUT!,
      normalize({ h: h.id, phase, kind, name, args, result }, root) + '\n',
      'utf8',
    );
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    let result: unknown;
    try {
      const res = await client.callTool({ name, arguments: args });
      result = { content: res.content, structured: res.structuredContent, isError: res.isError };
    } catch (err) {
      result = { thrown: (err as Error).message };
    }
    record('tool', name, args, result);
    return result as { structured?: Record<string, unknown>; isError?: boolean };
  };
  const api = async (method: 'GET' | 'POST', p: string, body?: unknown, lang = 'en') => {
    const query = new URLSearchParams({ lang });
    let result: unknown;
    try {
      result = await createApi(ws)({
        method,
        path: p,
        query,
        headers: {},
        body: Buffer.from(body === undefined ? '' : JSON.stringify(body)),
        csrf: 'x',
      });
    } catch (err) {
      result = { thrown: (err as Error).message };
    }
    record('api', `${method} ${p}`, body ?? null, result);
  };

  // What was answered, by question id: a person's income decides their permit (see the header).
  const given = new Map<string, unknown>();
  const salaried = (person: string) => {
    const v = given.get(`income_sources:${person}`);
    return Array.isArray(v) && v.includes('salary');
  };
  const atSource = (person: string) => d(`atSource:${person}`) < AT_SOURCE;
  const answerFor = (q: QuestionOut): unknown => {
    const person = q.id.split(':')[1] ?? 'household';
    const values = (q.options ?? []).map((o) => o.value);
    if (q.id === 'canton') return h.canton;
    if (q.id.startsWith('taxed_at_source:')) return atSource(person);
    if (q.id.startsWith('residence:')) {
      if (atSource(person) && salaried(person) && values.includes('permit_other')) {
        return 'permit_other';
      }
      return pick(
        `residence:${person}`,
        values.filter((v) => v === 'swiss' || v === 'permit_c'),
      );
    }
    if (q.type === 'yesno') return d(`yes:${q.id}`) < 0.5;
    if (q.type === 'number') {
      return Math.min(q.max ?? 3, (q.min ?? 0) + Math.floor(d(`n:${q.id}`) * 3));
    }
    if (q.type === 'money') return String(Math.floor(d(`m:${q.id}`) * 5000));
    if (q.type === 'commune') return pick(`commune:${q.id}`, ws.engine.communes).name;
    if (q.type === 'multi') return values.filter((v) => d(`multi:${q.id}:${v}`) < 0.35);
    return pick(`choice:${q.id}`, values);
  };

  try {
    await call('get_status');
    for (let i = 0; i < 60; i++) {
      const q = (await call('next_questions', { limit: 1 })).structured as
        { questions: QuestionOut[] } | undefined;
      const question = q?.questions?.[0];
      if (!question) break;
      const value = answerFor(question);
      given.set(question.id, value);
      if (d(`via:${question.id}`) < 0.3) await api('POST', '/answer', { id: question.id, value });
      else await call('answer_question', { id: question.id, value });
    }
    phase = 'after';
    await call('get_status');
    await api('GET', '/state', undefined, pick('lang1', ['en', 'fr', 'de', 'it']));
    // Documents: the household's own, or some from the pool.
    const docs = h.documents.length ? h.documents : POOL.filter((f) => d(`doc:${f}`) < 0.3);
    for (const file of docs) {
      const bytes = readFileSync(path.join(fixtures, file));
      await ws.addDocument(new Uint8Array(bytes), path.basename(file), 'dashboard');
      record('doc', file, null, null);
    }
    const listed = (await call('list_documents')).structured as
      { documents: { id: string; kind?: string; read: boolean; filename: string }[] } | undefined;
    for (const doc of listed?.documents ?? []) {
      if (doc.read) continue;
      const kind =
        doc.kind ??
        pick(`kind:${doc.filename}`, [
          'salary_certificate',
          'pillar3a_attestation',
          'health_premiums',
        ]);
      const keys = documentFields(kind as never).slice(0, 3);
      await call('propose_extraction', {
        id: doc.id,
        document: { kind, taxYear: 2026, person: 'p1' },
        values: keys.map((key) => ({
          key,
          value: `${Math.floor(d(`value:${doc.filename}:${key}`) * 90_000)}.00`,
          page: 1,
        })),
      });
      if (d(`confirm:${doc.filename}`) < 0.5) {
        await call('set_fact', { instance: doc.id, confirm: true });
      }
    }
    // Plans and TOU.
    await call('set_fact', {
      key: 'plan.gross_salary',
      value: Math.floor(d('plan.gross') * 150_000),
    });
    if (d('plan.paid') < 0.5) await call('set_fact', { key: 'plan.pillar3a_paid', value: 2000 });
    if (d('plan.capacity') < 0.4) {
      await call('set_fact', { key: 'plan.lpp_buyin_capacity', value: 30000 });
    }
    if (d('plan.amount') < 0.4) {
      await call('set_fact', { key: 'plan.lpp_buyin_amount', value: 10000 });
    }
    if (d('plan.paid2025') < 0.4) {
      await call('set_fact', { key: 'plan.pillar3a_paid_2025', value: 1000 });
    }
    if (d('plan.tariff') < 0.3) {
      await call('set_fact', { key: 'plan.source_tax_tariff', value: 'A0' });
    }
    await api('POST', '/planning', { person: 'p1', field: 'withheld', value: 5000 });
    for (const name of [
      'get_status',
      'list_documents',
      'list_optimizations',
      'get_holdings',
      'get_last_year',
      'review_last_year',
      'final_check',
      'reconcile_official_pdf',
      'get_form_values',
    ]) {
      await call(name);
    }
    await call('compute_tax', { detail: true });
    await call('compute_tax');
    await call('get_form_values', { section: 'A1' });
    await call('decide_optimization', { id: 'tou', choice: 'decline', confirmed: false });
    for (const lang of ['en', 'fr', 'de', 'it']) await api('GET', '/state', undefined, lang);
    // Which people were drawn as taxed at source, for the comparison (not a tool result).
    record(
      'drawn',
      'atSource',
      null,
      ['p1', 'p2'].filter((p) => atSource(p) && salaried(p)),
    );
  } finally {
    await client.close();
    await dashboard.stop();
  }
}

describe.skipIf(!OUT)('record tool results and dashboard states, answer by answer', () => {
  it('records the synthetic households and the fuzz', { timeout: 3_600_000 }, async () => {
    writeFileSync(OUT!, '', 'utf8');
    for (const h of SCENARIOS) await run(h);
    let seed = 5000;
    for (const canton of CANTONS) {
      for (let i = 0; i < N; i++) {
        await run({ id: `${canton}-${i}`, canton, seed: seed++, documents: [] });
      }
    }
  });
});
