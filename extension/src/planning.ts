// "Before 31 December" beyond the 3a room (pension fund buy-in, 3a catch-up) and the TOU card
// (SPEC.md section 8, groups B and C), read from the answers, the planning inputs and this year's
// documents, the same for the MCP tools and the dashboard. Also the user's decisions
// (decisions.json, SPEC.md sections 3 and 4): append-only, the latest per optimization counts.
// A decision only records what the user chose: Taxpresso never sends a request to the AFC.
import type { Decision } from '@taxpresso/ledger';
import {
  type CatchUpResult,
  type Deduction,
  type HouseholdInput,
  type LppBuyInResult,
  lppBuyInPlan,
  noTaxOf,
  ordinaryTaxEstimator,
  pillar3aCatchUpPlan,
  savingOf,
  type TouPerson,
  type TouResult,
  touPlan,
  type TouWithheld,
} from '@taxpresso/optimizer';
import {
  sourceTax,
  SourceTaxError,
  sourceTaxTariffs,
  TOU_FACTS,
  touDeadline,
} from '@taxpresso/rules-ge';
import { LPP_BUYIN_FACTS, PILLAR3A_CATCHUP_FACTS } from '@taxpresso/rules-ch';
import * as z from 'zod/v4';
import { CANTONS, type CantonEntry } from './cantons.js';
import { PLAN_KEYS, WorkspaceError, type Via, type Workspace } from './workspace.js';
import { isYearOver } from './year-over.js';
import { CURRENT_TAX_YEAR } from './config.js';

type Who = 'p1' | 'p2';
const WORK = ['salary', 'replacement_income', 'self_employment'];

export interface StoredDecision extends Decision {
  via: Via;
}
interface DecisionsFile {
  version: 1;
  decisions: StoredDecision[];
}

const loaded = new WeakMap<Workspace, DecisionsFile>();
const locks = new WeakMap<Workspace, Promise<unknown>>();

/** Loads decisions.json once (a missing folder is no decision). Call before reading the views. */
export async function planningReady(ws: Workspace): Promise<void> {
  if (loaded.has(ws)) return;
  const file = await ws.vault.readState<DecisionsFile>('decisions.json', {
    version: 1,
    decisions: [],
  });
  if (!loaded.has(ws)) {
    loaded.set(ws, { version: 1, decisions: Array.isArray(file.decisions) ? file.decisions : [] });
  }
}

/** What the plans read besides the workspace's state: the decisions recorded (Workspace.memo). */
const decisionsKey = (ws: Workspace) => String(loaded.get(ws)?.decisions.length ?? -1);

/** The decision that counts for each optimization: the latest one. */
export function currentDecision(ws: Workspace, id: string): StoredDecision | undefined {
  return loaded
    .get(ws)
    ?.decisions.filter((d) => d.optimizationId === id)
    .at(-1);
}

/** A value read from this year's documents, summed per person (one per certificate). */
function fromDocuments(
  ws: Workspace,
  key: string,
  person: Who,
): { centimes: number; unconfirmed: boolean } | undefined {
  const otherYear = new Set(
    ws
      .activeDocuments()
      .filter((d) => d.taxYear !== undefined && d.taxYear !== ws.engine.taxYear)
      .map((d) => d.id),
  );
  const facts = ws
    .countedFacts()
    .filter(
      (f) =>
        f.key === key &&
        f.person === person &&
        f.source.docId !== undefined &&
        !otherYear.has(f.source.docId) &&
        typeof f.value === 'number',
    );
  if (!facts.length) return undefined;
  return {
    centimes: facts.reduce((sum, f) => sum + (f.value as number), 0),
    unconfirmed: facts.some((f) => f.status === 'extracted'),
  };
}

/** A planning figure; 0 means "cleared", except where 0 is a real answer (paid nothing). */
function planMoney(ws: Workspace, key: string, person: Who, zeroCounts = false) {
  const v = ws.ledger.get(key, person)?.value;
  return typeof v === 'number' && (zeroCounts ? v >= 0 : v > 0) ? v : undefined;
}

function planFlag(ws: Workspace, key: string): boolean | undefined {
  const v = ws.ledger.get(key, 'household')?.value;
  return typeof v === 'boolean' ? v : undefined;
}

