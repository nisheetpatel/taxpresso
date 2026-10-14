// The federal direct tax (direkte Bundessteuer) on the Basel-Landschaft return: its Bundessteuer
// column (bl-2025-steuererklaerung-form p. 2 and 3, the same in bl-2026-steuererklaerung-form). The
// rules are the federal ones, the same in every canton (packages/rules-ch: each deduction keyed by
// concept, the scale, the tax); this file puts each concept on its Basel-Landschaft line. The income
// lines are the same in both columns (399 carried to both, 499); the deductions 500 to 738 take the
// federal amounts, the guide printing both columns side by side (bl-2026-wegleitung p. 25 to 39);
// the children (750) and the married couple (775) are social deductions of the federal column only.
//
// Medical costs and donations follow the guide's own computation (bl-2026-wegleitung p. 35 and 36;
// bl-na-steuerbuch p. 195, 29 Nr. 17): the Reineinkommen is the total income (499) less the
// deductions 500 to 735, the costs entered in full; the Selbstbehalt is that Reineinkommen x 5 : 95,
// which is 5 % of the net income after the medical deduction itself; donations are capped at 20 % of
// the Reineinkommen after it. The federal instructions take 5 % of the net income before it
// (ch-2026-ifd-instructions-personnes-physiques p. 8 and 9): the documents disagree, and the result
// says so (docs/sources/bl/NOTES.md, "Wiring Basel-Landschaft in the app").
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
  pillar3a,
  politicalParty,
  professionalCosts,
  roundTo,
  Trace,
  trainingCosts,
  twoEarner,
  type Deduction,
  type FederalConcept,
  type IfdParams,
  type LimitApplied,
  type RuleResult,
} from '@taxpresso/rules-ch';
import { sideJobFlat } from './rules.js';
import {
  DEDUCTIONS,
  FEDERAL_SOCIAL,
  INCOME,
  PERSON_CODES,
  RUBRICS,
  type RubricCode,
} from './rubrics.js';
import type {
  Amount,
  BlEngineInput,
  BlIfdResult,
  EmploymentInput,
  Item,
  ItemPerson,
  Line,
  PersonInput,
  Text,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';

/** The line of the federal column of each federal concept, for one person where it has two. */
function lineOf(concept: FederalConcept, person: ItemPerson): RubricCode {
  const p = person === 'p2' ? 'p2' : 'p1';
  switch (concept) {
    case 'pillar3a':
      return PERSON_CODES.pillar3a[p];
    case 'professional.flat':
    case 'professional.other':
      return PERSON_CODES.other[p];
    case 'commute':
      return PERSON_CODES.travel[p];
    case 'meals':
      return PERSON_CODES.meals[p];
    case 'training':
      return '650';
    case 'two_earner':
      return '680';
    case 'insurance':
      return '620';
    case 'debt_interest':
      return '555';
    case 'childcare':
      return '640';
    case 'married':
      return '775';
    case 'medical':
      return '720';
    case 'donations':
      return '738';
    case 'party':
      return '735';
    case 'child':
      return '750';
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
  input: BlEngineInput;
  couple: boolean;
  /** The income lines of the return (p. 2): the same in both columns. */
  incomeItems: readonly Item[];
  /** Deductions in full in both columns: buy-ins paid directly, alimony, child support, costs. */
  inFull: readonly Item[];
  /** The children the household counts for the federal tax. */
  children: readonly FederalChild[];
  /** Where the attribution of the children comes from, when separated parents' support decided it. */
  childSources: readonly string[];
  /** Line 300, the gross income from accounts and securities, for the debt interest limit. */
  wealthIncome: number;
}

const none = (): FederalNotes => ({ notCounted: [], unverified: [], unsupported: [], limits: [] });

function add(list: Text[], x: Text) {
  if (!list.some((y) => y.en === x.en)) list.push(x);
}

/** An item on its line, from a shared rule's deduction (the return's page as a source). */
function deductionItem(d: Deduction<FederalConcept>, person: ItemPerson, code?: RubricCode): Item {
  const c = code ?? lineOf(d.concept, person);
  const r = RUBRICS[c];
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
  sideJob2025: t(
    'Federal tax not computed: no 2025 document Taxpresso has gives the federal flat deduction of a side job (Auslagen bei Nebenerwerb, 530/535).',
    `Impôt fédéral non calculé${NB}: aucun document 2025 dont dispose Taxpresso ne donne la déduction forfaitaire fédérale d’une activité accessoire (Auslagen bei Nebenerwerb, 530/535).`,
  ),
  elsewhere: t(
    'Federal tax not computed: a child who does not live with you is not supported yet for the federal tax.',
    `Impôt fédéral non calculé${NB}: un enfant qui ne vit pas avec vous n’est pas encore pris en charge pour l’impôt fédéral.`,
  ),
  medicalShare: t(
    'Medical costs, federal tax (720): Basel-Landschaft’s guide and practice handbook take the threshold as the net income (Reineinkommen, 499 less 500 to 735 with the costs in full) x 5 : 95, which is 5 % of the net income after the deduction itself; the federal instructions (Form. 2a) take 5 % of the net income before it. Taxpresso follows Basel-Landschaft’s documents, which give a slightly larger deduction; the documents disagree.',
    `Frais de maladie, impôt fédéral (720)${NB}: le guide et le manuel de pratique de Bâle-Campagne calculent le seuil comme le revenu net (Reineinkommen, 499 moins 500 à 735 avec les frais en entier) x 5 : 95, soit 5${NB}% du revenu net après la déduction elle-même${NB}; les instructions fédérales (formule 2a) prennent 5${NB}% du revenu net avant elle. Taxpresso suit les documents de Bâle-Campagne, qui donnent une déduction un peu plus élevée${NB}; les documents divergent.`,
  ),
} as const satisfies Record<string, Text>;

/** The documents of Basel-Landschaft's computation of the medical threshold and the donations cap. */
const MEDICAL_SOURCES = (y: number) =>
  `bl-${y}-wegleitung p. 35 (720, Bundessteuer: Berechnung Reineinkommen und Selbstbehalt); bl-na-steuerbuch p. 195 (29 Nr. 17, Ziffer 3); bl-2025-krankheitskosten p. 1 and 2`;
const DONATION_SOURCES = (y: number) =>
  `bl-${y}-wegleitung p. 36 (738, Bundessteuer: 20 % des Reineinkommens gemäss Berechnung in Ziffer 720)`;

interface FederalPerson {
  id: 'p1' | 'p2';
  /** Net salaries and allowances less the federal professional costs, 3a and buy-ins (680). */
  earned: number;
  earns: boolean;
  contributes: boolean;
  lines: Item[];
  /** The federal training deduction of this person, for 650 (the couple's sum). */
  training?: Deduction<FederalConcept>;
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
 * One person's federal deductions: travel (500/505), meals (510/515), the flat 3 % or the actual
 * other costs (520/525), a side job (530/535), pillar 3a (610/615) and training (for 650).
 * `earnings`: the person's income lines that count as earned (100 to 115, 260/270).
 */
function federalPerson(
  F: IfdParams,
  taxYear: number,
  p: PersonInput,
  earnings: readonly Item[],
  items: Item[],
  notes: FederalNotes,
): FederalPerson {
  const start = items.length;
  const main = (p.employments ?? []).filter((e) => !e.side);
  const side = (p.employments ?? []).filter((e) => e.side);
  const m = salaryOf(main);
  const s = salaryOf(side);
  const bTrace = new Trace();
  const buyIn = francTotal(bTrace, [
    ...[...main, ...side].map((e) => e.pensionBuyIn),
    p.pensionBuyIn,
  ]);
  // Member of a pension fund: as the other cantons' federal columns read it, the answer, else box
  // 10.1 on a certificate (the state tax also counts a buy-in taken from the salary, box 10.2).
  const hasFund = p.hasPensionFund ?? m.fund + s.fund > 0;

  // Pillar 3a and its catch-up: the federal limits (OPP 3 art. 7), as in the state tax.
  const p3a = pillar3a(F, {
    ...(p.pillar3a ? { paid: p.pillar3a } : {}),
    ...(p.pillar3aCatchUp && taxYear !== 2025 ? { catchUp: p.pillar3aCatchUp } : {}),
    hasFund,
    gross: m.gross + s.gross,
    social: m.social + s.social,
    self: 0,
    earnedFrom: [m.traces[0], m.traces[1], s.traces[0], s.traces[1]],
  });
  apply(notes, p3a, p.id);
  if (p3a.deduction) items.push(deductionItem(p3a.deduction, p.id));

  // Professional costs of the main job (LIFD art. 26): travel (500/505) and meals (510/515) on their
  // own lines, the flat 3 % or the actual other costs on 520/525 (bl-2026-wegleitung p. 25 to 28).
  if (main.length && m.gross > 0) {
    const net = m.gross - m.social - m.fund;
    const costTrace = new Trace();
    const way = commuteBase(F, p, costTrace);
    const other = francTotal(costTrace, [p.otherProfessionalCosts]);
    const freeTransport = main.every((e) => e.freeTransport === true);
    if (!freeTransport && way && way.cost > 0) {
      const travel = commuteCosts(F, p, way, costTrace);
      apply(notes, travel, p.id);
      if (travel.deduction) items.push(deductionItem(travel.deduction, p.id));
    }
    const home = p.commuteMode?.by === 'home';
    const meals = mealsCosts(F.meals, {
      days: home ? 0 : (p.mealDays ?? 0),
      canteen: main.some((e) => e.canteen === true),
      ...(p.mealFacts ? { facts: p.mealFacts } : {}),
    });
    apply(notes, meals, p.id);
    if (meals.deduction) items.push(deductionItem(meals.deduction, p.id));
    const prof = professionalCosts(F, net, other, [...m.traces], costTrace);
    apply(notes, prof, p.id);
    if (prof.deduction) items.push(deductionItem(prof.deduction, p.id));
  }

  // A side job (530/535): the federal flat, a share of its net salary between a minimum and a
  // maximum, never more than that salary. No 2025 document gives its rate: fail closed.
  if (side.length && s.gross > 0) {
    const flat = ifdSideJobFlat(taxYear);
    if (!flat) {
      add(notes.unsupported, FEDERAL_NOTE.sideJob2025);
    } else {
      const tr = new Trace().with(...s.traces);
      const sp = tr.p(flat);
      const net = Math.max(0, s.gross - s.social - s.fund);
      const ded = Math.min(sideJobFlat(net, sp), net);
      if (ded > 0) {
        const code = PERSON_CODES.sideCosts[p.id];
        const r = RUBRICS[code];
        tr.src(r.source);
        items.push({
          code,
          person: p.id,
          ...tr.line(
            -ded,
            r.label,
            t(
              `20 % of the side job's salary after social and pension fund contributions (${chf(net)}), at least ${chf(sp.min)}, at most ${chf(sp.max)}, never more than that salary: ${chf(ded)}.`,
              `20${NB}% du salaire de l’activité accessoire après cotisations AVS et 2e pilier (${chf(net)}), au moins ${chf(sp.min)}, au plus ${chf(sp.max)}, jamais plus que ce salaire${NB}: ${chf(ded)}.`,
            ),
          ),
        });
      }
    }
  }

  // Professional training (LIFD art. 33 al. 1 let. j), per person; 650 is the couple's sum.
  const trTrace = new Trace();
  const paidTraining = francTotal(trTrace, [p.trainingCosts]);
  let training: Deduction<FederalConcept> | undefined;
  if (paidTraining > 0) {
    const federal = trainingCosts(F, paidTraining, trTrace);
    apply(notes, federal, p.id, '650');
    training = federal.deduction;
  }

  const lines = items.slice(start);
  const own = (codes: readonly string[]) =>
    lines.filter((i) => codes.includes(i.code)).reduce((sum, i) => sum + i.amount, 0);
  const earnedIncome = earnings.reduce((sum, i) => sum + i.amount, 0);
  // Earned income after its professional costs, 3a and buy-ins (LIFD art. 33 al. 2; the guide
  // counts the allowances of 260/270 as earned, bl-2026-wegleitung p. 34): 100/105 is already net
  // of the buy-ins taken from the salary (box 10.2); those paid directly come off here.
  const direct = francTotal(new Trace(), [p.pensionBuyIn]);
  const c = (k: keyof typeof PERSON_CODES) => PERSON_CODES[k][p.id];
  const earned =
    earnedIncome +
    own([c('travel'), c('meals'), c('other'), c('sideCosts'), c('pillar3a')]) -
    direct;
  return {
    id: p.id,
    earned,
    earns: earnedIncome > 0,
    contributes: hasFund || m.fund + s.fund > 0 || buyIn > 0 || p3a.paid > 0,
    lines: [...earnings, ...lines],
    ...(training ? { training } : {}),
  };
}

const sum = (items: readonly Item[]) => items.reduce((s, i) => s + i.amount, 0);
const francs = (centimes: number) => Math.floor(centimes / 100) * 100;

/** The totals of the Bundessteuer column, in the return's order (p. 2 and 3). */
export function federalTotals(items: readonly Item[], taxYear: number) {
  const form = `bl-${taxYear === 2025 ? 2025 : 2026}-steuererklaerung-form`;
  const income = items.filter((i) => INCOME.has(i.code));
  const deductions = items.filter((i) => DEDUCTIONS.has(i.code));
  const social = items.filter((i) => FEDERAL_SOCIAL.has(i.code));
  const gross = sum(income);
  const ded = sum(deductions);
  const net = gross + ded;
  const all = ded + sum(social);
  const taxable = Math.max(0, francs(gross + all));
  const grossIncome = new Trace()
    .src(`${form} p. 2 (499 Total der Einkünfte, Bundessteuer)`)
    .from(...income)
    .line(
      gross,
      {
        ...t(
          'Total income, federal tax (Total der Einkünfte, 499)',
          'Total des revenus, impôt fédéral (Total der Einkünfte, 499)',
        ),
        de: 'Total der Einkünfte (499), Bundessteuer',
      },
      t(
        `The ${income.length} income lines added up, the same as for the state tax: ${chf(gross)}.`,
        `Les ${income.length} lignes de revenu additionnées, comme pour l’impôt cantonal${NB}: ${chf(gross)}.`,
      ),
    );
  const netIncome = new Trace()
    .src(`${form} p. 3 (500 to 738, Bundessteuer)`)
    .from(grossIncome, ...deductions)
    .line(
      net,
      t(
        'Income after the deductions, before the social deductions, federal tax',
        'Revenu après les déductions, avant les déductions sociales, impôt fédéral',
      ),
      t(
        `Total income less the federal deductions 500 to 738 (${chf(-ded)}): ${chf(net)}.`,
        `Total des revenus moins les déductions fédérales 500 à 738 (${chf(-ded)})${NB}: ${chf(net)}.`,
      ),
    );
  const totalDeductions = new Trace()
    .src(`${form} p. 3 (789 Total der Abzüge, Bundessteuer)`)
    .from(...deductions, ...social)
    .line(
      -all,
      {
        ...t(
          'Total deductions, federal tax (Total der Abzüge, 789)',
          'Total des déductions, impôt fédéral (Total der Abzüge, 789)',
        ),
        de: 'Total der Abzüge (789), Bundessteuer',
      },
      t(
        `The federal deductions 500 to 775 added up: ${chf(-all)}.`,
        `Les déductions fédérales 500 à 775 additionnées${NB}: ${chf(-all)}.`,
      ),
    );
  const taxableIncome = new Trace()
    .src(`${form} p. 3 (790 steuerbares Einkommen, Bundessteuer)`)
    .from(grossIncome, totalDeductions)
    .line(
      taxable,
      {
        ...t(
          'Taxable income, federal tax (steuerbares Einkommen, 790)',
          'Revenu imposable, impôt fédéral (steuerbares Einkommen, 790)',
        ),
        de: 'Steuerbares Einkommen (790), Bundessteuer',
      },
      t(
        `${chf(gross)} less ${chf(-all)}, in whole francs, never below zero: ${chf(taxable)}.`,
        `${chf(gross)} moins ${chf(-all)}, en francs entiers, jamais négatif${NB}: ${chf(taxable)}.`,
      ),
    );
  return { grossIncome, netIncome, totalDeductions, taxableIncome };
}

/**
 * Medical costs, federal tax (720), as Basel-Landschaft computes them: the Selbstbehalt is the
 * Reineinkommen with the costs in full, x 5 : 95, to the franc; what is above it is deducted.
 * `beforeMedical`: the total income less the deductions 500 to 735 other than 720.
 */
function medicalItem(
  F: IfdParams,
  taxYear: number,
  costs: number,
  beforeMedical: number,
  tr: Trace,
  notes: FederalNotes,
): Item | undefined {
  tr.src(MEDICAL_SOURCES(taxYear));
  const bp = tr.p(F.medicalThresholdBp);
  // Reineinkommen x 5 : 95, the share of the federal threshold (5 %) of what is left after it.
  const base = Math.max(0, beforeMedical - costs);
  const threshold = roundTo(base * bp, 10_000 - bp, 100);
  const v = Math.max(0, costs - threshold);
  notes.limits.push({
    code: '720',
    person: 'household',
    tax: 'ifd',
    kind: 'threshold',
    given: costs,
    limit: threshold,
    counted: v,
    source: `${F.medicalThresholdBp.source}; ${MEDICAL_SOURCES(taxYear)}`,
    rule: 'medical',
  });
  add(notes.unverified, FEDERAL_NOTE.medicalShare);
  if (!v) {
    add(
      notes.notCounted,
      t(
        'Medical costs (federal tax): below the threshold (Selbstbehalt), nothing to deduct.',
        `Frais de maladie (impôt fédéral)${NB}: sous la franchise (Selbstbehalt), rien à déduire.`,
      ),
    );
    return undefined;
  }
  const r = RUBRICS['720'];
  tr.src(r.source);
  return {
    code: '720',
    person: 'household',
    ...tr.line(
      -v,
      r.label,
      t(
        `Costs ${chf(costs)}; Selbstbehalt: the net income with the costs in full (${chf(base)}) x 5 : 95, to the franc, ${chf(threshold)}, which is 5 % of the net income after this deduction: ${chf(v)}.`,
        `Frais ${chf(costs)}${NB}; franchise (Selbstbehalt)${NB}: le revenu net avec les frais en entier (${chf(base)}) x 5 : 95, au franc, ${chf(threshold)}, soit 5${NB}% du revenu net après cette déduction${NB}: ${chf(v)}.`,
      ),
    ),
  };
}

/**
 * The federal tax of a Basel-Landschaft household, or null with why it is not computed. `persons`
 * are the people, sorted, each with their earned income lines (100 to 115, 260/270).
 */
export function federalReturn(
  f: FederalInput,
  persons: readonly { input: PersonInput; earnings: readonly Item[] }[],
): { ifd: BlIfdResult | null; notes: FederalNotes } {
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
  const figures = persons.map((p) => federalPerson(F, y, p.input, p.earnings, items, notes));
  if (notes.unsupported.length) return { ifd: null, notes };
  const hh = input.household ?? {};

  // Insurance premiums and savings interest (LIFD art. 33 al. 1 let. g, al. 1bis): what was paid,
  // at most the amount for spouses (620) or for everyone else (625), plus so much per child (630).
  const hTrace = new Trace();
  const premiums = francTotal(hTrace, [hh.healthPremiums, hh.accidentPremiums]);
  const subTrace = new Trace();
  const subsidy = francTotal(subTrace, [hh.healthSubsidy]);
  const lifeTrace = new Trace();
  const life = francTotal(lifeTrace, [hh.lifeInsurancePremiums, hh.savingsInterest]);
  const contributing = figures.some((x) => x.contributes);
  const insurance = insurancePremiums(F, {
    premiums,
    subsidy,
    life,
    couple,
    contributing,
    full,
    shared,
    inputs: [hTrace, lifeTrace, subTrace],
  });
  const adultsCode: RubricCode = couple ? '620' : '625';
  apply(notes, insurance, 'household', adultsCode);
  if (insurance.deduction) {
    // The adults' maximum on 620/625, the rest (the children's part) on 630.
    const ins = F.insurance.value;
    const adults = couple
      ? contributing
        ? ins.married
        : ins.marriedNone
      : contributing
        ? ins.other
        : ins.otherNone;
    const counted = -insurance.deduction.amount;
    const first = Math.min(counted, adults);
    const rest = counted - first;
    const own = deductionItem(insurance.deduction, 'household', adultsCode);
    items.push({ ...own, amount: -first });
    if (rest > 0) {
      const r = RUBRICS['630'];
      const tr = new Trace().with(insurance.deduction.trace).src(r.source);
      items.push({
        code: '630',
        person: 'household',
        ...tr.line(
          -rest,
          r.label,
          t(
            `Of the federal deduction for premiums and savings interest (${chf(counted)}), the part above the adults’ maximum (${chf(adults)}), for the children: ${chf(rest)}.`,
            `De la déduction fédérale pour primes et intérêts d’épargne (${chf(counted)}), la part au-delà du maximum des adultes (${chf(adults)}), pour les enfants${NB}: ${chf(rest)}.`,
          ),
        ),
      });
    }
  }

  // Buy-ins paid directly (600/605), alimony (570), child support (575) and the costs of keeping
  // securities (655): in full, as in the state tax.
  items.push(...f.inFull);

  // Private debt interest (LIFD art. 33 al. 1 let. a).
  const diTrace = new Trace();
  const interest = francTotal(diTrace, [hh.debtInterest]);
  if (interest > 0) {
    const federal = debtInterest(F, interest, f.wealthIncome, diTrace);
    apply(notes, federal, 'household');
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // Childcare (LIFD art. 33 al. 3): children under 14 living with you; spouses must both work.
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

  // Professional training (650): each person's federal deduction, added up as the form does.
  const trained = figures.filter((x) => x.training);
  if (trained.length) {
    const r = RUBRICS['650'];
    const tr = new Trace().with(...trained.map((x) => x.training!.trace)).src(r.source);
    const amount = trained.reduce((s, x) => s + x.training!.amount, 0);
    items.push({
      code: '650',
      person: 'household',
      ...tr.line(
        amount,
        r.label,
        t(
          trained.map((x) => x.training!.how.en).join(' '),
          trained.map((x) => x.training!.how.fr).join(' '),
        ),
      ),
    });
  }

  // Both spouses earn (LIFD art. 33 al. 2): the spouse who earns less.
  const [a, b] = figures;
  if (couple && a && b && a.earns && b.earns) {
    const low = a.earned <= b.earned ? a : b;
    if (low.earned > 0) {
      const federal = twoEarner(F, low.earned, low.lines);
      if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
    }
  }

  // Political parties (LIFD art. 33 al. 1 let. i), within 500 to 735.
  const pTrace = new Trace();
  const party = francTotal(pTrace, [hh.politicalParty]);
  if (party > 0) {
    const federal = politicalParty(F, party, pTrace);
    apply(notes, federal, 'household');
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // Medical costs (720), then donations (738) on the Reineinkommen after them.
  const mTrace = new Trace();
  const medical = francTotal(mTrace, [hh.medicalCosts]);
  if (medical > 0) {
    const before = federalTotals(items, y).netIncome;
    mTrace.from(before);
    const item = medicalItem(F, y, medical, before.amount, mTrace, notes);
    if (item) items.push(item);
  }
  const gTrace = new Trace();
  const gifts = francTotal(gTrace, [hh.donations]);
  if (gifts > 0) {
    const before = federalTotals(items, y).netIncome;
    const base = new Trace()
      .src(DONATION_SOURCES(y))
      .from(before)
      .line(
        before.amount,
        t('Net income (Reineinkommen)', 'Revenu net (Reineinkommen)'),
        t(
          'The total income less the federal deductions 500 to 735.',
          'Le total des revenus moins les déductions fédérales 500 à 735.',
        ),
      );
    const r = donations(
      F,
      gifts,
      {
        line: base,
        name: t('of the net income (Reineinkommen)', 'du revenu net (Reineinkommen)'),
      },
      gTrace,
    );
    apply(notes, r, 'household');
    if (r.deduction) {
      r.deduction.trace.src(DONATION_SOURCES(y));
      items.push(deductionItem(r.deduction, 'household'));
    }
  }

  // Social deductions of the federal column: the children (750) and married couples (775).
  if (f.children.length) {
    const federal = childDeduction(F, full, shared, f.childSources);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }
  if (couple) {
    const federal = marriedCouple(F);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // In the order of the codes (the sort is stable: person 1 before person 2 on a shared code).
  items.sort((x, z) => x.code.localeCompare(z.code));
  const totals = federalTotals(items, y);
  const scaleSources = f.childSources.length
    ? [...f.childSources, `${CIRCULAR30} p. 23 (ch. 13.4.1)`]
    : [];
  const tax = ifdTax(F, totals.taxableIncome, scale.scale, scale.childReductions, scaleSources);
  return { ifd: { items, ...totals, ...tax }, notes };
}

export type { Line };
