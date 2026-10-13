// From ledger facts to the engine input: answers, salary certificate boxes, attestations and the
// securities list, with each value's facts and status carried along. Synthetic Dupont household.
import { Ledger, type FactStatus, type VaultDocument } from '@taxpresso/ledger';
import { describe, expect, it } from 'vitest';
import { computeReturn, engineInputFromFacts, KEYS_2026 } from '../src/index.js';

const doc = (
  id: string,
  kind: VaultDocument['kind'],
  person?: VaultDocument['person'],
  taxYear = 2026,
): VaultDocument => ({
  id,
  sha256: id,
  filename: `${id}.pdf`,
  path: `documents/${id}.pdf`,
  bytes: 1,
  addedAt: '2027-01-10T00:00:00.000Z',
  ...(kind ? { kind } : {}),
  ...(person ? { person } : {}),
  taxYear,
  parse: { method: 'claude', ok: true, warnings: [] },
});

function dupont() {
  const l = new Ledger(2026, KEYS_2026);
  const user = { method: 'user' as const, via: 'dashboard' as const };
  const put = (
    key: string,
    person: 'p1' | 'p2' | 'household',
    value: number | string | boolean,
    status: FactStatus = 'stated',
    instance?: string,
  ) =>
    l.append({
      key,
      person,
      value,
      status,
      source: instance ? { method: 'claude', docId: instance, page: 1 } : user,
      ...(instance ? { instance } : {}),
    });
  put('profile.civil_status', 'household', 'married');
  put('profile.commune', 'household', 'vernier');
  put('profile.children_count', 'household', 1);
  put('profile.children_custody', 'household', 'with_household');
  // Jean's salary certificate, confirmed; Marie's still to confirm.
  put('salary.gross', 'p1', 11_000_000, 'stated', 'd_cert_jean');
  put('salary.social_contributions', 'p1', 730_000, 'stated', 'd_cert_jean');
  put('salary.lpp_ordinary', 'p1', 770_000, 'stated', 'd_cert_jean');
  put('salary.canteen', 'p1', true, 'stated', 'd_cert_jean');
  put('salary.gross', 'p2', 3_000_000, 'extracted', 'd_cert_marie');
  put('salary.social_contributions', 'p2', 199_000, 'extracted', 'd_cert_marie');
  put('pillar3a.paid', 'p1', 725_800, 'stated', 'd_3a_jean');
  put('health.premiums', 'household', 1_600_000, 'stated', 'd_health');
  put('childcare.costs', 'household', 1_500_000, 'estimate', 'd_creche');
  put('donation.amount', 'household', 100_000, 'stated', 'd_gift');
  // A certificate of last year: left out.
  put('salary.gross', 'p1', 9_900_000, 'stated', 'd_cert_old');
  // A benefit already paid with the salary: left out.
  put('replacement.amount', 'p2', 500_000, 'stated', 'd_apg');
  put('replacement.paid_to_employer', 'p2', true, 'stated', 'd_apg');
  // Securities from a broker export (estimate until the official price list).
  const security = (key: string, value: string) =>
    l.append({
      key,
      person: 'household',
      instance: 'CH0012345678',
      value,
      status: 'stated',
      source: { method: 'export', docId: 'd_broker' },
    });
  security('securities.name', 'Exemple Café SA');
  security('securities.isin', 'CH0012345678');
  security('securities.country', 'CH');
  security('securities.quantity', '100');
  security('securities.income_kind', 'dividend');
  // A private loan: its interest and balance reach the engine through the état des titres.
  put('debt.balance', 'household', 1_000_000, 'stated', 'd_loan');
  put('debt.interest', 'household', 30_000, 'stated', 'd_loan');
  l.append({
    key: 'securities.value_chf',
    person: 'household',
    instance: 'CH0012345678',
    value: 4_000_000,
    status: 'estimate',
    source: { method: 'export', docId: 'd_broker' },
  });
  l.append({
    key: 'securities.income_gross_chf',
    person: 'household',
    instance: 'CH0012345678',
    value: 80_000,
    status: 'estimate',
    source: { method: 'export', docId: 'd_broker' },
  });
  l.append({
    key: 'securities.withholding_swiss_chf',
    person: 'household',
    instance: 'CH0012345678',
    value: 28_000,
    status: 'estimate',
    source: { method: 'export', docId: 'd_broker' },
  });
  const documents = [
    doc('d_cert_jean', 'salary_certificate', 'p1'),
    doc('d_cert_marie', 'salary_certificate', 'p2'),
    doc('d_cert_old', 'salary_certificate', 'p1', 2025),
    doc('d_3a_jean', 'pillar3a_attestation', 'p1'),
    doc('d_health', 'health_premiums', 'household'),
    doc('d_creche', 'childcare_invoice', 'household'),
    doc('d_gift', 'donation_receipt', 'household'),
    doc('d_apg', 'replacement_income_certificate', 'p2'),
    doc('d_broker', 'broker_export', 'p1'),
    doc('d_loan', 'debt_interest', 'household'),
  ];
  return { facts: l.view(), documents };
}

