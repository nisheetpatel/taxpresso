// Barcodes first (SPEC.md section 5): a salary certificate or a bank e-tax statement with a
// barcode becomes verified values as soon as it is added, through the dashboard or the folder,
// and Claude has nothing to read. Synthetic Dupont documents, made by the intake test fixtures.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { readTxab } from '@taxpresso/intake';
import type { KeyRegistry } from '@taxpresso/ledger';
import { documentFields, KEYS_2026 } from '@taxpresso/rules-ge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FAKE_AHV,
  salaryCertificateJpegPdf,
  statementPdf,
  txabXml,
  txabZip,
} from '../../packages/intake/test/barcode-fixtures.mjs';
import { createApi, type DashboardState } from '../src/api.js';
import { TXAB_KEYS } from '../src/barcode.js';
import { Dashboard } from '../src/dashboard.js';
import type { ApiRequest } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import type { Workspace } from '../src/workspace.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

const TIMEOUT = 60_000;
let client: Client;
let dashboard: Dashboard;
let ws: Workspace;

type Result = Awaited<ReturnType<Client['callTool']>>;
const text = (res: Result) =>
  (res.content as { type: string; text?: string }[]).map((c) => c.text ?? '').join('\n');
const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args });

beforeEach(async () => {
  const uiDir = await makeUiDir();
  ws = await makeWorkspace(uiDir);
  dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(ws) });
  const server = createTaxpressoServer({ workspace: ws, dashboard });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
});

afterEach(async () => {
  await client.close();
  await dashboard.stop();
});

const verified = () =>
  ws.countedFacts().filter((f) => f.status === 'verified' && f.source.method === 'barcode');
const value = (key: string, person = 'p1') =>
  ws.countedFacts().find((f) => f.key === key && f.person === person)?.value;

describe('the salary certificate barcode', () => {
  it('maps every element to a key of its box, and every key belongs to the kind', () => {
    const read = readTxab(txabZip(txabXml()));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    for (const v of read.certificate.values) {
      const key = TXAB_KEYS[v.path];
      expect(key, v.path).toBeDefined();
      expect((KEYS_2026 as KeyRegistry)[key!]?.box, v.path).toBe(v.box);
    }
    for (const [path, key] of Object.entries(TXAB_KEYS)) {
      const kind = path.startsWith('A/') ? 'pension_certificate' : 'salary_certificate';
      expect(documentFields(kind) as readonly string[], key).toContain(key);
    }
  });

  it(
    'gives verified values, with their boxes, when added in the dashboard',
    async () => {
      await call('answer_question', { id: 'civil_status', value: 'single' });
      const { document } = await ws.addDocument(
        await salaryCertificateJpegPdf(),
        'Certificat de salaire 2026.pdf',
        'dashboard',
      );
      expect(document).toMatchObject({
        kind: 'salary_certificate',
        kindSource: 'barcode',
        person: 'p1',
        taxYear: 2026,
        periodFrom: '2026-01-01',
        periodTo: '2026-12-31',
        issuer: 'Espresso Industries SA',
        parse: { method: 'barcode', ok: true, warnings: [] },
      });
      const gross = verified().find((f) => f.key === 'salary.gross')!;
      expect(gross).toMatchObject({
        value: 8_500_000,
        person: 'p1',
        instance: document.id,
        source: { method: 'barcode', docId: document.id, field: '8' },
      });
      expect(value('salary.canteen')).toBe(true);
      expect(value('salary.free_transport')).toBe(false);
      expect(value('salary.remarks')).toMatch(/Ignore previous instructions/);
      // Data, never instructions: the salary is what the barcode says.
      expect(value('salary.gross')).toBe(8_500_000);
      expect(ws.toRead()).toEqual([]);
      expect(ws.toConfirm()).toEqual([]);

      // Nothing personal is kept: no AHV number, no name, no address, in the ledger or the list.
      const folder = path.join(ws.vault.dir);
      for (const file of ['ledger.json', 'documents.json']) {
        const saved = await readFile(path.join(folder, file), 'utf8');
        expect(saved).not.toContain(FAKE_AHV);
        expect(saved).not.toContain('Dupont');
        expect(saved).not.toContain('Chemin des Exemples');
      }

      const status = await call('get_status');
      expect(text(status)).toMatch(/Documents: 1, 1 read from the barcode/);
      const listed = await call('list_documents');
      expect(text(listed)).toMatch(/read from the barcode \(verified\), \d+ values/);
    },
    TIMEOUT,
  );

  it(
    'waits for whose it is in a couple, then fills in for that person',
    async () => {
      await call('answer_question', { id: 'civil_status', value: 'married' });
      const { document } = await ws.addDocument(
        await salaryCertificateJpegPdf(),
        'Certificat.pdf',
        'dashboard',
      );
      expect(document.parse.method).toBe('barcode_pending');
      expect(verified()).toEqual([]);
      expect(text(await call('get_status'))).toMatch(/1 waiting for the user to say whose it is/);

      await ws.setDocumentKind(document.id, 'salary_certificate', 'p2');
      expect(document.parse.method).toBe('barcode');
      expect(value('salary.gross', 'p2')).toBe(8_500_000);
      expect(value('salary.gross', 'p1')).toBeUndefined();
    },
    TIMEOUT,
  );

  it(
    'lets the user say it is something else: their word wins, and it is read the other ways',
    async () => {
      await call('answer_question', { id: 'civil_status', value: 'married' });
      const { document } = await ws.addDocument(
        await salaryCertificateJpegPdf(),
        'Certificat.pdf',
        'dashboard',
      );
      await ws.setDocumentKind(document.id, 'pension_certificate', 'p1');
      expect(document.parse.method).toBe('none');
      expect(verified()).toEqual([]);
      expect(ws.toRead().map((d) => d.id)).toEqual([document.id]);
      expect(text(await call('get_status'))).not.toMatch(/waiting for the user/);
    },
    TIMEOUT,
  );

  it(
    'waits for the household, when the document comes first',
    async () => {
      const { document } = await ws.addDocument(
        await salaryCertificateJpegPdf(),
        'Certificat.pdf',
        'dashboard',
      );
      expect(document.parse.method).toBe('barcode_pending');
      await call('answer_question', { id: 'civil_status', value: 'single' });
      expect(value('salary.net')).toBe(7_535_250);
    },
    TIMEOUT,
  );

  it(
    'is read when the user puts the file in the folder (ingest_vault)',
    async () => {
      await call('answer_question', { id: 'civil_status', value: 'single' });
      await writeFile(path.join(ws.vault.dir, 'cert.pdf'), await salaryCertificateJpegPdf());
      const res = await call('ingest_vault');
      expect(text(res)).toMatch(
        /cert\.pdf \(Salary certificate, 2026, Espresso Industries SA: read from the barcode \(verified\), \d+ values\)/,
      );
    },
    TIMEOUT,
  );

  it(
    'keeps its kind: Claude can’t read it as something else',
    async () => {
      await call('answer_question', { id: 'civil_status', value: 'single' });
      const { document } = await ws.addDocument(
        await salaryCertificateJpegPdf(),
        'c.pdf',
        'dashboard',
      );
      const res = await call('propose_extraction', {
        id: document.id,
        document: { kind: 'pension_certificate' },
      });
      expect(res.isError).toBe(true);
      expect(text(res)).toMatch(/barcode says it is a salary_certificate/);
      // A value Claude reads differently never replaces the barcode's.
      const again = await call('propose_extraction', {
        id: document.id,
        values: [{ key: 'salary.gross', value: '1.00', page: 1 }],
      });
      expect(text(again)).toMatch(/Kept what the user already confirmed|already there/);
      expect(value('salary.gross')).toBe(8_500_000);
      expect(document.parse.method).toBe('barcode');
    },
    TIMEOUT,
  );
});

