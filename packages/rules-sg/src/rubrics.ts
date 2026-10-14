// The lines of the St. Gallen return the engine reads or computes, with the official German term and
// its gloss. The codes are those printed on the 2025 return (sg-2025-form-steuererklaerung, Formular
// 1: page 2 income, page 3 deductions and the taxable income, page 4 wealth) and on its Form 4 for
// professional costs (sg-2025-form-berufskosten: page 1 for person 1, page 2 for person 2), explained
// under the same Ziffern in the 2025 guide (sg-2025-guide-wegleitung). No 2026 return is published
// yet (docs/sources/sg/NOTES.md, Gaps): the 2025 codes stand for both years. The return has one
// column: the federal tax is derived from it by the tax office (guide p. 49).
import type { Text } from '@taxpresso/rules-ch';

const FORM = 'sg-2025-form-steuererklaerung';
const FORM4 = 'sg-2025-form-berufskosten';
const GUIDE = 'sg-2025-guide-wegleitung';

export interface Rubric {
  label: Text;
  source: string;
}

/** A line of the return: its Ziffer and its official term, then the gloss. */
const r = (
  ziffer: string,
  de: string,
  en: string,
  fr: string,
  page: 2 | 3 | 4,
  guide: string,
): Rubric => ({
  label: { en: `${en} (${ziffer} ${de})`, fr: `${fr} (${ziffer} ${de})`, de: `${ziffer} ${de}` },
  source: `${FORM} p. ${page} (Ziffer ${ziffer}); ${GUIDE} p. ${guide}`,
});

/** A line of Form 4 for person 1 or 2. */
const f4 = (
  ziffer: string,
  de: string,
  en: string,
  fr: string,
  person: 1 | 2,
  guide: string,
): Rubric => ({
  label: {
    en: `${en}, person ${person} (Form 4, ${ziffer} ${de})`,
    fr: `${fr}, personne ${person} (formulaire 4, ${ziffer} ${de})`,
    de: `Formular 4, ${ziffer} ${de}, Person ${person}`,
  },
  source: `${FORM4} p. ${person} (Ziffer ${ziffer}); ${GUIDE} p. ${guide}`,
});

