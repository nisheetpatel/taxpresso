// The tax estimate, for Claude (compute_tax) and for the dashboard ("Your estimate"), for any
// canton. Every figure comes from the canton's rules engine (packages/rules-<c>, with the federal
// tax and the shared shapes of @taxpresso/rules-ch, SPEC.md section 7); the canton's words and
// lines come from its result view (rules-ch, view.ts: rules-ge's, rules-zh's... `view`). Nothing is
// computed here and nothing here is a canton's own. Concise by default (C6), the explanation tree
// with `detail`.
import {
  chf,
  type CapitalView,
  type Item,
  type Line,
  type ResultView,
  type Text,
  type ViewLine,
  type YearComparisonRow,
} from '@taxpresso/rules-ch';
import { contentLang, say, type UiLang } from './lang.js';
import type { Workspace } from './workspace.js';

const WHO: Record<string, Text> = {
  p1: { en: 'you', fr: 'vous', de: 'du', it: 'tu' },
  p2: { en: 'your spouse', fr: 'votre conjoint', de: 'dein Partner', it: 'il tuo coniuge' },
  household: { en: 'household', fr: 'ménage', de: 'Haushalt', it: 'economia domestica' },
};

/** The largest items first, at most `n`, shown in the order of the form. */
function mainItems(items: readonly Item[], n: number): Item[] {
  const top = [...items].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, n);
  return items.filter((i) => top.includes(i));
}

const flags = (line: Line) => ({
  ...(line.estimates?.length ? { estimate: true } : {}),
  ...(line.needsOk ? { needsOk: true } : {}),
});

function itemOut(view: ResultView, i: Item) {
  return {
    code: i.code,
    person: i.person,
    amount: i.amount,
    label: view.term(i),
    how: i.how.en,
    sources: i.sources,
    ...flags(i),
  };
}

function lineOut({ id, line: l }: ViewLine) {
  return {
    id,
    amount: l.amount,
    label: l.label.en,
    how: l.how.en,
    sources: l.sources,
    ...flags(l),
  };
}

const en = (list: readonly Text[]) => list.map((x) => x.en);

const PERSON: Record<YearComparisonRow['person'], Text> = {
  A: { en: 'you', fr: 'vous' },
  B: { en: 'your spouse', fr: 'votre conjoint' },
  household: { en: 'household', fr: 'ménage' },
};

/** "CHF 7'258.00" or "-" when a column is not there. */
const money = (n: number | undefined) => (n === undefined ? '-' : chf(n));

/** One row of the comparison, in plain words, for Claude. */
function lastYearText(x: YearComparisonRow): string {
  const col = (k: 'icc' | 'ifd', name: string) =>
    x.lastYear[k] === undefined && x.thisYear[k] === undefined
      ? ''
      : `${name} ${money(x.lastYear[k])} last year, ${money(x.thisYear[k])} now`;
  const cols = [col('icc', 'ICC'), col('ifd', 'IFD')].filter(Boolean).join('; ');
  return `${x.code} ${x.official} (${PERSON[x.person].en}): ${cols}${x.lastYearNeedsOk ? ' [last year read, not checked by the user]' : ''}${x.thisYearProvisional ? ' [this year not final]' : ''}`;
}

/** The tax on pension capital, for Claude: the amount, each tax, and that it is apart. */
function capitalText(c: CapitalView, items: readonly Item[]): string {
  const each = items
    .map(
      (i) =>
        `${i.code} (${WHO[i.person]?.en ?? i.person}) ${chf(i.amount)}${i.needsOk ? " [needs the user's OK]" : ''}`,
    )
    .join('; ');
  const taxes = c.rows.map((row) => `${row.label.en} ${chf(row.line.amount)}`).join(', ');
  return `${c.amount.label.en}: ${chf(c.amount.line.amount)} (${each}). A tax of its own, apart from the tax on income, at a fifth of the scale, never in the total${taxes ? `: ${taxes}` : ': not computed (see "Not computed")'}${c.total ? `; together ${chf(c.total.line.amount)}` : ''}.`;
}

/** The canton's result and its view, or why there is none. */
function current(ws: Workspace) {
  const e = ws.estimate();
  return { e, view: e.entry?.view, result: e.result };
}

