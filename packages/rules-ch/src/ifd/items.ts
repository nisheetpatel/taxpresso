// The federal deductions (IFD), the same in every canton: each rule takes the federal constants of
// the year (./params.ts) and the household's amounts, and gives a deduction keyed by concept, not by
// a form's code. Each canton puts it on its own line (Geneva: '31.20' for the flat professional
// costs; Zurich: its Bundessteuer column) and records the limits it applied, in the order its form
// computes them. Sources: ch-na-law-lifd (art. 26, 33, 33a, 35, 36), the ESTV circulars of the
// year, Form. 2a (ch-2026-ifd-instructions-personnes-physiques) and ESTV circular 30 on spouses and
// the family (ch-na-circulaire-30-epoux-famille).
import { chf, roundFranc, Trace } from '../core/calc.js';
import { francTotal, type RuleResult } from '../core/items.js';
import type { FormBase } from '../core/items.js';
import {
  donationDeduction,
  flatProfessional,
  pillar3aCapWithoutFund,
  twoEarnerFederal,
} from '../core/rules.js';
import type { Amount, IfdScale, Line, PersonInput, Text } from '../core/types.js';
import type { IfdParams } from './params.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = '\u00a0';
/** ESTV circular 30 on the taxation of spouses and the family: separated parents, the scales. */
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';

/** What a federal deduction is, whatever line the canton's form gives it. */
export type FederalConcept =
  | 'pillar3a'
  | 'professional.flat'
  | 'professional.other'
  | 'commute'
  | 'meals'
  | 'training'
  | 'two_earner'
  | 'insurance'
  | 'debt_interest'
  | 'childcare'
  | 'married'
  | 'medical'
  | 'donations'
  | 'party'
  | 'child';

/** Plain-words notes on federal rules (SPEC.md section 11b). */
export const IFD_NOTE = {
  bikeFlat: {
    en: 'Bike or moped: the federal flat amount is for a year of trips; the federal instructions reduce it for part of a year or part-time work without saying how (Form. 2a 2026 p. 6), so it is counted in full.',
    fr: `Vélo ou cyclomoteur${NB}: le forfait fédéral vaut pour une année de trajets${NB}; les instructions fédérales le réduisent pour une partie de l’année ou un temps partiel sans dire comment (formule 2a 2026 p. 6), il est donc compté en entier.`,
  },
  ifdShared: {
    en: 'Federal tax not computed: with shared custody, the parental scale (barème parental) goes to the parent who receives child support or, without child support, to the parent who earns more (ESTV circular 30). Answer the question on child support so Taxpresso knows which parent you are.',
    fr: `Impôt fédéral non calculé${NB}: en garde alternée, le barème parental revient au parent qui reçoit la contribution d’entretien ou, sans contribution, au parent qui gagne le plus (circulaire AFC n° 30). Répondez à la question sur la contribution d’entretien pour que Taxpresso sache quel parent vous êtes.`,
  },
} as const satisfies Record<string, Text>;

const none = <C extends string>(): RuleResult<C> => ({
  limits: [],
  notCounted: [],
  unverified: [],
});

/** The way to work priced before the caps. */
export interface CommuteBase {
  /** The yearly cost of getting to work before the caps, to the franc. */
  cost: number;
  /** How it was found, in words, with the numbers (no final full stop). */
  how: Text;
  /** Priced by a federal rule a canton's guide may not repeat (a bike, the kilometres). */
  federalPricing: boolean;
}

/**
 * Travel to work before the caps (ch-2026-ifd-instructions-personnes-physiques p. 6; ge-2025-
 * guide-declaration-pp p. 20): the public transport paid, or for a driver who could have used it,
 * its price; a flat amount for a bike or a moped with a yellow plate; per kilometre, there and back
 * once a day, for a car or a motorbike when no public transport can be used. Undefined when nothing
 * is known, or nothing is spent (on foot, from home).
 */
