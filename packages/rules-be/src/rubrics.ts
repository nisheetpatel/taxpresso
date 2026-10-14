// The lines of the Bern return the engine computes, with the official German term and its gloss.
// The paper form numbers sections, not lines (be-2025-steuererklaerung-formulare-de, the 2025
// specimen filled in for a sample taxpayer: forms DT0001 to DT0006, p. 1 to 6), so a code is:
// - the section's number as printed ("6.1", "4.2"), when the section has one amount;
// - the section's number and a suffix in its order on the form ("2.21-haupt", "2.21-neben"), when
//   the section has several;
// - a keyword, for the deductions the form has no line for and the tax administration computes
//   ("Vom System automatisch berücksichtigte Abzüge": the Allgemeiner Abzug, the two-earner
//   deduction...), listed as TaxMe's summary lists them (p. 9 of the specimen).
// The 2026 form is not published yet (docs/sources/be/NOTES.md, Gaps).
import type { Text } from '@taxpresso/rules-ch';

const FORM = 'be-2025-steuererklaerung-formulare-de';

export interface Rubric {
  label: Text;
  source: string;
}

const r = (de: string, en: string, fr: string, page: number, more = ''): Rubric => ({
  label: { en: `${en} (${de})`, fr: `${fr} (${de})`, de },
  source: `${FORM} p. ${page}${more}`,
});
const AUTO = 'be-na-deductions-abzuege-freigrenzen sheet 2022-2027 (rows 26 to 44)';

export const RUBRICS = {
  // Income (Einkünfte), form 2 and form 3.
  '2.21-haupt': r(
    'Einkünfte aus unselbstständiger Haupterwerbstätigkeit',
    'Main employment, net salary',
    'Activité principale, salaire net',
    2,
  ),
  '2.21-neben': r(
    'Einkünfte aus unselbstständiger Nebenerwerbstätigkeit',
    'Side job, net salary',
    'Activité accessoire, salaire net',
    2,
  ),
  '2.22-ahv': r('AHV- und IV-Renten', 'AHV/IV pensions', 'Rentes AVS/AI', 2),
  '2.22-bv': r(
    'Renten (Pensionen) aus beruflicher Vorsorge',
    'Pension fund pensions',
    'Rentes de la prévoyance professionnelle',
    2,
  ),
  '2.22-andere': r('Renten aus', 'Other pensions', 'Autres rentes', 2),
  '2.23-alv': r(
    'Netto-Leistungen aus Arbeitslosenversicherung',
    'Unemployment benefits',
    'Indemnités de chômage',
    2,
  ),
  '2.23-taggelder': r(
    'Netto-Erwerbsausfallentschädigungen, Taggelder',
    'Loss-of-earnings allowances and daily allowances',
    'Allocations pour perte de gain et indemnités journalières',
    2,
  ),
  '2.24': r(
    'Erhaltene Unterhaltsbeiträge/Alimente',
    'Alimony and child support received',
    'Pensions alimentaires et contributions d’entretien reçues',
    2,
  ),
  '2.25': r(
    'Weitere, steuerbare Einkünfte',
    'Other taxable income',
    'Autres revenus imposables',
    2,
  ),
  '3.0-ertrag': r(
    'Wertschriftenverzeichnis, Total Erträge',
    'Income from securities and accounts',
    'Rendement des titres et avoirs',
    3,
    ' (line 31)',
  ),
  '3.0-kosten': r(
    'Nachweisbare Kosten für Wertschriftenverwaltung',
    'Costs of keeping securities and accounts',
    'Frais de garde des titres et avoirs',
    3,
    ' (line 51)',
  ),
  // Expenses and general deductions (Aufwendungen und allgemeine Abzüge), forms 4 to 6.
  '6.1': r('Fahrkosten', 'Travel to work', 'Frais de déplacement', 6),
  '6.2': r('Auswärtige Verpflegung', 'Meals away from home', 'Repas pris à l’extérieur', 6),
  '6.4': r('Übrige Berufskosten', 'Other professional costs', 'Autres frais professionnels', 6),
  '6.5': r(
    'Berufskosten Nebenerwerb',
    'Professional costs of a side job',
    'Frais professionnels de l’activité accessoire',
    6,
  ),
  '6.6': r(
    'Berufsorientierte Aus- und Weiterbildungskosten',
    'Professional training',
    'Formation et perfectionnement professionnels',
    6,
  ),
  'saeule-3a': r('Beiträge Säule 3a', 'Pillar 3a', 'Pilier 3a', 1, ' (1.1)'),
  'einkauf-bv': r(
    'Beiträge an die berufliche Vorsorge (2. Säule)',
    'Pension fund buy-ins paid directly',
    'Rachats de prévoyance payés directement',
    1,
    ' (1.1)',
  ),
  '4.2': r(
    'Versicherungsprämien und Zinsen auf Sparkapitalien',
    'Insurance premiums and savings interest',
    'Primes d’assurance et intérêts de l’épargne',
    4,
  ),
  '4.3': r('Schuldzinsen', 'Private debt interest', 'Intérêts des dettes privées', 4),
  '4.4': r(
    'Mitgliederbeiträge und Zuwendungen an politische Parteien',
    'Payments to political parties',
    'Versements aux partis politiques',
    4,
  ),
  '5.1': r(
    'Bezahlte Unterhaltsbeiträge inkl. Anteil für minderjährige Kinder',
    'Alimony and child support paid',
    'Pensions alimentaires et contributions d’entretien versées',
    5,
  ),
  '2.1-betreuung': r(
    'Bezahlte Kinderdrittbetreuungskosten',
    'Childcare',
    'Frais de garde des enfants par des tiers',
    2,
    ' (2.1)',
  ),
  zweiverdiener: {
    label: label('Zweiverdienerabzug', 'Both spouses earn', 'Déduction pour double revenu'),
    source: AUTO,
  },
  // From the Reineinkommen to the taxable income (persönliche Abzüge, Sozialabzüge).
  '5.3': r('Vergabungen', 'Donations', 'Dons', 5),
  '5.4': r('Krankheits- und Unfallkosten', 'Medical costs', 'Frais de maladie et d’accident', 5),
  allgemein: {
    label: label('Allgemeiner Abzug', 'General deduction', 'Déduction générale'),
    source: `${FORM} p. 9; ${AUTO}`,
  },
  alleinstehend: {
    label: label(
      'Abzug für Alleinstehende mit eigenem Haushalt',
      'Living alone in your own household',
      'Personne seule avec son propre ménage',
    ),
    source: `${FORM} p. 1 (1.2); ${AUTO}`,
  },
  // The federal tax's deduction for married couples (TaxMe's federal summary, p. 11).
  verheiratet: {
    label: label(
      'Abzug für Verheiratete',
      'Married couple deduction',
      'Déduction pour couples mariés',
    ),
    source: `${FORM} p. 11`,
  },
  '2.1-kinder': r('Kinderabzug', 'Child deduction', 'Déduction pour enfants', 2, ' (2.1)'),
  '2.1-ausbildung': r(
    'Auswärtige bzw. zusätzliche Ausbildungskosten',
    'Education away from home or extra education costs',
    'Frais de formation hors du domicile ou supplémentaires',
    2,
    ' (2.1)',
  ),
  bescheiden: {
    label: label(
      'Abzug für bescheidene Einkommen',
      'Modest income deduction',
      'Déduction pour revenus modestes',
    ),
    source: AUTO,
  },
  // Wealth, forms 3 and 4.
  '3.0-vermoegen': r(
    'Wertschriftenverzeichnis, Total Vermögen',
    'Securities and accounts',
    'Titres et avoirs',
    3,
    ' (line 32)',
  ),
  '4.1': r('Weitere Vermögenswerte', 'Other assets', 'Autres éléments de fortune', 4),
  '4.2-wert': r(
    'Kapital- und Rentenversicherungen, Steuerwert',
    'Life and annuity insurance, tax value',
    'Assurances de capitaux et de rentes, valeur fiscale',
    4,
  ),
  '4.3-schulden': r('Schulden', 'Debts', 'Dettes', 4),
  'vermoegen-verheiratet': {
    label: label(
      'Abzug für Verheiratete',
      'Wealth deduction for spouses',
      'Déduction de fortune pour époux',
    ),
    source: AUTO,
  },
  'vermoegen-kinder': {
    label: label('Kinderabzug', 'Wealth deduction per child', 'Déduction de fortune par enfant'),
    source: AUTO,
  },
} as const satisfies Record<string, Rubric>;

