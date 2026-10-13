#!/usr/bin/env node
// Offline test (SPEC.md section 13, item 8): drives the packaged extension end to end the way
// Claude Desktop does (stdio MCP), with the network guard preloaded into the server process.
// It must pass with networking disabled: CI runs it inside `docker run --network none`.
//
//   node test/offline/run.mjs                         uses extension/dist (run `pnpm build` first)
//   TAXPRESSO_EXTENSION_DIR=<unpacked .mcpb> node ...    tests another copy, e.g. an unzipped .mcpb
//   TAXPRESSO_EXPECT_NO_NETWORK=1                        also proves the sandbox itself is offline

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const extDir = path.resolve(
  process.env.TAXPRESSO_EXTENSION_DIR ?? path.join(root, 'extension', 'dist'),
);
const guard = pathToFileURL(path.join(here, 'net-guard.mjs')).href;
const work = mkdtempSync(path.join(os.tmpdir(), 'taxpresso-offline-'));
const guardLog = path.join(work, 'net-guard.log');
const vault = path.join(work, 'Taxpresso'); // deliberately not created

const REMOTE_REF = /\b(?:src|href)\s*=\s*["']?\s*(?:https?:)?\/\/(?!127\.0\.0\.1[:/])/i;
const VIEW_URI = 'ui://taxpresso/open-dashboard.html';

/** Raw HTTP GET to 127.0.0.1 so the test controls the Host header and the exact path. */
function get(url, { headers = {}, method = 'GET', path: rawPath, body } = {}) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: u.port, method, path: rawPath ?? u.pathname + u.search, headers },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

let client;
let transport;
/** Set once the dashboard test has opened the page. */
let dashboardSession;
let stderr = '';

before(async () => {
  assert.ok(
    existsSync(path.join(extDir, 'server', 'index.mjs')),
    `no built extension in ${extDir}; run pnpm build`,
  );
  transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', guard, path.join(extDir, 'server', 'index.mjs')],
    env: {
      ...process.env,
      TAXPRESSO_VAULT_PATH: vault,
      TAXPRESSO_UI_LANGUAGE: 'fr',
      TAXPRESSO_NET_GUARD_LOG: guardLog,
    },
    stderr: 'pipe',
  });
  transport.stderr?.on('data', (d) => (stderr += d));
  client = new Client({ name: 'taxpresso-offline-test', version: '0.0.0' });
  await client.connect(transport);
});

after(() => {
  if (stderr.trim()) console.log(`--- server stderr ---\n${stderr.trim()}`);
  rmSync(work, { recursive: true, force: true });
});

