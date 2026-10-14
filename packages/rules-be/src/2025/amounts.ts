// Bern deduction amounts, tax year 2025. Every value is read in the documents cited next to it:
// - be-2025-stg-de: the Steuergesetz in force from 1 January to 31 December 2025;
// - be-na-deductions-abzuege-freigrenzen: the canton's table of deductions by tax year (sheet
//   2022-2027, column H: BE/Gemeinde 2025), which gives the same amounts as the law;
// - be-2025-wegleitung-np-de: the 2025 guide (p. is the PDF's page; the guide prints "Seite" 9 less);
// - be-na-deductions-berufskostenverordnung (BKV): the partial flat amounts of the professional
//   costs are the federal ones (Art. 6 Abs. 2). Their values come from packages/rules-ch's federal
//   constants for 2025 (ifdParamsFor), and the 2025 guide prints the same (test/sources.test.ts).
// - pillar 3a: the federal limits (StG Art. 38 Abs. 1 lit. e), from packages/rules-ch.
import { ifdParamsFor } from '@taxpresso/rules-ch';
import type { BeAmounts } from '../amounts.js';

const LAW = 'be-2025-stg-de';
const GUIDE = 'be-2025-wegleitung-np-de';
const BKV = 'be-na-deductions-berufskostenverordnung';
/** The canton's table of deductions, 2025 column for the canton and communes. */
const table = (...rows: number[]) =>
  `be-na-deductions-abzuege-freigrenzen sheet 2022-2027 (row${rows.length > 1 ? 's' : ''} ${rows.join(', ')}, column H)`;

const FEDERAL = ifdParamsFor(2025);

export const AMOUNTS_2025: BeAmounts = {
  commuteMax: {
    value: 700_000,
    source: `${LAW} Art. 31 Abs. 1 lit. a (p. 23); ${table(9)}; ${GUIDE} p. 184 (Seite 175)`,
  },
  commuteBike: {
    value: FEDERAL.commuteBike.value,
    source: `${BKV} Art. 6 Abs. 2 (p. 2); ${GUIDE} p. 185 (Seite 176)`,
  },
  commuteKm: {
    value: FEDERAL.commuteKm.value,
    source: `${BKV} Art. 6 Abs. 2, Art. 7 Abs. 3 (p. 2); ${GUIDE} p. 188 (Seite 179)`,
  },
  meals: {
    value: FEDERAL.meals.value,
    source: `${BKV} Art. 6 Abs. 2 (p. 2), Art. 8 Abs. 2 and 3 (p. 3); ${GUIDE} p. 189 (Seite 180)`,
  },
  professionalFlat: {
    value: FEDERAL.professionalFlat.value,
    source: `${BKV} Art. 6 Abs. 2 (p. 2), Art. 9 Abs. 3 (p. 4); ${GUIDE} p. 192 (Seite 183)`,
  },
  sideJobFlat: {
    value: { rateBp: 2000, min: 80_000, max: 240_000 },
    source: `${BKV} Art. 13 (p. 5); ${GUIDE} p. 196 (Seite 187)`,
  },
  pillar3a: {
    value: FEDERAL.pillar3a.value,
    source: `${LAW} Art. 38 Abs. 1 lit. e (p. 27); ${GUIDE} p. 201 (Seite 192)`,
  },
  insurance: {
    value: {
      married: 490_000,
      other: 245_000,
      marriedNone: 720_000,
      otherNone: 360_000,
      perChild: 70_000,
    },
    source: `${LAW} Art. 38 Abs. 1 lit. g (p. 27); ${table(15, 16, 17, 19, 20, 21)}; be-na-deductions-taxinfo-versicherungsabzug (Kantons- und Gemeindesteuer)`,
  },
  childcareMax: {
    value: 1_600_000,
    source: `${LAW} Art. 38 Abs. 1 lit. l (p. 28); ${table(23)}; ${GUIDE} p. 23 (Seite 14)`,
  },
  partyMax: {
    value: 530_000,
    source: `${LAW} Art. 38 Abs. 1 lit. m (p. 28); ${table(11, 12, 13)}; ${GUIDE} p. 207 (Seite 198)`,
  },
  trainingMax: {
    value: 1_250_000,
    source: `${LAW} Art. 38 Abs. 1 lit. n (p. 28); ${table(10)}; ${GUIDE} p. 197 (Seite 188)`,
  },
  twoEarner: {
    value: { shareBp: 200, max: 950_000 },
    source: `${LAW} Art. 38 Abs. 2 (p. 28); ${table(37, 38)}; be-na-deductions-taxinfo-zweiverdienerabzug (2 Bemessung)`,
  },
  debtInterestExtra: {
    value: 5_000_000,
    source: `${LAW} Art. 38 Abs. 1 lit. a (p. 27); ${GUIDE} p. 183 (Seite 174)`,
  },
  medicalThresholdBp: {
    value: 500,
    source: `${LAW} Art. 38a Abs. 1 lit. b (p. 29); ${GUIDE} p. 213 (Seite 204)`,
  },
  donations: {
    value: { min: 10_000, shareBp: 2000 },
    source: `${LAW} Art. 38a Abs. 1 lit. a (p. 29); ${GUIDE} p. 208 (Seite 199)`,
  },
  general: {
    value: 530_000,
    source: `${LAW} Art. 40 Abs. 1 (p. 29); ${table(29, 40)}`,
  },
  single: {
    value: { base: 240_000, perChild: 130_000 },
    source: `${LAW} Art. 40 Abs. 2 (p. 29), Abs. 3 lit. c (p. 30); ${table(30, 31)}; ${GUIDE} p. 19 (Seite 10)`,
  },
  child: {
    value: 830_000,
    source: `${LAW} Art. 40 Abs. 3 lit. a (p. 30); ${table(8)}; ${GUIDE} p. 30 (Seite 21)`,
  },
  education: {
    value: 640_000,
    source: `${LAW} Art. 40 Abs. 3 lit. b (p. 30); ${table(7)}; ${GUIDE} p. 25 (Seite 16)`,
  },
  modestIncome: {
    value: {
      other: { max: 110_000, limit: 1_670_000, cut: 15_000 },
      married: { max: 220_000, limit: 2_230_000, cut: 30_000 },
      step: 200_000,
      perChild: 60_000,
      wealthShareBp: 1000,
    },
    source: `${LAW} Art. 40 Abs. 6 and 7 (p. 30), Abs. 8 (p. 31); ${table(32, 33, 34, 35, 36)}`,
  },
  wealthDeductions: {
    value: { married: 1_800_000, perChild: 1_800_000 },
    source: `${LAW} Art. 64 Abs. 1 (p. 41); ${table(41, 42)}`,
  },
};
