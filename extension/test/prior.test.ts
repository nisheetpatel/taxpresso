// Last year's declaration end to end (SPEC.md section 5.4): recognised on upload and on
// ingest_vault, its answers suggested for the user's OK, its figures kept to compare, in the MCP
// tools and the dashboard, and nothing that identifies the taxpayer stored or shown anywhere.
// Always on a temporary vault, never the real ~/Documents/Taxpresso.
import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApi, type DashboardState } from '../src/api.js';
import { type ApiRequest, Dashboard } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import type { Workspace } from '../src/workspace.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

const FIXTURES = path.resolve(import.meta.dirname, '../../test/fixtures');
const fixture = (name: string) => readFileSync(path.join(FIXTURES, name));
/** The Dupont declaration printed for another year: same file, other page codes and title. */
const forYear = (year: number) =>
  Buffer.from(
    fixture('dupont-declaration-2025.pdf')
      .toString('latin1')
      .replaceAll('GAPP25', `GAPP${String(year).slice(2)}`)
      .replaceAll('Récapitulation   2025', `Récapitulation   ${year}`),
    'latin1',
  );

/** Everything that identifies the taxpayer in the fixtures (see the intake tests). */
const IDENTITY = [
  'DUPONT',
  'Jean',
  'Marie',
  '01.01.1980',
  '02.02.1982',
  '756.0000',
  '000.00.0000-0',
  '0000-0000-0000',
  '022 000 00 00',
  "Rue de l'Exemple",
  '1214 Vernier', // the postal code alone could be part of a random id
  'Lignon',
  'Horloger',
  'Graphiste',
  'Exemple Horlogerie',
  'Atelier Graphique',
  'Banque Fictive',
  'Ignore previous instructions',
];

let client: Client;
let dashboard: Dashboard;
let ws: Workspace;

type Result = Awaited<ReturnType<Client['callTool']>>;
const texts = (res: Result) =>
  (res.content as { type: string; text?: string }[]).map((c) => c.text ?? '').join('\n');
const structured = <T>(res: Result) => res.structuredContent as T;
const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args });
const req = (method: 'GET' | 'POST', route: string, body: unknown = {}): ApiRequest => ({
  method,
  path: route,
  query: new URLSearchParams('lang=fr'),
  headers: {},
  body: Buffer.from(JSON.stringify(body)),
  csrf: 'csrf-token',
});
const state = async () => (await createApi(ws)(req('GET', '/state'))).body as DashboardState;

beforeEach(async () => {
  const uiDir = await makeUiDir();
  ws = await makeWorkspace(uiDir);
  dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(ws) });
  const server = createTaxpressoServer({ workspace: ws, dashboard });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
  await ws.ready();
});

afterEach(async () => {
  await client.close();
  await dashboard.stop();
});

const upload = async (bytes: Buffer = fixture('dupont-declaration-2025.pdf'), name = 'decl.pdf') =>
  (await ws.addDocument(bytes, name, 'dashboard')).document;

