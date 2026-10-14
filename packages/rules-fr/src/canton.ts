// Fribourg behind the canton interface (packages/rules-ch, canton.ts; docs/design/cantons.md,
// section 2): the household input becomes Fribourg's engine input, and computeReturn gives exactly
// what the engine gives (the cantonal, communal and church tax; the federal part of the Fribourg
// return is not mapped yet, so `ifd` is null). Not wired into the extension. A fact that changes
// the tax and that Fribourg's engine does not read is refused, never dropped (fail closed). Facts
// that don't change Fribourg's tax are left aside: the health premiums paid (Fribourg deducts a
// flat amount per insured person, less subsidies), a person's age band, Geneva's meal rule, the
// commune of work, the withholding tax credit shown next to the tax, the federal parental scale.
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
import { FrInputError } from './assess.js';
import { communesFor, slugOf } from './communes.js';
import { computeReturn } from './compute.js';
import { FR_TAX_YEARS, frParamsFor, type FrTaxYear } from './params.js';
import type { FrEngineInput, FrTaxResult, MovableOwner, PersonInput } from './types.js';

/** What only Fribourg asks for. */
export type FribourgCantonal = Pick<FrEngineInput, 'church'>;

/** The shared keys: the salary certificate, the securities and the e-tax statements. */
const KEYS = {
  ...KEYS_SALARY_CERTIFICATE_2026,
  ...KEYS_SECURITIES_2026,
  ...KEYS_ECH0196_2026,
} as const;

function refuse(what: string): never {
  throw new FrInputError(`${what}: Fribourg's engine does not read it, so the tax would be wrong.`);
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

/** Fribourg's engine input for a household; throws for what Fribourg cannot compute faithfully. */
export function fribourgInput(input: HouseholdInput<FribourgCantonal>): FrEngineInput {
  frParamsFor(input.taxYear); // throws for a year without official values
  if (input.household?.childcare) {
    refuse('Childcare for the household (household.childcare; give it per child)');
  }
  if (input.household?.accidentPremiums) {
    refuse(
      'Private accident and loss-of-earnings premiums (household.accidentPremiums; Fribourg deducts basic health and accident insurance as a flat amount, code 4.110, and life, pure-risk and daily-allowance premiums as lifeInsurancePremiums, code 4.120)',
    );
  }
  const movable = input.movable?.map((m) => {
    const owner: string = m.owner;
    if (!isOwner(owner)) refuse(`Accounts or securities of ${owner} (movable[].owner)`);
    return { ...without(m, ['owner', 'withholdingSwiss']), owner };
  });
  const household = input.household
    ? without(input.household, ['childcare', 'accidentPremiums', 'healthPremiums'])
    : undefined;
  const church = input.cantonal?.church;
  return {
    taxYear: input.taxYear as FrTaxYear,
    commune: input.commune,
    civilStatus: input.civilStatus,
    people: input.people.map(person),
    ...(input.children ? { children: input.children } : {}),
    ...(input.childSupport ? { childSupport: input.childSupport } : {}),
    ...(church ? { church } : {}),
    ...(household && Object.keys(household).length ? { household } : {}),
    ...(movable ? { movable } : {}),
  };
}

/**
 * Fribourg's communes for a tax year, by their BFS number, with their coefficient on income and
 * wealth in hundredths of a percent of the cantonal base tax (74.3 % -> 7430), cited; no rate when
 * no document gives it for the year (2026).
 */
function communes(taxYear: number): Commune[] {
  const table = communesFor(taxYear);
  return table.value.map((c) => ({
    bfs: c.bfs,
    slug: slugOf(c.name),
    name: c.name,
    rates: { value: c.rate === null ? [] : [c.rate], source: table.source },
  }));
}

/** What each kind of document gives: so far the salary certificate, the same in every canton. */
function documents(taxYear: number): DocumentRule[] {
  frParamsFor(taxYear);
  return [{ kind: 'salary_certificate', keys: SALARY_CERTIFICATE_FIELDS_2026 }];
}

export const rules: CantonRules<FribourgCantonal, FrTaxResult> = {
  canton: 'FR',
  taxYears: FR_TAX_YEARS,
  communes,
  computeReturn: (input) => computeReturn(fribourgInput(input)),
  keys: (taxYear) => {
    frParamsFor(taxYear);
    return KEYS;
  },
  documents,
  sourcesIndex: 'docs/sources/fr',
};
