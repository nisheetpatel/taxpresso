#!/usr/bin/env node
// Turns Basel-Stadt's table of tax rates (Verzeichnis der Ansätze, Devisenkurse, Abzüge und
// Freibeträge, 18000.a.01.<yy>) into packages/rules-bs/src/<year>/communes.ts: for each of the
// canton's three communes the canton's share of the income and wealth tax computed under the tax
// law, and the commune's own multipliers (Steuerfuss) in percent of that tax, all stored in
// hundredths of a percent (37.50 -> 3750).
//
// How the tax is split (bs-na-law-stg § 2 al. 2 and 3, p. 1; § 228 al. 1, p. 73): the city of
// Basel levies no communal tax, so the canton levies the full tax there; from the residents of
// Riehen and Bettingen the canton levies its share (Kantonssteuerquote, 50 %) and each commune
// levies its own tax in percent of the tax computed under the law.
//
// Input: docs/sources/bs/files/bs-<year>-communal-ansaetze-abzuege.pdf, downloaded by
// scripts/fetch-sources.mjs; its sha256 must match docs/sources/lock.json. The rows read, on the
// table's page 1: "Kantonaler Steuerfuss für Einkommenssteuer", "Steuerschlüssel für
// Einkommenssteuer (Kantonsanteil)", "Steuerfuss für Einkommenssteuer Einwohnergemeinde Bettingen"
// and "... Riehen", and the same three rows for the Vermögenssteuer, in the column of the table's
// own year (its first column). Values the table prints in italics are provisional ("Werte in
// kursiver Schrift = Provisorisch", p. 1): the script refuses them.
// Cross-checks: the next year's table must print the same values in its column for this year; for
// 2025, the tariff book (bs-2025-tariff-einkommens-vermoegenssteuer p. 2) must state the same
// shares and multipliers; for 2026, Bettingen's page (bs-2026-communal-bettingen-steuersaetze)
// must state the same multipliers for Bettingen. The PDFs are read with unpdf (packages/intake's
// dependency).
//
// Usage:
//   node scripts/bs-communes.mjs              every year in YEARS
//   node scripts/bs-communes.mjs --check      fail if the data differs from the files
//
// Dev tool. It never runs inside the extension, and the extension never reads these files.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as prettier from 'prettier';

const YEARS = [2025, 2026];
const TABLE = (year) => `bs-${year}-communal-ansaetze-abzuege`;
const TARIFF_2025 = 'bs-2025-tariff-einkommens-vermoegenssteuer';
const BETTINGEN_2026 = 'bs-2026-communal-bettingen-steuersaetze';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const filesDir = path.join(root, 'docs', 'sources', 'bs', 'files');

async function verified(id, ext, lock) {
  const file = path.join(filesDir, `${id}.${ext}`);
  const buf = await readFile(file).catch(() => {
    throw new Error(`${id}: run node scripts/fetch-sources.mjs --canton bs first.`);
  });
  const sha256 = createHash('sha256').update(buf).digest('hex');
  if (lock[id]?.status !== 'ok' || lock[id].sha256 !== sha256) {
    throw new Error(
      `${id}: the file differs from docs/sources/lock.json. Re-fetch, then re-check.`,
    );
  }
  return buf;
}

/** The text items of a PDF page as lines of { x, text, italic } cells, top to bottom. */
async function pdfLines(pdfjs, buf) {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: false,
    verbosity: 0,
  }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    // The fonts' names are known once the page's operators are read.
    await page.getOperatorList();
    const content = await page.getTextContent();
    const rows = [];
    for (const it of content.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const font = page.commonObjs.has(it.fontName) ? page.commonObjs.get(it.fontName) : null;
      const y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) <= 2);
      if (!row) rows.push((row = { y, cells: [] }));
      row.cells.push({
        x: it.transform[4],
        text: it.str.trim(),
        italic: /italic|oblique/i.test(font?.name ?? ''),
      });
    }
    rows.sort((a, b) => b.y - a.y);
    pages.push(rows.map((r) => r.cells.sort((a, b) => a.x - b.x)));
  }
  return pages;
}

