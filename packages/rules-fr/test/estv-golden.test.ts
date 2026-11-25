// Fribourg against the Federal Tax Administration's own calculator (SPEC.md section 13, item 2):
// test/golden/estv/fr-<year>.json holds what swisstaxcalculator.estv.admin.ch holds and computes,
// recorded by scripts/estv-cantons-golden.mjs, a dev tool. Nothing here uses the network.
//
// - `rates`: the cantonal coefficients, each commune's coefficient and the coefficients of a Roman
//   Catholic and of an Evangelical Reformed parish, compared with the engine's tables by BFS
//   number (121 communes in 2025, 119 in 2026).
// - `cases`: the taxes of made-up cases in the City of Fribourg from a taxable income and wealth
//   given as they are: the income scale with the rate of half the income for families, the wealth
//   scale, the coefficients and the church tax. Nothing about the deductions.
//
// The calculator answers in whole francs; the engine works to 5 centimes. A figure matches when it
// is within a franc. What differs is pinned below and explained in docs/sources/fr/NOTES.md,
// "Checked against the federal calculator":
// 1. The income scale. The law sets the tax "selon un barème détaillé établi par le Service
//    cantonal des contributions" (fr-2025-law-licd-consolidee art. 37 al. 1, p. 27), which raises
//    the rate by a fixed step per CHF 100 inside each class and reads a family's rate at half the
//    income in whole CHF 100. The calculator draws a straight line from the first rate of a class
//    to the first rate of the next, reads a family's rate at exactly half the income and starts
//    its line for families at half an income of CHF 5,250. The engine follows the detailed tariff,
//    row for row; the calculator is up to CHF 3.80 away from it on these cases.
// 2. The communal coefficients of 2026: the calculator holds them; the canton's open data table
//    still stops at 2025, so the engine has none and computes no tax for 2026 (open point).
import { readFileSync } from 'node:fs';
import { ifdParamsFor, ifdTax, Trace, type IfdScale } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  assess,
  frParamsFor,
  FrUnsupported,
  incomeBaseTax,
  NOTE,
  parishOf,
  wealthBaseTax,
} from '../src/index.js';

interface Rates {
  canton: number;
  commune: number;
  reformed: number;
  catholic: number;
  christCatholic: number;
}
interface Estv {
  IncomeSimpleTaxCanton: number;
  IncomeSimpleTaxCity: number;
  IncomeTaxCanton: number;
  IncomeTaxCity: number;
  IncomeTaxChurch: number;
  FortuneSimpleTaxCanton: number;
  FortuneSimpleTaxCity: number;
  FortuneTaxCanton: number;
  FortuneTaxCity: number;
  FortuneTaxChurch: number;
  PersonalTax: number;
  IncomeTaxFed: number;
}
interface Case {
  household: string;
  income: number;
  wealth: number;
  estv: Estv;
}
interface Golden {
  capital: { bfs: number; name: string };
  rates: { bfs: number; name: string; income: Rates; wealth: Rates }[];
  cases: Case[];
}

const load = (taxYear: number) =>
  JSON.parse(
    readFileSync(new URL(`../../../test/golden/estv/fr-${taxYear}.json`, import.meta.url), 'utf8'),
  ) as Golden;

/**
 * The household as the engine takes it: the rate of half the income for a married couple and for
 * a parent living with their child (LICD art. 37 al. 3); the children change nothing else in the
 * scale. The federal scale and its reductions per child: LIFD art. 36.
 */
const HOUSEHOLDS: Record<
  string,
  { family: boolean; church?: 'reformed' | 'catholic'; ifd: IfdScale; children: number }
> = {
  single: { family: false, ifd: 'single', children: 0 },
  married: { family: true, ifd: 'married', children: 0 },
  married2: { family: true, ifd: 'married', children: 2 },
  single1: { family: true, ifd: 'parental', children: 1 },
  singleReformed: { family: false, church: 'reformed', ifd: 'single', children: 0 },
  singleCatholic: { family: false, church: 'catholic', ifd: 'single', children: 0 },
  // No Christian Catholic parish levies a tax in Fribourg: the calculator holds a rate of 0.
  singleChristCatholic: { family: false, ifd: 'single', children: 0 },
  marriedReformed: { family: true, church: 'reformed', ifd: 'married', children: 0 },
};

