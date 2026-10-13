#!/usr/bin/env node
// Dev tool, never shipped: serves ui/dist on 127.0.0.1 and plays the MCP client behind the preview
// host (dist/preview/), so the dashboard view can be used in a browser against a real extension.
// It starts the built extension over stdio on a new temporary Taxpresso folder, never the real
// ~/Documents/Taxpresso, and passes the view's tool calls to it.
//
//   pnpm build && pnpm --filter @taxpresso/ui preview:card
//   node ui/scripts/preview-serve.mjs [--demo] [--lang fr] [--port 4173]
//   open http://127.0.0.1:4173/preview/?lang=fr&theme=dark
//
// --demo answers a few questions and adds the synthetic Dupont salary certificate.

import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const { values: args } = parseArgs({
  options: {
    demo: { type: 'boolean', default: false },
    lang: { type: 'string', default: 'en' },
    port: { type: 'string', default: '4173' },
  },
});
const ui = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(ui, '..');
const dist = path.join(ui, 'dist');
const work = await mkdtemp(path.join(os.tmpdir(), 'taxpresso-preview-'));
const vault = path.join(work, 'Taxpresso');

const client = new Client({ name: 'taxpresso-preview-host', version: '0.0.0' });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [path.join(repo, 'extension', 'dist', 'server', 'index.mjs')],
    env: { ...process.env, TAXPRESSO_VAULT_PATH: vault, TAXPRESSO_UI_LANGUAGE: args.lang },
    stderr: 'inherit',
  }),
);

if (args.demo) {
  for (const [id, value] of [
    ['civil_status', 'single'],
    ['children', 0],
    ['commune', 'meyrin'],
  ]) {
    await client.callTool({ name: 'answer_question', arguments: { id, value } });
  }
  const year = path.join(vault, '2026');
  await mkdir(year, { recursive: true });
  await copyFile(
    path.join(repo, 'test', 'fixtures', 'dupont-certificat-salaire-2026.pdf'),
    path.join(year, 'dupont-certificat-salaire-2026.pdf'),
  );
  await client.callTool({ name: 'ingest_vault', arguments: {} });
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

const server = createServer((req, res) => {
  const reply = (status, body, type = 'application/json') => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  };
  void (async () => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/__mcp/open') {
      return reply(
        200,
        JSON.stringify(await client.callTool({ name: 'open_dashboard', arguments: {} })),
      );
    }
    if (url.pathname === '/__mcp/call' && req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const { name, arguments: toolArgs } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      return reply(200, JSON.stringify(await client.callTool({ name, arguments: toolArgs })));
    }
    const rel = path.normalize(
      url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname,
    );
    const file = path.join(dist, rel);
    if (!file.startsWith(dist + path.sep)) return reply(404, 'Not found.', 'text/plain');
    try {
      reply(200, await readFile(file), TYPES[path.extname(file)] ?? 'application/octet-stream');
    } catch {
      reply(404, 'Not found.', 'text/plain');
    }
  })().catch((err) => reply(500, String(err), 'text/plain'));
});
server.listen(Number(args.port), '127.0.0.1', () => {
  console.log(`Preview: http://127.0.0.1:${args.port}/preview/?lang=${args.lang}`);
  console.log(`Temporary Taxpresso folder: ${vault}`);
});

const stop = async () => {
  server.close();
  await client.close().catch(() => undefined);
  await rm(work, { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
