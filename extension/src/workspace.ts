// One tax year's state, shared by the MCP tools and the dashboard: the vault folder, the ledger,
// the documents and the questionnaire. Claude and the UI are two views of this one state
// (SPEC.md section 3). Writes are serialized; reads never create the folder.
import {
  DOCUMENT_KINDS,
  type DocumentKind,
  type Fact,
  type KeyRegistry,
  type Ledger,
  type Owner,
  type Requirement,
  Vault,
  type VaultDocument,
} from '@taxpresso/ledger';
import { pillar3aPlan, type HouseholdInput, type Pillar3aResult } from '@taxpresso/optimizer';
import type { Lang, QuestionnaireEngine, RenderedQuestion, Slot } from '@taxpresso/questionnaire';
import type { CommuneSlug } from '@taxpresso/rules-ge';
import type { SecuritiesSummary } from '@taxpresso/intake';
import { displayPath, type Config } from './config.js';
import {
  applyReports,
  emptySummary,
  readSecurities,
  recogniseExports,
  recordSecurities,
  securitiesView,
  type SecuritiesView,
} from './securities.js';

export type Via = 'chat' | 'dashboard';

export interface ActivityEntry {
  at: string;
  by: 'claude' | 'you';
  what: 'status' | 'dashboard' | 'questions' | 'answer' | 'skip' | 'document' | 'scan' | 'kind';
  /** Language-neutral: a question slot id, a document kind, a file name or a count. */
  detail?: string;
}

interface Prefs {
  version: 1;
  skipped: string[];
  waived: string[];
}

export class WorkspaceError extends Error {}

