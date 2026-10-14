// From the ledger to Lucerne's household input. The reading every canton shares is packages/rules-ch's
// (core/from-ledger.ts, cantonInputFromFacts); Lucerne gives it its commune (by name: the official
// table of units has no BFS number), its form's lines, and what only Lucerne asks (./canton.ts,
// LucerneCantonal): whether each child lives with you, was under 14 at the end of the year and stays
// away from home for their education, the childcare paid for each child, whether the family tariff
// is yours in shared custody without child support, and each adult's and child's confession.
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
import type { LucerneCantonal } from './canton.js';
import { communeOfAnswer, CONFESSIONS } from './keys.js';
import { isLuTaxYear } from './params.js';
import type { Confession } from './types.js';

const NB = ' ';
const t = (en: string, fr: string): Text => ({ en, fr });

/** Cash, precious metals and vehicles described together, as other assets (the shared reading). */
export const NOTE_VALUABLES: Text = t(
  'Cash, precious metals and vehicles you described are taken together on line 416 (Übrige Vermögenswerte); the return also has 404 for cash and gold and 412 for vehicles: the taxable wealth is the same.',
  `Les espèces, métaux précieux et véhicules décrits sont pris ensemble à la ligne 416 (Übrige Vermögenswerte)${NB}; la déclaration a aussi 404 pour les espèces et l’or et 412 pour les véhicules${NB}: la fortune imposable est la même.`,
);

export type LucerneLedgerInput = CantonLedgerInput<LucerneCantonal>;

const isConfession = (v: unknown): v is Confession =>
  typeof v === 'string' && (CONFESSIONS as readonly string[]).includes(v);

/** Lucerne's reading of the ledger: its communes and lines, and its own answers. */
export const LUCERNE_READING: CantonLedgerReading<LucerneCantonal> = {
  isTaxYear: isLuTaxYear,
  commune: (answer, year) => communeOfAnswer(year, answer),
  alimonyLines: {
    received: t('160 and 161', '160 et 161'),
    paid: t('254 and 255', '254 et 255'),
  },
  // Daily allowances and unemployment benefits share 140/141 (lu-2025-guide-wegleitung p. 22).
  cantonal({ input, answer, amount }) {
    const out: LucerneCantonal = {};
    const children = input.children ?? [];
    if (children.length) {
      // Each child, in their order: in your household, under 14 at the end of the year (own care
      // and childcare), and away for their education (the higher child deduction, 352).
      const each = children.map((_, i) => {
        const who = `child${i + 1}` as const;
        const lives = answer('lu.child_lives_with_you', who);
        const under14 = answer('lu.child_under14', who);
        return {
          ...(typeof lives === 'boolean' ? { livesWithYou: lives } : {}),
          ...(typeof under14 === 'boolean' ? { under14 } : {}),
        };
      });
      if (each.some((c) => Object.keys(c).length)) out.children = each;
      const away = children.map((_, i) => answer('lu.child_away', `child${i + 1}`) === true);
      if (away.some(Boolean)) out.childrenAway = away;
      // The childcare paid for each child (the limit is per child), once asked.
      if (children.length > 1) {
        const care = children.map((_, i): Amount | undefined => {
          const a = amount('lu.child_care', `child${i + 1}`);
          return a && a.value > 0 ? a : undefined;
        });
        if (care.some(Boolean)) out.childcare = care;
      }
    }
    // Shared custody without child support: whether the family tariff is yours.
    if (input.childSupport === 'none') {
      const tariff = answer('lu.family_tariff');
      if (typeof tariff === 'boolean') out.familyTariff = tariff;
    }
    // The church tax: each adult's confession, and each child's (the return asks every one), only
    // once every adult answered; until then the engine says the church tax is not in the
    // calculation, and a child's confession not answered stops it (fail closed).
    const church: { p1?: Confession; p2?: Confession; children?: (Confession | undefined)[] } = {};
    let answered = true;
    for (const p of input.people) {
      const c = answer('lu.church', p.id);
      if (isConfession(c)) church[p.id] = c;
      else answered = false;
    }
    if (answered) {
      if (children.length) {
        church.children = children.map((_, i) => {
          const c = answer('lu.child_church', `child${i + 1}`);
          return isConfession(c) ? c : undefined;
        });
      }
      out.church = church;
    }
    return out;
  },
};

export function lucerneInputFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
  wealth: MovableWealth = {},
): LucerneLedgerInput {
  return cantonInputFromFacts(taxYear, facts, documents, LUCERNE_READING, wealth);
}
