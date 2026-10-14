// A year of arrival from abroad or of departure abroad in Geneva (assujettissement partiel): Geneva
// taxes the income of the period of tax liability only, at the rate of a full year's income, and
// the wealth on the day the liability ends (ge-2025-guide-declaration-pp p. 53, arrival from abroad;
// p. 54, departure abroad), for the cantonal tax and the federal tax alike.
//
// The cantonal law (ge-na-law-lipp): the liability starts the day of arrival and ends the day of
// departure (art. 7 al. 1 and 2); the income of the period is taxed, the rate of periodic income is
// the one of that income converted to twelve months, non-periodic income is not converted (art. 62
// al. 3), and the deductions follow the same rule (al. 4); the social deductions are set by the
// situation at the end of the liability, given in proportion and counted in full for the rate
// (art. 65 al. 1 and 2); wealth is taken at the end of the liability and only the tax for that
// period is levied (art. 64 al. 1 and 3). The federal tax: packages/rules-ch, ifd/part-year.ts.
//
// How the engine does it (./compute.ts): two runs of the same rules. The year: periodic income and
// what is paid by the month converted to a year (x 360 / days, the days counted 30 to a month), the
// deductions at their full amounts; its taxable income is the income for the rate (revenu
// déterminant le taux). The period: the amounts as they are, with the deductions the documents
// reduce in proportion (the cantonal family charges; the federal ones of rules-ch); its taxable
// income is what is taxed (99.00), at the year's rate.
//
// What the documents don't spell out fails closed (partYearUnsupported, and ./compute.ts for the
// wealth and the taxe personnelle), each with its reason in plain words.
import {
  chf,
  floorFranc,
  forDays,
  ifdPartYearParams,
  partYear,
  PartYearError,
  partYearSources,
  toYear,
  Trace,
  type Amount,
  type Line,
  type PartYear,
} from '@taxpresso/rules-ch';
import { EngineInputError } from './errors.js';
import type { YearParams } from './params.js';
import type { EngineInput, PersonInput, Text } from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';

/** Where each Geneva rule of a part year is written, per tax year (citations of that year). */
export function partYearRules(taxYear: number) {
  const directives = taxYear === 2025 ? 'ge-2025-source-directives' : 'ge-2026-source-directives';
  const thirty = taxYear === 2025 ? 'p. 20' : 'p. 21';
  const federal = partYearSources(taxYear);
  return {
    /** The income of the period at the rate of a full year: arrival p. 53, departure p. 54. */
    rate: 'ge-na-law-lipp art. 62 al. 3 and 4; ge-2025-guide-declaration-pp p. 53 and 54',
    /** x 360 / days of liability, 30 days to a month. */
    conversion: `${federal.conversion}; ${directives} ${thirty} (ch. 4.2.9)`,
    /** Social deductions in proportion, in full for the rate. */
    social: 'ge-na-law-lipp art. 65 al. 1 and 2',
    /** Wealth at the end of the liability; the tax for the period only. */
    wealth: 'ge-na-law-lipp art. 64 al. 1 and 3; ge-2025-guide-declaration-pp p. 54',
    /** The liability starts on arrival and ends on departure. */
    liability: 'ge-na-law-lipp art. 7 al. 1 and 2',
    /** The taxe personnelle: due from the first day of residence, 25 francs a year. */
    personalTax: `${directives} ${taxYear === 2025 ? 'p. 53' : 'p. 54'} (ch. 8.8); ge-na-law-lcp art. 375`,
    federal,
  } as const;
}

/** The period of tax liability of the input, or undefined for a whole year. */
export function partYearOf(input: EngineInput): PartYear | undefined {
  if (!input.period) return undefined;
  try {
    return partYear(input.taxYear, input.period.kind, input.period.date);
  } catch (err) {
    if (err instanceof PartYearError) throw new EngineInputError(err.message);
    throw err;
  }
}

