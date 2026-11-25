// Basel-Landschaft against the Federal Tax Administration's own calculator (SPEC.md section 13,
// item 2): test/golden/estv/bl-<year>.json holds what swisstaxcalculator.estv.admin.ch holds and
// computes, recorded by scripts/estv-cantons-golden.mjs, a dev tool. Nothing here uses the network.
//
// - `rates`: the Steuerfuss of each of the 86 communes and the three churches' rates. The canton's
//   table has no federal commune numbers, so each number's commune is found by the name the
//   calculator gives it; every commune of the engine must be found exactly once.
// - `cases`: the taxes of made-up cases in Liestal from a taxable income and wealth given as they
//   are: the Einheitstarif with and without Vollsplitting, the child reduction off the tax (the
//   calculator applies it too), the wealth tariff, the Steuerfuss and the Roman Catholic church
//   tax. Nothing about the deductions.
//
// The calculator answers in whole francs; the engine works to 5 centimes. A figure matches when it
// is within a franc per figure the calculator rounded. What differs is pinned below and explained
// in docs/sources/bl/NOTES.md, "Checked against the federal calculator":
// 1. 2025, a single person above the top Eckwert (CHF 1,281,587): the calculator is CHF 3,088.95
//    above the formula of the law and its rules of application (bl-na-steuergesetz-331 § 34 Abs.
//    1, p. 27; bl-na-tariff-anwendungsregeln Ziffer 4). With Vollsplitting, and in 2026, it agrees.
// 2. Church rates of 2025: the calculator holds them; the canton's table prints the rates of 2026
//    only, so the engine has none for 2025 (open point).
// 3. The Evangelical Reformed and Christian Catholic church tax: the calculator charges the rate
//    on the taxable income and wealth; the engine computes the Roman Catholic church tax only
//    (open point). The Reformed rate on wealth has a third decimal in the calculator where the
//    canton's table prints two.
import { readFileSync } from 'node:fs';
import { ifdParamsFor, ifdTax, Trace, type IfdScale } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import { assess, blParamsFor, foldName, type BlTaxYear } from '../src/index.js';

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
    readFileSync(new URL(`../../../test/golden/estv/bl-${taxYear}.json`, import.meta.url), 'utf8'),
  ) as Golden;

/**
 * The calculator's name of a commune as the canton's table prints it: without the federal
 * register's "(BL)", and Burg im Leimental as "Burg i.L." (bl-2026-communal-steuerfuesse).
 */
const tableName = (name: string) =>
  name === 'Burg im Leimental' ? 'Burg i.L.' : name.replace(/ \(BL\)$/, '');

type Church = 'reformed' | 'catholic' | 'christCatholic';
/**
 * The household as the engine takes it: Vollsplitting for a married couple and for a parent
 * living with their child, and CHF 750 off the tax per child (StG § 34 Abs. 2 and 4). The federal
 * scale and its reductions per child: LIFD art. 36.
 */
const HOUSEHOLDS: Record<
  string,
  { splitting: boolean; children: number; church?: Church; ifd: IfdScale }
> = {
  single: { splitting: false, children: 0, ifd: 'single' },
  married: { splitting: true, children: 0, ifd: 'married' },
  married2: { splitting: true, children: 2, ifd: 'married' },
  single1: { splitting: true, children: 1, ifd: 'parental' },
  singleReformed: { splitting: false, children: 0, church: 'reformed', ifd: 'single' },
  singleCatholic: { splitting: false, children: 0, church: 'catholic', ifd: 'single' },
  singleChristCatholic: { splitting: false, children: 0, church: 'christCatholic', ifd: 'single' },
  marriedReformed: { splitting: true, children: 0, church: 'reformed', ifd: 'married' },
};

/**
 * Difference 1, by hand (bl-2025-tariff-tariftabelle, sheet Tarif: b3 0.051162, c3 0.010441, D3
 * -4,888.819148, top Eckwert 1,281,587, maximum rate 18.62 %): the tax at the top Eckwert is
 * 0.051162 x 1,281,587 + 0.010441 x 1,281,587 x (ln 1,281,587 - 1) - 4,888.819148 = 235,484.55,
 * and above it the tax is that amount plus 18.62 % of the income above the Eckwert
 * (Anwendungsregeln Ziffer 4): 369,253.05 at 2,000,000 (133,768.50 more) and 927,853.05 at
 * 5,000,000 (692,368.50 more). The calculator gives 372,342 and 930,942: 3,088.95 more on both.
 */
