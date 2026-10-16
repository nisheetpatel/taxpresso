// The filing kits end to end (test/fixtures/households/README.md): five invented Geneva households
// whose tax was worked out by hand from the official documents (expected.json, written by
// ground-truth.mjs, which imports nothing from Taxpresso). For each kit and each year it covers:
// a fresh Taxpresso folder (a temporary one, never ~/Documents/Taxpresso) with the documents dropped
// in, the answers of household.json, Claude's readings of the documents without a barcode
// (extracted.json) proposed and then confirmed by the user in the dashboard, and the tax compared
// with the hand calculation to the centime. When everything is in, the dashboard says "Exact".
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import { KITS } from '../../test/fixtures/households/kits.mjs';
import { buildDocuments } from '../../test/fixtures/households/make.mjs';
import { createApi, type DashboardState } from '../src/api.js';
import { readConfig } from '../src/config.js';
import { type ApiRequest, Dashboard } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import { TaxYears } from '../src/years.js';
import { makeUiDir } from './helpers.js';

const KIT_DIR = fileURLToPath(new URL('../../test/fixtures/households/', import.meta.url));

interface Line {
  amount: number;
}
interface Expected {
  icc: {
    taxableIncome: Line;
    rateIncome: Line;
    taxableWealth: Line;
    cantonalIncome: Line;
    cantonalWealth: Line;
    communal: Line;
    personalTax: Line;
    total: Line;
    withholdingTaxCredit?: Line;
  };
  ifd: { taxableIncome: Line; tax: Line };
  total: Line;
}
interface Reading {
  file: string;
  kind: string;
  read: 'barcode' | 'export' | 'prior' | 'claude';
  owner?: 'p1' | 'p2';
  person?: 'p1' | 'p2' | 'household';
  taxYear?: number;
  values?: { key: string; value: string; page: number; box?: string }[];
  official?: { security: string; officialValue: string; from: string }[];
}
interface TaxOut {
  computed: boolean;
  total: number;
  icc: {
    total: number;
    cantonalIncome: number;
    cantonalWealth: number;
    communal: number;
    personalTax: number;
    taxableIncome: number;
    rateIncome: number;
    taxableWealth: number;
    withholdingTaxCredit?: number;
  } | null;
  ifd: { tax: number; taxableIncome: number } | null;
  estimates: string[];
  needsOk: number;
  unsupported: string[];
  notSupported: string[];
  detail?: { iccItems: unknown[]; ifdItems: unknown[]; wealthItems: unknown[] };
}

const json = async <T>(...parts: string[]): Promise<T> =>
  JSON.parse(await readFile(path.join(KIT_DIR, ...parts), 'utf8')) as T;

