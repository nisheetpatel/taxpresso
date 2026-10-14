// The Lucerne questionnaire (data/lu/2026/questionnaire.yaml): in step with Lucerne's keys and
// communes (packages/rules-lu), every text in English, French and German, every page an official
// one, and the questions only Lucerne asks (the family tariff in shared custody, each child's
// household, age, education away from home, childcare and confession, each adult's confession) only
// where they apply. Synthetic answers only.
import { readFileSync } from 'node:fs';
import { Ledger } from '@taxpresso/ledger';
import { KEYS_CANTON_2026 } from '@taxpresso/rules-ch';
import { communeOptions, luKeys } from '@taxpresso/rules-lu';
import { describe, expect, it } from 'vitest';
import {
  luQuestionnaire2026,
  NBSP,
  QuestionnaireEngine,
  QuestionnaireError,
  sharedQuestionnaire2026,
} from '../src/index.js';

const KEYS = { ...KEYS_CANTON_2026, ...luKeys(2026) };
const engine = () => new QuestionnaireEngine(luQuestionnaire2026(), KEYS, communeOptions(2026));
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
const LU_URLS = urls('../../../docs/sources/lu/manifest.json');
const ALL_URLS = urls('../../../docs/sources/manifest.json');
const GUIDE =
  'https://steuern.lu.ch/-/media/Steuern/Dokumente/Steuerformulare/2025/Wegleitung930109LU2025HADEFneu.pdf';

/** A single employee in Luzern (synthetic). */
const SINGLE_IN_LUCERNE = {
  canton: 'LU',
  civil_status: 'single',
  children: 0,
  commune: 'Luzern',
  moved: 'no',
  'church:p1': 'none',
  'income_sources:p1': ['salary'],
  'employers:p1': 1,
  'taxed_at_source:p1': false,
  'pillar3a:p1': true,
  'lpp_buyin:p1': false,
  'commute:p1': 'public_transport',
  'commute_transit_cost:p1': 900,
  'meal_days:p1': 200,
  banks: 1,
  crypto: false,
  payments: [],
  special: [],
};

