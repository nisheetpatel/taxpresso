// The federal tax is the same in every canton (LIFD; packages/rules-ch): for the same household,
// Basel-Stadt's Bund column must give Geneva's federal tax, to the centime, and Zurich's. Checked on
// seeded synthetic households through the three cantons' interfaces; then where each federal
// deduction stands on the Basel-Stadt form (main form p. 3, forms B, K, Z and F, Bund column).
// Basel-Stadt's form lays out the federal deductions as Zurich's does (the illness costs and the
// donations on the net income 709, the parties before it, the couple deduction 760 after 739: main
// form p. 3; Form. 2a 2026 p. 9, chiffres 20, 21 and 23), so it equals Zurich's federal tax where
// Geneva's form differs from both (packages/rules-zh, test/federal.test.ts, open points).
import type { HouseholdInput, PersonInput } from '@taxpresso/rules-ch';
import { COMMUNES_2026, rules as geneva } from '@taxpresso/rules-ge';
import { communesFor as zurichCommunes, rules as zurich } from '@taxpresso/rules-zh';
import { describe, expect, it } from 'vitest';
import { federalTotals, rules as basel, type BaselCantonal, type Item } from '../src/index.js';

/** A household as every canton takes it, without what only one asks for. */
type Shared = Omit<HouseholdInput, 'cantonal'>;

const chf = (francs: number) => Math.round(francs * 100);

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

