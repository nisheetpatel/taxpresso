// The one entry point: computeReturn(input) gives the lines of the St. Gallen return by code and
// person, the totals and the cantonal, communal and (on request) church tax, each line explained with
// its sources. First stage here (household figures to the lines of the return and its Form 4, every
// cap, floor and excess of the St. Gallen documents, in the order of the return), second stage in
// ./assess.ts (lines to taxes). The same two stages, with the same names, as packages/rules-bl.
import {
  answered,
  chf,
  donationDeduction,
  medicalDeduction,
  mealsDeduction,
  pillar3a as federalPillar3a,
  roundFranc,
  Trace,
  type Amount,
} from '@taxpresso/rules-ch';
import { assess, communeOf, communeRef, SgInputError, subtotals } from './assess.js';
import { areaByName, churchRate, type Confession, type SgCommune } from './communes.js';
import { churchAreaNote, ESTIMATE_TEXT, NOTE } from './explain.js';
import {
  buyInRule,
  childcareRule,
  childRule,
  churchRule,
  communeAtYearEnd,
  familySituation,
  insuranceExtraRule,
  otherCostsRule,
  sharedCustody,
  sideJobRule,
  splittingRule,
} from './law.js';
import { sgParamsFor, type SgTaxYear, type SgYearParams } from './params.js';
import {
  ORDER,
  PERSON_CODES,
  RUBRICS,
  WEALTH_ORDER,
  WEALTH_RUBRICS,
  type RubricCode,
  type WealthCode,
} from './rubrics.js';
import { educationDeduction, insuranceCap, otherFlat, sideJobFlat, vehicleCost } from './rules.js';
import type {
  ChildInput,
  ChildStage,
  ChurchShare,
  EmploymentInput,
  Item,
  ItemPerson,
  Line,
  PersonInput,
  SgEngineInput,
  SgTaxResult,
  Text,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = '\u00a0';
const MB8_SOURCE = 'sg-2026-guide-merkblatt-unterjaehrig p. 4';
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

/** Sum of amounts read into a trace, to the franc. */
function total(tr: Trace, amounts: readonly (Amount | undefined)[]): number {
  return roundFranc(amounts.reduce((s, a) => s + tr.a(a), 0));
}

const given = (value: number) =>
  t(`As given: ${chf(value)}.`, `Tel que donné${NB}: ${chf(value)}.`);

interface Salary {
  /** Box 11: box 8 less boxes 9 and 10, to the franc (1.1 or 1.2). */
  net: number;
  /** The net salary of StV Art. 21 Abs. 2: box 8 less boxes 9 and 10.1, without the buy-ins. */
  flatBase: number;
  gross: number;
  social: number;
  /** Box 10.1 or 10.2 shows a pension fund. */
  fund: boolean;
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
    flatBase: roundFranc(Math.max(0, gross - social - fund)),
    gross,
    social,
    fund: fund > 0 || buyIn > 0,
    tr,
  };
}

/** Travel to work (Form 4, 1.1 to 1.3) before the cap, and how it was found (no full stop). */
function travel(
  P: SgYearParams,
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
    if (mode.by === 'motorbike') {
      notes.add(notes.unsupported, NOTE.motorbikeRate);
      return none(t('travel: not computed', `transport${NB}: non calculé`));
    }
    // No usable public transport: per km, there and back each working day.
    if (!mode.kmOneWay || !mode.days) {
      notes.add(notes.notCounted, NOTE.drivingDetails);
      return none(t('travel: not counted', `transport${NB}: non compté`));
    }
    const rate = tr.p(v).carPerKm;
    const cost = vehicleCost(mode.kmOneWay, mode.days, rate);
    return {
      cost,
      how: t(
        `travel ${chf(cost)} (car, no usable public transport: ${mode.kmOneWay} km x 2 x ${mode.days} days x CHF ${perKm(rate)})`,
        `transport ${chf(cost)} (voiture, sans transports publics utilisables${NB}: ${mode.kmOneWay} km x 2 x ${mode.days} jours x CHF ${perKm(rate)})`,
      ),
    };
  }
  if (mode?.by === 'bike') {
    const year = tr.p(v).bikePerYear;
    notes.add(notes.assumptions, NOTE.bikeFlat);
    return {
      cost: year,
      how: t(
        `travel ${chf(year)} (bike, moped or small motorbike with a yellow plate, the flat amount a year)`,
        `transport ${chf(year)} (vélo, cyclomoteur ou petite moto à plaque jaune, le forfait annuel)`,
      ),
    };
  }
  // Public transport: what it cost; a car or a motorbike when public transport could be used: what
  // public transport would have cost (StV Art. 18 Abs. 1bis lit. a; Steuerbuch StB 39 Nr. 3).
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
  /** Net salaries (1.1, 1.2). */
  salaries: number;
  /** Allowances replacing earned income (3.3, 3.4). */
  allowances: number;
  /** Pension fund contributions or buy-ins, or pillar 3a, deducted for this person. */
  pension: boolean;
  /** Alimony received for oneself (6.1 is the household's line). */
  alimony: { amount: number; tr: Trace } | null;
}