/** One household's year through the extension, as a user and Claude would go through it. */
async function runKit(slug: string, year: number) {
  const kit = KITS.find((k) => k.slug === slug)!;
  const household = await json<{
    answers: Record<string, unknown>;
    answersByYear?: Record<string, Record<string, unknown>>;
  }>(slug, 'household.json');
  const answers = { ...household.answers, ...household.answersByYear?.[year] };
  const readings = (await json<{ years: Record<string, Reading[]> }>(slug, 'extracted.json')).years[
    year
  ]!;
  const expected = (await json<{ years: Record<string, Expected> }>(slug, 'expected.json')).years[
    year
  ]!;

  const uiDir = await makeUiDir();
  const root = await mkdtemp(path.join(os.tmpdir(), 'taxpresso-kit-'));
  const years = new TaxYears(
    readConfig({ TAXPRESSO_VAULT_PATH: path.join(root, 'Taxpresso'), TAXPRESSO_UI_DIR: uiDir }),
  );
  const api = createApi(years);
  const dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api });
  const server = createTaxpressoServer({ years, dashboard });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'kits', version: '0' });
  await client.connect(clientSide);
  type Result = Awaited<ReturnType<Client['callTool']>>;
  const text = (r: Result) =>
    (r.content as { text?: string }[]).map((c) => c.text ?? '').join('\n');
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await client.callTool({ name, arguments: args });
    expect(r.isError, `${name}: ${text(r)}`).toBeFalsy();
    return r;
  };
  /** What the user does in the dashboard. */
  const user = async (route: string, body: unknown) => {
    const req: ApiRequest = {
      method: 'POST',
      path: route,
      query: new URLSearchParams('lang=en'),
      headers: {},
      body: Buffer.from(JSON.stringify(body)),
      csrf: 'csrf-token',
    };
    const res = await api(req);
    expect(res.status, `${route}: ${JSON.stringify(res.body)}`).toBe(200);
    return res.body as DashboardState;
  };
  try {
    await call('open_tax_year', { year });
    const ws = years.current;
    await ws.ready();
    expect(ws.taxYear).toBe(year);

    // 1. The documents go into the year's folder, and Taxpresso sorts them.
    const docs =
      year === 2025
        ? await Promise.all(
            (await readdir(path.join(KIT_DIR, slug, 'documents'))).sort().map(async (file) => ({
              file,
              bytes: await readFile(path.join(KIT_DIR, slug, 'documents', file)),
            })),
          )
        : await buildDocuments(kit, year);
    expect(docs.map((d) => d.file).sort()).toEqual(readings.map((r) => r.file).sort());
    await mkdir(ws.vault.dir, { recursive: true });
    for (const d of docs) await writeFile(path.join(ws.vault.dir, d.file), d.bytes);
    await call('ingest_vault');
    const doc = (file: string) => {
      const found = ws.documents.find((d) => d.filename === file);
      expect(found, file).toBeDefined();
      return found!;
    };

    // 2. The questions, in the order Taxpresso asks them; each answer is the household's.
    const used = new Set<string>();
    /** What last year's declaration suggested, per question (the user confirms each). */
    const suggested: Record<string, unknown> = {};
    const answerAll = async () => {
      for (let i = 0; i < 80; i++) {
        const next = (await call('next_questions')).structuredContent as {
          questions: { id: string; suggested?: { value: unknown } }[];
        };
        const q = next.questions[0];
        if (!q) return;
        if (q.suggested) suggested[q.id] = q.suggested.value;
        expect(Object.keys(answers), `asked ${q.id}`).toContain(q.id);
        if (used.has(q.id)) throw new Error(`${q.id} asked again`);
        used.add(q.id);
        await call('answer_question', { id: q.id, value: answers[q.id] });
      }
    };
    await answerAll();

    // 3. The documents: whose a barcode certificate is (a couple), Claude's readings proposed and
    // the user's OK in the dashboard, a broker export confirmed and its official values given.
    for (const r of readings) {
      const d = doc(r.file);
      if (r.read === 'barcode') {
        expect(d.parse.method, `${r.file}: ${JSON.stringify(d.parse)}`).toMatch(/^barcode/);
        expect(d.kind).toBe(r.kind);
        if (r.owner) await call('set_document_owner', { id: d.id, person: r.owner });
      } else if (r.read === 'claude') {
        await call('propose_extraction', {
          id: d.id,
          document: { kind: r.kind, taxYear: r.taxYear, person: r.person },
          values: r.values,
        });
        await user('/documents/confirm', { id: d.id });
      } else if (r.read === 'export') {
        expect(d.kind).toBe('broker_export');
        await user('/documents/confirm', { id: d.id });
        for (const o of r.official ?? []) await call('set_holding', o);
      } else {
        expect(d.kind).toBe('prior_declaration');
      }
    }
    await answerAll();
    expect(
      Object.keys(answers).filter((id) => !used.has(id)),
      'every answer of household.json was asked',
    ).toEqual([]);
    if (readings.some((r) => r.read === 'prior')) {
      // Last year's declaration filled in suggestions, and each one is what the household says.
      expect(Object.keys(suggested).length).toBeGreaterThanOrEqual(5);
      for (const [id, value] of Object.entries(suggested)) {
        // The commune comes back as its slug ("lancy"); the household names it ("Lancy").
        const said = id === 'commune' ? String(answers[id]).toLowerCase() : answers[id];
        expect(value, `suggestion for ${id}`).toEqual(said);
      }
      expect(suggested.commune, 'the commune, read from its code').toBeDefined();
    }

    // 4. The tax, to the centime.
    const out = (await call('compute_tax', { detail: true })).structuredContent as TaxOut;
    expect(out.unsupported, 'nothing left out').toEqual([]);
    expect(out.notSupported).toEqual([]);
    expect(out.needsOk, 'nothing waits for the user’s OK').toBe(0);
    const got = {
      'icc.taxableIncome': out.icc?.taxableIncome,
      'icc.rateIncome': out.icc?.rateIncome,
      'icc.taxableWealth': out.icc?.taxableWealth,
      'icc.cantonalIncome': out.icc?.cantonalIncome,
      'icc.cantonalWealth': out.icc?.cantonalWealth,
      'icc.communal': out.icc?.communal,
      'icc.personalTax': out.icc?.personalTax,
      'icc.total': out.icc?.total,
      'icc.withholdingTaxCredit': out.icc?.withholdingTaxCredit,
      'ifd.taxableIncome': out.ifd?.taxableIncome,
      'ifd.tax': out.ifd?.tax,
      total: out.total,
    };
    const want = {
      'icc.taxableIncome': expected.icc.taxableIncome.amount,
      'icc.rateIncome': expected.icc.rateIncome.amount,
      'icc.taxableWealth': expected.icc.taxableWealth.amount,
      'icc.cantonalIncome': expected.icc.cantonalIncome.amount,
      'icc.cantonalWealth': expected.icc.cantonalWealth.amount,
      'icc.communal': expected.icc.communal.amount,
      'icc.personalTax': expected.icc.personalTax.amount,
      'icc.total': expected.icc.total.amount,
      'icc.withholdingTaxCredit': expected.icc.withholdingTaxCredit?.amount,
      'ifd.taxableIncome': expected.ifd.taxableIncome.amount,
      'ifd.tax': expected.ifd.tax.amount,
      total: expected.total.amount,
    };
    if (process.env.TAXPRESSO_KITS_DEBUG) {
      await writeFile(
        path.join(process.env.TAXPRESSO_KITS_DEBUG, `${slug}-${year}.json`),
        JSON.stringify(
          { got, want, suggested, detail: out.detail, estimates: out.estimates },
          null,
          2,
        ),
      );
    }
    expect(got, `${slug} ${year}: the app and the hand calculation`).toEqual(want);

    // 5. Everything is in: the dashboard says the tax is exact.
    const state = (await api({
      method: 'GET',
      path: '/state',
      query: new URLSearchParams('lang=en'),
      headers: {},
      body: Buffer.alloc(0),
      csrf: 'csrf-token',
    })) as { status: number; body: DashboardState & { confidence?: string } };
    expect(state.status).toBe(200);
    expect(state.body.confidence).toBe('exact');
    return { out, expected };
  } finally {
    await client.close();
    await dashboard.stop();
  }
}

describe('the filing kits, end to end', () => {
  for (const kit of KITS) {
    for (const year of Object.keys(kit.years).map(Number)) {
      it(`${kit.slug} ${year}: the tax worked out by hand, to the centime`, async () => {
        await runKit(kit.slug, year);
      });
    }
  }
});
