// The ChatGPT plugin's check (scripts/check-chatgpt-plugin.mjs, spike S6, docs/spikes/S6.md): what
// OpenAI documents for a plugin with a local server, and the small JSON Schema check behind
// `--schemas`. The built package itself is checked by `pnpm check:chatgpt` and run end to end by
// the offline test (`pnpm test:offline:chatgpt`).
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkChatgptPlugin, validate } from '../../scripts/check-chatgpt-plugin.mjs';

const SCHEMAS = 'https://agent-plugins.org/schemas/1.0.0';

/** A square PNG's first bytes: the signature, then the IHDR chunk with its width and height. */
function png(side: number): Buffer {
  const bytes = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.writeUInt32BE(side, 16);
  bytes.writeUInt32BE(side, 20);
  return bytes;
}

const PLUGIN = {
  $schema: `${SCHEMAS}/plugin.schema.json`,
  name: 'taxpresso',
  version: '1.0.0',
  description: 'Your Swiss tax return, with ChatGPT.',
  author: { name: 'Taxpresso contributors' },
  keywords: ['tax'],
  extensions: {
    'com.openai': {
      interface: {
        displayName: 'Taxpresso',
        shortDescription: 'Your Swiss tax return',
        longDescription: 'Taxpresso helps you prepare your Swiss tax return with ChatGPT.',
        developerName: 'Taxpresso contributors',
        category: 'Productivity',
        capabilities: ['Read', 'Write'],
        websiteURL: 'https://taxpresso.ch',
        supportURL: 'https://github.com/nisheetpatel/taxpresso/issues',
        privacyPolicyURL: 'https://taxpresso.ch/en/privacy/',
        defaultPrompt: ['Check where I am and tell me the next step.'],
        composerIcon: './assets/composer-icon.png',
        logo: './assets/logo.png',
      },
    },
  },
};
const MCP = {
  $schema: `${SCHEMAS}/mcp.schema.json`,
  mcpServers: {
    taxpresso: {
      type: 'stdio',
      command: 'node',
      args: ['${PLUGIN_ROOT}/server/index.mjs'],
      cwd: '${PLUGIN_ROOT}',
    },
  },
};
const SKILL = '---\nname: taxpresso\ndescription: Swiss tax returns.\n---\n\n# Taxpresso\n';

let dir: string;

/** A small package that passes every check: what build-chatgpt-plugin.mjs writes, in miniature. */
async function validPackage(changes: Record<string, string | Buffer | null> = {}) {
  const files: Record<string, string | Buffer | null> = {
    'plugin.json': JSON.stringify(PLUGIN),
    'mcp.json': JSON.stringify(MCP),
    'skills/taxpresso/SKILL.md': SKILL,
    'server/index.mjs': 'export {};\n',
    'server/zxing_reader.wasm': Buffer.from([0, 0x61, 0x73, 0x6d]),
    'ui/views/dashboard.html': '<!doctype html><title>Taxpresso</title>',
    'ui/dashboard/index.html': '<!doctype html><title>Taxpresso</title>',
    'assets/logo.png': png(512),
    'assets/composer-icon.png': png(96),
    'README.md': '# Taxpresso\n\nWith ChatGPT, on your own computer.\n',
    LICENSE: 'GNU AGPL',
    'THIRD_PARTY_NOTICES.txt': 'notices',
    ...changes,
  };
  for (const [name, body] of Object.entries(files)) {
    if (body === null) continue;
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), body);
  }
}
const withInterface = (changes: Record<string, unknown>) =>
  JSON.stringify({
    ...PLUGIN,
    extensions: {
      'com.openai': { interface: { ...PLUGIN.extensions['com.openai'].interface, ...changes } },
    },
  });
