// The lines of the Zurich return the engine computes, by the code printed next to each field, with
// the official German term and its gloss. Codes and terms as printed on the 2025 form (StA Form.
// 300 (2025) 12.25, zh-2025-form-steuererklaerung-hauptformular): p. 2 income, p. 3 deductions,
// p. 4 wealth. The full-year 2026 form is not published yet (docs/sources/zh/NOTES.md, Gaps);
// the 2026 forms published so far carry the same codes (zh-2026-guide-unterjaehrig p. 37).
import { roundFranc } from '@taxpresso/rules-ch';
import type { EnginePerson, Text } from './types.js';

const FORM = 'zh-2025-form-steuererklaerung-hauptformular';

export interface Rubric {
  label: Text;
  source: string;
}

/** The German term as printed, with the person where the line is a person's ("Person 1"). */
const german = (de: string, en: string) => {
  const who = /, person ([12])$/.exec(en);
  return who ? `${de}, Person ${who[1]}` : de;
};

const r = (de: string, en: string, fr: string, page: number): Rubric => ({
  label: { en: `${en} (${de})`, fr: `${fr} (${de})`, de: german(de, en) },
  source: `${FORM} p. ${page}`,
});

export const RUBRICS = {
  // Income, p. 2.
  '100': r('Haupterwerb', 'Main employment, person 1', 'Activité principale, personne 1', 2),
  '101': r('Haupterwerb', 'Main employment, person 2', 'Activité principale, personne 2', 2),
  '102': r('Nebenerwerb', 'Side job, person 1', 'Activité accessoire, personne 1', 2),
  '103': r('Nebenerwerb', 'Side job, person 2', 'Activité accessoire, personne 2', 2),
  '130': r('AHV-/IV-Renten', 'AHV/IV pensions, person 1', 'Rentes AVS/AI, personne 1', 2),
  '131': r('AHV-/IV-Renten', 'AHV/IV pensions, person 2', 'Rentes AVS/AI, personne 2', 2),
  '134': r('Renten/Pensionen', 'Pension, person 1', 'Rente, personne 1', 2),
  '135': r('Renten/Pensionen', 'Other pension, person 1', 'Autre rente, personne 1', 2),
  '136': r('Renten/Pensionen', 'Pension, person 2', 'Rente, personne 2', 2),
  '137': r('Renten/Pensionen', 'Other pension, person 2', 'Autre rente, personne 2', 2),
  '140': r(
    'Erwerbsausfallentschädigungen aus Arbeitslosenversicherung',
    'Unemployment benefits, person 1',
    'Indemnités de chômage, personne 1',
    2,
  ),
  '141': r(
    'Erwerbsausfallentschädigungen aus Arbeitslosenversicherung',
    'Unemployment benefits, person 2',
    'Indemnités de chômage, personne 2',
    2,
  ),
  '142': r('Taggelder', 'Daily allowances, person 1', 'Indemnités journalières, personne 1', 2),
  '143': r('Taggelder', 'Daily allowances, person 2', 'Indemnités journalières, personne 2', 2),
  '150': r(
    'Ertrag aus Wertschriften, Guthaben und Lotterien',
    'Income from securities and accounts',
    'Rendement des titres et avoirs',
    2,
  ),
  '160': r(
    'Unterhaltsbeiträge vom geschiedenen/getrennten Ehegatten',
    'Alimony received',
    'Pension alimentaire reçue',
    2,
  ),
  '161': r(
    'Unterhaltsbeiträge für minderjährige Kinder',
    'Child support received',
    'Contributions d’entretien reçues pour les enfants',
    2,
  ),
  '163': r('Weitere Einkünfte', 'Other income', 'Autres revenus', 2),
  '188': r(
    'Nettoertrag aus Liegenschaften',
    'Net income from property',
    'Rendement net immobilier',
    2,
  ),
  // Deductions, p. 3.
  '220': r('Berufsauslagen', 'Professional costs, person 1', 'Frais professionnels, personne 1', 3),
  '240': r('Berufsauslagen', 'Professional costs, person 2', 'Frais professionnels, personne 2', 3),
  '250': r('Schuldzinsen', 'Private debt interest', 'Intérêts des dettes privées', 3),
  '254': r(
    'Unterhaltsbeiträge an den geschiedenen oder getrennt lebenden Ehegatten',
    'Alimony paid',
    'Pension alimentaire versée',
    3,
  ),
  '255': r(
    'Unterhaltsbeiträge für minderjährige Kinder',
    'Child support paid',
    'Contributions d’entretien versées pour les enfants',
    3,
  ),
  '260': r('Beiträge an die 3. Säule a', 'Pillar 3a, person 1', 'Pilier 3a, personne 1', 3),
  '261': r('Beiträge an die 3. Säule a', 'Pillar 3a, person 2', 'Pilier 3a, personne 2', 3),
  '270': r(
    'Versicherungsprämien, Zinsen von Sparkapitalien',
    'Insurance premiums and savings interest',
    'Primes d’assurance et intérêts de l’épargne',
    3,
  ),
  '280': r(
    'Beiträge an die AHV, IV und 2. Säule',
    'Pension fund buy-ins and contributions paid directly',
    'Rachats et cotisations de prévoyance payés directement',
    3,
  ),
  '283': r(
    'Kosten für die Verwaltung des beweglichen Privatvermögens',
    'Costs of managing securities',
    'Frais de gestion des titres',
    3,
  ),
  '284': r(
    'Weitere Abzüge (Beiträge an politische Parteien)',
    'Payments to political parties',
    'Versements aux partis politiques',
    3,
  ),
  '292': r(
    'Berufsorientierte Aus- und Weiterbildungskosten',
    'Professional training',
    'Formation professionnelle',
    3,
  ),
  '376': r('Abzug für fremdbetreute Kinder', 'Childcare', 'Frais de garde des enfants', 3),
  '290': r(
    'Sonderabzug bei Erwerbstätigkeit beider Ehegatten',
    'Both spouses earn',
    'Les deux conjoints travaillent',
    3,
  ),
  '320': r('Krankheits- und Unfallkosten', 'Medical costs', 'Frais médicaux', 3),
  '324': r('Gemeinnützige Zuwendungen', 'Donations', 'Dons', 3),
  '370': r(
    'Abzug für Kinder in Ihrem Haushalt',
    'Child deduction, children living with you',
    'Déduction pour enfants vivant avec vous',
    3,
  ),
  '372': r(
    'Abzug für Kinder ausserhalb Ihres Haushaltes',
    'Child deduction, children living elsewhere',
    'Déduction pour enfants vivant ailleurs',
    3,
  ),
  // The Bundessteuer column only (Ziffer 24.3).
  '365': r(
    'Abzug für Ehegatten / Partn.',
    'Married couple deduction, federal tax',
    'Déduction pour couple marié, impôt fédéral',
    3,
  ),
  // Wealth, p. 4.
  '400': r('Wertschriften und Guthaben', 'Securities and accounts', 'Titres et avoirs', 4),
  '404': r(
    'Bargeld, Gold und andere Edelmetalle',
    'Cash, gold and precious metals',
    'Espèces, or et métaux précieux',
    4,
  ),
  '406': r(
    'Lebens- und Rentenversicherungen',
    'Life and annuity insurance',
    'Assurances vie et rentes',
    4,
  ),
  '412': r('Motorfahrzeuge', 'Vehicles', 'Véhicules', 4),
  '416': r('Übrige Vermögenswerte', 'Other assets', 'Autres éléments de fortune', 4),
  '421': r('Liegenschaften', 'Property', 'Immeubles', 4),
  '470': r('Schulden', 'Debts', 'Dettes', 4),
} as const satisfies Record<string, Rubric>;