/** A day in words, for the notes: "1 April 2026", "1er avril 2026". */
export function dayText(date: string): Text {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const en = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const fr = [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ];
  return t(`${d} ${en[m - 1]} ${y}`, `${d === 1 ? '1er' : d} ${fr[m - 1]} ${y}`);
}

/** Why the engine can't prepare this part year, before computing anything (fail closed). */
export function partYearUnsupported(input: EngineInput, py: PartYear): Text[] {
  const out: Text[] = [];
  const left = py.kind === 'departure';
  const year = t(
    left ? 'in the year you left Switzerland' : 'in the year you arrived from abroad',
    left ? 'l’année de votre départ de Suisse' : 'l’année de votre arrivée de l’étranger',
  );
  const no = (what: Text, why: Text) =>
    out.push(
      t(
        `${what.en} ${year.en}: ${why.en} Taxpresso doesn’t prepare it yet, so no tax is computed.`,
        `${what.fr}, ${year.fr}${NB}: ${why.fr} Taxpresso ne le prépare pas encore, aucun impôt n’est donc calculé.`,
      ),
    );
  const people = input.people;
  if (people.some((p) => p.business || p.selfEmploymentProfit)) {
    no(
      t('Self-employment', 'Une activité indépendante'),
      t(
        'the business’s accounts close at the end of the tax liability and its profit is converted to a year for the rate in ways the guides don’t spell out for this case.',
        'les comptes se bouclent à la fin de l’assujettissement et le bénéfice est converti sur une année pour le taux selon des règles que les guides ne détaillent pas pour ce cas.',
      ),
    );
  }
  if (people.some((p) => (p.replacementIncome?.value ?? 0) > 0)) {
    no(
      t(
        'Benefits replacing a salary (unemployment, sickness, accident)',
        'Des indemnités (chômage, maladie, accident)',
      ),
      t(
        'the documents don’t say whether they count as periodic income, converted to a year for the rate.',
        'les documents ne disent pas si elles comptent comme un revenu périodique, converti sur une année pour le taux.',
      ),
    );
  }
  if (people.some((p) => p.employments?.some((e) => (e.nonPeriodic?.value ?? 0) > 0))) {
    no(
      t(
        'Pay that isn’t monthly salary on a salary certificate (box 3 to 7: a bonus, capital, participations, board fees, other benefits)',
        'Des prestations non périodiques sur un certificat de salaire (chiffres 3 à 7 : bonus, capital, participations, honoraires, autres prestations)',
      ),
      t(
        'it isn’t converted to a year for the rate, and the documents don’t say how the contributions on it count.',
        'elles ne sont pas converties sur une année pour le taux, et les documents ne disent pas comment compter les cotisations prélevées dessus.',
      ),
    );
  }
  if (people.some((p) => (p.pensionAvs?.value ?? 0) > 0)) {
    no(
      t('An AVS or AI pension', 'Une rente AVS ou AI'),
      t(
        'the cantonal deduction for pensioners (61.30) depends on the net income, and the documents don’t say which one counts for part of a year.',
        'la déduction cantonale pour rentiers (61.30) dépend du revenu net, et les documents ne disent pas lequel compte pour une partie de l’année.',
      ),
    );
  }
  if (input.abroad) {
    no(
      t('A home or land abroad', 'Un immeuble à l’étranger'),
      t(
        'the documents don’t say how its share is set when only part of the year is taxed here.',
        'les documents ne disent pas comment fixer sa part quand seule une partie de l’année est imposée ici.',
      ),
    );
  }
  return out;
}

/** An amount converted to a year (x 360 / days), keeping its status and facts. */
function yearly(a: Amount | undefined, py: PartYear): Amount | undefined {
  return a ? { ...a, value: toYear(a.value, py.days) } : undefined;
}

const put = <K extends string, V>(key: K, v: V | undefined) =>
  (v === undefined ? {} : { [key]: v }) as Partial<Record<K, V>>;

