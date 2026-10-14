#!/usr/bin/env node
// Checks Aargau's income and wealth tariffs in packages/rules-ag/src/<year>/tariffs.ts against the
// canton's tariff tables (both "gültig ab Steuerperiode 2025", the newest the canton lists for 2026
// too: ag-na-tariff-steuern-berechnen):
// - docs/sources/ag/files/ag-2025-tariff-einkommenssteuer.pdf: p. 1 prints the steps of the tariff
//   (1. Steuertarif), which must be INCOME_<year>'s; p. 3 to 70 print, for every CHF 100 up to
//   300,000 and then by larger steps up to 1,000,000, the einfache Steuer and its rate for Tarif A
//   and Tarif B. Every tax printed must equal incomeSimpleTax (packages/rules-ag/src/tariff.ts), and
//   every rate the exact tax over the income, rounded down to four decimals (the tables derive the
//   rate from the tax before it is rounded to the franc).
// - docs/sources/ag/files/ag-2025-tariff-vermoegenssteuer.pdf: p. 1 prints the steps (1. Steuer-
//   tarif), which must be WEALTH_<year>'s; p. 3 to 37 print the einfache Steuer to the centime and
//   its rate in per mille for each amount, which must equal wealthSimpleTax and the tax over the
//   wealth rounded down to four decimals.
// It also checks that the income rows are complete (every CHF 100 from 0 to 300,000). The PDFs'
// sha256 must match docs/sources/lock.json. Their text is read with unpdf (packages/intake's
// dependency); the TypeScript modules are read with Node's type stripping (they import types only).
//
// Usage:
//   node scripts/ag-tariff.mjs --check
//
// Dev tool. It never runs inside the extension, and the extension never reads these files.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const YEARS = [2025, 2026];
const INCOME_PDF = 'ag-2025-tariff-einkommenssteuer';
const WEALTH_PDF = 'ag-2025-tariff-vermoegenssteuer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filesDir = path.join(root, 'docs', 'sources', 'ag', 'files');
if (!process.argv.includes('--check')) {
  console.error('Usage: node scripts/ag-tariff.mjs --check (the tariffs are written by hand).');
  process.exit(2);
}

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

/** Each page's lines of text cells, top to bottom, cells left to right. */
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
    pages.push(rows.map((r) => r.cells.sort((a, b) => a.x - b.x).map((c) => c.text)));
  }
  return pages;
}

