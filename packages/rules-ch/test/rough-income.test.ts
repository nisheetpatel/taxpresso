// Rough benefits and pensions (docs/design/three-pages.md, section 4): the user's own yearly
// figures, read as the rough salary is (core/from-ledger.ts), so every canton built on the shared
// reading takes them: only while that person has no document for that income, flagged as an
// estimate, with the facts they rest on. Synthetic figures; no tax constant involved.
import type { Fact, FactStatus, FactValue, Owner } from '@taxpresso/ledger';
import { describe, expect, it } from 'vitest';
import { householdFromFacts, type CantonReading } from '../src/index.js';

const t = (en: string) => ({ en, fr: en });

/** A canton's reading with nothing of its own: one commune, the tax year 2026. */
const reading = (unemploymentApart = false): CantonReading => ({
  isTaxYear: (y) => y === 2026,
  commune: (answer) => (typeof answer === 'string' ? answer : undefined),
  alimonyLines: { received: t('A'), paid: t('B') },
  ...(unemploymentApart ? { unemploymentApart } : {}),
});

let n = 0;
function fact(
  key: string,
  person: Owner,
  value: FactValue,
  status: FactStatus = 'stated',
  instance?: string,
): Fact {
  n++;
  return {
    id: `f_${n}`,
    key,
    person,
    value,
    status,
    taxYear: 2026,
    createdAt: '2026-10-14T10:00:00.000Z',
    source: instance
      ? { method: 'claude', docId: instance, page: 1 }
      : { method: 'user', via: 'chat' },
    ...(instance ? { instance } : {}),
  };
}

const HOUSEHOLD = [
  fact('profile.civil_status', 'household', 'married'),
  fact('profile.commune', 'household', 'somewhere'),
];

const read = (facts: Fact[], apart = false) => {
  const r = householdFromFacts(2026, [...HOUSEHOLD, ...facts], [], reading(apart));
  return { people: r.input!.people, notes: r.notes.map((x) => x.en) };
};

describe('rough benefits and pensions in the shared reading', () => {
  it('counts a person’s rough benefits and pension as estimates, with the facts they rest on', () => {
    const benefits = fact('plan.replacement_income', 'p1', 2_400_000, 'estimate');
    const pension = fact('plan.pension_income', 'p2', 3_600_000, 'estimate');
    const { people, notes } = read([benefits, pension]);
    expect(people[0]!.replacementIncome).toEqual({
      value: 2_400_000,
      status: 'estimate',
      facts: [benefits.id],
    });
    expect(people[0]!.pensionOther).toBeUndefined();
    // A pension of unknown kind: an other pension (autres rentes), counted in full.
    expect(people[1]!.pensionOther).toEqual({
      value: 3_600_000,
      status: 'estimate',
      facts: [pension.id],
    });
    expect(people[1]!.pensionAvs).toBeUndefined();
    expect(people[1]!.replacementIncome).toBeUndefined();
    expect(notes).toEqual([
      expect.stringMatching(/^No benefits attestation yet/),
      expect.stringMatching(/^No pension attestation yet/),
    ]);
  });

  it('leaves the rough figure aside once that person has a document for that income', () => {
    const { people, notes } = read([
      fact('plan.replacement_income', 'p1', 2_400_000, 'estimate'),
      fact('replacement.amount', 'p1', 1_000_000, 'extracted', 'd_ai'),
      fact('plan.pension_income', 'p1', 3_600_000, 'estimate'),
      fact('pension.amount', 'p1', 2_000_000, 'stated', 'd_avs'),
      fact('pension.type', 'p1', 'avs_ai', 'stated', 'd_avs'),
      // Benefits paid with the salary: a document all the same, so no rough figure.
      fact('plan.replacement_income', 'p2', 900_000, 'estimate'),
      fact('replacement.amount', 'p2', 500_000, 'stated', 'd_apg'),
      fact('replacement.paid_to_employer', 'p2', true, 'stated', 'd_apg'),
    ]);
    expect(people[0]!.replacementIncome).toMatchObject({ value: 1_000_000, status: 'extracted' });
    expect(people[0]!.pensionAvs).toMatchObject({ value: 2_000_000, status: 'stated' });
    expect(people[0]!.pensionOther).toBeUndefined();
    expect(people[1]!.replacementIncome).toBeUndefined();
    expect(notes.join(' ')).not.toMatch(/attestation yet/);
  });

  it('takes nothing from a figure of 0, and gives another person’s figure to nobody else', () => {
    const { people, notes } = read([
      fact('plan.replacement_income', 'p1', 2_400_000, 'estimate'),
      fact('plan.replacement_income', 'p1', 0, 'estimate'),
      fact('plan.pension_income', 'p2', 1_000_000, 'estimate'),
    ]);
    // The ledger's current view keeps the last value; here both are passed: 0 adds nothing.
    expect(people[0]!.replacementIncome).toEqual({
      value: 2_400_000,
      status: 'estimate',
      facts: [expect.any(String)],
    });
    expect(people[0]!.pensionOther).toBeUndefined();
    expect(people[1]!.pensionOther).toMatchObject({ value: 1_000_000 });
    expect(notes).toHaveLength(2);
    const cleared = read([fact('plan.replacement_income', 'p1', 0, 'estimate')]);
    expect(cleared.people[0]!.replacementIncome).toBeUndefined();
    expect(cleared.notes).toEqual([]);
  });

  it('puts rough benefits with the other benefits where unemployment has its own line', () => {
    const { people } = read([fact('plan.replacement_income', 'p1', 2_400_000, 'estimate')], true);
    expect(people[0]!.replacementIncome).toMatchObject({ value: 2_400_000, status: 'estimate' });
    expect(people[0]!.unemploymentBenefits).toBeUndefined();
  });

  it('keeps the rough salary as it was: an employment of its own, an estimate', () => {
    const salary = fact('plan.gross_salary', 'p1', 9_000_000, 'estimate');
    const { people, notes } = read([salary]);
    expect(people[0]!.employments).toEqual([
      { gross: { value: 9_000_000, status: 'estimate', facts: [salary.id] } },
    ]);
    expect(notes).toEqual([expect.stringMatching(/^No salary certificate yet/)]);
  });
});
