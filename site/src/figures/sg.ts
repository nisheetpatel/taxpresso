// St. Gallen's figures for its reference page, read from packages/rules-sg (see ./shared.ts).
// Terms as the package prints them (rules-sg rubrics.ts, communes.ts and tariffs.ts, from the
// St. Gallen return and the table of multipliers). A commune's church areas can have different
// rates; the Christ Catholic rate is one for the whole canton.

import { COMMUNES_2025 } from '../../../packages/rules-sg/src/2025/communes.ts';
import { MULTIPLIER_2025 } from '../../../packages/rules-sg/src/2025/tariffs.ts';
import { AMOUNTS_2026 as A } from '../../../packages/rules-sg/src/2026/amounts.ts';
import {
  CHRIST_CATHOLIC_2026,
  COMMUNES_2026,
} from '../../../packages/rules-sg/src/2026/communes.ts';
import { MULTIPLIER_2026 } from '../../../packages/rules-sg/src/2026/tariffs.ts';
import type { SgCommune } from '../../../packages/rules-sg/src/communes.ts';
import { cite } from '../geneva-data.ts';
import {
  type CantonFigures,
  cantonRate,
  chf,
  communeTable,
  couple,
  debtInterest,
  deduction,
  distinct,
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
  label: { term: 'Gesamtsteuerfuss' },
  year,
  cell: (c: SgCommune) => [pct(c.rate)],
});

export const figures: CantonFigures = {
  code: 'SG',
  lang: 'de',
  how: 'percent',
  term: 'Gesamtsteuerfuss',
  base: 'einfache Steuer',
  tax: 'Kantons- und Gemeindesteuern',
  canton: {
    term: 'Kantonssteuerfuss',
    rates: [
      cantonRate(TAX_YEAR, MULTIPLIER_2026, pct),
      cantonRate(PREVIOUS_YEAR, MULTIPLIER_2025, pct),
    ],
  },
  wide: [
    {
      church: 'christCatholic',
      year: TAX_YEAR,
      figure: pct(CHRIST_CATHOLIC_2026.value),
      sources: cite(CHRIST_CATHOLIC_2026.source),
    },
  ],
  communes: communeTable<SgCommune>({
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
        cell: (c) =>
          distinct(
            c.areas.map((a) => a.catholic),
            pct,
          ),
      },
      {
        label: { church: 'reformed' },
        year: TAX_YEAR,
        cell: (c) =>
          distinct(
            c.areas.map((a) => a.reformed),
            pct,
          ),
      },
    ],
  }),
  deductions: [
    deduction('professional', 'Pauschalabzug übrige Berufskosten', [
      limit(
        'baseShareMax',
        {
          base: chf(A.otherFlat.value.base),
          rate: pct(A.otherFlat.value.rateBp),
          max: chf(A.otherFlat.value.max),
        },
        A.otherFlat.source,
      ),
    ]),
    deduction('commute', 'Fahrkosten zwischen Wohn- und Arbeitsstätte', [
      limit('perYear', { max: chf(A.travel.value.max) }, A.travel.source),
    ]),
    deduction('meals', 'Mehrkosten für Verpflegung', [meals(A.meals)]),
    deduction('pillar3a', 'Säule 3a', [pillar3a(A.pillar3a)]),
    deduction('insurance', 'Versicherungsprämien und Sparzinsen', [
      family(A.insurance),
      limit(
        'noPensionMore',
        {
          married: chf(A.insurance.value.marriedExtra),
          other: chf(A.insurance.value.otherExtra),
        },
        A.insurance.source,
      ),
    ]),
    deduction('debtInterest', 'Schuldzinsen', [debtInterest(A.debtInterestExtra)]),
    deduction('childcare', 'Kinderbetreuungskosten bei Drittbetreuung', [
      one('perChildMax', A.childcare),
    ]),
    deduction('training', 'Kosten berufsorientierte Aus-/Weiterbildung', [
      limit('perPersonMax', { max: chf(A.training.value.max) }, A.training.source),
    ]),
    deduction('twoEarner', 'Zweiverdienerabzug', [one('twoEarnerFixed', A.twoEarner, 'amount')]),
    deduction('party', 'Parteispenden', [couple('couple', A.party)]),
    deduction('donations', 'Freiwillige Zuwendungen', [donations(A.donations)]),
    deduction('medical', 'Krankheits- und Unfallkosten', [medical(A.medicalThresholdBp)]),
    deduction('child', 'Kinderabzug', [
      limit(
        'childSchool',
        { preschool: chf(A.child.value.preschool), school: chf(A.child.value.school) },
        A.child.source,
      ),
    ]),
  ],
};
