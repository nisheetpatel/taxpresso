// A property in Switzerland that its owner lives in or lets, the federal rules every canton shares
// (docs/design/cantons.md, section 1). Each canton sets its own rental value, its own wealth value
// and its own flat rates; the federal tax takes the rental value the canton communicates.
//
// The law (ch-na-law-lifd, consolidated on 1 January 2026): the income of real estate is taxed,
// the rents and the rental value of a home the owner keeps for their own use (art. 21 al. 1 let. a
// and b, p. 17), the rental value set by local conditions (art. 21 al. 2); the owner deducts the
// upkeep costs, insurance and management by third parties, energy-saving investments as upkeep
// (art. 32 al. 2, p. 24), or instead a flat deduction (art. 32 al. 4); private debt interest up to
// the taxable income from wealth, art. 21 included, plus CHF 50,000 (art. 33 al. 1 let. a, p. 25).
//
// The federal instructions of each year (ch-2025- and ch-2026-ifd-instructions-personnes-physiques,
// chiffre 8, p. 4 to 6): the rental value is communicated by the canton (p. 5); the actual costs that
// count and those that don't (p. 5 and 6); the flat deduction, 10 % of the gross rents or rental
// value when the building is at most 10 years old at the start of the tax year, 20 % when older,
// the choice made for each tax period and each building (p. 6).
//
// The reform voted in September 2025 (no more rental value for a home its owner lives in, no more
// upkeep deduction except for property let) enters into force on 1 January 2029
// (ch-na-reforme-valeur-locative-2029): tax years 2025 and 2026 keep the rental value, as the 2025
// and 2026 instructions say.
//
// Pure functions on centimes. Each canton names its lines and its form's codes.
import { IFD_UPKEEP_FLAT } from '../abroad/property.js';
import { chf, percent, roundFranc, Trace } from '../core/calc.js';
import type { Cited } from '../core/cited.js';
import type { Line, Text } from '../core/types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';

/** Where each federal rule on a property in Switzerland is written: manifest id plus place. */
export const SWISS_PROPERTY_RULES = {
  /** The rents and the rental value are income. */
  income: 'ch-na-law-lifd art. 21 al. 1 let. a and b, al. 2 (p. 17)',
  /** The upkeep costs, or the flat deduction instead. */
  upkeep: 'ch-na-law-lifd art. 32 al. 2 and 4 (p. 24)',
  /** Debt interest up to the income from wealth (property included) plus CHF 50,000. */
  interest: 'ch-na-law-lifd art. 33 al. 1 let. a (p. 25)',
} as const;

/** The federal instructions' pages on property, per tax year (chiffre 8). */
export const SWISS_PROPERTY_INSTRUCTIONS: Readonly<
  Record<2025 | 2026, { rentalValue: string; costs: string; flat: string }>
> = {
  2025: {
    rentalValue: 'ch-2025-ifd-instructions-personnes-physiques p. 5',
    costs: 'ch-2025-ifd-instructions-personnes-physiques p. 5 and 6',
    flat: 'ch-2025-ifd-instructions-personnes-physiques p. 6',
  },
  2026: {
    rentalValue: 'ch-2026-ifd-instructions-personnes-physiques p. 5',
    costs: 'ch-2026-ifd-instructions-personnes-physiques p. 5 and 6',
    flat: 'ch-2026-ifd-instructions-personnes-physiques p. 6',
  },
};

/**
 * The first tax year without a rental value for a home its owner lives in, and without the upkeep
 * deduction for it: the reform's entry into force, 1 January 2029.
 */
export const RENTAL_VALUE_REFORM: Cited<{ firstYear: number }> = {
  value: { firstYear: 2029 },
  source: 'ch-na-reforme-valeur-locative-2029 (Berne, 01.04.2026)',
};

/** The rental value of a home its owner lives in is still taxed this year (before the reform). */
export const rentalValueTaxed = (taxYear: number) => taxYear < RENTAL_VALUE_REFORM.value.firstYear;

