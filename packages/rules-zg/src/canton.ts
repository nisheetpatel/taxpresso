// Zug behind the canton interface (packages/rules-ch, canton.ts; docs/design/cantons.md, section 2):
// the household input becomes Zug's engine input, and computeReturn gives exactly what the engine
// gives (the cantonal, communal and opt-in church and Bürgergemeinde tax; the federal column of
// form K is not mapped yet, so `ifd` is null). Not wired into the extension. A fact that changes
// the tax and that Zug's engine does not read is refused, never dropped (fail closed). Left aside
// because they don't change Zug's tax: the withholding tax credit shown next to the tax, the
// federal parental scale, and the facts only Geneva's rules use (a person's or a child's age band,
// Geneva's meal rule, the commune of work).
import {
  KEYS_ECH0196_2026,
  KEYS_SALARY_CERTIFICATE_2026,
  KEYS_SECURITIES_2026,
  SALARY_CERTIFICATE_FIELDS_2026,
  type Amount,
  type CantonRules,
  type Commune,
  type DocumentRule,
  type HouseholdInput,
  type PersonInput as HouseholdPerson,
} from '@taxpresso/rules-ch';
import { ZgInputError } from './assess.js';
import { communesFor, slugOf } from './communes.js';
import { computeReturn } from './compute.js';
import { ZG_TAX_YEARS, zgParamsFor, type ZgTaxYear } from './params.js';
import type { Confession, MovableOwner, PersonInput, ZgEngineInput, ZgTaxResult } from './types.js';

/** What only Zug asks for. */
export interface ZugCantonal {
  /**
   * For each child, in the order of `children`: whether it was under 15 on 31 December (own care,
   * 404, or the extra child deduction, 403a) and a minor (the tax-free wealth per child, 673).
   */
  children?: readonly { under15?: boolean; minor?: boolean }[];
  /** Joint custody without child support: whether you have the larger share of the children's care. */
  mainCare?: boolean;
  /** 407: the year's net rent, without service charges, of the home you live in. */
  rent?: Amount;
  /** Opt-in church tax: each adult's parish. */
  church?: { p1?: Confession; p2?: Confession };
  /** Opt-in Bürgergemeinde tax: the Zug commune each adult is an Ortsbürger of, or null. */
  citizenOf?: { p1?: string | null; p2?: string | null };
}

/** The shared keys: the salary certificate, the securities and the e-tax statements. */
const KEYS = {
  ...KEYS_SALARY_CERTIFICATE_2026,
  ...KEYS_SECURITIES_2026,
  ...KEYS_ECH0196_2026,
} as const;

function refuse(what: string): never {
  throw new ZgInputError(`${what}: Zug's engine does not read it, so the tax would be wrong.`);
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

/** Zug's engine input for a household; throws for what it cannot compute faithfully. */
export function zugInput(input: HouseholdInput<ZugCantonal>): ZgEngineInput {
  zgParamsFor(input.taxYear); // throws for a year without official values
  if (typeof input.commune !== 'string') {
    throw new ZgInputError(
      `Zug communes are given by their name (the documents carry no BFS number), not ${input.commune}.`,
    );
  }
  const c = input.cantonal ?? {};
  if (input.household?.childcare) {
    refuse('Childcare for the household (household.childcare; give it per child)');
  }
  if (c.children && c.children.length !== (input.children?.length ?? 0)) {
    throw new ZgInputError('cantonal.children needs one answer per child, in order.');
  }
  const children = input.children?.map((ch, i) => {
    const ages = c.children?.[i] ?? {};
    return {
      ...without(ch, ['age']),
      ...(ages.under15 !== undefined ? { under15: ages.under15 } : {}),
      ...(ages.minor !== undefined ? { minor: ages.minor } : {}),
    };
  });
  const movable = input.movable?.map((m) => {
    const owner: string = m.owner;
    if (!isOwner(owner)) refuse(`Accounts or securities of ${owner} (movable[].owner)`);
    return { ...without(m, ['owner', 'withholdingSwiss']), owner };
  });
  const household = input.household ? without(input.household, ['childcare']) : undefined;
  return {
    taxYear: input.taxYear as ZgTaxYear,
    commune: input.commune,
    civilStatus: input.civilStatus,
    people: input.people.map(person),
    ...(children ? { children } : {}),
    ...(input.childSupport ? { childSupport: input.childSupport } : {}),
    ...(c.mainCare !== undefined ? { mainCare: c.mainCare } : {}),
    ...(c.rent ? { rent: c.rent } : {}),
    ...(c.church ? { church: c.church } : {}),
    ...(c.citizenOf ? { citizenOf: c.citizenOf } : {}),
    ...(household && Object.keys(household).length ? { household } : {}),
    ...(movable ? { movable } : {}),
  };
}

/**
 * Zug's communes for a tax year, with their Steuerfuss in hundredths of a percent of the einfache
 * Steuer (52.11 % -> 5211), cited; no BFS numbers (the official table carries none).
 */
function communes(taxYear: number): Commune[] {
  const table = communesFor(taxYear);
  return table.value.map((x) => ({
    bfs: null,
    slug: slugOf(x.name),
    name: x.name,
    rates: { value: [x.rate], source: table.source },
  }));
}

/** What each kind of document gives: so far the salary certificate, the same in every canton. */
function documents(taxYear: number): DocumentRule[] {
  zgParamsFor(taxYear);
  return [{ kind: 'salary_certificate', keys: SALARY_CERTIFICATE_FIELDS_2026 }];
}

export const rules: CantonRules<ZugCantonal, ZgTaxResult> = {
  canton: 'ZG',
  taxYears: ZG_TAX_YEARS,
  communes,
  computeReturn: (input) => computeReturn(zugInput(input)),
  keys: (taxYear) => {
    zgParamsFor(taxYear);
    return KEYS;
  },
  documents,
  sourcesIndex: 'docs/sources/zg',
};
