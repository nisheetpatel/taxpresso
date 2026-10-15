// A year of arrival from abroad or of departure abroad: the tax liability covers part of the year
// only (assujettissement inférieur à une année; unterjährige Steuerpflicht). The rules every canton
// shares, for the federal tax, written so a canton's engine can reuse them.
//
// The law: the tax liability starts the day the person takes up residence in Switzerland and ends
// the day they leave (ch-na-law-lifd art. 8, p. 5). Only the income of that period is taxed; the
// rate of periodic income is the one of that income converted to twelve months; non-periodic
// income is taxed in full and not converted for the rate (art. 40 al. 3, p. 33). The social
// deductions are given in proportion (art. 35 al. 3, p. 29).
//
// How, as the federal documents say it:
// - the conversion: income x 360 / days of tax liability, salaries and pensions being periodic,
//   non-periodic income never converted (ch-2026-afc-guide-futur-contribuable p. 30, ch. 3.1.1.3;
//   p. 31, ch. 3.1.2.1 for an arrival; p. 40, ch. 3.2.6 for a departure). The days are counted 30 to
//   a month (a year of 360 days), as the formula's 360 implies.
// - the insurance premiums and savings interest (chiffre 14), the two-earner deduction (chiffre 16)
//   and the social deductions (chiffre 23: children, persons in need, the married couple) are
//   "adaptées proportionnellement"; the deductions are not reduced for the rate (Form. 2a of each
//   year, p. 1).
// - childcare and the child's share of the insurance deduction: pro rata temporis; the tax
//   reduction per child: in proportion of the taxable income to the income for the rate
//   (ch-na-circulaire-30-epoux-famille p. 26, ch. 13.4.6, with its example of an arrival from
//   abroad; p. 54, annex 2, row 13.4.6).
// - the flat deduction for other professional costs "doit être réduite de manière appropriée"
//   for an activity of part of the year (ch-na-ordonnance-frais-professionnels art. 7 al. 2, p. 3;
//   Form. 2a p. 6), without saying how: Taxpresso reduces its minimum and maximum in proportion to
//   the days, as the other deductions, and says so.
// - pillar 3a: its maximum is "par année" (ch-na-law-opp3 art. 7 al. 1, p. 6) and Form. 2a p. 1
//   doesn't list it among the deductions adapted for part of a year: the whole year's maximum.
//
// Pure functions on centimes. What isn't spelled out is flagged by the caller, or fails closed.
import { chf, federalScaleTax, roundFranc, Trace } from '../core/calc.js';
import type { Param } from '../core/cited.js';
import type { IfdScale, IfdTax, Line, Text } from '../core/types.js';
import type { IfdParams } from './params.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';

export type PartYearKind = 'arrival' | 'departure';

/** The period of tax liability within the tax year. */
export interface PartYear {
  kind: PartYearKind;
  /** The first and the last day of tax liability in the tax year, YYYY-MM-DD. */
  from: string;
  to: string;
  /** Days of tax liability, counted 30 to a month: 360 for a whole year. */
  days: number;
}

