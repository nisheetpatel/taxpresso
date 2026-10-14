// Basel-Stadt behind the canton interface (packages/rules-ch, canton.ts; docs/design/cantons.md,
// section 2): the household input becomes Basel-Stadt's engine input, and computeReturn gives
// exactly what the engine gives (the cantonal and communal tax; the federal column of the
// Basel-Stadt form is not mapped yet, so `ifd` is null). Not wired into the extension. A fact that
// changes the tax and that Basel-Stadt's engine does not read is refused, never dropped (fail
// closed). Left aside because they don't change Basel-Stadt's tax: the insurance premiums, the
// subsidy and the savings interest (Basel-Stadt deducts a flat amount whatever was paid, StG § 32 al.
// 1 lit. g; the interest is part of the accounts' income), the withholding tax credit shown next to
// the tax, the federal parental scale, and the facts only Geneva's rules use (a person's or a child's
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
import { BsInputError } from './assess.js';
import { communesFor, slugOf } from './communes.js';
import { computeReturn } from './compute.js';
import { BS_TAX_YEARS, bsParamsFor, type BsTaxYear } from './params.js';
import type { BsEngineInput, BsTaxResult, MovableOwner, PersonInput } from './types.js';

/** What only Basel-Stadt asks for. */
export interface BaselCantonal {
  /** Each person's work rate in percent (Beschäftigungsgrad), for the flat professional costs. */
  workRate?: Partial<Record<EnginePerson, number>>;
  /** Whether each person reached the AHV reference age by the end of the year. */
  referenceAge?: Partial<Record<EnginePerson, boolean>>;
  /** For each child, in the order of `children`: under 18 at the end of the year. */
  childrenMinor?: readonly boolean[];
  /** A single parent living in a cohabiting couple (Konkubinat). */
  cohabiting?: boolean;
  /** A child in shared custody: whether you mainly bear its upkeep (StV § 42). */
  mainUpkeep?: boolean;
  /** Member of a recognised church (the church tax is not computed). */
  church?: boolean;
}

/** The shared keys: the salary certificate, the securities and the e-tax statements. */
const KEYS = {
  ...KEYS_SALARY_CERTIFICATE_2026,
  ...KEYS_SECURITIES_2026,
  ...KEYS_ECH0196_2026,
} as const;

function refuse(what: string): never {
  throw new BsInputError(
    `${what}: Basel-Stadt's engine does not read it, so the tax would be wrong.`,
  );
}

/** The object without the given keys. */
function without<T extends object, K extends keyof T>(o: T, keys: readonly K[]): Omit<T, K> {
  const drop = new Set<PropertyKey>(keys);
  return Object.fromEntries(Object.entries(o).filter(([k]) => !drop.has(k))) as Omit<T, K>;
}

function person(p: HouseholdPerson, c: BaselCantonal): PersonInput {
  const rest = without(p, ['employments', 'age', 'mealsIccAllowed']);
  const workRate = c.workRate?.[p.id];
  const referenceAge = c.referenceAge?.[p.id];
  return {
    ...rest,
    ...(p.employments
      ? { employments: p.employments.map((e) => without(e, ['workCommune'])) }
      : {}),
    ...(workRate !== undefined ? { workRate } : {}),
    ...(referenceAge !== undefined ? { referenceAge } : {}),
  };
}

const isOwner = (o: string): o is MovableOwner =>
  o === 'p1' || o === 'p2' || o === 'household' || /^child\d+$/.test(o);

/** Basel-Stadt's engine input for a household; throws for what it cannot compute faithfully. */
export function baselInput(input: HouseholdInput<BaselCantonal>): BsEngineInput {
  bsParamsFor(input.taxYear); // throws for a year without official values
  if (typeof input.commune !== 'string') {
    throw new BsInputError(
      `Basel-Stadt communes are given by their name (the documents carry no BFS number), not ${input.commune}.`,
    );
  }
  const c = input.cantonal ?? {};
  if (input.household?.childcare) {
    refuse('Childcare for the household (household.childcare; give it per child)');
  }
  if (c.childrenMinor && c.childrenMinor.length !== (input.children?.length ?? 0)) {
    throw new BsInputError('cantonal.childrenMinor needs one answer per child, in order.');
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
  const household = input.household
    ? without(input.household, [
        'childcare',
        'healthPremiums',
        'accidentPremiums',
        'healthSubsidy',
        'lifeInsurancePremiums',
        'savingsInterest',
      ])
    : undefined;
  return {
    taxYear: input.taxYear as BsTaxYear,
    commune: input.commune,
    civilStatus: input.civilStatus,
    people: input.people.map((p) => person(p, c)),
    ...(children ? { children } : {}),
    ...(input.childSupport ? { childSupport: input.childSupport } : {}),
    ...(c.cohabiting !== undefined ? { cohabiting: c.cohabiting } : {}),
    ...(c.mainUpkeep !== undefined ? { mainUpkeep: c.mainUpkeep } : {}),
    ...(c.church !== undefined ? { church: c.church } : {}),
    ...(household ? { household } : {}),
    ...(movable ? { movable } : {}),
  };
}

/**
 * Basel-Stadt's communes for a tax year, with their multipliers on the income and on the wealth
 * tax, in hundredths of a percent of the tax computed under the law (Riehen 40 % -> 4000), cited;
 * Basel's are 0: it levies no communal tax.
 */
function communes(taxYear: number): Commune[] {
  const table = communesFor(taxYear);
  return table.value.map((c) => ({
    bfs: null,
    slug: slugOf(c.name),
    name: c.name,
    rates: { value: [c.incomeRate, c.wealthRate], source: table.source },
  }));
}

/** What each kind of document gives: so far the salary certificate, the same in every canton. */
function documents(taxYear: number): DocumentRule[] {
  bsParamsFor(taxYear);
  return [{ kind: 'salary_certificate', keys: SALARY_CERTIFICATE_FIELDS_2026 }];
}

export const rules: CantonRules<BaselCantonal, BsTaxResult> = {
  canton: 'BS',
  taxYears: BS_TAX_YEARS,
  communes,
  computeReturn: (input) => computeReturn(baselInput(input)),
  keys: (taxYear) => {
    bsParamsFor(taxYear);
    return KEYS;
  },
  documents,
  sourcesIndex: 'docs/sources/bs',
};
