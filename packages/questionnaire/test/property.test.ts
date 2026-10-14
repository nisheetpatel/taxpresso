// A property in Geneva, the simple case (SPEC.md section 1): Geneva asks what it needs to know,
// plain facts, and says plainly what it can't prepare; every other canton still says real estate
// isn't supported. Read in the questionnaires themselves, so a canton added later is checked too.
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

describe('a property in Geneva in the questionnaires', () => {
  it('is prepared in Geneva: plain facts, in four languages, each with its official page', () => {
    const ge = Q.geQuestionnaire2026();
    expect(special(ge).find((o) => o.value === 'real_estate')?.notSupported).toBeUndefined();
    const questions = ge.questions.filter((q) => q.key.startsWith('profile.swiss_property'));
    expect(questions.map((q) => q.id)).toEqual([
      'swiss_property',
      'swiss_property_owner',
      'swiss_property_since',
      'swiss_property_old',
      'swiss_property_other_commune',
      'swiss_property_special',
      'swiss_property_loan',
    ]);
    for (const q of questions) {
      const text = 'p1' in q.text ? q.text.p1 : q.text;
      expect([text.en, text.fr, text.de, text.it].every(Boolean), q.id).toBe(true);
      expect(q.explain?.de && q.explain.it, q.id).toBeTruthy();
      expect(q.learnMore?.url, q.id).toMatch(/^https:\/\/(www\.ge\.ch|silgeneve\.ch)\//);
      // Plain facts, never a figure: no money question. The year moved in is a year, not money.
      expect(q.type, q.id).not.toBe('money');
      expect(JSON.stringify(q), q.id).not.toMatch(/—/);
    }
    // What the simple case leaves out is said plainly, option by option.
    const notSupported = questions.flatMap((q) => [
      ...(q.options ?? []).filter((o) => o.notSupported).map((o) => o.notSupported!.en),
      ...(q.yesNotSupported ? [q.yesNotSupported.en] : []),
    ]);
    expect(notSupported).toEqual([
      'A property in another canton',
      'More than one property in Switzerland',
      'This property in Switzerland (land, being built, business premises, a second home, a company, a usufruct or a right of residence)',
      'A property in Switzerland shared with someone outside the household',
      'A property let in another Geneva commune than your home (the communal tax is shared between the communes)',
      'A property bought, sold, moved into or out of during the year',
      'A home partly let, or let for holidays',
      'A property used for a business',
      'Works that add value, a demolition or a listed building',
      'A subsidy for works, or subsidised housing',
      'Property costs carried over from earlier years',
      'A usufruct or a right of residence',
    ]);
    // The documents, with the official labels and pages.
    const docs = ge.requirements.filter((r) => r.id.startsWith('property_'));
    expect(docs.map((r) => [r.id, r.optional, r.expects.kinds])).toEqual([
      ['property_values_home', false, ['property_values']],
      ['property_value_let', false, ['property_values']],
      ['property_rents', false, ['property_rent_statement']],
      ['property_upkeep_house', true, ['property_upkeep_invoices']],
      ['property_upkeep_flat', true, ['ppe_charges_statement', 'property_upkeep_invoices']],
      ['property_mortgage', false, ['mortgage_statement']],
    ]);
    for (const r of docs) {
      expect(r.learnMore?.url, r.id).toMatch(/^https:\/\/www\.ge\.ch\//);
      expect(r.label.de && r.label.it, r.id).toBeTruthy();
      expect(r.source, r.id).toBeTruthy();
    }
  });

  it('asks only the owners of their home since when, and only a landlord where the property is', () => {
    const ge = Q.geQuestionnaire2026();
    const when = (id: string) => JSON.stringify(ge.questions.find((q) => q.id === id)!.when);
    expect(when('swiss_property_since')).toMatch(/own_house.*own_flat/);
    expect(when('swiss_property_since')).not.toMatch(/"let"/);
    expect(when('swiss_property_other_commune')).toMatch(/\["let"\]/);
    // A part let is a question for one's own home only.
    const partLet = ge.questions
      .find((q) => q.id === 'swiss_property_special')!
      .options!.find((o) => o.value === 'part_let')!;
    expect(JSON.stringify(partLet.when)).toMatch(/own_house.*own_flat/);
    const owner = ge.questions.find((q) => q.id === 'swiss_property_owner')!;
    expect((owner.options ?? []).filter((o) => o.when).map((o) => o.value)).toEqual(['p2', 'both']);
  });

  it('names each year it serves', () => {
    const text = (year: number, id: string) =>
      (Q.geQuestionnaire(year).questions.find((q) => q.id === id)!.text as { en: string }).en;
    expect(text(2025, 'swiss_property_old')).toBe(
      'On 1 January 2025, was the building more than 10 years old?',
    );
    expect(text(2026, 'swiss_property_special')).toBe('Did any of these apply to it in 2026?');
    const moved = (year: number) =>
      Q.geQuestionnaire(year)
        .questions.find((q) => q.id === 'swiss_property_special')!
        .options!.find((o) => o.value === 'moved')!.label.en;
    expect(moved(2025)).toBe('Bought, sold, moved in or moved out during 2025');
  });

  it('is still not supported in every other canton', () => {
    expect(others.length).toBeGreaterThanOrEqual(10);
    for (const [canton, file] of others) {
      expect(
        special(file).find((o) => o.value === 'real_estate')?.notSupported?.en,
        canton,
      ).toBeTruthy();
      expect(
        file.questions.some((q) => q.key.startsWith('profile.swiss_property')),
        canton,
      ).toBe(false);
      expect(
        file.requirements.some((r) =>
          r.expects.kinds.some((k) =>
            [
              'property_values',
              'property_rent_statement',
              'property_upkeep_invoices',
              'ppe_charges_statement',
              'mortgage_statement',
            ].includes(k),
          ),
        ),
        canton,
      ).toBe(false);
    }
  });
});
