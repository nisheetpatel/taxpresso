// Ticino amounts, tax year 2026. Every value is read in the documents cited next to it:
// - ti-na-law-lt-640-100: the tax law (LT), consolidated text in force on 1 January 2026, updated
//   on 9 October 2026 with the decree for 2026 (BU 34/2026);
// - ti-2026-tariff-decreto-esecutivo-pf: the executive decree on natural persons for 2026 (BU
//   34/2026, adopted 7 October 2026, in force from 1 January 2026; the PDF's pages 1 to 6 are the
//   BU's pages 326 to 331): professional costs (art. 3 to 8). Its annex changes only the income
//   tariff (LT art. 35) and the minimum of the lump-sum tax (art. 13), so the deductions of the law
//   keep their 2025 amounts;
// - ti-2026-deductions-lt-art25: the law of 10 June 2026 (BU 28/2026) raising the flat amount for
//   other professional costs from 2026;
// - pillar 3a: the federal limits for 2026 (LT art. 32 cpv. 1 lett. e refers to them), from
//   packages/rules-ch.
// The 2026 instructions are not published (docs/sources/ti/NOTES.md, Gaps): the most working days
// a year that count for travel, which the 2025 instructions give, has no 2026 source, so driving
// costs are not computed for 2026.
import { ifdParamsFor } from '@taxpresso/rules-ch';
import type { TiAmounts } from '../amounts.js';

const DECREE = 'ti-2026-tariff-decreto-esecutivo-pf';
const LAW = 'ti-na-law-lt-640-100';

const FEDERAL = ifdParamsFor(2026);

export const AMOUNTS_2026: TiAmounts = {
  commute: {
    value: { bikeMax: 70_000, carPerKm: 60, motorbikePerKm: 40 },
    source: `${DECREE} art. 3 cpv. 1 lett. b and cpv. 2 (p. 1)`,
  },
  commuteMaxDays: null,
  meals: {
    value: { perDay: 1_500, perYear: 320_000, reducedPerDay: 750, reducedPerYear: 160_000 },
    source: `${DECREE} art. 4 cpv. 2 lett. a and cpv. 3 (p. 2)`,
  },
  otherFlat: {
    value: { amount: 350_000, halfBelowRate: 50, halfBelowMonths: 6 },
    source: `ti-2026-deductions-lt-art25 p. 1 (art. 25 cpv. 2); ${LAW} art. 25 cpv. 2`,
  },
  sideJobFlat: {
    value: 80_000,
    source: `${DECREE} art. 8 cpv. 1 (p. 3)`,
  },
  pillar3a: {
    value: FEDERAL.pillar3a.value,
    source: `${LAW} art. 32 cpv. 1 lett. e; ch-2026-ifd-instructions-personnes-physiques p. 7 (chiffre 13)`,
  },
  insurance: {
    value: {
      married: 1_090_000,
      other: 550_000,
      marriedNoPension: 450_000,
      otherNoPension: 230_000,
      perChild: 120_000,
    },
    source: `${LAW} art. 32 cpv. 1 lett. g, art. 32 cpv. 1bis`,
  },
  debtInterestExtra: {
    value: 5_000_000,
    source: `${LAW} art. 32 cpv. 1 lett. a`,
  },
  party: {
    value: 1_060_000,
    source: `${LAW} art. 32 cpv. 1 lett. m`,
  },
  training: {
    value: 1_070_000,
    source: `${LAW} art. 32 cpv. 1 lett. n`,
  },
  twoEarner: {
    value: 810_000,
    source: `${LAW} art. 32 cpv. 2`,
  },
  childcare: {
    value: 2_620_000,
    source: `${LAW} art. 32a`,
  },
  medicalThresholdBp: {
    value: 500,
    source: `${LAW} art. 32b`,
  },
  donations: {
    value: { shareBp: 2_000, min: 10_000 },
    source: `${LAW} art. 32c cpv. 1`,
  },
  child: {
    value: 1_150_000,
    source: `${LAW} art. 34 cpv. 1 lett. a`,
  },
  avsExemption: {
    value: {
      amount: 800_000,
      singleUpTo: 2_100_000,
      familyUpTo: 2_700_000,
      step: 300_000,
      reduction: 100_000,
    },
    source: `${LAW} art. 34 cpv. 2`,
  },
  wealthDeductions: {
    value: { married: 6_000_000, perMinorChild: 3_000_000 },
    source: `${LAW} art. 48`,
  },
  coefficient: {
    value: 10_000,
    source: `${LAW} art. 1a cpv. 2, art. 1b cpv. 1, art. 300a cpv. 1`,
  },
  personalTax: {
    value: 4_000,
    source: `${LAW} art. 290 cpv. 1 to 3`,
  },
};
