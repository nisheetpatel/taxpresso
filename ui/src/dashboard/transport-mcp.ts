// The dashboard inside the conversation (MCP Apps view): every request is a call to the
// dashboard_api tool, which the host passes to the extension. The extension runs it through the
// same checks and the same handler as the browser page. No network here: the view's CSP allows none.
import { ApiError, type ApiRequest, type Transport } from './transport';

export const DASHBOARD_TOOL = 'dashboard_api';
/** The meta tag the extension writes into this view's HTML: the key the dashboard_api tool asks for. */
export const VIEW_KEY_META = 'taxpresso-view-key';

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

const NBSP = '\u00a0';
/**
 * Documents are not added from the chat: their bytes would pass through the chat app's messages
 * (and possibly its logs). The folder and the browser dashboard take them directly.
 */
const ADD_ELSEWHERE = {
  en: (name: string) =>
    `To keep your documents out of the chat app, add “${name}” in the dashboard in your browser, or put it in your Taxpresso folder.`,
  fr: (name: string) =>
    `Pour que vos documents ne passent pas par l’application de chat, ajoutez «${NBSP}${name}${NBSP}» dans le tableau de bord de votre navigateur, ou déposez-le dans votre dossier Taxpresso.`,
  de: (name: string) =>
    `Damit deine Dokumente nicht über die Chat-App laufen, füge «${name}» im Dashboard in deinem Browser hinzu, oder leg es in deinen Taxpresso-Ordner.`,
  it: (name: string) =>
    `Perché i tuoi documenti non passino dall’app di chat, aggiungi “${name}” nella dashboard nel tuo browser, oppure mettilo nella tua cartella Taxpresso.`,
};

/** The key from this view's HTML, or an empty string (the extension then refuses every call). */
export function viewKey(doc: Pick<Document, 'querySelector'> = document): string {
  return doc.querySelector<HTMLMetaElement>(`meta[name="${VIEW_KEY_META}"]`)?.content ?? '';
}

export function mcpTransport(host: ToolCaller, key: string): Transport {
  /** The last state, by language, with its tag: unchanged state comes back without a body. */
  const states = new Map<string, { etag: string; body: unknown }>();

  /** One tool call. Throws ApiError when the extension refuses, Error when the host fails. */
  async function call(args: Record<string, unknown>): Promise<Reply> {
    const result = await host.callServerTool({
      name: DASHBOARD_TOOL,
      arguments: { ...args, key },
    });
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

  function upload(req: ApiRequest, file: File): never {
    const lang = req.query.lang;
    const known = lang === 'fr' || lang === 'de' || lang === 'it' ? lang : 'en';
    throw new ApiError(ADD_ELSEWHERE[known](file.name));
  }

  return {
    embedded: true,
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
