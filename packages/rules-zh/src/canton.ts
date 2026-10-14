// Zurich behind the canton interface (packages/rules-ch, canton.ts; docs/design/cantons.md,
// section 2): the household input becomes Zurich's engine input, and computeReturn gives exactly
// what the engine gives (the cantonal and communal tax, and the federal tax of the Bundessteuer
// column, ./ifd.ts). The extension reads it through its canton registry. A fact that changes the
// tax and that Zurich's engine does not read is refused, never dropped (fail closed); facts only
// Geneva's rules use (a person's age band, Geneva's meal rule, the commune of work, the withholding
// tax credit shown next to the tax) don't change Zurich's tax and are left aside.
import type { DocumentKind } from '@taxpresso/ledger';
import {
  ATTESTATION_FIELDS_2026,
  DOCUMENT_FIELDS_WEALTH_2026,
  SALARY_CERTIFICATE_FIELDS_2026,
  type CantonRules,
  type Commune,
  type DocumentRule,
  type HouseholdInput,
  type PersonInput as HouseholdPerson,
} from '@taxpresso/rules-ch';
import { ZhInputError } from './assess.js';
import { communesFor, foldName } from './communes.js';
import { computeReturn } from './compute.js';
import { zurichKeys } from './keys.js';
import { ZH_TAX_YEARS, zhParamsFor, type ZhTaxYear } from './params.js';
import type { ItemPerson, PersonInput, ZhEngineInput, ZhTaxResult } from './types.js';

/** What only Zurich asks for. */
export type ZurichCantonal = Pick<ZhEngineInput, 'communeVariant' | 'marriedTariff' | 'church'>;

function refuse(what: string): never {
  throw new ZhInputError(`${what}: Zurich's engine does not read it, so the tax would be wrong.`);
}

/** The object without the given keys. */
function without<T extends object, K extends keyof T>(o: T, keys: readonly K[]): Omit<T, K> {
  const drop = new Set<PropertyKey>(keys);
  return Object.fromEntries(Object.entries(o).filter(([k]) => !drop.has(k))) as Omit<T, K>;
}

function person(p: HouseholdPerson): PersonInput {
  if (p.pillar3aCatchUp) refuse('A pillar 3a catch-up payment (pillar3aCatchUp)');
  const rest = without(p, ['employments', 'pillar3aCatchUp', 'age', 'mealsIccAllowed']);
  return p.employments
    ? { ...rest, employments: p.employments.map((e) => without(e, ['workCommune'])) }
    : rest;
}

const isZurichOwner = (o: string): o is ItemPerson => o === 'p1' || o === 'p2' || o === 'household';

/** Zurich's engine input for a household; throws for what Zurich cannot compute faithfully. */
export function zurichInput(input: HouseholdInput<ZurichCantonal>): ZhEngineInput {
  zhParamsFor(input.taxYear); // throws for a year without official values
  if (typeof input.commune !== 'number') {
    throw new ZhInputError(`Zurich communes are given by their BFS number, not ${input.commune}.`);
  }
  const movable = input.movable?.map((m) => {
    if (!isZurichOwner(m.owner)) refuse(`Accounts or securities of ${m.owner} (movable[].owner)`);
    return { ...without(m, ['owner', 'withholdingSwiss']), owner: m.owner };
  });
  const { communeVariant, marriedTariff, church } = input.cantonal ?? {};
  return {
    taxYear: input.taxYear as ZhTaxYear,
    commune: input.commune,
    ...(communeVariant !== undefined ? { communeVariant } : {}),
    civilStatus: input.civilStatus,
    people: input.people.map(person),
    ...(input.children ? { children: input.children.map((c) => without(c, ['age'])) } : {}),
    ...(input.childSupport ? { childSupport: input.childSupport } : {}),
    ...(marriedTariff !== undefined ? { marriedTariff } : {}),
    ...(input.ifdParentalScale !== undefined ? { ifdParentalScale: input.ifdParentalScale } : {}),
    ...(church ? { church } : {}),
    ...(input.household ? { household: input.household } : {}),
    ...(movable ? { movable } : {}),
  };
}

/** A commune's slug, for display: its name folded ("Wädenswil" -> "wadenswil"). */
const slugOf = (name: string) => foldName(name).replace(/ /g, '-');

/** Zurich's communes for a tax year, with their multipliers without church tax, cited. */
function communes(taxYear: number): Commune[] {
  const table = communesFor(taxYear);
  return table.value.map((c) => ({
    bfs: c.bfs,
    slug: slugOf(c.name),
    name: c.name,
    rates: { value: c.rates, source: table.source },
  }));
}

/**
 * What each kind of document gives: the documents every canton asks for (packages/rules-ch keys/),
 * the salary certificate, the attestations and the bank and wealth documents. The tax assessment
 * is Geneva's only for now.
 */
function documents(taxYear: number): DocumentRule[] {
  zhParamsFor(taxYear);
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

export const rules: CantonRules<ZurichCantonal, ZhTaxResult> = {
  canton: 'ZH',
  taxYears: ZH_TAX_YEARS,
  communes,
  computeReturn: (input) => computeReturn(zurichInput(input)),
  keys: (taxYear) => {
    zhParamsFor(taxYear);
    return zurichKeys(taxYear);
  },
  documents,
  sourcesIndex: 'docs/sources/zh',
};
