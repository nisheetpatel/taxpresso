// Types for barcode-fixtures.mjs (synthetic test fixtures, never shipped).
export interface Gray {
  width: number;
  height: number;
  data: Uint8Array;
}
export interface Matrix {
  cols: number;
  rows: number;
  dark(x: number, y: number): boolean;
}
export interface PdfImage {
  name: string;
  dict: string;
  data: Buffer;
}
export interface PdfPage {
  width: number;
  height: number;
  content: string;
  images?: PdfImage[];
  rotate?: number;
}

export function crc32(bytes: Uint8Array): number;
export function zip(
  entries: { name: string; data: Uint8Array }[],
  opts?: { descriptor?: boolean; store?: boolean },
): Buffer;
export const TXAB_NS_ELM5: string;
export const TXAB_NS_ELM6: string;
export const FAKE_AHV: string;
export function txabXml(opts?: {
  version?: 'elm5' | 'elm6';
  company?: boolean;
  firstName?: string;
  lastName?: string;
  gross?: string;
  extra?: string;
  remark?: string;
  form?: 'S' | 'A' | 'OA';
}): string;
export function txabZip(xml: string): Buffer;
export function txabSymbols(zip: Uint8Array, opts?: { parts?: number; id?: number[] }): Buffer[];
export function pdf417Matrix(bytes: Uint8Array, opts?: { columns?: number }): Promise<Matrix>;
export function code128Matrix(text: string): Promise<Matrix>;
export const SEGMENT_BYTES: number;
export function macroSegments(
  data: Uint8Array,
  opts?: { fileId?: number[]; fileName?: string; withCount?: boolean },
): Matrix[];
export function render(
  matrix: Matrix,
  opts?: { module?: number; row?: number; quiet?: number; rotate?: boolean },
): Gray;
export function rotate90(img: Gray): Gray;
export function paste(dst: Gray, src: Gray, x: number, y: number): void;
export function blank(width: number, height: number): Gray;
export function shrink(img: Gray, factor: number): Gray;
export function encodeJpeg(img: Gray, quality?: number): Buffer;
export function pdf(objects: (string | Buffer)[]): Buffer;
export function stream(dict: string, data: string | Buffer): Buffer;
export function pdfPages(pages: PdfPage[]): Buffer;
export function grayImage(name: string, img: Gray): PdfImage;
export function jpegImage(name: string, img: Gray, quality?: number): PdfImage;
export function vectorBarcode(
  matrix: Matrix,
  opts: { x: number; y: number; module: number; row: number },
): string;
export const ECH0196_NS: string;
export function isin(prefix11: string): string;
export function ech0196Xml(opts?: { extra?: string; foreign?: string }): string;
export function zlibCompress(xml: string): Buffer;
export function salaryCertificateJpegPdf(opts?: {
  xml?: string;
  parts?: number;
  quality?: number;
  /** Module width in pixels on the 144 ppi page, fractions allowed. Default 2. */
  module?: number;
}): Promise<Buffer>;
export function salaryCertificateVectorPdf(opts?: { xml?: string }): Promise<Buffer>;
export function statementPdf(opts?: {
  xml?: string;
  order?: number[];
  drop?: number[];
  compress?: (xml: string) => Buffer;
}): Promise<{ segments: number; bytes: Buffer }>;
