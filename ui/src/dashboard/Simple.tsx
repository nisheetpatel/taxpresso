// Simple first (docs/design/simple.md): the one next step at the top, then the five stages, one
// open, each other one a single line with its status. The step and the stages come from the
// extension (extension/src/journey.ts), the same as Claude's get_status; this page only words them.
import './simple.css';
import type { ComponentChildren, JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { api, askClaude, embedded } from './api';
import { t, type Language } from './i18n';
import { day, pck, tp } from './i18n-planning';
import { isJourneyKey, tj } from './i18n-journey';
import type { JourneyVars, StageId, State } from './types';

type Act = (fn: () => Promise<State>, label?: string) => Promise<boolean>;

/** Whole francs, as the stage lines and the savings say them ("about CHF 2,140"). */
export function francs(centimes: number, lang: Language): string {
  return new Intl.NumberFormat(`${lang}-CH`, {
    style: 'currency',
    currency: 'CHF',
    maximumFractionDigits: 0,
  }).format(Math.round(centimes / 100));
}

/** Savings are said to the nearest CHF 10, as on the 3a card. */
const aboutChf = (centimes: number, lang: Language) =>
  francs(Math.round(centimes / 1000) * 1000, lang);

function words(
  vars: JourneyVars,
  lang: Language,
  rounded = false,
): Record<string, string | number> {
  return {
    ...(vars.n !== undefined ? { n: vars.n } : {}),
    ...(vars.year !== undefined ? { year: vars.year } : {}),
    ...(vars.amount !== undefined
      ? { amount: rounded ? aboutChf(vars.amount, lang) : francs(vars.amount, lang) }
      : {}),
    ...(vars.date !== undefined ? { date: day(vars.date, lang) } : {}),
    ...(vars.capital !== undefined ? { capital: francs(vars.capital, lang) } : {}),
  };
}

/** "Answer 3 more questions", or its one-question form. */
const ONE = new Set(['read', 'questions', 'confirm', 'checks', 'documents']);

export function nextSentence(state: State, lang: Language): string {
  const { id, vars } = state.journey.next;
  let key = `next.${id}`;
  if (ONE.has(id) && vars.n === 1) key += 'One';
  if (id === 'save' && vars.amount === undefined) key = 'next.saveTou';
  if (id === 'canton') return tj(lang, 'next.canton', { year: state.taxYear });
  return isJourneyKey(key) ? tj(lang, key, words(vars, lang, id === 'save')) : '';
}

/** A stage's one line, in the page's language. */
export function stageLine(state: State, id: StageId, lang: Language): string {
  const s = state.journey.stages.find((x) => x.id === id);
  if (!s) return '';
  if (id === 'file' && s.status === 'open' && state.finalCheck) {
    const fix = state.finalCheck.fix.length;
    return fix ? tj(lang, 'line.file.fix', { n: fix }) : tj(lang, 'line.file.ready');
  }
  // What is missing, by name, so the panel answers "what's missing?" at a glance.
  if (id === 'documents' && (s.status === 'missing' || s.status === 'later')) {
    const names = [
      ...new Set(
        state.requirements.filter((r) => r.status === 'missing' && !r.optional).map((r) => r.label),
      ),
    ];
    if (names.length) {
      const list =
        names.length > 2
          ? tj(lang, 'andMore', { list: names.slice(0, 2).join(', '), n: names.length - 2 })
          : names.join(', ');
      return tj(
        lang,
        s.status === 'missing' ? 'line.documents.missingList' : 'line.documents.laterList',
        {
          list,
          year: state.taxYear,
        },
      );
    }
  }
  let key = `line.${id}.${s.status}`;
  if (id === 'about' && s.status === 'open' && s.vars.n === 1) key = 'line.about.openOne';
  // The tax on pension capital is its own line, never in the total.
  if (id === 'tax' && s.vars.capital !== undefined) key += 'Capital';
  return isJourneyKey(key) ? tj(lang, key, words(s.vars, lang, id === 'save')) : '';
}

/** What a stage line says about its state: nothing to do, something to do, or later. */
function tone(state: State, id: StageId): 'done' | 'todo' | 'wait' {
  const status = state.journey.stages.find((x) => x.id === id)?.status;
  if (status === 'done' || status === 'computed' || status === 'estimate') return 'done';
  if (status === 'waiting' || status === 'later' || status === 'ask' || status === 'empty')
    return 'wait';
  return 'todo';
}

/**
 * A button that hands a request to Claude: as the user's message in the chat when the dashboard
 * runs inside it, otherwise copied for the user to paste (the page never calls a model, C1).
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
}) {
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
      {done === 'sent' ? (
        <span class="small-text muted" role="status">
          {tj(lang, 'asked')}
        </span>
      ) : done === 'copied' ? (
        <span class="small-text muted" role="status">
          {tj(lang, 'copiedAsk')}
        </span>
      ) : done === 'failed' ? (
        <span class="small-text" role="status">
          {tj(lang, 'copyAskFallback')} <q>{text}</q>
        </span>
      ) : null}
    </span>
  );
}

/** The one next step, with the button that does it. */
export function NextStep({
  state,
  lang,
  act,
  onOpen,
}: {
  state: State;
  lang: Language;
  act: Act;
  onOpen: (stage: StageId) => void;
}): JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const { id, stage } = state.journey.next;
  const add = async (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      await act(() => api.upload(file, lang), t(lang, 'uploading', { name: file.name }));
    }
  };
  // The chat leads (docs/design/simple.md): the panel shows the step as Claude says it, with a
  // button only for what is easier by hand, adding documents.
  const byHand = id === 'start' || id === 'prior' || id === 'documents' || id === 'later';
  const actions: ComponentChildren = byHand ? (
    embedded() ? (
      <p class="muted small-text">
        {tj(lang, 'next.folder.where')} <span class="tnum drop-path">{state.vault.path}</span>
      </p>
    ) : (
      <button type="button" class="primary" onClick={() => input.current?.click()}>
        {tj(lang, 'go.add')}
      </button>
    )
  ) : null;
  return (
    <section class="next-card" aria-labelledby="next-title">
      <span class="next-label">{tj(lang, 'nextLabel')}</span>
      <h2 id="next-title" class="next-text">
        {id === 'folder'
          ? (state.vault.problem ?? nextSentence(state, lang))
          : nextSentence(state, lang)}
      </h2>
      {actions ? <div class="next-actions">{actions}</div> : null}
      {stage === null ? null : (
        <button type="button" class="link next-stage" onClick={() => onOpen(stage)}>
          {tj(lang, `stage.${stage}`)}
        </button>
      )}
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const el = e.target as HTMLInputElement;
          void add(el.files).then(() => (el.value = ''));
        }}
      />
    </section>
  );
}