export const RUBRICS = {
  // Income (Einkünfte), form page 2.
  '100': r(
    '1.1',
    'Haupterwerb, Person 1',
    'Main employment, net salary, person 1',
    'Activité principale, salaire net, personne 1',
    2,
    '15',
  ),
  '102': r(
    '1.1',
    'Haupterwerb, Person 2',
    'Main employment, net salary, person 2',
    'Activité principale, salaire net, personne 2',
    2,
    '15',
  ),
  '104': r(
    '1.2',
    'Nebenerwerb, Person 1',
    'Side job, net salary, person 1',
    'Activité accessoire, salaire net, personne 1',
    2,
    '15',
  ),
  '106': r(
    '1.2',
    'Nebenerwerb, Person 2',
    'Side job, net salary, person 2',
    'Activité accessoire, salaire net, personne 2',
    2,
    '15',
  ),
  '126': r(
    '3.1',
    'AHV/IV-Renten, Person 1',
    'AHV/IV pensions, person 1',
    'Rentes AVS/AI, personne 1',
    2,
    '18',
  ),
  '128': r(
    '3.1',
    'AHV/IV-Renten, Person 2',
    'AHV/IV pensions, person 2',
    'Rentes AVS/AI, personne 2',
    2,
    '18',
  ),
  '130': r(
    '3.2',
    'Renten/Pensionen, Person 1',
    'Pensions, person 1',
    'Rentes et pensions, personne 1',
    2,
    '18',
  ),
  '132': r(
    '3.2',
    'Renten/Pensionen, Person 2',
    'Pensions, person 2',
    'Rentes et pensions, personne 2',
    2,
    '18',
  ),
  '134': r(
    '3.3',
    'Erwerbsausfallentschädigung, Person 1',
    'Loss-of-earnings allowances, person 1',
    'Indemnités pour perte de gain, personne 1',
    2,
    '19',
  ),
  '136': r(
    '3.3',
    'Erwerbsausfallentschädigung, Person 2',
    'Loss-of-earnings allowances, person 2',
    'Indemnités pour perte de gain, personne 2',
    2,
    '19',
  ),
  '138': r(
    '3.4',
    'Arbeitslosen-Taggelder, Person 1',
    'Unemployment benefits, person 1',
    'Indemnités de chômage, personne 1',
    2,
    '19',
  ),
  '140': r(
    '3.4',
    'Arbeitslosen-Taggelder, Person 2',
    'Unemployment benefits, person 2',
    'Indemnités de chômage, personne 2',
    2,
    '19',
  ),
  '146': r(
    '4.1',
    'Einkünfte aus Wertschriften und Guthaben',
    'Income from accounts and securities',
    'Rendement des titres et des avoirs',
    2,
    '19',
  ),
  '154': r(
    '6.1',
    'Unterhaltsbeiträge für den/die Steuerpflichtige(n)',
    'Alimony received',
    'Pension alimentaire reçue',
    2,
    '21',
  ),
  '156': r(
    '6.1',
    'Unterhaltsbeiträge für minderjährige Kinder',
    'Child support received',
    'Contributions d’entretien reçues pour des enfants mineurs',
    2,
    '21',
  ),
  '162': r('6.3', 'Übrige Einkünfte', 'Other income', 'Autres revenus', 2, '21'),
  // Professional costs (Berufskosten), Form 4, to Ziffer 10.1 and 10.2 of the return.
  '406': f4(
    '1.',
    'Fahrkosten zwischen Wohn- und Arbeitsstätte',
    'Travel to work',
    'Frais de déplacement',
    1,
    '23',
  ),
  '456': f4(
    '1.',
    'Fahrkosten zwischen Wohn- und Arbeitsstätte',
    'Travel to work',
    'Frais de déplacement',
    2,
    '23',
  ),
  '408': f4(
    '2.1',
    'Mehrkosten für Verpflegung',
    'Lunch away from home',
    'Repas pris hors du domicile',
    1,
    '24',
  ),
  '458': f4(
    '2.1',
    'Mehrkosten für Verpflegung',
    'Lunch away from home',
    'Repas pris hors du domicile',
    2,
    '24',
  ),
  '410': f4(
    '2.2',
    'Mehrkosten für Verpflegung, verbilligt',
    'Lunch away from home, reduced by the employer',
    'Repas hors du domicile, à prix réduit',
    1,
    '24',
  ),
  '460': f4(
    '2.2',
    'Mehrkosten für Verpflegung, verbilligt',
    'Lunch away from home, reduced by the employer',
    'Repas hors du domicile, à prix réduit',
    2,
    '24',
  ),
  '416': f4(
    '3.1',
    'Pauschalabzug übrige Berufskosten',
    'Other professional costs, flat amount',
    'Autres frais professionnels, forfait',
    1,
    '24',
  ),
  '466': f4(
    '3.1',
    'Pauschalabzug übrige Berufskosten',
    'Other professional costs, flat amount',
    'Autres frais professionnels, forfait',
    2,
    '24',
  ),
  '418': f4(
    '3.2',
    'Tatsächliche Berufskosten',
    'Other professional costs, actual',
    'Autres frais professionnels effectifs',
    1,
    '24',
  ),
  '468': f4(
    '3.2',
    'Tatsächliche Berufskosten',
    'Other professional costs, actual',
    'Autres frais professionnels effectifs',
    2,
    '24',
  ),
  '432': f4(
    '5.1',
    'Nebenerwerb, Pauschalabzug',
    'Side job, flat costs',
    'Activité accessoire, forfait',
    1,
    '25',
  ),
  '482': f4(
    '5.1',
    'Nebenerwerb, Pauschalabzug',
    'Side job, flat costs',
    'Activité accessoire, forfait',
    2,
    '25',
  ),
  // Deductions (Abzüge), form page 3.
  '500': r('11.', 'Schuldzinsen', 'Private debt interest', 'Intérêts des dettes privées', 3, '25'),
  '200': r(
    '12.1',
    'Unterhaltsbeiträge an Geschiedene oder Getrennte',
    'Alimony paid',
    'Pension alimentaire versée',
    3,
    '26',
  ),
  '202': r(
    '12.2',
    'Unterhaltsbeiträge für minderjährige Kinder',
    'Child support paid',
    'Contributions d’entretien versées pour des enfants mineurs',
    3,
    '26',
  ),
  '208': r('13.1', 'Säule 3a, Person 1', 'Pillar 3a, person 1', 'Pilier 3a, personne 1', 3, '26'),
  '210': r('13.1', 'Säule 3a, Person 2', 'Pillar 3a, person 2', 'Pilier 3a, personne 2', 3, '26'),
  '218': r(
    '13.2',
    'Säule 2 (BVG) inkl. Einkaufsbeiträge, Person 1',
    'Pension fund buy-ins, person 1',
    'Rachats de caisse de pension, personne 1',
    3,
    '26',
  ),
  '219': r(
    '13.2',
    'Säule 2 (BVG) inkl. Einkaufsbeiträge, Person 2',
    'Pension fund buy-ins, person 2',
    'Rachats de caisse de pension, personne 2',
    3,
    '26',
  ),
  '600': r(
    '14.',
    'Versicherungsprämien und Sparzinsen',
    'Insurance premiums and savings interest',
    'Primes d’assurance et intérêts de l’épargne',
    3,
    '27',
  ),
  '220': r(
    '16.1',
    'Verwaltungskosten für Wertschriften',
    'Costs of managing securities',
    'Frais de gestion des titres',
    3,
    '27',
  ),
  '258': r(
    '16.2',
    'Kinderbetreuungskosten bei Drittbetreuung',
    'Childcare by third parties',
    'Frais de garde des enfants par des tiers',
    3,
    '28',
  ),
  '555': r('16.3', 'Parteispenden', 'Political parties', 'Partis politiques', 3, '28'),
  '223': r(
    '16.4',
    'Kosten berufsorientierte Aus-/Weiterbildung, Person 1',
    'Professional training, person 1',
    'Formation et perfectionnement professionnels, personne 1',
    3,
    '28',
  ),
  '224': r(
    '16.4',
    'Kosten berufsorientierte Aus-/Weiterbildung, Person 2',
    'Professional training, person 2',
    'Formation et perfectionnement professionnels, personne 2',
    3,
    '28',
  ),
  '226': r(
    '17.',
    'Zweiverdienerabzug',
    'Both spouses work',
    'Déduction pour double activité',
    3,
    '29',
  ),
  // Deductions from the Nettoeinkommen (Abzüge vom Nettoeinkommen).
  '240': r(
    '21.1',
    'Krankheits- und Unfallkosten',
    'Illness and accident costs',
    'Frais de maladie et d’accident',
    3,
    '29',
  ),
  '244': r('21.3', 'Freiwillige Zuwendungen', 'Donations', 'Dons', 3, '30'),
  // Social deductions (Sozialabzüge).
  '252': r(
    '23.1',
    'Kinderabzug für jedes noch nicht schulpflichtige Kind',
    'Child deduction, before school age',
    'Déduction pour enfant d’âge préscolaire',
    3,
    '31',
  ),
  '254': r(
    '23.2',
    'Kinderabzug für jedes Kind in Schule oder Ausbildung',
    'Child deduction, in school or training',
    'Déduction pour enfant en formation',
    3,
    '31',
  ),
  '256': r(
    '23.3',
    'Ausbildungskosten für Kinder in Schule oder Ausbildung',
    'Children’s education costs',
    'Frais de formation des enfants',
    3,
    '31',
  ),
} as const satisfies Record<string, Rubric>;

