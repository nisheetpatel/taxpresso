// The engine against the Federal Tax Administration's own calculator (SPEC.md section 13, item 2):
// test/golden/estv/ge-<year>.json holds what swisstaxcalculator.estv.admin.ch computed for a fixed
// grid of made-up Geneva cases (every step of the scales, four households, every commune), recorded
// by scripts/estv-golden.mjs, a dev tool. Nothing here uses the network.
//
// The calculator takes the taxable income of each tax and the taxable wealth as given, so this
// checks everything after them: the income scale and the splitting, the cantonal centimes, the
// 12 % reduction, the home care centime, the wealth scales, the communal centimes of each of the
// 45 communes, the taxe personnelle and the federal scales with the reduction per child. It says
// nothing about the deductions.
//
// The calculator answers in whole francs; the engine works to 5 centimes, as the tariff does
// (ge-2025-icc-tariff-pdf p. 2 to 6). A figure matches when it is the calculator's franc, rounded
// either way: less than one franc apart.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assess, paramsFor, type CommuneSlug, type TaxYear } from '../src/index.js';

type Household = 'single' | 'married' | 'married2' | 'single1';
interface Estv {
  IncomeSimpleTaxCanton: number;
  IncomeTaxCanton: number;
  IncomeTaxCity: number;
  FortuneSimpleTaxCanton: number;
  FortuneTaxCanton: number;
  FortuneTaxCity: number;
  PersonalTax: number;
  IncomeTaxFed: number;
  TotalTax: number;
}
interface Case {
  commune: CommuneSlug;
  household: Household;
  income: number;
  wealth: number;
  estv: Estv;
}

const load = (taxYear: TaxYear) =>
  (
    JSON.parse(
      readFileSync(
        new URL(`../../../test/golden/estv/ge-${taxYear}.json`, import.meta.url),
        'utf8',
      ),
    ) as { cases: Case[] }
  ).cases;

/** The household as the engine takes it (LIPP art. 41; LIFD art. 36). */
const HOUSEHOLDS = {
  single: { couple: false, splitting: 'none', ifdScale: 'single', children: 0 },
  married: { couple: true, splitting: 'full', ifdScale: 'married', children: 0 },
  married2: { couple: true, splitting: 'full', ifdScale: 'married', children: 2 },
  single1: { couple: false, splitting: 'full', ifdScale: 'parental', children: 1 },
} as const;

function engine(taxYear: TaxYear, c: Case) {
  const h = HOUSEHOLDS[c.household];
  const a = assess({
    taxYear,
    commune: c.commune,
    couple: h.couple,
    splitting: h.splitting,
    ifdScale: h.ifdScale,
    ifdChildReductions: h.children,
    wealthCharges: h.children,
    singleWithChildren: c.household === 'single1',
    iccItems: [{ code: '11.10', person: 'p1', amount: c.income * 100 }],
    ifdItems: [{ code: '11.10', person: 'p1', amount: c.income * 100 }],
    // The taxable wealth as given: an asset, and a social deduction (51.50) of nothing.
    wealthItems: [
      { code: '14.00', person: 'p1', amount: c.wealth * 100 },
      { code: '51.50', person: 'household', amount: 0 },
    ],
  });
  const x = a.icc.taxes;
  return {
    taxableIncome: a.icc.taxableIncome.amount,
    taxableWealth: a.icc.wealth.taxableWealth.amount,
    IncomeSimpleTaxCanton: x.incomeBase.amount,
    IncomeTaxCanton: x.incomeCantonal.amount,
    IncomeTaxCity: x.communalIncomeTotal.amount,
    FortuneSimpleTaxCanton: x.wealthBase.amount,
    FortuneTaxCanton: x.wealthCantonal.amount,
    FortuneTaxCity: x.communalWealthTotal.amount,
    PersonalTax: x.personalTax.amount,
    IncomeTaxFed: a.ifd.tax.amount,
  };
}

const FIELDS = [
  'IncomeSimpleTaxCanton',
  'IncomeTaxCanton',
  'IncomeTaxCity',
  'FortuneSimpleTaxCanton',
  'FortuneTaxCanton',
  'FortuneTaxCity',
  'IncomeTaxFed',
] as const;

describe.each([2025, 2026] as const)('the federal calculator, Geneva %i', (taxYear) => {
  const cases = load(taxYear);

  it('covers every commune, every household and every step of the year’s scales', () => {
    expect(cases.length).toBeGreaterThanOrEqual(500);
    expect(new Set(cases.map((c) => c.commune)).size).toBe(45);
    expect(new Set(cases.map((c) => c.household)).size).toBe(4);
    const P = paramsFor(taxYear).icc;
    const incomes = new Set(cases.map((c) => c.income));
    for (const [upper] of P.incomeScale.value.brackets)
      if (Number.isFinite(upper)) expect(incomes, `income step ${upper}`).toContain(upper);
    const wealth = new Set(cases.map((c) => c.wealth));
    for (const scale of [P.wealthScale, P.wealthSupplementaryScale])
      for (const [upper] of scale.value.brackets)
        if (Number.isFinite(upper)) expect(wealth, `wealth step ${upper}`).toContain(upper);
  });

  it('gives the calculator’s figure, to the franc, on every case', () => {
    const differences: string[] = [];
    for (const c of cases) {
      const e = engine(taxYear, c);
      expect(e.taxableIncome).toBe(c.income * 100);
      expect(e.taxableWealth).toBe(c.wealth * 100);
      for (const f of FIELDS) {
        const diff = e[f] - c.estv[f] * 100;
        if (Math.abs(diff) >= 100)
          differences.push(
            `${f}, ${c.commune} ${c.household} income ${c.income} wealth ${c.wealth}: engine ${(e[f] / 100).toFixed(2)}, calculator ${c.estv[f]}`,
          );
      }
    }
    expect(differences).toEqual([]);
  });

  // The calculator always counts the taxe personnelle. The law exempts a taxpayer without wealth
  // whose income is at most 3,400 francs, 5,000 with full splitting (ge-na-law-lcp art. 377
  // let. c): there the engine follows the law, and the calculator's 25 francs is its own shortcut.
  it('charges the taxe personnelle as the calculator does, but for the law’s exemption', () => {
    const limits = paramsFor(taxYear).personalTax.value.exemptUpTo;
    let exempted = 0;
    for (const c of cases) {
      const e = engine(taxYear, c);
      expect(c.estv.PersonalTax, 'the calculator, always').toBe(25);
      const exempt = c.wealth === 0 && c.income * 100 <= limits[HOUSEHOLDS[c.household].splitting];
      if (exempt) exempted++;
      expect(e.PersonalTax, `${c.household} income ${c.income} wealth ${c.wealth}`).toBe(
        exempt ? 0 : 2_500,
      );
    }
    expect(exempted).toBeGreaterThan(0);
  });

  it('adds up to the calculator’s total, to the franc per tax', () => {
    for (const c of cases) {
      const e = engine(taxYear, c);
      const total =
        e.IncomeTaxCanton +
        e.IncomeTaxCity +
        e.FortuneTaxCanton +
        e.FortuneTaxCity +
        e.IncomeTaxFed +
        c.estv.PersonalTax * 100;
      // Five figures, each within a franc of the calculator's.
      expect(Math.abs(total - c.estv.TotalTax * 100)).toBeLessThan(500);
    }
  });
});
