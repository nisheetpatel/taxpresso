// The rubrics (codes de rubrique) the engine computes, with the official French term and its gloss.
// Codes and terms as printed on the 2025 form, ge-2025-declaration-specimen (the 2026 form is
// published in January 2027), page given; the rules behind them in ge-2025-guide-declaration-pp.
// Taxpayer A's codes start with 1 or 3, taxpayer B's with 2 or 4 (specimen p. 5 and 6, A1 and A2).
import type { EnginePerson, Text } from './types.js';

const SPECIMEN = 'ge-2025-declaration-specimen';
const GUIDE = 'ge-2025-guide-declaration-pp';

export interface Rubric {
  label: Text;
  source: string;
}

const r = (fr: string, en: string, form: string, guide: string): Rubric => ({
  label: { fr, en: `${en} (${fr})` },
  source: `${SPECIMEN} ${form}; ${GUIDE} ${guide}`,
});

/** A rubric of annexe B (self-employment), explained in the guide for the self-employed. */
const b = (fr: string, en: string, form: string, guide: string): Rubric => ({
  label: { fr, en: `${en} (${fr})` },
  source: `${SPECIMEN} ${form}; ge-2025-guide-independants ${guide}`,
});

export const RUBRICS = {
  // Income.
  '11.10': r('Salaires bruts', 'Gross salaries', 'p. 5', 'p. 17'),
  '11.50': r(
    'Perte de salaire, chômage, maladie, accident, militaire',
    'Benefits replacing salary',
    'p. 5',
    'p. 17',
  ),
  // Self-employment, annexe B (specimen p. 8 to 10), the same codes for taxpayers A and B.
  '12.01': b('Bénéfice net', 'Net profit of your business', 'p. 8', 'p. 16'),
  '12.17': b('Total des recettes', 'Total revenue of your business', 'p. 8', 'p. 13'),
  '12.45': b('Total des charges commerciales', 'Total business charges', 'p. 8', 'p. 15'),
  '12.46': b('Bénéfice/(Perte)', 'Result of your accounts', 'p. 8', 'p. 15'),
  '57.10': b('Perte commerciale', 'Business loss', 'p. 8', 'p. 16'),
  '57.20': b('Pertes non compensées', 'Losses of earlier years not deducted yet', 'p. 8', 'p. 16'),
  '57.00': b('Perte nette', 'Net loss, to PG3 57.00', 'p. 8', 'p. 16'),
  '12.50': b('Actifs commerciaux bruts', 'Gross business assets', 'p. 8', 'p. 17'),
  '57.50': b('Passifs commerciaux (dettes)', 'Business debts', 'p. 8', 'p. 17'),
  '12.52': b(
    'Capital propre/(Découvert) de la société simple ou la raison inviduelle',
    'Equity of your business',
    'p. 8',
    'p. 17',
  ),
  '32.10': b(
    'Acompte(s) AVS/AI, APG, AF, AMat de l’exploitant versés',
    'Your own AVS/AI/APG contributions for the business year',
    'p. 10',
    'p. 22',
  ),
  '32.11': b(
    'Cotisations complémentaires AVS/AI, APG, AF, AMat de l’exploitant',
    'Further AVS/AI/APG contributions for earlier years',
    'p. 10',
    'p. 22',
  ),
  '32.90': b(
    'Déduction sur le gain de l’un des époux/partenaires (IFD)',
    'Two-earner deduction, federal, on annexe B',
    'p. 10',
    'p. 23',
  ),
  '32.95': b(
    'Déduction sur le gain de l’un des époux/partenaires (ICC)',
    'Two-earner deduction, cantonal, on annexe B',
    'p. 10',
    'p. 24',
  ),
  '32.00': b('Total', 'Deductions for self-employment, to PG3 32.00', 'p. 10', 'p. 22 to 24'),
  '51.60': b(
    'Déduction sur la fortune commerciale investie',
    'Deduction on the business wealth invested',
    'p. 4',
    'p. 17 and 18',
  ),
  '13.10': r(
    'Pensions alimentaires, contributions d’entretien',
    'Alimony received',
    'p. 11',
    'p. 25',
  ),
  '13.20': r('Rentes de la prévoyance professionnelle', 'Pension fund pensions', 'p. 11', 'p. 26'),
  '13.40': r('Autres rentes', 'Other pensions', 'p. 11', 'p. 26'),
  '14.00': r(
    'Revenu brut mobilier',
    'Income from accounts and securities',
    'p. 2 and p. 21',
    'p. 38',
  ),
  '16.30': r('Subsides d’assurance-maladie', 'Health insurance subsidy', 'p. 12', 'p. 27'),
  '17.10': r('Rentes AVS/AI', 'AVS/AI pensions', 'p. 11', 'p. 25'),
  // Employment deductions, taxpayer A (B: 4x.xx).
  '31.10': r(
    'Cotisations AVS/AI, APG, Chômage, AANP, Amat',
    'Social insurance contributions',
    'p. 5',
    'p. 18',
  ),
  '31.12': r('Prévoyance 2ème pilier, cotisations', 'Pension fund contributions', 'p. 5', 'p. 18'),
  '31.20': r(
    'Déduction forfaitaire pour frais professionnels IFD',
    'Flat professional expenses, federal',
    'p. 5',
    'p. 19',
  ),
  '31.30': r('Rachat(s) de la prévoyance professionnelle', 'Pension fund buy-ins', 'p. 5', 'p. 18'),
  '31.40': r('Cotisations au 3ème pilier A', 'Pillar 3a', 'p. 5', 'p. 18'),
  '31.50': r(
    'Déduction forfaitaire pour frais professionnels ICC',
    'Flat professional expenses, cantonal',
    'p. 5',
    'p. 19',
  ),
  '31.60': r(
    'Frais professionnels effectifs, frais de repas',
    'Meals away from home',
    'p. 5',
    'p. 19',
  ),
  '31.63': r(
    'Déduction pour frais professionnels, autres frais',
    'Other actual professional costs',
    'p. 5',
    'p. 20',
  ),
  '31.70': r('Frais de déplacements ICC', 'Commuting, cantonal', 'p. 5', 'p. 21'),
  '31.71': r('Frais de déplacements IFD', 'Commuting, federal', 'p. 5', 'p. 21'),
  '31.90': r(
    'Déduction sur le gain de l’un des époux/partenaires (IFD)',
    'Two-earner deduction, federal',
    'p. 5',
    'p. 21',
  ),
  '31.95': r(
    'Déduction sur le gain de l’un des époux/partenaires (ICC)',
    'Two-earner deduction, cantonal',
    'p. 5',
    'p. 21',
  ),
  '32.40': b(
    'Cotisations au 3ème pilier A (activité indépendante)',
    'Pillar 3a, self-employed',
    'p. 10',
    'p. 23',
  ),
  // Other deductions.
  '51.50': r('Déduction sociale sur la fortune', 'Social deduction on wealth', 'p. 4', 'p. 16'),
  '52.00': r(
    'Primes d’assurances (IFD)',
    'Insurance premiums and savings interest, federal',
    'p. 3 and p. 13',
    'p. 28 and 29',
  ),
  '52.15': r(
    'Sous-total ICC assurance-vie et intérêts de capitaux d’épargne',
    'Life insurance and savings interest, cantonal',
    'p. 13',
    'p. 28',
  ),
  '52.21': r(
    'Assurance-maladie et accidents, limitées au maximum admis',
    'Health and accident insurance premiums',
    'p. 13',
    'p. 29',
  ),
  '53.10': r('Pensions, contributions d’entretien versées', 'Alimony paid', 'p. 14', 'p. 29'),
  '55.10': r('Intérêts chirographaires', 'Interest on private debts', 'p. 3 and p. 19', 'p. 37'),
  '56.20': r(
    'Déductions liées aux revenus mobiliers (frais bancaires)',
    'Bank and securities costs',
    'p. 3 and p. 21',
    'p. 40 and 43',
  ),
  '59.10': r('Frais de garde des enfants (ICC)', 'Childcare, cantonal', 'p. 14', 'p. 30'),
  '59.12': r('Frais de garde des enfants (IFD)', 'Childcare, federal', 'p. 14', 'p. 30'),
  '59.20': r('Déduction pour conjoints IFD', 'Married couple deduction, federal', 'p. 14', 'p. 31'),
  '59.50': r('Frais de formation', 'Professional training', 'p. 14', 'p. 31'),
  '61.20': r('Charges de famille IFD', 'Children, federal', 'p. 3', 'p. 15'),
  '61.25': r('Charges de famille ICC', 'Family charges, cantonal', 'p. 3', 'p. 15'),
  '61.30': r('Déduction pour bénéficiaires de rentes AVS/AI', 'AVS/AI pensioners', 'p. 3', 'p. 16'),
  '71.00': r('Frais médicaux', 'Medical costs', 'p. 3', 'p. 14'),
  '73.00': r('Versements bénévoles et dons', 'Donations', 'p. 3', 'p. 15'),
  '74.00': r('Versements aux partis politiques', 'Political parties', 'p. 3', 'p. 15'),
  // Information the form asks for that is not in the income: the lump sums from the 2nd pillar and
  // pillar 3a, taxed apart (renseignements, p. 2; ../law/capital.ts).
  '98.12': r(
    'Prestations en capital du 2ème et 3ème pilier A imposées au 1/5ème du barème',
    'Pension capital, taxed apart',
    'p. 2',
    'p. 13',
  ),
  // Wealth (other than the état des titres, whose items carry their own label).
  '16.40': r(
    'Numéraires, métaux précieux, autos, bateaux, etc.',
    'Cash, precious metals and other assets',
    'p. 12',
    'p. 27',
  ),
} as const satisfies Record<string, Rubric>;

