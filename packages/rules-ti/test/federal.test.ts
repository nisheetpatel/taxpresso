// The federal tax is the same in every canton (LIFD; packages/rules-ch): for the same household,
// the federal tax Ticino's authority derives from the return (./src/ifd.ts) must give Geneva's
// federal tax, to the centime, and Zurich's, Bern's, Basel-Landschaft's, Zug's and St. Gallen's.
// Checked on seeded synthetic households through the cantons' interfaces; then the lines for one
// household; then the places where Ticino's documents take a federal deduction as Geneva's form
// does and not as Zurich's, each pinned with its documents (docs/sources/ti/NOTES.md, "Wiring Ticino
// in the app").
import { communesFor as bernCommunes, rules as bern, type BernCantonal } from '@taxpresso/rules-be';
import {
  communesFor as baselLandCommunes,
  rules as baselLand,
  type BaselLandCantonal,
} from '@taxpresso/rules-bl';
import {
  IFD_NOTE,
  type HouseholdInput,
  type IfdTax,
  type Line,
  type PersonInput,
} from '@taxpresso/rules-ch';
import { COMMUNES_2026, rules as geneva } from '@taxpresso/rules-ge';
import {
  communesFor as stGallenCommunes,
  rules as stGallen,
  type StGallenCantonal,
} from '@taxpresso/rules-sg';
import { communesFor as zugCommunes, rules as zug, type ZugCantonal } from '@taxpresso/rules-zg';
import { communesFor as zurichCommunes, rules as zurich } from '@taxpresso/rules-zh';
import { describe, expect, it } from 'vitest';
import {
  communesFor,
  federalTotals,
  NOTE,
  rules as ticino,
  type Item,
  type TicinoCantonal,
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

/** The communes of both years (Lema has a multiplier for 2026 only). */
const TICINO = communesFor(2025).value.map((c) => c.name);
const ST_GALLEN = stGallenCommunes(2026).value.map((c) => c.name);
const ZUG = zugCommunes(2026).value.map((c) => c.name);
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
  const by = pick(['public_transport', 'car', 'bike', 'walk', 'home', undefined] as const);
  if (by) {
    p.commuteMode =
      by === 'car'
        ? maybe()
          ? { by, transitUsable: true }
          : { by, transitUsable: false, kmOneWay: int(1, 80), days: int(50, 220) }
        : { by };
    if (by === 'public_transport' || (by === 'car' && maybe()) || (by === 'bike' && maybe())) {
      p.commuteCost = amt(200, 6_000);
    }
  }
  if (maybe(0.6)) p.mealDays = int(0, 240);
  if (maybe(0.1)) p.otherProfessionalCosts = amt(100, 8_000);
  if (maybe(0.08)) p.trainingCosts = amt(100, 15_000);
  return p as unknown as PersonInput;
}

/**
 * A household every canton computes without what their forms do differently (see the cases below,
 * and the other cantons' federal tests): no benefits replacing a salary, no side job, no payments
 * to political parties; with `deductionsGeneva`, the illness costs and donations, which Ticino's
 * return takes as Geneva's form does.
 */
