// From the ledger to Zug's household input. The reading every canton shares is packages/rules-ch's
// (core/from-ledger.ts, cantonInputFromFacts); Zug gives it its commune (by name: the official table
// has no BFS number), its form's lines, and what only Zug asks (./canton.ts, ZugCantonal): whether
// each child was under 15 on 31 December and a minor, the childcare paid for each child, who has the
// larger share of a shared child's care, the net rent, and each adult's parish and Bürgergemeinde.
// Accounts, securities and the other movable wealth come from the caller, already read.
import type { Fact, VaultDocument } from '@taxpresso/ledger';
import {
  cantonInputFromFacts,
  type Amount,
  type CantonLedgerInput,
  type CantonLedgerReading,
  type MovableWealth,
  type Text,
} from '@taxpresso/rules-ch';
import type { ZugCantonal } from './canton.js';
import { communeOfAnswer } from './keys.js';
import { isZgTaxYear } from './params.js';
import type { Confession } from './types.js';

const NB = ' ';
const t = (en: string, fr: string): Text => ({ en, fr });

/** Cash, precious metals and vehicles described together, as other assets (the shared reading). */
export const NOTE_VALUABLES: Text = t(
  'Cash, precious metals and vehicles you described are taken together on line 606 (Übrige Vermögenswerte); form K also has 601 for cash and gold and 604 for vehicles: the taxable wealth is the same.',
  `Les espèces, métaux précieux et véhicules décrits sont pris ensemble à la ligne 606 (Übrige Vermögenswerte)${NB}; le formulaire K a aussi 601 pour les espèces et l’or et 604 pour les véhicules${NB}: la fortune imposable est la même.`,
);

export type ZugLedgerInput = CantonLedgerInput<ZugCantonal>;

/** The parish of an answer, as the engine names it. */
const CHURCHES: Record<string, Confession> = {
  catholic: 'catholic',
  reformed: 'reformed',
  none: 'none',
};

/** Zug's reading of the ledger: its communes and lines, and its own answers. */
export const ZUG_READING: CantonLedgerReading<ZugCantonal> = {
  isTaxYear: isZgTaxYear,
  commune: (answer, year) => communeOfAnswer(year, answer),
  alimonyLines: {
    received: t('170 and 171', '170 et 171'),
    paid: t('210 and 211', '210 et 211'),
  },
  // Unemployment benefits have their own lines (150/151), the other allowances 145/146.
  unemploymentApart: true,
  cantonal({ taxYear, input, answer, amount }) {
    const out: ZugCantonal = {};
    // The children, in their order: under 15 on 31 December (own care or the extra child
    // deduction) and a minor (the tax-free wealth per child); a child under 15 is a minor.
    const children = input.children ?? [];
    if (children.length) {
      const ages = children.map((_, i) => {
        const under15 = answer('zg.child_under15', `child${i + 1}`);
        const minor = answer('zg.child_minor', `child${i + 1}`);
        return {
          ...(typeof under15 === 'boolean' ? { under15 } : {}),
          ...(typeof minor === 'boolean' && under15 !== true ? { minor } : {}),
        };
      });
      if (ages.some((a) => Object.keys(a).length)) out.children = ages;
    }
    // The childcare paid for each child (the limit is per child, and own care competes with it).
    if (children.length > 1) {
      const care = children.map((_, i): Amount | undefined => {
        const a = amount('zg.child_care', `child${i + 1}`);
        return a && a.value > 0 ? a : undefined;
      });
      if (care.some(Boolean)) out.childcare = care;
    }
    // Shared custody without child support: who has the larger share of the children's care.
    if (input.childSupport === 'none') {
      const main = answer('zg.main_care');
      if (typeof main === 'boolean') out.mainCare = main;
    }
    // The renters' deduction: the net rent, once answered (0 for none).
    const rent = amount('zg.rent');
    if (rent) out.rent = rent;
    // The parish and the Bürgergemeinde of each adult: their taxes only for a member or an Ortsbürger
    // (opt-in), and only once everyone answered; until then the engine says they are not in the
    // calculation.
    const church: { p1?: Confession; p2?: Confession } = {};
    const citizenOf: { p1?: string | null; p2?: string | null } = {};
    let churchAnswered = true;
    let citizensAnswered = true;
    for (const p of input.people) {
      const c = answer('zg.church', p.id);
      const confession = typeof c === 'string' ? CHURCHES[c] : undefined;
      if (confession) church[p.id] = confession;
      else churchAnswered = false;
      const b = answer('zg.citizen_of', p.id);
      if (b === 'none') citizenOf[p.id] = null;
      else {
        const name = communeOfAnswer(taxYear, b);
        if (name) citizenOf[p.id] = name;
        else citizensAnswered = false;
      }
    }
    if (churchAnswered) out.church = church;
    if (citizensAnswered) out.citizenOf = citizenOf;
    return out;
  },
};

export function zugInputFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
  wealth: MovableWealth = {},
): ZugLedgerInput {
  return cantonInputFromFacts(taxYear, facts, documents, ZUG_READING, wealth);
}