export const WEALTH_RUBRICS = {
  '300': r(
    '30.1',
    'Wertschriften und Guthaben',
    'Securities and accounts',
    'Titres et avoirs',
    4,
    '32',
  ),
  '302': r(
    '30.2',
    'Bargeld, Gold und andere Edelmetalle',
    'Cash, gold and precious metals',
    'Argent liquide, or et métaux précieux',
    4,
    '32',
  ),
  '304': r(
    '30.3',
    'Lebens- und Rentenversicherungen',
    'Life and annuity insurance, surrender value',
    'Assurances vie et de rente, valeur de rachat',
    4,
    '32',
  ),
  '306': r('30.4', 'Motorfahrzeuge', 'Vehicles', 'Véhicules', 4, '33'),
  '310': r('30.6', 'Übrige Vermögenswerte', 'Other assets', 'Autres éléments de fortune', 4, '33'),
  '504': r('34.1', 'Privatschulden', 'Private debts', 'Dettes privées', 4, '34'),
  '330': r(
    '36.1',
    'Abzug für alleinstehende Steuerpflichtige',
    'Wealth deduction, single taxpayer',
    'Déduction sur la fortune, personne seule',
    4,
    '34',
  ),
  '332': r(
    '36.2',
    'Abzug für gemeinsam steuerpflichtige Ehegatten',
    'Wealth deduction, married couple',
    'Déduction sur la fortune, couple marié',
    4,
    '34',
  ),
  '334': r(
    '36.3',
    'Abzug für jedes minderjährige Kind',
    'Wealth deduction, minor children',
    'Déduction sur la fortune, enfants mineurs',
    4,
    '34',
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

/** The order of the lines on the return (the codes are not in numeric order there). */
export const ORDER: readonly string[] = [
  '100',
  '102',
  '104',
  '106',
  '126',
  '128',
  '130',
  '132',
  '134',
  '136',
  '138',
  '140',
  '146',
  '154',
  '156',
  '162',
  '406',
  '408',
  '410',
  '416',
  '418',
  '432',
  '456',
  '458',
  '460',
  '466',
  '468',
  '482',
  '500',
  '200',
  '202',
  '208',
  '210',
  '218',
  '219',
  '600',
  '220',
  '258',
  '555',
  '223',
  '224',
  '226',
  '240',
  '244',
  '252',
  '254',
  '256',
];
export const WEALTH_ORDER: readonly string[] = [
  '300',
  '302',
  '304',
  '306',
  '310',
  '504',
  '330',
  '332',
  '334',
];

/** The codes of the lines that have one for each person. */
export const PERSON_CODES = {
  main: { p1: '100', p2: '102' },
  side: { p1: '104', p2: '106' },
  avs: { p1: '126', p2: '128' },
  pension: { p1: '130', p2: '132' },
  allowances: { p1: '134', p2: '136' },
  unemployment: { p1: '138', p2: '140' },
  travel: { p1: '406', p2: '456' },
  meals: { p1: '408', p2: '458' },
  mealsHalf: { p1: '410', p2: '460' },
  otherFlat: { p1: '416', p2: '466' },
  otherActual: { p1: '418', p2: '468' },
  sideCosts: { p1: '432', p2: '482' },
  pillar3a: { p1: '208', p2: '210' },
  buyIn: { p1: '218', p2: '219' },
  training: { p1: '223', p2: '224' },
} as const satisfies Record<string, { p1: RubricCode; p2: RubricCode }>;

/** Income lines (Einkünfte): their total is 168 (Ziffer 7). */
export const INCOME = new Set<string>(ORDER.slice(0, 16));
/** Deductions 10 to 17: 168 less them is the Nettoeinkommen, 234 (Ziffer 20). */
export const DEDUCTIONS = new Set<string>(ORDER.slice(16, 42));
/** Deductions from the Nettoeinkommen, 21.1 to 21.3: 234 less them is the Reineinkommen, 248. */
export const NET_DEDUCTIONS = new Set<string>(['240', '244']);
/** Social deductions (Sozialabzüge), 23.1 to 23.3: 248 less them is the taxable income, 268. */
export const SOCIAL = new Set<string>(['252', '254', '256']);
/** Wealth: assets, debts, then the social deductions. */
export const ASSETS = new Set<string>(['300', '302', '304', '306', '310']);
export const DEBTS = new Set<string>(['504']);
export const ALLOWANCES = new Set<string>(['330', '332', '334']);
