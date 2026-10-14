// Zug's figures for its reference page, read from packages/rules-zg (see ./shared.ts). Terms as
// the package prints them (rules-zg rubrics.ts and terms.ts, from the Zug return). The Evangelical
// Reformed parish is one for the whole canton.

import { AMOUNTS_2026 as A } from '../../../packages/rules-zg/src/2026/amounts.ts';
import { CANTON_2025, COMMUNES_2025 } from '../../../packages/rules-zg/src/2025/communes.ts';
import {
  CANTON_2026,
  COMMUNES_2026,
  REFORMED_2026,
} from '../../../packages/rules-zg/src/2026/communes.ts';
import type { ZgCommune } from '../../../packages/rules-zg/src/communes.ts';
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
  shareMinMax,
  TAX_YEAR,
} from './shared.ts';
import { cite } from '../geneva-data.ts';

const rate = (year: number) => ({
  label: { term: 'Steuerfuss' },
  year,
  cell: (c: ZgCommune) => [pct(c.rate)],
});

export const figures: CantonFigures = {
  code: 'ZG',
  lang: 'de',
  how: 'percent',
  term: 'Steuerfuss',
  base: 'einfache Steuer',
  tax: 'Kantons- und Gemeindesteuern',
  canton: {
    term: 'Steuerfuss',
    rates: [cantonRate(TAX_YEAR, CANTON_2026, pct), cantonRate(PREVIOUS_YEAR, CANTON_2025, pct)],
  },
  wide: [
    {
      church: 'reformed',
      year: TAX_YEAR,
      figure: pct(REFORMED_2026.value),
      sources: cite(REFORMED_2026.source),
    },
  ],
  communes: communeTable<ZgCommune>({
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
      { label: { church: 'catholic' }, year: TAX_YEAR, cell: (c) => [pct(c.catholic)] },
    ],
  }),
  deductions: [
    deduction('professional', 'Übrige für die Ausübung des Berufes erforderliche Kosten', [
      shareMinMax(A.otherFlat),
    ]),
    deduction('commute', 'Fahrkosten zwischen Wohn- und Arbeitsort', [
      limit('perYear', { max: chf(A.travel.value.max) }, A.travel.source),
    ]),
    deduction('meals', 'Mehrkosten für auswärtige Verpflegung', [meals(A.meals)]),
    deduction('pillar3a', 'Beiträge gebundene Vorsorge (Säule 3a)', [pillar3a(A.pillar3a)]),
    deduction('insurance', 'Versicherungsprämien und Zinsen von Sparkapitalien', [
      family(A.insurance),
      limit(
        'noPension',
        { married: chf(A.insurance.value.marriedNone), other: chf(A.insurance.value.otherNone) },
        A.insurance.source,
      ),
    ]),
    deduction('debtInterest', 'Private Schuldzinsen', [debtInterest(A.debtInterestExtra)]),
    deduction('childcare', 'Kinderdrittbetreuungskostenabzug', [one('perChildMax', A.childcare)]),
    deduction('training', 'Selbst getragene berufsorientierte Aus- und Weiterbildungskosten', [
      one('perPersonMax', A.training),
    ]),
    deduction('twoEarner', 'Sonderabzug bei Erwerbstätigkeit beider Eheleute', [
      one('twoEarnerMax', A.twoEarner),
    ]),
    deduction('party', 'Zuwendungen an politische Parteien', [one('atMost', A.party)]),
    deduction('donations', 'Gemeinnützige Zuwendungen', [donations(A.donations)]),
    deduction('medical', 'Krankheits- und Unfallkosten', [medical(A.medicalThresholdBp)]),
    deduction('child', 'Kinderabzug', [
      limit(
        'childOlder',
        { base: chf(A.child.value.base), extra: chf(A.child.value.from15) },
        A.child.source,
      ),
    ]),
  ],
};
