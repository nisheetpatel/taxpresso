// The federal tax is the same in every canton (LIFD; packages/rules-ch): for the same household,
// Zurich's Bundessteuer column must give Geneva's federal tax, to the centime. Checked on seeded
// synthetic households through both cantons' interfaces, then the places where the two forms
// differ, each pinned with its documents (docs/sources/zh/NOTES.md, "Federal tax: two forms").
import type { HouseholdInput, PersonInput } from '@taxpresso/rules-ch';
import { COMMUNES_2026, rules as geneva } from '@taxpresso/rules-ge';
import { describe, expect, it } from 'vitest';
import { communesFor, rules as zurich } from '../src/index.js';

/** A household as both cantons take it, without what only one asks for. */
type Shared = Omit<HouseholdInput, 'cantonal'>;

const chf = (francs: number) => francs * 100;

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
/** Whole francs: each form rounds its own lines (Geneva per box, Zurich the net salary). */
const amt = (lo: number, hi: number) => ({ value: chf(int(lo, hi)), status: status() });

const ZURICH = communesFor(2026)
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
        ...(maybe(0.05) ? { freeTransport: true } : {}),
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
 * A household both cantons compute without what their forms do differently (see the cases below):
 * no benefits replacing a salary, and for a couple no medical costs or donations; no donations next
 * to medical costs.
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
  const medical = !couple && maybe(0.3);
  if (medical) hh.medicalCosts = amt(100, 20_000);
  if (!couple && !medical && maybe(0.3)) hh.donations = amt(10, 15_000);
  // Party payments: the Zurich form (and Form. 2a, chiffre 15) take them before the medical costs
  // and donations; Geneva's form after (see below): only without those.
  if (!medical && !hh.donations && maybe(0.08)) hh.politicalParty = amt(10, 15_000);
  if (maybe(0.08)) hh.alimonyPaid = amt(1_000, 30_000);
  if (maybe(0.15)) hh.debtInterest = amt(100, 10_000);
  if (maybe(0.1)) hh.bankFees = amt(10, 1_000);
  if (kids && maybe(0.1)) hh.childcare = amt(1_000, 20_000);
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

function both(h: Shared) {
  const ge = geneva.computeReturn({ ...h, commune: pick(COMMUNES_2026).slug });
  const zh = zurich.computeReturn({
    ...h,
    commune: pick(ZURICH),
    // Shared custody without child support: Zurich's own tariff needs who mainly supports them.
    ...(h.childSupport === 'none' ? { cantonal: { marriedTariff: h.ifdParentalScale } } : {}),
  });
  return { ge: ge.ifd, zh: zh.ifd, zhResult: zh };
}

describe('the federal tax on the Zurich return', () => {
  it(
    'equals Geneva’s federal tax for the same household, to the centime (2,000 households)',
    { timeout: 300_000 },
    () => {
      let compared = 0;
      for (let i = 0; i < 2_000; i++) {
        const h = household();
        const { ge, zh } = both(h);
        expect(Boolean(zh), JSON.stringify(h)).toBe(Boolean(ge));
        if (!ge || !zh) continue;
        compared++;
        const what = JSON.stringify(h);
        expect(zh.taxableIncome.amount, what).toBe(ge.taxableIncome.amount);
        expect(zh.scale, what).toBe(ge.scale);
        expect(zh.scaleTax.amount, what).toBe(ge.scaleTax.amount);
        expect(zh.childReduction.amount, what).toBe(ge.childReduction.amount);
        expect(zh.tax.amount, what).toBe(ge.tax.amount);
        // The same estimates and values waiting for the user's OK behind the tax.
        expect(Boolean(zh.tax.estimates?.length), what).toBe(Boolean(ge.tax.estimates?.length));
        expect(Boolean(zh.tax.needsOk), what).toBe(Boolean(ge.tax.needsOk));
      }
      expect(compared).toBeGreaterThan(1_900);
    },
  );

  it('puts each federal deduction on its Zurich line, and cites the federal rules', () => {
    const h: Shared = {
      taxYear: 2026,
      commune: 230,
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
      household: { healthPremiums: { value: chf(9_600) } },
    };
    const r = zurich.computeReturn(h);
    const codes = r.ifd!.items.map((i) => `${i.code}:${i.person}`);
    // In the form's order (p. 2 and 3).
    expect(codes, codes.join(' ')).toEqual([
      '100:p1',
      '101:p2',
      '220:p1',
      '240:p2',
      '260:p1',
      '261:p2',
      '270:household',
      '376:household',
      '290:p2',
      '370:household',
      '365:household',
    ]);
    expect(r.ifd!.items.find((i) => i.code === '365')?.sources.join(' ')).toMatch(
      /ch-2026-ifd-progression-deductions/,
    );
    // The same income lines as the cantonal tax: one income column on the Zurich form.
    expect(r.ifd!.grossIncome.amount).toBe(r.icc!.grossIncome.amount);
    expect(r.total).toBe(r.icc!.taxes.total.amount + r.ifd!.tax.amount);
    // The limits it applied, in the federal column; one applied alike in both taxes (the 3a
    // cap) is said once, for both.
    expect(r.limits.filter((l) => l.tax === 'ifd').map((l) => l.code)).toEqual(
      expect.arrayContaining(['270', '376', '220']),
    );
    expect(
      r.limits.filter((l) => l.code === '260' || l.code === '261').map((l) => `${l.code} ${l.tax}`),
    ).toEqual(['260 both', '261 both']);
    expect(r.limits.every((l) => l.rule)).toBe(true);
  });
});

