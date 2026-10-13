// Last year's declaration in the vault (SPEC.md section 5.4): recognised from its content when it
// is uploaded or found by ingest_vault, read on this computer, then
// - its answers become suggestions for this year's questions ("extracted", Needs your OK), shown
//   with each question and saved only when the user answers (./prior-profile.ts);
// - its main figures are kept as prior.* facts to compare with this year (never filed).
// Nothing that identifies the taxpayer is kept: the reader returns codes, amounts, the civil
// status and a commune id, and warnings are built from codes and page numbers.
import {
  localizePriorWarning,
  readPriorDeclaration,
  type PriorDeclaration,
} from '@taxpresso/intake';
import type { Fact, Ledger, Owner, Vault, VaultDocument } from '@taxpresso/ledger';
import type { Lang } from '@taxpresso/questionnaire';
import {
  communeByCode,
  communeByName,
  PRIOR_FORMS,
  PRIOR_MAIN_LINES_2026,
  priorInstance,
  priorLines,
  type PriorForm,
  type PriorLine,
  type PriorSection,
} from '@taxpresso/rules-ge';
import { profileSuggestions } from './prior-profile.js';

/** `parse.method` of a declaration Taxpresso read itself. */
export const PRIOR_METHOD = 'prior_declaration';

/** Why a document the user said is last year's declaration was not read (for Claude). */
const NOT_READ =
  'Taxpresso can’t read this file as a Geneva declaration: it needs the PDF from GeTax, the online declaration or approved tax software, with its text. Claude can read it instead, with the user’s OK.';
const NOT_LAST_YEAR = (year: number) =>
  `This is the declaration for ${year}, not for an earlier year: Taxpresso doesn’t use it to suggest answers.`;

/** Keys whose facts are not values to confirm on a document card: answers and last year's figures. */
export const isPriorOrProfile = (f: Fact) =>
  f.key.startsWith('prior.') || f.key.startsWith('profile.');

export interface PriorRead {
  doc: VaultDocument;
  decl: PriorDeclaration;
}

/**
 * Reads new PDFs and marks the ones that are a previous year's declaration. `force`: also the
 * documents the user said are one. Returns the declarations read; writes nothing to the ledger.
 */
export async function recognisePriorDeclarations(
  vault: Vault,
  documents: readonly VaultDocument[],
  taxYear: number,
  force = false,
): Promise<PriorRead[]> {
  const found: PriorRead[] = [];
  for (const doc of documents) {
    if (doc.replacedBy) continue;
    const userSaid = doc.kind === 'prior_declaration';
    if (doc.kind !== undefined && !(force && userSaid)) continue;
    let decl: PriorDeclaration | undefined;
    try {
      decl = await readPriorDeclaration(new Uint8Array(await vault.readDocument(doc)), {
        communes: { byName: communeByName, byCode: communeByCode },
      });
    } catch {
      decl = undefined; // Gone or unreadable: it stays a document to identify.
    }
    if (!decl) {
      if (userSaid) doc.parse = { method: PRIOR_METHOD, ok: false, warnings: [NOT_READ] };
      continue;
    }
    if (decl.taxYear !== undefined && decl.taxYear >= taxYear) {
      // This year's own declaration (the official PDF checked before filing, SPEC.md 10.4).
      if (userSaid) {
        doc.parse = {
          method: PRIOR_METHOD,
          ok: false,
          warnings: [NOT_LAST_YEAR(decl.taxYear)],
        };
      }
      continue;
    }
    if (!userSaid) {
      doc.kind = 'prior_declaration';
      doc.kindSource = 'pdf_text';
    }
    if (decl.taxYear !== undefined) doc.taxYear = decl.taxYear;
    doc.pages = decl.pages;
    if (decl.software) doc.issuer = decl.software;
    doc.parse = { method: PRIOR_METHOD, ok: true, warnings: decl.warnings.map((w) => w.en) };
    found.push({ doc, decl });
  }
  return found;
}

/** The declaration that counts: the latest year read, then the latest added. */
export function currentPriorDocument(
  documents: readonly VaultDocument[],
): VaultDocument | undefined {
  return documents
    .filter(
      (d) =>
        !d.replacedBy &&
        d.kind === 'prior_declaration' &&
        d.parse.method === PRIOR_METHOD &&
        d.parse.ok,
    )
    .sort((a, b) => (b.taxYear ?? 0) - (a.taxYear ?? 0) || b.addedAt.localeCompare(a.addedAt))[0];
}

