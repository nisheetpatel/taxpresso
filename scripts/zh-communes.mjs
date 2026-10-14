#!/usr/bin/env node
// Turns the Zurich statistics office's table of communal multipliers into
// packages/rules-zh/src/<year>/communes.ts: for each commune its BFS number, its name, its
// multipliers without church tax and its church multipliers, in percent of the einfache
// Staatssteuer, as levied (bezogene Steuerfüsse).
//
// Input: docs/sources/zh/files/zh-na-communal-steuerfuesse-seit-2012.xlsx (one sheet per year,
// STFUSS<year>), downloaded by scripts/fetch-sources.mjs. Its sha256 must match
// docs/sources/lock.json. Columns, read from the sheet's own header (rows 14 to 16): A BFS,
// B Gemeinden, I and J reformierte Kirche 1. and 2., K and L katholische Kirche 1. and 2.,
// M christkatholische Kirche, O to Q Gemeindesteuerfüsse Total ohne Kirchen 1. to 3. A commune
// with several values has parts with different multipliers (school districts or parishes).
// Cross-check: the same office's CSV time series (zh-na-communal-steuerfuesse-zeitreihe) must
// give the same totals, and its totals with church tax must be the total plus the church's.
//
// Usage:
//   node scripts/zh-communes.mjs              every year in YEARS
//   node scripts/zh-communes.mjs --check      fail if the data differs from the files
//
// Dev tool. It never runs inside the extension, and the extension never reads these files.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import * as prettier from 'prettier';

const YEARS = [2025, 2026];
const XLSX = 'zh-na-communal-steuerfuesse-seit-2012';
const CSV = 'zh-na-communal-steuerfuesse-zeitreihe';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const filesDir = path.join(root, 'docs', 'sources', 'zh', 'files');

async function verified(id, ext, lock) {
  const file = path.join(filesDir, `${id}.${ext}`);
  const buf = await readFile(file).catch(() => {
    throw new Error(`${id}: run node scripts/fetch-sources.mjs --canton zh first.`);
  });
  const sha256 = createHash('sha256').update(buf).digest('hex');
  if (lock[id]?.status !== 'ok' || lock[id].sha256 !== sha256) {
    throw new Error(
      `${id}: the file differs from docs/sources/lock.json. Re-fetch, then re-check.`,
    );
  }
  return buf;
}

/** Every entry of a ZIP archive (stored or deflated), by name. */
function unzip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('Not a ZIP file.');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Broken ZIP directory.');
    const method = buf.readUInt16LE(p + 10);
    const compressed = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLength = buf.readUInt16LE(p + 28);
    const offset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLength);
    p += 46 + nameLength + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    if (buf.readUInt32LE(offset) !== 0x04034b50) throw new Error(`Broken ZIP entry ${name}.`);
    const start = offset + 30 + buf.readUInt16LE(offset + 26) + buf.readUInt16LE(offset + 28);
    const raw = buf.subarray(start, start + compressed);
    const data = method === 8 ? inflateRawSync(raw) : method === 0 ? raw : undefined;
    if (!data || data.length !== size) throw new Error(`Unreadable ZIP entry ${name}.`);
    files.set(name, data.toString('utf8'));
  }
  return files;
}

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** One sheet as rows of { column letter: text }, shared strings resolved. */
function sheetRows(files, sheetName) {
  const wb = files.get('xl/workbook.xml');
  const rels = files.get('xl/_rels/workbook.xml.rels');
  const rid = new RegExp(`<sheet name="${sheetName}"[^>]*r:id="(rId\\d+)"`).exec(wb)?.[1];
  if (!rid) throw new Error(`${XLSX}: no sheet ${sheetName}.`);
  const target = [...rels.matchAll(/<Relationship [^>]*>/g)]
    .map((m) => m[0])
    .find((r) => r.includes(`Id="${rid}"`))
    ?.match(/Target="([^"]+)"/)?.[1];
  const sheet = files.get(`xl/${target.replace(/^\/?xl\//, '')}`);
  const strings = [...files.get('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(
    (m) => decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')),
  );
  const rows = new Map();
  for (const row of sheet.matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const c of row[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = /<v>([\s\S]*?)<\/v>/.exec(c[3] ?? '')?.[1];
      if (v === undefined) continue;
      cells[c[1]] = /t="s"/.test(c[2]) ? strings[Number(v)] : decode(v);
    }
    rows.set(Number(row[1]), cells);
  }
  return rows;
}

const HEADER = {
  14: { O: 'Gemeindesteuerfüsse', I: 'reformierte', K: 'katholische', M: 'christ-' },
  15: { O: 'Total ohne Kirchen', I: 'Kirche', K: 'Kirche', M: 'kath.' },
  16: { A: 'BFS', D: '1.', E: '2.', I: '1.', J: '2.', K: '1.', L: '2.', O: '1.', P: '2.', Q: '3.' },
};

