// The Bern questionnaire (data/be/2026/questionnaire.yaml): in step with Bern's keys, communes and
// parish parts (packages/rules-be), every text in English, French and German, every page an official
// one, and the questions only Bern asks (your own household, the tariff and the wealth deduction of a
// parent sharing custody, education costs per child, the church and the part of the commune,
// payments to political parties per person) only where they apply. Synthetic answers only.
import { readFileSync } from 'node:fs';
import { Ledger } from '@taxpresso/ledger';
import { bernKeys, communeOptions, parishOptions } from '@taxpresso/rules-be';
import { KEYS_CANTON_2026 } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  NBSP,
  QuestionnaireEngine,
  QuestionnaireError,
  beQuestionnaire2026,
  sharedQuestionnaire2026,
  type Condition,
} from '../src/index.js';

const KEYS = { ...KEYS_CANTON_2026, ...bernKeys(2026) };
const engine = () => new QuestionnaireEngine(beQuestionnaire2026(), KEYS, communeOptions(2026));
const USER = { method: 'user' } as const;

function walk(e: QuestionnaireEngine, ledger: Ledger, answers: Record<string, unknown>): string[] {
  const asked: string[] = [];
  for (;;) {
    const slot = e.next(e.snapshot(ledger));
    if (!slot || !(slot.id in answers)) return asked;
    asked.push(slot.id);
    e.answer(ledger, slot.id, answers[slot.id], USER);
  }
}

/** Answers given in any order (each question must apply when it is answered). */
function answerAll(e: QuestionnaireEngine, ledger: Ledger, answers: [string, unknown][]): void {
  for (const [id, value] of answers) e.answer(ledger, id, value, USER);
}

const slotIds = (e: QuestionnaireEngine, ledger: Ledger) =>
  e.snapshot(ledger).slots.map((s) => s.id);

const urls = (path: string): Set<string> => {
  const raw = JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as
    { url: string }[] | { entries: { url: string }[] };
  return new Set((Array.isArray(raw) ? raw : raw.entries).map((e) => e.url));
};
const BERN_URLS = urls('../../../docs/sources/be/manifest.json');
const ALL_URLS = urls('../../../docs/sources/manifest.json');

/** A single employee in Biel/Bienne, living alone (synthetic). */
const SINGLE_IN_BIEL = {
  canton: 'BE',
  civil_status: 'single',
  own_household: true,
  children: 0,
  commune: 'Biel/Bienne',
  moved: 'no',
  'church:p1': 'none',
  'income_sources:p1': ['salary'],
  'employers:p1': 1,
  'taxed_at_source:p1': false,
  'pillar3a:p1': true,
  'lpp_buyin:p1': false,
  'commute:p1': 'public_transport',
  'commute_transit_cost:p1': 880,
  'meal_days:p1': 200,
  banks: 1,
  crypto: false,
  payments: [],
  special: [],
};

