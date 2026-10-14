// The one entry point: computeReturn(input) gives the lines of the Basel-Stadt return by code and
// person, the totals and the cantonal and communal tax, each line explained with its sources, and
// the federal tax of the Bund column (./ifd.ts). First stage here (household figures to the lines
// of the return, every cap, flat amount and threshold of the Basel-Stadt documents, in the order of
// the form, with the limits each rule applied), second stage in ./assess.ts (lines to taxes). The
// same two stages, with the same names, as packages/rules-vd, rules-zh and rules-be.
import {
  answered,
  chf,
  pillar3a as federalPillar3a,
  roundFranc,
  Trace,
  type Amount,
  type LimitApplied,
} from '@taxpresso/rules-ch';
import { assess, BsInputError, BsUnsupported, communeOf, communeRef, subtotals } from './assess.js';
import { ESTIMATE_TEXT, NOTE } from './explain.js';
import { federalReturn, type FederalChild } from './ifd.js';
import {
  childRule,
  exemptGoods,
  familySituation,
  professionalRule,
  retireeRule,
  securitiesRule,
  singleParentRule,
} from './law.js';
import { bsParamsFor, type BsYearParams } from './params.js';
import {
  FORM_B,
  FORM_W,
  INCOME,
  PERSON_CODES,
  RUBRICS,
  WEALTH_RUBRICS,
  type RubricCode,
  type WealthCode,
} from './rubrics.js';
import {
  donationDeduction,
  drivingCost,
  illnessDeduction,
  mealsCost,
  professionalFlat,
  securitiesValue,
} from './rules.js';
import type {
  BsEngineInput,
  BsTaxResult,
  ChildInput,
  EmploymentInput,
  Item,
  ItemPart,
  ItemPerson,
  Line,
  PersonInput,
  Text,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';

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
   * A cap, threshold, minimum or choice a cantonal rule applied (SPEC.md 10.0), on `code` for
   * `person`, cited by the constant `p` that sets it: `given` before the rule, `counted` after it.
   * `rule` names it as the federal concepts are (packages/rules-ch, ifd/items.ts).
   */
  limit(
    rule: string,
    p: { source: string; estimate?: string | undefined },
    kind: LimitApplied['kind'],
    code: string,
    person: ItemPerson,
    given: number,
    limit: number,
    counted: number,
  ) {
    this.limits.push({
      code,
      person,
      tax: 'icc',
      kind,
      given,
      limit,
      counted,
      source: p.source,
      ...(p.estimate ? { estimate: true } : {}),
      rule,
    });
  }
}

/** An item for this line and person; its label and the form's page come from the catalogue. */
function item(code: RubricCode, person: ItemPerson, tr: Trace, amount: number, how: Text): Item {
  const r = RUBRICS[code];
  tr.src(r.source);
  return { code, person, ...tr.line(amount, r.label, how) };
}

function wealthItem(code: WealthCode, tr: Trace, amount: number, how: Text): Item {
  const r = WEALTH_RUBRICS[code];
  tr.src(r.source);
  return { code, person: 'household', ...tr.line(amount, r.label, how) };
}

/** Sum of amounts read into a trace, to the franc (the form takes whole francs, CHF ohne Rappen). */
function total(tr: Trace, amounts: readonly (Amount | undefined)[]): number {
  return roundFranc(amounts.reduce((s, a) => s + tr.a(a), 0));
}

const given = (value: number) =>
  t(`As given: ${chf(value)}.`, `Tel que donné${NB}: ${chf(value)}.`);

/** The item with the form B lines that make up its amount, when there are some. */
const withParts = (i: Item, parts: readonly ItemPart[]): Item =>
  parts.length ? { ...i, parts } : i;

interface Salary {
  /** Box 11: box 8 less boxes 9 and 10, to the franc. */
  net: number;
  gross: number;
  social: number;
  tr: Trace;
}

function salary(employments: readonly EmploymentInput[]): Salary {
  const tr = new Trace();
  let gross = 0;
  let social = 0;
  let fund = 0;
  let buyIn = 0;
  for (const e of employments) {
    gross += tr.a(e.gross);
    social += tr.a(e.socialContributions);
    fund += tr.a(e.pensionFund);
    buyIn += tr.a(e.pensionBuyIn);
  }
  return { net: roundFranc(Math.max(0, gross - social - fund - buyIn)), gross, social, tr };
}

/** Travel to work (503) before the yearly cap, and how it was found (no final full stop). */
function travel(
  P: BsYearParams,
  p: PersonInput,
  employments: readonly EmploymentInput[],
  tr: Trace,
  notes: Notes,
): { cost: number; how: Text } {
  const A = P.amounts;
  const mode = p.commuteMode;
  if (mode) tr.with(answered(mode.facts, mode.status));
  const none = (how: Text) => ({ cost: 0, how });
  if (employments.every((e) => e.freeTransport)) {
    notes.add(notes.assumptions, NOTE.freeTransport);
    return none(t('travel: transport provided', `transport${NB}: fourni par l’employeur`));
  }
  if (mode?.by === 'home' || mode?.by === 'walk')
    return none(t('travel: none', `transport${NB}: aucun`));
  if (mode?.by === 'bike') {
    const cost = tr.p(A.commuteRates).bikePerYear;
    return {
      cost,
      how: t(
        `travel ${chf(cost)} (bike or small moped, flat a year)`,
        `transport ${chf(cost)} (vélo ou cyclomoteur, forfait annuel)`,
      ),
    };
  }
  if ((mode?.by === 'car' || mode?.by === 'motorbike') && mode.transitUsable === false) {
    if (!mode.kmOneWay || !mode.days) {
      notes.add(notes.notCounted, NOTE.drivingDetails);
      return none(t('travel: not counted', `transport${NB}: non compté`));
    }
    const maxDays = tr.p(A.meals).maxDays;
    if (mode.days > maxDays) notes.add(notes.assumptions, NOTE.daysCapped);
    const days = Math.min(mode.days, maxDays);
    const rates = tr.p(A.commuteRates);
    const perKm = mode.by === 'car' ? rates.carPerKm : rates.motorbikePerKm;
    const cost = drivingCost(mode.kmOneWay, days, perKm);
    const what = mode.by === 'car' ? t('car', 'voiture') : t('motorbike', 'moto');
    return {
      cost,
      how: t(
        `travel ${chf(cost)} (${what.en}: ${mode.kmOneWay} km x 2 x ${days} days x CHF 0.${String(perKm).padStart(2, '0')})`,
        `transport ${chf(cost)} (${what.fr}${NB}: ${mode.kmOneWay} km x 2 x ${days} jours x CHF 0.${String(perKm).padStart(2, '0')})`,
      ),
    };
  }
  // Public transport, or a private vehicle where public transport could be used: what the ticket
  // cost or would have cost (StV § 22 al. 2).
  if (p.commuteCost) {
    const paid = total(tr, [p.commuteCost]);
    return {
      cost: paid,
      how: t(
        `travel ${chf(paid)} (public transport ticket)`,
        `transport ${chf(paid)} (abonnement de transports publics)`,
      ),
    };
  }
  if (mode) notes.add(notes.notCounted, NOTE.transitDetails);
  return none(t('travel: nothing given', `transport${NB}: rien d’indiqué`));
}

