// The federal tax is the same in every canton (LIFD; packages/rules-ch): for the same household,
// Fribourg's federal tax must give Geneva's, to the centime, and Zurich's and Lucerne's. Checked on
// seeded synthetic households through the cantons' interfaces; then the federal column of one
// household; then the places where Fribourg's own documents take a federal deduction otherwise than
// Geneva's form, each pinned with its documents (docs/sources/fr/NOTES.md, "Wiring Fribourg in the
// app").
import { IFD_NOTE, ifdParamsFor, type HouseholdInput, type PersonInput } from '@taxpresso/rules-ch';
import { COMMUNES_2026, rules as geneva } from '@taxpresso/rules-ge';
import { communesFor as lucerneCommunes, rules as lucerne } from '@taxpresso/rules-lu';
import { rules as zug } from '@taxpresso/rules-zg';
import { communesFor as zurichCommunes, rules as zurich } from '@taxpresso/rules-zh';
import { describe, expect, it } from 'vitest';
import {
  communesFor,
  FEDERAL_DIFFERENT,
  NOTE,
  rules as fribourg,
  type FribourgCantonal,
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

const R = rng(20261014);
const int = (lo: number, hi: number) => lo + Math.floor(R() * (hi - lo + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(R() * xs.length)]!;
const maybe = (p = 0.5) => R() < p;
const status = () => pick(['stated', 'stated', 'verified', 'estimate', 'extracted'] as const);
const amt = (lo: number, hi: number) => ({ value: chf(int(lo, hi)), status: status() });

const LUCERNE = lucerneCommunes(2025).value.map((c) => c.name);
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
          : { by, transitUsable: false, kmOneWay: int(1, 80), days: int(50, 220) }
        : { by };
    if (by === 'public_transport' || (by === 'car' && maybe())) p.commuteCost = amt(200, 6_000);
  }
  if (maybe(0.6)) p.mealDays = int(0, 240);
  if (maybe(0.1)) p.otherProfessionalCosts = amt(100, 8_000);
  if (maybe(0.08)) p.trainingCosts = amt(100, 15_000);
  return p as unknown as PersonInput;
}

/**
 * A household every canton computes without what their forms or documents do differently (see the
 * cases below, and the other cantons' federal tests): no benefits replacing a salary, no medical
 * costs or donations, no side job (Geneva's engine takes none), no buy-in taken from a salary (box
 * 10.2) and no accounts or securities; health premiums above every federal maximum and no subsidy
 * (Fribourg's federal column takes the flat amount of 4.110, which is always above it: the case
 * below); shared custody with child support only (without it, Fribourg's documents differ and
 * rules-fr doesn't compute).
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
    // Childcare for a child of any age: the costs of a child of 14 or more count in no canton's
    // engine (the case below).
    children: Array.from({ length: kids }, () => {
      const under14 = maybe(0.3) ? maybe(0.7) : undefined;
      return {
        custody: shared && maybe(0.8) ? 'shared' : 'full',
        ...(maybe(0.4) ? { childcare: amt(500, 40_000) } : {}),
        ...(under14 !== undefined ? { under14 } : {}),
      };
    }),
  };
  if (shared) h.childSupport = pick(['receives', 'pays'] as const);
  // Stated: Fribourg's federal column doesn't read the premiums paid, so their status can't show.
  const hh: Record<string, unknown> = {
    healthPremiums: { value: chf(int(20_000, 30_000)), status: 'stated' },
  };
  if (maybe(0.15)) hh.lifeInsurancePremiums = amt(500, 5_000);
  if (maybe(0.15)) hh.savingsInterest = amt(10, 2_000);
  if (maybe(0.08)) hh.alimonyPaid = amt(1_000, 30_000);
  if (maybe(0.15)) hh.debtInterest = amt(100, 10_000);
  if (maybe(0.1)) hh.politicalParty = amt(100, 15_000);
  h.household = hh;
  return h as unknown as Shared;
}

/** What only Fribourg asks: no church (opt-in, every adult answered), each child under 14 or not. */
function fribourgOwn(h: Shared): FribourgCantonal {
  const couple = h.civilStatus === 'married';
  return {
    church: { p1: 'none', ...(couple ? { p2: 'none' as const } : {}) },
    ...(h.children?.length
      ? { children: h.children.map((c) => ({ age: 'child' as const, under14: c.under14 ?? true })) }
      : {}),
  };
}

