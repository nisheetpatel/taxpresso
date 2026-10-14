#!/usr/bin/env node
// Checks St. Gallen's income and wealth tariffs in packages/rules-sg/src/<year>/tariffs.ts against
// the canton's tariff of the year (Tarif <year>): docs/sources/sg/files/sg-<year>-tariff-einkommen-
// vermoegen.pdf, 105 pages.
//
// - Page 1, the rules: the top amount above which the whole income pays 8.5 percent, for single
//   taxpayers and with Vollsplitting (twice it), the rounding of the Rappen, the rate of half the
//   income rounded down to 100 francs for Vollsplitting, and the wealth tax of 1.7 per mille; each
//   must be what INCOME_<year> and WEALTH_<year> say.
// - Pages 2 to 105, the table: the einfache Steuer and its percentage for every 100 francs of taxable
//   income, for single taxpayers and with Vollsplitting. Every row, both columns and both
//   percentages, must equal what packages/rules-sg/src/tariff.ts computes with INCOME_<year>.
//
// The PDF's sha256 must match docs/sources/lock.json. It is read with unpdf (packages/intake's
// dependency). The TypeScript modules are read with Node's type stripping (they import types only).
//
// Usage:
//   node scripts/sg-tariff.mjs --check
//
// Dev tool. It never runs inside the extension, and the extension never reads these files.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const YEARS = [2025, 2026];
const PDF = (year) => `sg-${year}-tariff-einkommen-vermoegen`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filesDir = path.join(root, 'docs', 'sources', 'sg', 'files');
if (!process.argv.includes('--check')) {
  console.error('Usage: node scripts/sg-tariff.mjs --check (the tariff is written by hand).');
  process.exit(2);
}

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

/** The text of each page as lines (text items on the same baseline joined by a space). */
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
    pages.push(
      rows.map((r) =>
        r.cells
          .sort((a, b) => a.x - b.x)
          .map((c) => c.text)
          .join(' '),
      ),
    );
  }
  return pages;
}

/** "264'200" or "264’200" -> 264200. */
const francs = (s) => Number(s.replace(/['’]/g, ''));
/** "1’442.90" -> 144290 centimes. */
function centimesOf(s, where) {
  const m = /^(\d{1,3}(?:’\d{3})*)\.(\d{2})$/.exec(s);
  if (!m) throw new Error(`${where}: not an amount: ${JSON.stringify(s)}`);
  return francs(m[1]) * 100 + Number(m[2]);
}

function rulesPage(lines, year, income, wealth) {
  const id = PDF(year);
  const text = lines.join(' ');
  const need = [
    `Kanton St.Gallen Tarif ${year}`,
    'Die Prozentsätze sind mit vier Stellen nach dem Komma dargestellt.',
    'Die Rappen sind kaufmännisch gerundet.',
    'Der Steuersatz für gemeinsam Steuerpflichtige und alleinerziehende Personen entspricht dem Steuersatz für Alleinstehende auf der Hälfte des gesamten Einkommens (abgerundet auf hundert Franken).',
  ];
  for (const n of need) if (!text.includes(n)) throw new Error(`${id} p. 1: no "${n}".`);
  const couple =
    /höher als Fr\. ([\d'’]+) für gemeinsam Steuerpflichtige und alleinerziehende Personen, so beträgt die einfache Steuer für das ganze Einkommen (\d+\.\d) Prozent\./.exec(
      text,
    );
  const single =
    /\(Für alleinstehende Steuerpflichtige liegt diese Grenze bei Fr\. ([\d'’]+)\)/.exec(text);
  const w = /Die einfache Steuer vom Vermögen beträgt (\d+\.\d) Promille\./.exec(text);
  if (!couple || !single || !w) throw new Error(`${id} p. 1: the thresholds or rates moved.`);
  const checks = [
    ['top amount, single', francs(single[1]), income.topFrom],
    ['top amount, Vollsplitting', francs(couple[1]), 2 * income.topFrom],
    ['top rate (tenths of a percent)', Math.round(Number(couple[2]) * 10), income.topRate],
    ['wealth rate (tenths of a per mille)', Math.round(Number(w[1]) * 10), wealth.rate],
  ];
  for (const [what, printed, ours] of checks) {
    if (printed !== ours)
      throw new Error(`${id} p. 1: ${what} ${printed}, the module says ${ours}.`);
  }
}

const ROW = /^(\d{1,3}(?:’\d{3})*) (\S+) (\d+\.\d{4})% (\S+) (\d+\.\d{4})%$/;

function tableRows(pages, year) {
  const id = PDF(year);
  const rows = [];
  for (const [n, lines] of pages.entries()) {
    if (n === 0) continue;
    if (!lines.includes(`Kanton St.Gallen Tarif ${year}`)) {
      throw new Error(`${id} p. ${n + 1}: no heading.`);
    }
    for (const line of lines) {
      const m = ROW.exec(line);
      if (!m) continue;
      const where = `${id} p. ${n + 1} ${m[1]}`;
      rows.push({
        page: n + 1,
        income: francs(m[1]),
        single: centimesOf(m[2], where),
        singlePct: m[3],
        couple: centimesOf(m[4], where),
        couplePct: m[5],
      });
    }
  }
  return rows;
}

const require = createRequire(path.join(root, 'packages', 'intake', 'package.json'));
const { getResolvedPDFJS } = await import(pathToFileURL(require.resolve('unpdf')).href);
const pdfjs = await getResolvedPDFJS();
const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));
const src = path.join(root, 'packages', 'rules-sg', 'src');
const tariff = await import(pathToFileURL(path.join(src, 'tariff.ts')).href);

/** The rate as the table prints it: four decimals of a percent, halves up, without the sign. */
const pct = (rate) => tariff.ratePercent(rate, 'en').replace('\u00a0%', '');

let failed = false;
for (const year of YEARS) {
  const module = await import(pathToFileURL(path.join(src, String(year), 'tariffs.ts')).href);
  const income = module[`INCOME_${year}`].value;
  const wealth = module[`WEALTH_${year}`].value;
  const pages = await pdfLines(pdfjs, await verified(PDF(year), 'pdf', lock));
  rulesPage(pages[0], year, income, wealth);
  const rows = tableRows(pages, year);
  // Every 100 francs from the first row to the last, none missing or twice.
  const first = rows[0].income;
  rows.forEach((r, i) => {
    if (r.income !== first + 100 * i) {
      throw new Error(`${PDF(year)} p. ${r.page}: row ${r.income} out of order.`);
    }
  });
  const wrong = [];
  for (const r of rows) {
    const s = tariff.incomeTariffTax(income, r.income * 100, false);
    const c = tariff.incomeTariffTax(income, r.income * 100, true);
    const got = [s.tax, pct(s.rate), c.tax, pct(c.rate)];
    const printed = [r.single, r.singlePct, r.couple, r.couplePct];
    if (got.some((g, i) => g !== printed[i])) wrong.push({ ...r, got });
  }
  if (wrong.length) {
    failed = true;
    console.error(`${PDF(year)}: ${wrong.length} of ${rows.length} rows differ, the first ones:`);
    for (const w of wrong.slice(0, 10)) console.error(JSON.stringify(w));
  } else {
    const last = rows.at(-1).income;
    console.log(
      `${PDF(year)}: page 1 and all ${rows.length} rows (CHF ${first} to ${last}, single and Vollsplitting, amounts and percentages) equal packages/rules-sg/src/tariff.ts with INCOME_${year}.`,
    );
  }
}
if (failed) process.exit(1);