/** The household for the plans: the planning inputs, with this year's documents where they exist. */
function household(ws: Workspace): { h: HouseholdInput; unconfirmed: boolean } {
  const base = ws.planInput();
  let unconfirmed = false;
  const people = base.people.map((p) => {
    const net = fromDocuments(ws, 'salary.net', p.person);
    const paid = fromDocuments(ws, 'pillar3a.paid', p.person);
    unconfirmed ||= Boolean(net?.unconfirmed || paid?.unconfirmed);
    return {
      ...p,
      ...(net ? { netCentimes: net.centimes } : {}),
      ...(paid ? { paidCentimes: paid.centimes } : {}),
    };
  });
  return { h: { ...base, people }, unconfirmed };
}

export function lppView(ws: Workspace): LppBuyInResult {
  return ws.memo('plan.lpp', '', () => lppViewOf(ws));
}

function lppViewOf(ws: Workspace): LppBuyInResult {
  const { h } = household(ws);
  return lppBuyInPlan(
    h,
    h.people.map((p) => {
      const capacity = planMoney(ws, 'plan.lpp_buyin_capacity', p.person);
      const amount = planMoney(ws, 'plan.lpp_buyin_amount', p.person);
      return {
        person: p.person,
        ...(capacity !== undefined ? { capacityCentimes: capacity } : {}),
        ...(amount !== undefined ? { amountCentimes: amount } : {}),
      };
    }),
  );
}

/**
 * This year's 3a room per person, which a catch-up comes after: the 2026 limits from the 3a plan,
 * against what was paid (the attestation when there is one). Also used by ./last-year-review.ts.
 */
export function room2026(ws: Workspace): Record<Who, number> {
  return ws.memo('plan.room2026', '', () => room2026Of(ws));
}

function room2026Of(ws: Workspace): Record<Who, number> {
  const { h } = household(ws);
  const caps = ws.plan().people;
  const room: Record<Who, number> = { p1: 0, p2: 0 };
  for (const p of h.people) {
    const cap = caps.find((r) => r.person === p.person)?.capCentimes ?? 0;
    room[p.person] = Math.max(0, cap - p.paidCentimes);
  }
  return room;
}

export function catchUpView(ws: Workspace): CatchUpResult {
  return ws.memo('plan.catchUp', '', () => catchUpViewOf(ws));
}

function catchUpViewOf(ws: Workspace): CatchUpResult {
  const { h } = household(ws);
  const room = room2026(ws);
  return pillar3aCatchUpPlan(
    h,
    h.people.map((p) => {
      const paid2025 = planMoney(ws, 'plan.pillar3a_paid_2025', p.person, true);
      return {
        person: p.person,
        hasPensionFund: p.hasPensionFund,
        room2026Centimes: room[p.person],
        ...(paid2025 !== undefined ? { paid2025Centimes: paid2025 } : {}),
      };
    }),
  );
}

/** All the plans before 31 December together: one figure for "Ways to save" (docs/design/simple.md). */
export interface SavingsTotal {
  totalCentimes: number;
  cantonalCentimes: number;
  federalCentimes: number;
  /** The plans it adds up: the 3a room, the 3a catch-up, a pension fund buy-in the user gave. */
  parts: ('pillar3a' | 'pillar3a_catchup' | 'lpp_buyin')[];
  /** Taxed at source without TOU: these deductions lower the tax only with TOU. */
  onlyWithTou: boolean;
  assumptions: string[];
  sources: string[];
}

/**
 * What paying everything in before 31 December would save, all plans at once: the engine run with
 * and without the 3a room, the 3a catch-up and the buy-in amount the user gave (SPEC.md section 8),
 * on the household the buy-in, catch-up and TOU cards read. Each part only when its own card shows
 * a saving; nothing when no salary is known or the canton's tax can't be computed (fail closed).
 */
export function savingsTotal(ws: Workspace): SavingsTotal | undefined {
  return ws.memo('plan.savings', decisionsKey(ws), () => savingsTotalOf(ws));
}

