// The federal direct tax (direkte Bundessteuer) on the Bern return, as TaxMe's federal summary lays
// it out (be-2025-steuererklaerung-formulare-de p. 11, "Zusammenzug TaxMe: Direkte Bundessteuer"):
// the same lines and codes as the cantonal summary (p. 9), the federal amounts. The rules are the
// federal ones, the same in every canton (packages/rules-ch: each deduction keyed by concept, the
// scale, the tax); this file puts each concept on its Bern line: the income lines as in the
// cantonal column, then the expenses and general deductions (Aufwendungen und allgemeine Abzüge),
// the Reineinkommen, the personal deductions (the married couple deduction, donations, medical
// costs, the children) and the taxable income. The medical costs and donations take a share of the
// Reineinkommen with its centimes dropped, as TaxMe's summary does (p. 11: 5 % of 41,994 taken as
// 2,099).
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
  Trace,
  trainingCosts,
  twoEarner,
  type Deduction,
  type FederalConcept,
  type IfdParams,
  type LimitApplied,
  type RuleResult,
} from '@taxpresso/rules-ch';
import { flatShare, shareFloor } from './rules.js';
import { DEDUCTIONS, INCOME, PERSONAL, RUBRICS, type RubricCode } from './rubrics.js';
import type {
  Amount,
  BeEngineInput,
  BeIfdResult,
  EmploymentInput,
  Item,
  ItemPerson,
  Line,
  PersonInput,
  Text,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const SUMMARY = 'be-2025-steuererklaerung-formulare-de p. 11';
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';

/** The Bern line of each federal concept, as TaxMe's federal summary prints it (p. 11). */
const LINE_OF: Record<FederalConcept, RubricCode> = {
  pillar3a: 'saeule-3a',
  'professional.flat': '6.4',
  'professional.other': '6.4',
  commute: '6.1',
  meals: '6.2',
  training: '6.6',
  two_earner: 'zweiverdiener',
  insurance: '4.2',
  debt_interest: '4.3',
  childcare: '2.1-betreuung',
  married: 'verheiratet',
  medical: '5.4',
  donations: '5.3',
  party: '4.4',
  child: '2.1-kinder',
};

/** The order of TaxMe's federal summary (p. 11): income, expenses, personal deductions. */
const ORDER: readonly string[] = [
  ...[...INCOME],
  '4.2',
  '6.1',
  '6.2',
  '6.4',
  '6.5',
  '6.6',
  'saeule-3a',
  'einkauf-bv',
  '4.3',
  '4.4',
  '5.1',
  '2.1-betreuung',
  'zweiverdiener',
  'verheiratet',
  '5.3',
  '5.4',
  '2.1-kinder',
];

/** What the federal part noted: the result's notes and the limits it applied. */
export interface FederalNotes {
  notCounted: Text[];
  unverified: Text[];
  unsupported: Text[];
  limits: LimitApplied[];
}

/** A child as Bern counts it for the federal tax: in full, or half (shared, no support). */
export interface FederalChild {
  weight: 1 | 0.5;
  livesWithYou: boolean;
  under14?: boolean;
  childcare?: Amount;
}

export interface FederalInput {
  input: BeEngineInput;
  couple: boolean;
  /** The income lines of the return (form 2 and 3): the same in both columns. */
  incomeItems: readonly Item[];
  /** Deductions in full in both columns: buy-ins paid directly, alimony and child support paid. */
  inFull: readonly Item[];
  /** The children the household counts. */
  children: readonly FederalChild[];
  /** Where the attribution of the children comes from, when separated parents' support decided it. */
  childSources: readonly string[];
  /** The income from wealth (form 3, line 31), for the debt interest limit. */
  wealthIncome: number;
}

const none = (): FederalNotes => ({ notCounted: [], unverified: [], unsupported: [], limits: [] });

function add(list: Text[], x: Text) {
  if (!list.some((y) => y.en === x.en)) list.push(x);
}

/** An item on its Bern line, from a shared rule's deduction (the summary's page as a source). */
function deductionItem(
  d: Deduction<FederalConcept>,
  person: ItemPerson,
  given?: number,
  code?: RubricCode,
): Item {
  const c = code ?? LINE_OF[d.concept];
  const r = RUBRICS[c];
  d.trace.src(r.source, SUMMARY);
  return {
    code: c,
    person,
    ...d.trace.line(d.amount, r.label, d.how),
    ...(given !== undefined && given !== d.amount ? { given } : {}),
  };
}

/** Records what a shared rule noted and the limits it applied, on the Bern line. */
function apply(n: FederalNotes, r: RuleResult<FederalConcept>, person: ItemPerson, code?: string) {
  for (const x of r.notCounted) add(n.notCounted, x);
  for (const x of r.unverified) add(n.unverified, x);
  for (const l of r.limits) {
    n.limits.push({
      code: code ?? LINE_OF[l.concept],
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
    'Federal tax not computed: no 2025 document Taxpresso has gives the federal flat deduction of a side job (Nebenerwerb, form 6.5).',
    `Impôt fédéral non calculé${NB}: aucun document 2025 dont dispose Taxpresso ne donne la déduction forfaitaire fédérale d’une activité accessoire (Nebenerwerb, formule 6.5).`,
  ),
  elsewhere: t(
    'Federal tax not computed: a child who does not live with you is not supported yet for the federal tax.',
    `Impôt fédéral non calculé${NB}: un enfant qui ne vit pas avec vous n’est pas encore pris en charge pour l’impôt fédéral.`,
  ),
  partySplit: t(
    'Federal tax: payments to political parties are counted for the household together, up to the federal maximum.',
    `Impôt fédéral${NB}: les versements aux partis politiques sont comptés pour le ménage ensemble, jusqu’au maximum fédéral.`,
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

/** The net salary of a person's jobs (box 8 less boxes 9 and 10.1), and its traces. */
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
 * One person's federal deductions: professional costs (6.1, 6.2, 6.4), a side job (6.5), 3a and
 * training (6.6). `salaries`: the person's lines 2.21 (main job and side job).
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

  // Professional costs of the main job (LIFD art. 26): travel (6.1), meals (6.2), the flat 3 % or
  // the actual other costs (6.4), each on its line of form 6.
  if (m.gross > 0) {
    const net = m.gross - m.social - m.fund;
    const costTrace = new Trace();
    const way = commuteBase(F, p, costTrace);
    const other = francTotal(costTrace, [p.otherProfessionalCosts]);
    const freeTransport = main.length > 0 && main.every((e) => e.freeTransport === true);
    if (!freeTransport && way && way.cost > 0) {
      const travel = commuteCosts(F, p, way, costTrace);
      apply(notes, travel, p.id);
      if (travel.deduction) items.push(deductionItem(travel.deduction, p.id, -way.cost));
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

  // A side job (6.5): the federal flat, a share of its net salary between a minimum and a maximum,
  // never more than that salary. No 2025 document gives its rate: the federal tax fails closed.
  if (s.gross > 0) {
    const flat = ifdSideJobFlat(taxYear);
    if (!flat) {
      add(notes.unsupported, NOTE.sideJob2025);
    } else {
      const tr = new Trace().with(...s.traces);
      const sp = tr.p(flat);
      const net = Math.max(0, s.gross - s.social - s.fund);
      const ded = Math.min(flatShare(net, sp), net);
      if (ded > 0) {
        const r = RUBRICS['6.5'];
        tr.src(r.source, SUMMARY);
        items.push({
          code: '6.5',
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

  // Professional training (LIFD art. 33 al. 1 let. j).
  const trTrace = new Trace();
  const training = francTotal(trTrace, [p.trainingCosts]);
  if (training > 0) {
    const federal = trainingCosts(F, training, trTrace);
    apply(notes, federal, p.id);
    if (federal.deduction) items.push(deductionItem(federal.deduction, p.id, -training));
  }

  const lines = items.slice(start);
  const own = (code: string) =>
    lines.filter((i) => i.code === code).reduce((sum, i) => sum + i.amount, 0);
  const salary = salaries.reduce((sum, i) => sum + i.amount, 0);
  // Earned income after its professional costs, 3a and buy-ins (LIFD art. 33 al. 2): line 2.21 is
  // already net of the buy-ins taken from the salary (box 10.2); those paid directly come off here.
  const direct = francTotal(new Trace(), [p.pensionBuyIn]);
  const earned =
    salary + own('6.1') + own('6.2') + own('6.4') + own('6.5') + own('saeule-3a') - direct;
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

/** The totals of the federal summary, in its order (p. 11). */
export function federalTotals(items: readonly Item[]) {
  const income = items.filter((i) => INCOME.has(i.code));
  const deductions = items.filter((i) => DEDUCTIONS.has(i.code) || i.code === '6.5');
  const personal = items.filter((i) => PERSONAL.has(i.code));
  const gross = sum(income);
  const ded = sum(deductions);
  const net = gross + ded;
  const pers = sum(personal);
  const taxable = Math.max(0, francs(net + pers));
  const grossIncome = new Trace()
    .src(SUMMARY)
    .from(...income)
    .line(
      gross,
      t(
        'Total income, federal tax (Total Einkünfte)',
        'Total des revenus, impôt fédéral (Total Einkünfte)',
      ),
      t(
        `The ${income.length} income lines added up, the same as for the cantonal tax: ${chf(gross)}.`,
        `Les ${income.length} lignes de revenu additionnées, comme pour l’impôt cantonal${NB}: ${chf(gross)}.`,
      ),
    );
  const totalDeductions = new Trace()
    .src(SUMMARY)
    .from(...deductions)
    .line(
      ded,
      t(
        'Total expenses and general deductions, federal tax (Total Aufwendungen und allgemeine Abzüge)',
        'Total des frais et déductions générales, impôt fédéral (Total Aufwendungen und allgemeine Abzüge)',
      ),
      t(
        `The ${deductions.length} federal deductions added up: ${chf(-ded)}.`,
        `Les ${deductions.length} déductions fédérales additionnées${NB}: ${chf(-ded)}.`,
      ),
    );
  const netIncome = new Trace()
    .src(SUMMARY)
    .from(grossIncome, totalDeductions)
    .line(
      net,
      t('Net income, federal tax (Reineinkommen)', 'Revenu net, impôt fédéral (Reineinkommen)'),
      t(
        `Total income less the expenses and general deductions: ${chf(net)}.`,
        `Total des revenus moins les frais et déductions générales${NB}: ${chf(net)}.`,
      ),
    );
  const personalDeductions = new Trace()
    .src(SUMMARY)
    .from(...personal)
    .line(
      pers,
      t(
        'Total personal and social deductions, federal tax (Total persönliche Abzüge / Sozialabzüge)',
        'Total des déductions personnelles et sociales, impôt fédéral (Total persönliche Abzüge / Sozialabzüge)',
      ),
      t(
        `The ${personal.length} deductions added up${personal.length ? '' : ' (none)'}: ${chf(-pers)}.`,
        `Les ${personal.length} déductions additionnées${personal.length ? '' : ' (aucune)'}${NB}: ${chf(-pers)}.`,
      ),
    );
  const taxableIncome = new Trace()
    .src(SUMMARY)
    .from(netIncome, personalDeductions)
    .line(
      taxable,
      t(
        'Taxable income, federal tax (steuerbares Einkommen)',
        'Revenu imposable, impôt fédéral (steuerbares Einkommen)',
      ),
      t(
        `Net income less the personal and social deductions, in whole francs, never below zero: ${chf(taxable)}.`,
        `Revenu net moins les déductions personnelles et sociales, en francs entiers, jamais négatif${NB}: ${chf(taxable)}.`,
      ),
    );
  return { grossIncome, totalDeductions, netIncome, personalDeductions, taxableIncome };
}

/** A share of the Reineinkommen, its centimes dropped as TaxMe's summary does (p. 11). */
function ofNetIncome(
  F: IfdParams,
  rule: 'medical' | 'donations',
  amount: number,
  net: Line,
  tr: Trace,
  notes: FederalNotes,
): Item | undefined {
  tr.from(net).src(SUMMARY);
  if (rule === 'medical') {
    const bp = tr.p(F.medicalThresholdBp);
    const threshold = shareFloor(net.amount, bp);
    const v = Math.max(0, amount - threshold);
    notes.limits.push({
      code: '5.4',
      person: 'household',
      tax: 'ifd',
      kind: 'threshold',
      given: amount,
      limit: threshold,
      counted: v,
      source: `${F.medicalThresholdBp.source}; ${SUMMARY}`,
      rule: 'medical',
    });
    if (!v) {
      add(
        notes.notCounted,
        t(
          'Medical costs (federal tax): below the threshold, nothing to deduct.',
          `Frais médicaux (impôt fédéral)${NB}: sous le seuil, rien à déduire.`,
        ),
      );
      return undefined;
    }
    const r = RUBRICS['5.4'];
    tr.src(r.source);
    return {
      code: '5.4',
      person: 'household',
      ...tr.line(
        -v,
        r.label,
        t(
          `Costs ${chf(amount)} less ${bp / 100} % of the net income (${chf(net.amount)}), the centimes dropped, that is ${chf(threshold)}: ${chf(v)}.`,
          `Frais ${chf(amount)} moins ${String(bp / 100).replace('.', ',')}${NB}% du revenu net (${chf(net.amount)}), sans les centimes, soit ${chf(threshold)}${NB}: ${chf(v)}.`,
        ),
      ),
      given: -amount,
    };
  }
  const d = tr.p(F.donations);
  const cap = shareFloor(net.amount, d.shareBp);
  const v = amount < d.min ? 0 : Math.min(amount, cap);
  notes.limits.push(
    {
      code: '5.3',
      person: 'household',
      tax: 'ifd',
      kind: 'minimum',
      given: amount,
      limit: d.min,
      counted: v,
      source: `${F.donations.source}`,
      rule: 'donations',
    },
    {
      code: '5.3',
      person: 'household',
      tax: 'ifd',
      kind: 'cap',
      given: amount,
      limit: cap,
      counted: v,
      source: `${F.donations.source}; ${SUMMARY}`,
      rule: 'donations',
    },
  );
  if (!v) {
    add(
      notes.notCounted,
      t(
        'Donations (federal tax): under the yearly minimum, nothing to deduct.',
        `Dons (impôt fédéral)${NB}: sous le minimum annuel, rien à déduire.`,
      ),
    );
    return undefined;
  }
  const r = RUBRICS['5.3'];
  tr.src(r.source);
  return {
    code: '5.3',
    person: 'household',
    ...tr.line(
      -v,
      r.label,
      t(
        `${chf(amount)}, at least ${chf(d.min)} in the year, at most ${d.shareBp / 100} % of the net income (${chf(net.amount)}), the centimes dropped (${chf(cap)}): ${chf(v)}.`,
        `${chf(amount)}, au moins ${chf(d.min)} dans l’année, au plus ${String(d.shareBp / 100).replace('.', ',')}${NB}% du revenu net (${chf(net.amount)}), sans les centimes (${chf(cap)})${NB}: ${chf(v)}.`,
      ),
    ),
    ...(v !== amount ? { given: -amount } : {}),
  };
}

/**
 * The federal tax of a Bern household, or null with why it is not computed. `persons` are the
 * people, sorted, each with their lines 2.21 (main job, side job).
 */
export function federalReturn(
  f: FederalInput,
  persons: readonly { input: PersonInput; salaries: readonly Item[] }[],
): { ifd: BeIfdResult | null; notes: FederalNotes } {
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
    federalPerson(F, input.taxYear, p.input, p.salaries, items, notes),
  );
  if (notes.unsupported.length) return { ifd: null, notes };
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
    items.push(
      deductionItem(insurance.deduction, 'household', -Math.max(0, premiums + life - subsidy)),
    );
  }

  // Buy-ins paid directly, alimony and child support paid: in full, as in the cantonal tax.
  items.push(...f.inFull);

  // Private debt interest (LIFD art. 33 al. 1 let. a).
  const diTrace = new Trace();
  const interest = francTotal(diTrace, [hh.debtInterest]);
  if (interest > 0) {
    const federal = debtInterest(F, interest, f.wealthIncome, diTrace);
    apply(notes, federal, 'household');
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household', -interest));
  }

  // Political parties (LIFD art. 33 al. 1 let. i): the household's payments together.
  const pTrace = new Trace();
  const party = francTotal(pTrace, [
    hh.politicalParty,
    ...input.people.map((p) => p.politicalParty),
  ]);
  if (party > 0) {
    if (couple && input.people.filter((p) => p.politicalParty).length > 1) {
      add(notes.notCounted, NOTE.partySplit);
    }
    const federal = politicalParty(F, party, pTrace);
    apply(notes, federal, 'household');
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household', -party));
  }

  // Childcare (LIFD art. 33 al. 3): children under 14; spouses must both work.
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
      if (federal.deduction) items.push(deductionItem(federal.deduction, 'household', -care));
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

  // Both spouses earn (LIFD art. 33 al. 2): the spouse who earns less.
  const [a, b] = figures;
  if (couple && a && b && a.earns && b.earns) {
    const low = a.earned <= b.earned ? a : b;
    if (low.earned > 0) {
      const federal = twoEarner(F, low.earned, low.lines);
      if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
    }
  }

  // The Reineinkommen, the base of the medical costs and donations (LIFD art. 33 al. 1 let. h,
  // art. 33a).
  const net = federalTotals(items).netIncome;
  if (couple) {
    const federal = marriedCouple(F);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }
  const gTrace = new Trace();
  const gifts = francTotal(gTrace, [hh.donations]);
  if (gifts > 0) {
    const item = ofNetIncome(F, 'donations', gifts, net, gTrace, notes);
    if (item) items.push(item);
  }
  const mTrace = new Trace();
  const medical = francTotal(mTrace, [hh.medicalCosts]);
  if (medical > 0) {
    const item = ofNetIncome(F, 'medical', medical, net, mTrace, notes);
    if (item) items.push(item);
  }
  // The children (LIFD art. 35 al. 1 let. a).
  if (f.children.length) {
    const federal = childDeduction(F, full, shared, f.childSources);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // In TaxMe's order, person 1 before person 2 (the sort is stable).
  items.sort((x, y) => ORDER.indexOf(x.code) - ORDER.indexOf(y.code));
  const totals = federalTotals(items);
  const scaleSources = f.childSources.length
    ? [...f.childSources, `${CIRCULAR30} p. 23 (ch. 13.4.1)`]
    : [];
  const tax = ifdTax(F, totals.taxableIncome, scale.scale, scale.childReductions, scaleSources);
  return { ifd: { items, ...totals, ...tax }, notes };
}
