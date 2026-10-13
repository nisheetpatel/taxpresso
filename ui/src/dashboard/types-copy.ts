// The /api/state part for the copy panel (extension/src/copy-panel.ts, copyPanelView), SPEC.md 10.5.
// Kept in step by the API tests.
import type { FactStatus } from './types-docs';

export interface CopyPanelRow {
  /** Stable id of the value's place on the form: what the "Entered" tick is stored under. */
  id: string;
  key: string;
  /** "31.40", "11.10-2", or the key of a line the form doesn't number. */
  ref: string;
  code?: string;
  /** Official French label, as printed on the form. */
  label: string;
  gloss: string;
  person: 'A' | 'B' | 'household';
  part?: { id: 'A' | 'B' | 'children'; label: string; gloss: string };
  columns: { id: string; label: string; gloss: string }[];
  role: 'input' | 'total' | 'report' | 'computed';
  format: 'money' | 'money_cents' | 'count' | 'percent' | 'date' | 'text' | 'tick';
  centimes?: number;
  text?: string;
  tick?: boolean;
  /** As typed on the official form. */
  copy?: string;
  rounded: boolean;
  fields: { id: string; label: string; value: string }[];
  /** A household amount on a rubric the form splits per person ("Contr. A", "Contr. B", "Enfant(s)"). */
  splitInto?: { label: string; gloss: string }[];
  status: FactStatus;
  final: boolean;
  enterable: boolean;
  entered: boolean;
  documents: { id: string; filename: string }[];
  source: string;
}

export interface CopyPanelSection {
  page: string;
  title: string;
  gloss: string;
  person?: 'A' | 'B' | 'household';
  pdfPage: number;
  groups: { section: string; title: string; gloss: string; rows: CopyPanelRow[] }[];
  entered: number;
  total: number;
  pending: number;
}

export interface CopyPanelState {
  taxYear: number;
  formYear: number;
  provisional: boolean;
  note?: string;
  sections: CopyPanelSection[];
  entered: number;
  total: number;
  pending: number;
  unplaced: { code: string; person: string }[];
  couple: boolean;
  waiting: { label: string; filename?: string }[];
}
