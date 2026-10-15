// The St. Gallen questionnaire (data/sg/2026/questionnaire.yaml): in step with St. Gallen's keys,
// communes and church areas (packages/rules-sg), every text in English, French, German and Italian, every
// page an official one, and the questions only St. Gallen asks (who mainly bears a shared child's
// upkeep, each child's stage, whether a minor, its education costs, scholarships and childcare, the
// church and the church area) only where they apply. Synthetic answers only.
import { readFileSync } from 'node:fs';
import { Ledger } from '@taxpresso/ledger';
import { KEYS_CANTON_2026 } from '@taxpresso/rules-ch';
import { areaOptions, communeOptions, sgKeys } from '@taxpresso/rules-sg';
import { describe, expect, it } from 'vitest';
import {
  NBSP,
  QuestionnaireEngine,
  QuestionnaireError,
  sgQuestionnaire2026,
  sharedQuestionnaire2026,
  type Condition,
} from '../src/index.js';

const KEYS = { ...KEYS_CANTON_2026, ...sgKeys(2026) };
const engine = () => new QuestionnaireEngine(sgQuestionnaire2026(), KEYS, communeOptions(2026));
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
const SG_URLS = urls('../../../docs/sources/sg/manifest.json');
const ALL_URLS = urls('../../../docs/sources/manifest.json');
const GUIDE =
  'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/einkommens-und-vermoegenssteuer/2025-hs/Wegleitung_NP_2025.pdf';

