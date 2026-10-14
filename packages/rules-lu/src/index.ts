// Deterministic Lucerne state, communal and church income and wealth tax (Staats-, Gemeinde- und
// Kirchensteuern) with the Personalsteuer, tax years 2025 and 2026, every constant cited (SPEC.md
// section 7). Pure functions and data: not wired into the extension yet (docs/design/cantons.md).
// The federal tax, the pillar 3a limits and the helpers every canton shares are in
// packages/rules-ch.
// Citations: "p." is the page of the PDF file; the guides print the same page numbers. The
// return's Ziffern are those of the 2025 forms as the guide prints them (lu-2025-guide-wegleitung
// p. 13 to 19); the forms themselves cannot be downloaded.
export { computeReturn, allLines } from './compute.js';
export {
  assess,
  asItem,
  communeOf,
  communeRef,
  incomeTotals,
  LuInputError,
  LuUnsupported,
  units,
  wealthTotals,
  type LuAssessInput,
} from './assess.js';
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
export {
  ADDITIONAL,
  ASSETS,
  DEBTS,
  DEDUCTIONS,
  FORM_ORDER,
  INCOME,
  PERSON_CODES,
  RUBRICS,
  rubric,
  SOCIAL,
  WEALTH_FREE,
  WEALTH_RUBRICS,
  type Rubric,
  type RubricCode,
  type WealthCode,
} from './rubrics.js';
export {
  assetManagementFlat,
  careDeduction,
  degressiveDeduction,
  donationDeduction,
  drivingCost,
  flatShare,
  insuranceDeduction,
  mealsDeduction,
  medicalDeduction,
  twoEarnerDeduction,
} from './rules.js';
export {
  churchShares,
  familyTariff,
  maxBurden,
  multipliers,
  personalTax,
  sharedChildren,
  tariffSteps,
} from './law.js';
export { ESTIMATE_TEXT, NOTE } from './explain.js';
export type { Cited } from '@taxpresso/rules-ch';
export type * from './types.js';
// Lucerne behind the canton interface (packages/rules-ch, canton.ts); not wired into the extension.
export { lucerneInput, rules, type LucerneCantonal } from './canton.js';
