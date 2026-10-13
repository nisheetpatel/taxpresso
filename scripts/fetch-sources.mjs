#!/usr/bin/env node
// Downloads every official document listed in docs/sources/manifest.json into
// docs/sources/<canton>/files/<id>.<ext>, checks each file's type, and records
// size and sha256 in docs/sources/lock.json.
//
// Usage:
//   node scripts/fetch-sources.mjs                 download everything not yet downloaded
//   node scripts/fetch-sources.mjs --canton ge,ch  only these (codes as in the manifest)
//   node scripts/fetch-sources.mjs --core          only entries with priority "core"
//   node scripts/fetch-sources.mjs --force         re-download even if present
//   node scripts/fetch-sources.mjs --check         re-download in memory and report documents
//                                                  whose content changed since lock.json
//   node scripts/fetch-sources.mjs --dir <path>    use another sources folder (tests)
//
// Node 18+ only, no dependencies. Exits 1 if any core document fails.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.resolve(opt('--dir') ?? path.join(repoRoot, 'docs', 'sources'));
const cantons = opt('--canton')?.split(',').map((s) => s.trim().toUpperCase());
const coreOnly = has('--core');
const force = has('--force');
const checkOnly = has('--check');

const CONCURRENCY = 3;
const TIMEOUT_MS = 90_000;
const MAX_BYTES = 80 * 1024 * 1024;
const USER_AGENT = 'Taxpresso-sources-fetcher/1.0 (official tax documents for a local tax assistant)';

const folderFor = (canton) => (canton === 'STD' ? 'standards' : canton.toLowerCase());

function looksRight(format, buf) {
  const head = buf.subarray(0, 8).toString('latin1');
  const start = buf.subarray(0, 4096).toString('utf8').trimStart();
  switch (format) {
    case 'pdf':
      return head.startsWith('%PDF');
    case 'xlsx':
    case 'zip':
      return head.startsWith('PK');
    case 'xls':
      return buf[0] === 0xd0 && buf[1] === 0xcf;
    case 'html':
      return /<(!doctype|html|head|body)/i.test(start);
    case 'xml':
    case 'xsd':
      return start.startsWith('<');
    default:
      return buf.length > 0;
  }
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function download(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) throw new Error(`too large (${declared} bytes)`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`too large (${buf.length} bytes)`);
  return { buf, contentType: res.headers.get('content-type') ?? '', finalUrl: res.url };
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(srcDir, 'manifest.json'), 'utf8'));
  const lockPath = path.join(srcDir, 'lock.json');
  const lock = (await exists(lockPath)) ? JSON.parse(await readFile(lockPath, 'utf8')) : {};

  const entries = manifest.entries.filter(
    (e) => (!cantons || cantons.includes(e.canton)) && (!coreOnly || e.priority === 'core'),
  );

  const results = { ok: 0, skipped: 0, changed: [], failed: [] };
  const queue = [...entries];

  async function worker() {
    for (let e = queue.shift(); e; e = queue.shift()) {
      const dir = path.join(srcDir, folderFor(e.canton), 'files');
      const file = path.join(dir, `${e.id}.${e.format}`);
      const rel = path.relative(srcDir, file);

      if (!force && !checkOnly && lock[e.id]?.status === 'ok' && (await exists(file))) {
        results.skipped++;
        continue;
      }
      try {
        const { buf, contentType, finalUrl } = await download(e.url);
        if (!looksRight(e.format, buf)) {
          throw new Error(`expected ${e.format}, got content-type "${contentType}"`);
        }
        const sha256 = createHash('sha256').update(buf).digest('hex');
        if (checkOnly) {
          if (lock[e.id]?.sha256 && lock[e.id].sha256 !== sha256) results.changed.push(e.id);
          results.ok++;
          continue;
        }
        await mkdir(dir, { recursive: true });
        await writeFile(file, buf);
        lock[e.id] = {
          url: e.url,
          final_url: finalUrl,
          file: rel,
          bytes: buf.length,
          sha256,
          content_type: contentType,
          retrieved_at: new Date().toISOString(),
          status: 'ok',
        };
        results.ok++;
        console.log(`ok      ${e.id} (${Math.round(buf.length / 1024)} KB)`);
      } catch (err) {
        results.failed.push({ id: e.id, priority: e.priority, url: e.url, error: String(err.message ?? err) });
        if (!checkOnly) lock[e.id] = { url: e.url, status: 'failed', error: String(err.message ?? err), tried_at: new Date().toISOString() };
        console.log(`FAILED  ${e.id}: ${err.message ?? err}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (!checkOnly) await writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n');

  console.log(`\n${results.ok} ok, ${results.skipped} already present, ${results.failed.length} failed`);
  if (results.changed.length) {
    console.log(`\nChanged since last download (re-check rules that cite them):\n  ${results.changed.join('\n  ')}`);
  }
  if (results.failed.length) {
    console.log('\nFailed (fix the URL in the canton manifest, regenerate, rerun):');
    for (const f of results.failed) console.log(`  [${f.priority}] ${f.id}  ${f.url}  ${f.error}`);
  }
  process.exit(results.failed.some((f) => f.priority === 'core') ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