const ABOVE_TOP_2025 = {
  eckwert: 1_281_587,
  engine: { 2_000_000: 36_925_305, 5_000_000: 92_785_305 } as Record<number, number>,
  calculator: { 2_000_000: 372_342, 5_000_000: 930_942 } as Record<number, number>,
  /** What the calculator has more, in centimes of the state tax on income. */
  more: 308_895,
};

function engine(taxYear: BlTaxYear, capital: string, c: Case) {
  const P = blParamsFor(taxYear);
  const h = HOUSEHOLDS[c.household]!;
  const commune = P.communes.value.find((x) => x.name === capital)!;
  return assess({
    taxYear,
    commune: capital,
    splitting: h.splitting,
    children: h.children,
    // The engine computes the Roman Catholic church tax only, and only with the year's rate.
    churchRate: h.church === 'catholic' ? (commune.church?.catholic ?? null) : null,
    incomeItems: [{ code: '100', person: 'p1', amount: c.income * 100 }],
    wealthItems: [{ code: '800', person: 'p1', amount: c.wealth * 100 }],
  }).taxes;
}

describe.each([2025, 2026] as const)('the federal calculator, Basel-Landschaft %i', (taxYear) => {
  const golden = load(taxYear);
  const P = blParamsFor(taxYear);

  it('has the Steuerfuss of every commune', () => {
    const differences: string[] = [];
    const found = new Set<string>();
    expect(golden.rates.length).toBe(86);
    expect(new Set(golden.rates.map((r) => r.bfs)).size).toBe(86);
    for (const r of golden.rates) {
      const c = P.communes.value.find((x) => foldName(x.name) === foldName(tableName(r.name)));
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
      // The canton's multiplier on the income tax (Steuerfussdekret); none on the wealth tax.
      check('canton, income', P.multiplier.value, r.income.canton);
      check('canton, wealth', 10_000, r.wealth.canton);
      // One Steuerfuss for income and wealth (StG § 19 Abs. 2).
      check('commune, income', c.rate, r.income.commune);
      check('commune, wealth', c.rate, r.wealth.commune);
    }
    expect(differences).toEqual([]);
    expect(found.size).toBe(P.communes.value.length);
  });

  it('has the churches’ rates of 2026, and none for 2025 (open point)', () => {
    const differences: string[] = [];
    let finer = 0;
    for (const r of golden.rates) {
      const c = P.communes.value.find((x) => foldName(x.name) === foldName(tableName(r.name)))!;
      if (taxYear === 2025) {
        // Difference 2: the canton's table prints the church rates of 2026 only.
        if (c.church !== null) differences.push(`${r.name}: church rates for 2025 here`);
        continue;
      }
      const ch = c.church!;
      const check = (what: string, ours: number, theirs: number) => {
        if (ours !== Math.round(theirs * 100))
          differences.push(
            `${r.name} (BFS ${r.bfs}), ${what}: ${ours / 100} here, ${theirs} there`,
          );
      };
      // Roman Catholic: in percent of the state tax, on income and on wealth (footnote 2).
      check('catholic, income', ch.catholic, r.income.catholic);
      check('catholic, wealth', ch.catholic, r.wealth.catholic);
      // Reformed and Christian Catholic: in percent of the taxable income (footnote 3); on wealth
      // the calculator holds per mille, the table percent to two decimals.
      check('reformed, income', ch.reformed.income, r.income.reformed);
      check('christ catholic, income', ch.christCatholic.income, r.income.christCatholic);
      check('christ catholic, wealth', ch.christCatholic.wealth, r.wealth.christCatholic / 10);
      // Difference 3: the Reformed rate on wealth to a third decimal there (0.53 per mille, the
      // table 0,05 %); the table's figure is the calculator's rounded, halves up.
      const hundredths = r.wealth.reformed * 10;
      if (Math.abs(hundredths - Math.round(hundredths)) > 1e-6) finer++;
      if (ch.reformed.wealth !== Math.floor(hundredths + 0.5 + 1e-6))
        differences.push(
          `${r.name} (BFS ${r.bfs}), reformed, wealth: ${ch.reformed.wealth / 100} % here, ${r.wealth.reformed} per mille there`,
        );
    }
    expect(differences).toEqual([]);
    // 23 communes, from Arlesheim (0.53 per mille there, 0,05 % in the table) to Zunzgen (0.63).
    expect(finer).toBe(taxYear === 2026 ? 23 : 0);
  });

  it('gives the calculator’s taxes in Liestal, to the franc', () => {
    expect(golden.capital).toEqual({ bfs: 2829, name: 'Liestal' });
    expect(golden.cases.length).toBe(174);
    const liestal = golden.rates.find((r) => r.bfs === golden.capital.bfs)!;
    const differences: string[] = [];
    let aboveTop = 0;
    for (const c of golden.cases) {
      const h = HOUSEHOLDS[c.household]!;
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

      // Difference 1: 2025, no Vollsplitting, above the top Eckwert.
      const slip = taxYear === 2025 && !h.splitting && c.income > ABOVE_TOP_2025.eckwert;
      const more = slip ? ABOVE_TOP_2025.more : 0;
      if (slip) {
        aboveTop++;
        expect(x.normalIncome.amount, at).toBe(ABOVE_TOP_2025.engine[c.income]);
        expect(e.IncomeSimpleTaxCanton, at).toBe(ABOVE_TOP_2025.calculator[c.income]);
      }
      // The state tax on income, after the child reduction (the calculator's simple tax has it).
      near('normal state tax on income', x.normalIncome.amount + more, [e.IncomeSimpleTaxCanton]);
      near('normal state tax (commune)', x.normalIncome.amount + more, [e.IncomeSimpleTaxCity]);
      near('state tax on income', x.cantonalIncome.amount + more, [e.IncomeTaxCanton]);
      const communalMore = Math.round((more * liestal.income.commune) / 100);
      near('communal tax on income', x.communalIncome.amount + communalMore, [e.IncomeTaxCity]);
      near('state tax on wealth', x.cantonalWealth.amount, [e.FortuneSimpleTaxCanton]);
      near('state tax on wealth (commune)', x.cantonalWealth.amount, [e.FortuneSimpleTaxCity]);
      near('state tax on wealth, levied', x.cantonalWealth.amount, [e.FortuneTaxCanton]);
      near('communal tax on wealth', x.communalWealth.amount, [e.FortuneTaxCity]);

      // The church tax.
      const church = [e.IncomeTaxChurch, e.FortuneTaxChurch];
      if (!h.church) {
        near('church tax', x.church?.amount ?? 0, church);
      } else if (h.church === 'catholic') {
        // In percent of the state tax on income and on wealth, the calculator's own rate.
        const state = x.cantonalIncome.amount + x.cantonalWealth.amount;
        near(
          'the calculator’s Catholic church tax',
          (state * liestal.income.catholic) / 100,
          church,
        );
        // 2026: the engine's church tax, with the table's rate. 2025: none (difference 2).
        if (taxYear === 2026) near('Roman Catholic church tax', x.church!.amount, church);
        else if (x.church !== null) differences.push(`a church tax for 2025, ${at}`);
      } else {
        // Difference 3: the rate on the taxable income (percent) and wealth (per mille) there; no
        // such church tax here.
        near('the calculator’s church tax on income', c.income * liestal.income[h.church], [
          e.IncomeTaxChurch,
        ]);
        near('the calculator’s church tax on wealth', (c.wealth * liestal.wealth[h.church]) / 10, [
          e.FortuneTaxChurch,
        ]);
        if (x.church !== null) differences.push(`a Reformed or Christian Catholic tax, ${at}`);
      }
      // Basel-Landschaft has no personal tax.
      if (e.PersonalTax !== 0) differences.push(`personal tax, ${at}: ${e.PersonalTax} there`);
    }
    expect(differences).toEqual([]);
    // The single person at 2,000,000 and at 5,000,000; the church members' incomes are lower.
    expect(aboveTop).toBe(taxYear === 2025 ? 2 : 0);
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
