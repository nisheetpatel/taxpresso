// The official terms of Zug's form K that the generic texts need (packages/rules-ch, terms.ts): what
// was given for each line with a limit, by the rule that set it (LimitApplied.rule), the names of
// the two columns, the tax office and asking for more time, the plans' words, and the official
// documents each rule links to. Terms as printed on form K and its forms (zg-2025-guide-wegleitung
// p. 17 to 19, the sample return; p. 32 to 42, the codes) and on the canton's page on more time
// (zg-na-efiling-fristerstreckung, "Fristerstreckung Steuererklärung natürliche Personen": online with
// the Pers ID, or in writing). The extension builds the final check's words from them, with the
// canton's name and software from its registry.
import type { CantonTerms } from '@taxpresso/rules-ch';
import { ZG_OFFICIAL_DOCUMENTS } from './official-documents.js';
import { rubric, wealthRubric } from './rubrics.js';

export const ZG_TERMS: CantonTerms = {
  label: (code) => rubric(code)?.label ?? wealthRubric(code)?.label,
  given: {
    commute: 'Fahrkosten zwischen Wohn- und Arbeitsort',
    meals: 'Mehrkosten für auswärtige Verpflegung',
    'professional.flat': 'Übrige für die Ausübung des Berufes erforderliche Kosten',
    'professional.other': 'Übrige für die Ausübung des Berufes erforderliche Kosten',
    pillar3a: 'Beiträge gebundene Vorsorge (Säule 3a)',
    training: 'Selbst getragene berufsorientierte Aus- und Weiterbildungskosten',
    debt_interest: 'Private Schuldzinsen',
    insurance: 'Versicherungsprämien und Zinsen von Sparkapitalien',
    party: 'Zuwendungen an politische Parteien',
    childcare: 'Kinderdrittbetreuungskosten',
    medical: 'Krankheits- und Unfallkosten',
    donations: 'Gemeinnützige Zuwendungen',
  },
  taxes: {
    icc: 'Kanton',
    ifd: 'Bund',
    both: 'Kanton und Bund',
  },
  salaryCertificate: 'Lohnausweis',
  taxOffice: 'Steuerverwaltung des Kantons Zug',
  moreTime: 'Fristerstreckung',
  // The online request with the Pers ID, or in writing; up to 31 December answered only if refused.
  moreTimeSource: 'zg-2025-guide-wegleitung p. 9 and 10',
  securitiesList: 'Wertschriften- und Guthabenverzeichnis (WV)',
  priceList: 'Kursliste',
  pillar3a: 'Säule 3a',
  pensionBuyIn: 'Beiträge an die 2. Säule (Einkaufsbeiträge)',
  pillar3aCatchUp: 'Nachträglicher Einkauf in die Säule 3a',
  sourceTax: 'Quellensteuer',
  sourceTaxAssessment: 'NOV (nachträgliche ordentliche Veranlagung)',
  /** The official Zug documents, for the links of each rule cited. */
  documents: ZG_OFFICIAL_DOCUMENTS,
};