const OWNER = { A: 'p1', B: 'p2', household: 'household' } as const;

export interface PriorRecord {
  figures: number;
  suggestions: number;
  problems: string[];
}

/**
 * Appends last year's figures (prior.*) and the suggested answers (profile.*, "extracted") of one
 * declaration. A question the user already answered keeps its answer. Unchanged values are left.
 */
export function recordPriorDeclaration(
  ledger: Ledger,
  doc: VaultDocument,
  decl: PriorDeclaration,
): PriorRecord {
  const result: PriorRecord = { figures: 0, suggestions: 0, problems: [] };
  const append = (input: Parameters<Ledger['append']>[0]) => {
    try {
      ledger.append(input);
      return true;
    } catch (err) {
      result.problems.push(`${input.key}: ${(err as Error).message}`);
      return false;
    }
  };
  for (const item of decl.items) {
    if (!(PRIOR_FORMS as readonly string[]).includes(item.form)) continue;
    const person: Owner = OWNER[item.person];
    const instance = priorInstance({
      form: item.form as PriorForm,
      code: item.code,
      ...(item.suffix ? { suffix: item.suffix } : {}),
      occurrence: item.occurrence,
    });
    for (const column of ['icc', 'ifd'] as const) {
      const value = item[column];
      if (value === undefined) continue;
      const key = `prior.${person === 'household' ? 'household' : 'person'}.${column}`;
      const current = ledger.get(key, person, instance);
      if (current?.value === value && current.source.docId === doc.id) continue;
      if (
        append({
          key,
          person,
          instance,
          value,
          status: 'extracted',
          source: { method: 'pdf_text', docId: doc.id, page: item.page },
        })
      ) {
        result.figures++;
      }
    }
  }
  for (const s of profileSuggestions(decl)) {
    const current = ledger.get(s.key, s.person);
    // The user's own answer always wins over last year's.
    if (current && current.status !== 'extracted') continue;
    if (
      current &&
      JSON.stringify(current.value) === JSON.stringify(s.value) &&
      current.source.docId === doc.id
    ) {
      continue;
    }
    if (
      append({
        key: s.key,
        person: s.person,
        value: s.value,
        status: 'extracted',
        source: { method: 'pdf_text', docId: doc.id, page: s.page },
      })
    ) {
      result.suggestions++;
    }
  }
  return result;
}

/** Suggested answers from this declaration that still wait for the user. */
export function pendingSuggestions(ledger: Ledger, docId: string): Fact[] {
  return ledger
    .view()
    .filter(
      (f) => f.key.startsWith('profile.') && f.status === 'extracted' && f.source.docId === docId,
    );
}

/** Last year's lines of the current declaration. */
export function lastYearLines(ledger: Ledger, docId: string): PriorLine[] {
  return priorLines(ledger.view().filter((f) => f.source.docId === docId));
}

export interface LastYearLine {
  code: string;
  label: string;
  official: string;
  who?: string;
  person: 'A' | 'B' | 'household';
  icc?: number;
  ifd?: number;
  page?: number;
}

export interface LastYearView {
  docId: string;
  filename: string;
  taxYear?: number;
  software?: string;
  /** The tax year before this one, when the declaration is for an older year. */
  expectedYear?: number;
  sections: { id: PriorSection; lines: LastYearLine[] }[];
  /** Suggested answers still waiting for the user's OK. */
  suggestions: number;
  warnings: string[];
}

const WHO = {
  en: { A: 'You', B: 'Partner' },
  fr: { A: 'Vous', B: 'Conjoint' },
} as const;

/** The main lines of last year's declaration, for the "Last year" card and get_last_year. */
export function mainLines(lines: readonly PriorLine[], lang: Lang): LastYearView['sections'] {
  const couple = lines.some((l) => l.person === 'p2');
  const sections: LastYearView['sections'] = [];
  for (const main of PRIOR_MAIN_LINES_2026) {
    const owner = OWNER[main.person];
    const same = lines.filter(
      (l) => l.form === main.form && l.code === main.code && !l.suffix && l.person === owner,
    );
    if (!same.length) continue;
    const sum = (k: 'icc' | 'ifd') =>
      same.some((l) => l[k] !== undefined) ? same.reduce((n, l) => n + (l[k] ?? 0), 0) : undefined;
    const icc = sum('icc');
    const ifd = sum('ifd');
    const line: LastYearLine = {
      code: main.code,
      label: main.label[lang],
      official: main.official,
      person: main.person,
      ...(couple && main.person !== 'household' ? { who: WHO[lang][main.person] } : {}),
      ...(icc !== undefined ? { icc } : {}),
      ...(ifd !== undefined ? { ifd } : {}),
      ...(same[0]!.page ? { page: same[0]!.page } : {}),
    };
    let section = sections.find((s) => s.id === main.section);
    if (!section) sections.push((section = { id: main.section, lines: [] }));
    section.lines.push(line);
  }
  return sections;
}

