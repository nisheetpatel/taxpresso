// Lucerne deduction amounts, tax year 2025. Every value is read in the documents cited next to it:
// - lu-2025-law-steuergesetz: the Steuergesetz (StG, SRL 620) in force in 2025 (Stand 1 June 2025);
// - lu-2025-law-steuerverordnung: the Steuerverordnung (StV, SRL 621), Stand 1 January 2025;
// - lu-2025-tariff-tariftabellen-abzuege p. 2: the canton's table of the indexed deductions 2025;
// - lu-2025-deductions-abzuege-auf-einen-blick: the one-page overview, by Ziffer of the return;
// - lu-2025-deductions-steuerbuch-band1: the Luzerner Steuerbuch (the practice), Stand 1 January
//   2025, by chapter (StG § 33 Nr. 1 ...);
// - lu-2025-guide-wegleitung: the 2025 guide, by page.
// The flat professional costs follow the federal ordinance (StV § 11); their values are the canton's
// own documents'. Pillar 3a: the federal limits (StG § 40 Abs. 1 lit. e), from packages/rules-ch,
// which the guide prints (test/sources.test.ts checks they agree).
import { ifdParamsFor } from '@taxpresso/rules-ch';
import type { LuAmounts } from '../amounts.js';

const LAW = 'lu-2025-law-steuergesetz';
const STV = 'lu-2025-law-steuerverordnung';
const TABLE = 'lu-2025-tariff-tariftabellen-abzuege p. 2';
const GLANCE = 'lu-2025-deductions-abzuege-auf-einen-blick p. 1';
const BOOK = 'lu-2025-deductions-steuerbuch-band1';
const GUIDE = 'lu-2025-guide-wegleitung';

export const AMOUNTS_2025: LuAmounts = {
  commuteMax: {
    value: 650_000,
    source: `${LAW} § 33 Abs. 1 lit. a (p. 19); ${TABLE} (Fahrkostenabzug, max); ${GUIDE} p. 27`,
  },
  commuteBike: {
    value: 70_000,
    source: `${BOOK} p. 97 (§ 33 Nr. 1 Ziff. 3); ${GLANCE} (Ziffer 204/205); ${GUIDE} p. 27`,
  },
  commuteKm: {
    value: { car: 70, motorbike: 40 },
    source: `${BOOK} p. 97 (§ 33 Nr. 1 Ziff. 3); ${GLANCE} (Ziffer 208/209); ${GUIDE} p. 27`,
  },
  meals: {
    value: { perDay: 1_500, perYear: 320_000, halfPerDay: 750, halfPerYear: 160_000 },
    source: `${BOOK} p. 100 (§ 33 Nr. 2 Ziff. 1.1 and 1.2); ${GLANCE} (Ziffer 212/213, 214/215); ${GUIDE} p. 27 and 28`,
  },
  professionalFlat: {
    value: { rateBp: 300, min: 200_000, max: 400_000 },
    source: `${BOOK} p. 102 (§ 33 Nr. 3 Ziff. 1); ${GLANCE} (Ziffer 220/221); ${GUIDE} p. 28`,
  },
  sideJobFlat: {
    value: { rateBp: 2000, min: 80_000, max: 240_000 },
    source: `${BOOK} p. 112 (§ 33 Nr. 3 Ziff. 5); ${GLANCE} (Ziffer 236/237); ${GUIDE} p. 29`,
  },
  trainingMax: {
    value: 1_300_000,
    source: `${LAW} § 40 Abs. 1 lit. m (p. 23); ${TABLE} (Aus- und Weiterbildung, max); ${GUIDE} p. 29`,
  },
  debtInterestExtra: {
    value: 5_000_000,
    source: `${LAW} § 40 Abs. 1 lit. a (p. 21); ${GUIDE} p. 29`,
  },
  pillar3a: {
    value: ifdParamsFor(2025).pillar3a.value,
    source: `${LAW} § 40 Abs. 1 lit. e (p. 22); ${GUIDE} p. 30 (260/261); ${GLANCE} (Ziffer 260/261)`,
  },
  insurance: {
    value: {
      married: 520_000,
      other: 260_000,
      marriedNone: 670_000,
      otherNone: 330_000,
      perChild: 70_000,
    },
    source: `${LAW} § 40 Abs. 1 lit. g (p. 22); ${TABLE} (Versicherungsabzüge); ${BOOK} p. 166 (§ 40 Nr. 6 Ziff. 1.1); ${GUIDE} p. 31 and 54`,
  },
  medicalThresholdBp: {
    value: 500,
    source: `${LAW} § 40 Abs. 1 lit. h (p. 22); ${GUIDE} p. 32 (320)`,
  },
  donations: {
    value: { min: 10_000, shareBp: 2000 },
    source: `${LAW} § 40 Abs. 1 lit. i (p. 22); ${TABLE} (Freiwillige Zuwendungen, min); ${GUIDE} p. 32 (324)`,
  },
  partyMax: {
    value: 560_000,
    source: `${LAW} § 40 Abs. 1 lit. k (p. 23); ${TABLE} (Parteispendenabzug, max); ${GUIDE} p. 33 (325)`,
  },
  twoEarner: {
    value: 500_000,
    source: `${LAW} § 40 Abs. 2 (p. 23); ${STV} § 13 (p. 6); ${TABLE} (Zweitverdienerabzug); ${GUIDE} p. 33 (326)`,
  },
  degressive: {
    value: { shareBp: 1400, single: 5_000_000, family: 8_000_000 },
    source: `${LAW} § 42 Abs. 1 lit. e and f (p. 24); ${BOOK} p. 195 (§ 42 Nr. 6); ${GUIDE} p. 33 (340)`,
  },
  child: {
    value: { base: 800_000, away: 1_320_000 },
    source: `${LAW} § 42 Abs. 1 lit. a (p. 24); ${TABLE} (Kinderabzüge); ${BOOK} p. 186 (§ 42 Nr. 2 Ziff. 1.1); ${GUIDE} p. 34 (350, 352)`,
  },
  ownCare: {
    value: 200_000,
    source: `${LAW} § 42 Abs. 1 lit. b (p. 24); ${TABLE} (Eigenbetreuungskosten); ${BOOK} p. 190 (§ 42 Nr. 4 Ziff. 1); ${GUIDE} p. 34 (353)`,
  },
  childcareMax: {
    value: 2_000_000,
    source: `${LAW} § 42 Abs. 1 lit. b (p. 24); ${BOOK} p. 190 (§ 42 Nr. 4 Ziff. 1, Maximaler Fremdbetreuungsabzug inkl. Eigenbetreuungsabzug); ${GUIDE} p. 34 (360: CHF 18,000 on top of own care)`,
  },
  sharedCare: {
    value: { own: 100_000, max: 1_000_000, thirdPartyTotal: 1_800_000 },
    source: `${STV} § 14b (p. 6); ${BOOK} p. 190 (§ 42 Nr. 4 Ziff. 1.1); ${GUIDE} p. 34 (353)`,
  },
  assetManagement: {
    value: { bp: 30, upTo: 300_000_000, bpAbove: 10 },
    source: `${GUIDE} p. 40 (Kosten für die Verwaltung von Wertschriften des Privatvermögens); ${GLANCE} (WV Ziffer 6)`,
  },
  wealthFree: {
    value: { married: 12_500_000, other: 6_250_000, perChild: 1_250_000 },
    source: `${LAW} § 52 Abs. 1 (p. 28); ${GLANCE} (Ziffer 472, 473, 474); ${GUIDE} p. 36 (472 to 474)`,
  },
};
