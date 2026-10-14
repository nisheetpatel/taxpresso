#!/usr/bin/env node
// Turns Lucerne's table of tax units (Steuereinheiten <year>, Staat / Einwohner- und Kirchgemeinde,
// natural persons) into packages/rules-lu/src/<year>/communes.ts: the state's units (Staatssteuer),
// the Christ Catholic church's units (one parish for the whole canton: the heading of the fourth
// total column, "0.31 chr. kath. Kirche"), and for each commune its name, the units of the
// Einwohnergemeinde and of its Roman Catholic and Evangelical Reformed parishes (Kirchgemeinden),
// with the parish's name where the table prints one. Units are stored in ten-thousandths
// (1.55 -> 15500, 0.2565 -> 2565).
//
// How the tax is computed (lu-2025-law-steuergesetz § 2 Abs. 1 and 2, § 236 Abs. 2, § 240 Abs. 1):
// the tariffs give the tax per unit (Steuer je Einheit); the state, the commune and the parish of
// a member of a recognised church each levy so many units of it.
//
// Input: docs/sources/lu/files/lu-<year>-communal-steuereinheiten.pdf, downloaded by
// scripts/fetch-sources.mjs; its sha256 must match docs/sources/lock.json. Two pages, one row per
// commune: name, Einwohnergemeinde, römisch-katholische Kirchgemeinde (units, and the parish's name
// when it is not the commune's), evangelisch-reformierte Kirchgemeinde (units and name), then four
// totals "inkl. Staats-, Gemeinde- und" röm. kath. Kirche, evang. Ref. Kirche, chr. kath. Kirche,
// ohne Kirche. The first row (Adligenswil) prints its totals on the line above and the sums
// "(1.55 + 1.95 + 0.22)" on the line below. Cross-check: every row's four totals must equal the
// state's units plus the commune's plus each church's (none for the last), exactly; the formula
// line must name the same units. The text is read with unpdf (packages/intake's dependency).
//
// Usage:
//   node scripts/lu-communes.mjs              every year in YEARS
//   node scripts/lu-communes.mjs --check      fail if the data differs from the files
//
// Dev tool. It never runs inside the extension, and the extension never reads these files.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as prettier from 'prettier';

const YEARS = [2025, 2026];
const PDF = (year) => `lu-${year}-communal-steuereinheiten`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const filesDir = path.join(root, 'docs', 'sources', 'lu', 'files');

async function verified(id, ext, lock) {
  const file = path.join(filesDir, `${id}.${ext}`);
  const buf = await readFile(file).catch(() => {
    throw new Error(`${id}: run node scripts/fetch-sources.mjs --canton lu first.`);
  });
  const sha256 = createHash('sha256').update(buf).digest('hex');
  if (lock[id]?.status !== 'ok' || lock[id].sha256 !== sha256) {
    throw new Error(
      `${id}: the file differs from docs/sources/lock.json. Re-fetch, then re-check.`,
    );
  }
  return buf;
}

/** Each page's lines of text cells, top to bottom, each cell with its x position. */
async function pdfLines(pdfjs, buf) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    const rows = [];
    for (const it of content.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) <= 2);
      if (!row) rows.push((row = { y, cells: [] }));
      row.cells.push({ x: it.transform[4], text: it.str.trim() });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) r.cells.sort((a, b) => a.x - b.x);
    pages.push(rows);
  }
  return pages;
}

const UNITS = /^\d\.\d{2,4}$/;
/** "1.55" -> 15500, "0.2565" -> 2565: units in ten-thousandths, exactly. */
function tenThousandths(s, where) {
  if (!UNITS.test(s)) throw new Error(`${where}: "${s}" is not a number of units.`);
  const [whole, decimals] = s.split('.');
  return Number(whole) * 10_000 + Number(decimals.padEnd(4, '0'));
}

