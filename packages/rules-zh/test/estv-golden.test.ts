// Zurich against the Federal Tax Administration's own calculator (SPEC.md section 13, item 2):
// test/golden/estv/zh-<year>.json holds what swisstaxcalculator.estv.admin.ch holds and computes,
// recorded by scripts/estv-cantons-golden.mjs, a dev tool. Nothing here uses the network.
//
// - `rates`: the multipliers of every commune (Staatssteuerfuss, Gemeindesteuerfuss, the three
//   churches), compared with the engine's tables by BFS number.
// - `cases`: the taxes of made-up cases in the City of Zurich from a taxable income and wealth
//   given as they are: the tariffs (Grundtarif, Verheiratetentarif), the rounding of the taxable
//   amounts, the multipliers, the church tax and the Personalsteuer. Nothing about the deductions.
//
// The calculator is evidence, not the authority: where it and the canton's own documents differ,
// the documents decide, and the difference is pinned below with the document that decides it
// (docs/sources/zh/NOTES.md, "Against the federal calculator").
//
// The calculator answers in whole francs and gives the tax on income and on wealth apart; the
// engine multiplies the einfache Staatssteuer of the two together. So each case is also run with
// its income alone and with its wealth alone, and every figure is compared on its own: the
// calculator's franc is the exact amount rounded, the engine's amount is rounded to 5 Rappen
// (Weisung ZStB 173.1 Rz 78), so the two are at most 52 centimes apart.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assess, zhParamsFor, type Confession } from '../src/index.js';

interface Rates {
  canton: number;
  commune: number;
  reformed: number;
  catholic: number;
  christCatholic: number;
}
interface Estv {
  IncomeSimpleTaxCanton: number;
  IncomeTaxCanton: number;
  IncomeTaxCity: number;
  IncomeTaxChurch: number;
  FortuneSimpleTaxCanton: number;
  FortuneTaxCanton: number;
  FortuneTaxCity: number;
  FortuneTaxChurch: number;
  PersonalTax: number;
}
interface Golden {
  capital: { bfs: number };
  rates: { bfs: number; name: string; income: Rates; wealth: Rates }[];
  cases: { household: string; income: number; wealth: number; estv: Estv }[];
}
type TaxYear = 2025 | 2026;

const load = (taxYear: TaxYear) =>
  JSON.parse(
    readFileSync(new URL(`../../../test/golden/estv/zh-${taxYear}.json`, import.meta.url), 'utf8'),
  ) as Golden;

/**
 * The household as the engine takes it: a parent living with their child has the married tariff
 * (StG § 35 Abs. 2); each adult owes the Personalsteuer.
 */
const HOUSEHOLDS: Record<
  string,
  { tariff: 'basic' | 'married'; adults: 1 | 2; church: Confession }
> = {
  single: { tariff: 'basic', adults: 1, church: 'none' },
  married: { tariff: 'married', adults: 2, church: 'none' },
  married2: { tariff: 'married', adults: 2, church: 'none' },
  single1: { tariff: 'married', adults: 1, church: 'none' },
  singleReformed: { tariff: 'basic', adults: 1, church: 'reformed' },
  singleCatholic: { tariff: 'basic', adults: 1, church: 'catholic' },
  singleChristCatholic: { tariff: 'basic', adults: 1, church: 'christ_catholic' },
  marriedReformed: { tariff: 'married', adults: 2, church: 'reformed' },
};

/**
 * Multipliers the calculator holds differently from the canton's own table. The table is the
 * statistics office's "Bezogene Gemeindesteuerfüsse" (zh-na-communal-steuerfuesse-seit-2012, one
 * sheet per year), which the same office's time series repeats (zh-na-communal-steuerfuesse-
 * zeitreihe) and marks final for 2026 (zh-2026-communal-steuerfuesse-aktuell, "definitiv"); the
 * engine's table is generated from it (scripts/zh-communes.mjs). The engine keeps the canton's.
 * - Aeugst a.A. 2025: sheet STFUSS2025 row BFS 1, column O (Total ohne Kirchen) 92: the commune
 *   71 (C) and the Oberstufenschulgemeinde 21 (G). The calculator has 90.
 * - Hittnau 2025: sheet STFUSS2025 row BFS 173, column I (reformierte Kirche) 13; the calculator
 *   has 14, the sheet's figure for 2024 (STFUSS2024, column I).
 * - Wettswil a.A. 2026: sheet STFUSS2026 row BFS 14, column K (katholische Kirche) 11, as in 2025
 *   and 2024; the calculator has 12.
 */
