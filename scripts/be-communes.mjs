#!/usr/bin/env node
// Turns the Bern tax administration's table of communal tax multipliers into
// packages/rules-be/src/<year>/communes.ts: for each commune its BFS number, its name, its
// Steueranlage for natural persons and the church tax rates (Kirchensteuersätze) of each part of the
// commune, all as fractions of the einfache Steuer, stored in ten-thousandths (1.54 -> 15400).
//
// Input: docs/sources/be/files/be-na-communal-steueranlagen-1983-2026.xlsx (sheet "Daten Gde",
// one row per commune and year, or per part of a commune where the church parishes differ),
// downloaded by scripts/fetch-sources.mjs. Its sha256 must match docs/sources/lock.json. Columns,
// read from the sheet's own header (row 8): A STJ, B BFS-Nr., C Gde Name, D Anlage Gde NP,
// H reformiert, I römisch-katholisch, J christ-katholisch, M provisorisch/definitiv.
// Cross-check: the finance administration's printed table of the same year (document 556.6,
// be-<year>-steueranlagen-gemeinden-de, table 2.1) must give, for every commune, the same
// Steueranlage for natural persons and the same church tax rates, part for part. Its text is read
// with unpdf (packages/intake's dependency).
//
// Usage:
//   node scripts/be-communes.mjs              every year in YEARS
//   node scripts/be-communes.mjs --check      fail if the data differs from the files
//
// Dev tool. It never runs inside the extension, and the extension never reads these files.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import * as prettier from 'prettier';

const YEARS = [2025, 2026];
const XLSX = 'be-na-communal-steueranlagen-1983-2026';
const SHEET = 'Daten Gde';
const PDF = (year) => `be-${year}-steueranlagen-gemeinden-de`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const filesDir = path.join(root, 'docs', 'sources', 'be', 'files');

