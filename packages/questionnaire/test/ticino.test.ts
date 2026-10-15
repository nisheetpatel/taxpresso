// The Ticino questionnaire (data/ti/2026/questionnaire.yaml): in step with Ticino's keys and communes
// (packages/rules-ti), every text in English, French, German and Italian, every page an official one,
// and the questions only Ticino asks (a change of civil status during the year, whether each child
// is a minor, the childcare paid for each child, each person's work rate and whole year of work)
// only where they apply. Synthetic answers only.
import { readFileSync } from 'node:fs';
import { Ledger } from '@taxpresso/ledger';
import { KEYS_CANTON_2026 } from '@taxpresso/rules-ch';
import { communeOptions, tiKeys } from '@taxpresso/rules-ti';
import { describe, expect, it } from 'vitest';
import {
  NBSP,
  QuestionnaireEngine,
  sharedQuestionnaire2026,
  tiQuestionnaire2026,
} from '../src/index.js';

const KEYS = { ...KEYS_CANTON_2026, ...tiKeys(2026) };
const engine = () => new QuestionnaireEngine(tiQuestionnaire2026(), KEYS, communeOptions(2026));
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
const TI_URLS = urls('../../../docs/sources/ti/manifest.json');
const ALL_URLS = urls('../../../docs/sources/manifest.json');
const GUIDE = 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IPF/2025/Istruzioni/Istruzioni_PF_2025.pdf';

/** A single employee in Lugano (synthetic). */
const SINGLE_IN_LUGANO = {
  canton: 'TI',
  civil_status: 'single',
  children: 0,
  commune: 'Lugano',
  moved: 'no',
  'income_sources:p1': ['salary'],
  'employers:p1': 1,
  'work_rate:p1': 100,
  'full_year:p1': true,
  'residence:p1': 'swiss',
  'commute:p1': 'public_transport',
  'commute_transit_cost:p1': 790,
  'meal_days:p1': 200,
  'pillar3a:p1': true,
  'lpp_buyin:p1': false,
  payments: [],
  banks: 1,
  crypto: false,
  special: [],
};

