// Rules of the St. Gallen texts that carry no yearly amount, with their pages: the tax law of the
// year (StG, sGS 811.1), the ordinance (StV, sGS 811.11, Stand 2024), the 2025 guide, the tariff of
// the year, the Steuerbuch's chapters and the table of multipliers. A 2026 rule cites the 2026 law
// and documents valid for every year, never the 2025 guide.
import type { Cited } from '@taxpresso/rules-ch';
import type { SgTaxYear } from './params.js';

const law = (y: SgTaxYear) => `sg-${y}-law-steuergesetz`;
const ORD = 'sg-na-law-steuerverordnung';
const GUIDE = 'sg-2025-guide-wegleitung';
const rule = (source: string): Cited<null> => ({ value: null, source });
/** The 2025 guide's page, for a 2025 rule only. */
const guide = (y: SgTaxYear, page: string) => (y === 2025 ? `; ${GUIDE} p. ${page}` : '');

/**
 * The einfache Steuer (the tax of the tariffs, at 100 percent) times the multipliers set every year:
 * the canton's, the political commune's and, for its members, the church's (StG Art. 5 and 6); the
 * guide multiplies the einfache Steuer by the Gesamtsteuerfuss, and Merkblatt 8 (2026) does the
 * same with the amount to the Rappen (Fr. 1’424.00 x 270 % = Fr. 3’844.80).
 */
export const multipliedTax = (y: SgTaxYear) =>
  rule(
    `${law(y)} Art. 5 and Art. 6 Abs. 1 and 2 (p. 2)${guide(y, '50 (Steuertarife, Beispiel für Ehepaar X)')}${y === 2026 ? '; sg-2026-guide-merkblatt-unterjaehrig p. 3 (8. Berechnung der Einkommenssteuer)' : ''}`,
  );

/**
 * Vollsplitting: married couples, and widowed, separated, divorced and single taxpayers who live
 * with children and mainly bear their upkeep, pay the rate of half their taxable income (StG Art. 50
 * Abs. 3 and 4), half the income rounded down to 100 francs (the tariff, p. 1).
 */
export const splittingRule = (y: SgTaxYear) =>
  rule(
    `${law(y)} Art. 50 Abs. 3 and 4 (p. 26); sg-${y}-tariff-einkommen-vermoegen p. 1 (Vollsplitting)${guide(y, '50 (Vollsplitting)')}`,
  );

/**
 * The child deductions: for each child in your parental care or custody whose upkeep you mainly
 * bear, and for whom you deduct no child support paid; not yet of school age, or in school or
 * training (an adult child in training too); its education costs above the excess (StG Art. 48
 * Abs. 1 lit. a). A child becomes of school age on the 1 August after its fourth birthday, with
 * kindergarten (Steuerbuch StB 48 Nr. 1, Ziff. 2.1.2).
 */
export const childRule = (y: SgTaxYear) =>
  rule(
    `${law(y)} Art. 48 Abs. 1 lit. a (p. 25 and 26); sg-na-deductions-kinderabzug p. 2 (Ziff. 2.1.2, Beginn der Schulpflicht)${guide(y, '13 and 31 (23.1 to 23.3)')}`,
  );

/**
 * Joint parental authority of parents taxed apart: the child deductions go to the parent who
 * receives child support for the child; without child support, to the parent who mainly bears its
 * upkeep (StG Art. 48 Abs. 1 lit. a); the one who pays child support deducts it instead (Steuerbuch
 * StB 48 Nr. 1, Ziff. 2.3). The childcare deduction follows the child deduction (StB 45 Nr. 14).
 */
export const sharedCustody = (y: SgTaxYear) =>
  rule(
    `${law(y)} Art. 48 Abs. 1 lit. a (p. 26: Stehen Kinder unter gemeinsamer elterlicher Sorge nicht gemeinsam besteuerter Eltern); sg-na-deductions-kinderabzug p. 5 to 7 (Ziff. 2.3); sg-na-deductions-kinderbetreuungskosten p. 2 (Ziff. 2)`,
  );

/** The family situation at the end of the tax year decides the social deductions. */
export const familySituation = (y: SgTaxYear) =>
  rule(`${law(y)} Art. 48 Abs. 2 (p. 26), Art. 64 Abs. 2 (p. 29)`);

