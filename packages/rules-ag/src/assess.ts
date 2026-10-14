// From the lines of the return to the taxes: the second half of the engine, and the part the
// guide's worked example checks on its own (ag-2025-guide-wegleitung p. 45, Anhang II).
//
// Income: the Total der Einkünfte, less the deductions 10 to 18 (StG §§ 35 to 40a), is the
// Reineinkommen (§ 34); less the Sozialabzüge (§ 42 Abs. 1) it is the base of the low-income
// deduction (§ 42 Abs. 1bis, guide Ziffer 23); less that, the steuerbares Einkommen (Ziffer 25).
// Wealth: the assets less the debts (§ 52) and the steuerfreie Beträge (§ 54) are the steuerbares
// Vermögen (Ziffer 37).
//
// Taxes (§ 2, § 43, § 55, § 56, § 154, § 155): the tariffs give the einfache Steuer on income (in
// whole CHF 100, Tarif A or B, rounded down to the franc) and on wealth (in whole CHF 1,000); the
// canton, the commune and the church each levy a percentage of the same einfache Steuer; the income
// and wealth taxes of all three are cut to the maximum burden when they are higher.
import { chf, roundCentime, Trace, type Cited } from '@taxpresso/rules-ch';
import {
  churchRate,
  churchRates,
  communeByName,
  type AgCommune,
  type Confession,
} from './communes.js';
import { NOTE } from './explain.js';
import { churchRule, maxBurden, multipliers, taxRounding, tariffSteps } from './law.js';
import { agParamsFor, type AgTaxYear } from './params.js';
import {
  ASSETS,
  DEBTS,
  DEDUCTIONS,
  INCOME,
  LOW_INCOME,
  rubric,
  SOCIAL,
  WEALTH_FREE,
} from './rubrics.js';
import { round10 } from './rules.js';
import { incomeSimpleTax, wealthSimpleTax, type StepTariff } from './tariff.js';
import type { AgIccResult, CommuneRef, Item, ItemAmount, Line, Text } from './types.js';

export class AgInputError extends Error {}

/** A fact the household has not given and the tax depends on: the result says what to answer. */
export class AgUnsupported extends Error {
  constructor(readonly note: Text) {
    super(note.en);
  }
}

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const SUMMARY =
  'ag-2025-guide-wegleitung p. 31 (18.: Nettoeinkommen Ziffer 20), p. 32 (24.: Ziffer 23)';

export interface AgAssessInput {
  taxYear: AgTaxYear;
  /** The commune of residence on 31 December: its name in the year's list, or the commune itself. */
  commune: string | AgCommune;
  tariff: 'A' | 'B';
  /** The documents that say which tariff applies, when the household needs them. */
  tariffSources?: readonly string[];
  /**
   * The church tax, when asked for: the household's confession (one: families of several
   * confessions are not supported) and, where the commune has a further parish of that church, the
   * parish. `none`: the household said it pays no church tax. Undefined: not asked.
   */
  church?: { confession: Confession; parish?: string };
  /**
   * The base of the maximum burden (§ 56 Abs. 1): the Reineinkommen raised by the pension fund
   * buy-ins deducted. Default: the Reineinkommen.
   */
  maxBurdenBase?: Line;
  /**
   * The low-income deduction's last change of step below the household's base (§ 42 Abs. 1bis): the
   * taxable income there, and how far above it the household's base is, in centimes. The marginal
   * burden between the two must not exceed 100 % (§ 43 Abs. 3).
   */
  lowIncomeStep?: { taxableThere: number; above: number };
  incomeItems: readonly (Item | ItemAmount)[];
  wealthItems: readonly (Item | ItemAmount)[];
}

/** An amount as printed, as an item with its line's label. */
export function asItem(item: Item | ItemAmount): Item {
  if ('label' in item) return item;
  const r = rubric(item.code);
  if (!r) throw new AgInputError(`Unknown line code ${item.code} on the Aargau return.`);
  return {
    code: item.code,
    person: item.person,
    amount: item.amount,
    label: r.label,
    how: t('As given.', 'Tel que donné.'),
    sources: [r.source],
  };
}

const sum = (items: readonly Item[]) => items.reduce((s, i) => s + i.amount, 0);

function only(items: readonly Item[], groups: readonly Set<string>[], what: string) {
  const unknown = items.filter((i) => !groups.some((g) => g.has(i.code)));
  if (unknown.length) {
    throw new AgInputError(`Not ${what}: ${unknown.map((i) => i.code).join(', ')}.`);
  }
}

