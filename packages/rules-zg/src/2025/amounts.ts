// Zug deduction amounts, tax year 2025. Every value is read in the documents cited next to it:
// - zg-2025-law-steuergesetz: the tax law (StG, BGS 632.1), Stand 1 January 2024, in force for 2025;
// - zg-2026-deductions-sozialabzuege p. 2: the Steuerverwaltung's indexed amounts for 2025
//   (Sozialabzüge Kantonssteuern gültig Steuerperiode 2025);
// - zg-2025-guide-wegleitung: the guide to the 2025 return; its printed page numbers are the PDF's;
// - the Steuerbuch (the canton's practice): 16.1 says the rates of the federal ordinance's annex
//   (SR 642.118.1) apply to the cantonal tax too, so a bike's flat amount is the federal one.
import type { ZgAmounts } from '../amounts.js';

const LAW = 'zg-2025-law-steuergesetz';
const SHEET = 'zg-2026-deductions-sozialabzuege p. 2 (Sozialabzüge Kantonssteuern 2025';
const GUIDE = 'zg-2025-guide-wegleitung';

export const AMOUNTS_2025: ZgAmounts = {
  travel: {
    value: { max: 600_000, carPerKm: 70, motorbikePerKm: 40, bikePerYear: 70_000, maxDays: 220 },
    source: `${LAW} § 25 Abs. 1 Bst. a (p. 19); ${GUIDE} p. 32 (Code 201, 202: Ansätze 70 Rp/km Autos, 40 Rp/km Motorräder, max. 220 Tage; FABI-Begrenzung Fr. 6 000 Kantons- und Gemeindesteuern); zg-2026-deductions-steuerbuch-berufskosten (16.1: die Ansätze des Anhangs gelten auch für die Kantons- und Gemeindesteuern); ch-2026-ifd-progression-deductions p. 1 (vélos, cyclomoteurs, 2025 column)`,
  },
  meals: {
    value: { perDay: 1_500, perYear: 320_000, halfPerDay: 750, halfPerYear: 160_000 },
    source: `${GUIDE} p. 33 (3) Mehrkosten für auswärtige Verpflegung)`,
  },
  otherFlat: {
    value: { rateBp: 300, min: 200_000, max: 400_000 },
    source: `${GUIDE} p. 32 (1) Pauschalabzug: 3 % des Nettolohnes, mindestens Fr. 2 000 und höchstens Fr. 4 000); ${LAW} § 25 Abs. 1 Bst. c and Abs. 2 (p. 19)`,
  },
  sideJob: {
    value: { rateBp: 2_000, min: 80_000, max: 240_000 },
    source: `${GUIDE} p. 34 (5) Auslagen bei Nebenerwerb)`,
  },
  debtInterestExtra: {
    value: 5_000_000,
    source: `${LAW} § 30 Abs. 1 Bst. a (p. 22); ${GUIDE} p. 35 (Fr. 50 000)`,
  },
  pillar3a: {
    value: { withFund: 725_800, withoutFundMax: 3_628_800, withoutFundShareBp: 2_000 },
    source: `${GUIDE} p. 36 (Code 220, 221: höchstens Fr. 7 258; 20 %, höchstens Fr. 36 288); ${LAW} § 30 Abs. 1 Bst. e (p. 22)`,
  },
  insurance: {
    value: {
      married: 700_000,
      marriedNone: 1_050_000,
      other: 350_000,
      otherNone: 530_000,
      perChild: 110_000,
    },
    source: `${SHEET}, § 30 g: Versicherungsabzug); ${GUIDE} p. 37 (Code 230); ${LAW} § 30 Abs. 1 Bst. g (p. 22)`,
  },
  training: {
    value: 1_200_000,
    source: `${LAW} § 30 Abs. 1 Bst. n (p. 23); ${GUIDE} p. 37 (Code 245, 246: Fr. 12 000 Kanton pro Person und Jahr)`,
  },
  party: {
    value: 2_000_000,
    source: `${LAW} § 30 Abs. 1 Bst. k (p. 23); ${GUIDE} p. 38 (Code 252: Fr. 20 000 Kantons- und Gemeindesteuern)`,
  },
  childcare: {
    value: 2_540_000,
    source: `${SHEET}, Fremdbetreuungskostenabzug); ${GUIDE} p. 38 (Code 253); ${LAW} § 30 Abs. 1 Bst. l (p. 23); zg-2026-deductions-steuerbuch-kinderdrittbetreuung (20.10.1.2: Steuerperiode 2025 und 2026, max. Fr. 25'400)`,
  },
  twoEarner: {
    value: 460_000,
    source: `${SHEET}, Zweitverdienerabzug); ${GUIDE} p. 40 (Code 260); ${LAW} § 30 Abs. 1 Bst. h (p. 23)`,
  },
  medicalThresholdBp: {
    value: 500,
    source: `${LAW} § 31 Abs. 1 Bst. a (p. 24); ${GUIDE} p. 40 (Code 295: 5 % des massgebenden Reineinkommens, Code 287)`,
  },
  donations: {
    value: { shareBp: 2_000, min: 10_000 },
    source: `${LAW} § 31 Abs. 1 Bst. b (p. 24); ${GUIDE} p. 41 (Code 296: mindestens Fr. 100, 20 % von Code 287)`,
  },
  personal: {
    value: { large: 2_400_000, small: 1_200_000 },
    source: `${SHEET}, § 33 Abs. 1: Persönlicher Abzug); ${GUIDE} p. 41 (Code 400, 402); ${LAW} § 33 Abs. 1 Ziff. 1 (p. 24)`,
  },
  child: {
    value: { base: 1_260_000, from15: 1_220_000 },
    source: `${SHEET}, Kinderabzug, Kinderabzug zusätzlich ab 16. Altersjahr); ${GUIDE} p. 41 (Code 403, 403a); ${LAW} § 33 Abs. 1 Ziff. 2 (p. 25)`,
  },
  ownCare: {
    value: 1_220_000,
    source: `${SHEET}, Eigenbetreuungskostenabzug); ${GUIDE} p. 41 (Code 404); ${LAW} § 33 Abs. 2 and 2bis (p. 25); zg-2026-deductions-steuerbuch-eigenbetreuung (22.8: Steuerperiode 2025 und 2026)`,
  },
  pensioner: {
    value: {
      perPerson: false,
      maxWealth: 28_700_000,
      large: [
        { upTo: 3_440_000, amount: 340_000 },
        { upTo: 5_740_000, amount: 170_000 },
      ],
      small: [
        { upTo: 3_440_000, amount: 340_000 },
        { upTo: 5_740_000, amount: 170_000 },
      ],
    },
    source: `${SHEET}, Rentnerabzug, Vermögensschwelle Rentnerabzug); ${GUIDE} p. 42 (Code 406: Reinvermögen Code 660, Reineinkommen Code 299); ${LAW} § 33 Abs. 1 Ziff. 3 (p. 25)`,
  },
  rent: {
    value: { shareBp: 3_000, max: 1_080_000 },
    source: `${SHEET}, Mietzinsabzug, 30 % der Nettomiete); ${GUIDE} p. 42 (Code 407); ${LAW} § 33 Abs. 1 Ziff. 5 (p. 25)`,
  },
  wealthFree: {
    value: { married: 40_800_000, other: 20_400_000, perChild: 10_200_000 },
    source: `${SHEET}, § 44: Vermögensabzug); ${GUIDE} p. 45 (Code 671, 672, 673); ${LAW} § 44 Abs. 1 (p. 30)`,
  },
};
