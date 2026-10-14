// The official terms of Ticino's return that the generic texts need (packages/rules-ch, terms.ts):
// what was given for each line with a limit, by the rule that set it (LimitApplied.rule), the names
// of the two taxes, the tax office and asking for more time, the plans' words, and the official
// documents each rule links to. Terms as printed on Modulo 4, 5 and 6 (ti-2025-form-modulo-4,
// ti-2025-form-modulo-5, ti-2025-form-modulo-6) and in the 2025 instructions
// (ti-2025-guide-istruzioni-pf-pdf): the return goes to the Ufficio circondariale di tassazione, and
// more time (proroga) is asked for online from the Divisione delle contribuzioni at
// www.ti.ch/pf-proroga (ti-2025-efiling-proroga). The extension builds the final check's words from
// them, with the canton's name and software from its registry.
import type { CantonTerms } from '@taxpresso/rules-ch';
import { TI_OFFICIAL_DOCUMENTS } from './official-documents.js';
import { federalRubric, wealthRubric } from './rubrics.js';

export const TI_TERMS: CantonTerms = {
  label: (code) => federalRubric(code)?.label ?? wealthRubric(code)?.label,
  given: {
    commute: 'Spese di trasporto dal domicilio al luogo di lavoro',
    meals: 'Pasto principale fuori casa',
    'professional.flat': 'Altre spese professionali, forfait',
    'professional.other': 'Altre spese professionali, spese effettive',
    pillar3a: 'Previdenza individuale vincolata (3° pilastro A)',
    training: 'Spese di formazione e formazione continua professionali',
    debt_interest: 'Interessi passivi privati',
    insurance: 'Oneri assicurativi e interessi di capitali a risparmio',
    party: 'Versamenti a partiti politici',
    childcare: 'Cura prestata da terzi a figli/ie di età inferiore ai 14 anni',
    medical: 'Spese per malattia e infortunio',
    donations: 'Liberalità a enti di pubblica utilità',
  },
  // One return for both taxes: the federal tax is derived from it (ti-2025-guide-istruzioni-pf-pdf
  // p. 47).
  taxes: {
    icc: 'imposta cantonale e comunale',
    ifd: 'imposta federale diretta',
    both: 'imposta cantonale, comunale e federale diretta',
  },
  salaryCertificate: 'certificato di salario',
  taxOffice: 'Divisione delle contribuzioni',
  moreTime: 'proroga',
  // Online at www.ti.ch/pf-proroga, with the registry number and the date of birth.
  moreTimeSource: 'ti-2025-efiling-proroga (Richiesta di proroga)',
  securitiesList: 'Elenco dei titoli e di altri collocamenti di capitali (Modulo 2)',
  priceList: 'listino dei corsi',
  pillar3a: 'Previdenza individuale vincolata (3° pilastro A)',
  pensionBuyIn: 'Riscatti di anni di assicurazione (2° pilastro)',
  pillar3aCatchUp: 'Riscatto nel 3° pilastro A',
  sourceTax: 'imposta alla fonte',
  sourceTaxAssessment: 'TOU (tassazione ordinaria ulteriore)',
  /** The official Ticino documents, for the links of each rule cited. */
  documents: TI_OFFICIAL_DOCUMENTS,
};
