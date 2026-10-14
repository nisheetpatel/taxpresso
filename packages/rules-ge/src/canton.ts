// Geneva behind the canton interface (packages/rules-ch, canton.ts; docs/design/cantons.md,
// section 2): the household input becomes Geneva's engine input, and computeReturn gives exactly
// what the engine gives. A fact Geneva's engine does not read is refused, never dropped: the tax
// would be wrong without it (fail closed).
import type { DocumentKind } from '@taxpresso/ledger';
import type {
  CantonRules,
  ChildInput as HouseholdChild,
  Commune,
  DocumentRule,
  EmploymentInput as HouseholdEmployment,
  HouseholdInput,
  PersonInput as HouseholdPerson,
} from '@taxpresso/rules-ch';
import type { IccSplitting } from './2025/icc.js';
import { COMMUNES_2026, type CommuneSlug } from './2026/communes.js';
import { DOCUMENT_FIELDS_2026 } from './2026/document-keys.js';
import { KEYS_2026 } from './2026/keys.js';
import { computeReturn, EngineInputError } from './engine/compute.js';
import { paramsFor, TAX_YEARS } from './engine/params.js';
import type {
  ChildInput,
  EmploymentInput,
  EngineInput,
  GenevaHousehold,
  PersonInput,
  TaxResult,
  WealthItemInput,
} from './engine/types.js';

/** What only Geneva asks for. */
export interface GenevaCantonal {
  /** Override the ICC splitting derived from the household (LIPP art. 41). */
  splitting?: IccSplitting;
  /** The état des titres and other movable wealth by rubric (./2026/etat-des-titres.ts). */
  wealthItems?: readonly WealthItemInput[];
}

/** The household's amounts only Zurich reads: Geneva would leave them out of its tax. */
const NOT_READ_HOUSEHOLD = [
  'childSupportPaid',
  'childSupportReceived',
  'otherIncome',
  'cash',
  'lifeInsuranceValue',
  'vehicles',
] as const;

const isCommune = (c: unknown): c is CommuneSlug =>
  typeof c === 'string' && COMMUNES_2026.some((x) => x.slug === c);

function refuse(what: string): never {
  throw new EngineInputError(
    `${what}: Geneva's engine does not read it, so the tax would be wrong.`,
  );
}

function employment(e: HouseholdEmployment): EmploymentInput {
  const { workCommune, side, ...rest } = e;
  if (side) refuse('A side job (employments[].side)');
  if (workCommune === undefined) return rest;
  if (workCommune !== 'outside' && !isCommune(workCommune)) {
    throw new EngineInputError(`Unknown work commune ${workCommune}`);
  }
  return { ...rest, workCommune };
}

function person(p: HouseholdPerson): PersonInput {
  const { employments, unemploymentBenefits, ...rest } = p;
  if (unemploymentBenefits)
    refuse('unemploymentBenefits (Geneva counts them in replacementIncome)');
  return employments ? { ...rest, employments: employments.map(employment) } : rest;
}

function child(c: HouseholdChild): ChildInput {
  const { livesWithYou, ...rest } = c;
  if (livesWithYou === false)
    refuse('A child who does not live with you (children[].livesWithYou)');
  return rest;
}

/** Geneva's engine input for a household; throws for what Geneva cannot compute faithfully. */
export function genevaInput(input: HouseholdInput<GenevaCantonal>): EngineInput {
  paramsFor(input.taxYear); // throws for a year without official values
  if (!isCommune(input.commune)) throw new EngineInputError(`Unknown commune ${input.commune}`);
  let household: GenevaHousehold | undefined;
  if (input.household) {
    const given = NOT_READ_HOUSEHOLD.filter((k) => input.household?.[k] !== undefined);
    if (given.length) refuse(`household.${given.join(', household.')}`);
    household = input.household;
  }
  const { splitting, wealthItems } = input.cantonal ?? {};
  return {
    taxYear: input.taxYear as EngineInput['taxYear'],
    commune: input.commune,
    civilStatus: input.civilStatus,
    people: input.people.map(person),
    ...(input.children ? { children: input.children.map(child) } : {}),
    ...(splitting ? { splitting } : {}),
    ...(input.childSupport ? { childSupport: input.childSupport } : {}),
    ...(input.ifdParentalScale !== undefined ? { ifdParentalScale: input.ifdParentalScale } : {}),
    ...(household ? { household } : {}),
    ...(input.movable ? { movable: input.movable } : {}),
    ...(wealthItems ? { wealthItems } : {}),
  };
}

/** Geneva's communes for a tax year, with their centimes additionnels, cited. */
function communes(taxYear: number): Commune[] {
  const { centimes } = paramsFor(taxYear).communes;
  return COMMUNES_2026.map((c) => ({
    bfs: null,
    slug: c.slug,
    name: c.name,
    rates: { value: [centimes.value[c.slug]], source: centimes.source },
  }));
}

/** What each kind of document gives (the 2026 keys serve every supported year). */
function documents(taxYear: number): DocumentRule[] {
  paramsFor(taxYear);
  return (Object.entries(DOCUMENT_FIELDS_2026) as [DocumentKind, readonly string[]][]).map(
    ([kind, keys]) => ({ kind, keys }),
  );
}

export const rules: CantonRules<GenevaCantonal, TaxResult> = {
  canton: 'GE',
  taxYears: TAX_YEARS,
  communes,
  computeReturn: (input) => computeReturn(genevaInput(input)),
  keys: (taxYear) => {
    paramsFor(taxYear);
    return KEYS_2026;
  },
  documents,
  sourcesIndex: 'docs/sources/ge',
};
