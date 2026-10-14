#!/usr/bin/env node
// Turns Fribourg's official tables of communal and parish tax coefficients into
// packages/rules-fr/src/<year>/communes.ts: for each commune of the year its federal number (BFS),
// its name and district, its coefficient on the income and wealth tax in percent of the cantonal
// base tax (impôt cantonal de base; the same for income and wealth, LICo art. 3 al. 3 and art. 4
// al. 3), and the Roman Catholic and Evangelical Reformed parishes that cover it, each with its
// coefficients on income and on wealth. Percentages are stored in hundredths (74.3 -> 7430).
//
// Inputs, downloaded by scripts/fetch-sources.mjs into docs/sources/fr/files (each sha256 must
// match docs/sources/lock.json):
// - 2025: fr-2025-communal-coefficients-opendata.csv (open data export of dataset
//   18_03_coefficients for 2025: annee;commune;commune_id;district;coefficients;valeur;unite, five
//   rows per commune; the one read is "Impôt sur le revenu et la fortune, en % de l’impôt cantonal
//   de base", unit %), and the SCC's parish tables fr-2025-parish-coefficients-catholic.pdf and
//   fr-2025-parish-coefficients-reformed.pdf ("état au 1er août 2025": per commune, one row per
//   parish, the income and wealth coefficients of natural persons first). The PDFs carry no BFS
//   number: their communes are matched to the CSV's by name (a bilingual name such as
//   "Murten / Morat" matches either part), and every commune must be found in both. Their text is
//   read with unpdf (packages/intake's dependency).
// - 2026: fr-2026-parish-coefficients-catholic-opendata.csv and
//   fr-2026-parish-coefficients-reformed-opendata.csv (open data exports for 2026, with commune_id),
//   which also give the communes of 2026 (Fétigny-Ménières appears in place of Fétigny and
//   Ménières; Ulmiz is not listed any more). No document of the sources library gives the communal coefficients for 2026:
//   the open data dataset of communal coefficients stops at 2025. Each 2026 commune's rate is null,
//   and the engine does not compute the tax for 2026 until a table is published and added here.
//
// Usage:
//   node scripts/fr-communes.mjs              every year in YEARS
//   node scripts/fr-communes.mjs --check      fail if the data differs from the files
//
// Dev tool. It never runs inside the extension, and the extension never reads these files.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as prettier from 'prettier';

const YEARS = [2025, 2026];
const COMMUNAL_2025 = 'fr-2025-communal-coefficients-opendata';
const COMMUNAL_COEFFICIENT = 'Impôt sur le revenu et la fortune, en % de l’impôt cantonal de base';
const PARISH_PDF = {
  catholic: 'fr-2025-parish-coefficients-catholic',
  reformed: 'fr-2025-parish-coefficients-reformed',
};
const PARISH_CSV = {
  catholic: 'fr-2026-parish-coefficients-catholic-opendata',
  reformed: 'fr-2026-parish-coefficients-reformed-opendata',
};
const PARISH_COLUMN = { catholic: 'paroisse_catholique', reformed: 'paroisse_reformee' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const filesDir = path.join(root, 'docs', 'sources', 'fr', 'files');

async function verified(id, ext, lock) {
  const file = path.join(filesDir, `${id}.${ext}`);
  const buf = await readFile(file).catch(() => {
    throw new Error(`${id}: run node scripts/fetch-sources.mjs --canton fr first.`);
  });
  const sha256 = createHash('sha256').update(buf).digest('hex');
  if (lock[id]?.status !== 'ok' || lock[id].sha256 !== sha256) {
    throw new Error(
      `${id}: the file differs from docs/sources/lock.json. Re-fetch, then re-check.`,
    );
  }
  return buf;
}

/** A semicolon CSV with a header row (no quoted semicolons in these exports), BOM dropped. */
function csvRows(buf, id) {
  const lines = buf
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(Boolean);
  const header = lines[0].split(';');
  return lines.slice(1).map((line, i) => {
    const cells = line.split(';');
    if (cells.length !== header.length)
      throw new Error(`${id} line ${i + 2}: ${cells.length} cells.`);
    return Object.fromEntries(header.map((h, k) => [h, cells[k]]));
  });
}

/** A percentage as printed ("74.3", "8.0") in hundredths, exactly. */
function hundredths(value, where) {
  const n = Number(value);
  const scaled = Math.round(n * 100);
  if (!/^\d+(\.\d+)?$/.test(value) || n <= 0 || n > 125 || Math.abs(n * 100 - scaled) > 1e-6) {
    throw new Error(`${where}: not a coefficient: ${JSON.stringify(value)}`);
  }
  return scaled;
}

const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** The 2025 communes and their coefficients, from the open data export. */
function communal2025(rows) {
  const id = COMMUNAL_2025;
  const communes = new Map();
  for (const [i, r] of rows.entries()) {
    if (r.annee !== '2025') throw new Error(`${id} line ${i + 2}: year ${r.annee}.`);
    if (r.coefficients !== COMMUNAL_COEFFICIENT) continue;
    if (r.unite !== '%') throw new Error(`${id} line ${i + 2}: unit ${r.unite}.`);
    const bfs = Number(r.commune_id);
    if (!Number.isInteger(bfs) || bfs < 2000 || bfs > 2400)
      throw new Error(`${id} line ${i + 2}: commune_id ${r.commune_id}.`);
    if (communes.has(bfs)) throw new Error(`${id}: commune ${bfs} twice.`);
    communes.set(bfs, {
      bfs,
      name: r.commune.trim(),
      district: r.district.trim(),
      rate: hundredths(r.valeur, `${id} line ${i + 2} (${r.commune})`),
      catholic: [],
      reformed: [],
    });
  }
  if (communes.size < 100) throw new Error(`${id}: only ${communes.size} communes read.`);
  return communes;
}

/** Each page's lines of text cells, top to bottom, cells left to right with their x. */
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
      row.cells.push({ x: it.transform[4], text: it.str.replace(/\s+/g, ' ').trim() });
    }
    rows.sort((a, b) => b.y - a.y);
    pages.push(rows.map((r) => r.cells.sort((a, b) => a.x - b.x)));
  }
  return pages;
}

