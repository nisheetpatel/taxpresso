// The engine against the Geneva tax administration's own estimator (SPEC.md section 13, item 2):
// test/golden/afc/ge-<year>.json holds what the AFC's "Simulation fiscale"
// (ge.ch/afcaelp1dmapublic/<year>) computed for a fixed grid of made-up cases, to 5 centimes, with
// every line of the bill, recorded by scripts/ge-afc-golden.mjs, a dev tool. Nothing here uses the
// network.
//
// Each case is a salary as the only income, no deduction entered, and a wealth without property.
// Two things are checked.
//
// 1. From the estimator's own taxable income and wealth, every line of the engine's tax is the
//    estimator's, to the centime: the base taxes (the year's scales, full and partial splitting),
//    the cantonal centimes, the home care centime, the privileged share and the centimes of each
//    of the 45 communes, the supplementary tax on wealth, the taxe personnelle, the total and the
//    federal tax. The estimator shows the 12 % reduction on two lines, each rounded (on the base
//    tax, on the cantonal centimes), where the tariff takes it once on their sum
//    (ge-2025-icc-tariff-pdf p. 4): the two can differ by 5 centimes, so the reduction, the
//    cantonal total and the ICC total are compared within 5 centimes.
//
// 2. What the estimator takes off before the tax is what the engine's constants say: the family
//    charges on income (LIPP art. 39), the social deduction on wealth (art. 58), and for the
//    federal tax the deduction per child and the one for married couples.
//
// Where the estimator and the documents part, the documents win (docs/sources/ge/NOTES.md,
// "The AFC's estimator"), and the test says so where it happens. The one that changes a figure:
// with splitting, the estimator drops the fraction of the rate income (50 % or 55.56 % of the
// income), where the tariff's own worked example rounds it to the franc: "86'949 ... 55.56% de ce
// dernier, soit à CHF 48'309" (ge-2025-icc-tariff-pdf p. 4, example 4; 86,949 x 55.56 % is
// 48,308.86), base tax 5,652.25. The estimator gives 5,652.10 for that very case. The engine
// follows the example. So where the fraction is a half franc or more, the estimator's base tax is
// checked against the scale read one franc lower, and the lines that follow from it are left out.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assess, bracketTax, paramsFor, type CommuneSlug, type TaxYear } from '../src/index.js';

type Household = 'single' | 'married' | 'married2' | 'married1older' | 'single1' | 'shared1';
interface Communal {
  privilegedBase: number;
  ratePercent: string;
  privileged: number;
  restBase: number;
  rest: number;
  total: number;
}
interface Afc {
  iccTotal: number;
  ifdTotal: number;
  iccIncome: number;
  iccWealth: number;
  ifdIncome: number;
  income: {
    base: number;
    reductionOnBase: number;
    cantonalCentimes: number;
    homeCare: number;
    reductionOnCentimes: number;
    cantonal: number;
    communal: Communal;
  };
  wealth: {
    base: number;
    cantonalCentimes: number;
    homeCare: number;
    supplementary: number;
    cantonal: number;
    communal: Communal;
  };
  personalTax: number;
}
interface Case {
  household: Household;
  commune: CommuneSlug;
  income: number;
  wealth: number;
  afc: Afc;
}

const load = (taxYear: TaxYear) =>
  (
    JSON.parse(
      readFileSync(new URL(`../../../test/golden/afc/ge-${taxYear}.json`, import.meta.url), 'utf8'),
    ) as { cases: Case[] }
  ).cases;

/**
 * The household as the engine takes it. `charges` counts the family charges (a child in shared
 * custody is half of one); the federal scale of the parent in shared custody is the estimator's
 * (the ordinary one, without the reduction per child).
 */
const HOUSEHOLDS = {
  single: { couple: false, splitting: 'none', ifdScale: 'single', children: 0, charges: 0 },
  married: { couple: true, splitting: 'full', ifdScale: 'married', children: 0, charges: 0 },
  married2: { couple: true, splitting: 'full', ifdScale: 'married', children: 2, charges: 2 },
  married1older: { couple: true, splitting: 'full', ifdScale: 'married', children: 1, charges: 1 },
  single1: { couple: false, splitting: 'full', ifdScale: 'parental', children: 1, charges: 1 },
  shared1: { couple: false, splitting: 'partial', ifdScale: 'single', children: 0, charges: 0.5 },
} as const;

