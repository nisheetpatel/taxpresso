// A ZIP of a folder, for the Claude plugin's Upload plugin (extension/scripts/build-plugin.mjs),
// with node:zlib only. PKWARE APPNOTE 6.3: local headers, central directory, end record; names in
// UTF-8; no ZIP64 (the plugin is a few megabytes). Build tooling, never shipped.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

/** Every file under `dir`, sorted. */
export async function walk(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(p)));
    else found.push(p);
  }
  return found.sort();
}

/**
 * A ZIP of `dir` under `top/`, its single top-level folder, deflated, with a fixed date so the
 * same folder gives the same bytes. Unix modes: 0644 files, 0755 folders.
 * @returns {Promise<Buffer>}
 */
export async function zipFolder(dir, top) {
  const entries = [{ name: `${top}/`, data: null }];
  const dirs = new Set([`${top}/`]);
  for (const file of await walk(dir)) {
    const name = `${top}/${path.relative(dir, file).split(path.sep).join('/')}`;
    const parts = name.split('/');
    for (let i = 2; i < parts.length; i++) {
      const d = parts.slice(0, i).join('/') + '/';
      if (!dirs.has(d)) {
        dirs.add(d);
        entries.push({ name: d, data: null });
      }
    }
    entries.push({ name, data: await readFile(file) });
  }
  const date = ((2026 - 1980) << 9) | (1 << 5) | 1; // MS-DOS date of 2026-01-01; time 00:00
  const local = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const raw = e.data ?? Buffer.alloc(0);
    const deflated = e.data ? deflateRawSync(raw, { level: 9 }) : raw;
    const stored = !e.data || deflated.length >= raw.length;
    const body = stored ? raw : deflated;
    const crc = e.data ? crc32(raw) : 0;
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4); // version needed: 2.0
    head.writeUInt16LE(0x0800, 6); // UTF-8 names
    head.writeUInt16LE(stored ? 0 : 8, 8);
    head.writeUInt16LE(0, 10); // time
    head.writeUInt16LE(date, 12);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(body.length, 18);
    head.writeUInt32LE(raw.length, 22);
    head.writeUInt16LE(name.length, 26);
    head.writeUInt16LE(0, 28);
    local.push(head, name, body);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE((3 << 8) | 20, 4); // made by: Unix, 2.0
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(stored ? 0 : 8, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(date, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(raw.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt16LE(0, 30); // extra
    cen.writeUInt16LE(0, 32); // comment
    cen.writeUInt16LE(0, 34); // disk
    cen.writeUInt16LE(0, 36); // internal attributes
    const mode = e.data ? 0o100644 : 0o040755;
    cen.writeUInt32LE(((mode << 16) | (e.data ? 0 : 0x10)) >>> 0, 38);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, name);
    offset += head.length + name.length + body.length;
  }
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}
