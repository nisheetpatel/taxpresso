// "Final check" (SPEC.md 10.0) as step 1 of "File" (three-pages.md, A6): before the user fills in
// the official form, what to fix first, one item at a time, and what is good to know, folded. The
// same list Claude gets from final_check. Settling an item happens where it lives ("Your tax"), or
// in the chat; each rule's official documents are behind "Why?".
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import './final-check.css';
import type { Language } from './i18n';
import { fck, tf } from './i18n-final-check';
import { pg } from './i18n-pages';
import { SourcesLine } from './Sources';
import type { FinalCheckItemState, FinalCheckState } from './types-final-check';
import { Icon, Why } from './ui';

/** Items settled on "Your tax": a value to OK, a document, a question, something to check. */
const ON_YOUR_TAX = new Set([
  'needs_ok',
  'missing_document',
  'documents_unread',
  'questions_open',
  'check',
  'estimate',
]);

function Item({ item, lang }: { item: FinalCheckItemState; lang: Language }) {
  return (
    <div class="fc-item" data-kind={item.kind}>
      <strong class="fc-title">{item.title}</strong>
      <p class="fc-detail">{item.detail}</p>
      {item.list?.length ? (
        <ul class="fc-list small-text">
          {item.list.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : null}
      {item.todo ? <p class="fc-todo small-text">{item.todo}</p> : null}
      {item.sources.length ? (
        <Why lang={lang}>
          <SourcesLine sources={item.sources} lang={lang} />
        </Why>
      ) : null}
    </div>
  );
}

/** The step's body for one position in the list: plain, so it renders the same anywhere. */
export function FinalCheckItems({
  view,
  index,
  lang,
  canton,
  onIndex,
  onGo,
}: {
  view: FinalCheckState;
  index: number;
  lang: Language;
  canton: string | undefined;
  onIndex: (index: number) => void;
  onGo: () => void;
}): JSX.Element {
  const fix = view.fix;
  const at = Math.min(Math.max(0, index), Math.max(0, fix.length - 1));
  const item = fix[at];
  return (
    <div class="fc-step">
      {view.verdict === 'ready' || !item ? (
        <p class="done-line" role="status">
          <span class="mark mark-done" aria-hidden="true">
            <Icon.check />
          </span>
          {pg(lang, 'step.ready')}
        </p>
      ) : (
        <div class="fc-one">
          {fix.length > 1 ? (
            <span class="small-text muted">
              {pg(lang, 'step.of', { n: at + 1, total: fix.length })}
            </span>
          ) : null}
          <Item item={item} lang={lang} />
          <div class="row-actions">
            {ON_YOUR_TAX.has(item.kind) ? (
              <button type="button" class="primary" onClick={onGo}>
                {pg(lang, 'step.go')}
              </button>
            ) : null}
            {fix.length > 1 ? (
              <>
                <button
                  type="button"
                  class="ghost"
                  disabled={at === 0}
                  onClick={() => onIndex(at - 1)}
                >
                  {pg(lang, 'previous')}
                </button>
                <button
                  type="button"
                  class="ghost"
                  disabled={at === fix.length - 1}
                  onClick={() => onIndex(at + 1)}
                >
                  {pg(lang, 'next')}
                </button>
              </>
            ) : null}
          </div>
          {view.moreTime ? (
            <p class="small-text">
              <a href={view.moreTime} target="_blank" rel="noopener noreferrer">
                {tf(lang, fck('moreTime', canton))}
              </a>{' '}
              {tf(lang, 'moreTimeAfter')}
            </p>
          ) : null}
        </div>
      )}
      {view.know.length ? (
        <details class="more">
          <summary>{pg(lang, 'step.know', { n: view.know.length })}</summary>
          <ul class="fc-know">
            {view.know.map((i) => (
              <li key={i.id}>
                <Item item={i} lang={lang} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/** Step 1 of "File": the final check's items to fix, one at a time. */
export function FinalCheckStep({
  view,
  lang,
  canton,
  onGo,
}: {
  view: FinalCheckState;
  lang: Language;
  canton: string | undefined;
  onGo: () => void;
}): JSX.Element {
  const [index, setIndex] = useState(0);
  return (
    <FinalCheckItems
      view={view}
      index={index}
      lang={lang}
      canton={canton}
      onIndex={setIndex}
      onGo={onGo}
    />
  );
}
