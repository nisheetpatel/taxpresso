// The one entry point: computeReturn(input) gives the lines of the Bern return by code and person,
// the totals and the cantonal, communal and (when asked for) church tax, each line explained with
// its sources. First stage here (household figures to the lines of the return, every cap, floor
// and threshold of the Bern documents), second stage in ./assess.ts (lines to taxes). The same two
// stages, with the same names, as packages/rules-zh/src/compute.ts.
import {
  answered,
  chf,
  pillar3a as federalPillar3a,
  roundFranc,
  Trace,
  type Amount,
  type LimitApplied,
} from '@taxpresso/rules-ch';
import { assess, BeInputError, BeUnsupported, communeOf, communeRef } from './assess.js';
import type { Confession } from './communes.js';
import { ESTIMATE_TEXT, NOTE } from './explain.js';
import { sharedChildren, tariffRule } from './law.js';
import { federalReturn, type FederalChild } from './ifd.js';
import { beParamsFor, type BeYearParams } from './params.js';
import { INCOME, RUBRICS, type RubricCode } from './rubrics.js';
import {
  donationDeduction,
  drivingCost,
  flatShare,
  insuranceDeduction,
  mealsDeduction,
  medicalDeduction,
  modestIncomeDeduction,
  twoEarnerDeduction,
} from './rules.js';
import type {
  BeEngineInput,
  BeTaxResult,
  EmploymentInput,
  Item,
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
    p: { source: string },
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
      rule,
    });
  }
}

/** The item with what was declared on the form, when the rule changed it (TaxMe's "Ihre Angaben"). */
const declared = (i: Item, given: number): Item => (given !== i.amount ? { ...i, given } : i);

/** An item for this line and person; its label and the form's page come from the catalogue. */
function item(code: RubricCode, person: ItemPerson, tr: Trace, amount: number, how: Text): Item {
  const r = RUBRICS[code];
  tr.src(r.source);
  return { code, person, ...tr.line(amount, r.label, how) };
}

/** Sum of amounts read into a trace, to the franc (the form takes whole francs). */
function total(tr: Trace, amounts: readonly (Amount | undefined)[]): number {
  return roundFranc(amounts.reduce((s, a) => s + tr.a(a), 0));
}

const given = (value: number) =>
  t(`As given: ${chf(value)}.`, `Tel que donné${NB}: ${chf(value)}.`);

interface Salary {
  /** 2.21: box 11, the net salary: box 8 less boxes 9 and 10, to the franc. */
  net: number;
  gross: number;
  social: number;
  /** Box 10.2: buy-ins taken from the salary. */
  buyIn: number;
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
  return {
    net: roundFranc(Math.max(0, gross - social - fund - buyIn)),
    gross,
    social,
    buyIn: roundFranc(buyIn),
    tr,
  };
}

/** Travel to work before the cap, and how it was found (no final full stop). */
function travel(
  A: BeYearParams['amounts'],
  p: PersonInput,
  main: readonly EmploymentInput[],
  tr: Trace,
  notes: Notes,
): { cost: number; how: Text } {
  const mode = p.commuteMode;
  if (mode) tr.with(answered(mode.facts, mode.status));
  if (main.length && main.every((e) => e.freeTransport)) {
    notes.add(notes.assumptions, NOTE.freeTransport);
    return { cost: 0, how: t('travel: transport provided', `déplacement${NB}: transport fourni`) };
  }
  if (mode?.by === 'home' || mode?.by === 'walk') {
    return { cost: 0, how: t('travel: none', `déplacement${NB}: aucun`) };
  }
  if (p.commuteCost) {
    const cost = total(tr, [p.commuteCost]);
    return {
      cost,
      how: t(
        `travel ${chf(cost)} (public transport)`,
        `déplacement ${chf(cost)} (transports publics)`,
      ),
    };
  }
  if (mode?.by === 'bike') {
    const cost = tr.p(A.commuteBike);
    notes.add(notes.assumptions, NOTE.partTime);
    return {
      cost,
      how: t(`travel ${chf(cost)} (bike, flat)`, `déplacement ${chf(cost)} (vélo, forfait)`),
    };
  }
  if ((mode?.by === 'car' || mode?.by === 'motorbike') && mode.transitUsable === false) {
    if (mode.kmOneWay && mode.days) {
      if (mode.days > 220) notes.add(notes.assumptions, NOTE.days220);
      const rate = tr.p(A.commuteKm)[mode.by];
      const cost = drivingCost(mode.kmOneWay, mode.days, rate);
      return {
        cost,
        how: t(
          `travel ${chf(cost)} (${mode.kmOneWay} km x 2 x ${mode.days} days x CHF 0.${String(rate).padStart(2, '0')})`,
          `déplacement ${chf(cost)} (${mode.kmOneWay} km x 2 x ${mode.days} jours x CHF 0.${String(rate).padStart(2, '0')})`,
        ),
      };
    }
    notes.add(notes.notCounted, NOTE.drivingDetails);
    return { cost: 0, how: t('travel: not counted', `déplacement${NB}: non compté`) };
  }
  if (mode) {
    notes.add(notes.notCounted, NOTE.transitPrice);
    return { cost: 0, how: t('travel: not counted', `déplacement${NB}: non compté`) };
  }
  return { cost: 0, how: t('travel: nothing given', `déplacement${NB}: rien d’indiqué`) };
}

interface PersonFigures {
  id: 'p1' | 'p2';
  /** Net salaries (main and side) and replacement income: the Erwerbseinkommen. */
  earned: number;
  /** Professional costs, main job and side job. */
  professional: number;
  pillar3a: number;
  /** Box 10.2 buy-ins (already out of the net salary) and buy-ins paid directly. */
  buyInSalary: number;
  buyInDirect: number;
  contributes: boolean;
}

