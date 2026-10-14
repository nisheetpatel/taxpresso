// Aargau deduction amounts, tax year 2026. Every value is read in the documents cited next to it:
// - ag-na-law-steuergesetz (StG, the law in force; the law collection lists no later version): the
//   amounts written in the law (§§ 35, 40, 40a, 42, 54) and the 2026 insurance flat amounts
//   (footnote 16 to § 40 Abs. 1 lit. g);
// - ag-2026-deductions-uebersicht-abzuege: the canton's table of deductions, column 2026;
// - ag-2026-deductions-versicherungspauschale: the report fixing the 2026 insurance flat amounts;
// - ag-2026-law-steuerverordnung (StGV) § 12: the federal flat amounts of the professional costs
//   apply where the canton's documents give no figure of their own. Their values come from
//   packages/rules-ch's federal constants for 2026 (ifdParamsFor), read in the federal circular for
//   2026 (ch-2026-ifd-progression-deductions); the canton's table gives the same yearly maxima for
//   meals. § 13: a lower rate per km beyond 15,000 km a year.
// The 2026 Aargau guide is not published yet (docs/sources/ag/NOTES.md, Gaps).
import { ifdParamsFor } from '@taxpresso/rules-ch';
import type { AgAmounts } from '../amounts.js';

const LAW = 'ag-na-law-steuergesetz';
const STGV = 'ag-2026-law-steuerverordnung';
const CIRCULAR = 'ch-2026-ifd-progression-deductions';
/** The canton's table of deductions, 2026 column. */
const table = (page: 1 | 2, rows: string) =>
  `ag-2026-deductions-uebersicht-abzuege p. ${page} (${rows}, column 2026)`;

const FEDERAL = ifdParamsFor(2026);

export const AMOUNTS_2026: AgAmounts = {
  commuteMax: {
    value: 700_000,
    source: `${LAW} § 35 Abs. 1 lit. a (p. 22); ${table(1, 'Fahrtkosten')}`,
  },
  commuteBike: {
    value: FEDERAL.commuteBike.value,
    source: `${STGV} § 12 Abs. 1 (p. 4); ${CIRCULAR} p. 1 (2026 column)`,
  },
  commuteKm: {
    value: { car: 75, motorbike: FEDERAL.commuteKm.value.motorbike, carKm: 15_000, carLess: 20 },
    source: `${table(1, 'Fahrtkosten: 0.75/km')}; ${STGV} § 12 Abs. 1, § 13 Abs. 1 (p. 4); ${CIRCULAR} p. 1 (2026 column)`,
  },
  meals: {
    value: FEDERAL.meals.value,
    source: `${STGV} § 12 Abs. 1 (p. 4); ${CIRCULAR} p. 2 (2026 column); ${table(1, 'Verpflegungskosten')}`,
  },
  professionalFlat: {
    value: { rateBp: 300, min: 200_000, max: 400_000 },
    source: `${LAW} § 35 Abs. 2 (p. 22); ${table(1, 'Berufskostenpauschale')}`,
  },
  sideJobFlat: {
    value: { rateBp: 2000, min: 80_000, max: 240_000 },
    source: `${LAW} § 35 Abs. 2 (p. 22); ${table(1, 'Nebenerwerbspauschale')}`,
  },
  pillar3a: {
    value: { withFund: 725_800, withoutFundMax: 3_628_800, withoutFundShareBp: 2000 },
    source: `${LAW} § 40 Abs. 1 lit. e (p. 25); ${table(1, 'Beiträge Säule 3a')}; ch-2026-ifd-instructions-personnes-physiques p. 7 (chiffre 13)`,
  },
  insurance: {
    value: { married: 760_000, other: 380_000 },
    source: `ag-2026-deductions-versicherungspauschale p. 2 (5. Festlegung des Pauschalabzugs ab Steuerperiode 2026); ${LAW} § 40 Abs. 1 lit. g and footnote 16 (p. 25); ${table(1, 'Versicherungspauschale')}`,
  },
  twoEarner: {
    value: 60_000,
    source: `${LAW} § 40 Abs. 1 lit. h (p. 25); ${table(1, 'Zweitverdienerabzug')}`,
  },
  debtInterestExtra: {
    value: 5_000_000,
    source: `${LAW} § 40 Abs. 1 lit. a (p. 25); ${table(1, 'private Schuldzinsen')}`,
  },
  medicalThresholdBp: {
    value: 500,
    source: `${LAW} § 40 Abs. 1 lit. i (p. 25); ${table(1, 'Krankheitskosten: Selbstbehalt Nettoeink. x 5 : 95')}`,
  },
  donations: {
    value: { min: 10_000, shareBp: 2000 },
    source: `${LAW} § 40a Abs. 1 (p. 27); ${table(2, 'freiwillige Leistungen')}`,
  },
  partyMax: {
    value: 1_000_000,
    source: `${LAW} § 40 Abs. 1 lit. k (p. 26); ${table(1, 'politische Parteien')}`,
  },
  childcare: {
    value: { perChild: 2_500_000, perParentShared: 1_250_000 },
    source: `${LAW} § 40 Abs. 1 lit. n (p. 26); ${table(2, 'Kinderbetreuungskosten')}; ag-2026-deductions-kinderbetreuungskosten p. 7 (4.6, 4.7 Abzug für unverheiratete Eltern / Alternierende Obhut)`,
  },
  trainingMax: {
    value: 1_800_000,
    source: `${LAW} § 40 Abs. 1 lit. p (p. 26); ${table(2, 'Aus-, Weiterbildungs- und Umschulungskosten')}; ag-2026-deductions-weiterbildungskosten p. 7 (3.6 Betragliche Begrenzung: jedem Eheteil)`,
  },
  child: {
    value: { under14: 930_000, under18: 1_030_000, adult: 1_240_000 },
    source: `${LAW} § 42 Abs. 1 lit. a (p. 27); ${table(2, 'Kinderabzug')}`,
  },
  lowIncome: {
    value: [
      [1_499_900, 1_200_000],
      [1_999_900, 750_000],
      [2_499_900, 300_000],
      [2_999_900, 200_000],
      [3_499_900, 100_000],
    ],
    source: `${LAW} § 42 Abs. 1bis (p. 28); ${table(2, 'Kleinverdienerabzug')}`,
  },
  wealthFree: {
    value: { married: 26_000_000, other: 13_000_000, perChild: 1_600_000 },
    source: `${LAW} § 54 Abs. 1 lit. a to c (p. 32)`,
  },
};
