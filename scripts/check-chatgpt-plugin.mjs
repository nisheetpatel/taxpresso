#!/usr/bin/env node
// Checks the ChatGPT plugin (build/chatgpt-plugin/taxpresso, `pnpm build:chatgpt`; spike S6,
// docs/spikes/S6.md) against what OpenAI documents for a plugin with a local server
// (developers.openai.com/plugins/build/plugins.md, deploy/desktop-only.md, deploy/submission.md,
// build/skills.md, read 27 November 2026): the files and their places, the manifest's fields and
// limits, how the server starts, the skill's frontmatter, the icons, and Taxpresso's own rules (no
// donation link, the wording we wrote names ChatGPT only).
//
//   node scripts/check-chatgpt-plugin.mjs [plugin folder]             offline
//   node scripts/check-chatgpt-plugin.mjs [plugin folder] --schemas   also fetches the two JSON
//       schemas the files name (agent-plugins.org) and validates against them: a development
//       step that needs the network, like scripts/fetch-sources.mjs
//
// It can't tell whether the ChatGPT desktop app accepts the package: that is S6's [HUMAN] test.
// Exit code 1 when there is an error.

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const MIB = 1024 * 1024;
const PLUGIN_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
const MCP_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json';
/** Where SPEC.md section 12's donation menu points: the .mcpb only, never a plugin. */
const DONATION = /preciousplasticbugoma|precious plastic bugoma/i;
/** Wording of the other packages, which the files written for ChatGPT must not carry. */
const OTHER_HOST = /claude|cowork|\.mcpb/i;
const TEXT_FILE = /\.(md|json|mjs|js|html|css|txt|yaml|yml)$/i;
/** A test build's entry point (build-chatgpt-plugin.mjs --vault): it fixes the tax folder. */
const TEST_LAUNCH = 'server/test-launch.mjs';
/** What a package for ChatGPT never has: the other formats' files, and what a plugin never ships. */
const FORBIDDEN = [
  '.claude-plugin',
  '.codex-plugin',
  '.mcp.json',
  '.agents',
  'bin',
  'node_modules',
];

/** Every file under a folder, as paths relative to it, sorted. */
async function listFiles(dir, rel = '') {
  const out = [];
  for (const e of await readdir(path.join(dir, rel), { withFileTypes: true })) {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await listFiles(dir, p)));
    else out.push(p);
  }
  return out.sort();
}

/**
 * Checks a ChatGPT plugin folder.
 * @param {string} dir the folder with plugin.json and mcp.json at its root
 * @param {{ claudePlugin?: string }} [opts] the Claude plugin's folder, to compare server/ and ui/
 * @returns {Promise<{ errors: string[], notes: string[], files: string[] }>}
 */
