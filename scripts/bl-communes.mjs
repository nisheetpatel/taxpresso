#!/usr/bin/env node
// Turns the table of tax rates of Basel-Landschaft's communes and parishes (Steuerfüsse und
// Steuersätze der Einwohner- und Kirchgemeinden 2022 bis 2026, Amt für Daten und Statistik) into
// packages/rules-bl/src/<year>/communes.ts: for each of the 86 communes its name, its district and
// its Steuerfuss for natural persons (income and wealth, in percent of the state tax, StG § 19 Abs.
// 2), stored in hundredths of a percent (58.50 -> 5850); for 2026, the only year the table gives
// them, the church rates of the commune's parishes as the table prints them.
//
// Input, both downloaded by scripts/fetch-sources.mjs, their sha256 checked against
// docs/sources/lock.json:
// - docs/sources/bl/files/bl-2026-communal-steuerfuesse.html: the table's export (an Excel HTML
//   table, windows-1252), the source of both years;
// - docs/sources/bl/files/bl-2025-gemeindesteuerfuesse.html: the statistics page that shows the same
//   table (UTF-8). Every row and value must be the same in both, or the script stops.
// The table's own layout is checked before anything is read: the columns 2022 to 2026 under
// "Einkommen, Vermögen", the 2026 columns of the Röm.-kath., Evang.-ref. and Christ.kath. churches and
// the child amount, and the footnotes that give their units: "2 In % der Staatssteuer. 3 In % des
// steuerbaren Einkommens bzw. Vermögens. 4 In Franken pro Kind." Rows "Ganzer Kanton" and "Bez. ..."
// are averages (footnote 1) and give the district of the communes under them.
//
// Usage:
//   node scripts/bl-communes.mjs              every year in YEARS
//   node scripts/bl-communes.mjs --check      fail if the data differs from the files
//
// Dev tool. It never runs inside the extension, and the extension never reads these files.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';

const YEARS = [2025, 2026];
const EXPORT = 'bl-2026-communal-steuerfuesse';
const PAGE = 'bl-2025-gemeindesteuerfuesse';
const COMMUNES = 86;
const DISTRICTS = ['Arlesheim', 'Laufen', 'Liestal', 'Sissach', 'Waldenburg'];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const filesDir = path.join(root, 'docs', 'sources', 'bl', 'files');

async function verified(id, ext, lock) {
  const file = path.join(filesDir, `${id}.${ext}`);
  const buf = await readFile(file).catch(() => {
    throw new Error(`${id}: run node scripts/fetch-sources.mjs --canton bl first.`);
  });
  const sha256 = createHash('sha256').update(buf).digest('hex');
  if (lock[id]?.status !== 'ok' || lock[id].sha256 !== sha256) {
    throw new Error(
      `${id}: the file differs from docs/sources/lock.json. Re-fetch, then re-check.`,
    );
  }
  return buf;
}

const text = (s) =>
  s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

/** The rows of every table of an HTML page, each a list of cell texts (a cell spanning n columns once). */
function rowsOf(html) {
  const rows = [];
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    rows.push([...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => text(m[1])));
  }
  return rows;
}

/** "58,50" -> 5850, "0,55" -> 55: hundredths, exactly; the table prints two decimals. */
function hundredths(s, where) {
  const m = /^(\d{1,3}),(\d{2})$/.exec(s);
  if (!m) throw new Error(`${where}: not a number with two decimals: ${JSON.stringify(s)}`);
  return Number(m[1]) * 100 + Number(m[2]);
}

/**
 * The table: the communes with their district and their values, in the table's order. Checks the
 * header and the footnotes so that a new layout or new units stop the script.
 */
