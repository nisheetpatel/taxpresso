// The Basel-Stadt questionnaire (data/bs/2026/questionnaire.yaml): in step with Basel-Stadt's keys
// and communes (packages/rules-bs), every text in English, French, German and Italian, every page
// an official one, and the questions only Basel-Stadt asks (the AHV reference age, a single parent
// living as a couple, the main upkeep of a child in shared custody, each child under 18, the
// childcare per child, church membership, the work rate, payments to political parties) only where
// they apply. Synthetic answers only.
import { readFileSync } from 'node:fs';
import { Ledger } from '@taxpresso/ledger';
import { bsKeys, communeOptions } from '@taxpresso/rules-bs';
import { KEYS_CANTON_2026 } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  NBSP,
  QuestionnaireEngine,
  QuestionnaireError,
  bsQuestionnaire2026,
  sharedQuestionnaire2026,
} from '../src/index.js';

const KEYS = { ...KEYS_CANTON_2026, ...bsKeys(2026) };
const engine = () => new QuestionnaireEngine(bsQuestionnaire2026(), KEYS, communeOptions(2026));
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
const BASEL_URLS = urls('../../../docs/sources/bs/manifest.json');
const ALL_URLS = urls('../../../docs/sources/manifest.json');
const GUIDE =
  'https://media.bs.ch/original_file/909f72222b7511334f4dc4d1b9aeb74a9f5cc54c/15500-fw-np-ste-25-05-wegleitung-bf-1.pdf';

/** A single employee in Riehen (synthetic). */
const SINGLE_IN_RIEHEN = {
  canton: 'BS',
  civil_status: 'single',
  'reference_age:p1': false,
  children: 0,
  commune: 'Riehen',
  moved: 'no',
  'church:p1': false,
  'income_sources:p1': ['salary'],
  'employers:p1': 1,
  'work_rate:p1': 80,
  'residence:p1': 'swiss',
  'pillar3a:p1': true,
  'lpp_buyin:p1': false,
  'commute:p1': 'public_transport',
  'commute_transit_cost:p1': 824,
  'meal_days:p1': 180,
  banks: 1,
  crypto: false,
  payments: [],
  special: [],
};

