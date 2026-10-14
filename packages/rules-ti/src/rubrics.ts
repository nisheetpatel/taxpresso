// The lines (cifre) of the Ticino return the engine reads or computes, with the official Italian
// term and its gloss. The numbers are those of the main return, Modulo 1 (page 2 income, page 3
// deductions and the computation of the taxable income, page 4 wealth). No Italian PDF of Modulo 1
// is published: the canton's German translation (ti-2025-form-modulo-1-de) gives the lines and their
// numbers, the 2025 instructions (ti-2025-guide-istruzioni-pf-pdf) the Italian terms, line by line.
// Some lines have a row for each spouse under one number (1.1, 3.1 to 3.5); others have a number
// for each (9.1 and 9.2, 11.1 and 11.2, 15.3 and 15.4). The 2026 return is not published yet
// (docs/sources/ti/NOTES.md, Gaps): its amounts go on the 2025 lines.
import type { Text } from '@taxpresso/rules-ch';

const FORM = 'ti-2025-form-modulo-1-de';
const GUIDE = 'ti-2025-guide-istruzioni-pf-pdf';

export interface Rubric {
  label: Text;
  source: string;
}

const r = (it: string, en: string, fr: string, page: 2 | 3 | 4, guide: number): Rubric => ({
  label: { en: `${en} (${it})`, fr: `${fr} (${it})` },
  source: `${FORM} p. ${page} (form page ${page}); ${GUIDE} p. ${guide}`,
});

export const RUBRICS = {
  // Income (redditi), form page 2.
  '1.1': r(
    'attività dipendente principale, salario netto',
    'Main employment, net salary',
    'Activité salariée principale, salaire net',
    2,
    13,
  ),
  '1.2': r(
    'attività dipendente accessoria',
    'Side job, net salary',
    'Activité salariée accessoire, salaire net',
    2,
    13,
  ),
  '3.1': r(
    'pensioni della previdenza professionale e individuale vincolata',
    'Pension fund and pillar 3a pensions',
    'Rentes de la prévoyance professionnelle et du pilier 3a',
    2,
    16,
  ),
  '3.2': r('rendite AVS e AI', 'AVS and AI pensions', 'Rentes AVS et AI', 2, 16),
  '3.3': r(
    'rendite vitalizie e altre rendite',
    'Life annuities and other pensions',
    'Rentes viagères et autres rentes',
    2,
    16,
  ),
  '3.4': r(
    'indennità per perdita di guadagno',
    'Unemployment and other loss-of-earnings allowances',
    'Indemnités de chômage et autres pertes de gain',
    2,
    16,
  ),
  '3.5': r(
    'indennità giornaliere dell’assicurazione malattia e infortuni',
    'Sickness and accident daily allowances',
    'Indemnités journalières maladie et accident',
    2,
    16,
  ),
  '3.6': r('alimenti', 'Alimony and child support received', 'Pensions alimentaires reçues', 2, 16),
  '4.1': r(
    'redditi da titoli e capitali',
    'Income from accounts and securities',
    'Rendement des avoirs et titres',
    2,
    17,
  ),
  '6.3': r('ogni altro reddito imponibile', 'Other taxable income', 'Autres revenus', 2, 21),
  // Deductions (deduzioni), form page 3.
  '9.1': r(
    'spese professionali dei dipendenti, contribuente',
    'Professional costs, taxpayer',
    'Frais professionnels, contribuable',
    3,
    23,
  ),
  '9.2': r(
    'spese professionali dei dipendenti, coniuge',
    'Professional costs, spouse',
    'Frais professionnels, conjoint',
    3,
    23,
  ),
  '10.3': r(
    'previdenza professionale, riscatti di anni di assicurazione',
    'Pension fund buy-ins and pillar 3a catch-up',
    'Rachats de prévoyance et rachat 3a',
    3,
    25,
  ),
  '11.1': r(
    'previdenza individuale vincolata, contribuente',
    'Pillar 3a, taxpayer',
    'Pilier 3a, contribuable',
    3,
    25,
  ),
  '11.2': r(
    'previdenza individuale vincolata, coniuge',
    'Pillar 3a, spouse',
    'Pilier 3a, conjoint',
    3,
    25,
  ),
  '12': r(
    'oneri assicurativi e interessi di capitali a risparmio',
    'Insurance premiums and savings interest',
    'Primes d’assurance et intérêts d’épargne',
    3,
    26,
  ),
  '13.1': r(
    'spese di amministrazione dei titoli',
    'Costs of keeping securities',
    'Frais de gestion des titres',
    3,
    26,
  ),
  '13.2': r(
    'interessi passivi privati',
    'Private debt interest',
    'Intérêts des dettes privées',
    3,
    27,
  ),
  '14.1': r(
    'alimenti versati al coniuge divorziato o separato',
    'Alimony paid',
    'Pension alimentaire versée',
    3,
    28,
  ),
  '14.2': r(
    'alimenti per i figli minorenni',
    'Child support paid',
    'Contributions d’entretien versées pour les enfants',
    3,
    28,
  ),
  '15.2': r(
    'versamenti a partiti politici',
    'Payments to political parties',
    'Versements aux partis politiques',
    3,
    29,
  ),
  '15.3': r(
    'spese di formazione e formazione continua professionali, contribuente',
    'Professional training, taxpayer',
    'Formation continue, contribuable',
    3,
    29,
  ),
  '15.4': r(
    'spese di formazione e formazione continua professionali, coniuge',
    'Professional training, spouse',
    'Formation continue, conjoint',
    3,
    29,
  ),
  '15.5': r(
    'deduzione per attività lucrativa di entrambi i coniugi',
    'Both spouses work',
    'Activité des deux conjoints',
    3,
    29,
  ),
  '20': r(
    'deduzione cure prestate da terzi a figli di età inferiore ai 14 anni',
    'Childcare',
    'Frais de garde des enfants',
    3,
    29,
  ),
  '22.1': r(
    'spese per malattia e infortunio',
    'Illness and accident costs',
    'Frais de maladie et d’accident',
    3,
    30,
  ),
  '24': r('liberalità a enti di pubblica utilità', 'Donations', 'Dons', 3, 30),
  '25.1': r(
    'deduzione per ogni figlio a carico',
    'Child deduction',
    'Déduction pour enfant',
    3,
    30,
  ),
  '27': r(
    'quota esente per beneficiari AVS-AI',
    'Exemption for AVS and AI pensioners',
    'Montant exonéré des bénéficiaires AVS et AI',
    3,
    32,
  ),
} as const satisfies Record<string, Rubric>;

