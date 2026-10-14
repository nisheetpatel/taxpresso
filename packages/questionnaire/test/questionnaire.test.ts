import { readFileSync } from 'node:fs';
import { Ledger, type VaultDocument } from '@taxpresso/ledger';
import { KEYS_CANTON_2026 } from '@taxpresso/rules-ch';
import { COMMUNES_2026, KEYS_2026 as GENEVA_KEYS } from '@taxpresso/rules-ge';
import { describe, expect, it } from 'vitest';
import {
  agQuestionnaire2026,
  bsQuestionnaire2026,
  geQuestionnaire2026,
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
  'taxed_at_source:p1': 'no',
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
    walk(e, ledger, {
      canton: 'GE',
      civil_status: 'single',
      children: 0,
      commune: 'onex',
      moved: 'from_other_canton',
      'income_sources:p1': ['self_employment'],
    });
    const what = e.notSupported(e.snapshot(ledger)).map((n) => n.what.en);
    // A move from another canton is supported: Geneva taxes the whole year (guide p. 53).
    expect(what).toEqual(['Self-employment (annexe B)']);
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
      'taxed_at_source:p1': false,
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
      'taxed_at_source:p1': false,
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
      'AG',
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
      /returns for Geneva, Zurich, Bern, Basel-Landschaft, Vaud, Basel-Stadt, Zug, Lucerne, St. Gallen and Aargau so far\.$/,
    );
    expect(canton.explain?.fr).toMatch(
      new RegExp(
        `ces cantons${NBSP}: Genève, Zurich, Berne, Bâle-Campagne, Vaud, Bâle-Ville, Zoug, Lucerne, Saint-Gall et Argovie\\.$`,
      ),
    );
    expect(canton.explain?.de).toMatch(
      /für Genf, Zürich, Bern, Basel-Landschaft, Waadt, Basel-Stadt, Zug, Luzern, St. Gallen und Aargau vor\.$/,
    );
    expect(canton.options?.find((o) => o.value === 'other')?.notSupported).toEqual({
      en: 'A canton other than Geneva, Zurich, Bern, Basel-Landschaft, Vaud, Basel-Stadt, Zug, Lucerne, St. Gallen or Aargau',
      fr: 'Un autre canton que Genève, Zurich, Berne, Bâle-Campagne, Vaud, Bâle-Ville, Zoug, Lucerne, Saint-Gall ou Argovie',
      de: 'Ein anderer Kanton als Genf, Zürich, Bern, Basel-Landschaft, Waadt, Basel-Stadt, Zug, Luzern, St. Gallen oder Aargau',
    });
    for (const f of [
      file,
      geQuestionnaire2026(),
      zhQuestionnaire2026(),
      bsQuestionnaire2026(),
      zgQuestionnaire2026(),
      agQuestionnaire2026(),
    ]) {
      expect(JSON.stringify(f)).not.toMatch(/\{cantons/);
    }
    for (const item of [...file.questions, ...file.requirements]) {
      expect(item.explain?.de, item.id).toBeTruthy();
      expect(item.learnMore?.label.de, item.id).toBeTruthy();
    }
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
    const refused = e.snapshot(fresh, { 'profile.canton': 'TI' });
    expect(refused.slots.find((s) => s.id === 'canton')?.value).toBeUndefined();
    // The user's answer wins.
    const answered = e.snapshot(ledger, { 'profile.canton': 'ZH' });
    expect(answered.slots.find((s) => s.id === 'canton')).toMatchObject({ value: 'GE' });
    expect(answered.slots.find((s) => s.id === 'canton')?.assumed).toBeUndefined();
  });
});
