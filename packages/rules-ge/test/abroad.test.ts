// A home or land abroad in Geneva (SPEC.md section 1, the simple case), for tax years 2025 and
// 2026: synthetic households, made-up names and figures, each tax derived by hand, step by step,
// from the official documents. The engine must match them to the centime.
//
// The rules (packages/rules-ge, engine/abroad.ts; packages/rules-ch, abroad/property.ts):
// - the property is declared on annexe D (ge-2025-guide-declaration-pp p. 32), taxed where it
//   lies, counted only for the rate (ge-na-law-lipp art. 5 al. 1, art. 6 al. 1; ch-na-law-lifd
//   art. 6 al. 1, p. 4, art. 7 al. 1, p. 5);
// - its rental value: France, the taxe d'habitation's base, or twice the taxes foncières' base; a
//   country with a rental value like Switzerland's, that value; without one, 4.5 % of the tax value,
//   net; let, the rents received (ge-na-revenu-immobilier-page); its value: the country's tax value,
//   else the purchase price (ge-na-valeur-fiscale-page), at the rate of 31 December (guide p. 33);
// - upkeep: a home used, 15 % or 25 % of the rental value (ICC; guide p. 33, LIPP art. 34 let. d)
//   and 10 % or 20 % (IFD; ch-2025/2026-ifd-instructions-personnes-physiques p. 6); let, the actual
//   costs (ICC, no flat rate: guide p. 35), the actual costs or 10 % / 20 % of the rents (IFD);
// - the split: debts and debt interest in proportion to the gross assets (LIPP art. 57; LIFD art. 6
//   al. 3 and zh-na-zstb-5-3 p. 1); the other deductions and the social deductions in proportion to
//   the net income (LIFD art. 35 al. 3; zh-na-zstb-5-3 p. 1); the form's lines 95.00, 97.00
//   (part proportionnelle non imposable) and 99.00 (ge-2025-declaration-specimen p. 3 and 4); the
//   wealth deductions split by the assets (LIPP art. 58 al. 3).
//
// The other documents, as in households.test.ts: the ICC scales (ge-2025-guide-declaration-pp p. 47
// to 50, the same as ge-2025-icc-tariff-pdf); the federal scales (Form. 58c 2025 and 2026:
// single 1'698.00 at 85'000 and 6.60 a CHF 100 above it, 2026 1'694.35; married 4'825.00 at
// 144'300 and 10.00 a CHF 100 above it, 2026 4'821.00); the communes (ge-2025-communal-centimes-pdf:
// Carouge PP 27 % CA 40, Lancy PP 49 % CA 47; ge-2026-part-privilegiee-communique p. 11: Carouge 27
// %, Lancy 51 %; ge-2026-communal-centimes-arca: Carouge 40, Lancy 47). Rounding: each ICC line to
// 5 centimes, flat deductions and 97.00 to the franc, the federal tax rounded down to 5 centimes.
import { Ledger, type FactValue, type Owner, type VaultDocument } from '@taxpresso/ledger';
import { describe, expect, it } from 'vitest';
import {
  ABROAD_NOTE,
  ABROAD_UNSUPPORTED,
  abroadFromFacts,
  computeReturn,
  engineInputFromFacts,
  etatDesTitres,
  KEYS_2026,
  type EngineInput,
  type WealthItemInput,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const v = (francs: number) => ({ value: chf(francs) });
const w = (code: string, part: WealthItemInput['part'], francs: number): WealthItemInput => ({
  code,
  part,
  person: 'p1',
  centimes: chf(francs),
  taxes: ['icc', 'ifd'],
  estimate: false,
  complete: true,
  label: { en: code, fr: code },
  source: 'ge-2025-declaration-specimen p. 21',
});
const job = (gross: number, social: number, lpp: number) => ({
  gross: v(gross),
  socialContributions: v(social),
  pensionFund: v(lpp),
});
const codes = (list: readonly { code: string; amount: number }[]) =>
  list.map((i) => `${i.code} ${(i.amount / 100).toFixed(2)}`);

/** A copy of `o` without `keys`. */
function without<T extends object, K extends keyof T>(o: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...o };
  for (const k of keys) delete copy[k];
  return copy;
}

