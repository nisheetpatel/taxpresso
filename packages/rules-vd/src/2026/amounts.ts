// Vaud deduction amounts, tax year 2026. The 2026 guide is not published (docs/sources/vd/NOTES.md,
// Gaps), so the amounts are read in:
// - vd-2026-deductions: the table of the main Vaud deductions 2026 (codes 140 to 810);
// - vd-2026-law-li: the tax law (LI) in force in 2026 (the version from 1 May 2026), for the rules;
// - vd-na-law-rifam: the family regulation (shared custody).
// What only the guide prints is not published for 2026:
// - the public transport flat amounts by distance and the bike and motorbike rates: null, and the
//   engine computes no travel by these means for 2026;
// - the most rent counted for housing (660), the cap of the quotient familial (820) and the
//   household contents deduction (440): amounts LI art. 60 adjusts to the cost of living and never
//   down (al. 2), so 2025's are lower bounds (`floorOnly`) and the engine computes only where the
//   bound settles the result;
// - the 240 working days of a full year: the 2025 guide's convention (`carriedFrom`), which the
//   result names as such.
import { AMOUNTS_2025 } from '../2025/amounts.js';
import type { VdAmounts } from '../amounts.js';

const TABLE = 'vd-2026-deductions p. 1';
const LAW = 'vd-2026-law-li';
/** A 2025 amount as the lower bound of the unpublished 2026 one. */
const ADJUSTED = `${LAW} art. 60 al. 1 and 2 (p. 31)`;

export const AMOUNTS_2026: VdAmounts = {
  publicTransport: null,
  otherTransport: null,
  car: {
    value: { perKm: 75, kmLimit: 15_000, abovePerKm: 35 },
    source: `${TABLE} (code 140, voiture)`,
  },
  yearDays: {
    value: AMOUNTS_2025.yearDays.value,
    source: AMOUNTS_2025.yearDays.source,
    carriedFrom: 2025,
  },
  meals: {
    value: { perYear: 320_000, halfPerYear: 160_000 },
    source: `${TABLE} (code 150)`,
  },
  professionalFlat: {
    value: { rateBp: 300, min: 200_000, max: 400_000 },
    source: `${TABLE} (code 160)`,
  },
  sideJobFlat: {
    value: { rateBp: 2_000, min: 80_000, max: 240_000 },
    source: `${TABLE} (code 165)`,
  },
  twoEarner: {
    value: 170_000,
    source: `${TABLE} (code 235); ${LAW} art. 37 al. 2 (p. 24)`,
  },
  insurance: {
    value: { single: 500_000, married: 990_000, perChild: 130_000 },
    source: `${TABLE} (code 300); ${LAW} art. 37 al. 1 lit. g (p. 23)`,
  },
  pillar3a: {
    value: { withFund: 725_800, withoutFundMax: 3_628_800, withoutFundShareBp: 2_000 },
    source: `${TABLE} (code 310); ${LAW} art. 37 al. 1 lit. e (p. 22)`,
  },
  savingsInterest: {
    value: { single: 160_000, married: 330_000, perChild: 30_000 },
    source: `${TABLE} (code 480); ${LAW} art. 37 al. 1 lit. g (p. 23)`,
  },
  debtInterestExtra: {
    value: 5_000_000,
    source: `${LAW} art. 37 al. 1 lit. a (p. 22)`,
  },
  training: {
    value: 1_200_000,
    source: `${TABLE} (code 618); ${LAW} art. 37 al. 1 lit. l (p. 24)`,
  },
  party: {
    value: 1_010_000,
    source: `${TABLE} (code 620); ${LAW} art. 37 al. 1 lit. j (p. 23)`,
  },
  childcare: {
    value: { perChild: 1_520_000, sharedPerParent: 750_000 },
    source: `${TABLE} (code 670); ${LAW} art. 37 al. 1 lit. k (p. 24); vd-na-law-rifam art. 4 al. 2 (p. 2)`,
  },
  housing: {
    value: { max: 680_000, incomeShareBp: 2_000 },
    source: `${TABLE} (code 660); ${LAW} art. 39 al. 1 (p. 24)`,
  },
  rentCap: {
    value: AMOUNTS_2025.rentCap.value,
    source: `${AMOUNTS_2025.rentCap.source}; ${LAW} art. 39 al. 2 (p. 25); ${ADJUSTED}`,
    floorOnly: true,
  },
  modest: {
    value: { base: 1_700_000, spouse: 570_000, singleParent: 320_000, perChild: 350_000 },
    source: `${TABLE} (code 695); ${LAW} art. 42 (p. 25)`,
  },
  medicalThresholdBp: {
    value: 500,
    source: `${LAW} art. 37 al. 1 lit. h (p. 23); ${TABLE} (code 710)`,
  },
  donations: {
    value: { shareBp: 2_000, min: 10_000 },
    source: `${LAW} art. 37 al. 1 lit. i (p. 23); ${TABLE} (code 720)`,
  },
  family: {
    value: {
      married: 130_000,
      singleParent: 280_000,
      perChild: 100_000,
      limit: 12_640_000,
      step: 210_000,
      upper: 16_420_000,
      upperStep: 100_000,
      cut: 10_000,
    },
    source: `vd-2026-deductions p. 2 (déduction pour famille); ${TABLE} (code 725); ${LAW} art. 42a (p. 25 and 26)`,
  },
  quotientCap: {
    value: AMOUNTS_2025.quotientCap.value,
    source: `${AMOUNTS_2025.quotientCap.source}; ${LAW} art. 43 al. 3 (p. 26); ${ADJUSTED}`,
    floorOnly: true,
  },
  furniture: {
    value: AMOUNTS_2025.furniture.value,
    source: `${AMOUNTS_2025.furniture.source}; ${LAW} art. 54 al. 2 (p. 29); ${ADJUSTED}`,
    floorOnly: true,
  },
  wealthFree: {
    value: { single: 6_000_000, married: 12_000_000 },
    source: `vd-2026-deductions p. 2; ${LAW} art. 58 (p. 30)`,
  },
};
