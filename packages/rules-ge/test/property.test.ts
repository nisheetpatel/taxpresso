// A property in Geneva (SPEC.md section 1, the simple case), for tax years 2025 and 2026: synthetic
// households, made-up names and figures, each line derived by hand from the official documents.
// The engine must match them to the centime.
//
// The rules (packages/rules-ge, engine/property.ts and law/property.ts; packages/rules-ch,
// property/swiss.ts):
// - the tax value and the rental value of a home in Geneva are the AFC's for the year (its letter
//   before 31 March: ge-na-valeur-fiscale-page, ge-na-revenu-immobilier-page; ge-na-law-lefi);
// - the abattement: 4 % a year of continuous use by the same owner, at most 40 %, counted from the
//   year of the move to the tax year, both included ("Villa occupée de 2010 à 2025, soit 16 ans":
//   ge-2025-guide-declaration-pp p. 33; ge-na-law-lipp art. 50 let. e), on the tax value (capital
//   après abattement) and on the rental value for the cantonal tax ("Valeur locative après
//   abattement", p. 33 and 34); the federal tax takes the gross rental value (p. 33);
// - the upkeep: one's own home, the flat 15 % or 25 % of the cantonal rental value by the
//   building's age (LIPP art. 34 let. d; guide p. 33) and 10 % or 20 % of the gross rental value
//   for the federal tax (ch-2025/2026-ifd-instructions-personnes-physiques p. 6), or the actual
//   costs, the higher one in each tax (ge-na-information-1-2021-frais-entretien p. 2 and 4); a
//   property let, the actual costs only for the cantonal tax (guide p. 35), the actual costs or 10 %
//   or 20 % of the rents for the federal tax;
// - the taux d'effort: the cantonal rental value of the main home can't exceed 20 % of the gross
//   income (91.00, the rental value included: guide p. 51), at least of the first tax-free bracket
//   (x 2 for spouses), and counts only when the interest that finances the home is not higher
//   (LIPP art. 24 al. 2);
// - debt interest up to the gross income from wealth, the property's included, plus 50,000 (guide
//   p. 37; LIFD art. 33 al. 1 let. a);
// - the impôt immobilier complémentaire: 1 per mille of the tax value, 0.2 per mille for the main
//   home, without the abattement and debts (ge-na-law-lcp art. 76; ge-na-iic-page).
//
// The other documents, as in households.test.ts and abroad.test.ts: the ICC scales
// (ge-2025-icc-tariff-pdf p. 2 and 5) with its surcharges (p. 4 and 6); the guide's 2025 amounts
// (ge-2025-guide-declaration-pp p. 11, 19, 21, 29, 16); the federal deductions
// (ch-2026-ifd-progression-deductions p. 2, the same for 2025 and 2026) and scales (Form. 58c 2025
// and 2026: ch-2025- and ch-2026-ifd-tarif-personnes-physiques); the communes
// (ge-2025-communal-centimes-pdf: Lancy PP 49 % CA 47, Thônex 77 % 44, Carouge 27 % 40, Meyrin
// 30 % 42; ge-2026-part-privilegiee-communique p. 11: Lancy 51 %, Thônex 77 %, Carouge 27 %, Meyrin
// 29 %; ge-2026-communal-centimes-arca: the same centimes). Rounding: each ICC line to 5 centimes,
// the flat amounts and the abattement to the franc, the federal tax rounded down to 5 centimes.
// The same figures were worked out with a separate calculator written from these documents only.
import { Ledger, type FactValue, type Owner, type VaultDocument } from '@taxpresso/ledger';
import { describe, expect, it } from 'vitest';
import {
  computeReturn,
  engineInputFromFacts,
  etatDesTitres,
  KEYS_2026,
  PROPERTY_NOTE,
  PROPERTY_UNSUPPORTED,
  propertyFromFacts,
  type EngineInput,
  type WealthItemInput,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const v = (francs: number) => ({ value: chf(francs) });
const w = (code: string, part: WealthItemInput['part'], francs: number): WealthItemInput => ({
  code,
  part,
  person: 'household',
  centimes: chf(francs),
  taxes: part === 'wealth' || part === 'wealth_deduction' ? ['icc'] : ['icc', 'ifd'],
  estimate: false,
  complete: true,
  label: { en: code, fr: code },
  source: 'ge-2025-declaration-specimen p. 19',
});
const job = (gross: number, social: number, lpp: number) => ({
  gross: v(gross),
  socialContributions: v(social),
  pensionFund: v(lpp),
});
const codes = (list: readonly { code: string; amount: number }[]) =>
  list.map((i) => `${i.code} ${(i.amount / 100).toFixed(2)}`);

// P1. Julien and Anaïs Chevalley, married, Lancy: two salaries, the flat they own in a PPE building
// and live in since 2019 (built over 10 years ago), a mortgage, the flat upkeep deduction.
// The AFC's values: tax value 930'000, rental value 27'600; the mortgage 450'000, interest 6'750.
// Abattement: 2019 to 2025, 7 years x 4 % = 28 % (2026: 8 years, 32 %). Tax value: 930'000 -
// 260'400 = 669'600 (2026: - 297'600 = 632'400). Rental value: federal 27'600; cantonal 27'600 -
// 7'728 = 19'872 (2026: - 8'832 = 18'768). Upkeep, flat: ICC 25 % x 19'872 = 4'968 (2026: 25 % x
// 18'768 = 4'692); IFD 20 % x 27'600 = 5'520. IIC 0.2 per mille x 930'000 = 186.00.
// ICC 2025: 11.10 118'000, 31.10 -7'434, 31.12 -8'260, 31.50 3 % x 102'306 = 3'069 above 1'812:
// -1'812; 21.10 82'000, 41.10 -5'166, 41.12 -4'920, 41.50 3 % x 71'914 above 1'812: -1'812; 15.10
// 19'872; 58.00 -4'968; 41.95 the lower earned income (70'102): -1'051; 52.21 -11'600 (under 2 x
// 17'122); 55.10 -6'750 (under 19'872 + 50'000). 91.00 219'872; 95.00 = 166'099. Rate: 50 % =
// 83'049.5 -> 83'050: 6'996.00 + 5'532 x 14.20 % = 785.544 -> 785.55: 7'781.55. Base 166'099 x
// 7'781.55 / 83'050 = 15'563.00. Centimes 47.5 % 7'392.425 -> 7'392.45; reduction 12 % of
// 22'955.45 = 2'754.654 -> 2'754.65; home care 155.63 -> 155.65; cantonal 20'356.45. Lancy 2025:
// PP 49 % = 7'625.87 -> 7'625.85 x 47 % = 3'584.15; rest 7'937.15 x 47 % = 3'730.46 -> 3'730.45.
// Wealth: 35'000 + 669'600 = 704'600 less 450'000 = 254'600; couple 175'264: 79'336. Scale 1.49 per
// mille: 118.21 -> 118.20; centimes 56.145 -> 56.15; home care 1.18 -> 1.20; supplementary 0:
// 175.55. Communal: 49 % x 118.20 = 57.92 -> 57.90 x 47 % = 27.21 -> 27.20; rest 60.30 x 47 % =
// 28.34 -> 28.35. Taxe personnelle 25. ICC 20'356.45 + 175.55 + 7'314.60 + 55.55 + 25 = 27'927.15.
// ICC 2026: 15.10 18'768, 58.00 -4'692: 95.00 = 165'271; rate 82'636 (82'635.5): 6'996.00 + 5'118 x
// 14.20 % = 726.756 -> 726.75: 7'722.75; base 165'271 x 7'722.75 / 82'636 = 15'445.40; centimes
// 7'336.565 -> 7'336.55; reduction 2'733.85; home care 154.45; cantonal 20'202.55. Lancy 2026: PP
// 51 % = 7'877.15 -> 3'702.25; rest 7'568.25 -> 3'557.10. Wealth 667'400 - 450'000 - 175'264 =
// 42'136: 62.78 -> 62.80; 29.85; 0.65; 93.30; communal 15.05 + 14.45. ICC 27'609.70.
// IFD: 31.20 3 % x 102'306 = 3'069; 41.20 3 % x 71'914 = 2'157; 15.10 27'600; 58.00 -5'520; 41.90
// 50 % of 69'757, at most 14'100; 52.00 3'700; 55.10 -6'750; 59.20 -2'800. 95.00 = 227'600 -
// 63'876 = 163'724. Married scale at 163'700: 2025 6'687.00 + 37 x 13.00 = 7'168.00; 2026 6'680.00
// + 481 = 7'161.00.
function chevalley(taxYear: 2025 | 2026): EngineInput {
  return {
    taxYear,
    commune: 'lancy',
    civilStatus: 'married',
    people: [
      { id: 'p1', employments: [job(118_000, 7_434, 8_260)] },
      { id: 'p2', employments: [job(82_000, 5_166, 4_920)] },
    ],
    household: { healthPremiums: v(11_600) },
    wealthItems: [
      w('14.00', 'wealth', 35_000),
      w('55.20', 'wealth_deduction', 450_000),
      w('55.20', 'deduction', 6_750),
    ],
    property: {
      owner: 'household',
      use: 'own_home',
      kind: 'flat',
      since: 2019,
      old: true,
      value: v(930_000),
      rentalValue: v(27_600),
      mortgageInterest: v(6_750),
    },
  };
}

// P2. Nadia Bertholet, single, Thônex: a salary, savings without interest, and the house she has
// lived in since 2004 (over 10 years old), with actual upkeep of 14'800 that year (a new roof
// covering, the building's insurance, the IIC billed). The AFC's values: tax value 1'150'000,
// rental value 32'400. Abattement: 2004 to 2025, 22 years: at most 40 % (2026: 23 years, 40 %).
// Tax value 1'150'000 - 460'000 = 690'000; rental value federal 32'400, cantonal 32'400 - 12'960 =
// 19'440. Upkeep: ICC flat 25 % x 19'440 = 4'860, IFD flat 20 % x 32'400 = 6'480; the actual
// 14'800 is higher in both. IIC 0.2 per mille x 1'150'000 = 230.00. Taux d'effort: 20 % of 91.00
// (136'000 + 19'440 = 155'440) = 31'088 > 19'440: none (2026 the same).
// ICC: 11.10 136'000, 31.10 -8'568, 31.12 -10'880, 31.50 -1'812 (3 % x 116'552 above it); 15.10
// 19'440; 58.00 -14'800; 52.21 -6'200. 95.00 = 113'180. Scale: 6'996.00 + 35'662 x 14.20 % =
// 5'064.004 -> 5'064.00: 12'060.00. Centimes 5'728.50; reduction 12 % of 17'788.50 = 2'134.62 ->
// 2'134.60; home care 120.60; cantonal 15'774.50. Thônex PP 77 % = 9'286.20 x 44 % = 4'085.93 ->
// 4'085.95; rest 2'773.80 x 44 % = 1'220.47 -> 1'220.45 (both years).
// Wealth: 120'000 + 690'000 = 810'000; single 87'632: 722'368. Scale: 1'635.05 + 11'981 x 2.98 per
// mille = 35.70: 1'670.75; centimes 793.61 -> 793.60; home care 16.71 -> 16.70; supplementary
// 120.80 + 11'981 x 0.4463 per mille = 5.35: 126.15; cantonal 2'607.20. Communal 77 % = 1'286.48 ->
// 1'286.50 x 44 % = 566.06 -> 566.05; rest 384.25 -> 169.07 -> 169.05. ICC 24'448.20 (both years).
// IFD: 31.20 3 % x 116'552 = 3'497 (3'496.56); 15.10 32'400; 58.00 -14'800; 52.00 1'800. 95.00 =
// 128'855. Single scale at 128'800: 2025 4'694.40 + 38 x 8.80 = 5'028.80; 2026 4'688.55 + 334.40 =
// 5'022.95.
function bertholet(taxYear: 2025 | 2026): EngineInput {
  return {
    taxYear,
    commune: 'thonex',
    civilStatus: 'single',
    people: [{ id: 'p1', employments: [job(136_000, 8_568, 10_880)] }],
    household: { healthPremiums: v(6_200) },
    wealthItems: [w('14.00', 'wealth', 120_000)],
    property: {
      owner: 'p1',
      use: 'own_home',
      kind: 'house',
      since: 2004,
      old: true,
      value: v(1_150_000),
      rentalValue: v(32_400),
      upkeep: v(14_800),
    },
  };
}

// P3. Olivier Sandoz, single, Carouge: a salary, he rents the flat he lives in, and he lets a flat
// he owns in Carouge all year (built in 2019, at most 10 years old), with a mortgage. Its tax value
// 640'000 (no abattement: he doesn't live there); rents 26'400; the management account's costs
// 2'150; the mortgage 380'000, interest 4'940. Upkeep: ICC the actual 2'150 (no flat rate for a
// property let: guide p. 35); IFD the flat 10 % x 26'400 = 2'640, higher than the actual. IIC 1
// per mille x 640'000 = 640.00.
// ICC: 11.10 92'000, 31.10 -5'796, 31.12 -5'520, 31.50 -1'812 (3 % x 80'684 above it); 15.20
// 26'400; 58.00 -2'150; 52.21 -5'400; 55.10 -4'940 (under 26'400 + 50'000). 95.00 = 92'782. Scale:
// 6'996.00 + 15'264 x 14.20 % = 2'167.488 -> 2'167.50: 9'163.50; centimes 4'352.66 -> 4'352.65;
// reduction 12 % of 13'516.15 = 1'621.94 -> 1'621.95; home care 91.635 -> 91.65; cantonal
// 11'985.85. Carouge PP 27 % = 2'474.145 -> 2'474.15 x 40 % = 989.66 -> 989.65; rest 6'689.35 x 40
// % = 2'675.74 -> 2'675.75 (both years). Wealth: 40'000 + 640'000 - 380'000 - 87'632 = 212'368:
// 176.40 + 93'970 x 1.91 per mille = 179.48 -> 179.50: 355.90; centimes 169.05; home care 3.56 ->
// 3.55; supplementary 93'970 x 0.0956 per mille = 8.98 -> 9.00: cantonal 537.50. Communal 27 % =
// 96.09 -> 96.10 x 40 % = 38.44 -> 38.45; rest 259.80 -> 103.92 -> 103.90. ICC 16'356.10.
// IFD: 31.20 3 % x 80'684 = 2'421 (2'420.52); 15.20 26'400; 58.00 -2'640; 52.00 1'800; 55.10
// -4'940. 95.00 = 95'283. Single scale at 95'200: 2025 2'358.00 + 2 x 6.60 = 2'371.20; 2026
// 2'347.75 + 3 x 6.60 = 2'367.55.
function sandoz(taxYear: 2025 | 2026): EngineInput {
  return {
    taxYear,
    commune: 'carouge',
    civilStatus: 'single',
    people: [{ id: 'p1', employments: [job(92_000, 5_796, 5_520)] }],
    household: { healthPremiums: v(5_400) },
    wealthItems: [
      w('14.00', 'wealth', 40_000),
      w('55.20', 'wealth_deduction', 380_000),
      w('55.20', 'deduction', 4_940),
    ],
    property: {
      owner: 'p1',
      use: 'let',
      kind: 'flat',
      old: false,
      value: v(640_000),
      rents: v(26_400),
      upkeep: v(2_150),
      mortgageInterest: v(4_940),
    },
  };
}

// P4. Georges and Monique Perrenoud, married, Onex, retired: two AVS pensions (24'000, 18'000) and
// the house they have lived in since 1990, no mortgage. The AFC's values: tax value 780'000, rental
// value 26'000. Cantonal rental value 26'000 - 40 % = 15'600. Taux d'effort: 20 % of the gross
// income 91.00 (guide p. 51: "revenus bruts totaux (code 91.00)"), 42'000 + 15'600 = 57'600, at
// least of twice the first tax-free bracket (2 x 18'649 = 37'298): 11'520, below 15'600, and no
// interest finances the home: the taux d'effort lowers the rental value, and the documents don't
// say by how much (the reduction changes 91.00 itself). The cantonal tax fails closed, with its
// plain reason; the federal tax doesn't have the taux d'effort:
// 17.10 24'000 + 18'000, 15.10 26'000, 58.00 20 % = -5'200, 52.00 couple without 2nd pillar or 3a
// -5'550, 59.20 -2'800: 95.00 = 54'450; married scale at 54'400: 249.00 + 4 x 2.00 = 257.00 (2025
// and 2026).
function perrenoud(taxYear: 2025 | 2026): EngineInput {
  return {
    taxYear,
    commune: 'onex',
    civilStatus: 'married',
    people: [
      { id: 'p1', pensionAvs: v(24_000) },
      { id: 'p2', pensionAvs: v(18_000) },
    ],
    household: { healthPremiums: v(9_000) },
    wealthItems: [w('14.00', 'wealth', 30_000)],
    property: {
      owner: 'household',
      use: 'own_home',
      kind: 'house',
      since: 1990,
      old: true,
      value: v(780_000),
      rentalValue: v(26_000),
    },
  };
}

// P5. Antoine and Claire Vuilleumier, married, Meyrin: two salaries, the house they have lived in
// since 2012 with a mortgage, and a holiday home in France (abroad.test.ts, A2's home: bought for
// EUR 320'000 = 297'760, taxe d'habitation base EUR 6'200 = 5'809.62). The house: tax value
// 1'250'000, rental value 34'800, 40 %: 750'000 and 20'880; flat upkeep ICC 25 % = 5'220, IFD
// 20 % x 34'800 = 6'960; IIC 0.2 per mille = 250.00. The home in France: flat upkeep ICC 25 % x
// 5'809.62 = 1'452, IFD 20 % = 1'162. The mortgage 700'000, interest 10'500.
// The split (abroad.test.ts): gross assets here 60'000 + 750'000 = 810'000, abroad 297'760, in all
// 1'107'760 (26.88 %); the debts and interest go abroad in proportion: 700'000 x 297'760 /
// 1'107'760 = 188'156.28 and 10'500 x 297'760 / 1'107'760 = 2'822.34; the interest left here
// (7'677.66) is under the Swiss income from wealth, the house's rental value 20'880 (guide p. 37:
// the gross income from wealth): no surplus.
// ICC: 11.10 150'000, 31.10 -9'450, 31.12 -12'000, 31.50 -1'812; 21.10 60'000, 41.10 -3'780, 41.12
// -3'000, 41.50 3 % x 53'220 = -1'597; 15.10 5'809.62 and 20'880; 58.00 -1'452 and -5'220; 41.95
// -1'051; 52.21 -12'400; 55.10 -10'500. 91.00 236'689.62; 95.00 174'427.62. The whole net income
// before the other deductions 186'827.62, the home in France's 5'809.62 - 1'452 - 2'822.34 =
// 1'535.28: 97.00 = 174'427 x 1'535.28 / 186'827.62 = 1'433.4 -> 1'433; 99.00 172'994. Rate 50 %
// of 174'427 = 87'214: 6'996.00 + 9'696 x 14.20 % = 1'376.83 -> 1'376.85: 8'372.85; base 172'994 x
// 8'372.85 / 87'214 = 16'608.07 -> 16'608.05; centimes 7'888.82 -> 7'888.80; reduction 12 % of
// 24'496.85 = 2'939.62 -> 2'939.60; home care 166.08 -> 166.10; cantonal 21'723.35. Meyrin 2025: PP
// 30 % = 4'982.42 -> 4'982.40 x 42 % = 2'092.61 -> 2'092.60; rest 11'625.65 x 42 % = 4'882.77 ->
// 4'882.75; 2026: PP 29 % = 4'816.33 -> 4'816.35 -> 2'022.87 -> 2'022.85; rest 11'791.70 ->
// 4'952.51 -> 4'952.50.
// Wealth: 1'107'760 - 700'000 = 407'760; couple 175'264: 95.00 = 232'496; 97.00 = 232'496 x
// 297'760 / 1'107'760 = 62'493.6 -> 62'494; 99.00 = 170'002. Base: the scale at 232'496, 176.40 +
// 114'098 x 1.91 per mille = 217.93 -> 217.95: 394.35, x 170'002 / 232'496 = 288.35; centimes
// 136.97 -> 136.95; home care 2.88 -> 2.90; supplementary 114'098 x 0.0956 per mille = 10.91 ->
// 10.90, x 170'002 / 232'496 = 7.97 -> 7.95; cantonal 436.15. Communal 2025: 30 % = 86.50 x 42 % =
// 36.33 -> 36.35, rest 201.85 -> 84.78 -> 84.80; 2026: 29 % = 83.62 -> 83.60 -> 35.11 -> 35.10, rest
// 204.75 -> 86.00. ICC 2025 21'723.35 + 436.15 + 6'975.35 + 121.15 + 25 = 29'281.00; 2026 29'280.95.
// IFD: 31.20 3 % x 128'550 = 3'857 (3'856.5); 41.20 3 % x 53'220 = 1'597, at least 2'000; 15.10
// 5'809.62 and 34'800; 58.00 -1'162 and -6'960; 41.90 50 % of 51'220, at most 14'100; 52.00 3'700;
// 55.10 -10'500; 59.20 -2'800. 95.00 = 177'300.62; whole net income 183'800.62; France 5'809.62 -
// 1'162 - 2'822.34 = 1'825.28; 97.00 = 177'300 x 1'825.28 / 183'800.62 = 1'760.7 -> 1'761; 99.00
// 175'539. Married scale at 177'300: 2025 7'987.00 + 73 x 13.00 = 8'936.00, at the rate 175'500 x
// 8'936 / 177'300 = 8'845.28 -> 8'845.25; 2026 7'980.00 + 949 = 8'929.00 -> 8'838.35.
function vuilleumier(taxYear: 2025 | 2026): EngineInput {
  return {
    taxYear,
    commune: 'meyrin',
    civilStatus: 'married',
    people: [
      { id: 'p1', employments: [job(150_000, 9_450, 12_000)] },
      { id: 'p2', employments: [job(60_000, 3_780, 3_000)] },
    ],
    household: { healthPremiums: v(12_400) },
    wealthItems: [
      w('14.00', 'wealth', 60_000),
      w('55.20', 'wealth_deduction', 700_000),
      w('55.20', 'deduction', 10_500),
    ],
    property: {
      owner: 'household',
      use: 'own_home',
      kind: 'house',
      since: 2012,
      old: true,
      value: v(1_250_000),
      rentalValue: v(34_800),
      mortgageInterest: v(10_500),
    },
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

describe('P1 Julien and Anaïs Chevalley: their PPE flat in Lancy, a mortgage, the flat upkeep', () => {
  for (const year of [2025, 2026] as const) {
    it(`${year}: every line derived by hand`, () => {
      const r = computeReturn(chevalley(year));
      expect(r.unsupported).toEqual([]);
      const i = r.icc!;
      const vla = year === 2025 ? '19872.00' : '18768.00';
      const flat = year === 2025 ? '-4968.00' : '-4692.00';
      expect(codes(i.items)).toEqual([
        '11.10 118000.00',
        '31.10 -7434.00',
        '31.12 -8260.00',
        '31.50 -1812.00',
        '21.10 82000.00',
        '41.10 -5166.00',
        '41.12 -4920.00',
        '41.50 -1812.00',
        `15.10 ${vla}`,
        `58.00 ${flat}`,
        '41.95 -1051.00',
        '52.21 -11600.00',
        '55.10 -6750.00',
      ]);
      // With a mortgage, the interest line holds both kinds (PG3 55.00, from E1).
      expect(i.items.find((x) => x.code === '55.10')!.label.fr).toBe(
        'Intérêts chirographaires et hypothécaires',
      );
      expect(i.totalIncome.amount).toBe(chf(year === 2025 ? 166_099 : 165_271));
      expect(i.taxableIncome.amount).toBe(chf(year === 2025 ? 166_099 : 165_271));
      expect(i.rateIncome.amount).toBe(chf(year === 2025 ? 83_050 : 82_636));
      const x = i.taxes;
      expect(x.incomeBase.amount).toBe(chf(year === 2025 ? 15_563 : 15_445.4));
      expect(x.incomeCantonal.amount).toBe(chf(year === 2025 ? 20_356.45 : 20_202.55));
      expect(x.communalIncome.privileged.tax.amount).toBe(chf(year === 2025 ? 3_584.15 : 3_702.25));
      expect(x.communalIncome.rest.map((s) => s.tax.amount)).toEqual([
        chf(year === 2025 ? 3_730.45 : 3_557.1),
      ]);
      expect(codes(i.wealth.items)).toEqual([
        '14.00 35000.00',
        '55.20 -450000.00',
        `15.10 ${year === 2025 ? '669600.00' : '632400.00'}`,
      ]);
      expect(i.wealth.taxableWealth.amount).toBe(chf(year === 2025 ? 79_336 : 42_136));
      expect(x.wealthCantonal.amount).toBe(chf(year === 2025 ? 175.55 : 93.3));
      expect(x.total.amount).toBe(chf(year === 2025 ? 27_927.15 : 27_609.7));

      const f = r.ifd!;
      expect(codes(f.items)).toEqual([
        '11.10 118000.00',
        '31.10 -7434.00',
        '31.12 -8260.00',
        '31.20 -3069.00',
        '21.10 82000.00',
        '41.10 -5166.00',
        '41.12 -4920.00',
        '41.20 -2157.00',
        '15.10 27600.00',
        '58.00 -5520.00',
        '41.90 -14100.00',
        '52.00 -3700.00',
        '55.10 -6750.00',
        '59.20 -2800.00',
      ]);
      expect(f.taxableIncome.amount).toBe(chf(163_724));
      expect(f.tax.amount).toBe(chf(year === 2025 ? 7_168 : 7_161));
      expect(r.total).toBe(chf(year === 2025 ? 35_095.15 : 34_770.7));

      // The property in the result: the abattement, the flat upkeep in both taxes, the IIC apart.
      expect(r.property).toMatchObject({
        owner: 'household',
        use: 'own_home',
        kind: 'flat',
        since: 2019,
        abattementBp: year === 2025 ? 2800 : 3200,
        upkeep: { icc: 'flat', ifd: 'flat' },
      });
      expect(r.property!.value!.amount).toBe(chf(930_000));
      expect(r.property!.rentalValue!.amount).toBe(chf(27_600));
      expect(r.property!.iic!.amount).toBe(chf(186));
      // The taux d'effort: 20 % of 91.00 (200'000 + 19'872 in 2025, + 18'768 in 2026) = 43'974.40
      // or 43'753.60, far above the rental value: said, no change.
      expect(r.property!.effort!.amount).toBe(chf(year === 2025 ? 43_974 : 43_754));
      expect(r.assumptions).toContainEqual(PROPERTY_NOTE.effortChecked);
      expect(r.unverifiedRules).toContainEqual(PROPERTY_NOTE.iic);
      expect(r.estimates.map((e) => e.id)).toEqual(year === 2025 ? [] : ['ge-2026-unpublished']);
      // Every line of the property cites its documents.
      for (const it of [...r.property!.icc, ...r.property!.ifd, ...r.property!.wealth]) {
        expect(it.sources.length, it.code).toBeGreaterThan(0);
      }
      expect(r.property!.icc[0]!.sources.join(' ')).toMatch(/ge-na-law-lipp art\. 50 let\. e/);
      expect(r.property!.ifd[1]!.sources.join(' ')).toMatch(
        new RegExp(`ch-${year}-ifd-instructions-personnes-physiques p\\. 6`),
      );
    });
  }
});

describe('P2 Nadia Bertholet: her house in Thônex, actual upkeep above the flat rate', () => {
  for (const year of [2025, 2026] as const) {
    it(`${year}: every line derived by hand`, () => {
      const r = computeReturn(bertholet(year));
      expect(r.unsupported).toEqual([]);
      const i = r.icc!;
      expect(codes(i.items)).toEqual([
        '11.10 136000.00',
        '31.10 -8568.00',
        '31.12 -10880.00',
        '31.50 -1812.00',
        '15.10 19440.00',
        '58.00 -14800.00',
        '52.21 -6200.00',
      ]);
      expect(i.totalIncome.amount).toBe(chf(113_180));
      const x = i.taxes;
      expect(x.incomeBase.amount).toBe(chf(12_060));
      expect(x.incomeCantonal.amount).toBe(chf(15_774.5));
      expect(x.communalIncome.privileged.tax.amount).toBe(chf(4_085.95));
      expect(x.communalIncome.rest.map((s) => s.tax.amount)).toEqual([chf(1_220.45)]);
      expect(codes(i.wealth.items)).toEqual(['14.00 120000.00', '15.10 690000.00']);
      expect(i.wealth.taxableWealth.amount).toBe(chf(722_368));
      expect(x.wealthBase.amount).toBe(chf(1_670.75));
      expect(x.wealthSupplementary.amount).toBe(chf(126.15));
      expect(x.wealthCantonal.amount).toBe(chf(2_607.2));
      expect(x.communalWealthTotal.amount).toBe(chf(566.05 + 169.05));
      expect(x.total.amount).toBe(chf(24_448.2));

      const f = r.ifd!;
      expect(codes(f.items)).toEqual([
        '11.10 136000.00',
        '31.10 -8568.00',
        '31.12 -10880.00',
        '31.20 -3497.00',
        '15.10 32400.00',
        '58.00 -14800.00',
        '52.00 -1800.00',
      ]);
      expect(f.taxableIncome.amount).toBe(chf(128_855));
      expect(f.tax.amount).toBe(chf(year === 2025 ? 5_028.8 : 5_022.95));
      expect(r.total).toBe(chf(year === 2025 ? 29_477 : 29_471.15));

      expect(r.property).toMatchObject({
        abattementBp: 4000,
        upkeep: { icc: 'actual', ifd: 'actual' },
      });
      expect(r.property!.iic!.amount).toBe(chf(230));
      // The choice in each tax, for the final check: the actual costs beat the flat rate.
      expect(r.limits).toContainEqual(
        expect.objectContaining({
          code: '58.00',
          tax: 'icc',
          kind: 'choice',
          given: chf(14_800),
          limit: chf(4_860),
          counted: chf(14_800),
        }),
      );
      expect(r.limits).toContainEqual(
        expect.objectContaining({
          code: '58.00',
          tax: 'ifd',
          kind: 'choice',
          given: chf(14_800),
          limit: chf(6_480),
          counted: chf(14_800),
        }),
      );
      expect(r.assumptions).toContainEqual(PROPERTY_NOTE.choice);
    });
  }
});

describe('P3 Olivier Sandoz: a flat let in Carouge all year, his own home rented', () => {
  for (const year of [2025, 2026] as const) {
    it(`${year}: every line derived by hand`, () => {
      const r = computeReturn(sandoz(year));
      expect(r.unsupported).toEqual([]);
      const i = r.icc!;
      expect(codes(i.items)).toEqual([
        '11.10 92000.00',
        '31.10 -5796.00',
        '31.12 -5520.00',
        '31.50 -1812.00',
        '15.20 26400.00',
        '58.00 -2150.00',
        '52.21 -5400.00',
        '55.10 -4940.00',
      ]);
      expect(i.totalIncome.amount).toBe(chf(92_782));
      const x = i.taxes;
      expect(x.incomeCantonal.amount).toBe(chf(11_985.85));
      expect(x.communalIncome.privileged.tax.amount).toBe(chf(989.65));
      expect(x.communalIncome.rest.map((s) => s.tax.amount)).toEqual([chf(2_675.75)]);
      expect(codes(i.wealth.items)).toEqual([
        '14.00 40000.00',
        '55.20 -380000.00',
        '15.20 640000.00',
      ]);
      expect(i.wealth.taxableWealth.amount).toBe(chf(212_368));
      expect(x.wealthCantonal.amount).toBe(chf(537.5));
      expect(x.total.amount).toBe(chf(16_356.1));

      const f = r.ifd!;
      expect(codes(f.items)).toEqual([
        '11.10 92000.00',
        '31.10 -5796.00',
        '31.12 -5520.00',
        '31.20 -2421.00',
        '15.20 26400.00',
        '58.00 -2640.00',
        '52.00 -1800.00',
        '55.10 -4940.00',
      ]);
      expect(f.taxableIncome.amount).toBe(chf(95_283));
      expect(f.tax.amount).toBe(chf(year === 2025 ? 2_371.2 : 2_367.55));
      expect(r.total).toBe(chf(year === 2025 ? 18_727.3 : 18_723.65));

      // No abattement and no taux d'effort for a property let; the IIC at 1 per mille.
      expect(r.property).toMatchObject({ use: 'let', upkeep: { icc: 'actual', ifd: 'flat' } });
      expect(r.property!.abattementBp).toBeUndefined();
      expect(r.property!.effort).toBeUndefined();
      expect(r.property!.iic!.amount).toBe(chf(640));
      // The interest limit counts the rents in the income from wealth (guide p. 37).
      expect(r.limits).toContainEqual(
        expect.objectContaining({ code: '55.10', tax: 'icc', limit: chf(26_400 + 50_000) }),
      );
    });
  }
});

describe('P4 Georges and Monique Perrenoud: the taux d’effort applies, the cantonal tax fails closed', () => {
  for (const year of [2025, 2026] as const) {
    it(`${year}: said plainly; the federal tax is computed`, () => {
      const r = computeReturn(perrenoud(year));
      expect(r.icc).toBeNull();
      expect(r.unsupported).toEqual([PROPERTY_UNSUPPORTED.effort]);
      expect(r.total).toBeNull();
      const f = r.ifd!;
      expect(codes(f.items)).toEqual([
        '17.10 24000.00',
        '17.10 18000.00',
        '15.10 26000.00',
        '58.00 -5200.00',
        '52.00 -5550.00',
        '59.20 -2800.00',
      ]);
      expect(f.taxableIncome.amount).toBe(chf(54_450));
      expect(f.tax.amount).toBe(chf(257));
      // The limit: 20 % x max(57'600, 2 x 18'649).
      expect(r.property!.effort!.amount).toBe(chf(11_520));
    });
  }

  it('with interest that finances the home above every limit, nothing is reduced', () => {
    // A mortgage of 30'000 interest: the limited value would count only if the interest were
    // not higher (LIPP art. 24 al. 2), and it is higher than the limited value however it is
    // read: 20 % of 91.00 before the reduction, 11'520, or after it, at most 25 % x 42'000 =
    // 10'500.
    const input = perrenoud(2025);
    const r = computeReturn({
      ...input,
      wealthItems: [
        ...input.wealthItems!,
        w('55.20', 'wealth_deduction', 600_000),
        w('55.20', 'deduction', 30_000),
      ],
      property: { ...input.property!, mortgageInterest: v(30_000) },
    });
    expect(r.icc).not.toBeNull();
    expect(r.assumptions).toContainEqual(PROPERTY_NOTE.effortInterest);
    expect(r.icc!.items.find((i) => i.code === '15.10')!.amount).toBe(chf(15_600));
  });
});

describe('P5 Antoine and Claire Vuilleumier: a house in Meyrin and a holiday home in France', () => {
  for (const year of [2025, 2026] as const) {
    it(`${year}: the two work together; the house counts among the Swiss assets`, () => {
      const r = computeReturn(vuilleumier(year));
      expect(r.unsupported).toEqual([]);
      const i = r.icc!;
      expect(codes(i.items)).toEqual([
        '11.10 150000.00',
        '31.10 -9450.00',
        '31.12 -12000.00',
        '31.50 -1812.00',
        '21.10 60000.00',
        '41.10 -3780.00',
        '41.12 -3000.00',
        '41.50 -1597.00',
        '15.10 5809.62',
        '58.00 -1452.00',
        '15.10 20880.00',
        '58.00 -5220.00',
        '41.95 -1051.00',
        '52.21 -12400.00',
        '55.10 -10500.00',
      ]);
      expect(r.abroad!.shareBp).toBe(2688);
      expect(r.abroad!.debts!.amount).toBe(chf(188_156.28));
      expect(r.abroad!.interestIcc!.amount).toBe(chf(2_822.34));
      expect(i.grossIncome.amount).toBe(chf(236_689.62));
      expect(i.totalIncome.amount).toBe(chf(174_427.62));
      expect(i.exemptIncome!.amount).toBe(chf(1_433));
      expect(i.taxableIncome.amount).toBe(chf(172_994));
      expect(i.rateIncome.amount).toBe(chf(87_214));
      const x = i.taxes;
      expect(x.incomeBase.amount).toBe(chf(16_608.05));
      expect(x.incomeCantonal.amount).toBe(chf(21_723.35));
      expect(x.communalIncome.privileged.tax.amount).toBe(chf(year === 2025 ? 2_092.6 : 2_022.85));
      expect(i.wealth.rateWealth!.amount).toBe(chf(232_496));
      expect(i.wealth.exemptWealth!.amount).toBe(chf(62_494));
      expect(i.wealth.taxableWealth.amount).toBe(chf(170_002));
      expect(x.wealthCantonal.amount).toBe(chf(436.15));
      expect(x.total.amount).toBe(chf(year === 2025 ? 29_281 : 29_280.95));
      const f = r.ifd!;
      expect(f.totalIncome.amount).toBe(chf(177_300.62));
      expect(f.exemptIncome!.amount).toBe(chf(1_761));
      expect(f.taxableIncome.amount).toBe(chf(175_539));
      expect(f.scaleTax.amount).toBe(chf(year === 2025 ? 8_936 : 8_929));
      expect(f.tax.amount).toBe(chf(year === 2025 ? 8_845.25 : 8_838.35));
      expect(r.total).toBe(chf(year === 2025 ? 38_126.25 : 38_119.3));
      expect(r.property!.iic!.amount).toBe(chf(250));
    });
  }
});

describe('the guide’s own example (ge-2025-guide-declaration-pp p. 33 and 34)', () => {
  it('a villa used since 2010: 40 % off, rental value 35’856, flat upkeep 7’171 and 5’379', () => {
    // "Capital selon estimation fiscale 1'400'000; Villa occupée de 2010 à 2025, soit 16 ans,
    // 16 x 4 % = 64 %, mais au maximum 40 %; 1'400'000 moins 560'000 = 840'000"; the indexed rental
    // value 35'856, "35'856 - 14'342 = 21'514"; "IFD Forfait = 35'856 x 20 % = 7'171"; "ICC
    // Forfait = 21'514 x 25 % = 5'379"; the invoices of 5'500 count for the IFD only below the flat.
    const r = computeReturn({
      taxYear: 2025,
      commune: 'geneve',
      civilStatus: 'single',
      people: [{ id: 'p1', employments: [job(160_000, 10_080, 12_000)] }],
      property: {
        owner: 'p1',
        use: 'own_home',
        kind: 'house',
        since: 2010,
        old: true,
        value: v(1_400_000),
        rentalValue: v(35_856),
        upkeep: v(5_500),
      },
    });
    const p = r.property!;
    expect(p.abattementBp).toBe(4000);
    expect(p.wealth.map((i) => i.amount)).toEqual([chf(840_000)]);
    expect(codes(p.icc)).toEqual(['15.10 21514.00', '58.00 -5500.00']);
    expect(codes(p.ifd)).toEqual(['15.10 35856.00', '58.00 -7171.00']);
    expect(p.upkeep).toEqual({ icc: 'actual', ifd: 'flat' });
    expect(r.limits).toContainEqual(
      expect.objectContaining({ code: '58.00', tax: 'icc', given: chf(5_500), limit: chf(5_379) }),
    );
  });
});

describe('what else the engine says', () => {
  it('a value or a rental value not known yet: the taxes are floors, and say so', () => {
    const input = chevalley(2026);
    const rest = { ...input.property! };
    delete rest.value;
    delete rest.rentalValue;
    const r = computeReturn({ ...input, property: rest });
    expect(r.complete).toBe(false);
    expect(r.incomplete).toContainEqual(PROPERTY_NOTE.noValue);
    expect(r.incomplete).toContainEqual(PROPERTY_NOTE.noRentalValue);
    expect(r.property!.wealth).toEqual([]);
    expect(r.property!.iic).toBeUndefined();
  });

  it('a property let without its age: no federal flat rate, said', () => {
    const input = sandoz(2025);
    const rest = { ...input.property! };
    delete rest.old;
    const r = computeReturn({ ...input, property: rest });
    expect(r.notCounted).toContainEqual(PROPERTY_NOTE.ageUnknown);
    expect(r.ifd!.items.find((i) => i.code === '58.00')!.amount).toBe(chf(-2_150));
  });

  it('a property let without costs: none for the cantonal tax, the flat rate for the federal', () => {
    const input = sandoz(2025);
    const rest = { ...input.property! };
    delete rest.upkeep;
    const r = computeReturn({ ...input, property: rest });
    expect(r.notCounted).toContainEqual(PROPERTY_NOTE.letNoCosts);
    expect(r.icc!.items.some((i) => i.code === '58.00')).toBe(false);
    expect(r.ifd!.items.find((i) => i.code === '58.00')!.amount).toBe(chf(-2_640));
  });

  it('what the answers put outside the simple case stops the whole return', () => {
    const t = { en: 'A property in Geneva of someone taxed at source', fr: 'x' };
    const r = computeReturn({
      ...bertholet(2025),
      property: { ...bertholet(2025).property!, unsupported: [t] },
    });
    expect(r.icc).toBeNull();
    expect(r.ifd).toBeNull();
    expect(r.property).toBeUndefined();
    expect(r.unsupported).toContainEqual(t);
  });

  it('a year of arrival or departure with a property in Geneva stops the whole return', () => {
    for (const period of [
      { kind: 'arrival', date: '2026-04-01' },
      { kind: 'departure', date: '2026-09-30' },
    ] as const) {
      const r = computeReturn({ ...bertholet(2026), period });
      expect(r.icc).toBeNull();
      expect(r.ifd).toBeNull();
      expect(r.property).toBeUndefined();
      expect(r.unsupported).toContainEqual(PROPERTY_UNSUPPORTED.partYear);
    }
  });

  it('without the property, the return is the same household’s without annexe D', () => {
    const input = bertholet(2025);
    delete input.property;
    const r = computeReturn(input);
    expect(r.property).toBeUndefined();
    expect(r.icc!.items.some((i) => i.code.startsWith('15.') || i.code === '58.00')).toBe(false);
  });
});

// --- From the ledger: the answers, the AFC's letter, the invoices, the mortgage ----------------

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

/** Nadia Bertholet's ledger: her answers, the AFC's letter and her upkeep invoices. */
function bertholetLedger(taxYear: 2025 | 2026, more: [string, FactValue][] = []) {
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
  put('profile.commune', 'thonex');
  put('profile.children_count', 0);
  put('profile.moved', 'no');
  put('profile.income_sources', ['salary'], undefined, 'p1');
  put('profile.special', ['real_estate']);
  put('profile.swiss_property', 'own_house');
  put('profile.swiss_property_owner', 'p1');
  put('profile.swiss_property_since', 2004);
  put('profile.swiss_property_old', true);
  put('profile.swiss_property_special', []);
  put('profile.swiss_property_loan', false);
  put('property.tax_value', chf(1_150_000), 'd_afc');
  put('property.rental_value', chf(32_400), 'd_afc');
  put('property.upkeep', chf(9_800), 'd_roof');
  put('property.upkeep', chf(5_000), 'd_insurance');
  put('salary.gross', chf(136_000), 'd_salary', 'p1');
  put('salary.social_contributions', chf(8_568), 'd_salary', 'p1');
  put('salary.lpp_ordinary', chf(10_880), 'd_salary', 'p1');
  for (const [key, value] of more) put(key, value);
  return {
    ledger: l,
    facts: l.view(),
    documents: [
      { ...doc('d_salary', 'salary_certificate', taxYear), person: 'p1' as const },
      doc('d_afc', 'property_values', taxYear),
      doc('d_roof', 'property_upkeep_invoices', taxYear),
      doc('d_insurance', 'property_upkeep_invoices', taxYear),
    ],
  };
}

describe('the property in Geneva read from the ledger', () => {
  it('reads the AFC’s values and adds up the upkeep invoices', () => {
    const { facts, documents } = bertholetLedger(2025);
    const out = propertyFromFacts(2025, facts, documents, ['p1']);
    expect(out.missing).toEqual([]);
    expect(out.input).toMatchObject({
      owner: 'p1',
      use: 'own_home',
      kind: 'house',
      since: 2004,
      old: true,
      value: { value: chf(1_150_000), status: 'stated' },
      rentalValue: { value: chf(32_400), status: 'stated' },
      upkeep: { value: chf(14_800), status: 'stated' },
    });
    expect(out.mortgage).toEqual([]);
    const r = computeReturn(engineInputFromFacts(2025, facts, documents).input!);
    expect(r.icc!.items.find((i) => i.code === '15.10')!.amount).toBe(chf(19_440));
    expect(r.icc!.items.find((i) => i.code === '58.00')!.amount).toBe(chf(-14_800));
  });

  it('takes the AFC’s values from one letter, the latest, never added up', () => {
    const { ledger, documents } = bertholetLedger(2025);
    ledger.append({
      key: 'property.tax_value',
      person: 'household',
      value: chf(1_160_000),
      status: 'stated',
      instance: 'd_afc2',
      source: { method: 'claude', docId: 'd_afc2', page: 1 },
    });
    const out = propertyFromFacts(
      2025,
      ledger.view(),
      [...documents, doc('d_afc2', 'property_values', 2025)],
      ['p1'],
    );
    expect(out.input!.value!.value).toBe(chf(1_160_000));
  });

  it('until the documents are in: the user’s own figures, as estimates', () => {
    const l = new Ledger(2026, KEYS_2026);
    const put = (key: string, value: FactValue) =>
      l.append({
        key,
        person: 'household',
        value,
        status: key.startsWith('plan.') ? 'estimate' : 'stated',
        source: { method: 'user', via: 'chat' },
      });
    put('profile.special', ['real_estate']);
    put('profile.swiss_property', 'own_flat');
    put('profile.swiss_property_owner', 'both');
    put('profile.swiss_property_since', 2019);
    put('profile.swiss_property_old', true);
    put('profile.swiss_property_special', []);
    put('profile.swiss_property_loan', true);
    put('plan.property_value', chf(930_000));
    put('plan.property_rental_value', chf(27_600));
    put('plan.mortgage_balance', chf(450_000));
    put('plan.mortgage_interest', chf(6_750));
    const out = propertyFromFacts(2026, l.view(), [], ['p1', 'p2']);
    expect(out.input).toMatchObject({
      owner: 'household',
      kind: 'flat',
      value: { value: chf(930_000), status: 'estimate' },
      rentalValue: { value: chf(27_600), status: 'estimate' },
      mortgageInterest: { value: chf(6_750), status: 'estimate' },
    });
    // The mortgage known only from the user's words: E1 55.20, as estimates.
    expect(out.mortgage.map((m) => [m.code, m.part, m.centimes, m.estimate])).toEqual([
      ['55.20', 'wealth_deduction', chf(450_000), true],
      ['55.20', 'deduction', chf(6_750), true],
    ]);
  });

  it('asks what is still open, and leaves out what the questionnaire says isn’t supported', () => {
    const open = bertholetLedger(2025).facts.filter((f) => f.key !== 'profile.swiss_property_old');
    expect(propertyFromFacts(2025, open, [], ['p1']).missing).toEqual([
      {
        en: 'the questions about your property in Geneva',
        fr: 'les questions sur votre immeuble à Genève',
      },
    ]);
    for (const more of [
      [['profile.swiss_property', 'other_canton']],
      [['profile.swiss_property', 'several']],
      [['profile.swiss_property_owner', 'others']],
      [['profile.swiss_property_special', ['part_let']]],
    ] as [string, FactValue][][]) {
      const { facts, documents } = bertholetLedger(2025, more);
      expect(propertyFromFacts(2025, facts, documents, ['p1']).input, JSON.stringify(more)).toBe(
        undefined,
      );
    }
  });

  it('someone taxed at source, or a move into the home this year: not supported, said plainly', () => {
    const { ledger, documents } = bertholetLedger(2025, [['profile.swiss_property_since', 2025]]);
    ledger.append({
      key: 'profile.taxed_at_source',
      person: 'p1',
      value: true,
      status: 'stated',
      source: { method: 'user', via: 'chat' },
    });
    const out = propertyFromFacts(2025, ledger.view(), documents, ['p1']);
    expect(out.input!.unsupported!.map((u) => u.en.split(':')[0])).toEqual([
      'A property in Geneva of someone taxed at source',
      'Your home in Geneva',
    ]);
    const r = computeReturn(engineInputFromFacts(2025, ledger.view(), documents).input!);
    expect(r.icc).toBeNull();
    expect(r.ifd).toBeNull();
  });

  it('a mortgage statement: a debt on E1 55.20 for the securities list and the engine', () => {
    const l = new Ledger(2025, KEYS_2026);
    const put = (key: string, value: number) =>
      l.append({
        key,
        person: 'household',
        value,
        status: 'stated',
        instance: 'd_mortgage',
        source: { method: 'claude', docId: 'd_mortgage', page: 1 },
      });
    put('debt.balance', chf(450_000));
    put('debt.interest', chf(6_750));
    const etat = etatDesTitres({
      taxYear: 2025,
      people: ['p1', 'p2'],
      facts: l.view(),
      documents: [doc('d_mortgage', 'mortgage_statement', 2025)],
    });
    expect(etat.other).toEqual([
      expect.objectContaining({
        rubric: 'debts',
        mortgage: true,
        value: chf(450_000),
        flow: chf(6_750),
      }),
    ]);
    expect(etat.items.map((i) => [i.code, i.rubric, i.part, i.centimes])).toEqual([
      ['55.20', 'mortgages', 'wealth_deduction', chf(450_000)],
      ['55.20', 'mortgageInterest', 'deduction', chf(6_750)],
    ]);
  });
});
