import { readFileSync } from 'node:fs';
import { Ledger, type VaultDocument } from '@taxpresso/ledger';
import { KEYS_CANTON_2026 } from '@taxpresso/rules-ch';
import { COMMUNES_2026, KEYS_2026 as GENEVA_KEYS } from '@taxpresso/rules-ge';
import { describe, expect, it } from 'vitest';
import {
  beQuestionnaire2026,
  blQuestionnaire2026,
  bsQuestionnaire2026,
  frQuestionnaire2026,
  geQuestionnaire,
  geQuestionnaire2026,
  luQuestionnaire2026,
  sgQuestionnaire2026,
  tiQuestionnaire2026,
  vdQuestionnaire2026,
  LearnMore,
  NBSP,
  parseQuestionnaire,
  ProjectLink,
  QuestionnaireEngine,
  QuestionnaireError,
  resolveShared,
  sharedQuestionnaire2026,
  zgQuestionnaire2026,
  zhQuestionnaire2026,
} from '../src/index.js';

/** Geneva's keys with the canton question every canton shares. */
const KEYS_2026 = { ...KEYS_CANTON_2026, ...GENEVA_KEYS };
const engine = () => new QuestionnaireEngine(geQuestionnaire2026(), KEYS_2026, COMMUNES_2026);
const USER = { method: 'user' } as const;

/** Answers questions in the order the engine asks them, until one has no answer in `answers`. */
function walk(e: QuestionnaireEngine, ledger: Ledger, answers: Record<string, unknown>): string[] {
  const asked: string[] = [];
  for (;;) {
    const slot = e.next(e.snapshot(ledger));
    if (!slot || !(slot.id in answers)) return asked;
    asked.push(slot.id);
    e.answer(ledger, slot.id, answers[slot.id], USER);
  }
}

const doc = (kind: VaultDocument['kind'], person?: VaultDocument['person']): VaultDocument => ({
  id: `d_${Math.random()}`,
  sha256: 'x',
  filename: 'x.pdf',
  path: 'documents/x.pdf',
  bytes: 1,
  addedAt: '2026-10-13T00:00:00.000Z',
  ...(kind ? { kind } : {}),
  ...(person ? { person } : {}),
  parse: { method: 'none', ok: false, warnings: [] },
});

const SINGLE_EMPLOYEE = {
  canton: 'GE',
  civil_status: 'single',
  children: 0,
  commune: 'Meyrin',
  moved: 'no',
  'income_sources:p1': ['salary'],
  'employers:p1': 1,
  'residence:p1': 'swiss',
  'pillar3a:p1': 'yes',
  'lpp_buyin:p1': false,
  'commute:p1': 'public_transport',
  'commute_transit_cost:p1': "CHF 1'250.50",
  'meal_days:p1': 0,
  banks: 2,
  crypto: 'non',
  payments: [],
  special: [],
};

