#!/usr/bin/env node
// Turns Aargau's list of communal and church multipliers (Verzeichnis der Gemeinde- und
// Kirchensteuerfüsse) into packages/rules-ag/src/<year>/communes.ts: for each commune, its name as
// the list prints it, its Steuerfuss for natural persons and the church Steuerfüsse of the
// Reformed (ev.-ref.), Roman Catholic (röm.-kt.) and Christ Catholic (christ-kt.) parishes, plus the
// further parishes (Zusatzkirchen 1 to 5) whose members in part of the commune pay another rate,
// each with its name as the list's last page prints it. All in percent of the einfache
// Kantonssteuer (ag-na-law-steuergesetz § 155 Abs. 1; the Wegleitung's Anhang II, ag-2025-guide-
// wegleitung p. 45, multiplies the einfache Steuer by each of them).
//
// Input: docs/sources/ag/files/ag-<year>-communal-steuerfuesse.pdf (pages 1 to 8: the table, one row
// per commune; page 9: the Zusatzkirchen) and ag-2026-communal-kantonssteuerfuss-zinssaetze.pdf
// (the cantonal Steuerfuss of each year), downloaded by scripts/fetch-sources.mjs; their sha256 must
// match docs/sources/lock.json. Read with unpdf (packages/intake's dependency), cell by cell: a
// number belongs to the column whose heading is nearest to it.
// Checks: every commune once, every rate a whole percent, the three church columns filled, each
// Zusatzkirche column of the table matched by a name on page 9 and the reverse, each Zusatzkirche
// named for the Reformed ("ref.") or the Roman Catholic ("röm.-kath.") church; the cantonal
// Steuerfuss in the list's title ("Steuerfuss Kanton 111 %") equals the table of cantonal
// multipliers for the year (ordentliche Kantonssteuer + Kantonssteuerzuschlag = ohne FiAusgleich;
// + Finanzausgleich = mit FiAusgleich) and CANTONAL_RATE_<year> in packages/rules-ag/src/<year>/
// tariffs.ts (read with Node's type stripping: the module imports types only).
// The BFS numbers are not in the list: communes are identified by name.
//
// Usage:
//   node scripts/ag-communes.mjs              every year in YEARS
//   node scripts/ag-communes.mjs --check      fail if the data differs from the files
//
// Dev tool. It never runs inside the extension, and the extension never reads these files.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as prettier from 'prettier';

const YEARS = [2025, 2026];
const LIST = (year) => `ag-${year}-communal-steuerfuesse`;
const CANTON_TABLE = 'ag-2026-communal-kantonssteuerfuss-zinssaetze';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const filesDir = path.join(root, 'docs', 'sources', 'ag', 'files');

async function verified(id, lock) {
  const file = path.join(filesDir, `${id}.pdf`);
  const buf = await readFile(file).catch(() => {
    throw new Error(`${id}: run node scripts/fetch-sources.mjs --canton ag first.`);
  });
  const sha256 = createHash('sha256').update(buf).digest('hex');
  if (lock[id]?.status !== 'ok' || lock[id].sha256 !== sha256) {
    throw new Error(
      `${id}: the file differs from docs/sources/lock.json. Re-fetch, then re-check.`,
    );
  }
  return buf;
}

/** The text items of each page as lines of { x, text } cells, top to bottom, left to right. */
async function pdfLines(pdfjs, buf) {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: false,
    verbosity: 0,
  }).promise;
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
    pages.push(rows.map((r) => r.cells.sort((a, b) => a.x - b.x)));
  }
  return pages;
}

/** "96" -> 96: a whole percent, or the list is refused. */
function percent(s, where) {
  if (!/^\d{1,3}$/.test(s)) throw new Error(`${where}: "${s}" is not a whole percent.`);
  return Number(s);
}

const COLUMNS = ['rate', 'reformed', 'catholic', 'christCatholic', 'k1', 'k2', 'k3', 'k4', 'k5'];

/** The x of each column's heading on a page of the table, from its two heading lines. */
function headings(lines, where) {
  const top = lines.find((l) => l[0]?.text === 'Gemeinde' && l[1]?.text === 'Steuerfuss');
  if (!top) throw new Error(`${where}: no heading "Gemeinde Steuerfuss".`);
  const second = lines[lines.indexOf(top) + 1] ?? [];
  const names = second.map((c) => c.text);
  const expected = ['ev.-ref.', 'röm.-kt.', 'christ-kt.', '1', '2', '3', '4', '5'];
  if (names.join('|') !== expected.join('|')) {
    throw new Error(`${where}: the church headings read "${names.join(' ')}".`);
  }
  // The second line's cells sit under "Kirche"; the Steuerfuss heading is on the first line.
  return [top[1].x, ...second.map((c) => c.x)];
}

