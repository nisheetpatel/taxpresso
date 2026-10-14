// The federal tax is the same in every canton (LIFD; packages/rules-ch): for the same household,
// Vaud's federal tax, on the guide's worksheet (vd-2025-guide p. 65), must give Geneva's federal
// tax, to the centime, and Zurich's. Checked on seeded synthetic households through the cantons'
// interfaces; then the worksheet's lines and order; then the places where the worksheet takes a
// federal deduction differently from Geneva's form, each pinned with its document.
import type { HouseholdInput, PersonInput } from '@taxpresso/rules-ch';
import { COMMUNES_2026, rules as geneva } from '@taxpresso/rules-ge';
import { communesFor as zurichCommunes, rules as zurich } from '@taxpresso/rules-zh';
import { describe, expect, it } from 'vitest';
import { communesFor, federalTotals, rules as vaud, type VaudCantonal } from '../src/index.js';

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

/** Vaud's communes without fractions (a fraction's part is Vaud's own question). */
const VAUD = communesFor(2026)
  .value.filter((c) => !c.fractions?.length)
  .map((c) => c.name);
const ZURICH = zurichCommunes(2026)
  .value.filter((c) => new Set(c.rates).size === 1)
  .map((c) => c.bfs);

/**
 * A person. The way to work is one Vaud computes in the year: in 2026 its guide, which prices
 * public transport, bikes and motorbikes, is not published (rules-vd fails closed), so a 2026
 * household drives with no usable public transport, walks or works from home.
 */
function person(id: 'p1' | 'p2', year: 2025 | 2026): PersonInput {
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
  const modes =
    year === 2025
      ? (['public_transport', 'car', 'motorbike', 'bike', 'walk', 'home', undefined] as const)
      : (['car', 'walk', 'home', undefined] as const);
  const by = pick(modes);
  if (by) {
    if (by === 'car' || by === 'motorbike') {
      p.commuteMode =
        year === 2025 && maybe()
          ? { by, transitUsable: true }
          : { by, transitUsable: false, kmOneWay: int(1, 80), days: int(50, 240) };
      if (year === 2025 && (p.commuteMode as { transitUsable: boolean }).transitUsable) {
        p.commuteCost = amt(200, 6_000);
      }
    } else if (by === 'public_transport') {
      p.commuteMode = { by };
      p.commuteCost = amt(200, 6_000);
    } else {
      p.commuteMode = { by };
    }
  }
  if (maybe(0.6)) p.mealDays = int(0, 240);
  if (maybe(0.1)) p.otherProfessionalCosts = amt(100, 8_000);
  if (maybe(0.08)) p.trainingCosts = amt(100, 15_000);
  return p as unknown as PersonInput;
}

/**
 * A household every canton computes without what their forms do differently (see the cases below,
 * and Bern's and Zurich's federal tests): no benefits replacing a salary, no medical costs or
 * donations (the worksheet takes their bases after them: p. 65).
 */
