#!/usr/bin/env node
// Pre-submission check of the Claude plugin (build/plugin/taxpresso, `pnpm build:plugin`), offline:
// the rules of Anthropic's plugin directory that can be checked without the developer portal
// (claude.com/docs/plugins/pre-submission-checklist, read 19 October 2026; docs/spikes/S4.md).
//
//   errors  the portal would block the submission, or stop validating it, or the plugin would not
//           install (a bin/ folder) or would break a Taxpresso rule (a donation link, SPEC.md 12)
//   held    the portal would hold the version for an Anthropic reviewer: allowed, reported
//
//   node scripts/check-plugin.mjs [plugin folder] [--zip <file>]
//
// `claude plugin validate` (Claude Code) checks the manifest's schema; this checks the directory's
// own rules. Exit code 1 when there is an error.

import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { parse as parseYaml } from 'yaml';

const KIB = 1024;
const MIB = 1024 * KIB;
/** Over this, a file stops the portal's validation ("Repository too large to validate"). */
export const MAX_FILE = 5 * MIB;
/** Over this, a file that isn't an image or a font is held for a reviewer. */
export const HELD_FILE = 256 * KIB;
/** Over this many files, the plugin is held for a reviewer. */
export const HELD_COUNT = 512;
/** Words a README needs, outside code blocks. */
export const README_WORDS = 40;

const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;
const FONT = /\.(woff2?|ttf|otf)$/i;
const RASTER_SIGNATURES = [
  [/\.png$/i, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  [/\.jpe?g$/i, [0xff, 0xd8, 0xff]],
  [/\.gif$/i, [0x47, 0x49, 0x46, 0x38]],
  [/\.webp$/i, [0x52, 0x49, 0x46, 0x46]],
];
const SYSTEM_FILES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini', '__macosx']);
const WINDOWS_DEVICES = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
/** Names Anthropic keeps (the whole name), and prefixes that pass as Anthropic's own. */
const RESERVED_NAMES = new Set([
  'claude',
  'anthropic',
  'anthropics',
  'official',
  'plugin',
  'mcp',
  'test',
  'claude-code',
  'claude-mods',
]);
const RESERVED_PREFIX = /^(claude|anthropic|anthropics|cc-plugin)-/;
/** The top-level keys of plugin.json (code.claude.com/docs/en/plugins/manifest-reference). */
const MANIFEST_KEYS = new Set([
  '$schema',
  'name',
  'displayName',
  'version',
  'description',
  'author',
  'homepage',
  'repository',
  'license',
  'keywords',
  'metadata',
  'icon',
  'documentationUrl',
  'supportUrl',
  'privacyPolicyUrl',
  'termsOfServiceUrl',
  'defaultEnabled',
  'dependencies',
  'settings',
  'userConfig',
  'types',
  'channels',
  'skills',
  'commands',
  'agents',
  'hooks',
  'mcpServers',
  'lspServers',
  'outputStyles',
  'workflows',
  'experimental',
]);
const COMPONENT_KEYS = [
  'skills',
  'commands',
  'agents',
  'hooks',
  'mcpServers',
  'lspServers',
  'outputStyles',
  'workflows',
  'types',
];
const LISTING_URLS = [
  'homepage',
  'documentationUrl',
  'supportUrl',
  'privacyPolicyUrl',
  'termsOfServiceUrl',
];
/** Commands that download and run a package, or a shell: never how Taxpresso starts its server. */
const LAUNCHERS = new Set([
  'npx',
  'bunx',
  'pnpm',
  'yarn',
  'npm',
  'uvx',
  'pipx',
  'uv',
  'bun',
  'deno',
]);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'fish', 'cmd', 'cmd.exe', 'powershell', 'pwsh']);
const INLINE_FLAGS = new Set([
  '-c',
  '-e',
  '--eval',
  '-p',
  '--print',
  '-r',
  '--require',
  '--import',
  '--loader',
]);
const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json', 'bun.lock', 'bun.lockb'];
/** Where SPEC.md section 12's donation menu points: the .mcpb only, never the plugin. */
const DONATION = /preciousplasticbugoma|precious plastic bugoma/i;

/**
 * Checks a plugin folder.
 * @param {string} dir the plugin folder (the one with .claude-plugin/plugin.json)
 * @returns {Promise<{ errors: string[], held: string[], files: { path: string, size: number }[] }>}
 */
