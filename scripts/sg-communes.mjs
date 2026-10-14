#!/usr/bin/env node
// Turns St. Gallen's yearly table of multipliers (Steuerfüsse der Gemeinden des Kantons St. Gallen
// im Jahr <year>, Kantonales Steueramt, Abteilung Revision) into packages/rules-sg/src/<year>/
// communes.ts: for each political commune its name and its Gesamtsteuerfuss (percent of the einfache
// Steuer, StG Art. 6 Abs. 2), stored in hundredths of a percent (138 -> 13800); for the church tax,
// the commune's church areas (Kirchgemeinden) with their Catholic and Evangelical rates (the same
// unit) and the table's footnotes 3 and 4 on a rate; and the statewide Christ Catholic rate and the
// cantonal multiplier the table's remarks state.
//
// Input: docs/sources/sg/files/sg-<year>-communal-steuerfuesse.pdf, downloaded by
// scripts/fetch-sources.mjs, its sha256 checked against docs/sources/lock.json. The PDF is read with
// unpdf (packages/intake's dependency): text items with their positions, one line per row. The
// table's remarks, footnotes and column headings are checked before anything is read, so a new
// layout stops the script. Each row is checked against the table's own sums: the columns "Steuerfuss
// Kanton und Gemeinden" must equal the cantonal multiplier plus the commune's plus the church's.
// A main row (at the left margin) is a political commune; an indented row under it is one of its
// church areas, with the same communal multiplier. A main row whose church rates are "--" has its
// areas only below it; otherwise it is an area itself, named after the commune.
//
// Usage:
//   node scripts/sg-communes.mjs              every year in YEARS
//   node scripts/sg-communes.mjs --check      fail if the data differs from the files
//
// Dev tool. It never runs inside the extension, and the extension never reads these files.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as prettier from 'prettier';

const YEARS = [2025, 2026];
const ID = (year) => `sg-${year}-communal-steuerfuesse`;
/** St. Gallen's political communes (the table's main rows), the same in both years. */
const COMMUNES = 75;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const filesDir = path.join(root, 'docs', 'sources', 'sg', 'files');

async function verified(id, ext, lock) {
  const file = path.join(filesDir, `${id}.${ext}`);
  const buf = await readFile(file).catch(() => {
    throw new Error(`${id}: run node scripts/fetch-sources.mjs --canton sg first.`);
  });
  const sha256 = createHash('sha256').update(buf).digest('hex');
  if (lock[id]?.status !== 'ok' || lock[id].sha256 !== sha256) {
    throw new Error(
      `${id}: the file differs from docs/sources/lock.json. Re-fetch, then re-check.`,
    );
  }
  return buf;
}

/** The text items of each page as rows of { x, h, text } cells, top to bottom, left to right. */
async function pdfRows(pdfjs, buf) {
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
      row.cells.push({ x: it.transform[4], h: it.transform[3], text: it.str.trim() });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) r.cells.sort((a, b) => a.x - b.x);
    pages.push(rows);
  }
  return pages;
}

/** "138" -> 13800, "22.5" -> 2250: hundredths of a percent, exactly. */
function hundredths(s, where) {
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) throw new Error(`${where}: not a percentage: ${JSON.stringify(s)}`);
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

const REMARKS = (year) => [
  `Steuerfüsse der Gemeinden des Kantons St. Gallen im Jahr ${year}`,
  'Der Steuerfuss ist in Prozent der einfachen Steuer festgelegt.',
  '1 Einschliesslich 4 Prozent Zentralsteuer',
  '2 Einschliesslich 3.1 Prozent Zentralsteuer; bezüglich dem Gebietsumfang der evangelischen',
  '3 Gebietsteile von ausserkantonalen Kirchgemeinden',
  '4 Grössere Gemeindegebiete, welche anderen Kirchgemeinden zugeteilt sind',
];

/**
 * The columns, by the x where their values start (right-aligned numbers, so a range): the commune's
 * name, then Grundsteuersatz, Gesamtsteuerfuss, Katholisch, Evangelisch, and the totals for Katholisch
 * and Evangelisch. Read from the headings' positions on page 1 and checked on every page.
 */
const COLUMNS = [
  ['grund', 205, 235],
  ['rate', 255, 290],
  ['catholic', 315, 360],
  ['reformed', 385, 430],
  ['totalCatholic', 450, 495],
  ['totalReformed', 515, 560],
];

