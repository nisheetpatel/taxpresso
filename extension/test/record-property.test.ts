// The no-change proof of property in Geneva (docs/sources/ge/NOTES.md, "Property in Geneva"):
// records every tool result, dashboard state and API response for the synthetic households
// (Dupont, Ribeiro, Keller), households with a home or land abroad, and a seeded fuzz of households
// in every canton, for one tax year, normalized for random ids, tokens, times and temporary paths.
// As in record-abroad.test.ts, every answer and every figure is drawn from the household's seed and
// the question's id, so a question or an option added doesn't change any other answer. No household
// here owns property in Switzerland (that option is never chosen); a home or land abroad is chosen
// like any other answer, and every household that has one gives its rough value (and rent), so the
// property-abroad households are part of the proof.
//
// The words of the special-cases question change with the feature (Geneva's explanation and its
// real-estate option): MASKS replaces them, before and after alike, with a token; the proof lists
// them. Everything else is compared as it is.
//
// Small on disk: during the questions only the questions answered are recorded; after them, each
// record is a sha256 of its normalized content. Compare the two files line by line.
// TAXPRESSO_RECORD_FULL=1 keeps whole records instead, to see a difference.
//
// Skipped unless TAXPRESSO_RECORD_PROP names the output file (it takes a few minutes):
//
//   TAXPRESSO_RECORD_PROP=/tmp/before.jsonl TAXPRESSO_RECORD_N=12 pnpm exec vitest run extension/test/record-property.test.ts
//   TAXPRESSO_RECORD_PROP=/tmp/before-2025.jsonl TAXPRESSO_RECORD_YEAR=2025 pnpm exec vitest run extension/test/record-property.test.ts
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
import { TaxYears } from '../src/years.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

const OUT = process.env.TAXPRESSO_RECORD_PROP;
const N = Number(process.env.TAXPRESSO_RECORD_N ?? 12);
const CANTONS = (
  process.env.TAXPRESSO_RECORD_CANTONS ?? 'GE,ZH,BE,BL,VD,BS,ZG,LU,SG,FR,TI,AG'
).split(',');
/** Another tax year than the default, opened first with open_tax_year. */
const YEAR = process.env.TAXPRESSO_RECORD_YEAR
  ? Number(process.env.TAXPRESSO_RECORD_YEAR)
  : undefined;
const FULL = process.env.TAXPRESSO_RECORD_FULL === '1';
const fixtures = path.resolve(import.meta.dirname, '..', '..', 'test', 'fixtures');
/** The chance that a person with a salary is taxed at source. */
const AT_SOURCE = 0.3;
/** Options never chosen here: what the households of this proof don't have. */
const NEVER = new Set(['real_estate']);
/**
 * The words of the special-cases question that the feature changes, in every language: replaced
 * by a token before and after alike. Each entry is a text as it is before or after the change.
 */
const MASKS: readonly [string, string][] = [
  // Geneva's explanation of the special cases (data/ge/2026/questionnaire.yaml, special).
  [
    'Most of these need checks that Taxpresso can’t do yet. Better to know now than in March. A lump sum from your pension fund or pillar 3a, and a home or land abroad, are the exceptions: Taxpresso computes the separate tax on the lump sum, and counts the property abroad for your rate.',
    '<SPECIAL_EXPLAIN>',
  ],
  [
    'La plupart de ces situations demandent des vérifications que Taxpresso ne sait pas encore faire. Mieux vaut le savoir maintenant qu’en mars. Un capital de votre caisse de pension ou du 3e pilier A, et un logement ou un terrain à l’étranger, font exception : Taxpresso calcule l’impôt séparé sur le capital, et compte l’immeuble à l’étranger pour votre taux.',
    '<SPECIAL_EXPLAIN>',
  ],
  [
    'Die meisten davon brauchen Abklärungen, die Taxpresso noch nicht kann. Besser jetzt wissen als im März. Ein Kapitalbezug aus der Pensionskasse oder der Säule 3a und eine Wohnung oder ein Grundstück im Ausland sind die Ausnahmen: Taxpresso berechnet die separate Steuer auf dem Kapital und zählt die Liegenschaft im Ausland für deinen Steuersatz.',
    '<SPECIAL_EXPLAIN>',
  ],
  [
    'La maggior parte di queste situazioni richiede verifiche che Taxpresso non sa ancora fare. Meglio saperlo ora che a marzo. Un capitale della tua cassa pensione o del pilastro 3a, e un’abitazione o un terreno all’estero, fanno eccezione: Taxpresso calcola l’imposta separata sul capitale e conta l’immobile all’estero per la tua aliquota.',
    '<SPECIAL_EXPLAIN>',
  ],
];

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

