// From the lines of the return to the taxes: the second half of the engine.
//
// Income, in the order of the return: the income lines are the total (499); less every deduction
// (500 to 771) they are the taxable income (790 = 499 - 789), in whole francs, never below zero.
// Wealth: the assets less the debts are the net wealth (899); less the allowance (900 or 905), the
// taxable wealth (910).
//
// Taxes (StG §§ 18bis, 19, 19bis, 34, 51): the tariff gives the income tax on the taxable income,
// at the rate of half of it with Vollsplitting; the child reduction comes off that amount; what is
// left is the normal state tax on income, which the canton levies at its multiplier and the commune
// at its Steuerfuss. The wealth tariff gives the state tax on wealth, which the commune levies at the
// same Steuerfuss. The Roman Catholic church, when asked for, levies its rate on the state tax.
import { chf, roundTo, Trace, type Cited } from '@taxpresso/rules-ch';
import { communeByName, type BlCommune } from './communes.js';
import {
  childRule,
  churchRule,
  communalTax,
  splittingRule,
  wealthAllowance,
  wholeFrancs,
} from './law.js';
import { blParamsFor, type BlTaxYear } from './params.js';
import {
  ALLOWANCES,
  ASSETS,
  DEBTS,
  DEDUCTIONS,
  INCOME,
  rubric,
  SOCIAL,
  wealthRubric,
} from './rubrics.js';
import { incomeTariffTax } from './tariff.js';
import type { BlIccResult, CommuneRef, Item, ItemAmount, Line, Text } from './types.js';

export class BlInputError extends Error {}

/** A fact the household has not given, or a case the documents leave open: the result says which. */
export class BlUnsupported extends Error {
  constructor(readonly note: Text) {
    super(note.en);
  }
}

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const LAW = 'bl-na-steuergesetz-331';

/** Hundredths of a percent as a percentage: 5850 -> "58.5 %", "58,5 %". */
export const pc = (hundredths: number, lang: 'en' | 'fr') => {
  const s = String(hundredths / 100);
  return `${lang === 'fr' ? s.replace('.', ',') : s}${NB}%`;
};
/** A rate (a fraction) to six decimals of a percent, as the canton shows it: "7.545565 %". */
export const rateText = (rate: number, lang: 'en' | 'fr') => {
  const s = (rate * 100).toFixed(6);
  return `${lang === 'fr' ? s.replace('.', ',') : s}${NB}%`;
};
/** 16716 -> "16’716". */
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '’');
/** Nearest 5 centimes of amount x hundredths of a percent. */
const percentOf = (amount: number, hundredths: number) => roundTo(amount * hundredths, 10_000, 5);

export interface BlAssessInput {
  taxYear: BlTaxYear;
  /** The commune of residence on 31 December, by its name or slug. */
  commune: string;
  /** Vollsplitting (married couple, or single parent with a child who gets the child reduction). */
  splitting: boolean;
  /** Documents that say how the household was found to have Vollsplitting or the children. */
  familySources?: readonly string[];
  /** The children who get the child reduction. */
  children: number;
  /** The Roman Catholic church rate (hundredths of a percent of the state tax), or null: none. */
  churchRate?: number | null;
  incomeItems: readonly (Item | ItemAmount)[];
  wealthItems: readonly (Item | ItemAmount)[];
}

