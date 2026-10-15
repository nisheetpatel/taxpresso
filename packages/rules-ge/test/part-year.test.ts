// A year of arrival from abroad or of departure abroad in Geneva (SPEC.md section 1, the owner's
// decision of 14 October 2026), tax years 2025 and 2026: synthetic households, made-up names and
// figures, each tax derived by hand from the official documents, step by step below. The engine
// must match them to the centime.
//
// The rules (packages/rules-ge, engine/part-year.ts; packages/rules-ch, ifd/part-year.ts):
// - only the income of the period of tax liability is taxed, at the rate of the income converted
//   to twelve months; non-periodic income is not converted (ge-na-law-lipp art. 62 al. 3 and 4;
//   ch-na-law-lifd art. 40 al. 3, p. 33; ge-2025-guide-declaration-pp p. 53 and 54);
// - the conversion: x 360 / days of tax liability (ch-2026-afc-guide-futur-contribuable p. 30),
//   30 days to a month (ge-2026-source-directives p. 21, ch. 4.2.9): an arrival on 1 April is 270
//   days, on 1 July 180, a departure on 30 September 270;
// - the cantonal social deductions (family charges) in proportion, in full for the rate (LIPP art.
//   65 al. 2); the federal insurance deduction, two-earner deduction and social deductions in
//   proportion, not reduced for the rate (Form. 2a 2025 and 2026 p. 1); childcare pro rata
//   temporis and the reduction per child in proportion of taxable to rate income (ch-na-
//   circulaire-30-epoux-famille p. 54 and p. 26, ch. 13.4.6); the federal flat professional costs
//   "réduite de manière appropriée" (ch-na-ordonnance-frais-professionnels art. 7 al. 2): their
//   minimum and maximum in proportion; pillar 3a, the whole year's maximum (ch-na-law-opp3 art. 7).
//
// The other documents: the ICC scale (ge-2025-icc-tariff-pdf p. 2, also used for 2026), its
// surcharges (p. 4: 47.5 %, the 12 % reduction, 1 %); the federal scales (2026: LIFD art. 36 as
// consolidated on 1 January 2026; 2025: Form. 58c 2025 rows 58'000/58'100, 82'100, 94'900 and
// 120'600); the communes (ge-2025-communal-centimes-pdf: Genève PP 28 % CA 45.49, Meyrin PP 30 % CA
// 42, Carouge PP 27 % CA 40; ge-2026-part-privilegiee-communique p. 11: Genève 29 %, Meyrin 29 %,
// Carouge 27 %; ge-2026-communal-centimes-arca: 45.49, 42, 40). Rounding: each ICC line to 5
// centimes, flat deductions and prorated amounts to the franc, the federal tax rounded down to 5
// centimes. The same figures were checked by a separate script written from these documents.
import { Ledger, type FactValue, type Owner, type VaultDocument } from '@taxpresso/ledger';
import { days360, partYear } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  computeReturn,
  engineInputFromFacts,
  KEYS_2026,
  periodFromFacts,
  type EngineInput,
  type TaxResult,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const v = (francs: number) => ({ value: chf(francs) });

/** Lena Brandt, single, arrived from abroad on 1 April, Ville de Genève. */
function brandt(y: 2025 | 2026): EngineInput {
  return {
    taxYear: y,
    commune: 'geneve',
    civilStatus: 'single',
    people: [
      {
        id: 'p1',
        employments: [{ gross: v(72_000), socialContributions: v(4_608), pensionFund: v(3_600) }],
        pillar3a: v(7_258),
        commuteMode: { by: 'public_transport' },
        commuteCost: v(400),
      },
    ],
    household: { healthPremiums: v(4_500) },
    movable: [{ owner: 'p1', value: v(12_000) }],
    period: { kind: 'arrival', date: `${y}-04-01` },
  };
}