function savingsTotalOf(ws: Workspace): SavingsTotal | undefined {
  if (ws.yearOver()) return undefined;
  const { h } = household(ws);
  if (noTaxOf(h)) return undefined;
  const estimator = ordinaryTaxEstimator(h);
  if (!estimator) return undefined;
  const parts = new Set<SavingsTotal['parts'][number]>();
  const extra: Deduction[] = [];
  const room = room2026(ws);
  for (const p of h.people) {
    if (room[p.person] > 0) {
      extra.push({ person: p.person, kind: 'pillar3a', centimes: room[p.person] });
      parts.add('pillar3a');
    }
  }
  const catchUp = catchUpView(ws);
  if (catchUp.saving) {
    for (const r of catchUp.people) {
      if (r.catchUpCentimes > 0) {
        extra.push({ person: r.person, kind: 'pillar3a_catchup', centimes: r.catchUpCentimes });
        parts.add('pillar3a_catchup');
      }
    }
  }
  const lpp = lppView(ws);
  if (lpp.saving) {
    for (const r of lpp.people) {
      if (r.amountCentimes) {
        extra.push({ person: r.person, kind: 'lpp_buyin', centimes: r.amountCentimes });
        parts.add('lpp_buyin');
      }
    }
  }
  if (!extra.length) return undefined;
  const base: Deduction[] = h.people.map((p) => ({
    person: p.person,
    kind: 'pillar3a',
    centimes: p.paidCentimes,
  }));
  const saving = savingOf(estimator.taxWith, base, extra);
  // Less than CHF 10 is no saving to show.
  if (saving.totalCentimes < 1000) return undefined;
  const tou = touView(ws);
  return {
    ...saving,
    parts: [...parts],
    onlyWithTou: tou.applies && tou.compulsory !== 'yes' && tou.decision?.choice !== 'request',
    assumptions: estimator.assumptions,
    sources: estimator.sources,
  };
}

export interface TouView extends TouResult {
  decision?: StoredDecision;
}

export function touView(ws: Workspace, today = ws.today()): TouView {
  return ws.memo('plan.tou', `${decisionsKey(ws)}|${today}`, () => touViewOf(ws, today));
}

function touViewOf(ws: Workspace, today: string): TouView {
  const { h, unconfirmed: householdUnconfirmed } = household(ws);
  // TOU is Geneva's (the AFC's directives): in another canton, taxation at source and its ordinary
  // assessment afterwards (Zurich's NOV) are not supported yet, so there is nothing to compare.
  if (h.other) {
    return touPlan({
      taxYear: ws.engine.taxYear,
      today,
      household: h,
      people: h.people.map((p) => ({ person: p.person, taxedAtSource: false })),
      deductions: [],
      unconfirmed: false,
    });
  }
  const snap = ws.snapshot();
  const answer = (key: string, person: Who) => snap.answers.get(`${key}|${person}`);
  let unconfirmed = householdUnconfirmed;
  const deductions: Deduction[] = [];
  const people: TouPerson[] = h.people.map((p) => {
    const sources = answer('profile.income_sources', p.person);
    const certGross = fromDocuments(ws, 'salary.gross', p.person);
    const gross = certGross?.centimes ?? planMoney(ws, 'plan.gross_salary', p.person);
    const certTax = fromDocuments(ws, 'salary.source_tax', p.person);
    unconfirmed ||= Boolean(certGross?.unconfirmed || certTax?.unconfirmed);
    let withheld: TouWithheld | undefined;
    const stated = planMoney(ws, 'plan.source_tax_withheld', p.person);
    const tariff = ws.ledger.get('plan.source_tax_tariff', p.person)?.value;
    if (certTax) withheld = { centimes: certTax.centimes, from: 'certificate' };
    else if (stated !== undefined) withheld = { centimes: stated, from: 'stated' };
    else if (typeof tariff === 'string' && gross !== undefined) {
      try {
        const t = sourceTax(ws.engine.taxYear, tariff, gross, 'year');
        withheld = { centimes: t.taxCentimes, from: 'tariff', tariff: t.tariff };
      } catch (err) {
        // Outside the published tables: no estimate rather than a guess.
        if (!(err instanceof SourceTaxError)) throw err;
      }
    }
    // Deductions that only count with TOU: what was paid into 3a, pension fund buy-ins.
    if (p.paidCentimes > 0) {
      deductions.push({ person: p.person, kind: 'pillar3a', centimes: p.paidCentimes });
    }
    const buyIn =
      fromDocuments(ws, 'lpp.buyin', p.person)?.centimes ??
      planMoney(ws, 'plan.lpp_buyin_amount', p.person);
    if (buyIn) deductions.push({ person: p.person, kind: 'lpp_buyin', centimes: buyIn });
    const tou = answer('profile.tou', p.person);
    return {
      person: p.person,
      taxedAtSource: answer('profile.taxed_at_source', p.person) === true,
      ...(tou === 'already' || tou === 'considering' || tou === 'no' ? { tou } : {}),
      ...(gross !== undefined ? { grossCentimes: gross } : {}),
      ...(Array.isArray(sources) ? { working: sources.some((s) => WORK.includes(s)) } : {}),
      ...(withheld ? { withheld } : {}),
    };
  });
  const otherIncome = planFlag(ws, 'plan.tou_other_income');
  const taxableWealth = planFlag(ws, 'plan.tou_taxable_wealth');
  const result = touPlan({
    taxYear: ws.engine.taxYear,
    today,
    household: h,
    people,
    ...(otherIncome !== undefined ? { otherIncome } : {}),
    ...(taxableWealth !== undefined ? { taxableWealth } : {}),
    deductions,
    unconfirmed,
  });
  const decision = currentDecision(ws, 'tou');
  return { ...result, ...(decision ? { decision } : {}) };
}

