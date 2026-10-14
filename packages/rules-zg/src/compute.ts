// The one entry point: computeReturn(input) gives the lines of Zug's form K by code and person, the
// totals and the cantonal and communal tax (with the church and Bürgergemeinde tax when asked for),
// and the federal tax of form K's Bund column (./ifd.ts), each line explained with its sources.
// First stage here (household figures to the lines of the form, every cap, floor and table of the
// Zug documents, in the order of the form's codes, with the limits each applied for the final
// check), second stage in ./assess.ts (lines to taxes). The same two stages, with the same names, as
// packages/rules-bl, rules-be and rules-fr.
import {
  answered,
  chf,
  mealsDeduction,
  pillar3a as federalPillar3a,
  roundFranc,
  shareFranc,
  Trace,
  type Amount,
  type LimitApplied,
} from '@taxpresso/rules-ch';
import {
  assess,
  communeOf,
  communeRef,
  subtotals,
  wealthTotals,
  ZgInputError,
  type LevyPart,
} from './assess.js';
import { foldName } from './communes.js';
import { ESTIMATE_TEXT, NOTE } from './explain.js';
import { federalReturn, type FederalChild } from './ifd.js';
import {
  childcareRule,
  childRule,
  childrenIncome,
  churchRule,
  citizensRule,
  communeAtYearEnd,
  donationsRule,
  familySituation,
  insuranceRule,
  medicalRule,
  ownCareRule,
  pensionerRule,
  rentRule,
  sharedCustody,
  tariffRule,
  twoEarnerRule,
  wealthAllowance,
} from './law.js';
import { zgParamsFor, type ZgTaxYear, type ZgYearParams } from './params.js';
import {
  INCOME,
  PERSON_CODES,
  RUBRICS,
  WEALTH_RUBRICS,
  type RubricCode,
  type WealthCode,
} from './rubrics.js';
import {
  flatShare,
  pensionerAmount,
  rentDeduction,
  twoEarnerDeduction,
  vehicleCost,
} from './rules.js';
import type {
  ChildInput,
  EmploymentInput,
  Item,
  ItemPerson,
  Line,
  PersonInput,
  Text,
  ZgEngineInput,
  ZgTaxResult,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
/** Centimes per km as francs: 70 -> "0.70". */
const perKm = (c: number) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;

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
   * A limit a cantonal rule applied (SPEC.md 10.0), on `code` for `person`, cited by the constant
   * that sets it: `given` before the rule, `counted` after it. `rule` names it as the federal
   * concepts are (packages/rules-ch, ifd/items.ts).
   */
  limit(
    rule: string,
    p: { source: string },
    code: string,
    person: LimitApplied['person'],
    given: number,
    limit: number,
    counted: number,
    kind: LimitApplied['kind'] = 'cap',
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
      rule,
    });
  }
}

/** An item for this line and person; its label and the guide's page come from the catalogue. */
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

/** Sum of amounts read into a trace, to the franc (the form takes whole francs). */
function total(tr: Trace, amounts: readonly (Amount | undefined)[]): number {
  return roundFranc(amounts.reduce((s, a) => s + tr.a(a), 0));
}

const given = (value: number) =>
  t(`As given: ${chf(value)}.`, `Tel que donné${NB}: ${chf(value)}.`);

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

/** Travel to work before the cap, and how it was found (no final full stop). */
function travel(
  P: ZgYearParams,
  p: PersonInput,
  main: readonly EmploymentInput[],
  tr: Trace,
  notes: Notes,
): { cost: number; how: Text } {
  const mode = p.commuteMode;
  if (mode) tr.with(answered(mode.facts, mode.status));
  const none = (how: Text) => ({ cost: 0, how });
  if (main.length && main.every((e) => e.freeTransport)) {
    notes.add(notes.assumptions, NOTE.freeTransport);
    return none(t('travel: transport provided', `transport${NB}: fourni par l’employeur`));
  }
  if (mode?.by === 'home' || mode?.by === 'walk') {
    return none(t('travel: none', `transport${NB}: aucun`));
  }
  const v = P.amounts.travel;
  const vehicle = mode?.by === 'car' || mode?.by === 'motorbike';
  if (vehicle && mode.transitUsable === false) {
    // No usable public transport: per km, there and back each working day (guide p. 32).
    if (!mode.kmOneWay || !mode.days) {
      notes.add(notes.notCounted, NOTE.drivingDetails);
      return none(t('travel: not counted', `transport${NB}: non compté`));
    }
    const limits = tr.p(v);
    let days = mode.days;
    let capped = '';
    if (limits.maxDays === null) {
      if (days > 220) notes.add(notes.unsupported, NOTE.days2026);
    } else if (days > limits.maxDays) {
      capped = ` (at most ${limits.maxDays})`;
      days = limits.maxDays;
    }
    const rate = mode.by === 'car' ? limits.carPerKm : limits.motorbikePerKm;
    const cost = vehicleCost(mode.kmOneWay, days, rate);
    const what = mode.by === 'car' ? t('car', 'voiture') : t('motorbike', 'motocycle');
    return {
      cost,
      how: t(
        `travel ${chf(cost)} (${what.en}, no usable public transport: ${mode.kmOneWay} km x 2 x ${days} days${capped} x CHF ${perKm(rate)})`,
        `transport ${chf(cost)} (${what.fr}, sans transports publics utilisables${NB}: ${mode.kmOneWay} km x 2 x ${days} jours${capped ? ` (au plus ${days})` : ''} x CHF ${perKm(rate)})`,
      ),
    };
  }
  if (mode?.by === 'bike') {
    const year = tr.p(v).bikePerYear;
    notes.add(notes.assumptions, NOTE.bikeFlat);
    return {
      cost: year,
      how: t(
        `travel ${chf(year)} (bike, moped or yellow-plate motorbike, the flat amount a year)`,
        `transport ${chf(year)} (vélo, cyclomoteur ou motocycle à plaque jaune, le forfait annuel)`,
      ),
    };
  }
  // Public transport: what it cost; a car or a motorbike when public transport could be used: what
  // public transport would have cost (guide p. 32: grundsätzlich nur die öffentlichen Verkehrsmittel).
  if (!mode && !p.commuteCost) {
    return none(t('travel: nothing given', `transport${NB}: rien d’indiqué`));
  }
  if (!p.commuteCost) {
    notes.add(notes.notCounted, vehicle ? NOTE.drivingDetails : NOTE.transitDetails);
    return none(t('travel: not counted', `transport${NB}: non compté`));
  }
  const cost = total(tr, [p.commuteCost]);
  return {
    cost,
    how: vehicle
      ? t(
          `travel ${chf(cost)} (what public transport would have cost)`,
          `transport ${chf(cost)} (ce qu’auraient coûté les transports publics)`,
        )
      : t(
          `travel ${chf(cost)} (public transport, what it cost)`,
          `transport ${chf(cost)} (transports publics, frais effectifs)`,
        ),
  };
}

