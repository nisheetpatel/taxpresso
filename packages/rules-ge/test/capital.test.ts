// The separate tax on lump sums from the 2nd pillar and pillar 3a (prestations en capital, 98.12),
// against the official documents (SPEC.md section 13). Synthetic households, made-up people.
//
// Documents and what is read in them:
//   ge-na-law-lipp art. 45: a fifth of the scale of art. 41, every lump sum of the year added up,
//     the spouses' too, splitting kept (art. 41 al. 2 to 4), no social deduction.
//   ge-2025-icc-tariff-pdf p. 2 to 4: the scale (cumulative tax 3'140.40 at 48'309, 6'996.00 at
//     77'518, 20'587.45 at 170'764; 13.20 % from 48'310, 14.20 % from 77'519, 15.60 % from
//     170'765), the splitting examples 3 and 4, and the order of the surcharges: + 47.5 % cantonal
//     centimes, - 12 % of base and centimes, + 1 % home care, + the communal centimes on the base
//     (ge-na-law-lcacant art. 2; ge-na-law-ldirpp art. 1).
//   ge-2025-communal-centimes-pdf and ge-2026-communal-centimes-arca: Carouge 40, Lancy 47,
//     Vernier 50 centimes, in 2025 and 2026.
//   ge-2025-source-capital-icc-tariff p. 1 to 4: the AFC's own rates of this tax at a flat 43.69 %
//     of communal centimes, for a single person: each range's rate is the tax at its middle,
//     rounded to the hundredth of a percent (all 623 rows match: extension/test/capital-tariff.test.ts
//     reads every row where the file was downloaded; the rows written out here always run).
//   ch-na-law-lifd art. 38 (p. 32): a fifth of the scales of art. 36 al. 1, 2 and 2bis first
//     sentence; art. 9 al. 1 (p. 5): the spouses' income added up. Form. 58c (ch-2025- and
//     ch-2026-ifd-tarif-personnes-physiques p. 1): "aussi pour des prestations en capital", the
//     amount rounded down to CHF 100, the tax rounded down to 5 centimes. The scales: ch-2025-ifd-
//     frais-professionnels-progression p. 3, ch-2026-ifd-progression-deductions p. 4.
//
// Every expected amount below was worked out by hand from these documents (and again with an
// independent script, not the engine): the steps are in the comment of each household.
import { ifdCapitalTax, Trace, type Line } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  capitalIcc,
  computeReturn,
  paramsFor,
  type CapitalInput,
  type EngineInput,
  type TaxResult,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amount = (centimes: number): Line =>
  new Trace().line(centimes, { en: 'amount', fr: 'montant' }, { en: '', fr: '' });

/** The rate in % to the hundredth, half up, of `tax` on `capital` (both in centimes). */
const ratePct = (tax: number, capital: number) =>
  (Math.floor((tax * 10_000) / capital + 0.5) / 100).toFixed(2);

const flat43_69 = { bp: 4369, label: { en: 'average', fr: 'moyenne' }, sources: [] };

describe('the AFC capital tariff 2025 (ge-2025-source-capital-icc-tariff)', () => {
  // [from, to, rate %], as printed (p. 1 to 4).
  const rows: [number, number, string][] = [
    [18_700, 18_799, '0.01'],
    [23_900, 23_999, '0.58'],
    [29_600, 29_699, '1.11'],
    [36_700, 36_899, '1.64'],
    [49_900, 50_199, '2.35'],
    [59_100, 59_399, '2.70'],
    [79_500, 79_999, '3.20'],
    [80_900, 81_399, '3.23'],
    [100_000, 100_499, '3.56'],
    [116_500, 117_499, '3.76'],
    [182_000, 183_999, '4.29'],
    [247_000, 249_999, '4.61'],
    [311_000, 313_999, '4.82'],
    [476_500, 481_999, '5.22'],
    [554_000, 560_999, '5.35'],
    [992_000, 1_009_999, '5.75'],
    [1_310_000, 1_339_999, '5.88'],
    [3_200_000, 3_399_999, '6.12'],
    [9_400_000, 11_419_999, '6.23'],
    [80_200_000, 111_999_999, '6.28'],
  ];
  const P = paramsFor(2025);
  it('gives the printed rate at the middle of each range, centimes included', () => {
    for (const [from, to, rate] of rows) {
      const mid = chf((from + to + 1) / 2);
      const r = capitalIcc(P, amount(mid), 'none', flat43_69);
      expect(ratePct(r.tax.amount, mid), `${from} to ${to}`).toBe(rate);
    }
  });
});

