// The federal direct tax (direkte Bundessteuer) of an Aargau household. The Aargau return has no
// federal column: the tax office takes the cantonal return, adds back the cantonal deductions that
// differ and puts the federal ones in their place (ag-2025-guide-wegleitung p. 42, Direkte
// Bundessteuer: political parties, childcare, training, insurance, the two-earner deduction and the
// social deductions), and the guide sends you to the ESTV for the federal amounts. So the rules are
// the federal ones, the same in every canton (packages/rules-ch: each deduction keyed by concept,
// the scale, the tax), in the order of the federal instructions (Form. 2a,
// ch-2026-ifd-instructions-personnes-physiques): the medical costs and the donations are both
// measured on the net income before them (chiffre 20, p. 9), the married couple and child
// deductions are social deductions after them (chiffre 23). This file puts each concept on the
// Aargau line of the same concept (the guide's section numbers, ./rubrics.ts) and the married couple
// deduction on a line of its own (FEDERAL_RUBRICS).
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
import { flatShare } from './rules.js';
import {
  DEDUCTIONS,
  FEDERAL_SOCIAL,
  INCOME,
  RUBRIC_ORDER,
  RUBRICS,
  rubric,
  type FederalRubricCode,
  type RubricCode,
} from './rubrics.js';
import type {
  AgEngineInput,
  AgIfdResult,
  Amount,
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
/** Where the guide says the federal deductions replace the cantonal ones. */
const GUIDE_FEDERAL = 'ag-2025-guide-wegleitung p. 42 (Direkte Bundessteuer)';
/** The federal instructions' net income (chiffre 20), base of the medical costs and donations. */
const INSTRUCTIONS = 'ch-2026-ifd-instructions-personnes-physiques p. 9 (chiffre 20, 21.1, 21.2)';

type Code = RubricCode | FederalRubricCode;

/** The Aargau line of each federal concept: the section of the guide for the same deduction. */
const LINE_OF: Record<FederalConcept, Code> = {
  pillar3a: '13.2',
  'professional.flat': '10.3',
  'professional.other': '10.3',
  commute: '10.1',
  meals: '10.2',
  training: '15.5',
  two_earner: '16',
  insurance: '14',
  debt_interest: '11',
  childcare: '15.0',
  married: 'bund-ehepaar',
  medical: '17.1',
  donations: '15.3',
  party: '15.2',
  child: '19.1',
};

/** The federal tax's deductions measured on the net income (chiffre 21): after the others. */
const AFTER_NET = new Set<string>(['15.3', '17.1']);

/** The order of the lines: the Aargau return's, the married couple deduction before the children. */
const ORDER: readonly string[] = (() => {
  const at = RUBRIC_ORDER.indexOf('19.1');
  return [...RUBRIC_ORDER.slice(0, at), 'bund-ehepaar', ...RUBRIC_ORDER.slice(at)];
})();

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
  input: AgEngineInput;
  couple: boolean;
  /** The income lines of the return (1 to 5): the federal tax takes the same income. */
  incomeItems: readonly Item[];
  /**
   * Deductions in full in both taxes: buy-ins paid directly (13.1), alimony and child support
   * paid (12.1, 12.2), the costs of managing securities (15.4).
   */
  inFull: readonly Item[];
  /** The children the household counts for the federal tax. */
  children: readonly FederalChild[];
  /** Where the attribution of the children comes from, when separated parents' support decided it. */
  childSources: readonly string[];
  /** Line 4, the gross income from accounts and securities, for the debt interest limit. */
  wealthIncome: number;
}

const none = (): FederalNotes => ({ notCounted: [], unverified: [], unsupported: [], limits: [] });

function add(list: Text[], x: Text) {
  if (!list.some((y) => y.en === x.en)) list.push(x);
}

/** An item on its Aargau line, from a shared rule's deduction (the guide's page as a source). */
function deductionItem(d: Deduction<FederalConcept>, person: ItemPerson, code?: Code): Item {
  const c = code ?? LINE_OF[d.concept];
  const r = rubric(c)!;
  d.trace.src(r.source, GUIDE_FEDERAL);
  return { code: c, person, ...d.trace.line(d.amount, r.label, d.how) };
}

/** Records what a shared rule noted and the limits it applied, on its Aargau line. */
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

