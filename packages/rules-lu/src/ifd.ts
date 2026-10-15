// The federal direct tax (direkte Bundessteuer) of a Lucerne household, as the canton derives it
// from the return. The return has no federal column: "Bei der direkten Bundessteuer sind die
// steuerbaren Einkünfte und Abzüge gleich wie bei den Staats- und Gemeindesteuern geregelt, soweit
// in der nachstehenden Übersicht nichts anderes vermerkt wird" (lu-2025-guide-wegleitung p. 54,
// the differences on p. 54 and 55; the same in lu-2026-guide-wegleitung-unterjaehrig p. 54 and
// 55), and the optional Ergänzungsblatt Direkte Bundessteuer (lu-2025-form-ergaenzungsblatt-dbst
// p. 1) lays those differences out, Ziffer by Ziffer:
//   1. the Nettoeinkommen of Ziffer 310; plus 2. and 3. the cantonal travel costs (208t, 209t) and
//   5. the cantonal insurance deduction (270): 7. Zwischentotal; less 8. and 9. the federal travel
//   costs and 10. the federal insurance deduction: 12. Nettoeinkommen; less 13. the medical costs
//   above 5 % of 12, 15. the donations up to 20 % of 12, 16. the parties, 17. the federal two-earner
//   deduction and 18. the federal childcare: 19. Reineinkommen; less 20. the children and 22. the
//   married couple: 23. the federal taxable income.
// So every deduction the guide doesn't list as different stays on the return's lines with its
// cantonal amount (professional costs other than travel, training, debt interest, alimony, 3a,
// buy-ins, the costs of keeping securities), and the federal rules of packages/rules-ch give the
// rest, each on its Ziffer of the sheet ("E8" for Ziffer 8). Not covered (the cantonal tax doesn't
// cover them either): 4 (Mietwertreduktion), 6 and 11 (qualified participations), 14 (disability
// costs), 21 (support).
import {
  chf,
  childcareCosts,
  childDeduction,
  commuteBase,
  commuteCosts,
  donations,
  federalChildcare,
  federalScale,
  francTotal,
  IFD_NOTE,
  ifdParamsFor,
  ifdTax,
  insurancePremiums,
  marriedCouple,
  medicalCosts,
  politicalParty,
  Trace,
  twoEarner,
  type Deduction,
  type FederalConcept,
  type IfdParams,
  type LimitApplied,
  type RuleResult,
} from '@taxpresso/rules-ch';
import { FEDERAL_RUBRICS, PERSON_CODES, type FederalCode } from './rubrics.js';
import type {
  Amount,
  Item,
  ItemPerson,
  Line,
  LuEngineInput,
  LuIccResult,
  LuIfdResult,
  PersonInput,
  Text,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';
const SHEET = 'lu-2025-form-ergaenzungsblatt-dbst p. 1';

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

/** A person as the federal part reads them, from the cantonal lines and the input. */
export interface FederalPerson {
  input: PersonInput;
  /** Their earned income lines on the return (100/101, 104/105, 140/141). */
  earnings: readonly Item[];
  /** Their cantonal professional costs (form B: 208t to 237), 3a (260/261) and buy-ins (280/282). */
  costs: readonly Item[];
}

export interface FederalInput {
  input: LuEngineInput;
  couple: boolean;
  /** The cantonal result: its Nettoeinkommen (310) and its lines. */
  icc: LuIccResult;
  /** The children the household counts for the federal tax. */
  children: readonly FederalChild[];
  /** Where the attribution of the children comes from, when separated parents' support decided it. */
  childSources: readonly string[];
  /** The people, sorted. */
  persons: readonly FederalPerson[];
}

export const FEDERAL_NOTE = {
  elsewhere: t(
    'Federal tax not computed: a child who does not live with you is not supported yet for the federal tax.',
    `Impôt fédéral non calculé${NB}: un enfant qui ne vit pas avec vous n’est pas encore pris en charge pour l’impôt fédéral.`,
  ),
} as const satisfies Record<string, Text>;

const none = (): FederalNotes => ({ notCounted: [], unverified: [], unsupported: [], limits: [] });

function add(list: Text[], x: Text) {
  if (!list.some((y) => y.en === x.en)) list.push(x);
}

/** The Ziffer of the sheet of each federal concept the sheet takes, for one person where it has two. */
function lineOf(concept: FederalConcept, person: ItemPerson): FederalCode {
  switch (concept) {
    case 'commute':
      return person === 'p2' ? 'E9' : 'E8';
    case 'insurance':
      return 'E10';
    case 'medical':
      return 'E13';
    case 'donations':
      return 'E15';
    case 'party':
      return 'E16';
    case 'two_earner':
      return 'E17';
    case 'childcare':
      return 'E18';
    case 'child':
      return 'E20';
    case 'married':
      return 'E22';
    default:
      throw new Error(`The Ergänzungsblatt has no line of its own for ${concept}.`);
  }
}

/** A line of the sheet, from a trace. */
function sheetItem(
  code: FederalCode,
  person: ItemPerson,
  tr: Trace,
  amount: number,
  how: Text,
): Item {
  const r = FEDERAL_RUBRICS[code];
  tr.src(r.source);
  return { code, person, ...tr.line(amount, r.label, how) };
}

/** A line of the sheet, from a shared rule's deduction. */
function deductionItem(d: Deduction<FederalConcept>, person: ItemPerson): Item {
  const code = lineOf(d.concept, person);
  const r = FEDERAL_RUBRICS[code];
  d.trace.src(r.source);
  return { code, person, ...d.trace.line(d.amount, r.label, d.how) };
}

/** Records what a shared rule noted and the limits it applied, on its line of the sheet. */
function apply(n: FederalNotes, r: RuleResult<FederalConcept>, person: ItemPerson) {
  for (const x of r.notCounted) add(n.notCounted, x);
  for (const x of r.unverified) add(n.unverified, x);
  for (const l of r.limits) {
    n.limits.push({
      code: lineOf(l.concept, person),
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

const sum = (items: readonly Pick<Item, 'amount'>[]) => items.reduce((s, i) => s + i.amount, 0);
const francs = (centimes: number) => Math.floor(centimes / 100) * 100;

interface PersonFigures {
  id: 'p1' | 'p2';
  /** Earned income less its federal professional costs, 3a and buy-ins paid directly (17). */
  earned: number;
  earns: boolean;
  contributes: boolean;
  lines: Item[];
}

/**
 * One person's federal travel costs (8, 9), and their earned income as the two-earner deduction
 * reads it: their earned income lines less their professional costs (the cantonal ones, the travel
 * costs replaced by the federal ones), their 3a and their buy-ins paid directly.
 */
function federalPerson(
  F: IfdParams,
  p: FederalPerson,
  items: Item[],
  notes: FederalNotes,
): PersonFigures {
  const id = p.input.id;
  const jobs = p.input.employments ?? [];
  const main = jobs.filter((e) => !e.side);
  const start = items.length;
  // Travel to work (LIFD art. 26 al. 1 let. a), as the cantonal line is found (form B, 208t/209t):
  // only with a main job, nothing with transport provided.
  let travel = 0;
  const gross = francTotal(
    new Trace(),
    main.map((e) => e.gross),
  );
  if (main.length && gross > 0 && !main.every((e) => e.freeTransport === true)) {
    // The trace of the professional costs given, as every canton's federal part reads them
    // (packages/rules-zg, ifd.ts): the travel line says when they are estimates or need an OK.
    const costTrace = new Trace();
    const way = commuteBase(F, p.input, costTrace);
    francTotal(costTrace, [p.input.otherProfessionalCosts]);
    if (way && way.cost > 0) {
      const r = commuteCosts(F, p.input, way, costTrace);
      apply(notes, r, id);
      if (r.deduction) {
        travel = -r.deduction.amount;
        items.push(deductionItem(r.deduction, id));
      }
    }
  }
  const cantonalTravel = -sum(
    p.costs.filter((i) => i.code === PERSON_CODES.commute[id === 'p1' ? 0 : 1]),
  );
  const earnedIncome = sum(p.earnings);
  // Form B's other lines, 3a and the buy-ins paid directly: the cantonal amounts (guide p. 54).
  const otherCosts = sum(p.costs) + cantonalTravel;
  const earned = earnedIncome + otherCosts - travel;
  const fund = francTotal(
    new Trace(),
    jobs.map((e) => e.pensionFund),
  );
  const buyIn = francTotal(new Trace(), [...jobs.map((e) => e.pensionBuyIn), p.input.pensionBuyIn]);
  const hasFund = p.input.hasPensionFund ?? fund > 0;
  return {
    id,
    earned,
    earns: earnedIncome > 0,
    contributes: hasFund || fund > 0 || buyIn > 0 || (p.input.pillar3a?.value ?? 0) > 0,
    lines: [...p.earnings, ...p.costs, ...items.slice(start)],
  };
}

/** The totals of the sheet: 7, 12, 19 and the taxable income 23, from its lines. */
export function federalTotals(items: readonly Item[]) {
  const of = (codes: readonly string[]) => items.filter((i) => codes.includes(i.code));
  const carried = of(['E1', 'E2', 'E3', 'E5']);
  const replaced = of(['E8', 'E9', 'E10']);
  const additional = of(['E13', 'E15', 'E16', 'E17', 'E18']);
  const social = of(['E20', 'E22']);
  const s7 = sum(carried);
  const s12 = s7 + sum(replaced);
  const s19 = s12 + sum(additional);
  const taxable = Math.max(0, francs(s19 + sum(social)));
  const line = (
    code: FederalCode,
    from: readonly (Line | undefined)[],
    amount: number,
    how: Text,
  ) => {
    const r = FEDERAL_RUBRICS[code];
    return new Trace()
      .src(r.source)
      .from(...from)
      .line(amount, r.label, how);
  };
  const subtotal = line(
    'E7',
    carried,
    s7,
    t(
      `The Nettoeinkommen of Ziffer 310 with the cantonal travel costs and insurance deduction added back: ${chf(s7)}.`,
      `Le revenu net de la Ziffer 310 avec les frais de déplacement et la déduction d’assurance cantonaux rajoutés${NB}: ${chf(s7)}.`,
    ),
  );
  const incomeAfterDeductions = line(
    'E12',
    [subtotal, ...replaced],
    s12,
    t(
      `${chf(s7)} less the federal travel costs and insurance deduction (${chf(-sum(replaced))}): ${chf(s12)}.`,
      `${chf(s7)} moins les frais de déplacement et la déduction d’assurance fédéraux (${chf(-sum(replaced))})${NB}: ${chf(s12)}.`,
    ),
  );
  const netIncome = line(
    'E19',
    [incomeAfterDeductions, ...additional],
    s19,
    t(
      `${chf(s12)} less the medical costs, donations, parties, two-earner and childcare deductions (${chf(-sum(additional))}): ${chf(s19)}.`,
      `${chf(s12)} moins les frais médicaux, dons, partis, double activité et frais de garde (${chf(-sum(additional))})${NB}: ${chf(s19)}.`,
    ),
  );
  const taxableIncome = line(
    'E23',
    [netIncome, ...social],
    taxable,
    t(
      `${chf(s19)} less the child and married couple deductions (${chf(-sum(social))}), in whole francs, never below zero: ${chf(taxable)}.`,
      `${chf(s19)} moins les déductions pour enfants et pour couple marié (${chf(-sum(social))}), en francs entiers, jamais négatif${NB}: ${chf(taxable)}.`,
    ),
  );
  return { subtotal, incomeAfterDeductions, netIncome, taxableIncome };
}

/** The base of the medical costs and the donations: Ziffer 12 of the sheet. */
const LINE_12 = t(
  'of the Nettoeinkommen of the Ergänzungsblatt (Ziffer 12)',
  'du revenu net de l’Ergänzungsblatt (Ziffer 12)',
);

/**
 * The federal tax of a Lucerne household, or null with why it is not computed. `icc` is the
 * computed cantonal result; the federal tax rests on its Nettoeinkommen (310).
 */
export function federalReturn(f: FederalInput): { ifd: LuIfdResult | null; notes: FederalNotes } {
  const notes = none();
  const { input, couple, icc } = f;
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
  if (notes.unsupported.length) return { ifd: null, notes };
  const hh = input.household ?? {};
  const items: Item[] = [];

  // 1. The Nettoeinkommen of the return, and 2., 3. and 5. what the federal tax counts otherwise.
  const net310 = icc.incomeAfterDeductions;
  items.push(
    sheetItem(
      'E1',
      'household',
      new Trace().from(net310),
      net310.amount,
      t(
        `The Nettoeinkommen of the return (Ziffer 310): ${chf(net310.amount)}.`,
        `Le revenu net de la déclaration (Ziffer 310)${NB}: ${chf(net310.amount)}.`,
      ),
    ),
  );
  const addBack = (code: FederalCode, from: string, person: ItemPerson) => {
    const lines = icc.items.filter((i) => i.code === from && i.person === person);
    const v = -sum(lines);
    if (v <= 0) return;
    items.push(
      sheetItem(
        code,
        person,
        new Trace().from(...lines),
        v,
        t(
          `The cantonal deduction of Ziffer ${from}, added back: ${chf(v)}.`,
          `La déduction cantonale de la Ziffer ${from}, rajoutée${NB}: ${chf(v)}.`,
        ),
      ),
    );
  };
  addBack('E2', PERSON_CODES.commute[0], 'p1');
  addBack('E3', PERSON_CODES.commute[1], 'p2');
  addBack('E5', '270', 'household');

  // 8. and 9. The federal travel costs, and each person's earned income for 17.
  const figures = f.persons.map((p) => federalPerson(F, p, items, notes));

  // 10. Insurance premiums and savings interest (LIFD art. 33 al. 1 let. g, al. 1bis).
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

  // 13. Medical costs and 15. donations, both on Ziffer 12.
  const s12 = federalTotals(items).incomeAfterDeductions;
  const mTrace = new Trace();
  const medical = francTotal(mTrace, [hh.medicalCosts]);
  if (medical > 0) {
    const r = medicalCosts(
      F.medicalThresholdBp,
      medical,
      { line: s12, name: LINE_12 },
      mTrace,
      'IFD',
    );
    apply(notes, r, 'household');
    if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
  }
  const gTrace = new Trace();
  const gifts = francTotal(gTrace, [hh.donations]);
  if (gifts > 0) {
    const r = donations(F, gifts, { line: s12, name: LINE_12 }, gTrace);
    apply(notes, r, 'household');
    if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
  }

  // 16. Political parties (LIFD art. 33 al. 1 let. i).
  const pTrace = new Trace();
  const party = francTotal(pTrace, [hh.politicalParty]);
  if (party > 0) {
    const r = politicalParty(F, party, pTrace);
    apply(notes, r, 'household');
    if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
  }

  // 17. Both spouses earn (LIFD art. 33 al. 2): the spouse who earns less.
  const [a, b] = figures;
  if (couple && a && b && a.earns && b.earns) {
    const low = a.earned <= b.earned ? a : b;
    if (low.earned > 0) {
      const r = twoEarner(F, low.earned, low.lines);
      if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
    }
  }

  // 18. Childcare (LIFD art. 33 al. 3): children under 14 living with you; spouses must both work.
  // The costs given for a child of 14 or more are left out (federalChildcare).
  const ccTrace = new Trace();
  const { care, older, perChild } = federalChildcare(f.children, undefined, ccTrace);
  if (older) add(notes.notCounted, IFD_NOTE.childcareAge);
  if (care > 0) {
    const eligible = couple ? figures.length === 2 && figures.every((x) => x.earns) : true;
    const counted = f.children.filter((c) => c.under14 !== false && (c.childcare?.value ?? 0) > 0);
    if (eligible && counted.length) {
      const r = childcareCosts(F, care, counted.length, ccTrace, perChild);
      apply(notes, r, 'household');
      if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
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

  // 20. The children and 22. the married couple.
  if (f.children.length) {
    const r = childDeduction(F, full, shared, f.childSources);
    if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
  }
  if (couple) {
    const r = marriedCouple(F);
    if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
  }

  // In the sheet's order (the sort is stable: person 1 before person 2).
  const order = Object.keys(FEDERAL_RUBRICS);
  items.sort((x, z) => order.indexOf(x.code) - order.indexOf(z.code));
  const totals = federalTotals(items);
  const grossIncome = new Trace()
    .src('lu-2025-guide-wegleitung p. 54')
    .from(icc.grossIncome)
    .line(
      icc.grossIncome.amount,
      {
        ...t(
          'Total income, federal tax (Total der Einkünfte, 301)',
          'Total des revenus, impôt fédéral (Total der Einkünfte, 301)',
        ),
        de: 'Total der Einkünfte (301), direkte Bundessteuer',
      },
      t(
        `The same income as for the cantonal tax (Wegleitung 2025, p. 54): ${chf(icc.grossIncome.amount)}.`,
        `Les mêmes revenus que pour l’impôt cantonal (Wegleitung 2025, p. 54)${NB}: ${chf(icc.grossIncome.amount)}.`,
      ),
    );
  const scaleSources = f.childSources.length
    ? [...f.childSources, `${CIRCULAR30} p. 23 (ch. 13.4.1)`]
    : [];
  const tax = ifdTax(F, totals.taxableIncome, scale.scale, scale.childReductions, scaleSources);
  return { ifd: { items, grossIncome, ...totals, ...tax }, notes };
}

export { SHEET as FEDERAL_SHEET };
