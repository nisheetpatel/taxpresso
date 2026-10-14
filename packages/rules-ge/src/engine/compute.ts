// The one entry point: computeReturn(input) gives the items of the return by rubric code and
// person, the totals, the ICC (cantonal, communal, wealth, personal tax) and the IFD, each line
// explained with its sources and estimates. First stage here (household figures to admitted
// items, every cap and threshold of the 2025 guide and the federal documents), second stage in
// ./assess.ts (items to taxes). The federal deductions are packages/rules-ch's (ifd/items.ts),
// keyed by concept: this file puts each on its Geneva rubric (RUBRIC_OF), at its place in the form.
import type { IccSplitting } from '../2025/icc.js';
import type { CommuneSlug } from '../2026/communes.js';
import {
  chf,
  childcareCosts,
  childDeduction,
  commuteBase,
  commuteCosts,
  debtInterest,
  donationDeduction,
  donations,
  federalChildcare,
  federalScale,
  flatProfessional,
  francTotal as total,
  insurancePremiums,
  marriedCouple,
  mealsCosts,
  medicalCosts,
  pillar3a,
  politicalParty,
  professionalCosts,
  roundFranc,
  SELF_EMPLOYMENT_FEDERAL,
  Trace,
  trainingCosts,
  twoEarner,
  type Deduction,
  type FederalConcept,
  type RuleLimit,
  type RuleResult,
} from '@taxpresso/rules-ch';
import { assess, incomeTotals, type Assessment } from './assess.js';
import {
  BUSINESS_NOTE,
  businessItems,
  type BusinessItems,
  type BusinessNotes,
} from './business.js';
import { capitalTax } from './capital.js';
import { ESTIMATE_TEXT, ICC_COMMUTE_PRICING, NOTE } from './explain.js';
import { avsDeduction, lifeInsuranceCap } from './rules.js';
import { paramsFor, type YearParams } from './params.js';
import { codeFor, rubric, RUBRICS, type RubricCode } from './rubrics.js';
import type {
  Amount,
  BusinessSheet,
  ChildInput,
  EngineInput,
  EnginePerson,
  EstimateNote,
  Item,
  ItemPerson,
  LimitApplied,
  Line,
  PersonInput,
  TaxResult,
  Text,
  WealthItemInput,
} from './types.js';

export class EngineInputError extends Error {}

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = '\u00a0';
const GUIDE = 'ge-2025-guide-declaration-pp';
/** ESTV circular 30 on the taxation of spouses and the family: separated parents, the scales. */
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';
/** The same codes, in the wealth column (ge-2025-declaration-specimen p. 4, PG4). */
const WEALTH_LABEL = t('Gross movable wealth (fortune brute mobilière)', 'Fortune brute mobilière');
const DEBTS_LABEL = t('Private debts (dettes chirographaires)', 'Dettes chirographaires');

class Notes {
  readonly assumptions: Text[] = [];
  readonly notCounted: Text[] = [];
  readonly unsupported: Text[] = [];
  readonly unverified: Text[] = [];
  readonly limits: LimitApplied[] = [];
  add(list: Text[], text: Text) {
    if (!list.some((x) => x.en === text.en)) list.push(text);
  }
  /**
   * A limit a rule applied (SPEC.md 10.0), cited by the constant `p` that sets it: on `code` for
   * `person` in `tax`, `given` before the rule, `limit` as applied, `counted` after it.
   */
  limit(
    p: RuleLimit['param'],
    kind: LimitApplied['kind'],
    [code, person, tax]: [string, ItemPerson, LimitApplied['tax']],
    given: number,
    limit: number,
    counted: number,
  ) {
    const estimate = p.estimate ? { estimate: true } : {};
    this.limits.push({
      code,
      person,
      tax,
      kind,
      given,
      limit,
      counted,
      source: p.source,
      ...estimate,
    });
  }
  /**
   * What a shared rule (packages/rules-ch) noted, and the limits it applied, each on its Geneva
   * rubric (`code`, by default the concept's) for `person` in `tax`.
   */
  apply(
    r: RuleResult<FederalConcept>,
    person: ItemPerson,
    tax: LimitApplied['tax'],
    code?: RubricCode,
  ) {
    for (const x of r.notCounted) this.add(this.notCounted, x);
    for (const x of r.unverified) this.add(this.unverified, x);
    for (const l of r.limits) {
      const rubricCode = codeFor(code ?? RUBRIC_OF[l.concept], person);
      this.limit(l.param, l.kind, [rubricCode, person, tax], l.given, l.limit, l.counted);
    }
  }
  /** The notes of a business (./business.ts). */
  business(): BusinessNotes {
    return {
      assumption: (x) => this.add(this.assumptions, x),
      notCounted: (x) => this.add(this.notCounted, x),
      unverified: (x) => this.add(this.unverified, x),
      limit: (p, kind, at, given, limit, counted) => this.limit(p, kind, at, given, limit, counted),
    };
  }
}

/**
 * The Geneva rubric of each deduction a shared rule computes (packages/rules-ch): the IFD column,
 * and for meals and medical costs the same rubric in the ICC column (ge-2025-declaration-specimen
 * p. 3 and 5). Pillar 3a goes to 32.40 instead for a self-employed person without salary.
 */
const RUBRIC_OF: Record<FederalConcept, RubricCode> = {
  pillar3a: '31.40',
  'professional.flat': '31.20',
  'professional.other': '31.63',
  commute: '31.71',
  meals: '31.60',
  training: '59.50',
  two_earner: '31.90',
  insurance: '52.00',
  debt_interest: '55.10',
  childcare: '59.12',
  married: '59.20',
  medical: '71.00',
  donations: '73.00',
  party: '74.00',
  child: '61.20',
};

/** The subtotals the federal and cantonal shares are taken of, as the form names them. */
const SUBTOTAL_9220 = t('the subtotal 92.20', 'du sous-total 92.20');
const SUBTOTAL_9240 = t('the subtotal 92.40', 'du sous-total 92.40');

/** An item for this rubric and person; its label and rubric source come from the catalogue. */
function item(
  code: RubricCode,
  person: ItemPerson,
  tr: Trace,
  amount: number,
  how: Text,
  label?: Text,
): Item {
  const r = RUBRICS[code];
  tr.src(r.source);
  return { code: codeFor(code, person), person, ...tr.line(amount, label ?? r.label, how) };
}

/** A deduction a shared rule computed (packages/rules-ch), as an item on its Geneva rubric. */
function deductionItem(
  d: Deduction<FederalConcept>,
  person: ItemPerson,
  code: RubricCode = RUBRIC_OF[d.concept],
): Item {
  return item(code, person, d.trace, d.amount, d.how);
}

/** A value of the état des titres as the engine reads it: its status and whether it is complete. */
const wealthAmount = (w: WealthItemInput): Amount => ({
  value: w.centimes,
  status: w.estimate ? 'estimate' : 'stated',
  complete: w.complete,
});

interface PersonFigures {
  id: EnginePerson;
  gross: number;
  social: number;
  pensionFund: number;
  /** Earned income of this person in each tax, for the two-earner deduction. */
  earnedIcc: number;
  earnedIfd: number;
  earns: boolean;
  contributes: boolean;
  /** A salary or benefits replacing it (annexe A): the person's deductions go on A1 or A2. */
  annexA: boolean;
  /** Self-employment from the accounts (annexe B), when the person has a business. */
  business?: BusinessItems;
}