/** Wealth (sostanza) lines, form page 4: assets, debts and social deductions on 31 December. */
export const WEALTH_RUBRICS = {
  '29.1': r('titoli e crediti', 'Accounts and securities', 'Avoirs et titres', 4, 33),
  '29.2': r(
    'denaro contante, oro e altri metalli preziosi',
    'Cash, gold and other precious metals',
    'Numéraire, or et autres métaux précieux',
    4,
    34,
  ),
  '29.3': r(
    'assicurazioni sulla vita e di rendita vitalizia, valore di riscatto',
    'Life insurance, surrender value',
    'Assurances sur la vie, valeur de rachat',
    4,
    34,
  ),
  '29.4': r('veicoli a motore', 'Motor vehicles', 'Véhicules à moteur', 4, 34),
  '29.5': r(
    'altri elementi della sostanza mobiliare',
    'Other movable assets',
    'Autres éléments de fortune mobilière',
    4,
    34,
  ),
  '33.1': r('debiti privati', 'Private debts', 'Dettes privées', 4, 36),
  '35.1': r(
    'deduzione sociale per i coniugi',
    'Social deduction for spouses',
    'Déduction sociale des époux',
    4,
    36,
  ),
  '35.2': r(
    'deduzione sociale per ogni figlio minorenne',
    'Social deduction per minor child',
    'Déduction sociale par enfant mineur',
    4,
    36,
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

/** The person's own number of a line printed once per person. */
export const PERSON_CODES = {
  professional: { p1: '9.1', p2: '9.2' },
  pillar3a: { p1: '11.1', p2: '11.2' },
  training: { p1: '15.3', p2: '15.4' },
} as const satisfies Record<string, { p1: RubricCode; p2: RubricCode }>;

/** Income lines (1 to 7): their total is 8. */
export const INCOME = new Set<string>([
  '1.1',
  '1.2',
  '3.1',
  '3.2',
  '3.3',
  '3.4',
  '3.5',
  '3.6',
  '4.1',
  '6.3',
]);
/** Deductions 9 to 15.5: their total is 16, and 19 = 8 - 16. */
export const DEDUCTIONS = new Set<string>([
  '9.1',
  '9.2',
  '10.3',
  '11.1',
  '11.2',
  '12',
  '13.1',
  '13.2',
  '14.1',
  '14.2',
  '15.2',
  '15.3',
  '15.4',
  '15.5',
]);
/** 20: from 19 to the net income II (21). */
export const CHILDCARE = new Set<string>(['20']);
/** 22.1: from 21 to the net income III (23). */
export const MEDICAL = new Set<string>(['22.1']);
/** 24 and the social deductions 25: from 23 to the net income IV (26). */
export const SOCIAL = new Set<string>(['24', '25.1']);
/** 27: from 26 to the taxable income (28). */
export const EXEMPTION = new Set<string>(['27']);
/** Wealth: assets (32), debts (34), social deductions (36). */
export const ASSETS = new Set<string>(['29.1', '29.2', '29.3', '29.4', '29.5']);
export const DEBTS = new Set<string>(['33.1']);
export const WEALTH_SOCIAL = new Set<string>(['35.1', '35.2']);
