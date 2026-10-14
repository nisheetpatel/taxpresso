// The official terms of a canton's form that the generic texts need (docs/design/cantons.md): the
// final check's titles and limits, what makes a value final, the plans' and the copy panel's
// words. Each canton whose form Taxpresso words generically gives its own (rules-zh, rules-be:
// `terms`); Geneva's texts are the defaults everywhere and need none. Types only.
import type { Text } from './core/types.js';

/** An official document Taxpresso cites, with its link (as listed in the canton's manifest). */
export interface OfficialDocument {
  /** The title as published. */
  title: string;
  url: string;
  /** A PDF opens at a page with #page=N. */
  pdf: boolean;
}

export interface CantonTerms {
  /** The label of a line code on the canton's form, with the official term in parentheses. */
  label(code: string): Text | undefined;
  /**
   * What was given for a line with a limit, as the form or the guide names it, by the rule that set
   * the limit (LimitApplied.rule, named as the federal concepts are: 'commute', 'pillar3a'...).
   */
  given: Readonly<Partial<Record<string, string>>>;
  /** The form's two tax columns, and both together: "Staatssteuer", "Bundessteuer". */
  taxes: { icc: string; ifd: string; both: string };
  /** The salary certificate as the canton's guide names it ("Lohnausweis"). */
  salaryCertificate: string;
  /** The cantonal tax office ("kantonales Steueramt"). */
  taxOffice: string;
  /** Asking for more time to file ("Fristerstreckung"). */
  moreTime: string;
  /** The official page on filing and more time (a manifest id of the canton's sources). */
  moreTimeSource: string;
  /** The securities list of the form ("Wertschriftenverzeichnis"). */
  securitiesList: string;
  /** The ESTV price list as the canton's guide names it ("Kursliste"). */
  priceList: string;
  /** Pillar 3a, a pension fund buy-in and a 3a catch-up, as the canton's guide names them. */
  pillar3a: string;
  pensionBuyIn: string;
  pillar3aCatchUp: string;
  /** Taxation at source and its ordinary assessment afterwards ("Quellensteuer", "NOV (...)"). */
  sourceTax: string;
  sourceTaxAssessment: string;
  /** The canton's official documents, for the link of each rule cited. */
  documents: Readonly<Record<string, OfficialDocument>>;
}
