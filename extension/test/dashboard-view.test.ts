// The dashboard inside the conversation: its ui:// view and dashboard_api, the tool the view calls.
// Same API, same checks and same results as the browser page over HTTP.
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApi, type DashboardState } from '../src/api.js';
import { Dashboard } from '../src/dashboard.js';
import { DASHBOARD_VIEW_URI, VIEW_KEY_META } from '../src/dashboard-view.js';
import { createTaxpressoServer } from '../src/server.js';
import type { Workspace } from '../src/workspace.js';
import { makeUiDir, makeWorkspace, request } from './helpers.js';

let client: Client;
let dashboard: Dashboard;
let ws: Workspace;
/** The key the extension writes into the view's HTML, read as the view reads it. */
let key: string;

interface Reply {
  status: number;
  body?: unknown;
  etag?: string;
}
interface ToolResult {
  isError?: boolean;
  content: { type: string; text: string }[];
  structuredContent?: Reply;
}

beforeEach(async () => {
  const uiDir = await makeUiDir();
  ws = await makeWorkspace(uiDir);
  dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(ws) });
  const server = createTaxpressoServer({ workspace: ws, dashboard });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
  key = await keyOfView();
});

async function keyOfView(): Promise<string> {
  const { contents } = await client.readResource({ uri: DASHBOARD_VIEW_URI });
  const html = (contents[0] as { text: string }).text;
  return new RegExp(`<meta name="${VIEW_KEY_META}" content="([^"]+)">`).exec(html)?.[1] ?? '';
}

afterEach(async () => {
  await client.close();
  await dashboard.stop();
});

const view = async (args: Record<string, unknown>) =>
  (await client.callTool({ name: 'dashboard_api', arguments: { key, ...args } })) as ToolResult;
/** As the page would see it: through JSON, like the HTTP body. */
const plain = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

async function viewState(): Promise<DashboardState> {
  const res = await view({ method: 'GET', path: '/state' });
  expect(res.isError).toBeFalsy();
  return res.structuredContent!.body as DashboardState;
}

async function httpState(): Promise<unknown> {
  const url = new URL(await dashboard.start());
  const res = await request(`${url.origin}/api/state?t=${url.searchParams.get('t')}`);
  expect(res.status).toBe(200);
  return JSON.parse(res.body) as unknown;
}

