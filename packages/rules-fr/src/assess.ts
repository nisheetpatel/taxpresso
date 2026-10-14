// From the lines of the return to the taxes: the second half of the engine, and the part the guide's
// tables check on their own (fr-2025-guide-instructions-generales p. 39, p. 45 and 46, from the
// taxable income and wealth).
//
// Income, in the order of the guide's codes: the income lines less the costs and general deductions
// (2.110 to 4.420) are the net income (4.910); less the medical costs and donations (5.110, 5.120)
// and the social deductions (6.110), 6.910; less the modest income deduction (7.110), in whole CHF
// 100, the taxable income (7.910). Wealth: the assets less the debts are the net wealth (6.910);
// less the social deduction on wealth (7.110), in whole CHF 1,000, the taxable wealth (7.910).
//
// Taxes (LICD art. 2, 37, 62; LICo art. 3 al. 3): the scales give the cantonal base tax (100 %) on
// the taxable income, at the rate of half of it for married couples and single parents, and on the
// taxable wealth; the canton levies its coefficient on each base tax, the commune its coefficient,
// and the parish, when asked for, its coefficients on income and on wealth.
import { chf, round5, Trace, type Cited } from '@taxpresso/rules-ch';
import { communeByRef, type FrCommune, type FrParish } from './communes.js';
import { NOTE } from './explain.js';
import { amountSteps, coefficientRule, communalTax, familyRate } from './law.js';
import { frParamsFor, type FrTaxYear } from './params.js';
import {
  ASSETS,
  COSTS,
  DEBTS,
  DEDUCTIONS,
  INCOME,
  MODEST,
  rubric,
  SOCIAL,
  WEALTH_SOCIAL,
  wealthRubric,
} from './rubrics.js';
import { incomeBaseTax, incomeRate, rateIncome as rateIncomeOf, wealthBaseTax } from './tariff.js';
import type { CommuneRef, FrIccResult, Item, ItemAmount, Line, Text } from './types.js';

export class FrInputError extends Error {}

/** A fact the household has not given, or a case the documents leave open: the result says which. */
export class FrUnsupported extends Error {
  constructor(readonly note: Text) {
    super(note.en);
  }
}

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = '\u00a0';
/** 5200 -> "5’200". */
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '’');
const GUIDE = 'fr-2025-guide-instructions-generales';
/** The income of both spouses is added up (LICD art. 66 al. 1; guide p. 8). */
const GROSS = `fr-2025-law-licd-consolidee art. 66 al. 1 (p. 39); ${GUIDE} p. 8 (V. Revenu de l’activité)`;
const SUMMARY = `${GUIDE} p. 33 and 35 (code 4.910)`;
const SOCIAL_SOURCE = `${GUIDE} p. 37 (code 6.910)`;
const TAXABLE_SOURCE = `${GUIDE} p. 39 (code 7.910)`;
const WEALTH_SOURCE = `${GUIDE} p. 39 (code 6.910, fortune)`;
const TAXABLE_WEALTH_SOURCE = `${GUIDE} p. 39 (code 7.910, fortune)`;

/** Hundredths of a percent as a percentage: 7430 -> "74.3 %", "74,3 %". */
export const pc = (hundredths: number, lang: 'en' | 'fr') => {
  const s = String(hundredths / 100);
  return `${lang === 'fr' ? s.replace('.', ',') : s}${NB}%`;
};
/** Ten-thousandths of a percent: 45420 -> "4.5420 %". */
export const rateText = (rate: number, lang: 'en' | 'fr') => {
  const s = (rate / 10_000).toFixed(4);
  return `${lang === 'fr' ? s.replace('.', ',') : s}${NB}%`;
};

export interface FrAssessInput {
  taxYear: FrTaxYear;
  /** The commune of residence on 31 December, by its BFS number, name or slug. */
  commune: string | number;
  /** A married couple, or a single parent living with their children: the rate of half the income. */
  family: boolean;
  /** Documents that say how the household was found to be a family (shared custody, children). */
  familySources?: readonly string[];
  /** The church tax, when asked for: the parish whose coefficients apply. */
  parish?: FrParish | null;
  incomeItems: readonly (Item | ItemAmount)[];
  wealthItems: readonly (Item | ItemAmount)[];
}

/** An amount as printed, as an item with its line's label. */
function asItem(item: Item | ItemAmount, wealth: boolean): Item {
  if ('label' in item) return item;
  const r = wealth ? wealthRubric(item.code) : rubric(item.code);
  if (!r) throw new FrInputError(`Unknown ${wealth ? 'wealth ' : ''}line code ${item.code}.`);
  return {
    code: item.code,
    person: item.person,
    amount: item.amount,
    label: r.label,
    how: t('As given.', 'Tel que donné.'),
    sources: [r.source],
  };
}
export const asIncomeItem = (i: Item | ItemAmount) => asItem(i, false);
export const asWealthItem = (i: Item | ItemAmount) => asItem(i, true);

