// Scales and rounding against the official tables and their worked examples, in centimes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { iccBaseIncomeTax2025 } from '../src/2025/icc.js';
import { RUBRICS } from '../src/engine/rubrics.js';
import {
  ICC_2025_WEALTH_SCALE,
  ICC_2025_WEALTH_SUPPLEMENTARY_SCALE,
} from '../src/2025/icc-wealth.js';
import {
  bracketTax,
  federalScaleTax,
  IFD_2025_MARRIED,
  IFD_2025_SINGLE,
  IFD_2026_MARRIED,
  IFD_2026_SINGLE,
  ifdScaleTax2026,
  round5,
  roundFranc,
  roundTo,
} from '@taxpresso/rules-ch';
import { paramsFor } from '../src/engine/params.js';
import {
  CAPITAL_ADDED_UP,
  CAPITAL_CENTIMES,
  CAPITAL_COMMUNE,
  CAPITAL_FIFTH,
} from '../src/law/capital.js';

const W = ICC_2025_WEALTH_SCALE.value;
const S = ICC_2025_WEALTH_SUPPLEMENTARY_SCALE.value;

describe('rounding', () => {
  it('rounds to 5 centimes, halves up', () => {
    expect(round5(223_212, 10)).toBe(22_320); // 223.212 -> 223.20 (tariff p. 3, example 2)
    expect(round5(205_785, 1000)).toBe(205); // 807 x 2.55 per mille = 2.05785 -> 2.05 (p. 6)
    expect(round5(2025, 10)).toBe(205); // 2.025 -> 2.05: a half goes up
    expect(roundTo(-2025, 10, 5)).toBe(-205);
  });
  it('rounds a share to the franc: 65,033 x 3 % = 1,950.99 is 1,951 (guide p. 19)', () => {
    expect(roundFranc(6_503_300 * 300, 10_000)).toBe(195_100);
  });
});

describe('ICC 2025 wealth scales (ge-2025-icc-tariff-pdf p. 5)', () => {
  it('matches the "impôt total" column of the base scale', () => {
    const totals: [number, number][] = [
      [118_398, 17_640],
      [236_795, 40_255],
      [355_193, 67_960],
      [473_591, 98_150],
      [710_387, 163_505],
      [947_182, 234_070],
      [1_183_977, 309_610],
      [1_420_773, 390_120],
      [1_775_966, 518_345],
    ];
    for (const [wealth, tax] of totals)
      expect(bracketTax(W, wealth * 100), String(wealth)).toBe(tax);
  });

  it('matches the "impôt total" column of the supplementary scale', () => {
    const totals: [number, number][] = [
      [118_398, 0],
      [236_795, 1_130],
      [355_193, 2_515],
      [473_591, 5_535],
      [710_387, 12_080],
      [947_182, 22_650],
      [1_183_977, 33_970],
      [1_420_773, 50_070],
      [1_775_966, 75_735],
      [3_551_932, 245_570],
    ];
    for (const [wealth, tax] of totals)
      expect(bracketTax(S, wealth * 100), String(wealth)).toBe(tax);
  });

  it('matches the worked example of the tariff (p. 6): 356,000', () => {
    // 679.60 + 807 x 2.55 per mille (2.05) = 681.65; supplementary 25.15 + 0.20 = 25.35.
    expect(bracketTax(W, 35_600_000)).toBe(68_165);
    expect(bracketTax(S, 35_600_000)).toBe(2_535);
  });

  it('matches the worked example of the guide (p. 49 and 50): 360,000', () => {
    // 679.60 + 4,807 x 2.55 per mille (12.25) = 691.85; supplementary 25.15 + 1.25 = 26.40.
    expect(bracketTax(W, 36_000_000)).toBe(69_185);
    expect(bracketTax(S, 36_000_000)).toBe(2_640);
  });
});

describe('ICC income scale through the engine', () => {
  it('gives the same base tax as the existing 2025 function, every few thousand francs', () => {
    const scale = paramsFor(2025).icc.incomeScale.value;
    for (let chf = 0; chf <= 900_000; chf += 3_137) {
      expect(bracketTax(scale, chf * 100), String(chf)).toBe(iccBaseIncomeTax2025(chf * 100));
    }
  });
});

