import { Ledger, type VaultDocument } from '@taxpresso/ledger';
import { describe, expect, it } from 'vitest';
import { consistencyChecks, formatChf, formatDay, KEYS_2026, sameIssuer } from '../src/index.js';

let n = 0;
function doc(fields: Partial<VaultDocument>): VaultDocument {
  n += 1;
  const id = `d_${String(n).padStart(12, '0')}`;
  return {
    id,
    sha256: id,
    filename: `${fields.kind ?? 'doc'}-${n}.pdf`,
    path: `documents/${id}.pdf`,
    bytes: 1000,
    addedAt: '2027-01-10T10:00:00.000Z',
    parse: { method: 'claude', ok: true, warnings: [] },
    ...fields,
  };
}

const run = (documents: VaultDocument[], ledger = new Ledger(2026, KEYS_2026)) =>
  consistencyChecks({ taxYear: 2026, documents, facts: ledger.view() });

const extracted = (
  ledger: Ledger,
  key: string,
  person: 'p1' | 'p2' | 'household',
  instance: string,
  value: number | boolean | string,
) =>
  ledger.append({
    key,
    person,
    instance,
    value,
    status: 'extracted',
    source: { method: 'claude', docId: instance, page: 1 },
  });

describe('consistency checks (SPEC.md 5.8)', () => {
  it('finds nothing in a tidy year', () => {
    const cert = doc({
      kind: 'salary_certificate',
      person: 'p1',
      taxYear: 2026,
      periodFrom: '2026-01-01',
      periodTo: '2026-12-31',
      issuer: 'Exemple SA',
    });
    const a3 = doc({
      kind: 'pillar3a_attestation',
      person: 'p1',
      taxYear: 2026,
      issuer: 'Banque Exemple',
    });
    expect(run([cert, a3])).toEqual([]);
  });

  it('flags a document for another tax year, and a 3a attestation for another year apart', () => {
    const old = doc({ kind: 'health_premiums', taxYear: 2025 });
    const byPeriod = doc({
      kind: 'childcare_invoice',
      periodFrom: '2025-09-01',
      periodTo: '2025-12-31',
    });
    const a3 = doc({ kind: 'pillar3a_attestation', taxYear: 2025 });
    const prior = doc({ kind: 'prior_declaration', taxYear: 2025 });
    // Last year's assessment is read on purpose ("Last year, reviewed"); an older one is not.
    const lastAssessment = doc({ kind: 'tax_assessment', taxYear: 2025 });
    const older = doc({ kind: 'tax_assessment', taxYear: 2024 });
    const checks = run([old, byPeriod, a3, prior, lastAssessment, older]);
    expect(checks.map((c) => c.id)).toEqual([
      `other_year:${old.id}`,
      `other_year:${byPeriod.id}`,
      `pillar3a_year:${a3.id}`,
      `other_year:${older.id}`,
    ]);
    expect(checks[0]!.detail.en).toBe(`“${old.filename}” is for 2025, not 2026.`);
    expect(checks[0]!.detail.fr).toBe(`«\u00a0${old.filename}\u00a0» concerne 2025, pas 2026.`);
    expect(checks[2]!.source).toBe('ch-2026-ifd-instructions-personnes-physiques p. 7');
    expect(checks[2]!.todo.en).toMatch(/2026 attestation/);
  });

  it('flags a salary certificate for part of the year, unless there is a reason', () => {
    const part = doc({
      kind: 'salary_certificate',
      person: 'p1',
      taxYear: 2026,
      periodFrom: '2026-03-01',
      periodTo: '2026-12-31',
    });
    const [check] = run([part]);
    expect(check).toMatchObject({
      id: `salary_period:${part.id}`,
      rule: 'salary_period',
      person: 'p1',
    });
    expect(check!.detail.en).toMatch(
      /covers 1 March 2026 to 31 December 2026, not the whole of 2026/,
    );
    expect(check!.detail.fr).toMatch(/du 1er mars 2026 au 31 décembre 2026/);
    expect(check!.source).toBe('std-lohnausweis-wegleitung-2026-fr p. 8 (Cm 8)');

    // Moved to Geneva during the year: a partial year is expected.
    const ledger = new Ledger(2026, KEYS_2026);
    ledger.append({
      key: 'profile.moved',
      person: 'household',
      value: 'from_abroad',
      status: 'stated',
      source: { method: 'user' },
    });
    expect(run([part], ledger)).toEqual([]);

    // Changed jobs: two certificates that together cover the year.
    const first = doc({
      kind: 'salary_certificate',
      person: 'p1',
      taxYear: 2026,
      periodFrom: '2026-01-01',
      periodTo: '2026-02-28',
    });
    expect(run([first, part])).toEqual([]);
    // A gap between them is still flagged.
    const gap = doc({ ...first, id: 'd_gap000000001', periodTo: '2026-01-31' });
    expect(run([gap, part]).map((c) => c.rule)).toEqual(['salary_period', 'salary_period']);
  });

  it('flags benefits that are already inside a salary certificate', () => {
    const cert = doc({
      kind: 'salary_certificate',
      person: 'p1',
      taxYear: 2026,
      periodFrom: '2026-01-01',
      periodTo: '2026-12-31',
    });
    const apg = doc({ kind: 'replacement_income_certificate', person: 'p1', taxYear: 2026 });
    const ledger = new Ledger(2026, KEYS_2026);
    extracted(ledger, 'replacement.amount', 'p1', apg.id, 420_000);
    expect(run([cert, apg], ledger)).toEqual([]);

    // Box 7 shows the same amount.
    extracted(ledger, 'salary.other_benefits', 'p1', cert.id, 420_000);
    let [check] = run([cert, apg], ledger);
    expect(check).toMatchObject({
      id: `replacement_in_salary:${apg.id}:p1`,
      documents: [apg.id, cert.id],
      person: 'p1',
    });
    expect(check!.detail.en).toMatch(/CHF 4’200\.00 of benefits .* box 7 shows the same amount/);
    expect(check!.source).toMatch(/^std-lohnausweis-wegleitung-2026-fr p\. 9 \(Cm 14\)/);

    // The attestation says it was paid to the employer.
    const other = new Ledger(2026, KEYS_2026);
    extracted(other, 'replacement.amount', 'p1', apg.id, 100_000);
    extracted(other, 'replacement.paid_to_employer', 'p1', apg.id, true);
    [check] = run([cert, apg], other);
    expect(check!.detail.en).toMatch(/paid to your employer/);

    // Someone else's certificate doesn't count.
    const partner = doc({ ...cert, id: 'd_partner00001', person: 'p2' });
    expect(run([partner, apg], other)).toEqual([]);

    // Box 15 remark.
    const third = new Ledger(2026, KEYS_2026);
    extracted(third, 'replacement.amount', 'p1', apg.id, 100_000);
    extracted(third, 'salary.indemnities_included', 'p1', cert.id, true);
    [check] = run([cert, apg], third);
    expect(check!.detail.en).toMatch(/box 15/);
  });

  it('flags two documents of the same kind, issuer and period', () => {
    const a = doc({
      kind: 'pillar3a_attestation',
      person: 'p1',
      taxYear: 2026,
      issuer: 'Banque Exemple SA',
    });
    const b = doc({
      kind: 'pillar3a_attestation',
      person: 'p1',
      taxYear: 2026,
      issuer: 'BANQUE EXEMPLE S.A.',
    });
    const partners = doc({
      kind: 'pillar3a_attestation',
      person: 'p2',
      taxYear: 2026,
      issuer: 'Banque Exemple SA',
    });
    const checks = run([a, b, partners]);
    expect(checks.map((c) => c.id)).toEqual([`duplicate:${a.id}:${b.id}`]);
    expect(checks[0]!.detail.en).toMatch(/from Banque Exemple SA, for the same period/);
    // Different periods are not duplicates.
    const jan = doc({
      kind: 'childcare_invoice',
      issuer: 'Crèche',
      periodFrom: '2026-01-01',
      periodTo: '2026-01-31',
    });
    const feb = doc({
      kind: 'childcare_invoice',
      issuer: 'Crèche',
      periodFrom: '2026-02-01',
      periodTo: '2026-02-28',
    });
    expect(run([jan, feb])).toEqual([]);
    // The ICC and the IFD bordereaux: same kind, issuer and year, but different taxes.
    const icc = doc({ kind: 'tax_assessment', taxYear: 2026, issuer: 'AFC Genève' });
    const ifd = doc({ kind: 'tax_assessment', taxYear: 2026, issuer: 'AFC Genève' });
    const ledger = new Ledger(2026, KEYS_2026);
    extracted(ledger, 'assessment.tax', 'household', icc.id, 'icc');
    expect(run([icc, ifd], ledger).map((c) => c.rule)).toEqual(['duplicate']);
    extracted(ledger, 'assessment.tax', 'household', ifd.id, 'ifd');
    expect(run([icc, ifd], ledger)).toEqual([]);
    // This year's declaration downloaded again after a fix: not a copy, the latest is checked.
    const first = doc({ kind: 'official_declaration', taxYear: 2026, issuer: 'GeTax' });
    const again = doc({ kind: 'official_declaration', taxYear: 2026, issuer: 'GeTax' });
    expect(run([first, again])).toEqual([]);
  });

  it('marks a check settled once the user wrote a note', () => {
    const old = doc({ kind: 'health_premiums', taxYear: 2025 });
    const ledger = new Ledger(2026, KEYS_2026);
    ledger.append({
      key: 'check.note',
      person: 'household',
      instance: `other_year:${old.id}`,
      value: 'Kept for the premiums paid in January.',
      status: 'stated',
      source: { method: 'user', via: 'dashboard' },
    });
    const [check] = run([old], ledger);
    expect(check!.resolved?.note).toBe('Kept for the premiums paid in January.');
  });
});

describe('formatting', () => {
  it('writes dates and amounts in plain words', () => {
    expect(formatDay('2026-03-01', 'fr')).toBe('1er mars 2026');
    expect(formatDay('2026-12-31', 'en')).toBe('31 December 2026');
    expect(formatChf(123_456_789)).toBe('CHF 1’234’567.89');
    expect(formatChf(5)).toBe('CHF 0.05');
    expect(sameIssuer('Caisse AVS Genève', 'caisse avs geneve')).toBe(true);
    expect(sameIssuer('UBS', 'UBS Switzerland AG')).toBe(false);
    expect(sameIssuer(undefined, undefined)).toBe(false);
  });
});