function tableOf(html, id) {
  const rows = rowsOf(html);
  const joined = rows.map((r) => r.join(' | '));
  if (
    !joined.some((r) =>
      r.startsWith('Steuerfüsse und Steuersätze der Einwohner- und Kirchgemeinden 2022 bis 2026'),
    )
  ) {
    throw new Error(`${id}: no table "Steuerfüsse und Steuersätze ... 2022 bis 2026".`);
  }
  const header = rows.filter(
    (r) =>
      r.filter(Boolean).join(' ') ===
      'Gemeinde Einkommen, Vermögen2 Ertrag2 Kapital2 Kirche2 Einkommen3 Vermögen3 Einkommen3 Vermögen3 Kinderabzug4',
  );
  const churches = rows.filter((r) =>
    /^Bezirk, Natürliche Personen Juristische Personen Röm\.-kath\. Evang\.-ref\. Kirche3? Christ\.kath\. Kirche$/.test(
      r.filter(Boolean).join(' '),
    ),
  );
  const years = rows.filter(
    (r) =>
      r.filter(Boolean).join(' ') ===
      '2022 2023 2024 2025 2026 2026 2026 2026 2026 2026 2026 2026 2026',
  );
  if (header.length !== 5 || churches.length !== 5 || years.length !== 5) {
    throw new Error(
      `${id}: the column headings changed (${header.length} unit rows, ${churches.length} church rows, ${years.length} year rows; 5 of each expected).`,
    );
  }
  const notes = joined.find((r) => r.startsWith('1 Als Durchschnitt'));
  if (
    !notes?.includes(
      '2 In % der Staatssteuer. 3 In % des steuerbaren Einkommens bzw. Vermögens. 4 In Franken pro Kind.',
    )
  ) {
    throw new Error(`${id}: the footnotes on the units changed.`);
  }
  const communes = [];
  let district = null;
  for (const r of rows) {
    const [name, ...values] = r;
    if (values.length !== 13 || !values.every((v) => /^\d{1,3},\d{2}$/.test(v))) continue;
    if (name === 'Ganzer Kanton') continue;
    const bez = /^Bez\. (.+)$/.exec(name);
    if (bez) {
      if (!DISTRICTS.includes(bez[1])) throw new Error(`${id}: unknown district ${bez[1]}.`);
      district = bez[1];
      continue;
    }
    if (!district) throw new Error(`${id}: ${name} before any district.`);
    const v = values.map((x, i) => hundredths(x, `${id} ${name} column ${i + 2}`));
    communes.push({
      name,
      district,
      rates: { 2022: v[0], 2023: v[1], 2024: v[2], 2025: v[3], 2026: v[4] },
      church2026: {
        catholic: v[7],
        reformed: { income: v[8], wealth: v[9] },
        christCatholic: { income: v[10], wealth: v[11] },
        // Footnote 4: francs per child; stored in centimes.
        childAmount: v[12],
      },
    });
  }
  if (communes.length !== COMMUNES) {
    throw new Error(`${id}: ${communes.length} communes read, ${COMMUNES} expected.`);
  }
  if (new Set(communes.map((c) => c.name)).size !== COMMUNES) {
    throw new Error(`${id}: two communes with the same name.`);
  }
  for (const c of communes) {
    // StG § 19 Abs. 2: at most 80 % of the state tax.
    for (const [year, rate] of Object.entries(c.rates)) {
      if (rate <= 0 || rate > 8000) throw new Error(`${id}: ${c.name} ${year}: rate ${rate}.`);
    }
  }
  return communes;
}

function communesOf(table, year) {
  return table.map((c) => ({
    name: c.name,
    district: c.district,
    rate: c.rates[year],
    church: year === 2026 ? c.church2026 : null,
  }));
}

function source(year, communes) {
  const id = year === 2026 ? EXPORT : PAGE;
  const other = year === 2026 ? PAGE : EXPORT;
  const church =
    year === 2026
      ? `; columns Röm.-kath. Kirche (footnote 2, in % der Staatssteuer), Evang.-ref. Kirche and Christ.kath. Kirche Einkommen and Vermögen (footnote 3, in % des steuerbaren Einkommens bzw. Vermögens) and Kinderabzug (footnote 4, in Franken pro Kind), 2026`
      : '';
  const intro =
    year === 2026
      ? [
          `// (58.50 % -> 5850); the church rates of the commune's parishes in hundredths of a percent`,
          `// (Röm.-kath.: of the state tax; Evang.-ref. and Christ.kath.: of the taxable income and`,
          `// wealth) and the church table's amount per child (Kinderabzug) in centimes.`,
        ]
      : [`// (58.50 % -> 5850); no church rates: the table gives them for 2026 only.`];
  return (
    `// Basel-Landschaft's communes for tax year ${year}: the name, the district and the Steuerfuss for\n` +
    `// natural persons, the same for income and wealth, in hundredths of a percent of the state tax\n` +
    intro.map((l) => `${l}\n`).join('') +
    `// Generated by scripts/bl-communes.mjs from ${id} (the same table as\n` +
    `// ${other}); do not edit, re-run the script.\n` +
    `import type { Cited } from '@taxpresso/rules-ch';\n` +
    `import type { BlCommune } from '../communes.js';\n\n` +
    `export const COMMUNES_${year}: Cited<readonly BlCommune[]> = {\n` +
    `  source: '${id} (table Steuerfüsse und Steuersätze der Einwohner- und Kirchgemeinden 2022 bis 2026: column Natürliche Personen, Einkommen, Vermögen, ${year}, footnote 2: in % der Staatssteuer${church}); bl-na-steuergesetz-331 § 19 Abs. 2 (p. 11)',\n` +
    `  value: ${JSON.stringify(communes)},\n};\n`
  );
}

const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));
const exported = tableOf(
  new TextDecoder('windows-1252').decode(await verified(EXPORT, 'html', lock)),
  EXPORT,
);
const page = tableOf((await verified(PAGE, 'html', lock)).toString('utf8'), PAGE);
if (JSON.stringify(exported) !== JSON.stringify(page)) {
  throw new Error(`${EXPORT} and ${PAGE} print different tables.`);
}

let differs = false;
for (const year of YEARS) {
  const communes = communesOf(exported, year);
  const out = path.join(root, 'packages', 'rules-bl', 'src', String(year), 'communes.ts');
  const ts = await prettier.format(source(year, communes), {
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
        `${path.relative(root, out)}: same as the official table (${communes.length} communes).`,
      );
    }
  } else {
    await writeFile(out, ts);
    console.log(`${path.relative(root, out)}: ${communes.length} communes.`);
  }
}
if (differs) process.exit(1);
