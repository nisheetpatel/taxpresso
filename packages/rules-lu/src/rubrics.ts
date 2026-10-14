// The lines of the Lucerne return the engine computes, with the official German term and its gloss.
// The forms cannot be downloaded (docs/sources/lu/NOTES.md, Gaps); the 2025 guide prints them filled
// in for a sample family (lu-2025-guide-wegleitung p. 13 to 19: page 1 to 4 of the return, the
// Wertschriftenverzeichnis WV, form B Berufsauslagen, form V Versicherungsbeiträge). A code is the
// Ziffer as printed: the return numbers each line, the person's even and the spouse's odd where
// the form has a line per person (100 and 101, 208t and 209t). The two lines of the
// Wertschriftenverzeichnis's summary the return takes are "WV4" (Zwischentotal Bruttoerträge) and
// "WV6" (Vermögensverwaltungskosten); the return's Ziffer 150 is their difference.
import type { Text } from '@taxpresso/rules-ch';

const GUIDE = 'lu-2025-guide-wegleitung';

export interface Rubric {
  label: Text;
  source: string;
}

const r = (de: string, en: string, fr: string, page: number, more = ''): Rubric => ({
  label: { en: `${en} (${de})`, fr: `${fr} (${de})`, de },
  source: `${GUIDE} p. ${page}${more}`,
});

