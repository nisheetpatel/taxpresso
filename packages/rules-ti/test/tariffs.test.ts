// The tariffs against the official documents. The law's tariff (LT art. 35, as the decrees for
// 2025 and 2026 rewrote it; art. 49 for wealth) gives the tax at the top of each category: the
// engine reproduces every such amount. The canton's 2025 tables (ti-2025-guide-istruzioni-pf-pdf
// p. 51 for income, p. 52 for wealth) give the tax at many other amounts: every row is here, in
// centimes, as printed. The wealth table matches to the centime; the income table is within 10
// centimes of the engine below CHF 380,600 and within 50 centimes above, and the differences are
// pinned (src/tariff.ts, docs/sources/ti/NOTES.md, Open points).
import { describe, expect, it } from 'vitest';
import { categoryOf, categoryTax, tariffBase, tiParamsFor } from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
/** Rows where the canton’s 2025 table differs from the law’s straight lines (pinned below). */
const DIFFERENCES = 80;

/** p. 51: [taxable income in CHF, tax for single people, tax for spouses (null: none printed)]. */
const INCOME_TABLE_2025: readonly (readonly [number, number, number | null])[] = [
  [12_500, 2_000, null],
  [13_000, 4_615, null],
  [14_000, 9_850, null],
  [15_000, 15_080, null],
  [16_000, 20_315, null],
  [17_400, 27_640, null],
  [18_000, 31_210, null],
  [19_000, 37_160, null],
  [20_000, 43_110, null],
  [20_400, 45_490, 2_960],
  [20_800, 47_865, 4_530],
  [21_000, 48_650, 5_315],
  [22_000, 52_575, 9_240],
  [23_000, 56_495, 13_160],
  [24_800, 63_560, 20_225],
  [25_000, 64_345, 21_100],
  [26_000, 68_265, 25_455],
  [27_000, 75_765, 29_815],
  [28_200, 84_765, 35_050],
  [30_000, 98_260, 39_760],
  [30_100, 99_010, 40_020],
  [30_500, 102_795, 41_065],
  [31_000, 107_525, 42_375],
  [32_000, 116_985, 44_990],
  [33_100, 127_390, 47_865],
  [33_500, 131_175, 49_435],
  [34_000, 135_905, 51_400],
  [35_000, 145_365, 55_320],
  [36_000, 154_830, 59_240],
  [37_000, 164_285, 63_165],
  [38_000, 173_745, 67_090],
  [39_900, 191_725, 74_545],
  [40_000, 192_765, 74_935],
  [42_300, 216_630, 83_960],
  [42_500, 218_705, 85_270],
  [43_000, 223_890, 88_535],
  [44_000, 234_270, 95_080],
  [45_000, 244_645, 101_620],
  [46_000, 255_025, 108_160],
  [47_800, 273_705, 119_930],
  [48_000, 275_780, 121_500],
  [49_000, 286_155, 129_345],
  [50_000, 296_535, 137_195],
  [51_000, 306_915, 145_045],
  [52_700, 324_550, 158_385],
  [53_000, 327_845, 160_740],
  [54_000, 338_835, 168_590],
  [55_000, 349_820, 176_435],
  [56_000, 360_810, 184_285],
  [58_100, 383_885, 200_765],
  [59_000, 394_505, 207_830],
  [60_000, 406_300, 215_675],
  [60_600, 413_385, 220_385],
  [62_000, 429_900, 234_545],
  [63_000, 441_705, 244_660],
  [64_000, 453_505, 254_780],
  [65_000, 465_305, 264_895],
  [66_000, 477_105, 275_010],
  [67_000, 488_905, 285_125],
  [68_000, 500_705, 295_240],
  [69_000, 512_505, 305_355],
  [70_000, 524_305, 315_470],
  [71_000, 536_105, 325_585],
  [73_000, 559_705, 345_815],
  [73_500, 565_500, 350_875],
  [74_000, 571_300, 355_935],
  [75_000, 582_900, 366_045],
  [76_000, 594_495, 376_160],
  [77_000, 606_100, 386_280],
  [78_000, 617_690, 396_395],
  [79_800, 638_570, 414_605],
  [80_000, 640_890, 416_815],
  [81_000, 652_485, 427_890],
  [82_000, 664_085, 438_970],
  [83_000, 675_680, 450_045],
  [84_000, 687_280, 461_120],
  [85_000, 698_870, 472_190],
  [86_000, 710_470, 483_270],
  [87_000, 722_065, 494_345],
  [88_000, 733_665, 505_410],
  [90_400, 761_500, 531_990],
  [91_000, 768_460, 539_575],
  [91_400, 773_095, 544_635],
  [92_000, 780_575, 552_220],
  [93_000, 793_050, 564_865],
  [94_000, 805_515, 577_510],
  [95_000, 817_990, 590_160],
  [96_000, 830_460, 602_805],
  [97_000, 842_920, 615_445],
  [98_000, 855_395, 628_090],
  [99_000, 867_865, 640_740],
  [100_000, 880_330, 653_380],
  [101_000, 892_800, 666_025],
  [102_000, 905_270, 678_665],
  [105_000, 942_680, 716_605],
  [110_000, 1_005_025, 779_825],
  [113_900, 1_053_660, 829_135],
  [115_000, 1_068_050, 843_055],
  [122_600, 1_167_460, 939_145],
  [125_000, 1_198_850, 968_025],
  [135_000, 1_329_655, 1_088_370],
  [141_000, 1_408_140, 1_160_570],
  [145_000, 1_460_455, 1_212_200],
  [150_000, 1_525_860, 1_276_725],
  [160_000, 1_656_655, 1_405_790],
  [170_000, 1_787_465, 1_534_845],
  [183_200, 1_960_130, 1_705_210],
  [190_000, 2_049_075, 1_798_900],
  [200_000, 2_179_880, 1_936_680],
  [210_000, 2_310_670, 2_074_445],
  [227_800, 2_543_500, 2_319_685],
  [303_900, 3_611_945, 3_408_025],
  [350_000, 4_259_185, 4_083_380],
  [380_600, 4_688_810, 4_531_650],
  [400_000, 4_970_120, 4_815_880],
  [500_000, 6_420_100, 6_280_850],
  [600_000, 7_870_140, 7_745_820],
  [700_000, 9_320_080, 9_210_740],
  [761_400, 10_210_375, 10_110_250],
  [800_000, 10_770_080, 10_669_920],
  [900_000, 12_220_110, 12_119_940],
  [1_000_000, 13_670_100, 13_570_000],
];

