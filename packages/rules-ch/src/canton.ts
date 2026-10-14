// The interface every canton implements (docs/design/cantons.md, section 2). Types only: each
// canton's rules package exports `rules: CantonRules` (the cantonal and communal tax, with the
// federal tax from this package), its filing package `filing: CantonFiling` (the form), and the
// extension keeps one registry of them by canton.
import type { DocumentKind, Fact, KeyRegistry, VaultDocument } from '@taxpresso/ledger';
import type { Cited } from './core/cited.js';
import type { HouseholdInput, TaxResult, Text } from './core/types.js';

export type CantonCode =
  'GE' | 'ZH' | 'BE' | 'VD' | 'BS' | 'FR' | 'TI' | 'BL' | 'AG' | 'ZG' | 'LU' | 'SG';

/** A commune of residence, with its multiplier for the tax year. */
export interface Commune {
  /**
   * The federal commune number (BFS-Nummer, numéro OFS), when an official table of the sources
   * library gives it (Zurich); null otherwise (Geneva: its guide prints a "code lieu" for each
   * commune, p. 59, without calling it the federal number).
   */
  bfs: number | null;
  /** For display, and for Geneva's facts already stored as slugs (profile.commune). */
  slug: string;
  name: string;
  /**
   * The commune's multiplier for the year, with the table it comes from. Geneva: the centimes
   * additionnels in hundredths (45.49 -> 4549). Zurich: the Steuerfuss without church tax in
   * percent, one per part of the commune when its parts differ.
   */
  rates: Cited<readonly number[]>;
}

/**
 * A kind of document the canton's return takes, and the values it gives: the schema Claude reads
 * the document against (SPEC.md 5.3). What to attach, with the guide's page, stays in the canton's
 * questionnaire requirements (data/<c>/<year>/questionnaire.yaml).
 */
export interface DocumentRule {
  kind: DocumentKind;
  /** The ledger keys a document of this kind gives, in the order of the form. */
  keys: readonly string[];
}

/**
 * A canton's tax rules. `Cantonal` types the household input's `cantonal` part (what only this
 * canton asks for); `Result` is the canton's own result, the shared top level and more.
 */
export interface CantonRules<Cantonal = unknown, Result extends TaxResult = TaxResult> {
  canton: CantonCode;
  /** Years with official values; any other year throws. */
  taxYears: readonly number[];
  /** The communes and their rates, cited; the canton's commune list for the year. */
  communes(taxYear: number): readonly Commune[];
  /**
   * The cantonal and communal tax, and the federal tax where the canton's form is mapped. Throws
   * for an input the canton cannot compute faithfully (a fact it does not read, an unknown commune).
   */
  computeReturn(input: HouseholdInput<Cantonal>): Result;
  /** The ledger keys of the year: the shared ones (this package, keys/) and the canton's own. */
  keys(taxYear: number): KeyRegistry;
  documents(taxYear: number): readonly DocumentRule[];
  /** The canton's folder of the sources library, for search_official_docs: docs/sources/<c>. */
  sourcesIndex: string;
}

/** The ledger as the filing side reads it: the current facts and the documents that count. */
export interface LedgerView {
  facts: readonly Fact[];
  documents: readonly VaultDocument[];
}

/**
 * A canton's filing side, as the generic views use it (the copy panel, get_form_values, the final
 * check): its form, where values go on it, and the values to type. Each filing package exports its
 * own `filing` with its shapes (packages/filing-ge: FormMap, FormItem, CopyLabels).
 */
export interface CantonFiling<FormMap = unknown, FormItem = unknown, Labels = unknown> {
  canton: CantonCode;
  /** Pages, sections, codes and labels as printed, cited. */
  formMap(taxYear: number): FormMap;
  /** Where each line code stands on the official form (lower first); undefined: not on it. */
  formOrder(taxYear: number): (code: string) => number | undefined;
  /** The line a ledger value goes to on the form, for this person (the final check's titles). */
  lineOf(key: string, person: string): string | undefined;
  /** The line of a person's salary, for a rough salary given as an estimate. */
  salaryLine(person: string): string;
  /** Shown when the form's codes and labels come from an earlier year. */
  formNote(taxYear: number): Text | undefined;
  /**
   * The values to type, from the canton's result, in the form's terms (the copy panel). Absent for
   * Geneva, whose values come from the ledger's routes and its engine together.
   */
  formValues?(result: TaxResult): readonly FormItem[];
  /** How the form heads its columns and parts, when not as Geneva's. */
  labels?: Labels;
  /** For Claude (get_form_values): how amounts are typed, where, whose, a section to ask for. */
  words: {
    /** After "Amounts in whole francs, no separators, as the form asks". */
    amounts: string;
    /** Where and in which order to type them, when that needs saying. */
    guide?: string;
    /** Who is who on the form, for a couple. */
    persons: string;
    /** A section id, for "Call again with section". */
    example: string;
  };
  /** Taxpresso checks the PDF of the canton's declaration (reconcile_official_pdf): Geneva only. */
  checksPdf: boolean;
}
