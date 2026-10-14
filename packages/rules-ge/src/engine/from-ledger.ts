// From the ledger to Geneva's engine (SPEC.md section 7: "Inputs: the current ledger view"). The
// part every canton shares is packages/rules-ch's (core/from-ledger.ts); Geneva gives it its commune
// (a slug of its list), the lines of its form for the alimony note, and adds its own: the securities
// list and the other movable wealth by rubric (the état des titres, ../2026/etat-des-titres.ts).
import type { Fact, VaultDocument } from '@taxpresso/ledger';
import { householdFromFacts, type CantonReading } from '@taxpresso/rules-ch';
import type { CommuneSlug } from '../2026/communes.js';
import { COMMUNES_2026 } from '../2026/communes.js';
import { etatDesTitres } from '../2026/etat-des-titres.js';
import { isTaxYear } from './params.js';
import type { EngineInput, Text, WealthItemInput } from './types.js';

export interface LedgerInput {
  input: EngineInput | null;
  /** What must be answered before anything can be computed. */
  missing: Text[];
  /** How the ledger was read: what was left out or assumed. */
  notes: Text[];
}

/** How Geneva reads the shared answers: its communes by slug, its form's lines. */
export const GENEVA_READING: CantonReading = {
  isTaxYear,
  commune: (answer) =>
    typeof answer === 'string' && COMMUNES_2026.some((c) => c.slug === answer) ? answer : undefined,
  alimonyLines: { received: { en: '13.10', fr: '13.10' }, paid: { en: '53.10', fr: '53.10' } },
};

export function engineInputFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
): LedgerInput {
  const { input, missing, notes } = householdFromFacts(taxYear, facts, documents, GENEVA_READING);
  if (!input) return { input: null, missing, notes };

  // Accounts, securities, other movable wealth, life insurance and private debts: the état des
  // titres as the securities rules compute it (../2026/etat-des-titres.ts), by rubric and person.
  // It is the only source of these amounts, so none of their facts is read here.
  const people = input.people.map((p) => p.id);
  const wealthItems: WealthItemInput[] = etatDesTitres({
    taxYear,
    people,
    facts,
    documents,
  }).items;

  return {
    input: {
      ...input,
      taxYear: input.taxYear as EngineInput['taxYear'],
      commune: input.commune as CommuneSlug,
      wealthItems,
    } as EngineInput,
    missing,
    notes,
  };
}
