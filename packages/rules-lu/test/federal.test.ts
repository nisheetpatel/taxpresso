// The federal tax is the same in every canton (LIFD; packages/rules-ch): for the same household,
// Lucerne's federal tax must give Geneva's, to the centime, and Zurich's, Bern's, Basel-Landschaft's
// and Zug's. Checked on seeded synthetic households through the six cantons' interfaces; then the
// lines of the Ergänzungsblatt for one household; then the places where Lucerne's own documents take
// a federal deduction otherwise than Geneva's form, each pinned with its documents
// (docs/sources/lu/NOTES.md, "Wiring Lucerne in the app").
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
  federalTotals,
  NOTE,
  rules as lucerne,
  type Item,
  type LucerneCantonal,
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

const LUCERNE = communesFor(2026).value.map((c) => c.name);
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
 * 10.2) and no accounts or securities.
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
  if (maybe(0.1)) hh.politicalParty = amt(100, 15_000);
  if (Object.keys(hh).length) h.household = hh;
  return h as unknown as Shared;
}

/**
 * What only Lucerne asks: no church (opt-in, every member answered), each child under 14 or not
 * (the generator's answer, else under 14), living with you, and with shared custody without child
 * support whether the family tariff is yours.
 */
function lucerneOwn(h: Shared): LucerneCantonal {
  const couple = h.civilStatus === 'married';
  return {
    church: {
      p1: 'none',
      ...(couple ? { p2: 'none' as const } : {}),
      ...(h.children?.length ? { children: h.children.map(() => 'none' as const) } : {}),
    },
    ...(h.children?.length
      ? { children: h.children.map((c) => ({ under14: c.under14 ?? true, livesWithYou: true })) }
      : {}),
    ...(h.childSupport === 'none' ? { familyTariff: h.ifdParentalScale ?? false } : {}),
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
  const lu = lucerne.computeReturn({ ...h, commune: pick(LUCERNE), cantonal: lucerneOwn(h) });
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
  return { lu, ge, zh, be, bl, zg };
}

describe('the federal tax of a Lucerne household', () => {
  it('equals Geneva’s, Zurich’s, Bern’s, Basel-Landschaft’s and Zug’s federal tax for the same household, to the centime (2,000 households)', () => {
    let compared = 0;
    let skipped = 0;
    for (let i = 0; i < 2_000; i++) {
      const h = household();
      const { lu, ge, zh, be, bl, zg } = six(h);
      const what = JSON.stringify(h);
      // Lucerne's own tax not computed (docs/sources/lu/NOTES.md): nothing to compare.
      if (!lu.icc) {
        skipped++;
        continue;
      }
      expect(Boolean(lu.ifd), what).toBe(Boolean(ge.ifd));
      if (!lu.ifd || !ge.ifd) continue;
      compared++;
      for (const other of [
        ge.ifd,
        zh.ifd,
        be.icc ? be.ifd : ge.ifd,
        bl.icc ? bl.ifd : ge.ifd,
        zg.icc ? zg.ifd : ge.ifd,
      ]) {
        expect(other, what).not.toBeNull();
        expect(lu.ifd.taxableIncome.amount, what).toBe(other!.taxableIncome.amount);
        expect(lu.ifd.scale, what).toBe(other!.scale);
        expect(lu.ifd.scaleTax.amount, what).toBe(other!.scaleTax.amount);
        expect(lu.ifd.childReduction.amount, what).toBe(other!.childReduction.amount);
        expect(lu.ifd.tax.amount, what).toBe(other!.tax.amount);
        expect(Boolean(lu.ifd.tax.estimates?.length), what).toBe(
          Boolean(other!.tax.estimates?.length),
        );
        expect(Boolean(lu.ifd.tax.needsOk), what).toBe(Boolean(other!.tax.needsOk));
      }
    }
    expect(compared).toBeGreaterThan(1_800);
    expect(skipped).toBeLessThan(150);
  }, 120_000);
});

describe('the Ergänzungsblatt of one household', () => {
  // A couple in Luzern, 2026: person 1 drives 30 km to work on 220 days (30 x 2 x 220 x 0.75 =
  // 9,900, the cantonal maximum 6,500 on 208t, the federal 3,300 on Ziffer 8), person 2 takes the
  // bus (800, the same on 209t and Ziffer 9); a child under 14 in a crèche and one aged 14 or more.
  const h: Shared = {
    taxYear: 2026,
    commune: 'Luzern',
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
        trainingCosts: { value: chf(2_000) },
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
      { custody: 'full', childcare: { value: chf(12_000) } },
      { custody: 'full', under14: false },
    ],
    household: { healthPremiums: { value: chf(9_600) } },
  };
  const r = lucerne.computeReturn({
    ...h,
    cantonal: {
      church: { p1: 'none', p2: 'none', children: ['none', 'none'] },
      children: [
        { under14: true, livesWithYou: true },
        { under14: false, livesWithYou: true },
      ],
    },
  });
  const ifd = r.ifd!;
  const at = (code: string) => ifd.items.find((i) => i.code === code)?.amount;

  it('puts each line on its Ziffer of the sheet, in its order, and cites the federal rules', () => {
    expect(ifd.items.map((i) => `${i.code}:${i.person}`)).toEqual([
      'E1:household',
      'E2:p1',
      'E3:p2',
      'E5:household',
      'E8:p1',
      'E9:p2',
      'E10:household',
      'E17:household',
      'E18:household',
      'E20:household',
      'E22:household',
    ]);
    // 1: the Nettoeinkommen of the return; 2 and 8: the cantonal and the federal travel costs.
    expect(at('E1')).toBe(r.icc!.incomeAfterDeductions.amount);
    expect(at('E2')).toBe(chf(6_500));
    expect(at('E8')).toBe(chf(-3_300));
    expect(at('E3')).toBe(chf(800));
    expect(at('E9')).toBe(chf(-800));
    // 5 and 10: the cantonal insurance deduction added back, the federal one taken off.
    expect(at('E5')).toBe(-r.icc!.items.find((i) => i.code === '270')!.amount);
    expect(ifd.items.find((i) => i.code === 'E22')?.sources.join(' ')).toMatch(
      /ch-2026-ifd-progression-deductions/,
    );
    for (const i of ifd.items) {
      expect(i.sources, i.code).toContain('lu-2025-form-ergaenzungsblatt-dbst p. 1');
    }
    // The lines add up to the taxable income (23), in whole francs.
    const t = federalTotals(ifd.items);
    expect(t.taxableIncome.amount).toBe(ifd.taxableIncome.amount);
    const sum = ifd.items.reduce((a, i) => a + i.amount, 0);
    expect(ifd.taxableIncome.amount).toBe(Math.floor(sum / 100) * 100);
    expect(ifd.incomeAfterDeductions.amount).toBe(
      ifd.subtotal.amount + (at('E8') ?? 0) + (at('E9') ?? 0) + (at('E10') ?? 0),
    );
    expect(r.total).toBe(r.icc!.taxes.total.amount + ifd.tax.amount);
  });

  it('says which tax each limit applied to: both on the lines the federal tax takes as they are', () => {
    const of = (code: string) => r.limits.filter((l) => l.code === code).map((l) => l.tax);
    expect(of('208t')).toEqual(['icc']);
    expect(of('E8')).toEqual(['ifd']);
    expect(of('212')).toEqual(['both']);
    expect(of('248')).toEqual(['both']);
    expect(of('260')).toEqual(['both']);
    expect(of('261')).toEqual(['both']);
    expect(of('270')).toEqual(['icc']);
    expect(of('E10')).toEqual(['ifd']);
    expect(of('360')).toEqual(['icc']);
    expect(of('E18')).toEqual(['ifd']);
    expect(r.limits.every((l) => l.rule)).toBe(true);
  });
});