// A1. Inès Varela, single, Carouge: a salary, and a flat in Portugal let to tenants all year.
// The flat: tax value EUR 150'000 (the country's), rents EUR 9'000, upkeep and condominium fees EUR
// 1'350; built over 10 years ago; no loan. At the official 2025 rates (ge-2025-taux-donnees-fiscales:
// EUR 0.9305 on 31 December for wealth, 0.9370347 the year's average for income): value 139'575.00,
// rents 8'433.31 (8'433.3123), costs 1'265.00 (1'264.9968). 2026 takes the same rates as estimates
// (the 2026 rates are published after 31 December; from-ledger, tested below).
// ICC: 11.10 98'000; 31.10 -6'174; 31.12 -5'400; 31.50 3 % x 86'426 = 2'592.78, at most 1'812;
// 15.20 rents 8'433.31; 58.00 the actual costs -1'265 (no flat rate for a property let: p. 35);
// 52.21 premiums -5'880. 95.00 = 85'902.31. The whole net income before the deductions not linked
// to an income: 98'000 - 6'174 - 5'400 - 1'812 + 8'433.31 - 1'265 = 91'782.31; the flat's net
// income 8'433.31 - 1'265 = 7'168.31 (no debts). 97.00 = 85'902 x 7'168.31 / 91'782.31 =
// 6'709.0, to the franc 6'709; 99.00 = 85'902 - 6'709 = 79'193. Rate on 85'902 (no splitting):
// 6'996.00 at 77'518 + 8'384 x 14.20 % = 1'190.53 -> 1'190.55: 8'186.55. Base 79'193 x 8'186.55 /
// 85'902 = 7'547.198 -> 7'547.20. Centimes 47.5 %: 3'584.92 -> 3'584.90; reduction 12 % of
// 11'132.10 = 1'335.852 -> 1'335.85; home care 75.472 -> 75.45; cantonal 9'871.70. Carouge: PP
// 27 % x 7'547.20 = 2'037.744 -> 2'037.75, x 40 % = 815.10; rest 5'509.45 x 40 % = 2'203.78 ->
// 2'203.80 (both years).
// Wealth: account 24'000 + the flat 139'575 = 163'575; no debts; social deduction 87'632: 95.00 =
// 75'943; 97.00 = 75'943 x 139'575 / 163'575 = 64'800.6 -> 64'801; 99.00 = 11'142. Base: the scale
// at 75'943, 1.49 per mille = 113.155 -> 113.15, x 11'142 / 75'943 = 16.601 -> 16.60; centimes
// 7.885 -> 7.90; home care 0.166 -> 0.15; supplementary 0 (0 per mille below 118'398): 24.65.
// Communal: 27 % x 16.60 = 4.482 -> 4.50, x 40 % = 1.80; rest 12.10 x 40 % = 4.84 -> 4.85.
// Taxe personnelle 25. ICC 9'871.70 + 24.65 + 3'018.90 + 6.65 + 25 = 12'946.90.
// IFD: 31.20 3 % x 86'426 = 2'593 (between 2'000 and 4'000); 58.00 max(1'265, 20 % x 8'433.31 =
// 1'686.66 -> 1'687) = 1'687; 52.00 1'800. 95.00 = 88'779.31; whole net income 90'579.31; the
// flat's 8'433.31 - 1'687 = 6'746.31; 97.00 = 88'779 x 6'746.31 / 90'579.31 = 6'612.2 -> 6'612;
// 99.00 = 82'167. Scale at 88'700: 2025 1'698.00 + 37 x 6.60 = 1'942.20; 2026 1'694.35 + 244.20 =
// 1'938.55. At the rate: 82'100 x 1'942.20 / 88'700 = 1'797.67 -> 1'797.65 (2025); 82'100 x
// 1'938.55 / 88'700 = 1'794.30 (2026).
function varela(taxYear: 2025 | 2026): EngineInput {
  return {
    taxYear,
    commune: 'carouge',
    civilStatus: 'single',
    people: [{ id: 'p1', employments: [job(98_000, 6_174, 5_400)] }],
    household: { healthPremiums: v(5_880) },
    wealthItems: [w('14.00', 'wealth', 24_000)],
    abroad: {
      owner: 'p1',
      use: 'let',
      country: { en: 'Portugal', fr: 'Portugal' },
      value: v(139_575),
      valueBasis: 'tax_value',
      rents: v(8_433.31),
      costs: v(1_265),
      old: true,
    },
  };
}

