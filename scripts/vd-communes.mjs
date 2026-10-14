#!/usr/bin/env node
// Turns the Vaud tables of communal tax rates (arrêtés d'imposition) into
// packages/rules-vd/src/<year>/communes.ts: for each commune its name, its rate on the income and
// wealth tax in percent of the cantonal base tax (impôt cantonal de base), split into the main rate
// and the special earmarked tax (impôt spécial affecté), and its fixed personal tax (impôt
// personnel fixe) when it levies one. Rates are stored in hundredths of a percent (78.5 -> 7850).
//
// Input: docs/sources/vd/files/vd-<year>-communal-arretes-imposition.xls (Excel 97, sheet
// arreteImposition, one row per commune grouped by district), downloaded by
// scripts/fetch-sources.mjs. Its sha256 must match docs/sources/lock.json. The columns are read from
// the sheet's own header (rows 1 to 4): 0 the commune, 3 "Impôt revenu, fortune, bénéf., capital,
// spécial étrangers" (1), 4 "Impôt spécial affecté" (2), 5 "Pour-cent total" (1+2), 8 "Impôt
// personnel fixe" (Fr.). The communal tax is levied in percent of the cantonal base tax, and a
// commune may add special earmarked taxes in percent of the same base (LICom art. 6, al. 1 and 3,
// vd-na-law-licom p. 4 and 5); the maxima of art. 8 count both (p. 5). The script checks that the
// total column is the sum of the two others on every row. Rows named "(fraction)" are fractions of
// the commune above them (LICom art. 1, p. 1: communes and fractions of communes levy the taxes).
//
// The .xls format (BIFF8 in an OLE2 compound file) is read by the small reader below: the sheet's
// strings, numbers and cached formula results, nothing else. No dependency.
//
// Usage:
//   node scripts/vd-communes.mjs              every year in YEARS
//   node scripts/vd-communes.mjs --check      fail if the data differs from the files
//
// Dev tool. It never runs inside the extension, and the extension never reads these files.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';

const YEARS = [2025, 2026];
const XLS = (year) => `vd-${year}-communal-arretes-imposition`;
const SHEET = 'arreteImposition';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const filesDir = path.join(root, 'docs', 'sources', 'vd', 'files');

async function verified(id, ext, lock) {
  const file = path.join(filesDir, `${id}.${ext}`);
  const buf = await readFile(file).catch(() => {
    throw new Error(`${id}: run node scripts/fetch-sources.mjs --canton vd first.`);
  });
  const sha256 = createHash('sha256').update(buf).digest('hex');
  if (lock[id]?.status !== 'ok' || lock[id].sha256 !== sha256) {
    throw new Error(
      `${id}: the file differs from docs/sources/lock.json. Re-fetch, then re-check.`,
    );
  }
  return buf;
}

// ---- OLE2 compound file: one stream by name ------------------------------------------------------

const END = 0xfffffffa; // sector numbers at or above this end a chain

