#!/usr/bin/env node
// Spike S6 (docs/spikes/S6.md): packages Taxpresso as a ChatGPT plugin, OpenAI's portable "Agent
// Plugins" package (developers.openai.com/plugins/build/plugins.md and deploy/desktop-only.md, read
// 27 November 2026), around the same local server. Run `pnpm build:chatgpt` (it builds this
// package's UI first). The server and the UI are built here from the same sources as the .mcpb's
// and the Claude plugin's, with the build flag at 'chatgpt': the assistant is called ChatGPT in
// every sentence (extension/src/config.ts, ui/src/shared/distribution.ts), and the other two
// builds stay what they were. scripts/check-chatgpt-plugin.mjs checks the result.
//
//   build/taxpresso-chatgpt-<version>.zip    what people download: the folder below, zipped
//   build/taxpresso-chatgpt.zip              the same bytes, under a name that never changes
//   build/chatgpt-plugin/                    a marketplace root
//     .agents/plugins/marketplace.json       names the package below (never inside the package)
//     taxpresso/
//       plugin.json                          the manifest; OpenAI's fields under extensions["com.openai"]
//       mcp.json                             starts the server: node ${PLUGIN_ROOT}/server/index.mjs
//       skills/taxpresso/SKILL.md            when and how to use Taxpresso (extension/chatgpt-plugin/)
//       server/                              the server, readable and split as the Claude plugin's
//       ui/dashboard/, ui/views/             this package's UI build (ui: `build:chatgpt`)
//       assets/logo.png, assets/composer-icon.png
//       README.md, LICENSE, THIRD_PARTY_NOTICES.txt
//
// Tried through the ChatGPT desktop app's own engine (S6); the checks that need the app's window
// are its [HUMAN] test plan. For any try-out, pin the tax folder to an empty one, so it never opens
// the real ~/Documents/Taxpresso. A test build goes to build/chatgpt-plugin-test/ instead:
//
//   node extension/scripts/build-chatgpt-plugin.mjs --vault /absolute/path/to/an/empty/folder
//
// The esbuild metafile goes to extension/build-meta/chatgpt-server.json (not shipped) for
// scripts/check-bundle.mjs --chatgpt. No bin/, no package.json, no node_modules.

import { access, cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildSplitServer, extDir, repoRoot, writeNotices } from './build-common.mjs';
import { iconPng } from './make-icon.mjs';
import { walk, zipFolder } from './zip-folder.mjs';

/** The plugin's name: the same as the Claude plugin's and the .mcpb's. */
const NAME = 'taxpresso';
/** A test build's entry point, beside the server's own (see --vault). */
const TEST_LAUNCH = 'test-launch.mjs';
/** OpenAI's limits on the listing's fields (plugins/deploy/submission.md). */
const SHORT_DESCRIPTION = 'Your Swiss tax return';
/** The directory's category list is in OpenAI's dashboard; the docs' own example uses this one. */
const CATEGORY = 'Productivity';

const uiDist = path.join(repoRoot, 'ui', 'dist', 'chatgpt');
const sources = path.join(extDir, 'chatgpt-plugin');

// --vault <folder>: a test build whose server uses this folder (mcp.json's env).
const vaultAt = process.argv.indexOf('--vault');
const testVault = vaultAt >= 0 ? process.argv[vaultAt + 1] : undefined;
if (vaultAt >= 0) {
  const real = path.join(os.homedir(), 'Documents', 'Taxpresso');
  if (!testVault || !path.isAbsolute(testVault)) {
    console.error('--vault needs an absolute path to a folder for the test.');
    process.exit(1);
  }
  // macOS and Windows ignore case: ~/Documents/taxpresso is the real folder too.
  if (path.resolve(testVault).toLowerCase() === real.toLowerCase()) {
    console.error(`--vault can't be ${real}: that is the real tax folder. Choose an empty one.`);
    process.exit(1);
  }
}

// A test build has a folder of its own, build/chatgpt-plugin-test: once an app has it as a
// marketplace, a normal build must never land there, since that one opens the real tax folder.
const marketplaceRoot = path.join(
  repoRoot,
  'build',
  testVault ? 'chatgpt-plugin-test' : 'chatgpt-plugin',
);
const out = path.join(marketplaceRoot, NAME);

