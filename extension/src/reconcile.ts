// "Check before you transmit" (SPEC.md 10.4): the PDF of this year's declaration, downloaded by the
// user from GeTax or the online declaration and added to the vault, read on this computer by the
// reader of last year's declaration (@taxpresso/intake), and compared with the copy panel (10.5):
// rubric by rubric, person by person, in whole francs (@taxpresso/filing-ge, reconcileDeclaration).
//
// Derived on every read, never stored: nothing from the PDF goes into the ledger or the folder,
// and the reader keeps no name, number or label text from it. Claude and the dashboard get the
// same result (reconcile_official_pdf, the dashboard's card). Taxpresso never transmits anything:
// the user does, in the official software, once everything matches.
import {
  filing as genevaFiling,
  reconcileDeclaration,
  type CheckCell,
  type CheckLine,
  type ComputedLine,
  type DeclarationCheck,
} from '@taxpresso/filing-ge';
import { readPriorDeclaration } from '@taxpresso/intake';
import type { VaultDocument } from '@taxpresso/ledger';
import type { ContentLang as Lang } from './lang.js';
import { copyPanelView } from './copy-panel.js';
import { OFFICIAL_KIND, rememberDeclaration, rememberedDeclaration } from './official.js';
import type { CantonEntry } from './cantons.js';
import type { Workspace } from './workspace.js';

/** This year's declaration PDFs that count, the latest added first. */
export function officialDocuments(ws: Workspace): VaultDocument[] {
  return ws
    .activeDocuments()
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.kind === OFFICIAL_KIND)
    .sort((a, b) => b.d.addedAt.localeCompare(a.d.addedAt) || b.i - a.i)
    .map(({ d }) => d);
}

/** Reads the latest declaration PDF on this computer, once per file. Never throws. */
export async function declarationCheckReady(ws: Workspace): Promise<void> {
  const doc = officialDocuments(ws)[0];
  if (!doc || rememberedDeclaration(doc.sha256) !== undefined) return;
  try {
    const bytes = new Uint8Array(await ws.vault.readDocument(doc));
    rememberDeclaration(doc.sha256, (await readPriorDeclaration(bytes)) ?? null);
  } catch {
    rememberDeclaration(doc.sha256, null); // gone or unreadable
  }
}

export interface DeclarationCheckView {
  taxYear: number;
  /**
   * none: no PDF of this year's declaration yet. pending: not read yet. unreadable: Taxpresso
   * can't read it as a Geneva declaration. other_year: it is for another year. checked: compared.
   */
  /** not_available: the check reads Geneva declarations only, and this return is another canton's. */
  status: 'none' | 'pending' | 'unreadable' | 'other_year' | 'checked' | 'not_available';
  document?: {
    id: string;
    filename: string;
    addedAt: string;
    taxYear?: number;
    software?: string;
    pages?: number;
  };
  /** Earlier downloads of this year's declaration in the folder: only the latest is checked. */
  older: number;
  /** The year printed on the PDF, when it is not this one. */
  printedYear?: number;
  /** The reader's warnings (codes and pages only), in the page's language. */
  warnings: string[];
  /** The form map is the previous year's until this year's is published. */
  provisional?: string;
  check?: DeclarationCheck;
}

export function declarationCheckView(ws: Workspace, lang: Lang): DeclarationCheckView {
  const taxYear = ws.engine.taxYear;
  const { canton, notOffered } = ws.canton();
  // Another canton's form, or a canton Taxpresso doesn't prepare for this year: no check.
  if (notOffered || (canton && !canton.filing.checksPdf)) {
    return { taxYear, status: 'not_available', older: 0, warnings: [] };
  }
  const [doc, ...older] = officialDocuments(ws);
  if (!doc) return { taxYear, status: 'none', older: 0, warnings: [] };
  const decl = rememberedDeclaration(doc.sha256);
  const base = {
    taxYear,
    document: {
      id: doc.id,
      filename: doc.filename,
      addedAt: doc.addedAt,
      ...(decl?.taxYear ? { taxYear: decl.taxYear } : {}),
      ...(decl?.software ? { software: decl.software } : {}),
      ...(decl?.pages ? { pages: decl.pages } : {}),
    },
    older: older.length,
    warnings: (decl?.warnings ?? []).map((w) => w[lang]),
  };
  if (decl === undefined) return { ...base, status: 'pending' };
  if (decl === null) return { ...base, status: 'unreadable' };
  if (decl.taxYear !== undefined && decl.taxYear !== taxYear) {
    return { ...base, status: 'other_year', printedYear: decl.taxYear };
  }
  const form = genevaFiling.formMap(taxYear);
  const check = reconcileDeclaration({
    form,
    panel: copyPanelView(ws, lang),
    printed: decl.items,
    lang,
  });
  return {
    ...base,
    status: 'checked',
    ...(form.provisional && form.note ? { provisional: form.note[lang] } : {}),
    check,
  };
}

