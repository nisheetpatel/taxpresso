// Reads one vault document for Claude to review (SPEC.md section 5.5): the text of each PDF page,
// extracted here on this computer, or the image of a photo or a scanned page. Nothing else leaves
// the computer, and only when Claude asks for this one document.
//
// PDF text comes from PDF.js (Apache-2.0) through unpdf's build for servers (MIT): no worker, no
// canvas, no native module. We only ever pass bytes, never a URL, and give it no font, character
// map or WebAssembly location, so it reads the file and nothing else.
import { getResolvedPDFJS } from 'unpdf';
import { downscale, encodePng, toGray, type RawImage } from './png.js';

/** Most text returned in one call, in characters (C6: frugal results). */
export const MAX_TEXT_CHARS = 16_000;
/** Most pages returned in one call. */
export const MAX_PAGES_PER_CALL = 10;
/** Largest image sent to Claude, in bytes (before base64). */
export const MAX_IMAGE_BYTES = 3_500_000;
/** Most page images returned in one call. */
export const MAX_IMAGES_PER_CALL = 2;
/** Longest side of a scanned page sent as an image, in pixels. */
export const SCAN_MAX_EDGE = 1600;
/** Below this many characters, a PDF page is treated as having no text layer (a scan). */
const MIN_TEXT_CHARS = 20;

export type ReviewFormat = 'pdf' | 'jpeg' | 'png' | 'text' | 'unsupported';

export interface ReviewImage {
  mimeType: 'image/png' | 'image/jpeg';
  data: Buffer;
}

export interface ReviewPage {
  page: number;
  text: string;
  /** Set when the page has no usable text: the page image, if it could be made small enough. */
  image?: ReviewImage;
  /** The page has no text and no image could be sent. */
  noText?: boolean;
  /** The page text was cut at MAX_TEXT_CHARS. */
  truncated?: boolean;
}

export type ReviewProblem =
  'encrypted' | 'unreadable' | 'too_large' | 'unsupported' | 'heic' | 'out_of_range' | 'empty';

export interface ReviewResult {
  format: ReviewFormat;
  /** Total pages (a photo or a text file counts as one page per chunk). */
  pages: number;
  items: ReviewPage[];
  /** Call again from this page for the rest. */
  nextPage?: number;
  problem?: ReviewProblem;
}

/** What the bytes are, from their first bytes (never from the file name alone). */
export function sniff(bytes: Uint8Array, filename = ''): ReviewFormat | 'heic' {
  const head = Buffer.from(bytes.subarray(0, 1024));
  if (head.includes('%PDF-')) return 'pdf';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  const brand = head.subarray(4, 12).toString('latin1');
  if (/^ftyp(heic|heix|hevc|mif1|msf1)/.test(brand)) return 'heic';
  if (/\.(txt|csv|tsv|xml|json|md)$/i.test(filename) && !head.includes(0)) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return 'text';
    } catch {
      return 'unsupported';
    }
  }
  return 'unsupported';
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
}

/**
 * Rebuilds the reading order of a page: items on the same baseline become one line, left to right,
 * with wider gaps kept as several spaces so form columns (box number, label, amount) stay apart.
 */
export function layoutText(items: readonly TextItem[]): string {
  const words = items
    .filter((i) => i.str.trim() !== '')
    .map((i) => {
      const [a = 0, b = 0, , d = 0, x = 0, y = 0] = i.transform;
      return { str: i.str, x, y, w: i.width, size: Math.max(Math.hypot(a, b), Math.abs(d), 1) };
    })
    .sort((p, q) => q.y - p.y || p.x - q.x);
  const lines: (typeof words)[] = [];
  for (const word of words) {
    const line = lines.at(-1);
    if (line && Math.abs(line[0]!.y - word.y) <= Math.max(2, 0.4 * word.size)) line.push(word);
    else lines.push([word]);
  }
  return lines
    .map((line) => {
      line.sort((p, q) => p.x - q.x);
      let out = '';
      let end = -Infinity;
      for (const w of line) {
        const gap = w.x - end;
        if (out !== '') {
          if (gap > 1.5 * w.size) out += '    ';
          else if (gap > 0.15 * w.size && !out.endsWith(' ') && !w.str.startsWith(' ')) out += ' ';
        }
        out += w.str;
        end = w.x + w.w;
      }
      return out.trimEnd();
    })
    .join('\n');
}