const pkg = JSON.parse(await readFile(path.join(extDir, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(extDir, 'manifest.json'), 'utf8'));

try {
  await access(path.join(uiDist, 'dashboard', 'index.html'));
  await access(path.join(uiDist, 'views', 'dashboard.html'));
} catch {
  console.error("This package's UI is not built. Run: pnpm --filter @taxpresso/ui build:chatgpt");
  process.exit(1);
}

/**
 * The .mcpb's listing texts for ChatGPT (extension/manifest.json: the description and the long
 * description). They name Claude; here the assistant's name is swapped, so the packages say the
 * same. The server's and the UI's own sentences take the name from the build flag instead.
 */
function forChatgpt(text) {
  const swapped = text.replaceAll('Claude', 'ChatGPT');
  if (/claude/i.test(swapped)) throw new Error(`still names Claude: ${swapped}`);
  return swapped;
}

await rm(marketplaceRoot, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// 1. The server, built for ChatGPT: the same sources and the same layout as the Claude plugin's
//    (build-common.mjs), the flag at 'chatgpt'. Then this package's UI, the license, the notices.
const metafile = await buildSplitServer({
  version: pkg.version,
  distribution: 'chatgpt',
  serverDir: path.join(out, 'server'),
  metaName: testVault ? 'chatgpt-test-server.json' : 'chatgpt-server.json',
});
await cp(path.join(uiDist, 'dashboard'), path.join(out, 'ui', 'dashboard'), { recursive: true });
await cp(path.join(uiDist, 'views'), path.join(out, 'ui', 'views'), { recursive: true });
await cp(path.join(repoRoot, 'LICENSE'), path.join(out, 'LICENSE'));
await writeNotices(metafile, path.join(out, 'THIRD_PARTY_NOTICES.txt'), pkg.version);

// 2. The skill and the README, worded for ChatGPT.
await cp(path.join(sources, 'skills'), path.join(out, 'skills'), { recursive: true });
await cp(path.join(sources, 'README.md'), path.join(out, 'README.md'));

// 3. The icons: square PNGs, at least 48 px (plugins/deploy/submission.md).
await mkdir(path.join(out, 'assets'), { recursive: true });
await writeFile(path.join(out, 'assets', 'logo.png'), iconPng(512));
await writeFile(path.join(out, 'assets', 'composer-icon.png'), iconPng(96));

// 4. The manifest, at the package's root: the portable fields, then OpenAI's own.
const pluginJson = {
  $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
  name: NAME,
  version: pkg.version,
  description: forChatgpt(manifest.description),
  author: manifest.author,
  homepage: manifest.homepage,
  repository: 'https://github.com/nisheetpatel/taxpresso',
  license: manifest.license,
  keywords: manifest.keywords,
  extensions: {
    'com.openai': {
      interface: {
        displayName: manifest.display_name,
        shortDescription: SHORT_DESCRIPTION,
        longDescription: forChatgpt(manifest.long_description),
        developerName: manifest.author.name,
        category: CATEGORY,
        // It reads and writes the user's Taxpresso folder, nothing else.
        capabilities: ['Read', 'Write'],
        websiteURL: manifest.homepage,
        supportURL: manifest.support,
        privacyPolicyURL: 'https://taxpresso.ch/en/privacy/',
        // The .mcpb's prompt, then two of the README's three examples.
        defaultPrompt: [
          manifest.prompts[0].text,
          'I put my salary certificate and my 3a attestation in my Taxpresso folder. What is still missing?',
          'How much would a pillar 3a payment before 31 December save me?',
        ],
        composerIcon: './assets/composer-icon.png',
        logo: './assets/logo.png',
      },
    },
  },
};
await writeFile(path.join(out, 'plugin.json'), JSON.stringify(pluginJson, null, 2) + '\n');

// 5. The server, started as OpenAI's desktop-only page shows: node, a file of the plugin, the
//    plugin's folder as the working directory. Its tax folder is TAXPRESSO_VAULT_PATH from the
//    environment, else ~/Documents/Taxpresso: the format has no setting the user fills at install.
const mcpJson = {
  $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
  mcpServers: {
    [NAME]: {
      type: 'stdio',
      command: 'node',
      args: [`\${PLUGIN_ROOT}/server/${testVault ? TEST_LAUNCH : 'index.mjs'}`],
      cwd: '${PLUGIN_ROOT}',
      ...(testVault ? { env: { TAXPRESSO_VAULT_PATH: path.resolve(testVault) } } : {}),
    },
  },
};
// A test build starts through a small file that fixes the tax folder before the server loads: it
// can never open the real ~/Documents/Taxpresso, whether or not the host passes mcp.json's env on.
if (testVault)
  await writeFile(
    path.join(out, 'server', TEST_LAUNCH),
    `// A test build (build-chatgpt-plugin.mjs --vault): never ship it.\n` +
      `process.env.TAXPRESSO_VAULT_PATH = ${JSON.stringify(path.resolve(testVault))};\n` +
      `await import('./index.mjs');\n`,
  );
await writeFile(path.join(out, 'mcp.json'), JSON.stringify(mcpJson, null, 2) + '\n');

// 6. A marketplace file, outside the package: the folder above the package is the marketplace's
//    root, and the package's path is relative to it (plugins/build/plugins.md). It is how the app
//    learns about a plugin that is not in OpenAI's directory.
const marketplace = {
  name: testVault ? 'taxpresso-local' : NAME,
  interface: { displayName: testVault ? 'Taxpresso (local test)' : 'Taxpresso' },
  plugins: [
    {
      name: NAME,
      source: { source: 'local', path: `./${NAME}` },
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
      category: CATEGORY,
    },
  ],
};
await mkdir(path.join(marketplaceRoot, '.agents', 'plugins'), { recursive: true });
await writeFile(
  path.join(marketplaceRoot, '.agents', 'plugins', 'marketplace.json'),
  JSON.stringify(marketplace, null, 2) + '\n',
);

// 7. The zip people download: the marketplace's folder as its single top-level entry, and the same
//    bytes under a name that never changes, as for the .mcpb (extension/scripts/pack.mjs). Once
//    unzipped, the folder is what `codex plugin marketplace add` takes.
const top = testVault ? 'taxpresso-chatgpt-test' : 'taxpresso-chatgpt';
const zip = await zipFolder(marketplaceRoot, top);
const zips = testVault
  ? [path.join(repoRoot, 'build', `${top}.zip`)]
  : [
      path.join(repoRoot, 'build', `${top}-${pkg.version}.zip`),
      path.join(repoRoot, 'build', `${top}.zip`),
    ];
for (const file of zips) await writeFile(file, zip);

let total = 0;
const files = await walk(out);
for (const f of files) total += (await stat(f)).size;
console.log(
  `built ${path.relative(repoRoot, out)} (Taxpresso ${pkg.version}): ${files.length} files, ` +
    `${(total / 1024 / 1024).toFixed(1)} MiB\n` +
    `${path.relative(process.cwd(), path.join(marketplaceRoot, '.agents', 'plugins', 'marketplace.json'))}` +
    `\n${zips.map((f) => path.relative(process.cwd(), f)).join('\n')}` +
    (testVault ? `\ntest build: the tax folder is ${path.resolve(testVault)}` : ''),
);
