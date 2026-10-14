// The year switch in the header and the card of a tax year that is over (docs/design/tax-years.md).
// Choosing a year here is the same as asking Claude in the chat (open_tax_year): both open it in
// the extension (extension/src/years.ts) and write the same record.
import type { JSX } from 'preact';
import { api } from './api';
import type { Language } from './i18n';
import { ty } from './i18n-years';
import { day } from './i18n-planning';
import { SourceTaxFacts } from './Planning';
import type { State } from './types';

type Act = (fn: () => Promise<State>, label?: string) => Promise<boolean>;

/** "2025 (Geneva only)" when the year has fewer cantons than another. */
function yearLabel(state: State, y: State['years'][number], lang: Language): string {
  const most = Math.max(...state.years.map((x) => x.cantons.length));
  if (y.cantons.length >= most) return String(y.year);
  const names = y.cantons.map((c) => c.name).join(', ');
  return ty(lang, 'only', { year: y.year, cantons: names });
}

export function YearSwitch({
  state,
  lang,
  act,
  busy,
}: {
  state: State;
  lang: Language;
  act: Act;
  busy: boolean;
}): JSX.Element {
  return (
    <span class="year-switch">
      <label for="year-select" class="sr-only">
        {ty(lang, 'label')}
      </label>
      <select
        id="year-select"
        class="pill year-select"
        value={String(state.taxYear)}
        disabled={busy || state.years.length < 2}
        onChange={(e) => {
          const year = Number((e.target as HTMLSelectElement).value);
          if (year !== state.taxYear) void act(() => api.year(year, lang), 'year');
        }}
      >
        {state.years.map((y) => (
          <option key={y.year} value={String(y.year)}>
            {`${ty(lang, 'label')} ${yearLabel(state, y, lang)}`}
          </option>
        ))}
      </select>
      {state.canton ? <span class="pill">{state.canton.name}</span> : null}
    </span>
  );
}

/**
 * Instead of the plans before 31 December, for a year that is over: they are the default year's,
 * one click away, like asking Claude to switch (open_tax_year).
 */
export function YearOverCard({
  state,
  lang,
  act,
  busy,
}: {
  state: State;
  lang: Language;
  act: Act;
  busy: boolean;
}): JSX.Element | null {
  const over = state.yearOver;
  if (!over) return null;
  const year = over.year;
  const plans = over.plansIn;
  const canOpen = state.years.some((y) => y.year === plans);
  const sources = [
    over.paidInYear,
    ...(over.catchUp?.sources ?? []),
    ...(over.tou ? [over.tou.source] : []),
  ];
  return (
    <section class="plan plan-over" aria-labelledby="year-over-title">
      <span class="plan-when">{ty(lang, 'overWhen', { year })}</span>
      <h2 id="year-over-title">{ty(lang, 'overTitle', { plans })}</h2>
      <p>{ty(lang, 'overLead', { year, plans })}</p>
      {over.catchUp ? <p>{ty(lang, 'catchUp', { year, plans })}</p> : null}
      {canOpen ? (
        <p>
          <button
            type="button"
            class="primary"
            disabled={busy}
            onClick={() => void act(() => api.year(plans, lang), 'year')}
          >
            {ty(lang, 'openPlans', { plans })}
          </button>
        </p>
      ) : null}
      {over.tou ? (
        <p>
          {ty(lang, 'tou', { year, deadline: day(over.tou.deadline, lang) })}{' '}
          {over.tou.passed ? `${ty(lang, 'touPassed')} ` : ''}
          {over.tou.decision
            ? ty(lang, over.tou.decision.choice === 'request' ? 'touRequested' : 'touDeclined')
            : ty(lang, 'touOrdinary', { year })}
        </p>
      ) : null}
      <SourceTaxFacts state={state} lang={lang} />
      <details class="plan-how">
        <summary>{ty(lang, 'sources')}</summary>
        <p class="tnum">{sources.join(' · ')}</p>
      </details>
    </section>
  );
}