describe('the federal tax on pension capital (ch-na-law-lifd art. 38)', () => {
  it('is a fifth of the Form. 58c tax, rounded down to 5 centimes', () => {
    // Form. 58c 2026 prints 2'684.35 (single) and 1'816.00 (married) at 100'000.
    const single = ifdCapitalTax(paramsFor(2026).ifd, amount(chf(100_000)), 'single');
    const married = ifdCapitalTax(paramsFor(2026).ifd, amount(chf(100_000)), 'married');
    if ('unsupported' in single || 'unsupported' in married) throw new Error('not computed');
    expect(single.tax.scaleTax.amount).toBe(chf(2_684.35));
    expect(single.tax.tax.amount).toBe(chf(536.85)); // 536.87 down to 5 centimes
    expect(married.tax.scaleTax.amount).toBe(chf(1_816));
    expect(married.tax.tax.amount).toBe(chf(363.2));
  });
  it('takes the married scale for a single parent, without the reduction per child', () => {
    const r = ifdCapitalTax(paramsFor(2026).ifd, amount(chf(120_000)), 'parental');
    if ('unsupported' in r) throw new Error('not computed');
    // 2'251.00 at 108'700 + 113 x 6.00 = 2'929.00; a fifth: 585.80.
    expect(r.tax.tax.amount).toBe(chf(585.8));
  });
  it('drops the fraction under CHF 100 of the amount (Form. 58c note 1)', () => {
    const a = ifdCapitalTax(paramsFor(2025).ifd, amount(chf(85_099.95)), 'single');
    const b = ifdCapitalTax(paramsFor(2025).ifd, amount(chf(85_000)), 'single');
    if ('unsupported' in a || 'unsupported' in b) throw new Error('not computed');
    expect(a.tax.tax.amount).toBe(b.tax.tax.amount);
  });
  it('is not computed between 0 and CHF 25: the documents leave the minimum open', () => {
    // 25'000 single, 2026: 75.46 by the scale, a fifth is 15.05.
    const r = ifdCapitalTax(paramsFor(2026).ifd, amount(chf(25_000)), 'single');
    expect('unsupported' in r).toBe(true);
    // Under 15'200 the scale gives nothing: no tax, computed.
    const zero = ifdCapitalTax(paramsFor(2026).ifd, amount(chf(15_000)), 'single');
    if ('unsupported' in zero) throw new Error('not computed');
    expect(zero.tax.tax.amount).toBe(0);
  });
});

// The three households: what the capital tax changes. Their other income doesn't change it (it is
// taxed apart), so each has only what sets the splitting and the scale.
const favre = (year: 2025 | 2026, capital?: CapitalInput): EngineInput => ({
  taxYear: year,
  commune: 'carouge',
  civilStatus: 'single',
  people: [{ id: 'p1', pensionAvs: { value: chf(30_240) } }],
  ...(capital ? { capital } : {}),
});
const favreCapital = (year: number): CapitalInput => ({
  benefits: [
    {
      id: 'favre-3a',
      person: 'p1',
      pillar: 'pillar3a',
      amount: { value: chf(85_000) },
      date: `${year}-06-30`,
    },
  ],
  reasons: { p1: ['retirement'] },
});
const morel = (year: 2025 | 2026, capital?: CapitalInput): EngineInput => ({
  taxYear: year,
  commune: 'lancy',
  civilStatus: 'single',
  people: [
    {
      id: 'p1',
      employments: [
        {
          gross: { value: chf(95_000) },
          socialContributions: { value: chf(6_080) },
          pensionFund: { value: chf(6_650) },
        },
      ],
    },
  ],
  children: [{ custody: 'full' }],
  ...(capital ? { capital } : {}),
});
const morelCapital = (year: number): CapitalInput => ({
  benefits: [
    {
      id: 'morel-epl',
      person: 'p1',
      pillar: 'pillar2',
      amount: { value: chf(120_000) },
      date: `${year}-03-15`,
    },
  ],
  reasons: { p1: ['home'] },
});
const rochat = (year: 2025 | 2026, capital?: CapitalInput): EngineInput => ({
  taxYear: year,
  commune: 'vernier',
  civilStatus: 'married',
  people: [
    { id: 'p1', pensionAvs: { value: chf(30_240) } },
    { id: 'p2', pensionAvs: { value: chf(22_680) } },
  ],
  ...(capital ? { capital } : {}),
});
const rochatCapital = (year: number): CapitalInput => ({
  benefits: [
    {
      id: 'rochat-lpp',
      person: 'p1',
      pillar: 'pillar2',
      amount: { value: chf(300_000) },
      date: `${year}-09-30`,
    },
    {
      id: 'rochat-3a',
      person: 'p2',
      pillar: 'pillar3a',
      amount: { value: chf(60_000) },
      date: `${year}-11-15`,
    },
  ],
  reasons: { p1: ['retirement'], p2: ['retirement'] },
});

