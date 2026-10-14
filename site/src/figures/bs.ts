// Basel-Stadt's figures for its reference page, read from packages/rules-bs (see ./shared.ts).
// Terms as the package prints them (rules-bs rubrics.ts, terms.ts and keys.ts, from the Basel-Stadt
// return). Basel-Stadt has no cantonal multiplier: the canton levies the whole tax in Basel, and its
// share (Kantonssteuerquote) in Riehen and Bettingen, which levy their own Steuerfuss on top.

import { COMMUNES_2025 } from '../../../packages/rules-bs/src/2025/communes.ts';
import { AMOUNTS_2026 as A } from '../../../packages/rules-bs/src/2026/amounts.ts';
import { COMMUNES_2026 } from '../../../packages/rules-bs/src/2026/communes.ts';
import type { BsCommune } from '../../../packages/rules-bs/src/communes.ts';
import {
  type CantonFigures,
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
  pct,
  pillar3a,
  PREVIOUS_YEAR,
  TAX_YEAR,
} from './shared.ts';

export const figures: CantonFigures = {
  code: 'BS',
  lang: 'de',
  how: 'shares',
  term: 'Steuerfuss',
  base: 'Kantonssteuerquote',
  tax: 'Kantons- und Gemeindesteuern',
  canton: null,
  wide: [],
  communes: communeTable<BsCommune>({
    lang: 'de',
    years: [
      { year: TAX_YEAR, table: COMMUNES_2026 },
      { year: PREVIOUS_YEAR, table: COMMUNES_2025 },
    ],
    key: (c) => fold(c.name),
    name: (c) => c.name,
    columns: [
      {
        label: { term: 'Kantonssteuerquote' },
        year: TAX_YEAR,
        cell: (c) => [pct(c.cantonIncomeShare)],
      },
      { label: { term: 'Steuerfuss Einkommen' }, year: TAX_YEAR, cell: (c) => [pct(c.incomeRate)] },
      { label: { term: 'Steuerfuss Vermögen' }, year: TAX_YEAR, cell: (c) => [pct(c.wealthRate)] },
      {
        label: { term: 'Steuerfuss Einkommen' },
        year: PREVIOUS_YEAR,
        cell: (c) => [pct(c.incomeRate)],
      },
      {
        label: { term: 'Steuerfuss Vermögen' },
        year: PREVIOUS_YEAR,
        cell: (c) => [pct(c.wealthRate)],
      },
    ],
  }),
  deductions: [
    deduction('professional', 'Pauschalabzug für Berufskosten', [
      limit('flat', { amount: chf(A.professionalFlat.value.amount) }, A.professionalFlat.source),
    ]),
    deduction('commute', 'Fahrkosten', [one('perYear', A.commuteMax)]),
    deduction('meals', 'Mehrkosten für auswärtige Verpflegung', [meals(A.meals)]),
    deduction('pillar3a', 'Gebundene Selbstvorsorge (Säule 3a)', [pillar3a(A.pillar3a)]),
    deduction('insurance', 'Versicherungsprämien', [
      couple('flatCouple', {
        value: { married: A.insurance.value.married, other: A.insurance.value.single },
        source: A.insurance.source,
      }),
    ]),
    deduction('debtInterest', 'Schuldzinsen', [debtInterest(A.debtInterestExtra)]),
    deduction('childcare', 'Abzug für fremdbetreute Kinder', [one('perChildMax', A.childcare)]),
    deduction('training', 'Selbstgetragene Aus- und Weiterbildungskosten', [
      one('atMost', A.training),
    ]),
    deduction('twoEarner', 'Abzug bei Erwerbstätigkeit beider Ehegatten', [
      one('twoEarnerMax', A.twoEarner),
    ]),
    deduction('party', 'Beiträge an politische Parteien', [one('atMost', A.party)]),
    deduction('donations', 'Zuwendungen', [donations(A.donations)]),
    deduction('medical', 'Krankheits-, Unfall- und Behinderungskosten', [
      medical(A.medicalThresholdBp),
    ]),
    deduction('child', 'Abzug für Kinder', [
      limit('child', { amount: chf(A.social.value.child) }, A.social.source),
    ]),
  ],
};
