// Lucerne against the Federal Tax Administration's own calculator (SPEC.md section 13, item 2):
// test/golden/estv/lu-<year>.json holds what swisstaxcalculator.estv.admin.ch holds and computes,
// recorded by scripts/estv-cantons-golden.mjs, a dev tool. Nothing here uses the network.
//
// - `rates`: the units of every commune (the state's, the Einwohnergemeinde's, the two parishes'
//   and the Christ Catholic church's), a hundred times the canton's units there (155 is 1.55
//   Einheiten, the engine's 15500), compared with the engine's tables. The canton's table carries
//   no federal commune number, so the communes are matched by name.
// - `cases`: the taxes of made-up cases in the City of Lucerne from a taxable income and wealth
//   given as they are: the two tariffs (StG § 57 Abs. 1 and 2), the wealth tariff (§ 60), the
//   amounts under CHF 100 and CHF 1,000 dropped, the units, the church tax and the Personalsteuer.
//   Nothing about the deductions.
//
// The calculator is evidence, not the authority: where it and the canton's documents differ, the
// documents decide (docs/sources/lu/NOTES.md, "Against the federal calculator"). Here it found one
// figure the canton had changed in its table of units since the engine's table was generated
// (Hohenrain 2026, below); with it, the two agree on every figure.
//
// The calculator answers in whole francs and gives the tax on income and on wealth apart; the
// engine multiplies the tax per unit of the two together. So each case is also run with its income
// alone and with its wealth alone, and every figure is compared on its own: the calculator's franc
// is the exact amount rounded, the engine's is rounded to the centime, so the two are at most 50
// centimes apart.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assess, communeByName, luParamsFor, type Confession } from '../src/index.js';

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
    readFileSync(new URL(`../../../test/golden/estv/lu-${taxYear}.json`, import.meta.url), 'utf8'),
  ) as Golden;

/**
 * The communes the calculator names otherwise than the canton's table of units
 * (lu-<year>-communal-steuereinheiten p. 1 and 2): the federal list adds the canton or the region
 * to names that exist elsewhere in Switzerland.
 */
const NAMES: Record<string, string> = {
  'Hasle (LU)': 'Hasle',
  'Aesch (LU)': 'Aesch',
  'Eschenbach (LU)': 'Eschenbach',
  'Rickenbach (LU)': 'Rickenbach',
  'Hergiswil bei Willisau': 'Hergiswil',
  'Zell (LU)': 'Zell',
};

/**
 * The household as the engine takes it: the family tariff (§ 57 Abs. 2) for married couples and
 * for a parent living with their child, the tariff for single persons (Abs. 1) for everyone else;
 * the church tax by the confession of the family's members (§ 240 Abs. 2).
 */
const HOUSEHOLDS: Record<string, { tariff: 'single' | 'family'; church: Confession[] }> = {
  single: { tariff: 'single', church: ['none'] },
  married: { tariff: 'family', church: ['none', 'none'] },
  married2: { tariff: 'family', church: ['none', 'none', 'none', 'none'] },
  single1: { tariff: 'family', church: ['none', 'none'] },
  singleReformed: { tariff: 'single', church: ['reformed'] },
  singleCatholic: { tariff: 'single', church: ['catholic'] },
  singleChristCatholic: { tariff: 'single', church: ['christ_catholic'] },
  marriedReformed: { tariff: 'family', church: ['reformed', 'reformed'] },
};

