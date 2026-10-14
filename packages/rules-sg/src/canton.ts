// St. Gallen behind the canton interface (packages/rules-ch, canton.ts; docs/design/cantons.md,
// section 2): the household input becomes St. Gallen's engine input, and computeReturn gives exactly
// what the engine gives (the cantonal, communal and church tax, and the federal tax the tax office
// derives from the same return, ./ifd.ts). The extension reads it through its canton registry. A
// fact that changes the tax and that St. Gallen's engine does not read is refused, never dropped
// (fail closed). Left aside because they change neither tax: the withholding tax credit shown next
// to the tax, and the facts only Geneva's rules use (a person's or a child's age band, Geneva's meal
// rule, the commune of work).
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
import { SgInputError } from './assess.js';
import { communesFor, slugOf, type Confession } from './communes.js';
import { computeReturn } from './compute.js';
import { sgKeys } from './keys.js';
import { SG_TAX_YEARS, sgParamsFor, type SgTaxYear } from './params.js';
import type { ChildStage, MovableOwner, PersonInput, SgEngineInput, SgTaxResult } from './types.js';

/** What only St. Gallen asks for. */
export interface StGallenCantonal {
  /**
   * For each child, in the order of `children`: whether it is not yet of school age or in school or
   * training (the child deduction, 23.1 or 23.2), whether it was under 18 on 31 December (the wealth
   * deduction, 36.3), and its education costs and state scholarships (23.3).
   */
  children?: readonly {
    stage?: ChildStage;
    minor?: boolean;
    educationCosts?: Amount;
    scholarships?: Amount;
  }[];
  /** Joint custody without child support: whether you mainly bear the children's upkeep. */
  mainUpkeep?: boolean;
  /** Opt-in church tax: each adult's church, and the church area where the commune's differ. */
  church?: { p1?: Confession; p2?: Confession; area?: string };
  /**
   * Childcare paid, by child, in the order of `children` (16.2: the limit is per child under 14,
   * StG Art. 45 Abs. 1 lit. h): replaces childcare given for the household as a whole.
   */
  childcare?: readonly (Amount | undefined)[];
}

function refuse(what: string): never {
  throw new SgInputError(
    `${what}: St. Gallen's engine does not read it, so the tax would be wrong.`,
  );
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

/** St. Gallen's engine input for a household; throws for what it cannot compute faithfully. */
export function stGallenInput(input: HouseholdInput<StGallenCantonal>): SgEngineInput {
  sgParamsFor(input.taxYear); // throws for a year without official values
  if (typeof input.commune !== 'string') {
    throw new SgInputError(
      `St. Gallen communes are given by their name (the documents carry no BFS number), not ${input.commune}.`,
    );
  }
  const c = input.cantonal ?? {};
  const count = input.children?.length ?? 0;
  if (c.children && c.children.length !== count) {
    throw new SgInputError('cantonal.children needs one entry per child, in order.');
  }
  if (c.childcare && c.childcare.length > count) {
    refuse('Childcare for a child not in children (cantonal.childcare)');
  }
  const children = input.children?.map((ch, i) => {
    const extra = c.children?.[i] ?? {};
    const care = c.childcare?.[i];
    return {
      ...without(ch, ['age', ...(c.childcare ? (['childcare'] as const) : [])]),
      ...extra,
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
    taxYear: input.taxYear as SgTaxYear,
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
 * St. Gallen's communes for a tax year, with their Gesamtsteuerfuss in hundredths of a percent of the
 * einfache Steuer (138 % -> 13800), cited; no BFS numbers (the official table carries none).
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

/**
 * What each kind of document gives: the documents every canton asks for (packages/rules-ch keys/),
 * the salary certificate, the attestations and the bank and wealth documents. The tax assessment
 * is Geneva's only for now.
 */
function documents(taxYear: number): DocumentRule[] {
  sgParamsFor(taxYear);
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

export const rules: CantonRules<StGallenCantonal, SgTaxResult> = {
  canton: 'SG',
  taxYears: SG_TAX_YEARS,
  communes,
  computeReturn: (input) => computeReturn(stGallenInput(input)),
  keys: (taxYear) => {
    sgParamsFor(taxYear);
    return sgKeys(taxYear);
  },
  documents,
  sourcesIndex: 'docs/sources/sg',
};
