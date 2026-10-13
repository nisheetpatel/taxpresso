// MCP Apps view: the whole dashboard inside the conversation (SPEC.md section 3), shown with
// open_dashboard where the host renders views, so the chat and its microphone stay at hand. The
// same components as the browser page, which stays the fallback. It reaches the extension through
// the host (the dashboard_api tool), never over the network: the host's CSP allows none.
import '../shared/tokens.css';
import '../shared/logo.css';
import '../dashboard/styles.css';
import './dashboard.css';
import {
  App as Host,
  applyDocumentTheme,
  type McpUiDisplayMode,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { App } from '../dashboard/App';
import { setTransport } from '../dashboard/api';
import { mcpTransport } from '../dashboard/transport-mcp';
import { loadFonts } from './fonts';

const strings = {
  en: {
    full: 'Full screen',
    exitFull: 'Exit full screen',
    browser: 'Open in your browser',
    copyLink: 'If nothing opens, copy this link into a browser on this computer:',
    alone: 'Ask Claude to open your Taxpresso dashboard.',
    noTools: 'Your dashboard can’t run inside this chat. Open it in your browser on this computer.',
  },
  fr: {
    full: 'Plein écran',
    exitFull: 'Quitter le plein écran',
    browser: 'Ouvrir dans le navigateur',
    copyLink: 'Si rien ne s’ouvre, copiez ce lien dans un navigateur de cet ordinateur :',
    alone: 'Demandez à Claude d’ouvrir votre tableau de bord Taxpresso.',
    noTools:
      'Votre tableau de bord ne peut pas s’afficher dans ce chat. Ouvrez-le dans le navigateur de cet ordinateur.',
  },
};
type Lang = keyof typeof strings;
const asLang = (value: unknown): Lang | undefined =>
  value === 'fr' || value === 'en' ? value : undefined;

/** The open_dashboard result: the private link for the browser. */
interface OpenResult {
  url?: string;
}

/** What the bar above the dashboard shows. */
const view: { ctx: McpUiHostContext; url?: string; lang: Lang } = {
  ctx: {},
  lang: asLang(navigator.language.slice(0, 2)) ?? 'en',
};
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

function useView() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }, []);
  return view;
}

/** Follows the host: theme, display mode, the room it gives the view, and safe areas on phones. */
function update(next: McpUiHostContext): void {
  view.ctx = { ...view.ctx, ...next };
  const root = document.documentElement;
  if (next.theme) applyDocumentTheme(next.theme);
  root.dataset.display = view.ctx.displayMode ?? 'inline';
  const room = view.ctx.containerDimensions;
  const limit = room && 'height' in room ? room.height : room?.maxHeight;
  const bar = document.querySelector('.embed-bar')?.getBoundingClientRect().height ?? 0;
  if (limit) root.style.setProperty('--embed-max', `${Math.max(240, Math.floor(limit - bar))}px`);
  else root.style.removeProperty('--embed-max');
  const inset = view.ctx.safeAreaInsets;
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    root.style.setProperty(`--safe-${side}`, `${inset?.[side] ?? 0}px`);
  }
  changed();
}

function Bar({ host }: { host: Host }) {
  const { ctx, url, lang } = useView();
  const [showLink, setShowLink] = useState(false);
  const s = strings[lang];
  const mode = ctx.displayMode ?? 'inline';
  const canFull = (ctx.availableDisplayModes ?? []).includes('fullscreen');
  if (!canFull && !url) return null;

  const toggle = async () => {
    const want: McpUiDisplayMode = mode === 'fullscreen' ? 'inline' : 'fullscreen';
    try {
      update({ displayMode: (await host.requestDisplayMode({ mode: want })).mode });
    } catch {
      // The host said no: the view stays as it is.
    }
  };
  const openInBrowser = async () => {
    if (!url) return;
    try {
      setShowLink((await host.openLink({ url })).isError === true);
    } catch {
      setShowLink(true);
    }
  };

  return (
    <nav class="embed-bar" aria-label="Taxpresso">
      <div class="embed-actions">
        {canFull ? (
          <button type="button" onClick={() => void toggle()}>
            {mode === 'fullscreen' ? s.exitFull : s.full}
          </button>
        ) : null}
        {url ? (
          <button type="button" onClick={() => void openInBrowser()}>
            {s.browser}
            <span aria-hidden="true"> ↗</span>
          </button>
        ) : null}
      </div>
      {showLink && url ? (
        <p class="embed-link small-text">
          {s.copyLink} <code>{url}</code>
        </p>
      ) : null}
    </nav>
  );
}

function Embedded({ host }: { host: Host }) {
  useEffect(() => update({}), []);
  return (
    <div class="embed">
      <Bar host={host} />
      <div class="embed-scroll">
        <div id="app">
          <App />
        </div>
      </div>
    </div>
  );
}

/** A host that shows views but can't pass their calls to the extension: the browser it is. */
function BrowserOnly({ host }: { host: Host }) {
  const { lang } = useView();
  return (
    <div class="embed">
      <Bar host={host} />
      <p class="embed-alone">{strings[lang].noTools}</p>
    </div>
  );
}

const host = new Host(
  { name: 'Taxpresso dashboard', version: '0.1.0' },
  { availableDisplayModes: ['inline', 'fullscreen'] },
);
host.ontoolresult = ({ structuredContent }) => {
  const result = structuredContent as OpenResult | undefined;
  if (!result?.url) return;
  view.url = result.url;
  changed();
};
host.onhostcontextchanged = (next) => update(next);

// The dashboard sets the page language (its own choice, or the one set at install); the bar follows.
new MutationObserver(() => {
  view.lang = asLang(document.documentElement.getAttribute('lang')) ?? view.lang;
  changed();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

// Links (an official page on a topic) open in the user's browser, through the host.
document.addEventListener('click', (event) => {
  const link = (event.target as Element | null)?.closest('a[href]');
  if (!(link instanceof HTMLAnchorElement) || !/^https?:$/.test(link.protocol)) return;
  event.preventDefault();
  void host.openLink({ url: link.href }).catch(() => undefined);
});

loadFonts();
applyDocumentTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const root = document.getElementById('root')!;
try {
  await host.connect();
  update(host.getHostContext() ?? {});
  const capabilities = host.getHostCapabilities();
  if (capabilities && !capabilities.serverTools) {
    render(<BrowserOnly host={host} />, root);
  } else {
    setTransport(mcpTransport(host));
    render(<Embedded host={host} />, root);
  }
} catch {
  render(<p class="embed-alone">{strings[view.lang].alone}</p>, root);
}
