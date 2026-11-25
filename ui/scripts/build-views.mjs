#!/usr/bin/env node
// Builds each MCP Apps view (src/views/<name>.{html,tsx}) into one self-contained HTML file in
// dist/views/. Hosts render these in a sandboxed iframe with no network, so everything is inline:
// script, styles and fonts (as bytes the view hands to the browser, see src/views/fonts.ts).
// `--plugin` builds the Claude plugin's copy into dist/plugin/views instead (see below).

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

// `--plugin`: the Claude plugin's views (src/shared/distribution.ts), into dist/plugin/views and
// not minified, so a reviewer can read them (docs/spikes/S4.md). Otherwise the .mcpb's, as before.
const plugin = process.argv.includes('--plugin');
const outDir = path.join(root, plugin ? 'dist/plugin/views' : 'dist/views');

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
for (const name of VIEWS) {
  const { outputFiles } = await build({
    entryPoints: [path.join(root, 'src/views', `${name}.tsx`)],
    bundle: true,
    minify: !plugin,
    write: false,
    outdir: path.join(outDir, '.build'),
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    jsxImportSource: 'preact',
    legalComments: 'none',
    logLevel: 'warning',
    define: {
      __TAXPRESSO_DISTRIBUTION__: JSON.stringify(plugin ? 'plugin' : 'mcpb'),
      // What esbuild assumes when it minifies; said explicitly for the build that doesn't.
      ...(plugin && { 'process.env.NODE_ENV': JSON.stringify('production') }),
    },
    plugins: [zodWithoutLocales, embeddedFonts],
  });
  const js = outputFiles.find((f) => f.path.endsWith('.js'))?.text ?? '';
  const css = outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';
  const template = await readFile(path.join(root, 'src/views', `${name}.html`), 'utf8');
  const html = template
    .replace('/*__STYLE__*/', () => css.replace(/<\/style/gi, '<\\/style'))
    .replace('/*__SCRIPT__*/', () => js.replace(/<\/script/gi, '<\\/script'));
  await writeFile(path.join(outDir, `${name}.html`), html);
  console.log(
    `${path.relative(path.join(root, 'dist'), outDir)}/${name}.html  ${Math.round(html.length / 1024)} KB`,
  );
}
