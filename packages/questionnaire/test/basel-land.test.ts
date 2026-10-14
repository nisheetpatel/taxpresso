// The Basel-Landschaft questionnaire (data/bl/2026/questionnaire.yaml): in step with Basel-Landschaft's
// keys and communes (packages/rules-bl), every text in English, French and German, every page an
// official one, and the questions only Basel-Landschaft asks (who mainly bears a shared child's
// upkeep, each child's own income and childcare, the church, the kind of pension) only where they
// apply. Synthetic answers only.
import { readFileSync } from 'node:fs';
import { Ledger } from '@taxpresso/ledger';
import { blKeys, communeOptions } from '@taxpresso/rules-bl';
import { KEYS_CANTON_2026 } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  NBSP,
  QuestionnaireEngine,
  QuestionnaireError,
  blQuestionnaire2026,
  sharedQuestionnaire2026,
} from '../src/index.js';

const KEYS = { ...KEYS_CANTON_2026, ...blKeys(2026) };
const engine = () => new QuestionnaireEngine(blQuestionnaire2026(), KEYS, communeOptions(2026));
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
const BL_URLS = urls('../../../docs/sources/bl/manifest.json');
const ALL_URLS = urls('../../../docs/sources/manifest.json');
const GUIDE =
  'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/onlineformulare-merkblaetter-formulare-wegleitungen/unselbstaendigerwerbende-2026/wegleitung-zur-steuererklaerung-2026_int_2_w_2026_260320.pdf';
const BOOK =
  'https://kanton.baselland.ch/finanz-und-kirchendirektion/steuerverwaltung-steuerbuch/downloads-1/steuerbuch_bl_band1.pdf';

/** A single employee in Liestal (synthetic). */
const SINGLE_IN_LIESTAL = {
  canton: 'BL',
  civil_status: 'single',
  children: 0,
  commune: 'Liestal',
  moved: 'no',
  'church:p1': 'none',
  'income_sources:p1': ['salary'],
  'employers:p1': 1,
  'taxed_at_source:p1': false,
  'pillar3a:p1': true,
  'lpp_buyin:p1': false,
  'commute:p1': 'public_transport',
  'commute_transit_cost:p1': 1_032,
  'meal_days:p1': 200,
  banks: 1,
  crypto: false,
  payments: [],
  special: [],
};

