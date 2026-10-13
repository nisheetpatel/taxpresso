// DEGIRO CSV exports: the portfolio (Portfolio > Export > CSV) and the account statement
// (Inbox or Activity > Account statement > Export > CSV), in the languages DEGIRO's web trader
// uses for headers.
//
// DEGIRO publishes no specification of these files (its help centre, e.g.
// https://www.degiro.ch/helpdesk/de/trading-platform/mein-portfolio, describes the exports but not
// their columns). The layout read here is the one the files themselves show (account statement:
// Date, Time, Value date, Product, ISIN, Description, FX, Change (currency, amount), Balance
// (currency, amount), Order Id; dates dd-mm-yyyy; decimal comma). Headers are matched by
// name in several languages, never by file name; anything unexpected is a warning. Check against
// real exports before relying on this: the fixtures are synthetic.
import {
  type Decimal,
  detectDecimalSeparator,
  type DecimalSeparator,
  formatDecimal,
  parseDecimal,
  ratio,
  type Ratio,
} from './decimal.js';
import { type CsvRow, firstLine, parseCsv, sniffDelimiter } from './csv.js';
import { parseDate } from './dates.js';
import { fallbackId, isinCountry, isValidIsin } from './isin.js';
import { swissDate, warning } from './messages.js';
import type { BrokerCashflow, BrokerPosition, BrokerStatement, ChfAmount } from './types.js';

const BROKER = 'DEGIRO';

/** Lower case, no accents, single spaces. */
export const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const PRODUCT = ['product', 'produkt', 'produit', 'prodotto', 'producto', 'produto'];
const SYMBOL_ISIN = ['symbol/isin', 'symbool/isin', 'symbole/isin', 'simbolo/isin'];
const QUANTITY = [
  'amount',
  'quantity',
  'aantal',
  'anzahl',
  'stuck',
  'quantite',
  'quantita',
  'cantidad',
  'quantidade',
];
const CLOSING = [
  'closing',
  'closing price',
  'close',
  'price',
  'slotkoers',
  'koers',
  'schlusskurs',
  'kurs',
  'cloture',
  'cours',
  'prix',
  'chiusura',
  'prezzo',
  'cierre',
  'precio',
  'fecho',
  'preco',
];
const LOCAL_VALUE = [
  'local value',
  'lokale waarde',
  'lokaler wert',
  'valeur locale',
  'valore locale',
  'valor local',
];
const BASE_VALUE = /^(?:value|waarde|wert|valeur|valore|valor) (?:in|en) ([a-z]{3})$/;
const DATE = ['date', 'datum', 'data', 'fecha'];
const TIME = ['time', 'tijd', 'zeit', 'uhrzeit', 'heure', 'ora', 'hora'];
const DESCRIPTION = [
  'description',
  'omschrijving',
  'beschreibung',
  'descrizione',
  'descripcion',
  'descricao',
];

interface PortfolioColumns {
  product: number;
  symbol: number;
  quantity: number;
  closing?: number;
  local: number;
  base?: number;
  baseCurrency?: string;
}

function portfolioColumns(header: string[]): PortfolioColumns | undefined {
  const h = header.map(fold);
  const find = (names: string[]) => h.findIndex((c) => names.includes(c));
  const product = find(PRODUCT);
  const symbol = find(SYMBOL_ISIN);
  const quantity = find(QUANTITY);
  const local = find(LOCAL_VALUE);
  if (product < 0 || symbol < 0 || quantity < 0 || local < 0) return undefined;
  const closing = find(CLOSING);
  const base = h.findIndex((c) => BASE_VALUE.test(c));
  const baseCurrency = base >= 0 ? h[base]!.match(BASE_VALUE)![1]!.toUpperCase() : undefined;
  return {
    product,
    symbol,
    quantity,
    local,
    ...(closing >= 0 ? { closing } : {}),
    ...(base >= 0 ? { base, baseCurrency } : {}),
  };
}

function isAccountHeader(header: string[]): boolean {
  const h = header.map(fold);
  return (
    h.length >= 11 &&
    DATE.includes(h[0]!) &&
    TIME.includes(h[1]!) &&
    PRODUCT.includes(h[3]!) &&
    h[4] === 'isin' &&
    DESCRIPTION.includes(h[5]!)
  );
}

function headerOf(text: string): string[] {
  const line = firstLine(text);
  return parseCsv(line, sniffDelimiter(line))[0]?.cells ?? [];
}

export function isDegiroPortfolio(text: string): boolean {
  return portfolioColumns(headerOf(text)) !== undefined;
}

export function isDegiroAccount(text: string): boolean {
  return isAccountHeader(headerOf(text));
}

const CURRENCY = /^[A-Z]{3}$/;

function readRows(text: string): CsvRow[] {
  return parseCsv(text, sniffDelimiter(firstLine(text))).slice(1);
}

