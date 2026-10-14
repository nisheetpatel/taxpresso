// One tax year's state, shared by the MCP tools and the dashboard: the vault folder, the ledger,
// the documents and the questionnaire. Claude and the UI are two views of this one state
// (SPEC.md section 3). Writes are serialized; reads never create the folder.
import {
  DOCUMENT_KINDS,
  type DocumentKind,
  type Fact,
  type FactValue,
  type KeyRegistry,
  type Ledger,
  type Owner,
  parseDate,
  type Requirement,
  Vault,
  type VaultDocument,
} from '@taxpresso/ledger';
import {
  pillar3aPlan,
  type CantonPlan,
  type HouseholdInput,
  type Pillar3aResult,
} from '@taxpresso/optimizer';
import type { Lang, QuestionnaireEngine, RenderedQuestion, Slot } from '@taxpresso/questionnaire';
import type { ContentLang } from './lang.js';
import {
  assessmentViews,
  consistencyChecks,
  documentFields,
  engineInputFromFacts,
  normalizeTariff,
  type AssessmentView,
  type CommuneSlug,
  type ConsistencyCheck,
  type TaxResult,
} from '@taxpresso/rules-ge';
import type { SupportedCanton, TaxResult as SharedTaxResult, Text } from '@taxpresso/rules-ch';
import type { SecuritiesSummary } from '@taxpresso/intake';
import type { CantonEntry, CantonRegistry, CantonState, LedgerContext } from './cantons.js';
import { CURRENT_TAX_YEAR, displayPath, type Config } from './config.js';
import { isoToday, isYearOver } from './year-over.js';
import { applyBarcode, BARCODE_PENDING, readDocumentBarcodes } from './barcode.js';
import {
  applyReports,
  emptySummary,
  readSecurities,
  recogniseExports,
  recordSecurities,
  securitiesView,
  type SecuritiesView,
} from './securities.js';
import {
  currentPriorDocument,
  isPriorOrProfile,
  lastYearView,
  PRIOR_METHOD,
  recognisePriorDeclarations,
  recordPriorDeclaration,
  type LastYearView,
} from './prior.js';
import {
  coerceValue,
  ExtractionError,
  formValue,
  normalizeBox,
  type ProposedDetails,
  type ProposedValue,
} from './extraction.js';

export type Via = 'chat' | 'dashboard';

/** The tax of the year's canton (Workspace.estimate). */
export type CantonEstimate =
  | {
      canton: SupportedCanton;
      entry: CantonEntry;
      result: SharedTaxResult | null;
      missing: Text[];
      notes: Text[];
    }
  | { canton: undefined; entry?: undefined; result: null; missing: Text[]; notes: Text[] };

export interface ActivityEntry {
  at: string;
  by: 'claude' | 'you';
  what:
    | 'status'
    | 'dashboard'
    | 'questions'
    | 'answer'
    | 'skip'
    | 'document'
    | 'scan'
    | 'kind'
    | 'extract'
    | 'confirm'
    | 'check'
    | 'replace'
    | 'decide'
    /** The user opened this tax year (./years.ts); detail: the year. */
    | 'year';
  /** Language-neutral: a question slot id, a document kind, a file name or a count. */
  detail?: string;
}

interface Prefs {
  version: 1;
  skipped: string[];
  waived: string[];
}

export class WorkspaceError extends Error {}

/** Why planning figures are refused for a year that is over (./planning.ts, yearOverView). */
export const yearOverPlans = (year: number) =>
  `${year} is over: what is paid now into 3a or a pension fund counts for ${CURRENT_TAX_YEAR}, not ${year}, so the plans are ${CURRENT_TAX_YEAR}'s. Offer to open ${CURRENT_TAX_YEAR} (open_tax_year) and save the figure there. The ${year} return takes what was paid in ${year}, from the attestations.`;

/** Ticks the user set on the document cards ("Entered"): local, in the vault, never in the ledger. */
interface Entered {
  version: 1;
  /** `${docId}|${key}|${person}` -> the value as it was when ticked (a changed value unticks). */
  entered: Record<string, string>;
  /** Copy panel rows (SPEC.md 10.5), by row id -> the value as typed when ticked. */
  form?: Record<string, string>;
}

export interface ExtractionResult {
  saved: number;
  unchanged: number;
  /** Values the user already confirmed differently: kept, never overwritten by a proposal. */
  kept: { key: string; person: Owner; value: FactValue }[];
  document: VaultDocument;
}

/** One value of one document; a value about one of its accounts names the account too. */
export const enteredSlot = (docId: string, key: string, person: Owner, instance?: string) =>
  `${docId}|${key}|${person}${instance && instance !== docId ? `|${instance}` : ''}`;