export type RubricCode = keyof typeof RUBRICS;

/**
 * The lines in the order the return prints them (p. 2 income, p. 3 deductions, p. 4 wealth). The
 * codes are numbers, which an object's keys would sort numerically: the form's order is not that.
 */
export const FORM_ORDER: readonly RubricCode[] = [
  '100',
  '101',
  '102',
  '103',
  '130',
  '131',
  '134',
  '135',
  '136',
  '137',
  '140',
  '141',
  '142',
  '143',
  '150',
  '160',
  '161',
  '163',
  '188',
  '220',
  '240',
  '250',
  '254',
  '255',
  '260',
  '261',
  '270',
  '280',
  '292',
  '283',
  '284',
  '376',
  '290',
  '320',
  '324',
  '370',
  '372',
  '365',
  '400',
  '404',
  '406',
  '412',
  '416',
  '421',
  '470',
];

/** For sorting items in the form's order. */
export const formPlace = (code: string) => FORM_ORDER.indexOf(code as RubricCode);

export function rubric(code: string): Rubric | undefined {
  return (RUBRICS as Record<string, Rubric>)[code];
}

/** Lines whose code depends on the person: [person 1, person 2]. */
const BY_PERSON = {
  salary: ['100', '101'],
  side: ['102', '103'],
  avs: ['130', '131'],
  pension: ['134', '136'],
  pensionOther: ['135', '137'],
  unemployment: ['140', '141'],
  allowances: ['142', '143'],
  professional: ['220', '240'],
  pillar3a: ['260', '261'],
} as const satisfies Record<string, readonly [RubricCode, RubricCode]>;

