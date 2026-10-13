// A minimal ZIP reader for barcode payloads (PKWARE APPNOTE: local file header, central
// directory, end of central directory), so no archive library ships in the extension. Stored and
// deflated entries only, CRC-32 and sizes checked, and a hard cap on what an entry may inflate to.
//
// Java's java.util.zip.ZipOutputStream, which the Swissdec salary certificate barcode uses
// (std-swissdec-elm5-lohnausweis-richtlinien-fr, TaxAccountingOverview_f.pdf p. 35), writes
// deflated entries with "sizes in a data descriptor" (flag bit 3): the local header then has zero
// sizes, and the real ones are in the central directory. Both layouts are read.
import { inflateRawSync } from 'node:zlib';
import { crc32 } from '../png.js';

export class ZipError extends Error {}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;

/** A ZIP archive starts with a local file header ("PK\3\4"). */
export const isZip = (b: Uint8Array): boolean =>
  b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

interface Header {
  name: string;
  flags: number;
  method: number;
  crc: number;
  compressed: number;
  size: number;
  offset: number;
}

function view(b: Uint8Array): DataView {
  return new DataView(b.buffer, b.byteOffset, b.byteLength);
}

function decodeName(b: Uint8Array, utf8: boolean): string {
  return new TextDecoder(utf8 ? 'utf-8' : 'latin1').decode(b);
}

/** The central directory's entries, or undefined when the archive has none (cut or streamed). */
function centralDirectory(b: Uint8Array): Header[] | undefined {
  const v = view(b);
  // The end record is in the last 22 + 65535 bytes (its comment is at most 65535 bytes).
  for (let p = b.length - 22; p >= Math.max(0, b.length - 22 - 0xffff); p--) {
    if (v.getUint32(p, true) !== END) continue;
    const count = v.getUint16(p + 10, true);
    let q = v.getUint32(p + 16, true);
    const headers: Header[] = [];
    for (let i = 0; i < count; i++) {
      if (q + 46 > b.length || v.getUint32(q, true) !== CENTRAL) {
        throw new ZipError('Broken central directory');
      }
      const flags = v.getUint16(q + 8, true);
      const nameLength = v.getUint16(q + 28, true);
      const extraLength = v.getUint16(q + 30, true);
      const commentLength = v.getUint16(q + 32, true);
      if (q + 46 + nameLength > b.length) throw new ZipError('Broken central directory');
      headers.push({
        flags,
        method: v.getUint16(q + 10, true),
        crc: v.getUint32(q + 16, true),
        compressed: v.getUint32(q + 20, true),
        size: v.getUint32(q + 24, true),
        name: decodeName(b.subarray(q + 46, q + 46 + nameLength), (flags & 0x800) !== 0),
        offset: v.getUint32(q + 42, true),
      });
      q += 46 + nameLength + extraLength + commentLength;
    }
    return headers;
  }
  return undefined;
}

/** The local headers read one after another from the start (only when sizes are in them). */
function localHeaders(b: Uint8Array): Header[] {
  const v = view(b);
  const headers: Header[] = [];
  let p = 0;
  while (p + 30 <= b.length && v.getUint32(p, true) === LOCAL) {
    const flags = v.getUint16(p + 6, true);
    if (flags & 0x8) throw new ZipError('Entry sizes are only in the central directory, missing');
    const nameLength = v.getUint16(p + 26, true);
    const extraLength = v.getUint16(p + 28, true);
    const header: Header = {
      flags,
      method: v.getUint16(p + 8, true),
      crc: v.getUint32(p + 14, true),
      compressed: v.getUint32(p + 18, true),
      size: v.getUint32(p + 22, true),
      name: decodeName(b.subarray(p + 30, p + 30 + nameLength), (flags & 0x800) !== 0),
      offset: p,
    };
    headers.push(header);
    p += 30 + nameLength + extraLength + header.compressed;
  }
  return headers;
}

function extract(b: Uint8Array, h: Header, maxBytes: number): Uint8Array {
  const v = view(b);
  if (h.offset + 30 > b.length || v.getUint32(h.offset, true) !== LOCAL) {
    throw new ZipError('Missing local file header');
  }
  if (h.flags & 0x1) throw new ZipError('Encrypted entry');
  const start = h.offset + 30 + v.getUint16(h.offset + 26, true) + v.getUint16(h.offset + 28, true);
  const end = start + h.compressed;
  if (end > b.length) throw new ZipError('Entry is cut short');
  if (h.size > maxBytes) throw new ZipError('Entry too large');
  const raw = b.subarray(start, end);
  let data: Uint8Array;
  if (h.method === 0) data = raw;
  else if (h.method === 8) {
    try {
      data = inflateRawSync(raw, { maxOutputLength: maxBytes });
    } catch (err) {
      throw new ZipError(`Entry can't be inflated: ${(err as Error).message}`);
    }
  } else throw new ZipError(`Compression method ${h.method} not supported`);
  if (data.length !== h.size) throw new ZipError('Entry size does not match');
  if (crc32(data) !== h.crc) throw new ZipError('Entry CRC-32 does not match');
  return data;
}

/** Every file in a ZIP archive, checked. Throws ZipError for anything it can't trust. */
export function readZip(bytes: Uint8Array, maxBytes = 8 * 1024 * 1024): ZipEntry[] {
  if (!isZip(bytes)) throw new ZipError('Not a ZIP archive');
  const headers = centralDirectory(bytes) ?? localHeaders(bytes);
  if (headers.length === 0) throw new ZipError('Empty archive');
  if (headers.length > 64) throw new ZipError('Too many entries');
  let total = 0;
  return headers
    .filter((h) => !h.name.endsWith('/'))
    .map((h) => {
      if (maxBytes - total <= 0) throw new ZipError('Archive too large');
      const data = extract(bytes, h, maxBytes - total);
      total += data.length;
      return { name: h.name, data };
    });
}
