// Ticino against the Federal Tax Administration's own calculator (SPEC.md section 13, item 2):
// test/golden/estv/ti-<year>.json holds what swisstaxcalculator.estv.admin.ch holds and computes,
// recorded by scripts/estv-cantons-golden.mjs, a dev tool. Nothing here uses the network.
//
// - `rates`: the cantonal coefficient and the multiplier (moltiplicatore) of every commune, in
//   percent of the cantonal base tax (93 is the engine's 9300), compared with the engine's tables.
//   The canton's table carries no federal commune number, so the communes are matched by name.
// - `cases`: the taxes of made-up cases in Bellinzona from a taxable income and wealth given as
//   they are: the two income tariffs (LT art. 35), the wealth tariff (art. 49), the amounts under
//   CHF 100 and CHF 1,000 dropped, the coefficient, the multiplier and the personal tax. Nothing
//   about the deductions.
//
// The calculator is evidence, not the authority: where it and the canton's documents differ, the
// documents decide, and the difference is pinned below with the document that decides it
// (docs/sources/ti/NOTES.md, "Against the federal calculator"). In Ticino they differ on nearly
// every income: the calculator starts each category of the income tariff CHF 100 late.
//
// The calculator answers in whole francs: the exact amount rounded. The engine rounds the base
// tax and each tax to 5 centimes, so the two are at most 52 centimes apart where they agree.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assess,
  communeByName,
  NOTE,
  tiParamsFor,
  TiUnsupported,
  type CategoryTariff,
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
interface Golden {
  capital: { name: string };
  rates: { bfs: number; name: string; income: Rates; wealth: Rates }[];
  cases: { household: string; income: number; wealth: number; estv: Estv }[];
}
type TaxYear = 2025 | 2026;

const load = (taxYear: TaxYear) =>
  JSON.parse(
    readFileSync(new URL(`../../../test/golden/estv/ti-${taxYear}.json`, import.meta.url), 'utf8'),
  ) as Golden;

/** The one commune the canton's table names otherwise than the calculator (ti-2025-communal-rates). */
const NAMES: Record<string, string> = { 'Brione sopra Minusio': 'BRIONE S/MINUSIO' };

/**
 * The communes of the calculator's 2025 list that ended on 6 April 2025, with the commune they
 * are part of since (ti-2025-communal-numero-comuni, sheet mutazioni, rows LEMA, GIORNICO and
 * QUINTO: entrata in vigore 6 April 2025; 100 communes at the end of 2025). The commune of
 * residence at the end of the tax period levies the tax (ti-na-law-lt-640-100 art. 277 cpv. 1),
 * so a 2025 return names today's commune, as the canton's table of multipliers does.
 */
const ENDED_2025: Record<string, string> = {
  Bodio: 'GIORNICO',
  'Prato (Leventina)': 'QUINTO',
  Astano: 'LEMA',
  Bedigliora: 'LEMA',
  Curio: 'LEMA',
  Miglieglia: 'LEMA',
  Novaggio: 'LEMA',
};

/**
 * OPEN: the 2025 multiplier of Lema. The canton's table gives Lema a multiplier from 2026 only
 * (ti-2025-communal-rates, row LEMA: the cells of 2021 to 2025 are empty, 2026 is 95), so the
 * engine computes no 2025 tax there. The calculator has 95 for each of the five communes Lema
 * was formed of, and the Sezione degli enti locali lists Lema at 95 in its coordinated multipliers
 * of 2025 (ti-2025-communal-moltiplicatore-coordinato p. 3), a figure rounded to the unit that
 * weighs the multipliers of natural and legal persons by their tax yield (p. 2), not the
 * multiplier of natural persons itself. Until the canton's table gives it, the engine stays
 * without.
 */
const LEMA_2025 = [
  'Astano (BFS 5146), now LEMA: no 2025 multiplier here, 95 there',
  'Bedigliora (BFS 5149), now LEMA: no 2025 multiplier here, 95 there',
  'Curio (BFS 5181), now LEMA: no 2025 multiplier here, 95 there',
  'Miglieglia (BFS 5200), now LEMA: no 2025 multiplier here, 95 there',
  'Novaggio (BFS 5207), now LEMA: no 2025 multiplier here, 95 there',
];