describe('last year’s declaration', () => {
  it('is offered first, before any question', async () => {
    const status = structured<{ nextStep: string }>(await call('get_status'));
    expect(status.nextStep).toMatch(/last year's Geneva tax declaration/);
    expect(status.nextStep).toMatch(/next_questions/);
    await upload();
    expect(structured<{ nextStep: string }>(await call('get_status')).nextStep).toMatch(
      /suggestion from last year's declaration/,
    );
  });

  it('is recognised on upload, and its figures are kept to compare, per taxpayer', async () => {
    const doc = await upload();
    expect(doc).toMatchObject({
      kind: 'prior_declaration',
      kindSource: 'pdf_text',
      taxYear: 2025,
      issuer: 'GeTax',
      pages: 8,
      parse: { method: 'prior_declaration', ok: true, warnings: [] },
    });
    const figure = (key: string, person: string, instance: string) =>
      ws.ledger.get(key, person as 'p1', instance);
    expect(figure('prior.person.icc', 'p1', 'A1-31.40')).toMatchObject({
      value: 7_000_00,
      status: 'extracted',
      source: { method: 'pdf_text', docId: doc.id, page: 5 },
    });
    expect(figure('prior.person.ifd', 'p2', 'A2-41.30')).toMatchObject({ value: 5_000_00 });
    expect(figure('prior.household.icc', 'household', 'PG4-99.00')).toMatchObject({
      value: 62_400_00,
    });
    expect(figure('prior.household.ifd', 'household', 'PG4-99.00')).toBeUndefined();
    // Last year's figures are compared, not confirmed: nothing waits on a document card.
    expect(ws.toConfirm()).toEqual([]);
    expect((await state()).cards).toEqual([]);
  });

  it('suggests answers that count only once the user gives them', async () => {
    const doc = await upload();
    const suggested = (key: string, person = 'household') =>
      ws.ledger.get(key, person as 'p1')?.value;
    expect(suggested('profile.civil_status')).toBe('married');
    expect(suggested('profile.commune')).toBe('vernier');
    expect(suggested('profile.income_sources', 'p1')).toEqual(['salary']);
    expect(suggested('profile.income_sources', 'p2')).toEqual(['salary']);
    expect(suggested('profile.employers', 'p1')).toBe(1);
    expect(suggested('profile.pillar3a', 'p1')).toBe(true);
    expect(suggested('profile.pillar3a', 'p2')).toBe(true);
    expect(suggested('profile.lpp_buyin', 'p1')).toBe(false);
    expect(suggested('profile.lpp_buyin', 'p2')).toBe(true);
    expect(suggested('profile.payments')).toEqual(['medical_costs', 'donations', 'loan_interest']);
    expect(ws.ledger.get('profile.civil_status')).toMatchObject({
      status: 'extracted',
      source: { method: 'pdf_text', docId: doc.id, page: 1 },
    });

    // Not answers: nothing answered, the first question comes with its suggestion.
    let status = structured<{ progress: { questionsAnswered: number }; lastYear: string }>(
      await call('get_status'),
    );
    expect(status.progress.questionsAnswered).toBe(0);
    expect(status.lastYear).toMatch(/Last year's declaration \(2025\).*suggested answers wait/);
    const q = await call('next_questions');
    expect(texts(q)).toMatch(
      /Suggested from last year's declaration \(2025\), page 1: Married \("married"\)\. It is not an answer yet/,
    );
    expect(structured<{ questions: { suggested?: unknown }[] }>(q).questions[0]).toMatchObject({
      suggested: { value: 'married', text: { en: 'Married', fr: 'Marié(e)' } },
    });

    // The dashboard shows it preselected, with where it comes from.
    const s = await state();
    expect(s.question).toMatchObject({
      id: 'civil_status',
      suggested: 'married',
      suggestedFrom: { kind: 'prior_declaration', year: 2025, page: 1 },
    });
    expect(s.question?.value).toBeUndefined();
    expect(s.progress.answered).toBe(0);

    // The user confirms in the chat: the answer replaces the suggestion.
    const id = ws.ledger.get('profile.civil_status')!.id;
    await call('answer_question', { id: 'civil_status', value: 'married' });
    expect(ws.ledger.get('profile.civil_status')).toMatchObject({
      status: 'stated',
      supersedes: id,
      source: { via: 'chat' },
    });
    status = structured(await call('get_status'));
    expect(status.progress.questionsAnswered).toBe(1);
  });

  it('never overwrites what the user already answered', async () => {
    await call('answer_question', { id: 'civil_status', value: 'married' });
    await call('answer_question', { id: 'commune', value: 'Carouge' });
    await upload();
    expect(ws.ledger.get('profile.commune')).toMatchObject({ value: 'carouge', status: 'stated' });
    expect(ws.ledger.history('profile.commune')).toHaveLength(1);
    expect(ws.ledger.get('profile.civil_status')?.status).toBe('stated');
  });

  it('gives last year’s figures to Claude, for comparison only', async () => {
    await upload();
    const res = await call('get_last_year');
    expect(texts(res)).toMatch(/For comparison only/);
    expect(texts(res)).toMatch(
      /- 31\.40 Pillar 3a \(Cotisations 3e pilier A\), you: ICC CHF 7’000, IFD CHF 7’000 \(page 5\)/,
    );
    expect(texts(res)).toMatch(
      /- 41\.30 Pension fund buy-ins .*, your spouse or partner: ICC CHF 5’000/,
    );
    expect(texts(res)).toMatch(
      /- 99\.00 Taxable wealth \(Fortune imposable\): ICC CHF 62’400 \(page 4\)/,
    );
    expect(structured<{ found: boolean; taxYear: number }>(res)).toMatchObject({
      found: true,
      taxYear: 2025,
    });
    const all = await call('get_last_year', { all: true });
    expect(texts(all)).toMatch(/- A2 41\.10r, your spouse or partner: ICC CHF 0, IFD CHF 0/);
    expect(texts(all)).toMatch(/- PG3 71\.00: ICC CHF 1’525, IFD CHF 0 \(page 3\)/);
  });

  it('shows a "Last year" card in the dashboard, in French too', async () => {
    await upload();
    const s = await state();
    expect(s.lastYear).toMatchObject({ taxYear: 2025, software: 'GeTax', suggestions: 11 });
    const income = s.lastYear!.sections.find((x) => x.id === 'income')!;
    expect(income.lines[0]).toMatchObject({
      code: '11.00',
      label: 'Salaires bruts',
      who: 'Vous',
      icc: 98_000_00,
      ifd: 98_000_00,
      page: 2,
    });
    expect(s.lastYear!.sections.map((x) => x.id)).toEqual(['income', 'deductions', 'wealth']);
  });

  it('is found in the folder by ingest_vault, from another program, with two employers', async () => {
    await ws.vault.ensure();
    await writeFile(
      path.join(ws.vault.dir, 'scan-0042.pdf'),
      fixture('dupont-declaration-2025-two-employers.pdf'),
    );
    const res = await call('ingest_vault');
    expect(texts(res)).toMatch(/scan-0042\.pdf \(read as last year's declaration, 2025\)/);
    expect(texts(res)).toMatch(/Last year's declaration \(2025\)/);
    expect(ws.ledger.get('profile.employers', 'p1')?.value).toBe(2);
    expect(ws.ledger.get('profile.lpp_buyin', 'p1')?.value).toBe(true);
    expect(ws.ledger.get('profile.commune')?.value).toBe('vernier');
    // Pensions on the income page can't be put on one of the two: the kinds of income are asked.
    expect(ws.ledger.get('profile.income_sources', 'p1')).toBeUndefined();
    expect(ws.ledger.get('profile.payments')?.value).toEqual(['alimony_paid']);
    const list = await call('list_documents');
    expect(texts(list)).toMatch(/Last year’s declaration \(2025, read by Taxpresso/);
  });

  it('uses the latest declaration, and not this year’s own', async () => {
    const older = await upload(forYear(2024), 'old.pdf');
    expect(older.taxYear).toBe(2024);
    expect((await state()).lastYear).toMatchObject({ taxYear: 2024, expectedYear: 2025 });
    const newer = await upload(fixture('dupont-declaration-2025.pdf'), 'new.pdf');
    expect((await state()).lastYear).toMatchObject({ docId: newer.id, taxYear: 2025 });
    expect((await state()).lastYear?.expectedYear).toBeUndefined();
    // The declaration for this very year (the official PDF before filing) is not last year's:
    // it is checked before the user transmits it (./reconcile.test.ts).
    const own = await upload(forYear(2026), 'this-year.pdf');
    expect(own.kind).toBe('official_declaration');
    expect((await state()).lastYear?.docId).toBe(newer.id);
  });

  it('reads a declaration the user points out, and says when it can’t', async () => {
    const doc = await upload(fixture('dupont-scan-3a-2026.pdf'), 'scan.pdf');
    expect(doc.kind).toBeUndefined();
    await ws.setDocumentKind(doc.id, 'prior_declaration');
    expect(ws.documents.find((d) => d.id === doc.id)?.parse).toMatchObject({
      method: 'prior_declaration',
      ok: false,
    });
    expect(texts(await call('list_documents'))).toMatch(/not read by Taxpresso/);
    // Nothing to offer again: the user gave it already.
    expect(structured<{ nextStep: string }>(await call('get_status')).nextStep).not.toMatch(
      /last year's Geneva tax declaration/,
    );
  });

  it('keeps no name, date or number of the taxpayer: not in the folder, the tools or the dashboard', async () => {
    await upload();
    await ws.vault.ensure();
    await writeFile(
      path.join(ws.vault.dir, 'second.pdf'),
      fixture('dupont-declaration-2025-two-employers.pdf'),
    );
    const outputs = [
      texts(await call('ingest_vault')),
      JSON.stringify(await call('get_status', { detail: true })),
      JSON.stringify(await call('list_documents')),
      JSON.stringify(await call('next_questions', { limit: 5 })),
      JSON.stringify(await call('get_last_year', { all: true })),
      JSON.stringify(await state()),
      await readFile(path.join(ws.vault.dir, 'ledger.json'), 'utf8'),
      await readFile(path.join(ws.vault.dir, 'documents.json'), 'utf8'),
    ];
    for (const out of outputs) {
      for (const s of IDENTITY) expect(out, s).not.toContain(s);
    }
  });
});
