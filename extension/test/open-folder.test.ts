// "Open my Taxpresso folder" (docs/design/three-pages.md, section 4): POST /folder/open opens the
// open year's folder in the system's file manager, the only use of node:child_process in the
// extension. Tests never open a window: the opener is a stub, and the one call site is read as text.
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import { createApi, folderNotOpened, type DashboardState } from '../src/api.js';
import { CantonRegistry } from '../src/cantons.js';
import { readConfig } from '../src/config.js';
import { Dashboard, type ApiRequest } from '../src/dashboard.js';
import { DASHBOARD_VIEW_URI, VIEW_KEY_META } from '../src/dashboard-view.js';
import { FILE_MANAGERS, systemFolderOpener } from '../src/open-folder.js';
import { createTaxpressoServer } from '../src/server.js';
import { Workspace } from '../src/workspace.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

const SRC = path.resolve(import.meta.dirname, '..', 'src');

const req = (lang = 'en', body: unknown = {}): ApiRequest => ({
  method: 'POST',
  path: '/folder/open',
  query: new URLSearchParams({ lang }),
  headers: {},
  body: Buffer.from(JSON.stringify(body)),
  csrf: 'csrf-token',
});

/** An opener that records the folders it was asked to open, and opens nothing. */
function stub(fail = false) {
  const opened: string[] = [];
  return {
    opened,
    open: (dir: string) => {
      opened.push(dir);
      return fail ? Promise.reject(new Error('no file manager')) : Promise.resolve();
    },
  };
}

describe('POST /folder/open', () => {
  it('makes the open year’s folder if needed and opens it, with the path as the only thing given', async () => {
    const ws = await makeWorkspace();
    const opener = stub();
    expect(existsSync(ws.vault.dir)).toBe(false);
    const res = await createApi(ws, { openFolder: opener.open })(req());
    expect(res.status).toBe(200);
    expect(opener.opened).toEqual([ws.vault.dir]);
    expect(existsSync(path.join(ws.vault.dir, 'documents'))).toBe(true);
    expect(existsSync(path.join(ws.vault.dir, 'README.txt'))).toBe(true);
    // The state, as after every change: the folder now exists.
    expect((res.body as DashboardState).vault.exists).toBe(true);
  });

  it('says plainly where the folder is when it can’t be opened, in the page’s language', async () => {
    const ws = await makeWorkspace();
    const failing = stub(true);
    const en = await createApi(ws, { openFolder: failing.open })(req('en'));
    expect(en.status).toBe(400);
    const where = ws.vaultInfo().path;
    expect((en.body as { error: string }).error).toBe(
      `Taxpresso couldn’t open your folder. Open it yourself${process.platform === 'darwin' ? ' in Finder' : process.platform === 'win32' ? ' in File Explorer' : ''}: ${where}`,
    );
    const fr = await createApi(ws, { openFolder: failing.open })(req('fr'));
    expect((fr.body as { error: string }).error).toMatch(/^Taxpresso n’a pas pu ouvrir/);
    // Without an opener (anywhere but the extension itself), the same plain message.
    const none = await createApi(ws)(req('de'));
    expect(none.status).toBe(400);
    expect((none.body as { error: string }).error).toMatch(/^Taxpresso konnte deinen Ordner/);
    expect(folderNotOpened('/x/2026', 'it', 'darwin')).toBe(
      'Taxpresso non è riuscito ad aprire la tua cartella. Aprila tu nel Finder: /x/2026',
    );
    expect(folderNotOpened('/x/2026', 'en', 'linux')).toBe(
      'Taxpresso couldn’t open your folder. Open it yourself: /x/2026',
    );
  });

  it('opens nothing for a folder inside a code repository', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'taxpresso-ws-'));
    await mkdir(path.join(root, '.git'));
    const config = readConfig({ TAXPRESSO_VAULT_PATH: path.join(root, 'Taxpresso') });
    const ws = new Workspace(config, new CantonRegistry(config.taxYear));
    const opener = stub();
    const res = await createApi(ws, { openFolder: opener.open })(req());
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toMatch(/inside a code repository/);
    expect(opener.opened).toEqual([]);
    expect(existsSync(ws.vault.dir)).toBe(false);
  });

  it('works from the panel inside Claude Desktop, through dashboard_api, with its checks', async () => {
    const uiDir = await makeUiDir();
    const ws = await makeWorkspace(uiDir);
    const opener = stub();
    const dashboard = new Dashboard({
      dir: path.join(uiDir, 'dashboard'),
      api: createApi(ws, { openFolder: opener.open }),
    });
    const server = createTaxpressoServer({ workspace: ws, dashboard });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(clientSide);
    try {
      const { contents } = await client.readResource({ uri: DASHBOARD_VIEW_URI });
      const html = (contents[0] as { text: string }).text;
      const key = new RegExp(`<meta name="${VIEW_KEY_META}" content="([^"]+)">`).exec(html)![1];
      const view = (args: Record<string, unknown>) =>
        client.callTool({ name: 'dashboard_api', arguments: { key, ...args } });
      const got = (await view({ method: 'GET', path: '/state' })) as {
        structuredContent: { body: DashboardState };
      };
      // A change without this session's CSRF token is refused before anything runs.
      const refused = (await view({ method: 'POST', path: '/folder/open' })) as {
        structuredContent: { status: number };
      };
      expect(refused.structuredContent.status).toBe(403);
      expect(opener.opened).toEqual([]);
      const csrf = got.structuredContent.body.csrf;
      const res = (await view({ method: 'POST', path: '/folder/open', csrf })) as {
        isError?: boolean;
        structuredContent: { status: number };
      };
      expect(res.isError).toBeFalsy();
      expect(res.structuredContent.status).toBe(200);
      expect(opener.opened).toEqual([ws.vault.dir]);
    } finally {
      await client.close();
      await dashboard.stop();
    }
  });
});

describe('the system’s opener', () => {
  it('runs the file manager of macOS, Windows or Linux, and nothing on another system', async () => {
    expect(FILE_MANAGERS).toEqual({ darwin: 'open', win32: 'explorer', linux: 'xdg-open' });
    await expect(systemFolderOpener('aix')('/tmp')).rejects.toThrow(/No file manager known/);
  });

  it('is the only use of node:child_process in the extension: one execFile call, no shell', async () => {
    const files = (await readdir(SRC, { recursive: true }))
      .map((f) => String(f).replaceAll('\\', '/'))
      .filter((f) => f.endsWith('.ts'));
    const using: string[] = [];
    for (const f of files) {
      if ((await readFile(path.join(SRC, f), 'utf8')).includes('child_process')) using.push(f);
    }
    expect(using).toEqual(['open-folder.ts']);
    const code = (await readFile(path.join(SRC, 'open-folder.ts'), 'utf8'))
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join('\n');
    expect(code.match(/import[^;]*from 'node:child_process'/g)).toEqual([
      "import { execFile } from 'node:child_process'",
    ]);
    expect(code.match(/\bexecFile\(/g)).toHaveLength(1);
    expect(code).toMatch(/execFile\(command, \[dir\], \{ shell: false,/);
    expect(code).not.toMatch(/\b(spawn|fork|exec|execSync|execFileSync|spawnSync)\b/);
    // Only the extension's entry point gives the system's opener to the API.
    const opening: string[] = [];
    for (const f of files) {
      if (f === 'open-folder.ts') continue;
      if ((await readFile(path.join(SRC, f), 'utf8')).includes('systemFolderOpener')) {
        opening.push(f);
      }
    }
    expect(opening).toEqual(['main.ts']);
  });
});
