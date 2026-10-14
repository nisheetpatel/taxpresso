// From the ledger to Zurich's household input. The part every canton shares is packages/rules-ch's
// (core/from-ledger.ts); Zurich gives it its commune (by BFS number, the part of the commune where
// the official table gives two multipliers), its form's lines, unemployment benefits on their own
// line (140/141), and adds what only Zurich asks: the church of each person (opt-in church tax),
// the parish, and who has the married tariff in shared custody without child support. Accounts,
// securities and the other movable wealth come from the caller (`wealth`), already read.
import type { Fact, VaultDocument } from '@taxpresso/ledger';
import {
  householdFromFacts,
  type HouseholdAmounts,
  type HouseholdInput,
  type MovableAsset,
  type Text,
} from '@taxpresso/rules-ch';
import type { ZurichCantonal } from './canton.js';
import { communeOfAnswer } from './keys.js';
import { isZhTaxYear } from './params.js';
import type { Confession } from './types.js';

const NB = ' ';
const t = (en: string, fr: string): Text => ({ en, fr });

/** Accounts, securities and the other movable wealth, read for the Zurich lines. */
export interface ZurichWealth {
  /** 400 value on 31 December and 150 income, per owner. */
  movable?: readonly MovableAsset[];
  /** 283 costs, 270 savings interest and life insurance premiums, 250 and 470 debts, 406, 416. */
  household?: Pick<
    HouseholdAmounts,
    | 'bankFees'
    | 'savingsInterest'
    | 'lifeInsurancePremiums'
    | 'debtInterest'
    | 'debts'
    | 'lifeInsuranceValue'
    | 'otherAssets'
  >;
  /** How they were read: what was assumed. */
  notes?: readonly Text[];
}

export interface ZurichLedgerInput {
  input: HouseholdInput<ZurichCantonal> | null;
  missing: Text[];
  notes: Text[];
}

const CHURCHES = new Set<Confession>(['reformed', 'catholic', 'christ_catholic', 'none']);

export const NOTE_CHURCH = t(
  'Church tax (Kirchensteuer): not counted for anyone who hasn’t said whether they are a member of a church that levies it.',
  `Impôt ecclésiastique (Kirchensteuer)${NB}: pas compté pour qui n’a pas dit s’il est membre d’une Église qui le perçoit.`,
);
export const NOTE_MARRIED_TARIFF = t(
  'Shared custody without child support: the married tariff (Verheiratetentarif) is taken to go to the parent who earns more, as a rule the one who mainly supports the children (zh-2026-tariff-weisung-sozialabzuege p. 7 and 8).',
  `Garde partagée sans contribution d’entretien${NB}: le barème des personnes mariées (Verheiratetentarif) est attribué au parent qui gagne le plus, en règle générale celui qui assume l’essentiel de l’entretien (zh-2026-tariff-weisung-sozialabzuege p. 7 et 8).`,
);

export function zurichInputFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
  wealth: ZurichWealth = {},
): ZurichLedgerInput {
  const { input, missing, notes } = householdFromFacts(taxYear, facts, documents, {
    isTaxYear: isZhTaxYear,
    commune: (answer, year) => communeOfAnswer(year, answer)?.bfs,
    alimonyLines: {
      received: t('160 and 161', '160 et 161'),
      paid: t('254 and 255', '254 et 255'),
    },
    unemploymentApart: true,
  });
  if (!input) return { input: null, missing, notes };
  const note = (x: Text) => notes.some((n) => n.en === x.en) || notes.push(x);
  const answer = (key: string, person = 'household') =>
    facts.find((f) => f.key === key && f.person === person && f.status !== 'extracted')?.value;

  // The commune's part, where the official table gives the parts different multipliers.
  const where = communeOfAnswer(taxYear, answer('profile.commune'));
  // The church of each person: church tax only for a member (opt-in).
  const church: { p1?: Confession; p2?: Confession; parish?: number } = {};
  for (const p of input.people) {
    const c = answer('zh.church', p.id);
    if (typeof c === 'string' && CHURCHES.has(c as Confession)) church[p.id] = c as Confession;
    else note(NOTE_CHURCH);
  }
  const parish = answer('zh.parish');
  if (parish === '1' || parish === '2') church.parish = Number(parish);
  // Shared custody without child support: who has the married tariff (StG § 35 Abs. 2bis).
  const support = input.childSupport === 'none' ? answer('profile.child_support') : undefined;
  const marriedTariff =
    support === 'none_i_earn_more' ? true : support === 'none_other_earns_more' ? false : undefined;
  if (marriedTariff !== undefined) note(NOTE_MARRIED_TARIFF);
  for (const n of wealth.notes ?? []) note(n);

  const members = Object.values(church).filter((c) => typeof c === 'string' && c !== 'none');
  const cantonal: ZurichCantonal = {
    ...(where?.variant !== undefined ? { communeVariant: where.variant } : {}),
    ...(marriedTariff !== undefined ? { marriedTariff } : {}),
    ...(members.length ? { church } : {}),
  };
  const household = { ...input.household, ...wealth.household };
  return {
    input: {
      ...input,
      household,
      ...(wealth.movable?.length ? { movable: wealth.movable } : {}),
      ...(Object.keys(cantonal).length ? { cantonal } : {}),
    },
    missing,
    notes,
  };
}