const OTHER_MULTIPLIERS: Record<TaxYear, string[]> = {
  2025: [
    'Aeugst am Albis (BFS 1), commune: 92 here, 90 there',
    'Hittnau (BFS 173), reformed: 13 here, 14 there',
  ],
  2026: ['Wettswil am Albis (BFS 14), catholic: 11 here, 12 there'],
};

/**
 * The einfache Staatssteuer on wealth where the tariff gives a half franc (the rates are in half
 * per mille, the wealth in whole CHF 1,000). The Weisung rounds the einfache Staatssteuer down to
 * whole francs (zh-na-tariff-weisung-steuerrechnungen-zstb-173-1 Rz 71, p. 11: "Fr. 45.29 ist
 * auf Fr. 45.-- abzurunden"); the calculator keeps the half franc and shows it rounded up. The
 * engine follows the Weisung. Worked out by hand from the steps of StG § 47, every wealth of the
 * grid: for example 2026 Grundtarif, 150,000 - 81,000 = 69,000 at 0.5 per mille = 34.50, and
 * 3,000,000: 3,428 + 661,000 x 2.5 per mille (1,652.50) = 5,080.50; 2025 Verheiratetentarif,
 * 500,000: 119.50 + 102,000 x 1 per mille = 221.50. The cumulative amounts are next to each list.
 */
const HALF_FRANCS: Record<TaxYear, string[]> = {
  // Grundtarif 2025 (free to 80,000; 119 at 318,000; 518 at 717,000; 1,472 at 1,353,000; 3,384
  // at 2,309,000; 5,766.50 at 3,262,000): 642.50, 942.50, 5,111.50, 10,980.50 and 25,980.50.
  // Verheiratetentarif 2025 (free to 159,000; 119.50 at 398,000; 516.50 at 795,000; 1,472 at
  // 1,432,000; 3,382 at 2,387,000; 5,769.50 at 3,342,000): 20.50, 70.50, 221.50, 4,914.50,
  // 10,743.50 and 25,743.50.
  2025: [
    'single, wealth 800000: engine 642.00, calculator 643',
    'single, wealth 1000000: engine 942.00, calculator 943',
    'single, wealth 3000000: engine 5111.00, calculator 5112',
    'single, wealth 5000000: engine 10980.00, calculator 10981',
    'single, wealth 10000000: engine 25980.00, calculator 25981',
    'married, wealth 200000: engine 20.00, calculator 21',
    'married, wealth 300000: engine 70.00, calculator 71',
    'married, wealth 500000: engine 221.00, calculator 222',
    'married, wealth 3000000: engine 4914.00, calculator 4915',
    'married, wealth 5000000: engine 10743.00, calculator 10744',
    'married, wealth 10000000: engine 25743.00, calculator 25744',
    'marriedReformed, wealth 500000: engine 221.00, calculator 222',
  ],
  // Grundtarif 2026 (free to 81,000; 120.50 at 322,000; 524.50 at 726,000; 1,492 at 1,371,000;
  // 3,428 at 2,339,000; 5,840.50 at 3,304,000): 9.50, 34.50, 59.50, 109.50, 298.50, 635.50,
  // 935.50, 5,080.50, 10,928.50 and 25,928.50. Verheiratetentarif 2026 (free to 161,000; 121 at
  // 403,000; 523 at 805,000; 1,492 at 1,451,000; 3,426 at 2,418,000; 5,843.50 at 3,385,000):
  // 19.50, 69.50, 815.50, 10,688.50 and 25,688.50.
  2026: [
    'single, wealth 100000: engine 9.00, calculator 10',
    'single, wealth 150000: engine 34.00, calculator 35',
    'single, wealth 200000: engine 59.00, calculator 60',
    'single, wealth 300000: engine 109.00, calculator 110',
    'single, wealth 500000: engine 298.00, calculator 299',
    'single, wealth 800000: engine 635.00, calculator 636',
    'single, wealth 1000000: engine 935.00, calculator 936',
    'single, wealth 3000000: engine 5080.00, calculator 5081',
    'single, wealth 5000000: engine 10928.00, calculator 10929',
    'single, wealth 10000000: engine 25928.00, calculator 25929',
    'married, wealth 200000: engine 19.00, calculator 20',
    'married, wealth 300000: engine 69.00, calculator 70',
    'married, wealth 1000000: engine 815.00, calculator 816',
    'married, wealth 5000000: engine 10688.00, calculator 10689',
    'married, wealth 10000000: engine 25688.00, calculator 25689',
    'singleReformed, wealth 500000: engine 298.00, calculator 299',
    'singleCatholic, wealth 500000: engine 298.00, calculator 299',
    'singleChristCatholic, wealth 500000: engine 298.00, calculator 299',
  ],
};

