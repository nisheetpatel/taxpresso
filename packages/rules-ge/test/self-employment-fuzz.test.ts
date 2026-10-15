// A seeded fuzz of Geneva households with self-employment (SPEC.md section 13, item 3): random
// businesses (profits and losses, earlier losses, AVS contributions, balance sheets), with and
// without a salary, alone or as a couple, with 3a paid, for 2025 and 2026, read from the ledger as
// the extension does. Every one must compute without an error, never give a negative tax or a
// fraction of a centime, keep the properties of a tax (a deduction never raises the tax), and fail
// closed exactly when an answer is outside the simple case. Synthetic only.
import { Ledger, type VaultDocument } from '@taxpresso/ledger';
import { describe, expect, it } from 'vitest';
import {
  allLines,
  computeReturn,
  COMMUNES_2026,
  engineInputFromFacts,
  KEYS_2026,
  type EngineInput,
} from '../src/index.js';

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

const UNSUPPORTED: Record<string, readonly string[]> = {
  'profile.business_form': ['partnership'],
  'profile.business_year': ['no_closing', 'two_closings', 'stopped'],
  'profile.business_place': ['other_commune', 'outside_geneva'],
};
const SPECIAL = [
  'real_estate',
  'vat',
  'transfer',
  'reserves',
  'method_change',
  'own_pension',
  'spouse_works',
  'private_costs',
  'avs_provision',
  'participations',
  'several',
];

interface Case {
  taxYear: 2025 | 2026;
  ledger: Ledger;
  documents: VaultDocument[];
  /** An answer outside the simple case: no tax must be computed. */
  outside: boolean;
}

function household(seed: number): Case {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const money = (lo: number, hi: number) => (lo + Math.floor(r() * (hi - lo))) * 100;
  const taxYear = r() < 0.5 ? 2025 : 2026;
  const ledger = new Ledger(taxYear, KEYS_2026);
  const documents: VaultDocument[] = [];
  const user = { method: 'user' as const, via: 'chat' as const };
  const put = (key: string, person: 'p1' | 'p2' | 'household', value: unknown, doc?: string) =>
    ledger.append({
      key,
      person,
      value: value as never,
      status: doc && r() < 0.2 ? 'extracted' : 'stated',
      source: doc ? { method: 'claude', docId: doc, page: 1 } : user,
      ...(doc ? { instance: doc } : {}),
    });
  const doc = (kind: VaultDocument['kind'], person: 'p1' | 'p2' | 'household') => {
    const id = `d${documents.length}`;
    documents.push({
      id,
      sha256: id,
      filename: `${id}.pdf`,
      path: `documents/${id}.pdf`,
      bytes: 1,
      addedAt: '2027-01-10T00:00:00.000Z',
      kind,
      person,
      taxYear,
      parse: { method: 'claude', ok: true, warnings: [] },
    });
    return id;
  };
  const couple = r() < 0.5;
  put('profile.civil_status', 'household', couple ? 'married' : pick(['single', 'divorced']));
  put('profile.commune', 'household', pick(COMMUNES_2026).slug);
  const kids = Math.floor(r() * 3);
  put('profile.children_count', 'household', kids);
  if (kids) put('profile.children_custody', 'household', 'with_household');
  let outside = false;
  for (const p of couple ? (['p1', 'p2'] as const) : (['p1'] as const)) {
    const self = p === 'p1' || r() < 0.5;
    const salaried = r() < 0.4;
    put('profile.income_sources', p, [
      ...(salaried ? ['salary'] : []),
      ...(self ? ['self_employment'] : []),
    ]);
    if (salaried) {
      const d = doc('salary_certificate', p);
      const gross = money(20_000, 180_000);
      put('salary.gross', p, gross, d);
      put('salary.social_contributions', p, Math.round(gross * 0.064), d);
      if (r() < 0.7) put('salary.lpp_ordinary', p, Math.round(gross * 0.06), d);
      if (r() < 0.1) put('profile.taxed_at_source', p, true);
    }
    if (r() < 0.6) put('pillar3a.paid', p, money(500, 40_000), doc('pillar3a_attestation', p));
    if (!self) continue;
    const answer = (key: string, ok: readonly string[]) => {
      const bad = UNSUPPORTED[key] ?? [];
      const value = r() < 0.08 && bad.length ? pick(bad) : pick(ok);
      if (bad.includes(value)) outside = true;
      put(key, p, value);
    };
    answer('profile.business_form', ['sole_proprietor']);
    answer('profile.business_year', ['calendar', 'other_closing', 'started']);
    answer('profile.business_place', ['home_commune']);
    put('profile.business_method', p, pick(['invoice', 'cash']));
    const special = r() < 0.08 ? [pick(SPECIAL)] : [];
    if (special.length) outside = true;
    put('profile.business_special', p, special);
    if (
      salaried &&
      ledger.view().some((f) => f.key === 'profile.taxed_at_source' && f.person === p)
    )
      outside = true;
    const losses = r() < 0.25;
    put('profile.business_losses', p, losses);
    if (losses) {
      const icc = money(0, 60_000);
      put('business.losses_icc', p, icc);
      put('business.losses_ifd', p, r() < 0.8 ? icc : money(0, 60_000));
    }
    if (r() < 0.9) {
      const d = doc('business_accounts', p);
      put('business.turnover', p, money(0, 400_000), d);
      if (r() < 0.2) put('business.benefits', p, money(0, 20_000), d);
      if (r() < 0.2) put('business.financial_income', p, money(0, 3_000), d);
      if (r() < 0.3) put('business.other_income', p, money(0, 10_000), d);
      for (const k of ['costs_goods', 'costs_staff', 'depreciation', 'provisions', 'interest']) {
        if (r() < 0.4) put(`business.${k}`, p, money(0, 80_000), d);
      }
      put('business.costs_other', p, money(0, 150_000), d);
      if (r() < 0.8) {
        put('business.current_assets', p, money(0, 600_000), d);
        if (r() < 0.5) put('business.fixed_assets', p, money(0, 300_000), d);
        if (r() < 0.6) put('business.liabilities', p, money(0, 400_000), d);
      }
    }
    if (r() < 0.9) {
      const d = doc('avs_contributions', p);
      put('avs.contributions_year', p, money(500, 40_000), d);
      if (r() < 0.2) put('avs.contributions_earlier', p, money(0, 10_000), d);
    }
  }
  if (r() < 0.7)
    put('health.premiums', 'household', money(2_000, 18_000), doc('health_premiums', 'household'));
  if (r() < 0.2)
    put('medical.costs', 'household', money(0, 9_000), doc('medical_invoice', 'household'));
  if (r() < 0.2)
    put('donation.amount', 'household', money(0, 8_000), doc('donation_receipt', 'household'));
  return { taxYear, ledger, documents, outside };
}

