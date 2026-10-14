// From the ledger to Geneva's engine (SPEC.md section 7: "Inputs: the current ledger view"). The
// part every canton shares is packages/rules-ch's (core/from-ledger.ts); Geneva gives it its commune
// (a slug of its list), the lines of its form for the alimony note, and adds its own: the securities
// list and the other movable wealth by rubric (the état des titres, ../2026/etat-des-titres.ts).
import type { DocumentKind, Fact, VaultDocument } from '@taxpresso/ledger';
import { amountOf, factsOfYear, householdFromFacts, type CantonReading } from '@taxpresso/rules-ch';
import type { CommuneSlug } from '../2026/communes.js';
import { COMMUNES_2026 } from '../2026/communes.js';
import { etatDesTitres } from '../2026/etat-des-titres.js';
import { isTaxYear } from './params.js';
import type {
  CapitalBenefitInput,
  CapitalInput,
  CapitalReason,
  EngineInput,
  EnginePerson,
  Text,
  WealthItemInput,
} from './types.js';

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

  // Lump sums from the 2nd pillar and pillar 3a, taxed apart (./capital.ts).
  const capital = capitalFromFacts(taxYear, facts, documents, people, notes);
  // Capital paid by an employer (salary certificate box 4, 11.70) stays with the salary, as box 8
  // adds it in: the guide taxes it otherwise when it replaces regular payments or is a pension
  // benefit (ge-2025-guide-declaration-pp p. 17 and 18; ch-2026-ifd-instructions-personnes-
  // physiques p. 9), which Taxpresso can't tell. Said, not changed.
  const box4 = factsOfYear(taxYear, facts, documents, () => undefined).some(
    (f) => f.key === 'salary.capital' && typeof f.value === 'number' && f.value > 0,
  );
  if (box4) {
    notes.push({
      en: 'Capital paid by your employer (salary certificate box 4, 11.70) is counted with your salary, as box 8 adds it in. If it replaces regular payments or is a pension benefit, it is taxed otherwise (guide p. 17 and 18): ask the AFC.',
      fr: `Les prestations en capital versées par votre employeur (chiffre 4 du certificat de salaire, 11.70) sont comptées avec votre salaire, comme le chiffre 8 les inclut. Si elles remplacent des prestations périodiques ou relèvent de la prévoyance, elles sont imposées autrement (guide p. 17 et 18)${NB}: demandez à l’AFC.`,
    });
  }

  return {
    input: {
      ...input,
      taxYear: input.taxYear as EngineInput['taxYear'],
      commune: input.commune as CommuneSlug,
      wealthItems,
      ...(capital ? { capital } : {}),
    } as EngineInput,
    missing,
    notes,
  };
}

/** The pillar of each kind of attestation of a lump sum. */
const CAPITAL_KINDS: Partial<Record<DocumentKind, CapitalBenefitInput['pillar']>> = {
  lpp_capital_attestation: 'pillar2',
  pillar3a_capital_attestation: 'pillar3a',
};

const NB = '\u00a0';

/**
 * The household's lump sums of the year, one per attestation (capital.amount, capital.date), with
 * the answers that decide whether Taxpresso can tax them: why each person's was paid, a salary taxed
 * at source, an arrival from abroad. Undefined when there is none.
 */
export function capitalFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
  people: readonly EnginePerson[],
  notes: Text[] = [],
): CapitalInput | undefined {
  const note = (x: Text) => notes.some((n) => n.en === x.en) || notes.push(x);
  const year = factsOfYear(taxYear, facts, documents, () => undefined);
  const docs = new Map(documents.map((d) => [d.id, d]));
  const owner = (p: Fact['person']): EnginePerson | undefined =>
    p === 'p1' || p === 'p2' ? p : people.length === 1 ? 'p1' : undefined;
  const benefits: CapitalBenefitInput[] = [];
  const instances = [
    ...new Set(year.filter((f) => f.key === 'capital.amount').map((f) => f.instance)),
  ];
  for (const instance of instances) {
    const doc = instance ? docs.get(instance) : undefined;
    const pillar = doc?.kind ? CAPITAL_KINDS[doc.kind] : undefined;
    const own = year.filter((f) => f.key === 'capital.amount' && f.instance === instance);
    for (const person of new Set(own.map((f) => owner(f.person)))) {
      if (!pillar || !person) continue;
      const amount = amountOf(own.filter((f) => owner(f.person) === person));
      if (!amount) continue;
      const date = year.find(
        (f) => f.key === 'capital.date' && f.instance === instance && owner(f.person) === person,
      )?.value;
      benefits.push({
        ...(instance ? { id: instance } : {}),
        person,
        pillar,
        amount,
        ...(typeof date === 'string' ? { date } : {}),
      });
    }
  }
  // An answer the user gave, not a suggestion read from a document.
  const answer = (key: string, person: Fact['person']) =>
    year.find((f) => f.key === key && f.person === person && f.status !== 'extracted')?.value;
  const said = people.filter((p) => {
    const v = answer('profile.pension_capital', p);
    return Array.isArray(v) && v.length > 0;
  });
  if (said.some((p) => !benefits.some((b) => b.person === p))) {
    note({
      en: 'Pension capital: no attestation read yet for a lump sum you said you received, so its separate tax is not computed for it.',
      fr: `Prestations en capital${NB}: aucune attestation lue pour un capital que vous avez dit avoir reçu, son impôt séparé n’est donc pas calculé.`,
    });
  }
  if (!benefits.length) return undefined;
  const reasons: Partial<Record<EnginePerson, readonly CapitalReason[]>> = {};
  for (const p of people) {
    const v = answer('profile.pension_capital_reason', p);
    if (Array.isArray(v) && v.length) reasons[p] = v as CapitalReason[];
  }
  const atSource = people.filter((p) => answer('profile.taxed_at_source', p) === true);
  return {
    benefits,
    reasons,
    ...(atSource.length ? { atSource } : {}),
    ...(answer('profile.moved', 'household') === 'from_abroad' ? { arrivedFromAbroad: true } : {}),
  };
}