/** Items of one person, the same rubrics as the annexe A of the form (guide p. 17 to 21). */
function personItems(
  P: YearParams,
  p: PersonInput,
  icc: Item[],
  ifd: Item[],
  notes: Notes,
  incomeByCommune: Partial<Record<CommuneSlug, number>>,
  commune: CommuneSlug,
): PersonFigures {
  const I = P.icc;
  const F = P.ifd;
  const jobs = p.employments ?? [];
  const both = (it: Item) => (icc.push(it), ifd.push(it));
  const start = { icc: icc.length, ifd: ifd.length };

  // Income.
  const gTrace = new Trace();
  const gross = total(
    gTrace,
    jobs.map((e) => e.gross),
  );
  if (gross > 0) {
    both(
      item(
        '11.10',
        p.id,
        gTrace,
        gross,
        t(
          `Box 8 (total gross salary) of ${jobs.length} salary certificate${jobs.length > 1 ? 's' : ''}: ${chf(gross)}.`,
          `Chiffre 8 (salaire brut total) de ${jobs.length} certificat${jobs.length > 1 ? 's' : ''} de salaire${NB}: ${chf(gross)}.`,
        ),
      ),
    );
    for (const e of jobs) {
      const c = e.workCommune && e.workCommune !== 'outside' ? e.workCommune : commune;
      incomeByCommune[c] = (incomeByCommune[c] ?? 0) + roundFranc(e.gross.value);
    }
  }
  const simple = (code: RubricCode, amount: Amount | undefined, en: string, fr: string) => {
    const tr = new Trace();
    const v = total(tr, [amount]);
    if (v > 0) both(item(code, p.id, tr, v, t(`${en}: ${chf(v)}.`, `${fr}${NB}: ${chf(v)}.`)));
    return v;
  };
  const replacement = simple(
    '11.50',
    p.replacementIncome,
    'Benefits not paid through the employer',
    'Indemnités non versées par l’employeur',
  );
  const self = simple(
    '12.01',
    p.selfEmploymentProfit,
    'Net self-employment income, as given',
    'Revenu net de l’activité indépendante, tel que donné',
  );
  // Self-employment from the accounts, annexe B (./business.ts): the result (12.01 or 57.10),
  // earlier losses (57.20) and the owner's AVS/AI/APG contributions (32.10, 32.11).
  let business: BusinessItems | undefined;
  if (p.business) {
    if (p.selfEmploymentProfit) {
      throw new EngineInputError(`${p.id}: a business or a self-employment profit, not both`);
    }
    business = businessItems(P, p.id, p.business, notes.business());
    icc.push(...business.icc);
    ifd.push(...business.ifd);
  }
  simple(
    '17.10',
    p.pensionAvs,
    'AVS/AI pension, taxed in full',
    'Rente AVS/AI, imposable en totalité',
  );
  simple(
    '13.20',
    p.pensionOccupational,
    'Pension fund pension, taxed in full',
    'Rente de la prévoyance professionnelle, imposable en totalité',
  );
  simple('13.40', p.pensionOther, 'Other pension, taxed in full', 'Autre rente, imposable à 100 %');
  simple('13.10', p.alimonyReceived, 'Alimony received', 'Pension alimentaire reçue');

  // Contributions (ICC and IFD alike).
  const sTrace = new Trace();
  const social = total(
    sTrace,
    jobs.map((e) => e.socialContributions),
  );
  if (social > 0) {
    both(
      item(
        '31.10',
        p.id,
        sTrace,
        -social,
        t(
          `Box 9 of the salary certificates: ${chf(social)}.`,
          `Chiffre 9 des certificats de salaire${NB}: ${chf(social)}.`,
        ),
      ),
    );
  }
  const lTrace = new Trace();
  const pensionFund = total(
    lTrace,
    jobs.map((e) => e.pensionFund),
  );
  if (pensionFund > 0) {
    both(
      item(
        '31.12',
        p.id,
        lTrace,
        -pensionFund,
        t(
          `Box 10.1 of the salary certificates: ${chf(pensionFund)}.`,
          `Chiffre 10.1 des certificats de salaire${NB}: ${chf(pensionFund)}.`,
        ),
      ),
    );
  }
  const bTrace = new Trace();
  const buyIn = total(bTrace, [...jobs.map((e) => e.pensionBuyIn), p.pensionBuyIn]);
  if (buyIn > 0) {
    both(
      item(
        '31.30',
        p.id,
        bTrace,
        -buyIn,
        t(
          `Buy-ins (box 10.2 and attestations): ${chf(buyIn)}, deductible in full.`,
          `Rachats (chiffre 10.2 et attestations)${NB}: ${chf(buyIn)}, déductibles en totalité.`,
        ),
      ),
    );
  }

  // Pillar 3a: federal limits, the same for the cantonal tax (LIPP art. 31 let. c).
  const hasFund = p.hasPensionFund ?? pensionFund > 0;
  const p3a = pillar3a(F, {
    paid: p.pillar3a,
    catchUp: p.pillar3aCatchUp,
    hasFund,
    gross,
    social,
    self,
    earnedFrom: [gTrace, sTrace],
    cantonalLaw: ['ge-na-law-lipp art. 31 let. c'],
    // The business result less the owner's AVS contributions (ge-2025-guide-independants p. 23).
    ...(business
      ? {
          business: {
            earned: business.earned,
            known: business.year.hasAccounts,
            trace: business.year.earned.trace,
            instructions: SELF_EMPLOYMENT_FEDERAL[P.taxYear].instructions,
          },
        }
      : {}),
  });
  const paid = p3a.paid;
  // A self-employed person without salary declares it on the annexe B (32.40, specimen p. 10).
  const code3a: RubricCode =
    gross + replacement === 0 && (self > 0 || business !== undefined) ? '32.40' : '31.40';
  notes.apply(p3a, p.id, 'both', code3a);
  if (p3a.deduction) both(deductionItem(p3a.deduction, p.id, code3a));

  // Professional expenses, for salaried work and the benefits that replace it: the flat
  // deductions are 3 % of the code 11.00 (annexe A income) less 31.10 and 31.12 (guide p. 19).
  const annexA = gross + replacement;
  if (annexA > 0) {
    const canteen = jobs.some((e) => e.canteen === true);
    const freeTransport = jobs.some((e) => e.freeTransport === true);
    const net = annexA - social - pensionFund;
    // Travel to work, before the caps: what was paid, the federal flat amount for a bike, or the
    // kilometres when no public transport can be used.
    const costTrace = new Trace();
    const way = gross > 0 ? commuteBase(F, p, costTrace) : undefined;
    const commute = way?.cost ?? 0;
    const other = total(costTrace, [p.otherProfessionalCosts]);
    const home = p.commuteMode?.by === 'home';
    if (gross > 0 && home) notes.add(notes.notCounted, NOTE.workFromHome);
    if (gross > 0 && !way && !home && p.commuteMode?.by !== 'walk' && !freeTransport) {
      notes.add(
        notes.notCounted,
        t(
          'Commuting costs (frais de déplacement): no amount given, so none are counted.',
          `Frais de déplacement${NB}: aucun montant indiqué, rien n’est compté.`,
        ),
      );
    }
    if (gross > 0 && p.mealDays === undefined && !home) {
      notes.add(
        notes.notCounted,
        t(
          'Meals away from home (frais de repas): no number of days given, so none are counted.',
          `Frais de repas${NB}: aucun nombre de jours indiqué, rien n’est compté.`,
        ),
      );
    }
    const days = home ? 0 : (p.mealDays ?? 0);
    if (gross > 0 && days > 0 && !p.mealsIccAllowed) {
      notes.add(notes.notCounted, NOTE.mealsIccLimited);
    }
    /** Meals away from home, for someone with a salary, at the day rate and yearly limit of `m`. */
    const meals = (m: Parameters<typeof mealsCosts>[0]) =>
      mealsCosts(m, { days: gross > 0 ? days : 0, canteen, facts: p.mealFacts });

    // ICC: the flat 3 % covers every professional cost (LIPP art. 29 al. 2); actual costs instead
    // when higher (guide p. 22).
    const flatTrace = new Trace().with(gTrace, sTrace, lTrace);
    const fl = flatTrace.p(I.professionalFlat);
    const flat = flatProfessional(net, fl);
    const cTrace = new Trace().with(costTrace).src(...costTrace.sources);
    const commuteIcc = freeTransport ? 0 : Math.min(commute, cTrace.p(I.commuteMax));
    const mealsIccRule = meals(I.meals);
    const mealsIcc =
      p.mealsIccAllowed && mealsIccRule.deduction ? -mealsIccRule.deduction.amount : 0;
    const actual = commuteIcc + mealsIcc + other;
    const choice: [string, ItemPerson, 'icc'] = [codeFor('31.50', p.id), p.id, 'icc'];
    const usedIcc = Math.max(actual, flat);
    if (actual) notes.limit(I.professionalFlat, 'choice', choice, actual, flat, usedIcc);
    if (actual > flat) {
      notes.add(
        notes.assumptions,
        t(
          'Professional expenses: your actual costs are higher than the flat deduction, so they are used.',
          `Frais professionnels${NB}: vos frais effectifs dépassent le forfait, ils sont retenus.`,
        ),
      );
      if (commuteIcc && way) {
        if (way.federalPricing) notes.add(notes.unverified, ICC_COMMUTE_PRICING[P.taxYear]);
        const at: [string, ItemPerson, 'icc'] = [codeFor('31.70', p.id), p.id, 'icc'];
        notes.limit(I.commuteMax, 'cap', at, commute, I.commuteMax.value, commuteIcc);
        icc.push(
          item(
            '31.70',
            p.id,
            cTrace,
            -commuteIcc,
            t(
              `${way.how.en}, at most ${chf(I.commuteMax.value)} whatever the means of transport: ${chf(commuteIcc)}.`,
              `${way.how.fr}, au plus ${chf(I.commuteMax.value)} quel que soit le moyen de transport${NB}: ${chf(commuteIcc)}.`,
            ),
          ),
        );
      }
      if (mealsIcc && mealsIccRule.deduction) {
        notes.apply(mealsIccRule, p.id, 'icc');
        icc.push(deductionItem(mealsIccRule.deduction, p.id));
      }
      if (other)
        icc.push(
          item(
            '31.63',
            p.id,
            new Trace().with(costTrace),
            -other,
            t(`Other actual costs: ${chf(other)}.`, `Autres frais effectifs${NB}: ${chf(other)}.`),
          ),
        );
    } else {
      icc.push(
        item(
          '31.50',
          p.id,
          flatTrace,
          -flat,
          t(
            `3 % of the salary after social and pension fund contributions (${chf(net)}), to the franc, between ${chf(fl.min)} and ${chf(fl.max)}: ${chf(flat)}.`,
            `3${NB}% du salaire après cotisations AVS et 2e pilier (${chf(net)}), au franc, entre ${chf(fl.min)} et ${chf(fl.max)}${NB}: ${chf(flat)}.`,
          ),
        ),
      );
    }

    // IFD: commuting and meals on their own, the flat 3 % for the other costs (LIFD art. 26).
    const prof = professionalCosts(F, net, other, [gTrace, sTrace, lTrace], costTrace);
    notes.apply(prof, p.id, 'ifd');
    if (prof.deduction) ifd.push(deductionItem(prof.deduction, p.id));
    if (!freeTransport && commute > 0 && way) {
      const travel = commuteCosts(F, p, way, costTrace, P.taxYear);
      notes.apply(travel, p.id, 'ifd');
      if (travel.deduction) ifd.push(deductionItem(travel.deduction, p.id));
    }
    if (freeTransport) {
      notes.add(
        notes.notCounted,
        t(
          'Box F is ticked on a salary certificate: your employer pays the commute, so no commuting deduction.',
          `La case F est cochée sur un certificat de salaire${NB}: l’employeur paie le trajet, pas de déduction pour les déplacements.`,
        ),
      );
    }
    const mealsIfd = meals(F.meals);
    if (mealsIfd.deduction) {
      notes.apply(mealsIfd, p.id, 'ifd');
      ifd.push(deductionItem(mealsIfd.deduction, p.id));
    }
  }

  // Training (59.50), per person.
  const trTrace = new Trace();
  const training = total(trTrace, [p.trainingCosts]);
  if (training > 0) {
    const ti = new Trace().with(trTrace);
    const vi = Math.min(training, ti.p(I.trainingMax));
    notes.limit(I.trainingMax, 'cap', ['59.50', p.id, 'icc'], training, I.trainingMax.value, vi);
    icc.push(
      item(
        '59.50',
        p.id,
        ti,
        -vi,
        t(
          `Paid ${chf(training)}, at most ${chf(I.trainingMax.value)}: ${chf(vi)}.`,
          `Payé ${chf(training)}, au plus ${chf(I.trainingMax.value)}${NB}: ${chf(vi)}.`,
        ),
      ),
    );
    const federal = trainingCosts(F, training, trTrace);
    notes.apply(federal, p.id, 'ifd');
    if (federal.deduction) ifd.push(deductionItem(federal.deduction, p.id));
  }

  const own = (list: Item[], from: number) =>
    list.slice(from).filter((i) => i.person === p.id && !i.code.startsWith('59'));
  // The earned income of each activity after its deductions: salary less 31.10 to 31.63, the
  // business result (12.01, or the loss 57.10) less 32.10 to 32.40 (ge-2025-guide-independants
  // p. 23; ge-2025-guide-declaration-pp p. 21).
  const earned = (list: Item[], from: number) =>
    own(list, from).reduce(
      (s, i) =>
        s +
        (['11.10', '21.10', '11.50', '21.50', '12.01', '22.01', '57.10'].includes(i.code) ||
        i.code[0] === '3' ||
        i.code[0] === '4'
          ? i.amount
          : 0),
      0,
    );
  return {
    id: p.id,
    gross,
    social,
    pensionFund,
    earnedIcc: earned(icc, start.icc),
    earnedIfd: earned(ifd, start.ifd),
    // A business is an activity, also in a year with a loss (childcare, two earners).
    earns: gross + replacement + self > 0 || business !== undefined,
    contributes: hasFund || pensionFund > 0 || buyIn > 0 || paid > 0,
    annexA: annexA > 0,
    ...(business ? { business } : {}),
  };
}

