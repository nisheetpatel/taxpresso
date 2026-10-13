// The vault (SPEC.md section 3): a normal folder the user owns, e.g. ~/Documents/Taxpresso/2026/
// with documents/, ledger.json, documents.json and filing/. Transparent beats clever.
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { KeyRegistry } from './keys.js';
import { Ledger, type LedgerFile } from './ledger.js';
import type { VaultDocument } from './types.js';

export const MAX_DOCUMENT_BYTES = 40 * 1024 * 1024;
const OWN_FILES = new Set([
  'ledger.json',
  'documents.json',
  'decisions.json',
  'questionnaire.json',
  'entered.json',
  'README.txt',
]);

const README = (year: number) => `Taxpresso: your tax files for ${year}

This folder belongs to you. Taxpresso keeps here, on this computer only:
- documents/: copies of the documents you gave it
- ledger.json: every value you or your documents provided, with where it came from
- documents.json: the list of documents and what they are

You can back up, move or delete this folder. Deleting it deletes your Taxpresso data for ${year}.
`;

export class VaultError extends Error {}

/** The first folder above `dir` (or `dir` itself) that is a git working tree, if any. */
export function gitRepoAbove(dir: string): string | undefined {
  let current = path.resolve(dir);
  for (;;) {
    if (existsSync(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

/** A file name that is safe on macOS and Windows, keeping as much of the original as possible. */
export function safeFilename(name: string): string {
  const base = path.basename(name.replace(/\\/g, '/')).normalize('NFC');
  const cleaned = base
    // Control characters and characters Windows or macOS reject in file names.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  const ext = path.extname(cleaned).slice(0, 12);
  const stem = cleaned.slice(0, cleaned.length - ext.length).slice(0, 100);
  return (stem || 'document') + ext;
}

async function writeAtomic(file: string, data: string | Uint8Array): Promise<void> {
  const tmp = `${file}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`;
  await writeFile(tmp, data);
  await rename(tmp, file);
}

export class Vault {
  readonly root: string;
  readonly taxYear: number;

  constructor(root: string, taxYear: number) {
    this.root = path.resolve(root);
    this.taxYear = taxYear;
  }

  /** The tax-year folder, e.g. ~/Documents/Taxpresso/2026. */
  get dir(): string {
    return path.join(this.root, String(this.taxYear));
  }

  exists(): boolean {
    return existsSync(this.dir);
  }

  /** Why this vault can't be used, if it can't. Real tax documents must never land in a git repo. */
  problem(): string | undefined {
    const repo = gitRepoAbove(this.root);
    if (repo) {
      return `Your Taxpresso folder ${this.root} is inside a code repository (${repo}). Choose a folder outside it, so your tax documents can never be committed.`;
    }
    return undefined;
  }

  /** Creates the folders on first use. Read-only operations never call this. */
  async ensure(): Promise<void> {
    const problem = this.problem();
    if (problem) throw new VaultError(problem);
    await mkdir(path.join(this.dir, 'documents'), { recursive: true });
    const readme = path.join(this.dir, 'README.txt');
    if (!existsSync(readme)) await writeAtomic(readme, README(this.taxYear));
  }

  async loadLedger(keys: KeyRegistry): Promise<Ledger> {
    const file = await this.#readJson<LedgerFile>('ledger.json');
    return file ? Ledger.fromJSON(file, keys) : new Ledger(this.taxYear, keys);
  }

  async saveLedger(ledger: Ledger): Promise<void> {
    await this.ensure();
    await writeAtomic(
      path.join(this.dir, 'ledger.json'),
      JSON.stringify(ledger.toJSON(), null, 2) + '\n',
    );
  }

  async loadDocuments(): Promise<VaultDocument[]> {
    return (
      (await this.#readJson<{ documents: VaultDocument[] }>('documents.json'))?.documents ?? []
    );
  }

  async saveDocuments(documents: VaultDocument[]): Promise<void> {
    await this.ensure();
    await writeAtomic(
      path.join(this.dir, 'documents.json'),
      JSON.stringify({ version: 1, documents }, null, 2) + '\n',
    );
  }

  async readState<T>(name: string, fallback: T): Promise<T> {
    return (await this.#readJson<T>(name)) ?? fallback;
  }

  async writeState(name: string, value: unknown): Promise<void> {
    if (!OWN_FILES.has(name)) throw new VaultError(`Not a Taxpresso state file: ${name}`);
    await this.ensure();
    await writeAtomic(path.join(this.dir, name), JSON.stringify(value, null, 2) + '\n');
  }

  /**
   * Stores a copy of a document in documents/, named by its sha256 prefix and original name.
   * The same content twice is a no-op (SPEC.md section 5.6).
   */
  async addDocument(
    bytes: Uint8Array,
    filename: string,
    known: VaultDocument[],
    now = new Date(),
  ): Promise<{ document: VaultDocument; duplicate: boolean }> {
    if (bytes.length === 0) throw new VaultError('The file is empty.');
    if (bytes.length > MAX_DOCUMENT_BYTES) throw new VaultError('The file is larger than 40 MB.');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const existing = known.find((d) => d.sha256 === sha256);
    if (existing) return { document: existing, duplicate: true };
    await this.ensure();
    const name = `${sha256.slice(0, 8)}-${safeFilename(filename)}`;
    await writeAtomic(path.join(this.dir, 'documents', name), bytes);
    return {
      document: newDocument(sha256, safeFilename(filename), `documents/${name}`, bytes.length, now),
      duplicate: false,
    };
  }

  /**
   * Files the user put into the tax-year folder themselves (Finder, Explorer) that are not in the
   * list yet. They stay where the user put them. Known content is skipped by its sha256.
   */
  async scan(known: VaultDocument[], now = new Date()): Promise<VaultDocument[]> {
    if (!this.exists()) return [];
    const seen = new Set(known.map((d) => d.sha256));
    const found: VaultDocument[] = [];
    const walk = async (dir: string, depth: number): Promise<void> => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name.includes('.tmp-')) continue;
        const abs = path.join(dir, entry.name);
        const rel = path.relative(this.dir, abs).split(path.sep).join('/');
        if (entry.isDirectory()) {
          if (rel !== 'filing' && depth < 3) await walk(abs, depth + 1);
          continue;
        }
        if (!entry.isFile() || (depth === 0 && OWN_FILES.has(entry.name))) continue;
        const info = await stat(abs);
        if (info.size === 0 || info.size > MAX_DOCUMENT_BYTES) continue;
        const bytes = await readFile(abs);
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        if (seen.has(sha256)) continue;
        seen.add(sha256);
        found.push(newDocument(sha256, entry.name.normalize('NFC'), rel, info.size, now));
      }
    };
    await walk(this.dir, 0);
    return found;
  }

  async readDocument(doc: VaultDocument): Promise<Buffer> {
    const abs = path.resolve(this.dir, doc.path);
    if (!abs.startsWith(this.dir + path.sep)) throw new VaultError('Document outside the vault.');
    return readFile(abs);
  }

  async #readJson<T>(name: string): Promise<T | undefined> {
    try {
      return JSON.parse(await readFile(path.join(this.dir, name), 'utf8')) as T;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw new VaultError(`${name} in ${this.dir} can't be read: ${(err as Error).message}`);
    }
  }
}

function newDocument(
  sha256: string,
  filename: string,
  relPath: string,
  bytes: number,
  now: Date,
): VaultDocument {
  return {
    id: `d_${sha256.slice(0, 12)}`,
    sha256,
    filename,
    path: relPath,
    bytes,
    addedAt: now.toISOString(),
    parse: { method: 'none', ok: false, warnings: [] },
  };
}
