// A home or land abroad, the simple case (SPEC.md section 1): Geneva asks what it needs to know,
// plain facts, and says plainly what it can't prepare; every other canton still says real estate
// anywhere isn't supported. Read in the questionnaires themselves, so a canton added later is
// checked too.
import { describe, expect, it } from 'vitest';
import * as Q from '../src/index.js';
import type { QuestionnaireFile } from '../src/index.js';

const special = (file: QuestionnaireFile) =>
  file.questions.find((q) => q.key === 'profile.special')?.options ?? [];

const others = Object.entries(Q)
  .filter(
    ([name, f]) =>
      /^[a-z]{2}Questionnaire2026$/.test(name) &&
      name !== 'geQuestionnaire2026' &&
      typeof f === 'function',
  )
  .map(([name, f]) => [name.slice(0, 2).toUpperCase(), (f as () => QuestionnaireFile)()] as const);

describe('a property abroad in the questionnaires', () => {
  it('is prepared in Geneva: its own option, then plain facts, in four languages', () => {
    const ge = Q.geQuestionnaire2026();
    const options = special(ge);
    const abroad = options.find((o) => o.value === 'property_abroad');
    expect(abroad?.notSupported).toBeUndefined();
    expect(abroad?.label).toMatchObject({
      en: 'I own a home or land outside Switzerland',
      fr: 'Je suis propriétaire d’un logement ou d’un terrain hors de Suisse',
    });
    expect(abroad?.label.de && abroad.label.it).toBeTruthy();
    // Real estate in Switzerland is Geneva's simple case too (property.test.ts); other income
    // from abroad is still not supported.
    expect(options.find((o) => o.value === 'real_estate')?.notSupported).toBeUndefined();
    expect(options.find((o) => o.value === 'foreign_income')?.notSupported?.en).toBe(
      'Income from abroad',
    );
    const questions = ge.questions.filter((q) => q.key.startsWith('profile.abroad_'));
    expect(questions.map((q) => q.id)).toEqual([
      'abroad_property',
      'abroad_property_owner',
      'abroad_property_country',
      'abroad_property_old',
      'abroad_property_loan',
    ]);
    for (const q of questions) {
      const text = 'p1' in q.text ? q.text.p1 : q.text;
      expect([text.en, text.fr, text.de, text.it].every(Boolean), q.id).toBe(true);
      expect(q.explain?.de && q.explain.it, q.id).toBeTruthy();
      expect(q.learnMore?.url, q.id).toMatch(/^https:\/\/www\.ge\.ch\//);
      // Plain facts, never a figure: no money question.
      expect(q.type, q.id).not.toBe('money');
    }
    // What the simple case leaves out is said plainly, option by option.
    const notSupported = questions.flatMap((q) =>
      (q.options ?? []).filter((o) => o.notSupported).map((o) => o.notSupported!.en),
    );
    expect(notSupported).toEqual([
      'More than one property abroad',
      'This property abroad (let part of the year, owned through a company, being built, or a business)',
      'A property abroad shared with someone outside the household',
    ]);
    // The documents, with the official labels and pages.
    const docs = ge.requirements.filter((r) => r.id.startsWith('abroad_'));
    expect(docs.map((r) => [r.id, r.optional, r.expects.kinds])).toEqual([
      ['abroad_value', false, ['foreign_property_tax_notice', 'foreign_property_deed']],
      ['abroad_rental_value_france', false, ['foreign_property_tax_notice']],
      ['abroad_rental_value', true, ['foreign_property_tax_notice']],
      ['abroad_rents', false, ['foreign_property_rent_statement']],
      ['abroad_loan', false, ['debt_interest']],
    ]);
    for (const r of docs) {
      expect(r.learnMore?.url, r.id).toMatch(/^https:\/\/www\.ge\.ch\//);
      expect(r.label.de && r.label.it, r.id).toBeTruthy();
      expect(r.source, r.id).toBeTruthy();
    }
  });

  it('asks only a couple whose the property is', () => {
    const owner = Q.geQuestionnaire2026().questions.find((q) => q.id === 'abroad_property_owner')!;
    const coupleOnly = (owner.options ?? []).filter((o) => o.when).map((o) => o.value);
    expect(coupleOnly).toEqual(['p2', 'both']);
  });

  it('names each year it serves', () => {
    const text = (year: number) =>
      (
        Q.geQuestionnaire(year).questions.find((q) => q.id === 'abroad_property_old')!.text as {
          en: string;
        }
      ).en;
    expect(text(2025)).toBe('On 1 January 2025, was the building more than 10 years old?');
    expect(text(2026)).toBe('On 1 January 2026, was the building more than 10 years old?');
  });

  it('is still not supported in every other canton', () => {
    expect(others.length).toBeGreaterThanOrEqual(10);
    for (const [canton, file] of others) {
      const options = special(file);
      expect(options.find((o) => o.value === 'real_estate')?.notSupported?.en, canton).toBeTruthy();
      expect(
        options.find((o) => o.value === 'foreign_income')?.notSupported?.en,
        canton,
      ).toBeTruthy();
      expect(
        options.some((o) => o.value === 'property_abroad'),
        canton,
      ).toBe(false);
      expect(
        file.questions.some((q) => q.key.startsWith('profile.abroad_')),
        canton,
      ).toBe(false);
      expect(
        file.requirements.some((r) =>
          r.expects.kinds.some((k) => k.startsWith('foreign_property_')),
        ),
        canton,
      ).toBe(false);
    }
  });
});
