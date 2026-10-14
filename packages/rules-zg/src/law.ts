// Rules of the Zug texts that carry no yearly amount, with their pages: the tax law (StG, BGS 632.1;
// for 2025 the version of 1 January 2024, for 2026 that of 1 January 2026, with the same page
// numbers), its ordinance (Verordnung zum Steuergesetz, BGS 632.11), the 2025 guide (the 2026 guide
// is not published: where only the guide states a practice, the 2026 rule cites the 2025 guide and
// says so), the Steuerbuch and the table of Steuerfüsse.
import type { Cited } from '@taxpresso/rules-ch';
import type { ZgTaxYear } from './params.js';

const law = (y: ZgTaxYear) => `zg-${y}-law-steuergesetz`;
const GUIDE = 'zg-2025-guide-wegleitung';
const ORD = 'zg-na-law-verordnung-steuergesetz';
const rule = (source: string): Cited<null> => ({ value: null, source });

/** The return takes whole francs (keine Rappenbeträge). */
export const wholeFrancs = () => rule(`${GUIDE} p. 4 (Erfassen Sie bitte keine Rappenbeträge)`);

/**
 * The tariffs give the einfache Steuer (100 %); the canton, the commune, the parishes and the
 * Bürgergemeinden each levy their Steuerfuss of it, those in force at the end of the year (StG § 2
 * Abs. 1 and 4, §§ 168 to 170).
 */
export const simpleTaxRule = (y: ZgTaxYear) =>
  rule(
    `${law(y)} § 2 Abs. 1 and 4 (p. 1 and 2), § 168 (p. 83), § 169 Abs. 1 and § 170 Abs. 1 (p. 84); zg-${y}-communal-steuerfuesse (p. 1: in % der einfachen Steuer)`,
  );

/**
 * The Mehrpersonentarif: married couples, and anyone single who lives alone with their own children
 * in the same household and mainly supports them; everyone else the Grundtarif (StG § 35).
 */
export const tariffRule = (y: ZgTaxYear) =>
  rule(`${law(y)} § 35 Abs. 1 and 2 (p. 26${y === 2026 ? ' and 27' : ''})`);

/** The family situation at the end of the year decides the social deductions and the tariffs. */
export const familySituation = (y: ZgTaxYear) =>
  rule(`${law(y)} § 33 Abs. 3 (p. 25), § 44 Abs. 3 (p. 31); ${GUIDE} p. 13`);

/**
 * The commune where you lived on 31 December taxes the whole year, and so do its parish and the
 * Bürgergemeinde (StG § 171 with § 11 Abs. 3).
 */
export const communeAtYearEnd = (y: ZgTaxYear) =>
  rule(`${law(y)} § 171 Abs. 1 and 2 (p. 84), § 11 Abs. 3 (p. 6)`);

/**
 * Parents not taxed together, alternating custody: the parent who receives child support for the
 * children gets the large personal deduction, the child deduction and the Mehrpersonentarif;
 * without child support, the parent with the larger share of their actual care. The other parent
 * has the Grundtarif and the small personal deduction (Verordnung § 18 Abs. 2 and 3). Without child
 * support, the insurance deduction for the children is shared half and half (guide, Code 230).
 */
export const sharedCustody = () =>
  rule(`${ORD} § 18 Abs. 2 and 3 (p. 6); ${GUIDE} p. 13, p. 37 (Code 230, Hinweis)`);

/** A minor child's income and wealth are taxed with the parent who has its child deduction. */
export const childrenIncome = (y: ZgTaxYear) => rule(`${law(y)} § 8 Abs. 3 (p. 5)`);

/**
 * The child deduction: minors in your parental care or custody, and adult children in training
 * whom you mainly support; more from the year the child turns 15 (StG § 33 Abs. 1 Ziff. 2).
 */
export const childRule = (y: ZgTaxYear) =>
  rule(
    `${law(y)} § 33 Abs. 1 Ziff. 2 (p. 25)${y === 2025 ? `; ${GUIDE} p. 41 (Code 403, 403a)` : ''}`,
  );

/**
 * Own care of a child under 15 with a child deduction (Eigenbetreuung): not on top of the childcare
 * deduction; when that deduction is lower, own care instead (StG § 33 Abs. 2 and 2bis).
 */
