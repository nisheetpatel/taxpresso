// This year against last year, rubric by rubric. Last year's lines are synthetic facts as the
// prior-declaration reader stores them; they never feed this year's calculation.
import { Ledger } from '@taxpresso/ledger';
import { describe, expect, it } from 'vitest';
import { compareWithLastYear, computeReturn, KEYS_2026 } from '../src/index.js';

const chf = (n: number) => Math.round(n * 100);

function lastYear() {
  const l = new Ledger(2026, KEYS_2026);
  const put = (key: string, person: 'p1' | 'household', instance: string, value: number) =>
    l.append({
      key,
      person,
      instance,
      value,
      status: 'extracted',
      source: { method: 'claude', docId: 'd_prior', page: 2 },
    });
  put('prior.person.icc', 'p1', 'PG2-11.00', chf(80_000));
  put('prior.person.ifd', 'p1', 'PG2-11.00', chf(80_000));
  put('prior.person.icc', 'p1', 'A1-31.40', chf(7_000));
  put('prior.person.ifd', 'p1', 'A1-31.40', chf(7_000));
  put('prior.household.icc', 'household', 'PG3-99.00', chf(60_000));
  put('prior.household.ifd', 'household', 'PG3-99.00', chf(62_000));
  return l.view();
}

describe('this year against last year', () => {
  const input = {
    taxYear: 2026 as const,
    commune: 'geneve' as const,
    civilStatus: 'single' as const,
    people: [
      {
        id: 'p1' as const,
        employments: [{ gross: { value: chf(85_000) }, pensionFund: { value: chf(4_000) } }],
        pillar3a: { value: chf(7_258) },
      },
    ],
  };

  it('puts the engine’s figures next to last year’s lines', () => {
    const r = computeReturn(input);
    const rows = compareWithLastYear(r, lastYear());
    expect(rows.map((x) => [x.form, x.code, x.person])).toEqual([
      ['PG2', '11.00', 'A'],
      ['A1', '31.40', 'A'],
      ['PG3', '99.00', 'household'],
    ]);
    expect(rows[0]).toMatchObject({
      lastYear: { icc: chf(80_000), ifd: chf(80_000) },
      thisYear: { icc: chf(85_000), ifd: chf(85_000) },
      change: { icc: chf(5_000), ifd: chf(5_000) },
      lastYearNeedsOk: true,
    });
    expect(rows[1]!.thisYear).toEqual({ icc: chf(7_258), ifd: chf(7_258) });
    expect(rows[2]!.thisYear).toEqual({
      icc: r.icc!.taxableIncome.amount,
      ifd: r.ifd!.taxableIncome.amount,
    });
    // 2026: the cantonal figures rest on Geneva's 2025 values, so they are provisional.
    expect(rows[2]!.thisYearProvisional).toBe(true);
  });

  it('never lets last year’s figures into this year’s calculation', () => {
    const without = computeReturn(input);
    expect(compareWithLastYear(without, [])).toEqual([]);
    // The same input gives the same taxes whatever last year's facts are: they are not an input.
    expect(computeReturn(input).total).toBe(without.total);
  });
});