/** Random ids, tokens, times, temporary paths and the masked words out of a record. */
function normalize(value: unknown, root: string): string {
  let s = JSON.stringify(value)
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
  for (const [text, token] of MASKS) {
    // As the texts travel in JSON: their quotes and no-break spaces as JSON.stringify writes them.
    s = s.split(JSON.stringify(text).slice(1, -1)).join(token);
  }
  return s;
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
  { id: 'keller-2025', canton: 'GE', seed: 13, documents: ['keller-avis-taxation-2025.pdf'] },
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
  const record = (kind: string, name: string, args: unknown, result: unknown) => {
    if (FULL) {
      appendFileSync(OUT!, normalize({ h: h.id, phase, kind, name, args, result }, root) + '\n');
      return;
    }
    // During the questions: only which question was answered.
    if (phase === 'questions') {
      const id = (args as { id?: string } | null)?.id;
      if ((name === 'answer_question' || name === 'POST /answer') && id) {
        appendFileSync(OUT!, JSON.stringify({ h: h.id, phase, answered: id }) + '\n');
      }
      return;
    }
    const content = normalize({ args, result }, root);
    const sha = createHash('sha256').update(content).digest('hex').slice(0, 16);
    appendFileSync(OUT!, JSON.stringify({ h: h.id, phase, kind, name, sha }) + '\n');
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

  // What was answered, by question id: a person's income decides their permit.
  const given = new Map<string, unknown>();
  const salaried = (person: string) => {
    const v = given.get(`income_sources:${person}`);
    return Array.isArray(v) && v.includes('salary');
  };
  const atSource = (person: string) => d(`atSource:${person}`) < AT_SOURCE;
  let cur = ws;
  const answerFor = (q: QuestionOut): unknown => {
    const person = q.id.split(':')[1] ?? 'household';
    const values = (q.options ?? []).map((o) => o.value).filter((v) => !NEVER.has(v));
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
    if (q.type === 'commune') return pick(`commune:${q.id}`, cur.engine.communes).name;
    if (q.type === 'multi') return values.filter((v) => d(`multi:${q.id}:${v}`) < 0.35);
    return pick(`choice:${q.id}`, values);
  };

  try {
    if (YEAR !== undefined) {
      await call('open_tax_year', { year: YEAR });
      cur = TaxYears.of(ws).current;
    }
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
      await cur.addDocument(new Uint8Array(bytes), path.basename(file), 'dashboard');
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
        document: { kind, taxYear: YEAR ?? 2026, person: 'p1' },
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
    // A home or land abroad: its rough value, and its rent when it is let, as the user says them.
    const special = given.get('special');
    if (Array.isArray(special) && special.includes('property_abroad')) {
      const value = 50_000 + Math.floor(d('abroad.value') * 600_000);
      await call('set_fact', { key: 'plan.abroad_value', value: `${value} EUR` });
      if (given.get('abroad_property') === 'let') {
        const rent = 2_000 + Math.floor(d('abroad.rent') * 20_000);
        await call('set_fact', { key: 'plan.abroad_rent', value: `${rent} EUR` });
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
    for (const section of ['A1', 'PG2', 'PG3', 'PG4', 'D1', 'D2', 'E1']) {
      await call('get_form_values', { section });
    }
    await call('decide_optimization', { id: 'tou', choice: 'decline', confirmed: false });
    for (const lang of ['en', 'fr', 'de', 'it']) await api('GET', '/state', undefined, lang);
  } finally {
    await client.close();
    await dashboard.stop();
  }
}

describe.skipIf(!OUT)(
  'record tool results and dashboard states, without property in Switzerland',
  () => {
    it('records the synthetic households and the fuzz', { timeout: 3_600_000 }, async () => {
      writeFileSync(OUT!, '', 'utf8');
      for (const h of YEAR === 2025 ? SCENARIOS_2025 : SCENARIOS) await run(h);
      let seed = 9000;
      for (const canton of CANTONS) {
        for (let i = 0; i < N; i++) {
          await run({ id: `${canton}-${i}`, canton, seed: seed++, documents: [] });
        }
      }
    });
  },
);