// --- For Claude: concise text (C6) -------------------------------------------------------------

const WHO = { A: 'you', B: 'your spouse or partner', household: '' } as const;
const PART = { A: 'contribuable A', B: 'contribuable B', children: 'children' } as const;
const COLUMN = { icc: 'ICC', ifd: 'IFD', wealth: 'wealth', amount: '' } as const;
const STATUS: Record<string, string> = {
  extracted: 'Needs your OK',
  estimate: 'Estimate',
};

const amounts = (cells: readonly CheckCell[], side: 'pdf' | 'taxpresso') =>
  cells
    .filter((c) => c[side] !== undefined)
    .map((c) => `${COLUMN[c.column] ? `${COLUMN[c.column]} ` : ''}${c[side]}`)
    .join(', ');

function where(l: Pick<CheckLine, 'ref' | 'label' | 'gloss' | 'person' | 'part'>, page: string) {
  const who = l.part ? PART[l.part.id] : WHO[l.person];
  const label = l.label ? `${l.label} (${l.gloss})` : `(${l.gloss})`;
  return `${page} ${l.ref} ${label}${who ? `, ${who}` : ''}`;
}

function lineText(l: CheckLine, page: string): string {
  const pdf = amounts(l.cells, 'pdf');
  const ours = amounts(l.cells, 'taxpresso');
  const notFinal =
    l.final === false ? ` Not final in Taxpresso (${STATUS[l.status ?? ''] ?? l.status}).` : '';
  switch (l.outcome) {
    case 'match':
      return `- ${where(l, page)}: matches (${ours || pdf}).${notFinal}`;
    case 'differs':
      return `- ${where(l, page)}: DIFFERS. In the PDF: ${pdf || 'nothing'}. To type (Taxpresso): ${ours || 'nothing'}.${notFinal}`;
    case 'pdf_only':
      return `- ${where(l, page)}: only in the PDF (${pdf}); Taxpresso has nothing for it.`;
    case 'taxpresso_only':
      return `- ${where(l, page)}: missing from the PDF; Taxpresso has ${ours}.${notFinal}`;
  }
}

function computedText(c: ComputedLine, page: string): string {
  const printed = amounts(c.cells, 'pdf');
  const expected = c.cells
    .filter((x) => x.expected !== undefined)
    .map((x) => `${COLUMN[x.column] ? `${COLUMN[x.column]} ` : ''}${x.expected}`)
    .join(', ');
  const what =
    c.check === 'adds_up'
      ? c.from
        ? `same as on ${c.from}`
        : 'adds up'
      : c.check === 'off'
        ? c.from
          ? `NOT the same as on ${c.from} (${expected})`
          : `does NOT add up: the lines above give ${expected}`
        : 'worked out by the form';
  return `- ${where({ ...c, part: undefined }, page)}: ${printed}, ${what}.`;
}

export interface DeclarationCheckResult {
  text: string;
  structured: Record<string, unknown>;
}

const TRANSMIT =
  'The user transmits the declaration themselves, in GeTax or the online declaration, once they have checked it. Taxpresso and Claude never transmit it and never press Transmettre.';

