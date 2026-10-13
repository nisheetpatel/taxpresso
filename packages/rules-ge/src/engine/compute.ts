// The one entry point: computeReturn(input) gives the items of the return by rubric code and
// person, the totals, the ICC (cantonal, communal, wealth, personal tax) and the IFD, each line
// explained with its sources and estimates. First stage here (household figures to admitted
// items, every cap and threshold of the 2025 guide and the federal documents), second stage in
// ./assess.ts (items to taxes).
import type { IccSplitting } from '../2025/icc.js';
import type { CommuneSlug } from '../2026/communes.js';
import { assess, incomeTotals, type Assessment } from './assess.js';
import { chf, roundFranc, Trace } from './calc.js';
import { ESTIMATE_TEXT, NOTE } from './explain.js';
import {
  avsDeduction,
  donationDeduction,
  flatProfessional,
  lifeInsuranceCap,
  mealsDeduction,
  medicalDeduction,
  pillar3aCapWithoutFund,
  twoEarnerFederal,
} from './rules.js';
import type { Param } from './param.js';
import { paramsFor, type YearParams } from './params.js';
import { codeFor, rubric, RUBRICS, type RubricCode } from './rubrics.js';
import type {
  Amount,
  ChildInput,
  EngineInput,
  EnginePerson,
  EstimateNote,
  Item,
  ItemPerson,
  Line,
  PersonInput,
  TaxResult,
  Text,
} from './types.js';

export class EngineInputError extends Error {}

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = '\u00a0';
const GUIDE = 'ge-2025-guide-declaration-pp';

class Notes {
  readonly assumptions: Text[] = [];
  readonly notCounted: Text[] = [];
  readonly unsupported: Text[] = [];
  readonly unverified: Text[] = [];
  add(list: Text[], text: Text) {
    if (!list.some((x) => x.en === text.en)) list.push(text);
  }
}

/** An item for this rubric and person; its label and rubric source come from the catalogue. */
function item(code: RubricCode, person: ItemPerson, tr: Trace, amount: number, how: Text): Item {
  const r = RUBRICS[code];
  tr.src(r.source);
  return { code: codeFor(code, person), person, ...tr.line(amount, r.label, how) };
}

/** Sum of amounts read into a trace, to the franc (the form takes whole francs, guide p. 9). */
function total(tr: Trace, amounts: readonly (Amount | undefined)[]): number {
  return roundFranc(amounts.reduce((s, a) => s + tr.a(a), 0));
}

interface PersonFigures {
  id: EnginePerson;
  gross: number;
  social: number;
  pensionFund: number;
  /** Earned income of this person in each tax, for the two-earner deduction. */
  earnedIcc: number;
  earnedIfd: number;
  earns: boolean;
  contributes: boolean;
}