describe('Ticino questionnaire 2026', () => {
  it('matches Ticino’s 2026 keys and communes exactly (the key-drift check)', () => {
    expect(engine().check()).toEqual([]);
    expect(communeOptions(2026)).toHaveLength(100);
  });

  it('takes the questions every canton shares, in the order of the return', () => {
    const file = tiQuestionnaire2026();
    const ids = file.questions.map((q) => q.id);
    expect(ids).toEqual([
      'canton',
      'civil_status',
      'status_change',
      'children',
      'children_custody',
      'child_support',
      'child_minor',
      'childcare',
      'child_care',
      'commune',
      'moved',
      'income_sources',
      'employers',
      'work_rate',
      'full_year',
      'months_worked',
      'residence',
      'taxed_at_source',
      'commute',
      'commute_transit_cost',
      'commute_transit_usable',
      'commute_transit_equivalent',
      'commute_distance',
      'commute_drive_days',
      'meal_days',
      'pillar3a',
      'lpp_buyin',
      'payments',
      'banks',
      'crypto',
      'special',
    ]);
    const shared = new Set(sharedQuestionnaire2026().questions.map((q) => q.id));
    expect(ids.filter((id) => !shared.has(id))).toEqual([
      'status_change',
      'child_minor',
      'child_care',
      'commune',
      'moved',
      'work_rate',
      'full_year',
      'months_worked',
    ]);
    // Every shared question and document is taken.
    expect(ids.filter((id) => shared.has(id)).sort()).toEqual([...shared].sort());
    expect(file.requirements.map((r) => r.id)).toEqual(
      sharedQuestionnaire2026().requirements.map((r) => r.id),
    );
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
    expect(file.place).toEqual({ en: 'Ticino', fr: 'Tessin', de: 'Tessin', it: 'Ticino' });
  });

  it('says everything in English, French, German and Italian, with an official page', () => {
    const file = tiQuestionnaire2026();
    const missing: string[] = [];
    const visit = (v: unknown, where: string): void => {
      if (Array.isArray(v)) return v.forEach((x, i) => visit(x, `${where}[${i}]`));
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if (typeof o.en === 'string' && typeof o.fr === 'string') {
          for (const l of ['de', 'it']) {
            if (typeof o[l] !== 'string' || !o[l]) missing.push(`${where}.${l}`);
          }
          return;
        }
        for (const [k, x] of Object.entries(o)) visit(x, `${where}.${k}`);
      }
    };
    visit(file, 'ti');
    expect(missing).toEqual([]);
    const all = JSON.stringify(file);
    expect(all).not.toMatch(/—/);
    expect(JSON.stringify(file.questions.map((q) => [q.text, q.explain]))).not.toMatch(
      /CHF|Fr\.|\bfranc/i,
    );
    let guidePages = 0;
    for (const item of [...file.questions, ...file.requirements]) {
      expect(item.explain?.it, item.id).toBeTruthy();
      const { url, label } = item.learnMore!;
      const page = url.replace(/#page=\d+$/, '');
      // Ticino's own documents for what is Ticino's; the shared questions may keep their federal page.
      expect(TI_URLS.has(page) || ALL_URLS.has(page), item.id).toBe(true);
      if (url.startsWith(`${GUIDE}#page=`)) {
        guidePages++;
        const n = url.slice(`${GUIDE}#page=`.length);
        expect(label.en, item.id).toMatch(new RegExp(`^Ticino tax instructions 2025, p\\. ${n}: `));
        expect(label.fr, item.id).toMatch(
          new RegExp(`^Instructions fiscales du Tessin 2025, p\\. ${n}${NBSP}: `),
        );
        expect(label.de, item.id).toMatch(
          new RegExp(`^Wegleitung zur Steuererklärung 2025 des Kantons Tessin, S\\. ${n}: `),
        );
        expect(label.it, item.id).toMatch(
          new RegExp(`^Istruzioni per la dichiarazione d’imposta 2025, p\\. ${n}: `),
        );
      }
    }
    expect(guidePages).toBeGreaterThan(20);
    // Every document cites the Ticino instructions, by the page of the PDF.
    for (const r of file.requirements) {
      expect(r.source, r.id).toMatch(/^ti-2025-guide-istruzioni-pf-pdf p\. \d+(, p\. \d+)*$/);
    }
    // Informal Italian ("tu") and German ("du") in Taxpresso's own words.
    const own = JSON.stringify(file.questions.map((q) => [q.text, q.help, q.explain]));
    expect(own).not.toMatch(/\b(Lei ha|ha Lei|Suo|Sua|Ihr|Ihre|Ihrem|Ihren|Ihnen|Sie haben)\b/);
    expect(file.notSupported.it).toMatch(/eTax PF/);
  });

  it('asks a single employee in Lugano, then lists what is missing', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    const asked = walk(e, ledger, SINGLE_IN_LUGANO);
    expect(asked).toEqual(Object.keys(SINGLE_IN_LUGANO));
    expect(e.next(e.snapshot(ledger))).toBeUndefined();
    // The commune is stored by its slug, offered by its name in ordinary case.
    expect(ledger.get('profile.commune')?.value).toBe('lugano');
    const slot = e.snapshot(ledger).slots.find((s) => s.id === 'commune')!;
    expect(e.render(slot, e.snapshot(ledger), 'it').options).toContainEqual({
      value: 'collina-d-oro',
      label: 'Collina d’Oro',
      notSupported: false,
    });
    expect(e.chips(e.snapshot(ledger), 'it')).toEqual(
      expect.arrayContaining(['Lugano', 'Lavora al 100 %', 'Tutto l’anno']),
    );
  });

  it('asks Ticino’s own questions only where they apply', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, { canton: 'TI', civil_status: 'married', children: 2 });
    let ids = slotIds(e, ledger);
    expect(ids).not.toContain('status_change');
    expect(ids).not.toContain('child_minor:child1');
    e.answer(ledger, 'children_custody', 'with_household', USER);
    ids = slotIds(e, ledger);
    expect(ids).toContain('child_minor:child1');
    expect(ids).toContain('child_minor:child2');
    expect(ids).not.toContain('child_care:child1');
    e.answer(ledger, 'childcare', 'creche_or_daycare', USER);
    ids = slotIds(e, ledger);
    expect(ids).toContain('child_care:child1');
    expect(ids).toContain('child_care:child2');
    // The work rate and the whole year, per person with a salary; the months only when not.
    e.answer(ledger, 'income_sources:p1', ['salary'], USER);
    e.answer(ledger, 'income_sources:p2', ['pension'], USER);
    ids = slotIds(e, ledger);
    expect(ids).toContain('work_rate:p1');
    expect(ids).not.toContain('work_rate:p2');
    expect(ids).not.toContain('months_worked:p1');
    e.answer(ledger, 'full_year:p1', false, USER);
    expect(slotIds(e, ledger)).toContain('months_worked:p1');
    // Widowed, divorced or separated: whether it changed during the year.
    const alone = new Ledger(2026, KEYS);
    walk(e, alone, { canton: 'TI', civil_status: 'divorced' });
    expect(slotIds(e, alone)).toContain('status_change');
    expect(
      e.render(
        e.snapshot(alone).slots.find((s) => s.id === 'status_change')!,
        e.snapshot(alone),
        'it',
      ).text,
    ).toBe(
      'Nel 2026 hai divorziato o ti sei separato o separata, oppure è deceduto il tuo coniuge?',
    );
  });

  it('refuses arriving from abroad and tax at source, which it can’t prepare', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, { canton: 'TI', civil_status: 'single', children: 0, commune: 'Bellinzona' });
    e.answer(ledger, 'moved', 'from_abroad', USER);
    e.answer(ledger, 'income_sources:p1', ['salary'], USER);
    // Without a C permit, a salary is taxed at source: derived, then not supported in Ticino.
    e.answer(ledger, 'residence:p1', 'permit_other', USER);
    const what = e.notSupported(e.snapshot(ledger)).map((n) => n.what.it);
    expect(what).toEqual([
      'Un arrivo dall’estero nel corso dell’anno',
      'L’imposta alla fonte in Ticino e la tassazione ordinaria ulteriore (TOU) che la segue',
    ]);
    expect(e.notSupportedMessage('it')).toMatch(/eTax PF/);
  });
});