export function commuteBase(
  F: Pick<IfdParams, 'commuteBike' | 'commuteKm'>,
  p: Pick<PersonInput, 'commuteCost' | 'commuteMode'>,
  tr: Trace,
): CommuteBase | undefined {
  const mode = p.commuteMode;
  if (mode)
    tr.a({ value: 0, facts: mode.facts ?? [], ...(mode.status ? { status: mode.status } : {}) });
  const vehicle = mode?.by === 'car' || mode?.by === 'motorbike' ? mode.by : undefined;
  const by = vehicle && t(vehicle, vehicle === 'car' ? 'voiture' : 'moto');
  if (p.commuteCost) {
    const cost = francTotal(tr, [p.commuteCost]);
    return {
      cost,
      federalPricing: false,
      how: by
        ? t(
            `By ${by.en}, public transport possible: what it would have cost, ${chf(cost)}`,
            `En ${by.fr}, transports publics possibles${NB}: ce qu’ils auraient coûté, ${chf(cost)}`,
          )
        : mode?.by === 'public_transport'
          ? t(`Public transport paid: ${chf(cost)}`, `Transports publics payés${NB}: ${chf(cost)}`)
          : t(`Commuting costs: ${chf(cost)}`, `Frais de déplacement${NB}: ${chf(cost)}`),
    };
  }
  if (mode?.by === 'bike') {
    const cost = tr.p(F.commuteBike);
    return {
      cost,
      federalPricing: true,
      how: t(
        `Bike, e-bike or moped with a yellow plate: the flat amount of ${chf(cost)}`,
        `Vélo, vélo électrique ou cyclomoteur à plaque jaune${NB}: le forfait de ${chf(cost)}`,
      ),
    };
  }
  if (vehicle && by && mode?.transitUsable === false && mode.kmOneWay && mode.days) {
    const rate = tr.p(F.commuteKm)[vehicle];
    const cost = roundFranc(mode.kmOneWay * 2 * mode.days * rate);
    return {
      cost,
      federalPricing: true,
      how: t(
        `By ${by.en}, no public transport you can use: ${mode.kmOneWay} km x 2 x ${mode.days} days x ${chf(rate)} a km = ${chf(cost)}`,
        `En ${by.fr}, sans transport public utilisable${NB}: ${mode.kmOneWay} km x 2 x ${mode.days} jours x ${chf(rate)} le km = ${chf(cost)}`,
      ),
    };
  }
  return undefined;
}

/**
 * Pillar 3a (OPP 3 art. 7, Form. 2a 2026 p. 7): what was paid, at most the limit with a pension
 * fund or, without one, a share of earned income up to a maximum; a 3a catch-up payment (rachat 3a,
 * from 2026, Form. 2a p. 8) on top, its own limits checked by the planner. The same limits serve the
 * cantonal tax: `cantonalLaw` is the canton's article that says so (Geneva: LIPP art. 31 let. c).
 * `earnedFrom` are the traces of the salary and contributions the limit without a fund rests on.
 */
