#!/usr/bin/env node
// Checks Lucerne's income tariffs in packages/rules-lu/src/<year>/tariffs.ts against the canton's
// two official tariff documents of the year (docs/sources/lu/files):
//
// - lu-<year>-tariff-tariftabellen-abzuege.pdf, page 1 (Tariftabellen <year>): for single persons
//   (§ 57 Abs. 1 StG) and families (§ 57 Abs. 2), each step's rate and width ("0,50 Prozent der
//   nächsten: CHF 2'400.-") and the income above which one rate applies to the whole income ("Bei
//   Einkommen über 2 093 000 Franken beträgt die Steuer je Einheit 5,7 Prozent des Einkommens").
//   Each must equal INCOME_SINGLE_<year> and INCOME_FAMILY_<year>.
// - lu-<year>-tariff-berechnungstabelle-einkommen.pdf (Berechnungstabelle zu § 57, 402 pages): the
//   tax per unit (Steuer je Einheit) of both tariffs for every taxable income in steps of CHF 100.
//   Every row and both columns must equal what packages/rules-lu/src/tariff.ts computes.
//
// Each file's sha256 must match docs/sources/lock.json. The PDFs are read with unpdf
// (packages/intake's dependency); the TypeScript modules with Node's type stripping (they import
// types only).
//
// Usage:
//   node scripts/lu-tariff.mjs --check
//
// Dev tool. It never runs inside the extension, and the extension never reads these files.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const YEARS = [2025, 2026];
const TABLES = (year) => `lu-${year}-tariff-tariftabellen-abzuege`;
const ROWS = (year) => `lu-${year}-tariff-berechnungstabelle-einkommen`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filesDir = path.join(root, 'docs', 'sources', 'lu', 'files');
if (!process.argv.includes('--check')) {
  console.error('Usage: node scripts/lu-tariff.mjs --check (the tariffs are written by hand).');
  process.exit(2);
}

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

/** Each page's lines of text cells, top to bottom, cells left to right. */
async function pdfLines(pdfjs, buf, maxPages = Infinity) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
  const pages = [];
  for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
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
    pages.push(rows.map((r) => r.cells.sort((a, b) => a.x - b.x).map((c) => c.text)));
  }
  return pages;
}

/** "CHF 1'906’700.-" -> 1906700; "2 096 800" -> 2096800. */
const francs = (s) =>
  Number(
    s
      .replace(/^CHF /, '')
      .replace(/[.-]+$/, '')
      .replace(/['’ ]/g, ''),
  );
/** "5,25" -> 525: hundredths of a percent. */
const hundredths = (s) => {
  const [whole, dec = ''] = s.split(/[,.]/);
  return Number(whole) * 100 + Number(dec.padEnd(2, '0'));
};

/** The two tariffs as Tariftabellen <year> prints them on its first page. */
function printedTariffs(lines, id) {
  const tariffs = [];
  let current = null;
  for (const cells of lines) {
    const text = cells.join(' ');
    if (/^(Alleinstehende|Familien) \(§ 57 Abs\. [12] StG\)$/.test(text)) {
      current = { steps: [], flatAbove: null, flatRate: null };
      tariffs.push(current);
      continue;
    }
    const step = /^(\d,\d{2}) Prozent der (?:ersten|nächsten): (CHF [\d'’]+\.-)$/.exec(text);
    if (step && current) {
      current.steps.push([francs(step[2]), hundredths(step[1])]);
      continue;
    }
    const top =
      /^Bei Einkommen über ([\d ]+) Franken beträgt die Steuer je Einheit (\d,\d) Prozent des Einkommens\.$/.exec(
        text,
      );
    if (top && current) {
      current.flatAbove = francs(top[1]);
      current.flatRate = hundredths(top[2]);
    }
  }
  if (tariffs.length !== 2 || tariffs.some((t) => !t.steps.length || t.flatAbove === null))
    throw new Error(`${id} p. 1: two tariffs not found.`);
  return { single: tariffs[0], family: tariffs[1] };
}

const ROW = /^\d{4,7}$/;
const TAX = /^\d+\.\d{2}$/;
const PCT = /^\d\.\d{5}$/;
/** "119306.70" -> 11930670 centimes. */
const centimes = (s) => Number(s.replace('.', ''));

function tableRows(pages, id) {
  const rows = [];
  for (const [n, lines] of pages.entries()) {
    for (const cells of lines) {
      if (cells.length !== 5 || !ROW.test(cells[0])) continue;
      const [income, t1, p1, t2, p2] = cells;
      if (!TAX.test(t1) || !PCT.test(p1) || !TAX.test(t2) || !PCT.test(p2))
        throw new Error(`${id} p. ${n + 1}: unexpected row ${JSON.stringify(cells)}.`);
      rows.push({ page: n + 1, chf: Number(income), single: centimes(t1), family: centimes(t2) });
    }
  }
  return rows;
}

const require = createRequire(path.join(root, 'packages', 'intake', 'package.json'));
const { getResolvedPDFJS } = await import(pathToFileURL(require.resolve('unpdf')).href);
const pdfjs = await getResolvedPDFJS();
const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));
const { unitTaxFraction } = await import(
  pathToFileURL(path.join(root, 'packages', 'rules-lu', 'src', 'tariff.ts')).href
);
let failed = false;
for (const year of YEARS) {
  const module = path.join(root, 'packages', 'rules-lu', 'src', String(year), 'tariffs.ts');
  const ts = await import(pathToFileURL(module).href);
  const law = {
    single: ts[`INCOME_SINGLE_${year}`].value,
    family: ts[`INCOME_FAMILY_${year}`].value,
  };
  const problems = [];

  const tablesId = TABLES(year);
  const printed = printedTariffs(
    (await pdfLines(pdfjs, await verified(tablesId, 'pdf', lock), 1))[0],
    tablesId,
  );
  for (const kind of ['single', 'family']) {
    if (JSON.stringify(printed[kind].steps) !== JSON.stringify(law[kind].steps))
      problems.push(
        `${tablesId}: the ${kind} steps differ from INCOME_${kind.toUpperCase()}_${year}.`,
      );
    if (
      printed[kind].flatAbove !== law[kind].flatAbove ||
      printed[kind].flatRate !== law[kind].flatRate
    )
      problems.push(`${tablesId}: the ${kind} top rate differs.`);
  }

  const rowsId = ROWS(year);
  const rows = tableRows(await pdfLines(pdfjs, await verified(rowsId, 'pdf', lock)), rowsId);
  if (rows.length < 20_000) problems.push(`${rowsId}: only ${rows.length} rows read.`);
  for (const [i, r] of rows.entries()) {
    if (i > 0 && r.chf !== rows[i - 1].chf + 100) {
      problems.push(`${rowsId} p. ${r.page}: CHF ${r.chf} does not follow CHF ${rows[i - 1].chf}.`);
      break;
    }
    for (const kind of ['single', 'family']) {
      const expected = unitTaxFraction(law[kind], r.chf * 100) / 10_000;
      if (expected !== r[kind]) {
        problems.push(
          `${rowsId} p. ${r.page}: CHF ${r.chf} ${kind}: the table says ${r[kind]}, the tariff ${expected} (centimes).`,
        );
      }
    }
  }
  if (problems.length) {
    failed = true;
    for (const p of problems.slice(0, 20)) console.error(p);
  } else {
    console.log(
      `${year}: Tariftabellen ${year} gives the same steps; all ${rows.length} rows of the Berechnungstabelle (CHF ${rows[0].chf} to ${rows.at(-1).chf}) match, both tariffs.`,
    );
  }
}
if (failed) process.exit(1);
