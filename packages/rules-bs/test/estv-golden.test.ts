// Basel-Stadt against the Federal Tax Administration's own calculator (SPEC.md section 13, item 2):
// test/golden/estv/bs-<year>.json holds what swisstaxcalculator.estv.admin.ch holds and computes,
// recorded by scripts/estv-cantons-golden.mjs, a dev tool. Nothing here uses the network.
//
// - `rates`: the canton's share and the communes' Steuerfüsse, on income and on wealth, for the
//   three communes. The canton's table has no federal commune numbers, so each number's commune is
//   found by the name the calculator gives it; every commune of the engine must be found once.
// - `cases`: the taxes of made-up cases in the City of Basel from a taxable income and wealth
//   given as they are: tariffs A and B on income and on wealth. Nothing about the deductions.
//
// The calculator answers in whole francs; the engine works to 5 centimes. A figure matches when it
// is within a franc per figure the calculator rounded. The tariffs agree on every case. Three
// things differ, each pinned below and explained in docs/sources/bs/NOTES.md, "Checked against the
// federal calculator":
// 1. The City of Basel: the calculator splits the tax half canton, half commune; the engine gives
//    all of it to the canton, as the law does (bs-na-law-stg § 2 al. 3, p. 1: "In der Stadt Basel
//    werden keine kommunalen Steuern erhoben"). The same total.
// 2. Wealth with a low yield (StG § 52, p. 21): the calculator always charges the tariff's wealth
//    tax; the engine does not compute a tax above 5 per mille of the taxable wealth, where the
//    reduction may apply and no document gives its method. There the tariffs alone are compared.
// 3. Church tax: the calculator charges 8 % of the income tax and nothing on wealth; the engine
//    computes no church tax (open point).
import { readFileSync } from 'node:fs';
import { ifdParamsFor, ifdTax, Trace, type IfdScale } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  amountSteps,
  assess,
  bsParamsFor,
  BsUnsupported,
  NOTE,
  tariffTax,
  type BsTaxYear,
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
    readFileSync(new URL(`../../../test/golden/estv/bs-${taxYear}.json`, import.meta.url), 'utf8'),
  ) as Golden;

/**
 * The household as the engine takes it: income tariff B for spouses and for a parent living with
 * their child, wealth tariff B for spouses only (StG § 36 al. 1 and 2, § 50 al. 1 and 2). The
 * federal scale and its reductions per child: LIFD art. 36.
 */
const HOUSEHOLDS: Record<
  string,
  { income: 'A' | 'B'; wealth: 'A' | 'B'; church: boolean; ifd: IfdScale; children: number }
> = {
  single: { income: 'A', wealth: 'A', church: false, ifd: 'single', children: 0 },
  married: { income: 'B', wealth: 'B', church: false, ifd: 'married', children: 0 },
  married2: { income: 'B', wealth: 'B', church: false, ifd: 'married', children: 2 },
  single1: { income: 'B', wealth: 'A', church: false, ifd: 'parental', children: 1 },
  singleReformed: { income: 'A', wealth: 'A', church: true, ifd: 'single', children: 0 },
  singleCatholic: { income: 'A', wealth: 'A', church: true, ifd: 'single', children: 0 },
  singleChristCatholic: { income: 'A', wealth: 'A', church: true, ifd: 'single', children: 0 },
  marriedReformed: { income: 'B', wealth: 'B', church: true, ifd: 'married', children: 0 },
};

function engine(taxYear: BsTaxYear, commune: string, c: Case, wealth = c.wealth) {
  const h = HOUSEHOLDS[c.household]!;
  return assess({
    taxYear,
    commune,
    incomeTariff: h.income,
    wealthTariff: h.wealth,
    lowIncomeFamily: h.income === 'B',
    incomeItems: [{ code: '100', person: 'p1', amount: c.income * 100 }],
    wealthItems: [{ code: '800', person: 'p1', amount: wealth * 100 }],
  }).taxes;
}

