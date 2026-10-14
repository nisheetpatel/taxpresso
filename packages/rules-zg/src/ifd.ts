// The federal direct tax (direkte Bundessteuer) on Zug's form K: its Bund column
// (zg-2025-guide-wegleitung p. 17 and 18, the sample form K, columns "Kanton 2025" and "Bund
// 2025"). The rules are the federal ones, the same in every canton (packages/rules-ch: each deduction keyed by
// concept, the scale, the tax); this file puts each concept on its line of form K. The income lines
// are the same in both columns (190); the deductions 201 to 260 take the federal amounts, the
// professional costs of a person on one line (201/202, the total of the Berufsauslagen form BA, which
// has its own Bund column, zg-2025-guide-en-how-to-fill p. 3); the illness costs (295) and donations
// (296) are measured on the subtotal 287 of the Bund column, as the guide says for both columns
// (zg-2025-guide-wegleitung p. 40 and 41: "massgebendes Reineinkommen (Code 287)"), which is the net
// income before them, as in the federal instructions (ch-2026-ifd-instructions-personnes-physiques
// p. 9); the married couple deduction (401, the Bund column's only) and the child deduction (403)
// are social deductions after 299 (p. 18 and 41).
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
  FURTHER,
  INCOME,
  PERSON_CODES,
  RUBRICS,
  type RubricCode,
} from './rubrics.js';
import type {
  Amount,
  EmploymentInput,
  Item,
  ItemPerson,
  Line,
  PersonInput,
  Text,
  ZgEngineInput,
  ZgIfdResult,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';
const GUIDE = 'zg-2025-guide-wegleitung';

/** The line of the Bund column of each federal concept, for one person where it has two. */
function lineOf(concept: FederalConcept, person: ItemPerson): RubricCode {
  const p = person === 'p2' ? 'p2' : 'p1';
  switch (concept) {
    case 'pillar3a':
      return PERSON_CODES.pillar3a[p];
    case 'professional.flat':
    case 'professional.other':
    case 'commute':
    case 'meals':
      return PERSON_CODES.professional[p];
    case 'training':
      return PERSON_CODES.training[p];
    case 'two_earner':
      return '260';
    case 'insurance':
      return '230';
    case 'debt_interest':
      return '205';
    case 'childcare':
      return '253';
    case 'married':
      return '401';
    case 'medical':
      return '295';
    case 'donations':
      return '296';
    case 'party':
      return '252';
    case 'child':
      return '403';
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
  input: ZgEngineInput;
  couple: boolean;
  /** The income lines of form K (p. 2): the same in both columns. */
  incomeItems: readonly Item[];
  /** Deductions in full in both columns: alimony, child support, buy-ins, the costs of securities. */
  inFull: readonly Item[];
  /** The children the household counts for the federal tax. */
  children: readonly FederalChild[];
  /** Where the attribution of the children comes from, when separated parents' support decided it. */
  childSources: readonly string[];
  /** Line 160, the gross income from accounts and securities, for the debt interest limit. */
  wealthIncome: number;
}

const none = (): FederalNotes => ({ notCounted: [], unverified: [], unsupported: [], limits: [] });

function add(list: Text[], x: Text) {
  if (!list.some((y) => y.en === x.en)) list.push(x);
}

/** An item on its line, from a shared rule's deduction (form K's page as a source). */
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
    'Federal tax not computed: no 2025 federal document Taxpresso has gives the federal flat deduction of a side job (Spesen Nebenerwerb, 201/202).',
    `Impôt fédéral non calculé${NB}: aucun document fédéral 2025 dont dispose Taxpresso ne donne la déduction forfaitaire fédérale d’une activité accessoire (Spesen Nebenerwerb, 201/202).`,
  ),
  elsewhere: t(
    'Federal tax not computed: a child who does not live with you is not supported yet for the federal tax.',
    `Impôt fédéral non calculé${NB}: un enfant qui ne vit pas avec vous n’est pas encore pris en charge pour l’impôt fédéral.`,
  ),
} as const satisfies Record<string, Text>;

