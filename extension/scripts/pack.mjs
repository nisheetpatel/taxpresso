#!/usr/bin/env node
// Validates extension/dist/manifest.json and packs extension/dist into build/taxpresso-<version>.mcpb
// with Anthropic's mcpb CLI. Run `pnpm build` first (the root `pnpm build:mcpb` does both).

import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
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
console.log(`\n${path.relative(process.cwd(), out)}`);