const withServer = (changes: Record<string, unknown>) =>
  JSON.stringify({
    ...MCP,
    mcpServers: { taxpresso: { ...MCP.mcpServers.taxpresso, ...changes } },
  });

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'taxpresso-chatgpt-plugin-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('the ChatGPT plugin check', () => {
  it('passes a package as the build writes it, noting only the missing terms page', async () => {
    await validPackage();
    const { errors, notes, files } = await checkChatgptPlugin(dir);
    expect(errors).toEqual([]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/termsOfServiceURL/);
    expect(files).toContain('mcp.json');
  });

  it('refuses a package with a file missing, or with the other formats inside', async () => {
    await validPackage({ 'mcp.json': null, '.mcp.json': '{}', '.claude-plugin/plugin.json': '{}' });
    const { errors } = await checkChatgptPlugin(dir);
    expect(errors).toContain('mcp.json: missing');
    expect(errors).toContain('.mcp.json: not in a package for ChatGPT');
    expect(errors).toContain('.claude-plugin: not in a package for ChatGPT');
  });

  it('holds the listing fields to OpenAI’s limits', async () => {
    await validPackage({
      'plugin.json': withInterface({
        shortDescription: 'Your Swiss tax return, done over an espresso',
        websiteURL: 'http://taxpresso.ch',
        defaultPrompt: ['one', 'two', 'three', 'four'],
        logo: 'assets/logo.png',
      }),
    });
    const { errors } = await checkChatgptPlugin(dir);
    expect(errors).toEqual([
      'plugin.json: interface.shortDescription, 30 characters at most',
      'plugin.json: interface.websiteURL must be an https URL',
      'plugin.json: interface.defaultPrompt, 3 at most, 128 characters each, all different',
      'plugin.json: interface.logo must be a ./ path to a file of the package',
    ]);
  });

  it('wants square icons of at least 48 px', async () => {
    await validPackage({ 'assets/composer-icon.png': png(32) });
    const { errors } = await checkChatgptPlugin(dir);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/composer-icon\.png: must be a square PNG.*32x32/);
  });

  it('wants one local server, started with node from the plugin’s folder', async () => {
    await validPackage({
      'mcp.json': withServer({ command: 'npx', args: ['-y', 'something'], env: { DEBUG: '1' } }),
    });
    const { errors } = await checkChatgptPlugin(dir);
    expect(errors).toEqual([
      'mcp.json: taxpresso must be started with node',
      'mcp.json: taxpresso must run ${PLUGIN_ROOT}/server/index.mjs and nothing else',
      'mcp.json: taxpresso may set TAXPRESSO_VAULT_PATH only',
    ]);
  });

  it('reports a test build that pins the tax folder, without refusing it', async () => {
    await validPackage({
      'mcp.json': withServer({ env: { TAXPRESSO_VAULT_PATH: '/tmp/Taxpresso-demo' } }),
    });
    const { errors, notes } = await checkChatgptPlugin(dir);
    expect(errors).toEqual([]);
    expect(notes.join('\n')).toMatch(/a test build: the tax folder is \/tmp\/Taxpresso-demo/);
  });

  it('lets a test build start through the file that fixes its folder, and only a test build', async () => {
    const launch = { args: ['${PLUGIN_ROOT}/server/test-launch.mjs'] };
    await validPackage({
      'mcp.json': withServer({ ...launch, env: { TAXPRESSO_VAULT_PATH: '/tmp/Taxpresso-demo' } }),
      'server/test-launch.mjs': "await import('./index.mjs');\n",
    });
    expect((await checkChatgptPlugin(dir)).errors).toEqual([]);

    await writeFile(path.join(dir, 'mcp.json'), withServer(launch));
    expect((await checkChatgptPlugin(dir)).errors).toEqual([
      'mcp.json: taxpresso must run ${PLUGIN_ROOT}/server/index.mjs and nothing else',
    ]);
  });

  it('refuses another host’s wording, extra frontmatter and the donation link', async () => {
    await validPackage({
      'README.md': '# Taxpresso\n\nInstall the .mcpb in Claude Desktop.\n',
      'skills/taxpresso/SKILL.md': SKILL.replace('---\n\n', 'license: AGPL\n---\n\n'),
      'ui/views/dashboard.html': '<a href="https://preciousplasticbugoma.example">tip</a>',
    });
    const { errors } = await checkChatgptPlugin(dir);
    expect(errors).toEqual([
      'skills/taxpresso/SKILL.md: the frontmatter has name and description only',
      'README.md: names ".mcpb", wording of another package',
      "ui/views/dashboard.html: mentions the donation menu's destination (SPEC.md section 12)",
    ]);
  });

  it('counts the files of the server and the UI that still name Claude', async () => {
    await validPackage({
      'server/index.mjs': 'export const next = "Tell Claude about yourself.";',
    });
    const { errors, notes } = await checkChatgptPlugin(dir);
    expect(errors).toEqual([]);
    expect(notes.join('\n')).toMatch(/1 files of server\/ and ui\/ name Claude/);
  });

  it('compares the server and the UI with the Claude plugin’s, byte for byte', async () => {
    await validPackage();
    const other = path.join(dir, '..', `${path.basename(dir)}-claude`);
    try {
      for (const [name, body] of [
        ['server/index.mjs', 'export {};\n'],
        ['server/zxing_reader.wasm', Buffer.from([0, 0x61, 0x73, 0x6d])],
        ['ui/views/dashboard.html', '<!doctype html><title>Taxpresso</title>'],
        ['ui/dashboard/index.html', '<!doctype html><title>Other</title>'],
      ] as const) {
        await mkdir(path.dirname(path.join(other, name)), { recursive: true });
        await writeFile(path.join(other, name), body);
      }
      const { errors } = await checkChatgptPlugin(dir, { claudePlugin: other });
      expect(errors).toEqual(["1 files of server/ and ui/ differ from the Claude plugin's"]);
    } finally {
      await rm(other, { recursive: true, force: true });
    }
  });
});