interface PersonFigures {
  id: 'p1' | 'p2';
  /** Net salaries (main and side jobs): the earned income. */
  earned: number;
  /** Daily allowances and unemployment benefits (260/265). */
  replacement: number;
  /** Professional costs (519/539). */
  costs: number;
  /** Pension contributions deducted (610 to 625). */
  contributions: number;
  /** AHV/IV and pension fund pensions (200 to 225); other pensions (240/245). */
  pensions: number;
  otherPensions: number;
  /** Training paid (before the cap). */
  trainingPaid: number;
}

function personItems(P: BsYearParams, p: PersonInput, items: Item[], notes: Notes): PersonFigures {
  const A = P.amounts;
  const codes = (k: keyof typeof PERSON_CODES) => PERSON_CODES[k][p.id];
  const employments = p.employments ?? [];
  const main = employments.filter((e) => !e.side);
  const side = employments.filter((e) => e.side);
  const mainSalary = salary(main);
  const sideSalary = salary(side);
  const salaryHow = (net: number) =>
    t(
      `Gross salary less social and pension fund contributions and buy-ins (salary certificate boxes 8 - 9 - 10 = box 11): ${chf(net)}.`,
      `Salaire brut moins cotisations sociales, cotisations et rachats de prévoyance (certificat de salaire, cases 8 - 9 - 10 = case 11)${NB}: ${chf(net)}.`,
    );
  if (main.length)
    items.push(item(codes('main'), p.id, mainSalary.tr, mainSalary.net, salaryHow(mainSalary.net)));
  if (side.length)
    items.push(item(codes('side'), p.id, sideSalary.tr, sideSalary.net, salaryHow(sideSalary.net)));
  const earned = mainSalary.net + sideSalary.net;

  // Professional costs (519/539): the flat amount or the actual costs, whichever is higher, never
  // more than the earned income.
  let costs = 0;
  if (employments.length) {
    const tr = new Trace()
      .with(mainSalary.tr, sideSalary.tr)
      .src(professionalRule(P.taxYear).source);
    const tv = travel(P, p, employments, tr, notes);
    const travelMax = tr.p(A.commuteMax);
    const travelCost = Math.min(tv.cost, travelMax);
    const code = codes('professional');
    if (tv.cost > 0) {
      notes.limit('commute', A.commuteMax, 'cap', code, p.id, tv.cost, travelMax, travelCost);
    }
    let meals = 0;
    let mealsHow = t('', '');
    if (p.commuteMode?.by === 'home') notes.add(notes.assumptions, NOTE.workFromHome);
    else if ((p.mealDays ?? 0) > 0) {
      tr.with(answered(p.mealFacts));
      const m = tr.p(A.meals);
      const canteen = employments.some((e) => e.canteen);
      const days = p.mealDays ?? 0;
      if (days > m.maxDays) notes.add(notes.assumptions, NOTE.daysCapped);
      if (canteen) notes.add(notes.assumptions, NOTE.canteen);
      const [perDay, perYear] = canteen
        ? [m.reducedPerDay, m.reducedPerYear]
        : [m.perDay, m.perYear];
      meals = mealsCost(days, perDay, perYear, m.maxDays);
      notes.limit(
        'meals',
        A.meals,
        'cap',
        code,
        p.id,
        Math.min(days, m.maxDays) * perDay,
        perYear,
        meals,
      );
      mealsHow = t(
        ` + lunch ${Math.min(days, m.maxDays)} days x ${chf(perDay)}, at most ${chf(perYear)}: ${chf(meals)}`,
        ` + repas ${Math.min(days, m.maxDays)} jours x ${chf(perDay)}, au plus ${chf(perYear)}${NB}: ${chf(meals)}`,
      );
    }
    const other = p.otherProfessionalCosts ? total(tr, [p.otherProfessionalCosts]) : 0;
    const actual = travelCost + meals + other;
    const fp = tr.p(A.professionalFlat);
    let flat: number | undefined;
    if (p.workRate !== undefined) flat = professionalFlat(p.workRate, fp);
    else if (actual < fp.amount) notes.add(notes.unsupported, NOTE.workRate);
    const chosen = Math.max(flat ?? 0, actual);
    const value = Math.min(chosen, earned);
    const useFlat = flat !== undefined && flat >= actual;
    if (flat !== undefined && actual > 0) {
      notes.limit(
        'professional.other',
        A.professionalFlat,
        'choice',
        code,
        p.id,
        actual,
        flat,
        chosen,
      );
    }
    // Form B, Kanton column: the flat amount (500/520) or the actual costs (503, 504, 514), whose
    // total carries to 519/539; none when the total is cut to the earned income.
    const B = FORM_B[p.id];
    const parts: ItemPart[] =
      value < chosen
        ? []
        : useFlat
          ? [{ code: B.flat, amount: value }]
          : [
              ...(travelCost ? [{ code: B.travel, amount: travelCost }] : []),
              ...(meals ? [{ code: B.meals, amount: meals }] : []),
              ...(other ? [{ code: B.other, amount: other }] : []),
            ];
    if (useFlat) notes.add(notes.assumptions, NOTE.fullYear);
    else notes.add(notes.assumptions, NOTE.actualCosts);
    const flatText =
      flat === undefined
        ? t('', '')
        : p.workRate! > fp.partTimeRate
          ? t(`flat amount ${chf(flat)}`, `forfait ${chf(flat)}`)
          : t(
              `flat amount ${chf(fp.amount)} x ${p.workRate} % work rate, at least ${chf(fp.minimum)}: ${chf(flat)}`,
              `forfait ${chf(fp.amount)} x ${p.workRate}${NB}% de taux d’activité, au moins ${chf(fp.minimum)}${NB}: ${chf(flat)}`,
            );
    const actualText = t(
      `actual costs: ${tv.how.en}${tv.cost > travelMax ? `, at most ${chf(travelMax)}` : ''}${mealsHow.en}${other ? ` + other ${chf(other)}` : ''} = ${chf(actual)}`,
      `frais effectifs${NB}: ${tv.how.fr}${tv.cost > travelMax ? `, au plus ${chf(travelMax)}` : ''}${mealsHow.fr}${other ? ` + autres ${chf(other)}` : ''} = ${chf(actual)}`,
    );
    const capText =
      value < chosen
        ? t(
            `; at most the earned income ${chf(earned)}`,
            `${NB}; au plus le revenu d’activité ${chf(earned)}`,
          )
        : t('', '');
    if (value > 0) {
      items.push(
        withParts(
          item(
            code,
            p.id,
            tr,
            -value,
            useFlat
              ? t(
                  `The higher of the ${flatText.en} and the ${actualText.en}: the flat amount${capText.en}: ${chf(value)}.`,
                  `Le plus élevé du ${flatText.fr} et des ${actualText.fr}${NB}: le forfait${capText.fr}${NB}: ${chf(value)}.`,
                )
              : t(
                  `${flat === undefined ? 'The' : `Higher than the ${flatText.en}, the`} ${actualText.en}${capText.en}: ${chf(value)}.`,
                  `${flat === undefined ? 'Les' : `Plus élevés que le ${flatText.fr}, les`} ${actualText.fr}${capText.fr}${NB}: ${chf(value)}.`,
                ),
          ),
          parts,
        ),
      );
    }
    costs = value;
  }

  // Pensions, allowances and alimony of the person.
  const own = (code: RubricCode, amounts: readonly (Amount | undefined)[], note?: Text) => {
    if (!amounts.some(Boolean)) return 0;
    const tr = new Trace();
    const value = total(tr, amounts);
    if (value <= 0) return 0;
    if (note) notes.add(notes.assumptions, note);
    items.push(item(code, p.id, tr, value, given(value)));
    return value;
  };
  const avs = own(codes('avs'), [p.pensionAvs]);
  const occupational = own(codes('occupational'), [p.pensionOccupational], NOTE.pensions);
  const otherPensions = own(codes('otherPension'), [p.pensionOther], NOTE.pensions);
  const replacement = own(codes('allowances'), [p.replacementIncome, p.unemploymentBenefits]);
  own('270', [p.alimonyReceived]);

  // Pillar 3a (620/625): the federal limits as the canton's table prints them.
  const hasPensionFund =
    p.hasPensionFund ??
    employments.some((e) => (e.pensionFund?.value ?? 0) > 0 || (e.pensionBuyIn?.value ?? 0) > 0);
  let contributions = 0;
  if (p.pillar3aCatchUp && P.taxYear === 2025) notes.add(notes.unsupported, NOTE.catchUp2025);
  const r3a = federalPillar3a(
    { pillar3a: A.pillar3a },
    {
      ...(p.pillar3a ? { paid: p.pillar3a } : {}),
      ...(p.pillar3aCatchUp && P.taxYear !== 2025 ? { catchUp: p.pillar3aCatchUp } : {}),
      hasFund: hasPensionFund,
      gross: mainSalary.gross + sideSalary.gross,
      social: mainSalary.social + sideSalary.social,
      self: 0,
      earnedFrom: [mainSalary.tr, sideSalary.tr],
    },
  );
  for (const n of r3a.notCounted) notes.add(notes.notCounted, n);
  for (const l of r3a.limits) {
    notes.limit('pillar3a', l.param, l.kind, codes('pillar3a'), p.id, l.given, l.limit, l.counted);
  }
  if (r3a.deduction && r3a.deduction.amount < 0) {
    contributions += -r3a.deduction.amount;
    items.push(
      item(codes('pillar3a'), p.id, r3a.deduction.trace, r3a.deduction.amount, r3a.deduction.how),
    );
  }

  // Pension fund buy-ins paid directly (610/615).
  if (p.pensionBuyIn) {
    const tr = new Trace();
    const paid = total(tr, [p.pensionBuyIn]);
    if (paid > 0) {
      items.push(item(codes('buyIn'), p.id, tr, -paid, given(paid)));
      contributions += paid;
    }
  }

  // Professional training (652/657).
  let trainingPaid = 0;
  if (p.trainingCosts) {
    const tr = new Trace();
    trainingPaid = total(tr, [p.trainingCosts]);
    const cap = tr.p(A.training);
    const ded = Math.min(trainingPaid, cap);
    if (trainingPaid > 0) {
      notes.limit('training', A.training, 'cap', codes('training'), p.id, trainingPaid, cap, ded);
    }
    if (ded > 0) {
      items.push(
        item(
          codes('training'),
          p.id,
          tr,
          -ded,
          t(
            `Paid ${chf(trainingPaid)}, at most ${chf(cap)}: ${chf(ded)}.`,
            `Payé ${chf(trainingPaid)}, au plus ${chf(cap)}${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  return {
    id: p.id,
    earned,
    replacement,
    costs,
    contributions,
    pensions: avs + occupational,
    otherPensions,
    trainingPaid,
  };
}

/** The family as Basel-Stadt counts it (StG § 35, § 36, § 49; StV § 42). */
interface Family {
  /** Child deduction units: 1 a child counted in full, 0.5 a child shared half and half. */
  childUnits: number;
  /** A single person keeping a household alone with children they mainly support. */
  singleParent: boolean;
  /** Wealth allowances for minor children, in the reading that gives the least and the most. */
  minorAllowance: { low: number; high: number; unknownMinor: boolean };
  sources: string[];
}

function family(input: BsEngineInput, P: BsYearParams, couple: boolean, notes: Notes): Family {
  const y = P.taxYear;
  const perChild = P.amounts.wealthFree.value.perMinorChild;
  const sources = [childRule(y).source, familySituation(y).source];
  let childUnits = 0;
  let fullLiving = false;
  let sharedLiving = false;
  const allowance = { low: 0, high: 0, unknownMinor: false };
  const allow = (minor: boolean | undefined, values: readonly number[]) => {
    if (minor === false) return;
    if (minor === undefined) allowance.unknownMinor = true;
    allowance.low += minor === undefined ? 0 : Math.min(...values);
    allowance.high += Math.max(...values);
  };
  for (const ch of input.children ?? []) {
    const lives = ch.livesWithYou ?? true;
    const minor = ch.minor ?? (ch.under14 === true ? true : undefined);
    if (ch.custody === 'full') {
      childUnits += 1;
      if (lives) fullLiving = true;
      allow(minor, [perChild]);
      continue;
    }
    if (couple) {
      notes.add(notes.unsupported, NOTE.marriedShared);
      continue;
    }
    if (input.childSupport === 'receives') {
      childUnits += 1;
      if (lives) sharedLiving = true;
      allow(minor, [perChild]);
    } else if (input.childSupport === 'none') {
      childUnits += 0.5;
      if (lives) sharedLiving = true;
      notes.add(notes.assumptions, NOTE.sharedHalf);
      // The law gives the allowance to the parent who mainly provides (§ 49 al. 1 lit. c) and says
      // nothing of sharing it: whole or nothing by the upkeep, or half like the child deduction.
      const literal =
        input.mainUpkeep === undefined ? [0, perChild] : [input.mainUpkeep ? perChild : 0];
      allow(minor, [...literal, perChild / 2]);
    } else if (input.childSupport === 'pays') {
      notes.add(notes.assumptions, NOTE.childSupportPaid);
    } else {
      notes.add(notes.unsupported, NOTE.childSupport);
    }
  }
  let singleParent = false;
  if (!couple && (fullLiving || sharedLiving)) {
    sources.push(singleParentRule(y).source);
    if (input.cohabiting === undefined) notes.add(notes.unsupported, NOTE.cohabitingAsk);
    else if (input.cohabiting) notes.add(notes.unsupported, NOTE.cohabiting);
    else if (fullLiving) singleParent = true;
    else if (input.mainUpkeep === undefined) notes.add(notes.unsupported, NOTE.mainUpkeep);
    else singleParent = input.mainUpkeep;
  }
  return { childUnits, singleParent, minorAllowance: allowance, sources: [...new Set(sources)] };
}

/**
 * The deduction for single retirees (770), when the documents settle it: reached the reference age,
 * or pensions at least half the income in every reading (StV § 43 measures them against the income,
 * the guide against pensions and earnings, counting accident and military pensions, p. 39).
 */
function retiree(p: PersonInput, f: PersonFigures, grossIncome: number, notes: Notes): boolean {
  if (p.referenceAge) return true;
  const outcomes = new Set<boolean>();
  for (const pensions of [f.pensions, f.pensions + f.otherPensions]) {
    for (const base of [grossIncome, pensions + f.earned]) {
      outcomes.add(pensions > 0 && 2 * pensions >= base);
    }
  }
  if (outcomes.size === 1 && outcomes.has(true)) return true;
  if (p.referenceAge === undefined) {
    notes.add(notes.unsupported, NOTE.referenceAge);
    return false;
  }
  if (outcomes.size > 1) notes.add(notes.unsupported, NOTE.retireeConflict);
  return false;
}

export function computeReturn(input: BsEngineInput): BsTaxResult {
  const P = bsParamsFor(input.taxYear);
  const A = P.amounts;
  communeOf(input.taxYear, input.commune);
  const notes = new Notes();
  const couple = input.civilStatus === 'married';
  const people = [...input.people].sort((a, b) => a.id.localeCompare(b.id));
  if (!people.some((p) => p.id === 'p1')) throw new BsInputError('people must include p1');
  if (!couple && people.some((p) => p.id === 'p2')) {
    throw new BsInputError('p2 is the spouse: only for a married couple');
  }
  if (new Set(people.map((p) => p.id)).size !== people.length) {
    throw new BsInputError('each person once');
  }
  const hh = input.household ?? {};
  if (people.some((p) => p.selfEmploymentProfit)) notes.add(notes.unsupported, NOTE.selfEmployed);
  if ((hh.vehicles?.value ?? 0) > 0) notes.add(notes.unsupported, NOTE.vehicles);
  notes.add(notes.notCounted, NOTE.dependents);
  if (input.church !== false) notes.add(notes.notCounted, NOTE.church);

  const fam = family(input, P, couple, notes);
  const ref = communeRef(input.taxYear, input.commune);
  const unsupportedResult = (
    assumptions: Text[],
    notCounted: Text[],
    rest: Partial<BsTaxResult> = {},
  ): BsTaxResult => ({
    canton: 'BS',
    taxYear: input.taxYear,
    commune: ref,
    icc: null,
    ifd: null,
    total: null,
    estimates: [],
    needsOk: 0,
    complete: true,
    incomplete: [],
    assumptions,
    notCounted,
    unsupported: notes.unsupported,
    unverifiedRules: [],
    limits: notes.limits,
    ...rest,
  });
  if (notes.unsupported.length) {
    // Something every later line rests on is missing or not supported (a question about the family,
    // self-employment): the result says that first, and nothing more.
    return unsupportedResult(notes.assumptions, notes.notCounted);
  }

  const items: Item[] = [];
  const figures = people.map((p) => personItems(P, p, items, notes));

  // Both spouses work (660): from the lower earned income after its costs and pension
  // contributions, at most the amount. The law leaves replacement income out (StG § 32 al. 2), the
  // guide counts daily allowances in (p. 35): both readings, and no tax when they differ.
  if (couple && figures.length === 2) {
    const tr = new Trace();
    const max = tr.p(A.twoEarner);
    const reading = (withReplacement: boolean) => {
      const left = figures.map((f) => f.earned + (withReplacement ? f.replacement : 0));
      if (!left.every((v) => v > 0)) return 0;
      const lower = Math.min(...figures.map((f, i) => left[i]! - f.costs - f.contributions));
      return Math.max(0, Math.min(max, lower));
    };
    const law = reading(false);
    if (law !== reading(true)) notes.add(notes.unsupported, NOTE.twoEarnerConflict);
    else if (law > 0) {
      items.push(
        item(
          '660',
          'household',
          tr,
          -law,
          t(
            `${chf(max)} from the lower earned income, at most that income after its professional costs and pension contributions: ${chf(law)}.`,
            `${chf(max)} sur le revenu d’activité le plus bas, au plus ce revenu après ses frais professionnels et cotisations de prévoyance${NB}: ${chf(law)}.`,
          ),
        ),
      );
    }
  }
  if (couple && figures.every((f) => f.trainingPaid > 0)) {
    const sumPaid = figures.reduce((s, f) => s + f.trainingPaid, 0);
    if (sumPaid > A.training.value) notes.add(notes.unsupported, NOTE.trainingCouple);
  }

  // Insurance premiums and savings interest (630/631): a flat amount.
  {
    const tr = new Trace();
    const ins = tr.p(A.insurance);
    const value = couple ? ins.married : ins.single;
    notes.add(notes.assumptions, NOTE.insuranceFlat);
    items.push(
      item(
        couple ? '630' : '631',
        'household',
        tr,
        -value,
        t(
          `Flat amount (Pauschalbetrag) ${couple ? 'for spouses' : 'for everyone else'}: ${chf(value)}.`,
          `Forfait (Pauschalbetrag) ${couple ? 'des époux' : 'des autres personnes'}${NB}: ${chf(value)}.`,
        ),
      ),
    );
  }

  // Accounts and securities (369): the gross income less the costs of keeping them (form W).
  const movable = input.movable ?? [];
  const incomeTr = new Trace();
  const grossYield = total(
    incomeTr,
    movable.map((m) => m.income),
  );
  if (grossYield > 0 || hh.bankFees) {
    const tr = new Trace().with(incomeTr);
    const fees = hh.bankFees ? total(tr, [hh.bankFees]) : 0;
    const net = grossYield - fees;
    // Form W, page 4: line 1 (gross income), line 6 (the costs of keeping them), line 10 = 369.
    items.push(
      withParts(
        item(
          '369',
          'household',
          tr,
          net,
          t(
            `Gross income of the accounts and securities ${chf(grossYield)}${fees ? ` less the costs of keeping them ${chf(fees)}` : ''}: ${chf(net)}.`,
            `Rendement brut des avoirs et titres ${chf(grossYield)}${fees ? ` moins leurs frais de gestion ${chf(fees)}` : ''}${NB}: ${chf(net)}.`,
          ),
        ),
        [
          { code: FORM_W.grossIncome, amount: grossYield },
          ...(fees ? [{ code: FORM_W.fees, amount: fees }] : []),
        ],
      ),
    );
  }
  const householdGiven = (
    code: RubricCode,
    amounts: readonly (Amount | undefined)[],
    sign: 1 | -1,
  ) => {
    if (!amounts.some(Boolean)) return 0;
    const tr = new Trace();
    const value = total(tr, amounts);
    if (value <= 0) return 0;
    items.push(item(code, 'household', tr, sign * value, given(value)));
    return value;
  };
  householdGiven('271', [hh.childSupportReceived], 1);
  householdGiven('280', [hh.otherIncome], 1);

  // Private debt interest (550): up to the gross income from wealth plus a fixed amount.
  if (hh.debtInterest) {
    const tr = new Trace().with(incomeTr);
    const paid = total(tr, [hh.debtInterest]);
    const extra = tr.p(A.debtInterestExtra);
    const cap = grossYield + extra;
    const ded = Math.min(paid, cap);
    notes.limit('debt_interest', A.debtInterestExtra, 'cap', '550', 'household', paid, cap, ded);
    if (ded > 0) {
      items.push(
        item(
          '550',
          'household',
          tr,
          -ded,
          t(
            `Paid ${chf(paid)}, at most the gross income from wealth plus ${chf(extra)} (${chf(cap)}): ${chf(ded)}.`,
            `Payé ${chf(paid)}, au plus le rendement brut de la fortune plus ${chf(extra)} (${chf(cap)})${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }
  householdGiven('560', [hh.alimonyPaid], -1);
  householdGiven('561', [hh.childSupportPaid], -1);

  // Childcare (670): per child under 14 living with you, at most the limit; married, both work.
  // Given for the household as a whole, it counts where every split between the children gives the
  // same deduction: one child, or a total within the smallest limit of a child (the limit is per
  // child, form F; bs-2025-guide-wegleitung p. 36); otherwise the split decides, and is asked.
  // Each child's care counts up to the 14th birthday ("das 14. Altersjahr noch nicht vollendet":
  // bs-2025-law-stg and bs-na-law-stg p. 15; bs-2025-guide-wegleitung and bs-2026-guide-wegleitung-b
  // p. 36): the costs given for an older child are left out.
  const careChildren = childcareOf(input, A.childcare.value, notes);
  const withCare = careChildren.filter((ch) => Boolean(ch.childcare));
  if (
    withCare.some(
      (ch) => ch.under14 === false && ch.livesWithYou !== false && (ch.childcare?.value ?? 0) > 0,
    )
  )
    notes.add(notes.notCounted, NOTE.childcareAge);
  if (withCare.length) {
    const working = couple
      ? figures.length === 2 && figures.every((f) => f.earned > 0)
      : figures.some((f) => f.earned > 0);
    if (!working) notes.add(notes.notCounted, NOTE.childcareWork);
    else {
      const tr = new Trace();
      const cap = tr.p(A.childcare);
      let ded = 0;
      let paidAll = 0;
      let capAll = 0;
      const parts: string[] = [];
      for (const ch of withCare) {
        if (ch.under14 === false || ch.livesWithYou === false) continue;
        if (ch.under14 === undefined) notes.add(notes.assumptions, NOTE.under14);
        const paid = total(tr, [ch.childcare]);
        paidAll += paid;
        capAll += cap;
        if (ch.custody === 'shared' && input.childSupport === 'pays') {
          notes.add(notes.unsupported, NOTE.childcareNotCounted);
          continue;
        }
        if (ch.custody === 'shared' && input.childSupport === 'none' && paid > cap / 2) {
          notes.add(notes.unsupported, NOTE.sharedChildcare);
          continue;
        }
        const one = Math.min(paid, cap);
        ded += one;
        parts.push(chf(one));
      }
      if (paidAll > 0) {
        notes.limit('childcare', A.childcare, 'cap', '670', 'household', paidAll, capAll, ded);
      }
      if (ded > 0) {
        items.push(
          item(
            '670',
            'household',
            tr,
            -ded,
            t(
              `Per child under 14, what was paid, at most ${chf(cap)}: ${parts.join(' + ')} = ${chf(ded)}.`,
              `Par enfant de moins de 14 ans, ce qui a été payé, au plus ${chf(cap)}${NB}: ${parts.join(' + ')} = ${chf(ded)}.`,
            ),
          ),
        );
      }
    }
  }

  // Political parties (680): at most one amount per return.
  if (hh.politicalParty) {
    const tr = new Trace();
    const paid = total(tr, [hh.politicalParty]);
    const max = tr.p(A.party);
    const ded = Math.min(paid, max);
    if (paid > 0) notes.limit('party', A.party, 'cap', '680', 'household', paid, max, ded);
    if (ded > 0) {
      items.push(
        item(
          '680',
          'household',
          tr,
          -ded,
          t(
            `Paid ${chf(paid)}, at most ${chf(max)}: ${chf(ded)}.`,
            `Payé ${chf(paid)}, au plus ${chf(max)}${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // Illness costs (725) and donations (732), on the net income (709); the net income II (719) is
  // the same, no disability costs being asked.
  const net = subtotals(items).net;
  if (hh.medicalCosts) {
    const tr = new Trace();
    const costs = total(tr, [hh.medicalCosts]);
    const m = illnessDeduction(costs, net, tr.p(A.medicalThresholdBp));
    notes.limit(
      'medical',
      A.medicalThresholdBp,
      'threshold',
      '725',
      'household',
      costs,
      m.threshold,
      m.deduction,
    );
    if (m.deduction > 0) {
      items.push(
        item(
          '725',
          'household',
          tr,
          -m.deduction,
          t(
            `${chf(costs)} less 5 % of the net income ${chf(net)} (Selbstbehalt ${chf(m.threshold)}): ${chf(m.deduction)}.`,
            `${chf(costs)} moins 5${NB}% du revenu net ${chf(net)} (Selbstbehalt ${chf(m.threshold)})${NB}: ${chf(m.deduction)}.`,
          ),
        ),
      );
    } else if (costs > 0) notes.add(notes.notCounted, NOTE.medicalBelow);
  }
  if (hh.donations) {
    const tr = new Trace();
    const gifts = total(tr, [hh.donations]);
    const d = donationDeduction(gifts, net, tr.p(A.donations));
    notes.limit(
      'donations',
      A.donations,
      'minimum',
      '732',
      'household',
      gifts,
      A.donations.value.min,
      d.deduction,
    );
    if (gifts >= A.donations.value.min) {
      notes.limit('donations', A.donations, 'cap', '732', 'household', gifts, d.cap, d.deduction);
    }
    if (d.deduction > 0) {
      items.push(
        item(
          '732',
          'household',
          tr,
          -d.deduction,
          t(
            `${chf(gifts)}, at most 20 % of the net income ${chf(net)} (${chf(d.cap)}): ${chf(d.deduction)}.`,
            `${chf(gifts)}, au plus 20${NB}% du revenu net ${chf(net)} (${chf(d.cap)})${NB}: ${chf(d.deduction)}.`,
          ),
        ),
      );
    } else if (gifts > 0) notes.add(notes.notCounted, NOTE.donationsMin);
  }

  // Social deductions (750 to 770).
  const personal = (
    code: RubricCode,
    pick: (s: BsYearParams['amounts']['social']['value']) => number,
    how: (value: number) => Text,
    sources: readonly string[] = fam.sources,
  ) => {
    const tr = new Trace().src(...sources);
    const value = pick(tr.p(A.social));
    items.push(item(code, 'household', tr, -value, how(value)));
  };
  if (fam.childUnits > 0) {
    personal(
      '750',
      (s) => Math.round(s.child * fam.childUnits),
      (v) =>
        t(
          `${String(fam.childUnits)} x ${chf(A.social.value.child)}: ${chf(v)}.`,
          `${String(fam.childUnits).replace('.', ',')} x ${chf(A.social.value.child)}${NB}: ${chf(v)}.`,
        ),
    );
  }
  if (couple) {
    personal(
      '760',
      (s) => s.married,
      (v) =>
        t(`Spouses living together: ${chf(v)}.`, `Époux faisant ménage commun${NB}: ${chf(v)}.`),
    );
  } else if (fam.singleParent) {
    personal(
      '765',
      (s) => s.singleParent,
      (v) =>
        t(
          `A single parent keeping a household alone with the children: ${chf(v)}.`,
          `Parent seul faisant ménage avec les enfants${NB}: ${chf(v)}.`,
        ),
    );
  } else {
    personal(
      '767',
      (s) => s.single,
      (v) => t(`Everyone else: ${chf(v)}.`, `Autres personnes${NB}: ${chf(v)}.`),
    );
    if (retiree(people[0]!, figures[0]!, subtotals(items).gross, notes)) {
      personal(
        '770',
        (s) => s.retiree,
        (v) =>
          t(
            `A single retiree, on top of 767: ${chf(v)}.`,
            `Retraité seul, en plus de 767${NB}: ${chf(v)}.`,
          ),
        [retireeRule(P.taxYear).source],
      );
    }
  }

  // Wealth (800 to 899).
  const wealthItems: Item[] = [];
  if (movable.some((m) => (m.value?.value ?? 0) > 0 && !m.income)) {
    notes.add(notes.unsupported, NOTE.movableIncome);
  }
  const valueTr = new Trace();
  const market = total(
    valueTr,
    movable.map((m) => m.value),
  );
  if (market > 0) {
    const tr = new Trace().with(valueTr, incomeTr).src(securitiesRule(P.taxYear).source);
    const factor = tr.p(A.securitiesFactor);
    const v = securitiesValue(market, grossYield, factor);
    if (v.value < market) notes.add(notes.assumptions, NOTE.securitiesMean);
    // Form W, page 4: line 11 (market value), 14 (yield value), 16 (the mean); 800 the lower.
    wealthItems.push(
      withParts(
        wealthItem(
          '800',
          tr,
          v.value,
          t(
            `Market value ${chf(market)}; yield value: gross income ${chf(grossYield)} x ${factor} = ${chf(v.yieldValue)}; mean ${chf(v.mean)}; ${v.value < market ? 'the mean, lower' : 'the market value, not higher than the mean'}: ${chf(v.value)}.`,
            `Valeur vénale ${chf(market)}${NB}; valeur de rendement${NB}: rendement brut ${chf(grossYield)} x ${factor} = ${chf(v.yieldValue)}${NB}; moyenne ${chf(v.mean)}${NB}; ${v.value < market ? 'la moyenne, plus basse' : 'la valeur vénale, pas plus élevée que la moyenne'}${NB}: ${chf(v.value)}.`,
          ),
        ),
        [
          { code: FORM_W.market, amount: market },
          { code: FORM_W.yieldValue, amount: v.yieldValue },
          { code: FORM_W.mean, amount: v.mean },
        ],
      ),
    );
  }
  const asset = (code: WealthCode, amounts: readonly (Amount | undefined)[], sign: 1 | -1) => {
    if (!amounts.some(Boolean)) return;
    const tr = new Trace();
    const value = total(tr, amounts);
    if (value > 0) wealthItems.push(wealthItem(code, tr, sign * value, given(value)));
  };
  asset('815', [hh.lifeInsuranceValue], 1);
  asset('835', [hh.cash, hh.otherAssets], 1);
  asset('870', [hh.debts], -1);
  {
    const tr = new Trace().src(...fam.sources);
    const free = tr.p(A.wealthFree);
    const family = couple || fam.singleParent;
    const value = family ? free.family : free.single;
    wealthItems.push(
      wealthItem(
        family ? '890' : '891',
        tr,
        -value,
        t(
          `${family ? (couple ? 'Spouses' : 'A single parent') : 'Everyone else'}: ${chf(value)}.`,
          `${family ? (couple ? 'Époux' : 'Parent seul') : 'Autres personnes'}${NB}: ${chf(value)}.`,
        ),
      ),
    );
  }
  // Minor children (892): every reading must give the same taxable wealth. When they differ in the
  // amount but not in the taxable wealth (zero either way), the line is left out: its amount is not
  // settled, and the tax is the same.
  const { low, high, unknownMinor } = fam.minorAllowance;
  if (high > 0) {
    const before = wealthItems.reduce((sum, i) => sum + i.amount, 0);
    if (Math.max(0, before - low) !== Math.max(0, before - high)) {
      notes.add(notes.unsupported, unknownMinor ? NOTE.minorChild : NOTE.sharedAllowance);
    } else if (low === high) {
      const tr = new Trace().src(...fam.sources);
      const per = tr.p(A.wealthFree).perMinorChild;
      wealthItems.push(
        wealthItem(
          '892',
          tr,
          -low,
          t(
            `${chf(per)} per minor child you mainly provide for: ${chf(low)}.`,
            `${chf(per)} par enfant mineur à votre charge principale${NB}: ${chf(low)}.`,
          ),
        ),
      );
    }
  }
  const base = summary([...items, ...wealthItems]);
  if (notes.unsupported.length) return unsupportedResult(notes.assumptions, notes.notCounted, base);

  // In the form's order, person 1 before person 2 (the sort is stable).
  const order = Object.keys(RUBRICS);
  items.sort((x, y) => order.indexOf(x.code) - order.indexOf(y.code));
  const wealthOrder = Object.keys(WEALTH_RUBRICS);
  wealthItems.sort((x, y) => wealthOrder.indexOf(x.code) - wealthOrder.indexOf(y.code));
  try {
    const icc = assess({
      taxYear: input.taxYear,
      commune: input.commune,
      incomeTariff: couple || fam.singleParent ? 'B' : 'A',
      wealthTariff: couple ? 'B' : 'A',
      lowIncomeFamily: couple || fam.childUnits > 0,
      familySources: fam.sources,
      incomeItems: items,
      wealthItems,
    });
    const unverified = [NOTE.rounding, ...notes.unverified];
    if (icc.taxes.wealthReduction.amount !== 0 && ref.rate !== 0)
      unverified.push(NOTE.reductionThenCommune);

    // The federal tax, the Bund column (./ifd.ts): the same income lines, the federal deductions.
    // Who counts the children follows the same child support rule (circular 30).
    const children = input.children ?? [];
    const shared = !couple && children.some((ch) => ch.custody === 'shared');
    const support = shared ? input.childSupport : undefined;
    const federalChildSources =
      support === 'receives'
        ? [`${CIRCULAR30} p. 24 and 33 (ch. 13.4.2, 14.5)`]
        : support === 'pays'
          ? [`${CIRCULAR30} p. 24, 32 and 33 (ch. 13.4.2, 14.5)`]
          : support === 'none' && input.ifdParentalScale !== undefined
            ? [`${CIRCULAR30} p. 19, 24 and 32 (ch. 10.2, 13.4.2, 14.4)`]
            : [];
    const perChild = children.some((ch) => ch.childcare);
    const federalChildren: FederalChild[] = [];
    for (const ch of children) {
      const weight =
        ch.custody === 'full' || input.childSupport === 'receives'
          ? 1
          : input.childSupport === 'none'
            ? 0.5
            : 0;
      if (!weight) continue;
      federalChildren.push({
        weight,
        livesWithYou: ch.livesWithYou ?? true,
        ...(ch.under14 !== undefined ? { under14: ch.under14 } : {}),
        ...(ch.childcare ? { childcare: ch.childcare } : {}),
      });
    }
    const federal = federalReturn(
      {
        input,
        couple,
        incomeItems: items.filter((i) => INCOME.has(i.code)),
        inFull: items.filter((i) => IN_FULL.has(i.code)),
        children: federalChildren,
        ...(!perChild && hh.childcare ? { householdChildcare: hh.childcare } : {}),
        childSources: federalChildSources,
        wealthIncome: grossYield,
      },
      people.map((p) => ({
        input: p,
        salaries: items.filter(
          (i) =>
            i.person === p.id &&
            (i.code === PERSON_CODES.main[p.id] || i.code === PERSON_CODES.side[p.id]),
        ),
      })),
    );
    const ifd = federal.ifd;
    for (const x of federal.notes.notCounted) notes.add(notes.notCounted, x);
    return {
      canton: 'BS',
      taxYear: input.taxYear,
      commune: ref,
      icc,
      ifd,
      total: ifd ? icc.taxes.total.amount + ifd.tax.amount : null,
      ...summary([...items, ...wealthItems, ...(ifd?.items ?? [])], allLines({ icc, ifd })),
      assumptions: notes.assumptions,
      notCounted: notes.notCounted,
      unsupported: [...federal.notes.unsupported],
      unverifiedRules: [...unverified, ...federal.notes.unverified],
      limits: bothTaxes(notes.limits, federal.notes.limits),
    };
  } catch (e) {
    if (!(e instanceof BsUnsupported)) throw e;
    notes.add(notes.unsupported, e.note);
    return unsupportedResult(notes.assumptions, notes.notCounted, base);
  }
}

/** ESTV circular 30 on the taxation of spouses and the family: separated parents, the scales. */
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';
/** Deductions in full in both columns: buy-ins paid directly, alimony and child support paid. */
const IN_FULL = new Set(['560', '561', '610', '615']);

/**
 * What a result says of the lines it rests on: the estimates, how many items still need the user's
 * OK (each line and person once, in either column), whether some amount is known only in part.
 */
function summary(items: readonly Item[], lines: readonly Line[] = items) {
  const seen = new Set<string>();
  const needsOk = items.filter((i) => {
    const key = `${i.code}|${i.person}`;
    if (!i.needsOk || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).length;
  return {
    estimates: [...new Set(lines.flatMap((l) => l.estimates ?? []))]
      .filter((id): id is keyof typeof ESTIMATE_TEXT => id in ESTIMATE_TEXT)
      .map((id) => ({ id, what: ESTIMATE_TEXT[id] })),
    needsOk,
    complete: !lines.some((l) => l.incomplete),
    incomplete: lines
      .filter((l) => l.incomplete)
      .map((l) => l.label)
      .filter((x, i, all) => all.findIndex((y) => y.en === x.en) === i),
  };
}

/**
 * The limits of both taxes, a limit applied alike in each (same line, rule kind and amounts, as
 * the pillar 3a cap) said once for both: the final check then shows it once (SPEC.md 10.0).
 */
function bothTaxes(icc: readonly LimitApplied[], ifd: readonly LimitApplied[]): LimitApplied[] {
  const out = icc.map((l) => ({ ...l }));
  for (const f of ifd) {
    const same = out.find(
      (l) =>
        l.tax === 'icc' &&
        l.code === f.code &&
        l.person === f.person &&
        l.kind === f.kind &&
        l.given === f.given &&
        l.limit === f.limit &&
        l.counted === f.counted &&
        l.rule === f.rule &&
        Boolean(l.estimate) === Boolean(f.estimate),
    );
    if (same) same.tax = 'both';
    else out.push(f);
  }
  return out;
}

/**
 * The children with the childcare paid for each (670, form F): as given per child, or the
 * household's total on one child where every split gives the same deduction: one child under 14,
 * or a total within the smallest limit of a child (the limit; half of it for a child shared half
 * and half without child support; none for a child who counts for the other parent). Otherwise how
 * it splits decides the deduction: not computed until it is given per child.
 */
function childcareOf(input: BsEngineInput, cap: number, notes: Notes): readonly ChildInput[] {
  const children = input.children ?? [];
  const paid = input.household?.childcare;
  if (!paid || paid.value <= 0 || children.some((ch) => ch.childcare)) return children;
  const young = children.filter((ch) => ch.under14 !== false && ch.livesWithYou !== false);
  if (!young.length) {
    notes.add(notes.notCounted, NOTE.childcareNoChild);
    return children;
  }
  const limitOf = (ch: ChildInput) =>
    ch.custody === 'full' || input.childSupport === 'receives'
      ? cap
      : input.childSupport === 'none'
        ? cap / 2
        : 0;
  if (young.length > 1 && paid.value > Math.min(...young.map(limitOf))) {
    notes.add(notes.unsupported, NOTE.childcareSplit);
    return children;
  }
  const first = young[0];
  return children.map((ch) => (ch === first ? { ...ch, childcare: paid } : ch));
}

/** Every computed line of a result, both columns, for checks and for the explanation tree. */
export function allLines(r: Pick<BsTaxResult, 'icc'> & { ifd?: BsTaxResult['ifd'] }): Line[] {
  const f = r.ifd;
  const federal: Line[] = f
    ? [
        ...f.items,
        f.grossIncome,
        f.totalDeductions,
        f.subtotal709,
        f.netIncome,
        f.taxableIncome,
        f.scaleIncome,
        f.scaleTax,
        f.childReduction,
        f.tax,
      ]
    : [];
  if (!r.icc) return federal;
  const x = r.icc;
  return [
    ...x.items,
    x.grossIncome,
    x.netIncome,
    x.pureIncome,
    x.taxableIncome,
    ...x.wealth.items,
    x.wealth.grossWealth,
    x.wealth.netWealth,
    x.wealth.taxableWealth,
    x.taxes.incomeTariffTax,
    x.taxes.cantonalIncome,
    x.taxes.communalIncome,
    x.taxes.wealthTariffTax,
    x.taxes.wealthReduction,
    x.taxes.cantonalWealth,
    x.taxes.communalWealth,
    x.taxes.total,
    ...federal,
  ];
}

/** For the sources test: the cited rules this module applies. */
export const COMPUTE_RULES = (y: BsEngineInput['taxYear']) => [
  childRule(y),
  singleParentRule(y),
  retireeRule(y),
  familySituation(y),
  securitiesRule(y),
  exemptGoods(y),
  professionalRule(y),
];
