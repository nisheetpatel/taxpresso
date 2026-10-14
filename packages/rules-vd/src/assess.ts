// From the lines of the return to the taxes: the second half of the engine, and the part the guide's
// worked examples check on their own (vd-2025-guide p. 61, from the taxable income and the parts).
//
// Income, in the form's order (vd-2025-form-21010, form page 3): the income lines less the costs
// and general deductions are the net income (650); less the housing deduction, 690; less the modest
// taxpayer deduction, the intermediate income (700), the base of the medical costs and donations;
// less those and the family deduction, 730; in whole CHF 100, the taxable income (800). Wealth: the
// assets less the debts, in whole CHF 1,000, the taxable wealth (800).
//
// Taxes (LI art. 2, 43, 47, 59; LRIPP art. 4; LICom art. 6): the scale gives the cantonal base tax
// (100 %) on the taxable income at the rate of the rate-determining income (820, the taxable income
// divided by the parts, 810), and on the taxable wealth; the canton levies its coefficient on the
// base tax, the income part first reduced by the LRIPP percentage; the commune levies its rate on
// the unreduced base tax. Each step is rounded to 5 centimes, as the guide's examples are. The
// maxima of LICom art. 8 are checked, and the tax is not computed when they could apply.
import { chf, round5, roundTo, Trace, type Cited } from '@taxpresso/rules-ch';
import type { Floor } from './amounts.js';
import { communeByName, communeRate, type VdCommune } from './communes.js';
import { NOTE } from './explain.js';
import { amountSteps, communalTax, fractions, maxima, rateRule } from './law.js';
import { vdParamsFor, type VdTaxYear, type VdYearParams } from './params.js';
import {
  ASSETS,
  DEBTS,
  DEDUCTIONS,
  INCOME,
  rubric,
  SOCIAL,
  SPECIAL,
  wealthRubric,
} from './rubrics.js';
import { atRate, ratePpm, rateDeterminingIncome } from './rules.js';
import { scaleTax } from './tariff.js';
import type { CommuneRef, Item, ItemAmount, Text, VdIccResult } from './types.js';

export class VdInputError extends Error {}

/** A fact the household has not given, or a case the documents leave open: the result says which. */
export class VdUnsupported extends Error {
  constructor(readonly note: Text) {
    super(note.en);
  }
}

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const SUMMARY = 'vd-2025-form-21010 p. 2 (form page 3)';

/** Basis points or hundredths of a percent as a percentage: 7850 -> "78.5 %", "78,5 %". */
const pc = (hundredths: number, lang: 'en' | 'fr') => {
  const s = String(hundredths / 100);
  return `${lang === 'fr' ? s.replace('.', ',') : s}${NB}%`;
};
/** A rate in millionths of a percent: 4360465 -> "4.360465 %". */
const ppmText = (ppm: number, lang: 'en' | 'fr') => {
  const s = (ppm / 1_000_000).toFixed(6);
  return `${lang === 'fr' ? s.replace('.', ',') : s}${NB}%`;
};
/** Parts in hundredths: 280 -> "2.8", "2,8". */
export const partsText = (parts: number, lang: 'en' | 'fr' = 'en') => {
  const s = String(parts / 100);
  return lang === 'fr' ? s.replace('.', ',') : s;
};

/** The family for the quotient familial (810) and its cap (820). */
export interface VdFamily {
  /** The parts without children: 1, 1.3 (single parent) or 1.8 (spouses). */
  base: 'single' | 'singleParent' | 'married';
  /** Children with a part of 0.5. */
  fullChildren: number;
  /** Children whose part of 0.5 is shared with the other parent (0.25 here). */
  sharedChildren: number;
}

export interface VdAssessInput {
  taxYear: VdTaxYear;
  /** The commune of residence on 31 December, by its name or slug. */
  commune: string;
  communePart?: string;
  family: VdFamily;
  /** Documents that say how the parts were found (shared custody, single parent). */
  partsSources?: readonly string[];
  incomeItems: readonly (Item | ItemAmount)[];
  wealthItems: readonly (Item | ItemAmount)[];
}