// Every row of Form. 58c 2025 (ch-2025-ifd-tarif-personnes-physiques p. 1), before rounding.
const SINGLE_2025: [number, number][] = [
  [18_500, 2_541],
  [19_000, 2_926],
  [20_000, 3_696],
  [21_000, 4_466],
  [22_000, 5_236],
  [23_000, 6_006],
  [24_000, 6_776],
  [25_000, 7_546],
  [26_000, 8_316],
  [27_000, 9_086],
  [28_000, 9_856],
  [29_000, 10_626],
  [30_000, 11_396],
  [31_000, 12_166],
  [32_000, 12_936],
  [33_000, 13_706],
  [33_200, 13_860],
  [33_300, 13_948],
  [34_000, 14_564],
  [35_000, 15_444],
  [36_000, 16_324],
  [37_000, 17_204],
  [38_000, 18_084],
  [39_000, 18_964],
  [40_000, 19_844],
  [41_000, 20_724],
  [42_000, 21_604],
  [43_500, 22_920],
  [43_600, 23_184],
  [44_000, 24_240],
  [45_000, 26_880],
  [46_000, 29_520],
  [47_000, 32_160],
  [48_000, 34_800],
  [49_000, 37_440],
  [50_000, 40_080],
  [51_000, 42_720],
  [53_400, 49_056],
  [53_500, 49_320],
  [54_000, 50_640],
  [55_000, 53_280],
  [56_000, 55_920],
  [57_000, 58_560],
  [58_000, 61_200],
  [58_100, 61_497],
  [59_000, 64_170],
  [60_000, 67_140],
  [61_300, 71_001],
  [61_400, 71_298],
  [65_000, 81_990],
  [70_000, 96_840],
  [75_000, 111_690],
  [76_100, 114_955],
  [76_200, 115_549],
  [77_500, 123_271],
  [79_100, 132_775],
  [79_200, 133_369],
  [82_000, 150_000],
  [82_100, 150_660],
  [85_000, 169_800],
  [90_000, 202_800],
  [94_900, 235_140],
  [95_000, 235_800],
  [100_000, 268_800],
  [105_000, 301_800],
  [108_600, 325_560],
  [108_700, 326_220],
  [108_800, 326_880],
  [108_900, 327_760],
  [110_000, 337_440],
  [115_000, 381_440],
  [120_500, 429_840],
  [120_600, 430_720],
  [125_000, 469_440],
  [130_000, 513_440],
  [130_500, 517_840],
  [130_600, 518_720],
  [135_000, 557_440],
  [138_300, 586_480],
  [138_400, 587_360],
  [141_500, 614_640],
  [141_600, 615_740],
  [144_200, 644_340],
  [144_300, 645_440],
  [148_200, 688_340],
  [148_300, 689_440],
  [150_300, 711_440],
  [150_400, 712_540],
  [151_000, 719_140],
  [152_300, 733_440],
  [152_400, 734_540],
  [155_000, 763_140],
  [160_000, 818_140],
  [170_000, 928_140],
  [184_900, 1_092_040],
  [185_000, 1_093_360],
  [186_000, 1_106_560],
  [190_000, 1_159_360],
  [200_000, 1_291_360],
  [250_000, 1_951_360],
  [300_000, 2_611_360],
  [350_000, 3_271_360],
  [400_000, 3_931_360],
  [500_000, 5_251_360],
  [650_000, 7_231_360],
  [700_000, 7_891_360],
  [793_300, 9_122_920],
  [793_400, 9_124_100],
  [800_000, 9_200_000],
  [940_800, 10_819_200],
  [940_900, 10_820_350],
  [950_000, 10_925_000],
];
const MARRIED_2025: [number, number][] = [
  [33_000, 3_300],
  [33_200, 3_500],
  [33_300, 3_600],
  [34_000, 4_300],
  [35_000, 5_300],
  [36_000, 6_300],
  [37_000, 7_300],
  [38_000, 8_300],
  [39_000, 9_300],
  [40_000, 10_300],
  [41_000, 11_300],
  [42_000, 12_300],
  [43_500, 13_800],
  [43_600, 13_900],
  [44_000, 14_300],
  [45_000, 15_300],
  [46_000, 16_300],
  [47_000, 17_300],
  [48_000, 18_300],
  [49_000, 19_300],
  [50_000, 20_300],
  [51_000, 21_300],
  [53_400, 23_700],
  [53_500, 23_900],
  [54_000, 24_900],
  [55_000, 26_900],
  [56_000, 28_900],
  [57_000, 30_900],
  [58_000, 32_900],
  [58_100, 33_100],
  [59_000, 34_900],
  [60_000, 36_900],
  [61_300, 39_500],
  [61_400, 39_800],
  [65_000, 50_600],
  [70_000, 65_600],
  [75_000, 80_600],
  [76_100, 83_900],
  [76_200, 84_200],
  [77_500, 88_100],
  [79_100, 92_900],
  [79_200, 93_300],
  [82_000, 104_500],
  [82_100, 104_900],
  [85_000, 116_500],
  [90_000, 136_500],
  [94_900, 156_100],
  [95_000, 156_600],
  [100_000, 181_600],
  [105_000, 206_600],
  [108_600, 224_600],
  [108_700, 225_200],
  [108_800, 225_800],
  [108_900, 226_400],
  [110_000, 233_000],
  [115_000, 263_000],
  [120_500, 296_000],
  [120_600, 296_700],
  [125_000, 327_500],
  [130_000, 362_500],
  [130_500, 366_000],
  [130_600, 366_800],
  [135_000, 402_000],
  [138_300, 428_400],
  [138_400, 429_300],
  [141_500, 457_200],
  [141_600, 458_100],
  [144_200, 481_500],
  [144_300, 482_500],
  [148_200, 521_500],
  [148_300, 522_600],
  [150_300, 544_600],
  [150_400, 545_800],
  [151_000, 553_000],
  [152_300, 568_600],
  [152_400, 569_900],
  [155_000, 603_700],
  [160_000, 668_700],
  [170_000, 798_700],
  [184_900, 992_400],
  [185_000, 993_700],
  [186_000, 1_006_700],
  [190_000, 1_058_700],
  [200_000, 1_188_700],
  [250_000, 1_838_700],
  [300_000, 2_488_700],
  [350_000, 3_138_700],
  [400_000, 3_788_700],
  [500_000, 5_088_700],
  [650_000, 7_038_700],
  [700_000, 7_688_700],
  [793_300, 8_901_600],
  [793_400, 8_902_900],
  [800_000, 8_988_700],
  [940_800, 10_819_100],
  [940_900, 10_820_350],
  [950_000, 10_925_000],
];