export const FEDERAL_NOTE = {
  sideJob2025: t(
    'Federal tax not computed: no 2025 document Taxpresso has gives the federal flat deduction of a side job (Auslagen bei Nebenerwerb, 10.6).',
    `Impôt fédéral non calculé${NB}: aucun document 2025 dont dispose Taxpresso ne donne la déduction forfaitaire fédérale d’une activité accessoire (Auslagen bei Nebenerwerb, 10.6).`,
  ),
  elsewhere: t(
    'Federal tax not computed: a child who does not live with you is not supported yet for the federal tax.',
    `Impôt fédéral non calculé${NB}: un enfant qui ne vit pas avec vous n’est pas encore pris en charge pour l’impôt fédéral.`,
  ),
  insurance: t(
    'Insurance premiums, federal tax (14): the Aargau return deducts a flat amount and asks for no premium attestation; the guide says the tax office puts the federal deduction in its place without saying from what. Taxpresso counts the premiums you gave, up to the federal maximum: without your attestation, the federal tax shown is higher than it will be.',
    `Primes d’assurance, impôt fédéral (14)${NB}: la déclaration argovienne déduit un forfait et ne demande pas d’attestation de primes${NB}; le guide dit que l’administration met la déduction fédérale à sa place sans dire d’après quoi. Taxpresso compte les primes indiquées, jusqu’au maximum fédéral${NB}: sans votre attestation, l’impôt fédéral affiché est plus élevé qu’il ne sera.`,
  ),
} as const satisfies Record<string, Text>;

interface FederalPerson {
  id: 'p1' | 'p2';
  /** Net salaries and allowances less the federal professional costs, 3a and buy-ins (16). */
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
 * One person's federal deductions: travel (10.1), meals (10.2), the flat 3 % or the actual other
 * costs (10.3), a side job (10.6), pillar 3a (13.2) and training (15.5). `earnings`: the person's
 * income lines that count as earned (1.1, 1.2, the allowances of section 3).
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
  // 10.1 on a certificate (the cantonal tax also counts a buy-in taken from the salary, box 10.2).
  const hasFund = p.hasPensionFund ?? m.fund + s.fund > 0;

  // Pillar 3a and its catch-up: the federal limits (OPP 3 art. 7), as in the cantonal tax.
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

  // Professional costs of the main job (LIFD art. 26): travel (10.1) and meals (10.2) on their own
  // lines, the flat 3 % or the actual other costs on 10.3.
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

