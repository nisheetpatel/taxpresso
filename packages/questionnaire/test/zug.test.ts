// The Zug questionnaire (data/zg/2026/questionnaire.yaml): in step with Zug's keys and communes
// (packages/rules-zg), every text in English, French, German and Italian, every page an official
// one, and the questions only Zug asks (who has the larger share of a shared child's care, each
// child's age and childcare, the rent, the parish and the Bürgergemeinde) only where they apply.
// Synthetic answers only.
import { readFileSync } from 'node:fs';
import { Ledger } from '@taxpresso/ledger';
import { KEYS_CANTON_2026 } from '@taxpresso/rules-ch';
import { communeOptions, zgKeys } from '@taxpresso/rules-zg';
import { describe, expect, it } from 'vitest';
import {
  NBSP,
  QuestionnaireEngine,
  QuestionnaireError,
  sharedQuestionnaire2026,
  zgQuestionnaire2026,
} from '../src/index.js';

const KEYS = { ...KEYS_CANTON_2026, ...zgKeys(2026) };
const engine = () => new QuestionnaireEngine(zgQuestionnaire2026(), KEYS, communeOptions(2026));
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

const slotIds = (e: QuestionnaireEngine, ledger: Ledger) =>
  e.snapshot(ledger).slots.map((s) => s.id);

const urls = (path: string): Set<string> => {
  const raw = JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as
    { url: string }[] | { entries: { url: string }[] };
  return new Set((Array.isArray(raw) ? raw : raw.entries).map((e) => e.url));
};
const ZG_URLS = urls('../../../docs/sources/zg/manifest.json');
const ALL_URLS = urls('../../../docs/sources/manifest.json');
const GUIDE =
  'https://cdn.zg.ch/dam/jcr:17c572af-908f-43a5-96b0-0fd25983f924/Wegleitung_2025_StKtZug_A4_20251119.pdf';

/** A single employee in Zug (synthetic). */
const SINGLE_IN_ZUG = {
  canton: 'ZG',
  civil_status: 'single',
  children: 0,
  commune: 'Zug',
  moved: 'no',
  rent: 24_000,
  'church:p1': 'none',
  'citizen_of:p1': 'none',
  'income_sources:p1': ['salary'],
  'employers:p1': 1,
  'residence:p1': 'swiss',
  'pillar3a:p1': true,
  'lpp_buyin:p1': false,
  'commute:p1': 'public_transport',
  'commute_transit_cost:p1': 729,
  'meal_days:p1': 200,
  banks: 1,
  crypto: false,
  payments: [],
  special: [],
};