export function computeReturn(input: EngineInput): TaxResult {
  const P = paramsFor(input.taxYear);
  const I = P.icc;
  const F = P.ifd;
  const notes = new Notes();
  const couple = input.civilStatus === 'married';
  const people = [...input.people].sort((a, b) => a.id.localeCompare(b.id));
  if (!people.some((p) => p.id === 'p1')) throw new EngineInputError('people must include p1');
  if (!couple && people.some((p) => p.id === 'p2')) {
    throw new EngineInputError('p2 is the spouse: only for a married couple');
  }
  if (!(input.commune in P.communes.centimes.value)) {
    throw new EngineInputError(`Unknown commune ${input.commune}`);
  }
  for (const b of input.capital?.benefits ?? []) {
    if (!people.some((p) => p.id === b.person)) {
      throw new EngineInputError(
        `A lump sum (capital.benefits) for ${b.person}, not in the household`,
      );
    }
  }
  // A parent without a partner sharing custody: child support decides whose the children are for
  // the deductions, the splitting and the federal scale (circular 30, ch. 14.4 and 14.5; guide p. 45
  // and 46). Received: they count in full here; paid: they count for the other parent.
  let children: readonly ChildInput[] = input.children ?? [];
  const sharedAlone = !couple && children.some((c) => c.custody === 'shared');
  const support = sharedAlone ? input.childSupport : undefined;
  /** Where the attribution of the children comes from, per tax, when it applied. */
  const custody = { icc: [] as string[], ifd: [] as string[] };
  if (support === 'receives') {
    children = children.map((c) => (c.custody === 'shared' ? { ...c, custody: 'full' } : c));
    custody.icc.push(`${GUIDE} p. 45 and 46`);
    custody.ifd.push(`${CIRCULAR30} p. 24 and 33 (ch. 13.4.2, 14.5)`);
    notes.add(notes.assumptions, NOTE.supportReceived);
  } else if (support === 'pays') {
    children = children.filter((c) => c.custody !== 'shared');
    custody.icc.push(`${GUIDE} p. 45 and 46`);
    custody.ifd.push(`${CIRCULAR30} p. 24, 32 and 33 (ch. 13.4.2, 14.5)`);
    notes.add(notes.notCounted, NOTE.supportPaid);
  } else if (sharedAlone && input.ifdParentalScale !== undefined) {
    custody.icc.push(`${GUIDE} p. 46`);
    custody.ifd.push(`${CIRCULAR30} p. 19, 24 and 32 (ch. 10.2, 13.4.2, 14.4)`);
  }
  const full = children.filter((c) => c.custody === 'full').length;
  const shared = children.filter((c) => c.custody === 'shared').length;
  const hh = input.household ?? {};

  const icc: Item[] = [];
  const ifd: Item[] = [];
  const incomeByCommune: Partial<Record<CommuneSlug, number>> = {};
  const figures = people.map((p) =>
    personItems(P, p, icc, ifd, notes, incomeByCommune, input.commune),
  );

  // Bank accounts and securities (état des titres), per owner.
  const owners = new Map<
    ItemPerson,
    { value: Trace; income: Trace; values: Amount[]; incomes: Amount[] }
  >();
  for (const m of input.movable ?? []) {
    const o = owners.get(m.owner) ?? {
      value: new Trace(),
      income: new Trace(),
      values: [],
      incomes: [],
    };
    if (m.value) o.values.push(m.value);
    if (m.income) o.incomes.push(m.income);
    owners.set(m.owner, o);
  }
  // The business wealth first, as on PG4 (12.00 actifs commerciaux, 57.00 passifs, 51.60).
  const wealthItems: Item[] = figures.flatMap((f) => f.business?.wealth ?? []);
  let wealthIncome = 0;
  for (const [owner, o] of owners) {
    const inc = total(o.income, o.incomes);
    if (inc > 0) {
      wealthIncome += inc;
      const it = item(
        '14.00',
        owner,
        o.income,
        inc,
        t(
          `Gross income of the securities and accounts (état des titres): ${chf(inc)}.`,
          `Rendement brut des titres et comptes (état des titres)${NB}: ${chf(inc)}.`,
        ),
      );
      icc.push(it);
      ifd.push(it);
    }
    const val = total(o.value, o.values);
    if (val > 0) {
      wealthItems.push(
        item(
          '14.00',
          owner,
          o.value,
          val,
          t(
            `Taxable value on 31 December of the securities and accounts: ${chf(val)}.`,
            `Valeur imposable au 31 décembre des titres et comptes${NB}: ${chf(val)}.`,
          ),
          WEALTH_LABEL,
        ),
      );
    }
  }
  const oTrace = new Trace();
  const otherAssets = total(oTrace, [hh.otherAssets]);
  if (otherAssets > 0) {
    wealthItems.push(
      item(
        '16.40',
        'household',
        oTrace,
        otherAssets,
        t(`As given: ${chf(otherAssets)}.`, `Tel que donné${NB}: ${chf(otherAssets)}.`),
      ),
    );
  }
  const dTrace = new Trace();
  const debts = total(dTrace, [hh.debts]);
  if (debts > 0) {
    wealthItems.push(
      item(
        '55.10',
        'household',
        dTrace,
        -debts,
        t(
          `Private debts on 31 December: ${chf(debts)}.`,
          `Dettes privées au 31 décembre${NB}: ${chf(debts)}.`,
        ),
        DEBTS_LABEL,
      ),
    );
  }

  // The état des titres and the other movable wealth, as the securities rules compute them.
  const lifeExtra: Amount[] = [];
  const interestExtra: Amount[] = [];
  const credit = { ia: [] as WealthItemInput[], ies: [] as WealthItemInput[] };
  for (const w of input.wealthItems ?? []) {
    const tr = new Trace().src(w.source);
    const v = roundFranc(tr.a(wealthAmount(w)));
    const line = (amount: number, how: Text): Item => ({
      code: w.code,
      person: w.person,
      ...tr.line(amount, w.label, how),
    });
    const as = t('From the securities list (état des titres)', 'Selon l’état des titres');
    if (w.part === 'income' && v) {
      wealthIncome += v;
      const it = line(v, t(`${as.en}: ${chf(v)}.`, `${as.fr}${NB}: ${chf(v)}.`));
      if (w.taxes.includes('icc')) icc.push(it);
      if (w.taxes.includes('ifd')) ifd.push(it);
    } else if (w.part === 'wealth' && v) {
      wealthItems.push(line(v, t(`${as.en}: ${chf(v)}.`, `${as.fr}${NB}: ${chf(v)}.`)));
    } else if (w.part === 'wealth_deduction' && v) {
      wealthItems.push(line(-v, t(`${as.en}: ${chf(v)}.`, `${as.fr}${NB}: ${chf(v)}.`)));
    } else if (w.part === 'deduction') {
      // 56.30 and 52.11 count within the insurance limits (52.15, 52.00); 55.10 within the
      // interest limit; the costs (56.20) in full.
      if (w.code === '56.30' || w.code === '52.11') lifeExtra.push(wealthAmount(w));
      else if (w.code === '55.10') interestExtra.push(wealthAmount(w));
      else if (v) {
        const it = line(-v, t(`${as.en}: ${chf(v)}.`, `${as.fr}${NB}: ${chf(v)}.`));
        if (w.taxes.includes('icc')) icc.push(it);
        if (w.taxes.includes('ifd')) ifd.push(it);
      }
    } else if (w.part === 'credit') {
      if (w.code === 'F1.IA') credit.ia.push(w);
      else credit.ies.push(w);
    }
  }

  // Health insurance subsidy: income for the ICC (guide p. 27); exempt for the IFD (LIFD art. 24
  // let. d), where only the premiums left to pay are deducted.
  const subTrace = new Trace();
  const subsidy = total(subTrace, [hh.healthSubsidy]);
  if (subsidy > 0) {
    icc.push(
      item(
        '16.30',
        'household',
        subTrace,
        subsidy,
        t(
          `Subsidy received, declared as income; the full premium is deducted at 52.21: ${chf(subsidy)}.`,
          `Subside reçu, déclaré en revenu${NB}; la prime entière est déduite au 52.21${NB}: ${chf(subsidy)}.`,
        ),
      ),
    );
    notes.add(notes.unverified, NOTE.subsidyIfd);
  }

  // Two earners (31.90 IFD, 31.95 ICC): the spouse who earns less. Self-employed without a salary,
  // on annexe B instead (32.90, 32.95: ge-2025-guide-independants p. 23 and 24).
  const [a, b] = figures;
  const onB = (f: PersonFigures) => f.business !== undefined && !f.annexA;
  if (couple && a && b && a.earns && b.earns) {
    const lowIcc = a.earnedIcc <= b.earnedIcc ? a : b;
    if (lowIcc.earnedIcc > 0) {
      // Rests on the lower earner's income and deductions, and their estimates.
      const tr = new Trace().from(...icc.filter((i) => i.person === lowIcc.id));
      const v = Math.min(tr.p(I.twoEarner), lowIcc.earnedIcc);
      icc.push(
        item(
          onB(lowIcc) ? '32.95' : '31.95',
          lowIcc.id,
          tr,
          -v,
          t(
            `Both spouses work: ${chf(I.twoEarner.value)} off the lower earned income (${chf(lowIcc.earnedIcc)}): ${chf(v)}.`,
            `Les deux conjoints travaillent${NB}: ${chf(I.twoEarner.value)} sur le revenu d’activité le plus bas (${chf(lowIcc.earnedIcc)})${NB}: ${chf(v)}.`,
          ),
        ),
      );
    }
    const lowIfd = a.earnedIfd <= b.earnedIfd ? a : b;
    if (lowIfd.earnedIfd > 0) {
      const lower = ifd.filter((i) => i.person === lowIfd.id);
      const federal = twoEarner(F, lowIfd.earnedIfd, lower);
      if (federal.deduction) {
        ifd.push(deductionItem(federal.deduction, lowIfd.id, onB(lowIfd) ? '32.90' : undefined));
      }
    }
  }

  // Health and accident premiums, ICC: twice the cantonal average premium per person, by age.
  const hTrace = new Trace();
  const premiums = total(hTrace, [hh.healthPremiums, hh.accidentPremiums]);
  if (premiums > 0) {
    const hi = new Trace().with(hTrace);
    const caps = hi.p(I.healthCap);
    const adults = people.map((p) => (p.age === 'young' ? caps.young : caps.adult));
    const kids = children.map((c) =>
      c.age === 'adult' ? caps.adult : c.age === 'young' ? caps.young : caps.child,
    );
    const cap = [...adults, ...kids].reduce((s, v) => s + v, 0);
    const v = Math.min(premiums, cap);
    notes.limit(I.healthCap, 'cap', ['52.21', 'household', 'icc'], premiums, cap, v);
    icc.push(
      item(
        '52.21',
        'household',
        hi,
        -v,
        t(
          `Premiums ${chf(premiums)}; at most ${chf(cap)} for ${adults.length} adult${adults.length > 1 ? 's' : ''}${kids.length ? ` and ${kids.length} child${kids.length > 1 ? 'ren' : ''}` : ''}: ${chf(v)}.`,
          `Primes ${chf(premiums)}${NB}; au plus ${chf(cap)} pour ${adults.length} adulte${adults.length > 1 ? 's' : ''}${kids.length ? ` et ${kids.length} enfant${kids.length > 1 ? 's' : ''}` : ''}${NB}: ${chf(v)}.`,
        ),
      ),
    );
    if (people.some((p) => !p.age) || children.some((c) => !c.age))
      notes.add(notes.assumptions, NOTE.ages);
  }

  // Life insurance and savings interest, ICC 52.15.
  const lifeTrace = new Trace();
  const life = total(lifeTrace, [hh.lifeInsurancePremiums, hh.savingsInterest, ...lifeExtra]);
  const charges = full + shared / 2;
  const contributing = figures.filter((f) => f.contributes).length;
  if (life > 0) {
    const li = new Trace().with(lifeTrace);
    const { exact, cap } = lifeInsuranceCap(li.p(I.lifeInsurance), couple, contributing, charges);
    if (cap !== exact) notes.add(notes.unverified, NOTE.halfFranc);
    const v = Math.min(life, cap);
    notes.limit(I.lifeInsurance, 'cap', ['52.15', 'household', 'icc'], life, cap, v);
    icc.push(
      item(
        '52.15',
        'household',
        li,
        -v,
        t(
          `Life insurance and savings interest ${chf(life)}; limit ${chf(cap)}: ${chf(v)}.`,
          `Assurance-vie et intérêts d’épargne ${chf(life)}${NB}; limite ${chf(cap)}${NB}: ${chf(v)}.`,
        ),
      ),
    );
  }

  // Insurance premiums and savings interest, IFD 52.00 (premiums net of any subsidy).
  const insurance = insurancePremiums(F, {
    premiums,
    subsidy,
    life,
    couple,
    contributing: contributing > 0,
    full,
    shared,
    inputs: [hTrace, lifeTrace, subTrace],
  });
  notes.apply(insurance, 'household', 'ifd');
  if (insurance.deduction) ifd.push(deductionItem(insurance.deduction, 'household'));

  // Alimony paid, debt interest, bank costs: the same in both taxes.
  const both = (it: Item) => (icc.push(it), ifd.push(it));
  const alTrace = new Trace();
  const alimony = total(alTrace, [hh.alimonyPaid]);
  if (alimony > 0)
    both(
      item(
        '53.10',
        'household',
        alTrace,
        -alimony,
        t(
          `Paid ${chf(alimony)}, deductible in full.`,
          `Versé ${chf(alimony)}, déductible en totalité.`,
        ),
      ),
    );
  const diTrace = new Trace();
  const interest = total(diTrace, [hh.debtInterest, ...interestExtra]);
  if (interest > 0) {
    const ci = new Trace().with(diTrace);
    const extra = ci.p(I.debtInterestExtra);
    const capI = wealthIncome + extra;
    const vi = Math.min(interest, capI);
    notes.limit(I.debtInterestExtra, 'cap', ['55.10', 'household', 'icc'], interest, capI, vi);
    icc.push(
      item(
        '55.10',
        'household',
        ci,
        -vi,
        t(
          `Interest ${chf(interest)}; at most the income from wealth (${chf(wealthIncome)}) + ${chf(extra)}: ${chf(vi)}.`,
          `Intérêts ${chf(interest)}${NB}; au plus le rendement de la fortune (${chf(wealthIncome)}) + ${chf(extra)}${NB}: ${chf(vi)}.`,
        ),
      ),
    );
    const federal = debtInterest(F, interest, wealthIncome, diTrace);
    notes.apply(federal, 'household', 'ifd');
    if (federal.deduction) ifd.push(deductionItem(federal.deduction, 'household'));
  }
  const fTrace = new Trace();
  const fees = total(fTrace, [hh.bankFees]);
  if (fees > 0)
    both(
      item(
        '56.20',
        'household',
        fTrace,
        -fees,
        t(`As admitted: ${chf(fees)}.`, `Tel qu’admis${NB}: ${chf(fees)}.`),
      ),
    );

  // Childcare (59.10 ICC, 59.12 IFD): children under 14; spouses must both work. Both taxes count
  // the care of each child up to the month of the 14th birthday (ge-2025-guide-declaration-pp p. 30;
  // ICC: LIPP art. 35, ge-na-law-lipp, "si l'enfant a moins de 14 ans"; IFD: LIFD art. 33 al. 3),
  // so the costs given for a child of 14 or more at the end of the year are left out of both. Each
  // child's costs count at most the maximum, then they are added up (p. 30: "pour chaque enfant
  // ... jusqu'à concurrence de"; LIPP art. 35 and LIFD art. 33 al. 3: "au plus par enfant"). An
  // amount for the household is one child's when there is one child under 14, or when it is within
  // the smaller of the two maximums; otherwise how it splits decides, and neither tax is computed
  // until it is given per child (NOTE.childcareSplit; the question ge.child_care).
  const eligible = couple ? figures.length === 2 && figures.every((f) => f.earns) : true;
  const withCosts = children.filter((c) => (c.childcare?.value ?? 0) > 0);
  const ccTrace = new Trace();
  const within = Math.min(I.childcareMax.value, F.childcareMax.value);
  const { care, older, perChild, split } = federalChildcare(
    children,
    hh.childcare,
    ccTrace,
    within,
  );
  if (older) notes.add(notes.notCounted, NOTE.childcareAge);
  const caredFor = new Set<ChildInput>();
  let careSplit = false;
  if (care > 0) {
    const young = children.filter((c) => c.under14 !== false);
    const counted =
      hh.childcare && hh.childcare.value > 0 ? young : withCosts.filter((c) => c.under14 !== false);
    if (children.some((c) => c.under14 === undefined)) notes.add(notes.assumptions, NOTE.under14);
    if (!eligible) {
      notes.add(
        notes.notCounted,
        t(
          'Childcare: both spouses must work (or study) for it to be deducted.',
          `Frais de garde${NB}: les deux conjoints doivent travailler (ou être en formation) pour les déduire.`,
        ),
      );
    } else if (split) {
      careSplit = true;
      notes.add(notes.unsupported, NOTE.childcareSplit);
    } else if (counted.length) {
      for (const c of counted) caredFor.add(c);
      const cantonal = childcareCosts(
        { childcareMax: I.childcareMax },
        care,
        counted.length,
        ccTrace,
        perChild,
      );
      for (const l of cantonal.limits) {
        notes.limit(
          I.childcareMax,
          'cap',
          ['59.10', 'household', 'icc'],
          l.given,
          l.limit,
          l.counted,
        );
      }
      const d = cantonal.deduction!;
      icc.push(item('59.10', 'household', d.trace, d.amount, d.how));
      const federal = childcareCosts(F, care, counted.length, ccTrace, perChild);
      notes.apply(federal, 'household', 'ifd');
      if (federal.deduction) ifd.push(deductionItem(federal.deduction, 'household'));
    }
  }

  // Married couple deduction, IFD (59.20). The Geneva form takes it among the other deductions,
  // before the subtotal 92.20 (guide p. 13 and 31).
  if (couple) {
    const federal = marriedCouple(F);
    if (federal.deduction) ifd.push(deductionItem(federal.deduction, 'household'));
    if ((hh.medicalCosts?.value ?? 0) > 0 || (hh.donations?.value ?? 0) > 0)
      notes.add(notes.unverified, NOTE.coupleOrder);
  }

  // Medical costs (71.00): the part above 0.5 % (ICC) or 5 % (IFD) of the subtotal 92.20.
  const mTrace = new Trace();
  const medical = total(mTrace, [hh.medicalCosts]);
  const thresholdItem = (
    list: Item[],
    bp: Parameters<typeof medicalCosts>[0],
    tax: 'ICC' | 'IFD',
  ) => {
    const base = { line: incomeTotals(list, tax).subtotal9220, name: SUBTOTAL_9220 };
    const r = medicalCosts(bp, medical, base, mTrace, tax);
    notes.apply(r, 'household', tax === 'ICC' ? 'icc' : 'ifd');
    if (r.deduction) list.push(deductionItem(r.deduction, 'household'));
  };
  if (medical > 0) {
    thresholdItem(icc, I.medicalThresholdBp, 'ICC');
    thresholdItem(ifd, F.medicalThresholdBp, 'IFD');
  }

  // Donations (73.10, 73.20) up to 20 % of the subtotal 92.40; parties (74.00).
  const gTrace = new Trace();
  const gifts = total(gTrace, [hh.donations]);
  if (gifts > 0) {
    const s = incomeTotals(icc, 'ICC').subtotal9240;
    const ti = new Trace().with(gTrace).from(s);
    const { cap: capI, deduction: vi } = donationDeduction(
      gifts,
      s.amount,
      ti.p(I.donationsShareBp),
    );
    notes.limit(I.donationsShareBp, 'cap', ['73.00', 'household', 'icc'], gifts, capI, vi);
    if (vi > 0)
      icc.push(
        item(
          '73.00',
          'household',
          ti,
          -vi,
          t(
            `Donations ${chf(gifts)}; at most 20 % of the subtotal 92.40 (${chf(s.amount)}), ${chf(capI)}: ${chf(vi)}.`,
            `Dons ${chf(gifts)}${NB}; au plus 20${NB}% du sous-total 92.40 (${chf(s.amount)}), ${chf(capI)}${NB}: ${chf(vi)}.`,
          ),
        ),
      );
    const sf = incomeTotals(ifd, 'IFD').subtotal9240;
    const federal = donations(F, gifts, { line: sf, name: SUBTOTAL_9240 }, gTrace);
    notes.apply(federal, 'household', 'ifd');
    if (federal.deduction) ifd.push(deductionItem(federal.deduction, 'household'));
  }
  const pTrace = new Trace();
  const party = total(pTrace, [hh.politicalParty]);
  if (party > 0) {
    const ti = new Trace().with(pTrace);
    const vi = Math.min(party, ti.p(I.partyMax));
    notes.limit(I.partyMax, 'cap', ['74.00', 'household', 'icc'], party, I.partyMax.value, vi);
    icc.push(
      item(
        '74.00',
        'household',
        ti,
        -vi,
        t(
          `Paid ${chf(party)}, at most ${chf(I.partyMax.value)}: ${chf(vi)}.`,
          `Versé ${chf(party)}, au plus ${chf(I.partyMax.value)}${NB}: ${chf(vi)}.`,
        ),
      ),
    );
    const federal = politicalParty(F, party, pTrace);
    notes.apply(federal, 'household', 'ifd');
    if (federal.deduction) ifd.push(deductionItem(federal.deduction, 'household'));
  }

  // Family charges (61.25 ICC, 61.20 IFD).
  if (children.length) {
    const tr = new Trace().src(...custody.icc);
    const fc = tr.p(I.familyCharge);
    let v = 0;
    const parts: string[] = [];
    for (const c of children) {
      const care = caredFor.has(c);
      const amount =
        c.custody === 'full'
          ? care
            ? fc.fullWithChildcare
            : fc.full
          : care
            ? fc.halfWithChildcare
            : fc.half;
      v += amount;
      parts.push(chf(amount));
    }
    icc.push(
      item(
        '61.25',
        'household',
        tr,
        -v,
        t(
          `${children.length} child${children.length > 1 ? 'ren' : ''} (${parts.join(' + ')}; half for shared custody, less when childcare is deducted): ${chf(v)}.`,
          `${children.length} enfant${children.length > 1 ? 's' : ''} (${parts.join(' + ')}${NB}; moitié en garde alternée, moins quand des frais de garde sont déduits)${NB}: ${chf(v)}.`,
        ),
      ),
    );
    const federal = childDeduction(F, full, shared, custody.ifd);
    if (federal.deduction) ifd.push(deductionItem(federal.deduction, 'household'));
  }

  // AVS/AI pensioners (61.30 ICC), on the subtotal 92.40.
  const rentiers = people.filter((p) => (p.pensionAvs?.value ?? 0) > 0).length;
  if (rentiers) {
    const s = incomeTotals(icc, 'ICC').subtotal9240;
    const tr = new Trace().from(s);
    const tables = tr.p(I.avsDeduction);
    const table = couple || full > 0 ? tables.couple : tables.other;
    const v = avsDeduction(table, s.amount, couple && rentiers > 1);
    if (v > 0)
      icc.push(
        item(
          '61.30',
          'household',
          tr,
          -v,
          t(
            `AVS/AI pension and a subtotal 92.40 of ${chf(s.amount)}: ${chf(v)} from the table.`,
            `Rente AVS/AI et un sous-total 92.40 de ${chf(s.amount)}${NB}: ${chf(v)} selon le tableau.`,
          ),
        ),
      );
  }

  // Splitting and scales.
  let splitting: IccSplitting = 'none';
  if (couple || full > 0) splitting = 'full';
  else if (shared > 0) {
    splitting = 'partial';
    notes.add(notes.assumptions, NOTE.partialSplitting);
  }
  if (input.splitting) splitting = input.splitting;
  if (shared > 0) notes.add(notes.assumptions, NOTE.sharedCharges);
  // Without child support, the parent who earns more has the parental scale (circular 30,
  // ch. 13.4.2 and 14.4.2): unknown, the federal tax is not computed (fail closed). The parental
  // scale can't be split: its parent has the whole reduction per child (ch. 13.4.1).
  const scale = federalScale({ couple, full, shared, parentalScale: input.ifdParentalScale });
  for (const u of scale.unsupported) notes.add(notes.unsupported, u);
  const ifdScale = scale.scale;
  const ifdUnsupported = scale.unsupported.length > 0;
  const ifdChildReductions = scale.childReductions;

  // Imputations (guide p. 38 and 39): shown next to the tax, never part of it. The état des titres
  // gives them when it is there; otherwise the withholding tax of the movable inputs.
  const whTrace = new Trace().src(`${GUIDE} p. 38`);
  const withheld = credit.ia.length
    ? credit.ia.reduce((s, w) => s + whTrace.src(w.source).a(wealthAmount(w)), 0)
    : (input.movable ?? []).reduce((s, m) => s + whTrace.a(m.withholdingSwiss), 0);
  const withholdingTax: Line | undefined =
    withheld || credit.ia.length
      ? whTrace.line(
          withheld,
          t('Swiss withholding tax claimed back (impôt anticipé)', 'Impôt anticipé à imputer'),
          t(
            `35 % withheld on Swiss income, credited against the cantonal and communal tax: ${chf(withheld)}.`,
            `35${NB}% retenus sur les revenus suisses, imputés sur l’impôt cantonal et communal${NB}: ${chf(withheld)}.`,
          ),
        )
      : undefined;
  const iesTrace = new Trace().src(`${GUIDE} p. 39`);
  const foreign = credit.ies.reduce((s, w) => s + iesTrace.src(w.source).a(wealthAmount(w)), 0);
  const foreignTax: Line | undefined = credit.ies.length
    ? iesTrace.line(
        foreign,
        t(
          'Foreign tax credit (imputation d’impôts étrangers, DA-1)',
          'Imputation d’impôts étrangers (DA-1)',
        ),
        t(
          `Foreign tax withheld that is credited (form DA-1): ${chf(foreign)}.`,
          `Impôts étrangers retenus imputés (formule DA-1)${NB}: ${chf(foreign)}.`,
        ),
      )
    : undefined;

  // Income other than salaries (pensions, securities, benefits...) belongs to the commune of
  // residence: the communal split is in proportion to all income (LCP art. 295A al. 2).
  const grossIcc = incomeTotals(icc, 'ICC').grossIncome.amount;
  const salaries = Object.values(incomeByCommune).reduce((s, v) => s + (v ?? 0), 0);
  if (grossIcc > salaries) {
    incomeByCommune[input.commune] = (incomeByCommune[input.commune] ?? 0) + grossIcc - salaries;
  }

  const result: Assessment = assess({
    taxYear: input.taxYear,
    commune: input.commune,
    couple,
    splitting,
    ifdScale,
    ifdChildReductions,
    ...(custody.ifd.length
      ? { ifdScaleSources: [...custody.ifd, `${CIRCULAR30} p. 23 (ch. 13.4.1)`] }
      : {}),
    wealthCharges: charges,
    singleWithChildren: !couple && full + shared > 0,
    incomeByCommune,
    iccItems: icc,
    wealthItems,
    ifdItems: ifd,
    credits: {
      ...(withholdingTax ? { withholdingTax } : {}),
      ...(foreignTax ? { foreignTax } : {}),
    },
  });

  if (Object.keys(incomeByCommune).some((c) => c !== input.commune))
    notes.add(notes.unverified, NOTE.communalSplit);
  notes.add(notes.unverified, NOTE.lineRounding);
  if (result.icc.taxes.personalTax.amount === 0) notes.add(notes.unverified, NOTE.personalTax);
  if (result.shieldMayApply) notes.add(notes.unsupported, NOTE.shield);

  // Annexe B: each sheet's total 32.00 (32.10 to 32.95 of the person), and a year below zero.
  const sheets: BusinessSheet[] = figures.flatMap((f) => (f.business ? [f.business.sheet] : []));
  for (const s of sheets) {
    for (const [list, sheetList, tax] of [
      [icc, s.icc, 'ICC'],
      [ifd, s.ifd, 'IFD'],
    ] as const) {
      const lines = list.filter((i) => i.person === s.person && i.code.startsWith('32.'));
      if (!lines.length) continue;
      const v = lines.reduce((sum, i) => sum + i.amount, 0);
      sheetList.push(
        item(
          '32.00',
          s.person,
          new Trace().from(...lines),
          v,
          t(
            `${lines.map((i) => i.code).join(' + ')}, ${tax}: ${chf(-v)}, to PG3 32.00.`,
            `${lines.map((i) => i.code).join(' + ')}, ${tax}${NB}: ${chf(-v)}, à reporter en PG3 32.00.`,
          ),
        ),
      );
    }
  }
  const losses = figures.some(
    (f) => f.business && (f.business.loss || f.business.year.priorLosses.cantonal.amount > 0),
  );
  if (losses && result.icc.subtotal9220.amount < 0) {
    notes.add(notes.notCounted, BUSINESS_NOTE.lossCarried);
  }
  // Self-employment beyond the simple case (the answers say so): no tax at all (fail closed).
  for (const u of input.unsupported ?? []) notes.add(notes.unsupported, u);
  // A household amount of childcare whose split between the children decides: no tax either.
  const failClosed = (input.unsupported ?? []).length > 0 || careSplit;

  // Lump sums from the 2nd pillar and pillar 3a: a tax of their own (./capital.ts), with the
  // return's splitting and federal scale (LIPP art. 45 al. 3, LIFD art. 38 al. 2).
  const outcome = capitalTax(P, input.capital, {
    taxYear: input.taxYear,
    commune: input.commune,
    people: people.map((p) => p.id),
    splitting,
    ifdScale: ifdUnsupported ? undefined : ifdScale,
  });
  for (const x of outcome.notes.unsupported) notes.add(notes.unsupported, x);
  for (const x of outcome.notes.notCounted) notes.add(notes.notCounted, x);
  for (const x of outcome.notes.assumptions) notes.add(notes.assumptions, x);
  for (const x of outcome.notes.unverified) notes.add(notes.unverified, x);
  // A buy-in and a lump sum from the 2nd pillar in the same year: the buy-in's benefits can't be
  // paid as capital for three years, and its deduction may be taken back (ch-na-law-lpp art. 79b
  // al. 3, p. 66; ge-2025-guide-declaration-pp p. 18). How much is not known: fail closed.
  const buyInConflict = outcome.secondPillar.some((p) =>
    icc.some((i) => i.code === codeFor('31.30', p) && i.amount < 0),
  );
  if (buyInConflict) notes.add(notes.unsupported, NOTE.capitalBuyIn);

  const icc_ = result.shieldMayApply || buyInConflict || failClosed ? null : result.icc;
  const ifd_ = ifdUnsupported || buyInConflict || failClosed ? null : result.ifd;
  const capital = outcome.capital;
  const partial = (input.wealthItems ?? []).filter((w) => !w.complete);
  const incomplete = partial.map((w) =>
    t(
      `${w.label.en}: some amounts are not known yet, so this is a floor.`,
      `${w.label.fr}${NB}: certains montants ne sont pas encore connus, c’est un minimum.`,
    ),
  );
  if (input.people.some((pp) => pp.employments?.some((e) => e.gross.complete === false))) {
    incomplete.push(
      t(
        'A salary is known only in part, so the taxes are floors.',
        `Un salaire n’est connu qu’en partie${NB}: les impôts sont des minimums.`,
      ),
    );
  }
  const lines = allLines({ icc: icc_, ifd: ifd_, ...(capital ? { capital } : {}) });
  return {
    taxYear: input.taxYear,
    commune: input.commune,
    icc: icc_,
    ifd: ifd_,
    total: icc_ && ifd_ ? icc_.taxes.total.amount + ifd_.tax.amount : null,
    ...(capital ? { capital } : {}),
    estimates: estimateNotes(icc_, ifd_, capital),
    complete: !lines.some((l) => l.incomplete) && !incomplete.length,
    incomplete,
    needsOk: [
      ...(icc_?.items ?? []),
      ...(ifd_?.items ?? []),
      ...(icc_?.wealth.items ?? []),
      ...(capital?.items ?? []),
    ].filter((i) => i.needsOk).length,
    assumptions: notes.assumptions,
    notCounted: notes.notCounted,
    unsupported: notes.unsupported,
    unverifiedRules: notes.unverified,
    limits: notes.limits,
    ...(sheets.length && !failClosed ? { business: sheets } : {}),
  };
}

