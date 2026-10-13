// "Fill in your declaration" (SPEC.md 10.5, docs/design/3b-filing-and-reconciliation.html): the
// values to type into the official declaration, page by page in the form's order. Each value shows
// its rubric code, its official French label with the gloss in the page language, the value as
// the form wants it, a copy button and an "Entered" tick kept on this computer. A value that still
// needs the user's OK, or is an estimate, is shown as such: no copy, no tick.
import { useState } from 'preact/hooks';
import './copy-panel.css';
import { api } from './api';
import type { Language } from './i18n';
import { formatChf } from './i18n-docs';
import { tc, type CopyMessageKey } from './i18n-copy';
import type { State } from './types';
import type { CopyPanelRow, CopyPanelSection } from './types-copy';

type Act = (fn: () => Promise<State>, label?: string) => Promise<boolean>;

const NB = String.fromCharCode(0xa0);

/** A person's label inside a sentence: "You" -> "you". */
const inSentence = (label: string) => label.charAt(0).toLowerCase() + label.slice(1);

const STATUS: Record<CopyPanelRow['status'], [string, CopyMessageKey]> = {
  extracted: ['chip-needs-ok', 'statusNeedsOk'],
  stated: ['chip-stated', 'statusConfirmed'],
  verified: ['chip-verified', 'statusVerified'],
  estimate: ['chip-estimate', 'statusEstimate'],
  computed: ['chip-computed', 'statusComputed'],
};

function Chip({ status, lang }: { status: CopyPanelRow['status']; lang: Language }) {
  const [cls, key] = STATUS[status];
  return <span class={`chip ${cls}`}>{tc(lang, key)}</span>;
}

/** Copies the value as typed on the form; shows it when the clipboard is not available. */
function CopyButton({ value, label, lang }: { value: string; label: string; lang: Language }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  return (
    <>
      <button
        type="button"
        class="ghost small"
        aria-label={tc(lang, 'copyLabel', { label })}
        onClick={() =>
          void navigator.clipboard.writeText(value).then(
            () => setState('done'),
            () => setState('failed'),
          )
        }
      >
        {tc(lang, state === 'done' ? 'copied' : 'copy')}
      </button>
      {state === 'failed' ? (
        <span class="small-text tnum cp-fallback">{tc(lang, 'copyFailed', { value })}</span>
      ) : null}
    </>
  );
}