describe('where Lucerne’s documents take a federal deduction otherwise than Geneva’s form (open points)', () => {
  const alone = { church: { p1: 'none' as const } };
  const couple = { church: { p1: 'none' as const, p2: 'none' as const } };
  const single = (person: PersonInput, more: Partial<Shared> = {}): Shared => ({
    taxYear: 2026,
    commune: '',
    civilStatus: 'single',
    people: [person],
    ...more,
  });
  const both = (h: Shared, cantonal: LucerneCantonal = alone) => ({
    lu: lucerne.computeReturn({ ...h, commune: 'Luzern', cantonal }).ifd!,
    ge: geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!,
  });
  const earners = (household: Shared['household']): Shared => ({
    taxYear: 2026,
    commune: '',
    civilStatus: 'married',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: { value: chf(70_000) }, socialContributions: { value: chf(4_480) } },
        ],
      },
      {
        id: 'p2',
        employments: [
          { gross: { value: chf(40_000) }, socialContributions: { value: chf(2_560) } },
        ],
      },
    ],
    ...(household ? { household } : {}),
  });
  const ded = (x: { items: readonly Pick<Item, 'code' | 'amount'>[] }, code: string) =>
    -(x.items.find((i) => i.code === code)?.amount ?? 0);

  it('daily allowances count in the base of the 3 % flat (Steuerbuch § 33 Nr. 3), as on Geneva’s form and not on Zurich’s', () => {
    // Net salary 60,000 - 3,840 = 56,160 and allowances 20,000: Lucerne's flat is 3 % of 76,160 =
    // 2,285 (lu-2026-deductions-steuerbuch-band1 p. 106; the guide's p. 54 lists no federal
    // difference), as Geneva's 31.20 with 11.50; Zurich's federal column (as Basel-Landschaft's and
    // Zug's) takes 3 % of the salary alone, 1,685, the minimum 2,000: 285 more taxable income.
    const h = single({
      id: 'p1',
      employments: [{ gross: { value: chf(60_000) }, socialContributions: { value: chf(3_840) } }],
      replacementIncome: { value: chf(20_000) },
    });
    const { lu, ge } = both(h);
    const zh = zurich.computeReturn({ ...h, commune: 261 }).ifd!;
    expect(ded(lu, 'E1')).toBe(-chf(56_160 + 20_000 - 2_285));
    expect(lu.taxableIncome.amount).toBe(ge.taxableIncome.amount);
    expect(zh.taxableIncome.amount - lu.taxableIncome.amount).toBe(chf(285));
  });

  it('a buy-in taken from the salary (box 10.2) is out of the net salary of the 3 % flat (box 11)', () => {
    // 100,000 - 6,400 - 5,000 - 10,000 (box 10.2) = 78,600: 3 % = 2,358 (lu-2025-guide-wegleitung
    // p. 21, box 11); Geneva's form takes 3 % of 88,600 = 2,658. 300 more taxable income.
    const h = single({
      id: 'p1',
      employments: [
        {
          gross: { value: chf(100_000) },
          socialContributions: { value: chf(6_400) },
          pensionFund: { value: chf(5_000) },
          pensionBuyIn: { value: chf(10_000) },
        },
      ],
    });
    const { lu, ge } = both(h);
    expect(lu.taxableIncome.amount - ge.taxableIncome.amount).toBe(chf(300));
  });

  it('the flat costs of keeping securities (WV Ziffer 6) count for the federal tax too', () => {
    // 0.3 % of 500,000 = 1,500, at most the income 3,000 (lu-2026-deductions-abzuege-auf-einen-blick
    // p. 1: 3 per mille in the Bund column too); Geneva deducts the costs given, here none.
    const h = single(
      {
        id: 'p1',
        employments: [
          { gross: { value: chf(80_000) }, socialContributions: { value: chf(5_120) } },
        ],
      },
      { movable: [{ owner: 'p1', value: { value: chf(500_000) }, income: { value: chf(3_000) } }] },
    );
    const { lu, ge } = both(h);
    expect(ge.taxableIncome.amount - lu.taxableIncome.amount).toBe(chf(1_500));
  });

  it('medical costs: 5 % of Ziffer 12, before the two-earner and childcare deductions', () => {
    // Both spouses earn: 65,520 and 37,440 net, the flat 2,000 each: 310 = Ziffer 12 = 98,960.
    // Medical costs 10,000 less 5 % of 98,960 (4,948) = 5,052 (lu-2025-form-ergaenzungsblatt-dbst
    // p. 1, Ziffer 13 on Ziffer 12, the two-earner deduction on Ziffer 17 after it); Geneva takes
    // 5 % of its subtotal 92.20, after the two-earner deduction, so it deducts more.
    const { lu, ge } = both(earners({ medicalCosts: { value: chf(10_000) } }), couple);
    expect(lu.incomeAfterDeductions.amount).toBe(chf(98_960));
    expect(ded(lu, 'E13')).toBe(chf(5_052));
    expect(ded(ge, '71.00')).toBeGreaterThan(chf(5_052));
    expect(lu.taxableIncome.amount - ge.taxableIncome.amount).toBe(
      ded(ge, '71.00') - ded(lu, 'E13'),
    );
  });

  it('donations: at most 20 % of Ziffer 12, before the medical costs and the other deductions', () => {
    // The same couple, donations 50,000: at most 20 % of 98,960 = 19,792 (Ziffer 15 on Ziffer 12).
    const { lu, ge } = both(earners({ donations: { value: chf(50_000) } }), couple);
    expect(ded(lu, 'E15')).toBe(chf(19_792));
    expect(ded(ge, '73.00')).toBeLessThan(chf(19_792));
  });

  it('a side job: in 2026 the federal flat, as Zug’s Bund column; in 2025 the flat Lucerne’s overview gives for the Bund', () => {
    // Main job 50,000, side job 2,700: 20 % = 540, the minimum 800, as federal (Form. 2a 2026 and
    // lu-2026-deductions-abzuege-auf-einen-blick p. 1, Ziffer 236/237, both columns). For 2025 no
    // federal document of the library gives the flat's rate, but Lucerne's overview prints it in
    // its Bund column (lu-2025-deductions-abzuege-auf-einen-blick p. 1: 20 %, at least 800, at most
    // 2,400): Lucerne's federal tax is computed, Zug's is not (packages/rules-zg, FEDERAL_NOTE).
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
    });
    const zugAlone = { church: { p1: 'none' as const }, citizenOf: { p1: null } };
    const lu26 = lucerne.computeReturn({ ...h(2026), commune: 'Luzern', cantonal: alone });
    const zg26 = zug.computeReturn({ ...h(2026), commune: 'Zug', cantonal: zugAlone });
    expect(lu26.ifd!.taxableIncome.amount).toBe(zg26.ifd!.taxableIncome.amount);
    expect(lu26.ifd!.tax.amount).toBe(zg26.ifd!.tax.amount);
    const lu25 = lucerne.computeReturn({ ...h(2025), commune: 'Luzern', cantonal: alone });
    const zg25 = zug.computeReturn({ ...h(2025), commune: 'Zug', cantonal: zugAlone });
    expect(zg25.ifd).toBeNull();
    expect(lu25.ifd).not.toBeNull();
    expect(lu25.icc!.items.find((i) => i.code === '236')?.amount).toBe(chf(-800));
  });
});