/**
 * Noor and Samir Haddad, married, arrived together from abroad on 1 July, Meyrin, one child under 14
 * with childcare; both taxed at source and in TOU, so taxed ordinarily. Samir earns `g1` for the
 * six months: 66,000 (132,000 a year: TOU compulsory) or 54,000 (108,000: TOU a choice).
 */
function haddad(y: 2025 | 2026, g1: number): EngineInput {
  return {
    taxYear: y,
    commune: 'meyrin',
    civilStatus: 'married',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: v(g1), socialContributions: v(g1 * 0.064), pensionFund: v(g1 * 0.05) },
        ],
        pillar3a: v(3_000),
      },
      {
        id: 'p2',
        employments: [{ gross: v(30_000), socialContributions: v(1_920), pensionFund: v(1_500) }],
      },
    ],
    children: [{ custody: 'full', under14: true, childcare: v(6_000) }],
    household: { healthPremiums: v(4_200) },
    period: { kind: 'arrival', date: `${y}-07-01` },
  };
}

/** Jonas Lindqvist, single, left Switzerland on 30 September, Carouge. */
function lindqvist(y: 2025 | 2026): EngineInput {
  return {
    taxYear: y,
    commune: 'carouge',
    civilStatus: 'single',
    people: [
      {
        id: 'p1',
        employments: [{ gross: v(90_000), socialContributions: v(5_760), pensionFund: v(4_500) }],
        pillar3a: v(7_258),
      },
    ],
    household: { healthPremiums: v(3_600) },
    movable: [{ owner: 'p1', value: v(20_000) }],
    period: { kind: 'departure', date: `${y}-09-30` },
  };
}

const item = (r: TaxResult, tax: 'icc' | 'ifd', code: string) =>
  r[tax]!.items.find((i) => i.code === code)?.amount;

describe('the days of tax liability, 30 to a month', () => {
  it('counts an arrival to 31 December and a departure from 1 January', () => {
    expect(partYear(2026, 'arrival', '2026-04-01')).toMatchObject({
      from: '2026-04-01',
      to: '2026-12-31',
      days: 270,
    });
    expect(partYear(2026, 'arrival', '2026-07-01').days).toBe(180);
    expect(partYear(2026, 'departure', '2026-09-30')).toMatchObject({
      from: '2026-01-01',
      to: '2026-09-30',
      days: 270,
    });
    // As the source-tax directives count (ch. 4.2.11): 15 to 31 March is 16 days.
    expect(days360('2026-03-15', '2026-03-31')).toBe(16);
    // A month's last day is its 30th, February included; a whole year is 360.
    expect(days360('2026-01-01', '2026-02-28')).toBe(60);
    expect(days360('2026-01-01', '2026-12-31')).toBe(360);
    expect(() => partYear(2026, 'arrival', '2025-12-01')).toThrow();
  });
});

