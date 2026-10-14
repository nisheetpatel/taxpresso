// From the ledger to Ticino's household input. The reading every canton shares is packages/
// rules-ch's (core/from-ledger.ts, cantonInputFromFacts); Ticino gives it its commune (by name: the
// official table of multipliers has no BFS number), its return's lines, and what only Ticino asks
// (./canton.ts, TicinoCantonal): each person's work rate and whether they worked the whole year (and
// the months when not), whether each child was under 18, the childcare paid for each child, and a
// divorce, separation or death of a spouse during the year. Accounts, securities and the other
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
import type { TicinoCantonal } from './canton.js';
import { communeOfAnswer } from './keys.js';
import { isTiTaxYear } from './params.js';

const NB = ' ';
const t = (en: string, fr: string, it: string): Text => ({ en, fr, it });

/**
 * Cash, precious metals and vehicles described together, as other assets (the shared reading): the
 * taxable wealth is the same.
 */
export const NOTE_VALUABLES: Text = t(
  'Cash, precious metals and vehicles you described are taken together on 29.5 (altri elementi della sostanza mobiliare); the return also has 29.2 for cash and gold and 29.4 for vehicles: the taxable wealth is the same.',
  `Les espèces, métaux précieux et véhicules décrits sont pris ensemble à la cifra 29.5 (altri elementi della sostanza mobiliare)${NB}; la déclaration a aussi 29.2 pour les espèces et l’or et 29.4 pour les véhicules${NB}: la fortune imposable est la même.`,
  'Il denaro contante, i metalli preziosi e i veicoli che hai descritto sono presi insieme alla cifra 29.5 (altri elementi della sostanza mobiliare); la dichiarazione ha anche la 29.2 per il contante e l’oro e la 29.4 per i veicoli: la sostanza imponibile è la stessa.',
);

export type TicinoLedgerInput = CantonLedgerInput<TicinoCantonal>;

/** Ticino's reading of the ledger: its communes and lines, and its own answers. */
export const TICINO_READING: CantonLedgerReading<TicinoCantonal> = {
  isTaxYear: isTiTaxYear,
  commune: (answer, year) => communeOfAnswer(year, answer),
  alimonyLines: {
    received: { en: '3.6', fr: '3.6', it: '3.6' },
    paid: { en: '14.1 and 14.2', fr: '14.1 et 14.2', it: '14.1 e 14.2' },
  },
  // Unemployment benefits have their own line (3.4), the daily allowances of sickness and accident
  // insurance theirs (3.5).
  unemploymentApart: true,
  cantonal({ input, answer, amount }) {
    const out: TicinoCantonal = {};
    // Each person with a salary: the work rate and the months worked (Modulo 4, cifra 1).
    const workRate: NonNullable<TicinoCantonal['workRate']> = {};
    const monthsWorked: NonNullable<TicinoCantonal['monthsWorked']> = {};
    const partYear: NonNullable<TicinoCantonal['partYear']> = {};
    for (const p of input.people) {
      if (!p.employments?.length) continue;
      const rate = answer('ti.work_rate', p.id);
      if (typeof rate === 'number') workRate[p.id] = rate;
      const whole = answer('ti.full_year', p.id);
      if (whole === true) monthsWorked[p.id] = 12;
      else if (whole === false) {
        const months = answer('ti.months_worked', p.id);
        if (typeof months === 'number') monthsWorked[p.id] = months;
        else partYear[p.id] = true;
      }
    }
    if (Object.keys(workRate).length) out.workRate = workRate;
    if (Object.keys(monthsWorked).length) out.monthsWorked = monthsWorked;
    if (Object.keys(partYear).length) out.partYear = partYear;
    // The children, in their order: under 18 on 31 December, once every child is answered.
    const children = input.children ?? [];
    if (children.length) {
      const minors = children.map((_, i) => answer('ti.child_minor', `child${i + 1}`));
      if (minors.every((m): m is boolean => typeof m === 'boolean')) out.childrenMinor = minors;
    }
    // The childcare paid for each child (the limit is per child).
    if (children.length > 1) {
      const care = children.map((_, i): Amount | undefined => {
        const a = amount('ti.child_care', `child${i + 1}`);
        return a && a.value > 0 ? a : undefined;
      });
      if (care.some(Boolean)) out.childcare = care;
    }
    // Widowed, divorced or separated: whether it happened during the year.
    if (['widowed', 'divorced', 'separated'].includes(input.civilStatus)) {
      const changed = answer('ti.status_change');
      if (typeof changed === 'boolean') out.changedThisYear = changed;
    }
    return out;
  },
};

export function ticinoInputFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
  wealth: MovableWealth = {},
): TicinoLedgerInput {
  return cantonInputFromFacts(taxYear, facts, documents, TICINO_READING, wealth);
}
