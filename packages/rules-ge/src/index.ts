// Deterministic Geneva engine, every constant cited (SPEC.md section 7): the cantonal and communal
// tax (ICC) on the Geneva form, with the federal tax (IFD) and what every canton shares from
// packages/rules-ch. So far: the 2026 keys and communes, the Geneva 2025 income scale (latest
// published), the keys for values read from documents, the consistency checks across documents,
// and the assessment check with its objection deadline. The names that moved to rules-ch (the
// federal constants, pillar 3a and pension limits, withholding tax, the shared keys and shapes)
// are still exported from here, so importers can move at their own pace.
export {
  iccBaseIncomeTax2025,
  iccTotalIncomeTax2025,
  ICC_2025_INCOME_SCALE,
  ICC_2025_PROFESSIONAL_FLAT,
  type IccSplitting,
} from './2025/icc.js';
export type { Cited } from '@taxpresso/rules-ch';
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
} from '@taxpresso/rules-ch';
export { KEYS_2026, type Key2026 } from './2026/keys.js';
export { KEYS_SECURITIES_2026, type SecurityKey } from '@taxpresso/rules-ch';
// The securities list (état des titres), other movable wealth and the withholding tax claimed back.
// The wealth keys are the same in every canton: packages/rules-ch (keys/wealth.ts).
export {
  DOCUMENT_FIELDS_WEALTH_2026,
  DOCUMENT_KEYS_WEALTH_2026,
  KEYS_WEALTH_2026,
  OWNERS,
  WEALTH_KINDS,
  type LineOwner,
  type WealthKey,
  type WealthKind,
} from '@taxpresso/rules-ch';
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
  roundFrancExact as roundFranc,
  splitForeignTax,
  type ForeignIncomeKind,
  type ResidualRate,
} from '@taxpresso/rules-ch';
export { OFFICIAL_RATES, officialChf, type Conversion } from '@taxpresso/rules-ch';
export {
  KEYS_PRIOR_2026,
  parsePriorInstance,
  PRIOR_FORMS,
  PRIOR_MAIN_LINES_2026,
  priorInstance,
  priorLines,
  type PriorForm,
  type PriorKey,
  type PriorLine,
  type PriorMainLine,
  type PriorRef,
  type PriorSection,
} from './2026/keys-prior.js';
export {
  COMMUNE_CODES,
  COMMUNE_CODES_SOURCE,
  communeByCode,
  communeByName,
  foldName,
} from './2026/commune-codes.js';
export { KEYS_ECH0196_2026, type Ech0196Key } from '@taxpresso/rules-ch';
export { PILLAR3A_2026, PILLAR3A_2026_FACTS } from '@taxpresso/rules-ch';
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
} from '@taxpresso/rules-ch';
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
// Self-employment, the simple case (annexe B): its keys and the notes its lines carry.
export {
  BUSINESS_FIELDS_2026,
  KEYS_BUSINESS_DOCUMENTS_2026,
  KEYS_BUSINESS_PROFILE_2026,
  type BusinessDocumentKey,
} from './2026/business-keys.js';
export { BUSINESS_NOTE } from './engine/business.js';
// How a Geneva result reads in the generic views (compute_tax, the estimate card, the plans).
export { view } from './engine/view.js';
export {
  assess,
  asItem,
  incomeTotals,
  type AssessInput,
  type Assessment,
} from './engine/assess.js';
export { paramsFor, isTaxYear, TAX_YEARS, type TaxYear, type YearParams } from './engine/params.js';
export { RUBRICS, rubric, codeFor, type RubricCode } from './engine/rubrics.js';
export { pillar3aCapWithoutFund } from '@taxpresso/rules-ch';
export { ESTIMATE_TEXT, NOTE } from './engine/explain.js';
export { bracketTax, federalScaleTax, chf } from '@taxpresso/rules-ch';
export type * from './engine/types.js';
export { engineInputFromFacts, type LedgerInput } from './engine/from-ledger.js';
export { compareWithLastYear, type LastYearRow, type YearPair } from './engine/last-year.js';
export {
  finalCheck,
  limitPosition,
  nearMargin,
  NEAR_LIMIT,
  type FinalCheck,
  type FinalCheckCanton,
  type FinalCheckInput,
  type FinalCheckItem,
  type FinalCheckKind,
  type FinalCheckResult,
  type FinalCheckStatus,
  type FinalRequirement,
  type LimitPosition,
  type OfficialPdfState,
  type PendingValue,
} from './engine/final-check.js';
export {
  OFFICIAL_DOCUMENTS,
  officialLinks,
  type OfficialDocument,
  type OfficialLink,
} from './law/official-documents.js';
// Geneva behind the canton interface (packages/rules-ch, canton.ts).
export { genevaInput, rules, type GenevaCantonal } from './canton.js';
