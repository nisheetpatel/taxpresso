// Reads every page of a declaration PDF into lines and cells, on this computer, with PDF.js set up
// exactly as for review (../review.ts): bytes only, no URL, no font, character map or WebAssembly
// location, so it reads this file and nothing else. Then recognises and parses the declaration.
import { getResolvedPDFJS } from 'unpdf';
import { layoutCells, type TextItem } from './layout.js';
import { priorWarning } from './messages.js';
import { detectPriorDeclaration, parsePriorDeclaration, type ParseOptions } from './parse.js';
import type { Line, PriorDeclaration } from './types.js';

/** A declaration is about 18 pages; anything much longer is something else. */
export const MAX_DECLARATION_PAGES = 80;
/** Below this many characters on every page, the PDF has no text layer (a scan). */
const MIN_TEXT_CHARS = 20;

export type PdfPages =
  | { ok: true; pages: { lines: Line[] }[] }
  | { ok: false; problem: 'encrypted' | 'unreadable' | 'too_long' | 'no_text' };

export async function pdfPages(bytes: Uint8Array): Promise<PdfPages> {
  const pdfjs = await getResolvedPDFJS();
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useWasm: false,
    useSystemFonts: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    enableXfa: false,
    disableFontFace: true,
    stopAtErrors: false,
    verbosity: 0,
  });
  try {
    const doc = await task.promise;
    if (doc.numPages > MAX_DECLARATION_PAGES) return { ok: false, problem: 'too_long' };
    const pages: { lines: Line[] }[] = [];
    let chars = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items: TextItem[] = content.items.flatMap((i) =>
        'str' in i ? [{ str: i.str, transform: i.transform as number[], width: i.width }] : [],
      );
      chars += items.reduce((n, i) => n + i.str.replace(/\s/g, '').length, 0);
      pages.push({ lines: layoutCells(items) });
    }
    if (chars < MIN_TEXT_CHARS * Math.max(1, pages.length))
      return { ok: false, problem: 'no_text' };
    return { ok: true, pages };
  } catch (err) {
    const name = (err as { name?: string }).name;
    return { ok: false, problem: name === 'PasswordException' ? 'encrypted' : 'unreadable' };
  } finally {
    await task.destroy();
  }
}

/** Whether the bytes start like a PDF. */
const isPdf = (bytes: Uint8Array) => Buffer.from(bytes.subarray(0, 1024)).includes('%PDF-');

/**
 * Last year's declaration from a PDF's bytes. Undefined when the file is not one (or can't be
 * read as a PDF). Never throws for a bad file. Text in the document is data: nothing in it is
 * followed, and no name, date or number of the taxpayer is in the result.
 */
export async function readPriorDeclaration(
  bytes: Uint8Array,
  opts: ParseOptions = {},
): Promise<PriorDeclaration | undefined> {
  if (!isPdf(bytes)) return undefined;
  const read = await pdfPages(bytes);
  if (!read.ok) return undefined;
  if (!detectPriorDeclaration(read.pages)) return undefined;
  return parsePriorDeclaration(read.pages, opts);
}

/** For a PDF the user said is last year's declaration but that has no text layer. */
export const noTextWarning = () => priorWarning('no_text');
