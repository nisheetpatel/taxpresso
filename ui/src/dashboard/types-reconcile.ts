// The /api/state part for "Check before you transmit" (extension/src/reconcile.ts,
// declarationCheckView; @taxpresso/filing-ge, reconcileDeclaration), SPEC.md 10.4.
// Kept in step by the extension's tests. Amounts in whole francs.
import type { FactStatus } from './types-docs';

export type CheckColumn = 'icc' | 'ifd' | 'wealth' | 'amount';

export interface CheckCell {
  column: CheckColumn;
  taxpresso?: number;
  pdf?: number;
}

export interface CheckPart {
  id: 'A' | 'B' | 'children';
  label: string;
  gloss: string;
}

export interface CheckLine {
  id: string;
  ref: string;
  code: string;
  /** Official French label; empty for a code Taxpresso's form map doesn't have. */
  label: string;
  gloss: string;
  person: 'A' | 'B' | 'household';
  part?: CheckPart;
  outcome: 'match' | 'differs' | 'pdf_only' | 'taxpresso_only';
  cells: CheckCell[];
  status?: FactStatus;
  final?: boolean;
  pdfPage?: number;
  known: boolean;
}

export interface ComputedLine {
  id: string;
  ref: string;
  code: string;
  label: string;
  gloss: string;
  person: 'A' | 'B' | 'household';
  cells: { column: CheckColumn; pdf: number; expected?: number }[];
  check: 'adds_up' | 'off' | 'shown';
  from?: string;
  pdfPage: number;
  source?: string;
}

export interface ByEyeLine {
  id: string;
  ref: string;
  label: string;
  gloss: string;
  person: 'A' | 'B' | 'household';
  part?: CheckPart;
  reason: 'tick' | 'text' | 'columns';
  value?: string;
}

export interface CheckSection {
  page: string;
  title: string;
  gloss: string;
  lines: CheckLine[];
  computed: ComputedLine[];
  byEye: ByEyeLine[];
}

export interface DeclarationCheckState {
  taxYear: number;
  /** not_available: the check reads Geneva declarations only (a Zurich return). */
  status: 'none' | 'pending' | 'unreadable' | 'other_year' | 'checked' | 'not_available';
  document?: {
    id: string;
    filename: string;
    addedAt: string;
    taxYear?: number;
    software?: string;
    pages?: number;
  };
  older: number;
  printedYear?: number;
  warnings: string[];
  provisional?: string;
  check?: {
    taxYear: number;
    formYear: number;
    provisional: boolean;
    sections: CheckSection[];
    counts: {
      match: number;
      differs: number;
      pdfOnly: number;
      taxpressoOnly: number;
      toFix: number;
      computed: number;
      computedOff: number;
      byEye: number;
      notFinal: number;
    };
    clear: boolean;
  };
}