/** The same household in Fribourg, Geneva, Zurich and Lucerne. */
function four(h: Shared) {
  const fr = fribourg.computeReturn({
    ...h,
    commune: pick(communesFor(2025).value).bfs,
    cantonal: fribourgOwn(h),
  });
  const ge = geneva.computeReturn({ ...h, commune: pick(COMMUNES_2026).slug });
  const zh = zurich.computeReturn({ ...h, commune: pick(ZURICH) });
  const lu = lucerne.computeReturn({
    ...h,
    commune: pick(LUCERNE),
    cantonal: {
      church: {
        p1: 'none',
        ...(h.civilStatus === 'married' ? { p2: 'none' as const } : {}),
        ...(h.children?.length ? { children: h.children.map(() => 'none' as const) } : {}),
      },
      ...(h.children?.length
        ? { children: h.children.map((c) => ({ under14: c.under14 ?? true, livesWithYou: true })) }
        : {}),
    },
  });
  return { fr, ge, zh, lu };
}

describe('the federal tax of a Fribourg household', () => {
  it('equals Geneva’s, Zurich’s and Lucerne’s federal tax for the same household, to the centime (2,000 households)', () => {
    let compared = 0;
    let skipped = 0;
    for (let i = 0; i < 2_000; i++) {
      // 2026 has no communal coefficients: the federal tax is compared on 2025's communes, whose
      // federal amounts are 2025's; the 2026 federal amounts are checked by the same households
      // through the federal column below (the tax year itself picks them).
      const h = { ...household(), taxYear: 2025 as const };
      const { fr, ge, zh, lu } = four(h);
      const what = JSON.stringify(h);
      // Fribourg's own tax not computed (docs/sources/fr/NOTES.md): nothing to compare.
      if (!fr.icc) {
        skipped++;
        continue;
      }
      expect(Boolean(fr.ifd), what).toBe(Boolean(ge.ifd));
      if (!fr.ifd || !ge.ifd) continue;
      compared++;
      for (const other of [ge.ifd, zh.ifd, lu.icc ? lu.ifd : ge.ifd]) {
        expect(other, what).not.toBeNull();
        expect(fr.ifd.taxableIncome.amount, what).toBe(other!.taxableIncome.amount);
        expect(fr.ifd.scale, what).toBe(other!.scale);
        expect(fr.ifd.scaleTax.amount, what).toBe(other!.scaleTax.amount);
        expect(fr.ifd.childReduction.amount, what).toBe(other!.childReduction.amount);
        expect(fr.ifd.tax.amount, what).toBe(other!.tax.amount);
        expect(Boolean(fr.ifd.tax.estimates?.length), what).toBe(
          Boolean(other!.tax.estimates?.length),
        );
        expect(Boolean(fr.ifd.tax.needsOk), what).toBe(Boolean(other!.tax.needsOk));
      }
    }
    expect(compared).toBeGreaterThan(1_700);
    expect(skipped).toBeLessThan(250);
  }, 120_000);

  it('the 2026 federal amounts, through the federal column alone (2,000 households)', async () => {
    // The 2026 taxes are not computed (no communal coefficients), so the federal column is run on
    // the 2026 lines with a 2025 commune: the same household then gives Geneva's 2026 federal tax.
    const { federalReturn, computeReturn, fribourgInput } = await import('../src/index.js');
    let compared = 0;
    for (let i = 0; i < 2_000; i++) {
      const h = { ...household(), taxYear: 2026 as const };
      const input = fribourgInput({
        ...h,
        commune: pick(communesFor(2026).value).bfs,
        cantonal: fribourgOwn(h),
      });
      const r = computeReturn(input);
      if (!r.form) continue;
      const couple = input.civilStatus === 'married';
      const children = (input.children ?? [])
        .filter((c) => couple || c.custody === 'full' || input.childSupport === 'receives')
        .map((c) => ({
          livesWithYou: true,
          ...(c.under14 !== undefined ? { under14: c.under14 } : {}),
          ...(c.childcare ? { childcare: c.childcare } : {}),
        }));
      const shared = !couple && (input.children ?? []).some((c) => c.custody === 'shared');
      const f = federalReturn({
        input,
        couple,
        form: r.form,
        children,
        childSources:
          shared && input.childSupport === 'receives'
            ? ['ch-na-circulaire-30-epoux-famille p. 24 and 33 (ch. 13.4.2, 14.5)']
            : shared && input.childSupport === 'pays'
              ? ['ch-na-circulaire-30-epoux-famille p. 24, 32 and 33 (ch. 13.4.2, 14.5)']
              : [],
        people: [...input.people].sort((a, b) => a.id.localeCompare(b.id)),
      }).ifd;
      const ge = geneva.computeReturn({ ...h, commune: pick(COMMUNES_2026).slug }).ifd;
      expect(Boolean(f), JSON.stringify(h)).toBe(Boolean(ge));
      if (!f || !ge) continue;
      compared++;
      expect(f.taxableIncome.amount, JSON.stringify(h)).toBe(ge.taxableIncome.amount);
      expect(f.tax.amount, JSON.stringify(h)).toBe(ge.tax.amount);
    }
    expect(compared).toBeGreaterThan(1_700);
  }, 120_000);
});

