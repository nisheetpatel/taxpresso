// The federal tax is the same in every canton (LIFD; packages/rules-ch): for the same household,
// Bern's federal column (TaxMe's federal summary) must give Geneva's federal tax, to the centime,
// and Zurich's. Checked on seeded synthetic households through the three cantons' interfaces; then
// TaxMe's federal summary of the official specimen, line by line; then the places where Bern's form
// takes a federal deduction differently, each pinned with its documents.
import type { HouseholdInput, PersonInput } from '@taxpresso/rules-ch';
import { COMMUNES_2026, rules as geneva } from '@taxpresso/rules-ge';
import { communesFor as zurichCommunes, rules as zurich } from '@taxpresso/rules-zh';
import { describe, expect, it } from 'vitest';
import {
  communesFor,
  federalTotals,
  rules as bern,
  type BernCantonal,
  type ItemAmount,
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

const BERN = communesFor(2026).value.map((c) => c.bfs);
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
 * and Zurich's federal test): no benefits replacing a salary, no medical costs or donations (Bern's
 * summary drops the centimes of their share of the net income), party payments only alone.
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

/** What only Bern asks: its own household, and with shared custody its tariff and wealth share. */
function bernOwn(h: Shared): BernCantonal {
  return {
    // No church tax: the maximum burden on wealth counts it, so Bern asks (docs/sources/be/NOTES.md).
    church: { p1: 'none', ...(h.civilStatus === 'married' ? { p2: 'none' as const } : {}) },
    ...(h.civilStatus !== 'married' ? { ownHousehold: true } : {}),
    ...(h.childSupport === 'none'
      ? { marriedTariff: h.ifdParentalScale ?? false, sharedChildWealth: 'half' as const }
      : {}),
  };
}

function three(h: Shared) {
  const ge = geneva.computeReturn({ ...h, commune: pick(COMMUNES_2026).slug });
  const zh = zurich.computeReturn({
    ...h,
    commune: pick(ZURICH),
    ...(h.childSupport === 'none' ? { cantonal: { marriedTariff: h.ifdParentalScale } } : {}),
  });
  const be = bern.computeReturn({ ...h, commune: pick(BERN), cantonal: bernOwn(h) });
  return { ge: ge.ifd, zh: zh.ifd, be: be.ifd, beResult: be };
}

describe('the federal tax on the Bern return', () => {
  it(
    'equals Geneva’s and Zurich’s federal tax for the same household, to the centime (2,000 households)',
    { timeout: 300_000 },
    () => {
      let compared = 0;
      let skipped = 0;
      for (let i = 0; i < 2_000; i++) {
        const h = household();
        const { ge, zh, be, beResult } = three(h);
        const what = JSON.stringify(h);
        // Bern's own tax not computed (a buy-in next to the two-earner deduction, one person's party
        // payments above the limit: docs/sources/be/NOTES.md): nothing to compare.
        if (!beResult.icc) {
          skipped++;
          continue;
        }
        expect(Boolean(be), what).toBe(Boolean(ge));
        expect(Boolean(be), what).toBe(Boolean(zh));
        if (!ge || !be || !zh) continue;
        compared++;
        for (const other of [ge, zh]) {
          expect(be.taxableIncome.amount, what).toBe(other.taxableIncome.amount);
          expect(be.scale, what).toBe(other.scale);
          expect(be.scaleTax.amount, what).toBe(other.scaleTax.amount);
          expect(be.childReduction.amount, what).toBe(other.childReduction.amount);
          expect(be.tax.amount, what).toBe(other.tax.amount);
          expect(Boolean(be.tax.estimates?.length), what).toBe(
            Boolean(other.tax.estimates?.length),
          );
          expect(Boolean(be.tax.needsOk), what).toBe(Boolean(other.tax.needsOk));
        }
      }
      expect(compared).toBeGreaterThan(1_800);
      expect(skipped).toBeLessThan(150);
    },
  );

  it('puts each federal deduction on its Bern line, in TaxMe’s order, and cites the federal rules', () => {
    const h: Shared = {
      taxYear: 2026,
      commune: 351,
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
      household: { healthPremiums: { value: chf(9_600) }, medicalCosts: { value: chf(9_000) } },
    };
    const r = bern.computeReturn(h);
    const codes = r.ifd!.items.map((i) => `${i.code}:${i.person}`);
    expect(codes, codes.join(' ')).toEqual([
      '2.21-haupt:p1',
      '2.21-haupt:p2',
      '4.2:household',
      '6.1:p1',
      '6.2:p1',
      '6.4:p1',
      '6.4:p2',
      'saeule-3a:p1',
      'saeule-3a:p2',
      '2.1-betreuung:household',
      'zweiverdiener:household',
      'verheiratet:household',
      '5.4:household',
      '2.1-kinder:household',
    ]);
    expect(r.ifd!.items.find((i) => i.code === 'verheiratet')?.sources.join(' ')).toMatch(
      /ch-2026-ifd-progression-deductions/,
    );
    // The same income lines as the cantonal tax: one income column on TaxMe's summaries.
    expect(r.ifd!.grossIncome.amount).toBe(r.icc!.grossIncome.amount);
    expect(r.total).toBe(r.icc!.taxes.total.amount + r.ifd!.tax.amount);
    // What was declared, next to what is deducted (TaxMe's "Ihre Angaben" and "Steuerbar").
    const medical = r.ifd!.items.find((i) => i.code === '5.4')!;
    expect(medical.given).toBe(chf(-9_000));
    expect(r.ifd!.items.find((i) => i.code === '4.2')?.given).toBe(chf(-9_600));
    // The limits of both taxes; one applied alike in both (the 3a cap) is said once, for both.
    expect(r.limits.filter((l) => l.tax === 'ifd').map((l) => l.code)).toEqual(
      expect.arrayContaining(['4.2', '2.1-betreuung', '5.4']),
    );
    expect(
      r.limits.filter((l) => l.code === 'saeule-3a').map((l) => `${l.person} ${l.tax}`),
    ).toEqual(['p1 both', 'p2 both']);
    expect(r.limits.every((l) => l.rule)).toBe(true);
  });

  it('a side job (6.5) in 2026: the federal flat, 20 %, at least 800 (Form. 2a 2026 p. 7)', () => {
    const r = bern.computeReturn({
      taxYear: 2026,
      commune: 546,
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
      cantonal: { ownHousehold: false },
    });
    expect(r.unsupported).toEqual([]);
    expect(r.ifd!.items.find((i) => i.code === '6.5')?.amount).toBe(chf(-800));
  });
});

