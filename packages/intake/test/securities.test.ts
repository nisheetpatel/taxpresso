import { describe, expect, it } from 'vitest';
import { parseBrokerExport } from '../src/broker/detect.js';
import { parseIbkrFlex } from '../src/broker/ibkr.js';
import { type ExportInput, summarizeSecurities } from '../src/broker/securities.js';
import type { BrokerStatement } from '../src/broker/types.js';
import { fixture } from './helpers.js';

const input = (
  docId: string,
  statement: BrokerStatement,
  extra: Partial<ExportInput> = {},
): ExportInput => ({
  docId,
  filename: `${docId}.export`,
  addedAt: '2027-01-10T10:00:00.000Z',
  statement,
  ...extra,
});
const from = (name: string) => parseBrokerExport(fixture(name))!;
const byId = <T extends { id: string }>(list: T[]) =>
  Object.fromEntries(list.map((l) => [l.id, l]));

describe('the securities list from broker exports', () => {
  it('gives one line per security, in CHF centimes, with Swiss and foreign tax apart', () => {
    const summary = summarizeSecurities([input('d_ibkr', from('dupont-ibkr-2026.xml'))], 2026);
    const lines = byId(summary.lines);
    expect(summary.lines.map((l) => l.name)).toEqual([
      'BARISTA WORLD UCITS ETF',
      'CREMA LAC HOLDING SA',
      'ESPRESSO INDUSTRIES INC',
    ]);
    expect(lines.USTXPRS00017).toMatchObject({
      isin: 'USTXPRS00017',
      currency: 'USD',
      country: 'US',
      quantity: '10',
      value: { amount: '1255', currency: 'USD' },
      valueChf: 100_400,
      income: [{ amount: '10', currency: 'USD' }],
      // 5 x 0.88125 + 5 x 0.8812 = 8.81225: rounded once.
      incomeChf: 881,
      withheld: [{ amount: '1.5', currency: 'USD' }],
      withholdingSwissChf: 0,
      withholdingForeignChf: 132,
      docIds: ['d_ibkr'],
    });
    expect(lines.CHTXPRS00026).toMatchObject({
      country: 'CH',
      valueChf: 90_500,
      incomeChf: 3000,
      withholdingSwissChf: 1050,
      withholdingForeignChf: 0,
    });
    expect(lines.IETXPRS00038).toMatchObject({ quantity: '3.5', valueChf: 28_028, incomeChf: 111 });
    // What the income was, for the foreign tax credit: a payment in lieu is not a dividend.
    expect(summary.lines.map((l) => [l.id, l.incomeKind])).toEqual([
      ['IETXPRS00038', 'mixed'],
      ['CHTXPRS00026', 'dividend'],
      ['USTXPRS00017', 'dividend'],
    ]);
    for (const l of summary.lines) {
      for (const v of [l.valueChf, l.incomeChf, l.withholdingSwissChf, l.withholdingForeignChf]) {
        if (v !== undefined) expect(Number.isSafeInteger(v)).toBe(true);
      }
    }
    expect(lines.USTXPRS00017!.valueNote).toBe(
      'USD 1255 at USD to CHF 0.8 (Interactive Brokers rate, 2026-12-31)',
    );
    const report = summary.exports[0]!;
    expect(report).toMatchObject({ positions: 3, cashRows: 7 });
    expect(report.warnings.map((w) => w.code)).toContain('payment_in_lieu');
  });

  it('adds up the same security across brokers and accounts', () => {
    const summary = summarizeSecurities(
      [
        input('d_ibkr', from('dupont-ibkr-2026.xml')),
        input('d_usd', from('dupont-ibkr-2026-usd-base.xml')),
        input('d_dgp', from('dupont-degiro-portfolio.csv')),
        input('d_dga', from('dupont-degiro-account.csv')),
      ],
      2026,
    );
    const lines = byId(summary.lines);
    const espr = lines.USTXPRS00017!;
    // IBKR 10 + IBKR (second file) 5 + DEGIRO 4.
    expect(espr.quantity).toBe('19');
    expect(espr.value).toEqual({ amount: '2384.5', currency: 'USD' });
    expect(espr.valueChf).toBe(100_400 + 50_200 + 40_160);
    // 8.81225 + 2.2007042... + 1.8823529... = 12.8952... CHF
    expect(espr.incomeChf).toBe(1290);
    expect(espr.docIds.sort()).toEqual(['d_dga', 'd_dgp', 'd_ibkr', 'd_usd']);
    expect(lines.CHTXPRS00042).toMatchObject({
      quantity: '5000',
      valueChf: 506_000,
      incomeChf: 7500,
      withholdingSwissChf: 2625,
    });
    // EUR dividends at DEGIRO without a CHF rate: the CHF income stays unknown, never partial.
    expect(lines.NLTXPRS00066).toMatchObject({ quantity: '12', valueChf: 9165 });
    expect(lines.NLTXPRS00066!.incomeChf).toBeUndefined();
    expect(lines.NLTXPRS00066!.withholdingForeignChf).toBeUndefined();
    expect(lines.NLTXPRS00066!.income).toEqual([{ amount: '1.8', currency: 'EUR' }]);
    const degiro = summary.exports.find((e) => e.docId === 'd_dgp')!;
    expect(degiro.warnings.map((w) => w.code)).toContain('no_date');
    const account = summary.exports.find((e) => e.docId === 'd_dga')!;
    expect(account.warnings.map((w) => w.code)).toContain('outside_year');
  });

  it('lets a newer export of the same account replace the older one', () => {
    const old = parseBrokerExport(fixture('dupont-ibkr-2026.xml'))!;
    const text = fixture('dupont-ibkr-2026.xml')
      .toString('utf8')
      .replace('whenGenerated="20270104;093000"', 'whenGenerated="20270210;120000"')
      .replace(
        'position="20" markPrice="45.25" positionValue="905"',
        'position="25" markPrice="45.25" positionValue="1131.25"',
      );
    const summary = summarizeSecurities(
      [
        input('d_old', old),
        input('d_new', parseIbkrFlex(text), { addedAt: '2027-02-10T12:00:00.000Z' }),
      ],
      2026,
    );
    expect(byId(summary.lines).CHTXPRS00026).toMatchObject({ quantity: '25', valueChf: 113_125 });
    const report = summary.exports.find((e) => e.docId === 'd_old')!;
    expect(report.replacedBy).toBe('d_new');
    expect(report.warnings.at(-1)).toMatchObject({
      code: 'replaced',
      en: 'Replaced by the newer export d_new.export.',
    });
  });

  it('counts an account once when it is in two exports, account by account', () => {
    const both = from('dupont-ibkr-2026-usd-base.xml');
    const onlyU2 = parseIbkrFlex(
      fixture('dupont-ibkr-2026-usd-base.xml')
        .toString('utf8')
        .replace(/<FlexStatement accountId="U0000003"[\s\S]*?<\/FlexStatement>/, '')
        .replace('whenGenerated="2027-01-04;10:00:00"', 'whenGenerated="2027-02-01;10:00:00"')
        .replace(
          'position="40" markPrice="25" positionValue="1000"',
          'position="50" markPrice="25" positionValue="1250"',
        ),
    );
    expect(onlyU2.accounts).toEqual(['U0000002']);
    const summary = summarizeSecurities([input('d_both', both), input('d_u2', onlyU2)], 2026);
    const lines = byId(summary.lines);
    expect(lines.DETXPRS00054!.quantity).toBe('50');
    expect(lines.USTXPRS00017!.quantity).toBe('5');
    // The other account of the older export still counts.
    expect(lines.CHTXPRS00042!.quantity).toBe('5000');
    const report = summary.exports.find((e) => e.docId === 'd_both')!;
    expect(report.replacedBy).toBeUndefined();
    expect(report.warnings.map((w) => w.en)).toContain(
      'Account U0000002: replaced by the newer export d_u2.export.',
    );
  });

  it('keeps exports of other years and other dates out', () => {
    const lastYear = parseIbkrFlex(
      fixture('dupont-ibkr-2026.xml')
        .toString('utf8')
        .replace(/2026(\d{4})/g, '2025$1'),
    );
    const october = parseIbkrFlex(
      fixture('dupont-ibkr-2026.xml')
        .toString('utf8')
        .replace('toDate="20261231"', 'toDate="20261013"')
        .replace(/reportDate="20261231"/g, 'reportDate="20261013"')
        .replace('accountId="U0000001" fromDate', 'accountId="U0000004" fromDate'),
    );
    const summary = summarizeSecurities([input('d_2025', lastYear), input('d_oct', october)], 2026);
    expect(summary.exports.find((e) => e.docId === 'd_2025')!.warnings.at(-1)!.code).toBe(
      'wrong_year',
    );
    const oct = summary.exports.find((e) => e.docId === 'd_oct')!;
    expect(oct.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(['partial_year', 'positions_not_year_end']),
    );
    expect(oct.positions).toBe(0);
    // Income paid in the year still counts; positions on 13 October don't.
    const crema = byId(summary.lines).CHTXPRS00026!;
    expect(crema.quantity).toBeUndefined();
    expect(crema.incomeChf).toBe(3000);
  });

  it('never classifies tax withheld when it can’t tell the country', () => {
    const xml = `<FlexQueryResponse><FlexStatements><FlexStatement accountId="U0000009" fromDate="20260101" toDate="20261231">
      <AccountInformation currency="CHF"/>
      <CashTransactions>
        <CashTransaction currency="CHF" conid="555" type="Dividends" amount="10" dateTime="20260302"/>
        <CashTransaction currency="CHF" conid="555" type="Withholding Tax" amount="-3.5" dateTime="20260302"/>
      </CashTransactions>
    </FlexStatement></FlexStatements></FlexQueryResponse>`;
    const summary = summarizeSecurities([input('d_x', parseIbkrFlex(xml))], 2026);
    const line = summary.lines[0]!;
    expect(line).toMatchObject({ id: 'ibkr-555', incomeChf: 1000 });
    expect(line.withholdingSwissChf).toBeUndefined();
    expect(line.withholdingForeignChf).toBeUndefined();
    expect(summary.exports[0]!.warnings.map((w) => w.code)).toContain(
      'withholding_country_unknown',
    );
  });
});
