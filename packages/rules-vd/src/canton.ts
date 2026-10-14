// Vaud behind the canton interface (packages/rules-ch, canton.ts; docs/design/cantons.md,
// section 2): the household input becomes Vaud's engine input, and computeReturn gives exactly what
// the engine gives (the cantonal and communal tax, and the federal tax on the guide's worksheet,
// ./ifd.ts). The extension reads it through its canton registry. A fact that changes the tax and
// that Vaud's engine does not read is refused, never dropped (fail closed); facts only Geneva's rules
// use (a person's age band, Geneva's meal rule, the commune of work, the withholding tax credit shown
// next to the tax) don't change Vaud's tax and are left aside.
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
import { VdInputError } from './assess.js';
import { communesFor, slugOf } from './communes.js';
import { computeReturn } from './compute.js';
import { vaudKeys } from './keys.js';
import { VD_TAX_YEARS, vdParamsFor, type VdTaxYear } from './params.js';
import type { ChildInput, MovableOwner, PersonInput, VdEngineInput, VdTaxResult } from './types.js';

/** What only Vaud asks for. */
export interface VaudCantonal extends Pick<
  VdEngineInput,
  'communePart' | 'ownHousehold' | 'mainUpkeep' | 'rent' | 'furnitureInsurance' | 'furnitureWithin'
> {
  /**
   * Childcare paid, by child, in the order of `children` (the limit is per child, code 670):
   * replaces childcare given for the household as a whole.
   */
  childcare?: readonly (Amount | undefined)[];
  /**
   * The interest on savings (code 480) as you gave it: savings and current accounts, bonds, cash
   * bonds, loans (vd-2025-guide p. 40). Replaces the household's savings interest read from the
   * accounts.
   */
  savingsInterest?: Amount;
}

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
  const c = input.cantonal ?? {};
  const care = c.childcare ?? [];
  if (care.length > (input.children?.length ?? 0)) {
    refuse('Childcare for a child not in children (cantonal.childcare)');
  }
  const children: ChildInput[] | undefined = input.children?.map((ch, i) => ({
    ...without(ch, ['age']),
    ...(care[i] ? { childcare: care[i] } : {}),
  }));
  // Childcare split per child replaces the household's total; savings interest given replaces the
  // accounts' own.
  let household = input.household;
  if (household && c.childcare) household = without(household, ['childcare']);
  if (c.savingsInterest) household = { ...household, savingsInterest: c.savingsInterest };
  const movable = input.movable?.map((m) => {
    const owner: string = m.owner;
    if (!isOwner(owner)) refuse(`Accounts or securities of ${owner} (movable[].owner)`);
    return { ...without(m, ['owner', 'withholdingSwiss']), owner };
  });
  return {
    taxYear: input.taxYear as VdTaxYear,
    commune: input.commune,
    civilStatus: input.civilStatus,
    people: input.people.map(person),
    ...(children ? { children } : {}),
    ...(input.childSupport ? { childSupport: input.childSupport } : {}),
    ...(input.ifdParentalScale !== undefined ? { ifdParentalScale: input.ifdParentalScale } : {}),
    ...(c.communePart !== undefined ? { communePart: c.communePart } : {}),
    ...(c.ownHousehold !== undefined ? { ownHousehold: c.ownHousehold } : {}),
    ...(c.mainUpkeep !== undefined ? { mainUpkeep: c.mainUpkeep } : {}),
    ...(c.rent !== undefined ? { rent: c.rent } : {}),
    ...(c.furnitureInsurance !== undefined ? { furnitureInsurance: c.furnitureInsurance } : {}),
    ...(c.furnitureWithin !== undefined ? { furnitureWithin: c.furnitureWithin } : {}),
    ...(household ? { household } : {}),
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

/**
 * What each kind of document gives: the documents every canton asks for (packages/rules-ch keys/),
 * the salary certificate, the attestations and the bank and wealth documents. The tax assessment
 * is Geneva's only for now.
 */
function documents(taxYear: number): DocumentRule[] {
  vdParamsFor(taxYear);
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

export const rules: CantonRules<VaudCantonal, VdTaxResult> = {
  canton: 'VD',
  taxYears: VD_TAX_YEARS,
  communes,
  computeReturn: (input) => computeReturn(vaudInput(input)),
  keys: (taxYear) => {
    vdParamsFor(taxYear);
    return vaudKeys(taxYear);
  },
  documents,
  sourcesIndex: 'docs/sources/vd',
};