describe('Zug questionnaire 2026', () => {
  it('matches Zug’s 2026 keys and communes exactly (the key-drift check)', () => {
    expect(engine().check()).toEqual([]);
    expect(communeOptions(2026)).toHaveLength(11);
    // The Bürgergemeinde question offers the 11 communes and none, as the key does.
    const file = zgQuestionnaire2026();
    const citizens = file.questions.find((q) => q.id === 'citizen_of')!;
    expect(citizens.options!.map((o) => o.value)).toEqual([
      ...communeOptions(2026).map((c) => c.slug),
      'none',
    ]);
    expect(citizens.options!.slice(0, -1).map((o) => o.label.de)).toEqual(
      communeOptions(2026).map((c) => c.name),
    );
  });

  it('takes the questions every canton shares, in the order of form K', () => {
    const file = zgQuestionnaire2026();
    const ids = file.questions.map((q) => q.id);
    expect(ids).toEqual([
      'canton',
      'civil_status',
      'children',
      'children_custody',
      'child_support',
      'main_care',
      'child_under15',
      'child_minor',
      'childcare',
      'child_care',
      'commune',
      'moved',
      'rent',
      'church',
      'citizen_of',
      'income_sources',
      'employers',
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
      'special',
    ]);
    const shared = new Set(sharedQuestionnaire2026().questions.map((q) => q.id));
    expect(ids.filter((id) => !shared.has(id))).toEqual([
      'main_care',
      'child_under15',
      'child_minor',
      'child_care',
      'commune',
      'moved',
      'rent',
      'church',
      'citizen_of',
    ]);
    // No "over 2 hours" choice on the way to work: only Geneva's meal rule needs it.
    const options = (id: string) => file.questions.find((q) => q.id === id)!.options!;
    expect(options('commute').map((o) => o.value)).not.toContain('public_transport_long');
    expect(options('commute_transit_usable').map((o) => o.value)).toEqual(['yes', 'no']);
    expect(file.people.child).toEqual({
      en: 'Child {n}',
      fr: 'Enfant {n}',
      de: 'Kind {n}',
      it: 'Figlio {n}',
    });
    expect(file.place).toEqual({ en: 'Zug', fr: 'Zoug', de: 'Zug', it: 'Zugo' });
  });

  it('says everything in English, French, German and Italian, with an official page', () => {
    const file = zgQuestionnaire2026();
    const missing: string[] = [];
    const missingIt: string[] = [];
    const visit = (v: unknown, where: string): void => {
      if (Array.isArray(v)) return v.forEach((x, i) => visit(x, `${where}[${i}]`));
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if (typeof o.en === 'string' && typeof o.fr === 'string') {
          if (typeof o.de !== 'string' || !o.de) missing.push(where);
          if (typeof o.it !== 'string' || !o.it) missingIt.push(where);
          return;
        }
        for (const [k, x] of Object.entries(o)) visit(x, `${where}.${k}`);
      }
    };
    visit(file, 'zg');
    expect(missing).toEqual([]);
    expect(missingIt).toEqual([]);
    // No em-dash anywhere, no amount or limit in a question's own words.
    const all = JSON.stringify(file);
    expect(all).not.toMatch(/—/);
    expect(JSON.stringify(file.questions.map((q) => [q.text, q.explain]))).not.toMatch(
      /CHF|Fr\.|franc/i,
    );
    for (const item of [...file.questions, ...file.requirements]) {
      expect(item.explain?.de, item.id).toBeTruthy();
      const { url, label } = item.learnMore!;
      expect(label.it, item.id).toBeTruthy();
      // Zug's own documents; the canton question keeps its federal page (shared).
      expect(
        item.id === 'canton' || item.id === 'residence' ? ALL_URLS : ZG_URLS,
        item.id,
      ).toContain(url.replace(/#page=\d+$/, ''));
      // A page of the guide is named by the page the link opens.
      if (url.startsWith(`${GUIDE}#page=`)) {
        const page = url.slice(`${GUIDE}#page=`.length);
        expect(label.en, item.id).toMatch(new RegExp(`^Zug tax guide 2025, p\\. ${page}: `));
        expect(label.fr, item.id).toMatch(
          new RegExp(`^Guide fiscal de Zoug 2025, p\\. ${page}${NBSP}: `),
        );
        expect(label.de, item.id).toMatch(
          new RegExp(`^Wegleitung zur Steuererklärung 2025, S\\. ${page}: `),
        );
      }
    }
    // Every document cites the Zug guide, by the page of the PDF.
    for (const r of file.requirements) {
      expect(r.source, r.id).toMatch(/^zg-2025-guide-wegleitung p\. \d+(, p\. \d+)*$/);
    }
    // Informal German: no "Sie" addressed to the user in Taxpresso's text.
    const de = JSON.stringify(file.questions.map((q) => [q.text, q.help, q.explain]));
    expect(de).not.toMatch(/\b(Ihr|Ihre|Ihrem|Ihren|Ihrer|Ihnen|Sie haben|haben Sie)\b/);
    expect(file.notSupported.en).toMatch(/eTax\.zug/);
    expect(file.notSupported.de).toMatch(/zg\.ch\/etax/);
  });

  it('asks a single employee in Zug 20 questions, then lists what is missing', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    const asked = walk(e, ledger, SINGLE_IN_ZUG);
    expect(asked).toEqual(Object.keys(SINGLE_IN_ZUG));
    expect(ledger.get('profile.commune')?.value).toBe('zug');
    expect(ledger.get('zg.rent')?.value).toBe(2_400_000);
    const snap = e.snapshot(ledger);
    expect(e.next(snap)).toBeUndefined();
    expect(e.notSupported(snap)).toEqual([]);
    expect(e.chips(snap, 'en')).toEqual([
      'Zug',
      'Single',
      'No children',
      'Zug',
      '1 employer',
      'Pays into 3a',
      '1 bank',
    ]);
    expect(e.requirements(snap, []).map((r) => [r.id, r.source])).toEqual([
      ['salary_certificate:p1', 'zg-2025-guide-wegleitung p. 11, p. 20'],
      ['pillar3a:p1', 'zg-2025-guide-wegleitung p. 12, p. 36'],
      ['health_premiums:p1', 'zg-2025-guide-wegleitung p. 37'],
      ['banks', 'zg-2025-guide-wegleitung p. 11, p. 23'],
    ]);
  });

  it('finds a commune by its name, accents and case aside, and refuses another canton’s', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, { canton: 'ZG', civil_status: 'married', children: 0 });
    e.answer(ledger, 'commune', 'unterageri', USER);
    expect(ledger.get('profile.commune')?.value).toBe('unterageri');
    e.answer(ledger, 'commune', 'HÜNENBERG', USER);
    expect(ledger.get('profile.commune')?.value).toBe('hunenberg');
    expect(() => e.answer(ledger, 'commune', 'Luzern', USER)).toThrow(QuestionnaireError);
  });

  it('asks who has the larger share of the care only in shared custody without child support', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'ZG',
      civil_status: 'divorced',
      children: 2,
      children_custody: 'shared',
      child_support: 'none_i_earn_more',
    });
    expect(e.next(e.snapshot(ledger))?.id).toBe('main_care');
    e.answer(ledger, 'main_care', true, USER);
    expect(ledger.get('zg.main_care')?.value).toBe(true);
    for (const support of ['i_receive', 'i_pay']) {
      e.answer(ledger, 'child_support', support, USER);
      expect(slotIds(e, ledger)).not.toContain('main_care');
    }
    e.answer(ledger, 'child_support', 'none_unsure', USER);
    e.answer(ledger, 'children_custody', 'with_household', USER);
    expect(slotIds(e, ledger)).not.toContain('main_care');
  });

  it('asks each child’s age, whether a minor only from 15, and the childcare per child only with several children', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'ZG',
      civil_status: 'married',
      children: 2,
      children_custody: 'with_household',
    });
    let snap = e.snapshot(ledger);
    expect(snap.slots.filter((s) => s.question.id === 'child_under15').map((s) => s.id)).toEqual([
      'child_under15:child1',
      'child_under15:child2',
    ]);
    const second = snap.slots.find((s) => s.id === 'child_under15:child2')!;
    expect(e.render(second, snap, 'en').text).toBe('Was child 2 under 15 on 31 December 2026?');
    for (const lang of ['en', 'fr', 'de'] as const) {
      const r = e.render(second, snap, lang);
      expect(JSON.stringify([r.text, r.help, r.explain, r.who])).not.toMatch(/\{n\}/);
    }
    e.answer(ledger, 'child_under15:child1', false, USER);
    e.answer(ledger, 'child_under15:child2', true, USER);
    // Only the child aged 15 or more: is it a minor?
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_minor'))).toEqual([
      'child_minor:child1',
    ]);
    e.answer(ledger, 'child_minor:child1', true, USER);
    expect(ledger.get('zg.child_minor', 'child1')?.value).toBe(true);
    e.answer(ledger, 'childcare', 'creche_or_daycare', USER);
    snap = e.snapshot(ledger);
    expect(snap.slots.filter((s) => s.question.id === 'child_care').map((s) => s.id)).toEqual([
      'child_care:child1',
      'child_care:child2',
    ]);
    e.answer(ledger, 'child_care:child2', "14'000", USER);
    expect(ledger.get('zg.child_care', 'child2')?.value).toBe(1_400_000);
    // One child: the invoices' total is that child's, not asked.
    e.answer(ledger, 'children', 1, USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_care'))).toEqual([]);
    // Children mostly with the other parent: no age asked.
    e.answer(ledger, 'children_custody', 'elsewhere', USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_under15'))).toEqual([]);
  });

  it('asks the parish and the Bürgergemeinde of each adult', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'ZG',
      civil_status: 'married',
      children: 0,
      commune: 'Baar',
      moved: 'no',
      rent: 0,
      'church:p1': 'catholic',
      'church:p2': 'reformed',
      'citizen_of:p1': 'baar',
      'citizen_of:p2': 'none',
    });
    expect(ledger.get('zg.church', 'p2')?.value).toBe('reformed');
    expect(ledger.get('zg.citizen_of', 'p1')?.value).toBe('baar');
    expect(ledger.get('zg.citizen_of', 'p2')?.value).toBe('none');
    expect(ledger.get('zg.rent')?.value).toBe(0);
  });

  it('says plainly what Zug doesn’t cover yet', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'ZG',
      civil_status: 'single',
      children: 0,
      commune: 'Cham',
      moved: 'from_abroad',
      rent: 18_000,
      'church:p1': 'none',
      'citizen_of:p1': 'none',
      'income_sources:p1': ['salary', 'self_employment'],
      'employers:p1': 1,
      'residence:p1': 'permit_other',
    });
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.what.de)).toEqual([
      'Ein Zuzug aus dem Ausland während des Jahres',
      'Die selbständige Erwerbstätigkeit (115 und 116)',
      'Die Quellensteuer im Kanton Zug und die nachträgliche ordentliche Veranlagung (NOV)',
    ]);
    expect(e.notSupportedMessage('en')).toMatch(/eTax\.zug/);
    // A move from another canton is supported: Zug taxes the whole year.
    e.answer(ledger, 'moved', 'from_other_canton', USER);
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.slotId)).not.toContain('moved');
    expect(() => e.answer(ledger, 'moved', 'within_bl', USER)).toThrow(QuestionnaireError);
  });
});
