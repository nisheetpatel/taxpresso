// Small building blocks of the three pages: segmented buttons, a stepper, an amount field, "Why?",
// a button that asks Claude, and the icons. Real buttons and labels, 44 px targets (SPEC.md 11b).
import type { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';
import { askClaude } from './api';
import type { Language } from './i18n';
import { pg } from './i18n-pages';
import { parseFrancs } from './money';

/** Buttons of which one is chosen: the basics card's answers. */
export function Segmented({
  labelledBy,
  options,
  value,
  onPick,
  columns,
  suggested,
}: {
  labelledBy: string;
  options: { value: string; label: string }[];
  value: string | undefined;
  onPick: (value: string) => void;
  /** Buttons per row; by default all on one row. */
  columns?: number;
  /** A value read from last year, shown chosen until the user answers. */
  suggested?: string | undefined;
}): JSX.Element {
  return (
    <div
      class="seg"
      role="group"
      aria-labelledby={labelledBy}
      style={{ '--seg-cols': String(columns ?? options.length) }}
    >
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          class={`seg-btn${value === undefined && suggested === o.value ? ' seg-suggested' : ''}`}
          aria-pressed={value === o.value}
          onClick={() => onPick(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** − n +, for a count (children). */
export function Stepper({
  value,
  min,
  max,
  labelledBy,
  fewer,
  more,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  labelledBy: string;
  fewer: string;
  more: string;
  onChange: (value: number) => void;
}): JSX.Element {
  return (
    <div class="stepper" role="group" aria-labelledby={labelledBy}>
      <button
        type="button"
        class="step-btn"
        aria-label={fewer}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <output class="step-value tnum" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        class="step-btn"
        aria-label={more}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

/** A CHF amount, saved on blur or Enter; emptying it saves nothing. */
export function AmountInput({
  id,
  label,
  hideLabel = false,
  centimes,
  onSave,
  describedBy,
}: {
  id: string;
  label: string;
  hideLabel?: boolean;
  centimes: number | null;
  onSave: (francs: number) => void;
  describedBy?: string | undefined;
}): JSX.Element {
  const shown = centimes === null ? '' : String(Math.round(centimes / 100));
  const [text, setText] = useState(shown);
  const save = () => {
    const value = parseFrancs(text);
    if (value === null || value === undefined) return;
    if (centimes === null || value * 100 !== centimes) onSave(value);
  };
  return (
    <div class="amount">
      <label for={id} class={hideLabel ? 'sr-only' : 'field-label'}>
        {label}
      </label>
      <div class="amount-box">
        <span class="amount-unit" aria-hidden="true">
          CHF
        </span>
        <input
          id={id}
          class="tnum"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          aria-describedby={describedBy}
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </div>
    </div>
  );
}

/** "Why?": the explanation, sources and codes, closed (three-pages.md, principle 7). */
export function Why({
  lang,
  label,
  children,
}: {
  lang: Language;
  label?: string;
  children: ComponentChildren;
}): JSX.Element {
  return (
    <details class="why">
      <summary>{label ?? pg(lang, 'why')}</summary>
      <div class="why-body">{children}</div>
    </details>
  );
}

/**
 * A button that hands a request to Claude: as the user's message in the chat inside Claude
 * Desktop, otherwise copied for the user to paste (the page never calls a model, SPEC.md C1).
 */
export function AskClaude({
  text,
  label,
  primary = false,
  lang,
}: {
  text: string;
  label: string;
  primary?: boolean;
  lang: Language;
}): JSX.Element {
  const [done, setDone] = useState<'no' | 'sent' | 'copied' | 'failed'>('no');
  const ask = async () => {
    if (await askClaude(text)) return setDone('sent');
    try {
      await navigator.clipboard.writeText(text);
      setDone('copied');
    } catch {
      setDone('failed');
    }
  };
  return (
    <span class="ask-claude">
      <button type="button" class={primary ? 'primary' : 'ghost'} onClick={() => void ask()}>
        {label}
      </button>
      {done === 'sent' || done === 'copied' ? (
        <span class="small-text muted" role="status">
          {pg(lang, done === 'sent' ? 'asked' : 'copiedAsk')}
        </span>
      ) : done === 'failed' ? (
        <span class="small-text" role="status">
          {pg(lang, 'copyAskFallback')} <q>{text}</q>
        </span>
      ) : null}
    </span>
  );
}

const svg = (body: JSX.Element, size = 22, stroke = 1.8) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={stroke}
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {body}
  </svg>
);

export const Icon = {
  doc: () =>
    svg(
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
      </>,
    ),
  pen: () =>
    svg(
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </>,
    ),
  upload: () =>
    svg(
      <>
        <path d="M12 15V3" />
        <path d="m7 8 5-5 5 5" />
        <path d="M5 21h14" />
      </>,
      26,
    ),
  folder: () =>
    svg(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />, 20),
  lock: () =>
    svg(
      <>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>,
      15,
      2,
    ),
  arrow: () =>
    svg(
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>,
      18,
      2,
    ),
  back: () => svg(<path d="m15 18-6-6 6-6" />, 22, 2),
  check: () => svg(<path d="m5 12 5 5 9-10" />, 14, 3),
  dots: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  ),
};
