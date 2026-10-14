// Real estate abroad owned by someone who lives in Switzerland, the rules every canton shares
// (docs/design/cantons.md, section 1). Switzerland doesn't tax it: the property, its income and its
// value are taxed where it lies; Switzerland counts them only to set the rate of what it taxes
// (exemption avec réserve de progression).
//
// The law: the unlimited tax liability of a resident doesn't reach real estate abroad
// (ch-na-law-lifd art. 6 al. 1, p. 4; each canton's law the same, Geneva ge-na-law-lipp art. 5
// al. 1); the tax on the rest is at the rate of the whole income (LIFD art. 7 al. 1, p. 5; LIPP
// art. 6 al. 1, for income and wealth); what belongs where follows the federal rules against
// intercantonal double taxation (LIFD art. 6 al. 3, p. 4; LIPP art. 5 al. 3); losses abroad count
// only for the rate (LIFD art. 6 al. 3; LIPP art. 5 al. 4); the social deductions are given in
// proportion when only part of the income is taxed (LIFD art. 35 al. 3, p. 29).
//
// How the split is made, as the Zurich tax manual sets out the federal rules, with the Federal
// Supreme Court's decisions (zh-na-zstb-5-3 p. 1 and 2, natural persons with a property abroad):
// the property's income and costs go to the property (objektmässig); debts and debt interest in
// proportion to where all the gross assets lie; a deduction linked to an income goes with it, the
// others and the social deductions in proportion to the net income; a loss abroad (costs or
// interest above the income) is not taken over, and counts only for the rate; a Swiss interest
// surplus "can be moved abroad", which no document says how to do. Geneva's own law says the same
// for debts and the wealth deductions (ge-na-law-lipp art. 57 and 58 al. 3: in proportion to the
// assets taxed in the canton and the total assets).
//
// Pure functions on centimes. Each canton names its lines and its form's codes; what isn't
// spelled out fails closed (the caller says so in plain words).
import { chf, federalScaleTax, Trace } from '../core/calc.js';
import type { Cited } from '../core/cited.js';
import type { IfdScale, Line, Text } from '../core/types.js';
import type { IfdParams } from '../ifd/params.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = '\u00a0';

/**
 * a x b / c to the nearest multiple of `step` (halves up), or rounded down when `down`, exactly:
 * the products of two amounts in centimes can pass the safe integers. a, b >= 0, c > 0.
 */
function mulDiv(a: number, b: number, c: number, step: number, down = false): number {
  const n = BigInt(Math.round(a)) * BigInt(Math.round(b));
  const d = BigInt(Math.round(c)) * BigInt(step);
  const q = down ? n / d : (2n * n + d) / (2n * d);
  return Number(q) * step;
}

/** Where each rule is written: manifest id plus article and page. */
export const ABROAD_RULES = {
  /** The tax doesn't reach real estate abroad. */
  exempt: 'ch-na-law-lifd art. 6 al. 1 (p. 4)',
  /** The rate of the whole (worldwide) income. */
  rate: 'ch-na-law-lifd art. 7 al. 1 (p. 5)',
  /** Debts and debt interest in proportion to where the gross assets lie. */
  debts: 'ch-na-law-lifd art. 6 al. 3 (p. 4); zh-na-zstb-5-3 p. 1',
  /** The other deductions and the social deductions in proportion to the net income. */
  deductions: 'ch-na-law-lifd art. 35 al. 3 (p. 29); zh-na-zstb-5-3 p. 1',
  /** A loss abroad counts only for the rate. */
  losses: 'ch-na-law-lifd art. 6 al. 3 (p. 4); zh-na-zstb-5-3 p. 2',
  /** A Swiss interest surplus can be moved abroad (no document says how). */
  surplus: 'zh-na-zstb-5-3 p. 1',
} as const;

/**
 * The federal flat deduction for the upkeep of a private building, instead of the actual costs: a
 * share of the gross rent or the rental value, by the building's age at the start of the tax year
 * (up to 10 years, more than 10). In basis points.
 */
