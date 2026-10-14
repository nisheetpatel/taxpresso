// Bern deduction amounts, tax year 2026. Every value is read in the documents cited next to it:
// - be-2026-stg-de: the Steuergesetz in force from 1 January 2026 (the same amounts as 2025);
// - be-na-deductions-abzuege-freigrenzen: the canton's table of deductions by tax year (sheet
//   2022-2027, column J: BE/Gemeinde 2026), which gives the same amounts as the law;
// - be-na-deductions-berufskostenverordnung (BKV): the partial flat amounts of the professional
//   costs are the federal ones (Art. 6 Abs. 2). Their values come from packages/rules-ch's federal
//   constants for 2026 (ifdParamsFor), read in the federal circular for 2026 (ch-2026-ifd-
//   progression-deductions) and Form. 2a 2026; the car rises to 75 centimes per km. The 2026 Bern
//   guide is not published yet (docs/sources/be/NOTES.md, Gaps).
// - pillar 3a: the federal limits (StG Art. 38 Abs. 1 lit. e), from packages/rules-ch.
import { ifdParamsFor } from '@taxpresso/rules-ch';
import type { BeAmounts } from '../amounts.js';

const LAW = 'be-2026-stg-de';
const BKV = 'be-na-deductions-berufskostenverordnung';
const CIRCULAR = 'ch-2026-ifd-progression-deductions';
const FORM_2A = 'ch-2026-ifd-instructions-personnes-physiques';
/** The canton's table of deductions, 2026 column for the canton and communes. */
const table = (...rows: number[]) =>
  `be-na-deductions-abzuege-freigrenzen sheet 2022-2027 (row${rows.length > 1 ? 's' : ''} ${rows.join(', ')}, column J)`;

const FEDERAL = ifdParamsFor(2026);

export const AMOUNTS_2026: BeAmounts = {
  commuteMax: {
    value: 700_000,
    source: `${LAW} Art. 31 Abs. 1 lit. a (p. 23); ${table(9)}`,
  },
  commuteBike: {
    value: FEDERAL.commuteBike.value,
    source: `${BKV} Art. 6 Abs. 2 (p. 2); ${CIRCULAR} p. 1 (2026 column)`,
  },
  commuteKm: {
    value: FEDERAL.commuteKm.value,
    source: `${BKV} Art. 6 Abs. 2, Art. 7 Abs. 3 (p. 2); ${CIRCULAR} p. 1 (2026 column)`,
  },
  meals: {
    value: FEDERAL.meals.value,
    source: `${BKV} Art. 6 Abs. 2 (p. 2), Art. 8 Abs. 2 and 3 (p. 3); ${CIRCULAR} p. 2 (2026 column)`,
  },
  professionalFlat: {
    value: FEDERAL.professionalFlat.value,
    source: `${BKV} Art. 6 Abs. 2 (p. 2), Art. 9 Abs. 3 (p. 4); ${CIRCULAR} p. 2 (2026 column); ${FORM_2A} p. 6`,
  },
  sideJobFlat: {
    value: { rateBp: 2000, min: 80_000, max: 240_000 },
    source: `${BKV} Art. 13 (p. 5); ${CIRCULAR} p. 2 (2026 column); ${FORM_2A} p. 7`,
  },
  pillar3a: {
    value: FEDERAL.pillar3a.value,
    source: `${LAW} Art. 38 Abs. 1 lit. e (p. 27); ${FORM_2A} p. 7 (chiffre 13); be-na-deductions-taxinfo-saeule-3a (1.1, 1.2)`,
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
    source: `${LAW} Art. 38 Abs. 1 lit. l (p. 28); ${table(23)}`,
  },
  partyMax: {
    value: 530_000,
    source: `${LAW} Art. 38 Abs. 1 lit. m (p. 28); ${table(11, 12, 13)}`,
  },
  trainingMax: {
    value: 1_250_000,
    source: `${LAW} Art. 38 Abs. 1 lit. n (p. 28); ${table(10)}`,
  },
  twoEarner: {
    value: { shareBp: 200, max: 950_000 },
    source: `${LAW} Art. 38 Abs. 2 (p. 28); ${table(37, 38)}; be-na-deductions-taxinfo-zweiverdienerabzug (2 Bemessung)`,
  },
  debtInterestExtra: {
    value: 5_000_000,
    source: `${LAW} Art. 38 Abs. 1 lit. a (p. 27)`,
  },
  medicalThresholdBp: {
    value: 500,
    source: `${LAW} Art. 38a Abs. 1 lit. b (p. 29)`,
  },
  donations: {
    value: { min: 10_000, shareBp: 2000 },
    source: `${LAW} Art. 38a Abs. 1 lit. a (p. 29)`,
  },
  general: {
    value: 530_000,
    source: `${LAW} Art. 40 Abs. 1 (p. 29); ${table(29, 40)}`,
  },
  single: {
    value: { base: 240_000, perChild: 130_000 },
    source: `${LAW} Art. 40 Abs. 2 (p. 29), Abs. 3 lit. c (p. 30); ${table(30, 31)}`,
  },
  child: {
    value: 830_000,
    source: `${LAW} Art. 40 Abs. 3 lit. a (p. 30); ${table(8)}`,
  },
  education: {
    value: 640_000,
    source: `${LAW} Art. 40 Abs. 3 lit. b (p. 30); ${table(7)}`,
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