const N = 1_500;

describe('a seeded fuzz of self-employed households', () => {
  it(`${N} households: no error, no negative tax, fail closed exactly beyond the simple case`, () => {
    let computed = 0;
    let closed = 0;
    let losses = 0;
    let shield = 0;
    for (let seed = 0; seed < N; seed++) {
      const c = household(seed);
      const { input, missing } = engineInputFromFacts(c.taxYear, c.ledger.view(), c.documents);
      expect(missing, `seed ${seed}`).toEqual([]);
      const r = computeReturn(input!);
      if (c.outside) {
        closed++;
        expect(r.icc, `seed ${seed}`).toBeNull();
        expect(r.ifd, `seed ${seed}`).toBeNull();
        expect(r.unsupported.map((u) => u.en).join(' '), `seed ${seed}`).toMatch(
          /no tax is computed/,
        );
        continue;
      }
      // The tax shield (LIPP art. 60) can apply to a small income and a large wealth, a loss year
      // with business assets for instance: the cantonal tax then fails closed, as it always has.
      if (r.icc === null) {
        shield++;
        expect(r.unsupported.map((u) => u.en).join(' '), `seed ${seed}`).toMatch(/tax shield/);
        expect(r.ifd!.tax.amount).toBeGreaterThanOrEqual(0);
        continue;
      }
      computed++;
      expect(
        r.unsupported.map((u) => u.en),
        `seed ${seed}`,
      ).toEqual([]);
      expect(r.icc && r.ifd, `seed ${seed}`).toBeTruthy();
      for (const l of allLines(r)) {
        expect(Number.isSafeInteger(l.amount), `seed ${seed} ${l.label.en}`).toBe(true);
      }
      expect(r.icc.taxes.total.amount, `seed ${seed}`).toBeGreaterThanOrEqual(0);
      expect(r.ifd!.tax.amount, `seed ${seed}`).toBeGreaterThanOrEqual(0);
      expect(r.icc.taxableIncome.amount).toBeGreaterThanOrEqual(0);
      expect(r.icc.wealth.taxableWealth.amount).toBeGreaterThanOrEqual(0);
      for (const s of r.business ?? []) {
        // The sheet adds up: 12.17 - 12.45 = 12.46, which is 12.01 or 57.10.
        const at = (code: string) => s.icc.find((i) => i.code === code)?.amount;
        if (at('12.46') !== undefined) {
          expect(at('12.17')! - at('12.45')!).toBe(at('12.46'));
          expect(at('12.01') ?? at('57.10')).toBe(at('12.46'));
          if (at('57.10') !== undefined) losses++;
        }
      }
      // A deduction never raises the tax: 1'000 more AVS contributions for p1's business.
      const p1 = input!.people[0]!;
      if (p1.business) {
        const more: EngineInput = {
          ...input!,
          people: [
            {
              ...p1,
              business: {
                ...p1.business,
                avsYear: { value: (p1.business.avsYear?.value ?? 0) + 100_000 },
              },
            },
            ...input!.people.slice(1),
          ],
        };
        const m = computeReturn(more);
        // (Unless the lower income brings the tax shield into play: then no cantonal tax.)
        if (m.icc) {
          expect(m.icc.taxes.total.amount, `seed ${seed}`).toBeLessThanOrEqual(
            r.icc.taxes.total.amount,
          );
        }
        expect(m.ifd!.tax.amount, `seed ${seed}`).toBeLessThanOrEqual(r.ifd!.tax.amount);
      }
    }
    // The fuzz reaches every path: computed, failed closed, with losses.
    expect(computed).toBeGreaterThan(N / 2);
    expect(closed).toBeGreaterThan(50);
    expect(losses).toBeGreaterThan(50);
    // The shield applies to a small income with a large wealth (a loss year with business assets).
    expect(shield).toBeLessThan(N / 10);
  });
});
