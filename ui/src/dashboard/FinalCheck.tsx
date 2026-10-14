// "Final check" (SPEC.md 10.0): before the user fills in the official form, what to fix first and
// what is good to know, the same list Claude gets from final_check. Read-only: settling an item
// happens where it lives (Documents, the questions, "Check this"), or in the chat. Each rule links
// to the official document it comes from; the user's browser opens it, Taxpresso never does.
import type { JSX } from 'preact';
import './final-check.css';
import type { Language } from './i18n';
import { fck, type FinalCheckMessageKey, tf } from './i18n-final-check';
import type { State } from './types';
import type { FinalCheckItemState, FinalCheckSource } from './types-final-check';

const CHIP: Record<NonNullable<FinalCheckItemState['status']>, string> = {
  needs_ok: 'chip-needs-ok',
  estimate: 'chip-estimate',
  missing: 'chip-missing',
  fix: 'chip-fix',
};

const POSITION: Record<string, FinalCheckMessageKey> = {
  over: 'atLimit',
  at: 'atLimit',
  under: 'nearLimit',
  below: 'justBelow',
  above: 'justAbove',
};

/** Kinds shown first under "Good to know"; the others fold away. */
const SHOWN = new Set([
  'capital',
  'abroad',
  'property',
  'part_year',
  'limit',
  'best_figure',
  'official_pdf',
  'optional_document',
]);

function Sources({ sources, lang }: { sources: FinalCheckSource[]; lang: Language }) {
  if (!sources.length) return null;
  return (
    <p class="fc-sources small-text">
      <span class="muted">
        {tf(lang, sources.length > 1 ? 'sources' : 'source')}
        {tf(lang, 'colon')}
      </span>
      {sources.map((s, i) => {
        const label = `${s.title ?? s.id}, ${s.where}`;
        return (
          <span key={`${s.id}:${s.where}`}>
            {i ? '; ' : ''}
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer" lang="fr">
                {label}
              </a>
            ) : (
              <span lang="fr">{label}</span>
            )}
          </span>
        );
      })}
    </p>
  );
}

function Item({ item, lang }: { item: FinalCheckItemState; lang: Language }) {
  const position = item.limit ? POSITION[item.limit.position] : undefined;
  return (
    <li class="fc-item" data-kind={item.kind}>
      <div class="fc-head">
        <strong class="fc-title">{item.title}</strong>
        {item.status ? (
          <span class={`chip ${CHIP[item.status]}`}>{tf(lang, item.status)}</span>
        ) : position ? (
          <span class="chip chip-plain">{tf(lang, position)}</span>
        ) : null}
      </div>
      <p class="fc-detail">{item.detail}</p>
      {item.list?.length ? (
        <ul class="fc-list small-text">
          {item.list.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : null}
      {item.todo ? (
        <p class="fc-todo small-text">
          {item.status ? (
            <strong>
              {tf(lang, 'toSettle')}
              {tf(lang, 'colon')}
            </strong>
          ) : null}
          {item.todo}
        </p>
      ) : null}
      <Sources sources={item.sources} lang={lang} />
    </li>
  );
}

export function FinalCheck({ state, lang }: { state: State; lang: Language }): JSX.Element | null {
  const view = state.finalCheck;
  if (!view) return null;
  const ready = view.verdict === 'ready';
  const shown = view.know.filter((i) => SHOWN.has(i.kind));
  const folded = view.know.filter((i) => !SHOWN.has(i.kind));
  const share = new Intl.NumberFormat(`${lang}-CH`, { style: 'percent' }).format(
    view.margin.shareBp / 10_000,
  );
  return (
    <section class="card fc-card" aria-labelledby="fc-title">
      <div class="section-head">
        <h2 id="fc-title">{tf(lang, 'title')}</h2>
        <span class="muted small-text tnum">
          {tf(lang, 'summary', { fix: view.fix.length, know: view.know.length })}
        </span>
      </div>
      <p class="muted fc-lead">{tf(lang, 'lead')}</p>

      {ready ? (
        <div class="fc-verdict" role="status">
          <span class="chip chip-verified">{tf(lang, 'ready')}</span>
          <span>{tf(lang, 'readyLead')}</span>
        </div>
      ) : (
        <div class="fc-group">
          <h3 class="fc-group-title">
            {tf(lang, 'notReady')} <span class="muted tnum">{view.fix.length}</span>
          </h3>
          <p class="muted small-text fc-group-lead">{tf(lang, 'notReadyLead')}</p>
          <ol class="fc-items">
            {view.fix.map((i) => (
              <Item key={i.id} item={i} lang={lang} />
            ))}
          </ol>
          {view.moreTime ? (
            <p class="small-text fc-more-time">
              <a href={view.moreTime} target="_blank" rel="noopener noreferrer">
                {tf(lang, fck('moreTime', state.canton?.code))}
              </a>{' '}
              {tf(lang, 'moreTimeAfter')}
            </p>
          ) : null}
        </div>
      )}

      {view.know.length ? (
        <div class="fc-group">
          <h3 class="fc-group-title">
            {tf(lang, 'know')} <span class="muted tnum">{view.know.length}</span>
          </h3>
          <p class="muted small-text fc-group-lead">{tf(lang, 'knowLead')}</p>
          {shown.length ? (
            <ul class="fc-items">
              {shown.map((i) => (
                <Item key={i.id} item={i} lang={lang} />
              ))}
            </ul>
          ) : null}
          {folded.length ? (
            <details class="fc-more">
              <summary>{tf(lang, 'more', { n: folded.length })}</summary>
              <ul class="plain-list small-text fc-folded">
                {folded.map((i) => (
                  <li key={i.id}>
                    <strong>{i.title}</strong>
                    {tf(lang, 'colon')}
                    {i.detail}
                    {i.todo ? ` ${i.todo}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {view.know.some((i) => i.kind === 'limit') ? (
            <p class="muted small-text fc-near">
              {tf(lang, 'near', { share, min: view.margin.min / 100 })}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