/** compute_tax: text for Claude and the structured result. */
export function computeTaxOutput(ws: Workspace, detail: boolean) {
  const { e, view, result: r } = current(ws);
  const { missing, notes } = e;
  const tag = view?.preview ? { canton: view.canton } : {};
  const notSupported = ws.engine.notSupported(ws.snapshot()).map((n) => n.what.en);
  if (!r || !view) {
    const text = `No tax computed yet: Taxpresso needs ${missing.map((m) => m.en).join(' and ')}. Ask with next_questions.`;
    return {
      text,
      structured: {
        taxYear: ws.config.taxYear,
        ...tag,
        computed: false,
        missing: en(missing),
      } as Record<string, unknown>,
    };
  }
  const icc = r.icc;
  const ifd = r.ifd;
  const say: string[] = [];
  const estimated = r.estimates.length > 0;
  say.push(
    `Tax year ${r.taxYear}, ${view.where(r)}. ${estimated ? 'An estimate: see "Estimates" below.' : 'From official values only.'}${view.previewNote ? ` ${view.previewNote}` : ''}`,
  );
  if (icc) say.push(...view.cantonal(icc));
  if (ifd) {
    say.push(
      `${view.federal.name}: ${chf(ifd.tax.amount)}, on a taxable income of ${chf(ifd.taxableIncome.amount)} (${ifd.scale} scale)${view.federal.from}.`,
    );
  }
  if (r.total !== null) say.push(`Total: ${chf(r.total)}.`);
  const capital = view.capital?.(r);
  if (capital && r.capital) say.push(capitalText(capital, r.capital.items));
  const items = icc ? mainItems(icc.items, 8) : [];
  if (items.length) {
    say.push(
      `${view.mainItems}: ${items.map((i) => `${i.code} ${view.term(i)} (${WHO[i.person]?.en ?? i.person}) ${chf(i.amount)}${i.estimates?.length ? ' [estimate]' : ''}${i.needsOk ? " [needs the user's OK]" : ''}`).join('; ')}.`,
    );
  }
  const lastYear = view.lastYear?.(r, ws.countedFacts()) ?? [];
  if (lastYear.length) {
    say.push(
      'Compared with last year (read from last year’s declaration; comparison only, never part of this year’s calculation):',
      ...lastYear.map((x) => `- ${lastYearText(x)}`),
    );
  }
  if (r.estimates.length) say.push(`Estimates: ${r.estimates.map((x) => x.what.en).join(' ')}`);
  if (!r.complete) {
    say.push(
      `Not final: some amounts are known only in part, so these taxes are at least what is shown. ${en(r.incomplete).join(' ')}`,
    );
  }
  if (r.needsOk) {
    say.push(
      `${r.needsOk} item${r.needsOk === 1 ? '' : 's'} rest on values that still need the user's OK (dashboard, Documents).`,
    );
  }
  if (r.unsupported.length) say.push(`Not computed: ${en(r.unsupported).join(' ')}`);
  if (notSupported.length) {
    say.push(`Not supported yet, so left out: ${notSupported.join('; ')}.`);
  }
  if (r.notCounted.length) say.push(`Not counted: ${en(r.notCounted).join(' ')}`);
  if (r.assumptions.length || notes.length) {
    say.push(`Assumptions: ${[...en(r.assumptions), ...en(notes)].join(' ')}`);
  }
  if (r.unverifiedRules.length) {
    say.push(`Rules the documents don't spell out: ${en(r.unverifiedRules).join(' ')}`);
  }
  const structured: Record<string, unknown> = {
    taxYear: r.taxYear,
    ...tag,
    commune: r.commune,
    computed: true,
    missing: [],
    total: r.total,
    icc: icc && view.structured(icc),
    ifd: ifd && { tax: ifd.tax.amount, taxableIncome: ifd.taxableIncome.amount, scale: ifd.scale },
    estimates: r.estimates.map((x) => x.what.en),
    needsOk: r.needsOk,
    notCounted: en(r.notCounted),
    assumptions: [...en(r.assumptions), ...en(notes)],
    unsupported: en(r.unsupported),
    notSupported,
    unverifiedRules: en(r.unverifiedRules),
    ...(capital && r.capital
      ? {
          capital: {
            amount: capital.amount.line.amount,
            items: r.capital.items.map((i) => ({
              code: i.code,
              person: i.person,
              amount: i.amount,
            })),
            icc: r.capital.icc?.tax.amount ?? null,
            ifd: r.capital.ifd?.tax.amount ?? null,
            total: capital.total?.line.amount ?? null,
          },
        }
      : {}),
    complete: r.complete,
    ...(r.incomplete.length ? { incomplete: en(r.incomplete) } : {}),
    ...(lastYear.length
      ? {
          lastYear: lastYear.map((x) => ({
            code: x.code,
            form: x.form,
            person: x.person,
            label: x.official,
            lastYear: x.lastYear,
            thisYear: x.thisYear,
            change: x.change,
            lastYearNeedsOk: x.lastYearNeedsOk,
            thisYearProvisional: x.thisYearProvisional,
          })),
        }
      : {}),
  };
  if (detail) {
    const lines = view.lines(r).map(lineOut);
    const wealth = icc ? view.wealthItems(icc) : [];
    structured.detail = {
      iccItems: (icc?.items ?? []).map((i) => itemOut(view, i)),
      wealthItems: wealth.map((i) => itemOut(view, i)),
      ifdItems: (ifd?.items ?? []).map((i) => itemOut(view, i)),
      lines,
    };
    const all = [
      ...(icc ? [...icc.items, ...wealth] : []),
      ...(ifd ? ifd.items.map((i) => ({ ...i, code: `${view.ifdCode} ${i.code}` })) : []),
      ...(r.capital?.items ?? []),
    ];
    if (r.capital) {
      (structured.detail as Record<string, unknown>).capitalItems = r.capital.items.map((i) =>
        itemOut(view, i),
      );
    }
    say.push(
      `Detail, each item with how it was computed and its source${view.detailNote}:`,
      ...all.map(
        (i) =>
          `- ${i.code} ${view.term(i)} (${WHO[i.person]?.en ?? i.person}): ${chf(i.amount)}. ${i.how.en} [${i.sources.join('; ')}]`,
      ),
      ...lines
        .filter((l) => view.detailLines.test(l.id))
        .map((l) => `- ${l.label}: ${chf(l.amount)}. ${l.how} [${l.sources.join('; ')}]`),
    );
  } else {
    say.push(
      'For how each figure was computed and its source, call compute_tax with detail: true.',
    );
  }
  return { text: say.join('\n'), structured };
}

