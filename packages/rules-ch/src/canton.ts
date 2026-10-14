// The interface every canton implements (docs/design/cantons.md, section 2). Types only: each
// canton's rules package exports `rules: CantonRules` (the cantonal and communal tax, with the
// federal tax from this package), its filing package `filing: CantonFiling` (the form), and the
// extension keeps one registry of them by canton.
import type { DocumentKind, Fact, KeyRegistry, VaultDocument } from '@taxpresso/ledger';
import type { Cited } from './core/cited.js';
import type { HouseholdInput, TaxResult } from './core/types.js';

export type CantonCode = 'GE' | 'ZH' | 'BE' | 'VD' | 'BS' | 'FR' | 'TI' | 'BL' | 'AG' | 'LU';

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
 * A canton's filing side: its form, the copy panel's values and the check of the official PDF.
 * Each filing package gives the shapes (Geneva: packages/filing-ge, FormMap, CopyPanel,
 * DeclarationCheck).
 */
export interface CantonFiling<FormMap = unknown, FormValues = unknown, Reconciliation = unknown> {
  canton: CantonCode;
  /** Pages, sections, codes and labels as printed, cited. */
  formMap(taxYear: number): FormMap;
  /** The copy panel: where each computed or stated value goes on the form. */
  formValues(result: TaxResult, facts: LedgerView): FormValues;
  /** The official PDF's text against the values (before the user transmits). */
  reconcile(pdfText: string, values: FormValues): Reconciliation;
}
