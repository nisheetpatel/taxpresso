// From broker exports to the securities list (état des titres, ge-2025-guide-declaration-pp
// p. 38 and p. 41): one line per security (ISIN), with what was held on 31 December, its value,
// the gross income of the year and the tax withheld, Swiss (impôt anticipé) or foreign.
//
// Which export counts: for each account (or, for exports that name none, each format and owner),
// the newest export that covers the tax year; older ones are replaced, not added. An export with
// several accounts counts account by account, so the same account is never counted twice. Positions count
// only when dated at the end of the year (IBKR dates them on the last trading day, so 24 to 31
// December); cash only when paid in the tax year. CHF amounts are summed exactly and rounded once
// (decimal.ts).
import {
  addDecimals,
  type Decimal,
  formatDecimal,
  parseDecimal,
  ratio,
  type Ratio,
  toCentimes,
} from './decimal.js';
import { swissDate, warning } from './messages.js';
import type {
  BrokerCashflow,
  BrokerFormat,
  BrokerStatement,
  BrokerWarning,
  ChfAmount,
  Money,
} from './types.js';

export interface ExportInput {
  docId: string;
  filename: string;
  /** When the file was added to the vault (ISO), to order exports that carry no date. */
  addedAt: string;
  /** Whose export it is, if the user said: separates exports that name no account. */
  person?: string;
  statement: BrokerStatement;
}

export interface SecurityLine {
  /** ISIN, or a stable id when there is none: the ledger instance. */
  id: string;
  isin?: string;
  valor?: string;
  name: string;
  currency?: string;
  country?: string;
  /** Held on 31 December (sum over accounts); undefined when no export shows a year-end position. */
  quantity?: string;
  /** The broker's valuation in the security's currency, when there is one currency. */
  value?: Money;
  /** Value in CHF at the broker's prices and rates, in centimes; undefined if a rate is missing. */
  valueChf?: number;
  valueNote?: string;
  /** Gross income of the year per currency, as paid. */
  income: Money[];
  incomeChf?: number;
  incomeNote?: string;
  /** Tax withheld (positive), per currency. */
  withheld: Money[];
  withholdingSwissChf?: number;
  withholdingForeignChf?: number;
  withholdingNote?: string;
  /** The exports this line comes from. */
  docIds: string[];
}

export interface ExportReport {
  docId: string;
  filename: string;
  broker: string;
  format: BrokerFormat;
  ok: boolean;
  /** Year-end positions and income or tax rows this export contributes. */
  positions: number;
  cashRows: number;
  /** The export that replaces this one, if any. */
  replacedBy?: string;
  warnings: BrokerWarning[];
}

export interface SecuritiesSummary {
  taxYear: number;
  lines: SecurityLine[];
  exports: ExportReport[];
}

interface ChfSum {
  exact: Ratio;
  /** False once any part had no CHF rate: the total is then unknown, never partial. */
  complete: boolean;
  notes: string[];
}

interface Acc {
  id: string;
  isin?: string;
  positionName?: string;
  otherName?: string;
  currency?: string;
  country?: string;
  quantity?: Decimal;
  values: Map<string, Decimal>;
  valueChf?: ChfSum;
  income: Map<string, Decimal>;
  incomeChf?: ChfSum;
  withheld: Map<string, Decimal>;
  swiss?: ChfSum;
  foreign?: ChfSum;
  withholdingUnknown: boolean;
  inLieu: Map<string, Decimal>;
  docIds: string[];
}

const NOTE_MAX = 480;

function addChf(sum: ChfSum | undefined, chf: ChfAmount | undefined, money: Money): ChfSum {
  const s = sum ?? { exact: ratio.zero, complete: true, notes: [] };
  const note = `${money.currency} ${money.amount}${chf?.rate ? ` at ${chf.rate}` : ''}`;
  return {
    exact: chf ? ratio.add(s.exact, chf.exact) : s.exact,
    complete: s.complete && !!chf,
    notes: s.notes.length < 12 ? [...s.notes, note] : s.notes,
  };
}

const negateChf = (c: ChfAmount | undefined): ChfAmount | undefined =>
  c ? { ...c, exact: ratio.neg(c.exact) } : undefined;

function addMoney(map: Map<string, Decimal>, money: Money, negate = false): void {
  const d = parseDecimal(money.amount);
  if (!d) return;
  const v = negate ? { ...d, units: -d.units } : d;
  const prev = map.get(money.currency);
  map.set(money.currency, prev ? addDecimals(prev, v) : v);
}

const moneyList = (map: Map<string, Decimal>): Money[] =>
  [...map]
    .filter(([, d]) => d.units !== 0n)
    .map(([currency, d]) => ({ currency, amount: formatDecimal(d) }));

const centimes = (s: ChfSum | undefined) => (s?.complete ? toCentimes(s.exact) : undefined);
const note = (s: ChfSum | undefined) => {
  if (!s) return undefined;
  const text = s.notes.join('; ');
  return text.length > NOTE_MAX ? `${text.slice(0, NOTE_MAX - 1)}…` : text;
};