export type RubricCode = keyof typeof RUBRICS;

/**
 * Codes with a taxpayer B twin (2x.xx for 1x.xx, 4x.xx for 3x.xx). Annexe B's codes (12.xx, 32.xx,
 * 57.xx) have none: one sheet per person, ticked "Contribuable A" or "B" (specimen p. 7).
 */
const PER_PERSON = new Set([
  '11.10',
  '11.50',
  '31.10',
  '31.12',
  '31.20',
  '31.30',
  '31.40',
  '31.50',
  '31.60',
  '31.63',
  '31.70',
  '31.71',
  '31.90',
  '31.95',
]);

/** The code as printed for this person: '31.10' for A becomes '41.10' for B. */
export function codeFor(
  code: RubricCode,
  person: EnginePerson | 'household' | `child${number}`,
): string {
  if (person !== 'p2' || !PER_PERSON.has(code)) return code;
  return `${Number(code[0]) + 1}${code.slice(1)}`;
}

/** The catalogue entry for a printed code (B's codes read as A's). */
export function rubric(code: string): Rubric | undefined {
  const own = (RUBRICS as Record<string, Rubric>)[code];
  if (own) return own;
  const first = Number(code[0]);
  if (first === 2 || first === 4)
    return (RUBRICS as Record<string, Rubric>)[`${first - 1}${code.slice(1)}`];
  return undefined;
}

/** Income and assets are codes 1x and 2x; deductions 3x to 7x. */
export const isIncomeCode = (code: string) => code[0] === '1' || code[0] === '2';

/** Deductions taken after the subtotal 92.20 (medical costs). */
export const AFTER_9220 = new Set(['71.00']);
/** Deductions taken after the subtotal 92.40 (donations, parties). */
export const AFTER_9240 = new Set(['73.00', '73.10', '73.20', '74.00']);
/** Social deductions, taken from the net income (61.xx). */
export const SOCIAL = new Set(['61.20', '61.25', '61.30']);