function household(): Shared {
  const civil = pick(['single', 'married', 'married', 'divorced', 'widowed'] as const);
  const couple = civil === 'married';
  const year = pick([2025, 2026] as const);
  const kids = maybe(0.4) ? int(1, 3) : 0;
  const shared = !couple && kids > 0 && maybe(0.4);
  const h: Record<string, unknown> = {
    taxYear: year,
    civilStatus: civil,
    people: couple ? [person('p1', year), person('p2', year)] : [person('p1', year)],
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
  if (maybe(0.08)) hh.politicalParty = amt(10, 15_000);
  if (maybe(0.08)) hh.alimonyPaid = amt(1_000, 30_000);
  if (maybe(0.15)) hh.debtInterest = amt(100, 10_000);
  if (maybe(0.1)) hh.bankFees = amt(10, 1_000);
  if (Object.keys(hh).length) h.household = hh;
  if (maybe(0.5)) {
    h.movable = Array.from({ length: int(1, 3) }, () => ({
      owner: pick(couple ? (['p1', 'p2', 'household'] as const) : (['p1', 'household'] as const)),
      ...(maybe(0.9) ? { value: amt(100, 2_000_000) } : {}),
      ...(maybe(0.7) ? { income: amt(0, 30_000) } : {}),
    }));
  }
  return h as unknown as Shared;
}

/** What only Vaud asks: the rent, a household alone with the children, who bears their upkeep. */
function vaudOwn(h: Shared): VaudCantonal {
  return {
    rent: { value: chf(int(0, 30_000)) },
    ...(h.civilStatus !== 'married' && h.children?.length ? { ownHousehold: maybe(0.8) } : {}),
    ...(h.childSupport === 'none' ? { mainUpkeep: h.ifdParentalScale ?? false } : {}),
  };
}

function three(h: Shared) {
  const ge = geneva.computeReturn({ ...h, commune: pick(COMMUNES_2026).slug });
  const zh = zurich.computeReturn({
    ...h,
    commune: pick(ZURICH),
    ...(h.childSupport === 'none' ? { cantonal: { marriedTariff: h.ifdParentalScale } } : {}),
  });
  const vd = vaud.computeReturn({ ...h, commune: pick(VAUD), cantonal: vaudOwn(h) });
  return { ge: ge.ifd, zh: zh.ifd, vd: vd.ifd, vdResult: vd };
}

describe('the federal tax of a Vaud household', () => {
  it('equals Geneva’s and Zurich’s federal tax for the same household, to the centime (2,000 households)', () => {
    let compared = 0;
    let skipped = 0;
    for (let i = 0; i < 2_000; i++) {
      const h = household();
      const { ge, zh, vd, vdResult } = three(h);
      const what = JSON.stringify(h);
      // Vaud's own tax not computed (the cap of the quotient familial or the maxima of LICom art. 8
      // the documents leave open, a married couple sharing custody: docs/sources/vd/NOTES.md):
      // nothing to compare.
      if (!vdResult.icc) {
        skipped++;
        continue;
      }
      expect(Boolean(vd), what).toBe(Boolean(ge));
      expect(Boolean(vd), what).toBe(Boolean(zh));
      if (!ge || !vd || !zh) continue;
      compared++;
      for (const other of [ge, zh]) {
        expect(vd.taxableIncome.amount, what).toBe(other.taxableIncome.amount);
        expect(vd.scale, what).toBe(other.scale);
        expect(vd.scaleTax.amount, what).toBe(other.scaleTax.amount);
        expect(vd.childReduction.amount, what).toBe(other.childReduction.amount);
        expect(vd.tax.amount, what).toBe(other.tax.amount);
        expect(Boolean(vd.tax.estimates?.length), what).toBe(Boolean(other.tax.estimates?.length));
        expect(Boolean(vd.tax.needsOk), what).toBe(Boolean(other.tax.needsOk));
      }
    }
    expect(compared).toBeGreaterThan(1_600);
    expect(skipped).toBeLessThan(400);
  });

  it('puts each federal deduction on its Vaud code, in the worksheet’s order (p. 65), cited', () => {
    const r = vaud.computeReturn({
      taxYear: 2026,
      commune: 'Nyon',
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
          commuteMode: { by: 'car', transitUsable: false, kmOneWay: 12, days: 200 },
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
        savingsInterest: { value: chf(200) },
        medicalCosts: { value: chf(9_000) },
        donations: { value: chf(1_000) },
      },
      movable: [{ owner: 'household', value: { value: chf(50_000) }, income: { value: chf(300) } }],
      cantonal: { rent: { value: chf(12_000) } },
    });
    expect(r.unsupported).toEqual([]);
    const codes = r.ifd!.items.map((i) => `${i.code}:${i.person}`);
    expect(codes, codes.join(' ')).toEqual([
      '100:p1',
      '100:p2',
      '140:p1',
      '150:p1',
      '160:p1',
      '160:p2',
      '235:household',
      '300:household',
      '310:p1',
      '310:p2',
      '410:household',
      '670:household',
      '710:household',
      '720:household',
      'franchise-medicale:household',
      'deduction-maries:household',
      'deduction-enfants:household',
    ]);
    for (const i of r.ifd!.items.filter((x) => x.code !== '100' && x.code !== '410')) {
      expect(i.sources.join(' '), i.code).toContain('vd-2025-guide p. 65');
    }
    expect(r.ifd!.items.find((i) => i.code === 'deduction-maries')?.sources.join(' ')).toMatch(
      /ch-2026-ifd-progression-deductions/,
    );
    // The same income lines as the cantonal tax.
    expect(r.ifd!.grossIncome.amount).toBe(r.icc!.grossIncome.amount);
    expect(r.total).toBe(r.icc!.taxes.total.amount + r.ifd!.tax.amount);
    // The worksheet's subtotals: I after the medical costs in full, II after the donations, then
    // the franchise added back and the social deductions.
    const f = r.ifd!;
    const sum = (codes: string[]) =>
      f.items.filter((i) => codes.includes(i.code)).reduce((s, i) => s + i.amount, 0);
    expect(f.intermediateIncome2.amount).toBe(f.intermediateIncome1.amount + sum(['720']));
    expect(f.netIncome.amount).toBe(f.intermediateIncome2.amount + sum(['franchise-medicale']));
    expect(f.socialDeductions.amount).toBe(sum(['deduction-maries', 'deduction-enfants']));
    // Savings interest counts with the premiums (300/340/480), not on its own line as in the canton.
    expect(f.items.some((i) => i.code === '480')).toBe(false);
    expect(r.icc!.items.find((i) => i.code === '480')?.amount).toBe(chf(-200));
    // The limits of both taxes; one applied alike in both (the 3a cap) is said once, for both.
    expect(r.limits.filter((l) => l.tax === 'ifd').map((l) => l.code)).toEqual(
      expect.arrayContaining(['300', '670', '710', '720']),
    );
    expect(r.limits.filter((l) => l.code === '310').map((l) => `${l.person} ${l.tax}`)).toEqual([
      'p1 both',
      'p2 both',
    ]);
    expect(r.limits.every((l) => l.rule)).toBe(true);
  });

  it('a side job (165) in 2026: the federal flat, 20 %, at least 800 (Form. 2a 2026 p. 7)', () => {
    const r = vaud.computeReturn({
      taxYear: 2026,
      commune: 'Lausanne',
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
      cantonal: { rent: { value: 0 } },
    });
    expect(r.unsupported).toEqual([]);
    expect(r.ifd!.items.find((i) => i.code === '165')?.amount).toBe(chf(-800));
  });
});