/** IBKR names an open position on the last trading day of the year, not always 31 December. */
const isYearEnd = (date: string, year: number) =>
  date >= `${year}-12-24` && date <= `${year}-12-31`;

function coversYear(s: BrokerStatement, year: number): boolean {
  const from = s.period?.from;
  const to = s.period?.to;
  if (from && from > `${year}-12-31`) return false;
  if (to && to < `${year}-01-01`) return false;
  return true;
}

/** One account of an export, or the whole export when it names one account or none. */
function units(input: ExportInput): ExportInput[] {
  const s = input.statement;
  if (s.accounts.length <= 1) return [input];
  return s.accounts.map((account) => ({
    ...input,
    statement: {
      ...s,
      accounts: [account],
      positions: s.positions.filter((p) => p.account === account),
      cashflows: s.cashflows.filter((c) => c.account === account),
    },
  }));
}

function groupKey(input: ExportInput): string {
  const s = input.statement;
  const who = s.accounts.length ? [...s.accounts].sort().join(',') : `person:${input.person ?? ''}`;
  return `${s.format}|${who}`;
}

/** Newest first: by the end of the period, then the date the broker produced it, then added. */
function newer(a: ExportInput, b: ExportInput): number {
  const keys = (i: ExportInput) => [
    i.statement.period?.to ?? '',
    i.statement.generated ?? '',
    i.addedAt,
    i.docId,
  ];
  const ka = keys(a);
  const kb = keys(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return ka[i]! > kb[i]! ? -1 : 1;
  }
  return 0;
}

