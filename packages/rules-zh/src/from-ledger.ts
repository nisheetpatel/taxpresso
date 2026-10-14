// From the ledger to Zurich's household input. The reading every canton shares is packages/rules-ch's
// (core/from-ledger.ts, cantonInputFromFacts); Zurich gives it its commune (by BFS number, the part
// of the commune where the official table gives two multipliers), its form's lines, unemployment
// benefits on their own line (140/141), and what only Zurich asks: the church of each person
// (opt-in church tax), the parish, and who has the married tariff in shared custody without child
// support. Accounts, securities and the other movable wealth come from the caller (`wealth`),
// already read.
import type { Fact, VaultDocument } from '@taxpresso/ledger';
import {
  cantonInputFromFacts,
  type CantonLedgerInput,
  type CantonLedgerReading,
  type MovableWealth,
  type Text,
} from '@taxpresso/rules-ch';
import type { ZurichCantonal } from './canton.js';
import { communeOfAnswer } from './keys.js';
import { isZhTaxYear } from './params.js';
import type { Confession } from './types.js';

const NB = '\u00a0';
const t = (en: string, fr: string): Text => ({ en, fr });

/** Accounts, securities and the other movable wealth, read for the Zurich lines. */
export type ZurichWealth = MovableWealth;

export type ZurichLedgerInput = CantonLedgerInput<ZurichCantonal>;

const CHURCHES = new Set<Confession>(['reformed', 'catholic', 'christ_catholic', 'none']);

export const NOTE_CHURCH = t(
  'Church tax (Kirchensteuer): not counted for anyone who hasn’t said whether they are a member of a church that levies it.',
  `Impôt ecclésiastique (Kirchensteuer)${NB}: pas compté pour qui n’a pas dit s’il est membre d’une Église qui le perçoit.`,
);
export const NOTE_MARRIED_TARIFF = t(
  'Shared custody without child support: the married tariff (Verheiratetentarif) is taken to go to the parent who earns more, as a rule the one who mainly supports the children (zh-2026-tariff-weisung-sozialabzuege p. 7 and 8).',
  `Garde partagée sans contribution d’entretien${NB}: le barème des personnes mariées (Verheiratetentarif) est attribué au parent qui gagne le plus, en règle générale celui qui assume l’essentiel de l’entretien (zh-2026-tariff-weisung-sozialabzuege p. 7 et 8).`,
);

/** Cash, precious metals and vehicles, which the shared reading takes together as other assets. */
export const NOTE_VALUABLES: Text = {
  en: 'Cash, precious metals and vehicles you described are taken together on line 416 (Übrige Vermögenswerte); the form also has 404 for cash and gold and 412 for vehicles: the taxable wealth is the same.',
  fr: `Les espèces, métaux précieux et véhicules décrits sont pris ensemble à la ligne 416 (Übrige Vermögenswerte)${NB}; le formulaire a aussi 404 pour les espèces et l’or et 412 pour les véhicules${NB}: la fortune imposable est la même.`,
};

/** Zurich's reading of the ledger: its communes and lines, and its own answers. */
export const ZURICH_READING: CantonLedgerReading<ZurichCantonal> = {
  isTaxYear: isZhTaxYear,
  commune: (answer, year) => communeOfAnswer(year, answer)?.bfs,
  alimonyLines: {
    received: t('160 and 161', '160 et 161'),
    paid: t('254 and 255', '254 et 255'),
  },
  unemploymentApart: true,
  cantonal({ taxYear, input, answer, amount, note }) {
    // The commune's part, where the official table gives the parts different multipliers.
    const where = communeOfAnswer(taxYear, answer('profile.commune'));
    // The church of each person: church tax only for a member (opt-in).
    const church: { p1?: Confession; p2?: Confession; parish?: number } = {};
    for (const p of input.people) {
      const c = answer('zh.church', p.id);
      if (typeof c === 'string' && CHURCHES.has(c as Confession)) church[p.id] = c as Confession;
      else note(NOTE_CHURCH);
    }
    const parish = answer('zh.parish');
    if (parish === '1' || parish === '2') church.parish = Number(parish);
    // Shared custody without child support: who has the married tariff (StG § 35 Abs. 2bis).
    const support = input.childSupport === 'none' ? answer('profile.child_support') : undefined;
    const marriedTariff =
      support === 'none_i_earn_more'
        ? true
        : support === 'none_other_earns_more'
          ? false
          : undefined;
    if (marriedTariff !== undefined) note(NOTE_MARRIED_TARIFF);
    const members = Object.values(church).filter((c) => typeof c === 'string' && c !== 'none');
    // Childcare split per child, asked when the invoices for the household need it (the limit is
    // per child): it takes the place of the household's total.
    const children = input.children ?? [];
    const care =
      children.length > 1
        ? children.map((_, i) => {
            const a = amount('zh.child_care', `child${i + 1}`);
            return a && a.value > 0 ? a : undefined;
          })
        : [];
    return {
      ...(care.some(Boolean) ? { childcare: care } : {}),
      ...(where?.variant !== undefined ? { communeVariant: where.variant } : {}),
      ...(marriedTariff !== undefined ? { marriedTariff } : {}),
      ...(members.length ? { church } : {}),
    };
  },
};

export function zurichInputFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
  wealth: ZurichWealth = {},
): ZurichLedgerInput {
  return cantonInputFromFacts(taxYear, facts, documents, ZURICH_READING, wealth);
}