/** Items of one person, the same rubrics as the annexe A of the form (guide p. 17 to 21). */
function personItems(
  P: YearParams,
  p: PersonInput,
  icc: Item[],
  ifd: Item[],
  notes: Notes,
  incomeByCommune: Partial<Record<CommuneSlug, number>>,
  commune: CommuneSlug,
): PersonFigures {
  const I = P.icc;
  const F = P.ifd;
  const jobs = p.employments ?? [];
  const both = (it: Item) => (icc.push(it), ifd.push(it));
  const start = { icc: icc.length, ifd: ifd.length };

  // Income.
  const gTrace = new Trace();
  const gross = total(
    gTrace,
    jobs.map((e) => e.gross),
  );
  if (gross > 0) {
    both(
      item(
        '11.10',
        p.id,
        gTrace,
        gross,
        t(
          `Box 8 (total gross salary) of ${jobs.length} salary certificate${jobs.length > 1 ? 's' : ''}: ${chf(gross)}.`,
          `Chiffre 8 (salaire brut total) de ${jobs.length} certificat${jobs.length > 1 ? 's' : ''} de salaire${NB}: ${chf(gross)}.`,
        ),
      ),
    );
    for (const e of jobs) {
      const c = e.workCommune && e.workCommune !== 'outside' ? e.workCommune : commune;
      incomeByCommune[c] = (incomeByCommune[c] ?? 0) + roundFranc(e.gross.value);
    }
  }
  const simple = (code: RubricCode, amount: Amount | undefined, en: string, fr: string) => {
    const tr = new Trace();
    const v = total(tr, [amount]);
    if (v > 0) both(item(code, p.id, tr, v, t(`${en}: ${chf(v)}.`, `${fr}${NB}: ${chf(v)}.`)));
    return v;
  };
  const replacement = simple(
    '11.50',
    p.replacementIncome,
    'Benefits not paid through the employer',
    'Indemnités non versées par l’employeur',
  );
  const self = simple(
    '12.01',
    p.selfEmploymentProfit,
    'Net self-employment income, as given',
    'Revenu net de l’activité indépendante, tel que donné',
  );
  simple(
    '17.10',
    p.pensionAvs,
    'AVS/AI pension, taxed in full',
    'Rente AVS/AI, imposable en totalité',
  );
  simple(
    '13.20',
    p.pensionOccupational,
    'Pension fund pension, taxed in full',
    'Rente de la prévoyance professionnelle, imposable en totalité',
  );
  simple('13.40', p.pensionOther, 'Other pension, taxed in full', 'Autre rente, imposable à 100 %');
  simple('13.10', p.alimonyReceived, 'Alimony received', 'Pension alimentaire reçue');

  // Contributions (ICC and IFD alike).
  const sTrace = new Trace();
  const social = total(
    sTrace,
    jobs.map((e) => e.socialContributions),
  );
  if (social > 0) {
    both(
      item(
        '31.10',
        p.id,
        sTrace,
        -social,
        t(
          `Box 9 of the salary certificates: ${chf(social)}.`,
          `Chiffre 9 des certificats de salaire${NB}: ${chf(social)}.`,
        ),
      ),
    );
  }
  const lTrace = new Trace();
  const pensionFund = total(
    lTrace,
    jobs.map((e) => e.pensionFund),
  );
  if (pensionFund > 0) {
    both(
      item(
        '31.12',
        p.id,
        lTrace,
        -pensionFund,
        t(
          `Box 10.1 of the salary certificates: ${chf(pensionFund)}.`,
          `Chiffre 10.1 des certificats de salaire${NB}: ${chf(pensionFund)}.`,
        ),
      ),
    );
  }
  const bTrace = new Trace();
  const buyIn = total(bTrace, [...jobs.map((e) => e.pensionBuyIn), p.pensionBuyIn]);
  if (buyIn > 0) {
    both(
      item(
        '31.30',
        p.id,
        bTrace,
        -buyIn,
        t(
          `Buy-ins (box 10.2 and attestations): ${chf(buyIn)}, deductible in full.`,
          `Rachats (chiffre 10.2 et attestations)${NB}: ${chf(buyIn)}, déductibles en totalité.`,
        ),
      ),
    );
  }

  // Pillar 3a: federal limits, the same for the cantonal tax (LIPP art. 31 let. c).
  const hasFund = p.hasPensionFund ?? pensionFund > 0;
  const tTrace = new Trace();
  const paid = total(tTrace, [p.pillar3a]);
  if (paid > 0) {
    const lim = tTrace.p(F.pillar3a);
    tTrace.src('ge-na-law-lipp art. 31 let. c');
    let cap = lim.withFund;
    let capHow = t(
      `the limit with a pension fund, ${chf(cap)}`,
      `la limite avec caisse de pension, ${chf(cap)}`,
    );
    if (!hasFund) {
      const earned = Math.max(0, gross - social + self);
      cap = pillar3aCapWithoutFund(earned, lim);
      capHow = t(
        `without a pension fund, 20 % of earned income (${chf(earned)}) up to ${chf(lim.withoutFundMax)}: ${chf(cap)}`,
        `sans caisse de pension, 20${NB}% du revenu d’activité (${chf(earned)}) jusqu’à ${chf(lim.withoutFundMax)}${NB}: ${chf(cap)}`,
      );
      if (earned === 0) {
        notes.add(
          notes.notCounted,
          t(
            'Pillar 3a needs earned income: none was given, so nothing is deducted.',
            `Le 3e pilier A suppose un revenu d’activité${NB}: aucun n’est indiqué, rien n’est déduit.`,
          ),
        );
      }
    }
    const v = Math.min(paid, cap);
    both(
      item(
        '31.40',
        p.id,
        tTrace,
        -v,
        t(
          `Paid ${chf(paid)}; at most ${capHow.en}: ${chf(v)}.`,
          `Versé ${chf(paid)}${NB}; au plus ${capHow.fr}${NB}: ${chf(v)}.`,
        ),
      ),
    );
  }

  // Professional expenses, for salaried work and the benefits that replace it: the flat
  // deductions are 3 % of the code 11.00 (annexe A income) less 31.10 and 31.12 (guide p. 19).
  const annexA = gross + replacement;
  if (annexA > 0) {
    const canteen = jobs.some((e) => e.canteen === true);
    const freeTransport = jobs.some((e) => e.freeTransport === true);
    const net = annexA - social - pensionFund;
    const costTrace = new Trace();
    const commute = gross > 0 ? total(costTrace, [p.commuteCost]) : 0;
    const other = total(costTrace, [p.otherProfessionalCosts]);
    if (gross > 0 && p.commuteCost === undefined && !freeTransport) {
      notes.add(
        notes.notCounted,
        t(
          'Commuting costs (frais de déplacement): no amount given, so none are counted.',
          `Frais de déplacement${NB}: aucun montant indiqué, rien n’est compté.`,
        ),
      );
    }
    if (gross > 0 && p.mealDays === undefined) {
      notes.add(
        notes.notCounted,
        t(
          'Meals away from home (frais de repas): no number of days given, so none are counted.',
          `Frais de repas${NB}: aucun nombre de jours indiqué, rien n’est compté.`,
        ),
      );
    }
    const meals = (params: {
      perDay: number;
      perYear: number;
      halfPerDay: number;
      halfPerYear: number;
    }) => (gross > 0 ? mealsDeduction(p.mealDays ?? 0, canteen, params) : 0);

    // ICC: the flat 3 % covers every professional cost (LIPP art. 29 al. 2); actual costs instead
    // when higher (guide p. 22).
    const flatTrace = new Trace().with(gTrace, sTrace, lTrace);
    const fl = flatTrace.p(I.professionalFlat);
    const flat = flatProfessional(net, fl);
    const cTrace = new Trace().with(costTrace);
    const commuteIcc = freeTransport ? 0 : Math.min(commute, cTrace.p(I.commuteMax));
    const mTrace = new Trace();
    const mealsIcc = p.mealsIccAllowed ? meals(mTrace.p(I.meals)) : 0;
    const actual = commuteIcc + mealsIcc + other;
    if (actual > flat) {
      notes.add(
        notes.assumptions,
        t(
          'Professional expenses: your actual costs are higher than the flat deduction, so they are used.',
          `Frais professionnels${NB}: vos frais effectifs dépassent le forfait, ils sont retenus.`,
        ),
      );
      if (commuteIcc)
        icc.push(
          item(
            '31.70',
            p.id,
            cTrace,
            -commuteIcc,
            t(
              `Commuting ${chf(commute)}, at most ${chf(I.commuteMax.value)}: ${chf(commuteIcc)}.`,
              `Déplacements ${chf(commute)}, au plus ${chf(I.commuteMax.value)}${NB}: ${chf(commuteIcc)}.`,
            ),
          ),
        );
      if (mealsIcc)
        icc.push(
          item(
            '31.60',
            p.id,
            mTrace,
            -mealsIcc,
            t(
              `${p.mealDays} days${canteen ? ' at half rate (box G)' : ''}, within the yearly limit: ${chf(mealsIcc)}.`,
              `${p.mealDays} jours${canteen ? ' à demi-tarif (case G)' : ''}, dans la limite annuelle${NB}: ${chf(mealsIcc)}.`,
            ),
          ),
        );
      if (other)
        icc.push(
          item(
            '31.63',
            p.id,
            new Trace().with(costTrace),
            -other,
            t(`Other actual costs: ${chf(other)}.`, `Autres frais effectifs${NB}: ${chf(other)}.`),
          ),
        );
    } else {
      icc.push(
        item(
          '31.50',
          p.id,
          flatTrace,
          -flat,
          t(
            `3 % of the salary after social and pension fund contributions (${chf(net)}), to the franc, between ${chf(fl.min)} and ${chf(fl.max)}: ${chf(flat)}.`,
            `3${NB}% du salaire après cotisations AVS et 2e pilier (${chf(net)}), au franc, entre ${chf(fl.min)} et ${chf(fl.max)}${NB}: ${chf(flat)}.`,
          ),
        ),
      );
    }

    // IFD: commuting and meals on their own, the flat 3 % for the other costs (LIFD art. 26).
    const fTrace = new Trace().with(gTrace, sTrace, lTrace);
    const ff = fTrace.p(F.professionalFlat);
    const flatIfd = flatProfessional(net, ff);
    if (other > flatIfd) {
      ifd.push(
        item(
          '31.63',
          p.id,
          new Trace().with(costTrace),
          -other,
          t(
            `Other actual costs, higher than the flat deduction: ${chf(other)}.`,
            `Autres frais effectifs, supérieurs au forfait${NB}: ${chf(other)}.`,
          ),
        ),
      );
    } else {
      ifd.push(
        item(
          '31.20',
          p.id,
          fTrace,
          -flatIfd,
          t(
            `3 % of the salary after social and pension fund contributions (${chf(net)}), to the franc, between ${chf(ff.min)} and ${chf(ff.max)}: ${chf(flatIfd)}.`,
            `3${NB}% du salaire après cotisations AVS et 2e pilier (${chf(net)}), au franc, entre ${chf(ff.min)} et ${chf(ff.max)}${NB}: ${chf(flatIfd)}.`,
          ),
        ),
      );
    }
    if (!freeTransport && commute > 0) {
      const tr = new Trace().with(costTrace);
      const v = Math.min(commute, tr.p(F.commuteMax));
      ifd.push(
        item(
          '31.71',
          p.id,
          tr,
          -v,
          t(
            `Commuting ${chf(commute)}, at most ${chf(F.commuteMax.value)}: ${chf(v)}.`,
            `Déplacements ${chf(commute)}, au plus ${chf(F.commuteMax.value)}${NB}: ${chf(v)}.`,
          ),
        ),
      );
    }
    if (freeTransport) {
      notes.add(
        notes.notCounted,
        t(
          'Box F is ticked on a salary certificate: your employer pays the commute, so no commuting deduction.',
          `La case F est cochée sur un certificat de salaire${NB}: l’employeur paie le trajet, pas de déduction pour les déplacements.`,
        ),
      );
    }
    const mfTrace = new Trace();
    const mealsIfd = meals(mfTrace.p(F.meals));
    if (mealsIfd) {
      ifd.push(
        item(
          '31.60',
          p.id,
          mfTrace,
          -mealsIfd,
          t(
            `${p.mealDays} days${canteen ? ' at half rate (box G)' : ''}, within the yearly limit: ${chf(mealsIfd)}.`,
            `${p.mealDays} jours${canteen ? ' à demi-tarif (case G)' : ''}, dans la limite annuelle${NB}: ${chf(mealsIfd)}.`,
          ),
        ),
      );
    }
  }

  // Training (59.50), per person.
  const trTrace = new Trace();
  const training = total(trTrace, [p.trainingCosts]);
  if (training > 0) {
    const ti = new Trace().with(trTrace);
    const vi = Math.min(training, ti.p(I.trainingMax));
    icc.push(
      item(
        '59.50',
        p.id,
        ti,
        -vi,
        t(
          `Paid ${chf(training)}, at most ${chf(I.trainingMax.value)}: ${chf(vi)}.`,
          `Payé ${chf(training)}, au plus ${chf(I.trainingMax.value)}${NB}: ${chf(vi)}.`,
        ),
      ),
    );
    const tf = new Trace().with(trTrace);
    const vf = Math.min(training, tf.p(F.trainingMax));
    ifd.push(
      item(
        '59.50',
        p.id,
        tf,
        -vf,
        t(
          `Paid ${chf(training)}, at most ${chf(F.trainingMax.value)}: ${chf(vf)}.`,
          `Payé ${chf(training)}, au plus ${chf(F.trainingMax.value)}${NB}: ${chf(vf)}.`,
        ),
      ),
    );
  }

  const own = (list: Item[], from: number) =>
    list.slice(from).filter((i) => i.person === p.id && !i.code.startsWith('59'));
  const earned = (list: Item[], from: number) =>
    own(list, from).reduce(
      (s, i) =>
        s +
        (['11.10', '21.10', '11.50', '21.50', '12.01', '22.01'].includes(i.code) ||
        i.code[0] === '3' ||
        i.code[0] === '4'
          ? i.amount
          : 0),
      0,
    );
  return {
    id: p.id,
    gross,
    social,
    pensionFund,
    earnedIcc: earned(icc, start.icc),
    earnedIfd: earned(ifd, start.ifd),
    earns: gross + replacement + self > 0,
    contributes: hasFund || pensionFund > 0 || buyIn > 0 || paid > 0,
  };
}

