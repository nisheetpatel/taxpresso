// The lines of the Basel-Stadt return the engine reads or computes, with the official German term
// and its gloss. The codes are those printed on the 2025 main form (bs-2025-form-hauptformular,
// 15000.a.02.25: page 2 income, page 3 deductions and the income computation, page 4 wealth) and in
// the guide's headings (bs-2025-guide-wegleitung; the 2026 guide, bs-2026-guide-wegleitung-b,
// prints the same lines on the same pages). Most income and deduction lines have a code for each
// person (100 for person 1, 105 for person 2); the others are the household's. The 2026 forms are
// not published yet (docs/sources/bs/NOTES.md, Gaps).
import type { Text } from '@taxpresso/rules-ch';

const FORM = 'bs-2025-form-hauptformular';

export interface Rubric {
  label: Text;
  source: string;
}

const r = (de: string, en: string, fr: string, page: 2 | 3 | 4, guide: number): Rubric => ({
  label: { en: `${en} (${de})`, fr: `${fr} (${de})`, de },
  source: `${FORM} p. ${page} (form page ${page}); bs-2025-guide-wegleitung p. ${guide}`,
});

export const RUBRICS = {
  // Income (Einkünfte), form page 2.
  '100': r(
    'Haupterwerb, Person 1',
    'Main employment, net salary, person 1',
    'Activité principale, salaire net, personne 1',
    2,
    19,
  ),
  '105': r(
    'Haupterwerb, Person 2',
    'Main employment, net salary, person 2',
    'Activité principale, salaire net, personne 2',
    2,
    19,
  ),
  '110': r(
    'Nebenerwerb, Person 1',
    'Side job, net salary, person 1',
    'Activité accessoire, salaire net, personne 1',
    2,
    20,
  ),
  '115': r(
    'Nebenerwerb, Person 2',
    'Side job, net salary, person 2',
    'Activité accessoire, salaire net, personne 2',
    2,
    20,
  ),
  '200': r(
    'AHV-/IV-Renten, Person 1',
    'AHV/IV pensions, person 1',
    'Rentes AVS/AI, personne 1',
    2,
    22,
  ),
  '205': r(
    'AHV-/IV-Renten, Person 2',
    'AHV/IV pensions, person 2',
    'Rentes AVS/AI, personne 2',
    2,
    22,
  ),
  '220': r(
    'Pensionen / Renten, Person 1',
    'Pension fund pensions, person 1',
    'Rentes de la prévoyance professionnelle, personne 1',
    2,
    22,
  ),
  '225': r(
    'Pensionen / Renten, Person 2',
    'Pension fund pensions, person 2',
    'Rentes de la prévoyance professionnelle, personne 2',
    2,
    22,
  ),
  '240': r(
    'Übrige Renten, Person 1',
    'Other pensions, person 1',
    'Autres rentes, personne 1',
    2,
    22,
  ),
  '245': r(
    'Übrige Renten, Person 2',
    'Other pensions, person 2',
    'Autres rentes, personne 2',
    2,
    22,
  ),
  '260': r(
    'Erwerbsausfallentschädigungen, Person 1',
    'Daily allowances and unemployment benefits, person 1',
    'Indemnités journalières et chômage, personne 1',
    2,
    23,
  ),
  '265': r(
    'Erwerbsausfallentschädigungen, Person 2',
    'Daily allowances and unemployment benefits, person 2',
    'Indemnités journalières et chômage, personne 2',
    2,
    23,
  ),
  '270': r(
    'Unterhaltsbeiträge von geschiedenen / getrennt lebenden Ehegatten',
    'Alimony received',
    'Pension alimentaire reçue',
    2,
    23,
  ),
  '271': r(
    'Unterhaltsbeiträge für minderjährige Kinder',
    'Child support received',
    'Contributions d’entretien reçues pour les enfants',
    2,
    23,
  ),
  '280': r('Übrige Einkünfte', 'Other income', 'Autres revenus', 2, 23),
  '369': r(
    'Guthaben, Wertschriften und Lotterien',
    'Income from accounts and securities, less their costs',
    'Rendement des avoirs et titres, moins leurs frais',
    2,
    24,
  ),
  '479': r('Liegenschaften', 'Income from property', 'Revenu des immeubles', 2, 28),
  // Deductions (Abzüge), form page 3.
  '519': r(
    'Berufskosten Person 1',
    'Professional costs, person 1',
    'Frais professionnels, personne 1',
    3,
    30,
  ),
  '539': r(
    'Berufskosten Person 2',
    'Professional costs, person 2',
    'Frais professionnels, personne 2',
    3,
    30,
  ),
  '550': r('Schuldzinsen', 'Private debt interest', 'Intérêts des dettes privées', 3, 32),
  '560': r(
    'Unterhaltsbeiträge an geschiedene / getrennt lebende Ehegatten',
    'Alimony paid',
    'Pension alimentaire versée',
    3,
    32,
  ),
  '561': r(
    'Unterhaltsbeiträge an minderjährige Kinder',
    'Child support paid',
    'Contributions d’entretien versées pour les enfants',
    3,
    32,
  ),
  '610': r(
    'Berufliche Vorsorge (Pensionskasse), Person 1',
    'Pension fund buy-ins paid directly, person 1',
    'Rachats de prévoyance professionnelle, personne 1',
    3,
    33,
  ),
  '615': r(
    'Berufliche Vorsorge (Pensionskasse), Person 2',
    'Pension fund buy-ins paid directly, person 2',
    'Rachats de prévoyance professionnelle, personne 2',
    3,
    33,
  ),
  '620': r(
    'Gebundene Selbstvorsorge (Säule 3a), Person 1',
    'Pillar 3a, person 1',
    'Pilier 3a, personne 1',
    3,
    33,
  ),
  '625': r(
    'Gebundene Selbstvorsorge (Säule 3a), Person 2',
    'Pillar 3a, person 2',
    'Pilier 3a, personne 2',
    3,
    33,
  ),
  '630': r(
    'Abzug für Versicherungen Ehegatten',
    'Insurance premiums and savings interest, flat amount for spouses',
    'Primes d’assurance et intérêts d’épargne, forfait des époux',
    3,
    35,
  ),
  '631': r(
    'Abzug für Versicherungen alle übrigen Personen',
    'Insurance premiums and savings interest, flat amount',
    'Primes d’assurance et intérêts d’épargne, forfait',
    3,
    35,
  ),
  // The federal column only: the federal insurance deduction's supplement per child.
  '632': r(
    'Zuschlag für Kinder und unterstützte Personen (Bund)',
    'Insurance deduction, supplement for children, federal tax',
    'Déduction pour assurances, supplément pour enfants, impôt fédéral',
    3,
    35,
  ),
  '652': r(
    'Selbstgetragene Aus- und Weiterbildungskosten Person 1',
    'Professional training, person 1',
    'Formation continue, personne 1',
    3,
    35,
  ),
  '657': r(
    'Selbstgetragene Aus- und Weiterbildungskosten Person 2',
    'Professional training, person 2',
    'Formation continue, personne 2',
    3,
    35,
  ),
  '660': r(
    'Abzug bei Erwerbstätigkeit beider Ehegatten',
    'Both spouses work',
    'Activité des deux conjoints',
    3,
    35,
  ),
  '670': r('Abzug für fremdbetreute Kinder', 'Childcare', 'Frais de garde des enfants', 3, 36),
  '680': r(
    'Beiträge an politische Parteien',
    'Payments to political parties',
    'Versements aux partis politiques',
    3,
    36,
  ),
  // Deductions that depend on the income (einkommensabhängige Abzüge), form page 3.
  '725': r(
    'Krankheits-, Unfall- und Behinderungskosten',
    'Illness and accident costs',
    'Frais de maladie et d’accident',
    3,
    37,
  ),
  '732': r('Zuwendungen', 'Donations', 'Dons', 3, 38),
  // Social deductions (Sozialabzüge), form page 3.
  '750': r('Abzug für Kinder', 'Child deduction', 'Déduction pour enfants', 3, 38),
  '760': r('Abzug für Ehegatten', 'Deduction for spouses', 'Déduction pour époux', 3, 39),
  '765': r(
    'Abzug für alleinerziehende Personen',
    'Deduction for single parents',
    'Déduction pour familles monoparentales',
    3,
    39,
  ),
  '767': r(
    'Abzug für alle übrigen Personen',
    'Deduction for everyone else',
    'Déduction pour les autres personnes',
    3,
    39,
  ),
  '770': r(
    'Abzug für alleinstehende Rentner/innen',
    'Deduction for single retirees',
    'Déduction pour retraités seuls',
    3,
    39,
  ),
} as const satisfies Record<string, Rubric>;

