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

import { access, cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSplitServer, extDir, repoRoot, writeNotices } from './build-common.mjs';
import { iconPng } from './make-icon.mjs';
import { walk, zipFolder } from './zip-folder.mjs';

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

// 1. The server, readable and split into files of readable size (build-common.mjs).
const metafile = await buildSplitServer({
  version: pkg.version,
  distribution: 'plugin',
  serverDir,
  metaName: 'plugin-server.json',
});

// 2. The UI, the license, the notices, the icon.
await cp(path.join(uiDist, 'dashboard'), path.join(out, 'ui', 'dashboard'), { recursive: true });
await cp(path.join(uiDist, 'views'), path.join(out, 'ui', 'views'), { recursive: true });
await cp(path.join(repoRoot, 'LICENSE'), path.join(out, 'LICENSE'));
await writeNotices(metafile, path.join(out, 'THIRD_PARTY_NOTICES.txt'), pkg.version);
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
