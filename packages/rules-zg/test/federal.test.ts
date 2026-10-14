// The federal tax is the same in every canton (LIFD; packages/rules-ch): for the same household,
// Zug's Bund column must give Geneva's federal tax, to the centime, and Zurich's, Bern's and
// Basel-Landschaft's. Checked on seeded synthetic households through the five cantons' interfaces;
// then the lines of the column for one household; then the places where Zug's documents take a
// federal deduction as another canton's form does and not as Geneva's, each pinned with its
// documents (docs/sources/zg/NOTES.md, "Wiring Zug in the app").
import { communesFor as bernCommunes, rules as bern, type BernCantonal } from '@taxpresso/rules-be';
import {
  communesFor as baselLandCommunes,
  rules as baselLand,
  type BaselLandCantonal,
} from '@taxpresso/rules-bl';
import { IFD_NOTE, type HouseholdInput, type PersonInput } from '@taxpresso/rules-ch';
import { COMMUNES_2026, rules as geneva } from '@taxpresso/rules-ge';
import { communesFor as zurichCommunes, rules as zurich } from '@taxpresso/rules-zh';
import { describe, expect, it } from 'vitest';
import {
  communesFor,
  FEDERAL_NOTE,
  federalTotals,
  NOTE,
  rules as zug,
  type Item,
  type ZugCantonal,
} from '../src/index.js';

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

