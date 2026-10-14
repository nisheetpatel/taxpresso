// The federal direct tax (direkte Bundessteuer) of a St. Gallen household. The return has one
// column: "Die Steuererklärung 2025 dient gleichzeitig als Grundlage für die Veranlagung der direkten
// Bundessteuer", and where the federal tax differs "werden die erforderlichen Anpassungen durch die
// Steuerbehörde automatisch vorgenommen" (sg-2025-guide-wegleitung p. 49); Merkblatt 32 lists the
// differences on the return's own Ziffern (sg-2025-guide-merkblatt-dbst p. 1). So this file computes
// the federal tax on the return's own lines: the income lines as they are (one income page), the
// federal amounts of the deductions on the same lines (Form 4 per person, 11 to 17), the
// Nettoeinkommen (20.) as the base of the illness costs (21.1, 5 % of it) and of the donations (21.3,
// at most 20 % of it), as the federal instructions also take both (ch-2026-ifd-instructions-
// personnes-physiques p. 9: "revenu net selon chiffre 20"), the Reineinkommen (22.), then the federal
// social deductions, which the return has no line for (the children, one amount each; the married
// couple deduction), down to the taxable income (24.).
//
// The rules are the federal ones, the same in every canton (packages/rules-ch: each deduction keyed
// by concept, the scale, the tax); this file puts each concept on its St. Gallen line.
import {
  chf,
  childcareCosts,
  childDeduction,
  commuteBase,
  commuteCosts,
  debtInterest,
  donations,
  federalScale,
  francTotal,
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
  Trace,
  trainingCosts,
  twoEarner,
  type Deduction,
  type FederalConcept,
  type IfdParams,
  type LimitApplied,
  type RuleResult,
} from '@taxpresso/rules-ch';
import {
  DEDUCTIONS,
  FEDERAL_SOCIAL,
  federalRubric,
  INCOME,
  NET_DEDUCTIONS,
  ORDER,
  PERSON_CODES,
} from './rubrics.js';
import { sideJobFlat } from './rules.js';
import type {
  Amount,
  EmploymentInput,
  Item,
  ItemPerson,
  Line,
  PersonInput,
  SgEngineInput,
  SgIfdResult,
  Text,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';
const FORM = 'sg-2025-form-steuererklaerung';
const MB32 = 'sg-2025-guide-merkblatt-dbst p. 1';
/** The order of the federal lines: the return's, then the federal social deductions. */
const ORDER_IFD: readonly string[] = [...ORDER, '23.1-23.3', 'Ehepaare'];

/** The line of each federal concept, for one person where it has two. */
function lineOf(concept: FederalConcept, person: ItemPerson): string {
  const p = person === 'p2' ? 'p2' : 'p1';
  switch (concept) {
    case 'pillar3a':
      return PERSON_CODES.pillar3a[p];
    case 'commute':
      return PERSON_CODES.travel[p];
    case 'meals':
      return PERSON_CODES.meals[p];
    case 'professional.flat':
      return PERSON_CODES.otherFlat[p];
    case 'professional.other':
      return PERSON_CODES.otherActual[p];
    case 'training':
      return PERSON_CODES.training[p];
    case 'two_earner':
      return '226';
    case 'insurance':
      return '600';
    case 'debt_interest':
      return '500';
    case 'childcare':
      return '258';
    case 'married':
      return 'Ehepaare';
    case 'medical':
      return '240';
    case 'donations':
      return '244';
    case 'party':
      return '555';
    case 'child':
      return '23.1-23.3';
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
  input: SgEngineInput;
  couple: boolean;
  /** The income lines of the return (page 2): the same for both taxes. */
  incomeItems: readonly Item[];
  /**
   * Deductions in full for both taxes: alimony and child support paid (12.1, 12.2), pension fund
   * buy-ins (13.2) and the costs of managing securities (16.1).
   */
  inFull: readonly Item[];
  /** The children the household counts for the federal tax. */
  children: readonly FederalChild[];
  /** Where the attribution of the children comes from, when separated parents' support decided it. */
  childSources: readonly string[];
  /** Line 146, the gross income from accounts and securities, for the debt interest limit. */
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
  sideJob2025: t(
    'Federal tax not computed: no 2025 federal document Taxpresso has gives the federal flat deduction of a side job (Nebenerwerb, Form 4, 5.1).',
    `Impôt fédéral non calculé${NB}: aucun document fédéral 2025 dont dispose Taxpresso ne donne la déduction forfaitaire fédérale d’une activité accessoire (Nebenerwerb, formulaire 4, 5.1).`,
  ),
  elsewhere: t(
    'Federal tax not computed: a child who does not live with you is not supported yet for the federal tax.',
    `Impôt fédéral non calculé${NB}: un enfant qui ne vit pas avec vous n’est pas encore pris en charge pour l’impôt fédéral.`,
  ),
} as const satisfies Record<string, Text>;

interface FederalPerson {
  id: 'p1' | 'p2';
  /** Earned income less its federal professional costs, 3a and buy-ins (17.). */
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
 * One person's federal deductions on Form 4 and the return: pillar 3a (13.1), travel (Form 4, 1.),
 * meals (2.1, or 2.2 with a canteen), the flat 3 % or the actual other costs (3.1 or 3.2), a side
 * job's flat (5.1) and training (16.4). `earnings`: the person's earned income lines (1.1, 1.2,
 * 3.3, 3.4).
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
  const all = p.employments ?? [];
  // A side job needs a main job (sg-2025-guide-wegleitung p. 25), as in the cantonal column.
  const hasMain = all.some((e) => !e.side);
  const main = hasMain ? all.filter((e) => !e.side) : all;
  const side = hasMain ? all.filter((e) => e.side) : [];
  const m = salaryOf(main);
  const s = salaryOf(side);
  const bTrace = new Trace();
  const buyIn = francTotal(bTrace, [...all.map((e) => e.pensionBuyIn), p.pensionBuyIn]);
  // Member of a pension fund: the answer, else box 10.1 on a certificate.
  const hasFund = p.hasPensionFund ?? m.fund + s.fund > 0;

  // Pillar 3a and its catch-up: the federal limits (OPP 3 art. 7), as in the cantonal column.
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

  // Professional costs of the main job (LIFD art. 26), each on its line of Form 4: travel, meals,
  // the flat 3 % or the actual other costs.
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
    const canteen = main.some((e) => e.canteen === true);
    const mealsCode = canteen ? PERSON_CODES.mealsHalf[p.id] : PERSON_CODES.meals[p.id];
    const meals = mealsCosts(F.meals, {
      days: home ? 0 : (p.mealDays ?? 0),
      canteen,
      ...(p.mealFacts ? { facts: p.mealFacts } : {}),
    });
    apply(notes, meals, p.id, mealsCode);
    if (meals.deduction) items.push(deductionItem(meals.deduction, p.id, mealsCode));
    const prof = professionalCosts(F, net, other, [...m.traces], costTrace);
    apply(notes, prof, p.id);
    if (prof.deduction) items.push(deductionItem(prof.deduction, p.id));
  }
  // A side job (Form 4, 5.1): the federal flat, a share of its net salary between a minimum and a
  // maximum, never more than that salary. No 2025 federal document gives its rate: fail closed.
  if (side.length && s.gross > 0) {
    const flat = ifdSideJobFlat(taxYear);
    if (!flat) {
      add(notes.unsupported, FEDERAL_NOTE.sideJob2025);
    } else {
      const tr = new Trace().with(...s.traces);
      const sp = tr.p(flat);
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
            PERSON_CODES.sideCosts[p.id],
          ),
        );
      }
    }
  }

  // Professional training (LIFD art. 33 al. 1 let. j), per person (16.4).
  const trTrace = new Trace();
  const paidTraining = francTotal(trTrace, [p.trainingCosts]);
  if (paidTraining > 0) {
    const federal = trainingCosts(F, paidTraining, trTrace);
    apply(notes, federal, p.id);
    if (federal.deduction) items.push(deductionItem(federal.deduction, p.id));
  }

  const lines = items.slice(start);
  const costs = new Set<string>([
    PERSON_CODES.travel[p.id],
    PERSON_CODES.meals[p.id],
    PERSON_CODES.mealsHalf[p.id],
    PERSON_CODES.otherFlat[p.id],
    PERSON_CODES.otherActual[p.id],
    PERSON_CODES.sideCosts[p.id],
    PERSON_CODES.pillar3a[p.id],
  ]);
  const own = lines.filter((i) => costs.has(i.code)).reduce((sum, i) => sum + i.amount, 0);
  const earnedIncome = earnings.reduce((sum, i) => sum + i.amount, 0);
  // Earned income after its professional costs, 3a and buy-ins (LIFD art. 33 al. 2): 1.1 is
  // already net of the buy-ins taken from the salary (box 10.2); those paid directly come off here.
  const direct = francTotal(new Trace(), [p.pensionBuyIn]);
  return {
    id: p.id,
    earned: earnedIncome + own - direct,
    earns: earnedIncome > 0,
    contributes: hasFund || m.fund + s.fund > 0 || buyIn > 0 || p3a.paid > 0,
    lines: [...earnings, ...lines],
  };
}