describe('engine input from the ledger', () => {
  it('reads the answers, the documents and the securities list', () => {
    const { facts, documents } = dupont();
    const { input, missing, notes } = engineInputFromFacts(2026, facts, documents);
    expect(missing).toEqual([]);
    expect(input).toMatchObject({
      taxYear: 2026,
      commune: 'vernier',
      civilStatus: 'married',
      children: [{ custody: 'full' }],
    });
    const [jean, marie] = input!.people;
    expect(jean!.employments).toHaveLength(1);
    expect(jean!.employments![0]).toMatchObject({
      id: 'd_cert_jean',
      gross: { value: 11_000_000, status: 'stated' },
      canteen: true,
    });
    expect(jean!.pillar3a).toMatchObject({ value: 725_800, status: 'stated' });
    expect(marie!.employments![0]!.gross).toMatchObject({ value: 3_000_000, status: 'extracted' });
    expect(marie!.replacementIncome).toBeUndefined();
    expect(input!.household).toMatchObject({
      healthPremiums: { value: 1_600_000 },
      childcare: { value: 1_500_000, status: 'estimate' },
      donations: { value: 100_000 },
    });
    // Securities and debts come through the état des titres, by rubric, part and person; the
    // debt facts are not read a second time.
    const w = (code: string, part: string) =>
      input!.wealthItems!.find((i) => i.code === code && i.part === part);
    expect(w('14.00', 'income')).toMatchObject({ person: 'p1', centimes: 80_000, estimate: true });
    expect(w('14.00', 'wealth')).toMatchObject({ person: 'p1', centimes: 4_000_000 });
    expect(w('F1.IA', 'credit')).toMatchObject({ centimes: 28_000 });
    expect(w('55.10', 'wealth_deduction')).toMatchObject({ centimes: 1_000_000 });
    expect(w('55.10', 'deduction')).toMatchObject({ centimes: 30_000 });
    expect(input!.household).not.toHaveProperty('debts');
    expect(input!.household).not.toHaveProperty('debtInterest');
    expect(notes.map((n) => n.en).join(' ')).toMatch(/another tax year/);
  });

  it('computes from it, flagging what is an estimate and what needs the user’s OK', () => {
    const { facts, documents } = dupont();
    const r = computeReturn(engineInputFromFacts(2026, facts, documents).input!);
    expect(r.total).not.toBeNull();
    expect(r.needsOk).toBeGreaterThan(0); // Marie's certificate
    const ids = r.estimates.map((e) => e.id);
    expect(ids).toContain('ge-2026-unpublished');
    // One note names the figures given as estimates: childcare, the broker's valuations.
    const given = r.estimates.find((e) => e.id === 'input-estimate')!.what.en;
    expect(given).toMatch(/59\.10 Frais de garde des enfants \(ICC\)/);
    expect(given).toMatch(/14\.00 Revenu brut mobilier \(A\)/);
    expect(r.icc!.credits.withholdingTax?.amount).toBe(28_000);
    // The interest once, capped by the income from wealth + 50,000; the debt off the wealth.
    expect(r.icc!.items.filter((i) => i.code === '55.10').map((i) => i.amount)).toEqual([-30_000]);
    expect(r.icc!.wealth.items.find((i) => i.code === '55.10')?.amount).toBe(-1_000_000);
    expect(r.complete).toBe(true);
  });

  it('says what is missing before anything can be computed', () => {
    const l = new Ledger(2026, KEYS_2026);
    const r = engineInputFromFacts(2026, l.view(), []);
    expect(r.input).toBeNull();
    expect(r.missing.map((m) => m.en)).toEqual([
      'your civil status',
      'your commune on 31 December',
    ]);
    expect(engineInputFromFacts(2024, [], []).missing[0]!.en).toMatch(/not supported/);
  });

  it('uses a rough salary from the planning figures until the certificate is in', () => {
    const l = new Ledger(2026, KEYS_2026);
    const user = { method: 'user' as const, via: 'chat' as const };
    l.append({
      key: 'profile.civil_status',
      person: 'household',
      value: 'single',
      status: 'stated',
      source: user,
    });
    l.append({
      key: 'profile.commune',
      person: 'household',
      value: 'meyrin',
      status: 'stated',
      source: user,
    });
    l.append({
      key: 'plan.gross_salary',
      person: 'p1',
      value: 9_000_000,
      status: 'estimate',
      source: user,
    });
    const { input, notes } = engineInputFromFacts(2026, l.view(), []);
    expect(input!.people[0]!.employments![0]!.gross).toMatchObject({
      value: 9_000_000,
      status: 'estimate',
    });
    expect(notes[0]!.en).toMatch(/rough salary/);
  });
});