/**
 * Multipliers the calculator holds differently from the canton's table (Moltiplicatori d'imposta
 * comunali, natural persons, the page of the Divisione delle contribuzioni; the engine's table is
 * generated from it by scripts/ti-communes.mjs). For 2026 the calculator still has the table's
 * 2025 column for four communes (ti-2026-communal-rates, rows AIROLO: 87 for 2025, 90 for 2026;
 * LUGANO: 77, 80; RIVA SAN VITALE: 80, 83; VACALLO: 84, 79). The engine keeps the canton's.
 */
const OTHER_MULTIPLIERS: Record<TaxYear, string[]> = {
  2025: [],
  2026: [
    'Airolo (BFS 5061), commune: 9000 here, 87 there',
    'Lugano (BFS 5192), commune: 8000 here, 77 there',
    'Riva San Vitale (BFS 5263), commune: 8300 here, 80 there',
    'Vacallo (BFS 5268), commune: 7900 here, 84 there',
  ],
};

/**
 * The household as the engine takes it: the family tariff (art. 35 cpv. 2) for spouses and for a
 * parent living with their child, the tariff for single people (cpv. 1) for everyone else; the
 * personal tax for each adult. The calculator computes no church tax in Ticino.
 */
const HOUSEHOLDS: Record<string, { tariff: 'single' | 'family'; adults: 1 | 2 }> = {
  single: { tariff: 'single', adults: 1 },
  married: { tariff: 'family', adults: 2 },
  married2: { tariff: 'family', adults: 2 },
  single1: { tariff: 'family', adults: 1 },
  singleReformed: { tariff: 'single', adults: 1 },
  singleCatholic: { tariff: 'single', adults: 1 },
  singleChristCatholic: { tariff: 'single', adults: 1 },
  marriedReformed: { tariff: 'family', adults: 2 },
};

/**
 * The calculator's reading of LT art. 35, in centimes: the tax the law prints for the top of the
 * category below, plus the category's rate on the income above that top less CHF 100. The law
 * prints each category as "da fr. 12'600 a fr. 17'400", the first hundred after the top below,
 * incomes counting in whole hundreds (cpv. 3); the calculator starts the rate there, so the first
 * CHF 100 of every category goes untaxed and its tax is lower than the law's by the category's
 * rate on CHF 100: CHF 2.60 to 14.65.
 *
 * The law's own amounts show the rate runs from the top below: 20.00 at 12,500 and 5.232 % of the
 * 4,900 up to 17,400 make 276.37, and the law prints 276.40 at 17,400
 * (ti-2025-tariff-decreto-esecutivo-pf p. 7, art. 35 cpv. 1; ti-2026-tariff-decreto-esecutivo-pf
 * p. 5); the calculator's reading gives 271.14 there, and 276.40 at 17,500. The canton's own
 * table of 2025 follows the law (TABLE_2025 below). The engine keeps the law's amounts.
 */
function calculatorReading(t: CategoryTariff, income: number): number {
  const x = Math.floor(income / 100) * 100;
  if (x * 100 < t.exemptBelow) return 0;
  let below: { top: number; tax: number } | null = null;
  for (const [top, rate, taxAtTop] of t.categories) {
    if (x <= top) {
      const from = below ? below.top + 100 : 0;
      return (below?.tax ?? 0) + ((x - from) * 100 * rate) / t.denominator;
    }
    below = { top, tax: taxAtTop! };
  }
  throw new RangeError('The last category has no top.');
}

/**
 * The canton's table of the cantonal base tax on income, 2025, at the incomes of the grid it
 * prints (ti-2025-guide-istruzioni-pf-pdf p. 51, Tabella per il calcolo dell'imposta cantonale
 * base sul reddito 2025): [taxable income, Persone sole, Coniugati], in centimes as printed.
 * test/tariffs.test.ts has every row of the table.
 */
const TABLE_2025: readonly (readonly [number, number, number | null])[] = [
  [15_000, 15_080, null],
  [20_000, 43_110, null],
  [25_000, 64_345, 21_100],
  [30_000, 98_260, 39_760],
  [35_000, 145_365, 55_320],
  [40_000, 192_765, 74_935],
  [45_000, 244_645, 101_620],
  [50_000, 296_535, 137_195],
  [55_000, 349_820, 176_435],
  [60_000, 406_300, 215_675],
  [70_000, 524_305, 315_470],
  [80_000, 640_890, 416_815],
  [100_000, 880_330, 653_380],
  [110_000, 1_005_025, 779_825],
  [150_000, 1_525_860, 1_276_725],
  [200_000, 2_179_880, 1_936_680],
  [400_000, 4_970_120, 4_815_880],
  [500_000, 6_420_100, 6_280_850],
  [1_000_000, 13_670_100, 13_570_000],
];

