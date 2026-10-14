// Lucerne's figures for its reference page, read from packages/rules-lu (see ./shared.ts). Terms as
// the package prints them (rules-lu rubrics.ts and terms.ts, from the Lucerne return) and as the
// official table of units is titled (lu-2026-communal-steuereinheiten). Lucerne counts in units
// (Steuereinheiten): the state's, the commune's and the parish's, each times the tax per unit. The
// Christ Catholic parish is one for the whole canton.

import { COMMUNES_2025, STATE_UNITS_2025 } from '../../../packages/rules-lu/src/2025/communes.ts';
import { AMOUNTS_2026 as A } from '../../../packages/rules-lu/src/2026/amounts.ts';
import {
  CHRIST_CATHOLIC_UNITS_2026,
  COMMUNES_2026,
  STATE_UNITS_2026,
} from '../../../packages/rules-lu/src/2026/communes.ts';
import type { LuCommune } from '../../../packages/rules-lu/src/communes.ts';
import { cite } from '../geneva-data.ts';
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
  pillar3a,
  PREVIOUS_YEAR,
  shareMinMax,
  TAX_YEAR,
  units,
} from './shared.ts';

const rate = (year: number) => ({
  label: { term: 'Steuereinheiten' },
  year,
  cell: (c: LuCommune) => [units(c.units)],
});

export const figures: CantonFigures = {
  code: 'LU',
  lang: 'de',
  how: 'units',
  term: 'Steuereinheiten',
  base: 'Steuer je Einheit',
  tax: 'Staats- und Gemeindesteuern',
  canton: {
    term: 'Steuereinheiten Staat',
    rates: [
      cantonRate(TAX_YEAR, STATE_UNITS_2026, units),
      cantonRate(PREVIOUS_YEAR, STATE_UNITS_2025, units),
    ],
  },
  wide: [
    {
      church: 'christCatholic',
      year: TAX_YEAR,
      figure: units(CHRIST_CATHOLIC_UNITS_2026.value),
      sources: cite(CHRIST_CATHOLIC_UNITS_2026.source),
    },
  ],
  communes: communeTable<LuCommune>({
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
      { label: { church: 'catholic' }, year: TAX_YEAR, cell: (c) => [units(c.catholic.units)] },
      { label: { church: 'reformed' }, year: TAX_YEAR, cell: (c) => [units(c.reformed.units)] },
    ],
  }),
  deductions: [
    deduction('professional', 'Übrige für die Ausübung des Berufes erforderliche Kosten', [
      shareMinMax(A.professionalFlat),
    ]),
    deduction('commute', 'Fahrkosten zwischen Wohn- und Arbeitsstätte', [
      one('perYear', A.commuteMax),
    ]),
    deduction('meals', 'Mehrkosten der Verpflegung', [meals(A.meals)]),
    deduction(
      'pillar3a',
      'Beiträge an anerkannte Formen der gebundenen Selbstvorsorge (Säule 3a)',
      [pillar3a(A.pillar3a)],
    ),
    deduction('insurance', 'Versicherungsprämien und Zinsen von Sparkapitalien', [
      family(A.insurance),
      limit(
        'noPension',
        { married: chf(A.insurance.value.marriedNone), other: chf(A.insurance.value.otherNone) },
        A.insurance.source,
      ),
    ]),
    deduction('debtInterest', 'Schuldzinsen', [debtInterest(A.debtInterestExtra)]),
    deduction('childcare', 'Fremdbetreuungskosten', [one('perChildMax', A.childcareMax)]),
    deduction('training', 'Berufsorientierte Aus- und Weiterbildung', [
      one('atMost', A.trainingMax),
    ]),
    deduction('twoEarner', 'Sonderabzug bei Erwerbstätigkeit beider Ehegatten', [
      one('twoEarnerMax', A.twoEarner),
    ]),
    deduction('party', 'Zuwendungen und Beiträge an politische Parteien', [
      one('atMost', A.partyMax),
    ]),
    deduction('donations', 'Freiwillige Zuwendungen', [donations(A.donations)]),
    deduction('medical', 'Krankheits-, Unfall- und behinderungsbedingte Kosten', [
      medical(A.medicalThresholdBp),
    ]),
    deduction('child', 'Kinderabzug', [
      limit(
        'childAway',
        { base: chf(A.child.value.base), away: chf(A.child.value.away) },
        A.child.source,
      ),
    ]),
  ],
};
