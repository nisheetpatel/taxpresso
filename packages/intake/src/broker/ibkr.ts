// Interactive Brokers Flex Query, XML output (an Activity Flex Query with the Open Positions, Cash
// Transactions and, ideally, Account Information and Conversion Rates sections).
//
// Field meanings: IBKR Reporting Reference, Flex Query sections
//   https://ibkrguides.com/reportingreference/reportguide/open%20positionsfq.htm
//     (Quantity, Mark Price, Position Value = quantity x close price, FX Rate to Base = "conversion
//      rate from asset currency to base currency", Level of Detail = Summary or Lot, Side)
//   https://ibkrguides.com/reportingreference/reportguide/cash%20transactionsfq.htm
//     (Currency, FX Rate to Base, ISIN, Date/Time, Amount, Type)
//   https://ibkrguides.com/reportingreference/reportguide/delivery%20configuration%20and%20general%20configuration.htm
//     (output format XML; date format, time format and date/time separator are the user's choice)
// The guides give display labels, not XML attribute names. The names read here (position,
// markPrice, positionValue, fxRateToBase, isin, issuerCountryCode, levelOfDetail, reportDate,
// dateTime, settleDate, amount, type; ConversionRate fromCurrency/toCurrency/rate) are the ones
// IBKR writes in Flex XML; check them against a real export before relying on this (no real export
// was available when this was written; the fixtures are synthetic).
import {
  addDecimals,
  type Decimal,
  formatDecimal,
  mulDecimals,
  parseDecimal,
  ratio,
} from './decimal.js';
import { type DateFormat, detectDateFormat, parseDate } from './dates.js';
import { cleanCountry, fallbackId, isinCountry, isValidIsin } from './isin.js';
import { warning } from './messages.js';
import type {
  BrokerCashflow,
  BrokerPosition,
  BrokerStatement,
  BrokerWarning,
  CashflowKind,
  ChfAmount,
} from './types.js';
import { descendants, parseXml, XmlError, type XmlElement } from './xml.js';

const BROKER = 'Interactive Brokers';
/** Shares (and ETFs), funds and bonds. Options, futures, CFDs and the rest are left to the user. */
const READ_ASSETS = new Set(['STK', 'FUND', 'BOND']);
const INCOME: Record<string, CashflowKind> = {
  dividends: 'dividend',
  'payment in lieu of dividends': 'payment_in_lieu',
  'bond interest received': 'interest',
  'withholding tax': 'withholding',
};
/** Cash rows that are not about securities income: nothing to read. */
const NOT_INCOME = new Set([
  'deposits/withdrawals',
  'deposits & withdrawals',
  'other fees',
  'broker fees',
  'commission adjustments',
  'advisor fees',
]);
const CASH_INTEREST = new Set(['broker interest received', 'broker interest paid']);
const DATE_ATTRS = ['fromDate', 'toDate', 'reportDate', 'settleDate', 'dateTime', 'whenGenerated'];

export function isIbkrFlex(text: string): boolean {
  const head = text.slice(0, 2048).replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->/g, '');
  return /^\s*<FlexQueryResponse[\s>]/.test(head);
}

