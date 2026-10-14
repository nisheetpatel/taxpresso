#!/usr/bin/env node
// Turns the Steuerverwaltung's table of multipliers (Steuerfüsse der Gemeinden des Kantons Zug, in %
// der einfachen Steuer) into packages/rules-zg/src/<year>/communes.ts: for each of the 11 communes
// its name and, for the tax year, the Steuerfuss of the Einwohnergemeinde, of the Roman Catholic
// parish (Katholische Kirchgemeinde) and of the Bürgergemeinde, then the Steuerfuss of the
// Evangelical Reformed parish (one for the whole canton) and of the canton. Every Steuerfuss is a
// percentage of the einfache Steuer (StG § 2 Abs. 1), stored in hundredths (52.11 -> 5211).
//
// Inputs, downloaded by scripts/fetch-sources.mjs into docs/sources/zg/files (each sha256 must
// match docs/sources/lock.json):
// - zg-2025-communal-steuerfuesse.pdf: the table for 2022 to 2025;
// - zg-2026-communal-steuerfuesse.pdf: the table for 2023 to 2026 (dated 21 January 2026).
// Each tax year is read from the table published for it (zg-<year>-communal-steuerfuesse); where
// both tables give a year (2023 to 2025), every cell must be the same in both, or the script stops.
//
// What the script checks before writing anything:
// - the title names the table's four years, and the three groups of columns (Einwohnergemeinden,
//   Katholische Kirchgemeinden, Bürgergemeinden) each have those four years;
// - 11 communes, then the row "Evangelisch-reformierte Kirchgemeinde des Kantons Zug" and the row
//   "Kanton Zug";
// - every footnote on a cell either is footnote "Einkünfte, die mit Sondersteuern belastet werden"
//   (a Bürgergemeinde that levies only special taxes, printed without a number) or gives a rebate
//   "Auf den Steuerfuss von A % ... ein Rabatt von B Prozent / B % [des Einheitsansatzes] gewährt
//   (entspricht einem Steuerfuss von C %)": C must be the number in the cell, and A less B percent
//   of A (a rebate in percent) or A less B points (a rebate in % des Einheitsansatzes) must be C.
// A Bürgergemeinde printed "-" levies no tax: its rate is null.
//
// The communes carry no federal number (BFS): the table gives none.
//
// Usage:
//   node scripts/zg-communes.mjs              every year in YEARS
//   node scripts/zg-communes.mjs --check      fail if the data differs from the files
//
// Dev tool. It never runs inside the extension, and the extension never reads these files.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as prettier from 'prettier';

const YEARS = [2025, 2026];
const TABLES = [
  { id: 'zg-2025-communal-steuerfuesse', years: [2022, 2023, 2024, 2025] },
  { id: 'zg-2026-communal-steuerfuesse', years: [2023, 2024, 2025, 2026] },
];
const COMMUNES = 11;
const GROUPS = ['Einwohnergemeinden', 'Katholische Kirchgemeinden', 'Bürgergemeinden'];
const REFORMED = 'Evangelisch-reformierte Kirchgemeinde des Kantons Zug';
const CANTON = 'Kanton Zug';
const SPECIAL = 'Einkünfte, die mit Sondersteuern belastet werden';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const filesDir = path.join(root, 'docs', 'sources', 'zg', 'files');

async function verified(id, lock) {
  const file = path.join(filesDir, `${id}.pdf`);
  const buf = await readFile(file).catch(() => {
    throw new Error(`${id}: run node scripts/fetch-sources.mjs --canton zg first.`);
  });
  const sha256 = createHash('sha256').update(buf).digest('hex');
  if (lock[id]?.status !== 'ok' || lock[id].sha256 !== sha256) {
    throw new Error(
      `${id}: the file differs from docs/sources/lock.json. Re-fetch, then re-check.`,
    );
  }
  return buf;
}

/** Every text item of the PDF with its position and height, page by page. */
async function pdfItems(pdfjs, buf) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
  const items = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    for (const it of content.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      items.push({
        page: n,
        x: it.transform[4],
        y: it.transform[5],
        w: it.width,
        h: it.height,
        text: it.str.replace(/\s+/g, ' ').trim(),
      });
    }
  }
  return items;
}

