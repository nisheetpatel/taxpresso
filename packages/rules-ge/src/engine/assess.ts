// From admitted items to taxes: the second half of the engine, and the part the private golden
// cases check on their own (their items are the amounts the tax office admitted).
//
// Income (ICC and IFD, same steps): gross income (91.00) = the income items; the subtotal 92.20 =
// gross income less every deduction before it; 92.40 = 92.20 less medical costs (71.00); the net
// income = 92.40 less donations and party payments (73.xx, 74.00); the taxable income = the net
// income less the social deductions (61.xx). Order of the form: ge-2025-guide-declaration-pp p. 13
// (recapitulation pages), p. 14 (71.00 on 92.20), p. 15 (73.xx on 92.40), p. 16 (61.30 on 92.40).
//
// ICC income tax (ge-2025-icc-tariff-pdf p. 2 to 4): base tax from the scale, at the rate of 50 %
// (full splitting) or 55.56 % (partial) of the income; + 47.5 % cantonal centimes; - 12 % of that
// total; + 1 % of the base for home care; communal centimes on the base.
// ICC wealth tax (p. 5 and 6): base tax from the scale; + 47.5 %; + 1 % home care; the
// supplementary tax, without any centimes (LIPP art. 59 al. 2); communal centimes on the base.
// Communal tax: the commune of residence taxes its privileged share of each base tax; the rest is
// taxed by the communes where the income is earned (ge-na-law-lcp art. 295A).
// IFD (art. 36 LIFD, Form. 58c): the same totals on the IFD column, then the federal tax on the
// taxable income, which every canton shares (packages/rules-ch, ifd/assess.ts).
import type { IccSplitting } from '../2025/icc.js';
import type { CommuneSlug } from '../2026/communes.js';
import { COMMUNES_2026 } from '../2026/communes.js';
import { COMMUNAL_SPLIT } from '../law/lcp.js';
import {
  bracketTax,
  chf,
  exemptPart,
  floorFranc,
  ifdTax,
  ifdTaxAtRate,
  percent,
  round5,
  roundFranc,
  share5,
  Trace,
  type IfdScale,
  type IncomeSplit,
} from '@taxpresso/rules-ch';
import { ABROAD_SOURCES } from './abroad.js';
import { paramsFor, type TaxYear, type YearParams } from './params.js';
import { AFTER_9220, AFTER_9240, isIncomeCode, rubric, SOCIAL } from './rubrics.js';
import type {
  CommunalShare,
  CommunalSplit,
  IccResult,
  IfdResult,
  Item,
  ItemAmount,
  ItemPerson,
  Line,
  Text,
} from './types.js';

export interface AssessInput {
  taxYear: TaxYear;
  commune: CommuneSlug;
  /** Married or registered partners living together. */
  couple: boolean;
  splitting: IccSplitting;
  ifdScale: IfdScale;
  /** Children for the 263 reduction on the married or parental federal scale. */
  ifdChildReductions: number;
  /** The documents that say which scale applies, when the household's situation needs them. */
  ifdScaleSources?: readonly string[];
  /** Family charges for the wealth deduction: 1 per child, 0.5 for a half charge. */
  wealthCharges: number;
  /** A single person living with their minor children (higher wealth deduction). */
  singleWithChildren: boolean;
  /** Gross salary earned in each commune, to split the communal tax (LCP art. 295A). */
  incomeByCommune?: Partial<Record<CommuneSlug, number>>;
  iccItems: readonly (Item | ItemAmount)[];
  wealthItems: readonly (Item | ItemAmount)[];
  ifdItems: readonly (Item | ItemAmount)[];
  /** Imputations of the état des titres, shown next to the tax, never part of it. */
  credits?: { withholdingTax?: Line; foreignTax?: Line };
  /** Social aid recipients and others the law exempts from the taxe personnelle (LCP art. 377). */
  personalTaxExempt?: boolean;
  /**
   * A property abroad (./abroad.ts): in each tax, its net income and the whole net income before
   * the deductions not linked to an income; for wealth, the gross assets abroad and in all. The
   * share not taxed here is 97.00, and the rate is the one of the whole (95.00).
   */
  abroad?: { icc: IncomeSplit; ifd: IncomeSplit; wealth: { foreign: number; total: number } };
}

const t = (en: string, fr: string): Text => ({ en, fr });
/** The tariff that states how the surcharges add up (the 2025 one, also used for 2026). */
const TARIFF = 'ge-2025-icc-tariff-pdf';
const NB = '\u00a0';

const communeName = (slug: CommuneSlug) => COMMUNES_2026.find((c) => c.slug === slug)?.name ?? slug;

/** An amount from a golden case or another caller, as an item with its rubric's label. */
export function asItem(item: Item | ItemAmount): Item {
  if ('label' in item) return item;
  const r = rubric(item.code);
  return {
    code: item.code,
    person: item.person,
    amount: item.amount,
    label: r?.label ?? t(item.code, item.code),
    how: t('As given.', 'Tel que donné.'),
    sources: r ? [r.source] : [],
  };
}

const sum = (items: readonly Item[]) => items.reduce((s, i) => s + i.amount, 0);

interface IncomeTotals {
  grossIncome: Line;
  subtotal9220: Line;
  subtotal9240: Line;
  netIncome: Line;
  totalIncome: Line;
  taxableIncome: Line;
}

