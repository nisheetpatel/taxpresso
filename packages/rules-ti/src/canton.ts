// Ticino behind the canton interface (packages/rules-ch, canton.ts; docs/design/cantons.md, section
// 2): the household input becomes Ticino's engine input, and computeReturn gives exactly what the
// engine gives (the cantonal and communal tax; the Ticino return has no federal column, so `ifd` is
// null and the federal tax stays with packages/rules-ch). Not wired into the extension. A fact that
// changes the tax and that Ticino's engine does not read is refused, never dropped (fail closed).
// Left aside because they don't change Ticino's tax: the withholding tax credit shown next to the
// tax, the federal parental scale, and the facts only Geneva's rules use (a person's or a child's
// age band, Geneva's meal rule, the commune of work).
import {
  KEYS_ECH0196_2026,
  KEYS_SALARY_CERTIFICATE_2026,
  KEYS_SECURITIES_2026,
  SALARY_CERTIFICATE_FIELDS_2026,
  type CantonRules,
  type Commune,
  type DocumentRule,
  type EnginePerson,
  type HouseholdInput,
  type PersonInput as HouseholdPerson,
} from '@taxpresso/rules-ch';
import { TiInputError } from './assess.js';
import { communesFor, slugOf } from './communes.js';
import { computeReturn } from './compute.js';
import { TI_TAX_YEARS, tiParamsFor, type TiTaxYear } from './params.js';
import type { MovableOwner, PersonInput, TiEngineInput, TiTaxResult } from './types.js';

/** What only Ticino asks for. */
export interface TicinoCantonal {
  /** Each person's work rate in percent (grado di occupazione), for the flat professional costs. */
  workRate?: Partial<Record<EnginePerson, number>>;
  /** Each person's months of work in the year (1 to 12), when not the whole year. */
  monthsWorked?: Partial<Record<EnginePerson, number>>;
  /** For each child, in the order of `children`: under 18 at the end of the year. */
  childrenMinor?: readonly boolean[];
  /** Widowed, divorced or separated during the tax year (LT art. 35 cpv. 5, art. 53). */
  changedThisYear?: boolean;
}

/** The shared keys: the salary certificate, the securities and the e-tax statements. */
const KEYS = {
  ...KEYS_SALARY_CERTIFICATE_2026,
  ...KEYS_SECURITIES_2026,
  ...KEYS_ECH0196_2026,
} as const;

function refuse(what: string): never {
  throw new TiInputError(`${what}: Ticino's engine does not read it, so the tax would be wrong.`);
}

/** The object without the given keys. */
function without<T extends object, K extends keyof T>(o: T, keys: readonly K[]): Omit<T, K> {
  const drop = new Set<PropertyKey>(keys);
  return Object.fromEntries(Object.entries(o).filter(([k]) => !drop.has(k))) as Omit<T, K>;
}

function person(p: HouseholdPerson, c: TicinoCantonal): PersonInput {
  const rest = without(p, ['employments', 'age', 'mealsIccAllowed']);
  const workRate = c.workRate?.[p.id];
  const monthsWorked = c.monthsWorked?.[p.id];
  return {
    ...rest,
    ...(p.employments
      ? { employments: p.employments.map((e) => without(e, ['workCommune'])) }
      : {}),
    ...(workRate !== undefined ? { workRate } : {}),
    ...(monthsWorked !== undefined ? { monthsWorked } : {}),
  };
}

const isOwner = (o: string): o is MovableOwner =>
  o === 'p1' || o === 'p2' || o === 'household' || /^child\d+$/.test(o);

/** Ticino's engine input for a household; throws for what it cannot compute faithfully. */
export function ticinoInput(input: HouseholdInput<TicinoCantonal>): TiEngineInput {
  tiParamsFor(input.taxYear); // throws for a year without official values
  if (typeof input.commune !== 'string') {
    throw new TiInputError(
      `Ticino communes are given by their name (the official table carries no BFS number), not ${input.commune}.`,
    );
  }
  const c = input.cantonal ?? {};
  if (input.household?.childcare) {
    refuse('Childcare for the household (household.childcare; give it per child)');
  }
  if (c.childrenMinor && c.childrenMinor.length !== (input.children?.length ?? 0)) {
    throw new TiInputError('cantonal.childrenMinor needs one answer per child, in order.');
  }
  const children = input.children?.map((ch, i) => {
    const minor = c.childrenMinor?.[i];
    return { ...without(ch, ['age']), ...(minor !== undefined ? { minor } : {}) };
  });
  const movable = input.movable?.map((m) => {
    const owner: string = m.owner;
    if (!isOwner(owner)) refuse(`Accounts or securities of ${owner} (movable[].owner)`);
    return { ...without(m, ['owner', 'withholdingSwiss']), owner };
  });
  const household = input.household ? without(input.household, ['childcare']) : undefined;
  return {
    taxYear: input.taxYear as TiTaxYear,
    commune: input.commune,
    civilStatus: input.civilStatus,
    people: input.people.map((p) => person(p, c)),
    ...(children ? { children } : {}),
    ...(input.childSupport ? { childSupport: input.childSupport } : {}),
    ...(c.changedThisYear !== undefined ? { changedThisYear: c.changedThisYear } : {}),
    ...(household ? { household } : {}),
    ...(movable ? { movable } : {}),
  };
}

/**
 * Ticino's communes for a tax year, by their name in the official table, with their multiplier for
 * natural persons in hundredths of a percent of the cantonal base tax (LUGANO 77 % -> 7700), cited.
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
  tiParamsFor(taxYear);
  return [{ kind: 'salary_certificate', keys: SALARY_CERTIFICATE_FIELDS_2026 }];
}

export const rules: CantonRules<TicinoCantonal, TiTaxResult> = {
  canton: 'TI',
  taxYears: TI_TAX_YEARS,
  communes,
  computeReturn: (input) => computeReturn(ticinoInput(input)),
  keys: (taxYear) => {
    tiParamsFor(taxYear);
    return KEYS;
  },
  documents,
  sourcesIndex: 'docs/sources/ti',
};