interface FederalPerson {
  id: 'p1' | 'p2';
  /** Earned income less its federal professional costs, 3a and buy-ins (260). */
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
 * One person's federal deductions: pillar 3a (220/221), the professional costs of the main job and
 * of a side job on one line (201/202: travel, meals, the flat 3 % or the actual other costs, the
 * side job's flat), and training (245/246). `earnings`: the person's earned income lines (100 to
 * 106, 145 to 151).
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
  // A side job needs a main job (zg-2025-guide-wegleitung p. 34), as in the cantonal column.
  const hasMain = all.some((e) => !e.side);
  const main = hasMain ? all.filter((e) => !e.side) : all;
  const side = hasMain ? all.filter((e) => e.side) : [];
  const m = salaryOf(main);
  const s = salaryOf(side);
  const bTrace = new Trace();
  const buyIn = francTotal(bTrace, [...all.map((e) => e.pensionBuyIn), p.pensionBuyIn]);
  // Member of a pension fund: as the other cantons' federal columns read it, the answer, else box
  // 10.1 on a certificate.
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

  // Professional costs (LIFD art. 26), the Bund column of the Berufsauslagen form: travel, meals,
  // the flat 3 % or the actual other costs of the main job, and a side job's flat; their total is
  // 201/202.
  const parts: Deduction<FederalConcept>[] = [];
  if (main.length && m.gross > 0) {
    const net = m.gross - m.social - m.fund;
    const costTrace = new Trace();
    const way = commuteBase(F, p, costTrace);
    const other = francTotal(costTrace, [p.otherProfessionalCosts]);
    const freeTransport = main.every((e) => e.freeTransport === true);
    if (!freeTransport && way && way.cost > 0) {
      const travel = commuteCosts(F, p, way, costTrace);
      apply(notes, travel, p.id);
      if (travel.deduction) parts.push(travel.deduction);
    }
    const home = p.commuteMode?.by === 'home';
    const meals = mealsCosts(F.meals, {
      days: home ? 0 : (p.mealDays ?? 0),
      canteen: main.some((e) => e.canteen === true),
      ...(p.mealFacts ? { facts: p.mealFacts } : {}),
    });
    apply(notes, meals, p.id);
    if (meals.deduction) parts.push(meals.deduction);
    const prof = professionalCosts(F, net, other, [...m.traces], costTrace);
    apply(notes, prof, p.id);
    if (prof.deduction) parts.push(prof.deduction);
  }
  // A side job: the federal flat, a share of its net salary between a minimum and a maximum, never
  // more than that salary. No 2025 federal document gives its rate: fail closed.
  if (side.length && s.gross > 0) {
    const flat = ifdSideJobFlat(taxYear);
    if (!flat) {
      add(notes.unsupported, FEDERAL_NOTE.sideJob2025);
    } else {
      const tr = new Trace().with(...s.traces);
      const sp = tr.p(flat);
      const net = Math.max(0, s.gross - s.social - s.fund);
      const ded = flatShare(net, sp);
      if (ded > 0) {
        parts.push({
          concept: 'professional.flat',
          amount: -ded,
          trace: tr,
          how: t(
            `Side job: ${sp.rateBp / 100} % of its salary after social and pension fund contributions (${chf(net)}), at least ${chf(sp.min)}, at most ${chf(sp.max)}, never more than that salary: ${chf(ded)}.`,
            `Activité accessoire${NB}: ${sp.rateBp / 100}${NB}% de son salaire après cotisations AVS et 2e pilier (${chf(net)}), au moins ${chf(sp.min)}, au plus ${chf(sp.max)}, jamais plus que ce salaire${NB}: ${chf(ded)}.`,
          ),
        });
      }
    }
  }
  const professional = -parts.reduce((sum, d) => sum + d.amount, 0);
  if (professional > 0) {
    const code = PERSON_CODES.professional[p.id];
    const r = RUBRICS[code];
    const tr = new Trace()
      .with(...parts.map((d) => d.trace))
      .src(...parts.flatMap((d) => [...d.trace.sources]), r.source);
    items.push({
      code,
      person: p.id,
      ...tr.line(
        -professional,
        r.label,
        t(
          `${parts.map((d) => d.how.en.replace(/\.$/, '')).join('; ')}. Together: ${chf(professional)}.`,
          `${parts.map((d) => d.how.fr.replace(/\.$/, '')).join(`${NB}; `)}. Ensemble${NB}: ${chf(professional)}.`,
        ),
      ),
    });
  }

  // Professional training (LIFD art. 33 al. 1 let. j), per person (245/246).
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
  // Earned income after its professional costs, 3a and buy-ins (LIFD art. 33 al. 2): 100/101 is
  // already net of the buy-ins taken from the salary (box 10.2); those paid directly come off here.
  const direct = francTotal(new Trace(), [p.pensionBuyIn]);
  const earned =
    earnedIncome + own([PERSON_CODES.professional[p.id], PERSON_CODES.pillar3a[p.id]]) - direct;
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

/** The totals of the Bund column, in the order of form K (p. 2 and 3). */
export function federalTotals(items: readonly Item[]) {
  const form = `${GUIDE} p. 18 (Mustersteuererklärung, Formular K, Bund 2025`;
  const income = items.filter((i) => INCOME.has(i.code));
  const deductions = items.filter((i) => DEDUCTIONS.has(i.code));
  const further = items.filter((i) => FURTHER.has(i.code));
  const social = items.filter((i) => FEDERAL_SOCIAL.has(i.code));
  const gross = sum(income);
  const ded = sum(deductions);
  const s287 = gross + ded;
  const net = s287 + sum(further);
  const taxable = Math.max(0, francs(net + sum(social)));
  const grossIncome = new Trace()
    .src(`${GUIDE} p. 17 (Mustersteuererklärung, Formular K, Bund 2025: 190 Total Einkünfte)`)
    .from(...income)
    .line(
      gross,
      {
        ...t(
          'Total income, federal tax (Total Einkünfte, 190)',
          'Total des revenus, impôt fédéral (Total Einkünfte, 190)',
        ),
        de: 'Total Einkünfte (190, 285), Bund',
      },
      t(
        `The ${income.length} income lines added up, the same as for the cantonal tax: ${chf(gross)}.`,
        `Les ${income.length} lignes de revenu additionnées, comme pour l’impôt cantonal${NB}: ${chf(gross)}.`,
      ),
    );
  const totalDeductions = new Trace()
    .src(`${form}: 280 Total Abzüge)`)
    .from(...deductions)
    .line(
      -ded,
      {
        ...t(
          'Total deductions, federal tax (Total Abzüge, 280)',
          'Total des déductions, impôt fédéral (Total Abzüge, 280)',
        ),
        de: 'Total Abzüge (280, 286), Bund',
      },
      t(
        `The federal deductions 201 to 260 added up: ${chf(-ded)}.`,
        `Les déductions fédérales 201 à 260 additionnées${NB}: ${chf(-ded)}.`,
      ),
    );
  const subtotal = new Trace()
    .src(`${form}: 287 Zwischentotal)`)
    .from(grossIncome, totalDeductions)
    .line(
      s287,
      {
        ...t(
          'Subtotal, federal tax (Zwischentotal, 287)',
          'Sous-total, impôt fédéral (Zwischentotal, 287)',
        ),
        de: 'Zwischentotal (287), Bund',
      },
      t(
        `${chf(gross)} less ${chf(-ded)}: ${chf(s287)}.`,
        `${chf(gross)} moins ${chf(-ded)}${NB}: ${chf(s287)}.`,
      ),
    );
  const netIncome = new Trace()
    .src(`${form}: 299 Reineinkommen)`)
    .from(subtotal, ...further)
    .line(
      net,
      {
        ...t(
          'Net income, federal tax (Reineinkommen, 299)',
          'Revenu net, impôt fédéral (Reineinkommen, 299)',
        ),
        de: 'Reineinkommen (299), Bund',
      },
      t(
        `${chf(s287)} less illness costs and donations (${chf(-sum(further))}): ${chf(net)}.`,
        `${chf(s287)} moins frais de maladie et dons (${chf(-sum(further))})${NB}: ${chf(net)}.`,
      ),
    );
  const taxableIncome = new Trace()
    .src(`${form}: 490 Steuerbares Einkommen gesamt)`)
    .from(netIncome, ...social)
    .line(
      taxable,
      {
        ...t(
          'Taxable income, federal tax (steuerbares Einkommen, 490)',
          'Revenu imposable, impôt fédéral (steuerbares Einkommen, 490)',
        ),
        de: 'Steuerbares Einkommen (490), Bund',
      },
      t(
        `${chf(net)} less the married couple and child deductions (${chf(-sum(social))}), in whole francs, never below zero: ${chf(taxable)}.`,
        `${chf(net)} moins les déductions pour couple marié et pour enfants (${chf(-sum(social))}), en francs entiers, jamais négatif${NB}: ${chf(taxable)}.`,
      ),
    );
  return { grossIncome, totalDeductions, subtotal, netIncome, taxableIncome };
}

/** The base of the illness costs and donations shares: 287 of the Bund column. */
const LINE_287 = t('of the subtotal 287 (Bund)', 'du sous-total 287 (Bund)');

/**
 * The federal tax of a Zug household, or null with why it is not computed. `persons` are the
 * people, sorted, each with their earned income lines (100 to 106, 145 to 151).
 */
export function federalReturn(
  f: FederalInput,
  persons: readonly { input: PersonInput; earnings: readonly Item[] }[],
): { ifd: ZgIfdResult | null; notes: FederalNotes } {
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
  // at most the amount for spouses or for everyone else, plus so much per child (230).
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

  // Alimony (210), child support (211), buy-ins paid directly (250/251) and the costs of managing
  // securities (255): in full, as in the cantonal column.
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

  // Illness costs (295) and donations (296), both on the subtotal 287 of the Bund column.
  const s287 = federalTotals(items).subtotal;
  const mTrace = new Trace();
  const medical = francTotal(mTrace, [hh.medicalCosts]);
  if (medical > 0) {
    const r = medicalCosts(
      F.medicalThresholdBp,
      medical,
      { line: s287, name: LINE_287 },
      mTrace,
      'IFD',
    );
    apply(notes, r, 'household');
    if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
  }
  const gTrace = new Trace();
  const gifts = francTotal(gTrace, [hh.donations]);
  if (gifts > 0) {
    const r = donations(F, gifts, { line: s287, name: LINE_287 }, gTrace);
    apply(notes, r, 'household');
    if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
  }

  // Social deductions of the Bund column: married couples (401) and the children (403).
  if (couple) {
    const federal = marriedCouple(F);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }
  if (f.children.length) {
    const federal = childDeduction(F, full, shared, f.childSources);
    if (federal.deduction) items.push(deductionItem(federal.deduction, 'household'));
  }

  // In the order of the codes (the sort is stable: person 1 before person 2 on a shared code).
  items.sort((x, z) => x.code.localeCompare(z.code));
  const totals = federalTotals(items);
  const scaleSources = f.childSources.length
    ? [...f.childSources, `${CIRCULAR30} p. 23 (ch. 13.4.1)`]
    : [];
  const tax = ifdTax(F, totals.taxableIncome, scale.scale, scale.childReductions, scaleSources);
  return { ifd: { items, ...totals, ...tax }, notes };
}

export type { Line };
