// From the federal taxable income to the federal direct tax (IFD), the same in every canton:
// art. 36 LIFD and Form. 58c. The scale is read at the taxable income rounded down to CHF 100
// (note 1), the tax rounded down to 5 centimes (note 2), less the reduction per child on the
// married or parental scale (art. 36 al. 2bis), nothing collected under the minimum (al. 3).
// Each canton's form gives the taxable income (Geneva: 99.00 in the IFD column).
import { chf, federalScaleTax, Trace } from '../core/calc.js';
import type { IfdScale, IfdTax, Line, Text } from '../core/types.js';
import type { IfdParams } from './params.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = '\u00a0';

/**
 * The federal tax on `taxableIncome`, on `scale`, with `childReductions` reductions per child.
 * `scaleSources` are the documents that say which scale applies, when the household's situation
 * needs them (separated parents: ch-na-circulaire-30-epoux-famille).
 */
export function ifdTax(
  F: IfdParams,
  taxableIncome: Line,
  scale: IfdScale,
  childReductions: number,
  scaleSources: readonly string[] = [],
): IfdTax {
  const ifdTaxable = taxableIncome.amount;
  const scaleTrace = new Trace().from(taxableIncome);
  const rounding = scaleTrace.p(F.rounding);
  const scaleIncome = Math.floor(ifdTaxable / rounding.incomeStep) * rounding.incomeStep;
  const scaleIncomeLine = scaleTrace.line(
    scaleIncome,
    t('Income for the federal scale', 'Revenu pour le barème fédéral'),
    t(
      `${chf(ifdTaxable)} with the fraction under CHF 100 dropped: ${chf(scaleIncome)}.`,
      `${chf(ifdTaxable)} sans la fraction inférieure à CHF 100${NB}: ${chf(scaleIncome)}.`,
    ),
  );
  const stTrace = new Trace().from(scaleIncomeLine);
  const steps = stTrace.p(scale === 'single' ? F.singleScale : F.marriedScale);
  stTrace.src(...scaleSources);
  stTrace.p(F.rounding);
  const raw = federalScaleTax(steps, scaleIncome);
  const scaleTax = Math.floor(raw / rounding.taxStep) * rounding.taxStep;
  const scaleName =
    scale === 'single'
      ? t('single scale', 'barème de base')
      : scale === 'married'
        ? t('married scale', 'barème pour personnes mariées')
        : t('parental scale (the married scale)', 'barème parental (celui des personnes mariées)');
  const scaleTaxLine = stTrace.line(
    scaleTax,
    t('Federal tax by the scale', 'Impôt fédéral selon le barème'),
    t(
      `The ${scaleName.en} at ${chf(scaleIncome)}: ${chf(raw)}, rounded down to 5 centimes: ${chf(scaleTax)}.`,
      `Le ${scaleName.fr} à ${chf(scaleIncome)}${NB}: ${chf(raw)}, ramené aux 5 centimes inférieurs${NB}: ${chf(scaleTax)}.`,
    ),
  );
  const crTrace = new Trace().from(scaleTaxLine).src(...scaleSources);
  const reductionPerChild = crTrace.p(F.childTaxReduction);
  const perChild = scale === 'single' ? 0 : reductionPerChild;
  const childReduction = -Math.min(scaleTax, perChild * childReductions);
  const childReductionLine = crTrace.line(
    childReduction,
    t('Reduction per child', 'Réduction par enfant'),
    childReductions && perChild
      ? t(
          `${chf(perChild)} x ${childReductions} child${childReductions === 1 ? '' : 'ren'}, at most the tax: ${chf(childReduction)}.`,
          `${chf(perChild)} x ${childReductions} enfant${childReductions === 1 ? '' : 's'}, au plus l’impôt${NB}: ${chf(childReduction)}.`,
        )
      : t('No child: no reduction.', `Pas d’enfant${NB}: pas de réduction.`),
  );
  const minTrace = new Trace().from(scaleTaxLine, childReductionLine);
  const minimum = minTrace.p(F.minimumCollected);
  const due = scaleTax + childReduction;
  const tax = due < minimum ? 0 : due;
  const taxLine = minTrace.line(
    tax,
    t('Federal direct tax (IFD)', 'Impôt fédéral direct (IFD)'),
    due < minimum
      ? t(
          `${chf(due)} is under ${chf(minimum)}: not collected.`,
          `${chf(due)} est inférieur à ${chf(minimum)}${NB}: pas perçu.`,
        )
      : t(
          `${chf(scaleTax)} by the scale${childReduction ? ` less ${chf(-childReduction)} for the children` : ''}: ${chf(tax)}.`,
          `${chf(scaleTax)} selon le barème${childReduction ? ` moins ${chf(-childReduction)} pour les enfants` : ''}${NB}: ${chf(tax)}.`,
        ),
  );
  return {
    scaleIncome: scaleIncomeLine,
    scale,
    scaleTax: scaleTaxLine,
    childReduction: childReductionLine,
    tax: taxLine,
  };
}
