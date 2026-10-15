// Sorted as they land (docs/design/three-pages.md, section 4): the open year's folder is watched
// while the extension runs; files put there are read as ingest_vault reads them, about a second
// after the last change; the dashboards' next look at the state shows them, and Claude hears of
// them with its next ingest_vault. Temporary folders only (TAXPRESSO_VAULT_PATH), never the real one.
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it } from 'vitest';
import { createApi, type DashboardState } from '../src/api.js';
import { readConfig } from '../src/config.js';
import { Dashboard } from '../src/dashboard.js';
import { DASHBOARD_VIEW_URI, VIEW_KEY_META } from '../src/dashboard-view.js';
import { FolderWatch, mayBeDocument, type Watch } from '../src/folder-watch.js';
import { createTaxpressoServer } from '../src/server.js';
import { TaxYears } from '../src/years.js';
import { makeUiDir } from './helpers.js';

const cleanup: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0)) await fn();
});

/** The tax years on a fresh temporary Taxpresso folder. */
async function makeYears(opts: { repo?: boolean } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'taxpresso-ws-'));
  if (opts.repo) await mkdir(path.join(root, '.git'));
  const uiDir = await makeUiDir();
  const config = readConfig({
    TAXPRESSO_VAULT_PATH: path.join(root, 'Taxpresso'),
    TAXPRESSO_UI_DIR: uiDir,
  });
  return { years: new TaxYears(config), uiDir };
}

/** Waits until `check` holds, looking every 20 ms, for at most `ms`. */
async function until(check: () => boolean, ms = 10_000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
}

/**
 * Puts a file in the watched folder until the watch has sorted something: a watch just started
 * can miss the very first change while the system starts reporting (macOS), so the same bytes are
 * written again, which still makes one document.
 */
async function drop(file: string, content: string, sorted: number[]): Promise<void> {
  for (let i = 0; i < 20 && !sorted.some((n) => n > 0); i++) {
    await writeFile(file, content);
    await until(() => sorted.some((n) => n > 0), 1500).catch(() => undefined);
  }
  expect(sorted.some((n) => n > 0)).toBe(true);
}

/** A watch that never touches the disk: the test says which names changed. */
function fakeWatch() {
  const calls: { dir: string; closed: boolean; emit: (name: string | null) => void }[] = [];
  const watch: Watch = (dir, _options, listener) => {
    const call = { dir, closed: false, emit: (name: string | null) => listener('change', name) };
    calls.push(call);
    return {
      close: () => void (call.closed = true),
      on: () => undefined,
    };
  };
  return { watch, calls };
}

describe('what may be a document', () => {
  it('leaves out Taxpresso’s own files, hidden and half-written files, and filing/', () => {
    for (const name of [
      'scan.pdf',
      'documents/a.pdf',
      'bank/2026/statement.csv',
      'README.txt.pdf',
    ]) {
      expect(mayBeDocument(name), name).toBe(true);
    }
    for (const name of [
      'ledger.json',
      'documents.json',
      'questionnaire.json',
      'entered.json',
      'decisions.json',
      'README.txt',
      '.DS_Store',
      'documents/.hidden.pdf',
      'documents/1234abcd-a.pdf.tmp-42-abcdef01',
      'ledger.json.tmp-42-abcdef01',
      'filing/declaration.pdf',
    ]) {
      expect(mayBeDocument(name), name).toBe(false);
    }
    // Taxpresso's own names deeper down are the user's files.
    expect(mayBeDocument('documents/ledger.json')).toBe(true);
  });
});

