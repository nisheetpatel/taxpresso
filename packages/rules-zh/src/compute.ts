// The one entry point: computeReturn(input) gives the lines of the Zurich return by code and
// person, the totals and the cantonal and communal tax (Staats- und Gemeindesteuern), each line
// explained with its sources. First stage here (household figures to the lines of the return, every
// cap and threshold of the Zurich documents), second stage in ./assess.ts (lines to taxes). The
// same two stages, with the same names, as packages/rules-ge/src/engine/compute.ts.
import { assess, communeRate, ZhInputError } from './assess.js';
import { chf, roundFranc, Trace } from './calc.js';
import { pick } from './communes.js';
import { ESTIMATE_TEXT, NOTE } from './explain.js';
import { tariffRule } from './law.js';
import { zhParamsFor, type ZhYearParams } from './params.js';
import { FORM_ORDER, INCOME, personCode, RUBRICS, type RubricCode } from './rubrics.js';
import {
  donationDeduction,
  drivingCost,
  flatShare,
  insuranceCap,
  mealsDeduction,
  medicalDeduction,
  pillar3aCap,
  twoEarner,
} from './rules.js';
import type { FederalConcept, LimitApplied } from '@taxpresso/rules-ch';
import { federalReturn, type FederalChild } from './ifd.js';
import type {
  Amount,
  Confession,
  EmploymentInput,
  Item,
  ItemPerson,
  Line,
  PersonInput,
  Text,
  ZhEngineInput,
  ZhTaxResult,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';

class Notes {
  readonly assumptions: Text[] = [];
  readonly notCounted: Text[] = [];
  readonly unsupported: Text[] = [];
  readonly limits: LimitApplied[] = [];
  add(list: Text[], text: Text) {
    if (!list.some((x) => x.en === text.en)) list.push(text);
  }
  /**
   * A cap, threshold, minimum or choice a cantonal rule applied (SPEC.md 10.0), on `code` for
   * `person`, cited by the constant `p` that sets it: `given` before the rule, `counted` after it.
   */
  limit(
    rule: FederalConcept,
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

/** The facts of an answer that is not an amount (a way to work, a count of days). */
function answered(tr: Trace, facts: readonly string[] | undefined, status?: Amount['status']) {
  tr.a({ value: 0, facts: facts ?? [], ...(status ? { status } : {}) });
}

interface Salary {
  /** Line 100/101 or 102/103: box 8 less boxes 9, 10.1 and 10.2, to the franc. */
  net: number;
  /** The 3 % flat's base: box 8 less boxes 9 and 10.1 (Verfügung 631.33 Ziff. I.3). */
  flatBase: number;
  tr: Trace;
}

function salary(employments: readonly EmploymentInput[]): Salary {
  const tr = new Trace();
  let net = 0;
  let flatBase = 0;
  for (const e of employments) {
    const gross = tr.a(e.gross);
    const social = tr.a(e.socialContributions);
    const fund = tr.a(e.pensionFund);
    const buyIn = tr.a(e.pensionBuyIn);
    net += gross - social - fund - buyIn;
    flatBase += gross - social - fund;
  }
  return { net: roundFranc(Math.max(0, net)), flatBase: roundFranc(Math.max(0, flatBase)), tr };
}

/** Travel to work before the cap, and how it was found (no final full stop). */
function travel(
  A: ZhYearParams['amounts'],
  p: PersonInput,
  main: readonly EmploymentInput[],
  tr: Trace,
  notes: Notes,
): { cost: number; how: Text } {
  const mode = p.commuteMode;
  if (mode) answered(tr, mode.facts, mode.status);
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
        `travel ${chf(cost)} (public transport pass)`,
        `déplacement ${chf(cost)} (abonnement)`,
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
      const maxDays = tr.p(A.commuteDays);
      const days = Math.min(mode.days, maxDays);
      if (mode.days > maxDays) notes.add(notes.assumptions, NOTE.days240);
      const rate = tr.p(A.commuteKm)[mode.by];
      const cost = drivingCost(mode.kmOneWay, days, rate);
      return {
        cost,
        how: t(
          `travel ${chf(cost)} (${mode.kmOneWay} km x 2 x ${days} days x CHF 0.${String(rate).padStart(2, '0')})`,
          `déplacement ${chf(cost)} (${mode.kmOneWay} km x 2 x ${days} jours x CHF 0.${String(rate).padStart(2, '0')})`,
        ),
      };
    }
  }
  if ((mode?.by === 'car' || mode?.by === 'motorbike') && mode.transitUsable === false) {
    notes.add(notes.notCounted, NOTE.drivingDetails);
  } else if (mode) notes.add(notes.notCounted, NOTE.transitPrice);
  else return { cost: 0, how: t('travel: nothing given', `déplacement${NB}: rien d’indiqué`) };
  return { cost: 0, how: t('travel: not counted', `déplacement${NB}: non compté`) };
}

interface PersonFigures {
  id: 'p1' | 'p2';
  /** Earned income (Erwerbseinkommen): main and side salaries. */
  earned: number;
  professional: number;
  pillar3a: number;
  buyIn: number;
  hasPensionFund: boolean;
  paysPillar3a: boolean;
}

function personItems(P: ZhYearParams, p: PersonInput, items: Item[], notes: Notes): PersonFigures {
  const A = P.amounts;
  const main = (p.employments ?? []).filter((e) => !e.side);
  const side = (p.employments ?? []).filter((e) => e.side);
  const mainSalary = salary(main);
  const sideSalary = salary(side);
  if (main.length) {
    items.push(
      item(
        personCode('salary', p.id),
        p.id,
        mainSalary.tr,
        mainSalary.net,
        t(
          `Gross salary less social contributions and pension fund contributions and buy-ins (salary certificate boxes 8 - 9 - 10): ${chf(mainSalary.net)}.`,
          `Salaire brut moins cotisations sociales, cotisations et rachats de prévoyance (certificat de salaire, cases 8 - 9 - 10)${NB}: ${chf(mainSalary.net)}.`,
        ),
      ),
    );
  }
  if (side.length) {
    items.push(
      item(
        personCode('side', p.id),
        p.id,
        sideSalary.tr,
        sideSalary.net,
        t(
          `Side job salary, net (boxes 8 - 9 - 10): ${chf(sideSalary.net)}.`,
          `Salaire de l’activité accessoire, net (cases 8 - 9 - 10)${NB}: ${chf(sideSalary.net)}.`,
        ),
      ),
    );
  }

  // Professional costs (Berufsauslagen form): travel, meals, other costs, side jobs.
  let professional = 0;
  if (main.length || side.length) {
    const tr = new Trace();
    const parts: Text[] = [];
    if (main.length) {
      tr.with(mainSalary.tr);
      const tv = travel(A, p, main, tr, notes);
      const cap = tr.p(A.commuteMax);
      const travelCost = Math.min(tv.cost, cap);
      const code = personCode('professional', p.id);
      if (tv.cost > 0)
        notes.limit('commute', A.commuteMax, 'cap', code, p.id, tv.cost, cap, travelCost);
      parts.push(
        tv.cost > cap
          ? t(`${tv.how.en}, at most ${chf(cap)}`, `${tv.how.fr}, au plus ${chf(cap)}`)
          : tv.how,
      );
      let meals = 0;
      if (p.commuteMode?.by === 'home') {
        notes.add(notes.assumptions, NOTE.workFromHome);
      } else if ((p.mealDays ?? 0) > 0) {
        answered(tr, p.mealFacts);
        const canteen = main.some((e) => e.canteen);
        const m = tr.p(A.meals);
        meals = mealsDeduction(p.mealDays ?? 0, canteen, m);
        const [day, year] = canteen ? [m.halfPerDay, m.halfPerYear] : [m.perDay, m.perYear];
        notes.limit('meals', A.meals, 'cap', code, p.id, (p.mealDays ?? 0) * day, year, meals);
        parts.push(
          t(
            `meals ${chf(meals)} (${p.mealDays} days${canteen ? ', canteen' : ''})`,
            `repas ${chf(meals)} (${p.mealDays} jours${canteen ? ', cantine' : ''})`,
          ),
        );
      }
      const flat = flatShare(mainSalary.flatBase, tr.p(A.professionalFlat));
      let other = flat;
      if (p.otherProfessionalCosts) {
        const actual = total(tr, [p.otherProfessionalCosts]);
        notes.limit(
          'professional.other',
          A.professionalFlat,
          'choice',
          code,
          p.id,
          actual,
          flat,
          Math.max(actual, flat),
        );
        if (actual > flat) {
          other = actual;
          notes.add(notes.assumptions, NOTE.actualCosts);
        }
      }
      parts.push(
        other === flat
          ? t(
              `other costs ${chf(flat)} (3 % of ${chf(mainSalary.flatBase)}, between CHF 2’000 and 4’000)`,
              `autres frais ${chf(flat)} (3${NB}% de ${chf(mainSalary.flatBase)}, entre CHF 2’000 et 4’000)`,
            )
          : t(`other costs ${chf(other)} (actual)`, `autres frais ${chf(other)} (effectifs)`),
      );
      professional += travelCost + meals + other;
    }
    if (side.length) {
      tr.with(sideSalary.tr);
      const sideFlat = flatShare(sideSalary.net, tr.p(A.sideJobFlat));
      parts.push(
        t(
          `side job ${chf(sideFlat)} (20 % of ${chf(sideSalary.net)}, between CHF 800 and 2’400)`,
          `activité accessoire ${chf(sideFlat)} (20${NB}% de ${chf(sideSalary.net)}, entre CHF 800 et 2’400)`,
        ),
      );
      professional += sideFlat;
    }
    items.push(
      item(
        personCode('professional', p.id),
        p.id,
        tr,
        -professional,
        t(
          `${parts.map((x) => x.en).join('; ')}. Total: ${chf(professional)}.`,
          `${parts.map((x) => x.fr).join(`${NB}; `)}. Total${NB}: ${chf(professional)}.`,
        ),
      ),
    );
  }

  // Pensions and other income of the person.
  const given = (code: RubricCode, amount: Amount | undefined, note?: Text) => {
    if (!amount) return;
    const tr = new Trace();
    const value = total(tr, [amount]);
    if (value <= 0) return;
    if (note) notes.add(notes.assumptions, note);
    items.push(
      item(
        code,
        p.id,
        tr,
        value,
        t(`As given: ${chf(value)}.`, `Tel que donné${NB}: ${chf(value)}.`),
      ),
    );
  };
  given(personCode('avs', p.id), p.pensionAvs);
  given(personCode('pension', p.id), p.pensionOccupational, NOTE.pensions100);
  given(personCode('pensionOther', p.id), p.pensionOther, NOTE.pensions100);
  given(personCode('unemployment', p.id), p.unemploymentBenefits);
  given(personCode('allowances', p.id), p.replacementIncome);
  given('160', p.alimonyReceived);

  // Pillar 3a.
  const earned = mainSalary.net + sideSalary.net;
  const hasPensionFund = p.hasPensionFund ?? main.some((e) => (e.pensionFund?.value ?? 0) > 0);
  let pillar3a = 0;
  if (p.pillar3a) {
    const tr = new Trace();
    const paid = total(tr, [p.pillar3a]);
    const cap = pillar3aCap(hasPensionFund, earned, tr.p(A.pillar3a));
    pillar3a = Math.min(paid, cap);
    notes.limit(
      'pillar3a',
      A.pillar3a,
      'cap',
      personCode('pillar3a', p.id),
      p.id,
      paid,
      cap,
      pillar3a,
    );
    if (paid > cap) notes.add(notes.notCounted, NOTE.pillar3aAbove);
    if (pillar3a > 0) {
      items.push(
        item(
          personCode('pillar3a', p.id),
          p.id,
          tr,
          -pillar3a,
          t(
            `Paid ${chf(paid)}, at most ${chf(cap)} (${hasPensionFund ? 'with a pension fund' : '20 % of earned income without a pension fund'}): ${chf(pillar3a)}.`,
            `Versé ${chf(paid)}, au plus ${chf(cap)} (${hasPensionFund ? 'avec caisse de pension' : '20 % du revenu du travail sans caisse de pension'})${NB}: ${chf(pillar3a)}.`,
          ),
        ),
      );
    }
  }

  // Pension fund buy-ins paid directly (280) and professional training (292).
  let buyIn = 0;
  if (p.pensionBuyIn) {
    const tr = new Trace();
    buyIn = total(tr, [p.pensionBuyIn]);
    if (buyIn > 0) {
      items.push(
        item(
          '280',
          p.id,
          tr,
          -buyIn,
          t(`As given: ${chf(buyIn)}.`, `Tel que donné${NB}: ${chf(buyIn)}.`),
        ),
      );
    }
  }
  if (p.trainingCosts) {
    const tr = new Trace();
    const paid = total(tr, [p.trainingCosts]);
    const cap = tr.p(A.trainingMax);
    const ded = Math.min(paid, cap);
    notes.limit('training', A.trainingMax, 'cap', '292', p.id, paid, cap, ded);
    if (ded > 0) {
      items.push(
        item(
          '292',
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
    earned,
    professional,
    pillar3a,
    buyIn,
    hasPensionFund,
    paysPillar3a: (p.pillar3a?.value ?? 0) > 0,
  };
}

interface CountedChild {
  weight: 1 | 0.5;
  livesWithYou: boolean;
  under14?: boolean;
  childcare?: Amount;
}

export function computeReturn(input: ZhEngineInput): ZhTaxResult {
  const P = zhParamsFor(input.taxYear);
  const A = P.amounts;
  const notes = new Notes();
  const unverified: Text[] = [
    ...(input.taxYear === 2026 ? [NOTE.cantonalRate2026] : []),
    NOTE.rounding,
  ];
  const couple = input.civilStatus === 'married';
  const people = [...input.people].sort((a, b) => a.id.localeCompare(b.id));
  if (!people.some((p) => p.id === 'p1')) throw new ZhInputError('people must include p1');
  if (!couple && people.some((p) => p.id === 'p2')) {
    throw new ZhInputError('p2 is the spouse: only for a married couple');
  }

  // The commune and its multiplier (fail closed when the part of the commune is unknown).
  const commune = communeRate(input.taxYear, input.commune, input.communeVariant);
  const c = P.communes.value.find((x) => x.bfs === input.commune)!;
  if (!commune.ref) notes.add(notes.unsupported, NOTE.communeVariant);
  const churchMembers: Confession[] = input.church
    ? [input.church.p1 ?? 'none', ...(couple ? [input.church.p2 ?? 'none'] : [])]
    : [];
  for (const m of churchMembers) {
    if (m === 'none') continue;
    const values = m === 'reformed' ? c.reformed : m === 'catholic' ? c.catholic : c.christCatholic;
    if (pick(values, input.church?.parish) === undefined) notes.add(notes.unsupported, NOTE.parish);
  }
  if (people.some((p) => p.selfEmploymentProfit)) notes.add(notes.unsupported, NOTE.selfEmployed);

  // Children: who counts them, and the tariff (StG § 34 Abs. 1 lit. a, § 35 Abs. 2 and 2bis).
  const children = input.children ?? [];
  const sharedAlone = !couple && children.some((ch) => ch.custody === 'shared');
  if (sharedAlone && !input.childSupport) notes.add(notes.unsupported, NOTE.childSupport);
  const counted: CountedChild[] = [];
  for (const ch of children) {
    const livesWithYou = ch.livesWithYou ?? true;
    const base = {
      livesWithYou,
      ...(ch.under14 !== undefined ? { under14: ch.under14 } : {}),
      ...(ch.childcare ? { childcare: ch.childcare } : {}),
    };
    if (couple || ch.custody === 'full' || input.childSupport === 'receives') {
      counted.push({ weight: 1, ...base });
    } else if (input.childSupport === 'none') {
      counted.push({ weight: 0.5, ...base });
    }
  }
  let tariff: 'basic' | 'married' = 'basic';
  const tariffSources: string[] = [];
  if (couple) {
    tariff = 'married';
  } else if (counted.some((ch) => ch.weight === 1 && ch.livesWithYou)) {
    tariff = 'married';
    tariffSources.push(tariffRule(input.taxYear).source);
  } else if (counted.some((ch) => ch.weight === 0.5 && ch.livesWithYou)) {
    tariffSources.push(tariffRule(input.taxYear).source);
    if (input.marriedTariff === undefined) notes.add(notes.unsupported, NOTE.marriedTariff);
    else if (input.marriedTariff) tariff = 'married';
  }

  const items: Item[] = [];
  const figures = people.map((p) => personItems(P, p, items, notes));
  const hh = input.household ?? {};

  // Accounts and securities (Wertschriftenverzeichnis): 150 income, 400 value.
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
        '150',
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
  const householdGiven = (code: RubricCode, amount: Amount | undefined, sign: 1 | -1) => {
    if (!amount) return 0;
    const tr = new Trace();
    const value = total(tr, [amount]);
    if (value <= 0) return 0;
    items.push(
      item(
        code,
        'household',
        tr,
        sign * value,
        t(`As given: ${chf(value)}.`, `Tel que donné${NB}: ${chf(value)}.`),
      ),
    );
    return value;
  };
  householdGiven('161', hh.childSupportReceived, 1);
  householdGiven('163', hh.otherIncome, 1);

  // Private debt interest, up to the income from wealth plus CHF 50,000.
  if (hh.debtInterest) {
    const tr = new Trace();
    const paid = total(tr, [hh.debtInterest]);
    const cap = movableIncome + tr.p(A.debtInterestExtra);
    const ded = Math.min(paid, cap);
    notes.limit('debt_interest', A.debtInterestExtra, 'cap', '250', 'household', paid, cap, ded);
    if (ded > 0) {
      items.push(
        item(
          '250',
          'household',
          tr,
          -ded,
          t(
            `Paid ${chf(paid)}, at most the income from wealth plus CHF 50’000 (${chf(cap)}): ${chf(ded)}.`,
            `Payé ${chf(paid)}, au plus le rendement de la fortune plus CHF 50’000 (${chf(cap)})${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }
  householdGiven('254', hh.alimonyPaid, -1);
  householdGiven('255', hh.childSupportPaid, -1);

  // Insurance premiums and savings interest (Versicherungsprämien form).
  const premiums = [
    hh.healthPremiums,
    hh.accidentPremiums,
    hh.lifeInsurancePremiums,
    hh.savingsInterest,
  ];
  if (premiums.some(Boolean)) {
    const tr = new Trace();
    const paid = Math.max(0, total(tr, premiums) - total(tr, [hh.healthSubsidy]));
    const contributing = figures.some((f) => f.hasPensionFund || f.paysPillar3a);
    const full = counted.filter((ch) => ch.weight === 1).length;
    const half = counted.filter((ch) => ch.weight === 0.5).length;
    const cap = insuranceCap(tr.p(A.insurance), couple, contributing, full, half);
    const ded = Math.min(paid, cap);
    notes.limit('insurance', A.insurance, 'cap', '270', 'household', paid, cap, ded);
    if (ded > 0) {
      items.push(
        item(
          '270',
          'household',
          tr,
          -ded,
          t(
            `Paid ${chf(paid)}; limit ${chf(cap)} (${couple ? 'spouses' : 'single'}${contributing ? '' : ', half as much again without pension fund or 3a'}${full ? `, ${full} child${full > 1 ? 'ren' : ''}` : ''}${half ? `, ${half} half child deduction${half > 1 ? 's' : ''}` : ''}): ${chf(ded)}.`,
            `Payé ${chf(paid)}${NB}; plafond ${chf(cap)} (${couple ? 'époux' : 'personne seule'}${contributing ? '' : ', majoré de moitié sans caisse de pension ni 3a'}${full ? `, ${full} enfant${full > 1 ? 's' : ''}` : ''}${half ? `, ${half} demi-déduction${half > 1 ? 's' : ''} pour enfant` : ''})${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }
  householdGiven('283', hh.bankFees, -1);
  if (hh.politicalParty) {
    const tr = new Trace();
    const paid = total(tr, [hh.politicalParty]);
    const caps = tr.p(A.partyMax);
    const cap = couple ? caps.married : caps.other;
    const ded = Math.min(paid, cap);
    notes.limit('party', A.partyMax, 'cap', '284', 'household', paid, cap, ded);
    if (ded > 0) {
      items.push(
        item(
          '284',
          'household',
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

  // Childcare (StG § 31 Abs. 1 lit. j; Weisung ZStB 34.1): both spouses, or the parent, must work.
  // Given for the household (one amount from the invoices), it is capped for all the children under
  // 14 who live with you together; given per child, per child.
  const household = (hh.childcare?.value ?? 0) > 0;
  const withCare = counted.filter((ch) => (household || ch.childcare) && ch.livesWithYou);
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
      let given = 0;
      let limit = 0;
      const parts: string[] = [];
      if (household) {
        const paid = total(tr, [hh.childcare]);
        const young = withCare.filter((ch) => ch.under14 !== false);
        if (young.some((ch) => ch.under14 === undefined))
          notes.add(notes.assumptions, NOTE.under14);
        limit = young.reduce((s, ch) => s + (ch.weight === 1 ? max : max / 2), 0);
        given = paid;
        ded = Math.min(paid, limit);
        if (young.length) parts.push(`${chf(ded)} (${young.length} x ${chf(max)} at most)`);
      } else {
        for (const ch of withCare) {
          if (ch.under14 === false) continue;
          if (ch.under14 === undefined) notes.add(notes.assumptions, NOTE.under14);
          const paid = total(tr, [ch.childcare]);
          const cap = ch.weight === 1 ? max : max / 2;
          given += paid;
          limit += cap;
          ded += Math.min(paid, cap);
          parts.push(`${chf(Math.min(paid, cap))}`);
        }
      }
      if (given > 0)
        notes.limit('childcare', A.childcareMax, 'cap', '376', 'household', given, limit, ded);
      if (ded > 0) {
        items.push(
          item(
            '376',
            'household',
            tr,
            -ded,
            t(
              `Per child under 14, what was paid, at most ${chf(max)} (half of it when the parents share the deduction): ${parts.join(' + ')} = ${chf(ded)}.`,
              `Par enfant de moins de 14 ans, ce qui a été payé, au plus ${chf(max)} (la moitié si les parents partagent la déduction)${NB}: ${parts.join(' + ')} = ${chf(ded)}.`,
            ),
          ),
        );
      }
    }
  }

  // Both spouses earn (StG § 31 Abs. 2).
  if (couple && figures.length === 2 && figures.every((f) => f.earned > 0)) {
    const tr = new Trace();
    const left = figures.map((f) => f.earned - f.professional - f.pillar3a - f.buyIn);
    const lower = Math.min(...left);
    const max = tr.p(A.twoEarner);
    const ded = twoEarner(lower, max);
    if (ded > 0) {
      items.push(
        item(
          '290',
          'household',
          tr,
          -ded,
          t(
            `The lower earned income after its professional costs, 3a and buy-ins is ${chf(lower)}; the deduction is at most ${chf(max)}: ${chf(ded)}.`,
            `Le plus bas des revenus du travail, après frais professionnels, 3a et rachats, est ${chf(lower)}${NB}; la déduction est au plus ${chf(max)}${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // Medical costs and donations, both measured on the Nettoeinkommen (310).
  const s310 = items.reduce((s, i) => s + i.amount, 0);
  if (hh.medicalCosts) {
    const tr = new Trace();
    const costs = total(tr, [hh.medicalCosts]);
    const m = medicalDeduction(costs, s310, tr.p(A.medicalThresholdBp));
    if (costs > 0) {
      notes.limit(
        'medical',
        A.medicalThresholdBp,
        'threshold',
        '320',
        'household',
        costs,
        m.threshold,
        m.deduction,
      );
    }
    if (m.deduction > 0) {
      items.push(
        item(
          '320',
          'household',
          tr,
          -m.deduction,
          t(
            `${chf(costs)} less 5 % of the net income ${chf(s310)} (${chf(m.threshold)}): ${chf(m.deduction)}.`,
            `${chf(costs)} moins 5${NB}% du revenu net ${chf(s310)} (${chf(m.threshold)})${NB}: ${chf(m.deduction)}.`,
          ),
        ),
      );
    } else if (costs > 0) notes.add(notes.notCounted, NOTE.medicalBelow);
  }
  if (hh.donations) {
    const tr = new Trace();
    const gifts = total(tr, [hh.donations]);
    const dp = tr.p(A.donations);
    const d = donationDeduction(gifts, s310, dp);
    if (gifts > 0)
      notes.limit(
        'donations',
        A.donations,
        'minimum',
        '324',
        'household',
        gifts,
        dp.min,
        d.deduction,
      );
    if (gifts >= dp.min)
      notes.limit('donations', A.donations, 'cap', '324', 'household', gifts, d.cap, d.deduction);
    if (d.deduction > 0) {
      items.push(
        item(
          '324',
          'household',
          tr,
          -d.deduction,
          t(
            `${chf(gifts)}, at most 20 % of the net income ${chf(s310)} (${chf(d.cap)}): ${chf(d.deduction)}.`,
            `${chf(gifts)}, au plus 20${NB}% du revenu net ${chf(s310)} (${chf(d.cap)})${NB}: ${chf(d.deduction)}.`,
          ),
        ),
      );
    } else if (gifts > 0) notes.add(notes.notCounted, NOTE.donationsMin);
  }

  // Child deductions (Sozialabzüge): in the household (370) and elsewhere (372).
  for (const [code, lives] of [
    ['370', true],
    ['372', false],
  ] as const) {
    const these = counted.filter((ch) => ch.livesWithYou === lives);
    if (!these.length) continue;
    const tr = new Trace();
    const per = tr.p(A.child);
    const weight = these.reduce((s, ch) => s + ch.weight, 0);
    const ded = per * weight;
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

  // Wealth (p. 4 of the return).
  const wealthItems: Item[] = [];
  if (movableValue > 0) {
    wealthItems.push(
      item(
        '400',
        'household',
        valueTr,
        movableValue,
        t(
          `Taxable value on 31 December of the accounts and securities: ${chf(movableValue)}.`,
          `Valeur imposable au 31 décembre des comptes et titres${NB}: ${chf(movableValue)}.`,
        ),
      ),
    );
  }
  const asset = (code: RubricCode, amount: Amount | undefined, sign: 1 | -1) => {
    if (!amount) return;
    const tr = new Trace();
    const value = total(tr, [amount]);
    if (value > 0) {
      wealthItems.push(
        item(
          code,
          'household',
          tr,
          sign * value,
          t(`As given: ${chf(value)}.`, `Tel que donné${NB}: ${chf(value)}.`),
        ),
      );
    }
  };
  asset('404', hh.cash, 1);
  asset('406', hh.lifeInsuranceValue, 1);
  asset('412', hh.vehicles, 1);
  asset('416', hh.otherAssets, 1);
  asset('470', hh.debts, -1);

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
    canton: 'ZH' as const,
    taxYear: input.taxYear,
    commune: { bfs: c.bfs, name: c.name, rate: commune.ref?.rate ?? null },
    assumptions: notes.assumptions,
  };
  if (notes.unsupported.length) {
    return {
      ...base,
      ...summary(cantonalLines, cantonalLines),
      notCounted: notes.notCounted,
      unsupported: notes.unsupported,
      icc: null,
      ifd: null,
      total: null,
      unverifiedRules: [],
      limits: notes.limits,
    };
  }
  // In the form's order, person 1 before person 2 (the sort is stable).
  const order = FORM_ORDER as readonly string[];
  const byForm = (x: Item, y: Item) => order.indexOf(x.code) - order.indexOf(y.code);
  items.sort(byForm);
  wealthItems.sort(byForm);
  const icc = assess({
    taxYear: input.taxYear,
    commune: input.commune,
    ...(input.communeVariant !== undefined ? { communeVariant: input.communeVariant } : {}),
    tariff,
    tariffSources,
    adults: couple ? 2 : 1,
    ...(input.church
      ? {
          church: {
            members: churchMembers,
            ...(input.church.parish !== undefined ? { parish: input.church.parish } : {}),
          },
        }
      : {}),
    incomeItems: items,
    wealthItems,
  });

  // The federal tax, the Bundessteuer column (./ifd.ts): the same income lines, the federal
  // deductions. Who counts the children follows the same child support rule (circular 30).
  const support = sharedAlone ? input.childSupport : undefined;
  const childSources =
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
      childSources,
      wealthIncome: movableIncome,
    },
    people.map((p) => ({
      input: p,
      salary: items.find((i) => i.person === p.id && i.code === personCode('salary', p.id)),
    })),
  );
  const ifd = federal.ifd;
  const fedLines: Line[] = ifd
    ? [
        ...ifd.items,
        ifd.grossIncome,
        ifd.totalDeductions,
        ifd.subtotal310,
        ifd.netIncome,
        ifd.taxableIncome,
        ifd.scaleIncome,
        ifd.scaleTax,
        ifd.childReduction,
        ifd.tax,
      ]
    : [];
  const more = (list: Text[], extra: readonly Text[]) => {
    for (const x of extra) notes.add(list, x);
    return list;
  };
  return {
    ...base,
    ...summary(
      [...allLines({ icc }), ...fedLines],
      [...items, ...(ifd?.items ?? []), ...wealthItems],
    ),
    notCounted: more(notes.notCounted, federal.notes.notCounted),
    unsupported: [...federal.notes.unsupported],
    icc,
    ifd,
    total: ifd ? icc.taxes.total.amount + ifd.tax.amount : null,
    unverifiedRules: [...unverified, ...federal.notes.unverified],
    limits: bothTaxes(notes.limits, federal.notes.limits),
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

/** ESTV circular 30 on the taxation of spouses and the family: separated parents, the scales. */
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';
/** Deductions in full in both columns: buy-ins paid directly, alimony, child support, costs. */
const IN_FULL = new Set(['280', '254', '255', '283']);

/** Every computed line of a result, for checks and for the explanation tree. */
export function allLines(r: Pick<ZhTaxResult, 'icc'> & { ifd?: ZhTaxResult['ifd'] }): Line[] {
  const f = r.ifd;
  const federal: Line[] = f
    ? [
        ...f.items,
        f.grossIncome,
        f.totalDeductions,
        f.subtotal310,
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
    x.subtotal310,
    x.netIncome,
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
    x.taxes.personalTax,
    x.taxes.total,
    ...federal,
  ];
}
