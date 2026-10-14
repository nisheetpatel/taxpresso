// Bern's figures for its reference page, read from packages/rules-be (see ./shared.ts). Terms as
// the package prints them (rules-be rubrics.ts, from the Bern return).

import { COMMUNES_2025 } from '../../../packages/rules-be/src/2025/communes.ts';
import { CANTONAL_RATE_2025 } from '../../../packages/rules-be/src/2025/tariffs.ts';
import { AMOUNTS_2026 as A } from '../../../packages/rules-be/src/2026/amounts.ts';
import { COMMUNES_2026 } from '../../../packages/rules-be/src/2026/communes.ts';
import { CANTONAL_RATE_2026 } from '../../../packages/rules-be/src/2026/tariffs.ts';
import type { BeCommune } from '../../../packages/rules-be/src/communes.ts';
import {
  type CantonFigures,
  cantonRate,
  chf,
  communeTable,
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
  pillar3a,
  PREVIOUS_YEAR,
  shareMinMax,
  TAX_YEAR,
  units,
} from './shared.ts';

const rate = (year: number) => ({
  label: { term: 'Steueranlage' },
  year,
  cell: (c: BeCommune) => [units(c.rate)],
});

export const figures: CantonFigures = {
  code: 'BE',
  lang: 'de',
  how: 'multiple',
  term: 'Steueranlage',
  base: 'einfache Steuer',
  tax: 'Kantons- und Gemeindesteuern',
  canton: {
    term: 'Kantonssteueranlage',
    rates: [
      cantonRate(TAX_YEAR, CANTONAL_RATE_2026, units),
      cantonRate(PREVIOUS_YEAR, CANTONAL_RATE_2025, units),
    ],
  },
  wide: [],
  communes: communeTable<BeCommune>({
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
      {
        label: { church: 'reformed' },
        year: TAX_YEAR,
        cell: (c) =>
          distinct(
            c.parishes.map((p) => p.reformed),
            units,
          ),
      },
      {
        label: { church: 'catholic' },
        year: TAX_YEAR,
        cell: (c) =>
          distinct(
            c.parishes.map((p) => p.catholic),
            units,
          ),
      },
      {
        label: { church: 'christCatholic' },
        year: TAX_YEAR,
        cell: (c) =>
          distinct(
            c.parishes.map((p) => p.christCatholic),
            units,
          ),
      },
    ],
  }),
  deductions: [
    deduction('professional', 'Übrige Berufskosten', [shareMinMax(A.professionalFlat)]),
    deduction('commute', 'Fahrkosten', [one('perYear', A.commuteMax)]),
    deduction('meals', 'Auswärtige Verpflegung', [meals(A.meals)]),
    deduction('pillar3a', 'Beiträge Säule 3a', [pillar3a(A.pillar3a)]),
    deduction('insurance', 'Versicherungsprämien und Zinsen auf Sparkapitalien', [
      family(A.insurance),
      limit(
        'noPension',
        { married: chf(A.insurance.value.marriedNone), other: chf(A.insurance.value.otherNone) },
        A.insurance.source,
      ),
    ]),
    deduction('debtInterest', 'Schuldzinsen', [debtInterest(A.debtInterestExtra)]),
    deduction('childcare', 'Bezahlte Kinderdrittbetreuungskosten', [
      one('perChildMax', A.childcareMax),
    ]),
    deduction('training', 'Berufsorientierte Aus- und Weiterbildungskosten', [
      one('atMost', A.trainingMax),
    ]),
    deduction('twoEarner', 'Zweiverdienerabzug', [
      limit(
        'twoEarnerBoth',
        { share: pct(A.twoEarner.value.shareBp), max: chf(A.twoEarner.value.max) },
        A.twoEarner.source,
      ),
    ]),
    deduction('party', 'Mitgliederbeiträge und Zuwendungen an politische Parteien', [
      one('perPersonMax', A.partyMax),
    ]),
    deduction('donations', 'Vergabungen', [donations(A.donations)]),
    deduction('medical', 'Krankheits- und Unfallkosten', [medical(A.medicalThresholdBp)]),
    deduction('child', 'Kinderabzug', [one('child', A.child, 'amount')]),
  ],
};