/** Planning fields the dashboard sends, and the key each one is. */
export const PLANNING_FIELDS = {
  lppCapacity: 'plan.lpp_buyin_capacity',
  lppAmount: 'plan.lpp_buyin_amount',
  paid2025: 'plan.pillar3a_paid_2025',
  withheld: 'plan.source_tax_withheld',
  tariff: 'plan.source_tax_tariff',
  otherIncome: 'plan.tou_other_income',
  taxableWealth: 'plan.tou_taxable_wealth',
} as const satisfies Record<string, (typeof PLAN_KEYS)[number]>;

export const PlanningInput = z.object({
  person: z.enum(['p1', 'p2']).default('p1'),
  field: z.enum(Object.keys(PLANNING_FIELDS) as [keyof typeof PLANNING_FIELDS]),
  value: z.union([z.number().min(0).max(100_000_000), z.boolean(), z.string().max(4)]),
});

export const DecisionInput = z.object({
  id: z.literal('tou'),
  choice: z.enum(['request', 'decline']),
  /** The user ticked "I understand it can't be withdrawn" (dashboard) or said so (chat). */
  confirmed: z.boolean(),
});
export type DecisionInput = z.infer<typeof DecisionInput>;

/**
 * Records the user's TOU decision. Only with the comparison in front of them, before the deadline,
 * when TOU is not compulsory anyway; asking for TOU needs the explicit "can't be withdrawn" OK.
 */
export async function decide(
  ws: Workspace,
  input: DecisionInput,
  via: Via,
  today = ws.today(),
): Promise<StoredDecision> {
  const run = (locks.get(ws) ?? Promise.resolve()).then(async () => {
    await ws.ready();
    await planningReady(ws);
    const problem = ws.vault.problem();
    if (problem) throw new WorkspaceError(problem);
    if (isYearOver(ws.taxYear)) {
      throw new WorkspaceError(
        `${ws.taxYear} is over: a TOU request for ${ws.taxYear} had to reach the tax office by ${touDeadline(ws.taxYear)} (${TOU_FACTS.deadline}). There is nothing to decide now.`,
      );
    }
    const tou = touView(ws, today);
    const canton = ws.canton().canton;
    if (canton && !canton.tou) {
      throw new WorkspaceError(
        `TOU is Geneva’s procedure. For ${canton.name.en}, taxation at source and its ${canton.terms?.sourceTaxAssessment ?? 'ordinary assessment'} are not supported yet.`,
      );
    }
    if (!tou.applies) throw new WorkspaceError('No one in this household is taxed at source.');
    if (tou.deadlinePassed) {
      throw new WorkspaceError(
        `The deadline (${tou.deadline}) has passed: there is nothing to decide.`,
      );
    }
    if (tou.compulsory === 'yes') {
      throw new WorkspaceError(
        `TOU is compulsory here: it must be announced by ${tou.deadline}. There is no choice to record.`,
      );
    }
    if (tou.differenceCentimes === undefined) {
      throw new WorkspaceError(
        'Taxpresso needs the comparison first: the tax withheld at source and the salary for the year.',
      );
    }
    if (input.choice === 'request' && !input.confirmed) {
      throw new WorkspaceError(
        'A TOU request can’t be withdrawn once sent: the user must confirm they understand that.',
      );
    }
    const decision: StoredDecision = {
      optimizationId: 'tou',
      choice: input.choice,
      decidedAt: new Date().toISOString(),
      deltaCentimes: tou.differenceCentimes,
      via,
    };
    const file = loaded.get(ws)!;
    const next: DecisionsFile = { version: 1, decisions: [...file.decisions, decision] };
    await ws.vault.writeState('decisions.json', next);
    loaded.set(ws, next);
    ws.record(via === 'chat' ? 'claude' : 'you', 'decide');
    return decision;
  });
  locks.set(
    ws,
    run.catch(() => undefined),
  );
  return run;
}

