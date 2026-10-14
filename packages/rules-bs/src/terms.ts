// The official terms of the Basel-Stadt return that the generic texts need (packages/rules-ch,
// terms.ts): what was given for each line with a limit, by the rule that set it
// (LimitApplied.rule), the names of the taxes, the tax office and asking for more time, the plans'
// words, and the official documents each rule links to. Terms as printed on the Basel-Stadt return
// (bs-2025-form-hauptformular p. 2 to 4; form B, bs-2025-form-b-berufskosten; forms K, Z and F,
// bs-2025-form-kzf-krankheit-zuwendung-betreuung), in its guide (bs-2025-guide-wegleitung; the 2026
// guide for a liability ending in 2026, bs-2026-guide-wegleitung-b, for the 3a catch-up) and on
// the canton's filing page (bs-2025-efiling-einreichen-page). The extension builds the final
// check's words from them, with the canton's name and software from its registry.
import type { CantonTerms } from '@taxpresso/rules-ch';
import { BS_OFFICIAL_DOCUMENTS } from './official-documents.js';
import { rubric, wealthRubric } from './rubrics.js';

export const BS_TERMS: CantonTerms = {
  label: (code) => rubric(code)?.label ?? wealthRubric(code)?.label,
  given: {
    commute: 'Fahrkosten',
    meals: 'Mehrkosten für auswärtige Verpflegung',
    'professional.other': 'Berufskosten effektiv',
    pillar3a: 'Gebundene Selbstvorsorge (Säule 3a)',
    training: 'Selbstgetragene Aus- und Weiterbildungskosten',
    debt_interest: 'Schuldzinsen',
    insurance: 'Versicherungsprämien',
    party: 'Beiträge an politische Parteien',
    childcare: 'Kinderbetreuungskosten',
    medical: 'Krankheits- und Unfallkosten',
    donations: 'Zuwendungen',
  },
  taxes: {
    icc: 'Kantons- und Gemeindesteuern',
    ifd: 'direkte Bundessteuer',
    both: 'Kantons- und Gemeindesteuern und direkte Bundessteuer',
  },
  salaryCertificate: 'Lohnausweis',
  taxOffice: 'Steuerverwaltung Basel-Stadt',
  moreTime: 'Fristerstreckung',
  // The deadline and asking for more time online, with its fee after 30 September.
  moreTimeSource: 'bs-2025-efiling-einreichen-page (Abgabetermine, Fristerstreckung)',
  securitiesList: 'Wertschriftenverzeichnis',
  priceList: 'Kursliste',
  pillar3a: 'Säule 3a',
  pensionBuyIn: 'Einkauf in die berufliche Vorsorge (Pensionskasse)',
  pillar3aCatchUp: 'zusätzlicher Einkauf in die Säule 3a',
  sourceTax: 'Quellensteuer',
  sourceTaxAssessment: 'NOV (nachträgliche ordentliche Veranlagung)',
  /** The official Basel-Stadt documents, for the links of each rule cited. */
  documents: BS_OFFICIAL_DOCUMENTS,
};
