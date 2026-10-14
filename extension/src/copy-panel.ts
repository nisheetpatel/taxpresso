// The copy panel (SPEC.md 10.5) for the dashboard and for Claude: the values to type into the
// official declaration, in the form's order. Items come from the ledger (values read from
// documents and answers, through @taxpresso/filing-ge's routes); the rubrics the tax engine
// computes (flat deductions, two-earner, insurance limits, family and wealth deductions, net and
// taxable income) come from the engine and take over rubric by rubric (mergeItems). Derived on every read; only the "Entered"
// ticks are stored, in entered.json in the vault, never in the ledger.
import type { FactStatus, Owner } from '@taxpresso/ledger';
import {
  buildCopyPanel,
  ENGINE_RUBRICS_2026,
  enteredValue,
  filing as genevaFiling,
  itemsFromLedger,
  mergeItems,
  type CopyPanel,
  type CopyRow,
  type FormColumn,
  type FormItem,
} from '@taxpresso/filing-ge';
import type { Line } from '@taxpresso/rules-ch';
import { CANTONS } from './cantons.js';
import type { ContentLang as Lang } from './lang.js';
import { WorkspaceError, type Workspace } from './workspace.js';

/** Rubrics the engine computes, by the column they fill (@taxpresso/filing-ge, cited there). */
const ENGINE_RUBRICS = {
  icc: new Set<string>(ENGINE_RUBRICS_2026.icc),
  ifd: new Set<string>(ENGINE_RUBRICS_2026.ifd),
  info: new Set<string>(ENGINE_RUBRICS_2026.info),
};

/** The engine's values for the rubrics it computes (SPEC.md section 7), as form items. */
export function engineItems(ws: Workspace): FormItem[] {
  const r = ws.taxEstimate().result;
  if (!r) return [];
  const status = (l: Line): FactStatus =>
    l.needsOk ? 'extracted' : l.estimates?.length || l.incomplete ? 'estimate' : 'computed';
  const out: FormItem[] = [];
  const add = (code: string, person: Owner, l: Line, column?: FormColumn, amount = l.amount) =>
    out.push({
      code,
      person,
      ...(column ? { column } : {}),
      amount: Math.abs(amount),
      status: status(l),
      source: { ...(l.facts ? { facts: l.facts } : {}), rule: l.sources.join('; ') },
    });
  const icc = r.icc;
  const ifd = r.ifd;
  for (const i of icc?.items ?? [])
    if (ENGINE_RUBRICS.icc.has(i.code)) add(i.code, i.person, i, 'icc');
  for (const i of ifd?.items ?? [])
    if (ENGINE_RUBRICS.ifd.has(i.code)) add(i.code, i.person, i, 'ifd');
  if (icc) {
    const life = icc.items.find((i) => i.code === '52.15');
    if (life) add('52.15', 'household', life);
    const insurance = icc.items.filter((i) => i.code === '52.15' || i.code === '52.21');
    if (insurance.length) {
      add(
        '52.00',
        'household',
        insurance[0]!,
        'icc',
        insurance.reduce((s, i) => s + i.amount, 0),
      );
    }
    add('95.00', 'household', icc.totalIncome, 'icc');
    add('99.00', 'household', icc.taxableIncome, 'icc');
    // The wealth page only when there is wealth to declare.
    if (icc.wealth.grossWealth.amount > 0) {
      add('51.50', 'household', icc.wealth.socialDeduction, 'wealth');
      add('95.00', 'household', icc.wealth.taxableWealth, 'wealth');
      add('99.00', 'household', icc.wealth.taxableWealth, 'wealth');
    }
  }
  if (ifd) {
    const insurance = ifd.items.find((i) => i.code === '52.00');
    if (insurance) add('52.00', 'household', insurance, 'ifd');
    add('95.00', 'household', ifd.totalIncome, 'ifd');
    add('99.00', 'household', ifd.taxableIncome, 'ifd');
  }
  // The lump sums from the 2nd pillar and pillar 3a counted for the year (98.12, one amount for
  // the household: the spouses' add up in its box).
  for (const i of r.capital?.items ?? [])
    if (ENGINE_RUBRICS.info.has(i.code)) add(i.code, i.person, i, 'amount');
  return out;
}

export type CopyPanelRowView = Omit<CopyRow, 'documents'> & {
  documents: { id: string; filename: string }[];
};

export interface CopyPanelView extends Omit<CopyPanel, 'sections'> {
  sections: (Omit<CopyPanel['sections'][number], 'groups'> & {
    groups: (Omit<CopyPanel['sections'][number]['groups'][number], 'rows'> & {
      rows: CopyPanelRowView[];
    })[];
  })[];
  couple: boolean;
  /** Values read from documents that can't be placed yet, and why (the user says what they are). */
  waiting: { label: string; filename?: string }[];
}

