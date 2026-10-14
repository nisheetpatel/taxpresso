// From the lines of the return to the taxes: the second half of the engine, and the part the
// guide's worked example checks on its own (bs-2025-guide-wegleitung p. 11 to 17, from the lines of
// the main form).
//
// Income, in the form's order (bs-2025-form-hauptformular p. 2 and 3): the income lines are the
// total income (499); less the deductions 519 to 680 (699), the net income (709); less the illness
// costs and donations (725, 732), the pure income (739); less the social deductions (750 to 770), the
// taxable income (799). Wealth (p. 4): the assets (869) less the debts, the net wealth (889); less the
// allowances (890 to 892), the taxable wealth (899).
//
// Taxes: the tariff (A or B) gives the tax on the taxable income in whole CHF 100 and on the taxable
// wealth in whole CHF 1,000 (StG § 36, § 50), at 100 % (§ 36a); the wealth tax is reduced for a low
// income (§ 51); in Basel the canton levies all of it, in Riehen and Bettingen the canton its share
// and the commune its multiplier of it (§ 2, § 228). The reduction for wealth with a low yield
// (§ 52) is checked, and the tax is not computed when it could apply.
import { chf, Trace, type Cited } from '@taxpresso/rules-ch';
import { communeByName, type BsCommune } from './communes.js';
import { NOTE } from './explain.js';
import { amountSteps, communalTax, lowYieldRule, tariffRule } from './law.js';
import { bsParamsFor, type BsTaxYear } from './params.js';
import {
  ALLOWANCES,
  ASSETS,
  DEBTS,
  DEDUCTIONS,
  INCOME,
  INCOME_BASED,
  rubric,
  SOCIAL,
  wealthRubric,
} from './rubrics.js';
import { lowIncomeReductionBp, shareOfTax, tariffTax } from './rules.js';
import type { BsIccResult, CommuneRef, Item, ItemAmount, Text } from './types.js';

export class BsInputError extends Error {}

/** A fact the household has not given, or a case the documents leave open: the result says which. */
export class BsUnsupported extends Error {
  constructor(readonly note: Text) {
    super(note.en);
  }
}

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const PAGE3 = 'bs-2025-form-hauptformular p. 3 (form page 3)';
const PAGE4 = 'bs-2025-form-hauptformular p. 4 (form page 4)';

/** Hundredths of a percent as a percentage: 3750 -> "37.5 %", "37,5 %". */
const pc = (hundredths: number, lang: 'en' | 'fr') => {
  const s = String(hundredths / 100);
  return `${lang === 'fr' ? s.replace('.', ',') : s}${NB}%`;
};

export interface BsAssessInput {
  taxYear: BsTaxYear;
  /** The commune of residence on 31 December, by its name or slug. */
  commune: string;
  /** Income tariff: B for spouses and single parents, A for everyone else (StG § 36). */
  incomeTariff: 'A' | 'B';
  /** Wealth tariff: B for spouses only (StG § 50). */
  wealthTariff: 'A' | 'B';
  /** StG § 51: the higher income limit applies (spouses, a child or a support deduction). */
  lowIncomeFamily: boolean;
  /** Documents that say how the family and the tariff were found. */
  familySources?: readonly string[];
  incomeItems: readonly (Item | ItemAmount)[];
  wealthItems: readonly (Item | ItemAmount)[];
}

