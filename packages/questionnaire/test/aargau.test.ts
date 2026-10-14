// The Aargau questionnaire (data/ag/2026/questionnaire.yaml): in step with Aargau's keys, communes
// and parishes (packages/rules-ag), every text in English, French and German, every page an
// official one, and the questions only Aargau asks (who mainly bears a shared child's upkeep, each
// child's age band and childcare, the church and the further parish) only where they apply.
// Synthetic answers only.
import { readFileSync } from 'node:fs';
import { Ledger } from '@taxpresso/ledger';
import { agKeys, communeOptions, parishOptions } from '@taxpresso/rules-ag';
import { KEYS_CANTON_2026 } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  NBSP,
  QuestionnaireEngine,
  QuestionnaireError,
  agQuestionnaire2026,
  sharedQuestionnaire2026,
  type Condition,
} from '../src/index.js';

const KEYS = { ...KEYS_CANTON_2026, ...agKeys(2026) };
const engine = () => new QuestionnaireEngine(agQuestionnaire2026(), KEYS, communeOptions(2026));
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
const AG_URLS = urls('../../../docs/sources/ag/manifest.json');
const ALL_URLS = urls('../../../docs/sources/manifest.json');
const GUIDE =
  'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/natuerliche-personen/steuererklaerung/wegleitung-zur-steuererkl-rung-2025-kanton-aargau.pdf';

/** A single employee in Aarau (synthetic). */
const SINGLE_IN_AARAU = {
  canton: 'AG',
  civil_status: 'single',
  children: 0,
  commune: 'Aarau',
  moved: 'no',
  'church:p1': 'none',
  'income_sources:p1': ['salary'],
  'employers:p1': 1,
  'taxed_at_source:p1': false,
  'pillar3a:p1': true,
  'lpp_buyin:p1': false,
  'commute:p1': 'public_transport',
  'commute_transit_cost:p1': 1_200,
  'meal_days:p1': 200,
  banks: 1,
  crypto: false,
  payments: [],
  special: [],
};

