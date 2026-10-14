// The lines of the Basel-Landschaft return the engine reads or computes, with the official German
// term and its gloss. The codes are those printed on the 2025 return (bl-2025-steuererklaerung-form:
// page 2 income, page 3 deductions and the taxable income, page 4 wealth), explained under the same
// codes in the 2025 guide (bl-2025-wegleitung). The 2026 return prints the same codes on the same
// pages and adds 771, the deduction for IV pensioners (bl-2026-steuererklaerung-form p. 3). Most
// income and deduction lines have a code for each person (100 for person 1, 105 for person 2); the
// others are the household's. The state tax has one list of deductions (500 to 775) and no subtotal
// before the taxable income (790 = 499 - 789). The federal column (Bundessteuer) has the same lines,
// with the federal amounts, and two social deductions the state tax doesn't have, 750 and 775.
import type { Text } from '@taxpresso/rules-ch';

const FORM = 'bl-2025-steuererklaerung-form';
const GUIDE = 'bl-2025-wegleitung';

export interface Rubric {
  label: Text;
  source: string;
}

const r = (de: string, en: string, fr: string, page: 2 | 3 | 4, guide: string): Rubric => ({
  label: { en: `${en} (${de})`, fr: `${fr} (${de})`, de },
  source: `${FORM} p. ${page}; ${GUIDE} p. ${guide}`,
});

const income = (de: string, en: string, fr: string, guide: string) => r(de, en, fr, 2, guide);
const deduction = (de: string, en: string, fr: string, guide: string) => r(de, en, fr, 3, guide);