  // A side job (10.6): the federal flat, a share of its net salary between a minimum and a maximum,
  // never more than that salary. No 2025 document gives its rate: fail closed.
  if (side.length && s.gross > 0) {
    const flat = ifdSideJobFlat(taxYear);
    if (!flat) {
      add(notes.unsupported, FEDERAL_NOTE.sideJob2025);
    } else {
      const tr = new Trace().with(...s.traces);
      const sp = tr.p(flat);
      const net = Math.max(0, s.gross - s.social - s.fund);
      const ded = Math.min(flatShare(net, sp), net);
      if (ded > 0) {
        const r = RUBRICS['10.6'];
        tr.src(r.source, GUIDE_FEDERAL);
        items.push({
          code: '10.6',
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

  // Professional training (LIFD art. 33 al. 1 let. j), per person as in the cantonal tax (15.5).
  const trTrace = new Trace();
  const paidTraining = francTotal(trTrace, [p.trainingCosts]);
  if (paidTraining > 0) {
    const federal = trainingCosts(F, paidTraining, trTrace);
    apply(notes, federal, p.id);
    if (federal.deduction) items.push(deductionItem(federal.deduction, p.id));
  }

  const lines = items.slice(start);
  const own = (codes: readonly string[]) =>
    lines.filter((i) => codes.includes(i.code)).reduce((sum, i) => sum + i.amount, 0);
  const earnedIncome = earnings.reduce((sum, i) => sum + i.amount, 0);
  // Earned income after its professional costs, 3a and buy-ins (LIFD art. 33 al. 2; the federal
  // instructions count the daily allowances as earned, Form. 2a p. 8, chiffre 16): 1.1 is already
  // net of the buy-ins taken from the salary (box 10.2); those paid directly come off here.
  const direct = francTotal(new Trace(), [p.pensionBuyIn]);
  const earned = earnedIncome + own(['10.1', '10.2', '10.3', '10.6', '13.2']) - direct;
  return {
    id: p.id,
    earned,
    earns: earnedIncome > 0,
    contributes: hasFund || m.fund + s.fund > 0 || buyIn > 0 || p3a.paid > 0,
    lines: [...earnings, ...lines],
  };
}

const sum = (items: readonly Item[]) => items.reduce((s, i) => s + i.amount, 0);
const francs = (centimes: number) => Math.floor(centimes / 100) * 100;

/**
 * The federal totals, in the order of the federal instructions (Form. 2a p. 9): the income, the
 * deductions, the net income (chiffre 20), the medical costs and donations (21), the social
 * deductions (23) and the taxable income.
 */
export function federalTotals(items: readonly Item[]) {
  const income = items.filter((i) => INCOME.has(i.code));
  const deductions = items.filter((i) => DEDUCTIONS.has(i.code) && !AFTER_NET.has(i.code));
  const extra = items.filter((i) => AFTER_NET.has(i.code));
  const social = items.filter((i) => FEDERAL_SOCIAL.has(i.code));
  const gross = sum(income);
  const ded = sum(deductions);
  const base = gross + ded;
  const net = base + sum(extra);
  const taxable = Math.max(0, francs(net + sum(social)));
  const grossIncome = new Trace()
    .src(GUIDE_FEDERAL)
    .from(...income)
    .line(
      gross,
      {
        ...t(
          'Total income, federal tax (Total der Einkünfte)',
          'Total des revenus, impôt fédéral (Total der Einkünfte)',
        ),
        de: 'Total der Einkünfte, direkte Bundessteuer',
      },
      t(
        `The ${income.length} income lines added up, the same as for the cantonal tax: ${chf(gross)}.`,
        `Les ${income.length} lignes de revenu additionnées, comme pour l’impôt cantonal${NB}: ${chf(gross)}.`,
      ),
    );
  const totalDeductions = new Trace()
    .src(GUIDE_FEDERAL, INSTRUCTIONS)
    .from(...deductions)
    .line(
      ded,
      {
        ...t(
          'Total deductions, federal tax (Abzüge)',
          'Total des déductions, impôt fédéral (Abzüge)',
        ),
        de: 'Total der Abzüge, direkte Bundessteuer',
      },
      t(
        `The ${deductions.length} federal deductions before the medical costs and donations added up: ${chf(-ded)}.`,
        `Les ${deductions.length} déductions fédérales avant les frais médicaux et les dons additionnées${NB}: ${chf(-ded)}.`,
      ),
    );
  const baseIncome = new Trace()
    .src(INSTRUCTIONS)
    .from(grossIncome, totalDeductions)
    .line(
      base,
      {
        ...t(
          'Net income, federal tax (Nettoeinkommen)',
          'Revenu net, impôt fédéral (Nettoeinkommen)',
        ),
        de: 'Nettoeinkommen, direkte Bundessteuer',
      },
      t(
        `Total income less the deductions: ${chf(base)}. The medical costs and donations are measured on it.`,
        `Total des revenus moins les déductions${NB}: ${chf(base)}. Les frais médicaux et les dons se mesurent sur lui.`,
      ),
    );
  const netIncome = new Trace()
    .src(INSTRUCTIONS)
    .from(baseIncome, ...extra)
    .line(
      net,
      {
        ...t(
          'Income after medical costs and donations, federal tax (Reineinkommen)',
          'Revenu après frais médicaux et dons, impôt fédéral (Reineinkommen)',
        ),
        de: 'Reineinkommen, direkte Bundessteuer',
      },
      t(
        `The net income less the medical costs and donations${extra.length ? '' : ' (none)'}: ${chf(net)}.`,
        `Le revenu net moins les frais médicaux et les dons${extra.length ? '' : ' (aucun)'}${NB}: ${chf(net)}.`,
      ),
    );
  const taxableIncome = new Trace()
    .src(GUIDE_FEDERAL, 'ch-2026-ifd-instructions-personnes-physiques p. 9 (chiffre 23, 24)')
    .from(netIncome, ...social)
    .line(
      taxable,
      {
        ...t(
          'Taxable income, federal tax (steuerbares Einkommen)',
          'Revenu imposable, impôt fédéral (steuerbares Einkommen)',
        ),
        de: 'Steuerbares Einkommen, direkte Bundessteuer',
      },
      t(
        `Less the child and married couple deductions${social.length ? '' : ' (none)'}, in whole francs, never below zero: ${chf(taxable)}.`,
        `Moins les déductions pour enfants et pour couple marié${social.length ? '' : ' (aucune)'}, en francs entiers, jamais négatif${NB}: ${chf(taxable)}.`,
      ),
    );
  return { grossIncome, totalDeductions, baseIncome, netIncome, taxableIncome };
}

/** The base of the medical costs and donations shares: the net income of chiffre 20. */
const NET_INCOME = t(
  'of the net income before medical costs and donations',
  'du revenu net avant frais médicaux et dons',
);

/**
 * The federal tax of an Aargau household, or null with why it is not computed. `persons` are the
 * people, sorted, each with their earned income lines (1.1, 1.2, the allowances of section 3).
 */
export function federalReturn(
  f: FederalInput,
  persons: readonly { input: PersonInput; earnings: readonly Item[] }[],
): { ifd: AgIfdResult | null; notes: FederalNotes } {
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
  // up to the federal maximum, where the cantonal tax takes its flat amount (14).
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
  add(notes.unverified, FEDERAL_NOTE.insurance);
  if (insurance.deduction) items.push(deductionItem(insurance.deduction, 'household'));

  // Buy-ins paid directly (13.1), alimony and child support paid (12.1, 12.2) and the costs of
  // managing securities (15.4): in full, as in the cantonal tax.
  items.push(...f.inFull);

  // Private debt interest (LIFD art. 33 al. 1 let. a).
  const diTrace = new Trace();
  const interest = francTotal(diTrace, [hh.debtInterest]);
  if (interest > 0) {
    const federal = debtInterest(F, interest, f.wealthIncome, diTrace);
    apply(notes, federal, 'household');
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // Childcare (LIFD art. 33 al. 3): children under 14 living with you; spouses must both work. The
  // costs of a child of 14 or more don’t count (ch-2026-ifd-instructions-personnes-physiques p. 8:
  // "chaque enfant (jusqu’à 14 ans)"), as in the cantonal tax.
  const ccTrace = new Trace();
  const counted = f.children.filter((c) => c.under14 !== false && (c.childcare?.value ?? 0) > 0);
  const care = francTotal(
    ccTrace,
    counted.map((c) => c.childcare),
  );
  if (f.children.some((c) => c.under14 === false && (c.childcare?.value ?? 0) > 0)) {
    add(notes.notCounted, IFD_NOTE.childcareAge);
  }
  if (care > 0) {
    const eligible = couple ? figures.length === 2 && figures.every((x) => x.earns) : true;
    if (eligible) {
      const federal = childcareCosts(
        F,
        care,
        counted.length,
        ccTrace,
        counted.map((c) => ({ amount: c.childcare!.value })),
      );
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
      if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
    }
  }

  // Medical costs and donations, both on the net income before them (Form. 2a, chiffre 20 and 21).
  const base = federalTotals(items).baseIncome;
  const mTrace = new Trace();
  const medical = francTotal(mTrace, [hh.medicalCosts]);
  if (medical > 0) {
    const r = medicalCosts(
      F.medicalThresholdBp,
      medical,
      { line: base, name: NET_INCOME },
      mTrace,
      'federal tax',
    );
    apply(notes, r, 'household');
    if (r.deduction) {
      r.deduction.trace.src(INSTRUCTIONS);
      items.push(deductionItem(r.deduction, 'household'));
    }
  }
  const gTrace = new Trace();
  const gifts = francTotal(gTrace, [hh.donations]);
  if (gifts > 0) {
    const r = donations(F, gifts, { line: base, name: NET_INCOME }, gTrace);
    apply(notes, r, 'household');
    if (r.deduction) {
      r.deduction.trace.src(INSTRUCTIONS);
      items.push(deductionItem(r.deduction, 'household'));
    }
  }

  // Social deductions (chiffre 23): the married couple deduction and the children.
  if (couple) {
    const federal = marriedCouple(F);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }
  if (f.children.length) {
    const federal = childDeduction(F, full, shared, f.childSources);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // In the return's order (the sort is stable: person 1 before person 2 on a shared code).
  items.sort((x, z) => ORDER.indexOf(x.code) - ORDER.indexOf(z.code));
  const totals = federalTotals(items);
  const scaleSources = f.childSources.length
    ? [...f.childSources, `${CIRCULAR30} p. 23 (ch. 13.4.1)`]
    : [];
  const tax = ifdTax(F, totals.taxableIncome, scale.scale, scale.childReductions, scaleSources);
  return { ifd: { items, ...totals, ...tax }, notes };
}

export type { Line };
