// The barcode reader: ZXing-C++ compiled to WebAssembly (zxing-wasm, MIT; ZXing-C++, Apache-2.0).
// No native module, and no network: by default zxing-wasm downloads its .wasm file from a CDN, so
// Taxpresso never lets it locate or fetch anything. It reads the binary from a file on this
// computer (shipped next to the server bundle), checks it is the exact binary this version of
// zxing-wasm was built with, and instantiates it itself (instantiateWasm), so no URL is ever built.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import {
  prepareZXingModule,
  readBarcodes,
  ZXING_WASM_SHA256,
  type ReaderOptions,
} from 'zxing-wasm/reader';

/** 8-bit gray pixels, one byte per pixel, rows top to bottom. */
export interface GrayImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Structured Append (Macro PDF417): which part of a sequence a symbol is. */
export interface SequenceInfo {
  /** 0-based. */
  index: number;
  /** Number of symbols, 0 when the symbol doesn't say (ZXing: optional segment count absent). */
  size: number;
  /** The file id shared by all symbols of one sequence. */
  id: string;
}

export interface FoundSymbol {
  format: 'PDF417' | 'Code128';
  bytes: Uint8Array;
  /** The content as text (for Code 128: the digits). */
  text: string;
  sequence?: SequenceInfo;
  /** Macro PDF417 optional field 0 (file name), when present. */
  fileName?: string;
}

export class BarcodeReaderUnavailable extends Error {}

// The global WebAssembly object, typed here (the project's TypeScript libs don't include it).
declare const WebAssembly: {
  instantiate(bytes: ArrayBuffer, imports: object): Promise<{ instance: object; module: object }>;
};

let wasmPath: string | undefined;
let ready: Promise<void> | undefined;

/**
 * Where the reader's WebAssembly binary is. The extension calls this once at start with the file
 * shipped next to its bundle; tests and development use the copy in node_modules.
 */
export function setBarcodeWasmPath(path: string): void {
  wasmPath = path;
  ready = undefined;
}

function defaultWasmPath(): string {
  return createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm');
}

async function load(): Promise<void> {
  const file = wasmPath ?? defaultWasmPath();
  const bytes = await readFile(file);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== ZXING_WASM_SHA256) {
    throw new BarcodeReaderUnavailable('The barcode reader binary is not the expected one.');
  }
  const binary = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  await prepareZXingModule({
    overrides: {
      // Never locate or download anything: the binary is given, and instantiated here.
      locateFile: (name: string) => name,
      wasmBinary: binary,
      instantiateWasm: (imports: object, done: (instance: object, module: object) => void) => {
        void WebAssembly.instantiate(binary, imports).then((r) => done(r.instance, r.module));
        return {};
      },
    },
    fireImmediately: true,
  });
}

function ensure(): Promise<void> {
  ready ??= load().catch((err: unknown) => {
    ready = undefined;
    throw err instanceof BarcodeReaderUnavailable
      ? err
      : new BarcodeReaderUnavailable(`The barcode reader could not start: ${String(err)}`);
  });
  return ready;
}

const OPTIONS: ReaderOptions = {
  formats: ['PDF417', 'Code128'],
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  maxNumberOfSymbols: 32,
  // Binary payloads: the raw bytes are what count; text is only used for Code 128 digits.
  textMode: 'Plain',
  characterSet: 'ISO8859_1',
};

/** Normalizes one ZXing result; undefined for anything Taxpresso doesn't read. */
function toSymbol(r: Awaited<ReturnType<typeof readBarcodes>>[number]): FoundSymbol | undefined {
  if (!r.isValid) return undefined;
  const format = r.format === 'PDF417' ? 'PDF417' : r.format === 'Code128' ? 'Code128' : undefined;
  if (!format) return undefined;
  const symbol: FoundSymbol = { format, bytes: Uint8Array.from(r.bytes), text: r.text };
  if (format === 'PDF417' && r.sequenceSize >= 0 && r.sequenceIndex >= 0) {
    symbol.sequence = { index: r.sequenceIndex, size: r.sequenceSize, id: r.sequenceId };
    try {
      const extra = JSON.parse(r.extra || '{}') as { FileName?: unknown };
      if (typeof extra.FileName === 'string') symbol.fileName = extra.FileName;
    } catch {
      /* no metadata */
    }
  }
  return symbol;
}

/** Every PDF417 and Code 128 symbol found in a gray image. */
export async function scanGray(img: GrayImage): Promise<FoundSymbol[]> {
  await ensure();
  const n = img.width * img.height;
  if (img.data.length !== n || n === 0) return [];
  const rgba = new Uint8ClampedArray(n * 4);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const v = img.data[i]!;
    rgba[j] = v;
    rgba[j + 1] = v;
    rgba[j + 2] = v;
    rgba[j + 3] = 255;
  }
  const results = await readBarcodes(
    { data: rgba, width: img.width, height: img.height, colorSpace: 'srgb' },
    OPTIONS,
  );
  return results.flatMap((r) => toSymbol(r) ?? []);
}

/** Every PDF417 and Code 128 symbol in a JPEG or PNG file (decoded inside the WebAssembly). */
export async function scanImageFile(bytes: Uint8Array): Promise<FoundSymbol[]> {
  await ensure();
  const results = await readBarcodes(Uint8Array.from(bytes), OPTIONS);
  return results.flatMap((r) => toSymbol(r) ?? []);
}