/** One stage: its number, title and one line; its content when open. */
export function StageCard({
  state,
  id,
  n,
  lang,
  open,
  onToggle,
  children,
}: {
  state: State;
  id: StageId;
  n: number;
  lang: Language;
  open: boolean;
  onToggle: () => void;
  children: ComponentChildren;
}): JSX.Element {
  const line = stageLine(state, id, lang);
  const mood = tone(state, id);
  const estimate =
    id === 'tax' && state.journey.stages.find((s) => s.id === 'tax')?.status === 'estimate';
  return (
    <section
      id={`stage-${id}`}
      class={`stage card${open ? ' stage-open' : ''}${state.journey.stage === id ? ' stage-active' : ''}`}
      aria-labelledby={`stage-${id}-title`}
    >
      <button
        type="button"
        class="stage-head"
        aria-expanded={open}
        aria-controls={`stage-${id}-body`}
        onClick={onToggle}
      >
        <span class={`stage-num stage-num-${mood}`} aria-hidden="true">
          {mood === 'done' ? '✓' : n}
        </span>
        <span class="stage-titles">
          <span id={`stage-${id}-title`} class="stage-title">
            {tj(lang, `stage.${id}`)}
          </span>
          {line ? <span class={`stage-line stage-line-${mood}`}>{line}</span> : null}
        </span>
        {estimate ? <span class="chip chip-estimate">{tp(lang, 'estimate')}</span> : null}
        {state.journey.next.stage === id ? (
          <span class="chip chip-now">{tj(lang, 'now')}</span>
        ) : null}
        <span class="stage-toggle" aria-hidden="true">
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? (
        <div id={`stage-${id}-body`} class="stage-body">
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** "About you": the facts that need no decision, as sentences. */
export function Facts({
  state,
  lang,
  onOpen,
}: {
  state: State;
  lang: Language;
  onOpen: (stage: StageId) => void;
}): JSX.Element | null {
  const facts = state.journey.about;
  if (!facts.length) return null;
  return (
    <ul class="facts">
      {facts.map((f) => {
        const key = `fact.${f.id}`;
        const text =
          f.id === 'tou_already'
            ? tj(lang, `fact.tou_already.${f.who ?? 'p1'}`)
            : f.id === 'tou_geneva_only'
              ? tp(lang, pck('touGenevaOnly', state.canton?.code))
              : isJourneyKey(key)
                ? tj(lang, key, words(f.vars, lang))
                : '';
        if (!text) return null;
        return (
          <li key={f.id} class="fact">
            <span>{text}</span>
            {f.id === 'tou_chosen_request' || f.id === 'tou_chosen_decline' ? (
              <button type="button" class="link" onClick={() => onOpen('save')}>
                {tj(lang, 'changeChoice')}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** "Ways to save": the one-line total, or what Claude can do instead. */
export function SaveHeadline({ state, lang }: { state: State; lang: Language }): JSX.Element {
  const s = state.journey.savings;
  if (!s) {
    return (
      <div class="save-head card">
        <p class="save-ask">{tj(lang, 'save.ask')}</p>
        <AskClaude text={tj(lang, 'ask.lower')} label={tj(lang, 'go.askHow')} primary lang={lang} />
      </div>
    );
  }
  const parts = s.parts.map((p) => tj(lang, `part.${p}`)).join(', ');
  return (
    <div class="save-head card">
      <div class="save-total">
        <strong>{tj(lang, 'save.total', { amount: aboutChf(s.totalCentimes, lang) })}</strong>
        <span class="chip chip-estimate">{tp(lang, 'estimate')}</span>
      </div>
      <p class="muted small-text">
        {tj(lang, 'save.split', {
          icc: francs(s.cantonalCentimes, lang),
          ifd: francs(s.federalCentimes, lang),
        })}
      </p>
      {parts ? <p class="small-text">{tj(lang, 'save.what', { parts })}</p> : null}
      {s.onlyWithTou ? <p class="banner banner-estimate">{tp(lang, 'onlyWithTou')}</p> : null}
      <AskClaude text={tj(lang, 'ask.lower')} label={tj(lang, 'go.askHow')} lang={lang} />
    </div>
  );
}

/** One collapsed detail of "Ways to save": its title and figure on one line. */
export function Detail({
  title,
  figure,
  children,
}: {
  title: string;
  figure?: string | undefined;
  children: ComponentChildren;
}): JSX.Element {
  return (
    <details class="detail card">
      <summary>
        <span class="detail-title">{title}</span>
        {figure ? <span class="detail-figure tnum">{figure}</span> : null}
      </summary>
      <div class="detail-body">{children}</div>
    </details>
  );
}

/** "Your tax" before any income: what makes it appear, and a way to give a rough salary. */
export function TaxWaiting({
  state,
  lang,
  act,
}: {
  state: State;
  lang: Language;
  act: Act;
}): JSX.Element {
  const inputs = state.plan?.inputs ?? [];
  return (
    <div class="tax-waiting card">
      <p>{tj(lang, 'tax.waiting')}</p>
      <div class="next-actions">
        <AskClaude text={tj(lang, 'ask.income')} label={tj(lang, 'go.ask')} primary lang={lang} />
      </div>
      {inputs.length && !state.yearOver ? (
        <details class="change">
          <summary>{tj(lang, 'go.addHere')}</summary>
          <div class="change-body">
            {inputs.map((i) => (
              <SalaryField
                key={i.person}
                person={i.person}
                couple={inputs.length > 1}
                gross={i.gross}
                lang={lang}
                act={act}
              />
            ))}
            <p class="muted small-text">{tj(lang, 'tax.salaryNote')}</p>
          </div>
        </details>
      ) : null}
    </div>
  );
}

function SalaryField({
  person,
  couple,
  gross,
  lang,
  act,
}: {
  person: 'p1' | 'p2';
  couple: boolean;
  gross: number | null;
  lang: Language;
  act: Act;
}) {
  const [text, setText] = useState(gross ? String(Math.round(gross / 100)) : '');
  const save = () => {
    const n = Number(text.replace(/[’'\s,]/g, '').replace(/^chf/i, ''));
    if (!Number.isFinite(n) || n < 0 || text.trim() === '') return;
    if (gross !== null && Math.round(n) * 100 === gross) return;
    void act(() => api.plan(person, 'gross', Math.round(n), lang));
  };
  const id = `salary-${person}`;
  return (
    <div class="pl-field">
      <label for={id}>
        {couple ? `${t(lang, person === 'p2' ? 'p2Short' : 'p1Short')} · ` : ''}
        {tj(lang, 'tax.salary')}
      </label>
      <input
        id={id}
        class="tnum"
        inputMode="numeric"
        placeholder="CHF"
        value={text}
        onInput={(e) => setText((e.target as HTMLInputElement).value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
    </div>
  );
}
