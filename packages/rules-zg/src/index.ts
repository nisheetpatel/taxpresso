// Deterministic Zug cantonal, communal and opt-in church and Bürgergemeinde income and wealth tax
// (Kantons-, Gemeinde-, Kirchen- und Bürgersteuer), tax years 2025 and 2026, every constant cited
// (SPEC.md section 7). So far the constants: the tariffs, the Steuerfüsse of the canton, the
// communes, the parishes and the Bürgergemeinden, and the deduction amounts. Not wired into the
// extension yet (docs/design/cantons.md).
// Citations: "p." is the page of the PDF file; the guide prints the same page numbers.
export {
  ZG_TAX_YEARS,
  zgParamsFor,
  isZgTaxYear,
  type ZgTaxYear,
  type ZgYearParams,
} from './params.js';
export type { IncomeRow, ZgAmounts } from './amounts.js';
export { communeByName, communesFor, foldName, slugOf, type ZgCommune } from './communes.js';
export { simpleRate, simpleTax } from './tariff.js';
export type { Cited } from '@taxpresso/rules-ch';