/** Every line of a result, items first; the tax on pension capital last. */
export function allLines(r: Pick<TaxResult, 'icc' | 'ifd' | 'capital'>): (Line | Item)[] {
  const out: (Line | Item)[] = [];
  if (r.icc) {
    const i = r.icc;
    out.push(
      ...i.items,
      i.grossIncome,
      i.subtotal9220,
      i.subtotal9240,
      i.netIncome,
      i.totalIncome,
      i.taxableIncome,
      i.rateIncome,
    );
    out.push(
      ...i.wealth.items,
      i.wealth.grossWealth,
      i.wealth.netWealth,
      i.wealth.socialDeduction,
      i.wealth.taxableWealth,
    );
    const x = i.taxes;
    out.push(
      x.incomeBase,
      x.incomeCantonalCentimes,
      x.incomeReduction12,
      x.incomeHomeCare,
      x.incomeCantonal,
    );
    out.push(
      x.wealthBase,
      x.wealthCantonalCentimes,
      x.wealthHomeCare,
      x.wealthSupplementary,
      x.wealthCantonal,
    );
    for (const s of [x.communalIncome, x.communalWealth]) {
      out.push(s.privileged.base, s.privileged.tax, ...s.rest.flatMap((r) => [r.base, r.tax]));
    }
    out.push(x.communalIncomeTotal, x.communalWealthTotal, x.personalTax, x.total);
  }
  if (r.ifd) {
    const f = r.ifd;
    out.push(
      ...f.items,
      f.grossIncome,
      f.subtotal9220,
      f.subtotal9240,
      f.netIncome,
      f.totalIncome,
      f.taxableIncome,
      f.scaleIncome,
      f.scaleTax,
      f.childReduction,
      f.tax,
    );
  }
  if (r.capital) out.push(...capitalLines(r.capital));
  return out;
}

