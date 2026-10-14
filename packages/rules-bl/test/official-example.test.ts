// The canton's own worked figures for the rules that taper or cap: the guides' tables of the
// pensioners' deduction (bl-2025-wegleitung p. 38; bl-2026-wegleitung p. 39 for AHV and p. 40 for
// IV), the Steuerbuch's example of it (bl-na-steuerbuch p. 206, 33 Nr. 1, tax year 2014), and the
// rules the ordinance and the guide state with their amounts (side job, travel by car). The
// tariffs' examples are in test/tariffs.test.ts.
import { describe, expect, it } from 'vitest';
import {
  blParamsFor,
  pensionerDeduction,
  sideJobFlat,
  twoEarnerDeduction,
  vehicleCost,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);

// [Einkünfte, Abzug in %, Abzug in CHF], as the guide's table prints the rows.
type Rows = [number, number, number][];
const SINGLE_30240: Rows = [
  [30_240, 40, 12_096],
  [30_241, 39, 11_794],
  [30_341, 38, 11_530],
  [31_141, 30, 9_342],
  [32_141, 20, 6_428],
  [33_141, 10, 3_314],
  [33_641, 5, 1_682],
  [34_141, 0, 0],
];
const COUPLE_45360: Rows = [
  [45_360, 60, 27_216],
  [45_361, 59, 26_763],
  [45_611, 58, 26_454],
  [50_111, 40, 20_044],
  [55_111, 20, 11_022],
  [57_611, 10, 5_761],
  [58_861, 5, 2_943],
  [60_111, 0, 0],
];
const SINGLE_32760: Rows = [
  [32_760, 40, 13_104],
  [32_761, 39, 12_777],
  [32_861, 38, 12_487],
  [33_661, 30, 10_098],
  [34_661, 20, 6_932],
  [35_661, 10, 3_566],
  [36_161, 5, 1_808],
  [36_661, 0, 0],
];
const COUPLE_49140: Rows = [
  [49_140, 60, 29_484],
  [49_141, 59, 28_993],
  [49_391, 58, 28_647],
  [53_891, 40, 21_556],
  [58_891, 20, 11_778],
  [61_391, 10, 6_139],
  [62_641, 5, 3_132],
  [63_891, 0, 0],
];

function expectRows(year: 2025 | 2026, kind: 'ahv' | 'iv', couple: boolean, rows: Rows) {
  const p = blParamsFor(year).amounts.pensioner.value;
  for (const [income, percent, deduction] of rows) {
    const r = pensionerDeduction(p[kind], p, chf(income), couple);
    expect(
      [r.percent, r.deduction],
      `${year} ${kind} ${couple ? 'couple' : 'single'} ${income}`,
    ).toEqual([percent, chf(deduction)]);
  }
}

describe('the pensioners’ deduction (770, 771), the guides’ tables', () => {
  it('2025, AHV and IV (p. 38): one person and a couple', () => {
    for (const kind of ['ahv', 'iv'] as const) {
      expectRows(2025, kind, false, SINGLE_30240);
      expectRows(2025, kind, true, COUPLE_45360);
    }
  });

  it('2026, AHV with the 13th pension (p. 39)', () => {
    expectRows(2026, 'ahv', false, SINGLE_32760);
    expectRows(2026, 'ahv', true, COUPLE_49140);
  });

  it('2026, IV (p. 40)', () => {
    expectRows(2026, 'iv', false, SINGLE_30240);
    expectRows(2026, 'iv', true, COUPLE_45360);
  });

  it('the Steuerbuch’s example (p. 206): a couple in 2014, income 54,120, 12 %, 6,494', () => {
    // The maximum AHV/IV pension of a couple in 2014 was 42,120 (the example's own figure).
    const p = blParamsFor(2025).amounts.pensioner.value;
    const r = pensionerDeduction({ single: 0, couple: chf(42_120) }, p, chf(54_120), true);
    expect(r.percent).toBe(12);
    expect(r.deduction).toBe(chf(6_494));
  });
});

describe('caps and flat amounts', () => {
  it('a side job: 20 %, at least 800, at most 2,400; under 800, that income (guide p. 28)', () => {
    const p = blParamsFor(2025).amounts.sideJob.value;
    expect(sideJobFlat(chf(500), p)).toBe(chf(500));
    expect(sideJobFlat(chf(3_000), p)).toBe(chf(800));
    expect(sideJobFlat(chf(10_000), p)).toBe(chf(2_000));
    expect(sideJobFlat(chf(20_000), p)).toBe(chf(2_400));
    expect(sideJobFlat(0, p)).toBe(0);
  });

  it('a car without usable public transport: km x 2 x days x the rate (0.70 in 2025, 0.75 in 2026)', () => {
    expect(vehicleCost(12, 220, blParamsFor(2025).amounts.travel.value.carPerKm)).toBe(chf(3_696));
    expect(vehicleCost(12, 220, blParamsFor(2026).amounts.travel.value.carPerKm)).toBe(chf(3_960));
    expect(vehicleCost(10, 200, blParamsFor(2026).amounts.travel.value.motorbikePerKm)).toBe(
      chf(1_600),
    );
  });

  it('both spouses work: the lower earned income, at most 1,000 (StG § 8 Abs. 3)', () => {
    const max = blParamsFor(2026).amounts.twoEarner.value;
    expect(twoEarnerDeduction(chf(50_000), max)).toBe(chf(1_000));
    expect(twoEarnerDeduction(chf(600), max)).toBe(chf(600));
  });
});
