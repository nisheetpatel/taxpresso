// St. Gallen deduction amounts, tax year 2025. Every value is read in the documents cited next to it:
// - sg-2025-law-steuergesetz: the tax law (StG, sGS 811.1), Stand 1 January 2025;
// - sg-na-law-steuerverordnung: the ordinance (StV, sGS 811.11), Stand 1 January 2024, in force for
//   2025 and 2026;
// - sg-2025-guide-wegleitung: the guide to the 2025 return (its printed page numbers are the PDF's),
//   p. 4 the summary of the 2025 amounts, the same table as sg-2025-guide-kurzuebersicht;
// - sg-2025-form-berufskosten, sg-2025-form-versicherungspraemien-krankheitskosten: the 2025 forms 4
//   and 6, which print the amounts too.
import type { SgAmounts } from '../amounts.js';

const LAW = 'sg-2025-law-steuergesetz';
const ORD = 'sg-na-law-steuerverordnung';
const GUIDE = 'sg-2025-guide-wegleitung';
const SUMMARY = 'sg-2025-guide-kurzuebersicht p. 1';

export const AMOUNTS_2025: SgAmounts = {
  travel: {
    value: { max: 800_000, bikePerYear: 70_000, carPerKm: 70 },
    source: `${LAW} Art. 39 Abs. 1 lit. a (p. 20); ${ORD} Art. 18 Abs. 1bis (p. 5); ${GUIDE} p. 23 (1. Fahrkosten: Maximalabzug Fr. 8’000; 1.2 Fahrrad bis zu Fr. 700; 1.3 70 Rappen je Fahrkilometer); ${SUMMARY} (10.1 1.2, 1.3); sg-2025-form-berufskosten p. 1 (1.3 km x Fr. 0.70; max. Fr. 8’000)`,
  },
  meals: {
    value: { perDay: 1_500, perYear: 320_000, halfPerDay: 750, halfPerYear: 160_000 },
    source: `${ORD} Art. 19 Abs. 1 and 2 (p. 6); ${GUIDE} p. 24 (2.1 and 2.2); ${SUMMARY} (10.2); sg-2025-form-berufskosten p. 1 (2.1, 2.2)`,
  },
  otherFlat: {
    value: { base: 70_000, rateBp: 1_000, max: 240_000 },
    source: `${ORD} Art. 21 Abs. 1 and 2 (p. 6); ${GUIDE} p. 24 (3.1); ${SUMMARY} (10.3); sg-2025-form-berufskosten p. 1 (3.1)`,
  },
  sideJob: {
    value: { rateBp: 2_000, min: 80_000, max: 240_000 },
    source: `${ORD} Art. 22 Abs. 1 (p. 7); ${GUIDE} p. 25 (5.); ${SUMMARY} (10.5); sg-2025-form-berufskosten p. 1 (5.1)`,
  },
  debtInterestExtra: {
    value: 5_000_000,
    source: `${LAW} Art. 45 Abs. 1 lit. a (p. 23); ${GUIDE} p. 25 (11. Schuldzinsen)`,
  },
  pillar3a: {
    value: { withFund: 725_800, withoutFundMax: 3_628_800, withoutFundShareBp: 2_000 },
    source: `${LAW} Art. 45 Abs. 1 lit. e (p. 23); ${GUIDE} p. 26 (13.1); ${SUMMARY} (13.1)`,
  },
  insurance: {
    value: {
      married: 680_000,
      other: 340_000,
      marriedExtra: 110_000,
      otherExtra: 50_000,
      perChild: 110_000,
    },
    source: `${LAW} Art. 45 Abs. 1 lit. g (p. 23); ${GUIDE} p. 27 (14.); ${SUMMARY} (14.); sg-2025-form-versicherungspraemien-krankheitskosten p. 1 (B. a to c)`,
  },
  childcare: {
    value: 2_670_000,
    source: `${LAW} Art. 45 Abs. 1 lit. h (p. 24); ${GUIDE} p. 28 (16.2); ${SUMMARY} (16.2)`,
  },
  party: {
    value: { married: 2_140_000, other: 1_070_000 },
    source: `${LAW} Art. 45 Abs. 1 lit. i (p. 24); ${GUIDE} p. 28 (16.3); ${SUMMARY} (16.3)`,
  },
  training: {
    value: { max: 1_300_000, flat: 40_000 },
    source: `${LAW} Art. 45 Abs. 1 lit. j (p. 24); ${GUIDE} p. 28 (16.4) and p. 29 (pauschal Fr. 400 für die Kantons- und Gemeindesteuern); ${SUMMARY} (16.4)`,
  },
  twoEarner: {
    value: 50_000,
    source: `${LAW} Art. 45 Abs. 2 (p. 24); ${GUIDE} p. 29 (17.); ${SUMMARY} (17.)`,
  },
  medicalThresholdBp: {
    value: 200,
    source: `${LAW} Art. 46 Abs. 1 lit. a (p. 24); ${GUIDE} p. 29 (21.1); ${SUMMARY} (21.1)`,
  },
  donations: {
    value: { min: 10_000, shareBp: 2_000 },
    source: `${LAW} Art. 46 Abs. 1 lit. c (p. 25); ${GUIDE} p. 30 (21.3); ${SUMMARY} (21.3)`,
  },
  child: {
    value: {
      preschool: 760_000,
      school: 1_080_000,
      educationMax: 1_370_000,
      educationExcess: 320_000,
    },
    source: `${LAW} Art. 48 Abs. 1 lit. a Ziff. 1 to 3 (p. 25 and 26); ${GUIDE} p. 31 (23.1 to 23.3); ${SUMMARY} (23.1 to 23.3)`,
  },
  wealthFree: {
    value: { perTaxpayer: 7_500_000, perChild: 2_000_000 },
    source: `${LAW} Art. 64 Abs. 1 (p. 29); ${GUIDE} p. 34 (36.); ${SUMMARY} (36.); sg-2025-form-steuererklaerung p. 4 (36.1 to 36.3)`,
  },
};
