// Fribourg behind the canton interface (packages/rules-ch, canton.ts; docs/design/cantons.md,
// section 2): the household input becomes Fribourg's engine input, and computeReturn gives exactly
// what the engine gives (the cantonal, communal and church tax, and the federal tax the tax office
// derives from the return, ./ifd.ts). The extension reads it through its canton registry. A fact
// that changes the tax and that Fribourg's engine does not read is refused, never dropped (fail
// closed). Left aside because they change neither tax: the health premiums paid (Fribourg deducts a
// flat amount per insured person, less subsidies, and the federal tax takes that flat amount, guide
// p. 48), Geneva's age bands (Fribourg's own come under `cantonal`), Geneva's meal rule, the commune
// of work, the withholding tax credit shown next to the tax.
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
import { FrInputError } from './assess.js';
import { communesFor, slugOf } from './communes.js';
import { computeReturn } from './compute.js';
import { frKeys } from './keys.js';
import { FR_TAX_YEARS, frParamsFor, type FrTaxYear } from './params.js';
import type { ChildInput, FrEngineInput, FrTaxResult, MovableOwner, PersonInput } from './types.js';

/** What only Fribourg asks for. */
export interface FribourgCantonal extends Pick<FrEngineInput, 'church'> {
  /**
   * For each child, in the order of `children`: their age band at the end of the year (the health
   * insurance flat amount, code 4.110: 'child' under 18, 'young' from 18 to 25 in training, 'adult'
   * over 25, not supported) and whether under 14 (childcare, code 4.380), when answered.
   */
  children?: readonly { age?: ChildInput['age']; under14?: boolean }[];
  /**
   * Childcare paid, by child, in the order of `children` (4.380: the limit is per child): replaces
   * childcare given for the household as a whole.
   */
  childcare?: readonly (Amount | undefined)[];
  /** The health premium subsidy as you gave it (4.110): replaces the one read from documents. */
  healthSubsidy?: Amount;
  /** Life, pure-risk and daily-allowance insurance premiums as you gave them (4.120). */
  lifeInsurancePremiums?: Amount;
  /** The interest on savings as you gave it (4.150): replaces the accounts' own. */
  savingsInterest?: Amount;
}

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
  if (input.household?.accidentPremiums) {
    refuse(
      'Private accident and loss-of-earnings premiums (household.accidentPremiums; Fribourg deducts basic health and accident insurance as a flat amount, code 4.110, and life, pure-risk and daily-allowance premiums as lifeInsurancePremiums, code 4.120)',
    );
  }
  const c = input.cantonal ?? {};
  const count = input.children?.length ?? 0;
  if (c.children && c.children.length !== count) {
    throw new FrInputError('cantonal.children needs one answer per child, in order.');
  }
  if (c.childcare && c.childcare.length > count) {
    refuse('Childcare for a child not in children (cantonal.childcare)');
  }
  // Geneva's age band (household input) is not Fribourg's: the canton part gives Fribourg's.
  const children: ChildInput[] | undefined = input.children?.map((ch, i) => {
    const own = c.children?.[i] ?? {};
    const care = c.childcare?.[i];
    return {
      ...without(ch, ['age']),
      ...(own.age !== undefined ? { age: own.age } : {}),
      ...(own.under14 !== undefined ? { under14: own.under14 } : {}),
      ...(care ? { childcare: care } : {}),
    };
  });
  const movable = input.movable?.map((m) => {
    const owner: string = m.owner;
    if (!isOwner(owner)) refuse(`Accounts or securities of ${owner} (movable[].owner)`);
    return { ...without(m, ['owner', 'withholdingSwiss']), owner };
  });
  // Childcare split per child replaces the household's total; the answers replace what documents
  // gave. The health premiums paid are left aside (the flat amount is deducted).
  let household = input.household
    ? without(input.household, ['accidentPremiums', 'healthPremiums'])
    : undefined;
  if (household && c.childcare) household = without(household, ['childcare']);
  if (c.healthSubsidy) household = { ...household, healthSubsidy: c.healthSubsidy };
  if (c.lifeInsurancePremiums) {
    household = { ...household, lifeInsurancePremiums: c.lifeInsurancePremiums };
  }
  if (c.savingsInterest) household = { ...household, savingsInterest: c.savingsInterest };
  return {
    taxYear: input.taxYear as FrTaxYear,
    commune: input.commune,
    civilStatus: input.civilStatus,
    people: input.people.map(person),
    ...(children ? { children } : {}),
    ...(input.childSupport ? { childSupport: input.childSupport } : {}),
    ...(input.ifdParentalScale !== undefined ? { ifdParentalScale: input.ifdParentalScale } : {}),
    ...(c.church ? { church: c.church } : {}),
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

/**
 * What each kind of document gives: the documents every canton asks for (packages/rules-ch keys/),
 * the salary certificate, the attestations and the bank and wealth documents. The tax assessment
 * is Geneva's only for now.
 */
function documents(taxYear: number): DocumentRule[] {
  frParamsFor(taxYear);
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

export const rules: CantonRules<FribourgCantonal, FrTaxResult> = {
  canton: 'FR',
  taxYears: FR_TAX_YEARS,
  communes,
  computeReturn: (input) => computeReturn(fribourgInput(input)),
  keys: (taxYear) => {
    frParamsFor(taxYear);
    return frKeys(taxYear);
  },
  documents,
  sourcesIndex: 'docs/sources/fr',
};