/** Wealth (Vermögen) lines, form page 4: assets, debts and allowances on 31 December. */
export const WEALTH_RUBRICS = {
  '800': r('Guthaben und Wertschriften', 'Accounts and securities', 'Avoirs et titres', 4, 40),
  '815': r(
    'Lebensversicherungen',
    'Life insurance, surrender value',
    'Assurances sur la vie, valeur de rachat',
    4,
    41,
  ),
  '821': r('Liegenschaften', 'Property', 'Immeubles', 4, 41),
  '835': r(
    'Bargeld, Edelmetalle und übrige Vermögenswerte',
    'Cash, precious metals and other assets',
    'Numéraire, métaux précieux et autres biens',
    4,
    41,
  ),
  '870': r('Privatschulden', 'Private debts', 'Dettes privées', 4, 42),
  '890': r(
    'Freibetrag für Ehegatten und für alleinerziehende Personen',
    'Wealth allowance for spouses and single parents',
    'Montant exonéré pour époux et familles monoparentales',
    4,
    43,
  ),
  '891': r(
    'Freibetrag für alle übrigen steuerpflichtigen Personen',
    'Wealth allowance',
    'Montant exonéré',
    4,
    43,
  ),
  '892': r(
    'Freibetrag für minderjährige Kinder',
    'Wealth allowance for minor children',
    'Montant exonéré pour enfants mineurs',
    4,
    43,
  ),
} as const satisfies Record<string, Rubric>;

