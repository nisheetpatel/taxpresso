#!/usr/bin/env node
// Checks Basel-Landschaft's income tariff in packages/rules-bl/src/<year>/tariffs.ts against the
// canton's tariff workbook of the year (Tabelle <year> Einheitstarif): docs/sources/bl/files/
// bl-<year>-tariff-tariftabelle.xls, an Excel 97 workbook with two sheets.
//
// - Sheet "Tarif": the parameters of the year. The script checks the year in its title, the index of
//   the year and of 2005, the Eckwerte of 2005 (StG § 34 Abs. 1: 15,000, 40,000, 100,000, 1,150,000)
//   and of the year, each the 2005 one times the index ratio rounded to the franc (Anwendungsregeln,
//   Ziffer 1 to 3), the minimum and maximum rates, the parameters b, c and D of the three segments
//   and the splitting factor (beta 0.5); each must equal INCOME_<year>.
// - Sheet "Tabelle <year> Einheitstarif": the table of tax amounts (the rows the tariff sheet
//   bl-<year>-tariff-staatssteuer prints), for a single person and with Vollsplitting. Every row and
//   both columns must equal what packages/rules-bl/src/tariff.ts computes with INCOME_<year>.
//
// The workbook's sha256 must match docs/sources/lock.json. The .xls format (BIFF8 in an OLE2
// compound file) is read by the small reader below (the same as scripts/vd-communes.mjs): strings,
// numbers and cached formula results. Both TypeScript modules are read with Node's type stripping
// (they import types only).
//
// Usage:
//   node scripts/bl-tariff.mjs --check
//
// Dev tool. It never runs inside the extension, and the extension never reads these files.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const YEARS = [2025, 2026];
const XLS = (year) => `bl-${year}-tariff-tariftabelle`;
const ECKWERTE_2005 = [15_000, 40_000, 100_000, 1_150_000];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filesDir = path.join(root, 'docs', 'sources', 'bl', 'files');
if (!process.argv.includes('--check')) {
  console.error('Usage: node scripts/bl-tariff.mjs --check (the tariff is written by hand).');
  process.exit(2);
}

async function verified(id, ext, lock) {
  const file = path.join(filesDir, `${id}.${ext}`);
  const buf = await readFile(file).catch(() => {
    throw new Error(`${id}: run node scripts/fetch-sources.mjs --canton bl first.`);
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

// ---- The checks ---------------------------------------------------------------------------------

const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v);

/** The row of a sheet whose first cell is `label`, as a map of columns. */
function rowOf(cells, label, id) {
  for (const row of cells.values()) if (clean(row.get(0)) === label) return row;
  throw new Error(`${id}: no row "${label}".`);
}

/** A workbook number in millionths, exactly (the workbook prints six decimals). */
function millionths(v, where) {
  const n = Math.round(v * 1_000_000);
  if (typeof v !== 'number' || Math.abs(v * 1_000_000 - n) > 1e-6) {
    throw new Error(`${where}: not a number with six decimals: ${JSON.stringify(v)}.`);
  }
  return n;
}

function parameterProblems(cells, year, f, id) {
  const problems = [];
  const expect = (what, got, want) => {
    if (got !== want) problems.push(`${what}: workbook ${got}, INCOME_${year} ${want}`);
  };
  if (clean(cells.get(0)?.get(0)) !== `Parameter für das Steuerjahr ${year}`) {
    throw new Error(`${id}: sheet Tarif is not for ${year}.`);
  }
  const index2005 = rowOf(cells, 'Indexstand per STJ 2005', id).get(1);
  const index = rowOf(cells, `Indexstand per STJ ${year}`, id).get(1);
  const start2005 = rowOf(cells, 'Startpunkt Indexstand 2005', id);
  const start = rowOf(cells, `Startpunkt Tarif ${year}`, id);
  const names = ['min', 'medium1', 'medium2', 'max'];
  ECKWERTE_2005.forEach((e, i) => {
    expect(`Eckwert 2005 ${names[i]}`, start2005.get(i + 1), e);
    // Anwendungsregeln Ziffer 2 and 3: the 2005 value at the new index, to the nearest franc.
    expect(
      `Eckwert ${names[i]} from the index`,
      Math.round((e * index) / index2005),
      start.get(i + 1),
    );
    expect(`Eckwert ${names[i]}`, start.get(i + 1), f[names[i]]);
  });
  const rate = (label) => millionths(rowOf(cells, label, id).get(1), `${id} ${label}`);
  expect('minimum rate', rate('Minimaler Steuersatz'), f.minRate);
  expect('maximum rate', rate('Grenzsteuersatz maximal'), f.maxRate);
  expect('beta', rowOf(cells, 'beta', id).get(1), 0.5);
  const rows = {
    b: rowOf(cells, 'b_min, b_med_1, b_med_2', id),
    c: rowOf(cells, 'c_min, c_med_1, c_med_2', id),
    d: rowOf(cells, 'D_min, D_med_1, D_med_2', id),
  };
  for (const [k, row] of Object.entries(rows)) {
    f.segments.forEach((s, i) =>
      expect(`${k} of segment ${i + 1}`, millionths(row.get(i + 1), `${id} ${k}`), s[k]),
    );
  }
  return problems;
}

function tableProblems(cells, f, tariff, id) {
  const problems = [];
  const header = cells.get(2);
  if (
    clean(header?.get(0)) !== 'Steuerbares Einkommen in Franken' ||
    clean(header?.get(1)) !== 'Steuerbetrag in Franken (Einzelperson)' ||
    clean(header?.get(2)) !== 'Steuerbetrag in Franken (Vollsplitting)'
  ) {
    throw new Error(`${id}: the table's header changed.`);
  }
  let n = 0;
  for (const [r, row] of cells) {
    if (r < 3) continue;
    for (const [ci, si, vi] of [
      [0, 1, 2],
      [4, 5, 6],
    ]) {
      const income = row.get(ci);
      if (typeof income !== 'number') continue;
      for (const [col, splitting] of [
        [si, false],
        [vi, true],
      ]) {
        const printed = Math.round(row.get(col) * 100);
        const computed = tariff.incomeTariffTax(f, income * 100, splitting).tax;
        n++;
        if (printed !== computed) {
          problems.push(
            `row ${r + 1}, CHF ${income} ${splitting ? 'Vollsplitting' : 'Einzelperson'}: table ${printed}, computed ${computed}`,
          );
        }
      }
    }
  }
  if (n < 180) problems.push(`only ${n} values read`);
  return { problems, n };
}

const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));
const src = path.join(root, 'packages', 'rules-bl', 'src');
const tariff = await import(pathToFileURL(path.join(src, 'tariff.ts')).href);
let failed = false;
for (const year of YEARS) {
  const id = XLS(year);
  const module = await import(pathToFileURL(path.join(src, String(year), 'tariffs.ts')).href);
  const f = module[`INCOME_${year}`].value;
  const wb = cfbStream(await verified(id, 'xls', lock), ['Workbook', 'Book']);
  const problems = parameterProblems(sheetCells(wb, 'Tarif'), year, f, id);
  const table = tableProblems(sheetCells(wb, `Tabelle ${year} Einheitstarif`), f, tariff, id);
  problems.push(...table.problems);
  if (problems.length) {
    failed = true;
    console.error(`${id} differs from INCOME_${year}:\n  ${problems.join('\n  ')}`);
  } else {
    console.log(
      `${id}: the parameters equal INCOME_${year}, and all ${table.n} tax amounts of its table (both columns) equal the formula's.`,
    );
  }
}
if (failed) process.exit(1);