const NUMBER = /^\d{1,3}\.\d$/;

/**
 * The parish rows of a PDF table: [{ commune, parish, income, wealth, page }]. A row has the
 * commune's name in the first column (or none, for a further parish of the commune above), the
 * parish in the second, then four coefficients: income and wealth of natural persons, profit and
 * capital of legal persons.
 */
function parishRows(pages, id) {
  const out = [];
  for (const [n, lines] of pages.entries()) {
    const header = lines.find((l) => l.some((c) => c.text === 'Commune / Gemeinde'));
    if (!header) throw new Error(`${id} p. ${n + 1}: no header row.`);
    const cx = header.find((c) => c.text === 'Commune / Gemeinde').x;
    const px = header.find((c) => c.text === 'Paroisse / Pfarrei')?.x;
    if (px === undefined) throw new Error(`${id} p. ${n + 1}: no parish column.`);
    let commune = out.at(-1)?.commune;
    for (const cells of lines) {
      const numbers = cells.filter((c) => NUMBER.test(c.text));
      if (numbers.length === 0) continue;
      if (numbers.length !== 4) throw new Error(`${id} p. ${n + 1}: row ${JSON.stringify(cells)}.`);
      const name = cells.find((c) => Math.abs(c.x - cx) < 5 && !NUMBER.test(c.text));
      const parish = cells.find((c) => Math.abs(c.x - px) < 5 && !NUMBER.test(c.text));
      if (!parish) throw new Error(`${id} p. ${n + 1}: no parish in ${JSON.stringify(cells)}.`);
      if (name) commune = name.text;
      if (!commune) throw new Error(`${id} p. ${n + 1}: a parish before any commune.`);
      const where = `${id} p. ${n + 1} (${commune}, ${parish.text})`;
      out.push({
        commune,
        parish: parish.text,
        income: hundredths(numbers[0].text, where),
        wealth: hundredths(numbers[1].text, where),
        page: n + 1,
      });
    }
  }
  return out;
}

/** The commune of the CSV a PDF name stands for: the same name, or one part of "French / German". */
function matchCommune(communes, pdfName, where) {
  const parts = [pdfName, ...pdfName.split(' / ')].map(fold);
  const found = [...communes.values()].filter((c) => parts.includes(fold(c.name)));
  if (found.length !== 1) throw new Error(`${where}: ${found.length} communes named ${pdfName}.`);
  return found[0];
}

function addParish(list, parish, where) {
  if (list.some((p) => fold(p.name) === fold(parish.name)))
    throw new Error(`${where}: parish ${parish.name} twice.`);
  list.push(parish);
}

async function year2025(lock, pdfjs) {
  const communes = communal2025(csvRows(await verified(COMMUNAL_2025, 'csv', lock), COMMUNAL_2025));
  const pages = {};
  for (const [confession, id] of Object.entries(PARISH_PDF)) {
    const rows = parishRows(await pdfLines(pdfjs, await verified(id, 'pdf', lock)), id);
    pages[confession] = [...new Set(rows.map((r) => r.page))];
    for (const r of rows) {
      const where = `${id} p. ${r.page}`;
      const commune = matchCommune(communes, r.commune, where);
      addParish(commune[confession], { name: r.parish, income: r.income, wealth: r.wealth }, where);
    }
  }
  for (const c of communes.values()) {
    for (const confession of Object.keys(PARISH_PDF)) {
      if (!c[confession].length) throw new Error(`${c.name}: no ${confession} parish in 2025.`);
    }
  }
  const list = [...communes.values()].sort((a, b) => a.bfs - b.bfs);
  const source =
    `${COMMUNAL_2025} (coefficient "Impôt sur le revenu et la fortune, en % de l’impôt cantonal de base"); ` +
    `${PARISH_PDF.catholic} p. ${pages.catholic.join(', ')}; ${PARISH_PDF.reformed} p. ${pages.reformed.join(', ')}; ` +
    'fr-na-law-lico art. 3 al. 3, art. 4 al. 1 and 3 (p. 2)';
  return { list, source };
}