/** An amount as printed, as an item with its line's label. */
function asItem(item: Item | ItemAmount, wealth: boolean): Item {
  if ('label' in item) return item;
  const r = wealth ? wealthRubric(item.code) : rubric(item.code);
  if (!r) throw new VdInputError(`Unknown ${wealth ? 'wealth ' : ''}line code ${item.code}.`);
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
  const housing = sum(items.filter((i) => i.code === '660'));
  const c690 = net + housing;
  const intermediate = c690 + sum(items.filter((i) => i.code === '695'));
  const c730 = intermediate + sum(pick(SPECIAL));
  return { gross, net, c690, intermediate, c730 };
}

function only(items: readonly Item[], groups: readonly Set<string>[], what: string) {
  const unknown = items.filter((i) => !groups.some((g) => g.has(i.code)));
  if (unknown.length) {
    throw new VdInputError(`Not ${what}: ${unknown.map((i) => i.code).join(', ')}.`);
  }
}

/** The commune of a year, or an input error. */
export function communeOf(taxYear: VdTaxYear, name: string): VdCommune {
  const c = communeByName(taxYear, name);
  if (!c) throw new VdInputError(`Unknown Vaud commune: ${name}.`);
  return c;
}

/** The parts of the quotient familial, in hundredths. */
export function partsOf(family: VdFamily): number {
  const base = { single: 100, singleParent: 130, married: 180 }[family.base];
  return base + 50 * family.fullChildren + 25 * family.sharedChildren;
}

/**
 * The cap of the rate-determining income (LI art. 43 al. 3), as the guide's tables give it for
 * the family: none at or below the first threshold (every threshold is at least the first, and a
 * year's at least the previous year's, art. 60 al. 2); above it, the table's row, or unsupported
 * where no table applies.
 */
function quotientCapFor(
  table: Floor<VdYearParams['amounts']['quotientCap']['value']>,
  family: VdFamily,
  taxable: number,
): { cap?: { baseParts: number; threshold: number; max: number } } {
  if (family.fullChildren + family.sharedChildren === 0) return {};
  const rows = table.value[family.base];
  const first = rows[0]![0];
  if (taxable <= first) return {};
  if (table.floorOnly || family.sharedChildren > 0) throw new VdUnsupported(NOTE.quotientCap);
  const row = rows[family.fullChildren - 1];
  if (!row) {
    if (taxable <= rows.at(-1)![0]) return {};
    throw new VdUnsupported(NOTE.quotientCap);
  }
  if (taxable <= row[0]) return {};
  const baseParts = { single: 100, singleParent: 130, married: 180 }[family.base];
  return { cap: { baseParts, threshold: row[0], max: row[1] } };
}