describe('Lucerne questionnaire 2026', () => {
  it('matches Lucerne’s 2026 keys and communes exactly (the key-drift check)', () => {
    expect(engine().check()).toEqual([]);
    expect(communeOptions(2026)).toHaveLength(79);
    const file = luQuestionnaire2026();
    for (const id of ['church', 'child_church']) {
      expect(file.questions.find((q) => q.id === id)!.options!.map((o) => o.value)).toEqual([
        'catholic',
        'reformed',
        'christ_catholic',
        'none',
      ]);
    }
  });

  it('takes the questions every canton shares, in the order of the return', () => {
    const file = luQuestionnaire2026();
    const ids = file.questions.map((q) => q.id);
    expect(ids).toEqual([
      'canton',
      'civil_status',
      'children',
      'children_custody',
      'child_support',
      'family_tariff',
      'child_lives_with_you',
      'child_under14',
      'child_away',
      'childcare',
      'child_care',
      'commune',
      'moved',
      'church',
      'child_church',
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
      'special',
    ]);
    const shared = new Set(sharedQuestionnaire2026().questions.map((q) => q.id));
    expect(ids.filter((id) => !shared.has(id))).toEqual([
      'family_tariff',
      'child_lives_with_you',
      'child_under14',
      'child_away',
      'child_care',
      'commune',
      'moved',
      'church',
      'child_church',
    ]);
    // No "over 2 hours" choice on the way to work: only Geneva's meal rule needs it.
    const options = (id: string) => file.questions.find((q) => q.id === id)!.options!;
    expect(options('commute').map((o) => o.value)).not.toContain('public_transport_long');
    expect(options('commute_transit_usable').map((o) => o.value)).toEqual(['yes', 'no']);
    expect(file.people.child).toEqual({ en: 'Child {n}', fr: 'Enfant {n}', de: 'Kind {n}' });
    expect(file.place).toEqual({ en: 'Lucerne', fr: 'Lucerne', de: 'Luzern' });
  });

  it('says everything in English, French and German, with an official page', () => {
    const file = luQuestionnaire2026();
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
    visit(file, 'lu');
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
      // Lucerne's own documents; the canton question keeps its federal page (shared).
      expect(item.id === 'canton' ? ALL_URLS : LU_URLS, item.id).toContain(
        url.replace(/#page=\d+$/, ''),
      );
      // A page of the guide is named by the page the link opens.
      if (url.startsWith(`${GUIDE}#page=`)) {
        const page = url.slice(`${GUIDE}#page=`.length);
        expect(label.en, item.id).toMatch(new RegExp(`^Lucerne tax guide 2025, p\\. ${page}: `));
        expect(label.fr, item.id).toMatch(
          new RegExp(`^Guide fiscal de Lucerne 2025, p\\. ${page}${NBSP}: `),
        );
        expect(label.de, item.id).toMatch(
          new RegExp(`^Wegleitung zur Steuererklärung 2025, S\\. ${page}: `),
        );
      }
    }
    // Every document cites the Lucerne guide, by the page of the PDF.
    for (const r of file.requirements) {
      expect(r.source, r.id).toMatch(/^lu-2025-guide-wegleitung p\. \d+(, p\. \d+)*$/);
    }
    // Informal German: no "Sie" addressed to the user in Taxpresso's text.
    const de = JSON.stringify(file.questions.map((q) => [q.text, q.help, q.explain]));
    expect(de).not.toMatch(/\b(Ihr|Ihre|Ihrem|Ihren|Ihrer|Ihnen|Sie haben|haben Sie)\b/);
    expect(file.notSupported.en).toMatch(/eSteuern\.LU/);
    expect(file.notSupported.de).toMatch(/esteuern\.lu\.ch/);
  });

  it('asks a single employee in Lucerne 17 questions, then lists what is missing', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    const asked = walk(e, ledger, SINGLE_IN_LUCERNE);
    expect(asked).toEqual(Object.keys(SINGLE_IN_LUCERNE));
    expect(ledger.get('profile.commune')?.value).toBe('luzern');
    const snap = e.snapshot(ledger);
    expect(e.next(snap)).toBeUndefined();
    expect(e.notSupported(snap)).toEqual([]);
    expect(e.chips(snap, 'en')).toEqual([
      'Lucerne',
      'Single',
      'No children',
      'Luzern',
      '1 employer',
      'Pays into 3a',
      '1 bank',
    ]);
    expect(e.requirements(snap, []).map((r) => [r.id, r.source])).toEqual([
      ['salary_certificate:p1', 'lu-2025-guide-wegleitung p. 37, p. 21'],
      ['pillar3a:p1', 'lu-2025-guide-wegleitung p. 37, p. 30'],
      ['health_premiums:p1', 'lu-2025-guide-wegleitung p. 31'],
      ['banks', 'lu-2025-guide-wegleitung p. 37, p. 38'],
    ]);
  });

  it('finds a commune by its name, accents and case aside, and refuses another canton’s', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, { canton: 'LU', civil_status: 'married', children: 0 });
    e.answer(ledger, 'commune', 'escholzmatt-marbach', USER);
    expect(ledger.get('profile.commune')?.value).toBe('escholzmatt-marbach');
    e.answer(ledger, 'commune', 'KRIENS', USER);
    expect(ledger.get('profile.commune')?.value).toBe('kriens');
    expect(() => e.answer(ledger, 'commune', 'Zug', USER)).toThrow(QuestionnaireError);
  });

  it('asks about the family tariff only in shared custody without child support', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'LU',
      civil_status: 'divorced',
      children: 2,
      children_custody: 'shared',
      child_support: 'none_i_earn_more',
    });
    expect(e.next(e.snapshot(ledger))?.id).toBe('family_tariff');
    e.answer(ledger, 'family_tariff', true, USER);
    expect(ledger.get('lu.family_tariff')?.value).toBe(true);
    for (const support of ['i_receive', 'i_pay']) {
      e.answer(ledger, 'child_support', support, USER);
      expect(slotIds(e, ledger)).not.toContain('family_tariff');
    }
    e.answer(ledger, 'child_support', 'none_unsure', USER);
    e.answer(ledger, 'children_custody', 'with_household', USER);
    expect(slotIds(e, ledger)).not.toContain('family_tariff');
  });

  it('asks each child’s household and age, away for education only from 14 or away, and the childcare per child only with several', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'LU',
      civil_status: 'married',
      children: 2,
      children_custody: 'with_household',
    });
    let snap = e.snapshot(ledger);
    expect(
      snap.slots.filter((s) => s.question.id === 'child_lives_with_you').map((s) => s.id),
    ).toEqual(['child_lives_with_you:child1', 'child_lives_with_you:child2']);
    const second = snap.slots.find((s) => s.id === 'child_lives_with_you:child2')!;
    expect(e.render(second, snap, 'en').text).toBe(
      'Did child 2 live in your household at the end of 2026?',
    );
    for (const lang of ['en', 'fr', 'de'] as const) {
      const r = e.render(second, snap, lang);
      expect(JSON.stringify([r.text, r.help, r.explain, r.who])).not.toMatch(/\{n\}/);
    }
    e.answer(ledger, 'child_lives_with_you:child1', true, USER);
    e.answer(ledger, 'child_lives_with_you:child2', true, USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_under14'))).toEqual([
      'child_under14:child1',
      'child_under14:child2',
    ]);
    e.answer(ledger, 'child_under14:child1', false, USER);
    e.answer(ledger, 'child_under14:child2', true, USER);
    // Only the child of 14 or more: away for its education?
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_away'))).toEqual([
      'child_away:child1',
    ]);
    e.answer(ledger, 'child_away:child1', true, USER);
    expect(ledger.get('lu.child_away', 'child1')?.value).toBe(true);
    // A child not living with you: no age asked, away for its education asked.
    e.answer(ledger, 'child_lives_with_you:child2', false, USER);
    expect(slotIds(e, ledger)).not.toContain('child_under14:child2');
    expect(slotIds(e, ledger)).toContain('child_away:child2');
    e.answer(ledger, 'childcare', 'creche_or_daycare', USER);
    snap = e.snapshot(ledger);
    expect(snap.slots.filter((s) => s.question.id === 'child_care').map((s) => s.id)).toEqual([
      'child_care:child1',
      'child_care:child2',
    ]);
    e.answer(ledger, 'child_care:child2', "14'000", USER);
    expect(ledger.get('lu.child_care', 'child2')?.value).toBe(1_400_000);
    // One child: the invoices' total is that child's, not asked.
    e.answer(ledger, 'children', 1, USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_care'))).toEqual([]);
    // Children mostly with the other parent: nothing asked about them.
    e.answer(ledger, 'children_custody', 'elsewhere', USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_'))).toEqual([]);
  });

  it('asks each adult’s confession, and each child’s when the household counts the children', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'LU',
      civil_status: 'married',
      children: 1,
      children_custody: 'with_household',
      'child_lives_with_you:child1': true,
      'child_under14:child1': true,
      childcare: 'none',
      commune: 'Kriens',
      moved: 'no',
      'church:p1': 'catholic',
      'church:p2': 'christ_catholic',
      'child_church:child1': 'reformed',
    });
    expect(ledger.get('lu.church', 'p2')?.value).toBe('christ_catholic');
    expect(ledger.get('lu.child_church', 'child1')?.value).toBe('reformed');
    // A parent alone who pays child support: the other parent counts the children.
    e.answer(ledger, 'civil_status', 'divorced', USER);
    e.answer(ledger, 'children_custody', 'shared', USER);
    e.answer(ledger, 'child_support', 'i_pay', USER);
    expect(slotIds(e, ledger)).not.toContain('child_church:child1');
    e.answer(ledger, 'child_support', 'none_other_earns_more', USER);
    expect(slotIds(e, ledger)).toContain('child_church:child1');
  });

  it('says plainly what Lucerne doesn’t cover yet', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'LU',
      civil_status: 'single',
      children: 0,
      commune: 'Emmen',
      moved: 'from_abroad',
      'church:p1': 'none',
      'income_sources:p1': ['salary', 'self_employment'],
      'employers:p1': 1,
      'taxed_at_source:p1': true,
    });
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.what.de)).toEqual([
      'Ein Zuzug aus dem Ausland während des Jahres',
      'Die selbständige Erwerbstätigkeit (Ziffer 110 bis 119)',
      'Die Quellensteuer im Kanton Luzern und die nachträgliche ordentliche Veranlagung (NOV)',
    ]);
    expect(e.notSupportedMessage('en')).toMatch(/eSteuern\.LU/);
    // A move from another canton is supported: Lucerne taxes the whole year.
    e.answer(ledger, 'moved', 'from_other_canton', USER);
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.slotId)).not.toContain('moved');
    expect(() => e.answer(ledger, 'moved', 'within_zg', USER)).toThrow(QuestionnaireError);
  });
});
