// What every canton shares (docs/design/cantons.md, section 1): cited constants and exact integer
// arithmetic on centimes, the household input and the result's shapes, and the deduction rules
// that take each canton's cited parameters. Every constant is cited (SPEC.md section 7).
export {
  estimated,
  type BracketScale,
  type Cited,
  type FederalStep,
  type Param,
} from './core/cited.js';
export {
  bracketTax,
  chf,
  federalScaleTax,
  floorFranc,
  pct,
  percent,
  round5,
  roundCentime,
  roundFranc,
  roundTo,
  share5,
  shareFranc,
  Trace,
} from './core/calc.js';
export type * from './core/types.js';
export {
  donationDeduction,
  flatProfessional,
  mealsDeduction,
  medicalDeduction,
  pillar3aCapWithoutFund,
  twoEarnerFederal,
} from './core/rules.js';
// Pillar 3a and the pension fund (2nd pillar): the federal limits, the same for every canton's tax.
export { PILLAR3A_2026, PILLAR3A_2026_FACTS } from './pension/pillar3a.js';
export {
  LPP_BUYIN_FACTS,
  PILLAR3A_2025,
  PILLAR3A_CATCHUP_2026,
  PILLAR3A_CATCHUP_FACTS,
} from './pension/buy-ins.js';
// Swiss withholding tax (impôt anticipé), the foreign tax credit (DA-1) and the official exchange
// rates. `roundFrancExact` is the withholding module's own rounding to the franc (BigInt, it
// refuses anything but a safe integer); rules-ge has always exported it as `roundFranc`.
export {
  FOREIGN_RESIDUAL_RATES,
  IA_DEPOSIT_INTEREST_EXEMPT,
  IA_RATE,
  IA_ROUNDING,
  IES_MINIMUM,
  iaClaim,
  iaOn,
  residualRate,
  roundFranc as roundFrancExact,
  splitForeignTax,
  type ForeignIncomeKind,
  type ResidualLookup,
  type ResidualRate,
} from './withholding/withholding.js';
export {
  OFFICIAL_RATES,
  officialChf,
  type Conversion,
  type OfficialRate,
} from './withholding/exchange-rates.js';
// The ESTV record format of the source-tax tariff files (every canton publishes its tariffs in it).
export {
  compactTariff,
  expandTariff,
  parseTariffFile,
  type CompactTariff,
  type TariffFile,
  type TariffRow,
} from './source-tax/ascii.js';
// Ledger keys for the documents that are the same in every canton.
export {
  KEYS_SALARY_CERTIFICATE_2026,
  SALARY_CERTIFICATE_FIELDS_2026,
  type SalaryCertificateKey,
} from './keys/salary-certificate.js';
export { KEYS_SECURITIES_2026, type SecurityKey } from './keys/securities.js';
export { KEYS_ECH0196_2026, type Ech0196Key } from './keys/ech0196.js';
