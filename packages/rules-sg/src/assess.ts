// From the lines of the return to the taxes: the second half of the engine.
//
// Income, in the order of the return: the income lines are the total (168, Ziffer 7); less the
// deductions 10 to 17 (230, Ziffer 18) they are the Nettoeinkommen (234, Ziffer 20); less the
// deductions from it (21.1 and 21.3), the Reineinkommen (248, Ziffer 22); less the social deductions
// (23.1 to 23.3), the taxable income (268, Ziffer 24), in whole francs, never below zero. Wealth: the
// assets less the debts are the net wealth (326, Ziffer 35); less the social deductions (36.1 to
// 36.3), the taxable wealth (338, Ziffer 37).
//
// Taxes (StG Art. 5, 6, 50, 65): the tariff gives the einfache Steuer on the taxable income, at the
// rate of half of it with Vollsplitting, and on the taxable wealth; the canton, the political commune
// and, for its members, the church each levy their multiplier on it.
import { chf, roundTo, Trace, type Cited } from '@taxpresso/rules-ch';
import { communeByName, type SgCommune } from './communes.js';
import {
  communeAtYearEnd,
  churchRule,
  familySituation,
  multipliedTax,
  splittingRule,
} from './law.js';
import { sgParamsFor, type SgTaxYear } from './params.js';
import {
  ALLOWANCES,
  ASSETS,
  DEBTS,
  DEDUCTIONS,
  INCOME,
  NET_DEDUCTIONS,
  rubric,
  SOCIAL,
  wealthRubric,
} from './rubrics.js';
import { incomeTariffTax, ratePercent, wealthTariffTax } from './tariff.js';
import type {
  ChurchShare,
  CommuneRef,
  Item,
  ItemAmount,
  Line,
  SgIccResult,
  Text,
} from './types.js';

export class SgInputError extends Error {}

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = '\u00a0';

/** Hundredths of a percent as a percentage: 13800 -> "138 %", 2250 -> "22.5 %" ("22,5 %"). */
export const pc = (hundredths: number, lang: 'en' | 'fr') => {
  const s = String(hundredths / 100);
  return `${lang === 'fr' ? s.replace('.', ',') : s}${NB}%`;
};
/** 11600 -> "11’600". */
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '’');
/** Nearest 5 centimes of amount x hundredths of a percent x share percent (the multipliers). */
export const percentOf = (amount: number, hundredths: number, share = 100) =>
  roundTo(amount * hundredths * share, 1_000_000, 5);
const sum = (items: readonly { amount: number }[]) => items.reduce((s, i) => s + i.amount, 0);
const of = (items: readonly Item[], codes: Set<string>) => items.filter((i) => codes.has(i.code));
const francs = (centimes: number) => Math.floor(Math.max(0, centimes) / 100) * 100;

export interface SgAssessInput {
  taxYear: SgTaxYear;
  /** The commune of residence on 31 December, by its name or slug. */
  commune: string;
  /** Vollsplitting (married couple, or single parent living with children they mainly support). */
  splitting: boolean;
  /** Documents that say how the household was found to have Vollsplitting or the children. */
  familySources?: readonly string[];
  /** The church tax's shares, or null: not asked for or no member. */
  church?: readonly ChurchShare[] | null;
  /** 21.1 as the return lays it out (650, 238), from ./compute.ts; null or absent without costs. */
  medical?: SgIccResult['medical'];
  incomeItems: readonly (Item | ItemAmount)[];
  wealthItems: readonly (Item | ItemAmount)[];
}

