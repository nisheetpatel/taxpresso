// Deterministic Basel-Stadt cantonal and communal income and wealth tax (Einkommens- und
// Vermögenssteuer, with the communal tax of Riehen and Bettingen), tax years 2025 and 2026, every
// constant cited (SPEC.md section 7). Pure functions and data: not wired into the extension yet
// (docs/design/cantons.md). The federal tax, the pillar 3a rule and the helpers every canton shares
// are in packages/rules-ch.
// Citations: "p." is the page of the PDF file; the guides print the same page numbers. The
// return's codes are those of the 2025 main form (bs-2025-form-hauptformular).
export { computeReturn, allLines, COMPUTE_RULES } from './compute.js';
export {
  assess,
  ASSESS_RULES,
  asIncomeItem,
  asWealthItem,
  BsInputError,
  BsUnsupported,
  communeOf,
  communeRef,
  subtotals,
  type BsAssessInput,
} from './assess.js';
export {
  BS_TAX_YEARS,
  bsParamsFor,
  isBsTaxYear,
  type BsTaxYear,
  type BsYearParams,
} from './params.js';
export type { BsAmounts, BsEstimate } from './amounts.js';
export { communeByName, communesFor, foldName, slugOf, type BsCommune } from './communes.js';
export {
  ALLOWANCES,
  ASSETS,
  DEBTS,
  DEDUCTIONS,
  INCOME,
  INCOME_BASED,
  PERSON_CODES,
  RUBRICS,
  rubric,
  SOCIAL,
  WEALTH_RUBRICS,
  wealthRubric,
  type Rubric,
  type RubricCode,
  type WealthCode,
} from './rubrics.js';
export {
  donationDeduction,
  drivingCost,
  illnessDeduction,
  lowIncomeReductionBp,
  mealsCost,
  professionalFlat,
  securitiesValue,
  shareOfTax,
  tariffTax,
} from './rules.js';
export {
  amountSteps,
  childRule,
  communalTax,
  exemptGoods,
  familySituation,
  lowYieldRule,
  professionalRule,
  retireeRule,
  securitiesRule,
  singleParentRule,
  tariffRule,
} from './law.js';
export { ESTIMATE_TEXT, NOTE } from './explain.js';
export type { Cited } from '@taxpresso/rules-ch';
export type * from './types.js';
// Basel-Stadt behind the canton interface (packages/rules-ch, canton.ts); not wired into the extension.
export { baselInput, rules, type BaselCantonal } from './canton.js';
