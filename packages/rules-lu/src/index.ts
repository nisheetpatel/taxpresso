// Lucerne's tax constants, tax years 2025 and 2026, every one cited (SPEC.md section 7): the income
// and wealth tariffs (StG § 57, § 60), the units of the state, the communes and the parishes, and
// the deduction amounts. The engine that uses them follows. Citations: "p." is the page of the PDF
// file; the guides print the same page numbers.
export {
  isLuTaxYear,
  LU_TAX_YEARS,
  luParamsFor,
  type LuTaxYear,
  type LuYearParams,
} from './params.js';
export type { LuAmounts } from './amounts.js';
export {
  stepsTotal,
  unitTaxFraction,
  wealthTaxFraction,
  type UnitTariff,
  type WealthTariff,
} from './tariff.js';
export {
  communeByName,
  communesFor,
  foldName,
  slugOf,
  type LuCommune,
  type LuParish,
} from './communes.js';
export type { Cited } from '@taxpresso/rules-ch';
