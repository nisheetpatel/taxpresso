// The canton's own worked examples: the 2025 guide's sample return (lu-2025-guide-wegleitung p. 13
// to 19, Familie Beispiel-Muster in Luzern), and the Steuerbuch's examples of the rules. The guide's
// sample was not updated in full for 2025: its form V and page 3 use the 2024 amounts of a few
// deductions (docs/sources/lu/NOTES.md, Open points), so only the lines it computes with the 2025
// rules are checked here. The tariffs' tables and examples are in tariffs.test.ts.
import { describe, expect, it } from 'vitest';
import {
  assetManagementFlat,
  computeReturn,
  degressiveDeduction,
  flatShare,
  luParamsFor,
  type LuTaxResult,
} from '../src/index.js';

const c = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: c(francs) });
const item = (r: LuTaxResult, code: string) =>
  r.icc!.items.filter((i) => i.code === code).reduce((s, i) => s + i.amount, 0) / 100;

describe('lu-2025-guide-wegleitung p. 14 to 16: the sample family’s salaries and form B', () => {
  // Markus: Lohnausweis 97,000 + 2,520 (2.2, private share of the company car) = 99,520 gross,
  // 7,309 AHV, 4,801 pension fund: net 87,410 (p. 14; Ziffer 100, p. 15). Box F ticked (company
  // car): no travel costs. Form B (p. 16): meals 110 days x 15 = 1,650 (212); 3 % of the net salary
  // 87,410 = 2,622 (220); Total Berufsauslagen 4,272 (238).
  // Agnes: 30,520 gross, 2,506 AHV, 2,121 pension fund: net 25,893 (p. 14; Ziffer 101, p. 15).
  const r = computeReturn({
    taxYear: 2025,
    commune: 'Luzern',
    civilStatus: 'married',
    people: [
      {
        id: 'p1',
        employments: [
          {
            gross: amt(99_520),
            socialContributions: amt(7_309),
            pensionFund: amt(4_801),
            freeTransport: true,
          },
        ],
        mealDays: 110,
      },
      {
        id: 'p2',
        employments: [
          {
            gross: amt(30_520),
            socialContributions: amt(2_506),
            pensionFund: amt(2_121),
            canteen: true,
          },
        ],
      },
    ],
    children: [{ custody: 'full', under14: true }],
  });

  it('the net salaries (100, 101)', () => {
    expect(item(r, '100')).toBe(87_410);
    expect(item(r, '101')).toBe(25_893);
  });

  it('Markus’s form B: 212 = 1,650, 220 = 2,622, 238 = 4,272, no travel costs', () => {
    expect(item(r, '212')).toBe(-1_650);
    expect(item(r, '220')).toBe(-2_622);
    expect(item(r, '208t')).toBe(0);
    const formB = r.icc!.items.filter(
      (i) => i.person === 'p1' && ['208t', '212', '214', '220', '236'].includes(i.code),
    );
    expect(formB.reduce((s, i) => s + i.amount, 0) / 100).toBe(-4_272);
  });

  it('the tax-free wealth of a married couple with one child (472, 474; p. 19)', () => {
    const w = r.icc!.wealth.items;
    expect(w.find((i) => i.code === '472')?.amount).toBe(c(-125_000));
    expect(w.find((i) => i.code === '474')?.amount).toBe(c(-12_500));
  });

  it('the guide’s sample uses 2024 amounts on form V and page 3; the 2025 law’s are used', () => {
    // Form V (p. 16): 5,100 for spouses with pension contributions; page 3 (p. 17): 4,900 for both
    // spouses earning (326), 7,000 per child (350), 1,100 own care (353). The 2025 law
    // (lu-2025-law-steuergesetz § 40 Abs. 1 lit. g and Abs. 2, § 42 Abs. 1 lit. a and b) and the
    // canton's table (lu-2025-tariff-tariftabellen-abzuege p. 2) give 5,200, 5,000, 8,000, 2,000.
    const A = luParamsFor(2025).amounts;
    expect(A.insurance.value.married).toBe(c(5_200));
    expect(A.twoEarner.value).toBe(c(5_000));
    expect(A.child.value.base).toBe(c(8_000));
    expect(A.ownCare.value).toBe(c(2_000));
    expect(item(r, '350')).toBe(-8_000);
    expect(item(r, '353')).toBe(-2_000);
    expect(item(r, '326')).toBe(-5_000);
  });
});

describe('lu-2025-guide-wegleitung p. 14: the flat costs of keeping securities (WV Ziffer 6)', () => {
  it('0.3 % of the tax value 449,642 = 1,348.93 -> 1,349, below the income 14,791', () => {
    // Total Steuerwert 449,642; gross income A 5,317 + B 9,474 = 14,791; Ziffer 6: 1,349.
    const am = luParamsFor(2025).amounts.assetManagement.value;
    expect(assetManagementFlat(am, { value: c(449_642), income: c(14_791) })).toBe(c(1_349));
  });
});

describe('the Steuerbuch’s examples', () => {
  it('degressive social deduction (§ 42 Nr. 6; guide p. 33): 2,800 and 4,200', () => {
    // lu-2025-deductions-steuerbuch-band1 p. 195, lu-2026-deductions-steuerbuch-band1 p. 200 (with
    // the 2025 limits 50,000 and 80,000).
    const p = luParamsFor(2025).amounts.degressive.value;
    expect(degressiveDeduction(p, { family: false, netIncome: c(30_000) }).deduction).toBe(
      c(2_800),
    );
    expect(degressiveDeduction(p, { family: true, netIncome: c(50_000) }).deduction).toBe(c(4_200));
    expect(degressiveDeduction(p, { family: false, netIncome: c(50_000) }).deduction).toBe(0);
  });

  it('other professional costs (§ 33 Nr. 3 Ziff. 1): 100,000 -> 3,000; 20,000 -> 2,000 minimum', () => {
    // lu-2025-deductions-steuerbuch-band1 p. 102; lu-2026-deductions-steuerbuch-band1 p. 106.
    for (const year of [2025, 2026]) {
      const p = luParamsFor(year).amounts.professionalFlat.value;
      expect(flatShare(c(100_000), p)).toBe(c(3_000));
      expect(flatShare(c(20_000), p)).toBe(c(2_000));
    }
  });

  it('a side job (§ 33 Nr. 3 Ziff. 5): 20 % of 5,875 = 1,175', () => {
    // lu-2025-deductions-steuerbuch-band1 p. 112; lu-2026-deductions-steuerbuch-band1 p. 116.
    for (const year of [2025, 2026]) {
      expect(flatShare(c(5_875), luParamsFor(year).amounts.sideJobFlat.value)).toBe(c(1_175));
    }
  });
});
