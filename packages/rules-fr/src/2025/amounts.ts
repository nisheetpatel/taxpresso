// Fribourg deduction amounts, tax year 2025. Every value is read in the documents cited next to it:
// - fr-2025-law-licd-consolidee: the tax law (LICD) in the version in force from 1 January 2025;
// - fr-na-deductions-frais-professionnels: the finance department's ordinance on employees'
//   professional costs (in force since 2023);
// - fr-na-deductions-primes-assurance: the Conseil d'Etat's ordinance on the health and accident
//   insurance deduction (in force since 2021, applies from tax year 2021 on);
// - fr-2025-guide-instructions-generales: the general instructions for the 2025 return; "p." is the
//   page of the PDF file, which prints one less;
// - fr-2025-deductions-enfants-calculette: the SCC's calculator of the child deduction for 2025.
import type { FrAmounts } from '../amounts.js';

const LAW = 'fr-2025-law-licd-consolidee';
const COSTS = 'fr-na-deductions-frais-professionnels';
const GUIDE = 'fr-2025-guide-instructions-generales';

export const AMOUNTS_2025: FrAmounts = {
  travelMax: {
    value: 1_200_000,
    source: `${LAW} art. 27 al. 1 let. a (p. 19); ${COSTS} art. 3 al. 1 (p. 2); ${GUIDE} p. 11 (code 2.110)`,
  },
  bikePerYear: {
    value: 70_000,
    source: `${COSTS} art. 3 al. 2 let. b (p. 2); ${GUIDE} p. 11 (code 2.110)`,
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
    source: `${COSTS} art. 3 al. 3 (p. 2); ${GUIDE} p. 11 (code 2.110)`,
  },
  yearDays: {
    value: 220,
    source: `${COSTS} art. 1 al. 6 (p. 1), art. 7 al. 2 (p. 4); ${GUIDE} p. 12 (code 2.110)`,
  },
  meals: {
    value: { perDay: 1_500, perYear: 320_000, halfPerDay: 750, halfPerYear: 160_000 },
    source: `${COSTS} art. 4 al. 1 let. b and c (p. 3); ${GUIDE} p. 12 (code 2.120)`,
  },
  professionalFlat: {
    value: { rateBp: 300, min: 200_000, max: 400_000 },
    source: `${COSTS} art. 6 al. 1 (p. 4); ${GUIDE} p. 13 (code 2.130)`,
  },
  sideJobFlat: {
    value: { rateBp: 2_000, min: 80_000, max: 240_000 },
    source: `${COSTS} art. 9 al. 1 (p. 5); ${GUIDE} p. 13 (code 2.140)`,
  },
  twoEarner: {
    value: 50_000,
    source: `${LAW} art. 34 al. 2 (p. 24); ${GUIDE} p. 14 (code 2.510)`,
  },
  health: {
    value: { adult: 481_000, young: 421_000, child: 114_000 },
    source: `fr-na-deductions-primes-assurance art. 1 al. 1 and 2 (p. 1 and 2); ${LAW} art. 34 al. 1 let. g ch. 1.1 (p. 23); ${GUIDE} p. 24 (code 4.110)`,
  },
  lifeInsurance: {
    value: { married: 150_000, other: 75_000 },
    source: `${LAW} art. 34 al. 1 let. g ch. 1.2 (p. 23); ${GUIDE} p. 24 (code 4.120)`,
  },
  savingsInterest: {
    value: { married: 30_000, other: 15_000 },
    source: `${LAW} art. 34 al. 1 let. g ch. 1.3 (p. 23); ${GUIDE} p. 26 (code 4.150)`,
  },
  pillar3a: {
    value: { withFund: 725_800, withoutFundMax: 3_628_800, withoutFundShareBp: 2_000 },
    source: `${GUIDE} p. 25 (code 4.130); ${LAW} art. 34 al. 1 let. e (p. 23)`,
  },
  debtInterestExtra: {
    value: 5_000_000,
    source: `${LAW} art. 34 al. 1 let. a (p. 22); ${GUIDE} p. 26 and 27 (code 4.210)`,
  },
  childcare: {
    value: 1_200_000,
    source: `${LAW} art. 34 al. 3 (p. 24); ${GUIDE} p. 32 (code 4.380)`,
  },
  party: {
    value: 500_000,
    source: `${LAW} art. 34 al. 1 let. i (p. 24); ${GUIDE} p. 33 (code 4.410)`,
  },
  training: {
    value: 1_200_000,
    source: `${LAW} art. 34 al. 1 let. j (p. 24); ${GUIDE} p. 33 (code 4.420)`,
  },
  medicalThresholdBp: {
    value: 500,
    source: `${LAW} art. 34 al. 1 let. h (p. 24); ${GUIDE} p. 33 (code 5.110)`,
  },
  donations: {
    value: { shareBp: 2_000, min: 10_000 },
    source: `${LAW} art. 34a (p. 25); ${GUIDE} p. 34 (code 5.120)`,
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
    source: `${LAW} art. 36 al. 1 let. a (p. 25); ${GUIDE} p. 34 and 35 (code 6.110); fr-2025-deductions-enfants-calculette sheet Paramètres (B34 to B41)`,
  },
  modest: {
    value: {
      single: { amount: 410_000, limit: 2_030_000, cut: 20_000, step: 100_000 },
      charges: { amount: 510_000, limit: 2_430_000, cut: 20_000, step: 100_000 },
      avsSingle: { amount: 910_000, limit: 2_430_000, cut: 30_000, step: 100_000 },
      avsCharges: { amount: 1_110_000, limit: 3_030_000, cut: 40_000, step: 100_000 },
    },
    source: `${LAW} art. 36 al. 2 let. a to d (p. 26 and 27); ${GUIDE} p. 37 and 38 (code 7.110)`,
  },
  wealthDeduction: {
    value: {
      family: { amount: 10_500_000, limit: 12_500_000, cut: 2_000_000, step: 3_500_000 },
      single: { amount: 5_500_000, limit: 7_500_000, cut: 1_000_000, step: 2_500_000 },
    },
    source: `${LAW} art. 61 al. 1 and 2 (p. 37); ${GUIDE} p. 39 (code 7.110)`,
  },
};
