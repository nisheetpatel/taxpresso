// Vaud behind the canton interface (packages/rules-ch, canton.ts; docs/design/cantons.md,
// section 2): the household input becomes Vaud's engine input, and computeReturn gives exactly what
// the engine gives (the cantonal and communal tax; the federal column of the Vaud form is not mapped
// yet, so `ifd` is null). Not wired into the extension. A fact that changes the tax and that Vaud's
// engine does not read is refused, never dropped (fail closed); facts only Geneva's rules use (a
// person's age band, Geneva's meal rule, the commune of work, the withholding tax credit shown next
// to the tax) and the federal parental scale don't change Vaud's tax and are left aside.
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
import { VdInputError } from './assess.js';
import { communesFor, slugOf } from './communes.js';
import { computeReturn } from './compute.js';
import { VD_TAX_YEARS, vdParamsFor, type VdTaxYear } from './params.js';
import type { MovableOwner, PersonInput, VdEngineInput, VdTaxResult } from './types.js';

/** What only Vaud asks for. */
export type VaudCantonal = Pick<
  VdEngineInput,
  'communePart' | 'ownHousehold' | 'mainUpkeep' | 'rent' | 'furnitureInsurance'
>;

/** The shared keys: the salary certificate, the securities and the e-tax statements. */
const KEYS = {
  ...KEYS_SALARY_CERTIFICATE_2026,
  ...KEYS_SECURITIES_2026,
  ...KEYS_ECH0196_2026,
} as const;

function refuse(what: string): never {
  throw new VdInputError(`${what}: Vaud's engine does not read it, so the tax would be wrong.`);
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

/** Vaud's engine input for a household; throws for what Vaud cannot compute faithfully. */
export function vaudInput(input: HouseholdInput<VaudCantonal>): VdEngineInput {
  vdParamsFor(input.taxYear); // throws for a year without official values
  if (typeof input.commune !== 'string') {
    throw new VdInputError(
      `Vaud communes are given by their name (the official tables carry no BFS number), not ${input.commune}.`,
    );
  }
  if (input.household?.childcare) {
    refuse('Childcare for the household (household.childcare; give it per child)');
  }
  const children = input.children?.map((ch) => without(ch, ['age']));
  const movable = input.movable?.map((m) => {
    const owner: string = m.owner;
    if (!isOwner(owner)) refuse(`Accounts or securities of ${owner} (movable[].owner)`);
    return { ...without(m, ['owner', 'withholdingSwiss']), owner };
  });
  const c = input.cantonal ?? {};
  return {
    taxYear: input.taxYear as VdTaxYear,
    commune: input.commune,
    civilStatus: input.civilStatus,
    people: input.people.map(person),
    ...(children ? { children } : {}),
    ...(input.childSupport ? { childSupport: input.childSupport } : {}),
    ...(c.communePart !== undefined ? { communePart: c.communePart } : {}),
    ...(c.ownHousehold !== undefined ? { ownHousehold: c.ownHousehold } : {}),
    ...(c.mainUpkeep !== undefined ? { mainUpkeep: c.mainUpkeep } : {}),
    ...(c.rent !== undefined ? { rent: c.rent } : {}),
    ...(c.furnitureInsurance !== undefined ? { furnitureInsurance: c.furnitureInsurance } : {}),
    ...(input.household ? { household: without(input.household, ['childcare']) } : {}),
    ...(movable ? { movable } : {}),
  };
}

/**
 * Vaud's communes for a tax year, with their rate on income and wealth in hundredths of a percent
 * of the cantonal base tax (78.5 % -> 7850), cited; for a commune with fractions, the rest of the
 * commune first, then each fraction with the commune's rate added.
 */
function communes(taxYear: number): Commune[] {
  const table = communesFor(taxYear);
  return table.value.map((c) => ({
    bfs: null,
    slug: slugOf(c.name),
    name: c.name,
    rates: {
      value: [c.rate, ...(c.fractions ?? []).map((f) => c.rate + f.rate)],
      source: table.source,
    },
  }));
}

/** What each kind of document gives: so far the salary certificate, the same in every canton. */
function documents(taxYear: number): DocumentRule[] {
  vdParamsFor(taxYear);
  return [{ kind: 'salary_certificate', keys: SALARY_CERTIFICATE_FIELDS_2026 }];
}

export const rules: CantonRules<VaudCantonal, VdTaxResult> = {
  canton: 'VD',
  taxYears: VD_TAX_YEARS,
  communes,
  computeReturn: (input) => computeReturn(vaudInput(input)),
  keys: (taxYear) => {
    vdParamsFor(taxYear);
    return KEYS;
  },
  documents,
  sourcesIndex: 'docs/sources/vd',
};