/** p. 52: [taxable wealth in CHF, tax]. */
const WEALTH_TABLE_2025: readonly (readonly [number, number])[] = [
  [200_000, 20_000],
  [210_000, 22_000],
  [220_000, 24_000],
  [230_000, 26_000],
  [240_000, 28_000],
  [250_000, 30_000],
  [260_000, 32_000],
  [270_000, 34_000],
  [280_000, 36_000],
  [290_000, 38_500],
  [300_000, 41_000],
  [310_000, 43_500],
  [320_000, 46_000],
  [330_000, 48_500],
  [340_000, 51_000],
  [350_000, 53_500],
  [360_000, 56_000],
  [370_000, 58_500],
  [380_000, 61_000],
  [390_000, 63_500],
  [400_000, 66_000],
  [410_000, 68_500],
  [420_000, 71_000],
  [430_000, 73_500],
  [440_000, 76_000],
  [450_000, 78_500],
  [460_000, 81_000],
  [470_000, 83_500],
  [480_000, 86_000],
  [490_000, 88_500],
  [500_000, 91_000],
  [510_000, 93_500],
  [520_000, 96_000],
  [530_000, 98_500],
  [540_000, 101_000],
  [550_000, 103_500],
  [560_000, 106_000],
  [570_000, 108_500],
  [580_000, 111_000],
  [590_000, 113_500],
  [600_000, 116_000],
  [610_000, 118_500],
  [620_000, 121_000],
  [630_000, 123_500],
  [640_000, 126_000],
  [650_000, 128_500],
  [660_000, 131_000],
  [670_000, 133_500],
  [680_000, 136_000],
  [690_000, 138_500],
  [700_000, 141_000],
  [710_000, 144_000],
  [720_000, 147_000],
  [730_000, 150_000],
  [740_000, 153_000],
  [750_000, 156_000],
  [760_000, 159_000],
  [770_000, 162_000],
  [780_000, 165_000],
  [790_000, 168_000],
  [800_000, 171_000],
  [810_000, 174_000],
  [820_000, 177_000],
  [830_000, 180_000],
  [840_000, 183_000],
  [850_000, 186_000],
  [860_000, 189_000],
  [870_000, 192_000],
  [880_000, 195_000],
  [890_000, 198_000],
  [900_000, 201_000],
  [910_000, 204_000],
  [920_000, 207_000],
  [930_000, 210_000],
  [940_000, 213_000],
  [950_000, 216_000],
  [960_000, 219_000],
  [970_000, 222_000],
  [980_000, 225_000],
  [990_000, 228_000],
  [1_000_000, 231_000],
  [1_100_000, 261_000],
  [1_200_000, 291_000],
  [1_300_000, 321_000],
  [1_380_000, 345_000],
  [1_400_000, 350_000],
  [1_500_000, 375_000],
  [1_600_000, 400_000],
  [1_700_000, 425_000],
  [1_800_000, 450_000],
  [1_900_000, 475_000],
  [2_000_000, 500_000],
  [2_100_000, 525_000],
  [2_200_000, 550_000],
  [2_300_000, 575_000],
  [2_400_000, 600_000],
  [2_500_000, 625_000],
  [2_600_000, 650_000],
  [2_700_000, 675_000],
  [2_800_000, 700_000],
  [2_900_000, 725_000],
  [3_000_000, 750_000],
  [3_100_000, 775_000],
  [3_200_000, 800_000],
  [3_300_000, 825_000],
  [3_400_000, 850_000],
  [3_500_000, 875_000],
  [3_600_000, 900_000],
  [3_700_000, 925_000],
  [3_800_000, 950_000],
  [3_900_000, 975_000],
  [4_000_000, 1_000_000],
  [4_100_000, 1_025_000],
  [4_200_000, 1_050_000],
  [4_300_000, 1_075_000],
  [4_400_000, 1_100_000],
  [4_500_000, 1_125_000],
  [4_600_000, 1_150_000],
  [4_700_000, 1_175_000],
  [4_800_000, 1_200_000],
  [4_900_000, 1_225_000],
  [5_000_000, 1_250_000],
];

