// Aargau against the Federal Tax Administration's own calculator (SPEC.md section 13, item 2):
// test/golden/estv/ag-<year>.json holds what swisstaxcalculator.estv.admin.ch holds and computes,
// recorded by scripts/estv-cantons-golden.mjs, a dev tool. Nothing here uses the network.
//
// - `rates`: the Steuerfuss of the canton and of every commune and the three church Steuerfüsse,
//   in percent of the einfache Steuer on both sides, compared with the engine's tables. The
//   canton's list carries no federal commune number, so the communes are matched by name.
// - `cases`: the taxes of made-up cases in Aarau from a taxable income and wealth given as they
//   are: Tarif A and Tarif B (StG § 43), the wealth tariff (§ 55), the amounts under CHF 100 and
//   CHF 1,000 dropped, the Steuerfüsse and the church tax. Nothing about the deductions.
//
// The calculator is evidence, not the authority: where it and the canton's documents differ, the
// documents decide, and the difference is pinned below with the document that decides it
// (docs/sources/ag/NOTES.md, "Against the federal calculator").
//
// The calculator answers in whole francs and gives the tax on income and on wealth apart; the
// engine multiplies the einfache Steuer of the two together. So each case is also run with its
// income alone and with its wealth alone, and every figure is compared on its own: the
// calculator's franc is the exact amount rounded, the engine's amount is rounded to 10 centimes
// (the guide's example, ag-2025-guide-wegleitung p. 45), so the two are at most 55 centimes apart.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { agParamsFor, assess, communeByName } from '../src/index.js';

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
type Church = 'none' | 'reformed' | 'catholic' | 'christ_catholic';

const load = (taxYear: TaxYear) =>
  JSON.parse(
    readFileSync(new URL(`../../../test/golden/estv/ag-${taxYear}.json`, import.meta.url), 'utf8'),
  ) as Golden;

/**
 * The communes the canton's list names otherwise than the calculator
 * (ag-<year>-communal-steuerfuesse p. 1 to 8): the list adds the canton to these six.
 */
const NAMES: Record<string, string> = {
  Büttikon: 'Büttikon (AG)',
  Brugg: 'Brugg (AG)',
  Rüfenach: 'Rüfenach (AG)',
  Sisseln: 'Sisseln (AG)',
  Ammerswil: 'Ammerswil (AG)',
  Abtwil: 'Abtwil (AG)',
};

/**
 * The household as the engine takes it: Tarif B (§ 43 Abs. 2) for married couples and for a parent
 * living with their child, Tarif A for everyone else.
 */
const HOUSEHOLDS: Record<string, { tariff: 'A' | 'B'; church: Church }> = {
  single: { tariff: 'A', church: 'none' },
  married: { tariff: 'B', church: 'none' },
  married2: { tariff: 'B', church: 'none' },
  single1: { tariff: 'B', church: 'none' },
  singleReformed: { tariff: 'A', church: 'reformed' },
  singleCatholic: { tariff: 'A', church: 'catholic' },
  singleChristCatholic: { tariff: 'A', church: 'christ_catholic' },
  marriedReformed: { tariff: 'B', church: 'reformed' },
};

/**
 * Steuerfüsse the calculator holds differently from the canton's list of the year, the
 * Verzeichnis der Gemeinde- und Kirchensteuerfüsse of the Kantonales Steueramt. The engine's
 * table is generated from it (scripts/ag-communes.mjs) and keeps the canton's figures.
 * - 2025 (ag-2025-communal-steuerfuesse, dated 1 January 2025, 15 May 2025 and 1 January 2026):
 *   Aarburg, christ-kt. 25 (p. 1; the calculator has 21); Killwangen, röm.-kt. 20 (p. 4; 19
 *   there); Suhr, christ-kt. 23 (p. 7; 25 there, the list's figure for 2026).
 * - 2026 (ag-2026-communal-steuerfuesse, dated 1 and 22 January, 17 and 25 March and 16 June
 *   2026): Büttikon (AG), Steuerfuss 104 (p. 2; the calculator has 96); Döttingen, Steuerfuss 102
 *   (p. 2; 107 there); Leimbach (AG), christ-kt. 25 (p. 4; 23 there); Mumpf, röm.-kt. 20 (p. 5;
 *   22 there); Othmarsingen, Steuerfuss 102 and christ-kt. 25 (p. 6; 104 and 23 there). All six
 *   of the calculator's figures are those of the 2025 list (p. 2, 4, 5 and 6).
 */
