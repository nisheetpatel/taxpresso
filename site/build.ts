// Builds the static website into site/dist: the home page and the Get started page for every
// language in LANGS (French at /, then /en/, /de/, /it/, /es/, /pt/); styles.css with the logo's
// rules and only the Latin Geist subsets; the fonts and their license; the favicon from the logo.
// Usage: node site/build.ts   (Node 22.18+ runs TypeScript directly)

import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_SVG } from '../ui/src/shared/logo.ts';
import { LANGS, startPath } from './src/content.ts';
import { render, renderStart } from './src/render.ts';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const require = createRequire(import.meta.url);
const SUBSETS = ['latin', 'latin-ext'];

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'fonts'), { recursive: true });

// @font-face rules for the subsets we need, pointing at our own copies of the files.
let fontCss = '';
for (const [pkg, stem] of [
  ['@fontsource-variable/geist', 'geist'],
  ['@fontsource-variable/geist-mono', 'geist-mono'],
] as const) {
  const pkgDir = path.dirname(require.resolve(`${pkg}/package.json`));
  const css = await readFile(path.join(pkgDir, 'wght.css'), 'utf8');
  for (const subset of SUBSETS) {
    const file = `${stem}-${subset}-wght-normal.woff2`;
    const block = css.match(
      new RegExp(`/\\* ${file.replace('.woff2', '')} \\*/\\s*@font-face \\{[^}]+\\}`),
    );
    if (!block) throw new Error(`No @font-face for ${file} in ${pkg}`);
    fontCss += block[0].replace(`./files/${file}`, `/fonts/${file}`) + '\n\n';
    await copyFile(path.join(pkgDir, 'files', file), path.join(dist, 'fonts', file));
  }
  if (stem === 'geist')
    await copyFile(path.join(pkgDir, 'LICENSE'), path.join(dist, 'fonts', 'OFL.txt'));
}

const styles = await readFile(path.join(root, 'src', 'styles.css'), 'utf8');
const logo = await readFile(path.join(root, '..', 'ui', 'src', 'shared', 'logo.css'), 'utf8');
const css = `/* Geist and Geist Mono, SIL Open Font License 1.1: /fonts/OFL.txt */\n${fontCss}${styles}\n${logo}`;
const cssVersion = createHash('sha256').update(css).digest('hex').slice(0, 10);
await writeFile(path.join(dist, 'styles.css'), css);
await writeFile(path.join(dist, 'favicon.svg'), ICON_SVG);
await writeFile(path.join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n');

for (const { lang, path: urlPath } of LANGS) {
  const dir = path.join(dist, urlPath);
  await mkdir(path.join(dir, 'start'), { recursive: true });
  await writeFile(path.join(dir, 'index.html'), render(lang, cssVersion));
  await writeFile(path.join(dir, 'start', 'index.html'), renderStart(lang, cssVersion));
}
console.log(`site/dist: ${LANGS.flatMap((l) => [l.path, startPath(l.path)]).join(' ')}`);
