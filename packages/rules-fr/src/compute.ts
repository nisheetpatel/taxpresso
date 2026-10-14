// The one entry point: computeReturn(input) gives the lines of the Fribourg return by code and
// person, the totals and the cantonal, communal and (on request) church tax, each line explained with
// its sources. First stage here (household figures to the lines of the return, every cap, floor,
// threshold and taper of the Fribourg documents, in the order of the guide's codes), second stage in
// ./assess.ts (lines to taxes). The same two stages, with the same names, as packages/rules-vd,
// rules-zh and rules-be.
import {
  answered,
  chf,
  donationDeduction,
  flatProfessional,
  mealsDeduction,
  medicalDeduction,
  pillar3a as federalPillar3a,
  roundFranc,
  Trace,
  type Amount,
} from '@taxpresso/rules-ch';
import { assess, communeOf, communeRef, FrInputError, FrUnsupported, subtotals } from './assess.js';
import { parishOf, type FrParish } from './communes.js';
import { ESTIMATE_TEXT, NOTE } from './explain.js';
import {
  childrenAtCharge,
  communeMove,
  familyRate,
  familySituation,
  sharedCustody,
} from './law.js';
import { frParamsFor, type FrYearParams } from './params.js';
import { RUBRICS, WEALTH_RUBRICS, type RubricCode, type WealthCode } from './rubrics.js';
import {
  carCost,
  childAmounts,
  prorated,
  sideJobFlat,
  tapered,
  twoEarnerDeduction,
} from './rules.js';
import type {
  EmploymentInput,
  FrEngineInput,
  FrTaxResult,
  Item,
  ItemPerson,
  Line,
  PersonInput,
  Text,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = '\u00a0';
/** 10000 -> "10’000", the Swiss way. */
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '’');
/** Centimes per km as francs: 70 -> "0.70". */
const perKm = (c: number) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;

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

function wealthItem(code: WealthCode, tr: Trace, amount: number, how: Text): Item {
  const r = WEALTH_RUBRICS[code];
  tr.src(r.source);
  return { code, person: 'household', ...tr.line(amount, r.label, how) };
}

/** Sum of amounts read into a trace, to the franc (the return takes whole francs). */
function total(tr: Trace, amounts: readonly (Amount | undefined)[]): number {
  return roundFranc(amounts.reduce((s, a) => s + tr.a(a), 0));
}

const given = (value: number) =>
  t(`As given: ${chf(value)}.`, `Tel que donné${NB}: ${chf(value)}.`);

interface Salary {
  /** Box 11: box 8 less boxes 9 and 10, to the franc (code 1.110 or 1.120). */
  net: number;
  /** The net salary before the box 10.2 buy-ins, the base of the flat shares (guide p. 26). */
  base: number;
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
    base: roundFranc(Math.max(0, gross - social - fund)),
    gross,
    social,
    tr,
  };
}

