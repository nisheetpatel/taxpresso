// From the ledger to Aargau's household input. The reading every canton shares is
// packages/rules-ch's (core/from-ledger.ts, cantonInputFromFacts); Aargau gives it its commune (by
// name: the canton's list has no BFS number), its return's lines, and what only Aargau asks
// (./canton.ts, AargauCantonal): each adult's church and, where the commune has a further parish of
// that church, the parish; each child's age band; who mainly bears a shared child's upkeep; and the
// childcare paid for each child. Accounts, securities and the other movable wealth come from the
// caller, already read.
import type { Fact, VaultDocument } from '@taxpresso/ledger';
import {
  cantonInputFromFacts,
  type Amount,
  type CantonLedgerInput,
  type CantonLedgerReading,
  type MovableWealth,
  type Text,
} from '@taxpresso/rules-ch';
import type { AargauCantonal } from './canton.js';
import type { Confession } from './communes.js';
import { communeOfAnswer, parishOfAnswer } from './keys.js';
import { isAgTaxYear } from './params.js';
import type { ChildBand } from './types.js';

const NB = ' ';
const t = (en: string, fr: string): Text => ({ en, fr });

/** Cash, precious metals and vehicles described together, as other assets (the shared reading). */
export const NOTE_VALUABLES: Text = t(
  'Cash, precious metals and vehicles you described are taken together on line 20.6 (Übrige Vermögenswerte); the return also has 20.2 for cash and gold and 20.5 for vehicles: the taxable wealth is the same.',
  `Les espèces, métaux précieux et véhicules décrits sont pris ensemble à la ligne 20.6 (Übrige Vermögenswerte)${NB}; la déclaration a aussi 20.2 pour les espèces et l’or et 20.5 pour les véhicules${NB}: la fortune imposable est la même.`,
);

export type AargauLedgerInput = CantonLedgerInput<AargauCantonal>;

const CHURCHES: Record<string, Confession> = {
  reformed: 'reformed',
  catholic: 'catholic',
  christ_catholic: 'christ_catholic',
  none: 'none',
};

const BANDS: Record<string, ChildBand> = {
  under14: 'under14',
  under18: 'under18',
  adult: 'adult',
};

/** Aargau's reading of the ledger: its communes and lines, and its own answers. */
export const AARGAU_READING: CantonLedgerReading<AargauCantonal> = {
  isTaxYear: isAgTaxYear,
  commune: (answer, year) => communeOfAnswer(year, answer),
  alimonyLines: {
    received: t('5.1 and 5.2', '5.1 et 5.2'),
    paid: t('12.1 and 12.2', '12.1 et 12.2'),
  },
  // Unemployment benefits (3, Leistungen der Arbeitslosenversicherung) have their own line; the
  // other daily allowances theirs.
  unemploymentApart: true,
  cantonal({ taxYear, input, answer, amount }) {
    const out: AargauCantonal = {};
    // The children: each one's age band, and the childcare paid for each (the limit is per child),
    // in the order of the children.
    const children = input.children ?? [];
    if (children.length) {
      const bands = children.map((_, i) => {
        const b = answer('ag.child_band', `child${i + 1}`);
        return typeof b === 'string' ? BANDS[b] : undefined;
      });
      if (bands.some(Boolean)) out.childBands = bands;
    }
    if (children.length > 1) {
      const care = children.map((_, i): Amount | undefined => {
        const a = amount('ag.child_care', `child${i + 1}`);
        return a && a.value > 0 ? a : undefined;
      });
      if (care.some(Boolean)) out.childcare = care;
    }
    // Shared custody without child support: who mainly bears the children's upkeep.
    if (input.childSupport === 'none') {
      const main = answer('ag.main_upkeep');
      if (typeof main === 'boolean') out.mainUpkeep = main;
    }
    // The church of each adult: church tax only for a member (opt-in), and only once everyone
    // answered (spouses in different churches are not computed, packages/rules-ag); until then the
    // engine says the church tax is not in the calculation. The parish, where the commune has a
    // further parish of the household's church.
    const church: NonNullable<AargauCantonal['church']> = {};
    let answered = true;
    for (const p of input.people) {
      const c = answer('ag.church', p.id);
      const confession = typeof c === 'string' ? CHURCHES[c] : undefined;
      if (confession) church[p.id] = confession;
      else answered = false;
    }
    if (answered) {
      const parish =
        typeof input.commune === 'string'
          ? parishOfAnswer(taxYear, answer('ag.parish'), input.commune)
          : undefined;
      out.church = { ...church, ...(parish !== undefined ? { parish } : {}) };
    }
    return out;
  },
};

export function aargauInputFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
  wealth: MovableWealth = {},
): AargauLedgerInput {
  return cantonInputFromFacts(taxYear, facts, documents, AARGAU_READING, wealth);
}