/** Planning inputs the user can give in the dashboard or the chat (never filed). */
export const PLAN_KEYS = [
  'plan.gross_salary',
  'plan.net_salary',
  'plan.has_pension_fund',
  'plan.pillar3a_paid',
] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export class Workspace {
  readonly config: Config;
  readonly engine: QuestionnaireEngine;
  readonly keys: KeyRegistry;
  readonly vault: Vault;
  #ledger: Ledger | undefined;
  #documents: VaultDocument[] = [];
  #prefs: Prefs = { version: 1, skipped: [], waived: [] };
  #loading: Promise<void> | undefined;
  #lock: Promise<unknown> = Promise.resolve();
  readonly #activity: ActivityEntry[] = [];
  /** The securities list read from broker exports (SPEC.md 5.7), and exports that can't be read. */
  #securities: { summary: SecuritiesSummary; unreadable: string[] } | undefined;

  constructor(config: Config, engine: QuestionnaireEngine, keys: KeyRegistry) {
    this.config = config;
    this.engine = engine;
    this.keys = keys;
    this.vault = new Vault(config.vaultPath, engine.taxYear);
  }

  /** Loads what is already in the folder, once. A missing folder is an empty return. */
  ready(): Promise<void> {
    this.#loading ??= (async () => {
      this.#ledger = await this.vault.loadLedger(this.keys);
      this.#documents = await this.vault.loadDocuments();
      this.#prefs = {
        ...this.#prefs,
        ...(await this.vault.readState('questionnaire.json', this.#prefs)),
      };
      await this.#readSecurities();
    })().catch((err: unknown) => {
      this.#loading = undefined;
      throw err;
    });
    return this.#loading;
  }

  get ledger(): Ledger {
    if (!this.#ledger) throw new WorkspaceError('Workspace not loaded');
    return this.#ledger;
  }

  get documents(): readonly VaultDocument[] {
    return this.#documents;
  }

  get skipped(): readonly string[] {
    return this.#prefs.skipped;
  }

  record(by: ActivityEntry['by'], what: ActivityEntry['what'], detail?: string): void {
    this.#activity.unshift({
      at: new Date().toISOString(),
      by,
      what,
      ...(detail ? { detail } : {}),
    });
    this.#activity.length = Math.min(this.#activity.length, 20);
  }

  activity(): ActivityEntry[] {
    return this.#activity.map((a) => ({ ...a }));
  }

  snapshot() {
    return this.engine.snapshot(this.ledger);
  }

  next(): Slot | undefined {
    return this.engine.next(this.snapshot(), this.#prefs.skipped);
  }

  requirements(): Requirement[] {
    return this.engine.requirements(this.snapshot(), this.#documents, this.#prefs.waived);
  }

  render(slot: Slot, lang: Lang): RenderedQuestion {
    return this.engine.render(slot, this.snapshot(), lang);
  }

  /** Stores an answer. Returns the fact and the documents the answer newly asks for. */
  async answer(
    slotId: string,
    value: unknown,
    via: Via,
  ): Promise<{ fact: Fact; added: Requirement[] }> {
    return this.#write(async () => {
      this.#usable();
      const before = new Set(this.requirements().map((r) => r.id));
      const fact = this.engine.answer(this.ledger, slotId, value, { method: 'user', via });
      await this.vault.saveLedger(this.ledger);
      if (this.#prefs.skipped.includes(slotId)) {
        this.#prefs.skipped = this.#prefs.skipped.filter((id) => id !== slotId);
        await this.#savePrefs();
      }
      this.record(via === 'chat' ? 'claude' : 'you', 'answer', slotId);
      return { fact, added: this.requirements().filter((r) => !before.has(r.id)) };
    });
  }

  async skip(slotId: string): Promise<void> {
    return this.#write(async () => {
      if (!this.snapshot().slots.some((s) => s.id === slotId)) {
        throw new WorkspaceError(`Question ${slotId} doesn't apply now.`);
      }
      if (!this.#prefs.skipped.includes(slotId)) this.#prefs.skipped.push(slotId);
      await this.#savePrefs();
      this.record('you', 'skip');
    });
  }

  async waive(requirementId: string, waived = true): Promise<void> {
    return this.#write(async () => {
      const req = this.requirements().find((r) => r.id === requirementId);
      if (!req?.optional) throw new WorkspaceError('Only optional documents can be skipped.');
      this.#prefs.waived = this.#prefs.waived.filter((id) => id !== requirementId);
      if (waived) this.#prefs.waived.push(requirementId);
      await this.#savePrefs();
    });
  }

  async addDocument(
    bytes: Uint8Array,
    filename: string,
    via: Via,
  ): Promise<{ document: VaultDocument; duplicate: boolean }> {
    return this.#write(async () => {
      this.#usable();
      const result = await this.vault.addDocument(bytes, filename, this.#documents);
      if (!result.duplicate) {
        this.#documents.push(result.document);
        await this.vault.saveDocuments(this.#documents);
        await this.#importExports([result.document]);
        this.record(via === 'chat' ? 'claude' : 'you', 'document', result.document.filename);
      }
      return result;
    });
  }

  /** Picks up files the user put into the tax-year folder directly. */
  async scan(by: ActivityEntry['by']): Promise<VaultDocument[]> {
    return this.#write(async () => {
      const found = await this.vault.scan(this.#documents);
      if (found.length) {
        this.#documents.push(...found);
        await this.vault.saveDocuments(this.#documents);
        await this.#importExports(found);
      }
      this.record(by, 'scan', String(found.length));
      return found;
    });
  }

  /** The user says what a document is (and whose, in a couple). */
  async setDocumentKind(id: string, kind: DocumentKind, person?: Owner): Promise<VaultDocument> {
    return this.#write(async () => {
      if (!DOCUMENT_KINDS.includes(kind)) throw new WorkspaceError(`Unknown kind ${String(kind)}`);
      const doc = this.#documents.find((d) => d.id === id);
      if (!doc) throw new WorkspaceError('No such document.');
      const people = this.snapshot().people;
      if (person !== undefined && person !== 'household' && !people.includes(person)) {
        throw new WorkspaceError(`No ${person} in this household.`);
      }
      const wasExport = doc.kind === 'broker_export';
      doc.kind = kind;
      doc.kindSource = 'user';
      // 'household' = the whole household, e.g. one family statement for both partners.
      if (person) doc.person = person;
      else delete doc.person;
      await this.vault.saveDocuments(this.#documents);
      if (wasExport || kind === 'broker_export') await this.#syncSecurities();
      this.record('you', 'kind', kind);
      return doc;
    });
  }

  /** The household as the 3a planner sees it: questionnaire answers plus planning inputs. */
  planInput(): HouseholdInput {
    const snap = this.snapshot();
    const answer = (key: string) => snap.answers.get(`${key}|household`);
    const money = (key: PlanKey, person: 'p1' | 'p2') => {
      const v = this.ledger.get(key, person)?.value;
      return typeof v === 'number' && v > 0 ? v : undefined;
    };
    const custody = answer('profile.children_custody');
    const commune = answer('profile.commune');
    return {
      couple: snap.people.length > 1,
      children: Number(answer('profile.children_count') ?? 0),
      ...(custody ? { custody: custody as HouseholdInput['custody'] & string } : {}),
      ...(commune ? { commune: commune as CommuneSlug } : {}),
      people: snap.people.map((p) => {
        const person = p as 'p1' | 'p2';
        const gross = money('plan.gross_salary', person);
        const net = money('plan.net_salary', person);
        return {
          person,
          ...(gross !== undefined ? { grossCentimes: gross } : {}),
          ...(net !== undefined ? { netCentimes: net } : {}),
          // Most employees have one; the user can say otherwise.
          hasPensionFund: this.ledger.get('plan.has_pension_fund', person)?.value !== false,
          paidCentimes: money('plan.pillar3a_paid', person) ?? 0,
        };
      }),
    };
  }

  plan(): Pillar3aResult {
    return pillar3aPlan(this.planInput());
  }

  /** Saves one planning input. Money in CHF from the user, stored as centimes; 0 clears a salary. */
  async setPlan(person: string, key: PlanKey, value: number | boolean, via: Via): Promise<void> {
    return this.#write(async () => {
      this.#usable();
      if (!PLAN_KEYS.includes(key)) throw new WorkspaceError(`Not a planning value: ${key}`);
      if (!this.snapshot().people.includes(person as 'p1' | 'p2')) {
        throw new WorkspaceError(`No ${person} in this household.`);
      }
      const isMoney = key !== 'plan.has_pension_fund';
      if (isMoney !== (typeof value === 'number')) throw new WorkspaceError('Wrong kind of value.');
      const stored = typeof value === 'number' ? Math.round(value * 100) : value;
      this.ledger.append({
        key,
        person: person as 'p1' | 'p2',
        value: stored,
        status: isMoney ? 'estimate' : 'stated',
        source: { method: 'user', via },
      });
      await this.vault.saveLedger(this.ledger);
    });
  }

  vaultInfo() {
    const problem = this.vault.problem();
    return {
      path: displayPath(this.vault.dir),
      exists: this.vault.exists(),
      ...(problem ? { problem } : {}),
    };
  }

  /** The securities list for the dashboard, from the ledger, with export warnings. */
  securities(lang: Lang): SecuritiesView | undefined {
    const s = this.#securities ?? { summary: emptySummary(this.engine.taxYear), unreadable: [] };
    return securitiesView(this.ledger, s.summary, lang, s.unreadable);
  }

  /** Reads the broker exports in the vault into the securities list; writes nothing. */
  async #readSecurities() {
    try {
      const { summary, unreadable } = await readSecurities(
        this.vault,
        this.#documents,
        this.engine.taxYear,
      );
      this.#securities = { summary, unreadable: unreadable.map((d) => d.filename) };
      return { summary, unreadable };
    } catch {
      // A broken export never stops the rest of the return from loading.
      this.#securities = undefined;
      return undefined;
    }
  }

  /** New documents that are broker exports: mark them, then bring the securities list up to date. */
  async #importExports(added: VaultDocument[]): Promise<void> {
    const exports = await recogniseExports(this.vault, added);
    if (exports.length) await this.#syncSecurities();
  }

  /** Re-reads every broker export and appends the facts that changed (append-only ledger). */
  async #syncSecurities(): Promise<void> {
    const read = await this.#readSecurities();
    if (!read) return;
    applyReports(this.#documents, read.summary, read.unreadable);
    const { appended, problems } = recordSecurities(this.ledger, read.summary);
    for (const p of problems) {
      this.#documents.find((d) => d.id === p.docId)?.parse.warnings.push(p.text);
    }
    await this.vault.saveDocuments(this.#documents);
    if (appended.length) await this.vault.saveLedger(this.ledger);
  }

  #usable(): void {
    const problem = this.vault.problem();
    if (problem) throw new WorkspaceError(problem);
  }

  async #savePrefs(): Promise<void> {
    await this.vault.writeState('questionnaire.json', this.#prefs);
  }

  #write<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.#lock.then(async () => {
      await this.ready();
      return fn();
    });
    this.#lock = run.catch(() => undefined);
    return run;
  }
}