function separatorFor(samples: string[], statement: BrokerStatement): DecimalSeparator {
  const { separator, ambiguous } = detectDecimalSeparator(samples);
  if (!separator && ambiguous) statement.warnings.push(warning('unknown_decimal'));
  // DEGIRO writes decimal commas in most languages; a point only when the numbers say so.
  return separator ?? ',';
}

function newStatement(format: BrokerStatement['format']): BrokerStatement {
  return {
    format,
    broker: BROKER,
    accounts: [],
    positions: [],
    cashflows: [],
    warnings: [],
    ok: true,
  };
}

export function parseDegiroPortfolio(text: string): BrokerStatement {
  const statement = newStatement('degiro_portfolio_csv');
  const cols = portfolioColumns(headerOf(text));
  if (!cols) return { ...statement, ok: false };
  if (cols.baseCurrency) statement.baseCurrency = cols.baseCurrency;
  const rows = readRows(text);
  const cell = (r: CsvRow, i: number | undefined) =>
    i === undefined ? '' : (r.cells[i] ?? '').trim();
  /** The local value is two cells: a currency code and an amount, in either order. */
  const local = (r: CsvRow) => {
    const a = cell(r, cols.local);
    const b = cell(r, cols.local + 1);
    return CURRENCY.test(a) ? { currency: a, amount: b } : { currency: b, amount: a };
  };
  const sep = separatorFor(
    rows.flatMap((r) => [
      cell(r, cols.quantity),
      cell(r, cols.closing),
      local(r).amount,
      cell(r, cols.base),
    ]),
    statement,
  );
  const noRate = new Set<string>();
  let cashNoted = false;
  for (const r of rows) {
    const name = cell(r, cols.product);
    const symbol = cell(r, cols.symbol);
    const qtyText = cell(r, cols.quantity);
    if (/^cash\b/.test(fold(name)) || (!symbol && !qtyText)) {
      if (!cashNoted) statement.warnings.push(warning('cash_not_read', { broker: BROKER }));
      cashNoted = true;
      continue;
    }
    const quantity = parseDecimal(qtyText, sep);
    const { currency, amount } = local(r);
    const value = parseDecimal(amount, sep);
    if (!quantity || !value || !CURRENCY.test(currency)) {
      statement.warnings.push(warning('bad_value', { value: qtyText || amount || name }, r.line));
      continue;
    }
    if (quantity.units < 0n) {
      statement.warnings.push(warning('short_position', { name }, r.line));
      continue;
    }
    const upper = symbol.toUpperCase();
    const isin = isValidIsin(upper) ? upper : undefined;
    if (!isin && /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(upper)) {
      statement.warnings.push(warning('bad_isin', { name, isin: symbol }, r.line));
    }
    let chf: ChfAmount | undefined;
    if (currency === 'CHF') chf = { exact: ratio.of(value), rate: '' };
    else if (cols.baseCurrency === 'CHF') {
      const base = parseDecimal(cell(r, cols.base), sep);
      if (base) chf = { exact: ratio.of(base), rate: `${BROKER} value in CHF` };
    }
    if (!chf) noRate.add(currency);
    const country = isin ? isinCountry(isin) : undefined;
    const position: BrokerPosition = {
      id: isin ?? fallbackId('degiro', symbol || name),
      ...(isin ? { isin } : {}),
      ...(symbol && !isin ? { symbol } : {}),
      name: name || symbol,
      ...(country ? { country } : {}),
      quantity: formatDecimal(quantity),
      value: { amount: formatDecimal(value), currency },
      ...(chf ? { chf } : {}),
      line: r.line,
    };
    statement.positions.push(position);
  }
  for (const currency of noRate) statement.warnings.push(warning('no_chf_rate', { currency }));
  if (!statement.positions.length) statement.warnings.push(warning('empty'));
  return statement;
}

const isDividendTax = (d: string) =>
  /dividend/.test(d) &&
  /(tax|belasting|steuer|impot|ritenuta|retencion|imposto|withholding)/.test(d);
const isDividend = (d: string) => /^dividend(e|o|os|en)?\b/.test(d) && !isDividendTax(d);
const isTrade = (d: string) =>
  d.includes('@') ||
  /\b(buy|sell|kauf|verkauf|achat|vente|koop|verkoop|compra|venta|acquisto|vendita|zu je)\b/.test(
    d,
  );
const isFee = (d: string) =>
  /(fee|gebuhr|kosten|frais|commission|costi|comision|custo|transaction|transaktion|stamp|stempel)/.test(
    d,
  );
const isFx = (d: string) =>
  /(^fx |\bfx$|valuta|wahrung|operation de change|divisa|cambio|currency)/.test(d);
const isInterest = (d: string) =>
  /(interest|zinsen|interet|rente|interesse|intereses|juros)/.test(d);

const dmy = (v: string) =>
  parseDate(v, 'dmy-dash') ?? parseDate(v, 'ymd-dash') ?? parseDate(v, 'dmy-dot') ?? undefined;