describe('Bern questionnaire 2026', () => {
  it('matches Bern’s 2026 keys and communes exactly (the key-drift check)', () => {
    expect(engine().check()).toEqual([]);
    expect(communeOptions(2026)).toHaveLength(334);
  });

  it('takes the questions every canton shares, in the Bern return’s order', () => {
    const file = beQuestionnaire2026();
    const ids = file.questions.map((q) => q.id);
    expect(ids).toEqual([
      'canton',
      'civil_status',
      'own_household',
      'children',
      'children_custody',
      'child_support',
      'married_tariff',
      'child_wealth',
      'childcare',
      'child_care',
      'education',
      'child_education',
      'commune',
      'moved',
      'church',
      'parish',
      'income_sources',
      'employers',
      'taxed_at_source',
      'pillar3a',
      'lpp_buyin',
      'commute',
      'commute_transit_cost',
      'commute_transit_usable',
      'commute_transit_equivalent',
      'commute_distance',
      'commute_drive_days',
      'meal_days',
      'banks',
      'crypto',
      'payments',
      'party',
      'special',
    ]);
    const shared = new Set(sharedQuestionnaire2026().questions.map((q) => q.id));
    expect(ids.filter((id) => !shared.has(id))).toEqual([
      'own_household',
      'married_tariff',
      'child_wealth',
      'child_care',
      'education',
      'child_education',
      'commune',
      'moved',
      'church',
      'parish',
      'party',
    ]);
    // Bern's way to work has no "over 2 hours" choice: only Geneva's meal rule needs it.
    const options = (id: string) => file.questions.find((q) => q.id === id)!.options!;
    expect(options('commute').map((o) => o.value)).not.toContain('public_transport_long');
    expect(options('commute_transit_usable').map((o) => o.value)).toEqual(['yes', 'no']);
    // Payments to political parties are a choice of their own (form 4.4).
    expect(options('payments').map((o) => o.value)).toEqual([
      'medical_costs',
      'donations',
      'political_party',
      'loan_interest',
      'alimony_paid',
    ]);
    // The children of a question asked per child are named "Child {n}".
    expect(file.people.child).toEqual({ en: 'Child {n}', fr: 'Enfant {n}', de: 'Kind {n}' });
    expect(file.place).toEqual({ en: 'Bern', fr: 'Berne', de: 'Bern' });
  });

  it('says everything in English, French and German, with an official page', () => {
    const file = beQuestionnaire2026();
    const missing: string[] = [];
    const visit = (v: unknown, where: string): void => {
      if (Array.isArray(v)) return v.forEach((x, i) => visit(x, `${where}[${i}]`));
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if (typeof o.en === 'string' && typeof o.fr === 'string') {
          if (typeof o.de !== 'string' || !o.de) missing.push(where);
          return;
        }
        for (const [k, x] of Object.entries(o)) visit(x, `${where}.${k}`);
      }
    };
    visit(file, 'be');
    expect(missing).toEqual([]);
    // No em-dash anywhere, no amount or limit in a question's own words.
    const all = JSON.stringify(file);
    expect(all).not.toMatch(/—/);
    expect(JSON.stringify(file.questions.map((q) => [q.text, q.explain]))).not.toMatch(
      /CHF|Fr\.|franc/i,
    );
    for (const item of [...file.questions, ...file.requirements]) {
      expect(item.explain?.de, item.id).toBeTruthy();
      const { url, label } = item.learnMore!;
      // Bern's own documents; the canton question keeps its federal page (shared).
      expect(item.id === 'canton' ? ALL_URLS : BERN_URLS, item.id).toContain(
        url.replace(/#page=\d+$/, ''),
      );
      // A page of the guide is named by the page the link opens.
      const page = /wl_natuerliche-personen_2025_de\.pdf#page=(\d+)$/.exec(url)?.[1];
      if (page) {
        expect(label.en, item.id).toMatch(new RegExp(`^Bern tax guide 2025, p\\. ${page}: `));
        expect(label.fr, item.id).toMatch(
          new RegExp(`^Guide fiscal bernois 2025, p\\. ${page}${NBSP}: `),
        );
        expect(label.de, item.id).toMatch(
          new RegExp(`^Wegleitung zur Steuererklärung 2025, S\\. ${page}: `),
        );
      }
    }
    // Every document cites the Bern guide, by the page of the PDF.
    for (const r of file.requirements) {
      expect(r.source, r.id).toMatch(/^be-2025-wegleitung-np-de p\. \d+(, p\. \d+)*$/);
    }
    // Informal German: no "Sie" addressed to the user in Taxpresso's text (the form's own question
    // on form 1.2 aside).
    const de = JSON.stringify(file.questions.map((q) => [q.text, q.help, q.explain])).replaceAll(
      'Führen Sie alleine einen eigenen Haushalt?',
      '',
    );
    expect(de).not.toMatch(/\b(Ihr|Ihre|Ihrem|Ihren|Ihrer|Ihnen|Sie haben|haben Sie|Führen Sie)\b/);
    expect(file.questions[2]!.text).toMatchObject({
      de: 'Hast du am 31. Dezember 2026 alleine einen eigenen Haushalt geführt?',
      fr: `Au 31 décembre 2026, teniez-vous ménage indépendant seul ou seule${NBSP}?`,
    });
    expect(file.notSupported.en).toMatch(/TaxMe-Online/);
    expect(file.notSupported.de).toMatch(/BE-Login/);
  });

  it('offers each commune’s own parts, from the parish table, only where the rate differs', () => {
    const parish = beQuestionnaire2026().questions.find((q) => q.id === 'parish')!;
    const table = parishOptions(2026);
    expect(table.length).toBeGreaterThan(40);
    expect(new Set(table.map((o) => o.bfs)).size).toBe(21);
    // The options are the table's parts, each offered only in its own commune.
    expect(
      parish.options!.map((o) => [o.value, o.label.en, o.label.fr, o.label.de, o.when]),
    ).toEqual(
      table.map((o) => [
        o.value,
        `${o.commune}: ${o.part}`,
        `${o.commune}${NBSP}: ${o.part}`,
        `${o.commune}: ${o.part}`,
        { key: 'profile.commune', eq: String(o.bfs) },
      ]),
    );
    // Asked of a member of a church whose rate differs between the commune's parts.
    const asked = new Map<string, string[]>();
    for (const branch of parish.when!.any!) {
      const commune = branch.all!.find((c: Condition) => c.key === 'profile.commune')!;
      const church = branch.all!.find((c: Condition) => c.key === 'be.church')!;
      expect(church.anyPerson).toBe(true);
      for (const bfs of commune.in!) asked.set(bfs, [...church.in!].sort());
    }
    expect(Object.fromEntries([...asked].sort())).toEqual(
      Object.fromEntries(table.map((o) => [String(o.bfs), [...o.churches].sort()] as const).sort()),
    );
  });

  it('asks a single employee in Biel/Bienne 19 questions, then lists what is missing', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    const asked = walk(e, ledger, SINGLE_IN_BIEL);
    expect(asked).toEqual(Object.keys(SINGLE_IN_BIEL));
    expect(ledger.get('profile.commune')?.value).toBe('371');
    expect(ledger.get('be.own_household')?.value).toBe(true);
    const snap = e.snapshot(ledger);
    expect(e.next(snap)).toBeUndefined();
    expect(e.notSupported(snap)).toEqual([]);
    expect(e.chips(snap, 'en')).toEqual([
      'Bern',
      'Single',
      'Own household',
      'No children',
      'Biel/Bienne',
      '1 employer',
      'Pays into 3a',
      '1 bank',
    ]);
    expect(e.requirements(snap, []).map((r) => [r.id, r.source])).toEqual([
      ['salary_certificate:p1', 'be-2025-wegleitung-np-de p. 35'],
      ['pillar3a:p1', 'be-2025-wegleitung-np-de p. 201'],
      ['health_premiums:p1', 'be-2025-wegleitung-np-de p. 204'],
      ['banks', 'be-2025-wegleitung-np-de p. 129, p. 130'],
    ]);
  });

  it('asks whether you keep your own household only of someone not married', () => {
    const e = engine();
    const married = new Ledger(2026, KEYS);
    walk(e, married, { canton: 'BE', civil_status: 'married' });
    expect(e.next(e.snapshot(married))?.id).toBe('children');
    expect(slotIds(e, married)).not.toContain('own_household');
    const partners = new Ledger(2026, KEYS);
    walk(e, partners, { canton: 'BE', civil_status: 'registered_partnership' });
    expect(slotIds(e, partners)).not.toContain('own_household');
    for (const status of ['single', 'separated', 'divorced', 'widowed']) {
      const ledger = new Ledger(2026, KEYS);
      walk(e, ledger, { canton: 'BE', civil_status: status });
      expect(e.next(e.snapshot(ledger))?.id, status).toBe('own_household');
    }
  });

  it('asks the tariff and the wealth deduction of the last assessment only in shared custody without child support', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'BE',
      civil_status: 'divorced',
      own_household: true,
      children: 2,
      children_custody: 'shared',
      child_support: 'none_unsure',
    });
    expect(e.next(e.snapshot(ledger))?.id).toBe('married_tariff');
    e.answer(ledger, 'married_tariff', true, USER);
    expect(e.next(e.snapshot(ledger))?.id).toBe('child_wealth');
    e.answer(ledger, 'child_wealth', 'half', USER);
    expect(ledger.get('be.married_tariff')?.value).toBe(true);
    expect(ledger.get('be.child_wealth')?.value).toBe('half');
    for (const none of ['none_i_earn_more', 'none_other_earns_more']) {
      e.answer(ledger, 'child_support', none, USER);
      expect(slotIds(e, ledger)).toEqual(
        expect.arrayContaining(['married_tariff', 'child_wealth']),
      );
    }
    // With child support, the documents say who counts the children: not asked.
    for (const support of ['i_receive', 'i_pay']) {
      e.answer(ledger, 'child_support', support, USER);
      expect(slotIds(e, ledger)).not.toContain('married_tariff');
      expect(slotIds(e, ledger)).not.toContain('child_wealth');
    }
    // Nor when the children live with you, or mostly with the other parent.
    e.answer(ledger, 'child_support', 'none_unsure', USER);
    for (const custody of ['with_household', 'elsewhere']) {
      e.answer(ledger, 'children_custody', custody, USER);
      expect(slotIds(e, ledger)).not.toContain('married_tariff');
      expect(slotIds(e, ledger)).not.toContain('child_wealth');
    }
  });

  it('asks the education costs once per child, with the child’s number', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'BE',
      civil_status: 'married',
      children: 2,
      children_custody: 'with_household',
      childcare: 'none',
      education: true,
    });
    const snap = e.snapshot(ledger);
    const slots = snap.slots.filter((s) => s.question.id === 'child_education');
    expect(slots.map((s) => s.id)).toEqual(['child_education:child1', 'child_education:child2']);
    expect(e.next(snap)?.id).toBe('child_education:child1');
    const second = e.render(slots[1]!, snap, 'en');
    expect(second.who).toBe('Child 2');
    expect(second.text).toBe(
      'How much did you pay in 2026 for child 2’s education away from home or extra education costs?',
    );
    expect(e.render(slots[0]!, snap, 'fr').who).toBe('Enfant 1');
    expect(e.render(slots[1]!, snap, 'de').text).toMatch(/^Wie viel hast du 2026 für Kind 2 /);
    for (const lang of ['en', 'fr', 'de'] as const) {
      const r = e.render(slots[0]!, snap, lang);
      expect(JSON.stringify([r.text, r.help, r.explain, r.who])).not.toMatch(/\{n\}/);
    }
    e.answer(ledger, 'child_education:child1', 0, USER);
    e.answer(ledger, 'child_education:child2', "3'000", USER);
    expect(ledger.get('be.child_education', 'child2')?.value).toBe(300_000);
    expect(e.next(e.snapshot(ledger))?.id).toBe('commune');
    // No costs: no amount asked. Children mostly with the other parent: not asked at all.
    e.answer(ledger, 'education', false, USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_education'))).toEqual([]);
    e.answer(ledger, 'children_custody', 'elsewhere', USER);
    expect(slotIds(e, ledger)).not.toContain('education');
    e.answer(ledger, 'children_custody', 'shared', USER);
    expect(slotIds(e, ledger)).toContain('education');
  });

  it('asks the payments to political parties of each person, only when there were some', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    answerAll(e, ledger, [
      ['canton', 'BE'],
      ['civil_status', 'married'],
      ['payments', ['donations']],
    ]);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('party'))).toEqual([]);
    e.answer(ledger, 'payments', ['donations', 'political_party'], USER);
    const snap = e.snapshot(ledger);
    const party = snap.slots.filter((s) => s.question.id === 'party');
    expect(party.map((s) => s.id)).toEqual(['party:p1', 'party:p2']);
    expect(e.render(party[1]!, snap, 'en').who).toBe('Your spouse or partner');
    e.answer(ledger, 'party:p1', 800, USER);
    e.answer(ledger, 'party:p2', 0, USER);
    expect(ledger.get('be.party', 'p1')?.value).toBe(80_000);
    // The receipts of both are asked for together.
    const reqs = e.requirements(e.snapshot(ledger), []).map((r) => r.id);
    expect(reqs).toContain('donations');
    e.answer(ledger, 'payments', ['political_party'], USER);
    expect(e.requirements(e.snapshot(ledger), []).map((r) => r.id)).toContain('donations');
  });

  it('asks the part of the commune only where it changes the church tax, with its own parts', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    answerAll(e, ledger, [
      ['canton', 'BE'],
      ['civil_status', 'married'],
      ['commune', '304'],
      ['church:p1', 'none'],
      ['church:p2', 'none'],
    ]);
    // Kallnach: its parts' Reformed and Christ Catholic rates differ.
    expect(slotIds(e, ledger)).not.toContain('parish');
    e.answer(ledger, 'church:p2', 'christ_catholic', USER);
    let snap = e.snapshot(ledger);
    let slot = snap.slots.find((s) => s.id === 'parish')!;
    expect(e.render(slot, snap, 'en').options!.map((o) => [o.value, o.label])).toEqual([
      ['304:Golaten', 'Kallnach: Golaten'],
      ['304:Kallnach/Niederried', 'Kallnach: Kallnach/Niederried'],
    ]);
    e.answer(ledger, 'parish', '304:Golaten', USER);
    expect(ledger.get('be.parish')?.value).toBe('304:Golaten');
    // Lyss: only the Reformed rate differs.
    e.answer(ledger, 'commune', 'Lyss', USER);
    e.answer(ledger, 'church:p2', 'catholic', USER);
    expect(slotIds(e, ledger)).not.toContain('parish');
    e.answer(ledger, 'church:p1', 'reformed', USER);
    snap = e.snapshot(ledger);
    slot = snap.slots.find((s) => s.id === 'parish')!;
    // Kallnach's part no longer answers in Lyss: the question is asked again.
    expect(slot.value).toBeUndefined();
    expect(e.render(slot, snap, 'fr').options!.map((o) => o.value)).toEqual(
      parishOptions(2026)
        .filter((o) => o.bfs === 306)
        .map((o) => o.value),
    );
    // The City of Bern has one parish per church: never asked.
    e.answer(ledger, 'commune', 'Bern', USER);
    expect(ledger.get('profile.commune')?.value).toBe('351');
    expect(slotIds(e, ledger)).not.toContain('parish');
    expect(() => e.answer(ledger, 'commune', 'Carouge', USER)).toThrow(/not a Bern commune/);
  });

  it('says plainly what Bern doesn’t cover yet', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'BE',
      civil_status: 'single',
      own_household: false,
      children: 0,
      commune: 'Thun',
      moved: 'from_abroad',
      'church:p1': 'none',
      'income_sources:p1': ['salary', 'self_employment'],
      'employers:p1': 1,
      'taxed_at_source:p1': true,
    });
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.what.de)).toEqual([
      'Ein Zuzug aus dem Ausland während des Jahres',
      'Die selbstständige Erwerbstätigkeit (Formular 9)',
      'Die Quellensteuer im Kanton Bern und die nachträgliche ordentliche Veranlagung (NOV)',
    ]);
    expect(e.notSupportedMessage('en')).toMatch(/TaxMe-Online/);
    // A move from another canton is supported: Bern taxes the whole year.
    e.answer(ledger, 'moved', 'from_other_canton', USER);
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.slotId)).not.toContain('moved');
    expect(() => e.answer(ledger, 'moved', 'within_zurich', USER)).toThrow(QuestionnaireError);
  });
});
