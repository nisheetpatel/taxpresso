#!/usr/bin/env node
// Validates extension/dist/manifest.json and packs extension/dist into build/taxpresso-<version>.mcpb
// with Anthropic's mcpb CLI. Run `pnpm build` first (the root `pnpm build:mcpb` does both).
//
// The same bytes are also written as build/taxpresso.mcpb. A release carries both files: the
// website's download button asks GitHub for the latest release's taxpresso.mcpb, a name that
// never changes (site/src/content.ts, RELEASE_FILE_URL), so the site never names a version.

import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(extDir, 'dist');
const outDir = path.join(extDir, '..', 'build');
const cli = path.join(extDir, 'node_modules', '@anthropic-ai', 'mcpb', 'dist', 'cli', 'cli.js');

const { version } = JSON.parse(await readFile(path.join(dist, 'manifest.json'), 'utf8'));
const out = path.join(outDir, `taxpresso-${version}.mcpb`);

const mcpb = (...args) => execFileSync(process.execPath, [cli, ...args], { stdio: 'inherit' });

await mkdir(outDir, { recursive: true });
await rm(out, { force: true });
mcpb('validate', path.join(dist, 'manifest.json'));
mcpb('pack', dist, out);
const latest = path.join(outDir, 'taxpresso.mcpb');
await copyFile(out, latest);
console.log(`\n${path.relative(process.cwd(), out)}\n${path.relative(process.cwd(), latest)}`);
