// Vaud's figures for its reference page, read from packages/rules-vd (see ./shared.ts). Terms as
// the package prints them (rules-vd rubrics.ts, from the Vaud return) and as the official table of
// communal rates is titled (vd-2026-communal-arretes-imposition: "Taux d'impôt").

import { COMMUNES_2025 } from '../../../packages/rules-vd/src/2025/communes.ts';
import { CANTONAL_COEFFICIENT_2025 } from '../../../packages/rules-vd/src/2025/tariffs.ts';
import { AMOUNTS_2026 as A } from '../../../packages/rules-vd/src/2026/amounts.ts';
import { COMMUNES_2026 } from '../../../packages/rules-vd/src/2026/communes.ts';
import { CANTONAL_COEFFICIENT_2026 } from '../../../packages/rules-vd/src/2026/tariffs.ts';
import type { VdCommune } from '../../../packages/rules-vd/src/communes.ts';
import {
  type CantonFigures,
  cantonRate,
  chf,
  communeTable,
  debtInterest,
  deduction,
  donations,
  fold,
  type Limit,
  limit,
  medical,
  one,
  pct,
  pillar3a,
  PREVIOUS_YEAR,
  shareMinMax,
  TAX_YEAR,
} from './shared.ts';

const rate = (year: number) => ({
  label: { term: 'taux d’impôt' },
  year,
  cell: (c: VdCommune) => [pct(c.rate)],
});

/** Married couples, everyone else and each child, in one of the insurance sentences. */
const byFamily = (
  text: 'premiums' | 'savings',
  c: { value: { married: number; single: number; perChild: number }; source: string },
) =>
  limit(
    text,
    {
      married: chf(c.value.married),
      other: chf(c.value.single),
      perChild: chf(c.value.perChild),
    },
    c.source,
  );

/** Public transport: the flat amount by distance, whose last step is also the cap. */
const commute: Limit[] = (() => {
  const t = A.publicTransport;
  const cap = t?.value.byKm.at(-1);
  return t && cap !== undefined ? [limit('perYear', { max: chf(cap) }, t.source)] : [];
})();

export const figures: CantonFigures = {
  code: 'VD',
  lang: 'fr',
  how: 'percent',
  term: 'taux d’impôt',
  base: 'impôt cantonal de base',
  tax: 'impôt cantonal et communal',
  canton: {
    term: 'coefficient cantonal',
    rates: [
      cantonRate(TAX_YEAR, CANTONAL_COEFFICIENT_2026, pct),
      cantonRate(PREVIOUS_YEAR, CANTONAL_COEFFICIENT_2025, pct),
    ],
  },
  wide: [],
  communes: communeTable<VdCommune>({
    lang: 'fr',
    years: [
      { year: TAX_YEAR, table: COMMUNES_2026 },
      { year: PREVIOUS_YEAR, table: COMMUNES_2025 },
    ],
    key: (c) => fold(c.name),
    name: (c) => c.name,
    columns: [rate(TAX_YEAR), rate(PREVIOUS_YEAR)],
  }),
  deductions: [
    deduction('professional', 'Autres frais professionnels', [shareMinMax(A.professionalFlat)]),
    ...(commute.length ? [deduction('commute', 'Frais de transport', commute)] : []),
    deduction('meals', 'Repas pris hors du domicile', [
      limit('mealsYear', { perYear: chf(A.meals.value.perYear) }, A.meals.source),
    ]),
    deduction('pillar3a', 'Prévoyance individuelle liée (3e pilier A)', [pillar3a(A.pillar3a)]),
    deduction(
      'insurance',
      'Assurances maladie et accidents, assurances sur la vie; intérêts de capitaux d’épargne',
      [byFamily('premiums', A.insurance), byFamily('savings', A.savingsInterest)],
    ),
    deduction('debtInterest', 'Intérêts des dettes privées', [debtInterest(A.debtInterestExtra)]),
    deduction('childcare', 'Déduction pour frais de garde', [
      limit('perChildMax', { max: chf(A.childcare.value.perChild) }, A.childcare.source),
    ]),
    deduction('training', 'Frais de perfectionnement et de formation', [
      one('perPersonMax', A.training),
    ]),
    deduction('twoEarner', 'Déduction pour double activité des conjoints', [
      one('twoEarnerMax', A.twoEarner),
    ]),
    deduction('party', 'Versements à des partis politiques', [one('atMost', A.party)]),
    deduction('donations', 'Dons à des institutions d’utilité publique', [donations(A.donations)]),
    deduction('medical', 'Frais médicaux et dentaires', [medical(A.medicalThresholdBp)]),
  ],
};
