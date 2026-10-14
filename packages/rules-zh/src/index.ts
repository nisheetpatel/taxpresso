// Deterministic Zurich cantonal and communal tax (Staats- und Gemeindesteuern) and the federal tax
// of its Bundessteuer column, tax years 2025 and 2026, every constant cited (SPEC.md section 7).
// Pure functions and data, wired into the extension behind the canton registry
// (extension/src/cantons.ts, docs/design/cantons.md). The federal tax and the helpers every canton
// shares are in packages/rules-ch.
export { computeReturn, allLines } from './compute.js';
export {
  assess,
  asItem,
  communeRate,
  incomeTotals,
  ZhInputError,
  type IncomeTotals,
  type ZhAssessInput,
} from './assess.js';
export {
  ZH_TAX_YEARS,
  isZhTaxYear,
  zhParamsFor,
  type ZhTaxYear,
  type ZhYearParams,
} from './params.js';
export type { ZhAmounts } from './amounts.js';
export {
  communeByBfs,
  communeByName,
  communesFor,
  foldName,
  type CommuneRates,
} from './communes.js';
export { RUBRICS, rubric, personCode, type Rubric, type RubricCode } from './rubrics.js';
export { stepsTotal, tariffFraction, type StepTariff } from './tariff.js';
export {
  donationDeduction,
  drivingCost,
  flatShare,
  insuranceCap,
  mealsDeduction,
  medicalDeduction,
  pillar3aCap,
  twoEarner,
} from './rules.js';
export { churchSplit, multipliers, personalTax, tariffRule } from './law.js';
export { ESTIMATE_TEXT, NOTE } from './explain.js';
export { chf } from './calc.js';
export type { Cited } from '@taxpresso/rules-ch';
export type * from './types.js';
// Zurich behind the canton interface (packages/rules-ch, canton.ts).
export { rules, zurichInput, type ZurichCantonal } from './canton.js';
// The ledger read into Zurich's household input.
export {
  NOTE_CHURCH,
  NOTE_MARRIED_TARIFF,
  NOTE_VALUABLES,
  ZURICH_READING,
  zurichInputFromFacts,
  type ZurichLedgerInput,
  type ZurichWealth,
} from './from-ledger.js';
// The federal tax on the Zurich return (the Bundessteuer column).
export { federalReturn } from './ifd.js';
export {
  ASSETS,
  DEBTS,
  FORM_ORDER,
  formPlace,
  INCOME,
  VERSICHERUNG,
  type ItemPartCode,
} from './rubrics.js';
export type { ItemPart } from './types.js';
// Zurich's ledger keys and the communes as its questionnaire offers them.
export {
  communeOfAnswer,
  communeOptions,
  parishChoices,
  zurichKeys,
  type CommuneOption,
} from './keys.js';
// The words of the final check for a Zurich return, and the official documents it links.
export { ZH_FINAL_CHECK, ZH_FORM_NOTE } from './final-check.js';
export { ZH_OFFICIAL_DOCUMENTS, type OfficialDocument } from './official-documents.js';
