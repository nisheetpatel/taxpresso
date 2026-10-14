// The federal tax is the same in every canton (LIFD; packages/rules-ch): for the same household,
// the federal tax St. Gallen's tax office derives from the return (./src/ifd.ts) must give Geneva's
// federal tax, to the centime, and Zurich's, Bern's, Basel-Landschaft's and Zug's. Checked on seeded
// synthetic households through the six cantons' interfaces; then the lines for one household; then
// the places where St. Gallen's documents take a federal deduction as another canton's form does and
// not as Geneva's, each pinned with its documents (docs/sources/sg/NOTES.md, "Wiring St. Gallen in
// the app").
import { communesFor as bernCommunes, rules as bern, type BernCantonal } from '@taxpresso/rules-be';
import {
  communesFor as baselLandCommunes,
  rules as baselLand,
  type BaselLandCantonal,
} from '@taxpresso/rules-bl';
import { IFD_NOTE, type HouseholdInput, type PersonInput } from '@taxpresso/rules-ch';
import { COMMUNES_2026, rules as geneva } from '@taxpresso/rules-ge';
import { communesFor as zugCommunes, rules as zug, type ZugCantonal } from '@taxpresso/rules-zg';
import { communesFor as zurichCommunes, rules as zurich } from '@taxpresso/rules-zh';
import { describe, expect, it } from 'vitest';
import {
  communesFor,
  FEDERAL_NOTE,
  federalTotals,
  NOTE,
  rules as stGallen,
  type Item,
  type StGallenCantonal,
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

const ST_GALLEN = communesFor(2026).value.map((c) => c.name);
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
  // No motorbike without public transport: St. Gallen's documents disagree on its rate per km
  // (NOTE.motorbikeRate), so its cantonal tax, and the federal one with it, is not computed.
  const by = pick(['public_transport', 'car', 'bike', 'walk', 'home', undefined] as const);
  if (by) {
    p.commuteMode =
      by === 'car'
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
 * What only St. Gallen asks: no church (opt-in), each child's stage (not yet of school age only
 * under 14) and, in school, whether a minor, and with shared custody without child support who
 * mainly bears the children's upkeep.
 */
function stGallenOwn(h: Shared): StGallenCantonal {
  const couple = h.civilStatus === 'married';
  return {
    church: { p1: 'none', ...(couple ? { p2: 'none' as const } : {}) },
    ...(h.children?.length
      ? {
          children: h.children.map((c) =>
            c.under14 !== false && maybe()
              ? { stage: 'preschool' as const }
              : { stage: 'school' as const, minor: c.under14 !== false || maybe() },
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

function six(h: Shared) {
  const sg = stGallen.computeReturn({ ...h, commune: pick(ST_GALLEN), cantonal: stGallenOwn(h) });
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
  const zg = zug.computeReturn({ ...h, commune: pick(ZUG), cantonal: zugOwn(h) });
  return { sg, ge, zh, be, bl, zg };
}

describe('the federal tax of a St. Gallen return', () => {
  it('equals Geneva’s, Zurich’s, Bern’s, Basel-Landschaft’s and Zug’s federal tax for the same household, to the centime (2,000 households)', () => {
    let compared = 0;
    let skipped = 0;
    for (let i = 0; i < 2_000; i++) {
      const h = household();
      const { sg, ge, zh, be, bl, zg } = six(h);
      const what = JSON.stringify(h);
      // St. Gallen's own tax not computed (docs/sources/sg/NOTES.md): nothing to compare.
      if (!sg.icc) {
        skipped++;
        continue;
      }
      expect(Boolean(sg.ifd), what).toBe(Boolean(ge.ifd));
      if (!sg.ifd || !ge.ifd) continue;
      compared++;
      for (const other of [
        ge.ifd,
        zh.ifd,
        be.icc ? be.ifd : ge.ifd,
        bl.icc ? bl.ifd : ge.ifd,
        zg.icc ? zg.ifd : ge.ifd,
      ]) {
        expect(other, what).not.toBeNull();
        expect(sg.ifd.taxableIncome.amount, what).toBe(other!.taxableIncome.amount);
        expect(sg.ifd.scale, what).toBe(other!.scale);
        expect(sg.ifd.scaleTax.amount, what).toBe(other!.scaleTax.amount);
        expect(sg.ifd.childReduction.amount, what).toBe(other!.childReduction.amount);
        expect(sg.ifd.tax.amount, what).toBe(other!.tax.amount);
        expect(Boolean(sg.ifd.tax.estimates?.length), what).toBe(
          Boolean(other!.tax.estimates?.length),
        );
        expect(Boolean(sg.ifd.tax.needsOk), what).toBe(Boolean(other!.tax.needsOk));
      }
    }
    expect(compared).toBeGreaterThan(1_800);
    expect(skipped).toBeLessThan(150);
  });

  it('puts each federal deduction on its line of the return, in the return’s order, and cites the federal rules', () => {
    const h: Shared = {
      taxYear: 2026,
      commune: 'Wil',
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
    const r = stGallen.computeReturn({
      ...h,
      cantonal: {
        church: { p1: 'none', p2: 'none' },
        children: [{ stage: 'preschool' }, { stage: 'school', minor: true }],
      },
    });
    const codes = r.ifd!.items.map((i) => `${i.code}:${i.person}`);
    expect(codes, codes.join(' ')).toEqual([
      '100:p1',
      '102:p2',
      '106:p2',
      '406:p1',
      '408:p1',
      '416:p1',
      '466:p2',
      '482:p2',
      '208:p1',
      '210:p2',
      '600:household',
      '220:household',
      '258:household',
      '223:p1',
      '226:household',
      '240:household',
      '244:household',
      '23.1-23.3:household',
      'Ehepaare:household',
    ]);
    expect(r.ifd!.items.find((i) => i.code === 'Ehepaare')?.sources.join(' ')).toMatch(
      /ch-2026-ifd-progression-deductions/,
    );
    // The same income lines as the cantonal tax: one income page.
    expect(r.ifd!.grossIncome.amount).toBe(r.icc!.grossIncome.amount);
    expect(r.total).toBe(r.icc!.taxes.total.amount + r.ifd!.tax.amount);
    // Person 2's other professional costs: the federal 3 % flat on 46,800 (2,000, the minimum); the
    // side job's flat of 2026, 20 % of 4,000 = 800, the minimum.
    expect(r.ifd!.items.find((i) => i.code === '466')?.amount).toBe(chf(-2_000));
    expect(r.ifd!.items.find((i) => i.code === '482')?.amount).toBe(chf(-800));
    // The limits of both taxes; one applied alike in both (the 3a cap) is said once, for both.
    expect(r.limits.filter((l) => l.tax === 'ifd').map((l) => l.code)).toEqual(
      expect.arrayContaining(['600', '258', '240', '244']),
    );
    expect(r.limits.filter((l) => l.code === '210').map((l) => `${l.person} ${l.tax}`)).toEqual([
      'p2 both',
    ]);
    expect(r.limits.every((l) => l.rule)).toBe(true);
    // Its totals: 7. less 18. is 20.; less 21.1 and 21.3, 22.; less the federal social deductions,
    // 24. in whole francs.
    const t = federalTotals(r.ifd!.items);
    expect(t.taxableIncome.amount).toBe(r.ifd!.taxableIncome.amount);
    expect(r.ifd!.netIncomeBase.amount).toBe(
      r.ifd!.grossIncome.amount - r.ifd!.totalDeductions.amount,
    );
  });

  it('a side job in 2025: no 2025 federal document gives the federal flat, the federal tax is not computed', () => {
    const r = stGallen.computeReturn({
      taxYear: 2025,
      commune: 'St. Gallen',
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

describe('where St. Gallen’s documents take a federal deduction as Zurich’s and Zug’s forms do (open points)', () => {
  const ded = (items: readonly Pick<Item, 'code' | 'amount'>[], code: string) =>
    -(items.find((i) => i.code === code)?.amount ?? 0);
  const own = { church: { p1: 'none' as const } };

  it('illness costs: 5 % of the Nettoeinkommen (20.) with the federal amounts, as Zurich, Zug and Geneva', () => {
    // 100,000 salary: the 3 % flat is 3,000, so 20. is 97,000. Costs 9,000: 5 % of 97,000 = 4,850,
    // deducted 4,150 (sg-2025-guide-merkblatt-dbst p. 1: "Selbstbehalt 5% der Nettoeinkünfte";
    // ch-2026-ifd-instructions-personnes-physiques p. 9: "revenu net selon chiffre 20").
    const h: Shared = {
      taxYear: 2026,
      commune: '',
      civilStatus: 'single',
      people: [{ id: 'p1', employments: [{ gross: { value: chf(100_000) } }] }],
      household: { medicalCosts: { value: chf(9_000) } },
    };
    const sg = stGallen.computeReturn({ ...h, commune: 'St. Gallen', cantonal: own }).ifd!;
    const zh = zurich.computeReturn({ ...h, commune: 261 }).ifd!;
    const ge = geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;
    expect(ded(sg.items, '240')).toBe(chf(4_150));
    expect(ded(zh.items, '320')).toBe(chf(4_150));
    expect(sg.tax.amount).toBe(zh.tax.amount);
    expect(sg.tax.amount).toBe(ge.tax.amount);
  });

  it('donations with illness costs: 20 % of 20., before the illness costs (as Zurich and Zug, not as Geneva)', () => {
    // The federal instructions measure both on "revenu net selon chiffre 20"
    // (ch-2026-ifd-instructions-personnes-physiques p. 9), as St. Gallen's return does for both
    // (21.1 and 21.3 on Ziffer 20); Geneva measures the donations on 92.40, after the illness
    // costs. 100,000 salary, 20. = 97,000: illness costs 9,000 less 4,850 = 4,150; donations at
    // most 20 % of 97,000 = 19,400, where Geneva gives 20 % of 92,850 = 18,570: 830 more.
    const h: Shared = {
      taxYear: 2026,
      commune: '',
      civilStatus: 'single',
      people: [{ id: 'p1', employments: [{ gross: { value: chf(100_000) } }] }],
      household: { medicalCosts: { value: chf(9_000) }, donations: { value: chf(50_000) } },
    };
    const sg = stGallen.computeReturn({ ...h, commune: 'St. Gallen', cantonal: own }).ifd!;
    const zh = zurich.computeReturn({ ...h, commune: 261 }).ifd!;
    const zg = zug.computeReturn({
      ...h,
      commune: 'Zug',
      cantonal: { church: { p1: 'none' }, citizenOf: { p1: null } },
    }).ifd!;
    const ge = geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;
    expect(ded(sg.items, '240')).toBe(chf(4_150));
    expect(ded(sg.items, '244')).toBe(chf(19_400));
    expect(ded(sg.items, '244') - ded(ge.items, '73.00')).toBe(chf(830));
    expect(sg.taxableIncome.amount).toBe(zh.taxableIncome.amount);
    expect(sg.taxableIncome.amount).toBe(zg.taxableIncome.amount);
  });

  it('donations: at most 20 % of 20., before the married couple deduction (as Zurich and Zug, not as Geneva)', () => {
    // A couple: Geneva takes the married couple deduction before its subtotal 92.40; St. Gallen's
    // tax office takes it among the social deductions after 22. (sg-2025-guide-merkblatt-dbst p. 1;
    // the federal instructions, p. 9, Chiffre 23), as Zurich (365) and Zug (401); donations above
    // the cap show it: 20 % of the federal married couple deduction, 2,800, is 560.
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
    const sg = stGallen.computeReturn({
      ...h,
      commune: 'St. Gallen',
      cantonal: { church: { p1: 'none', p2: 'none' } },
    }).ifd!;
    const zh = zurich.computeReturn({ ...h, commune: 261 }).ifd!;
    const zg = zug.computeReturn({
      ...h,
      commune: 'Zug',
      cantonal: { church: { p1: 'none', p2: 'none' }, citizenOf: { p1: null, p2: null } },
    }).ifd!;
    const ge = geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;
    expect(ded(sg.items, '244')).toBe(ded(zh.items, '324'));
    expect(ded(sg.items, '244')).toBe(ded(zg.items, '296'));
    expect(ded(sg.items, '244') - ded(ge.items, '73.00')).toBe(chf(560));
    expect(sg.tax.amount).toBe(zh.tax.amount);
    expect(sg.tax.amount).toBe(zg.tax.amount);
  });
});

describe('childcare of a child of 14 or more', () => {
  it('counts for neither tax, and the result says so', () => {
    // Two children: the younger under 14 with childcare of 8,000, the elder 14 or more at the end
    // of the year with 5,000. Only the younger child’s counts: cantonal 8,000 (16.2, at most
    // 26,800, StG Art. 45 Abs. 1 lit. h); federal 8,000 (at most 25,800, Form. 2a 2026 p. 8), where
    // the federal sum used to take both, 13,000, within the cap of the one child under 14.
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
    const r = stGallen.computeReturn({
      ...h,
      commune: 'St. Gallen',
      cantonal: {
        church: { p1: 'none', p2: 'none' },
        children: [{ stage: 'preschool' }, { stage: 'school', minor: true }],
      },
    });
    const ded = (items: readonly { code: string; amount: number }[], code: string) =>
      -(items.find((i) => i.code === code)?.amount ?? 0);
    expect(ded(r.icc!.items, '258')).toBe(chf(8_000));
    expect(ded(r.ifd!.items, '258')).toBe(chf(8_000));
    expect(r.notCounted).toContainEqual(NOTE.childcareAge);
    expect(r.notCounted).toContainEqual(IFD_NOTE.childcareAge);
  });
});
