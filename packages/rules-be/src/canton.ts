// Bern behind the canton interface (packages/rules-ch, canton.ts; docs/design/cantons.md,
// section 2): the household input becomes Bern's engine input, and computeReturn gives exactly
// what the engine gives (the cantonal, communal and church tax; the federal column of the Bern form
// is not mapped yet, so `ifd` is null). Not wired into the extension. A fact that changes the tax
// and that Bern's engine does not read is refused, never dropped (fail closed); facts only Geneva's
// rules use (a person's age band, Geneva's meal rule, the commune of work, the withholding tax
// credit shown next to the tax) don't change Bern's tax and are left aside.
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
import { BeInputError } from './assess.js';
import { communesFor, foldName } from './communes.js';
import { computeReturn } from './compute.js';
import { BE_TAX_YEARS, beParamsFor, type BeTaxYear } from './params.js';
import type { BeEngineInput, BeTaxResult, ChildInput, MovableOwner, PersonInput } from './types.js';

/** What only Bern asks for. */
export interface BernCantonal extends Pick<
  BeEngineInput,
  'ownHousehold' | 'marriedTariff' | 'sharedChildWealth' | 'church'
> {
  /** Payments to political parties per person (the limit is per person), instead of the household's. */
  politicalParty?: { p1?: Amount; p2?: Amount };
  /** Education away from home or extra education costs, by child, in the order of `children`. */
  childEducation?: readonly (Amount | undefined)[];
}

/** The shared keys: the salary certificate, the securities and the e-tax statements. */
const KEYS = {
  ...KEYS_SALARY_CERTIFICATE_2026,
  ...KEYS_SECURITIES_2026,
  ...KEYS_ECH0196_2026,
} as const;

function refuse(what: string): never {
  throw new BeInputError(`${what}: Bern's engine does not read it, so the tax would be wrong.`);
}

/** The object without the given keys. */
function without<T extends object, K extends keyof T>(o: T, keys: readonly K[]): Omit<T, K> {
  const drop = new Set<PropertyKey>(keys);
  return Object.fromEntries(Object.entries(o).filter(([k]) => !drop.has(k))) as Omit<T, K>;
}

function person(p: HouseholdPerson, party: Amount | undefined): PersonInput {
  const rest = without(p, ['employments', 'age', 'mealsIccAllowed']);
  return {
    ...rest,
    ...(p.employments
      ? { employments: p.employments.map((e) => without(e, ['workCommune'])) }
      : {}),
    ...(party ? { politicalParty: party } : {}),
  };
}

const isOwner = (o: string): o is MovableOwner =>
  o === 'p1' || o === 'p2' || o === 'household' || /^child\d+$/.test(o);

/** Bern's engine input for a household; throws for what Bern cannot compute faithfully. */
export function bernInput(input: HouseholdInput<BernCantonal>): BeEngineInput {
  beParamsFor(input.taxYear); // throws for a year without official values
  if (typeof input.commune !== 'number') {
    throw new BeInputError(`Bern communes are given by their BFS number, not ${input.commune}.`);
  }
  if (input.household?.childcare) {
    refuse('Childcare for the household (household.childcare; give it per child)');
  }
  const c = input.cantonal ?? {};
  const education = c.childEducation ?? [];
  if (education.length > (input.children?.length ?? 0)) {
    refuse('Education costs for a child not in children (cantonal.childEducation)');
  }
  const children: ChildInput[] | undefined = input.children?.map((ch, i) => ({
    ...without(ch, ['age']),
    ...(education[i] ? { education: education[i] } : {}),
  }));
  const movable = input.movable?.map((m) => {
    const owner: string = m.owner;
    if (!isOwner(owner)) refuse(`Accounts or securities of ${owner} (movable[].owner)`);
    return { ...without(m, ['owner', 'withholdingSwiss']), owner };
  });
  return {
    taxYear: input.taxYear as BeTaxYear,
    commune: input.commune,
    civilStatus: input.civilStatus,
    people: input.people.map((p) => person(p, c.politicalParty?.[p.id])),
    ...(children ? { children } : {}),
    ...(input.childSupport ? { childSupport: input.childSupport } : {}),
    ...(c.ownHousehold !== undefined ? { ownHousehold: c.ownHousehold } : {}),
    ...(c.marriedTariff !== undefined ? { marriedTariff: c.marriedTariff } : {}),
    ...(c.sharedChildWealth !== undefined ? { sharedChildWealth: c.sharedChildWealth } : {}),
    ...(c.church ? { church: c.church } : {}),
    ...(input.household ? { household: without(input.household, ['childcare']) } : {}),
    ...(movable ? { movable } : {}),
  };
}

/** A commune's slug, for display: its name folded ("Biel/Bienne" -> "biel-bienne"). */
const slugOf = (name: string) => foldName(name).replace(/ /g, '-');

/**
 * Bern's communes for a tax year, with their Steueranlage for natural persons in ten-thousandths of
 * the einfache Steuer (1.54 -> 15400), cited.
 */
function communes(taxYear: number): Commune[] {
  const table = communesFor(taxYear);
  return table.value.map((c) => ({
    bfs: c.bfs,
    slug: slugOf(c.name),
    name: c.name,
    rates: { value: [c.rate], source: table.source },
  }));
}

/** What each kind of document gives: so far the salary certificate, the same in every canton. */
function documents(taxYear: number): DocumentRule[] {
  beParamsFor(taxYear);
  return [{ kind: 'salary_certificate', keys: SALARY_CERTIFICATE_FIELDS_2026 }];
}

export const rules: CantonRules<BernCantonal, BeTaxResult> = {
  canton: 'BE',
  taxYears: BE_TAX_YEARS,
  communes,
  computeReturn: (input) => computeReturn(bernInput(input)),
  keys: (taxYear) => {
    beParamsFor(taxYear);
    return KEYS;
  },
  documents,
  sourcesIndex: 'docs/sources/be',
};
