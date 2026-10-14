// Basel-Stadt behind the canton interface (packages/rules-ch, canton.ts; docs/design/cantons.md,
// section 2): the household input becomes Basel-Stadt's engine input, and computeReturn gives
// exactly what the engine gives (the cantonal and communal tax, and the federal tax of the Bund
// column, ./ifd.ts). The extension reads it through its canton registry. A fact that changes the tax
// and that Basel-Stadt's engine does not read is refused, never dropped (fail closed). Left aside
// because they don't change Basel-Stadt's tax: the facts only Geneva's rules use (a person's or a
// child's age band, Geneva's meal rule, the commune of work) and the withholding tax credit shown
// next to the tax. The insurance premiums, the subsidy and the savings interest count for the
// federal tax only (the cantonal deduction is a flat amount whatever was paid, StG § 32 al. 1 lit.
// g).
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
import { BsInputError } from './assess.js';
import { communesFor, slugOf } from './communes.js';
import { computeReturn } from './compute.js';
import { bsKeys } from './keys.js';
import { BS_TAX_YEARS, bsParamsFor, type BsTaxYear } from './params.js';
import type { BsEngineInput, BsTaxResult, ChildInput, MovableOwner, PersonInput } from './types.js';

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
  /**
   * Childcare paid, by child, in the order of `children` (form F asks it per child, the limit is
   * per child): replaces childcare given for the household as a whole.
   */
  childcare?: readonly (Amount | undefined)[];
  /** Payments to political parties (680, form Z), apart from donations. */
  politicalParty?: Amount;
}

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
  const count = input.children?.length ?? 0;
  if (c.childrenMinor && c.childrenMinor.length !== count) {
    throw new BsInputError('cantonal.childrenMinor needs one answer per child, in order.');
  }
  const care = c.childcare ?? [];
  if (care.length > count) refuse('Childcare for a child not in children (cantonal.childcare)');
  const children = input.children?.map((ch, i): ChildInput => {
    const minor = c.childrenMinor?.[i];
    return {
      ...without(ch, ['age']),
      ...(care[i] ? { childcare: care[i] } : {}),
      ...(minor !== undefined ? { minor } : {}),
    };
  });
  // In the shared household input an account or security without its income has none (its
  // income is absent, not unknown: a value whose income is not known comes incomplete, so the
  // taxes are floors). Basel-Stadt's engine takes the income of each one, zero included: the
  // value's status stays on the value (its line 800), not on the income.
  const movable = input.movable?.map((m) => {
    const owner: string = m.owner;
    if (!isOwner(owner)) refuse(`Accounts or securities of ${owner} (movable[].owner)`);
    const value = m.value;
    const income: Amount | undefined =
      m.income ??
      (value && value.value > 0
        ? { value: 0, ...(value.complete === false ? { complete: false } : {}) }
        : undefined);
    return {
      ...without(m, ['owner', 'withholdingSwiss', 'income']),
      owner,
      ...(income ? { income } : {}),
    };
  });
  // Childcare split per child replaces the household's total; party payments asked apart.
  const shared = input.household
    ? c.childcare
      ? without(input.household, ['childcare'])
      : input.household
    : undefined;
  const household =
    shared || c.politicalParty
      ? {
          ...shared,
          ...(c.politicalParty && !shared?.politicalParty
            ? { politicalParty: c.politicalParty }
            : {}),
        }
      : undefined;
  return {
    taxYear: input.taxYear as BsTaxYear,
    commune: input.commune,
    civilStatus: input.civilStatus,
    people: input.people.map((p) => person(p, c)),
    ...(children ? { children } : {}),
    ...(input.childSupport ? { childSupport: input.childSupport } : {}),
    ...(input.ifdParentalScale !== undefined ? { ifdParentalScale: input.ifdParentalScale } : {}),
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

/**
 * What each kind of document gives: the documents every canton asks for (packages/rules-ch keys/),
 * the salary certificate, the attestations and the bank and wealth documents. The tax assessment
 * is Geneva's only for now.
 */
function documents(taxYear: number): DocumentRule[] {
  bsParamsFor(taxYear);
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

export const rules: CantonRules<BaselCantonal, BsTaxResult> = {
  canton: 'BS',
  taxYears: BS_TAX_YEARS,
  communes,
  computeReturn: (input) => computeReturn(baselInput(input)),
  keys: (taxYear) => {
    bsParamsFor(taxYear);
    return bsKeys(taxYear);
  },
  documents,
  sourcesIndex: 'docs/sources/bs',
};