export const RUBRICS = {
  // Income (Einkünfte), form page 2.
  '100': income(
    'Haupterwerb, Person 1',
    'Main employment, net salary, person 1',
    'Activité principale, salaire net, personne 1',
    '12',
  ),
  '105': income(
    'Haupterwerb, Person 2',
    'Main employment, net salary, person 2',
    'Activité principale, salaire net, personne 2',
    '12',
  ),
  '110': income(
    'Nebenerwerb, Person 1',
    'Side job, net salary, person 1',
    'Activité accessoire, salaire net, personne 1',
    '13',
  ),
  '115': income(
    'Nebenerwerb, Person 2',
    'Side job, net salary, person 2',
    'Activité accessoire, salaire net, personne 2',
    '13',
  ),
  '200': income(
    'AHV-/IV-Renten, Person 1',
    'AHV/IV pensions, person 1',
    'Rentes AVS/AI, personne 1',
    '16',
  ),
  '205': income(
    'AHV-/IV-Renten, Person 2',
    'AHV/IV pensions, person 2',
    'Rentes AVS/AI, personne 2',
    '16',
  ),
  '220': income(
    'Renten aus Pensionskassen, Person 1',
    'Pension fund pensions, person 1',
    'Rentes de caisses de pension, personne 1',
    '16',
  ),
  '225': income(
    'Renten aus Pensionskassen, Person 2',
    'Pension fund pensions, person 2',
    'Rentes de caisses de pension, personne 2',
    '16',
  ),
  '230': income(
    'Übrige Renten, Person 1',
    'Other pensions, person 1',
    'Autres rentes, personne 1',
    '16',
  ),
  '235': income(
    'Übrige Renten, Person 2',
    'Other pensions, person 2',
    'Autres rentes, personne 2',
    '16',
  ),
  '260': income(
    'Erwerbsausfallentschädigungen, Person 1',
    'Unemployment and loss-of-earnings allowances, person 1',
    'Indemnités pour perte de gain, personne 1',
    '17',
  ),
  '270': income(
    'Erwerbsausfallentschädigungen, Person 2',
    'Unemployment and loss-of-earnings allowances, person 2',
    'Indemnités pour perte de gain, personne 2',
    '17',
  ),
  '300': income(
    'Einkünfte aus Guthaben, Wertschriften und Lotterien',
    'Income from accounts and securities',
    'Rendement des avoirs et des titres',
    '17',
  ),
  '310': income('Unterhaltsbeiträge', 'Alimony received', 'Pension alimentaire reçue', '17'),
  '320': income(
    'Unterhaltsbeiträge für minderjährige Kinder',
    'Child support received',
    'Contributions d’entretien reçues pour des enfants mineurs',
    '17',
  ),
  '380': income('Übrige Einkünfte', 'Other income', 'Autres revenus', '18'),
  // Deductions (Abzüge), form page 3.
  '500': deduction(
    'Fahrtkosten, Person 1',
    'Travel to work, person 1',
    'Frais de déplacement, personne 1',
    '25 and 26',
  ),
  '505': deduction(
    'Fahrtkosten, Person 2',
    'Travel to work, person 2',
    'Frais de déplacement, personne 2',
    '25 and 26',
  ),
  '510': deduction(
    'Mehrkosten für auswärtige Verpflegung, Person 1',
    'Lunch away from home, person 1',
    'Repas hors du domicile, personne 1',
    '27',
  ),
  '515': deduction(
    'Mehrkosten für auswärtige Verpflegung, Person 2',
    'Lunch away from home, person 2',
    'Repas hors du domicile, personne 2',
    '27',
  ),
  '520': deduction(
    'Übrige berufsnotwendige Kosten, Person 1',
    'Other professional costs, person 1',
    'Autres frais professionnels, personne 1',
    '27 and 28',
  ),
  '525': deduction(
    'Übrige berufsnotwendige Kosten, Person 2',
    'Other professional costs, person 2',
    'Autres frais professionnels, personne 2',
    '27 and 28',
  ),
  '530': deduction(
    'Auslagen bei Nebenerwerb, Person 1',
    'Costs of a side job, person 1',
    'Frais de l’activité accessoire, personne 1',
    '28',
  ),
  '535': deduction(
    'Auslagen bei Nebenerwerb, Person 2',
    'Costs of a side job, person 2',
    'Frais de l’activité accessoire, personne 2',
    '28',
  ),
  '555': deduction(
    'Private übrige Schuldzinsen',
    'Private debt interest',
    'Intérêts passifs privés',
    '29',
  ),
  '570': deduction('Unterhaltsbeiträge', 'Alimony paid', 'Pension alimentaire versée', '29'),
  '575': deduction(
    'Unterhaltsbeiträge an minderjährige Kinder',
    'Child support paid',
    'Contributions d’entretien versées pour des enfants mineurs',
    '29 and 30',
  ),
  '600': deduction(
    'Einkäufe 2. Säule, Person 1',
    'Pension fund buy-ins, person 1',
    'Rachats dans la caisse de pension, personne 1',
    '30',
  ),
  '605': deduction(
    'Einkäufe 2. Säule, Person 2',
    'Pension fund buy-ins, person 2',
    'Rachats dans la caisse de pension, personne 2',
    '30',
  ),
  '610': deduction(
    'Beiträge 3. Säule, Person 1',
    'Pillar 3a, person 1',
    '3e pilier A, personne 1',
    '30 and 31',
  ),
  '615': deduction(
    'Beiträge 3. Säule, Person 2',
    'Pillar 3a, person 2',
    '3e pilier A, personne 2',
    '30 and 31',
  ),
  '620': deduction(
    'Versicherungsprämien und Zinsen von Sparkapitalien, Ehepaare',
    'Insurance premiums and savings interest, married couple',
    'Primes d’assurance et intérêts d’épargne, couple marié',
    '31',
  ),
  '625': deduction(
    'Versicherungsprämien und Zinsen von Sparkapitalien, übrige',
    'Insurance premiums and savings interest, everyone else',
    'Primes d’assurance et intérêts d’épargne, autres contribuables',
    '31',
  ),
  '630': deduction(
    'Versicherungsprämien, Kinder',
    'Insurance premiums, children',
    'Primes d’assurance, enfants',
    '31',
  ),
  '640': deduction('Kinderbetreuung durch Dritte', 'Childcare', 'Frais de garde des enfants', '32'),
  '650': deduction(
    'Aus- und Weiterbildungskosten',
    'Professional training',
    'Frais de formation et de perfectionnement',
    '33',
  ),
  '655': deduction(
    'Kosten für Vermögensverwaltung',
    'Costs of keeping securities and accounts',
    'Frais d’administration de la fortune',
    '33 and 34',
  ),
  '680': deduction(
    'Abzug bei Erwerbstätigkeit beider Personen',
    'Both spouses work',
    'Activité lucrative des deux conjoints',
    '34',
  ),
  '720': deduction(
    'Krankheits- und Unfallkosten',
    'Illness and accident costs',
    'Frais de maladie et d’accident',
    '35',
  ),
  '735': deduction(
    'Zuwendungen an politische Parteien',
    'Payments to political parties',
    'Versements aux partis politiques',
    '36',
  ),
  '738': deduction('Freiwillige Zuwendungen', 'Donations', 'Dons', '36'),
  // Social deductions (Sozialabzüge) of the federal column only: the state tax takes the children
  // off the tax amount instead (the child reduction) and has no married couple deduction
  // (bl-2025-wegleitung p. 36, 37 and 39).
  '750': deduction(
    'Sozialabzug für Kinder',
    'Deduction for children (federal tax)',
    'Déduction pour enfants (impôt fédéral)',
    '36 and 37',
  ),
  '770': deduction(
    'Abzug für AHV-/IV-Rentnerinnen und -Rentner',
    'Deduction for AHV/IV pensioners',
    'Déduction pour bénéficiaires de rentes AVS/AI',
    '38 and 39',
  ),
  '771': {
    label: {
      en: 'Deduction for IV pensioners (Abzug für IV-Rentnerinnen und -Rentner)',
      fr: 'Déduction pour bénéficiaires de rentes AI (Abzug für IV-Rentnerinnen und -Rentner)',
      de: 'Abzug für IV-Rentnerinnen und -Rentner',
    },
    source: 'bl-2026-steuererklaerung-form p. 3; bl-2026-wegleitung p. 40',
  },
  '775': deduction(
    'Sozialabzug für Ehepaare / eingetragene Partnerschaften',
    'Deduction for married couples and registered partners (federal tax)',
    'Déduction pour couples mariés et partenaires enregistrés (impôt fédéral)',
    '39',
  ),
} as const satisfies Record<string, Rubric>;