describe('Lena Brandt: single, arrived on 1 April, a salary', () => {
  // 270 days. ICC, the period: 72,000 - 4,608 - 3,600 - 7,258 (3a, the year's maximum) - 1,812
  // (3 % of 63,792 = 1,914, at most 1,812, not reduced: LIPP art. 65 al. 2 reduces only social
  // deductions) - 4,500 premiums = 50,222. The year: 96,000 - 6,144 - 4,800 - 7,258 - 1,812 -
  // 6,000 premiums (converted: paid by the month) = 69,986. Scale at 69,986: 3,140.40 + 21,677 x
  // 13.2 % (2,861.35) = 6,001.75; base 50,222 x 6,001.75 / 69,986 = 4,306.85; centimes 2,045.75,
  // reduction -762.30, home care 43.05: cantonal 5,633.35; communal 45.49 % of the privileged
  // share and of the rest: 548.55 + 1,410.60 (2025: 28 %) = 1,959.15; personal tax 25 (due from the
  // first day of residence, directives ch. 8.8): ICC 7,617.50.
  // IFD, the period: 72,000 - 8,208 - 7,258 - 1,914 (3 % of 63,792, between 1,500 and 3,000: 2,000
  // and 4,000 x 270/360) - 400 transport - 1,350 (insurance, 1,800 x 270/360) = 52,870. The year:
  // 96,000 - 10,944 - 7,258 - 2,552 - 533 - 1,800 = 72,913, for the scale 72,900: 1,054.50 (2025
  // and 2026 alike); 52,800 x 1,054.50 / 72,900 = 763.75.
  for (const y of [2025, 2026] as const) {
    it(`${y}: the income of the period at a full year's rate`, () => {
      const r = computeReturn(brandt(y));
      expect(r.unsupported).toEqual([]);
      expect(r.partYear).toMatchObject({ kind: 'arrival', from: `${y}-04-01`, days: 270 });
      expect(item(r, 'icc', '31.50')).toBe(chf(-1_812));
      expect(r.icc!.taxableIncome.amount).toBe(chf(50_222));
      expect(r.icc!.rateIncome.amount).toBe(chf(69_986));
      expect(r.icc!.taxes.incomeBase.amount).toBe(chf(4_306.85));
      expect(r.icc!.taxes.incomeCantonal.amount).toBe(chf(5_633.35));
      expect(r.icc!.taxes.communalIncomeTotal.amount).toBe(chf(1_959.15));
      expect(r.icc!.taxes.wealthCantonal.amount).toBe(0);
      expect(r.icc!.taxes.personalTax.amount).toBe(chf(25));
      expect(r.icc!.taxes.total.amount).toBe(chf(7_617.5));
      expect(item(r, 'ifd', '31.20')).toBe(chf(-1_914));
      expect(item(r, 'ifd', '52.00')).toBe(chf(-1_350));
      expect(r.ifd!.taxableIncome.amount).toBe(chf(52_870));
      expect(r.ifd!.scaleIncome.amount).toBe(chf(72_900));
      expect(r.ifd!.scaleTax.amount).toBe(chf(1_054.5));
      expect(r.ifd!.tax.amount).toBe(chf(763.75));
      expect(r.total).toBe(chf(7_617.5 + 763.75));
      // The form's lines for the rate: 95.00 the year's net income, 97.00 the rest.
      expect(r.partYear!.icc!.rateTotal.amount).toBe(chf(69_986));
      expect(r.partYear!.icc!.notTaxed.amount).toBe(chf(69_986 - 50_222));
      expect(r.partYear!.ifd!.rateTotal.amount).toBe(chf(72_913));
      expect(r.partYear!.ifd!.notTaxed.amount).toBe(chf(72_913 - 52_870));
      // Said, with the documents' readings Taxpresso takes.
      expect(r.assumptions.map((a) => a.en).join(' ')).toMatch(/arrived from abroad on 1 April/);
      expect(r.unverifiedRules.map((a) => a.en).join(' ')).toMatch(/30 to a month/);
    });
  }

  it('without the period, the same household is a whole year (unchanged)', () => {
    const whole = brandt(2026);
    delete whole.period;
    const r = computeReturn(whole);
    expect(r.partYear).toBeUndefined();
    expect(r.icc!.taxableIncome.amount).toBe(chf(50_222));
    expect(r.icc!.rateIncome.amount).toBe(chf(50_222));
    expect(r.ifd!.atRate).toBeUndefined();
  });
});

