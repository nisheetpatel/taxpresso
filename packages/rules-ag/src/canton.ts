// Aargau behind the canton interface (packages/rules-ch, canton.ts; docs/design/cantons.md,
// section 2): the household input becomes Aargau's engine input, and computeReturn gives exactly
// what the engine gives (the cantonal, communal and church tax; the federal part of the Aargau return
// is not mapped yet, so `ifd` is null). Not wired into the extension. A fact that changes the tax
// and that Aargau's engine does not read is refused, never dropped (fail closed). Left aside because
// they don't change Aargau's tax: the insurance premiums, savings interest and premium subsidy (the
// deduction is a flat amount whatever was paid), the federal parental scale, and the facts only
// Geneva's rules use (a person's or a child's age band, Geneva's meal rule, the commune of work, the
// withholding tax credit shown next to the tax).
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
import { AgInputError } from './assess.js';
import { communesFor, slugOf } from './communes.js';
import { computeReturn } from './compute.js';
import { AG_TAX_YEARS, agParamsFor, type AgTaxYear } from './params.js';
import type {
  AgEngineInput,
  AgTaxResult,
  ChildBand,
  ChildInput,
  MovableOwner,
  PersonInput,
} from './types.js';

/** What only Aargau asks for. */
export interface AargauCantonal extends Pick<AgEngineInput, 'mainUpkeep' | 'church'> {
  /** For each child, in the order of `children`: the age band at the end of the year. */
  childBands?: readonly (ChildBand | undefined)[];
}

/** The shared keys: the salary certificate, the securities and the e-tax statements. */
const KEYS = {
  ...KEYS_SALARY_CERTIFICATE_2026,
  ...KEYS_SECURITIES_2026,
  ...KEYS_ECH0196_2026,
} as const;

function refuse(what: string): never {
  throw new AgInputError(`${what}: Aargau's engine does not read it, so the tax would be wrong.`);
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

/** The household's amounts that don't change Aargau's tax: the insurance flat amount ignores them. */
const FLAT_INSURANCE = [
  'healthPremiums',
  'accidentPremiums',
  'lifeInsurancePremiums',
  'savingsInterest',
  'healthSubsidy',
] as const;

/** Aargau's engine input for a household; throws for what Aargau cannot compute faithfully. */
export function aargauInput(input: HouseholdInput<AargauCantonal>): AgEngineInput {
  agParamsFor(input.taxYear); // throws for a year without official values
  if (typeof input.commune !== 'string') {
    throw new AgInputError(
      `Aargau communes are given by their name (the canton's list carries no BFS number), not ${input.commune}.`,
    );
  }
  if (input.household?.childcare) {
    refuse('Childcare for the household (household.childcare; give it per child)');
  }
  const c = input.cantonal ?? {};
  if (c.childBands && c.childBands.length !== (input.children?.length ?? 0)) {
    throw new AgInputError('cantonal.childBands needs one answer per child, in order.');
  }
  const children: ChildInput[] | undefined = input.children?.map((ch, i) => {
    const band = c.childBands?.[i];
    return { ...without(ch, ['age']), ...(band ? { band } : {}) };
  });
  const movable = input.movable?.map((m) => {
    const owner: string = m.owner;
    if (!isOwner(owner)) refuse(`Accounts or securities of ${owner} (movable[].owner)`);
    return { ...without(m, ['owner', 'withholdingSwiss']), owner };
  });
  const household = input.household
    ? without(input.household, ['childcare', ...FLAT_INSURANCE])
    : undefined;
  return {
    taxYear: input.taxYear as AgTaxYear,
    commune: input.commune,
    civilStatus: input.civilStatus,
    people: input.people.map(person),
    ...(children ? { children } : {}),
    ...(input.childSupport ? { childSupport: input.childSupport } : {}),
    ...(c.mainUpkeep !== undefined ? { mainUpkeep: c.mainUpkeep } : {}),
    ...(c.church ? { church: c.church } : {}),
    ...(household && Object.keys(household).length ? { household } : {}),
    ...(movable ? { movable } : {}),
  };
}

/**
 * Aargau's communes for a tax year, by their name in the canton's list, with their Steuerfuss for
 * natural persons in percent of the einfache Steuer (Aarau 96 % -> 96), cited.
 */
function communes(taxYear: number): Commune[] {
  const table = communesFor(taxYear);
  return table.value.map((c) => ({
    bfs: null,
    slug: slugOf(c.name),
    name: c.name,
    rates: { value: [c.rate], source: table.source },
  }));
}

/** What each kind of document gives: so far the salary certificate, the same in every canton. */
function documents(taxYear: number): DocumentRule[] {
  agParamsFor(taxYear);
  return [{ kind: 'salary_certificate', keys: SALARY_CERTIFICATE_FIELDS_2026 }];
}

export const rules: CantonRules<AargauCantonal, AgTaxResult> = {
  canton: 'AG',
  taxYears: AG_TAX_YEARS,
  communes,
  computeReturn: (input) => computeReturn(aargauInput(input)),
  keys: (taxYear) => {
    agParamsFor(taxYear);
    return KEYS;
  },
  documents,
  sourcesIndex: 'docs/sources/ag',
};
