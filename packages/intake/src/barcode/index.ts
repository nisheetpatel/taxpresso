// Barcodes first (SPEC.md section 5): finds the 2D and 1D barcodes of a document and reads what
// they carry. A salary certificate (Swissdec TxAB) or a bank e-tax statement (eCH-0196) whose
// barcode is complete and schema-valid comes back with its values; anything else comes back as
// "none", with what was seen, and the other ways of reading (text layer, Claude) take over.
import { sniff } from '../review.js';
import {
  assembleSegments,
  decompress,
  readEch0196,
  type Compression,
  type Ech0196Statement,
} from './ech0196.js';
import { pdfBitmaps } from './pdf.js';
import { assembleTxab, readTxab, type TxabCertificate } from './txab.js';
import { scanGray, scanImageFile, type FoundSymbol } from './zxing.js';

export interface BarcodeDiagnostics {
  /** Pages looked at, last to first (PDF only). */
  pages: number[];
  pdf417: number;
  code128: number;
  /** Where the symbols were found. */
  sources: ('image' | 'vector' | 'file')[];
  /** Salary certificate: how the control bytes were read, and the bytes themselves (hex). */
  txab?: { layout: 'swissdec' | 'zip-signature'; headers: string[]; symbols: number };
  /** e-tax statement: segments joined and the compression found. */
  ech0196?: { segments: number; compression?: Compression };
  /** Why what was found could not be used (schema problems, missing segments). No values. */
  problems: string[];
}

export type BarcodeResult =
  | { found: 'txab'; certificate: TxabCertificate; diagnostics: BarcodeDiagnostics }
  | { found: 'ech0196'; statement: Ech0196Statement; diagnostics: BarcodeDiagnostics }
  | {
      found: 'none';
      /** A page barcode (eCH-0270 Code 128) says it is an e-tax statement, though its 2D can't be used. */
      classified?: 'ech0196_statement';
      diagnostics: BarcodeDiagnostics;
    };

/** eCH-0270: 16 digits, the first three the eCH form number (196: e-tax statement). */
export function pageBarcodeForm(text: string): string | undefined {
  const digits = text.trim();
  return /^\d{16}$/.test(digits) ? digits.slice(0, 3) : undefined;
}

function complete(symbols: readonly FoundSymbol[]): boolean {
  const plain = symbols.filter((s) => s.format === 'PDF417' && !s.sequence).map((s) => s.bytes);
  const txab = assembleTxab(plain);
  if (txab && 'zip' in txab) return true;
  if (!symbols.some((s) => s.sequence)) return false;
  const seg = assembleSegments(symbols);
  return !!seg && 'data' in seg;
}

export interface ReadBarcodeOptions {
  maxPages?: number;
}

/** Reads the barcodes of one document (PDF, JPEG or PNG). Never throws for a bad document. */
export async function readBarcodes(
  bytes: Uint8Array,
  filename = '',
  opts: ReadBarcodeOptions = {},
): Promise<BarcodeResult> {
  const diagnostics: BarcodeDiagnostics = {
    pages: [],
    pdf417: 0,
    code128: 0,
    sources: [],
    problems: [],
  };
  const symbols: FoundSymbol[] = [];
  const add = (found: FoundSymbol[], source: BarcodeDiagnostics['sources'][number]) => {
    if (!found.length) return;
    symbols.push(...found);
    if (!diagnostics.sources.includes(source)) diagnostics.sources.push(source);
  };
  const format = sniff(bytes, filename);
  try {
    if (format === 'pdf') {
      for await (const bitmap of pdfBitmaps(bytes, {
        maxPages: opts.maxPages ?? 20,
        done: () => complete(symbols),
      })) {
        if (!diagnostics.pages.includes(bitmap.page)) diagnostics.pages.push(bitmap.page);
        add(await scanGray(bitmap.image), bitmap.source);
      }
    } else if (format === 'jpeg' || format === 'png') {
      add(await scanImageFile(bytes), 'file');
    } else {
      return { found: 'none', diagnostics };
    }
  } catch (err) {
    diagnostics.problems.push(`Could not look for barcodes: ${(err as Error).message}`);
    return { found: 'none', diagnostics };
  }
  diagnostics.pdf417 = symbols.filter((s) => s.format === 'PDF417').length;
  diagnostics.code128 = symbols.filter((s) => s.format === 'Code128').length;

  // Salary or pension certificate: plain PDF417 symbols with Swissdec control bytes, or a ZIP.
  const plain = symbols.filter((s) => s.format === 'PDF417' && !s.sequence).map((s) => s.bytes);
  const txab = assembleTxab(plain);
  if (txab && 'zip' in txab) {
    diagnostics.txab = { layout: txab.layout, headers: txab.headers, symbols: txab.symbols };
    const reading = readTxab(txab.zip);
    if (reading.ok) return { found: 'txab', certificate: reading.certificate, diagnostics };
    if (reading.reason !== 'zip') {
      diagnostics.problems.push(...reading.problems.map((p) => `Salary certificate: ${p}`));
    }
  } else if (txab) {
    diagnostics.problems.push(`Salary certificate: ${txab.have} of ${txab.of} barcodes found`);
  }

  // e-tax statement: Macro PDF417 segments (or one plain symbol carrying the whole statement).
  const segments = assembleSegments(symbols);
  if (segments && 'data' in segments) {
    diagnostics.ech0196 = { segments: segments.segments };
    try {
      const { xml, compression } = decompress(segments.data);
      diagnostics.ech0196.compression = compression;
      const reading = readEch0196(xml);
      if (reading.ok) return { found: 'ech0196', statement: reading.statement, diagnostics };
      if (reading.reason !== 'not_ech0196' || symbols.some((s) => s.sequence)) {
        diagnostics.problems.push(...reading.problems.map((p) => `e-tax statement: ${p}`));
      }
    } catch (err) {
      if (symbols.some((s) => s.sequence)) {
        diagnostics.problems.push(`e-tax statement: can't decompress (${(err as Error).message})`);
      }
    }
  } else if (segments && segments.problem === 'incomplete') {
    diagnostics.problems.push(
      `e-tax statement: ${segments.have.length} of ${segments.of ?? 'an unknown number of'} barcode segments found`,
    );
  } else if (segments) {
    diagnostics.problems.push(`e-tax statement: two different segments ${segments.index}`);
  }

  const statementPage = symbols.some(
    (s) => s.format === 'Code128' && pageBarcodeForm(s.text) === '196',
  );
  return {
    found: 'none',
    ...(statementPage ? { classified: 'ech0196_statement' as const } : {}),
    diagnostics,
  };
}

export {
  assembleSegments,
  decompress,
  ECH0196_NAMESPACE,
  readEch0196,
  validateEch0196,
  type Compression,
  type Ech0196Account,
  type Ech0196Liability,
  type Ech0196Reading,
  type Ech0196Security,
  type Ech0196Statement,
} from './ech0196.js';
export { clusterBars, enlarge, imageToGray, pdfBitmaps, prepareImage, rasterize } from './pdf.js';
export {
  assembleTxab,
  parseTxabHeader,
  readTxab,
  salaryAmount,
  TXAB_HEADER_LENGTH,
  TXAB_NAMESPACES,
  validateTxab,
  type TxabCertificate,
  type TxabHeader,
  type TxabReading,
  type TxabValue,
} from './txab.js';
export { isZip, readZip, ZipError, type ZipEntry } from './zip.js';
export {
  BarcodeReaderUnavailable,
  scanGray,
  scanImageFile,
  setBarcodeWasmPath,
  type FoundSymbol,
  type GrayImage,
  type SequenceInfo,
} from './zxing.js';
