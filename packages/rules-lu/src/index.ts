// Deterministic Lucerne state, communal and church income and wealth tax (Staats-, Gemeinde- und
// Kirchensteuern) with the Personalsteuer, and the federal tax as the canton's Ergänzungsblatt
// derives it from the return, tax years 2025 and 2026, every constant cited (SPEC.md section 7).
// Pure functions and data, wired into the extension as a preview behind the canton registry
// (extension/src/cantons.ts, docs/design/cantons.md). The federal rules, the pillar 3a limits and
// the helpers every canton shares are in packages/rules-ch.
// Citations: "p." is the page of the PDF file; the guides print the same page numbers. The
// return's Ziffern are those of the 2025 forms as the guide prints them (lu-2025-guide-wegleitung
// p. 13 to 19); the forms themselves cannot be downloaded.
export { computeReturn, allLines } from './compute.js';
export {
  assess,
  asItem,
  communeOf,
  communeRef,
  incomeTotals,
  LuInputError,
  LuUnsupported,
  units,
  wealthTotals,
  type LuAssessInput,
} from './assess.js';
export {
  isLuTaxYear,
  LU_TAX_YEARS,
  luParamsFor,
  type LuTaxYear,
  type LuYearParams,
} from './params.js';
export type { LuAmounts } from './amounts.js';
export {
  stepsTotal,
  unitTaxFraction,
  wealthTaxFraction,
  type UnitTariff,
  type WealthTariff,
} from './tariff.js';
export {
  communeByName,
  communesFor,
  foldName,
  slugOf,
  type LuCommune,
  type LuParish,
} from './communes.js';
export {
  ADDITIONAL,
  ASSETS,
  DEBTS,
  anyRubric,
  DEDUCTIONS,
  FEDERAL_RUBRICS,
  FORM_ORDER,
  INCOME,
  PERSON_CODES,
  RUBRICS,
  rubric,
  SOCIAL,
  WEALTH_FREE,
  WEALTH_RUBRICS,
  type FederalCode,
  type Rubric,
  type RubricCode,
  type WealthCode,
} from './rubrics.js';
export {
  assetManagementFlat,
  careDeduction,
  degressiveDeduction,
  donationDeduction,
  drivingCost,
  flatShare,
  insuranceDeduction,
  mealsDeduction,
  medicalDeduction,
  twoEarnerDeduction,
} from './rules.js';
export {
  churchShares,
  familyTariff,
  maxBurden,
  multipliers,
  personalTax,
  sharedChildren,
  tariffSteps,
} from './law.js';
export { ESTIMATE_TEXT, NOTE } from './explain.js';
export type { Cited } from '@taxpresso/rules-ch';
export type * from './types.js';
// Lucerne behind the canton interface (packages/rules-ch, canton.ts).
export { lucerneInput, rules, type LucerneCantonal } from './canton.js';
// The federal tax, as the Ergänzungsblatt Direkte Bundessteuer derives it from the return.
export { FEDERAL_NOTE, federalReturn, federalTotals } from './ifd.js';
// The ledger read into Lucerne's household input, its keys and the communes its questionnaire offers.
export {
  LUCERNE_READING,
  lucerneInputFromFacts,
  NOTE_VALUABLES,
  type LucerneLedgerInput,
} from './from-ledger.js';
export {
  communeOfAnswer,
  communeOptions,
  CONFESSIONS,
  luKeys,
  type CommuneOption,
} from './keys.js';
// How a Lucerne result reads in the generic views, and the official terms of the return.
export { view } from './view.js';
export { LU_TERMS } from './terms.js';
export { LU_OFFICIAL_DOCUMENTS, type OfficialDocument } from './official-documents.js';