/** The bytes of the named stream of an OLE2 compound file (the container of a .xls file). */
function cfbStream(buf, names) {
  if (buf.readUInt32LE(0) !== 0xe011cfd0 || buf.readUInt32LE(4) !== 0xe11ab1a1) {
    throw new Error('Not an OLE2 compound file.');
  }
  const sectorSize = 1 << buf.readUInt16LE(0x1e);
  const miniSize = 1 << buf.readUInt16LE(0x20);
  const fatCount = buf.readUInt32LE(0x2c);
  const miniCutoff = buf.readUInt32LE(0x38);
  const sector = (n) => {
    const start = 512 + n * sectorSize;
    if (start + sectorSize > buf.length) throw new Error(`Sector ${n} is outside the file.`);
    return buf.subarray(start, start + sectorSize);
  };
  // The FAT's own sectors: 109 in the header, the rest in the DIFAT chain.
  const fatSectors = [];
  for (let i = 0; i < 109 && fatSectors.length < fatCount; i++) {
    fatSectors.push(buf.readUInt32LE(0x4c + 4 * i));
  }
  for (let d = buf.readUInt32LE(0x44); fatSectors.length < fatCount && d < END;) {
    const s = sector(d);
    for (let i = 0; i < sectorSize / 4 - 1 && fatSectors.length < fatCount; i++) {
      fatSectors.push(s.readUInt32LE(4 * i));
    }
    d = s.readUInt32LE(sectorSize - 4);
  }
  const fat = fatSectors.flatMap((n) => {
    const s = sector(n);
    return Array.from({ length: sectorSize / 4 }, (_, i) => s.readUInt32LE(4 * i));
  });
  const chain = (start, table) => {
    const out = [];
    for (let n = start; n < END; n = table[n]) {
      if (out.length > table.length) throw new Error('A sector chain loops.');
      out.push(n);
    }
    return out;
  };
  const read = (start) => Buffer.concat(chain(start, fat).map(sector));
  const dir = read(buf.readUInt32LE(0x30));
  const entries = [];
  for (let p = 0; p + 128 <= dir.length; p += 128) {
    const length = dir.readUInt16LE(p + 64);
    entries.push({
      name: dir.toString('utf16le', p, p + Math.max(0, length - 2)),
      type: dir[p + 66],
      start: dir.readUInt32LE(p + 116),
      size: dir.readUInt32LE(p + 120),
    });
  }
  const entry = entries.find((e) => e.type === 2 && names.includes(e.name));
  if (!entry) throw new Error(`No stream named ${names.join(' or ')}.`);
  if (entry.size >= miniCutoff) return read(entry.start).subarray(0, entry.size);
  // A small stream lives in the mini stream, chained by the mini FAT.
  const rootEntry = entries.find((e) => e.type === 5);
  const miniStream = read(rootEntry.start);
  const mf = read(buf.readUInt32LE(0x3c));
  const miniFat = Array.from({ length: mf.length / 4 }, (_, i) => mf.readUInt32LE(4 * i));
  const parts = chain(entry.start, miniFat).map((n) =>
    miniStream.subarray(n * miniSize, (n + 1) * miniSize),
  );
  return Buffer.concat(parts).subarray(0, entry.size);
}

// ---- BIFF8: the cells of one sheet ---------------------------------------------------------------

const REC = {
  BOF: 0x0809,
  EOF: 0x000a,
  BOUNDSHEET: 0x0085,
  SST: 0x00fc,
  CONTINUE: 0x003c,
  LABELSST: 0x00fd,
  LABEL: 0x0204,
  NUMBER: 0x0203,
  RK: 0x027e,
  MULRK: 0x00bd,
  FORMULA: 0x0006,
  STRING: 0x0207,
};

/** An RK number: a 30-bit integer or the high 30 bits of a double, possibly divided by 100. */
function rk(v) {
  let n;
  if (v & 2) n = v >> 2;
  else {
    const b = Buffer.alloc(8);
    b.writeUInt32LE(v & 0xfffffffc, 4);
    n = b.readDoubleLE(0);
  }
  return v & 1 ? n / 100 : n;
}

/** An XLUnicodeString at `p` (two-byte length) or a short one (one-byte length). */
function unicodeString(data, p, lengthBytes) {
  const cch = lengthBytes === 2 ? data.readUInt16LE(p) : data[p];
  const flags = data[p + lengthBytes];
  const start = p + lengthBytes + 1;
  return flags & 1
    ? data.toString('utf16le', start, start + 2 * cch)
    : data.toString('latin1', start, start + cch);
}

/** The shared strings table, read across its CONTINUE records. */
function sharedStrings(chunks) {
  const strings = [];
  let c = 0;
  let p = 8;
  const total = chunks[0].readUInt32LE(4);
  const next = () => {
    c++;
    p = 0;
    if (!chunks[c]) throw new Error('The shared strings table ends early.');
  };
  for (let s = 0; s < total; s++) {
    if (p >= chunks[c].length) next();
    const cch = chunks[c].readUInt16LE(p);
    let flags = chunks[c][p + 2];
    p += 3;
    let runs = 0;
    let ext = 0;
    if (flags & 8) {
      runs = chunks[c].readUInt16LE(p);
      p += 2;
    }
    if (flags & 4) {
      ext = chunks[c].readUInt32LE(p);
      p += 4;
    }
    let text = '';
    for (let left = cch; left > 0;) {
      if (p >= chunks[c].length) {
        // A string split across records starts again with its own width flag.
        next();
        flags = chunks[c][0];
        p = 1;
      }
      const wide = flags & 1;
      const take = Math.min(left, Math.floor((chunks[c].length - p) / (wide ? 2 : 1)));
      text += wide
        ? chunks[c].toString('utf16le', p, p + 2 * take)
        : chunks[c].toString('latin1', p, p + take);
      p += take * (wide ? 2 : 1);
      left -= take;
    }
    for (let skip = runs * 4 + ext; skip > 0;) {
      if (p >= chunks[c].length) next();
      const take = Math.min(skip, chunks[c].length - p);
      p += take;
      skip -= take;
    }
    strings.push(text);
  }
  return strings;
}