interface Expected {
  amount: number;
  rate: number;
  scale: number;
  base: number;
  cc: number;
  reduction: number;
  homeCare: number;
  cantonal: number;
  communal: number;
  icc: number;
  ifdScale: number;
  ifd: number;
  total: number;
}

function check(r: TaxResult, e: Expected) {
  const c = r.capital!;
  expect(c.amount.amount).toBe(chf(e.amount));
  const x = c.icc!;
  expect(x.rateIncome.amount).toBe(chf(e.rate));
  expect(x.scaleTax.amount).toBe(chf(e.scale));
  expect(x.base.amount).toBe(chf(e.base));
  expect(x.cantonalCentimes.amount).toBe(chf(e.cc));
  expect(x.reduction12.amount).toBe(chf(-e.reduction));
  expect(x.homeCare.amount).toBe(chf(e.homeCare));
  expect(x.cantonal.amount).toBe(chf(e.cantonal));
  expect(x.communal.amount).toBe(chf(e.communal));
  expect(x.tax.amount).toBe(chf(e.icc));
  expect(c.ifd!.scaleTax.amount).toBe(chf(e.ifdScale));
  expect(c.ifd!.tax.amount).toBe(chf(e.ifd));
  expect(c.total!.amount).toBe(chf(e.total));
  for (const l of [x.tax, c.ifd!.tax]) expect(l.sources.length).toBeGreaterThan(0);
}