type PdfJs = Awaited<ReturnType<typeof getResolvedPDFJS>>;
type PdfPage = Awaited<ReturnType<Awaited<ReturnType<PdfJs['getDocument']>['promise']>['getPage']>>;

interface PdfImageObject {
  width: number;
  height: number;
  kind?: number;
  data?: Uint8Array | Uint8ClampedArray;
}

/** The largest image drawn on a page, as 8-bit gray or RGB pixels. */
async function largestImage(pdfjs: PdfJs, page: PdfPage): Promise<RawImage | undefined> {
  const ops = await page.getOperatorList();
  let best: PdfImageObject | undefined;
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] as unknown[] | null;
    let obj: PdfImageObject | undefined;
    if (fn === pdfjs.OPS.paintImageXObject && typeof args?.[0] === 'string') {
      const key = args[0];
      const store = key.startsWith('g_') ? page.commonObjs : page.objs;
      obj = await Promise.race([
        new Promise<PdfImageObject | undefined>((resolve) => {
          store.get(key, (o: unknown) => resolve(o as PdfImageObject));
        }),
        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 5000).unref()),
      ]);
    } else if (fn === pdfjs.OPS.paintInlineImageXObject) {
      obj = args?.[0] as PdfImageObject | undefined;
    }
    if (obj?.data && obj.width > 0 && obj.height > 0) {
      if (!best || obj.width * obj.height > best.width * best.height) best = obj;
    }
  }
  if (!best?.data) return undefined;
  const { width, height, data } = best;
  const n = width * height;
  // PDF.js image kinds: 1 = 1 bit gray (rows padded to bytes), 2 = RGB, 3 = RGBA.
  if (best.kind === 1 || data.length === Math.ceil(width / 8) * height) {
    const out = new Uint8Array(n);
    const rowBytes = Math.ceil(width / 8);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bit = (data[y * rowBytes + (x >> 3)]! >> (7 - (x & 7))) & 1;
        out[y * width + x] = bit ? 255 : 0;
      }
    }
    return { width, height, channels: 1, data: out };
  }
  if (data.length === n * 3) return { width, height, channels: 3, data: Uint8Array.from(data) };
  if (data.length === n * 4) {
    const out = new Uint8Array(n * 3);
    for (let i = 0; i < n; i++) {
      out[i * 3] = data[i * 4]!;
      out[i * 3 + 1] = data[i * 4 + 1]!;
      out[i * 3 + 2] = data[i * 4 + 2]!;
    }
    return { width, height, channels: 3, data: out };
  }
  if (data.length === n) return { width, height, channels: 1, data: Uint8Array.from(data) };
  return undefined;
}

/** A PNG of the image small enough to send, trying color, then gray, then smaller. */
export function imageForClaude(img: RawImage): ReviewImage | undefined {
  for (const [edge, gray] of [
    [SCAN_MAX_EDGE, false],
    [SCAN_MAX_EDGE, true],
    [1200, true],
    [900, true],
  ] as const) {
    let candidate = downscale(img, edge);
    if (gray) candidate = toGray(candidate);
    const png = encodePng(candidate);
    if (png.length <= MAX_IMAGE_BYTES) return { mimeType: 'image/png', data: png };
  }
  return undefined;
}

