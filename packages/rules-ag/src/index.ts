// Deterministic Aargau cantonal, communal and church tax (Kantons-, Gemeinde- und Kirchensteuern)
// and the federal tax, tax years 2025 and 2026, every constant cited (SPEC.md section 7). Pure
// functions and data, wired into the extension as a preview behind the canton registry
// (extension/src/cantons.ts, docs/design/cantons.md). The federal rules, the pillar 3a rule and the
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
  FEDERAL_RUBRICS,
  FEDERAL_SOCIAL,
  INCOME,
  LOW_INCOME,
  RUBRIC_ORDER,
  RUBRICS,
  rubric,
  SOCIAL,
  WEALTH_FREE,
  type FederalRubricCode,
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
// Aargau behind the canton interface (packages/rules-ch, canton.ts).
export { aargauInput, rules, type AargauCantonal } from './canton.js';
// The federal tax of an Aargau household (the return has no federal column).
export { FEDERAL_NOTE, federalReturn, federalTotals } from './ifd.js';
// The ledger read into Aargau's household input, its keys and the communes and parishes its
// questionnaire offers.
export {
  AARGAU_READING,
  aargauInputFromFacts,
  NOTE_VALUABLES,
  type AargauLedgerInput,
} from './from-ledger.js';
export {
  agKeys,
  communeOfAnswer,
  communeOptions,
  parishOfAnswer,
  parishOptions,
  type CommuneOption,
  type ParishOption,
} from './keys.js';
// How an Aargau result reads in the generic views, and the official terms of the return.
export { view } from './view.js';
export { AG_TERMS } from './terms.js';
export { AG_OFFICIAL_DOCUMENTS, type OfficialDocument } from './official-documents.js';
