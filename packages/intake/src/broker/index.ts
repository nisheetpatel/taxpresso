// Broker exports into the securities list (état des titres), SPEC.md section 5.7. Pure functions
// from file bytes to a statement, and from statements to one line per security.
export { detectBrokerExport, detectFormat, parseBrokerExport } from './detect.js';
export {
  detectDecimalSeparator,
  formatDecimal,
  parseDecimal,
  ratio,
  roundHalfAwayFromZero,
  toCentimes,
  type Decimal,
  type DecimalSeparator,
  type Ratio,
} from './decimal.js';
export { isinCountry, isValidIsin } from './isin.js';
export {
  summarizeSecurities,
  type ExportInput,
  type ExportReport,
  type SecuritiesSummary,
  type SecurityLine,
} from './securities.js';
export {
  BROKER_NAMES,
  type BrokerCashflow,
  type BrokerFormat,
  type BrokerPosition,
  type BrokerStatement,
  type BrokerWarning,
  type CashflowKind,
  type ChfAmount,
  type Money,
} from './types.js';