describe('the dashboard in the conversation', () => {
  it('is the view of open_dashboard, needs nothing from outside, and may copy', async () => {
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === 'open_dashboard')?._meta).toMatchObject({
      ui: { resourceUri: DASHBOARD_VIEW_URI },
    });
    const { resources } = await client.listResources();
    expect(resources.find((r) => r.uri === DASHBOARD_VIEW_URI)).toBeDefined();
    const { contents } = await client.readResource({ uri: DASHBOARD_VIEW_URI });
    expect(contents[0]).toMatchObject({
      uri: DASHBOARD_VIEW_URI,
      mimeType: 'text/html;profile=mcp-app',
      _meta: {
        ui: {
          csp: { connectDomains: [], resourceDomains: [], frameDomains: [] },
          permissions: { clipboardWrite: {} },
        },
      },
    });
  });

  it('talks through dashboard_api: for the view only, narrow and annotated (C6)', async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'dashboard_api')!;
    expect(tool._meta).toEqual({ ui: { visibility: ['app'] } });
    expect(tool.description!.length).toBeLessThanOrEqual(300);
    expect(tool.description).toMatch(/Never call it yourself/);
    expect(tool.annotations).toMatchObject({
      title: 'Dashboard channel',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    });
  });

  it('serves the same state as the browser page, without the HTTP server running', async () => {
    const fromView = await viewState();
    expect(dashboard.running).toBe(false);
    expect(fromView).toMatchObject({ taxYear: 2026, lang: 'en', progress: { answered: 0 } });
    expect(plain(fromView)).toEqual(await httpState());
    // In French, as the page asks.
    const fr = await view({ method: 'GET', path: '/state', query: { lang: 'fr' } });
    expect(fr.structuredContent?.body).toMatchObject({ lang: 'fr' });
  });

  it('sends the state again only when it changed', async () => {
    const first = await view({ method: 'GET', path: '/state' });
    const etag = first.structuredContent!.etag!;
    expect(etag).toMatch(/^[\w-]{32}$/);
    const same = await view({ method: 'GET', path: '/state', etag });
    expect(same.structuredContent).toEqual({ status: 304, etag });
    expect(same.content[0]!.text).toBe('Unchanged.');
    const { csrf } = first.structuredContent!.body as DashboardState;
    await view({
      method: 'POST',
      path: '/answer',
      body: { id: 'civil_status', value: 'single' },
      csrf,
    });
    const after = await view({ method: 'GET', path: '/state', etag });
    expect(after.structuredContent?.status).toBe(200);
    expect(after.structuredContent?.etag).not.toBe(etag);
  });

  it('saves a change with the CSRF token, as the browser page does, and records it as yours', async () => {
    const { csrf } = await viewState();
    const body = { id: 'civil_status', value: 'married' };
    for (const token of [undefined, 'nope']) {
      const refused = await view({ method: 'POST', path: '/answer', body, csrf: token });
      expect(refused.isError).toBe(true);
      expect(refused.structuredContent).toMatchObject({ status: 403 });
      expect(refused.content[0]!.text).toBe('Reload the dashboard and try again.');
    }
    expect(ws.ledger.get('profile.civil_status')).toBeUndefined();

    const saved = await view({ method: 'POST', path: '/answer', body, csrf });
    expect(saved.isError).toBeFalsy();
    const state = saved.structuredContent!.body as DashboardState;
    expect(state.chips).toEqual(['Married']);
    expect(ws.ledger.get('profile.civil_status')?.source.via).toBe('dashboard');
    expect(state.activity[0]).toMatchObject({ by: 'you', what: 'answer' });
    // The browser page sees exactly the same.
    expect(plain(await viewState())).toEqual(await httpState());
  });

  it('validates bodies like the browser page, and refuses unknown routes', async () => {
    const { csrf } = await viewState();
    const bad = await view({ method: 'POST', path: '/answer', body: { id: 7 }, csrf });
    expect(bad).toMatchObject({ isError: true, structuredContent: { status: 400 } });
    expect(bad.content[0]!.text).toBe('The request is not valid.');
    for (const method of ['GET', 'POST']) {
      const unknown = await view({ method, path: '/nope', csrf });
      expect(unknown).toMatchObject({ isError: true, structuredContent: { status: 404 } });
    }
    const big = await view({
      method: 'POST',
      path: '/answer',
      body: { x: 'a'.repeat(70_000) },
      csrf,
    });
    expect(big).toMatchObject({ isError: true, structuredContent: { status: 413 } });
    // Not a route at all: refused before it reaches the API.
    for (const path of ['/../manifest.json', 'state', '/state?x=1']) {
      expect((await view({ method: 'GET', path })).isError, path).toBe(true);
    }
    expect((await view({ method: 'GET', path: '/state', query: { t: 'x' } })).isError).toBe(true);
  });

  it('answers only the view: a call without its key, or with another, is refused (C7)', async () => {
    expect(key).toMatch(/^[\w-]{32}$/);
    const { csrf } = await viewState();
    const change = {
      method: 'POST',
      path: '/answer',
      body: { id: 'civil_status', value: 'single' },
      csrf,
    };
    for (const other of ['', 'not-the-key', key.slice(1)]) {
      const res = await view({ ...change, key: other });
      expect(res).toMatchObject({ isError: true, structuredContent: { status: 403 } });
      expect(res.content[0]!.text).toMatch(/Only the dashboard shown in the conversation/);
    }
    expect(ws.ledger.get('profile.civil_status')).toBeUndefined();
    // Without a key at all, the schema refuses the call.
    const bare = (await client.callTool({
      name: 'dashboard_api',
      arguments: { method: 'GET', path: '/state' },
    })) as ToolResult;
    expect(bare.isError).toBe(true);
  });

  it('never takes a document: they go to the folder or the browser page', async () => {
    const { csrf } = await viewState();
    const res = await view({ method: 'POST', path: '/documents', body: { x: 1 }, csrf });
    expect(res).toMatchObject({ isError: true, structuredContent: { status: 400 } });
    expect(res.content[0]!.text).toMatch(/out of the chat app.*browser.*Taxpresso folder/);
    const withBytes = await view({
      method: 'POST',
      path: '/documents',
      csrf,
      file: { name: 'x.pdf', upload: 'upload-0001', part: 0, parts: 1, size: 4, data: 'JVBERg==' },
    });
    expect(withBytes.isError).toBe(true);
    expect(ws.activeDocuments()).toHaveLength(0);
  });
});