function percent(value, where) {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 400)
    throw new Error(`${where}: not a multiplier: ${value}`);
  return n;
}

function communesFor(files, year) {
  const sheet = `STFUSS${year}`;
  const rows = sheetRows(files, sheet);
  if (!rows.get(9)?.A?.includes(`Gemeindesteuerfüsse ${year}`)) {
    throw new Error(`${XLSX} ${sheet}: the title does not name ${year}.`);
  }
  for (const [r, want] of Object.entries(HEADER)) {
    for (const [col, text] of Object.entries(want)) {
      if (rows.get(Number(r))?.[col]?.trim() !== text) {
        throw new Error(`${XLSX} ${sheet}: expected "${text}" in ${col}${r}, the layout changed.`);
      }
    }
  }
  const communes = [];
  for (const [r, cells] of rows) {
    if (r <= 16 || !/^\d+$/.test(cells.A ?? '')) continue;
    const at = (col) => percent(cells[col], `${sheet} ${col}${r}`);
    const list = (...cols) => cols.map(at).filter((v) => v !== undefined);
    const commune = {
      bfs: Number(cells.A),
      name: cells.B.trim(),
      rates: list('O', 'P', 'Q'),
      reformed: list('I', 'J'),
      catholic: list('K', 'L'),
      christCatholic: list('M'),
    };
    if (!commune.rates.length) throw new Error(`${sheet} row ${r}: no multiplier.`);
    communes.push(commune);
  }
  return communes.sort((a, b) => a.bfs - b.bfs);
}

/** The CSV time series must say the same, and its totals with church tax add up. */
function crossCheck(csv, year, communes) {
  const [head, ...lines] = csv.trim().split(/\r?\n/);
  const cols = head.split(',').map((h) => h.replace(/"/g, ''));
  const byBfs = new Map(communes.map((c) => [c.bfs, c]));
  let seen = 0;
  for (const line of lines) {
    const cells = line.split(',');
    const get = (name) => Number(cells[cols.indexOf(name)]);
    if (get('YEAR') !== year) continue;
    seen++;
    const c = byBfs.get(get('BFSNR'));
    if (!c) throw new Error(`${CSV} ${year}: BFS ${get('BFSNR')} missing from the xlsx.`);
    const total = [1, 2, 3].map((i) => get(`STF_O_KIRCHE${i}`)).filter((v) => v > 0);
    const want = c.rates.join(',');
    if (total.join(',') !== want) {
      throw new Error(`${year} ${c.name}: xlsx ${want}, csv ${total.join(',')}.`);
    }
    for (const [col, church] of [
      ['STF_REF', c.reformed],
      ['STF_KATH', c.catholic],
      ['STF_CKRKATH', c.christCatholic],
    ]) {
      const withChurch = get(`${col}1`);
      if (church.length && withChurch !== c.rates[0] + church[0]) {
        throw new Error(
          `${year} ${c.name}: ${col}1 ${withChurch} is not ${c.rates[0]} + ${church[0]}.`,
        );
      }
    }
  }
  if (seen !== communes.length) {
    throw new Error(`${year}: ${communes.length} communes in the xlsx, ${seen} in the CSV.`);
  }
}

function source(year, communes) {
  return (
    `// Zurich's communes for tax year ${year} and their multipliers (Steuerfüsse), in percent of the\n` +
    `// einfache Staatssteuer, as levied. Generated by scripts/zh-communes.mjs from\n` +
    `// ${XLSX} (sheet STFUSS${year}); do not edit, re-run the script.\n` +
    `import type { Cited } from '../cited.js';\n` +
    `import type { CommuneRates } from '../communes.js';\n\n` +
    `export const COMMUNES_${year}: Cited<readonly CommuneRates[]> = {\n` +
    `  source: '${XLSX} sheet STFUSS${year} (columns O to Q, Total ohne Kirchen; I to M, Kirchen)',\n` +
    `  value: ${JSON.stringify(communes)},\n};\n`
  );
}
const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));
const files = unzip(await verified(XLSX, 'xlsx', lock));
const csv = (await verified(CSV, 'csv', lock)).toString('utf8');
let differs = false;
for (const year of YEARS) {
  const communes = communesFor(files, year);
  crossCheck(csv, year, communes);
  const out = path.join(root, 'packages', 'rules-zh', 'src', String(year), 'communes.ts');
  const ts = await prettier.format(source(year, communes), {
    ...(await prettier.resolveConfig(out)),
    parser: 'typescript',
  });
  if (check) {
    const current = await readFile(out, 'utf8').catch(() => '');
    if (current !== ts) {
      differs = true;
      console.error(`${path.relative(root, out)} differs from ${XLSX}.`);
    } else
      console.log(`${path.relative(root, out)}: same as ${XLSX} (${communes.length} communes).`);
  } else {
    await writeFile(out, ts);
    console.log(`${path.relative(root, out)}: ${communes.length} communes.`);
  }
}
if (differs) process.exit(1);
