// The lines of the Fribourg return the engine computes, with the official French term and its gloss.
// The codes are those the 2025 guide explains, code by code (fr-2025-guide-instructions-generales;
// "p." is the PDF page, the guide prints one less); the return itself is not in the sources library
// (docs/sources/fr/NOTES.md, Gaps), and the 2026 guide is not published yet. Codes 1.xxx to 4.xxx
// are per person (a column for each) where the person is known; the rest are the household's. Code
// 3.210 and 4.210 have an income and a wealth column, and 7.110 is the modest income deduction in
// the income column and the social deduction on wealth in the wealth column: the income line is in
// the income items, the wealth line in the wealth items. The guide groups the loss-of-earnings
// allowances under codes 1.510 to 1.530 without saying which is which: the engine puts them on
// 1.510, and the filing step must split them by the form.
import type { Text } from '@taxpresso/rules-ch';

const GUIDE = 'fr-2025-guide-instructions-generales';

export interface Rubric {
  label: Text;
  source: string;
}

const r = (code: string, fr: string, en: string, page: string): Rubric => ({
  label: { en: `${en} (${fr})`, fr },
  source: `${GUIDE} p. ${page} (code ${code})`,
});

export const RUBRICS = {
  // Income (revenu).
  '1.110': r('1.110', 'Activité salariée principale', 'Main employment, net salary', '8'),
  '1.120': r('1.120', 'Activité salariée accessoire', 'Side job, net salary', '9'),
  '1.510': r(
    '1.510',
    'Indemnités pour perte de gain',
    'Unemployment, sickness, accident and loss-of-earnings allowances',
    '10',
  ),
  '3.110': r('3.110', '1er pilier: rentes AVS et AI', 'AVS/AI pensions', '14'),
  '3.120': r(
    '3.120',
    '2e pilier: rentes provenant d’institutions de prévoyance professionnelle',
    'Pension fund pensions',
    '14',
  ),
  '3.140': r('3.140', '3e pilier b: autres rentes et pensions', 'Other pensions', '14 and 15'),
  '3.150': r(
    '3.150',
    'Pension alimentaire obtenue par le/la contribuable et/ou pour les enfants mineurs',
    'Alimony and child support received',
    '15',
  ),
  '3.210': r(
    '3.210',
    'Titres et autres placements de capitaux, rendement',
    'Income from accounts and securities',
    '15',
  ),
  '3.410': r('3.410', 'Autres revenus', 'Other income', '22'),
  // Costs and general deductions, down to the net income (4.910).
  '2.110': r('2.110', 'Frais de transport', 'Travel to work', '11 and 12'),
  '2.120': r('2.120', 'Repas ou séjour hors du domicile', 'Lunch away from home', '12'),
  '2.130': r('2.130', 'Autres frais professionnels', 'Other professional costs', '13'),
  '2.140': r(
    '2.140',
    'Frais pour activité accessoire salariée',
    'Professional costs of a side job',
    '13',
  ),
  '2.510': r(
    '2.510',
    'Déduction pour activité lucrative des deux conjoints',
    'Both spouses work',
    '14',
  ),
  '4.110': r(
    '4.110',
    'Caisse-maladie et accidents',
    'Health and accident insurance, flat amount',
    '24',
  ),
  '4.120': r(
    '4.120',
    'Autres primes et cotisations (3e pilier b)',
    'Life and other insurance premiums',
    '24',
  ),
  '4.130': r(
    '4.130',
    'Formes reconnues de prévoyance individuelle liée (3e pilier a)',
    'Pillar 3a',
    '25',
  ),
  '4.140': r(
    '4.140',
    'Rachats d’années d’assurance (2e pilier, caisse de pension)',
    'Pension fund buy-ins paid directly',
    '25 and 26',
  ),
  '4.150': r('4.150', 'Déduction des intérêts de capitaux d’épargne', 'Interest on savings', '26'),
  '4.210': r('4.210', 'Intérêts passifs privés', 'Private debt interest', '26 and 27'),
  '4.320': r('4.320', 'Frais d’administration de titres', 'Costs of keeping securities', '30'),
  '4.340': r('4.340', 'Pension alimentaire versée', 'Alimony and child support paid', '31'),
  '4.380': r('4.380', 'Frais de garde des enfants', 'Childcare', '32'),
  '4.410': r('4.410', 'Versements aux partis politiques', 'Payments to political parties', '33'),
  '4.420': r('4.420', 'Frais de formation et de perfectionnement', 'Professional training', '33'),
  // From the net income (4.910) to the taxable income (7.910).
  '5.110': r('5.110', 'Frais médicaux', 'Medical, pharmaceutical and dental costs', '33 and 34'),
  '5.120': r('5.120', 'Versements bénévoles', 'Donations', '34'),
  '6.110': r('6.110', 'Déductions sociales pour enfants', 'Child deduction', '34 and 35'),
  '7.110': r(
    '7.110',
    'Déduction pour contribuables à revenu modeste',
    'Modest income deduction',
    '37 and 38',
  ),
} as const satisfies Record<string, Rubric>;

