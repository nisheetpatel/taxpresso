// The federal direct tax (imposta federale diretta) of a Ticino household. The return has no federal
// column: "La dichiarazione d’imposta 2025 serve anche per la tassazione dell’imposta federale
// diretta", and "gli adattamenti che si rendono necessari per le deduzioni e le altre particolarità
// dell’imposta federale diretta sono operati automaticamente a cura dell’autorità di tassazione"
// (ti-2025-guide-istruzioni-pf-pdf p. 47; p. 5). The canton's table of deductions compares the two
// taxes cifra by cifra, so the taxpayer can work out the federal tax from the total income (8) less
// the federal deductions (ti-2025-deductions-table p. 1; ti-2025-guide-istruzioni-pf-pdf p. 49 and
// 50). So this file computes the federal tax on the return's own lines: the income lines as they
// are (one income page), the federal amounts of the deductions on the same lines, Modulo 4's lines
// for each person's professional costs, the married couple deduction among the other deductions
// (15), where the table lists it for the federal tax only, then the subtotals of the return with the
// federal amounts: 16, 19, childcare (20), 21 (the base of the illness costs' threshold, 5 % of it,
// ti-2025-form-modulo-6 p. 2), the illness costs (22.1), 23 (the base of the donations' cap, 20 %
// of it "sia per l’imposta cantonale che federale diretta", ti-2025-form-modulo-5 p. 2), the
// donations (24), the federal child deduction (25.1) and the taxable income (28): the exemption for
// AVS and AI pensioners (27) is cantonal only.
//
// The rules are the federal ones, the same in every canton (packages/rules-ch: each deduction keyed
// by concept, the scale, the tax); this file puts each concept on its Ticino line.
import {
  chf,
  childcareCosts,
  childDeduction,
  commuteBase,
  commuteCosts,
  debtInterest,
  donations,
  federalChildcare,
  federalScale,
  francTotal,
  IFD_NOTE,
  ifdParamsFor,
  ifdSideJobFlat,
  ifdTax,
  insurancePremiums,
  marriedCouple,
  mealsCosts,
  medicalCosts,
  pillar3a,
  politicalParty,
  professionalCosts,
  shareFranc,
  Trace,
  trainingCosts,
  twoEarner,
  type Cited,
  type Deduction,
  type FederalConcept,
  type IfdParams,
  type LimitApplied,
  type RuleResult,
} from '@taxpresso/rules-ch';
import {
  CHILDCARE,
  FEDERAL_DEDUCTIONS,
  federalRubric,
  INCOME,
  MEDICAL,
  MODULO4_CODES,
  PERSON_CODES,
  SOCIAL,
} from './rubrics.js';
import type {
  Amount,
  EmploymentInput,
  Item,
  ItemPerson,
  Line,
  PersonInput,
  Text,
  TiEngineInput,
  TiIfdResult,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';
const FORM = 'ti-2025-form-modulo-1-de';
const TABLE = 'ti-2025-deductions-table p. 1';

/** The order of the federal lines: the return's, Modulo 4's in place of 9.1 and 9.2. */
const ORDER_IFD: readonly string[] = [
  '1.1',
  '1.2',
  '3.1',
  '3.2',
  '3.3',
  '3.4',
  '3.5',
  '3.6',
  '4.1',
  '6.3',
  ...['p1', 'p2'].flatMap((p) =>
    (['transit', 'vehicle', 'bike', 'meals', 'otherFlat', 'otherActual', 'sideFlat'] as const).map(
      (k) => MODULO4_CODES[k][p as 'p1' | 'p2'],
    ),
  ),
  '10.3',
  '11.1',
  '11.2',
  '12',
  '13.1',
  '13.2',
  '14.1',
  '14.2',
  '15.2',
  '15.3',
  '15.4',
  '15.5',
  'coniugi',
  '20',
  '22.1',
  '24',
  '25.1',
];

/**
 * A side job's federal flat amount (LIFD art. 26 al. 1 let. c): for 2026 the federal instructions'
 * (packages/rules-ch); for 2025, the canton's table of deductions prints it for the federal tax
 * ("20% stip. netto, min. 800 max. 2’400"), which no 2025 federal document Taxpresso has gives.
 */
const SIDE_JOB_2025: Cited<{ rateBp: number; min: number; max: number }> = {
  value: { rateBp: 2_000, min: 80_000, max: 240_000 },
  source: `${TABLE} (9, Spese per attività accessoria dipendente, imposta federale)`,
};
const sideJobParams = (taxYear: number) => ifdSideJobFlat(taxYear) ?? SIDE_JOB_2025;

/** A side job's flat: its net salary up to the minimum; above, the share, between min and max. */
function sideJobFlat(net: number, p: { rateBp: number; min: number; max: number }): number {
  if (net <= 0) return 0;
  if (net <= p.min) return net;
  return Math.min(p.max, Math.max(p.min, shareFranc(net, p.rateBp)));
}

/** The line of each federal concept, for one person where it has two. */
function lineOf(concept: FederalConcept, person: ItemPerson): string {
  const p = person === 'p2' ? 'p2' : 'p1';
  switch (concept) {
    case 'pillar3a':
      return PERSON_CODES.pillar3a[p];
    case 'commute':
      return MODULO4_CODES.transit[p];
    case 'meals':
      return MODULO4_CODES.meals[p];
    case 'professional.flat':
      return MODULO4_CODES.otherFlat[p];
    case 'professional.other':
      return MODULO4_CODES.otherActual[p];
    case 'training':
      return PERSON_CODES.training[p];
    case 'two_earner':
      return '15.5';
    case 'insurance':
      return '12';
    case 'debt_interest':
      return '13.2';
    case 'childcare':
      return '20';
    case 'married':
      return 'coniugi';
    case 'medical':
      return '22.1';
    case 'donations':
      return '24';
    case 'party':
      return '15.2';
    case 'child':
      return '25.1';
  }
}

/** What the federal part noted: the result's notes and the limits it applied. */
export interface FederalNotes {
  notCounted: Text[];
  unverified: Text[];
  unsupported: Text[];
  limits: LimitApplied[];
}

/** A child as the federal tax counts it: in full, or half (shared custody, no child support). */
export interface FederalChild {
  weight: 1 | 0.5;
  livesWithYou: boolean;
  under14?: boolean;
  childcare?: Amount;
}

export interface FederalInput {
  input: TiEngineInput;
  couple: boolean;
  /** The income lines of the return (page 2): the same for both taxes. */
  incomeItems: readonly Item[];
  /**
   * Deductions in full for both taxes: the buy-ins into the pension fund and, from 2026, pillar 3a
   * (10.3), the costs of keeping securities (13.1), alimony and child support paid (14.1, 14.2).
   */
  inFull: readonly Item[];
  /** The children the household counts for the federal tax. */
  children: readonly FederalChild[];
  /** Where the attribution of the children comes from, when separated parents' support decided it. */
  childSources: readonly string[];
  /** 4.1, the gross income from accounts and securities, for the debt interest limit. */
  wealthIncome: number;
}

const none = (): FederalNotes => ({ notCounted: [], unverified: [], unsupported: [], limits: [] });

function add(list: Text[], x: Text) {
  if (!list.some((y) => y.en === x.en)) list.push(x);
}

/** An item on its line, from a shared rule's deduction (the line's page as a source). */
function deductionItem(d: Deduction<FederalConcept>, person: ItemPerson, code?: string): Item {
  const c = code ?? lineOf(d.concept, person);
  const r = federalRubric(c)!;
  d.trace.src(r.source);
  return { code: c, person, ...d.trace.line(d.amount, r.label, d.how) };
}

/** Records what a shared rule noted and the limits it applied, on its line. */
function apply(n: FederalNotes, r: RuleResult<FederalConcept>, person: ItemPerson, code?: string) {
  for (const x of r.notCounted) add(n.notCounted, x);
  for (const x of r.unverified) add(n.unverified, x);
  for (const l of r.limits) {
    n.limits.push({
      code: code ?? lineOf(l.concept, person),
      person,
      tax: 'ifd',
      kind: l.kind,
      given: l.given,
      limit: l.limit,
      counted: l.counted,
      source: l.param.source,
      ...(l.param.estimate ? { estimate: true } : {}),
      rule: l.concept,
    });
  }
}

export const FEDERAL_NOTE = {
  elsewhere: t(
    'Federal tax not computed: a child who does not live with you is not supported yet for the federal tax.',
    `Impôt fédéral non calculé${NB}: un enfant qui ne vit pas avec vous n’est pas encore pris en charge pour l’impôt fédéral.`,
  ),
} as const satisfies Record<string, Text>;

interface FederalPerson {
  id: 'p1' | 'p2';
  /** Earned income less its federal professional costs, 3a and buy-ins (15.5). */
  earned: number;
  earns: boolean;
  contributes: boolean;
  lines: Item[];
}

/** The salaries of a person's jobs, as their totals with traces. */
function salaryOf(jobs: readonly EmploymentInput[]) {
  const gTrace = new Trace();
  const gross = francTotal(
    gTrace,
    jobs.map((e) => e.gross),
  );
  const sTrace = new Trace();
  const social = francTotal(
    sTrace,
    jobs.map((e) => e.socialContributions),
  );
  const lTrace = new Trace();
  const fund = francTotal(
    lTrace,
    jobs.map((e) => e.pensionFund),
  );
  return { gross, social, fund, traces: [gTrace, sTrace, lTrace] as const };
}

/**
 * One person's federal deductions: Modulo 4 (travel 2., meals 3.1, the 3 % flat 5.1 or the actual
 * other costs 5.2, a side job's flat 6.1), pillar 3a (11.1/11.2) and training (15.3/15.4).
 * `earnings`: the person's earned income lines (1.1, 1.2, 3.4, 3.5); `buyIns`: their 10.3.
 */
function federalPerson(
  F: IfdParams,
  taxYear: number,
  p: PersonInput,
  earnings: readonly Item[],
  buyIns: readonly Item[],
  items: Item[],
  notes: FederalNotes,
): FederalPerson {
  const start = items.length;
  const all = p.employments ?? [];
  // A side job needs a main job (ti-2025-guide-istruzioni-pf-pdf p. 13), as every canton's federal
  // part reads it: without one, the jobs are the main job.
  const hasMain = all.some((e) => !e.side);
  const main = hasMain ? all.filter((e) => !e.side) : all;
  const side = hasMain ? all.filter((e) => e.side) : [];
  const m = salaryOf(main);
  const s = salaryOf(side);
  const bTrace = new Trace();
  const buyIn = francTotal(bTrace, [...all.map((e) => e.pensionBuyIn), p.pensionBuyIn]);
  // Member of a pension fund: the answer, else box 10.1 on a certificate, as every canton's federal
  // part reads it (the cantonal 11.1 also counts a buy-in of box 10.2: docs/sources/ti/NOTES.md).
  const hasFund = p.hasPensionFund ?? m.fund + s.fund > 0;

  // Pillar 3a (OPP 3 art. 7): the federal limits, as for the cantonal tax; the catch-up is on 10.3.
  const p3a = pillar3a(F, {
    ...(p.pillar3a ? { paid: p.pillar3a } : {}),
    hasFund,
    gross: m.gross + s.gross,
    social: m.social + s.social,
    self: 0,
    earnedFrom: [m.traces[0], m.traces[1], s.traces[0], s.traces[1]],
  });
  apply(notes, p3a, p.id);
  if (p3a.deduction) items.push(deductionItem(p3a.deduction, p.id));

  // Professional costs (LIFD art. 26), each on its line of Modulo 4.
  if (main.length && m.gross > 0) {
    const costTrace = new Trace();
    const way = commuteBase(F, p, costTrace);
    const other = francTotal(costTrace, [p.otherProfessionalCosts]);
    const freeTransport = main.every((e) => e.freeTransport === true);
    if (!freeTransport && way && way.cost > 0) {
      const travel = commuteCosts(F, p, way, costTrace);
      // Modulo 4's line for the way to work: by car or motorbike (2.2), by bike (2.3), else public
      // transport (2.1).
      const by = p.commuteMode?.by;
      const code =
        (by === 'car' || by === 'motorbike') && p.commuteMode?.transitUsable === false
          ? MODULO4_CODES.vehicle[p.id]
          : by === 'bike'
            ? MODULO4_CODES.bike[p.id]
            : MODULO4_CODES.transit[p.id];
      apply(notes, travel, p.id, code);
      if (travel.deduction) items.push(deductionItem(travel.deduction, p.id, code));
    }
    const home = p.commuteMode?.by === 'home';
    const canteen = main.some((e) => e.canteen === true);
    const meals = mealsCosts(F.meals, {
      days: home ? 0 : (p.mealDays ?? 0),
      canteen,
      ...(p.mealFacts ? { facts: p.mealFacts } : {}),
    });
    apply(notes, meals, p.id);
    if (meals.deduction) items.push(deductionItem(meals.deduction, p.id));
    const net = m.gross - m.social - m.fund;
    const prof = professionalCosts(F, net, other, [...m.traces], costTrace);
    apply(notes, prof, p.id);
    if (prof.deduction) items.push(deductionItem(prof.deduction, p.id));
  }
  // A side job (Modulo 4, 6.1): the federal flat, a share of its net salary between a minimum and a
  // maximum, never more than that salary.
  if (side.length && s.gross > 0) {
    const tr = new Trace().with(...s.traces);
    const sp = tr.p(sideJobParams(taxYear));
    const net = Math.max(0, s.gross - s.social - s.fund);
    const ded = sideJobFlat(net, sp);
    if (ded > 0) {
      items.push(
        deductionItem(
          {
            concept: 'professional.flat',
            amount: -ded,
            trace: tr,
            how: t(
              `Side job: ${sp.rateBp / 100} % of its salary after social and pension fund contributions (${chf(net)}), at least ${chf(sp.min)}, at most ${chf(sp.max)}, never more than that salary: ${chf(ded)}.`,
              `Activité accessoire${NB}: ${sp.rateBp / 100}${NB}% de son salaire après cotisations AVS et 2e pilier (${chf(net)}), au moins ${chf(sp.min)}, au plus ${chf(sp.max)}, jamais plus que ce salaire${NB}: ${chf(ded)}.`,
            ),
          },
          p.id,
          MODULO4_CODES.sideFlat[p.id],
        ),
      );
    }
  }

  // Professional training (LIFD art. 33 al. 1 let. j), per person (15.3/15.4).
  const trTrace = new Trace();
  const paidTraining = francTotal(trTrace, [p.trainingCosts]);
  if (paidTraining > 0) {
    const federal = trainingCosts(F, paidTraining, trTrace);
    apply(notes, federal, p.id);
    if (federal.deduction) items.push(deductionItem(federal.deduction, p.id));
  }

  const lines = items.slice(start);
  const costs = new Set<string>([
    ...Object.values(MODULO4_CODES).map((c) => c[p.id]),
    PERSON_CODES.pillar3a[p.id],
  ]);
  const own = lines.filter((i) => costs.has(i.code)).reduce((sum, i) => sum + i.amount, 0);
  const earnedIncome = earnings.reduce((sum, i) => sum + i.amount, 0);
  // Earned income after its professional costs, 3a and buy-ins (LIFD art. 33 al. 2): 1.1 is net of
  // the ordinary pension fund contributions only; the buy-ins of 10.3 come off here.
  const buyInLines = buyIns.reduce((sum, i) => sum + i.amount, 0);
  return {
    id: p.id,
    earned: earnedIncome + own + buyInLines,
    earns: earnedIncome > 0,
    contributes:
      hasFund ||
      m.fund + s.fund > 0 ||
      buyIn > 0 ||
      p3a.paid > 0 ||
      (p.pillar3aCatchUp?.value ?? 0) > 0,
    lines: [...earnings, ...buyIns, ...lines],
  };
}

const sum = (items: readonly Item[]) => items.reduce((s, i) => s + i.amount, 0);
const francs = (centimes: number) => Math.floor(Math.max(0, centimes) / 100) * 100;
const of = (items: readonly Item[], codes: Set<string>) => items.filter((i) => codes.has(i.code));

/** The totals of the federal tax, on the return's cifre 8, 16, 19, 21, 23, 26 and 28. */
export function federalTotals(items: readonly Item[]) {
  const income = of(items, INCOME);
  const deductions = of(items, FEDERAL_DEDUCTIONS);
  const care = of(items, CHILDCARE);
  const medical = of(items, MEDICAL);
  const social = of(items, SOCIAL);
  const gross = sum(income);
  const ded = sum(deductions);
  const s19 = gross + ded;
  const s21 = s19 + sum(care);
  const s23 = s21 + sum(medical);
  const s26 = s23 + sum(social);
  const taxable = francs(s26);
  const line = (
    from: readonly (Line | undefined)[],
    amount: number,
    source: string,
    label: Text,
    how: Text,
  ) =>
    new Trace()
      .src(source)
      .from(...from)
      .line(amount, label, how);
  const grossIncome = line(
    income,
    gross,
    `${FORM} p. 2 (Ziffer 8, Total der Einkünfte)`,
    {
      ...t(
        'Total income, federal tax (totale dei redditi, 8)',
        'Total des revenus, impôt fédéral (totale dei redditi, 8)',
      ),
      it: 'Totale dei redditi (8), imposta federale diretta',
    },
    t(
      `The ${income.length} income lines added up, the same as for the cantonal tax: ${chf(gross)}.`,
      `Les ${income.length} lignes de revenu additionnées, comme pour l’impôt cantonal${NB}: ${chf(gross)}.`,
    ),
  );
  const totalDeductions = line(
    deductions,
    -ded,
    `${FORM} p. 3 (Ziffer 16, Total der Abzüge); ${TABLE}`,
    {
      ...t(
        'Total deductions, federal tax (totale delle deduzioni, 16)',
        'Total des déductions, impôt fédéral (totale delle deduzioni, 16)',
      ),
      it: 'Totale delle deduzioni (16), imposta federale diretta',
    },
    t(
      `The deductions 9 to 15.5 with the federal amounts, and the married couple deduction, added up: ${chf(-ded)}.`,
      `Les déductions 9 à 15.5 aux montants fédéraux, et la déduction pour couple marié, additionnées${NB}: ${chf(-ded)}.`,
    ),
  );
  const netIncome = line(
    [grossIncome, totalDeductions],
    s19,
    `${FORM} p. 3 (Ziffer 19, Nettoeinkommen I)`,
    {
      ...t(
        'Net income I, federal tax (reddito netto I, 19)',
        'Revenu net I, impôt fédéral (reddito netto I, 19)',
      ),
      it: 'Reddito netto I (19), imposta federale diretta',
    },
    t(
      `${chf(gross)} less ${chf(-ded)}: ${chf(s19)}.`,
      `${chf(gross)} moins ${chf(-ded)}${NB}: ${chf(s19)}.`,
    ),
  );
  const netIncome2 = line(
    [netIncome, ...care],
    s21,
    `${FORM} p. 3 (Ziffer 21, Nettoeinkommen II)`,
    {
      ...t(
        'Net income II, federal tax (reddito netto intermedio II, 21)',
        'Revenu net II, impôt fédéral (reddito netto intermedio II, 21)',
      ),
      it: 'Reddito netto intermedio II (21), imposta federale diretta',
    },
    t(
      `${chf(s19)} less childcare (20) ${chf(-sum(care))}: ${chf(s21)}.`,
      `${chf(s19)} moins les frais de garde (20) ${chf(-sum(care))}${NB}: ${chf(s21)}.`,
    ),
  );
  const netIncome3 = line(
    [netIncome2, ...medical],
    s23,
    `${FORM} p. 3 (Ziffer 23, Nettoeinkommen III)`,
    {
      ...t(
        'Net income III, federal tax (reddito netto intermedio III, 23)',
        'Revenu net III, impôt fédéral (reddito netto intermedio III, 23)',
      ),
      it: 'Reddito netto intermedio III (23), imposta federale diretta',
    },
    t(
      `${chf(s21)} less illness costs (22.1) ${chf(-sum(medical))}: ${chf(s23)}.`,
      `${chf(s21)} moins les frais de maladie (22.1) ${chf(-sum(medical))}${NB}: ${chf(s23)}.`,
    ),
  );
  const netIncome4 = line(
    [netIncome3, ...social],
    s26,
    `${FORM} p. 3 (Ziffer 26, Nettoeinkommen IV)`,
    {
      ...t(
        'Net income IV, federal tax (reddito netto, 26)',
        'Revenu net IV, impôt fédéral (reddito netto, 26)',
      ),
      it: 'Reddito netto (26), imposta federale diretta',
    },
    t(
      `${chf(s23)} less donations (24) and the federal child deduction (25.1) ${chf(-sum(social))}: ${chf(s26)}.`,
      `${chf(s23)} moins les dons (24) et la déduction fédérale pour enfants (25.1) ${chf(-sum(social))}${NB}: ${chf(s26)}.`,
    ),
  );
  const taxableIncome = line(
    [netIncome4],
    taxable,
    `${FORM} p. 3 (Ziffer 28, Steuerbares Einkommen Gesamt); ${TABLE} (27, imposta cantonale only)`,
    {
      ...t(
        'Taxable income, federal tax (reddito imponibile, 28)',
        'Revenu imposable, impôt fédéral (reddito imponibile, 28)',
      ),
      it: 'Reddito imponibile (28), imposta federale diretta',
    },
    t(
      `${chf(s26)}, no exemption for AVS and AI pensioners (27 is cantonal only), in whole francs, never below zero: ${chf(taxable)}.`,
      `${chf(s26)}, sans montant exonéré des bénéficiaires AVS et AI (27, cantonal seulement), en francs entiers, jamais négatif${NB}: ${chf(taxable)}.`,
    ),
  );
  return {
    grossIncome,
    totalDeductions,
    netIncome,
    netIncome2,
    netIncome3,
    netIncome4,
    taxableIncome,
  };
}

/**
 * The federal tax of a Ticino household, or null with why it is not computed. `persons` are the
 * people, sorted, each with their earned income lines (1.1, 1.2, 3.4, 3.5) and their 10.3.
 */
export function federalReturn(
  f: FederalInput,
  persons: readonly { input: PersonInput; earnings: readonly Item[]; buyIns: readonly Item[] }[],
): { ifd: TiIfdResult | null; notes: FederalNotes } {
  const notes = none();
  const { input, couple } = f;
  const y = input.taxYear;
  const F = ifdParamsFor(y);
  if (f.children.some((c) => !c.livesWithYou)) add(notes.unsupported, FEDERAL_NOTE.elsewhere);
  const full = f.children.filter((c) => c.weight === 1).length;
  const shared = f.children.filter((c) => c.weight === 0.5).length;
  const scale = federalScale({
    couple,
    full,
    shared,
    ...(input.ifdParentalScale !== undefined ? { parentalScale: input.ifdParentalScale } : {}),
  });
  for (const u of scale.unsupported) add(notes.unsupported, u);

  const items: Item[] = [...f.incomeItems];
  const figures = persons.map((p) =>
    federalPerson(F, y, p.input, p.earnings, p.buyIns, items, notes),
  );
  if (notes.unsupported.length) return { ifd: null, notes };
  const hh = input.household ?? {};

  // Private debt interest (LIFD art. 33 al. 1 let. a): up to the income from wealth plus 50,000.
  const diTrace = new Trace();
  const interest = francTotal(diTrace, [hh.debtInterest]);
  if (interest > 0) {
    const federal = debtInterest(F, interest, f.wealthIncome, diTrace);
    apply(notes, federal, 'household');
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // Buy-ins (10.3), the costs of keeping securities (13.1), alimony and child support paid (14.1,
  // 14.2): in full, as for the cantonal tax.
  items.push(...f.inFull);

  // Insurance premiums and savings interest (LIFD art. 33 al. 1 let. g, al. 1bis): what was paid,
  // at most the amount for spouses or for everyone else, plus so much per child (12).
  const hTrace = new Trace();
  const premiums = francTotal(hTrace, [hh.healthPremiums, hh.accidentPremiums]);
  const subTrace = new Trace();
  const subsidy = francTotal(subTrace, [hh.healthSubsidy]);
  const lifeTrace = new Trace();
  const life = francTotal(lifeTrace, [hh.lifeInsurancePremiums, hh.savingsInterest]);
  const insurance = insurancePremiums(F, {
    premiums,
    subsidy,
    life,
    couple,
    contributing: figures.some((x) => x.contributes),
    full,
    shared,
    inputs: [hTrace, lifeTrace, subTrace],
  });
  apply(notes, insurance, 'household');
  if (insurance.deduction) items.push(deductionItem(insurance.deduction, 'household'));

  // Political parties (LIFD art. 33 al. 1 let. i), 15.2.
  const pTrace = new Trace();
  const party = francTotal(pTrace, [hh.politicalParty]);
  if (party > 0) {
    const federal = politicalParty(F, party, pTrace);
    apply(notes, federal, 'household');
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // Both spouses earn (LIFD art. 33 al. 2): a share of the lower earned income (15.5).
  const [a, b] = figures;
  if (couple && a && b && a.earns && b.earns) {
    const low = a.earned <= b.earned ? a : b;
    if (low.earned > 0) {
      const federal = twoEarner(F, low.earned, low.lines);
      if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
    }
  }

  // The married couple deduction (LIFD art. 35 al. 1 let. c), which the canton's table lists among
  // the other deductions (15), for the federal tax only.
  if (couple) {
    const federal = marriedCouple(F);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // Childcare (LIFD art. 33 al. 3), 20: children under 14 living with you; spouses must both work.
  // The costs given for a child of 14 or more are left out (federalChildcare).
  const ccTrace = new Trace();
  const { care, older } = federalChildcare(f.children, undefined, ccTrace);
  if (older) add(notes.notCounted, IFD_NOTE.childcareAge);
  if (care > 0) {
    const eligible = couple ? figures.length === 2 && figures.every((x) => x.earns) : true;
    const counted = f.children.filter((c) => c.under14 !== false && (c.childcare?.value ?? 0) > 0);
    if (eligible && counted.length) {
      const federal = childcareCosts(F, care, counted.length, ccTrace);
      apply(notes, federal, 'household');
      if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
    } else if (!eligible) {
      add(
        notes.notCounted,
        t(
          'Childcare, federal tax: both spouses must work (or study) for it to be deducted.',
          `Frais de garde, impôt fédéral${NB}: les deux conjoints doivent travailler (ou être en formation) pour les déduire.`,
        ),
      );
    }
  }

  // Illness costs (22.1): above 5 % of 21 with the federal amounts (Modulo 6: "Franchigia fiscale:
  // 5% del reddito netto intermedio II").
  const LINE_21 = t(
    'of the net income II (21, federal tax)',
    'du revenu net II (reddito netto intermedio II, 21, impôt fédéral)',
  );
  const mTrace = new Trace();
  const medical = francTotal(mTrace, [hh.medicalCosts]);
  if (medical > 0) {
    const base = federalTotals(items).netIncome2;
    const r = medicalCosts(
      F.medicalThresholdBp,
      medical,
      { line: base, name: LINE_21 },
      mTrace,
      'IFD',
    );
    apply(notes, r, 'household');
    if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
  }

  // Donations (24): at most 20 % of 23 with the federal amounts (Modulo 5, Avvertenza: "sia per
  // l’imposta cantonale che federale diretta ... 20% del reddito netto intermedio III").
  const LINE_23 = t(
    'of the net income III (23, federal tax)',
    'du revenu net III (reddito netto intermedio III, 23, impôt fédéral)',
  );
  const gTrace = new Trace();
  const gifts = francTotal(gTrace, [hh.donations]);
  if (gifts > 0) {
    const base = federalTotals(items).netIncome3;
    const r = donations(F, gifts, { line: base, name: LINE_23 }, gTrace);
    apply(notes, r, 'household');
    if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
  }

  // The federal child deduction (LIFD art. 35 al. 1 let. a), one amount per child, on 25.1.
  if (f.children.length) {
    const federal = childDeduction(F, full, shared, f.childSources);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // In the order of the return (the sort is stable: the taxpayer before the spouse on a shared code).
  items.sort((x, z) => ORDER_IFD.indexOf(x.code) - ORDER_IFD.indexOf(z.code));
  const totals = federalTotals(items);
  const scaleSources = f.childSources.length
    ? [...f.childSources, `${CIRCULAR30} p. 23 (ch. 13.4.1)`]
    : [];
  const tax = ifdTax(F, totals.taxableIncome, scale.scale, scale.childReductions, scaleSources);
  return { ifd: { items, ...totals, ...tax }, notes };
}

export type { Line };