describe('childcare of a child of 14 or more', () => {
  it('counts for neither tax, and the result says so', () => {
    // Two children: the younger under 14 with childcare of 8,000, the elder 14 or more at the end
    // of the year with 5,000. Only the younger child’s counts: cantonal 8,000 (360, at most 18,200
    // on top of own care) and own care of 2,000 for the younger only (353, StG § 42 Abs. 1 lit. b);
    // federal 8,000 (at most 25,800, Form. 2a 2026 p. 8), where the federal sum used to take both,
    // 13,000, within the cap of the one child under 14.
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
    const r = lucerne.computeReturn({
      ...h,
      commune: 'Luzern',
      cantonal: {
        church: { p1: 'none', p2: 'none', children: ['none', 'none'] },
        children: [
          { under14: true, livesWithYou: true },
          { under14: false, livesWithYou: true },
        ],
      },
    });
    const ded = (items: readonly { code: string; amount: number }[], code: string) =>
      -(items.find((i) => i.code === code)?.amount ?? 0);
    expect(ded(r.icc!.items, '360')).toBe(chf(8_000));
    expect(ded(r.icc!.items, '353')).toBe(chf(2_000));
    expect(ded(r.ifd!.items, 'E18')).toBe(chf(8_000));
    expect(r.notCounted).toContainEqual(NOTE.childcareNotCounted);
    expect(r.notCounted).toContainEqual(IFD_NOTE.childcareAge);
  });
});