const sum = (items: readonly Item[]) => items.reduce((s, i) => s + i.amount, 0);
const francs = (centimes: number) => Math.floor(Math.max(0, centimes) / 100) * 100;

/** The totals of the federal tax, on the return's Ziffern 7, 18, 20, 22 and 24. */
export function federalTotals(items: readonly Item[]) {
  const income = items.filter((i) => INCOME.has(i.code));
  const deductions = items.filter((i) => DEDUCTIONS.has(i.code));
  const further = items.filter((i) => NET_DEDUCTIONS.has(i.code));
  const social = items.filter((i) => FEDERAL_SOCIAL.has(i.code));
  const gross = sum(income);
  const ded = sum(deductions);
  const s20 = gross + ded;
  const net = s20 + sum(further);
  const taxable = francs(net + sum(social));
  const grossIncome = new Trace()
    .src(`${FORM} p. 2 (Ziffer 7, 168 Total der Einkünfte)`)
    .from(...income)
    .line(
      gross,
      {
        ...t(
          'Total income, federal tax (Total der Einkünfte, 7.)',
          'Total des revenus, impôt fédéral (Total der Einkünfte, 7.)',
        ),
        de: '7. Total der Einkünfte, direkte Bundessteuer',
      },
      t(
        `The ${income.length} income lines added up, the same as for the cantonal tax: ${chf(gross)}.`,
        `Les ${income.length} lignes de revenu additionnées, comme pour l’impôt cantonal${NB}: ${chf(gross)}.`,
      ),
    );
  const totalDeductions = new Trace()
    .src(`${FORM} p. 3 (Ziffer 18, 230 Total der Abzüge)`, MB32)
    .from(...deductions)
    .line(
      -ded,
      {
        ...t(
          'Total deductions, federal tax (Total der Abzüge, 18.)',
          'Total des déductions, impôt fédéral (Total der Abzüge, 18.)',
        ),
        de: '18. Total der Abzüge, direkte Bundessteuer',
      },
      t(
        `The deductions 10 to 17 with the federal amounts, added up: ${chf(-ded)}.`,
        `Les déductions 10 à 17 aux montants fédéraux, additionnées${NB}: ${chf(-ded)}.`,
      ),
    );
  const netIncomeBase = new Trace()
    .src(`${FORM} p. 3 (Ziffer 20, 234 Nettoeinkommen)`)
    .from(grossIncome, totalDeductions)
    .line(
      s20,
      {
        ...t(
          'Net income, federal tax (Nettoeinkommen, 20.)',
          'Revenu net, impôt fédéral (Nettoeinkommen, 20.)',
        ),
        de: '20. Nettoeinkommen, direkte Bundessteuer',
      },
      t(
        `${chf(gross)} less ${chf(-ded)}: ${chf(s20)}.`,
        `${chf(gross)} moins ${chf(-ded)}${NB}: ${chf(s20)}.`,
      ),
    );
  const netIncome = new Trace()
    .src(`${FORM} p. 3 (Ziffer 22, 248 Reineinkommen)`)
    .from(netIncomeBase, ...further)
    .line(
      net,
      {
        ...t(
          'Income after the deductions, federal tax (Reineinkommen, 22.)',
          'Revenu après les déductions, impôt fédéral (Reineinkommen, 22.)',
        ),
        de: '22. Reineinkommen, direkte Bundessteuer',
      },
      t(
        `${chf(s20)} less illness costs and donations (${chf(-sum(further))}): ${chf(net)}.`,
        `${chf(s20)} moins frais de maladie et dons (${chf(-sum(further))})${NB}: ${chf(net)}.`,
      ),
    );
  const taxableIncome = new Trace()
    .src(`${FORM} p. 3 (Ziffer 24, 268 Steuerbares Einkommen gesamt)`, MB32)
    .from(netIncome, ...social)
    .line(
      taxable,
      {
        ...t(
          'Taxable income, federal tax (steuerbares Einkommen, 24.)',
          'Revenu imposable, impôt fédéral (steuerbares Einkommen, 24.)',
        ),
        de: '24. Steuerbares Einkommen, direkte Bundessteuer',
      },
      t(
        `${chf(net)} less the federal child and married couple deductions (${chf(-sum(social))}), in whole francs, never below zero: ${chf(taxable)}.`,
        `${chf(net)} moins les déductions fédérales pour enfants et pour couple marié (${chf(-sum(social))}), en francs entiers, jamais négatif${NB}: ${chf(taxable)}.`,
      ),
    );
  return { grossIncome, totalDeductions, netIncomeBase, netIncome, taxableIncome };
}

