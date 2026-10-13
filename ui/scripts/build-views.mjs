#!/usr/bin/env node
// Builds each MCP Apps view (src/views/<name>.{html,tsx}) into one self-contained HTML file in
// dist/views/. Hosts render these in a sandboxed iframe with no network, so everything is inline:
// script, styles and fonts (as bytes the view hands to the browser, see src/views/fonts.ts).

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const VIEWS = ['dashboard'];
const FONT_CSS = [
  '@fontsource-variable/geist/wght.css',
  '@fontsource-variable/geist-mono/wght.css',
];

/** zod's translated error messages (about 260 KB): nothing in a view reads them, English stays. */
const zodWithoutLocales = {
  name: 'zod-without-locales',
  setup(b) {
    b.onResolve({ filter: /\/locales\/index\.js$/ }, (args) =>
      /[\\/]zod[\\/]/.test(args.importer) ? { path: 'zod-locales', namespace: 'stub' } : undefined,
    );
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export {};', loader: 'js' }));
  },
};

/** The Geist faces of the browser page, read from the same @fontsource files, as base64. */
const embeddedFonts = {
  name: 'taxpresso-fonts',
  setup(b) {
    b.onResolve({ filter: /^virtual:taxpresso-fonts$/ }, () => ({
      path: 'fonts',
      namespace: 'taxpresso-fonts',
    }));
    b.onLoad({ filter: /.*/, namespace: 'taxpresso-fonts' }, async () => {
      const fonts = [];
      for (const spec of FONT_CSS) {
        const cssPath = require.resolve(spec);
        const css = await readFile(cssPath, 'utf8');
        for (const [, block] of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
          const prop = (name) => block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();
          const file = block.match(/url\(([^)]+\.woff2)\)/)?.[1];
          if (!file) throw new Error(`${spec}: a font face without a woff2 file`);
          const data = await readFile(path.resolve(path.dirname(cssPath), file));
          fonts.push({
            family: prop('font-family').replace(/['"]/g, ''),
            style: prop('font-style') ?? 'normal',
            weight: prop('font-weight') ?? '400',
            range: prop('unicode-range') ?? 'U+0-10FFFF',
            data: data.toString('base64'),
          });
        }
      }
      return { contents: `export default ${JSON.stringify(fonts)};`, loader: 'js' };
    });
  },
};

await rm(path.join(root, 'dist/views'), { recursive: true, force: true });
await mkdir(path.join(root, 'dist/views'), { recursive: true });
for (const name of VIEWS) {
  const { outputFiles } = await build({
    entryPoints: [path.join(root, 'src/views', `${name}.tsx`)],
    bundle: true,
    minify: true,
    write: false,
    outdir: path.join(root, 'dist/views/.build'),
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    jsxImportSource: 'preact',
    legalComments: 'none',
    logLevel: 'warning',
    plugins: [zodWithoutLocales, embeddedFonts],
  });
  const js = outputFiles.find((f) => f.path.endsWith('.js'))?.text ?? '';
  const css = outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';
  const template = await readFile(path.join(root, 'src/views', `${name}.html`), 'utf8');
  const html = template
    .replace('/*__STYLE__*/', () => css.replace(/<\/style/gi, '<\\/style'))
    .replace('/*__SCRIPT__*/', () => js.replace(/<\/script/gi, '<\\/script'));
  await writeFile(path.join(root, 'dist/views', `${name}.html`), html);
  console.log(`views/${name}.html  ${Math.round(html.length / 1024)} KB`);
}