export function summarizeSecurities(
  inputs: readonly ExportInput[],
  taxYear: number,
): SecuritiesSummary {
  const reports = new Map<string, ExportReport>();
  for (const i of inputs) {
    reports.set(i.docId, {
      docId: i.docId,
      filename: i.filename,
      broker: i.statement.broker,
      format: i.statement.format,
      ok: i.statement.ok,
      positions: 0,
      cashRows: 0,
      warnings: [...i.statement.warnings],
    });
  }
  const warn = (docId: string, w: BrokerWarning) => {
    const list = reports.get(docId)?.warnings;
    if (list && !list.some((x) => x.code === w.code && x.en === w.en)) list.push(w);
  };

  // Which exports count.
  const groups = new Map<string, ExportInput[]>();
  for (const i of inputs) {
    if (!i.statement.ok) continue;
    if (!coversYear(i.statement, taxYear)) {
      warn(
        i.docId,
        warning('wrong_year', {
          from: swissDate(i.statement.period?.from ?? '?'),
          to: swissDate(i.statement.period?.to ?? '?'),
          year: taxYear,
        }),
      );
      continue;
    }
    for (const unit of units(i)) {
      const key = groupKey(unit);
      groups.set(key, [...(groups.get(key) ?? []), unit]);
    }
  }
  const current: ExportInput[] = [];
  const replaced = new Map<string, number>();
  for (const list of groups.values()) {
    const [first, ...rest] = [...list].sort(newer);
    current.push(first!);
    for (const old of rest) {
      replaced.set(old.docId, (replaced.get(old.docId) ?? 0) + 1);
      const accounts = inputs.find((x) => x.docId === old.docId)!.statement.accounts;
      if (accounts.length <= 1) {
        reports.get(old.docId)!.replacedBy = first!.docId;
        warn(old.docId, warning('replaced', { file: first!.filename }));
      } else {
        const account = old.statement.accounts[0]!;
        warn(old.docId, warning('replaced_account', { account, file: first!.filename }));
      }
    }
  }
  // An export whose every account was replaced is replaced.
  for (const i of inputs) {
    const n = i.statement.accounts.length;
    if (n > 1 && replaced.get(i.docId) === n) {
      const by = current.find((c) => i.statement.accounts.includes(c.statement.accounts[0]!));
      if (by) reports.get(i.docId)!.replacedBy = by.docId;
    }
  }

  const accs = new Map<string, Acc>();
  const acc = (id: string): Acc => {
    let a = accs.get(id);
    if (!a) {
      a = {
        id,
        values: new Map(),
        income: new Map(),
        withheld: new Map(),
        withholdingUnknown: false,
        inLieu: new Map(),
        docIds: [],
      };
      accs.set(id, a);
    }
    return a;
  };
  const touch = (a: Acc, docId: string, from: { isin?: string; country?: string }) => {
    if (!a.docIds.includes(docId)) a.docIds.push(docId);
    if (from.isin) a.isin ??= from.isin;
    if (from.country) a.country ??= from.country;
  };

  for (const input of [...current].sort((a, b) => (a.docId < b.docId ? -1 : 1))) {
    const s = input.statement;
    const report = reports.get(input.docId)!;
    const from = s.period?.from;
    const to = s.period?.to;
    if ((from && from > `${taxYear}-01-01`) || (to && to < `${taxYear}-12-31`)) {
      warn(
        input.docId,
        warning('partial_year', { from: swissDate(from ?? '?'), to: swissDate(to ?? '?') }),
      );
    }

    let undated = false;
    let notYearEnd: string | undefined;
    for (const p of s.positions) {
      if (p.date === undefined) undated = true;
      else if (!isYearEnd(p.date, taxYear)) {
        notYearEnd = notYearEnd && notYearEnd > p.date ? notYearEnd : p.date;
        continue;
      }
      const a = acc(p.id);
      touch(a, input.docId, p);
      a.positionName ??= p.name;
      a.currency ??= p.value.currency;
      const q = parseDecimal(p.quantity);
      if (q) a.quantity = a.quantity ? addDecimals(a.quantity, q) : q;
      addMoney(a.values, p.value);
      a.valueChf = addChf(a.valueChf, p.chf, p.value);
      report.positions++;
    }
    if (undated) warn(input.docId, warning('no_date', { year: taxYear }));
    if (notYearEnd) {
      warn(
        input.docId,
        warning('positions_not_year_end', { date: swissDate(notYearEnd), year: taxYear }),
      );
    }

    let outside = 0;
    for (const f of s.cashflows) {
      if (!f.date.startsWith(`${taxYear}-`)) {
        outside++;
        continue;
      }
      const a = acc(f.id);
      touch(a, input.docId, f);
      if (f.name) a.otherName ??= f.name;
      report.cashRows++;
      addFlow(a, f);
    }
    if (outside) warn(input.docId, warning('outside_year', { count: outside, year: taxYear }));
  }

  const lines: SecurityLine[] = [];
  for (const a of accs.values()) {
    const name = a.positionName ?? a.otherName ?? a.isin ?? a.id;
    const values = moneyList(a.values);
    const income = moneyList(a.income);
    const withheld = moneyList(a.withheld);
    const firstDoc = a.docIds[0]!;
    for (const m of moneyList(a.inLieu)) {
      warn(firstDoc, warning('payment_in_lieu', { name, amount: m.amount, currency: m.currency }));
    }
    if (a.withholdingUnknown) warn(firstDoc, warning('withholding_country_unknown', { name }));
    const hasCash = a.incomeChf !== undefined || a.swiss !== undefined || a.foreign !== undefined;
    const line: SecurityLine = {
      id: a.id,
      ...(a.isin ? { isin: a.isin } : {}),
      name,
      ...((a.currency ?? income[0]?.currency)
        ? { currency: a.currency ?? income[0]!.currency }
        : {}),
      ...(a.country ? { country: a.country } : {}),
      ...(a.quantity ? { quantity: formatDecimal(a.quantity) } : {}),
      ...(values.length === 1 ? { value: values[0]! } : {}),
      ...(a.valueChf && centimes(a.valueChf) !== undefined
        ? { valueChf: centimes(a.valueChf)! }
        : {}),
      ...(a.valueChf ? { valueNote: note(a.valueChf)! } : {}),
      income,
      withheld,
      docIds: a.docIds,
    };
    // No income row but tax withheld (or refunded) in the year: the income is zero, not unknown.
    const incomeChf = a.incomeChf ? centimes(a.incomeChf) : hasCash ? 0 : undefined;
    if (incomeChf !== undefined) line.incomeChf = incomeChf;
    if (a.incomeChf) line.incomeNote = note(a.incomeChf)!;
    if (hasCash && !a.withholdingUnknown) {
      const swiss = a.swiss ? centimes(a.swiss) : 0;
      const foreign = a.foreign ? centimes(a.foreign) : 0;
      if (swiss !== undefined) line.withholdingSwissChf = swiss;
      if (foreign !== undefined) line.withholdingForeignChf = foreign;
      const notes = [note(a.swiss), note(a.foreign)].filter(Boolean).join('; ');
      if (notes) line.withholdingNote = notes;
    }
    lines.push(line);
  }
  const sortKey = (l: SecurityLine) => `${l.name.toLowerCase()}\u0000${l.id}`;
  lines.sort((x, y) => (sortKey(x) < sortKey(y) ? -1 : 1));

  return { taxYear, lines, exports: [...reports.values()] };
}

function addFlow(a: Acc, f: BrokerCashflow): void {
  if (f.kind === 'withholding') {
    // Tax withheld is negative in exports; a refund of it is positive. Stored as tax paid.
    addMoney(a.withheld, f.amount, true);
    const paid = negateChf(f.chf);
    const money = { ...f.amount, amount: negateAmount(f.amount.amount) };
    // Swiss withholding tax applies to Swiss income only (ge-2025-guide-declaration-pp p. 41:
    // "Les rendements de titres étrangers ne sont pas soumis à l'impôt anticipé suisse").
    const country = a.country ?? f.country;
    if (!country) a.withholdingUnknown = true;
    else if (country === 'CH') a.swiss = addChf(a.swiss, paid, money);
    else a.foreign = addChf(a.foreign, paid, money);
    return;
  }
  addMoney(a.income, f.amount);
  if (f.kind === 'payment_in_lieu') addMoney(a.inLieu, f.amount);
  a.incomeChf = addChf(a.incomeChf, f.chf, f.amount);
}

const negateAmount = (amount: string) =>
  amount.startsWith('-') ? amount.slice(1) : amount === '0' ? amount : `-${amount}`;
