// Aargau behind the canton interface (packages/rules-ch, canton.ts; docs/design/cantons.md,
// section 2): the household input becomes Aargau's engine input, and computeReturn gives exactly
// what the engine gives (the cantonal, communal and church tax, and the federal tax, ./ifd.ts). The
// extension reads it through its canton registry. A fact that changes the tax and that Aargau's
// engine does not read is refused, never dropped (fail closed). The insurance premiums, the premium
// subsidy and the savings interest count for the federal tax only (the cantonal deduction is a flat
// amount whatever was paid). Left aside because they change neither tax: the withholding tax credit
// shown next to the tax, and the facts only Geneva's rules use (a person's or a child's age band,
// Geneva's meal rule, the commune of work).
import type { DocumentKind } from '@taxpresso/ledger';
import {
  ATTESTATION_FIELDS_2026,
  DOCUMENT_FIELDS_WEALTH_2026,
  SALARY_CERTIFICATE_FIELDS_2026,
  type Amount,
  type CantonRules,
  type Commune,
  type DocumentRule,
  type HouseholdInput,
  type PersonInput as HouseholdPerson,
} from '@taxpresso/rules-ch';
import { AgInputError } from './assess.js';
import { communesFor, slugOf } from './communes.js';
import { computeReturn } from './compute.js';
import { agKeys } from './keys.js';
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
  /**
   * Childcare paid, by child, in the order of `children` (the limit is per child, StG § 40 Abs. 1
   * lit. n): replaces childcare given for the household as a whole.
   */
  childcare?: readonly (Amount | undefined)[];
}

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

/** Aargau's engine input for a household; throws for what Aargau cannot compute faithfully. */
export function aargauInput(input: HouseholdInput<AargauCantonal>): AgEngineInput {
  agParamsFor(input.taxYear); // throws for a year without official values
  if (typeof input.commune !== 'string') {
    throw new AgInputError(
      `Aargau communes are given by their name (the canton's list carries no BFS number), not ${input.commune}.`,
    );
  }
  const c = input.cantonal ?? {};
  const count = input.children?.length ?? 0;
  if (c.childBands && c.childBands.length !== count) {
    throw new AgInputError('cantonal.childBands needs one answer per child, in order.');
  }
  if (c.childcare && c.childcare.length > count) {
    refuse('Childcare for a child not in children (cantonal.childcare)');
  }
  const children: ChildInput[] | undefined = input.children?.map((ch, i) => {
    const band = c.childBands?.[i];
    const care = c.childcare?.[i];
    return {
      ...without(ch, ['age']),
      ...(band ? { band } : {}),
      ...(care ? { childcare: care } : {}),
    };
  });
  const movable = input.movable?.map((m) => {
    const owner: string = m.owner;
    if (!isOwner(owner)) refuse(`Accounts or securities of ${owner} (movable[].owner)`);
    return { ...without(m, ['owner', 'withholdingSwiss']), owner };
  });
  // Childcare split per child replaces the household's total.
  const household = input.household
    ? c.childcare
      ? without(input.household, ['childcare'])
      : input.household
    : undefined;
  return {
    taxYear: input.taxYear as AgTaxYear,
    commune: input.commune,
    civilStatus: input.civilStatus,
    people: input.people.map(person),
    ...(children ? { children } : {}),
    ...(input.childSupport ? { childSupport: input.childSupport } : {}),
    ...(input.ifdParentalScale !== undefined ? { ifdParentalScale: input.ifdParentalScale } : {}),
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

/**
 * What each kind of document gives: the documents every canton asks for (packages/rules-ch keys/),
 * the salary certificate, the attestations and the bank and wealth documents. The tax assessment
 * is Geneva's only for now.
 */
function documents(taxYear: number): DocumentRule[] {
  agParamsFor(taxYear);
  const fields: Partial<Record<DocumentKind, readonly string[]>> = {
    salary_certificate: SALARY_CERTIFICATE_FIELDS_2026,
    ...ATTESTATION_FIELDS_2026,
    ...DOCUMENT_FIELDS_WEALTH_2026,
  };
  return (Object.entries(fields) as [DocumentKind, readonly string[]][]).map(([kind, keys]) => ({
    kind,
    keys,
  }));
}

export const rules: CantonRules<AargauCantonal, AgTaxResult> = {
  canton: 'AG',
  taxYears: AG_TAX_YEARS,
  communes,
  computeReturn: (input) => computeReturn(aargauInput(input)),
  keys: (taxYear) => {
    agParamsFor(taxYear);
    return agKeys(taxYear);
  },
  documents,
  sourcesIndex: 'docs/sources/ag',
};