export async function checkChatgptPlugin(dir, opts = {}) {
  const errors = [];
  const notes = [];
  const root = path.resolve(dir);
  const files = await listFiles(root);
  const has = (f) => files.includes(f);
  const text = (f) => readFile(path.join(root, f), 'utf8');

  for (const f of [
    'plugin.json',
    'mcp.json',
    'skills/taxpresso/SKILL.md',
    'server/index.mjs',
    'server/zxing_reader.wasm',
    'ui/views/dashboard.html',
    'ui/dashboard/index.html',
    'README.md',
    'LICENSE',
    'THIRD_PARTY_NOTICES.txt',
  ])
    if (!has(f)) errors.push(`${f}: missing`);
  for (const name of FORBIDDEN)
    if (files.some((f) => f === name || f.startsWith(`${name}/`)))
      errors.push(`${name}: not in a package for ChatGPT`);
  if (files.some((f) => /(^|\/)(package\.json|marketplace\.json)$/.test(f)))
    errors.push('a package.json or marketplace.json is inside the package');
  if (errors.length) return { errors, notes, files };

  // plugin.json: the portable fields, then OpenAI's listing fields and their limits.
  const plugin = JSON.parse(await text('plugin.json'));
  const str = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
  const https = (v) => str(v, 1024) && /^https:\/\/[^@\s]+$/.test(v);
  if (plugin.$schema !== PLUGIN_SCHEMA) errors.push(`plugin.json: $schema is not ${PLUGIN_SCHEMA}`);
  if (!str(plugin.name, 64) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(plugin.name))
    errors.push(
      'plugin.json: name must be lowercase letters, digits and single hyphens, 64 at most',
    );
  if (!/^\d+\.\d+\.\d+$/.test(plugin.version ?? ''))
    errors.push('plugin.json: version must be an explicit x.y.z');
  if (!str(plugin.description, 4000))
    errors.push('plugin.json: description, 4000 characters at most');
  if (!str(plugin.author?.name, 120))
    errors.push('plugin.json: author.name, 120 characters at most');
  if ((plugin.keywords ?? []).length > 25) errors.push('plugin.json: 25 keywords at most');
  const ui = plugin.extensions?.['com.openai']?.interface;
  if (!ui) errors.push('plugin.json: extensions["com.openai"].interface is missing');
  else {
    const limits = {
      displayName: 30,
      shortDescription: 30,
      longDescription: 4000,
      developerName: 80,
    };
    for (const [key, max] of Object.entries(limits))
      if (!str(ui[key], max))
        errors.push(`plugin.json: interface.${key}, ${max} characters at most`);
    if (!str(ui.category, 64)) errors.push('plugin.json: interface.category is missing');
    const caps = ui.capabilities;
    if (!Array.isArray(caps) || caps.length > 20 || caps.some((c) => !str(c, 120)))
      errors.push('plugin.json: interface.capabilities, 20 at most, 120 characters each');
    for (const key of ['websiteURL', 'supportURL', 'privacyPolicyURL'])
      if (!https(ui[key])) errors.push(`plugin.json: interface.${key} must be an https URL`);
    if (ui.termsOfServiceURL === undefined)
      notes.push(
        'no termsOfServiceURL: OpenAI asks for one at a public submission (not for a local test)',
      );
    else if (!https(ui.termsOfServiceURL))
      errors.push('plugin.json: interface.termsOfServiceURL must be an https URL');
    const prompts = [ui.defaultPrompt ?? []].flat();
    if (
      prompts.length > 3 ||
      prompts.some((p) => !str(p, 128)) ||
      new Set(prompts).size !== prompts.length
    )
      errors.push(
        'plugin.json: interface.defaultPrompt, 3 at most, 128 characters each, all different',
      );
    for (const key of ['composerIcon', 'logo']) {
      const rel = ui[key];
      if (typeof rel !== 'string' || !rel.startsWith('./') || !has(rel.slice(2))) {
        errors.push(`plugin.json: interface.${key} must be a ./ path to a file of the package`);
        continue;
      }
      const bytes = await readFile(path.join(root, rel.slice(2)));
      const png = bytes
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      const [w, h] = png ? [bytes.readUInt32BE(16), bytes.readUInt32BE(20)] : [0, 0];
      if (!png || w !== h || w < 48 || w > 4096 || bytes.length > 5 * MIB)
        errors.push(`${rel}: must be a square PNG, 48 to 4096 px, 5 MiB at most (it is ${w}x${h})`);
    }
  }

  // mcp.json: one local server, started with node from the plugin's own folder.
  const mcp = JSON.parse(await text('mcp.json'));
  if (mcp.$schema !== MCP_SCHEMA) errors.push(`mcp.json: $schema is not ${MCP_SCHEMA}`);
  const servers = Object.entries(mcp.mcpServers ?? {});
  if (servers.length !== 1)
    errors.push('mcp.json: exactly one server (OpenAI lists one per plugin)');
  for (const [name, s] of servers) {
    if (s.type !== 'stdio') errors.push(`mcp.json: ${name} must have "type": "stdio"`);
    if (s.command !== 'node') errors.push(`mcp.json: ${name} must be started with node`);
    // A test build (--vault) starts through server/test-launch.mjs, which fixes the tax folder.
    const pinned = typeof s.env?.TAXPRESSO_VAULT_PATH === 'string' && has(TEST_LAUNCH);
    const entry = pinned ? TEST_LAUNCH : 'server/index.mjs';
    if (JSON.stringify(s.args) !== JSON.stringify([`\${PLUGIN_ROOT}/${entry}`]))
      errors.push(`mcp.json: ${name} must run \${PLUGIN_ROOT}/${entry} and nothing else`);
    if (s.cwd !== undefined && s.cwd !== '${PLUGIN_ROOT}')
      errors.push(`mcp.json: ${name}'s working directory must be \${PLUGIN_ROOT}`);
    // A test build may pin the tax folder (build-chatgpt-plugin.mjs --vault); nothing else is set.
    const env = Object.keys(s.env ?? {});
    if (env.some((k) => k !== 'TAXPRESSO_VAULT_PATH'))
      errors.push(`mcp.json: ${name} may set TAXPRESSO_VAULT_PATH only`);
    else if (env.length)
      notes.push(`a test build: the tax folder is ${s.env.TAXPRESSO_VAULT_PATH}, never ship it`);
  }

  // The skill: OpenAI documents two frontmatter fields, name and description.
  const skill = await text('skills/taxpresso/SKILL.md');
  const front = skill.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = front ? parseYaml(front[1]) : undefined;
  if (!meta) errors.push('skills/taxpresso/SKILL.md: no frontmatter');
  else {
    if (Object.keys(meta).sort().join() !== 'description,name')
      errors.push('skills/taxpresso/SKILL.md: the frontmatter has name and description only');
    if (meta.name !== 'taxpresso') errors.push('skills/taxpresso/SKILL.md: name must be taxpresso');
  }

  // What we wrote for ChatGPT names no other host; nothing in the package carries the donation link.
  // (A test build's folder is a path on this computer, not wording: it is left out.)
  const mcpWording = JSON.stringify(mcp, (key, value) => (key === 'env' ? undefined : value));
  for (const f of ['plugin.json', 'mcp.json', 'skills/taxpresso/SKILL.md', 'README.md']) {
    const hit = (f === 'mcp.json' ? mcpWording : await text(f)).match(OTHER_HOST);
    if (hit) errors.push(`${f}: names "${hit[0]}", wording of another package`);
  }
  let naming = 0;
  for (const f of files.filter((n) => TEXT_FILE.test(n))) {
    const body = await text(f);
    if (DONATION.test(body))
      errors.push(`${f}: mentions the donation menu's destination (SPEC.md section 12)`);
    if (/^(server|ui)\//.test(f) && /\bClaude\b/.test(body)) naming += 1;
  }
  if (naming)
    notes.push(`${naming} files of server/ and ui/ name Claude in their wording (S6, finding 1)`);

  // server/ and ui/ are the Claude plugin's files, byte for byte.
  if (opts.claudePlugin) {
    let differ = 0;
    const theirs = (await listFiles(opts.claudePlugin)).filter((f) => /^(server|ui)\//.test(f));
    const ours = files.filter((f) => /^(server|ui)\//.test(f) && f !== TEST_LAUNCH);
    if (theirs.join() !== ours.join())
      errors.push("server/ and ui/ are not the Claude plugin's files");
    else
      for (const f of ours)
        if (
          !(await readFile(path.join(root, f))).equals(
            await readFile(path.join(opts.claudePlugin, f)),
          )
        )
          differ += 1;
    if (differ) errors.push(`${differ} files of server/ and ui/ differ from the Claude plugin's`);
  }
  return { errors, notes, files };
}

/**
 * A JSON Schema check for the two small schemas the files name. It knows the keywords they use and
 * refuses any other, so a schema that changes is reported, never passed without being checked.
 * @returns {string[]} what is wrong, as "path: reason"
 */
export function validate(schema, value, at = '$', rootSchema = schema) {
  const KNOWN = new Set([
    '$schema', '$id', '$defs', '$ref', 'title', 'description', 'type', 'properties', 'required',
    'additionalProperties', 'items', 'const', 'enum', 'pattern', 'minLength', 'maxLength', 'oneOf',
    'not', 'propertyNames',
  ]); // prettier-ignore
  const unknown = Object.keys(schema).filter((k) => !KNOWN.has(k));
  if (unknown.length)
    return [`${at}: the schema uses ${unknown.join(', ')}, which this check doesn't know`];
  if (schema.$ref) {
    const target = schema.$ref.match(/^#\/\$defs\/(\w+)$/)?.[1];
    if (!target || !rootSchema.$defs?.[target]) return [`${at}: can't follow ${schema.$ref}`];
    return validate(rootSchema.$defs[target], value, at, rootSchema);
  }
  const errors = [];
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  if (schema.type === 'object' && !isObject) return [`${at}: must be an object`];
  if (schema.type === 'array' && !Array.isArray(value)) return [`${at}: must be a list`];
  if (schema.type === 'string' && typeof value !== 'string') return [`${at}: must be text`];
  if ('const' in schema && value !== schema.const)
    errors.push(`${at}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value))
    errors.push(`${at}: not one of ${schema.enum.join(', ')}`);
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength)
      errors.push(`${at}: too short`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength)
      errors.push(`${at}: too long`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value))
      errors.push(`${at}: doesn't match ${schema.pattern}`);
  }
  if (schema.not && validate(schema.not, value, at, rootSchema).length === 0)
    errors.push(`${at}: not allowed`);
  if (schema.oneOf) {
    const matching = schema.oneOf.filter((s) => validate(s, value, at, rootSchema).length === 0);
    if (matching.length !== 1)
      errors.push(`${at}: matches ${matching.length} of the allowed shapes, not one`);
  }
  if (Array.isArray(value) && schema.items)
    value.forEach((v, i) => errors.push(...validate(schema.items, v, `${at}[${i}]`, rootSchema)));
  if (isObject) {
    for (const key of schema.required ?? [])
      if (!(key in value)) errors.push(`${at}: ${key} is missing`);
    for (const [key, v] of Object.entries(value)) {
      if (schema.propertyNames)
        errors.push(...validate(schema.propertyNames, key, `${at}.${key} (its name)`, rootSchema));
      const own = schema.properties?.[key];
      if (own) errors.push(...validate(own, v, `${at}.${key}`, rootSchema));
      else if (schema.additionalProperties === false)
        errors.push(`${at}.${key}: not a field of the schema`);
      else if (typeof schema.additionalProperties === 'object')
        errors.push(...validate(schema.additionalProperties, v, `${at}.${key}`, rootSchema));
    }
  }
  return errors;
}

/** Fetches the schemas plugin.json and mcp.json name, and validates the two files. Needs the network. */
async function checkSchemas(dir) {
  const errors = [];
  for (const [file, url] of [
    ['plugin.json', PLUGIN_SCHEMA],
    ['mcp.json', MCP_SCHEMA],
  ]) {
    let schema;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      schema = await res.json();
    } catch (e) {
      errors.push(`${url}: can't be fetched (${e.message})`);
      continue;
    }
    const value = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    errors.push(...validate(schema, value).map((m) => `${file} against its schema: ${m}`));
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  const schemas = args.includes('--schemas');
  const dir = path.resolve(
    args.find((a) => !a.startsWith('--')) ??
      path.join(root, 'build', 'chatgpt-plugin', 'taxpresso'),
  );
  const claudePlugin = path.join(root, 'build', 'plugin', 'taxpresso');
  let result;
  try {
    const compare = await stat(claudePlugin).then(
      () => true,
      () => false,
    );
    result = await checkChatgptPlugin(dir, compare ? { claudePlugin } : {});
  } catch (e) {
    console.error(
      `check-chatgpt-plugin: can't read ${dir} (${e.message}). Run: pnpm build:chatgpt`,
    );
    process.exit(1);
  }
  if (schemas && !result.errors.length) result.errors.push(...(await checkSchemas(dir)));
  console.log(
    `check-chatgpt-plugin: ${path.relative(process.cwd(), dir) || '.'}: ${result.files.length} files` +
      (schemas ? ', with the published schemas' : ''),
  );
  for (const note of result.notes) console.log(`  Note: ${note}`);
  if (result.errors.length) {
    console.error(`  Wrong (${result.errors.length}):\n    ${result.errors.join('\n    ')}`);
    process.exit(1);
  }
  console.log('  Wrong: nothing.');
}