describe.each([2025, 2026] as const)('the federal calculator, Lucerne %i', (taxYear) => {
  const golden = load(taxYear);
  const P = luParamsFor(taxYear);
  /** A hundred times the units there, ten-thousandths here: 155 -> 15500, 21.6 -> 2160. */
  const tenThousandths = (hundredths: number) => Math.round(hundredths * 100);

  it('has the units of every commune and parish', () => {
    const differences: string[] = [];
    const seen = new Set<string>();
    expect(golden.rates.length).toBe(79);
    expect(P.communes.value.length).toBe(79);
    for (const r of golden.rates) {
      // The same units on income and on wealth (StG § 2 Abs. 2).
      expect(r.wealth, r.name).toEqual(r.income);
      const c = communeByName(taxYear, NAMES[r.name] ?? r.name);
      if (!c) {
        differences.push(`${r.name} (BFS ${r.bfs}): not in the engine's table`);
        continue;
      }
      seen.add(c.name);
      const check = (what: string, ours: number, theirs: number) => {
        if (ours !== tenThousandths(theirs))
          differences.push(`${r.name} (BFS ${r.bfs}), ${what}: ${ours} here, ${theirs} there`);
      };
      check('state', P.stateUnits.value, r.income.canton);
      check('commune', c.units, r.income.commune);
      check('reformed', c.reformed.units, r.income.reformed);
      check('catholic', c.catholic.units, r.income.catholic);
      check('christ catholic', P.christCatholicUnits.value, r.income.christCatholic);
    }
    expect(differences).toEqual([]);
    // Every commune of the canton's table, once.
    expect(seen.size).toBe(79);
  });

  it('gives the calculator’s taxes in the City of Lucerne, figure by figure', () => {
    expect(golden.cases.length).toBe(174);
    const differences: string[] = [];
    for (const c of golden.cases) {
      const h = HOUSEHOLDS[c.household]!;
      const taxes = (income: number, wealth: number) =>
        assess({
          taxYear,
          commune: golden.capital.name,
          tariff: h.tariff,
          church: h.church,
          incomeItems: [{ code: '100', person: 'p1', amount: income * 100 }],
          wealthItems: [{ code: '400', person: 'p1', amount: wealth * 100 }],
        }).taxes;
      const at = `${c.household}, income ${c.income}, wealth ${c.wealth}`;
      const near = (what: string, ours: number, theirs: number) => {
        if (Math.abs(ours - theirs * 100) > 50)
          differences.push(
            `${what}, ${at}: engine ${(ours / 100).toFixed(2)}, calculator ${theirs}`,
          );
      };
      const e = c.estv;
      // One tax per unit for the state and the commune.
      expect(e.IncomeSimpleTaxCity, at).toBe(e.IncomeSimpleTaxCanton);
      expect(e.FortuneSimpleTaxCity, at).toBe(e.FortuneSimpleTaxCanton);
      const onIncome = taxes(c.income, 0);
      const onWealth = taxes(0, c.wealth);
      const both = taxes(c.income, c.wealth);
      near('tax per unit on income', onIncome.incomePerUnit.amount, e.IncomeSimpleTaxCanton);
      near('state tax on income', onIncome.cantonal.amount, e.IncomeTaxCanton);
      near('communal tax on income', onIncome.communal.amount, e.IncomeTaxCity);
      near('church tax on income', onIncome.church?.amount ?? 0, e.IncomeTaxChurch);
      near('tax per unit on wealth', onWealth.wealthPerUnit.amount, e.FortuneSimpleTaxCanton);
      near('state tax on wealth', onWealth.cantonal.amount, e.FortuneTaxCanton);
      near('communal tax on wealth', onWealth.communal.amount, e.FortuneTaxCity);
      near('church tax on wealth', onWealth.church?.amount ?? 0, e.FortuneTaxChurch);

      // Income and wealth together, as the engine bills them: the sum of the two parts, give or
      // take the centime of one rounding instead of two.
      expect(both.incomePerUnit.amount).toBe(onIncome.incomePerUnit.amount);
      expect(both.wealthPerUnit.amount).toBe(onWealth.wealthPerUnit.amount);
      for (const tax of ['cantonal', 'communal', 'church'] as const) {
        const together = both[tax]?.amount ?? 0;
        const apart = (onIncome[tax]?.amount ?? 0) + (onWealth[tax]?.amount ?? 0);
        expect(Math.abs(together - apart), `${tax}, ${at}`).toBeLessThanOrEqual(1);
      }

      // The maximum burden (Höchstbelastung, § 62), which the calculator does not know, never
      // applies in the city: its units, with the highest church's, are 3.41 in 2025 (1.55 + 1.55
      // + 0.31) and 3.21 in 2026, so at the top rate of 5.8 % per unit the income tax is under
      // 19.8 % of the income (the limits are 22.8 % and 22.4 %), and the wealth tax is 3.41 x 0.75
      // per mille, under 2.6 per mille (the limit is 3.0).
      expect([both.incomeCap, both.wealthCap], at).toEqual([null, null]);

      // CHF 50, one for the return: spouses pay one together (§ 232 Abs. 1).
      if (both.personal.amount !== e.PersonalTax * 100)
        differences.push(
          `Personalsteuer, ${at}: engine ${(both.personal.amount / 100).toFixed(2)}, calculator ${e.PersonalTax}`,
        );
    }
    expect(differences).toEqual([]);
  });

  // The grid's incomes that are not whole hundreds: both drop the part under CHF 100 (§ 57 Abs. 3).
  it('reads the tariff at the taxable income rounded down to CHF 100, as the calculator does', () => {
    for (const household of ['single', 'married'] as const) {
      const h = HOUSEHOLDS[household]!;
      const perUnit = (income: number) =>
        assess({
          taxYear,
          commune: golden.capital.name,
          tariff: h.tariff,
          church: h.church,
          incomeItems: [{ code: '100', person: 'p1', amount: income * 100 }],
          wealthItems: [],
        }).taxes.incomePerUnit.amount;
      const theirs = (income: number) =>
        golden.cases.find((c) => c.household === household && c.income === income && !c.wealth)!
          .estv.IncomeSimpleTaxCanton * 100;
      expect(perUnit(99_999)).toBe(perUnit(99_900));
      expect(perUnit(100_000)).toBeGreaterThan(perUnit(99_999));
      for (const income of [33_333, 99_999, 100_000, 123_456])
        expect(Math.abs(perUnit(income) - theirs(income)), `${household} ${income}`).toBeLessThan(
          51,
        );
    }
  });
});