/**
 * The subtotals of the recapitulation page PG3, from the items, in the form's order: 91.00, the
 * deductions 31.00 to 57.00, 92.20, 71.00, 92.40, 73.00, 74.00, the social deductions 61.20 to
 * 61.30, 95.00 revenu net total, 99.00 revenu imposable (ge-2025-declaration-specimen p. 3;
 * ge-2025-guide-declaration-pp p. 13 to 16).
 */
export function incomeTotals(items: readonly Item[], tax: 'ICC' | 'IFD'): IncomeTotals {
  const guide = 'ge-2025-declaration-specimen p. 3';
  const income = items.filter((i) => isIncomeCode(i.code));
  const before = items.filter(
    (i) => !AFTER_9220.has(i.code) && !AFTER_9240.has(i.code) && !SOCIAL.has(i.code),
  );
  const medical = items.filter((i) => AFTER_9220.has(i.code));
  const gifts = items.filter((i) => AFTER_9240.has(i.code));
  const social = items.filter((i) => SOCIAL.has(i.code));
  const gross = sum(income);
  const s9220 = sum(before);
  const s9240 = s9220 + sum(medical);
  const net = s9240 + sum(gifts);
  const totalNet = net + sum(social);
  const taxable = Math.max(0, floorFranc(totalNet));
  const grossIncome = new Trace()
    .src(guide)
    .from(...income)
    .line(
      gross,
      t(`Gross income, ${tax} (revenu brut total, 91.00)`, `Revenu brut total ${tax} (91.00)`),
      t(
        `The ${income.length} income items added up: ${chf(gross)}.`,
        `Les ${income.length} éléments de revenu additionnés${NB}: ${chf(gross)}.`,
      ),
    );
  const subtotal9220 = new Trace()
    .src(guide)
    .from(...before)
    .line(
      s9220,
      t(`Subtotal 92.20, ${tax}`, `Sous-total 92.20 ${tax}`),
      t(
        `Gross income less the deductions before medical costs: ${chf(s9220)}.`,
        `Revenu brut moins les déductions qui précèdent les frais médicaux${NB}: ${chf(s9220)}.`,
      ),
    );
  const subtotal9240 = new Trace()
    .src(guide, 'ge-2025-guide-declaration-pp p. 14')
    .from(subtotal9220, ...medical)
    .line(
      s9240,
      t(`Subtotal 92.40, ${tax}`, `Sous-total 92.40 ${tax}`),
      t(
        `Subtotal 92.20 less the medical costs: ${chf(s9240)}.`,
        `Sous-total 92.20 moins les frais médicaux${NB}: ${chf(s9240)}.`,
      ),
    );
  const netIncome = new Trace()
    .src(guide, 'ge-2025-guide-declaration-pp p. 15')
    .from(subtotal9240, ...gifts)
    .line(
      net,
      t(`Net income, ${tax} (revenu net)`, `Revenu net ${tax}`),
      t(
        `Subtotal 92.40 less donations and party payments: ${chf(net)}.`,
        `Sous-total 92.40 moins les dons et versements aux partis${NB}: ${chf(net)}.`,
      ),
    );
  const totalIncome = new Trace()
    .src(guide, 'ge-2025-guide-declaration-pp p. 15 and 16')
    .from(netIncome, ...social)
    .line(
      totalNet,
      t(`Total net income, ${tax} (revenu net total, 95.00)`, `Revenu net total ${tax} (95.00)`),
      t(
        `Net income less the social deductions${social.length ? '' : ' (none)'}: ${chf(totalNet)}.`,
        `Revenu net moins les déductions sociales${social.length ? '' : ' (aucune)'}${NB}: ${chf(totalNet)}.`,
      ),
    );
  const taxableIncome = new Trace()
    .src(guide)
    .from(totalIncome)
    .line(
      taxable,
      t(`Taxable income, ${tax} (revenu imposable, 99.00)`, `Revenu imposable ${tax} (99.00)`),
      t(
        `The total net income in whole francs, never below zero (all of it taxable here: a full year in Geneva): ${chf(taxable)}.`,
        `Le revenu net total en francs entiers, jamais négatif (entièrement imposable ici${NB}: une année entière à Genève)${NB}: ${chf(taxable)}.`,
      ),
    );
  return { grossIncome, subtotal9220, subtotal9240, netIncome, totalIncome, taxableIncome };
}

/**
 * With a property abroad: the total net income in whole francs is the income for the rate (95.00),
 * its share not taxed here is 97.00 (part proportionnelle du revenu non imposable), and the rest is
 * the taxable income (99.00), on the Geneva form's page PG3 (ge-2025-declaration-specimen p. 3).
 */
