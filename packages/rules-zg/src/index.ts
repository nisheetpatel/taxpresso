// Deterministic Zug cantonal, communal and opt-in church and Bürgergemeinde income and wealth tax
// (Kantons-, Gemeinde-, Kirchen- und Bürgersteuer) and the federal tax of form K's Bund column, tax
// years 2025 and 2026, every constant cited (SPEC.md section 7). Pure functions and data, wired into
// the extension as a preview behind the canton registry (extension/src/cantons.ts,
// docs/design/cantons.md). The federal rules, the pillar 3a rule and the helpers every canton
// shares are in packages/rules-ch.
// Citations: "p." is the page of the PDF file; the guide prints the same page numbers. The form's
// codes are those of the 2025 form K (the guide's sample return): the 2026 forms and guide are not
// published yet (docs/sources/zg/NOTES.md, Gaps).
export { computeReturn, allLines, COMPUTE_RULES } from './compute.js';
export {
  assess,
  ASSESS_RULES,
  asIncomeItem,
  asWealthItem,
  communeOf,
  communeRef,
  levy,
  pc,
  subtotals,
  wealthTotals,
  ZgInputError,
  type LevyPart,
  type ZgAssessInput,
} from './assess.js';
export {
  ZG_TAX_YEARS,
  zgParamsFor,
  isZgTaxYear,
  type ZgTaxYear,
  type ZgYearParams,
} from './params.js';
export type { IncomeRow, ZgAmounts } from './amounts.js';
export { communeByName, communesFor, foldName, slugOf, type ZgCommune } from './communes.js';
export {
  ALLOWANCES,
  ASSETS,
  DEBTS,
  DEDUCTIONS,
  FEDERAL_SOCIAL,
  FURTHER,
  INCOME,
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
export { simpleRate, simpleTax } from './tariff.js';
export {
  flatShare,
  pensionerAmount,
  rentDeduction,
  twoEarnerDeduction,
  vehicleCost,
} from './rules.js';
export {
  childcareRule,
  childRule,
  childrenIncome,
  churchRule,
  citizensRule,
  communeAtYearEnd,
  donationsRule,
  familySituation,
  insuranceRule,
  medicalRule,
  ownCareRule,
  pensionerRule,
  rentRule,
  sharedCustody,
  simpleTaxRule,
  tariffRule,
  twoEarnerRule,
  wealthAllowance,
  wholeFrancs,
} from './law.js';
export { ESTIMATE_TEXT, NOTE } from './explain.js';
export type { Cited } from '@taxpresso/rules-ch';
export type * from './types.js';
// Zug behind the canton interface (packages/rules-ch, canton.ts).
export { rules, zugInput, type ZugCantonal } from './canton.js';
// The federal tax on form K (its Bund column).
export { FEDERAL_NOTE, federalReturn, federalTotals } from './ifd.js';
// The ledger read into Zug's household input, its keys and the communes its questionnaire offers.
export {
  NOTE_VALUABLES,
  ZUG_READING,
  zugInputFromFacts,
  type ZugLedgerInput,
} from './from-ledger.js';
export { communeOfAnswer, communeOptions, zgKeys, type CommuneOption } from './keys.js';
// How a Zug result reads in the generic views, and the official terms of form K.
export { view } from './view.js';
export { ZG_TERMS } from './terms.js';
export { ZG_OFFICIAL_DOCUMENTS, type OfficialDocument } from './official-documents.js';