export const RUBRICS = {
  // Income (Einkünfte, page 2 of the return; lu-2025-guide-wegleitung p. 15).
  '100': r(
    'Haupterwerb Person 1',
    'Main employment, person 1, net salary',
    'Activité principale, personne 1, salaire net',
    15,
  ),
  '101': r(
    'Haupterwerb Person 2',
    'Main employment, person 2, net salary',
    'Activité principale, personne 2, salaire net',
    15,
  ),
  '104': r('Nebenerwerb Person 1', 'Side job, person 1', 'Activité accessoire, personne 1', 15),
  '105': r('Nebenerwerb Person 2', 'Side job, person 2', 'Activité accessoire, personne 2', 15),
  '130': r('AHV- / IV-Renten Person 1', 'AHV/IV pension, person 1', 'Rente AVS/AI, personne 1', 15),
  '131': r('AHV- / IV-Renten Person 2', 'AHV/IV pension, person 2', 'Rente AVS/AI, personne 2', 15),
  '132': r(
    'Renten/Pensionen Person 1',
    'Pension fund pension, person 1',
    'Rente de prévoyance, personne 1',
    15,
  ),
  '133': r(
    'Renten/Pensionen Person 2',
    'Pension fund pension, person 2',
    'Rente de prévoyance, personne 2',
    15,
  ),
  '136': r('übrige Renten Person 1', 'Other pensions, person 1', 'Autres rentes, personne 1', 15),
  '137': r('übrige Renten Person 2', 'Other pensions, person 2', 'Autres rentes, personne 2', 15),
  '140': r(
    'Erwerbsausfallentschädigungen Person 1',
    'Daily allowances and unemployment benefits, person 1',
    'Indemnités journalières et de chômage, personne 1',
    15,
  ),
  '141': r(
    'Erwerbsausfallentschädigungen Person 2',
    'Daily allowances and unemployment benefits, person 2',
    'Indemnités journalières et de chômage, personne 2',
    15,
  ),
  WV4: r(
    'Wertschriftenverzeichnis, Zwischentotal Bruttoerträge A + B',
    'Gross income of securities and accounts',
    'Rendement brut des titres et avoirs',
    14,
    ' (WV, Zusammenfassung Ziffer 4 and 9)',
  ),
  WV6: r(
    'Abzüglich Vermögensverwaltungskosten',
    'Costs of keeping securities and accounts',
    'Frais de gestion des titres et avoirs',
    14,
    ' (WV, Zusammenfassung Ziffer 6); p. 40',
  ),
  '160': r(
    'Unterhaltsbeiträge für den/die Steuerpflichtige(n)',
    'Alimony received',
    'Pension alimentaire reçue',
    15,
  ),
  '161': r(
    'Unterhaltsbeiträge / Alimente für Kinder',
    'Child support received',
    'Contributions d’entretien reçues pour les enfants',
    15,
  ),
  '166': r('Weitere Einkünfte', 'Other income', 'Autres revenus', 15),
  // Deductions (Abzüge, page 3 of the return, p. 17; form B Berufsauslagen, p. 16).
  '208t': r(
    'Fahrkosten total Person 1',
    'Travel to work, person 1',
    'Frais de déplacement, personne 1',
    16,
    ' (form B)',
  ),
  '209t': r(
    'Fahrkosten total Person 2',
    'Travel to work, person 2',
    'Frais de déplacement, personne 2',
    16,
    ' (form B)',
  ),
  '212': r(
    'Mehrkosten der Verpflegung Person 1',
    'Meals away from home, person 1',
    'Repas hors du domicile, personne 1',
    16,
    ' (form B)',
  ),
  '213': r(
    'Mehrkosten der Verpflegung Person 2',
    'Meals away from home, person 2',
    'Repas hors du domicile, personne 2',
    16,
    ' (form B)',
  ),
  '214': r(
    'Mehrkosten der Verpflegung mit Verbilligung Person 1',
    'Meals away from home, reduced, person 1',
    'Repas hors du domicile, réduits, personne 1',
    16,
    ' (form B)',
  ),
  '215': r(
    'Mehrkosten der Verpflegung mit Verbilligung Person 2',
    'Meals away from home, reduced, person 2',
    'Repas hors du domicile, réduits, personne 2',
    16,
    ' (form B)',
  ),
  '220': r(
    'Übrige für die Ausübung des Berufes erforderliche Kosten Person 1',
    'Other professional costs, person 1',
    'Autres frais professionnels, personne 1',
    16,
    ' (form B)',
  ),
  '221': r(
    'Übrige für die Ausübung des Berufes erforderliche Kosten Person 2',
    'Other professional costs, person 2',
    'Autres frais professionnels, personne 2',
    16,
    ' (form B)',
  ),
  '236': r(
    'Auslagen bei Nebenerwerb Person 1',
    'Side job costs, person 1',
    'Frais de l’activité accessoire, personne 1',
    16,
    ' (form B)',
  ),
  '237': r(
    'Auslagen bei Nebenerwerb Person 2',
    'Side job costs, person 2',
    'Frais de l’activité accessoire, personne 2',
    16,
    ' (form B)',
  ),
  '248': r(
    'Berufsorientierte Aus- und Weiterbildung Person 1',
    'Professional training, person 1',
    'Formation professionnelle, personne 1',
    17,
  ),
  '249': r(
    'Berufsorientierte Aus- und Weiterbildung Person 2',
    'Professional training, person 2',
    'Formation professionnelle, personne 2',
    17,
  ),
  '252': r('Schuldzinsen', 'Private debt interest', 'Intérêts des dettes privées', 17),
  '254': r(
    'Unterhaltsbeiträge an geschiedene/getrennt lebende Ehegatten',
    'Alimony paid',
    'Pension alimentaire versée',
    17,
  ),
  '255': r(
    'Unterhaltsbeiträge / Alimente an minderjährige Kinder',
    'Child support paid',
    'Contributions d’entretien versées pour les enfants',
    17,
  ),
  '260': r('Säule 3a Person 1', 'Pillar 3a, person 1', 'Pilier 3a, personne 1', 17),
  '261': r('Säule 3a Person 2', 'Pillar 3a, person 2', 'Pilier 3a, personne 2', 17),
  '270': r(
    'Versicherungsprämien und Zinsen von Sparkapitalien',
    'Insurance premiums and savings interest',
    'Primes d’assurance et intérêts des capitaux d’épargne',
    17,
  ),
  '280': r(
    'Beiträge an 2. Säule Person 1',
    'Pension fund buy-in paid, person 1',
    'Rachat de prévoyance versé, personne 1',
    17,
  ),
  '282': r(
    'Beiträge an 2. Säule Person 2',
    'Pension fund buy-in paid, person 2',
    'Rachat de prévoyance versé, personne 2',
    17,
  ),
  // Additional deductions (Zusätzliche Abzüge, p. 17).
  '320': r(
    'Krankheits-, Unfall- und behinderungsbedingte Kosten',
    'Medical costs',
    'Frais de maladie et d’accident',
    17,
  ),
  '324': r('Freiwillige Zuwendungen', 'Donations', 'Dons', 17),
  '325': r(
    'Zuwendungen und Beiträge an politische Parteien',
    'Political parties',
    'Partis politiques',
    17,
  ),
  '326': r(
    'Sonderabzug bei Erwerbstätigkeit beider Ehegatten',
    'Both spouses earn',
    'Les deux époux travaillent',
    17,
  ),
  // Social deductions (Sozialabzüge, p. 17).
  '340': r(
    'Persönlicher degressiver Sozialabzug',
    'Degressive social deduction',
    'Déduction sociale dégressive',
    17,
  ),
  '350': r('Kinderabzug', 'Child deduction', 'Déduction pour enfants', 17),
  '352': r(
    'Kinderabzug bei ständigem Aufenthalt am auswärtigen Ausbildungsort',
    'Child deduction, education away from home',
    'Déduction pour enfants en formation hors du domicile',
    17,
  ),
  '353': r(
    'Abzug für Eigenbetreuung',
    'Own care of children under 14',
    'Garde des enfants de moins de 14 ans par les parents',
    17,
  ),
  '360': r('Fremdbetreuungskosten', 'Childcare by others', 'Frais de garde par des tiers', 17),
} satisfies Record<string, Rubric>;