describe('the worksheet’s totals (vd-2025-guide p. 65)', () => {
  const line = (code: string, francs: number, person: 'p1' | 'household' = 'household') => ({
    code,
    person,
    amount: chf(francs),
    label: { en: code, fr: code },
    how: { en: '', fr: '' },
    sources: [],
  });

  it('adds up in its order: I, II (730), the franchise, the social deductions', () => {
    const r = federalTotals([
      line('100', 60_000, 'p1'),
      line('410', 500),
      line('160', -2_000, 'p1'),
      line('300', -1_800),
      line('710', -4_000),
      line('720', -1_000),
      line('franchise-medicale', 2_789),
      line('deduction-enfants', -6_800),
    ]);
    expect(r.grossIncome.amount).toBe(chf(60_500));
    expect(r.intermediateIncome1.amount).toBe(chf(52_700));
    expect(r.intermediateIncome2.amount).toBe(chf(51_700));
    expect(r.netIncome.amount).toBe(chf(54_489));
    expect(r.socialDeductions.amount).toBe(chf(-6_800));
    expect(r.taxableIncome.amount).toBe(chf(47_689));
  });
});

describe('where the worksheet takes a federal deduction differently from Geneva’s form', () => {
  const base: Shared = {
    taxYear: 2025,
    commune: 'x',
    civilStatus: 'single',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: { value: chf(80_000) }, socialContributions: { value: chf(5_120) } },
        ],
      },
    ],
  };
  const vd = (h: Shared) =>
    vaud.computeReturn({ ...h, commune: 'Lausanne', cantonal: { rent: { value: 0 } } }).ifd!;
  const ge = (h: Shared) => geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;

  it('medical costs: the franchise is 5/95 of the income after them and the donations (p. 65)', () => {
    // Geneva: the part above 5 % of its subtotal 92.20, before the medical costs. The worksheet: the
    // costs in full (710), the revenu intermédiaire II, then II x 5/95 added back, at most the costs
    // deducted: 5 % of the income after the deduction itself, so a smaller threshold and a smaller
    // taxable income than Geneva's when there are medical costs.
    const h = { ...base, household: { medicalCosts: { value: chf(8_000) } } };
    const v = vd(h);
    const g = ge(h);
    const franchise = v.items.find((i) => i.code === 'franchise-medicale')!.amount;
    expect(franchise).toBe(Math.round((v.intermediateIncome2.amount * 5) / 95 / 100) * 100);
    // II + franchise = the income after the medical deduction, of which the franchise is 5 %.
    expect(Math.abs(franchise - (v.netIncome.amount * 5) / 100)).toBeLessThanOrEqual(chf(1));
    expect(v.taxableIncome.amount).toBeLessThan(g.taxableIncome.amount);
    expect(v.items.find((i) => i.code === 'franchise-medicale')?.sources.join(' ')).toContain(
      'vd-2025-guide p. 65',
    );
  });

  it('medical costs below the franchise: nothing deducted, the costs added back in full', () => {
    const h = { ...base, household: { medicalCosts: { value: chf(500) } } };
    const r = vaud.computeReturn({ ...h, commune: 'Lausanne', cantonal: { rent: { value: 0 } } });
    const v = r.ifd!;
    expect(v.items.find((i) => i.code === 'franchise-medicale')?.amount).toBe(chf(500));
    expect(v.taxableIncome.amount).toBe(ge(h).taxableIncome.amount);
    expect(r.notCounted.map((n) => n.en)).toContain(
      'Medical costs (federal tax): below the franchise, nothing to deduct.',
    );
  });

  it('donations: at most 20 % of the revenu intermédiaire I, after the medical costs in full', () => {
    const h = {
      ...base,
      household: { medicalCosts: { value: chf(20_000) }, donations: { value: chf(30_000) } },
    };
    const v = vd(h);
    const gift = -v.items.find((i) => i.code === '720')!.amount;
    expect(gift).toBe(Math.round((v.intermediateIncome1.amount * 2_000) / 10_000 / 100) * 100);
    const g = ge(h);
    expect(v.taxableIncome.amount).not.toBe(g.taxableIncome.amount);
  });
});