const OTHER_MULTIPLIERS: Record<TaxYear, string[]> = {
  2025: [
    'Suhr (BFS 4012), christ catholic: 23 here, 25 there',
    'Killwangen (BFS 4030), catholic: 20 here, 19 there',
    'Aarburg (BFS 4271), christ catholic: 25 here, 21 there',
  ],
  2026: [
    'Büttikon (BFS 4064), commune: 104 here, 96 there',
    'Leimbach (AG) (BFS 4137), christ catholic: 25 here, 23 there',
    'Othmarsingen (BFS 4205), commune: 102 here, 104 there',
    'Othmarsingen (BFS 4205), christ catholic: 25 here, 23 there',
    'Mumpf (BFS 4255), catholic: 20 here, 22 there',
    'Döttingen (BFS 4304), commune: 102 here, 107 there',
  ],
};

/**
 * The einfache Einkommenssteuer where the tariff gives a half franc. The canton rounds it down
 * (ag-2025-tariff-einkommenssteuer p. 2, 5. Rundung: "Steuerbeträge werden auf Franken
 * abgerundet"), and its table prints the amount rounded down: Tarif A 2'802 at 55'000 and 3'227
 * at 60'000 (p. 13), 6'928 at 99'900 (p. 21), 9'227 at 123'400 (p. 25), 11'887 at 150'000
 * (p. 30), 14'387 at 175'000 (p. 34), 17'005 at 200'000 (p. 39), 22'255 at 250'000 (p. 48) and
 * 27'505 at 300'000 (p. 57). The calculator rounds the half franc up. The engine follows the
 * canton; the 2026 tariff is the same (ag-na-tariff-steuern-berechnen: gültig ab 2025).
 *
 * By hand for the first, with the steps of § 43 Abs. 1 as the tariff prints them (p. 1): the
 * first 51,300 give 38 + 78 + 126 + 172 + 260 + 444 + 602 + 768 = 2,488 (3,800 at 1 %, 3,900 at
 * 2 %, 4,200 at 3 %, 4,300 at 4 %, 5,200 at 5 %, 7,400 at 6 %, 8,600 at 7 %, 9,600 at 8 %, after
 * 4,300 at nothing); the other 3,700 of 55,000 at 8.5 % give 314.50: 2,802.50. The same income
 * list in both years.
 */
const HALF_FRANCS = [
  'single, income 55000: engine 2802.00, calculator 2803',
  'single, income 60000: engine 3227.00, calculator 3228',
  'single, income 99999: engine 6928.00, calculator 6929',
  'single, income 123456: engine 9227.00, calculator 9228',
  'single, income 150000: engine 11887.00, calculator 11888',
  'single, income 175000: engine 14387.00, calculator 14388',
  'single, income 200000: engine 17005.00, calculator 17006',
  'single, income 250000: engine 22255.00, calculator 22256',
  'single, income 300000: engine 27505.00, calculator 27506',
  // The same income of 60,000 next to each wealth of the grid.
  ...Array.from({ length: 13 }, () => 'single, income 60000: engine 3227.00, calculator 3228'),
  'singleReformed, income 60000: engine 3227.00, calculator 3228',
  'singleReformed, income 150000: engine 11887.00, calculator 11888',
  'singleCatholic, income 60000: engine 3227.00, calculator 3228',
  'singleCatholic, income 150000: engine 11887.00, calculator 11888',
  'singleChristCatholic, income 60000: engine 3227.00, calculator 3228',
  'singleChristCatholic, income 150000: engine 11887.00, calculator 11888',
];

