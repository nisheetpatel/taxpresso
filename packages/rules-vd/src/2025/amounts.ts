// Vaud deduction amounts, tax year 2025. Every value is read in the documents cited next to it:
// - vd-2025-guide: the general instructions for the 2025 return (21001); the PDF's pages are the
//   printed page numbers;
// - vd-2025-deductions: the table of the main Vaud deductions 2025 (codes 140 to 810);
// - vd-2025-law-li: the tax law (LI) in force in 2025, which keeps the figures before their yearly
//   adjustment to the cost of living (art. 60): the amounts are the guide's and the table's;
// - vd-na-law-rifam: the family regulation (shared custody).
import type { VdAmounts } from '../amounts.js';

const GUIDE = 'vd-2025-guide';
const TABLE = 'vd-2025-deductions p. 1';
const LAW = 'vd-2025-law-li';

export const AMOUNTS_2025: VdAmounts = {
  publicTransport: {
    value: {
      fromKm: 2,
      byKm: [
        117_600, 142_300, 158_700, 166_900, 184_900, 194_700, 209_400, 222_400, 237_200, 245_200,
        253_100, 262_600, 270_600, 278_600, 285_600, 289_600, 293_600, 297_600, 300_100, 302_600,
        305_100, 307_600, 310_100, 313_600, 316_600, 319_600, 322_600, 325_600, 328_800, 332_000,
        335_200, 338_400, 341_600, 344_800, 348_000, 351_200, 354_400, 357_600, 360_800, 364_000,
        367_200, 370_400, 373_600, 376_800, 380_000, 383_200, 386_400, 389_600, 392_800, 408_000,
      ],
    },
    source: `${GUIDE} p. 19 and 20 (code 140, usage des transports publics); ${TABLE} (code 140); ${LAW} art. 30 al. 2 (p. 18)`,
  },
  otherTransport: {
    value: { bikePerYear: 70_000, motorbikePerKm: 40 },
    source: `${GUIDE} p. 20 (code 140, usage d'autres moyens de transport)`,
  },
  car: {
    value: { perKm: 70, kmLimit: 15_000, abovePerKm: 35 },
    source: `${GUIDE} p. 20 and 21 (code 140, véhicule automobile); ${TABLE} (code 140)`,
  },
  yearDays: {
    value: 240,
    source: `${GUIDE} p. 19 (codes 140 à 165, 240 jours ouvrables); vd-2025-annexes-04-05 p. 1 (annexe 04, maximum 240 jours par an)`,
  },
  meals: {
    value: { perYear: 320_000, halfPerYear: 160_000 },
    source: `${GUIDE} p. 21 (code 150); ${TABLE} (code 150)`,
  },
  professionalFlat: {
    value: { rateBp: 300, min: 200_000, max: 400_000 },
    source: `${GUIDE} p. 22 (code 160); ${TABLE} (code 160)`,
  },
  sideJobFlat: {
    value: { rateBp: 2_000, min: 80_000, max: 240_000 },
    source: `${GUIDE} p. 18 (code 105), p. 23 (code 165); ${TABLE} (code 165)`,
  },
  twoEarner: {
    value: 170_000,
    source: `${GUIDE} p. 26 (code 235); ${TABLE} (code 235); ${LAW} art. 37 al. 2 (p. 23)`,
  },
  insurance: {
    value: { single: 500_000, married: 990_000, perChild: 130_000 },
    source: `${GUIDE} p. 29 and 30 (code 300); ${TABLE} (code 300); ${LAW} art. 37 al. 1 lit. g (p. 22)`,
  },
  pillar3a: {
    value: { withFund: 725_800, withoutFundMax: 3_628_800, withoutFundShareBp: 2_000 },
    source: `${GUIDE} p. 30 and 31 (code 310); ${TABLE} (code 310); ${LAW} art. 37 al. 1 lit. e (p. 22)`,
  },
  savingsInterest: {
    value: { single: 160_000, married: 330_000, perChild: 30_000 },
    source: `${GUIDE} p. 40 (code 480); ${TABLE} (code 480); ${LAW} art. 37 al. 1 lit. g (p. 22)`,
  },
  debtInterestExtra: {
    value: 5_000_000,
    source: `${LAW} art. 37 al. 1 lit. a (p. 21); ${GUIDE} p. 41 (codes 610 à 615)`,
  },
  training: {
    value: 1_200_000,
    source: `${GUIDE} p. 42 (code 618); ${TABLE} (code 618); ${LAW} art. 37 al. 1 lit. l (p. 23)`,
  },
  party: {
    value: 1_010_000,
    source: `${GUIDE} p. 43 (code 620); ${TABLE} (code 620); ${LAW} art. 37 al. 1 lit. j (p. 22)`,
  },
  childcare: {
    value: { perChild: 1_520_000, sharedPerParent: 750_000 },
    source: `${GUIDE} p. 44 and 45 (code 670); ${TABLE} (code 670); ${LAW} art. 37 al. 1 lit. k (p. 23); vd-na-law-rifam art. 4 al. 2 (p. 2)`,
  },
  housing: {
    value: { max: 680_000, incomeShareBp: 2_000 },
    source: `${GUIDE} p. 44 (code 660); ${TABLE} (code 660); ${LAW} art. 39 al. 1 (p. 24)`,
  },
  rentCap: {
    value: { single: 1_110_000, family: 1_370_000, perChild: 370_000 },
    source: `${GUIDE} p. 44 (code 660); ${LAW} art. 39 al. 2 (p. 24)`,
  },
  modest: {
    value: { base: 1_700_000, spouse: 570_000, singleParent: 320_000, perChild: 350_000 },
    source: `${GUIDE} p. 45 to 47 (code 695, tableaux 2a, 2b et 2c); ${TABLE} (code 695); ${LAW} art. 42 (p. 24)`,
  },
  medicalThresholdBp: {
    value: 500,
    source: `${LAW} art. 37 al. 1 lit. h (p. 22); ${GUIDE} p. 48 (code 710); ${TABLE} (code 710)`,
  },
  donations: {
    value: { shareBp: 2_000, min: 10_000 },
    source: `${LAW} art. 37 al. 1 lit. i (p. 22); ${GUIDE} p. 49 (code 720); ${TABLE} (code 720)`,
  },
  family: {
    value: {
      married: 130_000,
      singleParent: 280_000,
      perChild: 100_000,
      limit: 12_630_000,
      step: 210_000,
      upper: 16_410_000,
      upperStep: 100_000,
      cut: 10_000,
    },
    source: `${GUIDE} p. 49 and 50 (code 725); vd-2025-deductions p. 2 (déduction pour famille); ${LAW} art. 42a (p. 24 and 25)`,
  },
  quotientCap: {
    value: {
      married: [
        [21_290_000, 2_571_300],
        [23_650_000, 4_692_500],
        [26_010_000, 6_568_200],
        [28_370_000, 8_295_300],
        [30_730_000, 9_925_700],
      ],
      singleParent: [
        [21_290_000, 4_549_100],
        [23_650_000, 7_909_700],
        [26_010_000, 10_718_400],
      ],
      single: [
        [21_290_000, 7_096_700],
        [23_650_000, 11_825_000],
        [26_010_000, 15_606_000],
      ],
    },
    source: `${GUIDE} p. 52 to 54 (code 820); ${LAW} art. 43 al. 3 (p. 25)`,
  },
  furniture: {
    value: { shareBp: 3_000, single: 6_000_000, married: 12_000_000 },
    source: `${GUIDE} p. 39 (code 440); ${LAW} art. 54 (p. 28 and 29)`,
  },
  wealthFree: {
    value: { single: 6_000_000, married: 12_000_000 },
    source: `${GUIDE} p. 51 (code 800); vd-2025-deductions p. 2; ${LAW} art. 58 (p. 30)`,
  },
};
