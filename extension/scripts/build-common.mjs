// What the two builds of the server share: the .mcpb (extension/scripts/build.mjs, one file) and the
// Claude plugin (extension/scripts/build-plugin.mjs, split into files of readable size). Same
// sources, same esbuild options, same C2 stubs, same licenses; only the layout and the
// distribution flag differ.

import { cp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

export const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const repoRoot = path.resolve(extDir, '..');

/** @typedef {'mcpb' | 'plugin'} Distribution */

/**
 * The esbuild options of the server bundle, without entry points or output paths.
 * @param {{ version: string, distribution: Distribution }} opts
 */
export function serverBuildOptions({ version, distribution }) {
  return {
    absWorkingDir: extDir,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    metafile: true,
    legalComments: 'none',
    logLevel: 'warning',
    define: {
      __TAXPRESSO_VERSION__: JSON.stringify(version),
      // Which build this is: the .mcpb for Claude Desktop, or the Claude plugin for Claude Code
      // and Cowork (extension/src/config.ts). The UI has the same flag (ui/src/shared/distribution.ts).
      __TAXPRESSO_DISTRIBUTION__: JSON.stringify(distribution),
      // C2, defense in depth. PDF.js (inside unpdf) can load a PDF, fonts or WebAssembly from a URL
      // with fetch or XMLHttpRequest. Taxpresso only ever gives it bytes and no URL, so these paths
      // never run; here they are cut at build time too: every bare fetch or XMLHttpRequest in the
      // bundle becomes a stub that refuses (see the banner). Our own code can't use them either
      // (ESLint), and the offline test proves no request leaves the process.
      fetch: '__taxpressoNoFetch',
      XMLHttpRequest: '__taxpressoNoXhr',
    },
    // Questionnaire data (data/ge/<year>/*.yaml) becomes plain JSON in the bundle: no YAML parser
    // ships. esbuild keeps an object on one line when its source is, so the plugin's, meant to be
    // read, gets it indented; the .mcpb's stays as it was. The same data either way.
    plugins: [
      {
        name: 'yaml',
        setup(b) {
          b.onLoad({ filter: /\.yaml$/ }, async (args) => ({
            contents: JSON.stringify(
              parseYaml(await readFile(args.path, 'utf8')),
              null,
              distribution === 'plugin' ? 2 : undefined,
            ),
            loader: 'json',
          }));
        },
      },
    ],
    // Some bundled dependencies are CommonJS and call require() for Node built-ins. With code
    // splitting (the plugin), every output file gets this banner, so each has its own stubs.
    banner: {
      js: [
        "import { createRequire as __taxpressoCreateRequire } from 'node:module'; const require = __taxpressoCreateRequire(import.meta.url);",
        "const __taxpressoNoFetch = () => Promise.reject(new Error('Taxpresso makes no network requests (C2).'));",
        "class __taxpressoNoXhr { constructor() { throw new Error('Taxpresso makes no network requests (C2).'); } }",
      ].join('\n'),
    },
  };
}

/**
 * Copies the barcode reader (ZXing-C++ as WebAssembly, from zxing-wasm) next to the server: the
 * server reads this file from disk at start (extension/src/main.ts). Only the reader ships, not
 * the writer.
 */
export async function copyBarcodeReader(metafile, serverDir) {
  const zxingDir = Object.keys(metafile.inputs)
    .map((input) => input.match(/^(.*node_modules\/zxing-wasm)\//)?.[1])
    .find(Boolean);
  if (!zxingDir) throw new Error('zxing-wasm is not in the server bundle');
  await cp(
    path.resolve(extDir, zxingDir, 'dist', 'reader', 'zxing_reader.wasm'),
    path.join(serverDir, 'zxing_reader.wasm'),
  );
}

/**
 * Writes THIRD_PARTY_NOTICES.txt: the licenses of everything inside the build, the server's
 * packages (from the metafile) and the UI's.
 * @returns {string[]} the npm packages in the server bundle, sorted
 */
export async function writeNotices(metafile, file, version) {
  const packageDirs = new Map(); // name -> folder
  for (const input of Object.keys(metafile.inputs)) {
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
    unpdf: [
      { name: 'PDF.js (in unpdf)', license: 'Apache-2.0', file: 'licenses/pdfjs-LICENSE.txt' },
    ],
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
    for (const f of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'OFL.txt']) {
      try {
        text = await readFile(path.join(dir, f), 'utf8');
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
    file,
    `Taxpresso ${version} includes the following third-party software.\n\n` +
      notices.join('\n' + '-'.repeat(72) + '\n\n'),
  );
  return serverPackages;
}