/**
 * Where the calculator is lower still: the tariff for single people between 58,200 and 73,000.
 * There its figures are some CHF 71 under its own reading, as if the tax at the top below
 * (58,100) were about 3,767.80 instead of the 3,838.85 the law prints
 * (ti-2025-tariff-decreto-esecutivo-pf p. 7; the canton's table prints 3,838.85 at 58,100 and
 * 4,063.00 at 60,000, ti-2025-guide-istruzioni-pf-pdf p. 51). The same three incomes in both
 * years; the engine gives 4,063.05, 4,263.65 and 5,243.05.
 */
const LOWER_STILL = [
  'single, income 60000: its reading 4051.25, calculator 3980',
  'single, income 61700: its reading 4251.85, calculator 4181',
  'single, income 70000: its reading 5231.25, calculator 5160',
];

describe.each([2025, 2026] as const)('the federal calculator, Ticino %i', (taxYear) => {
  const golden = load(taxYear);
  const P = tiParamsFor(taxYear);

  it('has the multiplier of every commune, but for those the canton’s table gives otherwise', () => {
    const differences: string[] = [];
    const lema: string[] = [];
    const seen = new Set<string>();
    expect(golden.rates.length).toBe(taxYear === 2025 ? 106 : 100);
    expect(P.communes.value.length).toBe(taxYear === 2025 ? 99 : 100);
    for (const r of golden.rates) {
      // The same on income and on wealth (LT art. 276 cpv. 2), and no church tax there.
      expect(r.wealth, r.name).toEqual(r.income);
      expect([r.income.reformed, r.income.catholic, r.income.christCatholic], r.name).toEqual([
        0, 0, 0,
      ]);
      const at = `${r.name} (BFS ${r.bfs})`;
      // The cantonal coefficient: 100 % (art. 1a cpv. 2).
      if (P.amounts.coefficient.value !== Math.round(r.income.canton * 100))
        differences.push(
          `${at}, canton: ${P.amounts.coefficient.value} here, ${r.income.canton} there`,
        );
      const ended = taxYear === 2025 ? ENDED_2025[r.name] : undefined;
      const c = communeByName(taxYear, ended ?? NAMES[r.name] ?? r.name);
      if (!c) {
        if (ended)
          lema.push(`${at}, now ${ended}: no 2025 multiplier here, ${r.income.commune} there`);
        else differences.push(`${at}: not in the engine's table`);
        continue;
      }
      seen.add(c.name);
      // A commune that ended in April 2025 has the multiplier of the commune it is part of.
      if (c.rate !== Math.round(r.income.commune * 100))
        differences.push(`${at}, commune: ${c.rate} here, ${r.income.commune} there`);
    }
    expect(differences).toEqual(OTHER_MULTIPLIERS[taxYear]);
    expect(lema).toEqual(taxYear === 2025 ? LEMA_2025 : []);
    // Every commune of the canton's table, once.
    expect(seen.size).toBe(P.communes.value.length);
    // Lema: no multiplier for 2025, 95 % for 2026 (ti-2026-communal-rates, row LEMA).
    expect(communeByName(taxYear, 'Lema')?.rate).toBe(taxYear === 2025 ? undefined : 9_500);
  });

  const bellinzona = communeByName(taxYear, golden.capital.name)!;
  const taxes = (household: string, income: number, wealth: number) =>
    assess({
      taxYear,
      commune: golden.capital.name,
      incomeTariff: HOUSEHOLDS[household]!.tariff,
      adults: HOUSEHOLDS[household]!.adults,
      incomeItems: [{ code: '1.1', person: 'p1', amount: income * 100 }],
      wealthItems: [{ code: '29.1', person: 'p1', amount: wealth * 100 }],
    }).taxes;

  it('gives the calculator’s taxes in Bellinzona, once its reading of the tariff is counted', () => {
    expect(golden.cases.length).toBe(174);
    expect(bellinzona.rate).toBe(9_300);
    const coefficient = P.amounts.coefficient.value;
    const differences: string[] = [];
    const lowerStill = new Map<string, string>();
    const gaps: number[] = [];
    for (const c of golden.cases) {
      const h = HOUSEHOLDS[c.household]!;
      const at = `${c.household}, income ${c.income}, wealth ${c.wealth}`;
      const money = (centimes: number) => (centimes / 100).toFixed(2);
      /** Apart by more than the two roundings allow, plus `slack` centimes. */
      const near = (what: string, ours: number, theirs: number, slack = 0) => {
        if (Math.abs(ours - theirs * 100) > 52 + slack)
          differences.push(`${what}, ${at}: engine ${money(ours)}, calculator ${theirs}`);
      };
      const e = c.estv;
      // One base tax for the canton and the commune, and no church tax.
      expect(e.IncomeSimpleTaxCity, at).toBe(e.IncomeSimpleTaxCanton);
      expect(e.FortuneSimpleTaxCity, at).toBe(e.FortuneSimpleTaxCanton);
      expect([e.IncomeTaxChurch, e.FortuneTaxChurch], at).toEqual([0, 0]);

      // Income. The calculator's base tax is its reading of the tariff, to the franc, but for the
      // three incomes where it is lower still (LOWER_STILL).
      const onIncome = taxes(c.household, c.income, 0);
      const tariff = P.income[h.tariff].value;
      const reading = calculatorReading(tariff, c.income);
      const asRead = Math.abs(e.IncomeSimpleTaxCanton * 100 - reading) <= 50;
      if (!asRead)
        lowerStill.set(
          `${h.tariff} ${c.income}`,
          `${h.tariff}, income ${c.income}: its reading ${money(reading)}, calculator ${e.IncomeSimpleTaxCanton}`,
        );
      // The engine's base tax is the law's; its cantonal and communal taxes are that base tax
      // times the coefficient and the multiplier, so they are above the calculator's by the gap
      // between the two base taxes times each. The gap is exact where the calculator follows its
      // reading, and known to the franc where it is lower still.
      const theirBase = asRead ? reading : e.IncomeSimpleTaxCanton * 100;
      const gap = onIncome.incomeBase.amount - theirBase;
      const slack = asRead ? 0 : 50;
      if (reading > 0 && asRead) gaps.push(gap);
      near(
        'cantonal tax on income',
        onIncome.cantonalIncome.amount - (gap * coefficient) / 10_000,
        e.IncomeTaxCanton,
        slack,
      );
      near(
        'communal tax on income',
        onIncome.communalIncome.amount - (gap * bellinzona.rate) / 10_000,
        e.IncomeTaxCity,
        slack,
      );
      if (reading === 0) expect(onIncome.incomeBase.amount, at).toBe(0);

      // Wealth: next to an income high enough for the brake on the wealth tax to stay out of the
      // way (below). The wealth tariff (art. 49) is read the same way on both sides.
      const onWealth = taxes(c.household, 5_000_000, c.wealth);
      near('base tax on wealth', onWealth.wealthBase.amount, e.FortuneSimpleTaxCanton);
      near('cantonal tax on wealth', onWealth.cantonalWealth.amount, e.FortuneTaxCanton);
      near('communal tax on wealth', onWealth.communalWealth.amount, e.FortuneTaxCity);
    }
    expect(differences).toEqual([]);
    expect([...lowerStill.values()]).toEqual(LOWER_STILL);
    // The gap everywhere else: the category's rate on CHF 100, from 2.616 % (the family tariff
    // between 28,300 and 33,100) to 14.650 % (between 304,000 and 761,400), give or take what the
    // law's rounded rates and its printed amounts differ by (src/tariff.ts).
    expect(Math.min(...gaps)).toBeGreaterThan(255);
    expect(Math.max(...gaps)).toBeLessThan(1_470);
  });

  // The personal tax: CHF 40 a year, and spouses owe it each (ti-na-law-lt-640-100 art. 290 cpv. 2
  // and 3, as changed by the law of 16 December 2015, in force since 1 January 2016). The
  // calculator has CHF 20 a person. The engine follows the law.
  it('levies the personal tax of CHF 40 for each adult, where the calculator has CHF 20', () => {
    for (const c of golden.cases) {
      const h = HOUSEHOLDS[c.household]!;
      const at = `${c.household}, income ${c.income}, wealth ${c.wealth}`;
      expect(c.estv.PersonalTax, at).toBe(20 * h.adults);
      expect(taxes(c.household, c.income, 0).personal.amount, at).toBe(4_000 * h.adults);
    }
  });

  // The brake on the wealth tax (freno all'imposta sulla sostanza, ti-na-law-lt-640-100 art. 49a):
  // on request, the cantonal and communal taxes on income and wealth are cut to 60 % of the
  // taxable income. The calculator does not know it; the engine does not compute the request and
  // gives no tax where it could apply. In the grid: 10 million of wealth next to an income of
  // 60,000, whose wealth taxes alone are 25,000 + 23,250, above 36,000.
  it('computes no tax where the brake on the wealth tax could apply', () => {
    const refused: string[] = [];
    for (const c of golden.cases) {
      const at = `${c.household}, income ${c.income}, wealth ${c.wealth}`;
      try {
        const x = taxes(c.household, c.income, c.wealth);
        const all =
          x.cantonalIncome.amount +
          x.communalIncome.amount +
          x.cantonalWealth.amount +
          x.communalWealth.amount;
        expect(x.total.amount, at).toBe(all + x.personal.amount);
        if (c.wealth >= 200_000) expect(all * 10, at).toBeLessThanOrEqual(c.income * 100 * 6);
      } catch (err) {
        if (!(err instanceof TiUnsupported) || err.note !== NOTE.wealthBrake) throw err;
        refused.push(at);
      }
    }
    expect(refused).toEqual([
      'single, income 60000, wealth 10000000',
      'married, income 60000, wealth 10000000',
    ]);
  });
});