/** The documents each value was read from, through the facts behind it. */
function withDocuments(ws: Workspace, items: FormItem[]): FormItem[] {
  const docOf = new Map(ws.countedFacts().map((f) => [f.id, f.source.docId]));
  return items.map((i) => {
    const documents = [
      ...new Set((i.source?.facts ?? []).map((id) => docOf.get(id)).filter((d) => d !== undefined)),
    ];
    return documents.length ? { ...i, source: { ...i.source, documents } } : i;
  });
}

function panel(ws: Workspace, lang: Lang): { panel: CopyPanel; waiting: CopyPanelView['waiting'] } {
  // A canton Taxpresso covers, but not for this year: no form, nothing to type (fail closed).
  if (ws.canton().notOffered) {
    const empty: CopyPanel = {
      taxYear: ws.taxYear,
      formYear: ws.taxYear,
      provisional: false,
      sections: [],
      entered: 0,
      total: 0,
      pending: 0,
      unplaced: [],
    };
    return { panel: empty, waiting: [] };
  }
  // A canton whose filing package gives the values to type from its engine (Zurich's,
  // @taxpresso/filing-zh): every value from its result, on its form.
  const filing = ws.canton().canton?.filing;
  if (filing?.formValues) {
    const result = ws.estimate().result;
    return {
      panel: buildCopyPanel({
        form: filing.formMap(ws.engine.taxYear),
        items: result ? withDocuments(ws, [...filing.formValues(result)]) : [],
        lang,
        entered: (id) => ws.formEntered(id),
        ...(filing.labels ? { labels: filing.labels } : {}),
      }),
      waiting: [],
    };
  }
  const people = ws.snapshot().people.filter((p): p is 'p1' | 'p2' => p === 'p1' || p === 'p2');
  const { items, unplaced } = itemsFromLedger({
    facts: ws.countedFacts(),
    documents: ws.activeDocuments(),
    people,
    taxYear: ws.engine.taxYear,
  });
  // The form of the year (@taxpresso/filing-ge, FORMS): none for another year (fail closed).
  const form = genevaFiling.formMap(ws.taxYear);
  const built = buildCopyPanel({
    form,
    items: mergeItems(engineItems(ws), items),
    lang,
    entered: (id) => ws.formEntered(id),
  });
  const names = new Map(ws.documents.map((d) => [d.id, d.filename]));
  const waiting = unplaced.map((u) => {
    const filename = u.docId ? names.get(u.docId) : undefined;
    return { label: ws.keys[u.key]?.label[lang] ?? u.key, ...(filename ? { filename } : {}) };
  });
  return { panel: built, waiting };
}

/** The copy panel for the dashboard, in the page's language. */
export function copyPanelView(ws: Workspace, lang: Lang): CopyPanelView {
  const { panel: p, waiting } = panel(ws, lang);
  const names = new Map(ws.documents.map((d) => [d.id, d.filename]));
  return {
    ...p,
    sections: p.sections.map((s) => ({
      ...s,
      groups: s.groups.map((g) => ({
        ...g,
        rows: g.rows.map((r) => ({
          ...r,
          documents: r.documents.map((id) => ({ id, filename: names.get(id) ?? id })),
        })),
      })),
    })),
    couple: ws.snapshot().people.length > 1,
    waiting,
  };
}

/** The user ticks (or unticks) a row as entered. Only a final value the user types can be ticked. */
export async function setRowEntered(ws: Workspace, rowId: string, entered: boolean): Promise<void> {
  await ws.ready();
  if (!entered) return ws.setFormEntered(rowId, undefined);
  const row = panel(ws, 'en')
    .panel.sections.flatMap((s) => s.groups.flatMap((g) => g.rows))
    .find((r) => r.id === rowId);
  if (!row) throw new WorkspaceError('This value is no longer there. Reload the dashboard.');
  if (!row.enterable) {
    throw new WorkspaceError(
      row.final
        ? 'The form works this one out: there is nothing to type.'
        : 'Confirm this value first: it still needs your OK or is an estimate.',
    );
  }
  return ws.setFormEntered(rowId, enteredValue(row));
}

// --- For Claude: concise text, section by section (C6) ----------------------------------------

const STATUS: Record<FactStatus, string> = {
  verified: 'Verified',
  extracted: 'Needs your OK',
  stated: 'Confirmed by you',
  estimate: 'Estimate',
  computed: 'Computed',
};

const chf = (centimes: number) => {
  const abs = Math.abs(centimes);
  return `CHF ${(centimes < 0 ? '-' : '') + String((abs - (abs % 100)) / 100).replace(/\B(?=(\d{3})+$)/g, "'")}.${String(abs % 100).padStart(2, '0')}`;
};

