// The official terms of the Aargau return that the generic texts need (packages/rules-ch, terms.ts):
// what was given for each line with a limit, by the rule that set it (LimitApplied.rule), the names
// of the two taxes, the tax office and asking for more time, the plans' words, and the official
// documents each rule links to. Terms as the guide prints them (ag-2025-guide-wegleitung: p. 10 for
// more time, "Gesuch um Fristverlängerung beim Gemeindesteueramt", online at
// www.ag.ch/fristerstreckung). The extension builds the final check's words from them, with the
// canton's name and software from its registry.
import type { CantonTerms } from '@taxpresso/rules-ch';
import { AG_OFFICIAL_DOCUMENTS } from './official-documents.js';
import { rubric } from './rubrics.js';

export const AG_TERMS: CantonTerms = {
  label: (code) => rubric(code)?.label,
  given: {
    commute: 'Fahrtkosten zwischen Wohn- und Arbeitsstätte',
    meals: 'Mehrkosten der auswärtigen Verpflegung',
    'professional.other': 'Übrige Berufskosten',
    pillar3a: 'Beiträge Säule 3a',
    training: 'Berufsorientierte Aus-, Weiterbildungs- und Umschulungskosten',
    debt_interest: 'Schuldzinsen',
    insurance: 'Versicherungsprämien und Zinsen von Sparkapitalien',
    party: 'Zuwendungen an steuerbefreite politische Parteien',
    childcare: 'Kinderbetreuungskosten',
    medical: 'Krankheits- und Unfallkosten',
    donations: 'Freiwillige Leistungen (Spenden)',
  },
  taxes: {
    icc: 'Kantons- und Gemeindesteuern',
    ifd: 'direkte Bundessteuer',
    both: 'Kantons- und Gemeindesteuern und direkte Bundessteuer',
  },
  salaryCertificate: 'Lohnausweis',
  taxOffice: 'Gemeindesteueramt',
  moreTime: 'Fristverlängerung',
  // "Terminprobleme?": the request to the Gemeindesteueramt, online at www.ag.ch/fristerstreckung.
  moreTimeSource: 'ag-2025-guide-wegleitung p. 10',
  securitiesList: 'Wertschriften- und Guthabenverzeichnis',
  priceList: 'Kursliste',
  pillar3a: 'Säule 3a',
  pensionBuyIn: 'Einkäufe Säule 2',
  pillar3aCatchUp: 'Einkauf in die Säule 3a',
  sourceTax: 'Quellensteuer',
  sourceTaxAssessment: 'NOV (nachträgliche ordentliche Veranlagung)',
  /** The official Aargau documents, for the links of each rule cited. */
  documents: AG_OFFICIAL_DOCUMENTS,
};
