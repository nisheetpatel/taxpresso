// The federal direct tax (direkte Bundessteuer) on the Zurich return: its Bundessteuer column
// (zh-2025-form-steuererklaerung-hauptformular p. 3). The rules are the federal ones, the same in
// every canton (packages/rules-ch: each deduction keyed by concept, the scale, the tax); this file
// puts each concept on its Zurich line. The income lines are the same in both columns (p. 2); the
// deductions take the federal caps; the medical costs and the donations are both measured on the net
// income of line 310 (ch-2026-ifd-instructions-personnes-physiques p. 9, chiffre 20 and 21; the Zurich
// guide, zh-2025-guide-natuerliche-personen p. 19); the married couple deduction is a social
// deduction, line 365 after line 350 (p. 3; Form. 2a p. 9, chiffre 23).
import {
  childcareCosts,
  childDeduction,
  chf,
  commuteBase,
  commuteCosts,
  debtInterest,
  donations,
  federalScale,
  francTotal,
  ifdParamsFor,
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
  EXTRA,
  annexCode,
  FORM_ORDER,
  INCOME,
  insuranceParts,
  personCode,
  RUBRICS,
  SOCIAL,
  travelLine,
  type RubricCode,
} from './rubrics.js';
import type {
  Amount,
  ChildInput,
  EmploymentInput,
  Item,
  ItemPart,
  ItemPerson,
  Line,
  PersonInput,
  Text,
  ZhEngineInput,
  ZhIfdResult,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const FORM = 'zh-2025-form-steuererklaerung-hauptformular';
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';

/** The Zurich line of each federal concept (the Bundessteuer column of p. 3). */
const LINE_OF: Record<FederalConcept, 'person' | RubricCode> = {
  pillar3a: 'person',
  'professional.flat': 'person',
  'professional.other': 'person',
  commute: 'person',
  meals: 'person',
  training: '292',
  two_earner: '290',
  insurance: '270',
  debt_interest: '250',
  childcare: '376',
  married: '365',
  medical: '320',
  donations: '324',
  party: '284',
  child: '370',
};

/** The Zurich line of a concept for a person: the per-person lines take its code. */
function lineOf(concept: FederalConcept, person: ItemPerson): RubricCode {
  const line = LINE_OF[concept];
  if (line !== 'person') return line;
  const p = person === 'p2' ? 'p2' : 'p1';
  return personCode(concept === 'pillar3a' ? 'pillar3a' : 'professional', p);
}

/** What the federal part noted: the result's notes and the limits it applied. */
export interface FederalNotes {
  notCounted: Text[];
  unverified: Text[];
  unsupported: Text[];
  limits: LimitApplied[];
}

/** A child as Zurich counts it for the federal tax: in full, or half (shared, no support). */
export interface FederalChild {
  weight: 1 | 0.5;
  livesWithYou: boolean;
  under14?: boolean;
  childcare?: Amount;
}

export interface FederalInput {
  input: ZhEngineInput;
  couple: boolean;
  /** The income lines of the return (p. 2): the same in both columns. */
  incomeItems: readonly Item[];
  /** Deductions taken in full in both columns: alimony (254), child support (255), costs (283). */
  inFull: readonly Item[];
  /** The children the household counts. */
  children: readonly FederalChild[];
  /** Where the attribution of the children comes from, when separated parents' support decided it. */
  childSources: readonly string[];
  /** Line 150, the income from wealth, for the debt interest limit. */
  wealthIncome: number;
}

const none = (): FederalNotes => ({ notCounted: [], unverified: [], unsupported: [], limits: [] });

function add(list: Text[], x: Text) {
  if (!list.some((y) => y.en === x.en)) list.push(x);
}

/** An item on its Zurich line, from a shared rule's deduction (its form page as a source). */
function deductionItem(d: Deduction<FederalConcept>, person: ItemPerson, code?: RubricCode): Item {
  const c = code ?? lineOf(d.concept, person);
  const r = RUBRICS[c];
  d.trace.src(r.source);
  return { code: c, person, ...d.trace.line(d.amount, r.label, d.how) };
}

/** Records what a shared rule noted and the limits it applied, on the Zurich line. */
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

const NOTE = {
  sideJob: t(
    'Federal tax not computed: a side job (Nebenerwerb) is not supported yet for the federal tax.',
    `Impôt fédéral non calculé${NB}: une activité accessoire (Nebenerwerb) n’est pas encore prise en charge pour l’impôt fédéral.`,
  ),
  elsewhere: t(
    'Federal tax not computed: a child who does not live with you (line 372) is not supported yet for the federal tax.',
    `Impôt fédéral non calculé${NB}: un enfant qui ne vit pas avec vous (ligne 372) n’est pas encore pris en charge pour l’impôt fédéral.`,
  ),
} as const satisfies Record<string, Text>;

interface FederalPerson {
  id: 'p1' | 'p2';
  /** The net salary of line 100/101 less the federal professional costs, 3a and buy-ins (290). */
  earned: number;
  earns: boolean;
  contributes: boolean;
  lines: Item[];
}

/** One person's federal deductions: professional costs (220/240), 3a (260/261), training (292). */
function federalPerson(
  F: IfdParams,
  p: PersonInput,
  salaryLine: Item | undefined,
  items: Item[],
  notes: FederalNotes,
): FederalPerson {
  const jobs: readonly EmploymentInput[] = (p.employments ?? []).filter((e) => !e.side);
  const start = items.length;
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
  const bTrace = new Trace();
  const buyIn = francTotal(bTrace, [...jobs.map((e) => e.pensionBuyIn), p.pensionBuyIn]);
  const hasFund = p.hasPensionFund ?? fund > 0;

  // Pillar 3a: the federal limits (OPP 3 art. 7), as in every canton.
  const p3a = pillar3a(F, {
    paid: p.pillar3a,
    hasFund,
    gross,
    social,
    self: 0,
    earnedFrom: [gTrace, sTrace],
  });
  apply(notes, p3a, p.id);
  if (p3a.deduction) items.push(deductionItem(p3a.deduction, p.id));

  // Professional costs on the salary (the Berufsauslagen form's Bundessteuer column): travel and
  // meals on their own, the flat 3 % or the actual costs for the rest (LIFD art. 26).
  if (gross > 0) {
    const net = gross - social - fund;
    const costTrace = new Trace();
    const way = commuteBase(F, p, costTrace);
    const other = francTotal(costTrace, [p.otherProfessionalCosts]);
    const parts: Deduction<FederalConcept>[] = [];
    // The lines of the Berufsauslagen form, Bundessteuer column.
    const annex: ItemPart[] = [];
    const prof = professionalCosts(F, net, other, [gTrace, sTrace, lTrace], costTrace);
    apply(notes, prof, p.id);
    if (prof.deduction) parts.push(prof.deduction);
    const freeTransport = jobs.some((e) => e.freeTransport === true);
    if (!freeTransport && way && way.cost > 0) {
      const travel = commuteCosts(F, p, way, costTrace);
      apply(notes, travel, p.id);
      if (travel.deduction) parts.push(travel.deduction);
      const line = travelLine(p);
      if (line && travel.deduction) {
        annex.push(
          { code: annexCode(line, p.id), amount: way.cost },
          { code: annexCode('travel', p.id), amount: -travel.deduction.amount },
        );
      }
    }
    const home = p.commuteMode?.by === 'home';
    const canteen = jobs.some((e) => e.canteen === true);
    const meals = mealsCosts(F.meals, {
      days: home ? 0 : (p.mealDays ?? 0),
      canteen,
      ...(p.mealFacts ? { facts: p.mealFacts } : {}),
    });
    apply(notes, meals, p.id);
    if (meals.deduction) {
      parts.push(meals.deduction);
      annex.push({
        code: annexCode(canteen ? 'mealsReduced' : 'meals', p.id),
        amount: -meals.deduction.amount,
      });
    }
    if (prof.deduction) {
      annex.push({
        code: annexCode(prof.deduction.concept === 'professional.other' ? 'actual' : 'flat', p.id),
        amount: -prof.deduction.amount,
      });
    }
    const professional = -parts.reduce((s, d) => s + d.amount, 0);
    const tr = new Trace()
      .with(...parts.map((d) => d.trace))
      .src(...parts.flatMap((d) => [...d.trace.sources]));
    const code = personCode('professional', p.id);
    const r = RUBRICS[code];
    tr.src(r.source);
    items.push({
      code,
      person: p.id,
      ...tr.line(
        -professional,
        r.label,
        t(
          `${parts.map((d) => d.how.en.replace(/\.$/, '')).join('; ')}. Total: ${chf(professional)}.`,
          `${parts.map((d) => d.how.fr.replace(/\.$/, '')).join(`${NB}; `)}. Total${NB}: ${chf(professional)}.`,
        ),
      ),
      parts: annex,
    });
  }

  // Professional training (LIFD art. 33 al. 1 let. j).
  const trTrace = new Trace();
  const training = francTotal(trTrace, [p.trainingCosts]);
  if (training > 0) {
    const federal = trainingCosts(F, training, trTrace);
    apply(notes, federal, p.id, '292');
    if (federal.deduction) items.push(deductionItem(federal.deduction, p.id));
  }

  const lines = items.slice(start);
  const own = (code: string) =>
    lines.filter((i) => i.code === code).reduce((s, i) => s + i.amount, 0);
  const salary = salaryLine?.amount ?? 0;
  // Earned income after its professional costs, 3a and buy-ins (LIFD art. 33 al. 2): line 100 is
  // already net of the buy-ins taken from the salary (box 10.2); those paid directly are line 280.
  const direct = francTotal(new Trace(), [p.pensionBuyIn]);
  const earned =
    salary + own(personCode('professional', p.id)) + own(personCode('pillar3a', p.id)) - direct;
  return {
    id: p.id,
    earned,
    earns: salary > 0,
    contributes: hasFund || fund > 0 || buyIn > 0 || p3a.paid > 0,
    lines: [...(salaryLine ? [salaryLine] : []), ...lines],
  };
}

const sum = (items: readonly Item[]) => items.reduce((s, i) => s + i.amount, 0);
const francs = (centimes: number) => Math.floor(centimes / 100) * 100;

/** The totals of the Bundessteuer column, in the form's order (p. 3). */
function federalTotals(items: readonly Item[]) {
  const src = `${FORM} p. 3`;
  const income = items.filter((i) => INCOME.has(i.code));
  const deductions = items.filter((i) => DEDUCTIONS.has(i.code));
  const extra = items.filter((i) => EXTRA.has(i.code));
  const social = items.filter((i) => SOCIAL.has(i.code));
  const gross = sum(income);
  const ded = sum(deductions);
  const s310 = gross + ded;
  const net = s310 + sum(extra);
  const taxable = Math.max(0, francs(net + sum(social)));
  const grossIncome = new Trace()
    .src(src)
    .from(...income)
    .line(
      gross,
      t(
        'Total income, federal tax (Total der Einkünfte, 199)',
        'Total des revenus, impôt fédéral (Total der Einkünfte, 199)',
      ),
      t(
        `The ${income.length} income lines added up, the same as for the cantonal tax: ${chf(gross)}.`,
        `Les ${income.length} lignes de revenu additionnées, comme pour l’impôt cantonal${NB}: ${chf(gross)}.`,
      ),
    );
  const totalDeductions = new Trace()
    .src(src)
    .from(...deductions)
    .line(
      ded,
      t(
        'Total deductions, federal tax (Total der Abzüge, 299)',
        'Total des déductions, impôt fédéral (Total der Abzüge, 299)',
      ),
      t(
        `The ${deductions.length} deductions of the Bundessteuer column added up: ${chf(-ded)}.`,
        `Les ${deductions.length} déductions de la colonne Bundessteuer additionnées${NB}: ${chf(-ded)}.`,
      ),
    );
  const subtotal310 = new Trace()
    .src(src)
    .from(grossIncome, totalDeductions)
    .line(
      s310,
      t(
        'Net income, federal tax (Nettoeinkommen, 310)',
        'Revenu net, impôt fédéral (Nettoeinkommen, 310)',
      ),
      t(
        `Total income less total deductions: ${chf(s310)}.`,
        `Total des revenus moins total des déductions${NB}: ${chf(s310)}.`,
      ),
    );
  const netIncome = new Trace()
    .src(src)
    .from(subtotal310, ...extra)
    .line(
      net,
      t(
        'Income after medical costs and donations, federal tax (Reineinkommen, 350)',
        'Revenu après frais médicaux et dons, impôt fédéral (Reineinkommen, 350)',
      ),
      t(
        `Line 310 less medical costs and donations${extra.length ? '' : ' (none)'}: ${chf(net)}.`,
        `Ligne 310 moins frais médicaux et dons${extra.length ? '' : ' (aucun)'}${NB}: ${chf(net)}.`,
      ),
    );
  const taxableIncome = new Trace()
    .src(src)
    .from(netIncome, ...social)
    .line(
      taxable,
      t(
        'Taxable income, federal tax (steuerbares Einkommen, 390)',
        'Revenu imposable, impôt fédéral (steuerbares Einkommen, 390)',
      ),
      t(
        `Line 350 less the child and married couple deductions${social.length ? '' : ' (none)'}, in whole francs, never below zero: ${chf(taxable)}.`,
        `Ligne 350 moins les déductions pour enfants et pour couple marié${social.length ? '' : ' (aucune)'}, en francs entiers, jamais négatif${NB}: ${chf(taxable)}.`,
      ),
    );
  return { grossIncome, totalDeductions, subtotal310, netIncome, taxableIncome };
}

/** The base of the medical costs and donations shares: line 310 of the Bundessteuer column. */
const LINE_310 = t('of the net income (line 310)', 'du revenu net (ligne 310)');

/**
 * The federal tax of a Zurich household, or null with why it is not computed. `persons` are the
 * people, sorted, each with their line 100/101.
 */
export function federalReturn(
  f: FederalInput,
  persons: readonly { input: PersonInput; salary: Item | undefined }[],
): { ifd: ZhIfdResult | null; notes: FederalNotes } {
  const notes = none();
  const { input, couple } = f;
  const F = ifdParamsFor(input.taxYear);
  if (persons.some((p) => (p.input.employments ?? []).some((e) => e.side))) {
    add(notes.unsupported, NOTE.sideJob);
  }
  if (f.children.some((c) => !c.livesWithYou)) add(notes.unsupported, NOTE.elsewhere);
  const full = f.children.filter((c) => c.weight === 1).length;
  const shared = f.children.filter((c) => c.weight === 0.5).length;
  const scale = federalScale({
    couple,
    full,
    shared,
    ...(input.ifdParentalScale !== undefined ? { parentalScale: input.ifdParentalScale } : {}),
  });
  for (const u of scale.unsupported) add(notes.unsupported, u);
  if (notes.unsupported.length) return { ifd: null, notes };

  const items: Item[] = [...f.incomeItems];
  const figures = persons.map((p) => federalPerson(F, p.input, p.salary, items, notes));
  const hh = input.household ?? {};

  // Insurance premiums and savings interest (LIFD art. 33 al. 1 let. g, al. 1bis).
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
  if (insurance.deduction) {
    // Part A paid and part B's limit, as the rule applied them.
    const applied = insurance.limits[0];
    const counted = -insurance.deduction.amount;
    items.push({
      ...deductionItem(insurance.deduction, 'household'),
      parts: insuranceParts(hh, applied?.given ?? counted, applied?.limit ?? counted),
    });
  }

  // Alimony, child support and the costs of managing securities: in full, as in the cantonal tax.
  items.push(...f.inFull);

  // Private debt interest (LIFD art. 33 al. 1 let. a).
  const diTrace = new Trace();
  const interest = francTotal(diTrace, [hh.debtInterest]);
  if (interest > 0) {
    const federal = debtInterest(F, interest, f.wealthIncome, diTrace);
    apply(notes, federal, 'household');
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // Childcare (LIFD art. 33 al. 3): children under 14; spouses must both work.
  const ccTrace = new Trace();
  const care = francTotal(ccTrace, [...f.children.map((c) => c.childcare), hh.childcare]);
  if (care > 0) {
    const eligible = couple ? figures.length === 2 && figures.every((x) => x.earns) : true;
    const young = f.children.filter((c) => c.under14 !== false);
    const counted =
      hh.childcare && hh.childcare.value > 0
        ? young
        : young.filter((c) => (c.childcare?.value ?? 0) > 0);
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

  // Both spouses earn (LIFD art. 33 al. 2): the spouse who earns less.
  const [a, b] = figures;
  if (couple && a && b && a.earns && b.earns) {
    const low = a.earned <= b.earned ? a : b;
    if (low.earned > 0) {
      const federal = twoEarner(F, low.earned, low.lines);
      if (federal.deduction) items.push(deductionItem(federal.deduction, low.id));
    }
  }

  // Medical costs and donations, both on line 310 of the Bundessteuer column.
  const s310 = federalTotals(items).subtotal310;
  const mTrace = new Trace();
  const medical = francTotal(mTrace, [hh.medicalCosts]);
  if (medical > 0) {
    const r = medicalCosts(
      F.medicalThresholdBp,
      medical,
      { line: s310, name: LINE_310 },
      mTrace,
      'IFD',
    );
    apply(notes, r, 'household');
    if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
  }
  const gTrace = new Trace();
  const gifts = francTotal(gTrace, [hh.donations]);
  if (gifts > 0) {
    const r = donations(F, gifts, { line: s310, name: LINE_310 }, gTrace);
    apply(notes, r, 'household');
    if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
  }

  // Social deductions: the children (370) and married couples (365), after line 350.
  if (f.children.length) {
    const federal = childDeduction(F, full, shared, f.childSources);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }
  if (couple) {
    const federal = marriedCouple(F);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  const order = FORM_ORDER as readonly string[];
  items.sort((x, y) => order.indexOf(x.code) - order.indexOf(y.code));
  const totals = federalTotals(items);
  const scaleSources = f.childSources.length
    ? [...f.childSources, `${CIRCULAR30} p. 23 (ch. 13.4.1)`]
    : [];
  const tax = ifdTax(F, totals.taxableIncome, scale.scale, scale.childReductions, scaleSources);
  return { ifd: { items, ...totals, ...tax }, notes };
}

export type { ChildInput, Line };
