#!/usr/bin/env node
// Stages the extension in extension/dist, exactly what the .mcpb will contain:
//   manifest.json, icon.png, THIRD_PARTY_NOTICES.txt,
//   server/index.mjs   one bundled file, no node_modules (dependencies are checked by
//                      scripts/check-bundle.mjs against extension/allowed-dependencies.json)
//   ui/dashboard/      the localhost page (ui/dist/dashboard)
//   ui/views/          MCP Apps views (ui/dist/views)
// The esbuild metafile goes to extension/build-meta/ (not shipped).

import { cp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { parse as parseYaml } from 'yaml';

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(extDir, '..');
const dist = path.join(extDir, 'dist');
const uiDist = path.join(repoRoot, 'ui', 'dist');

const pkg = JSON.parse(await readFile(path.join(extDir, 'package.json'), 'utf8'));

try {
  await access(path.join(uiDist, 'dashboard', 'index.html'));
  await access(path.join(uiDist, 'views', 'open-dashboard.html'));
} catch {
  console.error('The UI is not built. Run: pnpm --filter @taxpresso/ui build');
  process.exit(1);
}

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'server'), { recursive: true });

const result = await build({
  absWorkingDir: extDir,
  entryPoints: [path.join(extDir, 'src', 'main.ts')],
  outfile: path.join(dist, 'server', 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  metafile: true,
  legalComments: 'none',
  logLevel: 'warning',
  define: {
    __TAXPRESSO_VERSION__: JSON.stringify(pkg.version),
    // C2, defense in depth. PDF.js (inside unpdf) can load a PDF, fonts or WebAssembly from a URL
    // with fetch or XMLHttpRequest. Taxpresso only ever gives it bytes and no URL, so these paths
    // never run; here they are cut at build time too: every bare fetch or XMLHttpRequest in the
    // bundle becomes a stub that refuses (see the banner). Our own code can't use them either
    // (ESLint), and the offline test proves no request leaves the process.
    fetch: '__taxpressoNoFetch',
    XMLHttpRequest: '__taxpressoNoXhr',
  },
  // Questionnaire data (data/ge/<year>/*.yaml) becomes plain JSON in the bundle: no YAML parser ships.
  plugins: [
    {
      name: 'yaml',
      setup(b) {
        b.onLoad({ filter: /\.yaml$/ }, async (args) => ({
          contents: JSON.stringify(parseYaml(await readFile(args.path, 'utf8'))),
          loader: 'json',
        }));
      },
    },
  ],
  // Some bundled dependencies are CommonJS and call require() for Node built-ins.
  banner: {
    js: [
      "import { createRequire as __taxpressoCreateRequire } from 'node:module'; const require = __taxpressoCreateRequire(import.meta.url);",
      "const __taxpressoNoFetch = () => Promise.reject(new Error('Taxpresso makes no network requests (C2).'));",
      "class __taxpressoNoXhr { constructor() { throw new Error('Taxpresso makes no network requests (C2).'); } }",
    ].join('\n'),
  },
});
await mkdir(path.join(extDir, 'build-meta'), { recursive: true });
await writeFile(
  path.join(extDir, 'build-meta', 'server.json'),
  JSON.stringify(result.metafile, null, 2),
);

await cp(path.join(uiDist, 'dashboard'), path.join(dist, 'ui', 'dashboard'), { recursive: true });
await cp(path.join(uiDist, 'views'), path.join(dist, 'ui', 'views'), { recursive: true });
await cp(path.join(extDir, 'icon.png'), path.join(dist, 'icon.png'));
// The barcode reader (ZXing-C++ as WebAssembly, from zxing-wasm): the server reads this file from
// disk at start (extension/src/main.ts). Only the reader ships, not the writer.
const zxingDir = Object.keys(result.metafile.inputs)
  .map((input) => input.match(/^(.*node_modules\/zxing-wasm)\//)?.[1])
  .find(Boolean);
if (!zxingDir) throw new Error('zxing-wasm is not in the server bundle');
await cp(
  path.resolve(extDir, zxingDir, 'dist', 'reader', 'zxing_reader.wasm'),
  path.join(dist, 'server', 'zxing_reader.wasm'),
);
// Taxpresso's own license (AGPL-3.0-or-later) travels with every copy.
await cp(path.join(repoRoot, 'LICENSE'), path.join(dist, 'LICENSE.txt'));

const manifest = JSON.parse(await readFile(path.join(extDir, 'manifest.json'), 'utf8'));
manifest.version = pkg.version;
await writeFile(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// Licenses of everything inside the bundle: the server's packages (from the metafile) and the UI's.
const packageDirs = new Map(); // name -> folder
for (const input of Object.keys(result.metafile.inputs)) {
  const m = input.match(/^(.*node_modules\/((?:@[^/]+\/)?[^/]+))\//);
  if (m) packageDirs.set(m[2], path.resolve(extDir, m[1]));
}
const serverPackages = [...packageDirs.keys()].sort();
for (const name of [
  '@fontsource-variable/geist',
  '@fontsource-variable/geist-mono',
  '@modelcontextprotocol/ext-apps',
  '@modelcontextprotocol/client',
  '@modelcontextprotocol/core',
  'zod',
]) {
  if (!packageDirs.has(name))
    packageDirs.set(name, path.join(repoRoot, 'ui', 'node_modules', name));
}
// Software bundled inside a package's own build, whose license file isn't in that package.
const EMBEDDED = {
  unpdf: [{ name: 'PDF.js (in unpdf)', license: 'Apache-2.0', file: 'licenses/pdfjs-LICENSE.txt' }],
  'zxing-wasm': [
    {
      name: 'ZXing-C++ and stb_image (in zxing-wasm, server/zxing_reader.wasm)',
      license: 'Apache-2.0; stb_image MIT',
      file: 'licenses/zxing-cpp-LICENSE.txt',
    },
  ],
};
const notices = [];
for (const [name, dir] of packageDirs) {
  const meta = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
  let text = '';
  for (const file of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'OFL.txt']) {
    try {
      text = await readFile(path.join(dir, file), 'utf8');
      break;
    } catch {
      /* try the next name */
    }
  }
  if (!text) throw new Error(`No license file found for ${name} in ${dir}`);
  notices.push(`${name} ${meta.version} (${meta.license})\n\n${text.trim()}\n`);
  for (const embedded of EMBEDDED[name] ?? []) {
    const body = await readFile(path.join(extDir, embedded.file), 'utf8');
    notices.push(`${embedded.name} (${embedded.license})\n\n${body.trim()}\n`);
  }
}
await writeFile(
  path.join(dist, 'THIRD_PARTY_NOTICES.txt'),
  `Taxpresso ${pkg.version} includes the following third-party software.\n\n` +
    notices.join('\n' + '-'.repeat(72) + '\n\n'),
);

console.log(
  `staged extension/dist (Taxpresso ${pkg.version}); server bundle uses: ${serverPackages.join(', ')}`,
);
