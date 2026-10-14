// Zurich's figures for its reference page, read from packages/rules-zh (see ./shared.ts). Terms as
// the package prints them (rules-zh rubrics.ts and terms.ts, from the Zurich return).

import { COMMUNES_2025 } from '../../../packages/rules-zh/src/2025/communes.ts';
import { CANTONAL_RATE_2025 } from '../../../packages/rules-zh/src/2025/tariffs.ts';
import { AMOUNTS_2026 as A } from '../../../packages/rules-zh/src/2026/amounts.ts';
import { COMMUNES_2026 } from '../../../packages/rules-zh/src/2026/communes.ts';
import { CANTONAL_RATE_2026 } from '../../../packages/rules-zh/src/2026/tariffs.ts';
import type { CommuneRates } from '../../../packages/rules-zh/src/communes.ts';
import {
  type CantonFigures,
  cantonRate,
  communeTable,
  couple,
  debtInterest,
  deduction,
  distinct,
  donations,
  family,
  limit,
  meals,
  medical,
  one,
  pct,
  percent,
  pillar3a,
  PREVIOUS_YEAR,
  shareMinMax,
  TAX_YEAR,
} from './shared.ts';

const rate = (year: number) => ({
  label: { term: 'Steuerfuss' },
  year,
  cell: (c: CommuneRates) => distinct(c.rates, percent),
});

export const figures: CantonFigures = {
  code: 'ZH',
  lang: 'de',
  how: 'percent',
  term: 'Steuerfuss',
  base: 'einfache Staatssteuer',
  tax: 'Staats- und Gemeindesteuern',
  canton: {
    term: 'Staatssteuerfuss',
    rates: [
      cantonRate(TAX_YEAR, CANTONAL_RATE_2026, percent),
      cantonRate(PREVIOUS_YEAR, CANTONAL_RATE_2025, percent),
    ],
  },
  wide: [],
  communes: communeTable<CommuneRates>({
    lang: 'de',
    years: [
      { year: TAX_YEAR, table: COMMUNES_2026 },
      { year: PREVIOUS_YEAR, table: COMMUNES_2025 },
    ],
    key: (c) => String(c.bfs),
    name: (c) => c.name,
    columns: [
      rate(TAX_YEAR),
      rate(PREVIOUS_YEAR),
      { label: { church: 'reformed' }, year: TAX_YEAR, cell: (c) => distinct(c.reformed, percent) },
      { label: { church: 'catholic' }, year: TAX_YEAR, cell: (c) => distinct(c.catholic, percent) },
      {
        label: { church: 'christCatholic' },
        year: TAX_YEAR,
        cell: (c) => distinct(c.christCatholic, percent),
      },
    ],
  }),
  deductions: [
    deduction('professional', 'Übrige Berufsauslagen', [shareMinMax(A.professionalFlat)]),
    deduction('commute', 'Fahrkosten', [one('perYear', A.commuteMax)]),
    deduction('meals', 'Mehrkosten für auswärtige Verpflegung', [meals(A.meals)]),
    deduction('pillar3a', 'Beiträge an die 3. Säule a', [pillar3a(A.pillar3a)]),
    deduction('insurance', 'Versicherungsprämien, Zinsen von Sparkapitalien', [
      family(A.insurance),
      limit('noPensionShare', { share: pct(A.insurance.value.noPensionBp) }, A.insurance.source),
    ]),
    deduction('debtInterest', 'Schuldzinsen', [debtInterest(A.debtInterestExtra)]),
    deduction('childcare', 'Abzug für fremdbetreute Kinder', [one('perChildMax', A.childcareMax)]),
    deduction('training', 'Berufsorientierte Aus- und Weiterbildungskosten', [
      one('atMost', A.trainingMax),
    ]),
    deduction('twoEarner', 'Sonderabzug bei Erwerbstätigkeit beider Ehegatten', [
      one('twoEarnerMax', A.twoEarner),
    ]),
    deduction('party', 'Beiträge an politische Parteien', [couple('couple', A.partyMax)]),
    deduction('donations', 'Gemeinnützige Zuwendungen', [donations(A.donations)]),
    deduction('medical', 'Krankheits- und Unfallkosten', [medical(A.medicalThresholdBp)]),
    deduction('child', 'Abzug für Kinder in Ihrem Haushalt', [one('child', A.child, 'amount')]),
  ],
};