describe('the federal column of one household', () => {
  // A couple in Bulle, 2025: person 1 drives 30 km to work on 220 days (13,200 km: the cantonal
  // 8,920 within the maximum 12,000 on 2.110, the federal 3,300), person 2 takes the bus (800, the
  // same in both); a child under 14 in a crèche and one aged 14 or more; health premiums of 9,600,
  // the cantonal flat amount 2 x 4,810 + 2 x 1,140 = 11,900 on 4.110, the federal maximum 3,700 +
  // 2 x 700 on the federal 4.110.
  const h: Shared = {
    taxYear: 2025,
    commune: 2125,
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
        commuteMode: { by: 'car', transitUsable: false, kmOneWay: 30, days: 220 },
        mealDays: 200,
        pillar3a: { value: chf(7_258) },
        trainingCosts: { value: chf(13_500) },
      },
      {
        id: 'p2',
        employments: [
          { gross: { value: chf(50_000) }, socialContributions: { value: chf(3_200) } },
        ],
        hasPensionFund: false,
        pillar3a: { value: chf(9_000) },
        commuteMode: { by: 'public_transport' },
        commuteCost: { value: chf(800) },
      },
    ],
    children: [
      { custody: 'full', childcare: { value: chf(14_000) } },
      { custody: 'full', under14: false },
    ],
    household: {
      healthPremiums: { value: chf(9_600) },
      politicalParty: { value: chf(8_000) },
    },
  };
  const r = fribourg.computeReturn({
    ...h,
    cantonal: {
      church: { p1: 'none', p2: 'none' },
      children: [
        { age: 'child', under14: true },
        { age: 'child', under14: false },
      ],
    },
  });
  const ifd = r.ifd!;
  const at = (code: string, person = 'household') =>
    ifd.items.find((i) => i.code === code && i.person === person)?.amount;
  const icc = (code: string, person = 'household') =>
    r.icc!.items.find((i) => i.code === code && i.person === person)?.amount;

  it('keeps the return’s lines but those the guide lists, which take their federal amounts', () => {
    // The kept lines carry the cantonal amount; the replaced ones are federal (packages/rules-ch).
    for (const i of ifd.items) {
      if (FEDERAL_DIFFERENT.has(i.code) || ['5.110', '5.120', '6.110', '6.150'].includes(i.code)) {
        continue;
      }
      expect(i.amount, i.code).toBe(icc(i.code, i.person));
    }
    expect(icc('2.110', 'p1')).toBe(chf(-8_920));
    expect(at('2.110', 'p1')).toBe(chf(-3_300));
    expect(at('2.110', 'p2')).toBe(chf(-800));
    // Training: 12,000 cantonal, 13,000 federal (2025, guide p. 48).
    expect(icc('4.420', 'p1')).toBe(chf(-12_000));
    expect(at('4.420', 'p1')).toBe(chf(-13_000));
    // Childcare: 12,000 cantonal per child, 25,800 federal in 2025 (guide p. 48, as the federal
    // circular, ch-2025-ifd-frais-professionnels-progression p. 2).
    expect(icc('4.380')).toBe(chf(-12_000));
    expect(at('4.380')).toBe(chf(-14_000));
    // Parties: 5,000 cantonal, the federal maximum above 8,000.
    expect(icc('4.410')).toBe(chf(-5_000));
    expect(at('4.410')).toBe(chf(-8_000));
    // Insurance: the flat amounts of 4.110 (11,900) above the federal maximum (3,700 + 2 x 700).
    expect(icc('4.110')).toBe(chf(-11_900));
    expect(at('4.110')).toBe(chf(-(3_700 + 1_400)));
    // The two-earner deduction: the federal one replaces the cantonal 500.
    expect(icc('2.510')).toBe(chf(-500));
    expect(at('2.510')).toBeLessThan(chf(-8_000));
    // The married couple deduction is the federal tax's only (6.150); no modest income deduction.
    expect(at('6.150')).toBe(chf(-2_800));
    expect(at('7.110')).toBeUndefined();
    for (const i of ifd.items) expect(i.sources.join(' '), i.code).toMatch(/p\. 4[789]/);
  });

  it('adds up: the lines to 4.910, then the medical costs and donations, then the social deductions', () => {
    const sum = (xs: readonly Pick<Item, 'amount'>[]) => xs.reduce((s, i) => s + i.amount, 0);
    const until4910 = ifd.items.filter(
      (i) => !['5.110', '5.120', '6.110', '6.150'].includes(i.code),
    );
    expect(ifd.incomeAfterDeductions.amount).toBe(sum(until4910));
    expect(ifd.taxableIncome.amount).toBe(Math.floor(sum(ifd.items) / 100) * 100);
    expect(r.total).toBe(r.icc!.taxes.total.amount + ifd.tax.amount);
  });

  it('says which tax each limit applied to: both on the lines the federal tax takes as they are', () => {
    const of = (code: string, person?: string) =>
      r.limits
        .filter((l) => l.code === code && (person === undefined || l.person === person))
        .map((l) => l.tax);
    expect(of('2.110', 'p1')).toEqual(['icc', 'ifd']);
    expect(of('2.110', 'p2')).toEqual(['icc', 'ifd']);
    expect(of('2.120')).toEqual(['both']);
    expect(of('4.130')).toEqual(['both', 'both']);
    expect(of('4.380')).toEqual(['icc', 'ifd']);
    expect(of('4.410')).toEqual(['icc', 'ifd']);
    expect(of('4.420', 'p1')).toEqual(['icc', 'ifd']);
    expect(r.limits.every((l) => l.rule)).toBe(true);
  });
});