export function personCode(what: keyof typeof BY_PERSON, person: EnginePerson): RubricCode {
  return BY_PERSON[what][person === 'p1' ? 0 : 1];
}

/** Total der Einkünfte (199): the income lines. */
export const INCOME = new Set<string>([
  '100',
  '101',
  '102',
  '103',
  '130',
  '131',
  '134',
  '135',
  '136',
  '137',
  '140',
  '141',
  '142',
  '143',
  '150',
  '160',
  '161',
  '163',
  '188',
]);
/** Total der Abzüge (299): the deductions before the Nettoeinkommen (310). */
export const DEDUCTIONS = new Set<string>([
  '220',
  '240',
  '250',
  '254',
  '255',
  '260',
  '261',
  '270',
  '280',
  '283',
  '284',
  '292',
  '376',
  '290',
]);
/** Zusätzliche Abzüge (22.1, 22.2): from the Nettoeinkommen to the Reineinkommen (350). */
export const EXTRA = new Set<string>(['320', '324']);
/** Sozialabzüge (24): from the Reineinkommen to the steuerbares Einkommen (390); 365 federal only. */
export const SOCIAL = new Set<string>(['370', '372', '365']);
/** Vermögenswerte (460) and Schulden (470). */
export const ASSETS = new Set<string>(['400', '404', '406', '412', '416', '421']);
export const DEBTS = new Set<string>(['470']);

// ---- The annex forms whose lines make up an item ----------------------------------------------

/**
 * The Berufsauslagen form (StA Form. 360), person 1 and person 2: zh-2025-form-berufsauslagen
 * p. 1 and 2. The 2026 form (zh-2026-deductions-form-berufsauslagen) has the same lines.
 */
const BERUFSAUSLAGEN = {
  transit: ['201', '221'],
  bike: ['202', '222'],
  car: ['204', '224'],
  travel: ['205', '225'],
  mealsReduced: ['206', '226'],
  meals: ['208', '228'],
  flat: ['212', '232'],
  actual: ['213', '233'],
  sideFlat: ['216', '236'],
} as const;

export type BerufsauslagenLine = keyof typeof BERUFSAUSLAGEN;

export function annexCode(what: BerufsauslagenLine, person: EnginePerson): string {
  return BERUFSAUSLAGEN[what][person === 'p1' ? 0 : 1];
}

/** The line of the Berufsauslagen form a person's travel goes on (1.1, 1.2 or 1.3). */
export function travelLine(p: {
  commuteCost?: unknown;
  commuteMode?: { by: string };
}): 'transit' | 'bike' | 'car' | undefined {
  if (p.commuteCost) return 'transit';
  const by = p.commuteMode?.by;
  if (by === 'bike') return 'bike';
  if (by === 'car' || by === 'motorbike') return 'car';
  return undefined;
}

/**
 * The Versicherungsprämien form (StA Form. 365): zh-2025-deductions-form-versicherungspraemien
 * p. 1. Part A (601 to 606) is the same for both taxes; part B's total (616) is each tax's limit.
 */
/** A code of the Versicherungsprämien form. */
export type ItemPartCode = (typeof VERSICHERUNG)[keyof typeof VERSICHERUNG];

export const VERSICHERUNG = {
  health: '601',
  accident: '602',
  life: '603',
  savings: '604',
  subtotal: '607',
  subsidy: '605',
  paid: '606',
  max: '616',
} as const;

/** Part A and the limit of the Versicherungsprämien form, in whole francs. */
export function insuranceParts(
  hh: {
    healthPremiums?: { value: number };
    accidentPremiums?: { value: number };
    lifeInsurancePremiums?: { value: number };
    savingsInterest?: { value: number };
    healthSubsidy?: { value: number };
  },
  paid: number,
  cap: number,
): { code: string; amount: number }[] {
  const franc = (a?: { value: number }) => roundFranc(a?.value ?? 0);
  const lines = [
    { code: VERSICHERUNG.health, amount: franc(hh.healthPremiums) },
    { code: VERSICHERUNG.accident, amount: franc(hh.accidentPremiums) },
    { code: VERSICHERUNG.life, amount: franc(hh.lifeInsurancePremiums) },
    { code: VERSICHERUNG.savings, amount: franc(hh.savingsInterest) },
  ];
  const subsidy = franc(hh.healthSubsidy);
  return [
    ...lines.filter((l) => l.amount > 0),
    { code: VERSICHERUNG.subtotal, amount: lines.reduce((s, l) => s + l.amount, 0) },
    ...(subsidy > 0 ? [{ code: VERSICHERUNG.subsidy, amount: subsidy }] : []),
    { code: VERSICHERUNG.paid, amount: paid },
    { code: VERSICHERUNG.max, amount: cap },
  ];
}