/** Everything the dashboard shows for the plans and the TOU card. */
export function planningView(ws: Workspace) {
  return ws.memo('plan.view', decisionsKey(ws), () => planningViewOf(ws));
}

function planningViewOf(ws: Workspace) {
  const snap = ws.snapshot();
  const tou = touView(ws);
  const canton = ws.canton().canton;
  // TOU is Geneva's: another canton's taxation at source is not supported yet.
  const genevaOnly = canton !== undefined && !canton.tou;
  const inputs = snap.people.map((person) => {
    const p = person as Who;
    const tariff = ws.ledger.get('plan.source_tax_tariff', p)?.value;
    return {
      person: p,
      lppCapacity: planMoney(ws, 'plan.lpp_buyin_capacity', p) ?? null,
      lppAmount: planMoney(ws, 'plan.lpp_buyin_amount', p) ?? null,
      paid2025: planMoney(ws, 'plan.pillar3a_paid_2025', p, true) ?? null,
      withheld: planMoney(ws, 'plan.source_tax_withheld', p) ?? null,
      tariff: typeof tariff === 'string' ? tariff : null,
      taxedAtSource: snap.answers.get(`profile.taxed_at_source|${p}`) === true,
    };
  });
  return {
    inputs,
    otherIncome: planFlag(ws, 'plan.tou_other_income') ?? null,
    taxableWealth: planFlag(ws, 'plan.tou_taxable_wealth') ?? null,
    tariffs: genevaOnly ? [] : sourceTaxTariffs(ws.engine.taxYear),
    lpp: lppView(ws),
    catchUp: catchUpView(ws),
    tou,
    /** Taxed at source without a compulsory TOU: 3a and buy-ins lower the tax only with TOU. */
    needsTou: tou.applies && tou.compulsory !== 'yes' && tou.decision?.choice !== 'request',
    /** Another canton: TOU is Geneva's, and taxation at source is not supported there yet. */
    ...(genevaOnly ? { touGenevaOnly: true as const } : {}),
  };
}

export type PlanningView = ReturnType<typeof planningView>;

/**
 * For a tax year that is over (docs/design/tax-years.md): what replaces the plans before 31 December
 * and the TOU card. Nothing can be paid into the year anymore: the plans are the default year's,
 * one step away (open_tax_year, or the card's button). Only facts with their sources.
 */
export interface YearOverView {
  year: number;
  /** The year whose plans apply now (pillar 3a, buy-in, 3a catch-up): the default year. */
  plansIn: number;
  /** 3a and buy-ins count in the year they are paid: what was paid is on the attestations. */
  paidInYear: string;
  /** A 3a gap of this year can be made up in the plans' year (rachat 3a), under conditions. */
  catchUp?: { sources: string[] };
  /**
   * People taxed at source in Geneva: the day a TOU request had to reach the tax office, by law,
   * whether it has passed, and the decision recorded, if any.
   */
  tou?: { deadline: string; passed: boolean; source: string; decision?: StoredDecision };
}

export function yearOverView(ws: Workspace): YearOverView | undefined {
  if (!ws.yearOver()) return undefined;
  const year = ws.taxYear;
  const snap = ws.snapshot();
  const canton = ws.canton().canton;
  const atSource = snap.people.some(
    (p) => snap.answers.get(`profile.taxed_at_source|${p}`) === true,
  );
  const deadline = touDeadline(year);
  const decision = currentDecision(ws, 'tou');
  return {
    year,
    plansIn: CURRENT_TAX_YEAR,
    // Payments "effectués en 2025" (ge-2025-guide-declaration-pp p. 18), the buy-in's own rule.
    paidInYear: LPP_BUYIN_FACTS.paidInYear,
    // The 3a catch-up makes up gaps from 2025 on (OPP 3 art. 7a, its transitional provision).
    ...(year >= 2025
      ? {
          catchUp: {
            sources: [
              PILLAR3A_CATCHUP_FACTS.onlyGapsFrom2025,
              PILLAR3A_CATCHUP_FACTS.gapYearConditions,
            ],
          },
        }
      : {}),
    // TOU is Geneva's: its deadline is in the law (31 March of the next year).
    ...(atSource && (canton === undefined || canton.tou)
      ? {
          tou: {
            deadline,
            passed: ws.today() > deadline,
            source: TOU_FACTS.deadline,
            ...(decision ? { decision } : {}),
          },
        }
      : {}),
  };
}

