// "A copy of your folder" (SPEC.md 10.6): one ZIP of the tax-year folder, written into the
// Taxpresso folder on this computer, from the dashboard and from the chat, never over a file,
// never with anything from outside the folder. Always on a temporary vault, never the real one.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FolderExportState } from '../../ui/src/dashboard/types-export.js';
import { readZip } from '../../packages/intake/src/barcode/zip.js';
import { createApi, type DashboardState } from '../src/api.js';
import { type ApiRequest, Dashboard } from '../src/dashboard.js';
import { exportFolder, exportName } from '../src/export.js';
import { createTaxpressoServer } from '../src/server.js';
import type { Workspace } from '../src/workspace.js';
import { crc32 } from '../src/zip.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

const FIXTURES = path.resolve(import.meta.dirname, '../../test/fixtures');

let client: Client;
let dashboard: Dashboard;
let ws: Workspace;

type Result = Awaited<ReturnType<Client['callTool']>>;
const texts = (res: Result) =>
  (res.content as { type: string; text?: string }[]).map((c) => c.text ?? '').join('\n');
const req = (method: 'GET' | 'POST', route: string, body: unknown = {}): ApiRequest => ({
  method,
  path: route,
  query: new URLSearchParams('lang=en'),
  headers: {},
  body: Buffer.from(JSON.stringify(body)),
  csrf: 'csrf-token',
});

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

/** A year folder with answers, a document, an "Entered" tick and a file the user filed there. */
async function fill() {
  await ws.answer('civil_status', 'single', 'chat');
  const pdf = readFileSync(path.join(FIXTURES, 'dupont-certificat-salaire-2026.pdf'));
  const { document } = await ws.addDocument(pdf, 'Certificat de salaire.pdf', 'dashboard');
  await ws.proposeExtraction(document.id, { kind: 'salary_certificate', taxYear: 2026 }, [
    { key: 'salary.base', value: "84'000.00", page: 1, box: '1' },
  ]);
  await ws.confirmDocument(document.id, 'dashboard');
  const fact = ws.countedFacts().find((f) => f.key === 'salary.base')!;
  await ws.setEntered(fact.id, true);
  await mkdir(path.join(ws.vault.dir, 'filing'), { recursive: true });
  await writeFile(path.join(ws.vault.dir, 'filing', 'notes é.txt'), 'Mes notes');
  return { document, pdf };
}

/** The names in a ZIP's central directory, read independently of the writer. */
function centralNames(zip: Buffer): string[] {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(at)).toBe(0x02014b50);
    const nameLength = zip.readUInt16LE(at + 28);
    const extra = zip.readUInt16LE(at + 30);
    const comment = zip.readUInt16LE(at + 32);
    names.push(zip.subarray(at + 46, at + 46 + nameLength).toString('utf8'));
    at += 46 + nameLength + extra + comment;
  }
  return names;
}

const NOW = new Date(2026, 9, 14, 10, 30);

