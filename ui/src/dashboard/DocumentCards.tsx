// "What Claude read in your documents" (SPEC.md 5.5 and 10.5, second view): one card per document,
// each value with its official French label and its gloss, a one-tap OK, a correction, a copy
// button with the value as typed on the official form, and an "Entered" tick kept on this computer.
import { useRef, useState } from 'preact/hooks';
import './documents.css';
import { api, ApiError } from './api';
import type { Language } from './i18n';
import { formatChf, showOfficial, td } from './i18n-docs';
import type { State } from './types';
import type { CardValue, DocumentCard } from './types-docs';

type Act = (fn: () => Promise<State>, label?: string) => Promise<boolean>;

export function StatusChip({ v, lang }: { v: CardValue; lang: Language }) {
  const [cls, key] =
    v.status === 'extracted'
      ? ['chip-needs-ok', 'statusNeedsOk' as const]
      : v.status === 'verified'
        ? [
            'chip-verified',
            v.method === 'barcode'
              ? ('statusVerifiedBarcode' as const)
              : ('statusVerified' as const),
          ]
        : v.status === 'estimate'
          ? ['chip-estimate', 'statusEstimate' as const]
          : [
              'chip-stated',
              v.via === 'chat' ? ('statusConfirmedChat' as const) : ('statusConfirmed' as const),
            ];
  return <span class={`chip ${cls}`}>{td(lang, key)}</span>;
}

/** Copies the value as typed on the official form; shows it if the clipboard is not available. */
function CopyButton({ value, label, lang }: { value: string; label: string; lang: Language }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  return (
    <>
      <button
        type="button"
        class="ghost small"
        aria-label={td(lang, 'copyLabel', { label })}
        onClick={() =>
          void navigator.clipboard.writeText(value).then(
            () => setState('done'),
            () => setState('failed'),
          )
        }
      >
        {td(lang, state === 'done' ? 'copied' : 'copy')}
      </button>
      {state === 'failed' ? (
        <span class="small-text tnum dc-copy-fallback">{td(lang, 'copyFailed', { value })}</span>
      ) : null}
    </>
  );
}

