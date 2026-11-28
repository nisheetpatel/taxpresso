// What the builds of the server share: the .mcpb (extension/scripts/build.mjs, one file), the
// Claude plugin (extension/scripts/build-plugin.mjs) and the ChatGPT plugin
// (extension/scripts/build-chatgpt-plugin.mjs), both split into files of readable size. Same
// sources, same esbuild options, same C2 stubs, same licenses; only the layout and the
// distribution flag differ.

import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { parse as parseYaml } from 'yaml';
import { planSplit } from './split-plan.mjs';

export const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const repoRoot = path.resolve(extDir, '..');

/** @typedef {'mcpb' | 'plugin' | 'chatgpt'} Distribution */

/** The most a server file may have when it can be split; Anthropic's directory holds files over 256 KiB. */
const SPLIT_BUDGET = 200 * 1024;

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
      // Which build this is: the .mcpb for Claude Desktop, the Claude plugin for Claude Code and
      // Cowork, or the ChatGPT plugin (extension/src/config.ts, which also takes the assistant's
      // name from it). The UI has the same flag (ui/src/shared/distribution.ts).
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
    // ships. esbuild keeps an object on one line when its source is, so the plugins', meant to be
    // read, get it indented; the .mcpb's stays as it was. The same data either way.
    plugins: [
      {
        name: 'yaml',
        setup(b) {
          b.onLoad({ filter: /\.yaml$/ }, async (args) => ({
            contents: JSON.stringify(
              parseYaml(await readFile(args.path, 'utf8')),
              null,
              distribution === 'mcpb' ? undefined : 2,
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
 * Builds a plugin's server into `serverDir`: readable (not minified) and split into files of at
 * most about 200 KiB where a file can be split (split-plan.mjs), each named after what it holds,
 * plus the barcode reader's WebAssembly. The Claude plugin and the ChatGPT plugin are built this
 * way; only the distribution flag differs. The metafile, with the files' final names, goes to
 * extension/build-meta/<metaName> (not shipped) for scripts/check-bundle.mjs.
 * @param {{ version: string, distribution: Distribution, serverDir: string, metaName: string }} opts
 * @returns {Promise<import('esbuild').Metafile>} the build's metafile, for the notices
 */
export async function buildSplitServer({ version, distribution, serverDir, metaName }) {
  // A first build in memory, without splitting, gives the module sizes; the plan adds the entry
  // points that cut it into files under the budget; the second build writes them.
  const options = serverBuildOptions({ version, distribution });
  const main = path.join(extDir, 'src', 'main.ts');
  const whole = await build({ ...options, entryPoints: [main], write: false, outdir: serverDir });
  // zxing-wasm's JavaScript (Emscripten's, minified upstream) gets a file of its own, so a reader
  // sees which code is upstream's and which is ours.
  const plan = planSplit(whole.metafile, 'src/main.ts', SPLIT_BUDGET, [
    /node_modules\/zxing-wasm\/dist\/es\/reader\/index\.js$/,
  ]);
  const extra = plan.entries.map((input, i) => ({
    in: path.resolve(extDir, input),
    out: `entry-${i}`,
  }));
  const result = await build({
    ...options,
    entryPoints: [{ in: main, out: 'index' }, ...extra],
    outdir: serverDir,
    splitting: true,
    outExtension: { '.js': '.mjs' },
    chunkNames: 'chunk-[hash]',
    entryNames: '[name]',
  });

  // The extra entry points' own files only re-export from the chunks: nothing imports them.
  const outputs = result.metafile.outputs;
  const rel = (p) => path.relative(extDir, p).split(path.sep).join('/');
  const imported = new Set(Object.values(outputs).flatMap((o) => o.imports.map((i) => i.path)));
  const extraInputs = new Set(plan.entries);
  for (const [file, info] of Object.entries(outputs)) {
    if (!info.entryPoint || !extraInputs.has(info.entryPoint)) continue;
    if (imported.has(file)) throw new Error(`${file} is imported by another file; it can't go`);
    await rm(path.resolve(extDir, file));
    delete outputs[file];
  }

  // Each remaining file is named after what it holds, so a reader knows where to look:
  // rules-ge.mjs, zod.mjs, pdfjs.mjs, data-ge-2026-tariffs.mjs... index.mjs stays the entry point.
  const names = new Map(); // old relative output path -> new file name
  const taken = new Set(['index.mjs']);
  const files = Object.keys(outputs)
    .filter((f) => f.endsWith('.mjs') && path.basename(f) !== 'index.mjs')
    .sort((a, b) => {
      const ka = Object.keys(outputs[a].inputs).sort()[0] ?? '';
      const kb = Object.keys(outputs[b].inputs).sort()[0] ?? '';
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  for (const file of files) {
    const bytes = new Map();
    for (const [input, info] of Object.entries(outputs[file].inputs)) {
      const label = labelOf(input);
      bytes.set(label, (bytes.get(label) ?? 0) + info.bytesInOutput);
    }
    // A file with no input holds only esbuild's own helpers (such as __export).
    const label =
      [...bytes].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? 'esbuild-runtime';
    let name = `${label}.mjs`;
    for (let n = 2; taken.has(name); n++) name = `${label}-${n}.mjs`;
    taken.add(name);
    names.set(file, name);
  }
  // esbuild writes every import between the files as "./<file>.mjs": one pass rewrites them all.
  const newName = new Map([...names].map(([from, to]) => [path.basename(from), to]));
  for (const f of (await readdir(serverDir)).filter((n) => n.endsWith('.mjs'))) {
    const p = path.join(serverDir, f);
    const text = await readFile(p, 'utf8');
    await writeFile(
      p,
      text.replace(/(["'])\.\/([\w.-]+\.mjs)\1/g, (m, q, base) =>
        newName.has(base) ? `${q}./${newName.get(base)}${q}` : m,
      ),
    );
  }
  // Two steps, so no new name overwrites a file that is still to be renamed.
  for (const from of names.keys())
    await rename(path.resolve(extDir, from), `${path.resolve(extDir, from)}.tmp`);
  for (const [from, to] of names)
    await rename(`${path.resolve(extDir, from)}.tmp`, path.join(serverDir, to));
  const renamed = Object.fromEntries(
    Object.entries(outputs).map(([file, info]) => [
      names.has(file) ? rel(path.join(serverDir, names.get(file))) : file,
      {
        ...info,
        imports: info.imports.map((i) =>
          names.has(i.path) ? { ...i, path: rel(path.join(serverDir, names.get(i.path))) } : i,
        ),
      },
    ]),
  );
  await mkdir(path.join(extDir, 'build-meta'), { recursive: true });
  await writeFile(
    path.join(extDir, 'build-meta', metaName),
    JSON.stringify({ inputs: result.metafile.inputs, outputs: renamed }, null, 2),
  );
  await copyBarcodeReader(result.metafile, serverDir);
  return result.metafile;
}

/** The name a server file takes from an input: its package, data folder or "taxpresso". */
function labelOf(input) {
  if (input.endsWith('/unpdf/dist/pdfjs.mjs')) return 'pdfjs';
  const nm = input.match(/node_modules\/(?:@([^/]+)\/)?([^/]+)\/(?!.*node_modules\/)/);
  if (nm) {
    const scope = nm[1] === 'modelcontextprotocol' ? 'mcp' : nm[1];
    return (scope ? `${scope}-${nm[2]}` : nm[2]).replace(/[^\w.-]/g, '-');
  }
  const pk = input.match(/^\.\.\/packages\/([^/]+)\//);
  if (pk) return pk[1];
  const data = input.match(/^\.\.\/data\/([^/]+)\/(\d{4})\/(?:.*\/)?([\w-]+)\.\w+$/);
  if (data) return `data-${data[1]}-${data[2]}-${data[3]}`;
  return 'taxpresso';
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
