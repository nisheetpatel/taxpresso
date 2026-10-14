// From the ledger to Basel-Landschaft's household input. The reading every canton shares is
// packages/rules-ch's (core/from-ledger.ts, cantonInputFromFacts); Basel-Landschaft gives it its
// commune (by name: the official table has no BFS number), its return's lines, and what only
// Basel-Landschaft asks (./canton.ts, BaselLandCantonal): each pensioner's kind of pension (AHV or
// IV, 2026), whether each child has taxable income of its own, who mainly bears a shared child's
// upkeep, each adult's church and the childcare paid for each child. Accounts, securities and the
// other movable wealth come from the caller, already read.
import type { Fact, VaultDocument } from '@taxpresso/ledger';
import {
  cantonInputFromFacts,
  type Amount,
  type CantonLedgerInput,
  type CantonLedgerReading,
  type MovableWealth,
  type Text,
} from '@taxpresso/rules-ch';
import type { BaselLandCantonal } from './canton.js';
import { communeOfAnswer } from './keys.js';
import { isBlTaxYear } from './params.js';
import type { Confession } from './types.js';

const NB = ' ';
const t = (en: string, fr: string): Text => ({ en, fr });

/** Cash, precious metals and vehicles described together, as other assets (the shared reading). */
export const NOTE_VALUABLES: Text = t(
  'Cash, precious metals and vehicles you described are taken together on line 825 (Übrige Vermögenswerte); the return also has 805 for cash and gold and 815 for vehicles: the taxable wealth is the same.',
  `Les espèces, métaux précieux et véhicules décrits sont pris ensemble à la ligne 825 (Übrige Vermögenswerte)${NB}; la déclaration a aussi 805 pour les espèces et l’or et 815 pour les véhicules${NB}: la fortune imposable est la même.`,
);

export type BaselLandLedgerInput = CantonLedgerInput<BaselLandCantonal>;

/** The church of an answer, as the engine names it. */
const CHURCHES: Record<string, Confession> = {
  catholic: 'catholic',
  reformed: 'reformed',
  christ_catholic: 'christCatholic',
  none: 'none',
};

/** Basel-Landschaft's reading of the ledger: its communes and lines, and its own answers. */
export const BASEL_LAND_READING: CantonLedgerReading<BaselLandCantonal> = {
  isTaxYear: isBlTaxYear,
  commune: (answer, year) => communeOfAnswer(year, answer),
  alimonyLines: {
    received: t('310 and 320', '310 et 320'),
    paid: t('570 and 575', '570 et 575'),
  },
  // Unemployment benefits and the other allowances share 260/270; the engine adds them up.
  unemploymentApart: true,
  cantonal({ taxYear, input, answer, amount }) {
    const out: BaselLandCantonal = {};
    // From 2026, the pensioners' deduction differs for AHV (770) and IV (771) pensions.
    if (taxYear !== 2025) {
      const kinds: NonNullable<BaselLandCantonal['pensionKind']> = {};
      for (const p of input.people) {
        const k = answer('bl.pension_kind', p.id);
        if (k === 'ahv' || k === 'iv') kinds[p.id] = k;
      }
      if (kinds.p1 || kinds.p2) out.pensionKind = kinds;
    }
    // The children: whether each one has taxable income of its own, and the childcare paid for each
    // (the limit is per child), in the order of the children.
    const children = input.children ?? [];
    if (children.length) {
      const own = children.map((_, i) => answer('bl.child_income', `child${i + 1}`));
      if (own.some((x) => typeof x === 'boolean')) {
        out.childrenOwnIncome = own.map((x) => x === true);
      }
    }
    if (children.length > 1) {
      const care = children.map((_, i): Amount | undefined => {
        const a = amount('bl.child_care', `child${i + 1}`);
        return a && a.value > 0 ? a : undefined;
      });
      if (care.some(Boolean)) out.childcare = care;
    }
    // Shared custody without child support: who mainly bears the children's upkeep.
    if (input.childSupport === 'none') {
      const main = answer('bl.main_upkeep');
      if (typeof main === 'boolean') out.mainUpkeep = main;
    }
    // The church of each adult: church tax only for a member (opt-in), and only once everyone
    // answered (spouses in different churches are not computed, packages/rules-bl); until then the
    // engine says the church tax is not in the calculation.
    const church: { p1?: Confession; p2?: Confession } = {};
    let answered = true;
    for (const p of input.people) {
      const c = answer('bl.church', p.id);
      const confession = typeof c === 'string' ? CHURCHES[c] : undefined;
      if (confession) church[p.id] = confession;
      else answered = false;
    }
    if (answered) out.church = church;
    return out;
  },
};

export function baselLandInputFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
  wealth: MovableWealth = {},
): BaselLandLedgerInput {
  return cantonInputFromFacts(taxYear, facts, documents, BASEL_LAND_READING, wealth);
}
