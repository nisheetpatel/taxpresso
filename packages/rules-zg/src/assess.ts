// From the lines of form K to the taxes: the second half of the engine.
//
// Income, in the order of the form: the income lines are the total (190, carried to 285); less the
// deductions 201 to 260 (280, carried to 286) they are the subtotal 287 (Zwischentotal); less the
// illness costs and donations (295, 296) the net income 299 (Reineinkommen); less the social
// deductions 400 to 407 the taxable income 490, in whole francs, never below zero.
// Wealth: the assets (630) less the debts (650) are the net wealth 660; less the tax-free amounts
// 671 to 673, the taxable wealth 690.
//
// Taxes (StG § 2, § 35, § 44, §§ 168 to 170): the Grundtarif or the Mehrpersonentarif gives the
// einfache Steuer on the taxable income, the wealth tariff the einfache Steuer on the taxable
// wealth; the canton, the commune and, when asked for, the parish and the Bürgergemeinde each levy
// their Steuerfuss of the two together.
import { chf, Trace, type Cited } from '@taxpresso/rules-ch';
import { communeByName, type ZgCommune } from './communes.js';
import {
  churchRule,
  citizensRule,
  communeAtYearEnd,
  simpleTaxRule,
  tariffRule,
  wholeFrancs,
} from './law.js';
import { zgParamsFor, type ZgTaxYear } from './params.js';
import {
  ALLOWANCES,
  ASSETS,
  DEBTS,
  DEDUCTIONS,
  FURTHER,
  INCOME,
  rubric,
  SOCIAL,
  wealthRubric,
} from './rubrics.js';
import { simpleTax } from './tariff.js';
import type { CommuneRef, Item, ItemAmount, Line, Text, ZgIccResult } from './types.js';

export class ZgInputError extends Error {}

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const GUIDE = 'zg-2025-guide-wegleitung';

/** Hundredths of a percent as a percentage: 5211 -> "52.11 %", "52,11 %". */
export const pc = (hundredths: number, lang: 'en' | 'fr') => {
  const s = String(hundredths / 100);
  return `${lang === 'fr' ? s.replace('.', ',') : s}${NB}%`;
};

/**
 * A Steuerfuss (hundredths of a percent) of an einfache Steuer in centimes, times a share in basis
 * points (10,000: all of it), to the nearest 5 centimes, halves up (NOTE.rounding). Exact: BigInt.
 */
export function levy(simple: number, rate: number, shareBp = 10_000): number {
  const num = BigInt(Math.max(0, simple)) * BigInt(rate) * BigInt(shareBp);
  const den = 100_000_000n;
  return Number((2n * num + 5n * den) / (10n * den)) * 5;
}

/** A parish or Bürgergemeinde levy: its Steuerfuss and the share of it the household pays. */
export interface LevyPart {
  /** 'catholic' or 'reformed' for a church; the Bürgergemeinde's commune for the citizens' tax. */
  who: string;
  rate: number;
  shareBp: number;
}

export interface ZgAssessInput {
  taxYear: ZgTaxYear;
  /** The commune of residence on 31 December, by its name or slug. */
  commune: string;
  /** The Mehrpersonentarif (married couples, single parents) or the Grundtarif. */
  tariff: 'single' | 'married';
  /** Documents that say how the household was found to have its tariff. */
  familySources?: readonly string[];
  /** The church tax's parts (one per parish the household pays), or null: none. */
  church?: readonly LevyPart[] | null;
  /** The Bürgergemeinde's levy, or null: none. */
  citizens?: LevyPart | null;
  incomeItems: readonly (Item | ItemAmount)[];
  wealthItems: readonly (Item | ItemAmount)[];
}