describe('TaxMe’s federal summary of the specimen (be-2025-steuererklaerung-formulare-de p. 11)', () => {
  const line = (code: string, francs: number, person: ItemAmount['person'] = 'household') => ({
    code,
    person,
    amount: chf(francs),
    label: { en: code, fr: code },
    how: { en: '', fr: '' },
    sources: [],
  });
  // The column "Steuerbar", as printed.
  const items = [
    line('2.21-haupt', 50_000, 'p1'),
    line('2.21-neben', 2_700, 'p1'),
    line('3.0-ertrag', 44),
    line('3.0-kosten', -10),
    line('4.2', -1_800),
    line('6.1', -2_140, 'p1'),
    line('6.2', -3_200, 'p1'),
    line('6.4', -2_000, 'p1'),
    line('6.5', -800, 'p1'),
    line('6.6', -800, 'p1'),
    line('5.3', -100),
    line('5.4', -301),
  ];

  it('its totals from its lines', () => {
    const r = federalTotals(items);
    expect(r.grossIncome.amount).toBe(chf(52_734));
    expect(r.totalDeductions.amount).toBe(chf(-10_740));
    expect(r.netIncome.amount).toBe(chf(41_994));
    expect(r.personalDeductions.amount).toBe(chf(-401));
    expect(r.taxableIncome.amount).toBe(chf(41_593));
  });

  it('its medical costs: the costs less 5 % of the Reineinkommen with the centimes dropped', () => {
    // As the summary takes 5 % of 41,994 = 2,099.70 as 2,099 (p. 11), for a household in 2026
    // (the specimen's side job has no 2025 federal flat in the documents).
    const r = bern.computeReturn({
      taxYear: 2026,
      commune: 546,
      civilStatus: 'single',
      people: [{ id: 'p1', employments: [{ gross: { value: chf(43_997) } }] }],
      household: { medicalCosts: { value: chf(5_000) } },
      cantonal: { ownHousehold: false },
    });
    const net = r.ifd!.netIncome.amount;
    expect(net % 100).toBe(0);
    const threshold = Math.floor((net * 500) / 1_000_000) * 100;
    expect(threshold % 100).toBe(0);
    expect(r.ifd!.items.find((i) => i.code === '5.4')?.amount).toBe(-(chf(5_000) - threshold));
  });
});

describe('where Bern’s form takes a federal deduction differently (open points)', () => {
  it('medical costs: TaxMe drops the centimes of the 5 % share; Geneva rounds to the franc', () => {
    // be-2025-steuererklaerung-formulare-de p. 11: 5 % of 41,994 = 2,099.70 taken as 2,099;
    // rules-ch's medicalCosts (Geneva's and Zurich's) rounds it to 2,100: one franc of deduction.
    const h: Shared = {
      taxYear: 2026,
      commune: 351,
      civilStatus: 'single',
      people: [{ id: 'p1', employments: [{ gross: { value: chf(41_994 + 2_000) } }] }],
      household: { medicalCosts: { value: chf(5_000) } },
    };
    const be = bern.computeReturn({ ...h, cantonal: { ownHousehold: true } }).ifd!;
    const zh = zurich.computeReturn({ ...h, commune: 261 }).ifd!;
    const med = (items: readonly { code: string; amount: number }[], code: string) =>
      -(items.find((i) => i.code === code)?.amount ?? 0);
    const diff = med(be.items, '5.4') - med(zh.items, '320');
    expect(diff).toBeGreaterThanOrEqual(0);
    expect(diff).toBeLessThanOrEqual(chf(1));
  });
});