const PERCENT = /^\d{1,3}\.\d{2}$/;
/** "37.50" -> 3750, "37.5" -> 3750, "50" -> 5000 (hundredths of a percent), exactly. */
function hundredths(s) {
  const [whole, fraction = ''] = s.split('.');
  if (fraction.length > 2) throw new Error(`${s}: more than two decimals.`);
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** The rows of the table's page 1 that the communes need, by label. */
const ROWS = {
  incomeCanton: 'Kantonaler Steuerfuss für Einkommenssteuer',
  incomeShare: 'Steuerschlüssel für Einkommenssteuer (Kantonsanteil)',
  incomeBettingen: 'Steuerfuss für Einkommenssteuer Einwohnergemeinde Bettingen',
  incomeRiehen: 'Steuerfuss für Einkommenssteuer Einwohnergemeinde Riehen',
  wealthShare: 'Steuerschlüssel für Vermögenssteuer (Kantonsanteil)',
  wealthBettingen: 'Steuerfuss für Vermögenssteuer Einwohnergemeinde Bettingen',
  wealthRiehen: 'Steuerfuss für Vermögenssteuer Einwohnergemeinde Riehen',
};

/**
 * The values of a table for one year: each row's cell in that year's column. The column is found
 * by the header "Steuerfaktoren ... Wert 2026 2025 ..." above the rows.
 */
function tableValues(pages, id, year) {
  const lines = pages[0];
  const header = lines.find((l) => l.some((c) => c.text === 'Steuerfaktoren'));
  const yearCell = header?.find((c) => c.text === String(year));
  if (!yearCell) throw new Error(`${id} p. 1: no column for ${year}.`);
  const out = {};
  for (const [key, label] of Object.entries(ROWS)) {
    const line = lines.find((l) =>
      l
        .map((c) => c.text)
        .join(' ')
        .startsWith(label),
    );
    if (!line) throw new Error(`${id} p. 1: no row "${label}".`);
    // The value under the year's header: the nearest number, at most a few points away.
    const cell = line
      .filter((c) => PERCENT.test(c.text))
      .sort((a, b) => Math.abs(a.x - yearCell.x) - Math.abs(b.x - yearCell.x))[0];
    if (!cell || Math.abs(cell.x - yearCell.x) > 15) {
      throw new Error(`${id} p. 1: "${label}" has no value for ${year}.`);
    }
    if (cell.italic) {
      throw new Error(`${id} p. 1: "${label}" ${year} is printed in italics (provisional).`);
    }
    out[key] = hundredths(cell.text);
  }
  if (out.incomeCanton !== 10_000) {
    throw new Error(`${id} p. 1: the cantonal Steuerfuss for ${year} is not 100 %.`);
  }
  return out;
}

function communesOf(v) {
  return [
    {
      name: 'Basel',
      cantonIncomeShare: 10_000,
      cantonWealthShare: 10_000,
      incomeRate: 0,
      wealthRate: 0,
    },
    {
      name: 'Riehen',
      cantonIncomeShare: v.incomeShare,
      cantonWealthShare: v.wealthShare,
      incomeRate: v.incomeRiehen,
      wealthRate: v.wealthRiehen,
    },
    {
      name: 'Bettingen',
      cantonIncomeShare: v.incomeShare,
      cantonWealthShare: v.wealthShare,
      incomeRate: v.incomeBettingen,
      wealthRate: v.wealthBettingen,
    },
  ];
}

/** The tariff book's page 2 states the 2025 shares and multipliers in words: "Riehen > 40.00 %". */
function tariffBookCheck(pages, v) {
  const text = pages[1]
    .map((l) => l.map((c) => c.text).join(' '))
    .join(' ')
    .replace(/\s+/g, ' ');
  // "Einkommenssteuer Kantonaler Steuerfuss > 100 % ... Riehen > 40.00 % Vermögenssteuer ...".
  const start = text.indexOf('Einkommenssteuer Kantonaler Steuerfuss');
  const split = text.indexOf('Vermögenssteuer Kantonaler Steuerfuss');
  if (start < 0 || split < 0)
    throw new Error(`${TARIFF_2025} p. 2: the rates are not where expected.`);
  const sections = { income: text.slice(start, split), wealth: text.slice(split) };
  for (const [section, key, re] of [
    ['income', 'incomeShare', /Kantonsanteil\) > (\d+(?:\.\d{2})?) %/],
    ['income', 'incomeBettingen', /Bettingen > (\d+\.\d{2})/],
    ['income', 'incomeRiehen', /Riehen > (\d+\.\d{2})/],
    ['wealth', 'wealthShare', /Kantonsanteil\) > (\d+(?:\.\d{2})?) %/],
    ['wealth', 'wealthBettingen', /Bettingen > (\d+\.\d{2})/],
    ['wealth', 'wealthRiehen', /Riehen > (\d+\.\d{2})/],
  ]) {
    const m = re.exec(sections[section]);
    if (!m || hundredths(m[1]) !== v[key]) {
      throw new Error(
        `${TARIFF_2025} p. 2: ${key} is ${m?.[1] ?? 'missing'}, the table says ${v[key]}.`,
      );
    }
  }
  if (
    !/Stadt Basel steuerpflichtigen Personen entrichten die vollen kantonalen Steuern/.test(text)
  ) {
    throw new Error(
      `${TARIFF_2025} p. 2: no longer says that Basel residents pay the full cantonal tax.`,
    );
  }
}