/** An amount as printed, as an item with its line's label. */
function asItem(item: Item | ItemAmount, wealth: boolean): Item {
  if ('label' in item) return item;
  const r = wealth ? wealthRubric(item.code) : rubric(item.code);
  if (!r) throw new BlInputError(`Unknown ${wealth ? 'wealth ' : ''}line code ${item.code}.`);
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
const francs = (centimes: number) => Math.floor(Math.max(0, centimes) / 100) * 100;

/** The subtotals of the return, from the items so far (the later lines may still be missing). */
export function subtotals(items: readonly { code: string; amount: number }[]) {
  const pick = (codes: Set<string>) => items.filter((i) => codes.has(i.code));
  const gross = sum(pick(INCOME));
  const net = gross + sum(pick(DEDUCTIONS));
  const beforeRounding = net + sum(pick(SOCIAL));
  return { gross, net, beforeRounding };
}

function only(items: readonly Item[], groups: readonly Set<string>[], what: string) {
  const unknown = items.filter((i) => !groups.some((g) => g.has(i.code)));
  if (unknown.length) {
    throw new BlInputError(`Not ${what}: ${unknown.map((i) => i.code).join(', ')}.`);
  }
}

/** The commune of a year, or an input error. */
export function communeOf(taxYear: BlTaxYear, name: string): BlCommune {
  const c = communeByName(taxYear, name);
  if (!c) throw new BlInputError(`Unknown Basel-Landschaft commune for ${taxYear}: ${name}.`);
  return c;
}

/** The commune reference of a result: its name and its Steuerfuss. */
export function communeRef(taxYear: BlTaxYear, name: string): CommuneRef {
  const c = communeOf(taxYear, name);
  return { bfs: null, name: c.name, rate: c.rate };
}

export function assess(input: BlAssessInput): BlIccResult {
  const y = input.taxYear;
  const P = blParamsFor(y);
  const C = communeOf(y, input.commune);
  const items = input.incomeItems.map(asIncomeItem);
  const wealthItems = input.wealthItems.map(asWealthItem);
  only(items, [INCOME, DEDUCTIONS, SOCIAL], 'an income line');
  only(wealthItems, [ASSETS, DEBTS, ALLOWANCES], 'a wealth line');
  const s = subtotals(items);
  const form = `bl-${y}-steuererklaerung-form`;

  // Income: the totals of the return.
  const incomeLines = of(items, INCOME);
  const deductionLines = of(items, DEDUCTIONS);
  const socialLines = of(items, SOCIAL);
  const grossIncome = new Trace()
    .src(`${form} p. 2 (499 Total der Einkünfte); ${LAW} § 8 Abs. 1 (p. 5), § 9 Abs. 1 (p. 6)`)
    .from(...incomeLines)
    .line(
      s.gross,
      { ...t('Total income', 'Total des revenus'), de: 'Total der Einkünfte (499)' },
      t(
        `The ${incomeLines.length} income line${incomeLines.length === 1 ? '' : 's'} added up: ${chf(s.gross)}.`,
        `Lignes de revenu additionnées (${incomeLines.length})${NB}: ${chf(s.gross)}.`,
      ),
    );
  const netIncome = new Trace()
    .src(`${form} p. 3 (500 to 738)`)
    .from(grossIncome, ...deductionLines)
    .line(
      s.net,
      t(
        'Income after the deductions, before the social deductions',
        'Revenu après les déductions, avant les déductions sociales',
      ),
      t(
        `Total income less the deductions 500 to 738 (${chf(-sum(deductionLines))}): ${chf(s.net)}.`,
        `Total des revenus moins les déductions 500 à 738 (${chf(-sum(deductionLines))})${NB}: ${chf(s.net)}.`,
      ),
    );
  const deductionsTotal = -(sum(deductionLines) + sum(socialLines));
  const totalDeductions = new Trace()
    .src(`${form} p. 3 (789 Total der Abzüge)`)
    .from(...deductionLines, ...socialLines)
    .line(
      deductionsTotal,
      { ...t('Total deductions', 'Total des déductions'), de: 'Total der Abzüge (789)' },
      t(
        `The deductions 500 to 771 added up: ${chf(deductionsTotal)}.`,
        `Les déductions 500 à 771 additionnées${NB}: ${chf(deductionsTotal)}.`,
      ),
    );
  const trTaxable = new Trace()
    .src(`${form} p. 3 (790 steuerbares Einkommen, Ziffer 499 abzüglich Ziffer 789)`)
    .from(grossIncome, totalDeductions);
  trTaxable.p(wholeFrancs(y));
  const taxable = francs(s.beforeRounding);
  const taxableIncome = trTaxable.line(
    taxable,
    { ...t('Taxable income', 'Revenu imposable'), de: 'Steuerbares Einkommen (790)' },
    t(
      `${chf(s.gross)} less ${chf(deductionsTotal)}, in whole francs, never below zero: ${chf(taxable)}.`,
      `${chf(s.gross)} moins ${chf(deductionsTotal)}, en francs entiers, jamais négatif${NB}: ${chf(taxable)}.`,
    ),
  );

  // The rate and the tariff tax.
  const formula = P.income;
  const f = formula.value;
  const tariff = incomeTariffTax(f, taxable, input.splitting);
  const trRate = new Trace().from(taxableIncome).src(...(input.familySources ?? []));
  trRate.p(formula);
  if (input.splitting) trRate.p(splittingRule(y));
  const rateIncome = trRate.line(
    tariff.rateIncome * 100,
    t('Income that sets the rate', 'Revenu déterminant le taux'),
    input.splitting
      ? t(
          `Vollsplitting (married couple or single parent): half the taxable income, rounded down to the franc: ${chf(tariff.rateIncome * 100)}.`,
          `Vollsplitting (couple marié ou famille monoparentale)${NB}: la moitié du revenu imposable, arrondie au franc inférieur${NB}: ${chf(tariff.rateIncome * 100)}.`,
        )
      : t(
          `The taxable income itself: ${chf(tariff.rateIncome * 100)}.`,
          `Le revenu imposable lui-même${NB}: ${chf(tariff.rateIncome * 100)}.`,
        ),
  );
  const trTariff = new Trace().from(rateIncome, taxableIncome);
  trTariff.p(formula);
  const incomeTariffTaxLine = trTariff.line(
    tariff.tax,
    {
      ...t('Income tax by the tariff', 'Impôt sur le revenu selon le tarif'),
      de: 'Steuerbetrag (Einheitstarif)',
    },
    tariff.tax === 0
      ? t(
          `Taxable income under CHF ${thousands(f.min)} (Steuerfreigrenze): no income tax.`,
          `Revenu imposable inférieur à CHF ${thousands(f.min)} (Steuerfreigrenze)${NB}: pas d’impôt sur le revenu.`,
        )
      : tariff.atMinimumRate
        ? t(
            `${chf(taxable)} at the minimum rate (Minimalsteuersatz) ${rateText(tariff.rate, 'en')}, to 5 centimes: ${chf(tariff.tax)}.`,
            `${chf(taxable)} au taux minimal (Minimalsteuersatz) ${rateText(tariff.rate, 'fr')}, à 5 centimes près${NB}: ${chf(tariff.tax)}.`,
          )
        : t(
            `The tariff’s formula at ${chf(tariff.rateIncome * 100)} gives a rate of ${rateText(tariff.rate, 'en')}; ${chf(taxable)} at that rate, to 5 centimes: ${chf(tariff.tax)}.`,
            `La formule du tarif à ${chf(tariff.rateIncome * 100)} donne un taux de ${rateText(tariff.rate, 'fr')}${NB}; ${chf(taxable)} à ce taux, à 5 centimes près${NB}: ${chf(tariff.tax)}.`,
          ),
  );

  // The child reduction, off the tariff tax.
  const A = P.amounts;
  const trChild = new Trace().from(incomeTariffTaxLine).src(...(input.familySources ?? []));
  const perChild = input.children ? trChild.p(A.childReduction) : A.childReduction.value;
  if (input.children) trChild.p(childRule(y));
  const reductionFull = input.children * perChild;
  const reduction = Math.min(reductionFull, tariff.tax);
  const childReduction = trChild.line(
    reduction ? -reduction : 0,
    { ...t('Child reduction', 'Réduction pour enfants'), de: 'Kinderabzug vom Steuerbetrag' },
    input.children
      ? t(
          `${input.children} x ${chf(perChild)} = ${chf(reductionFull)}${reduction < reductionFull ? `, at most the tax itself: ${chf(reduction)}` : ''}.`,
          `${input.children} x ${chf(perChild)} = ${chf(reductionFull)}${reduction < reductionFull ? `, au plus l’impôt lui-même${NB}: ${chf(reduction)}` : ''}.`,
        )
      : t('No child with the child reduction.', 'Aucun enfant donnant droit à la réduction.'),
  );
  const normal = tariff.tax - reduction;
  const normalIncome = new Trace()
    .from(incomeTariffTaxLine, childReduction)
    .src(`${LAW} § 18bis (p. 11)`)
    .line(
      normal,
      {
        ...t('Normal state tax on income', 'Impôt cantonal normal sur le revenu'),
        de: 'Normale Staatssteuer vom Einkommen',
      },
      t(
        `${chf(tariff.tax)} less ${chf(reduction)}: ${chf(normal)}.`,
        `${chf(tariff.tax)} moins ${chf(reduction)}${NB}: ${chf(normal)}.`,
      ),
    );

  // The state and communal tax on income.
  const trCant = new Trace().from(normalIncome);
  const multiplier = trCant.p(P.multiplier);
  const cantonalIncomeAmount = percentOf(normal, multiplier);
  const cantonalIncome = trCant.line(
    cantonalIncomeAmount,
    {
      ...t(
        `State tax on income (Staatssteuer, ${pc(multiplier, 'en')})`,
        `Impôt cantonal sur le revenu (Staatssteuer, ${pc(multiplier, 'fr')})`,
      ),
      de: `Staatssteuer vom Einkommen (${pc(multiplier, 'en')})`,
    },
    t(
      `${chf(normal)} x ${pc(multiplier, 'en')} (the cantonal multiplier, Steuerfuss): ${chf(cantonalIncomeAmount)}.`,
      `${chf(normal)} x ${pc(multiplier, 'fr')} (le coefficient cantonal, Steuerfuss)${NB}: ${chf(cantonalIncomeAmount)}.`,
    ),
  );
  const communeSources = [P.communes.source, communalTax(y).source];
  const communalLine = (base: Line, what: Text) => {
    const amount = percentOf(base.amount, C.rate);
    return new Trace()
      .from(base)
      .src(...communeSources)
      .line(
        amount,
        {
          ...t(
            `Communal tax on ${what.en}, ${C.name} (Gemeindesteuer, ${pc(C.rate, 'en')})`,
            `Impôt communal sur ${what.fr}, ${C.name} (Gemeindesteuer, ${pc(C.rate, 'fr')})`,
          ),
          de: `Gemeindesteuer ${C.name} (${pc(C.rate, 'en')})`,
        },
        t(
          `${chf(base.amount)} x ${pc(C.rate, 'en')}, to 5 centimes: ${chf(amount)}.`,
          `${chf(base.amount)} x ${pc(C.rate, 'fr')}, à 5 centimes près${NB}: ${chf(amount)}.`,
        ),
      );
  };
  const communalIncome = communalLine(normalIncome, t('income', 'le revenu'));

  // Wealth.
  const assets = of(wealthItems, ASSETS);
  const debts = of(wealthItems, DEBTS);
  const allowances = of(wealthItems, ALLOWANCES);
  const grossAmount = sum(assets);
  const grossWealth = new Trace()
    .src(`${form} p. 4 (885 Total der Vermögenswerte); ${LAW} § 41 (p. 30)`)
    .from(...assets)
    .line(
      grossAmount,
      { ...t('Total wealth', 'Total de la fortune'), de: 'Total der Vermögenswerte (885)' },
      t(
        `The ${assets.length} asset${assets.length === 1 ? '' : 's'} added up: ${chf(grossAmount)}.`,
        `Eléments de fortune additionnés (${assets.length})${NB}: ${chf(grossAmount)}.`,
      ),
    );
  const netAmount = grossAmount + sum(debts);
  const netWealth = new Trace()
    .src(`${form} p. 4 (899 Reinvermögen); ${LAW} § 48 (p. 31)`)
    .from(grossWealth, ...debts)
    .line(
      netAmount,
      { ...t('Net wealth', 'Fortune nette'), de: 'Reinvermögen (899)' },
      t(
        `Total wealth less the debts (${chf(-sum(debts))}): ${chf(netAmount)}.`,
        `Total de la fortune moins les dettes (${chf(-sum(debts))})${NB}: ${chf(netAmount)}.`,
      ),
    );
  const trWealth = new Trace()
    .src(`${form} p. 4 (910 steuerbares Vermögen)`)
    .from(netWealth, ...allowances);
  trWealth.p(wealthAllowance(y));
  trWealth.p(wholeFrancs(y));
  const taxableWealthAmount = francs(netAmount + sum(allowances));
  const taxableWealth = trWealth.line(
    taxableWealthAmount,
    { ...t('Taxable wealth', 'Fortune imposable'), de: 'Steuerbares Vermögen (910)' },
    t(
      `${chf(netAmount)} less the allowance (${chf(-sum(allowances))}), in whole francs, never below zero: ${chf(taxableWealthAmount)}.`,
      `${chf(netAmount)} moins le montant exonéré (${chf(-sum(allowances))}), en francs entiers, jamais négatif${NB}: ${chf(taxableWealthAmount)}.`,
    ),
  );
  const trWt = new Trace().from(taxableWealth);
  const w = trWt.p(P.wealth);
  const wealthTaxAmount =
    taxableWealthAmount < w.exemptBelow ? 0 : wealthTax(w.scale, taxableWealthAmount);
  const cantonalWealth = trWt.line(
    wealthTaxAmount,
    {
      ...t('State tax on wealth', 'Impôt cantonal sur la fortune'),
      de: 'Staatssteuer vom Vermögen',
    },
    taxableWealthAmount < w.exemptBelow
      ? t(
          `Taxable wealth under CHF ${thousands(w.exemptBelow / 100)}: no wealth tax (StG § 51 Abs. 1).`,
          `Fortune imposable inférieure à CHF ${thousands(w.exemptBelow / 100)}${NB}: pas d’impôt sur la fortune (StG § 51 al. 1).`,
        )
      : t(
          `${chf(taxableWealthAmount)}: 1.1 per mille up to CHF 150’000, 2.9 per mille up to CHF 350’000, 3.3 per mille above, to 5 centimes: ${chf(wealthTaxAmount)}.`,
          `${chf(taxableWealthAmount)}${NB}: 1,1 pour mille jusqu’à CHF 150’000, 2,9 pour mille jusqu’à CHF 350’000, 3,3 pour mille au-delà, à 5 centimes près${NB}: ${chf(wealthTaxAmount)}.`,
        ),
  );
  const communalWealth = communalLine(cantonalWealth, t('wealth', 'la fortune'));

  // Church tax, when asked for.
  let church: Line | null = null;
  if (input.churchRate != null) {
    const rate = input.churchRate;
    const base = cantonalIncomeAmount + wealthTaxAmount;
    const amount = percentOf(base, rate);
    church = new Trace()
      .from(cantonalIncome, cantonalWealth)
      .src(P.communes.source, churchRule().source)
      .line(
        amount,
        {
          ...t(
            `Church tax, Roman Catholic, ${C.name} (Kirchensteuer, ${pc(rate, 'en')})`,
            `Impôt ecclésiastique catholique romain, ${C.name} (Kirchensteuer, ${pc(rate, 'fr')})`,
          ),
          de: `Kirchensteuer röm.-kath. (${pc(rate, 'en')})`,
        },
        t(
          `The state tax on income and wealth, ${chf(base)}, x ${pc(rate, 'en')}, to 5 centimes: ${chf(amount)}.`,
          `L’impôt cantonal sur le revenu et la fortune, ${chf(base)}, x ${pc(rate, 'fr')}, à 5 centimes près${NB}: ${chf(amount)}.`,
        ),
      );
  }

  const totalAmount =
    cantonalIncomeAmount +
    communalIncome.amount +
    wealthTaxAmount +
    communalWealth.amount +
    (church?.amount ?? 0);
  const churchText = church
    ? t(`; church ${chf(church.amount)}`, `${NB}; ecclésiastique ${chf(church.amount)}`)
    : t('', '');
  const total = new Trace()
    .from(cantonalIncome, communalIncome, cantonalWealth, communalWealth, church ?? undefined)
    .src(communalTax(y).source)
    .line(
      totalAmount,
      church
        ? {
            ...t('State, communal and church tax', 'Impôts cantonal, communal et ecclésiastique'),
            de: 'Staats-, Gemeinde- und Kirchensteuer',
          }
        : {
            ...t('State and communal tax', 'Impôt cantonal et communal'),
            de: 'Staats- und Gemeindesteuer',
          },
      t(
        `Income: state ${chf(cantonalIncomeAmount)} + communal ${chf(communalIncome.amount)}; wealth: state ${chf(wealthTaxAmount)} + communal ${chf(communalWealth.amount)}${churchText.en}; total ${chf(totalAmount)}.`,
        `Revenu${NB}: cantonal ${chf(cantonalIncomeAmount)} + communal ${chf(communalIncome.amount)}${NB}; fortune${NB}: cantonal ${chf(wealthTaxAmount)} + communal ${chf(communalWealth.amount)}${churchText.fr}${NB}; total ${chf(totalAmount)}.`,
      ),
    );

  return {
    items,
    grossIncome,
    netIncome,
    totalDeductions,
    taxableIncome,
    splitting: input.splitting,
    rateIncome,
    rate: tariff.rate,
    wealth: { items: wealthItems, grossWealth, netWealth, taxableWealth },
    taxes: {
      incomeTariffTax: incomeTariffTaxLine,
      childReduction,
      normalIncome,
      cantonalIncome,
      communalIncome,
      cantonalWealth,
      communalWealth,
      church,
      total,
    },
  };
}

/**
 * The wealth tax on a taxable wealth in centimes, whole francs: each bracket's part at its rate,
 * added up exactly, then to the nearest 5 centimes (the documents give no rounding: NOTE.rounding).
 */
export function wealthTax(
  scale: { denominator: number; brackets: readonly (readonly [number, number])[] },
  taxableWealth: number,
): number {
  const chfs = Math.floor(Math.max(0, taxableWealth) / 100);
  let previous = 0;
  let numerator = 0; // CHF x rate, over the denominator: CHF
  for (const [upper, rate] of scale.brackets) {
    const top = Math.min(chfs, upper);
    if (top > previous) numerator += (top - previous) * rate;
    if (chfs <= upper) break;
    previous = upper;
  }
  // numerator / denominator CHF = numerator x 100 / denominator centimes.
  return roundTo(numerator * 100, scale.denominator, 5);
}

/** For the sources test: the cited rules this module applies. */
export const ASSESS_RULES = (y: BlTaxYear): Cited<unknown>[] => [
  wholeFrancs(y),
  splittingRule(y),
  childRule(y),
  communalTax(y),
  wealthAllowance(y),
  ...(y === 2026 ? [churchRule()] : []),
];