// The one difference the first comparison found: the engine's table gave Hohenrain's Roman Catholic
// parish 0.45 units for 2026, the calculator 0.40. The canton had replaced its table of 24 March
// 2026 with one printed on 30 October 2026 (lu-2026-communal-steuereinheiten p. 1, row Hohenrain:
// Einwohnergemeinde 2.05, römisch-katholische Kirchgemeinde 0.40, total with the state's 1.45
// units 3.90; the earlier printout had 0.45 and 3.95). The engine's table was generated again
// from the new one (scripts/lu-communes.mjs).
describe('Hohenrain 2026, the canton’s table of 30 October 2026', () => {
  it('has 0.40 units for the Roman Catholic parish, 3.90 with the state and the commune', () => {
    const c = communeByName(2026, 'Hohenrain')!;
    expect(c.units).toBe(20_500);
    expect(c.catholic).toEqual({ units: 4_000, parish: null });
    expect(luParamsFor(2026).stateUnits.value + c.units + c.catholic.units).toBe(39_000);
    // 2025 is as it was: 2.10 and 0.45, 4.10 with the state's 1.55
    // (lu-2025-communal-steuereinheiten p. 1).
    const before = communeByName(2025, 'Hohenrain')!;
    expect([before.units, before.catholic.units]).toEqual([21_000, 4_500]);
    expect(luParamsFor(2025).stateUnits.value + before.units + before.catholic.units).toBe(41_000);
  });

  // By hand, a Roman Catholic single person in Hohenrain with a taxable income of 60,000 in 2026.
  // The tax per unit by § 57 Abs. 1 (lu-2026-law-steuergesetz p. 30): nothing on the first 9,900;
  // 2,400 at 0.5 % = 12; 3,200 at 1 % = 32; 1,200 at 2 % = 24; 1,200 at 3 % = 36; 2,900 at 4 % =
  // 116; 4,300 at 4.5 % = 193.50; that is 413.50 on 25,100; the other 34,900 at 5 % = 1,745:
  // 2,158.50. The church tax: 2,158.50 x 0.40 = 863.40 (0.45 gave 971.33, so 107.93 less).
  it('gives a Roman Catholic household there a church tax of 0.40 units', () => {
    const x = assess({
      taxYear: 2026,
      commune: 'Hohenrain',
      tariff: 'single',
      church: ['catholic'],
      incomeItems: [{ code: '100', person: 'p1', amount: 6_000_000 }],
      wealthItems: [],
    }).taxes;
    expect(x.incomePerUnit.amount).toBe(215_850);
    expect(x.church?.amount).toBe(86_340);
  });
});