/**
 * The commune where you lived on 31 December taxes the whole year: between communes, the law applies
 * the federal rules between cantons (StG Art. 233), and the canton where you lived at the end of the
 * year taxes the whole year (guide p. 11, Zuzug aus einem anderen Kanton).
 */
export const communeAtYearEnd = (y: SgTaxYear) =>
  rule(`${law(y)} Art. 233 Abs. 1 (p. 90)${guide(y, '11 (Zuzug aus einem anderen Kanton)')}`);

/**
 * The church tax: members of a recognised church pay its multiplier on the einfache Steuer to the
 * church area where they live (StG Art. 3, Art. 6 Abs. 2 lit. b; StV Art. 1); in a mixed marriage,
 * half to each spouse's church (StV Art. 2 Abs. 1). The table gives each area's Catholic and
 * Evangelical rates and the Christ Catholic rate for the whole canton.
 */
export const churchRule = (y: SgTaxYear) =>
  rule(
    `${law(y)} Art. 3 and Art. 6 Abs. 2 lit. b (p. 2); ${ORD} Art. 1 Abs. 1 and Art. 2 Abs. 1 (p. 1); sg-${y}-communal-steuerfuesse p. 1 (Bemerkungen)`,
  );

/**
 * The insurance deduction's higher amounts when neither the pension fund nor pillar 3a is deducted
 * (for a couple: neither spouse), as the guide and Form 6 word it (StG Art. 45 Abs. 1 lit. g).
 */
export const insuranceExtraRule = (y: SgTaxYear) =>
  rule(
    `${law(y)} Art. 45 Abs. 1 lit. g (p. 23)${y === 2025 ? `; ${GUIDE} p. 27 (14.: wenn keine Beiträge für die berufliche Vorsorge oder eine gebundene Selbstvorsorge abgezogen werden; bei Verheirateten bei beiden Partnern); sg-2025-form-versicherungspraemien-krankheitskosten p. 1 (B. a and b)` : ''}`,
  );

/**
 * Childcare: by third parties, for a child under 14 who lives with you, while you work, train or
 * cannot work; a couple living together, both (StG Art. 45 Abs. 1 lit. h; StB 45 Nr. 14).
 */
export const childcareRule = (y: SgTaxYear) =>
  rule(
    `${law(y)} Art. 45 Abs. 1 lit. h (p. 24); sg-na-deductions-kinderbetreuungskosten p. 1 (Ziff. 2)${guide(y, '28 (16.2)')}`,
  );

/**
 * Other professional costs: the flat amount is a share of the net salary as the ordinance defines
 * it, the gross salary less the AHV and pension fund contributions without the buy-ins (StV Art. 21
 * Abs. 2); higher actual costs instead, on proof (Abs. 3; Form 4, 3.2).
 */
export const otherCostsRule = (y: SgTaxYear) =>
  rule(`${ORD} Art. 21 Abs. 2 and 3 (p. 6 and 7)${guide(y, '24 (3.1, 3.2)')}`);

/**
 * A side job: its costs up to its net income while that is at most the minimum; above it, the flat
 * share between the minimum and the maximum (guide p. 25; StV Art. 22 adopts the federal flat rates).
 */
export const sideJobRule = (y: SgTaxYear) =>
  rule(
    `${ORD} Art. 22 Abs. 1 (p. 7)${y === 2025 ? `; ${GUIDE} p. 25 (5.)` : '; ch-2026-ifd-instructions-personnes-physiques p. 7 (Activité accessoire)'}`,
  );

/**
 * Pension fund buy-ins taken from the salary are already off the net salary (box 11); those paid
 * directly are deducted on 13.2 (guide p. 26; StG Art. 45 Abs. 1 lit. d).
 */
export const buyInRule = (y: SgTaxYear) =>
  rule(`${law(y)} Art. 45 Abs. 1 lit. d (p. 23)${guide(y, '15 and 26 (1.1, 13.2)')}`);

/** For the sources test: every rule of this module for a year. */
export const LAW_RULES = (y: SgTaxYear): Cited<null>[] => [
  multipliedTax(y),
  splittingRule(y),
  childRule(y),
  sharedCustody(y),
  familySituation(y),
  communeAtYearEnd(y),
  churchRule(y),
  insuranceExtraRule(y),
  childcareRule(y),
  otherCostsRule(y),
  sideJobRule(y),
  buyInRule(y),
];
