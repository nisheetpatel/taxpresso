// Self-employment (activité lucrative indépendante), the simple case: one sole proprietorship
// (raison individuelle) and its year, the same in the cantonal and the federal tax. What every canton
// shares: the year's result from the accounts or simple records the owner keeps, the owner's own
// AVS/AI/APG contributions, the business wealth, the losses of the seven previous business years,
// and the earned income that pillar 3a and the two-earner deduction start from. All money in integer
// centimes; each line of the accounts in whole francs, as the forms take them.
//
// The federal rules, read in the documents:
// - income: every revenue of the business, its result as the accounts give it (ch-na-law-lifd
//   art. 18 al. 1, p. 11; Form. 2a, chiffre 2: ch-2025-ifd-instructions-personnes-physiques p. 2,
//   ch-2026-ifd-instructions-personnes-physiques p. 2);
// - the costs, depreciation and provisions the accounts deduct (ch-na-law-lifd art. 27 to 29, p. 21
//   to 23): taken as the accounts give them, never checked here;
// - losses of the seven business years before the tax period, as far as they were not deducted yet
//   (ch-na-law-lifd art. 31 al. 1, p. 23; Form. 2a p. 3: 2018 to 2024 for 2025, 2019 to 2025 for 2026);
// - the owner's own AVS/AI/APG contributions, deducted in full (ch-na-law-lifd art. 33 al. 1 let. d
//   and f, p. 25);
// - pillar 3a: no deduction when the activity makes a loss; without a pension fund, a share of the
//   income of every activity, salaried or self-employed (Form. 2a p. 7, chiffre 13).
// A canton puts each figure on its own form's lines (Geneva: annexe B, ge-2025-guide-independants).
import { chf, roundFranc, Trace } from '../core/calc.js';
import type { Amount, BusinessInput, Line, Text } from '../core/types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const LIFD = 'ch-na-law-lifd';

/** The federal instructions of each tax year (Form. 2a), as the library has them. */
export const SELF_EMPLOYMENT_FEDERAL: Readonly<
  Record<
    2025 | 2026,
    {
      /** The instructions of the year. */
      instructions: string;
      /** The seven business years whose losses count: the first and the last. */
      lossYears: readonly [number, number];
    }
  >
> = {
  2025: { instructions: 'ch-2025-ifd-instructions-personnes-physiques', lossYears: [2018, 2024] },
  2026: { instructions: 'ch-2026-ifd-instructions-personnes-physiques', lossYears: [2019, 2025] },
};

/** The rules each figure follows, cited (the canton adds its own form's pages). */
export const SELF_EMPLOYMENT_RULES = {
  income: `${LIFD} art. 18 al. 1 (p. 11)`,
  costs: `${LIFD} art. 27 to 29 (p. 21 to 23)`,
  losses: `${LIFD} art. 31 al. 1 (p. 23)`,
  avs: `${LIFD} art. 33 al. 1 let. d and f (p. 25)`,
} as const;

/** The lines of the accounts, in the order of the profit and loss account and the balance sheet. */
export const REVENUE_LINES = ['turnover', 'benefits', 'financialIncome', 'otherIncome'] as const;
export const CHARGE_LINES = [
  'costsGoods',
  'costsStaff',
  'depreciation',
  'provisions',
  'interest',
  'costsOther',
] as const;
export type RevenueLine = (typeof REVENUE_LINES)[number];
export type ChargeLine = (typeof CHARGE_LINES)[number];

/** One figure: its amount in centimes (whole francs) and what it rests on. */
export interface BusinessFigure {
  amount: number;
  trace: Trace;
}

export interface BusinessYear {
  /** Some line of the accounts was given. */
  hasAccounts: boolean;
  /** Each line of the profit and loss account, in whole francs. */
  revenue: Record<RevenueLine, BusinessFigure>;
  charges: Record<ChargeLine, BusinessFigure>;
  /** Total revenue, total charges, and the result (profit, or a loss when negative). */
  totalRevenue: BusinessFigure;
  totalCharges: BusinessFigure;
  result: BusinessFigure;
  /** The balance sheet: current and fixed assets, their sum, the business debts, the equity. */
  currentAssets: BusinessFigure;
  fixedAssets: BusinessFigure;
  grossAssets: BusinessFigure;
  liabilities: BusinessFigure;
  equity: BusinessFigure;
  hasBalance: boolean;
  /** The owner's own AVS/AI/APG contributions: for the year, and for earlier years. */
  avsYear: BusinessFigure;
  avsEarlier: BusinessFigure;
  hasAvs: boolean;
  /** The result less the owner's AVS/AI/APG contributions: the earned income of the business. */
  earned: BusinessFigure;
  /** Losses of earlier years to deduct, for each tax. */
  priorLosses: { cantonal: BusinessFigure; federal: BusinessFigure };
}

