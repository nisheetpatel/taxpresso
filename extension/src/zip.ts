// A minimal ZIP writer (PKWARE APPNOTE 6.3: local file headers, central directory, end record) for
// the copy of the tax folder (./export.ts), with node:zlib and node:fs only: no archive library
// ships in the extension. Deflated entries, or stored when deflating doesn't make them smaller
// (PDFs often are compressed already); names in UTF-8 (flag bit 11); no ZIP64, so the archive
// stays under 4 GB and 65'535 entries, which a tax folder never reaches (documents are 40 MB at
// most). The file is created exclusively: an existing file is never overwritten.
import { open, readFile, unlink } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';

export class ZipTooLargeError extends Error {}

export interface ZipInput {
  /** The entry's name in the archive, with forward slashes. */
  name: string;
  /** The file to read it from. */
  path: string;
  /** Last modified, kept as the entry's date. */
  mtime: Date;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (ISO 3309), as ZIP stores it. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time, local time, two-second steps; 1980 at the earliest. */
function dosDateTime(d: Date): { date: number; time: number } {
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1980) return { date: (1 << 5) | 1, time: 0 };
  return {
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
  };
}

const MAX_32 = 0xffffffff;
const UTF8 = 0x0800;

interface Written {
  name: Buffer;
  method: number;
  crc: number;
  compressed: number;
  size: number;
  offset: number;
  date: number;
  time: number;
}

/**
 * Writes the archive to `target`, which must not exist yet (EEXIST otherwise: nothing is
 * overwritten). On any failure the partly written file is removed. Returns its size in bytes.
 */
export async function writeZip(target: string, inputs: readonly ZipInput[]): Promise<number> {
  if (inputs.length > 0xffff) throw new ZipTooLargeError('Too many files for one ZIP.');
  const file = await open(target, 'wx');
  let offset = 0;
  const write = async (chunk: Buffer) => {
    await file.write(chunk);
    offset += chunk.length;
    if (offset > MAX_32) throw new ZipTooLargeError('The folder is too large for one ZIP.');
  };
  try {
    const written: Written[] = [];
    for (const input of inputs) {
      const data = await readFile(input.path);
      const deflated = deflateRawSync(data);
      const stored = deflated.length >= data.length;
      const body = stored ? data : deflated;
      const name = Buffer.from(input.name, 'utf8');
      const { date, time } = dosDateTime(input.mtime);
      const entry: Written = {
        name,
        method: stored ? 0 : 8,
        crc: crc32(data),
        compressed: body.length,
        size: data.length,
        offset,
        date,
        time,
      };
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0);
      header.writeUInt16LE(20, 4); // version needed: 2.0 (deflate)
      header.writeUInt16LE(UTF8, 6);
      header.writeUInt16LE(entry.method, 8);
      header.writeUInt16LE(time, 10);
      header.writeUInt16LE(date, 12);
      header.writeUInt32LE(entry.crc, 14);
      header.writeUInt32LE(entry.compressed, 18);
      header.writeUInt32LE(entry.size, 22);
      header.writeUInt16LE(name.length, 26);
      header.writeUInt16LE(0, 28);
      await write(Buffer.concat([header, name]));
      await write(body);
      written.push(entry);
    }
    const start = offset;
    for (const e of written) {
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(20, 4); // made by: MS-DOS, 2.0
      central.writeUInt16LE(20, 6);
      central.writeUInt16LE(UTF8, 8);
      central.writeUInt16LE(e.method, 10);
      central.writeUInt16LE(e.time, 12);
      central.writeUInt16LE(e.date, 14);
      central.writeUInt32LE(e.crc, 16);
      central.writeUInt32LE(e.compressed, 20);
      central.writeUInt32LE(e.size, 24);
      central.writeUInt16LE(e.name.length, 28);
      // extra field, comment, disk number, internal and external attributes: 0
      central.writeUInt32LE(e.offset, 42);
      await write(Buffer.concat([central, e.name]));
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(written.length, 8);
    end.writeUInt16LE(written.length, 10);
    end.writeUInt32LE(offset - start, 12);
    end.writeUInt32LE(start, 16);
    await write(end);
    await file.sync();
    await file.close();
    return offset;
  } catch (err) {
    await file.close().catch(() => undefined);
    await unlink(target).catch(() => undefined);
    throw err;
  }
}
