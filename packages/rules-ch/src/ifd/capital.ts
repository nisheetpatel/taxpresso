// The federal tax on lump sums from the 2nd pillar and pillar 3a (prestations en capital provenant de
// la prévoyance), the same in every canton. ch-na-law-lifd (p. 32), art. 38: taxed apart from the
// other income, a full year's tax (al. 1) for the year the lump sum was received (al. 1bis), at
// rates of a fifth of the scales of art. 36 al. 1, 2 and 2bis first sentence (al. 2: the married
// scale for married couples and for single parents, without the reduction per child of al. 2bis's
// second sentence), with no social deduction (al. 3). The spouses' income is added up (art. 9
// al. 1, p. 5), so are their lump sums of the year. The federal instructions say the same
// (ch-2026-ifd-instructions-personnes-physiques p. 4, chiffre 3, and p. 9), and Form. 58c applies
// to these lump sums too (ch-2025- and ch-2026-ifd-tarif-personnes-physiques p. 1): the amount
// with the fraction under CHF 100 dropped (note 1), the tax rounded down to 5 centimes (note 2).
//
// A fifth of the rate on the whole amount is a fifth of the scale's tax on it. Not spelled out:
// whether the fifth is rounded down to 5 centimes as Form. 58c rounds a year's tax (IFD_CAPITAL_NOTE),
// and whether the CHF 25 minimum of art. 36 al. 3 applies (art. 38 al. 2 names al. 1, 2 and 2bis
// only): between 0 and CHF 25 the tax is not computed (fail closed).
import { chf, federalScaleTax, Trace } from '../core/calc.js';
import type { Cited } from '../core/cited.js';
import type { IfdCapitalTax, IfdScale, Line, Text } from '../core/types.js';
import type { IfdParams } from './params.js';

/** The rates are a fifth of the scales' (taux représentant le cinquième des barèmes). */
export const IFD_CAPITAL_FIFTH: Cited<number> = {
  value: 5,
  source: 'ch-na-law-lifd art. 38 al. 2 (p. 32)',
};

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const LAW = 'ch-na-law-lifd art. 38 al. 1 and 2 (p. 32)';
const SPOUSES = 'ch-na-law-lifd art. 9 al. 1 (p. 5)';
/** The federal instructions, published for 2026 only: a 2025 line cites the law alone. */
const INSTRUCTIONS = (taxYear: number) =>
  taxYear >= 2026 ? ['ch-2026-ifd-instructions-personnes-physiques p. 4 and 9'] : [];

/** What the federal documents don't spell out about the tax on pension capital. */
export const IFD_CAPITAL_NOTE = {
  rounding: t(
    'Federal tax on pension capital: a fifth of the scale’s tax, rounded down to 5 centimes as Form. 58c rounds a year’s tax (note 2); the documents don’t say how the fifth itself is rounded.',
    `Impôt fédéral sur les prestations en capital${NB}: le cinquième de l’impôt du barème, ramené aux 5 centimes inférieurs comme la formule 58c le fait pour l’impôt annuel (note 2)${NB}; les documents ne précisent pas l’arrondi du cinquième.`,
  ),
  minimum: t(
    'Federal tax on pension capital not computed: it comes to less than CHF 25, and the documents don’t say whether the CHF 25 minimum (LIFD art. 36 al. 3) applies to it (art. 38 al. 2 names the scales only).',
    `Impôt fédéral sur les prestations en capital non calculé${NB}: il est inférieur à CHF 25, et les documents ne disent pas si le minimum de CHF 25 (LIFD art. 36 al. 3) s’y applique (l’art. 38 al. 2 ne renvoie qu’aux barèmes).`,
  ),
} as const satisfies Record<string, Text>;

/**
 * The federal tax on `amount`, every lump sum of the year added up, on `scale` (the household's:
 * the married scale for a couple and a parent living with the children), for `taxYear` (`F`'s).
 * Undefined when it can't be computed: then `unsupported` says why.
 */
export function ifdCapitalTax(
  F: IfdParams,
  amount: Line,
  scale: IfdScale,
  taxYear: number,
): { tax: IfdCapitalTax; unverified: Text[] } | { unsupported: Text } {
  const inTrace = new Trace().from(amount).src(LAW, SPOUSES);
  const rounding = inTrace.p(F.rounding);
  const scaleIncome = Math.floor(amount.amount / rounding.incomeStep) * rounding.incomeStep;
  const scaleIncomeLine = inTrace.line(
    scaleIncome,
    t('Pension capital for the federal scale', 'Prestations en capital pour le barème fédéral'),
    t(
      `Every lump sum of the year added up, ${chf(amount.amount)}, with the fraction under CHF 100 dropped: ${chf(scaleIncome)}.`,
      `Toutes les prestations en capital de l’année additionnées, ${chf(amount.amount)}, sans la fraction inférieure à CHF 100${NB}: ${chf(scaleIncome)}.`,
    ),
  );
  const stTrace = new Trace().from(scaleIncomeLine).src(LAW, ...INSTRUCTIONS(taxYear));
  const steps = stTrace.p(scale === 'single' ? F.singleScale : F.marriedScale);
  const raw = federalScaleTax(steps, scaleIncome);
  const scaleName =
    scale === 'single'
      ? t('single scale', 'barème de base')
      : scale === 'married'
        ? t('married scale', 'barème pour personnes mariées')
        : t(
            'parental scale, the married one without the reduction per child',
            'barème parental, celui des personnes mariées sans la réduction par enfant',
          );
  const scaleTaxLine = stTrace.line(
    raw,
    t(
      'Federal tax by the scale on that amount (one year)',
      'Impôt fédéral selon le barème sur ce montant (une année)',
    ),
    t(
      `The ${scaleName.en} at ${chf(scaleIncome)}: ${chf(raw)}.`,
      `Le ${scaleName.fr} à ${chf(scaleIncome)}${NB}: ${chf(raw)}.`,
    ),
  );
  const taxTrace = new Trace().from(scaleTaxLine);
  const divisor = taxTrace.p(IFD_CAPITAL_FIFTH);
  taxTrace.p(F.rounding);
  const step = rounding.taxStep;
  // A fifth of the scale's tax, to 5 centimes down: floor(raw / 5 / step) x step.
  const fifth = Math.floor(raw / (divisor * step)) * step;
  const minimum = taxTrace.p(F.minimumCollected);
  if (fifth > 0 && fifth < minimum) return { unsupported: IFD_CAPITAL_NOTE.minimum };
  const taxLine = taxTrace.line(
    fifth,
    t(
      'Federal tax on pension capital (prestations en capital)',
      'Impôt fédéral direct sur les prestations en capital',
    ),
    t(
      `A fifth of ${chf(raw)}, rounded down to 5 centimes: ${chf(fifth)}. No social deduction and no reduction per child (LIFD art. 38 al. 2 and 3).`,
      `Le cinquième de ${chf(raw)}, ramené aux 5 centimes inférieurs${NB}: ${chf(fifth)}. Ni déduction sociale ni réduction par enfant (LIFD art. 38 al. 2 et 3).`,
    ),
  );
  return {
    tax: { scaleIncome: scaleIncomeLine, scale, scaleTax: scaleTaxLine, tax: taxLine },
    unverified: [IFD_CAPITAL_NOTE.rounding],
  };
}
