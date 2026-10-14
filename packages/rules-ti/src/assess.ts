// From the lines of the return to the taxes: the second half of the engine.
//
// Income, in the order of Modulo 1 (ti-2025-form-modulo-1-de p. 2 and 3): the total income (8);
// less the deductions 9 to 15.5 (16), the net income I (19); less childcare (20), the net income II
// (21); less illness costs (22.1), the net income III (23); less donations (24) and the social
// deductions (25), the net income (26); less the exemption for AVS and AI pensioners (27), the
// taxable income (28). Wealth (p. 4): the assets (32) less the debts (33), the net wealth (34); less
// the social deductions (35), the taxable wealth (36).
//
// Taxes: the tariffs give the cantonal base tax (imposta cantonale base) on the taxable income and
// on the taxable wealth (LT art. 35, 49); the cantonal tax is the base tax times the cantonal
// coefficient (art. 1a), the communal tax the base tax times the commune's multiplier (art. 276);
// each adult also owes the communal personal tax (art. 290). The brake on the wealth tax (art. 49a)
// is granted on request: the tax is not computed when it could apply.
import { chf, Trace, type Cited } from '@taxpresso/rules-ch';
import { communeByName, type TiCommune } from './communes.js';
import { NOTE } from './explain.js';
import { cantonalTax, communalTax, tariffRule, wealthBrakeRule } from './law.js';
import { tiParamsFor, type TiTaxYear } from './params.js';
import {
  ASSETS,
  CHILDCARE,
  DEBTS,
  DEDUCTIONS,
  EXEMPTION,
  INCOME,
  MEDICAL,
  rubric,
  SOCIAL,
  WEALTH_SOCIAL,
  wealthRubric,
} from './rubrics.js';
import { shareOfTax } from './rules.js';
import { categoryOf, categoryTax, tariffBase } from './tariff.js';
import type { CommuneRef, Item, ItemAmount, Line, Text, TiIccResult } from './types.js';

export class TiInputError extends Error {}

/** A fact the household has not given, or a case the documents leave open: the result says which. */
export class TiUnsupported extends Error {
  constructor(readonly note: Text) {
    super(note.en);
  }
}

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const FORM = 'ti-2025-form-modulo-1-de';
const PAGE2 = `${FORM} p. 2 (form page 2)`;
const PAGE3 = `${FORM} p. 3 (form page 3)`;
const PAGE4 = `${FORM} p. 4 (form page 4)`;

/** Hundredths of a percent as a percentage: 7750 -> "77.5 %", "77,5 %". */
const pc = (hundredths: number, lang: 'en' | 'fr') => {
  const s = String(hundredths / 100);
  return `${lang === 'fr' ? s.replace('.', ',') : s}${NB}%`;
};

export interface TiAssessInput {
  taxYear: TiTaxYear;
  /** The commune of residence on 31 December, by its name or slug. */
  commune: string;
  /** The income tariff: LT art. 35 cpv. 2 (family) or cpv. 1 (single). */
  incomeTariff: 'single' | 'family';
  /** The adults who owe the personal tax: 1, or 2 for spouses (LT art. 290 cpv. 3). */
  adults: 1 | 2;
  /** Documents that say how the family and the tariff were found. */
  familySources?: readonly string[];
  incomeItems: readonly (Item | ItemAmount)[];
  wealthItems: readonly (Item | ItemAmount)[];
}

