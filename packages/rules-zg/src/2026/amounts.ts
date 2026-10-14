// Zug deduction amounts, tax year 2026. Every value is read in the documents cited next to it:
// - zg-2026-law-steuergesetz: the tax law (StG, BGS 632.1), Stand 1 January 2026, with the
//   «Mehrwert für alle» changes (§ 30 Bst. g, § 33 Abs. 1 Ziff. 3);
// - zg-2026-deductions-sozialabzuege p. 1: the Steuerverwaltung's indexed amounts for 2026
//   (Sozialabzüge Kantonssteuern gültig Steuerperiode 2026);
// - the Steuerbuch (the canton's practice): 16.1 says the rates of the federal ordinance's annex
//   (SR 642.118.1) apply to the cantonal tax too; the 2026 rates are in the federal circular
//   (ch-2026-ifd-progression-deductions) and the federal instructions (Form. 2a 2026).
// The 2026 guide (Wegleitung) is not published (docs/sources/zg/NOTES.md, Gaps): no document gives a
// limit on the days driven to work for 2026, so `travel.maxDays` is null and the engine does not
// compute more than the 2025 guide's 220 days (it says so instead).
import { PILLAR3A_2026 } from '@taxpresso/rules-ch';
import type { ZgAmounts } from '../amounts.js';

const LAW = 'zg-2026-law-steuergesetz';
const SHEET = 'zg-2026-deductions-sozialabzuege p. 1 (Sozialabzüge Kantonssteuern 2026';
const ANNEX =
  'zg-2026-deductions-steuerbuch-berufskosten (16.1: die Ansätze des Anhangs gelten auch für die Kantons- und Gemeindesteuern)';
const CIRCULAR = 'ch-2026-ifd-progression-deductions';
const INSTRUCTIONS = 'ch-2026-ifd-instructions-personnes-physiques';

export const AMOUNTS_2026: ZgAmounts = {
  travel: {
    value: { max: 600_000, carPerKm: 75, motorbikePerKm: 40, bikePerYear: 70_000, maxDays: null },
    source: `${LAW} § 25 Abs. 1 Bst. a (p. 19); zg-2026-deductions-steuerbuch-fahrkosten (16.2.1, Hinweis für die Kantonssteuer: Fr. 6'000); ${ANNEX}; ${CIRCULAR} p. 1 (vélos, cyclomoteurs; motos; voitures, 2026 column)`,
  },
  meals: {
    value: { perDay: 1_500, perYear: 320_000, halfPerDay: 750, halfPerYear: 160_000 },
    source: `${ANNEX}; ${CIRCULAR} p. 2 (repas pris à l'extérieur, 2026 column)`,
  },
  otherFlat: {
    value: { rateBp: 300, min: 200_000, max: 400_000 },
    source: `${ANNEX}; ${CIRCULAR} p. 2 (autres frais professionnels, 2026 column); ${INSTRUCTIONS} p. 6 (3 %); ${LAW} § 25 Abs. 1 Bst. c and Abs. 2 (p. 19)`,
  },
  sideJob: {
    value: { rateBp: 2_000, min: 80_000, max: 240_000 },
    source: `${ANNEX}; ${CIRCULAR} p. 2 (activité accessoire, 2026 column); ${INSTRUCTIONS} p. 7 (20 %)`,
  },
  debtInterestExtra: { value: 5_000_000, source: `${LAW} § 30 Abs. 1 Bst. a (p. 22)` },
  pillar3a: {
    value: {
      withFund: PILLAR3A_2026.value.capWithPensionFund,
      withoutFundMax: PILLAR3A_2026.value.capWithoutPensionFund,
      withoutFundShareBp: PILLAR3A_2026.value.shareWithoutPensionFundBp,
    },
    source: `${LAW} § 30 Abs. 1 Bst. e (p. 22: nach Massgabe der bundesrechtlichen Vorschriften); ${PILLAR3A_2026.source}`,
  },
  insurance: {
    value: {
      married: 920_000,
      marriedNone: 1_380_000,
      other: 460_000,
      otherNone: 690_000,
      perChild: 160_000,
    },
    source: `${SHEET}, § 30 g: Versicherungsabzug); ${LAW} § 30 Abs. 1 Bst. g (p. 22)`,
  },
  training: { value: 1_200_000, source: `${LAW} § 30 Abs. 1 Bst. n (p. 23)` },
  party: { value: 2_000_000, source: `${LAW} § 30 Abs. 1 Bst. k (p. 23)` },
  childcare: {
    value: 2_540_000,
    source: `${SHEET}, Fremdbetreuungskostenabzug); ${LAW} § 30 Abs. 1 Bst. l (p. 23); zg-2026-deductions-steuerbuch-kinderdrittbetreuung (20.10.1.2: Steuerperiode 2025 und 2026, max. Fr. 25'400)`,
  },
  twoEarner: {
    value: 460_000,
    source: `${SHEET}, Zweitverdienerabzug); ${LAW} § 30 Abs. 1 Bst. h (p. 23)`,
  },
  medicalThresholdBp: {
    value: 500,
    source: `${LAW} § 31 Abs. 1 Bst. a (p. 24); zg-2026-deductions-steuerbuch-krankheitskosten (21.1: 5 % des massgebenden Reineinkommens)`,
  },
  donations: {
    value: { shareBp: 2_000, min: 10_000 },
    source: `${LAW} § 31 Abs. 1 Bst. b (p. 24)`,
  },
  personal: {
    value: { large: 2_400_000, small: 1_200_000 },
    source: `${SHEET}, § 33 Abs. 1: Persönlicher Abzug); ${LAW} § 33 Abs. 1 Ziff. 1 (p. 24)`,
  },
  child: {
    value: { base: 1_260_000, from15: 1_220_000 },
    source: `${SHEET}, Kinderabzug, Kinderabzug zusätzlich ab 16. Altersjahr); ${LAW} § 33 Abs. 1 Ziff. 2 (p. 25)`,
  },
  ownCare: {
    value: 1_220_000,
    source: `${SHEET}, Eigenbetreuungskostenabzug); ${LAW} § 33 Abs. 2 and 2bis (p. 25); zg-2026-deductions-steuerbuch-eigenbetreuung (22.8: Steuerperiode 2025 und 2026)`,
  },
  pensioner: {
    value: {
      perPerson: true,
      maxWealth: 40_000_000,
      large: [{ upTo: 12_000_000, amount: 600_000 }],
      small: [{ upTo: 6_000_000, amount: 600_000 }],
    },
    source: `${SHEET}, Rentnerabzug pro Person, Vermögensschwelle Rentnerabzug, Reineinkommen); ${LAW} § 33 Abs. 1 Ziff. 3 (p. 25)`,
  },
  rent: {
    value: { shareBp: 3_000, max: 1_080_000 },
    source: `${SHEET}, Mietzinsabzug, 30 % der Nettomiete); ${LAW} § 33 Abs. 1 Ziff. 5 (p. 25)`,
  },
  wealthFree: {
    value: { married: 40_800_000, other: 20_400_000, perChild: 10_200_000 },
    source: `${SHEET}, § 44: Vermögensabzug); ${LAW} § 44 Abs. 1 (p. 30)`,
  },
};