/** The wealth lines (Vermögen, page 4 of the return; lu-2025-guide-wegleitung p. 19). */
export const WEALTH_RUBRICS = {
  '400': r('Wertschriften und Guthaben', 'Securities and accounts', 'Titres et avoirs', 19),
  '404': r(
    'Bargeld, Gold und andere Edelmetalle',
    'Cash, gold and precious metals',
    'Argent liquide, or et métaux précieux',
    19,
  ),
  '410': r(
    'Lebensversicherungen',
    'Life insurance, surrender value',
    'Assurances-vie, valeur de rachat',
    19,
  ),
  '412': r('Motorfahrzeuge', 'Vehicles', 'Véhicules', 19),
  '416': r('Übrige Vermögenswerte', 'Other assets', 'Autres éléments de fortune', 19),
  '462': r('Schulden', 'Debts', 'Dettes', 19),
  '472': r(
    'Steuerfreie Beträge für Verheiratete / eingetragene Partner',
    'Tax-free wealth, spouses',
    'Fortune exonérée, époux',
    19,
  ),
  '473': r(
    'Steuerfreie Beträge für alle übrigen Steuerpflichtigen',
    'Tax-free wealth',
    'Fortune exonérée',
    19,
  ),
  '474': r(
    'Steuerfreie Beträge für jedes Kind',
    'Tax-free wealth per child',
    'Fortune exonérée par enfant',
    19,
  ),
} satisfies Record<string, Rubric>;

/**
 * The lines of the Ergänzungsblatt Direkte Bundessteuer (lu-2025-form-ergaenzungsblatt-dbst p. 1,
 * Form. 930117): the optional sheet that derives the federal taxable income from the return
 * (./ifd.ts). A code is "E" and the Ziffer the sheet prints (E8 is its Ziffer 8). The labels leave
 * out the amounts the sheet prints next to some lines: they are the federal ones of a year, and
 * the 2025 sheet prints two of them otherwise than the federal circular (docs/sources/lu/NOTES.md,
 * Wiring Lucerne in the app). Ziffer 4, 6, 11, 14 and 21 are not covered (property, qualified
 * participations, disability costs, support).
 */