describe('where Fribourg’s documents take a federal deduction otherwise than Geneva’s form (open points)', () => {
  const alone: FribourgCantonal = { church: { p1: 'none' } };
  const single = (p: PersonInput, more: Partial<Shared> = {}): Shared => ({
    taxYear: 2025,
    commune: '',
    civilStatus: 'single',
    people: [p],
    household: { healthPremiums: { value: chf(20_000) } },
    ...more,
  });
  const both = (h: Shared, cantonal: FribourgCantonal = alone) => ({
    fr: fribourg.computeReturn({ ...h, commune: 'Fribourg', cantonal }).ifd!,
    ge: geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!,
  });
  const salary = (gross: number) => ({
    id: 'p1' as const,
    employments: [
      { gross: { value: chf(gross) }, socialContributions: { value: chf(gross * 0.064) } },
    ],
  });

  it('insurance: the flat amount of 4.110, not the premiums paid (guide p. 48)', () => {
    // Premiums paid 1,000: Geneva deducts them; Fribourg's federal column takes the premiums of the
    // return, the flat amount 4,810 (fr-2025-guide-instructions-generales p. 24 and 48), up to the
    // federal maximum 2,700 (no 2nd pillar or 3a): 1,700 less taxable income.
    const h = single(salary(60_000), { household: { healthPremiums: { value: chf(1_000) } } });
    const { fr, ge } = both(h);
    expect(ge.taxableIncome.amount - fr.taxableIncome.amount).toBe(chf(1_700));
  });

  it('a premium subsidy comes off the flat amount, not off the premiums paid', () => {
    // Flat 4,810 less the subsidy 3,000 = 1,810, under the maximum 2,700: Fribourg deducts 1,810;
    // Geneva, the premiums 20,000 less 3,000, the maximum 2,700.
    const h = single(salary(60_000), {
      household: { healthPremiums: { value: chf(20_000) }, healthSubsidy: { value: chf(3_000) } },
    });
    const { fr, ge } = both(h);
    expect(fr.taxableIncome.amount - ge.taxableIncome.amount).toBe(chf(2_700 - 1_810));
  });

  it('childcare for a child of 14 or more counts for neither tax, as in Geneva’s engine', () => {
    // Two children, 6,000 of childcare each, the second aged 14: LIFD art. 33 al. 3 and the guide
    // (p. 48: "par enfant") count the first child's only. Geneva's federal childcare leaves the
    // second child's out too (packages/rules-ge), where it used to add it within the cap of the
    // children under 14: the same taxable income.
    const h = single(salary(80_000), {
      civilStatus: 'divorced',
      children: [
        { custody: 'full', childcare: { value: chf(6_000) } },
        { custody: 'full', under14: false, childcare: { value: chf(6_000) } },
      ],
    });
    const { fr, ge } = both(h, {
      church: { p1: 'none' },
      children: [
        { age: 'child', under14: true },
        { age: 'child', under14: false },
      ],
    });
    expect(fr.items.find((i) => i.code === '4.380')?.amount).toBe(chf(-6_000));
    expect(ge.items.find((i) => i.code === '59.12')?.amount).toBe(chf(-6_000));
    expect(fr.taxableIncome.amount).toBe(ge.taxableIncome.amount);
  });

  it('daily allowances are not in the base of the 3 % flat (code 2.130 is the salary’s), as Zurich and not as Geneva', () => {
    // Net salary 60,000 - 3,840 = 56,160 and allowances 20,000 (1.510): Fribourg's flat is 3 % of
    // the salary, 1,685, the minimum 2,000 (fr-na-deductions-frais-professionnels art. 6 al. 1;
    // guide p. 13); Geneva's 31.20 takes 3 % of 76,160 = 2,285. 285 more taxable income, as Zurich.
    const h = single({ ...salary(60_000), replacementIncome: { value: chf(20_000) } });
    const { fr, ge } = both(h);
    const zh = zurich.computeReturn({ ...h, commune: 261 }).ifd!;
    expect(fr.taxableIncome.amount - ge.taxableIncome.amount).toBe(chf(285));
    expect(fr.taxableIncome.amount).toBe(zh.taxableIncome.amount);
  });

  it('a side job: the cantonal flat of 2.140, which the guide doesn’t list as different, as Lucerne’s overview and Zug’s Bund column in 2026', () => {
    // Main job 50,000, side job 2,700: 20 % = 540, the minimum 800 (guide p. 13, code 2.140; the
    // federal Form. 2a 2026 gives the same). Geneva's engine takes no side job.
    const h = (taxYear: 2025 | 2026): Shared => ({
      taxYear,
      commune: '',
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
      household: { healthPremiums: { value: chf(20_000) } },
    });
    const fr25 = fribourg.computeReturn({ ...h(2025), commune: 'Fribourg', cantonal: alone });
    expect(fr25.icc!.items.find((i) => i.code === '2.140')?.amount).toBe(chf(-800));
    expect(fr25.ifd!.items.find((i) => i.code === '2.140')?.amount).toBe(chf(-800));
    const lu25 = lucerne.computeReturn({
      ...h(2025),
      commune: 'Luzern',
      cantonal: { church: { p1: 'none' } },
    });
    expect(fr25.ifd!.taxableIncome.amount).toBe(lu25.ifd!.taxableIncome.amount);
    const zg26 = zug.computeReturn({
      ...h(2026),
      commune: 'Zug',
      cantonal: { church: { p1: 'none' }, citizenOf: { p1: null } },
    });
    expect(zg26.ifd).not.toBeNull();
  });
});