/** The lines of the tax on pension capital, items first. */
export function capitalLines(c: NonNullable<TaxResult['capital']>): (Line | Item)[] {
  const out: (Line | Item)[] = [...c.items, c.amount];
  if (c.icc) {
    const x = c.icc;
    out.push(
      x.rateIncome,
      x.scaleTax,
      x.base,
      x.cantonalCentimes,
      x.reduction12,
      x.homeCare,
      x.cantonal,
      x.communal,
      x.tax,
    );
  }
  if (c.ifd) out.push(c.ifd.scaleIncome, c.ifd.scaleTax, c.ifd.tax);
  if (c.total) out.push(c.total);
  return out;
}

/** Rubrics the engine works out itself: they show the estimate of what they rest on, not their own. */
const DERIVED = new Set([
  '31.20',
  '41.20',
  '31.50',
  '41.50',
  '31.90',
  '41.90',
  '31.95',
  '41.95',
  '59.20',
  '61.20',
  '61.25',
  '61.30',
]);

const WHOSE: Record<string, Text> = {
  p1: { en: 'A', fr: 'A' },
  p2: { en: 'B', fr: 'B' },
};

function estimateNotes(
  icc: TaxResult['icc'],
  ifd: TaxResult['ifd'],
  capital?: TaxResult['capital'],
): EstimateNote[] {
  const notes = new Map<string, EstimateNote>();
  // One note for the figures the user gave as estimates, naming each rubric once.
  const given = new Map<string, Text>();
  for (const line of allLines({ icc, ifd, ...(capital ? { capital } : {}) })) {
    for (const e of line.estimates ?? []) {
      if (e === 'input-estimate') {
        if ('code' in line && rubric(line.code) && !DERIVED.has(line.code)) {
          const who = WHOSE[line.person];
          given.set(`${line.code}|${line.person}`, {
            en: `${line.code} ${line.label.fr}${who ? ` (${who.en})` : ''}`,
            fr: `${line.code} ${line.label.fr}${who ? ` (${who.fr})` : ''}`,
          });
        }
      } else if (e in ESTIMATE_TEXT) {
        notes.set(e, { id: e, what: ESTIMATE_TEXT[e as keyof typeof ESTIMATE_TEXT] });
      }
    }
  }
  if (given.size) {
    const list = [...given.values()];
    notes.set('input-estimate', {
      id: 'input-estimate',
      what: t(
        `Figures you gave as estimates: ${list.map((x) => x.en).join(', ')}.`,
        `Montants donnés comme estimations${NB}: ${list.map((x) => x.fr).join(', ')}.`,
      ),
    });
  }
  return [...notes.values()];
}
