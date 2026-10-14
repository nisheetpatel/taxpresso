// Deterministic Bern cantonal, communal and church tax (Kantons-, Gemeinde- und Kirchensteuern),
// tax years 2025 and 2026, every constant cited (SPEC.md section 7). Pure functions and data: not
// wired into the extension yet (docs/design/cantons.md). The federal tax, the federal partial flat
// amounts and the pillar 3a limits, and the helpers every canton shares, are in packages/rules-ch.
// Citations: "p." is the page of the PDF file; where a document prints its own page numbers
// differently (the 2025 guide's "Seite"), both are given.
export { computeReturn, allLines } from './compute.js';
export {
  assess,
  asItem,
  BeInputError,
  BeUnsupported,
  communeOf,
  incomeTotals,
  multiple,
  wealthTotals,
  type BeAssessInput,
  type IncomeTotals,
} from './assess.js';
export {
  BE_TAX_YEARS,
  beParamsFor,
  isBeTaxYear,
  type BeTaxYear,
  type BeYearParams,
} from './params.js';
export type { BeAmounts } from './amounts.js';
export {
  churchRate,
  communeByBfs,
  communeByName,
  communesFor,
  foldName,
  type BeCommune,
  type BeParish,
} from './communes.js';
export {
  ASSETS,
  DEBTS,
  DEDUCTIONS,
  INCOME,
  PERSONAL,
  RUBRICS,
  rubric,
  WEALTH_SOCIAL,
  type Rubric,
  type RubricCode,
} from './rubrics.js';
export { stepsTotal, tariffFraction, type StepTariff } from './tariff.js';
export {
  donationDeduction,
  drivingCost,
  flatShare,
  insuranceDeduction,
  mealsDeduction,
  medicalDeduction,
  modestIncomeDeduction,
  shareFloor,
  twoEarnerDeduction,
} from './rules.js';
export {
  churchRates,
  maxBurden,
  multipliers,
  sharedChildren,
  tariffRule,
  tariffSteps,
  wealthFreeBelow,
} from './law.js';
export { ESTIMATE_TEXT, NOTE } from './explain.js';
export type { Cited } from '@taxpresso/rules-ch';
export type * from './types.js';
// Bern behind the canton interface (packages/rules-ch, canton.ts); not wired into the extension.
export { bernInput, rules, type BernCantonal } from './canton.js';