/** The cells of a sheet: Map(row -> Map(column -> string | number)). */
function sheetCells(wb, sheetName) {
  const records = [];
  for (let p = 0; p + 4 <= wb.length;) {
    const length = wb.readUInt16LE(p + 2);
    records.push({ type: wb.readUInt16LE(p), data: wb.subarray(p + 4, p + 4 + length), at: p });
    p += 4 + length;
  }
  const iSst = records.findIndex((r) => r.type === REC.SST);
  const sst = [];
  if (iSst >= 0) {
    const chunks = [records[iSst].data];
    for (let i = iSst + 1; records[i]?.type === REC.CONTINUE; i++) chunks.push(records[i].data);
    sst.push(...sharedStrings(chunks));
  }
  const sheet = records
    .filter((r) => r.type === REC.BOUNDSHEET)
    .map((r) => ({ at: r.data.readUInt32LE(0), name: unicodeString(r.data, 6, 1) }))
    .find((s) => s.name === sheetName);
  if (!sheet) throw new Error(`No sheet ${sheetName}.`);
  const start = records.findIndex((r) => r.at === sheet.at && r.type === REC.BOF);
  if (start < 0) throw new Error(`Sheet ${sheetName}: no BOF record at its offset.`);
  const cells = new Map();
  const set = (row, col, value) => {
    if (!cells.has(row)) cells.set(row, new Map());
    cells.get(row).set(col, value);
  };
  const CELLS = new Set([REC.LABELSST, REC.LABEL, REC.NUMBER, REC.RK, REC.MULRK, REC.FORMULA]);
  let pendingString;
  for (let i = start + 1; i < records.length && records[i].type !== REC.EOF; i++) {
    const { type, data } = records[i];
    if (type === REC.STRING && pendingString) {
      set(pendingString.row, pendingString.col, unicodeString(data, 0, 2));
      pendingString = undefined;
      continue;
    }
    if (!CELLS.has(type)) continue;
    const row = data.readUInt16LE(0);
    const col = data.readUInt16LE(2);
    if (type === REC.LABELSST) set(row, col, sst[data.readUInt32LE(6)]);
    else if (type === REC.LABEL) set(row, col, unicodeString(data, 6, 2));
    else if (type === REC.NUMBER) set(row, col, data.readDoubleLE(6));
    else if (type === REC.RK) set(row, col, rk(data.readUInt32LE(6)));
    else if (type === REC.MULRK) {
      const n = (data.length - 6) / 6;
      for (let k = 0; k < n; k++) set(row, col + k, rk(data.readUInt32LE(6 + 6 * k)));
    } else if (type === REC.FORMULA) {
      // The cached result: a double, or a marker (0xFFFF in bytes 12-13) whose kind is in byte 6.
      if (data.readUInt16LE(12) !== 0xffff) set(row, col, data.readDoubleLE(6));
      else if (data[6] === 0) pendingString = { row, col };
      else throw new Error(`Row ${row + 1}, column ${col + 1}: a formula without a number.`);
    }
  }
  return cells;
}

// ---- The table ---------------------------------------------------------------------------------

const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v);

const HEADER = {
  3: 'Impôt revenu, fortune, bénéf., capital, spécial étrangers',
  4: 'Impôt spécial affecté',
  5: 'Pour-cent total',
  8: 'Impôt personnel fixe',
};
const UNITS = { 3: 1, 4: 2, 5: '1+2', 8: 'Fr.' };

/** A percent of the cantonal base tax (78.5, 74.9) in hundredths of a percent, exactly. */
function hundredths(value, where) {
  if (value === '-') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  const scaled = Math.round(n * 100);
  if (!Number.isFinite(n) || n < 0 || n > 200 || Math.abs(n * 100 - scaled) > 1e-6) {
    throw new Error(`${where}: not a rate: ${JSON.stringify(value)}`);
  }
  return scaled;
}