/** "52.11" -> 5211, "7" -> 700, "8 .5" -> 850: hundredths of a percent. */
function hundredths(s, where) {
  const t = s.replace(/\s+/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) throw new Error(`${where}: not a percentage: "${s}".`);
  const [int, dec = ''] = t.split('.');
  return Number(int) * 100 + Number(dec.padEnd(2, '0'));
}

/** The footnotes under the table: number -> text (they run onto page 2). */
function footnotes(items, tableBottom) {
  const notes = new Map();
  const below = items.filter((i) => i.page > 1 || i.y < tableBottom);
  for (const mark of below.filter((i) => /^\d+\)$/.test(i.text) && i.x < 110)) {
    const text = below
      .filter((i) => i.page === mark.page && Math.abs(i.y - mark.y) < 2 && i.x > mark.x + 5)
      .sort((a, b) => a.x - b.x)
      .map((i) => i.text)
      .join(' ');
    notes.set(Number(mark.text.slice(0, -1)), text);
  }
  return notes;
}

/** What a footnote says about a cell: a rebate that gives `effective`, or special taxes only. */
function readFootnote(text, where) {
  if (text.startsWith(SPECIAL)) return { special: true };
  const m =
    /^Auf den Steuerfuss von ([\d. ]+) % wird für das entsprechende Steuerjahr ein Rabatt von ([\d. ]+) (Prozent|%)( des Einheitsansatzes)? gewährt \(entspricht einem Steuerfu ?ss von ([\d. ]+) %\)\.?$/.exec(
      text,
    );
  if (!m) throw new Error(`${where}: footnote not understood: "${text}".`);
  const base = hundredths(m[1], where);
  const rebate = hundredths(m[2], where);
  const effective = hundredths(m[5], where);
  const points = Boolean(m[4]);
  // A rebate in points of the Einheitsansatz comes off the rate; otherwise it is a share of it.
  const computed = points ? base - rebate : base - (base * rebate) / 10_000;
  if (computed !== effective) {
    throw new Error(
      `${where}: footnote gives ${effective / 100} %, its rebate ${computed / 100} %.`,
    );
  }
  return { special: false, effective };
}