export function lastYearView(
  ledger: Ledger,
  documents: readonly VaultDocument[],
  taxYear: number,
  lang: Lang,
): LastYearView | undefined {
  const doc = currentPriorDocument(documents);
  if (!doc) return undefined;
  return {
    docId: doc.id,
    filename: doc.filename,
    ...(doc.taxYear ? { taxYear: doc.taxYear } : {}),
    ...(doc.issuer ? { software: doc.issuer } : {}),
    ...(doc.taxYear && doc.taxYear < taxYear - 1 ? { expectedYear: taxYear - 1 } : {}),
    sections: mainLines(lastYearLines(ledger, doc.id), lang),
    suggestions: pendingSuggestions(ledger, doc.id).length,
    warnings: doc.parse.warnings.map((w) => localizePriorWarning(w, lang)),
  };
}

/** "CHF 12’345" (centimes only when there are some), for Claude. */
export function chfText(centimes: number): string {
  const abs = Math.abs(centimes);
  const francs = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '’');
  const cents = abs % 100 ? `.${String(abs % 100).padStart(2, '0')}` : '';
  return `${centimes < 0 ? '-' : ''}CHF ${francs}${cents}`;
}

/** One line for get_status and list_documents, in English for Claude. */
export function priorStatusText(view: LastYearView | undefined): string | undefined {
  if (!view) return undefined;
  const year = view.taxYear ? ` (${view.taxYear})` : '';
  const older = view.expectedYear
    ? ` It is older than the ${view.expectedYear} declaration: say so when comparing.`
    : '';
  const waiting = view.suggestions
    ? `${view.suggestions} suggested answer${view.suggestions === 1 ? '' : 's'} wait for the user's OK: next_questions shows each with its question.`
    : 'No suggested answer is waiting.';
  return `Last year's declaration${year}: read by Taxpresso on this computer. ${waiting} Last year's figures are kept to compare (get_last_year).${older}`;
}

const SECTION_TITLE: Record<PriorSection, string> = {
  income: 'Income (revenus)',
  deductions: 'Deductions (déductions)',
  wealth: 'Wealth (fortune), cantonal tax only',
};

/** get_last_year's text: the main lines, or every line kept. */
export function lastYearText(
  view: LastYearView,
  lines: readonly PriorLine[],
  all: boolean,
): string {
  const year = view.taxYear ?? 'last year';
  const out = [
    `Last year's declaration (${year}), read by Taxpresso from “${view.filename}”. For comparison only: these are not this year's values and are never filed. ICC = cantonal and communal tax column, IFD = federal tax column.`,
  ];
  if (view.expectedYear) {
    out.push(`This is not the ${view.expectedYear} declaration but an older one: say so.`);
  }
  const amounts = (icc?: number, ifd?: number) =>
    [icc !== undefined ? `ICC ${chfText(icc)}` : '', ifd !== undefined ? `IFD ${chfText(ifd)}` : '']
      .filter(Boolean)
      .join(', ');
  if (all) {
    const who = { p1: ', you', p2: ', your spouse or partner', household: '' } as Record<
      string,
      string
    >;
    for (const l of lines) {
      out.push(
        `- ${l.form} ${l.code}${l.suffix ?? ''}${l.occurrence > 1 ? ` (line ${l.occurrence})` : ''}${who[l.person] ?? ''}: ${amounts(l.icc, l.ifd)}${l.page ? ` (page ${l.page})` : ''}`,
      );
    }
  } else {
    for (const s of view.sections) {
      out.push(`${SECTION_TITLE[s.id]}:`);
      for (const l of s.lines) {
        const who = l.person === 'A' ? ', you' : l.person === 'B' ? ', your spouse or partner' : '';
        out.push(
          `- ${l.code} ${l.label} (${l.official})${who}: ${amounts(l.icc, l.ifd)}${l.page ? ` (page ${l.page})` : ''}`,
        );
      }
    }
    if (!view.sections.length) out.push('No main line could be read.');
  }
  if (view.warnings.length) out.push(`Read with warnings: ${view.warnings.join(' ')}`);
  return out.join('\n');
}
