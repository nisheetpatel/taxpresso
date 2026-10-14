// The lines of the Aargau return the engine computes, with the official German term and its gloss.
// The main form (101.01) and its auxiliary sheets are not published (paper from the Gemeindesteuer-
// amt; eTAX AARGAU online: docs/sources/ag/NOTES.md, Gaps), so a code is the number of the guide's
// section that explains the line (ag-2025-guide-wegleitung p. 1 to 3, the table of contents). The
// guide calls them the form's Ziffern, but its own cross-references don't always match its sections
// (p. 25 sends the child deduction to "Ziffer 22.1", explained in section 19.1): the filing step must
// check each code against the form itself.
// - the section as printed ("10.1", "14"), when it holds one amount;
// - the section and a suffix, when it holds several ("3-ahv", "3-bv");
// - a keyword for the steuerfreie Beträge on wealth, which the guide does not number (StG § 54).
// The summary lines (Nettoeinkommen Ziffer 20, Reineinkommen Ziffer 23, steuerbares Einkommen
// Ziffer 25, steuerbares Vermögen Ziffer 37, as the guide names them) are the result's totals, not
// items.
import type { Text } from '@taxpresso/rules-ch';

const GUIDE = 'ag-2025-guide-wegleitung';

export interface Rubric {
  label: Text;
  source: string;
}

const r = (de: string, en: string, fr: string, where: string): Rubric => ({
  label: { en: `${en} (${de})`, fr: `${fr} (${de})` },
  source: `${GUIDE} ${where}`,
});

export const RUBRICS = {
  // Einkünfte.
  '1.1': r(
    'Haupterwerb',
    'Main employment, net salary',
    'Activité principale, salaire net',
    'p. 13 (1.1)',
  ),
  '1.2': r(
    'Nebenerwerb',
    'Side job, net salary',
    'Activité accessoire, salaire net',
    'p. 13 (1.2)',
  ),
  '3-ahv': r(
    'AHV- und IV-Renten',
    'AHV/IV pensions',
    'Rentes AVS/AI',
    'p. 16 (3. Steuerbare Renten)',
  ),
  '3-bv': r(
    'Renten aus der Pensionskasse (Säule 2)',
    'Pension fund pensions',
    'Rentes de la caisse de pension',
    'p. 16 (3. Steuerbare Renten)',
  ),
  '3-andere': r(
    'Übrige Renten',
    'Other pensions, taxable part',
    'Autres rentes, part imposable',
    'p. 16 and 17 (3. Steuerbare Renten)',
  ),
  '3-alv': r(
    'Leistungen der Arbeitslosenversicherung',
    'Unemployment benefits',
    'Indemnités de chômage',
    'p. 17 (3. Erwerbsausfallentschädigungen)',
  ),
  '3-taggelder': r(
    'Taggelder und Erwerbsausfallentschädigungen',
    'Daily allowances and loss-of-earnings benefits',
    'Indemnités journalières et allocations pour perte de gain',
    'p. 17 (3. Erwerbsausfallentschädigungen)',
  ),
  '4': r(
    'Einkünfte aus Wertschriften und Kapitalanlagen',
    'Income from securities and accounts',
    'Rendement des titres et avoirs',
    'p. 17 (4.)',
  ),
  '5.1': r(
    'Unterhaltsbeiträge vom geschiedenen oder getrennt lebenden Eheteil',
    'Alimony received',
    'Pension alimentaire reçue',
    'p. 18 (5.1)',
  ),
  '5.2': r(
    'Unterhaltsbeiträge für minderjährige Kinder',
    'Child support received',
    'Contributions d’entretien reçues pour les enfants',
    'p. 19 (5.2)',
  ),
  '5.5': r('Übrige Einkünfte', 'Other taxable income', 'Autres revenus imposables', 'p. 19 (5.5)'),
  // Abzüge.
  '10.1': r(
    'Fahrtkosten zwischen Wohn- und Arbeitsstätte',
    'Travel to work',
    'Frais de déplacement',
    'p. 22 (10.1)',
  ),
  '10.2': r(
    'Mehrkosten der auswärtigen Verpflegung',
    'Meals away from home',
    'Repas pris à l’extérieur',
    'p. 22 and 23 (10.2)',
  ),
  '10.3': r(
    'Pauschalabzug (übrige Berufskosten)',
    'Other professional costs',
    'Autres frais professionnels',
    'p. 23 (10.3)',
  ),
  '10.6': r(
    'Auslagen bei Nebenerwerb',
    'Side job costs',
    'Frais de l’activité accessoire',
    'p. 24 (10.6)',
  ),
  '11': r('Schuldzinsen', 'Private debt interest', 'Intérêts des dettes privées', 'p. 25 (11.)'),
  '12.1': r(
    'Unterhaltsbeiträge an den geschiedenen oder getrennt lebenden Eheteil',
    'Alimony paid',
    'Pension alimentaire versée',
    'p. 25 (12.1)',
  ),
  '12.2': r(
    'Unterhaltsbeiträge für minderjährige Kinder',
    'Child support paid',
    'Contributions d’entretien versées pour les enfants',
    'p. 25 (12.2)',
  ),
  '13.1': r(
    'Einkäufe Säule 2',
    'Pension fund buy-ins',
    'Rachats de prévoyance professionnelle',
    'p. 25 and 26 (13.1)',
  ),
  '13.2': r('Beiträge Säule 3a', 'Pillar 3a', 'Pilier 3a', 'p. 26 (13.2)'),
  '14': r(
    'Versicherungsprämien und Zinsen von Sparkapitalien',
    'Insurance premiums and savings interest, flat',
    'Primes d’assurance et intérêts d’épargne, forfait',
    'p. 27 (14.)',
  ),
  '15.0': r('Kinderbetreuungskosten', 'Childcare', 'Frais de garde des enfants', 'p. 27 (15.0)'),
  '15.2': r(
    'Zuwendungen an steuerbefreite politische Parteien',
    'Political parties',
    'Partis politiques',
    'p. 27 and 28 (15.2)',
  ),
  '15.3': r('Freiwillige Leistungen (Spenden)', 'Donations', 'Dons', 'p. 28 (15.3)'),
  '15.4': r(
    'Vermögensverwaltungskosten',
    'Costs of managing securities',
    'Frais de gestion de fortune',
    'p. 28 and 29 (15.4)',
  ),
  '15.5': r(
    'Berufsorientierte Aus-, Weiterbildungs- und Umschulungskosten',
    'Professional training',
    'Formation professionnelle',
    'p. 29 (15.5)',
  ),
  '16': r(
    'Sonderabzug für zweitverdienenden Eheteil',
    'Both spouses earn',
    'Double revenu',
    'p. 30 (16.)',
  ),
  '17.1': r(
    'Krankheits- und Unfallkosten',
    'Medical and accident costs',
    'Frais de maladie et d’accident',
    'p. 30 (17.1)',
  ),
  '18': r(
    'Selbstbehalt Krankheits- und Unfallkosten',
    'Medical costs, own share added back',
    'Frais médicaux, part à charge réintégrée',
    'p. 31 (18.)',
  ),
  // Sozialabzüge.
  '19.1': r('Kinderabzug', 'Child deduction', 'Déduction pour enfants', 'p. 31 and 32 (19.1)'),
  '24': r(
    'Zusätzlicher Sozialabzug für tiefe Einkommen',
    'Low-income deduction',
    'Déduction supplémentaire pour revenus modestes',
    'p. 32 and 33 (24.)',
  ),
  // Vermögen.
  '20.1': r(
    'Wertschriften und Guthaben',
    'Securities and accounts',
    'Titres et avoirs',
    'p. 34 (20.1)',
  ),
  '20.2': r(
    'Bargeld, Gold und andere Edelmetalle',
    'Cash, gold and precious metals',
    'Espèces, or et métaux précieux',
    'p. 39 (20.2)',
  ),
  '20.3': r(
    'Lebens- und Rentenversicherungen',
    'Life and annuity insurance',
    'Assurances vie et de rente',
    'p. 39 (20.3)',
  ),
  '20.5': r('Private Fahrzeuge', 'Private vehicles', 'Véhicules privés', 'p. 39 (20.5)'),
  '20.6': r('Übrige Vermögenswerte', 'Other assets', 'Autres éléments de fortune', 'p. 39 (20.6)'),
  '34': r('Total der Schulden', 'Debts', 'Dettes', 'p. 41 (34.)'),
  steuerfrei: {
    label: {
      en: 'Tax-free amount (steuerfreier Betrag)',
      fr: 'Montant exonéré (steuerfreier Betrag)',
    },
    source: 'ag-na-law-steuergesetz § 54 Abs. 1 lit. a and b (p. 32)',
  },
  'steuerfrei-kinder': {
    label: {
      en: 'Tax-free amount per child (steuerfreier Betrag für Kinder)',
      fr: 'Montant exonéré par enfant (steuerfreier Betrag für Kinder)',
    },
    source: 'ag-na-law-steuergesetz § 54 Abs. 1 lit. c (p. 32)',
  },
} as const satisfies Record<string, Rubric>;

