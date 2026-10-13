#!/usr/bin/env node
// Turns Geneva's official source-tax tariff files into data/ge/<year>/source-tax/tariffs.json:
// the progressive tariffs A, B, C and H (barèmes de perception), packed, with where they come from.
//
// Input: docs/sources/ge/files/ge-<year>-source-tariff-ascii.zip (tarjjge.txt, the ESTV record
// format ch-na-is-recordformat-salaires), downloaded by scripts/fetch-sources.mjs. Its sha256 must
// match docs/sources/lock.json, so the data always says which file it was read from.
//
// Usage:
//   node scripts/source-tax-tables.mjs                 every year in YEARS
//   node scripts/source-tax-tables.mjs --year 2026     one year
//   node scripts/source-tax-tables.mjs --check         fail if the data differs from the files
//
// Dev tool (Node 22.18 or later: it imports the TypeScript reader directly). It never runs inside
// the extension, and the extension never reads these files: it ships the JSON.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import * as prettier from 'prettier';
import { compactTariff, parseTariffFile } from '../packages/rules-ge/src/source-tax/ascii.ts';

const YEARS = [2025, 2026];
/** The tariffs Taxpresso uses (RISP art. 1 al. 1 let. a, b, c, h): A0 to A5, B0 to B5, C0 to C5, H1 to H5. */
const WANTED = /^[ABCH]\d[NY]$/;
const EXPECTED = [
  ...['A', 'B', 'C'].flatMap((t) => [0, 1, 2, 3, 4, 5].map((n) => `${t}${n}`)),
  ...[1, 2, 3, 4, 5].map((n) => `H${n}`),
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const check = args.includes('--check');
const yearArg = args.includes('--year') ? Number(args[args.indexOf('--year') + 1]) : undefined;

/** The one text file inside a ZIP archive (stored or deflated). */
function unzipOne(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('Not a ZIP file.');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Broken ZIP directory.');
    const nameLength = buf.readUInt16LE(p + 28);
    entries.push({
      method: buf.readUInt16LE(p + 10),
      size: buf.readUInt32LE(p + 24),
      compressed: buf.readUInt32LE(p + 20),
      offset: buf.readUInt32LE(p + 42),
      name: buf.toString('latin1', p + 46, p + 46 + nameLength),
    });
    p += 46 + nameLength + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  if (entries.length !== 1)
    throw new Error(`Expected one file in the ZIP, found ${entries.length}.`);
  const e = entries[0];
  const local = e.offset;
  if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('Broken ZIP entry.');
  const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
  const raw = buf.subarray(start, start + e.compressed);
  const data = e.method === 8 ? inflateRawSync(raw) : e.method === 0 ? raw : undefined;
  if (!data) throw new Error(`Unsupported ZIP compression ${e.method}.`);
  if (data.length !== e.size) throw new Error('ZIP entry has the wrong size.');
  return { name: e.name, text: data.toString('latin1') };
}

async function tablesFor(year, lock) {
  const id = `ge-${year}-source-tariff-ascii`;
  const file = path.join(root, 'docs', 'sources', 'ge', 'files', `${id}.zip`);
  const zip = await readFile(file).catch(() => {
    throw new Error(`${id}: run node scripts/fetch-sources.mjs --canton ge first.`);
  });
  const sha256 = createHash('sha256').update(zip).digest('hex');
  if (lock[id]?.status !== 'ok' || lock[id].sha256 !== sha256) {
    throw new Error(
      `${id}: the file differs from docs/sources/lock.json. Re-fetch, then re-check.`,
    );
  }
  const { name, text } = unzipOne(zip);
  const parsed = parseTariffFile(text);
  if (parsed.canton !== 'GE') throw new Error(`${id}: canton ${parsed.canton}, not GE.`);
  if (parsed.validFrom !== `${year}-01-01`) {
    throw new Error(`${id}: valid from ${parsed.validFrom}, not 1 January ${year}.`);
  }
  const codes = Object.keys(parsed.tariffs).filter((c) => WANTED.test(c));
  const church = [...new Set(codes.map((c) => c[2]))].sort();
  const missing = EXPECTED.flatMap((c) => church.map((k) => `${c}${k}`)).filter(
    (c) => !codes.includes(c),
  );
  if (missing.length) throw new Error(`${id}: tariffs missing: ${missing.join(', ')}.`);
  const tariffs = {};
  for (const code of codes.sort()) tariffs[code] = compactTariff(code, parsed.tariffs[code]);
  return {
    canton: 'GE',
    taxYear: year,
    source: id,
    format: 'ch-na-is-recordformat-salaires',
    file: name,
    sha256,
    created: parsed.created,
    validFrom: parsed.validFrom,
    records: parsed.records,
    income: 'monthly, in centimes',
    rates: 'hundredths of a percent',
    church,
    tariffs,
  };
}

const lock = JSON.parse(await readFile(path.join(root, 'docs', 'sources', 'lock.json'), 'utf8'));
let differs = false;
for (const year of yearArg ? [yearArg] : YEARS) {
  const out = path.join(root, 'data', 'ge', String(year), 'source-tax', 'tariffs.json');
  const json = await prettier.format(JSON.stringify(await tablesFor(year, lock)), {
    ...(await prettier.resolveConfig(out)),
    parser: 'json',
  });
  if (check) {
    const current = await readFile(out, 'utf8').catch(() => '');
    if (current !== json) {
      differs = true;
      console.log(`DIFFERS ${path.relative(root, out)}`);
    } else console.log(`ok      ${path.relative(root, out)}`);
    continue;
  }
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, json);
  console.log(`wrote   ${path.relative(root, out)} (${Math.round(json.length / 1024)} KB)`);
}
process.exit(differs ? 1 : 0);