export interface IncomeTotals {
  grossIncome: Line;
  totalDeductions: Line;
  netIncome: Line;
  socialDeductions: Line;
  afterSocial: Line;
  taxableIncome: Line;
}

/** The totals of the return's income part, in its order, from the items. */
export function incomeTotals(items: readonly Item[]): IncomeTotals {
  only(items, [INCOME, DEDUCTIONS, SOCIAL, LOW_INCOME], 'an income line');
  const of = (g: Set<string>) => items.filter((i) => g.has(i.code));
  const income = of(INCOME);
  const deductions = of(DEDUCTIONS);
  const social = of(SOCIAL);
  const low = of(LOW_INCOME);
  const gross = sum(income);
  const ded = sum(deductions);
  const net = gross + ded;
  const soc = sum(social);
  const after = net + soc;
  const taxable = Math.max(0, after + sum(low));
  const grossIncome = new Trace()
    .src(SUMMARY)
    .from(...income)
    .line(
      gross,
      t('Total income (Total der Einkünfte)', 'Total des revenus (Total der Einkünfte)'),
      t(
        `The ${income.length} income lines added up: ${chf(gross)}.`,
        `Les ${income.length} lignes de revenu additionnées${NB}: ${chf(gross)}.`,
      ),
    );
  const totalDeductions = new Trace()
    .src(SUMMARY)
    .from(...deductions)
    .line(
      ded,
      t('Total deductions (Abzüge)', 'Total des déductions (Abzüge)'),
      t(
        `The ${deductions.length} deduction lines added up: ${chf(-ded)}.`,
        `Les ${deductions.length} lignes de déduction additionnées${NB}: ${chf(-ded)}.`,
      ),
    );
  const netIncome = new Trace()
    .src(SUMMARY, 'ag-na-law-steuergesetz § 34 Abs. 1 (p. 21)')
    .from(grossIncome, totalDeductions)
    .line(
      net,
      t('Net income (Reineinkommen)', 'Revenu net (Reineinkommen)'),
      t(
        `Total income less the deductions: ${chf(net)}.`,
        `Total des revenus moins les déductions${NB}: ${chf(net)}.`,
      ),
    );
  const socialDeductions = new Trace()
    .src(SUMMARY)
    .from(...social)
    .line(
      soc,
      t('Social deductions (Sozialabzüge)', 'Déductions sociales (Sozialabzüge)'),
      t(
        `The child deductions added up: ${chf(-soc)}.`,
        `Les déductions pour enfants additionnées${NB}: ${chf(-soc)}.`,
      ),
    );
  const afterSocial = new Trace()
    .src(SUMMARY)
    .from(netIncome, socialDeductions)
    .line(
      after,
      t(
        'Net income after social deductions (Reineinkommen nach Sozialabzügen)',
        'Revenu net après déductions sociales (Reineinkommen nach Sozialabzügen)',
      ),
      t(
        `Net income less the social deductions: ${chf(after)}.`,
        `Revenu net moins les déductions sociales${NB}: ${chf(after)}.`,
      ),
    );
  const taxableIncome = new Trace()
    .src('ag-2025-guide-wegleitung p. 45 (Anhang II: Steuerbares Einkommen, Ziffer 25)')
    .from(afterSocial, ...low)
    .line(
      taxable,
      t('Taxable income (steuerbares Einkommen)', 'Revenu imposable (steuerbares Einkommen)'),
      t(
        `${low.length ? `Less the low-income deduction ${chf(-sum(low))}, never` : 'Never'} below zero: ${chf(taxable)}.`,
        `${low.length ? `Moins la déduction pour revenus modestes ${chf(-sum(low))}, jamais` : 'Jamais'} négatif${NB}: ${chf(taxable)}.`,
      ),
    );
  return { grossIncome, totalDeductions, netIncome, socialDeductions, afterSocial, taxableIncome };
}