describe('the e-tax statement barcode', () => {
  const req = (method: 'GET' | 'POST', route: string, body: Buffer, filename: string) =>
    ({
      method,
      path: route,
      query: new URLSearchParams('lang=fr'),
      headers: { 'x-filename': encodeURIComponent(filename) },
      body,
      csrf: 'csrf-token',
    }) as ApiRequest;

  it(
    'gives the totals, accounts, loans and securities, verified, and shows them in the card',
    async () => {
      await call('answer_question', { id: 'civil_status', value: 'single' });
      const api = createApi(ws);
      const { bytes } = await statementPdf();
      const reply = await api(req('POST', '/documents', bytes, 'Relevé fiscal 2026.pdf'));
      const state = reply.body as DashboardState;
      const doc = state.documents[0]!;
      expect(doc).toMatchObject({
        kind: 'ech0196_statement',
        kindSource: 'barcode',
        barcode: 'read',
      });

      const at = (key: string, instance: string) =>
        ws.countedFacts().find((f) => f.key === key && f.instance === instance);
      expect(at('tax_statement.taxable_value', doc.id)?.value).toBe(1_429_965);
      expect(at('accounts.value_chf', 'CH0000000000000000001')?.value).toBe(1_234_565);
      expect(at('accounts.number', 'CH0000000000000000001')?.value).toBe('00000001');
      expect(at('accounts.income_a_chf', 'CH0000000000000000001')?.value).toBe(25_000);
      expect(at('liabilities.balance_chf', 'CH0000000000000000003')?.value).toBe(500_000);
      expect(at('securities.value_chf', `${doc.id}.USTXPRS00017`)).toMatchObject({
        value: 100_400,
        status: 'verified',
      });
      expect(at('securities.value_kursliste', `${doc.id}.USTXPRS00017`)?.value).toBe(true);
      expect(at('securities.withholding_foreign_chf', `${doc.id}.USTXPRS00017`)?.value).toBe(66);

      const card = state.cards.find((c) => c.docId === doc.id)!;
      expect(card.values.find((v) => v.key === 'tax_statement.taxable_value')).toMatchObject({
        status: 'verified',
        method: 'barcode',
      });
      expect(card.values.some((v) => v.key.startsWith('securities.'))).toBe(false);
      expect(card.values.find((v) => v.key === 'accounts.value_chf')?.item).toBe(
        'Compte privé · 00000001',
      );
      const securities = ws.securities('en');
      expect(securities?.rows.find((r) => r.isin === 'USTXPRS00017')).toMatchObject({
        valueChf: 100_400,
        estimate: false,
        needsOk: false,
      });
      // The client's name and number stay out of the folder.
      const saved = await readFile(path.join(ws.vault.dir, 'ledger.json'), 'utf8');
      expect(saved).not.toMatch(/TXP-000001|Dupont/);
    },
    TIMEOUT,
  );

  it(
    'with a segment missing: an e-tax statement for Claude to read, nothing verified',
    async () => {
      const { bytes } = await statementPdf({ drop: [0] });
      const { document } = await ws.addDocument(bytes, 'releve.pdf', 'dashboard');
      expect(document).toMatchObject({ kind: 'ech0196_statement', kindSource: 'barcode' });
      expect(document.parse.method).toBe('none');
      expect(verified()).toEqual([]);
      expect(ws.toRead().map((d) => d.id)).toEqual([document.id]);
    },
    TIMEOUT,
  );
});