// A2. Tomas and Ilse Varga, married, Lancy: two salaries, Swiss savings, a car loan in Switzerland,
// and a holiday home in France they keep for themselves, with a mortgage in France.
// The home: bought for EUR 320'000 (France sets no tax value: the purchase price, from the deed);
// the taxe d'habitation's "Base d'imposition (valeur locative brute)" EUR 6'200; over 10 years
// old. The mortgage: EUR 150'000 owed, EUR 3'300 interest. At the 2025 rates: value 297'760.00,
// rental value 5'809.62 (5'809.615), mortgage 139'575.00 and 3'092.21 (3'092.2145). The car loan:
// 18'000 owed, 720 interest. Savings 280'000 with 2'800 interest (savings interest, 56.30).
// The split: gross assets 280'000 here, 297'760 abroad, 577'760 in all (51.54 % abroad). Debts
// 157'575, interest 3'812 (to the franc): abroad 157'575 x 297'760 / 577'760 = 81'209.38 and
// 3'812 x 297'760 / 577'760 = 1'964.59; the interest left here, 1'847.41, is under the Swiss income
// from wealth (2'800): no surplus to move.
// ICC: 11.10 130'000, 31.10 -8'190, 31.12 -9'750, 31.50 -1'812 (3 % x 112'060 above the maximum);
// 21.10 64'000, 41.10 -4'032, 41.12 -3'200, 41.50 3 % x 56'768 = -1'703; 14.00 2'800; 15.10 the
// rental value 5'809.62; 58.00 the flat 25 % = 1'452.405 -> -1'452; 41.95 two earners -1'051;
// 52.21 -11'000; 52.15 savings interest -2'800; 55.10 -3'812. 95.00 = 153'807.62. Whole net
// income before the other deductions: 202'609.62 - 29'738 - 1'452 - 3'812 = 167'607.62; the home's
// 5'809.62 - 1'452 - 1'964.59 = 2'393.03. 97.00 = 153'807 x 2'393.03 / 167'607.62 = 2'196.0 ->
// 2'196; 99.00 = 151'611. Rate: full splitting, 50 % of 153'807 = 76'903.5 -> 76'904: 3'140.40 +
// 28'595 x 13.20 % = 3'774.54 -> 3'774.55: 6'914.95. Base 151'611 x 6'914.95 / 76'904 =
// 13'632.36 -> 13'632.35. Centimes 6'475.366 -> 6'475.35; reduction 12 % of 20'107.70 = 2'412.92
// -> 2'412.90; home care 136.3235 -> 136.30; cantonal 17'831.10. Lancy 2025: PP 49 % = 6'679.85,
// x 47 % = 3'139.53 -> 3'139.55; rest 6'952.50 x 47 % = 3'267.675 -> 3'267.70. Lancy 2026: PP 51
// % = 6'952.50 -> 3'267.70; rest 6'679.85 -> 3'139.55. Communal 6'407.25 both years.
// Wealth: 577'760 - 157'575 = 420'185; couple 175'264: 95.00 = 244'921; 97.00 = 244'921 x
// 297'760 / 577'760 = 126'224.6 -> 126'225; 99.00 = 118'696. Base: the scale at 244'921 = 402.55 +
// 8'126 x 2.34 per mille = 19.01 -> 19.00: 421.55, x 118'696 / 244'921 = 204.297 -> 204.30;
// centimes 97.04 -> 97.05; home care 2.043 -> 2.05; supplementary: 11.30 + 8'126 x 0.1169 per
// mille = 0.95: 12.25, x 118'696 / 244'921 = 5.937 -> 5.95: cantonal 309.35. Communal: 2025 49 %
// x 204.30 = 100.107 -> 100.10, x 47 % = 47.05; rest 104.20 x 47 % = 48.97 -> 48.95; 2026 51 % =
// 104.193 -> 104.20 -> 48.95, rest 100.10 -> 47.05. 96.00. ICC 17'831.10 + 309.35 + 6'407.25 +
// 96.00 + 25 = 24'668.70.
// IFD: 31.20 3 % x 112'060 = 3'362; 41.20 3 % x 56'768 = 1'703, at least 2'000; 58.00 20 % x
// 5'809.62 = 1'161.92 -> -1'162; 41.90 two earners 50 % of 54'768, at most 14'100 (2025 and 2026);
// 52.00 couple with pension funds 3'700; 55.10 -3'812; 59.20 2'800. 95.00 = 146'501.62; whole net
// income 202'609.62 - 44'634 - 1'162 - 3'812 = 153'001.62; the home's 5'809.62 - 1'162 - 1'964.59
// = 2'683.03; 97.00 = 146'501 x 2'683.03 / 153'001.62 = 2'569.04 -> 2'569; 99.00 = 143'932.
// Married scale at 146'500: 2025 4'825.00 + 22 x 10.00 = 5'045.00; 2026 4'821.00 + 220 = 5'041.00.
// At the rate: 143'900 x 5'045 / 146'500 = 4'955.46 -> 4'955.45 (2025); 143'900 x 5'041 / 146'500
// = 4'951.53 -> 4'951.50 (2026).
function varga(taxYear: 2025 | 2026): EngineInput {
  return {
    taxYear,
    commune: 'lancy',
    civilStatus: 'married',
    people: [
      { id: 'p1', employments: [job(130_000, 8_190, 9_750)] },
      { id: 'p2', employments: [job(64_000, 4_032, 3_200)] },
    ],
    household: { healthPremiums: v(11_000) },
    wealthItems: [
      w('14.00', 'wealth', 280_000),
      w('14.00', 'income', 2_800),
      w('56.30', 'deduction', 2_800),
      w('55.10', 'wealth_deduction', 139_575 + 18_000),
      w('55.10', 'deduction', 3_092.21 + 720),
    ],
    abroad: {
      owner: 'household',
      use: 'own_use',
      country: { en: 'France', fr: 'France' },
      france: true,
      value: v(297_760),
      valueBasis: 'purchase_price',
      rentalValue: v(5_809.62),
      rentalBasis: 'france_habitation',
      old: true,
    },
  };
}

