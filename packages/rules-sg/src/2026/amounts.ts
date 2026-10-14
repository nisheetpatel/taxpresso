// St. Gallen deduction amounts, tax year 2026. No 2026 guide (Wegleitung) is published yet: every
// value is read in the 2026 law, the ordinance, the Steuerbuch chapter dated 1 January 2026, the
// 2026 changes listed in Merkblatt 8, or, where the ordinance adopts the federal flat rates, the
// federal circular of the year:
// - sg-2026-law-steuergesetz: the tax law (StG, sGS 811.1), Stand 1 January 2026;
// - sg-na-law-steuerverordnung: the ordinance (StV, sGS 811.11), Stand 1 January 2024, in force for
//   2025 and 2026;
// - sg-na-deductions-fahrt-arbeitsort: Steuerbuch StB 39 Nr. 3, Stand 1 January 2026;
// - sg-2026-guide-merkblatt-unterjaehrig: Merkblatt 8 (2026), section 11, the changes from 2025;
// - ch-2026-ifd-progression-deductions: the ESTV circular with the federal amounts for 2026, which
//   StV Art. 19 (meals) and Art. 22 (side job) adopt, and ch-2026-ifd-instructions-personnes-
//   physiques for the federal pillar 3a limits.
// The flat amount for professional training without proof (CHF 400 in 2025) is printed only in the
// 2025 guide: for 2026 it is null and not applied.
import type { SgAmounts } from '../amounts.js';

const LAW = 'sg-2026-law-steuergesetz';
const ORD = 'sg-na-law-steuerverordnung';
const MB8 = 'sg-2026-guide-merkblatt-unterjaehrig p. 4';
const FED = 'ch-2026-ifd-progression-deductions';

export const AMOUNTS_2026: SgAmounts = {
  travel: {
    value: { max: 800_000, bikePerYear: 70_000, carPerKm: 75 },
    source: `${LAW} Art. 39 Abs. 1 lit. a (p. 20); ${ORD} Art. 18 Abs. 1bis (p. 5); sg-na-deductions-fahrt-arbeitsort p. 3 (Ziff. 2.5: Fr. 700 im Jahr, 75 Rappen je Fahrkilometer) and p. 4 (Ziff. 3: 2026, Fr. 8’000); ${MB8} (10. Kilometeransatz: 75 Rappen)`,
  },
  meals: {
    value: { perDay: 1_500, perYear: 320_000, halfPerDay: 750, halfPerYear: 160_000 },
    source: `${ORD} Art. 19 Abs. 1 and 2 (p. 6: nach den für die direkte Bundessteuer massgebenden Pauschalansätzen); ${FED} p. 2 (Frais supplémentaires pour les repas pris à l’extérieur, 2026)`,
  },
  otherFlat: {
    value: { base: 70_000, rateBp: 1_000, max: 240_000 },
    source: `${ORD} Art. 21 Abs. 1 and 2 (p. 6)`,
  },
  sideJob: {
    value: { rateBp: 2_000, min: 80_000, max: 240_000 },
    source: `${ORD} Art. 22 Abs. 1 (p. 7: nach den für die direkte Bundessteuer massgebenden Pauschalansätzen); ${FED} p. 2 (Activité accessoire, 2026: min. 800, max. 2’400); ch-2026-ifd-instructions-personnes-physiques p. 7 (Activité accessoire: 20 %)`,
  },
  debtInterestExtra: {
    value: 5_000_000,
    source: `${LAW} Art. 45 Abs. 1 lit. a (p. 23)`,
  },
  pillar3a: {
    value: { withFund: 725_800, withoutFundMax: 3_628_800, withoutFundShareBp: 2_000 },
    source: `${LAW} Art. 45 Abs. 1 lit. e (p. 23); ch-2026-ifd-instructions-personnes-physiques p. 7 (chiffre 13)`,
  },
  insurance: {
    value: {
      married: 680_000,
      other: 340_000,
      marriedExtra: 110_000,
      otherExtra: 50_000,
      perChild: 110_000,
    },
    source: `${LAW} Art. 45 Abs. 1 lit. g (p. 23)`,
  },
  childcare: {
    value: 2_680_000,
    source: `${LAW} Art. 45 Abs. 1 lit. h (p. 24); ${MB8} (16.2 Kinderbetreuungskosten, neu max. Fr. 26’800)`,
  },
  party: {
    value: { married: 2_140_000, other: 1_070_000 },
    source: `${LAW} Art. 45 Abs. 1 lit. i (p. 24)`,
  },
  training: {
    value: { max: 1_300_000, flat: null },
    source: `${LAW} Art. 45 Abs. 1 lit. j (p. 24)`,
  },
  twoEarner: {
    value: 50_000,
    source: `${LAW} Art. 45 Abs. 2 (p. 24)`,
  },
  medicalThresholdBp: {
    value: 200,
    source: `${LAW} Art. 46 Abs. 1 lit. a (p. 24)`,
  },
  donations: {
    value: { min: 10_000, shareBp: 2_000 },
    source: `${LAW} Art. 46 Abs. 1 lit. c (p. 25)`,
  },
  child: {
    value: {
      preschool: 760_000,
      school: 1_080_000,
      educationMax: 1_380_000,
      educationExcess: 320_000,
    },
    source: `${LAW} Art. 48 Abs. 1 lit. a Ziff. 1 to 3 (p. 25 and 26); ${MB8} (23.3 Ausbildungskosten pro Kind, neu max. Fr. 13’800); sg-2026-guide-merkblatt-unterjaehrig p. 3 (Kinderabzug für ganzes Kalenderjahr Fr. 10’800)`,
  },
  wealthFree: {
    value: { perTaxpayer: 7_500_000, perChild: 2_000_000 },
    source: `${LAW} Art. 64 Abs. 1 (p. 29)`,
  },
};