describe('Geneva questionnaire 2026', () => {
  it('matches the 2026 keys and communes exactly', () => {
    expect(engine().check()).toEqual([]);
  });

  it('uses non-breaking spaces in French', () => {
    const q = geQuestionnaire2026().questions[0]!;
    expect('fr' in q.text && q.text.fr).toMatch(new RegExp(`2026${NBSP}\\?$`));
  });

  it('asks a single employee 17 questions, the canton first, then lists what is missing', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS_2026);
    const asked = walk(e, ledger, SINGLE_EMPLOYEE);
    expect(asked).toEqual(Object.keys(SINGLE_EMPLOYEE));
    // About 15 for a typical household (SPEC.md section 6): the commute adds its cost and the
    // lunches away from home, which the federal travel and meal deductions need, and the canton
    // comes first.
    expect(asked.length).toBeLessThanOrEqual(17);
    expect(ledger.get('commute.transit_cost', 'p1')?.value).toBe(125_050);
    const snap = e.snapshot(ledger);
    expect(e.next(snap)).toBeUndefined();
    expect(ledger.get('profile.commune')?.value).toBe('meyrin');

    const reqs = e.requirements(snap, []);
    expect(reqs.map((r) => [r.id, r.status, r.expects])).toEqual([
      ['salary_certificate:p1', 'missing', { kinds: ['salary_certificate'], count: 1 }],
      ['pillar3a:p1', 'missing', { kinds: ['pillar3a_attestation'], count: 1 }],
      ['health_premiums:p1', 'missing', { kinds: ['health_premiums'], count: 1 }],
      [
        'banks',
        'missing',
        { kinds: ['ech0196_statement', 'bank_attestation', 'broker_export'], count: 2 },
      ],
      ['prior_declaration', 'missing', { kinds: ['prior_declaration'], count: 1 }],
    ]);
    expect(e.chips(snap, 'en')).toEqual([
      'Geneva',
      'Single',
      'No children',
      'Meyrin',
      '1 employer',
      'Pays into 3a',
      '2 banks',
    ]);
    expect(e.notSupported(snap)).toEqual([]);
  });

  it('documents satisfy requirements; optional ones can be waived', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS_2026);
    walk(e, ledger, SINGLE_EMPLOYEE);
    const snap = e.snapshot(ledger);
    const docs = [
      doc('salary_certificate'),
      doc('ech0196_statement'),
      doc('broker_export'),
      doc(undefined),
    ];
    const byId = Object.fromEntries(
      e.requirements(snap, docs, ['prior_declaration']).map((r) => [r.id, r]),
    );
    expect(byId['salary_certificate:p1']?.status).toBe('satisfied');
    expect(byId['banks']).toMatchObject({ status: 'satisfied', have: 2 });
    expect(byId['pillar3a:p1']?.status).toBe('missing');
    expect(byId['prior_declaration']?.status).toBe('waived');
  });

  it('asks per-person questions for both people in a couple', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS_2026);
    walk(e, ledger, {
      canton: 'GE',
      civil_status: 'married',
      children: 1,
      children_custody: 'with_household',
      childcare: 'nanny',
      commune: 'Ville de Genève',
      moved: 'from_abroad',
      'income_sources:p1': ['salary'],
    });
    const snap = e.snapshot(ledger);
    expect(snap.people).toEqual(['p1', 'p2']);
    const next = e.next(snap)!;
    expect(next.id).toBe('income_sources:p2');
    expect(e.render(next, snap, 'fr')).toMatchObject({
      who: 'Votre conjoint ou partenaire',
      text: `Quels revenus votre conjoint ou partenaire a-t-il eus en 2026${NBSP}?`,
    });
    e.answer(ledger, 'income_sources:p2', ['salary', 'pension'], USER);
    e.answer(ledger, 'employers:p1', 2, USER);
    const snap2 = e.snapshot(ledger);
    expect(snap2.slots.map((s) => s.id)).toContain('employers:p2');
    const reqs = e.requirements(snap2, [doc('salary_certificate')]);
    // In a couple, a document counts only once you say whose it is.
    expect(reqs.find((r) => r.id === 'salary_certificate:p1')).toMatchObject({
      have: 0,
      expects: { count: 2 },
    });
    expect(reqs.map((r) => r.id)).toContain('pension:p2');
    expect(reqs.map((r) => r.id)).toContain('childcare');
    expect(e.chips(snap2, 'fr')).toContain(`Conjoint${NBSP}: Rente`);
  });

  it('forgets answers to questions that no longer apply', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS_2026);
    walk(e, ledger, {
      canton: 'GE',
      civil_status: 'single',
      children: 2,
      children_custody: 'shared',
      child_support: 'none_i_earn_more',
      childcare: 'creche_or_daycare',
    });
    expect(e.requirements(e.snapshot(ledger), []).map((r) => r.id)).toContain('childcare');
    e.answer(ledger, 'children', 0, USER);
    const snap = e.snapshot(ledger);
    expect(snap.slots.map((s) => s.id)).not.toContain('childcare');
    expect(e.requirements(snap, []).map((r) => r.id)).not.toContain('childcare');
    expect(ledger.history('profile.children_count').map((f) => f.value)).toEqual([2, 0]);
  });

  it('flags situations Taxpresso does not support yet', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS_2026);
    const asked = walk(e, ledger, {
      canton: 'GE',
      civil_status: 'single',
      children: 0,
      commune: 'onex',
      moved: 'from_other_canton',
      'income_sources:p1': ['self_employment'],
      'business_form:p1': 'sole_proprietor',
      'business_year:p1': 'calendar',
      'business_place:p1': 'home_commune',
      'business_method:p1': 'cash',
      'business_special:p1': [],
      'business_losses:p1': false,
    });
    // Self-employment, the simple case, is supported (SPEC.md section 1): its questions are asked.
    // A move from another canton is supported too: Geneva taxes the whole year (guide p. 53).
    expect(asked.filter((id) => id.startsWith('business_'))).toEqual([
      'business_form:p1',
      'business_year:p1',
      'business_place:p1',
      'business_method:p1',
      'business_special:p1',
      'business_losses:p1',
    ]);
    expect(e.notSupported(e.snapshot(ledger))).toEqual([]);
    // Beyond the simple case, said plainly.
    e.answer(ledger, 'business_form:p1', 'partnership', USER);
    e.answer(ledger, 'business_special:p1', ['real_estate', 'vat'], USER);
    const what = e.notSupported(e.snapshot(ledger)).map((n) => n.what.en);
    expect(what).toEqual([
      'A partnership (société de personnes)',
      'Business real estate',
      'VAT (TVA)',
    ]);
    expect(e.notSupportedMessage('en')).toMatch(/GeTax/);
  });

  it('asks about the way to work only what that way needs', () => {
    const START = {
      canton: 'GE',
      civil_status: 'single',
      children: 0,
      commune: 'Onex',
      moved: 'no',
      'income_sources:p1': ['salary'],
      'employers:p1': 1,
      'residence:p1': 'permit_c',
      'pillar3a:p1': false,
      'lpp_buyin:p1': false,
    };
    const after = (answers: Record<string, unknown>) => {
      const e = engine();
      const ledger = new Ledger(2026, KEYS_2026);
      const asked = walk(e, ledger, { ...START, ...answers });
      return { asked: asked.slice(Object.keys(START).length), next: e.next(e.snapshot(ledger)) };
    };
    // By car, with public transport possible: its price, then lunches.
    expect(
      after({
        'commute:p1': 'car',
        'commute_transit_usable:p1': 'yes_long',
        'commute_transit_equivalent:p1': 900,
        'meal_days:p1': 200,
      }),
    ).toMatchObject({
      asked: [
        'commute:p1',
        'commute_transit_usable:p1',
        'commute_transit_equivalent:p1',
        'meal_days:p1',
      ],
      next: { id: 'banks' },
    });
    // By car, no public transport possible: the kilometres and the days instead.
    expect(
      after({
        'commute:p1': 'car',
        'commute_transit_usable:p1': 'no',
        'commute_distance:p1': 18,
        'commute_drive_days:p1': 210,
        'meal_days:p1': 0,
      }).next?.id,
    ).toBe('banks');
    // By bike: lunches only. From home: nothing more.
    expect(after({ 'commute:p1': 'bike' }).next?.id).toBe('meal_days:p1');
    expect(after({ 'commute:p1': 'mostly_home' }).next?.id).toBe('banks');
  });

  it('takes amounts in CHF as centimes, and refuses what is not an amount', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS_2026);
    walk(e, ledger, {
      canton: 'GE',
      civil_status: 'single',
      children: 0,
      commune: 'Onex',
      moved: 'no',
      'income_sources:p1': ['salary'],
      'employers:p1': 1,
      'residence:p1': 'permit_c',
      'pillar3a:p1': false,
      'lpp_buyin:p1': false,
      'commute:p1': 'public_transport_long',
    });
    const id = 'commute_transit_cost:p1';
    expect(() => e.answer(ledger, id, 'a lot', USER)).toThrow(/amount in CHF/);
    expect(() => e.answer(ledger, id, -5, USER)).toThrow(/zero or more/);
    expect(() => e.answer(ledger, id, 25_000, USER)).toThrow(/at most CHF 20000\.00/);
    e.answer(ledger, id, 790.5, USER);
    expect(ledger.get('commute.transit_cost', 'p1')?.value).toBe(79_050);
    const snap = e.snapshot(ledger);
    const slot = snap.slots.find((s) => s.id === id)!;
    expect(e.describe(slot, 'en')).toBe('CHF 790.50');
    expect(e.render(slot, snap, 'fr')).toMatchObject({ type: 'money', value: 79_050 });
    expect(e.chips(snap, 'en')).toContain('Long trip to work');
  });

  it('asks about child support only when a parent without a partner shares custody', () => {
    const e = engine();
    const asks = (status: string, custody: string) => {
      const ledger = new Ledger(2026, KEYS_2026);
      walk(e, ledger, {
        canton: 'GE',
        civil_status: status,
        children: 1,
        children_custody: custody,
      });
      return e.next(e.snapshot(ledger))?.id === 'child_support';
    };
    expect(asks('divorced', 'shared')).toBe(true);
    expect(asks('single', 'shared')).toBe(true);
    expect(asks('married', 'shared')).toBe(false);
    expect(asks('divorced', 'with_household')).toBe(false);
  });

  it('asks again an answer whose option no longer exists', () => {
    const e = engine();
    const answered = (key: string, person: 'p1' | 'household', value: string | number) => ({
      id: `f_${key}`,
      key,
      person,
      taxYear: 2026,
      value,
      status: 'stated' as const,
      source: { method: 'user' as const },
      createdAt: '2026-10-01T00:00:00.000Z',
    });
    // "Bike or on foot" was one option before the way to work was asked in detail.
    const ledger = new Ledger(2026, KEYS_2026, [
      answered('profile.civil_status', 'household', 'single'),
      answered('profile.commute', 'p1', 'bike_or_walk'),
    ]);
    const slot = e.snapshot(ledger).slots.find((s) => s.question.key === 'profile.commute');
    expect(slot).toBeUndefined(); // only once a salary is said
    const withSalary = new Ledger(2026, KEYS_2026, [
      answered('profile.civil_status', 'household', 'single'),
      { ...answered('profile.income_sources', 'p1', 'x'), value: ['salary'] },
      answered('profile.commute', 'p1', 'bike_or_walk'),
    ]);
    const commute = e.snapshot(withSalary).slots.find((s) => s.id === 'commute:p1')!;
    expect(commute.value).toBeUndefined();
  });

  it('understands answers in words, and refuses wrong ones clearly', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS_2026);
    e.answer(ledger, 'civil_status', 'Marié(e)', USER);
    expect(ledger.get('profile.civil_status')?.value).toBe('married');
    expect(() => e.answer(ledger, 'commune', 'Lausanne', USER)).toThrow(/not a Geneva commune/);
    e.answer(ledger, 'commune', 'Chene-Bougeries', USER);
    expect(ledger.get('profile.commune')?.value).toBe('chene-bougeries');
    expect(() => e.answer(ledger, 'children', 13, USER)).toThrow(QuestionnaireError);
    expect(() => e.answer(ledger, 'children', '2.5', USER)).toThrow(/whole number/);
    expect(() => e.answer(ledger, 'childcare', 'none', USER)).toThrow(/doesn't apply/);
  });

  it('asks skipped questions last', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS_2026);
    expect(e.next(e.snapshot(ledger), ['canton', 'civil_status'])?.id).toBe('children');
    e.answer(ledger, 'children', 0, USER);
    expect(e.next(e.snapshot(ledger), ['canton', 'civil_status'])?.id).toBe('commune');
  });

  it('explains every question and every document in both languages', () => {
    const file = geQuestionnaire2026();
    for (const item of [...file.questions, ...file.requirements]) {
      expect(item.explain?.en, item.id).toBeTruthy();
      expect(item.explain?.fr, item.id).toBeTruthy();
    }
  });

  it('links every question and every document to an official page from the sources library', () => {
    // Only pages that were opened and checked (docs/sources/*/manifest.json, SPEC.md section 7b).
    const manifest = JSON.parse(
      readFileSync(new URL('../../../docs/sources/manifest.json', import.meta.url), 'utf8'),
    ) as { entries: { url: string }[] };
    const official = new Set(manifest.entries.map((e) => e.url));
    const file = geQuestionnaire2026();
    for (const item of [...file.questions, ...file.requirements]) {
      expect(item.learnMore, item.id).toBeDefined();
      expect(official, item.id).toContain(item.learnMore!.url.replace(/#page=\d+$/, ''));
      expect(item.learnMore!.label.en, item.id).toBeTruthy();
      expect(item.learnMore!.label.fr, item.id).toBeTruthy();
    }
  });

  it('accepts only official https pages as learnMore, without parameters', () => {
    const label = { en: 'Page', fr: 'Page' };
    const ok = (url: string) => LearnMore.safeParse({ url, label }).success;
    expect(ok('https://www.ge.ch/taux-donnees-fiscales')).toBe(true);
    expect(ok('https://www.estv.admin.ch/dam/fr/sd-web/oQ0wWcDmCJTS/2a-2026-fr.pdf#page=7')).toBe(
      true,
    );
    expect(ok('http://www.ge.ch/taux-donnees-fiscales')).toBe(false);
    expect(ok('https://www.ge.ch/taux-donnees-fiscales?utm_source=taxpresso')).toBe(false);
    expect(ok('https://example.com/ge.ch')).toBe(false);
    expect(ok('https://notge.ch/')).toBe(false);
    expect(ok('not a url')).toBe(false);
  });

  it('lets one document cover both partners', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS_2026);
    e.answer(ledger, 'civil_status', 'married', USER);
    const snap = e.snapshot(ledger);
    const health = (docs: VaultDocument[]) =>
      e
        .requirements(snap, docs)
        .filter((r) => r.id.startsWith('health_premiums'))
        .map((r) => [r.id, r.status]);
    expect(health([doc('health_premiums', 'p1')])).toEqual([
      ['health_premiums:p1', 'satisfied'],
      ['health_premiums:p2', 'missing'],
    ]);
    expect(health([doc('health_premiums', 'household')])).toEqual([
      ['health_premiums:p1', 'satisfied'],
      ['health_premiums:p2', 'satisfied'],
    ]);
  });

  it('shows a value read from a document as a suggestion, never as an answer (C7)', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS_2026);
    const read = { method: 'pdf_text', docId: 'd_prior', page: 1 } as const;
    const suggested = ledger.append({
      key: 'profile.civil_status',
      person: 'household',
      value: 'married',
      status: 'extracted',
      source: read,
    });
    ledger.append({
      key: 'profile.income_sources',
      person: 'p2',
      value: ['salary'],
      status: 'extracted',
      source: read,
    });
    let snap = e.snapshot(ledger);
    const slot = snap.slots.find((s) => s.id === 'civil_status')!;
    expect(slot.value).toBeUndefined();
    expect(slot.suggested).toBe('married');
    // Not an answer: no partner yet, nothing answered, the question still comes (after the canton).
    expect(snap.people).toEqual(['p1']);
    expect(snap.answers.size).toBe(0);
    expect(e.next(snap)?.id).toBe('canton');
    expect(e.next(snap, ['canton'])?.id).toBe('civil_status');
    expect(e.render(slot, snap, 'en')).toMatchObject({ suggested: 'married' });
    expect(e.render(slot, snap, 'en').value).toBeUndefined();
    expect(e.describe(slot, 'fr', slot.suggested)).toBe('Marié(e)');
    expect(e.chips(snap, 'en')).toEqual([]);

    // The user answers: the answer replaces the suggestion, and the partner's suggestion shows.
    const answer = e.answer(ledger, 'civil_status', 'married', { method: 'user', via: 'chat' });
    expect(answer).toMatchObject({ status: 'stated', supersedes: suggested.id });
    snap = e.snapshot(ledger);
    expect(snap.people).toEqual(['p1', 'p2']);
    expect(snap.slots.find((s) => s.id === 'income_sources:p2')).toMatchObject({
      suggested: ['salary'],
    });
    expect(snap.slots.find((s) => s.id === 'income_sources:p2')?.value).toBeUndefined();
  });
});

