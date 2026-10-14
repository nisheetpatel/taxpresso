// Ticino's figures for its reference page, read from packages/rules-ti (see ./shared.ts). Terms as
// the package prints them (rules-ti rubrics.ts, law.ts and communes.ts, from the Ticino return and
// the table of communal multipliers). Ticino's travel costs have no yearly cap in the package: that
// row is left out.

import { AMOUNTS_2025 } from '../../../packages/rules-ti/src/2025/amounts.ts';
import { COMMUNES_2025 } from '../../../packages/rules-ti/src/2025/communes.ts';
import { AMOUNTS_2026 as A } from '../../../packages/rules-ti/src/2026/amounts.ts';
import { COMMUNES_2026 } from '../../../packages/rules-ti/src/2026/communes.ts';
import type { TiCommune } from '../../../packages/rules-ti/src/communes.ts';
import {
  type CantonFigures,
  cantonRate,
  chf,
  communeTable,
  debtInterest,
  deduction,
  donations,
  family,
  fold,
  limit,
  meals,
  medical,
  one,
  pct,
  pillar3a,
  PREVIOUS_YEAR,
  TAX_YEAR,
} from './shared.ts';

const rate = (year: number) => ({
  label: { term: 'moltiplicatore d’imposta comunale' },
  year,
  cell: (c: TiCommune) => [pct(c.rate)],
});

export const figures: CantonFigures = {
  code: 'TI',
  lang: 'it',
  how: 'percent',
  term: 'moltiplicatore d’imposta comunale',
  base: 'imposta cantonale base',
  tax: 'imposta cantonale e comunale',
  canton: {
    term: 'coefficiente d’imposta cantonale',
    rates: [
      cantonRate(TAX_YEAR, A.coefficient, pct),
      cantonRate(PREVIOUS_YEAR, AMOUNTS_2025.coefficient, pct),
    ],
  },
  wide: [],
  communes: communeTable<TiCommune>({
    lang: 'it',
    years: [
      { year: TAX_YEAR, table: COMMUNES_2026 },
      { year: PREVIOUS_YEAR, table: COMMUNES_2025 },
    ],
    key: (c) => fold(c.name),
    name: (c) => c.name,
    columns: [rate(TAX_YEAR), rate(PREVIOUS_YEAR)],
  }),
  deductions: [
    deduction('professional', 'spese professionali dei dipendenti', [
      limit('flat', { amount: chf(A.otherFlat.value.amount) }, A.otherFlat.source),
    ]),
    deduction('meals', null, [meals(A.meals)]),
    deduction('pillar3a', 'previdenza individuale vincolata', [pillar3a(A.pillar3a)]),
    deduction('insurance', 'oneri assicurativi e interessi di capitali a risparmio', [
      family(A.insurance),
      limit(
        'noPensionMore',
        {
          married: chf(A.insurance.value.marriedNoPension),
          other: chf(A.insurance.value.otherNoPension),
        },
        A.insurance.source,
      ),
    ]),
    deduction('debtInterest', 'interessi passivi privati', [debtInterest(A.debtInterestExtra)]),
    deduction('childcare', 'deduzione cure prestate da terzi a figli', [
      one('perChildMax', A.childcare),
    ]),
    deduction('training', 'spese di formazione e formazione continua professionali', [
      one('perPersonMax', A.training),
    ]),
    deduction('twoEarner', 'deduzione per attività lucrativa di entrambi i coniugi', [
      one('twoEarnerMax', A.twoEarner),
    ]),
    deduction('party', 'versamenti a partiti politici', [one('atMost', A.party)]),
    deduction('donations', 'liberalità a enti di pubblica utilità', [donations(A.donations)]),
    deduction('medical', 'spese per malattia e infortunio', [medical(A.medicalThresholdBp)]),
    deduction('child', 'deduzione per ogni figlio a carico', [one('child', A.child, 'amount')]),
  ],
};