describe('offline end to end', { timeout: 60_000 }, () => {
  test(
    'the sandbox has no network (CI only)',
    { skip: process.env.TAXPRESSO_EXPECT_NO_NETWORK !== '1' },
    async () => {
      await assert.rejects(fetch('https://www.ge.ch/', { signal: AbortSignal.timeout(10_000) }));
    },
  );

  test('the guard catches an outbound request', () => {
    const log = path.join(work, 'guard-selftest.log');
    const r = spawnSync(
      process.execPath,
      [
        '--import',
        guard,
        '-e',
        "fetch('https://www.ge.ch/').catch(() => {}).finally(() => process.exit(0))",
      ],
      { env: { ...process.env, TAXPRESSO_NET_GUARD_LOG: log }, encoding: 'utf8', timeout: 20_000 },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.match(readFileSync(log, 'utf8'), /"kind":"fetch"/);
  });

  test('the guard is loaded in the server process', () => {
    assert.equal(readFileSync(`${guardLog}.pid`, 'utf8'), String(transport.pid));
  });

  test('server identifies itself and sends its instructions', () => {
    assert.equal(client.getServerVersion()?.name, 'taxpresso');
    assert.match(client.getInstructions() ?? '', /get_status/);
  });

  test('every tool is narrow and annotated (C6), and matches the manifest', async () => {
    const { tools } = await client.listTools();
    const manifest = JSON.parse(readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
    assert.deepEqual(tools.map((t) => t.name).sort(), manifest.tools.map((t) => t.name).sort());
    for (const tool of tools) {
      assert.ok(tool.name.length < 64, tool.name);
      assert.ok(tool.description && tool.description.length <= 300, `${tool.name} description`);
      assert.equal(typeof tool.annotations?.title, 'string', `${tool.name} title`);
      assert.equal(typeof tool.annotations?.readOnlyHint, 'boolean', `${tool.name} readOnlyHint`);
      assert.equal(
        typeof tool.annotations?.destructiveHint,
        'boolean',
        `${tool.name} destructiveHint`,
      );
    }
    const { prompts } = await client.listPrompts();
    assert.deepEqual(prompts.map((p) => p.name).sort(), manifest.prompts.map((p) => p.name).sort());
  });

  test('get_status reports the tax year and the vault, concise by default', async () => {
    const res = await client.callTool({ name: 'get_status', arguments: {} });
    assert.ok(!res.isError);
    assert.equal(res.structuredContent.taxYear, 2026);
    assert.equal(res.structuredContent.vault.exists, false, 'looking never creates the folder');
    assert.equal(res.structuredContent.runtime, undefined);
    assert.match(res.content[0].text, /tax year 2026/);

    const detailed = await client.callTool({ name: 'get_status', arguments: { detail: true } });
    assert.match(detailed.structuredContent.runtime.node, /^v\d+/);
  });

  test('bad tool input is refused', async () => {
    const res = await client
      .callTool({ name: 'get_status', arguments: { detail: 'yes' } })
      .catch((e) => ({ isError: true, e }));
    assert.equal(res.isError, true);
  });

  test('the prompt starts a Geneva tax return', async () => {
    const res = await client.getPrompt({ name: 'start_geneva_tax_return' });
    assert.match(res.messages[0].content.text, /Geneva tax return/);
  });

  test('open_dashboard serves the page on 127.0.0.1 only to the token holder', async () => {
    const first = await client.callTool({ name: 'open_dashboard', arguments: {} });
    const url = first.structuredContent.url;
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/\?t=[\w-]{43}$/);
    const again = await client.callTool({ name: 'open_dashboard', arguments: {} });
    assert.equal(again.structuredContent.url, url);
    const origin = new URL(url).origin;
    const host = new URL(url).host;

    const page = await get(url, { headers: { Host: host } });
    assert.equal(page.status, 200);
    assert.match(page.headers['content-type'], /text\/html/);
    assert.match(page.headers['content-security-policy'], /default-src 'none'/);
    assert.match(page.headers['set-cookie'][0], /HttpOnly; SameSite=Strict/);
    assert.equal(page.headers['access-control-allow-origin'], undefined);
    assert.doesNotMatch(page.body, REMOTE_REF);
    const cookie = page.headers['set-cookie'][0].split(';')[0];

    // Every asset the page references loads with the session cookie, and only with it.
    const assets = [...page.body.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(assets.length >= 2, 'page references its script and stylesheet');
    for (const asset of assets) {
      assert.equal(
        (await get(origin + asset, { headers: { Host: host, Cookie: cookie } })).status,
        200,
        asset,
      );
      assert.equal(
        (await get(origin + asset, { headers: { Host: host } })).status,
        401,
        `${asset} without token`,
      );
    }

    const api = await get(`${origin}/api/state`, { headers: { Host: host, Cookie: cookie } });
    assert.equal(api.status, 200);
    const state = JSON.parse(api.body);
    assert.equal(state.lang, 'fr');
    assert.ok(state.activity.some((a) => a.by === 'claude' && a.what === 'dashboard'));
    dashboardSession = { origin, host, cookie, csrf: state.csrf };

    assert.equal((await get(`${origin}/api/state`, { headers: { Host: host } })).status, 401);
    assert.equal(
      (await get(`${origin}/api/state`, { headers: { Host: host, Cookie: 'taxpresso_1=nope' } }))
        .status,
      401,
    );
    assert.equal(
      (await get(url, { headers: { Host: 'evil.example' } })).status,
      421,
      'DNS rebinding',
    );
    assert.equal((await get(url, { headers: { Host: host }, method: 'POST' })).status, 405);
    assert.equal(
      (
        await get(origin, {
          headers: { Host: host, Cookie: cookie },
          path: '/%2e%2e/manifest.json',
        })
      ).status,
      404,
    );
    assert.equal(
      (await get(origin, { headers: { Host: host, Cookie: cookie }, path: '/../manifest.json' }))
        .status,
      404,
    );
    assert.equal(
      (await get(origin, { headers: { Host: host, Cookie: cookie }, path: '/assets/' })).status,
      404,
      'no listing',
    );
  });

  test('open_dashboard declares an MCP Apps view that loads nothing remote', async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'open_dashboard');
    assert.equal(tool._meta?.ui?.resourceUri, VIEW_URI);
    const { contents } = await client.readResource({ uri: VIEW_URI });
    assert.equal(contents[0].mimeType, 'text/html;profile=mcp-app');
    assert.match(contents[0].text, /<script type="module">/);
    assert.doesNotMatch(
      contents[0].text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''),
      REMOTE_REF,
    );
  });

  test('answers in the chat and in the dashboard, and documents, all land in the folder', async () => {
    assert.ok(dashboardSession, 'the dashboard test ran first');
    const { origin, host, cookie, csrf } = dashboardSession;
    const saved = await client.callTool({
      name: 'answer_question',
      arguments: { id: 'civil_status', value: 'single' },
    });
    assert.ok(!saved.isError, saved.content?.[0]?.text);
    const post = (p, body, headers = {}) =>
      get(origin, {
        method: 'POST',
        path: p,
        body,
        headers: { Host: host, Cookie: cookie, 'X-Taxpresso-CSRF': csrf, ...headers },
      });
    const answered = await post('/api/answer', JSON.stringify({ id: 'children', value: 0 }), {
      'Content-Type': 'application/json',
    });
    assert.equal(answered.status, 200, answered.body);
    const uploaded = await post('/api/documents', Buffer.from('%PDF-1.7 synthetic test document'), {
      'X-Filename': encodeURIComponent('Attestation 3a.pdf'),
    });
    assert.equal(uploaded.status, 200, uploaded.body);
    const state = JSON.parse(uploaded.body);
    assert.equal(state.documents[0].filename, 'Attestation 3a.pdf');

    const ledger = JSON.parse(readFileSync(path.join(vault, '2026', 'ledger.json'), 'utf8'));
    assert.deepEqual(
      ledger.facts.map((f) => [f.key, f.value, f.source.via]),
      [
        ['profile.civil_status', 'single', 'chat'],
        ['profile.children_count', 0, 'dashboard'],
      ],
    );
    const stored = readdirSync(path.join(vault, '2026', 'documents'));
    assert.deepEqual(
      stored.map((f) => f.replace(/^[0-9a-f]{8}-/, '')),
      ['Attestation 3a.pdf'],
    );
    const status = await client.callTool({ name: 'get_status', arguments: {} });
    assert.match(status.content[0].text, /Documents: 1 \(1 to identify\)/);
  });

  test('a broker export in the folder becomes securities facts, offline (SPEC.md 5.7)', async () => {
    // Synthetic Dupont data: made-up account, security and ISIN (valid check digit, no real security).
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse queryName="offline" type="AF"><FlexStatements count="1">
<FlexStatement accountId="U0000001" fromDate="20260101" toDate="20261231" whenGenerated="20270104;093000">
<AccountInformation accountId="U0000001" currency="CHF"/>
<OpenPositions><OpenPosition accountId="U0000001" currency="USD" fxRateToBase="0.8" assetCategory="STK" description="ESPRESSO INDUSTRIES INC" isin="USTXPRS00017" reportDate="20261231" position="10" markPrice="125.5" positionValue="1255" levelOfDetail="SUMMARY"/></OpenPositions>
<CashTransactions><CashTransaction accountId="U0000001" currency="USD" fxRateToBase="0.88125" assetCategory="STK" isin="USTXPRS00017" dateTime="20260325;202000" amount="5" type="Dividends" levelOfDetail="DETAIL"/></CashTransactions>
</FlexStatement></FlexStatements></FlexQueryResponse>`;
    writeFileSync(path.join(vault, '2026', 'flex.xml'), xml);
    const res = await client.callTool({ name: 'ingest_vault', arguments: {} });
    assert.ok(!res.isError);
    assert.match(res.content[0].text, /flex\.xml \(read as a broker export: Interactive Brokers\)/);
    const docs = JSON.parse(readFileSync(path.join(vault, '2026', 'documents.json'), 'utf8'));
    assert.equal(docs.documents.find((d) => d.filename === 'flex.xml').kind, 'broker_export');
    const ledger = JSON.parse(readFileSync(path.join(vault, '2026', 'ledger.json'), 'utf8'));
    const facts = ledger.facts.filter((f) => f.key.startsWith('securities.'));
    const value = facts.find((f) => f.key === 'securities.value_chf');
    assert.deepEqual(
      [value.instance, value.value, value.status],
      ['USTXPRS00017', 100400, 'estimate'],
    );
    const income = facts.find((f) => f.key === 'securities.income_gross_chf');
    assert.deepEqual([income.value, income.status], [441, 'extracted']);
    assert.ok(facts.every((f) => f.source.method === 'export'));
  });

  test('the server exits when Claude Desktop closes it', async () => {
    const pid = transport.pid;
    await client.close();
    const deadline = Date.now() + 5000;
    const alive = () => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
    while (alive() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
    assert.equal(alive(), false, 'server process still running');
  });

  test('with the dashboard running, the server exits when stdin closes', async () => {
    // Raw JSON-RPC with the 2025-06-18 handshake, as current Claude Desktop builds speak it.
    const child = spawn(
      process.execPath,
      ['--import', guard, path.join(extDir, 'server', 'index.mjs')],
      {
        env: { ...process.env, TAXPRESSO_VAULT_PATH: vault, TAXPRESSO_NET_GUARD_LOG: guardLog },
        stdio: ['pipe', 'pipe', 'inherit'],
      },
    );
    const send = (msg) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
    const replies = new Map();
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d;
      for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
        const msg = JSON.parse(buf.slice(0, i));
        buf = buf.slice(i + 1);
        if (msg.id !== undefined) replies.set(msg.id, msg);
      }
    });
    const reply = async (id) => {
      const deadline = Date.now() + 10_000;
      while (!replies.has(id) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
      return replies.get(id);
    };
    send({
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 't', version: '0' },
      },
    });
    assert.equal((await reply(1))?.result?.serverInfo?.name, 'taxpresso');
    send({ method: 'notifications/initialized' });
    send({ id: 2, method: 'tools/call', params: { name: 'open_dashboard', arguments: {} } });
    assert.match((await reply(2))?.result?.structuredContent?.url ?? '', /^http:\/\/127\.0\.0\.1:/);
    const exited = new Promise((resolve) => child.once('exit', (code) => resolve(code)));
    child.stdin.end();
    const code = await Promise.race([
      exited,
      new Promise((r) => setTimeout(() => r('timeout'), 5000)),
    ]);
    if (code === 'timeout') child.kill();
    assert.equal(code, 0);
  });

  test('no outbound network attempt was made (C2)', () => {
    const attempts = existsSync(guardLog) ? readFileSync(guardLog, 'utf8').trim() : '';
    assert.equal(attempts, '', `outbound attempts:\n${attempts}`);
  });
});