/** One table: { years, communes: [{ name, rate[], catholic[], citizens[] }], reformed[], canton[] }. */
function readTable(items, id, years) {
  const title = items.find((i) => i.page === 1 && i.text.startsWith('Steuerfüsse der Gemeinden'));
  const titleText = items
    .filter((i) => title && i.page === 1 && Math.abs(i.y - title.y) < 2)
    .sort((a, b) => a.x - b.x)
    .map((i) => i.text)
    .join(' ');
  if (
    !titleText.includes(`Steuerjahre ${years[0]}`) ||
    !titleText.includes(`${years[3]} in % der einfachen Steuer (100 %)`)
  ) {
    throw new Error(`${id}: unexpected title "${titleText}".`);
  }
  const page1 = items.filter((i) => i.page === 1);
  const groups = GROUPS.map((g) => {
    const head = page1.find((i) => i.text === g);
    if (!head) throw new Error(`${id}: no column group "${g}".`);
    return head;
  });
  // The four year headers of each group, left to right.
  const yearRow = page1.filter((i) => /^20\d\d$/.test(i.text)).sort((a, b) => a.x - b.x);
  if (yearRow.length !== 12) throw new Error(`${id}: expected 12 year headers.`);
  const columns = [];
  for (let g = 0; g < 3; g++) {
    const four = yearRow.slice(g * 4, g * 4 + 4);
    if (four.map((i) => Number(i.text)).join() !== years.join()) {
      throw new Error(`${id}: ${GROUPS[g]} columns are ${four.map((i) => i.text).join(', ')}.`);
    }
    if (four[0].x < groups[g].x - 60) throw new Error(`${id}: ${GROUPS[g]} columns misplaced.`);
    for (let k = 0; k < 4; k++) {
      columns.push({ group: g, year: years[k], center: four[k].x + four[k].w / 2 });
    }
  }
  const headerY = yearRow[0].y;
  const notes = footnotes(items, page1.find((i) => i.text === CANTON).y - 5);

  // Rows: a label at the left, then the cells; small items just above a cell are its footnotes.
  const labels = page1
    .filter((i) => i.x < 110 && i.y < headerY - 5 && i.h > 8 && !/^\d+\)$/.test(i.text))
    .sort((a, b) => b.y - a.y);
  const rows = labels.map((label) => {
    const inRow = page1.filter((i) => i.x > 150 && Math.abs(i.y - label.y) < 4);
    const cells = new Map();
    for (const v of inRow.filter((i) => i.h > 8)) {
      const center = v.x + v.w / 2;
      const col = columns.reduce((best, c) =>
        Math.abs(c.center - center) < Math.abs(best.center - center) ? c : best,
      );
      if (Math.abs(col.center - center) > 22) {
        throw new Error(`${id}: "${v.text}" of ${label.text} is under no column.`);
      }
      const key = `${col.group}:${col.year}`;
      if (cells.has(key)) throw new Error(`${id}: two values for ${label.text} ${key}.`);
      cells.set(key, { text: v.text, x: v.x + v.w, notes: [] });
    }
    for (const n of inRow.filter((i) => i.h <= 8 && /^\d+\)$/.test(i.text))) {
      // A footnote mark belongs to the cell just left of it; a mark without a cell is a cell.
      const left = [...cells.entries()]
        .filter(([, c]) => c.x <= n.x + 1 && n.x - c.x < 12)
        .sort((a, b) => b[1].x - a[1].x)[0];
      if (left) left[1].notes.push(Number(n.text.slice(0, -1)));
      else {
        const center = n.x + n.w / 2;
        const col = columns.reduce((best, c) =>
          Math.abs(c.center - center) < Math.abs(best.center - center) ? c : best,
        );
        const key = `${col.group}:${col.year}`;
        if (cells.has(key))
          throw new Error(`${id}: footnote ${n.text} of ${label.text} misplaced.`);
        cells.set(key, { text: '', x: n.x, notes: [Number(n.text.slice(0, -1))] });
      }
    }
    return { name: label.text, cells };
  });

  const value = (row, group, year) => {
    const where = `${id}, ${row.name}, ${GROUPS[group]} ${year}`;
    const cell = row.cells.get(`${group}:${year}`);
    if (!cell) throw new Error(`${where}: empty cell.`);
    if (cell.text === '-' && !cell.notes.length) return null;
    let special = false;
    for (const n of cell.notes) {
      if (!notes.has(n)) throw new Error(`${where}: footnote ${n} not found.`);
      const f = readFootnote(notes.get(n), `${where}, footnote ${n}`);
      if (f.special) special = true;
      else if (f.effective !== hundredths(cell.text, where)) {
        throw new Error(`${where}: the cell says ${cell.text}, its footnote ${f.effective / 100}.`);
      }
    }
    if (special) {
      if (cell.text) throw new Error(`${where}: special taxes only, yet a rate is printed.`);
      return 'special';
    }
    return hundredths(cell.text, where);
  };

  const reformedAt = rows.findIndex((r) => r.name === REFORMED);
  const cantonAt = rows.findIndex((r) => r.name === CANTON);
  if (reformedAt !== COMMUNES || cantonAt !== COMMUNES + 1 || rows.length !== COMMUNES + 2) {
    throw new Error(
      `${id}: expected ${COMMUNES} communes, then "${REFORMED}" and "${CANTON}"; read ${rows
        .map((r) => r.name)
        .join(', ')}.`,
    );
  }
  const communes = rows.slice(0, COMMUNES).map((row) => {
    const out = { name: row.name, rate: {}, catholic: {}, citizens: {} };
    for (const y of years) {
      out.rate[y] = value(row, 0, y);
      out.catholic[y] = value(row, 1, y);
      out.citizens[y] = value(row, 2, y);
      if (typeof out.rate[y] !== 'number' || typeof out.catholic[y] !== 'number') {
        throw new Error(`${id}, ${row.name} ${y}: no Steuerfuss of the commune or the parish.`);
      }
    }
    return out;
  });
  const single = (row, group) =>
    Object.fromEntries(
      years.map((y) => {
        const v = value(row, group, y);
        if (typeof v !== 'number') throw new Error(`${id}, ${row.name} ${y}: no Steuerfuss.`);
        return [y, v];
      }),
    );
  return {
    id,
    years,
    communes,
    reformed: single(rows[reformedAt], 1),
    canton: single(rows[cantonAt], 0),
  };
}

