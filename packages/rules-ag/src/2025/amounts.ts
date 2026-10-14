// Aargau deduction amounts, tax year 2025. Every value is read in the documents cited next to it:
// - ag-na-law-steuergesetz (StG, Stand 1 January 2025): the amounts written in the law (§§ 35, 40,
//   40a, 42, 54) and the insurance flat amounts of each year (footnote 16 to § 40 Abs. 1 lit. g);
// - ag-2025-guide-wegleitung: the 2025 guide, which prints the flat amounts of the professional costs
//   (section 10) and every deduction of the year;
// - ag-2026-deductions-uebersicht-abzuege: the canton's table of deductions, column 2025;
// - ag-2026-law-steuerverordnung (StGV) § 12 and § 13: the federal flat amounts of the professional
//   costs, with a lower rate per km for driving beyond 15,000 km a year.
import type { AgAmounts } from '../amounts.js';

const LAW = 'ag-na-law-steuergesetz';
const GUIDE = 'ag-2025-guide-wegleitung';
const STGV = 'ag-2026-law-steuerverordnung';
/** The canton's table of deductions, 2025 column. */
const table = (page: 1 | 2, rows: string) =>
  `ag-2026-deductions-uebersicht-abzuege p. ${page} (${rows}, column 2025)`;

export const AMOUNTS_2025: AgAmounts = {
  commuteMax: {
    value: 700_000,
    source: `${LAW} § 35 Abs. 1 lit. a (p. 22); ${GUIDE} p. 22 (10.1 Fahrtkosten); ${table(1, 'Fahrtkosten')}`,
  },
  commuteBike: {
    value: 70_000,
    source: `${GUIDE} p. 22 (10.1 Fahrtkosten: eigenes Fahrrad oder Kleinmotorrad); ${STGV} § 12 Abs. 1 (p. 4)`,
  },
  commuteKm: {
    value: { car: 70, motorbike: 40, carKm: 15_000, carLess: 20 },
    source: `${GUIDE} p. 22 (10.1 Fahrtkosten: CHF 0.70 pro km, Motorrad CHF 0.40); ${STGV} § 13 Abs. 1 (p. 4); ${table(1, 'Fahrtkosten')}`,
  },
  meals: {
    value: { perDay: 1_500, perYear: 320_000, halfPerDay: 750, halfPerYear: 160_000 },
    source: `${GUIDE} p. 22 and 23 (10.2 Mehrkosten der auswärtigen Verpflegung); ${STGV} § 12 Abs. 1 (p. 4); ${table(1, 'Verpflegungskosten')}`,
  },
  professionalFlat: {
    value: { rateBp: 300, min: 200_000, max: 400_000 },
    source: `${GUIDE} p. 23 (10.3 Pauschalabzug); ${table(1, 'Berufskostenpauschale')}`,
  },
  sideJobFlat: {
    value: { rateBp: 2000, min: 80_000, max: 240_000 },
    source: `${GUIDE} p. 24 (10.6 Auslagen bei Nebenerwerb); ${table(1, 'Nebenerwerbspauschale')}`,
  },
  pillar3a: {
    value: { withFund: 725_800, withoutFundMax: 3_628_800, withoutFundShareBp: 2000 },
    source: `${LAW} § 40 Abs. 1 lit. e (p. 25); ${GUIDE} p. 26 (13.2 Beiträge Säule 3a); ${table(1, 'Beiträge Säule 3a')}`,
  },
  insurance: {
    value: { married: 720_000, other: 360_000 },
    source: `${LAW} § 40 Abs. 1 lit. g and footnote 16 (p. 25); ${GUIDE} p. 27 (14. Versicherungsprämien); ${table(1, 'Versicherungspauschale')}`,
  },
  twoEarner: {
    value: 60_000,
    source: `${LAW} § 40 Abs. 1 lit. h (p. 25); ${GUIDE} p. 30 (16. Sonderabzug für zweitverdienenden Eheteil); ${table(1, 'Zweitverdienerabzug')}`,
  },
  debtInterestExtra: {
    value: 5_000_000,
    source: `${LAW} § 40 Abs. 1 lit. a (p. 25); ${GUIDE} p. 25 (11. Schuldzinsen)`,
  },
  medicalThresholdBp: {
    value: 500,
    source: `${LAW} § 40 Abs. 1 lit. i (p. 25); ${GUIDE} p. 31 (18. Selbstbehalt: Nettoeinkommen x 5 : 95); ${table(1, 'Krankheitskosten')}`,
  },
  donations: {
    value: { min: 10_000, shareBp: 2000 },
    source: `${LAW} § 40a Abs. 1 (p. 27); ${GUIDE} p. 28 (15.3 Freiwillige Leistungen); ${table(2, 'freiwillige Leistungen')}`,
  },
  partyMax: {
    value: 1_000_000,
    source: `${LAW} § 40 Abs. 1 lit. k (p. 26); ${GUIDE} p. 28 (15.2: ein Maximalabzug für Eheteile); ${table(1, 'politische Parteien')}`,
  },
  childcare: {
    value: { perChild: 2_500_000, perParentShared: 1_250_000 },
    source: `${LAW} § 40 Abs. 1 lit. n (p. 26); ${GUIDE} p. 27 (15.0 Kinderbetreuungskosten); ${table(2, 'Kinderbetreuungskosten')}; ag-2026-deductions-kinderbetreuungskosten p. 7 (4.6, 4.7 Abzug für unverheiratete Eltern / Alternierende Obhut)`,
  },
  trainingMax: {
    value: 1_800_000,
    source: `${LAW} § 40 Abs. 1 lit. p (p. 26); ${GUIDE} p. 29 (15.5: jedem Eheteil); ${table(2, 'Aus-, Weiterbildungs- und Umschulungskosten')}`,
  },
  child: {
    value: { under14: 930_000, under18: 1_030_000, adult: 1_240_000 },
    source: `${LAW} § 42 Abs. 1 lit. a (p. 27); ${GUIDE} p. 32 (19.1 Kinderabzug pro Kind); ${table(2, 'Kinderabzug')}`,
  },
  lowIncome: {
    value: [
      [1_499_900, 1_200_000],
      [1_999_900, 750_000],
      [2_499_900, 300_000],
      [2_999_900, 200_000],
      [3_499_900, 100_000],
    ],
    source: `${LAW} § 42 Abs. 1bis (p. 28); ${GUIDE} p. 32 and 33 (24. Zusätzlicher Sozialabzug für tiefe Einkommen); ${table(2, 'Kleinverdienerabzug')}`,
  },
  wealthFree: {
    value: { married: 26_000_000, other: 13_000_000, perChild: 1_600_000 },
    source: `${LAW} § 54 Abs. 1 lit. a to c (p. 32)`,
  },
};