/** The chat's words for a year that is over (list_optimizations). */
export function yearOverText(v: YearOverView, canton?: CantonEntry): string[] {
  const pillar3a = canton?.terms?.pillar3a ?? '3e pilier A';
  const buyIn = canton?.terms?.pensionBuyIn ?? 'rachat 2e pilier';
  const lines = [
    `Tax year ${v.year} is open, and it is over. The plans before 31 December, pillar 3a (${pillar3a}), a pension fund buy-in (${buyIn}) and the 3a catch-up, are ${v.plansIn}'s: payments count in the year they are paid, so nothing paid now lowers the ${v.year} tax, whose return takes what was paid in ${v.year}, from the attestations (${v.paidInYear}).`,
    `When the user asks about 3a or a buy-in, say these plans apply to ${v.plansIn}, and offer to switch to ${v.plansIn} in one step: open_tax_year with year ${v.plansIn}, then list_optimizations (the dashboard has the same button). ${v.year} stays as it is.`,
  ];
  if (v.catchUp) {
    lines.push(
      `If less than the maximum went into 3a in ${v.year}, the gap can be made up in ${v.plansIn} (3a catch-up, rachat 3a), under conditions (${v.catchUp.sources.join('; ')}): the ${v.plansIn} plans show it.`,
    );
  }
  if (v.tou) {
    lines.push(
      `TOU (taxation ordinaire ultérieure) for ${v.year}: a request had to reach the tax office by ${v.tou.deadline} (${v.tou.source})${v.tou.passed ? ', which has passed' : ''}.${v.tou.decision ? ` Recorded: ${v.tou.decision.choice === 'request' ? 'the user asked for TOU' : 'no TOU'}.` : ''} If the user asked for it in time, their ${v.year} return is an ordinary one: Taxpresso prepares it.`,
    );
  }
  return lines;
}

const WHO: Record<string, string> = { p1: 'you', p2: 'your spouse or partner' };
const chf = (centimes: number) => `CHF ${Math.round(centimes / 100).toLocaleString('en-US')}`;
const about = (centimes: number) => chf(Math.round(centimes / 1000) * 1000);
const TOU_REASON_TEXT: Record<string, string> = {
  gross: 'gross salary taxed at source of CHF 120,000 or more for one person',
  other_income: 'other income not taxed at source of CHF 3,000 or more (plan.tou_other_income)',
  taxable_wealth: 'taxable wealth on 31 December (plan.tou_taxable_wealth)',
  previous_tou: 'already taxed ordinarily (TOU) before',
  spouse_without_activity:
    'a spouse without any activity: listed on the AFC page only, not in its 2026 directives, so the user should ask the AFC',
};
const TOU_ASSUMPTION_TEXT: Record<string, string> = {
  ordinary_may_be_lower:
    'The ordinary tax counts only flat deductions so far (no Geneva family deductions, health premiums or childcare): the real one is likely lower, so TOU may be better than shown.',
  income_tax_only:
    'Income tax only; wealth tax is not counted (taxable wealth makes TOU compulsory anyway).',
  withheld_from_tariff:
    'Tax withheld estimated from the tariff on the yearly gross salary; box 12 of the salary certificate has the real figure.',
  tariff_c_correction:
    'Both spouses work (tariff C): the AFC may correct the tax withheld on both real incomes.',
  values_to_confirm: 'Some figures come from documents the user has not confirmed yet.',
  icc_2025_scale: 'Geneva tax on the 2025 scale (2026 is published in January 2027).',
  home_commune_rate: 'The communal part at the home commune rate only.',
  net_from_gross: 'Net salary taken as 88 % of the gross.',
  commune_default: 'Commune unknown: City of Geneva assumed.',
  no_income_for_some: 'No salary for one person: counted as zero.',
};

/**
 * The assumptions of the plans on another canton's engine, in words ("zh_preview",
 * "zh_commune_default"), from the registry: the canton's name and the commune assumed.
 */
