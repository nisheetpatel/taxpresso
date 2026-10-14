// The dashboard inside the conversation (SPEC.md section 3): an MCP Apps view with the whole
// dashboard, shown with open_dashboard, and dashboard_api, the tool that view uses to reach the
// same API as the browser page (./api.ts) through the same checks (Dashboard.callApi). Only the
// view calls the tool: hosts that follow MCP Apps hide it from the model (`_meta.ui.visibility`).
// Nothing here opens a connection (C2): the view's requests come in over the MCP channel.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { UI_LANGUAGES } from './config.js';
import type { ApiResponse, Dashboard } from './dashboard.js';
import type { Workspace } from './workspace.js';
import { TaxYears } from './years.js';

/** MCP Apps (SEP-1865): the dashboard view shown with open_dashboard where the host supports it. */
export const DASHBOARD_VIEW_URI = 'ui://taxpresso/dashboard.html';
export const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app';
export const DASHBOARD_API_TOOL = 'dashboard_api';

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

/** Written into the view's HTML: the key every dashboard_api call must carry (see below). */
export const VIEW_KEY_META = 'taxpresso-view-key';

const NOT_THE_VIEW =
  'Only the dashboard shown in the conversation uses this. Ask Claude to open the dashboard again.';
const NO_DOCUMENTS =
  'To keep your documents out of the chat app, add them in the dashboard in your browser, or put them in your Taxpresso folder.';

const Query = z
  .object({
    lang: z.enum(UI_LANGUAGES).optional(),
    id: z.string().max(240).optional(),
    kind: z.string().max(80).optional(),
    person: z.string().max(20).optional(),
    replace: z.string().max(80).optional(),
    /** The tax year the view shows: a change for another year than the open one is refused. */
    year: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
  })
  .strict();

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
  /** The key from the view's HTML: the model never reads the view, so it can't call this. */
  key: z.string().max(64),
});
type Input = z.infer<typeof Input>;

/** The view's HTML with its key in a meta tag, right after <head>. */
export function withKey(html: string, key: string): string {
  const tag = `<meta name="${VIEW_KEY_META}" content="${key}">`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (h) => h + tag) : tag + html;
}

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
  given: Workspace | TaxYears,
  dashboard: Dashboard,
): void {
  const { config } = TaxYears.of(given);
  // A new key each time the extension starts. It is only in the view's HTML, which the host
  // renders and the model never reads: a call without it (the model's own, if a host ignored
  // `visibility`) is refused, so nothing is ever confirmed "from the dashboard" by Claude (C7).
  const viewKey = randomBytes(24).toString('base64url');
  const keyOk = (key: string) => {
    const a = Buffer.from(key);
    const b = Buffer.from(viewKey);
    return a.length === b.length && timingSafeEqual(a, b);
  };

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
          text: withKey(
            await readFile(path.join(config.uiDir, 'views', 'dashboard.html'), 'utf8'),
            viewKey,
          ),
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
        if (!keyOk(input.key)) return reply({ status: 403, body: { error: NOT_THE_VIEW } });
        // Documents never come through the chat app: the folder and the browser page take them.
        if (input.path === '/documents')
          return reply({ status: 400, body: { error: NO_DOCUMENTS } });
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
