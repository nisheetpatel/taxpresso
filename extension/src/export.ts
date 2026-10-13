// "A copy of your folder" (SPEC.md 10.6, export bundle): one ZIP of the tax-year folder, with the
// documents and everything Taxpresso keeps for that year (ledger.json, documents.json,
// entered.json, decisions.json...), written into the user's Taxpresso folder itself, on this
// computer. Nothing is sent anywhere (C2). The dashboard's button and export_bundle do the same.
//
// Only regular files inside the tax-year folder go in: no symbolic link (it could point anywhere),
// nothing above the folder, no hidden or half-written file. A file of the same name is never
// overwritten: the name takes a number instead.
import type { Dirent } from 'node:fs';
import { existsSync } from 'node:fs';
import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { displayPath } from './config.js';
import { WorkspaceError, type Workspace } from './workspace.js';
import { writeZip, ZipTooLargeError, type ZipInput } from './zip.js';

export interface FolderExport {
  /** The ZIP's file name, e.g. "Taxpresso-2026-export-2026-10-14.zip". */
  file: string;
  /** Where it is, with the home folder as ~. */
  path: string;
  /** The folder it is in (the Taxpresso folder), with the home folder as ~. */
  folder: string;
  /** Files in it. */
  entries: number;
  bytes: number;
  at: string;
}

const last = new WeakMap<Workspace, FolderExport>();

/** Folders deep enough for documents/ and whatever the user filed in the year folder. */
const MAX_DEPTH = 8;

const day = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "Taxpresso-2026-export-2026-10-14.zip", then "-2", "-3"... for the next ones that day. */
export function exportName(taxYear: number, now: Date, n = 1): string {
  return `Taxpresso-${taxYear}-export-${day(now)}${n > 1 ? `-${n}` : ''}.zip`;
}

/** The regular files of the tax-year folder, named "2026/..." in the archive, in name order. */
async function folderFiles(dir: string, taxYear: number): Promise<ZipInput[]> {
  const root = await realpath(dir);
  const out: ZipInput[] = [];
  const walk = async (abs: string, rel: string, depth: number): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await readdir(abs, { withFileTypes: true });
    } catch {
      return; // gone meanwhile, or not readable: left out
    }
    for (const entry of entries) {
      // Hidden files (.DS_Store) and files being written (name.tmp-...) stay out.
      if (entry.name.startsWith('.') || entry.name.includes('.tmp-')) continue;
      const file = path.join(abs, entry.name);
      const name = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH) await walk(file, name, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const info = await lstat(file).catch(() => undefined);
      if (!info?.isFile()) continue;
      // Inside the folder for real, whatever the path says.
      const real = await realpath(file).catch(() => undefined);
      if (!real?.startsWith(root + path.sep)) continue;
      out.push({ name: `${taxYear}/${name}`, path: file, mtime: info.mtime });
    }
  };
  await walk(dir, '', 0);
  return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Writes the ZIP of the tax-year folder into the Taxpresso folder and returns where it is. */
export async function exportFolder(ws: Workspace, now = new Date()): Promise<FolderExport> {
  await ws.ready();
  const problem = ws.vault.problem();
  if (problem) throw new WorkspaceError(problem);
  const year = ws.engine.taxYear;
  const folder = ws.vault.root;
  if (!ws.vault.exists()) {
    throw new WorkspaceError(
      `Nothing to save yet: there is no ${year} folder in ${displayPath(folder)}.`,
    );
  }
  const files = await folderFiles(ws.vault.dir, year);
  if (files.length === 0) {
    throw new WorkspaceError(`Nothing to save yet: the ${year} folder is empty.`);
  }
  for (let n = 1; n < 1000; n++) {
    const file = exportName(year, now, n);
    const target = path.join(folder, file);
    if (existsSync(target)) continue;
    try {
      const bytes = await writeZip(target, files);
      const result: FolderExport = {
        file,
        path: displayPath(target),
        folder: displayPath(folder),
        entries: files.length,
        bytes,
        at: now.toISOString(),
      };
      last.set(ws, result);
      return result;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') continue; // made meanwhile
      if (err instanceof ZipTooLargeError) throw new WorkspaceError(err.message);
      throw err;
    }
  }
  throw new WorkspaceError(`Too many copies made on ${day(now)}: move some out of the folder.`);
}

/** For the dashboard: the copy made last in this session, if any. */
export function exportView(ws: Workspace): { last?: FolderExport } {
  const done = last.get(ws);
  return done ? { last: done } : {};
}

/** "1.2 MB", for Claude. */
export function sizeText(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(Math.round((bytes / (1024 * 1024)) * 10) / 10).toFixed(1)} MB`;
}