describe('where the two forms take the federal deductions differently (open points)', () => {
  const single = (extra: Partial<Shared>): Shared => ({
    taxYear: 2026,
    commune: 261,
    civilStatus: 'married',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: { value: chf(90_000) }, socialContributions: { value: chf(5_000) } },
        ],
      },
    ],
    ...extra,
  });

  it('medical costs of a married couple: Zurich measures them before the couple deduction', () => {
    // Zurich form p. 3 and Form. 2a 2026 p. 9 (chiffre 20, 21.1, 23): 5 % of line 310, the couple
    // deduction (365) after. Geneva's form takes the couple deduction (59.20) before 92.20.
    const h = single({ household: { medicalCosts: { value: chf(10_000) } } });
    const ge = geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;
    const zh = zurich.computeReturn(h).ifd!;
    const couple = 2_800; // the federal couple deduction of 2026 (ch-2026-ifd-progression-deductions)
    const medical = (r: typeof zh | typeof ge, code: string) =>
      -(r.items.find((i) => i.code === code)?.amount ?? 0);
    expect(medical(ge, '71.00') - medical(zh, '320')).toBe(chf(couple) * 0.05);
    expect(zh.taxableIncome.amount - ge.taxableIncome.amount).toBe(chf(couple) * 0.05);
  });

  it('donations next to medical costs: Zurich caps them on line 310, Geneva on 92.40', () => {
    // Zurich guide p. 19 and Form. 2a 2026 p. 9 (chiffre 21.2): 20 % of the net income of
    // chiffre 20, before the medical costs; Geneva's form: 20 % of 92.40, after them.
    const h: Shared = {
      ...single({}),
      civilStatus: 'single',
      household: { medicalCosts: { value: chf(10_000) }, donations: { value: chf(30_000) } },
    };
    const ge = geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;
    const zh = zurich.computeReturn(h).ifd!;
    const gifts = (r: typeof zh | typeof ge, code: string) =>
      -(r.items.find((i) => i.code === code)?.amount ?? 0);
    expect(gifts(zh, '324')).toBeGreaterThan(gifts(ge, '73.00'));
    expect(zh.tax.amount).toBeLessThan(ge.tax.amount);
  });

  it('party payments: Zurich takes them before the medical costs, Geneva after', () => {
    // Zurich form p. 3 (284, Ziffer 16.5, before 310) and Form. 2a 2026 p. 7 and 8 (chiffre 15,
    // before chiffre 20); Geneva's form: 74.00 after 92.40 (ge-2025-guide-declaration-pp p. 15).
    const h: Shared = {
      ...single({}),
      civilStatus: 'single',
      household: { medicalCosts: { value: chf(10_000) }, politicalParty: { value: chf(4_000) } },
    };
    const ge = geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;
    const zh = zurich.computeReturn(h).ifd!;
    const medical = (r: typeof zh | typeof ge, code: string) =>
      -(r.items.find((i) => i.code === code)?.amount ?? 0);
    expect(medical(zh, '320') - medical(ge, '71.00')).toBe(chf(4_000) * 0.05);
  });

  it('benefits replacing a salary: Zurich takes no professional costs on them', () => {
    // Zurich form p. 2 (142/143 Taggelder) and the Berufsauslagen form (salaries only); Geneva's
    // form adds them to 11.00, the base of its flat professional costs (ge-2025-guide p. 19).
    const h: Shared = {
      taxYear: 2026,
      commune: 261,
      civilStatus: 'single',
      people: [{ id: 'p1', replacementIncome: { value: chf(30_000) } }],
    };
    const ge = geneva.computeReturn({ ...h, commune: 'geneve' }).ifd!;
    const zh = zurich.computeReturn(h).ifd!;
    expect(ge.items.some((i) => i.code === '31.20')).toBe(true);
    expect(zh.items.some((i) => i.code === '220')).toBe(false);
    expect(zh.taxableIncome.amount).toBeGreaterThan(ge.taxableIncome.amount);
  });
});