function Row({ r, lang, act }: { r: CopyPanelRow; lang: Language; act: Act }) {
  const check = r.role !== 'input';
  const columns = r.columns.map((c) => c.label).join(' + ');
  const where = [
    r.part ? `${r.part.label} (${r.part.gloss})` : '',
    columns ? tc(lang, r.columns.length > 1 ? 'columns' : 'column', { list: columns }) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const files = r.documents.map((d) => d.filename).join(', ');
  const colon = lang === 'fr' ? `${NB}: ` : ': ';
  return (
    <li
      class={`cp-row${r.final ? '' : ' cp-row-pending'}${check ? ' cp-row-check' : ''}`}
      data-ref={r.ref}
    >
      <span class="cp-ref tnum">{r.code ? r.ref : ''}</span>
      <div class="cp-label">
        <span class="cp-official" lang="fr">
          {r.label}
        </span>
        <span class="cp-gloss">{r.gloss}</span>
        {where ? <span class="muted small-text">{where}</span> : null}
        {r.splitInto ? (
          <span class="small-text">
            {tc(lang, 'split', {
              parts: r.splitInto.map((p) => `${p.label} (${p.gloss})`).join(', '),
            })}
          </span>
        ) : null}
        {r.fields.map((f) => (
          <span class="cp-field small-text" key={f.id}>
            <span>
              <span lang="fr">{f.label}</span>
              {colon}
              <strong>{f.value}</strong>
            </span>
            {r.enterable ? <CopyButton value={f.value} label={f.label} lang={lang} /> : null}
          </span>
        ))}
        {r.rounded && r.centimes !== undefined ? (
          <span class="muted small-text">
            {tc(lang, 'rounded', { amount: formatChf(r.centimes, lang) })}
          </span>
        ) : null}
        {files ? <span class="muted small-text">{tc(lang, 'from', { files })}</span> : null}
        {check ? (
          <span class="muted small-text">{tc(lang, 'formWorksOut')}</span>
        ) : !r.final ? (
          <span class="small-text cp-todo">
            {tc(lang, r.status === 'estimate' ? 'estimateFirst' : 'confirmFirst')}
          </span>
        ) : null}
      </div>
      <div class="cp-value">
        {r.format === 'tick' ? (
          <strong>{tc(lang, 'tick')}</strong>
        ) : r.copy !== undefined ? (
          <strong class="tnum">{r.copy}</strong>
        ) : null}
        <Chip status={r.status} lang={lang} />
      </div>
      {r.enterable ? (
        <div class="cp-actions">
          {r.copy !== undefined ? (
            <CopyButton value={r.copy} label={`${r.ref} ${r.label}`} lang={lang} />
          ) : null}
          <label class="cp-entered">
            <input
              type="checkbox"
              checked={r.entered}
              onChange={(e) =>
                void act(() =>
                  api.setFormEntered(r.id, (e.target as HTMLInputElement).checked, lang),
                )
              }
            />
            {tc(lang, 'entered')}
          </label>
        </div>
      ) : null}
    </li>
  );
}

function Page({ s, lang, act }: { s: CopyPanelSection; lang: Language; act: Act }) {
  const done = s.total > 0 && s.entered === s.total && s.pending === 0;
  return (
    <details class="card cp-page" open={!done}>
      <summary class="cp-page-head">
        <span class="cp-page-id tnum" aria-label={tc(lang, 'pageLabel', { page: s.page })}>
          {s.page}
        </span>
        <span class="cp-page-title">
          <span class="cp-official" lang="fr">
            {s.title}
          </span>
          <span class="muted small-text">{s.gloss}</span>
        </span>
        <span class="cp-page-side">
          {s.total ? (
            <span class={`chip ${done ? 'chip-stated' : 'chip-plain'} tnum`}>
              {tc(lang, 'progress', { n: s.entered, total: s.total })}
            </span>
          ) : null}
          {s.pending ? (
            <span class="chip chip-needs-ok tnum">{tc(lang, 'pending', { n: s.pending })}</span>
          ) : null}
        </span>
      </summary>
      {s.groups.map((g) => (
        <div class="cp-group" key={g.section}>
          <h4 class="cp-group-title">
            <span lang="fr">{g.title}</span>
            {g.gloss.toLowerCase() !== g.title.toLowerCase() ? (
              <span class="muted"> · {g.gloss}</span>
            ) : null}
          </h4>
          <ul class="cp-rows">
            {g.rows.map((r) => (
              <Row key={r.id} r={r} lang={lang} act={act} />
            ))}
          </ul>
        </div>
      ))}
    </details>
  );
}

export function CopyPanel({ state, lang, act }: { state: State; lang: Language; act: Act }) {
  const panel = state.copyPanel;
  if (!panel || (panel.sections.length === 0 && panel.waiting.length === 0)) return null;
  const person = (id: string) => inSentence(state.people.find((p) => p.id === id)?.label ?? id);
  return (
    <section aria-labelledby="cp-title" class="stack">
      <div class="section-head">
        <h2 id="cp-title">{tc(lang, 'title')}</h2>
        {panel.total ? (
          <span class="muted small-text tnum">
            {tc(lang, 'progress', { n: panel.entered, total: panel.total })}
          </span>
        ) : null}
      </div>
      <p class="muted cp-lead">{tc(lang, 'lead')}</p>
      {panel.provisional && panel.note ? <p class="banner banner-estimate">{panel.note}</p> : null}
      {panel.couple ? (
        <p class="muted small-text cp-lead">
          {tc(lang, 'couple', { a: person('p1'), b: person('p2') })}
        </p>
      ) : null}
      {panel.waiting.length ? (
        <p class="banner cp-waiting">
          {tc(lang, 'waiting', {
            list: panel.waiting
              .map((w) => (w.filename ? `${w.label} (${w.filename})` : w.label))
              .join('; '),
          })}
        </p>
      ) : null}
      {panel.sections.map((s) => (
        <Page key={s.page} s={s} lang={lang} act={act} />
      ))}
    </section>
  );
}
