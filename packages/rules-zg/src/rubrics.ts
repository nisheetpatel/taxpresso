// The lines of Zug's main form K the engine reads or computes, with the official German term and its
// gloss. The codes are those printed on the 2025 form (the guide's sample return,
// zg-2025-guide-wegleitung p. 17 income, p. 18 deductions and the taxable income, p. 19 wealth) and
// explained under the same codes in the guide (the page next to each). The 2026 forms and guide are not
// published yet (docs/sources/zg/NOTES.md, Gaps): the 2025 codes are used for both years. Lines
// with a code for each person: 100 for person 1, 101 for person 2, and so on. The cantonal and the
// federal tax share the form's lines, each in its column (Kanton, Bund); the cantonal column comes
// from ./compute.ts, the federal one from ./ifd.ts, with 401 the federal column's only.
import type { Text } from '@taxpresso/rules-ch';

const GUIDE = 'zg-2025-guide-wegleitung';

export interface Rubric {
  label: Text;
  source: string;
}

const r = (de: string, en: string, fr: string, form: 17 | 18 | 19, guide: string): Rubric => ({
  label: { en: `${en} (${de})`, fr: `${fr} (${de})`, de },
  source: `${GUIDE} p. ${form} (Mustersteuererklärung, Formular K), p. ${guide}`,
});

const income = (de: string, en: string, fr: string, guide: string) => r(de, en, fr, 17, guide);
const deduction = (de: string, en: string, fr: string, guide: string) => r(de, en, fr, 18, guide);
const asset = (de: string, en: string, fr: string, guide: string) => r(de, en, fr, 19, guide);

