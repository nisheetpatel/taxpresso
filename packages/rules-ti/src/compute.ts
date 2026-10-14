// The one entry point: computeReturn(input) gives the lines of the Ticino return (Modulo 1) by
// number and person, the subtotals and the cantonal and communal tax, and the federal tax the
// authority derives from the same return (./ifd.ts), each line explained with its sources. First
// stage here (household figures to the lines of the return, every cap, flat amount and threshold of
// the Ticino documents, in the order of the form, with the limits each applied for the final check,
// and Modulo 4 line by line), second stage in ./assess.ts (lines to taxes). The same two stages,
// with the same names, as packages/rules-bs, rules-vd, rules-zh and rules-be.
import {
  answered,
  chf,
  donationDeduction,
  medicalDeduction,
  ifdParamsFor,
  pillar3a as federalPillar3a,
  roundFranc,
  Trace,
  type Amount,
  type LimitApplied,
} from '@taxpresso/rules-ch';
import { assess, communeOf, communeRef, subtotals, TiInputError, TiUnsupported } from './assess.js';
import { ESTIMATE_TEXT, NOTE } from './explain.js';
import { federalReturn, type FederalChild } from './ifd.js';
import {
  childRule,
  familyTaxation,
  professionalRule,
  salaryRule,
  tariffRule,
  wealthRule,
} from './law.js';
import { tiParamsFor, type TiTaxYear, type TiYearParams } from './params.js';
import {
  INCOME,
  MODULO4,
  MODULO4_CODES,
  PERSON_CODES,
  RUBRICS,
  WEALTH_RUBRICS,
  type RubricCode,
  type WealthCode,
} from './rubrics.js';
import {
  avsExemption,
  debtInterestDeduction,
  drivingCost,
  insuranceCap,
  mealsCost,
  otherFlat,
  twoEarnerDeduction,
} from './rules.js';
import { categoryTax } from './tariff.js';
import type {
  ChildInput,
  EmploymentInput,
  Item,
  ItemPerson,
  Line,
  PersonInput,
  Text,
  TiEngineInput,
  TiIccResult,
  TiTaxResult,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';

/** A sentence's first letter in capitals. */
const capital = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}`;

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

/** An item for this line and person; its label and the form's page come from the catalogue. */
function item(code: RubricCode, person: ItemPerson, tr: Trace, amount: number, how: Text): Item {
  const r = RUBRICS[code];
  tr.src(r.source);
  return { code, person, ...tr.line(amount, r.label, how) };
}

/** A line of Modulo 4, a part of 9.1 or 9.2 (./rubrics.ts, MODULO4). */
function m4Item(code: string, person: ItemPerson, tr: Trace, amount: number, how: Text): Item {
  const r = MODULO4[code]!;
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
  /** Box 8 less boxes 9 and 10.1, to the franc: the net salary of cifra 1.1 or 1.2. */
  net: number;
  gross: number;
  social: number;
  /** Box 10.2, the buy-ins taken from the salary: they go on 10.3. */
  buyIn: number;
  /** Box 10.1 or 10.2 above zero. */
  pension: boolean;
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
    net: roundFranc(Math.max(0, gross - social - fund)),
    gross,
    social,
    buyIn: roundFranc(buyIn),
    pension: fund > 0 || buyIn > 0,
    tr,
  };
}

/** The line of Modulo 4 the way to work goes on: 2.1, 2.2 or 2.3. */
type Way = 'transit' | 'vehicle' | 'bike';

/** Travel to work (Modulo 4, 2) and how it was found (no final full stop). */
function travel(
  P: TiYearParams,
  p: PersonInput,
  employments: readonly EmploymentInput[],
  tr: Trace,
  notes: Notes,
): { cost: number; how: Text; way?: Way } {
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
    if (!p.commuteCost) {
      notes.add(notes.notCounted, NOTE.bikeAmount);
      return none(t('travel: not counted', `transport${NB}: non compté`));
    }
    const max = tr.p(A.commute).bikeMax;
    const claimed = total(tr, [p.commuteCost]);
    const cost = Math.min(claimed, max);
    notes.limit('commute', A.commute, MODULO4_CODES.bike[p.id], p.id, claimed, max, cost);
    return {
      cost,
      way: 'bike',
      how: t(
        `travel by bike or moped ${chf(claimed)}, at most ${chf(max)}: ${chf(cost)}`,
        `transport à vélo ou cyclomoteur ${chf(claimed)}, au plus ${chf(max)}${NB}: ${chf(cost)}`,
      ),
    };
  }
  if ((mode?.by === 'car' || mode?.by === 'motorbike') && mode.transitUsable === false) {
    if (!mode.kmOneWay || !mode.days) {
      notes.add(notes.notCounted, NOTE.drivingDetails);
      return none(t('travel: not counted', `transport${NB}: non compté`));
    }
    if (A.commuteMaxDays === null) {
      notes.add(notes.unsupported, NOTE.drivingDays2026);
      return none(t('travel: not computed', `transport${NB}: non calculé`));
    }
    const maxDays = tr.p(A.commuteMaxDays);
    if (mode.days > maxDays) notes.add(notes.assumptions, NOTE.daysCapped);
    const days = Math.min(mode.days, maxDays);
    const rates = tr.p(A.commute);
    const perKm = mode.by === 'car' ? rates.carPerKm : rates.motorbikePerKm;
    const cost = drivingCost(mode.kmOneWay, days, perKm);
    const what = mode.by === 'car' ? t('car', 'voiture') : t('motorbike', 'moto');
    return {
      cost,
      way: 'vehicle',
      how: t(
        `travel ${chf(cost)} (${what.en}: ${mode.kmOneWay} km x 2 x ${days} days x ${chf(perKm)})`,
        `transport ${chf(cost)} (${what.fr}${NB}: ${mode.kmOneWay} km x 2 x ${days} jours x ${chf(perKm)})`,
      ),
    };
  }
  // Public transport, or a private vehicle where public transport could be used: what the ticket
  // cost or would have cost (decree art. 3 cpv. 1 lett. a and c).
  if (p.commuteCost) {
    const paid = total(tr, [p.commuteCost]);
    return {
      cost: paid,
      way: 'transit',
      how: t(
        `travel ${chf(paid)} (public transport)`,
        `transport ${chf(paid)} (transports publics)`,
      ),
    };
  }
  if (mode) notes.add(notes.notCounted, NOTE.transitDetails);
  return none(t('travel: nothing given', `transport${NB}: rien d’indiqué`));
}

interface PersonFigures {
  id: 'p1' | 'p2';
  /** Net salaries, main and side jobs (1.1 and 1.2). */
  earned: number;
  /** Daily allowances and unemployment benefits (3.4 and 3.5). */
  replacement: number;
  /** Professional costs (9.1/9.2). */
  costs: number;
  /** Paid into a pension fund or pillar 3a in the year. */
  pension: boolean;
  /** AVS and AI pensions (3.2). */
  avs: number;
}

function personItems(
  P: TiYearParams,
  p: PersonInput,
  items: Item[],
  professional: Item[],
  notes: Notes,
): PersonFigures {
  const A = P.amounts;
  const y = P.taxYear;
  const codes = (k: keyof typeof PERSON_CODES) => PERSON_CODES[k][p.id];
  const employments = p.employments ?? [];
  const main = employments.filter((e) => !e.side);
  const side = employments.filter((e) => e.side);
  const mainSalary = salary(main);
  const sideSalary = salary(side);
  const salaryHow = (net: number) =>
    t(
      `Gross salary less the AVS/AI/IPG/AD/AINP and pension fund contributions (salary certificate box 8 less boxes 9 and 10.1): ${chf(net)}.`,
      `Salaire brut moins les cotisations AVS/AI/APG/AC/AANP et de prévoyance (certificat de salaire, case 8 moins cases 9 et 10.1)${NB}: ${chf(net)}.`,
    );
  if (main.length) {
    const tr = new Trace().with(mainSalary.tr).src(salaryRule(y).source);
    items.push(item('1.1', p.id, tr, mainSalary.net, salaryHow(mainSalary.net)));
  }
  if (side.length) {
    const tr = new Trace().with(sideSalary.tr).src(salaryRule(y).source);
    items.push(item('1.2', p.id, tr, sideSalary.net, salaryHow(sideSalary.net)));
  }
  const earned = mainSalary.net + sideSalary.net;

  // Professional costs (9.1/9.2, Modulo 4): travel, meals, and the flat amount for other costs or
  // the actual costs when higher; a side job's own flat amount.
  let costs = 0;
  if (employments.length) {
    const tr = new Trace().with(mainSalary.tr, sideSalary.tr).src(professionalRule(y).source);
    // Each part on its own line of Modulo 4 (its own trace), and all of them on 9.1 or 9.2.
    const part = (key: keyof typeof MODULO4_CODES, pt: Trace, amount: number, how: Text) => {
      tr.with(pt).src(...pt.sources);
      if (amount > 0) {
        const line = new Trace().with(pt).src(...pt.sources, professionalRule(y).source);
        const sentence = t(`${capital(how.en)}.`, `${capital(how.fr)}.`);
        professional.push(m4Item(MODULO4_CODES[key][p.id], p.id, line, -amount, sentence));
      }
    };
    const parts: Text[] = [];
    const tvTr = new Trace();
    const tv = travel(P, p, employments, tvTr, notes);
    part(tv.way ?? 'transit', tvTr, tv.cost, tv.how);
    parts.push(tv.how);
    let meals = 0;
    if (p.commuteMode?.by === 'home') notes.add(notes.assumptions, NOTE.workFromHome);
    else if ((p.mealDays ?? 0) > 0) {
      const mt = new Trace().with(answered(p.mealFacts));
      const m = mt.p(A.meals);
      const canteen = employments.some((e) => e.canteen);
      if (canteen) notes.add(notes.assumptions, NOTE.canteen);
      const [perDay, perYear] = canteen
        ? [m.reducedPerDay, m.reducedPerYear]
        : [m.perDay, m.perYear];
      const days = p.mealDays ?? 0;
      meals = mealsCost(days, perDay, perYear);
      notes.limit('meals', A.meals, MODULO4_CODES.meals[p.id], p.id, days * perDay, perYear, meals);
      const how = t(
        `meals ${days} days x ${chf(perDay)}, at most ${chf(perYear)}: ${chf(meals)}`,
        `repas ${days} jours x ${chf(perDay)}, au plus ${chf(perYear)}${NB}: ${chf(meals)}`,
      );
      part('meals', mt, meals, how);
      parts.push(how);
    }
    let other = 0;
    if (main.length) {
      const ot = new Trace();
      const actual = p.otherProfessionalCosts ? total(ot, [p.otherProfessionalCosts]) : 0;
      const fp = ot.p(A.otherFlat);
      if (actual >= fp.amount) {
        other = actual;
        notes.limit(
          'professional.flat',
          A.otherFlat,
          MODULO4_CODES.otherActual[p.id],
          p.id,
          actual,
          fp.amount,
          other,
          'choice',
        );
        const how = t(
          `other costs, actual ${chf(actual)} (not less than the flat amount ${chf(fp.amount)})`,
          `autres frais, effectifs ${chf(actual)} (pas moins que le forfait ${chf(fp.amount)})`,
        );
        part('otherActual', ot, other, how);
        parts.push(how);
      } else if (p.workRate === undefined) {
        tr.with(ot).src(...ot.sources);
        notes.add(notes.unsupported, NOTE.workRate);
      } else if (p.partYear === true || (p.monthsWorked !== undefined && p.monthsWorked < 12)) {
        tr.with(ot).src(...ot.sources);
        notes.add(notes.unsupported, NOTE.partYear);
      } else {
        if (p.monthsWorked === undefined) notes.add(notes.assumptions, NOTE.fullYear);
        const flat = otherFlat(fp, p.workRate, p.monthsWorked ?? 12);
        other = Math.max(flat, actual);
        if (actual) {
          notes.limit(
            'professional.flat',
            A.otherFlat,
            other === flat ? MODULO4_CODES.otherFlat[p.id] : MODULO4_CODES.otherActual[p.id],
            p.id,
            actual,
            flat,
            other,
            'choice',
          );
        }
        const how =
          other === flat
            ? t(
                `other costs, flat amount ${chf(flat)}${flat < fp.amount ? ` (half of ${chf(fp.amount)}: work rate ${p.workRate} %)` : ''}`,
                `autres frais, forfait ${chf(flat)}${flat < fp.amount ? ` (moitié de ${chf(fp.amount)}${NB}: taux d’activité ${p.workRate}${NB}%)` : ''}`,
              )
            : t(
                `other costs, actual ${chf(actual)} (more than the flat amount ${chf(flat)})`,
                `autres frais, effectifs ${chf(actual)} (plus que le forfait ${chf(flat)})`,
              );
        part(other === flat ? 'otherFlat' : 'otherActual', ot, other, how);
        parts.push(how);
      }
    }
    let sideFlat = 0;
    if (side.length) {
      const st = new Trace();
      sideFlat = st.p(A.sideJobFlat);
      if (sideFlat > sideSalary.net) notes.add(notes.unsupported, NOTE.costsAboveSalary);
      const how = t(
        `side job, flat amount ${chf(sideFlat)}`,
        `activité accessoire, forfait ${chf(sideFlat)}`,
      );
      part('sideFlat', st, sideFlat, how);
      parts.push(how);
    }
    costs = tv.cost + meals + other + sideFlat;
    if (costs > earned) notes.add(notes.unsupported, NOTE.costsAboveSalary);
    if (costs > 0) {
      items.push(
        item(
          codes('professional'),
          p.id,
          tr,
          -costs,
          t(
            `${parts.map((x) => x.en).join('; ')}. Total: ${chf(costs)}.`,
            `${parts.map((x) => x.fr).join(`${NB}; `)}. Total${NB}: ${chf(costs)}.`,
          ),
        ),
      );
    }
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
  own('3.1', [p.pensionOccupational]);
  const avs = own('3.2', [p.pensionAvs]);
  own('3.3', [p.pensionOther], NOTE.lifeAnnuity);
  const unemployment = own('3.4', [p.unemploymentBenefits]);
  const daily = own('3.5', [p.replacementIncome], NOTE.replacement);
  own('3.6', [p.alimonyReceived]);

  // Pension fund buy-ins (box 10.2 and paid directly) and, from 2026, the pillar 3a catch-up (10.3).
  {
    const tr = new Trace().with(mainSalary.tr, sideSalary.tr).src(salaryRule(y).source);
    const direct = p.pensionBuyIn ? total(tr, [p.pensionBuyIn]) : 0;
    const catchUp = p.pillar3aCatchUp && y !== 2025 ? total(tr, [p.pillar3aCatchUp]) : 0;
    const value = mainSalary.buyIn + sideSalary.buyIn + direct + catchUp;
    if (value > 0) {
      const parts = [
        mainSalary.buyIn + sideSalary.buyIn
          ? t(
              `buy-ins on the salary certificate (box 10.2) ${chf(mainSalary.buyIn + sideSalary.buyIn)}`,
              `rachats du certificat de salaire (case 10.2) ${chf(mainSalary.buyIn + sideSalary.buyIn)}`,
            )
          : null,
        direct
          ? t(`buy-ins paid directly ${chf(direct)}`, `rachats versés directement ${chf(direct)}`)
          : null,
        catchUp ? t(`pillar 3a catch-up ${chf(catchUp)}`, `rachat 3a ${chf(catchUp)}`) : null,
      ].filter((x): x is Text => x !== null);
      if (catchUp) tr.src('ch-2026-ifd-instructions-personnes-physiques p. 8');
      items.push(
        item(
          '10.3',
          p.id,
          tr,
          -value,
          t(
            `${parts.map((x) => x.en).join(' + ')}: ${chf(value)}.`,
            `${parts.map((x) => x.fr).join(' + ')}${NB}: ${chf(value)}.`,
          ),
        ),
      );
    }
  }

  // Pillar 3a (11.1/11.2): the federal limits.
  const hasPensionFund = p.hasPensionFund ?? (mainSalary.pension || sideSalary.pension);
  if (p.pillar3aCatchUp && y === 2025) notes.add(notes.unsupported, NOTE.catchUp2025);
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
  for (const l of r3a.limits) {
    notes.limits.push({
      code: codes('pillar3a'),
      person: p.id,
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
  if (r3a.deduction && r3a.deduction.amount < 0) {
    items.push(
      item(codes('pillar3a'), p.id, r3a.deduction.trace, r3a.deduction.amount, r3a.deduction.how),
    );
  }

  // Professional training (15.3/15.4).
  if (p.trainingCosts) {
    const tr = new Trace();
    const paid = total(tr, [p.trainingCosts]);
    const cap = tr.p(A.training);
    const ded = Math.min(paid, cap);
    notes.limit('training', A.training, codes('training'), p.id, paid, cap, ded);
    if (ded > 0) {
      items.push(
        item(
          codes('training'),
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

  const paidPension =
    hasPensionFund ||
    mainSalary.buyIn + sideSalary.buyIn > 0 ||
    (p.pensionBuyIn?.value ?? 0) > 0 ||
    (p.pillar3a?.value ?? 0) > 0 ||
    (p.pillar3aCatchUp?.value ?? 0) > 0;
  return {
    id: p.id,
    earned,
    replacement: unemployment + daily,
    costs,
    pension: paidPension,
    avs,
  };
}

/** The family as Ticino counts it (LT art. 34, 35, 48). */
interface Family {
  /** Child deduction units: 1 a child counted in full, 0.5 a child shared half and half. */
  childUnits: number;
  /** Children for whom the child deduction is claimed, for the insurance cap (art. 32 cpv. 1bis). */
  insuranceChildren: number;
  /** A child shared half and half counts for the insurance cap. */
  halfChildInsurance: boolean;
  tariff: 'single' | 'family';
  /** The family tariff rests on a child in shared custody without child support. */
  sharedTariff: boolean;
  /** Wealth deduction per minor child (35.2): the readings that give the least and the most. */
  minorWealth: { low: number; high: number };
  sources: string[];
}

function family(input: TiEngineInput, P: TiYearParams, couple: boolean, notes: Notes): Family {
  const y = P.taxYear;
  const perMinor = P.amounts.wealthDeductions.value.perMinorChild;
  const sources = [childRule(y).source, familyTaxation(y).source, tariffRule(y).source];
  let childUnits = 0;
  let insuranceChildren = 0;
  let halfChildInsurance = false;
  let living = false;
  let sharedLiving = false;
  const wealth = { low: 0, high: 0 };
  const allow = (minor: boolean | undefined, readings: readonly number[]) => {
    const values = minor === false ? [0] : minor === undefined ? [0, ...readings] : readings;
    wealth.low += Math.min(...values);
    wealth.high += Math.max(...values);
  };
  for (const ch of input.children ?? []) {
    const lives = ch.livesWithYou ?? true;
    const minor = ch.minor ?? (ch.under14 === true ? true : undefined);
    if (ch.custody === 'full') {
      childUnits += 1;
      insuranceChildren += 1;
      if (lives) living = true;
      allow(minor, [perMinor]);
      continue;
    }
    if (couple) {
      notes.add(notes.unsupported, NOTE.marriedShared);
      continue;
    }
    if (input.childSupport === 'receives') {
      notes.add(notes.assumptions, NOTE.receivesSupport);
      childUnits += 1;
      insuranceChildren += 1;
      if (lives) living = true;
      allow(minor, [perMinor]);
    } else if (input.childSupport === 'none') {
      notes.add(notes.assumptions, NOTE.sharedHalf);
      childUnits += 0.5;
      insuranceChildren += 1;
      halfChildInsurance = true;
      if (lives) sharedLiving = true;
      // The law halves the income deduction only (art. 34 cpv. 1 lett. a); art. 48 lett. b gives
      // the wealth deduction to the parent who provides for the child, with no split.
      allow(minor, [perMinor / 2, perMinor]);
    } else if (input.childSupport === 'pays') {
      notes.add(notes.assumptions, NOTE.paysSupport);
      if (lives) notes.add(notes.unsupported, NOTE.paysLiving);
      allow(minor, [0, perMinor]);
    } else {
      notes.add(notes.unsupported, NOTE.childSupport);
    }
  }

  // The tariff (LT art. 35 cpv. 2, 4 and 5).
  const status = input.civilStatus;
  if (status === 'widowed' && input.changedThisYear === undefined) {
    notes.add(notes.unsupported, NOTE.statusChange);
  } else if (status === 'widowed' && input.changedThisYear) {
    notes.add(notes.unsupported, NOTE.widowedThisYear);
  }
  let tariff: 'single' | 'family' = 'single';
  let sharedTariff = false;
  if (couple || living) tariff = 'family';
  else if (sharedLiving) {
    tariff = 'family';
    sharedTariff = true;
  } else if (status === 'divorced' || status === 'separated') {
    if (input.changedThisYear === undefined) notes.add(notes.unsupported, NOTE.statusChange);
    else if (input.changedThisYear) tariff = 'family';
  }
  return {
    childUnits,
    insuranceChildren,
    halfChildInsurance,
    tariff,
    sharedTariff,
    minorWealth: wealth,
    sources: [...new Set(sources)],
  };
}

export function computeReturn(input: TiEngineInput): TiTaxResult {
  const P = tiParamsFor(input.taxYear);
  const A = P.amounts;
  const y: TiTaxYear = P.taxYear;
  communeOf(y, input.commune);
  const notes = new Notes();
  const couple = input.civilStatus === 'married';
  const people = [...input.people].sort((a, b) => a.id.localeCompare(b.id));
  if (!people.some((p) => p.id === 'p1')) throw new TiInputError('people must include p1');
  if (!couple && people.some((p) => p.id === 'p2')) {
    throw new TiInputError('p2 is the spouse: only for a married couple');
  }
  if (new Set(people.map((p) => p.id)).size !== people.length) {
    throw new TiInputError('each person once');
  }
  for (const p of people) {
    if (p.workRate !== undefined && !(p.workRate > 0 && p.workRate <= 100)) {
      throw new TiInputError('workRate is a percentage above 0, at most 100');
    }
    if (
      p.monthsWorked !== undefined &&
      !(Number.isInteger(p.monthsWorked) && p.monthsWorked >= 1 && p.monthsWorked <= 12)
    ) {
      throw new TiInputError('monthsWorked is a whole number of months, 1 to 12');
    }
  }
  const hh = input.household ?? {};
  if (people.some((p) => p.selfEmploymentProfit)) notes.add(notes.unsupported, NOTE.selfEmployed);
  notes.add(notes.notCounted, NOTE.notAsked);
  notes.add(notes.notCounted, NOTE.church);
  notes.add(notes.assumptions, NOTE.adults);

  const kids = withHouseholdChildcare(input, couple, P, notes);
  const fam = family(input, P, couple, notes);
  const ref = communeRef(y, input.commune);
  const unsupportedResult = (rest: Partial<TiTaxResult> = {}): TiTaxResult => ({
    canton: 'TI',
    taxYear: y,
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
    limits: notes.limits,
    ...rest,
  });
  if (notes.unsupported.length) {
    // Something every later line rests on is missing or not supported (a question about the family,
    // self-employment): the result says that first, and nothing more.
    return unsupportedResult();
  }

  const items: Item[] = [];
  const professional: Item[] = [];
  const figures = people.map((p) => personItems(P, p, items, professional, notes));
  const unverified: Text[] = [NOTE.tariffLine, NOTE.rounding];
  if (fam.sharedTariff) unverified.push(NOTE.sharedTariff);

  // Child support received (3.6), accounts and securities (4.1), other income (6.3).
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
  householdGiven('3.6', [hh.childSupportReceived], 1);
  const movable = input.movable ?? [];
  const incomeTr = new Trace().src(familyTaxation(y).source);
  const wealthIncome = total(
    incomeTr,
    movable.map((m) => m.income),
  );
  if (wealthIncome > 0) {
    items.push(
      item(
        '4.1',
        'household',
        incomeTr,
        wealthIncome,
        t(
          `Gross income of the accounts and securities (Modulo 2): ${chf(wealthIncome)}.`,
          `Rendement brut des avoirs et titres (Modulo 2)${NB}: ${chf(wealthIncome)}.`,
        ),
      ),
    );
  }
  householdGiven('6.3', [hh.otherIncome], 1);

  // Insurance premiums and savings interest (12): what was paid, at most the cap.
  const premiums = [
    hh.healthPremiums,
    hh.accidentPremiums,
    hh.lifeInsurancePremiums,
    hh.savingsInterest,
  ];
  if (premiums.some(Boolean)) {
    const tr = new Trace();
    const health = total(tr, [hh.healthPremiums]);
    const subsidy = hh.healthSubsidy ? total(tr, [hh.healthSubsidy]) : 0;
    const others = total(tr, [hh.accidentPremiums, hh.lifeInsurancePremiums, hh.savingsInterest]);
    const paid = Math.max(0, health - subsidy) + others;
    const noPension = figures.every((f) => !f.pension);
    const cap = insuranceCap(tr.p(A.insurance), {
      married: couple,
      noPension,
      children: fam.insuranceChildren,
    });
    if (fam.halfChildInsurance) {
      tr.src(childRule(y).source);
      unverified.push(NOTE.sharedInsurance);
    }
    const ded = Math.min(paid, cap);
    notes.limit('insurance', A.insurance, '12', 'household', paid, cap, ded);
    if (ded > 0) {
      items.push(
        item(
          '12',
          'household',
          tr,
          -ded,
          t(
            `Premiums and savings interest ${chf(paid)}${subsidy ? ` (health premiums less the subsidy ${chf(subsidy)})` : ''}; at most ${chf(cap)} (${couple ? 'spouses' : 'single taxpayer'}${noPension ? ', no pension fund or pillar 3a contributions' : ''}${fam.insuranceChildren ? `, ${fam.insuranceChildren} child${fam.insuranceChildren === 1 ? '' : 'ren'}` : ''}): ${chf(ded)}.`,
            `Primes et intérêts d’épargne ${chf(paid)}${subsidy ? ` (primes maladie moins le subside ${chf(subsidy)})` : ''}${NB}; au plus ${chf(cap)} (${couple ? 'époux' : 'contribuable seul'}${noPension ? ', sans cotisations au 2e pilier ni au pilier 3a' : ''}${fam.insuranceChildren ? `, ${fam.insuranceChildren} enfant${fam.insuranceChildren === 1 ? '' : 's'}` : ''})${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  // Costs of keeping securities (13.1): the actual costs.
  householdGiven('13.1', [hh.bankFees], -1);

  // Private debt interest (13.2): up to the gross income from wealth plus a fixed amount.
  if (hh.debtInterest) {
    const tr = new Trace().with(incomeTr);
    const paid = total(tr, [hh.debtInterest]);
    const extra = tr.p(A.debtInterestExtra);
    const d = debtInterestDeduction(paid, wealthIncome, extra);
    notes.limit(
      'debt_interest',
      A.debtInterestExtra,
      '13.2',
      'household',
      paid,
      d.cap,
      d.deduction,
    );
    if (d.deduction > 0) {
      items.push(
        item(
          '13.2',
          'household',
          tr,
          -d.deduction,
          t(
            `Paid ${chf(paid)}, at most the gross income from wealth ${chf(wealthIncome)} plus ${chf(extra)} (${chf(d.cap)}): ${chf(d.deduction)}.`,
            `Payé ${chf(paid)}, au plus le rendement brut de la fortune ${chf(wealthIncome)} plus ${chf(extra)} (${chf(d.cap)})${NB}: ${chf(d.deduction)}.`,
          ),
        ),
      );
    }
  }
  householdGiven('14.1', [hh.alimonyPaid], -1);
  householdGiven('14.2', [hh.childSupportPaid], -1);

  // Political parties (15.2): at most one amount per return.
  if (hh.politicalParty) {
    const tr = new Trace();
    const paid = total(tr, [hh.politicalParty]);
    const max = tr.p(A.party);
    const ded = Math.min(paid, max);
    notes.limit('party', A.party, '15.2', 'household', paid, max, ded);
    if (ded > 0) {
      items.push(
        item(
          '15.2',
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

  // Both spouses work (15.5): at most the amount, never more than the lower of the two incomes.
  // Which income the documents mean is not spelled out: the net salary, the salary after its costs,
  // or with daily allowances. The same deduction in every reading, or no tax.
  if (couple) {
    const tr = new Trace();
    const max = tr.p(A.twoEarner);
    const both = people.length === 2 ? figures : [];
    const readings = [
      twoEarnerDeduction(
        both.map((f) => f.earned),
        max,
      ),
      twoEarnerDeduction(
        both.map((f) => f.earned - f.costs),
        max,
      ),
      twoEarnerDeduction(
        both.map((f) => f.earned + f.replacement),
        max,
      ),
    ];
    if (new Set(readings).size > 1) notes.add(notes.unsupported, NOTE.twoEarnerConflict);
    else if (readings[0]! > 0) {
      const lower = Math.min(...both.map((f) => f.earned));
      items.push(
        item(
          '15.5',
          'household',
          tr,
          -readings[0]!,
          t(
            `Both of you earn a salary: ${chf(max)}, at most the lower salary ${chf(lower)}: ${chf(readings[0]!)}.`,
            `Vous avez tous deux un salaire${NB}: ${chf(max)}, au plus le salaire le plus bas ${chf(lower)}${NB}: ${chf(readings[0]!)}.`,
          ),
        ),
      );
    }
  }

  // Childcare (20): per child under 14 living with you, at most the limit.
  const withCare = kids
    .map((ch, i) => ({ ch, n: i + 1 }))
    .filter(({ ch }) => Boolean(ch.childcare));
  if (withCare.length) {
    const tr = new Trace();
    const cap = tr.p(A.childcare);
    let ded = 0;
    const parts: string[] = [];
    for (const { ch, n } of withCare) {
      if (ch.under14 === false || ch.livesWithYou === false) {
        notes.add(notes.notCounted, NOTE.childcareAway);
        continue;
      }
      const working = couple
        ? figures.length === 2 && figures.every((f) => f.earned > 0)
        : figures.some((f) => f.earned > 0);
      if (!working) {
        notes.add(notes.unsupported, NOTE.childcareWork);
        continue;
      }
      if (ch.under14 === undefined) notes.add(notes.assumptions, NOTE.under14);
      const paid = total(tr, [ch.childcare]);
      if (ch.custody === 'shared' && input.childSupport === 'pays') {
        notes.add(notes.unsupported, NOTE.childcarePays);
        continue;
      }
      if (ch.custody === 'shared' && input.childSupport === 'none' && paid > cap / 2) {
        notes.add(notes.unsupported, NOTE.sharedChildcare);
        continue;
      }
      const one = Math.min(paid, cap);
      notes.limit('childcare', A.childcare, '20', `child${n}`, paid, cap, one);
      ded += one;
      parts.push(chf(one));
    }
    if (ded > 0) {
      items.push(
        item(
          '20',
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

  // Illness costs (22.1): above 5 % of the net income II (21).
  let medical: TiIccResult['medical'] = null;
  if (hh.medicalCosts) {
    const net2 = subtotals(items).net2;
    const tr = new Trace();
    const costs = total(tr, [hh.medicalCosts]);
    const m = medicalDeduction(costs, net2, tr.p(A.medicalThresholdBp));
    notes.limit(
      'medical',
      A.medicalThresholdBp,
      '22.1',
      'household',
      costs,
      m.threshold,
      m.deduction,
      'threshold',
    );
    if (costs > 0) {
      // 22.1 as the return lays it out: a. the costs (Modulo 6, back), b. the threshold, c. the
      // deduction (the item).
      const r = RUBRICS['22.1'];
      const costTrace = new Trace();
      total(costTrace, [hh.medicalCosts]);
      const threshold = new Trace();
      threshold.p(A.medicalThresholdBp);
      medical = {
        costs: costTrace
          .src(`${FORM1} p. 3 (Ziffer 22.1 a)`, 'ti-2025-form-modulo-6 p. 2', r.source)
          .line(
            costs,
            {
              ...t(
                'Illness and accident costs you bore (22.1 a, spese per malattia e infortunio)',
                'Frais de maladie et d’accident à votre charge (22.1 a, spese per malattia e infortunio)',
              ),
              it: '22.1 a) Spese per malattia e infortunio',
            },
            t(
              `The costs you bore yourself (Modulo 6): ${chf(costs)}.`,
              `Les frais restés à votre charge (Modulo 6)${NB}: ${chf(costs)}.`,
            ),
          ),
        threshold: threshold
          .src(`${FORM1} p. 3 (Ziffer 22.1 b)`, 'ti-2025-form-modulo-6 p. 2')
          .line(
            m.threshold,
            {
              ...t(
                'Threshold, 5 % of the net income II (22.1 b, franchigia)',
                'Franchise, 5 % du revenu net II (22.1 b, franchigia)',
              ),
              it: '22.1 b) Franchigia del 5% del reddito netto intermedio II (cifra 21)',
            },
            t(
              `5 % of the net income II (21), ${chf(net2)}: ${chf(m.threshold)}.`,
              `5${NB}% du revenu net II (21), ${chf(net2)}${NB}: ${chf(m.threshold)}.`,
            ),
          ),
      };
    }
    if (m.deduction > 0) {
      items.push(
        item(
          '22.1',
          'household',
          tr,
          -m.deduction,
          t(
            `${chf(costs)} less 5 % of the net income II ${chf(net2)} (franchigia ${chf(m.threshold)}): ${chf(m.deduction)}.`,
            `${chf(costs)} moins 5${NB}% du revenu net II ${chf(net2)} (franchigia ${chf(m.threshold)})${NB}: ${chf(m.deduction)}.`,
          ),
        ),
      );
    } else if (costs > 0) notes.add(notes.notCounted, NOTE.medicalBelow);
  }

  // Donations (24): from CHF 100 in the year, at most 20 % of the net income III (23).
  if (hh.donations) {
    const net3 = subtotals(items).net3;
    const tr = new Trace();
    const gifts = total(tr, [hh.donations]);
    const p = tr.p(A.donations);
    const d = donationDeduction(gifts, net3, p.shareBp, p.min);
    notes.limit('donations', A.donations, '24', 'household', gifts, p.min, d.deduction, 'minimum');
    if (gifts >= p.min) {
      notes.limit('donations', A.donations, '24', 'household', gifts, d.cap, d.deduction);
    }
    if (d.deduction > 0) {
      items.push(
        item(
          '24',
          'household',
          tr,
          -d.deduction,
          t(
            `${chf(gifts)}, at most 20 % of the net income III ${chf(net3)} (${chf(d.cap)}): ${chf(d.deduction)}.`,
            `${chf(gifts)}, au plus 20${NB}% du revenu net III ${chf(net3)} (${chf(d.cap)})${NB}: ${chf(d.deduction)}.`,
          ),
        ),
      );
    } else if (gifts > 0 && gifts < p.min) notes.add(notes.notCounted, NOTE.donationsMin);
  }

  // The child deduction (25.1).
  if (fam.childUnits > 0) {
    const tr = new Trace().src(...fam.sources);
    const per = tr.p(A.child);
    const value = Math.round(per * fam.childUnits);
    items.push(
      item(
        '25.1',
        'household',
        tr,
        -value,
        t(
          `${String(fam.childUnits)} x ${chf(per)}: ${chf(value)}.`,
          `${String(fam.childUnits).replace('.', ',')} x ${chf(per)}${NB}: ${chf(value)}.`,
        ),
      ),
    );
  }

  // The exemption for AVS and AI pensioners (27), on the net income (26).
  const avsTotal = figures.reduce((s, f) => s + f.avs, 0);
  if (avsTotal > 0) {
    const net4 = subtotals(items).net4;
    const tr = new Trace().src(tariffRule(y).source);
    const p = tr.p(A.avsExemption);
    const familyTariff = fam.tariff === 'family';
    const value = avsExemption(p, net4, familyTariff, avsTotal);
    if (value > 0) {
      items.push(
        item(
          '27',
          'household',
          tr,
          -value,
          t(
            `AVS or AI pension ${chf(avsTotal)}; net income ${chf(net4)}, ${familyTariff ? 'family' : 'single'} tariff: ${chf(p.amount)} up to ${chf(familyTariff ? p.familyUpTo : p.singleUpTo)}, ${chf(p.reduction)} less for each ${chf(p.step)} begun above, at most the pension: ${chf(value)}.`,
            `Rente AVS ou AI ${chf(avsTotal)}${NB}; revenu net ${chf(net4)}, barème ${familyTariff ? 'familial' : 'des personnes seules'}${NB}: ${chf(p.amount)} jusqu’à ${chf(familyTariff ? p.familyUpTo : p.singleUpTo)}, ${chf(p.reduction)} de moins par tranche de ${chf(p.step)} commencée au-delà, au plus la rente${NB}: ${chf(value)}.`,
          ),
        ),
      );
    }
  }

  // Wealth (29 to 36).
  const wealthItems: Item[] = [];
  const valueTr = new Trace().src(wealthRule(y).source, familyTaxation(y).source);
  const accounts = total(
    valueTr,
    movable.map((m) => m.value),
  );
  if (accounts > 0) {
    wealthItems.push(
      wealthItem(
        '29.1',
        valueTr,
        accounts,
        t(
          `Value on 31 December of the accounts and securities (Modulo 2): ${chf(accounts)}.`,
          `Valeur au 31 décembre des avoirs et titres (Modulo 2)${NB}: ${chf(accounts)}.`,
        ),
      ),
    );
  }
  const asset = (code: WealthCode, amounts: readonly (Amount | undefined)[], sign: 1 | -1) => {
    if (!amounts.some(Boolean)) return;
    const tr = new Trace().src(wealthRule(y).source);
    const value = total(tr, amounts);
    if (value > 0) wealthItems.push(wealthItem(code, tr, sign * value, given(value)));
  };
  asset('29.2', [hh.cash], 1);
  asset('29.3', [hh.lifeInsuranceValue], 1);
  asset('29.4', [hh.vehicles], 1);
  asset('29.5', [hh.otherAssets], 1);
  asset('33.1', [hh.debts], -1);
  if (couple) {
    const tr = new Trace();
    const value = tr.p(A.wealthDeductions).married;
    wealthItems.push(
      wealthItem(
        '35.1',
        tr,
        -value,
        t(
          `Spouses living together: ${chf(value)}.`,
          `Époux faisant ménage commun${NB}: ${chf(value)}.`,
        ),
      ),
    );
  }
  // Minor children (35.2): every reading must give the same tax. When the readings differ in the
  // amount but not in the tax, the line is left out and the result says so.
  const { low, high } = fam.minorWealth;
  if (high > 0) {
    const before = wealthItems.reduce((s, i) => s + i.amount, 0);
    const taxWith = (deduction: number) =>
      categoryTax(P.wealth.value, Math.max(0, before - deduction));
    if (low === high) {
      const tr = new Trace().src(...fam.sources);
      const per = tr.p(A.wealthDeductions).perMinorChild;
      wealthItems.push(
        wealthItem(
          '35.2',
          tr,
          -low,
          t(
            `${chf(per)} per minor child you provide for: ${chf(low)}.`,
            `${chf(per)} par enfant mineur à votre charge${NB}: ${chf(low)}.`,
          ),
        ),
      );
    } else if (taxWith(low) !== taxWith(high)) {
      notes.add(notes.unsupported, NOTE.wealthChild);
    } else {
      notes.add(notes.assumptions, NOTE.wealthChildLeftOut);
    }
  }

  const allLines: Line[] = [...items, ...wealthItems];
  const base = {
    estimates: [...new Set(allLines.flatMap((l) => l.estimates ?? []))]
      .filter((id): id is keyof typeof ESTIMATE_TEXT => id in ESTIMATE_TEXT)
      .map((id) => ({ id, what: ESTIMATE_TEXT[id] })),
    needsOk: allLines.filter((l) => l.needsOk).length,
    complete: !allLines.some((l) => l.incomplete),
    incomplete: allLines.filter((l) => l.incomplete).map((l) => l.label),
  };
  if (notes.unsupported.length) return unsupportedResult(base);

  // In the form's order, the taxpayer before the spouse (the sort is stable).
  const order = Object.keys(RUBRICS);
  items.sort((x, z) => order.indexOf(x.code) - order.indexOf(z.code));
  const wealthOrder = Object.keys(WEALTH_RUBRICS);
  wealthItems.sort((x, z) => wealthOrder.indexOf(x.code) - wealthOrder.indexOf(z.code));
  try {
    const icc = assess({
      taxYear: y,
      commune: input.commune,
      incomeTariff: fam.tariff,
      adults: couple ? 2 : 1,
      familySources: fam.sources,
      professional,
      medical,
      incomeItems: items,
      wealthItems,
    });

    // The federal tax the authority derives from the same return (./ifd.ts): the same income
    // lines, the federal deductions. Who counts the children follows the federal rules (circular
    // 30): in full, half in shared custody without child support, not for the parent who pays it.
    const sharedAlone = !couple && kids.some((ch) => ch.custody === 'shared');
    const support = sharedAlone ? input.childSupport : undefined;
    const childSources =
      support === 'receives'
        ? [`${CIRCULAR30} p. 24 and 33 (ch. 13.4.2, 14.5)`]
        : support === 'pays'
          ? [`${CIRCULAR30} p. 24, 32 and 33 (ch. 13.4.2, 14.5)`]
          : support === 'none' && input.ifdParentalScale !== undefined
            ? [`${CIRCULAR30} p. 19, 24 and 32 (ch. 10.2, 14.4)`]
            : [];
    const federalChildren: FederalChild[] = [];
    for (const ch of kids) {
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
    const earning = new Set<string>(['1.1', '1.2', '3.4', '3.5']);
    const federal = federalReturn(
      {
        input,
        couple,
        incomeItems: icc.items.filter((i) => INCOME.has(i.code)),
        inFull: icc.items.filter((i) => IN_FULL.has(i.code)),
        children: federalChildren,
        childSources,
        wealthIncome,
      },
      people.map((p) => ({
        input: p,
        earnings: icc.items.filter((i) => i.person === p.id && earning.has(i.code)),
        buyIns: icc.items.filter((i) => i.person === p.id && i.code === '10.3'),
      })),
    );
    const ifd = federal.ifd;
    for (const x of federal.notes.notCounted) notes.add(notes.notCounted, x);
    return {
      canton: 'TI',
      taxYear: y,
      commune: ref,
      icc,
      ifd,
      total: ifd ? icc.taxes.total.amount + ifd.tax.amount : null,
      ...base,
      assumptions: notes.assumptions,
      notCounted: notes.notCounted,
      unsupported: [...federal.notes.unsupported],
      unverifiedRules: [...unverified, ...notes.unverified, ...federal.notes.unverified],
      limits: bothTaxes(notes.limits, federal.notes.limits),
    };
  } catch (e) {
    if (!(e instanceof TiUnsupported)) throw e;
    notes.add(notes.unsupported, e.note);
    return unsupportedResult(base);
  }
}

/** ESTV circular 30 on the taxation of spouses and the family: separated parents, the scales. */
const CIRCULAR30 = 'ch-na-circulaire-30-epoux-famille';
const FORM1 = 'ti-2025-form-modulo-1-de';
/**
 * Deductions in full for both taxes: the buy-ins into the pension fund and, from 2026, pillar 3a
 * (10.3), the costs of keeping securities (13.1), alimony and child support paid (14.1, 14.2).
 */
const IN_FULL = new Set(['10.3', '13.1', '14.1', '14.2']);

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
 * child under 14 (LT art. 32a; Modulo 6 lists it child by child). It is that child's when one child
 * can have it; with several, any split gives the same when the whole amount is within one child's
 * limit, half of it for a child in shared custody without child support, the federal one included;
 * otherwise how it splits decides the deduction, and the tax is not computed without it (fail
 * closed).
 */
function withHouseholdChildcare(
  input: TiEngineInput,
  couple: boolean,
  P: TiYearParams,
  notes: Notes,
): readonly ChildInput[] {
  const children = input.children ?? [];
  const care = input.household?.childcare;
  if (!care) return children;
  if (children.some((ch) => ch.childcare)) {
    throw new TiInputError('Childcare: give it per child or for the household, not both.');
  }
  // The children whose childcare counts here: in full for you, or shared without child support.
  const countsHere = (ch: ChildInput) =>
    ch.custody === 'full' ||
    couple ||
    input.childSupport === 'receives' ||
    input.childSupport === 'none';
  const eligible = children
    .map((ch, i) => ({ ch, i }))
    .filter(({ ch }) => countsHere(ch) && (ch.livesWithYou ?? true) && ch.under14 !== false);
  const paid = total(new Trace(), [care]);
  const shared = eligible.some(({ ch }) => ch.custody === 'shared');
  const cantonal = P.amounts.childcare.value / (shared ? 2 : 1);
  const within = Math.min(cantonal, ifdParamsFor(P.taxYear).childcareMax.value);
  if (eligible.length === 1 || (eligible.length > 1 && paid <= within)) {
    const at = eligible[0]!.i;
    return children.map((ch, i) => (i === at ? { ...ch, childcare: care } : ch));
  }
  if (eligible.length > 1) notes.add(notes.unsupported, NOTE.childcareSplit);
  else if (paid > 0) notes.add(notes.notCounted, NOTE.childcareNoChild);
  return children;
}

/** Every computed line of a result, for checks and for the explanation tree. */
export function allLines(r: Pick<TiTaxResult, 'icc'> & { ifd?: TiTaxResult['ifd'] }): Line[] {
  const f = r.ifd;
  const federal: Line[] = f
    ? [
        ...f.items,
        f.grossIncome,
        f.totalDeductions,
        f.netIncome,
        f.netIncome2,
        f.netIncome3,
        f.netIncome4,
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
    ...x.professional,
    x.grossIncome,
    x.totalDeductions,
    x.netIncome,
    x.netIncome2,
    ...(x.medical ? [x.medical.costs, x.medical.threshold] : []),
    x.netIncome3,
    x.netIncome4,
    x.taxableIncome,
    ...x.wealth.items,
    x.wealth.grossWealth,
    x.wealth.netWealth,
    x.wealth.taxableWealth,
    x.taxes.incomeBase,
    x.taxes.wealthBase,
    x.taxes.cantonalIncome,
    x.taxes.cantonalWealth,
    x.taxes.communalIncome,
    x.taxes.communalWealth,
    x.taxes.personal,
    x.taxes.total,
    ...federal,
  ];
}

/** For the sources test: the cited rules this module applies. */
export const COMPUTE_RULES = (y: TiTaxYear) => [
  childRule(y),
  familyTaxation(y),
  salaryRule(y),
  professionalRule(y),
  wealthRule(y),
];