describe('three households, hand-checked', () => {
  // Hélène Favre, single, Carouge, retired: her pillar 3a paid out at retirement, CHF 85'000.
  // ICC, no splitting: 6'996.00 at 77'518 + 7'482 x 14.20 % = 1'062.444 -> 1'062.45; 8'058.45.
  //   A fifth: 1'611.69 -> 1'611.70. Centimes 47.5 %: 765.5575 -> 765.55. 12 % of 2'377.25:
  //   285.27 -> 285.25. Home care 1 %: 16.117 -> 16.10. Cantonal 2'108.10. Carouge 40 %: 644.68
  //   -> 644.70. ICC 2'752.80 (2025 and 2026: Geneva's 2026 scale is the 2025 one, an estimate).
  // IFD, single scale: 2025: 1'500.00 at 82'000 + 30 x 6.60 = 1'698.00, a fifth 339.60;
  //   2026: 1'502.95 at 82'100 + 29 x 6.60 = 1'694.35 (Form. 58c 2026 prints it at 85'000), a fifth
  //   338.87 -> 338.85.
  const FAVRE = {
    amount: 85_000,
    rate: 85_000,
    scale: 8_058.45,
    base: 1_611.7,
    cc: 765.55,
    reduction: 285.25,
    homeCare: 16.1,
    cantonal: 2_108.1,
    communal: 644.7,
    icc: 2_752.8,
  };
  it('Favre: pillar 3a at retirement', () => {
    check(computeReturn(favre(2025, favreCapital(2025))), {
      ...FAVRE,
      ifdScale: 1_698,
      ifd: 339.6,
      total: 3_092.4,
    });
    const r = computeReturn(favre(2026, favreCapital(2026)));
    check(r, { ...FAVRE, ifdScale: 1_694.35, ifd: 338.85, total: 3_091.65 });
    expect(r.estimates.map((e) => e.id)).toContain('ge-2026-unpublished');
    expect(r.capital!.icc!.tax.estimates).toContain('ge-2026-unpublished');
    expect(r.capital!.ifd!.tax.estimates).toBeUndefined();
  });

  // Lucas Morel, Lancy, lives with his child: 2nd pillar paid out to buy shares of a housing
  // cooperative for his own flat (LPP art. 30c al. 3), CHF 120'000.
  // ICC, full splitting (LIPP art. 41 al. 3, kept by art. 45 al. 3): rate at 60'000: 3'140.40 at
  //   48'309 + 11'691 x 13.20 % = 1'543.212 -> 1'543.20; 4'683.60. On the whole amount:
  //   120'000 x 4'683.60 / 60'000 = 9'367.20. A fifth: 1'873.44 -> 1'873.45. Centimes: 889.888 ->
  //   889.90. 12 % of 2'763.35: 331.602 -> 331.60. Home care: 18.7345 -> 18.75. Cantonal
  //   2'450.50. Lancy 47 %: 880.5215 -> 880.50. ICC 3'331.00.
  // IFD, parental scale (the married scale, without the 263 per child: LIFD art. 38 al. 2):
  //   2025: 2'246.00 at 108'600 + 114 x 6.00 = 2'930.00, a fifth 586.00; 2026: 2'251.00 at
  //   108'700 + 113 x 6.00 = 2'929.00, a fifth 585.80.
  const MOREL = {
    amount: 120_000,
    rate: 60_000,
    scale: 9_367.2,
    base: 1_873.45,
    cc: 889.9,
    reduction: 331.6,
    homeCare: 18.75,
    cantonal: 2_450.5,
    communal: 880.5,
    icc: 3_331,
  };
  it('Morel: 2nd pillar for his own home, a single parent', () => {
    check(computeReturn(morel(2025, morelCapital(2025))), {
      ...MOREL,
      ifdScale: 2_930,
      ifd: 586,
      total: 3_917,
    });
    const r = computeReturn(morel(2026, morelCapital(2026)));
    check(r, { ...MOREL, ifdScale: 2_929, ifd: 585.8, total: 3_916.8 });
    expect(r.capital!.ifd!.scale).toBe('parental');
    expect(r.capital!.secondPillar).toBe(true);
  });

  // Pierre and Anne Rochat, Vernier, married: his pension fund capital at retirement, CHF 300'000,
  // and her pillar 3a, CHF 60'000, the same year: added up, CHF 360'000 (LIPP art. 45 al. 3;
  // LIFD art. 9 al. 1 and 38).
  // ICC, full splitting: rate at 180'000: 20'587.45 at 170'764 + 9'236 x 15.60 % = 1'440.816 ->
  //   1'440.80; 22'028.25. On the whole amount: 360'000 x 22'028.25 / 180'000 = 44'056.50. A fifth:
  //   8'811.30. Centimes: 4'185.3675 -> 4'185.35. 12 % of 12'996.65: 1'559.598 -> 1'559.60. Home
  //   care: 88.113 -> 88.10. Cantonal 11'525.15. Vernier 50 %: 4'405.65. ICC 15'930.80.
  // IFD, married scale: 2025: 5'686.00 at 152'300 + 2'077 x 13.00 = 32'687.00, a fifth 6'537.40;
  //   2026: 5'692.00 at 152'400 + 2'076 x 13.00 = 32'680.00, a fifth 6'536.00.
  const ROCHAT = {
    amount: 360_000,
    rate: 180_000,
    scale: 44_056.5,
    base: 8_811.3,
    cc: 4_185.35,
    reduction: 1_559.6,
    homeCare: 88.1,
    cantonal: 11_525.15,
    communal: 4_405.65,
    icc: 15_930.8,
  };
  it('Rochat: two lump sums of a married couple in the same year, taxed together', () => {
    check(computeReturn(rochat(2025, rochatCapital(2025))), {
      ...ROCHAT,
      ifdScale: 32_687,
      ifd: 6_537.4,
      total: 22_468.2,
    });
    const r = computeReturn(rochat(2026, rochatCapital(2026)));
    check(r, { ...ROCHAT, ifdScale: 32_680, ifd: 6_536, total: 22_466.8 });
    expect(r.capital!.items.map((i) => [i.code, i.person, i.amount])).toEqual([
      ['98.12', 'p1', chf(300_000)],
      ['98.12', 'p2', chf(60_000)],
    ]);
    // Added up, the rate rises with the sum: his lump sum alone would be taxed less.
    const alone = computeReturn(
      rochat(2026, { ...rochatCapital(2026), benefits: rochatCapital(2026).benefits.slice(0, 1) }),
    );
    expect(alone.capital!.icc!.tax.amount).toBeLessThan(r.capital!.icc!.tax.amount);
  });

  it('never changes the tax on the income, nor its total', () => {
    for (const [make, cap] of [
      [favre, favreCapital],
      [morel, morelCapital],
      [rochat, rochatCapital],
    ] as const) {
      for (const year of [2025, 2026] as const) {
        const without = computeReturn(make(year));
        const withCapital = computeReturn(make(year, cap(year)));
        expect(withCapital.icc).toEqual(without.icc);
        expect(withCapital.ifd).toEqual(without.ifd);
        expect(withCapital.total).toBe(without.total);
        expect(without).not.toHaveProperty('capital');
      }
    }
  });
});

