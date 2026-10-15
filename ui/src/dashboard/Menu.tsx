// The one menu (three-pages.md, top bar): tax year, language, the Taxpresso folder, "Stays on this
// computer", the activity from the chat and the ZIP copy of the folder. Nothing else on the bar.
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ExportCard } from './Export';
import { isMessageKey, t, type Language } from './i18n';
import { pg } from './i18n-pages';
import type { Act } from './page-props';
import type { State } from './types';
import { Icon } from './ui';
import { YearSwitch } from './Years';

const LANGUAGES: Language[] = ['en', 'fr', 'de', 'it'];
const NAMES: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
};

/** What Claude and you did, last first (the activity card of before, now in the menu). */
export function ActivityLog({ state, lang }: { state: State; lang: Language }) {
  const time = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' });
  const items = state.activity.filter((a) => isMessageKey(`act.${a.by}.${a.what}`)).slice(0, 8);
  if (!items.length) return null;
  return (
    <details class="menu-more">
      <summary>{pg(lang, 'menu.activity')}</summary>
      <ol class="activity">
        {items.map((a, i) => {
          const key = `act.${a.by}.${a.what}`;
          return (
            <li key={`${a.at}-${i}`}>
              <time class="tnum" dateTime={a.at}>
                {time.format(new Date(a.at))}
              </time>{' '}
              {isMessageKey(key) ? t(lang, key, { detail: a.detail ?? '' }) : ''}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

export function Menu({
  state,
  lang,
  onLang,
  act,
  busy,
  onOpenFolder,
  extra,
}: {
  state: State;
  lang: Language;
  onLang: (lang: Language) => void;
  act: Act;
  busy: string;
  onOpenFolder: () => void;
  /** The host's own choices inside Claude Desktop (beside the chat, full screen, the browser). */
  extra?: ComponentChildren;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return (
    <div class="menu-wrap" ref={wrap}>
      <button
        ref={button}
        type="button"
        class="icon-btn"
        aria-label={pg(lang, 'menu.label')}
        aria-expanded={open}
        aria-controls="menu"
        onClick={() => setOpen(!open)}
      >
        <Icon.dots />
      </button>
      {open ? (
        <div id="menu" class="menu" role="region" aria-label={pg(lang, 'menu.label')}>
          <div class="menu-section">
            <span class="menu-title">{pg(lang, 'menu.year')}</span>
            <YearSwitch state={state} lang={lang} act={act} busy={busy !== ''} />
          </div>
          <div class="menu-section">
            <span class="menu-title" id="menu-lang">
              {pg(lang, 'menu.language')}
            </span>
            <div class="seg" role="group" aria-labelledby="menu-lang" style={{ '--seg-cols': '4' }}>
              {LANGUAGES.map((l) => (
                <button
                  type="button"
                  key={l}
                  class="seg-btn"
                  lang={l}
                  aria-pressed={l === lang}
                  aria-label={NAMES[l]}
                  onClick={() => onLang(l)}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div class="menu-section">
            <span class="menu-title">{pg(lang, 'menu.folder')}</span>
            <span class="small-text muted folder-path">{state.vault.path}</span>
            <button type="button" class="ghost" onClick={onOpenFolder}>
              <Icon.folder />
              <span>{pg(lang, 'openFolder')}</span>
            </button>
          </div>
          <p class="menu-local small-text">
            <Icon.lock />
            <span>{pg(lang, 'menu.local')}</span>
          </p>
          {extra}
          <ExportCard state={state} lang={lang} busy={busy} act={act} />
          <ActivityLog state={state} lang={lang} />
          <p class="small-text muted tnum">
            {pg(lang, 'menu.version', { version: state.version })}
          </p>
        </div>
      ) : null}
    </div>
  );
}