export function pillar3a(
  F: Pick<IfdParams, 'pillar3a'>,
  a: {
    paid?: Amount;
    catchUp?: Amount;
    hasFund: boolean;
    gross: number;
    social: number;
    self: number;
    earnedFrom: readonly Trace[];
    cantonalLaw?: readonly string[];
  },
): RuleResult<'pillar3a'> & { paid: number } {
  const tTrace = new Trace();
  const paid = francTotal(tTrace, [a.paid]);
  const catchUp = francTotal(tTrace, [a.catchUp]);
  if (!(paid > 0 || catchUp > 0)) return { ...none(), paid };
  const out: RuleResult<'pillar3a'> & { paid: number } = { ...none(), paid };
  const lim = tTrace.p(F.pillar3a);
  tTrace.src(...(a.cantonalLaw ?? []));
  let cap = lim.withFund;
  let capHow = t(
    `the limit with a pension fund, ${chf(cap)}`,
    `la limite avec caisse de pension, ${chf(cap)}`,
  );
  if (!a.hasFund) {
    tTrace.with(...a.earnedFrom);
    const earned = Math.max(0, a.gross - a.social + a.self);
    cap = pillar3aCapWithoutFund(earned, lim);
    capHow = t(
      `without a pension fund, 20 % of earned income (${chf(earned)}) up to ${chf(lim.withoutFundMax)}: ${chf(cap)}`,
      `sans caisse de pension, 20${NB}% du revenu d’activité (${chf(earned)}) jusqu’à ${chf(lim.withoutFundMax)}${NB}: ${chf(cap)}`,
    );
    if (earned === 0) {
      out.notCounted.push(
        t(
          'Pillar 3a needs earned income: none was given, so nothing is deducted.',
          `Le 3e pilier A suppose un revenu d’activité${NB}: aucun n’est indiqué, rien n’est déduit.`,
        ),
      );
    }
  }
  const v = Math.min(paid, cap);
  if (paid)
    out.limits.push({
      concept: 'pillar3a',
      param: F.pillar3a,
      kind: 'cap',
      given: paid,
      limit: cap,
      counted: v,
    });
  if (catchUp) tTrace.src('ch-2026-ifd-instructions-personnes-physiques p. 8');
  out.deduction = {
    concept: 'pillar3a',
    amount: -(v + catchUp),
    trace: tTrace,
    how: t(
      `Paid ${chf(paid)}; at most ${capHow.en}: ${chf(v)}.${catchUp ? ` Plus a catch-up payment for earlier years (rachat 3a) of ${chf(catchUp)}.` : ''}`,
      `Versé ${chf(paid)}${NB}; au plus ${capHow.fr}${NB}: ${chf(v)}.${catchUp ? ` Plus un rachat 3a pour des années précédentes de ${chf(catchUp)}.` : ''}`,
    ),
  };
  return out;
}

/**
 * Professional costs other than travel and meals (LIFD art. 26): the flat share of the net salary
 * (`net`: salary less the social and pension fund contributions), between a minimum and a maximum,
 * or the actual costs (`other`) when higher. `salary` are the traces of the salary and
 * contributions, `costs` the trace of the actual costs.
 */
export function professionalCosts(
  F: Pick<IfdParams, 'professionalFlat'>,
  net: number,
  other: number,
  salary: readonly Trace[],
  costs: Trace,
): RuleResult<'professional.flat' | 'professional.other'> {
  const out = none<'professional.flat' | 'professional.other'>();
  const fTrace = new Trace().with(...salary);
  const ff = fTrace.p(F.professionalFlat);
  const flatIfd = flatProfessional(net, ff);
  const usedIfd = Math.max(other, flatIfd);
  if (other)
    out.limits.push({
      concept: 'professional.flat',
      param: F.professionalFlat,
      kind: 'choice',
      given: other,
      limit: flatIfd,
      counted: usedIfd,
    });
  out.deduction =
    other > flatIfd
      ? {
          concept: 'professional.other',
          amount: -other,
          trace: new Trace().with(costs),
          how: t(
            `Other actual costs, higher than the flat deduction: ${chf(other)}.`,
            `Autres frais effectifs, supérieurs au forfait${NB}: ${chf(other)}.`,
          ),
        }
      : {
          concept: 'professional.flat',
          amount: -flatIfd,
          trace: fTrace,
          how: t(
            `3 % of the salary after social and pension fund contributions (${chf(net)}), to the franc, between ${chf(ff.min)} and ${chf(ff.max)}: ${chf(flatIfd)}.`,
            `3${NB}% du salaire après cotisations AVS et 2e pilier (${chf(net)}), au franc, entre ${chf(ff.min)} et ${chf(ff.max)}${NB}: ${chf(flatIfd)}.`,
          ),
        };
  return out;
}