describe('the folder watch', () => {
  it('sorts a file put in the folder, as ingest_vault does, and tells Claude at its next look', async () => {
    const { years, uiDir } = await makeYears();
    const ws = years.current;
    await ws.ensureFolder();
    const sorted: number[] = [];
    const watch = new FolderWatch(years, { debounceMs: 100, onScan: (n) => sorted.push(n) });
    watch.start();
    cleanup.push(() => watch.close());
    expect(watch.dir).toBe(ws.vault.dir);
    await drop(path.join(ws.vault.dir, 'Attestation 3a.pdf'), '%PDF-1.7 synthetic 3a', sorted);
    await watch.idle();
    expect(ws.documents.map((d) => d.filename)).toEqual(['Attestation 3a.pdf']);
    expect(ws.activity()[0]).toMatchObject({ by: 'you', what: 'scan', detail: '1' });

    // Claude's next look at the folder hears of it, once.
    const dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(years) });
    const server = createTaxpressoServer({ years, dashboard });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(clientSide);
    cleanup.push(async () => {
      await client.close();
      await dashboard.stop();
    });
    const first = await client.callTool({ name: 'ingest_vault', arguments: {} });
    expect(first.structuredContent).toEqual({ added: ['Attestation 3a.pdf'] });
    const again = await client.callTool({ name: 'ingest_vault', arguments: {} });
    expect(again.structuredContent).toEqual({ added: [] });
  });

  it('gives the panel in the chat a new state at its next look, the browser page too', async () => {
    const { years, uiDir } = await makeYears();
    const ws = years.current;
    await ws.ensureFolder();
    const dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(years) });
    const server = createTaxpressoServer({ years, dashboard });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(clientSide);
    const sorted: number[] = [];
    const watch = new FolderWatch(years, { debounceMs: 100, onScan: (n) => sorted.push(n) });
    watch.start();
    cleanup.push(async () => {
      watch.close();
      await client.close();
      await dashboard.stop();
    });
    const { contents } = await client.readResource({ uri: DASHBOARD_VIEW_URI });
    const html = (contents[0] as { text: string }).text;
    const key = new RegExp(`<meta name="${VIEW_KEY_META}" content="([^"]+)">`).exec(html)![1];
    type Reply = { structuredContent: { status: number; etag?: string; body?: DashboardState } };
    const view = async (etag: string) =>
      (await client.callTool({
        name: 'dashboard_api',
        arguments: { key, method: 'GET', path: '/state', etag },
      })) as Reply;
    const before = await view('');
    const etag = before.structuredContent.etag!;
    expect(before.structuredContent.body!.documents).toEqual([]);
    // Nothing new: the view's tag says so, without a body.
    expect((await view(etag)).structuredContent.status).toBe(304);
    await drop(path.join(ws.vault.dir, 'Certificat de salaire.pdf'), '%PDF-1.7 synthetic', sorted);
    await watch.idle();
    const after = await view(etag);
    expect(after.structuredContent.status).toBe(200);
    expect(after.structuredContent.etag).not.toBe(etag);
    expect(after.structuredContent.body!.documents.map((d) => d.filename)).toEqual([
      'Certificat de salaire.pdf',
    ]);
    // The browser page asks the same API every second.
    const page = (await dashboard.callApi({
      method: 'GET',
      path: '/state',
      query: new URLSearchParams(),
      headers: {},
      body: Buffer.alloc(0),
      csrfToken: undefined,
    })) as { body: DashboardState };
    expect(page.body.documents.map((d) => d.filename)).toEqual(['Certificat de salaire.pdf']);
  });

  it('looks only after a change that may be a document, about a second after the last one', async () => {
    const { years } = await makeYears();
    await years.current.ensureFolder();
    const { watch, calls } = fakeWatch();
    const sorted: number[] = [];
    const folder = new FolderWatch(years, { debounceMs: 60, watch, onScan: (n) => sorted.push(n) });
    folder.start();
    cleanup.push(() => folder.close());
    expect(calls.map((c) => c.dir)).toEqual([years.current.vault.dir]);
    // One look as it starts watching, for what landed before.
    await until(() => sorted.length === 1);
    // Taxpresso writing its own files (an answer, a document's list): no look at the folder.
    for (const name of [
      'ledger.json',
      'ledger.json.tmp-1-abcdef01',
      'documents.json',
      '.DS_Store',
    ]) {
      calls[0]!.emit(name);
    }
    await new Promise((r) => setTimeout(r, 200));
    expect(sorted).toEqual([0]);
    // Several changes close together: one look.
    calls[0]!.emit('a.pdf');
    calls[0]!.emit('b.pdf');
    calls[0]!.emit(null);
    await until(() => sorted.length > 1);
    await new Promise((r) => setTimeout(r, 150));
    expect(sorted).toEqual([0, 0]);
    // Nothing found: nothing said in the activity.
    expect(years.current.activity().some((a) => a.what === 'scan')).toBe(false);
  });

  it('sorts what landed while nothing watched the folder, as soon as it watches it', async () => {
    const { years } = await makeYears();
    const ws = years.current;
    await ws.ensureFolder();
    await writeFile(path.join(ws.vault.dir, 'Relevé fiscal.pdf'), '%PDF-1.7 synthetic statement');
    const { watch } = fakeWatch();
    const sorted: number[] = [];
    const folder = new FolderWatch(years, { debounceMs: 30, watch, onScan: (n) => sorted.push(n) });
    folder.start();
    cleanup.push(() => folder.close());
    await until(() => sorted.length === 1);
    await folder.idle();
    expect(sorted).toEqual([1]);
    expect(ws.documents.map((d) => d.filename)).toEqual(['Relevé fiscal.pdf']);
  });

  it('waits for the folder to exist, then watches it', async () => {
    const { years } = await makeYears();
    const { watch, calls } = fakeWatch();
    const folder = new FolderWatch(years, { retryMs: 30, watch });
    folder.start();
    cleanup.push(() => folder.close());
    expect(existsSync(years.current.vault.dir)).toBe(false);
    expect(folder.dir).toBeUndefined();
    await new Promise((r) => setTimeout(r, 100));
    expect(calls).toEqual([]);
    // Made by "Open my Taxpresso folder", the first answer or the first document.
    await years.current.ensureFolder();
    await until(() => folder.dir === years.current.vault.dir);
    expect(calls.map((c) => c.dir)).toEqual([years.current.vault.dir]);
  });

  it('follows the year the user opens, and stops for good when the extension closes', async () => {
    const { years } = await makeYears();
    const ws2026 = years.current;
    await ws2026.ensureFolder();
    await years.workspace(2025).ensureFolder();
    const { watch, calls } = fakeWatch();
    const folder = new FolderWatch(years, { retryMs: 30, watch });
    folder.start();
    expect(folder.dir).toBe(ws2026.vault.dir);
    await years.open(2025, 'chat');
    expect(folder.dir).toBe(years.workspace(2025).vault.dir);
    expect(calls.map((c) => [path.basename(c.dir), c.closed])).toEqual([
      ['2026', true],
      ['2025', false],
    ]);
    folder.close();
    expect(calls[1]!.closed).toBe(true);
    expect(folder.dir).toBeUndefined();
    // Closed: another year opened later is not followed.
    await years.open(2026, 'dashboard');
    expect(calls).toHaveLength(2);
  });

  it('never watches a folder inside a code repository', async () => {
    const { years } = await makeYears({ repo: true });
    const { watch, calls } = fakeWatch();
    const folder = new FolderWatch(years, { retryMs: 30, watch });
    folder.start();
    cleanup.push(() => folder.close());
    await new Promise((r) => setTimeout(r, 100));
    expect(calls).toEqual([]);
    expect(folder.dir).toBeUndefined();
  });
});