function personItems(P: SgYearParams, p: PersonInput, items: Item[], notes: Notes): PersonFigures {
  const A = P.amounts;
  const y = P.taxYear;
  const id = p.id;
  const all = p.employments ?? [];
  // A side job needs a main job next to it (guide p. 25): alone, it is the main job.
  const sideOnly = all.length > 0 && all.every((e) => e.side);
  if (sideOnly) notes.add(notes.unverified, NOTE.sideOnly);
  const main = sideOnly ? all : all.filter((e) => !e.side);
  const side = sideOnly ? [] : all.filter((e) => e.side);
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

  // Professional costs of the main job (Form 4, 1 to 3).
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
            canteen ? PERSON_CODES.mealsHalf[id] : PERSON_CODES.meals[id],
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

    // Other costs: the flat amount, or the actual costs when higher (Form 4, 3.1 or 3.2).
    const tr = new Trace().with(mainSalary.tr).src(otherCostsRule(y).source);
    const o = tr.p(A.otherFlat);
    const flat = otherFlat(mainSalary.flatBase, o);
    const actual = p.otherProfessionalCosts ? total(tr, [p.otherProfessionalCosts]) : 0;
    if (flat < o.max && flat > 0) notes.add(notes.unverified, NOTE.otherFlatRounding);
    if (actual > flat) {
      items.push(
        item(
          PERSON_CODES.otherActual[id],
          id,
          tr,
          -actual,
          t(
            `The actual costs ${chf(actual)} are higher than the flat amount ${chf(flat)}: ${chf(actual)}.`,
            `Les frais effectifs ${chf(actual)} dépassent le forfait ${chf(flat)}${NB}: ${chf(actual)}.`,
          ),
        ),
      );
    } else if (flat > 0) {
      items.push(
        item(
          PERSON_CODES.otherFlat[id],
          id,
          tr,
          -flat,
          t(
            `${chf(o.base)} plus 10 % of the net salary ${chf(mainSalary.flatBase)} (gross less AHV and pension fund contributions, without buy-ins), at most ${chf(o.max)}: ${chf(flat)}.${actual ? ` The actual costs given, ${chf(actual)}, are lower.` : ''}`,
            `${chf(o.base)} plus 10${NB}% du salaire net ${chf(mainSalary.flatBase)} (brut moins cotisations AVS et de prévoyance, sans les rachats), au plus ${chf(o.max)}${NB}: ${chf(flat)}.${actual ? ` Les frais effectifs indiqués, ${chf(actual)}, sont inférieurs.` : ''}`,
          ),
        ),
      );
    }
  }

  // A side job (Form 4, 5.1): its costs up to its income, or the flat share.
  if (side.length) {
    const tr = new Trace().with(sideSalary.tr).src(sideJobRule(y).source);
    const sp = tr.p(A.sideJob);
    const flat = sideJobFlat(sideSalary.net, sp);
    if (flat > 0) {
      items.push(
        item(
          PERSON_CODES.sideCosts[id],
          id,
          tr,
          -flat,
          sideSalary.net <= sp.min
            ? t(
                `The side job’s net income ${chf(sideSalary.net)} is at most ${chf(sp.min)}: its costs up to that amount.`,
                `Le revenu net de l’activité accessoire ${chf(sideSalary.net)} est au plus ${chf(sp.min)}${NB}: ses frais jusqu’à ce montant.`,
              )
            : t(
                `20 % of the side job’s net income ${chf(sideSalary.net)}, at least ${chf(sp.min)}, at most ${chf(sp.max)}: ${chf(flat)}.`,
                `20${NB}% du revenu net de l’activité accessoire ${chf(sideSalary.net)}, au moins ${chf(sp.min)}, au plus ${chf(sp.max)}${NB}: ${chf(flat)}.`,
              ),
        ),
      );
    }
  }

  // Pensions (3.1, 3.2) and allowances (3.3, 3.4).
  const own = (code: RubricCode, amounts: readonly (Amount | undefined)[], note?: Text) => {
    if (!amounts.some(Boolean)) return 0;
    const tr = new Trace();
    const value = total(tr, amounts);
    if (value <= 0) return 0;
    if (note) notes.add(notes.assumptions, note);
    items.push(item(code, id, tr, value, given(value)));
    return value;
  };
  own(PERSON_CODES.avs[id], [p.pensionAvs]);
  own(PERSON_CODES.pension[id], [p.pensionOccupational, p.pensionOther], NOTE.pensions);
  const allowances =
    own(PERSON_CODES.allowances[id], [p.replacementIncome]) +
    own(PERSON_CODES.unemployment[id], [p.unemploymentBenefits]);

  // Pension fund buy-ins paid directly (13.2).
  let buyIn = false;
  if (p.pensionBuyIn) {
    const tr = new Trace().src(buyInRule(y).source);
    const paid = total(tr, [p.pensionBuyIn]);
    if (paid > 0) {
      buyIn = true;
      items.push(item(PERSON_CODES.buyIn[id], id, tr, -paid, given(paid)));
    }
  }

  // Pillar 3a (13.1): the federal limits (StG Art. 45 Abs. 1 lit. e); a catch-up from 2026, at most
  // the small maximum (Merkblatt 8, 13.1).
  const hasPensionFund = p.hasPensionFund ?? (mainSalary.fund || sideSalary.fund);
  let catchUp: Amount | undefined;
  if (p.pillar3aCatchUp && (p.pillar3aCatchUp.value ?? 0) > 0) {
    if (y === 2025) notes.add(notes.notCounted, NOTE.catchUp2025);
    else {
      const max = A.pillar3a.value.withFund;
      if (p.pillar3aCatchUp.value > max) notes.add(notes.notCounted, NOTE.catchUpCap);
      catchUp = { ...p.pillar3aCatchUp, value: Math.min(p.pillar3aCatchUp.value, max) };
    }
  }
  const r3a = federalPillar3a(
    { pillar3a: A.pillar3a },
    {
      ...(p.pillar3a ? { paid: p.pillar3a } : {}),
      ...(catchUp ? { catchUp } : {}),
      hasFund: hasPensionFund,
      gross: mainSalary.gross + sideSalary.gross,
      social: mainSalary.social + sideSalary.social,
      self: 0,
      earnedFrom: [mainSalary.tr, sideSalary.tr],
      ...(catchUp ? { cantonalLaw: [`${MB8_SOURCE} (13.1 Nachträgliche Einkäufe Säule 3a)`] } : {}),
    },
  );
  for (const n of r3a.notCounted) notes.add(notes.notCounted, n);
  let pillar3a = false;
  if (r3a.deduction && r3a.deduction.amount < 0) {
    pillar3a = true;
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

  // Professional training (16.4): at most per person; employees may take the flat amount instead
  // (2025, cantonal tax only).
  if (p.trainingCosts) {
    const tr = new Trace();
    const paid = total(tr, [p.trainingCosts]);
    const tc = tr.p(A.training);
    const flat = main.length ? tc.flat : null;
    if (paid > 0) {
      // Without a flat amount for the year, say so when last year's would have been more.
      const lastFlat = y === 2025 ? null : sgParamsFor(2025).amounts.training.value.flat;
      if (main.length && flat === null && lastFlat !== null && paid < lastFlat) {
        notes.add(notes.notCounted, NOTE.trainingFlat2026);
      }
      const amount = flat !== null && paid < flat ? flat : Math.min(paid, tc.max);
      items.push(
        item(
          PERSON_CODES.training[id],
          id,
          tr,
          -amount,
          flat !== null && paid < flat
            ? t(
                `Paid ${chf(paid)}; as an employee you may deduct the flat ${chf(flat)} instead (cantonal tax only): ${chf(amount)}.`,
                `Payé ${chf(paid)}${NB}; comme salarié, vous pouvez déduire le forfait de ${chf(flat)} à la place (impôt cantonal seulement)${NB}: ${chf(amount)}.`,
              )
            : t(
                `Paid ${chf(paid)}, at most ${chf(tc.max)}: ${chf(amount)}.`,
                `Payé ${chf(paid)}, au plus ${chf(tc.max)}${NB}: ${chf(amount)}.`,
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

  return {
    id,
    salaries: mainSalary.net + sideSalary.net,
    allowances,
    pension: hasPensionFund || buyIn || pillar3a,
    alimony,
  };
}

/** A child as the deductions read it. */
interface CountedChild {
  /** Gets the child deduction here (23.1 or 23.2), raises 14, and the wealth deduction if minor. */
  counts: boolean;
  /** Lives with you: Vollsplitting for a single parent, childcare. */
  lives: boolean;
  stage?: ChildStage;
  minor: boolean;
  input: ChildInput;
}

/**
 * Who counts the children, and whether the household has Vollsplitting: a married couple, or a
 * parent alone living with a child they mainly support (StG Art. 48, Art. 50 Abs. 3 and 4).
 */
function familyOf(
  input: SgEngineInput,
  couple: boolean,
  notes: Notes,
): { splitting: boolean; children: CountedChild[]; sources: string[] } {
  const y = input.taxYear;
  const children: CountedChild[] = [];
  const sources = [familySituation(y).source];
  for (const ch of input.children ?? []) {
    const lives = ch.livesWithYou ?? true;
    let counts: boolean;
    if (ch.custody === 'full' || couple) {
      if (ch.custody === 'shared') {
        notes.add(notes.unsupported, NOTE.marriedShared);
        continue;
      }
      counts = true;
      if (!lives) notes.add(notes.assumptions, NOTE.childNotWithYou);
    } else {
      sources.push(sharedCustody(y).source);
      if (input.childSupport === 'receives') {
        counts = true;
        notes.add(notes.assumptions, NOTE.childSupportReceived);
      } else if (input.childSupport === 'pays') {
        counts = false;
        notes.add(notes.assumptions, NOTE.childSupportPaid);
      } else if (input.childSupport === 'none') {
        if (input.mainUpkeep === undefined) {
          notes.add(notes.unsupported, NOTE.mainUpkeep);
          continue;
        }
        counts = input.mainUpkeep;
        notes.add(notes.assumptions, counts ? NOTE.mainUpkeepYes : NOTE.mainUpkeepNo);
      } else {
        notes.add(notes.unsupported, NOTE.childSupport);
        continue;
      }
    }
    if (counts && !ch.stage) notes.add(notes.unsupported, NOTE.childStage);
    const minor = ch.stage === 'preschool' ? true : ch.minor;
    if (ch.stage === 'preschool' && ch.minor === false) {
      throw new SgInputError('A child of preschool age is a minor.');
    }
    if (counts && ch.stage === 'school' && minor === undefined) {
      notes.add(notes.unsupported, NOTE.childMinor);
    }
    children.push({
      counts,
      lives,
      ...(ch.stage ? { stage: ch.stage } : {}),
      minor: minor ?? false,
      input: ch,
    });
  }
  const counted = children.filter((c) => c.counts);
  if (counted.length) {
    notes.add(notes.assumptions, NOTE.childrenAtCharge);
    sources.push(childRule(y).source);
  }
  const splitting = couple || counted.some((c) => c.lives);
  if (splitting) sources.push(splittingRule(y).source);
  return { splitting, children, sources: [...new Set(sources)] };
}

/**
 * The church tax's shares, when asked for: [] when nobody is a member, undefined when not asked for
 * or not computed (the result says why).
 */
function churchOf(
  input: SgEngineInput,
  couple: boolean,
  commune: SgCommune,
  notes: Notes,
): ChurchShare[] | undefined {
  const church = input.church;
  if (!church) {
    notes.add(notes.notCounted, NOTE.churchNotAsked);
    return undefined;
  }
  if (church.area !== undefined && !areaByName(commune, church.area)) {
    throw new SgInputError(
      `Unknown church area of ${commune.name}: ${church.area} (${commune.areas.map((a) => a.name).join(', ')}).`,
    );
  }
  const members: ['p1' | 'p2', Confession][] = couple
    ? [
        ['p1', church.p1 ?? 'none'],
        ['p2', church.p2 ?? 'none'],
      ]
    : [['p1', church.p1 ?? 'none']];
  if (members.some(([, c]) => c === 'other')) {
    notes.add(notes.unsupported, NOTE.churchOther);
    return undefined;
  }
  const confessions = members.map(([, c]) => c);
  if (confessions.every((c) => c === 'none')) return [];
  const P = sgParamsFor(input.taxYear);
  const mixed = new Set(confessions).size > 1;
  if (mixed) {
    notes.add(notes.assumptions, NOTE.churchMixed);
    if (confessions.includes('none')) notes.add(notes.unverified, NOTE.churchHalfNone);
  }
  const shares: ChurchShare[] = [];
  for (const [person, c] of members) {
    if (c === 'none' || c === 'other') continue;
    if (!mixed && shares.length) break; // one church for the household
    const share = mixed ? 50 : 100;
    const who: ItemPerson = mixed ? person : 'household';
    if (c === 'christ_catholic') {
      shares.push({ person: who, confession: c, area: null, rate: P.christCatholic.value, share });
      continue;
    }
    const r = churchRate(commune, c, church.area);
    if (r === 'area') {
      notes.add(
        notes.unsupported,
        churchAreaNote(
          commune.name,
          commune.areas.map((a) => a.name),
        ),
      );
      return undefined;
    }
    const note = r.area.notes?.[c];
    if (note === 3) notes.add(notes.unverified, NOTE.churchFootnote3);
    if (note === 4) notes.add(notes.unverified, NOTE.churchFootnote4);
    shares.push({ person: who, confession: c, area: r.area.name, rate: r.rate, share });
  }
  return shares;
}

export function computeReturn(input: SgEngineInput): SgTaxResult {
  const P = sgParamsFor(input.taxYear);
  const A = P.amounts;
  const y: SgTaxYear = P.taxYear;
  const ref = communeRef(y, input.commune); // throws for an unknown commune
  const commune = communeOf(y, input.commune);
  const notes = new Notes();
  const couple = input.civilStatus === 'married';
  const people = [...input.people].sort((a, b) => a.id.localeCompare(b.id));
  if (!people.some((p) => p.id === 'p1')) throw new SgInputError('people must include p1');
  if (!couple && people.some((p) => p.id === 'p2')) {
    throw new SgInputError('p2 is the spouse: only for a married couple');
  }
  if (new Set(people.map((p) => p.id)).size !== people.length) {
    throw new SgInputError('each person once');
  }
  const hh = input.household ?? {};
  if (people.some((p) => p.selfEmploymentProfit)) notes.add(notes.unsupported, NOTE.selfEmployed);
  notes.add(notes.assumptions, NOTE.wholeYear);
  notes.add(notes.assumptions, NOTE.fullYear);
  notes.add(notes.notCounted, NOTE.fireLevy);

  const fam = familyOf(input, couple, notes);
  const church = churchOf(input, couple, commune, notes);
  const base = { canton: 'SG' as const, taxYear: y, commune: ref, ifd: null };
  const result = (lines: readonly Line[]): SgTaxResult => ({
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
  const counted = fam.children.filter((c) => c.counts);

  // Income of the household: accounts and securities (4.1), alimony and child support (6.1),
  // other income (6.3).
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
        '146',
        'household',
        incomeTr,
        movableIncome,
        t(
          `Gross income of the accounts and securities (Form 2): ${chf(movableIncome)}.`,
          `Rendement brut des avoirs et des titres (formulaire 2)${NB}: ${chf(movableIncome)}.`,
        ),
      ),
    );
  }
  const alimony = figures.filter((f) => f.alimony);
  if (alimony.length) {
    const tr = new Trace().with(...alimony.map((f) => f.alimony!.tr));
    const amount = alimony.reduce((s, f) => s + f.alimony!.amount, 0);
    items.push(item('154', 'household', tr, amount, given(amount)));
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
  householdGiven('156', [hh.childSupportReceived], 1);
  householdGiven('162', [hh.otherIncome], 1);

  // Private debt interest (11): up to the income from wealth plus a fixed amount.
  if (hh.debtInterest) {
    const tr = new Trace().with(incomeTr);
    const paid = total(tr, [hh.debtInterest]);
    const extra = tr.p(A.debtInterestExtra);
    const cap = movableIncome + extra;
    const ded = Math.min(paid, cap);
    if (ded > 0) {
      items.push(
        item(
          '500',
          'household',
          tr,
          -ded,
          t(
            `Paid ${chf(paid)}, at most the income from securities and accounts plus ${chf(extra)} (${chf(cap)}): ${chf(ded)}.`,
            `Payé ${chf(paid)}, au plus le rendement des titres et avoirs plus ${chf(extra)} (${chf(cap)})${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }
  householdGiven('200', [hh.alimonyPaid], -1);
  householdGiven('202', [hh.childSupportPaid], -1);

  // Insurance premiums and savings interest (14): what was paid, less the subsidies, up to the
  // maximum (Form 6).
  {
    const tr = new Trace();
    const paid = total(tr, [
      hh.healthPremiums,
      hh.accidentPremiums,
      hh.lifeInsurancePremiums,
      hh.savingsInterest,
    ]);
    const subsidy = total(tr, [hh.healthSubsidy]);
    const net = Math.max(0, paid - subsidy);
    const noPension = figures.every((f) => !f.pension);
    const ins = tr.p(A.insurance);
    const cap = insuranceCap(ins, couple, noPension, counted.length);
    if (counted.length) tr.src(...fam.sources);
    if (noPension) {
      tr.p(insuranceExtraRule(y));
      notes.add(notes.unverified, NOTE.insuranceExtra);
    }
    if (net === 0) notes.add(notes.notCounted, NOTE.insuranceNone);
    else {
      if (!hh.savingsInterest && movableIncome > 0 && net < cap) {
        notes.add(notes.notCounted, NOTE.savingsInterest);
      }
      const ded = Math.min(net, cap);
      const capHow = t(
        `${couple ? 'married couple' : 'single taxpayer'} ${chf(couple ? ins.married : ins.other)}${noPension ? ` plus ${chf(couple ? ins.marriedExtra : ins.otherExtra)} (no pension fund or pillar 3a contributions deducted)` : ''}${counted.length ? ` plus ${counted.length} x ${chf(ins.perChild)} for the children` : ''}`,
        `${couple ? 'couple marié' : 'personne seule'} ${chf(couple ? ins.married : ins.other)}${noPension ? ` plus ${chf(couple ? ins.marriedExtra : ins.otherExtra)} (aucune cotisation de prévoyance ni de pilier 3a déduite)` : ''}${counted.length ? ` plus ${counted.length} x ${chf(ins.perChild)} pour les enfants` : ''}`,
      );
      items.push(
        item(
          '600',
          'household',
          tr,
          -ded,
          t(
            `Premiums and savings interest ${chf(paid)}${subsidy ? ` less subsidies ${chf(subsidy)}` : ''}: ${chf(net)}; at most ${capHow.en} = ${chf(cap)}: ${chf(ded)}.`,
            `Primes et intérêts de l’épargne ${chf(paid)}${subsidy ? ` moins subsides ${chf(subsidy)}` : ''}${NB}: ${chf(net)}${NB}; au plus ${capHow.fr} = ${chf(cap)}${NB}: ${chf(ded)}.`,
          ),
        ),
      );
    }
  }

  householdGiven('220', [hh.bankFees], -1);

  // Childcare (16.2): per counted child under 14 living with you, while you work (a couple: both).
  const withCare = fam.children.filter((c) => c.input.childcare);
  if (withCare.length) {
    const earned = (f: PersonFigures) => f.salaries + f.allowances > 0;
    const working = couple ? figures.length === 2 && figures.every(earned) : figures.some(earned);
    const tr = new Trace().src(childcareRule(y).source, ...fam.sources);
    const cap = tr.p(A.childcare);
    let ded = 0;
    const parts: string[] = [];
    for (const ch of withCare) {
      if (!ch.counts) {
        notes.add(notes.notCounted, NOTE.childcareOtherParent);
        continue;
      }
      if (!ch.lives || ch.input.under14 === false) continue;
      if (!working) {
        notes.add(notes.notCounted, NOTE.childcareWork);
        continue;
      }
      if (ch.input.under14 === undefined) notes.add(notes.assumptions, NOTE.under14);
      notes.add(notes.assumptions, NOTE.childcareMeals);
      const one = Math.min(total(tr, [ch.input.childcare]), cap);
      ded += one;
      parts.push(chf(one));
    }
    if (ded > 0) {
      items.push(
        item(
          '258',
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

  // Political parties (16.3): at most an amount, married couples and everyone else.
  if (hh.politicalParty) {
    const tr = new Trace();
    const paid = total(tr, [hh.politicalParty]);
    const party = tr.p(A.party);
    const max = couple ? party.married : party.other;
    const ded = Math.min(paid, max);
    if (ded > 0) {
      items.push(
        item(
          '555',
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

  // Both spouses work (17): a fixed amount.
  if (couple && figures.length === 2 && figures.every((f) => f.salaries + f.allowances > 0)) {
    const tr = new Trace();
    const amount = tr.p(A.twoEarner);
    if (figures.some((f) => f.salaries === 0))
      notes.add(notes.unverified, NOTE.twoEarnerAllowances);
    items.push(
      item(
        '226',
        'household',
        tr,
        -amount,
        t(
          `Both of you have earned income: ${chf(amount)}.`,
          `Vous avez tous deux un revenu d’activité${NB}: ${chf(amount)}.`,
        ),
      ),
    );
  }

  // Illness costs (21.1) above 2 % of the Nettoeinkommen (20); donations (21.3) once they reach
  // CHF 100, up to 20 % of it.
  const netBaseLine = (): Line => {
    const s = subtotals(items);
    return new Trace()
      .from(...items)
      .line(
        s.netBase,
        t('the Nettoeinkommen (20)', 'le revenu net (Nettoeinkommen, 20)'),
        t('', ''),
      );
  };
  if (hh.medicalCosts) {
    const tr = new Trace();
    const costs = total(tr, [hh.medicalCosts]);
    const nb = netBaseLine();
    tr.from(nb);
    const bp = tr.p(A.medicalThresholdBp);
    const { threshold, deduction } = medicalDeduction(costs, nb.amount, bp);
    if (costs > 0 && deduction > 0) {
      items.push(
        item(
          '240',
          'household',
          tr,
          -deduction,
          t(
            `Costs you bore ${chf(costs)} less ${bp / 100} % of the Nettoeinkommen (${chf(nb.amount)}), that is ${chf(threshold)}: ${chf(deduction)}.`,
            `Frais à votre charge ${chf(costs)} moins ${bp / 100}${NB}% du revenu net (${chf(nb.amount)}), soit ${chf(threshold)}${NB}: ${chf(deduction)}.`,
          ),
        ),
      );
    } else if (costs > 0) notes.add(notes.notCounted, NOTE.medicalThreshold);
  }
  if (hh.donations) {
    const tr = new Trace();
    const gifts = total(tr, [hh.donations]);
    const nb = netBaseLine();
    tr.from(nb);
    const d = tr.p(A.donations);
    const { cap, deduction } = donationDeduction(gifts, nb.amount, d.shareBp, d.min);
    if (gifts > 0 && deduction > 0) {
      items.push(
        item(
          '244',
          'household',
          tr,
          -deduction,
          t(
            `Donations ${chf(gifts)}, at most ${d.shareBp / 100} % of the Nettoeinkommen (${chf(nb.amount)}), that is ${chf(cap)}: ${chf(deduction)}.`,
            `Dons ${chf(gifts)}, au plus ${d.shareBp / 100}${NB}% du revenu net (${chf(nb.amount)}), soit ${chf(cap)}${NB}: ${chf(deduction)}.`,
          ),
        ),
      );
    } else if (gifts > 0 && gifts < d.min) notes.add(notes.notCounted, NOTE.donationsMinimum);
  }

  // Child deductions (23.1 to 23.3).
  if (counted.length) {
    const childLine = (code: '252' | '254', stage: ChildStage) => {
      const n = counted.filter((c) => c.stage === stage).length;
      if (!n) return;
      const tr = new Trace().src(...fam.sources);
      const cd = tr.p(A.child);
      const per = stage === 'preschool' ? cd.preschool : cd.school;
      items.push(
        item(
          code,
          'household',
          tr,
          -n * per,
          t(
            `${n} child${n === 1 ? '' : 'ren'} ${stage === 'preschool' ? 'not yet of school age' : 'in school or training'} x ${chf(per)}: ${chf(n * per)}.`,
            `${n} enfant${n === 1 ? '' : 's'} ${stage === 'preschool' ? 'pas encore en âge scolaire' : 'à l’école ou en formation'} x ${chf(per)}${NB}: ${chf(n * per)}.`,
          ),
        ),
      );
    };
    childLine('252', 'preschool');
    childLine('254', 'school');
    const educated = counted.filter((c) => c.stage === 'school' && c.input.educationCosts);
    if (educated.length) {
      const tr = new Trace().src(...fam.sources);
      const cd = tr.p(A.child);
      let ded = 0;
      const parts: string[] = [];
      for (const c of educated) {
        const costs = total(tr, [c.input.educationCosts]);
        const grants = total(tr, [c.input.scholarships]);
        const e = educationDeduction(costs, grants, cd);
        if (e.law !== e.form) {
          notes.add(notes.unsupported, NOTE.educationScholarships);
          return result([...items]);
        }
        ded += e.law;
        parts.push(
          `${chf(costs)}${grants ? ` less scholarships ${chf(grants)}` : ''} less ${chf(cd.educationExcess)}, at most ${chf(cd.educationMax)}: ${chf(e.law)}`,
        );
      }
      if (ded > 0) {
        items.push(
          item(
            '256',
            'household',
            tr,
            -ded,
            t(
              `Per child in school or training, the education costs you paid: ${parts.join('; ')}. Together: ${chf(ded)}.`,
              `Par enfant à l’école ou en formation, les frais de formation payés${NB}: ${parts.join(`${NB}; `)}. Ensemble${NB}: ${chf(ded)}.`,
            ),
          ),
        );
      }
    }
  }

  // Wealth (30.1 to 34.1), then the social deductions (36.1 to 36.3).
  const wealthItems: Item[] = [];
  if (movableValue > 0) {
    wealthItems.push(
      wealthItem(
        '300',
        valueTr,
        movableValue,
        t(
          `Tax value on 31 December of the securities and accounts (Form 2): ${chf(movableValue)}.`,
          `Valeur imposable au 31 décembre des titres et avoirs (formulaire 2)${NB}: ${chf(movableValue)}.`,
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
  asset('302', [hh.cash], 1);
  asset('304', [hh.lifeInsuranceValue], 1);
  asset('306', [hh.vehicles], 1);
  asset('310', [hh.otherAssets], 1);
  asset('504', [hh.debts], -1);
  {
    const tr = new Trace().src(familySituation(y).source);
    const free = tr.p(A.wealthFree);
    const amount = (couple ? 2 : 1) * free.perTaxpayer;
    wealthItems.push(
      wealthItem(
        couple ? '332' : '330',
        tr,
        -amount,
        couple
          ? t(
              `Married couple: 2 x ${chf(free.perTaxpayer)} = ${chf(amount)}.`,
              `Couple marié${NB}: 2 x ${chf(free.perTaxpayer)} = ${chf(amount)}.`,
            )
          : t(`Single taxpayer: ${chf(amount)}.`, `Personne seule${NB}: ${chf(amount)}.`),
      ),
    );
    const minors = counted.filter((c) => c.minor).length;
    if (minors) {
      const trc = new Trace().src(...fam.sources);
      const per = trc.p(A.wealthFree).perChild;
      wealthItems.push(
        wealthItem(
          '334',
          trc,
          -minors * per,
          t(
            `${minors} minor child${minors === 1 ? '' : 'ren'} with a child deduction x ${chf(per)}: ${chf(minors * per)}.`,
            `${minors} enfant${minors === 1 ? '' : 's'} mineur${minors === 1 ? '' : 's'} avec déduction pour enfant x ${chf(per)}${NB}: ${chf(minors * per)}.`,
          ),
        ),
      );
    }
  }

  const allLinesSoFar: Line[] = [...items, ...wealthItems];
  if (notes.unsupported.length) return result(allLinesSoFar);

  // In the order of the return (the sort is stable: person 1 before person 2 on a shared code).
  const at = (order: readonly string[]) => (x: Item, z: Item) =>
    order.indexOf(x.code) - order.indexOf(z.code);
  items.sort(at(ORDER));
  wealthItems.sort(at(WEALTH_ORDER));
  const icc = assess({
    taxYear: y,
    commune: input.commune,
    splitting: fam.splitting,
    familySources: fam.sources,
    church: church ?? null,
    incomeItems: items,
    wealthItems,
  });
  const lines = allLines({ icc });
  return {
    ...result(lines),
    unsupported: [],
    icc,
    total: icc.taxes.total.amount,
    unverifiedRules: [NOTE.rounding, ...notes.unverified],
  };
}

/** Every computed line of a result, for checks and for the explanation tree. */
export function allLines(r: Pick<SgTaxResult, 'icc'>): Line[] {
  if (!r.icc) return [];
  const x = r.icc;
  return [
    ...x.items,
    x.grossIncome,
    x.totalDeductions,
    x.netIncomeBase,
    x.netIncome,
    x.taxableIncome,
    x.rateIncome,
    ...x.wealth.items,
    x.wealth.grossWealth,
    x.wealth.netWealth,
    x.wealth.taxableWealth,
    x.taxes.simpleIncome,
    x.taxes.simpleWealth,
    x.taxes.cantonalIncome,
    x.taxes.communalIncome,
    x.taxes.cantonalWealth,
    x.taxes.communalWealth,
    ...(x.taxes.church ? [x.taxes.church] : []),
    x.taxes.total,
  ];
}

/** For the sources test: the cited rules this module applies. */
export const COMPUTE_RULES = (y: SgTaxYear) => [
  familySituation(y),
  sharedCustody(y),
  childRule(y),
  splittingRule(y),
  churchRule(y),
  communeAtYearEnd(y),
  insuranceExtraRule(y),
  childcareRule(y),
  otherCostsRule(y),
  sideJobRule(y),
  buyInRule(y),
];
