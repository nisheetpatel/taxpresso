// What a broker export becomes (SPEC.md section 5.7): positions and the cash that securities paid,
// in their own currency, plus the exact CHF amount where the export itself gives the rate.
import type { Ratio } from './decimal.js';

export type BrokerFormat = 'ibkr_flex_xml' | 'degiro_portfolio_csv' | 'degiro_account_csv';

export const BROKER_NAMES: Record<BrokerFormat, string> = {
  ibkr_flex_xml: 'Interactive Brokers',
  degiro_portfolio_csv: 'DEGIRO',
  degiro_account_csv: 'DEGIRO',
};

export interface BrokerWarning {
  /** Stable code, e.g. "no_chf_rate". */
  code: string;
  en: string;
  fr: string;
  /** Line in the file, when it helps to find the row. */
  line?: number;
}

/** An amount as the export states it: a plain decimal string ("-12.5") and its currency. */
export interface Money {
  amount: string;
  currency: string;
}

/** How an amount became CHF, for the fact's note: "USD to CHF 0.8812 (broker rate, 2026-12-31)". */
export interface ChfAmount {
  /** Exact, unrounded CHF. Rounded once, to the centime, when it becomes a fact. */
  exact: Ratio;
  /** Empty when the amount already was in CHF. */
  rate: string;
}

export interface BrokerPosition {
  account?: string;
  /** ISIN, or a stable id when the export gives none (e.g. "ibkr-265598"). */
  id: string;
  isin?: string;
  valor?: string;
  symbol?: string;
  name: string;
  country?: string;
  /** Number of shares or units, or the nominal value of a bond ("nombre de parts ou valeur nominale"). */
  quantity: string;
  /** The broker's valuation, in the security's currency. */
  value: Money;
  chf?: ChfAmount;
  /** ISO date of the valuation; undefined when the export has none. */
  date?: string;
  line?: number;
}

export type CashflowKind = 'dividend' | 'payment_in_lieu' | 'interest' | 'withholding';

export interface BrokerCashflow {
  account?: string;
  id: string;
  isin?: string;
  name?: string;
  country?: string;
  kind: CashflowKind;
  /** ISO date the cash was paid. */
  date: string;
  /** Signed as in the export: income is positive, tax withheld negative. */
  amount: Money;
  chf?: ChfAmount;
  line?: number;
}

export interface BrokerStatement {
  format: BrokerFormat;
  broker: string;
  /** Account ids the export names (none for formats without one). */
  accounts: string[];
  baseCurrency?: string;
  /** ISO dates the export covers, when it says. */
  period?: { from?: string; to?: string };
  /** When the broker produced the export, when it says. */
  generated?: string;
  positions: BrokerPosition[];
  cashflows: BrokerCashflow[];
  warnings: BrokerWarning[];
  /** False when the file was recognised but could not be read. */
  ok: boolean;
}