export function parseDegiroAccount(text: string): BrokerStatement {
  const statement = newStatement('degiro_account_csv');
  if (!isAccountHeader(headerOf(text))) return { ...statement, ok: false };
  const rows = readRows(text);
  const c = (r: CsvRow, i: number) => (r.cells[i] ?? '').trim();
  /** The change is two cells: currency and amount, in either order. */
  const change = (r: CsvRow) =>
    CURRENCY.test(c(r, 7))
      ? { currency: c(r, 7), amount: c(r, 8) }
      : { currency: c(r, 8), amount: c(r, 7) };
  const sep = separatorFor(
    rows.flatMap((r) => [c(r, 6), change(r).amount, c(r, 10)]),
    statement,
  );

  // Currency conversions DEGIRO made (e.g. a USD dividend credited in CHF): rate from the amounts.
  const fxGroups = new Map<string, { currency: string; amount: Decimal }[]>();
  for (const r of rows) {
    const d = fold(c(r, 5));
    if (c(r, 4) || !isFx(d)) continue;
    const { currency, amount } = change(r);
    const value = parseDecimal(amount, sep);
    const day = dmy(c(r, 0));
    if (!value || !CURRENCY.test(currency) || !day) continue;
    const key = `${day}|${c(r, 1)}`;
    fxGroups.set(key, [...(fxGroups.get(key) ?? []), { currency, amount: value }]);
  }
  /** CHF per unit of `currency`, by "date|currency", with the time of the conversion. */
  const rates = new Map<string, { time: string; rate: Ratio }[]>();
  for (const [key, legs] of fxGroups) {
    const chf = legs.filter((l) => l.currency === 'CHF');
    const other = legs.filter((l) => l.currency !== 'CHF');
    if (chf.length !== 1 || other.length !== 1 || other[0]!.amount.units === 0n) continue;
    const [day, time] = key.split('|') as [string, string];
    // One leg leaves the account, the other arrives: opposite signs, rate from their sizes.
    const rate = ratio.neg(ratio.div(ratio.of(chf[0]!.amount), ratio.of(other[0]!.amount)));
    if (ratio.sign(rate) <= 0) continue;
    const k = `${day}|${other[0]!.currency}`;
    rates.set(k, [...(rates.get(k) ?? []), { time, rate }]);
  }

  const noRate = new Set<string>();
  let interestNoted = false;
  for (const r of rows) {
    const description = c(r, 5);
    const d = fold(description);
    const isinText = c(r, 4).toUpperCase();
    if (!isinText) {
      if (isInterest(d) && !isFx(d)) {
        if (!interestNoted)
          statement.warnings.push(warning('interest_not_read', { broker: BROKER }));
        interestNoted = true;
      }
      continue; // Deposits, withdrawals, cash sweeps, conversions: not securities income.
    }
    const kind = isDividendTax(d) ? 'withholding' : isDividend(d) ? 'dividend' : undefined;
    const name = c(r, 3) || isinText;
    if (!kind) {
      if (!isTrade(d) && !isFee(d) && !isFx(d)) {
        statement.warnings.push(warning('unknown_row', { description, name }, r.line));
      }
      continue;
    }
    const { currency, amount } = change(r);
    const value = parseDecimal(amount, sep);
    const booked = dmy(c(r, 0));
    const day = dmy(c(r, 2)) ?? booked;
    if (!value || !CURRENCY.test(currency) || !day || !booked) {
      statement.warnings.push(warning('bad_value', { value: amount || c(r, 0) }, r.line));
      continue;
    }
    const isin = isValidIsin(isinText) ? isinText : undefined;
    if (!isin) statement.warnings.push(warning('bad_isin', { name, isin: isinText }, r.line));
    let chf: ChfAmount | undefined;
    if (currency === 'CHF') chf = { exact: ratio.of(value), rate: '' };
    else {
      const candidates = rates.get(`${booked}|${currency}`) ?? [];
      const pick = candidates.find((x) => x.time === c(r, 1)) ?? candidates[0];
      if (pick) {
        chf = {
          exact: ratio.mul(ratio.of(value), pick.rate),
          rate: `${currency} to CHF from ${BROKER}'s conversion on ${swissDate(booked)}`,
        };
      }
    }
    if (!chf) noRate.add(currency);
    const country = isin ? isinCountry(isin) : undefined;
    const flow: BrokerCashflow = {
      id: isin ?? fallbackId('degiro', isinText || name),
      ...(isin ? { isin } : {}),
      name,
      ...(country ? { country } : {}),
      kind,
      date: day,
      amount: { amount: formatDecimal(value), currency },
      ...(chf ? { chf } : {}),
      line: r.line,
    };
    statement.cashflows.push(flow);
  }
  for (const currency of noRate) statement.warnings.push(warning('no_chf_rate', { currency }));
  if (!statement.cashflows.length) statement.warnings.push(warning('empty'));
  return statement;
}