export function computeReturn(input: EngineInput): TaxResult {
  const P = paramsFor(input.taxYear);
  const I = P.icc;
  const F = P.ifd;
  const notes = new Notes();
  const couple = input.civilStatus === 'married';
  const people = [...input.people].sort((a, b) => a.id.localeCompare(b.id));
  if (!people.some((p) => p.id === 'p1')) throw new EngineInputError('people must include p1');
  if (!couple && people.some((p) => p.id === 'p2')) {
    throw new EngineInputError('p2 is the spouse: only for a married couple');
  }
  if (!(input.commune in P.communes.centimes.value)) {
    throw new EngineInputError(`Unknown commune ${input.commune}`);
  }
  const children: readonly ChildInput[] = input.children ?? [];
  const full = children.filter((c) => c.custody === 'full').length;
  const shared = children.filter((c) => c.custody === 'shared').length;
  const hh = input.household ?? {};

  const icc: Item[] = [];
  const ifd: Item[] = [];
  const incomeByCommune: Partial<Record<CommuneSlug, number>> = {};
  const figures = people.map((p) =>
    personItems(P, p, icc, ifd, notes, incomeByCommune, input.commune),
  );

  // Bank accounts and securities (état des titres), per owner.
  const owners = new Map<
    ItemPerson,
    { value: Trace; income: Trace; values: Amount[]; incomes: Amount[] }
  >();
  for (const m of input.movable ?? []) {
    const o = owners.get(m.owner) ?? {
      value: new Trace(),
      income: new Trace(),
      values: [],
      incomes: [],
    };
    if (m.value) o.values.push(m.value);
    if (m.income) o.incomes.push(m.income);
    owners.set(m.owner, o);
  }
  const wealthItems: Item[] = [];
  let wealthIncome = 0;
  for (const [owner, o] of owners) {
    const inc = total(o.income, o.incomes);
    if (inc > 0) {
      wealthIncome += inc;
      const it = item(
        '14.10',
        owner,
        o.income,
        inc,
        t(
          `Gross income of the securities and accounts (état des titres): ${chf(inc)}.`,
          `Rendement brut des titres et comptes (état des titres)${NB}: ${chf(inc)}.`,
        ),
      );
      icc.push(it);
      ifd.push(it);
    }
    const val = total(o.value, o.values);
    if (val > 0) {
      wealthItems.push(
        item(
          '14.10',
          owner,
          o.value,
          val,
          t(
            `Taxable value on 31 December of the securities and accounts: ${chf(val)}.`,
            `Valeur imposable au 31 décembre des titres et comptes${NB}: ${chf(val)}.`,
          ),
        ),
      );
    }
  }
  const oTrace = new Trace();
  const otherAssets = total(oTrace, [hh.otherAssets]);
  if (otherAssets > 0) {
    wealthItems.push(
      item(
        '16.40',
        'household',
        oTrace,
        otherAssets,
        t(`As given: ${chf(otherAssets)}.`, `Tel que donné${NB}: ${chf(otherAssets)}.`),
      ),
    );
  }
  const dTrace = new Trace();
  const debts = total(dTrace, [hh.debts]);
  if (debts > 0) {
    wealthItems.push(
      item(
        '55.00',
        'household',
        dTrace,
        -debts,
        t(
          `Private debts on 31 December: ${chf(debts)}.`,
          `Dettes privées au 31 décembre${NB}: ${chf(debts)}.`,
        ),
      ),
    );
  }

  // Health insurance subsidy: income for the ICC (guide p. 27); exempt for the IFD (LIFD art. 24
  // let. d), where only the premiums left to pay are deducted.
  const subTrace = new Trace();
  const subsidy = total(subTrace, [hh.healthSubsidy]);
  if (subsidy > 0) {
    icc.push(
      item(
        '16.30',
        'household',
        subTrace,
        subsidy,
        t(
          `Subsidy received, declared as income; the full premium is deducted at 52.21: ${chf(subsidy)}.`,
          `Subside reçu, déclaré en revenu${NB}; la prime entière est déduite au 52.21${NB}: ${chf(subsidy)}.`,
        ),
      ),
    );
    notes.add(notes.unverified, NOTE.subsidyIfd);
  }

  // Two earners (31.90 IFD, 31.95 ICC): the spouse who earns less.
  const [a, b] = figures;
  if (couple && a && b && a.earns && b.earns) {
    const lowIcc = a.earnedIcc <= b.earnedIcc ? a : b;
    if (lowIcc.earnedIcc > 0) {
      const tr = new Trace();
      const v = Math.min(tr.p(I.twoEarner), lowIcc.earnedIcc);
      icc.push(
        item(
          '31.95',
          lowIcc.id,
          tr,
          -v,
          t(
            `Both spouses work: ${chf(I.twoEarner.value)} off the lower earned income (${chf(lowIcc.earnedIcc)}): ${chf(v)}.`,
            `Les deux conjoints travaillent${NB}: ${chf(I.twoEarner.value)} sur le revenu d’activité le plus bas (${chf(lowIcc.earnedIcc)})${NB}: ${chf(v)}.`,
          ),
        ),
      );
    }
    const lowIfd = a.earnedIfd <= b.earnedIfd ? a : b;
    if (lowIfd.earnedIfd > 0) {
      const tr = new Trace();
      const te = tr.p(F.twoEarner);
      const e = lowIfd.earnedIfd;
      const v = twoEarnerFederal(e, te);
      ifd.push(
        item(
          '31.90',
          lowIfd.id,
          tr,
          -v,
          t(
            `Both spouses work: 50 % of the lower earned income (${chf(e)}), at least ${chf(te.min)} (never more than that income), at most ${chf(te.max)}: ${chf(v)}.`,
            `Les deux conjoints travaillent${NB}: 50${NB}% du revenu d’activité le plus bas (${chf(e)}), au moins ${chf(te.min)} (jamais plus que ce revenu), au plus ${chf(te.max)}${NB}: ${chf(v)}.`,
          ),
        ),
      );
    }
  }

  // Health and accident premiums, ICC: twice the cantonal average premium per person, by age.
  const hTrace = new Trace();
  const premiums = total(hTrace, [hh.healthPremiums, hh.accidentPremiums]);
  if (premiums > 0) {
    const hi = new Trace().with(hTrace);
    const caps = hi.p(I.healthCap);
    const adults = people.map((p) => (p.age === 'young' ? caps.young : caps.adult));
    const kids = children.map((c) =>
      c.age === 'adult' ? caps.adult : c.age === 'young' ? caps.young : caps.child,
    );
    const cap = [...adults, ...kids].reduce((s, v) => s + v, 0);
    const v = Math.min(premiums, cap);
    icc.push(
      item(
        '52.21',
        'household',
        hi,
        -v,
        t(
          `Premiums ${chf(premiums)}; at most ${chf(cap)} for ${adults.length} adult${adults.length > 1 ? 's' : ''}${kids.length ? ` and ${kids.length} child${kids.length > 1 ? 'ren' : ''}` : ''}: ${chf(v)}.`,
          `Primes ${chf(premiums)}${NB}; au plus ${chf(cap)} pour ${adults.length} adulte${adults.length > 1 ? 's' : ''}${kids.length ? ` et ${kids.length} enfant${kids.length > 1 ? 's' : ''}` : ''}${NB}: ${chf(v)}.`,
        ),
      ),
    );
    if (people.some((p) => !p.age) || children.some((c) => !c.age))
      notes.add(notes.assumptions, NOTE.ages);
  }

  // Life insurance and savings interest, ICC 52.15.
  const lifeTrace = new Trace();
  const life = total(lifeTrace, [hh.lifeInsurancePremiums, hh.savingsInterest]);
  const charges = full + shared / 2;
  const contributing = figures.filter((f) => f.contributes).length;
  if (life > 0) {
    const li = new Trace().with(lifeTrace);
    const { exact, cap } = lifeInsuranceCap(li.p(I.lifeInsurance), couple, contributing, charges);
    if (cap !== exact) notes.add(notes.unverified, NOTE.halfFranc);
    const v = Math.min(life, cap);
    icc.push(
      item(
        '52.15',
        'household',
        li,
        -v,
        t(
          `Life insurance and savings interest ${chf(life)}; limit ${chf(cap)}: ${chf(v)}.`,
          `Assurance-vie et intérêts d’épargne ${chf(life)}${NB}; limite ${chf(cap)}${NB}: ${chf(v)}.`,
        ),
      ),
    );
  }

  // Insurance premiums and savings interest, IFD 52.00 (premiums net of any subsidy).
  const insTrace = new Trace().with(hTrace, lifeTrace, subTrace);
  const insurance = Math.max(0, premiums - subsidy) + life;
  if (insurance > 0) {
    const ins = insTrace.p(F.insurance);
    const anyContributes = contributing > 0;
    const base = couple
      ? anyContributes
        ? ins.married
        : ins.marriedNone
      : anyContributes
        ? ins.other
        : ins.otherNone;
    const kids = full + shared;
    const cap = base + ins.perChild * kids;
    const v = Math.min(insurance, cap);
    ifd.push(
      item(
        '52.00',
        'household',
        insTrace,
        -v,
        t(
          `Premiums and savings interest ${chf(insurance)}${subsidy ? ' (after the subsidy)' : ''}; at most ${chf(base)}${kids ? ` + ${chf(ins.perChild)} x ${kids} child${kids > 1 ? 'ren' : ''}` : ''}: ${chf(v)}.`,
          `Primes et intérêts d’épargne ${chf(insurance)}${subsidy ? ' (après subside)' : ''}${NB}; au plus ${chf(base)}${kids ? ` + ${chf(ins.perChild)} x ${kids} enfant${kids > 1 ? 's' : ''}` : ''}${NB}: ${chf(v)}.`,
        ),
      ),
    );
    if (shared) notes.add(notes.assumptions, NOTE.sharedInsurance);
  }

  // Alimony paid, debt interest, bank costs: the same in both taxes.
  const both = (it: Item) => (icc.push(it), ifd.push(it));
  const alTrace = new Trace();
  const alimony = total(alTrace, [hh.alimonyPaid]);
  if (alimony > 0)
    both(
      item(
        '53.10',
        'household',
        alTrace,
        -alimony,
        t(
          `Paid ${chf(alimony)}, deductible in full.`,
          `Versé ${chf(alimony)}, déductible en totalité.`,
        ),
      ),
    );
  const diTrace = new Trace();
  const interest = total(diTrace, [hh.debtInterest]);
  if (interest > 0) {
    const ci = new Trace().with(diTrace);
    const extra = ci.p(I.debtInterestExtra);
    const capI = wealthIncome + extra;
    const vi = Math.min(interest, capI);
    icc.push(
      item(
        '55.00',
        'household',
        ci,
        -vi,
        t(
          `Interest ${chf(interest)}; at most the income from wealth (${chf(wealthIncome)}) + ${chf(extra)}: ${chf(vi)}.`,
          `Intérêts ${chf(interest)}${NB}; au plus le rendement de la fortune (${chf(wealthIncome)}) + ${chf(extra)}${NB}: ${chf(vi)}.`,
        ),
      ),
    );
    const cf = new Trace().with(diTrace);
    const ef = cf.p(F.debtInterestExtra);
    const vf = Math.min(interest, wealthIncome + ef);
    ifd.push(
      item(
        '55.00',
        'household',
        cf,
        -vf,
        t(
          `Interest ${chf(interest)}; at most the income from wealth (${chf(wealthIncome)}) + ${chf(ef)}: ${chf(vf)}.`,
          `Intérêts ${chf(interest)}${NB}; au plus le rendement de la fortune (${chf(wealthIncome)}) + ${chf(ef)}${NB}: ${chf(vf)}.`,
        ),
      ),
    );
  }
  const fTrace = new Trace();
  const fees = total(fTrace, [hh.bankFees]);
  if (fees > 0)
    both(
      item(
        '56.20',
        'household',
        fTrace,
        -fees,
        t(`As admitted: ${chf(fees)}.`, `Tel qu’admis${NB}: ${chf(fees)}.`),
      ),
    );

  // Childcare (59.10 ICC, 59.12 IFD): children under 14; spouses must both work.
  const eligible = couple ? figures.length === 2 && figures.every((f) => f.earns) : true;
  const perChild = children.filter((c) => (c.childcare?.value ?? 0) > 0);
  const ccTrace = new Trace();
  const care = total(ccTrace, [...children.map((c) => c.childcare), hh.childcare]);
  const caredFor = new Set<ChildInput>();
  if (care > 0) {
    const young = children.filter((c) => c.under14 !== false);
    const counted =
      hh.childcare && hh.childcare.value > 0 ? young : perChild.filter((c) => c.under14 !== false);
    if (children.some((c) => c.under14 === undefined)) notes.add(notes.assumptions, NOTE.under14);
    if (!eligible) {
      notes.add(
        notes.notCounted,
        t(
          'Childcare: both spouses must work (or study) for it to be deducted.',
          `Frais de garde${NB}: les deux conjoints doivent travailler (ou être en formation) pour les déduire.`,
        ),
      );
    } else if (counted.length) {
      for (const c of counted) caredFor.add(c);
      const ci = new Trace().with(ccTrace);
      const maxI = ci.p(I.childcareMax);
      const vi = Math.min(care, maxI * counted.length);
      icc.push(
        item(
          '59.10',
          'household',
          ci,
          -vi,
          t(
            `Paid ${chf(care)}; at most ${chf(maxI)} per child under 14 (${counted.length}): ${chf(vi)}.`,
            `Payé ${chf(care)}${NB}; au plus ${chf(maxI)} par enfant de moins de 14 ans (${counted.length})${NB}: ${chf(vi)}.`,
          ),
        ),
      );
      const cf = new Trace().with(ccTrace);
      const maxF = cf.p(F.childcareMax);
      const vf = Math.min(care, maxF * counted.length);
      ifd.push(
        item(
          '59.12',
          'household',
          cf,
          -vf,
          t(
            `Paid ${chf(care)}; at most ${chf(maxF)} per child under 14 (${counted.length}): ${chf(vf)}.`,
            `Payé ${chf(care)}${NB}; au plus ${chf(maxF)} par enfant de moins de 14 ans (${counted.length})${NB}: ${chf(vf)}.`,
          ),
        ),
      );
    }
  }

  // Married couple deduction, IFD (59.20). The Geneva form takes it among the other deductions,
  // before the subtotal 92.20 (guide p. 13 and 31).
  if (couple) {
    const tr = new Trace();
    const v = tr.p(F.married);
    ifd.push(
      item(
        '59.20',
        'household',
        tr,
        -v,
        t(
          `Married couple living together: ${chf(v)}.`,
          `Époux vivant en ménage commun${NB}: ${chf(v)}.`,
        ),
      ),
    );
    if ((hh.medicalCosts?.value ?? 0) > 0 || (hh.donations?.value ?? 0) > 0)
      notes.add(notes.unverified, NOTE.coupleOrder);
  }

  // Medical costs (71.00): the part above 0.5 % (ICC) or 5 % (IFD) of the subtotal 92.20.
  const mTrace = new Trace();
  const medical = total(mTrace, [hh.medicalCosts]);
  const thresholdItem = (list: Item[], bp: Param<number>, tax: 'ICC' | 'IFD') => {
    const s9220 = incomeTotals(list, tax).subtotal9220;
    const tr = new Trace().with(mTrace).from(s9220);
    const rate = tr.p(bp);
    const { threshold: floor, deduction: v } = medicalDeduction(medical, s9220.amount, rate);
    if (v > 0)
      list.push(
        item(
          '71.00',
          'household',
          tr,
          -v,
          t(
            `Costs ${chf(medical)} less ${rate / 100} % of the subtotal 92.20 (${chf(s9220.amount)}), that is ${chf(floor)}: ${chf(v)}.`,
            `Frais ${chf(medical)} moins ${String(rate / 100).replace('.', ',')}${NB}% du sous-total 92.20 (${chf(s9220.amount)}), soit ${chf(floor)}${NB}: ${chf(v)}.`,
          ),
        ),
      );
    else
      notes.add(
        notes.notCounted,
        t(
          `Medical costs (${tax}): below the threshold, nothing to deduct.`,
          `Frais médicaux (${tax})${NB}: sous le seuil, rien à déduire.`,
        ),
      );
  };
  if (medical > 0) {
    thresholdItem(icc, I.medicalThresholdBp, 'ICC');
    thresholdItem(ifd, F.medicalThresholdBp, 'IFD');
  }

  // Donations (73.10, 73.20) up to 20 % of the subtotal 92.40; parties (74.00).
  const gTrace = new Trace();
  const gifts = total(gTrace, [hh.donations]);
  if (gifts > 0) {
    const s = incomeTotals(icc, 'ICC').subtotal9240;
    const ti = new Trace().with(gTrace).from(s);
    const { cap: capI, deduction: vi } = donationDeduction(
      gifts,
      s.amount,
      ti.p(I.donationsShareBp),
    );
    if (vi > 0)
      icc.push(
        item(
          '73.10',
          'household',
          ti,
          -vi,
          t(
            `Donations ${chf(gifts)}; at most 20 % of the subtotal 92.40 (${chf(s.amount)}), ${chf(capI)}: ${chf(vi)}.`,
            `Dons ${chf(gifts)}${NB}; au plus 20${NB}% du sous-total 92.40 (${chf(s.amount)}), ${chf(capI)}${NB}: ${chf(vi)}.`,
          ),
        ),
      );
    const sf = incomeTotals(ifd, 'IFD').subtotal9240;
    const tf = new Trace().with(gTrace).from(sf);
    const d = tf.p(F.donations);
    const { cap: capF, deduction: vf } = donationDeduction(gifts, sf.amount, d.shareBp, d.min);
    if (vf > 0)
      ifd.push(
        item(
          '73.20',
          'household',
          tf,
          -vf,
          t(
            `Donations ${chf(gifts)} (at least ${chf(d.min)} in the year); at most 20 % of the subtotal 92.40 (${chf(sf.amount)}), ${chf(capF)}: ${chf(vf)}.`,
            `Dons ${chf(gifts)} (au moins ${chf(d.min)} dans l’année)${NB}; au plus 20${NB}% du sous-total 92.40 (${chf(sf.amount)}), ${chf(capF)}${NB}: ${chf(vf)}.`,
          ),
        ),
      );
    else
      notes.add(
        notes.notCounted,
        t(
          `Donations under ${chf(d.min)} in the year are not deducted for the federal tax.`,
          `Les dons de moins de ${chf(d.min)} dans l’année ne sont pas déduits pour l’impôt fédéral.`,
        ),
      );
  }
  const pTrace = new Trace();
  const party = total(pTrace, [hh.politicalParty]);
  if (party > 0) {
    const ti = new Trace().with(pTrace);
    const vi = Math.min(party, ti.p(I.partyMax));
    icc.push(
      item(
        '74.00',
        'household',
        ti,
        -vi,
        t(
          `Paid ${chf(party)}, at most ${chf(I.partyMax.value)}: ${chf(vi)}.`,
          `Versé ${chf(party)}, au plus ${chf(I.partyMax.value)}${NB}: ${chf(vi)}.`,
        ),
      ),
    );
    const tf = new Trace().with(pTrace);
    const vf = Math.min(party, tf.p(F.partyMax));
    ifd.push(
      item(
        '74.00',
        'household',
        tf,
        -vf,
        t(
          `Paid ${chf(party)}, at most ${chf(F.partyMax.value)}: ${chf(vf)}.`,
          `Versé ${chf(party)}, au plus ${chf(F.partyMax.value)}${NB}: ${chf(vf)}.`,
        ),
      ),
    );
  }

  // Family charges (61.25 ICC, 61.20 IFD).
  if (children.length) {
    const tr = new Trace();
    const fc = tr.p(I.familyCharge);
    let v = 0;
    const parts: string[] = [];
    for (const c of children) {
      const care = caredFor.has(c);
      const amount =
        c.custody === 'full'
          ? care
            ? fc.fullWithChildcare
            : fc.full
          : care
            ? fc.halfWithChildcare
            : fc.half;
      v += amount;
      parts.push(chf(amount));
    }
    icc.push(
      item(
        '61.25',
        'household',
        tr,
        -v,
        t(
          `${children.length} child${children.length > 1 ? 'ren' : ''} (${parts.join(' + ')}; half for shared custody, less when childcare is deducted): ${chf(v)}.`,
          `${children.length} enfant${children.length > 1 ? 's' : ''} (${parts.join(' + ')}${NB}; moitié en garde alternée, moins quand des frais de garde sont déduits)${NB}: ${chf(v)}.`,
        ),
      ),
    );
    const tf = new Trace();
    const per = tf.p(F.child);
    const vf = per * full + (per / 2) * shared;
    ifd.push(
      item(
        '61.20',
        'household',
        tf,
        -vf,
        t(
          `${chf(per)} per child${shared ? ', half in shared custody' : ''}: ${chf(vf)}.`,
          `${chf(per)} par enfant${shared ? ', moitié en garde alternée' : ''}${NB}: ${chf(vf)}.`,
        ),
      ),
    );
  }

  // AVS/AI pensioners (61.30 ICC), on the subtotal 92.40.
  const rentiers = people.filter((p) => (p.pensionAvs?.value ?? 0) > 0).length;
  if (rentiers) {
    const s = incomeTotals(icc, 'ICC').subtotal9240;
    const tr = new Trace().from(s);
    const tables = tr.p(I.avsDeduction);
    const table = couple || full > 0 ? tables.couple : tables.other;
    const v = avsDeduction(table, s.amount, couple && rentiers > 1);
    if (v > 0)
      icc.push(
        item(
          '61.30',
          'household',
          tr,
          -v,
          t(
            `AVS/AI pension and a subtotal 92.40 of ${chf(s.amount)}: ${chf(v)} from the table.`,
            `Rente AVS/AI et un sous-total 92.40 de ${chf(s.amount)}${NB}: ${chf(v)} selon le tableau.`,
          ),
        ),
      );
  }

  // Splitting and scales.
  let splitting: IccSplitting = 'none';
  if (couple || full > 0) splitting = 'full';
  else if (shared > 0) {
    splitting = 'partial';
    notes.add(notes.assumptions, NOTE.partialSplitting);
  }
  if (input.splitting) splitting = input.splitting;
  let ifdScale: 'single' | 'married' | 'parental' = couple
    ? 'married'
    : full > 0
      ? 'parental'
      : 'single';
  let ifdUnsupported = false;
  if (shared > 0) {
    notes.add(notes.assumptions, NOTE.sharedCharges);
    if (!couple && full === 0) {
      if (input.ifdParentalScale === undefined) {
        ifdUnsupported = true;
        notes.add(notes.unsupported, NOTE.ifdShared);
      } else if (input.ifdParentalScale) ifdScale = 'parental';
    }
  }
  const ifdChildReductions = ifdScale === 'single' ? 0 : full + shared;

  // Withholding tax credit (imputation, guide p. 38): shown, not part of the tax.
  const whTrace = new Trace().src(`${GUIDE} p. 38`);
  const withheld = (input.movable ?? []).reduce((s, m) => s + whTrace.a(m.withholdingSwiss), 0);
  const withholdingTax: Line | undefined = withheld
    ? whTrace.line(
        withheld,
        t('Swiss withholding tax to be credited (impôt anticipé)', 'Impôt anticipé à imputer'),
        t(
          `35 % withheld on Swiss income, credited against the cantonal and communal tax: ${chf(withheld)}.`,
          `35${NB}% retenus sur les revenus suisses, imputés sur l’impôt cantonal et communal${NB}: ${chf(withheld)}.`,
        ),
      )
    : undefined;

  // Income other than salaries (pensions, securities, benefits...) belongs to the commune of
  // residence: the communal split is in proportion to all income (LCP art. 295A al. 2).
  const grossIcc = incomeTotals(icc, 'ICC').grossIncome.amount;
  const salaries = Object.values(incomeByCommune).reduce((s, v) => s + (v ?? 0), 0);
  if (grossIcc > salaries) {
    incomeByCommune[input.commune] = (incomeByCommune[input.commune] ?? 0) + grossIcc - salaries;
  }

  const result: Assessment = assess({
    taxYear: input.taxYear,
    commune: input.commune,
    couple,
    splitting,
    ifdScale,
    ifdChildReductions,
    wealthCharges: charges,
    singleWithChildren: !couple && full + shared > 0,
    incomeByCommune,
    iccItems: icc,
    wealthItems,
    ifdItems: ifd,
    ...(withholdingTax ? { withholdingTax } : {}),
  });

  if (Object.keys(incomeByCommune).some((c) => c !== input.commune))
    notes.add(notes.unverified, NOTE.communalSplit);
  notes.add(notes.unverified, NOTE.lineRounding);
  if (result.icc.taxes.personalTax.amount === 0) notes.add(notes.unverified, NOTE.personalTax);
  if (result.shieldMayApply) notes.add(notes.unsupported, NOTE.shield);

  const icc_ = result.shieldMayApply ? null : result.icc;
  const ifd_ = ifdUnsupported ? null : result.ifd;
  return {
    taxYear: input.taxYear,
    commune: input.commune,
    icc: icc_,
    ifd: ifd_,
    total: icc_ && ifd_ ? icc_.taxes.total.amount + ifd_.tax.amount : null,
    estimates: estimateNotes(icc_, ifd_),
    needsOk: [...(icc_?.items ?? []), ...(ifd_?.items ?? []), ...(icc_?.wealth.items ?? [])].filter(
      (i) => i.needsOk,
    ).length,
    assumptions: notes.assumptions,
    notCounted: notes.notCounted,
    unsupported: notes.unsupported,
    unverifiedRules: notes.unverified,
  };
}

