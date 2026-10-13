// What the reader of last year's Geneva declaration gives (SPEC.md section 5.4). Only form data:
// rubric codes, amounts, the civil status and the commune. Names, birth dates, phone numbers, AHV,
// taxpayer and reference numbers, addresses and employers are read past and never kept: nothing
// in these types can hold free text from the document.

/** A text cell of one line: words close together, with where it starts and ends on the page. */
export interface Cell {
  text: string;
  /** Left and right edges in PDF units; absent for plain text input. */
  x?: number;
  right?: number;
}

export interface Line {
  cells: Cell[];
}

/** One page: its lines top to bottom, or plain text (cells split at two or more spaces). */
export type PageInput = { lines: Line[] } | string;

/** Contribuable A, contribuable B, or both together. */
export type PriorPerson = 'A' | 'B' | 'household';

/**
 * Which part of the official form a page is: PG1 (identity), the summary pages PG2 (income),
 * PG3 (deductions) and PG4 (wealth), or an annex such as A1 (annex A of taxpayer A), A2, B1, C3,
 * F1. "other" when it can't be told.
 */
export type PriorFormPage = string;

export interface PriorItem {
  /** Rubric code as printed, e.g. "31.40". */
  code: string;
  /** A lower-case letter after the code, e.g. "r" in "31.10 r" (replacement income). */
  suffix?: string;
  /** The form page the line is on. */
  form: PriorFormPage;
  person: PriorPerson;
  /** The annex the line's total comes from, as printed on it: "A1", "C3", "F1". */
  annex?: string;
  /** The commune code printed on the line (code lieu, e.g. 6621), e.g. the work commune. */
  commune?: number;
  /** Centimes, cantonal and communal tax column (and the only column on the wealth page). */
  icc?: number;
  /** Centimes, federal tax column. */
  ifd?: number;
  /** On annex pages whose columns are not ICC and IFD: the amounts, left to right, in centimes. */
  amounts?: number[];
  /** Salary certificate box printed at the end of the line, e.g. "10.1". */
  box?: string;
  page: number;
  /** 1 for the first line with this code, form, suffix and person; 2 for the next (employers). */
  occurrence: number;
  /** Amounts on the lines under it that have no code of their own (a small table), in centimes. */
  table?: number[];
}

export type CivilStatus =
  'single' | 'married' | 'registered_partnership' | 'separated' | 'divorced' | 'widowed';

export interface PriorTaxpayer {
  civilStatus?: CivilStatus;
}

export interface PriorWarning {
  /** Stable code, e.g. "column_guess". */
  code: string;
  en: string;
  fr: string;
  page?: number;
}

export interface PriorDeclaration {
  /** The tax year the declaration is for, e.g. 2025. */
  taxYear?: number;
  /** The approved software that printed it, from a fixed list (GeTax, DrTax). */
  software?: string;
  pages: number;
  /** Which form page each page is. */
  forms: { page: number; form: PriorFormPage }[];
  taxpayers: { a: PriorTaxpayer; b?: PriorTaxpayer };
  /** The commune of residence, as a commune id from the lookup, never the address itself. */
  residence?: { commune: string; page: number; from: 'address' | 'code' };
  items: PriorItem[];
  warnings: PriorWarning[];
}

/** How place names and commune codes become commune ids (the canton's official list). */
export interface CommuneLookup {
  byName(place: string): string | undefined;
  byCode(code: number): string | undefined;
}