/** reconcile_official_pdf: differences first, matches and every computed line only with detail. */
export function declarationCheckResult(
  view: DeclarationCheckView,
  detail: boolean,
  canton?: CantonEntry,
): DeclarationCheckResult {
  const year = view.taxYear;
  const doc = view.document;
  const found = view.status !== 'none' && view.status !== 'not_available';
  const base = {
    found,
    status: view.status,
    ...(doc
      ? {
          document: {
            id: doc.id,
            filename: doc.filename,
            ...(doc.taxYear ? { taxYear: doc.taxYear } : {}),
            ...(doc.software ? { software: doc.software } : {}),
          },
        }
      : {}),
  };
  if (view.status === 'not_available') {
    return {
      text: `The check of the declaration PDF reads Geneva declarations only for now, and this is a ${canton?.name.en ?? 'non-Geneva'} return. Tell the user plainly; they compare what they typed in ${canton?.software ?? "their canton's software"} with the values to type (get_form_values) themselves. ${TRANSMIT}`,
      structured: base,
    };
  }
  if (view.status === 'none') {
    return {
      text: `No PDF of the ${year} declaration yet. Once the user has typed everything, they download the PDF of their declaration from GeTax or the online declaration (e-démarches) and add it in the dashboard ("Check before you transmit"), or put it in the Taxpresso folder and you call ingest_vault. Then call this again. ${TRANSMIT}`,
      structured: base,
    };
  }
  const name = `“${doc!.filename}”`;
  if (view.status === 'pending' || view.status === 'unreadable') {
    return {
      text: `Taxpresso can't read ${name} as a Geneva declaration: it needs the PDF printed by GeTax or the online declaration, with its text (not a scan or a photo). Ask the user to download it again from there. ${TRANSMIT}`,
      structured: base,
    };
  }
  if (view.status === 'other_year') {
    return {
      text: `${name} is the declaration for ${view.printedYear}, not ${year}: it can't be checked against this year's values. Ask the user for the PDF of the ${year} declaration. ${TRANSMIT}`,
      structured: { ...base, printedYear: view.printedYear },
    };
  }
  const check = view.check!;
  const c = check.counts;
  const out = [
    `This year's declaration (${doc!.taxYear ?? year}), ${name}${doc!.software ? `, printed by ${doc!.software}` : ''}: read on this computer and compared with the values to type (get_form_values), rubric by rubric, in whole francs. ICC = cantonal and communal tax column, IFD = federal. Contribuable A is the user, B their spouse or partner.`,
  ];
  if (view.provisional) out.push(view.provisional);
  if (view.older) {
    out.push(
      `Only the latest PDF is checked (${view.older} earlier download${view.older === 1 ? '' : 's'} in the folder).`,
    );
  }
  out.push(
    c.toFix
      ? `To fix before transmitting: ${c.toFix} (${c.differs} differ${c.differs === 1 ? 's' : ''}, ${c.taxpressoOnly} missing from the PDF, ${c.pdfOnly} only in the PDF). ${c.match} match${c.match === 1 ? 'es' : ''}.`
      : `Nothing to fix: ${c.match} value${c.match === 1 ? '' : 's'} match.`,
  );
  const toFix: Record<string, unknown>[] = [];
  const matches: Record<string, unknown>[] = [];
  for (const s of check.sections) {
    for (const l of s.lines) {
      const short = {
        page: s.page,
        ref: l.ref,
        label: l.label,
        person: l.part?.id ?? l.person,
        outcome: l.outcome,
        cells: l.cells,
        ...(l.final === false ? { final: false } : {}),
      };
      if (l.outcome === 'match') matches.push(short);
      else toFix.push(short);
    }
  }
  for (const s of check.sections) {
    for (const l of s.lines) if (l.outcome !== 'match') out.push(lineText(l, s.page));
  }
  if (c.notFinal) {
    out.push(
      `${c.notFinal} compared value${c.notFinal === 1 ? ' is' : 's are'} not final in Taxpresso yet (Needs your OK or Estimate): the user settles ${c.notFinal === 1 ? 'it' : 'them'} first.`,
    );
  }
  const off = check.sections.flatMap((s) =>
    s.computed.filter((x) => x.check === 'off').map((x) => ({ s, x })),
  );
  if (c.computed) {
    out.push(
      `Lines the form works out (totals, carried totals, flat deductions, limits): ${c.computed}, not counted as differences${off.length ? `; ${off.length} to look at in the official software:` : '.'}`,
    );
    for (const { s, x } of off) out.push(computedText(x, s.page));
  }
  const byEye = check.sections.flatMap((s) => s.byEye.map((b) => ({ s, b })));
  if (byEye.length) {
    out.push(
      `Not compared, the user checks by eye: ${byEye
        .map(
          ({ s, b }) =>
            `${s.page} ${/^\d{2}\.\d{2}/.test(b.ref) ? b.ref : b.label} (${b.reason === 'tick' ? 'box to tick' : b.reason === 'text' ? `text${b.value ? ` ${b.value}` : ''}` : 'amounts Taxpresso can’t tell apart'})`,
        )
        .join('; ')}. Names and the securities list (annexe F) are not compared.`,
    );
  } else {
    out.push('Names and the securities list (annexe F) are not compared.');
  }
  if (detail) {
    out.push('Matching:');
    for (const s of check.sections) {
      for (const l of s.lines) if (l.outcome === 'match') out.push(lineText(l, s.page));
    }
    out.push('Lines the form works out:');
    for (const s of check.sections) for (const x of s.computed) out.push(computedText(x, s.page));
  } else if (c.match || c.computed) {
    out.push('detail: true lists the matching values and every line the form works out.');
  }
  out.push(
    check.clear
      ? `Everything Taxpresso compared matches. ${TRANSMIT}`
      : `Tell the user what to fix in the official software, then to download the PDF again and add it: Taxpresso checks it again. ${TRANSMIT}`,
  );
  return {
    text: out.join('\n'),
    structured: {
      ...base,
      clear: check.clear,
      counts: c,
      toFix,
      ...(detail ? { matches } : {}),
      computedOff: off.map(({ s, x }) => ({
        page: s.page,
        ref: x.ref,
        cells: x.cells,
        ...(x.from ? { from: x.from } : {}),
      })),
    },
  };
}
