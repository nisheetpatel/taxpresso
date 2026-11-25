// Vaud against the Federal Tax Administration's own calculator (SPEC.md section 13, item 2):
// test/golden/estv/vd-<year>.json holds what swisstaxcalculator.estv.admin.ch holds and computes,
// recorded by scripts/estv-cantons-golden.mjs, a dev tool. Nothing here uses the network.
//
// - `rates`: the multipliers of every commune (the cantonal coefficient and the communal rate, in
//   percent of the cantonal base tax; Vaud has no church tax), compared with the engine's tables.
//   The canton's tables carry no federal commune number, so the communes are matched by name.
// - `cases`: the taxes of made-up cases in Lausanne from a taxable income and wealth given as they
//   are: the scales (LI art. 47 and 59), the quotient familial (art. 43), the reduction of the
//   cantonal income tax (LRIPP art. 4), the coefficient and the communal rate. Nothing about the
//   deductions.
//
// The calculator is evidence, not the authority: where it and the canton's documents differ, the
// documents decide, and the difference is pinned below (docs/sources/vd/NOTES.md, "Against the
// federal calculator").
//
// The calculator answers in whole francs: the exact amount rounded. The engine takes the rate to
// six decimals and rounds each step to 5 centimes, as the guide's examples do (vd-2025-guide
// p. 61), which moves a figure by 15 centimes at most: the two are at most 65 centimes apart.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assess,
  communeByName,
  NOTE,
  VdUnsupported,
  vdParamsFor,
  type VdFamily,
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
}
interface Case {
  household: string;
  income: number;
  wealth: number;
  estv: Estv;
}
interface Golden {
  capital: { name: string };
  rates: { bfs: number; name: string; income: Rates; wealth: Rates }[];
  cases: Case[];
}
type TaxYear = 2025 | 2026;

const load = (taxYear: TaxYear) =>
  JSON.parse(
    readFileSync(new URL(`../../../test/golden/estv/vd-${taxYear}.json`, import.meta.url), 'utf8'),
  ) as Golden;

/**
 * The communes the calculator names otherwise than the canton's tables of the arrêtés
 * d'imposition (vd-<year>-communal-arretes-imposition): the federal list adds the canton or the
 * district to names that exist elsewhere in Switzerland.
 */
const NAMES: Record<string, string> = {
  'Roche (VD)': 'Roche',
  'Villeneuve (VD)': 'Villeneuve',
  'Mollens (VD)': 'Mollens',
  'Mex (VD)': 'Mex',
  'Cugy (VD)': 'Cugy',
  'Morrens (VD)': 'Morrens',
  'Saint-Barthélemy (VD)': 'Saint-Barthélemy',
  'Onnens (VD)': 'Onnens',
  'Renens (VD)': 'Renens',
  'Saint-Saphorin (Lavaux)': 'St-Saphorin (Lavaux)',
  'Ecublens (VD)': 'Ecublens',
  'Lully (VD)': 'Lully',
  'Saint-Sulpice (VD)': 'Saint-Sulpice',
  'Dompierre (VD)': 'Dompierre',
  'Crans (VD)': 'Crans',
  'Treytorrens (Payerne)': 'Treytorrens',
  'Ependes (VD)': 'Ependes',
};

const family = (base: VdFamily['base'], children = 0): VdFamily => ({
  base,
  fullChildren: children,
  sharedChildren: 0,
});
/**
 * The household as the engine takes it (LI art. 43 al. 2): 1 part, 1.8 for spouses, 1.3 for a
 * parent alone with their child, 0.5 for each child. Vaud has no church tax.
 */
const HOUSEHOLDS: Record<string, VdFamily> = {
  single: family('single'),
  married: family('married'),
  married2: family('married', 2),
  single1: family('singleParent', 1),
  singleReformed: family('single'),
  singleCatholic: family('single'),
  singleChristCatholic: family('single'),
  marriedReformed: family('married'),
};

const key = (c: { household: string; income: number; wealth: number }) =>
  `${c.household} ${c.income}/${c.wealth}`;