/** "830’000" -> 830000; "13215.30" -> 1321530 centimes when `centimes`. */
function amount(s, centimes = false) {
  const clean = s.replace(/[’']/g, '');
  if (centimes) {
    if (!/^\d+\.\d{2}$/.test(clean))
      throw new Error(`"${s}" is not an amount in francs and centimes.`);
    return Number(clean.replace('.', ''));
  }
  if (!/^\d+$/.test(clean)) throw new Error(`"${s}" is not a whole amount.`);
  return Number(clean);
}

/** Four decimals as an integer: "10.3062" -> 103062. */
function rate4(s) {
  if (!/^\d+\.\d{4}$/.test(s)) throw new Error(`"${s}" is not a rate with four decimals.`);
  return Number(s.replace('.', ''));
}

/** The steps printed on p. 1: "1 % für die weiteren … Fr. 3'800.–", with the rates as written. */
function printedSteps(page, unit, where) {
  const text = page.map((l) => l.join(' ')).join('\n');
  const re = new RegExp(
    `(\\d+(?:,\\d)?) ${unit}\\s+für (die ersten|die weiteren|${unit === '%' ? 'Einkommensteile' : 'Vermögensteile'} über)[^\\n]*?Fr\\.\\s*([\\d']+)`,
    'g',
  );
  const steps = [...text.matchAll(re)].map((m) => ({
    tenths: Math.round(Number(m[1].replace(',', '.')) * 10),
    kind: m[2],
    chf: Number(m[3].replace(/'/g, '')),
  }));
  if (steps.length < 2 || steps[0].kind !== 'die ersten' || !steps.at(-1).kind.endsWith('über')) {
    throw new Error(`${where}: cannot read the steps of the tariff.`);
  }
  return steps;
}

function compareSteps(printed, tariff, where) {
  const last = printed.at(-1);
  const steps = printed.slice(0, -1);
  const total = steps.reduce((s, x) => s + x.chf, 0);
  const ok =
    steps.length === tariff.steps.length &&
    steps.every((x, i) => tariff.steps[i][0] === x.chf && tariff.steps[i][1] === x.tenths) &&
    last.chf === total &&
    last.tenths === tariff.above;
  if (!ok) throw new Error(`${where}: the printed steps differ from the module's.`);
}

const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));
const require = createRequire(path.join(root, 'packages', 'intake', 'package.json'));
const { getResolvedPDFJS } = await import(pathToFileURL(require.resolve('unpdf')).href);
const pdfjs = await getResolvedPDFJS();
const tariffModule = await import(
  pathToFileURL(path.join(root, 'packages', 'rules-ag', 'src', 'tariff.ts')).href
);
const { incomeSimpleTax, tariffFraction, wealthSimpleTax } = tariffModule;

const incomePages = await pdfLines(pdfjs, await verified(INCOME_PDF, lock));
const wealthPages = await pdfLines(pdfjs, await verified(WEALTH_PDF, lock));

/** Rows of six cells on the table pages (p. 3 on). */
function tableRows(pages, centimes) {
  const rows = [];
  for (const page of pages.slice(2)) {
    for (const cells of page) {
      if (cells.length !== 6 || !/^\d/.test(cells[0]) || !/^\d+\.\d{4}$/.test(cells[2])) continue;
      for (const half of [cells.slice(0, 3), cells.slice(3)]) {
        rows.push({
          base: amount(half[0]),
          tax: amount(half[1], centimes),
          rate: rate4(half[2]),
        });
      }
    }
  }
  return rows;
}

const incomeRows = { A: [], B: [] };
for (const page of incomePages.slice(2)) {
  for (const cells of page) {
    if (cells.length !== 6 || !/^\d/.test(cells[0]) || !/^\d+\.\d{4}$/.test(cells[2])) continue;
    incomeRows.A.push({ base: amount(cells[0]), tax: amount(cells[1]), rate: rate4(cells[2]) });
    incomeRows.B.push({ base: amount(cells[3]), tax: amount(cells[4]), rate: rate4(cells[5]) });
  }
}
for (const tarif of ['A', 'B']) {
  const bases = new Set(incomeRows[tarif].map((r) => r.base));
  for (let y = 0; y <= 300_000; y += 100) {
    if (!bases.has(y)) throw new Error(`${INCOME_PDF}: Tarif ${tarif} has no row for ${y}.`);
  }
}
const wealthRows = tableRows(wealthPages, true);

for (const year of YEARS) {
  const mod = await import(
    pathToFileURL(path.join(root, 'packages', 'rules-ag', 'src', String(year), 'tariffs.ts')).href
  );
  const income = mod[`INCOME_${year}`].value;
  const wealth = mod[`WEALTH_${year}`].value;
  compareSteps(
    printedSteps(incomePages[0], '%', `${INCOME_PDF} p. 1`),
    income,
    `${INCOME_PDF} p. 1`,
  );
  compareSteps(
    printedSteps(wealthPages[0], '‰', `${WEALTH_PDF} p. 1`),
    wealth,
    `${WEALTH_PDF} p. 1`,
  );

  let n = 0;
  for (const tarif of ['A', 'B']) {
    for (const r of incomeRows[tarif]) {
      const c = r.base * 100;
      const tax = incomeSimpleTax(income, c, tarif);
      // The exact tax, numerator over denominator in centimes, over the income: a percentage.
      const num = BigInt(
        tarif === 'A' ? tariffFraction(income, c) : 2 * tariffFraction(income, c / 2),
      );
      const rate = c === 0 ? 0n : (num * 1_000_000n) / (BigInt(income.denominator) * BigInt(c));
      if (tax !== r.tax * 100 || Number(rate) !== r.rate) {
        throw new Error(
          `${INCOME_PDF}: Tarif ${tarif} at ${r.base} prints ${r.tax} at ${r.rate / 10_000} %, the module gives ${tax / 100} at ${Number(rate) / 10_000} % (${year}).`,
        );
      }
      n++;
    }
  }
  let m = 0;
  for (const r of wealthRows) {
    const c = r.base * 100;
    const tax = wealthSimpleTax(wealth, c);
    const rate = c === 0 ? 0 : Math.floor((tax * 10_000_000) / c);
    if (tax !== r.tax || rate !== r.rate) {
      throw new Error(
        `${WEALTH_PDF}: at ${r.base} prints ${r.tax / 100} at ${r.rate / 10_000} per mille, the module gives ${tax / 100} at ${rate / 10_000} (${year}).`,
      );
    }
    m++;
  }
  console.log(
    `${year}: INCOME_${year} and WEALTH_${year} match the printed steps, ${n} income rows (Tarif A and B) and ${m} wealth rows.`,
  );
}