function rowText(r: CopyRow, couple: boolean): string {
  const where = [
    r.part && (couple || r.part.id !== 'A') ? r.part.label : '',
    r.columns.map((c) => c.label).join(' + '),
  ]
    .filter(Boolean)
    .join(', ');
  const value =
    r.format === 'tick'
      ? 'tick the box'
      : r.copy !== undefined
        ? `${r.copy}${r.rounded && r.centimes !== undefined ? ` (from ${chf(r.centimes)}, rounded to the franc)` : ''}`
        : '';
  const fields = r.fields.map((f) => `${f.label}: ${f.value}`).join('; ');
  const state =
    r.role === 'total' || r.role === 'report' || r.role === 'computed'
      ? 'the form works this out: check it shows this'
      : !r.final
        ? `${STATUS[r.status]}: not final, the user resolves it before typing it`
        : `${STATUS[r.status]}${r.entered ? ', entered' : ''}`;
  return `- ${r.ref} ${r.label} (${r.gloss})${where ? ` [${where}]` : ''}: ${value}${fields ? `; ${fields}` : ''}. ${state}.`;
}

export interface FormValuesResult {
  text: string;
  structured: {
    provisional: boolean;
    entered: number;
    total: number;
    pending: number;
    sections: { page: string; title: string; entered: number; total: number; pending: number }[];
    rows?: {
      ref: string;
      label: string;
      copy?: string;
      status: string;
      final: boolean;
      role: string;
      entered: boolean;
    }[];
  };
}

/** The panel for get_form_values: sections with progress, or one section's values. */
export function formValues(ws: Workspace, section?: string): FormValuesResult {
  const notOffered = ws.canton().notOffered;
  if (notOffered) {
    throw new WorkspaceError(
      `Taxpresso can't prepare a ${ws.taxYear} return in ${notOffered.name.en} yet, so there is nothing to type. Suggest ${notOffered.software}, the canton's free software.`,
    );
  }
  const { panel: p, waiting } = panel(ws, 'en');
  const couple = ws.snapshot().people.length > 1;
  // Before the canton is known, Geneva's form (the defaults).
  const words = (ws.canton().canton ?? CANTONS.GE).filing.words;
  const sections = p.sections.map((s) => ({
    page: s.page,
    title: s.title,
    entered: s.entered,
    total: s.total,
    pending: s.pending,
  }));
  const head = [
    `Values to type into the official declaration, in the form's order (dashboard: "Fill in your declaration"). Amounts in whole francs, no separators, as the form asks${words.amounts}.${p.provisional ? ` ${p.note ?? ''}` : ''}`,
    `Entered: ${p.entered} of ${p.total}${p.pending ? `; ${p.pending} not final yet (need the user's OK or are estimates)` : ''}.`,
  ];
  if (waiting.length) {
    head.push(
      `Waiting for what they are: ${waiting.map((w) => `${w.label}${w.filename ? ` (${w.filename})` : ''}`).join('; ')}.`,
    );
  }
  if (words.guide) head.push(words.guide);
  if (couple) head.push(words.persons);
  const structured: FormValuesResult['structured'] = {
    provisional: p.provisional,
    entered: p.entered,
    total: p.total,
    pending: p.pending,
    sections,
  };
  if (!section) {
    const lines = p.sections.length
      ? p.sections.map(
          (s) =>
            `- ${s.page} ${s.title} (${s.gloss}): ${s.entered} of ${s.total} entered${s.pending ? `, ${s.pending} not final` : ''}`,
        )
      : [
          'Nothing to type yet: values come from the documents the user confirmed and their answers.',
        ];
    return {
      text: [
        ...head,
        'Sections:',
        ...lines,
        `Call again with section (e.g. "${words.example}") for its values.`,
      ].join('\n'),
      structured,
    };
  }
  const s = p.sections.find((x) => x.page.toLowerCase() === section.trim().toLowerCase());
  if (!s) {
    throw new WorkspaceError(
      `Nothing to type on ${section}. Sections with values: ${p.sections.map((x) => x.page).join(', ') || 'none yet'}.`,
    );
  }
  const rows = s.groups.flatMap((g) => g.rows);
  structured.rows = rows.map((r) => ({
    ref: r.ref,
    label: r.label,
    ...(r.copy !== undefined ? { copy: r.copy } : {}),
    status: r.status,
    final: r.final,
    role: r.role,
    entered: r.entered,
  }));
  const lines = [
    `${s.page} ${s.title} (${s.gloss}): ${s.entered} of ${s.total} entered.`,
    ...s.groups.flatMap((g) => [
      `${g.title} (${g.gloss})`,
      ...g.rows.map((r) => rowText(r, couple)),
    ]),
  ];
  return { text: [...head.slice(0, 1), ...lines].join('\n'), structured };
}
