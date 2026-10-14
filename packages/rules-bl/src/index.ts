// Deterministic Basel-Landschaft state, communal and church income and wealth tax (Staats-,
// Gemeinde- und Kirchensteuer) and the federal tax of the return's Bundessteuer column, tax years
// 2025 and 2026, every constant cited (SPEC.md section 7). Pure functions and data, wired into the
// extension as a preview behind the canton registry (extension/src/cantons.ts, docs/design/
// cantons.md). The federal rules, the pillar 3a rule and the helpers every canton shares are in
// packages/rules-ch.
// Citations: "p." is the page of the PDF file; the guides print the same page numbers. The return's
// codes are those of the 2025 return (bl-2025-steuererklaerung-form); 2026 adds 771. The church tax
// is computed for the Roman Catholic church in 2026 only (docs/sources/bl/NOTES.md, Open points).
export { computeReturn, allLines, COMPUTE_RULES } from './compute.js';
export {
  assess,
  ASSESS_RULES,
  asIncomeItem,
  asWealthItem,
  BlInputError,
  BlUnsupported,
  communeOf,
  communeRef,
  pc,
  rateText,
  subtotals,
  wealthTax,
  type BlAssessInput,
} from './assess.js';
export {
  BL_TAX_YEARS,
  blParamsFor,
  isBlTaxYear,
  type BlTaxYear,
  type BlYearParams,
} from './params.js';
export type { BlAmounts, PensionerLimits } from './amounts.js';
export {
  communeByName,
  communesFor,
  foldName,
  slugOf,
  type BlChurchRates,
  type BlCommune,
} from './communes.js';
export {
  ALLOWANCES,
  ASSETS,
  DEBTS,
  DEDUCTIONS,
  FEDERAL_SOCIAL,
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
export {
  formulaTax,
  incomeTariffTax,
  rateIncome,
  type IncomeFormula,
  type IncomeTariffTax,
  type Segment,
} from './tariff.js';
export { pensionerDeduction, sideJobFlat, twoEarnerDeduction, vehicleCost } from './rules.js';
export {
  childcareShared,
  childRule,
  churchRule,
  communalTax,
  communeAtYearEnd,
  donationsRule,
  familySituation,
  insuranceFlat,
  medicalRule,
  pensionerRule,
  sharedCustody,
  splittingRule,
  wealthAllowance,
  wholeFrancs,
} from './law.js';
export { ESTIMATE_TEXT, NOTE } from './explain.js';
export type { Cited } from '@taxpresso/rules-ch';
export type * from './types.js';
// Basel-Landschaft behind the canton interface (packages/rules-ch, canton.ts).
export { baselLandInput, rules, type BaselLandCantonal } from './canton.js';
// The federal tax on the Basel-Landschaft return (its Bundessteuer column).
export { FEDERAL_NOTE, federalReturn, federalTotals } from './ifd.js';
// The ledger read into Basel-Landschaft's household input, its keys and the communes its
// questionnaire offers.
export {
  BASEL_LAND_READING,
  baselLandInputFromFacts,
  NOTE_VALUABLES,
  type BaselLandLedgerInput,
} from './from-ledger.js';
export { blKeys, communeOfAnswer, communeOptions, type CommuneOption } from './keys.js';
// How a Basel-Landschaft result reads in the generic views, and the official terms of the return.
export { view } from './view.js';
export { BL_TERMS } from './terms.js';
export { BL_OFFICIAL_DOCUMENTS, type OfficialDocument } from './official-documents.js';