async function reviewPdf(bytes: Uint8Array, fromPage: number): Promise<ReviewResult> {
  const pdfjs = await getResolvedPDFJS();
  const task = pdfjs.getDocument({
    // A copy: PDF.js may take ownership of the buffer it is given.
    data: new Uint8Array(bytes),
    // Read this file and nothing else: no URLs, no font, character map or WebAssembly downloads.
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
    const pages = doc.numPages;
    if (fromPage > pages) return { format: 'pdf', pages, items: [], problem: 'out_of_range' };
    const items: ReviewPage[] = [];
    let chars = 0;
    let images = 0;
    let p = fromPage;
    for (; p <= pages && items.length < MAX_PAGES_PER_CALL; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let text = layoutText(
        content.items.flatMap((i) =>
          'str' in i ? [{ str: i.str, transform: i.transform as number[], width: i.width }] : [],
        ),
      );
      if (text.replace(/\s/g, '').length < MIN_TEXT_CHARS) {
        // A scan: send the page image instead, within the per-call limits.
        if (images >= MAX_IMAGES_PER_CALL) break;
        const raw = await largestImage(pdfjs, page);
        const image = raw ? imageForClaude(raw) : undefined;
        items.push({ page: p, text, ...(image ? { image } : { noText: true }) });
        if (image) images++;
        continue;
      }
      if (items.length > 0 && chars + text.length > MAX_TEXT_CHARS) break;
      const truncated = text.length > MAX_TEXT_CHARS;
      if (truncated) text = text.slice(0, MAX_TEXT_CHARS);
      chars += text.length;
      items.push({ page: p, text, ...(truncated ? { truncated } : {}) });
    }
    return { format: 'pdf', pages, items, ...(p <= pages ? { nextPage: p } : {}) };
  } catch (err) {
    const name = (err as { name?: string }).name;
    return {
      format: 'pdf',
      pages: 0,
      items: [],
      problem: name === 'PasswordException' ? 'encrypted' : 'unreadable',
    };
  } finally {
    await task.destroy();
  }
}

/** Splits a text file into "pages" of at most MAX_TEXT_CHARS, at line ends where possible. */
function reviewText(bytes: Uint8Array, fromPage: number): ReviewResult {
  const text = new TextDecoder('utf-8').decode(bytes);
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > 0) {
    let cut = rest.length <= MAX_TEXT_CHARS ? rest.length : rest.lastIndexOf('\n', MAX_TEXT_CHARS);
    if (cut <= 0) cut = Math.min(rest.length, MAX_TEXT_CHARS);
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, '');
  }
  const pages = Math.max(chunks.length, 1);
  if (fromPage > pages) return { format: 'text', pages, items: [], problem: 'out_of_range' };
  return {
    format: 'text',
    pages,
    items: [{ page: fromPage, text: chunks[fromPage - 1] ?? '' }],
    ...(fromPage < pages ? { nextPage: fromPage + 1 } : {}),
  };
}

/**
 * The document's content for Claude, from `fromPage` on, within the per-call limits.
 * Never throws for a bad document: it says what the problem is.
 */
export async function readForReview(
  bytes: Uint8Array,
  filename: string,
  fromPage = 1,
): Promise<ReviewResult> {
  if (bytes.length === 0) return { format: 'unsupported', pages: 0, items: [], problem: 'empty' };
  const format = sniff(bytes, filename);
  switch (format) {
    case 'pdf':
      return reviewPdf(bytes, fromPage);
    case 'jpeg':
    case 'png': {
      if (fromPage > 1) return { format, pages: 1, items: [], problem: 'out_of_range' };
      if (bytes.length > MAX_IMAGE_BYTES) {
        return { format, pages: 1, items: [], problem: 'too_large' };
      }
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      return {
        format,
        pages: 1,
        items: [{ page: 1, text: '', image: { mimeType, data: Buffer.from(bytes) } }],
      };
    }
    case 'text':
      return reviewText(bytes, fromPage);
    case 'heic':
      return { format: 'unsupported', pages: 0, items: [], problem: 'heic' };
    default:
      return { format: 'unsupported', pages: 0, items: [], problem: 'unsupported' };
  }
}