interface PersonFigures {
  id: 'p1' | 'p2';
  /** Salary and allowances, before any cost: whether the person works (260, 253). */
  works: boolean;
  /** The earned income for 260 (Verordnung § 15): salary and allowances less 201, 220, 250. */
  earned: number;
  earnedTr: Trace;
  /** Receives an AHV or IV pension (130/131). */
  pensioner: boolean;
  /** Pays into a pension fund or pillar 3a (the insurance deduction, 230). */
  contributes: boolean;
  /** Trained (245/246), for the note on 2026. */
  trained: boolean;
  /** Alimony received for oneself (170 is the household's line). */
  alimony: { amount: number; tr: Trace } | null;
}

function personItems(P: ZgYearParams, p: PersonInput, items: Item[], notes: Notes): PersonFigures {
  const A = P.amounts;
  const id = p.id;
  const all = p.employments ?? [];
  // A side job needs a main job (guide p. 34); without one, the jobs are the main employment.
  const hasMain = all.some((e) => !e.side);
  const main = hasMain ? all.filter((e) => !e.side) : all;
  const side = hasMain ? all.filter((e) => e.side) : [];
  const mainSalary = salary(main);
  const sideSalary = salary(side);
  const salaryHow = (net: number) =>
    t(
      `Gross salary less social and pension fund contributions and buy-ins (salary certificate boxes 8 - 9 - 10 = box 11): ${chf(net)}.`,
      `Salaire brut moins cotisations sociales, cotisations et rachats de prévoyance (certificat de salaire, chiffres 8 - 9 - 10 = chiffre 11)${NB}: ${chf(net)}.`,
    );
  if (main.length) {
    items.push(
      item(PERSON_CODES.main[id], id, mainSalary.tr, mainSalary.net, salaryHow(mainSalary.net)),
    );
  }
  if (side.length) {
    items.push(
      item(PERSON_CODES.side[id], id, sideSalary.tr, sideSalary.net, salaryHow(sideSalary.net)),
    );
  }

  // Professional costs (201/202): travel, meals, the other costs (flat or actual), a side job.
  let professional = 0;
  const professionalTr = new Trace();
  if (main.length) {
    const tr = new Trace().with(mainSalary.tr);
    const parts: Text[] = [];
    const tv = travel(P, p, main, tr, notes);
    if (tv.cost > 0) {
      const max = tr.p(A.travel).max;
      const v = Math.min(tv.cost, max);
      notes.limit('commute', A.travel, PERSON_CODES.professional[id], id, tv.cost, max, v);
      professional += v;
      parts.push(
        v < tv.cost
          ? t(
              `${tv.how.en}, at most ${chf(max)} a year: ${chf(v)}`,
              `${tv.how.fr}, au plus ${chf(max)} par an${NB}: ${chf(v)}`,
            )
          : tv.how,
      );
    }
    if (p.commuteMode?.by === 'home') {
      notes.add(notes.assumptions, NOTE.workFromHome);
    } else if ((p.mealDays ?? 0) > 0) {
      tr.with(answered(p.mealFacts));
      const m = tr.p(A.meals);
      const canteen = main.some((e) => e.canteen);
      const days = p.mealDays ?? 0;
      const meals = mealsDeduction(days, canteen, m);
      const [perDay, perYear] = canteen ? [m.halfPerDay, m.halfPerYear] : [m.perDay, m.perYear];
      notes.limit(
        'meals',
        A.meals,
        PERSON_CODES.professional[id],
        id,
        days * perDay,
        perYear,
        meals,
      );
      professional += meals;
      parts.push(
        t(
          `meals ${chf(meals)} (${days} days x ${chf(perDay)}${canteen ? ', half: canteen or meal vouchers, box G' : ''}, at most ${chf(perYear)} a year)`,
          `repas ${chf(meals)} (${days} jours x ${chf(perDay)}${canteen ? `, moitié${NB}: cantine ou bons de repas, case G` : ''}, au plus ${chf(perYear)} par an)`,
        ),
      );
    }
    const ff = tr.p(A.otherFlat);
    const flat = flatShare(mainSalary.net, ff);
    const actual = p.otherProfessionalCosts ? total(tr, [p.otherProfessionalCosts]) : 0;
    if (actual) {
      notes.limit(
        'professional.flat',
        A.otherFlat,
        PERSON_CODES.professional[id],
        id,
        actual,
        flat,
        Math.max(actual, flat),
        'choice',
      );
    }
    notes.add(notes.assumptions, NOTE.fullYear);
    if (actual > flat) {
      professional += actual;
      parts.push(
        t(
          `other costs ${chf(actual)} (the actual costs, higher than the flat ${chf(flat)})`,
          `autres frais ${chf(actual)} (les frais effectifs, plus élevés que le forfait de ${chf(flat)})`,
        ),
      );
    } else {
      professional += flat;
      parts.push(
        t(
          `other costs ${chf(flat)} (the flat ${ff.rateBp / 100} % of the net salary ${chf(mainSalary.net)}, at least ${chf(ff.min)}, at most ${chf(ff.max)})`,
          `autres frais ${chf(flat)} (le forfait de ${ff.rateBp / 100}${NB}% du salaire net ${chf(mainSalary.net)}, au moins ${chf(ff.min)}, au plus ${chf(ff.max)})`,
        ),
      );
    }
    if (side.length) {
      tr.with(sideSalary.tr);
      const sp = tr.p(A.sideJob);
      const v = flatShare(sideSalary.net, sp);
      professional += v;
      parts.push(
        t(
          `side job ${chf(v)} (${sp.rateBp / 100} % of its net income ${chf(sideSalary.net)}, at least ${chf(sp.min)}, at most ${chf(sp.max)}, never more than that income)`,
          `activité accessoire ${chf(v)} (${sp.rateBp / 100}${NB}% de son revenu net ${chf(sideSalary.net)}, au moins ${chf(sp.min)}, au plus ${chf(sp.max)}, jamais plus que ce revenu)`,
        ),
      );
    }
    professionalTr.with(tr);
    if (professional > 0) {
      items.push(
        item(
          PERSON_CODES.professional[id],
          id,
          tr,
          -professional,
          t(
            `${parts.map((x) => x.en).join('; ')}. Together: ${chf(professional)}.`,
            `${parts.map((x) => x.fr).join(`${NB}; `)}. Ensemble${NB}: ${chf(professional)}.`,
          ),
        ),
      );
    }
  }

  // Pensions (130 to 136) and allowances (145 to 151).
  const own = (code: RubricCode, amounts: readonly (Amount | undefined)[], note?: Text) => {
    if (!amounts.some(Boolean)) return { value: 0, tr: new Trace() };
    const tr = new Trace();
    const value = total(tr, amounts);
    if (value <= 0) return { value: 0, tr };
    if (note) notes.add(notes.assumptions, note);
    items.push(item(code, id, tr, value, given(value)));
    return { value, tr };
  };
  const pensioner = own(PERSON_CODES.avs[id], [p.pensionAvs]).value > 0;
  own(PERSON_CODES.pensions[id], [p.pensionOccupational, p.pensionOther], NOTE.pensions);
  const allowances = own(PERSON_CODES.allowances[id], [p.replacementIncome]);
  const unemployment = own(PERSON_CODES.unemployment[id], [p.unemploymentBenefits]);

  // Pension fund buy-ins paid directly (250/251).
  let buyIn = 0;
  const buyInTr = new Trace();
  if (p.pensionBuyIn) {
    buyIn = total(buyInTr, [p.pensionBuyIn]);
    if (buyIn > 0) items.push(item(PERSON_CODES.buyIn[id], id, buyInTr, -buyIn, given(buyIn)));
  }

  // Pillar 3a (220/221): the federal limits (StG § 30 Abs. 1 Bst. e).
  const hasPensionFund =
    p.hasPensionFund ??
    all.some((e) => (e.pensionFund?.value ?? 0) > 0 || (e.pensionBuyIn?.value ?? 0) > 0);
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
    notes.limits.push({
      code: PERSON_CODES.pillar3a[id],
      person: id,
      tax: 'icc',
      kind: l.kind,
      given: l.given,
      limit: l.limit,
      counted: l.counted,
      source: l.param.source,
      ...(l.param.estimate ? { estimate: true } : {}),
      rule: 'pillar3a',
    });
  }
  let pillar = 0;
  const pillarTr = new Trace();
  if (r3a.deduction && r3a.deduction.amount < 0) {
    pillar = -r3a.deduction.amount;
    pillarTr.with(r3a.deduction.trace);
    items.push(
      item(
        PERSON_CODES.pillar3a[id],
        id,
        r3a.deduction.trace,
        r3a.deduction.amount,
        r3a.deduction.how,
      ),
    );
  }

  // Professional training (245/246): at most per person.
  let trained = false;
  if (p.trainingCosts) {
    const tr = new Trace();
    const paid = total(tr, [p.trainingCosts]);
    const cap = tr.p(A.training);
    const v = Math.min(paid, cap);
    notes.limit('training', A.training, PERSON_CODES.training[id], id, paid, cap, v);
    if (v > 0) {
      trained = true;
      items.push(
        item(
          PERSON_CODES.training[id],
          id,
          tr,
          -v,
          t(
            `Paid ${chf(paid)}, at most ${chf(cap)} a person: ${chf(v)}.`,
            `Payé ${chf(paid)}, au plus ${chf(cap)} par personne${NB}: ${chf(v)}.`,
          ),
        ),
      );
    }
  }

  let alimony: PersonFigures['alimony'] = null;
  if (p.alimonyReceived) {
    const tr = new Trace();
    const amount = total(tr, [p.alimonyReceived]);
    if (amount > 0) alimony = { amount, tr };
  }

  const gainful = mainSalary.net + sideSalary.net + allowances.value + unemployment.value;
  return {
    id,
    works: gainful > 0,
    earned: gainful - professional - pillar - buyIn,
    earnedTr: new Trace().with(
      mainSalary.tr,
      sideSalary.tr,
      allowances.tr,
      unemployment.tr,
      professionalTr,
      pillarTr,
      buyInTr,
    ),
    pensioner,
    contributes: hasPensionFund || pillar > 0 || buyIn > 0,
    trained,
    alimony,
  };
}