function ValueRow({
  v,
  card,
  lang,
  act,
}: {
  v: CardValue;
  card: DocumentCard;
  lang: Language;
  act: Act;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(v.copy ?? '');
  const [problem, setProblem] = useState('');
  const shown = v.centimes !== undefined ? formatChf(v.centimes, lang) : (v.text ?? '');
  const editable = v.copy !== undefined || v.type === 'boolean';
  const where = [
    v.box ? td(lang, 'box', { box: v.box }) : '',
    v.page ? td(lang, 'page', { page: v.page }) : '',
  ]
    .filter(Boolean)
    .join(' · ');
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
  const numeric = v.centimes !== undefined || v.type === 'date' || v.type === 'integer';
  return (
    <li class={`dc-row${v.status === 'extracted' ? ' dc-row-pending' : ''}`}>
      <div class="dc-label">
        {v.item ? <span class="muted small-text">{v.item}</span> : null}
        <span class="dc-gloss">{v.label}</span>
        {showOfficial(v.label, v.official) ? (
          <span class="dc-official" lang="fr">
            {v.official}
          </span>
        ) : null}
        {where ? <span class="muted small-text">{where}</span> : null}
      </div>
      <div class="dc-value">
        {editing && v.type === 'boolean' ? (
          <div class="plan-toggle" role="group" aria-label={v.label}>
            {[true, false].map((b) => (
              <button type="button" key={String(b)} onClick={() => void save(b)}>
                {td(lang, b ? 'yes' : 'no')}
              </button>
            ))}
          </div>
        ) : editing ? (
          <form
            class="dc-edit"
            onSubmit={(e) => {
              e.preventDefault();
              void save(draft);
            }}
          >
            <input
              class="tnum"
              value={draft}
              aria-label={v.label}
              placeholder={td(lang, 'editHint')}
              onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
            />
            <button type="submit" class="primary dc-small">
              {td(lang, 'save')}
            </button>
          </form>
        ) : (
          <strong class={numeric ? 'tnum' : undefined}>{shown}</strong>
        )}
        <StatusChip v={v} lang={lang} />
        {editing && problem ? (
          <span class="small-text dc-problem" role="alert">
            {td(lang, 'editProblem')} <span class="muted">{problem}</span>
          </span>
        ) : null}
      </div>
      <div class="dc-actions">
        {v.status === 'extracted' && !editing ? (
          <button
            type="button"
            class="primary dc-small"
            onClick={() => void act(() => api.confirmFact(v.factId, lang))}
          >
            {td(lang, 'ok')}
          </button>
        ) : null}
        {editable ? (
          <button
            type="button"
            class="link"
            onClick={() => {
              setDraft(v.copy ?? '');
              setProblem('');
              setEditing(!editing);
            }}
          >
            {td(lang, editing ? 'cancel' : 'edit')}
          </button>
        ) : null}
        {card.enterable && v.copy !== undefined && !editing ? (
          <CopyButton value={v.copy} label={v.label} lang={lang} />
        ) : null}
        {card.enterable ? (
          <label class="dc-entered">
            <input
              type="checkbox"
              checked={v.entered}
              onChange={(e) =>
                void act(() =>
                  api.setEntered(v.factId, (e.target as HTMLInputElement).checked, lang),
                )
              }
            />
            {td(lang, 'entered')}
          </label>
        ) : null}
      </div>
    </li>
  );
}

/** A hidden file field that uploads a file in place of another document. */
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

function Card({ card, lang, act }: { card: DocumentCard; lang: Language; act: Act }) {
  const replace = useReplace(lang, act);
  const details = [
    card.who,
    card.period
      ? td(lang, 'period', card.period)
      : card.taxYear
        ? td(lang, 'yearShort', { year: card.taxYear })
        : '',
    card.issuer,
  ].filter(Boolean);
  return (
    <article class="card dc-card" aria-labelledby={`dc-${card.docId}`}>
      <header class="dc-head">
        <div class="dc-title">
          <h3 id={`dc-${card.docId}`}>{card.kindLabel ?? card.filename}</h3>
          <span class="muted small-text">
            {card.kindLabel ? card.filename : ''}
            {details.length ? `${card.kindLabel ? ' · ' : ''}${details.join(' · ')}` : ''}
          </span>
          {card.kindSource === 'claude' ? (
            <span class="small-text dc-claude">{td(lang, 'kindByClaude')}</span>
          ) : null}
        </div>
        <div class="dc-head-side">
          {card.toConfirm ? (
            <span class="chip chip-needs-ok">{td(lang, 'toConfirm', { n: card.toConfirm })}</span>
          ) : card.values.length ? (
            <span class="chip chip-stated">{td(lang, 'allConfirmed')}</span>
          ) : null}
          {card.enterable && card.total ? (
            <span class="muted small-text tnum">
              {td(lang, 'enteredCount', { n: card.entered, total: card.total })}
            </span>
          ) : null}
        </div>
      </header>
      {card.values.length ? (
        <ul class="dc-values">
          {card.values.map((v) => (
            <ValueRow key={v.factId} v={v} card={card} lang={lang} act={act} />
          ))}
        </ul>
      ) : (
        <p class="muted small-text dc-empty">{td(lang, 'nothingRead')}</p>
      )}
      <footer class="dc-foot">
        {card.toConfirm || card.kindSource === 'claude' ? (
          <button
            type="button"
            class="ghost small"
            onClick={() => void act(() => api.confirmDocument(card.docId, lang))}
          >
            {td(lang, 'confirmAll')}
          </button>
        ) : null}
        <button type="button" class="link" onClick={() => replace.pick(card.docId)}>
          {td(lang, 'replaceFile')}
        </button>
        {replace.field}
      </footer>
    </article>
  );
}

export function DocumentCards({ state, lang, act }: { state: State; lang: Language; act: Act }) {
  if (state.cards.length === 0 && state.replaced.length === 0) return null;
  return (
    <section aria-labelledby="dc-title" class="stack">
      <div class="section-head">
        <h2 id="dc-title">{td(lang, 'cardsTitle')}</h2>
        {state.toConfirm ? (
          <span class="chip chip-needs-ok">{td(lang, 'toConfirm', { n: state.toConfirm })}</span>
        ) : null}
      </div>
      <p class="muted dc-lead">{td(lang, 'cardsLead')}</p>
      {state.cards.map((card) => (
        <Card key={card.docId} card={card} lang={lang} act={act} />
      ))}
      {state.replaced.length ? (
        <details class="got">
          <summary>
            {td(lang, 'replacedTitle')} <span class="muted tnum">{state.replaced.length}</span>
          </summary>
          <ul class="plain-list">
            {state.replaced.map((r) => (
              <li key={r.id}>
                {r.filename} <span class="muted small-text">({td(lang, 'replacedBy')})</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