/**
 * The year's input for the rate: what is earned or paid by the month converted to a year (the
 * salary with its contributions and work costs, pensions, health and accident premiums, the
 * subsidy, childcare), the rest as it is (pillar 3a, buy-ins, medical costs, donations, savings and
 * their costs, wealth). LIPP art. 62 al. 3 and 4; LIFD art. 40 al. 3; the federal guide's
 * formula. Without its period: the rules of a whole year apply to it.
 */
export function yearInput(input: EngineInput, py: PartYear): EngineInput {
  const person = (p: PersonInput): PersonInput => ({
    ...p,
    ...(p.employments
      ? {
          employments: p.employments.map((e) => ({
            ...e,
            gross: yearly(e.gross, py)!,
            ...put('socialContributions', yearly(e.socialContributions, py)),
            ...put('pensionFund', yearly(e.pensionFund, py)),
          })),
        }
      : {}),
    ...put('pensionAvs', yearly(p.pensionAvs, py)),
    ...put('pensionOccupational', yearly(p.pensionOccupational, py)),
    ...put('pensionOther', yearly(p.pensionOther, py)),
    ...put('alimonyReceived', yearly(p.alimonyReceived, py)),
    ...put('commuteCost', yearly(p.commuteCost, py)),
    ...put('otherProfessionalCosts', yearly(p.otherProfessionalCosts, py)),
    ...(p.commuteMode?.days !== undefined
      ? {
          commuteMode: {
            ...p.commuteMode,
            days: Math.round((p.commuteMode.days * 360) / py.days),
          },
        }
      : {}),
    ...(p.mealDays !== undefined ? { mealDays: Math.round((p.mealDays * 360) / py.days) } : {}),
  });
  const hh = input.household;
  const { period: _period, ...rest } = input;
  return {
    ...rest,
    people: input.people.map(person),
    ...(input.children
      ? {
          children: input.children.map((c) => ({
            ...c,
            ...put('childcare', yearly(c.childcare, py)),
          })),
        }
      : {}),
    ...(hh
      ? {
          household: {
            ...hh,
            ...put('healthPremiums', yearly(hh.healthPremiums, py)),
            ...put('accidentPremiums', yearly(hh.accidentPremiums, py)),
            ...put('healthSubsidy', yearly(hh.healthSubsidy, py)),
            ...put('childcare', yearly(hh.childcare, py)),
            ...put('alimonyPaid', yearly(hh.alimonyPaid, py)),
          },
        }
      : {}),
  };
}

/**
 * The constants of the period: the cantonal family charges in proportion (LIPP art. 65 al. 2) and
 * the federal amounts rules-ch reduces (ifdPartYearParams); every other amount as for a year.
 */
export function periodParams(P: YearParams, py: PartYear): YearParams {
  const d = (c: number) => forDays(c, py.days);
  const r = partYearRules(P.taxYear);
  const fc = P.icc.familyCharge;
  return {
    ...P,
    icc: {
      ...P.icc,
      familyCharge: {
        ...fc,
        value: {
          full: d(fc.value.full),
          half: d(fc.value.half),
          fullWithChildcare: d(fc.value.fullWithChildcare),
          halfWithChildcare: d(fc.value.halfWithChildcare),
        },
        source: `${fc.source}; ${r.social}`,
      },
    },
    ifd: ifdPartYearParams(P.ifd, py, P.taxYear),
  };
}

/**
 * The form's lines for the rate in a part year, in one tax (ge-2025-declaration-specimen p. 3):
 * 95.00 "Revenu net total, le cas échéant, revenu net pour le taux", the year's total net income
 * (periodic income converted); 97.00 "Part proportionnelle du revenu non imposable", what of it is
 * not taxed here, 95.00 less 99.00 (never below zero); 99.00 stays the income of the period.
 */