/**
 * The bike note of each tax year, citing that year's document (docs/design/tax-years.md): the 2026
 * federal instructions; for 2025, whose instructions are not in the library, the 2025 Geneva guide
 * that gives the flat amount, and no rule on reducing it.
 */
const BIKE_FLAT_NOTE: Readonly<Record<number, Text>> = {
  2025: {
    en: 'Bike or moped: the federal flat amount (ge-2025-guide-declaration-pp p. 20) is counted in full: no 2025 document Taxpresso has says how to reduce it for part of a year or part-time work.',
    fr: `Vélo ou cyclomoteur${NB}: le forfait fédéral (guide 2025 p. 20) est compté en entier${NB}: aucun document 2025 dont Taxpresso dispose ne dit comment le réduire pour une partie de l’année ou un temps partiel.`,
  },
  2026: IFD_NOTE.bikeFlat,
};

/**
 * Travel to work (LIFD art. 26 al. 1 let. a): the cost before the caps (commuteBase), at most the
 * federal maximum. `costs` is the trace commuteBase read into.
 */
export function commuteCosts(
  F: Pick<IfdParams, 'commuteMax'>,
  p: Pick<PersonInput, 'commuteCost' | 'commuteMode'>,
  way: CommuteBase,
  costs: Trace,
  /** The tax year, for the note's source (BIKE_FLAT_NOTE); without it, the 2026 instructions'. */
  taxYear?: number,
): RuleResult<'commute'> {
  const out = none<'commute'>();
  if (p.commuteMode?.by === 'bike' && !p.commuteCost) {
    out.unverified.push(
      (taxYear !== undefined ? BIKE_FLAT_NOTE[taxYear] : undefined) ?? IFD_NOTE.bikeFlat,
    );
  }
  const tr = new Trace().with(costs).src(...costs.sources);
  const v = Math.min(way.cost, tr.p(F.commuteMax));
  out.limits.push({
    concept: 'commute',
    param: F.commuteMax,
    kind: 'cap',
    given: way.cost,
    limit: F.commuteMax.value,
    counted: v,
  });
  out.deduction = {
    concept: 'commute',
    amount: -v,
    trace: tr,
    how: t(
      `${way.how.en}, at most ${chf(F.commuteMax.value)}: ${chf(v)}.`,
      `${way.how.fr}, au plus ${chf(F.commuteMax.value)}${NB}: ${chf(v)}.`,
    ),
  };
  return out;
}

/** Professional training paid (LIFD art. 33 al. 1 let. j), at most the federal maximum. */
export function trainingCosts(
  F: Pick<IfdParams, 'trainingMax'>,
  training: number,
  input: Trace,
): RuleResult<'training'> {
  const tf = new Trace().with(input);
  const vf = Math.min(training, tf.p(F.trainingMax));
  return {
    deduction: {
      concept: 'training',
      amount: -vf,
      trace: tf,
      how: t(
        `Paid ${chf(training)}, at most ${chf(F.trainingMax.value)}: ${chf(vf)}.`,
        `Payé ${chf(training)}, au plus ${chf(F.trainingMax.value)}${NB}: ${chf(vf)}.`,
      ),
    },
    limits: [
      {
        concept: 'training',
        param: F.trainingMax,
        kind: 'cap',
        given: training,
        limit: F.trainingMax.value,
        counted: vf,
      },
    ],
    notCounted: [],
    unverified: [],
  };
}

/**
 * Both spouses earn (LIFD art. 33 al. 2): a share of the lower earned income, between a minimum and
 * a maximum (twoEarnerFederal). `from` are the lower earner's lines, whose estimates it rests on.
 */
