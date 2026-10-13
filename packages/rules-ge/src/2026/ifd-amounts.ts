// Federal direct tax (IFD), tax year 2026: every deduction the engine uses, next to the scales in
// ./ifd.ts. All money in integer centimes.
// Sources: ch-2026-ifd-progression-deductions (ESTV circular of 11 September 2025), p. 1 and p. 2
// (the table of deductions for 2026, art. 26, 33, 33a, 35 and 36 LIFD); ch-2026-ifd-instructions-
// personnes-physiques (Form. 2a 2026), p. 6 (3 % flat) and p. 7 (pillar 3a); ch-2026-ifd-tarif-
// personnes-physiques (Form. 58c 2026) notes 1 and 2 for rounding; ch-na-law-lifd for the rules.
import type { IfdAmounts } from '../2025/ifd.js';
import { PILLAR3A_2026 } from './pillar3a.js';

const CIRCULAR = 'ch-2026-ifd-progression-deductions';
const INSTRUCTIONS = 'ch-2026-ifd-instructions-personnes-physiques';

export const IFD_2026: IfdAmounts = {
  childTaxReduction: { value: 26_300, source: `${CIRCULAR} p. 2 (art. 36 al. 2bis)` },
  minimumCollected: { value: 2_500, source: `${CIRCULAR} p. 4 (art. 36 al. 3)` },
  rounding: {
    value: { incomeStep: 10_000, taxStep: 5 },
    source: 'ch-2026-ifd-tarif-personnes-physiques p. 1 (notes 1 and 2)',
  },
  professionalFlat: {
    value: { rateBp: 300, min: 200_000, max: 400_000 },
    source: `${INSTRUCTIONS} p. 6; ${CIRCULAR} p. 2`,
  },
  commuteMax: { value: 330_000, source: `${CIRCULAR} p. 1 (art. 26 al. 1 let. a)` },
  meals: {
    value: { perDay: 1_500, perYear: 320_000, halfPerDay: 750, halfPerYear: 160_000 },
    source: `${CIRCULAR} p. 2; ${INSTRUCTIONS} p. 6`,
  },
  twoEarner: {
    value: { shareBp: 5000, min: 860_000, max: 1_410_000 },
    source: `${CIRCULAR} p. 2 (art. 33 al. 2); ${INSTRUCTIONS} p. 8`,
  },
  pillar3a: {
    value: {
      withFund: PILLAR3A_2026.value.capWithPensionFund,
      withoutFundMax: PILLAR3A_2026.value.capWithoutPensionFund,
      withoutFundShareBp: PILLAR3A_2026.value.shareWithoutPensionFundBp,
    },
    source: PILLAR3A_2026.source,
  },
  insurance: {
    value: {
      married: 370_000,
      marriedNone: 555_000,
      other: 180_000,
      otherNone: 270_000,
      perChild: 70_000,
    },
    source: `${CIRCULAR} p. 2 (art. 33 al. 1 let. g, al. 1bis)`,
  },
  childcareMax: { value: 2_580_000, source: `${CIRCULAR} p. 2 (art. 33 al. 3)` },
  trainingMax: { value: 1_300_000, source: `${CIRCULAR} p. 2 (art. 33 al. 1 let. j)` },
  partyMax: { value: 1_060_000, source: `${CIRCULAR} p. 2 (art. 33 al. 1 let. i)` },
  donations: {
    value: { shareBp: 2000, min: 10_000 },
    source: `${CIRCULAR} p. 2 (art. 33a); ch-na-law-lifd art. 33a (p. 27)`,
  },
  medicalThresholdBp: {
    value: 500,
    source: `ch-na-law-lifd art. 33 al. 1 let. h (p. 26); ${INSTRUCTIONS} p. 9`,
  },
  debtInterestExtra: {
    value: 5_000_000,
    source: `ch-na-law-lifd art. 33 al. 1 let. a (p. 25); ${INSTRUCTIONS} p. 7`,
  },
  child: { value: 680_000, source: `${CIRCULAR} p. 2 (art. 35 al. 1 let. a)` },
  married: { value: 280_000, source: `${CIRCULAR} p. 2 (art. 35 al. 1 let. c)` },
};