describe.each([2025, 2026] as const)('the federal calculator, Basel-Stadt %i', (taxYear) => {
  const golden = load(taxYear);
  const P = bsParamsFor(taxYear);

  it('has the canton’s share and the Steuerfuss of every commune', () => {
    const differences: string[] = [];
    expect(golden.rates.map((r) => `${r.bfs} ${r.name}`).sort()).toEqual([
      '2701 Basel',
      '2702 Bettingen',
      '2703 Riehen',
    ]);
    expect(P.communes.value.map((c) => c.name).sort()).toEqual(['Basel', 'Bettingen', 'Riehen']);
    for (const r of golden.rates) {
      const c = P.communes.value.find((x) => x.name === r.name)!;
      const check = (what: string, ours: number, theirs: number) => {
        if (ours !== Math.round(theirs * 100))
          differences.push(
            `${r.name} (BFS ${r.bfs}), ${what}: ${ours / 100} here, ${theirs} there`,
          );
      };
      if (r.name === 'Basel') {
        // Difference 1: half and half there; the canton alone here (StG § 2 al. 3). Together
        // 100 % of the tax by the tariff either way.
        expect(r.income).toMatchObject({ canton: 50, commune: 50 });
        expect(r.wealth).toMatchObject({ canton: 50, commune: 50 });
        expect(c).toMatchObject({
          cantonIncomeShare: 10_000,
          incomeRate: 0,
          cantonWealthShare: 10_000,
          wealthRate: 0,
        });
      } else {
        // Riehen and Bettingen: the canton's share (Steuerschlüssel) and the commune's Steuerfuss
        // (bs-<year>-communal-ansaetze-abzuege p. 1).
        check('canton, income', c.cantonIncomeShare, r.income.canton);
        check('commune, income', c.incomeRate, r.income.commune);
        check('canton, wealth', c.cantonWealthShare, r.wealth.canton);
        check('commune, wealth', c.wealthRate, r.wealth.commune);
      }
      // Difference 3: the calculator's church rates, 8 % of the income tax, nothing on wealth.
      // The engine has no church rate.
      const { reformed, catholic, christCatholic } = r.income;
      expect({ reformed, catholic, christCatholic }).toEqual({
        reformed: 8,
        catholic: 8,
        christCatholic: 8,
      });
      expect(r.wealth).toMatchObject({ reformed: 0, catholic: 0, christCatholic: 0 });
    }
    expect(differences).toEqual([]);
  });

  it('gives the calculator’s taxes in the City of Basel, to the franc', () => {
    expect(golden.capital).toEqual({ bfs: 2701, name: 'Basel' });
    expect(golden.cases.length).toBe(174);
    const steps = amountSteps(taxYear).value;
    const differences: string[] = [];
    let declined = 0;
    for (const c of golden.cases) {
      const h = HOUSEHOLDS[c.household]!;
      const e = c.estv;
      const at = `${c.household}, income ${c.income}, wealth ${c.wealth}`;
      // One franc per figure the calculator rounded.
      const near = (what: string, ours: number, theirs: readonly number[]) => {
        const francs = Math.max(1, theirs.filter((v) => v !== 0).length);
        const sum = theirs.reduce((s, v) => s + v, 0);
        if (Math.abs(ours - sum * 100) >= francs * 100)
          differences.push(`${what}, ${at}: engine ${(ours / 100).toFixed(2)}, calculator ${sum}`);
      };

      // Difference 2: above 5 per mille of the taxable wealth (by the calculator's own figure) the
      // engine declines, with the note on StG § 52; at or below, it computes.
      const above = e.FortuneSimpleTaxCanton * 1_000 > c.wealth * 5;
      let refused = false;
      try {
        engine(taxYear, golden.capital.name, c);
      } catch (err) {
        if (!(err instanceof BsUnsupported)) throw err;
        expect(err.note, at).toEqual(NOTE.lowYield);
        refused = true;
      }
      if (refused !== above) differences.push(`StG § 52, ${at}: declined ${refused}, not ${above}`);
      if (refused) declined++;

      // The income tax: the whole case, or the case without its wealth where the engine declines.
      const x = engine(taxYear, golden.capital.name, c, refused ? 0 : c.wealth);
      near('income tax by the tariff', x.incomeTariffTax.amount, [e.IncomeSimpleTaxCanton]);
      near('income tax by the tariff (commune)', x.incomeTariffTax.amount, [e.IncomeSimpleTaxCity]);
      // Difference 1: canton and commune together.
      near('income tax', x.cantonalIncome.amount + x.communalIncome.amount, [
        e.IncomeTaxCanton,
        e.IncomeTaxCity,
      ]);
      if (x.communalIncome.amount !== 0) differences.push(`communal tax in Basel, ${at}`);
      if (Math.abs(e.IncomeTaxCanton - e.IncomeTaxCity) > 1)
        differences.push(`not half and half there, ${at}`);

      // The wealth tax: by the tariff alone where the engine declines.
      const wealthTariff = refused
        ? tariffTax(P.wealth[h.wealth].value, c.wealth * 100, steps.wealth)
        : x.wealthTariffTax.amount;
      near('wealth tax by the tariff', wealthTariff, [e.FortuneSimpleTaxCanton]);
      near('wealth tax by the tariff (commune)', wealthTariff, [e.FortuneSimpleTaxCity]);
      if (!refused) {
        near('wealth tax', x.cantonalWealth.amount + x.communalWealth.amount, [
          e.FortuneTaxCanton,
          e.FortuneTaxCity,
        ]);
        near('total', x.total.amount, [
          e.IncomeTaxCanton,
          e.IncomeTaxCity,
          e.FortuneTaxCanton,
          e.FortuneTaxCity,
        ]);
      } else {
        near('wealth tax (tariff)', wealthTariff, [e.FortuneTaxCanton, e.FortuneTaxCity]);
      }

      // Difference 3: 8 % of the income tax by the tariff there for a church member, nothing on
      // wealth; no church tax here (the engine's result has no such line).
      const church = h.church ? (x.incomeTariffTax.amount * 8) / 100 : 0;
      near('the calculator’s church tax, 8 % of the income tax', church, [e.IncomeTaxChurch]);
      if (e.FortuneTaxChurch !== 0) differences.push(`church tax on wealth there, ${at}`);
      // Basel-Stadt has no personal tax.
      if (e.PersonalTax !== 0) differences.push(`personal tax, ${at}: ${e.PersonalTax} there`);
    }
    expect(differences).toEqual([]);
    // Tariff A from a taxable wealth of 500,000 (2,750 against 2,500), tariff B from 800,000
    // (4,400 against 4,000): 8 + 7 cases of the wealth grid and the three single church members.
    expect(declined).toBe(18);
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
