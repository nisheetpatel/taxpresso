// The Claude plugin's build tooling (docs/spikes/S4.md): the pre-submission check
// (scripts/check-plugin.mjs), the plan that splits the server into files (split-plan.mjs) and the
// zip for Upload plugin (zip-folder.mjs). The built plugin itself is checked in CI
// (`pnpm check:plugin`) and run end to end by the offline test (`pnpm test:offline:plugin`).
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkPlugin,
  checkZip,
  countWords,
  readZip,
  unreadable,
} from '../../scripts/check-plugin.mjs';
import { planSplit, type Metafile } from '../scripts/split-plan.mjs';
import { zipFolder } from '../scripts/zip-folder.mjs';

const WORDS = Array.from({ length: 45 }, (_, i) => `word${i}`).join(' ');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

let dir: string;

/** A small plugin that passes every check: what build-plugin.mjs writes, in miniature. */
async function validPlugin(root: string) {
  const files: Record<string, string | Buffer> = {
    '.claude-plugin/plugin.json': JSON.stringify({
      name: 'taxpresso',
      displayName: 'Taxpresso',
      version: '1.0.0',
      description: 'Swiss tax returns on your computer.',
      author: { name: 'Taxpresso contributors' },
      license: 'AGPL-3.0-or-later',
      icon: './icon.png',
      homepage: 'https://taxpresso.ch',
      privacyPolicyUrl: 'https://taxpresso.ch/en/privacy/',
      supportUrl: 'https://github.com/nisheetpatel/taxpresso/issues',
    }),
    '.mcp.json': JSON.stringify({
      mcpServers: {
        taxpresso: { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/server/index.mjs'] },
      },
    }),
    'README.md': `# Taxpresso\n\n${WORDS}\n`,
    LICENSE: 'GNU AFFERO GENERAL PUBLIC LICENSE',
    'icon.png': PNG,
    'server/index.mjs': 'export const ok = true;\n',
    'skills/taxpresso/SKILL.md':
      '---\nname: taxpresso\ndescription: Swiss tax returns.\n---\n\nBody.\n',
  };
  for (const [p, body] of Object.entries(files)) await put(root, p, body);
}

async function put(root: string, p: string, body: string | Buffer) {
  await mkdir(path.dirname(path.join(root, p)), { recursive: true });
  await writeFile(path.join(root, p), body);
}

async function manifest(change: (m: Record<string, unknown>) => void) {
  const file = path.join(dir, '.claude-plugin', 'plugin.json');
  const m = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  change(m);
  await writeFile(file, JSON.stringify(m));
}

async function server(config: unknown) {
  await put(dir, '.mcp.json', JSON.stringify({ mcpServers: { taxpresso: config } }));
}

beforeEach(async () => {
  dir = path.join(await mkdtemp(path.join(os.tmpdir(), 'taxpresso-plugin-')), 'taxpresso');
  await validPlugin(dir);
});
afterEach(async () => {
  await rm(path.dirname(dir), { recursive: true, force: true });
});

describe('the plugin check', () => {
  it('passes a plugin built as Taxpresso builds it, and says why its server would be held', async () => {
    const { errors, held } = await checkPlugin(dir);
    expect(errors).toEqual([]);
    expect(held).toEqual([
      expect.stringMatching(/runs server\/index\.mjs, not a shell script: held .* subfolder/),
    ]);
  });

  it('blocks what the directory blocks', async () => {
    await put(dir, 'server/.DS_Store', '');
    await put(dir, 'big.txt', Buffer.alloc(5 * 1024 * 1024));
    await put(dir, 'bin/tool', '#!/bin/sh\n');
    await symlink(path.join(dir, 'LICENSE'), path.join(dir, 'COPYING'));
    const { errors } = await checkPlugin(dir);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^server\/\.DS_Store: a macOS or Windows system file/),
        expect.stringMatching(/^big\.txt: 5\.0 MiB, over the 5 MiB/),
        expect.stringMatching(/^bin\/: claude\.ai and Cowork refuse/),
        expect.stringMatching(/^COPYING: a symbolic link/),
      ]),
    );
  });

  it('counts the README words outside code blocks, and asks for a license', async () => {
    await put(dir, 'README.md', `# Taxpresso\n\nShort.\n\n\`\`\`\n${WORDS}\n\`\`\`\n`);
    await rm(path.join(dir, 'LICENSE'));
    await manifest((m) => delete m.license);
    const { errors } = await checkPlugin(dir);
    expect(errors).toEqual(
      expect.arrayContaining([
        'README.md: 2 words outside code blocks; the directory asks for at least 40',
        'no LICENSE file and no license in plugin.json',
      ]),
    );
    expect(countWords(`one two\n\`\`\`\nthree four\n\`\`\`\nfive`)).toBe(3);
  });

  it('checks the manifest: name, listing fields, keys, paths', async () => {
    await manifest((m) => {
      m.name = 'Claude-Taxes';
      m.privacyPolicyUrl = 'http://taxpresso.ch/privacy';
      delete m.supportUrl;
      m.mcpservers = {};
      m.skills = '../elsewhere';
      m.icon = './missing.png';
    });
    const { errors } = await checkPlugin(dir);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/name "Claude-Taxes" must be lowercase/),
        'plugin.json: privacyPolicyUrl must be an https:// URL',
        expect.stringMatching(/supportUrl is missing/),
        expect.stringMatching(/unknown key "mcpservers"/),
        expect.stringMatching(/^plugin\.json: skills path "\.\.\/elsewhere" must start with \.\//),
        "plugin.json: icon ./missing.png doesn't exist",
      ]),
    );
    await manifest((m) => (m.name = 'claude-tax'));
    expect((await checkPlugin(dir)).errors).toEqual(
      expect.arrayContaining(['plugin.json: name "claude-tax" is reserved']),
    );
  });

  it('checks how the server starts: a file of the plugin, plain arguments, no other variable', async () => {
    await server({ command: 'node', args: ['${HOME}/server.mjs'] });
    let { errors } = await checkPlugin(dir);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /\$\{HOME\}: paths are written in full from \$\{CLAUDE_PLUGIN_ROOT\}/,
        ),
        expect.stringMatching(/runs no file of the plugin/),
      ]),
    );
    await server({ command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/../outside.mjs'] });
    ({ errors } = await checkPlugin(dir));
    expect(errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/leaves the plugin folder/)]),
    );
    await server({ command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/server/missing.mjs'] });
    ({ errors } = await checkPlugin(dir));
    expect(errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/doesn't exist in the plugin/)]),
    );
    await server({ type: 'http', url: 'http://example.com/mcp' });
    ({ errors } = await checkPlugin(dir));
    expect(errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/https:\/\/ or wss:\/\//)]),
    );

    await server({ command: 'npx', args: ['-y', 'some-server@1.0.0'] });
    const npx = await checkPlugin(dir);
    expect(npx.held).toEqual(expect.arrayContaining([expect.stringMatching(/starts through npx/)]));
    await server({ command: 'bash', args: ['-c', 'node ${CLAUDE_PLUGIN_ROOT}/server/index.mjs'] });
    const shell = await checkPlugin(dir);
    expect(shell.held).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/through a shell \(bash\)/),
        expect.stringMatching(/inline program or preload \(-c\)/),
      ]),
    );
  });

  it('reports what would be held: size, count, binaries, a lockfile install, packed code', async () => {
    await put(
      dir,
      'server/data.mjs',
      `export const data = ${JSON.stringify('x'.repeat(300 * 1024))};\n`,
    );
    await put(dir, 'server/reader.wasm', Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]));
    await put(dir, 'package.json', '{}');
    await put(dir, 'package-lock.json', '{}');
    for (let i = 0; i < 510; i++) await put(dir, `docs/page-${i}.md`, 'A page.');
    const { errors, held } = await checkPlugin(dir);
    expect(errors).toEqual([]);
    expect(held).toEqual(
      expect.arrayContaining([
        '521 files, over 512',
        'server/data.mjs: 300 KiB, over 256 KiB',
        expect.stringMatching(
          /^server\/data\.mjs: a line of \d+ characters \(packed data or code\)$/,
        ),
        expect.stringMatching(/^server\/reader\.wasm: a binary file/),
        expect.stringMatching(/^package\.json beside a lockfile/),
      ]),
    );
  });

  it('tells readable code from minified code', () => {
    const readable = Array.from(
      { length: 60 },
      (_, i) => `const householdIncome${i} = computeIncome(facts, ${i});`,
    ).join('\n');
    expect(unreadable(readable)).toBeUndefined();
    const minified = Array.from({ length: 60 }, (_, i) => `var a${i % 9}=b(c,${i});`).join('\n');
    expect(unreadable(minified)).toMatch(/one or two letters \(minified\)/);
    expect(unreadable(`var x=${'1,'.repeat(400)}1;`.repeat(3))).toMatch(
      /lines over 500 characters/,
    );
  });

  it('checks skills, and keeps the donation link out of the plugin (SPEC.md section 12)', async () => {
    await put(
      dir,
      'skills/taxpresso/SKILL.md',
      '---\nname: other\ndescription:\n  - a list\n---\n',
    );
    await put(dir, 'README.md', `# Taxpresso\n\n${WORDS} Tip us at preciousplasticbugoma.com.\n`);
    const { errors } = await checkPlugin(dir);
    expect(errors).toEqual(
      expect.arrayContaining([
        'skills/taxpresso/SKILL.md: description must be one text value',
        'skills/taxpresso/SKILL.md: name "other" differs from its folder "taxpresso"',
        expect.stringMatching(/^README\.md: mentions the donation menu's destination/),
      ]),
    );
  });
});

