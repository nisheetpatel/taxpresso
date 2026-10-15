// The year switch, in the menu (docs/design/tax-years.md, three-pages.md).
// Choosing a year here is the same as asking Claude in the chat (open_tax_year): both open it in
// the extension (extension/src/years.ts) and write the same record.
import type { JSX } from 'preact';
import { api } from './api';
import type { Language } from './i18n';
import { ty } from './i18n-years';
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
