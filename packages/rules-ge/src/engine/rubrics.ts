// The rubrics (codes de rubrique) the engine computes, with the official French term and its gloss.
// Codes and terms: ge-2025-guide-declaration-pp, at the page given. Taxpayer A's codes start with
// 1 or 3, taxpayer B's with 2 or 4 (guide p. 5, p. 17). Four codes are not in the guide's text,
// only on the recapitulation pages pictured on p. 13 (too small to read with certainty): 14.10 and
// 24.10 (bank accounts and securities, état des titres), 55.00 (debts and their interest) and
// 56.20 (costs of securities and accounts). They are the codes the assessment uses for these
// items; re-check them against the 2026 form.
import type { EnginePerson, Text } from './types.js';

const GUIDE = 'ge-2025-guide-declaration-pp';

export interface Rubric {
  label: Text;
  source: string;
}

const r = (fr: string, en: string, page: string): Rubric => ({
  label: { fr, en: `${en} (${fr})` },
  source: `${GUIDE} ${page}`,
});

export const RUBRICS = {
  // Income.
  '11.10': r('Salaires bruts', 'Gross salaries', 'p. 17'),
  '11.50': r(
    'Perte de salaire, chômage, maladie, accident, militaire',
    'Benefits replacing salary',
    'p. 17',
  ),
  '12.01': r('Revenu de l’activité lucrative indépendante', 'Self-employment income', 'p. 21'),
  '13.10': r('Pensions alimentaires, contributions d’entretien', 'Alimony received', 'p. 25'),
  '13.20': r('Rentes de la prévoyance professionnelle', 'Pension fund pensions', 'p. 26'),
  '13.40': r('Autres rentes', 'Other pensions', 'p. 26'),
  '14.10': r(
    'Titres et comptes (état des titres)',
    'Bank accounts and securities',
    'p. 13 and p. 38',
  ),
  '16.30': r('Subsides de l’assurance-maladie', 'Health insurance subsidy', 'p. 27'),
  '16.40': r(
    'Numéraires, métaux précieux et autres éléments de fortune',
    'Cash, precious metals and other assets',
    'p. 27',
  ),
  '17.10': r('Rentes AVS / AI', 'AVS/AI pensions', 'p. 25'),
  // Employment deductions, taxpayer A (B: 4x.xx).
  '31.10': r(
    'Cotisations AVS / AI / APG / Chômage / AANP / AMat',
    'Social insurance contributions',
    'p. 18',
  ),
  '31.12': r('Cotisations 2e pilier', 'Pension fund contributions', 'p. 18'),
  '31.20': r(
    'Déduction forfaitaire IFD pour frais professionnels',
    'Flat professional expenses, federal',
    'p. 19',
  ),
  '31.30': r('Rachats de la prévoyance professionnelle', 'Pension fund buy-ins', 'p. 18'),
  '31.40': r('Cotisations 3e pilier A', 'Pillar 3a', 'p. 18'),
  '31.50': r(
    'Déduction forfaitaire ICC pour frais professionnels',
    'Flat professional expenses, cantonal',
    'p. 19',
  ),
  '31.60': r('Frais de repas', 'Meals away from home', 'p. 19'),
  '31.63': r('Autres frais professionnels effectifs', 'Other actual professional costs', 'p. 20'),
  '31.70': r('Frais de déplacements ICC', 'Commuting, cantonal', 'p. 21'),
  '31.71': r('Frais de déplacements IFD', 'Commuting, federal', 'p. 21'),
  '31.90': r(
    'Déduction sur le gain de l’un des époux (IFD)',
    'Two-earner deduction, federal',
    'p. 21',
  ),
  '31.95': r(
    'Déduction sur le gain de l’un des époux (ICC)',
    'Two-earner deduction, cantonal',
    'p. 21',
  ),
  // Other deductions.
  '51.50': r('Déduction sociale sur la fortune', 'Social deduction on wealth', 'p. 16'),
  '52.00': r(
    'Primes d’assurances (IFD)',
    'Insurance premiums and savings interest, federal',
    'p. 28 and 29',
  ),
  '52.15': r(
    'Assurance-vie et intérêts de capitaux d’épargne (sous-total ICC)',
    'Life insurance and savings interest, cantonal',
    'p. 28',
  ),
  '52.21': r(
    'Primes d’assurance-maladie et accidents',
    'Health and accident insurance premiums',
    'p. 29',
  ),
  '53.10': r('Pensions, contributions d’entretien versées', 'Alimony paid', 'p. 29'),
  '55.00': r(
    'Intérêts et dettes chirographaires et hypothécaires',
    'Private debts and their interest',
    'p. 13 and p. 37',
  ),
  '56.20': r(
    'Frais bancaires et d’administration des titres',
    'Bank and securities costs',
    'p. 13, p. 40 and 43',
  ),
  '59.10': r('Frais de garde des enfants (ICC)', 'Childcare, cantonal', 'p. 30'),
  '59.12': r('Frais de garde des enfants (IFD)', 'Childcare, federal', 'p. 30'),
  '59.20': r('Déduction pour conjoints IFD', 'Married couple deduction, federal', 'p. 31'),
  '59.50': r('Frais de formation', 'Professional training', 'p. 31'),
  '61.20': r('Déduction pour charges de famille IFD', 'Children, federal', 'p. 15'),
  '61.25': r('Déduction pour charges de famille ICC', 'Family charges, cantonal', 'p. 15'),
  '61.30': r('Déduction pour bénéficiaires de rentes AVS / AI', 'AVS/AI pensioners', 'p. 16'),
  '71.00': r('Frais médicaux', 'Medical costs', 'p. 14'),
  '73.10': r('Dons ICC', 'Donations, cantonal', 'p. 15'),
  '73.20': r('Dons IFD', 'Donations, federal', 'p. 15'),
  '74.00': r('Versements aux partis politiques', 'Political parties', 'p. 15'),
} as const satisfies Record<string, Rubric>;

export type RubricCode = keyof typeof RUBRICS;

/** Codes with a taxpayer B twin (2x.xx for 1x.xx, 4x.xx for 3x.xx). */
const PER_PERSON = new Set([
  '11.10',
  '11.50',
  '12.01',
  '14.10',
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
export const AFTER_9240 = new Set(['73.10', '73.20', '74.00']);
/** Social deductions, taken from the net income (61.xx). */
export const SOCIAL = new Set(['61.20', '61.25', '61.30']);