describe('the JSON Schema check behind --schemas', () => {
  const server = {
    type: 'object',
    properties: {
      type: { const: 'stdio' },
      command: { type: 'string', minLength: 1 },
      args: { type: 'array', items: { type: 'string' } },
      env: {
        type: 'object',
        propertyNames: { not: { enum: ['PLUGIN_ROOT'] } },
        additionalProperties: { type: 'string' },
      },
      cwd: { type: 'string', pattern: '^\\$\\{PLUGIN_ROOT\\}(?:/|$)' },
    },
    required: ['type', 'command'],
    additionalProperties: false,
  };
  const schema = {
    type: 'object',
    properties: {
      mcpServers: { type: 'object', additionalProperties: { $ref: '#/$defs/server' } },
    },
    required: ['mcpServers'],
    additionalProperties: false,
    $defs: { server: { oneOf: [{ $ref: '#/$defs/stdio' }] }, stdio: server },
  };
  const file = (s: Record<string, unknown>) => ({ mcpServers: { taxpresso: s } });

  it('passes what the build writes', () => {
    expect(validate(schema, file(MCP.mcpServers.taxpresso))).toEqual([]);
  });

  it('catches a wrong type, a missing field, an unknown field and a bad pattern', () => {
    expect(validate(server, { type: 'http', command: 'node' })).toEqual([
      '$.type: must be "stdio"',
    ]);
    expect(validate(server, { type: 'stdio' })).toEqual(['$: command is missing']);
    expect(validate(server, { type: 'stdio', command: 'node', shell: true })).toEqual([
      '$.shell: not a field of the schema',
    ]);
    expect(validate(server, { type: 'stdio', command: 'node', cwd: '/tmp' })[0]).toMatch(
      /^\$\.cwd: doesn't match/,
    );
    expect(validate(server, { type: 'stdio', command: 'node', args: ['a', 1] })).toEqual([
      '$.args[1]: must be text',
    ]);
    expect(validate(server, { type: 'stdio', command: 'node', env: { PLUGIN_ROOT: 'x' } })).toEqual(
      ['$.env.PLUGIN_ROOT (its name): not allowed'],
    );
  });

  it('follows references, and says so when no allowed shape fits', () => {
    expect(validate(schema, file({ command: 'node' }))).toEqual([
      '$.mcpServers.taxpresso: matches 0 of the allowed shapes, not one',
    ]);
    expect(validate(schema, { mcpServers: {}, extra: 1 })).toEqual([
      '$.extra: not a field of the schema',
    ]);
  });

  it('refuses a schema with a keyword it does not know, rather than pass it unchecked', () => {
    expect(validate({ type: 'object', minProperties: 1 }, {})).toEqual([
      "$: the schema uses minProperties, which this check doesn't know",
    ]);
  });
});
