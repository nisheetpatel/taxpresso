// The dashboard's two ways to reach the extension: HTTP in the browser, the host's tool calls in the
// conversation. The same calls of `api` must make the same requests through either.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, setTransport } from './api';
import type { ApiRequest } from './transport';
import { httpTransport } from './transport-http';
import { DASHBOARD_TOOL, mcpTransport, viewKey, type ToolCaller } from './transport-mcp';
import type { State } from './types';

const STATE = { csrf: 'token-1', lang: 'fr' } as unknown as State;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api', () => {
  it('sends every request through the transport chosen at start, with the CSRF token on changes', async () => {
    const seen: ApiRequest[] = [];
    setTransport({
      send: (req) => {
        seen.push(req);
        return Promise.resolve(STATE);
      },
    });
    await api.state('fr');
    await api.answer('civil_status', 'single', 'fr');
    await api.question('children', 'en');
    const file = new File(['%PDF'], 'certificat.pdf');
    await api.upload(file, 'fr', { kind: 'salary_certificate', person: 'p2' }, 'doc-1');
    expect(seen).toEqual([
      { method: 'GET', path: '/state', query: { lang: 'fr' } },
      {
        method: 'POST',
        path: '/answer',
        query: { lang: 'fr' },
        body: { id: 'civil_status', value: 'single' },
        csrf: 'token-1',
      },
      { method: 'GET', path: '/question', query: { id: 'children', lang: 'en' } },
      {
        method: 'POST',
        path: '/documents',
        query: { lang: 'fr', kind: 'salary_certificate', person: 'p2', replace: 'doc-1' },
        file,
        csrf: 'token-1',
      },
    ]);
  });
});

describe('HTTP transport (browser page)', () => {
  it('calls /api on the same origin, as before', async () => {
    const fetch = vi.fn((url: string, init: RequestInit) => {
      void url;
      void init;
      return Promise.resolve(new Response(JSON.stringify(STATE), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetch);
    const http = httpTransport();
    await http.send({ method: 'GET', path: '/state', query: {} });
    await http.send({
      method: 'POST',
      path: '/answer',
      query: { lang: 'fr' },
      body: { id: 'civil_status', value: 'single' },
      csrf: 'token-1',
    });
    const file = new File(['%PDF'], 'mon certificat.pdf');
    await http.send({ method: 'POST', path: '/documents', query: { lang: 'en' }, file, csrf: 'c' });

    expect(fetch.mock.calls[0]![0]).toBe('/api/state');
    expect(fetch.mock.calls[0]![1]).toMatchObject({ method: 'GET', credentials: 'same-origin' });
    expect(fetch.mock.calls[1]![0]).toBe('/api/answer?lang=fr');
    expect(fetch.mock.calls[1]![1]).toMatchObject({
      method: 'POST',
      headers: { 'X-Taxpresso-CSRF': 'token-1', 'Content-Type': 'application/json' },
      body: '{"id":"civil_status","value":"single"}',
    });
    expect(fetch.mock.calls[2]![0]).toBe('/api/documents?lang=en');
    expect(fetch.mock.calls[2]![1]).toMatchObject({
      headers: { 'X-Filename': 'mon%20certificat.pdf', 'X-Taxpresso-CSRF': 'c' },
      body: file,
    });
  });

  it('turns a refusal into an ApiError with its message', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response(JSON.stringify({ error: 'Not found.' }), { status: 404 })),
    );
    await expect(httpTransport().send({ method: 'GET', path: '/x', query: {} })).rejects.toThrow(
      new ApiError('Not found.'),
    );
  });
});

/** A host that answers dashboard_api like the extension does. */
function fakeHost(
  answer: (args: Record<string, unknown>) => {
    isError?: boolean;
    content?: unknown[];
    structuredContent?: unknown;
  },
) {
  const calls: Record<string, unknown>[] = [];
  const host: ToolCaller = {
    callServerTool: ({ name, arguments: args = {} }) => {
      expect(name).toBe(DASHBOARD_TOOL);
      calls.push(args);
      return Promise.resolve(answer(args));
    },
  };
  return { host, calls };
}