function exemptIncomeLines(
  totals: IncomeTotals,
  split: IncomeSplit,
  tax: 'ICC' | 'IFD',
): { rateBase: number; exempt: Line; taxable: Line } {
  const rateBase = Math.max(0, floorFranc(totals.totalIncome.amount));
  const part = exemptPart(rateBase, split.foreign, split.world);
  const exempt = new Trace()
    .src(...ABROAD_SOURCES[tax === 'ICC' ? 'income' : 'ifd'])
    .from(totals.totalIncome)
    .line(
      part,
      t(
        `Share of income not taxed here, ${tax} (part proportionnelle du revenu non imposable, 97.00)`,
        `Part proportionnelle du revenu non imposable ${tax} (97.00)`,
      ),
      t(
        `The total net income ${chf(rateBase)} x the net income of your property abroad (${chf(split.foreign)}) / your whole net income before the deductions not linked to an income (${chf(split.world)}), to the franc: ${chf(part)}.`,
        `Le revenu net total ${chf(rateBase)} x le revenu net de votre immeuble à l’étranger (${chf(split.foreign)}) / l’ensemble de votre revenu net avant les déductions sans lien avec un revenu (${chf(split.world)}), au franc${NB}: ${chf(part)}.`,
      ),
    );
  const taxable = new Trace()
    .src('ge-2025-declaration-specimen p. 3')
    .from(totals.totalIncome, exempt)
    .line(
      rateBase - part,
      t(`Taxable income, ${tax} (revenu imposable, 99.00)`, `Revenu imposable ${tax} (99.00)`),
      t(
        `The total net income in whole francs (${chf(rateBase)}) less the share not taxed here (${chf(part)}): ${chf(rateBase - part)}, taxed at the rate of the whole income.`,
        `Le revenu net total en francs entiers (${chf(rateBase)}) moins la part non imposable ici (${chf(part)})${NB}: ${chf(rateBase - part)}, imposé au taux de l’ensemble du revenu.`,
      ),
    );
  return { rateBase, exempt, taxable };
}

function communalSplit(
  P: YearParams,
  commune: CommuneSlug,
  base: Line,
  what: 'income' | 'wealth',
  incomeByCommune: Partial<Record<CommuneSlug, number>>,
): CommunalSplit {
  const sharePercent = P.communes.privilegedShare.value[commune];
  const rates = P.communes.centimes.value;
  const ratesSource = P.communes.centimes;
  const label = what === 'income' ? t('income', 'revenu') : t('wealth', 'fortune');

  const share = (
    c: CommuneSlug,
    baseAmount: number,
    baseHow: Text,
    privileged: boolean,
  ): CommunalShare => {
    const rate = rates[c];
    const baseTrace = new Trace().src(COMMUNAL_SPLIT.source).from(base);
    if (privileged) baseTrace.p(P.communes.privilegedShare);
    const baseLine = baseTrace.line(
      baseAmount,
      privileged
        ? t(
            `Privileged share of ${communeName(c)}, ${label.en} (part privilégiée)`,
            `Part privilégiée de ${communeName(c)}, ${label.fr}`,
          )
        : t(`Share of ${communeName(c)}, ${label.en}`, `Part de ${communeName(c)}, ${label.fr}`),
      baseHow,
    );
    const taxTrace = new Trace().from(baseLine);
    taxTrace.p(ratesSource);
    const amount = share5(baseAmount, rate);
    return {
      commune: c,
      base: baseLine,
      rate,
      tax: taxTrace.line(
        amount,
        t(
          `Communal tax of ${communeName(c)} on ${label.en}`,
          `Impôt communal de ${communeName(c)} sur ${what === 'income' ? 'le' : 'la'} ${label.fr}`,
        ),
        t(
          `${chf(baseAmount)} x ${percent(rate, 'en')} (centimes additionnels of ${communeName(c)}), to 5 centimes: ${chf(amount)}.`,
          `${chf(baseAmount)} x ${percent(rate, 'fr')} (centimes additionnels de ${communeName(c)}), aux 5 centimes${NB}: ${chf(amount)}.`,
        ),
      ),
    };
  };

  const privilegedBase = share5(base.amount, sharePercent * 100);
  const privileged = {
    ...share(
      commune,
      privilegedBase,
      t(
        `${sharePercent} % of the base tax ${chf(base.amount)} goes to the commune of residence, to 5 centimes: ${chf(privilegedBase)}.`,
        `${sharePercent}${NB}% de l’impôt de base ${chf(base.amount)} revient à la commune de domicile, aux 5 centimes${NB}: ${chf(privilegedBase)}.`,
      ),
      true,
    ),
    sharePercent,
  };

  // The rest, by commune of work in proportion to the salary earned there (wealth: all at home).
  const rest = base.amount - privilegedBase;
  const total = Object.values(incomeByCommune).reduce((s, v) => s + (v ?? 0), 0);
  const elsewhere =
    what === 'income' && total > 0
      ? (Object.entries(incomeByCommune) as [CommuneSlug, number][]).filter(
          ([c, v]) => c !== commune && v > 0,
        )
      : [];
  const shares: CommunalShare[] = [];
  let given = 0;
  for (const [c, earned] of elsewhere) {
    const amount = round5(rest * earned, total);
    given += amount;
    shares.push(
      share(
        c,
        amount,
        t(
          `The rest of the base tax (${chf(rest)}) in proportion to the salary earned in ${communeName(c)} (${chf(earned)} of ${chf(total)}), to 5 centimes: ${chf(amount)}.`,
          `Le solde de l’impôt de base (${chf(rest)}) au prorata du salaire gagné à ${communeName(c)} (${chf(earned)} sur ${chf(total)}), aux 5 centimes${NB}: ${chf(amount)}.`,
        ),
        false,
      ),
    );
  }
  shares.unshift(
    share(
      commune,
      rest - given,
      elsewhere.length
        ? t(
            `The rest of the base tax not attributed to another commune: ${chf(rest - given)}.`,
            `Le solde de l’impôt de base non attribué à une autre commune${NB}: ${chf(rest - given)}.`,
          )
        : t(
            `The rest of the base tax, ${chf(base.amount)} less the privileged share: ${chf(rest)}, all earned in the commune of residence.`,
            `Le solde de l’impôt de base, ${chf(base.amount)} moins la part privilégiée${NB}: ${chf(rest)}, tout gagné dans la commune de domicile.`,
          ),
      false,
    ),
  );
  return { privileged, rest: shares };
}

