// Finds the places a barcode can be in a PDF, without native code (SPEC.md section 5.1):
//  (a) images drawn on a page: a scanned or photographed page (one big JPEG, as on some salary
//      certificates), or small barcode images (an e-tax statement's PDF417 segments are 290 x 35
//      pixels, one pixel per module and per row: std-eCH-0270-codes-barres-generation p. 9,
//      std-eCH-0196-v2-2-0-wegleitung-de p. 36), which are enlarged and given a quiet zone;
//  (b) barcodes drawn as vector graphics: payroll and banking software often paint PDF417 as many
//      filled rectangles. The filled rectangles of each cluster are rasterized here, in integer
//      pixels, into a 1-bit image.
// Pages are visited last to first: barcode sheets are usually at the end (std-eCH-0270-codes-
// barres-generation p. 11, std-eCH-0196-barcode-annex-v2-2-0 p. 9).
//
// PDF.js (in unpdf) is only ever given bytes: no URL, no fonts, no WebAssembly location.
import { getResolvedPDFJS } from 'unpdf';
import type { GrayImage } from './zxing.js';

type PdfJs = Awaited<ReturnType<typeof getResolvedPDFJS>>;
type PdfDocument = Awaited<ReturnType<PdfJs['getDocument']>['promise']>;
type PdfPage = Awaited<ReturnType<PdfDocument['getPage']>>;

export interface PageBitmap {
  page: number;
  source: 'image' | 'vector';
  image: GrayImage;
}

/** Images and rasters larger than this many pixels are left out (a 600 dpi A4 scan is ~35 M). */
const MAX_PIXELS = 40_000_000;
/** Below this width an image is treated as a small barcode image and enlarged. */
export const SMALL_IMAGE = 800;
/** Most filled rectangles looked at on one page (a dense PDF417 has a few thousand). */
const MAX_RECTS = 60_000;
/** A rectangle larger than this (in points) is a frame or a table rule, not a bar. */
const MAX_BAR_SIDE = 60;
/** Rectangles closer than this (points) belong to the same barcode. */
const CLUSTER_GAP = 4;
/** A cluster needs this many dark rectangles to be worth scanning. */
const MIN_BARS = 24;

interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}
const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** m applied first, then n (PDF: CTM' = m x CTM). */
function multiply(m: Matrix, n: Matrix): Matrix {
  return {
    a: m.a * n.a + m.b * n.c,
    b: m.a * n.b + m.b * n.d,
    c: m.c * n.a + m.d * n.c,
    d: m.c * n.b + m.d * n.d,
    e: m.e * n.a + m.f * n.c + n.e,
    f: m.e * n.b + m.f * n.d + n.f,
  };
}

const apply = (m: Matrix, x: number, y: number): [number, number] => [
  m.a * x + m.c * y + m.e,
  m.b * x + m.d * y + m.f,
];

const toMatrix = (v: unknown): Matrix | undefined => {
  if (!Array.isArray(v) && !ArrayBuffer.isView(v)) return undefined;
  const [a, b, c, d, e, f] = Array.from(v as ArrayLike<number>);
  if ([a, b, c, d, e, f].some((x) => typeof x !== 'number' || !Number.isFinite(x)))
    return undefined;
  return { a: a!, b: b!, c: c!, d: d!, e: e!, f: f! };
};

/** Luminance 0..255 of a fill color as PDF.js reports it ("#rrggbb"). */
function luminance(color: unknown): number {
  if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000;
  }
  return 0; // unknown: PDF's default fill is black
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  dark: boolean;
}

interface PdfImageObject {
  width: number;
  height: number;
  kind?: number;
  data?: Uint8Array | Uint8ClampedArray;
}

/** PDF.js image data (1-bit, gray, RGB or RGBA) as 8-bit gray. */
export function imageToGray(obj: PdfImageObject): GrayImage | undefined {
  const { width, height, data } = obj;
  if (!data || width <= 0 || height <= 0 || width * height > MAX_PIXELS) return undefined;
  const n = width * height;
  const out = new Uint8Array(n);
  const rowBytes = Math.ceil(width / 8);
  if (obj.kind === 1 || data.length === rowBytes * height) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bit = (data[y * rowBytes + (x >> 3)]! >> (7 - (x & 7))) & 1;
        out[y * width + x] = bit ? 255 : 0;
      }
    }
    return { width, height, data: out };
  }
  const channels = data.length / n;
  if (channels !== 1 && channels !== 3 && channels !== 4) return undefined;
  for (let i = 0; i < n; i++) {
    if (channels === 1) out[i] = data[i]!;
    else {
      const p = i * channels;
      out[i] = Math.round((data[p]! * 299 + data[p + 1]! * 587 + data[p + 2]! * 114) / 1000);
    }
  }
  return { width, height, data: out };
}

