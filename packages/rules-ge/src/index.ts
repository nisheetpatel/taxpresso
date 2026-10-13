// Deterministic Geneva ICC and federal IFD engine, every constant cited (SPEC.md section 7).
// So far: the 2026 keys and communes, the Geneva 2025 income scale (latest published), the federal
// 2026 scale and deductions, and the 2026 pillar 3a limits.
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
