#!/usr/bin/env node
// Builds Taxpresso as a Claude plugin (Claude Code and Cowork), beside the .mcpb (Claude Desktop's
// chat), from the same sources: build/plugin/taxpresso/, zipped as build/taxpresso-plugin-<version>.zip
// for claude.ai's Customize > Plugins > Upload plugin. Run `pnpm build:plugin` (it builds the
// plugin's UI first). docs/spikes/S5.md has the findings; scripts/check-plugin.mjs checks the result.
//
//   .claude-plugin/plugin.json   the manifest and the directory listing's fields, from manifest.json
//   .mcp.json                    starts the server: node ${CLAUDE_PLUGIN_ROOT}/server/index.mjs
//   server/                      the server, readable (not minified) and split into files of at most
//                                about 200 KiB where a file can be split (split-plan.mjs), plus the
//                                barcode reader's WebAssembly
//   ui/dashboard/, ui/views/     the plugin's UI build (ui: `build:plugin`), as the server expects it
//   skills/taxpresso/SKILL.md    when and how to use Taxpresso (extension/plugin/)
//   README.md, LICENSE, THIRD_PARTY_NOTICES.txt, icon.png
//
// The esbuild metafile goes to extension/build-meta/plugin-server.json (not shipped) for
// scripts/check-bundle.mjs --plugin. No bin/ (claude.ai and Cowork refuse a plugin with one), no
// package.json, no node_modules.

import {
  access,
  cp,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import {
  copyBarcodeReader,
  extDir,
  repoRoot,
  serverBuildOptions,
  writeNotices,
} from './build-common.mjs';
import { iconPng } from './make-icon.mjs';
import { planSplit } from './split-plan.mjs';
import { walk, zipFolder } from './zip-folder.mjs';

/** The most a server file may have when it can be split; the directory holds files over 256 KiB. */
const SPLIT_BUDGET = 200 * 1024;
/** The plugin's permanent name in Claude Code and the directory (never change it). */
const NAME = 'taxpresso';

const buildDir = path.join(repoRoot, 'build');
const out = path.join(buildDir, 'plugin', NAME);
const serverDir = path.join(out, 'server');
const uiDist = path.join(repoRoot, 'ui', 'dist', 'plugin');

const pkg = JSON.parse(await readFile(path.join(extDir, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(extDir, 'manifest.json'), 'utf8'));

try {
  await access(path.join(uiDist, 'dashboard', 'index.html'));
  await access(path.join(uiDist, 'views', 'dashboard.html'));
} catch {
  console.error("The plugin's UI is not built. Run: pnpm --filter @taxpresso/ui build:plugin");
  process.exit(1);
}

await rm(out, { recursive: true, force: true });
await mkdir(serverDir, { recursive: true });

// 1. The server. A first build in memory, without splitting, gives the module sizes; the plan adds
//    the entry points that cut it into files under the budget; the second build writes them.
const options = serverBuildOptions({ version: pkg.version, distribution: 'plugin' });
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
  path.join(extDir, 'build-meta', 'plugin-server.json'),
  JSON.stringify({ inputs: result.metafile.inputs, outputs: renamed }, null, 2),
);
await copyBarcodeReader(result.metafile, serverDir);

// 2. The UI, the license, the notices, the icon.
await cp(path.join(uiDist, 'dashboard'), path.join(out, 'ui', 'dashboard'), { recursive: true });
await cp(path.join(uiDist, 'views'), path.join(out, 'ui', 'views'), { recursive: true });
await cp(path.join(repoRoot, 'LICENSE'), path.join(out, 'LICENSE'));
await writeNotices(result.metafile, path.join(out, 'THIRD_PARTY_NOTICES.txt'), pkg.version);
await writeFile(path.join(out, 'icon.png'), iconPng(256));

// 3. The manifest: the listing's fields, from the .mcpb's manifest so the two say the same.
const pluginJson = {
  name: NAME,
  displayName: manifest.display_name,
  version: pkg.version,
  description: manifest.description,
  author: manifest.author,
  homepage: manifest.homepage,
  repository: 'https://github.com/nisheetpatel/taxpresso',
  license: manifest.license,
  keywords: manifest.keywords,
  icon: './icon.png',
  privacyPolicyUrl: 'https://taxpresso.ch/en/privacy/',
  supportUrl: manifest.support,
  documentationUrl: manifest.documentation,
};
await mkdir(path.join(out, '.claude-plugin'), { recursive: true });
await writeFile(
  path.join(out, '.claude-plugin', 'plugin.json'),
  JSON.stringify(pluginJson, null, 2) + '\n',
);
// The server is started as the directory asks: a file of the plugin, run by node, plain arguments.
// Its folder is TAXPRESSO_VAULT_PATH from the environment, else ~/Documents/Taxpresso.
await writeFile(
  path.join(out, '.mcp.json'),
  JSON.stringify(
    {
      mcpServers: {
        [NAME]: { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/server/index.mjs'] },
      },
    },
    null,
    2,
  ) + '\n',
);
await cp(path.join(extDir, 'plugin', 'README.md'), path.join(out, 'README.md'));
await cp(path.join(extDir, 'plugin', 'skills'), path.join(out, 'skills'), { recursive: true });

// 4. The zip for Upload plugin: the folder as its single top-level entry.
const zipPath = path.join(buildDir, `taxpresso-plugin-${pkg.version}.zip`);
await rm(zipPath, { force: true });
await writeFile(zipPath, await zipFolder(out, NAME));

const sizes = [];
for (const f of await walk(out))
  sizes.push({ f: path.relative(out, f), size: (await stat(f)).size });
const server = sizes.filter((s) => s.f.startsWith('server/'));
console.log(
  `built build/plugin/${NAME} (Taxpresso ${pkg.version}): ${sizes.length} files; server in ` +
    `${server.length} files, the largest ${Math.max(...server.map((s) => s.size))} bytes\n` +
    `${path.relative(process.cwd(), zipPath)}`,
);

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
