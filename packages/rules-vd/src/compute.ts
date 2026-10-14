// The one entry point: computeReturn(input) gives the lines of the Vaud return by code and person,
// the totals and the cantonal and communal tax, each line explained with its sources, then the
// federal tax on the guide's worksheet (./ifd.ts). First stage here (household figures to the lines
// of the return, every cap, floor and threshold of the Vaud documents, in the order of the form,
// with the limits each rule applied), second stage in ./assess.ts (lines to taxes). The same two
// stages, with the same names, as packages/rules-zh and packages/rules-be.
import {
  answered,
  chf,
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
  partsOf,
  subtotals,
  VdInputError,
  VdUnsupported,
  type VdFamily,
} from './assess.js';
import { communeRate } from './communes.js';
import { ESTIMATE_TEXT, NOTE, personalTaxNote } from './explain.js';
import { federalReturn, type FederalChild } from './ifd.js';
import { familySituation, parts, personalTax, sharedChildren } from './law.js';
import { vdParamsFor, type VdYearParams } from './params.js';
import { INCOME, RUBRICS, WEALTH_RUBRICS, type RubricCode, type WealthCode } from './rubrics.js';
import {
  donationDeduction,
  drivingCost,
  familyDeduction,
  flatShare,
  housingDeduction,
  medicalDeduction,
  modestDeduction,
  prorated,
  publicTransportFlat,
  twoEarnerDeduction,
} from './rules.js';
import type {
  ChildInput,
  EmploymentInput,
  Item,
  ItemPerson,
  Line,
  PersonInput,
  Text,
  VdEngineInput,
  VdTaxResult,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
/** 15000 -> "15’000", the Swiss way. */
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '’');

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

/** Sum of amounts read into a trace, to the franc (the form takes whole francs). */
function total(tr: Trace, amounts: readonly (Amount | undefined)[]): number {
  return roundFranc(amounts.reduce((s, a) => s + tr.a(a), 0));
}

const given = (value: number) =>
  t(`As given: ${chf(value)}.`, `Tel que donné${NB}: ${chf(value)}.`);

interface Salary {
  /** Box 11: box 8 less boxes 9 and 10, to the franc. */
  net: number;
  /** The net salary before the box 10.2 buy-ins, the base of the flat share (guide p. 22). */
  beforeBuyIn: number;
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
  return {
    net: roundFranc(Math.max(0, gross - social - fund - buyIn)),
    beforeBuyIn: roundFranc(Math.max(0, gross - social - fund)),
    gross,
    social,
    tr,
  };
}