describe('the way to work, lunches and child support', () => {
  /** A synthetic Ribeiro household answering the questions (all stated in the chat). */
  function ribeiro(answers: [string, 'p1' | 'p2' | 'household', number | string | boolean][]) {
    const l = new Ledger(2026, KEYS_2026);
    const user = { method: 'user' as const, via: 'chat' as const };
    const put = (key: string, person: 'p1' | 'p2' | 'household', value: unknown) =>
      l.append({ key, person, value: value as number, status: 'stated', source: user });
    put('profile.commune', 'household', 'lancy');
    l.append({
      key: 'salary.gross',
      person: 'p1',
      instance: 'd_cert',
      value: 9_500_000,
      status: 'stated',
      source: { method: 'claude', docId: 'd_cert', page: 1 },
    });
    for (const [key, person, value] of answers) put(key, person, value);
    return l.view();
  }
  const read = (answers: Parameters<typeof ribeiro>[0]) =>
    engineInputFromFacts(2026, ribeiro(answers), []);

  it('reads public transport, its cost and the lunches, Geneva meals only on a long trip', () => {
    const { input } = read([
      ['profile.civil_status', 'household', 'single'],
      ['profile.commute', 'p1', 'public_transport_long'],
      ['commute.transit_cost', 'p1', 120_000],
      ['meals.days', 'p1', 210],
    ]);
    expect(input!.people[0]).toMatchObject({
      commuteMode: { by: 'public_transport' },
      commuteCost: { value: 120_000, status: 'stated' },
      mealDays: 210,
      mealsIccAllowed: true,
    });
    const short = read([
      ['profile.civil_status', 'household', 'single'],
      ['profile.commute', 'p1', 'public_transport'],
      ['meals.days', 'p1', 100],
    ]).input!.people[0]!;
    expect(short.mealsIccAllowed).toBe(false);
    expect(short.commuteCost).toBeUndefined();
  });

  it('reads a car by the price of public transport, or by the kilometres when there is none', () => {
    const priced = read([
      ['profile.civil_status', 'household', 'single'],
      ['profile.commute', 'p1', 'car'],
      ['commute.transit_usable', 'p1', 'yes_long'],
      ['commute.transit_equivalent', 'p1', 90_000],
      ['meals.days', 'p1', 0],
    ]).input!.people[0]!;
    expect(priced).toMatchObject({
      commuteMode: { by: 'car', transitUsable: true },
      commuteCost: { value: 90_000 },
      mealsIccAllowed: true,
    });
    const driven = read([
      ['profile.civil_status', 'household', 'single'],
      ['profile.commute', 'p1', 'motorbike'],
      ['commute.transit_usable', 'p1', 'no'],
      ['commute.distance_km', 'p1', 12],
      ['commute.drive_days', 'p1', 180],
      // Left from an earlier answer: no longer counts.
      ['commute.transit_equivalent', 'p1', 90_000],
    ]).input!.people[0]!;
    expect(driven.commuteMode).toMatchObject({
      by: 'motorbike',
      transitUsable: false,
      kmOneWay: 12,
      days: 180,
    });
    expect(driven.commuteCost).toBeUndefined();
    const r = computeReturn(
      read([
        ['profile.civil_status', 'household', 'single'],
        ['profile.commute', 'p1', 'motorbike'],
        ['commute.transit_usable', 'p1', 'no'],
        ['commute.distance_km', 'p1', 12],
        ['commute.drive_days', 'p1', 180],
      ]).input!,
    );
    // 12 x 2 x 180 x 0.40 = 1'728 (ch-2026-ifd-progression-deductions p. 1).
    expect(r.ifd!.items.find((i) => i.code === '31.71')).toMatchObject({ amount: -172_800 });
  });

  it('reads child support into who gets the children, and leaves couples alone', () => {
    const base: Parameters<typeof ribeiro>[0] = [
      ['profile.civil_status', 'household', 'divorced'],
      ['profile.children_count', 'household', 2],
      ['profile.children_custody', 'household', 'shared'],
    ];
    const support = (value: string) =>
      read([...base, ['profile.child_support', 'household', value]]).input!;
    expect(support('i_receive')).toMatchObject({ childSupport: 'receives' });
    expect(support('i_pay')).toMatchObject({ childSupport: 'pays' });
    expect(support('none_i_earn_more')).toMatchObject({
      childSupport: 'none',
      ifdParentalScale: true,
    });
    expect(support('none_other_earns_more')).toMatchObject({ ifdParentalScale: false });
    expect(support('none_unsure').ifdParentalScale).toBeUndefined();
    expect(computeReturn(support('none_unsure')).ifd).toBeNull();
    expect(computeReturn(support('none_i_earn_more')).ifd!.scale).toBe('parental');
    expect(computeReturn(support('i_pay')).ifd!.scale).toBe('single');
    const { notes } = read([...base, ['profile.child_support', 'household', 'i_pay']]);
    expect(notes.map((n) => n.en).join(' ')).toMatch(/can’t take their amounts yet/);
    const married = read([
      ['profile.civil_status', 'household', 'married'],
      ['profile.children_count', 'household', 1],
      ['profile.children_custody', 'household', 'shared'],
      ['profile.child_support', 'household', 'i_pay'],
    ]).input!;
    expect(married.childSupport).toBeUndefined();
  });
});

describe('last year’s figures', () => {
  it('are never read into this year’s engine input', () => {
    const { facts, documents } = dupont();
    const prior = new Ledger(2026, KEYS_2026);
    prior.append({
      key: 'prior.person.icc',
      person: 'p1',
      instance: 'A1-31.40',
      value: 700_000,
      status: 'extracted',
      source: { method: 'claude', docId: 'd_prior', page: 3 },
    });
    const withPrior = engineInputFromFacts(2026, [...facts, ...prior.view()], documents).input;
    expect(withPrior).toEqual(engineInputFromFacts(2026, facts, documents).input);
  });
});
