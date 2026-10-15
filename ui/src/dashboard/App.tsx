// The dashboard, three pages (docs/design/three-pages.md): a Start screen while nothing is known,
// then Your tax, Pay less and File, with the tax always on top. One column, the same in the panel
// beside the chat and at full width. The same state and next step as Claude's tools (get_status);
// the panel opens on the page the next step belongs to and never jumps while you are elsewhere.
import { wordmark } from '../shared/logo';
import type { ComponentChildren, JSX } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { api, ApiError, embedded } from './api';
import { BasicsCard, type Write } from './Basics';
import { FilePage } from './File';
import { t, type Language } from './i18n';
import { tj } from './i18n-journey';
import { pg } from './i18n-pages';
import { Menu } from './Menu';
import type { Act, PageProps } from './page-props';
import { PayLess } from './PayLess';
import { Start } from './Start';
import { followPage, shownPage, useCommunes, type PageId } from './state-adapter';
import type { State } from './types';
import { YourTax } from './YourTax';

/** The panel follows the chat: a change made there shows within about a second. */
const POLL_MS = 1000;

function readLang(): Language | undefined {
  try {
    const v = localStorage.getItem('taxpresso.lang');
    return v === 'en' || v === 'fr' || v === 'de' || v === 'it' ? v : undefined;
  } catch {
    return undefined;
  }
}

function saveLang(lang: Language): void {
  try {
    localStorage.setItem('taxpresso.lang', lang);
  } catch {
    /* private window: the choice lasts for this page only */
  }
}

/** Where storage isn't allowed (the view inside Claude Desktop): remembered while it is open. */
const memory = new Map<string, number>();

/** The rough tax of this year, remembered on this computer for "CHF 660 less than…". */
function remembered(key: string, value?: number): number | null {
  if (value !== undefined) memory.set(key, value);
  try {
    if (value !== undefined) localStorage.setItem(key, String(value));
    const stored = localStorage.getItem(key);
    if (stored !== null && Number.isFinite(Number(stored))) return Number(stored);
  } catch {
    /* no storage here: the memory of this session */
  }
  return memory.get(key) ?? null;
}

/** The basics card's changes, one after the other: each answer can open the next question. */
async function runWrites(writes: Write[], lang: Language): Promise<State> {
  let last: State | undefined;
  for (const w of writes) {
    last =
      'answer' in w
        ? await api.answer(w.answer.id, w.answer.value, lang)
        : await api.plan(w.plan.person, w.plan.field, w.plan.value, lang);
  }
  return last ?? api.state(lang);
}

const TABS = ['tax', 'save', 'file'] as const;