export function twoEarner(
  F: Pick<IfdParams, 'twoEarner'>,
  earned: number,
  from: readonly Line[],
): RuleResult<'two_earner'> {
  const tr = new Trace().from(...from);
  const te = tr.p(F.twoEarner);
  const v = twoEarnerFederal(earned, te);
  return {
    deduction: {
      concept: 'two_earner',
      amount: -v,
      trace: tr,
      how: t(
        `Both spouses work: 50 % of the lower earned income (${chf(earned)}), at least ${chf(te.min)} (never more than that income), at most ${chf(te.max)}: ${chf(v)}.`,
        `Les deux conjoints travaillent${NB}: 50${NB}% du revenu d’activité le plus bas (${chf(earned)}), au moins ${chf(te.min)} (jamais plus que ce revenu), au plus ${chf(te.max)}${NB}: ${chf(v)}.`,
      ),
    },
    limits: [],
    notCounted: [],
    unverified: [],
  };
}

/**
 * Insurance premiums and savings interest (LIFD art. 33 al. 1 let. g, al. 1bis): the premiums left
 * after any subsidy plus the savings interest and life insurance, at most the amount for spouses or
 * others (higher when nobody pays into the 2nd pillar or 3a) plus so much per child; half of it for
 * a child in shared custody, where each parent has half the child deduction (circular 30, ch. 7 and
 * 14.4.1). `inputs` are the traces of the premiums, the life insurance and the subsidy.
 */
export function insurancePremiums(
  F: Pick<IfdParams, 'insurance'>,
  a: {
    premiums: number;
    subsidy: number;
    life: number;
    couple: boolean;
    /** Someone in the household pays into the 2nd pillar or 3a. */
    contributing: boolean;
    full: number;
    shared: number;
    inputs: readonly Trace[];
  },
): RuleResult<'insurance'> {
  const insTrace = new Trace().with(...a.inputs);
  const insurance = Math.max(0, a.premiums - a.subsidy) + a.life;
  if (!(insurance > 0)) return none();
  const { full, shared } = a;
  const ins = insTrace.p(F.insurance);
  const base = a.couple
    ? a.contributing
      ? ins.married
      : ins.marriedNone
    : a.contributing
      ? ins.other
      : ins.otherNone;
  const halfChild = ins.perChild / 2;
  if (shared) insTrace.src(`${CIRCULAR30} p. 11 and 32 (ch. 7, 14.4.1)`);
  const cap = base + ins.perChild * full + halfChild * shared;
  const v = Math.min(insurance, cap);
  const plus = (perChild: number, n: number, en: string, fr: string) =>
    n
      ? { en: ` + ${chf(perChild)} x ${n} ${en}`, fr: ` + ${chf(perChild)} x ${n} ${fr}` }
      : { en: '', fr: '' };
  const fullPart = plus(
    ins.perChild,
    full,
    full > 1 ? 'children' : 'child',
    full > 1 ? 'enfants' : 'enfant',
  );
  const sharedPart = plus(
    halfChild,
    shared,
    `child${shared > 1 ? 'ren' : ''} in shared custody`,
    `enfant${shared > 1 ? 's' : ''} en garde alternée`,
  );
  return {
    deduction: {
      concept: 'insurance',
      amount: -v,
      trace: insTrace,
      how: t(
        `Premiums and savings interest ${chf(insurance)}${a.subsidy ? ' (after the subsidy)' : ''}; at most ${chf(base)}${fullPart.en}${sharedPart.en}: ${chf(v)}.`,
        `Primes et intérêts d’épargne ${chf(insurance)}${a.subsidy ? ' (après subside)' : ''}${NB}; au plus ${chf(base)}${fullPart.fr}${sharedPart.fr}${NB}: ${chf(v)}.`,
      ),
    },
    limits: [
      {
        concept: 'insurance',
        param: F.insurance,
        kind: 'cap',
        given: insurance,
        limit: cap,
        counted: v,
      },
    ],
    notCounted: [],
    unverified: [],
  };
}

