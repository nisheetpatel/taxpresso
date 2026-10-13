// Deterministic Geneva ICC and federal IFD engine, every constant cited (SPEC.md section 7).
// So far: the 2026 keys and communes, the Geneva 2025 income scale (latest published), the federal
// 2026 scale and deductions, the 2026 pillar 3a limits, the keys for values read from documents,
// the consistency checks across documents, and the assessment check with its objection deadline.
export {
  iccBaseIncomeTax2025,
  iccTotalIncomeTax2025,
  ICC_2025_INCOME_SCALE,
  ICC_2025_PROFESSIONAL_FLAT,
  type Cited,
  type IccSplitting,
} from './2025/icc.js';
export {
  COMMUNE_CENTIMES_2026,
  COMMUNES_2026,
  type Commune,
  type CommuneSlug,
} from './2026/communes.js';
export {
  IFD_2026_DEDUCTIONS,
  IFD_PROFESSIONAL_FLAT_RATE_BP,
  ifdScaleTax2026,
  ifdTax2026,
} from './2026/ifd.js';
export { KEYS_2026, type Key2026 } from './2026/keys.js';
export { KEYS_SECURITIES_2026, type SecurityKey } from './2026/keys-securities.js';
// The securities list (état des titres), other movable wealth and the withholding tax claimed back.
export {
  KEYS_WEALTH_2026,
  OWNERS,
  WEALTH_KINDS,
  type LineOwner,
  type WealthKey,
  type WealthKind,
} from './2026/keys-wealth.js';
export {
  DOCUMENT_FIELDS_WEALTH_2026,
  DOCUMENT_KEYS_WEALTH_2026,
} from './2026/document-keys-wealth.js';
export {
  CIVILITE,
  etatDesTitres,
  lineOwner,
  OFFICIAL_VALUE_HELP,
  RUBRICS_2026,
  SECTIONS_2026,
  type Columns,
  type EtatDesTitres,
  type EtatInput,
  type EtatIssue,
  type EtatLine,
  type ForeignTax,
  type OtherLine,
  type Rubric,
  type Section,
  type ValueState,
  type WealthItem,
} from './2026/etat-des-titres.js';
export {
  FOREIGN_RESIDUAL_RATES,
  IA_DEPOSIT_INTEREST_EXEMPT,
  IA_RATE,
  IA_ROUNDING,
  IES_MINIMUM,
  iaClaim,
  iaOn,
  residualRate,
  roundFranc,
  splitForeignTax,
  type ForeignIncomeKind,
  type ResidualRate,
} from './2026/withholding.js';
export { OFFICIAL_RATES, officialChf, type Conversion } from './2026/exchange-rates.js';
export { PILLAR3A_2026, PILLAR3A_2026_FACTS } from './2026/pillar3a.js';
// Source tax (2025, 2026), TOU, pension fund buy-ins and the 3a catch-up (SPEC.md section 8).
export {
  normalizeTariff,
  SOURCE_TAX_SOURCES,
  SOURCE_TAX_YEARS,
  sourceTax,
  SourceTaxError,
  sourceTaxTariffs,
  type SourceTaxPeriod,
  type SourceTaxResult,
  type SourceTaxYear,
} from './source-tax/index.js';
export {
  TOU_2026_GROSS_THRESHOLD,
  TOU_2026_OTHER_INCOME_THRESHOLD,
  TOU_2026_WEALTH_FREE,
  TOU_FACTS,
  touDeadline,
} from './2026/tou.js';
export {
  LPP_BUYIN_FACTS,
  PILLAR3A_2025,
  PILLAR3A_CATCHUP_2026,
  PILLAR3A_CATCHUP_FACTS,
} from './2026/pension.js';
export {
  DOCUMENT_FIELDS_2026,
  DOCUMENT_KEYS_2026,
  documentFields,
  type DocumentKey2026,
} from './2026/document-keys.js';
export {
  CHECK_ID_PATTERN,
  consistencyChecks,
  formatChf,
  formatDay,
  sameIssuer,
  type CheckInput,
  type CheckRule,
  type ConsistencyCheck,
  type Text,
} from './2026/checks.js';
export {
  ASSESSMENT_ITEMS_2026,
  ASSESSMENT_TOTALS_2026,
  assessmentText,
  assessmentViews,
  OBJECTION_2026,
  objectionDeadline,
  type AssessedTax,
  type AssessmentItem,
  type AssessmentView,
  type ObjectionDeadline,
} from './2026/assessment.js';
export { computeReturn, allLines, EngineInputError } from './engine/compute.js';
export {
  assess,
  asItem,
  incomeTotals,
  type AssessInput,
  type Assessment,
} from './engine/assess.js';
export { paramsFor, isTaxYear, TAX_YEARS, type TaxYear, type YearParams } from './engine/params.js';
export { RUBRICS, rubric, codeFor, type RubricCode } from './engine/rubrics.js';
export { ESTIMATE_TEXT, NOTE } from './engine/explain.js';
export { bracketTax, federalScaleTax, chf } from './engine/calc.js';
export type * from './engine/types.js';
export { engineInputFromFacts, type LedgerInput } from './engine/from-ledger.js';
