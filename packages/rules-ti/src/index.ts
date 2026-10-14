// Ticino's cantonal and communal income and wealth tax (imposta cantonale e comunale sul reddito e
// sulla sostanza), tax years 2025 and 2026: the tariffs, the communes' multipliers and the amounts,
// every constant cited (SPEC.md section 7). Pure data and functions: not wired into the extension.
// Citations: "p." is the page of the PDF file; the instructions print the same page numbers, the
// executive decrees print the page of the official bulletin (BU) instead.
export {
  isTiTaxYear,
  TI_TAX_YEARS,
  tiParamsFor,
  type TiTaxYear,
  type TiYearParams,
} from './params.js';
export type { TiAmounts } from './amounts.js';
export { categoryOf, categoryTax, tariffBase, type CategoryTariff } from './tariff.js';
export { communeByName, communesFor, foldName, slugOf, type TiCommune } from './communes.js';
export type { Cited } from '@taxpresso/rules-ch';
