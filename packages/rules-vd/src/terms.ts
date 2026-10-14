// The official terms of the Vaud return that the generic texts need (packages/rules-ch, terms.ts):
// what was given for each line with a limit, by the rule that set it (LimitApplied.rule), the names
// of the taxes, the tax office and asking for more time, the plans' words, and the official
// documents each rule links to. Terms as printed on the Vaud return (vd-2025-form-21010), in its
// guide (vd-2025-guide) and the canton's directive on more time to file (vd-2025-delais-directive).
// The extension builds the final check's words from them, with the canton's name and software from
// its registry.
import type { CantonTerms } from '@taxpresso/rules-ch';
import { VD_OFFICIAL_DOCUMENTS } from './official-documents.js';
import { FEDERAL_RUBRICS, rubric, wealthRubric } from './rubrics.js';

export const VD_TERMS: CantonTerms = {
  // The return's own label first; the worksheet's federal lines, then the wealth lines.
  label: (code) =>
    rubric(code)?.label ??
    (FEDERAL_RUBRICS as Record<string, { label: { en: string; fr: string } }>)[code]?.label ??
    wealthRubric(code)?.label,
  given: {
    commute: 'Frais de transport',
    meals: 'Repas pris hors du domicile',
    'professional.other': 'Autres frais professionnels',
    pillar3a: 'Prévoyance individuelle liée (3e pilier A)',
    training: 'Frais de perfectionnement et de formation',
    debt_interest: 'Intérêts des dettes privées',
    insurance: 'Assurances maladie et accidents, assurances sur la vie',
    savings_interest: 'Intérêts de capitaux d’épargne',
    party: 'Versements à des partis politiques',
    childcare: 'Déduction pour frais de garde',
    medical: 'Frais médicaux et dentaires',
    donations: 'Dons à des institutions d’utilité publique',
  },
  taxes: {
    icc: 'impôt cantonal et communal',
    ifd: 'impôt fédéral direct',
    both: 'impôt cantonal et communal et impôt fédéral direct',
  },
  salaryCertificate: 'certificat de salaire',
  taxOffice: 'Administration cantonale des impôts, ACI',
  moreTime: 'demande de délai',
  // The deadline and the requests for more time, online or in writing (Demandes de délais unitaires).
  moreTimeSource: 'vd-2025-delais-directive p. 1',
  securitiesList: 'état des titres',
  priceList: 'liste des cours',
  pillar3a: 'prévoyance individuelle liée (3e pilier A)',
  pensionBuyIn: 'rachat d’années d’assurance (2e pilier)',
  pillar3aCatchUp: 'rachat dans la prévoyance individuelle liée (3e pilier A)',
  sourceTax: 'impôt à la source',
  sourceTaxAssessment: 'TOU (taxation ordinaire ultérieure)',
  /** The official Vaud documents, for the links of each rule cited. */
  documents: VD_OFFICIAL_DOCUMENTS,
};