describe('Noor and Samir Haddad: married, arrived together on 1 July, one child, TOU', () => {
  // 180 days. ICC: p1 66,000 - 4,224 - 3,300 - 3,000 - 1,754 (3 %); p2 30,000 - 1,920 - 1,500 - 797
  // - 1,051 (two earners, not reduced); premiums 4,200; childcare 6,000; family charge with
  // childcare 10,508 x 180/360 = 5,254 (LIPP art. 65 al. 2): 63,000. The year: 132,000 - 8,448 -
  // 6,600 - 3,000 - 1,812; 60,000 - 3,840 - 3,000 - 1,594 - 1,051; 8,400; 12,000; 10,508 in full:
  // 131,746, splitting 50 %: 65,873. Scale at 65,873: 3,140.40 + 17,564 x 13.2 % = 5,458.85; base
  // 63,000 x 5,458.85 / 65,873 = 5,220.75; cantonal 6,828.75; communal (42) 2,192.75; personal
  // tax 25: ICC 9,046.50.
  // IFD: flats 1,754 and 1,000 (2,000 x 1/2); two earners 50 % of 25,580, at most 14,100 x 1/2 =
  // 7,050; insurance (3,700 + 700) x 1/2 = 2,200; childcare 6,000; married 1,400; child 3,400:
  // 59,252. The year: 121,503, married scale at 121,500: 2025 2,967 + 9 x 7 = 3,030, 2026 2,965 +
  // 63 = 3,028; 59,200 x 3,030 / 121,500 = 1,476.30 (2026: 1,475.35); the reduction per child
  // 263 x 59,200 / 121,500 = 128.10 (circular 30 ch. 13.4.6): 1,348.20 (2026: 1,347.25).
  const cases = [
    { y: 2025, iccTotal: 9_046.5, ifdTax: 1_348.2, at: 1_476.3, year: 3_030 },
    { y: 2026, iccTotal: 9_046.5, ifdTax: 1_347.25, at: 1_475.35, year: 3_028 },
  ] as const;
  for (const c of cases) {
    it(`${c.y}: the couple's tax at the rate of 132,000 converted`, () => {
      const r = computeReturn(haddad(c.y, 66_000));
      expect(r.unsupported).toEqual([]);
      expect(item(r, 'icc', '41.95')).toBe(chf(-1_051));
      expect(item(r, 'icc', '61.25')).toBe(chf(-5_254));
      expect(r.icc!.taxableIncome.amount).toBe(chf(63_000));
      expect(r.icc!.rateIncome.amount).toBe(chf(65_873));
      expect(r.icc!.taxes.incomeBase.amount).toBe(chf(5_220.75));
      expect(r.icc!.taxes.total.amount).toBe(chf(c.iccTotal));
      expect(item(r, 'ifd', '41.20')).toBe(chf(-1_000));
      expect(item(r, 'ifd', '41.90')).toBe(chf(-7_050));
      expect(item(r, 'ifd', '52.00')).toBe(chf(-2_200));
      expect(item(r, 'ifd', '59.20')).toBe(chf(-1_400));
      expect(item(r, 'ifd', '61.20')).toBe(chf(-3_400));
      expect(r.ifd!.taxableIncome.amount).toBe(chf(59_252));
      expect(r.ifd!.scaleIncome.amount).toBe(chf(121_500));
      expect(r.ifd!.scaleTax.amount).toBe(chf(c.year));
      expect(r.ifd!.atRate!.amount).toBe(chf(c.at));
      expect(r.ifd!.childReduction.amount).toBe(chf(-128.1));
      expect(r.ifd!.tax.amount).toBe(chf(c.ifdTax));
    });
  }

  it('2026: a lower salary, 108,000 converted (TOU a choice): the same rules', () => {
    // ICC 52,687 at the rate of 110,482 split (55,241): base 3,867.90, ICC 6,708.75. IFD 48,939 at
    // the rate of 100,877 (married scale at 100,800: 1,561 + 59 x 5 = 1,856): 900.35, less 127.55
    // for the child: 772.80.
    const r = computeReturn(haddad(2026, 54_000));
    expect(r.icc!.taxableIncome.amount).toBe(chf(52_687));
    expect(r.icc!.rateIncome.amount).toBe(chf(55_241));
    expect(r.icc!.taxes.total.amount).toBe(chf(6_708.75));
    expect(r.ifd!.taxableIncome.amount).toBe(chf(48_939));
    expect(r.ifd!.scaleTax.amount).toBe(chf(1_856));
    expect(r.ifd!.tax.amount).toBe(chf(772.8));
  });
});

