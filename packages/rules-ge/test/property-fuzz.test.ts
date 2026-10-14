// A seeded fuzz of Geneva households with a property in Geneva (SPEC.md section 13, item 3): their
// own home (a house or a flat in PPE) or one let all year, the AFC's values from its letter or the
// household's own figures, upkeep invoices, a management account, a mortgage statement or rough
// mortgage figures, one or two salaries or pensions, savings, children, sometimes a home abroad
// too, for 2025 and 2026, read from the ledger as the extension does. Every one must compute
// without an error, never give a negative tax or a fraction of a centime, keep the cantonal rental
// value and value under the federal and the AFC's, never lower the tax when the rental value or the
// rents rise, never raise it when the upkeep rises, and fail closed exactly where the answers or
// the taux d'effort leave the simple case, with the plain reason. Synthetic only.
import { Ledger, type Owner, type VaultDocument } from '@taxpresso/ledger';
import { describe, expect, it } from 'vitest';
import {
  allLines,
  computeReturn,
  COMMUNES_2026,
  engineInputFromFacts,
  KEYS_2026,
  PROPERTY_UNSUPPORTED,
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

interface Case {
  taxYear: 2025 | 2026;
  ledger: Ledger;
  documents: VaultDocument[];
  /** An answer outside the simple case: no tax must be computed. */
  outside: boolean;
  abroad: boolean;
}

function household(seed: number): Case {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const money = (lo: number, hi: number) => (lo + Math.floor(r() * (hi - lo))) * 100;
  const taxYear = r() < 0.5 ? 2025 : 2026;
  const ledger = new Ledger(taxYear, KEYS_2026);
  const documents: VaultDocument[] = [];
  const user = { method: 'user' as const, via: 'chat' as const };
  const put = (key: string, person: Owner, value: unknown, doc?: string) =>
    ledger.append({
      key,
      person,
      value: value as never,
      status: doc && r() < 0.15 ? 'extracted' : key.startsWith('plan.') ? 'estimate' : 'stated',
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
  const moved = r() < 0.04 ? pick(['from_abroad', 'leaving_switzerland']) : 'no';
  if (moved !== 'no') outside = true;
  put('profile.moved', 'household', moved);
  // A year of arrival or departure asks each person's day (a part year: not with a property here).
  if (moved !== 'no') {
    const key = moved === 'from_abroad' ? 'profile.arrival_date' : 'profile.departure_date';
    for (const p of couple ? (['p1', 'p2'] as const) : (['p1'] as const)) {
      put(key, p, `${taxYear}-07-01`);
    }
  }
  for (const p of couple ? (['p1', 'p2'] as const) : (['p1'] as const)) {
    if (r() < 0.2) {
      put('profile.income_sources', p, ['pension']);
      const d = doc('pension_certificate', p);
      put('pension.amount', p, money(15_000, 60_000), d);
      put('pension.type', p, 'avs_ai', d);
      continue;
    }
    put('profile.income_sources', p, ['salary']);
    const d = doc('salary_certificate', p);
    const gross = money(25_000, 220_000);
    put('salary.gross', p, gross, d);
    put('salary.social_contributions', p, Math.round(gross * 0.064), d);
    put('salary.lpp_ordinary', p, Math.round(gross * 0.07), d);
    if (r() < 0.04) {
      put('profile.taxed_at_source', p, true);
      outside = true;
    }
    if (r() < 0.5) put('pillar3a.paid', p, money(500, 7_258), doc('pillar3a_attestation', p));
  }
  put('health.premiums', 'household', money(3_000, 20_000), doc('health_premiums', 'household'));
  for (let i = 0; i < 1 + Math.floor(r() * 2); i++) {
    const a = doc('bank_attestation', 'household');
    put('bank.balance', 'household', money(1_000, 400_000), a);
    const interest = money(0, 4_000);
    put('bank.interest_gross', 'household', interest, a);
    put('bank.withholding_swiss', 'household', Math.round(interest * 0.35), a);
  }

  // The property in Geneva.
  const abroad = r() < 0.15;
  put('profile.special', 'household', ['real_estate', ...(abroad ? ['property_abroad'] : [])]);
  const what = pick(['own_house', 'own_flat', 'own_flat', 'let'] as const);
  const own = what !== 'let';
  put('profile.swiss_property', 'household', what);
  put('profile.swiss_property_owner', 'household', couple ? pick(['p1', 'p2', 'both']) : 'p1');
  if (own) {
    const since = r() < 0.03 ? taxYear : taxYear - 1 - Math.floor(r() * 30);
    if (since >= taxYear) outside = true;
    put('profile.swiss_property_since', 'household', since);
  } else {
    put('profile.swiss_property_other_commune', 'household', false);
  }
  put('profile.swiss_property_old', 'household', r() < 0.7);
  put('profile.swiss_property_special', 'household', []);
  const value = money(300_000, 2_500_000);
  if (r() < 0.85) {
    const a = doc('property_values', 'household');
    put('property.tax_value', 'household', value, a);
    if (own) put('property.rental_value', 'household', money(12_000, 70_000), a);
  } else {
    put('plan.property_value', 'household', value);
    if (own) put('plan.property_rental_value', 'household', money(12_000, 70_000));
  }
  if (own && r() < 0.4) {
    const kind =
      what === 'own_flat' && r() < 0.5 ? 'ppe_charges_statement' : 'property_upkeep_invoices';
    put('property.upkeep', 'household', money(500, 40_000), doc(kind, 'household'));
  }
  if (!own) {
    const s = doc('property_rent_statement', 'household');
    put('property.rents', 'household', money(12_000, 90_000), s);
    if (r() < 0.8) put('property.costs', 'household', money(0, 12_000), s);
  }
  const loan = r() < 0.6;
  put('profile.swiss_property_loan', 'household', loan);
  if (loan) {
    if (r() < 0.8) {
      const m = doc('mortgage_statement', 'household');
      const debt = money(50_000, Math.max(60_000, Math.round(value / 100)));
      put('debt.balance', 'household', debt, m);
      put('debt.interest', 'household', Math.round(debt * (0.008 + r() * 0.025)), m);
    } else {
      put('plan.mortgage_balance', 'household', money(50_000, 800_000));
      put('plan.mortgage_interest', 'household', money(500, 20_000));
    }
  }
  // A home abroad too, sometimes: a holiday home in France, its deed and taxe d'habitation.
  if (abroad) {
    put('profile.abroad_property', 'household', 'own_use');
    put('profile.abroad_property_owner', 'household', couple ? 'both' : 'p1');
    put('profile.abroad_property_country', 'household', 'france');
    put('profile.abroad_property_old', 'household', true);
    put('profile.abroad_property_loan', 'household', false);
    const n = doc('foreign_property_deed', 'household');
    put('abroad.purchase_price', 'household', `${100_000 + Math.floor(r() * 500_000)}.00`, n);
    const t = doc('foreign_property_tax_notice', 'household');
    put('abroad.rental_value', 'household', `${2_000 + Math.floor(r() * 12_000)}.00`, t);
  }
  return { taxYear, ledger, documents, outside, abroad };
}

const N = 1_500;

describe('a seeded fuzz of households with a property in Geneva', () => {
  it(`${N} households: no error, no negative tax, fail closed exactly beyond the simple case`, () => {
    let computed = 0;
    let closedByAnswers = 0;
    let effort = 0;
    let actual = 0;
    let flat = 0;
    let lets = 0;
    let both = 0;
    for (let seed = 0; seed < N; seed++) {
      const c = household(seed);
      const { input, missing } = engineInputFromFacts(c.taxYear, c.ledger.view(), c.documents);
      expect(missing, `seed ${seed}`).toEqual([]);
      expect(input!.property, `seed ${seed}`).toBeDefined();
      const r = computeReturn(input!);
      const why = r.unsupported.map((u) => u.en);
      if (c.outside) {
        closedByAnswers++;
        expect(r.icc, `seed ${seed}`).toBeNull();
        expect(r.ifd, `seed ${seed}`).toBeNull();
        expect(why.join(' '), `seed ${seed}`).toMatch(/Geneva.*no tax is computed/);
        continue;
      }
      // What the property abroad's own figures leave out (a loss abroad, a Swiss interest
      // surplus...) is abroad-fuzz.test.ts's: here, only that it fails closed with its words.
      if (r.ifd === null && r.icc === null) {
        expect(c.abroad, `seed ${seed}: ${why.join(' ')}`).toBe(true);
        expect(why.join(' '), `seed ${seed}`).toMatch(/abroad/);
        continue;
      }
      const p = r.property!;
      expect(p, `seed ${seed}`).toBeDefined();
      if (r.icc === null) {
        // The taux d'effort lowers the rental value (or the tax shield applies): the cantonal
        // tax fails closed, with its reason; the federal tax is computed.
        expect(why.join(' '), `seed ${seed}`).toMatch(/taux d’effort|tax shield|children/);
        if (why.includes(PROPERTY_UNSUPPORTED.effort.en)) {
          effort++;
          expect(p.use).toBe('own_home');
        }
        continue;
      }
      computed++;
      if (c.abroad) both++;
      if (p.use === 'let') lets++;
      if (p.upkeep.icc === 'actual') actual++;
      if (p.upkeep.icc === 'flat') flat++;
      for (const l of allLines(r)) {
        expect(Number.isSafeInteger(l.amount), `seed ${seed} ${l.label.en}`).toBe(true);
      }
      const i = r.icc;
      expect(i.taxes.total.amount, `seed ${seed}`).toBeGreaterThanOrEqual(0);
      expect(i.taxableIncome.amount).toBeGreaterThanOrEqual(0);
      expect(i.wealth.taxableWealth.amount).toBeGreaterThanOrEqual(0);
      if (r.ifd) expect(r.ifd.tax.amount, `seed ${seed}`).toBeGreaterThanOrEqual(0);
      // The property's own figures: the cantonal rental value and the value never above the
      // federal rental value and the AFC's value; the IIC at its rate.
      const code = p.use === 'own_home' ? '15.10' : '15.20';
      const iccIncome = p.icc.find((x) => x.code === code)?.amount ?? 0;
      const ifdIncome = p.ifd.find((x) => x.code === code)?.amount ?? 0;
      expect(iccIncome, `seed ${seed}`).toBeLessThanOrEqual(ifdIncome);
      const wealth = p.wealth[0]?.amount ?? 0;
      expect(wealth, `seed ${seed}`).toBeLessThanOrEqual(p.value?.amount ?? 0);
      if (p.value) {
        expect(wealth).toBeGreaterThanOrEqual(Math.round(p.value.amount * 0.6) - 100);
        const rate = p.use === 'own_home' ? 2 : 10;
        expect(Math.abs(p.iic!.amount - (p.value.amount * rate) / 10_000)).toBeLessThanOrEqual(3);
      }

      // More rental value or rents never lower the tax (unless the taux d'effort stops it).
      const a = input!.property!;
      const more: EngineInput = {
        ...input!,
        property: a.rents
          ? { ...a, rents: { ...a.rents, value: a.rents.value + 500_000 } }
          : a.rentalValue
            ? { ...a, rentalValue: { ...a.rentalValue, value: a.rentalValue.value + 500_000 } }
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
      // More upkeep never raises the tax.
      const cheaper = computeReturn({
        ...input!,
        property: { ...a, upkeep: { value: (a.upkeep?.value ?? 0) + 2_000_000 } },
      });
      if (cheaper.icc) {
        expect(cheaper.icc.taxes.total.amount, `seed ${seed}`).toBeLessThanOrEqual(
          i.taxes.total.amount,
        );
      }
      if (cheaper.ifd && r.ifd) {
        expect(cheaper.ifd.tax.amount, `seed ${seed}`).toBeLessThanOrEqual(r.ifd.tax.amount);
      }
    }
    // The fuzz reaches every path.
    expect(computed).toBeGreaterThan(N / 2);
    expect(closedByAnswers).toBeGreaterThan(50);
    expect(effort).toBeGreaterThan(10);
    expect(actual).toBeGreaterThan(30);
    expect(flat).toBeGreaterThan(100);
    expect(lets).toBeGreaterThan(100);
    expect(both).toBeGreaterThan(30);
  });
});
