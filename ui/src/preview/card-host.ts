// Dev tool, never shipped: plays the host (Claude Desktop) for an MCP Apps view, so views can be
// seen and iterated in a plain browser. Built by scripts/build-preview.mjs into dist/preview/.
//   /preview/?url=<dashboard link>&lang=fr&theme=dark
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';

declare const __VIEW_HTML__: string;

const params = new URLSearchParams(location.search);
const url = params.get('url') ?? 'http://127.0.0.1:0/?t=preview';
const lang = params.get('lang') === 'fr' ? 'fr' : 'en';
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
document.documentElement.dataset.theme = theme;

const iframe = document.querySelector<HTMLIFrameElement>('#view')!;
const log = document.querySelector<HTMLElement>('#log')!;
const note = (text: string) => {
  const li = document.createElement('li');
  li.textContent = text;
  log.append(li);
};

const bridge = new AppBridge(
  null,
  { name: 'Taxpresso preview host', version: '0.0.0' },
  { openLinks: {} },
  { hostContext: { theme } },
);
bridge.oninitialized = () => {
  note('View initialized; sending the open_dashboard result');
  void bridge.sendToolResult({
    content: [{ type: 'text', text: `Dashboard: ${url}` }],
    structuredContent: { url, status: { taxYear: 2026, uiLanguage: lang } },
  });
};
bridge.onopenlink = ({ url: target }) => {
  note(`View asked the host to open ${target}`);
  window.open(target, '_blank', 'noopener');
  return Promise.resolve({});
};
bridge.onsizechange = ({ height }) => {
  if (height) iframe.style.height = `${height}px`;
};

await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
iframe.srcdoc = __VIEW_HTML__;
