#!/usr/bin/env node
// Spike S6 (docs/spikes/S6.md): packages Taxpresso as a ChatGPT plugin, OpenAI's portable "Agent
// Plugins" package (developers.openai.com/plugins/build/plugins.md and deploy/desktop-only.md, read
// 27 November 2026), around the same local server. Run `pnpm build:chatgpt` (it builds the Claude
// plugin first): the server and the UI are that build's files, copied as they are, so the .mcpb and
// the Claude plugin stay what they were. scripts/check-chatgpt-plugin.mjs checks the result.
//
//   build/chatgpt-plugin/                    a marketplace root, for a local test
//     .agents/plugins/marketplace.json       names the package below (never inside the package)
//     taxpresso/
//       plugin.json                          the manifest; OpenAI's fields under extensions["com.openai"]
//       mcp.json                             starts the server: node ${PLUGIN_ROOT}/server/index.mjs
//       skills/taxpresso/SKILL.md            when and how to use Taxpresso (extension/chatgpt-plugin/)
//       server/, ui/                         as in build/plugin/taxpresso
//       assets/logo.png, assets/composer-icon.png
//       README.md, LICENSE, THIRD_PARTY_NOTICES.txt
//
// Tried through the ChatGPT desktop app's own engine (S6); the checks that need the app's window
// are its [HUMAN] test plan. For any try-out, pin the tax folder to an empty one, so it never opens
// the real ~/Documents/Taxpresso. A test build goes to build/chatgpt-plugin-test/ instead:
//
//   node extension/scripts/build-chatgpt-plugin.mjs --vault /absolute/path/to/an/empty/folder

import { access, cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extDir, repoRoot } from './build-common.mjs';
import { iconPng } from './make-icon.mjs';
import { walk } from './zip-folder.mjs';

/** The plugin's name: the same as the Claude plugin's and the .mcpb's. */
const NAME = 'taxpresso';
/** A test build's entry point, beside the server's own (see --vault). */
const TEST_LAUNCH = 'test-launch.mjs';
/** OpenAI's limits on the listing's fields (plugins/deploy/submission.md). */
const SHORT_DESCRIPTION = 'Your Swiss tax return';
/** The directory's category list is in OpenAI's dashboard; the docs' own example uses this one. */
const CATEGORY = 'Productivity';

const claudePlugin = path.join(repoRoot, 'build', 'plugin', NAME);
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

// The server and the UI come from the Claude plugin's build, of this version.
let built;
try {
  await access(path.join(claudePlugin, 'server', 'index.mjs'));
  await access(path.join(claudePlugin, 'ui', 'views', 'dashboard.html'));
  built = JSON.parse(
    await readFile(path.join(claudePlugin, '.claude-plugin', 'plugin.json'), 'utf8'),
  );
} catch {
  console.error('The Claude plugin is not built. Run: pnpm build:plugin');
  process.exit(1);
}
if (built.version !== pkg.version) {
  console.error(
    `build/plugin/${NAME} is version ${built.version}, not ${pkg.version}. Run: pnpm build:plugin`,
  );
  process.exit(1);
}

/**
 * The .mcpb's wording for ChatGPT. The manifest's texts name Claude; here the assistant's name is
 * swapped, so the packages say the same. A spike's shortcut: S6 proposes the name behind the build
 * flag instead.
 */
function forChatgpt(text) {
  const swapped = text.replaceAll('Claude', 'ChatGPT');
  if (/claude/i.test(swapped)) throw new Error(`still names Claude: ${swapped}`);
  return swapped;
}

await rm(marketplaceRoot, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// 1. The server, the UI, the license and the notices: the Claude plugin's files, unchanged.
for (const name of ['server', 'ui'])
  await cp(path.join(claudePlugin, name), path.join(out, name), { recursive: true });
for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.txt'])
  await cp(path.join(claudePlugin, name), path.join(out, name));

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

// 6. A marketplace file for a local test, outside the package: build/chatgpt-plugin is the
//    marketplace's root, and the package's path is relative to it (plugins/build/plugins.md).
const marketplace = {
  name: 'taxpresso-local',
  interface: { displayName: 'Taxpresso (local test)' },
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

let total = 0;
const files = await walk(out);
for (const f of files) total += (await stat(f)).size;
console.log(
  `built ${path.relative(repoRoot, out)} (Taxpresso ${pkg.version}): ${files.length} files, ` +
    `${(total / 1024 / 1024).toFixed(1)} MiB\n` +
    `${path.relative(process.cwd(), path.join(marketplaceRoot, '.agents', 'plugins', 'marketplace.json'))}` +
    (testVault ? `\ntest build: the tax folder is ${path.resolve(testVault)}` : ''),
);