export function parseIbkrFlex(text: string): BrokerStatement {
  const statement: BrokerStatement = {
    format: 'ibkr_flex_xml',
    broker: BROKER,
    accounts: [],
    positions: [],
    cashflows: [],
    warnings: [],
    ok: true,
  };
  const warn = (w: BrokerWarning) => statement.warnings.push(w);
  let root: XmlElement;
  try {
    root = parseXml(text);
  } catch (err) {
    if (!(err instanceof XmlError)) throw err;
    warn(warning('unreadable', { broker: BROKER, detail: err.message }));
    return { ...statement, ok: false };
  }
  const flexStatements = descendants(root, 'FlexStatement');
  if (root.name !== 'FlexQueryResponse' || !flexStatements.length) {
    warn(warning('no_statement', { broker: BROKER }));
    return { ...statement, ok: false };
  }

  // One date format for the whole file (it is a setting of the query).
  const samples: string[] = [];
  const collect = (el: XmlElement) => {
    for (const a of DATE_ATTRS) if (el.attrs[a]) samples.push(el.attrs[a]);
    el.children.forEach(collect);
  };
  collect(root);
  const dateFormat = detectDateFormat(samples);
  if (!dateFormat && samples.length) warn(warning('unknown_date_format'));
  const date = (v: string | undefined) => (v && dateFormat ? parseDate(v, dateFormat) : undefined);

  const unknownTypes = new Map<string, number>();
  const noRate = new Set<string>();
  let corporateActions = 0;
  let cashNoted = false;
  let interestNoted = false;
  let bondInterestPaid = false;

  for (const fs of flexStatements) {
    const account = fs.attrs.accountId?.trim() || undefined;
    if (account && !statement.accounts.includes(account)) statement.accounts.push(account);
    const from = date(fs.attrs.fromDate);
    const to = date(fs.attrs.toDate);
    if (from || to) {
      statement.period = {
        ...(from ? { from: minDate(statement.period?.from, from) } : {}),
        ...(to ? { to: maxDate(statement.period?.to, to) } : {}),
      };
    }
    const generated = date(fs.attrs.whenGenerated);
    if (generated) statement.generated = maxDate(statement.generated, generated);

    const rates = conversionRates(fs, dateFormat);
    const base = baseCurrency(fs);
    if (base) statement.baseCurrency ??= base;

    /** CHF for an amount in `currency`, at the broker's rate on `day`. */
    const toChf = (
      amount: Decimal,
      currency: string,
      fxAttr: string | undefined,
      day: string | undefined,
    ): ChfAmount | undefined => {
      if (currency === 'CHF') return { exact: ratio.of(amount), rate: '' };
      const fx =
        (fxAttr ? parseDecimal(fxAttr) : undefined) ??
        rates.get(`${day}|${currency}`) ??
        (currency === base ? { units: 1n, scale: 0 } : undefined);
      if (!fx || !base || fx.units <= 0n) return undefined;
      const inBase = ratio.mul(ratio.of(amount), ratio.of(fx));
      const when = day ? `, ${day}` : '';
      if (base === 'CHF') {
        return {
          exact: inBase,
          rate: `${currency} to CHF ${formatDecimal(fx)} (${BROKER} rate${when})`,
        };
      }
      const chfToBase = rates.get(`${day}|CHF`);
      if (!chfToBase || chfToBase.units <= 0n) return undefined;
      return {
        exact: ratio.div(inBase, ratio.of(chfToBase)),
        rate: `${currency} to ${base} ${formatDecimal(fx)}, CHF to ${base} ${formatDecimal(chfToBase)} (${BROKER} rates${when})`,
      };
    };

    // Open positions: the summary row per security; lots only when there is no summary.
    const rows = descendants(fs, 'OpenPosition');
    const hasSummary = rows.some((r) => r.attrs.levelOfDetail?.toUpperCase() === 'SUMMARY');
    const byKey = new Map<string, BrokerPosition>();
    for (const row of rows) {
      const a = row.attrs;
      const level = a.levelOfDetail?.toUpperCase();
      if (hasSummary && level !== 'SUMMARY') continue;
      const name = (a.description || a.symbol || '').trim() || '?';
      const asset = (a.assetCategory ?? '').toUpperCase();
      if (!READ_ASSETS.has(asset)) {
        warn(warning('asset_not_read', { name, kind: asset || '?' }, row.line));
        continue;
      }
      const quantity = parseDecimal(a.position ?? '');
      const currency = (a.currency ?? '').trim().toUpperCase();
      let value = a.positionValue ? parseDecimal(a.positionValue) : undefined;
      if (!value && quantity && a.markPrice) {
        const price = parseDecimal(a.markPrice);
        const mult = parseDecimal(a.multiplier || '1');
        if (price && mult) value = mulDecimals(mulDecimals(quantity, price), mult);
      }
      if (!quantity || !value || !/^[A-Z]{3}$/.test(currency)) {
        warn(warning('bad_value', { value: a.position ?? a.positionValue ?? name }, row.line));
        continue;
      }
      if (quantity.units < 0n || a.side?.toLowerCase() === 'short') {
        warn(warning('short_position', { name }, row.line));
        continue;
      }
      const ids = identify(a, name, warn, row.line);
      const day = date(a.reportDate) ?? to;
      const key = `${account ?? ''}|${ids.id}`;
      const previous = byKey.get(key);
      if (previous) {
        // Lots of one security: add them up.
        const q = parseDecimal(previous.quantity)!;
        const v = parseDecimal(previous.value.amount)!;
        previous.quantity = formatDecimal(addDecimals(q, quantity));
        previous.value.amount = formatDecimal(addDecimals(v, value));
        if (previous.chf) {
          const chf = toChf(value, currency, a.fxRateToBase, day);
          if (chf)
            previous.chf = { ...previous.chf, exact: ratio.add(previous.chf.exact, chf.exact) };
          else {
            delete previous.chf;
            noRate.add(currency);
          }
        }
        continue;
      }
      const chf = toChf(value, currency, a.fxRateToBase, day);
      if (!chf) noRate.add(currency);
      const position: BrokerPosition = {
        ...(account ? { account } : {}),
        ...ids,
        ...(a.symbol ? { symbol: a.symbol } : {}),
        name,
        quantity: formatDecimal(quantity),
        value: { amount: formatDecimal(value), currency },
        ...(chf ? { chf } : {}),
        ...(day ? { date: day } : {}),
        line: row.line,
      };
      byKey.set(key, position);
      statement.positions.push(position);
    }

    // Cash transactions: dividends, payments in lieu, bond interest and tax withheld.
    const cash = descendants(fs, 'CashTransaction');
    const hasDetail = cash.some((r) => r.attrs.levelOfDetail?.toUpperCase() === 'DETAIL');
    for (const row of cash) {
      const a = row.attrs;
      if (hasDetail && a.levelOfDetail?.toUpperCase() !== 'DETAIL') continue;
      const type = (a.type ?? '').trim();
      const t = type.toLowerCase();
      const kind = INCOME[t];
      if (!kind) {
        if (NOT_INCOME.has(t)) continue;
        if (CASH_INTEREST.has(t)) {
          if (!interestNoted) warn(warning('interest_not_read', { broker: BROKER }));
          interestNoted = true;
        } else if (t === 'bond interest paid') {
          bondInterestPaid = true;
        } else {
          unknownTypes.set(type || '?', (unknownTypes.get(type || '?') ?? 0) + 1);
        }
        continue;
      }
      const amount = parseDecimal(a.amount ?? '');
      const currency = (a.currency ?? '').trim().toUpperCase();
      const day = date(a.dateTime) ?? date(a.settleDate) ?? date(a.reportDate);
      if (!amount || !/^[A-Z]{3}$/.test(currency) || !day) {
        warn(warning('bad_value', { value: a.amount ?? type }, row.line));
        continue;
      }
      const hasSecurity = !!(a.isin || a.securityID || a.conid);
      if (!hasSecurity) {
        warn(
          warning(
            'cash_without_security',
            { kind: type, amount: formatDecimal(amount), currency },
            row.line,
          ),
        );
        continue;
      }
      const name = (a.description || a.symbol || '').trim();
      const ids = identify(a, name || '?', warn, row.line);
      const chf = toChf(amount, currency, a.fxRateToBase, day);
      if (!chf) noRate.add(currency);
      const flow: BrokerCashflow = {
        ...(account ? { account } : {}),
        ...ids,
        ...(a.symbol ? { name: a.symbol } : {}),
        kind,
        date: day,
        amount: { amount: formatDecimal(amount), currency },
        ...(chf ? { chf } : {}),
        line: row.line,
      };
      statement.cashflows.push(flow);
    }

    corporateActions += descendants(fs, 'CorporateAction').length;
    if (!cashNoted && descendants(fs, 'CashReportCurrency').length) {
      warn(warning('cash_not_read', { broker: BROKER }));
      cashNoted = true;
    }
  }

  for (const currency of noRate) warn(warning('no_chf_rate', { currency }));
  for (const [type, count] of unknownTypes) warn(warning('unknown_cash_type', { type, count }));
  if (bondInterestPaid) warn(warning('bond_interest_paid'));
  if (corporateActions) warn(warning('corporate_actions', { count: corporateActions }));
  if (!statement.positions.length && !statement.cashflows.length) warn(warning('empty'));
  return statement;
}