// A3. Paolo Ferri, single, Meyrin: a salary, and a holiday home in Italy with a large mortgage.
// Italy sets no rental value like Switzerland's: 4.5 % of the tax value (EUR 120'000 -> 111'660):
// 5'024.70, net. The mortgage: EUR 110'000 (102'355) and EUR 6'600 interest (6'184.43). Gross
// assets 10'000 here and 111'660 abroad: 6'184 x 111'660 / 121'660 = 5'675.70 of interest goes
// abroad, more than the home brings in: a loss abroad. It counts only for the rate (LIFD art. 6
// al. 3; LIPP art. 5 al. 4), and no document says how the deductions are shared then: fail closed.
function ferri(taxYear: 2025 | 2026): EngineInput {
  return {
    taxYear,
    commune: 'meyrin',
    civilStatus: 'single',
    people: [{ id: 'p1', employments: [job(72_000, 4_536, 3_600)] }],
    household: { healthPremiums: v(5_400) },
    wealthItems: [
      w('14.00', 'wealth', 10_000),
      w('55.10', 'wealth_deduction', 102_355),
      w('55.10', 'deduction', 6_184.43),
    ],
    abroad: {
      owner: 'p1',
      use: 'own_use',
      country: { en: 'Italy', fr: 'Italie' },
      value: v(111_660),
      valueBasis: 'tax_value',
      old: true,
    },
  };
}

describe('A1 Inès Varela: a flat let in Portugal, a salary (single, Carouge)', () => {
  for (const year of [2025, 2026] as const) {
    it(`${year}: the flat counts for the rate only, every line derived by hand`, () => {
      const r = computeReturn(varela(year));
      expect(r.unsupported).toEqual([]);
      const i = r.icc!;
      expect(codes(i.items)).toEqual([
        '11.10 98000.00',
        '31.10 -6174.00',
        '31.12 -5400.00',
        '31.50 -1812.00',
        '15.20 8433.31',
        '58.00 -1265.00',
        '52.21 -5880.00',
      ]);
      expect(i.totalIncome.amount).toBe(chf(85_902.31));
      expect(i.exemptIncome!.amount).toBe(chf(6_709));
      expect(i.taxableIncome.amount).toBe(chf(79_193));
      expect(i.rateIncome.amount).toBe(chf(85_902));
      const x = i.taxes;
      expect(x.incomeBase.amount).toBe(chf(7_547.2));
      expect(x.incomeCantonalCentimes.amount).toBe(chf(3_584.9));
      expect(x.incomeReduction12.amount).toBe(chf(-1_335.85));
      expect(x.incomeHomeCare.amount).toBe(chf(75.45));
      expect(x.incomeCantonal.amount).toBe(chf(9_871.7));
      expect(x.communalIncome.privileged.tax.amount).toBe(chf(815.1));
      expect(x.communalIncome.rest.map((s) => s.tax.amount)).toEqual([chf(2_203.8)]);
      expect(i.wealth.grossWealth.amount).toBe(chf(163_575));
      expect(i.wealth.rateWealth!.amount).toBe(chf(75_943));
      expect(i.wealth.exemptWealth!.amount).toBe(chf(64_801));
      expect(i.wealth.taxableWealth.amount).toBe(chf(11_142));
      expect(x.wealthBase.amount).toBe(chf(16.6));
      expect(x.wealthCantonalCentimes.amount).toBe(chf(7.9));
      expect(x.wealthHomeCare.amount).toBe(chf(0.15));
      expect(x.wealthSupplementary.amount).toBe(0);
      expect(x.wealthCantonal.amount).toBe(chf(24.65));
      expect(x.communalWealthTotal.amount).toBe(chf(6.65));
      expect(x.personalTax.amount).toBe(chf(25));
      expect(x.total.amount).toBe(chf(12_946.9));

      const f = r.ifd!;
      expect(codes(f.items)).toEqual([
        '11.10 98000.00',
        '31.10 -6174.00',
        '31.12 -5400.00',
        '31.20 -2593.00',
        '15.20 8433.31',
        '58.00 -1687.00',
        '52.00 -1800.00',
      ]);
      expect(f.totalIncome.amount).toBe(chf(88_779.31));
      expect(f.exemptIncome!.amount).toBe(chf(6_612));
      expect(f.taxableIncome.amount).toBe(chf(82_167));
      expect(f.scaleIncome.amount).toBe(chf(88_700));
      expect(f.scaleTax.amount).toBe(chf(year === 2025 ? 1_942.2 : 1_938.55));
      expect(f.tax.amount).toBe(chf(year === 2025 ? 1_797.65 : 1_794.3));
      expect(r.total).toBe(chf(12_946.9) + chf(year === 2025 ? 1_797.65 : 1_794.3));

      // The property abroad in the result, its rules said plainly.
      expect(r.abroad).toMatchObject({ owner: 'p1', use: 'let', shareBp: 8533 });
      expect(r.abroad!.debts).toBeUndefined();
      expect(r.assumptions).toContainEqual(ABROAD_NOTE.exempt);
      expect(r.unverifiedRules).toContainEqual(ABROAD_NOTE.split);
      expect(r.unverifiedRules).toContainEqual(ABROAD_NOTE.noAbattement);
      // The flat rate beat the actual costs for the federal tax: a choice the final check lists.
      expect(r.limits).toContainEqual(
        expect.objectContaining({ code: '58.00', tax: 'ifd', kind: 'choice', counted: 168_700 }),
      );
      // 2026: Geneva's 2025 values, flagged; the federal values are 2026's.
      expect(r.estimates.map((e) => e.id)).toEqual(year === 2025 ? [] : ['ge-2026-unpublished']);
    });
  }
});

