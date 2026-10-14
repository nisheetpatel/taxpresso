// Fribourg's figures for its reference page, read from packages/rules-fr (see ./shared.ts). Terms
// as the package prints them (rules-fr rubrics.ts and explain.ts, from the Fribourg return) and as
// the law on the yearly coefficient is titled (fr-2026-law-coefficient-annuel). The sources library
// has no communal coefficients for 2026 yet: the table shows 2025's, and the 2026 parishes.

import { COMMUNES_2025 } from '../../../packages/rules-fr/src/2025/communes.ts';
import { COEFFICIENTS_2025 } from '../../../packages/rules-fr/src/2025/tariffs.ts';
import { AMOUNTS_2026 as A } from '../../../packages/rules-fr/src/2026/amounts.ts';
import { COMMUNES_2026 } from '../../../packages/rules-fr/src/2026/communes.ts';
import { COEFFICIENTS_2026 } from '../../../packages/rules-fr/src/2026/tariffs.ts';
import type { Cited } from '../../../packages/rules-ch/src/core/cited.ts';
import type { FrCommune } from '../../../packages/rules-fr/src/communes.ts';
import { cite } from '../geneva-data.ts';
import {
  type CantonFigures,
  type CantonRate,
  chf,
  communeTable,
  couple,
  debtInterest,
  deduction,
  distinct,
  donations,
  limit,
  meals,
  medical,
  one,
  pct,
  pillar3a,
  PREVIOUS_YEAR,
  shareMinMax,
  TAX_YEAR,
} from './shared.ts';

const rate = (year: number) => ({
  label: { term: 'coefficient d’impôt communal' },
  year,
  cell: (c: FrCommune) => distinct([c.rate], pct),
});

/** The yearly coefficient: one on income, one on wealth. */
const coefficients = (year: number, c: Cited<{ income: number; wealth: number }>): CantonRate => ({
  year,
  text: 'incomeWealth',
  figures: { income: pct(c.value.income), wealth: pct(c.value.wealth) },
  sources: cite(c.source),
});

export const figures: CantonFigures = {
  code: 'FR',
  lang: 'fr',
  how: 'percent',
  term: 'coefficient d’impôt communal',
  base: 'impôt cantonal de base',
  tax: 'impôt cantonal et communal',
  canton: {
    term: 'coefficient annuel',
    rates: [
      coefficients(TAX_YEAR, COEFFICIENTS_2026),
      coefficients(PREVIOUS_YEAR, COEFFICIENTS_2025),
    ],
  },
  wide: [],
  communes: communeTable<FrCommune>({
    lang: 'fr',
    years: [
      { year: TAX_YEAR, table: COMMUNES_2026 },
      { year: PREVIOUS_YEAR, table: COMMUNES_2025 },
    ],
    key: (c) => String(c.bfs),
    name: (c) => c.name,
    columns: [
      rate(TAX_YEAR),
      rate(PREVIOUS_YEAR),
      {
        label: { church: 'catholicOnIncome' },
        year: TAX_YEAR,
        cell: (c) =>
          distinct(
            c.catholic.map((p) => p.income),
            pct,
          ),
      },
      {
        label: { church: 'reformedOnIncome' },
        year: TAX_YEAR,
        cell: (c) =>
          distinct(
            c.reformed.map((p) => p.income),
            pct,
          ),
      },
    ],
  }),
  deductions: [
    deduction('professional', 'Autres frais professionnels', [shareMinMax(A.professionalFlat)]),
    deduction('commute', 'Frais de transport', [one('perYear', A.travelMax)]),
    deduction('meals', 'Repas ou séjour hors du domicile', [meals(A.meals)]),
    deduction('pillar3a', 'Formes reconnues de prévoyance individuelle liée (3e pilier a)', [
      pillar3a(A.pillar3a),
    ]),
    deduction(
      'insurance',
      'Caisse-maladie et accidents, autres primes et cotisations, intérêts de capitaux d’épargne',
      [
        limit(
          'health',
          {
            adult: chf(A.health.value.adult),
            young: chf(A.health.value.young),
            child: chf(A.health.value.child),
          },
          A.health.source,
        ),
        couple('life', A.lifeInsurance),
        couple('savingsCouple', A.savingsInterest),
      ],
    ),
    deduction('debtInterest', 'Intérêts passifs privés', [debtInterest(A.debtInterestExtra)]),
    deduction('childcare', 'Frais de garde des enfants', [one('perChildMax', A.childcare)]),
    deduction('training', 'Frais de formation et de perfectionnement', [one('atMost', A.training)]),
    deduction('twoEarner', 'Déduction pour activité lucrative des deux conjoints', [
      one('twoEarnerMax', A.twoEarner),
    ]),
    deduction('party', 'Versements aux partis politiques', [one('atMost', A.party)]),
    deduction('donations', 'Versements bénévoles', [donations(A.donations)]),
    deduction('medical', 'Frais médicaux', [medical(A.medicalThresholdBp)]),
    deduction('child', 'Déductions sociales pour enfants', [
      limit(
        'childThird',
        { first: chf(A.children.value.first), fromThird: chf(A.children.value.fromThird) },
        A.children.source,
      ),
    ]),
  ],
};
