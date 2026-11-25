// Bern against the Federal Tax Administration's own calculator (SPEC.md section 13, item 2):
// test/golden/estv/be-<year>.json holds what swisstaxcalculator.estv.admin.ch holds and computes,
// recorded by scripts/estv-cantons-golden.mjs, a dev tool. Nothing here uses the network.
//
// - `rates`: the multipliers of every commune (the canton's and the commune's Steueranlage, the
//   three church tax rates), in percent of the einfache Steuer there (297.5 is the engine's
//   2.975), compared with the engine's tables by BFS number.
// - `cases`: the taxes of made-up cases in the City of Bern from a taxable income and wealth given
//   as they are: the tariffs (StG Art. 42 Abs. 1 and 2, Art. 65), the amounts under CHF 100 and
//   CHF 1,000 dropped, the multipliers and the church tax. Nothing about the deductions.
//
// The calculator is evidence, not the authority: where it and the canton's documents differ, the
// documents decide, and the difference is pinned below (docs/sources/be/NOTES.md, "Against the
// federal calculator").
//
// The calculator answers in whole francs and gives the tax on income and on wealth apart; the
// engine multiplies the einfache Steuer of the two together. So each case is also run with its
// income alone and with its wealth alone, and every figure is compared on its own: the
// calculator's franc is the exact amount rounded, the engine's is rounded to the centime, so the
// two are at most 50 centimes apart.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assess, beParamsFor, maxBurden, type BeParish, type Confession } from '../src/index.js';

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
    readFileSync(new URL(`../../../test/golden/estv/be-${taxYear}.json`, import.meta.url), 'utf8'),
  ) as Golden;

/**
 * The household as the engine takes it: the tariff of Art. 42 Abs. 1 for married couples and for
 * a parent alone with their child, Abs. 2 for everyone else.
 */
const HOUSEHOLDS: Record<string, { tariff: 'married' | 'other'; church: Confession }> = {
  single: { tariff: 'other', church: 'none' },
  married: { tariff: 'married', church: 'none' },
  married2: { tariff: 'married', church: 'none' },
  single1: { tariff: 'married', church: 'none' },
  singleReformed: { tariff: 'other', church: 'reformed' },
  singleCatholic: { tariff: 'other', church: 'catholic' },
  singleChristCatholic: { tariff: 'other', church: 'christ_catholic' },
  marriedReformed: { tariff: 'married', church: 'reformed' },
};

const CHURCHES = [
  ['reformed', 'reformed'],
  ['catholic', 'catholic'],
  ['christ catholic', 'christCatholic'],
] as const satisfies readonly (readonly [string, keyof BeParish & keyof Rates])[];

/**
 * OPEN: the church tax rates the engine leaves empty because the canton's two documents print
 * different figures (docs/sources/be/NOTES.md, "Open points for the rules"), with what the
 * calculator holds for the commune. The engine computes no church tax of that church there.
 * - Roman Catholic, 2025, Kiesen, Münsingen, Rubigen, Allmendingen and Wichtrach: 0.17 in the tax
 *   administration's table (be-na-communal-steueranlagen-1983-2026 sheet Daten Gde, STJ 2025,
 *   column I), 0.1800 in the finance administration's document of the year
 *   (be-2025-steueranlagen-gemeinden-de table 2.1, p. 13, 16, 17, 18 and 20). The calculator has
 *   the second.
 * - Roman Catholic, 2026, Seehof: 0.322 in the table (STJ 2026, column I), 0.1150 in the document
 *   (be-2026-steueranlagen-gemeinden-de table 2.1, p. 19). The calculator has the second.
 * - Reformed, 2026, Scheunen (a part of Jegenstorf): 0.218 in the table (STJ 2026, column H),
 *   0.1850 in the document (p. 16). The calculator has one figure for the whole commune, the
 *   rest of Jegenstorf's, so it says nothing about Scheunen.
 */