export class PartYearError extends Error {}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(date: string): [number, number, number] {
  const m = ISO.exec(date);
  if (!m) throw new PartYearError(`Not a date (YYYY-MM-DD): ${date}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (mo < 1 || mo > 12 || d < 1 || d > last) throw new PartYearError(`Not a date: ${date}`);
  return [y, mo, d];
}

const lastDay = (y: number, mo: number) => new Date(Date.UTC(y, mo, 0)).getUTCDate();

/**
 * Days from `from` to `to` (both included, the same year), 30 to a month: a month's last day counts
 * as its 30th, so a whole month is 30 days and a whole year 360 (ge-<year>-source-directives,
 * ch. 4.2.9: "30 jours par mois, y compris les mois comprenant 31 jours et le mois de février";
 * ch-2026-afc-guide-futur-contribuable p. 30: x 360 / days of tax liability).
 */
export function days360(from: string, to: string): number {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  if (y1 !== y2) throw new PartYearError('Both days must be in the same year.');
  const day = (y: number, m: number, d: number, end: boolean) =>
    d === lastDay(y, m) && end ? 30 : Math.min(d, 30);
  const start = (m1 - 1) * 30 + day(y1, m1, d1, false);
  const stop = (m2 - 1) * 30 + day(y2, m2, d2, true);
  if (stop < start) throw new PartYearError(`${to} is before ${from}.`);
  return stop - start + 1;
}

/**
 * The period of tax liability of a year of arrival (from the day of arrival to 31 December) or of
 * departure (from 1 January to the day of departure): ch-na-law-lifd art. 8 al. 1 and 2 (p. 5).
 * The date must be in the tax year.
 */
export function partYear(taxYear: number, kind: PartYearKind, date: string): PartYear {
  const [y] = parts(date);
  if (y !== taxYear) throw new PartYearError(`${date} is not in ${taxYear}.`);
  const from = kind === 'arrival' ? date : `${taxYear}-01-01`;
  const to = kind === 'arrival' ? `${taxYear}-12-31` : date;
  return { kind, from, to, days: days360(from, to) };
}

/** Where each rule of a part year is written, for the federal tax of a tax year. */
export function partYearSources(taxYear: number) {
  const instructions = `ch-${taxYear === 2025 ? 2025 : 2026}-ifd-instructions-personnes-physiques`;
  return {
    /** Start and end of the tax liability. */
    liability: 'ch-na-law-lifd art. 8 al. 1 and 2 (p. 5)',
    /** The income of the period, at the rate of a year's income; non-periodic not converted. */
    rate: `ch-na-law-lifd art. 40 al. 3 (p. 33); ${instructions} p. 1`,
    /** The formula: x 360 / days of tax liability. */
    conversion: 'ch-2026-afc-guide-futur-contribuable p. 30 (ch. 3.1.1.3)',
    /** Chiffres 14, 16 and 23 in proportion; not reduced for the rate. */
    deductions: `${instructions} p. 1; ch-na-law-lifd art. 35 al. 3 (p. 29)`,
    /** Childcare pro rata temporis (annex 2, row 13.4.6). */
    childcare: 'ch-na-circulaire-30-epoux-famille p. 54 (annex 2, 13.4.6)',
    /** The reduction per child in proportion of taxable to rate income. */
    childReduction: 'ch-na-circulaire-30-epoux-famille p. 26 (ch. 13.4.6)',
    /** The flat professional deduction "réduite de manière appropriée". */
    professionalFlat: `ch-na-ordonnance-frais-professionnels art. 7 al. 2 (p. 3); ${instructions} p. 6`,
    /** Pillar 3a: a yearly maximum, not among the deductions adapted. */
    pillar3a: `ch-na-law-opp3 art. 7 al. 1 (p. 6); ${instructions} p. 1`,
  } as const;
}

/** A yearly amount for the days of tax liability: x days / 360, to the franc. */
export function forDays(centimes: number, days: number): number {
  return roundFranc(centimes * days, 360);
}

/** An amount of the period converted to a year: x 360 / days, to the centime. */
export function toYear(centimes: number, days: number): number {
  if (days <= 0) throw new PartYearError('No day of tax liability.');
  return Math.round((centimes * 360) / days);
}

/** The same cited constant, its amounts for the days of tax liability, with the rule cited. */
function scaled<T>(p: Param<T>, f: (v: T) => T, source: string): Param<T> {
  return { ...p, value: f(p.value), source: `${p.source}; ${source}` };
}

/**
 * The federal amounts reduced in proportion for a part year (the module's header): the insurance
 * maximums, the two-earner minimum and maximum, the child and married couple deductions, the
 * childcare maximum per child and the flat professional deduction's minimum and maximum. The others
 * stay as they are (Form. 2a p. 1 lists only these; pillar 3a has a yearly maximum).
 */
export function ifdPartYearParams(F: IfdParams, py: PartYear, taxYear: number): IfdParams {
  const s = partYearSources(taxYear);
  const d = (c: number) => forDays(c, py.days);
  return {
    ...F,
    insurance: scaled(
      F.insurance,
      (v) => ({
        married: d(v.married),
        marriedNone: d(v.marriedNone),
        other: d(v.other),
        otherNone: d(v.otherNone),
        perChild: d(v.perChild),
      }),
      s.deductions,
    ),
    twoEarner: scaled(F.twoEarner, (v) => ({ ...v, min: d(v.min), max: d(v.max) }), s.deductions),
    child: scaled(F.child, d, s.deductions),
    married: scaled(F.married, d, s.deductions),
    childcareMax: scaled(F.childcareMax, d, s.childcare),
    professionalFlat: scaled(
      F.professionalFlat,
      (v) => ({ ...v, min: d(v.min), max: d(v.max) }),
      s.professionalFlat,
    ),
  };
}

/** a x b / c rounded down to a multiple of `step`, exactly (the product can pass 2^53). */
function mulDivDown(a: number, b: number, c: number, step: number): number {
  const n = BigInt(Math.round(a)) * BigInt(Math.round(b));
  const den = BigInt(Math.round(c)) * BigInt(step);
  return Number(n / den) * step;
}

/**
 * The federal tax of a part year, line by line, in the shape of a tax at a rate (the same as a
 * property abroad's, ../abroad/property.ts): `scaleIncome` and `scaleTax` are the year's income for
 * the rate and its tax by the scale, `atRate` that rate applied to the income of the period.
 */
export interface IfdPartYearTax extends IfdTax {
  atRate: Line;
}

/**
 * The federal tax of a part year (LIFD art. 40 al. 3): the scale's tax on `rateIncome` (the
 * taxable income of the year, periodic income converted) as a rate, applied to `taxable` (the
 * taxable income of the period); the tax reduction per child in the proportion of `taxable` to
 * `rateIncome` (circular 30, ch. 13.4.6); the minimum collected (art. 36 al. 3). Both incomes with
 * the fraction under CHF 100 dropped and the tax rounded down to 5 centimes, as Form. 58c says
 * (notes 1 and 2); how a rate is rounded is not spelled out (none here).
 */
export function ifdTaxPartYear(
  F: IfdParams,
  taxable: Line,
  rateIncome: Line,
  scale: IfdScale,
  childReductions: number,
  taxYear: number,
  scaleSources: readonly string[] = [],
): IfdPartYearTax {
  const s = partYearSources(taxYear);
  const trace = new Trace().from(rateIncome).src(s.rate, s.conversion);
  const rounding = trace.p(F.rounding);
  const step = rounding.incomeStep;
  const rateScale = Math.floor(Math.max(0, rateIncome.amount) / step) * step;
  const scaleIncome = trace.line(
    rateScale,
    t(
      'Income for the federal rate, a full year (revenu déterminant le taux)',
      'Revenu déterminant le taux, impôt fédéral',
    ),
    t(
      `${chf(rateIncome.amount)}, your income converted to a full year, with the fraction under CHF 100 dropped: ${chf(rateScale)}.`,
      `${chf(rateIncome.amount)}, votre revenu converti sur une année entière, sans la fraction inférieure à CHF 100${NB}: ${chf(rateScale)}.`,
    ),
  );
  const yTrace = new Trace().from(scaleIncome);
  const steps = yTrace.p(scale === 'single' ? F.singleScale : F.marriedScale);
  yTrace.src(...scaleSources);
  yTrace.p(F.rounding);
  const raw = federalScaleTax(steps, rateScale);
  const year = Math.floor(raw / rounding.taxStep) * rounding.taxStep;
  const scaleName =
    scale === 'single'
      ? t('single scale', 'barème de base')
      : scale === 'married'
        ? t('married scale', 'barème pour personnes mariées')
        : t('parental scale (the married scale)', 'barème parental (celui des personnes mariées)');
  const scaleTax = yTrace.line(
    year,
    t('Federal tax on a full year’s income', 'Impôt fédéral sur le revenu d’une année entière'),
    t(
      `The ${scaleName.en} at ${chf(rateScale)}: ${chf(raw)}, rounded down to 5 centimes: ${chf(year)}.`,
      `Le ${scaleName.fr} à ${chf(rateScale)}${NB}: ${chf(raw)}, ramené aux 5 centimes inférieurs${NB}: ${chf(year)}.`,
    ),
  );
  const here = Math.floor(Math.max(0, taxable.amount) / step) * step;
  const atTrace = new Trace().from(scaleTax, taxable).src(s.rate);
  atTrace.p(F.rounding);
  const atRate = rateScale > 0 ? mulDivDown(here, year, rateScale, rounding.taxStep) : 0;
  const atRateLine = atTrace.line(
    atRate,
    t(
      'Federal tax on the income of your months here, at a full year’s rate',
      'Impôt fédéral sur le revenu de la période, au taux d’une année entière',
    ),
    t(
      `${chf(here)} taxable for your months here x ${chf(year)} / ${chf(rateScale)}, rounded down to 5 centimes: ${chf(atRate)}.`,
      `${chf(here)} imposables pour la période x ${chf(year)} / ${chf(rateScale)}, ramené aux 5 centimes inférieurs${NB}: ${chf(atRate)}.`,
    ),
  );
  const crTrace = new Trace().from(atRateLine).src(...scaleSources, s.childReduction);
  const perChild = scale === 'single' ? 0 : crTrace.p(F.childTaxReduction);
  const full = perChild * childReductions;
  const share = full > 0 && rateScale > 0 ? mulDivDown(full, here, rateScale, rounding.taxStep) : 0;
  const reduction = -Math.min(atRate, Math.min(full, share));
  const childReduction = crTrace.line(
    reduction,
    t('Reduction per child', 'Réduction par enfant'),
    full
      ? t(
          `${chf(perChild)} x ${childReductions} child${childReductions === 1 ? '' : 'ren'}, in the proportion of ${chf(here)} to ${chf(rateScale)}, at most the tax: ${chf(reduction)}.`,
          `${chf(perChild)} x ${childReductions} enfant${childReductions === 1 ? '' : 's'}, dans la proportion de ${chf(here)} à ${chf(rateScale)}, au plus l’impôt${NB}: ${chf(reduction)}.`,
        )
      : t('No child: no reduction.', `Pas d’enfant${NB}: pas de réduction.`),
  );
  const minTrace = new Trace().from(atRateLine, childReduction);
  const minimum = minTrace.p(F.minimumCollected);
  const due = atRate + reduction;
  const tax = due < minimum ? 0 : due;
  const taxLine = minTrace.line(
    tax,
    t('Federal direct tax (IFD)', 'Impôt fédéral direct (IFD)'),
    due < minimum
      ? t(
          `${chf(due)} is under ${chf(minimum)}: not collected.`,
          `${chf(due)} est inférieur à ${chf(minimum)}${NB}: pas perçu.`,
        )
      : t(
          `${chf(atRate)} at a full year’s rate${reduction ? ` less ${chf(-reduction)} for the children` : ''}: ${chf(tax)}.`,
          `${chf(atRate)} au taux d’une année entière${reduction ? ` moins ${chf(-reduction)} pour les enfants` : ''}${NB}: ${chf(tax)}.`,
        ),
  );
  return { scaleIncome, scale, scaleTax, childReduction, atRate: atRateLine, tax: taxLine };
}
