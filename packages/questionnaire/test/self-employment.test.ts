// Self-employment, the simple case (SPEC.md section 1): Geneva prepares it and asks what it needs
// to know; every other canton still says plainly that it can't. Read in the questionnaires
// themselves, so a canton added later is checked too.
import { describe, expect, it } from 'vitest';
import * as Q from '../src/index.js';
import type { QuestionnaireFile } from '../src/index.js';

const selfEmployment = (file: QuestionnaireFile) =>
  file.questions
    .find((q) => q.key === 'profile.income_sources')
    ?.options?.find((o) => o.value === 'self_employment');

const others = Object.entries(Q)
  .filter(
    ([name, f]) =>
      /^[a-z]{2}Questionnaire2026$/.test(name) &&
      name !== 'geQuestionnaire2026' &&
      typeof f === 'function',
  )
  .map(([name, f]) => [name.slice(0, 2).toUpperCase(), (f as () => QuestionnaireFile)()] as const);

describe('self-employment in the questionnaires', () => {
  it('is prepared in Geneva: no "not supported" on the answer, its questions asked per person', () => {
    const ge = Q.geQuestionnaire2026();
    expect(selfEmployment(ge)?.notSupported).toBeUndefined();
    const business = ge.questions.filter((q) => q.key.startsWith('profile.business_'));
    expect(business.map((q) => q.id)).toEqual([
      'business_form',
      'business_year',
      'business_place',
      'business_method',
      'business_special',
      'business_losses',
    ]);
    for (const q of business) {
      expect(q.perPerson, q.id).toBe(true);
      expect(q.when, q.id).toEqual({ key: 'profile.income_sources', includes: 'self_employment' });
      expect(q.learnMore?.url, q.id).toMatch(/^https:\/\/www\.ge\.ch\/document\/44809\//);
    }
    // What the simple case leaves out is said plainly, option by option.
    const notSupported = business.flatMap((q) =>
      (q.options ?? []).filter((o) => o.notSupported).map((o) => o.notSupported!.en),
    );
    expect(notSupported).toEqual(
      expect.arrayContaining([
        'A partnership (société de personnes)',
        'Stopping a business (cessation, liquidation gains)',
        'Business real estate',
        'VAT (TVA)',
        'A transfer between business and private wealth',
        'Capital gains and hidden reserves (réserves latentes)',
        'A change of accounting method',
      ]),
    );
    expect(ge.requirements.map((r) => r.id)).toEqual(
      expect.arrayContaining(['business_accounts', 'avs_contributions']),
    );
  });

  it('is still not supported in every other canton', () => {
    expect(others.length).toBeGreaterThanOrEqual(9);
    for (const [canton, file] of others) {
      expect(selfEmployment(file)?.notSupported?.en, canton).toBeTruthy();
      expect(
        file.questions.some((q) => q.key.startsWith('profile.business_')),
        canton,
      ).toBe(false);
      expect(
        file.requirements.some((r) => r.expects.kinds.includes('business_accounts')),
        canton,
      ).toBe(false);
    }
  });
});