// The document that decides between the two readings of the income tariff: the canton's own table
// of 2025. The engine is within 10 centimes of it up to 380,600 and within 50 above (the table
// follows neither the law's rates nor its amounts exactly, test/tariffs.test.ts); the calculator
// is CHF 3 to 15 under it, and CHF 83 under it at 60,000 and 70,000 for single people.
describe('the canton’s table of 2025 against the two readings of LT art. 35', () => {
  const golden = load(2025);
  const P = tiParamsFor(2025);
  const base = (tariff: 'single' | 'family', income: number) =>
    assess({
      taxYear: 2025,
      commune: 'Bellinzona',
      incomeTariff: tariff,
      adults: 1,
      incomeItems: [{ code: '1.1', person: 'p1', amount: income * 100 }],
      wealthItems: [],
    }).taxes.incomeBase.amount;
  const theirs = (household: string, income: number) =>
    golden.cases.find((c) => c.household === household && c.income === income && !c.wealth)!.estv
      .IncomeSimpleTaxCanton * 100;

  it.each(TABLE_2025)('at %i', (income, single, family) => {
    const within = income > 380_600 ? 50 : 10;
    expect(Math.abs(base('single', income) - single)).toBeLessThanOrEqual(within);
    const under = single - theirs('single', income);
    if (income === 60_000 || income === 70_000) expect(Math.round(under / 100)).toBe(83);
    else {
      expect(under).toBeGreaterThan(400);
      expect(under).toBeLessThan(1_500);
      // Its reading, to the franc.
      const reading = calculatorReading(P.income.single.value, income);
      expect(Math.abs(theirs('single', income) - reading)).toBeLessThanOrEqual(50);
    }
    if (family === null) return;
    expect(Math.abs(base('family', income) - family)).toBeLessThanOrEqual(within);
    const underFamily = family - theirs('married', income);
    expect(underFamily).toBeGreaterThan(250);
    expect(underFamily).toBeLessThan(1_550);
    const reading = calculatorReading(P.income.family.value, income);
    expect(Math.abs(theirs('married', income) - reading)).toBeLessThanOrEqual(50);
  });

  it('prints at the top of a category what the law prints, not what the calculator’s reading gives', () => {
    // 17,400 (single people): the law and the table 276.40; the reading 271.14.
    expect(base('single', 17_400)).toBe(27_640);
    expect(calculatorReading(P.income.single.value, 17_400)).toBeCloseTo(27_113.6, 1);
    // And CHF 100 further the reading jumps to the law's amount for the top: 276.40 at 17,500.
    expect(calculatorReading(P.income.single.value, 17_500)).toBe(27_640);
  });
});
