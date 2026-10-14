// Deterministic Basel-Stadt cantonal and communal income and wealth tax (Einkommens- und
// Vermögenssteuer, with the communal tax of Riehen and Bettingen) and the federal tax of the Bund
// column of its return, tax years 2025 and 2026, every constant cited (SPEC.md section 7). Pure
// functions and data, wired into the extension as a preview behind the canton registry
// (extension/src/cantons.ts, docs/design/cantons.md). The federal rules, the pillar 3a rule and the
// helpers every canton shares are in packages/rules-ch.
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
  FORM_B,
  FORM_W,
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
// Basel-Stadt behind the canton interface (packages/rules-ch, canton.ts).
export { baselInput, rules, type BaselCantonal } from './canton.js';
// The federal tax on the Basel-Stadt return (its Bund column).
export { federalReturn, federalTotals } from './ifd.js';
// The ledger read into Basel-Stadt's household input, and Basel-Stadt's keys and communes as its
// questionnaire offers them.
export { BASEL_READING, baselInputFromFacts, type BaselLedgerInput } from './from-ledger.js';
export { bsKeys, communeOfAnswer, communeOptions, type CommuneOption } from './keys.js';
// How a Basel-Stadt result reads in the generic views, and the official terms of its return.
export { view } from './view.js';
export { BS_TERMS } from './terms.js';
export { BS_OFFICIAL_DOCUMENTS, type OfficialDocument } from './official-documents.js';