export type RubricCode = keyof typeof RUBRICS;
export type WealthCode = keyof typeof WEALTH_RUBRICS;

export function rubric(code: string): Rubric | undefined {
  return (RUBRICS as Record<string, Rubric>)[code];
}

export function wealthRubric(code: string): Rubric | undefined {
  return (WEALTH_RUBRICS as Record<string, Rubric>)[code];
}

/** The person's own code of a line printed once per person (person 1, person 2). */
export const PERSON_CODES = {
  main: { p1: '100', p2: '105' },
  side: { p1: '110', p2: '115' },
  avs: { p1: '200', p2: '205' },
  occupational: { p1: '220', p2: '225' },
  otherPension: { p1: '240', p2: '245' },
  allowances: { p1: '260', p2: '265' },
  professional: { p1: '519', p2: '539' },
  buyIn: { p1: '610', p2: '615' },
  pillar3a: { p1: '620', p2: '625' },
  training: { p1: '652', p2: '657' },
} as const satisfies Record<string, { p1: RubricCode; p2: RubricCode }>;

/**
 * The lines of form B (Berufskosten) whose total is a person's 519 or 539, as printed for person 1
 * and person 2 (bs-2025-form-b-berufskosten p. 1 and 2): the canton's flat amount (Kanton only),
 * travel, meals, the other costs (Kanton: actual; Bund: the flat 3 % or actual) and a side job's
 * flat (Bund only).
 */
export const FORM_B = {
  p1: { flat: '500', travel: '503', meals: '504', other: '514', side: '516' },
  p2: { flat: '520', travel: '523', meals: '524', other: '534', side: '536' },
} as const;

/**
 * The lines of page 4 of form W (Wertschriftenverzeichnis, bs-2025-form-w-wertschriftenverzeichnis
 * p. 4) Taxpresso fills from the totals of the accounts and securities: the gross income (line 1),
 * the costs of keeping them (line 6), the market value (line 11), the yield value (line 14) and the
 * mean (line 16); line 10 is 369 and the lower of 11 and 16 is 800.
 */
export const FORM_W = {
  grossIncome: 'W-1',
  fees: 'W-6',
  market: 'W-11',
  yieldValue: 'W-14',
  mean: 'W-16',
} as const;

/** Income lines (Einkünfte, 100 to 489): their total is 499. */
export const INCOME = new Set<string>([
  '100',
  '105',
  '110',
  '115',
  '200',
  '205',
  '220',
  '225',
  '240',
  '245',
  '260',
  '265',
  '270',
  '271',
  '280',
  '369',
  '479',
]);
/** Deductions down to the net income (519 to 680): their total is 699, and 709 = 499 - 699. */
export const DEDUCTIONS = new Set<string>([
  '519',
  '539',
  '550',
  '560',
  '561',
  '610',
  '615',
  '620',
  '625',
  '630',
  '631',
  '632',
  '652',
  '657',
  '660',
  '670',
  '680',
]);
/** From the net income (709) to the pure income (739). */
export const INCOME_BASED = new Set<string>(['725', '732']);
/** Social deductions, from 739 to the taxable income (799). */
export const SOCIAL = new Set<string>(['750', '760', '765', '767', '770']);
/** Wealth: assets (869), debts (889), allowances (899). */
export const ASSETS = new Set<string>(['800', '815', '821', '835']);
export const DEBTS = new Set<string>(['870']);
export const ALLOWANCES = new Set<string>(['890', '891', '892']);
