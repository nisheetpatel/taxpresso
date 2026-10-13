// This year's own declaration (SPEC.md 10.4): the PDF the user downloads from GeTax or the online
// declaration before transmitting, recognised by the same reader as last year's (./prior.ts) when
// its tax year is this one. It is never a source of values: it is only checked (./reconcile.ts).
//
// What the reader gives (rubric codes and amounts, no name, no label text) is kept in memory only,
// by the file's SHA-256, so the dashboard doesn't read the PDF again on every refresh.
import type { PriorDeclaration } from '@taxpresso/intake';
import type { VaultDocument } from '@taxpresso/ledger';

export const OFFICIAL_KIND = 'official_declaration' as const;
/** `parse.method` of this year's declaration recognised by Taxpresso. */
export const OFFICIAL_METHOD = 'official_declaration';

/** A handful of declarations at most: one per download. */
const MAX_KEPT = 8;
const read = new Map<string, PriorDeclaration | null>();

/** Remembers what the reader gave for a file (null: not a declaration it can read). */
export function rememberDeclaration(sha256: string, decl: PriorDeclaration | null): void {
  read.delete(sha256);
  read.set(sha256, decl);
  while (read.size > MAX_KEPT) read.delete(read.keys().next().value!);
}

/** What the reader gave for a file, if it read it already: undefined when not read yet. */
export function rememberedDeclaration(sha256: string): PriorDeclaration | null | undefined {
  return read.get(sha256);
}

/** Marks a document as this year's declaration, read by Taxpresso from its own text. */
export function markOfficialDeclaration(doc: VaultDocument, decl: PriorDeclaration): void {
  doc.kind = OFFICIAL_KIND;
  doc.kindSource = 'pdf_text';
  if (decl.taxYear !== undefined) doc.taxYear = decl.taxYear;
  doc.pages = decl.pages;
  if (decl.software) doc.issuer = decl.software;
  doc.parse = { method: OFFICIAL_METHOD, ok: true, warnings: decl.warnings.map((w) => w.en) };
  rememberDeclaration(doc.sha256, decl);
}
