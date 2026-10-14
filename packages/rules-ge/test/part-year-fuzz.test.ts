// A seeded fuzz of Geneva households with an arrival from abroad or a departure abroad (SPEC.md
// section 13, item 3), for 2025 and 2026: alone or as a couple, with children, salaries, 3a, buy-ins,
// premiums, childcare and wealth, and sometimes something the documents don't spell out for a part
// year (self-employment, benefits, pay that isn't monthly salary, an AVS pension, wealth above the
// deduction). Every one must compute without an error, never give a negative tax or a fraction of a
// centime, fail closed exactly where expected, keep a 3a payment from raising the tax, and give the
// whole year's taxes for an arrival on 1 January. Synthetic only.
import { describe, expect, it } from 'vitest';
import { allLines, computeReturn, COMMUNES_2026, type EngineInput } from '../src/index.js';

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

interface Case {
  input: EngineInput;
  /** Something a part year doesn't support: neither tax computed. */
  closed: boolean;
  /** Wealth above the deduction: the cantonal tax not computed. */
  iccClosed: boolean;
}

function household(seed: number): Case {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const money = (lo: number, hi: number) => ({
    value: (lo + Math.floor(r() * (hi - lo))) * 100,
  });
  const taxYear = r() < 0.5 ? 2025 : 2026;
  const couple = r() < 0.5;
  const kind = r() < 0.5 ? 'arrival' : 'departure';
  const month = 1 + Math.floor(r() * 12);
  const day = 1 + Math.floor(r() * 28);
  const date = `${taxYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  let closed = false;
  const people = (couple ? (['p1', 'p2'] as const) : (['p1'] as const)).map((id) => {
    const gross = 10_000 + Math.floor(r() * 150_000);
    const p: EngineInput['people'][number] = {
      id,
      employments: [
        {
          gross: { value: gross * 100 },
          socialContributions: { value: Math.round(gross * 6.4) },
          pensionFund: { value: Math.round(gross * 5) },
          ...(r() < 0.08 ? { nonPeriodic: money(1_000, 20_000) } : {}),
        },
      ],
      ...(r() < 0.6 ? { pillar3a: money(500, 7_258) } : {}),
      ...(r() < 0.1 ? { pensionBuyIn: money(1_000, 30_000) } : {}),
      ...(r() < 0.5
        ? { commuteMode: { by: 'public_transport' as const }, commuteCost: money(100, 900) }
        : {}),
    };
    if (p.employments![0]!.nonPeriodic) closed = true;
    if (r() < 0.05) {
      closed = true;
      return { ...p, replacementIncome: money(1_000, 20_000) };
    }
    if (r() < 0.05) {
      closed = true;
      return { ...p, selfEmploymentProfit: money(5_000, 80_000) };
    }
    if (r() < 0.04) {
      closed = true;
      return { ...p, pensionAvs: money(10_000, 30_000) };
    }
    return p;
  });
  const children = r() < 0.4 ? 1 + Math.floor(r() * 2) : 0;
  const wealth = r() < 0.2 ? 200_000 + Math.floor(r() * 500_000) : Math.floor(r() * 60_000);
  const input: EngineInput = {
    taxYear,
    commune: pick(COMMUNES_2026).slug,
    civilStatus: couple ? 'married' : pick(['single', 'divorced'] as const),
    people,
    children: Array.from({ length: children }, () => ({
      custody: 'full' as const,
      under14: true,
      ...(r() < 0.5 ? { childcare: money(1_000, 12_000) } : {}),
    })),
    household: {
      healthPremiums: money(1_000, 9_000),
      ...(r() < 0.3 ? { donations: money(100, 3_000) } : {}),
    },
    movable: [{ owner: 'p1', value: { value: wealth * 100 } }],
    period: { kind, date },
  };
  // Above the largest wealth deduction of a household like this one: the cantonal tax fails closed.
  return { input, closed, iccClosed: wealth > 175_264 + 43_936 * children };
}

const N = 1500;

describe('a seeded fuzz of households arriving from abroad or leaving', () => {
  it(`${N} households: no error, no negative tax, fail closed where expected`, () => {
    let computed = 0;
    let closedCount = 0;
    let iccOnly = 0;
    for (let seed = 0; seed < N; seed++) {
      const c = household(seed);
      const r = computeReturn(c.input);
      const why = r.unsupported.map((u) => u.en).join(' ');
      for (const l of allLines(r)) {
        expect(Number.isInteger(l.amount), `seed ${seed}: ${l.label.en}`).toBe(true);
      }
      if (c.closed) {
        closedCount++;
        expect(r.icc, `seed ${seed}`).toBeNull();
        expect(r.ifd, `seed ${seed}`).toBeNull();
        expect(why, `seed ${seed}`).toMatch(/so no tax is computed/);
        continue;
      }
      expect(r.partYear, `seed ${seed}`).toBeDefined();
      if (r.icc === null) {
        // Wealth above the deduction (or the tax shield, or a personal tax not settled).
        iccOnly++;
        expect(why, `seed ${seed}`).toMatch(/Wealth tax not computed|tax shield|Taxe personnelle/);
      } else {
        computed++;
        expect(r.icc.taxes.total.amount, `seed ${seed}`).toBeGreaterThanOrEqual(0);
        expect(r.icc.taxes.incomeBase.amount, `seed ${seed}`).toBeGreaterThanOrEqual(0);
        expect(r.icc.taxes.wealthCantonal.amount, `seed ${seed}`).toBe(0);
      }
      if (!c.iccClosed && r.icc === null) {
        expect(why, `seed ${seed}`).not.toMatch(/Wealth tax not computed/);
      }
      if (r.ifd) {
        expect(r.ifd.tax.amount, `seed ${seed}`).toBeGreaterThanOrEqual(0);
        // A 3a payment never raises the tax.
        const more = computeReturn({
          ...c.input,
          people: c.input.people.map((p) =>
            p.id === 'p1' ? { ...p, pillar3a: { value: (p.pillar3a?.value ?? 0) + 50_000 } } : p,
          ),
        });
        if (more.ifd) expect(more.ifd.tax.amount).toBeLessThanOrEqual(r.ifd.tax.amount);
        if (more.icc && r.icc) {
          expect(more.icc.taxes.total.amount).toBeLessThanOrEqual(r.icc.taxes.total.amount);
        }
      }
    }
    // The fuzz reaches every case.
    expect(computed).toBeGreaterThan(N / 2);
    expect(closedCount).toBeGreaterThan(50);
    expect(iccOnly).toBeGreaterThan(50);
  });

  it('an arrival on 1 January gives the whole year’s taxes', () => {
    for (let seed = 0; seed < 300; seed++) {
      const c = household(seed);
      if (c.closed) continue;
      const jan = computeReturn({
        ...c.input,
        period: { kind: 'arrival', date: `${c.input.taxYear}-01-01` },
      });
      const whole = { ...c.input };
      delete whole.period;
      const year = computeReturn(whole);
      expect(jan.partYear?.days).toBe(360);
      if (jan.icc && year.icc) {
        expect(jan.icc.taxes.total.amount, `seed ${seed}`).toBe(year.icc.taxes.total.amount);
      }
      if (jan.ifd && year.ifd) {
        expect(jan.ifd.tax.amount, `seed ${seed}`).toBe(year.ifd.tax.amount);
      }
    }
  });
});