const SHEET = 'lu-2025-form-ergaenzungsblatt-dbst';
const e = (de: string, en: string, fr: string): Rubric => ({
  label: { en: `${en} (${de})`, fr: `${fr} (${de})`, de },
  source: `${SHEET} p. 1`,
});
export const FEDERAL_RUBRICS = {
  E1: e(
    'Nettoeinkommen gemäss Ziffer 310 der Steuererklärung (1)',
    'Net income of the return, Ziffer 310',
    'Revenu net de la déclaration, Ziffer 310',
  ),
  E2: e(
    'Abzug für Fahrkosten zwischen Wohn- und Arbeitsstätte, Ziff. 208t (2)',
    'Cantonal travel costs added back, person 1',
    'Frais de déplacement cantonaux rajoutés, personne 1',
  ),
  E3: e(
    'Abzug für Fahrkosten zwischen Wohn- und Arbeitsstätte, Ziff. 209t (3)',
    'Cantonal travel costs added back, person 2',
    'Frais de déplacement cantonaux rajoutés, personne 2',
  ),
  E5: e(
    'Abzug für Versicherungsprämien und Zinsen von Sparkapitalien (5)',
    'Cantonal insurance deduction added back',
    'Déduction d’assurance cantonale rajoutée',
  ),
  E7: e('Zwischentotal (7)', 'Subtotal', 'Sous-total'),
  E8: e(
    'Abzug für Fahrkosten zwischen Wohn- und Arbeitsstätte; Ziffer 2 (8)',
    'Federal travel costs, person 1',
    'Frais de déplacement fédéraux, personne 1',
  ),
  E9: e(
    'Abzug für Fahrkosten zwischen Wohn- und Arbeitsstätte; Ziffer 3 (9)',
    'Federal travel costs, person 2',
    'Frais de déplacement fédéraux, personne 2',
  ),
  E10: e(
    'Abzug für Versicherungsprämien und Zinsen von Sparkapitalien (10)',
    'Federal insurance deduction',
    'Déduction d’assurance fédérale',
  ),
  E12: e('Nettoeinkommen (12)', 'Net income, federal tax', 'Revenu net, impôt fédéral'),
  E13: e(
    'Abzug der Krankheits- und Unfallkosten (13)',
    'Medical costs, federal tax',
    'Frais de maladie et d’accident, impôt fédéral',
  ),
  E15: e('Abzug der Zuwendungen (15)', 'Donations, federal tax', 'Dons, impôt fédéral'),
  E16: e(
    'Abzug der Zuwendungen an politische Parteien (16)',
    'Political parties, federal tax',
    'Partis politiques, impôt fédéral',
  ),
  E17: e(
    'Abzug vom Erwerbseinkommen des zweitverdienenden Ehegatten (17)',
    'Both spouses earn, federal tax',
    'Double activité des époux, impôt fédéral',
  ),
  E18: e(
    'Abzug Fremdbetreuungskosten (18)',
    'Childcare by others, federal tax',
    'Frais de garde par des tiers, impôt fédéral',
  ),
  E19: e(
    'Reineinkommen (19)',
    'Net income after deductions, federal tax',
    'Revenu net après déductions, impôt fédéral',
  ),
  E20: e(
    'Abzug für minderjährige oder in der beruflichen Ausbildung stehende Kinder (20)',
    'Child deduction, federal tax',
    'Déduction pour enfants, impôt fédéral',
  ),
  E22: e(
    'Abzug für Ehegatten, die in rechtlich und tatsächlich ungetrennter Ehe leben (22)',
    'Married couples, federal tax',
    'Couples mariés, impôt fédéral',
  ),
  E23: e(
    'Steuerbares Einkommen direkte Bundessteuer (23)',
    'Taxable income, federal tax',
    'Revenu imposable, impôt fédéral',
  ),
} satisfies Record<string, Rubric>;

