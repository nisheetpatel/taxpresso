// Deterministic St. Gallen cantonal, communal and church income and wealth tax (Kantons-, Gemeinde-
// und Kirchensteuer) and the federal tax the tax office derives from the same return, tax years 2025
// and 2026, every constant cited (SPEC.md section 7). Pure functions and data, wired into the
// extension as a preview behind the canton registry (extension/src/cantons.ts,
// docs/design/cantons.md). The federal rules, the pillar 3a rule and the helpers every canton
// shares are in packages/rules-ch.
// Citations: "p." is the page of the PDF file; the guide prints the same page numbers. The return's
// codes are those of the 2025 return (sg-2025-form-steuererklaerung) and its Form 4; no 2026 return
// is published yet. Open points and conflicts: docs/sources/sg/NOTES.md, "Open points for the rules".
export { computeReturn, allLines, COMPUTE_RULES } from './compute.js';
export {
  assess,
  ASSESS_RULES,
  asIncomeItem,
  asWealthItem,
  communeOf,
  communeRef,
  pc,
  percentOf,
  SgInputError,
  subtotals,
  type SgAssessInput,
} from './assess.js';
export {
  isSgTaxYear,
  SG_TAX_YEARS,
  sgParamsFor,
  type SgTaxYear,
  type SgYearParams,
} from './params.js';
export type { SgAmounts } from './amounts.js';
export {
  areaByName,
  churchRate,
  communeByName,
  communesFor,
  foldName,
  slugOf,
  type Confession,
  type SgChurchArea,
  type SgCommune,
} from './communes.js';
export {
  ALLOWANCES,
  ASSETS,
  DEBTS,
  DEDUCTIONS,
  INCOME,
  NET_DEDUCTIONS,
  FEDERAL_RUBRICS,
  FEDERAL_SOCIAL,
  federalRubric,
  ORDER,
  PERSON_CODES,
  RUBRICS,
  rubric,
  SOCIAL,
  WEALTH_ORDER,
  WEALTH_RUBRICS,
  wealthRubric,
  type FederalCode,
  type Rubric,
  type RubricCode,
  type WealthCode,
} from './rubrics.js';
export {
  bracketTenths,
  incomeTariffTax,
  ratePercent,
  wealthTariffTax,
  type IncomeTariff,
  type IncomeTariffTax,
  type WealthTariff,
} from './tariff.js';
export { educationDeduction, insuranceCap, otherFlat, sideJobFlat, vehicleCost } from './rules.js';
export {
  buyInRule,
  childcareRule,
  childRule,
  churchRule,
  communeAtYearEnd,
  familySituation,
  insuranceExtraRule,
  LAW_RULES,
  multipliedTax,
  otherCostsRule,
  sharedCustody,
  sideJobRule,
  splittingRule,
} from './law.js';
export { churchAreaNote, ESTIMATE_TEXT, NOTE } from './explain.js';
export type { Cited } from '@taxpresso/rules-ch';
export type * from './types.js';
// St. Gallen behind the canton interface (packages/rules-ch, canton.ts).
export { rules, stGallenInput, type StGallenCantonal } from './canton.js';
// The federal tax the tax office derives from the same return.
export { FEDERAL_NOTE, federalReturn, federalTotals } from './ifd.js';
// The ledger read into St. Gallen's household input.
export {
  NOTE_VALUABLES,
  ST_GALLEN_READING,
  stGallenInputFromFacts,
  type StGallenLedgerInput,
} from './from-ledger.js';
// The keys of the questionnaire and the communes and church areas it offers.
export {
  areaOfAnswer,
  areaOptions,
  communeOfAnswer,
  communeOptions,
  sgKeys,
  type AreaChurch,
  type AreaOption,
  type CommuneOption,
} from './keys.js';
// How a St. Gallen result reads in the generic views, and the official terms of the return.
export { view } from './view.js';
export { SG_TERMS } from './terms.js';
export { SG_OFFICIAL_DOCUMENTS, type OfficialDocument } from './official-documents.js';
