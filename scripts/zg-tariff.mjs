#!/usr/bin/env node
// Checks Zug's tariffs in packages/rules-zg/src/<year>/tariffs.ts against the Steuerverwaltung's
// tariff sheets (docs/sources/zg/files/zg-2026-tariff-grundtarif.pdf and
// zg-2026-tariff-mehrpersonentarif.pdf: one page per tax period, 2026 first, then 2025, back to
// 2001).
//
// For each tax year and each sheet, the page titled "Kantonssteuer «Grundtarif» (or
// «Mehrpersonentarif») gültig Steuerperiode <year>" is read:
// - Einkommenssteuer: every row "Satz für die ersten / für die weiteren Stufe, Einkommen kumuliert,
//   Steuer pro Stufe, Einfache Steuer, Einfache Steuer in %", then "Satz über <amount>". The rates
//   and the cumulated amounts must equal INCOME_<year> (single for the Grundtarif, married for the
//   Mehrpersonentarif); the Stufe must be the difference of the cumulated amounts; and at each
//   cumulated amount packages/rules-zg/src/tariff.ts must give the printed Einfache Steuer to the
//   centime and its share to the four decimals printed.
// - Vermögenssteuer: the same, with WEALTH_<year> (both sheets print the same wealth tariff), the
//   share to five decimals.
// The index header of each part is printed, not checked: the sheets' labels differ between years
// and between the two sheets (docs/sources/zg/NOTES.md, Gaps).
//
// Each file's sha256 must match docs/sources/lock.json. The PDFs are read with unpdf (packages/
// intake's dependency); the TypeScript modules with Node's type stripping (they import types only).
//
// Usage:
//   node scripts/zg-tariff.mjs --check
//
// Dev tool. It never runs inside the extension, and the extension never reads these files.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const YEARS = [2025, 2026];
const SHEETS = [
  { id: 'zg-2026-tariff-grundtarif', name: 'Grundtarif', scale: 'single' },
  { id: 'zg-2026-tariff-mehrpersonentarif', name: 'Mehrpersonentarif', scale: 'married' },
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filesDir = path.join(root, 'docs', 'sources', 'zg', 'files');
if (!process.argv.includes('--check')) {
  console.error('Usage: node scripts/zg-tariff.mjs --check (the tariffs are written by hand).');
  process.exit(2);
}

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

/** Each page's lines, top to bottom, each line its items' text left to right. */
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

const num = (s) => Number(s.replace(/'/g, ''));
/** "1'800.00" -> 180000 centimes. */
const centimes = (s) => {
  const [int, dec = ''] = s.replace(/'/g, '').split('.');
  return Number(int) * 100 + Number(dec.padEnd(2, '0'));
};
/** "3.25%" -> 325 over 10,000; "0.0425%" -> 425 over 1,000,000. */
const rate = (s, denominator) =>
  Math.round(Number(s.replace('%', '')) * (denominator / 100) * 1e6) / 1e6;

/** The rows of one part (Einkommenssteuer or Vermögenssteuer) of a page. */
function part(lines, title, next, where) {
  const start = lines.findIndex((l) => l.startsWith(title));
  if (start < 0) throw new Error(`${where}: no "${title}".`);
  const end = next ? lines.findIndex((l, i) => i > start && l.startsWith(next)) : lines.length;
  const rows = [];
  let top = null;
  for (const l of lines.slice(start + 1, end < 0 ? lines.length : end)) {
    const m =
      /^([\d.]+%) für die (ersten|weiteren) ([\d']+) ([\d']+) ([\d'.]+) ([\d'.]+) ([\d.]+%)$/.exec(
        l,
      );
    if (m) {
      rows.push({
        rate: m[1],
        first: m[2] === 'ersten',
        step: num(m[3]),
        cumulated: num(m[4]),
        stepTax: centimes(m[5]),
        tax: centimes(m[6]),
        share: m[7],
      });
      continue;
    }
    const over = /^([\d.]+%) über ([\d']+)$/.exec(l);
    if (over) top = { rate: over[1], from: num(over[2]) };
  }
  const index = lines[start].slice(title.length).trim();
  if (!rows.length || !top) throw new Error(`${where}: "${title}" rows not found.`);
  return { rows, top, index };
}

function compare(rows, top, scale, simpleTax, decimals, where) {
  const fail = (what) => {
    throw new Error(`${where}: ${what}`);
  };
  if (rows.length + 1 !== scale.brackets.length) {
    fail(`${rows.length + 1} brackets printed, ${scale.brackets.length} in the module.`);
  }
  let previous = 0;
  let previousTax = 0;
  rows.forEach((r, i) => {
    const [upper, moduleRate] = scale.brackets[i];
    if (r.first !== (i === 0)) fail(`row ${i + 1}: "für die ersten" only on the first row.`);
    if (r.cumulated !== upper)
      fail(`row ${i + 1}: ${r.cumulated} printed, ${upper} in the module.`);
    if (r.step !== upper - previous)
      fail(`row ${i + 1}: Stufe ${r.step} is not ${upper - previous}.`);
    if (rate(r.rate, scale.denominator) !== moduleRate) {
      fail(`row ${i + 1}: rate ${r.rate} printed, ${moduleRate} in the module.`);
    }
    const tax = simpleTax(scale, upper * 100);
    if (tax !== r.tax) fail(`at ${upper}: Einfache Steuer ${r.tax} printed, ${tax} computed.`);
    if (r.stepTax !== tax - previousTax) fail(`at ${upper}: Steuer pro Stufe ${r.stepTax}.`);
    const share = ((tax / 100 / upper) * 100).toFixed(decimals);
    if (`${share}%` !== r.share) fail(`at ${upper}: ${r.share} printed, ${share}% computed.`);
    previous = upper;
    previousTax = tax;
  });
  const [lastUpper, lastRate] = scale.brackets[rows.length];
  if (lastUpper !== Number.POSITIVE_INFINITY || top.from !== previous) {
    fail(`the top rate starts at ${top.from}, the module's at ${previous}.`);
  }
  if (rate(top.rate, scale.denominator) !== lastRate) fail(`top rate ${top.rate} printed.`);
}

const require = createRequire(path.join(root, 'packages', 'intake', 'package.json'));
const { getResolvedPDFJS } = await import(pathToFileURL(require.resolve('unpdf')).href);
const pdfjs = await getResolvedPDFJS();
const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));
const src = path.join(root, 'packages', 'rules-zg', 'src');
const { simpleTax } = await import(pathToFileURL(path.join(src, 'tariff.ts')).href);

for (const sheet of SHEETS) {
  const pages = await pdfLines(pdfjs, await verified(sheet.id, lock));
  for (const year of YEARS) {
    const module = await import(pathToFileURL(path.join(src, String(year), 'tariffs.ts')).href);
    const title = `Kantonssteuer «${sheet.name}» gültig Steuerperiode ${year}`;
    const pageAt = pages.findIndex((lines) => lines.some((l) => l === title));
    if (pageAt < 0) throw new Error(`${sheet.id}: no page "${title}".`);
    const lines = pages[pageAt];
    const where = `${sheet.id} p. ${pageAt + 1} (${year})`;
    const income = part(lines, 'Einkommenssteuer', 'Vermögenssteuer', where);
    compare(
      income.rows,
      income.top,
      module[`INCOME_${year}`].value[sheet.scale],
      simpleTax,
      4,
      `${where}, Einkommenssteuer`,
    );
    const wealth = part(lines, 'Vermögenssteuer', null, where);
    compare(
      wealth.rows,
      wealth.top,
      module[`WEALTH_${year}`].value,
      simpleTax,
      5,
      `${where}, Vermögenssteuer`,
    );
    console.log(
      `${where}: ${income.rows.length + 1} income and ${wealth.rows.length + 1} wealth brackets match. ` +
        `Headers: ${income.index} / ${wealth.index}`,
    );
  }
}
