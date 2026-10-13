#!/usr/bin/env node
// C2 static checks on the staged extension (extension/dist), run after `pnpm build`:
//  1. every npm package bundled into server/index.mjs is in extension/allowed-dependencies.json;
//  2. every Node built-in it imports is allowlisted, and none of the network ones ever is;
//  3. the shipped UI loads nothing from outside (no remote src, href, url() or @import, no Google Fonts);
//  4. nothing unexpected ships (no node_modules, no source maps).
// The runtime proof is test/offline/run.mjs; this catches problems before anything runs.

import { readdir, readFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extDir = path.join(root, 'extension');
const dist = path.join(extDir, 'dist');

const NEVER = [
  'https',
  'http2',
  'tls',
  'net',
  'dgram',
  'dns',
  'dns/promises',
  'child_process',
  'cluster',
  'worker_threads',
  'inspector',
].map((m) => `node:${m}`);

const errors = [];
let meta;
try {
  meta = JSON.parse(await readFile(path.join(extDir, 'build-meta', 'server.json'), 'utf8'));
} catch {
  console.error('No build metadata. Run: pnpm build');
  process.exit(1);
}
const allow = JSON.parse(await readFile(path.join(extDir, 'allowed-dependencies.json'), 'utf8'));

const packages = new Set();
const builtins = new Map(); // builtin -> importing files
for (const [file, info] of Object.entries(meta.inputs)) {
  const m = file.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\/(?!.*node_modules\/)/);
  if (m) packages.add(m[1]);
  for (const imp of info.imports) {
    if (!imp.external) continue;
    const name = imp.path.startsWith('node:') ? imp.path : `node:${imp.path}`;
    if (!builtinModules.includes(name.slice(5))) {
      errors.push(
        `external import "${imp.path}" in ${file} is not a Node built-in; bundle it or remove it`,
      );
      continue;
    }
    builtins.set(name, [...(builtins.get(name) ?? []), file]);
  }
}
for (const p of packages) {
  if (!(p in allow.packages))
    errors.push(`package "${p}" is bundled but not in extension/allowed-dependencies.json`);
}
for (const [b, files] of builtins) {
  if (NEVER.includes(b))
    errors.push(`${b} is a network or process built-in (C2), imported by ${files.join(', ')}`);
  else if (!(b in allow.builtins))
    errors.push(
      `built-in ${b} is not in extension/allowed-dependencies.json (imported by ${files.join(', ')})`,
    );
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const REMOTE = [
  /\b(?:src|href|action|poster)\s*=\s*["']?\s*(?:https?:)?\/\//i,
  /url\(\s*["']?\s*(?:https?:)?\/\//i,
  /@import\s+(?:url\()?\s*["']?\s*(?:https?:)?\/\//i,
];
for (const file of await walk(dist)) {
  const rel = path.relative(dist, file);
  if (rel.split(path.sep).includes('node_modules'))
    errors.push(`${rel}: node_modules must not ship`);
  if (file.endsWith('.map')) errors.push(`${rel}: source maps must not ship`);
  if (!/\.(html|css|js|mjs|svg)$/.test(file)) continue;
  const text = await readFile(file, 'utf8');
  if (/fonts\.(googleapis|gstatic)\.com/.test(text))
    errors.push(`${rel}: loads Google Fonts; bundle the fonts`);
  if (/\.(html|css|svg)$/.test(file)) {
    // Inline <script> bodies in views may contain URL strings that are not loads; check markup and CSS.
    const markup = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    for (const re of REMOTE) {
      const m = markup.match(re);
      if (m) errors.push(`${rel}: references a remote resource (${m[0].trim()})`);
    }
  }
}

if (errors.length) {
  console.error(`check-bundle: ${errors.length} problem(s)\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `check-bundle: ok. Packages: ${[...packages].sort().join(', ')}. Built-ins: ${[...builtins.keys()].sort().join(', ')}.`,
);