describe.each([2025, 2026] as const)('the federal calculator, Zurich %i', (taxYear) => {
  const golden = load(taxYear);
  const P = zhParamsFor(taxYear);

  it('has the multipliers of every commune, but for three the canton’s table gives otherwise', () => {
    const differences: string[] = [];
    expect(golden.rates.length).toBe(160);
    expect(P.communes.value.length).toBe(160);
    for (const r of golden.rates) {
      // The same multipliers on income and on wealth (StG § 2).
      expect(r.wealth, r.name).toEqual(r.income);
      const c = P.communes.value.find((x) => x.bfs === r.bfs);
      if (!c) {
        differences.push(`${r.name} (BFS ${r.bfs}): not in the engine's table`);
        continue;
      }
      const check = (what: string, ours: readonly number[], theirs: number) => {
        if (!ours.includes(theirs))
          differences.push(
            `${r.name} (BFS ${r.bfs}), ${what}: ${ours.join(' or ')} here, ${theirs} there`,
          );
      };
      check('canton', [P.cantonalRate.value], r.income.canton);
      check('commune', c.rates, r.income.commune);
      check('reformed', c.reformed, r.income.reformed);
      check('catholic', c.catholic, r.income.catholic);
      check('christ catholic', c.christCatholic, r.income.christCatholic);
    }
    expect(differences).toEqual(OTHER_MULTIPLIERS[taxYear]);
  });

  it('gives the calculator’s taxes in the City of Zurich, figure by figure', () => {
    expect(golden.cases.length).toBe(174);
    const differences: string[] = [];
    const halfFrancs: string[] = [];
    for (const c of golden.cases) {
      const h = HOUSEHOLDS[c.household]!;
      const taxes = (income: number, wealth: number) =>
        assess({
          taxYear,
          commune: golden.capital.bfs,
          tariff: h.tariff,
          adults: h.adults,
          ...(h.church === 'none'
            ? {}
            : { church: { members: Array.from({ length: h.adults }, () => h.church) } }),
          incomeItems: [{ code: '100', person: 'p1', amount: income * 100 }],
          wealthItems: [{ code: '400', person: 'p1', amount: wealth * 100 }],
        }).taxes;
      const at = `${c.household}, income ${c.income}, wealth ${c.wealth}`;
      const said = (ours: number, theirs: number) =>
        `engine ${(ours / 100).toFixed(2)}, calculator ${theirs}`;
      /** Apart by more than the two roundings allow, plus `slack` centimes. */
      const near = (what: string, ours: number, theirs: number, slack = 0) => {
        if (Math.abs(ours - theirs * 100) > 52 + slack)
          differences.push(`${what}, ${at}: ${said(ours, theirs)}`);
      };
      const e = c.estv;
      const onIncome = taxes(c.income, 0);
      const onWealth = taxes(0, c.wealth);
      const both = taxes(c.income, c.wealth);

      // The einfache Staatssteuer on income is in whole francs on both sides: the same franc.
      if (onIncome.simpleIncome.amount !== e.IncomeSimpleTaxCanton * 100)
        differences.push(
          `simple tax on income, ${at}: ${said(onIncome.simpleIncome.amount, e.IncomeSimpleTaxCanton)}`,
        );
      near('cantonal tax on income', onIncome.cantonal.amount, e.IncomeTaxCanton);
      near('communal tax on income', onIncome.communal.amount, e.IncomeTaxCity);
      near('church tax on income', onIncome.church?.amount ?? 0, e.IncomeTaxChurch);

      // On wealth, the same franc too, but for the half francs the Weisung drops (HALF_FRANCS):
      // there the taxes are lower by half a franc times the multiplier, at most 60 centimes.
      const half = onWealth.simpleWealth.amount !== e.FortuneSimpleTaxCanton * 100;
      if (half)
        halfFrancs.push(
          `${c.household}, wealth ${c.wealth}: ${said(onWealth.simpleWealth.amount, e.FortuneSimpleTaxCanton)}`,
        );
      const slack = half ? 60 : 0;
      near('cantonal tax on wealth', onWealth.cantonal.amount, e.FortuneTaxCanton, slack);
      near('communal tax on wealth', onWealth.communal.amount, e.FortuneTaxCity, slack);
      near('church tax on wealth', onWealth.church?.amount ?? 0, e.FortuneTaxChurch, slack);

      // Income and wealth together, as the engine bills them: the sum of the two parts, give or
      // take the 5 Rappen of one rounding instead of two.
      expect(both.simpleIncome.amount).toBe(onIncome.simpleIncome.amount);
      expect(both.simpleWealth.amount).toBe(onWealth.simpleWealth.amount);
      for (const tax of ['cantonal', 'communal', 'church'] as const) {
        const together = both[tax]?.amount ?? 0;
        const apart = (onIncome[tax]?.amount ?? 0) + (onWealth[tax]?.amount ?? 0);
        expect(Math.abs(together - apart), `${tax}, ${at}`).toBeLessThanOrEqual(5);
      }

      // CHF 24 for each adult (StG § 199), to the franc.
      if (both.personalTax.amount !== e.PersonalTax * 100)
        differences.push(`Personalsteuer, ${at}: ${said(both.personalTax.amount, e.PersonalTax)}`);
    }
    expect(differences).toEqual([]);
    expect(halfFrancs).toEqual(HALF_FRANCS[taxYear]);
  });

  // The rule the first comparison found (three made-up incomes are not whole hundreds): the
  // taxable income is rounded down to CHF 100 before the tariff
  // (zh-na-tariff-weisung-steuerrechnungen-zstb-173-1 Rz 45, p. 8), and the calculator does so.
  it('reads the tariff at the taxable income rounded down to CHF 100, as the calculator does', () => {
    for (const household of ['single', 'married'] as const) {
      const h = HOUSEHOLDS[household]!;
      const simple = (income: number) =>
        assess({
          taxYear,
          commune: golden.capital.bfs,
          tariff: h.tariff,
          adults: h.adults,
          incomeItems: [{ code: '100', person: 'p1', amount: income * 100 }],
          wealthItems: [],
        }).taxes.simpleIncome.amount;
      const theirs = (income: number) =>
        golden.cases.find((c) => c.household === household && c.income === income && !c.wealth)!
          .estv.IncomeSimpleTaxCanton * 100;
      expect(simple(99_999)).toBe(simple(99_900));
      expect(simple(99_999)).toBe(theirs(99_999));
      expect(simple(100_000)).toBe(theirs(100_000));
      expect(simple(100_000)).toBeGreaterThan(simple(99_999));
      expect(simple(33_333)).toBe(theirs(33_333));
      expect(simple(123_456)).toBe(theirs(123_456));
    }
  });
});
