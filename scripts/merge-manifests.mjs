#!/usr/bin/env node
// Rebuilds docs/sources/manifest.json from the per-canton docs/sources/<canton>/manifest.json files,
// and fails on invalid entries or duplicate ids. Run after editing any canton manifest.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'sources');
const ORDER = ['ge', 'vd', 'vs', 'fr', 'ne', 'ju', 'be', 'ti', 'bs', 'bl', 'zh', 'ch', 'standards'];
const REQUIRED = ['id', 'canton', 'doc_type', 'title', 'tax_year', 'language', 'url', 'format', 'publisher', 'published', 'verified_on', 'priority', 'why_needed'];
const TYPES = new Set(['guide', 'form', 'tariff', 'communal_rates', 'deductions', 'source_tax', 'efiling_rules', 'law', 'other']);
const FORMATS = new Set(['pdf', 'html', 'xlsx', 'xls', 'csv', 'zip', 'xml', 'xsd']);

const dirs = (await readdir(srcDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
const folders = [...ORDER.filter((c) => dirs.includes(c)), ...dirs.filter((c) => !ORDER.includes(c)).sort()];

const all = [];
const errors = [];
for (const folder of folders) {
  let entries;
  try {
    entries = JSON.parse(await readFile(path.join(srcDir, folder, 'manifest.json'), 'utf8'));
  } catch {
    continue;
  }
  for (const e of entries) {
    const missing = REQUIRED.filter((k) => !(k in e));
    if (missing.length) errors.push(`${folder}/${e.id}: missing ${missing.join(', ')}`);
    if (!TYPES.has(e.doc_type)) errors.push(`${folder}/${e.id}: bad doc_type ${e.doc_type}`);
    if (!FORMATS.has(e.format)) errors.push(`${folder}/${e.id}: bad format ${e.format}`);
    if (!/^https:\/\//.test(e.url ?? '')) errors.push(`${folder}/${e.id}: url must be https`);
    if (/[\u2013\u2014]/.test(JSON.stringify(e))) errors.push(`${folder}/${e.id}: contains an en or em dash`);
  }
  entries.sort((a, b) => (a.priority !== 'core') - (b.priority !== 'core') || a.doc_type.localeCompare(b.doc_type) || (b.tax_year ?? 0) - (a.tax_year ?? 0) || a.id.localeCompare(b.id));
  all.push(...entries);
}

const seen = new Set();
for (const e of all) {
  if (seen.has(e.id)) errors.push(`duplicate id ${e.id}`);
  seen.add(e.id);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const out = { generated: new Date().toISOString().slice(0, 10), note: 'Merged from the per-canton manifest.json files. Edit those, then run scripts/merge-manifests.mjs.', entries: all };
await writeFile(path.join(srcDir, 'manifest.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`${all.length} entries from ${folders.length} folders`);