const minDate = (a: string | undefined, b: string) => (a && a < b ? a : b);
const maxDate = (a: string | undefined, b: string) => (a && a > b ? a : b);

/** ISIN (checked), country and a stable id for one row. */
function identify(
  a: Record<string, string>,
  name: string,
  warn: (w: BrokerWarning) => void,
  line: number,
): { id: string; isin?: string; country?: string } {
  const raw = (
    a.isin ||
    (a.securityIDType?.toUpperCase() === 'ISIN' ? a.securityID : '') ||
    ''
  ).trim();
  const isin = raw && isValidIsin(raw.toUpperCase()) ? raw.toUpperCase() : undefined;
  if (raw && !isin) warn(warning('bad_isin', { name, isin: raw }, line));
  const country = cleanCountry(a.issuerCountryCode) ?? (isin ? isinCountry(isin) : undefined);
  const id = isin ?? fallbackId('ibkr', a.conid || a.symbol || name);
  return { id, ...(isin ? { isin } : {}), ...(country ? { country } : {}) };
}

/** Conversion rates to the base currency by "date|currency", from the ConversionRates section. */
function conversionRates(fs: XmlElement, format: DateFormat | undefined): Map<string, Decimal> {
  const map = new Map<string, Decimal>();
  for (const r of descendants(fs, 'ConversionRate')) {
    const day = r.attrs.reportDate && format ? parseDate(r.attrs.reportDate, format) : undefined;
    const from = r.attrs.fromCurrency?.trim().toUpperCase();
    const rate = parseDecimal(r.attrs.rate ?? '');
    if (day && from && rate && rate.units > 0n) map.set(`${day}|${from}`, rate);
  }
  return map;
}