/** Bettingen's page states the 2026 multipliers: "Einkommenssteuer 37.5 % ... Vermögenssteuer 36.5 %". */
function bettingenCheck(html, v) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ');
  const income = /Einkommenssteuer (\d+(?:\.\d+)?) ?% der kantonalen Einkommenssteuer/.exec(text);
  const wealth = /Vermögenssteuer (\d+(?:\.\d+)?) ?% der kantonalen Vermögenssteuer/.exec(text);
  if (!income || hundredths(income[1]) !== v.incomeBettingen) {
    throw new Error(
      `${BETTINGEN_2026}: Bettingen's income multiplier is ${income?.[1]}, the table says ${v.incomeBettingen}.`,
    );
  }
  if (!wealth || hundredths(wealth[1]) !== v.wealthBettingen) {
    throw new Error(
      `${BETTINGEN_2026}: Bettingen's wealth multiplier is ${wealth?.[1]}, the table says ${v.wealthBettingen}.`,
    );
  }
}

function source(year, communes) {
  const law = year === 2025 ? 'bs-2025-law-stg' : 'bs-na-law-stg';
  const cross =
    year === 2025
      ? `${TARIFF_2025} p. 2 (Steuerberechnung)`
      : `${BETTINGEN_2026} (Steuersätze ${year})`;
  return (
    `// Basel-Stadt's communes for tax year ${year}: the canton's share of the income and wealth tax\n` +
    `// computed under the tax law (Kantonssteuerquote) and the commune's own multipliers (Steuerfuss)\n` +
    `// in percent of that tax, in hundredths of a percent (37.50 % -> 3750). Basel levies no communal\n` +
    `// tax: the canton levies the full tax there.\n` +
    `// Generated by scripts/bs-communes.mjs from ${TABLE(year)} p. 1; do not edit, re-run the script.\n` +
    `import type { Cited } from '@taxpresso/rules-ch';\n` +
    `import type { BsCommune } from '../communes.js';\n\n` +
    `export const COMMUNES_${year}: Cited<readonly BsCommune[]> = {\n` +
    `  source: '${TABLE(year)} p. 1 (Kantonaler Steuerfuss, Steuerschlüssel Kantonsanteil, Steuerfuss Einwohnergemeinde Bettingen und Riehen, ${year}); ${cross}; ${law} § 2 al. 2 and 3 (p. 1), § 228 al. 1 (p. 73)',\n` +
    `  value: ${JSON.stringify(communes)},\n};\n`
  );
}

const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));
const require = createRequire(path.join(root, 'packages', 'intake', 'package.json'));
const { getResolvedPDFJS } = await import(pathToFileURL(require.resolve('unpdf')).href);
const pdfjs = await getResolvedPDFJS();

const tables = new Map();
for (const year of YEARS) {
  tables.set(year, await pdfLines(pdfjs, await verified(TABLE(year), 'pdf', lock)));
}

let differs = false;
for (const year of YEARS) {
  const values = tableValues(tables.get(year), TABLE(year), year);
  // The next year's table prints this year's column again: the same values, final.
  if (tables.has(year + 1)) {
    const again = tableValues(tables.get(year + 1), TABLE(year + 1), year);
    if (JSON.stringify(again) !== JSON.stringify(values)) {
      throw new Error(`${TABLE(year + 1)} prints other ${year} values than ${TABLE(year)}.`);
    }
  }
  if (year === 2025)
    tariffBookCheck(await pdfLines(pdfjs, await verified(TARIFF_2025, 'pdf', lock)), values);
  if (year === 2026)
    bettingenCheck((await verified(BETTINGEN_2026, 'html', lock)).toString('utf8'), values);
  const communes = communesOf(values);
  const out = path.join(root, 'packages', 'rules-bs', 'src', String(year), 'communes.ts');
  const ts = await prettier.format(source(year, communes), {
    ...(await prettier.resolveConfig(out)),
    parser: 'typescript',
  });
  if (check) {
    const current = await readFile(out, 'utf8').catch(() => '');
    if (current !== ts) {
      differs = true;
      console.error(`${path.relative(root, out)} differs from ${TABLE(year)}.`);
    } else {
      console.log(
        `${path.relative(root, out)}: same as ${TABLE(year)} (${communes.length} communes).`,
      );
    }
  } else {
    await writeFile(out, ts);
    console.log(`${path.relative(root, out)}: ${communes.length} communes.`);
  }
}
if (differs) process.exit(1);