/** The wealth totals: the assets, then less the debts and the steuerfreie Beträge, never below zero. */
export function wealthTotals(items: readonly Item[]): { grossWealth: Line; taxableWealth: Line } {
  only(items, [ASSETS, DEBTS, WEALTH_FREE], 'a wealth line');
  const assets = items.filter((i) => ASSETS.has(i.code));
  const less = items.filter((i) => !ASSETS.has(i.code));
  const gross = sum(assets);
  const taxable = Math.max(0, gross + sum(less));
  const grossWealth = new Trace()
    .src(
      'ag-na-law-steuergesetz § 46 Abs. 1 (p. 30); ag-2025-guide-wegleitung p. 34 (Vermögen im In- und Ausland)',
    )
    .from(...assets)
    .line(
      gross,
      t('Total wealth (Total Vermögen)', 'Total de la fortune (Total Vermögen)'),
      t(
        `The ${assets.length} asset line${assets.length === 1 ? '' : 's'} added up: ${chf(gross)}.`,
        `Éléments de fortune additionnés (${assets.length})${NB}: ${chf(gross)}.`,
      ),
    );
  const taxableWealth = new Trace()
    .src('ag-2025-guide-wegleitung p. 45 (Anhang II: Steuerbares Vermögen, Ziffer 37)')
    .from(grossWealth, ...less)
    .line(
      taxable,
      t('Taxable wealth (steuerbares Vermögen)', 'Fortune imposable (steuerbares Vermögen)'),
      t(
        `Total wealth less the debts and the tax-free amounts (${chf(-sum(less))}), never below zero: ${chf(taxable)}.`,
        `Total de la fortune moins les dettes et les montants exonérés (${chf(-sum(less))}), jamais négatif${NB}: ${chf(taxable)}.`,
      ),
    );
  return { grossWealth, taxableWealth };
}

/** The commune of a year by name, or an input error. */
export function communeOf(taxYear: AgTaxYear, name: string): AgCommune {
  const c = communeByName(taxYear, name);
  if (!c) throw new AgInputError(`Unknown Aargau commune for ${taxYear}: ${name}.`);
  return c;
}

export const communeRef = (c: AgCommune): CommuneRef => ({ bfs: null, name: c.name, rate: c.rate });

const CONFESSION: Record<Exclude<Confession, 'none'>, Text> = {
  reformed: t('Reformed', 'réformée'),
  catholic: t('Roman Catholic', 'catholique romaine'),
  christ_catholic: t('Christ Catholic', 'catholique-chrétienne'),
};

/** A percentage of an amount in centimes, to 10 centimes (law.ts, taxRounding). */
const levy = (amount: number, percent: number) => round10(amount * percent, 100);

/** The einfache Steuer on an amount: the tariff, applied to the amount in whole steps. */
function simpleLine(
  param: Cited<StepTariff>,
  base: Line,
  unit: number,
  compute: (tariff: StepTariff, centimes: number) => number,
  label: Text,
  how: (taxed: number, amount: number) => Text,
  extraSources: readonly string[],
): Line {
  const tr = new Trace().from(base).src(...extraSources);
  const tariff = tr.p(param);
  const taxed = Math.floor(Math.max(0, base.amount) / unit) * unit;
  const amount = compute(tariff, taxed);
  return tr.line(amount, label, how(taxed, amount));
}

