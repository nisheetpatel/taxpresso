// The /api/state shape (extension/src/api.ts, dashboardState). Kept in step by the API tests.
import type { Language } from './i18n';
import type { SecuritiesView } from './Securities';
import type { DocumentsState } from './types-docs';

export type QuestionType = 'choice' | 'yesno' | 'number' | 'multi' | 'commune';
export type Value = string | number | boolean | string[];

export interface OfficialLink {
  url: string;
  label: string;
}

export interface Question {
  id: string;
  questionId: string;
  person: string;
  who?: string;
  type: QuestionType;
  text: string;
  help?: string;
  explain?: string;
  /** An official page on the topic, shown as "Official page" in the explanation. */
  learnMore?: OfficialLink;
  options?: { value: string; label: string; notSupported: boolean }[];
  none?: string;
  min?: number;
  max?: number;
  value?: Value;
  skipped?: boolean;
}

export interface RequirementView {
  id: string;
  label: string;
  reason: string;
  explain?: string;
  learnMore?: OfficialLink;
  /** Same for every person's copy of one requirement (e.g. health premiums for you and your partner). */
  group: string;
  status: 'missing' | 'satisfied' | 'estimated' | 'waived';
  have: number;
  need: number;
  optional: boolean;
  who?: string;
  /** The kind a document uploaded from this row gets. */
  kind?: string;
  person: string;
}

export interface DocumentView {
  id: string;
  filename: string;
  bytes: number;
  addedAt: string;
  kind?: string;
  kindLabel?: string;
  /** How the kind is known: 'export' when read from the file's structure (a broker export); 'claude' while it is only Claude's reading, not confirmed by the user. */
  kindSource?: string;
  person?: string;
}

export interface Activity {
  at: string;
  by: 'claude' | 'you';
  what: string;
  detail?: string;
}

/** Values read from documents, checks and the assessment: ./types-docs.ts. */
export interface State extends DocumentsState {
  version: string;
  taxYear: number;
  lang: Language;
  csrf: string;
  vault: { path: string; exists: boolean; problem?: string };
  people: { id: string; label: string }[];
  progress: { answered: number; total: number };
  question: Question | null;
  chips: string[];
  answers: { id: string; question: string; answer: string; who?: string }[];
  documents: DocumentView[];
  kinds: { value: string; label: string }[];
  requirements: RequirementView[];
  plan: {
    inputs: {
      person: 'p1' | 'p2';
      gross: number | null;
      net: number | null;
      hasPensionFund: boolean;
      paid: number;
    }[];
    result: {
      people: {
        person: 'p1' | 'p2';
        capCentimes: number;
        capIsMaximum: boolean;
        paidCentimes: number;
        roomCentimes: number;
      }[];
      roomCentimes: number;
      saving?: { totalCentimes: number; cantonalCentimes: number; federalCentimes: number };
      assumptions: string[];
      sources: string[];
    };
  };
  notSupported: string[];
  /** The securities list from broker exports, or null when there is none. */
  securities?: SecuritiesView | null;
  notSupportedMessage: string;
  activity: Activity[];
}
