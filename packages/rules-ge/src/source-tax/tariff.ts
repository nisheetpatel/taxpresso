// The barème (tariff code) a Geneva employer takes source tax at, worked out from the household
// instead of asked: ge-na-law-risp art. 1 al. 1 and the directives of the year (ch. 5), which the
// employer itself follows. A code is a letter, the number of children it counts and the church
// letter: "C1N".
//
// - A0: single, divorced, separated or widowed, no child in the household; also with children in
//   alternating custody, or living as an unmarried couple with the children's other parent.
// - H + children: the same, alone with children in main custody (children of an earlier union
//   count too when living with a new partner).
// - B + children: married or in a registered partnership, the spouse without income.
// - C + children: married, the spouse with income: a salary, self-employment, or benefits
//   replacing pay (unemployment, sickness, accident, invalidity, maternity).
// - At most 5 children; a child of 25 or more never counts at source.
// - N: Geneva levies no church tax at source (a voluntary religious contribution needs an ordinary
//   assessment), and publishes N tariffs only.
// - G: benefits an insurance pays itself (not through the employer), whatever the family.
//   Taxpresso has no table for G: the benefits attestation gives that tax.
//
// Nothing is guessed: where an answer it follows from is missing, or the directives depend on
// something Taxpresso doesn't ask (a spouse whose only income is a pension: a partial invalidity
// pension replaces pay, an old-age pension doesn't), no code is derived and `open` says why. A
// barème read from a payslip wins over this one (extension/src/source-tax.ts shows both).
import { SOURCE_TAX_YEARS, type SourceTaxYear } from './index.js';

/** One adult of the household, as the barème needs them. */
export interface TariffPerson {
  person: 'p1' | 'p2';
  /** Taxed at source (derived from the answers, or answered where the law doesn't settle it). */
  atSource: boolean;
  /** Their kinds of income (profile.income_sources); undefined when not answered. */
  incomeSources?: readonly string[];
}

export interface TariffHousehold {
  taxYear: number;
  /** Married or in a registered partnership, living together (one declaration). */
  couple: boolean;
  /** Dependent children (profile.children_count); undefined when not answered. */
  children?: number;
  /** Where they live (profile.children_custody); undefined when not answered. */
  custody?: 'with_household' | 'shared' | 'elsewhere';
  /** A single parent living with the children's other parent, unmarried. */
  livesWithOtherParent?: boolean;
  people: readonly TariffPerson[];
}

export type TariffWhy =
  /** A0: no child in the household. */
  | 'single'
  /** A0: the children are in alternating custody. */
  | 'shared_custody'
  /** A0: living with the children's other parent, unmarried. */
  | 'cohabiting_parents'
  /** H: alone with children in main custody. */
  | 'single_parent'
  /** B: the spouse has no income. */
  | 'spouse_no_income'
  /** C: the spouse has income too. */
  | 'spouse_income';

export type TariffOpen =
  /** An answer the barème follows from is missing (income, children, living together). */
  | 'answers_missing'
  /** The spouse's only income is a pension: a partial invalidity pension counts, an old-age one doesn't. */
  | 'spouse_pension'
  /** A couple whose children live in alternating custody: the directives don't give its barème. */
  | 'couple_shared_custody';

export type TariffAssumption =
  /** Every child counted is under 25 (from 25, only through a DRIS or TOU). */
  | 'children_under_25'
  /** More than 5 children: the barème counts 5. */
  | 'five_children_most';

export interface DerivedTariff {
  person: 'p1' | 'p2';
  /** The official code, e.g. "C1N"; none when `open`. */
  code?: string;
  why?: TariffWhy;
  open?: TariffOpen;
  /** Has benefits, which an insurance paying them itself takes at barème G (no table here). */
  benefitsAtG?: boolean;
  assumptions: TariffAssumption[];
  sources: string[];
}

export class TariffYearError extends Error {}

/** Each rule of the barème and where it is written (manifest id, page and chapter). */
type Pages = Record<
  | 'a'
  | 'b'
  | 'c'
  | 'h'
  | 'spouseIncome'
  | 'g'
  | 'cohabiting'
  | 'sharedCustody'
  | 'five'
  | 'over25'
  | 'church',
  string
>;