function engine(taxYear: TaxYear, c: Case) {
  const h = HOUSEHOLDS[c.household];
  return assess({
    taxYear,
    commune: c.commune,
    couple: h.couple,
    splitting: h.splitting,
    ifdScale: h.ifdScale,
    ifdChildReductions: h.children,
    wealthCharges: h.charges,
    singleWithChildren: !h.couple && h.charges > 0,
    // The estimator's own taxable income and wealth, as given.
    iccItems: [{ code: '11.10', person: 'p1', amount: c.afc.iccIncome }],
    ifdItems: [{ code: '11.10', person: 'p1', amount: c.afc.ifdIncome }],
    wealthItems: [
      { code: '14.00', person: 'p1', amount: c.afc.iccWealth },
      { code: '51.50', person: 'household', amount: 0 },
    ],
  });
}

const name = (c: Case) => `${c.household}, ${c.commune}, income ${c.income}, wealth ${c.wealth}`;

/** Share of the income the rate is read at, per 10,000 (LIPP art. 41 al. 2 to 4). */
const SHARE = { none: 10_000, full: 5_000, partial: 5_556 } as const;
/** The rate income in centimes times 10,000, before any rounding. */
const rateIncomeExact = (c: Case) => c.afc.iccIncome * SHARE[HOUSEHOLDS[c.household].splitting];
/** True where the estimator drops half a franc or more of the rate income, and the engine doesn't. */
const estimatorDropsAFranc = (c: Case) => rateIncomeExact(c) % 1_000_000 >= 500_000;

