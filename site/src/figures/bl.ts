// Basel-Landschaft's figures for its reference page, read from packages/rules-bl (see
// ./shared.ts). Terms as the package prints them (rules-bl rubrics.ts and terms.ts, from the
// Basel-Landschaft return). The church rates are the 2026 table's only: the 2025 one has none.

import { COMMUNES_2025 } from '../../../packages/rules-bl/src/2025/communes.ts';
import { MULTIPLIER_2025 } from '../../../packages/rules-bl/src/2025/tariffs.ts';
import { AMOUNTS_2026 as A } from '../../../packages/rules-bl/src/2026/amounts.ts';
import { COMMUNES_2026 } from '../../../packages/rules-bl/src/2026/communes.ts';
import { MULTIPLIER_2026 } from '../../../packages/rules-bl/src/2026/tariffs.ts';
import type { BlCommune } from '../../../packages/rules-bl/src/communes.ts';
import {
  type CantonFigures,
  cantonRate,
  chf,
  communeTable,
  debtInterest,
  deduction,
  family,
  fold,
  limit,
  meals,
  one,
  pct,
  pillar3a,
  PREVIOUS_YEAR,
  TAX_YEAR,
} from './shared.ts';

const rate = (year: number) => ({
  label: { term: 'Steuerfuss' },
  year,
  cell: (c: BlCommune) => [pct(c.rate)],
});

export const figures: CantonFigures = {
  code: 'BL',
  lang: 'de',
  how: 'percent',
  term: 'Steuerfuss',
  base: 'normale Staatssteuer',
  tax: 'Staats- und Gemeindesteuer',
  canton: {
    term: 'Steuerfuss',
    rates: [
      cantonRate(TAX_YEAR, MULTIPLIER_2026, pct),
      cantonRate(PREVIOUS_YEAR, MULTIPLIER_2025, pct),
    ],
  },
  wide: [],
  communes: communeTable<BlCommune>({
    lang: 'de',
    years: [
      { year: TAX_YEAR, table: COMMUNES_2026 },
      { year: PREVIOUS_YEAR, table: COMMUNES_2025 },
    ],
    key: (c) => fold(c.name),
    name: (c) => c.name,
    columns: [
      rate(TAX_YEAR),
      rate(PREVIOUS_YEAR),
      {
        label: { church: 'catholic' },
        year: TAX_YEAR,
        cell: (c) => (c.church ? [pct(c.church.catholic)] : []),
      },
      {
        label: { church: 'reformedOfIncome' },
        year: TAX_YEAR,
        cell: (c) => (c.church ? [pct(c.church.reformed.income)] : []),
      },
      {
        label: { church: 'christCatholicOfIncome' },
        year: TAX_YEAR,
        cell: (c) => (c.church ? [pct(c.church.christCatholic.income)] : []),
      },
    ],
  }),
  deductions: [
    deduction('professional', 'Übrige berufsnotwendige Kosten', [
      one('flat', A.otherFlat, 'amount'),
    ]),
    deduction('commute', 'Fahrtkosten zwischen Wohn- und Arbeitsstätte', [
      limit('perYear', { max: chf(A.travel.value.max) }, A.travel.source),
    ]),
    deduction('meals', 'Mehrkosten für auswärtige Verpflegung', [meals(A.meals)]),
    deduction('pillar3a', 'Beiträge 3. Säule', [pillar3a(A.pillar3a)]),
    deduction('insurance', 'Versicherungsprämien und Zinsen von Sparkapitalien', [
      family(A.insurance),
    ]),
    deduction('debtInterest', 'Private übrige Schuldzinsen', [debtInterest(A.debtInterestExtra)]),
    deduction('childcare', 'Kinderbetreuung durch Dritte', [one('perChildMax', A.childcare)]),
    deduction('training', 'Aus- und Weiterbildungskosten', [one('perPersonMax', A.training)]),
    deduction('twoEarner', 'Abzug bei Erwerbstätigkeit beider Personen', [
      one('twoEarnerMax', A.twoEarner),
    ]),
    deduction('party', 'Zuwendungen an politische Parteien', [one('atMost', A.party)]),
    deduction('childTaxReduction', 'Kinderabzug vom Steuerbetrag', [
      one('taxReduction', A.childReduction, 'amount'),
    ]),
  ],
};