export const IFD_UPKEEP_FLAT: Readonly<Record<2025 | 2026, Cited<{ young: number; old: number }>>> =
  {
    2025: {
      value: { young: 1000, old: 2000 },
      source: 'ch-2025-ifd-instructions-personnes-physiques p. 6',
    },
    2026: {
      value: { young: 1000, old: 2000 },
      source: 'ch-2026-ifd-instructions-personnes-physiques p. 6',
    },
  };

/**
 * The part of `amount` that goes abroad when it is split in proportion to the gross assets:
 * `amount` x `foreignGross` / `totalGross`, to the centime. Zero when there are no assets.
 */
export function shareAbroad(amount: number, foreignGross: number, totalGross: number): number {
  if (amount <= 0 || foreignGross <= 0 || totalGross <= 0) return 0;
  return Math.min(amount, mulDiv(amount, foreignGross, totalGross, 1));
}

/** The figures a split of the net income rests on, in one tax. */
export interface IncomeSplit {
  /** The income of the property abroad, less its own costs and its share of debt interest. */
  foreign: number;
  /** The whole net income before the deductions not linked to an income (worldwide). */
  world: number;
}

/**
 * Why the split can't be made, from its figures, or undefined when it can: a loss abroad (the
 * property's costs and its share of interest above its income), a loss in Switzerland, or a Swiss
 * share of debt interest above the Swiss income from wealth (the surplus the documents say "can be
 * moved abroad" without saying how).
 */
export function splitProblem(
  split: IncomeSplit,
  interest?: { swissShare: number; swissWealthIncome: number },
): 'loss_abroad' | 'loss_switzerland' | 'interest_surplus' | undefined {
  if (split.foreign < 0) return 'loss_abroad';
  if (split.world - split.foreign < 0) return 'loss_switzerland';
  if (interest && interest.swissShare > interest.swissWealthIncome) return 'interest_surplus';
  return undefined;
}

/**
 * The part of the total `rateBase` (the worldwide net income or wealth after every deduction, in
 * whole francs) that is not taxed here: `rateBase` x `foreign` / `world`, to the franc, between 0
 * and `rateBase`. The canton names the line (Geneva: 97.00, part proportionnelle non imposable).
 */
export function exemptPart(rateBase: number, foreign: number, world: number): number {
  if (rateBase <= 0 || foreign <= 0 || world <= 0) return 0;
  return Math.min(rateBase, mulDiv(rateBase, foreign, world, 100));
}

/** The federal tax on the income taxed in Switzerland, at the rate of the worldwide income. */
export interface IfdAtRate {
  /** The worldwide income the rate is read at: fractions under CHF 100 dropped. */
  scaleIncome: Line;
  scale: IfdScale;
  /** The scale's tax on the worldwide income, rounded down to 5 centimes. */
  scaleTax: Line;
  /** No reduction per child here: the caller fails closed when one would apply. */
  childReduction: Line;
  /** That tax's rate applied to the income taxed in Switzerland. */
  atRate: Line;
  /** The federal tax, after the minimum collected. */
  tax: Line;
}

/**
 * The federal tax at the rate of the worldwide income (LIFD art. 7 al. 1): the scale's tax on
 * `rateIncome` (the worldwide taxable income), as a rate, applied to `taxable` (the part taxed in
 * Switzerland), both with the fraction under CHF 100 dropped as Form. 58c does (note 1), the result
 * rounded down to 5 centimes (note 2). Not spelled out: the rounding of the rate itself (none
 * here) and how the reduction per child applies at a rate (the caller doesn't call this then).
 */