export function assess(input: AgAssessInput): AgIccResult {
  const P = agParamsFor(input.taxYear);
  const C =
    typeof input.commune === 'string' ? communeOf(input.taxYear, input.commune) : input.commune;
  const items = input.incomeItems.map(asItem);
  const wealthItems = input.wealthItems.map(asItem);
  const totals = incomeTotals(items);
  const wealth = wealthTotals(wealthItems);
  const steps = tariffSteps(input.taxYear);
  const B = input.tariff === 'B';
  const tariffName = B
    ? t(
        'Tarif B, the rate of half the income (StG § 43 Abs. 2)',
        'le Tarif B, taux du demi-revenu (LI § 43 al. 2)',
      )
    : t('Tarif A (StG § 43 Abs. 1)', 'le Tarif A (LI § 43 al. 1)');

  // The einfache Steuer.
  const simpleIncome = simpleLine(
    P.incomeTariff,
    totals.taxableIncome,
    steps.value.income,
    (tariff, c) => incomeSimpleTax(tariff, c, input.tariff),
    t(
      'Simple income tax (einfache Einkommenssteuer)',
      'Impôt simple sur le revenu (einfache Einkommenssteuer)',
    ),
    (taxed, amount) =>
      t(
        `${tariffName.en} on the taxable income ${chf(totals.taxableIncome.amount)}, taken as ${chf(taxed)} (in whole CHF 100)${B ? ': twice the tax on half of it' : ''}, rounded down to the franc: ${chf(amount)}.`,
        `${tariffName.fr} sur le revenu imposable ${chf(totals.taxableIncome.amount)}, pris pour ${chf(taxed)} (par CHF 100 entiers)${B ? `${NB}: le double de l’impôt sur sa moitié` : ''}, arrondi au franc inférieur${NB}: ${chf(amount)}.`,
      ),
    [steps.source, ...(input.tariffSources ?? [])],
  );
  const simpleWealth = simpleLine(
    P.wealthTariff,
    wealth.taxableWealth,
    steps.value.wealth,
    wealthSimpleTax,
    t(
      'Simple wealth tax (einfache Vermögenssteuer)',
      'Impôt simple sur la fortune (einfache Vermögenssteuer)',
    ),
    (taxed, amount) =>
      t(
        `The wealth tariff (StG § 55) on the taxable wealth ${chf(wealth.taxableWealth.amount)}, taken as ${chf(taxed)} (in whole CHF 1,000): ${chf(amount)}.`,
        `Le barème de la fortune (LI § 55) sur la fortune imposable ${chf(wealth.taxableWealth.amount)}, prise pour ${chf(taxed)} (par CHF 1’000 entiers)${NB}: ${chf(amount)}.`,
      ),
    [steps.source],
  );
  const simpleAmount = simpleIncome.amount + simpleWealth.amount;
  const simple = new Trace()
    .src(multipliers(input.taxYear).source)
    .from(simpleIncome, simpleWealth)
    .line(
      simpleAmount,
      t('Simple tax (einfache Steuer)', 'Impôt simple (einfache Steuer)'),
      t(
        `Income ${chf(simpleIncome.amount)} + wealth ${chf(simpleWealth.amount)} = ${chf(simpleAmount)}. The canton, the commune and the church each levy a percentage of it.`,
        `Revenu ${chf(simpleIncome.amount)} + fortune ${chf(simpleWealth.amount)} = ${chf(simpleAmount)}. Le canton, la commune et l’Église en prélèvent chacun un pourcentage.`,
      ),
    );

  const rounding = taxRounding();
  const ct = new Trace().from(simple).src(rounding.source);
  const cantonalRate = ct.p(P.cantonalRate);
  const cantonalAmount = levy(simpleAmount, cantonalRate);
  const cantonal = ct.line(
    cantonalAmount,
    t('Cantonal tax (Kantonssteuer)', 'Impôt cantonal (Kantonssteuer)'),
    t(
      `${chf(simpleAmount)} x ${cantonalRate} % (Steuerfuss ${input.taxYear}), to 10 centimes: ${chf(cantonalAmount)}.`,
      `${chf(simpleAmount)} x ${cantonalRate}${NB}% (coefficient ${input.taxYear}), à 10 centimes${NB}: ${chf(cantonalAmount)}.`,
    ),
  );
  const communalAmount = levy(simpleAmount, C.rate);
  const communal = new Trace()
    .from(simple)
    .src(P.communes.source, rounding.source)
    .line(
      communalAmount,
      t(
        `Communal tax of ${C.name} (Gemeindesteuer)`,
        `Impôt communal de ${C.name} (Gemeindesteuer)`,
      ),
      t(
        `${chf(simpleAmount)} x ${C.rate} % (the commune’s Steuerfuss), to 10 centimes: ${chf(communalAmount)}.`,
        `${chf(simpleAmount)} x ${C.rate}${NB}% (coefficient de la commune), à 10 centimes${NB}: ${chf(communalAmount)}.`,
      ),
    );

  let church: Line | null = null;
  let churchUsed = 0;
  if (input.church && input.church.confession !== 'none') {
    const confession = input.church.confession;
    const rate = churchRate(C, confession, input.church.parish);
    if (rate === 'parish') throw new AgUnsupported(NOTE.parish);
    churchUsed = rate;
    const amount = levy(simpleAmount, rate);
    const name = CONFESSION[confession];
    const parish = C.extra.some((p) => p.confession === confession)
      ? input.church.parish
      : undefined;
    church = new Trace()
      .from(simple)
      .src(P.communes.source, churchRule(input.taxYear).source, rounding.source)
      .line(
        amount,
        t('Church tax (Kirchensteuer)', 'Impôt ecclésiastique (Kirchensteuer)'),
        t(
          `${chf(simpleAmount)} x ${rate} % (${name.en} church${parish ? `, ${parish}` : ''}), to 10 centimes: ${chf(amount)}.`,
          `${chf(simpleAmount)} x ${rate}${NB}% (Église ${name.fr}${parish ? `, ${parish}` : ''}), à 10 centimes${NB}: ${chf(amount)}.`,
        ),
      );
  }
  // Not asked: the checks below that depend on the church use the highest rate of the commune.
  const churchForChecks = input.church ? churchUsed : Math.max(...churchRates(C));

  // The low-income deduction's change of step: at most 100 % marginal burden (§ 43 Abs. 3).
  if (input.lowIncomeStep) {
    const { taxableThere, above } = input.lowIncomeStep;
    const there = incomeSimpleTax(
      P.incomeTariff.value,
      Math.floor(Math.max(0, taxableThere) / steps.value.income) * steps.value.income,
      input.tariff,
    );
    const percent = cantonalRate + C.rate + churchForChecks;
    if ((simpleIncome.amount - there) * percent > above * 100) {
      throw new AgUnsupported(NOTE.lowIncomeStep);
    }
  }

  // The maximum burden (§ 56 Abs. 1).
  let cut: Line | null = null;
  const before = cantonalAmount + communalAmount + (church?.amount ?? 0);
  if (simpleWealth.amount > 0) {
    const baseLine = input.maxBurdenBase ?? totals.netIncome;
    const tr = new Trace().from(baseLine, simpleWealth);
    const mb = tr.p(maxBurden());
    const limit = roundCentime(Math.max(0, baseLine.amount) * mb.incomeShareBp, 10_000);
    const levied = (k: number) =>
      levy(simpleAmount, cantonalRate) +
      levy(simpleAmount, C.rate) +
      (k ? levy(simpleAmount, k) : 0);
    if (!input.church && levied(churchForChecks) > limit)
      throw new AgUnsupported(NOTE.churchForCap);
    if (before > limit) {
      const percent = cantonalRate + C.rate + churchUsed;
      const wealthTaxes = roundCentime(simpleWealth.amount * percent, 100);
      const half = roundCentime(wealthTaxes * mb.wealthShareBp, 10_000);
      const amount = Math.min(before - limit, half);
      cut = tr.line(
        -amount,
        t('Maximum burden (Höchstbelastung)', 'Charge maximale (Höchstbelastung)'),
        t(
          `The taxes of the canton, the commune${church ? ' and the church' : ''} (${chf(before)}) are above 70 % of the net income${input.maxBurdenBase ? ' with the pension fund buy-ins added back' : ''} (${chf(Math.max(0, baseLine.amount))}), that is ${chf(limit)}; they are cut by the difference, at most half of the wealth taxes (${chf(wealthTaxes)} x 50 % = ${chf(half)}): ${chf(-amount)}.`,
          `Les impôts du canton, de la commune${church ? ' et de l’Église' : ''} (${chf(before)}) dépassent 70${NB}% du revenu net${input.maxBurdenBase ? ' avec les rachats de prévoyance réintégrés' : ''} (${chf(Math.max(0, baseLine.amount))}), soit ${chf(limit)}${NB}; ils sont réduits de la différence, au plus la moitié des impôts sur la fortune (${chf(wealthTaxes)} x 50${NB}% = ${chf(half)})${NB}: ${chf(-amount)}.`,
        ),
      );
    }
  }

  const totalAmount = before + (cut?.amount ?? 0);
  const total = new Trace()
    .from(cantonal, communal, church ?? undefined, cut ?? undefined)
    .src(multipliers(input.taxYear).source)
    .line(
      totalAmount,
      t(
        `Cantonal and communal tax${church ? ' and church tax' : ''} (Kantons- und Gemeindesteuern${church ? ', Kirchensteuer' : ''})`,
        `Impôt cantonal et communal${church ? ' et impôt ecclésiastique' : ''} (Kantons- und Gemeindesteuern${church ? ', Kirchensteuer' : ''})`,
      ),
      t(
        `Cantonal ${chf(cantonalAmount)} + communal ${chf(communalAmount)}${church ? ` + church ${chf(church.amount)}` : ''}${cut ? ` less the maximum burden cut ${chf(-cut.amount)}` : ''} = ${chf(totalAmount)}.`,
        `Cantonal ${chf(cantonalAmount)} + communal ${chf(communalAmount)}${church ? ` + ecclésiastique ${chf(church.amount)}` : ''}${cut ? ` moins la réduction pour charge maximale ${chf(-cut.amount)}` : ''} = ${chf(totalAmount)}.`,
      ),
    );

  return {
    items,
    ...totals,
    tariff: input.tariff,
    wealth: { items: wealthItems, ...wealth },
    taxes: {
      simpleIncome,
      simpleWealth,
      simple,
      cantonal,
      communal,
      church,
      maxBurden: cut,
      total,
    },
  };
}