/** Every line of a result, items first. */
export function allLines(r: Pick<TaxResult, 'icc' | 'ifd'>): (Line | Item)[] {
  const out: (Line | Item)[] = [];
  if (r.icc) {
    const i = r.icc;
    out.push(
      ...i.items,
      i.grossIncome,
      i.subtotal9220,
      i.subtotal9240,
      i.netIncome,
      i.taxableIncome,
      i.rateIncome,
    );
    out.push(
      ...i.wealth.items,
      i.wealth.grossWealth,
      i.wealth.netWealth,
      i.wealth.socialDeduction,
      i.wealth.taxableWealth,
    );
    const x = i.taxes;
    out.push(
      x.incomeBase,
      x.incomeCantonalCentimes,
      x.incomeReduction12,
      x.incomeHomeCare,
      x.incomeCantonal,
    );
    out.push(
      x.wealthBase,
      x.wealthCantonalCentimes,
      x.wealthHomeCare,
      x.wealthSupplementary,
      x.wealthCantonal,
    );
    for (const s of [x.communalIncome, x.communalWealth]) {
      out.push(s.privileged.base, s.privileged.tax, ...s.rest.flatMap((r) => [r.base, r.tax]));
    }
    out.push(x.communalIncomeTotal, x.communalWealthTotal, x.personalTax, x.total);
  }
  if (r.ifd) {
    const f = r.ifd;
    out.push(
      ...f.items,
      f.grossIncome,
      f.subtotal9220,
      f.subtotal9240,
      f.netIncome,
      f.taxableIncome,
      f.scaleIncome,
      f.scaleTax,
      f.childReduction,
      f.tax,
    );
  }
  return out;
}

function estimateNotes(icc: TaxResult['icc'], ifd: TaxResult['ifd']): EstimateNote[] {
  const notes = new Map<string, EstimateNote>();
  for (const line of allLines({ icc, ifd })) {
    for (const e of line.estimates ?? []) {
      if (e === 'input-estimate') {
        if ('code' in line && rubric(line.code)) {
          const id = `input:${line.code}:${line.person}`;
          notes.set(id, {
            id,
            what: t(
              `${line.label.en}: uses a figure you gave as an estimate.`,
              `${line.label.fr}${NB}: utilise un montant donné comme estimation.`,
            ),
          });
        }
      } else if (e in ESTIMATE_TEXT) {
        notes.set(e, { id: e, what: ESTIMATE_TEXT[e as keyof typeof ESTIMATE_TEXT] });
      }
    }
  }
  return [...notes.values()];
}