/** Where each rule is written, per year (the 2026 directives moved most pages by one). */
const PAGES: Record<SourceTaxYear, Pages> = {
  2025: {
    a: 'ge-2025-source-directives p. 24 (ch. 5.2.1.1); ge-na-law-risp art. 1 al. 1 let. a',
    b: 'ge-2025-source-directives p. 24 (ch. 5.2.1.2); ge-na-law-risp art. 1 al. 1 let. b',
    c: 'ge-2025-source-directives p. 24 and 25 (ch. 5.2.1.3); ge-na-law-risp art. 1 al. 1 let. c',
    h: 'ge-2025-source-directives p. 25 (ch. 5.2.1.4); ge-na-law-risp art. 1 al. 1 let. h',
    spouseIncome: 'ge-2025-source-directives p. 26 (ch. 5.2.1.5, note 3); ge-na-law-risp art. 3',
    g: 'ge-2025-source-directives p. 27 (ch. 5.2.2.5); ge-na-law-risp art. 1 al. 1 let. g',
    cohabiting: 'ge-2025-source-directives p. 29 (ch. 5.5.1)',
    sharedCustody: 'ge-2025-source-directives p. 29 (ch. 5.5.2)',
    five: 'ge-2025-source-directives p. 30 (ch. 5.5.5)',
    over25: 'ge-2025-source-directives p. 26 (ch. 5.2.1.5, notes 1 and 2) and p. 28 (ch. 5.3)',
    church: 'ge-2025-source-directives p. 42 (ch. 6.10); ge-2025-source-tariff-ascii',
  },
  2026: {
    a: 'ge-2026-source-directives p. 25 (ch. 5.2.1.1); ge-na-law-risp art. 1 al. 1 let. a',
    b: 'ge-2026-source-directives p. 25 (ch. 5.2.1.2); ge-na-law-risp art. 1 al. 1 let. b',
    c: 'ge-2026-source-directives p. 25 and 26 (ch. 5.2.1.3); ge-na-law-risp art. 1 al. 1 let. c',
    h: 'ge-2026-source-directives p. 26 (ch. 5.2.1.4); ge-na-law-risp art. 1 al. 1 let. h',
    spouseIncome: 'ge-2026-source-directives p. 27 (ch. 5.2.1.5, note 3); ge-na-law-risp art. 3',
    g: 'ge-2026-source-directives p. 28 (ch. 5.2.2.5); ge-na-law-risp art. 1 al. 1 let. g',
    cohabiting: 'ge-2026-source-directives p. 30 (ch. 5.5.1)',
    sharedCustody: 'ge-2026-source-directives p. 30 (ch. 5.5.2)',
    five: 'ge-2026-source-directives p. 31 (ch. 5.5.5)',
    over25: 'ge-2026-source-directives p. 27 (ch. 5.2.1.5, notes 1 and 2) and p. 29 (ch. 5.3)',
    church: 'ge-2026-source-directives p. 42 (ch. 6.10); ge-2026-source-tariff-ascii',
  },
};

/** The documents the barème rules of a year come from (fails for a year without directives). */
export function tariffSources(taxYear: number): Pages {
  if (!(SOURCE_TAX_YEARS as readonly number[]).includes(taxYear)) {
    throw new TariffYearError(`No Geneva source-tax directives for ${taxYear} in Taxpresso.`);
  }
  return PAGES[taxYear as SourceTaxYear];
}

/** The most children a barème counts (A5, B5, C5, H5). */
export const TARIFF_MAX_CHILDREN = 5;

/** Income that makes a spouse "with income" for barème C: activity, or benefits replacing pay. */
const SPOUSE_INCOME = ['salary', 'self_employment', 'replacement_income'];

/**
 * The barème of each person taxed at source, from the household. People not taxed at source get
 * none (they are not in the list).
 */
export function deriveTariffs(h: TariffHousehold): DerivedTariff[] {
  const pages = tariffSources(h.taxYear);
  return h.people.filter((p) => p.atSource).map((p) => deriveOne(h, p, pages));
}

function deriveOne(h: TariffHousehold, p: TariffPerson, pages: Pages): DerivedTariff {
  const benefitsAtG = p.incomeSources?.includes('replacement_income') === true;
  const base = { person: p.person, ...(benefitsAtG ? { benefitsAtG } : {}) };
  const open = (why: TariffOpen, sources: string[]): DerivedTariff => ({
    ...base,
    open: why,
    assumptions: [],
    sources: benefitsAtG ? [...sources, pages.g] : sources,
  });
  const done = (
    letter: 'A' | 'B' | 'C' | 'H',
    count: number,
    why: TariffWhy,
    sources: string[],
  ): DerivedTariff => {
    const kids = Math.min(count, TARIFF_MAX_CHILDREN);
    const assumptions: TariffAssumption[] = [];
    const cited = [...sources, pages.church];
    if (count > 0) {
      assumptions.push('children_under_25');
      cited.push(pages.over25);
    }
    if (count > TARIFF_MAX_CHILDREN) {
      assumptions.push('five_children_most');
      cited.push(pages.five);
    }
    if (benefitsAtG) cited.push(pages.g);
    return { ...base, code: `${letter}${kids}N`, why, assumptions, sources: cited };
  };

  if (h.children === undefined) return open('answers_missing', []);
  const kids = Number.isInteger(h.children) && h.children > 0 ? h.children : 0;
  if (kids > 0 && h.custody === undefined) return open('answers_missing', []);
  // Children who mostly live with the other parent are not in this household's barème.
  const inHousehold = h.custody === 'elsewhere' ? 0 : kids;

  if (h.couple) {
    const spouse = h.people.find((s) => s.person !== p.person);
    if (!spouse?.incomeSources) return open('answers_missing', [pages.b, pages.c]);
    if (inHousehold > 0 && h.custody === 'shared') {
      return open('couple_shared_custody', [pages.b, pages.c, pages.sharedCustody]);
    }
    if (spouse.incomeSources.some((s) => SPOUSE_INCOME.includes(s))) {
      return done('C', inHousehold, 'spouse_income', [pages.c, pages.spouseIncome]);
    }
    if (spouse.incomeSources.includes('pension')) {
      return open('spouse_pension', [pages.b, pages.c, pages.spouseIncome]);
    }
    return done('B', inHousehold, 'spouse_no_income', [pages.b, pages.spouseIncome]);
  }

  if (inHousehold === 0) return done('A', 0, 'single', [pages.a]);
  if (h.custody === 'shared') return done('A', 0, 'shared_custody', [pages.a, pages.sharedCustody]);
  if (h.livesWithOtherParent === undefined)
    return open('answers_missing', [pages.h, pages.cohabiting]);
  if (h.livesWithOtherParent) {
    return done('A', 0, 'cohabiting_parents', [pages.a, pages.cohabiting]);
  }
  return done('H', inHousehold, 'single_parent', [pages.h]);
}
