// The official terms of the Basel-Landschaft return that the generic texts need (packages/rules-ch,
// terms.ts): what was given for each line with a limit, by the rule that set it
// (LimitApplied.rule), the names of the two columns, the tax office and asking for more time, the
// plans' words, and the official documents each rule links to. Terms as printed on the return
// (bl-2026-steuererklaerung-form p. 1 to 4) and in its guide (bl-2026-wegleitung: p. 9 for more
// time, "Gesuch um Fristerstreckung", online at www.steuern.bl.ch). The extension builds the final
// check's words from them, with the canton's name and software from its registry.
import type { CantonTerms } from '@taxpresso/rules-ch';
import { BL_OFFICIAL_DOCUMENTS } from './official-documents.js';
import { rubric, wealthRubric } from './rubrics.js';

export const BL_TERMS: CantonTerms = {
  label: (code) => rubric(code)?.label ?? wealthRubric(code)?.label,
  given: {
    commute: 'Fahrtkosten zwischen Wohn- und Arbeitsstätte',
    meals: 'Mehrkosten für auswärtige Verpflegung',
    'professional.other': 'Übrige berufsnotwendige Kosten',
    pillar3a: 'Beiträge 3. Säule',
    training: 'Aus- und Weiterbildungskosten',
    debt_interest: 'Private übrige Schuldzinsen',
    insurance: 'Versicherungsprämien und Zinsen von Sparkapitalien',
    party: 'Zuwendungen an politische Parteien',
    childcare: 'Kinderbetreuung durch Dritte',
    medical: 'Krankheits- und Unfallkosten',
    donations: 'Freiwillige Zuwendungen',
  },
  taxes: {
    icc: 'Staatssteuer',
    ifd: 'Bundessteuer',
    both: 'Staatssteuer und Bundessteuer',
  },
  salaryCertificate: 'Lohnausweis',
  taxOffice: 'Steuerverwaltung Basel-Landschaft',
  moreTime: 'Fristerstreckung',
  // "Was tun bei Terminproblemen?": the online request, and the two months granted tacitly.
  moreTimeSource: 'bl-2026-wegleitung p. 9',
  securitiesList: 'Wertschriften- und Guthabenverzeichnis',
  priceList: 'Kursliste',
  pillar3a: 'Säule 3a',
  pensionBuyIn: 'Einkäufe 2. Säule (Pensionskasse)',
  pillar3aCatchUp: 'Nachträglicher Einkauf in die Säule 3a',
  sourceTax: 'Quellensteuer',
  sourceTaxAssessment: 'NOV (nachträgliche ordentliche Veranlagung)',
  /** The official Basel-Landschaft documents, for the links of each rule cited. */
  documents: BL_OFFICIAL_DOCUMENTS,
};