/** Private debt interest (LIFD art. 33 al. 1 let. a): up to the income from wealth plus a fixed amount. */
export function debtInterest(
  F: Pick<IfdParams, 'debtInterestExtra'>,
  interest: number,
  wealthIncome: number,
  input: Trace,
): RuleResult<'debt_interest'> {
  const cf = new Trace().with(input);
  const ef = cf.p(F.debtInterestExtra);
  const vf = Math.min(interest, wealthIncome + ef);
  const capF = wealthIncome + ef;
  return {
    deduction: {
      concept: 'debt_interest',
      amount: -vf,
      trace: cf,
      how: t(
        `Interest ${chf(interest)}; at most the income from wealth (${chf(wealthIncome)}) + ${chf(ef)}: ${chf(vf)}.`,
        `Intérêts ${chf(interest)}${NB}; au plus le rendement de la fortune (${chf(wealthIncome)}) + ${chf(ef)}${NB}: ${chf(vf)}.`,
      ),
    },
    limits: [
      {
        concept: 'debt_interest',
        param: F.debtInterestExtra,
        kind: 'cap',
        given: interest,
        limit: capF,
        counted: vf,
      },
    ],
    notCounted: [],
    unverified: [],
  };
}

/** Childcare (LIFD art. 33 al. 3): at most the federal maximum per child under 14 (`children`). */
export function childcareCosts(
  F: Pick<IfdParams, 'childcareMax'>,
  care: number,
  children: number,
  input: Trace,
): RuleResult<'childcare'> {
  const cf = new Trace().with(input);
  const maxF = cf.p(F.childcareMax);
  const vf = Math.min(care, maxF * children);
  const capF = maxF * children;
  return {
    deduction: {
      concept: 'childcare',
      amount: -vf,
      trace: cf,
      how: t(
        `Paid ${chf(care)}; at most ${chf(maxF)} per child under 14 (${children}): ${chf(vf)}.`,
        `Payé ${chf(care)}${NB}; au plus ${chf(maxF)} par enfant de moins de 14 ans (${children})${NB}: ${chf(vf)}.`,
      ),
    },
    limits: [
      {
        concept: 'childcare',
        param: F.childcareMax,
        kind: 'cap',
        given: care,
        limit: capF,
        counted: vf,
      },
    ],
    notCounted: [],
    unverified: [],
  };
}

/** Married couples living together (LIFD art. 35 al. 1 let. c). */
export function marriedCouple(F: Pick<IfdParams, 'married'>): RuleResult<'married'> {
  const tr = new Trace();
  const v = tr.p(F.married);
  return {
    deduction: {
      concept: 'married',
      amount: -v,
      trace: tr,
      how: t(
        `Married couple living together: ${chf(v)}.`,
        `Époux vivant en ménage commun${NB}: ${chf(v)}.`,
      ),
    },
    limits: [],
    notCounted: [],
    unverified: [],
  };
}

/**
 * Donations (LIFD art. 33a): only once they reach the minimum in the year, at most a share of the
 * form's base (Geneva: the subtotal 92.40).
 */
export function donations(
  F: Pick<IfdParams, 'donations'>,
  gifts: number,
  base: FormBase,
  input: Trace,
): RuleResult<'donations'> {
  const out = none<'donations'>();
  const tf = new Trace().with(input).from(base.line);
  const d = tf.p(F.donations);
  const { cap: capF, deduction: vf } = donationDeduction(gifts, base.line.amount, d.shareBp, d.min);
  out.limits.push({
    concept: 'donations',
    param: F.donations,
    kind: 'minimum',
    given: gifts,
    limit: d.min,
    counted: vf,
  });
  if (gifts >= d.min)
    out.limits.push({
      concept: 'donations',
      param: F.donations,
      kind: 'cap',
      given: gifts,
      limit: capF,
      counted: vf,
    });
  if (vf > 0)
    out.deduction = {
      concept: 'donations',
      amount: -vf,
      trace: tf,
      how: t(
        `Donations ${chf(gifts)} (at least ${chf(d.min)} in the year); at most 20 % of ${base.name.en} (${chf(base.line.amount)}), ${chf(capF)}: ${chf(vf)}.`,
        `Dons ${chf(gifts)} (au moins ${chf(d.min)} dans l’année)${NB}; au plus 20${NB}% ${base.name.fr} (${chf(base.line.amount)}), ${chf(capF)}${NB}: ${chf(vf)}.`,
      ),
    };
  else
    out.notCounted.push(
      t(
        `Donations under ${chf(d.min)} in the year are not deducted for the federal tax.`,
        `Les dons de moins de ${chf(d.min)} dans l’année ne sont pas déduits pour l’impôt fédéral.`,
      ),
    );
  return out;
}