async function verified(id, ext, lock) {
  const file = path.join(filesDir, `${id}.${ext}`);
  const buf = await readFile(file).catch(() => {
    throw new Error(`${id}: run node scripts/fetch-sources.mjs --canton be first.`);
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
  const rid = new RegExp(`<sheet [^>]*name="${sheetName}"[^>]*r:id="(rId\\d+)"`).exec(wb)?.[1];
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
  A: 'STJ',
  B: 'BFS-Nr.',
  C: 'Gde Name',
  D: 'Anlage Gde NP',
  H: 'reformiert',
  I: 'römisch-katholisch',
  J: 'christ-katholisch',
  M: 'provisorisch/ definitiv',
};

/** A fraction of the einfache Steuer (1.54, 0.2415) in ten-thousandths, exactly. */
function tenThousandths(value, where) {
  const n = Number(value);
  const scaled = Math.round(n * 10_000);
  if (!Number.isFinite(n) || n < 0 || n > 5 || Math.abs(n * 10_000 - scaled) > 1e-6) {
    throw new Error(`${where}: not a multiplier: ${value}`);
  }
  return scaled;
}

/** Lower case, letters and digits only, accents folded: "Horrenbach­Buchen" = "Horrenbach-Buchen". */
const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

function communesFor(rows, year) {
  for (const [col, text] of Object.entries(HEADER)) {
    if (rows.get(8)?.[col]?.trim() !== text) {
      throw new Error(`${XLSX} ${SHEET}: expected "${text}" in ${col}8, the layout changed.`);
    }
  }
  const byBfs = new Map();
  for (const [r, cells] of rows) {
    if (r <= 8 || cells.A !== String(year)) continue;
    if (cells.M?.trim() !== 'definitiv') {
      throw new Error(`${XLSX} row ${r}: ${cells.C} is "${cells.M}", not definitive.`);
    }
    const where = `${SHEET} row ${r}`;
    const part = {
      label: cells.C.trim(),
      rate: tenThousandths(cells.D, `${where} D`),
      reformed: tenThousandths(cells.H, `${where} H`),
      catholic: tenThousandths(cells.I, `${where} I`),
      christCatholic: tenThousandths(cells.J, `${where} J`),
    };
    const bfs = Number(cells.B);
    if (!Number.isInteger(bfs) || bfs <= 0) throw new Error(`${where}: no BFS number.`);
    if (!byBfs.has(bfs)) byBfs.set(bfs, []);
    byBfs.get(bfs).push(part);
  }
  if (!byBfs.size) throw new Error(`${XLSX}: no rows for ${year}.`);
  const communes = [];
  for (const [bfs, parts] of byBfs) {
    const rates = new Set(parts.map((p) => p.rate));
    if (rates.size !== 1)
      throw new Error(`${year} BFS ${bfs}: parts with different Steueranlagen.`);
    // One row: its label is the commune's name, as printed ("Evilard (Leubringen)"). Several rows:
    // "Lyss (Busswil BE)" and "Lyss (Lyss)", "Fraubrunnen" and "Fraubrunnen (Etzelkof/Mülchi)",
    // "Reichenbach-1" and "Reichenbach-9": the commune's name, then the part's.
    const base = (label) => label.replace(/ \(.*\)$/, '').replace(/-\d+$/, '');
    const name = parts.length === 1 ? parts[0].label : base(parts[0].label);
    if (parts.length > 1 && parts.some((p) => base(p.label) !== name)) {
      throw new Error(
        `${year} BFS ${bfs}: parts of different communes (${parts.map((p) => p.label)}).`,
      );
    }
    const partName = (label) => /\((.*)\)$/.exec(label)?.[1] ?? label;
    communes.push({
      bfs,
      name,
      rate: parts[0].rate,
      parts: parts.map((p) => ({
        name: parts.length === 1 ? name : partName(p.label),
        reformed: p.reformed,
        catholic: p.catholic,
        christCatholic: p.christCatholic,
      })),
    });
  }
  communes.sort((a, b) => a.bfs - b.bfs);
  if (new Set(communes.map((c) => fold(c.name))).size !== communes.length) {
    throw new Error(`${year}: two communes with the same name.`);
  }
  return communes;
}

/**
 * The parishes of a commune: its parts, those with the same church rates merged (no choice is
 * needed between them), their names joined; a single parish takes the commune's name.
 */
function parishesOf(c) {
  const parishes = [];
  for (const p of c.parts) {
    const same = parishes.find((x) => CHURCHES.every((k) => x[k] === p[k]));
    if (same) same.name = `${same.name}, ${p.name}`;
    else parishes.push({ ...p });
  }
  if (parishes.length === 1) parishes[0].name = c.name;
  return { bfs: c.bfs, name: c.name, rate: c.rate, parishes };
}

/** The text items of a PDF page as lines: { x, text } cells, top to bottom. */
async function pdfLines(pdfjs, buf) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const rows = [];
    for (const it of content.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) <= 2);
      if (!row) rows.push((row = { y, cells: [] }));
      row.cells.push({ x: it.transform[4], text: it.str.trim() });
    }
    rows.sort((a, b) => b.y - a.y);
    pages.push(rows.map((r) => r.cells.sort((a, b) => a.x - b.x)));
  }
  return pages;
}

const RATE = /^\d\.\d{2}$/;
const CHURCH = /^0\.\d{4}$/;

/**
 * Table 2.1 of document 556.6: per commune, its Steueranlage for natural persons and the church
 * rates of its main row and of its parts (indented rows with counts and church rates only).
 */