/** A single employee in the city of St. Gallen (synthetic). */
const SINGLE_IN_ST_GALLEN = {
  canton: 'SG',
  civil_status: 'single',
  children: 0,
  commune: 'St. Gallen',
  moved: 'no',
  'church:p1': 'none',
  'income_sources:p1': ['salary'],
  'employers:p1': 1,
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

describe('St. Gallen questionnaire 2026', () => {
  it('matches St. Gallen’s 2026 keys, communes and church areas exactly (the key-drift check)', () => {
    expect(engine().check()).toEqual([]);
    expect(communeOptions(2026)).toHaveLength(75);
    const file = sgQuestionnaire2026();
    const area = file.questions.find((q) => q.id === 'church_area')!;
    expect(area.options!.map((o) => o.value)).toEqual(areaOptions(2026).map((o) => o.value));
  });

  it('takes the questions every canton shares, in the order of the return', () => {
    const file = sgQuestionnaire2026();
    const ids = file.questions.map((q) => q.id);
    expect(ids).toEqual([
      'canton',
      'civil_status',
      'children',
      'children_custody',
      'child_support',
      'main_upkeep',
      'child_stage',
      'child_minor',
      'child_education',
      'child_scholarships',
      'childcare',
      'child_care',
      'commune',
      'moved',
      'church',
      'church_area',
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
      'pillar3a',
      'lpp_buyin',
      'payments',
      'banks',
      'crypto',
      'special',
    ]);
    const shared = new Set(sharedQuestionnaire2026().questions.map((q) => q.id));
    expect(ids.filter((id) => !shared.has(id))).toEqual([
      'main_upkeep',
      'child_stage',
      'child_minor',
      'child_education',
      'child_scholarships',
      'child_care',
      'commune',
      'moved',
      'church',
      'church_area',
    ]);
    // Every shared question and document is taken (in the return's order, not the shared file's).
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
    expect(file.place).toEqual({
      en: 'St. Gallen',
      fr: 'Saint-Gall',
      de: 'St. Gallen',
      it: 'San Gallo',
    });
  });

  it('says everything in English, French, German and Italian, with an official page', () => {
    const file = sgQuestionnaire2026();
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
    visit(file, 'sg');
    expect(missing).toEqual([]);
    expect(missingIt).toEqual([]);
    // No em-dash anywhere, no amount or limit in a question's own words.
    const all = JSON.stringify(file);
    expect(all).not.toMatch(/—/);
    expect(all).not.toMatch(/ß/);
    expect(JSON.stringify(file.questions.map((q) => [q.text, q.explain]))).not.toMatch(
      /CHF|Fr\.|franc/i,
    );
    let guidePages = 0;
    for (const item of [...file.questions, ...file.requirements]) {
      expect(item.explain?.de, item.id).toBeTruthy();
      const { url, label } = item.learnMore!;
      // St. Gallen's own documents; the canton question keeps its federal page (shared).
      expect(
        item.id === 'canton' || item.id === 'residence' ? ALL_URLS : SG_URLS,
        item.id,
      ).toContain(url.replace(/#page=\d+$/, ''));
      // A page of the guide is named by the page the link opens.
      if (url.startsWith(`${GUIDE}#page=`)) {
        guidePages++;
        const page = url.slice(`${GUIDE}#page=`.length);
        expect(label.en, item.id).toMatch(
          new RegExp(`^St\\. Gallen tax guide 2025, p\\. ${page}: `),
        );
        expect(label.fr, item.id).toMatch(
          new RegExp(`^Guide fiscal de Saint-Gall 2025, p\\. ${page}${NBSP}: `),
        );
        expect(label.de, item.id).toMatch(
          new RegExp(`^Wegleitung zur Steuererklärung 2025, S\\. ${page}: `),
        );
        expect(label.it, item.id).toMatch(
          new RegExp(`^Guida fiscale di San Gallo 2025, p\\. ${page}: `),
        );
      } else {
        expect(url.startsWith(GUIDE), item.id).toBe(false);
      }
    }
    expect(guidePages).toBeGreaterThan(30);
    // Every document cites the St. Gallen guide, by the page of the PDF.
    for (const r of file.requirements) {
      expect(r.source, r.id).toMatch(/^sg-2025-guide-wegleitung p\. \d+(, p\. \d+)*$/);
    }
    // Informal German: no "Sie" addressed to the user in Taxpresso's text.
    const de = JSON.stringify(file.questions.map((q) => [q.text, q.help, q.explain]));
    expect(de).not.toMatch(/\b(Ihr|Ihre|Ihrem|Ihren|Ihrer|Ihnen|Sie haben|haben Sie)\b/);
    expect(file.notSupported.en).toMatch(/E-Tax SG/);
    expect(file.notSupported.de).toMatch(/steuern\.sg\.ch\/etaxnp/);
    expect(file.notSupported.fr).not.toMatch(/gratuit/);
  });

  it('asks a single employee in St. Gallen 18 questions, then lists what is missing', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    const asked = walk(e, ledger, SINGLE_IN_ST_GALLEN);
    expect(asked).toEqual(Object.keys(SINGLE_IN_ST_GALLEN));
    expect(asked).toHaveLength(18);
    expect(ledger.get('profile.commune')?.value).toBe('st-gallen');
    expect(ledger.get('sg.church', 'p1')?.value).toBe('none');
    expect(ledger.get('commute.transit_cost', 'p1')?.value).toBe(79_000);
    const snap = e.snapshot(ledger);
    expect(e.next(snap)).toBeUndefined();
    expect(e.notSupported(snap)).toEqual([]);
    expect(e.chips(snap, 'en')).toEqual([
      'St. Gallen',
      'Single',
      'No children',
      'St. Gallen',
      '1 employer',
      'Pays into 3a',
      '1 bank',
    ]);
    expect(e.requirements(snap, []).map((r) => [r.id, r.source])).toEqual([
      ['salary_certificate:p1', 'sg-2025-guide-wegleitung p. 7, p. 14'],
      ['pillar3a:p1', 'sg-2025-guide-wegleitung p. 26'],
      ['health_premiums:p1', 'sg-2025-guide-wegleitung p. 27'],
      ['banks', 'sg-2025-guide-wegleitung p. 7, p. 35, p. 36'],
    ]);
  });

  it('finds a commune by its name, accents and case aside, and refuses another canton’s', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, { canton: 'SG', civil_status: 'married', children: 0 });
    e.answer(ledger, 'commune', 'rapperswil-jona', USER);
    expect(ledger.get('profile.commune')?.value).toBe('rapperswil-jona');
    e.answer(ledger, 'commune', 'ALTSTÄTTEN', USER);
    expect(ledger.get('profile.commune')?.value).toBe('altstatten');
    e.answer(ledger, 'commune', 'Wildhaus-Alt St. Johann', USER);
    expect(ledger.get('profile.commune')?.value).toBe('wildhaus-alt-st-johann');
    expect(() => e.answer(ledger, 'commune', 'Herisau', USER)).toThrow(/not a St\. Gallen commune/);
  });

  it('asks who mainly bears the upkeep only in shared custody without child support', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'SG',
      civil_status: 'divorced',
      children: 2,
      children_custody: 'shared',
      child_support: 'none_other_earns_more',
    });
    expect(e.next(e.snapshot(ledger))?.id).toBe('main_upkeep');
    e.answer(ledger, 'main_upkeep', true, USER);
    expect(ledger.get('sg.main_upkeep')?.value).toBe(true);
    expect(e.chips(e.snapshot(ledger), 'de')).toContain('Bestreitet den Unterhalt');
    for (const support of ['i_receive', 'i_pay']) {
      e.answer(ledger, 'child_support', support, USER);
      expect(slotIds(e, ledger)).not.toContain('main_upkeep');
    }
    e.answer(ledger, 'child_support', 'none_unsure', USER);
    expect(slotIds(e, ledger)).toContain('main_upkeep');
    e.answer(ledger, 'children_custody', 'with_household', USER);
    expect(slotIds(e, ledger)).not.toContain('main_upkeep');
    // A married couple's children are theirs: never asked.
    e.answer(ledger, 'civil_status', 'married', USER);
    e.answer(ledger, 'children_custody', 'shared', USER);
    expect(slotIds(e, ledger)).not.toContain('main_upkeep');
  });

  it('asks each child’s stage, then the minor, education costs and scholarships only where they apply', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'SG',
      civil_status: 'married',
      children: 2,
      children_custody: 'with_household',
    });
    let snap = e.snapshot(ledger);
    expect(e.next(snap)?.id).toBe('child_stage:child1');
    expect(snap.slots.filter((s) => s.question.id === 'child_stage').map((s) => s.id)).toEqual([
      'child_stage:child1',
      'child_stage:child2',
    ]);
    // Nothing more per child before the stage is known.
    expect(
      slotIds(e, ledger).filter((id) => /^child_(minor|education|scholarships)/.test(id)),
    ).toEqual([]);
    const second = snap.slots.find((s) => s.id === 'child_stage:child2')!;
    expect(e.render(second, snap, 'en').text).toBe(
      'On 31 December 2026, was child 2 in school or training, or not yet of school age?',
    );
    expect(e.render(second, snap, 'de').who).toBe('Kind 2');
    for (const lang of ['en', 'fr', 'de', 'it'] as const) {
      const r = e.render(second, snap, lang);
      expect(JSON.stringify([r.text, r.help, r.explain, r.who])).not.toMatch(/\{n\}/);
      expect(r.options!.map((o) => o.value)).toEqual(['preschool', 'school']);
    }
    // Child 1 is not yet of school age, child 2 is in school.
    walk(e, ledger, { 'child_stage:child1': 'preschool', 'child_stage:child2': 'school' });
    expect(ledger.get('sg.child_stage', 'child1')?.value).toBe('preschool');
    expect(ledger.get('sg.child_stage', 'child2')?.value).toBe('school');
    // A preschool child is a minor with no education costs: only child 2 is asked.
    const perChild = () =>
      slotIds(e, ledger).filter((id) => /^child_(minor|education|scholarships)/.test(id));
    expect(perChild()).toEqual(['child_minor:child2', 'child_education:child2']);
    expect(e.next(e.snapshot(ledger))?.id).toBe('child_minor:child2');
    e.answer(ledger, 'child_minor:child2', true, USER);
    // No education costs: no scholarships asked.
    e.answer(ledger, 'child_education:child2', 0, USER);
    expect(perChild()).toEqual(['child_minor:child2', 'child_education:child2']);
    // Education costs: then the scholarships for that child.
    e.answer(ledger, 'child_education:child2', "4'800", USER);
    expect(ledger.get('sg.child_education', 'child2')?.value).toBe(480_000);
    expect(e.next(e.snapshot(ledger))?.id).toBe('child_scholarships:child2');
    snap = e.snapshot(ledger);
    const grant = snap.slots.find((s) => s.id === 'child_scholarships:child2')!;
    expect(e.render(grant, snap, 'de').text).toBe(
      'Wie viel staatliche Stipendien hast du oder hat Kind 2 für 2026 erhalten?',
    );
    e.answer(ledger, 'child_scholarships:child2', 1_200, USER);
    expect(ledger.get('sg.child_scholarships', 'child2')?.value).toBe(120_000);
    // The next question is the childcare: the children's questions are done.
    expect(e.next(e.snapshot(ledger))?.id).toBe('childcare');
    // Childcare for several children: asked per child.
    e.answer(ledger, 'childcare', 'creche_or_daycare', USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_care'))).toEqual([
      'child_care:child1',
      'child_care:child2',
    ]);
    e.answer(ledger, 'child_care:child1', "18'000", USER);
    expect(ledger.get('sg.child_care', 'child1')?.value).toBe(1_800_000);
    // Child 2 back to preschool: its minor, education and scholarships questions go.
    e.answer(ledger, 'child_stage:child2', 'preschool', USER);
    expect(perChild()).toEqual([]);
    // One child: the invoices' total is that child's, not asked.
    e.answer(ledger, 'children', 1, USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_care'))).toEqual([]);
    // Children mostly with the other parent: no stage asked.
    e.answer(ledger, 'children_custody', 'elsewhere', USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_stage'))).toEqual([]);
  });

  it('offers each commune’s own church areas, from the table, only where the rate differs', () => {
    const area = sgQuestionnaire2026().questions.find((q) => q.id === 'church_area')!;
    const table = areaOptions(2026);
    expect(new Set(table.map((o) => o.slug)).size).toBe(20);
    // The options are the table's areas, each offered only in its own commune.
    expect(
      area.options!.map((o) => [o.value, o.label.en, o.label.fr, o.label.de, o.label.it, o.when]),
    ).toEqual(
      table.map((o) => [
        o.value,
        `${o.commune}: ${o.area}`,
        `${o.commune}${NBSP}: ${o.area}`,
        `${o.commune}: ${o.area}`,
        `${o.commune}: ${o.area}`,
        { key: 'profile.commune', eq: o.slug },
      ]),
    );
    // Asked of a member of a church whose rate differs between the commune's areas.
    const asked = new Map<string, string[]>();
    for (const branch of area.when!.any!) {
      const commune = branch.all!.find((c: Condition) => c.key === 'profile.commune')!;
      const church = branch.all!.find((c: Condition) => c.key === 'sg.church')!;
      expect(church.anyPerson).toBe(true);
      for (const slug of commune.in!) {
        expect(asked.has(slug), slug).toBe(false);
        asked.set(slug, [...church.in!].sort());
      }
    }
    expect(Object.fromEntries([...asked].sort())).toEqual(
      Object.fromEntries(table.map((o) => [o.slug, [...o.churches].sort()] as const).sort()),
    );
  });

  it('asks the church area only where it changes the church tax, with the commune’s own areas', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    answerAll(e, ledger, [
      ['canton', 'SG'],
      ['civil_status', 'married'],
      ['commune', 'Altstätten'],
      ['church:p1', 'none'],
      ['church:p2', 'none'],
    ]);
    expect(slotIds(e, ledger)).not.toContain('church_area');
    // The Christ Catholic rate is one for the whole canton: never asked.
    e.answer(ledger, 'church:p2', 'christ_catholic', USER);
    expect(slotIds(e, ledger)).not.toContain('church_area');
    // Altstätten: its areas' Catholic and Evangelical rates differ.
    e.answer(ledger, 'church:p2', 'catholic', USER);
    let snap = e.snapshot(ledger);
    let slot = snap.slots.find((s) => s.id === 'church_area')!;
    expect(e.render(slot, snap, 'en').options!.map((o) => [o.value, o.label])).toEqual([
      ['altstatten:Altstätten', 'Altstätten: Altstätten'],
      ['altstatten:Lüchingen', 'Altstätten: Lüchingen'],
      ['altstatten:Lienz', 'Altstätten: Lienz'],
    ]);
    e.answer(ledger, 'church_area', 'altstatten:Lüchingen', USER);
    expect(ledger.get('sg.church_area')?.value).toBe('altstatten:Lüchingen');
    // Au: only the Catholic rate differs, so a Reformed member is not asked.
    e.answer(ledger, 'commune', 'Au', USER);
    e.answer(ledger, 'church:p2', 'reformed', USER);
    expect(slotIds(e, ledger)).not.toContain('church_area');
    e.answer(ledger, 'church:p1', 'catholic', USER);
    snap = e.snapshot(ledger);
    slot = snap.slots.find((s) => s.id === 'church_area')!;
    // Altstätten's area no longer answers in Au: the question is asked again, with Au's areas.
    expect(slot.value).toBeUndefined();
    expect(e.render(slot, snap, 'fr').options!.map((o) => [o.value, o.label])).toEqual([
      ['au:Au', `Au${NBSP}: Au`],
      ['au:Heerbrugg', `Au${NBSP}: Heerbrugg`],
    ]);
    e.answer(ledger, 'church_area', 'au:Heerbrugg', USER);
    expect(ledger.get('sg.church_area')?.value).toBe('au:Heerbrugg');
    // The city of St. Gallen: only the Evangelical rate differs between its three areas.
    e.answer(ledger, 'commune', 'St. Gallen', USER);
    expect(slotIds(e, ledger)).toContain('church_area');
    snap = e.snapshot(ledger);
    slot = snap.slots.find((s) => s.id === 'church_area')!;
    expect(e.render(slot, snap, 'de').options!.map((o) => o.value)).toEqual(
      areaOptions(2026)
        .filter((o) => o.slug === 'st-gallen')
        .map((o) => o.value),
    );
    e.answer(ledger, 'church:p2', 'none', USER);
    expect(slotIds(e, ledger)).not.toContain('church_area');
    // Wil has one area per church: never asked.
    e.answer(ledger, 'church:p2', 'reformed', USER);
    e.answer(ledger, 'commune', 'Wil', USER);
    expect(slotIds(e, ledger)).not.toContain('church_area');
  });

  it('says plainly what St. Gallen doesn’t cover yet', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'SG',
      civil_status: 'single',
      children: 0,
      commune: 'Wil',
      moved: 'from_abroad',
      'church:p1': 'jewish',
      'income_sources:p1': ['salary', 'self_employment'],
      'employers:p1': 1,
      'residence:p1': 'permit_other',
    });
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.what.de)).toEqual([
      'Ein Zuzug aus dem Ausland während des Jahres',
      'Die Steuer der Jüdischen Gemeinde',
      'Die selbständige Erwerbstätigkeit (2.1 und 2.2)',
      'Die Quellensteuer im Kanton St. Gallen und die nachträgliche ordentliche Veranlagung (NOV)',
    ]);
    expect(e.notSupportedMessage('en')).toMatch(/E-Tax SG/);
    // The Jewish community's rate is not in the canton's table; the other churches are covered.
    for (const church of ['catholic', 'reformed', 'christ_catholic', 'none']) {
      e.answer(ledger, 'church:p1', church, USER);
      expect(e.notSupported(e.snapshot(ledger)).map((n) => n.slotId)).not.toContain('church:p1');
    }
    // A move from another canton or within the canton is supported: the end of the year decides.
    for (const moved of ['from_other_canton', 'within_sg']) {
      e.answer(ledger, 'moved', moved, USER);
      expect(e.notSupported(e.snapshot(ledger)).map((n) => n.slotId)).not.toContain('moved');
    }
    expect(() => e.answer(ledger, 'moved', 'within_zg', USER)).toThrow(QuestionnaireError);
  });
});