describe('Jonas Lindqvist: single, left Switzerland on 30 September', () => {
  // 270 days. ICC: 90,000 - 5,760 - 4,500 - 7,258 - 1,812 - 3,600 = 67,070; the year: 106,320
  // net converted (79,740 x 4/3) - 7,258 - 1,812 - 4,800 = 92,450. Scale at 92,450: 6,996.00 +
  // 14,932 x 14.2 % (2,120.35) = 9,116.35; base 67,070 x 9,116.35 / 92,450 = 6,613.65; cantonal
  // 8,650.70; communal (40) 2,645.50; personal tax 25: ICC 11,321.20. Wealth 20,000 on the day he
  // left, under the deduction: no wealth tax.
  // IFD: 79,740 - 7,258 - 2,392 (3 %) - 1,350 = 68,740; the year: 106,320 - 7,258 - 3,190 - 1,800 =
  // 94,072; single scale at 94,000: 2025 1,506.60 + 119 x 6.60 = 2,292.00, 2026 1,502.95 + 785.40 =
  // 2,288.35; 68,700 x 2,292 / 94,000 = 1,675.10 (2026: 1,672.40).
  for (const [y, ifd] of [
    [2025, 1_675.1],
    [2026, 1_672.4],
  ] as const) {
    it(`${y}: the income to the day of departure, the wealth on that day`, () => {
      const r = computeReturn(lindqvist(y));
      expect(r.unsupported).toEqual([]);
      expect(r.partYear).toMatchObject({ kind: 'departure', to: `${y}-09-30`, days: 270 });
      expect(r.icc!.taxableIncome.amount).toBe(chf(67_070));
      expect(r.icc!.rateIncome.amount).toBe(chf(92_450));
      expect(r.icc!.taxes.incomeBase.amount).toBe(chf(6_613.65));
      expect(r.icc!.taxes.total.amount).toBe(chf(11_321.2));
      expect(r.icc!.wealth.taxableWealth.amount).toBe(0);
      expect(r.ifd!.taxableIncome.amount).toBe(chf(68_740));
      expect(r.ifd!.tax.amount).toBe(chf(ifd));
      expect(r.assumptions.map((a) => a.en).join(' ')).toMatch(/wealth counts on the day you left/);
    });
  }
});

describe('fails closed where the documents don’t spell it out', () => {
  const closed = (input: EngineInput, why: RegExp) => {
    const r = computeReturn(input);
    expect(r.icc).toBeNull();
    expect(r.ifd).toBeNull();
    expect(r.unsupported.map((u) => u.en).join(' ')).toMatch(why);
  };
  it('self-employment, benefits, pay that isn’t monthly salary, an AVS pension', () => {
    const base = brandt(2026);
    const p1 = base.people[0]!;
    closed(
      { ...base, people: [{ ...p1, selfEmploymentProfit: v(20_000) }] },
      /Self-employment in the year you arrived/,
    );
    closed(
      { ...base, people: [{ ...p1, replacementIncome: v(5_000) }] },
      /Benefits replacing a salary/,
    );
    closed(
      {
        ...base,
        people: [{ ...p1, employments: [{ ...p1.employments![0]!, nonPeriodic: v(10_000) }] }],
      },
      /box 3 to 7/,
    );
    closed({ ...base, people: [{ ...p1, pensionAvs: v(20_000) }] }, /AVS or AI pension/);
  });

  it('wealth above the deduction: the cantonal tax only (LIPP art. 64 al. 3, 65 al. 2)', () => {
    const r = computeReturn({ ...brandt(2026), movable: [{ owner: 'p1', value: v(150_000) }] });
    expect(r.icc).toBeNull();
    expect(r.ifd).not.toBeNull();
    expect(r.unsupported.map((u) => u.en).join(' ')).toMatch(/Wealth tax not computed/);
  });

  it('a lump sum of pension capital in a year of departure: its tax only', () => {
    const r = computeReturn({
      ...lindqvist(2026),
      capital: {
        benefits: [{ person: 'p1', pillar: 'pillar3a', amount: v(50_000), reason: 'retirement' }],
        leftSwitzerland: true,
      },
    });
    expect(r.capital?.icc).toBeNull();
    expect(r.icc).not.toBeNull();
    expect(r.unsupported.map((u) => u.en).join(' ')).toMatch(/you left Switzerland this year/);
  });

  it('a date outside the tax year is refused', () => {
    expect(() =>
      computeReturn({ ...brandt(2026), period: { kind: 'arrival', date: '2025-04-01' } }),
    ).toThrow(/not in 2026/);
  });
});