describe('Basel-Landschaft questionnaire 2026', () => {
  it('matches Basel-Landschaft’s 2026 keys and communes exactly (the key-drift check)', () => {
    expect(engine().check()).toEqual([]);
    expect(communeOptions(2026)).toHaveLength(86);
  });

  it('takes the questions every canton shares, in the return’s order', () => {
    const file = blQuestionnaire2026();
    const ids = file.questions.map((q) => q.id);
    expect(ids).toEqual([
      'canton',
      'civil_status',
      'children',
      'children_custody',
      'child_support',
      'main_upkeep',
      'child_income',
      'childcare',
      'child_care',
      'commune',
      'moved',
      'church',
      'income_sources',
      'pension_kind',
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
      'special',
    ]);
    const shared = new Set(sharedQuestionnaire2026().questions.map((q) => q.id));
    expect(ids.filter((id) => !shared.has(id))).toEqual([
      'main_upkeep',
      'child_income',
      'child_care',
      'commune',
      'moved',
      'church',
      'pension_kind',
    ]);
    // No "over 2 hours" choice on the way to work: only Geneva's meal rule needs it.
    const options = (id: string) => file.questions.find((q) => q.id === id)!.options!;
    expect(options('commute').map((o) => o.value)).not.toContain('public_transport_long');
    expect(options('commute_transit_usable').map((o) => o.value)).toEqual(['yes', 'no']);
    expect(file.people.child).toEqual({ en: 'Child {n}', fr: 'Enfant {n}', de: 'Kind {n}' });
    expect(file.place).toEqual({
      en: 'Basel-Landschaft',
      fr: 'Bâle-Campagne',
      de: 'Basel-Landschaft',
    });
  });

  it('says everything in English, French and German, with an official page', () => {
    const file = blQuestionnaire2026();
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
    visit(file, 'bl');
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
      // Basel-Landschaft's own documents; the canton question keeps its federal page (shared).
      expect(item.id === 'canton' ? ALL_URLS : BL_URLS, item.id).toContain(
        url.replace(/#page=\d+$/, ''),
      );
      // A page of the guide is named by the page the link opens.
      if (url.startsWith(`${GUIDE}#page=`)) {
        const page = url.slice(`${GUIDE}#page=`.length);
        expect(label.en, item.id).toMatch(
          new RegExp(`^Basel-Landschaft tax guide 2026, p\\. ${page}: `),
        );
        expect(label.fr, item.id).toMatch(
          new RegExp(`^Guide fiscal de Bâle-Campagne 2026, p\\. ${page}${NBSP}: `),
        );
        expect(label.de, item.id).toMatch(
          new RegExp(`^Wegleitung zur Steuererklärung 2026, S\\. ${page}: `),
        );
      }
      if (url.startsWith(`${BOOK}#page=`)) {
        expect(label.en, item.id).toMatch(
          /^Basel-Landschaft tax handbook \(Steuerbuch\), p\. \d+: /,
        );
      }
    }
    // Every document cites the Basel-Landschaft guide, by the page of the PDF.
    for (const r of file.requirements) {
      expect(r.source, r.id).toMatch(/^bl-2026-wegleitung p\. \d+(, p\. \d+)*$/);
    }
    // Informal German: no "Sie" addressed to the user in Taxpresso's text (the form's own words
    // aside).
    const de = JSON.stringify(file.questions.map((q) => [q.text, q.help, q.explain]))
      .replaceAll('In Ihrem Haushalt lebend?', '')
      .replaceAll('deren Unterhalt Sie zur Hauptsache bestreiten', '');
    expect(de).not.toMatch(/\b(Ihr|Ihre|Ihrem|Ihren|Ihrer|Ihnen|Sie haben|haben Sie)\b/);
    expect(file.notSupported.en).toMatch(/E-Tax BL/);
    expect(file.notSupported.de).toMatch(/etax\.bl\.ch/);
  });

  it('asks a single employee in Liestal 18 questions, then lists what is missing', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    const asked = walk(e, ledger, SINGLE_IN_LIESTAL);
    expect(asked).toEqual(Object.keys(SINGLE_IN_LIESTAL));
    expect(ledger.get('profile.commune')?.value).toBe('liestal');
    const snap = e.snapshot(ledger);
    expect(e.next(snap)).toBeUndefined();
    expect(e.notSupported(snap)).toEqual([]);
    expect(e.chips(snap, 'en')).toEqual([
      'Basel-Landschaft',
      'Single',
      'No children',
      'Liestal',
      '1 employer',
      'Pays into 3a',
      '1 bank',
    ]);
    expect(e.requirements(snap, []).map((r) => [r.id, r.source])).toEqual([
      ['salary_certificate:p1', 'bl-2026-wegleitung p. 12'],
      ['pillar3a:p1', 'bl-2026-wegleitung p. 30'],
      ['health_premiums:p1', 'bl-2026-wegleitung p. 31'],
      ['banks', 'bl-2026-wegleitung p. 46'],
    ]);
  });

  it('finds a commune by its name, accents and punctuation aside, and refuses another canton’s', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, { canton: 'BL', civil_status: 'married', children: 0 });
    e.answer(ledger, 'commune', 'munchenstein', USER);
    expect(ledger.get('profile.commune')?.value).toBe('munchenstein');
    e.answer(ledger, 'commune', 'Burg i.L.', USER);
    expect(ledger.get('profile.commune')?.value).toBe('burg-i-l');
    expect(() => e.answer(ledger, 'commune', 'Carouge', USER)).toThrow(QuestionnaireError);
  });

  it('asks who mainly bears the upkeep only in shared custody without child support', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'BL',
      civil_status: 'divorced',
      children: 2,
      children_custody: 'shared',
      child_support: 'none_i_earn_more',
    });
    expect(e.next(e.snapshot(ledger))?.id).toBe('main_upkeep');
    e.answer(ledger, 'main_upkeep', true, USER);
    expect(ledger.get('bl.main_upkeep')?.value).toBe(true);
    for (const support of ['i_receive', 'i_pay']) {
      e.answer(ledger, 'child_support', support, USER);
      expect(slotIds(e, ledger)).not.toContain('main_upkeep');
    }
    e.answer(ledger, 'child_support', 'none_unsure', USER);
    e.answer(ledger, 'children_custody', 'with_household', USER);
    expect(slotIds(e, ledger)).not.toContain('main_upkeep');
  });

  it('asks each child’s own income, and the childcare per child only with several children', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'BL',
      civil_status: 'married',
      children: 2,
      children_custody: 'with_household',
    });
    let snap = e.snapshot(ledger);
    expect(snap.slots.filter((s) => s.question.id === 'child_income').map((s) => s.id)).toEqual([
      'child_income:child1',
      'child_income:child2',
    ]);
    const second = snap.slots.find((s) => s.id === 'child_income:child2')!;
    expect(e.render(second, snap, 'en').text).toBe(
      'In 2026, did child 2 have taxable income of their own above the tax-free amount (steuerfreier Betrag)?',
    );
    for (const lang of ['en', 'fr', 'de'] as const) {
      const r = e.render(second, snap, lang);
      expect(JSON.stringify([r.text, r.help, r.explain, r.who])).not.toMatch(/\{n\}/);
    }
    e.answer(ledger, 'child_income:child1', false, USER);
    e.answer(ledger, 'child_income:child2', true, USER);
    expect(ledger.get('bl.child_income', 'child2')?.value).toBe(true);
    e.answer(ledger, 'childcare', 'creche_or_daycare', USER);
    snap = e.snapshot(ledger);
    expect(snap.slots.filter((s) => s.question.id === 'child_care').map((s) => s.id)).toEqual([
      'child_care:child1',
      'child_care:child2',
    ]);
    e.answer(ledger, 'child_care:child1', "9'000", USER);
    expect(ledger.get('bl.child_care', 'child1')?.value).toBe(900_000);
    // One child: the invoices' total is that child's, not asked.
    e.answer(ledger, 'children', 1, USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_care'))).toEqual([]);
    // Children mostly with the other parent: not asked at all.
    e.answer(ledger, 'children_custody', 'elsewhere', USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_income'))).toEqual([]);
  });

  it('asks each pensioner’s kind of pension, and the church of each adult', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'BL',
      civil_status: 'married',
      children: 0,
      commune: 'Binningen',
      moved: 'no',
      'church:p1': 'catholic',
      'church:p2': 'reformed',
      'income_sources:p1': ['pension'],
      'pension_kind:p1': 'ahv',
      'income_sources:p2': ['salary'],
    });
    expect(ledger.get('bl.church', 'p2')?.value).toBe('reformed');
    expect(ledger.get('bl.pension_kind', 'p1')?.value).toBe('ahv');
    expect(slotIds(e, ledger)).not.toContain('pension_kind:p2');
  });

  it('says plainly what Basel-Landschaft doesn’t cover yet', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'BL',
      civil_status: 'single',
      children: 0,
      commune: 'Pratteln',
      moved: 'from_abroad',
      'church:p1': 'none',
      'income_sources:p1': ['salary', 'self_employment'],
      'employers:p1': 1,
      'taxed_at_source:p1': true,
    });
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.what.de)).toEqual([
      'Ein Zuzug aus dem Ausland während des Jahres',
      'Die selbständige Erwerbstätigkeit (150 bis 165)',
      'Die Quellensteuer im Kanton Basel-Landschaft und die nachträgliche ordentliche Veranlagung (NOV)',
    ]);
    expect(e.notSupportedMessage('en')).toMatch(/E-Tax BL/);
    // A move from another canton is supported: Basel-Landschaft taxes the whole year.
    e.answer(ledger, 'moved', 'from_other_canton', USER);
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.slotId)).not.toContain('moved');
    expect(() => e.answer(ledger, 'moved', 'within_bern', USER)).toThrow(QuestionnaireError);
  });
});