/** The base of the illness costs and donations shares: the Nettoeinkommen, 20., federal amounts. */
const LINE_20 = t(
  'of the Nettoeinkommen (20., federal tax)',
  'du revenu net (Nettoeinkommen, 20., impôt fédéral)',
);

/**
 * The federal tax of a St. Gallen household, or null with why it is not computed. `persons` are the
 * people, sorted, each with their earned income lines (1.1, 1.2, 3.3, 3.4).
 */
export function federalReturn(
  f: FederalInput,
  persons: readonly { input: PersonInput; earnings: readonly Item[] }[],
): { ifd: SgIfdResult | null; notes: FederalNotes } {
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

  // Private debt interest (LIFD art. 33 al. 1 let. a): up to the income from wealth plus 50,000.
  const diTrace = new Trace();
  const interest = francTotal(diTrace, [hh.debtInterest]);
  if (interest > 0) {
    const federal = debtInterest(F, interest, f.wealthIncome, diTrace);
    apply(notes, federal, 'household');
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // Alimony and child support paid (12.1, 12.2), buy-ins (13.2) and the costs of managing
  // securities (16.1): in full, as for the cantonal tax.
  items.push(...f.inFull);

  // Insurance premiums and savings interest (LIFD art. 33 al. 1 let. g, al. 1bis): what was paid,
  // at most the amount for spouses or for everyone else, plus so much per child (14.).
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

  // Childcare (LIFD art. 33 al. 3): children under 14 living with you; spouses must both work.
  const ccTrace = new Trace();
  const care = francTotal(
    ccTrace,
    f.children.map((c) => c.childcare),
  );
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

  // Political parties (LIFD art. 33 al. 1 let. i).
  const pTrace = new Trace();
  const party = francTotal(pTrace, [hh.politicalParty]);
  if (party > 0) {
    const federal = politicalParty(F, party, pTrace);
    apply(notes, federal, 'household');
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // Both spouses earn (LIFD art. 33 al. 2): a share of the lower earned income (17.).
  const [a, b] = figures;
  if (couple && a && b && a.earns && b.earns) {
    const low = a.earned <= b.earned ? a : b;
    if (low.earned > 0) {
      const federal = twoEarner(F, low.earned, low.lines);
      if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
    }
  }

  // Illness costs (21.1) and donations (21.3), both on the Nettoeinkommen (20.) with the federal
  // amounts (Merkblatt 32: "Selbstbehalt 5% der Nettoeinkünfte"; the federal instructions, p. 9).
  const s20 = federalTotals(items).netIncomeBase;
  const mTrace = new Trace();
  const medical = francTotal(mTrace, [hh.medicalCosts]);
  if (medical > 0) {
    const r = medicalCosts(
      F.medicalThresholdBp,
      medical,
      { line: s20, name: LINE_20 },
      mTrace,
      'IFD',
    );
    apply(notes, r, 'household');
    if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
  }
  const gTrace = new Trace();
  const gifts = francTotal(gTrace, [hh.donations]);
  if (gifts > 0) {
    const r = donations(F, gifts, { line: s20, name: LINE_20 }, gTrace);
    apply(notes, r, 'household');
    if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
  }

  // The federal social deductions (Merkblatt 32): the children, one amount each, and married couples.
  if (f.children.length) {
    const federal = childDeduction(F, full, shared, f.childSources);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }
  if (couple) {
    const federal = marriedCouple(F);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // In the order of the return, then the federal social deductions (the sort is stable: person 1
  // before person 2 on a shared code).
  items.sort((x, z) => ORDER_IFD.indexOf(x.code) - ORDER_IFD.indexOf(z.code));
  const totals = federalTotals(items);
  const scaleSources = f.childSources.length
    ? [...f.childSources, `${CIRCULAR30} p. 23 (ch. 13.4.1)`]
    : [];
  const tax = ifdTax(F, totals.taxableIncome, scale.scale, scale.childReductions, scaleSources);
  return { ifd: { items, ...totals, ...tax }, notes };
}

export type { Line };