const incomes = (household: string, ...thousands: number[]) =>
  thousands.map((k) => `${household} ${k * 1_000}/0`);

/**
 * The cap of the quotient familial, 2025 (LI art. 43 al. 3): the engine follows the guide, the
 * calculator differs. Above CHF 212,900 of taxable income with one child and 236,500 with two,
 * the rate-determining income is the taxable income divided by the parts without the children,
 * less at most 45,491 (a parent alone with one child) or 46,925 (spouses with two children)
 * (vd-2025-guide p. 52 and 53, code 820, the two tables "Montant maximum déductible"). The
 * calculator's figures are those of a lower cap: its base tax is the scale's rate at 94,600,
 * 122,300, 177,900, 233,400 and 372,300 for the couple and 149,300, 187,800, 264,700 and 341,600
 * for the parent, which is a deduction of some 44,280 and 42,940, so thresholds near 223,200 and
 * 201,000. No Vaud document of 2025 prints those.
 *
 * By hand, with the 2025 scale (vd-2025-deductions p. 2): [household, taxable income, the
 * engine's rate-determining income, its base tax in centimes, the calculator's base tax].
 * - Spouses, two children, 250,000: 250,000 / 1.8 = 138,888 less 46,925 = 91,963, taken as
 *   91,900; the scale there, 7,611.00 + 8 x 12.00 = 7,707.00, a rate of 8.386289 %; 250,000 at
 *   that rate, 20,965.72, to 5 centimes 20,965.70.
 * - 300,000: 119,700; 9,639.00 + 117 x 12.50 = 11,101.50; 9.274436 %; 27,823.30.
 * - 400,000: 175,200; 16,511.50 + 133 x 13.50 = 18,307.00; 10.449201 %; 41,796.80.
 * - 500,000: 230,800; 24,885.50 + 80 x 14.50 = 26,045.50; 11.284879 %; 56,424.40.
 * - 750,000: 369,700; 35,010.50 + 783 x 15.50 = 47,147.00; 12.752773 %; 95,645.80.
 * - A parent alone, one child, 250,000: 250,000 / 1.3 = 192,307 less 45,491 = 146,816, taken as
 *   146,800; 13,001.50 + 119 x 13.00 = 14,548.50; 9.910422 %; 24,776.05.
 * - 300,000: 185,200; 16,511.50 + 233 x 13.50 = 19,657.00; 10.613931 %; 31,841.80.
 * - 400,000: 262,200; 29,670.50 + 64 x 15.00 = 30,630.50; 11.682113 %; 46,728.45.
 * - 500,000: 339,100; 35,010.50 + 477 x 15.50 = 42,404.00; 12.504866 %; 62,524.35.
 */
const QUOTIENT_CAP_2025: [string, number, number, number, number][] = [
  ['married2', 250_000, 91_900, 2_096_570, 21_224],
  ['married2', 300_000, 119_700, 2_782_330, 28_029],
  ['married2', 400_000, 175_200, 4_179_680, 41_982],
  ['married2', 500_000, 230_800, 5_642_440, 56_603],
  ['married2', 750_000, 369_700, 9_564_580, 95_790],
  ['single1', 250_000, 146_800, 2_477_605, 24_905],
  ['single1', 300_000, 185_200, 3_184_180, 31_962],
  ['single1', 400_000, 262_200, 4_672_845, 46_854],
  ['single1', 500_000, 339_100, 6_252_435, 62_634],
];

/**
 * OPEN, the maxima of LICom art. 8 (vd-na-law-licom p. 5): the cantonal and communal income tax
 * together may not exceed 30 % (al. 1). The documents don't say of which amount exactly nor how
 * the cut is rounded and shared, so the engine computes no tax when the tax before the LRIPP
 * reduction, the higher one, is above 30 % of the taxable income (docs/sources/vd/NOTES.md, "Open
 * points for the rules"). The calculator cuts the two taxes to 30 % of the taxable income it was
 * given, in proportion, and measures after the reduction: `cut` are the cases it cuts, `whole`
 * those it leaves whole, just under 30 %, where the engine's bound is reached all the same. The
 * same cases in both years.
 */
