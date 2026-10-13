// The dashboard's two ways to reach the extension: HTTP in the browser, the host's tool calls in the
// conversation. The same calls of `api` must make the same requests through either.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, setTransport } from './api';
import type { ApiRequest } from './transport';
import { httpTransport } from './transport-http';
import { DASHBOARD_TOOL, MAX_FILE_BYTES, mcpTransport, type ToolCaller } from './transport-mcp';
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

describe('MCP Apps transport (the dashboard in the conversation)', () => {
  it('calls dashboard_api with the same request, and returns the body', async () => {
    const { host, calls } = fakeHost(() => ({
      content: [{ type: 'text', text: 'Sent to the dashboard view.' }],
      structuredContent: { status: 200, body: STATE },
    }));
    const mcp = mcpTransport(host);
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
    const mcp = mcpTransport(host);
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
      mcpTransport(host).send({ method: 'POST', path: '/skip', query: {}, body: {} }),
    ).rejects.toThrow(new ApiError('Reload the dashboard and try again.'));
  });

  it('sends a document in parts of at most 1 MB, as base64', async () => {
    const { host, calls } = fakeHost((args) => {
      const file = args.file as { part: number; parts: number };
      return {
        structuredContent:
          file.part < file.parts - 1
            ? { status: 202, body: { received: 1 } }
            : { status: 200, body: STATE },
      };
    });
    const size = 2 * 1024 * 1024 + 10;
    const bytes = new Uint8Array(size).map((_, i) => i % 251);
    const file = new File([bytes], 'dupont.pdf');
    const out = await mcpTransport(host).send({
      method: 'POST',
      path: '/documents',
      query: { lang: 'fr', kind: 'salary_certificate' },
      file,
      csrf: 'token-1',
    });
    expect(out).toBe(STATE);
    expect(calls).toHaveLength(3);
    const parts = calls.map(
      (c) => c.file as { name: string; upload: string; part: number; parts: number; data: string },
    );
    expect(parts.map((p) => [p.part, p.parts])).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
    ]);
    expect(new Set(parts.map((p) => p.upload)).size).toBe(1);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/documents',
      query: { lang: 'fr', kind: 'salary_certificate' },
      csrf: 'token-1',
      file: { name: 'dupont.pdf', size },
    });
    const decoded = parts.map((p) => Uint8Array.from(atob(p.data), (c) => c.charCodeAt(0)));
    expect(decoded.map((d) => d.length)).toEqual([1024 * 1024, 1024 * 1024, 10]);
    expect(decoded.flatMap((d) => Array.from(d))).toEqual(Array.from(bytes));
  });

  it('says where to add a file over 10 MB instead of sending it', async () => {
    const { host, calls } = fakeHost(() => ({ structuredContent: { status: 200 } }));
    const file = new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'scan.pdf');
    await expect(
      mcpTransport(host).send({ method: 'POST', path: '/documents', query: { lang: 'en' }, file }),
    ).rejects.toThrow(/“scan\.pdf” is larger than 10 MB.*browser.*Taxpresso folder/);
    expect(calls).toHaveLength(0);
  });

  it('says the same when the host fails to carry a document', async () => {
    const host: ToolCaller = { callServerTool: () => Promise.reject(new Error('too big')) };
    const file = new File(['%PDF'], 'x.pdf');
    await expect(
      mcpTransport(host).send({ method: 'POST', path: '/documents', query: { lang: 'fr' }, file }),
    ).rejects.toThrow(/n’a pas pu être ajouté depuis le chat.*navigateur.*dossier Taxpresso/);
  });
});
