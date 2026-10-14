// The copy panel (SPEC.md section 10.5): the values to type into the official declaration, page by
// page and section by section in the form's order, each with its rubric code, its official French
// label, its gloss, the value as the form expects it, and whether the user ticked it as entered.
// Pure: it places items on a form map; the extension supplies the items and the ticks.
import type { FactStatus, Owner } from '@taxpresso/ledger';
import {
  formText,
  isFinal,
  rubricRef,
  weakestStatus,
  type FormColumn,
  type FormItem,
  type FormMap,
  type FormPart,
  type FormPerson,
  type FormRubric,
  type Gloss,
  type RubricFormat,
  type RubricRole,
} from './form.js';

export type Lang = 'en' | 'fr';

/** How the form heads each part and column, with a gloss. */
export const PART_LABELS: Record<FormPart, { label: string; gloss: Gloss }> = {
  A: { label: 'Contr. A', gloss: { en: 'taxpayer A', fr: 'contribuable A' } },
  B: { label: 'Contr. B', gloss: { en: 'taxpayer B', fr: 'contribuable B' } },
  children: { label: 'Enfant(s)', gloss: { en: 'children', fr: 'enfants' } },
};

export const COLUMN_LABELS: Record<FormColumn, { label: string; gloss: Gloss }> = {
  icc_ifd: {
    label: 'ICC et IFD',
    gloss: { en: 'Geneva and federal tax', fr: 'impôt cantonal et fédéral' },
  },
  icc: { label: 'ICC', gloss: { en: 'Geneva tax', fr: 'impôt cantonal et communal' } },
  ifd: { label: 'IFD', gloss: { en: 'federal tax', fr: 'impôt fédéral direct' } },
  wealth: { label: 'Fortune', gloss: { en: 'wealth', fr: 'fortune' } },
  amount: { label: 'Montant', gloss: { en: 'amount', fr: 'montant' } },
  ia_subject: {
    label: 'Rendements bruts soumis à l’impôt anticipé',
    gloss: { en: 'income with Swiss withholding tax', fr: 'revenus soumis à l’impôt anticipé' },
  },
  ia_free: {
    label: 'Rendements bruts non soumis à l’impôt anticipé',
    gloss: {
      en: 'income without Swiss withholding tax',
      fr: 'revenus non soumis à l’impôt anticipé',
    },
  },
  value: {
    label: 'Valeur imposable au 31.12',
    gloss: { en: 'value on 31 December', fr: 'valeur au 31 décembre' },
  },
  fees: { label: 'Frais bancaires', gloss: { en: 'bank fees', fr: 'frais bancaires' } },
  savings_interest: {
    label: 'Intérêts échus de capitaux d’épargne',
    gloss: { en: 'interest on savings', fr: 'intérêts d’épargne' },
  },
};

export interface CopyRow {
  /** Stable id for this value's place on the form: the key of its "Entered" tick. */
  id: string;
  key: string;
  /** The rubric as referred to on the form: "31.40", "11.10-2", or an uncoded line's key. */
  ref: string;
  code?: string;
  label: string;
  gloss: string;
  person: FormPerson;
  part?: { id: FormPart; label: string; gloss: string };
  /** The columns the value goes in; one value in both ICC and IFD when the two are listed. */
  columns: { id: FormColumn; label: string; gloss: string }[];
  role: RubricRole;
  format: RubricFormat;
  /** Money in centimes, exactly; the page formats it for its language. */
  centimes?: number;
  text?: string;
  tick?: boolean;
  /** As typed on the official form; absent for a box to tick. */
  copy?: string;
  /** The form wants whole francs and the exact amount has centimes. */
  rounded: boolean;
  /** The line's other fields, e.g. the employer's name on 11.10 (on the line's first value only). */
  fields: { id: string; label: string; value: string }[];
  /** A household amount on a rubric the form splits per person: the parts to split it into. */
  splitInto?: { label: string; gloss: string }[];
  status: FactStatus;
  /** false while the value needs the user's OK or is an estimate: never shown as final. */
  final: boolean;
  /** The user types (or ticks) it, and it is final. */
  enterable: boolean;
  entered: boolean;
  /** Vault documents the value was read from. */
  documents: string[];
  source: string;
}

export interface CopyGroup {
  section: string;
  title: string;
  gloss: string;
  rows: CopyRow[];
}

export interface CopySection {
  page: string;
  title: string;
  gloss: string;
  person?: FormPerson;
  pdfPage: number;
  groups: CopyGroup[];
  /** Values to type that the user ticked as entered, of all values to type on this page. */
  entered: number;
  total: number;
  /** Values that still need the user's OK or are estimates. */
  pending: number;
}

export interface CopyPanel {
  taxYear: number;
  formYear: number;
  provisional: boolean;
  note?: string;
  sections: CopySection[];
  entered: number;
  total: number;
  pending: number;
  /** Items that match no rubric of the form (a code or person the form doesn't have). */
  unplaced: { code: string; person: Owner }[];
}

