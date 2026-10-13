// Keys for values read from documents (SPEC.md sections 5.3, 5.5 and 10.8). They repeat, one value
// per document: the instance is the document id. Box numbers and labels come from the official
// documents, never from memory:
// - salary certificate (Formulaire 11): std-lohnausweis-wegleitung-2026-fr, page and Cm (chiffre
//   marginal) in each `source`;
// - Geneva terms: ge-2025-guide-declaration-pp (the 2025 guide; the 2026 guide is published in
//   January 2027 and re-opens every label that cites it);
// - the assessment and the objection: ge-na-law-lpfisc and ch-na-law-lifd.
import type { DocumentKind, KeyDef, KeyRegistry } from '@taxpresso/ledger';

const WAGE_GUIDE = 'std-lohnausweis-wegleitung-2026-fr';
const GE_GUIDE = 'ge-2025-guide-declaration-pp';
/** Up to CHF 100 million, in centimes. A sanity bound, not a tax constant. */
const MAX = 100_000_000_00;

const money = (
  perPerson: boolean,
  label: KeyDef['label'],
  official: string,
  source: string,
  box?: string,
): KeyDef => ({
  type: 'money',
  min: 0,
  max: MAX,
  perPerson,
  multiple: true,
  label,
  official,
  source,
  ...(box ? { box } : {}),
});

/** One salary certificate box: per person, one value per certificate. */
const box = (b: string, en: string, fr: string, official: string, where: string): KeyDef =>
  money(true, { en, fr }, official, `${WAGE_GUIDE} ${where}`, b);

const tick = (b: string, en: string, fr: string, official: string, where: string): KeyDef => ({
  type: 'boolean',
  perPerson: true,
  multiple: true,
  label: { en, fr },
  official,
  source: `${WAGE_GUIDE} ${where}`,
  box: b,
});

