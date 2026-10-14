// Lucerne behind the canton interface (packages/rules-ch, canton.ts; docs/design/cantons.md,
// section 2): the household input becomes Lucerne's engine input, and computeReturn gives exactly
// what the engine gives (the state, communal, church and personal tax, and the federal tax as the
// canton's Ergänzungsblatt derives it from the return, ./ifd.ts). The extension reads it through its
// canton registry. A fact that changes the tax and that Lucerne's engine does not read is refused,
// never dropped (fail closed). Left aside because they change neither tax: the withholding tax
// credit shown next to the tax, and the facts only Geneva's rules use (a person's or a child's age
// band, Geneva's meal rule, the commune of work).
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
import { LuInputError } from './assess.js';
import { communesFor, slugOf } from './communes.js';
import { computeReturn } from './compute.js';
import { luKeys } from './keys.js';
import { LU_TAX_YEARS, luParamsFor, type LuTaxYear } from './params.js';
import type { ChildInput, LuEngineInput, LuTaxResult, MovableOwner, PersonInput } from './types.js';

/** What only Lucerne asks for. */
export interface LucerneCantonal extends Pick<LuEngineInput, 'familyTariff' | 'church'> {
  /**
   * For each child, in the order of `children`: in your household (the family tariff, own care,
   * childcare) and under 14 at the end of the year (own care, 353, and childcare, 360), when
   * answered.
   */
  children?: readonly { livesWithYou?: boolean; under14?: boolean }[];
  /**
   * For each child, in the order of `children`: in education and staying away from home for it all
   * the time (Ziffer 352).
   */
  childrenAway?: readonly boolean[];
  /**
   * Childcare paid, by child, in the order of `children` (360: the limit is per child): replaces
   * childcare given for the household as a whole.
   */
  childcare?: readonly (Amount | undefined)[];
}

function refuse(what: string): never {
  throw new LuInputError(`${what}: Lucerne's engine does not read it, so the tax would be wrong.`);
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

/** Lucerne's engine input for a household; throws for what it cannot compute faithfully. */
export function lucerneInput(input: HouseholdInput<LucerneCantonal>): LuEngineInput {
  luParamsFor(input.taxYear); // throws for a year without official values
  if (typeof input.commune !== 'string') {
    throw new LuInputError(
      `Lucerne communes are given by their name (the official table carries no BFS number), not ${input.commune}.`,
    );
  }
  const c = input.cantonal ?? {};
  const count = input.children?.length ?? 0;
  if (c.childrenAway && c.childrenAway.length !== count) {
    throw new LuInputError('cantonal.childrenAway needs one answer per child, in order.');
  }
  if (c.children && c.children.length !== count) {
    throw new LuInputError('cantonal.children needs one answer per child, in order.');
  }
  if (c.childcare && c.childcare.length > count) {
    refuse('Childcare for a child not in children (cantonal.childcare)');
  }
  if (c.church?.children && c.church.children.length > count) {
    throw new LuInputError('cantonal.church.children has more entries than children.');
  }
  const children: ChildInput[] | undefined = input.children?.map((ch, i) => {
    const own = c.children?.[i] ?? {};
    const care = c.childcare?.[i];
    return {
      ...without(ch, ['age']),
      ...(own.livesWithYou !== undefined ? { livesWithYou: own.livesWithYou } : {}),
      ...(own.under14 !== undefined ? { under14: own.under14 } : {}),
      ...(care ? { childcare: care } : {}),
      ...(c.childrenAway?.[i] ? { away: true } : {}),
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
    taxYear: input.taxYear as LuTaxYear,
    commune: input.commune,
    civilStatus: input.civilStatus,
    people: input.people.map(person),
    ...(children ? { children } : {}),
    ...(input.childSupport ? { childSupport: input.childSupport } : {}),
    ...(input.ifdParentalScale !== undefined ? { ifdParentalScale: input.ifdParentalScale } : {}),
    ...(c.familyTariff !== undefined ? { familyTariff: c.familyTariff } : {}),
    ...(c.church ? { church: c.church } : {}),
    ...(household ? { household } : {}),
    ...(movable ? { movable } : {}),
  };
}

/**
 * Lucerne's communes for a tax year, by their name in the official table, with the units of the
 * Einwohnergemeinde in ten-thousandths (Luzern 2025: 1.55 -> 15500), cited.
 */
function communes(taxYear: number): Commune[] {
  const table = communesFor(taxYear);
  return table.value.map((c) => ({
    bfs: null,
    slug: slugOf(c.name),
    name: c.name,
    rates: { value: [c.units], source: table.source },
  }));
}

/**
 * What each kind of document gives: the documents every canton asks for (packages/rules-ch keys/),
 * the salary certificate, the attestations and the bank and wealth documents. The tax assessment
 * is Geneva's only for now.
 */
function documents(taxYear: number): DocumentRule[] {
  luParamsFor(taxYear);
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

export const rules: CantonRules<LucerneCantonal, LuTaxResult> = {
  canton: 'LU',
  taxYears: LU_TAX_YEARS,
  communes,
  computeReturn: (input) => computeReturn(lucerneInput(input)),
  keys: (taxYear) => {
    luParamsFor(taxYear);
    return luKeys(taxYear);
  },
  documents,
  sourcesIndex: 'docs/sources/lu',
};