/** An amount as printed, as an item with its line's label. */
function asItem(item: Item | ItemAmount, wealth: boolean): Item {
  if ('label' in item) return item;
  const r = wealth ? wealthRubric(item.code) : rubric(item.code);
  if (!r) throw new SgInputError(`Unknown ${wealth ? 'wealth ' : ''}line code ${item.code}.`);
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

/** The subtotals of the return from the items so far (the later lines may still be missing). */
export function subtotals(items: readonly { code: string; amount: number }[]) {
  const pick = (codes: Set<string>) => items.filter((i) => codes.has(i.code));
  const gross = sum(pick(INCOME));
  const deductions = -sum(pick(DEDUCTIONS));
  const netBase = gross - deductions;
  const net = netBase + sum(pick(NET_DEDUCTIONS));
  const beforeRounding = net + sum(pick(SOCIAL));
  return { gross, deductions, netBase, net, beforeRounding };
}

function only(items: readonly Item[], groups: readonly Set<string>[], what: string) {
  const unknown = items.filter((i) => !groups.some((g) => g.has(i.code)));
  if (unknown.length) {
    throw new SgInputError(`Not ${what}: ${unknown.map((i) => i.code).join(', ')}.`);
  }
}

/** The commune of a year, or an input error. */
export function communeOf(taxYear: SgTaxYear, name: string): SgCommune {
  const c = communeByName(taxYear, name);
  if (!c) throw new SgInputError(`Unknown St. Gallen commune for ${taxYear}: ${name}.`);
  return c;
}

/** The commune reference of a result: its name and its Gesamtsteuerfuss. */
export function communeRef(taxYear: SgTaxYear, name: string): CommuneRef {
  const c = communeOf(taxYear, name);
  return { bfs: null, name: c.name, rate: c.rate };
}

const CHURCH_NAME: Record<ChurchShare['confession'], Text> = {
  catholic: t('Catholic', 'catholique'),
  reformed: t('Evangelical Reformed', 'évangélique réformée'),
  christ_catholic: t('Christ Catholic', 'catholique chrétienne'),
};

export function assess(input: SgAssessInput): SgIccResult {
  const y = input.taxYear;
  const P = sgParamsFor(y);
  const C = communeOf(y, input.commune);
  const items = input.incomeItems.map(asIncomeItem);
  const wealthItems = input.wealthItems.map(asWealthItem);
  only(items, [INCOME, DEDUCTIONS, NET_DEDUCTIONS, SOCIAL], 'an income line');
  only(wealthItems, [ASSETS, DEBTS, ALLOWANCES], 'a wealth line');
  const s = subtotals(items);
  const form = 'sg-2025-form-steuererklaerung';

  // Income: the totals of the return.
  const incomeLines = of(items, INCOME);
  const deductionLines = of(items, DEDUCTIONS);
  const netLines = of(items, NET_DEDUCTIONS);
  const socialLines = of(items, SOCIAL);
  const grossIncome = new Trace()
    .src(`${form} p. 2 (Ziffer 7, 168 Total der Einkünfte)`)
    .from(...incomeLines)
    .line(
      s.gross,
      { ...t('Total income', 'Total des revenus'), de: '7. Total der Einkünfte' },
      t(
        `The ${incomeLines.length} income line${incomeLines.length === 1 ? '' : 's'} added up: ${chf(s.gross)}.`,
        `Lignes de revenu additionnées (${incomeLines.length})${NB}: ${chf(s.gross)}.`,
      ),
    );
  const totalDeductions = new Trace()
    .src(`${form} p. 3 (Ziffer 18, 230 Total der Abzüge)`)
    .from(...deductionLines)
    .line(
      s.deductions,
      { ...t('Total deductions', 'Total des déductions'), de: '18. Total der Abzüge' },
      t(
        `The deductions 10 to 17 added up: ${chf(s.deductions)}.`,
        `Les déductions 10 à 17 additionnées${NB}: ${chf(s.deductions)}.`,
      ),
    );
  const netIncomeBase = new Trace()
    .src(`${form} p. 3 (Ziffer 20, 234 Nettoeinkommen: Ziffer 7 abzüglich Ziffer 18)`)
    .from(grossIncome, totalDeductions)
    .line(
      s.netBase,
      {
        ...t('Net income (Nettoeinkommen)', 'Revenu net (Nettoeinkommen)'),
        de: '20. Nettoeinkommen',
      },
      t(
        `${chf(s.gross)} less ${chf(s.deductions)}: ${chf(s.netBase)}.`,
        `${chf(s.gross)} moins ${chf(s.deductions)}${NB}: ${chf(s.netBase)}.`,
      ),
    );
  const netIncome = new Trace()
    .src(`${form} p. 3 (Ziffer 22, 248 Reineinkommen: Ziffer 20 abzüglich Ziffern 21.1 bis 21.3)`)
    .from(netIncomeBase, ...netLines)
    .line(
      s.net,
      {
        ...t(
          'Income after the deductions (Reineinkommen)',
          'Revenu après les déductions (Reineinkommen)',
        ),
        de: '22. Reineinkommen',
      },
      t(
        `${chf(s.netBase)} less illness costs and donations (${chf(-sum(netLines))}): ${chf(s.net)}.`,
        `${chf(s.netBase)} moins frais de maladie et dons (${chf(-sum(netLines))})${NB}: ${chf(s.net)}.`,
      ),
    );
  const taxable = francs(s.beforeRounding);
  const taxableIncome = new Trace()
    .src(
      `${form} p. 3 (Ziffer 24, 268 Steuerbares Einkommen gesamt: Ziffer 22 abzüglich Ziffern 23.1 bis 23.3)`,
    )
    .src(familySituation(y).source)
    .from(netIncome, ...socialLines)
    .line(
      taxable,
      { ...t('Taxable income', 'Revenu imposable'), de: '24. Steuerbares Einkommen' },
      t(
        `${chf(s.net)} less the social deductions (${chf(-sum(socialLines))}), in whole francs, never below zero: ${chf(taxable)}.`,
        `${chf(s.net)} moins les déductions sociales (${chf(-sum(socialLines))}), en francs entiers, jamais négatif${NB}: ${chf(taxable)}.`,
      ),
    );

  // The rate and the einfache Steuer on income.
  const f = P.income.value;
  const tariff = incomeTariffTax(f, taxable, input.splitting);
  const trRate = new Trace().from(taxableIncome).src(...(input.familySources ?? []));
  trRate.p(P.income);
  if (input.splitting) trRate.p(splittingRule(y));
  const rateIncome = trRate.line(
    tariff.rateIncome * 100,
    t('Income that sets the rate', 'Revenu déterminant le taux'),
    input.splitting
      ? t(
          `Vollsplitting (married couple or single parent): half the taxable income, rounded down to 100 francs: ${chf(tariff.rateIncome * 100)}.`,
          `Vollsplitting (couple marié ou famille monoparentale)${NB}: la moitié du revenu imposable, arrondie à la centaine de francs inférieure${NB}: ${chf(tariff.rateIncome * 100)}.`,
        )
      : t(
          `The taxable income itself: ${chf(tariff.rateIncome * 100)}.`,
          `Le revenu imposable lui-même${NB}: ${chf(tariff.rateIncome * 100)}.`,
        ),
  );
  const trSimple = new Trace().from(rateIncome, taxableIncome);
  trSimple.p(P.income);
  const top = input.splitting ? 2 * f.topFrom : f.topFrom;
  const simpleIncome = trSimple.line(
    tariff.tax,
    {
      ...t(
        'Simple tax on income (einfache Steuer)',
        'Impôt simple sur le revenu (einfache Steuer)',
      ),
      de: 'Einfache Steuer vom Einkommen',
    },
    tariff.tax === 0
      ? t(
          `The rate at ${chf(tariff.rateIncome * 100)} is zero (the first CHF ${thousands(f.brackets[0]![0])} are taxed at 0 percent): no income tax.`,
          `Le taux à ${chf(tariff.rateIncome * 100)} est nul (les premiers CHF ${thousands(f.brackets[0]![0])} sont imposés à 0${NB}%)${NB}: pas d’impôt sur le revenu.`,
        )
      : tariff.top
        ? t(
            `Taxable income above CHF ${thousands(top)}: ${ratePercent(tariff.rate, 'en')} of the whole income, to 5 centimes: ${chf(tariff.tax)}.`,
            `Revenu imposable supérieur à CHF ${thousands(top)}${NB}: ${ratePercent(tariff.rate, 'fr')} de tout le revenu, à 5 centimes près${NB}: ${chf(tariff.tax)}.`,
          )
        : t(
            `The tariff at ${chf(tariff.rateIncome * 100)} gives a rate of ${ratePercent(tariff.rate, 'en')}; ${chf(taxable)} at that rate, to 5 centimes: ${chf(tariff.tax)}.`,
            `Le tarif à ${chf(tariff.rateIncome * 100)} donne un taux de ${ratePercent(tariff.rate, 'fr')}${NB}; ${chf(taxable)} à ce taux, à 5 centimes près${NB}: ${chf(tariff.tax)}.`,
          ),
  );

  // Wealth.
  const assets = of(wealthItems, ASSETS);
  const debts = of(wealthItems, DEBTS);
  const allowances = of(wealthItems, ALLOWANCES);
  const grossAmount = sum(assets);
  const grossWealth = new Trace()
    .src(`${form} p. 4 (Ziffer 33, 322 Total der Vermögenswerte)`)
    .from(...assets)
    .line(
      grossAmount,
      { ...t('Total wealth', 'Total de la fortune'), de: '33. Total der Vermögenswerte' },
      t(
        `The ${assets.length} asset${assets.length === 1 ? '' : 's'} added up: ${chf(grossAmount)}.`,
        `Eléments de fortune additionnés (${assets.length})${NB}: ${chf(grossAmount)}.`,
      ),
    );
  const netAmount = grossAmount + sum(debts);
  const netWealth = new Trace()
    .src(`${form} p. 4 (Ziffer 35, 326 Reinvermögen)`)
    .from(grossWealth, ...debts)
    .line(
      netAmount,
      { ...t('Net wealth', 'Fortune nette'), de: '35. Reinvermögen' },
      t(
        `Total wealth less the debts (${chf(-sum(debts))}): ${chf(netAmount)}.`,
        `Total de la fortune moins les dettes (${chf(-sum(debts))})${NB}: ${chf(netAmount)}.`,
      ),
    );
  const taxableWealthAmount = francs(netAmount + sum(allowances));
  const taxableWealth = new Trace()
    .src(`${form} p. 4 (Ziffer 37, 338 Steuerbares Vermögen gesamt)`)
    .src(familySituation(y).source)
    .from(netWealth, ...allowances)
    .line(
      taxableWealthAmount,
      { ...t('Taxable wealth', 'Fortune imposable'), de: '37. Steuerbares Vermögen' },
      t(
        `${chf(netAmount)} less the social deductions (${chf(-sum(allowances))}), in whole francs, never below zero: ${chf(taxableWealthAmount)}.`,
        `${chf(netAmount)} moins les déductions sociales (${chf(-sum(allowances))}), en francs entiers, jamais négatif${NB}: ${chf(taxableWealthAmount)}.`,
      ),
    );
  const trWt = new Trace().from(taxableWealth);
  const w = trWt.p(P.wealth);
  const wt = wealthTariffTax(w, taxableWealthAmount);
  const simpleWealth = trWt.line(
    wt.tax,
    {
      ...t(
        'Simple tax on wealth (einfache Steuer)',
        'Impôt simple sur la fortune (einfache Steuer)',
      ),
      de: 'Einfache Steuer vom Vermögen',
    },
    wt.tax === 0
      ? t(
          `Taxable wealth under CHF ${thousands(w.step)}: no wealth tax.`,
          `Fortune imposable inférieure à CHF ${thousands(w.step)}${NB}: pas d’impôt sur la fortune.`,
        )
      : t(
          `${chf(wt.base)} (the francs under CHF ${thousands(w.step)} dropped) x ${w.rate / 10} per mille: ${chf(wt.tax)}.`,
          `${chf(wt.base)} (les francs sous CHF ${thousands(w.step)} abandonnés) x ${String(w.rate / 10).replace('.', ',')} pour mille${NB}: ${chf(wt.tax)}.`,
        ),
  );

  // The cantonal and communal taxes: the einfache Steuer times each multiplier.
  const taxSources = [multipliedTax(y).source];
  const cantonal = (base: Line, what: Text) => {
    const tr = new Trace().from(base).src(...taxSources);
    const m = tr.p(P.multiplier);
    const amount = percentOf(base.amount, m);
    return tr.line(
      amount,
      {
        ...t(
          `Cantonal tax on ${what.en} (Kantonssteuer, ${pc(m, 'en')})`,
          `Impôt cantonal sur ${what.fr} (Kantonssteuer, ${pc(m, 'fr')})`,
        ),
        de: `Kantonssteuer (${pc(m, 'en')})`,
      },
      t(
        `${chf(base.amount)} x ${pc(m, 'en')} (the cantonal multiplier, Steuerfuss), to 5 centimes: ${chf(amount)}.`,
        `${chf(base.amount)} x ${pc(m, 'fr')} (le coefficient cantonal, Steuerfuss), à 5 centimes près${NB}: ${chf(amount)}.`,
      ),
    );
  };
  const communal = (base: Line, what: Text) => {
    const amount = percentOf(base.amount, C.rate);
    return new Trace()
      .from(base)
      .src(P.communes.source, communeAtYearEnd(y).source, ...taxSources)
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
          `${chf(base.amount)} x ${pc(C.rate, 'en')} (the commune’s Gesamtsteuerfuss), to 5 centimes: ${chf(amount)}.`,
          `${chf(base.amount)} x ${pc(C.rate, 'fr')} (le coefficient de la commune, Gesamtsteuerfuss), à 5 centimes près${NB}: ${chf(amount)}.`,
        ),
      );
  };
  const income = t('income', 'le revenu');
  const wealth = t('wealth', 'la fortune');
  const cantonalIncome = cantonal(simpleIncome, income);
  const communalIncome = communal(simpleIncome, income);
  const cantonalWealth = cantonal(simpleWealth, wealth);
  const communalWealth = communal(simpleWealth, wealth);

  // Church tax, when asked for: each share's rate on the einfache Steuer on income and wealth.
  let church: Line | null = null;
  const shares = input.church ?? [];
  if (shares.length) {
    const base = simpleIncome.amount + simpleWealth.amount;
    const parts = shares.map((sh) => ({ sh, amount: percentOf(base, sh.rate, sh.share) }));
    const amount = parts.reduce((x, p) => x + p.amount, 0);
    const tr = new Trace().from(simpleIncome, simpleWealth).src(churchRule(y).source);
    tr.src(P.communes.source);
    if (shares.some((sh) => sh.confession === 'christ_catholic')) tr.p(P.christCatholic);
    const what = (lang: 'en' | 'fr') =>
      parts
        .map(({ sh, amount: a }) => {
          const name = CHURCH_NAME[sh.confession][lang];
          const where = sh.area ? `, ${sh.area}` : '';
          const half = sh.share === 50 ? (lang === 'en' ? 'half of ' : 'la moitié de ') : '';
          return lang === 'en'
            ? `${name}${where}: ${half}${chf(base)} x ${pc(sh.rate, 'en')} = ${chf(a)}`
            : `${name}${where}${NB}: ${half}${chf(base)} x ${pc(sh.rate, 'fr')} = ${chf(a)}`;
        })
        .join(lang === 'en' ? '; ' : `${NB}; `);
    church = tr.line(
      amount,
      {
        ...t('Church tax (Kirchensteuer)', 'Impôt ecclésiastique (Kirchensteuer)'),
        de: 'Kirchensteuer',
      },
      t(
        `The simple tax on income and wealth, ${chf(base)}, at the church’s rate, to 5 centimes. ${what('en')}.`,
        `L’impôt simple sur le revenu et la fortune, ${chf(base)}, au taux de l’Eglise, à 5 centimes près. ${what('fr')}.`,
      ),
    );
  }

  const totalAmount =
    cantonalIncome.amount +
    communalIncome.amount +
    cantonalWealth.amount +
    communalWealth.amount +
    (church?.amount ?? 0);
  const churchText = church
    ? t(`; church ${chf(church.amount)}`, `${NB}; ecclésiastique ${chf(church.amount)}`)
    : t('', '');
  const total = new Trace()
    .from(cantonalIncome, communalIncome, cantonalWealth, communalWealth, church ?? undefined)
    .src(...taxSources)
    .line(
      totalAmount,
      church
        ? {
            ...t(
              'Cantonal, communal and church tax',
              'Impôts cantonal, communal et ecclésiastique',
            ),
            de: 'Kantons-, Gemeinde- und Kirchensteuer',
          }
        : {
            ...t('Cantonal and communal tax', 'Impôt cantonal et communal'),
            de: 'Kantons- und Gemeindesteuer',
          },
      t(
        `Income: cantonal ${chf(cantonalIncome.amount)} + communal ${chf(communalIncome.amount)}; wealth: cantonal ${chf(cantonalWealth.amount)} + communal ${chf(communalWealth.amount)}${churchText.en}; total ${chf(totalAmount)}.`,
        `Revenu${NB}: cantonal ${chf(cantonalIncome.amount)} + communal ${chf(communalIncome.amount)}${NB}; fortune${NB}: cantonal ${chf(cantonalWealth.amount)} + communal ${chf(communalWealth.amount)}${churchText.fr}${NB}; total ${chf(totalAmount)}.`,
      ),
    );

  return {
    items,
    grossIncome,
    totalDeductions,
    netIncomeBase,
    medical: input.medical ?? null,
    netIncome,
    taxableIncome,
    splitting: input.splitting,
    rateIncome,
    wealth: { items: wealthItems, grossWealth, netWealth, taxableWealth },
    taxes: {
      simpleIncome,
      simpleWealth,
      cantonalIncome,
      communalIncome,
      cantonalWealth,
      communalWealth,
      church,
      churchShares: [...shares],
      total,
    },
  };
}

/** For the sources test: the cited rules this module applies. */
export const ASSESS_RULES = (y: SgTaxYear): Cited<unknown>[] => [
  multipliedTax(y),
  splittingRule(y),
  familySituation(y),
  communeAtYearEnd(y),
  churchRule(y),
];
