// Aargau's figures for its reference page, read from packages/rules-ag (see ./shared.ts). Terms as
// the package prints them (rules-ag rubrics.ts, communes.ts and tariffs.ts, from the Aargau return
// and its list of multipliers). The further parishes of some communes (Zusatzkirchen) are left to
// the official list.

import { COMMUNES_2025 } from '../../../packages/rules-ag/src/2025/communes.ts';
import { CANTONAL_RATE_2025 } from '../../../packages/rules-ag/src/2025/tariffs.ts';
import { AMOUNTS_2026 as A } from '../../../packages/rules-ag/src/2026/amounts.ts';
import { COMMUNES_2026 } from '../../../packages/rules-ag/src/2026/communes.ts';
import { CANTONAL_RATE_2026 } from '../../../packages/rules-ag/src/2026/tariffs.ts';
import type { AgCommune } from '../../../packages/rules-ag/src/communes.ts';
import {
  type CantonFigures,
  cantonRate,
  chf,
  communeTable,
  couple,
  debtInterest,
  deduction,
  donations,
  fold,
  limit,
  meals,
  medical,
  one,
  percent,
  pillar3a,
  PREVIOUS_YEAR,
  shareMinMax,
  TAX_YEAR,
} from './shared.ts';

const rate = (year: number) => ({
  label: { term: 'Steuerfuss' },
  year,
  cell: (c: AgCommune) => [percent(c.rate)],
});

export const figures: CantonFigures = {
  code: 'AG',
  lang: 'de',
  how: 'percent',
  term: 'Steuerfuss',
  base: 'einfache Kantonssteuer',
  tax: 'Kantons- und Gemeindesteuern',
  canton: {
    term: 'Steuerfuss Kanton',
    rates: [
      cantonRate(TAX_YEAR, CANTONAL_RATE_2026, percent),
      cantonRate(PREVIOUS_YEAR, CANTONAL_RATE_2025, percent),
    ],
  },
  wide: [],
  communes: communeTable<AgCommune>({
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
        label: { church: 'reformed' },
        year: TAX_YEAR,
        cell: (c) => [percent(c.church.reformed)],
      },
      {
        label: { church: 'catholic' },
        year: TAX_YEAR,
        cell: (c) => [percent(c.church.catholic)],
      },
      {
        label: { church: 'christCatholic' },
        year: TAX_YEAR,
        cell: (c) => [percent(c.church.christCatholic)],
      },
    ],
  }),
  deductions: [
    deduction('professional', 'Pauschalabzug (übrige Berufskosten)', [
      shareMinMax(A.professionalFlat),
    ]),
    deduction('commute', 'Fahrtkosten zwischen Wohn- und Arbeitsstätte', [
      one('perYear', A.commuteMax),
    ]),
    deduction('meals', 'Mehrkosten der auswärtigen Verpflegung', [meals(A.meals)]),
    deduction('pillar3a', 'Beiträge Säule 3a', [pillar3a(A.pillar3a)]),
    deduction('insurance', 'Versicherungsprämien und Zinsen von Sparkapitalien', [
      couple('flatCouple', A.insurance),
    ]),
    deduction('debtInterest', 'Schuldzinsen', [debtInterest(A.debtInterestExtra)]),
    deduction('childcare', 'Kinderbetreuungskosten', [
      limit('perChildMax', { max: chf(A.childcare.value.perChild) }, A.childcare.source),
    ]),
    deduction('training', 'Berufsorientierte Aus-, Weiterbildungs- und Umschulungskosten', [
      one('perPersonMax', A.trainingMax),
    ]),
    deduction('twoEarner', 'Sonderabzug für zweitverdienenden Eheteil', [
      one('twoEarnerMax', A.twoEarner),
    ]),
    deduction('party', 'Zuwendungen an steuerbefreite politische Parteien', [
      one('atMost', A.partyMax),
    ]),
    deduction('donations', 'Freiwillige Leistungen (Spenden)', [donations(A.donations)]),
    deduction('medical', 'Krankheits- und Unfallkosten', [medical(A.medicalThresholdBp)]),
    deduction('child', 'Kinderabzug', [
      limit(
        'childAge',
        {
          young: chf(A.child.value.under14),
          teen: chf(A.child.value.under18),
          adult: chf(A.child.value.adult),
        },
        A.child.source,
      ),
    ]),
  ],
};
