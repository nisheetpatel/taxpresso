// The official terms of the Bern return that the generic texts need (packages/rules-ch, terms.ts):
// what was given for each line with a limit, by the rule that set it (LimitApplied.rule), the names
// of the taxes, the tax office and asking for more time, the plans' words, and the official
// documents each rule links to. Terms as printed on the Bern return
// (be-2025-steuererklaerung-formulare-de p. 1 to 11), in its guide (be-2025-wegleitung-np-de) and the
// canton's information sheet (be-2025-info-np-jan2026-de p. 2). The extension builds the final
// check's words from them, with the canton's name and software from its registry.
import type { CantonTerms } from '@taxpresso/rules-ch';
import { BE_OFFICIAL_DOCUMENTS } from './official-documents.js';
import { rubric } from './rubrics.js';

export const BE_TERMS: CantonTerms = {
  label: (code) => rubric(code)?.label,
  given: {
    commute: 'Fahrkosten',
    meals: 'Auswärtige Verpflegung',
    'professional.other': 'Übrige Berufskosten',
    pillar3a: 'Beiträge Säule 3a',
    training: 'Berufsorientierte Aus- und Weiterbildungskosten',
    debt_interest: 'Schuldzinsen',
    insurance: 'Versicherungsprämien und Zinsen auf Sparkapitalien',
    party: 'Mitgliederbeiträge und Zuwendungen an politische Parteien',
    childcare: 'Kinderdrittbetreuungskosten',
    medical: 'Krankheits- und Unfallkosten',
    donations: 'Vergabungen',
  },
  taxes: {
    icc: 'Kantons- und Gemeindesteuern',
    ifd: 'direkte Bundessteuer',
    both: 'Kantons- und Gemeindesteuern und direkte Bundessteuer',
  },
  salaryCertificate: 'Lohnausweis',
  taxOffice: 'Steuerverwaltung des Kantons Bern',
  moreTime: 'Fristverlängerung',
  // The deadline and its extension, online or in writing, with their fees.
  moreTimeSource: 'be-2025-info-np-jan2026-de p. 2',
  securitiesList: 'Wertschriftenverzeichnis',
  priceList: 'Kursliste',
  pillar3a: 'Säule 3a',
  pensionBuyIn: 'Einkauf 2. Säule (Pensionskasse)',
  pillar3aCatchUp: 'Nachzahlung (Einkauf) in die Säule 3a',
  sourceTax: 'Quellensteuer',
  sourceTaxAssessment: 'NOV (nachträgliche ordentliche Veranlagung)',
  /** The official Bern documents, for the links of each rule cited. */
  documents: BE_OFFICIAL_DOCUMENTS,
};
