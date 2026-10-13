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
    expect(input!.movable).toHaveLength(1);
    expect(input!.movable![0]).toMatchObject({
      owner: 'p1',
      value: { value: 4_000_000, status: 'estimate' },
      withholdingSwiss: { value: 28_000 },
    });
    expect(notes.map((n) => n.en).join(' ')).toMatch(/another tax year/);
  });

  it('computes from it, flagging what is an estimate and what needs the user’s OK', () => {
    const { facts, documents } = dupont();
    const r = computeReturn(engineInputFromFacts(2026, facts, documents).input!);
    expect(r.total).not.toBeNull();
    expect(r.needsOk).toBeGreaterThan(0); // Marie's certificate
    const ids = r.estimates.map((e) => e.id);
    expect(ids).toContain('ge-2026-unpublished');
    expect(ids).toContain('input:59.10:household'); // childcare given as an estimate
    expect(ids).toContain('input:14.10:p1'); // broker valuations
    expect(r.icc!.credits.withholdingTax?.amount).toBe(28_000);
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