function columnOf(x) {
  return COLUMNS.find(([, lo, hi]) => x >= lo && x < hi)?.[0];
}

function tableOf(pages, year) {
  const id = ID(year);
  const lines = pages.flat().map((r) => r.cells.map((c) => c.text).join(' '));
  for (const remark of REMARKS(year)) {
    if (!lines.includes(remark)) throw new Error(`${id}: the remark "${remark}" is missing.`);
  }
  const cantonal = lines
    .map((l) => /^Die Kantonssteuer beträgt (\d+) Prozent\.$/.exec(l))
    .find(Boolean);
  if (!cantonal) throw new Error(`${id}: no cantonal multiplier in the remarks.`);
  const christ = lines
    .join(' ')
    .match(
      /Der Steuerfuss für Angehörige der christkatholischen Kirchgemeinde beträgt im ganzen Kanton (\d+) Prozent\./,
    );
  if (!christ) throw new Error(`${id}: no statewide Christ Catholic rate in the remarks.`);
  const kanton = hundredths(cantonal[1], `${id} Kantonssteuer`);

  const communes = [];
  let current;
  let headings = 0;
  for (const [n, rows] of pages.entries()) {
    const heading = rows.find((r) =>
      /^Gemeinde Politische Gemeinde Kirchgemeinde Steuerfuss$/.test(
        r.cells.map((c) => c.text).join(' '),
      ),
    );
    if (!heading) continue;
    headings++;
    for (const [i, row] of rows.entries()) {
      const name = row.cells.filter((c) => c.x < 200 && c.h > 7);
      const values = row.cells.filter((c) => c.x >= 200 && c.h > 7);
      if (!name.length || values.length !== 6) continue;
      const v = {};
      for (const c of values) {
        const col = columnOf(c.x);
        if (!col || col in v) {
          throw new Error(`${id} p. ${n + 1}: cannot place "${c.text}" (x ${c.x}).`);
        }
        v[col] = c.text;
      }
      const where = `${id} p. ${n + 1} ${name.map((c) => c.text).join(' ')}`;
      // Footnote marks are small digits just above the row, right after the rate they qualify.
      const above = rows[i - 1];
      const marks = {};
      if (above && above.y - row.y < 7) {
        for (const c of above.cells) {
          if (c.h > 7) continue;
          if (!/^[34]$/.test(c.text)) throw new Error(`${where}: unknown mark "${c.text}".`);
          const col = c.x > 335 && c.x < 385 ? 'catholic' : c.x > 405 && c.x < 450 ? 'reformed' : 0;
          if (!col) throw new Error(`${where}: mark ${c.text} at x ${c.x} is under no rate.`);
          marks[col] = Number(c.text);
        }
      }
      const label = name.map((c) => c.text).join(' ');
      const indented = name[0].x > 28;
      const rate = hundredths(v.rate, `${where} Gesamtsteuerfuss`);
      const church =
        v.catholic === '--'
          ? null
          : {
              catholic: hundredths(v.catholic, `${where} Katholisch`),
              reformed: hundredths(v.reformed, `${where} Evangelisch`),
            };
      if (church) {
        const tc = hundredths(v.totalCatholic, `${where} total Katholisch`);
        const tr = hundredths(v.totalReformed, `${where} total Evangelisch`);
        if (tc !== kanton + rate + church.catholic || tr !== kanton + rate + church.reformed) {
          throw new Error(`${where}: the totals are not ${kanton / 100} + commune + church.`);
        }
      } else if ([v.reformed, v.totalCatholic, v.totalReformed].some((x) => x !== '--')) {
        throw new Error(`${where}: some church rates given, some not.`);
      }
      const area = church && {
        name: label,
        catholic: church.catholic,
        reformed: church.reformed,
        ...(Object.keys(marks).length ? { notes: marks } : {}),
      };
      if (!indented) {
        if (!/^\d\.\d$/.test(v.grund)) throw new Error(`${where}: Grundsteuersatz "${v.grund}".`);
        current = { name: label, rate, areas: area ? [area] : [] };
        communes.push(current);
      } else {
        if (!current) throw new Error(`${where}: an area before any commune.`);
        if (v.grund !== '--') throw new Error(`${where}: an area with a Grundsteuersatz.`);
        if (rate !== current.rate) throw new Error(`${where}: not the commune's multiplier.`);
        if (!area) throw new Error(`${where}: an area without church rates.`);
        current.areas.push(area);
      }
    }
  }
  if (headings !== pages.length) {
    throw new Error(`${id}: ${headings} pages with the column headings, ${pages.length} pages.`);
  }
  if (communes.length !== COMMUNES) {
    throw new Error(`${id}: ${communes.length} communes read, ${COMMUNES} expected.`);
  }
  for (const c of communes) {
    if (!c.areas.length) throw new Error(`${id}: ${c.name} has no church rates.`);
    if (new Set(c.areas.map((a) => a.name)).size !== c.areas.length) {
      throw new Error(`${id}: ${c.name} names an area twice.`);
    }
  }
  if (new Set(communes.map((c) => c.name)).size !== COMMUNES) {
    throw new Error(`${id}: two communes with the same name.`);
  }
  return {
    kanton,
    christCatholic: hundredths(christ[1], `${id} christkatholisch`),
    communes,
  };
}

