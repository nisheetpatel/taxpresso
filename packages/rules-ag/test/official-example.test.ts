// The official worked examples for Aargau, as printed.
//
// ag-2025-guide-wegleitung p. 45 (Anhang II, Steuerberechnung): a married couple, both Reformed,
// "Gemeinde X" (Steuerfuss 94 %, church 15 %), taxable income 60,000 and taxable wealth 100,000:
// einfache Einkommenssteuer Tarif B 1,864.00, einfache Vermögenssteuer 70.00, total 1,934.00;
// Kantonssteuer (111 %) 2,146.70, Gemeindesteuer 1,818.00, Kirchensteuer 290.10, total 4,254.80.
// Gemeinde X is not a commune of the list: the example is run through assess with that commune.
//
// ag-2025-tariff-einkommenssteuer p. 2: the tax for 505,000 (A 49,792, B 45,036) worked out from
// the table's 500,000 (A 49,242, B 44,511); the tax for 90,000 (A at 6.6533 %, B at 4.4088 %) and
// for 220,000 (A 19,105, B 15,776).
// ag-2025-tariff-vermoegenssteuer p. 1 and 2: 15,000,000 gives 23,775.30, 20,000,000 gives
// 31,775.30; 800,000 at 1.3191 per mille.
// ag-2026-deductions-versicherungspauschale p. 1 and 2: 3,804 rounded to 3,800 for others, double
// for married couples.
// ag-2026-deductions-kinderbetreuungskosten p. 9 (Beispiel 4): driving to the crèche, 88 days x 3 km
// x 2 trips x CHF 0.70 = 369.60.
import { describe, expect, it } from 'vitest';
import {
  agParamsFor,
  assess,
  drivingCost,
  incomeSimpleTax,
  wealthSimpleTax,
  type AgCommune,
  type ItemAmount,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const line = (code: string, francs: number, person: ItemAmount['person'] = 'household') => ({
  code,
  person,
  amount: chf(francs),
});

describe('Wegleitung 2025, Anhang II (ag-2025-guide-wegleitung p. 45)', () => {
  const gemeindeX: AgCommune = {
    name: 'Gemeinde X',
    rate: 94,
    church: { reformed: 15, catholic: 15, christCatholic: 15 },
    extra: [],
  };
  const r = assess({
    taxYear: 2025,
    commune: gemeindeX,
    tariff: 'B',
    church: { confession: 'reformed' },
    incomeItems: [line('1.1', 60_000, 'p1')],
    wealthItems: [line('20.1', 360_000), line('steuerfrei', -260_000)],
  });

  it('taxable income 60,000 and taxable wealth 100,000', () => {
    expect(r.taxableIncome.amount).toBe(chf(60_000));
    expect(r.wealth.taxableWealth.amount).toBe(chf(100_000));
  });

  it('einfache Steuer: Tarif B 1,864.00 + wealth 70.00 = 1,934.00', () => {
    expect(r.taxes.simpleIncome.amount).toBe(chf(1_864));
    expect(r.taxes.simpleWealth.amount).toBe(chf(70));
    expect(r.taxes.simple.amount).toBe(chf(1_934));
  });

  it('canton 111 % 2,146.70, commune 94 % 1,818.00, church 15 % 290.10, total 4,254.80', () => {
    expect(r.taxes.cantonal.amount).toBe(chf(2_146.7));
    expect(r.taxes.communal.amount).toBe(chf(1_818));
    expect(r.taxes.church?.amount).toBe(chf(290.1));
    expect(r.taxes.maxBurden).toBeNull();
    expect(r.taxes.total.amount).toBe(chf(4_254.8));
  });
});

describe('Tarif für die Einkommenssteuer 2025 (ag-2025-tariff-einkommenssteuer p. 2)', () => {
  for (const year of [2025, 2026] as const) {
    const T = agParamsFor(year).incomeTariff.value;
    const tax = (francs: number, tarif: 'A' | 'B') => incomeSimpleTax(T, chf(francs), tarif);

    it(`${year}: 500,000 (A 49,242, B 44,511) and 505,000 (A 49,792, B 45,036)`, () => {
      expect(tax(500_000, 'A')).toBe(chf(49_242));
      expect(tax(500_000, 'B')).toBe(chf(44_511));
      expect(tax(505_000, 'A')).toBe(chf(49_792));
      expect(tax(505_000, 'B')).toBe(chf(45_036));
    });

    it(`${year}: 90,000 at 6.6533 % (A) and 4.4088 % (B); 220,000 A 19,105, B 15,776`, () => {
      // The rate printed is the tax over the income, four decimals, rounded down.
      const rate = (t: number, y: number) => Math.floor((t * 1_000_000) / chf(y)) / 10_000;
      expect(rate(tax(90_000, 'A'), 90_000)).toBe(6.6533);
      expect(rate(tax(90_000, 'B'), 90_000)).toBe(4.4088);
      expect(tax(220_000, 'A')).toBe(chf(19_105));
      expect(tax(220_000, 'B')).toBe(chf(15_776));
    });
  }
});

describe('Tarif für die Vermögenssteuer 2025 (ag-2025-tariff-vermoegenssteuer p. 1 and 2)', () => {
  for (const year of [2025, 2026] as const) {
    const W = agParamsFor(year).wealthTariff.value;

    it(`${year}: 15,000,000 gives 23,775.30; 20,000,000 gives 31,775.30`, () => {
      expect(wealthSimpleTax(W, chf(15_000_000))).toBe(chf(23_775.3));
      expect(wealthSimpleTax(W, chf(20_000_000))).toBe(chf(31_775.3));
    });

    it(`${year}: 800,000 at 1.3191 per mille`, () => {
      const t = wealthSimpleTax(W, chf(800_000));
      expect(Math.floor((t * 10_000_000) / chf(800_000)) / 10_000).toBe(1.3191);
    });
  }
});

describe('Versicherungspauschale 2026 (ag-2026-deductions-versicherungspauschale p. 2)', () => {
  it('3,804 rounded to the CHF 100 is 3,800; married couples always double', () => {
    const ins = agParamsFor(2026).amounts.insurance.value;
    expect(ins.other).toBe(Math.round(3_804 / 100) * 100 * 100);
    expect(ins.married).toBe(2 * ins.other);
    expect(agParamsFor(2025).amounts.insurance.value).toEqual({
      married: chf(7_200),
      other: chf(3_600),
    });
  });
});

describe('Merkblatt Kinderbetreuungskosten, Beispiel 4 (p. 9)', () => {
  it('88 days x 3 km x 2 trips = 528 km at CHF 0.70: 369.60, 370 in whole francs', () => {
    const k = agParamsFor(2025).amounts.commuteKm.value;
    expect(drivingCost(3, 88, k.car, k)).toEqual({ km: 528, cost: chf(370) });
    expect(528 * k.car).toBe(chf(369.6));
  });
});