function communesFor(cells, year) {
  const id = XLS(year);
  if (cells.get(0)?.get(0) !== year) throw new Error(`${id}: the sheet is not for ${year}.`);
  if (clean(cells.get(0)?.get(3)) !== 'En % imp. cant. base') {
    throw new Error(`${id}: expected "En % imp. cant. base" above the rate columns.`);
  }
  for (const [col, text] of Object.entries(HEADER)) {
    if (clean(cells.get(2)?.get(Number(col))) !== text) {
      throw new Error(`${id}: expected "${text}" in column ${col}, row 3; the layout changed.`);
    }
    if (clean(cells.get(3)?.get(Number(col))) !== UNITS[col]) {
      throw new Error(`${id}: expected "${UNITS[col]}" in column ${col}, row 4.`);
    }
  }
  const communes = [];
  const rows = [...cells.keys()].filter((r) => r > 3).sort((a, b) => a - b);
  for (const r of rows) {
    const row = cells.get(r);
    const label = clean(row.get(0));
    if (typeof label !== 'string' || !label) continue;
    if (/^DISTRICT\b/.test(label) || label.startsWith('*')) continue;
    const where = `${id} row ${r + 1} (${label})`;
    const main = hundredths(row.get(3), `${where} column 3`);
    const special = hundredths(row.get(4) ?? '-', `${where} column 4`);
    const total = hundredths(row.get(5), `${where} column 5`);
    if (main + special !== total)
      throw new Error(`${where}: ${main} + ${special} is not ${total}.`);
    const name = label.replace(/\*+$/, '').trim();
    const fraction = /^(.*) \(fraction\)$/.exec(name);
    if (fraction) {
      // A fraction of the commune above it: its own rate, on top of the commune's.
      const commune = communes.at(-1);
      if (!commune) throw new Error(`${where}: a fraction before any commune.`);
      (commune.fractions ??= []).push({ name: fraction[1], rate: total });
      continue;
    }
    const personal = row.get(8);
    if (personal !== undefined && personal !== '-' && typeof personal !== 'number') {
      throw new Error(`${where}: personal tax ${JSON.stringify(personal)}.`);
    }
    communes.push({
      name,
      rate: total,
      main,
      special,
      personalTax: typeof personal === 'number' && personal > 0 ? Math.round(personal * 100) : null,
    });
  }
  if (communes.length < 250) throw new Error(`${id}: only ${communes.length} communes read.`);
  const fold = (s) =>
    s
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  if (new Set(communes.map((c) => fold(c.name))).size !== communes.length) {
    throw new Error(`${id}: two communes with the same name.`);
  }
  return communes;
}

function source(year, communes) {
  const id = XLS(year);
  return (
    `// Vaud's communes for tax year ${year}: the communal rate on the income and wealth tax in\n` +
    `// hundredths of a percent of the cantonal base tax (78.5 % -> 7850), the main rate plus the\n` +
    `// special earmarked tax (impôt spécial affecté), the fixed personal tax in centimes, and the\n` +
    `// fractions of communes with their own rate on top of the commune's.\n` +
    `// Generated by scripts/vd-communes.mjs from ${id}\n` +
    `// (sheet ${SHEET}); do not edit, re-run the script.\n` +
    `import type { Cited } from '@taxpresso/rules-ch';\n` +
    `import type { VdCommune } from '../communes.js';\n\n` +
    `export const COMMUNES_${year}: Cited<readonly VdCommune[]> = {\n` +
    `  source: '${id} sheet ${SHEET} (columns 3 to 5: impôt revenu, fortune; impôt spécial affecté; pour-cent total; column 8: impôt personnel fixe); vd-na-law-licom art. 6 al. 1 (p. 4), al. 3 (p. 5)',\n` +
    `  value: ${JSON.stringify(communes)},\n};\n`
  );
}

const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));
let differs = false;
for (const year of YEARS) {
  const xls = await verified(XLS(year), 'xls', lock);
  const communes = communesFor(sheetCells(cfbStream(xls, ['Workbook', 'Book']), SHEET), year);
  const out = path.join(root, 'packages', 'rules-vd', 'src', String(year), 'communes.ts');
  const ts = await prettier.format(source(year, communes), {
    ...(await prettier.resolveConfig(out)),
    parser: 'typescript',
  });
  const fractions = communes.reduce((s, c) => s + (c.fractions?.length ?? 0), 0);
  if (check) {
    const current = await readFile(out, 'utf8').catch(() => '');
    if (current !== ts) {
      differs = true;
      console.error(`${path.relative(root, out)} differs from ${XLS(year)}.`);
    } else {
      console.log(
        `${path.relative(root, out)}: same as ${XLS(year)} (${communes.length} communes).`,
      );
    }
  } else {
    await writeFile(out, ts);
    console.log(
      `${path.relative(root, out)}: ${communes.length} communes, ${fractions} fractions of communes.`,
    );
  }
}
if (differs) process.exit(1);