function printedTable(pages, year) {
  const table = new Map();
  table.pages = [];
  let current;
  for (const [n, lines] of pages.entries()) {
    if (!lines.some((l) => l.some((c) => c.text.startsWith('Tabelle 2.1')))) continue;
    for (const cells of lines) {
      const church = cells.filter((c) => CHURCH.test(c.text)).map((c) => c.text);
      if (church.length !== 4) continue;
      if (table.pages.at(-1) !== n + 1) table.pages.push(n + 1);
      // The name, then the numbers: a main row starts them with its Steueranlagen (natural and
      // legal persons) and the property tax rate, a part's row with its counts of taxpayers.
      const first = cells.findIndex((c) => RATE.test(c.text) || /^[\d ]+$/.test(c.text));
      const name = cells
        .slice(0, first)
        .map((c) => c.text)
        .join(' ');
      const rates = cells.slice(first, first + 3).filter((c) => RATE.test(c.text));
      const triple = church.slice(0, 3).map((v) => tenThousandths(v, `${PDF(year)} ${name}`));
      if (rates.length === 3) {
        current = {
          name: name.replace(/\*+$/, ''),
          rate: tenThousandths(rates[0].text, `${PDF(year)} ${name}`),
          parts: [{ name: name.replace(/\*+$/, ''), triple }],
        };
        table.set(fold(current.name), current);
      } else if (rates.length === 0 && current && name) {
        current.parts.push({ name, triple });
      } else {
        throw new Error(`${PDF(year)} table 2.1: cannot read the row "${name}".`);
      }
    }
  }
  return table;
}

/** The printed table's name of a commune, where it abbreviates the xlsx's (both years). */
const PRINTED_NAME = {
  Aeschi: 'Aeschi b. Sp.',
  'Allmendingen b. Bern': 'Allmendingen b.B.',
  'Büren an der Aare': 'Büren a. A.',
  'Matten bei Interlaken': 'Matten b. I.',
  Muri: 'Muri b. B.',
  'Oberwil b. Büren': 'Oberwil b. B.',
  // Sic: the 2025 table prints "Rapperwil".
  Rapperswil: 'Rapperwil',
  'Rüti b. Büren': 'Rüti b. B.',
  'Rüti b. Lyssach': 'Rüti b. L.',
  'Studen (BE)': 'Studen',
  'Wald BE': 'Wald',
  'Walliswil-Bipp': 'Walliswil b. N.',
  'Walliswil-Wangen': 'Walliswil b. W.',
  'Wengi b. Büren': 'Wengi',
};

const CHURCHES = ['reformed', 'catholic', 'christCatholic'];

/**
 * Values the two official documents give differently. The generated table has null for them, and
 * the engine computes nothing that rests on them (fail closed). Each is in docs/sources/be/NOTES.md.
 */
const CONFLICTS = [
  // The Roman Catholic rate for 2025 in Kiesen, Münsingen, Rubigen, Allmendingen and Wichtrach:
  // 0.17 in the xlsx (dated 11.06.2026, "definitiv", valid from 1.1.2025), 0.18 in the 2025
  // document 556.6 (tables 2.1, 2.2 and 2.3). The 2026 document prints 0.17 for 2026.
  ...[611, 616, 623, 630, 632].map((bfs) => ({
    year: 2025,
    bfs,
    church: 'catholic',
    xlsx: 1700,
    printed: 1800,
  })),
  // Seehof's Roman Catholic rate for 2026: 0.322 in the xlsx (its 2025 rate in both documents),
  // 0.115 in the 2026 document (tables 2.1, 2.2 and 2.3).
  { year: 2026, bfs: 709, church: 'catholic', xlsx: 3220, printed: 1150 },
  // The Reformed rate for 2026 in Scheunen, part of Jegenstorf: 0.218 in the xlsx (the rate of the
  // rest of Jegenstorf), 0.185 in the 2026 document (tables 2.1 and 2.2), as in 2025 in both.
  { year: 2026, bfs: 540, part: 'Scheunen', church: 'reformed', xlsx: 2180, printed: 1850 },
];

/**
 * The xlsx and the printed table must agree, commune by commune and part by part (sets of church
 * rates: the two documents name the parts differently). A known conflict must still be exactly as
 * recorded; its value becomes null.
 */