/** How a form heads its columns and parts: Geneva's by default (COLUMN_LABELS, PART_LABELS). */
export interface CopyLabels {
  columns: Record<FormColumn, { label: string; gloss: Gloss }>;
  parts: Record<FormPart, { label: string; gloss: Gloss }>;
}

export interface CopyPanelInput {
  form: FormMap<string>;
  items: readonly FormItem[];
  lang: Lang;
  /** Another canton's column and part headings (packages/filing-zh). */
  labels?: CopyLabels;
  /** What the user's tick stored for this row id (the value when ticked), if ticked. */
  entered?: (rowId: string) => string | undefined;
}

/** p1 is contribuable A, p2 is B; children are "Enfant(s)". */
export function formPersonOf(person: Owner): FormPerson | 'children' {
  if (person === 'p1') return 'A';
  if (person === 'p2') return 'B';
  if (person === 'household') return 'household';
  return 'children';
}

const PART_ORDER: (FormPart | undefined)[] = ['A', 'B', 'children', undefined];

/** Where an item goes: every rubric entry with its code that fits its person and column. */
function placements(
  form: FormMap<string>,
  item: FormItem,
): { rubric: FormRubric<string>; part?: FormPart; columns: FormColumn[] }[] {
  const who = formPersonOf(item.person);
  const out: { rubric: FormRubric<string>; part?: FormPart; columns: FormColumn[] }[] = [];
  const candidates = form.rubrics.filter((r) => r.key === item.code && r.supported);
  // Without a column, an item fills the income columns; a rubric with only a wealth column (or
  // none) takes it when no entry of the code has income columns.
  const incomeEntries = candidates.filter((r) => r.columns.some((c) => c !== 'wealth'));
  for (const rubric of candidates) {
    let part: FormPart | undefined;
    if (rubric.person !== 'household') {
      if (who !== rubric.person) continue;
    } else if (rubric.parts) {
      if (who === 'household') part = undefined;
      else if ((rubric.parts as readonly string[]).includes(who)) part = who;
      else continue;
    }
    let columns: FormColumn[];
    if (item.column) {
      if (!rubric.columns.includes(item.column)) continue;
      columns = [item.column];
    } else if (incomeEntries.length) {
      if (!incomeEntries.includes(rubric)) continue;
      columns = rubric.columns.filter((c) => c !== 'wealth');
    } else {
      columns = [...rubric.columns];
    }
    out.push({ rubric, ...(part ? { part } : {}), columns });
  }
  return out;
}

const combine = (a: FormItem, b: FormItem): FormItem => ({
  ...a,
  ...(a.amount !== undefined || b.amount !== undefined
    ? { amount: (a.amount ?? 0) + (b.amount ?? 0) }
    : {}),
  ...(a.tick || b.tick ? { tick: true } : {}),
  ...(b.text !== undefined ? { text: b.text } : {}),
  fields: { ...a.fields, ...b.fields },
  status: weakestStatus([a.status, b.status]),
  source: {
    facts: [...(a.source?.facts ?? []), ...(b.source?.facts ?? [])],
    documents: [...new Set([...(a.source?.documents ?? []), ...(b.source?.documents ?? [])])],
  },
});

