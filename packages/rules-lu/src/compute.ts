// The one entry point: computeReturn(input) gives the lines of the Lucerne return by Ziffer and
// person, the subtotals and the state, communal, (when asked for) church and personal tax, each
// line explained with its sources. First stage here (household figures to the lines of the return,
// every cap, floor and threshold of the Lucerne documents), second stage in ./assess.ts (lines to
// taxes). The same two stages, with the same names, as packages/rules-be/src/compute.ts.
import {
  answered,
  chf,
  pillar3a as federalPillar3a,
  roundFranc,
  Trace,
  type Amount,
} from '@taxpresso/rules-ch';
import { assess, communeOf, communeRef, LuInputError, LuUnsupported } from './assess.js';
import { ESTIMATE_TEXT, NOTE } from './explain.js';
import { familyTariff, sharedChildren } from './law.js';
import { luParamsFor, type LuYearParams } from './params.js';
import {
  FORM_ORDER,
  PERSON_CODES,
  RUBRICS,
  WEALTH_RUBRICS,
  type RubricCode,
  type WealthCode,
} from './rubrics.js';
import {
  assetManagementFlat,
  careDeduction,
  degressiveDeduction,
  donationDeduction,
  drivingCost,
  flatShare,
  insuranceDeduction,
  mealsDeduction,
  medicalDeduction,
  twoEarnerDeduction,
} from './rules.js';
import type {
  ChildInput,
  Confession,
  EmploymentInput,
  Item,
  ItemPerson,
  Line,
  LuEngineInput,
  LuTaxResult,
  PersonInput,
  Text,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';

class Notes {
  readonly assumptions: Text[] = [];
  readonly notCounted: Text[] = [];
  readonly unsupported: Text[] = [];
  readonly unverified: Text[] = [];
  add(list: Text[], text: Text) {
    if (!list.some((x) => x.en === text.en)) list.push(text);
  }
}

/** An item for this line and person; its label and the form's page come from the catalogue. */
function item(
  code: RubricCode | WealthCode,
  person: ItemPerson,
  tr: Trace,
  amount: number,
  how: Text,
): Item {
  const r = code in RUBRICS ? RUBRICS[code as RubricCode] : WEALTH_RUBRICS[code as WealthCode];
  tr.src(r.source);
  return { code, person, ...tr.line(amount, r.label, how) };
}

/** Sum of amounts read into a trace, to the franc (the form takes whole francs). */
function total(tr: Trace, amounts: readonly (Amount | undefined)[]): number {
  return roundFranc(amounts.reduce((s, a) => s + tr.a(a), 0));
}

const given = (value: number) =>
  t(`As given: ${chf(value)}.`, `Tel que donné${NB}: ${chf(value)}.`);

/** The person's own Ziffer of a line the form has per person. */
const own = (codes: readonly [RubricCode, RubricCode], person: 'p1' | 'p2') =>
  codes[person === 'p1' ? 0 : 1];

interface Salary {
  /** Box 11, the net salary: box 8 less boxes 9 and 10, to the franc (Wegleitung p. 21). */
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
  A: LuYearParams['amounts'],
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
  /** Net salaries (main and side) and replacement income: the Erwerbseinkommen (StV § 13). */
  earned: number;
  /** Professional costs, main job and side job. */
  professional: number;
  pillar3a: number;
  /** Buy-ins paid directly (280/282). */
  buyInDirect: number;
  /** Pays into a pension fund or pillar 3a (the insurance deduction, § 40 Abs. 1 lit. g). */
  contributes: boolean;
  /** 248/249, the training deduction. */
  training: number;
}

function personItems(P: LuYearParams, p: PersonInput, items: Item[], notes: Notes): PersonFigures {
  const A = P.amounts;
  const main = (p.employments ?? []).filter((e) => !e.side);
  const side = (p.employments ?? []).filter((e) => e.side);
  const mainSalary = salary(main);
  const sideSalary = salary(side);
  const salaryHow = (net: number) =>
    t(
      `Gross salary less social and pension fund contributions and buy-ins (salary certificate boxes 8 - 9 - 10 = box 11): ${chf(net)}.`,
      `Salaire brut moins cotisations sociales, cotisations et rachats de prévoyance (certificat de salaire, cases 8 - 9 - 10 = case 11)${NB}: ${chf(net)}.`,
    );
  if (main.length) {
    items.push(
      item(
        own(PERSON_CODES.salary, p.id),
        p.id,
        mainSalary.tr,
        mainSalary.net,
        salaryHow(mainSalary.net),
      ),
    );
  }
  if (side.length) {
    items.push(
      item(
        own(PERSON_CODES.side, p.id),
        p.id,
        sideSalary.tr,
        sideSalary.net,
        salaryHow(sideSalary.net),
      ),
    );
  }

  // Pensions and other income of the person.
  const ownIncome = (
    codes: readonly [RubricCode, RubricCode],
    amounts: readonly (Amount | undefined)[],
    note?: Text,
  ) => {
    if (!amounts.some(Boolean)) return { value: 0, tr: new Trace() };
    const tr = new Trace();
    const value = total(tr, amounts);
    if (value <= 0) return { value: 0, tr };
    if (note) notes.add(notes.assumptions, note);
    items.push(item(own(codes, p.id), p.id, tr, value, given(value)));
    return { value, tr };
  };
  ownIncome(PERSON_CODES.avs, [p.pensionAvs]);
  ownIncome(PERSON_CODES.occupational, [p.pensionOccupational], NOTE.pensions100);
  ownIncome(PERSON_CODES.otherPension, [p.pensionOther], NOTE.otherPensions);
  const replacement = ownIncome(PERSON_CODES.replacement, [
    p.replacementIncome,
    p.unemploymentBenefits,
  ]);
  if (p.alimonyReceived) {
    const tr = new Trace();
    const value = total(tr, [p.alimonyReceived]);
    if (value > 0) items.push(item('160', p.id, tr, value, given(value)));
  }

  // Professional costs of the main job (form B: 208t/209t, 212 to 215, 220/221).
  let professional = 0;
  const erwerb = mainSalary.net + replacement.value;
  if (main.length) {
    const trTravel = new Trace().with(mainSalary.tr);
    const tv = travel(A, p, main, trTravel, notes);
    const cap = trTravel.p(A.commuteMax);
    const travelCost = Math.min(tv.cost, cap);
    const travelHow =
      tv.cost > cap
        ? t(`${tv.how.en}, at most ${chf(cap)}`, `${tv.how.fr}, au plus ${chf(cap)}`)
        : tv.how;
    if (travelCost > 0) {
      items.push(
        item(
          own(PERSON_CODES.commute, p.id),
          p.id,
          trTravel,
          -travelCost,
          t(`${travelHow.en}.`, `${travelHow.fr}.`),
        ),
      );
      professional += travelCost;
    }

    if (p.commuteMode?.by === 'home') {
      notes.add(notes.assumptions, NOTE.workFromHome);
    } else if ((p.mealDays ?? 0) > 0) {
      const trMeals = answered(p.mealFacts);
      const canteen = main.some((e) => e.canteen);
      const m = trMeals.p(A.meals);
      const meals = mealsDeduction(p.mealDays ?? 0, canteen, m);
      const [perDay, perYear] = canteen ? [m.halfPerDay, m.halfPerYear] : [m.perDay, m.perYear];
      if (meals > 0) {
        items.push(
          item(
            own(canteen ? PERSON_CODES.mealsReduced : PERSON_CODES.meals, p.id),
            p.id,
            trMeals,
            -meals,
            t(
              `${p.mealDays} days x ${chf(perDay)}${canteen ? ' (half: canteen or meal vouchers, box G)' : ''}, at most ${chf(perYear)} a year: ${chf(meals)}.`,
              `${p.mealDays} jours x ${chf(perDay)}${canteen ? ` (moitié${NB}: cantine ou bons de repas, case G)` : ''}, au plus ${chf(perYear)} par an${NB}: ${chf(meals)}.`,
            ),
          ),
        );
        professional += meals;
      }
    }
  }
  // Other professional costs: 3 % of the net salary (replacement income counts like a salary), at
  // least the minimum, at most the maximum, never more than that income.
  if (erwerb > 0) {
    const trOther = new Trace().with(mainSalary.tr, replacement.tr);
    const flatP = trOther.p(A.professionalFlat);
    const flat = Math.min(flatShare(erwerb, flatP), erwerb);
    let other = flat;
    let otherHow = t(
      `3 % of the net salary${replacement.value ? ' and daily allowances' : ''} ${chf(erwerb)}, at least ${chf(flatP.min)}, at most ${chf(flatP.max)}${flat === erwerb ? ', never more than that income' : ''}: ${chf(flat)}.`,
      `3${NB}% du salaire net${replacement.value ? ' et des indemnités journalières' : ''} ${chf(erwerb)}, au moins ${chf(flatP.min)}, au plus ${chf(flatP.max)}${flat === erwerb ? ', jamais plus que ce revenu' : ''}${NB}: ${chf(flat)}.`,
    );
    if (replacement.value) notes.add(notes.assumptions, NOTE.flatReplacement);
    if (p.otherProfessionalCosts) {
      const actual = total(trOther, [p.otherProfessionalCosts]);
      if (actual > flat) {
        other = actual;
        otherHow = t(`Actual costs: ${chf(actual)}.`, `Frais effectifs${NB}: ${chf(actual)}.`);
        notes.add(notes.assumptions, NOTE.actualCosts);
      }
    }
    notes.add(notes.assumptions, NOTE.partYear);
    items.push(item(own(PERSON_CODES.otherCosts, p.id), p.id, trOther, -other, otherHow));
    professional += other;
  }

  // A side job: 20 % of its net income, between the minimum and the maximum, at most that income.
  if (side.length) {
    const tr = new Trace().with(sideSalary.tr);
    const sp = tr.p(A.sideJobFlat);
    const flat = Math.min(flatShare(sideSalary.net, sp), sideSalary.net);
    if (flat > 0) {
      items.push(
        item(
          own(PERSON_CODES.sideCosts, p.id),
          p.id,
          tr,
          -flat,
          t(
            `20 % of the side job's net income ${chf(sideSalary.net)}, at least ${chf(sp.min)}, at most ${chf(sp.max)}, never more than that income: ${chf(flat)}.`,
            `20${NB}% du revenu net de l’activité accessoire ${chf(sideSalary.net)}, au moins ${chf(sp.min)}, au plus ${chf(sp.max)}, jamais plus que ce revenu${NB}: ${chf(flat)}.`,
          ),
        ),
      );
      professional += flat;
    }
  }

  // Professional training (248/249).
  let training = 0;
  if (p.trainingCosts) {
    const tr = new Trace();
    const paid = total(tr, [p.trainingCosts]);
    const cap = tr.p(A.trainingMax);
    training = Math.min(paid, cap);
    if (training > 0) {
      items.push(
        item(
          own(PERSON_CODES.training, p.id),
          p.id,
          tr,
          -training,
          t(
            `Paid ${chf(paid)}, at most ${chf(cap)}: ${chf(training)}.`,
            `Payé ${chf(paid)}, au plus ${chf(cap)}${NB}: ${chf(training)}.`,
          ),
        ),
      );
    }
  }

  // Pillar 3a (260/261): the federal limits (packages/rules-ch).
  const hasPensionFund =
    p.hasPensionFund ??
    main.some((e) => (e.pensionFund?.value ?? 0) > 0 || (e.pensionBuyIn?.value ?? 0) > 0);
  let pillar3a = 0;
  const r3a = federalPillar3a(
    { pillar3a: A.pillar3a },
    {
      ...(p.pillar3a ? { paid: p.pillar3a } : {}),
      hasFund: hasPensionFund,
      gross: mainSalary.gross + sideSalary.gross,
      social: mainSalary.social + sideSalary.social,
      self: 0,
      earnedFrom: [mainSalary.tr, sideSalary.tr],
    },
  );
  for (const n of r3a.notCounted) notes.add(notes.notCounted, n);
  if (r3a.limits.some((l) => l.given > l.counted)) notes.add(notes.notCounted, NOTE.pillar3aAbove);
  if (r3a.deduction && r3a.deduction.amount < 0) {
    pillar3a = -r3a.deduction.amount;
    items.push(
      item(
        own(PERSON_CODES.pillar3a, p.id),
        p.id,
        r3a.deduction.trace,
        r3a.deduction.amount,
        r3a.deduction.how,
      ),
    );
  }

  // Pension fund buy-ins paid directly (280/282).
  let buyInDirect = 0;
  if (p.pensionBuyIn) {
    const tr = new Trace();
    buyInDirect = total(tr, [p.pensionBuyIn]);
    if (buyInDirect > 0) {
      items.push(item(own(PERSON_CODES.buyIn, p.id), p.id, tr, -buyInDirect, given(buyInDirect)));
    }
  }

  return {
    id: p.id,
    earned: mainSalary.net + sideSalary.net + replacement.value,
    professional,
    pillar3a,
    buyInDirect,
    contributes: hasPensionFund || (p.pillar3a?.value ?? 0) > 0 || buyInDirect > 0,
    training,
  };
}

interface CountedChild {
  index: number;
  weight: 1 | 0.5;
  livesWithYou: boolean;
  child: ChildInput;
}

export function computeReturn(input: LuEngineInput): LuTaxResult {
  const P = luParamsFor(input.taxYear);
  const A = P.amounts;
  const y = input.taxYear;
  const commune = communeOf(y, input.commune);
  const notes = new Notes();
  const couple = input.civilStatus === 'married';
  const people = [...input.people].sort((a, b) => a.id.localeCompare(b.id));
  if (!people.some((p) => p.id === 'p1')) throw new LuInputError('people must include p1');
  if (!couple && people.some((p) => p.id === 'p2')) {
    throw new LuInputError('p2 is the spouse: only for a married couple');
  }
  if (new Set(people.map((p) => p.id)).size !== people.length) {
    throw new LuInputError('each person once');
  }
  const hh = input.household ?? {};
  if (people.some((p) => p.selfEmploymentProfit)) notes.add(notes.unsupported, NOTE.selfEmployed);
  if (people.some((p) => p.pillar3aCatchUp && p.pillar3aCatchUp.value > 0)) {
    notes.add(notes.unsupported, NOTE.catchUp);
  }
  notes.add(notes.notCounted, NOTE.fireLevy);
  notes.add(notes.assumptions, NOTE.personalTax);

  // Children: who counts them (StG § 42 Abs. 2), and the tariff (§ 57 Abs. 2).
  const children = input.children ?? [];
  if (input.church?.children && input.church.children.length > children.length) {
    throw new LuInputError('church.children has more entries than children');
  }
  const counted: CountedChild[] = [];
  const childSources: string[] = [];
  for (const [index, ch] of children.entries()) {
    const base = { index, livesWithYou: ch.livesWithYou ?? true, child: ch };
    if (couple || ch.custody === 'full') {
      counted.push({ weight: 1, ...base });
      continue;
    }
    childSources.push(sharedChildren(y).source);
    if (input.childSupport === 'receives') {
      counted.push({ weight: 1, ...base });
      if (ch.childcare || ch.under14 !== false) notes.add(notes.assumptions, NOTE.receivesShared);
    } else if (input.childSupport === 'none') counted.push({ weight: 0.5, ...base });
    else if (input.childSupport === 'pays') notes.add(notes.assumptions, NOTE.childSupportPaid);
    else notes.add(notes.unsupported, NOTE.childSupport);
  }
  const childWeight = counted.reduce((s, ch) => s + ch.weight, 0);
  let tariff: 'single' | 'family' = 'single';
  const tariffSources: string[] = [];
  if (couple) {
    tariff = 'family';
  } else if (counted.some((ch) => ch.weight === 1 && ch.livesWithYou)) {
    tariff = 'family';
    tariffSources.push(familyTariff(y).source, ...childSources);
  } else if (counted.some((ch) => ch.weight === 0.5 && ch.livesWithYou)) {
    tariffSources.push(familyTariff(y).source, ...childSources);
    if (input.familyTariff === undefined) notes.add(notes.unsupported, NOTE.familyTariff);
    else if (input.familyTariff) tariff = 'family';
  }

  const items: Item[] = [];
  const figures = people.map((p) => personItems(P, p, items, notes));

  // Accounts and securities (Wertschriftenverzeichnis): gross income (WV 4), the costs of keeping
  // them (WV 6) and their value (400); a minor child's too.
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
        'WV4',
        'household',
        incomeTr,
        movableIncome,
        t(
          `Gross income of the accounts and securities: ${chf(movableIncome)}.`,
          `Rendement brut des comptes et titres${NB}: ${chf(movableIncome)}.`,
        ),
      ),
    );
    const tr = new Trace().with(valueTr, incomeTr);
    const am = tr.p(A.assetManagement);
    const flat = assetManagementFlat(am, { value: movableValue, income: movableIncome });
    let costs = flat;
    let how = t(
      `Flat: 0.3 % of the tax value ${chf(movableValue)} up to CHF 3 million, 0.1 % above, at most the income ${chf(movableIncome)}: ${chf(flat)}.`,
      `Forfait${NB}: 0,3${NB}% de la valeur fiscale ${chf(movableValue)} jusqu’à CHF 3 millions, 0,1${NB}% au-delà, au plus le rendement ${chf(movableIncome)}${NB}: ${chf(flat)}.`,
    );
    if (hh.bankFees) {
      const actual = total(tr, [hh.bankFees]);
      if (actual > flat) {
        costs = actual;
        how = t(
          `Actual costs, as given: ${chf(actual)}.`,
          `Frais effectifs, tels que donnés${NB}: ${chf(actual)}.`,
        );
        notes.add(notes.assumptions, NOTE.assetActual);
      }
    }
    if (costs === flat && flat > 0) notes.add(notes.assumptions, NOTE.assetFlat);
    if (costs > 0) items.push(item('WV6', 'household', tr, -costs, how));
  } else if (hh.bankFees) {
    // Costs without income: the flat is at most the income, and actual costs reduce the income.
    const tr = new Trace();
    const actual = total(tr, [hh.bankFees]);
    if (actual > 0) {
      notes.add(notes.assumptions, NOTE.assetActual);
      items.push(item('WV6', 'household', tr, -actual, given(actual)));
    }
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
  householdGiven('161', [hh.childSupportReceived], 1);
  householdGiven('166', [hh.otherIncome], 1);

  // Private debt interest (252): up to the income from wealth plus CHF 50,000.
  if (hh.debtInterest) {
    const tr = new Trace().with(incomeTr);
    const paid = total(tr, [hh.debtInterest]);
    const extra = tr.p(A.debtInterestExtra);
    const cap = movableIncome + extra;
    const ded = Math.min(paid, cap);
    if (ded > 0) {
      items.push(
        item(
          '252',
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
  householdGiven('254', [hh.alimonyPaid], -1);
  householdGiven('255', [hh.childSupportPaid], -1);

  // Insurance premiums and savings interest (270; form V).
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
    if (counted.some((ch) => ch.weight === 0.5)) tr.src(sharedChildren(y).source);
    const kids = childWeight
      ? ` + ${String(childWeight)} x ${chf(A.insurance.value.perChild)} for children`
      : '';
    const kidsFr = childWeight
      ? ` + ${String(childWeight).replace('.', ',')} x ${chf(A.insurance.value.perChild)} pour les enfants`
      : '';
    if (ins.deduction > 0) {
      const base = ins.cap - Math.round(A.insurance.value.perChild * childWeight);
      items.push(
        item(
          '270',
          'household',
          tr,
          -ins.deduction,
          t(
            `Paid ${chf(paid)}, at most ${chf(base)} (${couple ? 'spouses' : 'single'}, ${contributing ? 'with' : 'without'} pension fund or pillar 3a contributions)${kids} = ${chf(ins.cap)}: ${chf(ins.deduction)}.`,
            `Payé ${chf(paid)}, au plus ${chf(base)} (${couple ? 'époux' : 'personne seule'}, ${contributing ? 'avec' : 'sans'} cotisations à une caisse de pension ou au pilier 3a)${kidsFr} = ${chf(ins.cap)}${NB}: ${chf(ins.deduction)}.`,
          ),
        ),
      );
    }
  }

  // The Nettoeinkommen (310): the base of the medical costs and the donations. The law takes it
  // before professional training (§ 40 Abs. 1 lit. h and i: "um die Aufwendungen nach den §§ 33–40
  // Absatz 1g verminderten steuerbaren Einkünfte"), the form after it (Ziffer 310): when the two
  // give different deductions, they are not computed (NOTE.trainingBase).
  const net310 = items.reduce((s, i) => s + i.amount, 0);
  const trainingTotal = figures.reduce((s, f) => s + f.training, 0);
  const lawBase = net310 + trainingTotal;
  if (hh.medicalCosts) {
    const tr = new Trace();
    const costs = total(tr, [hh.medicalCosts]);
    const rate = tr.p(A.medicalThresholdBp);
    const m = medicalDeduction(costs, net310, rate);
    if (medicalDeduction(costs, lawBase, rate).deduction !== m.deduction) {
      notes.add(notes.unsupported, NOTE.trainingBase);
    } else if (m.deduction > 0) {
      items.push(
        item(
          '320',
          'household',
          tr,
          -m.deduction,
          t(
            `${chf(costs)} less 5 % of the Nettoeinkommen ${chf(net310)} (${chf(m.threshold)}): ${chf(m.deduction)}.`,
            `${chf(costs)} moins 5${NB}% du revenu net ${chf(net310)} (${chf(m.threshold)})${NB}: ${chf(m.deduction)}.`,
          ),
        ),
      );
    } else if (costs > 0) notes.add(notes.notCounted, NOTE.medicalBelow);
  }
  if (hh.donations) {
    const tr = new Trace();
    const gifts = total(tr, [hh.donations]);
    const dp = tr.p(A.donations);
    const d = donationDeduction(gifts, net310, dp.shareBp, dp.min);
    if (donationDeduction(gifts, lawBase, dp.shareBp, dp.min).deduction !== d.deduction) {
      notes.add(notes.unsupported, NOTE.trainingBase);
    } else if (d.deduction > 0) {
      items.push(
        item(
          '324',
          'household',
          tr,
          -d.deduction,
          t(
            `${chf(gifts)}, at most 20 % of the Nettoeinkommen ${chf(net310)} (${chf(d.cap)}): ${chf(d.deduction)}.`,
            `${chf(gifts)}, au plus 20${NB}% du revenu net ${chf(net310)} (${chf(d.cap)})${NB}: ${chf(d.deduction)}.`,
          ),
        ),
      );
    } else if (gifts > 0) notes.add(notes.notCounted, NOTE.donationsMin);
  }

  // Political parties (325): at most CHF 5,600 for the return.
  if (hh.politicalParty) {
    const tr = new Trace();
    const paid = total(tr, [hh.politicalParty]);
    const max = tr.p(A.partyMax);
    const ded = Math.min(paid, max);
    if (ded > 0) {
      items.push(
        item(
          '325',
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

  // Both spouses earn (326; StV § 13): the fixed amount from the lower earned income, at most what
  // is left of it after its professional costs and pension fund and pillar 3a contributions.
  if (couple && figures.length === 2 && figures.every((f) => f.earned > 0)) {
    const tr = new Trace();
    const max = tr.p(A.twoEarner);
    const lower = [...figures].sort((a, b) => a.earned - b.earned)[0]!;
    const left = lower.earned - lower.professional - lower.buyInDirect - lower.pillar3a;
    const ded = twoEarnerDeduction(max, left);
    if (ded > 0) {
      items.push(
        item(
          '326',
          'household',
          tr,
          -ded,
          t(
            `${chf(max)}, at most the lower earned income (${chf(lower.earned)}) less its professional costs and pension contributions (${chf(left)}): ${chf(ded)}.`,
            `${chf(max)}, au plus le plus bas revenu du travail (${chf(lower.earned)}) moins ses frais professionnels et cotisations de prévoyance (${chf(left)})${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // The degressive social deduction (340), on the Reineinkommen (330).
  {
    const net330 = items.reduce((s, i) => s + i.amount, 0);
    const tr = new Trace().from(...items);
    const dp = tr.p(A.degressive);
    const d = degressiveDeduction(dp, { family: tariff === 'family', netIncome: net330 });
    if (d.deduction > 0) {
      tr.src(...tariffSources);
      items.push(
        item(
          '340',
          'household',
          tr,
          -d.deduction,
          t(
            `14 % of (${chf(d.limit)}, the limit of the ${tariff === 'family' ? 'family' : 'single'} tariff, less the Reineinkommen ${chf(net330)} = ${chf(d.difference)}): ${chf(d.deduction)}.`,
            `14${NB}% de (${chf(d.limit)}, la limite du barème ${tariff === 'family' ? 'des familles' : 'des personnes seules'}, moins le Reineinkommen ${chf(net330)} = ${chf(d.difference)})${NB}: ${chf(d.deduction)}.`,
          ),
        ),
      );
    }
  }

  // Child deductions (350, 352).
  const childAmounts = counted.map((ch) => {
    const tr = new Trace().src(...(ch.weight === 0.5 ? [sharedChildren(y).source] : []));
    const c = tr.p(A.child);
    if (ch.child.away) notes.add(notes.assumptions, NOTE.childAway);
    return { ch, tr, amount: Math.round((ch.child.away ? c.away : c.base) * ch.weight) };
  });
  for (const [code, away] of [
    ['350', false],
    ['352', true],
  ] as const) {
    const these = childAmounts.filter((x) => Boolean(x.ch.child.away) === away);
    if (!these.length) continue;
    const tr = new Trace().with(...these.map((x) => x.tr));
    for (const x of these) for (const s of x.tr.sources) tr.src(s);
    const ded = these.reduce((s, x) => s + x.amount, 0);
    const per = away ? A.child.value.away : A.child.value.base;
    const weight = these.reduce((s, x) => s + x.ch.weight, 0);
    items.push(
      item(
        code,
        'household',
        tr,
        -ded,
        t(
          `${chf(per)} per child, half for a child whose deduction the parents share: ${String(weight)} x ${chf(per)} = ${chf(ded)}.`,
          `${chf(per)} par enfant, la moitié pour un enfant dont les parents partagent la déduction${NB}: ${String(weight).replace('.', ',')} x ${chf(per)} = ${chf(ded)}.`,
        ),
      ),
    );
  }

  // Own care (353) and childcare by others (360) of each child under 14 living with you.
  {
    const home = counted.filter((ch) => ch.livesWithYou);
    const careWorking = couple
      ? figures.length === 2 && figures.every((f) => f.earned > 0)
      : figures.some((f) => f.earned > 0);
    const trOwn = new Trace();
    const trThird = new Trace();
    let ownTotal = 0;
    let thirdTotal = 0;
    const ownParts: string[] = [];
    const thirdParts: string[] = [];
    let capReached = false;
    for (const ch of home) {
      const under14 = ch.child.under14 ?? (ch.child.childcare ? true : undefined);
      if (under14 === undefined) {
        notes.add(notes.unsupported, NOTE.under14);
        continue;
      }
      if (!under14) continue;
      const shared = ch.weight === 0.5;
      const limits = shared
        ? trOwn.p(A.sharedCare)
        : { own: trOwn.p(A.ownCare), max: A.childcareMax.value };
      if (shared) notes.add(notes.assumptions, NOTE.sharedCare);
      let paid = 0;
      if (ch.child.childcare) {
        paid = total(trThird, [ch.child.childcare]);
        if (shared) trThird.p(A.sharedCare);
        else trThird.p(A.childcareMax);
      }
      const care = careDeduction(limits, { childcare: paid, childcareAllowed: careWorking });
      ownTotal += care.own;
      ownParts.push(chf(care.own));
      if (paid > 0 && !careWorking) notes.add(notes.notCounted, NOTE.childcareWork);
      if (care.thirdParty > 0) {
        thirdTotal += care.thirdParty;
        thirdParts.push(chf(care.thirdParty));
        if (paid > care.thirdPartyCap) capReached = true;
      }
    }
    if (ownTotal > 0) {
      items.push(
        item(
          '353',
          'household',
          trOwn,
          -ownTotal,
          t(
            `${chf(A.ownCare.value)} per child under 14 living with you (${chf(A.sharedCare.value.own)} for a child living with each parent in turn): ${ownParts.join(' + ')} = ${chf(ownTotal)}.`,
            `${chf(A.ownCare.value)} par enfant de moins de 14 ans vivant avec vous (${chf(A.sharedCare.value.own)} pour un enfant vivant tour à tour chez chaque parent)${NB}: ${ownParts.join(' + ')} = ${chf(ownTotal)}.`,
          ),
        ),
      );
    }
    if (thirdTotal > 0) {
      if (capReached) notes.add(notes.unverified, NOTE.childcareCap);
      const cap = A.childcareMax.value - A.ownCare.value;
      items.push(
        item(
          '360',
          'household',
          trThird,
          -thirdTotal,
          t(
            `Per child under 14, the childcare paid, at most ${chf(cap)} on top of own care (${chf(A.sharedCare.value.max - A.sharedCare.value.own)} for a child living with each parent in turn): ${thirdParts.join(' + ')} = ${chf(thirdTotal)}.`,
            `Par enfant de moins de 14 ans, les frais de garde payés, au plus ${chf(cap)} en plus de la garde par les parents (${chf(A.sharedCare.value.max - A.sharedCare.value.own)} pour un enfant vivant tour à tour chez chaque parent)${NB}: ${thirdParts.join(' + ')} = ${chf(thirdTotal)}.`,
          ),
        ),
      );
    }
  }

  // Wealth (page 4) and the tax-free amounts (472 to 474).
  const wealthItems: Item[] = [];
  if (movableValue > 0) {
    wealthItems.push(
      item(
        '400',
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
  const asset = (code: WealthCode, amounts: readonly (Amount | undefined)[], sign: 1 | -1) => {
    if (!amounts.some(Boolean)) return;
    const tr = new Trace();
    const value = total(tr, amounts);
    if (value > 0) wealthItems.push(item(code, 'household', tr, sign * value, given(value)));
  };
  asset('404', [hh.cash], 1);
  asset('410', [hh.lifeInsuranceValue], 1);
  asset('412', [hh.vehicles], 1);
  asset('416', [hh.otherAssets], 1);
  asset('462', [hh.debts], -1);
  {
    const tr = new Trace();
    const wf = tr.p(A.wealthFree);
    wealthItems.push(
      couple
        ? item(
            '472',
            'household',
            tr,
            -wf.married,
            t(`Spouses: ${chf(wf.married)}.`, `Époux${NB}: ${chf(wf.married)}.`),
          )
        : item('473', 'household', tr, -wf.other, t(`${chf(wf.other)}.`, `${chf(wf.other)}.`)),
    );
    if (counted.length) {
      const trc = new Trace().src(...childSources);
      trc.p(A.wealthFree);
      const ded = Math.round(wf.perChild * childWeight);
      wealthItems.push(
        item(
          '474',
          'household',
          trc,
          -ded,
          t(
            `${chf(wf.perChild)} per child with the child deduction, half for a child whose deduction the parents share: ${String(childWeight)} x ${chf(wf.perChild)} = ${chf(ded)}.`,
            `${chf(wf.perChild)} par enfant donnant droit à la déduction pour enfant, la moitié pour un enfant dont les parents la partagent${NB}: ${String(childWeight).replace('.', ',')} x ${chf(wf.perChild)} = ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // The church tax: each member's confession (§ 240 Abs. 2): the taxpayers and the children counted
  // on the return.
  let church: Confession[] | undefined;
  if (input.church) {
    const c = input.church;
    church = [c.p1 ?? 'none', ...(couple ? [c.p2 ?? 'none'] : [])];
    for (const ch of counted) {
      const confession = c.children?.[ch.index];
      if (confession === undefined) {
        notes.add(notes.unsupported, NOTE.childConfession);
        break;
      }
      church.push(confession);
    }
    const churches = new Set(church.filter((m) => m !== 'none'));
    if (churches.size && (churches.size > 1 || church.includes('none'))) {
      notes.add(notes.unverified, NOTE.churchShares);
    }
  }
  if (
    couple &&
    figures.filter((f) => f.training > 0).length === 2 &&
    trainingTotal > A.trainingMax.value
  ) {
    notes.add(notes.unverified, NOTE.trainingCouple);
  }

  const allLines: Line[] = [...items, ...wealthItems];
  const base = {
    canton: 'LU' as const,
    taxYear: y,
    commune: communeRef(commune),
    ifd: null,
    estimates: allLines.some((l) => l.estimates?.includes('input-estimate'))
      ? [{ id: 'input-estimate', what: ESTIMATE_TEXT['input-estimate'] }]
      : [],
    needsOk: allLines.filter((l) => l.needsOk).length,
    complete: !allLines.some((l) => l.incomplete),
    incomplete: allLines.filter((l) => l.incomplete).map((l) => l.label),
    assumptions: notes.assumptions,
    notCounted: notes.notCounted,
  };
  const unsupported = () => ({
    ...base,
    unsupported: notes.unsupported,
    icc: null,
    total: null,
    unverifiedRules: [],
  });
  if (notes.unsupported.length) return unsupported();

  // In the form's order, person 1 before person 2 (the sort is stable).
  const order: readonly string[] = FORM_ORDER;
  const byForm = (x: Item, z: Item) => order.indexOf(x.code) - order.indexOf(z.code);
  items.sort(byForm);
  wealthItems.sort(byForm);
  try {
    const icc = assess({
      taxYear: y,
      commune: input.commune,
      tariff,
      tariffSources,
      ...(church ? { church } : {}),
      incomeItems: items,
      wealthItems,
    });
    const unverified = [NOTE.rounding, ...notes.unverified];
    if (icc.taxes.incomeCap || icc.taxes.wealthCap) unverified.push(NOTE.capShare);
    return {
      ...base,
      unsupported: [],
      icc,
      total: icc.taxes.total.amount,
      unverifiedRules: unverified,
    };
  } catch (e) {
    if (!(e instanceof LuUnsupported)) throw e;
    notes.add(notes.unsupported, e.note);
    return unsupported();
  }
}

/** Every computed line of a result, for checks and for the explanation tree. */
export function allLines(r: Pick<LuTaxResult, 'icc'>): Line[] {
  if (!r.icc) return [];
  const x = r.icc;
  return [
    ...x.items,
    x.grossIncome,
    x.totalDeductions,
    x.incomeAfterDeductions,
    x.additionalDeductions,
    x.netIncome,
    x.socialDeductions,
    x.taxableIncome,
    ...x.wealth.items,
    x.wealth.grossWealth,
    x.wealth.netWealth,
    x.wealth.taxableWealth,
    x.taxes.incomePerUnit,
    x.taxes.wealthPerUnit,
    x.taxes.perUnit,
    x.taxes.cantonal,
    x.taxes.communal,
    ...(x.taxes.church ? [x.taxes.church] : []),
    ...(x.taxes.incomeCap ? [x.taxes.incomeCap] : []),
    ...(x.taxes.wealthCap ? [x.taxes.wealthCap] : []),
    x.taxes.personal,
    x.taxes.total,
  ];
}
