#!/usr/bin/env node
// Checks Fribourg's income scale in packages/rules-fr/src/<year>/tariffs.ts against every row of the
// SCC's detailed tariff (barème détaillé, LICD art. 37 al. 1): docs/sources/fr/files/
// fr-<year>-bareme-revenu.pdf, 106 pages, one row per CHF 100 from 5,200 to 414,200, with the rate
// and the tax at 100 % for a single person and for a married couple or single parent.
//
// For each row and column it checks that:
// - the rate printed (four decimals of a percent) is the scale's: the class's start rate plus its
//   step per further CHF 100; for the second column, the rate of half the income in whole CHF 100,
//   never below the minimum rate (art. 37 al. 3);
// - the tax printed is income x rate rounded to the nearest 5 centimes, less 5 centimes exactly on
//   the rows the scale lists in `roundedDown` (exact halves the table rounds down), and on no other.
// It also checks that the rows are complete (every CHF 100) and that the last page states the top
// rate above the last row. The PDF's sha256 must match docs/sources/lock.json. Its text is read with
// unpdf (packages/intake's dependency); the scale is read from the TypeScript module with Node's
// type stripping (the module imports types only).
//
// Usage:
//   node scripts/fr-tariff.mjs --check
//
// Dev tool. It never runs inside the extension, and the extension never reads these files.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const YEARS = [2025, 2026];
const PDF = (year) => `fr-${year}-bareme-revenu`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filesDir = path.join(root, 'docs', 'sources', 'fr', 'files');
if (!process.argv.includes('--check')) {
  console.error('Usage: node scripts/fr-tariff.mjs --check (the scale is written by hand).');
  process.exit(2);
}

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

/** Each page's lines of text cells, top to bottom, cells left to right. */
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
    pages.push(rows.map((r) => r.cells.sort((a, b) => a.x - b.x).map((c) => c.text)));
  }
  return pages;
}

const ROW = /^\d{1,3}(?: \d{3})*$/;
const RATE = /^\d{1,2}\.\d{4}$/;
const TAX = /^\d{1,3}(?: \d{3})*\.\d{2}$/;
/** "1.0259" -> 10259; "55 917.00" -> 5591700. */
const tenThousandths = (s) => Number(s.replace('.', ''));
const centimes = (s) => Number(s.replace(/ /g, '').replace('.', ''));

function tableRows(pages, id) {
  const rows = [];
  let topRate = false;
  for (const [n, lines] of pages.entries()) {
    for (const cells of lines) {
      const text = cells.join(' ');
      if (/Pour les revenus supérieurs, l'impôt cantonal est calculé au taux de 13,5 %/.test(text))
        topRate = n + 1;
      // "5 200 | 1.0000 | Fr. | 52.00 | 1.0000 | Fr. | 52.00"
      if (cells.length !== 7 || !ROW.test(cells[0])) continue;
      const [income, r1, f1, t1, r2, f2, t2] = cells;
      if (!RATE.test(r1) || !RATE.test(r2) || f1 !== 'Fr.' || f2 !== 'Fr.')
        throw new Error(`${id} p. ${n + 1}: unexpected row ${JSON.stringify(cells)}.`);
      if (!TAX.test(t1) || !TAX.test(t2))
        throw new Error(`${id} p. ${n + 1}: unexpected tax in ${JSON.stringify(cells)}.`);
      rows.push({
        page: n + 1,
        chf: Number(income.replace(/ /g, '')),
        single: { rate: tenThousandths(r1), tax: centimes(t1) },
        family: { rate: tenThousandths(r2), tax: centimes(t2) },
      });
    }
  }
  if (!topRate) throw new Error(`${id}: the top rate above the last row is not stated.`);
  return rows;
}

// The scale's rules, as packages/rules-fr/src/tariff.ts applies them.
function classRate(scale, chf) {
  let rate = 0;
  for (const [from, start, per100] of scale.classes) {
    if (chf >= from) rate = start + Math.floor((chf - from) / 100) * per100;
  }
  return rate;
}
function rateOf(scale, chf, family) {
  if (chf < scale.threshold) return 0;
  if (!family) return classRate(scale, chf);
  const share = Math.floor((chf * scale.familyShareBp) / 10_000 / 100) * 100;
  return Math.max(classRate(scale, share), scale.minimumRate);
}
/** chf x rate / 10^4 centimes to the nearest 5 centimes, halves up (exact integers). */
const nearest5 = (chf, rate) => Math.floor((2 * chf * rate + 50_000) / 100_000) * 5;

const require = createRequire(path.join(root, 'packages', 'intake', 'package.json'));
const { getResolvedPDFJS } = await import(pathToFileURL(require.resolve('unpdf')).href);
const pdfjs = await getResolvedPDFJS();
const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));
let failed = false;
for (const year of YEARS) {
  const id = PDF(year);
  const module = path.join(root, 'packages', 'rules-fr', 'src', String(year), 'tariffs.ts');
  const scale = (await import(pathToFileURL(module).href))[`INCOME_${year}`].value;
  const rows = tableRows(await pdfLines(pdfjs, await verified(id, 'pdf', lock)), id);
  const problems = [];
  const expected = rows.map((r) => r.chf);
  for (let chf = scale.threshold, i = 0; chf <= scale.lastRow; chf += 100, i++) {
    if (expected[i] !== chf) {
      problems.push(`row ${i + 1}: expected CHF ${chf}, found ${expected[i]}`);
      break;
    }
  }
  if (rows.length !== (scale.lastRow - scale.threshold) / 100 + 1)
    problems.push(`${rows.length} rows, expected CHF ${scale.threshold} to ${scale.lastRow}`);
  const down = new Set(scale.roundedDown.map(([c, k]) => `${c} ${k}`));
  const seen = new Set();
  for (const r of rows) {
    for (const column of ['single', 'family']) {
      const rate = rateOf(scale, r.chf, column === 'family');
      const printed = r[column];
      if (printed.rate !== rate) {
        problems.push(`p. ${r.page}, CHF ${r.chf} ${column}: rate ${printed.rate}, scale ${rate}`);
        continue;
      }
      const exact = nearest5(r.chf, rate);
      const key = `${r.chf} ${column}`;
      if (down.has(key)) seen.add(key);
      const tax = down.has(key) ? exact - 5 : exact;
      if (printed.tax !== tax)
        problems.push(
          `p. ${r.page}, CHF ${r.chf} ${column}: tax ${printed.tax}, scale ${tax} (rounded ${exact})`,
        );
    }
  }
  for (const key of down) if (!seen.has(key)) problems.push(`roundedDown ${key}: no such row`);
  if (problems.length) {
    failed = true;
    console.error(`${id} differs from INCOME_${year}:\n  ${problems.join('\n  ')}`);
  } else {
    console.log(
      `${id}: all ${rows.length} rows, both columns, match INCOME_${year} (${scale.roundedDown.length} exact halves rounded down by the table).`,
    );
  }
}
if (failed) process.exit(1);
