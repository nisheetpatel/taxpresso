// A value Claude read in a document, inline in "Make it exact" (three-pages.md, A4): the value,
// "Is that right?", Yes or Fix it, the same one-tap OK and correction as before (SPEC.md 5.5).
// One value at a time; the others of the same document wait their turn, or "All of it is right".
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { api, ApiError } from './api';
import type { Language } from './i18n';
import { formatChf, td } from './i18n-docs';
import { pg } from './i18n-pages';
import type { Act } from './page-props';
import type { DocumentCard } from './types-docs';

export function ValueCheck({
  card,
  lang,
  act,
}: {
  card: DocumentCard;
  lang: Language;
  act: Act;
}): JSX.Element | null {
  const pending = card.values.filter((v) => v.status === 'extracted');
  const v = pending[0];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(v?.copy ?? '');
  const [problem, setProblem] = useState('');
  if (!v) return null;
  const shown = v.centimes !== undefined ? formatChf(v.centimes, lang) : (v.text ?? '');
  const numeric = v.centimes !== undefined || v.type === 'date' || v.type === 'integer';
  // Saved here rather than through `act`, so a value Taxpresso can't read is explained next to it.
  const save = async (value: string | boolean) => {
    setProblem('');
    try {
      const next = await api.editFact(v.factId, value, lang);
      await act(() => Promise.resolve(next));
      setEditing(false);
    } catch (err) {
      // The reason starts with the key ("salary.gross: ..."): people don't need it.
      setProblem(
        err instanceof ApiError ? err.message.replace(/^[\w.]+: /, '') : td(lang, 'editFailed'),
      );
    }
  };
  const rest = pending.length - 1;
  return (
    <div class="value-check">
      <p class="value-line">
        <span>{v.item ? `${v.item} · ${v.label}` : v.label}</span>{' '}
        <strong class={numeric ? 'tnum' : undefined}>{shown}</strong>
        {v.page ? (
          <span class="muted small-text"> · {pg(lang, 'doc.page', { page: v.page })}</span>
        ) : null}
        <span class="value-ask"> {pg(lang, 'doc.right')}</span>
      </p>
      {editing && v.type === 'boolean' ? (
        <div class="row-actions" role="group" aria-label={v.label}>
          {[true, false].map((b) => (
            <button type="button" class="ghost" key={String(b)} onClick={() => void save(b)}>
              {pg(lang, b ? 'yes' : 'no')}
            </button>
          ))}
          <button type="button" class="link" onClick={() => setEditing(false)}>
            {pg(lang, 'cancel')}
          </button>
        </div>
      ) : editing ? (
        <form
          class="row-actions"
          onSubmit={(e) => {
            e.preventDefault();
            void save(draft);
          }}
        >
          <input
            class="tnum fix-input"
            value={draft}
            aria-label={v.label}
            placeholder={td(lang, 'editHint')}
            onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
          />
          <button type="submit" class="primary">
            {pg(lang, 'save')}
          </button>
          <button type="button" class="link" onClick={() => setEditing(false)}>
            {pg(lang, 'cancel')}
          </button>
        </form>
      ) : (
        <div class="row-actions">
          <button
            type="button"
            class="primary"
            onClick={() => void act(() => api.confirmFact(v.factId, lang))}
          >
            {pg(lang, 'yes')}
          </button>
          {v.copy !== undefined || v.type === 'boolean' ? (
            <button
              type="button"
              class="ghost"
              onClick={() => {
                setDraft(v.copy ?? '');
                setProblem('');
                setEditing(true);
              }}
            >
              {pg(lang, 'fix')}
            </button>
          ) : null}
        </div>
      )}
      {editing && problem ? (
        <p class="small-text problem" role="alert">
          {td(lang, 'editProblem')} <span class="muted">{problem}</span>
        </p>
      ) : null}
      {rest > 0 ? (
        <p class="small-text muted value-rest">
          {pg(lang, rest === 1 ? 'doc.moreOne' : 'doc.more', { n: rest })}{' '}
          <button
            type="button"
            class="link"
            onClick={() => void act(() => api.confirmDocument(card.docId, lang))}
          >
            {pg(lang, 'doc.allRight')}
          </button>
        </p>
      ) : null}
    </div>
  );
}

/** A hidden file field that uploads a file in place of another document (the browser page). */
export function useReplace(lang: Language, act: Act) {
  const input = useRef<HTMLInputElement>(null);
  const target = useRef('');
  const pick = (docId: string) => {
    target.current = docId;
    input.current?.click();
  };
  const field = (
    <input
      ref={input}
      type="file"
      hidden
      onChange={(e) => {
        const el = e.target as HTMLInputElement;
        const file = el.files?.[0];
        if (file) {
          void act(() => api.upload(file, lang, undefined, target.current)).then(
            () => (el.value = ''),
          );
        }
      }}
    />
  );
  return { pick, field };
}