const sum = (items: readonly { amount: number }[]) => items.reduce((s, i) => s + i.amount, 0);
const of = (items: readonly Item[], codes: Set<string>) => items.filter((i) => codes.has(i.code));

/** The subtotals of the form, from the items so far (the later sections may still be empty). */
export function subtotals(items: readonly { code: string; amount: number }[]) {
  const pick = (codes: Set<string>) => items.filter((i) => codes.has(i.code));
  const gross = sum(pick(INCOME));
  const net = gross + sum(pick(DEDUCTIONS));
  const afterCosts = net + sum(pick(COSTS));
  const social = afterCosts + sum(pick(SOCIAL));
  const beforeRounding = social + sum(pick(MODEST));
  return { gross, net, afterCosts, social, beforeRounding };
}

function only(items: readonly Item[], groups: readonly Set<string>[], what: string) {
  const unknown = items.filter((i) => !groups.some((g) => g.has(i.code)));
  if (unknown.length) {
    throw new FrInputError(`Not ${what}: ${unknown.map((i) => i.code).join(', ')}.`);
  }
}

/** The commune of a year, or an input error. */
export function communeOf(taxYear: FrTaxYear, ref: string | number): FrCommune {
  const c = communeByRef(taxYear, ref);
  if (!c) throw new FrInputError(`Unknown Fribourg commune for ${taxYear}: ${ref}.`);
  return c;
}

/** The commune reference of a result: its number, its name and the coefficient applied. */
export function communeRef(taxYear: FrTaxYear, ref: string | number): CommuneRef {
  const c = communeOf(taxYear, ref);
  return { bfs: c.bfs, name: c.name, rate: c.rate };
}

