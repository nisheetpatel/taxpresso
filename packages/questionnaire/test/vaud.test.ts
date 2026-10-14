// The Vaud questionnaire (data/vd/2026/questionnaire.yaml): in step with Vaud's keys, communes and
// parts of communes (packages/rules-vd), every text in English, French and German, every page an
// official Vaud one, and the questions only Vaud asks (a household alone with the children and their
// main upkeep, childcare per child, the commune, its part and the move, the household contents, the
// interest on savings, the net rent) only where they apply. Synthetic answers only.
import { readFileSync } from 'node:fs';
import { Ledger } from '@taxpresso/ledger';
import { KEYS_CANTON_2026 } from '@taxpresso/rules-ch';
import { communeOptions, partOptions, vaudInputFromFacts, vaudKeys } from '@taxpresso/rules-vd';
import { describe, expect, it } from 'vitest';
import {
  NBSP,
  QuestionnaireEngine,
  QuestionnaireError,
  sharedQuestionnaire2026,
  vdQuestionnaire2026,
} from '../src/index.js';

const KEYS = { ...KEYS_CANTON_2026, ...vaudKeys(2026) };
const engine = () => new QuestionnaireEngine(vdQuestionnaire2026(), KEYS, communeOptions(2026));
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

/** What rules-vd reads from the answers: Vaud's own part of the household input. */
const cantonal = (ledger: Ledger) => vaudInputFromFacts(2026, ledger.view(), []).input?.cantonal;

const urls = (path: string): Set<string> => {
  const raw = JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as
    { url: string }[] | { entries: { url: string }[] };
  return new Set((Array.isArray(raw) ? raw : raw.entries).map((e) => e.url));
};
const VAUD_URLS = urls('../../../docs/sources/vd/manifest.json');
const ALL_URLS = urls('../../../docs/sources/manifest.json');
const GUIDE =
  'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/21001_2025.pdf';

/** A single employee in Lausanne, renting a flat (synthetic). */
const SINGLE_IN_LAUSANNE = {
  canton: 'VD',
  civil_status: 'single',
  children: 0,
  commune: 'Lausanne',
  moved: 'no',
  'income_sources:p1': ['salary'],
  'employers:p1': 1,
  'taxed_at_source:p1': false,
  'commute:p1': 'public_transport',
  'commute_transit_cost:p1': 860,
  'meal_days:p1': 200,
  'pillar3a:p1': true,
  'lpp_buyin:p1': false,
  banks: 1,
  crypto: false,
  contents_high: false,
  savings_interest: '12.50',
  payments: [],
  rent: "18'000",
  special: [],
};

