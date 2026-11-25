// St. Gallen against the Federal Tax Administration's own calculator (SPEC.md section 13, item 2):
// test/golden/estv/sg-<year>.json holds what swisstaxcalculator.estv.admin.ch holds and computes,
// recorded by scripts/estv-cantons-golden.mjs, a dev tool. Nothing here uses the network.
//
// - `rates`: the multipliers of every commune (the Kantonssteuerfuss, the political commune's
//   Gesamtsteuerfuss, the Catholic, Evangelical and Christ Catholic church rates), in percent of
//   the einfache Steuer there (138 is the engine's 13800), compared with the engine's tables. The
//   canton's table carries no federal commune number, so the communes are matched by name.
// - `cases`: the taxes of made-up cases in the City of St. Gallen from a taxable income and wealth
//   given as they are: the tariff (StG Art. 50), Vollsplitting, the wealth tax (Art. 65), the
//   multipliers and the church tax. Nothing about the deductions.
//
// The calculator is evidence, not the authority: where it and the canton's documents differ, the
// documents decide, and the difference is pinned below with the document that decides it, or as
// open where no document does (docs/sources/sg/NOTES.md, "Against the federal calculator").
//
// The calculator answers in whole francs: the exact amount rounded. The engine rounds the einfache
// Steuer and each tax to 5 Rappen, so the two are at most 52 centimes apart. The church tax is
// one line on income and wealth together in the engine, so each case is also run with its income
// alone and with its wealth alone.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assess,
  churchRate,
  communeByName,
  sgParamsFor,
  type ChurchShare,
  type SgCommune,
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
type Church = 'none' | 'reformed' | 'catholic' | 'christ_catholic';

const load = (taxYear: TaxYear) =>
  JSON.parse(
    readFileSync(new URL(`../../../test/golden/estv/sg-${taxYear}.json`, import.meta.url), 'utf8'),
  ) as Golden;

/**
 * The communes the calculator names otherwise than the canton's table of multipliers
 * (sg-<year>-communal-steuerfuesse p. 1 to 4): the federal list adds the canton to names that
 * exist elsewhere in Switzerland.
 */
const NAMES: Record<string, string> = {
  'Berg (SG)': 'Berg',
  'Au (SG)': 'Au',
  'Marbach (SG)': 'Marbach',
  'Oberriet (SG)': 'Oberriet',
  'Rüthi (SG)': 'Rüthi',
  'Buchs (SG)': 'Buchs',
  'Benken (SG)': 'Benken',
  'Eschenbach (SG)': 'Eschenbach',
  'Kirchberg (SG)': 'Kirchberg',
  'Zuzwil (SG)': 'Zuzwil',
  'Wil (SG)': 'Wil',
  'Andwil (SG)': 'Andwil',
  'Gossau (SG)': 'Gossau',
};

/**
 * The household as the engine takes it: Vollsplitting for married couples and for a parent living
 * with their child (Art. 50 Abs. 3 and 4), and one church for the household.
 */
const HOUSEHOLDS: Record<string, { splitting: boolean; church: Church }> = {
  single: { splitting: false, church: 'none' },
  married: { splitting: true, church: 'none' },
  married2: { splitting: true, church: 'none' },
  single1: { splitting: true, church: 'none' },
  singleReformed: { splitting: false, church: 'reformed' },
  singleCatholic: { splitting: false, church: 'catholic' },
  singleChristCatholic: { splitting: false, church: 'christ_catholic' },
  marriedReformed: { splitting: true, church: 'reformed' },
};

/**
 * The church area of the city the cases are run in: the city has three, Centrum and Tablat with
 * 26 % Catholic and 25 % Evangelical, Straubenzell with 26 % and 26 %
 * (sg-<year>-communal-steuerfuesse p. 1); the calculator holds 26 and 25.
 */
const AREA = 'St. Gallen Centrum (C)';