/** Travel to work (140) before any cap, and how it was found (no final full stop). */
function travel(
  P: VdYearParams,
  p: PersonInput,
  main: readonly EmploymentInput[],
  tr: Trace,
  notes: Notes,
): { cost: number; how: Text } {
  const A = P.amounts;
  const mode = p.commuteMode;
  if (mode) tr.with(answered(mode.facts, mode.status));
  const none = (how: Text) => ({ cost: 0, how });
  const unpublished = () => {
    notes.add(notes.unsupported, NOTE.transport2026);
    return none(t('travel: not published for the year', `transport${NB}: non publié pour l’année`));
  };
  if (main.length && main.every((e) => e.freeTransport)) {
    notes.add(notes.assumptions, NOTE.freeTransport);
    return none(t('travel: transport provided', `transport${NB}: fourni par l’employeur`));
  }
  if (mode?.by === 'home' || mode?.by === 'walk') {
    return none(t('travel: none', `transport${NB}: aucun`));
  }
  const yearDays = tr.p(A.yearDays);
  const partYear = (amount: number) => {
    if (mode?.days === undefined || mode.days >= yearDays) return amount;
    notes.add(notes.assumptions, NOTE.partYear);
    return prorated(amount, mode.days, yearDays);
  };
  const justified = mode?.transitUsable === false;
  if (justified && (mode.by === 'car' || mode.by === 'motorbike')) {
    if (!mode.kmOneWay || !mode.days) {
      notes.add(notes.notCounted, NOTE.drivingDetails);
      return none(t('travel: not counted', `transport${NB}: non compté`));
    }
    if (mode.days > yearDays) notes.add(notes.assumptions, NOTE.daysCapped);
    const days = Math.min(mode.days, yearDays);
    if (mode.by === 'car') {
      const car = tr.p(A.car);
      const cost = drivingCost(mode.kmOneWay, days, car);
      return {
        cost,
        how: t(
          `travel ${chf(cost)} (car: ${mode.kmOneWay} km x 2 x ${days} days, CHF 0.${String(car.perKm).padStart(2, '0')} a km up to ${thousands(car.kmLimit)} km, CHF 0.${String(car.abovePerKm).padStart(2, '0')} above)`,
          `transport ${chf(cost)} (voiture${NB}: ${mode.kmOneWay} km x 2 x ${days} jours, CHF 0.${String(car.perKm).padStart(2, '0')} par km jusqu’à ${thousands(car.kmLimit)} km, CHF 0.${String(car.abovePerKm).padStart(2, '0')} au-delà)`,
        ),
      };
    }
    if (!A.otherTransport) return unpublished();
    const perKm = tr.p(A.otherTransport).motorbikePerKm;
    const cost = roundFranc(mode.kmOneWay * 2 * days * perKm);
    return {
      cost,
      how: t(
        `travel ${chf(cost)} (motorbike: ${mode.kmOneWay} km x 2 x ${days} days x CHF 0.${perKm})`,
        `transport ${chf(cost)} (moto${NB}: ${mode.kmOneWay} km x 2 x ${days} jours x CHF 0.${perKm})`,
      ),
    };
  }
  // A bike or moped: its own flat amount a year (vd-2025-guide p. 20).
  if (mode?.by === 'bike') {
    if (!A.otherTransport) return unpublished();
    const cost = partYear(tr.p(A.otherTransport).bikePerYear);
    return {
      cost,
      how: t(
        `travel ${chf(cost)} (bike or moped, flat a year)`,
        `transport ${chf(cost)} (vélo ou cyclomoteur, forfait annuel)`,
      ),
    };
  }
  // Public transport: the flat amount for the distance (also for a car or a motorbike when public
  // transport could be used), or what the trip actually cost when more.
  if (!mode && !p.commuteCost)
    return none(t('travel: nothing given', `transport${NB}: rien d’indiqué`));
  if (!A.publicTransport) return unpublished();
  const km = mode?.kmOneWay;
  const flat = km ? partYear(publicTransportFlat(tr.p(A.publicTransport), km)) : undefined;
  const paid = p.commuteCost ? total(tr, [p.commuteCost]) : undefined;
  if (flat === undefined && paid === undefined) {
    notes.add(notes.notCounted, NOTE.transitDetails);
    return none(t('travel: not counted', `transport${NB}: non compté`));
  }
  if (paid !== undefined && flat !== undefined) {
    notes.limit(
      'commute',
      A.publicTransport,
      'choice',
      '140',
      p.id,
      paid,
      flat,
      Math.max(paid, flat),
    );
  }
  if (paid !== undefined && (flat === undefined || paid > flat)) {
    notes.add(notes.assumptions, flat === undefined ? NOTE.transitCostOnly : NOTE.actualTransport);
    return {
      cost: paid,
      how: t(`travel ${chf(paid)} (what it cost)`, `transport ${chf(paid)} (frais effectifs)`),
    };
  }
  return {
    cost: flat!,
    how: t(
      `travel ${chf(flat!)} (public transport flat amount for ${km} km one way)`,
      `transport ${chf(flat!)} (forfait des transports publics pour ${km} km aller)`,
    ),
  };
}

interface PersonFigures {
  id: 'p1' | 'p2';
  /** Net salaries (main and side job): the income of an activité lucrative. */
  earned: number;
  /** Professional costs (140 to 165). */
  costs: number;
  /** Pension contributions deducted (310 to 340). */
  contributions: number;
}

