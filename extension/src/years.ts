// The tax years Taxpresso prepares, and the one the user has open (docs/design/tax-years.md).
//
// Which years exist is derived from the canton registry (./cantons.ts): a canton lists the years
// whose rules, form map and questions it has (CantonEntry.years), and a year is offered when one
// canton has it. The open year is the user's choice, made in the chat (open_tax_year) or in the
// dashboard (the year switch), and kept in open-year.json at the root of the Taxpresso folder;
// everything else (what is missing, what applies, whether the year is over) stays derived.
//
// Each year is its own folder (<Taxpresso>/2025, <Taxpresso>/2026) and its own Workspace: its
// answers, documents, checks, ticks, decisions and exports never mix with another year's. A tool
// call or a dashboard request takes the open year's workspace once, when it starts, and finishes
// on it even if the user switches meanwhile.
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { gitRepoAbove } from '@taxpresso/ledger';
import type { SupportedCanton } from '@taxpresso/rules-ch';
import { CANTONS, CantonRegistry, cantonNames } from './cantons.js';
import { CURRENT_TAX_YEAR, type Config } from './config.js';
import { Workspace, WorkspaceError, type Via } from './workspace.js';
import { isYearOver } from './year-over.js';

export { isoToday, isYearOver } from './year-over.js';

/** The year that opens when the user hasn't chosen one: the year this release prepares. */
export const DEFAULT_TAX_YEAR = CURRENT_TAX_YEAR;

/** The file at the root of the Taxpresso folder that keeps the user's choice. */
export const OPEN_YEAR_FILE = 'open-year.json';

interface OpenYearFile {
  version: 1;
  taxYear: number;
  /** Where the user chose it. */
  via: Via;
  at: string;
}

/** The cantons whose return Taxpresso prepares for a tax year, in the registry's order. */
export function cantonsForYear(taxYear: number): SupportedCanton[] {
  return (Object.keys(CANTONS) as SupportedCanton[]).filter((c) =>
    CANTONS[c].years.includes(taxYear),
  );
}

/** The tax years Taxpresso prepares, the newest first: those at least one canton has. */
export function offeredYears(): number[] {
  const years = new Set(Object.values(CANTONS).flatMap((c) => c.years));
  return [...years].sort((a, b) => b - a);
}

/** One year as the chat and the dashboard list it. */
export interface YearInfo {
  year: number;
  open: boolean;
  /** The year that opens by default. */
  default: boolean;
  /** 31 December of the year has passed. */
  over: boolean;
  /** The cantons Taxpresso prepares for that year. */
  cantons: SupportedCanton[];
}

/** "2026 and 2025 (Geneva only)": the years offered, in words, for the texts that list them. */
export function yearsText(): string {
  const all = Object.keys(CANTONS).length;
  return offeredYears()
    .map((y) => {
      const cantons = cantonsForYear(y);
      return cantons.length < all ? `${y} (${cantonNames(cantons, 'and')} only)` : String(y);
    })
    .join(' and ');
}

/** The open year and every year's workspace, created on first use. */
export class TaxYears {
  readonly config: Config;
  readonly #workspaces = new Map<number, Workspace>();
  #open: number | undefined;
  /** A year kept in open-year.json that this version doesn't offer (it opened the default). */
  #dropped: number | undefined;
  #lock: Promise<unknown> = Promise.resolve();
  /** The year that opens without a choice kept: the default, or the year of the workspace given. */
  readonly #fallback: number;

  /** `first`: a workspace already made (tests, or an extension that made one before). */
  constructor(config: Config, first?: Workspace) {
    this.config = config;
    if (first) this.#workspaces.set(first.taxYear, first);
    this.#fallback = first?.taxYear ?? config.taxYear;
  }

  /** One workspace's years: what server and API code built around a single workspace gets. */
  static of(given: Workspace | TaxYears): TaxYears {
    if (given instanceof TaxYears) return given;
    const known = singles.get(given);
    if (known) return known;
    const years = new TaxYears(given.config, given);
    singles.set(given, years);
    return years;
  }

  /** The Taxpresso folder (the parent of every year's folder). */
  get root(): string {
    return path.resolve(this.config.vaultPath);
  }

  /** The open tax year. */
  get year(): number {
    if (this.#open === undefined) this.#open = this.#stored() ?? this.#fallback;
    return this.#open;
  }

  /** The open year's workspace. */
  get current(): Workspace {
    return this.workspace(this.year);
  }

  /** A year's workspace (its folder, ledger and questions), the same object every time. */
  workspace(taxYear: number): Workspace {
    let ws = this.#workspaces.get(taxYear);
    if (!ws) {
      if (!offeredYears().includes(taxYear)) {
        throw new WorkspaceError(`Taxpresso prepares ${yearsText()} returns, not ${taxYear}.`);
      }
      ws = new Workspace(this.config, new CantonRegistry(taxYear));
      this.#workspaces.set(taxYear, ws);
    }
    return ws;
  }

  /** Every year offered, the open one marked. */
  list(): YearInfo[] {
    const open = this.year;
    return offeredYears().map((year) => ({
      year,
      open: year === open,
      default: year === DEFAULT_TAX_YEAR,
      over: isYearOver(year),
      cantons: cantonsForYear(year),
    }));
  }

  /** A year the folder had open that this version doesn't offer, if so (the default opened). */
  get dropped(): number | undefined {
    void this.year;
    return this.#dropped;
  }

  /**
   * Opens a tax year: the user's choice, kept in open-year.json. The other years stay as they are.
   * Fails for a year Taxpresso doesn't prepare, and when the folder can't be used.
   */
  async open(taxYear: number, via: Via): Promise<Workspace> {
    const run = this.#lock.then(async () => {
      if (!offeredYears().includes(taxYear)) {
        throw new WorkspaceError(`Taxpresso prepares ${yearsText()} returns, not ${taxYear}.`);
      }
      const repo = gitRepoAbove(this.root);
      if (repo) {
        throw new WorkspaceError(
          `Your Taxpresso folder ${this.root} is inside a code repository (${repo}). Choose a folder outside it, so your tax documents can never be committed.`,
        );
      }
      const before = this.year;
      const ws = this.workspace(taxYear);
      const file: OpenYearFile = { version: 1, taxYear, via, at: new Date().toISOString() };
      await mkdir(this.root, { recursive: true });
      const target = path.join(this.root, OPEN_YEAR_FILE);
      const tmp = `${target}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`;
      await writeFile(tmp, JSON.stringify(file, null, 2) + '\n');
      await rename(tmp, target);
      this.#open = taxYear;
      this.#dropped = undefined;
      if (before !== taxYear) ws.record(via === 'chat' ? 'claude' : 'you', 'year', String(taxYear));
      return ws;
    });
    this.#lock = run.catch(() => undefined);
    return run;
  }

  /** The year kept in open-year.json, when it is one Taxpresso offers. Read once; never throws. */
  #stored(): number | undefined {
    const file = path.join(this.root, OPEN_YEAR_FILE);
    if (!existsSync(file)) return undefined;
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<OpenYearFile>;
      const year = parsed.taxYear;
      if (typeof year !== 'number' || !Number.isInteger(year)) return undefined;
      if (!offeredYears().includes(year)) {
        this.#dropped = year;
        return undefined;
      }
      return year;
    } catch {
      return undefined; // unreadable: the default year opens, the file stays as it is
    }
  }
}

/** The years of each single workspace given to TaxYears.of, so they are made once. */
const singles = new WeakMap<Workspace, TaxYears>();