describe('childcare of one child above the maximum, next to another under it', () => {
  it('caps each child’s costs, then adds them up', () => {
    // Two children under 14, childcare of 30,000 and 5,000: each child’s costs count at most the
    // maximum, then they are added up: cantonal childcare by others 18,200 + 5,000 = 23,200 (360,
    // at most 18,200 per child on top of own care) and own care 2 x 2,000 (353, StG § 42 Abs. 1
    // lit. b); federal 25,800 + 5,000 = 30,800 (Form. 2a 2026 p. 8: "25 800 fr. par enfant"), where
    // the federal sum used to take 35,000 within twice the maximum.
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
    const r = lucerne.computeReturn({
      ...h,
      commune: 'Luzern',
      cantonal: {
        church: { p1: 'none', p2: 'none', children: ['none', 'none'] },
        children: [
          { under14: true, livesWithYou: true },
          { under14: true, livesWithYou: true },
        ],
      },
    });
    const ded = (items: readonly { code: string; amount: number }[], code: string) =>
      -(items.find((i) => i.code === code)?.amount ?? 0);
    expect(ded(r.icc!.items, '360')).toBe(chf(23_200));
    expect(ded(r.icc!.items, '353')).toBe(chf(4_000));
    expect(ded(r.ifd!.items, 'E18')).toBe(chf(30_800));
  });
});
