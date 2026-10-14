// Deterministic Bern cantonal, communal and church tax (Kantons-, Gemeinde- und Kirchensteuern) and
// the federal tax of TaxMe's federal summary, tax years 2025 and 2026, every constant cited (SPEC.md
// section 7). Pure functions and data, wired into the extension as a preview behind the canton
// registry (extension/src/cantons.ts, docs/design/cantons.md). The federal rules, the federal
// partial flat amounts and the pillar 3a limits, and the helpers every canton shares, are in
// packages/rules-ch.
// Citations: "p." is the page of the PDF file; where a document prints its own page numbers
// differently (the 2025 guide's "Seite"), both are given.
export { computeReturn, allLines } from './compute.js';
export {
  assess,
  asItem,
  BeInputError,
  BeUnsupported,
  communeOf,
  incomeTotals,
  multiple,
  wealthTotals,
  type BeAssessInput,
  type IncomeTotals,
} from './assess.js';
export {
  BE_TAX_YEARS,
  beParamsFor,
  isBeTaxYear,
  type BeTaxYear,
  type BeYearParams,
} from './params.js';
export type { BeAmounts } from './amounts.js';
export {
  churchRate,
  communeByBfs,
  communeByName,
  communesFor,
  foldName,
  type BeCommune,
  type BeParish,
} from './communes.js';
export {
  ASSETS,
  DEBTS,
  DEDUCTIONS,
  INCOME,
  PERSONAL,
  RUBRICS,
  rubric,
  WEALTH_SOCIAL,
  type Rubric,
  type RubricCode,
} from './rubrics.js';
export { stepsTotal, tariffFraction, type StepTariff } from './tariff.js';
export {
  donationDeduction,
  drivingCost,
  flatShare,
  insuranceDeduction,
  mealsDeduction,
  medicalDeduction,
  modestIncomeDeduction,
  shareFloor,
  twoEarnerDeduction,
} from './rules.js';
export {
  churchRates,
  maxBurden,
  multipliers,
  sharedChildren,
  tariffRule,
  tariffSteps,
  wealthFreeBelow,
} from './law.js';
export { ESTIMATE_TEXT, NOTE } from './explain.js';
export type { Cited } from '@taxpresso/rules-ch';
export type * from './types.js';
// Bern behind the canton interface (packages/rules-ch, canton.ts).
export { bernInput, rules, type BernCantonal } from './canton.js';
// The federal tax on the Bern return (TaxMe's federal summary).
export { federalReturn, federalTotals } from './ifd.js';
// The ledger read into Bern's household input, Bern's keys and the communes and parishes its
// questionnaire offers.
export {
  BERN_READING,
  bernInputFromFacts,
  NOTE_CHURCH,
  type BernLedgerInput,
} from './from-ledger.js';
export {
  bernKeys,
  communeOfAnswer,
  communeOptions,
  parishOptions,
  partOfAnswer,
  type CommuneOption,
  type ParishOption,
} from './keys.js';
// How a Bern result reads in the generic views, and the official terms of the Bern return.
export { view } from './view.js';
export { BE_TERMS } from './terms.js';
export { BE_OFFICIAL_DOCUMENTS, type OfficialDocument } from './official-documents.js';
