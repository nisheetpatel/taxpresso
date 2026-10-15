// Sorted as they land (docs/design/three-pages.md, section 4): while the extension runs, it watches
// the open year's folder, and about a second after files stop changing there (and once when it
// starts watching it) it looks at the folder exactly as ingest_vault and the dashboard's "Check my
// folder" do (Workspace.scan). Both dashboards follow on their own: the browser page and the view
// in the chat ask for the state every second, and the view's dashboard_api tags each state by its
// content, so a scan that found something is a new state, shown within seconds. Claude hears of
// these files with its next look at the folder (ingest_vault). fs.watch reports names only;
// nothing is opened but by the scan, and nothing is sent anywhere (C2).
import { existsSync, watch as fsWatch } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { OWN_FILES } from '@taxpresso/ledger';
import type { TaxYears } from './years.js';

/** What the watch needs of node:fs's watch (tests give their own). */
export type Watch = (
  dir: string,
  options: { recursive: boolean; persistent: boolean },
  listener: (event: string, name: string | null) => void,
) => { close(): void; on(event: 'error', listener: (err: Error) => void): unknown };

export interface FolderWatchOptions {
  /** Quiet time after the last change before looking at the folder: about a second. */
  debounceMs?: number;
  /** While the year's folder isn't there yet: how often to look for it. */
  retryMs?: number;
  watch?: Watch;
  /** After each look the watch made: how many files it sorted (tests). */
  onScan?: (found: number) => void;
}

/** At most this many more waits for a file still being written, then the folder is read anyway. */
const MAX_WAITS = 10;

/**
 * A name in the folder that may be a document: not one of Taxpresso's own files at its top, not a
 * hidden file or one being written (name.tmp-...), nothing under filing/ (as Vault.scan).
 */
export function mayBeDocument(name: string): boolean {
  const parts = name.split(/[\\/]+/).filter(Boolean);
  if (parts.some((p) => p.startsWith('.') || p.includes('.tmp-'))) return false;
  if (parts[0] === 'filing') return false;
  return !(parts.length === 1 && OWN_FILES.has(parts[0]!));
}

export class FolderWatch {
  readonly #years: TaxYears;
  readonly #debounceMs: number;
  readonly #retryMs: number;
  readonly #watch: Watch;
  readonly #onScan: ((found: number) => void) | undefined;
  #watcher: ReturnType<Watch> | undefined;
  /** The folder watched and its year. */
  #dir: string | undefined;
  #year: number | undefined;
  #debounce: NodeJS.Timeout | undefined;
  #retry: NodeJS.Timeout | undefined;
  /** Names changed since the last look, to wait for those still being written. */
  readonly #changed = new Set<string>();
  #waits = 0;
  #queue: Promise<void> = Promise.resolve();
  #stopFollowing: (() => void) | undefined;
  #closed = false;

  constructor(years: TaxYears, options: FolderWatchOptions = {}) {
    this.#years = years;
    this.#debounceMs = options.debounceMs ?? 1000;
    this.#retryMs = options.retryMs ?? 2000;
    this.#watch = options.watch ?? fsWatch;
    this.#onScan = options.onScan;
  }

  /** The folder watched now, if any. */
  get dir(): string | undefined {
    return this.#watcher ? this.#dir : undefined;
  }

  /** Watches the open year's folder, and follows the year the user opens. */
  start(): void {
    this.#stopFollowing ??= this.#years.onChange(() => this.rearm());
    this.rearm();
  }

  /**
   * Watches the open year's folder from now on; until it exists, looks for it every few seconds.
   * Once watched, it looks at the folder once: files may have landed while nothing watched it (the
   * extension closed, another year open, the folder just made).
   */
  rearm(): void {
    this.#unwatch();
    if (this.#closed) return;
    let ws;
    try {
      ws = this.#years.current;
    } catch {
      return this.#later();
    }
    // Never a folder inside a code repository: Taxpresso refuses to use one (Vault.problem).
    if (ws.vault.problem()) return;
    const dir = ws.vault.dir;
    // Made with the first answer or document, or by "Open my Taxpresso folder".
    if (!existsSync(dir)) return this.#later();
    try {
      const watcher = this.#watch(dir, { recursive: true, persistent: false }, (_event, name) =>
        this.#change(name),
      );
      // The folder was removed or moved: look for it again.
      watcher.on('error', () => this.#later());
      this.#watcher = watcher;
      this.#dir = dir;
      this.#year = ws.taxYear;
    } catch {
      return this.#later();
    }
    this.#waits = 0;
    this.#schedule();
  }

  /** Stops watching, for good (the extension is closing). */
  close(): void {
    this.#closed = true;
    this.#stopFollowing?.();
    this.#stopFollowing = undefined;
    this.#unwatch();
  }

  /** Resolves once the looks started so far are done. */
  idle(): Promise<void> {
    return this.#queue;
  }

  #later(): void {
    this.#unwatch();
    if (this.#closed) return;
    this.#retry = setTimeout(() => this.rearm(), this.#retryMs);
    this.#retry.unref();
  }

  #unwatch(): void {
    clearTimeout(this.#debounce);
    clearTimeout(this.#retry);
    this.#debounce = undefined;
    this.#retry = undefined;
    this.#watcher?.close();
    this.#watcher = undefined;
    this.#changed.clear();
  }

  #change(name: string | null): void {
    // No name (some systems): something changed, look anyway.
    if (name !== null && !mayBeDocument(String(name))) return;
    if (name) this.#changed.add(String(name));
    this.#waits = 0;
    this.#schedule();
  }

  #schedule(): void {
    clearTimeout(this.#debounce);
    this.#debounce = setTimeout(() => void this.#settle(), this.#debounceMs);
    this.#debounce.unref();
  }

  /** Looks at the folder once the files changed are written: none modified just now. */
  async #settle(): Promise<void> {
    const dir = this.#dir;
    const year = this.#year;
    if (dir === undefined || year === undefined || this.#closed) return;
    const writing = await Promise.all(
      [...this.#changed].map(async (name) => {
        try {
          const info = await stat(path.join(dir, name));
          return info.isFile() && Date.now() - info.mtimeMs < this.#debounceMs / 2;
        } catch {
          return false; // gone meanwhile
        }
      }),
    );
    if (this.#closed || this.#dir !== dir) return;
    if (writing.some(Boolean) && this.#waits++ < MAX_WAITS) return this.#schedule();
    this.#changed.clear();
    const ws = this.#years.workspace(year);
    this.#queue = this.#queue.then(async () => {
      try {
        const found = await ws.scan('you', { auto: true });
        this.#onScan?.(found.length);
      } catch {
        // Unreadable now (a file removed meanwhile): the next change, or ingest_vault, looks again.
      }
    });
    await this.#queue;
  }
}