export function App({ menuExtra }: { menuExtra?: ComponentChildren } = {}): JSX.Element {
  const [lang, setLang] = useState<Language | undefined>(readLang());
  const [state, setState] = useState<State | null>(null);
  const [lost, setLost] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [basics, setBasics] = useState(false);
  const [tab, setTab] = useState<PageId | null>(null);
  const [flags, setFlags] = useState<ReadonlySet<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const followed = useRef<PageId | null>(null);
  const suggestedOnce = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const preset = useRef<{ kind: string; person?: string } | undefined>(undefined);
  const L: Language = lang ?? state?.lang ?? 'en';
  const inside = embedded();
  const pages = useCommunes(state, L);
  const current = pages?.page.current;

  const refresh = useCallback(async () => {
    try {
      const next = await api.state(lang);
      setState(next);
      setLost(false);
      if (location.search) history.replaceState(null, '', '/');
    } catch {
      setLost(true);
    }
  }, [lang]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    // Back to the page (another tab, the chat): fresh state at once.
    const now = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', now);
    window.addEventListener('focus', now);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', now);
      window.removeEventListener('focus', now);
    };
  }, [refresh]);

  useEffect(() => {
    document.documentElement.lang = L;
    document.title = t(L, 'docTitle');
  }, [L]);

  // The page of the next step: followed while you are on the page it was, never otherwise.
  useEffect(() => {
    if (!current || current === followed.current) return;
    const before = followed.current;
    setTab((shown) => followPage(shown, before, current));
    followed.current = current;
  }, [current]);

  // Last year's return is in and its answers wait in the basics card: it opens, once.
  const waiting = pages?.groups.basics.some((q) => !q.answered && q.suggested !== undefined);
  useEffect(() => {
    if (waiting && !suggestedOnce.current) {
      suggestedOnce.current = true;
      setBasics(true);
    }
  }, [waiting]);

  /** Runs a change, shows its error if any, and takes the fresh state it returns. */
  const act: Act = async (fn, label = '') => {
    setError('');
    setBusy(label || 'busy');
    try {
      setState(await fn());
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t(L, 'lost'));
      // The page may show another year than the open one (switched in the chat): show it now.
      void refresh();
      return false;
    } finally {
      setBusy('');
    }
  };

  const upload = async (files: File[]) => {
    const p = preset.current;
    preset.current = undefined;
    for (const file of files) {
      await act(() => api.upload(file, L, p), t(L, 'uploading', { name: file.name }));
    }
  };
  // Finder or Explorer opens on this computer; if it can't, the message says where the folder is.
  const openFolder = () => void act(() => api.openFolder(L));

  if (!state || !pages) {
    return <main class="app">{lost ? <p class="banner banner-fix">{t(L, 'lost')}</p> : null}</main>;
  }

  const total = state.estimate?.computed ? state.estimate.total : null;
  const roughKey = `taxpresso.rough.${state.vault.path}.${state.taxYear}`;
  const roughBefore =
    pages.confidence === 'rough' && total !== null
      ? remembered(roughKey, total)
      : remembered(roughKey);
  const shown = shownPage(pages.page, tab);
  const props: PageProps = {
    state,
    pages,
    lang: L,
    busy: busy !== '',
    embedded: inside,
    act,
    flags,
    setFlag: (flag, on) =>
      setFlags((now) => {
        if (now.has(flag) === on) return now;
        const next = new Set(now);
        if (on) next.add(flag);
        else next.delete(flag);
        return next;
      }),
    go: (page) => {
      setTab(page);
      window.scrollTo?.({ top: 0 });
    },
    openBasics: () => setBasics(true),
    add: (p) => {
      if (inside) return openFolder();
      preset.current = p;
      fileInput.current?.click();
    },
    roughBefore: pages.confidence === 'rough' ? null : roughBefore,
  };

  let body: JSX.Element;
  if (basics) {
    body = (
      <BasicsCard
        state={state}
        pages={pages}
        lang={L}
        busy={busy !== ''}
        actions={{
          write: (writes) => void act(() => runWrites(writes, L)),
          close: () => {
            setBasics(false);
            window.scrollTo?.({ top: 0 });
          },
        }}
      />
    );
  } else if (shown === 'start') {
    body = (
      <Start {...props} onFiles={(files) => void upload(files)} onChoose={() => props.add()} />
    );
  } else {
    body = (
      <>
        {pages.page.tabs ? (
          <nav class="tabs" aria-label={pg(L, 'pages')}>
            {TABS.map((id) => (
              <button
                type="button"
                key={id}
                class="tab"
                aria-current={shown === id ? 'page' : undefined}
                onClick={() => props.go(id)}
              >
                {tj(L, `page.${id}`)}
              </button>
            ))}
          </nav>
        ) : null}
        {shown === 'save' ? (
          <PayLess {...props} />
        ) : shown === 'file' ? (
          <FilePage {...props} />
        ) : (
          <YourTax {...props} />
        )}
      </>
    );
  }

  // The browser page takes files dropped anywhere on it; inside Claude Desktop, the folder does.
  const drop = inside
    ? {}
    : {
        onDragOver: (e: DragEvent) => {
          if (!e.dataTransfer?.types.includes('Files')) return;
          e.preventDefault();
          setDragging(true);
        },
        onDragLeave: (e: DragEvent) => {
          if (e.relatedTarget === null) setDragging(false);
        },
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          setDragging(false);
          void upload(Array.from(e.dataTransfer?.files ?? []));
        },
      };

  return (
    <div class={`app${dragging ? ' app-drop' : ''}`} {...drop}>
      <header class="top">
        <span class="brand-mark" dangerouslySetInnerHTML={{ __html: wordmark(true) }} />
        <Menu
          state={state}
          lang={L}
          onLang={(l) => (saveLang(l), setLang(l))}
          act={act}
          busy={busy}
          onOpenFolder={openFolder}
          extra={menuExtra}
        />
      </header>
      {state.vault.problem ? (
        <div class="banner banner-fix" role="alert">
          <strong>{t(L, 'folderProblem')}</strong> {state.vault.problem}
        </div>
      ) : null}
      {error ? (
        <p class="banner banner-fix" role="alert">
          {error}
        </p>
      ) : null}
      {busy && busy !== 'busy' ? (
        <p class="small-text muted" role="status">
          {busy}
        </p>
      ) : null}
      {lost ? (
        <p class="banner banner-fix" role="status">
          {t(L, 'lost')}
        </p>
      ) : null}
      <main class="main">{body}</main>
      {inside ? null : (
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const el = e.target as HTMLInputElement;
            void upload(Array.from(el.files ?? [])).then(() => (el.value = ''));
          }}
        />
      )}
    </div>
  );
}