const OPEN_RATES: Record<TaxYear, string[]> = {
  2025: [
    'Kiesen (BFS 611), Kiesen, catholic: calculator 18',
    'Münsingen (BFS 616), Münsingen, catholic: calculator 18',
    'Rubigen (BFS 623), Rubigen, catholic: calculator 18',
    'Allmendingen (BFS 630), Allmendingen b. Bern, catholic: calculator 18',
    'Wichtrach (BFS 632), Wichtrach, catholic: calculator 18',
  ],
  2026: [
    'Jegenstorf (BFS 540), Scheunen, reformed: calculator 21.8',
    'Seehof (BFS 709), Seehof, catholic: calculator 11.5',
  ],
};

describe.each([2025, 2026] as const)('the federal calculator, Bern %i', (taxYear) => {
  const golden = load(taxYear);
  const P = beParamsFor(taxYear);
  /** Percent of the einfache Steuer there, ten-thousandths here: 297.5 -> 29750. */
  const tenThousandths = (percent: number) => Math.round(percent * 100);

  it('has the multipliers of every commune, but for the church rates the documents leave open', () => {
    const differences: string[] = [];
    const open: string[] = [];
    expect(golden.rates.length).toBe(taxYear === 2025 ? 335 : 334);
    expect(P.communes.value.length).toBe(golden.rates.length);
    for (const r of golden.rates) {
      // The same multipliers on income and on wealth (StG Art. 2).
      expect(r.wealth, r.name).toEqual(r.income);
      const c = P.communes.value.find((x) => x.bfs === r.bfs);
      if (!c) {
        differences.push(`${r.name} (BFS ${r.bfs}): not in the engine's table`);
        continue;
      }
      const at = `${r.name} (BFS ${r.bfs})`;
      if (P.cantonalRate.value !== tenThousandths(r.income.canton))
        differences.push(`${at}, canton: ${P.cantonalRate.value} here, ${r.income.canton} there`);
      if (c.rate !== tenThousandths(r.income.commune))
        differences.push(`${at}, commune: ${c.rate} here, ${r.income.commune} there`);
      // One church rate per commune there; here one per part where the parishes differ: the
      // calculator's must be the rate of one of the parts.
      for (const [what, field] of CHURCHES) {
        const theirs = r.income[field];
        const ours = c.parishes.map((p) => p[field]);
        for (const p of c.parishes)
          if (p[field] === null) open.push(`${at}, ${p.name}, ${what}: calculator ${theirs}`);
        const known = ours.filter((v) => v !== null);
        if (known.length && !known.includes(tenThousandths(theirs)))
          differences.push(`${at}, ${what}: ${known.join(' or ')} here, ${theirs} there`);
      }
    }
    expect(differences).toEqual([]);
    expect(open).toEqual(OPEN_RATES[taxYear]);
  });

  it('gives the calculator’s taxes in the City of Bern, figure by figure', () => {
    expect(golden.cases.length).toBe(174);
    const differences: string[] = [];
    for (const c of golden.cases) {
      const h = HOUSEHOLDS[c.household]!;
      const taxes = (income: number, wealth: number) =>
        assess({
          taxYear,
          commune: golden.capital.bfs,
          tariff: h.tariff,
          church: { confession: h.church },
          incomeItems: [{ code: '2.21-haupt', person: 'p1', amount: income * 100 }],
          wealthItems: [{ code: '3.0-vermoegen', person: 'p1', amount: wealth * 100 }],
        }).taxes;
      const at = `${c.household}, income ${c.income}, wealth ${c.wealth}`;
      const near = (what: string, ours: number, theirs: number) => {
        if (Math.abs(ours - theirs * 100) > 50)
          differences.push(
            `${what}, ${at}: engine ${(ours / 100).toFixed(2)}, calculator ${theirs}`,
          );
      };
      const e = c.estv;
      const onIncome = taxes(c.income, 0);
      const onWealth = taxes(0, c.wealth);
      const both = taxes(c.income, c.wealth);
      near('simple tax on income', onIncome.simpleIncome.amount, e.IncomeSimpleTaxCanton);
      near('cantonal tax on income', onIncome.cantonal.amount, e.IncomeTaxCanton);
      near('communal tax on income', onIncome.communal.amount, e.IncomeTaxCity);
      near('church tax on income', onIncome.church?.amount ?? 0, e.IncomeTaxChurch);
      // The wealth taxes before the maximum burden, which the calculator does not know (below).
      near('simple tax on wealth', onWealth.simpleWealth.amount, e.FortuneSimpleTaxCanton);
      near('cantonal tax on wealth', onWealth.cantonal.amount, e.FortuneTaxCanton);
      near('communal tax on wealth', onWealth.communal.amount, e.FortuneTaxCity);
      near('church tax on wealth', onWealth.church?.amount ?? 0, e.FortuneTaxChurch);

      // Income and wealth together, as the engine bills them: the sum of the two parts, give or
      // take the centime of one rounding instead of two.
      expect(both.simpleIncome.amount).toBe(onIncome.simpleIncome.amount);
      expect(both.simpleWealth.amount).toBe(onWealth.simpleWealth.amount);
      for (const tax of ['cantonal', 'communal', 'church'] as const) {
        const together = both[tax]?.amount ?? 0;
        const apart = (onIncome[tax]?.amount ?? 0) + (onWealth[tax]?.amount ?? 0);
        expect(Math.abs(together - apart), `${tax}, ${at}`).toBeLessThanOrEqual(1);
      }
      // Bern has no personal tax: nothing the engine leaves out.
      expect(e.PersonalTax, at).toBe(0);
    }
    expect(differences).toEqual([]);
  });

  // The calculator takes no income from wealth, so it cannot apply the maximum burden
  // (Höchstbelastung, be-<year>-stg-de Art. 66, p. 42): the wealth tax of the canton, the commune
  // and the church is cut to 25 % of the income from wealth, but not below 2.4 per mille of the
  // taxable wealth. The engine follows the law: told of no income from wealth, it cuts the wealth
  // tax to the 2.4 per mille wherever the calculator's uncut tax is above them.
  it('cuts the wealth tax to the maximum burden, which the calculator leaves out', () => {
    const floorBp = maxBurden(taxYear).value.floorBp;
    expect(floorBp).toBe(24);
    const cut: string[] = [];
    for (const c of golden.cases) {
      if (!c.wealth) continue;
      const h = HOUSEHOLDS[c.household]!;
      const x = assess({
        taxYear,
        commune: golden.capital.bfs,
        tariff: h.tariff,
        church: { confession: h.church },
        incomeItems: [],
        wealthItems: [{ code: '3.0-vermoegen', person: 'p1', amount: c.wealth * 100 }],
      }).taxes;
      const theirs = c.estv.FortuneTaxCanton + c.estv.FortuneTaxCity + c.estv.FortuneTaxChurch;
      const floor = (c.wealth * 100 * floorBp) / 10_000;
      const ours = x.total.amount;
      const at = `${c.household}, wealth ${c.wealth}`;
      if (theirs * 100 > floor) {
        cut.push(`${c.household} ${c.wealth}`);
        // The three taxes less the cut: the 2.4 per mille, to the centime of each rounding.
        expect(x.wealthCap, at).not.toBeNull();
        expect(Math.abs(ours - floor), at).toBeLessThanOrEqual(2);
      } else {
        expect(x.wealthCap, at).toBeNull();
        expect(Math.abs(ours - theirs * 100), at).toBeLessThanOrEqual(150);
      }
    }
    // By hand for the first: wealth 300,000, einfache Steuer 180.90 (the calculator's 181), times
    // 2.975 + 1.54 is 816.76; 2.4 per mille of 300,000 is 720. At 200,000: 103.00 x 4.515 =
    // 465.05, under 480.
    const from300k = [300, 500, 800, 1_000, 1_500, 2_000, 3_000, 5_000, 10_000].map(
      (k) => k * 1_000,
    );
    expect(cut).toEqual([
      ...from300k.map((w) => `single ${w}`),
      ...from300k.map((w) => `married ${w}`),
      'singleReformed 500000',
      'singleCatholic 500000',
      'singleChristCatholic 500000',
      'marriedReformed 500000',
    ]);
  });
});