describe('what is counted, and what fails closed', () => {
  const base = (capital: CapitalInput) => computeReturn(favre(2026, capital));
  const one = (over: Partial<CapitalInput['benefits'][number]> = {}) => ({
    person: 'p1' as const,
    pillar: 'pillar3a' as const,
    amount: { value: chf(40_000) },
    date: '2026-05-02',
    ...over,
  });

  it('adds up several lump sums of one person', () => {
    const two = base({
      benefits: [one(), one({ amount: { value: chf(45_000) } })],
      reasons: { p1: ['retirement'] },
    });
    expect(two.capital!.amount.amount).toBe(chf(85_000));
    expect(two.capital!.icc!.tax.amount).toBe(chf(2_752.8));
  });

  it('leaves out a lump sum paid another year (LIFD art. 38 al. 1bis)', () => {
    const r = base({ benefits: [one({ date: '2025-12-31' })], reasons: { p1: ['retirement'] } });
    expect(r).not.toHaveProperty('capital');
    expect(r.notCounted.some((n) => n.en.includes('2025-12-31'))).toBe(true);
  });

  it('counts an attestation without a date for the year, and says so', () => {
    const undated = { ...one() } as Partial<ReturnType<typeof one>>;
    delete undated.date;
    const r = base({
      benefits: [undated as CapitalInput['benefits'][number]],
      reasons: { p1: ['retirement'] },
    });
    expect(r.capital!.icc).not.toBeNull();
    expect(r.assumptions.some((n) => n.en.includes('without its date'))).toBe(true);
  });

  const blocked = (r: TaxResult) => {
    expect(r.capital!.icc).toBeNull();
    expect(r.capital!.ifd).toBeNull();
    expect(r.capital!.total).toBeNull();
    expect(r.unsupported.length).toBeGreaterThan(0);
    // The income tax is still computed.
    expect(r.icc).not.toBeNull();
  };
  it('is not computed without a reason', () => blocked(base({ benefits: [one()] })));
  it('is not computed on leaving Switzerland (taxed at source)', () =>
    blocked(base({ benefits: [one()], reasons: { p1: ['leaving'] } })));
  it('is not computed for another reason (98.75, or no tax)', () =>
    blocked(base({ benefits: [one()], reasons: { p1: ['retirement', 'other'] } })));
  it('is not computed for someone taxed at source', () =>
    blocked(base({ benefits: [one()], reasons: { p1: ['retirement'] }, atSource: ['p1'] })));
  it('is not computed in the year of an arrival from abroad', () =>
    blocked(base({ benefits: [one()], reasons: { p1: ['retirement'] }, arrivedFromAbroad: true })));

  it('computes a withdrawal to start self-employment like the others (the law taxes it alike)', () => {
    const r = base({ benefits: [one()], reasons: { p1: ['self_employment'] } });
    expect(r.capital!.icc).not.toBeNull();
  });

  it('stops the income tax when a buy-in and a 2nd pillar lump sum fall in the same year', () => {
    const input = morel(2026, morelCapital(2026));
    const job = input.people[0]!.employments![0]!;
    const r = computeReturn({
      ...input,
      people: [
        { ...input.people[0]!, employments: [{ ...job, pensionBuyIn: { value: chf(10_000) } }] },
      ],
    });
    expect(r.icc).toBeNull();
    expect(r.ifd).toBeNull();
    expect(r.total).toBeNull();
    expect(r.unsupported.some((n) => n.en.includes('79b'))).toBe(true);
    // The tax on the lump sum itself is computed.
    expect(r.capital!.total!.amount).toBe(chf(3_916.8));
    // A buy-in with a pillar 3a lump sum is fine.
    const favreBuyIn = computeReturn({
      ...favre(2026, favreCapital(2026)),
      people: [
        { id: 'p1', pensionAvs: { value: chf(30_240) }, pensionBuyIn: { value: chf(5_000) } },
      ],
    });
    expect(favreBuyIn.icc).not.toBeNull();
  });

  it('refuses a lump sum of someone not in the household', () => {
    expect(() => base({ benefits: [one({ person: 'p2' })], reasons: {} })).toThrow(
      /not in the household/,
    );
  });
});