describe('pension capital (prestations en capital, 98.12)', () => {
  const COUPLE = {
    canton: 'GE',
    civil_status: 'married',
    children: 0,
    commune: 'Vernier',
    moved: 'no',
    'income_sources:p1': ['pension'],
    'income_sources:p2': ['pension'],
    // Swiss: not taxed at source; the spouse is not asked.
    'residence:p1': 'swiss',
    banks: 0,
    crypto: false,
    payments: [],
    special: ['pension_capital'],
    'pension_capital:p1': ['pillar2', 'pillar3a'],
    'pension_capital:p2': [],
  };

  it('asks only who received which, in Geneva: the rest is on the attestation', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS_2026);
    const asked = walk(e, ledger, COUPLE);
    expect(asked.slice(-3)).toEqual(['special', 'pension_capital:p1', 'pension_capital:p2']);
    const snap = e.snapshot(ledger);
    expect(e.next(snap)).toBeUndefined();
    expect(e.notSupported(snap)).toEqual([]);
    const reqs = e.requirements(snap, [doc('lpp_capital_attestation', 'p1')]);
    expect(
      reqs.filter((r) => r.id.includes('capital')).map((r) => [r.id, r.status, r.source]),
    ).toEqual([
      [
        'lpp_capital:p1',
        'satisfied',
        'ch-na-law-lifd art. 129 al. 1 let. b and al. 2 (p. 69); ch-2026-ifd-instructions-personnes-physiques p. 9; ge-2025-guide-declaration-pp p. 13',
      ],
      [
        'pillar3a_capital:p1',
        'missing',
        'ch-na-law-lifd art. 129 al. 1 let. b and al. 2 (p. 69); ch-2026-ifd-instructions-personnes-physiques p. 9; ge-2025-guide-declaration-pp p. 13',
      ],
    ]);
    expect(e.chips(snap, 'en')).toEqual(
      expect.arrayContaining([
        'I received a lump sum from my pension fund or pillar 3a',
        'Capital, 2nd pillar',
        'Capital, pillar 3a',
      ]),
    );
  });

  it('asks nothing more without a lump sum', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS_2026);
    walk(e, ledger, { ...COUPLE, special: [] });
    expect(e.snapshot(ledger).slots.some((s) => s.question.id.startsWith('pension_capital'))).toBe(
      false,
    );
  });

  it('cites 2025 documents only for the 2025 return', () => {
    const e = new QuestionnaireEngine(geQuestionnaire(2025), KEYS_2026, COMMUNES_2026);
    const ledger = new Ledger(2025, KEYS_2026);
    walk(e, ledger, COUPLE);
    const reqs = e.requirements(e.snapshot(ledger), []);
    const capital = reqs.filter((r) => r.id.includes('capital'));
    expect(capital.map((r) => r.id)).toEqual(['lpp_capital:p1', 'pillar3a_capital:p1']);
    for (const r of capital) {
      expect(r.source).toBe(
        'ch-na-law-lifd art. 129 al. 1 let. b and al. 2 (p. 69); ge-2025-guide-declaration-pp p. 13',
      );
    }
  });

  it('stays not supported in every other canton', () => {
    for (const [canton, file] of [
      ['ZH', zhQuestionnaire2026()],
      ['BE', beQuestionnaire2026()],
      ['BL', blQuestionnaire2026()],
      ['VD', vdQuestionnaire2026()],
      ['BS', bsQuestionnaire2026()],
      ['ZG', zgQuestionnaire2026()],
      ['LU', luQuestionnaire2026()],
      ['SG', sgQuestionnaire2026()],
      ['FR', frQuestionnaire2026()],
      ['TI', tiQuestionnaire2026()],
      ['shared', sharedQuestionnaire2026()],
    ] as const) {
      const special = file.questions.find((q) => q.id === 'special')!;
      const option = special.options!.find((o) => o.value === 'pension_capital')!;
      expect(option.notSupported, canton).toBeDefined();
      expect(
        file.questions.some((q) => q.id.startsWith('pension_capital')),
        canton,
      ).toBe(false);
    }
    const ge = geQuestionnaire2026().questions.find((q) => q.id === 'special')!;
    expect(ge.options!.find((o) => o.value === 'pension_capital')!.notSupported).toBeUndefined();
  });
});