/**
 * Above the top amount, the engine follows the law and the canton's tariff, the calculator
 * differs. "Für steuerbare Einkommen über Fr. 264 200.– beträgt die einfache Steuer für das ganze
 * Einkommen 8,5 Prozent" (sg-2025-law-steuergesetz Art. 50 Abs. 2, p. 26; 264 500 in
 * sg-2026-law-steuergesetz), and the tariff of the year says the same of 528'400 (529'000) with
 * Vollsplitting (sg-<year>-tariff-einkommen-vermoegen p. 1). The calculator takes 8.5 % of the
 * part above the top amount only and adds it to the brackets' tax at the top amount, which is
 * a little more than 8.5 % of it. By hand (Art. 50 Abs. 1):
 * - 2025: 4,200 at 4 % = 168; 18,000 at 6 % = 1,080; 26,400 at 8 % = 2,112; 38,100 at 9.2 % =
 *   3,505.20; 165,900 at 9.4 % = 15,594.60: 22,459.80 at 264,200, where 8.5 % is 22,457.00. The
 *   calculator is 2.80 above the law, 5.60 with Vollsplitting.
 * - 2026: 168; 1,080; 26,500 at 8 % = 2,120; 3,505.20; 166,100 at 9.4 % = 15,613.40: 22,486.60
 *   at 264,500, where 8.5 % is 22,482.50. 4.10 above the law, 8.20 with Vollsplitting.
 * The same cases in both years; the engine's amount is 8.5 % of the income, to the franc.
 */
const TOP_EXCESS: Record<TaxYear, { single: number; splitting: number }> = {
  2025: { single: 280, splitting: 560 },
  2026: { single: 410, splitting: 820 },
};
const top = (household: string, extra: number, ...thousands: number[]) =>
  thousands.map(
    (k) =>
      `${household}, income ${k * 1_000}: engine ${(k * 85).toFixed(2)}, calculator ${k * 85 + extra}`,
  );
const TOP: Record<TaxYear, string[]> = {
  // 2.80 and 5.60 more, rounded to the franc: 3 and 6.
  2025: [
    ...top('single', 3, 300, 400, 500, 750, 1_000, 2_000, 5_000),
    ...top('married', 6, 750, 1_000, 2_000, 5_000),
    ...top('married2', 6, 750, 1_000, 2_000, 5_000),
    ...top('single1', 6, 750, 1_000, 2_000, 5_000),
  ],
  // 4.10 and 8.20 more: 4 and 8.
  2026: [
    ...top('single', 4, 300, 400, 500, 750, 1_000, 2_000, 5_000),
    ...top('married', 8, 750, 1_000, 2_000, 5_000),
    ...top('married2', 8, 750, 1_000, 2_000, 5_000),
    ...top('single1', 8, 750, 1_000, 2_000, 5_000),
  ],
};

/**
 * OPEN: a taxable income that is not a whole hundred francs. The calculator drops the part under
 * CHF 100 before the tariff. No St. Gallen document of the library says so: the law has the rule
 * for wealth only ("Restbeträge des steuerbaren Vermögens unter Fr. 1000.– fallen für die
 * Steuerberechnung ausser Betracht", sg-2025-law-steuergesetz Art. 65 Abs. 2, p. 30) and none in
 * Art. 50 (p. 26); the tariff of the year prints a row for every 100 francs and rounds only the
 * half income of Vollsplitting down to 100 francs (sg-2025-tariff-einkommen-vermoegen p. 1); the
 * ordinance, the guide and the Steuerbuch chapters read say nothing. The engine applies the
 * brackets to the taxable income in whole francs (and, with Vollsplitting, the rate of half of
 * it rounded down to 100 francs to the whole of it), which is higher by the tariff on the part
 * dropped: 9.31 francs of einfache Steuer at most (99 francs at 9.4 %). Both figures are kept
 * here until a document settles it (docs/sources/sg/NOTES.md, "Against the federal calculator").
 *
 * Each line: the einfache Steuer, the cantonal tax (105 %) and the city's tax (138 %). By hand
 * for the first of 2025: 13,333 less 11,600 is 1,733 at 4 % = 69.32, to 5 Rappen 69.30; the
 * calculator: 1,700 at 4 % = 68. And 33,333: 168 + 17,533 at 6 % (1,051.98) = 1,219.98, to 5
 * Rappen 1,220.00; the calculator: 168 + 17,500 at 6 % = 1,218. With Vollsplitting, 33,333: half
 * is 16,666, taken as 16,600; the tariff there is 168 + 800 at 6 % = 216, a rate of 1.3012 %;
 * 33,333 at that rate is 433.73, to 5 Rappen 433.75; the calculator: 33,300 at that rate, 433.
 * A married couple at 13,333 owes nothing either way. The higher incomes, 2025: 99,999 is 6,865.20
 * at 98,300 (168 + 1,080 + 2,112 + 3,505.20) and 1,699 at 9.4 % (159.71): 7,024.90; the
 * calculator, 1,600 at 9.4 %: 7,015.60. For 2026 the fourth bracket is 26,500 wide (the law's
 * lit. d), so 6,873.20 at 98,400 and 1,599 at 9.4 % (150.31): 7,023.50; the calculator 7,014.20.
 * With Vollsplitting, 123,456: half is 61,728, taken as 61,700; the tariff there is 3,360 + 1,500
 * at 9.2 % = 3,498 in 2025 (3,368 + 1,400 at 9.2 % = 3,496.80 in 2026), and 123,456 at that
 * rate is 6,999.15 (6,996.75); the calculator: 123,400 at that rate, 6,996 (6,994).
 */