/**
 * Difference 1, the calculator's income scale, found from its figures: the first rate of each
 * class of LICD art. 37 al. 1 (percent) at the class's first franc, a straight line between two
 * of them, 13.5 % from CHF 207,100. Returns the base tax in centimes, unrounded.
 */
const CLASS_STARTS: readonly (readonly [number, number])[] = [
  [5_200, 1.0],
  [17_500, 4.1745],
  [31_400, 6.2139],
  [48_300, 8.0352],
  [63_800, 9.1042],
  [77_600, 9.9846],
  [102_100, 10.8662],
  [128_700, 11.7172],
  [156_000, 12.5355],
  [181_000, 13.1097],
  [207_100, 13.5],
];
function calculatorBaseTax(income: number, family: boolean): number {
  const chf = Math.floor(income / 100) * 100;
  if (chf < 5_200) return 0;
  // A family: the rate at exactly half the income, the line starting at 5,250, at least 1 %.
  const at = family ? chf / 2 : chf;
  const starts = family
    ? CLASS_STARTS.map(([c, r], i) => [i ? c : 5_250, r] as const)
    : CLASS_STARTS;
  let rate = 1;
  for (let i = 0; i < starts.length; i++) {
    const [from, first] = starts[i]!;
    const next = starts[i + 1];
    if (at < from) break;
    rate =
      next && at < next[0] ? first + ((at - from) / (next[0] - from)) * (next[1] - first) : first;
  }
  return chf * rate;
}

/**
 * Rows of the SCC's detailed tariff, read by hand in fr-2025-bareme-revenu and fr-2026-bareme-revenu
 * (the same table, "valable dès l'année 2023"): [taxable income, tax of a single person, tax of a
 * family (the rate of half the income), page], and what the calculator answers for a single
 * person and a married couple at that income (13,300 and 99,900: its cases 13,333 and 99,999).
 */
const DETAILED_TARIFF: readonly (readonly [number, number, number, number, number, number])[] = [
  [13_300, 412.0, 181.25, 3, 411, 181],
  [15_000, 530.75, 239.35, 4, 529, 237],
  [30_000, 1_803.6, 1_061.45, 7, 1_803, 1_058],
  [40_000, 2_857.1, 1_816.8, 10, 2_856, 1_817],
  [61_700, 5_528.2, 3_781.95, 15, 5_528, 3_784],
  [99_900, 10_776.6, 8_137.45, 25, 10_776, 8_141],
  [150_000, 18_534.3, 14_731.5, 38, 18_533, 14_728],
  [200_000, 26_789.4, 21_582.0, 51, 26_788, 21_581],
  [400_000, 54_000.0, 53_578.8, 102, 54_000, 53_575],
];

