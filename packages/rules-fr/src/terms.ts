// The official terms of the Fribourg return that the generic texts need (packages/rules-ch,
// terms.ts): what was given for each line with a limit, by the rule that set it
// (LimitApplied.rule), the names of the taxes, the tax office and asking for more time, the plans'
// words, and the official documents each rule links to. Terms as the 2025 guide prints the codes of
// the return (fr-2025-guide-instructions-generales) and the canton's page on more time to file
// (fr-na-delais-depot: CHF 20 paid with the QR bill that comes with the return, or a written
// request). The extension builds the final check's words from them, with the canton's name and
// software from its registry.
import type { CantonTerms } from '@taxpresso/rules-ch';
import { FR_OFFICIAL_DOCUMENTS } from './official-documents.js';
import { anyRubric } from './rubrics.js';

export const FR_TERMS: CantonTerms = {
  label: (code) => anyRubric(code)?.label,
  given: {
    commute: 'Frais de transport',
    meals: 'Repas ou séjour hors du domicile',
    'professional.flat': 'Autres frais professionnels',
    'professional.other': 'Autres frais professionnels',
    pillar3a: 'Formes reconnues de prévoyance individuelle liée (3e pilier a)',
    training: 'Frais de formation et de perfectionnement',
    debt_interest: 'Intérêts passifs privés',
    insurance: 'Autres primes et cotisations (3e pilier b)',
    savings_interest: 'Déduction des intérêts de capitaux d’épargne',
    party: 'Versements aux partis politiques',
    childcare: 'Frais de garde des enfants',
    medical: 'Frais médicaux',
    donations: 'Versements bénévoles',
  },
  taxes: {
    icc: 'impôts cantonal et communal',
    ifd: 'impôt fédéral direct',
    both: 'impôts cantonal et communal et impôt fédéral direct',
  },
  salaryCertificate: 'certificat de salaire',
  taxOffice: 'Service cantonal des contributions, SCC',
  moreTime: 'délai pour le dépôt de la déclaration',
  // More time to file: CHF 20 paid with the return's QR bill, or a written request.
  moreTimeSource: 'fr-na-delais-depot p. 1',
  securitiesList: 'état des titres (annexe 01)',
  priceList: 'liste des cours',
  pillar3a: 'prévoyance individuelle liée (3e pilier a)',
  pensionBuyIn: 'rachat d’années d’assurance (2e pilier)',
  pillar3aCatchUp: 'rachat dans le pilier 3a',
  sourceTax: 'impôt à la source',
  sourceTaxAssessment: 'TOU (taxation ordinaire ultérieure)',
  /** The official Fribourg documents, for the links of each rule cited. */
  documents: FR_OFFICIAL_DOCUMENTS,
};