export function ifdTaxAtRate(
  F: IfdParams,
  rateIncome: Line,
  taxable: Line,
  scale: IfdScale,
  scaleSources: readonly string[] = [],
): IfdAtRate {
  const trace = new Trace().from(rateIncome).src(ABROAD_RULES.rate);
  const rounding = trace.p(F.rounding);
  const step = rounding.incomeStep;
  const scaleIncome = Math.floor(Math.max(0, rateIncome.amount) / step) * step;
  const scaleIncomeLine = trace.line(
    scaleIncome,
    t(
      'Worldwide income for the federal rate (revenu déterminant le taux)',
      'Revenu déterminant le taux, impôt fédéral',
    ),
    t(
      `${chf(rateIncome.amount)}, your whole income, with the fraction under CHF 100 dropped: ${chf(scaleIncome)}.`,
      `${chf(rateIncome.amount)}, l’ensemble de votre revenu, sans la fraction inférieure à CHF 100${NB}: ${chf(scaleIncome)}.`,
    ),
  );
  const stTrace = new Trace().from(scaleIncomeLine);
  const steps = stTrace.p(scale === 'single' ? F.singleScale : F.marriedScale);
  stTrace.src(...scaleSources);
  stTrace.p(F.rounding);
  const raw = federalScaleTax(steps, scaleIncome);
  const scaleTax = Math.floor(raw / rounding.taxStep) * rounding.taxStep;
  const scaleTaxLine = stTrace.line(
    scaleTax,
    t('Federal tax on the whole income, by the scale', 'Impôt fédéral sur le revenu entier'),
    t(
      `The ${scale === 'single' ? 'single' : 'married'} scale at ${chf(scaleIncome)}: ${chf(raw)}, rounded down to 5 centimes: ${chf(scaleTax)}.`,
      `Le barème ${scale === 'single' ? 'de base' : 'des personnes mariées'} à ${chf(scaleIncome)}${NB}: ${chf(raw)}, ramené aux 5 centimes inférieurs${NB}: ${chf(scaleTax)}.`,
    ),
  );
  const childReduction = new Trace().line(
    0,
    t('Reduction per child', 'Réduction par enfant'),
    t('No child: no reduction.', `Pas d’enfant${NB}: pas de réduction.`),
  );
  const atTrace = new Trace().from(scaleTaxLine, taxable).src(ABROAD_RULES.rate);
  atTrace.p(F.rounding);
  const here = Math.floor(Math.max(0, taxable.amount) / step) * step;
  const atRate = scaleIncome > 0 ? mulDiv(here, scaleTax, scaleIncome, rounding.taxStep, true) : 0;
  const atRateLine = atTrace.line(
    atRate,
    t(
      'Federal tax on the income taxed in Switzerland, at the rate of the whole income',
      'Impôt fédéral sur le revenu imposable en Suisse, au taux du revenu entier',
    ),
    t(
      `${chf(here)} taxed in Switzerland x ${chf(scaleTax)} / ${chf(scaleIncome)}, rounded down to 5 centimes: ${chf(atRate)}.`,
      `${chf(here)} imposable en Suisse x ${chf(scaleTax)} / ${chf(scaleIncome)}, ramené aux 5 centimes inférieurs${NB}: ${chf(atRate)}.`,
    ),
  );
  const minTrace = new Trace().from(atRateLine);
  const minimum = minTrace.p(F.minimumCollected);
  const tax = atRate < minimum ? 0 : atRate;
  const taxLine = minTrace.line(
    tax,
    t('Federal direct tax (IFD)', 'Impôt fédéral direct (IFD)'),
    atRate < minimum
      ? t(
          `${chf(atRate)} is under ${chf(minimum)}: not collected.`,
          `${chf(atRate)} est inférieur à ${chf(minimum)}${NB}: pas perçu.`,
        )
      : t(
          `At the rate of your whole income: ${chf(tax)}.`,
          `Au taux de l’ensemble de votre revenu${NB}: ${chf(tax)}.`,
        ),
  );
  return {
    scaleIncome: scaleIncomeLine,
    scale,
    scaleTax: scaleTaxLine,
    childReduction,
    atRate: atRateLine,
    tax: taxLine,
  };
}