function household(deductionsGeneva = false): Shared {
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
  if (deductionsGeneva) {
    if (maybe(0.3)) hh.medicalCosts = amt(100, 20_000);
    if (maybe(0.3)) hh.donations = amt(50, 40_000);
  }
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
 * What only Ticino asks: each working person's work rate, the whole year worked, whether each child
 * is a minor (a child of 14 or more may be of age), and for the widowed and divorced, no change
 * during the year.
 */
function ticinoOwn(h: Shared): TicinoCantonal {
  const workRate: NonNullable<TicinoCantonal['workRate']> = {};
  const monthsWorked: NonNullable<TicinoCantonal['monthsWorked']> = {};
  for (const p of h.people) {
    if (!p.employments?.length) continue;
    workRate[p.id] = pick([40, 80, 100]);
    monthsWorked[p.id] = 12;
  }
  return {
    workRate,
    monthsWorked,
    ...(h.children?.length
      ? { childrenMinor: h.children.map((c) => c.under14 !== false || maybe()) }
      : {}),
    ...(h.civilStatus !== 'married' && h.civilStatus !== 'single'
      ? { changedThisYear: false }
      : {}),
  };
}

/** What only St. Gallen asks (packages/rules-sg, test/federal.test.ts). */
function stGallenOwn(h: Shared): StGallenCantonal {
  const couple = h.civilStatus === 'married';
  return {
    church: { p1: 'none', ...(couple ? { p2: 'none' as const } : {}) },
    ...(h.children?.length
      ? {
          children: h.children.map((c) =>
            c.under14 !== false
              ? { stage: 'preschool' as const }
              : { stage: 'school' as const, minor: true },
          ),
        }
      : {}),
    ...(h.childSupport === 'none' ? { mainUpkeep: h.ifdParentalScale ?? false } : {}),
  };
}

/** What only Zug asks (packages/rules-zg, test/federal.test.ts). */
function zugOwn(h: Shared): ZugCantonal {
  const couple = h.civilStatus === 'married';
  return {
    church: { p1: 'none', ...(couple ? { p2: 'none' as const } : {}) },
    citizenOf: { p1: null, ...(couple ? { p2: null } : {}) },
    ...(h.children?.length
      ? {
          children: h.children.map((c) =>
            c.under14 === false ? { under15: false, minor: true } : { under15: true },
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

const ti = (h: Shared) =>
  ticino.computeReturn({ ...h, commune: pick(TICINO), cantonal: ticinoOwn(h) });
const ge = (h: Shared) => geneva.computeReturn({ ...h, commune: pick(COMMUNES_2026).slug });

/** The federal figures every canton's result gives, to compare. */
type IfdFigures = IfdTax & { taxableIncome: Line };

function expectSameFederal(a: IfdFigures, b: IfdFigures | null, what: string) {
  expect(b, what).not.toBeNull();
  expect(a.taxableIncome.amount, what).toBe(b!.taxableIncome.amount);
  expect(a.scale, what).toBe(b!.scale);
  expect(a.scaleTax.amount, what).toBe(b!.scaleTax.amount);
  expect(a.childReduction.amount, what).toBe(b!.childReduction.amount);
  expect(a.tax.amount, what).toBe(b!.tax.amount);
  expect(Boolean(a.tax.estimates?.length), what).toBe(Boolean(b!.tax.estimates?.length));
  expect(Boolean(a.tax.needsOk), what).toBe(Boolean(b!.tax.needsOk));
}

describe('the federal tax of a Ticino return', () => {
  it('equals Geneva’s federal tax for the same household, to the centime, illness costs and donations included (2,000 households)', () => {
    let compared = 0;
    let skipped = 0;
    for (let i = 0; i < 2_000; i++) {
      const h = household(true);
      const t = ti(h);
      const g = ge(h);
      const what = JSON.stringify(h);
      // Ticino's own tax not computed (docs/sources/ti/NOTES.md): nothing to compare.
      if (!t.icc) {
        skipped++;
        continue;
      }
      expect(Boolean(t.ifd), what).toBe(Boolean(g.ifd));
      if (!t.ifd) continue;
      compared++;
      expectSameFederal(t.ifd, g.ifd, what);
    }
    expect(compared).toBeGreaterThan(1_400);
    expect(skipped).toBeLessThan(600);
  });

  it('equals Zurich’s, Bern’s, Basel-Landschaft’s, Zug’s and St. Gallen’s federal tax for the same household (1,000 households)', () => {
    let compared = 0;
    for (let i = 0; i < 1_000; i++) {
      const h = household();
      const t = ti(h);
      if (!t.icc || !t.ifd) continue;
      const what = JSON.stringify(h);
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
      const zg = zug.computeReturn({ ...h, commune: pick(ZUG), cantonal: zugOwn(h) });
      const sg = stGallen.computeReturn({
        ...h,
        commune: pick(ST_GALLEN),
        cantonal: stGallenOwn(h),
      });
      compared++;
      expectSameFederal(t.ifd, zh.ifd, `zh ${what}`);
      for (const [name, other] of [
        ['be', be],
        ['bl', bl],
        ['zg', zg],
        ['sg', sg],
      ] as const) {
        // A canton whose own tax isn't computed for this household (its documents leave it open).
        if (!other.icc) continue;
        expectSameFederal(t.ifd, other.ifd, `${name} ${what}`);
      }
    }
    expect(compared).toBeGreaterThan(700);
  });

  it('puts each federal deduction on its line of the return and of Modulo 4, in the return’s order, and cites the federal rules', () => {
    const h: Shared = {
      taxYear: 2026,
      commune: 'LUGANO',
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
    const r = ticino.computeReturn({
      ...h,
      cantonal: {
        workRate: { p1: 100, p2: 80 },
        monthsWorked: { p1: 12, p2: 12 },
        childrenMinor: [true, true],
      },
    });
    const codes = r.ifd!.items.map((i) => `${i.code}:${i.person}`);
    expect(codes, codes.join(' ')).toEqual([
      '1.1:p1',
      '1.1:p2',
      '1.2:p2',
      '400:p1',
      '408:p1',
      '420:p1',
      '470:p2',
      '482:p2',
      '11.1:p1',
      '11.2:p2',
      '12:household',
      '13.1:household',
      '15.3:p1',
      '15.5:household',
      'coniugi:household',
      '20:household',
      '22.1:household',
      '24:household',
      '25.1:household',
    ]);
    expect(r.ifd!.items.find((i) => i.code === 'coniugi')?.sources.join(' ')).toMatch(
      /ch-2026-ifd-progression-deductions.*ti-2025-deductions-table/,
    );
    // The same income lines as the cantonal tax: one income page.
    expect(r.ifd!.grossIncome.amount).toBe(r.icc!.grossIncome.amount);
    expect(r.total).toBe(r.icc!.taxes.total.amount + r.ifd!.tax.amount);
    // Person 2's other professional costs: the federal 3 % flat on 46,800 (2,000, the minimum); the
    // side job's flat of 2026, 20 % of 4,000 = 800, the minimum.
    expect(r.ifd!.items.find((i) => i.code === '470')?.amount).toBe(chf(-2_000));
    expect(r.ifd!.items.find((i) => i.code === '482')?.amount).toBe(chf(-800));
    // The limits of both taxes; one applied alike in both (the 3a cap) is said once, for both.
    expect(r.limits.filter((l) => l.tax === 'ifd').map((l) => l.code)).toEqual(
      expect.arrayContaining(['12', '20', '22.1', '24']),
    );
    expect(r.limits.filter((l) => l.code === '11.2').map((l) => `${l.person} ${l.tax}`)).toEqual([
      'p2 both',
    ]);
    expect(r.limits.every((l) => l.rule)).toBe(true);
    // Its totals: 8 less 16 is 19; less 20, 21; less 22.1, 23; less 24 and 25.1, 26; 28 in whole
    // francs, without the cantonal exemption of 27.
    const t = federalTotals(r.ifd!.items);
    expect(t.taxableIncome.amount).toBe(r.ifd!.taxableIncome.amount);
    expect(r.ifd!.netIncome.amount).toBe(r.ifd!.grossIncome.amount - r.ifd!.totalDeductions.amount);
  });

  it('a side job in 2025: the canton’s table gives the federal flat (20 %, at least 800, at most 2,400)', () => {
    const r = ticino.computeReturn({
      taxYear: 2025,
      commune: 'LUGANO',
      civilStatus: 'single',
      people: [
        {
          id: 'p1',
          employments: [
            { gross: { value: chf(50_000) } },
            { gross: { value: chf(6_000) }, side: true },
          ],
        },
      ],
      cantonal: { workRate: { p1: 100 }, monthsWorked: { p1: 12 } },
    });
    expect(r.ifd).not.toBeNull();
    const side = r.ifd!.items.find((i) => i.code === '432')!;
    expect(side.amount).toBe(chf(-1_200));
    expect(side.sources.join(' ')).toMatch(/ti-2025-deductions-table p\. 1/);
  });
});

describe('where Ticino’s documents take a federal deduction as Geneva’s form does, not as Zurich’s (open points)', () => {
  const ded = (items: readonly Pick<Item, 'code' | 'amount'>[], code: string) =>
    -(items.find((i) => i.code === code)?.amount ?? 0);
  const own = (people: Shared['people']): TicinoCantonal => ({
    workRate: Object.fromEntries(people.map((p) => [p.id, 100])),
    monthsWorked: Object.fromEntries(people.map((p) => [p.id, 12])),
  });

  it('donations: at most 20 % of 23, after the illness costs (Modulo 5), as Geneva and not as Zurich', () => {
    // 100,000 salary: the 3 % flat is 3,000, so 19 = 21 = 97,000. Costs 9,000: 5 % of 97,000 =
    // 4,850, deducted 4,150 (Modulo 6: "5% del reddito netto intermedio II"). 23 = 92,850:
    // donations at most 20 % of it = 18,570 ("sia per l’imposta cantonale che federale diretta",
    // ti-2025-form-modulo-5 p. 2), as Geneva's 92.40; Zurich takes 20 % of its Nettoeinkommen
    // before the illness costs, 19,400: 830 more.
    const h: Shared = {
      taxYear: 2026,
      commune: '',
      civilStatus: 'single',
      people: [{ id: 'p1', employments: [{ gross: { value: chf(100_000) } }] }],
      household: { medicalCosts: { value: chf(9_000) }, donations: { value: chf(50_000) } },
    };
    const t = ticino.computeReturn({ ...h, commune: 'LUGANO', cantonal: own(h.people) }).ifd!;
    const zh = zurich.computeReturn({ ...h, commune: 261 }).ifd!;
    const g = geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;
    expect(ded(t.items, '22.1')).toBe(chf(4_150));
    expect(ded(t.items, '24')).toBe(chf(18_570));
    expect(ded(g.items, '73.00')).toBe(chf(18_570));
    expect(ded(zh.items, '324') - ded(t.items, '24')).toBe(chf(830));
    expect(t.tax.amount).toBe(g.tax.amount);
  });

  it('payments to political parties among the other deductions (15.2), before the illness costs’ base (21): not as Geneva', () => {
    // Ticino's return takes 15.2 in its total of deductions (16), so 21, the base of the illness
    // costs' threshold, comes after the parties (ti-2025-form-modulo-1-de p. 3; Modulo 6: "5% del
    // reddito netto intermedio II (cifra 21)"); Geneva's form takes the parties after its 92.20.
    // 100,000 salary, parties 5,000: 21 = 97,000 - 5,000 = 92,000, the threshold 4,600 where
    // Geneva's is 4,850 (5 % of 97,000): 250 more illness costs deducted.
    const h: Shared = {
      taxYear: 2026,
      commune: '',
      civilStatus: 'single',
      people: [{ id: 'p1', employments: [{ gross: { value: chf(100_000) } }] }],
      household: { medicalCosts: { value: chf(9_000) }, politicalParty: { value: chf(5_000) } },
    };
    const t = ticino.computeReturn({ ...h, commune: 'LUGANO', cantonal: own(h.people) }).ifd!;
    const g = geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;
    expect(ded(t.items, '15.2')).toBe(chf(5_000));
    expect(ded(t.items, '22.1')).toBe(chf(9_000 - 4_600));
    expect(t.taxableIncome.amount).toBe(g.taxableIncome.amount - chf(250));
  });

  it('the married couple deduction among the other deductions (15), before 21 and 23, as Geneva and not as Zurich', () => {
    // The canton's table lists the federal married couple deduction ("Dal reddito dei coniugi/
    // partner registrati", 2,800) with the other deductions (15), so it comes off before the bases
    // of the illness costs (21) and the donations (23), as on Geneva's form; Zurich takes it among
    // the social deductions after them (365). Donations above the cap show it: 20 % of 2,800 = 560.
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
    const t = ticino.computeReturn({ ...h, commune: 'LUGANO', cantonal: own(h.people) }).ifd!;
    const zh = zurich.computeReturn({ ...h, commune: 261 }).ifd!;
    const g = geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;
    expect(ded(t.items, '24')).toBe(ded(g.items, '73.00'));
    expect(ded(zh.items, '324') - ded(t.items, '24')).toBe(chf(560));
    expect(t.tax.amount).toBe(g.tax.amount);
  });
});

describe('childcare of a child of 14 or more', () => {
  it('counts for neither tax, and the result says so', () => {
    // Two children: the younger under 14 with childcare of 8,000, the elder 14 or more at the end
    // of the year with 5,000. Only the younger child’s counts: cantonal 8,000 (20, at most 26,200,
    // LT art. 32a); federal 8,000 (at most 25,800, Form. 2a 2026 p. 8), where the federal sum used
    // to take both, 13,000, within the cap of the one child under 14.
    const h: Shared = {
      taxYear: 2026,
      commune: '',
      civilStatus: 'married',
      people: [
        { id: 'p1', employments: [{ gross: { value: chf(90_000) } }] },
        { id: 'p2', employments: [{ gross: { value: chf(60_000) } }] },
      ],
      children: [
        { custody: 'full', under14: true, childcare: { value: chf(8_000) } },
        { custody: 'full', under14: false, childcare: { value: chf(5_000) } },
      ],
    };
    const r = ticino.computeReturn({
      ...h,
      commune: 'Lugano',
      cantonal: {
        workRate: { p1: 100, p2: 100 },
        monthsWorked: { p1: 12, p2: 12 },
        childrenMinor: [true, true],
      },
    });
    const ded = (items: readonly { code: string; amount: number }[], code: string) =>
      -(items.find((i) => i.code === code)?.amount ?? 0);
    expect(ded(r.icc!.items, '20')).toBe(chf(8_000));
    expect(ded(r.ifd!.items, '20')).toBe(chf(8_000));
    expect(r.notCounted).toContainEqual(NOTE.childcareAway);
    expect(r.notCounted).toContainEqual(IFD_NOTE.childcareAge);
  });
});