describe('A2 Tomas and Ilse Varga: a holiday home in France, a mortgage there, a car loan here', () => {
  for (const year of [2025, 2026] as const) {
    it(`${year}: the debts and interest split by the assets, every line derived by hand`, () => {
      const r = computeReturn(varga(year));
      expect(r.unsupported).toEqual([]);
      const i = r.icc!;
      expect(codes(i.items)).toEqual([
        '11.10 130000.00',
        '31.10 -8190.00',
        '31.12 -9750.00',
        '31.50 -1812.00',
        '21.10 64000.00',
        '41.10 -4032.00',
        '41.12 -3200.00',
        '41.50 -1703.00',
        '14.00 2800.00',
        '15.10 5809.62',
        '58.00 -1452.00',
        '41.95 -1051.00',
        '52.21 -11000.00',
        '52.15 -2800.00',
        '55.10 -3812.00',
      ]);
      expect(r.abroad!.shareBp).toBe(5154);
      expect(r.abroad!.debts!.amount).toBe(chf(81_209.38));
      expect(r.abroad!.interestIcc!.amount).toBe(chf(1_964.59));
      expect(r.abroad!.interestIfd!.amount).toBe(chf(1_964.59));
      expect(i.totalIncome.amount).toBe(chf(153_807.62));
      expect(i.exemptIncome!.amount).toBe(chf(2_196));
      expect(i.taxableIncome.amount).toBe(chf(151_611));
      expect(i.rateIncome.amount).toBe(chf(76_904));
      const x = i.taxes;
      expect(x.incomeBase.amount).toBe(chf(13_632.35));
      expect(x.incomeCantonalCentimes.amount).toBe(chf(6_475.35));
      expect(x.incomeReduction12.amount).toBe(chf(-2_412.9));
      expect(x.incomeHomeCare.amount).toBe(chf(136.3));
      expect(x.incomeCantonal.amount).toBe(chf(17_831.1));
      expect(x.communalIncome.privileged.tax.amount).toBe(chf(year === 2025 ? 3_139.55 : 3_267.7));
      expect(x.communalIncome.rest.map((s) => s.tax.amount)).toEqual([
        chf(year === 2025 ? 3_267.7 : 3_139.55),
      ]);
      expect(i.wealth.grossWealth.amount).toBe(chf(577_760));
      expect(i.wealth.netWealth.amount).toBe(chf(420_185));
      expect(i.wealth.rateWealth!.amount).toBe(chf(244_921));
      expect(i.wealth.exemptWealth!.amount).toBe(chf(126_225));
      expect(i.wealth.taxableWealth.amount).toBe(chf(118_696));
      expect(x.wealthBase.amount).toBe(chf(204.3));
      expect(x.wealthCantonalCentimes.amount).toBe(chf(97.05));
      expect(x.wealthHomeCare.amount).toBe(chf(2.05));
      expect(x.wealthSupplementary.amount).toBe(chf(5.95));
      expect(x.wealthCantonal.amount).toBe(chf(309.35));
      expect(x.communalWealthTotal.amount).toBe(chf(96));
      expect(x.total.amount).toBe(chf(24_668.7));

      const f = r.ifd!;
      expect(codes(f.items)).toEqual([
        '11.10 130000.00',
        '31.10 -8190.00',
        '31.12 -9750.00',
        '31.20 -3362.00',
        '21.10 64000.00',
        '41.10 -4032.00',
        '41.12 -3200.00',
        '41.20 -2000.00',
        '14.00 2800.00',
        '15.10 5809.62',
        '58.00 -1162.00',
        '41.90 -14100.00',
        '52.00 -3700.00',
        '55.10 -3812.00',
        '59.20 -2800.00',
      ]);
      expect(f.totalIncome.amount).toBe(chf(146_501.62));
      expect(f.exemptIncome!.amount).toBe(chf(2_569));
      expect(f.taxableIncome.amount).toBe(chf(143_932));
      expect(f.scaleTax.amount).toBe(chf(year === 2025 ? 5_045 : 5_041));
      expect(f.tax.amount).toBe(chf(year === 2025 ? 4_955.45 : 4_951.5));
      expect(r.total).toBe(chf(24_668.7) + chf(year === 2025 ? 4_955.45 : 4_951.5));
    });
  }

  it('without the property abroad, nothing is split and no 97.00 is shown', () => {
    const plain = without(varga(2025), 'abroad');
    const r = computeReturn(plain);
    expect(r.icc!.exemptIncome).toBeUndefined();
    expect(r.icc!.wealth.rateWealth).toBeUndefined();
    expect(r.icc!.wealth.exemptWealth).toBeUndefined();
    expect(r.ifd!.exemptIncome).toBeUndefined();
    expect(r.ifd!.atRate).toBeUndefined();
    expect(r.abroad).toBeUndefined();
    // Without it, all the interest is deducted here: 153'807.62 less the home's 5'809.62 and plus
    // its 1'452 upkeep, 149'450. With it, the interest that goes abroad comes back into what is
    // taxed here (151'611), at a rate set by the whole income.
    expect(r.icc!.taxableIncome.amount).toBe(chf(149_450));
    expect(r.icc!.rateIncome.amount).toBe(chf(74_725));
  });
});

