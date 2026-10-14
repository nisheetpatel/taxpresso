// From the ledger to Bern's household input. The reading every canton shares is packages/rules-ch's
// (core/from-ledger.ts, cantonInputFromFacts); Bern gives it its commune (by BFS number), its form's
// lines, unemployment benefits on their own line (2.23), and what only Bern asks
// (./canton.ts, BernCantonal): whether you keep your own household alone (form 1.2), the church of
// each person and the part of the commune whose parish levies a different rate, the tariff and the
// wealth deduction of a parent sharing custody without child support, payments to political parties
// per person (form 4.4) and education costs per child (form 2.1). Accounts, securities and the other
// movable wealth come from the caller, already read.
import type { Fact, VaultDocument } from '@taxpresso/ledger';
import {
  cantonInputFromFacts,
  type Amount,
  type CantonLedgerInput,
  type CantonLedgerReading,
  type MovableWealth,
  type Text,
} from '@taxpresso/rules-ch';
import type { BernCantonal } from './canton.js';
import type { Confession } from './communes.js';
import { communeOfAnswer, partOfAnswer } from './keys.js';
import { isBeTaxYear } from './params.js';

const NB = ' ';
const t = (en: string, fr: string): Text => ({ en, fr });

export type BernLedgerInput = CantonLedgerInput<BernCantonal>;

const CHURCHES = new Set<Confession>(['reformed', 'catholic', 'christ_catholic', 'none']);

export const NOTE_CHURCH = t(
  'Church tax (Kirchensteuer): not counted until everyone has said whether they are a member of a church that levies it.',
  `Impôt paroissial (Kirchensteuer)${NB}: pas compté tant que chacun n’a pas dit s’il est membre d’une Église qui le perçoit.`,
);

/** Bern's reading of the ledger: its communes and lines, and its own answers. */
export const BERN_READING: CantonLedgerReading<BernCantonal> = {
  isTaxYear: isBeTaxYear,
  commune: (answer, year) => communeOfAnswer(year, answer),
  alimonyLines: {
    received: t('2.24', '2.24'),
    paid: t('5.1', '5.1'),
  },
  unemploymentApart: true,
  cantonal({ taxYear, input, answer, amount, note }) {
    const couple = input.civilStatus === 'married';
    const out: BernCantonal = {};
    // Form 1.2: keeping your own household alone, asked of anyone not married.
    if (!couple) {
      const own = answer('be.own_household');
      if (typeof own === 'boolean') out.ownHousehold = own;
    }
    // The church of each person: church tax only for a member (opt-in), and only once everyone
    // answered (one spouse a member and not the other is the church tax law's case).
    const church: { p1?: Confession; p2?: Confession; part?: string } = {};
    let answered = true;
    for (const p of input.people) {
      const c = answer('be.church', p.id);
      if (typeof c === 'string' && CHURCHES.has(c as Confession)) church[p.id] = c as Confession;
      else answered = false;
    }
    if (answered) {
      const commune = typeof input.commune === 'number' ? input.commune : undefined;
      const part =
        commune !== undefined ? partOfAnswer(taxYear, answer('be.parish'), commune) : undefined;
      if (part !== undefined) church.part = part;
      out.church = church;
    } else {
      note(NOTE_CHURCH);
    }
    // Shared custody without child support: the tariff and the wealth deduction per child, as the
    // last assessment shows (the documents don't say how Bern decides them between two homes).
    if (input.childSupport === 'none') {
      const tariff = answer('be.married_tariff');
      if (typeof tariff === 'boolean') out.marriedTariff = tariff;
      const share = answer('be.child_wealth');
      if (share === 'full' || share === 'half') out.sharedChildWealth = share;
    }
    // Political parties, per person (the limit is per person).
    const party: { p1?: Amount; p2?: Amount } = {};
    for (const p of input.people) {
      const a = amount('be.party', p.id);
      if (a && a.value > 0) party[p.id] = a;
    }
    if (party.p1 || party.p2) out.politicalParty = party;
    // Childcare split per child, when there are several children (the limit is per child).
    const children = input.children ?? [];
    if (children.length > 1) {
      const care = children.map((_, i) => {
        const a = amount('be.child_care', `child${i + 1}`);
        return a && a.value > 0 ? a : undefined;
      });
      if (care.some(Boolean)) out.childcare = care;
    }
    // Education away from home or extra education costs, per child, in the order of the children.
    if (children.length && answer('be.education') === true) {
      const education = children.map((_, i) => {
        const a = amount('be.child_education', `child${i + 1}`);
        return a && a.value > 0 ? a : undefined;
      });
      if (education.some(Boolean)) out.childEducation = education;
    }
    return out;
  },
};

export function bernInputFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
  wealth: MovableWealth = {},
): BernLedgerInput {
  return cantonInputFromFacts(taxYear, facts, documents, BERN_READING, wealth);
}
