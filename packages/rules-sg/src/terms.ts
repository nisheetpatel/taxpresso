// The official terms of St. Gallen's return that the generic texts need (packages/rules-ch,
// terms.ts): what was given for each line with a limit, by the rule that set it
// (LimitApplied.rule), the names of the two taxes, the tax office and asking for more time, the
// plans' words, and the official documents each rule links to. Terms as printed on the return and
// its Form 4 (sg-2025-form-steuererklaerung, sg-2025-form-berufskosten) and in the guide
// (sg-2025-guide-wegleitung p. 8: "Gesuch um Fristverlängerung" to the Gemeindesteueramt, online at
// www.steuern.sg.ch). The extension builds the final check's words from them, with the canton's
// name and software from its registry.
import type { CantonTerms } from '@taxpresso/rules-ch';
import { SG_OFFICIAL_DOCUMENTS } from './official-documents.js';
import { federalRubric, wealthRubric } from './rubrics.js';

export const SG_TERMS: CantonTerms = {
  label: (code) => federalRubric(code)?.label ?? wealthRubric(code)?.label,
  given: {
    commute: 'Fahrkosten zwischen Wohn- und Arbeitsstätte',
    meals: 'Mehrkosten für Verpflegung',
    'professional.flat': 'Pauschalabzug übrige Berufskosten',
    'professional.other': 'Tatsächliche Berufskosten',
    pillar3a: 'Säule 3a',
    training: 'Kosten berufsorientierte Aus-/Weiterbildung',
    debt_interest: 'Schuldzinsen',
    insurance: 'Versicherungsprämien und Sparzinsen',
    party: 'Parteispenden',
    childcare: 'Kinderbetreuungskosten bei Drittbetreuung',
    medical: 'Krankheits- und Unfallkosten',
    donations: 'Freiwillige Zuwendungen',
  },
  // The return is one form for both: "Kantons-, Gemeinde- und direkte Bundessteuer".
  taxes: {
    icc: 'Kantons- und Gemeindesteuern',
    ifd: 'direkte Bundessteuer',
    both: 'Kantons-, Gemeinde- und direkte Bundessteuer',
  },
  salaryCertificate: 'Lohnausweis',
  taxOffice: 'Gemeindesteueramt',
  moreTime: 'Fristverlängerung',
  // Before the deadline, online at www.steuern.sg.ch (sg-2025-guide-wegleitung p. 8).
  moreTimeSource: 'sg-2025-guide-wegleitung p. 8',
  securitiesList: 'Wertschriften- und Guthabenverzeichnis (Formular 2)',
  priceList: 'Kursliste',
  pillar3a: 'Säule 3a',
  pensionBuyIn: 'Säule 2 (BVG) inkl. Einkaufsbeiträge',
  pillar3aCatchUp: 'Nachträgliche Einkäufe Säule 3a',
  sourceTax: 'Quellensteuer',
  sourceTaxAssessment: 'NOV (nachträgliche ordentliche Veranlagung)',
  /** The official St. Gallen documents, for the links of each rule cited. */
  documents: SG_OFFICIAL_DOCUMENTS,
};
