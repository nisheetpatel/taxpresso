// Fribourg deduction amounts, tax year 2026. The 2026 guide is not published yet, but every amount
// below is set by a text in force in 2026, read in the documents cited next to it:
// - fr-2025-law-licd-consolidee: the tax law (LICD) in the version in force from 1 January 2025; the
//   BDLF lists no later version, so it governs 2026 (docs/sources/fr/manifest.json);
// - fr-na-deductions-frais-professionnels and fr-na-deductions-primes-assurance: the two ordinances,
//   in force since 2023 and 2021 and current;
// - fr-2026-bases-calcul-cantonales: the SCC's 2026 overview of the source-tax bases, which prints
//   the same amounts for 2026 where it lists them;
// - fr-2026-deductions-enfants-calculette: the SCC's calculator of the child deduction for 2026;
// - ch-2026-ifd-instructions-personnes-physiques: the federal pillar 3a limits for 2026, which the
//   LICD adopts (art. 34 al. 1 let. e).
import type { FrAmounts } from '../amounts.js';

const LAW = 'fr-2025-law-licd-consolidee';
const COSTS = 'fr-na-deductions-frais-professionnels';
const BASES = 'fr-2026-bases-calcul-cantonales p. 1';

export const AMOUNTS_2026: FrAmounts = {
  travelMax: {
    value: 1_200_000,
    source: `${LAW} art. 27 al. 1 let. a (p. 19); ${COSTS} art. 3 al. 1 (p. 2)`,
  },
  bikePerYear: {
    value: 70_000,
    source: `${COSTS} art. 3 al. 2 let. b (p. 2)`,
  },
  vehicle: {
    value: {
      car: [
        [10_000, 70],
        [20_000, 60],
        [Number.POSITIVE_INFINITY, 50],
      ],
      motorbikePerKm: 40,
    },
    source: `${COSTS} art. 3 al. 3 (p. 2)`,
  },
  yearDays: {
    value: 220,
    source: `${COSTS} art. 1 al. 6 (p. 1), art. 7 al. 2 (p. 4)`,
  },
  meals: {
    value: { perDay: 1_500, perYear: 320_000, halfPerDay: 750, halfPerYear: 160_000 },
    source: `${COSTS} art. 4 al. 1 let. b and c (p. 3); ${BASES} (surplus pour repas)`,
  },
  professionalFlat: {
    value: { rateBp: 300, min: 200_000, max: 400_000 },
    source: `${COSTS} art. 6 al. 1 (p. 4); ${BASES} (déduction forfaitaire)`,
  },
  sideJobFlat: {
    value: { rateBp: 2_000, min: 80_000, max: 240_000 },
    source: `${COSTS} art. 9 al. 1 (p. 5)`,
  },
  twoEarner: {
    value: 50_000,
    source: `${LAW} art. 34 al. 2 (p. 24); ${BASES} (déduction pour activité du conjoint)`,
  },
  health: {
    value: { adult: 481_000, young: 421_000, child: 114_000 },
    source: `fr-na-deductions-primes-assurance art. 1 al. 1 and 2 (p. 1 and 2); ${LAW} art. 34 al. 1 let. g ch. 1.1 (p. 23); ${BASES} (primes d'assurances)`,
  },
  lifeInsurance: {
    value: { married: 150_000, other: 75_000 },
    source: `${LAW} art. 34 al. 1 let. g ch. 1.2 (p. 23)`,
  },
  savingsInterest: {
    value: { married: 30_000, other: 15_000 },
    source: `${LAW} art. 34 al. 1 let. g ch. 1.3 (p. 23)`,
  },
  pillar3a: {
    value: { withFund: 725_800, withoutFundMax: 3_628_800, withoutFundShareBp: 2_000 },
    source: `${LAW} art. 34 al. 1 let. e (p. 23); ch-2026-ifd-instructions-personnes-physiques p. 7 (chiffre 13)`,
  },
  debtInterestExtra: {
    value: 5_000_000,
    source: `${LAW} art. 34 al. 1 let. a (p. 22)`,
  },
  childcare: {
    value: 1_200_000,
    source: `${LAW} art. 34 al. 3 (p. 24)`,
  },
  party: {
    value: 500_000,
    source: `${LAW} art. 34 al. 1 let. i (p. 24)`,
  },
  training: {
    value: 1_200_000,
    source: `${LAW} art. 34 al. 1 let. j (p. 24)`,
  },
  medicalThresholdBp: {
    value: 500,
    source: `${LAW} art. 34 al. 1 let. h (p. 24)`,
  },
  donations: {
    value: { shareBp: 2_000, min: 10_000 },
    source: `${LAW} art. 34a (p. 25)`,
  },
  children: {
    value: {
      first: 860_000,
      fromThird: 960_000,
      minFirst: 710_000,
      minFromThird: 810_000,
      limit: 6_270_000,
      perChild: 1_010_000,
      cut: 10_000,
      step: 100_000,
    },
    source: `${LAW} art. 36 al. 1 let. a (p. 25); fr-2026-deductions-enfants-calculette sheet Paramètres (B34 to B41); ${BASES} (déduction pour enfants)`,
  },
  modest: {
    value: {
      single: { amount: 410_000, limit: 2_030_000, cut: 20_000, step: 100_000 },
      charges: { amount: 510_000, limit: 2_430_000, cut: 20_000, step: 100_000 },
      avsSingle: { amount: 910_000, limit: 2_430_000, cut: 30_000, step: 100_000 },
      avsCharges: { amount: 1_110_000, limit: 3_030_000, cut: 40_000, step: 100_000 },
    },
    source: `${LAW} art. 36 al. 2 let. a to d (p. 26 and 27); ${BASES} (déduction pour revenu modeste)`,
  },
  wealthDeduction: {
    value: {
      family: { amount: 10_500_000, limit: 12_500_000, cut: 2_000_000, step: 3_500_000 },
      single: { amount: 5_500_000, limit: 7_500_000, cut: 1_000_000, step: 2_500_000 },
    },
    source: `${LAW} art. 61 al. 1 and 2 (p. 37)`,
  },
};