/**
 * The law's amount at the top of each category, as the decrees print them (2025: decree p. 7;
 * 2026: decree p. 5 and 6): [top in CHF, tax due in CHF].
 */
const LAW_SINGLE: readonly (readonly [number, number])[] = [
  [12_500, 20.0],
  [17_400, 276.4],
  [20_800, 478.65],
  [26_000, 682.65],
  [30_100, 990.1],
  [39_900, 1_917.25],
  [52_700, 3_245.5],
  [58_100, 3_838.85],
  [73_000, 5_597.05],
  [91_400, 7_730.95],
  [113_900, 10_536.6],
  [227_800, 25_435.0],
  [380_600, 46_888.1],
];
const LAW_FAMILY: readonly (readonly [number, number])[] = [
  [20_400, 29.6],
  [24_800, 202.25],
  [28_200, 350.5],
  [33_100, 478.65],
  [42_300, 839.6],
  [47_800, 1_199.3],
  [60_600, 2_203.85],
  [79_800, 4_146.05],
  [90_400, 5_319.9],
  [122_600, 9_391.45],
  [141_000, 11_605.7],
  [183_200, 17_052.1],
  [227_800, 23_196.85],
  [303_900, 34_080.35],
  [761_400, 101_102.5],
];

describe('income tariffs', () => {
  for (const year of [2025, 2026] as const) {
    const { single, family } = tiParamsFor(year).income;
    it(`${year}: the tax at the top of every category is the law's`, () => {
      for (const [top, tax] of LAW_SINGLE)
        expect(categoryTax(single.value, chf(top)), `${top}`).toBe(chf(tax));
      for (const [top, tax] of LAW_FAMILY)
        expect(categoryTax(family.value, chf(top)), `${top}`).toBe(chf(tax));
    });

    it(`${year}: no tax under CHF 12,500 (single) or 20,400 (family); fractions under CHF 100 dropped`, () => {
      expect(categoryTax(single.value, chf(12_499.95))).toBe(0);
      expect(categoryTax(single.value, chf(12_500))).toBe(chf(20));
      expect(categoryTax(single.value, chf(12_599))).toBe(chf(20));
      expect(categoryTax(family.value, chf(20_399))).toBe(0);
      expect(categoryTax(family.value, chf(20_400))).toBe(chf(29.6));
      expect(tariffBase(single.value, chf(54_321.6))).toBe(chf(54_300));
      expect(categoryTax(single.value, chf(54_399))).toBe(categoryTax(single.value, chf(54_300)));
    });
  }

  it('2025: the top rate is 14.5 %, 2026: 14 % (decree 2026 p. 5 and 6)', () => {
    const y25 = tiParamsFor(2025).income;
    const y26 = tiParamsFor(2026).income;
    // 380,600 is the top of the single tariff's last category but one: 46,888.10, then the top rate.
    expect(categoryTax(y25.single.value, chf(400_000))).toBe(chf(46_888.1 + 19_400 * 0.145));
    expect(categoryTax(y26.single.value, chf(400_000))).toBe(chf(46_888.1 + 19_400 * 0.14));
    // The family tariff: 101,102.50 at 761,400, then the top rate.
    expect(categoryTax(y25.family.value, chf(800_000))).toBe(chf(101_102.5 + 38_600 * 0.145));
    expect(categoryTax(y26.family.value, chf(800_000))).toBe(chf(101_102.5 + 38_600 * 0.14));
    // Everything below the last category is the same in both years.
    for (const income of [15_000, 47_800, 90_000, 250_000, 380_600]) {
      expect(categoryTax(y26.single.value, chf(income))).toBe(
        categoryTax(y25.single.value, chf(income)),
      );
      expect(categoryTax(y26.family.value, chf(income))).toBe(
        categoryTax(y25.family.value, chf(income)),
      );
    }
  });

  it('a straight line between two of the law’s amounts, to 5 centimes', () => {
    const { single } = tiParamsFor(2025).income;
    // 16,000: 276.40 at 17,400 and 20.00 at 12,500: 20 + 3,500 x 256.40 / 4,900 = 203.1429: 203.15.
    expect(categoryTax(single.value, chf(16_000))).toBe(chf(203.15));
    expect(categoryOf(single.value, chf(16_000))).toBe(2);
  });

  it('2025: every row of the canton’s table (Istruzioni p. 51) within 10 centimes below CHF 380,600, 50 above', () => {
    const { single, family } = tiParamsFor(2025).income;
    expect(INCOME_TABLE_2025).toHaveLength(122);
    const differences: [string, number, number][] = [];
    let rows = 0;
    for (const [income, s, m] of INCOME_TABLE_2025) {
      for (const [who, tariff, printed] of [
        ['single', single.value, s],
        ['family', family.value, m],
      ] as const) {
        if (printed === null) continue;
        rows += 1;
        const ours = categoryTax(tariff, chf(income));
        const diff = printed - ours;
        expect(Math.abs(diff), `${who} ${income}`).toBeLessThanOrEqual(income < 380_600 ? 10 : 50);
        if (diff !== 0) differences.push([who, income, diff]);
      }
    }
    expect(rows).toBe(122 + 113);
    // Pinned: the rows where the canton's table differs from the law's straight lines.
    expect(differences.length).toBe(DIFFERENCES);
    // The one at a category top: the table prints 34,080.25 for spouses at 303,900, the law 34,080.35.
    expect(differences).toContainEqual(['family', 303_900, -10]);
  });
});

describe('wealth tariff', () => {
  for (const year of [2025, 2026] as const) {
    const wealth = tiParamsFor(year).wealth.value;
    it(`${year}: every row of the canton’s 2025 table (Istruzioni p. 52), to the centime`, () => {
      expect(WEALTH_TABLE_2025).toHaveLength(122);
      for (const [w, tax] of WEALTH_TABLE_2025)
        expect(categoryTax(wealth, chf(w)), `${w}`).toBe(tax);
    });

    it(`${year}: none under CHF 200,000; fractions under CHF 1,000 dropped; 2.5 per mille above 5 million`, () => {
      expect(categoryTax(wealth, chf(199_999))).toBe(0);
      expect(categoryTax(wealth, chf(200_999))).toBe(chf(200));
      expect(categoryTax(wealth, chf(345_678))).toBe(categoryTax(wealth, chf(345_000)));
      // p. 52: above 5,000,000, CHF 12,500 + 2.5 per mille of the excess.
      expect(categoryTax(wealth, chf(6_000_000))).toBe(chf(12_500 + 1_000_000 * 0.0025));
    });
  }
});
