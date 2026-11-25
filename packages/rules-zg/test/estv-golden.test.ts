// Zug against the Federal Tax Administration's own calculator (SPEC.md section 13, item 2):
// test/golden/estv/zg-<year>.json holds what swisstaxcalculator.estv.admin.ch holds and computes,
// recorded by scripts/estv-cantons-golden.mjs, a dev tool. Nothing here uses the network.
//
// - `rates`: the Steuerfüsse of the 11 communes (canton, Einwohnergemeinde, the Evangelical
//   Reformed parish of the canton, the Roman Catholic parish), compared with the engine's tables.
//   The canton's table has no federal commune numbers, so each number's commune is found by the
//   name the calculator gives it; every commune of the engine must be found exactly once.
// - `cases`: the taxes of made-up cases in the City of Zug from a taxable income and wealth given
//   as they are: the Grundtarif and the Mehrpersonentarif, the wealth tariff, every Steuerfuss and
//   the church tax. Nothing about the deductions.
//
// The calculator answers in whole francs and gives the tax on income and on wealth apart; the
// engine applies each Steuerfuss to the einfache Steuer of the two together. A figure matches when
// it is within a franc per figure the calculator rounded.
//
// What the comparison found (docs/sources/zg/NOTES.md, "Checked against the federal calculator"):
// the engine read the tariff at the taxable income to the franc, the calculator at whole CHF 100.
// The ordinance decides: "Bei der Berechnung des steuerpflichtigen Einkommens oder Gewinns wird
// auf das nächste Hundert und beim Vermögen oder Kapital auf das nächste Tausend abgerundet"
// (zg-na-law-verordnung-steuergesetz § 43, p. 13). The engine now does; no difference is left.
import { readFileSync } from 'node:fs';
import { ifdParamsFor, ifdTax, Trace, type IfdScale } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import { assess, foldName, zgParamsFor, type ZgTaxYear } from '../src/index.js';

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
    readFileSync(new URL(`../../../test/golden/estv/zg-${taxYear}.json`, import.meta.url), 'utf8'),
  ) as Golden;

/**
 * The household as the engine takes it: a parent living with their child has the
 * Mehrpersonentarif like a married couple (StG § 35 Abs. 2); the children change nothing else in
 * the tariff. The federal scale and its reductions per child: LIFD art. 36.
 */
const HOUSEHOLDS: Record<
  string,
  {
    tariff: 'single' | 'married';
    church?: 'reformed' | 'catholic';
    ifd: IfdScale;
    children: number;
  }
> = {
  single: { tariff: 'single', ifd: 'single', children: 0 },
  married: { tariff: 'married', ifd: 'married', children: 0 },
  married2: { tariff: 'married', ifd: 'married', children: 2 },
  single1: { tariff: 'married', ifd: 'parental', children: 1 },
  singleReformed: { tariff: 'single', church: 'reformed', ifd: 'single', children: 0 },
  singleCatholic: { tariff: 'single', church: 'catholic', ifd: 'single', children: 0 },
  // No Christian Catholic parish levies a tax in Zug: the calculator holds a rate of 0.
  singleChristCatholic: { tariff: 'single', ifd: 'single', children: 0 },
  marriedReformed: { tariff: 'married', church: 'reformed', ifd: 'married', children: 0 },
};

function engine(taxYear: ZgTaxYear, capital: string, c: Case) {
  const P = zgParamsFor(taxYear);
  const h = HOUSEHOLDS[c.household]!;
  const commune = P.communes.value.find((x) => x.name === capital)!;
  return assess({
    taxYear,
    commune: capital,
    tariff: h.tariff,
    church: h.church
      ? [
          {
            who: h.church,
            rate: h.church === 'reformed' ? P.reformed.value : commune.catholic,
            shareBp: 10_000,
          },
        ]
      : null,
    incomeItems: [{ code: '100', person: 'p1', amount: c.income * 100 }],
    wealthItems: [{ code: '600', person: 'p1', amount: c.wealth * 100 }],
  }).taxes;
}

