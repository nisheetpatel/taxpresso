// From the ledger to Fribourg's household input. The reading every canton shares is packages/rules-ch's
// (core/from-ledger.ts, cantonInputFromFacts); Fribourg gives it its commune (by its federal number,
// which the canton's tables give), its form's lines, and what only Fribourg asks (./canton.ts,
// FribourgCantonal): each child's age band and the childcare paid for each child, each adult's
// church and the parish where the commune's parishes differ, the health premium subsidy, the life
// insurance premiums and the interest on savings. Accounts, securities and the other movable wealth
// come from the caller, already read.
import type { Fact, VaultDocument } from '@taxpresso/ledger';
import {
  cantonInputFromFacts,
  type Amount,
  type CantonLedgerInput,
  type CantonLedgerReading,
  type MovableWealth,
  type Text,
} from '@taxpresso/rules-ch';
import type { FribourgCantonal } from './canton.js';
import { communeOfAnswer, CONFESSIONS, parishOfAnswer, type ChildAge } from './keys.js';
import { isFrTaxYear } from './params.js';
import type { ChildInput, Confession } from './types.js';

const NB = ' ';
const t = (en: string, fr: string): Text => ({ en, fr });

/** Cash, precious metals and vehicles described together, as other assets (the shared reading). */
export const NOTE_VALUABLES: Text = t(
  'Cash, precious metals and vehicles you described are taken together on line 3.530 (Collections, œuvres d’art, bijoux, etc.); the return also has 3.230 for cash and gold and 3.510 for vehicles: the taxable wealth is the same.',
  `Les espèces, métaux précieux et véhicules décrits sont pris ensemble au code 3.530 (Collections, œuvres d’art, bijoux, etc.)${NB}; la déclaration a aussi 3.230 pour le numéraire et l’or et 3.510 pour les véhicules${NB}: la fortune imposable est la même.`,
);

export type FribourgLedgerInput = CantonLedgerInput<FribourgCantonal>;

const isConfession = (v: unknown): v is Confession =>
  typeof v === 'string' && (CONFESSIONS as readonly string[]).includes(v);

/** A child's age band as answered, as the engine reads it. */
const AGE: Record<ChildAge, { age: ChildInput['age']; under14: boolean }> = {
  under14: { age: 'child', under14: true },
  minor: { age: 'child', under14: false },
  young: { age: 'young', under14: false },
  adult: { age: 'adult', under14: false },
};

/** Fribourg's reading of the ledger: its communes and lines, and its own answers. */
export const FRIBOURG_READING: CantonLedgerReading<FribourgCantonal> = {
  isTaxYear: isFrTaxYear,
  commune: (answer, year) => communeOfAnswer(year, answer),
  alimonyLines: {
    received: t('3.150', '3.150'),
    paid: t('4.340', '4.340'),
  },
  // Unemployment benefits and the other allowances share 1.510 to 1.530 (guide p. 10).
  cantonal({ taxYear, input, answer, amount }) {
    const out: FribourgCantonal = {};
    const children = input.children ?? [];
    if (children.length) {
      // Each child's age band, in their order.
      const each = children.map((_, i) => {
        const a = answer('fr.child_age', `child${i + 1}`);
        return typeof a === 'string' && a in AGE ? AGE[a as ChildAge] : {};
      });
      if (each.some((c) => Object.keys(c).length)) out.children = each;
      // The childcare paid for each child (the limit is per child), once asked.
      if (children.length > 1) {
        const care = children.map((_, i): Amount | undefined => {
          const a = amount('fr.child_care', `child${i + 1}`);
          return a && a.value > 0 ? a : undefined;
        });
        if (care.some(Boolean)) out.childcare = care;
      }
    }
    // The amounts only Fribourg asks: each replaces what the documents gave.
    const subsidy = amount('fr.health_subsidy');
    if (subsidy) out.healthSubsidy = subsidy;
    const life = amount('fr.life_insurance');
    if (life) out.lifeInsurancePremiums = life;
    const banks = answer('profile.banks');
    const savings = amount('fr.savings_interest');
    if (savings && typeof banks === 'number' && banks > 0) out.savingsInterest = savings;
    // The church tax: each adult's church, only once every adult answered; until then the engine
    // says the church tax is not in the calculation. The parish where the commune's parishes of
    // that church differ.
    const church: { p1?: Confession; p2?: Confession; parish?: string } = {};
    let answered = true;
    for (const p of input.people) {
      const c = answer('fr.church', p.id);
      if (isConfession(c)) church[p.id] = c;
      else answered = false;
    }
    if (answered) {
      const member = [church.p1, church.p2].find((c) => c && c !== 'none');
      if (member && member !== 'none' && typeof input.commune === 'number') {
        const parish = parishOfAnswer(taxYear, answer('fr.parish'), input.commune, member);
        if (parish) church.parish = parish;
      }
      out.church = church;
    }
    return out;
  },
};

export function fribourgInputFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
  wealth: MovableWealth = {},
): FribourgLedgerInput {
  return cantonInputFromFacts(taxYear, facts, documents, FRIBOURG_READING, wealth);
}
