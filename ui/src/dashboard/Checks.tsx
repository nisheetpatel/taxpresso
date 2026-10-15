// "Check this" (SPEC.md 5.8): what doesn't add up across the documents, a row of "Make it exact"
// (three-pages.md). Each item is settled by replacing a document (the browser page) or with a short
// note; the checks themselves are computed by Taxpresso from fixed rules, never by a model.
import { useState } from 'preact/hooks';
import './documents.css';
import { api } from './api';
import { useReplace } from './DocumentCards';
import type { Language } from './i18n';
import { td } from './i18n-docs';
import type { Act } from './page-props';
import type { CheckView } from './types-docs';
import { Why } from './ui';

export function CheckItem({
  c,
  lang,
  act,
  embedded,
}: {
  c: CheckView;
  lang: Language;
  act: Act;
  /** Inside Claude Desktop no file is uploaded: the note settles it, or Claude in the chat. */
  embedded: boolean;
}) {
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState('');
  const replace = useReplace(lang, act);
  const [first, second] = c.documents;
  return (
    <div class="check-item">
      <strong>{c.title}</strong>
      <span class="small-text">{c.detail}</span>
      <span class="muted small-text">{c.todo}</span>
      <div class="row-actions">
        {c.rule === 'duplicate' && first && second ? (
          <button
            type="button"
            class="ghost"
            onClick={() => void act(() => api.replaceDocument(second.id, first.id, lang))}
          >
            {td(lang, 'countOnce')}
          </button>
        ) : first && !embedded ? (
          <button type="button" class="ghost" onClick={() => replace.pick(first.id)}>
            {td(lang, 'replaceDoc', { name: first.filename })}
          </button>
        ) : null}
        <button type="button" class="link" onClick={() => setWriting(!writing)}>
          {td(lang, writing ? 'cancel' : 'addNote')}
        </button>
        {replace.field}
        {c.source ? (
          <Why lang={lang}>
            <p class="tnum small-text">{c.source}</p>
          </Why>
        ) : null}
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
          <button type="submit" class="primary" disabled={!note.trim()}>
            {td(lang, 'saveNote')}
          </button>
        </form>
      ) : null}
    </div>
  );
}
