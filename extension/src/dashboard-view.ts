// The dashboard inside the conversation (SPEC.md section 3): an MCP Apps view with the whole
// dashboard, shown with open_dashboard, and dashboard_api, the tool that view uses to reach the
// same API as the browser page (./api.ts) through the same checks (Dashboard.callApi). Only the
// view calls the tool: hosts that follow MCP Apps hide it from the model (`_meta.ui.visibility`).
// Nothing here opens a connection (C2): the view's requests come in over the MCP channel.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { ApiResponse, Dashboard } from './dashboard.js';
import type { Workspace } from './workspace.js';

/** MCP Apps (SEP-1865): the dashboard view shown with open_dashboard where the host supports it. */
export const DASHBOARD_VIEW_URI = 'ui://taxpresso/dashboard.html';
export const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app';
export const DASHBOARD_API_TOOL = 'dashboard_api';

/** Largest document the view sends: 10 MB, in parts of at most 1 MB (a tool call each). */
export const VIEW_MAX_FILE = 10 * 1024 * 1024;
const PART_BYTES = 1024 * 1024;
const PART_BASE64 = Math.ceil(PART_BYTES / 3) * 4;
/** Uploads in progress at once, and how long an unfinished one is kept. */
const OPEN_UPLOADS = 3;
const UPLOAD_IDLE_MS = 2 * 60 * 1000;

/**
 * The view needs nothing from outside: no connection, no remote script, style, font or frame
 * (empty lists are the hosts' most restrictive default). It asks to write to the clipboard for
 * the "Copy" buttons of the values to type into the declaration.
 */
const VIEW_META = {
  csp: { connectDomains: [], resourceDomains: [], frameDomains: [] },
  permissions: { clipboardWrite: {} },
  prefersBorder: true,
};

const TOO_LARGE =
  'This file is larger than 10 MB, too large to add from the chat. Add it in the dashboard in your browser, or put it in your Taxpresso folder.';
const INTERRUPTED = 'Adding the file was interrupted. Try again.';

const Query = z
  .object({
    lang: z.enum(['en', 'fr']).optional(),
    id: z.string().max(240).optional(),
    kind: z.string().max(80).optional(),
    person: z.string().max(20).optional(),
    replace: z.string().max(80).optional(),
  })
  .strict();

const FilePart = z.object({
  name: z.string().min(1).max(255),
  upload: z.string().regex(/^[\w-]{8,64}$/),
  part: z.number().int().min(0),
  parts: z
    .number()
    .int()
    .min(1)
    .max(Math.ceil(VIEW_MAX_FILE / PART_BYTES)),
  size: z.number().int().min(0),
  data: z
    .string()
    .max(PART_BASE64)
    .regex(/^[A-Za-z0-9+/]*={0,2}$/),
});

const Input = z.object({
  method: z.enum(['GET', 'POST']),
  path: z
    .string()
    .max(40)
    .regex(/^(\/[a-z]+){1,2}$/),
  query: Query.optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  csrf: z.string().max(100).optional(),
  /** The tag of the last state the view has: unchanged state comes back as 304, without a body. */
  etag: z.string().max(64).optional(),
  file: FilePart.optional(),
});
type Input = z.infer<typeof Input>;

interface Pending {
  name: string;
  size: number;
  parts: number;
  chunks: Buffer[];
  bytes: number;
  at: number;
}

/** Documents sent from the view in parts, put back together, then added like an HTTP upload. */
class Uploads {
  readonly #open = new Map<string, Pending>();
  readonly #dashboard: Dashboard;

  constructor(dashboard: Dashboard) {
    this.#dashboard = dashboard;
  }