export function assess(input: FrAssessInput): FrIccResult {
  const P = frParamsFor(input.taxYear);
  const C = communeOf(input.taxYear, input.commune);
  if (C.rate === null) throw new FrUnsupported(NOTE.communes2026);
  const communalRate = C.rate;
  const items = input.incomeItems.map(asIncomeItem);
  const wealthItems = input.wealthItems.map(asWealthItem);
  only(items, [INCOME, DEDUCTIONS, COSTS, SOCIAL, MODEST], 'an income line');
  only(wealthItems, [ASSETS, DEBTS, WEALTH_SOCIAL], 'a wealth line');
  const steps = amountSteps();
  const s = subtotals(items);

  // Income: the totals of the form.
  const incomeLines = of(items, INCOME);
  const deductionLines = of(items, DEDUCTIONS);
  const grossIncome = new Trace()
    .src(GROSS)
    .from(...incomeLines)
    .line(
      s.gross,
      t('Total income', 'Total des revenus'),
      t(
        `The ${incomeLines.length} income line${incomeLines.length === 1 ? '' : 's'} added up: ${chf(s.gross)}.`,
        `Lignes de revenu additionnées (${incomeLines.length})${NB}: ${chf(s.gross)}.`,
      ),
    );
  const netIncome = new Trace()
    .src(SUMMARY)
    .from(grossIncome, ...deductionLines)
    .line(
      s.net,
      t('Net income (revenu net, 4.910)', 'Revenu net (4.910)'),
      t(
        `Total income less the costs and general deductions (${chf(-sum(deductionLines))}): ${chf(s.net)}.`,
        `Total des revenus moins les frais et déductions générales (${chf(-sum(deductionLines))})${NB}: ${chf(s.net)}.`,
      ),
    );
  const costLines = of(items, COSTS);
  const incomeAfterCosts = new Trace()
    .src(SUMMARY)
    .from(netIncome, ...costLines)
    .line(
      s.afterCosts,
      t(
        'Net income less medical costs and donations',
        'Revenu net moins frais médicaux et versements bénévoles',
      ),
      t(
        `${chf(s.net)} less the medical costs and donations (${chf(-sum(costLines))}): ${chf(s.afterCosts)}.`,
        `${chf(s.net)} moins les frais médicaux et versements bénévoles (${chf(-sum(costLines))})${NB}: ${chf(s.afterCosts)}.`,
      ),
    );
  const socialLines = of(items, SOCIAL);
  const socialIncome = new Trace()
    .src(SOCIAL_SOURCE)
    .from(incomeAfterCosts, ...socialLines)
    .line(
      s.social,
      t('Income after the social deductions (6.910)', 'Revenu après déductions sociales (6.910)'),
      t(
        `${chf(s.afterCosts)} less the child deduction (${chf(-sum(socialLines))}): ${chf(s.social)}.`,
        `${chf(s.afterCosts)} moins les déductions sociales pour enfants (${chf(-sum(socialLines))})${NB}: ${chf(s.social)}.`,
      ),
    );
  const modestLines = of(items, MODEST);
  const trTaxable = new Trace().src(TAXABLE_SOURCE).from(socialIncome, ...modestLines);
  const unitIncome = trTaxable.p(steps).income;
  const taxable = Math.floor(Math.max(0, s.beforeRounding) / unitIncome) * unitIncome;
  const taxableIncome = trTaxable.line(
    taxable,
    t('Taxable income (revenu imposable, 7.910)', 'Revenu imposable (7.910)'),
    t(
      `${chf(s.social)} less the modest income deduction (${chf(-sum(modestLines))}) is ${chf(s.beforeRounding)}; in whole CHF 100, never below zero: ${chf(taxable)}.`,
      `${chf(s.social)} moins la déduction pour revenu modeste (${chf(-sum(modestLines))}) font ${chf(s.beforeRounding)}${NB}; par CHF 100 entiers, jamais négatif${NB}: ${chf(taxable)}.`,
    ),
  );

  // The rate.
  const scale = P.incomeScale;
  const trRate = new Trace().from(taxableIncome).src(...(input.familySources ?? []));
  trRate.p(scale);
  if (input.family) trRate.p(familyRate());
  const rateAt = rateIncomeOf(scale.value, taxable, input.family);
  const rate = incomeRate(scale.value, taxable, input.family);
  const rateIncome = trRate.line(
    rateAt,
    t('Income that sets the rate', 'Revenu déterminant le taux'),
    input.family
      ? t(
          `Married couple or single parent: the rate of half the taxable income, ${chf(rateAt)} (splitting); at least ${rateText(scale.value.minimumRate, 'en')}: ${rateText(rate, 'en')}.`,
          `Couple marié ou famille monoparentale${NB}: le taux de la moitié du revenu imposable, ${chf(rateAt)} (splitting)${NB}; au moins ${rateText(scale.value.minimumRate, 'fr')}${NB}: ${rateText(rate, 'fr')}.`,
        )
      : t(
          `The taxable income itself, ${chf(rateAt)}: ${rateText(rate, 'en')}.`,
          `Le revenu imposable lui-même, ${chf(rateAt)}${NB}: ${rateText(rate, 'fr')}.`,
        ),
  );

  // Wealth.
  const assets = of(wealthItems, ASSETS);
  const debts = of(wealthItems, DEBTS);
  const wealthSocial = of(wealthItems, WEALTH_SOCIAL);
  const grossAmount = sum(assets);
  const grossWealth = new Trace()
    .src(WEALTH_SOURCE)
    .from(...assets)
    .line(
      grossAmount,
      t('Total wealth', 'Total de la fortune'),
      t(
        `The ${assets.length} asset${assets.length === 1 ? '' : 's'} added up: ${chf(grossAmount)}.`,
        `Eléments de fortune additionnés (${assets.length})${NB}: ${chf(grossAmount)}.`,
      ),
    );
  const netAmount = grossAmount + sum(debts);
  const netWealth = new Trace()
    .src(WEALTH_SOURCE)
    .from(grossWealth, ...debts)
    .line(
      netAmount,
      t('Net wealth (fortune nette, 6.910)', 'Fortune nette (6.910)'),
      t(
        `Total wealth less the debts (${chf(-sum(debts))}): ${chf(netAmount)}.`,
        `Total de la fortune moins les dettes (${chf(-sum(debts))})${NB}: ${chf(netAmount)}.`,
      ),
    );
  const trWealth = new Trace().src(TAXABLE_WEALTH_SOURCE).from(netWealth, ...wealthSocial);
  const unitWealth = trWealth.p(steps).wealth;
  const beforeWealth = netAmount + sum(wealthSocial);
  const taxableWealthAmount = Math.floor(Math.max(0, beforeWealth) / unitWealth) * unitWealth;
  const taxableWealth = trWealth.line(
    taxableWealthAmount,
    t('Taxable wealth (fortune imposable, 7.910)', 'Fortune imposable (7.910)'),
    t(
      `${chf(netAmount)} less the social deduction on wealth (${chf(-sum(wealthSocial))}); in whole CHF 1,000, never below zero: ${chf(taxableWealthAmount)}.`,
      `${chf(netAmount)} moins la déduction sociale sur la fortune (${chf(-sum(wealthSocial))})${NB}; par CHF 1’000 entiers, jamais négatif${NB}: ${chf(taxableWealthAmount)}.`,
    ),
  );

  // The cantonal base tax on income.
  const trBase = new Trace().from(rateIncome, taxableIncome);
  trBase.p(scale);
  const incomeBaseAmount = incomeBaseTax(scale.value, taxable, input.family);
  const incomeBase = trBase.line(
    incomeBaseAmount,
    t(
      'Cantonal base tax on income (impôt cantonal de base, 100 %)',
      'Impôt cantonal de base sur le revenu (100 %)',
    ),
    incomeBaseAmount
      ? t(
          `${chf(taxable)} at ${rateText(rate, 'en')}, to 5 centimes, as the canton’s detailed tariff prints it (LICD art. 37): ${chf(incomeBaseAmount)}.`,
          `${chf(taxable)} à ${rateText(rate, 'fr')}, à 5 centimes près, comme le barème détaillé du canton l’indique (LICD art. 37)${NB}: ${chf(incomeBaseAmount)}.`,
        )
      : t(
          `Taxable income under CHF ${thousands(scale.value.threshold)}: no income tax.`,
          `Revenu imposable inférieur à CHF ${thousands(scale.value.threshold)}${NB}: pas d’impôt sur le revenu.`,
        ),
  );

  // The cantonal and communal tax on income.
  const coefficients = P.coefficients;
  const trCant = new Trace().from(incomeBase);
  const coef = trCant.p(coefficients);
  trCant.p(coefficientRule(input.taxYear));
  const cantonalIncomeAmount = round5(incomeBaseAmount * coef.income, 10_000);
  const cantonalIncome = trCant.line(
    cantonalIncomeAmount,
    t(
      `Cantonal tax on income (impôt cantonal, ${pc(coef.income, 'en')})`,
      `Impôt cantonal sur le revenu (${pc(coef.income, 'fr')})`,
    ),
    t(
      `${chf(incomeBaseAmount)} x ${pc(coef.income, 'en')}, to 5 centimes: ${chf(cantonalIncomeAmount)}.`,
      `${chf(incomeBaseAmount)} x ${pc(coef.income, 'fr')}, à 5 centimes près${NB}: ${chf(cantonalIncomeAmount)}.`,
    ),
  );
  const communeSources = [P.communes.source, communalTax().source];
  const communalIncomeAmount = round5(incomeBaseAmount * communalRate, 10_000);
  const communalIncome = new Trace()
    .from(incomeBase)
    .src(...communeSources)
    .line(
      communalIncomeAmount,
      t(
        `Communal tax on income, ${C.name} (impôt communal, ${pc(communalRate, 'en')})`,
        `Impôt communal sur le revenu, ${C.name} (${pc(communalRate, 'fr')})`,
      ),
      t(
        `${chf(incomeBaseAmount)} x ${pc(communalRate, 'en')}, to 5 centimes: ${chf(communalIncomeAmount)}.`,
        `${chf(incomeBaseAmount)} x ${pc(communalRate, 'fr')}, à 5 centimes près${NB}: ${chf(communalIncomeAmount)}.`,
      ),
    );

  // Wealth tax.
  const trWb = new Trace().from(taxableWealth);
  const wealthBaseAmount = wealthBaseTax(trWb.p(P.wealthScale), taxableWealthAmount);
  const wealthBase = trWb.line(
    wealthBaseAmount,
    t(
      'Cantonal base tax on wealth (impôt cantonal de base, 100 %)',
      'Impôt cantonal de base sur la fortune (100 %)',
    ),
    t(
      `The wealth scale (LICD art. 62, by brackets in per mille) at ${chf(taxableWealthAmount)}: ${chf(wealthBaseAmount)}.`,
      `Le barème de la fortune (LICD art. 62, par tranches en pour mille) à ${chf(taxableWealthAmount)}${NB}: ${chf(wealthBaseAmount)}.`,
    ),
  );
  const trCw = new Trace().from(wealthBase);
  trCw.p(coefficients);
  const cantonalWealthAmount = round5(wealthBaseAmount * coef.wealth, 10_000);
  const cantonalWealth = trCw.line(
    cantonalWealthAmount,
    t(
      `Cantonal tax on wealth (impôt cantonal, ${pc(coef.wealth, 'en')})`,
      `Impôt cantonal sur la fortune (${pc(coef.wealth, 'fr')})`,
    ),
    t(
      `${chf(wealthBaseAmount)} x ${pc(coef.wealth, 'en')}: ${chf(cantonalWealthAmount)}.`,
      `${chf(wealthBaseAmount)} x ${pc(coef.wealth, 'fr')}${NB}: ${chf(cantonalWealthAmount)}.`,
    ),
  );
  const communalWealthAmount = round5(wealthBaseAmount * communalRate, 10_000);
  const communalWealth = new Trace()
    .from(wealthBase)
    .src(...communeSources)
    .line(
      communalWealthAmount,
      t(
        `Communal tax on wealth, ${C.name} (impôt communal, ${pc(communalRate, 'en')})`,
        `Impôt communal sur la fortune, ${C.name} (${pc(communalRate, 'fr')})`,
      ),
      t(
        `${chf(wealthBaseAmount)} x ${pc(communalRate, 'en')}, to 5 centimes: ${chf(communalWealthAmount)}.`,
        `${chf(wealthBaseAmount)} x ${pc(communalRate, 'fr')}, à 5 centimes près${NB}: ${chf(communalWealthAmount)}.`,
      ),
    );

  // Church tax, when asked for.
  let churchIncome: Line | null = null;
  let churchWealth: Line | null = null;
  if (input.parish) {
    const p = input.parish;
    const churchLine = (base: Line, coefficient: number, what: Text) => {
      const amount = round5(base.amount * coefficient, 10_000);
      return new Trace()
        .from(base)
        .src(...communeSources)
        .line(
          amount,
          t(
            `Church tax on ${what.en}, parish of ${p.name} (impôt ecclésiastique, ${pc(coefficient, 'en')})`,
            `Impôt ecclésiastique sur ${what.fr}, paroisse ${p.name} (${pc(coefficient, 'fr')})`,
          ),
          t(
            `${chf(base.amount)} x ${pc(coefficient, 'en')}, to 5 centimes: ${chf(amount)}.`,
            `${chf(base.amount)} x ${pc(coefficient, 'fr')}, à 5 centimes près${NB}: ${chf(amount)}.`,
          ),
        );
    };
    churchIncome = churchLine(incomeBase, p.income, t('income', 'le revenu'));
    churchWealth = churchLine(wealthBase, p.wealth, t('wealth', 'la fortune'));
  }

  const totalAmount =
    cantonalIncomeAmount +
    communalIncomeAmount +
    cantonalWealthAmount +
    communalWealthAmount +
    (churchIncome?.amount ?? 0) +
    (churchWealth?.amount ?? 0);
  const churchText = churchIncome
    ? t(
        `; church: ${chf(churchIncome.amount)} + ${chf(churchWealth?.amount ?? 0)}`,
        `${NB}; ecclésiastique${NB}: ${chf(churchIncome.amount)} + ${chf(churchWealth?.amount ?? 0)}`,
      )
    : t('', '');
  const total = new Trace()
    .from(
      cantonalIncome,
      communalIncome,
      cantonalWealth,
      communalWealth,
      churchIncome ?? undefined,
      churchWealth ?? undefined,
    )
    .src(communalTax().source)
    .line(
      totalAmount,
      churchIncome
        ? t(
            'Cantonal, communal and church tax (impôts cantonal, communal et ecclésiastique)',
            'Impôts cantonal, communal et ecclésiastique',
          )
        : t('Cantonal and communal tax (impôt cantonal et communal)', 'Impôt cantonal et communal'),
      t(
        `Income: cantonal ${chf(cantonalIncomeAmount)} + communal ${chf(communalIncomeAmount)}; wealth: cantonal ${chf(cantonalWealthAmount)} + communal ${chf(communalWealthAmount)}${churchText.en}; total ${chf(totalAmount)}.`,
        `Revenu${NB}: cantonal ${chf(cantonalIncomeAmount)} + communal ${chf(communalIncomeAmount)}${NB}; fortune${NB}: cantonal ${chf(cantonalWealthAmount)} + communal ${chf(communalWealthAmount)}${churchText.fr}${NB}; total ${chf(totalAmount)}.`,
      ),
    );

  return {
    items,
    grossIncome,
    netIncome,
    incomeAfterCosts,
    socialIncome,
    taxableIncome,
    family: input.family,
    rateIncome,
    rate,
    wealth: { items: wealthItems, grossWealth, netWealth, taxableWealth },
    taxes: {
      incomeBase,
      cantonalIncome,
      communalIncome,
      wealthBase,
      cantonalWealth,
      communalWealth,
      churchIncome,
      churchWealth,
      total,
    },
  };
}

/** For the sources test: the cited rules this module applies. */
export const ASSESS_RULES = (y: FrTaxYear): Cited<unknown>[] => [
  amountSteps(),
  familyRate(),
  communalTax(),
  coefficientRule(y),
];