export async function checkPlugin(dir) {
  const errors = [];
  const held = [];
  const root = path.resolve(dir);
  const realRoot = await realpath(root);

  // Every entry, without following links.
  const files = [];
  const walk = async (d, rel) => {
    const entries = await readdir(d, { withFileTypes: true });
    const seen = new Map();
    for (const e of entries) {
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      const lower = e.name.toLowerCase();
      if (seen.has(lower))
        errors.push(
          `${relPath}: differs from ${rel ? `${rel}/` : ''}${seen.get(lower)} only by capitalization`,
        );
      seen.set(lower, e.name);
      if (SYSTEM_FILES.has(lower))
        errors.push(`${relPath}: a macOS or Windows system file; remove it`);
      if (
        [...e.name].some((c) => ':<>"|?*\\'.includes(c) || c.charCodeAt(0) < 0x20) ||
        /[. ]$/.test(e.name) ||
        WINDOWS_DEVICES.test(e.name)
      )
        errors.push(`${relPath}: a name that isn't valid on both Windows and macOS`);
      const abs = path.join(d, e.name);
      const st = await lstat(abs);
      if (st.isSymbolicLink()) {
        errors.push(`${relPath}: a symbolic link; commit regular files`);
        continue;
      }
      if (!(await realpath(abs)).startsWith(realRoot + path.sep))
        errors.push(`${relPath}: resolves outside the plugin folder`);
      if (st.isDirectory()) await walk(abs, relPath);
      else if (st.isFile()) files.push({ path: relPath, size: st.size, abs });
      else errors.push(`${relPath}: not a regular file or folder`);
    }
  };
  await walk(root, '');
  files.sort((a, b) => (a.path < b.path ? -1 : 1));
  const has = (p) => files.some((f) => f.path === p);
  const text = async (p) => readFile(path.join(root, p), 'utf8');

  if (!/^[A-Za-z0-9._-]+$/.test(path.basename(root)))
    errors.push(
      `the plugin folder's name "${path.basename(root)}" may hold letters, digits, dots, hyphens and underscores only`,
    );
  if (files.some((f) => f.path.startsWith('bin/')))
    errors.push(
      'bin/: claude.ai and Cowork refuse to install a plugin with a top-level bin/ folder',
    );

  // Sizes, count, kinds of file.
  for (const f of files) {
    if (f.size >= MAX_FILE)
      errors.push(`${f.path}: ${mib(f.size)}, over the 5 MiB a file may have (validation stops)`);
  }
  if (files.length > HELD_COUNT) held.push(`${files.length} files, over ${HELD_COUNT}`);
  for (const f of files) {
    const bytes = await readFile(f.abs);
    const binary = bytes.subarray(0, 8000).includes(0);
    const signature = RASTER_SIGNATURES.find(([re]) => re.test(f.path));
    if (signature && !signature[1].every((b, i) => bytes[i] === b))
      errors.push(`${f.path}: not a complete image of its kind`);
    if (FONT.test(f.path) || (IMAGE.test(f.path) && !/\.svg$/i.test(f.path))) continue;
    if (binary) held.push(`${f.path}: a binary file (${kib(f.size)}) the validator can't inspect`);
    else if (f.size > HELD_FILE) held.push(`${f.path}: ${kib(f.size)}, over 256 KiB`);
    if (!binary && /\.(m?js|cjs|html)$/i.test(f.path)) {
      const why = unreadable(bytes.toString('utf8'));
      if (why) held.push(`${f.path}: ${why}`);
    }
  }

  // The manifest.
  let manifest;
  if (!has('.claude-plugin/plugin.json')) {
    errors.push('.claude-plugin/plugin.json is missing');
  } else {
    try {
      manifest = JSON.parse(await text('.claude-plugin/plugin.json'));
    } catch (e) {
      errors.push(`.claude-plugin/plugin.json: not valid JSON (${e.message})`);
    }
  }
  if (
    files.some(
      (f) => f.path.startsWith('.claude-plugin/') && f.path !== '.claude-plugin/plugin.json',
    )
  )
    errors.push(
      '.claude-plugin/ may hold plugin.json only; everything else goes at the plugin root',
    );
  if (manifest) {
    const name = manifest.name;
    if (typeof name !== 'string' || !name) errors.push('plugin.json: name is missing');
    else {
      if (/[^\x20-\x7e]/.test(name))
        errors.push(`plugin.json: name "${name}" has non-ASCII characters`);
      else if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(name))
        errors.push(
          `plugin.json: name "${name}" must be lowercase letters, digits and hyphens, at most 64, starting and ending with a letter or digit`,
        );
      if (
        RESERVED_NAMES.has(name.toLowerCase()) ||
        RESERVED_PREFIX.test(name.toLowerCase()) ||
        (/(^|-)official(-|$)/.test(name) && /claude|anthropic/.test(name))
      )
        errors.push(`plugin.json: name "${name}" is reserved`);
    }
    for (const key of ['displayName', 'version', 'description', 'license']) {
      if (typeof manifest[key] !== 'string' || !manifest[key].trim())
        errors.push(`plugin.json: ${key} is missing`);
    }
    if (typeof manifest.author?.name !== 'string' || !manifest.author.name.trim())
      errors.push('plugin.json: author.name is missing');
    for (const [key, value] of [
      ['displayName', manifest.displayName],
      ['author.name', manifest.author?.name],
    ]) {
      if (typeof value === 'string' && hasInvisible(value))
        errors.push(`plugin.json: ${key} has invisible characters`);
    }
    for (const key of Object.keys(manifest)) {
      if (!MANIFEST_KEYS.has(key))
        errors.push(
          `plugin.json: unknown key "${key}" (Claude Code strips it; a misspelled component key blocks submission)`,
        );
    }
    for (const key of Object.keys(manifest.experimental ?? {})) {
      if (COMPONENT_KEYS.includes(key))
        errors.push(`plugin.json: "${key}" belongs at the top level, not in experimental`);
    }
    for (const key of LISTING_URLS) {
      if (manifest[key] === undefined) continue;
      if (typeof manifest[key] !== 'string' || !/^https:\/\/[^\s/]+\.[^\s]+$/.test(manifest[key]))
        errors.push(`plugin.json: ${key} must be an https:// URL`);
    }
    for (const key of ['privacyPolicyUrl', 'supportUrl']) {
      if (manifest[key] === undefined)
        errors.push(
          `plugin.json: ${key} is missing (the directory policy asks for a privacy policy and a support contact)`,
        );
    }
    if (manifest.icon !== undefined) {
      const icon = componentPath(manifest.icon, 'icon', errors);
      if (icon && !has(icon)) errors.push(`plugin.json: icon ${manifest.icon} doesn't exist`);
      else if (icon && !/\.(png|jpe?g|gif|webp|svg)$/i.test(icon))
        errors.push(`plugin.json: icon ${manifest.icon} isn't an image`);
    }
    for (const key of COMPONENT_KEYS) {
      const value = manifest[key];
      if (value === undefined) continue;
      for (const v of [value].flat()) {
        if (typeof v !== 'string') continue; // inline configuration
        if (key === 'skills' && (v === '.' || v === './')) continue;
        if (key === 'mcpServers' && /^https:\/\//.test(v)) {
          errors.push(`plugin.json: mcpServers ${v}: a bundle fetched from a URL`);
          continue;
        }
        const p = componentPath(v, key, errors);
        if (
          p !== undefined &&
          !has(p) &&
          !files.some((f) => f.path.startsWith(`${p.replace(/\/$/, '')}/`))
        )
          errors.push(`plugin.json: ${key} path ${v} doesn't exist`);
        if (key === 'mcpServers' && /\.(mcpb|dxt)$/i.test(v))
          held.push(
            `plugin.json: mcpServers ${v}: a bundled MCP server the validator doesn't inspect`,
          );
      }
    }
  }

  // README and license.
  const readme = files.find((f) => /^readme(\.md|\.txt)?$/i.test(f.path));
  if (!readme) errors.push('README.md is missing');
  else {
    const words = countWords(await text(readme.path));
    if (words < README_WORDS)
      errors.push(
        `${readme.path}: ${words} words outside code blocks; the directory asks for at least ${README_WORDS}`,
      );
  }
  if (!files.some((f) => /^licen[cs]e(\.md|\.txt)?$/i.test(f.path)) && !manifest?.license)
    errors.push('no LICENSE file and no license in plugin.json');

  // The MCP servers.
  if (has('.mcp.json')) {
    let mcp;
    try {
      mcp = JSON.parse(await text('.mcp.json'));
    } catch (e) {
      errors.push(`.mcp.json: not valid JSON (${e.message})`);
    }
    const servers = mcp?.mcpServers;
    if (mcp && (typeof servers !== 'object' || servers === null || Array.isArray(servers)))
      errors.push('.mcp.json: mcpServers must be an object of servers by name');
    for (const [name, server] of Object.entries(servers ?? {})) {
      checkServer(name, server, manifest, has, errors, held);
    }
  }
  if (
    manifest?.mcpServers &&
    typeof manifest.mcpServers === 'object' &&
    !Array.isArray(manifest.mcpServers)
  ) {
    for (const [name, server] of Object.entries(manifest.mcpServers))
      checkServer(name, server, manifest, has, errors, held);
  }

  // A package install at the root.
  if (has('package.json') && LOCKFILES.some(has))
    held.push(
      'package.json beside a lockfile: Claude Code installs its packages when the plugin is installed',
    );

  // Skills: front matter that parses, a text description, the folder's name.
  for (const f of files.filter((x) => /^skills\/[^/]+\/SKILL\.md$/.test(x.path))) {
    const body = await text(f.path);
    const fm = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!fm) {
      errors.push(`${f.path}: no YAML front matter`);
      continue;
    }
    let data;
    try {
      data = parseYaml(fm[1]);
    } catch (e) {
      errors.push(`${f.path}: the front matter doesn't parse (${e.message.split('\n')[0]})`);
      continue;
    }
    if (typeof data?.description !== 'string' || !data.description.trim())
      errors.push(`${f.path}: description must be one text value`);
    else if (data.description.length > 1024)
      errors.push(`${f.path}: description has ${data.description.length} characters, over 1,024`);
    const folder = f.path.split('/')[1];
    if (data?.name !== undefined && data.name !== folder)
      errors.push(`${f.path}: name "${data.name}" differs from its folder "${folder}"`);
  }
  for (const f of files) {
    if (/(^|\/)skill\.md$/i.test(f.path) && !/(^|\/)SKILL\.md$/.test(f.path))
      errors.push(`${f.path}: Claude Code reads SKILL.md, in capitals`);
  }
  if (files.some((f) => /^Skills\//.test(f.path) || /^Hooks\//.test(f.path)))
    errors.push('component folders are lowercase: skills/, hooks/');
  if (has('hooks/hooks.json')) {
    try {
      const hooks = JSON.parse(await text('hooks/hooks.json'));
      if (typeof hooks.hooks !== 'object' && !Array.isArray(hooks.modules))
        errors.push('hooks/hooks.json: needs a top-level hooks object');
    } catch (e) {
      errors.push(`hooks/hooks.json: not valid JSON (${e.message})`);
    }
  }

  // Markdown naming a bundled image or font in code, and Taxpresso's own rule: no donation link.
  const assets = files
    .filter((f) => IMAGE.test(f.path) || FONT.test(f.path))
    .map((f) => path.basename(f.path));
  for (const f of files) {
    if (!/\.(md|txt|json|m?js|cjs|html|css|svg|sh)$/i.test(f.path)) continue;
    const body = await text(f.path);
    if (DONATION.test(body))
      errors.push(
        `${f.path}: mentions the donation menu's destination; the plugin carries no donation link (SPEC.md section 12)`,
      );
    if (/\.md$/i.test(f.path)) {
      const code = [...body.matchAll(/```[\s\S]*?```|`[^`\n]+`/g)].map((m) => m[0]).join('\n');
      const named = assets.filter((a) => code.includes(a));
      if (named.length)
        held.push(
          `${f.path}: names ${named.join(', ')} in code; show an image with Markdown image syntax instead`,
        );
    }
  }

  return { errors, held, files: files.map(({ path: p, size }) => ({ path: p, size })) };
}

/** Zero-width and direction characters, which can hide inside a name. */
function hasInvisible(s) {
  return [...s].some((c) => {
    const n = c.codePointAt(0) ?? 0;
    return (
      (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) || n === 0x2060 || n === 0xfeff
    );
  });
}

/** A component path: "./" first, no "..", inside the folder. Returns it without "./". */
function componentPath(value, key, errors) {
  if (typeof value !== 'string' || !value.startsWith('./')) {
    errors.push(`plugin.json: ${key} path ${JSON.stringify(value)} must start with ./`);
    return undefined;
  }
  if (value.split('/').includes('..')) {
    errors.push(`plugin.json: ${key} path ${value} contains ".."`);
    return undefined;
  }
  return path.posix.normalize(value.slice(2)).replace(/\/$/, '');
}

function checkServer(name, server, manifest, has, errors, held) {
  const where = `.mcp.json: server "${name}"`;
  if (typeof server !== 'object' || server === null) {
    errors.push(`${where}: not an object`);
    return;
  }
  if (server.url !== undefined || (server.type !== undefined && server.type !== 'stdio')) {
    if (!['http', 'sse', 'ws'].includes(server.type))
      errors.push(`${where}: a remote server needs type http, sse or ws`);
    if (
      typeof server.url !== 'string' ||
      !(
        /^(https|wss):\/\//.test(server.url) ||
        /^\$\{user_config\.\w+\}$/.test(server.url) ||
        server.url === ''
      )
    )
      errors.push(`${where}: the url must be an https:// or wss:// URL`);
    return;
  }
  if (typeof server.command !== 'string' || !server.command) {
    errors.push(`${where}: needs a command and args, or a url`);
    return;
  }
  const command = server.command;
  const args = server.args ?? [];
  if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) {
    errors.push(`${where}: args must be a list of strings`);
    return;
  }
  const words = [command, ...args];
  const base = path.basename(command).toLowerCase();
  if (LAUNCHERS.has(base))
    held.push(`${where}: starts through ${base}, which the validator doesn't read as a plain file`);
  if (SHELLS.has(base)) held.push(`${where}: starts through a shell (${base})`);
  if (args.some((a) => INLINE_FLAGS.has(a)))
    held.push(
      `${where}: passes an inline program or preload (${args.find((a) => INLINE_FLAGS.has(a))})`,
    );
  if (/[\s;&|`$()]/.test(command) && !command.startsWith('${CLAUDE_PLUGIN_ROOT}/'))
    errors.push(
      `${where}: the command ${JSON.stringify(command)} must be a program name, with arguments in args`,
    );
  for (const w of words) {
    for (const v of w.matchAll(/\$\{([^}]+)\}/g)) {
      const key = v[1];
      const option = key.match(/^user_config\.(\w+)$/)?.[1];
      if (option !== undefined) {
        if (!manifest?.userConfig?.[option])
          errors.push(`${where}: \${${key}} refers to an option plugin.json doesn't declare`);
      } else if (key !== 'CLAUDE_PLUGIN_ROOT') {
        errors.push(
          `${where}: \${${key}}: paths are written in full from \${CLAUDE_PLUGIN_ROOT}, with no other variable`,
        );
      }
    }
    if (/\$\(|`|[*?]/.test(w))
      errors.push(`${where}: ${JSON.stringify(w)} has a command substitution or a wildcard`);
    if (w.split(/[\\/]/).includes('..'))
      errors.push(`${where}: ${JSON.stringify(w)} leaves the plugin folder`);
  }
  // The file it runs: in the plugin, written from ${CLAUDE_PLUGIN_ROOT}.
  const file = words.find((w) => w.startsWith('${CLAUDE_PLUGIN_ROOT}/'));
  if (!file) errors.push(`${where}: runs no file of the plugin (\${CLAUDE_PLUGIN_ROOT}/<file>)`);
  else {
    const rel = file.slice('${CLAUDE_PLUGIN_ROOT}/'.length);
    if (!has(rel)) errors.push(`${where}: ${file} doesn't exist in the plugin`);
    else if (!/\.(sh|bash)$/.test(rel))
      held.push(
        `${where}: runs ${rel}, not a shell script: held ("Scripts the validator couldn't follow") when the plugin folder is a subfolder of its repository, not at a repository's root`,
      );
    if (/\.(mcpb|dxt)$/i.test(rel))
      held.push(`${where}: a bundled MCP server the validator doesn't inspect`);
  }
}

/**
 * Why code may read as minified or packed to the security scan ("commit readable source"), or
 * undefined. Measured on Taxpresso's builds (docs/spikes/S4.md): in readable esbuild output at
 * most about a quarter of the names it declares (var, let, const, function, class) have one or two
 * letters, and few lines are long; in minified code half or more do, or most of its bytes are in
 * long lines; packed data is one very long line.
 */
export function unreadable(code) {
  const lines = code.split('\n');
  const longest = Math.max(...lines.map((l) => l.length));
  if (longest > 10_000) return `a line of ${longest} characters (packed data or code)`;
  const longShare =
    lines.filter((l) => l.length > 500).reduce((n, l) => n + l.length, 0) / (code.length || 1);
  if (longShare > 0.5)
    return `${Math.round(longShare * 100)} % of it in lines over 500 characters (minified)`;
  const bare = code.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');
  const declared = [...bare.matchAll(/\b(?:var|let|const|function|class)\s+([A-Za-z_$][\w$]*)/g)];
  const short = declared.filter((m) => m[1].length <= 2).length / (declared.length || 1);
  if (declared.length >= 50 && short > 0.4)
    return `${Math.round(short * 100)} % of the names it declares have one or two letters (minified)`;
  return undefined;
}

/** Words outside fenced code blocks, as the directory counts them. */
export function countWords(markdown) {
  const prose = markdown.replace(/```[\s\S]*?```/g, ' ').replace(/~~~[\s\S]*?~~~/g, ' ');
  return prose.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** The entries of a ZIP's central directory, and their contents (stored or deflated). */
export async function readZip(file) {
  const buf = await readFile(file);
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error(`${file}: not a ZIP file`);
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const compressed = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + compressed);
    entries.push({ name, data: method === 8 ? inflateRawSync(raw) : raw });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/**
 * Checks the zip for Upload plugin against the folder: the manifest at .claude-plugin/plugin.json
 * at the root or inside one top-level folder, and the same files with the same bytes.
 */
export async function checkZip(file, dir) {
  const errors = [];
  const entries = (await readZip(file)).filter((e) => !e.name.endsWith('/'));
  const tops = new Set(entries.map((e) => e.name.split('/')[0]));
  const prefix = entries.some((e) => e.name === '.claude-plugin/plugin.json')
    ? ''
    : tops.size === 1 &&
        entries.some((e) => e.name === `${[...tops][0]}/.claude-plugin/plugin.json`)
      ? `${[...tops][0]}/`
      : undefined;
  if (prefix === undefined) {
    errors.push(
      `${path.basename(file)}: .claude-plugin/plugin.json must be at the root, or inside a single top-level folder`,
    );
    return errors;
  }
  const inZip = new Map(entries.map((e) => [e.name.slice(prefix.length), e.data]));
  const { files } = await checkPlugin(dir);
  for (const f of files) {
    const data = inZip.get(f.path);
    if (!data) errors.push(`${path.basename(file)}: ${f.path} is missing`);
    else if (!data.equals(await readFile(path.join(dir, f.path))))
      errors.push(`${path.basename(file)}: ${f.path} differs from the folder`);
    inZip.delete(f.path);
  }
  for (const extra of inZip.keys())
    errors.push(`${path.basename(file)}: ${extra} isn't in the folder`);
  return errors;
}

const kib = (n) => `${Math.round(n / KIB)} KiB`;
const mib = (n) => `${(n / MIB).toFixed(1)} MiB`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  const zipAt = args.indexOf('--zip');
  let zip = zipAt >= 0 ? args.splice(zipAt, 2)[1] : undefined;
  const dir = path.resolve(args[0] ?? path.join(root, 'build', 'plugin', 'taxpresso'));
  if (zip === undefined && args[0] === undefined) {
    const { version } = JSON.parse(
      await readFile(path.join(root, 'extension', 'package.json'), 'utf8'),
    );
    zip = path.join(root, 'build', `taxpresso-plugin-${version}.zip`);
  }
  let result;
  try {
    result = await checkPlugin(dir);
  } catch (e) {
    console.error(`check-plugin: can't read ${dir} (${e.message}). Run: pnpm build:plugin`);
    process.exit(1);
  }
  if (zip) result.errors.push(...(await checkZip(zip, dir)));
  const total = result.files.reduce((n, f) => n + f.size, 0);
  console.log(
    `check-plugin: ${path.relative(process.cwd(), dir) || '.'}: ${result.files.length} files, ${mib(total)}` +
      (zip ? `; ${path.relative(process.cwd(), zip)}` : ''),
  );
  if (result.held.length)
    console.log(
      `  Would be held for a reviewer (${result.held.length}):\n    ${result.held.join('\n    ')}`,
    );
  if (result.errors.length) {
    console.error(`  Would block (${result.errors.length}):\n    ${result.errors.join('\n    ')}`);
    process.exit(1);
  }
  console.log('  Would block: nothing.');
}