export function cantonAssumptionText(a: string): string | undefined {
  for (const c of Object.values(CANTONS)) {
    if (!c.plan) continue;
    if (a === c.plan.assumptions.communeDefault) {
      return `Commune unknown: ${c.plan.communeName.en} assumed.`;
    }
    if (a === c.plan.assumptions.preview) {
      return `${c.name.en} is a preview: the rules its documents don’t spell out are applied as in the estimate (compute_tax lists them).`;
    }
    if (a === c.plan.noTax?.assumption && c.plan.noTaxText) return c.plan.noTaxText.en;
  }
  return undefined;
}
const STATUS_TEXT: Record<string, string> = {
  yes: 'yes',
  no: 'no',
  unknown: 'not known yet',
  check: 'to check with the AFC',
};

const withheldFrom = (p: { from: string; tariff?: string }) =>
  p.from === 'certificate'
    ? 'salary certificates'
    : p.from === 'stated'
      ? 'what the user said'
      : `the ${p.tariff} tariff on the gross salary`;

function lppText(lpp: LppBuyInResult, year: number, canton: CantonEntry | undefined): string[] {
  const term = canton?.terms?.pensionBuyIn ?? 'rachat 2e pilier';
  const lines = ['', `Pension fund buy-in (${term}), before 31 December ${year}:`];
  for (const p of lpp.people) {
    const cap =
      p.capacityCentimes !== undefined
        ? `the fund allows ${chf(p.capacityCentimes)}`
        : 'what the fund allows is on the pension certificate, not given yet (plan.lpp_buyin_capacity)';
    const amount = p.amountCentimes ? `, considering ${chf(p.amountCentimes)}` : '';
    const over = p.overCapacity ? ' (more than the fund allows)' : '';
    lines.push(`- ${WHO[p.person]}: ${cap}${amount}${over}`);
  }
  if (lpp.problem === 'over_capacity') {
    lines.push('No saving shown: an amount is above what the fund allows.');
  } else if (lpp.problem === 'no_tax') {
    lines.push(`No saving shown: ${canton?.plan?.noTaxText?.en ?? lpp.assumptions.join(' ')}`);
  } else if (lpp.saving) {
    lines.push(
      `Estimated saving: about ${about(lpp.saving.totalCentimes)} (cantonal and communal ${chf(lpp.saving.cantonalCentimes)}, federal ${chf(lpp.saving.federalCentimes)}), on top of the 3a already paid. Say it is an estimate.`,
    );
  } else if (lpp.problem === 'no_income') {
    lines.push('No salary yet: save a rough salary (plan.gross_salary) to estimate the saving.');
  } else {
    lines.push('No amount yet: the user can give one (plan.lpp_buyin_amount).');
  }
  lines.push(
    `Facts with sources: the fund accepts buy-ins up to what its rules allow (${lpp.facts.capacityFromFund}); bought-in benefits can't be taken as a lump sum for three years, or the deduction is taken back (${lpp.facts.threeYearRule}); a home-ownership withdrawal must be paid back first (${lpp.facts.homeWithdrawalFirst}); it counts in the year it is paid (${lpp.facts.paidInYear}).`,
  );
  return lines;
}

function catchUpText(cu: CatchUpResult, year: number, canton: CantonEntry | undefined): string[] {
  const lines = [
    '',
    `3a catch-up (${canton?.terms?.pillar3aCatchUp ?? 'rachat 3a'}, new from ${year}):`,
  ];
  for (const p of cu.people) {
    const what =
      p.status === 'unknown'
        ? 'not known: ask what they paid into 3a in 2025 (plan.pillar3a_paid_2025)'
        : p.status === 'no_gap'
          ? 'no gap in 2025, nothing to make up'
          : `can make up ${p.isMaximum ? 'up to ' : ''}${chf(p.catchUpCentimes)} of the 2025 gap${p.status === 'pay_this_year_first' ? `, after paying the full ${year} 3a first` : ''}`;
    lines.push(`- ${WHO[p.person]}: ${what}`);
  }
  const unknownRule = canton?.plan?.catchUp.unknownRule;
  if (canton && unknownRule && cu.assumptions.includes(unknownRule)) {
    lines.push(
      `No saving shown for ${canton.name.en}: no ${canton.name.en} document Taxpresso has gives the cantonal rule of a 3a catch-up yet. The federal rules below hold.`,
    );
  }
  const noTax = canton?.plan?.noTax;
  if (canton && noTax && cu.assumptions.includes(noTax.assumption)) {
    lines.push(`No saving shown: ${canton.plan?.noTaxText?.en ?? noTax.assumption}`);
  }
  if (cu.saving) {
    lines.push(
      `Estimated saving of the catch-up, on top of the full ${year} payment: about ${about(cu.saving.totalCentimes)}. Say it is an estimate.`,
    );
  }
  lines.push(
    `Rules with sources: only gaps from 2025 (${cu.facts.onlyGapsFrom2025}); the full payment of the year first (${cu.facts.fullCurrentYearFirst}); one catch-up per gap year (${cu.facts.oneCatchUpPerGap}); not after taking 3a old-age benefits (${cu.facts.noOldAgeBenefit}); a written request to the 3a provider (${cu.facts.writtenRequest}).`,
  );
  return lines;
}