const R = rng(20261016);
const int = (lo: number, hi: number) => lo + Math.floor(R() * (hi - lo + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(R() * xs.length)]!;
const maybe = (p = 0.5) => R() < p;
const status = () => pick(['stated', 'stated', 'verified', 'estimate', 'extracted'] as const);
const amt = (lo: number, hi: number) => ({ value: chf(int(lo, hi)), status: status() });

const ZURICH = zurichCommunes(2026)
  .value.filter((c) => new Set(c.rates).size === 1)
  .map((c) => c.bfs);

function person(id: 'p1' | 'p2'): PersonInput {
  const p: Record<string, unknown> = { id };
  if (maybe(0.9)) {
    // As on a real salary certificate: the contributions (boxes 9 and 10) are part of the salary.
    p.employments = Array.from({ length: int(1, 2) }, () => {
      const gross = int(15_000, 220_000);
      const part = (lo: number, hi: number) => amt(Math.floor(gross * lo), Math.floor(gross * hi));
      return {
        gross: { value: chf(gross), status: status() },
        ...(maybe(0.9) ? { socialContributions: part(0.05, 0.07) } : {}),
        ...(maybe(0.7) ? { pensionFund: part(0, 0.1) } : {}),
        ...(maybe(0.1) ? { pensionBuyIn: part(0.01, 0.1) } : {}),
        ...(maybe(0.15) ? { canteen: true } : {}),
      };
    });
  }
  if (maybe(0.08)) p.pensionAvs = amt(10_000, 30_000);
  if (maybe(0.08)) p.pensionOccupational = amt(5_000, 40_000);
  if (maybe(0.05)) p.alimonyReceived = amt(1_000, 20_000);
  if (maybe(0.5)) p.pillar3a = amt(500, 9_000);
  if (maybe(0.1)) p.pensionBuyIn = amt(1_000, 30_000);
  if (maybe(0.2)) p.hasPensionFund = maybe();
  const by = pick([
    'public_transport',
    'car',
    'motorbike',
    'bike',
    'walk',
    'home',
    undefined,
  ] as const);
  if (by) {
    p.commuteMode =
      by === 'car' || by === 'motorbike'
        ? maybe()
          ? { by, transitUsable: true }
          : { by, transitUsable: false, kmOneWay: int(1, 80), days: int(50, 240) }
        : { by };
    if (by === 'public_transport' || (by === 'car' && maybe())) p.commuteCost = amt(200, 6_000);
  }
  if (maybe(0.6)) p.mealDays = int(0, 240);
  if (maybe(0.1)) p.otherProfessionalCosts = amt(100, 8_000);
  if (maybe(0.08)) p.trainingCosts = amt(100, 15_000);
  return p as unknown as PersonInput;
}

/**
 * A household the three cantons compute, without a side job (the federal flat of 2025 is in no
 * federal document of the library, so Basel-Stadt fails closed, as Bern does) and with wealth
 * moderate enough for Basel-Stadt's wealth tax to stay under 5 per mille (§ 52). `wide`: also what
 * Geneva's form takes differently from Zurich's and Basel-Stadt's (medical costs and donations of a
 * couple, donations or party payments next to medical costs, benefits replacing a salary).
 */
function household(wide = false): Shared {
  const civil = pick(['single', 'married', 'married', 'divorced', 'widowed'] as const);
  const couple = civil === 'married';
  const kids = maybe(0.4) ? int(1, 3) : 0;
  const shared = !couple && kids > 0 && maybe(0.4);
  const h: Record<string, unknown> = {
    taxYear: pick([2025, 2026] as const),
    civilStatus: civil,
    people: couple ? [person('p1'), person('p2')] : [person('p1')],
    children: Array.from({ length: kids }, () => ({
      custody: shared && maybe(0.8) ? 'shared' : 'full',
      ...(maybe(0.4) ? { childcare: amt(500, 25_000) } : {}),
      ...(maybe(0.3) ? { under14: maybe(0.7) } : {}),
    })),
  };
  if (shared) {
    h.childSupport = pick(['receives', 'pays', 'none'] as const);
    h.ifdParentalScale = maybe();
  }
  const hh: Record<string, unknown> = {};
  if (maybe(0.7)) hh.healthPremiums = amt(2_000, 20_000);
  if (maybe(0.2)) hh.accidentPremiums = amt(100, 2_000);
  if (maybe(0.1)) hh.healthSubsidy = amt(500, 5_000);
  if (maybe(0.15)) hh.lifeInsurancePremiums = amt(500, 5_000);
  if (maybe(0.15)) hh.savingsInterest = amt(10, 2_000);
  // Geneva's form measures the medical costs after the couple deduction and the parties, and the
  // donations after the medical costs: only without those, unless `wide`.
  const medical = (wide || !couple) && maybe(0.3);
  if (medical) hh.medicalCosts = amt(100, 20_000);
  if ((wide || (!couple && !medical)) && maybe(0.3)) hh.donations = amt(10, 15_000);
  if ((wide || (!medical && !hh.donations)) && maybe(0.08)) hh.politicalParty = amt(10, 15_000);
  if (maybe(0.08)) hh.alimonyPaid = amt(1_000, 30_000);
  if (maybe(0.15)) hh.debtInterest = amt(100, 10_000);
  if (maybe(0.1)) hh.bankFees = amt(10, 1_000);
  if (Object.keys(hh).length) h.household = hh;
  if (wide && maybe(0.1)) {
    const p1 = (h.people as Record<string, unknown>[])[0]!;
    p1.replacementIncome = amt(1_000, 30_000);
  }
  if (maybe(0.5)) {
    h.movable = Array.from({ length: int(1, 3) }, () => ({
      owner: pick(couple ? (['p1', 'p2', 'household'] as const) : (['p1', 'household'] as const)),
      ...(maybe(0.9) ? { value: amt(100, 150_000) } : {}),
      ...(maybe(0.7) ? { income: amt(0, 3_000) } : {}),
    }));
  }
  return h as unknown as Shared;
}

/** What only Basel-Stadt asks: the work rates, the reference age, a single parent's situation. */
function baselOwn(h: Shared): BaselCantonal {
  const people = h.people.map((p) => p.id);
  return {
    workRate: Object.fromEntries(people.map((id) => [id, pick([40, 60, 80, 100, 100])])),
    referenceAge: Object.fromEntries(people.map((id) => [id, false])),
    childrenMinor: (h.children ?? []).map(() => true),
    church: false,
    ...(h.civilStatus !== 'married' ? { cohabiting: false } : {}),
    ...(h.childSupport ? { mainUpkeep: h.ifdParentalScale ?? false } : {}),
  };
}

function three(h: Shared) {
  const ge = geneva.computeReturn({ ...h, commune: pick(COMMUNES_2026).slug });
  const zh = zurich.computeReturn({
    ...h,
    commune: pick(ZURICH),
    ...(h.childSupport === 'none' ? { cantonal: { marriedTariff: h.ifdParentalScale } } : {}),
  });
  const bs = basel.computeReturn({
    ...h,
    commune: pick(['Basel', 'Riehen', 'Bettingen']),
    cantonal: baselOwn(h),
  });
  return { ge: ge.ifd, zh: zh.ifd, bs: bs.ifd, bsResult: bs };
}

describe('the federal tax on the Basel-Stadt return', () => {
  it('equals Geneva’s and Zurich’s federal tax for the same household, to the centime (2,000 households)', () => {
    let compared = 0;
    let skipped = 0;
    for (let i = 0; i < 2_000; i++) {
      const h = household();
      const { ge, zh, bs, bsResult } = three(h);
      const what = JSON.stringify(h);
      // Basel-Stadt's own tax not computed (a reading of the documents that changes the tax, a
      // low-yield wealth under § 52: docs/sources/bs/NOTES.md): nothing to compare.
      if (!bsResult.icc) {
        skipped++;
        continue;
      }
      expect(Boolean(bs), what).toBe(Boolean(ge));
      expect(Boolean(bs), what).toBe(Boolean(zh));
      if (!ge || !bs || !zh) continue;
      compared++;
      for (const other of [ge, zh]) {
        expect(bs.taxableIncome.amount, what).toBe(other.taxableIncome.amount);
        expect(bs.scale, what).toBe(other.scale);
        expect(bs.scaleTax.amount, what).toBe(other.scaleTax.amount);
        expect(bs.childReduction.amount, what).toBe(other.childReduction.amount);
        expect(bs.tax.amount, what).toBe(other.tax.amount);
        expect(Boolean(bs.tax.estimates?.length), what).toBe(Boolean(other.tax.estimates?.length));
        expect(Boolean(bs.tax.needsOk), what).toBe(Boolean(other.tax.needsOk));
      }
    }
    expect(compared).toBeGreaterThan(1_500);
    expect(skipped).toBeLessThan(400);
  });

  it('equals Zurich’s federal tax where Geneva’s form takes a deduction differently (1,000 households)', () => {
    let compared = 0;
    for (let i = 0; i < 1_000; i++) {
      const h = household(true);
      const { zh, bs, bsResult } = three(h);
      const what = JSON.stringify(h);
      if (!bsResult.icc) continue;
      expect(Boolean(bs), what).toBe(Boolean(zh));
      if (!bs || !zh) continue;
      compared++;
      expect(bs.taxableIncome.amount, what).toBe(zh.taxableIncome.amount);
      expect(bs.tax.amount, what).toBe(zh.tax.amount);
    }
    expect(compared).toBeGreaterThan(700);
  });

  it('medical costs of a married couple: measured before the couple deduction, as Zurich does', () => {
    // Main form p. 3: 725 on 709, the couple deduction 760 after 739 (Form. 2a 2026 p. 9, chiffres
    // 20 and 23); Geneva's form takes its couple deduction (59.20) before 92.20.
    const h: Shared = {
      taxYear: 2026,
      commune: 'Basel',
      civilStatus: 'married',
      people: [
        {
          id: 'p1',
          employments: [
            { gross: { value: chf(90_000) }, socialContributions: { value: chf(5_000) } },
          ],
        },
      ],
      household: { medicalCosts: { value: chf(10_000) } },
    };
    const bs = basel.computeReturn({ ...h, cantonal: { workRate: { p1: 100 }, church: false } });
    const zh = zurich.computeReturn({ ...h, commune: 261 }).ifd!;
    const ge = geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;
    const medical = (items: readonly { code: string; amount: number }[], code: string) =>
      -(items.find((i) => i.code === code)?.amount ?? 0);
    expect(medical(bs.ifd!.items, '725')).toBe(medical(zh.items, '320'));
    expect(bs.ifd!.tax.amount).toBe(zh.tax.amount);
    const couple = 2_800; // the federal couple deduction of 2026 (ch-2026-ifd-progression-deductions)
    expect(medical(ge.items, '71.00') - medical(bs.ifd!.items, '725')).toBe(chf(couple) * 0.05);
  });

  it('puts each federal deduction on its Basel-Stadt line, in the form’s order, and cites the federal rules', () => {
    const h: Shared = {
      taxYear: 2026,
      commune: 'Riehen',
      civilStatus: 'married',
      people: [
        {
          id: 'p1',
          employments: [
            {
              gross: { value: chf(110_000) },
              socialContributions: { value: chf(7_040) },
              pensionFund: { value: chf(7_700) },
            },
          ],
          commuteMode: { by: 'public_transport' },
          commuteCost: { value: chf(1_100) },
          mealDays: 200,
          pillar3a: { value: chf(7_258) },
        },
        {
          id: 'p2',
          employments: [
            { gross: { value: chf(50_000) }, socialContributions: { value: chf(3_200) } },
          ],
          hasPensionFund: false,
          pillar3a: { value: chf(9_000) },
        },
      ],
      children: [{ custody: 'full', under14: true, childcare: { value: chf(12_000) } }],
      household: {
        healthPremiums: { value: chf(9_600) },
        medicalCosts: { value: chf(9_000) },
        politicalParty: { value: chf(500) },
      },
    };
    const r = basel.computeReturn({
      ...h,
      cantonal: { workRate: { p1: 100, p2: 50 }, childrenMinor: [true], church: false },
    });
    expect(r.unsupported).toEqual([]);
    const codes = r.ifd!.items.map((i) => `${i.code}:${i.person}`);
    expect(codes, codes.join(' ')).toEqual([
      '100:p1',
      '105:p2',
      '519:p1',
      '539:p2',
      '620:p1',
      '625:p2',
      '630:household',
      '632:household',
      '660:household',
      '670:household',
      '680:household',
      '725:household',
      '750:household',
      '760:household',
    ]);
    // Form B, Bund column: travel, meals and the flat 3 % make up 519.
    const b1 = r.ifd!.items.find((i) => i.code === '519')!;
    expect(b1.parts?.map((x) => x.code)).toEqual(['503', '504', '514']);
    expect(b1.parts?.reduce((s, x) => s + x.amount, 0)).toBe(-b1.amount);
    // The insurance deduction: 630 up to the amount for spouses, 632 the supplement per child.
    const ins = r.ifd!.items.filter((i) => ['630', '632'].includes(i.code));
    expect(ins.map((i) => i.amount)).toEqual([chf(-3_700), chf(-700)]);
    expect(r.ifd!.items.find((i) => i.code === '760')?.sources.join(' ')).toMatch(
      /ch-2026-ifd-progression-deductions/,
    );
    // The same income lines as the cantonal tax: one income column on page 2.
    expect(r.ifd!.grossIncome.amount).toBe(r.icc!.grossIncome.amount);
    expect(r.total).toBe(r.icc!.taxes.total.amount + r.ifd!.tax.amount);
    // The limits of both taxes; one applied alike in both (the 3a cap) is said once, for both.
    expect(r.limits.filter((l) => l.tax === 'ifd').map((l) => l.code)).toEqual(
      expect.arrayContaining(['519', '630', '670', '725']),
    );
    expect(
      r.limits.filter((l) => l.rule === 'pillar3a').map((l) => `${l.person} ${l.tax}`),
    ).toEqual(['p1 both', 'p2 both']);
    expect(r.limits.every((l) => l.rule)).toBe(true);
  });

  it('a side job in 2026: the federal flat on form B (516), 20 %, at least 800; 2025 fails closed', () => {
    const h = (taxYear: 2025 | 2026): HouseholdInput<BaselCantonal> => ({
      taxYear,
      commune: 'Basel',
      civilStatus: 'single',
      people: [
        {
          id: 'p1',
          employments: [
            { gross: { value: chf(50_000) } },
            { gross: { value: chf(2_700) }, side: true },
          ],
        },
      ],
      cantonal: { workRate: { p1: 100 }, referenceAge: { p1: false }, church: false },
    });
    const r = basel.computeReturn(h(2026));
    expect(r.unsupported).toEqual([]);
    const b1 = r.ifd!.items.find((i) => i.code === '519')!;
    expect(b1.parts?.find((x) => x.code === '516')?.amount).toBe(chf(800));
    const old = basel.computeReturn(h(2025));
    expect(old.icc).not.toBeNull();
    expect(old.ifd).toBeNull();
    expect(old.total).toBeNull();
    expect(old.unsupported.map((u) => u.en).join(' ')).toMatch(/side job/);
  });
});

describe('the totals of the Bund column', () => {
  const line = (code: string, francs: number, person: Item['person'] = 'household'): Item => ({
    code,
    person,
    amount: chf(francs),
    label: { en: code, fr: code },
    how: { en: '', fr: '' },
    sources: [],
  });

  it('499, 699, 709, 739 and 799 from the lines, in whole francs', () => {
    const r = federalTotals([
      line('100', 80_000, 'p1'),
      line('369', 120),
      line('519', -6_000, 'p1'),
      line('631', -1_800),
      line('725', -500),
      line('732', -300),
      line('750', -6_800),
    ]);
    expect(r.grossIncome.amount).toBe(chf(80_120));
    expect(r.totalDeductions.amount).toBe(chf(-7_800));
    expect(r.subtotal709.amount).toBe(chf(72_320));
    expect(r.netIncome.amount).toBe(chf(71_520));
    expect(r.taxableIncome.amount).toBe(chf(64_720));
  });
});
