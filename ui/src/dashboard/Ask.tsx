// One question asked in place (three-pages.md, sections 2 and 3): "A few more questions", the
// follow-ups of a chip or a cost. A choice is answered with one tap; a number, an amount, a date,
// a commune or several choices with Save. A suggestion from last year is chosen until the user
// answers. The same answer as in the chat with Claude (answer_question).
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { t, type Language } from './i18n';
import { pg } from './i18n-pages';
import type { Question, Value } from './types';
import { Why } from './ui';

function initialDraft(q: Question): Value | undefined {
  const value = q.value ?? q.suggested;
  if (value === undefined)
    return q.type === 'multi' ? [] : q.type === 'number' ? (q.min ?? 0) : undefined;
  if (q.type === 'yesno') return value ? 'yes' : 'no';
  // Money arrives in centimes and is typed in francs.
  if (q.type === 'money' && typeof value === 'number') {
    const francs = String(Math.trunc(value / 100));
    const cents = value % 100;
    return cents ? `${francs}.${String(cents).padStart(2, '0')}` : francs;
  }
  return value;
}

export function AskOne({
  q,
  lang,
  busy,
  onAnswer,
  onSkip,
  note,
  showWho = true,
}: {
  q: Question;
  lang: Language;
  busy: boolean;
  onAnswer: (value: Value) => void;
  onSkip?: (() => void) | undefined;
  /** A line above the question, such as "2 of 5". */
  note?: string | undefined;
  /** Whose question it is, as a tag; off where the row above already says it. */
  showWho?: boolean;
}): JSX.Element {
  const [draft, setDraft] = useState<Value | undefined>(initialDraft(q));
  const [unsupported, setUnsupported] = useState<string | null>(null);
  const titleId = `ask-${q.id.replace(/[^\w-]/g, '-')}`;
  const tap = q.type === 'choice' || q.type === 'yesno';
  const options = q.options ?? [];
  const pick = (value: string) => {
    const option = options.find((o) => o.value === value);
    if (option?.notSupported && unsupported !== value) return setUnsupported(value);
    setDraft(value);
    onAnswer(q.type === 'yesno' ? value === 'yes' : value);
  };
  const ready = q.type === 'multi' ? Array.isArray(draft) : draft !== undefined && draft !== '';
  const submit = () => ready && draft !== undefined && onAnswer(draft);
  const chosen = (v: string) => (Array.isArray(draft) ? draft.includes(v) : draft === v);

  let control: JSX.Element;
  if (q.type === 'number') {
    const n = typeof draft === 'number' ? draft : (q.min ?? 0);
    const set = (v: number) => setDraft(Math.max(q.min ?? 0, Math.min(q.max ?? 99, v)));
    control = (
      <div class="stepper" role="group" aria-labelledby={titleId}>
        <button type="button" class="step-btn" aria-label="−1" onClick={() => set(n - 1)}>
          −
        </button>
        <output class="step-value tnum">{n}</output>
        <button type="button" class="step-btn" aria-label="+1" onClick={() => set(n + 1)}>
          +
        </button>
      </div>
    );
  } else if (q.type === 'money') {
    control = (
      <div class="amount-box">
        <span class="amount-unit" aria-hidden="true">
          CHF
        </span>
        <input
          class="tnum"
          inputMode="decimal"
          autoComplete="off"
          aria-labelledby={titleId}
          value={typeof draft === 'string' ? draft : ''}
          onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
    );
  } else if (q.type === 'date') {
    control = (
      <input
        class="date tnum"
        type="date"
        min={q.minDate}
        max={q.maxDate}
        aria-labelledby={titleId}
        value={typeof draft === 'string' ? draft : ''}
        onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
      />
    );
  } else if (q.type === 'commune') {
    control = (
      <select
        class="select"
        aria-labelledby={titleId}
        value={typeof draft === 'string' ? draft : ''}
        onChange={(e) => setDraft((e.target as HTMLSelectElement).value)}
      >
        <option value="" disabled>
          {t(lang, 'chooseCommune')}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (q.type === 'multi') {
    const list = Array.isArray(draft) ? draft : [];
    control = (
      <div class="options" role="group" aria-labelledby={titleId}>
        {options.map((o) => (
          <button
            type="button"
            key={o.value}
            class="option"
            aria-pressed={list.includes(o.value)}
            onClick={() =>
              setDraft(
                list.includes(o.value) ? list.filter((x) => x !== o.value) : [...list, o.value],
              )
            }
          >
            {o.label}
          </button>
        ))}
        <button
          type="button"
          class="option option-none"
          aria-pressed={list.length === 0 && q.value !== undefined}
          onClick={() => onAnswer([])}
        >
          {q.none ?? t(lang, 'none')}
        </button>
      </div>
    );
  } else {
    control = (
      <div
        class={`options${options.length <= 2 ? ' options-two' : ''}`}
        role="group"
        aria-labelledby={titleId}
      >
        {options.map((o) => (
          <button
            type="button"
            key={o.value}
            class="option"
            aria-pressed={chosen(o.value) && (q.value !== undefined || unsupported === o.value)}
            data-suggested={
              q.value === undefined && q.suggested !== undefined && chosen(o.value) ? '' : undefined
            }
            disabled={busy}
            onClick={() => pick(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div class="ask">
      {note ? <span class="ask-note small-text muted">{note}</span> : null}
      {q.who && showWho ? <span class="who">{q.who}</span> : null}
      <h3 id={titleId} class="ask-title">
        {q.text}
      </h3>
      {q.help ? <p class="ask-help muted">{q.help}</p> : null}
      {q.suggested !== undefined && q.value === undefined ? (
        <p class="ask-suggested small-text">{pg(lang, 'question.from')}</p>
      ) : null}
      {control}
      {unsupported ? (
        <div class="banner banner-estimate" role="note">
          <p>{pg(lang, 'question.unsupported')}</p>
          <button type="button" class="ghost small" onClick={() => pick(unsupported)}>
            {pg(lang, 'special.applies')}
          </button>
        </div>
      ) : null}
      <div class="ask-actions">
        {!tap ? (
          <button type="button" class="primary" disabled={!ready || busy} onClick={submit}>
            {pg(lang, 'save')}
          </button>
        ) : null}
        {onSkip ? (
          <button type="button" class="link" disabled={busy} onClick={onSkip}>
            {pg(lang, 'skip')}
          </button>
        ) : null}
        {q.explain || q.learnMore ? (
          <Why lang={lang}>
            {q.explain ? <p>{q.explain}</p> : null}
            {q.learnMore ? (
              <p>
                <a href={q.learnMore.url} target="_blank" rel="noopener noreferrer">
                  {q.learnMore.label}
                </a>
              </p>
            ) : null}
          </Why>
        ) : null}
      </div>
    </div>
  );
}
