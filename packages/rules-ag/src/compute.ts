// The one entry point: computeReturn(input) gives the lines of the Aargau return by code and
// person, the totals and the cantonal, communal and (when asked for) church tax, each line explained
// with its sources. First stage here (household figures to the lines of the return, every cap,
// floor, threshold and step of the Aargau documents), second stage in ./assess.ts (lines to taxes).
// The same two stages, with the same names, as packages/rules-be/src/compute.ts.
import {
  answered,
  chf,
  pillar3a as federalPillar3a,
  roundFranc,
  Trace,
  type Amount,
} from '@taxpresso/rules-ch';
import {
  AgInputError,
  AgUnsupported,
  assess,
  communeOf,
  communeRef,
  incomeTotals,
} from './assess.js';
import type { Confession } from './communes.js';
import { ESTIMATE_TEXT, NOTE } from './explain.js';
import { lowIncomeSteps, sharedChildren, tariffRule } from './law.js';
import { agParamsFor, type AgYearParams } from './params.js';
import { RUBRICS, type RubricCode } from './rubrics.js';
import {
  donationDeduction,
  drivingCost,
  flatShare,
  lowIncomeDeduction,
  mealsDeduction,
  medicalDeduction,
  twoEarnerDeduction,
} from './rules.js';
import type {
  AgEngineInput,
  AgTaxResult,
  ChildBand,
  EmploymentInput,
  Item,
  ItemPerson,
  Line,
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

/** An item for this line and person; its label and the guide's page come from the catalogue. */
function item(code: RubricCode, person: ItemPerson, tr: Trace, amount: number, how: Text): Item {
  const r = RUBRICS[code];
  tr.src(r.source);
  return { code, person, ...tr.line(amount, r.label, how) };
}

/** Sum of amounts read into a trace, to the franc (the form takes whole francs, guide p. 9). */
function total(tr: Trace, amounts: readonly (Amount | undefined)[]): number {
  return roundFranc(amounts.reduce((s, a) => s + tr.a(a), 0));
}

const given = (value: number) =>
  t(`As given: ${chf(value)}.`, `Tel que donné${NB}: ${chf(value)}.`);
const dot = (x: Text) => t(`${x.en}.`, `${x.fr}.`);

interface Salary {
  /** Box 11, the net salary: box 8 less boxes 9 and 10, to the franc (guide 1.1: der Nettolohn). */
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
  A: AgYearParams['amounts'],
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
      notes.add(notes.assumptions, NOTE.driving);
      const k = tr.p(A.commuteKm);
      const rate = mode.by === 'car' ? k.car : k.motorbike;
      const { km, cost } = drivingCost(
        mode.kmOneWay,
        mode.days,
        rate,
        mode.by === 'car' ? { carKm: k.carKm, carLess: k.carLess } : undefined,
      );
      const beyond = mode.by === 'car' && km > k.carKm;
      const cents = (c: number) => `CHF 0.${String(c).padStart(2, '0')}`;
      return {
        cost,
        how: t(
          `travel ${chf(cost)} (${mode.kmOneWay} km x 2 x ${mode.days} days = ${km} km${beyond ? `, the first ${k.carKm} at ${cents(rate)}, the rest at ${cents(rate - k.carLess)}` : ` x ${cents(rate)}`})`,
          `déplacement ${chf(cost)} (${mode.kmOneWay} km x 2 x ${mode.days} jours = ${km} km${beyond ? `, les ${k.carKm} premiers à ${cents(rate)}, le reste à ${cents(rate - k.carLess)}` : ` x ${cents(rate)}`})`,
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
  /** Net salaries, main and side: the Erwerbseinkommen. */
  earned: number;
  /** Professional costs, main job and side job. */
  professional: number;
  pillar3a: number;
  /** Box 10.2 buy-ins (already out of the net salary) and buy-ins paid directly. */
  buyInSalary: number;
  buyInDirect: number;
}

function personItems(P: AgYearParams, p: PersonInput, items: Item[], notes: Notes): PersonFigures {
  const A = P.amounts;
  const main = (p.employments ?? []).filter((e) => !e.side);
  const side = (p.employments ?? []).filter((e) => e.side);
  if (side.length && !main.length) {
    throw new AgInputError(`${p.id}: a side job without a main job is a main job.`);
  }
  const mainSalary = salary(main);
  const sideSalary = salary(side);
  const salaryHow = (net: number) =>
    t(
      `Gross salary less social and pension fund contributions and buy-ins (salary certificate boxes 8 - 9 - 10 = box 11): ${chf(net)}.`,
      `Salaire brut moins cotisations sociales, cotisations et rachats de prévoyance (certificat de salaire, cases 8 - 9 - 10 = case 11)${NB}: ${chf(net)}.`,
    );
  if (main.length) {
    items.push(item('1.1', p.id, mainSalary.tr, mainSalary.net, salaryHow(mainSalary.net)));
    notes.add(notes.notCounted, NOTE.unionDues);
  }
  if (side.length) {
    items.push(item('1.2', p.id, sideSalary.tr, sideSalary.net, salaryHow(sideSalary.net)));
  }

  // Professional costs of the main job (10.1, 10.2, 10.3).
  let professional = 0;
  if (main.length) {
    const trTravel = new Trace().with(mainSalary.tr);
    const tv = travel(A, p, main, trTravel, notes);
    const cap = trTravel.p(A.commuteMax);
    const travelCost = Math.min(tv.cost, cap);
    const travelHow =
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
      const [perDay, perYear] = canteen ? [m.halfPerDay, m.halfPerYear] : [m.perDay, m.perYear];
      mealsHow = t(
        `${p.mealDays} days x ${chf(perDay)}${canteen ? ' (half: canteen or meal vouchers, box G)' : ''}, at most ${chf(perYear)} a year: ${chf(meals)}`,
        `${p.mealDays} jours x ${chf(perDay)}${canteen ? ` (moitié${NB}: cantine ou bons de repas, case G)` : ''}, au plus ${chf(perYear)} par an${NB}: ${chf(meals)}`,
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
      if (actual > flat) {
        other = actual;
        otherHow = t(`Actual costs: ${chf(actual)}`, `Frais effectifs${NB}: ${chf(actual)}`);
        notes.add(notes.assumptions, NOTE.actualCosts);
      }
    }
    if (travelCost + meals + other > mainSalary.net) {
      notes.add(notes.unsupported, NOTE.costsAboveSalary);
    }
    if (travelCost > 0) items.push(item('10.1', p.id, trTravel, -travelCost, dot(travelHow)));
    if (meals > 0 && mealsHow) items.push(item('10.2', p.id, trMeals, -meals, dot(mealsHow)));
    if (other > 0) items.push(item('10.3', p.id, trOther, -other, dot(otherHow)));
    professional += travelCost + meals + other;
  }

  // A side job (10.6): 20 % of its income, between the minimum and the maximum, at most its income.
  if (side.length) {
    const tr = new Trace().with(sideSalary.tr);
    const sp = tr.p(A.sideJobFlat);
    const flat = Math.min(flatShare(sideSalary.net, sp), sideSalary.net);
    if (flat > 0) {
      items.push(
        item(
          '10.6',
          p.id,
          tr,
          -flat,
          t(
            `20 % of the side job's income ${chf(sideSalary.net)}, at least ${chf(sp.min)}, at most ${chf(sp.max)}, never more than that income: ${chf(flat)}.`,
            `20${NB}% du revenu de l’activité accessoire ${chf(sideSalary.net)}, au moins ${chf(sp.min)}, au plus ${chf(sp.max)}, jamais plus que ce revenu${NB}: ${chf(flat)}.`,
          ),
        ),
      );
      professional += flat;
    }
  }

  // Pensions and other income of the person (3, 5.1).
  const own = (code: RubricCode, amount: Amount | undefined, note?: Text) => {
    if (!amount) return 0;
    const tr = new Trace();
    const value = total(tr, [amount]);
    if (value <= 0) return 0;
    if (note) notes.add(notes.assumptions, note);
    items.push(item(code, p.id, tr, value, given(value)));
    return value;
  };
  own('3-ahv', p.pensionAvs);
  own('3-bv', p.pensionOccupational, NOTE.pensions);
  own('3-andere', p.pensionOther, NOTE.pensions);
  own('3-alv', p.unemploymentBenefits);
  own('3-taggelder', p.replacementIncome);
  own('5.1', p.alimonyReceived);

  // Pillar 3a (13.2): the federal limits, which StG § 40 Abs. 1 lit. e takes over, and at most the
  // earned income after professional costs (guide p. 26).
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
  if (r3a.limits.some((l) => l.given > l.counted)) notes.add(notes.notCounted, NOTE.pillar3aAbove);
  if (r3a.deduction && r3a.deduction.amount < 0) {
    const left = Math.max(0, mainSalary.net + sideSalary.net - professional);
    let amount = r3a.deduction.amount;
    let how = r3a.deduction.how;
    if (-amount > left) {
      amount = -left;
      notes.add(notes.notCounted, NOTE.pillar3aEarned);
      r3a.deduction.trace.src('ag-2025-guide-wegleitung p. 26 (13.2)');
      how = t(
        `${how.en} At most the earned income after professional costs: ${chf(left)}.`,
        `${how.fr} Au plus le revenu d’activité après frais professionnels${NB}: ${chf(left)}.`,
      );
    }
    if (amount < 0) {
      pillar3a = -amount;
      items.push(item('13.2', p.id, r3a.deduction.trace, amount, how));
    }
  }

  // Pension fund buy-ins paid directly (13.1) and professional training (15.5).
  let buyInDirect = 0;
  if (p.pensionBuyIn) {
    const tr = new Trace();
    buyInDirect = total(tr, [p.pensionBuyIn]);
    if (buyInDirect > 0) items.push(item('13.1', p.id, tr, -buyInDirect, given(buyInDirect)));
  }
  if (p.trainingCosts) {
    const tr = new Trace();
    const paid = total(tr, [p.trainingCosts]);
    const cap = tr.p(A.trainingMax);
    const ded = Math.min(paid, cap);
    if (ded > 0) {
      items.push(
        item(
          '15.5',
          p.id,
          tr,
          -ded,
          t(
            `Paid ${chf(paid)}, at most ${chf(cap)} for each person: ${chf(ded)}.`,
            `Payé ${chf(paid)}, au plus ${chf(cap)} par personne${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  return {
    id: p.id,
    earned: mainSalary.net + sideSalary.net,
    professional,
    pillar3a,
    buyInSalary: mainSalary.buyIn + sideSalary.buyIn,
    buyInDirect,
  };
}

interface CountedChild {
  band: ChildBand;
  livesWithYou: boolean;
}

/** The household's church confession: one, both spouses in the same church, or not supported. */
function householdConfession(input: AgEngineInput, couple: boolean, notes: Notes): Confession {
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
  if (input.children?.length) notes.add(notes.assumptions, NOTE.childrenChurch);
  return [...churches][0]!;
}

const BAND_TEXT: Record<ChildBand, Text> = {
  under14: t('under 14', 'moins de 14 ans'),
  under18: t('14 to 17', '14 à 17 ans'),
  adult: t('of age, in education', 'majeur, en formation'),
};

export function computeReturn(input: AgEngineInput): AgTaxResult {
  const P = agParamsFor(input.taxYear);
  const A = P.amounts;
  const commune = communeOf(input.taxYear, input.commune);
  const notes = new Notes();
  const couple = input.civilStatus === 'married';
  const people = [...input.people].sort((a, b) => a.id.localeCompare(b.id));
  if (!people.some((p) => p.id === 'p1')) throw new AgInputError('people must include p1');
  if (!couple && people.some((p) => p.id === 'p2')) {
    throw new AgInputError('p2 is the spouse: only for a married couple');
  }
  const hh = input.household ?? {};
  if (people.some((p) => p.selfEmploymentProfit)) notes.add(notes.unsupported, NOTE.selfEmployed);
  const confession = input.church ? householdConfession(input, couple, notes) : undefined;
  notes.add(notes.notCounted, NOTE.fireLevy);

  // Children: who counts them (StG § 42 Abs. 1 lit. a; guide 19.1), and the tariff (§ 43 Abs. 2).
  const children = input.children ?? [];
  const shared = children.filter((ch) => ch.custody === 'shared');
  if (couple && shared.length) notes.add(notes.unsupported, NOTE.coupleShared);
  if (!couple && shared.length && !input.childSupport) {
    notes.add(notes.unsupported, NOTE.childSupport);
  }
  const counted: CountedChild[] = [];
  const childSources: string[] = [];
  for (const ch of children) {
    const band = ch.band ?? (ch.under14 ? 'under14' : undefined);
    const livesWithYou = ch.livesWithYou ?? true;
    let counts = couple || ch.custody === 'full';
    if (!couple && ch.custody === 'shared') {
      childSources.push(sharedChildren().source);
      if (input.childSupport === 'receives') counts = true;
      else if (input.childSupport === 'pays') notes.add(notes.assumptions, NOTE.childSupportPaid);
      else if (input.childSupport === 'none') {
        if (input.mainUpkeep === undefined) notes.add(notes.unsupported, NOTE.mainUpkeep);
        else if (input.mainUpkeep) counts = true;
        else notes.add(notes.assumptions, NOTE.notMainUpkeep);
      }
    }
    if (!counts) continue;
    if (!band) {
      notes.add(notes.unsupported, NOTE.childBand);
      continue;
    }
    counted.push({ band, livesWithYou });
  }
  let tariff: 'A' | 'B' = 'A';
  const tariffSources: string[] = [];
  if (couple) tariff = 'B';
  else if (counted.some((ch) => ch.livesWithYou)) {
    tariff = 'B';
    tariffSources.push(tariffRule(input.taxYear).source, ...childSources);
  }

  const items: Item[] = [];
  const figures = people.map((p) => personItems(P, p, items, notes));

  // Accounts and securities (4, 20.1): income and value, a minor child's too.
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
        '4',
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
  householdGiven('5.2', [hh.childSupportReceived], 1);
  householdGiven('5.5', [hh.otherIncome], 1);
  householdGiven('15.4', [hh.bankFees], -1);

  // Private debt interest (11), up to the income from wealth plus CHF 50,000.
  if (hh.debtInterest) {
    const tr = new Trace().with(incomeTr);
    const paid = total(tr, [hh.debtInterest]);
    const extra = tr.p(A.debtInterestExtra);
    const cap = movableIncome + extra;
    const ded = Math.min(paid, cap);
    if (ded > 0) {
      items.push(
        item(
          '11',
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
  householdGiven('12.1', [hh.alimonyPaid], -1);
  householdGiven('12.2', [hh.childSupportPaid], -1);

  // Insurance premiums and savings interest (14): the flat amount, whatever was paid.
  {
    const tr = new Trace();
    const ins = tr.p(A.insurance);
    const ded = couple ? ins.married : ins.other;
    notes.add(notes.assumptions, NOTE.insuranceFlat);
    items.push(
      item(
        '14',
        'household',
        tr,
        -ded,
        t(
          `The flat amount for ${couple ? 'a married couple' : 'other taxpayers'}, whatever was paid: ${chf(ded)}.`,
          `Le forfait ${couple ? 'des couples mariés' : 'des autres contribuables'}, quel que soit le montant payé${NB}: ${chf(ded)}.`,
        ),
      ),
    );
  }

  // Political parties (15.2): at most CHF 10,000 per return.
  if (hh.politicalParty) {
    const tr = new Trace();
    const paid = total(tr, [hh.politicalParty]);
    const max = tr.p(A.partyMax);
    const ded = Math.min(paid, max);
    if (ded > 0) {
      items.push(
        item(
          '15.2',
          'household',
          tr,
          -ded,
          t(
            `Paid ${chf(paid)}, at most ${chf(max)} for the return: ${chf(ded)}.`,
            `Payé ${chf(paid)}, au plus ${chf(max)} par déclaration${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // Childcare (15.0): a child under 14 living with you; both spouses, or the parent, work.
  const withCare = children.filter((ch) => ch.childcare && (ch.livesWithYou ?? true));
  if (withCare.length) {
    const working = couple
      ? figures.length === 2 && figures.every((f) => f.earned > 0)
      : figures.some((f) => f.earned > 0);
    if (!working) {
      notes.add(notes.notCounted, NOTE.childcareWork);
    } else {
      const tr = new Trace();
      const cc = tr.p(A.childcare);
      let ded = 0;
      const parts: string[] = [];
      for (const ch of withCare) {
        const under14 = ch.under14 ?? (ch.band ? ch.band === 'under14' : undefined);
        if (under14 === false) continue;
        if (under14 === undefined) notes.add(notes.assumptions, NOTE.under14);
        const halfShared = !couple && ch.custody === 'shared';
        if (halfShared) notes.add(notes.assumptions, NOTE.sharedChildcare);
        const paid = total(tr, [ch.childcare]);
        const cap = halfShared ? cc.perParentShared : cc.perChild;
        ded += Math.min(paid, cap);
        parts.push(chf(Math.min(paid, cap)));
      }
      if (ded > 0) {
        notes.add(notes.assumptions, NOTE.childcareYear);
        items.push(
          item(
            '15.0',
            'household',
            tr,
            -ded,
            t(
              `Per child under 14, what was paid, at most ${chf(cc.perChild)} (${chf(cc.perParentShared)} for each parent when parents living apart share the child): ${parts.join(' + ')} = ${chf(ded)}.`,
              `Par enfant de moins de 14 ans, ce qui a été payé, au plus ${chf(cc.perChild)} (${chf(cc.perParentShared)} par parent quand des parents vivant séparés partagent l’enfant)${NB}: ${parts.join(' + ')} = ${chf(ded)}.`,
            ),
          ),
        );
      }
    }
  }

  // Both spouses earn (16): CHF 600, at most what the second earner has left.
  if (couple && figures.length === 2 && figures.every((f) => f.earned > 0)) {
    const tr = new Trace();
    const amount = tr.p(A.twoEarner);
    const second = [...figures].sort((a, b) => a.earned - b.earned)[0]!;
    const left = second.earned - second.professional - second.pillar3a - second.buyInDirect;
    const ded = twoEarnerDeduction(left, amount);
    if (ded > 0) {
      items.push(
        item(
          '16',
          'household',
          tr,
          -ded,
          t(
            `${chf(amount)}, at most the second earner’s income after professional costs, pillar 3a and buy-ins (${chf(left)}): ${chf(ded)}.`,
            `${chf(amount)}, au plus le revenu du deuxième revenu après frais professionnels, pilier 3a et rachats (${chf(left)})${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // Medical costs (17.1, 18): above 5 % of the income less §§ 35 to 40, this deduction included.
  if (hh.medicalCosts) {
    const tr = new Trace().from(...items);
    const costs = total(tr, [hh.medicalCosts]);
    const base = items.reduce((s, i) => s + i.amount, 0);
    const bp = tr.p(A.medicalThresholdBp);
    const m = medicalDeduction(costs, base, bp);
    if (costs > 0) {
      notes.add(notes.unverified, NOTE.medicalRounding);
      if (hh.donations) notes.add(notes.unverified, NOTE.medicalOrder);
      if (m.deduction === 0) notes.add(notes.notCounted, NOTE.medicalBelow);
      const trCosts = new Trace();
      total(trCosts, [hh.medicalCosts]);
      items.push(item('17.1', 'household', trCosts, -costs, given(costs)));
      items.push(
        item(
          '18',
          'household',
          tr,
          m.addBack,
          t(
            `Net income after the costs (${chf(base)} - ${chf(costs)} = ${chf(base - costs)}) x 5 : 95 = ${chf(m.selbstbehalt)}${m.addBack < m.selbstbehalt ? `, at most the costs ${chf(costs)}` : ''}: ${chf(m.addBack)} added back, so ${chf(m.deduction)} is deducted.`,
            `Revenu net après les frais (${chf(base)} - ${chf(costs)} = ${chf(base - costs)}) x 5 : 95 = ${chf(m.selbstbehalt)}${m.addBack < m.selbstbehalt ? `, au plus les frais ${chf(costs)}` : ''}${NB}: ${chf(m.addBack)} réintégrés, soit ${chf(m.deduction)} déduits.`,
          ),
        ),
      );
    }
  }

  // Donations (15.3): at least CHF 100, at most 20 % of the income less §§ 35 to 40.
  if (hh.donations) {
    const tr = new Trace().from(...items);
    const gifts = total(tr, [hh.donations]);
    const base = items.reduce((s, i) => s + i.amount, 0);
    const p = tr.p(A.donations);
    const d = donationDeduction(gifts, base, p.shareBp, p.min);
    if (d.deduction > 0) {
      items.push(
        item(
          '15.3',
          'household',
          tr,
          -d.deduction,
          t(
            `${chf(gifts)}, at most 20 % of the income after the other deductions ${chf(base)} (${chf(d.cap)}): ${chf(d.deduction)}.`,
            `${chf(gifts)}, au plus 20${NB}% du revenu après les autres déductions ${chf(base)} (${chf(d.cap)})${NB}: ${chf(d.deduction)}.`,
          ),
        ),
      );
    } else if (gifts > 0 && gifts < p.min) notes.add(notes.notCounted, NOTE.donationsMin);
  }

  // Sozialabzüge (19.1): the child deduction by age band, in full for each child counted.
  if (counted.length) {
    const tr = new Trace().src(...childSources);
    const per = tr.p(A.child);
    const amounts = counted.map((ch) => per[ch.band]);
    const ded = amounts.reduce((s, a) => s + a, 0);
    items.push(
      item(
        '19.1',
        'household',
        tr,
        -ded,
        t(
          `Per child by age at the end of the year: ${counted.map((ch, i) => `${chf(amounts[i]!)} (${BAND_TEXT[ch.band].en})`).join(' + ')} = ${chf(ded)}.`,
          `Par enfant selon l’âge à la fin de l’année${NB}: ${counted.map((ch, i) => `${chf(amounts[i]!)} (${BAND_TEXT[ch.band].fr})`).join(' + ')} = ${chf(ded)}.`,
        ),
      ),
    );
  }

  // Low incomes (24): by the step of the Reineinkommen less the Sozialabzüge.
  let lowIncomeStep: { taxableThere: number; above: number } | undefined;
  {
    const after = items.reduce((s, i) => s + i.amount, 0);
    const tr = new Trace().from(...items);
    const steps = tr.p(A.lowIncome);
    const low = lowIncomeDeduction(after, steps);
    if (low.previous) {
      const francs = Math.floor(after / 100) * 100;
      lowIncomeStep = {
        taxableThere: Math.max(0, low.previous.top - low.previous.deduction),
        above: francs - low.previous.top,
      };
    }
    if (low.deduction > 0) {
      tr.src(lowIncomeSteps().source);
      items.push(
        item(
          '24',
          'household',
          tr,
          -low.deduction,
          t(
            `Net income after the social deductions ${chf(after)}: the step up to ${chf(steps.find(([top]) => Math.floor(after / 100) * 100 <= top)![0])} gives ${chf(low.deduction)}.`,
            `Revenu net après déductions sociales ${chf(after)}${NB}: le palier jusqu’à ${chf(steps.find(([top]) => Math.floor(after / 100) * 100 <= top)![0])} donne ${chf(low.deduction)}.`,
          ),
        ),
      );
    }
  }

  // Wealth (20, 34) and the steuerfreie Beträge (StG § 54).
  const wealthItems: Item[] = [];
  if (movableValue > 0) {
    wealthItems.push(
      item(
        '20.1',
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
  asset('20.2', [hh.cash], 1);
  asset('20.3', [hh.lifeInsuranceValue], 1);
  asset('20.5', [hh.vehicles], 1);
  asset('20.6', [hh.otherAssets], 1);
  asset('34', [hh.debts], -1);
  {
    const tr = new Trace();
    const wf = tr.p(A.wealthFree);
    const own = couple ? wf.married : wf.other;
    wealthItems.push(
      item(
        'steuerfrei',
        'household',
        tr,
        -own,
        t(
          `${couple ? 'Married couple taxed together' : 'Other taxpayers'}: ${chf(own)}.`,
          `${couple ? 'Couple marié imposé ensemble' : 'Autres contribuables'}${NB}: ${chf(own)}.`,
        ),
      ),
    );
    if (counted.length) {
      const trc = new Trace().src(...childSources);
      trc.p(A.wealthFree);
      const ded = wf.perChild * counted.length;
      wealthItems.push(
        item(
          'steuerfrei-kinder',
          'household',
          trc,
          -ded,
          t(
            `${chf(wf.perChild)} for each child with the child deduction: ${counted.length} x ${chf(wf.perChild)} = ${chf(ded)}.`,
            `${chf(wf.perChild)} par enfant donnant droit à la déduction pour enfants${NB}: ${counted.length} x ${chf(wf.perChild)} = ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  const allLines: Line[] = [...items, ...wealthItems];
  const base = {
    canton: 'AG' as const,
    taxYear: input.taxYear,
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
  const order = Object.keys(RUBRICS);
  const byForm = (x: Item, y: Item) => order.indexOf(x.code) - order.indexOf(y.code);
  items.sort(byForm);
  wealthItems.sort(byForm);
  // The base of the maximum burden: the Reineinkommen with the pension fund buy-ins added back.
  const buyIns = figures.reduce((s, f) => s + f.buyInSalary + f.buyInDirect, 0);
  const net = incomeTotals(items).netIncome;
  const maxBurdenBase = buyIns
    ? new Trace()
        .from(net)
        .src('ag-na-law-steuergesetz § 56 Abs. 1 (p. 33)')
        .line(
          net.amount + buyIns,
          t(
            'Net income for the maximum burden (Reineinkommen, § 56)',
            'Revenu net pour la charge maximale (Reineinkommen, § 56)',
          ),
          t(
            `Net income ${chf(net.amount)} plus the pension fund buy-ins deducted ${chf(buyIns)}: ${chf(net.amount + buyIns)}.`,
            `Revenu net ${chf(net.amount)} plus les rachats de prévoyance déduits ${chf(buyIns)}${NB}: ${chf(net.amount + buyIns)}.`,
          ),
        )
    : undefined;
  try {
    const icc = assess({
      taxYear: input.taxYear,
      commune,
      tariff,
      tariffSources,
      ...(input.church
        ? {
            church: {
              confession: confession ?? 'none',
              ...(input.church.parish !== undefined ? { parish: input.church.parish } : {}),
            },
          }
        : {}),
      ...(maxBurdenBase ? { maxBurdenBase } : {}),
      ...(lowIncomeStep ? { lowIncomeStep } : {}),
      incomeItems: items,
      wealthItems,
    });
    const unverified = [NOTE.rounding, ...notes.unverified];
    if (icc.taxes.maxBurden) {
      unverified.push(NOTE.maxBurdenRounding);
      if (icc.taxes.church) notes.add(notes.assumptions, NOTE.maxBurdenChurch);
    }
    return {
      ...base,
      unsupported: [],
      icc,
      total: icc.taxes.total.amount,
      unverifiedRules: unverified,
    };
  } catch (e) {
    if (!(e instanceof AgUnsupported)) throw e;
    notes.add(notes.unsupported, e.note);
    return unsupported();
  }
}

/** Every computed line of a result, for checks and for the explanation tree. */
export function allLines(r: Pick<AgTaxResult, 'icc'>): Line[] {
  if (!r.icc) return [];
  const x = r.icc;
  return [
    ...x.items,
    x.grossIncome,
    x.totalDeductions,
    x.netIncome,
    x.socialDeductions,
    x.afterSocial,
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
    ...(x.taxes.maxBurden ? [x.taxes.maxBurden] : []),
    x.taxes.total,
  ];
}