/** "Your estimate" in the dashboard, in the UI language. */
export function estimateView(ws: Workspace, lang: UiLang) {
  const { e, view, result: r } = current(ws);
  // A canton without German (or Italian) content shows English on a German (or Italian) page
  // (./lang.ts).
  const own = (lang === 'de' && view?.german) || (lang === 'it' && view?.italian);
  const l: UiLang = own ? lang : contentLang(lang);
  if (!r || !view) return { computed: false as const, missing: e.missing.map((m) => say(m, l)) };
  const icc = r.icc;
  const ifd = r.ifd;
  const row = ({ id, label, line }: { id: string; label: Text; line: Line }) => ({
    id,
    label: say(label, l),
    amount: line.amount,
    estimate: Boolean(line.estimates?.length),
    needsOk: Boolean(line.needsOk),
  });
  const couple = ws.snapshot().people.length > 1;
  const capital = view.capital?.(r);
  return {
    computed: true as const,
    ...(view.preview ? { canton: view.canton } : {}),
    taxYear: r.taxYear,
    total: r.total,
    estimate: r.estimates.length > 0,
    rows: view.rows(r).map(row),
    parts: view.parts(r).map(row),
    taxable: {
      icc: icc?.taxableIncome.amount ?? null,
      ifd: ifd?.taxableIncome.amount ?? null,
      wealth: icc?.wealth.taxableWealth.amount ?? null,
    },
    items: (icc ? mainItems(icc.items, 8) : []).map((i) => ({
      code: i.code,
      label: say(i.label, l),
      who: i.person !== 'household' && couple ? say(WHO[i.person] ?? WHO.household!, l) : '',
      amount: i.amount,
      how: say(i.how, l),
      estimate: Boolean(i.estimates?.length),
      needsOk: Boolean(i.needsOk),
    })),
    // The tax on pension capital: a tax of its own, apart from the total (only when there is one).
    ...(capital && r.capital
      ? {
          capital: {
            amount: row(capital.amount),
            rows: capital.rows.map(row),
            total: capital.total ? row(capital.total) : null,
            items: r.capital.items.map((i) => ({
              code: i.code,
              label: say(i.label, l),
              who: couple ? say(WHO[i.person] ?? WHO.household!, l) : '',
              amount: i.amount,
              how: say(i.how, l),
              estimate: Boolean(i.estimates?.length),
              needsOk: Boolean(i.needsOk),
            })),
          },
        }
      : {}),
    estimates: r.estimates.map((x) => say(x.what, l)),
    needsOk: r.needsOk,
    notes: [...r.unsupported, ...r.incomplete, ...r.notCounted].map((n) => say(n, l)),
    complete: r.complete,
    // A preview canton: the rules the documents don't spell out, and what was assumed.
    ...(view.preview
      ? {
          unverified: r.unverifiedRules.map((n) => say(n, l)),
          assumptions: [...r.assumptions, ...e.notes].map((n) => say(n, l)),
        }
      : {}),
    lastYear: (view.lastYear?.(r, ws.countedFacts()) ?? []).map((x) => ({
      code: x.code,
      label: say(x.label, l),
      official: x.official,
      who: couple && x.person !== 'household' ? say(PERSON[x.person], l) : '',
      lastYear: x.lastYear,
      thisYear: x.thisYear,
      provisional: x.lastYearNeedsOk || x.thisYearProvisional,
    })),
  };
}

export type EstimateView = ReturnType<typeof estimateView>;