function source(year, data) {
  const id = data.id;
  const list = data.communes.map((c) => ({
    name: c.name,
    rate: c.rate[year],
    catholic: c.catholic[year],
    citizens: c.citizens[year],
  }));
  const table = `${id} (p. 1, columns ${year}`;
  const cited = {
    communes: `${table}: Einwohnergemeinden, Katholische Kirchgemeinden, Bürgergemeinden; footnotes p. 1 and 2, the rebates already in the rates); zg-${year}-law-steuergesetz § 2 Abs. 1 (p. 1), § 168, § 169 Abs. 1, § 170 Abs. 1 (p. 83 and 84)`,
    reformed: `${table}: Evangelisch-reformierte Kirchgemeinde des Kantons Zug); zg-${year}-law-steuergesetz § 169 Abs. 1 (p. 84)`,
    canton: `${table}: Kanton Zug); zg-${year}-law-steuergesetz § 2 Abs. ${year === 2026 ? '2b' : '2'} (p. ${year === 2026 ? 2 : 1})`,
  };
  return (
    `// Zug's communes for tax year ${year}, in the table's order: the Steuerfuss of the\n` +
    `// Einwohnergemeinde, of the Roman Catholic parish and of the Bürgergemeinde (null: it levies no\n` +
    `// tax; 'special': special taxes only), then the Evangelical Reformed parish (one for the canton)\n` +
    `// and the canton, each in hundredths of a percent of the einfache Steuer (52.11 % -> 5211).\n` +
    `// Generated by scripts/zg-communes.mjs from ${id};\n` +
    `// do not edit, re-run the script.\n` +
    `import type { Cited } from '@taxpresso/rules-ch';\n` +
    `import type { ZgCommune } from '../communes.js';\n\n` +
    `export const COMMUNES_${year}: Cited<readonly ZgCommune[]> = {\n` +
    `  source: ${JSON.stringify(cited.communes)},\n` +
    `  value: ${JSON.stringify(list)},\n};\n\n` +
    `/** The Evangelical Reformed parish of the canton (Evangelisch-reformierte Kirchgemeinde). */\n` +
    `export const REFORMED_${year}: Cited<number> = {\n` +
    `  source: ${JSON.stringify(cited.reformed)},\n` +
    `  value: ${data.reformed[year]},\n};\n\n` +
    `/** The canton's Steuerfuss (Kantonssteuer). */\n` +
    `export const CANTON_${year}: Cited<number> = {\n` +
    `  source: ${JSON.stringify(cited.canton)},\n` +
    `  value: ${data.canton[year]},\n};\n`
  );
}

const require = createRequire(path.join(root, 'packages', 'intake', 'package.json'));
const { getResolvedPDFJS } = await import(pathToFileURL(require.resolve('unpdf')).href);
const pdfjs = await getResolvedPDFJS();
const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));

const tables = [];
for (const t of TABLES) {
  tables.push(readTable(await pdfItems(pdfjs, await verified(t.id, lock)), t.id, t.years));
}
// Where both tables give a year, they must agree cell by cell.
const [older, newer] = tables;
for (const y of older.years.filter((y) => newer.years.includes(y))) {
  const a = JSON.stringify([
    older.communes.map((c) => [c.name, c.rate[y], c.catholic[y], c.citizens[y]]),
    older.reformed[y],
    older.canton[y],
  ]);
  const b = JSON.stringify([
    newer.communes.map((c) => [c.name, c.rate[y], c.catholic[y], c.citizens[y]]),
    newer.reformed[y],
    newer.canton[y],
  ]);
  if (a !== b) throw new Error(`${y}: ${older.id} and ${newer.id} differ.`);
}

let differs = false;
for (const year of YEARS) {
  const data = tables.find((t) => t.id === `zg-${year}-communal-steuerfuesse`);
  const out = path.join(root, 'packages', 'rules-zg', 'src', String(year), 'communes.ts');
  const ts = await prettier.format(source(year, data), {
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
    console.log(`${path.relative(root, out)}: ${data.communes.length} communes from ${data.id}.`);
  }
}
if (differs) process.exit(1);