const NOT_A_HUNDRED: Record<TaxYear, string[]> = {
  2025: [
    'single, income 13333: engine 69.30 / 72.75 / 95.65, calculator 68 / 71 / 94',
    'single, income 33333: engine 1220.00 / 1281.00 / 1683.60, calculator 1218 / 1279 / 1681',
    'single, income 99999: engine 7024.90 / 7376.15 / 9694.35, calculator 7016 / 7366 / 9682',
    'single, income 123456: engine 9229.85 / 9691.35 / 12737.20, calculator 9225 / 9686 / 12730',
    'married, income 33333: engine 433.75 / 455.45 / 598.60, calculator 433 / 455 / 598',
    'married, income 99999: engine 5082.10 / 5336.20 / 7013.30, calculator 5077 / 5331 / 7006',
    'married, income 123456: engine 6999.15 / 7349.10 / 9658.85, calculator 6996 / 7346 / 9654',
    'married2, income 33333: engine 433.75 / 455.45 / 598.60, calculator 433 / 455 / 598',
    'married2, income 99999: engine 5082.10 / 5336.20 / 7013.30, calculator 5077 / 5331 / 7006',
    'married2, income 123456: engine 6999.15 / 7349.10 / 9658.85, calculator 6996 / 7346 / 9654',
    'single1, income 33333: engine 433.75 / 455.45 / 598.60, calculator 433 / 455 / 598',
    'single1, income 99999: engine 5082.10 / 5336.20 / 7013.30, calculator 5077 / 5331 / 7006',
    'single1, income 123456: engine 6999.15 / 7349.10 / 9658.85, calculator 6996 / 7346 / 9654',
  ],
  2026: [
    'single, income 13333: engine 69.30 / 72.75 / 95.65, calculator 68 / 71 / 94',
    'single, income 33333: engine 1220.00 / 1281.00 / 1683.60, calculator 1218 / 1279 / 1681',
    'single, income 99999: engine 7023.50 / 7374.70 / 9692.45, calculator 7014 / 7365 / 9680',
    'single, income 123456: engine 9228.45 / 9689.85 / 12735.25, calculator 9223 / 9684 / 12728',
    'married, income 33333: engine 433.75 / 455.45 / 598.60, calculator 433 / 455 / 598',
    'married, income 99999: engine 5082.10 / 5336.20 / 7013.30, calculator 5077 / 5331 / 7006',
    'married, income 123456: engine 6996.75 / 7346.60 / 9655.50, calculator 6994 / 7343 / 9651',
    'married2, income 33333: engine 433.75 / 455.45 / 598.60, calculator 433 / 455 / 598',
    'married2, income 99999: engine 5082.10 / 5336.20 / 7013.30, calculator 5077 / 5331 / 7006',
    'married2, income 123456: engine 6996.75 / 7346.60 / 9655.50, calculator 6994 / 7343 / 9651',
    'single1, income 33333: engine 433.75 / 455.45 / 598.60, calculator 433 / 455 / 598',
    'single1, income 99999: engine 5082.10 / 5336.20 / 7013.30, calculator 5077 / 5331 / 7006',
    'single1, income 123456: engine 6996.75 / 7346.60 / 9655.50, calculator 6994 / 7343 / 9651',
  ],
};