const figure = (amount: Amount | undefined): BusinessFigure => {
  const trace = new Trace();
  return { amount: roundFranc(trace.a(amount)), trace };
};

const sum = (figures: readonly BusinessFigure[], sign: 1 | -1 = 1, start?: BusinessFigure) => {
  const trace = new Trace().with(...figures.map((f) => f.trace), ...(start ? [start.trace] : []));
  const amount = figures.reduce((s, f) => s + sign * f.amount, start?.amount ?? 0);
  return { amount, trace };
};

/**
 * The year of a sole proprietorship: each line of its accounts to the franc, the totals, the
 * result, the balance sheet and the owner's AVS/AI/APG contributions. The canton cites its form.
 */
export function businessYear(b: BusinessInput): BusinessYear {
  const revenue = Object.fromEntries(REVENUE_LINES.map((k) => [k, figure(b[k])])) as Record<
    RevenueLine,
    BusinessFigure
  >;
  const charges = Object.fromEntries(CHARGE_LINES.map((k) => [k, figure(b[k])])) as Record<
    ChargeLine,
    BusinessFigure
  >;
  const totalRevenue = sum(Object.values(revenue));
  const totalCharges = sum(Object.values(charges));
  const result = sum([totalRevenue, totalCharges]);
  result.amount = totalRevenue.amount - totalCharges.amount;
  result.trace.src(SELF_EMPLOYMENT_RULES.income, SELF_EMPLOYMENT_RULES.costs);
  const currentAssets = figure(b.currentAssets);
  const fixedAssets = figure(b.fixedAssets);
  const grossAssets = sum([currentAssets, fixedAssets]);
  const liabilities = figure(b.liabilities);
  const equity = sum([grossAssets, liabilities]);
  equity.amount = grossAssets.amount - liabilities.amount;
  const avsYear = figure(b.avsYear);
  const avsEarlier = figure(b.avsEarlier);
  avsYear.trace.src(SELF_EMPLOYMENT_RULES.avs);
  avsEarlier.trace.src(SELF_EMPLOYMENT_RULES.avs);
  const earned = sum([result, avsYear, avsEarlier]);
  earned.amount = result.amount - avsYear.amount - avsEarlier.amount;
  const cantonal = figure(b.priorLosses?.cantonal);
  const federal = figure(b.priorLosses?.federal);
  const given = (keys: readonly (keyof BusinessInput)[]) => keys.some((k) => b[k] !== undefined);
  return {
    hasAccounts: given([...REVENUE_LINES, ...CHARGE_LINES]),
    revenue,
    charges,
    totalRevenue,
    totalCharges,
    result,
    currentAssets,
    fixedAssets,
    grossAssets,
    liabilities,
    equity,
    hasBalance: given(['currentAssets', 'fixedAssets', 'liabilities']),
    avsYear,
    avsEarlier,
    hasAvs: given(['avsYear', 'avsEarlier']),
    earned,
    priorLosses: { cantonal, federal },
  };
}

/** The business years whose losses count for a tax year, with the documents that say so. */
export function lossWindow(
  taxYear: number,
): { from: number; to: number; source: string } | undefined {
  const y = SELF_EMPLOYMENT_FEDERAL[taxYear as 2025 | 2026];
  if (!y) return undefined;
  return {
    from: y.lossYears[0],
    to: y.lossYears[1],
    source: `${SELF_EMPLOYMENT_RULES.losses}; ${y.instructions} p. 3`,
  };
}

/** How the result was found, in words, with the numbers. */
export function resultHow(y: BusinessYear): Text {
  const r = y.result.amount;
  return t(
    `Total revenue ${chf(y.totalRevenue.amount)} less total charges ${chf(y.totalCharges.amount)}: ${r < 0 ? `a loss of ${chf(-r)}` : chf(r)}.`,
    `Total des recettes ${chf(y.totalRevenue.amount)} moins total des charges ${chf(y.totalCharges.amount)}${NB}: ${r < 0 ? `une perte de ${chf(-r)}` : chf(r)}.`,
  );
}

/** A figure as a line, with the canton's label and the words of how it was found. */
export function businessLine(f: BusinessFigure, label: Text, how: Text): Line {
  return f.trace.line(f.amount, label, how);
}