/** The rows of the table: [{ name, rate, reformed, catholic, christCatholic, k1..k5 }]. */
function tableRows(pages, id) {
  const rows = [];
  for (const [i, lines] of pages.entries()) {
    const where = `${id} p. ${i + 1}`;
    if (lines.some((l) => l[0]?.text === 'Zusatzkirchen')) continue;
    const xs = headings(lines, where);
    const start = lines.findIndex((l) => l[0]?.text === 'Gemeinde') + 2;
    for (const line of lines.slice(start)) {
      const text = line.map((c) => c.text).join(' ');
      if (/^\d+ von \d+$/.test(text)) continue;
      const numbers = line.filter((c) => /^\d+$/.test(c.text));
      const name = line
        .filter((c) => !numbers.includes(c))
        .map((c) => c.text)
        .join(' ');
      if (!name || numbers.length < 4) throw new Error(`${where}: cannot read the row "${text}".`);
      const row = { name };
      for (const cell of numbers) {
        const col = xs.map((x, k) => [Math.abs(x - cell.x), k]).sort((a, b) => a[0] - b[0])[0][1];
        const key = COLUMNS[col];
        if (key in row) throw new Error(`${where}: ${name} has two values in column ${key}.`);
        row[key] = percent(cell.text, `${where} ${name} ${key}`);
      }
      for (const key of COLUMNS.slice(0, 4)) {
        if (!(key in row)) throw new Error(`${where}: ${name} has no ${key} value.`);
      }
      rows.push(row);
    }
  }
  return rows;
}

/** Page 9: for each commune with further parishes, their names in the list's order. */
function extraParishes(pages, id) {
  const index = pages.findIndex((lines) => lines.some((l) => l[0]?.text === 'Zusatzkirchen'));
  if (index < 0) throw new Error(`${id}: no page "Zusatzkirchen".`);
  const lines = pages[index];
  const where = `${id} p. ${index + 1}`;
  const head = lines.find((l) => l[0]?.text === 'Gemeinde');
  const xs = head.slice(1).map((c) => c.x);
  if (
    head
      .slice(1)
      .map((c) => c.text)
      .join('|') !== [1, 2, 3, 4, 5].map((k) => `Zusatzkirche ${k}`).join('|')
  ) {
    throw new Error(`${where}: unexpected headings.`);
  }
  const out = new Map();
  let current = null;
  for (const line of lines.slice(lines.indexOf(head) + 1)) {
    const text = line.map((c) => c.text).join(' ');
    if (/^\d+ von \d+$/.test(text)) continue;
    let cells = line;
    if (line[0].x < xs[0] - 20) {
      current = { name: line[0].text, parts: ['', '', '', '', ''] };
      if (out.has(current.name)) throw new Error(`${where}: ${current.name} listed twice.`);
      out.set(current.name, current.parts);
      cells = line.slice(1);
    }
    if (!current) throw new Error(`${where}: "${text}" before any commune.`);
    for (const cell of cells) {
      const col = xs.map((x, k) => [Math.abs(x - cell.x), k]).sort((a, b) => a[0] - b[0])[0][1];
      const before = current.parts[col];
      // A word broken at the line's end ("Bött-" / "stein") is joined; otherwise a space.
      current.parts[col] =
        before === ''
          ? cell.text
          : before.endsWith('-') && /^\p{Ll}/u.test(cell.text)
            ? before.slice(0, -1) + cell.text
            : `${before} ${cell.text}`;
    }
  }
  const result = new Map();
  for (const [name, parts] of out) {
    const used = parts.filter(Boolean);
    if (parts.slice(used.length).some(Boolean)) throw new Error(`${where}: ${name} has a gap.`);
    result.set(
      name,
      used.map((label) => {
        const confession = label.startsWith('ref. Kirche ')
          ? 'reformed'
          : label.startsWith('röm.-kath. Kirche ')
            ? 'catholic'
            : null;
        if (!confession) throw new Error(`${where}: ${name}, "${label}" names no church.`);
        return { parish: label, confession };
      }),
    );
  }
  return result;
}

/** The cantonal Steuerfuss in the list's title: "für das Jahr 2026 (Steuerfuss Kanton 103 %)". */
function titleRate(pages, id, year) {
  const text = pages[0].map((l) => l.map((c) => c.text).join(' ')).join(' ');
  const m = text.match(/für das Jahr (\d{4}) \(Steuerfuss Kanton (\d+) %\)/);
  if (!m || Number(m[1]) !== year) throw new Error(`${id} p. 1: no title for ${year}.`);
  return Number(m[2]);
}

