// Deterministic Aargau cantonal, communal and church tax (Kantons-, Gemeinde- und Kirchensteuern),
// tax years 2025 and 2026, every constant cited (SPEC.md section 7). Pure functions and data: not
// wired into the extension yet (docs/design/cantons.md). The federal tax, the pillar 3a rule and the
// helpers every canton shares are in packages/rules-ch.
// Citations: "p." is the page of the PDF file (the Aargau documents print the same numbers).
export { computeReturn, allLines } from './compute.js';
export {
  AgInputError,
  AgUnsupported,
  asItem,
  assess,
  communeOf,
  incomeTotals,
  wealthTotals,
  type AgAssessInput,
  type IncomeTotals,
} from './assess.js';
export {
  AG_TAX_YEARS,
  agParamsFor,
  isAgTaxYear,
  type AgTaxYear,
  type AgYearParams,
} from './params.js';
export type { AgAmounts } from './amounts.js';
export {
  churchRate,
  churchRates,
  communeByName,
  communesFor,
  foldName,
  slugOf,
  type AgCommune,
  type AgParish,
} from './communes.js';
export {
  ASSETS,
  DEBTS,
  DEDUCTIONS,
  INCOME,
  LOW_INCOME,
  RUBRICS,
  rubric,
  SOCIAL,
  WEALTH_FREE,
  type Rubric,
  type RubricCode,
} from './rubrics.js';
export {
  incomeSimpleTax,
  stepsTotal,
  tariffFraction,
  wealthSimpleTax,
  type StepTariff,
} from './tariff.js';
export {
  donationDeduction,
  drivingCost,
  flatShare,
  lowIncomeDeduction,
  mealsDeduction,
  medicalDeduction,
  round10,
  twoEarnerDeduction,
} from './rules.js';
export {
  churchRule,
  lowIncomeSteps,
  maxBurden,
  multipliers,
  sharedChildren,
  tariffRule,
  tariffSteps,
  taxRounding,
} from './law.js';
export { ESTIMATE_TEXT, NOTE } from './explain.js';
export type { Cited } from '@taxpresso/rules-ch';
export type * from './types.js';
// Aargau behind the canton interface (packages/rules-ch, canton.ts); not wired into the extension.
export { aargauInput, rules, type AargauCantonal } from './canton.js';
