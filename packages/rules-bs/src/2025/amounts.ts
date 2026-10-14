// Basel-Stadt deduction amounts, tax year 2025. Every value is read in the documents cited next to
// it:
// - bs-2025-communal-ansaetze-abzuege: the canton's table of rates, deductions and allowances,
//   edition 1 January 2025 (18000.a.01.25), column 2025; values in italics are provisional and none
//   of those below is;
// - bs-2025-guide-wegleitung: the guide to the 2025 return (15500.a.06.25); the PDF's pages are the
//   printed page numbers;
// - bs-2025-law-stg: the tax law in force in 2025, which keeps the figures before their yearly
//   adjustment (§ 37): the adjusted amounts are the table's and the guide's;
// - bs-na-law-stv: the tax ordinance (StV);
// - bs-2025-form-*: the 2025 forms (view copies).
// The yield factor of accounts and securities for 2025 is the one of the 2026 table, which prints
// the 2025 column as final; the 2025 table printed a provisional factor (docs/sources/bs/NOTES.md).
import type { BsAmounts } from '../amounts.js';

const GUIDE = 'bs-2025-guide-wegleitung';
const TABLE = 'bs-2025-communal-ansaetze-abzuege';
const LAW = 'bs-2025-law-stg';

export const AMOUNTS_2025: BsAmounts = {
  professionalFlat: {
    value: { amount: 420_000, partTimeRate: 60, minimum: 84_000 },
    source: `${GUIDE} p. 30 (500/520 Pauschalabzug für Berufskosten); ${TABLE} p. 2 (Pauschale für Berufskosten, Kanton); ${LAW} § 27 al. 2 (p. 12); bs-2025-form-b-berufskosten p. 1 (500, Beschäftigungsgrad)`,
  },
  commuteMax: {
    value: 320_000,
    source: `${GUIDE} p. 30 (503/523 Fahrkosten); ${TABLE} p. 2 (Fahrtkosten, Kanton); ${LAW} § 27 al. 1 lit. a (p. 12); bs-na-law-stv § 22 (p. 5)`,
  },
  commuteRates: {
    value: { bikePerYear: 82_400, carPerKm: 70, motorbikePerKm: 40 },
    source: `${GUIDE} p. 30 (503/523: Velo oder Kleinmotorrad CHF 824, CHF 0.70 für Autos, CHF 0.40 für Motorräder); bs-na-law-stv § 22 al. 2 and 3 (p. 5)`,
  },
  meals: {
    value: {
      perDay: 1_500,
      perYear: 320_000,
      reducedPerDay: 750,
      reducedPerYear: 160_000,
      maxDays: 220,
    },
    source: `${GUIDE} p. 31 (504/524 Mehrkosten für auswärtige Verpflegung); ${TABLE} p. 2 (Mehrkosten für Verpflegung, Kanton); bs-na-law-stv § 23 (p. 6)`,
  },
  pillar3a: {
    value: { withFund: 725_800, withoutFundMax: 3_628_800, withoutFundShareBp: 2_000 },
    source: `${GUIDE} p. 34 (620/625 Gebundene Selbstvorsorge); ${TABLE} p. 2 (Abzug für Säule 3a, Kanton); ${LAW} § 32 al. 1 lit. e (p. 14)`,
  },
  insurance: {
    value: { married: 840_000, single: 420_000 },
    source: `${GUIDE} p. 35 (630 Ehegatten, 631 alle übrigen Personen, Kanton); ${TABLE} p. 3 (Versicherungsabzug, Kanton); ${LAW} § 32 al. 1 lit. g (p. 14)`,
  },
  debtInterestExtra: {
    value: 5_000_000,
    source: `${LAW} § 32 al. 1 lit. a (p. 14); ${GUIDE} p. 32 (550 Schuldzinsen); bs-na-law-stv § 38 (p. 10)`,
  },
  training: {
    value: 1_910_000,
    source: `${GUIDE} p. 35 (652/657 Aus- und Weiterbildungskosten, Kanton); ${TABLE} p. 3 (Aus- und Weiterbildungskostenabzug, Kanton); ${LAW} § 32 al. 1 lit. k (p. 15)`,
  },
  twoEarner: {
    value: 110_000,
    source: `${GUIDE} p. 35 (660 Abzug bei Erwerbstätigkeit beider Ehegatten, Kanton); ${TABLE} p. 3 (Zweitverdienerabzug, Kanton); ${LAW} § 32 al. 2 (p. 15)`,
  },
  childcare: {
    value: 2_600_000,
    source: `${GUIDE} p. 36 (670 Abzug für fremdbetreute Kinder); ${TABLE} p. 3 (Kinderbetreuungskostenabzug, Kanton); ${LAW} § 32 al. 1 lit. i (p. 15)`,
  },
  party: {
    value: 1_060_000,
    source: `${GUIDE} p. 36 (680 Beiträge an politische Parteien, pro Steuerveranlagung); ${TABLE} p. 3 (Parteispendenabzug, Kanton); ${LAW} § 32 al. 1 lit. j (p. 15)`,
  },
  medicalThresholdBp: {
    value: 500,
    source: `${LAW} § 33 al. 1 lit. a (p. 15); ${GUIDE} p. 37 (725, Selbstbehalt von 5% des Nettoeinkommens II, Ziffer 722); bs-2025-form-kzf-krankheit-zuwendung-betreuung p. 1 (722)`,
  },
  donations: {
    value: { shareBp: 2_000, min: 10_000 },
    source: `${LAW} § 33 al. 1 lit. b (p. 15); ${GUIDE} p. 38 (732 Zuwendungen); bs-2025-form-kzf-krankheit-zuwendung-betreuung p. 2 (höchstens 20% des Nettoeinkommens, Ziffer 709)`,
  },
  social: {
    value: {
      child: 900_000,
      married: 3_800_000,
      singleParent: 3_260_000,
      single: 1_950_000,
      retiree: 350_000,
    },
    source: `${GUIDE} p. 38 (750 Abzug für Kinder), p. 39 (760, 765, 767, 770); ${TABLE} p. 3 (Kinderabzug, Sozialabzug für Verheiratete, Alleinerziehende, Alleinstehende, alleinstehende Rentner, Kanton); ${LAW} § 35 al. 1 (p. 16)`,
  },
  wealthFree: {
    value: { family: 15_000_000, single: 7_500_000, perMinorChild: 1_500_000 },
    source: `${LAW} § 49 al. 1 (p. 20); ${GUIDE} p. 43 (890, 891, 892); bs-2025-form-hauptformular p. 4 (890 to 892)`,
  },
  lowIncome: {
    value: {
      single: 1_400_000,
      family: 2_000_000,
      bands: [
        [10_000_000, 7_500],
        [20_000_000, 5_000],
        [40_000_000, 2_500],
      ],
    },
    source: `${LAW} § 51 al. 1 (p. 21); ${GUIDE} p. 43 (Steuerpflichtige Personen mit geringem Einkommen)`,
  },
  securitiesFactor: {
    value: 345,
    source: `bs-2025-form-w-wertschriftenverzeichnis p. 4 (lines 11 to 16, Ziffer 4 × 345); ${GUIDE} p. 40 (800, Faktor 345); bs-2026-communal-ansaetze-abzuege p. 2 (Kapitalisierungssatz Wertschriften, column 2025); ${LAW} § 46 al. 2 (p. 20); bs-na-law-stv § 49 (p. 13)`,
  },
};
