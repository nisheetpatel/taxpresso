#!/usr/bin/env node
// Turns Ticino's table of communal multipliers (Moltiplicatori d'imposta comunali, an html page of
// the Divisione delle contribuzioni) into packages/rules-ti/src/<year>/communes.ts: for each commune
// with a multiplier in the year, its name as the table prints it and its multiplier for natural
// persons (PF) in hundredths of a percent of the cantonal base tax (77 % -> 7700).
//
// How the communal tax is computed (ti-na-law-lt-640-100 art. 276 cpv. 1 and 2): the commune
// applies its multiplier to the cantonal base tax (imposta cantonale base) of the same year. The
// commune that levies it is the one of residence at the end of the tax period (art. 277 cpv. 1).
//
// Input: docs/sources/ti/files/ti-<year>-communal-rates.html, downloaded by
// scripts/fetch-sources.mjs; its sha256 must match docs/sources/lock.json. The page holds one table
// with a column per year (2021 to 2026); each cell gives the PF multiplier, a line break, then the
// PG multiplier (legal persons), and is empty for a year in which the commune did not exist
// (communes merge: LEMA has a value for 2026 only, TRESA from 2022, VAL MARA from 2023). The list of
// a year is the communes with a PF value in that year's column. The page lists today's communes:
// a commune that existed in a year and was later merged into another is not on it, and is
// therefore unknown for that year (fail closed).
// Cross-check: the 2025 and 2026 entries are snapshots of the same page; both must give the same
// table, and every value must be a whole or decimal percentage.
//
// Usage:
//   node scripts/ti-communes.mjs              every year in YEARS
//   node scripts/ti-communes.mjs --check      fail if the data differs from the files
//
// Dev tool. It never runs inside the extension, and the extension never reads these files.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';

const YEARS = [2025, 2026];
const PAGE = (year) => `ti-${year}-communal-rates`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const filesDir = path.join(root, 'docs', 'sources', 'ti', 'files');

async function verified(id, lock) {
  const file = path.join(filesDir, `${id}.html`);
  const buf = await readFile(file).catch(() => {
    throw new Error(`${id}: run node scripts/fetch-sources.mjs --canton ti first.`);
  });
  const sha256 = createHash('sha256').update(buf).digest('hex');
  if (lock[id]?.status !== 'ok' || lock[id].sha256 !== sha256) {
    throw new Error(
      `${id}: the file differs from docs/sources/lock.json. Re-fetch, then re-check.`,
    );
  }
  return buf.toString('utf8');
}

const ENTITIES = { amp: '&', apos: "'", quot: '"', lt: '<', gt: '>', nbsp: ' ' };
function text(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, e) => ENTITIES[e.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/** "77" -> 7700, "77.5" -> 7750 (hundredths of a percent), exactly; "" -> null. */
function hundredths(s, where) {
  if (s === '') return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) throw new Error(`${where}: "${s}" is not a percentage.`);
  const [whole, fraction = ''] = s.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** The table of the page: { years, rows: [{ name, pf: { [year]: hundredths | null } }] }. */
function parseTable(html, id) {
  const tables = html.match(/<table[\s\S]*?<\/table>/g) ?? [];
  const table = tables.find((t) => t.includes('moltiplicatore-table'));
  if (!table || tables.length !== 1) throw new Error(`${id}: expected one multiplier table.`);
  const head = table.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] ?? '';
  const headers = [...head.matchAll(/<th>([\s\S]*?)<\/th>/g)].map((m) => text(m[1]));
  if (headers[0] !== "Moltiplicatori d'imposta (in %)") {
    throw new Error(`${id}: the table's first heading is "${headers[0]}".`);
  }
  const years = headers.slice(2).map(Number);
  if (!years.length || years.some((y) => !Number.isInteger(y))) {
    throw new Error(`${id}: the year headings are not years: ${headers.join(' | ')}.`);
  }
  const body = table.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  const rows = [];
  for (const tr of body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...tr[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (!cells.length) continue;
    const name = text(cells[0]);
    if (text(cells[1]) !== '(PF) (PG)') throw new Error(`${id}: ${name} is not a PF / PG row.`);
    const values = cells.slice(2);
    if (values.length !== years.length) {
      throw new Error(`${id}: ${name} has ${values.length} values for ${years.length} years.`);
    }
    const pf = {};
    values.forEach((cell, i) => {
      const [first, second = ''] = cell.split(/<br\s*\/?>/);
      const value = hundredths(text(first), `${id} ${name} ${years[i]} PF`);
      // The PG value is not used, but a cell must have both or neither.
      const pg = hundredths(text(second), `${id} ${name} ${years[i]} PG`);
      if ((value === null) !== (pg === null)) {
        throw new Error(`${id}: ${name} ${years[i]} has a PF or a PG value, not both.`);
      }
      pf[years[i]] = value;
    });
    rows.push({ name, pf });
  }
  if (new Set(rows.map((r) => r.name)).size !== rows.length) {
    throw new Error(`${id}: a commune is listed twice.`);
  }
  return { years, rows };
}

function source(year, communes) {
  return (
    `// Ticino's communes for tax year ${year}: each commune with a multiplier for natural persons (PF)\n` +
    `// in ${year}, by its name as the official table prints it, and the multiplier in hundredths of a\n` +
    `// percent of the cantonal base tax (77 % -> 7700).\n` +
    `// Generated by scripts/ti-communes.mjs from ${PAGE(year)}; do not edit, re-run the script.\n` +
    `import type { Cited } from '@taxpresso/rules-ch';\n` +
    `import type { TiCommune } from '../communes.js';\n\n` +
    `export const COMMUNES_${year}: Cited<readonly TiCommune[]> = {\n` +
    `  source: '${PAGE(year)} (Moltiplicatori d’imposta comunali, column ${year}, PF); ti-na-law-lt-640-100 art. 276 cpv. 1 and 2, art. 277 cpv. 1',\n` +
    `  value: ${JSON.stringify(communes)},\n};\n`
  );
}

const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));
const pages = new Map();
for (const year of YEARS) pages.set(year, parseTable(await verified(PAGE(year), lock), PAGE(year)));
// The pages are the same table fetched twice: they must agree.
const [first, ...others] = YEARS.map((y) => JSON.stringify(pages.get(y)));
if (others.some((o) => o !== first)) {
  throw new Error(`${YEARS.map(PAGE).join(' and ')} give different tables.`);
}

let differs = false;
for (const year of YEARS) {
  const { years, rows } = pages.get(year);
  if (!years.includes(year)) throw new Error(`${PAGE(year)}: no column for ${year}.`);
  const communes = rows
    .filter((r) => r.pf[year] !== null)
    .map((r) => ({ name: r.name, rate: r.pf[year] }));
  const out = path.join(root, 'packages', 'rules-ti', 'src', String(year), 'communes.ts');
  const ts = await prettier.format(source(year, communes), {
    ...(await prettier.resolveConfig(out)),
    parser: 'typescript',
  });
  if (check) {
    const current = await readFile(out, 'utf8').catch(() => '');
    if (current !== ts) {
      differs = true;
      console.error(`${path.relative(root, out)} differs from ${PAGE(year)}.`);
    } else {
      console.log(
        `${path.relative(root, out)}: same as ${PAGE(year)} (${communes.length} communes).`,
      );
    }
  } else {
    await writeFile(out, ts);
    console.log(`${path.relative(root, out)}: ${communes.length} communes.`);
  }
}
if (differs) process.exit(1);