/**
 * A small barcode image enlarged so ZXing can read it: modules at least 3 pixels wide, rows at
 * least 3 times their width (std-eCH-0270-codes-barres-generation p. 9: elements 0.042 cm wide and
 * 0.08 cm high), and a white quiet zone around it. Large images (page scans) are left as they are.
 */
export function prepareImage(img: GrayImage): GrayImage {
  if (img.width >= SMALL_IMAGE) return img;
  const sx = Math.max(1, Math.min(4, Math.ceil(SMALL_IMAGE / 2 / img.width)));
  // A strip much wider than high: rows are probably one pixel each.
  const sy = img.width > 4 * img.height ? sx * 3 : sx;
  return enlarge(img, sx, sy, 12 * sx);
}

/**
 * Bilinear enlargement by `f`. A scanned page whose PDF417 modules are a fraction of a pixel wider
 * than one (12 mil at 144 ppi is about 1.7 pixels) can defeat the binarizer; enlarged 1.5 or 2
 * times it reads (measured on the synthetic fixtures, docs/spikes/S2.md).
 */
export function upscale(img: GrayImage, f: number): GrayImage {
  const width = Math.round(img.width * f);
  const height = Math.round(img.height * f);
  const data = new Uint8Array(width * height);
  const src = img.data;
  for (let y = 0; y < height; y++) {
    const sy = Math.min(img.height - 1, Math.max(0, (y + 0.5) / f - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(img.height - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < width; x++) {
      const sx = Math.min(img.width - 1, Math.max(0, (x + 0.5) / f - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(img.width - 1, x0 + 1);
      const fx = sx - x0;
      const top = src[y0 * img.width + x0]! * (1 - fx) + src[y0 * img.width + x1]! * fx;
      const bottom = src[y1 * img.width + x0]! * (1 - fx) + src[y1 * img.width + x1]! * fx;
      data[y * width + x] = Math.round(top * (1 - fy) + bottom * fy);
    }
  }
  return { width, height, data };
}

/** Nearest-neighbour enlargement with a white border of `pad` pixels. */
export function enlarge(img: GrayImage, sx: number, sy: number, pad: number): GrayImage {
  const width = img.width * sx + 2 * pad;
  const height = img.height * sy + 2 * pad;
  const data = new Uint8Array(width * height).fill(255);
  for (let y = 0; y < img.height; y++) {
    const row = new Uint8Array(img.width * sx);
    for (let x = 0; x < img.width; x++) row.fill(img.data[y * img.width + x]!, x * sx, x * sx + sx);
    for (let k = 0; k < sy; k++) data.set(row, (pad + y * sy + k) * width + pad);
  }
  return { width, height, data };
}

/** Axis-aligned rectangles of one path (4 corners after the CTM), others are ignored. */
function pathRects(path: ArrayLike<number>, ctm: Matrix, dark: boolean, out: Rect[]): void {
  // PDF.js path data: 0 moveTo x y, 1 lineTo x y, 2 curveTo 6 numbers, 3 quadraticCurveTo 4, 4 close.
  let points: [number, number][] = [];
  let curved = false;
  const flush = () => {
    if (!curved && (points.length === 4 || points.length === 5)) {
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      const x0 = Math.min(...xs);
      const x1 = Math.max(...xs);
      const y0 = Math.min(...ys);
      const y1 = Math.max(...ys);
      const eps = 1e-3 * Math.max(1, x1 - x0, y1 - y0);
      const onEdge = points.every(
        ([x, y]) =>
          (Math.abs(x - x0) < eps || Math.abs(x - x1) < eps) &&
          (Math.abs(y - y0) < eps || Math.abs(y - y1) < eps),
      );
      if (onEdge && x1 - x0 > 0 && y1 - y0 > 0) out.push({ x0, y0, x1, y1, dark });
    }
    points = [];
    curved = false;
  };
  for (let i = 0; i < path.length;) {
    const op = path[i]!;
    if (op === 0) {
      flush();
      points.push(apply(ctm, path[i + 1]!, path[i + 2]!));
      i += 3;
    } else if (op === 1) {
      points.push(apply(ctm, path[i + 1]!, path[i + 2]!));
      i += 3;
    } else if (op === 2) {
      curved = true;
      i += 7;
    } else if (op === 3) {
      curved = true;
      i += 5;
    } else if (op === 4) {
      flush();
      i += 1;
    } else break;
  }
  flush();
}

interface PageContent {
  images: GrayImage[];
  rects: Rect[];
}

async function objectOf(page: PdfPage, key: string): Promise<PdfImageObject | undefined> {
  const store = key.startsWith('g_') ? page.commonObjs : page.objs;
  return Promise.race([
    new Promise<PdfImageObject | undefined>((resolve) => {
      store.get(key, (o: unknown) => resolve(o as PdfImageObject));
    }),
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 5000).unref()),
  ]);
}

/** The images and the filled rectangles of one page, in default user space (points). */
async function pageContent(pdfjs: PdfJs, page: PdfPage): Promise<PageContent> {
  const ops = await page.getOperatorList();
  const OPS = pdfjs.OPS;
  const fills = new Set<number>([
    OPS.fill,
    OPS.eoFill,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke,
  ]);
  const images: GrayImage[] = [];
  const rects: Rect[] = [];
  let ctm = IDENTITY;
  let fill = 0;
  const stack: { ctm: Matrix; fill: number }[] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] as unknown[] | null;
    switch (fn) {
      case OPS.save:
        stack.push({ ctm, fill });
        break;
      case OPS.restore:
        ({ ctm, fill } = stack.pop() ?? { ctm, fill });
        break;
      case OPS.transform: {
        const m = toMatrix(args);
        if (m) ctm = multiply(m, ctm);
        break;
      }
      case OPS.paintFormXObjectBegin: {
        stack.push({ ctm, fill });
        const m = toMatrix(args?.[0]);
        if (m) ctm = multiply(m, ctm);
        break;
      }
      case OPS.paintFormXObjectEnd:
        ({ ctm, fill } = stack.pop() ?? { ctm, fill });
        break;
      case OPS.setFillRGBColor:
      case OPS.setFillGray:
      case OPS.setFillCMYKColor:
        fill = luminance(args?.[0]);
        break;
      case OPS.constructPath: {
        // PDF.js 5+: [paint operator, [path data], bounding box].
        const paint = args?.[0];
        const data = (args?.[1] as unknown[] | undefined)?.[0];
        if (typeof paint === 'number' && fills.has(paint) && data && rects.length < MAX_RECTS) {
          pathRects(data as ArrayLike<number>, ctm, fill < 128, rects);
        }
        break;
      }
      case OPS.paintImageXObject:
      case OPS.paintImageXObjectRepeat:
      case OPS.paintImageMaskXObject:
      case OPS.paintInlineImageXObject: {
        const obj =
          typeof args?.[0] === 'string'
            ? await objectOf(page, args[0])
            : (args?.[0] as PdfImageObject | undefined);
        const gray = obj ? imageToGray(obj) : undefined;
        if (gray) images.push(gray);
        break;
      }
      default:
        break;
    }
  }
  return { images, rects };
}