/** A child as the deductions read it. */
interface CountedChild {
  /** Its place in the children given, from 1. */
  n: number;
  /** Gets the child deduction here (403), and so the tax-free wealth (673) when a minor. */
  counts: boolean;
  livesWithYou: boolean;
  /** The insurance deduction for the child (230): 2 halves (all of it), 1 (half) or 0. */
  insuranceHalves: 0 | 1 | 2;
  under14: boolean;
  under15: boolean;
  minor: boolean;
  childcare?: Amount;
}

/**
 * Who counts the children, the personal deduction and the tariff: a married couple, or a parent
 * living with a child who counts for them, has the large personal deduction and the
 * Mehrpersonentarif (StG § 33 Abs. 1 Ziff. 1, § 35 Abs. 2; Verordnung § 18).
 */
function familyOf(
  input: ZgEngineInput,
  given: readonly ChildInput[],
  couple: boolean,
  notes: Notes,
): { children: CountedChild[]; large: boolean; sources: string[] } {
  const y = input.taxYear;
  const children: CountedChild[] = [];
  const sources = [familySituation(y).source];
  const each = (ch: ChildInput, i: number): CountedChild | null => {
    const lives = ch.livesWithYou ?? true;
    let counts: boolean;
    let insuranceHalves: 0 | 1 | 2;
    if (ch.custody === 'full' || couple) {
      if (ch.custody === 'shared') {
        notes.add(notes.unsupported, NOTE.marriedShared);
        return null;
      }
      counts = true;
      insuranceHalves = 2;
      if (!lives) notes.add(notes.assumptions, NOTE.childNotWithYou);
    } else {
      sources.push(sharedCustody().source);
      if (input.childSupport === 'receives') {
        counts = true;
        insuranceHalves = 2;
        notes.add(notes.assumptions, NOTE.childSupportReceived);
      } else if (input.childSupport === 'pays') {
        counts = false;
        insuranceHalves = 0;
        notes.add(notes.assumptions, NOTE.childSupportPaid);
      } else if (input.childSupport === 'none') {
        if (input.mainCare === undefined) {
          notes.add(notes.unsupported, NOTE.mainCare);
          return null;
        }
        counts = input.mainCare;
        insuranceHalves = 1;
        notes.add(notes.assumptions, counts ? NOTE.mainCareYes : NOTE.mainCareNo);
      } else {
        notes.add(notes.unsupported, NOTE.childSupport);
        return null;
      }
    }
    // Ages: under 14 (childcare), under 15 (own care or the extra child deduction), a minor.
    let under14 = ch.under14;
    if (under14 === undefined && ch.childcare) {
      under14 = true;
      notes.add(notes.assumptions, NOTE.under14);
    }
    const under15 = ch.under15 ?? (under14 ? true : undefined);
    const minor = ch.minor ?? (under15 ? true : undefined);
    if ((under14 && ch.under15 === false) || (under15 && ch.minor === false)) {
      throw new ZgInputError(`Child ${i}: the ages given contradict each other.`);
    }
    if (counts && under15 === undefined) {
      notes.add(notes.unsupported, NOTE.under15);
      return null;
    }
    if (counts && minor === undefined) {
      notes.add(notes.unsupported, NOTE.minor);
      return null;
    }
    return {
      n: i + 1,
      counts,
      livesWithYou: lives,
      insuranceHalves,
      under14: under14 ?? false,
      under15: under15 ?? false,
      minor: minor ?? false,
      ...(ch.childcare ? { childcare: ch.childcare } : {}),
    };
  };
  given.forEach((ch, i) => {
    const c = each(ch, i);
    if (c) children.push(c);
  });
  if (children.some((c) => c.counts)) {
    notes.add(notes.assumptions, NOTE.childrenAtCharge);
    sources.push(childRule(y).source, childrenIncome(y).source);
  }
  const large = couple || children.some((c) => c.counts && c.livesWithYou);
  sources.push(tariffRule(y).source);
  return { children, large, sources: [...new Set(sources)] };
}