function personItems(P: BeYearParams, p: PersonInput, items: Item[], notes: Notes): PersonFigures {
  const A = P.amounts;
  const main = (p.employments ?? []).filter((e) => !e.side);
  const side = (p.employments ?? []).filter((e) => e.side);
  if (side.length && !main.length) {
    // be-2025-wegleitung-np-de p. 37 (Seite 28): "Ohne Haupterwerb kann kein Nebenerwerb vorliegen."
    throw new BeInputError(`${p.id}: a side job without a main job is a main job.`);
  }
  const mainSalary = salary(main);
  const sideSalary = salary(side);
  const salaryHow = (net: number) =>
    t(
      `Gross salary less social and pension fund contributions and buy-ins (salary certificate boxes 8 - 9 - 10 = box 11): ${chf(net)}.`,
      `Salaire brut moins cotisations sociales, cotisations et rachats de prévoyance (certificat de salaire, cases 8 - 9 - 10 = case 11)${NB}: ${chf(net)}.`,
    );
  if (main.length) {
    items.push(item('2.21-haupt', p.id, mainSalary.tr, mainSalary.net, salaryHow(mainSalary.net)));
  }
  if (side.length) {
    items.push(item('2.21-neben', p.id, sideSalary.tr, sideSalary.net, salaryHow(sideSalary.net)));
  }

  // Professional costs of the main job (form 6.1, 6.2, 6.4), at most the net salary.
  let professional = 0;
  if (main.length) {
    const trTravel = new Trace().with(mainSalary.tr);
    const tv = travel(A, p, main, trTravel, notes);
    const cap = trTravel.p(A.commuteMax);
    let travelCost = Math.min(tv.cost, cap);
    if (tv.cost > 0) {
      notes.limit('commute', A.commuteMax, 'cap', '6.1', p.id, tv.cost, cap, travelCost);
    }
    let travelHow =
      tv.cost > cap
        ? t(`${tv.how.en}, at most ${chf(cap)}`, `${tv.how.fr}, au plus ${chf(cap)}`)
        : tv.how;

    const trMeals = new Trace();
    let meals = 0;
    let mealsHow: Text | undefined;
    if (p.commuteMode?.by === 'home') {
      notes.add(notes.assumptions, NOTE.workFromHome);
    } else if ((p.mealDays ?? 0) > 0) {
      trMeals.with(answered(p.mealFacts));
      const canteen = main.some((e) => e.canteen);
      const m = trMeals.p(A.meals);
      meals = mealsDeduction(p.mealDays ?? 0, canteen, m);
      const [day, year] = canteen ? [m.halfPerDay, m.halfPerYear] : [m.perDay, m.perYear];
      notes.limit('meals', A.meals, 'cap', '6.2', p.id, (p.mealDays ?? 0) * day, year, meals);
      const [perDay, perYear] = canteen ? [m.halfPerDay, m.halfPerYear] : [m.perDay, m.perYear];
      mealsHow = t(
        `${p.mealDays} days x ${chf(perDay)}${canteen ? ' (half: canteen or meal vouchers, box G)' : ''}, at most ${chf(perYear)} a year: ${chf(meals)}`,
        `${p.mealDays} jours x ${chf(perDay)}${canteen ? ' (moitié${NB}: cantine ou bons de repas, case G)' : ''}, au plus ${chf(perYear)} par an${NB}: ${chf(meals)}`,
      );
    }

    const trOther = new Trace().with(mainSalary.tr);
    const flatP = trOther.p(A.professionalFlat);
    const flat = flatShare(mainSalary.net, flatP);
    let other = flat;
    let otherHow = t(
      `3 % of the net salary ${chf(mainSalary.net)}, at least ${chf(flatP.min)}, at most ${chf(flatP.max)}: ${chf(flat)}`,
      `3${NB}% du salaire net ${chf(mainSalary.net)}, au moins ${chf(flatP.min)}, au plus ${chf(flatP.max)}${NB}: ${chf(flat)}`,
    );
    if (p.otherProfessionalCosts) {
      const actual = total(trOther, [p.otherProfessionalCosts]);
      notes.limit(
        'professional.other',
        A.professionalFlat,
        'choice',
        '6.4',
        p.id,
        actual,
        flat,
        Math.max(actual, flat),
      );
      if (actual > flat) {
        other = actual;
        otherHow = t(`Actual costs: ${chf(actual)}`, `Frais effectifs${NB}: ${chf(actual)}`);
        notes.add(notes.assumptions, NOTE.actualCosts);
      }
    }
    if (other === flatP.min) notes.add(notes.assumptions, NOTE.partTime);

    // At most the net salary (be-2025-wegleitung-np-de p. 184): the other costs cut first.
    let over = travelCost + meals + other - mainSalary.net;
    if (over > 0) {
      notes.add(notes.assumptions, NOTE.costCap);
      const cutOther = Math.min(over, other);
      other -= cutOther;
      over -= cutOther;
      const cutMeals = Math.min(over, meals);
      meals -= cutMeals;
      over -= cutMeals;
      travelCost -= over;
      const capped = t(
        `; professional costs at most the net salary ${chf(mainSalary.net)}`,
        `${NB}; frais professionnels au plus le salaire net ${chf(mainSalary.net)}`,
      );
      otherHow = t(`${otherHow.en}${capped.en}`, `${otherHow.fr}${capped.fr}`);
      if (mealsHow) mealsHow = t(`${mealsHow.en}${capped.en}`, `${mealsHow.fr}${capped.fr}`);
      travelHow = t(`${travelHow.en}${capped.en}`, `${travelHow.fr}${capped.fr}`);
      for (const tr of [trOther, trMeals, trTravel])
        tr.src('be-2025-wegleitung-np-de p. 184 (Seite 175)');
    }
    if (travelCost > 0) {
      items.push(
        declared(
          item('6.1', p.id, trTravel, -travelCost, t(`${travelHow.en}.`, `${travelHow.fr}.`)),
          -tv.cost,
        ),
      );
    }
    if (meals > 0 && mealsHow) {
      items.push(item('6.2', p.id, trMeals, -meals, t(`${mealsHow.en}.`, `${mealsHow.fr}.`)));
    }
    if (other > 0) {
      items.push(item('6.4', p.id, trOther, -other, t(`${otherHow.en}.`, `${otherHow.fr}.`)));
    }
    professional += travelCost + meals + other;
  }

  // A side job: 20 % of its net salary, between the minimum and the maximum, at most its salary.
  if (side.length) {
    const tr = new Trace().with(sideSalary.tr);
    const sp = tr.p(A.sideJobFlat);
    const flat = Math.min(flatShare(sideSalary.net, sp), sideSalary.net);
    if (flat > 0) {
      tr.src('be-2025-wegleitung-np-de p. 196 (Seite 187)');
      items.push(
        item(
          '6.5',
          p.id,
          tr,
          -flat,
          t(
            `20 % of the side job's net salary ${chf(sideSalary.net)}, at least ${chf(sp.min)}, at most ${chf(sp.max)}, never more than that salary: ${chf(flat)}.`,
            `20${NB}% du salaire net de l’activité accessoire ${chf(sideSalary.net)}, au moins ${chf(sp.min)}, au plus ${chf(sp.max)}, jamais plus que ce salaire${NB}: ${chf(flat)}.`,
          ),
        ),
      );
      professional += flat;
    }
  }

  // Pensions and other income of the person.
  const own = (code: RubricCode, amount: Amount | undefined, note?: Text) => {
    if (!amount) return 0;
    const tr = new Trace();
    const value = total(tr, [amount]);
    if (value <= 0) return 0;
    if (note) notes.add(notes.assumptions, note);
    items.push(item(code, p.id, tr, value, given(value)));
    return value;
  };
  own('2.22-ahv', p.pensionAvs);
  own('2.22-bv', p.pensionOccupational, NOTE.pensions100);
  own('2.22-andere', p.pensionOther, NOTE.pensions100);
  const unemployment = own('2.23-alv', p.unemploymentBenefits);
  const replacement = own('2.23-taggelder', p.replacementIncome);
  own('2.24', p.alimonyReceived);

  // Pillar 3a: the federal limits (packages/rules-ch), which StG Art. 38 Abs. 1 lit. e takes over.
  const hasPensionFund =
    p.hasPensionFund ??
    main.some((e) => (e.pensionFund?.value ?? 0) > 0 || (e.pensionBuyIn?.value ?? 0) > 0);
  let pillar3a = 0;
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
    notes.limit('pillar3a', l.param, l.kind, 'saeule-3a', p.id, l.given, l.limit, l.counted);
  }
  if (r3a.limits.some((l) => l.given > l.counted)) notes.add(notes.notCounted, NOTE.pillar3aAbove);
  if (r3a.deduction && r3a.deduction.amount < 0) {
    pillar3a = -r3a.deduction.amount;
    items.push(
      item('saeule-3a', p.id, r3a.deduction.trace, r3a.deduction.amount, r3a.deduction.how),
    );
  }

  // Pension fund buy-ins paid directly and professional training (6.6).
  let buyInDirect = 0;
  if (p.pensionBuyIn) {
    const tr = new Trace();
    buyInDirect = total(tr, [p.pensionBuyIn]);
    if (buyInDirect > 0) items.push(item('einkauf-bv', p.id, tr, -buyInDirect, given(buyInDirect)));
  }
  if (p.trainingCosts) {
    const tr = new Trace();
    const paid = total(tr, [p.trainingCosts]);
    const cap = tr.p(A.trainingMax);
    const ded = Math.min(paid, cap);
    if (paid > 0) notes.limit('training', A.trainingMax, 'cap', '6.6', p.id, paid, cap, ded);
    if (ded > 0) {
      items.push(
        item(
          '6.6',
          p.id,
          tr,
          -ded,
          t(
            `Paid ${chf(paid)}, at most ${chf(cap)}: ${chf(ded)}.`,
            `Payé ${chf(paid)}, au plus ${chf(cap)}${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  return {
    id: p.id,
    earned: mainSalary.net + sideSalary.net + unemployment + replacement,
    professional,
    pillar3a,
    buyInSalary: mainSalary.buyIn + sideSalary.buyIn,
    buyInDirect,
    contributes:
      hasPensionFund || (p.pillar3a?.value ?? 0) > 0 || buyInDirect > 0 || mainSalary.buyIn > 0,
  };
}

interface CountedChild {
  weight: 1 | 0.5;
  livesWithYou: boolean;
  under14?: boolean;
  childcare?: Amount;
  education?: Amount;
}

/** The household's church confession: one, both spouses in the same church, or not supported. */
function householdConfession(input: BeEngineInput, couple: boolean, notes: Notes): Confession {
  const members: Confession[] = [
    input.church?.p1 ?? 'none',
    ...(couple ? [input.church?.p2 ?? 'none'] : []),
  ];
  const churches = new Set(members.filter((m) => m !== 'none'));
  if (!churches.size) return 'none';
  if (churches.size > 1 || (couple && members.includes('none'))) {
    notes.add(notes.unsupported, NOTE.churchMixed);
    return 'none';
  }
  return [...churches][0]!;
}

export function computeReturn(input: BeEngineInput): BeTaxResult {
  const P = beParamsFor(input.taxYear);
  const A = P.amounts;
  const commune = communeOf(input.taxYear, input.commune);
  const notes = new Notes();
  const couple = input.civilStatus === 'married';
  const people = [...input.people].sort((a, b) => a.id.localeCompare(b.id));
  if (!people.some((p) => p.id === 'p1')) throw new BeInputError('people must include p1');
  if (!couple && people.some((p) => p.id === 'p2')) {
    throw new BeInputError('p2 is the spouse: only for a married couple');
  }
  const hh = input.household ?? {};
  if (hh.politicalParty && people.some((p) => p.politicalParty)) {
    throw new BeInputError(
      'Political party payments: give them per person or for the household, not both.',
    );
  }
  if (people.some((p) => p.selfEmploymentProfit)) notes.add(notes.unsupported, NOTE.selfEmployed);
  if (!couple && input.ownHousehold === undefined) notes.add(notes.unsupported, NOTE.ownHousehold);
  const confession = input.church ? householdConfession(input, couple, notes) : undefined;
  notes.add(notes.notCounted, NOTE.fireLevy);

  // Children: who counts them (StG Art. 40 Abs. 3 lit. a, Abs. 4), and the tariff (Art. 42 Abs. 1).
  const children = input.children ?? [];
  const sharedAlone = !couple && children.some((ch) => ch.custody === 'shared');
  if (sharedAlone && !input.childSupport) notes.add(notes.unsupported, NOTE.childSupport);
  const counted: CountedChild[] = [];
  const childSources: string[] = [];
  for (const ch of children) {
    const base = {
      livesWithYou: ch.livesWithYou ?? true,
      ...(ch.under14 !== undefined ? { under14: ch.under14 } : {}),
      ...(ch.childcare ? { childcare: ch.childcare } : {}),
      ...(ch.education ? { education: ch.education } : {}),
    };
    if (couple || ch.custody === 'full') counted.push({ weight: 1, ...base });
    else {
      childSources.push(sharedChildren(input.taxYear).source);
      if (input.childSupport === 'receives') counted.push({ weight: 1, ...base });
      else if (input.childSupport === 'none') counted.push({ weight: 0.5, ...base });
      else if (input.childSupport === 'pays') notes.add(notes.assumptions, NOTE.childSupportPaid);
    }
  }
  const childWeight = counted.reduce((s, ch) => s + ch.weight, 0);
  let tariff: 'married' | 'other' = 'other';
  const tariffSources: string[] = [];
  if (couple) {
    tariff = 'married';
  } else if (counted.some((ch) => ch.weight === 1 && ch.livesWithYou)) {
    tariff = 'married';
    tariffSources.push(tariffRule(input.taxYear).source, ...childSources);
  } else if (counted.some((ch) => ch.weight === 0.5 && ch.livesWithYou)) {
    tariffSources.push(tariffRule(input.taxYear).source, ...childSources);
    if (input.marriedTariff === undefined) notes.add(notes.unsupported, NOTE.marriedTariff);
    else if (input.marriedTariff) tariff = 'married';
  }

  const items: Item[] = [];
  const figures = people.map((p) => personItems(P, p, items, notes));

  // Accounts and securities (form 3): income (line 31) and value (line 32); a minor child's too.
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
  if (movableIncome > 0) {
    items.push(
      item(
        '3.0-ertrag',
        'household',
        incomeTr,
        movableIncome,
        t(
          `Gross income of the accounts and securities: ${chf(movableIncome)}.`,
          `Rendement brut des comptes et titres${NB}: ${chf(movableIncome)}.`,
        ),
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
  const bankFees = householdGiven('3.0-kosten', [hh.bankFees], -1);
  householdGiven('2.24', [hh.childSupportReceived], 1);
  householdGiven('2.25', [hh.otherIncome], 1);

  // Private debt interest, up to the income from wealth plus CHF 50,000.
  let debtInterestPaid = 0;
  const yieldTr = new Trace().with(incomeTr);
  if (hh.debtInterest) {
    const tr = new Trace().with(incomeTr);
    debtInterestPaid = total(tr, [hh.debtInterest]);
    yieldTr.with(tr);
    const extra = tr.p(A.debtInterestExtra);
    const cap = movableIncome + extra;
    const ded = Math.min(debtInterestPaid, cap);
    notes.limit(
      'debt_interest',
      A.debtInterestExtra,
      'cap',
      '4.3',
      'household',
      debtInterestPaid,
      cap,
      ded,
    );
    if (ded > 0) {
      items.push(
        item(
          '4.3',
          'household',
          tr,
          -ded,
          t(
            `Paid ${chf(debtInterestPaid)}, at most the income from wealth plus ${chf(extra)} (${chf(cap)}): ${chf(ded)}.`,
            `Payé ${chf(debtInterestPaid)}, au plus le rendement de la fortune plus ${chf(extra)} (${chf(cap)})${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }
  householdGiven('5.1', [hh.alimonyPaid, hh.childSupportPaid], -1);

  // Insurance premiums and savings interest (form 4.2).
  {
    const tr = new Trace();
    const premiums = [
      hh.healthPremiums,
      hh.accidentPremiums,
      hh.lifeInsurancePremiums,
      hh.savingsInterest,
    ];
    const paid = Math.max(0, total(tr, premiums) - total(tr, [hh.healthSubsidy]));
    const contributing = figures.some((f) => f.contributes);
    const ins = insuranceDeduction(tr.p(A.insurance), { couple, contributing, childWeight, paid });
    if (!contributing && paid > 0) {
      notes.limit(
        'insurance',
        A.insurance,
        'cap',
        '4.2',
        'household',
        paid,
        ins.cap,
        ins.deduction,
      );
    }
    if (counted.some((ch) => ch.weight === 0.5)) tr.src(sharedChildren(input.taxYear).source);
    if (ins.floorApplied) notes.add(notes.unverified, NOTE.insuranceFloor);
    const kids = childWeight
      ? `, ${String(childWeight)} x ${chf(A.insurance.value.perChild)} for children`
      : '';
    const kidsFr = childWeight
      ? `, ${String(childWeight).replace('.', ',')} x ${chf(A.insurance.value.perChild)} pour les enfants`
      : '';
    items.push(
      declared(
        item(
          '4.2',
          'household',
          tr,
          -ins.deduction,
          contributing
            ? t(
                `With contributions to a pension fund or pillar 3a, the fixed amount whatever was paid (${chf(paid)}): ${couple ? 'spouses' : 'single'}${kids}: ${chf(ins.deduction)}.`,
                `Avec cotisations à une caisse de pension ou au pilier 3a, le montant fixe quel que soit le montant payé (${chf(paid)})${NB}: ${couple ? 'époux' : 'personne seule'}${kidsFr}${NB}: ${chf(ins.deduction)}.`,
              )
            : t(
                `Without pension fund or pillar 3a contributions: paid ${chf(paid)}, at most ${chf(ins.cap)}, at least ${chf(ins.fixed)}${kids}: ${chf(ins.deduction)}.`,
                `Sans cotisations à une caisse de pension ni au pilier 3a${NB}: payé ${chf(paid)}, au plus ${chf(ins.cap)}, au moins ${chf(ins.fixed)}${kidsFr}${NB}: ${chf(ins.deduction)}.`,
              ),
        ),
        -paid,
      ),
    );
  }

  // Political parties (form 4.4): at most CHF 5,300 per person.
  {
    const tr = new Trace();
    const max = tr.p(A.partyMax);
    let paid = 0;
    let ded = 0;
    if (hh.politicalParty) {
      paid = total(tr, [hh.politicalParty]);
      if (couple && paid > max) notes.add(notes.unsupported, NOTE.partySplit);
      ded = Math.min(paid, max);
    } else {
      for (const p of people) {
        const own = total(tr, [p.politicalParty]);
        paid += own;
        ded += Math.min(own, max);
      }
    }
    if (paid > 0) notes.limit('party', A.partyMax, 'cap', '4.4', 'household', paid, max, ded);
    if (ded > 0) {
      items.push(
        item(
          '4.4',
          'household',
          tr,
          -ded,
          t(
            `Paid ${chf(paid)}, at most ${chf(max)} per person: ${chf(ded)}.`,
            `Payé ${chf(paid)}, au plus ${chf(max)} par personne${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // Childcare paid for the household as a whole (the invoices of a crèche, say): form 2.1 asks it
  // per child, and the limit is per child. It is that child's when one child can have it, or when
  // the whole amount is within any child's limit; otherwise how it splits decides the deduction,
  // and it is not computed without it (fail closed).
  if (hh.childcare) {
    if (counted.some((ch) => ch.childcare)) {
      throw new BeInputError('Childcare: give it per child or for the household, not both.');
    }
    const eligible = counted.filter((ch) => ch.livesWithYou && ch.under14 !== false);
    const paid = total(new Trace(), [hh.childcare]);
    const cap = A.childcareMax.value * Math.min(...eligible.map((ch) => ch.weight), 1);
    if (eligible.length === 1 || (eligible.length > 1 && paid <= cap)) {
      eligible[0]!.childcare = hh.childcare;
    } else if (eligible.length > 1) {
      notes.add(notes.unsupported, NOTE.childcareSplit);
    } else if (paid > 0) {
      notes.add(notes.notCounted, NOTE.childcareNoChild);
    }
  }

  // Childcare (form 2.1; StG Art. 38 Abs. 1 lit. l): both spouses, or the parent, must work. Each
  // child's care counts up to the 14th birthday ("das 14. Altersjahr noch nicht vollendet":
  // be-2025-stg-de and be-2026-stg-de p. 28; be-2025-wegleitung-np-de p. 23): the costs given for
  // an older child are left out.
  const withCare = counted.filter((ch) => ch.childcare && ch.livesWithYou);
  if (withCare.some((ch) => ch.under14 === false && (ch.childcare?.value ?? 0) > 0))
    notes.add(notes.notCounted, NOTE.childcareAge);
  if (withCare.length) {
    const working = couple
      ? figures.length === 2 && figures.every((f) => f.earned > 0)
      : figures.some((f) => f.earned > 0);
    if (!working) {
      notes.add(notes.notCounted, NOTE.childcareWork);
    } else {
      const tr = new Trace();
      const max = tr.p(A.childcareMax);
      let ded = 0;
      let paidAll = 0;
      let capAll = 0;
      const parts: string[] = [];
      for (const ch of withCare) {
        if (ch.under14 === false) continue;
        if (ch.under14 === undefined) notes.add(notes.assumptions, NOTE.under14);
        if (ch.weight === 0.5) {
          notes.add(notes.assumptions, NOTE.sharedChildcare);
          tr.src('be-na-deductions-taxinfo-kinderdrittbetreuung (3.2)');
        }
        const paid = total(tr, [ch.childcare]);
        const cap = max * ch.weight;
        paidAll += paid;
        capAll += cap;
        ded += Math.min(paid, cap);
        parts.push(chf(Math.min(paid, cap)));
      }
      if (paidAll > 0) {
        notes.limit(
          'childcare',
          A.childcareMax,
          'cap',
          '2.1-betreuung',
          'household',
          paidAll,
          capAll,
          ded,
        );
      }
      if (ded > 0) {
        items.push(
          item(
            '2.1-betreuung',
            'household',
            tr,
            -ded,
            t(
              `Per child under 14, what was paid, at most ${chf(max)} (half of it for a child living with each parent in turn): ${parts.join(' + ')} = ${chf(ded)}.`,
              `Par enfant de moins de 14 ans, ce qui a été payé, au plus ${chf(max)} (la moitié pour un enfant vivant tour à tour chez chaque parent)${NB}: ${parts.join(' + ')} = ${chf(ded)}.`,
            ),
          ),
        );
      }
    }
  }

  // Both spouses earn (StG Art. 38 Abs. 2 lit. a): 2 % of both earned incomes, at most CHF 9,500,
  // at most the lower earned income less its costs and contributions. The law counts pension fund
  // buy-ins among those contributions (Abs. 1 lit. d), the canton's page leaves them out: when the
  // two readings give different amounts, the deduction is not computed (docs/sources/be/NOTES.md).
  if (couple && figures.length === 2 && figures.every((f) => f.earned > 0)) {
    const tr = new Trace();
    const p2e = tr.p(A.twoEarner);
    const both = figures.reduce((s, f) => s + f.earned, 0);
    const leftLaw = Math.min(
      ...figures.map((f) => f.earned - f.professional - f.pillar3a - f.buyInDirect),
    );
    const leftPage = Math.min(
      ...figures.map((f) => f.earned + f.buyInSalary - f.professional - f.pillar3a),
    );
    const ded = twoEarnerDeduction(both, leftLaw, p2e);
    if (ded !== twoEarnerDeduction(both, leftPage, p2e)) {
      notes.add(notes.unsupported, NOTE.twoEarnerBuyIn);
    } else if (ded > 0) {
      items.push(
        item(
          'zweiverdiener',
          'household',
          tr,
          -ded,
          t(
            `2 % of both earned incomes (${chf(both)}), at most ${chf(p2e.max)}, at most the lower earned income after its professional costs and contributions (${chf(leftLaw)}): ${chf(ded)}.`,
            `2${NB}% des deux revenus du travail (${chf(both)}), au plus ${chf(p2e.max)}, au plus le plus bas revenu du travail après ses frais professionnels et cotisations (${chf(leftLaw)})${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // The Reineinkommen: the base of the donations and medical costs (Art. 38a).
  const netIncome = items.reduce((s, i) => s + i.amount, 0);
  if (hh.donations) {
    const tr = new Trace();
    const gifts = total(tr, [hh.donations]);
    const d = donationDeduction(gifts, netIncome, tr.p(A.donations));
    notes.limit(
      'donations',
      A.donations,
      'minimum',
      '5.3',
      'household',
      gifts,
      A.donations.value.min,
      d.deduction,
    );
    notes.limit('donations', A.donations, 'cap', '5.3', 'household', gifts, d.cap, d.deduction);
    if (d.deduction > 0) {
      items.push(
        item(
          '5.3',
          'household',
          tr,
          -d.deduction,
          t(
            `${chf(gifts)}, at most 20 % of the net income ${chf(netIncome)} (${chf(d.cap)}): ${chf(d.deduction)}.`,
            `${chf(gifts)}, au plus 20${NB}% du revenu net ${chf(netIncome)} (${chf(d.cap)})${NB}: ${chf(d.deduction)}.`,
          ),
        ),
      );
    } else if (gifts > 0) notes.add(notes.notCounted, NOTE.donationsMin);
  }
  if (hh.medicalCosts) {
    const tr = new Trace();
    const costs = total(tr, [hh.medicalCosts]);
    const m = medicalDeduction(costs, netIncome, tr.p(A.medicalThresholdBp));
    notes.limit(
      'medical',
      A.medicalThresholdBp,
      'threshold',
      '5.4',
      'household',
      costs,
      m.threshold,
      m.deduction,
    );
    if (m.deduction > 0) {
      items.push(
        item(
          '5.4',
          'household',
          tr,
          -m.deduction,
          t(
            `${chf(costs)} less 5 % of the net income ${chf(netIncome)} (${chf(m.threshold)}): ${chf(m.deduction)}.`,
            `${chf(costs)} moins 5${NB}% du revenu net ${chf(netIncome)} (${chf(m.threshold)})${NB}: ${chf(m.deduction)}.`,
          ),
        ),
      );
    } else if (costs > 0) notes.add(notes.notCounted, NOTE.medicalBelow);
  }

  // Sozialabzüge (Art. 40).
  {
    const tr = new Trace();
    const g = tr.p(A.general);
    const n = couple ? 2 : 1;
    items.push(
      item(
        'allgemein',
        'household',
        tr,
        -g * n,
        t(
          `${chf(g)} for each taxpayer${couple ? ', each spouse' : ''}: ${chf(g * n)}.`,
          `${chf(g)} par contribuable${couple ? ', pour chacun des époux' : ''}${NB}: ${chf(g * n)}.`,
        ),
      ),
    );
  }
  if (!couple && input.ownHousehold) {
    const tr = answered([]);
    const s = tr.p(A.single);
    const kids = counted.filter((ch) => ch.livesWithYou).length;
    if (counted.some((ch) => ch.livesWithYou && ch.weight === 0.5)) {
      tr.src(sharedChildren(input.taxYear).source);
      notes.add(notes.assumptions, NOTE.singleParentFull);
    }
    const ded = s.base + s.perChild * kids;
    items.push(
      item(
        'alleinstehend',
        'household',
        tr,
        -ded,
        t(
          `You keep your own household alone${kids ? ' with your children' : ''}: ${chf(s.base)}${kids ? ` + ${kids} x ${chf(s.perChild)} per child living with you` : ''} = ${chf(ded)}.`,
          `Vous tenez seul votre propre ménage${kids ? ' avec vos enfants' : ''}${NB}: ${chf(s.base)}${kids ? ` + ${kids} x ${chf(s.perChild)} par enfant vivant avec vous` : ''} = ${chf(ded)}.`,
        ),
      ),
    );
  }
  if (counted.length) {
    const tr = new Trace().src(...childSources);
    const per = tr.p(A.child);
    const ded = Math.round(per * childWeight);
    items.push(
      item(
        '2.1-kinder',
        'household',
        tr,
        -ded,
        t(
          `${chf(per)} per child, half for a child whose deduction the parents share: ${String(childWeight)} x ${chf(per)} = ${chf(ded)}.`,
          `${chf(per)} par enfant, la moitié pour un enfant dont les parents partagent la déduction${NB}: ${String(childWeight).replace('.', ',')} x ${chf(per)} = ${chf(ded)}.`,
        ),
      ),
    );
  }
  const withEducation = counted.filter((ch) => ch.education);
  if (withEducation.length) {
    const tr = new Trace();
    const max = tr.p(A.education);
    let ded = 0;
    for (const ch of withEducation) {
      ded += Math.min(total(tr, [ch.education]), Math.round(max * ch.weight));
    }
    if (ded > 0) {
      items.push(
        item(
          '2.1-ausbildung',
          'household',
          tr,
          -ded,
          t(
            `Per child, the costs given, at most ${chf(max)} (half for a half child deduction): ${chf(ded)}.`,
            `Par enfant, les frais indiqués, au plus ${chf(max)} (la moitié pour une demi-déduction)${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // Wealth (forms 3 and 4) and its deductions (Art. 64).
  const wealthItems: Item[] = [];
  if (movableValue > 0) {
    wealthItems.push(
      item(
        '3.0-vermoegen',
        'household',
        valueTr,
        movableValue,
        t(
          `Tax value on 31 December of the accounts and securities: ${chf(movableValue)}.`,
          `Valeur fiscale au 31 décembre des comptes et titres${NB}: ${chf(movableValue)}.`,
        ),
      ),
    );
  }
  const asset = (code: RubricCode, amounts: readonly (Amount | undefined)[], sign: 1 | -1) => {
    if (!amounts.some(Boolean)) return 0;
    const tr = new Trace();
    const value = total(tr, amounts);
    if (value > 0) wealthItems.push(item(code, 'household', tr, sign * value, given(value)));
    return value;
  };
  const otherAssets = asset('4.1', [hh.cash, hh.vehicles, hh.otherAssets], 1);
  const insuranceValue = asset('4.2-wert', [hh.lifeInsuranceValue], 1);
  const debts = asset('4.3-schulden', [hh.debts], -1);
  const reinvermoegen = movableValue + otherAssets + insuranceValue - debts;
  if (couple || counted.length) {
    const tr = new Trace();
    const wd = tr.p(A.wealthDeductions);
    if (couple) {
      wealthItems.push(
        item(
          'vermoegen-verheiratet',
          'household',
          tr,
          -wd.married,
          t(`Spouses: ${chf(wd.married)}.`, `Époux${NB}: ${chf(wd.married)}.`),
        ),
      );
    }
    if (counted.length) {
      const half = counted.filter((ch) => ch.weight === 0.5).length;
      const full = counted.length - half;
      if (half && reinvermoegen > 0 && !input.sharedChildWealth) {
        notes.add(notes.unsupported, NOTE.sharedChildWealth);
      }
      const halfWeight = input.sharedChildWealth === 'half' ? 0.5 : 1;
      const count = full + half * halfWeight;
      const trc = new Trace().src(...childSources);
      trc.p(A.wealthDeductions);
      const ded = Math.round(wd.perChild * count);
      wealthItems.push(
        item(
          'vermoegen-kinder',
          'household',
          trc,
          -ded,
          t(
            `${chf(wd.perChild)} per child with the child deduction${half ? `, for a shared child ${input.sharedChildWealth === 'half' ? 'half' : 'in full'}, as your last assessment shows` : ''}: ${String(count)} x ${chf(wd.perChild)} = ${chf(ded)}.`,
            `${chf(wd.perChild)} par enfant donnant droit à la déduction pour enfant${half ? `, pour un enfant partagé ${input.sharedChildWealth === 'half' ? 'à moitié' : 'en entier'}, comme votre dernière taxation l’indique` : ''}${NB}: ${String(count).replace('.', ',')} x ${chf(wd.perChild)} = ${chf(ded)}.`,
          ),
        ),
      );
    }
  }
  const taxableWealth = Math.max(
    0,
    wealthItems.reduce((s, i) => s + i.amount, 0),
  );

  // Modest incomes (Art. 40 Abs. 6 and 7): on the taxable income without it plus 10 % of the
  // taxable wealth.
  {
    const before = Math.max(
      0,
      items.reduce((s, i) => s + i.amount, 0),
    );
    const tr = new Trace().from(...items, ...wealthItems);
    const mi = tr.p(A.modestIncome);
    const fromWealth = Math.floor((taxableWealth * mi.wealthShareBp) / 1_000_000) * 100;
    const assessable = before + fromWealth;
    const m = modestIncomeDeduction(mi, { couple, childWeight, assessable });
    const ded = Math.min(m.deduction, before);
    if (ded > 0) {
      if (m.stepped) notes.add(notes.unverified, NOTE.modestSteps);
      const own = couple ? mi.married : mi.other;
      items.push(
        item(
          'bescheiden',
          'household',
          tr,
          -ded,
          t(
            `Taxable income without it ${chf(before)} + 10 % of the taxable wealth ${chf(fromWealth)} = ${chf(assessable)}; ${chf(m.full)} up to ${chf(own.limit)}, ${chf(own.cut)} less per full ${chf(mi.step)} above: ${chf(ded)}.`,
            `Revenu imposable sans elle ${chf(before)} + 10${NB}% de la fortune imposable ${chf(fromWealth)} = ${chf(assessable)}${NB}; ${chf(m.full)} jusqu’à ${chf(own.limit)}, ${chf(own.cut)} de moins par tranche entière de ${chf(mi.step)} au-delà${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  const cantonalLines: Line[] = [...items, ...wealthItems];
  const summary = (lines: readonly Line[], needsOk: readonly Line[]) => ({
    estimates: lines.some((l) => l.estimates?.includes('input-estimate'))
      ? [{ id: 'input-estimate', what: ESTIMATE_TEXT['input-estimate'] }]
      : [],
    needsOk: needsOk.filter((l) => l.needsOk).length,
    complete: !lines.some((l) => l.incomplete),
    incomplete: lines
      .filter((l) => l.incomplete)
      .map((l) => l.label)
      .filter((x, i, all) => all.findIndex((y) => y.en === x.en) === i),
  });
  const base = {
    canton: 'BE' as const,
    taxYear: input.taxYear,
    commune: communeRef(commune),
    assumptions: notes.assumptions,
  };
  const unsupported = () => ({
    ...base,
    ...summary(cantonalLines, cantonalLines),
    notCounted: notes.notCounted,
    unsupported: notes.unsupported,
    icc: null,
    ifd: null,
    total: null,
    unverifiedRules: [],
    limits: notes.limits,
  });
  if (notes.unsupported.length) return unsupported();

  // In the form's order, person 1 before person 2 (the sort is stable).
  const order = Object.keys(RUBRICS);
  const byForm = (x: Item, y: Item) => order.indexOf(x.code) - order.indexOf(y.code);
  items.sort(byForm);
  wealthItems.sort(byForm);
  // What was declared on the form where a cap, a minimum or a threshold changed it.
  for (const [n, it] of items.entries()) {
    if (!GIVEN_FROM_LIMIT.has(it.code) || it.given !== undefined) continue;
    const l = notes.limits.find(
      (x) =>
        x.code === it.code && x.person === it.person && x.kind !== 'minimum' && x.kind !== 'choice',
    );
    if (l) items[n] = declared(it, -l.given);
  }
  const yieldAmount = movableIncome - bankFees - debtInterestPaid;
  try {
    const icc = assess({
      taxYear: input.taxYear,
      commune: input.commune,
      tariff,
      tariffSources,
      ...(input.church
        ? {
            church: {
              confession: confession ?? 'none',
              ...(input.church.part !== undefined ? { part: input.church.part } : {}),
            },
          }
        : {}),
      wealthYield: yieldTr.line(
        yieldAmount,
        t('Income from wealth (Vermögensertrag)', 'Rendement de la fortune (Vermögensertrag)'),
        t(
          `Income from accounts and securities ${chf(movableIncome)} less their costs ${chf(bankFees)} and the debt interest ${chf(debtInterestPaid)}: ${chf(yieldAmount)}.`,
          `Rendement des comptes et titres ${chf(movableIncome)} moins leurs frais ${chf(bankFees)} et les intérêts des dettes ${chf(debtInterestPaid)}${NB}: ${chf(yieldAmount)}.`,
        ),
      ),
      incomeItems: items,
      wealthItems,
    });
    const unverified = [NOTE.rounding, ...notes.unverified];
    if (icc.taxes.wealthCap) {
      unverified.push(NOTE.wealthCapRounding);
      if (icc.taxes.church) notes.add(notes.assumptions, NOTE.wealthCapChurch);
    }
    if (
      couple &&
      items.filter((i) => i.code === '6.6').length === 2 &&
      items.filter((i) => i.code === '6.6').reduce((s, i) => s - i.amount, 0) > A.trainingMax.value
    ) {
      unverified.push(NOTE.trainingCouple);
    }

    // The federal tax, TaxMe's federal summary (./ifd.ts): the same income lines, the federal
    // deductions. Who counts the children follows the same child support rule (circular 30).
    const support = sharedAlone ? input.childSupport : undefined;
    const federalChildSources =
      support === 'receives'
        ? [`${CIRCULAR30} p. 24 and 33 (ch. 13.4.2, 14.5)`]
        : support === 'pays'
          ? [`${CIRCULAR30} p. 24, 32 and 33 (ch. 13.4.2, 14.5)`]
          : support === 'none' && input.ifdParentalScale !== undefined
            ? [`${CIRCULAR30} p. 19, 24 and 32 (ch. 10.2, 13.4.2, 14.4)`]
            : [];
    const federal = federalReturn(
      {
        input,
        couple,
        incomeItems: items.filter((i) => INCOME.has(i.code)),
        inFull: items.filter((i) => IN_FULL.has(i.code)),
        children: counted.map((ch): FederalChild => ({
          weight: ch.weight,
          livesWithYou: ch.livesWithYou,
          ...(ch.under14 !== undefined ? { under14: ch.under14 } : {}),
          ...(ch.childcare ? { childcare: ch.childcare } : {}),
        })),
        childSources: federalChildSources,
        wealthIncome: movableIncome,
      },
      people.map((p) => ({
        input: p,
        salaries: items.filter(
          (i) => i.person === p.id && (i.code === '2.21-haupt' || i.code === '2.21-neben'),
        ),
      })),
    );
    const ifd = federal.ifd;
    const fedLines: Line[] = ifd
      ? [
          ...ifd.items,
          ifd.grossIncome,
          ifd.totalDeductions,
          ifd.netIncome,
          ifd.personalDeductions,
          ifd.taxableIncome,
          ifd.scaleIncome,
          ifd.scaleTax,
          ifd.childReduction,
          ifd.tax,
        ]
      : [];
    for (const x of federal.notes.notCounted) notes.add(notes.notCounted, x);
    return {
      ...base,
      ...summary(
        [...allLines({ icc }), ...fedLines],
        [...items, ...(ifd?.items ?? []), ...wealthItems],
      ),
      notCounted: notes.notCounted,
      unsupported: [...federal.notes.unsupported],
      icc,
      ifd,
      total: ifd ? icc.taxes.total.amount + ifd.tax.amount : null,
      unverifiedRules: [...unverified, ...federal.notes.unverified],
      limits: bothTaxes(notes.limits, federal.notes.limits),
    };
  } catch (e) {
    if (!(e instanceof BeUnsupported)) throw e;
    notes.add(notes.unsupported, e.note);
    return unsupported();
  }
}

/** ESTV circular 30 on the taxation of spouses and the family: separated parents, the scales. */
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';
/** Deductions in full in both columns: buy-ins paid directly, alimony and child support paid. */
const IN_FULL = new Set(['einkauf-bv', '5.1']);
/** Lines whose declared amount a cap or a threshold changed: TaxMe's "Ihre Angaben". */
const GIVEN_FROM_LIMIT = new Set(['4.3', '4.4', '2.1-betreuung', '5.3', '5.4', '6.6']);

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

/** Every computed line of a result, for checks and for the explanation tree. */
export function allLines(r: Pick<BeTaxResult, 'icc'> & { ifd?: BeTaxResult['ifd'] }): Line[] {
  const f = r.ifd;
  const federal: Line[] = f
    ? [
        ...f.items,
        f.grossIncome,
        f.totalDeductions,
        f.netIncome,
        f.personalDeductions,
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
    x.netIncome,
    x.personalDeductions,
    x.taxableIncome,
    ...x.wealth.items,
    x.wealth.grossWealth,
    x.wealth.taxableWealth,
    x.taxes.simpleIncome,
    x.taxes.simpleWealth,
    x.taxes.simple,
    x.taxes.cantonal,
    x.taxes.communal,
    ...(x.taxes.church ? [x.taxes.church] : []),
    ...(x.taxes.wealthCap ? [x.taxes.wealthCap] : []),
    x.taxes.total,
    ...federal,
  ];
}
