// Deterministic Vaud cantonal and communal income and wealth tax (impôt cantonal et communal) and
// the federal tax of the guide's worksheet, tax years 2025 and 2026, every constant cited (SPEC.md
// section 7). Pure functions and data, wired into the extension as a preview behind the canton
// registry (extension/src/cantons.ts, docs/design/cantons.md). The federal rules, the pillar 3a
// rule and the helpers every canton shares are in packages/rules-ch.
// Citations: "p." is the page of the PDF file; the 2025 guide prints the same page numbers. The
// return's codes are those of form 21010 (vd-2025-form-21010).
export { computeReturn, allLines, COMPUTE_RULES } from './compute.js';
export {
  assess,
  ASSESS_RULES,
  asIncomeItem,
  asWealthItem,
  communeOf,
  communeRef,
  partsOf,
  partsText,
  subtotals,
  VdInputError,
  VdUnsupported,
  type VdAssessInput,
  type VdFamily,
} from './assess.js';
export {
  isVdTaxYear,
  VD_TAX_YEARS,
  vdParamsFor,
  type VdTaxYear,
  type VdYearParams,
} from './params.js';
export type { ByFamily, FlatShare, Floor, VdAmounts } from './amounts.js';
export {
  communeByName,
  communeRate,
  communesFor,
  foldName,
  slugOf,
  type VdCommune,
  type VdFraction,
} from './communes.js';
export {
  ASSETS,
  DEBTS,
  DEDUCTIONS,
  FEDERAL_RUBRICS,
  federalRubric,
  INCOME,
  RUBRICS,
  rubric,
  SOCIAL,
  SPECIAL,
  WEALTH_RUBRICS,
  wealthRubric,
  type FederalCode,
  type Rubric,
  type RubricCode,
  type WealthCode,
} from './rubrics.js';
export { scaleTax, type StepScale } from './tariff.js';
export {
  atRate,
  donationDeduction,
  drivingCost,
  familyDeduction,
  flatShare,
  housingDeduction,
  medicalDeduction,
  modestDeduction,
  prorated,
  publicTransportFlat,
  rateDeterminingIncome,
  ratePpm,
  twoEarnerDeduction,
} from './rules.js';
export {
  amountSteps,
  communalTax,
  familySituation,
  fractions,
  maxima,
  parts,
  personalTax,
  rateRule,
  sharedChildren,
} from './law.js';
export { ESTIMATE_TEXT, NOTE, personalTaxNote } from './explain.js';
export type { Cited } from '@taxpresso/rules-ch';
export type * from './types.js';
// Vaud behind the canton interface (packages/rules-ch, canton.ts).
export { rules, vaudInput, type VaudCantonal } from './canton.js';
// The federal tax on the guide's worksheet.
export { FEDERAL_NOTE, federalReturn, federalTotals } from './ifd.js';
// The ledger read into Vaud's household input, Vaud's keys and the communes and parts its
// questionnaire offers.
export {
  NOTE_VALUABLES,
  VAUD_READING,
  vaudInputFromFacts,
  type VaudLedgerInput,
} from './from-ledger.js';
export {
  communeOfAnswer,
  communeOptions,
  partOfAnswer,
  partOptions,
  vaudKeys,
  type CommuneOption,
  type PartOption,
} from './keys.js';
// How a Vaud result reads in the generic views, and the official terms of the Vaud return.
export { view } from './view.js';
export { VD_TERMS } from './terms.js';
export { VD_OFFICIAL_DOCUMENTS, type OfficialDocument } from './official-documents.js';