/** The table of cantonal multipliers, row of the year: the parts and the total "mit FiAusgleich". */
function cantonTableRate(pages, year) {
  const line = pages[0].find((l) => l[0]?.text === String(year));
  if (!line) throw new Error(`${CANTON_TABLE} p. 1: no row ${year}.`);
  const at = (lo, hi) => {
    const c = line.filter((x) => x.x >= lo && x.x < hi && /^\d+(\.\d+)?%$/.test(x.text));
    if (c.length > 1) throw new Error(`${CANTON_TABLE} p. 1: ${year} has two values at ${lo}.`);
    return c.length ? Number(c[0].text.slice(0, -1)) : 0;
  };
  const ordinary = at(110, 150);
  const surcharge = at(160, 200);
  const hospital = at(200, 240);
  const without = at(250, 300);
  const equalisation = at(300, 340);
  const total = at(340, 400);
  if (ordinary + surcharge + hospital !== without || without + equalisation !== total) {
    throw new Error(`${CANTON_TABLE} p. 1: the parts of ${year} do not add up.`);
  }
  return total;
}

function source(year, communes) {
  return (
    `// Aargau's communes for tax year ${year}: each commune by its name as the official list prints\n` +
    `// it (the list carries no BFS number), its Steuerfuss for natural persons and the church\n` +
    `// Steuerfüsse, in percent of the einfache Kantonssteuer; \`extra\` are the further parishes\n` +
    `// (Zusatzkirchen) whose members in part of the commune pay another church rate.\n` +
    `// Generated by scripts/ag-communes.mjs from ${LIST(year)}; do not edit, re-run the script.\n` +
    `import type { Cited } from '@taxpresso/rules-ch';\n` +
    `import type { AgCommune } from '../communes.js';\n\n` +
    `export const COMMUNES_${year}: Cited<readonly AgCommune[]> = {\n` +
    `  source: '${LIST(year)} p. 1 to 8 (Steuerfuss; Kirche ev.-ref., röm.-kt., christ-kt.; Kirche 1 to 5), p. 9 (Zusatzkirchen)',\n` +
    `  value: ${JSON.stringify(communes)},\n};\n`
  );
}

const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));
const require = createRequire(path.join(root, 'packages', 'intake', 'package.json'));
const { getResolvedPDFJS } = await import(pathToFileURL(require.resolve('unpdf')).href);
const pdfjs = await getResolvedPDFJS();
const cantonPages = await pdfLines(pdfjs, await verified(CANTON_TABLE, lock));

let differs = false;
for (const year of YEARS) {
  const pages = await pdfLines(pdfjs, await verified(LIST(year), lock));
  const rows = tableRows(pages, LIST(year));
  const extras = extraParishes(pages, LIST(year));
  if (new Set(rows.map((r) => r.name)).size !== rows.length) {
    throw new Error(`${LIST(year)}: a commune is listed twice.`);
  }

  const canton = titleRate(pages, LIST(year), year);
  if (canton !== cantonTableRate(cantonPages, year)) {
    throw new Error(`${LIST(year)}: the title's cantonal Steuerfuss differs from ${CANTON_TABLE}.`);
  }
  const tariffs = path.join(root, 'packages', 'rules-ag', 'src', String(year), 'tariffs.ts');
  const { [`CANTONAL_RATE_${year}`]: written } = await import(pathToFileURL(tariffs).href);
  if (written?.value !== canton) {
    throw new Error(`${path.relative(root, tariffs)}: CANTONAL_RATE_${year} is not ${canton}.`);
  }

  const communes = rows.map((r) => {
    const names = extras.get(r.name) ?? [];
    const values = ['k1', 'k2', 'k3', 'k4', 'k5'].filter((k) => k in r).map((k) => r[k]);
    if (
      names.length !== values.length ||
      ['k1', 'k2', 'k3', 'k4', 'k5'].slice(values.length).some((k) => k in r)
    ) {
      throw new Error(
        `${LIST(year)}: ${r.name} has ${values.length} further church rates for ${names.length} Zusatzkirchen.`,
      );
    }
    extras.delete(r.name);
    return {
      name: r.name,
      rate: r.rate,
      church: { reformed: r.reformed, catholic: r.catholic, christCatholic: r.christCatholic },
      extra: names.map((n, k) => ({ ...n, rate: values[k] })),
    };
  });
  if (extras.size) {
    throw new Error(
      `${LIST(year)}: Zusatzkirchen of communes not in the table: ${[...extras.keys()].join(', ')}.`,
    );
  }

  const out = path.join(root, 'packages', 'rules-ag', 'src', String(year), 'communes.ts');
  const ts = await prettier.format(source(year, communes), {
    ...(await prettier.resolveConfig(out)),
    parser: 'typescript',
  });
  if (check) {
    const current = await readFile(out, 'utf8').catch(() => '');
    if (current !== ts) {
      differs = true;
      console.error(`${path.relative(root, out)} differs from ${LIST(year)}.`);
    } else {
      console.log(
        `${path.relative(root, out)}: same as ${LIST(year)} (${communes.length} communes).`,
      );
    }
  } else {
    await writeFile(out, ts);
    console.log(
      `${path.relative(root, out)}: ${communes.length} communes, cantonal Steuerfuss ${canton} %.`,
    );
  }
}
if (differs) process.exit(1);