// The columns, by the x position of their cells (PDF points; the same on both pages and years).
const COLUMNS = [
  ['name', 0, 100],
  ['commune', 120, 165],
  ['catholic', 165, 195],
  ['catholicParish', 195, 250],
  ['reformed', 250, 272],
  ['reformedParish', 272, 340],
  ['totalCatholic', 340, 395],
  ['totalReformed', 395, 450],
  ['totalChristCatholic', 450, 505],
  ['totalNone', 505, 600],
];
const column = (x) => COLUMNS.find(([, from, to]) => x >= from && x < to)?.[0];

function cellsByColumn(row, where) {
  const out = {};
  for (const c of row.cells) {
    const k = column(c.x);
    if (!k) throw new Error(`${where}: a cell outside the columns at x ${c.x}: "${c.text}".`);
    if (out[k] !== undefined) throw new Error(`${where}: two cells in column ${k}.`);
    out[k] = c.text;
  }
  return out;
}

const TOTALS = ['totalCatholic', 'totalReformed', 'totalChristCatholic', 'totalNone'];

function readTable(pages, id) {
  let state = null;
  let christCatholic = null;
  const communes = [];
  for (const [n, rows] of pages.entries()) {
    const where = (y) => `${id} p. ${n + 1} (y ${Math.round(y)})`;
    for (const [i, row] of rows.entries()) {
      const text = row.cells.map((c) => c.text).join(' ');
      const st = /^Staatssteuer: (\d\.\d{2}) Einheiten\b/.exec(text);
      if (st) {
        if (state !== null) throw new Error(`${where(row.y)}: the state's units twice.`);
        state = tenThousandths(st[1], where(row.y));
        continue;
      }
      const ck = /(\d\.\d{2}) chr\. kath\. Kirche/.exec(text);
      if (ck) {
        const units = tenThousandths(ck[1], where(row.y));
        if (christCatholic !== null && christCatholic !== units)
          throw new Error(`${where(row.y)}: the Christ Catholic units differ between pages.`);
        christCatholic = units;
        continue;
      }
      const first = row.cells[0];
      if (!first || first.x > 100 || /^(Gemeinde|Dienststelle|Steuereinheiten)/.test(first.text))
        continue;
      if (/^Ausdruck:/.test(first.text)) continue;
      const c = cellsByColumn(row, where(row.y));
      if (c.commune === undefined) continue;
      // Totals printed on the line above (the first row of page 1).
      if (TOTALS.some((k) => c[k] === undefined)) {
        const above = rows[i - 1];
        const a = above && cellsByColumn(above, where(above.y));
        if (!a || Object.keys(a).length !== 4 || !TOTALS.every((k) => a[k] !== undefined))
          throw new Error(`${where(row.y)}: ${c.name} has no totals.`);
        Object.assign(c, a);
        // And the sums on the line below: "(1.55 + 1.95 + 0.22)".
        const below = rows[i + 1];
        const sums = below?.cells.map((x) => x.text).join(' ');
        const expected = [
          `(${st0(state)} + ${c.commune} + ${c.catholic})`,
          `(${st0(state)} + ${c.commune} + ${c.reformed})`,
          `(${st0(state)} + ${c.commune} + ${st0(christCatholic)})`,
          `(${st0(state)} + ${c.commune})`,
        ].join(' ');
        if (sums !== expected)
          throw new Error(`${where(row.y)}: the sums under ${c.name} read "${sums}".`);
      }
      if (state === null || christCatholic === null)
        throw new Error(`${where(row.y)}: a commune before the state's and church's units.`);
      if (!c.reformedParish) throw new Error(`${where(row.y)}: ${c.name} without its parish.`);
      const w = `${where(row.y)} ${c.name}`;
      const commune = {
        name: c.name,
        units: tenThousandths(c.commune, w),
        catholic: { units: tenThousandths(c.catholic, w), parish: c.catholicParish ?? null },
        reformed: { units: tenThousandths(c.reformed, w), parish: c.reformedParish },
      };
      const base = state + commune.units;
      const want = {
        totalCatholic: base + commune.catholic.units,
        totalReformed: base + commune.reformed.units,
        totalChristCatholic: base + christCatholic,
        totalNone: base,
      };
      for (const k of TOTALS) {
        if (tenThousandths(c[k], w) !== want[k])
          throw new Error(`${w}: ${k} ${c[k]} is not the sum of its units (${want[k] / 10_000}).`);
      }
      communes.push(commune);
    }
  }
  if (state === null) throw new Error(`${id}: the state's units are not stated.`);
  if (christCatholic === null) throw new Error(`${id}: the Christ Catholic units are not stated.`);
  const names = new Set(communes.map((c) => c.name));
  if (names.size !== communes.length) throw new Error(`${id}: a commune is listed twice.`);
  if (communes.length < 75) throw new Error(`${id}: only ${communes.length} communes read.`);
  return { state, christCatholic, communes };
}