async function year2026(lock) {
  const communes = new Map();
  for (const [confession, id] of Object.entries(PARISH_CSV)) {
    const seen = new Set();
    for (const [i, r] of csvRows(await verified(id, 'csv', lock), id).entries()) {
      const where = `${id} line ${i + 2}`;
      if (r.annee !== '2026') throw new Error(`${where}: year ${r.annee}.`);
      const bfs = Number(r.commune_id);
      if (!Number.isInteger(bfs) || bfs < 2000 || bfs > 2400)
        throw new Error(`${where}: commune_id ${r.commune_id}.`);
      seen.add(bfs);
      let commune = communes.get(bfs);
      if (!commune) {
        if (confession !== 'catholic')
          throw new Error(`${where}: commune ${bfs} not in ${PARISH_CSV.catholic}.`);
        commune = {
          bfs,
          name: r.commune.trim(),
          district: r.district.trim(),
          rate: null,
          catholic: [],
          reformed: [],
        };
        communes.set(bfs, commune);
      }
      if (commune.name !== r.commune.trim() || commune.district !== r.district.trim())
        throw new Error(`${where}: ${r.commune} (${r.district}) differs from ${commune.name}.`);
      addParish(
        commune[confession],
        {
          name: r[PARISH_COLUMN[confession]].trim(),
          income: hundredths(r.coefficient_impot_revenu, where),
          wealth: hundredths(r.coefficient_impot_fortune, where),
        },
        where,
      );
    }
    if (seen.size !== communes.size)
      throw new Error(`${id}: ${seen.size} communes, not ${communes.size}.`);
  }
  if (communes.size < 100) throw new Error(`2026: only ${communes.size} communes read.`);
  const list = [...communes.values()].sort((a, b) => a.bfs - b.bfs);
  const source =
    `${PARISH_CSV.catholic} (columns commune_id, commune, district, paroisse_catholique, coefficient_impot_revenu, coefficient_impot_fortune); ` +
    `${PARISH_CSV.reformed} (the same, paroisse_reformee); no communal coefficient for 2026 in the sources library`;
  return { list, source };
}

function source(year, { list, source: cited }) {
  return (
    `// Fribourg's communes for tax year ${year}: the federal number (BFS), the name and district, the\n` +
    `// communal coefficient on the income and wealth tax in hundredths of a percent of the cantonal\n` +
    `// base tax (74.3 % -> 7430; null: not published for the year), and the Roman Catholic and\n` +
    `// Evangelical Reformed parishes with their coefficients on income and on wealth.\n` +
    `// Generated by scripts/fr-communes.mjs; do not edit, re-run the script.\n` +
    `import type { Cited } from '@taxpresso/rules-ch';\n` +
    `import type { FrCommune } from '../communes.js';\n\n` +
    `export const COMMUNES_${year}: Cited<readonly FrCommune[]> = {\n` +
    `  source: ${JSON.stringify(cited)},\n` +
    `  value: ${JSON.stringify(list)},\n};\n`
  );
}

const require = createRequire(path.join(root, 'packages', 'intake', 'package.json'));
const { getResolvedPDFJS } = await import(pathToFileURL(require.resolve('unpdf')).href);
const pdfjs = await getResolvedPDFJS();
const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));
let differs = false;
for (const year of YEARS) {
  const data = year === 2025 ? await year2025(lock, pdfjs) : await year2026(lock);
  const out = path.join(root, 'packages', 'rules-fr', 'src', String(year), 'communes.ts');
  const ts = await prettier.format(source(year, data), {
    ...(await prettier.resolveConfig(out)),
    parser: 'typescript',
  });
  const parishes = data.list.reduce((s, c) => s + c.catholic.length + c.reformed.length, 0);
  if (check) {
    const current = await readFile(out, 'utf8').catch(() => '');
    if (current !== ts) {
      differs = true;
      console.error(`${path.relative(root, out)} differs from the official tables.`);
    } else {
      console.log(
        `${path.relative(root, out)}: same as the official tables (${data.list.length} communes).`,
      );
    }
  } else {
    await writeFile(out, ts);
    console.log(
      `${path.relative(root, out)}: ${data.list.length} communes, ${parishes} parish rows.`,
    );
  }
}
if (differs) process.exit(1);
