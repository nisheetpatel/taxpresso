// From the ledger to Vaud's household input. The reading every canton shares is packages/rules-ch's
// (core/from-ledger.ts, cantonInputFromFacts); Vaud gives it its commune (by its slug: the official
// tables carry no federal number), its form's lines, unemployment benefits on their own line (200),
// and what only Vaud asks (./canton.ts, VaudCantonal): the part of L'Abbaye or Le Chenit, whether a
// parent who is not married keeps a household alone with the children (annex 03) and, sharing
// custody without child support, mainly bears their upkeep (RIFam art. 5 al. 2), the net rent (660),
// the household contents (440), childcare per child (670) and the interest on savings (480).
// Accounts, securities and the other movable wealth come from the caller, already read.
import type { Fact, VaultDocument } from '@taxpresso/ledger';
import {
  cantonInputFromFacts,
  type CantonLedgerInput,
  type CantonLedgerReading,
  type MovableWealth,
  type Text,
} from '@taxpresso/rules-ch';
import type { VaudCantonal } from './canton.js';
import { communeByName } from './communes.js';
import { communeOfAnswer, partOfAnswer } from './keys.js';
import { isVdTaxYear } from './params.js';

const t = (en: string, fr: string): Text => ({ en, fr });

export type VaudLedgerInput = CantonLedgerInput<VaudCantonal>;

/** Vaud's reading of the ledger: its communes and lines, and its own answers. */
export const VAUD_READING: CantonLedgerReading<VaudCantonal> = {
  isTaxYear: isVdTaxYear,
  commune: (answer, year) => communeOfAnswer(year, answer),
  alimonyLines: {
    received: t('280', '280'),
    paid: t('630', '630'),
  },
  unemploymentApart: true,
  cantonal({ taxYear, input, answer, amount }) {
    const couple = input.civilStatus === 'married';
    const out: VaudCantonal = {};
    // L'Abbaye and Le Chenit: the part of the commune, its fraction or the rest of it.
    const commune = typeof input.commune === 'string' ? input.commune : undefined;
    if (commune && communeByName(taxYear, commune)?.fractions?.length) {
      const part = partOfAnswer(taxYear, answer('vd.commune_part'), commune);
      if (part !== undefined) out.communePart = part;
    }
    // Annex 03, asked of a parent who is not married: a household alone with the children.
    const children = input.children ?? [];
    if (!couple && children.length) {
      const own = answer('vd.own_household');
      if (typeof own === 'boolean') out.ownHousehold = own;
      // Shared custody without child support: who mainly bears the children's upkeep.
      if (input.childSupport === 'none') {
        const upkeep = answer('vd.main_upkeep');
        if (typeof upkeep === 'boolean') out.mainUpkeep = upkeep;
      }
    }
    // Code 660: the yearly net rent, zero when none is paid.
    const rent = amount('vd.rent');
    if (rent) out.rent = rent;
    // Code 440: the household contents, declared only when insured above the value left untaxed.
    const high = answer('vd.contents_high');
    if (high === false) out.furnitureWithin = true;
    else if (high === true) {
      const value = amount('vd.contents_value');
      if (value) out.furnitureInsurance = value;
    }
    // Childcare split per child, when there are several children (the limit is per child).
    if (children.length > 1) {
      const care = children.map((_, i) => {
        const a = amount('vd.child_care', `child${i + 1}`);
        return a && a.value > 0 ? a : undefined;
      });
      if (care.some(Boolean)) out.childcare = care;
    }
    // Code 480: the interest on savings as the user gave it, instead of the accounts' own.
    const savings = amount('vd.savings_interest');
    if (savings) out.savingsInterest = savings;
    return out;
  },
};

export function vaudInputFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
  wealth: MovableWealth = {},
): VaudLedgerInput {
  return cantonInputFromFacts(taxYear, facts, documents, VAUD_READING, wealth);
}
