// Dev tool, never shipped: plays the host (Claude Desktop) for the dashboard view, so it can be
// seen and used in a plain browser. Built by scripts/build-preview.mjs into dist/preview/.
//   /preview/?url=<dashboard link>&lang=fr&theme=dark&mode=fullscreen
// Served by scripts/preview-serve.mjs, the view's dashboard_api calls reach a real extension (the
// built one, on a temporary folder). Served by a plain static server, they fail, as with a host
// that can't reach the extension, and the view says so.
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
import type {
  McpUiDisplayMode,
  McpUiHostContext,
  McpUiTheme,
} from '@modelcontextprotocol/ext-apps';

declare const __VIEW_HTML__: string;

const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'fr' ? 'fr' : 'en';
let theme: McpUiTheme = params.get('theme') === 'dark' ? 'dark' : 'light';
let mode: McpUiDisplayMode = params.get('mode') === 'fullscreen' ? 'fullscreen' : 'inline';

/** The default CSP of MCP Apps hosts for a view that declares no domain: nothing from outside. */
const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data:',
  'media-src data:',
  "connect-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const iframe = document.querySelector<HTMLIFrameElement>('#view')!;
const log = document.querySelector<HTMLElement>('#log')!;
const note = (text: string) => {
  const li = document.createElement('li');
  li.textContent = text;
  log.prepend(li);
  while (log.children.length > 12) log.lastElementChild?.remove();
};

/** The preview server, when there is one: the extension behind it. */
async function backend<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(`No extension behind this preview (${res.status}).`);
  return (await res.json()) as T;
}

const context: McpUiHostContext = {
  theme,
  displayMode: mode,
  availableDisplayModes: ['inline', 'fullscreen'],
  locale: lang === 'fr' ? 'fr-CH' : 'en-GB',
  platform: 'desktop',
};
const bridge = new AppBridge(
  null,
  { name: 'Taxpresso preview host', version: '0.0.0' },
  { openLinks: {}, serverTools: {} },
  { hostContext: { ...context } },
);
const setContext = (change: McpUiHostContext) => {
  Object.assign(context, change);
  bridge.setHostContext({ ...context });
};

function show(next: McpUiDisplayMode) {
  mode = next;
  document.body.dataset.mode = mode;
  setContext({ displayMode: mode });
}

/** The open_dashboard result, from the extension when there is one behind this preview. */
async function sendOpenResult() {
  let result;
  try {
    result = await backend<{ structuredContent?: unknown }>('/__mcp/open');
    note('open_dashboard ran on the extension; its result goes to the view');
  } catch {
    const url = params.get('url') ?? 'http://127.0.0.1:0/?t=preview';
    result = {
      content: [{ type: 'text', text: `Dashboard: ${url}` }],
      structuredContent: { url, status: { taxYear: 2026, uiLanguage: lang } },
    };
    note('No extension behind this preview: the view gets a made-up open_dashboard result');
  }
  await bridge.sendToolResult(result as Parameters<typeof bridge.sendToolResult>[0]);
}
bridge.oninitialized = () => void sendOpenResult();
bridge.oncalltool = async (call) => {
  const what = `${String(call.arguments?.method)} ${String(call.arguments?.path)}`;
  const result = await backend<Awaited<ReturnType<NonNullable<typeof bridge.oncalltool>>>>(
    '/__mcp/call',
    call,
  );
  const status = (result.structuredContent as { status?: number } | undefined)?.status;
  note(`${call.name} ${what}: ${status ?? '?'}`);
  return result;
};
bridge.onopenlink = ({ url }) => {
  note(`The view asked the host to open ${url}`);
  window.open(url, '_blank', 'noopener');
  return Promise.resolve({});
};
bridge.onrequestdisplaymode = ({ mode: wanted }) => {
  const next = wanted === 'fullscreen' ? 'fullscreen' : 'inline';
  note(`The view asked for ${wanted}`);
  show(next);
  return Promise.resolve({ mode: next });
};
bridge.onsizechange = ({ height }) => {
  if (height && mode === 'inline') iframe.style.height = `${height}px`;
};

document.querySelector('#theme')!.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  setContext({ theme });
});
document
  .querySelector('#mode')!
  .addEventListener('click', () => show(mode === 'fullscreen' ? 'inline' : 'fullscreen'));

document.documentElement.dataset.theme = theme;
document.body.dataset.mode = mode;
await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
// With preview-serve.mjs, the view comes from the extension (resources/read), as in a host, with
// its key; served statically, the built file is used and dashboard_api refuses its calls.
const viewHtml = await fetch('/__mcp/view')
  .then((r) => (r.ok ? r.text() : __VIEW_HTML__))
  .catch(() => __VIEW_HTML__);
iframe.srcdoc = viewHtml.replace(
  '<head>',
  `<head><meta http-equiv="Content-Security-Policy" content="${CSP}">`,
);