describe('from the ledger', () => {
  const user = { method: 'user' as const, via: 'chat' as const };
  function ledgerOf(answers: [string, Owner, FactValue][]) {
    const ledger = new Ledger(2026, KEYS_2026);
    for (const [key, person, value] of answers) {
      ledger.append({ key, person, value, status: 'stated', source: user });
    }
    return ledger;
  }
  const cert = (id: string, from: string, to: string): VaultDocument => ({
    id,
    sha256: id,
    filename: `${id}.pdf`,
    path: `documents/${id}.pdf`,
    bytes: 1,
    addedAt: '2027-01-10T00:00:00.000Z',
    kind: 'salary_certificate',
    person: 'p1',
    taxYear: 2026,
    periodFrom: from,
    periodTo: to,
    parse: { method: 'claude', ok: true, warnings: [] },
  });

  it('reads the day, and asks for it until it is answered', () => {
    const base: [string, Owner, FactValue][] = [
      ['profile.civil_status', 'household', 'single'],
      ['profile.commune', 'household', 'geneve'],
      ['profile.moved', 'household', 'from_abroad'],
    ];
    const without = engineInputFromFacts(2026, ledgerOf(base).view(), []);
    expect(without.input).toBeNull();
    expect(without.missing.map((m) => m.en)).toContain('the day you arrived in Switzerland');
    const withDay = engineInputFromFacts(
      2026,
      ledgerOf([...base, ['profile.arrival_date', 'p1', '2026-04-01']]).view(),
      [],
    );
    expect(withDay.input?.period).toEqual({ kind: 'arrival', date: '2026-04-01' });
  });

  it('a couple on different days, or a certificate before the arrival: not supported', () => {
    const couple = periodFromFacts(
      2026,
      ledgerOf([
        ['profile.moved', 'household', 'from_abroad'],
        ['profile.arrival_date', 'p1', '2026-04-01'],
        ['profile.arrival_date', 'p2', '2026-06-01'],
      ]).view(),
      [],
      [{ id: 'p1' }, { id: 'p2' }],
    );
    expect(couple.unsupported.map((u) => u.en).join(' ')).toMatch(/different days/);
    const before = periodFromFacts(
      2026,
      ledgerOf([
        ['profile.moved', 'household', 'from_abroad'],
        ['profile.arrival_date', 'p1', '2026-04-01'],
      ]).view(),
      [cert('c1', '2026-01-01', '2026-12-31')],
      [{ id: 'p1' }],
    );
    expect(before.unsupported.map((u) => u.en).join(' ')).toMatch(
      /starts before the day you arrived/,
    );
    const matching = periodFromFacts(
      2026,
      ledgerOf([
        ['profile.moved', 'household', 'from_abroad'],
        ['profile.arrival_date', 'p1', '2026-04-01'],
      ]).view(),
      [cert('c1', '2026-04-01', '2026-12-31')],
      [{ id: 'p1' }],
    );
    expect(matching.unsupported).toEqual([]);
  });

  it('a move within Switzerland is not a part year (unchanged)', () => {
    const r = periodFromFacts(
      2026,
      ledgerOf([['profile.moved', 'household', 'from_other_canton']]).view(),
      [],
      [{ id: 'p1' }],
    );
    expect(r.input).toBeUndefined();
  });
});
