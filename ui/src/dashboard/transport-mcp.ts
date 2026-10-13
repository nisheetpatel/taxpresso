// The dashboard inside the conversation (MCP Apps view): every request is a call to the
// dashboard_api tool, which the host passes to the extension. The extension runs it through the
// same checks and the same handler as the browser page. No network here: the view's CSP allows none.
import { ApiError, type ApiRequest, type Transport } from './transport';

export const DASHBOARD_TOOL = 'dashboard_api';
/** Same limits as the extension (extension/src/dashboard-view.ts): 10 MB a file, 1 MB a call. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PART_BYTES = 1024 * 1024;

/** What the view needs from the host: ext-apps' App has it. */
export interface ToolCaller {
  callServerTool(params: { name: string; arguments?: Record<string, unknown> }): Promise<{
    isError?: boolean;
    content?: unknown[];
    structuredContent?: unknown;
  }>;
}

interface Reply {
  status: number;
  body?: unknown;
  etag?: string;
}

const NBSP = ' ';
const ADD_ELSEWHERE = {
  en: (name: string, reason: string) =>
    `“${name}” ${reason}. Add it in the dashboard in your browser, or put it in your Taxpresso folder.`,
  fr: (name: string, reason: string) =>
    `«${NBSP}${name}${NBSP}» ${reason}. Ajoutez-le dans le tableau de bord de votre navigateur, ou déposez-le dans votre dossier Taxpresso.`,
};
const TOO_LARGE = {
  en: 'is larger than 10 MB, too large to add from the chat',
  fr: `dépasse 10${NBSP}Mo, c’est trop lourd pour l’ajouter depuis le chat`,
};
const FAILED = {
  en: 'could not be added from the chat',
  fr: 'n’a pas pu être ajouté depuis le chat',
};

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function uploadId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function mcpTransport(host: ToolCaller): Transport {
  /** The last state, by language, with its tag: unchanged state comes back without a body. */
  const states = new Map<string, { etag: string; body: unknown }>();

  /** One tool call. Throws ApiError when the extension refuses, Error when the host fails. */
  async function call(args: Record<string, unknown>): Promise<Reply> {
    const result = await host.callServerTool({ name: DASHBOARD_TOOL, arguments: args });
    const reply = result.structuredContent as Reply | undefined;
    if (!result.isError && reply && reply.status < 400) return reply;
    const error = (reply?.body as { error?: unknown } | undefined)?.error;
    const text = (result.content?.[0] as { text?: unknown } | undefined)?.text;
    throw new ApiError(
      typeof error === 'string'
        ? error
        : typeof text === 'string'
          ? text
          : `HTTP ${reply?.status ?? 500}`,
    );
  }

  async function upload(req: ApiRequest, file: File): Promise<unknown> {
    const lang = req.query.lang === 'fr' ? 'fr' : 'en';
    if (file.size > MAX_FILE_BYTES)
      throw new ApiError(ADD_ELSEWHERE[lang](file.name, TOO_LARGE[lang]));
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parts = Math.max(1, Math.ceil(bytes.length / PART_BYTES));
      const upload = uploadId();
      let reply: Reply | undefined;
      for (let part = 0; part < parts; part++) {
        const data = toBase64(bytes.subarray(part * PART_BYTES, (part + 1) * PART_BYTES));
        reply = await call({
          method: 'POST',
          path: req.path,
          query: req.query,
          csrf: req.csrf,
          file: { name: file.name, upload, part, parts, size: bytes.length, data },
        });
      }
      return reply?.body;
    } catch (err) {
      // The extension's own refusals (not a document, folder problem...) are shown as they are.
      if (err instanceof ApiError) throw err;
      throw new ApiError(ADD_ELSEWHERE[lang](file.name, FAILED[lang]));
    }
  }

  return {
    async send(req) {
      if (req.file) return upload(req, req.file);
      const key =
        req.method === 'GET' && req.path === '/state' ? (req.query.lang ?? '') : undefined;
      const known = key === undefined ? undefined : states.get(key);
      const reply = await call({
        method: req.method,
        path: req.path,
        query: req.query,
        ...(req.body ? { body: req.body } : {}),
        ...(req.csrf ? { csrf: req.csrf } : {}),
        ...(known ? { etag: known.etag } : {}),
      });
      if (reply.status === 304 && known) return known.body;
      if (key !== undefined && reply.etag) states.set(key, { etag: reply.etag, body: reply.body });
      return reply.body;
    },
  };
}
