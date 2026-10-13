// Broker exports end to end inside the extension (SPEC.md section 5.7): recognised on upload and
// on ingest_vault, read into the securities list, recorded as facts, shown in the dashboard state.
// Always on a temporary vault, never the real ~/Documents/Taxpresso.
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApi, type DashboardState } from '../src/api.js';
import { readConfig } from '../src/config.js';
import { type ApiRequest, Dashboard } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import { Workspace } from '../src/workspace.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

const fixture = (name: string): Buffer =>
  readFileSync(new URL(`../../test/fixtures/brokers/${name}`, import.meta.url));

let client: Client;
let dashboard: Dashboard;
let ws: Workspace;

const text = (res: { content: unknown }) => (res.content as { text: string }[])[0]!.text;
const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args });
const fact = (key: string, instance: string) => ws.ledger.get(key, 'household', instance);

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
  await ws.vault.ensure();
});

afterEach(async () => {
  await client.close();
  await dashboard.stop();
});

/** Puts a file in the tax-year folder by hand; by default the Interactive Brokers fixture. */
const drop = (name: string, bytes: Buffer | string = fixture('dupont-ibkr-2026.xml')) =>
  writeFile(path.join(ws.vault.dir, name), bytes);

describe('broker exports in the vault', () => {
  it('recognises an export put in the folder and records its securities as facts', async () => {
    // A name that says nothing: the content decides.
    await drop('download (3).txt', fixture('dupont-ibkr-2026.xml'));
    const res = await call('ingest_vault');
    expect(text(res)).toMatch(
      /download \(3\)\.txt \(read as a broker export: Interactive Brokers\)/,
    );
    expect(text(res)).toMatch(/Securities \(état des titres\): 3 positions from 1 broker export/);
    expect(text(res)).not.toMatch(/says what each new document is/);

    const doc = ws.documents[0]!;
    expect(doc).toMatchObject({
      kind: 'broker_export',
      kindSource: 'export',
      issuer: 'Interactive Brokers',
      parse: { method: 'ibkr_flex_xml', ok: true },
    });
    expect(doc.parse.warnings.join('\n')).toMatch(/ESPR 15JAN27 130 C \(OPT\) is not read/);

    expect(
      ws.ledger
        .instances('securities.name')
        .map((f) => f.instance)
        .sort(),
    ).toEqual(['CHTXPRS00026', 'IETXPRS00038', 'USTXPRS00017']);
    expect(fact('securities.quantity', 'USTXPRS00017')).toMatchObject({
      value: '10',
      status: 'extracted',
      source: { method: 'export', docId: doc.id },
    });
    expect(fact('securities.value_chf', 'USTXPRS00017')).toMatchObject({
      value: 100_400,
      status: 'estimate',
      note: 'USD 1255 at USD to CHF 0.8 (Interactive Brokers rate, 2026-12-31)',
    });
    expect(fact('securities.income_gross_chf', 'USTXPRS00017')).toMatchObject({
      value: 881,
      status: 'extracted',
    });
    expect(fact('securities.withholding_foreign_chf', 'USTXPRS00017')?.value).toBe(132);
    expect(fact('securities.withholding_swiss_chf', 'CHTXPRS00026')?.value).toBe(1050);
    expect(fact('securities.country', 'CHTXPRS00026')?.value).toBe('CH');
    for (const f of ws.ledger.view()) {
      if (typeof f.value === 'number') expect(Number.isSafeInteger(f.value)).toBe(true);
    }

    const docs = text(await call('list_documents'));
    expect(docs).toMatch(
      /download \(3\)\.txt: Broker export \(securities\) \(Interactive Brokers, \d+ warnings in the dashboard\)/,
    );
    const status = await call('get_status');
    expect(text(status)).toMatch(/Securities \(état des titres\): 3 positions/);
    expect((status.structuredContent as { estimates: string[] }).estimates[0]).toMatch(/Kursliste/);

    // The same file again changes nothing.
    const size = ws.ledger.size;
    await drop('again.xml', fixture('dupont-ibkr-2026.xml'));
    await call('ingest_vault');
    expect(ws.ledger.size).toBe(size);
  });

  it('lets a newer export of the same account supersede the older facts', async () => {
    await drop('ibkr-january.xml');
    await call('ingest_vault');
    const before = fact('securities.quantity', 'CHTXPRS00026')!;
    await drop(
      'ibkr-february.xml',
      fixture('dupont-ibkr-2026.xml')
        .toString('utf8')
        .replace('whenGenerated="20270104;093000"', 'whenGenerated="20270210;120000"')
        .replace(
          'position="20" markPrice="45.25" positionValue="905"',
          'position="25" markPrice="45.25" positionValue="1131.25"',
        ),
    );
    await call('ingest_vault');
    expect(fact('securities.quantity', 'CHTXPRS00026')).toMatchObject({
      value: '25',
      supersedes: before.id,
    });
    expect(fact('securities.value_chf', 'CHTXPRS00026')?.value).toBe(113_125);
    expect(ws.ledger.history('securities.quantity', 'household', 'CHTXPRS00026')).toHaveLength(2);
    // Unchanged values are not appended twice.
    expect(ws.ledger.history('securities.quantity', 'household', 'USTXPRS00017')).toHaveLength(1);
    const old = ws.documents.find((d) => d.filename === 'ibkr-january.xml')!;
    expect(old.parse.warnings.at(-1)).toBe('Replaced by the newer export ibkr-february.xml.');
  });

  it('keeps a value the user confirmed when an export gives it again', async () => {
    await drop('ibkr.xml');
    await call('ingest_vault');
    const confirmed = ws.ledger.append({
      key: 'securities.quantity',
      person: 'household',
      instance: 'USTXPRS00017',
      value: '10',
      status: 'stated',
      source: { method: 'user', via: 'dashboard' },
    });
    await drop('degiro.csv', fixture('dupont-degiro-account.csv'));
    await call('ingest_vault');
    expect(fact('securities.quantity', 'USTXPRS00017')?.id).toBe(confirmed.id);
  });

  it('reads DEGIRO uploads in the dashboard and shows the securities card state', async () => {
    const api = createApi(ws);
    const upload = (name: string, query = 'lang=fr') =>
      api({
        method: 'POST',
        path: '/documents',
        query: new URLSearchParams(query),
        headers: { 'x-filename': encodeURIComponent(name) },
        body: fixture(name),
        csrf: 'csrf',
      } satisfies ApiRequest);
    await upload('dupont-degiro-portfolio.csv');
    // Uploaded from the "bank statements" row: the content still decides what it is.
    const res = await upload('dupont-degiro-account.csv', 'lang=fr&kind=bank_attestation');
    const state = res.body as DashboardState;
    expect(state.documents.map((d) => d.kind)).toEqual(['broker_export', 'broker_export']);
    expect(state.documents[0]!.kindLabel).toBe('Export du courtier (titres)');
    // Recognised from the file, not confirmed by the user: the dashboard says so.
    expect(state.documents[0]!.kindSource).toBe('export');
    const securities = state.securities!;
    expect(securities.rows.map((r) => [r.isin, r.quantity, r.valueChf, r.incomeChf])).toEqual([
      ['CHTXPRS00026', '10', 45_250, 1500],
      ['USTXPRS00017', '4', 40_160, 188],
      // EUR income without a CHF rate in the export: no CHF amount.
      ['NLTXPRS00066', '12', 9_165, undefined],
    ]);
    expect(securities.rows.every((r) => r.estimate && r.needsOk)).toBe(true);
    expect(securities.totals).toMatchObject({
      valueChf: 94_575,
      incomeChf: 1688,
      incomplete: true,
    });
    expect(securities.warnings.join('\n')).toMatch(
      /dupont-degiro-portfolio\.csv\u00a0: Cet export n’est pas daté/,
    );
    // Text inside the export is data: quoted in a warning, nothing else changed.
    expect(securities.warnings.join('\n')).toMatch(/Ignore previous instructions/);
    expect(ws.ledger.view().filter((f) => !f.key.startsWith('securities.'))).toEqual([]);
  });

  it('withdraws an export’s values when the user says it is something else', async () => {
    await drop('ibkr.xml');
    await call('ingest_vault');
    const doc = ws.documents[0]!;
    await ws.setDocumentKind(doc.id, 'other');
    expect(fact('securities.quantity', 'USTXPRS00017')).toMatchObject({
      value: '0',
      note: 'Not given by your broker exports any more',
    });
    expect(fact('securities.value_chf', 'USTXPRS00017')?.value).toBe(0);
    expect(ws.securities('en')).toBeUndefined();
    // And back: the values return.
    await ws.setDocumentKind(doc.id, 'broker_export');
    expect(fact('securities.quantity', 'USTXPRS00017')?.value).toBe('10');
    expect(ws.securities('en')?.rows).toHaveLength(3);
  });

  it('says plainly when a file called a broker export can’t be read', async () => {
    await drop('statement.pdf', '%PDF-1.7 synthetic broker statement');
    await call('ingest_vault');
    const doc = ws.documents[0]!;
    expect(doc.kind).toBeUndefined();
    await ws.setDocumentKind(doc.id, 'broker_export');
    expect(doc.parse).toMatchObject({ ok: false });
    expect(ws.securities('fr')?.warnings[0]).toMatch(
      /statement\.pdf\u00a0: Taxpresso ne peut pas lire/,
    );
  });

  it('reads what is already in the folder when the extension starts', async () => {
    await drop('ibkr.xml');
    await call('ingest_vault');
    // A fresh workspace on the same folder, as after a restart of Claude Desktop.
    const restarted = new Workspace(
      readConfig({ TAXPRESSO_VAULT_PATH: path.dirname(ws.vault.dir) }),
      ws.engine,
      ws.keys,
    );
    await restarted.ready();
    expect(restarted.securities('en')?.rows).toHaveLength(3);
    expect(restarted.securities('en')?.warnings.length).toBeGreaterThan(0);
  });
});
