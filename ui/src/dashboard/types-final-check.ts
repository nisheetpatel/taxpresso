// The /api/state part for "Final check" (extension/src/final-check.ts, finalCheckView; the pure
// check is @taxpresso/rules-ge, finalCheck), SPEC.md 10.0. Kept in step by the extension's tests.
// Amounts are in the texts, already written for the page's language.

export type FinalCheckKind =
  | 'cannot_compute'
  | 'not_supported'
  | 'not_computed'
  | 'questions_open'
  | 'missing_document'
  | 'documents_unread'
  | 'needs_ok'
  | 'estimate'
  | 'estimate_rule'
  | 'check'
  | 'incomplete'
  | 'official_pdf'
  | 'limit'
  | 'capital'
  | 'abroad'
  | 'property'
  | 'part_year'
  | 'best_figure'
  | 'holding_check'
  | 'not_counted'
  | 'assumption'
  | 'unverified_rule'
  | 'optional_document'
  | 'form_provisional';

export interface FinalCheckSource {
  /** Manifest id of the official document. */
  id: string;
  /** Where in it: page, article. */
  where: string;
  title?: string;
  /** The official link, at the page for a PDF. */
  url?: string;
}

export interface FinalCheckItemState {
  id: string;
  kind: FinalCheckKind;
  status?: 'needs_ok' | 'estimate' | 'missing' | 'fix';
  code?: string;
  title: string;
  detail: string;
  todo?: string;
  list?: string[];
  limit?: { position: string; tax: string; kind: string; estimate?: boolean };
  sources: FinalCheckSource[];
}

export interface FinalCheckState {
  taxYear: number;
  verdict: 'ready' | 'not_ready';
  fix: FinalCheckItemState[];
  know: FinalCheckItemState[];
  margin: { shareBp: number; min: number };
  /** The official page to ask the tax office for more time to file. */
  moreTime?: string;
}