function crossCheck(communes, table, year) {
  const problems = [];
  const key = (triple) => triple.join('/');
  for (const c of communes) {
    const printed = table.get(fold(PRINTED_NAME[c.name] ?? c.name));
    if (!printed) {
      problems.push(`${c.name} (BFS ${c.bfs}) is not in table 2.1.`);
      continue;
    }
    table.delete(fold(PRINTED_NAME[c.name] ?? c.name));
    // A part printed as a row of its own (2025: Zwieselberg, part of Reutigen since 2024).
    for (const p of c.parts) {
      const own = p.name !== c.name ? table.get(fold(p.name)) : undefined;
      if (own && own.rate === c.rate) {
        printed.parts.push(...own.parts);
        table.delete(fold(p.name));
      }
    }
    if (printed.rate !== c.rate) {
      problems.push(`${c.name}: Steueranlage ${c.rate} in the xlsx, ${printed.rate} printed.`);
    }
    for (const conflict of CONFLICTS.filter((x) => x.year === year && x.bfs === c.bfs)) {
      const i = CHURCHES.indexOf(conflict.church);
      const ours = c.parts.filter((p) => !conflict.part || p.name === conflict.part);
      const theirs = printed.parts.filter(
        (p) => !conflict.part || fold(p.name) === fold(conflict.part),
      );
      if (
        !ours.length ||
        !theirs.length ||
        !ours.every((p) => p[conflict.church] === conflict.xlsx) ||
        !theirs.every((p) => p.triple[i] === conflict.printed)
      ) {
        problems.push(`${c.name}: the known ${conflict.church} conflict is not as recorded.`);
        continue;
      }
      for (const p of theirs) p.triple[i] = conflict.xlsx;
      for (const p of ours) p.conflict = conflict.church;
    }
    const mine = new Set(c.parts.map((p) => key(CHURCHES.map((k) => p[k]))));
    const printedSet = new Set(printed.parts.map((p) => key(p.triple)));
    if ([...mine].sort().join(' ') !== [...printedSet].sort().join(' ')) {
      problems.push(
        `${c.name}: church rates ${[...mine]} in the xlsx, ${[...printedSet]} printed.`,
      );
    }
    for (const p of c.parts) {
      if (p.conflict) p[p.conflict] = null;
      delete p.conflict;
    }
  }
  for (const rest of table.values()) problems.push(`${rest.name} is printed but not in the xlsx.`);
  return problems;
}

function source(year, communes, pages) {
  return (
    `// Bern's communes for tax year ${year}: the Steueranlage for natural persons and the church\n` +
    `// tax rates of each part of the commune, as fractions of the einfache Steuer in\n` +
    `// ten-thousandths (1.54 -> 15400); null where the two official documents differ.\n` +
    `// Generated by scripts/be-communes.mjs from ${XLSX}\n` +
    `// (sheet ${SHEET}), checked against ${PDF(year)} (table 2.1);\n` +
    `// do not edit, re-run the script.\n` +
    `import type { Cited } from '@taxpresso/rules-ch';\n` +
    `import type { BeCommune } from '../communes.js';\n\n` +
    `export const COMMUNES_${year}: Cited<readonly BeCommune[]> = {\n` +
    `  source: '${XLSX} sheet ${SHEET} (STJ ${year}: columns D, Anlage Gde NP; H to J, church rates); ${PDF(year)} p. ${pages[0]} to ${pages.at(-1)} (table 2.1)',\n` +
    `  value: ${JSON.stringify(communes)},\n};\n`
  );
}

const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));
const rows = sheetRows(unzip(await verified(XLSX, 'xlsx', lock)), SHEET);
const require = createRequire(path.join(root, 'packages', 'intake', 'package.json'));
const { getResolvedPDFJS } = await import(pathToFileURL(require.resolve('unpdf')).href);
const pdfjs = await getResolvedPDFJS();
let differs = false;
for (const year of YEARS) {
  const communes = communesFor(rows, year);
  const table = printedTable(await pdfLines(pdfjs, await verified(PDF(year), 'pdf', lock)), year);
  const problems = crossCheck(communes, table, year);
  if (problems.length) {
    throw new Error(`${year}: ${XLSX} and ${PDF(year)} differ:\n  ${problems.join('\n  ')}`);
  }
  const out = path.join(root, 'packages', 'rules-be', 'src', String(year), 'communes.ts');
  const ts = await prettier.format(source(year, communes.map(parishesOf), table.pages), {
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
    console.log(
      `${path.relative(root, out)}: ${communes.length} communes, checked against ${PDF(year)}.`,
    );
  }
}
if (differs) process.exit(1);