/** Payments to political parties (LIFD art. 33 al. 1 let. i), at most the federal maximum. */
export function politicalParty(
  F: Pick<IfdParams, 'partyMax'>,
  party: number,
  input: Trace,
): RuleResult<'party'> {
  const tf = new Trace().with(input);
  const vf = Math.min(party, tf.p(F.partyMax));
  return {
    deduction: {
      concept: 'party',
      amount: -vf,
      trace: tf,
      how: t(
        `Paid ${chf(party)}, at most ${chf(F.partyMax.value)}: ${chf(vf)}.`,
        `Versé ${chf(party)}, au plus ${chf(F.partyMax.value)}${NB}: ${chf(vf)}.`,
      ),
    },
    limits: [
      {
        concept: 'party',
        param: F.partyMax,
        kind: 'cap',
        given: party,
        limit: F.partyMax.value,
        counted: vf,
      },
    ],
    notCounted: [],
    unverified: [],
  };
}

/**
 * The deduction per child (LIFD art. 35 al. 1 let. a): in full for a child counted here, half for a
 * child in shared custody (circular 30). `sources` say whose the children are, when separated
 * parents' child support decided it.
 */
export function childDeduction(
  F: Pick<IfdParams, 'child'>,
  full: number,
  shared: number,
  sources: readonly string[],
): RuleResult<'child'> {
  const tf = new Trace().src(...sources);
  const per = tf.p(F.child);
  const vf = per * full + (per / 2) * shared;
  return {
    deduction: {
      concept: 'child',
      amount: -vf,
      trace: tf,
      how: t(
        `${chf(per)} per child${shared ? ', half in shared custody' : ''}: ${chf(vf)}.`,
        `${chf(per)} par enfant${shared ? ', moitié en garde alternée' : ''}${NB}: ${chf(vf)}.`,
      ),
    },
    limits: [],
    notCounted: [],
    unverified: [],
  };
}

/**
 * The federal scale (art. 36 LIFD): married couples on the married scale, a parent with a child
 * counted in full on the parental scale (the married scale), anyone else on the single scale. With
 * shared custody and no partner, the parent who earns more has the parental scale when there is no
 * child support (circular 30, ch. 13.4.2 and 14.4.2): unknown, the federal tax is not computed
 * (fail closed). The parental scale can't be split: its parent has the whole reduction per child
 * (ch. 13.4.1).
 */
export function federalScale(a: {
  couple: boolean;
  /** Children counted in full here. */
  full: number;
  /** Children in shared custody, half here. */
  shared: number;
  /** Shared custody without child support: this parent earns more. */
  parentalScale?: boolean;
}): { scale: IfdScale; childReductions: number; unsupported: Text[] } {
  let scale: IfdScale = a.couple ? 'married' : a.full > 0 ? 'parental' : 'single';
  const unsupported: Text[] = [];
  if (a.shared > 0 && !a.couple && a.full === 0) {
    if (a.parentalScale === undefined) unsupported.push(IFD_NOTE.ifdShared);
    else if (a.parentalScale) scale = 'parental';
  }
  return { scale, childReductions: scale === 'single' ? 0 : a.full + a.shared, unsupported };
}
