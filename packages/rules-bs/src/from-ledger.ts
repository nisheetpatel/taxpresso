// From the ledger to Basel-Stadt's household input. The reading every canton shares is packages/
// rules-ch's (core/from-ledger.ts, cantonInputFromFacts); Basel-Stadt gives it its commune (by
// name), its form's lines, and what only Basel-Stadt asks (./canton.ts, BaselCantonal): each
// person's work rate (form B) and whether they reached the AHV reference age, whether a single
// parent lives as a couple (main form p. 1, section 3), whether they mainly bear the upkeep of a
// child in shared custody, whether each child is under 18, the church membership, the childcare
// paid per child (form F) and the payments to political parties (form Z). Accounts, securities and
// the other movable wealth come from the caller, already read.
import type { Fact, VaultDocument } from '@taxpresso/ledger';
import {
  cantonInputFromFacts,
  type Amount,
  type CantonLedgerInput,
  type CantonLedgerReading,
  type MovableWealth,
  type Text,
} from '@taxpresso/rules-ch';
import type { BaselCantonal } from './canton.js';
import { communeOfAnswer } from './keys.js';
import { isBsTaxYear } from './params.js';

const t = (en: string, fr: string): Text => ({ en, fr });

export type BaselLedgerInput = CantonLedgerInput<BaselCantonal>;

const NB = ' ';

/**
 * Cash, precious metals and valuables described without a document are taken together on line 835;
 * a vehicle of daily use is tax-free household goods in Basel-Stadt (bs-2025-guide-wegleitung p. 40),
 * which the description doesn't tell apart.
 */
export const NOTE_VALUABLES: Text = {
  en: 'Cash, precious metals and other valuables you described are counted on line 835 (Bargeld, Edelmetalle und übrige Vermögenswerte). A vehicle you use every day is tax-free in Basel-Stadt, as household goods (Hausrat): if you described one, take it out.',
  fr: `Les espèces, métaux précieux et autres objets de valeur décrits sont comptés à la ligne 835 (Bargeld, Edelmetalle und übrige Vermögenswerte). Un véhicule d’usage quotidien est exonéré à Bâle-Ville, comme mobilier de ménage (Hausrat)${NB}: si vous en avez décrit un, retirez-le.`,
};

/** Basel-Stadt's reading of the ledger: its communes and lines, and its own answers. */
export const BASEL_READING: CantonLedgerReading<BaselCantonal> = {
  isTaxYear: isBsTaxYear,
  commune: (answer, year) => communeOfAnswer(year, answer),
  alimonyLines: {
    received: t('270 and 271', '270 et 271'),
    paid: t('560 and 561', '560 et 561'),
  },
  cantonal({ input, answer, amount }) {
    const couple = input.civilStatus === 'married';
    const out: BaselCantonal = {};
    // Each person's work rate (form B: Beschäftigungsgrad / Pensum in Prozent) and whether they
    // reached the AHV reference age (the deduction for single retirees, 770).
    const workRate: NonNullable<BaselCantonal['workRate']> = {};
    const referenceAge: NonNullable<BaselCantonal['referenceAge']> = {};
    for (const p of input.people) {
      const rate = answer('bs.work_rate', p.id);
      if (typeof rate === 'number' && rate > 0) workRate[p.id] = rate;
      const age = answer('bs.reference_age', p.id);
      if (typeof age === 'boolean') referenceAge[p.id] = age;
    }
    if (Object.keys(workRate).length) out.workRate = workRate;
    if (Object.keys(referenceAge).length) out.referenceAge = referenceAge;
    // A single parent: living as a couple (Konkubinat), and with shared custody, who mainly bears
    // the children's upkeep (StV § 42).
    if (!couple) {
      const cohabiting = answer('bs.cohabiting');
      if (typeof cohabiting === 'boolean') out.cohabiting = cohabiting;
      const upkeep = answer('bs.main_upkeep');
      if (typeof upkeep === 'boolean') out.mainUpkeep = upkeep;
    }
    // Whether each child is under 18, once every child is answered (one answer per child, in order).
    const children = input.children ?? [];
    if (children.length) {
      const minors = children.map((_, i) => answer('bs.child_minor', `child${i + 1}`));
      const known = minors.filter((m): m is boolean => typeof m === 'boolean');
      if (known.length === children.length) out.childrenMinor = known;
    }
    // Church membership: a member says the church tax is not in the calculation; no one, nothing.
    const church = input.people.map((p) => answer('bs.church', p.id));
    if (church.some((c) => c === true)) out.church = true;
    else if (church.every((c) => c === false)) out.church = false;
    // Childcare split per child, when there are several children (the limit is per child).
    if (children.length > 1) {
      const care = children.map((_, i) => {
        const a = amount('bs.child_care', `child${i + 1}`);
        return a && a.value > 0 ? a : undefined;
      });
      if (care.some(Boolean)) out.childcare = care;
    }
    // Payments to political parties (680), apart from donations.
    const party: Amount | undefined = amount('bs.party');
    if (party && party.value > 0) out.politicalParty = party;
    return out;
  },
};

export function baselInputFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
  wealth: MovableWealth = {},
): BaselLedgerInput {
  return cantonInputFromFacts(taxYear, facts, documents, BASEL_READING, wealth);
}