describe.each([2025, 2026] as const)('the federal calculator, Fribourg %i', (taxYear) => {
  const golden = load(taxYear);
  const P = frParamsFor(taxYear);
  const byBfs = new Map(P.communes.value.map((c) => [c.bfs, c]));

  it('has every commune by its BFS number, the cantonal coefficients and the parishes', () => {
    const differences: string[] = [];
    expect(golden.rates.length).toBe(taxYear === 2025 ? 121 : 119);
    expect(P.communes.value.length).toBe(golden.rates.length);
    let choice = 0;
    for (const r of golden.rates) {
      const c = byBfs.get(r.bfs);
      if (!c) {
        differences.push(`${r.name} (BFS ${r.bfs}): not in the engine's table`);
        continue;
      }
      const at = `${r.name} (BFS ${r.bfs})`;
      if (c.name !== r.name) differences.push(`${at}: named ${c.name} here`);
      // The cantonal coefficients: 96 % on income, 100 % on wealth (fr-<year>-law-coefficient-annuel
      // art. 1).
      if (P.coefficients.value.income !== r.income.canton * 100)
        differences.push(`${at}, canton, income: ${r.income.canton} there`);
      if (P.coefficients.value.wealth !== r.wealth.canton * 100)
        differences.push(`${at}, canton, wealth: ${r.wealth.canton} there`);
      // The calculator holds one parish of each church per commune; the canton's tables give
      // every parish of the commune. Its coefficients must be those of one of them.
      for (const church of ['catholic', 'reformed'] as const) {
        const theirs = [Math.round(r.income[church] * 100), Math.round(r.wealth[church] * 100)];
        const parishes = c[church];
        if (!parishes.some((p) => p.income === theirs[0] && p.wealth === theirs[1]))
          differences.push(
            `${at}, ${church}: ${parishes.map((p) => `${p.name} ${p.income}/${p.wealth}`).join(', ')} here, ${theirs.join('/')} there`,
          );
        else if (parishOf(c, church) === 'parish') choice++;
      }
      if (r.income.christCatholic !== 0 || r.wealth.christCatholic !== 0)
        differences.push(`${at}: a Christian Catholic rate there`);
    }
    expect(differences).toEqual([]);
    // Communes whose parishes of a church have different coefficients: the calculator took one.
    expect(choice).toBe(15);
  });

  it(
    taxYear === 2025
      ? 'has the coefficient of every commune'
      : 'has no communal coefficient for 2026, where the calculator holds one (open point)',
    () => {
      const differences: string[] = [];
      for (const r of golden.rates) {
        const c = byBfs.get(r.bfs)!;
        // One coefficient for income and wealth (LICo art. 3 al. 3, art. 4 al. 3).
        expect(r.wealth.commune, r.name).toBe(r.income.commune);
        if (taxYear === 2026) {
          // Difference 2: nothing here, a coefficient there.
          if (c.rate !== null) differences.push(`${r.name} (BFS ${r.bfs}): ${c.rate} here`);
          expect(r.income.commune, r.name).toBeGreaterThan(0);
        } else if (c.rate !== Math.round(r.income.commune * 100)) {
          differences.push(
            `${r.name} (BFS ${r.bfs}): ${(c.rate ?? 0) / 100} here, ${r.income.commune} there`,
          );
        }
      }
      expect(differences).toEqual([]);
    },
  );

  it('gives the calculator’s taxes in the City of Fribourg, to the franc, but for its income scale', () => {
    expect(golden.capital).toEqual({ bfs: 2196, name: 'Fribourg' });
    expect(golden.cases.length).toBe(174);
    const commune = byBfs.get(golden.capital.bfs)!;
    const theirs = golden.rates.find((r) => r.bfs === golden.capital.bfs)!;
    const differences: string[] = [];
    let largest = { centimes: 0, at: '' };
    let declined = 0;
    for (const c of golden.cases) {
      const h = HOUSEHOLDS[c.household]!;
      const e = c.estv;
      const at = `${c.household}, income ${c.income}, wealth ${c.wealth}`;
      const near = (what: string, ours: number, figure: number) => {
        if (Math.abs(ours - figure * 100) >= 100)
          differences.push(
            `${what}, ${at}: engine ${(ours / 100).toFixed(2)}, calculator ${figure}`,
          );
      };

      // Difference 1: the calculator's figure is its own line, to the franc; the engine's is the
      // detailed tariff's (below, and test/tariffs.test.ts). `gap` is what the engine has more.
      const line = calculatorBaseTax(c.income, h.family);
      near('the calculator’s line', line, e.IncomeSimpleTaxCanton);
      near('the calculator’s line (commune)', line, e.IncomeSimpleTaxCity);
      const base = incomeBaseTax(P.incomeScale.value, c.income * 100, h.family);
      const gap = base - line;
      const apart = Math.abs(base - e.IncomeSimpleTaxCanton * 100);
      if (apart > largest.centimes) largest = { centimes: apart, at };
      const wealthBase = wealthBaseTax(P.wealthScale.value, c.wealth * 100);
      near('base tax on wealth', wealthBase, e.FortuneSimpleTaxCanton);
      near('base tax on wealth (commune)', wealthBase, e.FortuneSimpleTaxCity);

      const parish = h.church ? parishOf(commune, h.church) : null;
      if (parish === 'parish') throw new Error(`Fribourg has several ${h.church} coefficients.`);
      const input = {
        taxYear,
        commune: golden.capital.bfs,
        family: h.family,
        parish,
        incomeItems: [{ code: '1.110', person: 'p1', amount: c.income * 100 }],
        wealthItems: [{ code: '3.210', person: 'p1', amount: c.wealth * 100 }],
      } as const;
      if (taxYear === 2026) {
        // Difference 2: no communal coefficient, no tax (the scales above are compared all the
        // same; the calculator's cantonal tax is its line at 96 %, its wealth tax at 100 %).
        try {
          assess(input);
        } catch (err) {
          if (!(err instanceof FrUnsupported)) throw err;
          expect(err.note).toEqual(NOTE.communes2026);
          declined++;
        }
        near(
          'the calculator’s cantonal tax',
          (line * theirs.income.canton) / 100,
          e.IncomeTaxCanton,
        );
        near('the calculator’s cantonal tax on wealth', wealthBase, e.FortuneTaxCanton);
        continue;
      }
      const x = assess(input).taxes;
      expect(x.incomeBase.amount, at).toBe(base);
      expect(x.wealthBase.amount, at).toBe(wealthBase);
      // Each tax on income, less its coefficient of the gap of the scales.
      const less = (tax: number, coefficient: number) => tax - (gap * coefficient) / 10_000;
      near(
        'cantonal tax on income',
        less(x.cantonalIncome.amount, P.coefficients.value.income),
        e.IncomeTaxCanton,
      );
      near('communal tax on income', less(x.communalIncome.amount, commune.rate!), e.IncomeTaxCity);
      near('cantonal tax on wealth', x.cantonalWealth.amount, e.FortuneTaxCanton);
      near('communal tax on wealth', x.communalWealth.amount, e.FortuneTaxCity);
      near(
        'church tax on income',
        parish ? less(x.churchIncome!.amount, parish.income) : 0,
        e.IncomeTaxChurch,
      );
      near('church tax on wealth', x.churchWealth?.amount ?? 0, e.FortuneTaxChurch);
      // Fribourg has no personal tax.
      if (e.PersonalTax !== 0) differences.push(`personal tax, ${at}: ${e.PersonalTax} there`);
    }
    expect(differences).toEqual([]);
    expect(declined).toBe(taxYear === 2026 ? 174 : 0);
    // The furthest the engine is from the calculator's figure on these cases: a married couple
    // with 400,000, 53,578.80 in the detailed tariff (p. 102), 53,575 there.
    expect(largest).toEqual({ centimes: 380, at: 'married, income 400000, wealth 0' });
  });

  it('follows the SCC’s detailed tariff where the calculator leaves it', () => {
    const scale = P.incomeScale.value;
    const their = (household: string, income: number) =>
      golden.cases.find((c) => c.household === household && c.wealth === 0 && c.income === income)!
        .estv.IncomeSimpleTaxCanton;
    for (const [income, single, family, , calcSingle, calcMarried] of DETAILED_TARIFF) {
      expect(incomeBaseTax(scale, income * 100, false), `single ${income}`).toBe(
        Math.round(single * 100),
      );
      expect(incomeBaseTax(scale, income * 100, true), `family ${income}`).toBe(
        Math.round(family * 100),
      );
      // The calculator's case at that income: 13,333 for 13,300 and 99,999 for 99,900 (LICD
      // art. 37 al. 4: fractions under CHF 100 dropped).
      const asked = income === 13_300 ? 13_333 : income === 99_900 ? 99_999 : income;
      expect(their('single', asked), `calculator, single ${asked}`).toBe(calcSingle);
      expect(their('married', asked), `calculator, married ${asked}`).toBe(calcMarried);
    }
  });

  it('ends with the calculator’s federal tax (packages/rules-ch), to the franc', () => {
    const differences: string[] = [];
    for (const c of golden.cases) {
      const h = HOUSEHOLDS[c.household]!;
      const taxable = new Trace().line(
        c.income * 100,
        { en: 'Taxable income', fr: 'Revenu imposable' },
        { en: 'As given.', fr: 'Tel que donné.' },
      );
      const tax = ifdTax(ifdParamsFor(taxYear), taxable, h.ifd, h.children).tax.amount;
      if (Math.abs(tax - c.estv.IncomeTaxFed * 100) >= 100)
        differences.push(
          `${c.household}, income ${c.income}: engine ${(tax / 100).toFixed(2)}, calculator ${c.estv.IncomeTaxFed}`,
        );
    }
    expect(differences).toEqual([]);
  });
});
