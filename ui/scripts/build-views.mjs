#!/usr/bin/env node
// Builds each MCP Apps view (src/views/<name>.{html,ts,css}) into one self-contained HTML file in
// dist/views/. Hosts render these in a sandboxed iframe with no network, so everything is inline.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIEWS = ['open-dashboard'];

async function bundle(entry, options) {
  const result = await build({
    entryPoints: [path.join(root, 'src/views', entry)],
    bundle: true,
    minify: true,
    write: false,
    legalComments: 'none',
    logLevel: 'warning',
    ...options,
  });
  return result.outputFiles[0].text;
}

await mkdir(path.join(root, 'dist/views'), { recursive: true });
for (const name of VIEWS) {
  const js = await bundle(`${name}.ts`, { format: 'esm', platform: 'browser', target: 'es2022' });
  const css = await bundle(`${name}.css`, {});
  const template = await readFile(path.join(root, 'src/views', `${name}.html`), 'utf8');
  const html = template
    .replace('/*__STYLE__*/', () => css.replace(/<\/style/gi, '<\\/style'))
    .replace('/*__SCRIPT__*/', () => js.replace(/<\/script/gi, '<\\/script'));
  await writeFile(path.join(root, 'dist/views', `${name}.html`), html);
  console.log(`views/${name}.html  ${Math.round(html.length / 1024)} KB`);
}