/** An amount as printed, as an item with its line's label. */
function asItem(item: Item | ItemAmount, wealth: boolean): Item {
  if ('label' in item) return item;
  const r = wealth ? wealthRubric(item.code) : rubric(item.code);
  if (!r) throw new ZgInputError(`Unknown ${wealth ? 'wealth ' : ''}line code ${item.code}.`);
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

/** The subtotals of form K, from the items so far (the later lines may still be missing). */
export function subtotals(items: readonly { code: string; amount: number }[]) {
  const pick = (codes: Set<string>) => items.filter((i) => codes.has(i.code));
  const gross = sum(pick(INCOME));
  const subtotal = gross + sum(pick(DEDUCTIONS));
  const net = subtotal + sum(pick(FURTHER));
  const beforeRounding = net + sum(pick(SOCIAL));
  return { gross, subtotal, net, beforeRounding };
}

/** The wealth subtotals: the assets (630), the net wealth (660) and before rounding (690). */
export function wealthTotals(items: readonly { code: string; amount: number }[]) {
  const pick = (codes: Set<string>) => items.filter((i) => codes.has(i.code));
  const gross = sum(pick(ASSETS));
  const net = gross + sum(pick(DEBTS));
  return { gross, net, beforeRounding: net + sum(pick(ALLOWANCES)) };
}

function only(items: readonly Item[], groups: readonly Set<string>[], what: string) {
  const unknown = items.filter((i) => !groups.some((g) => g.has(i.code)));
  if (unknown.length) {
    throw new ZgInputError(`Not ${what}: ${unknown.map((i) => i.code).join(', ')}.`);
  }
}

/** The commune of a year, or an input error. */
export function communeOf(taxYear: ZgTaxYear, name: string): ZgCommune {
  const c = communeByName(taxYear, name);
  if (!c) throw new ZgInputError(`Unknown Zug commune for ${taxYear}: ${name}.`);
  return c;
}

/** The commune reference of a result: its name and its Steuerfuss. */
export function communeRef(taxYear: ZgTaxYear, name: string): CommuneRef {
  const c = communeOf(taxYear, name);
  return { bfs: null, name: c.name, rate: c.rate };
}

const CHURCH: Record<string, Text & { de: string }> = {
  catholic: {
    ...t('Roman Catholic parish', 'paroisse catholique romaine'),
    de: 'Katholische Kirchgemeinde',
  },
  reformed: {
    ...t('Evangelical Reformed parish', 'paroisse évangélique réformée'),
    de: 'Evangelisch-reformierte Kirchgemeinde',
  },
};

export function assess(input: ZgAssessInput): ZgIccResult {
  const y = input.taxYear;
  const P = zgParamsFor(y);
  const C = communeOf(y, input.commune);
  const items = input.incomeItems.map(asIncomeItem);
  const wealthItems = input.wealthItems.map(asWealthItem);
  only(items, [INCOME, DEDUCTIONS, FURTHER, SOCIAL], 'an income line');
  only(wealthItems, [ASSETS, DEBTS, ALLOWANCES], 'a wealth line');
  const s = subtotals(items);
  const form = `${GUIDE} p. 18 (Mustersteuererklärung, Formular K)`;

  // Income: the totals of form K.
  const incomeLines = of(items, INCOME);
  const deductionLines = of(items, DEDUCTIONS);
  const furtherLines = of(items, FURTHER);
  const socialLines = of(items, SOCIAL);
  const grossIncome = new Trace()
    .src(`${GUIDE} p. 17 (Mustersteuererklärung, Formular K: 190 Total Einkünfte)`)
    .from(...incomeLines)
    .line(
      s.gross,
      { ...t('Total income', 'Total des revenus'), de: 'Total Einkünfte (190, 285)' },
      t(
        `The ${incomeLines.length} income line${incomeLines.length === 1 ? '' : 's'} added up: ${chf(s.gross)}.`,
        `Lignes de revenu additionnées (${incomeLines.length})${NB}: ${chf(s.gross)}.`,
      ),
    );
  const deductionsTotal = -sum(deductionLines);
  const totalDeductions = new Trace()
    .src(`${form}: 280 Total Abzüge`)
    .from(...deductionLines)
    .line(
      deductionsTotal,
      { ...t('Total deductions', 'Total des déductions'), de: 'Total Abzüge (280, 286)' },
      t(
        `The deductions 201 to 260 added up: ${chf(deductionsTotal)}.`,
        `Les déductions 201 à 260 additionnées${NB}: ${chf(deductionsTotal)}.`,
      ),
    );
  const subtotal = new Trace()
    .src(`${form}: 287 Zwischentotal (Code 285 abzüglich Code 286)`)
    .from(grossIncome, totalDeductions)
    .line(
      s.subtotal,
      { ...t('Subtotal', 'Sous-total'), de: 'Zwischentotal (287)' },
      t(
        `${chf(s.gross)} less ${chf(deductionsTotal)}: ${chf(s.subtotal)}.`,
        `${chf(s.gross)} moins ${chf(deductionsTotal)}${NB}: ${chf(s.subtotal)}.`,
      ),
    );
  const netIncome = new Trace()
    .src(`${form}: 299 Reineinkommen (Code 287 abzüglich Codes 295 und 296)`)
    .from(subtotal, ...furtherLines)
    .line(
      s.net,
      { ...t('Net income', 'Revenu net'), de: 'Reineinkommen (299)' },
      t(
        `${chf(s.subtotal)} less illness costs and donations (${chf(-sum(furtherLines))}): ${chf(s.net)}.`,
        `${chf(s.subtotal)} moins frais de maladie et dons (${chf(-sum(furtherLines))})${NB}: ${chf(s.net)}.`,
      ),
    );
  const trTaxable = new Trace()
    .src(`${form}: 490 Steuerbares Einkommen gesamt`)
    .from(netIncome, ...socialLines);
  trTaxable.p(wholeFrancs());
  const taxable = francs(s.beforeRounding);
  const taxableIncome = trTaxable.line(
    taxable,
    { ...t('Taxable income', 'Revenu imposable'), de: 'Steuerbares Einkommen (490)' },
    t(
      `${chf(s.net)} less the social deductions (${chf(-sum(socialLines))}), in whole francs, never below zero: ${chf(taxable)}.`,
      `${chf(s.net)} moins les déductions sociales (${chf(-sum(socialLines))}), en francs entiers, jamais négatif${NB}: ${chf(taxable)}.`,
    ),
  );

  // Wealth.
  const assets = of(wealthItems, ASSETS);
  const debts = of(wealthItems, DEBTS);
  const allowances = of(wealthItems, ALLOWANCES);
  const w = wealthTotals(wealthItems);
  const wform = `${GUIDE} p. 19 (Mustersteuererklärung, Formular K`;
  const grossWealth = new Trace()
    .src(`${wform}: 630 Total der Vermögenswerte)`)
    .from(...assets)
    .line(
      w.gross,
      { ...t('Total wealth', 'Total de la fortune'), de: 'Total der Vermögenswerte (630)' },
      t(
        `The ${assets.length} asset${assets.length === 1 ? '' : 's'} added up: ${chf(w.gross)}.`,
        `Eléments de fortune additionnés (${assets.length})${NB}: ${chf(w.gross)}.`,
      ),
    );
  const netWealth = new Trace()
    .src(`${wform}: 660 Reinvermögen, Code 630 abzüglich Code 650)`)
    .from(grossWealth, ...debts)
    .line(
      w.net,
      { ...t('Net wealth', 'Fortune nette'), de: 'Reinvermögen (660)' },
      t(
        `Total wealth less the debts (${chf(-sum(debts))}): ${chf(w.net)}.`,
        `Total de la fortune moins les dettes (${chf(-sum(debts))})${NB}: ${chf(w.net)}.`,
      ),
    );
  const trWealth = new Trace()
    .src(`${wform}: 690 Steuerbares Gesamtvermögen)`)
    .from(netWealth, ...allowances);
  trWealth.p(wholeFrancs());
  const taxableWealthAmount = francs(w.beforeRounding);
  const taxableWealth = trWealth.line(
    taxableWealthAmount,
    { ...t('Taxable wealth', 'Fortune imposable'), de: 'Steuerbares Gesamtvermögen (690)' },
    t(
      `${chf(w.net)} less the tax-free amounts (${chf(-sum(allowances))}), in whole francs, never below zero: ${chf(taxableWealthAmount)}.`,
      `${chf(w.net)} moins les montants exonérés (${chf(-sum(allowances))}), en francs entiers, jamais négatif${NB}: ${chf(taxableWealthAmount)}.`,
    ),
  );

  // The einfache Steuer.
  const trInc = new Trace().from(taxableIncome).src(...(input.familySources ?? []));
  const scale = trInc.p(P.income)[input.tariff];
  trInc.p(tariffRule(y));
  const simpleIncomeAmount = simpleTax(scale, taxable);
  const tariffName =
    input.tariff === 'married'
      ? t(
          'the Mehrpersonentarif (married couples, single parents)',
          'le Mehrpersonentarif (couples mariés, familles monoparentales)',
        )
      : t('the Grundtarif (single)', 'le Grundtarif (personnes seules)');
  const simpleIncome = trInc.line(
    simpleIncomeAmount,
    {
      ...t('Simple tax on income (100 %)', 'Impôt simple sur le revenu (100 %)'),
      de: 'Einfache Steuer vom Einkommen',
    },
    t(
      `${chf(taxable)} by ${tariffName.en}, bracket by bracket, to the centime: ${chf(simpleIncomeAmount)}.`,
      `${chf(taxable)} selon ${tariffName.fr}, tranche par tranche, au centime${NB}: ${chf(simpleIncomeAmount)}.`,
    ),
  );
  const trW = new Trace().from(taxableWealth);
  const wealthScale = trW.p(P.wealth);
  const simpleWealthAmount = simpleTax(wealthScale, taxableWealthAmount);
  const simpleWealth = trW.line(
    simpleWealthAmount,
    {
      ...t('Simple tax on wealth (100 %)', 'Impôt simple sur la fortune (100 %)'),
      de: 'Einfache Steuer vom Vermögen',
    },
    t(
      `${chf(taxableWealthAmount)} by the wealth tariff, bracket by bracket, to the centime: ${chf(simpleWealthAmount)}.`,
      `${chf(taxableWealthAmount)} selon le barème de la fortune, tranche par tranche, au centime${NB}: ${chf(simpleWealthAmount)}.`,
    ),
  );
  const simpleAmount = simpleIncomeAmount + simpleWealthAmount;
  const simple = new Trace()
    .from(simpleIncome, simpleWealth)
    .src(simpleTaxRule(y).source)
    .line(
      simpleAmount,
      { ...t('Simple tax (100 %)', 'Impôt simple (100 %)'), de: 'Einfache Steuer' },
      t(
        `Income ${chf(simpleIncomeAmount)} + wealth ${chf(simpleWealthAmount)}: ${chf(simpleAmount)}.`,
        `Revenu ${chf(simpleIncomeAmount)} + fortune ${chf(simpleWealthAmount)}${NB}: ${chf(simpleAmount)}.`,
      ),
    );

  // The levies on it.
  const levyLine = (
    rate: Cited<number> | number,
    sources: readonly string[],
    label: Text & { de: string },
    shareBp = 10_000,
  ) => {
    const tr = new Trace().from(simple).src(...sources);
    const r = typeof rate === 'number' ? rate : tr.p(rate);
    const amount = levy(simpleAmount, r, shareBp);
    const half = shareBp === 5_000;
    return tr.line(
      amount,
      label,
      t(
        `${chf(simpleAmount)} x ${pc(r, 'en')}${half ? ', half of it' : ''}, to 5 centimes: ${chf(amount)}.`,
        `${chf(simpleAmount)} x ${pc(r, 'fr')}${half ? ', la moitié' : ''}, à 5 centimes près${NB}: ${chf(amount)}.`,
      ),
    );
  };
  const cantonal = levyLine(P.canton, [simpleTaxRule(y).source], {
    ...t(
      `Cantonal tax (Kantonssteuer, ${pc(P.canton.value, 'en')})`,
      `Impôt cantonal (Kantonssteuer, ${pc(P.canton.value, 'fr')})`,
    ),
    de: `Kantonssteuer (${pc(P.canton.value, 'en')})`,
  });
  const communal = levyLine(C.rate, [P.communes.source, communeAtYearEnd(y).source], {
    ...t(
      `Communal tax, ${C.name} (Gemeindesteuer, ${pc(C.rate, 'en')})`,
      `Impôt communal, ${C.name} (Gemeindesteuer, ${pc(C.rate, 'fr')})`,
    ),
    de: `Gemeindesteuer ${C.name} (${pc(C.rate, 'en')})`,
  });

  let church: Line | null = null;
  if (input.church?.length) {
    const parts = input.church.map((p) => {
      const name = CHURCH[p.who];
      if (!name) throw new ZgInputError(`Unknown parish ${p.who}.`);
      const source = p.who === 'reformed' ? P.reformed.source : P.communes.source;
      return {
        p,
        name,
        line: levyLine(p.rate, [source, churchRule(y).source], name, p.shareBp),
      };
    });
    const amount = parts.reduce((x, q) => x + q.line.amount, 0);
    const parishes = parts.map((q) => `${q.name.en} ${pc(q.p.rate, 'en')}`).join(', ');
    const parishesFr = parts.map((q) => `${q.name.fr} ${pc(q.p.rate, 'fr')}`).join(', ');
    const parishesDe = parts.map((q) => `${q.name.de} ${pc(q.p.rate, 'en')}`).join(', ');
    church = new Trace()
      .from(...parts.map((q) => q.line))
      .src(...new Set(parts.flatMap((q) => q.line.sources)))
      .line(
        amount,
        {
          ...t(
            `Church tax (Kirchensteuer, ${parishes})`,
            `Impôt ecclésiastique (Kirchensteuer, ${parishesFr})`,
          ),
          de: `Kirchensteuer (${parishesDe})`,
        },
        t(
          parts.map((q) => q.line.how.en).join(' ') +
            (parts.length > 1 ? ` Together: ${chf(amount)}.` : ''),
          parts.map((q) => q.line.how.fr).join(' ') +
            (parts.length > 1 ? ` Ensemble${NB}: ${chf(amount)}.` : ''),
        ),
      );
  }

  let citizens: Line | null = null;
  if (input.citizens) {
    const B = communeOf(y, input.citizens.who);
    citizens = levyLine(
      input.citizens.rate,
      [P.communes.source, citizensRule(y).source],
      {
        ...t(
          `Bürgergemeinde tax, ${B.name} (Bürgersteuer, ${pc(input.citizens.rate, 'en')})`,
          `Impôt de la bourgeoisie, ${B.name} (Bürgersteuer, ${pc(input.citizens.rate, 'fr')})`,
        ),
        de: `Bürgersteuer ${B.name} (${pc(input.citizens.rate, 'en')})`,
      },
      input.citizens.shareBp,
    );
  }

  const totalAmount =
    cantonal.amount + communal.amount + (church?.amount ?? 0) + (citizens?.amount ?? 0);
  const extras = [
    ...(church ? [t(`church ${chf(church.amount)}`, `ecclésiastique ${chf(church.amount)}`)] : []),
    ...(citizens
      ? [t(`Bürgergemeinde ${chf(citizens.amount)}`, `bourgeoisie ${chf(citizens.amount)}`)]
      : []),
  ];
  const total = new Trace()
    .from(cantonal, communal, church ?? undefined, citizens ?? undefined)
    .src(simpleTaxRule(y).source)
    .line(
      totalAmount,
      church || citizens
        ? {
            ...t(
              'Cantonal, communal and other local taxes',
              'Impôts cantonal, communal et autres impôts locaux',
            ),
            de: `Kantons- und Gemeindesteuern${church ? ', Kirchensteuer' : ''}${citizens ? ', Bürgersteuer' : ''}`,
          }
        : {
            ...t('Cantonal and communal tax', 'Impôt cantonal et communal'),
            de: 'Kantons- und Gemeindesteuern',
          },
      t(
        `Cantonal ${chf(cantonal.amount)} + communal ${chf(communal.amount)}${extras.map((e) => ` + ${e.en}`).join('')}: ${chf(totalAmount)}.`,
        `Cantonal ${chf(cantonal.amount)} + communal ${chf(communal.amount)}${extras.map((e) => ` + ${e.fr}`).join('')}${NB}: ${chf(totalAmount)}.`,
      ),
    );

  return {
    items,
    grossIncome,
    totalDeductions,
    subtotal,
    netIncome,
    taxableIncome,
    tariff: input.tariff,
    wealth: { items: wealthItems, grossWealth, netWealth, taxableWealth },
    taxes: {
      simpleIncome,
      simpleWealth,
      simple,
      cantonal,
      communal,
      church,
      citizens,
      total,
    },
  };
}

/** For the sources test: the cited rules this module applies. */
export const ASSESS_RULES = (y: ZgTaxYear): Cited<unknown>[] => [
  wholeFrancs(),
  simpleTaxRule(y),
  tariffRule(y),
  communeAtYearEnd(y),
  churchRule(y),
  citizensRule(y),
];