describe('the questions every canton shares', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../../../docs/sources/manifest.json', import.meta.url), 'utf8'),
  ) as { entries: { url: string }[] };
  const official = new Set(manifest.entries.map((e) => e.url));

  it('start with the canton, with the vote for the next one', () => {
    const file = sharedQuestionnaire2026();
    const canton = file.questions[0]!;
    expect(canton).toMatchObject({ id: 'canton', key: 'profile.canton', type: 'choice' });
    expect(canton.options?.map((o) => o.value)).toEqual([
      'GE',
      'ZH',
      'BE',
      'BL',
      'VD',
      'BS',
      'ZG',
      'LU',
      'SG',
      'FR',
      'TI',
      'other',
    ]);
    expect(canton.options?.find((o) => o.value === 'other')?.notSupported).toBeDefined();
    expect(canton.link?.url).toBe('https://github.com/nisheetpatel/taxpresso/issues/1');
    // A move from another canton: the canton of 31 December taxes the whole year (LIFD art. 105).
    expect(canton.learnMore?.url).toMatch(/fedlex\.admin\.ch\/.+#page=58$/);
    expect(official).toContain(canton.learnMore!.url.replace(/#page=\d+$/, ''));
    expect(canton.help?.en).toMatch(/taxes the whole year/);
    // The cantons covered are named from the options themselves: a canton added there is named.
    expect(canton.explain?.en).toMatch(
      /returns for Geneva, Zurich, Bern, Basel-Landschaft, Vaud, Basel-Stadt, Zug, Lucerne, St. Gallen, Fribourg and Ticino so far\.$/,
    );
    expect(canton.explain?.fr).toMatch(
      new RegExp(
        `ces cantons${NBSP}: Genève, Zurich, Berne, Bâle-Campagne, Vaud, Bâle-Ville, Zoug, Lucerne, Saint-Gall, Fribourg et Tessin\\.$`,
      ),
    );
    expect(canton.explain?.de).toMatch(
      /für Genf, Zürich, Bern, Basel-Landschaft, Waadt, Basel-Stadt, Zug, Luzern, St. Gallen, Freiburg und Tessin vor\.$/,
    );
    expect(canton.options?.find((o) => o.value === 'other')?.notSupported).toEqual({
      en: 'A canton other than Geneva, Zurich, Bern, Basel-Landschaft, Vaud, Basel-Stadt, Zug, Lucerne, St. Gallen, Fribourg or Ticino',
      fr: 'Un autre canton que Genève, Zurich, Berne, Bâle-Campagne, Vaud, Bâle-Ville, Zoug, Lucerne, Saint-Gall, Fribourg ou Tessin',
      de: 'Ein anderer Kanton als Genf, Zürich, Bern, Basel-Landschaft, Waadt, Basel-Stadt, Zug, Luzern, St. Gallen, Freiburg oder Tessin',
      it: 'Un Cantone diverso da Ginevra, Zurigo, Berna, Basilea Campagna, Vaud, Basilea Città, Zugo, Lucerna, San Gallo, Friburgo o Ticino',
    });
    for (const f of [
      file,
      geQuestionnaire2026(),
      zhQuestionnaire2026(),
      bsQuestionnaire2026(),
      zgQuestionnaire2026(),
    ]) {
      expect(JSON.stringify(f)).not.toMatch(/\{cantons/);
    }
    for (const item of [...file.questions, ...file.requirements]) {
      expect(item.explain?.de, item.id).toBeTruthy();
      expect(item.learnMore?.label.de, item.id).toBeTruthy();
    }
  });

  it('says everything in Italian too', () => {
    for (const [name, file] of [
      ['ch', sharedQuestionnaire2026()],
      ['ge', geQuestionnaire2026()],
    ] as const) {
      const missing: string[] = [];
      const italian: string[] = [];
      const visit = (v: unknown, where: string): void => {
        if (Array.isArray(v)) return v.forEach((x, i) => visit(x, `${where}[${i}]`));
        if (v && typeof v === 'object') {
          const o = v as Record<string, unknown>;
          if (typeof o.en === 'string' && typeof o.fr === 'string') {
            if (typeof o.it !== 'string' || !o.it) missing.push(where);
            else italian.push(o.it);
            return;
          }
          for (const [k, x] of Object.entries(o)) visit(x, `${where}.${k}`);
        }
      };
      visit(file, name);
      expect(missing).toEqual([]);
      // No em-dash anywhere; the typographic apostrophe (’) only in Italian.
      expect(JSON.stringify(file)).not.toMatch(/—/);
      expect(italian.filter((s) => s.includes("'"))).toEqual([]);
    }
    // The cantons covered are named in Italian, the last two joined with "e" (a canton added
    // after St. Gallen only lengthens the list).
    const canton = sharedQuestionnaire2026().questions[0]!;
    expect(canton.explain?.it).toMatch(
      /Cantoni: Ginevra, Zurigo, Berna, Basilea Campagna, Vaud, Basilea Città, Zugo, Lucerna(,| e) San Gallo\b/,
    );
    expect(canton.explain?.it).toMatch(/ e [^,]+\.$/);
    expect(canton.options?.find((o) => o.value === 'other')?.notSupported?.it).toMatch(
      /^Un Cantone diverso da Ginevra, Zurigo, .+ o [^,]+$/,
    );
  });

  it('are taken by a canton in its own order, with its own fields over them', () => {
    const shared = {
      taxYear: 2026,
      questions: [{ id: 'a', key: 'k', text: { en: 'A?', fr: 'A ?' } }],
    };
    const people = { en: 'B', fr: 'B' };
    const resolved = resolveShared(
      {
        people: { p1: people, p2: people, p2Chip: people },
        notSupported: { en: 'No', fr: 'Non' },
        questions: [{ use: 'a', help: { en: 'Help', fr: 'Aide' } }],
        requirements: [],
      },
      shared,
    ) as { taxYear: number; questions: unknown[] };
    expect(resolved.taxYear).toBe(2026);
    expect(resolved.questions).toEqual([
      { id: 'a', key: 'k', text: { en: 'A?', fr: 'A ?' }, help: { en: 'Help', fr: 'Aide' } },
    ]);
    expect(() =>
      parseQuestionnaire({ questions: [{ use: 'nope' }], requirements: [] }, shared),
    ).toThrow(/nope is not in the shared questionnaire/);
    // Geneva's file takes the canton question from the shared file, first.
    expect(geQuestionnaire2026().questions[0]).toEqual(sharedQuestionnaire2026().questions[0]);
  });

  it('link only to the project’s own pages besides the official ones', () => {
    const label = { en: 'Vote', fr: 'Voter' };
    const ok = (url: string) => ProjectLink.safeParse({ url, label }).success;
    expect(ok('https://github.com/nisheetpatel/taxpresso/issues/1')).toBe(true);
    expect(ok('https://github.com/someone/else/issues/1')).toBe(false);
    expect(ok('https://github.com/nisheetpatel/taxpresso/issues/1?ref=x')).toBe(false);
    expect(ok('http://github.com/nisheetpatel/taxpresso/issues/1')).toBe(false);
  });

  it('take an answer from other answers until the user gives it, never one the key refuses', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS_2026);
    e.answer(ledger, 'canton', 'GE', USER);
    const fresh = new Ledger(2026, KEYS_2026);
    const snap = e.snapshot(fresh, { 'profile.canton': 'GE' });
    const slot = snap.slots.find((s) => s.id === 'canton')!;
    expect(slot).toMatchObject({ value: 'GE', assumed: true });
    expect(e.next(snap)?.id).toBe('civil_status');
    expect(e.render(slot, snap, 'en')).toMatchObject({ value: 'GE', assumed: true });
    // An answer the key doesn't take is not assumed.
    const refused = e.snapshot(fresh, { 'profile.canton': 'AG' });
    expect(refused.slots.find((s) => s.id === 'canton')?.value).toBeUndefined();
    // The user's answer wins.
    const answered = e.snapshot(ledger, { 'profile.canton': 'ZH' });
    expect(answered.slots.find((s) => s.id === 'canton')).toMatchObject({ value: 'GE' });
    expect(answered.slots.find((s) => s.id === 'canton')?.assumed).toBeUndefined();
  });
});

