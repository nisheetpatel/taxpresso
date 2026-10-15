// A seeded fuzz of Geneva households with a home or land abroad (SPEC.md section 13, item 3):
// random properties (used, let, land; in France, elsewhere in euros, in pounds or dollars), their
// documents or the household's own figures, mortgages abroad and loans here, savings, one or two
// salaries, children, for 2025 and 2026, read from the ledger as the extension does. Every one must
// compute without an error, never give a negative tax or a fraction of a centime, keep 99.00 within
// 95.00, never lower the tax when the property brings in more, never tax more without the property
// than with it, and fail closed exactly where the answers or the figures leave the simple case,
// with the plain reason. Synthetic only.
import { Ledger, type Owner, type VaultDocument } from '@taxpresso/ledger';
import { describe, expect, it } from 'vitest';
import {
  ABROAD_UNSUPPORTED,
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

const COUNTRIES = [
  'france',
  'italy',
  'spain',
  'portugal',
  'germany',
  'united_kingdom',
  'united_states',
] as const;

interface Case {
  taxYear: 2025 | 2026;
  ledger: Ledger;
  documents: VaultDocument[];
  /** An answer outside the simple case: no tax must be computed. */
  outside: boolean;
  children: number;
}

function household(seed: number): Case {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const money = (lo: number, hi: number) => (lo + Math.floor(r() * (hi - lo))) * 100;
  const printed = (lo: number, hi: number) => `${lo + Math.floor(r() * (hi - lo))}.00`;
  const taxYear = r() < 0.5 ? 2025 : 2026;
  const ledger = new Ledger(taxYear, KEYS_2026);
  const documents: VaultDocument[] = [];
  const user = { method: 'user' as const, via: 'chat' as const };
  const put = (key: string, person: Owner, value: unknown, doc?: string) =>
    ledger.append({
      key,
      person,
      value: value as never,
      status: doc && r() < 0.15 ? 'extracted' : 'stated',
      source: doc ? { method: 'claude', docId: doc, page: 1 } : user,
      ...(doc ? { instance: doc } : {}),
    });
  const doc = (kind: VaultDocument['kind'], person: Owner) => {
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
  const children = r() < 0.25 ? 1 + Math.floor(r() * 2) : 0;
  put('profile.children_count', 'household', children);
  if (children) put('profile.children_custody', 'household', 'with_household');
  let outside = false;
  const moved = r() < 0.05 ? pick(['from_abroad', 'leaving_switzerland']) : 'no';
  if (moved !== 'no') outside = true;
  put('profile.moved', 'household', moved);
  // A year of arrival or departure asks each person's day (a part year: not with a property abroad).
  if (moved !== 'no') {
    const key = moved === 'from_abroad' ? 'profile.arrival_date' : 'profile.departure_date';
    for (const p of couple ? (['p1', 'p2'] as const) : (['p1'] as const)) {
      put(key, p, `${taxYear}-07-01`);
    }
  }
  for (const p of couple ? (['p1', 'p2'] as const) : (['p1'] as const)) {
    const self = r() < 0.04;
    if (self) outside = true;
    put('profile.income_sources', p, ['salary', ...(self ? ['self_employment'] : [])]);
    const d = doc('salary_certificate', p);
    const gross = money(25_000, 220_000);
    put('salary.gross', p, gross, d);
    put('salary.social_contributions', p, Math.round(gross * 0.064), d);
    put('salary.lpp_ordinary', p, Math.round(gross * 0.07), d);
    if (r() < 0.05) {
      put('profile.taxed_at_source', p, true);
      outside = true;
    }
    if (self) {
      // A business: outside the simple case with a property abroad, whatever its answers.
      put('profile.business_form', p, 'sole_proprietor');
      put('profile.business_year', p, 'calendar');
      put('profile.business_place', p, 'home_commune');
      put('profile.business_special', p, []);
      put('profile.business_losses', p, false);
    }
    if (r() < 0.5) put('pillar3a.paid', p, money(500, 7_258), doc('pillar3a_attestation', p));
  }
  put('health.premiums', 'household', money(3_000, 20_000), doc('health_premiums', 'household'));
  // Savings here: an account with interest and its withholding tax.
  for (let i = 0; i < 1 + Math.floor(r() * 2); i++) {
    const a = doc('bank_attestation', 'household');
    put('bank.balance', 'household', money(1_000, 400_000), a);
    const interest = money(0, 8_000);
    put('bank.interest_gross', 'household', interest, a);
    put('bank.withholding_swiss', 'household', Math.round(interest * 0.35), a);
  }
  // A loan here.
  if (r() < 0.3) {
    const l = doc('debt_interest', 'household');
    put('debt.balance', 'household', money(1_000, 60_000), l);
    put('debt.interest', 'household', money(0, 3_000), l);
  }

  // The property abroad.
  put('profile.special', 'household', ['property_abroad']);
  const use = pick(['own_use', 'own_use', 'let', 'land'] as const);
  put('profile.abroad_property', 'household', use);
  put('profile.abroad_property_owner', 'household', couple ? pick(['p1', 'p2', 'both']) : 'p1');
  const country = pick(COUNTRIES);
  put('profile.abroad_property_country', 'household', country);
  if (use !== 'land') put('profile.abroad_property_old', 'household', r() < 0.7);
  const currency =
    country === 'united_kingdom' ? 'GBP' : country === 'united_states' ? 'USD' : 'EUR';
  if (r() < 0.85) {
    const kind = r() < 0.5 ? 'foreign_property_tax_notice' : 'foreign_property_deed';
    const n = doc(kind, 'household');
    if (r() < 0.6) put('abroad.currency', 'household', currency, n);
    put(
      kind === 'foreign_property_deed' ? 'abroad.purchase_price' : 'abroad.tax_value',
      'household',
      printed(40_000, 900_000),
      n,
    );
  } else {
    put('plan.abroad_value', 'household', `${printed(40_000, 900_000)} ${currency}`);
  }
  if (use === 'own_use' && r() < 0.6) {
    const n = doc('foreign_property_tax_notice', 'household');
    if (country === 'france' && r() < 0.3) {
      put('abroad.land_tax_base', 'household', printed(500, 6_000), n);
    } else {
      put('abroad.rental_value', 'household', printed(1_000, 30_000), n);
    }
  }
  if (use === 'let') {
    if (r() < 0.85) {
      const s = doc('foreign_property_rent_statement', 'household');
      put('abroad.rents', 'household', printed(2_000, 60_000), s);
      if (r() < 0.7) put('abroad.costs', 'household', printed(0, 15_000), s);
    } else {
      put('plan.abroad_rent', 'household', `${printed(2_000, 60_000)} ${currency}`);
    }
  }
  const loan = r() < 0.4;
  put('profile.abroad_property_loan', 'household', loan);
  if (loan) {
    const m = doc('debt_interest', 'household');
    put('debt.currency', 'household', currency, m);
    put('debt.balance_in_currency', 'household', printed(10_000, 600_000), m);
    put('debt.interest_in_currency', 'household', printed(0, 25_000), m);
  }
  return { taxYear, ledger, documents, outside, children };
}

const N = 1_500;
/** The reasons the figures put a household outside the simple case. */
const FIGURES = new Set(
  [
    ABROAD_UNSUPPORTED.loss_abroad,
    ABROAD_UNSUPPORTED.loss_switzerland,
    ABROAD_UNSUPPORTED.interest_surplus,
    ABROAD_UNSUPPORTED.interest_cap,
  ].map((x) => x.en),
);

describe('a seeded fuzz of households with a property abroad', () => {
  it(`${N} households: no error, no negative tax, fail closed exactly beyond the simple case`, () => {
    let computed = 0;
    let closedByAnswers = 0;
    let closedByFigures = 0;
    let ifdChildren = 0;
    let split = 0;
    for (let seed = 0; seed < N; seed++) {
      const c = household(seed);
      const { input, missing } = engineInputFromFacts(c.taxYear, c.ledger.view(), c.documents);
      expect(missing, `seed ${seed}`).toEqual([]);
      expect(input!.abroad, `seed ${seed}`).toBeDefined();
      const r = computeReturn(input!);
      const why = r.unsupported.map((u) => u.en);
      if (c.outside) {
        closedByAnswers++;
        expect(r.icc, `seed ${seed}`).toBeNull();
        expect(r.ifd, `seed ${seed}`).toBeNull();
        expect(why.join(' '), `seed ${seed}`).toMatch(/abroad.*no tax is computed/);
        continue;
      }
      if (why.some((w) => FIGURES.has(w))) {
        closedByFigures++;
        expect(r.icc, `seed ${seed}`).toBeNull();
        expect(r.ifd, `seed ${seed}`).toBeNull();
        expect(r.abroad, `seed ${seed}`).toBeUndefined();
        continue;
      }
      // The tax shield (LIPP art. 60): the cantonal tax fails closed, as it always has.
      if (r.icc === null) {
        expect(why.join(' '), `seed ${seed}`).toMatch(/tax shield/);
        continue;
      }
      computed++;
      // The federal tax with children and a property abroad: not computed, the cantonal tax is.
      if (r.ifd === null) {
        ifdChildren++;
        expect(c.children, `seed ${seed}`).toBeGreaterThan(0);
        expect(why, `seed ${seed}`).toContain(ABROAD_UNSUPPORTED.ifd_children.en);
      } else {
        expect(why, `seed ${seed}`).toEqual([]);
        expect(r.ifd.tax.amount, `seed ${seed}`).toBeGreaterThanOrEqual(0);
        expect(r.ifd.taxableIncome.amount).toBeLessThanOrEqual(
          Math.max(0, r.ifd.totalIncome.amount),
        );
        expect(r.ifd.exemptIncome!.amount).toBeGreaterThanOrEqual(0);
      }
      for (const l of allLines(r)) {
        expect(Number.isSafeInteger(l.amount), `seed ${seed} ${l.label.en}`).toBe(true);
      }
      const i = r.icc;
      expect(i.taxes.total.amount, `seed ${seed}`).toBeGreaterThanOrEqual(0);
      expect(i.taxableIncome.amount).toBeGreaterThanOrEqual(0);
      expect(i.taxableIncome.amount).toBeLessThanOrEqual(Math.max(0, i.totalIncome.amount));
      expect(i.exemptIncome!.amount).toBeGreaterThanOrEqual(0);
      expect(i.wealth.taxableWealth.amount).toBeGreaterThanOrEqual(0);
      expect(i.wealth.taxableWealth.amount).toBeLessThanOrEqual(i.wealth.rateWealth!.amount);
      if (r.abroad?.interestIcc) split++;

      // More income from the property never lowers the tax (the rate rises, 97.00 follows).
      const a = input!.abroad!;
      const more: EngineInput = {
        ...input!,
        abroad: a.rents
          ? { ...a, rents: { ...a.rents, value: a.rents.value + 100_000 } }
          : a.rentalValue
            ? { ...a, rentalValue: { ...a.rentalValue, value: a.rentalValue.value + 100_000 } }
            : a,
      };
      const m = computeReturn(more);
      if (m.icc) {
        expect(m.icc.taxes.total.amount, `seed ${seed}`).toBeGreaterThanOrEqual(
          i.taxes.total.amount,
        );
      }
      if (m.ifd && r.ifd) {
        expect(m.ifd.tax.amount, `seed ${seed}`).toBeGreaterThanOrEqual(r.ifd.tax.amount);
      }
      // Without the property, never more tax: no income or wealth abroad to raise the rate, and
      // every debt and its interest deducted here.
      const plain = { ...input! };
      delete plain.abroad;
      const w = computeReturn(plain);
      if (w.icc) {
        expect(w.icc.taxes.total.amount, `seed ${seed}`).toBeLessThanOrEqual(i.taxes.total.amount);
      }
      if (w.ifd && r.ifd) {
        expect(w.ifd.tax.amount, `seed ${seed}`).toBeLessThanOrEqual(r.ifd.tax.amount);
      }
    }
    // The fuzz reaches every path.
    expect(computed).toBeGreaterThan(N / 3);
    expect(closedByAnswers).toBeGreaterThan(50);
    expect(closedByFigures).toBeGreaterThan(50);
    expect(ifdChildren).toBeGreaterThan(20);
    expect(split).toBeGreaterThan(50);
  });
});
