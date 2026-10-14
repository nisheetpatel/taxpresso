// Basel-Landschaft behind the canton interface (packages/rules-ch, canton.ts; docs/design/cantons.md,
// section 2): the household input becomes Basel-Landschaft's engine input, and computeReturn gives
// exactly what the engine gives (the state, communal and church tax, and the federal tax of the
// return's Bundessteuer column, ./ifd.ts). The extension reads it through its canton registry. A
// fact that changes the tax and that Basel-Landschaft's engine does not read is refused, never
// dropped (fail closed). The insurance premiums, the premium subsidy and the savings interest count
// for the federal tax only (the canton deducts its maximum whatever was paid, Steuerbuch 29 Nr. 15).
// Left aside because they change neither tax: the withholding tax credit shown next to the tax, and
// the facts only Geneva's rules use (a person's or a child's age band, Geneva's meal rule, the
// commune of work).
import type { DocumentKind } from '@taxpresso/ledger';
import {
  ATTESTATION_FIELDS_2026,
  DOCUMENT_FIELDS_WEALTH_2026,
  SALARY_CERTIFICATE_FIELDS_2026,
  type Amount,
  type CantonRules,
  type Commune,
  type DocumentRule,
  type EnginePerson,
  type HouseholdInput,
  type PersonInput as HouseholdPerson,
} from '@taxpresso/rules-ch';
import { BlInputError } from './assess.js';
import { communesFor, slugOf } from './communes.js';
import { computeReturn } from './compute.js';
import { blKeys } from './keys.js';
import { BL_TAX_YEARS, blParamsFor, type BlTaxYear } from './params.js';
import type {
  BlEngineInput,
  BlTaxResult,
  ChildInput,
  Confession,
  MovableOwner,
  PensionKind,
  PersonInput,
} from './types.js';

/** What only Basel-Landschaft asks for. */
export interface BaselLandCantonal {
  /** For 2026, each pensioner's kind of first pillar pension: AHV (old age, 770) or IV (771). */
  pensionKind?: Partial<Record<EnginePerson, PensionKind>>;
  /**
   * For each child, in the order of `children`: whether its own taxable income is above the
   * tax-free limit (no child reduction then, StG § 34 Abs. 4).
   */
  childrenOwnIncome?: readonly boolean[];
  /** Joint custody without child support: whether you mainly bear the children's upkeep. */
  mainUpkeep?: boolean;
  /** Opt-in church tax: each adult's church. */
  church?: { p1?: Confession; p2?: Confession };
  /**
   * Childcare paid, by child, in the order of `children` (the limit is per child, StG § 29 Abs. 1
   * lit. c): replaces childcare given for the household as a whole.
   */
  childcare?: readonly (Amount | undefined)[];
}

function refuse(what: string): never {
  throw new BlInputError(
    `${what}: Basel-Landschaft's engine does not read it, so the tax would be wrong.`,
  );
}

/** The object without the given keys. */
function without<T extends object, K extends keyof T>(o: T, keys: readonly K[]): Omit<T, K> {
  const drop = new Set<PropertyKey>(keys);
  return Object.fromEntries(Object.entries(o).filter(([k]) => !drop.has(k))) as Omit<T, K>;
}

function person(p: HouseholdPerson, c: BaselLandCantonal): PersonInput {
  const rest = without(p, ['employments', 'age', 'mealsIccAllowed']);
  const pensionKind = c.pensionKind?.[p.id];
  return {
    ...rest,
    ...(p.employments
      ? { employments: p.employments.map((e) => without(e, ['workCommune'])) }
      : {}),
    ...(pensionKind ? { pensionKind } : {}),
  };
}

const isOwner = (o: string): o is MovableOwner =>
  o === 'p1' || o === 'p2' || o === 'household' || /^child\d+$/.test(o);

/** Basel-Landschaft's engine input for a household; throws for what it cannot compute faithfully. */
export function baselLandInput(input: HouseholdInput<BaselLandCantonal>): BlEngineInput {
  blParamsFor(input.taxYear); // throws for a year without official values
  if (typeof input.commune !== 'string') {
    throw new BlInputError(
      `Basel-Landschaft communes are given by their name (the documents carry no BFS number), not ${input.commune}.`,
    );
  }
  const c = input.cantonal ?? {};
  const count = input.children?.length ?? 0;
  if (c.childrenOwnIncome && c.childrenOwnIncome.length !== count) {
    throw new BlInputError('cantonal.childrenOwnIncome needs one answer per child, in order.');
  }
  if (c.childcare && c.childcare.length > count) {
    refuse('Childcare for a child not in children (cantonal.childcare)');
  }
  const children: ChildInput[] | undefined = input.children?.map((ch, i) => {
    const ownIncome = c.childrenOwnIncome?.[i];
    const care = c.childcare?.[i];
    return {
      ...without(ch, ['age']),
      ...(ownIncome !== undefined ? { ownIncome } : {}),
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
    taxYear: input.taxYear as BlTaxYear,
    commune: input.commune,
    civilStatus: input.civilStatus,
    people: input.people.map((p) => person(p, c)),
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
 * Basel-Landschaft's communes for a tax year, with their Steuerfuss on income and wealth in
 * hundredths of a percent of the state tax (58.5 % -> 5850), cited; no BFS numbers (the official
 * table carries none).
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
  blParamsFor(taxYear);
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

export const rules: CantonRules<BaselLandCantonal, BlTaxResult> = {
  canton: 'BL',
  taxYears: BL_TAX_YEARS,
  communes,
  computeReturn: (input) => computeReturn(baselLandInput(input)),
  keys: (taxYear) => {
    blParamsFor(taxYear);
    return blKeys(taxYear);
  },
  documents,
  sourcesIndex: 'docs/sources/bl',
};