export type RubricCode = keyof typeof RUBRICS;
export type WealthCode = keyof typeof WEALTH_RUBRICS;
export type FederalCode = keyof typeof FEDERAL_RUBRICS;

/**
 * The lines in the order of the return (an object's numeric keys come first in JavaScript, so the
 * order is written out): income, the Wertschriftenverzeichnis's two lines where Ziffer 150 stands,
 * the deductions with form B's lines first, then wealth.
 */
export const FORM_ORDER: readonly (RubricCode | WealthCode)[] = [
  '100',
  '101',
  '104',
  '105',
  '130',
  '131',
  '132',
  '133',
  '136',
  '137',
  '140',
  '141',
  'WV4',
  'WV6',
  '160',
  '161',
  '166',
  '208t',
  '209t',
  '212',
  '213',
  '214',
  '215',
  '220',
  '221',
  '236',
  '237',
  '248',
  '249',
  '252',
  '254',
  '255',
  '260',
  '261',
  '270',
  '280',
  '282',
  '320',
  '324',
  '325',
  '326',
  '340',
  '350',
  '352',
  '353',
  '360',
  '400',
  '404',
  '410',
  '412',
  '416',
  '462',
  '472',
  '473',
  '474',
];

const set = (codes: readonly string[]) => new Set<string>(codes);
/** Total der Einkünfte (199, carried to 301). */
export const INCOME = set([
  '100',
  '101',
  '104',
  '105',
  '130',
  '131',
  '132',
  '133',
  '136',
  '137',
  '140',
  '141',
  'WV4',
  'WV6',
  '160',
  '161',
  '166',
]);
/** Total der Abzüge (299, carried to 302). */
export const DEDUCTIONS = set([
  '208t',
  '209t',
  '212',
  '213',
  '214',
  '215',
  '220',
  '221',
  '236',
  '237',
  '248',
  '249',
  '252',
  '254',
  '255',
  '260',
  '261',
  '270',
  '280',
  '282',
]);
/** Zusätzliche Abzüge, from the Nettoeinkommen (310) to the Reineinkommen (330). */
export const ADDITIONAL = set(['320', '324', '325', '326']);
/** Sozialabzüge, from the Reineinkommen (330) to the taxable income (380). */
export const SOCIAL = set(['340', '350', '352', '353', '360']);
export const ASSETS = set(['400', '404', '410', '412', '416']);
export const DEBTS = set(['462']);
export const WEALTH_FREE = set(['472', '473', '474']);

/** The person's own Ziffer of a line the form has per person: 100 for person 1, 101 for person 2. */
export const PERSON_CODES = {
  salary: ['100', '101'],
  side: ['104', '105'],
  avs: ['130', '131'],
  occupational: ['132', '133'],
  otherPension: ['136', '137'],
  replacement: ['140', '141'],
  commute: ['208t', '209t'],
  meals: ['212', '213'],
  mealsReduced: ['214', '215'],
  otherCosts: ['220', '221'],
  sideCosts: ['236', '237'],
  training: ['248', '249'],
  pillar3a: ['260', '261'],
  buyIn: ['280', '282'],
} as const satisfies Record<string, readonly [RubricCode, RubricCode]>;

export function rubric(code: string): Rubric | undefined {
  return (
    (RUBRICS as Record<string, Rubric>)[code] ?? (WEALTH_RUBRICS as Record<string, Rubric>)[code]
  );
}

/** A line of the return, or of the Ergänzungsblatt (E1 to E23), with its label and source. */
export function anyRubric(code: string): Rubric | undefined {
  return rubric(code) ?? (FEDERAL_RUBRICS as Record<string, Rubric>)[code];
}