describe('a copy of your folder', () => {
  it('writes one ZIP of the year folder into the Taxpresso folder, named with the date', async () => {
    const { pdf } = await fill();
    const done = await exportFolder(ws, NOW);
    expect(done.file).toBe('Taxpresso-2026-export-2026-10-14.zip');
    const file = path.join(ws.vault.root, done.file);
    const zip = await readFile(file);
    expect(done.bytes).toBe(zip.length);
    const names = centralNames(zip);
    const stored = (await readdir(path.join(ws.vault.dir, 'documents')))[0]!;
    expect(names).toEqual([
      '2026/README.txt',
      '2026/documents.json',
      `2026/documents/${stored}`,
      '2026/entered.json',
      '2026/filing/notes é.txt',
      '2026/ledger.json',
    ]);
    expect(done.entries).toBe(names.length);
    // Every entry opens with its CRC-32 and size checked, and holds the file as it is.
    const entries = new Map(readZip(zip, 50 * 1024 * 1024).map((e) => [e.name, e.data]));
    expect(Buffer.from(entries.get(`2026/documents/${stored}`)!)).toEqual(pdf);
    expect(Buffer.from(entries.get('2026/ledger.json')!).toString('utf8')).toBe(
      await readFile(path.join(ws.vault.dir, 'ledger.json'), 'utf8'),
    );
    expect(Buffer.from(entries.get('2026/filing/notes é.txt')!).toString('utf8')).toBe('Mes notes');
    // The ZIP sits next to the year folder, not in it: the next scan doesn't take it for a document.
    expect(await ws.scan('you')).toEqual([]);
  });

  it('opens with the system’s own unzip, where there is one', async () => {
    await fill();
    const done = await exportFolder(ws, NOW);
    const file = path.join(ws.vault.root, done.file);
    const unzip = spawnSync('unzip', ['-t', file], { encoding: 'utf8' });
    if (unzip.error) return; // no unzip on this computer (Windows)
    expect(unzip.status, unzip.stdout + unzip.stderr).toBe(0);
    expect(unzip.stdout).toMatch(/No errors detected/);
    const list = spawnSync('unzip', ['-Z1', file], { encoding: 'utf8' });
    expect(list.stdout.trim().split('\n')).toContain('2026/ledger.json');
  });

  it('never overwrites a file: the next copy that day takes a number', async () => {
    await fill();
    // A file the user made with that name, and a first copy.
    await writeFile(path.join(ws.vault.root, exportName(2026, NOW)), 'mine');
    const first = await exportFolder(ws, NOW);
    expect(first.file).toBe('Taxpresso-2026-export-2026-10-14-2.zip');
    const before = await readFile(path.join(ws.vault.root, first.file));
    const second = await exportFolder(ws, NOW);
    expect(second.file).toBe('Taxpresso-2026-export-2026-10-14-3.zip');
    expect(await readFile(path.join(ws.vault.root, exportName(2026, NOW)), 'utf8')).toBe('mine');
    expect(await readFile(path.join(ws.vault.root, first.file))).toEqual(before);
  });

  it('leaves out everything outside the year folder, links and hidden files', async () => {
    await fill();
    // Next to the year folder: another year, a file in the Taxpresso folder, a secret elsewhere.
    await mkdir(path.join(ws.vault.root, '2025'), { recursive: true });
    await writeFile(path.join(ws.vault.root, '2025', 'ledger.json'), '{}');
    await writeFile(path.join(ws.vault.root, 'other.txt'), 'not this year');
    const outside = path.join(path.dirname(ws.vault.root), 'secret.txt');
    await writeFile(outside, 'secret');
    // Inside it: links to them (where this computer lets a test make links), a hidden file and
    // a file being written.
    const link = (to: string, at: string) =>
      symlink(to, path.join(ws.vault.dir, at)).then(
        () => true,
        () => false,
      );
    await link(outside, 'link.txt');
    await link(path.join(ws.vault.root, '2025'), 'linked-year');
    await writeFile(path.join(ws.vault.dir, '.DS_Store'), 'x');
    await writeFile(path.join(ws.vault.dir, 'ledger.json.tmp-1-abc'), 'x');
    const done = await exportFolder(ws, NOW);
    const zip = await readFile(path.join(ws.vault.root, done.file));
    const names = centralNames(zip);
    expect(names.every((n) => n.startsWith('2026/'))).toBe(true);
    for (const n of ['link.txt', 'linked-year', '.DS_Store', '.tmp-', 'other.txt', 'secret']) {
      expect(
        names.some((x) => x.includes(n)),
        n,
      ).toBe(false);
    }
    expect(zip.includes(Buffer.from('secret'))).toBe(false);
  });

  it('says when there is nothing to copy yet', async () => {
    await expect(exportFolder(ws, NOW)).rejects.toThrow(
      /Nothing to save yet: there is no 2026 folder/,
    );
    const res = await client.callTool({ name: 'export_folder', arguments: {} });
    expect(res.isError).toBe(true);
    expect(texts(res)).toMatch(/Nothing to save yet/);
  });

  it('is the same from the chat and from the dashboard', async () => {
    await fill();
    const res = await client.callTool({ name: 'export_folder', arguments: {} });
    expect(res.isError).toBeFalsy();
    const out = res.structuredContent as { path: string; file: string; entries: number };
    expect(out.file).toMatch(/^Taxpresso-2026-export-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(out.path.endsWith(path.join('Taxpresso', out.file))).toBe(true);
    expect(texts(res)).toMatch(
      /Saved a copy of the 2026 folder: .*Taxpresso-2026-export-.*\.zip \(6 files, \d+ KB\)\. It stays on this computer/,
    );
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === 'export_folder')?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    });

    // The dashboard's button: a second copy, shown in the page's state.
    const api = createApi(ws);
    const posted = await api(req('POST', '/export'));
    expect(posted.status, JSON.stringify(posted.body)).toBe(200);
    const state = posted.body as DashboardState;
    const view: FolderExportState = state.folderExport;
    expect(view.last).toMatchObject({ file: out.file.replace('.zip', '-2.zip'), entries: 6 });
    expect(await readdir(ws.vault.root)).toEqual(
      expect.arrayContaining([out.file, out.file.replace('.zip', '-2.zip')]),
    );
  });

  it('computes CRC-32 as ZIP stores it, and deflates what it can', async () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    await fill();
    const done = await exportFolder(ws, NOW);
    const zip = await readFile(path.join(ws.vault.root, done.file));
    // ledger.json is text: deflated (method 8), and inflates back to the file.
    const at = zip.indexOf(Buffer.from('2026/ledger.json')) - 30;
    expect(zip.readUInt32LE(at)).toBe(0x04034b50);
    expect(zip.readUInt16LE(at + 8)).toBe(8);
    const size = zip.readUInt32LE(at + 18);
    const start = at + 30 + zip.readUInt16LE(at + 26);
    expect(inflateRawSync(zip.subarray(start, start + size)).toString('utf8')).toBe(
      await readFile(path.join(ws.vault.dir, 'ledger.json'), 'utf8'),
    );
  });
});
