#!/usr/bin/env node
// Stages the extension in extension/dist, exactly what the .mcpb will contain:
//   manifest.json, icon.png, THIRD_PARTY_NOTICES.txt,
//   server/index.mjs   one bundled file, no node_modules (dependencies are checked by
//                      scripts/check-bundle.mjs against extension/allowed-dependencies.json)
//   ui/dashboard/      the localhost page (ui/dist/dashboard)
//   ui/views/          MCP Apps views (ui/dist/views)
// The esbuild metafile goes to extension/build-meta/ (not shipped). The Claude plugin is built
// from the same sources and options by build-plugin.mjs (both use build-common.mjs).

import { cp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import {
  copyBarcodeReader,
  extDir,
  repoRoot,
  serverBuildOptions,
  writeNotices,
} from './build-common.mjs';

const dist = path.join(extDir, 'dist');
const uiDist = path.join(repoRoot, 'ui', 'dist');

const pkg = JSON.parse(await readFile(path.join(extDir, 'package.json'), 'utf8'));

try {
  await access(path.join(uiDist, 'dashboard', 'index.html'));
  await access(path.join(uiDist, 'views', 'dashboard.html'));
} catch {
  console.error('The UI is not built. Run: pnpm --filter @taxpresso/ui build');
  process.exit(1);
}

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'server'), { recursive: true });

const result = await build({
  ...serverBuildOptions({ version: pkg.version, distribution: 'mcpb' }),
  entryPoints: [path.join(extDir, 'src', 'main.ts')],
  outfile: path.join(dist, 'server', 'index.mjs'),
});
await mkdir(path.join(extDir, 'build-meta'), { recursive: true });
await writeFile(
  path.join(extDir, 'build-meta', 'server.json'),
  JSON.stringify(result.metafile, null, 2),
);

await cp(path.join(uiDist, 'dashboard'), path.join(dist, 'ui', 'dashboard'), { recursive: true });
await cp(path.join(uiDist, 'views'), path.join(dist, 'ui', 'views'), { recursive: true });
await cp(path.join(extDir, 'icon.png'), path.join(dist, 'icon.png'));
await copyBarcodeReader(result.metafile, path.join(dist, 'server'));
// Taxpresso's own license (AGPL-3.0-or-later) travels with every copy.
await cp(path.join(repoRoot, 'LICENSE'), path.join(dist, 'LICENSE.txt'));

const manifest = JSON.parse(await readFile(path.join(extDir, 'manifest.json'), 'utf8'));
manifest.version = pkg.version;
await writeFile(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const serverPackages = await writeNotices(
  result.metafile,
  path.join(dist, 'THIRD_PARTY_NOTICES.txt'),
  pkg.version,
);

console.log(
  `staged extension/dist (Taxpresso ${pkg.version}); server bundle uses: ${serverPackages.join(', ')}`,
);
