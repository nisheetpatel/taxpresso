// Zurich deduction amounts, tax year 2026. Every value is read in the document cited next to it:
// - zh-2026-law-steuergesetz-631-1-stand-2026: the Steuergesetz in force on 1 April 2026, with
//   the amounts indexed from 1 January 2026 (StG footnote 113) and those left unchanged;
// - zh-2026-deductions-berufsauslagen-631-33: the professional-costs flat rates from tax period
//   2026 (Verfügung of 26 September 2025; the car rises to 75 centimes per km);
// - the 2026 schedules (Berufsauslagen, Versicherungsprämien). The full-year 2026 guide is not
//   published yet; the 2026 guide for a liability ending in the year (zh-2026-guide-unterjaehrig)
//   prints the same amounts.
// - pillar 3a: the federal 2026 instructions (ch-2026-ifd-instructions-personnes-physiques), which
//   the Zurich Merkblatt (ZStB 31.1, "ab 2025") repeats; never carried over from 2025.
import type { ZhAmounts } from '../amounts.js';

const LAW = 'zh-2026-law-steuergesetz-631-1-stand-2026';
const FLAT = 'zh-2026-deductions-berufsauslagen-631-33';
const FORM = 'zh-2026-deductions-form-berufsauslagen';

export const AMOUNTS_2026: ZhAmounts = {
  commuteMax: {
    value: 520_000,
    source: `${LAW} § 26 Abs. 1 lit. a (p. 15); ${FLAT} p. 2 (Ziff. I.1); ${FORM} p. 1`,
  },
  commuteBike: { value: 70_000, source: `${FLAT} p. 1 (Ziff. I.1 lit. b)` },
  commuteKm: { value: { car: 75, motorbike: 40 }, source: `${FLAT} p. 2 (Ziff. I.1)` },
  commuteDays: { value: 240, source: `${FORM} p. 1 (Ziffer 1.3)` },
  meals: {
    value: { perDay: 1_500, perYear: 320_000, halfPerDay: 750, halfPerYear: 160_000 },
    source: `${FLAT} p. 2 (Ziff. I.2 lit. a); ${FORM} p. 1`,
  },
  professionalFlat: {
    value: { rateBp: 300, min: 200_000, max: 400_000 },
    source: `${FLAT} p. 3 (Ziff. I.3); ${FORM} p. 1`,
  },
  sideJobFlat: {
    value: { rateBp: 2000, min: 80_000, max: 240_000 },
    source: `${FLAT} p. 3 (Ziff. I.4)`,
  },
  pillar3a: {
    value: { withFund: 725_800, withoutFundMax: 3_628_800, withoutFundShareBp: 2000 },
    source:
      'ch-2026-ifd-instructions-personnes-physiques p. 7 (chiffre 13); zh-na-deductions-merkblatt-saeule-3a p. 1 (ab 2025)',
  },
  insurance: {
    value: { married: 580_000, other: 290_000, noPensionBp: 15_000, perChild: 130_000 },
    source: `${LAW} § 31 Abs. 1 lit. g (p. 17 and 18); zh-2026-deductions-form-versicherungspraemien p. 1 (B)`,
  },
  childcareMax: {
    value: 2_530_000,
    source: `${LAW} § 31 Abs. 1 lit. j (p. 18); zh-2026-tariff-kalte-progression-ab-2026 p. 2`,
  },
  trainingMax: {
    value: 1_260_000,
    source: `${LAW} § 31 Abs. 1 lit. k (p. 18); zh-2026-tariff-kalte-progression-ab-2026 p. 2`,
  },
  partyMax: {
    value: { married: 2_100_000, other: 1_050_000 },
    source: `${LAW} § 31 Abs. 1 lit. h (p. 18); zh-2026-tariff-kalte-progression-ab-2026 p. 1 and 2`,
  },
  twoEarner: {
    value: 620_000,
    source: `${LAW} § 31 Abs. 2 (p. 19); zh-2026-tariff-kalte-progression-ab-2026 p. 2`,
  },
  debtInterestExtra: { value: 5_000_000, source: `${LAW} § 31 Abs. 1 lit. a (p. 17)` },
  medicalThresholdBp: { value: 500, source: `${LAW} § 32 lit. a (p. 19)` },
  donations: { value: { min: 10_000, shareBp: 2000 }, source: `${LAW} § 32 lit. b (p. 19)` },
  child: {
    value: 940_000,
    source: `${LAW} § 34 Abs. 1 lit. a (p. 20); zh-2026-tariff-kalte-progression-ab-2026 p. 2`,
  },
};