describe('IFD 2025 scales (ch-2025-ifd-frais-professionnels-progression p. 3, Form. 58c 2025)', () => {
  it('matches every row of the single column', () => {
    for (const [income, tax] of SINGLE_2025) {
      expect(federalScaleTax(IFD_2025_SINGLE.value, income * 100), String(income)).toBe(tax);
    }
  });
  it('matches every row of the married and single-parent column', () => {
    for (const [income, tax] of MARRIED_2025) {
      expect(federalScaleTax(IFD_2025_MARRIED.value, income * 100), String(income)).toBe(tax);
    }
  });
  it('drops fractions under CHF 100 (note 1)', () => {
    expect(federalScaleTax(IFD_2025_SINGLE.value, 6_139_999)).toBe(
      federalScaleTax(IFD_2025_SINGLE.value, 6_130_000),
    );
  });
});

describe('IFD 2026 through the engine', () => {
  it('gives the same scale tax as the existing 2026 function', () => {
    for (let chf = 0; chf <= 1_000_000; chf += 1_234) {
      expect(federalScaleTax(IFD_2026_SINGLE.value, chf * 100), String(chf)).toBe(
        ifdScaleTax2026(chf * 100, 'single'),
      );
      expect(federalScaleTax(IFD_2026_MARRIED.value, chf * 100), String(chf)).toBe(
        ifdScaleTax2026(chf * 100, 'married'),
      );
    }
  });
});

describe('tax years', () => {
  it('fails closed on a year without official values', () => {
    expect(() => paramsFor(2024)).toThrow(/not supported/);
    expect(() => paramsFor(2027)).toThrow(/not supported/);
  });
  it('flags every Geneva value of 2026 as an estimate, and no federal one', () => {
    const p = paramsFor(2026);
    for (const v of Object.values(p.icc)) expect(v.estimate).toBe('ge-2026-unpublished');
    for (const v of Object.values(p.ifd)) expect(v).not.toHaveProperty('estimate');
    expect(p.communes.centimes).not.toHaveProperty('estimate');
    expect(p.communes.privilegedShare).not.toHaveProperty('estimate');
    for (const v of Object.values(paramsFor(2025).icc)) expect(v).not.toHaveProperty('estimate');
  });
  it('cites, on every constant, documents downloaded and checked (docs/sources/lock.json)', () => {
    const lock = JSON.parse(
      readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
    ) as Record<string, { status: string }>;
    for (const year of [2025, 2026]) {
      const p = paramsFor(year);
      const all = [
        ...Object.values(p.icc),
        ...Object.values(p.ifd),
        p.communes.centimes,
        p.communes.privilegedShare,
        p.personalTax,
        ...Object.values(RUBRICS),
        // The tax on pension capital (../src/law/capital.ts).
        CAPITAL_FIFTH,
        CAPITAL_ADDED_UP,
        CAPITAL_COMMUNE,
        ...Object.values(CAPITAL_CENTIMES).map((source) => ({ source })),
      ];
      for (const v of all) {
        const ids = v.source.match(/\b(?:ge|ch)-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]/g) ?? [];
        expect(ids.length, v.source).toBeGreaterThan(0);
        for (const id of ids) expect(lock[id]?.status, `${id} in "${v.source}"`).toBe('ok');
      }
    }
  });
});