describe.each([2025, 2026] as const)('the federal calculator, St. Gallen %i', (taxYear) => {
  const golden = load(taxYear);
  const P = sgParamsFor(taxYear);
  /** Percent there, hundredths of a percent here: 138 -> 13800, 22.5 -> 2250. */
  const hundredths = (percent: number) => Math.round(percent * 100);

  it('has the multipliers of every commune and the church rate of one of its church areas', () => {
    const differences: string[] = [];
    const seen = new Set<string>();
    expect(golden.rates.length).toBe(75);
    expect(P.communes.value.length).toBe(75);
    for (const r of golden.rates) {
      // The same multipliers on income and on wealth (StG Art. 6).
      expect(r.wealth, r.name).toEqual(r.income);
      const c = communeByName(taxYear, NAMES[r.name] ?? r.name);
      if (!c) {
        differences.push(`${r.name} (BFS ${r.bfs}): not in the engine's table`);
        continue;
      }
      seen.add(c.name);
      const check = (what: string, ours: readonly number[], theirs: number) => {
        if (!ours.includes(hundredths(theirs)))
          differences.push(
            `${r.name} (BFS ${r.bfs}), ${what}: ${ours.join(' or ')} here, ${theirs} there`,
          );
      };
      check('canton', [P.multiplier.value], r.income.canton);
      check('commune', [c.rate], r.income.commune);
      // One church rate per commune there; here one per church area (Kirchgemeinde) where the
      // commune has several: the calculator's must be the rate of one of them.
      check(
        'reformed',
        c.areas.map((a) => a.reformed),
        r.income.reformed,
      );
      check(
        'catholic',
        c.areas.map((a) => a.catholic),
        r.income.catholic,
      );
      check('christ catholic', [P.christCatholic.value], r.income.christCatholic);
    }
    expect(differences).toEqual([]);
    // Every commune of the canton's table, once.
    expect(seen.size).toBe(75);
  });

  const city: SgCommune = communeByName(taxYear, golden.capital.name)!;
  const share = (church: Church): ChurchShare[] | null => {
    if (church === 'none') return null;
    if (church === 'christ_catholic')
      return [
        {
          person: 'household',
          confession: church,
          area: null,
          rate: P.christCatholic.value,
          share: 100,
        },
      ];
    const found = churchRate(city, church, AREA);
    if (found === 'area') throw new Error(`No church area ${AREA}.`);
    return [{ person: 'household', confession: church, area: AREA, rate: found.rate, share: 100 }];
  };
  const taxes = (household: string, income: number, wealth: number) =>
    assess({
      taxYear,
      commune: golden.capital.name,
      splitting: HOUSEHOLDS[household]!.splitting,
      church: share(HOUSEHOLDS[household]!.church),
      incomeItems: [{ code: '100', person: 'p1', amount: income * 100 }],
      wealthItems: [{ code: '300', person: 'p1', amount: wealth * 100 }],
    }).taxes;

  it('gives the calculator’s taxes in the City of St. Gallen, figure by figure', () => {
    expect(golden.cases.length).toBe(174);
    const f = P.income.value;
    const differences: string[] = [];
    const aboveTop: string[] = [];
    const notAHundred: string[] = [];
    for (const c of golden.cases) {
      const h = HOUSEHOLDS[c.household]!;
      const at = `${c.household}, income ${c.income}, wealth ${c.wealth}`;
      const money = (centimes: number) => (centimes / 100).toFixed(2);
      /** Apart by more than the two roundings allow, once the known difference is counted. */
      const near = (what: string, ours: number, theirs: number, known = 0) => {
        if (Math.abs(ours + known - theirs * 100) > 52)
          differences.push(`${what}, ${at}: engine ${money(ours)}, calculator ${theirs}`);
      };
      const e = c.estv;
      // One einfache Steuer for the canton and the commune, and no personal tax in St. Gallen.
      expect(e.IncomeSimpleTaxCity, at).toBe(e.IncomeSimpleTaxCanton);
      expect(e.FortuneSimpleTaxCity, at).toBe(e.FortuneSimpleTaxCanton);
      expect(e.PersonalTax, at).toBe(0);
      const onIncome = taxes(c.household, c.income, 0);
      const onWealth = taxes(c.household, 0, c.wealth);
      const both = taxes(c.household, c.income, c.wealth);

      // Above the top amount the calculator is higher by a known amount (TOP_EXCESS), and so are
      // its taxes by that amount times each multiplier.
      const isTop = c.income > (h.splitting ? 2 * f.topFrom : f.topFrom);
      const excess = isTop ? TOP_EXCESS[taxYear][h.splitting ? 'splitting' : 'single'] : 0;
      if (isTop) {
        aboveTop.push(
          `${c.household}, income ${c.income}: engine ${money(onIncome.simpleIncome.amount)}, calculator ${e.IncomeSimpleTaxCanton}`,
        );
        // 8.5 % of the whole income, exactly.
        expect(onIncome.simpleIncome.amount, at).toBe(c.income * 8.5);
      }
      // Not a whole hundred (NOT_A_HUNDRED): the calculator's figures are the engine's for the
      // income rounded down to CHF 100, which is what is compared; the engine's own for the
      // income as given are pinned where they differ.
      const down = Math.floor(c.income / 100) * 100;
      const compared = down === c.income ? onIncome : taxes(c.household, down, 0);
      if (down !== c.income) {
        const ours = [onIncome.simpleIncome, onIncome.cantonalIncome, onIncome.communalIncome];
        const theirs = [e.IncomeSimpleTaxCanton, e.IncomeTaxCanton, e.IncomeTaxCity];
        if (ours.some((line, i) => Math.abs(line.amount - theirs[i]! * 100) > 52))
          notAHundred.push(
            `${c.household}, income ${c.income}: engine ${ours.map((l) => money(l.amount)).join(' / ')}, calculator ${theirs.join(' / ')}`,
          );
      }
      near('simple tax on income', compared.simpleIncome.amount, e.IncomeSimpleTaxCanton, excess);
      near(
        'cantonal tax on income',
        compared.cantonalIncome.amount,
        e.IncomeTaxCanton,
        (excess * P.multiplier.value) / 10_000,
      );
      near(
        'communal tax on income',
        compared.communalIncome.amount,
        e.IncomeTaxCity,
        (excess * city.rate) / 10_000,
      );
      near('church tax on income', compared.church?.amount ?? 0, e.IncomeTaxChurch);

      near('simple tax on wealth', onWealth.simpleWealth.amount, e.FortuneSimpleTaxCanton);
      near('cantonal tax on wealth', onWealth.cantonalWealth.amount, e.FortuneTaxCanton);
      near('communal tax on wealth', onWealth.communalWealth.amount, e.FortuneTaxCity);
      near('church tax on wealth', onWealth.church?.amount ?? 0, e.FortuneTaxChurch);

      // Income and wealth together, as the engine bills them: the same lines, and one church tax
      // on the two einfache Steuern, the sum of the two parts to the 5 Rappen of one rounding.
      for (const line of [
        'simpleIncome',
        'cantonalIncome',
        'communalIncome',
        'simpleWealth',
        'cantonalWealth',
        'communalWealth',
      ] as const) {
        const alone = line.endsWith('Income') ? onIncome : onWealth;
        expect(both[line].amount, `${line}, ${at}`).toBe(alone[line].amount);
      }
      const apart = (onIncome.church?.amount ?? 0) + (onWealth.church?.amount ?? 0);
      expect(Math.abs((both.church?.amount ?? 0) - apart), at).toBeLessThanOrEqual(5);
    }
    expect(differences).toEqual([]);
    expect(aboveTop).toEqual(TOP[taxYear]);
    expect(notAHundred).toEqual(NOT_A_HUNDRED[taxYear]);
  });
});