export function assess(input: VdAssessInput): VdIccResult {
  const P = vdParamsFor(input.taxYear);
  const A = P.amounts;
  const C = communeOf(input.taxYear, input.commune);
  const part = communeRate(C, input.communePart);
  if (part === 'part') throw new VdUnsupported(NOTE.communePart);
  const items = input.incomeItems.map(asIncomeItem);
  const wealthItems = input.wealthItems.map(asWealthItem);
  only(items, [INCOME, DEDUCTIONS, SOCIAL, SPECIAL], 'an income line');
  only(wealthItems, [ASSETS, DEBTS], 'a wealth line');
  const steps = amountSteps(input.taxYear);
  const s = subtotals(items);

  // Income: the totals of the form.
  const incomeLines = of(items, INCOME);
  const deductionLines = of(items, DEDUCTIONS);
  const grossIncome = new Trace()
    .src(SUMMARY)
    .from(...incomeLines)
    .line(
      s.gross,
      t('Total income', 'Total des revenus'),
      t(
        `The ${incomeLines.length} income lines added up: ${chf(s.gross)}.`,
        `Les ${incomeLines.length} lignes de revenu additionnées${NB}: ${chf(s.gross)}.`,
      ),
    );
  const netIncome = new Trace()
    .src(SUMMARY)
    .from(grossIncome, ...deductionLines)
    .line(
      s.net,
      t('Net income (revenu net, 650)', 'Revenu net (650)'),
      t(
        `Total income less the costs and general deductions (${chf(-sum(deductionLines))}): ${chf(s.net)}.`,
        `Total des revenus moins les frais et déductions générales (${chf(-sum(deductionLines))})${NB}: ${chf(s.net)}.`,
      ),
    );
  const housingLines = items.filter((i) => i.code === '660');
  const incomeBeforeModest = new Trace()
    .src(SUMMARY)
    .from(netIncome, ...housingLines)
    .line(
      s.c690,
      t('Net income less the housing deduction (690)', 'Code 650 moins le code 660 (690)'),
      t(
        `${chf(s.net)} less the housing deduction ${chf(-sum(housingLines))}: ${chf(s.c690)}.`,
        `${chf(s.net)} moins la déduction pour le logement ${chf(-sum(housingLines))}${NB}: ${chf(s.c690)}.`,
      ),
    );
  const modestLines = items.filter((i) => i.code === '695');
  const intermediateIncome = new Trace()
    .src(SUMMARY)
    .from(incomeBeforeModest, ...modestLines)
    .line(
      s.intermediate,
      t('Intermediate income (revenu intermédiaire, 700)', 'Revenu intermédiaire (700)'),
      t(
        `${chf(s.c690)} less the modest taxpayer deduction ${chf(-sum(modestLines))}: ${chf(s.intermediate)}.`,
        `${chf(s.c690)} moins la déduction pour contribuable modeste ${chf(-sum(modestLines))}${NB}: ${chf(s.intermediate)}.`,
      ),
    );
  const specialLines = of(items, SPECIAL);
  const trTaxable = new Trace().src(SUMMARY).from(intermediateIncome, ...specialLines);
  const unitIncome = trTaxable.p(steps).income;
  const taxable = Math.floor(Math.max(0, s.c730) / unitIncome) * unitIncome;
  const taxableIncome = trTaxable.line(
    taxable,
    t('Taxable income (revenu imposable, 800)', 'Revenu imposable (800)'),
    t(
      `${chf(s.intermediate)} less the medical costs, donations and family deduction (${chf(-sum(specialLines))}) is ${chf(s.c730)} (730); in whole CHF 100, never below zero: ${chf(taxable)}.`,
      `${chf(s.intermediate)} moins les frais médicaux, les dons et la déduction pour famille (${chf(-sum(specialLines))}) font ${chf(s.c730)} (730)${NB}; par CHF 100 entiers, jamais négatif${NB}: ${chf(taxable)}.`,
    ),
  );

  // 810 and 820: the parts and the rate-determining income.
  const parts = partsOf(input.family);
  const trRate = new Trace().from(taxableIncome).src(...(input.partsSources ?? []));
  trRate.p(rateRule(input.taxYear));
  let rateIncomeAmount = taxable;
  let rateHow: Text;
  if (parts === 100) {
    rateHow = t(
      `One part (1): the taxable income itself, ${chf(taxable)}.`,
      `Une part (1)${NB}: le revenu imposable lui-même, ${chf(taxable)}.`,
    );
  } else {
    const { cap } = quotientCapFor(A.quotientCap, input.family, taxable);
    trRate.src(A.quotientCap.source);
    rateIncomeAmount = rateDeterminingIncome(taxable, parts, cap);
    rateHow = cap
      ? t(
          `${chf(taxable)} is above ${chf(cap.threshold)}: divided by the parts without children (${partsText(cap.baseParts)}), less at most ${chf(cap.max)} for the children (the cap of the quotient familial); in whole CHF 100: ${chf(rateIncomeAmount)}.`,
          `${chf(taxable)} dépasse ${chf(cap.threshold)}${NB}: divisé par les parts sans les enfants (${partsText(cap.baseParts, 'fr')}), moins au plus ${chf(cap.max)} pour les enfants (plafonnement du quotient familial)${NB}; par CHF 100 entiers${NB}: ${chf(rateIncomeAmount)}.`,
        )
      : t(
          `${chf(taxable)} divided by ${partsText(parts)} parts, in whole CHF 100: ${chf(rateIncomeAmount)}.`,
          `${chf(taxable)} divisé par ${partsText(parts, 'fr')} parts, par CHF 100 entiers${NB}: ${chf(rateIncomeAmount)}.`,
        );
  }
  const rateIncome = trRate.line(
    rateIncomeAmount,
    t(
      'Rate-determining income (revenu déterminant pour le taux, 820)',
      'Revenu déterminant pour le taux (820)',
    ),
    rateHow,
  );

  // Wealth.
  const assets = of(wealthItems, ASSETS);
  const debts = of(wealthItems, DEBTS);
  const grossAmount = sum(assets);
  const grossWealth = new Trace()
    .src(SUMMARY)
    .from(...assets)
    .line(
      grossAmount,
      t('Total wealth', 'Total de la fortune'),
      t(
        `The ${assets.length} asset${assets.length === 1 ? '' : 's'} added up: ${chf(grossAmount)}.`,
        `Éléments de fortune additionnés (${assets.length})${NB}: ${chf(grossAmount)}.`,
      ),
    );
  const trWealth = new Trace().src(SUMMARY).from(grossWealth, ...debts);
  const unitWealth = trWealth.p(steps).wealth;
  const netWealth = grossAmount + sum(debts);
  const taxableWealthAmount = Math.floor(Math.max(0, netWealth) / unitWealth) * unitWealth;
  const taxableWealth = trWealth.line(
    taxableWealthAmount,
    t('Taxable wealth (fortune imposable, 800)', 'Fortune imposable (800)'),
    t(
      `Total wealth less the debts (${chf(-sum(debts))}), in whole CHF 1,000, never below zero: ${chf(taxableWealthAmount)}.`,
      `Total de la fortune moins les dettes (${chf(-sum(debts))}), par CHF 1’000 entiers, jamais négatif${NB}: ${chf(taxableWealthAmount)}.`,
    ),
  );

  // The cantonal base tax on income.
  const trBase = new Trace().from(rateIncome, taxableIncome);
  const scale = trBase.p(P.incomeScale);
  trBase.p(rateRule(input.taxYear));
  let incomeBaseAmount: number;
  let baseHow: Text;
  if (parts === 100) {
    incomeBaseAmount = scaleTax(scale, taxable);
    baseHow = t(
      `The income scale (LI art. 47, ${input.taxYear}) at ${chf(taxable)}: ${chf(incomeBaseAmount)}.`,
      `Le barème du revenu (LI art. 47, ${input.taxYear}) à ${chf(taxable)}${NB}: ${chf(incomeBaseAmount)}.`,
    );
  } else {
    const atRateIncome = scaleTax(scale, rateIncomeAmount);
    const ppm = ratePpm(atRateIncome, rateIncomeAmount);
    const f = atRate(taxable, ppm);
    incomeBaseAmount = roundTo(f.num, f.den, 5);
    baseHow = t(
      `The scale gives ${chf(atRateIncome)} at ${chf(rateIncomeAmount)}, a rate of ${ppmText(ppm, 'en')}; ${chf(taxable)} at that rate, to 5 centimes: ${chf(incomeBaseAmount)}.`,
      `Le barème donne ${chf(atRateIncome)} à ${chf(rateIncomeAmount)}, soit un taux de ${ppmText(ppm, 'fr')}${NB}; ${chf(taxable)} à ce taux, à 5 centimes près${NB}: ${chf(incomeBaseAmount)}.`,
    );
  }
  const incomeBase = trBase.line(
    incomeBaseAmount,
    t(
      'Cantonal base tax on income (impôt cantonal de base, 100 %)',
      'Impôt cantonal de base sur le revenu (100 %)',
    ),
    baseHow,
  );

  // LRIPP: the cantonal base income tax reduced; the cantonal and the communal tax.
  const trRed = new Trace().from(incomeBase);
  const redBp = trRed.p(P.lrippReductionBp);
  const reduction = round5(incomeBaseAmount * redBp, 10_000);
  const incomeReduction = trRed.line(
    -reduction,
    t(
      `Reduction of the cantonal tax (LRIPP, ${pc(redBp, 'en')})`,
      `Réduction de l’impôt cantonal (LRIPP, ${pc(redBp, 'fr')})`,
    ),
    t(
      `${chf(incomeBaseAmount)} x ${pc(redBp, 'en')}, to 5 centimes: ${chf(reduction)}. It does not reduce the communal tax.`,
      `${chf(incomeBaseAmount)} x ${pc(redBp, 'fr')}, à 5 centimes près${NB}: ${chf(reduction)}. Elle ne réduit pas l’impôt communal.`,
    ),
  );
  const trCant = new Trace().from(incomeBase, incomeReduction);
  const coef = trCant.p(P.cantonalCoefficient);
  const reduced = incomeBaseAmount - reduction;
  const cantonalIncomeAmount = round5(reduced * coef, 10_000);
  const cantonalIncome = trCant.line(
    cantonalIncomeAmount,
    t(
      `Cantonal tax on income (impôt cantonal, ${pc(coef, 'en')})`,
      `Impôt cantonal sur le revenu (${pc(coef, 'fr')})`,
    ),
    t(
      `${chf(reduced)} x ${pc(coef, 'en')}, to 5 centimes: ${chf(cantonalIncomeAmount)}.`,
      `${chf(reduced)} x ${pc(coef, 'fr')}, à 5 centimes près${NB}: ${chf(cantonalIncomeAmount)}.`,
    ),
  );
  const communeName = part.fraction ? `${C.name} (${part.fraction.name})` : C.name;
  const communeSources = [
    P.communes.source,
    communalTax(input.taxYear).source,
    ...(part.fraction ? [fractions().source] : []),
  ];
  const rateHowText = (lang: 'en' | 'fr') =>
    part.fraction
      ? `${pc(C.rate, lang)} + ${pc(part.fraction.rate, lang)}`
      : C.special
        ? `${pc(C.main, lang)} + ${pc(C.special, lang)}`
        : pc(C.rate, lang);
  const communalIncomeAmount = round5(incomeBaseAmount * part.rate, 10_000);
  const communalIncome = new Trace()
    .from(incomeBase)
    .src(...communeSources)
    .line(
      communalIncomeAmount,
      t(
        `Communal tax on income, ${communeName} (impôt communal, ${pc(part.rate, 'en')})`,
        `Impôt communal sur le revenu, ${communeName} (${pc(part.rate, 'fr')})`,
      ),
      t(
        `${chf(incomeBaseAmount)} x ${rateHowText('en')}${C.special && !part.fraction ? ' (with the special earmarked tax)' : part.fraction ? ' (the commune and its fraction)' : ''}, to 5 centimes: ${chf(communalIncomeAmount)}.`,
        `${chf(incomeBaseAmount)} x ${rateHowText('fr')}${C.special && !part.fraction ? ' (avec l’impôt spécial affecté)' : part.fraction ? ' (la commune et sa fraction)' : ''}, à 5 centimes près${NB}: ${chf(communalIncomeAmount)}.`,
      ),
    );

  // Wealth tax.
  const trWb = new Trace().from(taxableWealth);
  const free = trWb.p(A.wealthFree)[input.family.base === 'married' ? 'married' : 'single'];
  let wealthBaseAmount = 0;
  let wealthHow: Text;
  if (taxableWealthAmount < free) {
    wealthHow = t(
      `Taxable wealth ${chf(taxableWealthAmount)} is under ${chf(free)}: no wealth tax.`,
      `Fortune imposable ${chf(taxableWealthAmount)} inférieure à ${chf(free)}${NB}: pas d’impôt sur la fortune.`,
    );
  } else {
    wealthBaseAmount = scaleTax(trWb.p(P.wealthScale), taxableWealthAmount);
    wealthHow = t(
      `The wealth scale (LI art. 59, ${input.taxYear}) at ${chf(taxableWealthAmount)}, to 5 centimes: ${chf(wealthBaseAmount)}.`,
      `Le barème de la fortune (LI art. 59, ${input.taxYear}) à ${chf(taxableWealthAmount)}, à 5 centimes près${NB}: ${chf(wealthBaseAmount)}.`,
    );
  }
  const wealthBase = trWb.line(
    wealthBaseAmount,
    t(
      'Cantonal base tax on wealth (impôt cantonal de base, 100 %)',
      'Impôt cantonal de base sur la fortune (100 %)',
    ),
    wealthHow,
  );
  const trCw = new Trace().from(wealthBase);
  trCw.p(P.cantonalCoefficient);
  const cantonalWealthAmount = round5(wealthBaseAmount * coef, 10_000);
  const cantonalWealth = trCw.line(
    cantonalWealthAmount,
    t(
      `Cantonal tax on wealth (impôt cantonal, ${pc(coef, 'en')})`,
      `Impôt cantonal sur la fortune (${pc(coef, 'fr')})`,
    ),
    t(
      `${chf(wealthBaseAmount)} x ${pc(coef, 'en')}, to 5 centimes: ${chf(cantonalWealthAmount)}.`,
      `${chf(wealthBaseAmount)} x ${pc(coef, 'fr')}, à 5 centimes près${NB}: ${chf(cantonalWealthAmount)}.`,
    ),
  );
  const communalWealthAmount = round5(wealthBaseAmount * part.rate, 10_000);
  const communalWealth = new Trace()
    .from(wealthBase)
    .src(...communeSources)
    .line(
      communalWealthAmount,
      t(
        `Communal tax on wealth, ${communeName} (impôt communal, ${pc(part.rate, 'en')})`,
        `Impôt communal sur la fortune, ${communeName} (${pc(part.rate, 'fr')})`,
      ),
      t(
        `${chf(wealthBaseAmount)} x ${rateHowText('en')}, to 5 centimes: ${chf(communalWealthAmount)}.`,
        `${chf(wealthBaseAmount)} x ${rateHowText('fr')}, à 5 centimes près${NB}: ${chf(communalWealthAmount)}.`,
      ),
    );

  // The maxima of LICom art. 8, checked with the tax before the LRIPP reduction (the higher one):
  // when even a lower bound of the limit is not reached, no cut applies; otherwise fail closed.
  const mx = maxima(input.taxYear).value;
  const byRate = (base: number) => base * (coef + part.rate);
  const incomeTaxHigh = byRate(incomeBaseAmount);
  const wealthTaxHigh = byRate(wealthBaseAmount);
  const party = -sum(items.filter((i) => i.code === '620'));
  const wealthYield =
    sum(items.filter((i) => i.code === '410')) +
    sum(items.filter((i) => i.code === '490' || i.code === '610'));
  const yieldFloor = Math.floor((taxableWealthAmount * mx.wealthYieldBp) / 10_000);
  const shareBase = s.net + party + Math.max(0, yieldFloor - wealthYield);
  // Amounts x hundredths of a percent: compare at the scale of 10,000.
  if (
    incomeTaxHigh > taxable * mx.incomeBp ||
    wealthTaxHigh > taxableWealthAmount * mx.wealthBp ||
    incomeTaxHigh + wealthTaxHigh > Math.max(0, shareBase) * mx.totalShareBp
  ) {
    throw new VdUnsupported(NOTE.maxima);
  }

  const totalAmount =
    cantonalIncomeAmount + communalIncomeAmount + cantonalWealthAmount + communalWealthAmount;
  const total = new Trace()
    .from(cantonalIncome, communalIncome, cantonalWealth, communalWealth)
    .src(maxima(input.taxYear).source)
    .line(
      totalAmount,
      t('Cantonal and communal tax (impôt cantonal et communal)', 'Impôt cantonal et communal'),
      t(
        `Income: cantonal ${chf(cantonalIncomeAmount)} + communal ${chf(communalIncomeAmount)}; wealth: cantonal ${chf(cantonalWealthAmount)} + communal ${chf(communalWealthAmount)}; total ${chf(totalAmount)}.`,
        `Revenu${NB}: cantonal ${chf(cantonalIncomeAmount)} + communal ${chf(communalIncomeAmount)}${NB}; fortune${NB}: cantonal ${chf(cantonalWealthAmount)} + communal ${chf(communalWealthAmount)}${NB}; total ${chf(totalAmount)}.`,
      ),
    );

  return {
    items,
    grossIncome,
    netIncome,
    incomeBeforeModest,
    intermediateIncome,
    taxableIncome,
    parts,
    rateIncome,
    wealth: { items: wealthItems, grossWealth, taxableWealth },
    taxes: {
      incomeBase,
      incomeReduction,
      cantonalIncome,
      communalIncome,
      wealthBase,
      cantonalWealth,
      communalWealth,
      total,
    },
  };
}

/** The commune reference of a result: its name and the rate applied. */
export function communeRef(taxYear: VdTaxYear, name: string, part?: string): CommuneRef {
  const c = communeOf(taxYear, name);
  const r = communeRate(c, part);
  return { bfs: null, name: c.name, rate: r === 'part' ? c.rate : r.rate };
}

/** For the sources test: the cited rules this module applies. */
export const ASSESS_RULES = (y: VdTaxYear): Cited<unknown>[] => [
  amountSteps(y),
  rateRule(y),
  communalTax(y),
  fractions(),
  maxima(y),
];