export const DOCUMENT_KEYS_2026 = {
  // Salary certificate, federal form 11 (certificat de salaire).
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

  // Other attestations.
  'pillar3a.paid': money(
    true,
    { en: 'Paid into pillar 3a', fr: 'Versé au 3e pilier A' },
    'Cotisations 3e pilier A',
    `${GE_GUIDE} p. 18`,
  ),
  'lpp.buyin': money(
    true,
    { en: 'Pension fund buy-in (2nd pillar)', fr: 'Rachat de prévoyance professionnelle' },
    'Rachats de la prévoyance professionnelle',
    `${GE_GUIDE} p. 18`,
  ),
  'health.premiums': money(
    false,
    { en: 'Health insurance premiums paid', fr: 'Primes d’assurance-maladie payées' },
    'Primes d’assurance-maladie',
    `${GE_GUIDE} p. 29`,
  ),
  'health.subsidy': money(
    false,
    { en: 'Health insurance subsidy received', fr: 'Subside d’assurance-maladie reçu' },
    'Subsides de l’assurance-maladie',
    `${GE_GUIDE} p. 27`,
  ),
  'medical.costs': money(
    false,
    { en: 'Medical costs you paid', fr: 'Frais médicaux payés' },
    'Frais médicaux',
    `${GE_GUIDE} p. 14`,
  ),
  'childcare.costs': money(
    false,
    { en: 'Childcare costs paid', fr: 'Frais de garde payés' },
    'Frais de garde des enfants',
    `${GE_GUIDE} p. 30`,
  ),
  'donation.amount': money(false, { en: 'Donation', fr: 'Don' }, 'Dons', `${GE_GUIDE} p. 15`),
  'debt.interest': money(
    false,
    { en: 'Interest paid on a private loan', fr: 'Intérêts payés sur un emprunt privé' },
    'Intérêts de dettes privées',
    `${GE_GUIDE} p. 37`,
  ),
  'debt.balance': money(
    false,
    { en: 'Debt on 31 December', fr: 'Dette au 31 décembre' },
    'Dettes chirographaires et hypothécaires',
    `${GE_GUIDE} p. 37`,
  ),
  'replacement.amount': money(
    true,
    {
      en: 'Benefits received (unemployment, APG, sickness, accident)',
      fr: 'Indemnités reçues (chômage, APG, maladie, accident)',
    },
    'Perte de salaire, chômage, maladie, accident, militaire',
    `${GE_GUIDE} p. 17`,
  ),
  'replacement.type': {
    type: 'enum',
    values: [
      'unemployment',
      'apg_service',
      'maternity_paternity',
      'sickness_accident',
      'disability',
      'other',
    ],
    perPerson: true,
    multiple: true,
    label: { en: 'Kind of benefit', fr: 'Type d’indemnité' },
    official: 'Perte de salaire, chômage, maladie, accident, militaire',
    source: `${GE_GUIDE} p. 17`,
  },
  'replacement.paid_to_employer': {
    type: 'boolean',
    perPerson: true,
    multiple: true,
    label: {
      en: 'Paid to your employer, who passed it on with your salary',
      fr: 'Versé à votre employeur, qui l’a payé avec le salaire',
    },
    official: 'indemnités versées par l’employeur',
    source: `${WAGE_GUIDE} p. 13 (Cm 34, 35)`,
  },
  'pension.amount': money(
    true,
    { en: 'Pension received', fr: 'Rente reçue' },
    'Rentes',
    `${GE_GUIDE} p. 25`,
  ),
  'pension.type': {
    type: 'enum',
    values: ['avs_ai', 'occupational', 'other'],
    perPerson: true,
    multiple: true,
    label: { en: 'Kind of pension', fr: 'Type de rente' },
    official: 'Rentes AVS / AI, rentes de la prévoyance professionnelle, autres rentes',
    source: `${GE_GUIDE} p. 25 and 26`,
  },

  // The tax office's assessment: bordereaux ICC and IFD and the avis de taxation
  // (ge-2025-guide-declaration-pp p. 53). Household figures, one set per assessment document.
  'assessment.tax': {
    type: 'enum',
    values: ['icc', 'ifd', 'icc_ifd'],
    perPerson: false,
    multiple: true,
    label: { en: 'Which tax it is for', fr: 'Impôt concerné' },
    official: 'ICC (impôt cantonal et communal), IFD (impôt fédéral direct)',
    source: `${GE_GUIDE} p. 53`,
  },
  'assessment.notification_date': {
    type: 'date',
    perPerson: false,
    multiple: true,
    label: { en: 'Date of the assessment', fr: 'Date de la taxation' },
    official: 'notification de la décision de taxation',
    source: 'ge-na-law-lpfisc art. 39 al. 1; ch-na-law-lifd art. 132 al. 1 (p. 71)',
  },
  'assessment.taxable_income': money(
    false,
    { en: 'Taxable income', fr: 'Revenu imposable' },
    'Revenu imposable',
    'ch-na-law-lifd art. 131 al. 1 (p. 70)',
  ),
  'assessment.taxable_wealth': money(
    false,
    { en: 'Taxable wealth', fr: 'Fortune imposable' },
    'Fortune imposable',
    `${GE_GUIDE} p. 52`,
  ),
  'assessment.tax_amount': money(
    false,
    { en: 'Tax amount', fr: 'Montant de l’impôt' },
    'Montant de l’impôt',
    'ch-na-law-lifd art. 131 al. 1 (p. 70)',
  ),
  'assessment.salary_gross': money(
    false,
    { en: 'Gross salaries, as assessed', fr: 'Salaires bruts retenus' },
    'Salaires bruts',
    `${GE_GUIDE} p. 17`,
  ),
  'assessment.social_contributions': money(
    false,
    { en: 'Social insurance contributions, as assessed', fr: 'Cotisations AVS/AI retenues' },
    'Cotisations AVS / AI / APG / Chômage',
    `${GE_GUIDE} p. 18`,
  ),
  'assessment.lpp_contributions': money(
    false,
    { en: 'Pension fund contributions, as assessed', fr: 'Cotisations 2e pilier retenues' },
    'Cotisations 2e pilier',
    `${GE_GUIDE} p. 18`,
  ),
  'assessment.lpp_buyin': money(
    false,
    { en: 'Pension fund buy-ins, as assessed', fr: 'Rachats 2e pilier retenus' },
    'Rachats de la prévoyance professionnelle',
    `${GE_GUIDE} p. 18`,
  ),
  'assessment.pillar3a': money(
    false,
    { en: 'Pillar 3a, as assessed', fr: '3e pilier A retenu' },
    'Cotisations 3e pilier A',
    `${GE_GUIDE} p. 18`,
  ),
  'assessment.replacement_income': money(
    false,
    { en: 'Benefits (unemployment, APG...), as assessed', fr: 'Indemnités retenues' },
    'Perte de salaire, chômage, maladie, accident, militaire',
    `${GE_GUIDE} p. 17`,
  ),
  'assessment.pension': money(
    false,
    { en: 'Pensions, as assessed', fr: 'Rentes retenues' },
    'Rentes',
    `${GE_GUIDE} p. 25`,
  ),
  'assessment.health_premiums': money(
    false,
    { en: 'Health insurance premiums, as assessed', fr: 'Primes d’assurance-maladie retenues' },
    'Primes d’assurance-maladie',
    `${GE_GUIDE} p. 29`,
  ),
  'assessment.medical_costs': money(
    false,
    { en: 'Medical costs, as assessed', fr: 'Frais médicaux retenus' },
    'Frais médicaux',
    `${GE_GUIDE} p. 14`,
  ),
  'assessment.childcare': money(
    false,
    { en: 'Childcare costs, as assessed', fr: 'Frais de garde retenus' },
    'Frais de garde des enfants',
    `${GE_GUIDE} p. 30`,
  ),
  'assessment.donations': money(
    false,
    { en: 'Donations, as assessed', fr: 'Dons retenus' },
    'Dons',
    `${GE_GUIDE} p. 15`,
  ),
  'assessment.debt_interest': money(
    false,
    { en: 'Private loan interest, as assessed', fr: 'Intérêts de dettes privées retenus' },
    'Intérêts de dettes privées',
    `${GE_GUIDE} p. 37`,
  ),

  // A bank's e-tax statement (relevé fiscal, eCH-0196): its totals, as the "Relevés fiscaux" lines
  // of the securities list ask for them (ge-2025-guide-declaration-pp p. 43: one grouped line per
  // statement instead of every position). The same amounts as the statement's accounts and
  // securities (keys-ech0196.ts and keys-securities.ts): never add both.
  'statement.value_chf': money(
    false,
    {
      en: 'Taxable value on 31 December (statement total)',
      fr: 'Valeur imposable au 31 décembre (total du relevé)',
    },
    'Valeur imposable',
    `${GE_GUIDE} p. 43`,
  ),
  'statement.income_a_chf': money(
    false,
    {
      en: 'Gross income with Swiss withholding tax (statement total)',
      fr: 'Rendements bruts soumis à l’impôt anticipé (total du relevé)',
    },
    'Rendements bruts soumis à l’impôt anticipé',
    `${GE_GUIDE} p. 43`,
  ),
  'statement.income_b_chf': money(
    false,
    {
      en: 'Gross income without Swiss withholding tax (statement total)',
      fr: 'Rendements bruts non soumis à l’impôt anticipé (total du relevé)',
    },
    'Rendements bruts non soumis à l’impôt anticipé',
    `${GE_GUIDE} p. 43`,
  ),
  'statement.withholding_swiss_chf': money(
    false,
    {
      en: 'Swiss withholding tax to reclaim (statement total)',
      fr: 'Impôt anticipé à récupérer (total du relevé)',
    },
    'impôt anticipé (IA)',
    `${GE_GUIDE} p. 38`,
  ),

  // A short note from the user that settles a "Check this" item (SPEC.md section 5.8).
  // The instance is the check id.
  'check.note': {
    type: 'string',
    perPerson: false,
    multiple: true,
    label: { en: 'Your note on something to check', fr: 'Votre remarque sur un point à vérifier' },
  },
} as const satisfies KeyRegistry;

