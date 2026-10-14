// Lucerne behind the canton interface (packages/rules-ch, canton.ts; docs/design/cantons.md,
// section 2): the household input becomes Lucerne's engine input, and computeReturn gives exactly
// what the engine gives (the state, communal, church and personal tax; the Lucerne return has no
// federal column, the authority derives the federal tax, so `ifd` is null and the federal tax stays
// with packages/rules-ch). Not wired into the extension. A fact that changes the tax and that
// Lucerne's engine does not read is refused, never dropped (fail closed). Left aside because they
// don't change Lucerne's tax: the withholding tax credit shown next to the tax, the federal
// parental scale, and the facts only Geneva's rules use (a person's or a child's age band, Geneva's
// meal rule, the commune of work).
import {
  KEYS_ECH0196_2026,
  KEYS_SALARY_CERTIFICATE_2026,
  KEYS_SECURITIES_2026,
  SALARY_CERTIFICATE_FIELDS_2026,
  type CantonRules,
  type Commune,
  type DocumentRule,
  type HouseholdInput,
  type PersonInput as HouseholdPerson,
} from '@taxpresso/rules-ch';
import { LuInputError } from './assess.js';
import { communesFor, slugOf } from './communes.js';
import { computeReturn } from './compute.js';
import { LU_TAX_YEARS, luParamsFor, type LuTaxYear } from './params.js';
import type { LuEngineInput, LuTaxResult, MovableOwner, PersonInput } from './types.js';

/** What only Lucerne asks for. */
export interface LucerneCantonal extends Pick<LuEngineInput, 'familyTariff' | 'church'> {
  /**
   * For each child, in the order of `children`: in education and staying away from home for it all
   * the time (Ziffer 352).
   */
  childrenAway?: readonly boolean[];
}

/** The shared keys: the salary certificate, the securities and the e-tax statements. */
const KEYS = {
  ...KEYS_SALARY_CERTIFICATE_2026,
  ...KEYS_SECURITIES_2026,
  ...KEYS_ECH0196_2026,
} as const;

function refuse(what: string): never {
  throw new LuInputError(`${what}: Lucerne's engine does not read it, so the tax would be wrong.`);
}

/** The object without the given keys. */
function without<T extends object, K extends keyof T>(o: T, keys: readonly K[]): Omit<T, K> {
  const drop = new Set<PropertyKey>(keys);
  return Object.fromEntries(Object.entries(o).filter(([k]) => !drop.has(k))) as Omit<T, K>;
}

function person(p: HouseholdPerson): PersonInput {
  const rest = without(p, ['employments', 'age', 'mealsIccAllowed']);
  return {
    ...rest,
    ...(p.employments
      ? { employments: p.employments.map((e) => without(e, ['workCommune'])) }
      : {}),
  };
}

const isOwner = (o: string): o is MovableOwner =>
  o === 'p1' || o === 'p2' || o === 'household' || /^child\d+$/.test(o);

/** Lucerne's engine input for a household; throws for what it cannot compute faithfully. */
export function lucerneInput(input: HouseholdInput<LucerneCantonal>): LuEngineInput {
  luParamsFor(input.taxYear); // throws for a year without official values
  if (typeof input.commune !== 'string') {
    throw new LuInputError(
      `Lucerne communes are given by their name (the official table carries no BFS number), not ${input.commune}.`,
    );
  }
  const c = input.cantonal ?? {};
  if (input.household?.childcare) {
    refuse('Childcare for the household (household.childcare; give it per child)');
  }
  const count = input.children?.length ?? 0;
  if (c.childrenAway && c.childrenAway.length !== count) {
    throw new LuInputError('cantonal.childrenAway needs one answer per child, in order.');
  }
  if (c.church?.children && c.church.children.length > count) {
    throw new LuInputError('cantonal.church.children has more entries than children.');
  }
  const children = input.children?.map((ch, i) => ({
    ...without(ch, ['age']),
    ...(c.childrenAway?.[i] ? { away: true } : {}),
  }));
  const movable = input.movable?.map((m) => {
    const owner: string = m.owner;
    if (!isOwner(owner)) refuse(`Accounts or securities of ${owner} (movable[].owner)`);
    return { ...without(m, ['owner', 'withholdingSwiss']), owner };
  });
  const household = input.household ? without(input.household, ['childcare']) : undefined;
  return {
    taxYear: input.taxYear as LuTaxYear,
    commune: input.commune,
    civilStatus: input.civilStatus,
    people: input.people.map(person),
    ...(children ? { children } : {}),
    ...(input.childSupport ? { childSupport: input.childSupport } : {}),
    ...(c.familyTariff !== undefined ? { familyTariff: c.familyTariff } : {}),
    ...(c.church ? { church: c.church } : {}),
    ...(household ? { household } : {}),
    ...(movable ? { movable } : {}),
  };
}

/**
 * Lucerne's communes for a tax year, by their name in the official table, with the units of the
 * Einwohnergemeinde in ten-thousandths (Luzern 2025: 1.55 -> 15500), cited.
 */
function communes(taxYear: number): Commune[] {
  const table = communesFor(taxYear);
  return table.value.map((c) => ({
    bfs: null,
    slug: slugOf(c.name),
    name: c.name,
    rates: { value: [c.units], source: table.source },
  }));
}

/** What each kind of document gives: so far the salary certificate, the same in every canton. */
function documents(taxYear: number): DocumentRule[] {
  luParamsFor(taxYear);
  return [{ kind: 'salary_certificate', keys: SALARY_CERTIFICATE_FIELDS_2026 }];
}

export const rules: CantonRules<LucerneCantonal, LuTaxResult> = {
  canton: 'LU',
  taxYears: LU_TAX_YEARS,
  communes,
  computeReturn: (input) => computeReturn(lucerneInput(input)),
  keys: (taxYear) => {
    luParamsFor(taxYear);
    return KEYS;
  },
  documents,
  sourcesIndex: 'docs/sources/lu',
};