function touText(tou: TouView): string[] {
  const lines = ['', 'TOU (taxation ordinaire ultérieure), for people taxed at source:'];
  if (tou.withheld) {
    const parts = tou.withheld.people.map(
      (p) => `${WHO[p.person]} ${chf(p.centimes)} from ${withheldFrom(p)}`,
    );
    lines.push(
      `- Tax withheld at source: ${chf(tou.withheld.totalCentimes)} (${parts.join('; ')})`,
    );
  }
  if (tou.missingWithheld.length) {
    lines.push(
      `- Tax withheld not known for ${tou.missingWithheld.map((p) => WHO[p]).join(' and ')}: salary certificate box 12, or the user's figure (plan.source_tax_withheld), or the tariff code on the payslip (plan.source_tax_tariff).`,
    );
  }
  if (tou.problem === 'mixed_couple') {
    lines.push(
      '- Only one of the couple is taxed at source: no comparison; suggest asking the AFC.',
    );
  }
  if (tou.ordinary) {
    lines.push(
      `- Ordinary tax, estimated: ${chf(tou.ordinary.totalCentimes)}. Assumptions: ${tou.assumptions.map((a) => TOU_ASSUMPTION_TEXT[a] ?? cantonAssumptionText(a) ?? a).join(' ')}`,
    );
  }
  if (tou.differenceCentimes !== undefined) {
    const d = tou.differenceCentimes;
    lines.push(
      d >= 0
        ? `- With TOU: about ${about(d)} back. Say it is an estimate.`
        : `- With TOU: about ${about(-d)} more to pay. Say it is an estimate.`,
    );
  }
  const reasons = tou.reasons
    .filter((r) => r.status !== 'no')
    .map((r) => `${TOU_REASON_TEXT[r.id]}: ${STATUS_TEXT[r.status]}`);
  lines.push(
    `- Compulsory: ${STATUS_TEXT[tou.compulsory]} (${reasons.join('; ') || 'none of the cases applies'}; ${tou.facts.compulsoryCases})`,
    `- Deadline: ${tou.deadline}${tou.deadlinePassed ? ' (passed)' : ''} (${tou.facts.deadline}). A request can't be withdrawn, even if the result is worse (${tou.facts.irrevocable}), and it applies every year after while taxed at source, the spouse included (${tou.facts.everyYearAfter}).`,
    tou.decision
      ? `- Decision recorded: ${tou.decision.choice === 'request' ? 'will request TOU' : 'not this year'} (${tou.decision.decidedAt.slice(0, 10)}).`
      : '- No decision yet. Record only what the user explicitly chooses, with decide_optimization.',
    `- The user sends the request themselves: the DRIS/TOU form in their e-démarches space (${tou.facts.howToRequest}).`,
  );
  return lines;
}

/**
 * The chat's view of the buy-in, the 3a catch-up and TOU (C6: short, with sources). `canton`: the
 * canton of the return, for its official terms when it is not Geneva.
 */
export function planningText(view: PlanningView, year: number, canton?: CantonEntry): string[] {
  const other = 'touGenevaOnly' in view ? canton : undefined;
  return [
    ...(view.needsTou
      ? [
          `Taxed at source: 3a, pension fund buy-ins and 3a catch-ups lower the tax only with TOU (${view.tou.facts.deductionsOnlyWithTou}). Say so with every saving.`,
        ]
      : []),
    ...lppText(view.lpp, year, other),
    ...catchUpText(view.catchUp, year, other),
    ...(view.tou.applies ? touText(view.tou) : []),
    ...(other
      ? [
          '',
          `TOU (taxation ordinaire ultérieure) is Geneva’s. For ${other.name.en}, taxation at source (${other.terms?.sourceTax ?? 'impôt à la source'}) and its ${other.terms?.sourceTaxAssessment ?? 'ordinary assessment'} are not supported yet: if the user is taxed at source, say so and point to the official page.`,
        ]
      : []),
  ];
}