function label(de: string, en: string, fr: string): Text {
  return { en: `${en} (${de})`, fr: `${fr} (${de})`, de };
}

export type RubricCode = keyof typeof RUBRICS;

export function rubric(code: string): Rubric | undefined {
  return (RUBRICS as Record<string, Rubric>)[code];
}

/** Total Einkünfte: the income lines (the securities' costs are netted there, as TaxMe does). */
export const INCOME = new Set<string>([
  '2.21-haupt',
  '2.21-neben',
  '2.22-ahv',
  '2.22-bv',
  '2.22-andere',
  '2.23-alv',
  '2.23-taggelder',
  '2.24',
  '2.25',
  '3.0-ertrag',
  '3.0-kosten',
]);
/** Total Aufwendungen und allgemeine Abzüge (Art. 31 to 38): from the Einkünfte to the Reineinkommen. */
export const DEDUCTIONS = new Set<string>([
  '6.1',
  '6.2',
  '6.4',
  '6.5',
  '6.6',
  'saeule-3a',
  'einkauf-bv',
  '4.2',
  '4.3',
  '4.4',
  '5.1',
  '2.1-betreuung',
  'zweiverdiener',
]);
/** Persönliche Abzüge / Sozialabzüge (Art. 38a, Art. 40): from the Reineinkommen to the taxable income. */
export const PERSONAL = new Set<string>([
  'verheiratet',
  '5.3',
  '5.4',
  'allgemein',
  'alleinstehend',
  '2.1-kinder',
  '2.1-ausbildung',
  'bescheiden',
]);
/** Vermögenswerte, Schulden and the Sozialabzüge on wealth (Art. 64). */
export const ASSETS = new Set<string>(['3.0-vermoegen', '4.1', '4.2-wert']);
export const DEBTS = new Set<string>(['4.3-schulden']);
export const WEALTH_SOCIAL = new Set<string>(['vermoegen-verheiratet', 'vermoegen-kinder']);