const KEY = 'view-key-for-tests';

describe('MCP Apps transport (the dashboard in the conversation)', () => {
  it('calls dashboard_api with the same request, and returns the body', async () => {
    const { host, calls } = fakeHost(() => ({
      content: [{ type: 'text', text: 'Sent to the dashboard view.' }],
      structuredContent: { status: 200, body: STATE },
    }));
    const mcp = mcpTransport(host, KEY);
    const out = await mcp.send({
      method: 'POST',
      path: '/answer',
      query: { lang: 'fr' },
      body: { id: 'civil_status', value: 'single' },
      csrf: 'token-1',
    });
    expect(out).toBe(STATE);
    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/answer',
        query: { lang: 'fr' },
        body: { id: 'civil_status', value: 'single' },
        csrf: 'token-1',
        key: KEY,
      },
    ]);
  });

  it('asks for the state with its tag, and keeps the one it has when nothing changed', async () => {
    let n = 0;
    const { host, calls } = fakeHost(() =>
      n++ === 0
        ? { structuredContent: { status: 200, etag: 'tag-1', body: STATE } }
        : { structuredContent: { status: 304, etag: 'tag-1' } },
    );
    const mcp = mcpTransport(host, KEY);
    const first = await mcp.send({ method: 'GET', path: '/state', query: { lang: 'fr' } });
    const again = await mcp.send({ method: 'GET', path: '/state', query: { lang: 'fr' } });
    expect(again).toBe(first);
    expect(calls[1]).toMatchObject({ etag: 'tag-1' });
    // Another language is another state.
    await mcp.send({ method: 'GET', path: '/state', query: { lang: 'en' } }).catch(() => undefined);
    expect(calls[2]).not.toHaveProperty('etag');
  });

  it('turns a refusal into an ApiError with the extension’s message', async () => {
    const { host } = fakeHost(() => ({
      isError: true,
      content: [{ type: 'text', text: 'Reload the dashboard and try again.' }],
      structuredContent: { status: 403, body: { error: 'Reload the dashboard and try again.' } },
    }));
    await expect(
      mcpTransport(host, KEY).send({ method: 'POST', path: '/skip', query: {}, body: {} }),
    ).rejects.toThrow(new ApiError('Reload the dashboard and try again.'));
  });

  it('never sends a document through the chat: it says where to add it', async () => {
    const { host, calls } = fakeHost(() => ({ structuredContent: { status: 200 } }));
    const file = new File(['%PDF'], 'dupont.pdf');
    await expect(
      mcpTransport(host, KEY).send({
        method: 'POST',
        path: '/documents',
        query: { lang: 'en' },
        file,
      }),
    ).rejects.toThrow(/out of the chat app.*“dupont\.pdf”.*browser.*Taxpresso folder/);
    await expect(
      mcpTransport(host, KEY).send({
        method: 'POST',
        path: '/documents',
        query: { lang: 'fr' },
        file,
      }),
    ).rejects.toThrow(/navigateur.*dossier Taxpresso/);
    expect(calls).toHaveLength(0);
  });

  it('is marked as the dashboard inside the conversation', () => {
    expect(mcpTransport(fakeHost(() => ({})).host, KEY).embedded).toBe(true);
  });

  it('reads its key from the meta tag the extension writes into the view', () => {
    const doc = {
      querySelector: (sel: string) =>
        sel === 'meta[name="taxpresso-view-key"]'
          ? ({ content: 'k-123' } as HTMLMetaElement)
          : null,
    } as Pick<Document, 'querySelector'>;
    expect(viewKey(doc)).toBe('k-123');
    expect(viewKey({ querySelector: () => null })).toBe('');
  });
});
