// The official terms of the Lucerne return that the generic texts need (packages/rules-ch,
// terms.ts): what was given for each line with a limit, by the rule that set it
// (LimitApplied.rule), the names of the two taxes, the tax office and asking for more time, the
// plans' words, and the official documents each rule links to. Terms as printed on the return and
// its forms (lu-2025-guide-wegleitung p. 13 to 19, the sample return; p. 27 to 36, the Ziffern) and
// on the guide's page on more time (p. 10, "Was bei Terminproblemen?": e-Fristerstreckung at
// steuern.lu.ch, else in writing to the Gemeindesteueramt). The extension builds the final check's
// words from them, with the canton's name and software from its registry.
import type { CantonTerms } from '@taxpresso/rules-ch';
import { LU_OFFICIAL_DOCUMENTS } from './official-documents.js';
import { anyRubric } from './rubrics.js';

export const LU_TERMS: CantonTerms = {
  label: (code) => anyRubric(code)?.label,
  given: {
    commute: 'Fahrkosten zwischen Wohn- und Arbeitsstätte',
    meals: 'Mehrkosten der Verpflegung',
    'professional.flat': 'Übrige für die Ausübung des Berufes erforderliche Kosten',
    'professional.other': 'Übrige für die Ausübung des Berufes erforderliche Kosten',
    pillar3a: 'Beiträge an anerkannte Formen der gebundenen Selbstvorsorge (Säule 3a)',
    training: 'Berufsorientierte Aus- und Weiterbildung',
    debt_interest: 'Schuldzinsen',
    insurance: 'Versicherungsprämien und Zinsen von Sparkapitalien',
    party: 'Zuwendungen und Beiträge an politische Parteien',
    childcare: 'Fremdbetreuungskosten',
    medical: 'Krankheits-, Unfall- und behinderungsbedingte Kosten',
    donations: 'Freiwillige Zuwendungen',
  },
  taxes: {
    icc: 'Staats- und Gemeindesteuern',
    ifd: 'direkte Bundessteuer',
    both: 'Staats- und Gemeindesteuern und direkte Bundessteuer',
  },
  salaryCertificate: 'Lohnausweis',
  // Employees and people without paid work deal with their commune's tax office
  // (docs/sources/lu/NOTES.md, Filing channels; lu-2025-guide-wegleitung p. 10).
  taxOffice: 'Gemeindesteueramt',
  moreTime: 'Fristerstreckung (e-Fristerstreckung)',
  moreTimeSource: 'lu-2025-guide-wegleitung p. 10',
  securitiesList: 'Wertschriften- und Guthabenverzeichnis (WV)',
  priceList: 'Kursliste',
  pillar3a: 'Säule 3a',
  pensionBuyIn: 'Beiträge an 2. Säule (Einkauf)',
  pillar3aCatchUp: 'Einkauf in die Säule 3a',
  sourceTax: 'Quellensteuer',
  sourceTaxAssessment: 'NOV (nachträgliche ordentliche Veranlagung)',
  /** The official Lucerne documents, for the links of each rule cited. */
  documents: LU_OFFICIAL_DOCUMENTS,
};