describe('Basel-Stadt questionnaire 2026', () => {
  it('matches Basel-Stadt’s 2026 keys and communes exactly (the key-drift check)', () => {
    expect(engine().check()).toEqual([]);
    expect(communeOptions(2026)).toEqual([
      { slug: 'basel', name: 'Basel' },
      { slug: 'riehen', name: 'Riehen' },
      { slug: 'bettingen', name: 'Bettingen' },
    ]);
  });

  it('takes the questions every canton shares, in the Basel-Stadt return’s order', () => {
    const file = bsQuestionnaire2026();
    const ids = file.questions.map((q) => q.id);
    expect(ids).toEqual([
      'canton',
      'civil_status',
      'reference_age',
      'children',
      'children_custody',
      'child_support',
      'cohabiting',
      'main_upkeep',
      'child_minor',
      'childcare',
      'child_care',
      'commune',
      'moved',
      'church',
      'income_sources',
      'employers',
      'work_rate',
      'residence',
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
      'reference_age',
      'cohabiting',
      'main_upkeep',
      'child_minor',
      'child_care',
      'commune',
      'moved',
      'church',
      'work_rate',
      'party',
    ]);
    // Basel-Stadt's way to work has no "over 2 hours" choice: only Geneva's meal rule needs it.
    const options = (id: string) => file.questions.find((q) => q.id === id)!.options!;
    expect(options('commute').map((o) => o.value)).not.toContain('public_transport_long');
    expect(options('commute_transit_usable').map((o) => o.value)).toEqual(['yes', 'no']);
    // Payments to political parties are a choice of their own (line 680, form Z).
    expect(options('payments').map((o) => o.value)).toEqual([
      'medical_costs',
      'donations',
      'political_party',
      'loan_interest',
      'alimony_paid',
    ]);
    expect(file.people.child).toEqual({
      en: 'Child {n}',
      fr: 'Enfant {n}',
      de: 'Kind {n}',
      it: 'Figlio {n}',
    });
    expect(file.place).toEqual({
      en: 'Basel-Stadt',
      fr: 'Bâle-Ville',
      de: 'Basel-Stadt',
      it: 'Basilea Città',
    });
  });

  it('says everything in English, French, German and Italian, with an official page', () => {
    const file = bsQuestionnaire2026();
    const missing: string[] = [];
    const visit = (v: unknown, where: string): void => {
      if (Array.isArray(v)) return v.forEach((x, i) => visit(x, `${where}[${i}]`));
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if (typeof o.en === 'string' && typeof o.fr === 'string') {
          if (typeof o.de !== 'string' || !o.de) missing.push(where);
          if (typeof o.it !== 'string' || !o.it) missing.push(`${where} (it)`);
          return;
        }
        for (const [k, x] of Object.entries(o)) visit(x, `${where}.${k}`);
      }
    };
    visit(file, 'bs');
    expect(missing).toEqual([]);
    // No em-dash anywhere, no amount or limit in a question's own words.
    const all = JSON.stringify(file);
    expect(all).not.toMatch(/—/);
    expect(JSON.stringify(file.questions.map((q) => [q.text, q.explain]))).not.toMatch(
      /CHF|Fr\.|franc/i,
    );
    for (const item of [...file.questions, ...file.requirements]) {
      expect(item.explain?.de, item.id).toBeTruthy();
      expect(item.explain?.it, item.id).toBeTruthy();
      const { url, label } = item.learnMore!;
      expect(label.it, item.id).toBeTruthy();
      // Basel-Stadt's own documents; the canton question keeps its federal page (shared).
      expect(
        item.id === 'canton' || item.id === 'residence' ? ALL_URLS : BASEL_URLS,
        item.id,
      ).toContain(url.replace(/#page=\d+$/, ''));
      // A page of the guide is named by the page the link opens; the guide is in German.
      const page = /15500-fw-np-ste-25-05-wegleitung-bf-1\.pdf#page=(\d+)$/.exec(url)?.[1];
      if (page) {
        expect(url, item.id).toBe(`${GUIDE}#page=${page}`);
        expect(label.en, item.id).toMatch(
          new RegExp(`^Basel-Stadt tax guide 2025, p\\. ${page}: .*, in German$`),
        );
        expect(label.fr, item.id).toMatch(
          new RegExp(`^Guide fiscal de Bâle-Ville 2025, p\\. ${page}${NBSP}: .*, en allemand$`),
        );
        expect(label.de, item.id).toMatch(
          new RegExp(`^Wegleitung zur Steuererklärung 2025, S\\. ${page}: `),
        );
        expect(label.it, item.id).toMatch(
          new RegExp(`^Guida fiscale di Basilea Città 2025, p\\. ${page}: .*, in tedesco$`),
        );
      }
    }
    // Every document cites Basel-Stadt's documents, by the page of the PDF.
    for (const r of file.requirements) {
      expect(r.source, r.id).toMatch(
        /^bs-\d{4}-[a-z0-9-]+ p\. \d+([,;] (bs-[a-z0-9-]+ )?p\. \d+)*$/,
      );
    }
    // Informal German: no "Sie" addressed to the user in Taxpresso's text (the form's own question
    // on page 1, section 3, aside).
    const de = JSON.stringify(file.questions.map((q) => [q.text, q.help, q.explain])).replaceAll(
      'Leben Sie in einer Konkubinatspartnerschaft mit gemeinsamen / nicht gemeinsamen Kindern?',
      '',
    );
    expect(de).not.toMatch(/\b(Ihr|Ihre|Ihrem|Ihren|Ihrer|Ihnen|Sie haben|haben Sie|Leben Sie)\b/);
    expect(file.questions.find((q) => q.id === 'reference_age')!.text).toMatchObject({
      de: 'Hattest du am 31. Dezember 2026 das AHV-Referenzalter erreicht?',
      fr: `Aviez-vous atteint l’âge de référence AVS au 31 décembre 2026${NBSP}?`,
    });
    expect(file.notSupported.en).toMatch(/BalTax Online/);
    expect(file.notSupported.de).toMatch(/eSteuern\.BS/);
  });

  it('asks a single employee in Riehen 20 questions, then lists what is missing', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    const asked = walk(e, ledger, SINGLE_IN_RIEHEN);
    expect(asked).toEqual(Object.keys(SINGLE_IN_RIEHEN));
    expect(ledger.get('profile.commune')?.value).toBe('riehen');
    expect(ledger.get('bs.work_rate', 'p1')?.value).toBe(80);
    const snap = e.snapshot(ledger);
    expect(e.next(snap)).toBeUndefined();
    expect(e.notSupported(snap)).toEqual([]);
    expect(e.chips(snap, 'en')).toEqual([
      'Basel-Stadt',
      'Single',
      'No children',
      'Riehen',
      '1 employer',
      'Pays into 3a',
      '1 bank',
    ]);
    expect(e.requirements(snap, []).map((r) => [r.id, r.source])).toEqual([
      ['salary_certificate:p1', 'bs-2025-guide-wegleitung p. 19'],
      ['pillar3a:p1', 'bs-2025-guide-wegleitung p. 33'],
      ['health_premiums:p1', 'bs-2025-guide-wegleitung p. 35'],
      ['banks', 'bs-2025-guide-wegleitung p. 24, p. 40'],
    ]);
  });

  it('asks the reference age only of someone filing alone', () => {
    const e = engine();
    const married = new Ledger(2026, KEYS);
    walk(e, married, { canton: 'BS', civil_status: 'married' });
    expect(e.next(e.snapshot(married))?.id).toBe('children');
    expect(slotIds(e, married)).not.toContain('reference_age:p1');
    for (const status of ['single', 'separated', 'divorced', 'widowed']) {
      const ledger = new Ledger(2026, KEYS);
      walk(e, ledger, { canton: 'BS', civil_status: status });
      expect(e.next(e.snapshot(ledger))?.id, status).toBe('reference_age:p1');
    }
  });

  it('asks a single parent about living as a couple and, with shared custody, the main upkeep', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'BS',
      civil_status: 'divorced',
      'reference_age:p1': false,
      children: 2,
      children_custody: 'shared',
      child_support: 'none_unsure',
    });
    expect(e.next(e.snapshot(ledger))?.id).toBe('cohabiting');
    e.answer(ledger, 'cohabiting', false, USER);
    expect(e.next(e.snapshot(ledger))?.id).toBe('main_upkeep');
    e.answer(ledger, 'main_upkeep', true, USER);
    expect(ledger.get('bs.main_upkeep')?.value).toBe(true);
    // Each child under 18, asked per child.
    expect(slotIds(e, ledger)).toEqual(
      expect.arrayContaining(['child_minor:child1', 'child_minor:child2']),
    );
    expect(e.next(e.snapshot(ledger))?.id).toBe('child_minor:child1');
    // Paying child support: the other parent counts the children, no main upkeep asked.
    e.answer(ledger, 'child_support', 'i_pay', USER);
    expect(slotIds(e, ledger)).not.toContain('main_upkeep');
    // Living as a couple with children: not supported yet, said plainly.
    e.answer(ledger, 'cohabiting', true, USER);
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.what.en)).toEqual([
      'A single parent living as a couple with children (Konkubinat mit Kindern)',
    ]);
    // Married: neither question; children mostly with the other parent: none either.
    e.answer(ledger, 'civil_status', 'married', USER);
    expect(slotIds(e, ledger)).not.toContain('cohabiting');
    expect(slotIds(e, ledger)).not.toContain('main_upkeep');
    e.answer(ledger, 'children_custody', 'elsewhere', USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_minor'))).toEqual([]);
  });

  it('asks the childcare once per child when there are several, with the child’s number', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    answerAll(e, ledger, [
      ['canton', 'BS'],
      ['civil_status', 'married'],
      ['children', 2],
      ['children_custody', 'with_household'],
      ['childcare', 'creche_or_daycare'],
    ]);
    const snap = e.snapshot(ledger);
    const slots = snap.slots.filter((s) => s.question.id === 'child_care');
    expect(slots.map((s) => s.id)).toEqual(['child_care:child1', 'child_care:child2']);
    const second = e.render(slots[1]!, snap, 'en');
    expect(second.who).toBe('Child 2');
    expect(second.text).toBe('How much of the childcare you paid in 2026 was for child 2?');
    for (const lang of ['en', 'fr', 'de', 'it'] as const) {
      const r = e.render(slots[0]!, snap, lang);
      expect(JSON.stringify([r.text, r.help, r.explain, r.who])).not.toMatch(/\{n\}/);
    }
    e.answer(ledger, 'child_care:child2', "12'000", USER);
    expect(ledger.get('bs.child_care', 'child2')?.value).toBe(1_200_000);
    // One child: the invoices' total is that child's, not asked.
    e.answer(ledger, 'children', 1, USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_care'))).toEqual([]);
  });

  it('asks the work rate of each person with a salary, and the parties only when there were some', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    answerAll(e, ledger, [
      ['canton', 'BS'],
      ['civil_status', 'married'],
      ['income_sources:p1', ['salary']],
      ['income_sources:p2', ['pension']],
      ['payments', ['donations']],
    ]);
    const ids = slotIds(e, ledger);
    expect(ids).toContain('work_rate:p1');
    expect(ids).not.toContain('work_rate:p2');
    expect(() => e.answer(ledger, 'work_rate:p1', 120, USER)).toThrow(QuestionnaireError);
    expect(ids).not.toContain('party');
    e.answer(ledger, 'payments', ['political_party'], USER);
    expect(slotIds(e, ledger)).toContain('party');
    e.answer(ledger, 'party', 500, USER);
    expect(ledger.get('bs.party')?.value).toBe(50_000);
    // The receipts of both are asked for together.
    expect(e.requirements(e.snapshot(ledger), []).map((r) => r.id)).toContain('donations');
  });

  it('says plainly what Basel-Stadt doesn’t cover yet', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'BS',
      civil_status: 'single',
      'reference_age:p1': false,
      children: 0,
      commune: 'Bettingen',
      moved: 'from_abroad',
      'church:p1': true,
      'income_sources:p1': ['salary', 'self_employment'],
      'employers:p1': 1,
      'work_rate:p1': 100,
      'residence:p1': 'permit_other',
    });
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.what.de)).toEqual([
      'Ein Zuzug aus dem Ausland während des Jahres',
      'Die selbstständige Erwerbstätigkeit (Ziffern 150 bis 175)',
      'Die Quellensteuer in Basel-Stadt und die nachträgliche ordentliche Veranlagung (NOV)',
    ]);
    expect(e.notSupportedMessage('en')).toMatch(/BalTax Online/);
    // A move from another canton is supported: Basel-Stadt taxes the whole year.
    e.answer(ledger, 'moved', 'from_other_canton', USER);
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.slotId)).not.toContain('moved');
    expect(() => e.answer(ledger, 'moved', 'within_zurich', USER)).toThrow(QuestionnaireError);
    expect(() => e.answer(ledger, 'commune', 'Liestal', USER)).toThrow(/not a Basel-Stadt commune/);
  });
});
