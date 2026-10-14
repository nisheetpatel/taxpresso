// Zurich deduction amounts, tax year 2025. Every value is read in the document cited next to it:
// - zh-2025-law-steuergesetz-631-1-stand-2025: the Steuergesetz in force on 1 January 2025
//   (§ 26, § 31, § 32, § 34; page of the PDF given);
// - zh-2025-deductions-berufsauslagen-631-33: the professional-costs flat rates from tax period
//   2024 (Verfügung of 3 October 2023);
// - zh-2025-guide-natuerliche-personen and the 2025 schedules (Berufsauslagen, Versicherungs-
//   prämien), which print the same amounts.
import type { ZhAmounts } from '../amounts.js';

const LAW = 'zh-2025-law-steuergesetz-631-1-stand-2025';
const FLAT = 'zh-2025-deductions-berufsauslagen-631-33';
const GUIDE = 'zh-2025-guide-natuerliche-personen';

export const AMOUNTS_2025: ZhAmounts = {
  commuteMax: {
    value: 520_000,
    source: `${LAW} § 26 Abs. 1 lit. a (p. 14); ${FLAT} p. 2 (Ziff. I.1); ${GUIDE} p. 13`,
  },
  commuteBike: { value: 70_000, source: `${FLAT} p. 1 (Ziff. I.1 lit. b)` },
  commuteKm: { value: { car: 70, motorbike: 40 }, source: `${FLAT} p. 2 (Ziff. I.1)` },
  commuteDays: { value: 240, source: 'zh-2025-form-berufsauslagen p. 1 (Ziffer 1.3)' },
  meals: {
    value: { perDay: 1_500, perYear: 320_000, halfPerDay: 750, halfPerYear: 160_000 },
    source: `${FLAT} p. 2 (Ziff. I.2 lit. a); ${GUIDE} p. 13`,
  },
  professionalFlat: {
    value: { rateBp: 300, min: 200_000, max: 400_000 },
    source: `${FLAT} p. 3 (Ziff. I.3); ${GUIDE} p. 14`,
  },
  sideJobFlat: {
    value: { rateBp: 2000, min: 80_000, max: 240_000 },
    source: `${FLAT} p. 3 (Ziff. I.4); ${GUIDE} p. 14`,
  },
  pillar3a: {
    value: { withFund: 725_800, withoutFundMax: 3_628_800, withoutFundShareBp: 2000 },
    source: `zh-na-deductions-merkblatt-saeule-3a p. 1 (ab 2025); ${GUIDE} p. 15 (Ziffer 14)`,
  },
  insurance: {
    value: { married: 580_000, other: 290_000, noPensionBp: 15_000, perChild: 130_000 },
    source: `${LAW} § 31 Abs. 1 lit. g (p. 17 and 18); zh-2025-deductions-form-versicherungspraemien p. 1 (B); ${GUIDE} p. 15 and 16`,
  },
  childcareMax: {
    value: 2_500_000,
    source: `${LAW} § 31 Abs. 1 lit. j (p. 18); ${GUIDE} p. 18 (Ziffer 16.6)`,
  },
  trainingMax: { value: 1_240_000, source: `${LAW} § 31 Abs. 1 lit. k (p. 18); ${GUIDE} p. 16` },
  partyMax: {
    value: { married: 2_060_000, other: 1_030_000 },
    source: `${LAW} § 31 Abs. 1 lit. h (p. 18); ${GUIDE} p. 17`,
  },
  twoEarner: { value: 610_000, source: `${LAW} § 31 Abs. 2 (p. 18); ${GUIDE} p. 18 (Ziffer 17)` },
  debtInterestExtra: {
    value: 5_000_000,
    source: `${LAW} § 31 Abs. 1 lit. a (p. 17); ${GUIDE} p. 14`,
  },
  medicalThresholdBp: { value: 500, source: `${LAW} § 32 lit. a (p. 19); ${GUIDE} p. 19` },
  donations: {
    value: { min: 10_000, shareBp: 2000 },
    source: `${LAW} § 32 lit. b (p. 19); ${GUIDE} p. 19`,
  },
  child: { value: 930_000, source: `${LAW} § 34 Abs. 1 lit. a (p. 19); ${GUIDE} p. 20` },
};