/** The state's units as the formula line prints them: 15500 -> "1.55". */
function st0(units) {
  return (units / 10_000).toFixed(2);
}

function source(year, id, { state, christCatholic, communes }) {
  const cite = (what) => `${id} p. 1 and 2 (${what})`;
  return (
    `// Lucerne's tax units for natural persons, tax year ${year}: the state's (Staatssteuer), the\n` +
    `// Christ Catholic church's (one parish for the whole canton), and for each commune those of the\n` +
    `// Einwohnergemeinde and of its Roman Catholic and Evangelical Reformed parishes\n` +
    `// (Kirchgemeinden), in ten-thousandths of a unit (1.55 -> 15500). Every row's totals were\n` +
    `// checked against the sum of its units.\n` +
    `// Generated by scripts/lu-communes.mjs from ${id}; do not edit, re-run the script.\n` +
    `import type { Cited } from '@taxpresso/rules-ch';\n` +
    `import type { LuCommune } from '../communes.js';\n\n` +
    `export const STATE_UNITS_${year}: Cited<number> = {\n` +
    `  source: ${JSON.stringify(`${id} p. 1 (Staatssteuer: ${st0(state)} Einheiten)`)},\n` +
    `  value: ${state},\n};\n\n` +
    `export const CHRIST_CATHOLIC_UNITS_${year}: Cited<number> = {\n` +
    `  source: ${JSON.stringify(`${id} p. 1 and 2 (heading of the fourth total: ${st0(christCatholic)} chr. kath. Kirche)`)},\n` +
    `  value: ${christCatholic},\n};\n\n` +
    `export const COMMUNES_${year}: Cited<readonly LuCommune[]> = {\n` +
    `  source: ${JSON.stringify(cite('columns Einwohnergemeinde, römisch-katholische and evangelisch-reformierte Kirchgemeinde, Total Einheiten'))},\n` +
    `  value: ${JSON.stringify(communes)},\n};\n`
  );
}

const require = createRequire(path.join(root, 'packages', 'intake', 'package.json'));
const { getResolvedPDFJS } = await import(pathToFileURL(require.resolve('unpdf')).href);
const pdfjs = await getResolvedPDFJS();
const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));
let differs = false;
for (const year of YEARS) {
  const id = PDF(year);
  const data = readTable(await pdfLines(pdfjs, await verified(id, 'pdf', lock)), id);
  const out = path.join(root, 'packages', 'rules-lu', 'src', String(year), 'communes.ts');
  const ts = await prettier.format(source(year, id, data), {
    ...(await prettier.resolveConfig(out)),
    parser: 'typescript',
  });
  if (check) {
    const current = await readFile(out, 'utf8').catch(() => '');
    if (current !== ts) {
      differs = true;
      console.error(`${path.relative(root, out)} differs from the official table.`);
    } else {
      console.log(
        `${path.relative(root, out)}: same as the official table (${data.communes.length} communes).`,
      );
    }
  } else {
    await writeFile(out, ts);
    console.log(
      `${path.relative(root, out)}: state ${st0(data.state)} units, ${data.communes.length} communes.`,
    );
  }
}
if (differs) process.exit(1);