/** The federal upkeep deduction of one property, as chosen: the flat rate or the actual costs. */
export interface FederalUpkeep {
  /** The deduction, in centimes (zero or more). */
  amount: number;
  /** The flat deduction, when the building's age is known. */
  flat?: number;
  /** The actual costs given. */
  actual: number;
  /** Which one counts: the higher one (the owner chooses each year, for each building). */
  used: 'flat' | 'actual' | 'none';
  /** The flat rate in basis points, when known. */
  flatBp?: number;
  trace: Trace;
  how: Text;
}

/**
 * The federal upkeep deduction of one property: the actual costs, or instead the flat deduction of
 * 10 % or 20 % of the gross rents or rental value (`income`) by the building's age at the start of
 * the tax year, whichever is higher (ch-na-law-lifd art. 32 al. 2 and 4; the instructions, p. 6:
 * the choice is made for each tax period and each building). `old` unknown: no flat deduction.
 * The flat amount is taken to the franc, as the Geneva guide's example does (35,856 x 20 % = 7,171,
 * ge-2025-guide-declaration-pp p. 34).
 */
export function federalUpkeep(input: {
  taxYear: 2025 | 2026;
  /** The gross rents or the rental value, in centimes. */
  income: number;
  /** More than 10 years old at the start of the tax year. */
  old?: boolean;
  /** The actual costs of the year, in centimes, and the trace of their inputs. */
  actual: number;
  inputs: readonly Trace[];
  /** What the income is called, for the words: the rents, or the rental value. */
  base: Text;
}): FederalUpkeep {
  const flat = IFD_UPKEEP_FLAT[input.taxYear];
  const trace = new Trace().with(...input.inputs);
  trace.src(SWISS_PROPERTY_RULES.upkeep, SWISS_PROPERTY_INSTRUCTIONS[input.taxYear].costs);
  const bp = input.old === undefined ? undefined : input.old ? flat.value.old : flat.value.young;
  const flatAmount = bp === undefined ? undefined : roundFranc(input.income * bp, 10_000);
  if (bp !== undefined) trace.p(flat);
  const actual = Math.max(0, input.actual);
  const used: FederalUpkeep['used'] =
    flatAmount === undefined
      ? actual > 0
        ? 'actual'
        : 'none'
      : actual > flatAmount
        ? 'actual'
        : 'flat';
  const amount = used === 'flat' ? flatAmount! : used === 'actual' ? actual : 0;
  const age = (fr: boolean) =>
    input.old
      ? fr
        ? 'bâtiment de plus de 10 ans'
        : 'the building is over 10 years old'
      : fr
        ? 'bâtiment de 10 ans au plus'
        : 'the building is at most 10 years old';
  const how =
    used === 'none'
      ? t(
          'No actual costs given, and the building’s age is not known: no upkeep deduction.',
          `Aucun frais effectif indiqué, et l’âge du bâtiment n’est pas connu${NB}: pas de déduction d’entretien.`,
        )
      : used === 'actual'
        ? t(
            `Actual upkeep costs ${chf(actual)}${flatAmount !== undefined ? `, more than the flat ${percent(bp!, 'en')} of ${input.base.en} (${chf(flatAmount)})` : ''}: ${chf(amount)}.`,
            `Frais d’entretien effectifs ${chf(actual)}${flatAmount !== undefined ? `, plus que le forfait de ${percent(bp!, 'fr')} ${input.base.fr} (${chf(flatAmount)})` : ''}${NB}: ${chf(amount)}.`,
          )
        : t(
            `The flat ${percent(bp!, 'en')} of ${input.base.en} (${age(false)}), at least the actual costs (${chf(actual)}): ${chf(amount)}.`,
            `Le forfait de ${percent(bp!, 'fr')} ${input.base.fr} (${age(true)}), au moins les frais effectifs (${chf(actual)})${NB}: ${chf(amount)}.`,
          );
  return {
    amount,
    ...(flatAmount !== undefined ? { flat: flatAmount } : {}),
    actual,
    used,
    ...(bp !== undefined ? { flatBp: bp } : {}),
    trace,
    how,
  };
}

/** The line of a federal upkeep deduction, negative as deductions are. */
export function federalUpkeepLine(u: FederalUpkeep, label: Text): Line {
  return u.trace.line(-u.amount, label, u.how);
}
