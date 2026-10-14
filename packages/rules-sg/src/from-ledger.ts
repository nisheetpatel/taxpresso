// From the ledger to St. Gallen's household input. The reading every canton shares is packages/
// rules-ch's (core/from-ledger.ts, cantonInputFromFacts); St. Gallen gives it its commune (by name:
// the official table has no BFS number), its return's lines, and what only St. Gallen asks
// (./canton.ts, StGallenCantonal): each child's stage, whether a minor, its education costs and
// scholarships and the childcare paid for it, who mainly bears a shared child's upkeep, each adult's
// church and the church area where the commune's areas differ. Accounts, securities and the other
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
import type { StGallenCantonal } from './canton.js';
import type { Confession } from './communes.js';
import { areaOfAnswer, communeOfAnswer } from './keys.js';
import { isSgTaxYear } from './params.js';
import type { ChildStage } from './types.js';

const NB = ' ';
const t = (en: string, fr: string): Text => ({ en, fr });

/**
 * Cash, precious metals and vehicles described together, as other assets (the shared reading): the
 * taxable wealth is the same.
 */
export const NOTE_VALUABLES: Text = t(
  'Cash, precious metals and vehicles you described are taken together on 30.6 (Übrige Vermögenswerte); the return also has 30.2 for cash and gold and 30.4 for vehicles: the taxable wealth is the same.',
  `Les espèces, métaux précieux et véhicules décrits sont pris ensemble au chiffre 30.6 (Übrige Vermögenswerte)${NB}; la déclaration a aussi 30.2 pour les espèces et l’or et 30.4 pour les véhicules${NB}: la fortune imposable est la même.`,
);

export type StGallenLedgerInput = CantonLedgerInput<StGallenCantonal>;

/** The church of an answer, as the engine names it: the Jewish community's rate is not in the table. */
const CHURCHES: Record<string, Confession> = {
  catholic: 'catholic',
  reformed: 'reformed',
  christ_catholic: 'christ_catholic',
  jewish: 'other',
  none: 'none',
};

const STAGES: Record<string, ChildStage> = { preschool: 'preschool', school: 'school' };

/** St. Gallen's reading of the ledger: its communes and lines, and its own answers. */
export const ST_GALLEN_READING: CantonLedgerReading<StGallenCantonal> = {
  isTaxYear: isSgTaxYear,
  commune: (answer, year) => communeOfAnswer(year, answer),
  alimonyLines: {
    received: t('6.1', '6.1'),
    paid: t('12.1 and 12.2', '12.1 et 12.2'),
  },
  // Unemployment benefits have their own line (3.4), the other allowances 3.3.
  unemploymentApart: true,
  cantonal({ taxYear, input, answer, amount }) {
    const out: StGallenCantonal = {};
    // The children, in their order: not yet of school age, or in school or training (23.1, 23.2);
    // a child in school says whether it is a minor (36.3) and gives its education costs and
    // scholarships (23.3). A child not yet of school age is a minor.
    const children = input.children ?? [];
    if (children.length) {
      const each = children.map((_, i) => {
        const who = `child${i + 1}` as const;
        const s = answer('sg.child_stage', who);
        const stage = typeof s === 'string' ? STAGES[s] : undefined;
        if (stage !== 'school') return stage ? { stage } : {};
        const minor = answer('sg.child_minor', who);
        const costs = amount('sg.child_education', who);
        const grants = costs && costs.value > 0 ? amount('sg.child_scholarships', who) : undefined;
        return {
          stage,
          ...(typeof minor === 'boolean' ? { minor } : {}),
          ...(costs && costs.value > 0 ? { educationCosts: costs } : {}),
          ...(grants && grants.value > 0 ? { scholarships: grants } : {}),
        };
      });
      if (each.some((c) => Object.keys(c).length)) out.children = each;
    }
    // The childcare paid for each child (the limit is per child).
    if (children.length > 1) {
      const care = children.map((_, i): Amount | undefined => {
        const a = amount('sg.child_care', `child${i + 1}`);
        return a && a.value > 0 ? a : undefined;
      });
      if (care.some(Boolean)) out.childcare = care;
    }
    // Shared custody without child support: who mainly bears the children's upkeep.
    if (input.childSupport === 'none') {
      const main = answer('sg.main_upkeep');
      if (typeof main === 'boolean') out.mainUpkeep = main;
    }
    // The church of each adult: the church tax only for a member (opt-in), and only once everyone
    // answered; until then the engine says it is not in the calculation. The church area where the
    // commune's areas differ, when the answer is the commune's.
    const church: { p1?: Confession; p2?: Confession; area?: string } = {};
    let answered = true;
    for (const p of input.people) {
      const c = answer('sg.church', p.id);
      const confession = typeof c === 'string' ? CHURCHES[c] : undefined;
      if (confession) church[p.id] = confession;
      else answered = false;
    }
    if (answered) {
      const commune = typeof input.commune === 'string' ? input.commune : undefined;
      const area = commune ? areaOfAnswer(taxYear, answer('sg.church_area'), commune) : undefined;
      out.church = { ...church, ...(area ? { area } : {}) };
    }
    return out;
  },
};

export function stGallenInputFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
  wealth: MovableWealth = {},
): StGallenLedgerInput {
  return cantonInputFromFacts(taxYear, facts, documents, ST_GALLEN_READING, wealth);
}