export const RUBRICS = {
  // Income (Einkünfte im In- und Ausland), form K page 2.
  '100': income(
    'Haupterwerb, Person 1',
    'Main employment, net salary, person 1',
    'Activité principale, salaire net, personne 1',
    '20',
  ),
  '101': income(
    'Haupterwerb, Person 2',
    'Main employment, net salary, person 2',
    'Activité principale, salaire net, personne 2',
    '20',
  ),
  '105': income(
    'Nebenerwerb, Person 1',
    'Side job, net salary, person 1',
    'Activité accessoire, salaire net, personne 1',
    '20',
  ),
  '106': income(
    'Nebenerwerb, Person 2',
    'Side job, net salary, person 2',
    'Activité accessoire, salaire net, personne 2',
    '20',
  ),
  '130': income(
    'AHV-/IV-Renten, Person 1',
    'AHV/IV pensions, person 1',
    'Rentes AVS/AI, personne 1',
    '22',
  ),
  '131': income(
    'AHV-/IV-Renten, Person 2',
    'AHV/IV pensions, person 2',
    'Rentes AVS/AI, personne 2',
    '22',
  ),
  '135': income(
    'Renten/Pensionen, Person 1',
    'Pensions, person 1',
    'Rentes et pensions, personne 1',
    '22',
  ),
  '136': income(
    'Renten/Pensionen, Person 2',
    'Pensions, person 2',
    'Rentes et pensions, personne 2',
    '22',
  ),
  '145': income(
    'Erwerbsausfallentschädigungen, Person 1',
    'Loss-of-earnings allowances, person 1',
    'Indemnités pour perte de gain, personne 1',
    '22',
  ),
  '146': income(
    'Erwerbsausfallentschädigungen, Person 2',
    'Loss-of-earnings allowances, person 2',
    'Indemnités pour perte de gain, personne 2',
    '22',
  ),
  '150': income(
    'Taggelder aus Arbeitslosenversicherung, Person 1',
    'Unemployment benefits, person 1',
    'Indemnités de chômage, personne 1',
    '22',
  ),
  '151': income(
    'Taggelder aus Arbeitslosenversicherung, Person 2',
    'Unemployment benefits, person 2',
    'Indemnités de chômage, personne 2',
    '22',
  ),
  '160': income(
    'Wertschriftenertrag (WV)',
    'Income from securities and accounts',
    'Rendement des titres et avoirs',
    '23',
  ),
  '170': income(
    'Unterhaltsbeiträge vom geschieden/getrennt lebenden Eheteil',
    'Alimony received',
    'Pension alimentaire reçue',
    '28',
  ),
  '171': income(
    'Unterhaltsbeiträge für minderjährige Kinder',
    'Child support received',
    'Contributions d’entretien reçues pour des enfants mineurs',
    '28',
  ),
  '173': income('Weitere Einkünfte', 'Other income', 'Autres revenus', '28'),
  // Never computed (property is not supported); listed so a return that has it, such as the guide's
  // sample, can be assessed.
  '181': income(
    'Ertrag/Nutzniessung private Liegenschaften (LVZ)',
    'Income from private property',
    'Rendement des immeubles privés',
    '29',
  ),
  // Deductions (Abzüge), form K page 3.
  '201': deduction(
    'Berufsauslagen (BA), Person 1',
    'Professional costs, person 1',
    'Frais professionnels, personne 1',
    '32 to 34',
  ),
  '202': deduction(
    'Berufsauslagen (BA), Person 2',
    'Professional costs, person 2',
    'Frais professionnels, personne 2',
    '32 to 34',
  ),
  '205': deduction(
    'Private Schuldzinsen (SV)',
    'Private debt interest',
    'Intérêts de dettes privées',
    '34 and 35',
  ),
  '210': deduction(
    'Unterhaltsbeiträge an geschiedenen/getrennten Ehegatten',
    'Alimony paid',
    'Pension alimentaire versée',
    '35',
  ),
  '211': deduction(
    'Unterhaltsbeiträge für minderjährige Kinder (KI)',
    'Child support paid',
    'Contributions d’entretien versées pour des enfants mineurs',
    '35',
  ),
  '220': deduction(
    'Beiträge gebundene Vorsorge (Säule 3a), Person 1',
    'Pillar 3a, person 1',
    'Pilier 3a, personne 1',
    '36',
  ),
  '221': deduction(
    'Beiträge gebundene Vorsorge (Säule 3a), Person 2',
    'Pillar 3a, person 2',
    'Pilier 3a, personne 2',
    '36',
  ),
  '230': deduction(
    'Versicherungsprämien und Zinsen von Sparkapitalien (VZ)',
    'Insurance premiums and savings interest',
    'Primes d’assurance et intérêts de l’épargne',
    '37',
  ),
  '245': deduction(
    'Aus- und Weiterbildungskosten, Person 1',
    'Professional training, person 1',
    'Formation continue, personne 1',
    '37',
  ),
  '246': deduction(
    'Aus- und Weiterbildungskosten, Person 2',
    'Professional training, person 2',
    'Formation continue, personne 2',
    '37',
  ),
  '250': deduction(
    'Beiträge an die 2. Säule (Einkaufsbeiträge), Person 1',
    'Pension fund buy-ins, person 1',
    'Rachats de prévoyance, personne 1',
    '37',
  ),
  '251': deduction(
    'Beiträge an die 2. Säule (Einkaufsbeiträge), Person 2',
    'Pension fund buy-ins, person 2',
    'Rachats de prévoyance, personne 2',
    '37',
  ),
  '252': deduction(
    'Zuwendungen an politische Parteien (PB)',
    'Political parties',
    'Partis politiques',
    '38',
  ),
  '253': deduction(
    'Kinderdrittbetreuungskostenabzug (KDBK)',
    'Childcare by others',
    'Frais de garde des enfants par des tiers',
    '38',
  ),
  '255': deduction(
    'Kosten für die Vermögensverwaltung',
    'Costs of managing securities',
    'Frais de gestion de la fortune',
    '38 and 39',
  ),
  '260': deduction(
    'Sonderabzug bei Erwerbstätigkeit beider Eheleute',
    'Both spouses work',
    'Déduction en cas d’activité des deux conjoints',
    '40',
  ),
  '295': deduction(
    'Krankheits- und Unfallkosten (UK)',
    'Illness and accident costs',
    'Frais de maladie et d’accident',
    '40',
  ),
  '296': deduction('Gemeinnützige Zuwendungen (GZ)', 'Donations', 'Dons d’utilité publique', '41'),
  // Social deductions (Sozialabzüge, cantonal column), form K page 3.
  '400': deduction(
    'Persönlicher Abzug für Eheleute und alleinstehende Personen mit Kindern',
    'Personal deduction, married couples and parents living with their children',
    'Déduction personnelle, couples mariés et parents vivant avec leurs enfants',
    '41',
  ),
  // The federal column only: the married couple deduction (LIFD art. 35 al. 1 let. c); the cantonal
  // tax has none (guide p. 41, Code 401).
  '401': deduction(
    'Abzug für Ehepaare (nur Bundessteuer)',
    'Married couples, federal tax only',
    'Couples mariés, impôt fédéral seulement',
    '41',
  ),
  '402': deduction(
    'Persönlicher Abzug für die übrigen Steuerpflichtigen',
    'Personal deduction, everyone else',
    'Déduction personnelle, autres contribuables',
    '41',
  ),
  '403': deduction('Kinderabzug', 'Child deduction', 'Déduction pour enfant', '41'),
  '403a': deduction(
    'Kinderabzug Zusatz',
    'Child deduction, more from the year the child turns 15',
    'Déduction pour enfant, supplément dès l’année des 15 ans',
    '41',
  ),
  '404': deduction(
    'Eigenbetreuungsabzug',
    'Own care of children under 15',
    'Garde des enfants de moins de 15 ans par les parents',
    '41',
  ),
  '406': deduction('Abzug für AHV-/IV-Rentner', 'AHV/IV pensioners', 'Rentiers AVS/AI', '42'),
  '407': deduction('Mietzinsabzug (MZ)', 'Renters', 'Déduction pour locataires', '42'),
  // Never computed (qualifying participations are not supported); listed for the guide's sample.
  '410': deduction(
    'Reduktion der wirtschaftlichen Doppelbelastung (WV)',
    'Reduction for qualifying participations',
    'Réduction de la double imposition économique',
    '42',
  ),
} as const satisfies Record<string, Rubric>;