describe.each([2025, 2026] as const)('the AFC’s estimator, Geneva %i', (taxYear) => {
  const cases = load(taxYear);
  const P = paramsFor(taxYear);

  it('covers every commune, every household and every step of the year’s scales', () => {
    expect(cases.length).toBeGreaterThanOrEqual(200);
    expect(new Set(cases.map((c) => c.commune)).size).toBe(45);
    expect(new Set(cases.map((c) => c.household)).size).toBe(6);
    const incomes = new Set(cases.filter((c) => c.household === 'single').map((c) => c.income));
    for (const [upper] of P.icc.incomeScale.value.brackets)
      if (Number.isFinite(upper)) {
        expect(incomes, `income step ${upper}`).toContain(upper);
        expect(incomes, `income step ${upper} + 1`).toContain(upper + 1);
      }
    // Wealth is entered before its social deduction: a case lies in each bracket of both scales.
    const taxable = cases.map((c) => c.afc.iccWealth / 100).filter((w) => w > 0);
    for (const scale of [P.icc.wealthScale, P.icc.wealthSupplementaryScale]) {
      let lower = 0;
      for (const [upper] of scale.value.brackets) {
        expect(
          taxable.some((w) => w > lower && w <= upper),
          `a taxable wealth between ${lower} and ${upper}`,
        ).toBe(true);
        lower = upper;
      }
    }
  });

  /** Every figure that differs, so a failure lists them all. */
  const differences = (
    check: (c: Case, same: (got: number, want: number, what: string) => void) => void,
  ) => {
    const out: string[] = [];
    for (const c of cases.filter((x) => !estimatorDropsAFranc(x)))
      check(c, (got, want, what) => {
        if (got !== want) out.push(`${what}, ${name(c)}: engine ${got}, estimator ${want}`);
      });
    return out;
  };
  /** The estimator's two reduction lines against the engine's one: 0 or 5 centimes either way. */
  const reductionGap = (c: Case) =>
    engine(taxYear, c).icc.taxes.incomeReduction12.amount -
    (c.afc.income.reductionOnBase + c.afc.income.reductionOnCentimes);

  it('gives every line of the estimator’s income tax, to the centime', () => {
    expect(
      differences((c, same) => {
        const x = engine(taxYear, c).icc.taxes;
        const a = c.afc.income;
        same(x.incomeBase.amount, a.base, 'base tax');
        same(x.incomeCantonalCentimes.amount, a.cantonalCentimes, 'cantonal centimes');
        same(x.incomeHomeCare.amount, a.homeCare, 'home care');
        // One reduction on the sum, or one on each line: at most 5 centimes apart.
        const gap = reductionGap(c);
        same(Math.abs(gap) <= 5 ? 0 : gap, 0, 'reduction');
        same(x.incomeCantonal.amount, a.cantonal + gap, 'cantonal income tax');
      }),
    ).toEqual([]);
  });

  it('rounds the rate income to the franc as the tariff’s example does, where the estimator drops the fraction', () => {
    const scale = P.icc.incomeScale.value;
    const dropped = cases.filter(estimatorDropsAFranc);
    expect(dropped.length).toBeGreaterThan(0);
    for (const c of dropped) {
      const taxable = c.afc.iccIncome;
      // The estimator's base tax: the scale read at the rate income without its fraction.
      const lower = Math.floor(rateIncomeExact(c) / 1_000_000) * 100;
      const estimator = Math.round((taxable * bracketTax(scale, lower)) / lower / 5) * 5;
      expect(c.afc.income.base, `the estimator: ${name(c)}`).toBe(estimator);
      // The engine's: one franc higher, as in the tariff's example 4.
      const r = engine(taxYear, c).icc;
      expect(r.rateIncome.amount, name(c)).toBe(lower + 100);
      expect(r.taxes.incomeBase.amount, name(c)).toBe(
        Math.round((taxable * bracketTax(scale, lower + 100)) / (lower + 100) / 5) * 5,
      );
      expect(r.taxes.incomeBase.amount - estimator, name(c)).toBeLessThanOrEqual(25);
      expect(r.taxes.incomeBase.amount - estimator, name(c)).toBeGreaterThanOrEqual(0);
      // The wealth tax and the federal tax don't depend on it.
      expect(r.taxes.wealthBase.amount, name(c)).toBe(c.afc.wealth.base);
      expect(engine(taxYear, c).ifd.tax.amount, name(c)).toBe(c.afc.ifdTotal);
    }
  });

  it('rounds the 12 % reduction once, where the estimator rounds it twice: never more than 5 centimes', () => {
    const gaps = cases.map(reductionGap);
    expect(gaps.every((g) => g === 0 || Math.abs(g) === 5)).toBe(true);
    // Most cases agree to the centime.
    expect(gaps.filter((g) => g === 0).length).toBeGreaterThan(cases.length / 2);
  });

  it('gives every line of the estimator’s wealth tax, to the centime', () => {
    expect(
      differences((c, same) => {
        const x = engine(taxYear, c).icc.taxes;
        const a = c.afc.wealth;
        same(x.wealthBase.amount, a.base, 'base tax');
        same(x.wealthCantonalCentimes.amount, a.cantonalCentimes, 'cantonal centimes');
        same(x.wealthHomeCare.amount, a.homeCare, 'home care');
        same(x.wealthSupplementary.amount, a.supplementary, 'supplementary tax');
        same(x.wealthCantonal.amount, a.cantonal, 'cantonal wealth tax');
      }),
    ).toEqual([]);
  });

  it('splits the communal tax as the estimator does, in each of the 45 communes', () => {
    const shares = P.communes.privilegedShare.value;
    const centimes = P.communes.centimes.value;
    const rates: string[] = [];
    expect(
      differences((c, same) => {
        const x = engine(taxYear, c).icc.taxes;
        for (const [what, ours, theirs, total] of [
          ['income', x.communalIncome, c.afc.income.communal, x.communalIncomeTotal],
          ['wealth', x.communalWealth, c.afc.wealth.communal, x.communalWealthTotal],
        ] as const) {
          // The commune's centimes as the estimator prints them ("45,490 %"), when there is a tax.
          const printed = `${(centimes[c.commune] / 100).toFixed(3).replace('.', ',')} %`;
          if (theirs.total > 0 && theirs.ratePercent !== printed)
            rates.push(`${c.commune}: ${theirs.ratePercent} instead of ${printed}`);
          same(
            ours.privileged.sharePercent,
            shares[c.commune],
            `${what}, privileged share in percent`,
          );
          same(total.amount, theirs.total, `${what}, communal tax`);
          // Under a franc of base tax there is no communal tax, and the estimator shows no split.
          if (theirs.total === 0) continue;
          same(ours.privileged.base.amount, theirs.privilegedBase, `${what}, privileged base`);
          same(ours.privileged.tax.amount, theirs.privileged, `${what}, privileged share`);
          same(
            ours.rest.reduce((sum, r) => sum + r.base.amount, 0),
            theirs.restBase,
            `${what}, rest base`,
          );
          same(
            ours.rest.reduce((sum, r) => sum + r.tax.amount, 0),
            theirs.rest,
            `${what}, rest`,
          );
          same(
            ours.rest.length <= 1 ? 1 : ours.rest.length,
            1,
            `${what}, one commune for the rest`,
          );
        }
      }),
    ).toEqual([]);
    expect(rates).toEqual([]);
  });

  // The estimator always counts the taxe personnelle. The law exempts a taxpayer without wealth
  // whose income is at most 3,400 francs, 5,000 with full splitting, 4,500 with partial splitting
  // (ge-na-law-lcp art. 377 let. c): there the engine follows the law.
  it('gives the estimator’s taxe personnelle (but for the law’s exemption), ICC total and federal tax', () => {
    const limits = P.personalTax.value.exemptUpTo;
    let exempted = 0;
    expect(
      differences((c, same) => {
        const r = engine(taxYear, c);
        const exempt =
          c.afc.iccWealth === 0 && c.afc.iccIncome <= limits[HOUSEHOLDS[c.household].splitting];
        if (exempt) exempted++;
        same(c.afc.personalTax, 2_500, 'the estimator’s taxe personnelle, always');
        same(r.icc.taxes.personalTax.amount, exempt ? 0 : 2_500, 'taxe personnelle');
        same(
          r.icc.taxes.total.amount,
          c.afc.iccTotal + reductionGap(c) - (exempt ? 2_500 : 0),
          'cantonal and communal tax',
        );
        same(r.ifd.tax.amount, c.afc.ifdTotal, 'federal tax');
      }),
    ).toEqual([]);
    expect(exempted).toBeGreaterThan(0);
  });

  it('takes off the family charges and the deduction on wealth of the year’s constants', () => {
    const charge = P.icc.familyCharge.value;
    const ws = P.icc.wealthSocial.value;
    for (const c of cases) {
      const h = HOUSEHOLDS[c.household];
      const at = name(c);
      // Income: one full charge per child, a half charge in shared custody (LIPP art. 39 al. 1).
      const charges = Math.floor(h.charges) * charge.full + (h.charges % 1 ? charge.half : 0);
      expect(c.afc.iccIncome, `taxable income: ${at}`).toBe(Math.max(0, c.income * 100 - charges));
      // Wealth: LIPP art. 58 al. 1. The estimator counts a child in shared custody as a whole
      // charge here; the engine counts half (NOTE.sharedCharges), which no document settles
      // (docs/sources/ge/NOTES.md): the estimator's figure is the engine's with a whole charge.
      const perCharge = Math.ceil(h.charges) * ws.perCharge;
      const base = h.couple || h.charges > 0 ? ws.couple : ws.single;
      expect(c.afc.iccWealth, `taxable wealth: ${at}`).toBe(
        Math.max(0, c.wealth * 100 - base - perCharge),
      );
    }
  });

  it('takes off the federal deductions for children and for a married couple', () => {
    const F = P.ifd;
    for (const c of cases) {
      const h = HOUSEHOLDS[c.household];
      const off = c.income * 100 - c.afc.ifdIncome;
      const perChild =
        Math.floor(h.charges) * F.child.value + (h.charges % 1 ? F.child.value / 2 : 0);
      if (h.couple || h.charges === 0) {
        expect(off, name(c)).toBe(
          Math.min(c.income * 100, perChild + (h.couple ? F.married.value : 0)),
        );
      } else {
        // A parent alone: the estimator also takes off the deduction for married couples, which
        // the law gives to "les couples mariés vivant en ménage commun" only (ch-na-law-lifd
        // art. 35 al. 1 let. c). The engine follows the law; this only records what the estimator does.
        expect(off, name(c)).toBe(Math.min(c.income * 100, perChild + F.married.value));
      }
    }
  });
});