/** An amount as printed, as an item with its line's label. */
function asItem(item: Item | ItemAmount, wealth: boolean): Item {
  if ('label' in item) return item;
  const r = wealth ? wealthRubric(item.code) : rubric(item.code);
  if (!r) throw new BsInputError(`Unknown ${wealth ? 'wealth ' : ''}line code ${item.code}.`);
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
const of = <T extends { code: string }>(items: readonly T[], codes: Set<string>) =>
  items.filter((i) => codes.has(i.code));

/** The subtotals of the form, from the items so far (the later sections may still be empty). */
export function subtotals(items: readonly { code: string; amount: number }[]) {
  const gross = sum(of(items, INCOME));
  const net = gross + sum(of(items, DEDUCTIONS));
  const pure = net + sum(of(items, INCOME_BASED));
  const taxable = pure + sum(of(items, SOCIAL));
  return { gross, net, pure, taxable };
}

function only(items: readonly Item[], groups: readonly Set<string>[], what: string) {
  const unknown = items.filter((i) => !groups.some((g) => g.has(i.code)));
  if (unknown.length) {
    throw new BsInputError(`Not ${what}: ${unknown.map((i) => i.code).join(', ')}.`);
  }
}

/** The commune of a year, or an input error. */
export function communeOf(taxYear: BsTaxYear, name: string): BsCommune {
  const c = communeByName(taxYear, name);
  if (!c) throw new BsInputError(`Unknown Basel-Stadt commune: ${name}.`);
  return c;
}

/** The commune reference of a result: its name and its income multiplier. */
export function communeRef(taxYear: BsTaxYear, name: string): CommuneRef {
  const c = communeOf(taxYear, name);
  return { bfs: null, name: c.name, rate: c.incomeRate };
}

/**
 * StG § 51, the reduction of the wealth tax for a low income, in basis points, when every reading
 * of the documents gives the same: the law says a taxable income of "nicht mehr als" the limit, the
 * guide "weniger als" (p. 43); neither says whether the band is set by the net or the taxable wealth,
 * nor whether the taxable income counts before or after its rounding to CHF 100.
 */
function lowIncomeBp(
  limits: { single: number; family: number; bands: readonly (readonly [number, number])[] },
  family: boolean,
  taxable: number,
  incomeStep: number,
  netWealth: number,
  taxableWealth: number,
): number {
  const limit = family ? limits.family : limits.single;
  const incomes = [taxable, Math.floor(taxable / incomeStep) * incomeStep];
  const results = new Set<number>();
  for (const income of incomes) {
    for (const strict of [false, true]) {
      const eligible = strict ? income < limit : income <= limit;
      for (const wealth of [netWealth, taxableWealth]) {
        results.add(eligible ? lowIncomeReductionBp(Math.max(0, wealth), limits.bands) : 0);
      }
    }
  }
  if (results.size > 1) throw new BsUnsupported(NOTE.lowIncome);
  return [...results][0]!;
}

export function assess(input: BsAssessInput): BsIccResult {
  const P = bsParamsFor(input.taxYear);
  const A = P.amounts;
  const C = communeOf(input.taxYear, input.commune);
  const items = input.incomeItems.map(asIncomeItem);
  const wealthItems = input.wealthItems.map(asWealthItem);
  only(items, [INCOME, DEDUCTIONS, INCOME_BASED, SOCIAL], 'an income line');
  only(wealthItems, [ASSETS, DEBTS, ALLOWANCES], 'a wealth line');
  const steps = amountSteps(input.taxYear);
  const s = subtotals(items);

  // Income: the totals of the form.
  const incomeLines = of(items, INCOME);
  const deductionLines = of(items, DEDUCTIONS);
  const grossIncome = new Trace()
    .src('bs-2025-form-hauptformular p. 2 (form page 2, 499)')
    .from(...incomeLines)
    .line(
      s.gross,
      t('Total income (Total der Einkünfte, 499)', 'Total des revenus (Total der Einkünfte, 499)'),
      t(
        `The ${incomeLines.length} income lines added up: ${chf(s.gross)}.`,
        `Les ${incomeLines.length} lignes de revenu additionnées${NB}: ${chf(s.gross)}.`,
      ),
    );
  const netIncome = new Trace()
    .src(PAGE3)
    .from(grossIncome, ...deductionLines)
    .line(
      s.net,
      t('Net income (Nettoeinkommen, 709)', 'Revenu net (Nettoeinkommen, 709)'),
      t(
        `Total income less the deductions (699: ${chf(-sum(deductionLines))}): ${chf(s.net)}.`,
        `Total des revenus moins les déductions (699${NB}: ${chf(-sum(deductionLines))})${NB}: ${chf(s.net)}.`,
      ),
    );
  const basedLines = of(items, INCOME_BASED);
  const pureIncome = new Trace()
    .src(PAGE3)
    .from(netIncome, ...basedLines)
    .line(
      s.pure,
      t(
        'Pure income (Reineinkommen, 739)',
        'Revenu net après frais de maladie et dons (Reineinkommen, 739)',
      ),
      t(
        `${chf(s.net)} less illness costs and donations (${chf(-sum(basedLines))}): ${chf(s.pure)}.`,
        `${chf(s.net)} moins les frais de maladie et les dons (${chf(-sum(basedLines))})${NB}: ${chf(s.pure)}.`,
      ),
    );
  const socialLines = of(items, SOCIAL);
  const taxableAmount = Math.max(0, s.taxable);
  const taxableIncome = new Trace()
    .src(PAGE3)
    .from(pureIncome, ...socialLines)
    .line(
      taxableAmount,
      t(
        'Taxable income (Steuerbares Einkommen, 799)',
        'Revenu imposable (Steuerbares Einkommen, 799)',
      ),
      t(
        `${chf(s.pure)} less the social deductions (${chf(-sum(socialLines))}), never below zero: ${chf(taxableAmount)}.`,
        `${chf(s.pure)} moins les déductions sociales (${chf(-sum(socialLines))}), jamais négatif${NB}: ${chf(taxableAmount)}.`,
      ),
    );

  // Wealth.
  const assets = of(wealthItems, ASSETS);
  const debts = of(wealthItems, DEBTS);
  const allowances = of(wealthItems, ALLOWANCES);
  const grossAmount = sum(assets);
  const grossWealth = new Trace()
    .src(PAGE4)
    .from(...assets)
    .line(
      grossAmount,
      t(
        'Total assets (Total der Vermögenswerte, 869)',
        'Total de la fortune (Total der Vermögenswerte, 869)',
      ),
      t(
        `The ${assets.length} asset line${assets.length === 1 ? '' : 's'} added up: ${chf(grossAmount)}.`,
        `Éléments de fortune additionnés (${assets.length})${NB}: ${chf(grossAmount)}.`,
      ),
    );
  const netAmount = grossAmount + sum(debts);
  const netWealth = new Trace()
    .src(PAGE4)
    .from(grossWealth, ...debts)
    .line(
      netAmount,
      t('Net wealth (Reinvermögen, 889)', 'Fortune nette (Reinvermögen, 889)'),
      t(
        `${chf(grossAmount)} less the debts (${chf(-sum(debts))}): ${chf(netAmount)}.`,
        `${chf(grossAmount)} moins les dettes (${chf(-sum(debts))})${NB}: ${chf(netAmount)}.`,
      ),
    );
  const taxableWealthAmount = Math.max(0, netAmount + sum(allowances));
  const taxableWealth = new Trace()
    .src(PAGE4)
    .from(netWealth, ...allowances)
    .line(
      taxableWealthAmount,
      t(
        'Taxable wealth (Steuerbares Vermögen, 899)',
        'Fortune imposable (Steuerbares Vermögen, 899)',
      ),
      t(
        `${chf(netAmount)} less the allowances (${chf(-sum(allowances))}), never below zero: ${chf(taxableWealthAmount)}.`,
        `${chf(netAmount)} moins les montants exonérés (${chf(-sum(allowances))}), jamais négatif${NB}: ${chf(taxableWealthAmount)}.`,
      ),
    );

  // The income tax by the tariff.
  const trIncome = new Trace().from(taxableIncome).src(...(input.familySources ?? []));
  trIncome.p(tariffRule(input.taxYear));
  const incomeStep = trIncome.p(steps).income;
  const incomeScale = trIncome.p(P.income[input.incomeTariff]);
  const incomeRounded = Math.floor(taxableAmount / incomeStep) * incomeStep;
  const incomeTax = tariffTax(incomeScale, taxableAmount, incomeStep);
  const incomeTariffTax = trIncome.line(
    incomeTax,
    t(
      `Income tax by tariff ${input.incomeTariff} (einfache Steuer, 100 %)`,
      `Impôt sur le revenu selon le barème ${input.incomeTariff} (einfache Steuer, 100 %)`,
    ),
    t(
      `Tariff ${input.incomeTariff} (StG § 36, ${input.taxYear}) at ${chf(incomeRounded)}, the taxable income in whole CHF 100: ${chf(incomeTax)}.`,
      `Barème ${input.incomeTariff} (StG § 36, ${input.taxYear}) à ${chf(incomeRounded)}, le revenu imposable par CHF 100 entiers${NB}: ${chf(incomeTax)}.`,
    ),
  );

  // The wealth tax by the tariff, the reduction for a low income, the check of § 52.
  const trWealth = new Trace().from(taxableWealth).src(...(input.familySources ?? []));
  trWealth.p(tariffRule(input.taxYear));
  const wealthStep = trWealth.p(steps).wealth;
  const wealthScale = trWealth.p(P.wealth[input.wealthTariff]);
  const wealthRounded = Math.floor(taxableWealthAmount / wealthStep) * wealthStep;
  const wealthTax = tariffTax(wealthScale, taxableWealthAmount, wealthStep);
  // StG § 52 can only lower a wealth tax above 5 per mille of the taxable wealth.
  const lowYield = trWealth.p(lowYieldRule(input.taxYear));
  if (wealthTax * 10_000 > wealthRounded * lowYield.floorBp) {
    throw new BsUnsupported(NOTE.lowYield);
  }
  const wealthTariffTax = trWealth.line(
    wealthTax,
    t(
      `Wealth tax by tariff ${input.wealthTariff} (Vermögenssteuer, 100 %)`,
      `Impôt sur la fortune selon le barème ${input.wealthTariff} (Vermögenssteuer, 100 %)`,
    ),
    t(
      `Tariff ${input.wealthTariff} (StG § 50) at ${chf(wealthRounded)}, the taxable wealth in whole CHF 1,000: ${chf(wealthTax)}.`,
      `Barème ${input.wealthTariff} (StG § 50) à ${chf(wealthRounded)}, la fortune imposable par CHF 1’000 entiers${NB}: ${chf(wealthTax)}.`,
    ),
  );
  const trRed = new Trace().from(wealthTariffTax, taxableIncome, netWealth);
  const limits = trRed.p(A.lowIncome);
  const redBp =
    wealthTax > 0
      ? lowIncomeBp(
          limits,
          input.lowIncomeFamily,
          taxableAmount,
          incomeStep,
          netAmount,
          taxableWealthAmount,
        )
      : 0;
  const reduction = shareOfTax(wealthTax, redBp);
  const wealthReduction = trRed.line(
    reduction ? -reduction : 0,
    t('Reduction for a low income (StG § 51)', 'Réduction pour revenu modeste (StG § 51)'),
    redBp
      ? t(
          `Taxable income ${chf(taxableAmount)}, at most ${chf(input.lowIncomeFamily ? limits.family : limits.single)}: ${chf(wealthTax)} x ${redBp / 100} %, to 5 centimes: ${chf(reduction)}.`,
          `Revenu imposable ${chf(taxableAmount)}, au plus ${chf(input.lowIncomeFamily ? limits.family : limits.single)}${NB}: ${chf(wealthTax)} x ${redBp / 100}${NB}%, à 5 centimes près${NB}: ${chf(reduction)}.`,
        )
      : t(
          `No reduction: the taxable income ${chf(taxableAmount)} is above ${chf(input.lowIncomeFamily ? limits.family : limits.single)}, or there is no wealth tax.`,
          `Pas de réduction${NB}: le revenu imposable ${chf(taxableAmount)} dépasse ${chf(input.lowIncomeFamily ? limits.family : limits.single)}, ou il n’y a pas d’impôt sur la fortune.`,
        ),
  );
  const wealthNet = wealthTax - reduction;

  // The canton's share and the commune's tax.
  const communeSources = [P.communes.source, communalTax(input.taxYear).source];
  const basel = C.incomeRate === 0 && C.cantonIncomeShare === 10_000;
  const cantonLine = (
    base: number,
    share: number,
    from: ReturnType<Trace['line']>[],
    what: Text,
  ) => {
    const amount = shareOfTax(base, share);
    return new Trace()
      .from(...from)
      .src(...communeSources)
      .line(
        amount,
        t(
          `Cantonal ${what.en} (kantonale Steuer, ${pc(share, 'en')})`,
          `${what.fr} cantonal (kantonale Steuer, ${pc(share, 'fr')})`,
        ),
        basel
          ? t(
              `In Basel the canton levies the whole tax: ${chf(amount)}.`,
              `À Bâle, le canton prélève tout l’impôt${NB}: ${chf(amount)}.`,
            )
          : t(
              `${C.name}: the canton levies ${pc(share, 'en')} of ${chf(base)}, to 5 centimes: ${chf(amount)}.`,
              `${C.name}${NB}: le canton prélève ${pc(share, 'fr')} de ${chf(base)}, à 5 centimes près${NB}: ${chf(amount)}.`,
            ),
      );
  };
  const communeLine = (
    base: number,
    rate: number,
    from: ReturnType<Trace['line']>[],
    what: Text,
  ) => {
    const amount = shareOfTax(base, rate);
    return new Trace()
      .from(...from)
      .src(...communeSources)
      .line(
        amount,
        t(
          `Communal ${what.en}, ${C.name} (Gemeindesteuer, ${pc(rate, 'en')})`,
          `${what.fr} communal, ${C.name} (Gemeindesteuer, ${pc(rate, 'fr')})`,
        ),
        basel
          ? t(
              'The city of Basel levies no communal tax.',
              'La ville de Bâle ne prélève pas d’impôt communal.',
            )
          : t(
              `${C.name}’s multiplier ${pc(rate, 'en')} of ${chf(base)}, to 5 centimes: ${chf(amount)}.`,
              `Coefficient de ${C.name} ${pc(rate, 'fr')} de ${chf(base)}, à 5 centimes près${NB}: ${chf(amount)}.`,
            ),
      );
  };
  const incomeWord = t('income tax', 'Impôt sur le revenu');
  const wealthWord = t('wealth tax', 'Impôt sur la fortune');
  const cantonalIncome = cantonLine(incomeTax, C.cantonIncomeShare, [incomeTariffTax], incomeWord);
  const communalIncome = communeLine(incomeTax, C.incomeRate, [incomeTariffTax], incomeWord);
  const cantonalWealth = cantonLine(
    wealthNet,
    C.cantonWealthShare,
    [wealthTariffTax, wealthReduction],
    wealthWord,
  );
  const communalWealth = communeLine(
    wealthNet,
    C.wealthRate,
    [wealthTariffTax, wealthReduction],
    wealthWord,
  );

  const totalAmount =
    cantonalIncome.amount + communalIncome.amount + cantonalWealth.amount + communalWealth.amount;
  const total = new Trace()
    .from(cantonalIncome, communalIncome, cantonalWealth, communalWealth)
    .src(communalTax(input.taxYear).source)
    .line(
      totalAmount,
      t(
        'Cantonal and communal tax (Kantons- und Gemeindesteuern)',
        'Impôt cantonal et communal (Kantons- und Gemeindesteuern)',
      ),
      t(
        `Income: cantonal ${chf(cantonalIncome.amount)} + communal ${chf(communalIncome.amount)}; wealth: cantonal ${chf(cantonalWealth.amount)} + communal ${chf(communalWealth.amount)}; total ${chf(totalAmount)}.`,
        `Revenu${NB}: cantonal ${chf(cantonalIncome.amount)} + communal ${chf(communalIncome.amount)}${NB}; fortune${NB}: cantonal ${chf(cantonalWealth.amount)} + communal ${chf(communalWealth.amount)}${NB}; total ${chf(totalAmount)}.`,
      ),
    );

  return {
    items,
    grossIncome,
    netIncome,
    pureIncome,
    taxableIncome,
    incomeTariff: input.incomeTariff,
    wealth: {
      items: wealthItems,
      grossWealth,
      netWealth,
      taxableWealth,
      tariff: input.wealthTariff,
    },
    taxes: {
      incomeTariffTax,
      cantonalIncome,
      communalIncome,
      wealthTariffTax,
      wealthReduction,
      cantonalWealth,
      communalWealth,
      total,
    },
  };
}

/** For the sources test: the cited rules this module applies. */
export const ASSESS_RULES = (y: BsTaxYear): Cited<unknown>[] => [
  amountSteps(y),
  tariffRule(y),
  communalTax(y),
  lowYieldRule(y),
];