function source(year, table) {
  const id = ID(year);
  const areas = table.communes.reduce((s, c) => s + c.areas.length, 0);
  return (
    `// St. Gallen's ${table.communes.length} political communes for tax year ${year}: the name and the\n` +
    `// Gesamtsteuerfuss of the political commune, in hundredths of a percent of the einfache Steuer\n` +
    `// (138 % -> 13800); for the church tax, the commune's church areas (Kirchgemeinden, ${areas} in\n` +
    `// all) with their Catholic and Evangelical rates in the same unit, and the table's footnotes on\n` +
    `// a rate (3: parts belong to parishes outside the canton; 4: larger parts belong to other\n` +
    `// parishes). Generated by scripts/sg-communes.mjs from ${id};\n` +
    `// do not edit, re-run the script.\n` +
    `import type { Cited } from '@taxpresso/rules-ch';\n` +
    `import type { SgCommune } from '../communes.js';\n\n` +
    `export const COMMUNES_${year}: Cited<readonly SgCommune[]> = {\n` +
    `  source: '${id} p. 1 to 4 (columns Politische Gemeinde, Gesamtsteuerfuss in %; Kirchgemeinde, Katholisch (footnote 1: einschliesslich 4 Prozent Zentralsteuer) and Evangelisch (footnote 2: einschliesslich 3.1 Prozent Zentralsteuer) in %); sg-${year}-law-steuergesetz Art. 6 Abs. 2 (p. 2)',\n` +
    `  value: ${JSON.stringify(table.communes)},\n};\n\n` +
    `/** The Christ Catholic church's rate, the same in the whole canton (the table's remarks). */\n` +
    `export const CHRIST_CATHOLIC_${year}: Cited<number> = {\n` +
    `  source: '${id} p. 1 (Bemerkungen: Der Steuerfuss für Angehörige der christkatholischen Kirchgemeinde beträgt im ganzen Kanton ${table.christCatholic / 100} Prozent)',\n` +
    `  value: ${table.christCatholic},\n};\n\n` +
    `/** The cantonal multiplier the table's remarks state (the tariff module cites the decision). */\n` +
    `export const TABLE_CANTONAL_${year} = ${table.kanton};\n`
  );
}

const require = createRequire(path.join(root, 'packages', 'intake', 'package.json'));
const { getResolvedPDFJS } = await import(pathToFileURL(require.resolve('unpdf')).href);
const pdfjs = await getResolvedPDFJS();
const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));
let differs = false;
for (const year of YEARS) {
  const table = tableOf(await pdfRows(pdfjs, await verified(ID(year), 'pdf', lock)), year);
  const out = path.join(root, 'packages', 'rules-sg', 'src', String(year), 'communes.ts');
  const ts = await prettier.format(source(year, table), {
    ...(await prettier.resolveConfig(out)),
    parser: 'typescript',
  });
  const areas = table.communes.reduce((s, c) => s + c.areas.length, 0);
  if (check) {
    const current = await readFile(out, 'utf8').catch(() => '');
    if (current !== ts) {
      differs = true;
      console.error(`${path.relative(root, out)} differs from the official table.`);
    } else {
      console.log(
        `${path.relative(root, out)}: same as the official table (${table.communes.length} communes, ${areas} church areas).`,
      );
    }
  } else {
    await writeFile(out, ts);
    console.log(
      `${path.relative(root, out)}: ${table.communes.length} communes, ${areas} church areas.`,
    );
  }
}
if (differs) process.exit(1);
