// The federal direct tax (direkte Bundessteuer) on the Basel-Stadt return: its Bund column
// (bs-2025-form-hauptformular p. 2 and 3, from 369 down to 799; form B, Berufskosten, and form K,
// Krankheitskosten, Zuwendungen, Kinderbetreuungskosten, in their Bund columns). The rules are the
// federal ones, the same in every canton (packages/rules-ch: each deduction keyed by concept, the
// scale, the tax); this file puts each concept on its Basel-Stadt line. The income lines are the
// same in both columns (p. 2, 100 to 299, one column; 369 in both, form W p. 4 lines 1 to 10); the
// deductions take the federal caps; the illness costs and donations are both measured on the
// Nettoeinkommen of the Bund column, line 709 (form K p. 1 and 2; Form. 2a 2026 p. 9, chiffres 20
// and 21); the children and the married couple deduction are social deductions, 750 and 760 after
// 739 (p. 3; Form. 2a p. 9, chiffre 23).
import {
  childcareCosts,
  childDeduction,
  chf,
  commuteBase,
  commuteCosts,
  debtInterest,
  donations,
  federalChildcare,
  federalScale,
  flatProfessional,
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
  FORM_B,
  INCOME,
  INCOME_BASED,
  PERSON_CODES,
  RUBRICS,
  SOCIAL,
  type RubricCode,
} from './rubrics.js';
import type {
  Amount,
  BsEngineInput,
  BsIfdResult,
  EmploymentInput,
  Item,
  ItemPart,
  ItemPerson,
  PersonInput,
  Text,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const FORM = 'bs-2025-form-hauptformular';
const FORM_K = 'bs-2025-form-kzf-krankheit-zuwendung-betreuung';
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';

/** The Basel-Stadt line of each federal concept (the Bund column of p. 3). */
const LINE_OF: Record<FederalConcept, 'person' | RubricCode> = {
  pillar3a: 'person',
  'professional.flat': 'person',
  'professional.other': 'person',
  commute: 'person',
  meals: 'person',
  training: 'person',
  two_earner: '660',
  insurance: '631',
  debt_interest: '550',
  childcare: '670',
  married: '760',
  medical: '725',
  donations: '732',
  party: '680',
  child: '750',
};

/** The Basel-Stadt line of a concept for a person: the per-person lines take its code. */
function lineOf(concept: FederalConcept, person: ItemPerson, couple: boolean): RubricCode {
  const line = LINE_OF[concept];
  if (concept === 'insurance') return couple ? '630' : '631';
  if (line !== 'person') return line;
  const p = person === 'p2' ? 'p2' : 'p1';
  if (concept === 'pillar3a') return PERSON_CODES.pillar3a[p];
  if (concept === 'training') return PERSON_CODES.training[p];
  return PERSON_CODES.professional[p];
}

/** What the federal part noted: the result's notes and the limits it applied. */
export interface FederalNotes {
  notCounted: Text[];
  unverified: Text[];
  unsupported: Text[];
  limits: LimitApplied[];
}

/** A child as Basel-Stadt counts it for the federal tax: in full, or half (shared, no support). */
export interface FederalChild {
  weight: 1 | 0.5;
  livesWithYou: boolean;
  under14?: boolean;
  childcare?: Amount;
}

export interface FederalInput {
  input: BsEngineInput;
  couple: boolean;
  /** The income lines of the return (p. 2): the same in both columns. */
  incomeItems: readonly Item[];
  /** Deductions in full in both columns: buy-ins paid directly, alimony and child support paid. */
  inFull: readonly Item[];
  /** The children the household counts. */
  children: readonly FederalChild[];
  /** Childcare given for the household as a whole (not per child). */
  householdChildcare?: Amount;
  /** Where the attribution of the children comes from, when separated parents' support decided it. */
  childSources: readonly string[];
  /** The gross income of the accounts and securities (form W, line 1), for the debt interest limit. */
  wealthIncome: number;
}

const none = (): FederalNotes => ({ notCounted: [], unverified: [], unsupported: [], limits: [] });

function add(list: Text[], x: Text) {
  if (!list.some((y) => y.en === x.en)) list.push(x);
}

/** An item on its Basel-Stadt line, from a shared rule's deduction (its form page as a source). */
function deductionItem(
  d: Deduction<FederalConcept>,
  person: ItemPerson,
  couple: boolean,
  code?: RubricCode,
): Item {
  const c = code ?? lineOf(d.concept, person, couple);
  const r = RUBRICS[c];
  d.trace.src(r.source);
  return { code: c, person, ...d.trace.line(d.amount, r.label, d.how) };
}

/** Records what a shared rule noted and the limits it applied, on the Basel-Stadt line. */
function apply(
  n: FederalNotes,
  r: RuleResult<FederalConcept>,
  person: ItemPerson,
  couple: boolean,
  code?: string,
) {
  for (const x of r.notCounted) add(n.notCounted, x);
  for (const x of r.unverified) add(n.unverified, x);
  for (const l of r.limits) {
    n.limits.push({
      code: code ?? lineOf(l.concept, person, couple),
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
  sideJob2025: t(
    'Federal tax not computed: no 2025 document Taxpresso relies on for the federal tax gives the flat deduction of a side job (Nebenerwerb, form B, 516) yet.',
    `Impôt fédéral non calculé${NB}: aucun document 2025 sur lequel Taxpresso s’appuie pour l’impôt fédéral ne donne encore la déduction forfaitaire d’une activité accessoire (Nebenerwerb, formulaire B, 516).`,
  ),
  elsewhere: t(
    'Federal tax not computed: a child who does not live with you is not supported yet for the federal tax.',
    `Impôt fédéral non calculé${NB}: un enfant qui ne vit pas avec vous n’est pas encore pris en charge pour l’impôt fédéral.`,
  ),
} as const satisfies Record<string, Text>;

interface FederalPerson {
  id: 'p1' | 'p2';
  /** The net salaries (100/105, 110/115) less the federal professional costs, 3a and buy-ins. */
  earned: number;
  earns: boolean;
  contributes: boolean;
  lines: Item[];
}

/** The salary of some jobs (box 8 less boxes 9 and 10.1), and its traces. */
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
 * One person's federal deductions: professional costs on 519/539 (form B, Bund column: travel 503,
 * meals 504, the flat 3 % or the actual other costs 514, a side job's flat 516), 3a (620/625) and
 * training (652/657). `salaries`: the person's lines 100/105 and 110/115.
 */
function federalPerson(
  F: IfdParams,
  taxYear: number,
  p: PersonInput,
  salaries: readonly Item[],
  couple: boolean,
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
  const hasFund = p.hasPensionFund ?? m.fund + s.fund > 0;
  const B = FORM_B[p.id];

  // Pillar 3a and its catch-up: the federal limits (OPP 3 art. 7), as in every canton.
  const p3a = pillar3a(F, {
    ...(p.pillar3a ? { paid: p.pillar3a } : {}),
    ...(p.pillar3aCatchUp && taxYear !== 2025 ? { catchUp: p.pillar3aCatchUp } : {}),
    hasFund,
    gross: m.gross + s.gross,
    social: m.social + s.social,
    self: 0,
    earnedFrom: [m.traces[0], m.traces[1], s.traces[0], s.traces[1]],
  });
  apply(notes, p3a, p.id, couple);
  if (p3a.deduction) items.push(deductionItem(p3a.deduction, p.id, couple));

  // Professional costs (form B, Bund column): travel and meals on their own lines, the flat 3 % or
  // the actual other costs (LIFD art. 26), a side job's flat; their total is 519/539.
  const parts: Deduction<FederalConcept>[] = [];
  const annex: ItemPart[] = [];
  if (m.gross > 0) {
    const net = m.gross - m.social - m.fund;
    const costTrace = new Trace();
    const way = commuteBase(F, p, costTrace);
    const other = francTotal(costTrace, [p.otherProfessionalCosts]);
    const freeTransport = main.length > 0 && main.every((e) => e.freeTransport === true);
    if (!freeTransport && way && way.cost > 0) {
      const travel = commuteCosts(F, p, way, costTrace);
      apply(notes, travel, p.id, couple);
      if (travel.deduction) {
        parts.push(travel.deduction);
        annex.push({ code: B.travel, amount: -travel.deduction.amount });
      }
    }
    const home = p.commuteMode?.by === 'home';
    const meals = mealsCosts(F.meals, {
      days: home ? 0 : (p.mealDays ?? 0),
      canteen: main.some((e) => e.canteen === true),
      ...(p.mealFacts ? { facts: p.mealFacts } : {}),
    });
    apply(notes, meals, p.id, couple);
    if (meals.deduction) {
      parts.push(meals.deduction);
      annex.push({ code: B.meals, amount: -meals.deduction.amount });
    }
    const prof = professionalCosts(F, net, other, [...m.traces], costTrace);
    apply(notes, prof, p.id, couple);
    if (prof.deduction) {
      parts.push(prof.deduction);
      annex.push({ code: B.other, amount: -prof.deduction.amount });
    }
  }

  // A side job (516/536): the federal flat, a share of its net salary between a minimum and a
  // maximum, never more than that salary. No 2025 document gives its rate: the federal tax fails
  // closed (rules-ch, ifdSideJobFlat).
  if (s.gross > 0) {
    const flat = ifdSideJobFlat(taxYear);
    if (!flat) {
      add(notes.unsupported, NOTE.sideJob2025);
    } else {
      const tr = new Trace().with(...s.traces);
      const sp = tr.p(flat);
      const net = Math.max(0, s.gross - s.social - s.fund);
      const ded = Math.min(flatProfessional(net, sp), net);
      if (ded > 0) {
        parts.push({
          concept: 'professional.flat',
          amount: -ded,
          trace: tr,
          how: t(
            `side job: 20 % of its salary after social and pension fund contributions (${chf(net)}), at least ${chf(sp.min)}, at most ${chf(sp.max)}, never more than that salary: ${chf(ded)}.`,
            `activité accessoire${NB}: 20${NB}% de son salaire après cotisations AVS et 2e pilier (${chf(net)}), au moins ${chf(sp.min)}, au plus ${chf(sp.max)}, jamais plus que ce salaire${NB}: ${chf(ded)}.`,
          ),
        });
        annex.push({ code: B.side, amount: ded });
      }
    }
  }
  if (parts.length) {
    const professional = -parts.reduce((sum, d) => sum + d.amount, 0);
    const tr = new Trace()
      .with(...parts.map((d) => d.trace))
      .src(...parts.flatMap((d) => [...d.trace.sources]));
    const code = PERSON_CODES.professional[p.id];
    const r = RUBRICS[code];
    tr.src(r.source, 'bs-2025-form-b-berufskosten p. 1 and 2 (Bund)');
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
    apply(notes, federal, p.id, couple);
    if (federal.deduction) items.push(deductionItem(federal.deduction, p.id, couple));
  }

  const lines = items.slice(start);
  const own = (code: string) =>
    lines.filter((i) => i.code === code).reduce((sum, i) => sum + i.amount, 0);
  const salary = salaries.reduce((sum, i) => sum + i.amount, 0);
  // Earned income after its professional costs, 3a and buy-ins (LIFD art. 33 al. 2): 100/105 is
  // already net of the buy-ins taken from the salary (box 10.2); those paid directly come off here.
  const direct = francTotal(new Trace(), [p.pensionBuyIn]);
  const earned =
    salary + own(PERSON_CODES.professional[p.id]) + own(PERSON_CODES.pillar3a[p.id]) - direct;
  return {
    id: p.id,
    earned,
    earns: salary > 0,
    contributes: hasFund || m.fund + s.fund > 0 || buyIn > 0 || p3a.paid > 0,
    lines: [...salaries, ...lines],
  };
}

const sum = (items: readonly Item[]) => items.reduce((s, i) => s + i.amount, 0);
const francs = (centimes: number) => Math.floor(centimes / 100) * 100;

/** The totals of the Bund column, in the form's order (p. 2 and 3). */
export function federalTotals(items: readonly Item[]) {
  const src = `${FORM} p. 3 (form page 3, Bund)`;
  const income = items.filter((i) => INCOME.has(i.code));
  const deductions = items.filter((i) => DEDUCTIONS.has(i.code));
  const based = items.filter((i) => INCOME_BASED.has(i.code));
  const social = items.filter((i) => SOCIAL.has(i.code));
  const gross = sum(income);
  const ded = sum(deductions);
  const s709 = gross + ded;
  const net = s709 + sum(based);
  const taxable = Math.max(0, francs(net + sum(social)));
  const grossIncome = new Trace()
    .src(`${FORM} p. 2 (form page 2, 499, Bund)`)
    .from(...income)
    .line(
      gross,
      t(
        'Total income, federal tax (Total der Einkünfte, 499)',
        'Total des revenus, impôt fédéral (Total der Einkünfte, 499)',
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
        'Total deductions, federal tax (Total der Abzüge, 699)',
        'Total des déductions, impôt fédéral (Total der Abzüge, 699)',
      ),
      t(
        `The ${deductions.length} deductions of the Bund column added up: ${chf(-ded)}.`,
        `Les ${deductions.length} déductions de la colonne Bund additionnées${NB}: ${chf(-ded)}.`,
      ),
    );
  const subtotal709 = new Trace()
    .src(src)
    .from(grossIncome, totalDeductions)
    .line(
      s709,
      t(
        'Net income, federal tax (Nettoeinkommen, 709)',
        'Revenu net, impôt fédéral (Nettoeinkommen, 709)',
      ),
      t(
        `Total income less total deductions: ${chf(s709)}.`,
        `Total des revenus moins total des déductions${NB}: ${chf(s709)}.`,
      ),
    );
  const netIncome = new Trace()
    .src(src)
    .from(subtotal709, ...based)
    .line(
      net,
      t(
        'Pure income, federal tax (Reineinkommen, 739)',
        'Revenu net après frais de maladie et dons, impôt fédéral (Reineinkommen, 739)',
      ),
      t(
        `Line 709 less illness costs and donations${based.length ? '' : ' (none)'}: ${chf(net)}.`,
        `Ligne 709 moins les frais de maladie et les dons${based.length ? '' : ' (aucun)'}${NB}: ${chf(net)}.`,
      ),
    );
  const taxableIncome = new Trace()
    .src(src)
    .from(netIncome, ...social)
    .line(
      taxable,
      t(
        'Taxable income, federal tax (Steuerbares Einkommen, 799)',
        'Revenu imposable, impôt fédéral (Steuerbares Einkommen, 799)',
      ),
      t(
        `Line 739 less the child and married couple deductions${social.length ? '' : ' (none)'}, in whole francs, never below zero: ${chf(taxable)}.`,
        `Ligne 739 moins les déductions pour enfants et pour couple marié${social.length ? '' : ' (aucune)'}, en francs entiers, jamais négatif${NB}: ${chf(taxable)}.`,
      ),
    );
  return { grossIncome, totalDeductions, subtotal709, netIncome, taxableIncome };
}

/** The base of the illness costs and donations shares: line 709 of the Bund column (form K). */
const LINE_709 = t('of the net income (line 709)', 'du revenu net (ligne 709)');

/**
 * The federal tax of a Basel-Stadt household, or null with why it is not computed. `persons` are
 * the people, sorted, each with their salary lines (100/105, 110/115).
 */
export function federalReturn(
  f: FederalInput,
  persons: readonly { input: PersonInput; salaries: readonly Item[] }[],
): { ifd: BsIfdResult | null; notes: FederalNotes } {
  const notes = none();
  const { input, couple } = f;
  const F = ifdParamsFor(input.taxYear);
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

  const items: Item[] = [...f.incomeItems];
  const figures = persons.map((p) =>
    federalPerson(F, input.taxYear, p.input, p.salaries, couple, items, notes),
  );
  if (notes.unsupported.length) return { ifd: null, notes };
  const hh = input.household ?? {};

  // Insurance premiums and savings interest (LIFD art. 33 al. 1 let. g, al. 1bis): 630 or 631 up
  // to the amount for spouses or others, 632 the supplement per child (guide p. 35).
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
  apply(notes, insurance, 'household', couple);
  if (insurance.deduction) {
    const total = -insurance.deduction.amount;
    const perChild = F.insurance.value.perChild;
    const supplement = perChild * full + (perChild / 2) * shared;
    const cap = insurance.limits[0]?.limit ?? total;
    const base = Math.min(total, cap - supplement);
    const item = deductionItem(insurance.deduction, 'household', couple);
    items.push({ ...item, amount: -base });
    if (total > base) {
      const r = RUBRICS['632'];
      items.push({
        ...item,
        code: '632',
        label: r.label,
        sources: [...new Set([...item.sources, r.source])],
        amount: -(total - base),
        how: t(
          `The supplement for children of the federal insurance deduction (${chf(perChild)} per child${shared ? ', half in shared custody' : ''}), what the premiums leave above ${chf(cap - supplement)}: ${chf(total - base)}.`,
          `Le supplément pour enfants de la déduction fédérale pour assurances (${chf(perChild)} par enfant${shared ? ', moitié en garde alternée' : ''}), ce que les primes laissent au-delà de ${chf(cap - supplement)}${NB}: ${chf(total - base)}.`,
        ),
      });
    }
  }

  // Buy-ins paid directly, alimony and child support paid: in full, as in the cantonal tax.
  items.push(...f.inFull);

  // Private debt interest (LIFD art. 33 al. 1 let. a).
  const diTrace = new Trace();
  const interest = francTotal(diTrace, [hh.debtInterest]);
  if (interest > 0) {
    const federal = debtInterest(F, interest, f.wealthIncome, diTrace);
    apply(notes, federal, 'household', couple);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household', couple));
  }

  // Childcare (LIFD art. 33 al. 3): children under 14; spouses must both work (form F, Bund).
  // The costs given for a child of 14 or more are left out (federalChildcare).
  const ccTrace = new Trace();
  const { care, older } = federalChildcare(f.children, f.householdChildcare, ccTrace);
  if (older) add(notes.notCounted, IFD_NOTE.childcareAge);
  if (care > 0) {
    const eligible = couple ? figures.length === 2 && figures.every((x) => x.earns) : true;
    const young = f.children.filter((c) => c.under14 !== false);
    const counted =
      f.householdChildcare && f.householdChildcare.value > 0
        ? young
        : young.filter((c) => (c.childcare?.value ?? 0) > 0);
    if (eligible && counted.length) {
      const federal = childcareCosts(F, care, counted.length, ccTrace.src(`${FORM_K} p. 2 (F)`));
      apply(notes, federal, 'household', couple);
      if (federal.deduction) items.push(deductionItem(federal.deduction, 'household', couple));
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

  // Political parties (LIFD art. 33 al. 1 let. i): at most the federal maximum (form Z).
  const pTrace = new Trace();
  const party = francTotal(pTrace, [hh.politicalParty]);
  if (party > 0) {
    const federal = politicalParty(F, party, pTrace);
    apply(notes, federal, 'household', couple);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household', couple));
  }

  // Both spouses earn (LIFD art. 33 al. 2): the spouse who earns less.
  const [a, b] = figures;
  if (couple && a && b && a.earns && b.earns) {
    const low = a.earned <= b.earned ? a : b;
    if (low.earned > 0) {
      const federal = twoEarner(F, low.earned, low.lines);
      if (federal.deduction) items.push(deductionItem(federal.deduction, 'household', couple));
    }
  }

  // Illness costs and donations, both on line 709 of the Bund column (form K and Z).
  const s709 = federalTotals(items).subtotal709;
  const mTrace = new Trace();
  const medical = francTotal(mTrace, [hh.medicalCosts]);
  if (medical > 0) {
    const r = medicalCosts(
      F.medicalThresholdBp,
      medical,
      { line: s709, name: LINE_709 },
      mTrace.src(`${FORM_K} p. 1 (K, 719 and 722, Bund)`),
      'IFD',
    );
    apply(notes, r, 'household', couple);
    if (r.deduction) items.push(deductionItem(r.deduction, 'household', couple));
  }
  const gTrace = new Trace();
  const gifts = francTotal(gTrace, [hh.donations]);
  if (gifts > 0) {
    const r = donations(
      F,
      gifts,
      { line: s709, name: LINE_709 },
      gTrace.src(`${FORM_K} p. 2 (Z, Bund)`),
    );
    apply(notes, r, 'household', couple);
    if (r.deduction) items.push(deductionItem(r.deduction, 'household', couple));
  }

  // Social deductions: the children (750) and married couples (760), after line 739.
  if (f.children.length) {
    const federal = childDeduction(F, full, shared, f.childSources);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household', couple));
  }
  if (couple) {
    const federal = marriedCouple(F);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household', couple));
  }

  // In the form's order, person 1 before person 2 (the sort is stable).
  const order = Object.keys(RUBRICS);
  items.sort((x, y) => order.indexOf(x.code) - order.indexOf(y.code));
  const totals = federalTotals(items);
  const scaleSources = f.childSources.length
    ? [...f.childSources, `${CIRCULAR30} p. 23 (ch. 13.4.1)`]
    : [];
  const tax = ifdTax(F, totals.taxableIncome, scale.scale, scale.childReductions, scaleSources);
  return { ifd: { items, ...totals, ...tax }, notes };
}