export type RubricCode = keyof typeof RUBRICS;

export function rubric(code: string): Rubric | undefined {
  return (RUBRICS as Record<string, Rubric>)[code];
}

/** Total der Einkünfte. */
export const INCOME = new Set<string>([
  '1.1',
  '1.2',
  '3-ahv',
  '3-bv',
  '3-andere',
  '3-alv',
  '3-taggelder',
  '4',
  '5.1',
  '5.2',
  '5.5',
]);
/** The deductions 10 to 18 (StG §§ 35 to 40a): from the Einkünfte to the Reineinkommen. */
export const DEDUCTIONS = new Set<string>([
  '10.1',
  '10.2',
  '10.3',
  '10.6',
  '11',
  '12.1',
  '12.2',
  '13.1',
  '13.2',
  '14',
  '15.0',
  '15.2',
  '15.3',
  '15.4',
  '15.5',
  '16',
  '17.1',
  '18',
]);
/** Sozialabzüge (§ 42 Abs. 1): from the Reineinkommen to Ziffer 23. */
export const SOCIAL = new Set<string>(['19.1']);
/** The low-income deduction (§ 42 Abs. 1bis): from Ziffer 23 to the taxable income. */
export const LOW_INCOME = new Set<string>(['24']);
/** Vermögenswerte, Schulden and the steuerfreie Beträge (§ 54). */
export const ASSETS = new Set<string>(['20.1', '20.2', '20.3', '20.5', '20.6']);
export const DEBTS = new Set<string>(['34']);
export const WEALTH_FREE = new Set<string>(['steuerfrei', 'steuerfrei-kinder']);