describe.each([2025, 2026] as const)('the federal calculator, Aargau %i', (taxYear) => {
  const golden = load(taxYear);
  const P = agParamsFor(taxYear);

  it('has the Steuerfüsse of every commune, but for those the canton’s list gives otherwise', () => {
    const differences: string[] = [];
    const seen = new Set<string>();
    // Villnachern is in the list of 2025 and no longer in the list of 2026, on both sides.
    const communes = taxYear === 2025 ? 197 : 196;
    expect(golden.rates.length).toBe(communes);
    expect(P.communes.value.length).toBe(communes);
    for (const r of golden.rates) {
      // The same Steuerfüsse on income and on wealth (StG § 2).
      expect(r.wealth, r.name).toEqual(r.income);
      const c = communeByName(taxYear, NAMES[r.name] ?? r.name);
      if (!c) {
        differences.push(`${r.name} (BFS ${r.bfs}): not in the engine's table`);
        continue;
      }
      seen.add(c.name);
      const check = (what: string, ours: number, theirs: number) => {
        if (ours !== theirs)
          differences.push(`${r.name} (BFS ${r.bfs}), ${what}: ${ours} here, ${theirs} there`);
      };
      check('canton', P.cantonalRate.value, r.income.canton);
      check('commune', c.rate, r.income.commune);
      // The commune's own parishes: the calculator holds none of the further parishes of a part
      // of a commune (Zusatzkirchen, the list's p. 9).
      check('reformed', c.church.reformed, r.income.reformed);
      check('catholic', c.church.catholic, r.income.catholic);
      check('christ catholic', c.church.christCatholic, r.income.christCatholic);
    }
    expect(differences).toEqual(OTHER_MULTIPLIERS[taxYear]);
    // Every commune of the canton's list, once.
    expect(seen.size).toBe(communes);
  });

  it('gives the calculator’s taxes in Aarau, figure by figure', () => {
    expect(golden.cases.length).toBe(174);
    const C = communeByName(taxYear, golden.capital.name)!;
    const differences: string[] = [];
    const halfFrancs: string[] = [];
    for (const c of golden.cases) {
      const h = HOUSEHOLDS[c.household]!;
      const taxes = (income: number, wealth: number) =>
        assess({
          taxYear,
          commune: golden.capital.name,
          tariff: h.tariff,
          // Aarau's own parish, not the Reformed parish of Rohr (the list's p. 9).
          church: { confession: h.church, parish: golden.capital.name },
          incomeItems: [{ code: '1.1', person: 'p1', amount: income * 100 }],
          wealthItems: [{ code: '20.1', person: 'p1', amount: wealth * 100 }],
        }).taxes;
      const at = `${c.household}, income ${c.income}, wealth ${c.wealth}`;
      const said = (ours: number, theirs: number) =>
        `engine ${(ours / 100).toFixed(2)}, calculator ${theirs}`;
      /** Apart by more than the two roundings allow, plus `slack` centimes. */
      const near = (what: string, ours: number, theirs: number, slack = 0) => {
        if (Math.abs(ours - theirs * 100) > 55 + slack)
          differences.push(`${what}, ${at}: ${said(ours, theirs)}`);
      };
      const e = c.estv;
      // One einfache Steuer for the canton and the commune, and no personal tax in Aargau.
      expect(e.IncomeSimpleTaxCity, at).toBe(e.IncomeSimpleTaxCanton);
      expect(e.FortuneSimpleTaxCity, at).toBe(e.FortuneSimpleTaxCanton);
      expect(e.PersonalTax, at).toBe(0);
      const onIncome = taxes(c.income, 0);
      const onWealth = taxes(0, c.wealth);
      const both = taxes(c.income, c.wealth);

      // The einfache Einkommenssteuer is in whole francs on both sides: the same franc, but for
      // the half francs the canton rounds down (HALF_FRANCS). There the taxes are lower by half a
      // franc times the Steuerfuss, at most 56 centimes (the canton's 111 % of 2025).
      const half = onIncome.simpleIncome.amount !== e.IncomeSimpleTaxCanton * 100;
      if (half)
        halfFrancs.push(
          `${c.household}, income ${c.income}: ${said(onIncome.simpleIncome.amount, e.IncomeSimpleTaxCanton)}`,
        );
      const slack = half ? 56 : 0;
      near('cantonal tax on income', onIncome.cantonal.amount, e.IncomeTaxCanton, slack);
      near('communal tax on income', onIncome.communal.amount, e.IncomeTaxCity, slack);
      near('church tax on income', onIncome.church?.amount ?? 0, e.IncomeTaxChurch, slack);

      // On wealth the tariff is exact to the centime (0.1 per mille of whole CHF 1,000). The
      // taxes are the engine's lines before the maximum burden: with the wealth alone and no
      // income, the engine would cut them (below).
      near('simple tax on wealth', onWealth.simpleWealth.amount, e.FortuneSimpleTaxCanton);
      near('cantonal tax on wealth', onWealth.cantonal.amount, e.FortuneTaxCanton);
      near('communal tax on wealth', onWealth.communal.amount, e.FortuneTaxCity);
      near('church tax on wealth', onWealth.church?.amount ?? 0, e.FortuneTaxChurch);

      // Income and wealth together, as the engine bills them: the sum of the two parts, give or
      // take the 10 centimes of one rounding instead of two.
      expect(both.simpleIncome.amount).toBe(onIncome.simpleIncome.amount);
      expect(both.simpleWealth.amount).toBe(onWealth.simpleWealth.amount);
      for (const tax of ['cantonal', 'communal', 'church'] as const) {
        const together = both[tax]?.amount ?? 0;
        const apart = (onIncome[tax]?.amount ?? 0) + (onWealth[tax]?.amount ?? 0);
        expect(Math.abs(together - apart), `${tax}, ${at}`).toBeLessThanOrEqual(10);
      }

      // The maximum burden (Höchstbelastung, § 56 Abs. 1: the taxes cut to 70 % of the
      // Reineinkommen, by at most half of the wealth taxes), which the calculator does not know,
      // applies to no case as given. The nearest, 10 million of wealth next to an income of
      // 60,000 in 2025: einfache Steuer 3,227 + 15,775.30 (460.10 on the first 428,000, then
      // 9,572,000 at 1.6 per mille), times 111 % + 96 %, is 39,335, under 42,000.
      expect(both.maxBurden, at).toBeNull();
      const all = both.cantonal.amount + both.communal.amount + (both.church?.amount ?? 0);
      expect(both.total.amount, at).toBe(all);
      expect(all * 10, at).toBeLessThanOrEqual(c.income * 100 * 7);
      // With the wealth alone the Reineinkommen is zero, so the engine cuts half the wealth taxes.
      if (onWealth.simpleWealth.amount > 0) expect(onWealth.maxBurden, at).not.toBeNull();
    }
    expect(differences).toEqual([]);
    expect(halfFrancs).toEqual(HALF_FRANCS);
    expect(C.rate).toBe(96);
  });

  // The grid's incomes that are not whole hundreds: both drop the part under CHF 100 (§ 43 Abs. 3;
  // ag-2025-tariff-einkommenssteuer p. 2, 5. Rundung).
  it('reads the tariff at the taxable income rounded down to CHF 100, as the calculator does', () => {
    for (const household of ['single', 'married'] as const) {
      const h = HOUSEHOLDS[household]!;
      const simple = (income: number) =>
        assess({
          taxYear,
          commune: golden.capital.name,
          tariff: h.tariff,
          church: { confession: 'none' },
          incomeItems: [{ code: '1.1', person: 'p1', amount: income * 100 }],
          wealthItems: [],
        }).taxes.simpleIncome.amount;
      const theirs = (income: number) =>
        golden.cases.find((c) => c.household === household && c.income === income && !c.wealth)!
          .estv.IncomeSimpleTaxCanton * 100;
      expect(simple(99_999)).toBe(simple(99_900));
      expect(simple(100_000)).toBeGreaterThan(simple(99_999));
      expect(simple(33_333)).toBe(theirs(33_333));
      expect(simple(100_000)).toBe(theirs(100_000));
      // 99,900 and 123,400 give a half franc with Tarif A (HALF_FRANCS), not with Tarif B.
      const halfFranc = household === 'single' ? 100 : 0;
      expect(theirs(99_999) - simple(99_999)).toBe(halfFranc);
      expect(theirs(123_456) - simple(123_456)).toBe(halfFranc);
    }
  });
});