describe('tax at source, worked out from plain facts (never asked where the law settles it)', () => {
  /** Where the Geneva household lives (synthetic). */
  const START = { commune: 'Vernier', moved: 'no' };
  const derived = (e: QuestionnaireEngine, ledger: Ledger, id: string) =>
    e.snapshot(ledger).derived.find((s) => s.id === id);

  it('both spouses with a B permit, one salaried, the other on unemployment: both at source', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS_2026);
    const asked = walk(e, ledger, {
      canton: 'GE',
      civil_status: 'married',
      children: 0,
      ...START,
      'income_sources:p1': ['salary'],
      'income_sources:p2': ['replacement_income'],
      'employers:p1': 1,
      'residence:p1': 'permit_other',
      'employer_in_switzerland:p1': true,
      'residence:p2': 'permit_other',
      'employer_in_switzerland:p2': true,
    });
    // The spouse on benefits is asked the permit too; "taxed at source?" is never asked.
    expect(asked).toContain('residence:p2');
    expect(asked.filter((id) => id.startsWith('taxed_at_source'))).toEqual([]);
    for (const p of ['p1', 'p2']) {
      expect(derived(e, ledger, `taxed_at_source:${p}`)).toMatchObject({
        value: true,
        derived: {
          source:
            'ge-na-law-lisp art. 1 al. 1, art. 2 al. 2 let. a and b; ge-na-law-risp art. 3 and 5',
        },
      });
    }
    expect(e.snapshot(ledger).answers.get('profile.taxed_at_source|p2')).toBe(true);
    // Next: whether TOU is already in place, a fact (never "thinking about it").
    const next = e.next(e.snapshot(ledger))!;
    expect(next.id).toBe('tou:p1');
    expect(e.render(next, e.snapshot(ledger), 'en').options?.map((o) => o.value)).toEqual([
      'already',
      'no',
    ]);
    expect(e.chips(e.snapshot(ledger), 'en')).toEqual(
      expect.arrayContaining(['Taxed at source', 'Partner: Taxed at source']),
    );
  });

  it('one spouse Swiss, the other with a B permit: neither at source, the spouse not asked', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS_2026);
    const asked = walk(e, ledger, {
      canton: 'GE',
      civil_status: 'married',
      children: 1,
      children_custody: 'with_household',
      childcare: 'none',
      ...START,
      'income_sources:p1': ['salary'],
      'income_sources:p2': ['salary'],
      'employers:p1': 1,
      'employers:p2': 1,
      'residence:p1': 'swiss',
    });
    expect(asked).not.toContain('residence:p2');
    for (const p of ['p1', 'p2']) {
      const slot = derived(e, ledger, `taxed_at_source:${p}`)!;
      expect(slot.value).toBe(false);
      expect(slot.derived?.because.en).toMatch(/married to one of them/);
    }
    expect(e.next(e.snapshot(ledger))?.id).toBe('pillar3a:p1');
    // A question that follows from the others can't be answered over them.
    expect(() => e.answer(ledger, 'taxed_at_source:p2', true, USER)).toThrow(
      /follows from the other answers/,
    );
  });

  it('a single parent with a B permit and two children: at source, then who lives with whom', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS_2026);
    walk(e, ledger, {
      canton: 'GE',
      civil_status: 'single',
      children: 2,
      children_custody: 'with_household',
      childcare: 'creche_or_daycare',
      ...START,
      'income_sources:p1': ['salary'],
      'employers:p1': 1,
      'residence:p1': 'permit_other',
      'employer_in_switzerland:p1': true,
      'tou:p1': 'no',
    });
    expect(derived(e, ledger, 'taxed_at_source:p1')?.value).toBe(true);
    const next = e.next(e.snapshot(ledger))!;
    expect(next.id).toBe('lives_with_other_parent');
    expect(e.render(next, e.snapshot(ledger), 'fr').text).toBe(
      `En 2026, viviez-vous en couple avec l’autre parent des enfants, sans être mariés${NBSP}?`,
    );
  });

  it('a couple already in TOU says so once each, as a fact', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS_2026);
    walk(e, ledger, {
      canton: 'GE',
      civil_status: 'married',
      children: 0,
      ...START,
      'income_sources:p1': ['salary'],
      'income_sources:p2': ['salary'],
      'employers:p1': 1,
      'employers:p2': 1,
      'residence:p1': 'permit_other',
      'employer_in_switzerland:p1': true,
      'residence:p2': 'permit_other',
      'employer_in_switzerland:p2': true,
      'tou:p1': 'already',
      'tou:p2': 'already',
    });
    expect(e.chips(e.snapshot(ledger), 'en')).toEqual(
      expect.arrayContaining(['TOU', 'Partner: TOU']),
    );
    expect(e.next(e.snapshot(ledger))?.id).toBe('pillar3a:p1');
  });

  it('asks where the law leaves it open: a legitimation card, or a pension as the only income', () => {
    const e = engine();
    const card = new Ledger(2026, KEYS_2026);
    walk(e, card, {
      canton: 'GE',
      civil_status: 'single',
      children: 0,
      ...START,
      'income_sources:p1': ['salary'],
      'employers:p1': 1,
      'residence:p1': 'other',
    });
    expect(e.next(e.snapshot(card))?.id).toBe('taxed_at_source:p1');
    e.answer(card, 'taxed_at_source:p1', false, USER);
    expect(e.snapshot(card).answers.get('profile.taxed_at_source|p1')).toBe(false);

    // A salary paid directly by an employer abroad is taxed ordinarily (RISP art. 5): asked.
    const abroad = new Ledger(2026, KEYS_2026);
    walk(e, abroad, {
      canton: 'GE',
      civil_status: 'single',
      children: 0,
      ...START,
      'income_sources:p1': ['salary'],
      'employers:p1': 1,
      'residence:p1': 'permit_other',
      'employer_in_switzerland:p1': false,
    });
    expect(e.next(e.snapshot(abroad))?.id).toBe('taxed_at_source:p1');

    const pension = new Ledger(2026, KEYS_2026);
    walk(e, pension, {
      canton: 'GE',
      civil_status: 'single',
      children: 0,
      ...START,
      'income_sources:p1': ['pension'],
      'residence:p1': 'permit_other',
      'employer_in_switzerland:p1': true,
    });
    const slot = e.next(e.snapshot(pension))!;
    expect(slot.id).toBe('taxed_at_source:p1');
    expect(e.render(slot, e.snapshot(pension), 'en').text).toBe(
      'In 2026, was tax taken at source from your income?',
    );
    // No salary, benefits or pension: no permit question at all.
    const none = new Ledger(2026, KEYS_2026);
    const asked = walk(e, none, {
      canton: 'GE',
      civil_status: 'single',
      children: 0,
      ...START,
      'income_sources:p1': ['alimony'],
    });
    expect(asked).not.toContain('residence:p1');
    expect(e.snapshot(none).answers.has('profile.taxed_at_source|p1')).toBe(false);
  });

  it('asks the spouse only when the first person is neither Swiss nor holds a C permit', () => {
    const e = engine();
    const answers = (p1: string) => ({
      canton: 'GE',
      civil_status: 'registered_partnership',
      children: 0,
      ...START,
      'income_sources:p1': ['salary'],
      'income_sources:p2': ['salary'],
      'employers:p1': 1,
      'employers:p2': 1,
      'residence:p1': p1,
    });
    for (const [p1, askedSpouse] of [
      ['swiss', false],
      ['permit_c', false],
      ['permit_other', true],
      ['other', true],
    ] as const) {
      const ledger = new Ledger(2026, KEYS_2026);
      walk(e, ledger, answers(p1));
      const ids = e.snapshot(ledger).slots.map((s) => s.id);
      expect(ids.includes('residence:p2'), p1).toBe(askedSpouse);
    }
  });
});
