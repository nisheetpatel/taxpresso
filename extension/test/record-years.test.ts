// The no-change proof of the tax-year choice (docs/design/tax-years.md): records every tool result,
// dashboard state and API response for the synthetic households (Dupont, Ribeiro) and a seeded fuzz
// of households walked through the questions, documents and plans in every canton, normalized for
// random ids, tokens, times and temporary paths. Run before and after a change, then compare the
// two files. Skipped unless TAXPRESSO_RECORD names the output file (it takes a few minutes).
// TAXPRESSO_RECORD_HASH=1 keeps each record small on disk: a sha256 of its normalized content in
// place of the content (rerun the households that differ without it to see the difference).
//
//   TAXPRESSO_RECORD=/tmp/before.jsonl TAXPRESSO_RECORD_N=20 pnpm vitest run extension/test/record-years.test.ts
import { createHash } from 'node:crypto';
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

const OUT = process.env.TAXPRESSO_RECORD;
const N = Number(process.env.TAXPRESSO_RECORD_N ?? 20);
const HASH = process.env.TAXPRESSO_RECORD_HASH === '1';
const CANTONS = (process.env.TAXPRESSO_RECORD_CANTONS ?? 'GE,ZH,BE,BL,VD,BS,ZG,LU,SG').split(',');
/** Another tax year than the default, opened first with open_tax_year (only once it exists). */
const YEAR = process.env.TAXPRESSO_RECORD_YEAR
  ? Number(process.env.TAXPRESSO_RECORD_YEAR)
  : undefined;
const fixtures = path.resolve(import.meta.dirname, '..', '..', 'test', 'fixtures');

/** mulberry32: a small seeded generator, so the fuzz is the same households every run. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

/** 2025: last year's declaration is 2024's, and the 2025 one is the declaration to check. */
const SCENARIOS_2025: Household[] = [
  {
    id: 'dupont-2025',
    canton: 'GE',
    seed: 11,
    documents: [
      'dupont-declaration-2024.pdf',
      'dupont-certificat-salaire-2026.pdf',
      'brokers/dupont-ibkr-2026.xml',
      'dupont-declaration-2025.pdf',
    ],
  },
  { id: 'ribeiro-2025', canton: 'GE', seed: 12, documents: ['ribeiro-declaration-2025.pdf'] },
];

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
  const random = rng(h.seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)]!;
  let n = 0;
  const record = (kind: string, name: string, args: unknown, result: unknown) => {
    const line = normalize({ h: h.id, n: n++, kind, name, args, result }, root);
    const sha = HASH && createHash('sha256').update(line).digest('hex').slice(0, 16);
    appendFileSync(
      OUT!,
      (sha ? JSON.stringify({ h: h.id, n: n - 1, kind, name, sha }) : line) + '\n',
      'utf8',
    );
  };
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
      const res = await createApi(ws)({
        method,
        path: p,
        query,
        headers: {},
        body: Buffer.from(body === undefined ? '' : JSON.stringify(body)),
        csrf: 'x',
      });
      result = res;
    } catch (err) {
      result = { thrown: (err as Error).message };
    }
    record('api', `${method} ${p}`, body ?? null, result);
  };

  try {
    // The open year's workspace: the one made here, or the year opened (src/years.ts, once it exists).
    let cur = ws;
    if (YEAR !== undefined) {
      await call('open_tax_year', { year: YEAR });
      cur = (await import('../src/years.js')).TaxYears.of(ws).current;
    }
    await call('get_status');
    // Questions, answered in the chat or in the dashboard, with random valid answers.
    for (let i = 0; i < 40; i++) {
      const q = (await call('next_questions', { limit: 1 })).structured as
        | {
            questions: {
              id: string;
              type: string;
              options?: { value: string }[];
              min?: number;
              max?: number;
            }[];
          }
        | undefined;
      const question = q?.questions?.[0];
      if (!question) break;
      let value: unknown;
      if (question.id === 'canton') value = h.canton;
      else if (question.type === 'yesno') value = random() < 0.5;
      else if (question.type === 'number')
        value = Math.min(question.max ?? 3, (question.min ?? 0) + Math.floor(random() * 3));
      else if (question.type === 'money') value = String(Math.floor(random() * 5000));
      else if (question.type === 'commune') value = pick(cur.engine.communes).name;
      else if (question.type === 'multi') {
        const opts = (question.options ?? []).map((o) => o.value);
        value = opts.filter(() => random() < 0.35);
      } else value = pick((question.options ?? []).map((o) => o.value));
      if (random() < 0.3) await api('POST', '/answer', { id: question.id, value });
      else await call('answer_question', { id: question.id, value });
      if (random() < 0.15) await call('get_status');
    }
    await call('get_status');
    await api('GET', '/state', undefined, pick(['en', 'fr', 'de']));
    // Documents: the household's own, or some from the pool.
    const docs = h.documents.length ? h.documents : POOL.filter(() => random() < 0.3);
    for (const file of docs) {
      const bytes = readFileSync(path.join(fixtures, file));
      await cur.addDocument(new Uint8Array(bytes), path.basename(file), 'dashboard');
      record('doc', file, null, null);
    }
    const listed = (await call('list_documents')).structured as
      { documents: { id: string; kind?: string; read: boolean }[] } | undefined;
    for (const d of listed?.documents ?? []) {
      if (d.read) continue;
      const kind =
        d.kind ?? pick(['salary_certificate', 'pillar3a_attestation', 'health_premiums']);
      const keys = documentFields(kind as never).slice(0, 3);
      await call('propose_extraction', {
        id: d.id,
        document: { kind, taxYear: YEAR ?? 2026, person: 'p1' },
        values: keys.map((key) => ({ key, value: `${Math.floor(random() * 90_000)}.00`, page: 1 })),
      });
      if (random() < 0.5) await call('set_fact', { instance: d.id, confirm: true });
    }
    // Plans and TOU.
    await call('set_fact', { key: 'plan.gross_salary', value: Math.floor(random() * 150_000) });
    if (random() < 0.5) await call('set_fact', { key: 'plan.pillar3a_paid', value: 2000 });
    if (random() < 0.4) await call('set_fact', { key: 'plan.lpp_buyin_capacity', value: 30000 });
    if (random() < 0.4) await call('set_fact', { key: 'plan.lpp_buyin_amount', value: 10000 });
    if (random() < 0.4) await call('set_fact', { key: 'plan.pillar3a_paid_2025', value: 1000 });
    if (random() < 0.3) await call('set_fact', { key: 'plan.source_tax_tariff', value: 'A0' });
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
    for (const lang of ['en', 'fr', 'de']) await api('GET', '/state', undefined, lang);
  } finally {
    await client.close();
    await dashboard.stop();
  }
}

describe.skipIf(!OUT)('record tool results and dashboard states', () => {
  it('records the synthetic households and the fuzz', { timeout: 3_600_000 }, async () => {
    writeFileSync(OUT!, '', 'utf8');
    for (const h of YEAR === 2025 ? SCENARIOS_2025 : SCENARIOS) await run(h);
    let seed = 1000;
    for (const canton of CANTONS) {
      for (let i = 0; i < N; i++) {
        await run({ id: `${canton}-${i}`, canton, seed: seed++, documents: [] });
      }
    }
  });
});
