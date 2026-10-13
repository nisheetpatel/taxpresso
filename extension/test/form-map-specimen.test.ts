// The form map against the official documents themselves (SPEC.md 7b: the document wins). Runs
// where the documents were downloaded (node scripts/fetch-sources.mjs); they are never committed.
import { existsSync, readFileSync } from 'node:fs';
import { readForReview } from '@taxpresso/intake';
import { FORM_2025 } from '@taxpresso/filing-ge';
import { describe, expect, it } from 'vitest';

const FILES = new URL('../../docs/sources/ge/files/', import.meta.url);
const SPECIMEN = new URL('ge-2025-declaration-specimen.pdf', FILES);
const GUIDE = new URL('ge-2025-guide-declaration-pp.pdf', FILES);
const present = existsSync(SPECIMEN) && existsSync(GUIDE);

async function pages(url: URL): Promise<string[]> {
  const bytes = new Uint8Array(readFileSync(url));
  const out: string[] = [];
  for (let from: number | undefined = 1; from !== undefined;) {
    const r = await readForReview(bytes, 'doc.pdf', from);
    for (const p of r.items) out[p.page - 1] = p.text;
    from = r.nextPage;
  }
  return out;
}

/**
 * Text compared without spaces, line breaks or case (the PDF breaks labels across lines), and with
 * one apostrophe: the form prints ’, the guide sometimes '.
 */
const squash = (s: string) =>
  s
    .replace(/\s+/g, '')
    .replace(/\u2019/g, "'")
    .toLowerCase();

/**
 * As printed on the page: in one piece, or word by word where the form sets a label in columns
 * (PDF.js reads "Taux" and "d’activité %" as two lines with another column in between).
 */
const printed = (page: string, label: string) =>
  page.includes(squash(label)) ||
  squash(label.replace(/[\s/(),.:]+/g, ' ').replace(/ /g, '\u0000'))
    .split('\u0000')
    .filter((w) => w.length > 1)
    .every((w) => page.includes(w));

describe.skipIf(!present)('the form map, read against the official 2025 specimen and guide', () => {
  it('finds every code on its page and every label as printed', async () => {
    const specimen = (await pages(SPECIMEN)).map(squash);
    const guide = squash((await pages(GUIDE)).join(' '));
    const missing: string[] = [];
    for (const page of FORM_2025.pages) {
      const text = specimen[page.pdfPage - 1] ?? '';
      // A verso (B2, B4) carries its annex's title on the recto.
      const annex = FORM_2025.pages
        .filter((p) => p.id[0] === page.id[0])
        .map((p) => specimen[p.pdfPage - 1] ?? '')
        .join('');
      if (!printed(text, page.title) && !printed(annex, page.title)) {
        missing.push(`${page.id} title`);
      }
      for (const s of page.sections) {
        if (!printed(text, s.title) && !guide.includes(squash(s.title))) {
          missing.push(`${page.id} section ${s.title}`);
        }
      }
    }
    for (const r of FORM_2025.rubrics) {
      const text = specimen[FORM_2025.pages.find((p) => p.id === r.page)!.pdfPage - 1] ?? '';
      const what = `${r.page} ${r.key}`;
      if (r.code && !text.includes(r.code)) missing.push(`${what}: code`);
      // As printed on the form, or as the guide names the rubric when the form prints none.
      if (!printed(text, r.label) && !guide.includes(squash(r.label))) {
        missing.push(`${what}: label "${r.label}"`);
      }
      for (const f of r.lineFields ?? []) {
        if (!printed(text, f.label)) missing.push(`${what}: field "${f.label}"`);
      }
      if (
        r.csBox &&
        !['F', 'G'].includes(r.csBox) &&
        !text.includes(squash(`code ${r.csBox} du CS`))
      ) {
        missing.push(`${what}: "code ${r.csBox} du CS"`);
      }
    }
    expect(missing).toEqual([]);
  }, 60_000);
});
