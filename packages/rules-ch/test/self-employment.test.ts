// Self-employment, the simple case every canton shares (business/self-employment.ts): a sole
// proprietorship's year from its accounts, and pillar 3a with a business. Synthetic figures.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  businessYear,
  ifdParamsFor,
  lossWindow,
  pillar3a,
  SELF_EMPLOYMENT_FEDERAL,
  SELF_EMPLOYMENT_RULES,
  Trace,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number, status?: 'extracted' | 'estimate') => ({
  value: chf(francs),
  ...(status ? { status } : {}),
  facts: [`f_${francs}`],
});

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

describe('a business year from its accounts', () => {
  it('adds up the accounts line by line, each to the franc, and keeps what they rest on', () => {
    const y = businessYear({
      turnover: amt(120_000.4),
      otherIncome: amt(500),
      costsGoods: amt(8_000),
      depreciation: amt(3_000.6, 'extracted'),
      costsOther: amt(14_500),
      currentAssets: amt(230_000),
      fixedAssets: amt(20_000),
      liabilities: amt(10_000),
      avsYear: amt(9_000, 'estimate'),
      avsEarlier: amt(250),
    });
    expect(y.hasAccounts && y.hasBalance && y.hasAvs).toBe(true);
    // 120'000.40 is typed 120'000, 3'000.60 is typed 3'001: the form takes whole francs.
    expect(y.revenue.turnover.amount).toBe(chf(120_000));
    expect(y.charges.depreciation.amount).toBe(chf(3_001));
    expect(y.totalRevenue.amount).toBe(chf(120_500));
    expect(y.totalCharges.amount).toBe(chf(25_501));
    expect(y.result.amount).toBe(chf(94_999));
    expect(y.grossAssets.amount).toBe(chf(250_000));
    expect(y.equity.amount).toBe(chf(240_000));
    expect(y.earned.amount).toBe(chf(94_999 - 9_000 - 250));
    expect(y.result.trace.needsOk).toBe(true);
    expect(y.earned.trace.estimates.has('input-estimate')).toBe(true);
    expect([...y.result.trace.sources]).toEqual([
      SELF_EMPLOYMENT_RULES.income,
      SELF_EMPLOYMENT_RULES.costs,
    ]);
  });

  it('gives a loss as a negative result, and nothing when the accounts are not in', () => {
    const loss = businessYear({ turnover: amt(10_000), costsOther: amt(16_000) });
    expect(loss.result.amount).toBe(chf(-6_000));
    const none = businessYear({});
    expect(none.hasAccounts || none.hasBalance || none.hasAvs).toBe(false);
    expect(none.result.amount).toBe(0);
  });

  it('counts the losses of the seven business years before the tax year, as the federal instructions say', () => {
    expect(lossWindow(2025)).toMatchObject({ from: 2018, to: 2024 });
    expect(lossWindow(2026)).toMatchObject({ from: 2019, to: 2025 });
    expect(lossWindow(2027)).toBeUndefined();
    expect(lossWindow(2026)!.source).toMatch(/ch-2026-ifd-instructions-personnes-physiques p\. 3/);
  });

  it('cites documents of the library that were downloaded', () => {
    const sources = [
      ...Object.values(SELF_EMPLOYMENT_RULES),
      ...Object.values(SELF_EMPLOYMENT_FEDERAL).map((y) => y.instructions),
      lossWindow(2025)!.source,
    ];
    for (const s of sources) {
      for (const id of s.match(/\bch-[a-z0-9]+(?:-[a-z0-9]+)+/g) ?? []) {
        expect(lock[id]?.status, `${id} in "${s}"`).toBe('ok');
      }
    }
  });
});

describe('pillar 3a with a business (Form. 2a, chiffre 13)', () => {
  const run = (year: 2025 | 2026, a: Partial<Parameters<typeof pillar3a>[1]>) =>
    pillar3a(ifdParamsFor(year), {
      paid: { value: chf(10_000) },
      hasFund: false,
      gross: 0,
      social: 0,
      self: 0,
      earnedFrom: [],
      ...a,
    });
  const business = (earned: number, known = true) => ({
    earned: chf(earned),
    known,
    trace: new Trace(),
    instructions: 'ch-2026-ifd-instructions-personnes-physiques',
  });

  it('without a pension fund: 20 % of the income of every activity, the business’s after its AVS contributions', () => {
    // A salary of 30'000 after its contributions and a business earning 20'000: 20 % of 50'000.
    const r = run(2026, { gross: chf(32_000), social: chf(2_000), business: business(20_000) });
    expect(r.deduction!.amount).toBe(chf(-10_000));
    expect(r.limits[0]).toMatchObject({ kind: 'cap', limit: chf(10_000), counted: chf(10_000) });
    expect([...r.deduction!.trace.sources]).toContain(
      'ch-2026-ifd-instructions-personnes-physiques p. 7',
    );
    // 2025: the same rule and amounts, cited from the 2025 instructions.
    const r25 = run(2025, { business: business(100_000) });
    expect(r25.limits[0]).toMatchObject({ limit: chf(20_000) });
    expect(r25.limits[0]!.param.source).toBe(
      'ch-2025-ifd-instructions-personnes-physiques p. 7 (chiffre 13)',
    );
  });

  it('at most 36,288 without a fund, 7,258 with one', () => {
    expect(
      run(2026, { paid: { value: chf(50_000) }, business: business(300_000) }).limits[0],
    ).toMatchObject({ limit: chf(36_288), counted: chf(36_288) });
    expect(run(2026, { hasFund: true, business: business(300_000) }).limits[0]).toMatchObject({
      limit: chf(7_258),
    });
  });

  it('nothing when the activities make a loss in all, with a pension fund too', () => {
    for (const hasFund of [false, true]) {
      const r = run(2026, {
        hasFund,
        gross: chf(10_000),
        social: chf(600),
        business: business(-12_000),
      });
      expect(r.deduction).toBeUndefined();
      expect(r.limits[0]).toMatchObject({ limit: 0, counted: 0 });
      expect(r.notCounted[0]!.en).toMatch(/loss in all/);
    }
  });

  it('with accounts not in yet, the salary alone counts, and no loss is assumed', () => {
    const r = run(2026, { gross: chf(20_000), social: chf(1_000), business: business(0, false) });
    expect(r.deduction!.amount).toBe(chf(-3_800));
  });
});
