// The localhost dashboard (SPEC.md sections 3 and 15): binds 127.0.0.1 only, random port,
// per-session token, no CORS, strict CSP, serves only the files the UI build produced.
// This is a server. It never opens a connection to anything (C2).

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cache-Control': 'no-store',
};

interface StaticFile {
  body: Buffer;
  contentType: string;
}

export interface ApiRequest {
  method: 'GET' | 'POST';
  /** Path after /api, e.g. "/state". */
  path: string;
  query: URLSearchParams;
  headers: IncomingMessage['headers'];
  body: Buffer;
  /** Per-session token the page must send back on every change (CSRF). */
  csrf: string;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface DashboardOptions {
  /** Folder with index.html and its assets (the Vite build). */
  dir: string;
  /** Handles /api/*: the same state Claude sees through the tools. */
  api: (req: ApiRequest) => Promise<ApiResponse>;
}

/** Largest request body: documents up to 40 MB (as the vault), anything else 64 KB. */
const MAX_UPLOAD = 40 * 1024 * 1024 + 1024;
const MAX_JSON = 64 * 1024;

export class Dashboard {
  readonly #opts: DashboardOptions;
  readonly #token = randomBytes(32).toString('base64url');
  readonly #csrf = randomBytes(32).toString('base64url');
  #server: Server | undefined;
  #url: string | undefined;
  #starting: Promise<string> | undefined;

  constructor(opts: DashboardOptions) {
    this.#opts = opts;
  }

  get running(): boolean {
    return this.#url !== undefined;
  }

  /** Starts the server once and returns the URL with the session token. Safe to call repeatedly. */
  start(): Promise<string> {
    this.#starting ??= this.#start().catch((err: unknown) => {
      this.#starting = undefined;
      throw err;
    });
    return this.#starting;
  }

  async stop(): Promise<void> {
    const server = this.#server;
    this.#server = undefined;
    this.#url = undefined;
    this.#starting = undefined;
    if (!server) return;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  async #start(): Promise<string> {
    const files = await loadFiles(this.#opts.dir);
    if (!files.has('/index.html')) {
      throw new Error(`The dashboard files are missing (no index.html in ${this.#opts.dir}).`);
    }
    let port = 0;
    const server = createServer((req, res) => {
      this.#handle(req, res, files, port).catch(() => {
        if (!res.headersSent) send(res, 500, 'Something went wrong.');
        else res.destroy();
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve());
    });
    // The MCP stdio connection decides the process lifetime, not this server.
    server.unref();
    port = (server.address() as AddressInfo).port;
    this.#server = server;
    this.#url = `http://127.0.0.1:${port}/?t=${this.#token}`;
    return this.#url;
  }

  async #handle(
    req: IncomingMessage,
    res: ServerResponse,
    files: Map<string, StaticFile>,
    port: number,
  ): Promise<void> {
    // DNS rebinding: only answer to the loopback names we were opened with.
    const host = req.headers.host;
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
      return send(res, 421, 'Unknown host.');
    }
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    const isApi = url.pathname.startsWith('/api/');
    const method = req.method ?? 'GET';
    if (!(method === 'GET' || method === 'HEAD' || (isApi && method === 'POST'))) {
      return send(res, 405, 'Not allowed.', { Allow: isApi ? 'GET, POST' : 'GET, HEAD' });
    }
    const cookieName = `taxpresso_${port}`;
    const fromQuery = this.#tokenMatches(url.searchParams.get('t'));
    const authorized =
      fromQuery ||
      this.#tokenMatches(readCookie(req.headers.cookie, cookieName)) ||
      this.#tokenMatches(headerValue(req.headers['x-taxpresso-token']));
    if (!authorized) {
      return send(res, 401, 'Ask Claude to open your Taxpresso dashboard to get a working link.');
    }

    const extra: Record<string, string> = {};
    if (fromQuery) {
      // Lets the page load its own scripts, styles and fonts without the token in every URL.
      extra['Set-Cookie'] = `${cookieName}=${this.#token}; HttpOnly; SameSite=Strict; Path=/`;
    }

    if (isApi) {
      if (method === 'POST') {
        // Changes only from our own page: same origin, and the per-session CSRF token.
        const origin = headerValue(req.headers.origin);
        if (
          origin !== undefined &&
          origin !== `http://127.0.0.1:${port}` &&
          origin !== `http://localhost:${port}`
        ) {
          return send(res, 403, 'Wrong origin.');
        }
        if (!this.#csrfMatches(headerValue(req.headers['x-taxpresso-csrf']))) {
          return send(res, 403, 'Reload the dashboard and try again.');
        }
      }
      const limit = url.pathname === '/api/documents' ? MAX_UPLOAD : MAX_JSON;
      const body = method === 'POST' ? await readBody(req, limit) : Buffer.alloc(0);
      if (body === undefined) return send(res, 413, 'Too large.');
      const result = await this.#opts.api({
        method: method === 'POST' ? 'POST' : 'GET',
        path: url.pathname.slice(4),
        query: url.searchParams,
        headers: req.headers,
        body,
        csrf: this.#csrf,
      });
      return send(res, result.status, JSON.stringify(result.body), {
        ...extra,
        'Content-Type': CONTENT_TYPES['.json']!,
      });
    }
    const file = files.get(url.pathname === '/' ? '/index.html' : url.pathname);
    if (!file) return send(res, 404, 'Not found.');
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      ...extra,
      'Content-Type': file.contentType,
      'Content-Length': file.body.length,
    });
    res.end(req.method === 'HEAD' ? undefined : file.body);
  }

  #tokenMatches(candidate: string | undefined | null): boolean {
    return equalSecret(candidate, this.#token);
  }

  #csrfMatches(candidate: string | undefined | null): boolean {
    return equalSecret(candidate, this.#csrf);
  }
}

function send(
  res: ServerResponse,
  status: number,
  body: string,
  headers: Record<string, string> = {},
): void {
  const buf = Buffer.from(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': CONTENT_TYPES['.txt']!,
    ...headers,
    'Content-Length': buf.length,
  });
  res.end(buf);
}

function equalSecret(candidate: string | undefined | null, secret: string): boolean {
  if (!candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The request body, or undefined if it is larger than `limit` bytes (read to the end, then dropped). */
function readBody(req: IncomingMessage, limit: number): Promise<Buffer | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size <= limit) chunks.push(chunk);
    });
    req.on('end', () => resolve(size <= limit ? Buffer.concat(chunks) : undefined));
    req.on('error', reject);
  });
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

/** Every file under `dir`, keyed by URL path. Anything not in this map is a 404: no listing, no traversal. */
async function loadFiles(dir: string, files = new Map<string, StaticFile>(), root = dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await loadFiles(abs, files, root);
      continue;
    }
    const contentType = CONTENT_TYPES[path.extname(entry.name).toLowerCase()];
    if (!entry.isFile() || !contentType) continue;
    const urlPath = '/' + path.relative(root, abs).split(path.sep).join('/');
    files.set(urlPath, { body: await readFile(abs), contentType });
  }
  return files;
}