function personItems(P: VdYearParams, p: PersonInput, items: Item[], notes: Notes): PersonFigures {
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
    items.push(item('100', p.id, mainSalary.tr, mainSalary.net, salaryHow(mainSalary.net)));
  }
  if (side.length) {
    items.push(item('105', p.id, sideSalary.tr, sideSalary.net, salaryHow(sideSalary.net)));
  }

  // Professional costs of the main job (140, 150, 160).
  let costs = 0;
  if (main.length) {
    const trTravel = new Trace().with(mainSalary.tr);
    const tv = travel(P, p, main, trTravel, notes);
    if (tv.cost > 0) {
      items.push(item('140', p.id, trTravel, -tv.cost, t(`${tv.how.en}.`, `${tv.how.fr}.`)));
      costs += tv.cost;
    }

    if (p.commuteMode?.by === 'home') {
      notes.add(notes.assumptions, NOTE.workFromHome);
    } else if ((p.mealDays ?? 0) > 0) {
      const tr = answered(p.mealFacts);
      const m = tr.p(A.meals);
      const yearDays = tr.p(A.yearDays);
      const canteen = main.some((e) => e.canteen);
      const perYear = canteen ? m.halfPerYear : m.perYear;
      const days = p.mealDays ?? 0;
      const meals = prorated(perYear, days, yearDays);
      notes.limit(
        'meals',
        A.meals,
        'cap',
        '150',
        p.id,
        roundFranc(perYear * Math.max(0, days), yearDays),
        perYear,
        meals,
      );
      if (days < yearDays) notes.add(notes.assumptions, NOTE.partYear);
      if (meals > 0) {
        items.push(
          item(
            '150',
            p.id,
            tr,
            -meals,
            t(
              `${chf(perYear)} a year${canteen ? ' (half: canteen or meal vouchers, box G)' : ''} for ${yearDays} working days; ${Math.min(days, yearDays)} days: ${chf(meals)}.`,
              `${chf(perYear)} par an${canteen ? ` (moitié${NB}: cantine ou participation de l’employeur, case G)` : ''} pour ${yearDays} jours de travail${NB}; ${Math.min(days, yearDays)} jours${NB}: ${chf(meals)}.`,
            ),
          ),
        );
        costs += meals;
      }
    }

    const trOther = new Trace().with(mainSalary.tr);
    const flatP = trOther.p(A.professionalFlat);
    const flat = flatShare(mainSalary.beforeBuyIn, flatP);
    let other = flat;
    let otherHow = t(
      `3 % of the net salary ${chf(mainSalary.beforeBuyIn)}, at least ${chf(flatP.min)}, at most ${chf(flatP.max)}, never more than that salary: ${chf(flat)}.`,
      `3${NB}% du salaire net ${chf(mainSalary.beforeBuyIn)}, au moins ${chf(flatP.min)}, au plus ${chf(flatP.max)}, jamais plus que ce salaire${NB}: ${chf(flat)}.`,
    );
    if (p.otherProfessionalCosts) {
      const actual = total(trOther, [p.otherProfessionalCosts]);
      notes.limit(
        'professional.other',
        A.professionalFlat,
        'choice',
        '160',
        p.id,
        actual,
        flat,
        Math.max(actual, flat),
      );
      if (actual > flat) {
        other = actual;
        otherHow = t(`Actual costs: ${chf(actual)}.`, `Frais effectifs${NB}: ${chf(actual)}.`);
        notes.add(notes.assumptions, NOTE.actualCosts);
      }
    }
    if (other > 0) {
      items.push(item('160', p.id, trOther, -other, otherHow));
      costs += other;
    }
  }

  // A side job (165): 20 % of its net salary, between the minimum and the maximum.
  if (side.length) {
    const tr = new Trace().with(sideSalary.tr);
    const sp = tr.p(A.sideJobFlat);
    const flat = flatShare(sideSalary.beforeBuyIn, sp);
    if (flat > 0) {
      items.push(
        item(
          '165',
          p.id,
          tr,
          -flat,
          t(
            `20 % of the side job’s net salary ${chf(sideSalary.beforeBuyIn)}, at least ${chf(sp.min)}, at most ${chf(sp.max)}, never more than that salary: ${chf(flat)}.`,
            `20${NB}% du salaire net de l’activité accessoire ${chf(sideSalary.beforeBuyIn)}, au moins ${chf(sp.min)}, au plus ${chf(sp.max)}, jamais plus que ce salaire${NB}: ${chf(flat)}.`,
          ),
        ),
      );
      costs += flat;
    }
  }

  // Allowances, pensions and alimony of the person.
  const own = (code: RubricCode, amount: Amount | undefined, note?: Text) => {
    if (!amount) return 0;
    const tr = new Trace();
    const value = total(tr, [amount]);
    if (value <= 0) return 0;
    if (note) notes.add(notes.assumptions, note);
    items.push(item(code, p.id, tr, value, given(value)));
    return value;
  };
  own('200', p.unemploymentBenefits);
  own('210', p.replacementIncome);
  own('240', p.pensionAvs);
  own('250', p.pensionOccupational, NOTE.pensions);
  own('270', p.pensionOther, NOTE.pensions);
  own('280', p.alimonyReceived);

  // Pillar 3a (310): the federal limits as the canton's table prints them.
  const hasPensionFund =
    p.hasPensionFund ??
    main.some((e) => (e.pensionFund?.value ?? 0) > 0 || (e.pensionBuyIn?.value ?? 0) > 0);
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
    notes.limit('pillar3a', l.param, l.kind, '310', p.id, l.given, l.limit, l.counted);
  }
  if (r3a.deduction && r3a.deduction.amount < 0) {
    contributions += -r3a.deduction.amount;
    items.push(item('310', p.id, r3a.deduction.trace, r3a.deduction.amount, r3a.deduction.how));
  }

  // Pension fund buy-ins paid directly (320).
  if (p.pensionBuyIn) {
    const tr = new Trace();
    const paid = total(tr, [p.pensionBuyIn]);
    if (paid > 0) {
      items.push(item('320', p.id, tr, -paid, given(paid)));
      contributions += paid;
    }
  }

  // Professional training (618), per taxpayer.
  if (p.trainingCosts) {
    const tr = new Trace();
    const paid = total(tr, [p.trainingCosts]);
    const cap = tr.p(A.training);
    const ded = Math.min(paid, cap);
    if (paid > 0) notes.limit('training', A.training, 'cap', '618', p.id, paid, cap, ded);
    if (ded > 0) {
      items.push(
        item(
          '618',
          p.id,
          tr,
          -ded,
          t(
            `Paid ${chf(paid)}, at most ${chf(cap)} per taxpayer: ${chf(ded)}.`,
            `Payé ${chf(paid)}, au plus ${chf(cap)} par contribuable${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  return {
    id: p.id,
    earned: mainSalary.net + sideSalary.net,
    costs,
    contributions,
  };
}

/** A child as Vaud counts it here: a part of 0.5 (weight 1), half of it (0.5), or none (0). */
interface CountedChild {
  weight: 1 | 0.5;
  livesWithYou: boolean;
  child: ChildInput;
}

/** Who counts the children and the parts without children (LI art. 43; RIFam art. 5). */
function family(
  input: VdEngineInput,
  children: readonly ChildInput[],
  couple: boolean,
  notes: Notes,
): { family: VdFamily; counted: CountedChild[]; sources: string[]; childSources: string[] } {
  const counted: CountedChild[] = [];
  const sources = [parts(input.taxYear).source, familySituation(input.taxYear).source];
  const childSources: string[] = [];
  for (const child of children) {
    const livesWithYou = child.livesWithYou ?? true;
    if (child.custody === 'full') {
      counted.push({ weight: 1, livesWithYou, child });
      continue;
    }
    if (couple) {
      notes.add(notes.unsupported, NOTE.marriedShared);
      continue;
    }
    sources.push(sharedChildren(input.taxYear).source);
    childSources.push(sharedChildren(input.taxYear).source);
    if (input.childSupport === 'receives') counted.push({ weight: 1, livesWithYou, child });
    else if (input.childSupport === 'none') {
      counted.push({ weight: 0.5, livesWithYou, child });
      notes.add(notes.assumptions, NOTE.sharedHalf);
    } else if (input.childSupport === 'pays') notes.add(notes.assumptions, NOTE.childSupportPaid);
    else notes.add(notes.unsupported, NOTE.childSupport);
  }
  let base: VdFamily['base'] = couple ? 'married' : 'single';
  if (!couple && counted.length) {
    if (input.ownHousehold === undefined) notes.add(notes.unsupported, NOTE.ownHousehold);
    else if (input.ownHousehold) {
      if (counted.some((c) => c.weight === 1 && c.livesWithYou)) base = 'singleParent';
      else if (counted.some((c) => c.weight === 0.5 && c.livesWithYou)) {
        if (input.mainUpkeep === undefined) notes.add(notes.unsupported, NOTE.mainUpkeep);
        else if (input.mainUpkeep) base = 'singleParent';
      }
    }
  }
  return {
    family: {
      base,
      fullChildren: counted.filter((c) => c.weight === 1).length,
      sharedChildren: counted.filter((c) => c.weight === 0.5).length,
    },
    counted,
    sources: [...new Set(sources)],
    childSources: [...new Set(childSources)],
  };
}

export function computeReturn(input: VdEngineInput): VdTaxResult {
  const P = vdParamsFor(input.taxYear);
  const A = P.amounts;
  const commune = communeOf(input.taxYear, input.commune);
  const notes = new Notes();
  const couple = input.civilStatus === 'married';
  const people = [...input.people].sort((a, b) => a.id.localeCompare(b.id));
  if (!people.some((p) => p.id === 'p1')) throw new VdInputError('people must include p1');
  if (!couple && people.some((p) => p.id === 'p2')) {
    throw new VdInputError('p2 is the spouse: only for a married couple');
  }
  if (new Set(people.map((p) => p.id)).size !== people.length) {
    throw new VdInputError('each person once');
  }
  const hh = input.household ?? {};
  if (people.some((p) => p.selfEmploymentProfit)) notes.add(notes.unsupported, NOTE.selfEmployed);
  if (communeRate(commune, input.communePart) === 'part') {
    notes.add(notes.unsupported, NOTE.communePart);
  }
  if (commune.personalTax) {
    notes.add(notes.notCounted, personalTaxNote(commune.name, chf(commune.personalTax)));
  }
  notes.add(notes.notCounted, NOTE.dependents);

  // Childcare paid for the household as a whole (the invoices of a crèche, say): the form asks it
  // per child under 14 (code 670), and the limit is per child. It is that child's when one child can
  // have it, or when the whole amount is within any child's limit; otherwise how it splits decides
  // the deduction, and it is not computed without it (fail closed).
  const children: ChildInput[] = (input.children ?? []).map((ch) => ({ ...ch }));
  if (hh.childcare) {
    if (children.some((ch) => ch.childcare)) {
      throw new VdInputError('Childcare: give it per child or for the household, not both.');
    }
    const care = A.childcare.value;
    const eligible = children.filter((ch) => ch.livesWithYou !== false && ch.under14 !== false);
    const paid = total(new Trace(), [hh.childcare]);
    const capOf = (ch: ChildInput) =>
      ch.custody === 'shared' ? care.sharedPerParent : care.perChild;
    if (
      eligible.length === 1 ||
      (eligible.length > 1 && paid <= Math.min(...eligible.map(capOf)))
    ) {
      eligible[0]!.childcare = hh.childcare;
    } else if (eligible.length > 1) {
      notes.add(notes.unsupported, NOTE.childcareSplit);
    } else if (paid > 0) {
      notes.add(notes.notCounted, NOTE.childcareNoChild);
    }
  }

  const fam = family(input, children, couple, notes);
  if (notes.unsupported.length) {
    // Something every later line rests on is missing or not supported (a question about the family,
    // the part of the commune, self-employment): the result says that first, and nothing more.
    return {
      canton: 'VD',
      taxYear: input.taxYear,
      commune: communeRef(input.taxYear, input.commune, input.communePart),
      icc: null,
      ifd: null,
      total: null,
      estimates: [],
      needsOk: 0,
      complete: true,
      incomplete: [],
      assumptions: notes.assumptions,
      notCounted: notes.notCounted,
      unsupported: notes.unsupported,
      unverifiedRules: [],
      limits: [],
    };
  }
  const weight = fam.counted.reduce((s, c) => s + c.weight, 0);
  const shared = fam.family.sharedChildren > 0;
  const sharedSource = sharedChildren(input.taxYear).source;
  const perChildText = (amount: number) =>
    weight
      ? t(
          ` + ${String(weight)} x ${chf(amount)} for children`,
          ` + ${String(weight).replace('.', ',')} x ${chf(amount)} pour les enfants`,
        )
      : t('', '');

  const items: Item[] = [];
  const figures = people.map((p) => personItems(P, p, items, notes));

  // Both spouses work (235): from the lower income, at most that income after its costs (140 to
  // 165) and pension contributions (310 to 340).
  if (couple && figures.length === 2 && figures.every((f) => f.earned > 0)) {
    const tr = new Trace();
    const amount = tr.p(A.twoEarner);
    const lowerLeft = Math.min(...figures.map((f) => f.earned - f.costs - f.contributions));
    const ded = twoEarnerDeduction(lowerLeft, amount);
    if (ded > 0) {
      items.push(
        item(
          '235',
          'household',
          tr,
          -ded,
          t(
            `${chf(amount)} from the lower income, at most that income after its professional costs and pension contributions (${chf(lowerLeft)}): ${chf(ded)}.`,
            `${chf(amount)} sur le revenu le plus bas, au plus ce revenu après ses frais professionnels et cotisations de prévoyance (${chf(lowerLeft)})${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // Insurance premiums (300): health, accident and life, less subsidies, at most the limit.
  const premiums = [hh.healthPremiums, hh.accidentPremiums, hh.lifeInsurancePremiums];
  if (premiums.some(Boolean)) {
    const tr = new Trace();
    const paid = Math.max(0, total(tr, premiums) - total(tr, [hh.healthSubsidy]));
    const ins = tr.p(A.insurance);
    if (shared) tr.src(sharedSource);
    const cap = (couple ? ins.married : ins.single) + Math.round(ins.perChild * weight);
    const ded = Math.min(paid, cap);
    if (paid > 0) notes.limit('insurance', A.insurance, 'cap', '300', 'household', paid, cap, ded);
    if (ded > 0) {
      const kids = perChildText(ins.perChild);
      items.push(
        item(
          '300',
          'household',
          tr,
          -ded,
          t(
            `Premiums less subsidies ${chf(paid)}, at most ${chf(couple ? ins.married : ins.single)}${kids.en} = ${chf(cap)}: ${chf(ded)}.`,
            `Primes moins subsides ${chf(paid)}, au plus ${chf(couple ? ins.married : ins.single)}${kids.fr} = ${chf(cap)}${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // Accounts and securities (410): income and value; a minor child's too.
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
        '410',
        'household',
        incomeTr,
        movableIncome,
        t(
          `Gross income of the accounts and securities: ${chf(movableIncome)}.`,
          `Rendement brut des titres et autres placements${NB}: ${chf(movableIncome)}.`,
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
  householdGiven('195', [hh.otherIncome], 1);
  householdGiven('280', [hh.childSupportReceived], 1);

  // Interest on savings (480): at most the limit, never more than that interest, and only what the
  // income of code 410 includes ("elle ne peut en aucun cas dépasser lesdits revenus",
  // vd-2025-guide p. 40).
  if (hh.savingsInterest) {
    const tr = new Trace();
    const stated = total(tr, [hh.savingsInterest]);
    const interest = Math.min(stated, movableIncome);
    if (stated > movableIncome) notes.add(notes.notCounted, NOTE.savingsAbove410);
    const s = tr.p(A.savingsInterest);
    if (shared) tr.src(sharedSource);
    const cap = (couple ? s.married : s.single) + Math.round(s.perChild * weight);
    const ded = Math.min(interest, cap);
    if (interest > 0) {
      notes.limit(
        'savings_interest',
        A.savingsInterest,
        'cap',
        '480',
        'household',
        interest,
        cap,
        ded,
      );
    }
    if (ded > 0) {
      const kids = perChildText(s.perChild);
      items.push(
        item(
          '480',
          'household',
          tr,
          -ded,
          t(
            `Interest on savings ${chf(interest)}, at most ${chf(couple ? s.married : s.single)}${kids.en} = ${chf(cap)}: ${chf(ded)}.`,
            `Intérêts de capitaux d’épargne ${chf(interest)}, au plus ${chf(couple ? s.married : s.single)}${kids.fr} = ${chf(cap)}${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }
  householdGiven('490', [hh.bankFees], -1);

  // Private debt interest (610): up to the gross income from wealth plus a fixed amount.
  if (hh.debtInterest) {
    const tr = new Trace().with(incomeTr);
    const paid = total(tr, [hh.debtInterest]);
    const extra = tr.p(A.debtInterestExtra);
    const cap = movableIncome + extra;
    const ded = Math.min(paid, cap);
    if (paid > 0) {
      notes.limit('debt_interest', A.debtInterestExtra, 'cap', '610', 'household', paid, cap, ded);
    }
    if (ded > 0) {
      items.push(
        item(
          '610',
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

  // Political parties (620): at most one amount a year.
  if (hh.politicalParty) {
    const tr = new Trace();
    const paid = total(tr, [hh.politicalParty]);
    const max = tr.p(A.party);
    const ded = Math.min(paid, max);
    if (paid > 0) notes.limit('party', A.party, 'cap', '620', 'household', paid, max, ded);
    if (couple && paid > max) notes.add(notes.unverified, NOTE.partyCouple);
    if (ded > 0) {
      items.push(
        item(
          '620',
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
  householdGiven('630', [hh.alimonyPaid, hh.childSupportPaid], -1);

  // Childcare (670): per child under 14 in your household; married, both must work.
  const withCare = children.filter((ch): ch is ChildInput & { childcare: Amount } =>
    Boolean(ch.childcare),
  );
  if (withCare.length) {
    const working = couple
      ? figures.length === 2 && figures.every((f) => f.earned > 0)
      : figures.some((f) => f.earned > 0);
    if (!working) notes.add(notes.notCounted, NOTE.childcareWork);
    else {
      const tr = new Trace();
      const care = tr.p(A.childcare);
      let ded = 0;
      let paidAll = 0;
      let capAll = 0;
      const parts: string[] = [];
      for (const ch of withCare) {
        if (ch.under14 === false || ch.livesWithYou === false) continue;
        if (ch.under14 === undefined) notes.add(notes.assumptions, NOTE.under14);
        const cap = ch.custody === 'shared' ? care.sharedPerParent : care.perChild;
        if (ch.custody === 'shared') {
          tr.src(sharedSource);
          notes.add(notes.unverified, NOTE.sharedChildcare);
        }
        const paid = total(tr, [ch.childcare]);
        const one = Math.min(paid, cap);
        paidAll += paid;
        capAll += cap;
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
              `Per child under 14, what was paid, at most ${chf(care.perChild)} (${chf(care.sharedPerParent)} for each parent with shared custody): ${parts.join(' + ')} = ${chf(ded)}.`,
              `Par enfant de moins de 14 ans, ce qui a été payé, au plus ${chf(care.perChild)} (${chf(care.sharedPerParent)} par parent en garde partagée)${NB}: ${parts.join(' + ')} = ${chf(ded)}.`,
            ),
          ),
        );
      }
    }
  }

  // 650, then the housing deduction (660): the rent counted above 20 % of 650.
  const net = subtotals(items).net;
  if (input.rent === undefined) notes.add(notes.unsupported, NOTE.rent);
  else {
    const tr = new Trace();
    const rent = total(tr, [input.rent]);
    const h = tr.p(A.housing);
    const caps = tr.p(A.rentCap);
    const certainFamily = couple || fam.family.base === 'singleParent';
    const possibleFamily = certainFamily || shared;
    const low =
      (certainFamily ? caps.family : caps.single) + caps.perChild * fam.family.fullChildren;
    const high = A.rentCap.floorOnly
      ? Number.POSITIVE_INFINITY
      : (possibleFamily ? caps.family : caps.single) +
        caps.perChild * (fam.family.fullChildren + fam.family.sharedChildren);
    const ded = housingDeduction(rent, net, low, h);
    if (ded !== housingDeduction(rent, net, high, h)) {
      notes.add(notes.unsupported, A.rentCap.floorOnly ? NOTE.housing2026 : NOTE.housingShared);
    } else if (ded > 0) {
      if (shared) tr.src(sharedSource);
      items.push(
        item(
          '660',
          'household',
          tr,
          -ded,
          t(
            `Rent ${chf(rent)}, counted up to ${chf(low)}, less 20 % of the net income ${chf(net)} (${chf(shareFranc(net, h.incomeShareBp))}), at most ${chf(h.max)}: ${chf(ded)}.`,
            `Loyer ${chf(rent)}, pris en compte jusqu’à ${chf(low)}, moins 20${NB}% du revenu net ${chf(net)} (${chf(shareFranc(net, h.incomeShareBp))}), au plus ${chf(h.max)}${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // Modest taxpayers (695), on 690.
  {
    const c690 = subtotals(items).c690;
    const tr = new Trace();
    const m = tr.p(A.modest);
    if (shared) tr.src(sharedSource);
    const singleParent = fam.family.base === 'singleParent';
    const max =
      m.base +
      (couple ? m.spouse : 0) +
      (singleParent ? m.singleParent : 0) +
      Math.round(m.perChild * weight);
    const ded = modestDeduction(c690, max);
    if (ded > 0) {
      const extra = couple
        ? t(` + ${chf(m.spouse)} for the spouse`, ` + ${chf(m.spouse)} pour le conjoint`)
        : singleParent
          ? t(
              ` + ${chf(m.singleParent)} for a single parent`,
              ` + ${chf(m.singleParent)} pour une famille monoparentale`,
            )
          : t('', '');
      const kids = perChildText(m.perChild);
      items.push(
        item(
          '695',
          'household',
          tr,
          -ded,
          t(
            `At most ${chf(m.base)}${extra.en}${kids.en} = ${chf(max)}; income (690) ${chf(c690)}${c690 > max ? `, half the excess over the maximum taken off, in hundreds` : ', never more than it'}: ${chf(ded)}.`,
            `Au plus ${chf(m.base)}${extra.fr}${kids.fr} = ${chf(max)}${NB}; revenu (690) ${chf(c690)}${c690 > max ? `, moins la moitié de l’excédent sur le maximum, arrondie à la centaine` : ', jamais plus que lui'}${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // Medical costs (710) and donations (720), on the intermediate income (700).
  const intermediate = subtotals(items).intermediate;
  if (hh.medicalCosts) {
    const tr = new Trace();
    const costs = total(tr, [hh.medicalCosts]);
    const m = medicalDeduction(costs, intermediate, tr.p(A.medicalThresholdBp));
    notes.limit(
      'medical',
      A.medicalThresholdBp,
      'threshold',
      '710',
      'household',
      costs,
      m.threshold,
      m.deduction,
    );
    if (m.deduction > 0) {
      items.push(
        item(
          '710',
          'household',
          tr,
          -m.deduction,
          t(
            `${chf(costs)} less 5 % of the intermediate income ${chf(intermediate)} (${chf(m.threshold)}): ${chf(m.deduction)}.`,
            `${chf(costs)} moins 5${NB}% du revenu intermédiaire ${chf(intermediate)} (${chf(m.threshold)})${NB}: ${chf(m.deduction)}.`,
          ),
        ),
      );
    } else if (costs > 0) notes.add(notes.notCounted, NOTE.medicalBelow);
  }
  if (hh.donations) {
    const tr = new Trace();
    const gifts = total(tr, [hh.donations]);
    const d = donationDeduction(gifts, intermediate, tr.p(A.donations));
    notes.limit(
      'donations',
      A.donations,
      'minimum',
      '720',
      'household',
      gifts,
      A.donations.value.min,
      d.deduction,
    );
    if (gifts >= A.donations.value.min) {
      notes.limit('donations', A.donations, 'cap', '720', 'household', gifts, d.cap, d.deduction);
    }
    if (d.deduction > 0) {
      items.push(
        item(
          '720',
          'household',
          tr,
          -d.deduction,
          t(
            `${chf(gifts)}, at most 20 % of the intermediate income ${chf(intermediate)} (${chf(d.cap)}): ${chf(d.deduction)}.`,
            `${chf(gifts)}, au plus 20${NB}% du revenu intermédiaire ${chf(intermediate)} (${chf(d.cap)})${NB}: ${chf(d.deduction)}.`,
          ),
        ),
      );
    } else if (gifts > 0) notes.add(notes.notCounted, NOTE.donationsMin);
  }

  // Family deduction (725): spouses and single parents with the part of 1.3, on 650.
  if (couple || fam.family.base === 'singleParent') {
    const tr = new Trace();
    const f = tr.p(A.family);
    if (shared) tr.src(sharedSource);
    const full = (couple ? f.married : f.singleParent) + Math.round(f.perChild * weight);
    const ded = familyDeduction(full, net, f);
    if (ded > 0) {
      const kids = perChildText(f.perChild);
      items.push(
        item(
          '725',
          'household',
          tr,
          -ded,
          t(
            `${chf(couple ? f.married : f.singleParent)}${kids.en} = ${chf(full)}${net > f.limit ? `; the net income ${chf(net)} is above ${chf(f.limit)}, so less ${chf(f.cut)} per ${chf(f.step)} above it (per ${chf(f.upperStep)} above ${chf(f.upper)})` : ''}: ${chf(ded)}.`,
            `${chf(couple ? f.married : f.singleParent)}${kids.fr} = ${chf(full)}${net > f.limit ? `${NB}; le revenu net ${chf(net)} dépasse ${chf(f.limit)}, d’où ${chf(f.cut)} de moins par tranche de ${chf(f.step)} au-delà (de ${chf(f.upperStep)} au-delà de ${chf(f.upper)})` : ''}${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  } else if (fam.counted.length) {
    notes.add(notes.unsupported, NOTE.familyConflict);
  }

  // Wealth (410 to 445, 610).
  const wealthItems: Item[] = [];
  if (movableValue > 0) {
    wealthItems.push(
      wealthItem(
        '410',
        valueTr,
        movableValue,
        t(
          `Tax value on 31 December of the accounts and securities: ${chf(movableValue)}.`,
          `Valeur fiscale au 31 décembre des titres et autres placements${NB}: ${chf(movableValue)}.`,
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
  asset('420', [hh.cash], 1);
  asset('430', [hh.vehicles], 1);
  asset('435', [hh.lifeInsuranceValue], 1);
  if (input.furnitureInsurance) {
    const tr = new Trace();
    const insured = total(tr, [input.furnitureInsurance]);
    const fu = tr.p(A.furniture);
    const share = shareFranc(insured, fu.shareBp);
    const deduction = couple ? fu.married : fu.single;
    if (share > deduction) {
      if (A.furniture.floorOnly) notes.add(notes.unsupported, NOTE.furniture2026);
      else {
        wealthItems.push(
          wealthItem(
            '440',
            tr,
            share - deduction,
            t(
              `30 % of the fire insurance value ${chf(insured)} (${chf(share)}) less ${chf(deduction)}: ${chf(share - deduction)}.`,
              `30${NB}% de la valeur d’assurance incendie ${chf(insured)} (${chf(share)}) moins ${chf(deduction)}${NB}: ${chf(share - deduction)}.`,
            ),
          ),
        );
      }
    }
  } else if (!input.furnitureWithin) notes.add(notes.assumptions, NOTE.furnitureNotGiven);
  asset('445', [hh.otherAssets], 1);
  asset('610', [hh.debts], -1);

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
    canton: 'VD' as const,
    taxYear: input.taxYear,
    commune: communeRef(input.taxYear, input.commune, input.communePart),
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
  const order = Object.keys(RUBRICS).sort();
  const byForm = (x: Item, y: Item) => order.indexOf(x.code) - order.indexOf(y.code);
  items.sort(byForm);
  const wealthOrder = Object.keys(WEALTH_RUBRICS).sort();
  wealthItems.sort((x, y) => wealthOrder.indexOf(x.code) - wealthOrder.indexOf(y.code));
  try {
    const icc = assess({
      taxYear: input.taxYear,
      commune: input.commune,
      ...(input.communePart !== undefined ? { communePart: input.communePart } : {}),
      family: fam.family,
      partsSources: fam.sources,
      incomeItems: items,
      wealthItems,
    });
    if (partsOf(fam.family) !== icc.parts) throw new Error('parts');
    const unverified = [NOTE.rounding, ...notes.unverified];
    if (P.amounts.yearDays.carriedFrom) unverified.push(NOTE.guide2026);

    // The federal tax, on the guide's worksheet (./ifd.ts): the same income lines, the federal
    // deductions. Who counts the children follows the same child support rule (circular 30).
    const support = fam.childSources.length ? input.childSupport : undefined;
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
        children: fam.counted.map((c): FederalChild => ({
          weight: c.weight,
          livesWithYou: c.livesWithYou,
          ...(c.child.under14 !== undefined ? { under14: c.child.under14 } : {}),
          ...(c.child.childcare ? { childcare: c.child.childcare } : {}),
        })),
        childSources: federalChildSources,
        wealthIncome: movableIncome,
      },
      people.map((p) => ({
        input: p,
        salaries: items.filter((i) => i.person === p.id && (i.code === '100' || i.code === '105')),
      })),
    );
    const ifd = federal.ifd;
    for (const x of federal.notes.notCounted) notes.add(notes.notCounted, x);
    return {
      ...base,
      ...summary([...allLines({ icc, ifd })], [...items, ...(ifd?.items ?? []), ...wealthItems]),
      notCounted: notes.notCounted,
      unsupported: [...federal.notes.unsupported],
      icc,
      ifd,
      total: ifd ? icc.taxes.total.amount + ifd.tax.amount : null,
      unverifiedRules: [...unverified, ...federal.notes.unverified],
      limits: bothTaxes(notes.limits, federal.notes.limits),
    };
  } catch (e) {
    if (!(e instanceof VdUnsupported)) throw e;
    notes.add(notes.unsupported, e.note);
    return unsupported();
  }
}

/** ESTV circular 30 on the taxation of spouses and the family: separated parents, the scales. */
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';
/** Deductions in full in both taxes: buy-ins paid directly, the costs of the securities, alimony. */
const IN_FULL = new Set(['320', '490', '630']);

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
export function allLines(r: Pick<VdTaxResult, 'icc'> & { ifd?: VdTaxResult['ifd'] }): Line[] {
  const f = r.ifd;
  const federal: Line[] = f
    ? [
        ...f.items,
        f.grossIncome,
        f.intermediateIncome1,
        f.intermediateIncome2,
        f.netIncome,
        f.socialDeductions,
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
    x.incomeBeforeModest,
    x.intermediateIncome,
    x.taxableIncome,
    x.rateIncome,
    ...x.wealth.items,
    x.wealth.grossWealth,
    x.wealth.taxableWealth,
    x.taxes.incomeBase,
    x.taxes.incomeReduction,
    x.taxes.cantonalIncome,
    x.taxes.communalIncome,
    x.taxes.wealthBase,
    x.taxes.cantonalWealth,
    x.taxes.communalWealth,
    x.taxes.total,
    ...federal,
  ];
}

/** For the sources test: the cited rules this module applies. */
export const COMPUTE_RULES = (y: VdEngineInput['taxYear']) => [
  parts(y),
  sharedChildren(y),
  familySituation(y),
  personalTax(),
];
