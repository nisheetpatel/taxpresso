// What the dashboard shows about documents (SPEC.md 5.5, 5.8, 10.5 second view, 10.8): one card
// per document with its values, the "Check this" items, and the assessment against what was
// declared. Derived from the workspace on every read; nothing here is stored.
import type { Fact, Owner } from '@taxpresso/ledger';
import type { Lang } from '@taxpresso/questionnaire';
import {
  ASSESSMENT_ITEMS_2026,
  assessmentText,
  documentFields,
  formatDay,
  OBJECTION_2026,
  type DocumentKey2026,
} from '@taxpresso/rules-ge';
import { ENUM_LABELS, formValue } from './extraction.js';
import { KIND_LABELS } from './kinds.js';
import type { Workspace } from './workspace.js';

export interface CardValue {
  factId: string;
  key: string;
  person: Owner;
  label: string;
  official?: string;
  box?: string;
  page?: number;
  type: string;
  /** Money in centimes; the page formats it for its language. */
  centimes?: number;
  /** Anything else, in words. */
  text?: string;
  /** As typed into the official form; absent when there is nothing to type. */
  copy?: string;
  status: Fact['status'];
  via?: 'chat' | 'dashboard';
  entered: boolean;
}

const YES_NO = { en: ['Yes', 'No'], fr: ['Oui', 'Non'] } as const;

function cardValue(ws: Workspace, fact: Fact, lang: Lang): CardValue {
  const def = ws.keys[fact.key]!;
  const text =
    def.type === 'boolean'
      ? YES_NO[lang][fact.value ? 0 : 1]
      : def.type === 'enum'
        ? (ENUM_LABELS[fact.key]?.[String(fact.value)]?.[lang] ?? String(fact.value))
        : def.type === 'date'
          ? formatDay(String(fact.value), lang)
          : def.type === 'money'
            ? undefined
            : String(fact.value);
  const copy = formValue(def, fact.value);
  return {
    factId: fact.id,
    key: fact.key,
    person: fact.person,
    label: def.label[lang],
    ...(def.official ? { official: def.official } : {}),
    ...(def.box ? { box: def.box } : {}),
    ...(fact.source.page ? { page: fact.source.page } : {}),
    type: def.type,
    ...(def.type === 'money' && typeof fact.value === 'number' ? { centimes: fact.value } : {}),
    ...(text !== undefined ? { text } : {}),
    ...(copy !== undefined ? { copy } : {}),
    status: fact.status,
    ...(fact.source.via ? { via: fact.source.via } : {}),
    entered: ws.isEntered(fact),
  };
}

/** One card per document that counts, with the values read from it in the form's order. */
export function documentCards(ws: Workspace, lang: Lang) {
  const facts = ws.countedFacts();
  const people = ws.engine.file.people;
  const couple = ws.snapshot().people.length > 1;
  return ws
    .activeDocuments()
    .map((doc) => {
      const order: readonly string[] = documentFields(doc.kind);
      const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
      const values = facts
        .filter((f) => f.source.docId === doc.id && f.key !== 'check.note')
        .sort((a, b) => rank(a.key) - rank(b.key) || a.person.localeCompare(b.person))
        .map((f) => cardValue(ws, f, lang));
      // The assessment is checked, not typed into the declaration: no copy, no "Entered".
      const enterable = doc.kind !== 'tax_assessment';
      return {
        docId: doc.id,
        filename: doc.filename,
        ...(doc.kind ? { kind: doc.kind, kindLabel: KIND_LABELS[doc.kind][lang] } : {}),
        ...(doc.kindSource ? { kindSource: doc.kindSource } : {}),
        ...(doc.person ? { person: doc.person } : {}),
        ...(couple && (doc.person === 'p1' || doc.person === 'p2')
          ? { who: people[doc.person][lang] }
          : {}),
        ...(doc.taxYear ? { taxYear: doc.taxYear } : {}),
        ...(doc.issuer ? { issuer: doc.issuer } : {}),
        ...(doc.periodFrom && doc.periodTo
          ? { period: { from: formatDay(doc.periodFrom, lang), to: formatDay(doc.periodTo, lang) } }
          : {}),
        read: doc.parse.method !== 'none',
        enterable,
        values,
        toConfirm: values.filter((v) => v.status === 'extracted').length,
        entered: enterable ? values.filter((v) => v.entered).length : 0,
        total: enterable ? values.length : 0,
      };
    })
    .filter((card) => card.values.length > 0 || card.read);
}

/** The "Check this" items, in the page's language. */
export function documentChecks(ws: Workspace, lang: Lang) {
  const names = new Map(ws.documents.map((d) => [d.id, d.filename]));
  return ws.checks().map((c) => ({
    id: c.id,
    rule: c.rule,
    title: c.title[lang],
    detail: c.detail[lang],
    todo: c.todo[lang],
    documents: c.documents.map((id) => ({ id, filename: names.get(id) ?? id })),
    ...(c.source ? { source: c.source } : {}),
    ...(c.resolved ? { resolved: c.resolved } : {}),
  }));
}

const TAX_LABEL = {
  icc: { en: 'Cantonal and communal tax (ICC)', fr: 'Impôt cantonal et communal (ICC)' },
  ifd: { en: 'Federal direct tax (IFD)', fr: 'Impôt fédéral direct (IFD)' },
} as const;

/** "Your assessment": assessed against declared, and the deadline to object with its law. */
export function assessmentCards(ws: Workspace, lang: Lang) {
  const names = new Map(ws.documents.map((d) => [d.id, d.filename]));
  const text = assessmentText(OBJECTION_2026.icc.days.value);
  const label = (key: string) => {
    const def = ws.keys[key as DocumentKey2026];
    return { label: def?.label[lang] ?? key, ...(def?.official ? { official: def.official } : {}) };
  };
  return ws.assessments().map((a) => ({
    docId: a.docId,
    filename: names.get(a.docId) ?? a.docId,
    taxes: a.taxes.map((t) => TAX_LABEL[t][lang]),
    ...(a.notificationDate ? { notificationDate: formatDay(a.notificationDate, lang) } : {}),
    deadlines: a.deadlines.map((d) => ({
      tax: TAX_LABEL[d.tax][lang],
      date: formatDay(d.date, lang),
      iso: d.date,
      movedFromWeekend: d.movedFromWeekend,
      law: d.law,
      sources: d.sources,
    })),
    // In the table, an item is named as declared ("Total gross salary"), with the assessment's term.
    items: a.items.map((i) => {
      const declared = ASSESSMENT_ITEMS_2026.find((x) => x.assessed === i.key)?.declared[0];
      const own = label(i.key);
      return {
        ...i,
        ...own,
        label: (declared && ws.keys[declared]?.label[lang]) ?? own.label,
      };
    }),
    totals: a.totals.map((t) => ({ ...t, ...label(t.key) })),
    unconfirmed: a.unconfirmed,
    text: {
      noDate: text.noDate![lang],
      counting: text.counting![lang],
      notAMistake: text.notAMistake![lang],
      never: text.never![lang],
    },
  }));
}
