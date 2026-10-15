// The federal tax is the same in every canton (LIFD; packages/rules-ch): for the same household,
// Aargau's federal tax must give Geneva's, to the centime, and Zurich's, Bern's and
// Basel-Landschaft's. The Aargau return has no federal column (ag-2025-guide-wegleitung p. 42): the
// federal tax follows the federal instructions (Form. 2a). Checked on seeded synthetic households
// through the five cantons' interfaces; then the lines for one household; then the places where
// the cantons' engines take a federal deduction differently, each pinned with its documents
// (docs/sources/ag/NOTES.md, "Wiring Aargau in the app").
import { IFD_NOTE, type HouseholdInput, type PersonInput } from '@taxpresso/rules-ch';
import { communesFor as bernCommunes, rules as bern, type BernCantonal } from '@taxpresso/rules-be';
import {
  communesFor as baselLandCommunes,
  rules as baselLand,
  type BaselLandCantonal,
} from '@taxpresso/rules-bl';
import { COMMUNES_2026, rules as geneva } from '@taxpresso/rules-ge';
import { communesFor as zurichCommunes, rules as zurich } from '@taxpresso/rules-zh';
import { describe, expect, it } from 'vitest';
import {
  communesFor,
  FEDERAL_NOTE,
  federalTotals,
  NOTE,
  rules as aargau,
  type AargauCantonal,
  type ChildBand,
  type Item,
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

const R = rng(20261015);
const int = (lo: number, hi: number) => lo + Math.floor(R() * (hi - lo + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(R() * xs.length)]!;
const maybe = (p = 0.5) => R() < p;
const status = () => pick(['stated', 'stated', 'verified', 'estimate', 'extracted'] as const);
const amt = (lo: number, hi: number) => ({ value: chf(int(lo, hi)), status: status() });

/** Communes without a further parish: the church question never needs the parish. */
const AARGAU = communesFor(2026)
  .value.filter((c) => !c.extra.length)
  .map((c) => c.name)
  .filter((name) => communesFor(2025).value.some((c) => c.name === name));
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
 * A household every canton computes without what their engines do differently (see the cases
 * below, and the other cantons' federal tests): no benefits replacing a salary, no medical costs or
 * donations, no payments to political parties, no side job. Childcare for a child of any age: the
 * costs of a child of 14 or more count in no canton's engine.
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
    children: Array.from({ length: kids }, () => {
      const under14 = maybe(0.3) ? maybe(0.7) : undefined;
      return {
        custody: shared && maybe(0.8) ? 'shared' : 'full',
        ...(maybe(0.4) ? { childcare: amt(500, 40_000) } : {}),
        ...(under14 !== undefined ? { under14 } : {}),
      };
    }),
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
 * What only Aargau asks: no church (opt-in), each child's age band (under 14 when the household
 * says so or says nothing, as the other cantons take it), and with shared custody without child
 * support who mainly bears the children's upkeep.
 */
function aargauOwn(h: Shared): AargauCantonal {
  const bands = (h.children ?? []).map((c): ChildBand =>
    c.under14 === false ? pick(['under18', 'adult'] as const) : 'under14',
  );
  return {
    church: { p1: 'none', ...(h.civilStatus === 'married' ? { p2: 'none' as const } : {}) },
    ...(bands.length ? { childBands: bands } : {}),
    ...(h.childSupport === 'none' ? { mainUpkeep: h.ifdParentalScale ?? false } : {}),
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
  const ag = aargau.computeReturn({ ...h, commune: pick(AARGAU), cantonal: aargauOwn(h) });
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
  return { ag, ge, zh, be, bl };
}

describe('the federal tax of an Aargau household', () => {
  it('equals Geneva’s, Zurich’s, Bern’s and Basel-Landschaft’s federal tax for the same household, to the centime (2,000 households)', () => {
    let compared = 0;
    let skipped = 0;
    for (let i = 0; i < 2_000; i++) {
      const h = household();
      const { ag, ge, zh, be, bl } = five(h);
      const what = JSON.stringify(h);
      // Aargau's own tax not computed (docs/sources/ag/NOTES.md): nothing to compare.
      if (!ag.icc) {
        skipped++;
        continue;
      }
      expect(Boolean(ag.ifd), what).toBe(Boolean(ge.ifd));
      if (!ag.ifd || !ge.ifd) continue;
      compared++;
      for (const other of [ge.ifd, zh.ifd, be.icc ? be.ifd : ge.ifd, bl.icc ? bl.ifd : ge.ifd]) {
        expect(other, what).not.toBeNull();
        expect(ag.ifd.taxableIncome.amount, what).toBe(other!.taxableIncome.amount);
        expect(ag.ifd.scale, what).toBe(other!.scale);
        expect(ag.ifd.scaleTax.amount, what).toBe(other!.scaleTax.amount);
        expect(ag.ifd.childReduction.amount, what).toBe(other!.childReduction.amount);
        expect(ag.ifd.tax.amount, what).toBe(other!.tax.amount);
        expect(Boolean(ag.ifd.tax.estimates?.length), what).toBe(
          Boolean(other!.tax.estimates?.length),
        );
        expect(Boolean(ag.ifd.tax.needsOk), what).toBe(Boolean(other!.tax.needsOk));
      }
      expect(ag.total, what).toBe(ag.icc.taxes.total.amount + ag.ifd.tax.amount);
    }
    expect(compared).toBeGreaterThan(1_700);
    expect(skipped).toBeLessThan(200);
  });

  it('puts each federal deduction on the Aargau line of the same deduction, in the return’s order, and cites the federal rules', () => {
    const h: Shared = {
      taxYear: 2026,
      commune: 'Aarau',
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
        { custody: 'full', childcare: { value: chf(12_000) } },
        { custody: 'full', under14: false },
      ],
      household: {
        healthPremiums: { value: chf(9_600) },
        medicalCosts: { value: chf(9_000) },
        donations: { value: chf(2_000) },
        bankFees: { value: chf(200) },
      },
    };
    const r = aargau.computeReturn({
      ...h,
      cantonal: { church: { p1: 'none', p2: 'none' }, childBands: ['under14', 'under18'] },
    });
    const codes = r.ifd!.items.map((i) => `${i.code}:${i.person}`);
    expect(codes, codes.join(' ')).toEqual([
      '1.1:p1',
      '1.1:p2',
      '1.2:p2',
      '10.1:p1',
      '10.2:p1',
      '10.3:p1',
      '10.3:p2',
      '10.6:p2',
      '13.2:p1',
      '13.2:p2',
      '14:household',
      '15.0:household',
      '15.3:household',
      '15.4:household',
      '15.5:p1',
      '16:household',
      '17.1:household',
      'bund-ehepaar:household',
      '19.1:household',
    ]);
    expect(r.ifd!.items.find((i) => i.code === 'bund-ehepaar')?.sources.join(' ')).toMatch(
      /ch-2026-ifd-progression-deductions/,
    );
    expect(r.ifd!.items.find((i) => i.code === '14')?.sources.join(' ')).toMatch(
      /ag-2025-guide-wegleitung p\. 42/,
    );
    // The same income lines as the cantonal tax.
    expect(r.ifd!.grossIncome.amount).toBe(r.icc!.grossIncome.amount);
    expect(r.total).toBe(r.icc!.taxes.total.amount + r.ifd!.tax.amount);
    // The federal side job flat of 2026: 20 % of 4,000 is 800, the minimum.
    expect(r.ifd!.items.find((i) => i.code === '10.6')?.amount).toBe(chf(-800));
    // The federal insurance deduction: what was paid, up to the couple's maximum and the children's.
    expect(r.ifd!.items.find((i) => i.code === '14')?.amount).toBe(chf(-5_100));
    // The limits of both taxes; one applied alike in both (the 3a cap) is said once, for both.
    expect(r.limits.filter((l) => l.tax === 'ifd').map((l) => l.code)).toEqual(
      expect.arrayContaining(['14', '15.0', '17.1', '15.3']),
    );
    expect(
      r.limits.filter((l) => l.code === '13.2' && l.person === 'p2').map((l) => l.tax),
    ).toEqual(['both']);
    expect(r.limits.every((l) => l.rule)).toBe(true);
    // The return asks for no premiums: how the tax office knows them is not said.
    expect(r.unverifiedRules).toContainEqual(FEDERAL_NOTE.insurance);
    // Its totals: the income less the deductions, then the medical costs and donations, then the
    // social deductions, in whole francs.
    const t = federalTotals(r.ifd!.items);
    expect(t.taxableIncome.amount).toBe(r.ifd!.taxableIncome.amount);
    const social = r
      .ifd!.items.filter((i) => i.code === '19.1' || i.code === 'bund-ehepaar')
      .reduce((s, i) => s + i.amount, 0);
    expect(r.ifd!.taxableIncome.amount).toBe(
      Math.floor((r.ifd!.netIncome.amount + social) / 100) * 100,
    );
  });

  it('a side job in 2025: no 2025 document gives the federal flat, the federal tax is not computed', () => {
    const r = aargau.computeReturn({
      taxYear: 2025,
      commune: 'Aarau',
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
      cantonal: { church: { p1: 'none' } },
    });
    expect(r.icc).not.toBeNull();
    expect(r.ifd).toBeNull();
    expect(r.total).toBeNull();
    expect(r.unsupported).toEqual([FEDERAL_NOTE.sideJob2025]);
  });
});

describe('where the cantons’ engines take a federal deduction differently (open points)', () => {
  /** A single person with a salary and no other deduction. */
  const single = (gross: number, extra: Shared['household']): Shared => ({
    taxYear: 2026,
    commune: '',
    civilStatus: 'single',
    people: [{ id: 'p1', employments: [{ gross: { value: chf(gross) } }] }],
    household: extra,
  });
  const ded = (items: readonly Pick<Item, 'code' | 'amount'>[], code: string) =>
    -(items.find((i) => i.code === code)?.amount ?? 0);
  const none = { church: { p1: 'none' as const } };

  it('medical costs: 5 % of the net income before them, as the federal instructions, Zurich and Geneva; Basel-Landschaft’s guide takes x 5 : 95', () => {
    // 100,000 salary: the 3 % flat is 3,000, so the net income before the costs is 97,000. Costs
    // 9,000: 5 % of 97,000 = 4,850, deducted 4,150 (ch-2026-ifd-instructions-personnes-physiques
    // p. 9, chiffre 21.1). Basel-Landschaft: (97,000 - 9,000) x 5 : 95 = 4,632, deducted 4,368.
    const h = single(100_000, { medicalCosts: { value: chf(9_000) } });
    const ag = aargau.computeReturn({ ...h, commune: 'Aarau', cantonal: none }).ifd!;
    const zh = zurich.computeReturn({ ...h, commune: 261 }).ifd!;
    const ge = geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;
    const bl = baselLand.computeReturn({ ...h, commune: 'Liestal', cantonal: none }).ifd!;
    expect(ded(ag.items, '17.1')).toBe(chf(4_150));
    expect(ded(zh.items, '320')).toBe(chf(4_150));
    expect(ag.tax.amount).toBe(zh.tax.amount);
    expect(ag.tax.amount).toBe(ge.tax.amount);
    expect(ded(bl.items, '720')).toBe(chf(4_368));
  });

  it('donations: at most 20 % of the net income before them, the married couple deduction after them (as Zurich, not as Geneva)', () => {
    // A couple: Geneva takes the married couple deduction before its subtotal 92.40, Aargau (as
    // the federal instructions, chiffre 21.2 and 23) and Zurich after; donations above the cap
    // show it.
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
    const ag = aargau.computeReturn({
      ...h,
      commune: 'Aarau',
      cantonal: { church: { p1: 'none', p2: 'none' } },
    }).ifd!;
    const zh = zurich.computeReturn({ ...h, commune: 261 }).ifd!;
    const ge = geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;
    expect(ded(ag.items, '15.3')).toBe(ded(zh.items, '324'));
    expect(ded(ag.items, '15.3') - ded(ge.items, '73.00')).toBe(chf(560));
    expect(ag.tax.amount).toBe(zh.tax.amount);
  });

  it('childcare of a child of 14 or more: counted for neither tax, in every canton’s engine', () => {
    // Two children, the younger under 14 with childcare 10,000, the elder 15 with 5,000: only
    // children under 14 count (ch-2026-ifd-instructions-personnes-physiques p. 8, "jusqu’à 14
    // ans"), so 10,000. Geneva, Zurich, Bern and Basel-Landschaft leave the elder's 5,000 out too,
    // where they used to add it to the total, capped per child under 14: 15,000.
    const h: Shared = {
      taxYear: 2026,
      commune: '',
      civilStatus: 'married',
      people: [
        { id: 'p1', employments: [{ gross: { value: chf(90_000) } }] },
        { id: 'p2', employments: [{ gross: { value: chf(60_000) } }] },
      ],
      children: [
        { custody: 'full', under14: true, childcare: { value: chf(10_000) } },
        { custody: 'full', under14: false, childcare: { value: chf(5_000) } },
      ],
    };
    const ag = aargau.computeReturn({
      ...h,
      commune: 'Aarau',
      cantonal: { church: { p1: 'none', p2: 'none' }, childBands: ['under14', 'under18'] },
    });
    const ge = geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;
    const zh = zurich.computeReturn({ ...h, commune: 261 }).ifd!;
    const be = bern.computeReturn({
      ...h,
      commune: 351,
      cantonal: { church: { p1: 'none', p2: 'none' } },
    }).ifd!;
    const bl = baselLand.computeReturn({
      ...h,
      commune: 'Liestal',
      cantonal: { church: { p1: 'none', p2: 'none' } },
    }).ifd!;
    expect(ded(ag.ifd!.items, '15.0')).toBe(chf(10_000));
    expect(ded(ge.items, '59.12')).toBe(chf(10_000));
    expect(ded(zh.items, '376')).toBe(chf(10_000));
    expect(ded(be.items, '2.1-betreuung')).toBe(chf(10_000));
    expect(ded(bl.items, '640')).toBe(chf(10_000));
    for (const other of [ge, zh, be, bl]) expect(ag.ifd!.tax.amount).toBe(other.tax.amount);
    // The cantonal tax counts the younger child's only, as the canton's documents say; the result
    // says why the elder's costs are left out, for each tax.
    expect(ded(ag.icc!.items, '15.0')).toBe(chf(10_000));
    expect(ag.notCounted).toContainEqual(NOTE.childcareOver14);
    expect(ag.notCounted).toContainEqual(IFD_NOTE.childcareAge);
  });
});

describe('childcare of one child above the maximum, next to another under it', () => {
  it('caps each child’s costs, then adds them up, for both taxes', () => {
    // Two children under 14, childcare of 30,000 and 5,000: each child's costs count at most the
    // maximum, then they are added up: cantonal 25,000 + 5,000 = 30,000 (15.0, at most 25,000 per
    // child, StG § 40 Abs. 1 lit. n); federal 25,800 + 5,000 = 30,800 (Form. 2a 2026 p. 8, "25 800
    // fr. par enfant"), where the federal sum used to take 35,000 within twice the maximum.
    const h: Shared = {
      taxYear: 2026,
      commune: '',
      civilStatus: 'married',
      people: [
        { id: 'p1', employments: [{ gross: { value: chf(90_000) } }] },
        { id: 'p2', employments: [{ gross: { value: chf(60_000) } }] },
      ],
      children: [
        { custody: 'full', under14: true, childcare: { value: chf(30_000) } },
        { custody: 'full', under14: true, childcare: { value: chf(5_000) } },
      ],
    };
    const r = aargau.computeReturn({
      ...h,
      commune: 'Aarau',
      cantonal: { church: { p1: 'none', p2: 'none' }, childBands: ['under14', 'under14'] },
    });
    const ded = (items: readonly { code: string; amount: number }[], code: string) =>
      -(items.find((i) => i.code === code)?.amount ?? 0);
    expect(ded(r.icc!.items, '15.0')).toBe(chf(30_000));
    expect(ded(r.ifd!.items, '15.0')).toBe(chf(30_800));
  });
});
