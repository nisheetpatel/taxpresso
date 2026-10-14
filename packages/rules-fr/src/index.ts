// Deterministic Fribourg cantonal, communal and church income and wealth tax (impôt cantonal,
// communal et paroissial), and the federal tax the tax office derives from the return, tax years
// 2025 and 2026, every constant cited (SPEC.md section 7). Pure functions and data, wired into the
// extension as a preview behind the canton registry (extension/src/cantons.ts,
// docs/design/cantons.md). The federal rules, the pillar 3a rule and the helpers every canton shares
// are in packages/rules-ch.
// Citations: "p." is the page of the PDF file (the 2025 guide prints one less). The return's codes
// are those the 2025 guide explains (fr-2025-guide-instructions-generales); the return itself is
// not in the sources library. Tax year 2026's taxes are not computed: its communal coefficients are
// not published in any document of the library (docs/sources/fr/NOTES.md); its lines are.
export { computeReturn, allLines, COMPUTE_RULES } from './compute.js';
export {
  assess,
  ASSESS_RULES,
  asIncomeItem,
  asWealthItem,
  communeOf,
  communeRef,
  formLines,
  FrInputError,
  FrUnsupported,
  pc,
  rateText,
  subtotals,
  type FrAssessInput,
} from './assess.js';
export {
  FR_TAX_YEARS,
  frParamsFor,
  isFrTaxYear,
  type FrTaxYear,
  type FrYearParams,
} from './params.js';
export type { FlatShare, FrAmounts, Tapered } from './amounts.js';
export {
  communeByRef,
  communesFor,
  foldName,
  parishOf,
  slugOf,
  type Church,
  type FrCommune,
  type FrParish,
} from './communes.js';
export {
  ASSETS,
  COSTS,
  DEBTS,
  anyRubric,
  DEDUCTIONS,
  FEDERAL_RUBRICS,
  INCOME,
  MODEST,
  RUBRICS,
  rubric,
  SOCIAL,
  WEALTH_RUBRICS,
  WEALTH_SOCIAL,
  wealthRubric,
  type FederalCode,
  type Rubric,
  type RubricCode,
  type WealthCode,
} from './rubrics.js';
export {
  classRate,
  hundreds,
  incomeBaseTax,
  incomeRate,
  rateIncome,
  wealthBaseTax,
  type IncomeScale,
} from './tariff.js';
export {
  carCost,
  childAmounts,
  prorated,
  sideJobFlat,
  tapered,
  twoEarnerDeduction,
} from './rules.js';
export {
  amountSteps,
  childrenAtCharge,
  coefficientRule,
  communalTax,
  communeMove,
  familyRate,
  familySituation,
  sharedCustody,
} from './law.js';
export { ESTIMATE_TEXT, NOTE } from './explain.js';
export type { Cited } from '@taxpresso/rules-ch';
export type * from './types.js';
// Fribourg behind the canton interface (packages/rules-ch, canton.ts).
export { fribourgInput, rules, type FribourgCantonal } from './canton.js';
// The federal tax, as the tax office derives it from the return.
export {
  FEDERAL_CHAPTER,
  FEDERAL_DIFFERENT,
  FEDERAL_NOTE,
  federalLines,
  federalReturn,
} from './ifd.js';
// The ledger read into Fribourg's household input, its keys and the communes its questionnaire offers.
export {
  FRIBOURG_READING,
  fribourgInputFromFacts,
  NOTE_VALUABLES,
  type FribourgLedgerInput,
} from './from-ledger.js';
export {
  CHILD_AGES,
  communeOfAnswer,
  communeOptions,
  CONFESSIONS,
  frKeys,
  parishOfAnswer,
  parishOptions,
  type ChildAge,
  type CommuneOption,
  type ParishOption,
} from './keys.js';
// How a Fribourg result reads in the generic views, and the official terms of the return.
export { view } from './view.js';
export { FR_TERMS } from './terms.js';
export { FR_OFFICIAL_DOCUMENTS, type OfficialDocument } from './official-documents.js';
