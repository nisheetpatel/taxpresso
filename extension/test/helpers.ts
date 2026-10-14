import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { CantonRegistry } from '../src/cantons.js';
import { readConfig } from '../src/config.js';
import { Workspace } from '../src/workspace.js';

/** A fake UI build: dashboard/index.html, one asset, and the MCP Apps view. */
export async function makeUiDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'taxpresso-ui-'));
  await mkdir(path.join(dir, 'dashboard', 'assets'), { recursive: true });
  await mkdir(path.join(dir, 'views'), { recursive: true });
  await writeFile(
    path.join(dir, 'dashboard', 'index.html'),
    '<!doctype html><script type="module" src="/assets/app.js"></script>',
  );
  await writeFile(path.join(dir, 'dashboard', 'assets', 'app.js'), 'console.log(1);');
  await writeFile(path.join(dir, 'dashboard', 'notes.unknown'), 'not served');
  await writeFile(path.join(dir, 'views', 'dashboard.html'), '<!doctype html><p>dashboard</p>');
  return dir;
}

export interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

/** Raw request to 127.0.0.1, so tests control the Host header and the exact path. */
export function request(
  url: string,
  opts: {
    headers?: Record<string, string>;
    method?: string;
    path?: string;
    body?: string | Buffer;
  } = {},
): Promise<Reply> {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: u.port,
        method: opts.method ?? 'GET',
        path: opts.path ?? u.pathname + u.search,
        headers: { Host: u.host, ...opts.headers },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    req.on('error', reject);
    req.end(opts.body);
  });
}

/** A workspace on a fresh temporary vault (inside the OS temp folder, never in a repo). */
export async function makeWorkspace(uiDir?: string): Promise<Workspace> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'taxpresso-ws-'));
  const config = readConfig({
    TAXPRESSO_VAULT_PATH: path.join(root, 'Taxpresso'),
    ...(uiDir ? { TAXPRESSO_UI_DIR: uiDir } : {}),
  });
  return new Workspace(config, new CantonRegistry(config.taxYear));
}