/** Groups the dark bar-sized rectangles that lie close together (a grid makes it near linear). */
export function clusterBars(rects: readonly Rect[]): Rect[][] {
  const bars = rects
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.dark && r.x1 - r.x0 <= MAX_BAR_SIDE && r.y1 - r.y0 <= MAX_BAR_SIDE * 2);
  const parent = bars.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]!]!;
    return i;
  };
  // Each rectangle goes into every grid cell its gap-widened box touches, so two neighbours on
  // either side of a cell border still meet in one cell.
  const cell = 16;
  const grid = new Map<string, number[]>();
  bars.forEach(({ r }, k) => {
    const gx0 = Math.floor((r.x0 - CLUSTER_GAP) / cell);
    const gx1 = Math.floor((r.x1 + CLUSTER_GAP) / cell);
    const gy0 = Math.floor((r.y0 - CLUSTER_GAP) / cell);
    const gy1 = Math.floor((r.y1 + CLUSTER_GAP) / cell);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const key = `${gx},${gy}`;
        const list = grid.get(key);
        if (list) list.push(k);
        else grid.set(key, [k]);
      }
    }
  });
  const near = (p: Rect, q: Rect) =>
    p.x0 - CLUSTER_GAP <= q.x1 &&
    q.x0 - CLUSTER_GAP <= p.x1 &&
    p.y0 - CLUSTER_GAP <= q.y1 &&
    q.y0 - CLUSTER_GAP <= p.y1;
  for (const list of grid.values()) {
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const i = list[a]!;
        const j = list[b]!;
        if (find(i) !== find(j) && near(bars[i]!.r, bars[j]!.r)) parent[find(i)] = find(j);
      }
    }
  }
  const groups = new Map<number, Rect[]>();
  bars.forEach(({ r }, k) => {
    const root = find(k);
    const group = groups.get(root);
    if (group) group.push(r);
    else groups.set(root, [r]);
  });
  return [...groups.values()].filter((g) => g.length >= MIN_BARS);
}

