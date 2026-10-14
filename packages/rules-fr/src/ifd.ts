// The federal direct tax (impôt fédéral direct) of a Fribourg household, as the tax office derives
// it from the return. The return has no federal part: "Le/la contribuable n’a pas de déclaration à
// remplir pour l’impôt fédéral direct. L’autorité détermine le revenu soumis à cet impôt en tenant
// compte des différences mentionnées ci-après" (fr-2025-guide-instructions-generales p. 47, chapter
// XI, the differences on p. 47 to 49). So the federal column is the return's lines with the
// cantonal amounts, except those the chapter lists, which the federal rules of packages/rules-ch
// give, each for the tax year (the guide prints the 2025 amounts):
//   2.110 travel, its federal maximum; 2.510 both spouses work, 50 % of the lower earned income
//   after 2.110 to 2.140, 4.130 and 4.140, between a minimum and a maximum; 4.110 and 4.150 the
//   insurance premiums of the return (the flat amount of 4.110 and the premiums of 4.120) and the
//   interest on savings of annex 01, together up to the federal maximum; 4.380 childcare, 4.410
//   political parties and 4.420 training, their federal maximums; 6.110 the children and 6.150 the
//   married couple, the federal amounts; and the reduction of the tax per child (p. 49).
// The medical costs (5.110) and donations (5.120) keep their rules but take the federal net income
// as their base, as on the return they take its 4.910. The modest income deduction (7.110) is
// cantonal only. Not covered (the cantonal tax doesn't cover them either): 3.120's pensions begun
// before 2002 on a scheme from before 1987 (taxed at 60 or 80 %, p. 47), 3.210's lottery winnings,
// 3.310, 4.160 and 4.320's stakes, 6.120.
import {
  chf,
  childDeduction,
  commuteBase,
  commuteCosts,
  donations,
  federalScale,
  francTotal,
  ifdParamsFor,
  ifdTax,
  insurancePremiums,
  marriedCouple,
  medicalCosts,
  politicalParty,
  trainingCosts,
  Trace,
  twoEarner,
  type Deduction,
  type FederalConcept,
  type IfdParams,
  type LimitApplied,
  type RuleResult,
} from '@taxpresso/rules-ch';
import { DEDUCTIONS, FEDERAL_RUBRICS, INCOME, RUBRICS, type RubricCode } from './rubrics.js';
import type {
  Amount,
  FrEngineInput,
  FrIfdResult,
  FrReturnLines,
  Item,
  ItemPerson,
  Line,
  PersonInput,
  Text,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const GUIDE = 'fr-2025-guide-instructions-generales';
/** The chapter's opening: no federal return, the authority derives the federal income. */
export const FEDERAL_CHAPTER = `${GUIDE} p. 47 (XI. Impôt fédéral direct)`;
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';

/** The lines the guide lists as different for the federal tax: their cantonal amount is replaced. */
export const FEDERAL_DIFFERENT: ReadonlySet<string> = new Set([
  '2.110',
  '2.510',
  '4.110',
  '4.120',
  '4.150',
  '4.380',
  '4.410',
  '4.420',
]);

/** Where the guide lists each difference (p. 47 to 49), by the code of the return. */
const CHAPTER: Record<string, string> = {
  '2.110': `${GUIDE} p. 47 (code 2.110)`,
  '2.510': `${GUIDE} p. 47 (code 2.510)`,
  '4.110': `${GUIDE} p. 48 (codes 4.110 and 4.150)`,
  '4.380': `${GUIDE} p. 48 (code 4.380)`,
  '4.410': `${GUIDE} p. 48 (code 4.410)`,
  '4.420': `${GUIDE} p. 48 (code 4.420)`,
  '6.110': `${GUIDE} p. 48 (code 6.110)`,
  '6.150': `${GUIDE} p. 49 (code 6.150)`,
  '5.110': FEDERAL_CHAPTER,
  '5.120': FEDERAL_CHAPTER,
};

/** What the federal part noted: the result's notes and the limits it applied. */
export interface FederalNotes {
  notCounted: Text[];
  unverified: Text[];
  unsupported: Text[];
  assumptions: Text[];
  limits: LimitApplied[];
}

/** A child as the federal tax counts it here: at your charge (the return's 6.110). */
export interface FederalChild {
  livesWithYou: boolean;
  under14?: boolean;
  childcare?: Amount;
}

export interface FederalInput {
  input: FrEngineInput;
  couple: boolean;
  /** The return's lines, computed: the federal column starts from them. */
  form: FrReturnLines;
  /** The children at your charge on the return (6.110), in full. */
  children: readonly FederalChild[];
  /** Where the attribution of the children comes from, when separated parents' support decided it. */
  childSources: readonly string[];
  /** The people, sorted. */
  people: readonly PersonInput[];
}

export const FEDERAL_NOTE = {
  elsewhere: t(
    'Federal tax not computed: a child who does not live with you is not supported yet for the federal tax.',
    `Impôt fédéral non calculé${NB}: un enfant qui ne vit pas avec vous n’est pas encore pris en charge pour l’impôt fédéral.`,
  ),
  oldPensions: t(
    'Federal tax: pension fund pensions are counted in full. One that began before 2002 and rests on a pension scheme that existed at the end of 1986 is taxed at 60 or 80 % for the federal tax (guide p. 47, code 3.120): tell the tax office if yours is one.',
    `Impôt fédéral${NB}: les rentes de la prévoyance professionnelle sont comptées en entier. Une rente qui a commencé avant 2002 et repose sur un rapport de prévoyance existant fin 1986 est imposée à 60 ou 80${NB}% pour l’impôt fédéral (guide p. 47, code 3.120)${NB}: signalez-le au Service cantonal des contributions si c’est votre cas.`,
  ),
  childcareWork: t(
    'Childcare, federal tax: both spouses must work (or study) for it to be deducted.',
    `Frais de garde, impôt fédéral${NB}: les deux conjoints doivent travailler (ou être en formation) pour les déduire.`,
  ),
} as const satisfies Record<string, Text>;

const none = (): FederalNotes => ({
  notCounted: [],
  unverified: [],
  unsupported: [],
  assumptions: [],
  limits: [],
});

function add(list: Text[], x: Text) {
  if (!list.some((y) => y.en === x.en)) list.push(x);
}

/** The code of the return each federal concept goes on. */
function codeOf(concept: FederalConcept): string {
  switch (concept) {
    case 'commute':
      return '2.110';
    case 'two_earner':
      return '2.510';
    case 'insurance':
      return '4.110';
    case 'childcare':
      return '4.380';
    case 'party':
      return '4.410';
    case 'training':
      return '4.420';
    case 'medical':
      return '5.110';
    case 'donations':
      return '5.120';
    case 'child':
      return '6.110';
    case 'married':
      return '6.150';
    default:
      throw new Error(`The federal column of the Fribourg return has no line for ${concept}.`);
  }
}

/** A federal line from a shared rule's deduction, on its code of the return. */
function deductionItem(d: Deduction<FederalConcept>, person: ItemPerson): Item {
  const code = codeOf(d.concept);
  const r =
    code === '4.110' || code === '6.150' ? FEDERAL_RUBRICS[code] : RUBRICS[code as RubricCode];
  d.trace.src(r.source, CHAPTER[code] ?? FEDERAL_CHAPTER);
  return { code, person, ...d.trace.line(d.amount, r.label, d.how) };
}

/** Records what a shared rule noted and the limits it applied, on its code of the return. */
function apply(n: FederalNotes, r: RuleResult<FederalConcept>, person: ItemPerson) {
  for (const x of r.notCounted) add(n.notCounted, x);
  for (const x of r.unverified) add(n.unverified, x);
  for (const l of r.limits) {
    n.limits.push({
      code: codeOf(l.concept),
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

/** The salary lines of a person (1.110, 1.120). */
const EARNED = new Set(['1.110', '1.120']);
/** Their costs and pension payments that the two-earner deduction comes after (p. 47). */
const EARNING_COSTS = new Set(['2.110', '2.120', '2.130', '2.140', '4.130', '4.140']);

/** The base of the medical costs and the donations: the federal 4.910. */
const BASE_NAME = t(
  'of the net income for the federal tax (code 4.910)',
  'du revenu net pour l’impôt fédéral (code 4.910)',
);

/**
 * The federal tax of a Fribourg household, or null with why it is not computed. `form` are the
 * return's computed lines; the federal column keeps them but for the differences of chapter XI.
 */
export function federalReturn(f: FederalInput): { ifd: FrIfdResult | null; notes: FederalNotes } {
  const notes = none();
  const { input, couple, form } = f;
  const F: IfdParams = ifdParamsFor(input.taxYear);
  if (f.children.some((c) => !c.livesWithYou)) add(notes.unsupported, FEDERAL_NOTE.elsewhere);
  const full = f.children.length;
  const scale = federalScale({ couple, full, shared: 0 });
  for (const u of scale.unsupported) add(notes.unsupported, u);
  if (notes.unsupported.length) return { ifd: null, notes };
  const hh = input.household ?? {};
  const items: Item[] = [];

  // The return's lines the federal tax takes as they are: the income, and the costs and general
  // deductions the chapter doesn't list.
  for (const i of form.items) {
    if (!INCOME.has(i.code) && !(DEDUCTIONS.has(i.code) && !FEDERAL_DIFFERENT.has(i.code))) {
      continue;
    }
    items.push({
      code: i.code,
      person: i.person,
      ...new Trace()
        .from(i)
        .src(FEDERAL_CHAPTER)
        .line(
          i.amount,
          i.label,
          t(
            `As on the return: ${chf(i.amount)}.`,
            `Comme dans la déclaration${NB}: ${chf(i.amount)}.`,
          ),
        ),
    });
  }
  if (f.people.some((p) => p.pensionOccupational?.value)) {
    add(notes.assumptions, FEDERAL_NOTE.oldPensions);
  }

  // 2.110 travel (LIFD art. 26 al. 1 let. a), as the cantonal line is found: only with a main job,
  // nothing with transport provided. 4.420 training (art. 33 al. 1 let. j).
  for (const p of f.people) {
    const main = (p.employments ?? []).filter((e) => !e.side);
    const gross = francTotal(
      new Trace(),
      main.map((e) => e.gross),
    );
    if (main.length && gross > 0 && !main.every((e) => e.freeTransport === true)) {
      // The trace of the professional costs given, as every canton's federal part reads them.
      const costTrace = new Trace();
      const way = commuteBase(F, p, costTrace);
      francTotal(costTrace, [p.otherProfessionalCosts]);
      if (way && way.cost > 0) {
        const r = commuteCosts(F, p, way, costTrace);
        apply(notes, r, p.id);
        if (r.deduction) items.push(deductionItem(r.deduction, p.id));
      }
    }
    if (p.trainingCosts) {
      const tr = new Trace();
      const paid = francTotal(tr, [p.trainingCosts]);
      if (paid > 0) {
        const r = trainingCosts(F, paid, tr);
        apply(notes, r, p.id);
        if (r.deduction && r.deduction.amount < 0) items.push(deductionItem(r.deduction, p.id));
      }
    }
  }

  // 2.510 both spouses work (LIFD art. 33 al. 2): 50 % of the lower earned income after its costs
  // (2.110 to 2.140, the federal travel) and its 3a and buy-ins (4.130, 4.140), p. 47.
  const earned = f.people.map((p) => {
    const lines = items.filter(
      (i) => i.person === p.id && (EARNED.has(i.code) || EARNING_COSTS.has(i.code)),
    );
    const income = lines.filter((i) => EARNED.has(i.code));
    return { id: p.id, earns: sum(income) > 0, earned: sum(lines), lines };
  });
  const [a, b] = earned;
  if (couple && a && b && a.earns && b.earns) {
    const low = a.earned <= b.earned ? a : b;
    if (low.earned > 0) {
      const r = twoEarner(F, low.earned, low.lines);
      if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
    }
  }

  // 4.110 and 4.150 (LIFD art. 33 al. 1 let. g, al. 1bis): the premiums of the return, the flat
  // amount of 4.110 (after the subsidy) and the premiums of 4.120, and the interest on savings of
  // annex 01, together up to the federal maximum for spouses or others, more when nobody pays into
  // the 2nd pillar or 3a, plus so much per child (p. 48).
  {
    const flat = -sum(form.items.filter((i) => i.code === '4.110'));
    const flatTrace = new Trace().from(...form.items.filter((i) => i.code === '4.110'));
    const lifeTrace = new Trace();
    const life = francTotal(lifeTrace, [hh.lifeInsurancePremiums, hh.savingsInterest]);
    const contributing = f.people.some(
      (p) =>
        p.hasPensionFund === true ||
        (p.employments ?? []).some(
          (e) => (e.pensionFund?.value ?? 0) > 0 || (e.pensionBuyIn?.value ?? 0) > 0,
        ) ||
        (p.pensionBuyIn?.value ?? 0) > 0 ||
        (p.pillar3a?.value ?? 0) > 0,
    );
    const r = insurancePremiums(F, {
      premiums: flat,
      subsidy: 0,
      life,
      couple,
      contributing,
      full,
      shared: 0,
      inputs: [flatTrace, lifeTrace],
    });
    apply(notes, r, 'household');
    if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
  }

  // 4.380 childcare (LIFD art. 33 al. 3): per child under 14 living with you, up to the federal
  // maximum each (p. 48); spouses must both work.
  {
    const cared = f.children.filter(
      (c) => c.livesWithYou && c.under14 !== false && (c.childcare?.value ?? 0) > 0,
    );
    if (cared.length) {
      const eligible = couple ? earned.length === 2 && earned.every((x) => x.earns) : true;
      if (!eligible) add(notes.notCounted, FEDERAL_NOTE.childcareWork);
      else {
        // One child at a time: the maximum is per child.
        const tr = new Trace();
        let paid = 0;
        let counted = 0;
        const parts: string[] = [];
        for (const c of cared) {
          const one = new Trace();
          const care = francTotal(one, [c.childcare]);
          const r = childcareCosts(F, care, one);
          apply(notes, r, 'household');
          tr.with(r.trace);
          paid += care;
          counted += r.counted;
          parts.push(chf(r.counted));
        }
        tr.p(F.childcareMax);
        if (counted > 0) {
          items.push({
            code: '4.380',
            person: 'household',
            ...tr
              .src(RUBRICS['4.380'].source, CHAPTER['4.380']!)
              .line(
                -counted,
                RUBRICS['4.380'].label,
                t(
                  `Paid ${chf(paid)}; per child under 14 living with you, at most ${chf(F.childcareMax.value)}: ${parts.join(' + ')} = ${chf(counted)}.`,
                  `Payé ${chf(paid)}${NB}; par enfant de moins de 14 ans vivant avec vous, au plus ${chf(F.childcareMax.value)}${NB}: ${parts.join(' + ')} = ${chf(counted)}.`,
                ),
              ),
          });
        }
      }
    }
  }

  // 4.410 political parties (LIFD art. 33 al. 1 let. i).
  {
    const tr = new Trace();
    const party = francTotal(tr, [hh.politicalParty]);
    if (party > 0) {
      const r = politicalParty(F, party, tr);
      apply(notes, r, 'household');
      if (r.deduction) items.push(deductionItem(r.deduction, 'household'));
    }
  }

  // In the order of the codes, person 1 before person 2 (the sort is stable).
  items.sort((x, y) => x.code.localeCompare(y.code));
  const grossIncome = new Trace()
    .from(form.grossIncome)
    .src(FEDERAL_CHAPTER)
    .line(
      form.grossIncome.amount,
      t('Total income, federal tax', 'Total des revenus, impôt fédéral direct'),
      t(
        `The same income as on the return: ${chf(form.grossIncome.amount)}.`,
        `Les mêmes revenus que dans la déclaration${NB}: ${chf(form.grossIncome.amount)}.`,
      ),
    );
  const before = sum(items);
  const incomeAfterDeductions = new Trace()
    .from(grossIncome, ...items.filter((i) => !INCOME.has(i.code)))
    .src(FEDERAL_CHAPTER)
    .line(
      before,
      t(
        'Net income for the federal tax (revenu net, 4.910)',
        'Revenu net pour l’impôt fédéral direct (4.910)',
      ),
      t(
        `Total income less the costs and general deductions of the federal tax: ${chf(before)}.`,
        `Total des revenus moins les frais et déductions générales de l’impôt fédéral${NB}: ${chf(before)}.`,
      ),
    );

  // 5.110 medical costs and 5.120 donations, both on the federal 4.910.
  const after: Item[] = [];
  {
    const tr = new Trace();
    const medical = francTotal(tr, [hh.medicalCosts]);
    if (medical > 0) {
      const r = medicalCosts(
        F.medicalThresholdBp,
        medical,
        { line: incomeAfterDeductions, name: BASE_NAME },
        tr,
        'IFD',
      );
      apply(notes, r, 'household');
      if (r.deduction) after.push(deductionItem(r.deduction, 'household'));
    }
  }
  {
    const tr = new Trace();
    const gifts = francTotal(tr, [hh.donations]);
    if (gifts > 0) {
      const r = donations(F, gifts, { line: incomeAfterDeductions, name: BASE_NAME }, tr);
      apply(notes, r, 'household');
      if (r.deduction) after.push(deductionItem(r.deduction, 'household'));
    }
  }
  const net = before + sum(after);
  const netIncome = new Trace()
    .from(incomeAfterDeductions, ...after)
    .src(FEDERAL_CHAPTER)
    .line(
      net,
      t(
        'Net income after medical costs and donations, federal tax',
        'Revenu net après frais médicaux et dons, impôt fédéral direct',
      ),
      t(
        `${chf(before)} less the medical costs and donations (${chf(-sum(after))}): ${chf(net)}.`,
        `${chf(before)} moins les frais médicaux et les dons (${chf(-sum(after))})${NB}: ${chf(net)}.`,
      ),
    );

  // 6.110 the children and 6.150 the married couple (LIFD art. 35 al. 1 let. a and c; p. 48, 49).
  const social: Item[] = [];
  if (full) {
    const r = childDeduction(F, full, 0, f.childSources);
    if (r.deduction) social.push(deductionItem(r.deduction, 'household'));
  }
  if (couple) {
    const r = marriedCouple(F);
    if (r.deduction) social.push(deductionItem(r.deduction, 'household'));
  }
  const taxable = Math.max(0, francs(net + sum(social)));
  const taxableIncome = new Trace()
    .from(netIncome, ...social)
    .src(FEDERAL_CHAPTER)
    .line(
      taxable,
      t(
        'Taxable income, federal tax (revenu imposable IFD)',
        'Revenu imposable, impôt fédéral direct',
      ),
      t(
        `${chf(net)} less the child and married couple deductions (${chf(-sum(social))}), in whole francs, never below zero: ${chf(taxable)}.`,
        `${chf(net)} moins les déductions pour enfants et pour époux (${chf(-sum(social))}), en francs entiers, jamais négatif${NB}: ${chf(taxable)}.`,
      ),
    );
  const scaleSources = f.childSources.length
    ? [...f.childSources, `${CIRCULAR30} p. 23 (ch. 13.4.1)`, `${GUIDE} p. 49`]
    : full
      ? [`${GUIDE} p. 49`]
      : [];
  const tax = ifdTax(F, taxableIncome, scale.scale, scale.childReductions, scaleSources);
  return {
    ifd: {
      items: [...items, ...after, ...social],
      grossIncome,
      incomeAfterDeductions,
      netIncome,
      taxableIncome,
      ...tax,
    },
    notes,
  };
}

/**
 * Childcare for one child (LIFD art. 33 al. 3): at most the federal maximum. The shared rule
 * (packages/rules-ch, childcareCosts) caps a total by the number of children; here each child is
 * capped on their own, as the law and the guide say ("par enfant", p. 48).
 */
function childcareCosts(
  F: Pick<IfdParams, 'childcareMax'>,
  care: number,
  input: Trace,
): RuleResult<'childcare'> & { counted: number; trace: Trace } {
  const tr = new Trace().with(input);
  const max = tr.p(F.childcareMax);
  const counted = Math.min(care, max);
  return {
    limits: [
      {
        concept: 'childcare',
        param: F.childcareMax,
        kind: 'cap',
        given: care,
        limit: max,
        counted,
      },
    ],
    notCounted: [],
    unverified: [],
    counted,
    trace: tr,
  };
}

/** The lines of a federal result, for checks and the explanation tree. */
export function federalLines(f: FrIfdResult): Line[] {
  return [
    ...f.items,
    f.grossIncome,
    f.incomeAfterDeductions,
    f.netIncome,
    f.taxableIncome,
    f.scaleIncome,
    f.scaleTax,
    f.childReduction,
    f.tax,
  ];
}