/** Planning inputs the user can give in the dashboard or the chat (never filed). */
export const PLAN_KEYS = [
  'plan.gross_salary',
  'plan.net_salary',
  'plan.has_pension_fund',
  'plan.pillar3a_paid',
  // Pension fund buy-in, 3a catch-up and TOU (./planning.ts).
  'plan.lpp_buyin_capacity',
  'plan.lpp_buyin_amount',
  'plan.pillar3a_paid_2025',
  'plan.source_tax_withheld',
  'plan.source_tax_tariff',
  'plan.tou_other_income',
  'plan.tou_taxable_wealth',
] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export class Workspace {
  readonly config: Config;
  /** The cantons, their questionnaires and keys (./cantons.ts). */
  readonly cantons: CantonRegistry;
  readonly vault: Vault;
  #ledger: Ledger | undefined;
  #documents: VaultDocument[] = [];
  #prefs: Prefs = { version: 1, skipped: [], waived: [] };
  #entered: Entered = { version: 1, entered: {} };
  #loading: Promise<void> | undefined;
  #lock: Promise<unknown> = Promise.resolve();
  readonly #activity: ActivityEntry[] = [];
  /** The securities list read from broker exports (SPEC.md 5.7), and exports that can't be read. */
  #securities: { summary: SecuritiesSummary; unreadable: string[] } | undefined;

  constructor(config: Config, cantons: CantonRegistry) {
    this.config = config;
    this.cantons = cantons;
    this.vault = new Vault(config.vaultPath, cantons.taxYear);
  }

  /** The tax year of this workspace: its folder, its ledger and its questions (./years.ts). */
  get taxYear(): number {
    return this.cantons.taxYear;
  }

  /** Today's date, YYYY-MM-DD: the configured clock, or the computer's. */
  today(): string {
    return this.config.today?.() ?? isoToday();
  }

  /** A year that is over (before the default year): its plans before 31 December are gone. */
  yearOver(): boolean {
    return isYearOver(this.taxYear);
  }

  /**
   * The canton of the year (docs/design/cantons.md, section 3): the user's answer to the first
   * question or, for a return started before it was asked, the canton its answers belong to.
   */
  canton(): CantonState {
    if (!this.#ledger) return { answer: undefined, canton: undefined, from: 'none', because: [] };
    return this.cantons.state(this.#ledger);
  }

  /** The questionnaire of the canton (the shared questions until the canton is known). */
  get engine(): QuestionnaireEngine {
    return this.cantons.engine(this.canton().canton);
  }

  /** The ledger keys of the canton's return. */
  get keys(): KeyRegistry {
    return this.cantons.keys(this.canton().canton);
  }

  /** Loads what is already in the folder, once. A missing folder is an empty return. */
  ready(): Promise<void> {
    this.#loading ??= (async () => {
      this.#ledger = await this.vault.loadLedger(this.cantons.ledgerKeys);
      this.#documents = await this.vault.loadDocuments();
      this.#prefs = {
        ...this.#prefs,
        ...(await this.vault.readState('questionnaire.json', this.#prefs)),
      };
      await this.#readSecurities();
      this.#entered = await this.vault.readState('entered.json', this.#entered);
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
    const state = this.canton();
    // A canton taken from earlier answers counts as the answer until the user gives one.
    const assumed: Record<string, string> =
      state.from === 'earlier_answers' && state.answer ? { 'profile.canton': state.answer } : {};
    return this.engine.snapshot(this.ledger, assumed);
  }

  next(): Slot | undefined {
    return this.engine.next(this.snapshot(), this.#prefs.skipped);
  }

  requirements(): Requirement[] {
    return this.engine.requirements(this.snapshot(), this.activeDocuments(), this.#prefs.waived);
  }

  /** Documents that count: every one not replaced by another. */
  activeDocuments(): VaultDocument[] {
    return this.#documents.filter((d) => !d.replacedBy);
  }

  /** The ledger's current view without values from documents that were replaced or are gone. */
  countedFacts(): Fact[] {
    const active = new Set(this.activeDocuments().map((d) => d.id));
    return this.ledger
      .view()
      .filter((f) => f.source.docId === undefined || active.has(f.source.docId));
  }

  /** "Check this" items (SPEC.md section 5.8): derived on every read, never stored. */
  checks(): ConsistencyCheck[] {
    return consistencyChecks({
      taxYear: this.engine.taxYear,
      documents: this.activeDocuments(),
      facts: this.countedFacts(),
    });
  }

  /** The tax office's assessments, compared with what was declared (SPEC.md section 10.8). */
  assessments(): AssessmentView[] {
    // What was declared for this year: values from documents of another year are left out.
    const otherYear = new Set(
      this.activeDocuments()
        .filter((d) => d.taxYear !== undefined && d.taxYear !== this.engine.taxYear)
        .map((d) => d.id),
    );
    const facts = this.countedFacts().filter(
      (f) => f.source.docId === undefined || !otherYear.has(f.source.docId),
    );
    return assessmentViews(this.activeDocuments(), facts);
  }

  /**
   * The tax from the rules engine (SPEC.md section 7), from the values that count, on every read;
   * never stored. Null result when an answer the engine needs is missing (`missing` says which).
   */
  taxEstimate(): { result: TaxResult | null; missing: Text[]; notes: Text[] } {
    const e = this.estimate();
    // Geneva's engine gives Geneva's result (./cantons.ts).
    if (e.canton === 'GE') {
      return { result: e.result as TaxResult | null, missing: e.missing, notes: e.notes };
    }
    return { result: null, missing: e.missing, notes: e.notes };
  }

  /**
   * The tax of the canton of the year (SPEC.md section 7), from the values that count, on every
   * read; never stored: the canton's registry entry reads the ledger and runs its engine
   * (./cantons.ts), with the federal tax; nothing without the canton.
   */
  estimate(): CantonEstimate {
    const state = this.canton();
    const canton = state.canton;
    if (canton) {
      return { canton: canton.code, entry: canton, ...canton.estimate(this.ledgerContext()) };
    }
    // A canton Taxpresso covers, but not for this year: nothing is computed (fail closed).
    if (state.notOffered) {
      const year = this.taxYear;
      return {
        canton: undefined,
        result: null,
        missing: [
          {
            en: `a canton it prepares ${year} returns for (${state.notOffered.name.en} isn't one yet)`,
            fr: `un canton pour lequel il prépare les déclarations ${year} (${state.notOffered.name.fr} n’en fait pas encore partie)`,
          },
        ],
        notes: [],
      };
    }
    return {
      canton: undefined,
      result: null,
      missing: [
        {
          en: 'the canton where you lived on 31 December',
          fr: 'le canton où vous habitiez au 31 décembre',
        },
      ],
      notes: [],
    };
  }

  /** What a canton's tax is computed from: the values that count, for the year's household. */
  ledgerContext(): LedgerContext {
    return {
      taxYear: this.engine.taxYear,
      facts: this.countedFacts(),
      documents: this.activeDocuments(),
      people: this.snapshot().people.filter((p): p is 'p1' | 'p2' => p === 'p1' || p === 'p2'),
    };
  }

  /** Documents Claude hasn't read yet and that can give values or still need a kind. */
  toRead(): VaultDocument[] {
    return this.activeDocuments().filter(
      (d) => d.parse.method === 'none' && (!d.kind || documentFields(d.kind).length > 0),
    );
  }

  /**
   * Values read from documents that still need the user's OK. Suggested answers wait in their
   * questions instead, and last year's figures are only compared, never confirmed.
   */
  toConfirm(): Fact[] {
    return this.countedFacts().filter((f) => f.status === 'extracted' && !isPriorOrProfile(f));
  }

  /** Whether the user ticked this value as entered on the official form (and it hasn't changed). */
  isEntered(fact: Fact): boolean {
    const def = this.keys[fact.key];
    if (!def || !fact.source.docId) return false;
    const typed = formValue(def, fact.value) ?? JSON.stringify(fact.value);
    return (
      this.#entered.entered[
        enteredSlot(fact.source.docId, fact.key, fact.person, fact.instance)
      ] === typed
    );
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
      await this.#importBarcodes(this.#documents.filter((d) => d.parse.method === BARCODE_PENDING));
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
        await this.#importBarcodes([result.document]);
        await this.#importPrior([result.document]);
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
        await this.#importBarcodes(found);
        await this.#importPrior(found);
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
      // A certificate read from its barcode that the user says is something else: read otherwise.
      if (doc.parse.method === BARCODE_PENDING && doc.kind !== kind) {
        doc.parse = { method: 'none', ok: false, warnings: [] };
      }
      doc.kind = kind;
      doc.kindSource = 'user';
      // 'household' = the whole household, e.g. one family statement for both partners.
      if (person) doc.person = person;
      else delete doc.person;
      await this.vault.saveDocuments(this.#documents);
      if (wasExport || kind === 'broker_export') await this.#syncSecurities();
      if (doc.parse.method === BARCODE_PENDING) await this.#importBarcodes([doc]);
      // The user says it is last year's declaration: read it, if Taxpresso hasn't yet.
      if (kind === 'prior_declaration' && doc.parse.method !== PRIOR_METHOD) {
        await this.#importPrior([doc], true);
      }
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
    const canton = this.canton().canton;
    if (canton?.plan) return this.#cantonPlanInput(canton, canton.plan);
    // What the ledger knows besides salaries and the plans' own deductions, so the plans run on
    // the real tax (premiums, childcare, donations, the état des titres).
    const known = engineInputFromFacts(
      this.engine.taxYear,
      this.countedFacts(),
      this.activeDocuments(),
    ).input;
    return {
      ...(this.engine.taxYear === 2025 || this.engine.taxYear === 2026
        ? { taxYear: this.engine.taxYear }
        : {}),
      ...(known
        ? {
            known: {
              ...(known.household ? { household: known.household } : {}),
              ...(known.wealthItems ? { wealthItems: known.wealthItems } : {}),
              ...(known.childSupport ? { childSupport: known.childSupport } : {}),
              ...(known.ifdParentalScale !== undefined
                ? { ifdParentalScale: known.ifdParentalScale }
                : {}),
            },
          }
        : {}),
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

  /**
   * The household as the plans see it, for a canton other than Geneva: its commune and the shared
   * reading of the ledger, with the canton's own part (./cantons.ts, the canton's plan).
   */
  #cantonPlanInput(canton: CantonEntry, plan: CantonPlan): HouseholdInput {
    const snap = this.snapshot();
    const answer = (key: string) => snap.answers.get(`${key}|household`);
    const ctx = this.ledgerContext();
    const taxYear = ctx.taxYear;
    const commune = canton.communeOf?.(answer('profile.commune'), taxYear);
    const known = canton.household?.(ctx).input;
    const custody = answer('profile.children_custody');
    return {
      canton: canton.code,
      ...(taxYear === 2025 || taxYear === 2026 ? { taxYear } : {}),
      other: {
        plan,
        ...(commune !== undefined ? { commune } : {}),
        ...(known
          ? {
              known: {
                ...(known.household ? { household: known.household } : {}),
                ...(known.movable ? { movable: known.movable } : {}),
                ...(known.childSupport ? { childSupport: known.childSupport } : {}),
                ...(known.ifdParentalScale !== undefined
                  ? { ifdParentalScale: known.ifdParentalScale }
                  : {}),
                ...(known.cantonal ? { cantonal: known.cantonal } : {}),
              },
            }
          : {}),
      },
      couple: snap.people.length > 1,
      children: Number(answer('profile.children_count') ?? 0),
      ...(custody ? { custody: custody as HouseholdInput['custody'] & string } : {}),
      people: ctx.people.map((person) => {
        const gross = this.#planMoney('plan.gross_salary', person);
        const net = this.#planMoney('plan.net_salary', person);
        return {
          person,
          ...(gross !== undefined ? { grossCentimes: gross } : {}),
          ...(net !== undefined ? { netCentimes: net } : {}),
          hasPensionFund: this.ledger.get('plan.has_pension_fund', person)?.value !== false,
          paidCentimes: this.#planMoney('plan.pillar3a_paid', person) ?? 0,
        };
      }),
    };
  }

  #planMoney(key: PlanKey, person: 'p1' | 'p2'): number | undefined {
    const v = this.ledger.get(key, person)?.value;
    return typeof v === 'number' && v > 0 ? v : undefined;
  }

  plan(): Pillar3aResult {
    return pillar3aPlan(this.planInput());
  }

  /**
   * Saves one planning input. Money in CHF from the user, stored as centimes; 0 clears a salary.
   * Yes/no and choices (the source-tax tariff) are stored as the user said them.
   */
  async setPlan(
    person: string,
    key: PlanKey,
    value: number | boolean | string,
    via: Via,
  ): Promise<void> {
    return this.#write(async () => {
      this.#usable();
      if (!PLAN_KEYS.includes(key)) throw new WorkspaceError(`Not a planning value: ${key}`);
      // The plans before 31 December and TOU can't be acted on for a year that is over.
      if (this.yearOver()) throw new WorkspaceError(yearOverPlans(this.taxYear));
      const def = this.keys[key]!;
      const owner: Owner = def.perPerson ? (person as 'p1' | 'p2') : 'household';
      if (def.perPerson && !this.snapshot().people.includes(person as 'p1' | 'p2')) {
        throw new WorkspaceError(`No ${person} in this household.`);
      }
      const isMoney = def.type === 'money';
      const expected = isMoney ? 'number' : def.type === 'boolean' ? 'boolean' : 'string';
      if (typeof value !== expected) throw new WorkspaceError('Wrong kind of value.');
      const stored =
        typeof value === 'number'
          ? Math.round(value * 100)
          : typeof value === 'string' && key === 'plan.source_tax_tariff'
            ? this.#tariff(value)
            : value;
      try {
        this.ledger.append({
          key,
          person: owner,
          value: stored,
          status: isMoney ? 'estimate' : 'stated',
          source: { method: 'user', via },
        });
      } catch (err) {
        throw new WorkspaceError((err as Error).message);
      }
      await this.vault.saveLedger(this.ledger);
    });
  }

  /**
   * Stores what Claude read in one document (SPEC.md section 5.5): its details, and each value as
   * "extracted" (Needs your OK) with the page and box it came from. All or nothing: one value that
   * doesn't fit refuses the whole proposal. A value the user already confirmed is never overwritten.
   */
  async proposeExtraction(
    docId: string,
    details: ProposedDetails,
    values: readonly ProposedValue[],
  ): Promise<ExtractionResult> {
    return this.#write(async () => {
      this.#usable();
      const doc = this.#document(docId);
      const people = this.snapshot().people;
      const userSaid = doc.kindSource === 'user';
      if (details.kind && doc.kindSource === 'barcode' && doc.kind && details.kind !== doc.kind) {
        throw new ExtractionError(
          `This document's barcode says it is a ${doc.kind}. Ask the user before reading it as a ${details.kind}; they can change it in the dashboard.`,
        );
      }
      if (details.kind && userSaid && doc.kind && details.kind !== doc.kind) {
        throw new ExtractionError(
          `The user said this document is a ${doc.kind}. Ask them before reading it as a ${details.kind}; they can change it in the dashboard.`,
        );
      }
      if (details.person && details.person !== 'household' && !people.includes(details.person)) {
        throw new ExtractionError(`There is no ${details.person} in this household.`);
      }
      if (details.person && userSaid && doc.person && details.person !== doc.person) {
        throw new ExtractionError(
          `The user said this document is for ${doc.person}, not ${details.person}. Ask them first.`,
        );
      }
      if (
        details.taxYear !== undefined &&
        (!Number.isInteger(details.taxYear) || details.taxYear < 2000 || details.taxYear > 2100)
      ) {
        throw new ExtractionError(`document.taxYear: expected a year such as ${this.taxYear}.`);
      }
      const period = (raw: string | undefined, what: string) => {
        if (raw === undefined) return undefined;
        const parsed = parseDate(raw);
        if (!parsed.ok) throw new ExtractionError(`document.${what}: ${parsed.reason}.`);
        return parsed.value;
      };
      const periodFrom = period(details.periodFrom, 'periodFrom');
      const periodTo = period(details.periodTo, 'periodTo');
      const from = periodFrom ?? doc.periodFrom;
      const to = periodTo ?? doc.periodTo;
      if (from && to && from > to) {
        throw new ExtractionError('document.periodFrom is after document.periodTo.');
      }
      const kind = userSaid && doc.kind ? doc.kind : (details.kind ?? doc.kind);
      if (values.length > 0 && !kind) {
        throw new ExtractionError('Say what kind of document this is (document.kind) first.');
      }
      const allowed: readonly string[] = documentFields(kind);
      const owner = userSaid && doc.person ? doc.person : (details.person ?? doc.person);

      // Check everything before writing anything.
      const seen = new Set<string>();
      const ready: { key: string; person: Owner; value: FactValue; page: number; box?: string }[] =
        [];
      for (const v of values) {
        if (!allowed.includes(v.key)) {
          throw new ExtractionError(
            `${v.key} is not a value of this kind of document (${kind}). Its values: ${allowed.join(', ') || 'none yet'}.`,
          );
        }
        const def = this.keys[v.key]!;
        let person: Owner = 'household';
        if (def.perPerson) {
          const who =
            v.person ??
            (owner && owner !== 'household' ? owner : undefined) ??
            (people.length === 1 ? 'p1' : undefined);
          if (!who) {
            throw new ExtractionError(
              `${v.key}: say whose it is (person p1 or p2, or document.person).`,
            );
          }
          if (!people.includes(who)) {
            throw new ExtractionError(`There is no ${who} in this household.`);
          }
          person = who;
        }
        if (!Number.isInteger(v.page) || v.page < 1) {
          throw new ExtractionError(`${v.key}: give the page it is on (1 for the first page).`);
        }
        if (v.box !== undefined && def.box && normalizeBox(v.box) !== def.box) {
          throw new ExtractionError(
            `${v.key} is box ${def.box} on the form, not ${v.box}. Check which box you read.`,
          );
        }
        const slot = `${v.key}|${person}`;
        if (seen.has(slot)) throw new ExtractionError(`${v.key} is given twice for ${person}.`);
        seen.add(slot);
        const box = def.box ?? v.box?.trim();
        ready.push({
          key: v.key,
          person,
          value: coerceValue(v.key, def, v.value),
          page: v.page,
          ...(box ? { box } : {}),
        });
      }

      // Details: the user's own choices always win.
      if (details.kind && !(userSaid && doc.kind) && doc.kindSource !== 'barcode') {
        doc.kind = details.kind;
        doc.kindSource = 'claude';
      }
      if (details.person && !(userSaid && doc.person)) doc.person = details.person;
      if (details.taxYear !== undefined) doc.taxYear = details.taxYear;
      if (periodFrom) doc.periodFrom = periodFrom;
      if (periodTo) doc.periodTo = periodTo;
      if (details.issuer?.trim()) doc.issuer = details.issuer.trim().slice(0, 120);
      const pending = doc.parse.method === BARCODE_PENDING;
      // A document read from its barcode stays so; Claude only adds what the barcode lacks.
      if (doc.parse.method !== 'barcode' && !pending) {
        doc.parse = { method: 'claude', ok: true, warnings: [] };
      }

      const result: ExtractionResult = { saved: 0, unchanged: 0, kept: [], document: doc };
      for (const r of ready) {
        const current = this.ledger.get(r.key, r.person, doc.id);
        const same =
          current !== undefined && JSON.stringify(current.value) === JSON.stringify(r.value);
        if (current && (current.status === 'stated' || current.status === 'verified')) {
          if (same) result.unchanged++;
          else result.kept.push({ key: r.key, person: r.person, value: current.value });
          continue;
        }
        if (same && current?.source.page === r.page) {
          result.unchanged++;
          continue;
        }
        this.ledger.append({
          key: r.key,
          person: r.person,
          instance: doc.id,
          value: r.value,
          status: 'extracted',
          source: {
            method: 'claude',
            docId: doc.id,
            page: r.page,
            ...(r.box ? { field: r.box } : {}),
          },
        });
        result.saved++;
      }
      await this.vault.saveLedger(this.ledger);
      await this.vault.saveDocuments(this.#documents);
      if (pending) await this.#importBarcodes([doc]);
      this.record('claude', 'extract', doc.filename);
      return result;
    });
  }

  /**
   * The user confirms a value read from a document: it becomes "Confirmed by you". A second tap,
   * or a tap on a value that was confirmed or corrected meanwhile, changes nothing.
   */
  async confirmFact(factId: string, via: Via): Promise<Fact> {
    return this.#write(async () => {
      this.#usable();
      const fact = this.#currentFact(factId);
      if (fact.status !== 'extracted') return fact;
      const confirmed = this.#state(fact, fact.value, via);
      await this.vault.saveLedger(this.ledger);
      this.record(via === 'chat' ? 'claude' : 'you', 'confirm', this.#filename(fact));
      return confirmed;
    });
  }

  /** The user corrects a value read from a document (money as text, as on the document). */
  async editFact(factId: string, raw: unknown, via: Via): Promise<Fact> {
    return this.#write(async () => {
      this.#usable();
      const fact = this.#currentFact(factId);
      const edited = this.#state(fact, this.#coerce(fact.key, raw), via);
      await this.vault.saveLedger(this.ledger);
      this.record(via === 'chat' ? 'claude' : 'you', 'confirm', this.#filename(fact));
      return edited;
    });
  }

  /** A value from a document that the user states in the chat: a confirmation or a correction. */
  async setDocumentValue(
    docId: string,
    key: string,
    person: 'p1' | 'p2' | undefined,
    raw: unknown,
    via: Via,
  ): Promise<Fact> {
    return this.#write(async () => {
      this.#usable();
      const doc = this.#document(docId);
      if (!(documentFields(doc.kind) as readonly string[]).includes(key)) {
        throw new WorkspaceError(
          `${key} is not a value of this document (${doc.kind ?? 'kind not known yet'}).`,
        );
      }
      const def = this.keys[key]!;
      const people = this.snapshot().people;
      let owner: Owner = 'household';
      if (def.perPerson) {
        const who =
          person ??
          (doc.person && doc.person !== 'household' ? doc.person : undefined) ??
          (people.length === 1 ? 'p1' : undefined);
        if (!who || !people.includes(who)) {
          throw new WorkspaceError(`${key}: say whose it is (p1 or p2).`);
        }
        owner = who;
      }
      const value = this.#coerce(key, raw);
      const current = this.ledger.get(key, owner, doc.id);
      const fact = current
        ? this.#state(current, value, via)
        : this.ledger.append({
            key,
            person: owner,
            instance: doc.id,
            value,
            status: 'stated',
            source: { method: 'user', via, docId: doc.id },
          });
      await this.vault.saveLedger(this.ledger);
      this.record(via === 'chat' ? 'claude' : 'you', 'confirm', doc.filename);
      return fact;
    });
  }

  /** The user confirms every value read from one document, and what the document is. */
  async confirmDocument(docId: string, via: Via): Promise<number> {
    return this.#write(async () => {
      this.#usable();
      const doc = this.#document(docId);
      const pending = this.ledger
        .view()
        .filter((f) => f.source.docId === doc.id && f.status === 'extracted');
      for (const fact of pending) this.#state(fact, fact.value, via);
      if (doc.kind) doc.kindSource = 'user';
      await this.vault.saveLedger(this.ledger);
      await this.vault.saveDocuments(this.#documents);
      this.record(via === 'chat' ? 'claude' : 'you', 'confirm', doc.filename);
      return pending.length;
    });
  }

  /** Settles a "Check this" item with the user's note; an empty note opens it again. */
  async resolveCheck(checkId: string, note: string, via: Via): Promise<Fact> {
    return this.#write(async () => {
      this.#usable();
      if (!this.checks().some((c) => c.id === checkId)) {
        throw new WorkspaceError('There is nothing to check with this id now.');
      }
      const fact = this.ledger.append({
        key: 'check.note',
        person: 'household',
        instance: checkId,
        value: note.trim().slice(0, 500),
        status: 'stated',
        source: { method: 'user', via },
      });
      await this.vault.saveLedger(this.ledger);
      this.record(via === 'chat' ? 'claude' : 'you', 'check');
      return fact;
    });
  }

  /**
   * Another document takes the place of this one: a corrected version, the right year, or the
   * same document counted once. The old file stays in the folder; it just no longer counts.
   */
  async replaceDocument(oldId: string, byId: string): Promise<VaultDocument> {
    return this.#write(async () => {
      const old = this.#document(oldId);
      const by = this.#document(byId);
      if (old.id === by.id) throw new WorkspaceError('A document can’t replace itself.');
      old.replacedBy = by.id;
      if (!by.kind && old.kind) {
        by.kind = old.kind;
        by.kindSource = 'user';
        if (old.person) by.person = old.person;
      }
      await this.vault.saveDocuments(this.#documents);
      this.record('you', 'replace', old.filename);
      return by;
    });
  }

  /**
   * What the user said about the securities list and other wealth (official values, owners,
   * accounts without a document), already checked by holdings.ts. Appended in one write.
   */
  async saveHolding(
    facts: readonly {
      key: string;
      instance: string;
      value: FactValue;
      status: 'stated' | 'estimate';
      note?: string;
    }[],
    via: Via,
  ): Promise<Fact[]> {
    return this.#write(async () => {
      this.#usable();
      const saved = facts.map((f) =>
        this.ledger.append({
          key: f.key,
          person: 'household',
          instance: f.instance,
          value: f.value,
          status: f.status,
          source: { method: 'user', via },
          ...(f.note ? { note: f.note } : {}),
        }),
      );
      if (saved.length) await this.vault.saveLedger(this.ledger);
      this.record(via === 'chat' ? 'claude' : 'you', 'confirm');
      return saved;
    });
  }

  /** The user ticks (or unticks) a value as entered on the official form. Local only. */
  async setEntered(factId: string, entered: boolean): Promise<void> {
    return this.#write(async () => {
      const fact = this.#currentFact(factId);
      const def = this.keys[fact.key]!;
      const slot = enteredSlot(fact.source.docId!, fact.key, fact.person, fact.instance);
      if (entered) {
        this.#entered.entered[slot] = formValue(def, fact.value) ?? JSON.stringify(fact.value);
      } else {
        delete this.#entered.entered[slot];
      }
      await this.vault.writeState('entered.json', this.#entered);
    });
  }

  /** What a copy panel row was when the user ticked it as entered, if they did. */
  formEntered(rowId: string): string | undefined {
    return this.#entered.form?.[rowId];
  }

  /** Ticks a copy panel row with its value as typed, or unticks it (undefined). Local only. */
  async setFormEntered(rowId: string, typed: string | undefined): Promise<void> {
    return this.#write(async () => {
      const form = { ...this.#entered.form };
      if (typed === undefined) delete form[rowId];
      else form[rowId] = typed;
      this.#entered = { ...this.#entered, form };
      await this.vault.writeState('entered.json', this.#entered);
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
  securities(lang: ContentLang): SecuritiesView | undefined {
    const s = this.#securities ?? { summary: emptySummary(this.engine.taxYear), unreadable: [] };
    return securitiesView(this.ledger, s.summary, lang, s.unreadable);
  }

  /** Last year's declaration that counts (SPEC.md 5.4), if Taxpresso read one. */
  priorDocument(): VaultDocument | undefined {
    return currentPriorDocument(this.activeDocuments());
  }

  /** The "Last year" card: last year's main figures and the suggestions still waiting. */
  lastYear(lang: ContentLang): LastYearView | undefined {
    return lastYearView(this.ledger, this.activeDocuments(), this.engine.taxYear, lang);
  }

  /**
   * New documents that are a previous year's declaration: read them on this computer, then record
   * the one that counts (the latest year) as suggested answers and last year's figures.
   */
  async #importPrior(added: VaultDocument[], force = false): Promise<void> {
    const read = await recognisePriorDeclarations(this.vault, added, this.engine.taxYear, force);
    const current = this.priorDocument();
    const chosen = read.find((r) => r.doc === current);
    if (chosen) {
      const { figures, suggestions, problems } = recordPriorDeclaration(
        this.ledger,
        chosen.doc,
        chosen.decl,
      );
      chosen.doc.parse.warnings.push(...problems);
      if (figures || suggestions) await this.vault.saveLedger(this.ledger);
    }
    if (read.length || force) await this.vault.saveDocuments(this.#documents);
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

  /**
   * Barcodes first (SPEC.md section 5): reads the barcodes of new documents and of certificates
   * waiting for whose they are, and records what a complete, schema-valid barcode gives.
   */
  async #importBarcodes(docs: readonly VaultDocument[]): Promise<void> {
    let changed = false;
    let facts = false;
    for (const doc of docs) {
      const fresh = doc.parse.method === 'none' && doc.kindSource !== 'export';
      if (!fresh && doc.parse.method !== BARCODE_PENDING) continue;
      // A certificate waiting for whose it is: read again only once that is known.
      if (doc.parse.method === BARCODE_PENDING && !this.#owner(doc)) continue;
      const result = await readDocumentBarcodes(this.vault, doc);
      if (!result) continue;
      const before = JSON.stringify(doc);
      const applied = applyBarcode(this.ledger, this.keys, doc, result, this.#owner(doc));
      if (JSON.stringify(doc) !== before) changed = true;
      if (applied.recorded) facts = true;
    }
    if (changed) await this.vault.saveDocuments(this.#documents);
    if (facts) await this.vault.saveLedger(this.ledger);
  }

  /**
   * Whose a certificate is, when that is certain: the person the user (or Claude, relaying the
   * user) gave the document, or the only person of a household known to be single. Names on the
   * certificate are not used: the household's names are not asked.
   */
  #owner(doc: VaultDocument): 'p1' | 'p2' | undefined {
    const snap = this.snapshot();
    if ((doc.person === 'p1' || doc.person === 'p2') && snap.people.includes(doc.person)) {
      return doc.person;
    }
    const answered = snap.answers.has('profile.civil_status|household');
    return answered && snap.people.length === 1 ? 'p1' : undefined;
  }

  #document(id: string): VaultDocument {
    const doc = this.#documents.find((d) => d.id === id);
    if (!doc) throw new WorkspaceError('No such document. Call list_documents for the ids.');
    if (doc.replacedBy) {
      throw new WorkspaceError(`This document was replaced by ${doc.replacedBy}: use that one.`);
    }
    return doc;
  }

  /**
   * The current value, read from a document that still counts, in the slot of fact `id`. The page
   * may hold an older id of the same value (it was confirmed or corrected meanwhile): that's fine.
   */
  #currentFact(id: string): Fact {
    const any = this.ledger.toJSON().facts.find((f) => f.id === id);
    const current = any && this.ledger.get(any.key, any.person, any.instance);
    const counted = current && this.countedFacts().some((f) => f.id === current.id);
    if (!current || !counted || !current.source.docId || !this.keys[current.key]?.multiple) {
      throw new WorkspaceError('This value is no longer there. Reload the dashboard.');
    }
    return current;
  }

  /** A source-tax tariff as written on a payslip ("A0", "b2n"), as its official code. */
  #tariff(code: string): string {
    try {
      return normalizeTariff(this.engine.taxYear, code);
    } catch (err) {
      throw new WorkspaceError((err as Error).message);
    }
  }

  #coerce(key: string, raw: unknown): FactValue {
    try {
      return coerceValue(key, this.keys[key]!, raw);
    } catch (err) {
      throw new WorkspaceError((err as Error).message);
    }
  }

  /** Appends the user's value for a fact read from a document, keeping where it came from. */
  #state(fact: Fact, value: FactValue, via: Via): Fact {
    return this.ledger.append({
      key: fact.key,
      person: fact.person,
      ...(fact.instance !== undefined ? { instance: fact.instance } : {}),
      value,
      status: 'stated',
      source: {
        method: 'user',
        via,
        ...(fact.source.docId ? { docId: fact.source.docId } : {}),
        ...(fact.source.page ? { page: fact.source.page } : {}),
        ...(fact.source.field ? { field: fact.source.field } : {}),
      },
    });
  }

  #filename(fact: Fact): string {
    return this.#documents.find((d) => d.id === fact.source.docId)?.filename ?? '';
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
