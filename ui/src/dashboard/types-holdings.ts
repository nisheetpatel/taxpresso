// The /api/state parts for "Your securities and accounts" (extension/src/holdings.ts and
// securities.ts). Kept in step by the extension's holdings tests. Money in integer centimes.

export type Owner = 'p1' | 'p2' | 'joint' | 'children';
export type ValueState = 'confirmed' | 'needs_ok' | 'estimate';

export interface Columns {
  subjectIa: number;
  notSubjectIa: number;
  taxableValue: number;
  fees: number;
  savingsInterest: number;
}

export interface Issue {
  severity: 'missing' | 'check';
  text: string;
}

export interface HoldingLine {
  section: 'accounts' | 'securities' | 'statements';
  id: string;
  origin: 'broker_export' | 'document' | 'you';
  docId?: string;
  name: string;
  reference?: string;
  owner?: Owner;
  ownerLabel?: string;
  civilite?: string;
  kindLabel?: string;
  quantity?: string;
  currency?: string;
  columns: Columns;
  valueBasis?: 'official' | 'broker' | 'document' | 'you';
  withholdingSwiss?: number;
  foreign?: {
    withheld: number;
    country?: string;
    rateBp?: number;
    nonRecoverable?: number;
    recoverableAbroad?: number;
    problem?: string;
  };
  foreignCaveat?: string;
  state: ValueState;
  complete: boolean;
  canEnterOfficial: boolean;
  brokerChf?: number;
  official?: {
    centimes: number;
    from?: string;
    status: 'verified' | 'extracted' | 'stated' | 'estimate' | 'computed';
    via?: 'chat' | 'dashboard';
  };
  issues: Issue[];
}

export interface OtherHolding {
  rubric: 'valuables' | 'lifeInsurance' | 'debts';
  id: string;
  origin: 'document' | 'you';
  name: string;
  owner?: Owner;
  ownerLabel?: string;
  value?: number;
  flow?: number;
  label: string;
  code: string;
  flowLabel?: string;
  flowCode?: string;
  state: ValueState;
  complete: boolean;
  issues: Issue[];
}

export interface HoldingsView {
  taxYear: number;
  couple: boolean;
  sections: {
    id: HoldingLine['section'];
    form: string;
    official: string;
    label: string;
    subtotal: Columns;
    lines: HoldingLine[];
  }[];
  totals: Columns;
  income: number;
  ia: { subject: number; claim: number; complete: boolean };
  ies: {
    nonRecoverable: number;
    recoverableAbroad: number;
    claimable?: boolean;
    requested: number;
    incomeReduction: number;
    complete: boolean;
  };
  other: OtherHolding[];
  exports: { docId: string; filename: string; issuer?: string; toConfirm: number }[];
  general: Issue[];
  missing: number;
  complete: boolean;
  estimate: boolean;
  officialHelp: string;
  owners: { value: Owner; label: string }[];
  rubrics: { income: string; wealth: string; fees: string; savings: string };
}

/** The securities read from broker exports, with the exports' warnings (extension/src/securities.ts). */
export interface SecuritiesView {
  rows: {
    id: string;
    name: string;
    isin?: string;
    currency?: string;
    quantity?: string;
    valueOriginal?: string;
    valueChf?: number;
    incomeChf?: number;
    swissChf?: number;
    foreignChf?: number;
    needsOk: boolean;
    estimate: boolean;
  }[];
  totals: {
    valueChf: number;
    incomeChf: number;
    swissChf: number;
    foreignChf: number;
    incomplete: boolean;
  };
  warnings: string[];
  exports: number;
}