const R = rng(20261014);
const int = (lo: number, hi: number) => lo + Math.floor(R() * (hi - lo + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(R() * xs.length)]!;
const maybe = (p = 0.5) => R() < p;
const status = () => pick(['stated', 'stated', 'verified', 'estimate', 'extracted'] as const);
const amt = (lo: number, hi: number) => ({ value: chf(int(lo, hi)), status: status() });

const ZUG = communesFor(2026).value.map((c) => c.name);
const BASEL_LAND = baselLandCommunes(2026).value.map((c) => c.name);
const BERN = bernCommunes(2026).value.map((c) => c.bfs);
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
 * A household every canton computes without what their forms do differently (see the cases below,
 * and the other cantons' federal tests): no benefits replacing a salary, no medical costs or
 * donations, no payments to political parties, no side job.
 */
function household(): Shared {
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

/**
 * What only Zug asks: no parish and no Bürgergemeinde (opt-in), each child's age on 31 December
 * (under 15, else whether a minor), and with shared custody without child support who has the
 * larger share of the children's care.
 */
function zugOwn(h: Shared): ZugCantonal {
  const couple = h.civilStatus === 'married';
  return {
    church: { p1: 'none', ...(couple ? { p2: 'none' as const } : {}) },
    citizenOf: { p1: null, ...(couple ? { p2: null } : {}) },
    ...(h.children?.length
      ? {
          children: h.children.map((c) =>
            c.under14 === false ? { under15: false, minor: maybe() } : { under15: true },
          ),
        }
      : {}),
    ...(h.childSupport === 'none' ? { mainCare: h.ifdParentalScale ?? false } : {}),
  };
}

/** What only Basel-Landschaft asks (packages/rules-bl, test/federal.test.ts). */
function baselLandOwn(h: Shared): BaselLandCantonal {
  const kinds = Object.fromEntries(
    h.people.filter((p) => p.pensionAvs).map((p) => [p.id, 'ahv' as const]),
  );
  return {
    church: { p1: 'none', ...(h.civilStatus === 'married' ? { p2: 'none' as const } : {}) },
    ...(Object.keys(kinds).length ? { pensionKind: kinds } : {}),
    ...(h.childSupport === 'none' ? { mainUpkeep: h.ifdParentalScale ?? false } : {}),
  };
}

/** What only Bern asks (packages/rules-be, test/federal.test.ts). */
function bernOwn(h: Shared): BernCantonal {
  return {
    church: { p1: 'none', ...(h.civilStatus === 'married' ? { p2: 'none' as const } : {}) },
    ...(h.civilStatus !== 'married' ? { ownHousehold: true } : {}),
    ...(h.childSupport === 'none'
      ? { marriedTariff: h.ifdParentalScale ?? false, sharedChildWealth: 'half' as const }
      : {}),
  };
}

function five(h: Shared) {
  const zg = zug.computeReturn({ ...h, commune: pick(ZUG), cantonal: zugOwn(h) });
  const ge = geneva.computeReturn({ ...h, commune: pick(COMMUNES_2026).slug });
  const zh = zurich.computeReturn({
    ...h,
    commune: pick(ZURICH),
    ...(h.childSupport === 'none' ? { cantonal: { marriedTariff: h.ifdParentalScale } } : {}),
  });
  const be = bern.computeReturn({ ...h, commune: pick(BERN), cantonal: bernOwn(h) });
  const bl = baselLand.computeReturn({
    ...h,
    commune: pick(BASEL_LAND),
    cantonal: baselLandOwn(h),
  });
  return { zg, ge, zh, be, bl };
}

describe('the federal tax on Zug’s form K', () => {
  it('equals Geneva’s, Zurich’s, Bern’s and Basel-Landschaft’s federal tax for the same household, to the centime (2,000 households)', () => {
    let compared = 0;
    let skipped = 0;
    for (let i = 0; i < 2_000; i++) {
      const h = household();
      const { zg, ge, zh, be, bl } = five(h);
      const what = JSON.stringify(h);
      // Zug's own tax not computed (docs/sources/zg/NOTES.md): nothing to compare.
      if (!zg.icc) {
        skipped++;
        continue;
      }
      expect(Boolean(zg.ifd), what).toBe(Boolean(ge.ifd));
      if (!zg.ifd || !ge.ifd) continue;
      compared++;
      for (const other of [ge.ifd, zh.ifd, be.icc ? be.ifd : ge.ifd, bl.icc ? bl.ifd : ge.ifd]) {
        expect(other, what).not.toBeNull();
        expect(zg.ifd.taxableIncome.amount, what).toBe(other!.taxableIncome.amount);
        expect(zg.ifd.scale, what).toBe(other!.scale);
        expect(zg.ifd.scaleTax.amount, what).toBe(other!.scaleTax.amount);
        expect(zg.ifd.childReduction.amount, what).toBe(other!.childReduction.amount);
        expect(zg.ifd.tax.amount, what).toBe(other!.tax.amount);
        expect(Boolean(zg.ifd.tax.estimates?.length), what).toBe(
          Boolean(other!.tax.estimates?.length),
        );
        expect(Boolean(zg.ifd.tax.needsOk), what).toBe(Boolean(other!.tax.needsOk));
      }
    }
    expect(compared).toBeGreaterThan(1_800);
    expect(skipped).toBeLessThan(150);
  });

  it('puts each federal deduction on its line of the Bund column, in the form’s order, and cites the federal rules', () => {
    const h: Shared = {
      taxYear: 2026,
      commune: 'Baar',
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
          trainingCosts: { value: chf(2_000) },
        },
        {
          id: 'p2',
          employments: [
            { gross: { value: chf(50_000) }, socialContributions: { value: chf(3_200) } },
            { gross: { value: chf(4_000) }, side: true },
          ],
          hasPensionFund: false,
          pillar3a: { value: chf(9_000) },
        },
      ],
      children: [
        { custody: 'full', under14: true, childcare: { value: chf(12_000) } },
        { custody: 'full', under14: false },
      ],
      household: {
        healthPremiums: { value: chf(9_600) },
        medicalCosts: { value: chf(9_000) },
        donations: { value: chf(2_000) },
        bankFees: { value: chf(200) },
      },
    };
    const r = zug.computeReturn({
      ...h,
      cantonal: {
        church: { p1: 'none', p2: 'none' },
        citizenOf: { p1: null, p2: null },
        children: [{ under15: true }, { under15: false, minor: true }],
      },
    });
    const codes = r.ifd!.items.map((i) => `${i.code}:${i.person}`);
    expect(codes, codes.join(' ')).toEqual([
      '100:p1',
      '101:p2',
      '106:p2',
      '201:p1',
      '202:p2',
      '220:p1',
      '221:p2',
      '230:household',
      '245:p1',
      '253:household',
      '255:household',
      '260:household',
      '295:household',
      '296:household',
      '401:household',
      '403:household',
    ]);
    expect(r.ifd!.items.find((i) => i.code === '401')?.sources.join(' ')).toMatch(
      /ch-2026-ifd-progression-deductions/,
    );
    // The same income lines as the cantonal tax: one income page.
    expect(r.ifd!.grossIncome.amount).toBe(r.icc!.grossIncome.amount);
    expect(r.total).toBe(r.icc!.taxes.total.amount + r.ifd!.tax.amount);
    // Person 2's professional costs on 202: the federal 3 % flat on 46,800 (2,000, the minimum) and
    // the side job's flat of 2026, 20 % of 4,000 = 800, the minimum.
    expect(r.ifd!.items.find((i) => i.code === '202')?.amount).toBe(chf(-2_800));
    // The insurance deduction of a couple with contributions, plus two children (one line, 230).
    expect(r.ifd!.items.find((i) => i.code === '230')?.amount).toBeLessThan(0);
    // The limits of both taxes; one applied alike in both (the 3a cap) is said once, for both.
    expect(r.limits.filter((l) => l.tax === 'ifd').map((l) => l.code)).toEqual(
      expect.arrayContaining(['230', '253', '295', '296']),
    );
    expect(r.limits.filter((l) => l.code === '221').map((l) => `${l.person} ${l.tax}`)).toEqual([
      'p2 both',
    ]);
    expect(r.limits.every((l) => l.rule)).toBe(true);
    // Its totals: 190 less 280 is 287; less 295 and 296, 299; less 401 and 403, 490 in whole francs.
    const t = federalTotals(r.ifd!.items);
    expect(t.taxableIncome.amount).toBe(r.ifd!.taxableIncome.amount);
    expect(r.ifd!.subtotal.amount).toBe(r.ifd!.grossIncome.amount - r.ifd!.totalDeductions.amount);
  });

  it('a side job in 2025: no 2025 federal document gives the federal flat, the federal tax is not computed', () => {
    const r = zug.computeReturn({
      taxYear: 2025,
      commune: 'Zug',
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
      cantonal: { church: { p1: 'none' }, citizenOf: { p1: null } },
    });
    expect(r.icc).not.toBeNull();
    expect(r.ifd).toBeNull();
    expect(r.total).toBeNull();
    expect(r.unsupported).toEqual([FEDERAL_NOTE.sideJob2025]);
  });
});

describe('where Zug’s form takes a federal deduction as Zurich’s does (open points)', () => {
  const ded = (items: readonly Pick<Item, 'code' | 'amount'>[], code: string) =>
    -(items.find((i) => i.code === code)?.amount ?? 0);
  const own = { church: { p1: 'none' as const }, citizenOf: { p1: null } };

  it('medical costs: 5 % of the net income before them (287 of the Bund column), as Zurich and Geneva', () => {
    // 100,000 salary: the 3 % flat is 3,000, so 287 is 97,000. Costs 9,000: 5 % of 97,000 = 4,850,
    // deducted 4,150 (zg-2025-guide-wegleitung p. 40: "5 % des massgebenden Reineinkommens (Code
    // 287)"); Basel-Landschaft's guide takes x 5 : 95 and gives 4,368.
    const h: Shared = {
      taxYear: 2026,
      commune: '',
      civilStatus: 'single',
      people: [{ id: 'p1', employments: [{ gross: { value: chf(100_000) } }] }],
      household: { medicalCosts: { value: chf(9_000) } },
    };
    const zg = zug.computeReturn({ ...h, commune: 'Zug', cantonal: own }).ifd!;
    const zh = zurich.computeReturn({ ...h, commune: 261 }).ifd!;
    const ge = geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;
    expect(ded(zg.items, '295')).toBe(chf(4_150));
    expect(ded(zh.items, '320')).toBe(chf(4_150));
    expect(zg.tax.amount).toBe(zh.tax.amount);
    expect(zg.tax.amount).toBe(ge.tax.amount);
  });

  it('donations: at most 20 % of 287, before the married couple deduction 401 (as Zurich, not as Geneva)', () => {
    // A couple: Geneva takes the married couple deduction before its subtotal 92.40, Zug (401, a
    // social deduction after 299, zg-2025-guide-wegleitung p. 18 and 41) and Zurich (365) after;
    // donations above the cap show it: 20 % of the federal married couple deduction, 2,800, is 560.
    const h: Shared = {
      taxYear: 2026,
      commune: '',
      civilStatus: 'married',
      people: [
        { id: 'p1', employments: [{ gross: { value: chf(60_000) } }] },
        { id: 'p2', employments: [{ gross: { value: chf(40_000) } }] },
      ],
      household: { donations: { value: chf(50_000) } },
    };
    const zg = zug.computeReturn({
      ...h,
      commune: 'Zug',
      cantonal: { church: { p1: 'none', p2: 'none' }, citizenOf: { p1: null, p2: null } },
    }).ifd!;
    const zh = zurich.computeReturn({ ...h, commune: 261 }).ifd!;
    const ge = geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;
    expect(ded(zg.items, '296')).toBe(ded(zh.items, '324'));
    expect(ded(zg.items, '296') - ded(ge.items, '73.00')).toBe(chf(560));
    expect(zg.tax.amount).toBe(zh.tax.amount);
  });
});

describe('childcare of a child of 14 or more', () => {
  it('counts for neither tax, and the result says so', () => {
    // Two children: the younger under 14 with childcare of 15,000, the elder 15 at the end of the
    // year with 5,000. Only the younger child’s counts: cantonal 15,000 (253, at most 25,400,
    // StG § 30 Abs. 1 lit. l; above own care, 12,200, so taken instead of it); federal 15,000 (at
    // most 25,800, Form. 2a 2026 p. 8), where the federal sum used to take both, 20,000, within the
    // cap of the one child under 14.
    const h: Shared = {
      taxYear: 2026,
      commune: '',
      civilStatus: 'married',
      people: [
        { id: 'p1', employments: [{ gross: { value: chf(90_000) } }] },
        { id: 'p2', employments: [{ gross: { value: chf(60_000) } }] },
      ],
      children: [
        { custody: 'full', under14: true, childcare: { value: chf(15_000) } },
        { custody: 'full', under14: false, childcare: { value: chf(5_000) } },
      ],
    };
    const r = zug.computeReturn({
      ...h,
      commune: 'Zug',
      cantonal: {
        church: { p1: 'none', p2: 'none' },
        citizenOf: { p1: null, p2: null },
        children: [{ under15: true }, { under15: false, minor: true }],
      },
    });
    const ded = (items: readonly { code: string; amount: number }[], code: string) =>
      -(items.find((i) => i.code === code)?.amount ?? 0);
    expect(ded(r.icc!.items, '253')).toBe(chf(15_000));
    expect(ded(r.ifd!.items, '253')).toBe(chf(15_000));
    expect(r.notCounted).toContainEqual(NOTE.childcareAge);
    expect(r.notCounted).toContainEqual(IFD_NOTE.childcareAge);
  });
});