/** Travel to work (2.110) before the cap, and how it was found (no final full stop). */
function travel(
  P: FrYearParams,
  p: PersonInput,
  main: readonly EmploymentInput[],
  tr: Trace,
  notes: Notes,
): { cost: number; how: Text } {
  const A = P.amounts;
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
  const yearDays = tr.p(A.yearDays);
  const vehicle = mode?.by === 'car' || mode?.by === 'motorbike';
  if (vehicle && mode.transitUsable === false) {
    // No usable public transport: per km, there and back each working day.
    if (!mode.kmOneWay || !mode.days) {
      notes.add(notes.notCounted, NOTE.drivingDetails);
      return none(t('travel: not counted', `transport${NB}: non compté`));
    }
    if (mode.days > yearDays) notes.add(notes.assumptions, NOTE.daysCapped);
    const days = Math.min(mode.days, yearDays);
    const v = tr.p(A.vehicle);
    if (mode.by === 'car') {
      const cost = carCost(mode.kmOneWay, days, v.car);
      const km = mode.kmOneWay * 2 * days;
      return {
        cost,
        how: t(
          `travel ${chf(cost)} (car, no usable public transport: ${mode.kmOneWay} km x 2 x ${days} days = ${thousands(km)} km, CHF ${perKm(v.car[0]![1])} a km up to ${thousands(v.car[0]![0])} km, CHF ${perKm(v.car[1]![1])} for the next ${thousands(v.car[1]![0] - v.car[0]![0])}, CHF ${perKm(v.car[2]![1])} above)`,
          `transport ${chf(cost)} (voiture, sans transports publics utilisables${NB}: ${mode.kmOneWay} km x 2 x ${days} jours = ${thousands(km)} km, CHF ${perKm(v.car[0]![1])} par km jusqu’à ${thousands(v.car[0]![0])} km, CHF ${perKm(v.car[1]![1])} pour les ${thousands(v.car[1]![0] - v.car[0]![0])} suivants, CHF ${perKm(v.car[2]![1])} au-delà)`,
        ),
      };
    }
    const cost = roundFranc(mode.kmOneWay * 2 * days * v.motorbikePerKm);
    return {
      cost,
      how: t(
        `travel ${chf(cost)} (motorbike, no usable public transport: ${mode.kmOneWay} km x 2 x ${days} days x CHF ${perKm(v.motorbikePerKm)})`,
        `transport ${chf(cost)} (motocycle, sans transports publics utilisables${NB}: ${mode.kmOneWay} km x 2 x ${days} jours x CHF ${perKm(v.motorbikePerKm)})`,
      ),
    };
  }
  if (mode?.by === 'bike') {
    // A bike, a moped or a yellow-plate motorbike: a flat amount a year, cut for fewer days.
    const year = tr.p(A.bikePerYear);
    const cost =
      mode.days !== undefined && mode.days < yearDays ? prorated(year, mode.days, yearDays) : year;
    if (cost !== year) notes.add(notes.assumptions, NOTE.partYear);
    return {
      cost,
      how: t(
        `travel ${chf(cost)} (bike, moped or yellow-plate motorbike: ${chf(year)} a year${cost !== year ? `, ${mode.days} of ${yearDays} days` : ''})`,
        `transport ${chf(cost)} (vélo, cyclomoteur ou motocycle à plaque jaune${NB}: ${chf(year)} par an${cost !== year ? `, ${mode.days} jours sur ${yearDays}` : ''})`,
      ),
    };
  }
  // Public transport: what it cost; a car or a motorbike when public transport could be used: what
  // public transport would have cost (fr-na-deductions-frais-professionnels art. 3 al. 2).
  if (!mode && !p.commuteCost)
    return none(t('travel: nothing given', `transport${NB}: rien d’indiqué`));
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
  /** Net salaries (main and side job): the income of a gainful activity. */
  earned: number;
  /** Professional costs (2.110 to 2.140). */
  costs: number;
  /** Receives AVS or AI pensions (code 3.110). */
  avs: boolean;
}

