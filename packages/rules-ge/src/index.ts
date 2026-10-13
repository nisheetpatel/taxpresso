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
export { PILLAR3A_2026, PILLAR3A_2026_FACTS } from './2026/pillar3a.js';
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
