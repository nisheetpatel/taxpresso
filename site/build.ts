// Builds the static website into site/dist: every page in PAGES (src/pages.ts) for every language
// in LANGS (/en/, /fr/, /de/, /it/, /es/, /pt/); sitemap.xml and robots.txt; styles.css with the
// logo's rules and only the Latin Geist subsets; the fonts and their license; the favicon from the
// logo. Fails if the sitemap and the pages written differ.
// Usage: node site/build.ts   (Node 22.18+ runs TypeScript directly)

import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire, register } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_SVG } from '../ui/src/shared/logo.ts';
import { BASE_URL, LANGS } from './src/content.ts';

// The canton pages read the rules packages, whose files import each other as "./file.js": this
// hook finds the ".ts" file instead (resolve-ts.mjs). Registered before the pages are loaded.
register('./resolve-ts.mjs', import.meta.url);
const { builtPages, PAGES, robots, sitemap } = await import('./src/pages.ts');

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
const hero = await readFile(path.join(root, 'src', 'hero.css'), 'utf8');
const css = `/* Geist and Geist Mono, SIL Open Font License 1.1: /fonts/OFL.txt */\n${fontCss}${styles}\n${hero}\n${logo}`;
const cssVersion = createHash('sha256').update(css).digest('hex').slice(0, 10);
await writeFile(path.join(dist, 'styles.css'), css);
await writeFile(path.join(dist, 'favicon.svg'), ICON_SVG);
for (const page of builtPages(cssVersion)) {
  const dir = path.join(dist, page.path);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), page.html());
}
const map = sitemap();
await writeFile(path.join(dist, 'sitemap.xml'), map);
await writeFile(path.join(dist, 'robots.txt'), robots());

// Every page written is in the sitemap, and the sitemap lists nothing else.
const written = (await readdir(dist, { recursive: true }))
  .filter((f) => path.basename(f) === 'index.html')
  .map((f) => `${BASE_URL}/${path.dirname(f).split(path.sep).join('/')}/`)
  .sort();
const listed = [...map.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!).sort();
const missing = written.filter((u) => !listed.includes(u));
const extra = listed.filter((u) => !written.includes(u));
if (missing.length || extra.length)
  throw new Error(`sitemap.xml: missing ${missing.join(' ')}; not built ${extra.join(' ')}`);

console.log(`site/dist: ${PAGES.length} pages in ${LANGS.length} languages, all in sitemap.xml`);