describe('a seeded fuzz of households with lump sums', () => {
  function rng(seed: number) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  it('raises no error and gives no negative tax, and the income tax stays the same', () => {
    const R = rng(4242);
    const int = (lo: number, hi: number) => lo + Math.floor(R() * (hi - lo + 1));
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(R() * xs.length)]!;
    const communes = [
      'geneve',
      'carouge',
      'lancy',
      'vernier',
      'meyrin',
      'cologny',
      'anieres',
    ] as const;
    let computed = 0;
    for (let n = 0; n < 1500; n++) {
      const year = pick([2025, 2026] as const);
      const couple = R() < 0.5;
      const people: EngineInput['people'] = (couple ? ['p1', 'p2'] : ['p1']).map((id) => ({
        id: id as 'p1' | 'p2',
        ...(R() < 0.7
          ? {
              employments: [
                {
                  gross: { value: int(0, 300_000) * 100 },
                  socialContributions: { value: int(0, 20_000) * 100 },
                  ...(R() < 0.2 ? { pensionBuyIn: { value: int(1, 50_000) * 100 } } : {}),
                },
              ],
            }
          : { pensionAvs: { value: int(0, 45_000) * 100 } }),
      }));
      const children = Array.from({ length: int(0, 2) }, () => ({
        custody: pick(['full', 'shared'] as const),
      }));
      const benefits = Array.from({ length: int(1, 3) }, () => ({
        person: pick(couple ? (['p1', 'p2'] as const) : (['p1'] as const)),
        pillar: pick(['pillar2', 'pillar3a'] as const),
        amount: { value: int(0, 2_000_000) * 100 + int(0, 99) },
        ...(R() < 0.9
          ? { date: `${R() < 0.9 ? year : year - 1}-0${int(1, 9)}-1${int(0, 9)}` }
          : {}),
      }));
      const reasons = Object.fromEntries(
        (couple ? ['p1', 'p2'] : ['p1']).map((p) => [
          p,
          R() < 0.9
            ? [pick(['retirement', 'home', 'self_employment', 'leaving', 'other'] as const)]
            : [],
        ]),
      );
      const input: EngineInput = {
        taxYear: year,
        commune: pick(communes),
        civilStatus: couple ? 'married' : pick(['single', 'divorced', 'widowed'] as const),
        people,
        children,
        ...(children.some((c) => c.custody === 'shared') && !couple
          ? {
              childSupport: pick(['receives', 'pays', 'none'] as const),
              ifdParentalScale: R() < 0.5,
            }
          : {}),
        capital: {
          benefits,
          reasons,
          ...(R() < 0.05 ? { atSource: ['p1' as const] } : {}),
          ...(R() < 0.05 ? { arrivedFromAbroad: true } : {}),
        },
      };
      const r = computeReturn(input);
      const plain = computeReturn({ ...input, capital: { benefits: [] } });
      if (r.icc) expect(r.icc).toEqual(plain.icc);
      if (r.ifd) expect(r.ifd).toEqual(plain.ifd);
      const c = r.capital;
      if (!c) continue;
      expect(c.amount.amount).toBeGreaterThanOrEqual(0);
      for (const l of [c.icc?.tax, c.icc?.cantonal, c.icc?.communal, c.ifd?.tax, c.total]) {
        if (l) expect(l.amount).toBeGreaterThanOrEqual(0);
      }
      if (c.icc && c.ifd) {
        expect(c.total!.amount).toBe(c.icc.tax.amount + c.ifd.tax.amount);
        computed++;
      }
    }
    expect(computed).toBeGreaterThan(300);
  });
});