describe('the federal amounts the guide prints for 2025', () => {
  it('are the federal circular’s that rules-ch holds, but one: 5,500 against 5,550 (NOTES.md)', () => {
    // fr-2025-guide-instructions-generales p. 47 to 49 against
    // ch-2025-ifd-frais-professionnels-progression p. 2: travel 3,300, the two-earner deduction
    // 8,600 to 14,100, insurance 3,700 and 1,800 (2,700 without 2nd pillar or 3a) plus 700 per
    // child, childcare 25,800, parties 10,600, training 13,000, children 6,800, married couples
    // 2,800, the reduction of the tax 263 per child. The guide prints 5,500 for married couples
    // without 2nd pillar or 3a, the circular 5,550: the circular is the federal authority, and the
    // guide calls its list "purement informatif" (p. 47). Taxpresso takes 5,550.
    const F = ifdParamsFor(2025);
    expect(F.commuteMax.value).toBe(chf(3_300));
    expect(F.twoEarner.value).toEqual({ shareBp: 5_000, min: chf(8_600), max: chf(14_100) });
    expect(F.insurance.value).toMatchObject({
      married: chf(3_700),
      other: chf(1_800),
      otherNone: chf(2_700),
      perChild: chf(700),
    });
    expect(F.insurance.value.marriedNone).toBe(chf(5_550));
    expect(F.childcareMax.value).toBe(chf(25_800));
    expect(F.partyMax.value).toBe(chf(10_600));
    expect(F.trainingMax.value).toBe(chf(13_000));
    expect(F.child.value).toBe(chf(6_800));
    expect(F.married.value).toBe(chf(2_800));
    expect(F.childTaxReduction.value).toBe(chf(263));
  });
});

