// The Fribourg questionnaire (data/fr/2026/questionnaire.yaml): in step with Fribourg's keys and
// communes (packages/rules-fr), every text in English, French, German and Italian, every page an
// official one, and the questions only Fribourg asks (each child's age band and childcare, the
// commune and the move, each adult's church and the parish, the premium subsidy, life insurance,
// savings interest) only where they apply. Synthetic answers only.
import { readFileSync } from 'node:fs';
import { Ledger } from '@taxpresso/ledger';
import { KEYS_CANTON_2026 } from '@taxpresso/rules-ch';
import { communeOptions, frKeys, parishOptions } from '@taxpresso/rules-fr';
import { describe, expect, it } from 'vitest';
import {
  frQuestionnaire2026,
  NBSP,
  QuestionnaireEngine,
  QuestionnaireError,
  sharedQuestionnaire2026,
} from '../src/index.js';

const KEYS = { ...KEYS_CANTON_2026, ...frKeys(2026) };
const engine = () => new QuestionnaireEngine(frQuestionnaire2026(), KEYS, communeOptions(2026));
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
const FR_URLS = urls('../../../docs/sources/fr/manifest.json');
const ALL_URLS = urls('../../../docs/sources/manifest.json');
const GUIDE = 'https://www.fr.ch/document/57721';

/** A single employee in Fribourg (synthetic). */
const SINGLE_IN_FRIBOURG = {
  canton: 'FR',
  civil_status: 'single',
  children: 0,
  commune: 'Fribourg',
  moved: 'no',
  'church:p1': 'none',
  'income_sources:p1': ['salary'],
  'employers:p1': 1,
  'residence:p1': 'swiss',
  'commute:p1': 'public_transport',
  'commute_transit_cost:p1': 900,
  'meal_days:p1': 200,
  banks: 1,
  crypto: false,
  health_subsidy: 0,
  life_insurance: 0,
  'pillar3a:p1': true,
  'lpp_buyin:p1': false,
  savings_interest: 20,
  payments: [],
  special: [],
};

