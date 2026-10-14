// The federal direct tax (impôt fédéral direct) of a Vaud household, as the guide's worksheet
// determines the taxable income (vd-2025-guide p. 65, "Impôt fédéral direct - Détermination du
// revenu imposable"; the differences with the cantonal tax, p. 62 to 64). The return has no federal
// column: "Les contribuables n'ont pas l'obligation de remplir un formulaire particulier pour
// l'impôt fédéral direct" (p. 62); the worksheet takes the return's codes with the federal amounts.
//
// The rules are the federal ones, the same in every canton (packages/rules-ch: each deduction keyed
// by concept, the scale, the tax); this file puts each concept on its Vaud code, in the worksheet's
// order: the income lines as on the return, the professional costs (140 to 165), the two-earner
// deduction (235), the insurance premiums, contributions and savings interest together (300, 340,
// 480), 3a (310), buy-ins (320), the costs of the securities (490), debt interest (610), training
// (618), parties (620), alimony paid (630), childcare (670) and the medical costs in full (710):
// the revenu intermédiaire I; less the donations (720), at most 20 % of it: the revenu
// intermédiaire II (730); plus the franchise of the medical costs, II x 5/95, at most the medical
// costs deducted; less the social deductions (the married couple, each child): the taxable income.
// The franchise is the 5 % threshold of the federal law taken on the income after the medical
// costs and the donations themselves (II + franchise = 95 % + 5 %); Geneva's form takes it on its
// subtotal before them, so the two differ when there are medical costs (test/federal.test.ts).
import {
  chf,
  childcareCosts,
  childDeduction,
  commuteBase,
  commuteCosts,
  debtInterest,
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
  roundFranc,
  shareFranc,
  Trace,
  trainingCosts,
  twoEarner,
  type Deduction,
  type FederalConcept,
  type IfdParams,
  type LimitApplied,
  type RuleResult,
} from '@taxpresso/rules-ch';
import { federalRubric, INCOME } from './rubrics.js';
import { flatShare } from './rules.js';
import type {
  Amount,
  EmploymentInput,
  Item,
  ItemPerson,
  Line,
  PersonInput,
  Text,
  VdEngineInput,
  VdIfdResult,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const WORKSHEET = 'vd-2025-guide p. 65';
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';

/** The Vaud code of each federal concept, as the worksheet prints it (p. 65). */
const CODE_OF: Record<FederalConcept, string> = {
  pillar3a: '310',
  'professional.flat': '160',
  'professional.other': '160',
  commute: '140',
  meals: '150',
  training: '618',
  two_earner: '235',
  insurance: '300',
  debt_interest: '610',
  childcare: '670',
  married: 'deduction-maries',
  medical: '710',
  donations: '720',
  party: '620',
  child: 'deduction-enfants',
};

/** The worksheet's order (p. 65): income and costs, the deductions, then the social deductions. */
const ORDER: readonly string[] = [
  '100',
  '105',
  '140',
  '150',
  '160',
  '165',
  '195',
  '200',
  '210',
  '235',
  '240',
  '250',
  '270',
  '280',
  '300',
  '310',
  '320',
  '410',
  '490',
  '610',
  '618',
  '620',
  '630',
  '670',
  '710',
  '720',
  'franchise-medicale',
  'deduction-maries',
  'deduction-enfants',
];

/** Down to the revenu intermédiaire I: every deduction but the donations and what comes after. */
const BEFORE_I = new Set(ORDER.slice(ORDER.indexOf('140')).filter((c) => !INCOME.has(c)));
BEFORE_I.delete('720');
BEFORE_I.delete('franchise-medicale');
BEFORE_I.delete('deduction-maries');
BEFORE_I.delete('deduction-enfants');
const SOCIAL = new Set(['deduction-maries', 'deduction-enfants']);

/** What the federal part noted: the result's notes and the limits it applied. */
export interface FederalNotes {
  notCounted: Text[];
  unverified: Text[];
  unsupported: Text[];
  limits: LimitApplied[];
}

/** A child as Vaud counts it for the federal tax: in full, or half (shared, no support). */
export interface FederalChild {
  weight: 1 | 0.5;
  livesWithYou: boolean;
  under14?: boolean;
  childcare?: Amount;
}

export interface FederalInput {
  input: VdEngineInput;
  couple: boolean;
  /** The income lines of the return: the same for both taxes. */
  incomeItems: readonly Item[];
  /** Deductions in full in both taxes: buy-ins paid directly, the costs of the securities, alimony. */
  inFull: readonly Item[];
  /** The children the household counts. */
  children: readonly FederalChild[];
  /** Where the attribution of the children comes from, when separated parents' support decided it. */
  childSources: readonly string[];
  /** The gross income from wealth (410), for the debt interest limit. */
  wealthIncome: number;
}

const none = (): FederalNotes => ({ notCounted: [], unverified: [], unsupported: [], limits: [] });

function add(list: Text[], x: Text) {
  if (!list.some((y) => y.en === x.en)) list.push(x);
}

/** An item on its Vaud code, from a shared rule's deduction (the worksheet as a source). */
function deductionItem(d: Deduction<FederalConcept>, person: ItemPerson): Item {
  const code = CODE_OF[d.concept];
  const r = federalRubric(code)!;
  d.trace.src(r.source, WORKSHEET);
  return { code, person, ...d.trace.line(d.amount, r.label, d.how) };
}

/** Records what a shared rule noted and the limits it applied, on the Vaud code. */
function apply(n: FederalNotes, r: RuleResult<FederalConcept>, person: ItemPerson) {
  for (const x of r.notCounted) add(n.notCounted, x);
  for (const x of r.unverified) add(n.unverified, x);
  for (const l of r.limits) {
    n.limits.push({
      code: CODE_OF[l.concept],
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
    'Federal tax not computed: no 2025 document Taxpresso has gives the federal flat deduction of a side job (frais pour activité salariée accessoire, code 165).',
    `Impôt fédéral non calculé${NB}: aucun document 2025 dont dispose Taxpresso ne donne la déduction forfaitaire fédérale d’une activité salariée accessoire (code 165).`,
  ),
  elsewhere: t(
    'Federal tax not computed: a child who does not live with you is not supported yet for the federal tax.',
    `Impôt fédéral non calculé${NB}: un enfant qui ne vit pas avec vous n’est pas encore pris en charge pour l’impôt fédéral.`,
  ),
  rounding: t(
    'Federal tax: the guide’s worksheet (p. 65) adds back the franchise of the medical costs, the revenu intermédiaire II x 5/95, and caps the donations at 20 % of the revenu intermédiaire I without saying how they are rounded. Taxpresso rounds both to the franc.',
    `Impôt fédéral${NB}: la feuille de calcul du guide (p. 65) ajoute la franchise des frais médicaux, le revenu intermédiaire II x 5/95, et plafonne les dons à 20${NB}% du revenu intermédiaire I sans dire comment ils sont arrondis. Taxpresso les arrondit au franc.`,
  ),
} as const satisfies Record<string, Text>;

interface FederalPerson {
  id: 'p1' | 'p2';
  /** Net salaries less the federal professional costs, 3a and buy-ins paid directly. */
  earned: number;
  earns: boolean;
  contributes: boolean;
  lines: Item[];
}

/** The salary of a person's jobs (boxes 8, 9 and 10.1), and its traces. */
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
 * One person's federal deductions: professional costs (140, 150, 160), a side job (165), 3a (310)
 * and training (618). `salaries`: the person's lines 100 and 105.
 */
function federalPerson(
  F: IfdParams,
  taxYear: number,
  p: PersonInput,
  salaries: readonly Item[],
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
  apply(notes, p3a, p.id);
  if (p3a.deduction) items.push(deductionItem(p3a.deduction, p.id));

  // Professional costs of the main job (LIFD art. 26): travel (140, at most the federal amount,
  // p. 62), meals (150), the flat 3 % or the actual other costs (160).
  if (m.gross > 0) {
    const net = m.gross - m.social - m.fund;
    const costTrace = new Trace();
    const way = commuteBase(F, p, costTrace);
    const other = francTotal(costTrace, [p.otherProfessionalCosts]);
    const freeTransport = main.length > 0 && main.every((e) => e.freeTransport === true);
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

  // A side job (165): the federal flat, a share of its net salary between a minimum and a maximum,
  // never more than that salary. No 2025 document gives its rate: the federal tax fails closed.
  if (s.gross > 0) {
    const flat = ifdSideJobFlat(taxYear);
    if (!flat) {
      add(notes.unsupported, FEDERAL_NOTE.sideJob2025);
    } else {
      const tr = new Trace().with(...s.traces);
      const sp = tr.p(flat);
      const net = Math.max(0, s.gross - s.social - s.fund);
      const ded = flatShare(net, sp);
      if (ded > 0) {
        const r = federalRubric('165')!;
        tr.src(r.source, WORKSHEET);
        items.push({
          code: '165',
          person: p.id,
          ...tr.line(
            -ded,
            r.label,
            t(
              `20 % of the side job’s salary after social and pension fund contributions (${chf(net)}), at least ${chf(sp.min)}, at most ${chf(sp.max)}, never more than that salary: ${chf(ded)}.`,
              `20${NB}% du salaire de l’activité accessoire après cotisations AVS et 2e pilier (${chf(net)}), au moins ${chf(sp.min)}, au plus ${chf(sp.max)}, jamais plus que ce salaire${NB}: ${chf(ded)}.`,
            ),
          ),
        });
      }
    }
  }

  // Professional training (LIFD art. 33 al. 1 let. j; p. 63, code 618).
  const trTrace = new Trace();
  const training = francTotal(trTrace, [p.trainingCosts]);
  if (training > 0) {
    const federal = trainingCosts(F, training, trTrace);
    apply(notes, federal, p.id);
    if (federal.deduction) items.push(deductionItem(federal.deduction, p.id));
  }

  const lines = items.slice(start);
  const own = (code: string) =>
    lines.filter((i) => i.code === code).reduce((sum, i) => sum + i.amount, 0);
  const salary = salaries.reduce((sum, i) => sum + i.amount, 0);
  // Earned income after its professional costs, 3a and buy-ins (LIFD art. 33 al. 2): lines 100 and
  // 105 are already net of the buy-ins taken from the salary (box 10.2); those paid directly come
  // off here.
  const direct = francTotal(new Trace(), [p.pensionBuyIn]);
  const earned = salary + own('140') + own('150') + own('160') + own('165') + own('310') - direct;
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

/** The totals of the worksheet, in its order (p. 65). */
export function federalTotals(items: readonly Item[]) {
  const income = items.filter((i) => INCOME.has(i.code));
  const before = items.filter((i) => BEFORE_I.has(i.code));
  const gifts = items.filter((i) => i.code === '720');
  const franchise = items.filter((i) => i.code === 'franchise-medicale');
  const social = items.filter((i) => SOCIAL.has(i.code));
  const gross = sum(income);
  const i1 = gross + sum(before);
  const i2 = i1 + sum(gifts);
  const net = i2 + sum(franchise);
  const soc = sum(social);
  const taxable = Math.max(0, francs(net + soc));
  const grossIncome = new Trace()
    .src(WORKSHEET)
    .from(...income)
    .line(
      gross,
      t('Total income, federal tax', 'Total des revenus, impôt fédéral direct'),
      t(
        `The ${income.length} income lines of the return added up, the same as for the cantonal tax: ${chf(gross)}.`,
        `Les ${income.length} lignes de revenu de la déclaration additionnées, comme pour l’impôt cantonal${NB}: ${chf(gross)}.`,
      ),
    );
  const intermediateIncome1 = new Trace()
    .src(WORKSHEET)
    .from(grossIncome, ...before)
    .line(
      i1,
      t(
        'Intermediate income I, federal tax (revenu intermédiaire I)',
        'Revenu intermédiaire I, impôt fédéral direct',
      ),
      t(
        `Total income less the ${before.length} federal deductions down to the medical costs (710), in full: ${chf(i1)}.`,
        `Total des revenus moins les ${before.length} déductions fédérales jusqu’aux frais médicaux (710), entiers${NB}: ${chf(i1)}.`,
      ),
    );
  const intermediateIncome2 = new Trace()
    .src(WORKSHEET)
    .from(intermediateIncome1, ...gifts)
    .line(
      i2,
      t(
        'Intermediate income II, federal tax (revenu intermédiaire II, 730)',
        'Revenu intermédiaire II, impôt fédéral direct (730)',
      ),
      t(
        `Intermediate income I less the donations (${chf(-sum(gifts))}): ${chf(i2)}.`,
        `Revenu intermédiaire I moins les dons (${chf(-sum(gifts))})${NB}: ${chf(i2)}.`,
      ),
    );
  const netIncome = new Trace()
    .src(WORKSHEET)
    .from(intermediateIncome2, ...franchise)
    .line(
      net,
      t(
        'Net income before the social deductions, federal tax',
        'Revenu avant les déductions sociales, impôt fédéral direct',
      ),
      t(
        `Intermediate income II plus the franchise of the medical costs (${chf(sum(franchise))}): ${chf(net)}.`,
        `Revenu intermédiaire II plus la franchise des frais médicaux (${chf(sum(franchise))})${NB}: ${chf(net)}.`,
      ),
    );
  const socialDeductions = new Trace()
    .src(WORKSHEET)
    .from(...social)
    .line(
      soc,
      t('Social deductions, federal tax', 'Déductions sociales, impôt fédéral direct'),
      t(
        `The ${social.length} social deductions added up${social.length ? '' : ' (none)'}: ${chf(-soc)}.`,
        `Les ${social.length} déductions sociales additionnées${social.length ? '' : ' (aucune)'}${NB}: ${chf(-soc)}.`,
      ),
    );
  const taxableIncome = new Trace()
    .src(WORKSHEET)
    .from(netIncome, socialDeductions)
    .line(
      taxable,
      t('Taxable income, federal tax (revenu imposable)', 'Revenu imposable, impôt fédéral direct'),
      t(
        `Less the social deductions, in whole francs, never below zero: ${chf(taxable)}.`,
        `Moins les déductions sociales, en francs entiers, jamais négatif${NB}: ${chf(taxable)}.`,
      ),
    );
  return {
    grossIncome,
    intermediateIncome1,
    intermediateIncome2,
    netIncome,
    socialDeductions,
    taxableIncome,
  };
}

/**
 * The medical costs in full (710) and, after the donations, the franchise added back: the revenu
 * intermédiaire II x 5/95, at most the medical costs deducted (p. 65), to the franc.
 */
function medicalFranchise(
  F: IfdParams,
  costs: number,
  costsItem: Item,
  ii: Line,
  notes: FederalNotes,
): Item {
  const tr = new Trace().from(ii, costsItem).src(WORKSHEET);
  tr.p(F.medicalThresholdBp);
  const franchise = Math.min(costs, roundFranc(Math.max(0, ii.amount) * 5, 95));
  notes.limits.push({
    code: '710',
    person: 'household',
    tax: 'ifd',
    kind: 'threshold',
    given: costs,
    limit: franchise,
    counted: costs - franchise,
    source: `${F.medicalThresholdBp.source}; ${WORKSHEET}`,
    rule: 'medical',
  });
  if (franchise >= costs) {
    add(
      notes.notCounted,
      t(
        'Medical costs (federal tax): below the franchise, nothing to deduct.',
        `Frais médicaux (impôt fédéral)${NB}: sous la franchise, rien à déduire.`,
      ),
    );
  }
  const r = federalRubric('franchise-medicale')!;
  tr.src(r.source);
  return {
    code: 'franchise-medicale',
    person: 'household',
    ...tr.line(
      franchise,
      r.label,
      t(
        `Intermediate income II ${chf(ii.amount)} x 5/95, to the franc, at most the medical costs deducted (${chf(costs)}): ${chf(franchise)}, added back. The medical costs count above 5 % of the income after them.`,
        `Revenu intermédiaire II ${chf(ii.amount)} x 5/95, au franc, au plus les frais médicaux déduits (${chf(costs)})${NB}: ${chf(franchise)}, ajoutés. Les frais médicaux comptent au-delà de 5${NB}% du revenu après leur déduction.`,
      ),
    ),
  };
}

/**
 * The federal tax of a Vaud household, or null with why it is not computed. `persons` are the
 * people, sorted, each with their lines 100 and 105.
 */
export function federalReturn(
  f: FederalInput,
  persons: readonly { input: PersonInput; salaries: readonly Item[] }[],
): { ifd: VdIfdResult | null; notes: FederalNotes } {
  const notes = none();
  const { input, couple } = f;
  const F = ifdParamsFor(input.taxYear);
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
    federalPerson(F, input.taxYear, p.input, p.salaries, items, notes),
  );
  if (notes.unsupported.length) return { ifd: null, notes };
  const hh = input.household ?? {};

  // Insurance premiums, contributions and savings interest together (LIFD art. 33 al. 1 let. g,
  // al. 1bis; p. 62 and 63, codes 300, 340 and 480).
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

  // Buy-ins paid directly, the costs of the securities and alimony paid: in full, as on the return.
  items.push(...f.inFull);

  // Private debt interest (LIFD art. 33 al. 1 let. a).
  const diTrace = new Trace();
  const interest = francTotal(diTrace, [hh.debtInterest]);
  if (interest > 0) {
    const federal = debtInterest(F, interest, f.wealthIncome, diTrace);
    apply(notes, federal, 'household');
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // Political parties (LIFD art. 33 al. 1 let. i; p. 63, code 620).
  const pTrace = new Trace();
  const party = francTotal(pTrace, [hh.politicalParty]);
  if (party > 0) {
    const federal = politicalParty(F, party, pTrace);
    apply(notes, federal, 'household');
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // Childcare (LIFD art. 33 al. 3; p. 63, code 670): children under 14; spouses must both work.
  // The costs given for a child of 14 or more are left out (federalChildcare).
  const ccTrace = new Trace();
  const { care, older, perChild } = federalChildcare(f.children, undefined, ccTrace);
  if (older) add(notes.notCounted, IFD_NOTE.childcareAge);
  if (care > 0) {
    const eligible = couple ? figures.length === 2 && figures.every((x) => x.earns) : true;
    const counted = f.children.filter((c) => c.under14 !== false && (c.childcare?.value ?? 0) > 0);
    if (eligible && counted.length) {
      const federal = childcareCosts(F, care, counted.length, ccTrace, perChild);
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

  // Both spouses earn (LIFD art. 33 al. 2; p. 62, code 235): the spouse who earns less.
  const [a, b] = figures;
  if (couple && a && b && a.earns && b.earns) {
    const low = a.earned <= b.earned ? a : b;
    if (low.earned > 0) {
      const federal = twoEarner(F, low.earned, low.lines);
      if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
    }
  }

  // The medical costs in full (710), as the worksheet takes them before the donations.
  const mTrace = new Trace();
  const medical = francTotal(mTrace, [hh.medicalCosts]);
  let medicalItem: Item | undefined;
  if (medical > 0) {
    const r = federalRubric('710')!;
    mTrace.src(r.source, WORKSHEET);
    medicalItem = {
      code: '710',
      person: 'household',
      ...mTrace.line(
        -medical,
        r.label,
        t(
          `Medical costs you paid, in full: ${chf(medical)}. Their franchise is added back below.`,
          `Frais médicaux à votre charge, entiers${NB}: ${chf(medical)}. Leur franchise est ajoutée plus bas.`,
        ),
      ),
    };
    items.push(medicalItem);
  }

  // Donations (LIFD art. 33a): at least the yearly minimum, at most 20 % of the revenu
  // intermédiaire I (p. 65, code 720).
  const gTrace = new Trace();
  const gifts = francTotal(gTrace, [hh.donations]);
  if (gifts > 0) {
    const i1 = federalTotals(items).intermediateIncome1;
    const tr = new Trace().with(gTrace).from(i1).src(WORKSHEET);
    const d = tr.p(F.donations);
    const cap = shareFranc(Math.max(0, i1.amount), d.shareBp);
    const v = gifts < d.min ? 0 : Math.min(gifts, cap);
    notes.limits.push({
      code: '720',
      person: 'household',
      tax: 'ifd',
      kind: 'minimum',
      given: gifts,
      limit: d.min,
      counted: v,
      source: F.donations.source,
      rule: 'donations',
    });
    if (gifts >= d.min) {
      notes.limits.push({
        code: '720',
        person: 'household',
        tax: 'ifd',
        kind: 'cap',
        given: gifts,
        limit: cap,
        counted: v,
        source: `${F.donations.source}; ${WORKSHEET}`,
        rule: 'donations',
      });
    }
    if (v > 0) {
      const r = federalRubric('720')!;
      tr.src(r.source);
      items.push({
        code: '720',
        person: 'household',
        ...tr.line(
          -v,
          r.label,
          t(
            `${chf(gifts)}, at least ${chf(d.min)} in the year, at most 20 % of the intermediate income I (${chf(i1.amount)}), ${chf(cap)}: ${chf(v)}.`,
            `${chf(gifts)}, au moins ${chf(d.min)} dans l’année, au plus 20${NB}% du revenu intermédiaire I (${chf(i1.amount)}), ${chf(cap)}${NB}: ${chf(v)}.`,
          ),
        ),
      });
    } else {
      add(
        notes.notCounted,
        t(
          `Donations under ${chf(d.min)} in the year are not deducted for the federal tax.`,
          `Les dons de moins de ${chf(d.min)} dans l’année ne sont pas déduits pour l’impôt fédéral.`,
        ),
      );
    }
  }
  if (medicalItem) {
    const ii = federalTotals(items).intermediateIncome2;
    items.push(medicalFranchise(F, medical, medicalItem, ii, notes));
  }
  if (medical > 0 || gifts > 0) add(notes.unverified, FEDERAL_NOTE.rounding);

  // The social deductions (LIFD art. 35 al. 1; p. 64): the married couple, each child.
  if (couple) {
    const federal = marriedCouple(F);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }
  if (f.children.length) {
    const federal = childDeduction(F, full, shared, f.childSources);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // In the worksheet's order, person 1 before person 2 (the sort is stable).
  items.sort((x, y) => ORDER.indexOf(x.code) - ORDER.indexOf(y.code));
  const totals = federalTotals(items);
  const scaleSources = f.childSources.length
    ? [...f.childSources, `${CIRCULAR30} p. 23 (ch. 13.4.1)`]
    : [];
  const tax = ifdTax(F, totals.taxableIncome, scale.scale, scale.childReductions, scaleSources);
  return { ifd: { items, ...totals, ...tax }, notes };
}
