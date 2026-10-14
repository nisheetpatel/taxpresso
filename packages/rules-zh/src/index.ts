// Deterministic Zurich cantonal and communal tax (Staats- und Gemeindesteuern), tax years 2025
// and 2026, every constant cited (SPEC.md section 7). Pure functions and data: not wired into the
// extension yet (docs/design/cantons.md). The federal tax and the helpers every canton shares are
// in packages/rules-ch.
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
// Zurich behind the canton interface (packages/rules-ch, canton.ts); not wired into the extension.
export { rules, zurichInput, type ZurichCantonal } from './canton.js';
// Zurich's ledger keys and the communes as its questionnaire offers them.
export {
  communeOfAnswer,
  communeOptions,
  parishChoices,
  zurichKeys,
  type CommuneOption,
} from './keys.js';