/**
 * The church tax's parts, when asked for: null when nobody is a member; undefined when not asked
 * for, or not computed (the result says why). A mixed marriage without children pays half of each
 * spouse's parish (StG § 169 Abs. 2).
 */
function churchOf(
  input: ZgEngineInput,
  P: ZgYearParams,
  couple: boolean,
  notes: Notes,
): LevyPart[] | null | undefined {
  const church = input.church;
  if (!church) {
    notes.add(notes.notCounted, NOTE.churchNotAsked);
    return undefined;
  }
  const members = couple ? [church.p1 ?? 'none', church.p2 ?? 'none'] : [church.p1 ?? 'none'];
  if (members.every((m) => m === 'none')) return null;
  const C = communeOf(P.taxYear, input.commune);
  const rate = (m: 'catholic' | 'reformed') => (m === 'catholic' ? C.catholic : P.reformed.value);
  const first = members[0]!;
  if (members.every((m) => m === first) && first !== 'none') {
    return [{ who: first, rate: rate(first), shareBp: 10_000 }];
  }
  if ((input.children ?? []).length) {
    notes.add(notes.unsupported, NOTE.churchMixedChildren);
    return undefined;
  }
  notes.add(notes.unverified, NOTE.churchShares);
  const parts: LevyPart[] = [];
  for (const m of members) {
    if (m === 'none') continue;
    const same = parts.find((x) => x.who === m);
    if (same) same.shareBp += 5_000;
    else parts.push({ who: m, rate: rate(m), shareBp: 5_000 });
  }
  return parts;
}

/**
 * The Bürgergemeinde's levy, when asked for: null when nobody is an Ortsbürger of a Bürgergemeinde
 * that levies an ordinary tax; undefined when not asked for or not computed (StG § 170).
 */
function citizensOf(
  input: ZgEngineInput,
  P: ZgYearParams,
  couple: boolean,
  notes: Notes,
): LevyPart | null | undefined {
  const c = input.citizenOf;
  if (!c) {
    notes.add(notes.notCounted, NOTE.citizensNotAsked);
    return undefined;
  }
  const of = couple ? [c.p1 ?? null, c.p2 ?? null] : [c.p1 ?? null];
  for (const name of of) if (name !== null) communeOf(P.taxYear, name); // throws for an unknown commune
  const named = of.filter((x): x is string => x !== null);
  if (!named.length) return null;
  if (new Set(named.map(foldName)).size > 1) {
    notes.add(notes.unsupported, NOTE.citizensDifferent);
    return undefined;
  }
  const B = communeOf(P.taxYear, named[0]!);
  if (B.citizens === null) {
    notes.add(notes.assumptions, NOTE.citizensNone);
    return null;
  }
  if (B.citizens === 'special') {
    notes.add(notes.assumptions, NOTE.citizensSpecial);
    return null;
  }
  const half = couple && named.length === 1;
  if (half) notes.add(notes.assumptions, NOTE.citizensHalf);
  return { who: B.name, rate: B.citizens, shareBp: half ? 5_000 : 10_000 };
}