/**
 * Rasterizes one cluster: every filled rectangle that overlaps it, in painting order (light ones
 * paint white), at a scale where the narrowest bar is at least 3 pixels wide, with a quiet zone.
 * The PDF's y axis points up; image rows go down, so it is flipped (a mirrored PDF417 can't be
 * read, a rotated one can).
 */
export function rasterize(cluster: readonly Rect[], all: readonly Rect[]): GrayImage | undefined {
  let [x0, x1, y0, y1, narrow] = [Infinity, -Infinity, Infinity, -Infinity, Infinity];
  for (const r of cluster) {
    x0 = Math.min(x0, r.x0);
    x1 = Math.max(x1, r.x1);
    y0 = Math.min(y0, r.y0);
    y1 = Math.max(y1, r.y1);
    narrow = Math.min(narrow, r.x1 - r.x0, r.y1 - r.y0);
  }
  if (!(narrow > 0) || !Number.isFinite(x0)) return undefined;
  let scale = Math.min(3 / narrow, 40);
  const pad = 16;
  let width = Math.ceil((x1 - x0) * scale) + 2 * pad;
  let height = Math.ceil((y1 - y0) * scale) + 2 * pad;
  if (width * height > MAX_PIXELS) {
    scale *= Math.sqrt(MAX_PIXELS / (width * height));
    width = Math.ceil((x1 - x0) * scale) + 2 * pad;
    height = Math.ceil((y1 - y0) * scale) + 2 * pad;
  }
  const data = new Uint8Array(width * height).fill(255);
  for (const r of all) {
    if (r.x1 < x0 || r.x0 > x1 || r.y1 < y0 || r.y0 > y1) continue;
    const px0 = Math.max(0, Math.round((r.x0 - x0) * scale) + pad);
    const px1 = Math.min(width, Math.round((r.x1 - x0) * scale) + pad);
    const py0 = Math.max(0, Math.round((y1 - r.y1) * scale) + pad);
    const py1 = Math.min(height, Math.round((y1 - r.y0) * scale) + pad);
    const v = r.dark ? 0 : 255;
    for (let y = py0; y < py1; y++) data.fill(v, y * width + px0, y * width + px1);
  }
  return { width, height, data };
}

export interface PdfScanOptions {
  /** Most pages looked at, from the last one back. */
  maxPages?: number;
  /** Stop once this returns true (every symbol of a sequence found). */
  done?: () => boolean;
}

/**
 * Walks a PDF from its last page to its first, yielding every image and every vector-drawn
 * barcode cluster as a gray bitmap ready for the reader. Throws for an unreadable or encrypted PDF.
 */
export async function* pdfBitmaps(
  bytes: Uint8Array,
  opts: PdfScanOptions = {},
): AsyncGenerator<PageBitmap & { pages: number }> {
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
    const pages = doc.numPages;
    const last = Math.max(1, pages - (opts.maxPages ?? 20) + 1);
    for (let p = pages; p >= last; p--) {
      if (opts.done?.()) return;
      const page = await doc.getPage(p);
      const { images, rects } = await pageContent(pdfjs, page);
      for (const img of images) yield { page: p, pages, source: 'image', image: prepareImage(img) };
      for (const cluster of clusterBars(rects)) {
        const image = rasterize(cluster, rects);
        if (image) yield { page: p, pages, source: 'vector', image };
      }
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
}
