import { readFileSync } from 'node:fs';
import { Ledger, type VaultDocument } from '@taxpresso/ledger';
import { describe, expect, it } from 'vitest';
import {
  assessmentText,
  assessmentViews,
  DOCUMENT_FIELDS_2026,
  DOCUMENT_KEYS_2026,
  KEYS_2026,
  OBJECTION_2026,
  objectionDeadline,
} from '../src/index.js';

describe('deadline to object to the assessment (réclamation)', () => {
  it('is 30 days after notification, for both taxes, as the laws say', () => {
    expect(OBJECTION_2026.icc.days).toEqual({
      value: 30,
      source: 'ge-na-law-lpfisc art. 39 al. 1',
    });
    expect(OBJECTION_2026.ifd.days).toEqual({
      value: 30,
      source: 'ch-na-law-lifd art. 132 al. 1 (p. 71)',
    });
    // Notified on Monday 1 March 2027: day 1 is 2 March, day 30 is Wednesday 31 March.
    expect(objectionDeadline('2027-03-01', 'icc')).toMatchObject({
      date: '2027-03-31',
      movedFromWeekend: false,
      days: 30,
      sources: ['ge-na-law-lpfisc art. 39 al. 1', 'ge-na-law-lpfisc art. 41 al. 1'],
    });
    expect(objectionDeadline('2027-03-01', 'ifd').sources).toEqual([
      'ch-na-law-lifd art. 132 al. 1 (p. 71)',
      'ch-na-law-lifd art. 133 al. 1 (p. 71)',
    ]);
  });

  it('moves a last day on a weekend to the Monday (LPFisc art. 41, LIFD art. 133)', () => {
    // 2027-05-12 + 30 days = Friday 11 June 2027: unchanged.
    expect(objectionDeadline('2027-05-12', 'icc').date).toBe('2027-06-11');
    // 2027-05-13 + 30 = Saturday 12 June -> Monday 14 June.
    expect(objectionDeadline('2027-05-13', 'icc')).toMatchObject({
      date: '2027-06-14',
      movedFromWeekend: true,
    });
    // 2027-05-14 + 30 = Sunday 13 June -> Monday 14 June.
    expect(objectionDeadline('2027-05-14', 'ifd')).toMatchObject({
      date: '2027-06-14',
      movedFromWeekend: true,
    });
    // Across a year end and a leap day.
    expect(objectionDeadline('2027-12-15', 'icc').date).toBe('2028-01-14');
    expect(objectionDeadline('2028-02-01', 'icc').date).toBe('2028-03-02');
  });

  it('refuses a date it cannot read', () => {
    expect(() => objectionDeadline('15.03.2027', 'icc')).toThrow();
  });

  it('says the counting, and that the printed deadline wins', () => {
    const text = assessmentText(OBJECTION_2026.icc.days.value);
    expect(text.counting!.en).toMatch(/30 days, starting the next day/);
    expect(text.counting!.fr).toMatch(/30 jours, à partir du lendemain/);
    expect(text.never!.en).toMatch(/Taxpresso never sends it/);
  });
});

describe('assessed against declared', () => {
  const assessment: VaultDocument = {
    id: 'd_assessment01',
    sha256: 'x',
    filename: 'Avis de taxation 2026.pdf',
    path: 'documents/x.pdf',
    bytes: 1,
    addedAt: '2027-06-01T00:00:00.000Z',
    kind: 'tax_assessment',
    taxYear: 2026,
    parse: { method: 'claude', ok: true, warnings: [] },
  };

  it('compares item by item with the confirmed values, and computes the deadline', () => {
    const ledger = new Ledger(2026, KEYS_2026);
    const add = (
      key: string,
      person: 'p1' | 'household',
      instance: string,
      value: number | string,
      status: 'stated' | 'extracted',
    ) =>
      ledger.append({
        key,
        person,
        instance,
        value,
        status,
        source: { method: 'claude', docId: instance },
      });
    add('salary.gross', 'p1', 'd_cert00000001', 8_500_000, 'stated');
    add('pillar3a.paid', 'p1', 'd_3a0000000001', 725_800, 'stated');
    add('pillar3a.paid', 'p1', 'd_3a0000000002', 100_000, 'extracted');
    add('assessment.tax', 'household', assessment.id, 'icc', 'stated');
    add('assessment.notification_date', 'household', assessment.id, '2027-05-13', 'stated');
    add('assessment.salary_gross', 'household', assessment.id, 8_600_000, 'stated');
    add('assessment.pillar3a', 'household', assessment.id, 725_800, 'stated');
    add('assessment.childcare', 'household', assessment.id, 0, 'extracted');
    add('assessment.taxable_income', 'household', assessment.id, 7_000_000, 'stated');

    const [view] = assessmentViews([assessment], ledger.view());
    expect(view).toMatchObject({
      docId: assessment.id,
      taxes: ['icc'],
      notificationDate: '2027-05-13',
      unconfirmed: 1,
      totals: [{ key: 'assessment.taxable_income', assessed: 7_000_000 }],
    });
    expect(view!.deadlines.map((d) => [d.tax, d.date])).toEqual([['icc', '2027-06-14']]);
    expect(view!.items).toEqual([
      {
        key: 'assessment.salary_gross',
        assessed: 8_600_000,
        declared: 8_500_000,
        difference: 100_000,
        unconfirmed: 0,
      },
      // The second attestation still needs the user's OK: left out of what was declared.
      {
        key: 'assessment.pillar3a',
        assessed: 725_800,
        declared: 725_800,
        difference: 0,
        unconfirmed: 1,
      },
      { key: 'assessment.childcare', assessed: 0, unconfirmed: 0 },
    ]);
  });

  it('shows no deadline without a notification date (fail closed), and both taxes when unsure', () => {
    const ledger = new Ledger(2026, KEYS_2026);
    const [view] = assessmentViews([assessment], ledger.view());
    expect(view).toMatchObject({ taxes: ['icc', 'ifd'], deadlines: [], items: [] });
  });
});

describe('document keys', () => {
  const lock = JSON.parse(
    readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
  ) as Record<string, { status: string }>;

  it('cite official documents that are in the sources library (SPEC.md 13, item 8b)', () => {
    for (const [key, def] of Object.entries(DOCUMENT_KEYS_2026)) {
      const source = (def as { source?: string }).source;
      if (!source) continue;
      for (const part of source.split(';')) {
        const id = part.trim().split(' ')[0]!;
        expect(lock[id]?.status, `${key}: ${id}`).toBe('ok');
      }
    }
    for (const rule of Object.values(OBJECTION_2026)) {
      for (const source of [rule.days.source, rule.counting]) {
        expect(lock[source.split(' ')[0]!]?.status, source).toBe('ok');
      }
    }
  });

  it('repeat per document, carry their official term, and belong to a kind of document', () => {
    const listed = new Set(Object.values(DOCUMENT_FIELDS_2026).flat());
    for (const [key, def] of Object.entries(DOCUMENT_KEYS_2026)) {
      expect(def.multiple, key).toBe(true);
      if (key === 'check.note') continue;
      expect(listed.has(key as never), key).toBe(true);
      expect((def as { official?: string }).official, key).toBeTruthy();
    }
    // Salary certificate boxes are numbered as on the form.
    expect(KEYS_2026['salary.gross']).toMatchObject({ box: '8', perPerson: true, type: 'money' });
    expect(KEYS_2026['salary.net']).toMatchObject({
      box: '11',
      source: 'std-lohnausweis-wegleitung-2026-fr p. 15 (Cm 47)',
    });
  });
});