describe('A3 Paolo Ferri: a holiday home in Italy that costs more than it brings in', () => {
  for (const year of [2025, 2026] as const) {
    it(`${year}: a loss abroad fails closed, with the plain reason`, () => {
      const r = computeReturn(ferri(year));
      expect(r.icc).toBeNull();
      expect(r.ifd).toBeNull();
      expect(r.total).toBeNull();
      expect(r.unsupported).toEqual([ABROAD_UNSUPPORTED.loss_abroad]);
      expect(r.unsupported[0]!.en).toMatch(
        /^Your property abroad: .*a loss abroad.*no tax is computed/,
      );
      expect(r.abroad).toBeUndefined();
    });
  }

  it('without the mortgage, the 4.5 % rental value counts, net, for the rate', () => {
    const input = ferri(2025);
    const r = computeReturn({
      ...input,
      wealthItems: input.wealthItems!.filter((x) => x.code !== '55.10'),
    });
    expect(r.unsupported).toEqual([]);
    // 4.5 % of 111'660 = 5'024.70, to the franc as a flat amount on the form: 5'025, no upkeep
    // deducted (ge-na-revenu-immobilier-page).
    expect(codes(r.icc!.items.filter((i) => i.code === '15.10' || i.code === '58.00'))).toEqual([
      '15.10 5025.00',
    ]);
    expect(r.assumptions).toContainEqual(ABROAD_NOTE.flatRentalValue);
  });
});

