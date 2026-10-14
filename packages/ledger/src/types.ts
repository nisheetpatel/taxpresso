// Data model, SPEC.md section 4. Money is integer centimes everywhere.

export type Person = 'p1' | 'p2' | `child${number}`;
export type Owner = Person | 'household';

export type FactStatus =
  | 'verified' // from a barcode/XML or a parsed official PDF, schema-valid
  | 'extracted' // proposed by text parsing or by Claude from an unstructured doc; needs user confirm
  | 'stated' // user typed it or confirmed an extracted value
  | 'estimate' // user-provided placeholder, flagged
  | 'computed'; // produced by the rules engine (never filed as input)

export type FactValue = number | string | boolean | string[];

export interface FactSource {
  /** 'export': read from a structured export file (CSV, XML), e.g. a broker's (SPEC.md 5.7). */
  method: 'barcode' | 'pdf_text' | 'official_pdf' | 'claude' | 'user' | 'export';
  docId?: string;
  page?: number;
  field?: string;
  /** Where the user gave the value: in the chat with Claude, or in the dashboard. */
  via?: 'chat' | 'dashboard';
}

export interface Fact {
  id: string;
  key: string;
  person: Owner;
  /**
   * For keys that repeat (KeyDef.multiple): which one this is, e.g. a document id, an ISIN or an
   * employer. The current view keeps one fact per key, person and instance.
   */
  instance?: string;
  taxYear: number;
  value: FactValue;
  status: FactStatus;
  source: FactSource;
  note?: string;
  /** Previous fact id for the same key, person, instance and year. The ledger is append-only. */
  supersedes?: string;
  createdAt: string;
}

/**
 * Kinds of supporting documents. SPEC.md section 4 lists the first eleven; the others name
 * attachments the official guide asks for (ge-2025-guide-declaration-pp p. 10), then the tax
 * office's assessment (bordereau and avis de taxation, ge-2025-guide-declaration-pp p. 4) that the
 * user checks against what they declared (SPEC.md section 10.8).
 */
export const DOCUMENT_KINDS = [
  'salary_certificate',
  'ech0196_statement',
  'pillar3a_attestation',
  'lpp_buyin',
  'health_premiums',
  'medical_invoice',
  'childcare_invoice',
  'donation_receipt',
  'debt_interest',
  'prior_declaration',
  'replacement_income_certificate',
  'pension_certificate',
  'bank_attestation',
  'alimony_proof',
  'crypto_statement',
  'separation_judgment',
  // A broker's activity or position export (CSV, XML) for the securities list (SPEC.md 5.7).
  'broker_export',
  'other',
  'tax_assessment',
  // A life insurance (pillar 3b) attestation: surrender value and premiums (ge-2025-guide-declaration-pp p. 8, p. 28).
  'life_insurance_attestation',
  // The PDF of this year's own declaration, downloaded from GeTax or the online declaration before
  // the user transmits it, to check it against the values to type (SPEC.md 10.4). Never a source of values.
  'official_declaration',
  // The attestation of a lump sum paid by a pension fund or vested benefits institution (2nd pillar)
  // or by a pillar 3a foundation or insurer: the copy the institution sends the taxpayer
  // (ch-na-law-lifd art. 129 al. 1 let. b and al. 2, p. 69); Geneva rubric 98.12
  // (ge-2025-guide-declaration-pp p. 13).
  'lpp_capital_attestation',
  'pillar3a_capital_attestation',
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export interface VaultDocument {
  id: string;
  sha256: string;
  filename: string;
  /** Path inside the tax-year folder, with forward slashes. */
  path: string;
  bytes: number;
  addedAt: string;
  /** Unset until the document has been read or the user says what it is. */
  kind?: DocumentKind;
  /** 'export': recognised from the structure of an export file (SPEC.md 5.7). */
  kindSource?: 'user' | 'barcode' | 'pdf_text' | 'claude' | 'export';
  /** Whose it is; 'household' means it covers everyone (e.g. a family health insurance statement). */
  person?: Owner;
  taxYear?: number;
  issuer?: string;
  pages?: number;
  /** The period the document covers, YYYY-MM-DD (e.g. a salary certificate's box E). */
  periodFrom?: string;
  periodTo?: string;
  /**
   * The id of the document that replaces this one (a corrected certificate, the right year).
   * A replaced document stays in the folder but no longer counts: its values, checks and cards drop.
   */
  replacedBy?: string;
  parse: { method: string; ok: boolean; warnings: string[] };
}

export type RequirementStatus = 'missing' | 'satisfied' | 'estimated' | 'waived';

export interface Requirement {
  id: string;
  label: { en: string; fr: string };
  /** Why it is needed, from the question or rule that created it. */
  reason: { en: string; fr: string };
  /** What the document is, in plain words. */
  explain?: { en: string; fr: string };
  expects: { kinds: DocumentKind[]; count: number } | { factKey: string };
  person: Owner;
  status: RequirementStatus;
  /** How many matching documents are in the vault. */
  have: number;
  optional?: boolean;
  /** Official source for the requirement, e.g. "ge-2025-guide-declaration-pp p. 10". */
  source?: string;
  /** An official page that explains the document, for the user (from the questionnaire). */
  learnMore?: { url: string; label: { en: string; fr: string } };
}

export interface Decision {
  optimizationId: string;
  choice: string;
  decidedAt: string;
  deltaCentimes: number;
}
