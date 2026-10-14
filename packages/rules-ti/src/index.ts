// Deterministic Ticino cantonal and communal income and wealth tax (imposta cantonale e comunale
// sul reddito e sulla sostanza, with the communal personal tax), tax years 2025 and 2026, every
// constant cited (SPEC.md section 7). Pure functions and data: not wired into the extension yet
// (docs/design/cantons.md). The federal tax, the pillar 3a rule and the helpers every canton shares
// are in packages/rules-ch.
// Citations: "p." is the page of the PDF file; the instructions print the same page numbers, the
// executive decrees print the page of the official bulletin (BU) instead. The return's line numbers
// (cifre) are those of the main return, Modulo 1 (ti-2025-form-modulo-1-de).
export { computeReturn, allLines, COMPUTE_RULES } from './compute.js';
export {
  assess,
  ASSESS_RULES,
  asIncomeItem,
  asWealthItem,
  communeOf,
  communeRef,
  subtotals,
  TiInputError,
  TiUnsupported,
  type TiAssessInput,
} from './assess.js';
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
export {
  ASSETS,
  CHILDCARE,
  DEBTS,
  DEDUCTIONS,
  EXEMPTION,
  INCOME,
  MEDICAL,
  PERSON_CODES,
  RUBRICS,
  rubric,
  SOCIAL,
  WEALTH_RUBRICS,
  WEALTH_SOCIAL,
  wealthRubric,
  type Rubric,
  type RubricCode,
  type WealthCode,
} from './rubrics.js';
export {
  avsExemption,
  debtInterestDeduction,
  drivingCost,
  insuranceCap,
  mealsCost,
  otherFlat,
  shareOfTax,
  twoEarnerDeduction,
} from './rules.js';
export {
  cantonalTax,
  childRule,
  communalTax,
  familyTaxation,
  professionalRule,
  salaryRule,
  tariffRule,
  wealthBrakeRule,
  wealthRule,
} from './law.js';
export { ESTIMATE_TEXT, NOTE } from './explain.js';
export type { Cited } from '@taxpresso/rules-ch';
export type * from './types.js';
// Ticino behind the canton interface (packages/rules-ch, canton.ts); not wired into the extension.
export { rules, ticinoInput, type TicinoCantonal } from './canton.js';