export function rateLines(
  yearTotal: Line,
  taxable: Line,
  tax: 'ICC' | 'IFD',
  py: PartYear,
): { rateTotal: Line; notTaxed: Line } {
  const r = partYearRules(Number(py.from.slice(0, 4)));
  const rate = floorFranc(yearTotal.amount);
  const rateTotal = new Trace()
    .src('ge-2025-declaration-specimen p. 3', r.rate, r.conversion)
    .from(yearTotal)
    .line(
      rate,
      t(
        `Net income for the rate, a full year, ${tax} (revenu net pour le taux, 95.00)`,
        `Revenu net pour le taux ${tax}, une année entière (95.00)`,
      ),
      t(
        `Your total net income converted to a full year (${py.days} of 360 days), in whole francs: ${chf(rate)}.`,
        `Votre revenu net total converti sur une année entière (${py.days} jours sur 360), en francs entiers${NB}: ${chf(rate)}.`,
      ),
    );
  const part = Math.max(0, rate - taxable.amount);
  const notTaxed = new Trace()
    .src('ge-2025-declaration-specimen p. 3', r.rate)
    .from(rateTotal, taxable)
    .line(
      part,
      t(
        `Share of the income not taxed here, ${tax} (part proportionnelle du revenu non imposable, 97.00)`,
        `Part proportionnelle du revenu non imposable ${tax} (97.00)`,
      ),
      t(
        `The income for the rate ${chf(rate)} less the income of your months here (99.00) ${chf(taxable.amount)}: ${chf(part)}.`,
        `Le revenu pour le taux ${chf(rate)} moins le revenu de votre période ici (99.00) ${chf(taxable.amount)}${NB}: ${chf(part)}.`,
      ),
    );
  return { rateTotal, notTaxed };
}