describe('the zip for Upload plugin', () => {
  it('holds the folder as its single top-level entry, byte for byte, the same every time', async () => {
    const zip = path.join(path.dirname(dir), 'taxpresso.zip');
    const bytes = await zipFolder(dir, 'taxpresso');
    expect(bytes.equals(await zipFolder(dir, 'taxpresso'))).toBe(true);
    await writeFile(zip, bytes);
    const names = (await readZip(zip)).map((e) => e.name);
    expect(names).toContain('taxpresso/.claude-plugin/plugin.json');
    expect(names.every((n) => n.startsWith('taxpresso/'))).toBe(true);
    expect(await checkZip(zip, dir)).toEqual([]);

    await put(dir, 'README.md', `# Changed\n\n${WORDS}\n`);
    expect(await checkZip(zip, dir)).toEqual(['taxpresso.zip: README.md differs from the folder']);
    await writeFile(zip, await zipFolder(path.join(dir, 'server'), 'server'));
    expect(await checkZip(zip, dir)).toEqual([
      expect.stringMatching(
        /plugin\.json must be at the root, or inside a single top-level folder/,
      ),
    ]);
  });
});

describe('the plan that splits the server', () => {
  /** main -> a -> shared, main -> b -> shared; every module 100 bytes. */
  const meta = (extra: Record<string, string[]> = {}): Metafile => {
    const graph: Record<string, string[]> = {
      main: ['a', 'b'],
      a: ['a1', 'a2', 'shared'],
      a1: [],
      a2: [],
      b: ['b1', 'shared'],
      b1: [],
      shared: [],
      ...extra,
    };
    return {
      inputs: Object.fromEntries(
        Object.entries(graph).map(([id, deps]) => [
          id,
          { imports: deps.map((d) => ({ path: d, kind: 'import-statement' })) },
        ]),
      ),
      outputs: {
        'out.mjs': {
          inputs: Object.fromEntries(Object.keys(graph).map((id) => [id, { bytesInOutput: 100 }])),
        },
      },
    };
  };

  it('adds entry points until every chunk that can be split is under the budget', () => {
    const plan = planSplit(meta(), 'main', 350);
    expect(plan.chunks.every((c) => c.bytes <= 350)).toBe(true);
    expect(plan.chunks.reduce((n, c) => n + c.bytes, 0)).toBe(700);
    expect(plan.entries.length).toBeGreaterThan(0);
    expect(plan.entries).not.toContain('main');
  });

  it('leaves alone what fits, and what is one module', () => {
    expect(planSplit(meta(), 'main', 10_000)).toMatchObject({
      entries: [],
      chunks: [{ bytes: 700 }],
    });
    const one = planSplit(meta(), 'main', 50);
    expect(one.chunks.every((c) => c.modules.length === 1)).toBe(true);
  });

  it('keeps a dynamic import apart, and what it is asked to', () => {
    const m = meta({ b1: [] });
    m.inputs.b!.imports.push({ path: 'lazy', kind: 'dynamic-import' });
    m.inputs.lazy = { imports: [] };
    m.outputs['out.mjs']!.inputs.lazy = { bytesInOutput: 100 };
    const plan = planSplit(m, 'main', 10_000, [/^a$/]);
    expect(plan.entries).toEqual(['a']);
    expect(plan.chunks.map((c) => c.modules.sort().join(','))).toEqual(
      expect.arrayContaining(['lazy', 'a,a1,a2,shared']),
    );
  });
});