describe('childcare of a child of 14 or more', () => {
  it('counts for neither tax, and the result says so', () => {
    // Two children: the younger under 14 with childcare of 8,000, the elder 14 or more at the end
    // of the year with 5,000. Only the younger child’s counts: cantonal 8,000 (4.380, at most
    // 12,000, LICD art. 34 al. 3); federal 8,000 (at most 25,800, Form. 2a 2025 p. 8), as the
    // federal column already took it.
    const h: Shared = {
      taxYear: 2025,
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
    const r = fribourg.computeReturn({
      ...h,
      commune: 'Fribourg',
      cantonal: {
        church: { p1: 'none', p2: 'none' },
        children: [
          { age: 'child', under14: true },
          { age: 'child', under14: false },
        ],
      },
    });
    const ded = (items: readonly { code: string; amount: number }[], code: string) =>
      -(items.find((i) => i.code === code)?.amount ?? 0);
    expect(ded(r.icc!.items, '4.380')).toBe(chf(8_000));
    expect(ded(r.ifd!.items, '4.380')).toBe(chf(8_000));
    expect(r.notCounted).toContainEqual(NOTE.childcareNotCounted);
    expect(r.notCounted).toContainEqual(IFD_NOTE.childcareAge);
  });
});

describe('childcare of one child above the maximum, next to another under it', () => {
  it('caps each child’s costs, then adds them up, as Geneva’s engine', () => {
    // Two children under 14, childcare of 30,000 and 5,000: each child's costs count at most the
    // maximum, then they are added up: cantonal 12,000 + 5,000 = 17,000 (4.380, at most 12,000
    // per child, LICD art. 34 al. 3); federal 25,800 + 5,000 = 30,800 (Form. 2a 2025 p. 8, "25 800
    // fr. par enfant"), as Geneva's federal tax now takes it (it used to take 35,000 within twice
    // the maximum).
    const h: Shared = {
      taxYear: 2025,
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
    const r = fribourg.computeReturn({
      ...h,
      commune: 'Fribourg',
      cantonal: {
        church: { p1: 'none', p2: 'none' },
        children: [
          { age: 'child', under14: true },
          { age: 'child', under14: true },
        ],
      },
    });
    const ge = geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;
    const ded = (items: readonly { code: string; amount: number }[], code: string) =>
      -(items.find((i) => i.code === code)?.amount ?? 0);
    expect(ded(r.icc!.items, '4.380')).toBe(chf(17_000));
    expect(ded(r.ifd!.items, '4.380')).toBe(chf(30_800));
    expect(ded(ge.items, '59.12')).toBe(chf(30_800));
  });
});