/** The engine's words about a part year, for the result's notes. */
export function partYearNotes(py: PartYear) {
  const day = dayText(py.kind === 'arrival' ? py.from : py.to);
  const arrival = py.kind === 'arrival';
  const months = t(`${py.days} of 360 days`, `${py.days} jours sur 360`);
  return {
    period: t(
      arrival
        ? `You arrived from abroad on ${day.en}: Geneva taxes your income from then to 31 December (${months.en}), at the rate of a full year’s income, and your wealth on 31 December.`
        : `You left Switzerland on ${day.en}: Geneva taxes your income from 1 January to then (${months.en}), at the rate of a full year’s income, and your wealth on the day you left.`,
      arrival
        ? `Vous êtes arrivé de l’étranger le ${day.fr}${NB}: Genève impose votre revenu de cette date au 31 décembre (${months.fr}), au taux d’un revenu annuel, et votre fortune au 31 décembre.`
        : `Vous avez quitté la Suisse le ${day.fr}${NB}: Genève impose votre revenu du 1er janvier à cette date (${months.fr}), au taux d’un revenu annuel, et votre fortune au jour du départ.`,
    ),
    reduced: t(
      `For your months here, these deductions are reduced in proportion (${months.en}): the cantonal family charges (61.25), and for the federal tax the insurance premiums (52.00), the two-earner deduction (31.90), the child and couple deductions (61.20, 59.20), childcare (59.12) and the flat professional costs (31.20). For the rate they count in full.`,
      `Pour votre période ici, ces déductions sont réduites en proportion (${months.fr})${NB}: les charges de famille cantonales (61.25) et, pour l’impôt fédéral, les primes d’assurance (52.00), la déduction pour couple à deux revenus (31.90), les déductions pour enfant et pour couple marié (61.20, 59.20), les frais de garde (59.12) et le forfait des frais professionnels (31.20). Pour le taux, elles comptent en entier.`,
    ),
    converted: t(
      'For the rate (revenu déterminant le taux), Taxpresso converts to a full year what is earned or paid by the month: your salary with its contributions and work costs, pensions, health and accident premiums and childcare. One-off payments (pillar 3a, a pension fund buy-in, medical costs, donations) and the income and costs of your savings are taken as they are: the documents name salaries and pensions as periodic income, not the others.',
      `Pour le taux (revenu déterminant le taux), Taxpresso convertit sur une année entière ce qui est gagné ou payé chaque mois${NB}: votre salaire avec ses cotisations et ses frais professionnels, les rentes, les primes d’assurance-maladie et accidents et les frais de garde. Les versements uniques (3e pilier A, rachat de prévoyance, frais médicaux, dons) et les revenus et frais de votre épargne sont pris tels quels${NB}: les documents désignent les salaires et les rentes comme revenus périodiques, pas les autres.`,
    ),
    days: t(
      'Days are counted 30 to a month, 360 to a year, as the federal guide’s formula (x 360 / days) and the source-tax directives do; Geneva’s guide doesn’t say how for the ordinary tax.',
      `Les jours sont comptés à 30 par mois, 360 par an, comme la formule du guide fédéral (x 360 / jours) et les directives sur l’impôt à la source${NB}; le guide genevois ne le précise pas pour l’impôt ordinaire.`,
    ),
    limits: t(
      'Geneva’s law reduces only the social deductions for part of a year (LIPP art. 65 al. 2): the cantonal limits of the other deductions (flat professional costs, insurance, two earners) apply as for a year. The federal flat professional costs are reduced in proportion: the ordinance says “appropriately”, without saying how.',
      `La loi genevoise ne réduit que les déductions sociales pour une partie de l’année (LIPP art. 65 al. 2)${NB}: les limites cantonales des autres déductions (forfait des frais professionnels, assurances, double activité) s’appliquent comme pour une année. Le forfait fédéral des frais professionnels est réduit en proportion${NB}: l’ordonnance dit «${NB}de manière appropriée${NB}», sans préciser comment.`,
    ),
    pillar3a: t(
      'Pillar 3a: the whole year’s maximum applies, also for part of a year (OPP 3 art. 7: a maximum per year; the federal instructions don’t list it among the deductions reduced).',
      `3e pilier A${NB}: le maximum de l’année entière s’applique, aussi pour une partie de l’année (OPP 3 art. 7${NB}: un maximum par année${NB}; les instructions fédérales ne le citent pas parmi les déductions réduites).`,
    ),
    personalTax: t(
      'Taxe personnelle: CHF 25 a year, due from your first day of residence (source-tax directives, ch. 8.8); no document reduces it for part of a year.',
      `Taxe personnelle${NB}: CHF 25 par an, due dès le premier jour de résidence (directives sur l’impôt à la source, ch. 8.8)${NB}; aucun document ne la réduit pour une partie de l’année.`,
    ),
    departureWealth: t(
      'You left Switzerland: your wealth counts on the day you left (guide p. 54). Give your accounts and debts on that day, not on 31 December.',
      `Vous avez quitté la Suisse${NB}: votre fortune compte au jour du départ (guide p. 54). Indiquez vos comptes et vos dettes à cette date, pas au 31 décembre.`,
    ),
    wealth: t(
      'Wealth tax not computed: your wealth is above the wealth deduction, and for part of a year Geneva’s law reduces the tax (LIPP art. 64 al. 3) and also gives the social deductions in proportion (art. 65 al. 2), without saying how the two go together or how the days are counted. Taxpresso doesn’t compute the cantonal tax then; the federal tax has no wealth tax.',
      `Impôt sur la fortune non calculé${NB}: votre fortune dépasse la déduction sociale, et pour une partie de l’année la loi genevoise réduit l’impôt (LIPP art. 64 al. 3) et accorde aussi les déductions sociales en proportion (art. 65 al. 2), sans dire comment les deux se combinent ni comment compter les jours. Taxpresso ne calcule donc pas l’impôt cantonal${NB}; l’impôt fédéral n’a pas d’impôt sur la fortune.`,
    ),
    personalTaxUnclear: t(
      'Taxe personnelle not computed: with your income of your months here you would be exempt, with a full year’s income you wouldn’t (LCP art. 377), and the documents don’t say which counts for part of a year. Taxpresso doesn’t compute the cantonal tax then.',
      `Taxe personnelle non calculée${NB}: avec le revenu de votre période ici, vous en seriez exonéré, avec celui d’une année entière non (LCP art. 377), et les documents ne disent pas lequel compte pour une partie de l’année. Taxpresso ne calcule donc pas l’impôt cantonal.`,
    ),
  };
}
