// The salary certificate (certificat de salaire, Lohnausweis): federal form 11, the same in every
// canton, so its keys are shared (docs/design/cantons.md, section 1). One value per certificate:
// the instance is the document id. Box numbers and labels come from the official guide, never from
// memory: std-lohnausweis-wegleitung-2026-fr, page and Cm (chiffre marginal) in each `source`.
import type { KeyDef, KeyRegistry } from '@taxpresso/ledger';

const WAGE_GUIDE = 'std-lohnausweis-wegleitung-2026-fr';
/** Up to CHF 100 million, in centimes. A sanity bound, not a tax constant. */
const MAX = 100_000_000_00;

/** One salary certificate box: per person, one value per certificate. */
const box = (b: string, en: string, fr: string, official: string, where: string): KeyDef => ({
  type: 'money',
  min: 0,
  max: MAX,
  perPerson: true,
  multiple: true,
  label: { en, fr },
  official,
  source: `${WAGE_GUIDE} ${where}`,
  box: b,
});

const tick = (b: string, en: string, fr: string, official: string, where: string): KeyDef => ({
  type: 'boolean',
  perPerson: true,
  multiple: true,
  label: { en, fr },
  official,
  source: `${WAGE_GUIDE} ${where}`,
  box: b,
});

export const KEYS_SALARY_CERTIFICATE_2026 = {
  'salary.base': box('1', 'Salary', 'Salaire', 'Salaire', 'p. 9 (Cm 13)'),
  'salary.board_lodging': box(
    '2.1',
    'Board and lodging from your employer',
    'Pension et logement fournis par l’employeur',
    'Pension et logement',
    'p. 10 (Cm 20)',
  ),
  'salary.company_car': box(
    '2.2',
    'Private use of a company car',
    'Part privée du véhicule de service',
    'Part privée pour le véhicule de service',
    'p. 10 (Cm 21)',
  ),
  'salary.other_fringe': box(
    '2.3',
    'Other benefits in kind',
    'Autres prestations salariales accessoires',
    'Autres prestations salariales accessoires',
    'p. 11 (Cm 26)',
  ),
  'salary.non_periodic': box(
    '3',
    'One-off payments (bonus and the like)',
    'Prestations non périodiques (bonus, etc.)',
    'Prestations non périodiques',
    'p. 11 (Cm 27)',
  ),
  'salary.capital': box(
    '4',
    'Capital payments',
    'Prestations en capital',
    'Prestations en capital',
    'p. 12 (Cm 28)',
  ),
  'salary.participations': box(
    '5',
    'Employee shares or options',
    'Participations de collaborateur',
    'Droits de participation selon feuille annexe',
    'p. 12 (Cm 29)',
  ),
  'salary.board_fees': box(
    '6',
    'Board member fees',
    'Indemnités de membre de conseil d’administration',
    'Indemnités des membres de conseils d’administration',
    'p. 13 (Cm 30)',
  ),
  'salary.other_benefits': box(
    '7',
    'Other payments, such as benefits paid through your employer',
    'Autres prestations, par exemple des indemnités versées par l’employeur',
    'Autres prestations',
    'p. 13 (Cm 31 to 35)',
  ),
  'salary.gross': box(
    '8',
    'Total gross salary',
    'Salaire brut total',
    'Salaire brut total / rente',
    'p. 14 (Cm 41)',
  ),
  'salary.social_contributions': box(
    '9',
    'Social insurance contributions',
    'Cotisations aux assurances sociales',
    'Cotisations AVS/AI/APG/AC/AANP',
    'p. 14 (Cm 42)',
  ),
  'salary.lpp_ordinary': box(
    '10.1',
    'Pension fund contributions',
    'Cotisations ordinaires au 2e pilier',
    'Prévoyance professionnelle, cotisations ordinaires',
    'p. 14 (Cm 44)',
  ),
  'salary.lpp_buyin': box(
    '10.2',
    'Pension fund buy-in taken from your salary',
    'Rachat au 2e pilier retenu sur le salaire',
    'Prévoyance professionnelle, cotisations pour le rachat',
    'p. 15 (Cm 45)',
  ),
  'salary.net': box('11', 'Net salary', 'Salaire net', 'Salaire net / rente', 'p. 15 (Cm 47)'),
  'salary.source_tax': box(
    '12',
    'Tax withheld at source',
    'Impôt retenu à la source',
    'Retenue de l’impôt à la source',
    'p. 15 (Cm 48)',
  ),
  'salary.expenses_travel': box(
    '13.1.1',
    'Travel, meal and hotel costs refunded',
    'Frais de voyage, de repas et de nuitée remboursés',
    'Frais effectifs de voyage, de repas et de nuitée',
    'p. 17 (Cm 53)',
  ),
  'salary.expenses_other': box(
    '13.1.2',
    'Other costs refunded',
    'Autres frais remboursés',
    'Autres frais effectifs',
    'p. 17 (Cm 54)',
  ),
  'salary.allowance_representation': box(
    '13.2.1',
    'Flat allowance for representation',
    'Forfait pour frais de représentation',
    'Frais forfaitaires de représentation',
    'p. 17 (Cm 56)',
  ),
  'salary.allowance_car': box(
    '13.2.2',
    'Flat allowance for your car',
    'Forfait pour frais de voiture',
    'Frais forfaitaires de voiture',
    'p. 17 (Cm 57)',
  ),
  'salary.allowance_other': box(
    '13.2.3',
    'Other flat allowances',
    'Autres forfaits pour frais',
    'Autres frais forfaitaires',
    'p. 18 (Cm 58)',
  ),
  'salary.free_transport': tick(
    'F',
    'Free transport to work (box F ticked)',
    'Transport gratuit pour aller au travail (case F cochée)',
    'Transport gratuit entre le domicile et le lieu de travail',
    'p. 8 (Cm 9)',
  ),
  'salary.canteen': tick(
    'G',
    'Canteen meals or meal vouchers (box G ticked)',
    'Cantine ou chèques-repas (case G cochée)',
    'Repas dans une cantine / chèques-repas',
    'p. 8 (Cm 10)',
  ),
  'salary.indemnities_included': tick(
    '15',
    'Insurance, APG or unemployment benefits paid through your employer (remark in box 15)',
    'Indemnités (assurance, APG, chômage) versées par l’employeur (remarque au chiffre 15)',
    'Observations',
    'p. 19 (Cm 64)',
  ),
  // Boxes the salary certificate barcode carries too (Swissdec SalaryDeclarationTxAB.xsd:
  // Charges/Education is c13.3, OtherFringeBenefits c14, StandardRemark and Remark c15).
  'salary.education': box(
    '13.3',
    'Further training paid by your employer',
    'Formation continue payée par l’employeur',
    'Contributions de l’employeur pour la formation continue ou le perfectionnement professionnel',
    'p. 18 (Cm 61)',
  ),
  'salary.relocation_costs': box(
    '15',
    'Moving costs paid by your employer (remark in box 15)',
    'Frais de déménagement payés par l’employeur (remarque au chiffre 15)',
    'Frais de déménagement',
    'p. 19 (Cm 71)',
  ),
  'salary.other_fringe_note': {
    type: 'string',
    perPerson: true,
    multiple: true,
    label: {
      en: 'Other benefits, described without an amount (box 14)',
      fr: 'Autres prestations salariales accessoires, sans montant (chiffre 14)',
    },
    official: 'Autres prestations salariales accessoires',
    source: `${WAGE_GUIDE} p. 18 (Cm 62)`,
    box: '14',
  },
  'salary.remarks': {
    type: 'string',
    perPerson: true,
    multiple: true,
    label: { en: 'Remarks (box 15)', fr: 'Observations (chiffre 15)' },
    official: 'Observations',
    source: `${WAGE_GUIDE} p. 19 (Cm 63)`,
    box: '15',
  },
} as const satisfies KeyRegistry;

export type SalaryCertificateKey = keyof typeof KEYS_SALARY_CERTIFICATE_2026;

/** The values a salary certificate gives, in the order of the form (the schema Claude reads it against). */
export const SALARY_CERTIFICATE_FIELDS_2026: readonly SalaryCertificateKey[] = [
  'salary.base',
  'salary.board_lodging',
  'salary.company_car',
  'salary.other_fringe',
  'salary.non_periodic',
  'salary.capital',
  'salary.participations',
  'salary.board_fees',
  'salary.other_benefits',
  'salary.gross',
  'salary.social_contributions',
  'salary.lpp_ordinary',
  'salary.lpp_buyin',
  'salary.net',
  'salary.source_tax',
  'salary.expenses_travel',
  'salary.expenses_other',
  'salary.allowance_representation',
  'salary.allowance_car',
  'salary.allowance_other',
  'salary.education',
  'salary.other_fringe_note',
  'salary.free_transport',
  'salary.canteen',
  'salary.indemnities_included',
  'salary.relocation_costs',
  'salary.remarks',
];