/** Wealth (Vermögen) lines, form page 4: assets and debts on 31 December, then the allowance. */
export const WEALTH_RUBRICS = {
  '800': r('Wertschriften und Guthaben', 'Accounts and securities', 'Titres et avoirs', 4, '39'),
  '805': r(
    'Bargeld, Gold und andere Edelmetalle',
    'Cash, gold and other precious metals',
    'Numéraire, or et autres métaux précieux',
    4,
    '39',
  ),
  '810': r(
    'Lebens- und Rentenversicherungen',
    'Life and annuity insurance, surrender value',
    'Assurances sur la vie et de rentes, valeur de rachat',
    4,
    '39 and 40',
  ),
  '815': r('Motorfahrzeuge', 'Vehicles', 'Véhicules', 4, '40'),
  '825': r('Übrige Vermögenswerte', 'Other assets', 'Autres éléments de fortune', 4, '40'),
  '891': r('Private übrige Schulden', 'Private debts', 'Dettes privées', 4, '42'),
  '900': r(
    'Steuerfreier Betrag, Ehepaare und Einelternfamilien',
    'Wealth allowance, married couples and single parents',
    'Montant exonéré, couples mariés et familles monoparentales',
    4,
    '42',
  ),
  '905': r(
    'Steuerfreier Betrag, alle anderen',
    'Wealth allowance, everyone else',
    'Montant exonéré, autres contribuables',
    4,
    '42',
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

/** The codes of the lines that have one for each person. */
export const PERSON_CODES = {
  main: { p1: '100', p2: '105' },
  side: { p1: '110', p2: '115' },
  avs: { p1: '200', p2: '205' },
  occupational: { p1: '220', p2: '225' },
  otherPension: { p1: '230', p2: '235' },
  allowances: { p1: '260', p2: '270' },
  travel: { p1: '500', p2: '505' },
  meals: { p1: '510', p2: '515' },
  other: { p1: '520', p2: '525' },
  sideCosts: { p1: '530', p2: '535' },
  buyIn: { p1: '600', p2: '605' },
  pillar3a: { p1: '610', p2: '615' },
} as const satisfies Record<string, { p1: RubricCode; p2: RubricCode }>;

/** Income lines (Einkünfte): their total is 499. */
export const INCOME = new Set<string>([
  '100',
  '105',
  '110',
  '115',
  '200',
  '205',
  '220',
  '225',
  '230',
  '235',
  '260',
  '270',
  '300',
  '310',
  '320',
  '380',
]);
/** Deductions 500 to 738: 499 less them is the net income before the social deductions. */
export const DEDUCTIONS = new Set<string>([
  '500',
  '505',
  '510',
  '515',
  '520',
  '525',
  '530',
  '535',
  '555',
  '570',
  '575',
  '600',
  '605',
  '610',
  '615',
  '620',
  '625',
  '630',
  '640',
  '650',
  '655',
  '680',
  '720',
  '735',
  '738',
]);
/** Social deductions (Sozialabzüge) of the state tax that the engine computes. */
export const SOCIAL = new Set<string>(['770', '771']);
/** Social deductions of the federal column (./ifd.ts): the children and married couples. */
export const FEDERAL_SOCIAL = new Set<string>(['750', '775']);
/** Wealth: assets, debts, then the allowance. */
export const ASSETS = new Set<string>(['800', '805', '810', '815', '825']);
export const DEBTS = new Set<string>(['891']);
export const ALLOWANCES = new Set<string>(['900', '905']);
