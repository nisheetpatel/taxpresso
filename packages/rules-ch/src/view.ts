// How a canton's result reads (docs/design/cantons.md, section 2): the words and the lines a
// canton gives so that one generic view shows any canton's tax, for Claude (compute_tax) and the
// dashboard ("Your estimate"), and so that the final check and the plans read it alike. Types only:
// each canton's rules package exports its own (rules-ge, rules-zh, rules-be: `view`); the extension
// renders them (extension/src/estimate.ts) and never needs a module per canton.
import type { Fact } from '@taxpresso/ledger';
import type { CantonCode } from './canton.js';
import type { Item, Line, TaxResult, Text } from './core/types.js';

/** A line of a result with the label it has in a view: a tax, a part of one. */
export interface ViewRow {
  id: string;
  label: Text;
  line: Line;
}

/** A computed line of a result with a stable id, for the explanation tree (compute_tax detail). */
export interface ViewLine {
  id: string;
  line: Line;
}

/** Last year's line next to this year's, per column (cantonal, federal). */
export interface YearPair {
  icc?: number;
  ifd?: number;
}

/** One line of the comparison with last year's declaration: comparison only, never filed. */
export interface YearComparisonRow {
  form: string;
  code: string;
  person: 'A' | 'B' | 'household';
  label: Text;
  official: string;
  lastYear: YearPair;
  thisYear: YearPair;
  change: YearPair;
  lastYearNeedsOk: boolean;
  thisYearProvisional: boolean;
}

/** The tax on pension capital, as the views show it. */
export interface CapitalView {
  /** The lump sums of the year added up, with the official term of the form's line. */
  amount: ViewRow;
  /** One row per tax computed: cantonal and communal, federal. */
  rows: ViewRow[];
  /** Both taxes together, when both are computed. */
  total: ViewRow | null;
}

/** The income tax a deduction changes, in centimes: what the plans compare with and without. */
export interface IncomeTax {
  cantonalCentimes: number;
  federalCentimes: number;
  totalCentimes: number;
}

/**
 * A canton's result in words and lines. `R` is the canton's own result; `Icc` its cantonal part.
 * Texts for Claude are English with the official terms of the canton's form in parentheses; texts
 * for the dashboard are `Text` (English, French, German where the canton gives it).
 */
export interface ResultView<R extends TaxResult = TaxResult> {
  canton: CantonCode;
  /**
   * A preview canton: its views carry the canton's code, and the dashboard lists the rules its
   * documents don't spell out and what was assumed. Geneva's views predate the cantons: false.
   */
  preview: boolean;
  /** The canton's content has German texts (its form is German); otherwise English on a German page. */
  german: boolean;

  // ---- compute_tax, for Claude --------------------------------------------------------------
  /** Where the return is: "commune geneve", "canton of Zurich, commune Winterthur (BFS 230, ...)". */
  where(r: R): string;
  /** Said after the estimate sentence, for a preview canton. */
  previewNote?: string;
  /** The sentences on the cantonal and communal tax: its parts, the taxable income and wealth. */
  cantonal(icc: NonNullable<R['icc']>): string[];
  /** The federal tax's name, and where on the form it comes from (", from the ... column"). */
  federal: { name: string; from: string };
  /** The heading of the main items ("Main ICC items"). */
  mainItems: string;
  /** An item's official term, as Claude says it. */
  term(item: Item): string;
  /** The cantonal tax's figures for the structured result. */
  structured(icc: NonNullable<R['icc']>): Record<string, unknown>;
  /** The prefix of a federal item in the detail ("IFD 31.40", "Bund 260"). */
  ifdCode: string;
  /** Said after "Detail, each item with how it was computed and its source". */
  detailNote: string;
  /** Every computed line with a stable id, for the explanation tree. */
  lines(r: R): ViewLine[];
  /** Which of those lines compute_tax explains in its detail text, by id. */
  detailLines: RegExp;
  /** The wealth items, as the detail lists them. */
  wealthItems(icc: NonNullable<R['icc']>): Item[];

  // ---- The dashboard's card -------------------------------------------------------------------
  /** The taxes, one row each: cantonal and communal, federal. */
  rows(r: R): ViewRow[];
  /** What the cantonal and communal tax is made of. */
  parts(r: R): ViewRow[];
  /** This year against last year's declaration, when the canton reads it (comparison only). */
  lastYear?(r: R, facts: readonly Fact[]): YearComparisonRow[];
  /**
   * The separate tax on lump sums from the 2nd pillar and pillar 3a (TaxResult.capital), when the
   * canton computes it and the household received some: the amount taxed, one row per tax, and
   * the two together. A tax of its own, never in the result's total.
   */
  capital?(r: R): CapitalView | undefined;

  // ---- The final check and the plans ----------------------------------------------------------
  /** Every computed line, for the facts the result rests on. */
  allLines(r: R): Line[];
  /** The income tax a deduction changes (cantonal, communal, church; federal), or undefined. */
  incomeTax(r: R): IncomeTax | undefined;
}
