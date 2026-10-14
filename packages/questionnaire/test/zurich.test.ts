// The Zurich questionnaire (data/zh/2026/questionnaire.yaml): in step with Zurich's keys and
// communes (packages/rules-zh), every text in English, French and German, every page an official
// one, and the questions only Zurich asks (the commune and its parts, the move, the church and the
// parish) as the official tables need them. Synthetic answers only.
import { readFileSync } from 'node:fs';
import { Ledger } from '@taxpresso/ledger';
import { KEYS_CANTON_2026 } from '@taxpresso/rules-ch';
import { communeOfAnswer, communeOptions, parishChoices, zurichKeys } from '@taxpresso/rules-zh';
import { describe, expect, it } from 'vitest';
import {
  NBSP,
  QuestionnaireEngine,
  QuestionnaireError,
  sharedQuestionnaire2026,
  zhQuestionnaire2026,
  type Condition,
} from '../src/index.js';

const KEYS = { ...KEYS_CANTON_2026, ...zurichKeys(2026) };
const engine = () => new QuestionnaireEngine(zhQuestionnaire2026(), KEYS, communeOptions(2026));
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

/** A single employee in Zürich (synthetic). */
const SINGLE_IN_ZURICH = {
  canton: 'ZH',
  civil_status: 'single',
  children: 0,
  commune: 'Zürich',
  moved: 'no',
  'church:p1': 'none',
  'income_sources:p1': ['salary'],
  'employers:p1': 1,
  'residence:p1': 'swiss',
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

describe('Zurich questionnaire 2026', () => {
  it('matches Zurich’s 2026 keys and communes exactly (the key-drift check)', () => {
    expect(engine().check()).toEqual([]);
  });

  it('takes the questions every canton shares, in the Zurich return’s order', () => {
    const file = zhQuestionnaire2026();
    const shared = new Set(sharedQuestionnaire2026().questions.map((q) => q.id));
    const ids = file.questions.map((q) => q.id);
    expect(ids[0]).toBe('canton');
    expect(ids.filter((id) => !shared.has(id))).toEqual(['commune', 'moved', 'church', 'parish']);
    // Zurich's way to work has no "over 2 hours" choice: only Geneva's meal rule needs it.
    const commute = file.questions.find((q) => q.id === 'commute')!;
    expect(commute.options?.map((o) => o.value)).not.toContain('public_transport_long');
  });

  it('says everything in English, French, German and Italian, with an official page', () => {
    const file = zhQuestionnaire2026();
    const texts: string[] = [];
    const noItalian: string[] = [];
    const visit = (v: unknown, where: string): void => {
      if (Array.isArray(v)) return v.forEach((x, i) => visit(x, `${where}[${i}]`));
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if (typeof o.en === 'string' && typeof o.fr === 'string') {
          if (typeof o.de !== 'string' || !o.de) texts.push(where);
          if (typeof o.it !== 'string' || !o.it) noItalian.push(where);
          return;
        }
        for (const [k, x] of Object.entries(o)) visit(x, `${where}.${k}`);
      }
    };
    visit(file, 'zh');
    expect(texts).toEqual([]);
    expect(noItalian).toEqual([]);
    const manifest = JSON.parse(
      readFileSync(new URL('../../../docs/sources/manifest.json', import.meta.url), 'utf8'),
    ) as { entries: { url: string }[] };
    const official = new Set(manifest.entries.map((e) => e.url));
    for (const item of [...file.questions, ...file.requirements]) {
      expect(item.explain?.de, item.id).toBeTruthy();
      expect(official, item.id).toContain(item.learnMore!.url.replace(/#page=\d+$/, ''));
    }
    // Every document cites the Zurich guide, the canton's own documents or the federal ones.
    for (const r of file.requirements) expect(r.source, r.id).toMatch(/^zh-/);
    // Informal German, the canton's own words: no "Sie" addressed to the user in Taxpresso's text.
    const de = JSON.stringify(file.questions.map((q) => [q.text, q.help, q.explain]));
    expect(de).not.toMatch(/\b(Ihr|Ihre|Ihnen|Sie haben|haben Sie)\b(?! Haushalt)/);
    expect(file.questions[1]!.text).toMatchObject({
      de: 'Was war dein Zivilstand am 31. Dezember 2026?',
      fr: `Quel était votre état civil au 31 décembre 2026${NBSP}?`,
    });
  });

  it('asks a single employee in Zürich 18 questions, then lists what is missing', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    const asked = walk(e, ledger, SINGLE_IN_ZURICH);
    expect(asked).toEqual(Object.keys(SINGLE_IN_ZURICH));
    expect(ledger.get('profile.commune')?.value).toBe('261');
    const snap = e.snapshot(ledger);
    expect(e.next(snap)).toBeUndefined();
    expect(e.notSupported(snap)).toEqual([]);
    expect(e.chips(snap, 'en')).toEqual([
      'Zurich',
      'Single',
      'No children',
      'Zürich',
      '1 employer',
      'Pays into 3a',
      '1 bank',
    ]);
    expect(e.requirements(snap, []).map((r) => [r.id, r.source])).toEqual([
      ['salary_certificate:p1', 'zh-2025-guide-natuerliche-personen p. 10'],
      ['pillar3a:p1', 'zh-2025-guide-natuerliche-personen p. 15'],
      ['health_premiums:p1', 'zh-2025-guide-natuerliche-personen p. 15'],
      ['banks', 'zh-2025-guide-natuerliche-personen p. 24'],
    ]);
  });

  it('lists every commune, once per part where the official table gives two multipliers', () => {
    const options = communeOptions(2026);
    const parts = options.filter((o) => o.slug.includes('-'));
    expect(options.length).toBe(160 + parts.length / 2);
    expect(parts.map((o) => o.name)).toEqual([
      'Uster, Teil 1 (Steuerfuss 112 %)',
      'Uster, Teil 2 (Steuerfuss 110 %)',
      'Turbenthal, Teil 1 (Steuerfuss 122 %)',
      'Turbenthal, Teil 2 (Steuerfuss 112 %)',
    ]);
    // The question's help names exactly these communes.
    const help = zhQuestionnaire2026().questions.find((q) => q.id === 'commune')!.help!;
    for (const name of new Set(parts.map((o) => o.name.split(',')[0]))) {
      expect(help.en).toContain(name);
      expect(help.de).toContain(name);
    }
    expect(communeOfAnswer(2026, '198-2')).toEqual({ bfs: 198, variant: 2 });
    expect(communeOfAnswer(2026, '230')).toEqual({ bfs: 230 });
    expect(communeOfAnswer(2026, '198')).toBeUndefined();
    expect(communeOfAnswer(2026, 'geneve')).toBeUndefined();
  });

  it('takes a commune by its name, and asks which part where there are two', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, { canton: 'ZH', civil_status: 'married', children: 2 });
    e.answer(ledger, 'children_custody', 'with_household', USER);
    e.answer(ledger, 'childcare', 'none', USER);
    expect(() => e.answer(ledger, 'commune', 'Uster', USER)).toThrow(
      /"Uster" has 2 parts: Uster, Teil 1 \(Steuerfuss 112 %\); Uster, Teil 2 \(Steuerfuss 110 %\)\. Say which\./,
    );
    expect(() => e.answer(ledger, 'commune', 'Carouge', USER)).toThrow(/not a Zurich commune/);
    e.answer(ledger, 'commune', 'Uster, Teil 2 (Steuerfuss 110 %)', USER);
    expect(ledger.get('profile.commune')?.value).toBe('198-2');
    e.answer(ledger, 'commune', 'Winterthur', USER);
    expect(ledger.get('profile.commune')?.value).toBe('230');
  });

  it('asks the church of each spouse, and the parish only where it changes the tax', () => {
    const conditionCommunes = (c: Condition | undefined): [string, string][] =>
      (c?.any ?? []).map((x) => {
        const commune = x.all!.find((y) => y.key === 'profile.commune')!.eq as string;
        const church = x.all!.find((y) => y.key === 'zh.church')!.eq as string;
        return [commune, church];
      });
    const parish = zhQuestionnaire2026().questions.find((q) => q.id === 'parish')!;
    // In step with the official table of the year (rules-zh).
    expect(conditionCommunes(parish.when)).toEqual(
      parishChoices(2026).map((p) => [String(p.bfs), p.church]),
    );
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'ZH',
      civil_status: 'married',
      children: 0,
      commune: 'Wädenswil',
      moved: 'within_zurich',
      'church:p1': 'catholic',
    });
    expect(e.next(e.snapshot(ledger))?.id).toBe('church:p2');
    e.answer(ledger, 'church:p2', 'reformed', USER);
    expect(e.next(e.snapshot(ledger))?.id).toBe('parish');
    e.answer(ledger, 'church:p2', 'none', USER);
    expect(e.next(e.snapshot(ledger))?.id).toBe('income_sources:p1');
  });

  it('says plainly what Zurich doesn’t cover yet', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'ZH',
      civil_status: 'single',
      children: 0,
      commune: 'Winterthur',
      moved: 'from_abroad',
      'church:p1': 'none',
      'income_sources:p1': ['salary', 'self_employment'],
      'employers:p1': 1,
      'residence:p1': 'permit_other',
    });
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.what.de)).toEqual([
      'Ein Zuzug aus dem Ausland während des Jahres',
      'Die selbständige Erwerbstätigkeit (Hilfsblatt A)',
      'Die Quellensteuer im Kanton Zürich und die nachträgliche ordentliche Veranlagung (NOV)',
    ]);
    expect(e.notSupportedMessage('en')).toMatch(/ZHprivateTax/);
    // Not asked: without a C permit, a salary is taxed at source (LIFD art. 83), derived.
    const snap = e.snapshot(ledger);
    expect(snap.slots.map((s) => s.id)).not.toContain('taxed_at_source:p1');
    expect(snap.derived.find((s) => s.id === 'taxed_at_source:p1')).toMatchObject({
      value: true,
      derived: { source: 'ch-na-law-lifd p. 49 (art. 83 al. 1, art. 84 al. 2 let. a and b)' },
    });
    expect(() => e.answer(ledger, 'taxed_at_source:p1', false, USER)).toThrow(
      /follows from the other answers/,
    );
    // With a legitimation card the law doesn't settle it: asked, and yes is not supported.
    e.answer(ledger, 'residence:p1', 'other', USER);
    const slot = e.snapshot(ledger).slots.find((s) => s.id === 'taxed_at_source:p1')!;
    expect(e.render(slot, e.snapshot(ledger), 'en').options).toEqual([
      { value: 'yes', label: 'Yes', notSupported: true },
      { value: 'no', label: 'No', notSupported: false },
    ]);
    // A move from another canton is supported: Zurich taxes the whole year (guide p. 5 and 6).
    e.answer(ledger, 'moved', 'from_other_canton', USER);
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.slotId)).not.toContain('moved');
    expect(() => e.answer(ledger, 'moved', 'within_geneva', USER)).toThrow(QuestionnaireError);
  });
});