describe('what else fails closed, or is read otherwise', () => {
  it('a Swiss share of debt interest above the Swiss income from wealth', () => {
    const input = varga(2025);
    const r = computeReturn({
      ...input,
      wealthItems: input.wealthItems!.map((x) =>
        x.code === '14.00' && x.part === 'income' ? { ...x, centimes: chf(500) } : x,
      ),
    });
    expect(r.icc).toBeNull();
    expect(r.unsupported).toEqual([ABROAD_UNSUPPORTED.interest_surplus]);
  });

  it('the federal tax with children: the reduction per child at a rate is in no document', () => {
    const r = computeReturn({ ...varga(2025), children: [{ custody: 'full' }] });
    expect(r.ifd).toBeNull();
    expect(r.icc).not.toBeNull();
    expect(r.unsupported).toEqual([ABROAD_UNSUPPORTED.ifd_children]);
  });

  it('what the answers put outside the simple case', () => {
    const reason = {
      en: 'A property abroad of someone taxed at source.',
      fr: 'Imposé à la source.',
    };
    const input = varela(2026);
    const r = computeReturn({ ...input, abroad: { ...input.abroad!, unsupported: [reason] } });
    expect(r.icc).toBeNull();
    expect(r.ifd).toBeNull();
    expect(r.unsupported).toEqual([reason]);
  });

  it('a home in France without a taxe d’habitation: twice the taxes foncières’ base', () => {
    const input = varga(2025);
    const r = computeReturn({
      ...input,
      abroad: { ...input.abroad!, rentalValue: v(2_904.81), rentalBasis: 'france_land_tax' },
    });
    expect(r.icc!.items.find((i) => i.code === '15.10')!.amount).toBe(chf(5_809.62));
  });

  it('a home in France with only its value known: 4.5 % as an estimate until the notice is read', () => {
    const input = varga(2025);
    const rest = without(input.abroad!, 'rentalValue', 'rentalBasis');
    const r = computeReturn({ ...input, abroad: rest });
    const line = r.icc!.items.find((i) => i.code === '15.10')!;
    // 4.5 % of 297'760 = 13'399.20, to the franc.
    expect(line.amount).toBe(chf(13_399));
    expect(line.estimates).toContain('input-estimate');
    expect(r.assumptions).toContainEqual(ABROAD_NOTE.franceFlat);
  });

  it('land: its value counts for the rate of wealth, no income', () => {
    const r = computeReturn({
      ...varela(2025),
      abroad: { owner: 'p1', use: 'land', value: v(60_000), valueBasis: 'purchase_price' },
    });
    expect(r.unsupported).toEqual([]);
    expect(r.icc!.items.some((i) => i.code.startsWith('15.'))).toBe(false);
    expect(r.icc!.exemptIncome!.amount).toBe(0);
    expect(r.icc!.wealth.items.find((i) => i.code === '15.20')!.amount).toBe(chf(60_000));
  });

  it('a value not known yet: the taxes are floors, and say so', () => {
    const input = varela(2026);
    const rest = without(input.abroad!, 'value', 'valueBasis');
    const r = computeReturn({ ...input, abroad: rest });
    expect(r.complete).toBe(false);
    expect(r.incomplete).toContainEqual(ABROAD_NOTE.noValue);
  });
});

// --- From the ledger: the answers, the documents in euros, the official rates -----------------

const doc = (id: string, kind: VaultDocument['kind'], taxYear: number): VaultDocument => ({
  id,
  sha256: id,
  filename: `${id}.pdf`,
  path: `documents/${id}.pdf`,
  bytes: 1,
  addedAt: '2026-10-14T00:00:00.000Z',
  ...(kind ? { kind } : {}),
  person: 'household',
  taxYear,
  parse: { method: 'claude', ok: true, warnings: [] },
});

/** Inès Varela's ledger: her answers, her tax notice and her management account, in euros. */
function varelaLedger(taxYear: 2025 | 2026, more: [string, FactValue][] = []) {
  const l = new Ledger(taxYear, KEYS_2026);
  const put = (key: string, value: FactValue, instance?: string, person: Owner = 'household') =>
    l.append({
      key,
      person,
      value,
      status: 'stated',
      source: instance
        ? { method: 'claude', docId: instance, page: 1 }
        : { method: 'user', via: 'chat' },
      ...(instance ? { instance } : {}),
    });
  put('profile.civil_status', 'single');
  put('profile.commune', 'carouge');
  put('profile.children_count', 0);
  put('profile.moved', 'no');
  put('profile.income_sources', ['salary'], undefined, 'p1');
  put('profile.special', ['property_abroad']);
  put('profile.abroad_property', 'let');
  put('profile.abroad_property_owner', 'p1');
  put('profile.abroad_property_country', 'portugal');
  put('profile.abroad_property_old', true);
  put('profile.abroad_property_loan', false);
  put('abroad.currency', 'EUR', 'd_notice');
  put('abroad.tax_value', "150'000.00", 'd_notice');
  put('abroad.rents', "9'000.00", 'd_rents');
  put('abroad.costs', "1'350.00", 'd_rents');
  for (const [key, value] of more) put(key, value);
  return {
    ledger: l,
    facts: l.view(),
    documents: [
      doc('d_notice', 'foreign_property_tax_notice', taxYear),
      doc('d_rents', 'foreign_property_rent_statement', taxYear),
    ],
  };
}