describe('Aargau questionnaire 2026', () => {
  it('matches Aargau’s 2026 keys and communes exactly (the key-drift check)', () => {
    expect(engine().check()).toEqual([]);
    expect(communeOptions(2026)).toHaveLength(196);
  });

  it('takes the questions every canton shares, in the guide’s order', () => {
    const file = agQuestionnaire2026();
    const ids = file.questions.map((q) => q.id);
    expect(ids).toEqual([
      'canton',
      'civil_status',
      'children',
      'children_custody',
      'child_support',
      'main_upkeep',
      'child_band',
      'childcare',
      'child_care',
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
      'special',
    ]);
    const shared = new Set(sharedQuestionnaire2026().questions.map((q) => q.id));
    expect(ids.filter((id) => !shared.has(id))).toEqual([
      'main_upkeep',
      'child_band',
      'child_care',
      'commune',
      'moved',
      'church',
      'parish',
    ]);
    // No "over 2 hours" choice on the way to work: only Geneva's meal rule needs it.
    const options = (id: string) => file.questions.find((q) => q.id === id)!.options!;
    expect(options('commute').map((o) => o.value)).not.toContain('public_transport_long');
    expect(options('commute_transit_usable').map((o) => o.value)).toEqual(['yes', 'no']);
    expect(file.people.child).toEqual({ en: 'Child {n}', fr: 'Enfant {n}', de: 'Kind {n}' });
    expect(file.place).toEqual({ en: 'Aargau', fr: 'Argovie', de: 'Aargau' });
  });

  it('says everything in English, French and German, with an official page', () => {
    const file = agQuestionnaire2026();
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
    visit(file, 'ag');
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
      // Aargau's own documents; the canton question keeps its federal page (shared).
      expect(item.id === 'canton' ? ALL_URLS : AG_URLS, item.id).toContain(
        url.replace(/#page=\d+$/, ''),
      );
      // A page of the guide is named by the page the link opens.
      if (url.startsWith(`${GUIDE}#page=`)) {
        const page = url.slice(`${GUIDE}#page=`.length);
        expect(label.en, item.id).toMatch(new RegExp(`^Aargau tax guide 2025, p\\. ${page}: `));
        expect(label.fr, item.id).toMatch(
          new RegExp(`^Guide fiscal argovien 2025, p\\. ${page}${NBSP}: `),
        );
        expect(label.de, item.id).toMatch(
          new RegExp(`^Wegleitung zur Steuererklärung 2025, S\\. ${page}: `),
        );
      }
    }
    // Every document cites the Aargau guide, by the page of the PDF.
    for (const r of file.requirements) {
      expect(r.source, r.id).toMatch(/^ag-2025-guide-wegleitung p\. \d+(, p\. \d+)*$/);
    }
    // Informal German: no "Sie" addressed to the user in Taxpresso's text.
    const de = JSON.stringify(file.questions.map((q) => [q.text, q.help, q.explain]));
    expect(de).not.toMatch(/\b(Ihr|Ihre|Ihrem|Ihren|Ihrer|Ihnen|Sie haben|haben Sie)\b/);
    expect(file.notSupported.en).toMatch(/eTAX AARGAU/);
    expect(file.notSupported.de).toMatch(/etax\.ag\.ch/);
  });

  it('offers each commune’s own parish and its further parishes, from the canton’s list, only where a church has one', () => {
    const parish = agQuestionnaire2026().questions.find((q) => q.id === 'parish')!;
    const table = parishOptions(2026);
    expect(new Set(table.map((o) => o.slug)).size).toBe(18);
    // The options are the list's parishes, each offered only in its own commune, a further one
    // only to a member of its church.
    expect(
      parish.options!.map((o) => [o.value, o.label.en, o.label.fr, o.label.de, o.when]),
    ).toEqual(
      table.map((o) => [
        o.value,
        o.own ? `${o.commune} (the commune’s own parish)` : `${o.commune}: ${o.parish}`,
        o.own ? `${o.commune} (paroisse de la commune)` : `${o.commune}${NBSP}: ${o.parish}`,
        o.own ? `${o.commune} (Kirchgemeinde der Gemeinde)` : `${o.commune}: ${o.parish}`,
        o.own
          ? { key: 'profile.commune', eq: o.slug }
          : {
              all: [
                { key: 'profile.commune', eq: o.slug },
                { key: 'ag.church', in: [...o.churches], anyPerson: true },
              ],
            },
      ]),
    );
    // Asked of a member of a church with a further parish in the commune.
    const asked = new Map<string, string[]>();
    for (const branch of parish.when!.any!) {
      const commune = branch.all!.find((c: Condition) => c.key === 'profile.commune')!;
      const church = branch.all!.find((c: Condition) => c.key === 'ag.church')!;
      expect(church.anyPerson).toBe(true);
      for (const slug of commune.in!) asked.set(slug, [...church.in!].sort());
    }
    const own = table.filter((o) => o.own);
    expect(Object.fromEntries([...asked].sort())).toEqual(
      Object.fromEntries(own.map((o) => [o.slug, [...o.churches].sort()] as const).sort()),
    );
  });

  it('asks a single employee in Aarau 18 questions, then lists what is missing', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    const asked = walk(e, ledger, SINGLE_IN_AARAU);
    expect(asked).toEqual(Object.keys(SINGLE_IN_AARAU));
    expect(ledger.get('profile.commune')?.value).toBe('aarau');
    const snap = e.snapshot(ledger);
    expect(e.next(snap)).toBeUndefined();
    expect(e.notSupported(snap)).toEqual([]);
    expect(e.chips(snap, 'en')).toEqual([
      'Aargau',
      'Single',
      'No children',
      'Aarau',
      '1 employer',
      'Pays into 3a',
      '1 bank',
    ]);
    expect(e.requirements(snap, []).map((r) => [r.id, r.source])).toEqual([
      ['salary_certificate:p1', 'ag-2025-guide-wegleitung p. 13'],
      ['pillar3a:p1', 'ag-2025-guide-wegleitung p. 26'],
      ['health_premiums:p1', 'ag-2025-guide-wegleitung p. 27, p. 42'],
      ['banks', 'ag-2025-guide-wegleitung p. 34'],
    ]);
  });

  it('finds a commune by its name, accents and punctuation aside, and refuses another canton’s', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, { canton: 'AG', civil_status: 'married', children: 0 });
    e.answer(ledger, 'commune', 'bottstein', USER);
    expect(ledger.get('profile.commune')?.value).toBe('bottstein');
    e.answer(ledger, 'commune', 'Brugg (AG)', USER);
    expect(ledger.get('profile.commune')?.value).toBe('brugg-ag');
    expect(() => e.answer(ledger, 'commune', 'Carouge', USER)).toThrow(QuestionnaireError);
  });

  it('asks who mainly bears the upkeep only in shared custody without child support', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'AG',
      civil_status: 'divorced',
      children: 2,
      children_custody: 'shared',
      child_support: 'none_i_earn_more',
    });
    expect(e.next(e.snapshot(ledger))?.id).toBe('main_upkeep');
    e.answer(ledger, 'main_upkeep', true, USER);
    expect(ledger.get('ag.main_upkeep')?.value).toBe(true);
    for (const support of ['i_receive', 'i_pay']) {
      e.answer(ledger, 'child_support', support, USER);
      expect(slotIds(e, ledger)).not.toContain('main_upkeep');
    }
    e.answer(ledger, 'child_support', 'none_unsure', USER);
    e.answer(ledger, 'children_custody', 'with_household', USER);
    expect(slotIds(e, ledger)).not.toContain('main_upkeep');
  });

  it('asks each child’s age band, and the childcare per child only with several children', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'AG',
      civil_status: 'married',
      children: 2,
      children_custody: 'with_household',
    });
    let snap = e.snapshot(ledger);
    expect(snap.slots.filter((s) => s.question.id === 'child_band').map((s) => s.id)).toEqual([
      'child_band:child1',
      'child_band:child2',
    ]);
    const second = snap.slots.find((s) => s.id === 'child_band:child2')!;
    expect(e.render(second, snap, 'en').text).toBe('How old was child 2 on 31 December 2026?');
    for (const lang of ['en', 'fr', 'de'] as const) {
      const r = e.render(second, snap, lang);
      expect(JSON.stringify([r.text, r.help, r.explain, r.who])).not.toMatch(/\{n\}/);
    }
    e.answer(ledger, 'child_band:child1', 'under14', USER);
    e.answer(ledger, 'child_band:child2', 'adult', USER);
    expect(ledger.get('ag.child_band', 'child2')?.value).toBe('adult');
    e.answer(ledger, 'childcare', 'creche_or_daycare', USER);
    snap = e.snapshot(ledger);
    expect(snap.slots.filter((s) => s.question.id === 'child_care').map((s) => s.id)).toEqual([
      'child_care:child1',
      'child_care:child2',
    ]);
    e.answer(ledger, 'child_care:child1', "9'000", USER);
    expect(ledger.get('ag.child_care', 'child1')?.value).toBe(900_000);
    // One child: the invoices' total is that child's, not asked.
    e.answer(ledger, 'children', 1, USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_care'))).toEqual([]);
    // Children mostly with the other parent: not asked at all.
    e.answer(ledger, 'children_custody', 'elsewhere', USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_band'))).toEqual([]);
  });

  it('asks the church of each adult, and the parish only where the commune has one of that church', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'AG',
      civil_status: 'married',
      children: 0,
      commune: 'Baden',
      moved: 'no',
      'church:p1': 'catholic',
      'church:p2': 'catholic',
    });
    expect(ledger.get('ag.church', 'p2')?.value).toBe('catholic');
    let snap = e.snapshot(ledger);
    const slot = snap.slots.find((s) => s.id === 'parish')!;
    // Baden: the commune's own parish and the further Roman Catholic one, not the Reformed one.
    expect(e.render(slot, snap, 'en').options!.map((o) => [o.value, o.label])).toEqual([
      ['baden:Baden', 'Baden (the commune’s own parish)'],
      ['baden:röm.-kath. Kirche Gebenstorf', 'Baden: röm.-kath. Kirche Gebenstorf'],
    ]);
    e.answer(ledger, 'parish', 'baden:röm.-kath. Kirche Gebenstorf', USER);
    expect(ledger.get('ag.parish')?.value).toBe('baden:röm.-kath. Kirche Gebenstorf');
    // Christ Catholic members in Baden: no further parish of their church, not asked.
    e.answer(ledger, 'church:p1', 'christ_catholic', USER);
    e.answer(ledger, 'church:p2', 'christ_catholic', USER);
    expect(slotIds(e, ledger)).not.toContain('parish');
    // A commune without a further parish: not asked.
    e.answer(ledger, 'church:p1', 'reformed', USER);
    e.answer(ledger, 'commune', 'Wettingen', USER);
    snap = e.snapshot(ledger);
    expect(snap.slots.map((s) => s.id)).not.toContain('parish');
  });

  it('says plainly what Aargau doesn’t cover yet', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'AG',
      civil_status: 'single',
      children: 0,
      commune: 'Lenzburg',
      moved: 'from_abroad',
      'church:p1': 'none',
      'income_sources:p1': ['salary', 'self_employment'],
      'employers:p1': 1,
      'taxed_at_source:p1': true,
    });
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.what.de)).toEqual([
      'Ein Zuzug aus dem Ausland während des Jahres (unterjährige Steuerpflicht)',
      'Die selbstständige Erwerbstätigkeit (2)',
      'Die Quellensteuer im Kanton Aargau und die nachträgliche ordentliche Veranlagung (NOV)',
    ]);
    expect(e.notSupportedMessage('en')).toMatch(/eTAX AARGAU/);
    // A move from another canton is supported: Aargau taxes the whole year.
    e.answer(ledger, 'moved', 'from_other_canton', USER);
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.slotId)).not.toContain('moved');
    expect(() => e.answer(ledger, 'moved', 'within_bern', USER)).toThrow(QuestionnaireError);
  });
});