/** Wealth (fortune) lines: assets and debts at their value on 31 December, then the social deduction. */
export const WEALTH_RUBRICS = {
  '3.210': r('3.210', 'Titres et autres placements de capitaux', 'Accounts and securities', '15'),
  '3.230': r(
    '3.230',
    'Numéraire, billets de banque, or et autres métaux précieux',
    'Cash, gold and other precious metals',
    '19',
  ),
  '3.510': r('3.510', 'Autos, bateaux, etc.', 'Cars, boats and the like', '22'),
  '3.520': r(
    '3.520',
    'Assurances sur la vie et assurances de rentes',
    'Life insurance, surrender value',
    '23',
  ),
  '3.530': r(
    '3.530',
    'Collections, œuvres d’art, bijoux, etc.',
    'Collections, works of art, jewellery and other assets',
    '23',
  ),
  '4.210': r('4.210', 'Dettes privées', 'Private debts', '26 and 27'),
  '7.110': r('7.110', 'Déduction sociale sur la fortune', 'Social deduction on wealth', '39'),
} as const satisfies Record<string, Rubric>;

export type RubricCode = keyof typeof RUBRICS;
export type WealthCode = keyof typeof WEALTH_RUBRICS;

export function rubric(code: string): Rubric | undefined {
  return (RUBRICS as Record<string, Rubric>)[code];
}

export function wealthRubric(code: string): Rubric | undefined {
  return (WEALTH_RUBRICS as Record<string, Rubric>)[code];
}

/** Income lines: the total of the income. */
export const INCOME = new Set<string>([
  '1.110',
  '1.120',
  '1.510',
  '3.110',
  '3.120',
  '3.140',
  '3.150',
  '3.210',
  '3.410',
]);
/** Costs and general deductions, down to the net income (4.910). */
export const DEDUCTIONS = new Set<string>([
  '2.110',
  '2.120',
  '2.130',
  '2.140',
  '2.510',
  '4.110',
  '4.120',
  '4.130',
  '4.140',
  '4.150',
  '4.210',
  '4.320',
  '4.340',
  '4.380',
  '4.410',
  '4.420',
]);
/** Medical costs and donations, on the net income (4.910). */
export const COSTS = new Set<string>(['5.110', '5.120']);
/** Social deductions, down to 6.910. */
export const SOCIAL = new Set<string>(['6.110']);
/** The modest income deduction, on 6.910, down to the taxable income (7.910). */
export const MODEST = new Set<string>(['7.110']);
/** Wealth: assets, debts, then the social deduction on wealth. */
export const ASSETS = new Set<string>(['3.210', '3.230', '3.510', '3.520', '3.530']);
export const DEBTS = new Set<string>(['4.210']);
export const WEALTH_SOCIAL = new Set<string>(['7.110']);
