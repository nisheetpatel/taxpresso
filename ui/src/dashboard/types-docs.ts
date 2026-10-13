// The /api/state parts for documents (extension/src/document-views.ts). Kept in step by the API tests.

export type FactStatus = 'verified' | 'extracted' | 'stated' | 'estimate' | 'computed';

export interface CardValue {
  factId: string;
  key: string;
  person: string;
  label: string;
  official?: string;
  box?: string;
  page?: number;
  type: string;
  centimes?: number;
  text?: string;
  /** As typed into the official form. */
  copy?: string;
  status: FactStatus;
  via?: 'chat' | 'dashboard';
  entered: boolean;
}

export interface DocumentCard {
  docId: string;
  filename: string;
  kind?: string;
  kindLabel?: string;
  kindSource?: 'user' | 'barcode' | 'pdf_text' | 'claude';
  person?: string;
  who?: string;
  taxYear?: number;
  issuer?: string;
  period?: { from: string; to: string };
  read: boolean;
  enterable: boolean;
  values: CardValue[];
  toConfirm: number;
  entered: number;
  total: number;
}

export interface CheckView {
  id: string;
  rule: 'other_year' | 'pillar3a_year' | 'salary_period' | 'replacement_in_salary' | 'duplicate';
  title: string;
  detail: string;
  todo: string;
  documents: { id: string; filename: string }[];
  source?: string;
  resolved?: { note: string; at: string };
}

export interface AssessmentCard {
  docId: string;
  filename: string;
  taxes: string[];
  notificationDate?: string;
  deadlines: {
    tax: string;
    date: string;
    iso: string;
    movedFromWeekend: boolean;
    law: string;
    sources: string[];
  }[];
  items: {
    key: string;
    label: string;
    official?: string;
    assessed: number;
    declared?: number;
    difference?: number;
    unconfirmed: number;
  }[];
  totals: { key: string; label: string; official?: string; assessed: number }[];
  unconfirmed: number;
  text: { noDate: string; counting: string; notAMistake: string; never: string };
}

export interface DocumentsState {
  cards: DocumentCard[];
  replaced: { id: string; filename: string; by: string }[];
  checks: CheckView[];
  assessments: AssessmentCard[];
  toConfirm: number;
}
