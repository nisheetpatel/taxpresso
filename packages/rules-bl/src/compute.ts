// The one entry point: computeReturn(input) gives the lines of the Basel-Landschaft return by code
// and person, the totals and the state, communal and (on request) church tax, each line explained
// with its sources. First stage here (household figures to the lines of the return, every cap,
// floor and taper of the Basel-Landschaft documents, in the order of the return's codes), second
// stage in ./assess.ts (lines to taxes). The same two stages, with the same names, as
// packages/rules-fr, rules-bs and rules-be.
import {
  answered,
  chf,
  mealsDeduction,
  pillar3a as federalPillar3a,
  roundFranc,
  Trace,
  type Amount,
} from '@taxpresso/rules-ch';
import { assess, BlInputError, communeOf, communeRef, subtotals } from './assess.js';
import { ESTIMATE_TEXT, NOTE } from './explain.js';
import {
  childcareShared,
  childRule,
  communeAtYearEnd,
  donationsRule,
  familySituation,
  insuranceFlat,
  medicalRule,
  pensionerRule,
  sharedCustody,
  splittingRule,
  wealthAllowance,
} from './law.js';
import { blParamsFor, type BlTaxYear, type BlYearParams } from './params.js';
import {
  INCOME,
  PERSON_CODES,
  RUBRICS,
  WEALTH_RUBRICS,
  type RubricCode,
  type WealthCode,
} from './rubrics.js';
import { pensionerDeduction, sideJobFlat, twoEarnerDeduction, vehicleCost } from './rules.js';
import type {
  BlEngineInput,
  BlTaxResult,
  EmploymentInput,
  Item,
  ItemPerson,
  Line,
  PensionKind,
  PersonInput,
  Text,
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
  /** Box 11: box 8 less boxes 9 and 10, to the franc (code 100/105 or 110/115). */
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

/** Travel to work (500/505) before the cap, and how it was found (no final full stop). */
function travel(
  P: BlYearParams,
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
    // No usable public transport: per km, there and back each working day.
    if (!mode.kmOneWay || !mode.days) {
      notes.add(notes.notCounted, NOTE.drivingDetails);
      return none(t('travel: not counted', `transport${NB}: non compté`));
    }
    const rate = mode.by === 'car' ? tr.p(v).carPerKm : tr.p(v).motorbikePerKm;
    const cost = vehicleCost(mode.kmOneWay, mode.days, rate);
    return {
      cost,
      how: t(
        `travel ${chf(cost)} (${mode.by === 'car' ? 'car' : 'motorbike'}, no usable public transport: ${mode.kmOneWay} km x 2 x ${mode.days} days x CHF ${perKm(rate)})`,
        `transport ${chf(cost)} (${mode.by === 'car' ? 'voiture' : 'motocycle'}, sans transports publics utilisables${NB}: ${mode.kmOneWay} km x 2 x ${mode.days} jours x CHF ${perKm(rate)})`,
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
  // public transport would have cost (Verordnung § 3 Abs. 1 lit. a Ziff. 1 and 3).
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
  /** Net salaries and allowances (100 to 115, 260/270): the earned income for 680. */
  earned: number;
  /** Receives an AHV or IV pension (200/205). */
  pensioner: boolean;
  pensionKind?: PensionKind;
  /** Training paid, capped per person (650 is the couple's sum). */
  training: { amount: number; tr: Trace; how: Text } | null;
  /** Alimony received for oneself (310 is the household's line). */
  alimony: { amount: number; tr: Trace } | null;
}

function personItems(P: BlYearParams, p: PersonInput, items: Item[], notes: Notes): PersonFigures {
  const A = P.amounts;
  const id = p.id;
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
    items.push(
      item(PERSON_CODES.main[id], id, mainSalary.tr, mainSalary.net, salaryHow(mainSalary.net)),
    );
  }
  if (side.length) {
    items.push(
      item(PERSON_CODES.side[id], id, sideSalary.tr, sideSalary.net, salaryHow(sideSalary.net)),
    );
  }

  // Professional costs of the main job (500 to 525).
  if (main.length) {
    const trTravel = new Trace().with(mainSalary.tr);
    const tv = travel(P, p, main, trTravel, notes);
    if (tv.cost > 0) {
      const max = trTravel.p(A.travel).max;
      const v = Math.min(tv.cost, max);
      const how =
        v < tv.cost
          ? t(
              `${tv.how.en}; at most ${chf(max)} a year: ${chf(v)}.`,
              `${tv.how.fr}${NB}; au plus ${chf(max)} par an${NB}: ${chf(v)}.`,
            )
          : t(`${tv.how.en}.`, `${tv.how.fr}.`);
      items.push(item(PERSON_CODES.travel[id], id, trTravel, -v, how));
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
            PERSON_CODES.meals[id],
            id,
            tr,
            -meals,
            t(
              `${days} days of lunch away from home x ${chf(perDay)}${canteen ? ' (half: canteen or meal vouchers, box G)' : ''}, at most ${chf(perYear)} a year: ${chf(meals)}.`,
              `${days} jours de repas hors du domicile x ${chf(perDay)}${canteen ? ` (moitié${NB}: cantine ou bons de repas, case G)` : ''}, au plus ${chf(perYear)} par an${NB}: ${chf(meals)}.`,
            ),
          ),
        );
      }
    }

    // The canton's flat amount, plus the other costs proven (the form adds them up).
    const tr = new Trace().with(mainSalary.tr);
    const flat = tr.p(A.otherFlat);
    const proven = p.otherProfessionalCosts ? total(tr, [p.otherProfessionalCosts]) : 0;
    notes.add(notes.assumptions, NOTE.fullYear);
    items.push(
      item(
        PERSON_CODES.other[id],
        id,
        tr,
        -(flat + proven),
        proven
          ? t(
              `The canton’s flat amount ${chf(flat)} plus the costs proven ${chf(proven)}: ${chf(flat + proven)}.`,
              `Le forfait du canton ${chf(flat)} plus les frais prouvés ${chf(proven)}${NB}: ${chf(flat + proven)}.`,
            )
          : t(
              `The canton’s flat amount: ${chf(flat)}.`,
              `Le forfait du canton${NB}: ${chf(flat)}.`,
            ),
      ),
    );
  }

  // A side job (530/535): 20 % of its net income, between the minimum and the maximum.
  if (side.length) {
    const tr = new Trace().with(sideSalary.tr);
    const sp = tr.p(A.sideJob);
    const flat = sideJobFlat(sideSalary.net, sp);
    if (flat > 0) {
      items.push(
        item(
          PERSON_CODES.sideCosts[id],
          id,
          tr,
          -flat,
          sideSalary.net < sp.min
            ? t(
                `The side job’s net income ${chf(sideSalary.net)} is under ${chf(sp.min)}: only that amount.`,
                `Le revenu net de l’activité accessoire ${chf(sideSalary.net)} est inférieur à ${chf(sp.min)}${NB}: seulement ce montant.`,
              )
            : t(
                `20 % of the side job’s net income ${chf(sideSalary.net)}, at least ${chf(sp.min)}, at most ${chf(sp.max)}: ${chf(flat)}.`,
                `20${NB}% du revenu net de l’activité accessoire ${chf(sideSalary.net)}, au moins ${chf(sp.min)}, au plus ${chf(sp.max)}${NB}: ${chf(flat)}.`,
              ),
        ),
      );
    }
  }

  // Allowances (260/270) and pensions (200 to 235).
  let allowances = 0;
  if (p.unemploymentBenefits || p.replacementIncome) {
    const tr = new Trace();
    const unemployment = total(tr, [p.unemploymentBenefits]);
    const other = total(tr, [p.replacementIncome]);
    allowances = unemployment + other;
    if (allowances > 0) {
      items.push(
        item(
          PERSON_CODES.allowances[id],
          id,
          tr,
          allowances,
          t(
            `As given: unemployment benefits ${chf(unemployment)}, other allowances ${chf(other)}.`,
            `Tel que donné${NB}: indemnités de chômage ${chf(unemployment)}, autres indemnités ${chf(other)}.`,
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
    items.push(item(code, id, tr, value, given(value)));
    return value;
  };
  const pensioner = own(PERSON_CODES.avs[id], p.pensionAvs) > 0;
  own(PERSON_CODES.occupational[id], p.pensionOccupational, NOTE.pensions);
  own(PERSON_CODES.otherPension[id], p.pensionOther, NOTE.pensions);

  // Pension fund buy-ins paid directly (600/605).
  if (p.pensionBuyIn) {
    const tr = new Trace();
    const paid = total(tr, [p.pensionBuyIn]);
    if (paid > 0) items.push(item(PERSON_CODES.buyIn[id], id, tr, -paid, given(paid)));
  }

  // Pillar 3a (610/615): the federal limits the StG adopts (§ 29 Abs. 1 lit. dter).
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

  // Professional training (650 is the couple's sum): at most per person.
  let training: PersonFigures['training'] = null;
  if (p.trainingCosts) {
    const tr = new Trace();
    const paid = total(tr, [p.trainingCosts]);
    const cap = tr.p(A.training);
    const amount = Math.min(paid, cap);
    if (amount > 0) {
      training = {
        amount,
        tr,
        how: t(
          `${id === 'p1' ? 'Person 1' : 'Person 2'} paid ${chf(paid)}, at most ${chf(cap)}: ${chf(amount)}`,
          `${id === 'p1' ? 'Personne 1' : 'Personne 2'} a payé ${chf(paid)}, au plus ${chf(cap)}${NB}: ${chf(amount)}`,
        ),
      };
    }
  }

  let alimony: PersonFigures['alimony'] = null;
  if (p.alimonyReceived) {
    const tr = new Trace();
    const amount = total(tr, [p.alimonyReceived]);
    if (amount > 0) alimony = { amount, tr };
  }

  return {
    id,
    earned: mainSalary.net + sideSalary.net + allowances,
    pensioner,
    ...(p.pensionKind ? { pensionKind: p.pensionKind } : {}),
    training,
    alimony,
  };
}

/** A child as the deductions read it. */
interface CountedChild {
  /** Gets the child reduction (and raises 630, gives Vollsplitting and the higher allowance). */
  reduction: boolean;
  /** Its childcare counts here (640). */
  childcare: boolean;
  under14?: boolean;
  amount?: Amount;
}

/**
 * Who counts the children, and whether the household has Vollsplitting: a married couple, or a
 * parent alone with a child who gets the child reduction (StG § 34 Abs. 2 and 4).
 */
function familyOf(
  input: BlEngineInput,
  couple: boolean,
  notes: Notes,
): { splitting: boolean; children: CountedChild[]; sources: string[] } {
  const y = input.taxYear;
  const children: CountedChild[] = [];
  const sources = [familySituation().source];
  for (const ch of input.children ?? []) {
    const lives = ch.livesWithYou ?? true;
    const base = {
      ...(ch.under14 !== undefined ? { under14: ch.under14 } : {}),
      ...(ch.childcare ? { amount: ch.childcare } : {}),
    };
    let counts: boolean;
    if (ch.custody === 'full' || couple) {
      if (ch.custody === 'shared') {
        notes.add(notes.unsupported, NOTE.marriedShared);
        continue;
      }
      counts = lives;
      if (!lives) notes.add(notes.assumptions, NOTE.childNotWithYou);
    } else {
      sources.push(sharedCustody().source);
      if (input.childSupport === 'receives') {
        counts = lives;
        notes.add(notes.assumptions, NOTE.childSupportReceived);
      } else if (input.childSupport === 'pays') {
        counts = false;
        notes.add(notes.assumptions, NOTE.childSupportPaid);
      } else if (input.childSupport === 'none') {
        if (input.mainUpkeep === undefined) {
          notes.add(notes.unsupported, NOTE.mainUpkeep);
          continue;
        }
        counts = input.mainUpkeep && lives;
        notes.add(notes.assumptions, counts ? NOTE.mainUpkeepYes : NOTE.mainUpkeepNo);
      } else {
        notes.add(notes.unsupported, NOTE.childSupport);
        continue;
      }
      if (ch.childcare && lives) {
        notes.add(notes.assumptions, NOTE.childcareShared);
        sources.push(childcareShared().source);
      }
    }
    if (counts && ch.ownIncome) {
      counts = false;
      notes.add(notes.assumptions, NOTE.childOwnIncome);
    }
    children.push({ reduction: counts, childcare: lives, ...base });
  }
  const counted = children.filter((c) => c.reduction);
  if (counted.length) {
    notes.add(notes.assumptions, NOTE.childrenAtCharge);
    sources.push(childRule(y).source);
  }
  const splitting = couple || counted.length > 0;
  if (splitting) sources.push(splittingRule(y).source, wealthAllowance(y).source);
  return { splitting, children, sources: [...new Set(sources)] };
}

/**
 * The church tax's rate, when asked for: the Roman Catholic rate of the commune; null when nobody is
 * a member; undefined when not asked for, or not computed (the result says why).
 */
function churchOf(input: BlEngineInput, couple: boolean, notes: Notes): number | null | undefined {
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
  const rates = communeOf(input.taxYear, input.commune).church;
  if (!rates) {
    notes.add(notes.unsupported, NOTE.church2025);
    return undefined;
  }
  if (first !== 'catholic') {
    notes.add(notes.unsupported, NOTE.churchRules);
    return undefined;
  }
  notes.add(notes.unverified, NOTE.churchBase);
  return rates.catholic;
}

export function computeReturn(input: BlEngineInput): BlTaxResult {
  const P = blParamsFor(input.taxYear);
  const A = P.amounts;
  const y: BlTaxYear = P.taxYear;
  const ref = communeRef(y, input.commune); // throws for an unknown commune
  const notes = new Notes();
  const couple = input.civilStatus === 'married';
  const people = [...input.people].sort((a, b) => a.id.localeCompare(b.id));
  if (!people.some((p) => p.id === 'p1')) throw new BlInputError('people must include p1');
  if (!couple && people.some((p) => p.id === 'p2')) {
    throw new BlInputError('p2 is the spouse: only for a married couple');
  }
  if (new Set(people.map((p) => p.id)).size !== people.length) {
    throw new BlInputError('each person once');
  }
  const hh = input.household ?? {};
  if (people.some((p) => p.selfEmploymentProfit)) notes.add(notes.unsupported, NOTE.selfEmployed);
  notes.add(notes.assumptions, NOTE.wholeYear);
  notes.add(notes.assumptions, NOTE.insuranceFlat);
  if (input.movable?.length) notes.add(notes.assumptions, NOTE.listedSecurities);
  notes.add(notes.notCounted, NOTE.dependents);
  notes.add(notes.notCounted, NOTE.fireLevy);

  const fam = familyOf(input, couple, notes);
  const churchRate = churchOf(input, couple, notes);
  const base = {
    canton: 'BL' as const,
    taxYear: y,
    commune: ref,
    ifd: null,
  };
  const result = (lines: readonly Line[]): BlTaxResult => ({
    ...base,
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
  });
  // Something every later line rests on is missing or not supported (a question about the family
  // or the church, self-employment): the result says that first.
  if (notes.unsupported.length) return result([]);

  const items: Item[] = [];
  const figures = people.map((p) => personItems(P, p, items, notes));
  const counted = fam.children.filter((c) => c.reduction).length;

  // Income of the household: accounts and securities (300), alimony (310), child support (320),
  // other income (380).
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
        '300',
        'household',
        incomeTr,
        movableIncome,
        t(
          `Gross income of the accounts and securities: ${chf(movableIncome)}.`,
          `Rendement brut des avoirs et des titres${NB}: ${chf(movableIncome)}.`,
        ),
      ),
    );
  }
  const alimony = figures.filter((f) => f.alimony);
  if (alimony.length) {
    const tr = new Trace().with(...alimony.map((f) => f.alimony!.tr));
    const amount = alimony.reduce((s, f) => s + f.alimony!.amount, 0);
    items.push(item('310', 'household', tr, amount, given(amount)));
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
  householdGiven('320', [hh.childSupportReceived], 1);
  householdGiven('380', [hh.otherIncome], 1);

  // Private debt interest (555): up to the gross income from wealth plus a fixed amount.
  if (hh.debtInterest) {
    const tr = new Trace().with(incomeTr);
    const paid = total(tr, [hh.debtInterest]);
    const extra = tr.p(A.debtInterestExtra);
    const cap = movableIncome + extra;
    const ded = Math.min(paid, cap);
    if (ded > 0) {
      items.push(
        item(
          '555',
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
  householdGiven('570', [hh.alimonyPaid], -1);
  householdGiven('575', [hh.childSupportPaid], -1);

  // Insurance premiums and savings interest (620/625, 630): the maximum, whatever was paid.
  {
    const tr = new Trace().src(insuranceFlat().source);
    const ins = tr.p(A.insurance);
    const amount = couple ? ins.married : ins.other;
    items.push(
      item(
        couple ? '620' : '625',
        'household',
        tr,
        -amount,
        couple
          ? t(
              `Married couple: the flat maximum ${chf(amount)}.`,
              `Couple marié${NB}: le maximum forfaitaire ${chf(amount)}.`,
            )
          : t(`The flat maximum ${chf(amount)}.`, `Le maximum forfaitaire ${chf(amount)}.`),
      ),
    );
    if (counted) {
      const trc = new Trace().src(insuranceFlat().source, ...fam.sources);
      const per = trc.p(A.insurance).perChild;
      items.push(
        item(
          '630',
          'household',
          trc,
          -counted * per,
          t(
            `${counted} child${counted === 1 ? '' : 'ren'} with the child reduction x ${chf(per)}: ${chf(counted * per)}.`,
            `${counted} enfant${counted === 1 ? '' : 's'} donnant droit à la réduction x ${chf(per)}${NB}: ${chf(counted * per)}.`,
          ),
        ),
      );
    }
  }

  // Childcare (640): per child under 14 living with you, while you work (married: both).
  const withCare = fam.children.filter((c) => c.amount);
  if (withCare.length) {
    const working = couple
      ? figures.length === 2 && figures.every((f) => f.earned > 0)
      : figures.some((f) => f.earned > 0);
    if (!working) notes.add(notes.notCounted, NOTE.childcareWork);
    else {
      const tr = new Trace().src(...fam.sources);
      const cap = tr.p(A.childcare);
      let ded = 0;
      const parts: string[] = [];
      for (const ch of withCare) {
        if (ch.under14 === false || !ch.childcare) continue;
        if (ch.under14 === undefined) notes.add(notes.assumptions, NOTE.under14);
        const one = Math.min(total(tr, [ch.amount]), cap);
        ded += one;
        parts.push(chf(one));
      }
      if (ded > 0) {
        items.push(
          item(
            '640',
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

  // Professional training (650): each person's, capped, added up.
  const trained = figures.filter((f) => f.training);
  if (trained.length) {
    const tr = new Trace().with(...trained.map((f) => f.training!.tr));
    tr.p(A.training);
    const amount = trained.reduce((s, f) => s + f.training!.amount, 0);
    items.push(
      item(
        '650',
        'household',
        tr,
        -amount,
        t(
          `${trained.map((f) => f.training!.how.en).join('; ')}. Together: ${chf(amount)}.`,
          `${trained.map((f) => f.training!.how.fr).join(`${NB}; `)}. Ensemble${NB}: ${chf(amount)}.`,
        ),
      ),
    );
  }
  householdGiven('655', [hh.bankFees], -1);

  // Both spouses work (680): the lower earned income, at most a fixed amount.
  if (couple && figures.length === 2 && figures.every((f) => f.earned > 0)) {
    const tr = new Trace();
    const max = tr.p(A.twoEarner);
    const lower = Math.min(...figures.map((f) => f.earned));
    const ded = twoEarnerDeduction(lower, max);
    if (lower < max) notes.add(notes.unverified, NOTE.twoEarnerLow);
    items.push(
      item(
        '680',
        'household',
        tr,
        -ded,
        t(
          `The lower earned income (${chf(lower)}), at most ${chf(max)}: ${chf(ded)}.`,
          `Le revenu d’activité le plus bas (${chf(lower)}), au plus ${chf(max)}${NB}: ${chf(ded)}.`,
        ),
      ),
    );
  }

  // Illness costs (720): what you bear, in full. Political parties (735): at most an amount.
  // Donations (738): in full.
  if (hh.medicalCosts) {
    const tr = new Trace().src(medicalRule(y).source);
    const costs = total(tr, [hh.medicalCosts]);
    if (costs > 0) {
      items.push(
        item(
          '720',
          'household',
          tr,
          -costs,
          t(
            `The costs you bore yourself, in full (no threshold for the state tax): ${chf(costs)}.`,
            `Les frais restés à votre charge, en entier (pas de seuil pour l’impôt cantonal)${NB}: ${chf(costs)}.`,
          ),
        ),
      );
    }
  }
  if (hh.politicalParty) {
    const tr = new Trace();
    const paid = total(tr, [hh.politicalParty]);
    const max = tr.p(A.party);
    const ded = Math.min(paid, max);
    if (couple && paid > max) notes.add(notes.unverified, NOTE.partyCouple);
    if (ded > 0) {
      items.push(
        item(
          '735',
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
  if (hh.donations) {
    const tr = new Trace().src(donationsRule(y).source);
    const gifts = total(tr, [hh.donations]);
    if (gifts > 0) {
      items.push(
        item(
          '738',
          'household',
          tr,
          -gifts,
          t(
            `Donations to tax-exempt bodies, with no upper limit in Basel-Landschaft: ${chf(gifts)}.`,
            `Dons à des institutions exonérées, sans plafond à Bâle-Campagne${NB}: ${chf(gifts)}.`,
          ),
        ),
      );
    }
  }

  // Wealth (800 to 891), then the allowance (900 or 905).
  const wealthItems: Item[] = [];
  if (movableValue > 0) {
    wealthItems.push(
      wealthItem(
        '800',
        valueTr,
        movableValue,
        t(
          `Tax value on 31 December of the accounts and securities: ${chf(movableValue)}.`,
          `Valeur imposable au 31 décembre des avoirs et des titres${NB}: ${chf(movableValue)}.`,
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
  asset('805', [hh.cash], 1);
  asset('810', [hh.lifeInsuranceValue], 1);
  asset('815', [hh.vehicles], 1);
  asset('825', [hh.otherAssets], 1);
  asset('891', [hh.debts], -1);
  {
    const tr = new Trace().src(...fam.sources, wealthAllowance(y).source);
    const free = tr.p(A.wealthFree);
    const amount = fam.splitting ? free.family : free.other;
    wealthItems.push(
      wealthItem(
        fam.splitting ? '900' : '905',
        tr,
        -amount,
        fam.splitting
          ? t(
              `Married couple or single parent: ${chf(amount)}.`,
              `Couple marié ou famille monoparentale${NB}: ${chf(amount)}.`,
            )
          : t(`Everyone else: ${chf(amount)}.`, `Autres contribuables${NB}: ${chf(amount)}.`),
      ),
    );
  }

  // The pensioners' deduction (770, from 2026 771 for IV pensions), on the total income (499).
  const pensioners = figures.filter((f) => f.pensioner);
  if (pensioners.length && (!couple || pensioners.length === 2)) {
    const kinds = new Set(pensioners.map((f) => f.pensionKind));
    let kind: PensionKind | undefined = 'ahv';
    if (y !== 2025) {
      if (kinds.has(undefined)) notes.add(notes.unsupported, NOTE.pensionKind);
      else if (kinds.size > 1) notes.add(notes.unsupported, NOTE.pensionKindMixed);
      kind = kinds.size === 1 ? [...kinds][0] : undefined;
    }
    const taxableWealth = Math.max(
      0,
      Math.floor(wealthItems.reduce((s, i) => s + i.amount, 0) / 100) * 100,
    );
    if (kind && !notes.unsupported.length) {
      const tr = new Trace().src(pensionerRule(y).source);
      const pl = tr.p(A.pensioner);
      const gross = subtotals(items).gross;
      tr.from(...items.filter((i) => INCOME.has(i.code)));
      if (taxableWealth >= P.wealth.value.exemptBelow) {
        notes.add(notes.notCounted, NOTE.pensionerWealth);
      } else {
        const r = pensionerDeduction(pl[kind], pl, gross, couple);
        if (r.deduction > 0) {
          const code = y === 2025 || kind === 'ahv' ? '770' : '771';
          const [label, labelFr] =
            y === 2025
              ? ['AHV or IV', 'AVS ou AI']
              : kind === 'ahv'
                ? ['AHV', 'AVS']
                : ['IV', 'AI'];
          items.push(
            item(
              code,
              'household',
              tr,
              -r.deduction,
              gross <= r.max
                ? t(
                    `${couple ? 'Both spouses receive' : 'You receive'} an ${label} pension; total income ${chf(gross)}, at most the maximum ${couple ? 'couple’s' : 'simple'} pension ${chf(r.max)}: ${r.percent} % of it, ${chf(r.deduction)}.`,
                    `${couple ? 'Les deux conjoints reçoivent' : 'Vous recevez'} une rente ${labelFr}${NB}; total des revenus ${chf(gross)}, au plus la rente maximale ${couple ? 'pour couple' : 'simple'} ${chf(r.max)}${NB}: ${r.percent}${NB}% de celui-ci, ${chf(r.deduction)}.`,
                  )
                : t(
                    `${couple ? 'Both spouses receive' : 'You receive'} an ${label} pension; total income ${chf(gross)} is above the maximum ${couple ? 'couple’s' : 'simple'} pension ${chf(r.max)}, so ${couple ? 60 : 40} % less 1 % for each started ${chf(couple ? pl.coupleStep : pl.singleStep)} above it: ${r.percent} %, ${chf(r.deduction)}.`,
                    `${couple ? 'Les deux conjoints reçoivent' : 'Vous recevez'} une rente ${labelFr}${NB}; le total des revenus ${chf(gross)} dépasse la rente maximale ${couple ? 'pour couple' : 'simple'} ${chf(r.max)}, d’où ${couple ? 60 : 40}${NB}% moins 1${NB}% par tranche de ${chf(couple ? pl.coupleStep : pl.singleStep)} commencée au-delà${NB}: ${r.percent}${NB}%, ${chf(r.deduction)}.`,
                  ),
            ),
          );
        }
      }
    }
  } else if (couple && pensioners.length === 1) {
    notes.add(notes.assumptions, NOTE.pensionerCouple);
  }

  const allLinesSoFar: Line[] = [...items, ...wealthItems];
  if (notes.unsupported.length) return result(allLinesSoFar);

  // In the order of the codes (the sort is stable: person 1 before person 2 on a shared code).
  items.sort((x, z) => x.code.localeCompare(z.code));
  wealthItems.sort((x, z) => x.code.localeCompare(z.code));
  const icc = assess({
    taxYear: y,
    commune: input.commune,
    splitting: fam.splitting,
    familySources: fam.sources,
    children: counted,
    churchRate: churchRate ?? null,
    incomeItems: items,
    wealthItems,
  });
  const f = P.income.value;
  const unverified = [NOTE.rounding, ...notes.unverified];
  if (icc.splitting && icc.rateIncome.amount < f.min * 100 && icc.taxes.incomeTariffTax.amount) {
    unverified.push(NOTE.splittingMinimum);
  }
  if (icc.taxes.childReduction.amount < 0 && icc.taxes.normalIncome.amount === 0 && counted) {
    notes.add(notes.assumptions, NOTE.childReductionCapped);
  }
  const lines = allLines({ icc });
  return {
    ...result(lines),
    unsupported: [],
    icc,
    total: icc.taxes.total.amount,
    unverifiedRules: unverified,
  };
}

/** Every computed line of a result, for checks and for the explanation tree. */
export function allLines(r: Pick<BlTaxResult, 'icc'>): Line[] {
  if (!r.icc) return [];
  const x = r.icc;
  return [
    ...x.items,
    x.grossIncome,
    x.netIncome,
    x.totalDeductions,
    x.taxableIncome,
    x.rateIncome,
    ...x.wealth.items,
    x.wealth.grossWealth,
    x.wealth.netWealth,
    x.wealth.taxableWealth,
    x.taxes.incomeTariffTax,
    x.taxes.childReduction,
    x.taxes.normalIncome,
    x.taxes.cantonalIncome,
    x.taxes.communalIncome,
    x.taxes.cantonalWealth,
    x.taxes.communalWealth,
    ...(x.taxes.church ? [x.taxes.church] : []),
    x.taxes.total,
  ];
}

/** For the sources test: the cited rules this module applies. */
export const COMPUTE_RULES = (y: BlTaxYear) => [
  familySituation(),
  sharedCustody(),
  childcareShared(),
  communeAtYearEnd(y),
  insuranceFlat(),
  medicalRule(y),
  donationsRule(y),
  pensionerRule(y),
];