/** The account's base currency: Account Information, else the target of the conversion rates. */
function baseCurrency(fs: XmlElement): string | undefined {
  const info = descendants(fs, 'AccountInformation')[0]?.attrs.currency?.trim().toUpperCase();
  if (info && /^[A-Z]{3}$/.test(info)) return info;
  const targets = new Set(
    descendants(fs, 'ConversionRate')
      .map((r) => r.attrs.toCurrency?.trim().toUpperCase())
      .filter((c): c is string => !!c && /^[A-Z]{3}$/.test(c)),
  );
  if (targets.size === 1) return [...targets][0];
  // A currency whose rate to base is exactly 1 on every row is the base.
  const one = new Set<string>();
  const notOne = new Set<string>();
  for (const el of [...descendants(fs, 'OpenPosition'), ...descendants(fs, 'CashTransaction')]) {
    const c = el.attrs.currency?.trim().toUpperCase();
    const fx = el.attrs.fxRateToBase ? parseDecimal(el.attrs.fxRateToBase) : undefined;
    if (!c || !fx) continue;
    if (fx.units === 10n ** BigInt(fx.scale)) one.add(c);
    else notOne.add(c);
  }
  const candidates = [...one].filter((c) => !notOne.has(c));
  return candidates.length === 1 ? candidates[0] : undefined;
}
