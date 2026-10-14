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
import { inflateRawSync } from 'node:zlib';
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
const VIEW_URI = 'ui://taxpresso/dashboard.html';

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
    // The manifest lists what Claude can call; a tool only the dashboard view calls is not in it.
    const forClaude = tools.filter((t) => t._meta?.ui?.visibility?.join() !== 'app');
    assert.deepEqual(forClaude.map((t) => t.name).sort(), manifest.tools.map((t) => t.name).sort());
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

  test('the prompt starts a tax return', async () => {
    const res = await client.getPrompt({ name: 'start_geneva_tax_return' });
    assert.match(res.messages[0].content.text, /my tax return for 2026/);
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

  test('open_dashboard shows the dashboard in the chat: one self-contained view', async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'open_dashboard');
    assert.equal(tool._meta?.ui?.resourceUri, VIEW_URI);
    const { contents } = await client.readResource({ uri: VIEW_URI });
    const html = contents[0].text;
    assert.equal(contents[0].mimeType, 'text/html;profile=mcp-app');
    // It asks for no outside domain: no connection, no remote script, style, font or frame.
    const csp = contents[0]._meta?.ui?.csp ?? {};
    for (const list of ['connectDomains', 'resourceDomains', 'frameDomains']) {
      assert.deepEqual(csp[list] ?? [], [], list);
    }
    // Everything is inline: one module script, styles, fonts as bytes. Nothing to load.
    assert.match(html, /<script type="module">/);
    assert.equal((html.match(/<script\b/gi) ?? []).length, 1, 'one inline script');
    assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i);
    assert.doesNotMatch(html, /<link\b/i);
    const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    assert.doesNotMatch(markup, REMOTE_REF);
    assert.doesNotMatch(markup, /url\(\s*["']?\s*(?:https?:)?\/\//i, 'no remote url() in styles');
    assert.doesNotMatch(markup, /@import/i);
    assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)\.com/);
    assert.doesNotMatch(markup, /@font-face/, 'fonts come as bytes, not from a font source');
    assert.match(html, /Geist Mono Variable/);
  });

  test('the view reaches the same API through dashboard_api, with the same checks', async () => {
    assert.ok(dashboardSession, 'the dashboard test ran first');
    const { tools } = await client.listTools();
    assert.deepEqual(tools.find((t) => t.name === 'dashboard_api')?._meta?.ui?.visibility, ['app']);
    // The view's key is in its HTML, which the model never reads; without it the tool refuses.
    const { contents } = await client.readResource({ uri: VIEW_URI });
    const key = /<meta name="taxpresso-view-key" content="([^"]+)">/.exec(contents[0].text)?.[1];
    assert.ok(key, 'the view carries its key');
    const keyless = await client.callTool({
      name: 'dashboard_api',
      arguments: { method: 'GET', path: '/state', key: 'not-the-key' },
    });
    assert.equal(keyless.structuredContent?.status, 403);
    const view = (args) => client.callTool({ name: 'dashboard_api', arguments: { key, ...args } });
    const state = await view({ method: 'GET', path: '/state', query: { lang: 'fr' } });
    assert.ok(!state.isError);
    const { origin, host, cookie } = dashboardSession;
    const http = await get(`${origin}/api/state?lang=fr`, {
      headers: { Host: host, Cookie: cookie },
    });
    assert.deepEqual(state.structuredContent.body, JSON.parse(http.body));
    const refused = await view({ method: 'POST', path: '/skip', body: { id: 'children' } });
    assert.equal(refused.isError, true);
    assert.equal(refused.structuredContent.status, 403);
    assert.equal((await view({ method: 'GET', path: '/nope' })).structuredContent.status, 404);
  });

  test('answers in the chat and in the dashboard, and documents, all land in the folder', async () => {
    assert.ok(dashboardSession, 'the dashboard test ran first');
    const { origin, host, cookie, csrf } = dashboardSession;
    // The canton first: the questions that follow are Geneva's.
    const canton = await client.callTool({
      name: 'answer_question',
      arguments: { id: 'canton', value: 'GE' },
    });
    assert.ok(!canton.isError, canton.content?.[0]?.text);
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
        ['profile.canton', 'GE', 'chat'],
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

  test("last year's declaration in the folder is read offline into suggestions and figures (SPEC.md 5.4)", async () => {
    writeFileSync(
      path.join(vault, '2026', 'declaration-2025.pdf'),
      readFileSync(path.join(root, 'test', 'fixtures', 'dupont-declaration-2025.pdf')),
    );
    const res = await client.callTool({ name: 'ingest_vault', arguments: {} });
    assert.ok(!res.isError);
    assert.match(
      res.content[0].text,
      /declaration-2025\.pdf \(read as last year's declaration, 2025\)/,
    );
    const docs = JSON.parse(readFileSync(path.join(vault, '2026', 'documents.json'), 'utf8'));
    const doc = docs.documents.find((d) => d.filename === 'declaration-2025.pdf');
    assert.deepEqual([doc.kind, doc.taxYear, doc.parse.ok], ['prior_declaration', 2025, true]);
    const ledger = JSON.parse(readFileSync(path.join(vault, '2026', 'ledger.json'), 'utf8'));
    const pillar3a = ledger.facts.find(
      (f) => f.key === 'prior.person.icc' && f.instance === 'A1-31.40',
    );
    assert.deepEqual(
      [pillar3a.value, pillar3a.status, pillar3a.person],
      [700000, 'extracted', 'p1'],
    );
    // Suggestions only: no answer is ever saved from the document.
    const fromDoc = ledger.facts.filter((f) => f.source.docId === doc.id);
    assert.ok(fromDoc.every((f) => f.status === 'extracted' && f.source.method === 'pdf_text'));
    // Nothing that identifies the taxpayer is stored.
    const stored = readFileSync(path.join(vault, '2026', 'ledger.json'), 'utf8');
    for (const s of ['DUPONT', '01.01.1980', '756.0000', '000.00.0000-0', '1214 Vernier']) {
      assert.ok(!stored.includes(s), s);
    }
    const last = await client.callTool({ name: 'get_last_year', arguments: {} });
    assert.match(last.content[0].text, /31\.40 Pillar 3a .*ICC CHF 7’000/);
  });

  test("review_last_year reviews last year's declaration offline, read-only", async () => {
    const before = readFileSync(path.join(vault, '2026', 'ledger.json'), 'utf8');
    const res = await client.callTool({ name: 'review_last_year', arguments: {} });
    assert.ok(!res.isError, res.content?.[0]?.text);
    const r = res.structuredContent;
    assert.deepEqual([r.found, r.status, r.year], [true, 'ready', 2025]);
    // The Dupont 2025 declaration: 7'000 paid of the 2025 limit of 7'258 with a pension fund.
    assert.deepEqual(
      r.missed3a.map((m) => [m.person, m.code, m.paid, m.options[0].gap]),
      [
        ['p1', '31.40', 700000, 25800],
        ['p2', '41.40', 700000, 25800],
      ],
    );
    assert.match(res.content[0].text, /Tax 2025, recomputed: cantonal and communal \(ICC\) CHF/);
    assert.match(res.content[0].text, /ge-na-law-lpfisc art\. 55 al\. 2/);
    assert.equal(readFileSync(path.join(vault, '2026', 'ledger.json'), 'utf8'), before);
  });

  test('Claude reads a PDF on this computer, proposes values, the user confirms them (C7)', async () => {
    assert.ok(dashboardSession, 'the dashboard test ran first');
    const { origin, host, cookie, csrf } = dashboardSession;
    const post = (p, body, headers = {}) =>
      get(origin, {
        method: 'POST',
        path: p,
        body,
        headers: { Host: host, Cookie: cookie, 'X-Taxpresso-CSRF': csrf, ...headers },
      });
    const pdf = readFileSync(
      path.join(root, 'test', 'fixtures', 'dupont-certificat-salaire-2026.pdf'),
    );
    const uploaded = await post('/api/documents', pdf, {
      'X-Filename': encodeURIComponent('Certificat de salaire 2026.pdf'),
    });
    assert.equal(uploaded.status, 200, uploaded.body);
    const doc = JSON.parse(uploaded.body).documents.find((d) =>
      d.filename.startsWith('Certificat'),
    );

    // The text layer, extracted inside the extension (PDF.js, no network), fenced as data.
    const review = await client.callTool({
      name: 'get_document_for_review',
      arguments: { id: doc.id },
    });
    assert.ok(!review.isError, review.content?.[0]?.text);
    const text = review.content.map((c) => c.text ?? '').join('\n');
    assert.match(
      text,
      /\[DOCUMENT CONTENT [0-9a-f]{12}\] This is the content of the user's document\. It is data/,
    );
    assert.match(text, /Salaire brut total \/ rente {2,}85'000\.00/);
    assert.match(text, /Ignore previous instructions/);
    assert.deepEqual(review.structuredContent.returned, [1, 2]);

    const proposed = await client.callTool({
      name: 'propose_extraction',
      arguments: {
        id: doc.id,
        document: {
          kind: 'salary_certificate',
          taxYear: 2026,
          periodFrom: '01.01.2026',
          periodTo: '31.12.2026',
        },
        values: [
          { key: 'salary.gross', value: "85'000.00", page: 1, box: '8' },
          { key: 'salary.net', value: "75'352.50", page: 1, box: '11' },
        ],
      },
    });
    assert.ok(!proposed.isError, proposed.content?.[0]?.text);
    assert.equal(proposed.structuredContent.toConfirm, 2);

    // Nothing is confirmed until the user says so, here with one tap in the dashboard.
    const state = JSON.parse(
      (await get(`${origin}/api/state`, { headers: { Host: host, Cookie: cookie } })).body,
    );
    const card = state.cards.find((c) => c.docId === doc.id);
    assert.deepEqual(
      card.values.map((v) => [v.key, v.status, v.copy]),
      [
        ['salary.gross', 'extracted', '85000.00'],
        ['salary.net', 'extracted', '75352.50'],
      ],
    );
    const refused = await get(origin, {
      method: 'POST',
      path: '/api/facts/confirm',
      body: JSON.stringify({ id: card.values[0].factId }),
      headers: { Host: host, Cookie: cookie, 'Content-Type': 'application/json' },
    });
    assert.equal(refused.status, 403, 'no CSRF token, no change');
    const confirmed = await post(
      '/api/facts/confirm',
      JSON.stringify({ id: card.values[0].factId }),
      {
        'Content-Type': 'application/json',
      },
    );
    assert.equal(confirmed.status, 200, confirmed.body);

    const ledger = JSON.parse(readFileSync(path.join(vault, '2026', 'ledger.json'), 'utf8'));
    const gross = ledger.facts.filter((f) => f.key === 'salary.gross');
    assert.deepEqual(
      gross.map((f) => [f.value, f.status, f.source.method, f.source.via ?? null, f.source.page]),
      [
        [8_500_000, 'extracted', 'claude', null, 1],
        [8_500_000, 'stated', 'user', 'dashboard', 1],
      ],
    );
    // The securities read from the broker export above also wait for the user's OK; this
    // document has one value left to confirm.
    const listed = await client.callTool({ name: 'list_documents', arguments: {} });
    assert.match(
      listed.content[0].text,
      new RegExp(`${doc.id} Certificat de salaire 2026\\.pdf: .*; 1 value needs the user's OK`),
    );
  });

  test('barcodes are read on this computer: verified values, nothing personal kept (SPEC.md 5)', async () => {
    // Synthetic Dupont documents (test/fixtures/make-barcode-fixtures.mjs). The barcode reader is
    // the WebAssembly shipped in server/, read from disk, with the network guard in place.
    const fixtures = path.join(root, 'test', 'fixtures', 'barcodes');
    for (const name of [
      'dupont-certificat-salaire-2026-code-barres.pdf',
      'dupont-releve-fiscal-2026.pdf',
    ]) {
      writeFileSync(path.join(vault, '2026', name), readFileSync(path.join(fixtures, name)));
    }
    const res = await client.callTool({ name: 'ingest_vault', arguments: {} });
    assert.ok(!res.isError, res.content?.[0]?.text);
    assert.match(
      res.content[0].text,
      /code-barres\.pdf \(Salary certificate, 2026, Espresso Industries SA: read from the barcode \(verified\), \d+ values\)/,
    );
    assert.match(
      res.content[0].text,
      /releve-fiscal-2026\.pdf \(Bank e-tax statement, 2026, Banque Fictive Espresso SA: read from the barcode \(verified\)/,
    );
    const ledgerText = readFileSync(path.join(vault, '2026', 'ledger.json'), 'utf8');
    const documentsText = readFileSync(path.join(vault, '2026', 'documents.json'), 'utf8');
    const ledger = JSON.parse(ledgerText);
    const barcode = ledger.facts.filter((f) => f.source.method === 'barcode');
    assert.ok(barcode.every((f) => f.status === 'verified'));
    const gross = barcode.find((f) => f.key === 'salary.gross');
    assert.deepEqual([gross.value, gross.person, gross.source.field], [8_500_000, 'p1', '8']);
    const statement = barcode.find((f) => f.key === 'tax_statement.taxable_value');
    assert.equal(statement.value, 1_429_965);
    for (const text of [ledgerText, documentsText]) {
      assert.doesNotMatch(text, /756\.0000\.0000\.17|Dupont|Chemin des Exemples|TXP-000001/);
    }
    const status = await client.callTool({ name: 'get_status', arguments: {} });
    assert.match(status.content[0].text, /2 read from the barcode/);
  });

  test("this year's declaration PDF is checked against the values to type, offline (SPEC.md 10.4)", async () => {
    // Synthetic Dupont declaration for 2026 (test/fixtures/make-prior-fixtures.mjs), read by the
    // same reader as last year's, with the network guard in place.
    writeFileSync(
      path.join(vault, '2026', 'declaration-2026.pdf'),
      readFileSync(path.join(root, 'test', 'fixtures', 'dupont-declaration-2026.pdf')),
    );
    const res = await client.callTool({ name: 'ingest_vault', arguments: {} });
    assert.ok(!res.isError, res.content?.[0]?.text);
    assert.match(
      res.content[0].text,
      /declaration-2026\.pdf \(this year's declaration: reconcile_official_pdf compares it/,
    );
    const docs = JSON.parse(readFileSync(path.join(vault, '2026', 'documents.json'), 'utf8'));
    const doc = docs.documents.find((d) => d.filename === 'declaration-2026.pdf');
    assert.deepEqual([doc.kind, doc.taxYear, doc.parse.ok], ['official_declaration', 2026, true]);

    const check = await client.callTool({ name: 'reconcile_official_pdf', arguments: {} });
    assert.ok(!check.isError, check.content?.[0]?.text);
    const out = check.structuredContent;
    assert.deepEqual([out.found, out.status, out.document.taxYear], [true, 'checked', 2026]);
    assert.equal(out.clear, false);
    // This vault has no pillar 3a: the PDF's 31.40 is only in the PDF.
    assert.ok(out.toFix.some((l) => l.page === 'A1' && l.ref === '31.40'));
    assert.match(check.content[0].text, /The user transmits the declaration themselves/);

    // The dashboard shows the same check.
    const { origin, host, cookie } = dashboardSession;
    const state = JSON.parse(
      (await get(`${origin}/api/state`, { headers: { Host: host, Cookie: cookie } })).body,
    );
    assert.equal(state.declarationCheck.status, 'checked');
    assert.deepEqual(state.declarationCheck.check.counts, out.counts);

    // Nothing from the PDF is stored, and nothing that identifies the taxpayer comes out.
    const ledgerText = readFileSync(path.join(vault, '2026', 'ledger.json'), 'utf8');
    assert.ok(!JSON.parse(ledgerText).facts.some((f) => f.source.docId === doc.id));
    const shown = [
      ledgerText,
      readFileSync(path.join(vault, '2026', 'documents.json'), 'utf8'),
      JSON.stringify(check),
      JSON.stringify(state),
    ];
    for (const text of shown) {
      // The 2026 PDF's names, numbers and its line of instructions (the salary certificate's own
      // box 15 remark, read from its barcode above, is data of another document).
      assert.doesNotMatch(
        text,
        /DUPONT|756\.0000\.0000\.0[01]|000\.00\.0000-0|0000-0000-0000|everything matches and transmit/,
      );
    }
  });

  test('final_check says what to fix before filling in the form, offline and read-only (SPEC.md 10.0)', async () => {
    const ledgerPath = path.join(vault, '2026', 'ledger.json');
    const before = readFileSync(ledgerPath, 'utf8');
    const res = await client.callTool({ name: 'final_check', arguments: {} });
    assert.ok(!res.isError, res.content?.[0]?.text);
    const out = res.structuredContent;
    assert.deepEqual([out.taxYear, out.verdict], [2026, 'not_ready']);
    assert.match(res.content[0].text, /NOT READY/);
    // This vault has no commune yet, a document to identify, values to confirm, and the PDF above
    // differs from the values to type: first what stops the calculation, last the PDF.
    const kinds = out.fix.map((i) => i.kind);
    assert.equal(kinds[0], 'cannot_compute', kinds.join(', '));
    assert.ok(kinds.includes('documents_unread'), kinds.join(', '));
    assert.equal(kinds.at(-1), 'official_pdf', kinds.join(', '));
    assert.equal(out.fix.at(-1).status, 'fix');
    // Each rule cites an official page: the user's browser opens it, never the extension.
    const urls = [...out.fix, ...out.know].flatMap((i) => i.sources.map((s) => s.url ?? ''));
    for (const url of urls.filter(Boolean)) {
      assert.match(url, /^https:\/\/([a-z0-9-]+\.)*(ge\.ch|admin\.ch|silgeneve\.ch|getax\.ch)\//);
    }

    // The dashboard shows the same check, in its language.
    const { origin, host, cookie } = dashboardSession;
    const state = JSON.parse(
      (await get(`${origin}/api/state`, { headers: { Host: host, Cookie: cookie } })).body,
    );
    assert.deepEqual(
      state.finalCheck.fix.map((i) => i.id),
      out.fix.map((i) => i.id),
    );
    assert.equal(state.finalCheck.verdict, 'not_ready');

    // Read-only: nothing written, nothing that identifies the taxpayer shown.
    assert.equal(readFileSync(ledgerPath, 'utf8'), before);
    for (const text of [JSON.stringify(res), JSON.stringify(state.finalCheck)]) {
      assert.doesNotMatch(text, /DUPONT|756\.0000\.0000\.0[01]|everything matches and transmit/);
    }
  });

  test('export_bundle writes one ZIP of the year folder into the Taxpresso folder, offline', async () => {
    const res = await client.callTool({ name: 'export_bundle', arguments: {} });
    assert.ok(!res.isError, res.content?.[0]?.text);
    const { file, entries, path: shown } = res.structuredContent;
    assert.match(file, /^Taxpresso-2026-export-\d{4}-\d{2}-\d{2}\.zip$/);
    assert.ok(shown.endsWith(file));
    assert.match(res.content[0].text, /It stays on this computer/);
    const zip = readFileSync(path.join(vault, file));
    // The central directory, read here independently of the extension's writer.
    const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const count = zip.readUInt16LE(end + 10);
    let at = zip.readUInt32LE(end + 16);
    const names = new Map();
    for (let i = 0; i < count; i++) {
      assert.equal(zip.readUInt32LE(at), 0x02014b50);
      const length = zip.readUInt16LE(at + 28);
      const name = zip.subarray(at + 46, at + 46 + length).toString('utf8');
      names.set(name, {
        method: zip.readUInt16LE(at + 10),
        size: zip.readUInt32LE(at + 20),
        offset: zip.readUInt32LE(at + 42),
      });
      at += 46 + length + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
    }
    assert.equal(names.size, entries);
    assert.ok([...names.keys()].every((n) => n.startsWith('2026/')));
    for (const n of ['2026/ledger.json', '2026/documents.json', '2026/declaration-2026.pdf']) {
      assert.ok(names.has(n), n);
    }
    const ledger = names.get('2026/ledger.json');
    const start = ledger.offset + 30 + zip.readUInt16LE(ledger.offset + 26);
    const body = zip.subarray(start, start + ledger.size);
    assert.equal(
      (ledger.method === 8 ? inflateRawSync(body) : body).toString('utf8'),
      readFileSync(path.join(vault, '2026', 'ledger.json'), 'utf8'),
    );
    // Next to the year folder, not in it.
    assert.ok(!readdirSync(path.join(vault, '2026')).some((n) => n.endsWith('.zip')));
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

  test('a Zurich return: its questions, its tax and the values to type, offline', async () => {
    // A second household in its own folder, in a second server process with the same guard:
    // Lea Beispiel, single, in Zürich, with the synthetic salary certificate read from its barcode.
    const zhVault = path.join(work, 'Zurich');
    const zhTransport = new StdioClientTransport({
      command: process.execPath,
      args: ['--import', guard, path.join(extDir, 'server', 'index.mjs')],
      env: {
        ...process.env,
        TAXPRESSO_VAULT_PATH: zhVault,
        TAXPRESSO_UI_LANGUAGE: 'de',
        TAXPRESSO_NET_GUARD_LOG: guardLog,
      },
      stderr: 'pipe',
    });
    zhTransport.stderr?.on('data', (d) => (stderr += d));
    const zh = new Client({ name: 'taxpresso-offline-test-zh', version: '0.0.0' });
    await zh.connect(zhTransport);
    try {
      const answers = [
        ['canton', 'ZH'],
        ['civil_status', 'single'],
        ['children', 0],
        ['commune', 'Zürich'],
        ['moved', 'no'],
        ['church:p1', 'none'],
        ['income_sources:p1', ['salary']],
        ['employers:p1', 1],
        ['taxed_at_source:p1', false],
        ['pillar3a:p1', false],
        ['lpp_buyin:p1', false],
        ['commute:p1', 'public_transport'],
        ['commute_transit_cost:p1', 880],
        ['meal_days:p1', 0],
        ['banks', 0],
        ['crypto', false],
        ['payments', []],
        ['special', []],
      ];
      for (const [id, value] of answers) {
        const res = await zh.callTool({ name: 'answer_question', arguments: { id, value } });
        assert.ok(!res.isError, `${id}: ${res.content?.[0]?.text}`);
      }
      const status = await zh.callTool({ name: 'get_status', arguments: {} });
      assert.equal(status.structuredContent.canton, 'ZH');
      const name = 'dupont-certificat-salaire-2026-code-barres.pdf';
      writeFileSync(
        path.join(zhVault, '2026', name),
        readFileSync(path.join(root, 'test', 'fixtures', 'barcodes', name)),
      );
      const ingest = await zh.callTool({ name: 'ingest_vault', arguments: {} });
      assert.ok(!ingest.isError, ingest.content?.[0]?.text);

      const tax = await zh.callTool({ name: 'compute_tax', arguments: {} });
      assert.ok(!tax.isError, tax.content?.[0]?.text);
      assert.equal(tax.structuredContent.canton, 'ZH');
      assert.equal(tax.structuredContent.computed, true, tax.content[0].text);
      assert.deepEqual(tax.structuredContent.commune, { bfs: 261, name: 'Zürich', rate: 119 });
      assert.ok(tax.structuredContent.icc.total > 0);
      assert.ok(tax.structuredContent.ifd.tax > 0);
      assert.match(tax.content[0].text, /Staats- und Gemeindesteuern/);

      const sections = await zh.callTool({ name: 'get_form_values', arguments: {} });
      assert.deepEqual(
        sections.structuredContent.sections.map((s) => s.page),
        ['S2', 'BA1', 'S3'],
      );
      const income = await zh.callTool({ name: 'get_form_values', arguments: { section: 'S2' } });
      assert.match(income.content[0].text, /- 100 Haupterwerb, Person 1 /);

      const pdf = await zh.callTool({ name: 'reconcile_official_pdf', arguments: {} });
      assert.match(pdf.content[0].text, /reads Geneva declarations only/);
    } finally {
      await zh.close();
    }
  });

  test('a Bern return: its questions, its tax and the values to type, offline', async () => {
    // A third household in its own folder, in its own server process with the same guard: Mia
    // Muster, single with her own household, in Bern, with the synthetic salary certificate read
    // from its barcode.
    const beVault = path.join(work, 'Bern');
    const beTransport = new StdioClientTransport({
      command: process.execPath,
      args: ['--import', guard, path.join(extDir, 'server', 'index.mjs')],
      env: {
        ...process.env,
        TAXPRESSO_VAULT_PATH: beVault,
        TAXPRESSO_UI_LANGUAGE: 'fr',
        TAXPRESSO_NET_GUARD_LOG: guardLog,
      },
      stderr: 'pipe',
    });
    beTransport.stderr?.on('data', (d) => (stderr += d));
    const be = new Client({ name: 'taxpresso-offline-test-be', version: '0.0.0' });
    await be.connect(beTransport);
    try {
      const answers = [
        ['canton', 'BE'],
        ['civil_status', 'single'],
        ['own_household', true],
        ['children', 0],
        ['commune', 'Bern'],
        ['moved', 'no'],
        ['church:p1', 'none'],
        ['income_sources:p1', ['salary']],
        ['employers:p1', 1],
        ['taxed_at_source:p1', false],
        ['pillar3a:p1', false],
        ['lpp_buyin:p1', false],
        ['commute:p1', 'public_transport'],
        ['commute_transit_cost:p1', 880],
        ['meal_days:p1', 0],
        ['banks', 0],
        ['crypto', false],
        ['payments', []],
        ['special', []],
      ];
      for (const [id, value] of answers) {
        const res = await be.callTool({ name: 'answer_question', arguments: { id, value } });
        assert.ok(!res.isError, `${id}: ${res.content?.[0]?.text}`);
      }
      const status = await be.callTool({ name: 'get_status', arguments: {} });
      assert.equal(status.structuredContent.canton, 'BE');
      const name = 'dupont-certificat-salaire-2026-code-barres.pdf';
      writeFileSync(
        path.join(beVault, '2026', name),
        readFileSync(path.join(root, 'test', 'fixtures', 'barcodes', name)),
      );
      const ingest = await be.callTool({ name: 'ingest_vault', arguments: {} });
      assert.ok(!ingest.isError, ingest.content?.[0]?.text);

      const tax = await be.callTool({ name: 'compute_tax', arguments: {} });
      assert.ok(!tax.isError, tax.content?.[0]?.text);
      assert.equal(tax.structuredContent.canton, 'BE');
      assert.equal(tax.structuredContent.computed, true, tax.content[0].text);
      assert.equal(tax.structuredContent.commune.bfs, 351);
      assert.equal(tax.structuredContent.commune.name, 'Bern');
      assert.ok(tax.structuredContent.icc.total > 0);
      assert.ok(tax.structuredContent.ifd.tax > 0);
      assert.equal(
        tax.structuredContent.total,
        tax.structuredContent.icc.total + tax.structuredContent.ifd.tax,
      );
      assert.match(tax.content[0].text, /Kantons-, Gemeinde- und Kirchensteuern/);

      const sections = await be.callTool({ name: 'get_form_values', arguments: {} });
      assert.ok(sections.structuredContent.sections.length > 0);
      const first = sections.structuredContent.sections[0].page;
      const values = await be.callTool({ name: 'get_form_values', arguments: { section: first } });
      assert.ok(!values.isError, values.content?.[0]?.text);

      const check = await be.callTool({ name: 'final_check', arguments: {} });
      assert.ok(!check.isError, check.content?.[0]?.text);
      const pdf = await be.callTool({ name: 'reconcile_official_pdf', arguments: {} });
      assert.match(pdf.content[0].text, /reads Geneva declarations only/);
    } finally {
      await be.close();
    }
  });

  test('a Basel-Landschaft return: its questions, its tax and the values to type, offline', async () => {
    // A fourth household in its own folder, in its own server process with the same guard: Mia
    // Meier, single, in Liestal, with the synthetic salary certificate read from its barcode.
    const blVault = path.join(work, 'Basel-Landschaft');
    const blTransport = new StdioClientTransport({
      command: process.execPath,
      args: ['--import', guard, path.join(extDir, 'server', 'index.mjs')],
      env: {
        ...process.env,
        TAXPRESSO_VAULT_PATH: blVault,
        TAXPRESSO_UI_LANGUAGE: 'de',
        TAXPRESSO_NET_GUARD_LOG: guardLog,
      },
      stderr: 'pipe',
    });
    blTransport.stderr?.on('data', (d) => (stderr += d));
    const bl = new Client({ name: 'taxpresso-offline-test-bl', version: '0.0.0' });
    await bl.connect(blTransport);
    try {
      const answers = [
        ['canton', 'BL'],
        ['civil_status', 'single'],
        ['children', 0],
        ['commune', 'Liestal'],
        ['moved', 'no'],
        ['church:p1', 'none'],
        ['income_sources:p1', ['salary']],
        ['employers:p1', 1],
        ['taxed_at_source:p1', false],
        ['pillar3a:p1', false],
        ['lpp_buyin:p1', false],
        ['commute:p1', 'public_transport'],
        ['commute_transit_cost:p1', 1032],
        ['meal_days:p1', 0],
        ['banks', 0],
        ['crypto', false],
        ['payments', []],
        ['special', []],
      ];
      for (const [id, value] of answers) {
        const res = await bl.callTool({ name: 'answer_question', arguments: { id, value } });
        assert.ok(!res.isError, `${id}: ${res.content?.[0]?.text}`);
      }
      const status = await bl.callTool({ name: 'get_status', arguments: {} });
      assert.equal(status.structuredContent.canton, 'BL');
      const name = 'dupont-certificat-salaire-2026-code-barres.pdf';
      writeFileSync(
        path.join(blVault, '2026', name),
        readFileSync(path.join(root, 'test', 'fixtures', 'barcodes', name)),
      );
      const ingest = await bl.callTool({ name: 'ingest_vault', arguments: {} });
      assert.ok(!ingest.isError, ingest.content?.[0]?.text);

      const tax = await bl.callTool({ name: 'compute_tax', arguments: {} });
      assert.ok(!tax.isError, tax.content?.[0]?.text);
      assert.equal(tax.structuredContent.canton, 'BL');
      assert.equal(tax.structuredContent.computed, true, tax.content[0].text);
      assert.equal(tax.structuredContent.commune.bfs, null);
      assert.equal(tax.structuredContent.commune.name, 'Liestal');
      assert.ok(tax.structuredContent.icc.total > 0);
      assert.ok(tax.structuredContent.ifd.tax > 0);
      assert.equal(
        tax.structuredContent.total,
        tax.structuredContent.icc.total + tax.structuredContent.ifd.tax,
      );
      assert.match(tax.content[0].text, /Staats-, Gemeinde- und Kirchensteuer/);

      const sections = await bl.callTool({ name: 'get_form_values', arguments: {} });
      assert.deepEqual(
        sections.structuredContent.sections.map((s) => s.page),
        ['S2', 'S3'],
      );
      const deductions = await bl.callTool({
        name: 'get_form_values',
        arguments: { section: 'S3' },
      });
      assert.match(
        deductions.content[0].text,
        /- 500 Fahrtkosten zwischen Wohn- und Arbeitsstätte, Person 1 /,
      );

      const check = await bl.callTool({ name: 'final_check', arguments: {} });
      assert.ok(!check.isError, check.content?.[0]?.text);
      const pdf = await bl.callTool({ name: 'reconcile_official_pdf', arguments: {} });
      assert.match(pdf.content[0].text, /reads Geneva declarations only/);
    } finally {
      await bl.close();
    }
  });

  test('no outbound network attempt was made (C2)', () => {
    const attempts = existsSync(guardLog) ? readFileSync(guardLog, 'utf8').trim() : '';
    assert.equal(attempts, '', `outbound attempts:\n${attempts}`);
  });
});
