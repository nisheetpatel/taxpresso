// Basel-Landschaft deduction amounts, tax year 2026. Every value is read in the documents cited next
// to it:
// - bl-na-steuergesetz-331: the tax law (StG, SGS 331), Stand 1 January 2023, the current version for
//   2025 and 2026 (docs/sources/bl/manifest.json);
// - bl-2026-law-verordnung-331-11: the ordinance (Verordnung zum Steuergesetz), Stand 1 January 2026:
//   § 3 Abs. 1 lit. a Ziff. 3 now gives CHF 0.75 a km for a car;
// - bl-2026-wegleitung: the guide to the 2026 return; its printed page numbers are the PDF's; it
//   splits the pensioners' deduction into AHV (770, with the 13th AHV pension) and IV (771);
// - bl-2026-deductions-berufsauslagen: the 2026 form for professional costs;
// - bl-na-steuerbuch: the canton's practice (Baselbieter Steuerbuch, Band 1).
import type { BlAmounts } from '../amounts.js';

const LAW = 'bl-na-steuergesetz-331';
const ORD = 'bl-2026-law-verordnung-331-11';
const GUIDE = 'bl-2026-wegleitung';

export const AMOUNTS_2026: BlAmounts = {
  travel: {
    value: { max: 600_000, bikePerYear: 70_000, carPerKm: 75, motorbikePerKm: 40 },
    source: `${LAW} § 29 Abs. 1 lit. a (p. 22); ${ORD} § 3 Abs. 1 lit. a (p. 3); ${GUIDE} p. 25 and 26 (500/505 Fahrtkosten); bl-2026-deductions-berufsauslagen p. 1 (500, Privatauto CHF 0.75/km, Staat höchstens CHF 6’000); bl-2026-guide-informationen-neuerungen p. 1 (Fahrtkosten, neu CHF 0.75)`,
  },
  meals: {
    value: { perDay: 1_500, perYear: 320_000, halfPerDay: 750, halfPerYear: 160_000 },
    source: `${ORD} § 3 Abs. 1 lit. b (p. 4); ${GUIDE} p. 27 (510/515 Mehrkosten der auswärtigen Verpflegung); bl-2026-deductions-berufsauslagen p. 1 (510)`,
  },
  otherFlat: {
    value: 50_000,
    source: `${LAW} § 29 Abs. 1 lit. a (p. 22, zusätzliche Pauschale von CHF 500); ${GUIDE} p. 28 (520/525, Staatssteuer, Pauschalabzug CHF 500); bl-2026-deductions-berufsauslagen p. 1 (520, Pauschalabzug Staat: CHF 500)`,
  },
  sideJob: {
    value: { rateBp: 2_000, min: 80_000, max: 240_000 },
    source: `${ORD} § 3 Abs. 3 (p. 6); ${GUIDE} p. 28 (530/535 Auslagen bei Nebenerwerb)`,
  },
  debtInterestExtra: {
    value: 5_000_000,
    source: `${LAW} § 29 Abs. 1 lit. f (p. 23); ${GUIDE} p. 29 (550, 555)`,
  },
  pillar3a: {
    value: { withFund: 725_800, withoutFundMax: 3_628_800, withoutFundShareBp: 2_000 },
    source: `${GUIDE} p. 30 (610 Beiträge an die Säule 3a); ${LAW} § 29 Abs. 1 lit. dter (p. 23)`,
  },
  insurance: {
    value: { married: 400_000, other: 200_000, perChild: 45_000 },
    source: `${LAW} § 29 Abs. 1 lit. k (p. 23); ${GUIDE} p. 32 (620, 625, 630, Staatssteuer); bl-na-steuerbuch p. 184 (29 Nr. 15, Ziffer 2)`,
  },
  childcare: {
    value: 1_000_000,
    source: `${LAW} § 29 Abs. 1 lit. c (p. 23); ${GUIDE} p. 32 (640, Staatssteuer); bl-na-steuerbuch p. 142 (29 Nr. 5, Ziffer 1.2)`,
  },
  training: {
    value: 1_200_000,
    source: `${LAW} § 29 Abs. 1 lit. kter (p. 23 and 24); ${GUIDE} p. 33 (650, Staatssteuer, pro Person und Jahr)`,
  },
  twoEarner: {
    value: 100_000,
    source: `${LAW} § 8 Abs. 3 (p. 5); ${GUIDE} p. 34 (680, Staatssteuer)`,
  },
  party: {
    value: 1_000_000,
    source: `${LAW} § 29 Abs. 1 lit. lbis (p. 24); ${GUIDE} p. 36 (735, Staatssteuer)`,
  },
  pensioner: {
    value: {
      ahv: { single: 3_276_000, couple: 4_914_000 },
      iv: { single: 3_024_000, couple: 4_536_000 },
      singleBp: 4_000,
      singleStep: 10_000,
      coupleBp: 6_000,
      coupleStep: 25_000,
    },
    source: `${LAW} § 33 Abs. 1 lit. c (p. 27); ${GUIDE} p. 39 (770, AHV: bis 32’760 and bis 49’140), p. 40 (771, IV: bis 30’240 and bis 45’360); bl-2026-guide-informationen-neuerungen p. 1 (Abzug für AHV- und IV-Rentnerinnen und -Rentner); bl-na-steuerbuch p. 205 and 206 (33 Nr. 1, Ziffer 5.2)`,
  },
  childReduction: {
    value: 75_000,
    source: `${LAW} § 34 Abs. 4 (p. 28); ${GUIDE} p. 37 (750, Staatssteuer: CHF 750 pro Kind, vom Einkommens-Steuerbetrag); bl-na-steuerbuch p. 210 (34 Nr. 1, Ziffer 2.1)`,
  },
  wealthFree: {
    value: { family: 18_000_000, other: 9_000_000 },
    source: `${LAW} § 50 Abs. 1 (p. 31); ${GUIDE} p. 45 (900, 905); bl-2026-steuererklaerung-form p. 4 (900, 905)`,
  },
};