describe.each([2025, 2026] as const)('the federal calculator, Zug %i', (taxYear) => {
  const golden = load(taxYear);
  const P = zgParamsFor(taxYear);

  it('has the Steuerfüsse of every commune', () => {
    const differences: string[] = [];
    const found = new Set<string>();
    expect(golden.rates.length).toBe(11);
    expect(new Set(golden.rates.map((r) => r.bfs)).size).toBe(11);
    for (const r of golden.rates) {
      const c = P.communes.value.find((x) => foldName(x.name) === foldName(r.name));
      if (!c) {
        differences.push(`${r.name} (BFS ${r.bfs}): not in the engine's table`);
        continue;
      }
      found.add(c.name);
      const check = (what: string, ours: number, theirs: number) => {
        if (ours !== Math.round(theirs * 100))
          differences.push(
            `${r.name} (BFS ${r.bfs}), ${what}: ${ours / 100} here, ${theirs} there`,
          );
      };
      // The same Steuerfüsse on income and on wealth: each is levied on the einfache Steuer of
      // both (StG § 2 Abs. 1).
      for (const base of [r.income, r.wealth]) {
        check('canton', P.canton.value, base.canton);
        check('commune', c.rate, base.commune);
        check('reformed', P.reformed.value, base.reformed);
        check('catholic', c.catholic, base.catholic);
        check('christ catholic', 0, base.christCatholic);
      }
    }
    expect(differences).toEqual([]);
    expect(found.size).toBe(P.communes.value.length);
  });

  it('gives the calculator’s taxes in the City of Zug, to the franc', () => {
    expect(golden.capital).toEqual({ bfs: 1711, name: 'Zug' });
    expect(golden.cases.length).toBe(174);
    const differences: string[] = [];
    for (const c of golden.cases) {
      const x = engine(taxYear, golden.capital.name, c);
      const e = c.estv;
      const at = `${c.household}, income ${c.income}, wealth ${c.wealth}`;
      // One franc per figure the calculator rounded.
      const near = (what: string, ours: number, theirs: readonly number[]) => {
        const francs = Math.max(1, theirs.filter((v) => v !== 0).length);
        const sum = theirs.reduce((s, v) => s + v, 0);
        if (Math.abs(ours - sum * 100) >= francs * 100)
          differences.push(`${what}, ${at}: engine ${(ours / 100).toFixed(2)}, calculator ${sum}`);
      };
      near('einfache Steuer on income', x.simpleIncome.amount, [e.IncomeSimpleTaxCanton]);
      near('einfache Steuer on income (commune)', x.simpleIncome.amount, [e.IncomeSimpleTaxCity]);
      near('einfache Steuer on wealth', x.simpleWealth.amount, [e.FortuneSimpleTaxCanton]);
      near('einfache Steuer on wealth (commune)', x.simpleWealth.amount, [e.FortuneSimpleTaxCity]);
      near('Kantonssteuer', x.cantonal.amount, [e.IncomeTaxCanton, e.FortuneTaxCanton]);
      near('Gemeindesteuer', x.communal.amount, [e.IncomeTaxCity, e.FortuneTaxCity]);
      near('Kirchensteuer', x.church?.amount ?? 0, [e.IncomeTaxChurch, e.FortuneTaxChurch]);
      near('total', x.total.amount, [
        e.IncomeTaxCanton,
        e.FortuneTaxCanton,
        e.IncomeTaxCity,
        e.FortuneTaxCity,
        e.IncomeTaxChurch,
        e.FortuneTaxChurch,
      ]);
      // Zug has no Personalsteuer.
      if (e.PersonalTax !== 0) differences.push(`Personalsteuer, ${at}: ${e.PersonalTax} there`);
    }
    expect(differences).toEqual([]);
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

  // By hand (zg-2026-tariff-grundtarif p. 1 for 2026, p. 2 for 2025: the same brackets): the
  // Grundtarif is 2,531.50 at 59,700, then 6.5 % to 74,700 (975.00), 8 % to 94,800 (1,608.00) and
  // 10 % from there. A taxable income of 99,999 counts as 99,900 (Verordnung § 43): 5,114.50 at
  // 94,800 + 5,100 x 10 % = 5,624.50; to the franc it would be 5,634.40.
  it('reads the income tariff at whole CHF 100 (Verordnung § 43)', () => {
    const c = golden.cases.find(
      (k) => k.household === 'single' && k.income === 99_999 && k.wealth === 0,
    )!;
    expect(engine(taxYear, 'Zug', c).simpleIncome.amount).toBe(562_450);
    expect(c.estv.IncomeSimpleTaxCanton).toBe(5_625);
  });

  // The calculator's grid has only whole thousands of wealth, so this is by hand
  // (zg-2026-tariff-grundtarif p. 1, Vermögenssteuer: 107.95 at 254,000, 323.85 at 508,000, then
  // 0.1275 %): 508,999 counts as 508,000 (Verordnung § 43): 323.85; 509,000: 323.85 + 1.275 =
  // 325.125, to the centime 325.13.
  it('reads the wealth tariff at whole CHF 1,000 (Verordnung § 43)', () => {
    const wealthTax = (wealth: number) =>
      engine(taxYear, 'Zug', { household: 'single', income: 0, wealth, estv: {} as Estv })
        .simpleWealth.amount;
    expect(wealthTax(508_000)).toBe(32_385);
    expect(wealthTax(508_999)).toBe(32_385);
    expect(wealthTax(509_000)).toBe(32_513);
  });
});