function personItems(P: FrYearParams, p: PersonInput, items: Item[], notes: Notes): PersonFigures {
  const A = P.amounts;
  const main = (p.employments ?? []).filter((e) => !e.side);
  const side = (p.employments ?? []).filter((e) => e.side);
  const mainSalary = salary(main);
  const sideSalary = salary(side);
  const salaryHow = (net: number) =>
    t(
      `Gross salary less social and pension fund contributions and buy-ins (salary certificate boxes 8 - 9 - 10 = box 11): ${chf(net)}.`,
      `Salaire brut moins cotisations sociales, cotisations et rachats de prévoyance (certificat de salaire, chiffres 8 - 9 - 10 = chiffre 11)${NB}: ${chf(net)}.`,
    );
  if (main.length) {
    items.push(item('1.110', p.id, mainSalary.tr, mainSalary.net, salaryHow(mainSalary.net)));
  }
  if (side.length) {
    items.push(item('1.120', p.id, sideSalary.tr, sideSalary.net, salaryHow(sideSalary.net)));
  }

  // Professional costs of the main job (2.110, 2.120, 2.130).
  let costs = 0;
  if (main.length) {
    const trTravel = new Trace().with(mainSalary.tr);
    const tv = travel(P, p, main, trTravel, notes);
    if (tv.cost > 0) {
      const max = trTravel.p(A.travelMax);
      const v = Math.min(tv.cost, max);
      const how =
        v < tv.cost
          ? t(
              `${tv.how.en}; at most ${chf(max)} a year: ${chf(v)}.`,
              `${tv.how.fr}${NB}; au plus ${chf(max)} par an${NB}: ${chf(v)}.`,
            )
          : t(`${tv.how.en}.`, `${tv.how.fr}.`);
      items.push(item('2.110', p.id, trTravel, -v, how));
      costs += v;
    }

    if (p.commuteMode?.by === 'home') {
      notes.add(notes.assumptions, NOTE.workFromHome);
    } else if ((p.mealDays ?? 0) > 0) {
      const tr = new Trace();
      tr.a({ value: 0, facts: p.mealFacts ?? [] });
      const m = tr.p(A.meals);
      const canteen = main.some((e) => e.canteen);
      const days = p.mealDays ?? 0;
      const meals = mealsDeduction(days, canteen, m);
      const [perDay, perYear] = canteen ? [m.halfPerDay, m.halfPerYear] : [m.perDay, m.perYear];
      if (meals > 0) {
        items.push(
          item(
            '2.120',
            p.id,
            tr,
            -meals,
            t(
              `${days} days of lunch away from home x ${chf(perDay)}${canteen ? ' (half: canteen or meal vouchers, box G)' : ''}, at most ${chf(perYear)} a year: ${chf(meals)}.`,
              `${days} jours de repas hors du domicile x ${chf(perDay)}${canteen ? ` (moitié${NB}: cantine ou bons de repas, case G)` : ''}, au plus ${chf(perYear)} par an${NB}: ${chf(meals)}.`,
            ),
          ),
        );
        costs += meals;
      }
    }

    const trOther = new Trace().with(mainSalary.tr);
    const flatP = trOther.p(A.professionalFlat);
    if (mainSalary.base > 0 && mainSalary.base < flatP.min) {
      notes.add(notes.unsupported, NOTE.lowSalary);
    } else if (mainSalary.base > 0) {
      const flat = flatProfessional(mainSalary.base, flatP);
      let other = flat;
      let otherHow = t(
        `3 % of the net salary ${chf(mainSalary.base)} (box 11, with any box 10.2 buy-ins), at least ${chf(flatP.min)}, at most ${chf(flatP.max)}: ${chf(flat)}.`,
        `3${NB}% du salaire net ${chf(mainSalary.base)} (chiffre 11, rachats du chiffre 10.2 compris), au moins ${chf(flatP.min)}, au plus ${chf(flatP.max)}${NB}: ${chf(flat)}.`,
      );
      if (p.otherProfessionalCosts) {
        const actual = total(trOther, [p.otherProfessionalCosts]);
        if (actual > flat) {
          other = actual;
          otherHow = t(`Actual costs: ${chf(actual)}.`, `Frais effectifs${NB}: ${chf(actual)}.`);
          notes.add(notes.assumptions, NOTE.actualCosts);
        }
      }
      if (other === flat) notes.add(notes.assumptions, NOTE.fullYear);
      items.push(item('2.130', p.id, trOther, -other, otherHow));
      costs += other;
    }
  }

  // A side job (2.140): 20 % of its net salary, between the minimum and the maximum.
  if (side.length) {
    const tr = new Trace().with(sideSalary.tr);
    const sp = tr.p(A.sideJobFlat);
    const flat = sideJobFlat(sideSalary.base, sp);
    if (flat > 0) {
      items.push(
        item(
          '2.140',
          p.id,
          tr,
          -flat,
          t(
            `20 % of the side job’s net salary ${chf(sideSalary.base)}, at least ${chf(sp.min)} but never more than that salary, at most ${chf(sp.max)}: ${chf(flat)}.`,
            `20${NB}% du salaire net de l’activité accessoire ${chf(sideSalary.base)}, au moins ${chf(sp.min)} mais jamais plus que ce salaire, au plus ${chf(sp.max)}${NB}: ${chf(flat)}.`,
          ),
        ),
      );
      costs += flat;
    }
  }

  // Allowances, pensions and alimony of the person.
  if (p.unemploymentBenefits || p.replacementIncome) {
    const tr = new Trace();
    const unemployment = total(tr, [p.unemploymentBenefits]);
    const other = total(tr, [p.replacementIncome]);
    if (unemployment + other > 0) {
      items.push(
        item(
          '1.510',
          p.id,
          tr,
          unemployment + other,
          t(
            `As given: unemployment benefits ${chf(unemployment)}, other allowances ${chf(other)}; the return splits them over codes 1.510 to 1.530.`,
            `Tel que donné${NB}: indemnités de chômage ${chf(unemployment)}, autres indemnités ${chf(other)}${NB}; la déclaration les répartit sous les codes 1.510 à 1.530.`,
          ),
        ),
      );
    }
  }
  const own = (code: RubricCode, amount: Amount | undefined, note?: Text) => {
    if (!amount) return 0;
    const tr = new Trace();
    const value = total(tr, [amount]);
    if (value <= 0) return 0;
    if (note) notes.add(notes.assumptions, note);
    items.push(item(code, p.id, tr, value, given(value)));
    return value;
  };
  const avs = own('3.110', p.pensionAvs) > 0;
  own('3.120', p.pensionOccupational, NOTE.pensions);
  own('3.140', p.pensionOther, NOTE.pensions);
  own('3.150', p.alimonyReceived);

  // Pillar 3a (4.130): the federal limits the LICD adopts.
  const hasPensionFund =
    p.hasPensionFund ??
    main.some((e) => (e.pensionFund?.value ?? 0) > 0 || (e.pensionBuyIn?.value ?? 0) > 0);
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
  if (r3a.deduction && r3a.deduction.amount < 0) {
    items.push(item('4.130', p.id, r3a.deduction.trace, r3a.deduction.amount, r3a.deduction.how));
  }

  // Pension fund buy-ins paid directly (4.140).
  if (p.pensionBuyIn) {
    const tr = new Trace();
    const paid = total(tr, [p.pensionBuyIn]);
    if (paid > 0) items.push(item('4.140', p.id, tr, -paid, given(paid)));
  }

  // Professional training (4.420).
  if (p.trainingCosts) {
    const tr = new Trace();
    const paid = total(tr, [p.trainingCosts]);
    const cap = tr.p(A.training);
    const ded = Math.min(paid, cap);
    if (ded > 0) {
      items.push(
        item(
          '4.420',
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

  return { id: p.id, earned: mainSalary.net + sideSalary.net, costs, avs };
}

/** A child at your charge, as the deductions read it. */
interface CountedChild {
  livesWithYou: boolean;
  young: boolean;
  under14?: boolean;
  childcare?: Amount;
}

/**
 * Who counts the children, and whether the household pays the rate of half its income (a married
 * couple, or a single parent living with a child at their charge: LICD art. 37 al. 3).
 */
function familyOf(
  input: FrEngineInput,
  couple: boolean,
  notes: Notes,
): { family: boolean; counted: CountedChild[]; sources: string[] } {
  const counted: CountedChild[] = [];
  const sources = [childrenAtCharge().source, familySituation().source];
  for (const ch of input.children ?? []) {
    if (ch.age === 'adult') {
      notes.add(notes.unsupported, NOTE.adultChild);
      continue;
    }
    const child: CountedChild = {
      livesWithYou: ch.livesWithYou ?? true,
      young: ch.age === 'young',
      ...(ch.under14 !== undefined ? { under14: ch.under14 } : {}),
      ...(ch.childcare ? { childcare: ch.childcare } : {}),
    };
    if (ch.custody === 'full') {
      counted.push(child);
      continue;
    }
    if (couple) {
      notes.add(notes.unsupported, NOTE.marriedShared);
      continue;
    }
    sources.push(sharedCustody().source);
    if (input.childSupport === 'receives') {
      counted.push(child);
      notes.add(notes.assumptions, NOTE.childSupportReceived);
      notes.add(notes.unverified, NOTE.sharedCustody);
    } else if (input.childSupport === 'pays') {
      notes.add(notes.assumptions, NOTE.childSupportPaid);
      notes.add(notes.unverified, NOTE.sharedCustody);
      if (ch.childcare) notes.add(notes.unsupported, NOTE.childcarePays);
    } else if (input.childSupport === 'none') notes.add(notes.unsupported, NOTE.sharedNoSupport);
    else notes.add(notes.unsupported, NOTE.childSupport);
  }
  if (!couple && counted.length) notes.add(notes.assumptions, NOTE.childrenAtCharge);
  const family = couple || counted.some((c) => c.livesWithYou);
  if (family) sources.push(familyRate().source);
  return { family, counted, sources: [...new Set(sources)] };
}

/** The church tax's parish, when asked for; undefined when not asked for or nobody is a member. */
function churchOf(
  input: FrEngineInput,
  couple: boolean,
  notes: Notes,
): FrParish | null | undefined {
  const church = input.church;
  if (!church) {
    notes.add(notes.notCounted, NOTE.churchNotAsked);
    return undefined;
  }
  const members = couple ? [church.p1 ?? 'none', church.p2 ?? 'none'] : [church.p1 ?? 'none'];
  const first = members[0]!;
  if (members.some((m) => m !== first)) {
    notes.add(notes.unsupported, NOTE.churchMixed);
    return undefined;
  }
  if (first === 'none') return null;
  const parish = parishOf(communeOf(input.taxYear, input.commune), first, church.parish);
  if (parish === 'parish') {
    notes.add(notes.unsupported, NOTE.parish);
    return undefined;
  }
  return parish;
}

export function computeReturn(input: FrEngineInput): FrTaxResult {
  const P = frParamsFor(input.taxYear);
  const A = P.amounts;
  const commune = communeOf(input.taxYear, input.commune);
  const notes = new Notes();
  const couple = input.civilStatus === 'married';
  const people = [...input.people].sort((a, b) => a.id.localeCompare(b.id));
  if (!people.some((p) => p.id === 'p1')) throw new FrInputError('people must include p1');
  if (!couple && people.some((p) => p.id === 'p2')) {
    throw new FrInputError('p2 is the spouse: only for a married couple');
  }
  if (new Set(people.map((p) => p.id)).size !== people.length) {
    throw new FrInputError('each person once');
  }
  const hh = input.household ?? {};
  if (commune.rate === null) notes.add(notes.unsupported, NOTE.communes2026);
  if (people.some((p) => p.selfEmploymentProfit)) notes.add(notes.unsupported, NOTE.selfEmployed);
  notes.add(notes.assumptions, NOTE.wholeYear);
  notes.add(notes.assumptions, NOTE.healthFlat);
  if (input.movable?.length) notes.add(notes.assumptions, NOTE.listedSecurities);
  notes.add(notes.notCounted, NOTE.dependents);

  const fam = familyOf(input, couple, notes);
  const parish = churchOf(input, couple, notes);
  const ref = communeRef(input.taxYear, input.commune);
  const early = (): FrTaxResult => ({
    canton: 'FR',
    taxYear: input.taxYear,
    commune: ref,
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
  });
  // Something every later line rests on is missing or not supported (the commune's coefficient, a
  // question about the family or the church, self-employment): the result says that first.
  if (notes.unsupported.length) return early();

  const items: Item[] = [];
  const figures = people.map((p) => personItems(P, p, items, notes));
  const children = fam.counted;

  // Both spouses work (2.510): from the lower income, at most that income after its costs.
  if (couple && figures.length === 2 && figures.every((f) => f.earned > 0)) {
    const tr = new Trace();
    const amount = tr.p(A.twoEarner);
    const lowerLeft = Math.min(...figures.map((f) => f.earned - f.costs));
    const ded = twoEarnerDeduction(lowerLeft, amount);
    if (ded > 0) {
      items.push(
        item(
          '2.510',
          'household',
          tr,
          -ded,
          t(
            `${chf(amount)} from the lower income, at most that income after its professional costs (${chf(lowerLeft)}): ${chf(ded)}.`,
            `${chf(amount)} sur le revenu le plus bas, au plus ce revenu après ses frais d’acquisition (${chf(lowerLeft)})${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // Health and accident insurance (4.110): a flat amount per insured person, less subsidies.
  {
    const tr = new Trace();
    const h = tr.p(A.health);
    const adults = couple ? 2 : 1;
    const young = children.filter((c) => c.young).length;
    const kids = children.length - young;
    const flat = adults * h.adult + young * h.young + kids * h.child;
    const subsidy = total(tr, [hh.healthSubsidy]);
    if (fam.sources.includes(sharedCustody().source)) tr.src(sharedCustody().source);
    const ded = Math.max(0, flat - subsidy);
    const parts = [
      `${adults} x ${chf(h.adult)}`,
      ...(young ? [`${young} x ${chf(h.young)}`] : []),
      ...(kids ? [`${kids} x ${chf(h.child)}`] : []),
    ].join(' + ');
    if (ded > 0) {
      items.push(
        item(
          '4.110',
          'household',
          tr,
          -ded,
          t(
            `Flat amounts: ${parts} = ${chf(flat)}${subsidy ? `, less the premium subsidy ${chf(subsidy)}` : ''}: ${chf(ded)}.`,
            `Montants forfaitaires${NB}: ${parts} = ${chf(flat)}${subsidy ? `, moins les subsides ${chf(subsidy)}` : ''}${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // Life and other insurance premiums (4.120): at most the limit.
  if (hh.lifeInsurancePremiums) {
    const tr = new Trace();
    const paid = total(tr, [hh.lifeInsurancePremiums]);
    const lim = tr.p(A.lifeInsurance);
    const cap = couple ? lim.married : lim.other;
    const ded = Math.min(paid, cap);
    if (ded > 0) {
      items.push(
        item(
          '4.120',
          'household',
          tr,
          -ded,
          t(
            `Premiums ${chf(paid)}, at most ${chf(cap)}: ${chf(ded)}.`,
            `Primes ${chf(paid)}, au plus ${chf(cap)}${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // Accounts and securities (3.210): income and value; a minor child's too.
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
        '3.210',
        'household',
        incomeTr,
        movableIncome,
        t(
          `Gross income of the accounts and securities: ${chf(movableIncome)}.`,
          `Rendement brut des titres et autres placements de capitaux${NB}: ${chf(movableIncome)}.`,
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
  householdGiven('3.150', [hh.childSupportReceived], 1);
  householdGiven('3.410', [hh.otherIncome], 1);

  // Interest on savings (4.150): at most the limit, never more than the income of the accounts.
  if (hh.savingsInterest) {
    const tr = new Trace().with(incomeTr);
    const interest = total(tr, [hh.savingsInterest]);
    if (interest > movableIncome) {
      throw new FrInputError(
        'household.savingsInterest is part of the income of accounts and securities (movable).',
      );
    }
    const lim = tr.p(A.savingsInterest);
    const cap = couple ? lim.married : lim.other;
    const ded = Math.min(interest, cap);
    if (interest > 0 && movableIncome === 0) notes.add(notes.notCounted, NOTE.savingsNoIncome);
    if (ded > 0) {
      items.push(
        item(
          '4.150',
          'household',
          tr,
          -ded,
          t(
            `Interest on savings ${chf(interest)}, at most ${chf(cap)} and never more than the income of the accounts and securities: ${chf(ded)}.`,
            `Intérêts de capitaux d’épargne ${chf(interest)}, au plus ${chf(cap)} et jamais plus que le rendement des titres et placements${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // Private debt interest (4.210): up to the gross income from wealth plus a fixed amount.
  if (hh.debtInterest) {
    const tr = new Trace().with(incomeTr);
    const paid = total(tr, [hh.debtInterest]);
    const extra = tr.p(A.debtInterestExtra);
    const cap = movableIncome + extra;
    const ded = Math.min(paid, cap);
    if (ded > 0) {
      items.push(
        item(
          '4.210',
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
  householdGiven('4.320', [hh.bankFees], -1);
  householdGiven('4.340', [hh.alimonyPaid, hh.childSupportPaid], -1);

  // Childcare (4.380): per child under 14 living with you; married, both must work.
  const withCare = children.filter((c) => c.childcare);
  if (withCare.length) {
    const working = couple
      ? figures.length === 2 && figures.every((f) => f.earned > 0)
      : figures.some((f) => f.earned > 0);
    if (!working) notes.add(notes.notCounted, NOTE.childcareWork);
    else {
      const tr = new Trace();
      const cap = tr.p(A.childcare);
      let ded = 0;
      const parts: string[] = [];
      for (const ch of withCare) {
        if (ch.under14 === false || !ch.livesWithYou) continue;
        if (ch.under14 === undefined) notes.add(notes.assumptions, NOTE.under14);
        const one = Math.min(total(tr, [ch.childcare]), cap);
        ded += one;
        parts.push(chf(one));
      }
      if (ded > 0) {
        items.push(
          item(
            '4.380',
            'household',
            tr,
            -ded,
            t(
              `Per child under 14 living with you, what was paid, at most ${chf(cap)}: ${parts.join(' + ')} = ${chf(ded)}.`,
              `Par enfant de moins de 14 ans vivant avec vous, ce qui a été payé, au plus ${chf(cap)}${NB}: ${parts.join(' + ')} = ${chf(ded)}.`,
            ),
          ),
        );
      }
    }
  }

  // Political parties (4.410): at most one amount.
  if (hh.politicalParty) {
    const tr = new Trace();
    const paid = total(tr, [hh.politicalParty]);
    const max = tr.p(A.party);
    const ded = Math.min(paid, max);
    if (couple && paid > max) notes.add(notes.unverified, NOTE.partyCouple);
    if (ded > 0) {
      items.push(
        item(
          '4.410',
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
  if (couple && people.filter((p) => p.trainingCosts).length === 2) {
    const both = items.filter((i) => i.code === '4.420').reduce((s, i) => s - i.amount, 0);
    if (both > A.training.value) notes.add(notes.unverified, NOTE.trainingCouple);
  }

  // Medical costs (5.110) and donations (5.120), on the net income (4.910).
  const net = subtotals(items).net;
  if (hh.medicalCosts) {
    const tr = new Trace();
    const costs = total(tr, [hh.medicalCosts]);
    const m = medicalDeduction(costs, net, tr.p(A.medicalThresholdBp));
    if (m.deduction > 0) {
      items.push(
        item(
          '5.110',
          'household',
          tr,
          -m.deduction,
          t(
            `${chf(costs)} less 5 % of the net income ${chf(net)} (${chf(m.threshold)}): ${chf(m.deduction)}.`,
            `${chf(costs)} moins 5${NB}% du revenu net ${chf(net)} (${chf(m.threshold)})${NB}: ${chf(m.deduction)}.`,
          ),
        ),
      );
    } else if (costs > 0) notes.add(notes.notCounted, NOTE.medicalBelow);
  }
  if (hh.donations) {
    const tr = new Trace();
    const gifts = total(tr, [hh.donations]);
    const d = tr.p(A.donations);
    const r = donationDeduction(gifts, net, d.shareBp, d.min);
    if (r.deduction > 0) {
      items.push(
        item(
          '5.120',
          'household',
          tr,
          -r.deduction,
          t(
            `${chf(gifts)}, at most 20 % of the net income ${chf(net)} (${chf(r.cap)}): ${chf(r.deduction)}.`,
            `${chf(gifts)}, au plus 20${NB}% du revenu net ${chf(net)} (${chf(r.cap)})${NB}: ${chf(r.deduction)}.`,
          ),
        ),
      );
    } else if (gifts > 0) notes.add(notes.notCounted, NOTE.donationsMin);
  }

  // Children (6.110), on the net income (4.910).
  if (children.length) {
    const tr = new Trace().src(...fam.sources);
    const c = tr.p(A.children);
    const amounts = childAmounts(c, children.length, net);
    const ded = amounts.reduce((s, a) => s + a, 0);
    const limit = c.limit + (children.length - 1) * c.perChild;
    items.push(
      item(
        '6.110',
        'household',
        tr,
        -ded,
        net > limit
          ? t(
              `${children.length} child${children.length === 1 ? '' : 'ren'}: the net income ${chf(net)} is above ${chf(limit)}, so ${chf(c.cut)} less per child for each started ${chf(c.step)} above it, never below the minimum: ${amounts.map(chf).join(' + ')} = ${chf(ded)}.`,
              `${children.length} enfant${children.length === 1 ? '' : 's'}${NB}: le revenu net ${chf(net)} dépasse ${chf(limit)}, d’où ${chf(c.cut)} de moins par enfant pour chaque tranche de ${chf(c.step)} commencée au-delà, jamais moins que le minimum${NB}: ${amounts.map(chf).join(' + ')} = ${chf(ded)}.`,
            )
          : t(
              `${children.length} child${children.length === 1 ? '' : 'ren'}, net income ${chf(net)} at most ${chf(limit)}: ${amounts.map(chf).join(' + ')} = ${chf(ded)}.`,
              `${children.length} enfant${children.length === 1 ? '' : 's'}, revenu net ${chf(net)} jusqu’à ${chf(limit)}${NB}: ${amounts.map(chf).join(' + ')} = ${chf(ded)}.`,
            ),
      ),
    );
  }

  // Modest income (7.110), on the income after the social deductions (6.910).
  {
    const social = subtotals(items).social;
    const tr = new Trace();
    const m = tr.p(A.modest);
    const charges = couple || children.length > 0;
    const avsKinds = [...new Set(figures.map((f) => f.avs))];
    const pick = (avs: boolean) =>
      avs ? (charges ? m.avsCharges : m.avsSingle) : charges ? m.charges : m.single;
    const amounts = avsKinds.map((avs) => tapered(pick(avs), social));
    if (amounts.length > 1 && amounts[0] !== amounts[1]) {
      notes.add(notes.unsupported, NOTE.avsCouple);
    } else {
      const avs = avsKinds.length === 1 && avsKinds[0] === true;
      const p = pick(avs);
      const ded = amounts[0] ?? 0;
      if (ded > 0) {
        const who = t(
          `${avs ? 'AVS/AI beneficiary' : 'Not an AVS/AI beneficiary'}, ${charges ? 'with charges (married or with children)' : 'without charges'}`,
          `${avs ? 'Bénéficiaire de prestations AVS/AI' : 'Pas de prestations AVS/AI'}, ${charges ? 'avec charge d’entretien (marié ou avec enfants)' : 'sans charge d’entretien'}`,
        );
        items.push(
          item(
            '7.110',
            'household',
            tr,
            -ded,
            social > p.limit
              ? t(
                  `${who.en}: ${chf(p.amount)} up to ${chf(p.limit)}; the income ${chf(social)} is above it, so ${chf(p.cut)} less for each started ${chf(p.step)}: ${chf(ded)}.`,
                  `${who.fr}${NB}: ${chf(p.amount)} jusqu’à ${chf(p.limit)}${NB}; le revenu ${chf(social)} le dépasse, d’où ${chf(p.cut)} de moins pour chaque tranche de ${chf(p.step)} commencée${NB}: ${chf(ded)}.`,
                )
              : t(
                  `${who.en}: the income ${chf(social)} is at most ${chf(p.limit)}: ${chf(ded)}.`,
                  `${who.fr}${NB}: le revenu ${chf(social)} ne dépasse pas ${chf(p.limit)}${NB}: ${chf(ded)}.`,
                ),
          ),
        );
      }
    }
  }

  // Wealth (3.210 to 3.530, 4.210), then the social deduction on wealth (7.110).
  const wealthItems: Item[] = [];
  if (movableValue > 0) {
    wealthItems.push(
      wealthItem(
        '3.210',
        valueTr,
        movableValue,
        t(
          `Tax value on 31 December of the accounts and securities: ${chf(movableValue)}.`,
          `Valeur imposable au 31 décembre des titres et autres placements de capitaux${NB}: ${chf(movableValue)}.`,
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
  asset('3.230', [hh.cash], 1);
  asset('3.510', [hh.vehicles], 1);
  asset('3.520', [hh.lifeInsuranceValue], 1);
  asset('3.530', [hh.otherAssets], 1);
  asset('4.210', [hh.debts], -1);
  {
    const netWealth = wealthItems.reduce((s, i) => s + i.amount, 0);
    const tr = new Trace().src(...fam.sources);
    const w = tr.p(A.wealthDeduction);
    const p = fam.family ? w.family : w.single;
    const full = tapered(p, netWealth);
    const ded = Math.min(full, Math.max(0, netWealth));
    if (ded > 0) {
      const who = fam.family
        ? t('Married couple or single parent', 'Couple marié ou famille monoparentale')
        : t('Single person', 'Personne seule');
      wealthItems.push(
        wealthItem(
          '7.110',
          tr,
          -ded,
          t(
            `${who.en}: ${chf(p.amount)} up to a net wealth of ${chf(p.limit)}, ${chf(p.cut)} less for each started ${chf(p.step)} above; net wealth ${chf(netWealth)}: ${chf(full)}${ded < full ? `, never more than the net wealth: ${chf(ded)}` : ''}.`,
            `${who.fr}${NB}: ${chf(p.amount)} jusqu’à une fortune nette de ${chf(p.limit)}, ${chf(p.cut)} de moins pour chaque tranche de ${chf(p.step)} commencée au-delà${NB}; fortune nette ${chf(netWealth)}${NB}: ${chf(full)}${ded < full ? `, jamais plus que la fortune nette${NB}: ${chf(ded)}` : ''}.`,
          ),
        ),
      );
    }
  }

  const allLines: Line[] = [...items, ...wealthItems];
  const base = {
    canton: 'FR' as const,
    taxYear: input.taxYear,
    commune: ref,
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
  const unsupported = (): FrTaxResult => ({
    ...base,
    unsupported: notes.unsupported,
    icc: null,
    total: null,
    unverifiedRules: [],
  });
  if (notes.unsupported.length) return unsupported();

  // In the order of the codes, person 1 before person 2 (the sort is stable).
  items.sort((x, y) => x.code.localeCompare(y.code));
  wealthItems.sort((x, y) => x.code.localeCompare(y.code));
  try {
    const icc = assess({
      taxYear: input.taxYear,
      commune: input.commune,
      family: fam.family,
      familySources: fam.sources,
      parish: parish ?? null,
      incomeItems: items,
      wealthItems,
    });
    return {
      ...base,
      unsupported: [],
      icc,
      total: icc.taxes.total.amount,
      unverifiedRules: [NOTE.rounding, ...notes.unverified],
    };
  } catch (e) {
    if (!(e instanceof FrUnsupported)) throw e;
    notes.add(notes.unsupported, e.note);
    return unsupported();
  }
}

/** Every computed line of a result, for checks and for the explanation tree. */
export function allLines(r: Pick<FrTaxResult, 'icc'>): Line[] {
  if (!r.icc) return [];
  const x = r.icc;
  return [
    ...x.items,
    x.grossIncome,
    x.netIncome,
    x.incomeAfterCosts,
    x.socialIncome,
    x.taxableIncome,
    x.rateIncome,
    ...x.wealth.items,
    x.wealth.grossWealth,
    x.wealth.netWealth,
    x.wealth.taxableWealth,
    x.taxes.incomeBase,
    x.taxes.cantonalIncome,
    x.taxes.communalIncome,
    x.taxes.wealthBase,
    x.taxes.cantonalWealth,
    x.taxes.communalWealth,
    ...(x.taxes.churchIncome ? [x.taxes.churchIncome] : []),
    ...(x.taxes.churchWealth ? [x.taxes.churchWealth] : []),
    x.taxes.total,
  ];
}

/** For the sources test: the cited rules this module applies. */
export const COMPUTE_RULES = () => [
  childrenAtCharge(),
  familySituation(),
  sharedCustody(),
  familyRate(),
  communeMove(),
];
