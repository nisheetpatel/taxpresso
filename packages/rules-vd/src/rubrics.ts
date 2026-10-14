// The lines of the Vaud return the engine computes, with the official French term and its gloss.
// The codes are those printed on the 2025 return (vd-2025-form-21010, edition V2 07.25: its PDF
// page 2 holds the form's pages 2 and 3, codes 100 to 820) and in the guide's headings
// (vd-2025-guide). Codes 100 to 340 are per taxpayer (a column for each); the rest are the
// household's. Code 410 and 610 have an income and a wealth column: the income line is in the
// income items, the wealth line in the wealth items. The 2026 return is not published yet
// (docs/sources/vd/NOTES.md, Gaps).
import type { Text } from '@taxpresso/rules-ch';

const FORM = 'vd-2025-form-21010 p. 2';

export interface Rubric {
  label: Text;
  source: string;
}

const r = (fr: string, en: string, page: 2 | 3, guide: number): Rubric => ({
  label: { en: `${en} (${fr})`, fr },
  source: `${FORM} (form page ${page}); vd-2025-guide p. ${guide}`,
});

export const RUBRICS = {
  // Income (revenu), form page 2.
  '100': r('Activité salariée principale', 'Main employment, net salary', 2, 17),
  '105': r('Activité salariée accessoire', 'Side job, net salary', 2, 18),
  '195': r('Autres revenus de toute nature', 'Other income', 2, 25),
  '200': r(
    'Assurance-chômage (AC) et service militaire (APG)',
    'Unemployment benefits and military service allowances',
    2,
    26,
  ),
  '210': r(
    'Indemnités journalières maladie et accidents',
    'Sickness and accident daily allowances',
    2,
    26,
  ),
  '240': r('Rentes AVS / AI', 'AVS/AI pensions', 2, 27),
  '250': r(
    'Rentes provenant d’institutions de prévoyance professionnelle',
    'Pension fund pensions',
    2,
    28,
  ),
  '270': r('Autres rentes et pensions', 'Other pensions', 2, 28),
  '280': r('Pensions alimentaires obtenues', 'Alimony and child support received', 2, 28),
  '410': r('Titres et autres placements, rendement', 'Income from accounts and securities', 3, 32),
  // Deductions down to the net income (650), form pages 2 and 3.
  '140': r('Frais de transport', 'Travel to work', 2, 19),
  '150': r('Repas pris hors du domicile', 'Lunch away from home', 2, 21),
  '160': r('Autres frais professionnels', 'Other professional costs', 2, 22),
  '165': r('Frais pour activité salariée accessoire', 'Professional costs of a side job', 2, 23),
  '235': r('Déduction pour double activité des conjoints', 'Both spouses work', 2, 26),
  '300': r(
    'Assurances maladie et accidents, assurances sur la vie',
    'Health, accident and life insurance premiums',
    2,
    29,
  ),
  '310': r('Prévoyance individuelle liée (3e pilier A)', 'Pillar 3a', 2, 30),
  '320': r('Rachats d’années d’assurance (2e pilier)', 'Pension fund buy-ins paid directly', 2, 31),
  '480': r('Déduction des intérêts de capitaux d’épargne', 'Interest on savings', 3, 40),
  '490': r('Frais d’administration de titres', 'Costs of keeping securities', 3, 40),
  '610': r('Intérêts des dettes privées', 'Private debt interest', 3, 41),
  '618': r('Frais de perfectionnement et de formation', 'Professional training', 3, 42),
  '620': r('Versements à des partis politiques', 'Payments to political parties', 3, 43),
  '630': r('Pensions alimentaires versées', 'Alimony and child support paid', 3, 43),
  '670': r('Déduction pour frais de garde', 'Childcare', 3, 44),
  // From the net income (650) to the intermediate income (700).
  '660': r('Déduction sociale pour le logement', 'Housing deduction', 3, 44),
  '695': r('Déduction pour contribuable modeste', 'Modest taxpayer deduction', 3, 45),
  // From the intermediate income (700) to the taxable income (800).
  '710': r('Frais médicaux et dentaires', 'Medical and dental costs', 3, 48),
  '720': r('Dons à des institutions d’utilité publique', 'Donations', 3, 49),
  '725': r('Déduction pour famille', 'Family deduction', 3, 49),
} as const satisfies Record<string, Rubric>;

/** Wealth (fortune) lines, form page 3: assets and debts at their value on 31 December. */
export const WEALTH_RUBRICS = {
  '410': r('Titres et autres placements', 'Accounts and securities', 3, 32),
  '420': r(
    'Numéraire, billets de banque, or, autres métaux précieux et crypto-monnaies',
    'Cash, gold, precious metals and crypto-assets',
    3,
    38,
  ),
  '430': r(
    'Autos, motos, collections, bijoux, bateaux',
    'Vehicles, collections and the like',
    3,
    39,
  ),
  '435': r('Assurances sur la vie, valeur de rachat', 'Life insurance, surrender value', 3, 39),
  '440': r('Objets mobiliers', 'Household contents', 3, 39),
  '445': r('Autre fortune', 'Other assets', 3, 39),
  '610': r('Dettes privées', 'Private debts', 3, 41),
} as const satisfies Record<string, Rubric>;

export type RubricCode = keyof typeof RUBRICS;
export type WealthCode = keyof typeof WEALTH_RUBRICS;

export function rubric(code: string): Rubric | undefined {
  return (RUBRICS as Record<string, Rubric>)[code];
}

export function wealthRubric(code: string): Rubric | undefined {
  return (WEALTH_RUBRICS as Record<string, Rubric>)[code];
}

/** Income lines: the total of the income (the form's 400 and the income of 410 to 465). */
export const INCOME = new Set<string>([
  '100',
  '105',
  '195',
  '200',
  '210',
  '240',
  '250',
  '270',
  '280',
  '410',
]);
/** Costs and general deductions, down to the net income (650 = codes 400 to 640, and 670). */
export const DEDUCTIONS = new Set<string>([
  '140',
  '150',
  '160',
  '165',
  '235',
  '300',
  '310',
  '320',
  '480',
  '490',
  '610',
  '618',
  '620',
  '630',
  '670',
]);
/** From the net income (650) to the intermediate income (700): 660, then 695 on 690. */
export const SOCIAL = new Set<string>(['660', '695']);
/** From the intermediate income (700) to the subtotal (730) and the taxable income (800). */
export const SPECIAL = new Set<string>(['710', '720', '725']);
/** Wealth: assets, then debts. */
export const ASSETS = new Set<string>(['410', '420', '430', '435', '440', '445']);
export const DEBTS = new Set<string>(['610']);