const MAXIMA = {
  cut: [
    ...incomes('single', 500, 750, 1_000, 2_000, 5_000),
    ...incomes('married', 1_000, 2_000, 5_000),
    ...incomes('married2', 1_000, 2_000, 5_000),
    ...incomes('single1', 750, 1_000, 2_000, 5_000),
  ],
  whole: ['single 400000/0', 'married 750000/0'],
};

/**
 * OPEN, the cap of the quotient familial for 2026: the 2026 guide is not published, and the
 * thresholds are adjusted each year, never down (LI art. 60 al. 2), so above the 2025 threshold
 * the engine computes no tax for a household with children (docs/sources/vd/NOTES.md, "Open
 * points for the rules"). The calculator computes these with the same lower cap as for 2025.
 */
const NO_CAP_TABLE_2026 = [
  ...incomes('married2', 250, 300, 400, 500, 750, 1_000, 2_000, 5_000),
  ...incomes('single1', 250, 300, 400, 500, 750, 1_000, 2_000, 5_000),
];

describe.each([2025, 2026] as const)('the federal calculator, Vaud %i', (taxYear) => {
  const golden = load(taxYear);
  const P = vdParamsFor(taxYear);
  /** Percent there, hundredths of a percent here: 78.5 -> 7850. */
  const hundredths = (percent: number) => Math.round(percent * 100);
  const run = (c: Case) =>
    assess({
      taxYear,
      commune: golden.capital.name,
      family: HOUSEHOLDS[c.household]!,
      incomeItems: [{ code: '100', person: 'p1', amount: c.income * 100 }],
      wealthItems: [{ code: '410', person: 'p1', amount: c.wealth * 100 }],
    });

  it('has the coefficient and the communal rate of every commune', () => {
    const differences: string[] = [];
    const seen = new Set<string>();
    expect(golden.rates.length).toBe(300);
    expect(P.communes.value.length).toBe(300);
    for (const r of golden.rates) {
      // The same rates on income and on wealth (LI art. 2, LICom art. 6), and no church tax.
      expect(r.wealth, r.name).toEqual(r.income);
      expect([r.income.reformed, r.income.catholic, r.income.christCatholic], r.name).toEqual([
        0, 0, 0,
      ]);
      const c = communeByName(taxYear, NAMES[r.name] ?? r.name);
      if (!c) {
        differences.push(`${r.name} (BFS ${r.bfs}): not in the engine's table`);
        continue;
      }
      seen.add(c.name);
      const at = `${r.name} (BFS ${r.bfs})`;
      if (P.cantonalCoefficient.value !== hundredths(r.income.canton))
        differences.push(
          `${at}, canton: ${P.cantonalCoefficient.value} here, ${r.income.canton} there`,
        );
      // The commune's rate with its special earmarked tax (LICom art. 6 al. 3), and without the
      // rate of a fraction of the commune (L'Abbaye, Le Chenit), which the calculator leaves out.
      if (c.rate !== hundredths(r.income.commune))
        differences.push(`${at}, commune: ${c.rate} here, ${r.income.commune} there`);
    }
    expect(differences).toEqual([]);
    // Every commune of the canton's table, once.
    expect(seen.size).toBe(300);
  });

  const capped = taxYear === 2025 ? QUOTIENT_CAP_2025 : [];
  const cappedKeys = capped.map(([household, income]) => `${household} ${income}/0`);
  // For 2026 the missing cap table stops a household with children before the maxima do.
  const noCapTable = taxYear === 2026 ? NO_CAP_TABLE_2026 : [];
  const maxima = [...MAXIMA.cut, ...MAXIMA.whole].filter((k) => !noCapTable.includes(k));
  const notComputed = [...maxima, ...noCapTable];

  it('gives the calculator’s taxes in Lausanne, figure by figure', () => {
    expect(golden.cases.length).toBe(174);
    const differences: string[] = [];
    let compared = 0;
    for (const c of golden.cases) {
      const e = c.estv;
      // One base tax for the canton and the commune, no church tax, no personal tax in Lausanne.
      expect(e.IncomeSimpleTaxCity, key(c)).toBe(e.IncomeSimpleTaxCanton);
      expect(e.FortuneSimpleTaxCity, key(c)).toBe(e.FortuneSimpleTaxCanton);
      expect([e.IncomeTaxChurch, e.FortuneTaxChurch, e.PersonalTax], key(c)).toEqual([0, 0, 0]);
      if (notComputed.includes(key(c)) || cappedKeys.includes(key(c))) continue;
      compared++;
      const x = run(c).taxes;
      const near = (what: string, ours: number, theirs: number) => {
        if (Math.abs(ours - theirs * 100) > 65)
          differences.push(
            `${what}, ${key(c)}: engine ${(ours / 100).toFixed(2)}, calculator ${theirs}`,
          );
      };
      near('base tax on income', x.incomeBase.amount, e.IncomeSimpleTaxCanton);
      near('cantonal tax on income', x.cantonalIncome.amount, e.IncomeTaxCanton);
      near('communal tax on income', x.communalIncome.amount, e.IncomeTaxCity);
      near('base tax on wealth', x.wealthBase.amount, e.FortuneSimpleTaxCanton);
      near('cantonal tax on wealth', x.cantonalWealth.amount, e.FortuneTaxCanton);
      near('communal tax on wealth', x.communalWealth.amount, e.FortuneTaxCity);
    }
    expect(differences).toEqual([]);
    expect(compared).toBe(174 - notComputed.length - capped.length);
  });

  it('caps the quotient familial as the 2025 guide does, where the calculator’s cap is lower', () => {
    for (const [household, income, rateIncome, base, theirs] of capped) {
      const c = golden.cases.find((x) => key(x) === `${household} ${income}/0`)!;
      const r = run(c);
      expect(r.rateIncome.amount, key(c)).toBe(rateIncome * 100);
      expect(r.taxes.incomeBase.amount, key(c)).toBe(base);
      expect(c.estv.IncomeSimpleTaxCanton, key(c)).toBe(theirs);
      // The calculator's is higher: between CHF 109 and 259 of base tax.
      expect(theirs * 100 - base, key(c)).toBeGreaterThan(10_900);
      expect(theirs * 100 - base, key(c)).toBeLessThan(25_900);
    }
    // At and under the threshold the two agree (compared above): the couple at 200,000, under
    // 236,500, and the parent at 200,000, under 212,900.
    expect(cappedKeys).not.toContain('married2 200000/0');
    expect(cappedKeys).not.toContain('single1 200000/0');
  });

  it('computes no tax where a maximum of LICom art. 8 may apply or the 2026 cap is not published', () => {
    const refused: Record<string, string[]> = { maxima: [], quotientCap: [] };
    for (const c of golden.cases) {
      try {
        run(c);
      } catch (err) {
        if (!(err instanceof VdUnsupported)) throw err;
        const why =
          err.note === NOTE.maxima ? 'maxima' : err.note === NOTE.quotientCap ? 'quotientCap' : '?';
        (refused[why] ??= []).push(key(c));
      }
    }
    expect(refused).toEqual({
      maxima: golden.cases.map(key).filter((k) => maxima.includes(k)),
      quotientCap: noCapTable,
    });
    // What the calculator does: 30 % of the taxable income in the cases it cuts, to the franc of
    // its two rounded figures; everywhere else the whole tax, under 30 %.
    for (const c of golden.cases) {
      const tax = c.estv.IncomeTaxCanton + c.estv.IncomeTaxCity;
      const limit = c.income * 0.3;
      if (MAXIMA.cut.includes(key(c))) expect(Math.abs(tax - limit), key(c)).toBeLessThanOrEqual(1);
      else if (c.income > 0) expect(tax, key(c)).toBeLessThan(limit - 1);
    }
  });
});