  async receive(input: Input, query: URLSearchParams): Promise<ApiResponse> {
    const file = input.file!;
    // Every part meets the CSRF rule of a change before anything is kept.
    const refused = this.#dashboard.refuse('POST', '/documents', input.csrf, 0);
    if (refused) {
      this.#open.delete(file.upload);
      return refused;
    }
    if (input.method !== 'POST' || input.path !== '/documents') return invalid();
    if (file.size > VIEW_MAX_FILE) {
      this.#open.delete(file.upload);
      return { status: 413, body: { error: TOO_LARGE } };
    }
    const now = Date.now();
    for (const [id, p] of this.#open) if (now - p.at > UPLOAD_IDLE_MS) this.#open.delete(id);
    if (file.part === 0) {
      this.#open.delete(file.upload);
      const { name, size, parts } = file;
      this.#open.set(file.upload, { name, size, parts, chunks: [], bytes: 0, at: now });
      // Oldest first: keep only the most recent few.
      for (const id of [...this.#open.keys()].slice(0, -OPEN_UPLOADS)) this.#open.delete(id);
    }
    const pending = this.#open.get(file.upload);
    if (
      !pending ||
      file.part !== pending.chunks.length ||
      file.parts !== pending.parts ||
      file.size !== pending.size ||
      file.name !== pending.name
    ) {
      this.#open.delete(file.upload);
      return { status: 400, body: { error: INTERRUPTED } };
    }
    const chunk = Buffer.from(file.data, 'base64');
    pending.chunks.push(chunk);
    pending.bytes += chunk.length;
    pending.at = now;
    const last = file.part === file.parts - 1;
    if (pending.bytes > pending.size || (last && pending.bytes !== pending.size)) {
      this.#open.delete(file.upload);
      return { status: 400, body: { error: INTERRUPTED } };
    }
    if (!last) return { status: 202, body: { received: pending.bytes } };
    this.#open.delete(file.upload);
    return this.#dashboard.callApi({
      method: 'POST',
      path: '/documents',
      query,
      headers: { 'x-filename': encodeURIComponent(pending.name) },
      body: Buffer.concat(pending.chunks),
      csrfToken: input.csrf,
    });
  }
}

const invalid = (): ApiResponse => ({ status: 400, body: { error: 'The request is not valid.' } });

const tagOf = (body: unknown) =>
  createHash('sha256').update(JSON.stringify(body)).digest('base64url').slice(0, 32);

/** The API's answer as a tool result: for the view only, so the text says nothing about the user. */
function reply(res: ApiResponse, etag?: string) {
  if (res.status >= 400) {
    const error = (res.body as { error?: unknown } | undefined)?.error;
    return {
      content: [{ type: 'text' as const, text: typeof error === 'string' ? error : 'Refused.' }],
      structuredContent: { status: res.status, body: res.body },
      isError: true,
    };
  }
  if (etag !== undefined && res.status === 200) {
    const tag = tagOf(res.body);
    if (tag === etag) {
      return {
        content: [{ type: 'text' as const, text: 'Unchanged.' }],
        structuredContent: { status: 304, etag: tag },
      };
    }
    return {
      content: [{ type: 'text' as const, text: 'Sent to the dashboard view.' }],
      structuredContent: { status: res.status, etag: tag, body: res.body },
    };
  }
  return {
    content: [{ type: 'text' as const, text: 'Sent to the dashboard view.' }],
    structuredContent: { status: res.status, body: res.body },
  };
}

export function registerDashboardView(
  server: McpServer,
  ws: Workspace,
  dashboard: Dashboard,
): void {
  const uploads = new Uploads(dashboard);

  server.registerResource(
    'dashboard-view',
    DASHBOARD_VIEW_URI,
    {
      title: 'Taxpresso dashboard',
      description: 'The Taxpresso dashboard, shown in the conversation.',
      mimeType: MCP_APP_MIME_TYPE,
      _meta: { ui: VIEW_META },
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: MCP_APP_MIME_TYPE,
          text: await readFile(path.join(ws.config.uiDir, 'views', 'dashboard.html'), 'utf8'),
          _meta: { ui: VIEW_META },
        },
      ],
    }),
  );

  server.registerTool(
    DASHBOARD_API_TOOL,
    {
      title: 'Dashboard channel',
      description:
        "Channel of the Taxpresso dashboard shown in the chat: reads its state and saves what the user clicks there, with the browser dashboard's checks. Only the dashboard view calls it. Never call it yourself.",
      inputSchema: Input,
      annotations: {
        title: 'Dashboard channel',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { ui: { visibility: ['app'] } },
    },
    async (input) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(input.query ?? {})) {
        if (value !== undefined) query.set(key, value);
      }
      try {
        if (input.file) return reply(await uploads.receive(input, query));
        // A document only ever comes as file parts, never as a JSON body.
        if (input.path === '/documents') return reply(invalid());
        const body =
          input.method === 'POST' ? Buffer.from(JSON.stringify(input.body ?? {})) : Buffer.alloc(0);
        const res = await dashboard.callApi({
          method: input.method,
          path: input.path,
          query,
          headers: {},
          body,
          csrfToken: input.csrf,
        });
        return reply(res, input.method === 'GET' ? (input.etag ?? '') : undefined);
      } catch {
        // As over HTTP: a bug is not explained to the page.
        return reply({ status: 500, body: { error: 'Something went wrong.' } });
      }
    },
  );
}