describe('the property abroad read from the ledger', () => {
  it('2025: converts the amounts at the official 2025 rates (value 31 December, income average)', () => {
    const { facts, documents } = varelaLedger(2025);
    const notes: { en: string; fr: string }[] = [];
    const out = abroadFromFacts(2025, facts, documents, ['p1'], notes);
    expect(out.missing).toEqual([]);
    // EUR 150'000 x 0.9305 = 139'575.00; 9'000 x 0.9370347 = 8'433.3123 -> 8'433.31; 1'350 x
    // 0.9370347 = 1'264.9968 -> 1'265.00 (ge-2025-taux-donnees-fiscales).
    expect(out.input).toMatchObject({
      owner: 'p1',
      use: 'let',
      country: { en: 'Portugal', fr: 'Portugal' },
      value: { value: 13_957_500, status: 'stated' },
      valueBasis: 'tax_value',
      rents: { value: 843_331, status: 'stated' },
      costs: { value: 126_500, status: 'stated' },
      old: true,
    });
    expect(notes).toEqual([]);
    // And the whole return: the flat as in A1 above.
    const r = computeReturn(engineInputFromFacts(2025, facts, documents).input!);
    expect(r.icc!.items.find((i) => i.code === '15.20')!.amount).toBe(843_331);
    expect(r.icc!.wealth.items.find((i) => i.code === '15.20')!.amount).toBe(13_957_500);
  });

  it('2026: its rates are published after 31 December, so the 2025 ones count, as estimates', () => {
    const { facts, documents } = varelaLedger(2026);
    const notes: { en: string; fr: string }[] = [];
    const out = abroadFromFacts(2026, facts, documents, ['p1'], notes);
    expect(out.input).toMatchObject({
      value: { value: 13_957_500, status: 'estimate' },
      rents: { value: 843_331, status: 'estimate' },
    });
    expect(notes.map((n) => n.en)).toEqual([
      'Your property abroad: its amounts are converted at the official 2025 rates, as estimates, until the 2026 rates are published (after 31 December).',
    ]);
  });

  it('until the documents are in: the user’s own figures, with their currency, as estimates', () => {
    const { facts } = varelaLedger(2025, [
      ['plan.abroad_value', '160000 EUR'],
      ['plan.abroad_rent', 'EUR 8400'],
    ]);
    const out = abroadFromFacts(2025, facts, [], ['p1']);
    // 160'000 x 0.9305 = 148'880.00; 8'400 x 0.9370347 = 7'871.09.
    expect(out.input).toMatchObject({
      value: { value: 14_888_000, status: 'estimate' },
      valueBasis: 'estimate',
      rents: { value: 787_109, status: 'estimate' },
    });
  });

  it('asks what is still open, and leaves out what the questionnaire says isn’t supported', () => {
    const open = varelaLedger(2025).facts.filter((f) => f.key !== 'profile.abroad_property_old');
    expect(abroadFromFacts(2025, open, [], ['p1']).missing).toEqual([
      {
        en: 'the questions about your property abroad',
        fr: 'les questions sur votre immeuble à l’étranger',
      },
    ]);
    const several = varelaLedger(2025, [['profile.abroad_property', 'several']]);
    expect(abroadFromFacts(2025, several.facts, several.documents, ['p1'])).toEqual({
      missing: [],
    });
  });

  it('someone taxed at source with a property abroad: not supported, said plainly', () => {
    const { ledger, documents } = varelaLedger(2025);
    ledger.append({
      key: 'profile.taxed_at_source',
      person: 'p1',
      value: true,
      status: 'stated',
      source: { method: 'user', via: 'chat' },
    });
    const out = abroadFromFacts(2025, ledger.view(), documents, ['p1']);
    expect(out.input!.unsupported!.map((u) => u.en)).toEqual([
      'A property abroad of someone taxed at source: the source-tax directives don’t say how it counts (for TOU and the rate), so Taxpresso can’t prepare it yet and no tax is computed.',
    ]);
    const r = computeReturn(engineInputFromFacts(2025, ledger.view(), documents).input!);
    expect(r.icc).toBeNull();
  });

  it('a loan statement in euros: converted by the securities list’s other wealth', () => {
    const l = new Ledger(2025, KEYS_2026);
    const put = (key: string, value: string) =>
      l.append({
        key,
        person: 'household',
        value,
        status: 'stated',
        instance: 'd_mortgage',
        source: { method: 'claude', docId: 'd_mortgage', page: 1 },
      });
    put('debt.currency', 'EUR');
    put('debt.balance_in_currency', "150'000.00");
    put('debt.interest_in_currency', "3'300.00");
    const etat = etatDesTitres({
      taxYear: 2025,
      people: ['p1'],
      facts: l.view(),
      documents: [doc('d_mortgage', 'debt_interest', 2025)],
    });
    // 150'000 x 0.9305 = 139'575.00; 3'300 x 0.9370347 = 3'092.21, to the franc 3'092.
    expect(etat.other).toEqual([
      expect.objectContaining({
        rubric: 'debts',
        currency: 'EUR',
        value: 13_957_500,
        flow: 309_200,
        state: 'confirmed',
        complete: true,
      }),
    ]);
    // 2026: the 2025 rates, as estimates.
    const later = etatDesTitres({
      taxYear: 2026,
      people: ['p1'],
      facts: l.view(),
      documents: [doc('d_mortgage', 'debt_interest', 2026)],
    });
    expect(later.other[0]).toMatchObject({ value: 13_957_500, state: 'estimate' });
  });
});