export interface Assessment {
  icc: Omit<IccResult, 'items' | 'wealth'> & {
    items: Item[];
    wealth: IccResult['wealth'];
  };
  ifd: IfdResult;
  /** The tax shield (LIPP art. 60) may apply: the ICC is then not computed (fail closed). */
  shieldMayApply: boolean;
}

export function assess(input: AssessInput): Assessment {
  const P = paramsFor(input.taxYear);
  const I = P.icc;
  const iccItems = input.iccItems.map(asItem);
  const wealthItems = input.wealthItems.map(asItem);
  const ifdItems = input.ifdItems.map(asItem);

  // ICC income. With a property abroad, 99.00 is the part taxed here (after 97.00) and the rate is
  // read at the whole income (95.00, LIPP art. 6 al. 1).
  const iccTotals0 = incomeTotals(iccItems, 'ICC');
  const iccExempt = input.abroad
    ? exemptIncomeLines(iccTotals0, input.abroad.icc, 'ICC')
    : undefined;
  const iccTotals = iccExempt ? { ...iccTotals0, taxableIncome: iccExempt.taxable } : iccTotals0;
  const taxable = iccTotals.taxableIncome.amount;
  /** The income the rate is read at: the taxable income, or with a property abroad 95.00. */
  const rateBase = iccExempt ? iccExempt.rateBase : taxable;
  const splitting = input.splitting;
  const rateTrace = new Trace().from(iccExempt ? iccTotals.totalIncome : iccTotals.taxableIncome);
  if (iccExempt) rateTrace.src(...ABROAD_SOURCES.income);
  let rateIncome = rateBase;
  let rateHow = iccExempt
    ? t(
        `No splitting: the rate is the one for your whole income, ${chf(rateBase)} (95.00), your property abroad included.`,
        `Pas de splitting${NB}: le taux est celui de l’ensemble de votre revenu, ${chf(rateBase)} (95.00), votre immeuble à l’étranger compris.`,
      )
    : t(
        `No splitting: the rate is the one for the whole income, ${chf(taxable)}.`,
        `Pas de splitting${NB}: le taux est celui du revenu entier, ${chf(taxable)}.`,
      );
  if (splitting !== 'none') {
    const share = rateTrace.p(I.splittingShare)[splitting];
    rateIncome = roundFranc(rateBase * share, 10_000);
    rateHow = t(
      `${splitting === 'full' ? 'Full' : 'Partial'} splitting: the rate is the one for ${percent(share, 'en')} of ${chf(rateBase)}${iccExempt ? ' (95.00, your property abroad included)' : ''}, to the franc: ${chf(rateIncome)}.`,
      `Splitting ${splitting === 'full' ? 'intégral' : 'partiel'}${NB}: le taux est celui de ${percent(share, 'fr')} de ${chf(rateBase)}${iccExempt ? ' (95.00, votre immeuble à l’étranger compris)' : ''}, au franc${NB}: ${chf(rateIncome)}.`,
    );
  }
  const rateLine = rateTrace.line(
    rateIncome,
    t('Rate income (revenu déterminant le taux)', 'Revenu déterminant le taux'),
    rateHow,
  );

  const baseTrace = new Trace().from(rateLine);
  const incomeScale = baseTrace.p(I.incomeScale);
  const rateTax = bracketTax(incomeScale, rateIncome);
  if (iccExempt) baseTrace.from(iccTotals.taxableIncome);
  const incomeBase = iccExempt
    ? rateIncome === 0
      ? 0
      : round5(taxable * rateTax, rateIncome)
    : splitting === 'none' || rateIncome === 0
      ? rateTax
      : round5(taxable * rateTax, rateIncome);
  const incomeBaseLine = baseTrace.line(
    incomeBase,
    t('Base income tax (impôt de base sur le revenu)', 'Impôt de base sur le revenu'),
    iccExempt
      ? t(
          `The scale gives ${chf(rateTax)} on the rate income ${chf(rateIncome)}; applied to the income taxed here (99.00): ${chf(taxable)} x ${chf(rateTax)} / ${chf(rateIncome)}, to 5 centimes: ${chf(incomeBase)}.`,
          `Le barème donne ${chf(rateTax)} sur le revenu déterminant le taux ${chf(rateIncome)}${NB}; appliqué au revenu imposable ici (99.00)${NB}: ${chf(taxable)} x ${chf(rateTax)} / ${chf(rateIncome)}, aux 5 centimes${NB}: ${chf(incomeBase)}.`,
        )
      : splitting === 'none'
        ? t(
            `The scale applied to ${chf(taxable)}, bracket by bracket, each to 5 centimes: ${chf(incomeBase)}.`,
            `Le barème appliqué à ${chf(taxable)}, tranche par tranche, chacune aux 5 centimes${NB}: ${chf(incomeBase)}.`,
          )
        : t(
            `The scale gives ${chf(rateTax)} on the rate income ${chf(rateIncome)}; applied to the whole income: ${chf(taxable)} x ${chf(rateTax)} / ${chf(rateIncome)}, to 5 centimes: ${chf(incomeBase)}.`,
            `Le barème donne ${chf(rateTax)} sur le revenu déterminant le taux ${chf(rateIncome)}${NB}; appliqué au revenu entier${NB}: ${chf(taxable)} x ${chf(rateTax)} / ${chf(rateIncome)}, aux 5 centimes${NB}: ${chf(incomeBase)}.`,
          ),
  );

  const ccTrace = new Trace().from(incomeBaseLine);
  const ccBp = ccTrace.p(I.incomeCantonalCentimesBp);
  const cc = share5(incomeBase, ccBp);
  const ccLine = ccTrace.line(
    cc,
    t(
      'Cantonal centimes on income (centimes additionnels cantonaux)',
      'Centimes additionnels cantonaux sur le revenu',
    ),
    t(
      `${percent(ccBp, 'en')} of the base tax ${chf(incomeBase)}, to 5 centimes: ${chf(cc)}.`,
      `${percent(ccBp, 'fr')} de l’impôt de base ${chf(incomeBase)}, aux 5 centimes${NB}: ${chf(cc)}.`,
    ),
  );
  const redTrace = new Trace().from(ccLine);
  const redBp = redTrace.p(I.incomeReductionBp);
  const reduction = -share5(incomeBase + cc, redBp);
  const redLine = redTrace.line(
    reduction,
    t('Reduction of the income tax (diminution d’impôt 12 %)', `Diminution d’impôt de 12${NB}%`),
    t(
      `${percent(redBp, 'en')} of the base tax plus cantonal centimes (${chf(incomeBase + cc)}), to 5 centimes: ${chf(reduction)}.`,
      `${percent(redBp, 'fr')} de l’impôt de base plus les centimes cantonaux (${chf(incomeBase + cc)}), aux 5 centimes${NB}: ${chf(reduction)}.`,
    ),
  );
  const hcTrace = new Trace().from(incomeBaseLine);
  const hcBp = hcTrace.p(I.incomeHomeCareBp);
  const homeCare = share5(incomeBase, hcBp);
  const hcLine = hcTrace.line(
    homeCare,
    t(
      'Home care centime on income (aide à domicile)',
      'Centime additionnel pour l’aide à domicile, revenu',
    ),
    t(
      `${percent(hcBp, 'en')} of the base tax ${chf(incomeBase)}, to 5 centimes: ${chf(homeCare)}.`,
      `${percent(hcBp, 'fr')} de l’impôt de base ${chf(incomeBase)}, aux 5 centimes${NB}: ${chf(homeCare)}.`,
    ),
  );
  const incomeCantonal = incomeBase + cc + reduction + homeCare;
  const incomeCantonalLine = new Trace()
    .src(`${TARIFF} p. 4`)
    .from(incomeBaseLine, ccLine, redLine, hcLine)
    .line(
      incomeCantonal,
      t('Cantonal income tax', 'Impôt cantonal sur le revenu'),
      t(
        `Base ${chf(incomeBase)} + centimes ${chf(cc)} - reduction ${chf(-reduction)} + home care ${chf(homeCare)} = ${chf(incomeCantonal)}.`,
        `Base ${chf(incomeBase)} + centimes ${chf(cc)} - diminution ${chf(-reduction)} + aide à domicile ${chf(homeCare)} = ${chf(incomeCantonal)}.`,
      ),
    );

  // ICC wealth.
  const assets = wealthItems.filter((i) => isIncomeCode(i.code));
  const debts = wealthItems.filter((i) => !isIncomeCode(i.code) && i.code !== '51.50');
  const grossWealth = sum(assets);
  const netWealth = Math.max(0, grossWealth + sum(debts));
  const guideWealth = 'ge-2025-guide-declaration-pp p. 13';
  const grossWealthLine = new Trace()
    .src(guideWealth)
    .from(...assets)
    .line(
      grossWealth,
      t('Gross wealth (fortune brute)', 'Fortune brute'),
      t(
        `The ${assets.length} assets added up: ${chf(grossWealth)}.`,
        `Les ${assets.length} éléments de fortune additionnés${NB}: ${chf(grossWealth)}.`,
      ),
    );
  const netWealthLine = new Trace()
    .src(guideWealth)
    .from(grossWealthLine, ...debts)
    .line(
      netWealth,
      t('Net wealth (fortune nette)', 'Fortune nette'),
      t(
        `Gross wealth less debts (${chf(-sum(debts))}), never below zero: ${chf(netWealth)}.`,
        `Fortune brute moins les dettes (${chf(-sum(debts))}), jamais négative${NB}: ${chf(netWealth)}.`,
      ),
    );
  const given = wealthItems.find((i) => i.code === '51.50');
  let social: Item;
  if (given) {
    social = given;
  } else {
    const st = new Trace();
    const ws = st.p(I.wealthSocial);
    const base = input.couple || input.singleWithChildren ? ws.couple : ws.single;
    const charges = Math.round(ws.perCharge * input.wealthCharges);
    const full = base + charges;
    const amount = -Math.min(full, netWealth);
    social = {
      code: '51.50',
      person: 'household',
      ...st.line(
        amount,
        rubric('51.50')!.label,
        t(
          `${chf(base)} for ${input.couple ? 'a married couple' : input.singleWithChildren ? 'a single parent living with minor children' : 'a single person'}${input.wealthCharges ? ` + ${chf(ws.perCharge)} x ${input.wealthCharges} family charge${input.wealthCharges === 1 ? '' : 's'}` : ''} = ${chf(full)}, at most the net wealth: ${chf(-amount)}.`,
          `${chf(base)} pour ${input.couple ? 'des époux' : input.singleWithChildren ? 'un parent seul avec enfants mineurs' : 'une personne seule'}${input.wealthCharges ? ` + ${chf(ws.perCharge)} x ${String(input.wealthCharges).replace('.', ',')} charge${input.wealthCharges > 1 ? 's' : ''} de famille` : ''} = ${chf(full)}, au plus la fortune nette${NB}: ${chf(-amount)}.`,
        ),
      ),
    };
  }
  // With a property abroad: the net wealth after the social deduction is the wealth for the rate
  // (95.00), its share abroad 97.00 (the debts and the social deduction split by the assets, LIPP
  // art. 57 and 58 al. 3), the rest the taxable wealth (99.00), at the rate of the whole (art. 6).
  const wealthTotal = Math.max(0, floorFranc(netWealth + social.amount));
  const wAbroad = input.abroad?.wealth;
  const exemptW = wAbroad ? exemptPart(wealthTotal, wAbroad.foreign, wAbroad.total) : 0;
  const rateWealthLine = wAbroad
    ? new Trace()
        .src(...ABROAD_SOURCES.wealth)
        .from(netWealthLine, social)
        .line(
          wealthTotal,
          t(
            'Total net wealth, for the rate (fortune nette totale, 95.00)',
            'Fortune nette totale, pour le taux (95.00)',
          ),
          t(
            `Net wealth less the social deduction, your property abroad included: ${chf(wealthTotal)}.`,
            `Fortune nette moins la déduction sociale, votre immeuble à l’étranger compris${NB}: ${chf(wealthTotal)}.`,
          ),
        )
    : undefined;
  const exemptWealthLine =
    wAbroad && rateWealthLine
      ? new Trace()
          .src(...ABROAD_SOURCES.wealth)
          .from(rateWealthLine)
          .line(
            exemptW,
            t(
              'Share of wealth not taxed here (part proportionnelle de la fortune non-imposable, 97.00)',
              'Part proportionnelle de la fortune non-imposable (97.00)',
            ),
            t(
              `${chf(wealthTotal)} x your gross assets abroad (${chf(wAbroad.foreign)}) / all your gross assets (${chf(wAbroad.total)}), to the franc: ${chf(exemptW)}.`,
              `${chf(wealthTotal)} x vos actifs bruts à l’étranger (${chf(wAbroad.foreign)}) / l’ensemble de vos actifs bruts (${chf(wAbroad.total)}), au franc${NB}: ${chf(exemptW)}.`,
            ),
          )
      : undefined;
  const taxableWealth = wealthTotal - exemptW;
  const taxableWealthLine = new Trace()
    .from(netWealthLine, social, exemptWealthLine)
    .line(
      taxableWealth,
      t('Taxable wealth (fortune imposable)', 'Fortune imposable'),
      exemptWealthLine
        ? t(
            `Total net wealth ${chf(wealthTotal)} less the share abroad ${chf(exemptW)}: ${chf(taxableWealth)} (99.00), taxed at the rate of the whole.`,
            `Fortune nette totale ${chf(wealthTotal)} moins la part à l’étranger ${chf(exemptW)}${NB}: ${chf(taxableWealth)} (99.00), imposée au taux de l’ensemble.`,
          )
        : t(
            `Net wealth less the social deduction: ${chf(taxableWealth)}.`,
            `Fortune nette moins la déduction sociale${NB}: ${chf(taxableWealth)}.`,
          ),
    );
  /** The tax of a wealth scale: on the taxable wealth, or at the rate of the whole wealth. */
  const wealthScaleTax = (scale: Parameters<typeof bracketTax>[0]) =>
    !wAbroad
      ? bracketTax(scale, taxableWealth)
      : wealthTotal === 0
        ? 0
        : round5(taxableWealth * bracketTax(scale, wealthTotal), wealthTotal);

  const wbTrace = new Trace().from(taxableWealthLine);
  if (rateWealthLine) wbTrace.from(rateWealthLine);
  const wealthBase = wealthScaleTax(wbTrace.p(I.wealthScale));
  const wealthBaseLine = wbTrace.line(
    wealthBase,
    t('Base wealth tax (impôt de base sur la fortune)', 'Impôt de base sur la fortune'),
    wAbroad
      ? t(
          `The wealth scale at your whole wealth (${chf(wealthTotal)}), applied to the wealth taxed here: ${chf(taxableWealth)} x ${chf(bracketTax(I.wealthScale.value, wealthTotal))} / ${chf(wealthTotal)}, to 5 centimes: ${chf(wealthBase)}.`,
          `Le barème de la fortune à l’ensemble de votre fortune (${chf(wealthTotal)}), appliqué à la fortune imposable ici${NB}: ${chf(taxableWealth)} x ${chf(bracketTax(I.wealthScale.value, wealthTotal))} / ${chf(wealthTotal)}, aux 5 centimes${NB}: ${chf(wealthBase)}.`,
        )
      : t(
          `The wealth scale applied to ${chf(taxableWealth)}, bracket by bracket, each to 5 centimes: ${chf(wealthBase)}.`,
          `Le barème de la fortune appliqué à ${chf(taxableWealth)}, tranche par tranche, chacune aux 5 centimes${NB}: ${chf(wealthBase)}.`,
        ),
  );
  const wcTrace = new Trace().from(wealthBaseLine);
  const wcBp = wcTrace.p(I.wealthCantonalCentimesBp);
  const wealthCc = share5(wealthBase, wcBp);
  const wealthCcLine = wcTrace.line(
    wealthCc,
    t('Cantonal centimes on wealth', 'Centimes additionnels cantonaux sur la fortune'),
    t(
      `${percent(wcBp, 'en')} of the base wealth tax ${chf(wealthBase)}, to 5 centimes: ${chf(wealthCc)}.`,
      `${percent(wcBp, 'fr')} de l’impôt de base sur la fortune ${chf(wealthBase)}, aux 5 centimes${NB}: ${chf(wealthCc)}.`,
    ),
  );
  const whTrace = new Trace().from(wealthBaseLine);
  const whBp = whTrace.p(I.wealthHomeCareBp);
  const wealthHc = share5(wealthBase, whBp);
  const wealthHcLine = whTrace.line(
    wealthHc,
    t(
      'Home care centime on wealth (aide à domicile)',
      'Centime additionnel pour l’aide à domicile, fortune',
    ),
    t(
      `${percent(whBp, 'en')} of the base wealth tax ${chf(wealthBase)}, to 5 centimes: ${chf(wealthHc)}.`,
      `${percent(whBp, 'fr')} de l’impôt de base sur la fortune ${chf(wealthBase)}, aux 5 centimes${NB}: ${chf(wealthHc)}.`,
    ),
  );
  const wsTrace = new Trace().from(taxableWealthLine);
  if (rateWealthLine) wsTrace.from(rateWealthLine);
  const supplementary = wealthScaleTax(wsTrace.p(I.wealthSupplementaryScale));
  const supplementaryLine = wsTrace.line(
    supplementary,
    t(
      'Supplementary wealth tax (impôt supplémentaire sur la fortune)',
      'Impôt supplémentaire sur la fortune',
    ),
    t(
      `Its own scale applied to ${chf(taxableWealth)}: ${chf(supplementary)}. No cantonal or communal centimes on it.`,
      `Son propre barème appliqué à ${chf(taxableWealth)}${NB}: ${chf(supplementary)}. Aucun centime additionnel, cantonal ou communal.`,
    ),
  );
  const wealthCantonal = wealthBase + wealthCc + wealthHc + supplementary;
  const wealthCantonalLine = new Trace()
    .src(`${TARIFF} p. 6`)
    .from(wealthBaseLine, wealthCcLine, wealthHcLine, supplementaryLine)
    .line(
      wealthCantonal,
      t('Cantonal wealth tax', 'Impôt cantonal sur la fortune'),
      t(
        `Base ${chf(wealthBase)} + centimes ${chf(wealthCc)} + home care ${chf(wealthHc)} + supplementary ${chf(supplementary)} = ${chf(wealthCantonal)}.`,
        `Base ${chf(wealthBase)} + centimes ${chf(wealthCc)} + aide à domicile ${chf(wealthHc)} + supplémentaire ${chf(supplementary)} = ${chf(wealthCantonal)}.`,
      ),
    );

  // Communal.
  const byCommune = input.incomeByCommune ?? {};
  const communalIncome = communalSplit(P, input.commune, incomeBaseLine, 'income', byCommune);
  const communalWealth = communalSplit(P, input.commune, wealthBaseLine, 'wealth', {});
  const splitLines = (s: CommunalSplit) => [s.privileged.tax, ...s.rest.map((r) => r.tax)];
  const communalIncomeTotal = new Trace()
    .src(COMMUNAL_SPLIT.source)
    .from(...splitLines(communalIncome))
    .line(
      splitLines(communalIncome).reduce((s, l) => s + l.amount, 0),
      t('Communal income tax', 'Impôt communal sur le revenu'),
      t(
        'The privileged share and the rest, each at its commune’s centimes.',
        'La part privilégiée et le solde, chacun aux centimes de sa commune.',
      ),
    );
  const communalWealthTotal = new Trace()
    .src(COMMUNAL_SPLIT.source)
    .from(...splitLines(communalWealth))
    .line(
      splitLines(communalWealth).reduce((s, l) => s + l.amount, 0),
      t('Communal wealth tax', 'Impôt communal sur la fortune'),
      t(
        'The privileged share and the rest, at the commune of residence’s centimes.',
        'La part privilégiée et le solde, aux centimes de la commune de domicile.',
      ),
    );

  // Taxe personnelle.
  const ptTrace = new Trace().from(iccTotals.taxableIncome, taxableWealthLine);
  const pt = ptTrace.p(P.personalTax);
  const limit = pt.exemptUpTo[splitting];
  const exempt = input.personalTaxExempt === true || (taxableWealth === 0 && taxable <= limit);
  const personalTax = ptTrace.line(
    exempt ? 0 : pt.amount,
    t('Personal tax (taxe personnelle)', 'Taxe personnelle'),
    exempt
      ? input.personalTaxExempt
        ? t('Exempt, as stated.', 'Exonéré, comme indiqué.')
        : t(
            `Not due: no taxable wealth and a taxable income of at most ${chf(limit)}.`,
            `Pas due${NB}: aucune fortune imposable et un revenu imposable d’au plus ${chf(limit)}.`,
          )
      : t(
          `${chf(pt.amount)} a year, one for a married couple.`,
          `${chf(pt.amount)} par an, une seule pour un couple marié.`,
        ),
  );

  const iccTotal =
    incomeCantonal +
    wealthCantonal +
    communalIncomeTotal.amount +
    communalWealthTotal.amount +
    personalTax.amount;
  const totalLine = new Trace()
    .src(`${TARIFF} p. 4 and 6`, COMMUNAL_SPLIT.source)
    .from(
      incomeCantonalLine,
      wealthCantonalLine,
      communalIncomeTotal,
      communalWealthTotal,
      personalTax,
    )
    .line(
      iccTotal,
      t('Cantonal and communal tax (ICC)', 'Impôt cantonal et communal (ICC)'),
      t(
        `Cantonal income ${chf(incomeCantonal)} + cantonal wealth ${chf(wealthCantonal)} + communal ${chf(communalIncomeTotal.amount + communalWealthTotal.amount)} + personal tax ${chf(personalTax.amount)} = ${chf(iccTotal)}.`,
        `Cantonal revenu ${chf(incomeCantonal)} + cantonal fortune ${chf(wealthCantonal)} + communal ${chf(communalIncomeTotal.amount + communalWealthTotal.amount)} + taxe personnelle ${chf(personalTax.amount)} = ${chf(iccTotal)}.`,
      ),
    );

  // Tax shield (LIPP art. 60): income and wealth taxes, centimes included, at most 60 % of the
  // taxable income, the wealth yield taken at least 1 %. Below 60 % of the taxable income it
  // cannot apply; above, it may, and the engine does not compute it.
  const incomeWealthTaxes = iccTotal - personalTax.amount;
  const shieldMayApply = wealthBase > 0 && incomeWealthTaxes * 10 > taxable * 6;

  // IFD: the totals of the Geneva form, then the federal tax on its taxable income (rules-ch). With
  // a property abroad, on 99.00 at the rate of the whole income (LIFD art. 7 al. 1): the reduction
  // per child is then not applied (the engine fails closed on the federal tax when it would be).
  const ifdTotals0 = incomeTotals(ifdItems, 'IFD');
  const ifdExempt = input.abroad
    ? exemptIncomeLines(ifdTotals0, input.abroad.ifd, 'IFD')
    : undefined;
  const ifdTotals = ifdExempt ? { ...ifdTotals0, taxableIncome: ifdExempt.taxable } : ifdTotals0;
  const federal = ifdExempt
    ? ifdTaxAtRate(
        P.ifd,
        new Trace()
          .src(...ABROAD_SOURCES.ifd)
          .from(ifdTotals.totalIncome)
          .line(
            ifdExempt.rateBase,
            t('Federal rate income (revenu déterminant le taux)', 'Revenu déterminant le taux IFD'),
            t(
              `The total net income in whole francs, your property abroad included: ${chf(ifdExempt.rateBase)}.`,
              `Le revenu net total en francs entiers, votre immeuble à l’étranger compris${NB}: ${chf(ifdExempt.rateBase)}.`,
            ),
          ),
        ifdTotals.taxableIncome,
        input.ifdScale,
        input.ifdScaleSources,
      )
    : ifdTax(
        P.ifd,
        ifdTotals.taxableIncome,
        input.ifdScale,
        input.ifdChildReductions,
        input.ifdScaleSources,
      );

  return {
    icc: {
      items: iccItems,
      ...iccTotals,
      ...(iccExempt ? { exemptIncome: iccExempt.exempt } : {}),
      splitting,
      rateIncome: rateLine,
      wealth: {
        items: wealthItems.filter((i) => i.code !== '51.50'),
        grossWealth: grossWealthLine,
        netWealth: netWealthLine,
        socialDeduction: social,
        ...(rateWealthLine ? { rateWealth: rateWealthLine } : {}),
        ...(exemptWealthLine ? { exemptWealth: exemptWealthLine } : {}),
        taxableWealth: taxableWealthLine,
      },
      taxes: {
        incomeBase: incomeBaseLine,
        incomeCantonalCentimes: ccLine,
        incomeReduction12: redLine,
        incomeHomeCare: hcLine,
        incomeCantonal: incomeCantonalLine,
        wealthBase: wealthBaseLine,
        wealthCantonalCentimes: wealthCcLine,
        wealthHomeCare: wealthHcLine,
        wealthSupplementary: supplementaryLine,
        wealthCantonal: wealthCantonalLine,
        communalIncome,
        communalWealth,
        communalIncomeTotal,
        communalWealthTotal,
        personalTax,
        total: totalLine,
      },
      credits: { ...input.credits },
    },
    ifd: {
      items: ifdItems,
      ...ifdTotals,
      ...federal,
      ...(ifdExempt ? { exemptIncome: ifdExempt.exempt } : {}),
    },
    shieldMayApply,
  };
}

/** Who an item belongs to, for display. */
export const personLabel = (p: ItemPerson): Text =>
  p === 'p1'
    ? t('taxpayer A', 'contribuable A')
    : p === 'p2'
      ? t('taxpayer B', 'contribuable B')
      : p === 'household'
        ? t('household', 'ménage')
        : t('child', 'enfant');