/** An amount as printed, as an item with its line's label. */
function asItem(item: Item | ItemAmount, wealth: boolean): Item {
  if ('label' in item) return item;
  const r = wealth ? wealthRubric(item.code) : rubric(item.code);
  if (!r) throw new TiInputError(`Unknown ${wealth ? 'wealth ' : ''}line ${item.code}.`);
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

/** The subtotals of Modulo 1, from the items so far (the later sections may still be empty). */
export function subtotals(items: readonly { code: string; amount: number }[]) {
  const gross = sum(of(items, INCOME));
  const deductions = sum(of(items, DEDUCTIONS));
  const net1 = gross + deductions;
  const net2 = net1 + sum(of(items, CHILDCARE));
  const net3 = net2 + sum(of(items, MEDICAL));
  const net4 = net3 + sum(of(items, SOCIAL));
  const taxable = net4 + sum(of(items, EXEMPTION));
  return { gross, deductions, net1, net2, net3, net4, taxable };
}

function only(items: readonly Item[], groups: readonly Set<string>[], what: string) {
  const unknown = items.filter((i) => !groups.some((g) => g.has(i.code)));
  if (unknown.length) {
    throw new TiInputError(`Not ${what}: ${unknown.map((i) => i.code).join(', ')}.`);
  }
}

/** The commune of a year, or an input error. */
export function communeOf(taxYear: TiTaxYear, name: string): TiCommune {
  const c = communeByName(taxYear, name);
  if (!c) {
    throw new TiInputError(
      `Unknown Ticino commune for ${taxYear}: ${name}. The canton's table of multipliers gives none for it that year.`,
    );
  }
  return c;
}

/** The commune reference of a result: its name and its multiplier. */
export function communeRef(taxYear: TiTaxYear, name: string): CommuneRef {
  const c = communeOf(taxYear, name);
  return { bfs: null, name: c.name, rate: c.rate };
}

export function assess(input: TiAssessInput): TiIccResult {
  const P = tiParamsFor(input.taxYear);
  const A = P.amounts;
  const y = input.taxYear;
  const C = communeOf(y, input.commune);
  const items = input.incomeItems.map(asIncomeItem);
  const wealthItems = input.wealthItems.map(asWealthItem);
  only(items, [INCOME, DEDUCTIONS, CHILDCARE, MEDICAL, SOCIAL, EXEMPTION], 'an income line');
  only(wealthItems, [ASSETS, DEBTS, WEALTH_SOCIAL], 'a wealth line');
  const s = subtotals(items);

  // Income: the subtotals of the form.
  const sub = (
    lines: readonly Line[],
    amount: number,
    source: string,
    label: Text,
    how: Text,
  ): Line =>
    new Trace()
      .src(source)
      .from(...lines)
      .line(amount, label, how);
  const incomeLines = of(items, INCOME);
  const grossIncome = sub(
    incomeLines,
    s.gross,
    PAGE2,
    t('Total income (totale dei redditi, 8)', 'Total des revenus (totale dei redditi, 8)'),
    t(
      `The ${incomeLines.length} income line${incomeLines.length === 1 ? '' : 's'} added up: ${chf(s.gross)}.`,
      `Lignes de revenu additionnées (${incomeLines.length})${NB}: ${chf(s.gross)}.`,
    ),
  );
  const deductionLines = of(items, DEDUCTIONS);
  const totalDeductions = sub(
    deductionLines,
    s.deductions,
    PAGE3,
    t(
      'Total deductions (totale delle deduzioni, 16)',
      'Total des déductions (totale delle deduzioni, 16)',
    ),
    t(
      `The deductions 9 to 15.5 added up: ${chf(s.deductions)}.`,
      `Déductions 9 à 15.5 additionnées${NB}: ${chf(s.deductions)}.`,
    ),
  );
  const netIncome = sub(
    [grossIncome, totalDeductions],
    s.net1,
    PAGE3,
    t('Net income I (reddito netto I, 19)', 'Revenu net I (reddito netto I, 19)'),
    t(
      `${chf(s.gross)} less ${chf(-s.deductions)}: ${chf(s.net1)}.`,
      `${chf(s.gross)} moins ${chf(-s.deductions)}${NB}: ${chf(s.net1)}.`,
    ),
  );
  const care = of(items, CHILDCARE);
  const netIncome2 = sub(
    [netIncome, ...care],
    s.net2,
    PAGE3,
    t(
      'Net income II (reddito netto intermedio II, 21)',
      'Revenu net II (reddito netto intermedio II, 21)',
    ),
    t(
      `${chf(s.net1)} less childcare (20) ${chf(-sum(care))}: ${chf(s.net2)}.`,
      `${chf(s.net1)} moins les frais de garde (20) ${chf(-sum(care))}${NB}: ${chf(s.net2)}.`,
    ),
  );
  const medical = of(items, MEDICAL);
  const netIncome3 = sub(
    [netIncome2, ...medical],
    s.net3,
    PAGE3,
    t(
      'Net income III (reddito netto intermedio III, 23)',
      'Revenu net III (reddito netto intermedio III, 23)',
    ),
    t(
      `${chf(s.net2)} less illness costs (22.1) ${chf(-sum(medical))}: ${chf(s.net3)}.`,
      `${chf(s.net2)} moins les frais de maladie (22.1) ${chf(-sum(medical))}${NB}: ${chf(s.net3)}.`,
    ),
  );
  const social = of(items, SOCIAL);
  const netIncome4 = sub(
    [netIncome3, ...social],
    s.net4,
    PAGE3,
    t('Net income IV (reddito netto, 26)', 'Revenu net IV (reddito netto, 26)'),
    t(
      `${chf(s.net3)} less donations (24) and the social deductions (25) ${chf(-sum(social))}: ${chf(s.net4)}.`,
      `${chf(s.net3)} moins les dons (24) et les déductions sociales (25) ${chf(-sum(social))}${NB}: ${chf(s.net4)}.`,
    ),
  );
  const exemption = of(items, EXEMPTION);
  const taxableAmount = Math.max(0, s.taxable);
  const taxableIncome = sub(
    [netIncome4, ...exemption],
    taxableAmount,
    PAGE3,
    t('Taxable income (reddito imponibile, 28)', 'Revenu imposable (reddito imponibile, 28)'),
    t(
      `${chf(s.net4)} less the exemption for AVS and AI pensioners (27) ${chf(-sum(exemption))}, never below zero: ${chf(taxableAmount)}.`,
      `${chf(s.net4)} moins le montant exonéré des bénéficiaires AVS et AI (27) ${chf(-sum(exemption))}, jamais négatif${NB}: ${chf(taxableAmount)}.`,
    ),
  );

  // Wealth.
  const assets = of(wealthItems, ASSETS);
  const debts = of(wealthItems, DEBTS);
  const wealthSocial = of(wealthItems, WEALTH_SOCIAL);
  const grossAmount = sum(assets);
  const grossWealth = sub(
    assets,
    grossAmount,
    PAGE4,
    t(
      'Total assets (totale della sostanza, 32)',
      'Total de la fortune (totale della sostanza, 32)',
    ),
    t(
      `The ${assets.length} asset line${assets.length === 1 ? '' : 's'} added up: ${chf(grossAmount)}.`,
      `Éléments de fortune additionnés (${assets.length})${NB}: ${chf(grossAmount)}.`,
    ),
  );
  const netAmount = grossAmount + sum(debts);
  const netWealth = sub(
    [grossWealth, ...debts],
    netAmount,
    PAGE4,
    t('Net wealth (sostanza netta, 34)', 'Fortune nette (sostanza netta, 34)'),
    t(
      `${chf(grossAmount)} less the debts ${chf(-sum(debts))}: ${chf(netAmount)}.`,
      `${chf(grossAmount)} moins les dettes ${chf(-sum(debts))}${NB}: ${chf(netAmount)}.`,
    ),
  );
  const taxableWealthAmount = Math.max(0, netAmount + sum(wealthSocial));
  const taxableWealth = sub(
    [netWealth, ...wealthSocial],
    taxableWealthAmount,
    PAGE4,
    t('Taxable wealth (sostanza imponibile, 36)', 'Fortune imposable (sostanza imponibile, 36)'),
    t(
      `${chf(netAmount)} less the social deductions (35) ${chf(-sum(wealthSocial))}, never below zero: ${chf(taxableWealthAmount)}.`,
      `${chf(netAmount)} moins les déductions sociales (35) ${chf(-sum(wealthSocial))}, jamais négatif${NB}: ${chf(taxableWealthAmount)}.`,
    ),
  );

  // The cantonal base tax on income, by the tariff.
  const family = input.incomeTariff === 'family';
  const trIncome = new Trace().from(taxableIncome).src(...(input.familySources ?? []));
  trIncome.p(tariffRule(y));
  const incomeScale = trIncome.p(family ? P.income.family : P.income.single);
  const incomeRead = tariffBase(incomeScale, taxableAmount);
  const incomeBaseTax = categoryTax(incomeScale, taxableAmount);
  const which = family
    ? t('the family tariff (LT art. 35 cpv. 2)', 'le barème familial (LT art. 35 cpv. 2)')
    : t(
        'the tariff for single people (LT art. 35 cpv. 1)',
        'le barème des personnes seules (LT art. 35 cpv. 1)',
      );
  const exempt = incomeScale.exemptBelow;
  const incomeBase = trIncome.line(
    incomeBaseTax,
    t(
      'Cantonal base tax on income (imposta cantonale base sul reddito)',
      'Impôt cantonal de base sur le revenu (imposta cantonale base sul reddito)',
    ),
    incomeRead === 0
      ? t(
          `Taxable income under ${chf(exempt)}: no tax by ${which.en}.`,
          `Revenu imposable inférieur à ${chf(exempt)}${NB}: pas d’impôt selon ${which.fr}.`,
        )
      : t(
          `${which.en[0]!.toUpperCase()}${which.en.slice(1)}, ${y}, at ${chf(incomeRead)} (the taxable income in whole CHF 100), band ${categoryOf(incomeScale, incomeRead)}: ${chf(incomeBaseTax)}.`,
          `${which.fr[0]!.toUpperCase()}${which.fr.slice(1)}, ${y}, à ${chf(incomeRead)} (le revenu imposable par CHF 100 entiers), tranche ${categoryOf(incomeScale, incomeRead)}${NB}: ${chf(incomeBaseTax)}.`,
        ),
  );

  // The cantonal base tax on wealth.
  const trWealth = new Trace().from(taxableWealth);
  const wealthScale = trWealth.p(P.wealth);
  const wealthRead = tariffBase(wealthScale, taxableWealthAmount);
  const wealthBaseTax = categoryTax(wealthScale, taxableWealthAmount);
  const wealthBase = trWealth.line(
    wealthBaseTax,
    t(
      'Cantonal base tax on wealth (imposta cantonale base sulla sostanza)',
      'Impôt cantonal de base sur la fortune (imposta cantonale base sulla sostanza)',
    ),
    wealthRead === 0
      ? t(
          `Taxable wealth under ${chf(wealthScale.exemptBelow)}: no tax (LT art. 49 cpv. 2).`,
          `Fortune imposable inférieure à ${chf(wealthScale.exemptBelow)}${NB}: pas d’impôt (LT art. 49 cpv. 2).`,
        )
      : t(
          `The wealth tariff (LT art. 49) at ${chf(wealthRead)} (the taxable wealth in whole CHF 1,000), band ${categoryOf(wealthScale, wealthRead)}: ${chf(wealthBaseTax)}.`,
          `Le barème de la fortune (LT art. 49) à ${chf(wealthRead)} (la fortune imposable par CHF 1’000 entiers), tranche ${categoryOf(wealthScale, wealthRead)}${NB}: ${chf(wealthBaseTax)}.`,
        ),
  );

  // The cantonal tax: the base tax times the coefficient.
  const cantonal = (base: Line, what: Text) => {
    const tr = new Trace().from(base).src(cantonalTax(y).source);
    const coefficient = tr.p(A.coefficient);
    const amount = shareOfTax(base.amount, coefficient);
    return tr.line(
      amount,
      t(
        `Cantonal ${what.en} (imposta cantonale, coefficient ${pc(coefficient, 'en')})`,
        `${what.fr} cantonal (imposta cantonale, coefficient ${pc(coefficient, 'fr')})`,
      ),
      t(
        `The base tax ${chf(base.amount)} x the cantonal coefficient ${pc(coefficient, 'en')}: ${chf(amount)}.`,
        `L’impôt de base ${chf(base.amount)} x le coefficient cantonal ${pc(coefficient, 'fr')}${NB}: ${chf(amount)}.`,
      ),
    );
  };
  // The communal tax: the base tax times the commune's multiplier.
  const communal = (base: Line, what: Text) => {
    const amount = shareOfTax(base.amount, C.rate);
    return new Trace()
      .from(base)
      .src(P.communes.source, communalTax(y).source)
      .line(
        amount,
        t(
          `Communal ${what.en}, ${C.name} (imposta comunale, multiplier ${pc(C.rate, 'en')})`,
          `${what.fr} communal, ${C.name} (imposta comunale, coefficient ${pc(C.rate, 'fr')})`,
        ),
        t(
          `The base tax ${chf(base.amount)} x ${C.name}’s multiplier (moltiplicatore) ${pc(C.rate, 'en')}, to 5 centimes: ${chf(amount)}.`,
          `L’impôt de base ${chf(base.amount)} x le coefficient de ${C.name} (moltiplicatore) ${pc(C.rate, 'fr')}, à 5 centimes près${NB}: ${chf(amount)}.`,
        ),
      );
  };
  const incomeWord = t('income tax', 'Impôt sur le revenu');
  const wealthWord = t('wealth tax', 'Impôt sur la fortune');
  const cantonalIncome = cantonal(incomeBase, incomeWord);
  const cantonalWealth = cantonal(wealthBase, wealthWord);
  const communalIncome = communal(incomeBase, incomeWord);
  const communalWealth = communal(wealthBase, wealthWord);

  // The brake on the wealth tax could apply when these taxes exceed 60 % of the taxable income.
  const incomeAndWealth =
    cantonalIncome.amount + cantonalWealth.amount + communalIncome.amount + communalWealth.amount;
  const brake = wealthBrakeRule(y).value;
  if (wealthBaseTax > 0 && incomeAndWealth * 10_000 > taxableAmount * brake.shareBp) {
    throw new TiUnsupported(NOTE.wealthBrake);
  }

  // The personal tax, per adult.
  const trPersonal = new Trace();
  const perAdult = trPersonal.p(A.personalTax);
  const personalAmount = perAdult * input.adults;
  const personal = trPersonal.line(
    personalAmount,
    t('Personal tax (imposta personale)', 'Impôt personnel (imposta personale)'),
    t(
      `${chf(perAdult)} for each adult taxpayer (${input.adults}): ${chf(personalAmount)}.`,
      `${chf(perAdult)} par contribuable majeur (${input.adults})${NB}: ${chf(personalAmount)}.`,
    ),
  );

  const totalAmount = incomeAndWealth + personalAmount;
  const total = new Trace()
    .from(cantonalIncome, cantonalWealth, communalIncome, communalWealth, personal)
    .line(
      totalAmount,
      t(
        'Cantonal and communal tax (imposta cantonale e comunale)',
        'Impôt cantonal et communal (imposta cantonale e comunale)',
      ),
      t(
        `Cantonal ${chf(cantonalIncome.amount + cantonalWealth.amount)} + communal ${chf(communalIncome.amount + communalWealth.amount)} + personal tax ${chf(personalAmount)}: ${chf(totalAmount)}.`,
        `Cantonal ${chf(cantonalIncome.amount + cantonalWealth.amount)} + communal ${chf(communalIncome.amount + communalWealth.amount)} + impôt personnel ${chf(personalAmount)}${NB}: ${chf(totalAmount)}.`,
      ),
    );

  return {
    items,
    grossIncome,
    totalDeductions,
    netIncome,
    netIncome2,
    netIncome3,
    netIncome4,
    taxableIncome,
    incomeTariff: input.incomeTariff,
    wealth: { items: wealthItems, grossWealth, netWealth, taxableWealth },
    taxes: {
      incomeBase,
      wealthBase,
      cantonalIncome,
      cantonalWealth,
      communalIncome,
      communalWealth,
      personal,
      total,
    },
  };
}

/** For the sources test: the cited rules this module applies. */
export const ASSESS_RULES = (y: TiTaxYear): Cited<unknown>[] => [
  tariffRule(y),
  cantonalTax(y),
  communalTax(y),
  wealthBrakeRule(y),
];