/** Builds the copy panel: the form's pages in order, only those with something on them. */
export function buildCopyPanel({
  form,
  items,
  lang,
  entered,
  labels = { columns: COLUMN_LABELS, parts: PART_LABELS },
}: CopyPanelInput): CopyPanel {
  // One cell per rubric entry, part, columns and line; items for the same cell add up.
  type Cell = {
    rubric: FormRubric<string>;
    part?: FormPart;
    columns: FormColumn[];
    item: FormItem;
  };
  const cells = new Map<string, Cell>();
  const unplaced: CopyPanel['unplaced'] = [];
  for (const item of items) {
    const places = placements(form, item);
    if (places.length === 0) unplaced.push({ code: item.code, person: item.person });
    for (const p of places) {
      const id = [
        p.rubric.page,
        p.rubric.key,
        p.rubric.person,
        p.part ?? '-',
        p.columns.join('+') || '-',
        item.instance ?? '-',
      ].join('|');
      const cell = cells.get(id);
      cells.set(id, cell ? { ...cell, item: combine(cell.item, item) } : { ...p, item });
    }
  }

  // Lines of a repeating rubric are numbered in the order their first value comes.
  const lineOf = new Map<string, number>();
  const lineNumber = (rubric: FormRubric<string>, instance: string | undefined) => {
    if (!rubric.repeats || instance === undefined) return undefined;
    const k = `${rubric.page}|${rubric.key}|${rubric.person}|${instance}`;
    if (!lineOf.has(k)) {
      const used = [...lineOf.keys()].filter((x) =>
        x.startsWith(`${rubric.page}|${rubric.key}|${rubric.person}|`),
      ).length;
      lineOf.set(k, used + 1);
    }
    return lineOf.get(k);
  };

  const rubricOrder = new Map(form.rubrics.map((r, i) => [r, i]));
  const sorted = [...cells.entries()].sort(([, a], [, b]) => {
    const byRubric = rubricOrder.get(a.rubric)! - rubricOrder.get(b.rubric)!;
    if (byRubric) return byRubric;
    return PART_ORDER.indexOf(a.part) - PART_ORDER.indexOf(b.part);
  });

  const rows = new Map<FormRubric<string>, CopyRow[]>();
  const linesWithFields = new Set<string>();
  for (const [id, cell] of sorted) {
    const { rubric, item } = cell;
    const line = lineNumber(rubric, item.instance);
    const final = isFinal(item.status);
    const copy = formText(rubric.format, item);
    const lineKey = `${rubric.page}|${rubric.key}|${rubric.person}|${item.instance ?? '-'}`;
    const fields = linesWithFields.has(lineKey)
      ? []
      : (rubric.lineFields ?? []).flatMap((f) => {
          const value = item.fields?.[f.id];
          const typed = value === undefined ? undefined : formText(f.format, { text: value });
          return typed ? [{ id: f.id, label: f.label, value: typed }] : [];
        });
    if (fields.length) linesWithFields.add(lineKey);
    const hasValue =
      copy !== undefined || (rubric.format === 'tick' && item.tick === true) || fields.length > 0;
    if (!hasValue) continue;
    const typedValue = enteredValue({ copy, tick: item.tick });
    const enterable = rubric.role === 'input' && final;
    const columns =
      cell.columns.length === 2 && cell.columns[0] === 'icc' && cell.columns[1] === 'ifd'
        ? [
            {
              id: 'icc' as const,
              label: labels.columns.icc.label,
              gloss: labels.columns.icc.gloss[lang],
            },
            {
              id: 'ifd' as const,
              label: labels.columns.ifd.label,
              gloss: labels.columns.ifd.gloss[lang],
            },
          ]
        : cell.columns.map((c) => ({
            id: c,
            label: labels.columns[c].label,
            gloss: labels.columns[c].gloss[lang],
          }));
    const row: CopyRow = {
      id,
      key: rubric.key,
      ref: rubricRef(rubric, line),
      ...(rubric.code ? { code: rubric.code } : {}),
      label: rubric.label,
      gloss: rubric.gloss[lang],
      person: rubric.person,
      ...(cell.part
        ? {
            part: {
              id: cell.part,
              label: labels.parts[cell.part].label,
              gloss: labels.parts[cell.part].gloss[lang],
            },
          }
        : {}),
      columns,
      role: rubric.role,
      format: rubric.format,
      ...(item.amount !== undefined ? { centimes: item.amount } : {}),
      ...(item.text !== undefined ? { text: item.text } : {}),
      ...(item.tick !== undefined ? { tick: item.tick } : {}),
      ...(copy !== undefined ? { copy } : {}),
      rounded: rubric.format === 'money' && item.amount !== undefined && item.amount % 100 !== 0,
      fields,
      ...(rubric.parts && !cell.part
        ? {
            splitInto: rubric.parts.map((p) => ({
              label: labels.parts[p].label,
              gloss: labels.parts[p].gloss[lang],
            })),
          }
        : {}),
      status: item.status,
      final,
      enterable,
      entered: enterable && typedValue !== undefined && entered?.(id) === typedValue,
      documents: [...(item.source?.documents ?? [])],
      source: rubric.source,
    };
    rows.set(rubric, [...(rows.get(rubric) ?? []), row]);
  }

  const sections: CopySection[] = [];
  for (const page of form.pages) {
    const groups: CopyGroup[] = page.sections.flatMap((s) => {
      const inSection = form.rubrics
        .filter((r) => r.page === page.id && r.section === s.id)
        .flatMap((r) => rows.get(r) ?? []);
      return inSection.length
        ? [{ section: s.id, title: s.title, gloss: s.gloss[lang], rows: inSection }]
        : [];
    });
    if (groups.length === 0) continue;
    const all = groups.flatMap((g) => g.rows);
    const toType = all.filter((r) => r.role === 'input');
    sections.push({
      page: page.id,
      title: page.title,
      gloss: page.gloss[lang],
      ...(page.person ? { person: page.person } : {}),
      pdfPage: page.pdfPage,
      groups,
      entered: toType.filter((r) => r.entered).length,
      total: toType.length,
      pending: all.filter((r) => !r.final).length,
    });
  }
  return {
    taxYear: form.taxYear,
    formYear: form.formYear,
    provisional: form.provisional,
    ...(form.note ? { note: form.note[lang] } : {}),
    sections,
    entered: sections.reduce((n, s) => n + s.entered, 0),
    total: sections.reduce((n, s) => n + s.total, 0),
    pending: sections.reduce((n, s) => n + s.pending, 0),
    unplaced,
  };
}

/** What a tick stores: the value as typed when ticked, so a changed value unticks itself. */
export function enteredValue(row: Pick<CopyRow, 'copy' | 'tick'>): string | undefined {
  return row.copy ?? (row.tick ? 'ticked' : undefined);
}
