// Ticino amounts, tax year 2025. Every value is read in the documents cited next to it:
// - ti-2025-tariff-decreto-esecutivo-pf: the executive decree on natural persons for 2025 (BU
//   36/2024; the PDF's pages 1 to 8 are the BU's pages 268 to 275): professional costs (art. 3 to
//   8) and, in its annex, the 2025 amounts of the tax law it rewrites (LT art. 32, 32a, 34, 35);
// - ti-2025-guide-istruzioni-pf-pdf: the instructions for the 2025 return (the PDF's pages are the
//   printed page numbers), which give the same amounts line by line, and the deduction table on
//   p. 50 (also ti-2025-deductions-table);
// - ti-na-law-lt-640-100: the tax law (LT), consolidated text in force on 1 January 2026, for the
//   articles not changed in 2025 or 2026 (its notes give each article's last change);
// - ti-2025-form-modulo-4 and ti-2025-form-modulo-6: the 2025 forms.
import type { TiAmounts } from '../amounts.js';

const DECREE = 'ti-2025-tariff-decreto-esecutivo-pf';
const GUIDE = 'ti-2025-guide-istruzioni-pf-pdf';
const TABLE = 'ti-2025-deductions-table';
const LAW = 'ti-na-law-lt-640-100';

export const AMOUNTS_2025: TiAmounts = {
  commute: {
    value: { bikeMax: 70_000, carPerKm: 60, motorbikePerKm: 40 },
    source: `${DECREE} art. 3 cpv. 1 lett. b and cpv. 2 (p. 1); ${GUIDE} p. 23 (2.2, 2.3); ${TABLE} p. 1 (9, spese trasporto)`,
  },
  commuteMaxDays: {
    value: 220,
    source: `${GUIDE} p. 23 (massimo di 220 giorni lavorativi all’anno); ti-2025-form-modulo-4 p. 1 (max. 220 giorni lavorativi con un impiego al 100%)`,
  },
  meals: {
    value: { perDay: 1_500, perYear: 320_000, reducedPerDay: 750, reducedPerYear: 160_000 },
    source: `${DECREE} art. 4 cpv. 2 lett. a and cpv. 3 (p. 2); ${GUIDE} p. 24 (3.1); ti-2025-form-modulo-4 p. 1 (3.1)`,
  },
  otherFlat: {
    value: { amount: 300_000, halfBelowRate: 50, halfBelowMonths: 6 },
    source: `${DECREE} art. 7 cpv. 2 and 3 (p. 3); ${GUIDE} p. 25 (5.1, 5.2); ti-2025-form-modulo-4 p. 1 (5.1 Forfait: Fr. 3’000.-)`,
  },
  sideJobFlat: {
    value: 80_000,
    source: `${DECREE} art. 8 cpv. 1 (p. 3); ${GUIDE} p. 25 (6. Spese per attività accessoria dipendente)`,
  },
  pillar3a: {
    value: { withFund: 725_800, withoutFundMax: 3_628_800, withoutFundShareBp: 2_000 },
    source: `${GUIDE} p. 25 (11.); ${TABLE} p. 1 (11); ${LAW} art. 32 cpv. 1 lett. e`,
  },
  insurance: {
    value: {
      married: 1_090_000,
      other: 550_000,
      marriedNoPension: 450_000,
      otherNoPension: 230_000,
      perChild: 120_000,
    },
    source: `${DECREE} p. 6 (art. 32 cpv. 1 lett. g); ${LAW} art. 32 cpv. 1bis; ${GUIDE} p. 26 (12.); ti-2025-form-modulo-6 p. 1 (2.)`,
  },
  debtInterestExtra: {
    value: 5_000_000,
    source: `${LAW} art. 32 cpv. 1 lett. a; ${GUIDE} p. 27 (13.2)`,
  },
  party: {
    value: 1_060_000,
    source: `${DECREE} p. 6 (art. 32 cpv. 1 lett. m); ${GUIDE} p. 29 (15.2)`,
  },
  training: {
    value: 1_070_000,
    source: `${DECREE} p. 6 (art. 32 cpv. 1 lett. n); ${GUIDE} p. 29 (15.3, 15.4); ti-2025-form-modulo-1-de p. 3 (Ziffer 15.3, 15.4)`,
  },
  twoEarner: {
    value: 810_000,
    source: `${DECREE} p. 6 (art. 32 cpv. 2); ${GUIDE} p. 29 (15.5)`,
  },
  childcare: {
    value: 2_620_000,
    source: `${DECREE} p. 6 (art. 32a); ${GUIDE} p. 29 (20.)`,
  },
  medicalThresholdBp: {
    value: 500,
    source: `${LAW} art. 32b; ${GUIDE} p. 30 (22.1); ti-2025-form-modulo-6 p. 2 (franchigia fiscale: 5% del reddito netto intermedio II)`,
  },
  donations: {
    value: { shareBp: 2_000, min: 10_000 },
    source: `${LAW} art. 32c cpv. 1; ${GUIDE} p. 30 (24.)`,
  },
  child: {
    value: 1_150_000,
    source: `${DECREE} p. 6 (art. 34 cpv. 1 lett. a); ${GUIDE} p. 30 (25.1)`,
  },
  avsExemption: {
    value: {
      amount: 800_000,
      singleUpTo: 2_100_000,
      familyUpTo: 2_700_000,
      step: 300_000,
      reduction: 100_000,
    },
    source: `${LAW} art. 34 cpv. 2; ${GUIDE} p. 32 (27. Quota esente per beneficiari AVS-AI)`,
  },
  wealthDeductions: {
    value: { married: 6_000_000, perMinorChild: 3_000_000 },
    source: `${LAW} art. 48; ${GUIDE} p. 36 (35. Deduzioni sociali)`,
  },
  coefficient: {
    value: 10_000,
    source: `${GUIDE} p. 51 (coefficiente d’imposta cantonale pari al 100%); ${LAW} art. 1a cpv. 2, art. 1b cpv. 1, art. 300a cpv. 1`,
  },
  personalTax: {
    value: 4_000,
    source: `${LAW} art. 290 cpv. 1 to 3; ${GUIDE} p. 49 (Imposta comunale 2025, compresa quella personale)`,
  },
};
