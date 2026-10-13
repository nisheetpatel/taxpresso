// The facts ledger (SPEC.md section 4): append-only. A new value for the same key, person,
// instance and tax year supersedes the previous one, which stays in the history.
import { randomUUID } from 'node:crypto';
import { INSTANCE_PATTERN, invalidValue, type KeyRegistry } from './keys.js';
import type { Fact, FactSource, FactStatus, FactValue, Owner } from './types.js';

export interface AppendInput {
  key: string;
  person: Owner;
  /** Required for keys that repeat (KeyDef.multiple), refused otherwise. */
  instance?: string;
  value: FactValue;
  status: FactStatus;
  source: FactSource;
  note?: string;
}

export interface LedgerFile {
  version: 1;
  taxYear: number;
  facts: Fact[];
}

export class LedgerError extends Error {}

const slot = (key: string, person: Owner, instance = '') =>
  `${key}\u0000${person}\u0000${instance}`;

export class Ledger {
  readonly taxYear: number;
  readonly #keys: KeyRegistry;
  readonly #facts: Fact[] = [];
  /** Current fact id per key and person. */
  readonly #current = new Map<string, Fact>();

  constructor(taxYear: number, keys: KeyRegistry, facts: readonly Fact[] = []) {
    this.taxYear = taxYear;
    this.#keys = keys;
    for (const fact of facts) this.#load(fact);
  }

  static fromJSON(file: LedgerFile, keys: KeyRegistry): Ledger {
    if (file.version !== 1) throw new LedgerError(`Unknown ledger version ${String(file.version)}`);
    return new Ledger(file.taxYear, keys, file.facts);
  }

  toJSON(): LedgerFile {
    return { version: 1, taxYear: this.taxYear, facts: this.#facts.map((f) => ({ ...f })) };
  }

  append(input: AppendInput, now = new Date()): Fact {
    const def = this.#keys[input.key];
    if (!def) throw new LedgerError(`Unknown key ${input.key}`);
    if (def.perPerson === (input.person === 'household')) {
      throw new LedgerError(
        `${input.key} is ${def.perPerson ? 'per person' : 'for the household'}, got ${input.person}`,
      );
    }
    if (def.multiple && !input.instance) {
      throw new LedgerError(`${input.key} repeats: say which one (instance)`);
    }
    if (!def.multiple && input.instance !== undefined) {
      throw new LedgerError(`${input.key} does not repeat, so it takes no instance`);
    }
    if (input.instance !== undefined && !INSTANCE_PATTERN.test(input.instance)) {
      throw new LedgerError(`${input.key}: instance "${input.instance}" is not a valid id`);
    }
    const problem = invalidValue(def, input.value);
    if (problem) throw new LedgerError(`${input.key}: ${problem}`);
    if (input.status === 'computed') {
      throw new LedgerError('computed values come from the rules engine, never from the ledger');
    }

    const previous = this.#current.get(slot(input.key, input.person, input.instance));
    const fact: Fact = {
      id: `f_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      key: input.key,
      person: input.person,
      ...(input.instance !== undefined ? { instance: input.instance } : {}),
      taxYear: this.taxYear,
      value: Array.isArray(input.value) ? [...input.value] : input.value,
      status: input.status,
      source: { ...input.source },
      ...(input.note ? { note: input.note } : {}),
      ...(previous ? { supersedes: previous.id } : {}),
      createdAt: now.toISOString(),
    };
    this.#facts.push(fact);
    this.#current.set(slot(fact.key, fact.person, fact.instance), fact);
    return fact;
  }

  /** The current value for a key and person (and instance, for keys that repeat), if any. */
  get(key: string, person: Owner = 'household', instance?: string): Fact | undefined {
    return this.#current.get(slot(key, person, instance));
  }

  /** Every current instance of a repeating key, for one person or for everyone. */
  instances(key: string, person?: Owner): Fact[] {
    return this.view().filter(
      (f) =>
        f.key === key && f.instance !== undefined && (person === undefined || f.person === person),
    );
  }

  /** The current view: the latest non-superseded fact per key, person and instance. */
  view(): Fact[] {
    return [...this.#current.values()];
  }

  /** Every value a key has had for a person (and instance), oldest first. */
  history(key: string, person: Owner = 'household', instance?: string): Fact[] {
    return this.#facts.filter(
      (f) => f.key === key && f.person === person && f.instance === instance,
    );
  }

  get size(): number {
    return this.#facts.length;
  }

  #load(fact: Fact): void {
    if (fact.taxYear !== this.taxYear) {
      throw new LedgerError(`Fact ${fact.id} is for ${fact.taxYear}, not ${this.taxYear}`);
    }
    const previous = this.#current.get(slot(fact.key, fact.person, fact.instance));
    if ((previous?.id ?? undefined) !== fact.supersedes) {
      throw new LedgerError(`Fact ${fact.id} breaks the supersedes chain of ${fact.key}`);
    }
    this.#facts.push(fact);
    this.#current.set(slot(fact.key, fact.person, fact.instance), fact);
  }
}