describe('Fribourg questionnaire 2026', () => {
  it('matches Fribourg’s 2026 keys and communes exactly (the key-drift check)', () => {
    expect(engine().check()).toEqual([]);
    expect(communeOptions(2026)).toHaveLength(119);
    const file = frQuestionnaire2026();
    const options = (id: string) => file.questions.find((q) => q.id === id)!.options!;
    expect(options('church').map((o) => o.value)).toEqual(['catholic', 'reformed', 'none']);
    expect(options('child_age').map((o) => o.value)).toEqual([
      'under14',
      'minor',
      'young',
      'adult',
    ]);
    // The parish options are rules-fr's, each offered in its own commune for its own church.
    expect(options('parish').map((o) => o.value)).toEqual(parishOptions(2026).map((o) => o.value));
    for (const o of options('parish')) {
      const [bfs, church] = o.value.split(':');
      expect(JSON.stringify(o.when), o.value).toContain(`"eq":"${bfs}"`);
      expect(JSON.stringify(o.when), o.value).toContain(`"in":["${church}"]`);
    }
  });

  it('takes the questions every canton shares, in the order of the return', () => {
    const file = frQuestionnaire2026();
    const ids = file.questions.map((q) => q.id);
    expect(ids).toEqual([
      'canton',
      'civil_status',
      'children',
      'children_custody',
      'child_support',
      'child_age',
      'childcare',
      'child_care',
      'commune',
      'moved',
      'church',
      'parish',
      'income_sources',
      'employers',
      'residence',
      'taxed_at_source',
      'commute',
      'commute_transit_cost',
      'commute_transit_usable',
      'commute_transit_equivalent',
      'commute_distance',
      'commute_drive_days',
      'meal_days',
      'banks',
      'crypto',
      'health_subsidy',
      'life_insurance',
      'pillar3a',
      'lpp_buyin',
      'savings_interest',
      'payments',
      'special',
    ]);
    const shared = new Set(sharedQuestionnaire2026().questions.map((q) => q.id));
    expect(ids.filter((id) => !shared.has(id))).toEqual([
      'child_age',
      'child_care',
      'commune',
      'moved',
      'church',
      'parish',
      'health_subsidy',
      'life_insurance',
      'savings_interest',
    ]);
    const options = (id: string) => file.questions.find((q) => q.id === id)!.options!;
    expect(options('commute').map((o) => o.value)).not.toContain('public_transport_long');
    expect(options('commute_transit_usable').map((o) => o.value)).toEqual(['yes', 'no']);
    // No attestation of health premiums: Fribourg deducts a flat amount.
    expect(file.requirements.map((r) => r.id)).not.toContain('health_premiums');
    expect(file.place).toEqual({ en: 'Fribourg', fr: 'Fribourg', de: 'Freiburg', it: 'Friburgo' });
  });

  it('says everything in English, French, German and Italian, with an official page', () => {
    const file = frQuestionnaire2026();
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
    visit(file, 'fr');
    expect(missing).toEqual([]);
    expect(missingIt).toEqual([]);
    const all = JSON.stringify(file);
    expect(all).not.toMatch(/—/);
    expect(JSON.stringify(file.questions.map((q) => [q.text, q.explain]))).not.toMatch(
      /CHF|Fr\.|franc/i,
    );
    for (const item of [...file.questions, ...file.requirements]) {
      expect(item.explain?.de, item.id).toBeTruthy();
      const { url, label } = item.learnMore!;
      // Fribourg's own documents; the canton question keeps its federal page (shared).
      expect(
        item.id === 'canton' || item.id === 'residence' ? ALL_URLS : FR_URLS,
        item.id,
      ).toContain(url.replace(/#page=\d+$/, ''));
      // A page of the guide is named by the page the link opens.
      if (url.startsWith(`${GUIDE}#page=`)) {
        const page = url.slice(`${GUIDE}#page=`.length);
        expect(label.en, item.id).toMatch(new RegExp(`^Fribourg tax guide 2025, p\\. ${page}: `));
        expect(label.fr, item.id).toMatch(
          new RegExp(`^Instructions générales 2025, p\\. ${page}${NBSP}: `),
        );
        expect(label.de, item.id).toMatch(new RegExp(`^Wegleitung Freiburg 2025, S\\. ${page}: `));
      }
    }
    for (const r of file.requirements) {
      expect(r.source, r.id).toMatch(/^fr-2025-guide-instructions-generales p\. \d+(, p\. \d+)*$/);
    }
    const de = JSON.stringify(file.questions.map((q) => [q.text, q.help, q.explain]));
    expect(de).not.toMatch(/\b(Ihr|Ihre|Ihrem|Ihren|Ihrer|Ihnen|Sie haben|haben Sie)\b/);
    expect(file.notSupported.en).toMatch(/FriTax/);
    expect(file.notSupported.de).toMatch(/fr\.ch\/fritax/);
  });

  it('asks a single employee in Fribourg 21 questions, then lists what is missing', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    const asked = walk(e, ledger, SINGLE_IN_FRIBOURG);
    expect(asked).toEqual(Object.keys(SINGLE_IN_FRIBOURG));
    expect(ledger.get('profile.commune')?.value).toBe('2196');
    expect(ledger.get('fr.savings_interest')?.value).toBe(2_000);
    const snap = e.snapshot(ledger);
    expect(e.next(snap)).toBeUndefined();
    expect(e.notSupported(snap)).toEqual([]);
    expect(e.chips(snap, 'en')).toEqual([
      'Fribourg',
      'Single',
      'No children',
      'Fribourg',
      '1 employer',
      '1 bank',
      'Pays into 3a',
    ]);
    expect(e.requirements(snap, []).map((r) => [r.id, r.source])).toEqual([
      ['salary_certificate:p1', 'fr-2025-guide-instructions-generales p. 8'],
      ['pillar3a:p1', 'fr-2025-guide-instructions-generales p. 25'],
      ['banks', 'fr-2025-guide-instructions-generales p. 15'],
    ]);
  });

  it('finds a commune by its name, accents and case aside, and refuses another canton’s', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, { canton: 'FR', civil_status: 'married', children: 0 });
    e.answer(ledger, 'commune', 'Düdingen', USER);
    expect(ledger.get('profile.commune')?.value).toBe('2293');
    e.answer(ledger, 'commune', 'BULLE', USER);
    expect(ledger.get('profile.commune')?.value).toBe('2125');
    expect(() => e.answer(ledger, 'commune', 'Lausanne', USER)).toThrow(QuestionnaireError);
  });

  it('asks each child’s age, and the childcare per child only with several', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'FR',
      civil_status: 'married',
      children: 2,
      children_custody: 'with_household',
    });
    let snap = e.snapshot(ledger);
    expect(snap.slots.filter((s) => s.question.id === 'child_age').map((s) => s.id)).toEqual([
      'child_age:child1',
      'child_age:child2',
    ]);
    const second = snap.slots.find((s) => s.id === 'child_age:child2')!;
    expect(e.render(second, snap, 'en').text).toBe('How old was child 2 at the end of 2026?');
    for (const lang of ['en', 'fr', 'de'] as const) {
      const r = e.render(second, snap, lang);
      expect(JSON.stringify([r.text, r.help, r.explain, r.who])).not.toMatch(/\{n\}/);
    }
    e.answer(ledger, 'child_age:child1', 'young', USER);
    e.answer(ledger, 'child_age:child2', 'under14', USER);
    expect(ledger.get('fr.child_age', 'child1')?.value).toBe('young');
    e.answer(ledger, 'childcare', 'creche_or_daycare', USER);
    snap = e.snapshot(ledger);
    expect(snap.slots.filter((s) => s.question.id === 'child_care').map((s) => s.id)).toEqual([
      'child_care:child1',
      'child_care:child2',
    ]);
    e.answer(ledger, 'child_care:child2', "9'000", USER);
    expect(ledger.get('fr.child_care', 'child2')?.value).toBe(900_000);
    // An adult child: not supported (no flat health amount for them).
    e.answer(ledger, 'child_age:child1', 'adult', USER);
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.what.en)).toContainEqual(
      expect.stringMatching(/A child over 25/),
    );
    // One child: the invoices' total is that child's, not asked.
    e.answer(ledger, 'children', 1, USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_care'))).toEqual([]);
    // Children mostly with the other parent: nothing asked about them.
    e.answer(ledger, 'children_custody', 'elsewhere', USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_'))).toEqual([]);
  });

  it('asks each adult’s church, and the parish only where the commune’s parishes differ', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'FR',
      civil_status: 'married',
      children: 0,
      commune: 'Düdingen',
      moved: 'no',
      'church:p1': 'reformed',
      'church:p2': 'reformed',
    });
    const snap = e.snapshot(ledger);
    const slot = snap.slots.find((s) => s.id === 'parish')!;
    expect(e.render(slot, snap, 'en').options?.map((o) => o.value)).toEqual([
      '2293:reformed:Düdingen',
      '2293:reformed:St. Antoni',
    ]);
    e.answer(ledger, 'parish', '2293:reformed:St. Antoni', USER);
    expect(ledger.get('fr.parish')?.value).toBe('2293:reformed:St. Antoni');
    // A commune with one parish of the church: not asked.
    e.answer(ledger, 'commune', 'Fribourg', USER);
    expect(slotIds(e, ledger)).not.toContain('parish');
    // No church: not asked.
    e.answer(ledger, 'commune', 'Düdingen', USER);
    e.answer(ledger, 'church:p1', 'none', USER);
    e.answer(ledger, 'church:p2', 'none', USER);
    expect(slotIds(e, ledger)).not.toContain('parish');
  });

  it('says plainly what Fribourg doesn’t cover yet', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'FR',
      civil_status: 'divorced',
      children: 1,
      children_custody: 'shared',
      child_support: 'none_i_earn_more',
      'child_age:child1': 'under14',
      childcare: 'none',
      commune: 'Bulle',
      moved: 'within_fr',
      'church:p1': 'none',
      'income_sources:p1': ['salary', 'self_employment'],
      'employers:p1': 1,
      'residence:p1': 'permit_other',
    });
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.what.de)).toEqual([
      'Alternierende Obhut ohne Unterhaltsbeiträge (garde alternée sans contribution d’entretien): Die Freiburger Dokumente widersprechen sich, wer die Kinder zählt',
      'Ein Umzug zwischen Freiburger Gemeinden während des Jahres (die Gemeindesteuer wird zwischen ihnen aufgeteilt)',
      'Die selbständige Erwerbstätigkeit (activité indépendante, Codes 1.210 und 1.220)',
      'Die Quellensteuer im Kanton Freiburg (impôt à la source) und die nachträgliche ordentliche Veranlagung (taxation ordinaire ultérieure, TOU)',
    ]);
    expect(e.notSupportedMessage('en')).toMatch(/FriTax/);
    // A move from another canton is supported: Fribourg taxes the whole year.
    e.answer(ledger, 'moved', 'from_other_canton', USER);
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.slotId)).not.toContain('moved');
    expect(() => e.answer(ledger, 'moved', 'within_lu', USER)).toThrow(QuestionnaireError);
  });
});