export const ownCareRule = (y: ZgTaxYear) =>
  rule(
    `${law(y)} § 33 Abs. 2 and 2bis (p. 25); zg-2026-deductions-steuerbuch-eigenbetreuung (22.8: keine Kumulation)`,
  );

/**
 * Childcare by others: for a child under 14 living with you, while you work, train or cannot work;
 * a married couple only when neither can care for the child (StG § 30 Abs. 1 Bst. l).
 */
export const childcareRule = (y: ZgTaxYear) =>
  rule(
    `${law(y)} § 30 Abs. 1 Bst. l (p. 23)${y === 2025 ? `; ${GUIDE} p. 38 (Code 253: bei Ehepaaren nur, wenn beide Elternteile die Kinder nicht betreuen können)` : ''}`,
  );

/**
 * Insurance premiums and savings interest: up to the total; more when the taxpayer pays nothing
 * into the 2nd pillar or pillar 3a; more for each child with a child deduction (StG § 30 Abs. 1
 * Bst. g). Less paid, less deducted.
 */
export const insuranceRule = (y: ZgTaxYear) =>
  rule(
    `${law(y)} § 30 Abs. 1 Bst. g (p. 22: bis zum Gesamtbetrag)${y === 2025 ? `; ${GUIDE} p. 37 (Code 230: Sind die geleisteten Beiträge kleiner, entspricht der zulässige Abzug diesem kleineren Betrag)` : ''}`,
  );

/** Illness and accident costs: the part above 5 % of the net income 287 (StG § 31 Abs. 1 Bst. a). */
export const medicalRule = (y: ZgTaxYear) =>
  rule(`${law(y)} § 31 Abs. 1 Bst. a (p. 24)${y === 2025 ? `; ${GUIDE} p. 40 (Code 295)` : ''}`);

/** Donations: from CHF 100 in the year, up to 20 % of 287 (StG § 31 Abs. 1 Bst. b). */
export const donationsRule = (y: ZgTaxYear) =>
  rule(`${law(y)} § 31 Abs. 1 Bst. b (p. 24)${y === 2025 ? `; ${GUIDE} p. 41 (Code 296)` : ''}`);

/**
 * Both spouses work: up to the fixed amount of the lower earned income, that income being the salary
 * and allowances less the professional costs and the contributions to the 2nd pillar and 3a (StG
 * § 30 Abs. 1 Bst. h; Verordnung § 15). Not of pensions.
 */
export const twoEarnerRule = (y: ZgTaxYear) =>
  rule(
    `${law(y)} § 30 Abs. 1 Bst. h (p. 23); ${ORD} § 15 Abs. 1 and 2 (p. 5)${y === 2025 ? `; ${GUIDE} p. 40 (Code 260)` : ''}`,
  );

/**
 * AHV/IV pensioners: the deduction by net income (299), none when the net wealth (660) is above
 * the threshold (StG § 33 Abs. 1 Ziff. 3).
 */
export const pensionerRule = (y: ZgTaxYear) =>
  rule(`${law(y)} § 33 Abs. 1 Ziff. 3 (p. 25)${y === 2025 ? `; ${GUIDE} p. 42 (Code 406)` : ''}`);

/** Renters: a share of the net rent of the home you live in at your residence in Zug. */
export const rentRule = (y: ZgTaxYear) => rule(`${law(y)} § 33 Abs. 1 Ziff. 5 (p. 25)`);

/** The tax-free wealth: married couples, everyone else, each minor child with a child deduction. */
export const wealthAllowance = (y: ZgTaxYear) => rule(`${law(y)} § 44 Abs. 1 (p. 30)`);

/**
 * Church tax: members of the Roman Catholic and Evangelical Reformed parishes pay the parish's
 * Steuerfuss of the einfache Steuer; in a mixed marriage, in proportion of the family members who
 * belong to each parish (StG § 169 Abs. 1 and 2).
 */
export const churchRule = (y: ZgTaxYear) =>
  rule(`${law(y)} § 1 Abs. 1 (p. 1), § 169 Abs. 1 and 2 (p. 84)`);

/**
 * Bürgergemeinde tax: on the Ortsbürger living in the canton, at its Steuerfuss; a married couple
 * where only one spouse is a Zug Ortsbürger pays half the tax (StG § 170).
 */
export const citizensRule = (y: ZgTaxYear) => rule(`${law(y)} § 170 Abs. 1 to 3 (p. 84)`);