export function computeReturn(input: ZgEngineInput): ZgTaxResult {
  const P = zgParamsFor(input.taxYear);
  const A = P.amounts;
  const y: ZgTaxYear = P.taxYear;
  const ref = communeRef(y, input.commune); // throws for an unknown commune
  const notes = new Notes();
  const couple = input.civilStatus === 'married';
  const people = [...input.people].sort((a, b) => a.id.localeCompare(b.id));
  if (!people.some((p) => p.id === 'p1')) throw new ZgInputError('people must include p1');
  if (!couple && people.some((p) => p.id === 'p2')) {
    throw new ZgInputError('p2 is the spouse: only for a married couple');
  }
  if (new Set(people.map((p) => p.id)).size !== people.length) {
    throw new ZgInputError('each person once');
  }
  const hh = input.household ?? {};
  if (people.some((p) => p.selfEmploymentProfit)) notes.add(notes.unsupported, NOTE.selfEmployed);
  notes.add(notes.assumptions, NOTE.wholeYear);
  if (input.movable?.length) notes.add(notes.assumptions, NOTE.listedSecurities);
  notes.add(notes.notCounted, NOTE.dependents);

  const children = withHouseholdChildcare(input, P, notes);
  const fam = familyOf(input, children, couple, notes);
  const church = churchOf(input, P, couple, notes);
  const citizens = citizensOf(input, P, couple, notes);
  const result = (lines: readonly Line[]): ZgTaxResult => ({
    canton: 'ZG',
    taxYear: y,
    commune: ref,
    ifd: null,
    icc: null,
    total: null,
    estimates: lines.some((l) => l.estimates?.includes('input-estimate'))
      ? [{ id: 'input-estimate', what: ESTIMATE_TEXT['input-estimate'] }]
      : [],
    needsOk: lines.filter((l) => l.needsOk).length,
    complete: !lines.some((l) => l.incomplete),
    incomplete: lines.filter((l) => l.incomplete).map((l) => l.label),
    assumptions: notes.assumptions,
    notCounted: notes.notCounted,
    unsupported: notes.unsupported,
    unverifiedRules: [],
    limits: notes.limits,
  });
  // Something every later line rests on is missing or not supported (a question about the family,
  // the church or the Bürgergemeinde, self-employment): the result says that first.
  if (notes.unsupported.length) return result([]);

  const items: Item[] = [];
  const figures = people.map((p) => personItems(P, p, items, notes));
  const counted = fam.children.filter((c) => c.counts);

  // Income of the household: securities and accounts (160), alimony (170), child support (171),
  // other income (173).
  const incomeTr = new Trace();
  const valueTr = new Trace();
  const movableIncome = total(
    incomeTr,
    (input.movable ?? []).map((m) => m.income),
  );
  const movableValue = total(
    valueTr,
    (input.movable ?? []).map((m) => m.value),
  );
  if ((input.movable ?? []).some((m) => m.owner.startsWith('child'))) {
    incomeTr.src(childrenIncome(y).source);
    valueTr.src(childrenIncome(y).source);
  }
  if (movableIncome > 0) {
    items.push(
      item(
        '160',
        'household',
        incomeTr,
        movableIncome,
        t(
          `Gross income of the securities and accounts: ${chf(movableIncome)}.`,
          `Rendement brut des titres et avoirs${NB}: ${chf(movableIncome)}.`,
        ),
      ),
    );
  }
  const alimony = figures.filter((f) => f.alimony);
  if (alimony.length) {
    const tr = new Trace().with(...alimony.map((f) => f.alimony!.tr));
    const amount = alimony.reduce((s, f) => s + f.alimony!.amount, 0);
    items.push(item('170', 'household', tr, amount, given(amount)));
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
  householdGiven('171', [hh.childSupportReceived], 1);
  householdGiven('173', [hh.otherIncome], 1);

  // Private debt interest (205): up to the income from wealth plus a fixed amount.
  if (hh.debtInterest) {
    const tr = new Trace().with(incomeTr);
    const paid = total(tr, [hh.debtInterest]);
    const extra = tr.p(A.debtInterestExtra);
    const cap = movableIncome + extra;
    const ded = Math.min(paid, cap);
    notes.limit('debt_interest', A.debtInterestExtra, '205', 'household', paid, cap, ded);
    if (ded > 0) {
      items.push(
        item(
          '205',
          'household',
          tr,
          -ded,
          t(
            `Paid ${chf(paid)}, at most the income from wealth plus ${chf(extra)} (${chf(cap)}): ${chf(ded)}.`,
            `Payé ${chf(paid)}, au plus le rendement de la fortune plus ${chf(extra)} (${chf(cap)})${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }
  householdGiven('210', [hh.alimonyPaid], -1);
  householdGiven('211', [hh.childSupportPaid], -1);

  // Insurance premiums and savings interest (230): what was paid, at most the year's amount.
  {
    const premiums = [
      hh.healthPremiums,
      hh.accidentPremiums,
      hh.lifeInsurancePremiums,
      hh.savingsInterest,
    ];
    if (!premiums.some(Boolean)) notes.add(notes.notCounted, NOTE.insuranceNotGiven);
    else {
      const tr = new Trace().src(insuranceRule(y).source, ...fam.sources);
      const paid = Math.max(0, total(tr, premiums) - total(tr, [hh.healthSubsidy]));
      const ins = tr.p(A.insurance);
      const contributes = figures.some((f) => f.contributes);
      const base = couple
        ? contributes
          ? ins.married
          : ins.marriedNone
        : contributes
          ? ins.other
          : ins.otherNone;
      const halves = fam.children.reduce((s, c) => s + c.insuranceHalves, 0);
      const shared = fam.children.some((c) => c.insuranceHalves === 1);
      if (shared) tr.src(sharedCustody().source);
      const forChildren = (halves * ins.perChild) / 2;
      const cap = base + forChildren;
      const ded = Math.min(paid, cap);
      notes.limit('insurance', A.insurance, '230', 'household', paid, cap, ded);
      if (ded > 0) {
        const who = couple
          ? t('married couple', 'couple marié')
          : t('single taxpayer', 'personne seule');
        const pillars = contributes
          ? t('with contributions to the 2nd pillar or 3a', 'avec cotisations au 2e pilier ou 3a')
          : t(
              'without contributions to the 2nd pillar or 3a',
              'sans cotisations au 2e pilier ni 3a',
            );
        const kids = forChildren
          ? t(
              ` plus ${chf(forChildren)} for the children (${chf(ins.perChild)} each${shared ? ', half for a child in shared custody without child support' : ''})`,
              ` plus ${chf(forChildren)} pour les enfants (${chf(ins.perChild)} chacun${shared ? ', la moitié pour un enfant en garde partagée sans contribution d’entretien' : ''})`,
            )
          : t('', '');
        items.push(
          item(
            '230',
            'household',
            tr,
            -ded,
            t(
              `Paid ${chf(paid)}; at most ${chf(base)} (${who.en}, ${pillars.en})${kids.en}: ${chf(ded)}.`,
              `Payé ${chf(paid)}${NB}; au plus ${chf(base)} (${who.fr}, ${pillars.fr})${kids.fr}${NB}: ${chf(ded)}.`,
            ),
          ),
        );
      }
    }
  }

  // Professional training is per person (245/246); the 2026 guide is not out.
  if (y === 2026 && couple && figures.every((f) => f.trained)) {
    notes.add(notes.unverified, NOTE.trainingCouple2026);
  }

  // Political parties (252): at most an amount in total.
  if (hh.politicalParty) {
    const tr = new Trace();
    const paid = total(tr, [hh.politicalParty]);
    const max = tr.p(A.party);
    const ded = Math.min(paid, max);
    notes.limit('party', A.party, '252', 'household', paid, max, ded);
    if (couple && paid > max) notes.add(notes.unverified, NOTE.partyCouple);
    if (ded > 0) {
      items.push(
        item(
          '252',
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

  // Childcare by others (253) or own care (404), per child under 15 who counts here and lives with
  // you: the higher of the two (StG § 33 Abs. 2bis).
  const working = couple
    ? figures.length === 2 && figures.every((f) => f.works)
    : figures.some((f) => f.works);
  let childcareTotal = 0;
  let ownCareCount = 0;
  const careParts: string[] = [];
  const careTr = new Trace().src(childcareRule(y).source, ...fam.sources);
  for (const ch of fam.children) {
    if (!ch.childcare) continue;
    if (!ch.counts || !ch.livesWithYou) {
      notes.add(notes.notCounted, NOTE.childcareOther);
      continue;
    }
    if (!working) notes.add(notes.notCounted, NOTE.childcareWork);
  }
  for (const ch of fam.children) {
    if (!ch.counts || !ch.livesWithYou) continue;
    let care = 0;
    if (ch.childcare && ch.under14 && working) {
      const cap = careTr.p(A.childcare);
      const paid = total(careTr, [ch.childcare]);
      care = Math.min(paid, cap);
      notes.limit('childcare', A.childcare, '253', `child${ch.n}`, paid, cap, care);
    }
    if (ch.under15 && care < A.ownCare.value) {
      if (care > 0) notes.add(notes.assumptions, NOTE.ownCareInstead);
      ownCareCount += 1;
    } else if (care > 0) {
      if (ch.under15) notes.add(notes.assumptions, NOTE.ownCareInstead);
      childcareTotal += care;
      careParts.push(chf(care));
    }
  }
  if (childcareTotal > 0) {
    const cap = A.childcare.value;
    items.push(
      item(
        '253',
        'household',
        careTr,
        -childcareTotal,
        t(
          `Per child under 14 living with you, what was paid, at most ${chf(cap)}: ${careParts.join(' + ')} = ${chf(childcareTotal)}.`,
          `Par enfant de moins de 14 ans vivant avec vous, ce qui a été payé, au plus ${chf(cap)}${NB}: ${careParts.join(' + ')} = ${chf(childcareTotal)}.`,
        ),
      ),
    );
  }
  householdGiven('255', [hh.bankFees], -1);

  // Both spouses work (260): the lower earned income, at most a fixed amount (Verordnung § 15).
  if (couple && figures.length === 2 && figures.every((f) => f.works)) {
    const tr = new Trace().src(twoEarnerRule(y).source).with(...figures.map((f) => f.earnedTr));
    const max = tr.p(A.twoEarner);
    const lower = Math.min(...figures.map((f) => f.earned));
    const ded = twoEarnerDeduction(lower, max);
    if (ded > 0) {
      items.push(
        item(
          '260',
          'household',
          tr,
          -ded,
          t(
            `The lower earned income (salary and allowances less professional costs, pillar 3a and buy-ins: ${chf(lower)}), at most ${chf(max)}: ${chf(ded)}.`,
            `Le revenu d’activité le plus bas (salaire et indemnités moins frais professionnels, pilier 3a et rachats${NB}: ${chf(lower)}), au plus ${chf(max)}${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // Illness costs (295) and donations (296), on the subtotal 287.
  const base287 = Math.max(0, subtotals(items).subtotal);
  const base287Lines = items.filter((i) => !i.code.startsWith('4'));
  if (hh.medicalCosts) {
    const tr = new Trace().src(medicalRule(y).source).from(...base287Lines);
    const costs = total(tr, [hh.medicalCosts]);
    const bp = tr.p(A.medicalThresholdBp);
    const threshold = shareFranc(base287, bp);
    const ded = Math.max(0, costs - threshold);
    notes.limit(
      'medical',
      A.medicalThresholdBp,
      '295',
      'household',
      costs,
      threshold,
      ded,
      'threshold',
    );
    if (ded > 0) {
      items.push(
        item(
          '295',
          'household',
          tr,
          -ded,
          t(
            `${chf(costs)} less ${bp / 100} % of the subtotal 287 (${chf(base287)}), ${chf(threshold)}: ${chf(ded)}.`,
            `${chf(costs)} moins ${bp / 100}${NB}% du sous-total 287 (${chf(base287)}), ${chf(threshold)}${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }
  if (hh.donations) {
    const tr = new Trace().src(donationsRule(y).source).from(...base287Lines);
    const gifts = total(tr, [hh.donations]);
    const d = tr.p(A.donations);
    const cap = shareFranc(base287, d.shareBp);
    const ded = gifts < d.min ? 0 : Math.min(gifts, cap);
    notes.limit('donations', A.donations, '296', 'household', gifts, d.min, ded, 'minimum');
    if (gifts >= d.min) {
      notes.limit('donations', A.donations, '296', 'household', gifts, cap, ded);
    }
    if (ded > 0) {
      items.push(
        item(
          '296',
          'household',
          tr,
          -ded,
          t(
            `${chf(gifts)} given (at least ${chf(d.min)} in the year), at most ${d.shareBp / 100} % of the subtotal 287 (${chf(base287)}), ${chf(cap)}: ${chf(ded)}.`,
            `${chf(gifts)} donnés (au moins ${chf(d.min)} dans l’année), au plus ${d.shareBp / 100}${NB}% du sous-total 287 (${chf(base287)}), ${chf(cap)}${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }
  const net299 = subtotals(items).net;

  // Wealth (600 to 640), then the tax-free amounts (671 to 673).
  const wealthItems: Item[] = [];
  if (movableValue > 0) {
    wealthItems.push(
      wealthItem(
        '600',
        valueTr,
        movableValue,
        t(
          `Tax value on 31 December of the securities and accounts: ${chf(movableValue)}.`,
          `Valeur imposable au 31 décembre des titres et avoirs${NB}: ${chf(movableValue)}.`,
        ),
      ),
    );
  }
  const asset = (code: WealthCode, amounts: readonly (Amount | undefined)[], sign: 1 | -1) => {
    if (!amounts.some(Boolean)) return;
    const tr = new Trace();
    const value = total(tr, amounts);
    if (value > 0) wealthItems.push(wealthItem(code, tr, sign * value, given(value)));
  };
  asset('601', [hh.cash], 1);
  asset('603', [hh.lifeInsuranceValue], 1);
  asset('604', [hh.vehicles], 1);
  asset('606', [hh.otherAssets], 1);
  asset('640', [hh.debts], -1);
  const net660 = wealthTotals(wealthItems).net;
  {
    const tr = new Trace().src(wealthAllowance(y).source, ...fam.sources);
    const free = tr.p(A.wealthFree);
    const amount = couple ? free.married : free.other;
    wealthItems.push(
      wealthItem(
        couple ? '671' : '672',
        tr,
        -amount,
        couple
          ? t(`Married couple: ${chf(amount)}.`, `Couple marié${NB}: ${chf(amount)}.`)
          : t(`Everyone else: ${chf(amount)}.`, `Autres contribuables${NB}: ${chf(amount)}.`),
      ),
    );
    const minors = counted.filter((c) => c.minor).length;
    if (minors) {
      const trc = new Trace().src(wealthAllowance(y).source, ...fam.sources);
      const per = trc.p(A.wealthFree).perChild;
      wealthItems.push(
        wealthItem(
          '673',
          trc,
          -minors * per,
          t(
            `${minors} minor child${minors === 1 ? '' : 'ren'} with a child deduction x ${chf(per)}: ${chf(minors * per)}.`,
            `${minors} enfant${minors === 1 ? '' : 's'} mineur${minors === 1 ? '' : 's'} donnant droit à la déduction pour enfant x ${chf(per)}${NB}: ${chf(minors * per)}.`,
          ),
        ),
      );
    }
  }

  // Social deductions (400 to 407), on the net income 299.
  {
    const tr = new Trace().src(...fam.sources);
    const pd = tr.p(A.personal);
    const amount = fam.large ? pd.large : pd.small;
    items.push(
      item(
        fam.large ? '400' : '402',
        'household',
        tr,
        -amount,
        fam.large
          ? couple
            ? t(`Married couple: ${chf(amount)}.`, `Couple marié${NB}: ${chf(amount)}.`)
            : t(
                `You live with a child who counts for you: ${chf(amount)}.`,
                `Vous vivez avec un enfant qui compte pour vous${NB}: ${chf(amount)}.`,
              )
          : t(`Everyone else: ${chf(amount)}.`, `Autres contribuables${NB}: ${chf(amount)}.`),
      ),
    );
  }
  if (counted.length) {
    const tr = new Trace().src(childRule(y).source, ...fam.sources);
    const cd = tr.p(A.child);
    items.push(
      item(
        '403',
        'household',
        tr,
        -counted.length * cd.base,
        t(
          `${counted.length} child${counted.length === 1 ? '' : 'ren'} x ${chf(cd.base)}: ${chf(counted.length * cd.base)}.`,
          `${counted.length} enfant${counted.length === 1 ? '' : 's'} x ${chf(cd.base)}${NB}: ${chf(counted.length * cd.base)}.`,
        ),
      ),
    );
    const older = counted.filter((c) => !c.under15).length;
    if (older) {
      const tro = new Trace().src(childRule(y).source, ...fam.sources);
      const extra = tro.p(A.child).from15;
      items.push(
        item(
          '403a',
          'household',
          tro,
          -older * extra,
          t(
            `${older} child${older === 1 ? '' : 'ren'} aged 15 or more on 31 December x ${chf(extra)}: ${chf(older * extra)}.`,
            `${older} enfant${older === 1 ? '' : 's'} de 15 ans ou plus au 31 décembre x ${chf(extra)}${NB}: ${chf(older * extra)}.`,
          ),
        ),
      );
    }
  }
  if (ownCareCount) {
    const tr = new Trace().src(ownCareRule(y).source, ...fam.sources);
    const per = tr.p(A.ownCare);
    items.push(
      item(
        '404',
        'household',
        tr,
        -ownCareCount * per,
        t(
          `${ownCareCount} child${ownCareCount === 1 ? '' : 'ren'} under 15 on 31 December, without a higher childcare deduction, x ${chf(per)}: ${chf(ownCareCount * per)}.`,
          `${ownCareCount} enfant${ownCareCount === 1 ? '' : 's'} de moins de 15 ans au 31 décembre, sans déduction plus élevée pour frais de garde, x ${chf(per)}${NB}: ${chf(ownCareCount * per)}.`,
        ),
      ),
    );
  }

  // AHV/IV pensioners (406): by the net income 299 and the net wealth 660.
  const pensioners = figures.filter((f) => f.pensioner);
  if (pensioners.length) {
    const tr = new Trace()
      .src(pensionerRule(y).source, ...fam.sources)
      .from(...items.filter((i) => !i.code.startsWith('4')), ...wealthItems);
    const pr = tr.p(A.pensioner);
    const rows = fam.large ? pr.large : pr.small;
    const per = pensionerAmount(rows, net299);
    if (net660 > pr.maxWealth) notes.add(notes.notCounted, NOTE.pensionerWealth);
    else if (!per) notes.add(notes.notCounted, NOTE.pensionerIncome);
    else {
      const count = pr.perPerson ? pensioners.length : 1;
      const row = rows.find((r) => net299 <= r.upTo)!;
      items.push(
        item(
          '406',
          'household',
          tr,
          -count * per,
          t(
            `${pr.perPerson ? `${count} pensioner${count === 1 ? '' : 's'} x ${chf(per)}` : chf(per)}: net income (299) ${chf(net299)}, at most ${chf(row.upTo)}; net wealth (660) ${chf(net660)}, at most ${chf(pr.maxWealth)}. ${chf(count * per)}.`,
            `${pr.perPerson ? `${count} rentier${count === 1 ? '' : 's'} x ${chf(per)}` : chf(per)}${NB}: revenu net (299) ${chf(net299)}, au plus ${chf(row.upTo)}${NB}; fortune nette (660) ${chf(net660)}, au plus ${chf(pr.maxWealth)}. ${chf(count * per)}.`,
          ),
        ),
      );
    }
  }

  // Renters (407): a share of the net rent, at most a yearly amount.
  if (!input.rent) notes.add(notes.notCounted, NOTE.rentNotGiven);
  else {
    const tr = new Trace().src(rentRule(y).source);
    const rent = total(tr, [input.rent]);
    const r = tr.p(A.rent);
    const ded = rentDeduction(rent, r);
    if (ded > 0) {
      items.push(
        item(
          '407',
          'household',
          tr,
          -ded,
          t(
            `${r.shareBp / 100} % of the net rent ${chf(rent)}, at most ${chf(r.max)}: ${chf(ded)}.`,
            `${r.shareBp / 100}${NB}% du loyer net ${chf(rent)}, au plus ${chf(r.max)}${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  const allLinesSoFar: Line[] = [...items, ...wealthItems];
  if (notes.unsupported.length) return result(allLinesSoFar);

  // In the order of the codes (the sort is stable: person 1 before person 2 on a shared code).
  items.sort((x, z) => x.code.localeCompare(z.code));
  wealthItems.sort((x, z) => x.code.localeCompare(z.code));
  const icc = assess({
    taxYear: y,
    commune: input.commune,
    tariff: fam.large ? 'married' : 'single',
    familySources: fam.sources,
    church: church ?? null,
    citizens: citizens ?? null,
    incomeItems: items,
    wealthItems,
  });

  // The federal tax, the Bund column (./ifd.ts): the same income lines, the federal deductions.
  // Who counts the children follows the federal rules (circular 30): in full, half in shared
  // custody without child support, not for the parent who pays it.
  const sharedAlone = !couple && children.some((ch) => ch.custody === 'shared');
  const support = sharedAlone ? input.childSupport : undefined;
  const childSources =
    support === 'receives'
      ? [`${CIRCULAR30} p. 24 and 33 (ch. 13.4.2, 14.5)`]
      : support === 'pays'
        ? [`${CIRCULAR30} p. 24, 32 and 33 (ch. 13.4.2, 14.5)`]
        : support === 'none' && input.ifdParentalScale !== undefined
          ? [`${CIRCULAR30} p. 19, 24 and 32 (ch. 10.2, 13.4.2, 14.4)`]
          : [];
  const federalChildren: FederalChild[] = [];
  for (const ch of children) {
    const child = {
      livesWithYou: ch.livesWithYou ?? true,
      ...(ch.under14 !== undefined ? { under14: ch.under14 } : {}),
      ...(ch.childcare ? { childcare: ch.childcare } : {}),
    };
    if (couple || ch.custody === 'full' || input.childSupport === 'receives') {
      federalChildren.push({ weight: 1, ...child });
    } else if (input.childSupport === 'none') {
      federalChildren.push({ weight: 0.5, ...child });
    }
  }
  const earning = (id: 'p1' | 'p2') =>
    new Set<string>([
      PERSON_CODES.main[id],
      PERSON_CODES.side[id],
      PERSON_CODES.allowances[id],
      PERSON_CODES.unemployment[id],
    ]);
  const federal = federalReturn(
    {
      input,
      couple,
      incomeItems: items.filter((i) => INCOME.has(i.code)),
      inFull: items.filter((i) => IN_FULL.has(i.code)),
      children: federalChildren,
      childSources,
      wealthIncome: movableIncome,
    },
    people.map((p) => ({
      input: p,
      earnings: items.filter((i) => i.person === p.id && earning(p.id).has(i.code)),
    })),
  );
  const ifd = federal.ifd;
  for (const x of federal.notes.notCounted) notes.add(notes.notCounted, x);
  const lines = allLines({ icc, ifd });
  return {
    ...result(lines),
    unsupported: [...federal.notes.unsupported],
    icc,
    ifd,
    total: ifd ? icc.taxes.total.amount + ifd.tax.amount : null,
    unverifiedRules: [NOTE.rounding, ...notes.unverified, ...federal.notes.unverified],
    limits: bothTaxes(notes.limits, federal.notes.limits),
  };
}

/** ESTV circular 30 on the taxation of spouses and the family: separated parents, the scales. */
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';
/**
 * Deductions in full in both columns: alimony (210), child support (211), buy-ins paid directly
 * (250/251) and the costs of managing securities (255).
 */
const IN_FULL = new Set(['210', '211', '250', '251', '255']);

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
 * Childcare paid for the household as a whole (the invoices of a crèche, say): the limit is per
 * child, and a child under 15 has the deduction for its parents' own care (404) when that is higher
 * (StG § 30 Abs. 1 Bst. l, § 33 Abs. 2bis). It is that child's when one child can have it; with
 * several, any split gives the same when the whole amount is under the own care deduction (every
 * child then has its own care); otherwise how it splits decides the deduction, and the tax is not
 * computed without it (fail closed).
 */
function withHouseholdChildcare(
  input: ZgEngineInput,
  P: ZgYearParams,
  notes: Notes,
): readonly ChildInput[] {
  const children = input.children ?? [];
  const care = input.household?.childcare;
  if (!care) return children;
  if (children.some((ch) => ch.childcare)) {
    throw new ZgInputError('Childcare: give it per child or for the household, not both.');
  }
  const eligible = children
    .map((ch, i) => ({ ch, i }))
    .filter(({ ch }) => (ch.livesWithYou ?? true) && ch.under14 !== false);
  const paid = total(new Trace(), [care]);
  if (eligible.length === 1 || (eligible.length > 1 && paid < P.amounts.ownCare.value)) {
    const at = eligible[0]!.i;
    return children.map((ch, i) => (i === at ? { ...ch, childcare: care } : ch));
  }
  if (eligible.length > 1) notes.add(notes.unsupported, NOTE.childcareSplit);
  else if (paid > 0) notes.add(notes.notCounted, NOTE.childcareNoChild);
  return children;
}

/** Every computed line of a result, for checks and for the explanation tree. */
export function allLines(r: Pick<ZgTaxResult, 'icc'> & { ifd?: ZgTaxResult['ifd'] }): Line[] {
  const f = r.ifd;
  const federal: Line[] = f
    ? [
        ...f.items,
        f.grossIncome,
        f.totalDeductions,
        f.subtotal,
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
    x.totalDeductions,
    x.subtotal,
    x.netIncome,
    x.taxableIncome,
    ...x.wealth.items,
    x.wealth.grossWealth,
    x.wealth.netWealth,
    x.wealth.taxableWealth,
    x.taxes.simpleIncome,
    x.taxes.simpleWealth,
    x.taxes.simple,
    x.taxes.cantonal,
    x.taxes.communal,
    ...(x.taxes.church ? [x.taxes.church] : []),
    ...(x.taxes.citizens ? [x.taxes.citizens] : []),
    x.taxes.total,
    ...federal,
  ];
}

/** For the sources test: the cited rules this module applies. */
export const COMPUTE_RULES = (y: ZgTaxYear) => [
  familySituation(y),
  sharedCustody(),
  childrenIncome(y),
  childRule(y),
  ownCareRule(y),
  childcareRule(y),
  insuranceRule(y),
  medicalRule(y),
  donationsRule(y),
  twoEarnerRule(y),
  pensionerRule(y),
  rentRule(y),
  wealthAllowance(y),
  communeAtYearEnd(y),
  churchRule(y),
  citizensRule(y),
];