export type DocumentKey2026 = keyof typeof DOCUMENT_KEYS_2026;

/**
 * Which values each kind of document can give (the schema Claude reads against, SPEC.md 5.3).
 * Kinds not listed give no values yet: their details (whose, which year, period, issuer) still count.
 */
export const DOCUMENT_FIELDS_2026: Partial<Record<DocumentKind, readonly DocumentKey2026[]>> = {
  salary_certificate: [
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
  ],
  ech0196_statement: [
    'statement.value_chf',
    'statement.income_a_chf',
    'statement.income_b_chf',
    'statement.withholding_swiss_chf',
  ],
  pillar3a_attestation: ['pillar3a.paid'],
  lpp_buyin: ['lpp.buyin'],
  health_premiums: ['health.premiums', 'health.subsidy'],
  medical_invoice: ['medical.costs'],
  childcare_invoice: ['childcare.costs'],
  donation_receipt: ['donation.amount'],
  debt_interest: ['debt.interest', 'debt.balance'],
  replacement_income_certificate: [
    'replacement.amount',
    'replacement.type',
    'replacement.paid_to_employer',
  ],
  pension_certificate: ['pension.amount', 'pension.type'],
  tax_assessment: [
    'assessment.tax',
    'assessment.notification_date',
    'assessment.taxable_income',
    'assessment.taxable_wealth',
    'assessment.tax_amount',
    'assessment.salary_gross',
    'assessment.social_contributions',
    'assessment.lpp_contributions',
    'assessment.lpp_buyin',
    'assessment.pillar3a',
    'assessment.replacement_income',
    'assessment.pension',
    'assessment.health_premiums',
    'assessment.medical_costs',
    'assessment.childcare',
    'assessment.donations',
    'assessment.debt_interest',
  ],
};

/** The keys a document of this kind can give, or none. */
export function documentFields(kind: DocumentKind | undefined): readonly DocumentKey2026[] {
  return (kind && DOCUMENT_FIELDS_2026[kind]) || [];
}