describe('Vaud questionnaire 2026', () => {
  it('matches Vaud’s 2026 keys and communes exactly (the key-drift check)', () => {
    expect(engine().check()).toEqual([]);
    expect(communeOptions(2026)).toHaveLength(300);
  });

  it('takes the questions every canton shares, in the Vaud return’s order', () => {
    const file = vdQuestionnaire2026();
    const ids = file.questions.map((q) => q.id);
    expect(ids).toEqual([
      'canton',
      'civil_status',
      'children',
      'children_custody',
      'child_support',
      'own_household',
      'main_upkeep',
      'childcare',
      'child_care',
      'commune',
      'commune_part',
      'moved',
      'income_sources',
      'employers',
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
      'banks',
      'crypto',
      'contents_high',
      'contents_value',
      'savings_interest',
      'payments',
      'rent',
      'special',
    ]);
    const shared = sharedQuestionnaire2026();
    const sharedIds = new Set(shared.questions.map((q) => q.id));
    expect(ids.filter((id) => !sharedIds.has(id))).toEqual([
      'own_household',
      'main_upkeep',
      'child_care',
      'commune',
      'commune_part',
      'moved',
      'contents_high',
      'contents_value',
      'savings_interest',
      'rent',
    ]);
    // Every document every canton asks for, in the shared order.
    expect(file.requirements.map((r) => r.id)).toEqual(shared.requirements.map((r) => r.id));
    // Vaud's way to work has no "over 2 hours" choice: only Geneva's meal rule needs it.
    const options = (id: string) => file.questions.find((q) => q.id === id)!.options!;
    expect(options('commute').map((o) => o.value)).not.toContain('public_transport_long');
    expect(options('commute_transit_usable').map((o) => o.value)).toEqual(['yes', 'no']);
    // The shared payments: political parties are not a choice of their own (no key value for it).
    expect(options('payments').map((o) => o.value)).toEqual([
      'medical_costs',
      'donations',
      'loan_interest',
      'alimony_paid',
    ]);
    expect(file.people.child).toEqual({ en: 'Child {n}', fr: 'Enfant {n}', de: 'Kind {n}' });
    expect(file.place).toEqual({ en: 'Vaud', fr: 'Vaud', de: 'Waadt' });
  });

  it('says everything in English, French and German, with an official Vaud page', () => {
    const file = vdQuestionnaire2026();
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
    visit(file, 'vd');
    expect(missing).toEqual([]);
    // No em or en dash anywhere; amounts only in the household contents question, whose page
    // prints them.
    expect(JSON.stringify(file)).not.toMatch(/[—–]/);
    expect(
      JSON.stringify(
        file.questions.filter((q) => q.id !== 'contents_high').map((q) => [q.text, q.explain]),
      ),
    ).not.toMatch(/CHF|Fr\.|franc/i);
    for (const item of [...file.questions, ...file.requirements]) {
      expect(item.explain?.de, item.id).toBeTruthy();
      const { url, label } = item.learnMore!;
      // Vaud's own documents; the canton question keeps its federal page (shared).
      expect(item.id === 'canton' ? ALL_URLS : VAUD_URLS, item.id).toContain(
        url.replace(/#page=\d+$/, ''),
      );
      // A page of the guide is named by the page the link opens.
      const page = url.startsWith(`${GUIDE}#page=`) ? url.slice(GUIDE.length + 6) : undefined;
      if (page) {
        expect(label.en, item.id).toMatch(new RegExp(`^Vaud tax guide 2025, p\\. ${page}: `));
        expect(label.fr, item.id).toMatch(
          new RegExp(`^Instructions générales 2025, p\\. ${page}${NBSP}: `),
        );
        expect(label.de, item.id).toMatch(
          new RegExp(`^Wegleitung Waadt 2025, S\\. ${page}: .*, auf Französisch$`),
        );
      } else if (item.id !== 'canton') {
        expect(label.de, item.id).toMatch(/auf Französisch$/);
      }
    }
    // Every document cites the Vaud guide, by the page of the PDF.
    for (const r of file.requirements) {
      expect(r.source, r.id).toMatch(
        /^vd-2025-guide p\. \d+(, p\. \d+)*(; vd-2025-form-21010 .+)?$/,
      );
    }
    // Informal German: no "Sie" addressed to the user in Taxpresso's text.
    const de = JSON.stringify(file.questions.map((q) => [q.text, q.help, q.explain]));
    expect(de).not.toMatch(/\b(Ihr|Ihre|Ihrem|Ihren|Ihrer|Ihnen|Sie haben|haben Sie)\b/);
    const ownHousehold = file.questions.find((q) => q.id === 'own_household')!;
    expect(ownHousehold.text).toMatchObject({
      de: 'Hast du am 31. Dezember 2026 allein mit deinen Kindern einen eigenen Haushalt geführt?',
      fr: `Au 31 décembre 2026, teniez-vous un ménage indépendant seul ou seule avec vos enfants${NBSP}?`,
    });
    // Annex 03's own question, word for word.
    expect(ownHousehold.help!.fr).toContain(
      `Tenez-vous un ménage indépendant seul avec cet (ces) enfant(s)${NBSP}?`,
    );
    expect(file.notSupported.en).toMatch(/VaudTax/);
    expect(file.notSupported.de).toMatch(/www\.vd\.ch\/vaudtax/);
    expect(JSON.stringify(file.notSupported)).not.toMatch(/free|gratuit|kostenlos/i);
  });

  it('offers the parts of L’Abbaye and Le Chenit from the communal table, each in its own commune', () => {
    const part = vdQuestionnaire2026().questions.find((q) => q.id === 'commune_part')!;
    const table = partOptions(2026);
    expect(table).toHaveLength(6);
    const communes = [...new Set(table.map((o) => o.commune))];
    expect(communes).toEqual(['l-abbaye', 'le-chenit']);
    expect(part.when).toEqual({ key: 'profile.commune', in: communes });
    expect(part.options!.map((o) => [o.value, o.when])).toEqual(
      table.map((o) => [o.value, { key: 'profile.commune', eq: o.commune }]),
    );
    // A fraction is named as the table names it; the rest of the commune says so.
    part.options!.forEach((o, i) => {
      const t = table[i]!;
      if (t.rate > 0) {
        expect([o.label.en, o.label.fr, o.label.de]).toEqual([
          `${t.communeName}: ${t.part}`,
          `${t.communeName}${NBSP}: ${t.part}`,
          `${t.communeName}: ${t.part}`,
        ]);
      } else {
        expect(o.label.en).toMatch(
          new RegExp(`^${t.communeName}: the rest of the commune, outside `),
        );
        expect(o.label.fr).toMatch(
          new RegExp(`^${t.communeName}${NBSP}: le reste de la commune, hors `),
        );
      }
    });
  });

  it('asks a single employee in Lausanne 20 questions, then lists what is missing', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    const asked = walk(e, ledger, SINGLE_IN_LAUSANNE);
    expect(asked).toEqual(Object.keys(SINGLE_IN_LAUSANNE));
    expect(ledger.get('profile.commune')?.value).toBe('lausanne');
    expect(ledger.get('vd.rent')?.value).toBe(1_800_000);
    expect(ledger.get('vd.savings_interest')?.value).toBe(1250);
    const snap = e.snapshot(ledger);
    expect(e.next(snap)).toBeUndefined();
    expect(e.notSupported(snap)).toEqual([]);
    expect(e.chips(snap, 'en')).toEqual([
      'Vaud',
      'Single',
      'No children',
      'Lausanne',
      '1 employer',
      'Pays into 3a',
      '1 bank',
    ]);
    expect(e.requirements(snap, []).map((r) => [r.id, r.source])).toEqual([
      ['salary_certificate:p1', 'vd-2025-guide p. 15, p. 17'],
      ['pillar3a:p1', 'vd-2025-guide p. 15, p. 30'],
      ['health_premiums:p1', 'vd-2025-guide p. 29'],
      ['banks', 'vd-2025-guide p. 15, p. 32'],
    ]);
    // rules-vd reads Vaud's answers: the rent (660), the contents under the deduction (440) and
    // the interest on savings (480).
    expect(cantonal(ledger)).toMatchObject({
      rent: { value: 1_800_000 },
      furnitureWithin: true,
      savingsInterest: { value: 1250 },
    });
    expect(cantonal(ledger)?.communePart).toBeUndefined();
  });

  it('asks whether you keep a household alone with your children only of a parent not married', () => {
    const e = engine();
    for (const status of ['married', 'registered_partnership']) {
      const ledger = new Ledger(2026, KEYS);
      walk(e, ledger, {
        canton: 'VD',
        civil_status: status,
        children: 2,
        children_custody: 'with_household',
      });
      expect(slotIds(e, ledger), status).not.toContain('own_household');
    }
    for (const status of ['single', 'separated', 'divorced', 'widowed']) {
      const ledger = new Ledger(2026, KEYS);
      walk(e, ledger, {
        canton: 'VD',
        civil_status: status,
        children: 1,
        children_custody: 'with_household',
      });
      expect(e.next(e.snapshot(ledger))?.id, status).toBe('own_household');
    }
    // No children, or children living mostly with the other parent: not asked.
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, { canton: 'VD', civil_status: 'divorced', children: 0 });
    expect(slotIds(e, ledger)).not.toContain('own_household');
    answerAll(e, ledger, [
      ['children', 2],
      ['children_custody', 'elsewhere'],
    ]);
    expect(slotIds(e, ledger)).not.toContain('own_household');
    // Shared custody: asked, after child support.
    e.answer(ledger, 'children_custody', 'shared', USER);
    expect(e.next(e.snapshot(ledger))?.id).toBe('child_support');
    e.answer(ledger, 'child_support', 'i_receive', USER);
    expect(e.next(e.snapshot(ledger))?.id).toBe('own_household');
    e.answer(ledger, 'own_household', true, USER);
    expect(ledger.get('vd.own_household')?.value).toBe(true);
  });

  it('asks who mainly bears the upkeep only with shared custody, no child support and your own household', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'VD',
      civil_status: 'divorced',
      children: 2,
      children_custody: 'shared',
      child_support: 'none_unsure',
      own_household: true,
    });
    expect(e.next(e.snapshot(ledger))?.id).toBe('main_upkeep');
    e.answer(ledger, 'main_upkeep', true, USER);
    expect(ledger.get('vd.main_upkeep')?.value).toBe(true);
    for (const none of ['none_i_earn_more', 'none_other_earns_more']) {
      e.answer(ledger, 'child_support', none, USER);
      expect(slotIds(e, ledger), none).toContain('main_upkeep');
    }
    // Living as a couple, or not keeping a household alone: no part of 1.3 to give, not asked.
    e.answer(ledger, 'own_household', false, USER);
    expect(slotIds(e, ledger)).not.toContain('main_upkeep');
    e.answer(ledger, 'own_household', true, USER);
    // With child support, the documents say who counts the children: not asked.
    for (const support of ['i_receive', 'i_pay']) {
      e.answer(ledger, 'child_support', support, USER);
      expect(slotIds(e, ledger), support).not.toContain('main_upkeep');
    }
    // Nor when the children live with you.
    e.answer(ledger, 'child_support', 'none_unsure', USER);
    e.answer(ledger, 'children_custody', 'with_household', USER);
    expect(slotIds(e, ledger)).not.toContain('main_upkeep');
  });

  it('asks the childcare once per child, with the child’s number, when there are several', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'VD',
      civil_status: 'married',
      children: 2,
      children_custody: 'with_household',
      childcare: 'creche_or_daycare',
    });
    const snap = e.snapshot(ledger);
    const slots = snap.slots.filter((s) => s.question.id === 'child_care');
    expect(slots.map((s) => s.id)).toEqual(['child_care:child1', 'child_care:child2']);
    expect(e.next(snap)?.id).toBe('child_care:child1');
    const second = e.render(slots[1]!, snap, 'en');
    expect(second.who).toBe('Child 2');
    expect(second.text).toBe('How much of the childcare you paid in 2026 was for child 2?');
    expect(e.render(slots[0]!, snap, 'fr').who).toBe('Enfant 1');
    for (const lang of ['en', 'fr', 'de'] as const) {
      const r = e.render(slots[0]!, snap, lang);
      expect(JSON.stringify([r.text, r.help, r.explain, r.who])).not.toMatch(/\{n\}/);
    }
    e.answer(ledger, 'child_care:child1', 0, USER);
    e.answer(ledger, 'child_care:child2', "4'800", USER);
    expect(ledger.get('vd.child_care', 'child2')?.value).toBe(480_000);
    expect(e.next(e.snapshot(ledger))?.id).toBe('commune');
    // No childcare, or a single child: not asked.
    e.answer(ledger, 'childcare', 'none', USER);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_care'))).toEqual([]);
    answerAll(e, ledger, [
      ['childcare', 'nanny'],
      ['children', 1],
    ]);
    expect(slotIds(e, ledger).filter((id) => id.startsWith('child_care'))).toEqual([]);
  });

  it('asks the fire insurance value only when the household contents may be taxed', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    answerAll(e, ledger, [
      ['canton', 'VD'],
      ['civil_status', 'married'],
      ['contents_high', false],
    ]);
    expect(slotIds(e, ledger)).not.toContain('contents_value');
    expect(cantonal(ledger)).toBeUndefined(); // no commune yet: nothing is read
    e.answer(ledger, 'contents_high', true, USER);
    expect(slotIds(e, ledger)).toContain('contents_value');
    answerAll(e, ledger, [
      ['contents_value', "450'000"],
      ['commune', 'Morges'],
    ]);
    expect(ledger.get('vd.contents_value')?.value).toBe(45_000_000);
    expect(cantonal(ledger)).toMatchObject({ furnitureInsurance: { value: 45_000_000 } });
    // The question names the amounts for one person and for a couple.
    const text = vdQuestionnaire2026().questions.find((q) => q.id === 'contents_high')!.text;
    expect('en' in text && text.en).toMatch(/200,000.*400,000.*married couple/);
  });

  it('asks the interest on savings only with a bank, an answer replacing the accounts’ interest', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    answerAll(e, ledger, [
      ['canton', 'VD'],
      ['civil_status', 'single'],
      ['banks', 0],
    ]);
    expect(slotIds(e, ledger)).not.toContain('savings_interest');
    e.answer(ledger, 'banks', 2, USER);
    expect(slotIds(e, ledger)).toContain('savings_interest');
    e.answer(ledger, 'savings_interest', 0, USER);
    expect(ledger.get('vd.savings_interest')?.value).toBe(0);
    const q = vdQuestionnaire2026().questions.find((x) => x.id === 'savings_interest')!;
    expect(q.help!.en).toMatch(/replaces the interest Taxpresso reads from your bank documents/);
  });

  it('asks the part only in L’Abbaye and Le Chenit, and drops it when the commune changes', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, { canton: 'VD', civil_status: 'single', children: 0, commune: 'le-chenit' });
    let snap = e.snapshot(ledger);
    expect(e.next(snap)?.id).toBe('commune_part');
    let slot = snap.slots.find((s) => s.id === 'commune_part')!;
    expect(e.render(slot, snap, 'en').options!.map((o) => o.value)).toEqual([
      'le-chenit:le-chenit',
      'le-chenit:le-brassus',
      'le-chenit:le-sentier',
      'le-chenit:l-orient',
    ]);
    e.answer(ledger, 'commune_part', 'le-chenit:le-brassus', USER);
    expect(ledger.get('vd.commune_part')?.value).toBe('le-chenit:le-brassus');
    expect(cantonal(ledger)?.communePart).toBe('Le Brassus');
    // Lausanne has no fractions: the part no longer applies, nor counts.
    e.answer(ledger, 'commune', 'lausanne', USER);
    snap = e.snapshot(ledger);
    expect(snap.slots.map((s) => s.id)).not.toContain('commune_part');
    expect([...snap.answers.keys()].some((k) => k.startsWith('vd.commune_part'))).toBe(false);
    expect(cantonal(ledger)?.communePart).toBeUndefined();
    // L'Abbaye: asked again, with its own parts; Le Chenit's part doesn't answer there.
    e.answer(ledger, 'commune', "L'Abbaye", USER);
    expect(ledger.get('profile.commune')?.value).toBe('l-abbaye');
    snap = e.snapshot(ledger);
    slot = snap.slots.find((s) => s.id === 'commune_part')!;
    expect(slot.value).toBeUndefined();
    expect(e.render(slot, snap, 'fr').options!.map((o) => o.value)).toEqual([
      'l-abbaye:l-abbaye',
      'l-abbaye:les-bioux',
    ]);
    expect(cantonal(ledger)?.communePart).toBeUndefined();
    expect(() => e.answer(ledger, 'commune', 'Carouge', USER)).toThrow(/not a Vaud commune/);
  });

  it('says plainly what Vaud doesn’t cover yet', () => {
    const e = engine();
    const ledger = new Ledger(2026, KEYS);
    walk(e, ledger, {
      canton: 'VD',
      civil_status: 'single',
      children: 0,
      commune: 'Yverdon-les-Bains',
      moved: 'from_abroad',
      'income_sources:p1': ['salary', 'self_employment'],
      'employers:p1': 1,
      'taxed_at_source:p1': true,
    });
    expect(ledger.get('profile.commune')?.value).toBe('yverdon-les-bains');
    expect(e.notSupported(e.snapshot(ledger)).map((n) => n.what.de)).toEqual([
      'Ein Zuzug aus dem Ausland während des Jahres (arrivée de l’étranger)',
      'Die selbständige Erwerbstätigkeit (activité indépendante, Codes 180 bis 190)',
      'Die Quellensteuer im Kanton Waadt (impôt à la source) und die nachträgliche ordentliche Veranlagung (taxation ordinaire ultérieure, TOU)',
    ]);
    expect(e.notSupportedMessage('en')).toMatch(/VaudTax/);
    // A move from another canton, or within Vaud, is supported: Vaud taxes the whole year.
    for (const moved of ['from_other_canton', 'within_vaud']) {
      e.answer(ledger, 'moved', moved, USER);
      expect(e.notSupported(e.snapshot(ledger)).map((n) => n.slotId)).not.toContain('moved');
    }
    expect(() => e.answer(ledger, 'moved', 'within_bern', USER)).toThrow(QuestionnaireError);
  });
});
