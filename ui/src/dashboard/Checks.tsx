// "Check this" (SPEC.md 5.8): what doesn't add up across the documents, next to "Still missing".
// Each item is settled by replacing a document or with a short note; the checks themselves are
// computed by Taxpresso from fixed rules, never by a model.
import { useState } from 'preact/hooks';
import './documents.css';
import { api } from './api';
import { useReplace } from './DocumentCards';
import type { Language } from './i18n';
import { td } from './i18n-docs';
import type { State } from './types';
import type { CheckView } from './types-docs';

type Act = (fn: () => Promise<State>, label?: string) => Promise<boolean>;

function CheckItem({ c, lang, act }: { c: CheckView; lang: Language; act: Act }) {
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState('');
  const replace = useReplace(lang, act);
  const [first, second] = c.documents;
  return (
    <li class="req dc-check">
      <strong>{c.title}</strong>
      <span class="small-text">{c.detail}</span>
      <span class="muted small-text">{c.todo}</span>
      {c.source ? (
        <span class="muted small-text tnum">
          {td(lang, 'source')}
          {td(lang, 'colon')}
          {c.source}
        </span>
      ) : null}
      <div class="req-actions">
        {c.rule === 'duplicate' && first && second ? (
          <button
            type="button"
            class="ghost small"
            onClick={() => void act(() => api.replaceDocument(second.id, first.id, lang))}
          >
            {td(lang, 'countOnce')}
          </button>
        ) : first ? (
          <button type="button" class="ghost small" onClick={() => replace.pick(first.id)}>
            {td(lang, 'replaceDoc', { name: first.filename })}
          </button>
        ) : null}
        <button type="button" class="link" onClick={() => setWriting(!writing)}>
          {td(lang, writing ? 'cancel' : 'addNote')}
        </button>
        {replace.field}
      </div>
      {writing ? (
        <form
          class="dc-note"
          onSubmit={(e) => {
            e.preventDefault();
            if (!note.trim()) return;
            void act(() => api.resolveCheck(c.id, note, lang)).then(
              (ok) => ok && setWriting(false),
            );
          }}
        >
          <textarea
            rows={2}
            maxLength={500}
            value={note}
            aria-label={c.title}
            placeholder={td(lang, 'notePlaceholder')}
            onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)}
          />
          <button type="submit" class="primary dc-small" disabled={!note.trim()}>
            {td(lang, 'saveNote')}
          </button>
        </form>
      ) : null}
    </li>
  );
}

export function Checks({ state, lang, act }: { state: State; lang: Language; act: Act }) {
  const open = state.checks.filter((c) => !c.resolved);
  const settled = state.checks.filter((c) => c.resolved);
  // Nothing across the documents to check: nothing to show (docs/design/simple.md).
  if (state.checks.length === 0) return null;
  return (
    <section class="card side-card dc-checks" aria-labelledby="checks-title">
      <div class="section-head">
        <h2 id="checks-title">{td(lang, 'checksTitle')}</h2>
        <span class="muted tnum">{open.length}</span>
      </div>
      {open.length === 0 ? <p class="muted">{td(lang, 'checksNone')}</p> : null}
      <ul class="req-list">
        {open.map((c) => (
          <CheckItem key={c.id} c={c} lang={lang} act={act} />
        ))}
      </ul>
      {settled.length ? (
        <details class="got">
          <summary>
            {td(lang, 'checksSettled')} <span class="muted tnum">{settled.length}</span>
          </summary>
          <ul class="plain-list">
            {settled.map((c) => (
              <li key={c.id}>
                {c.title}: <q>{c.resolved!.note}</q>{' '}
                <button
                  type="button"
                  class="link"
                  onClick={() => void act(() => api.resolveCheck(c.id, '', lang))}
                >
                  {td(lang, 'reopen')}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