export const WEALTH_RUBRICS = {
  '600': asset(
    'Wertschriften und Guthaben (WV)',
    'Securities and accounts',
    'Titres et avoirs',
    '42',
  ),
  '601': asset(
    'Bargeld, Gold und andere Edelmetalle',
    'Cash, gold and other precious metals',
    'Argent liquide, or et autres métaux précieux',
    '42',
  ),
  '603': asset(
    'Lebensversicherungen',
    'Life insurance, surrender value',
    'Assurances-vie, valeur de rachat',
    '42 and 43',
  ),
  '604': asset('Motorfahrzeuge', 'Vehicles', 'Véhicules', '43'),
  '606': asset('Übrige Vermögenswerte', 'Other assets', 'Autres éléments de fortune', '43'),
  // Never computed (property is not supported); listed for the guide's sample.
  '610': asset(
    'Steuerwert private Liegenschaften (LVZ)',
    'Private property, tax value',
    'Immeubles privés, valeur fiscale',
    '43',
  ),
  '640': asset(
    'Privatschulden (SV)',
    'Private debts and mortgages',
    'Dettes privées et hypothèques',
    '45',
  ),
  '671': asset(
    'Steuerfreier Betrag für Eheleute',
    'Tax-free wealth, married couples',
    'Fortune exonérée, couples mariés',
    '45',
  ),
  '672': asset(
    'Steuerfreier Betrag für übrige Steuerpflichtige',
    'Tax-free wealth, everyone else',
    'Fortune exonérée, autres contribuables',
    '45',
  ),
  '673': asset(
    'Steuerfreier Betrag für jedes minderjährige Kind',
    'Tax-free wealth, each minor child',
    'Fortune exonérée, chaque enfant mineur',
    '45',
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
  main: { p1: '100', p2: '101' },
  side: { p1: '105', p2: '106' },
  avs: { p1: '130', p2: '131' },
  pensions: { p1: '135', p2: '136' },
  allowances: { p1: '145', p2: '146' },
  unemployment: { p1: '150', p2: '151' },
  professional: { p1: '201', p2: '202' },
  pillar3a: { p1: '220', p2: '221' },
  training: { p1: '245', p2: '246' },
  buyIn: { p1: '250', p2: '251' },
} as const satisfies Record<string, { p1: RubricCode; p2: RubricCode }>;

/** Income lines (Einkünfte): their total is 190. */
export const INCOME = new Set<string>([
  '100',
  '101',
  '105',
  '106',
  '130',
  '131',
  '135',
  '136',
  '145',
  '146',
  '150',
  '151',
  '160',
  '170',
  '171',
  '173',
  '181',
]);
/** Deductions 201 to 260: their total is 280; 190 less 280 is the subtotal 287. */
export const DEDUCTIONS = new Set<string>([
  '201',
  '202',
  '205',
  '210',
  '211',
  '220',
  '221',
  '230',
  '245',
  '246',
  '250',
  '251',
  '252',
  '253',
  '255',
  '260',
]);
/** The further deductions (Zusätzliche Abzüge) on 287: 287 less them is the net income 299. */
export const FURTHER = new Set<string>(['295', '296']);
/**
 * Social deductions (Sozialabzüge, cantonal column), and the reduction 410: 299 less them is the
 * taxable income 490.
 */
export const SOCIAL = new Set<string>(['400', '402', '403', '403a', '404', '406', '407', '410']);
/**
 * Social deductions of the federal column (Bund 2025): the married couple deduction (401, the
 * federal column's only) and the child deduction (403, the federal amount); 299 less them is the
 * federal taxable income 490 (./ifd.ts).
 */
export const FEDERAL_SOCIAL = new Set<string>(['401', '403']);
/** Wealth: assets, debts, then the tax-free amounts. */
export const ASSETS = new Set<string>(['600', '601', '603', '604', '606', '610']);
export const DEBTS = new Set<string>(['640']);
export const ALLOWANCES = new Set<string>(['671', '672', '673']);
