// How a Geneva result reads (packages/rules-ch, view.ts): the cantonal and communal tax (ICC), with
// its centimes additionnels, the 12 % reduction, the communal shares and the taxe personnelle, and
// the federal tax (IFD), with the French terms of the Geneva return. The extension's generic views
// (compute_tax, the estimate card, the final check, the plans) read it; nothing is computed here.
import { chf, type ResultView, type ViewLine, type ViewRow } from '@taxpresso/rules-ch';
import { allLines } from './compute.js';
import { compareWithLastYear } from './last-year.js';
import type { Line, TaxResult } from './types.js';

/** Every computed line of a result with a stable id, for the explanation tree. */
function lines(r: TaxResult): ViewLine[] {
  const out: [string, Line][] = [];
  if (r.icc) {
    const i = r.icc;
    const x = i.taxes;
    out.push(
      ['icc.grossIncome', i.grossIncome],
      ['icc.subtotal9220', i.subtotal9220],
      ['icc.subtotal9240', i.subtotal9240],
      ['icc.netIncome', i.netIncome],
      ['icc.taxableIncome', i.taxableIncome],
      ['icc.rateIncome', i.rateIncome],
      ['icc.wealth.grossWealth', i.wealth.grossWealth],
      ['icc.wealth.netWealth', i.wealth.netWealth],
      ['icc.wealth.taxableWealth', i.wealth.taxableWealth],
      ['icc.incomeBase', x.incomeBase],
      ['icc.incomeCantonalCentimes', x.incomeCantonalCentimes],
      ['icc.incomeReduction12', x.incomeReduction12],
      ['icc.incomeHomeCare', x.incomeHomeCare],
      ['icc.incomeCantonal', x.incomeCantonal],
      ['icc.wealthBase', x.wealthBase],
      ['icc.wealthCantonalCentimes', x.wealthCantonalCentimes],
      ['icc.wealthHomeCare', x.wealthHomeCare],
      ['icc.wealthSupplementary', x.wealthSupplementary],
      ['icc.wealthCantonal', x.wealthCantonal],
      ['icc.communal.privileged.base', x.communalIncome.privileged.base],
      ['icc.communal.privileged.tax', x.communalIncome.privileged.tax],
      ...x.communalIncome.rest.flatMap((s): [string, Line][] => [
        [`icc.communal.${s.commune}.base`, s.base],
        [`icc.communal.${s.commune}.tax`, s.tax],
      ]),
      ['icc.communalIncome', x.communalIncomeTotal],
      ['icc.communalWealth', x.communalWealthTotal],
      ['icc.personalTax', x.personalTax],
      ['icc.total', x.total],
    );
    if (i.credits.withholdingTax) out.push(['icc.credit.withholdingTax', i.credits.withholdingTax]);
  }
  if (r.ifd) {
    const f = r.ifd;
    out.push(
      ['ifd.grossIncome', f.grossIncome],
      ['ifd.subtotal9220', f.subtotal9220],
      ['ifd.subtotal9240', f.subtotal9240],
      ['ifd.netIncome', f.netIncome],
      ['ifd.taxableIncome', f.taxableIncome],
      ['ifd.scaleIncome', f.scaleIncome],
      ['ifd.scaleTax', f.scaleTax],
      ['ifd.childReduction', f.childReduction],
      ['ifd.tax', f.tax],
    );
  }
  if (r.capital) {
    const c = r.capital;
    out.push(['capital.amount', c.amount]);
    if (c.icc) {
      const x = c.icc;
      out.push(
        ['capital.rateIncome', x.rateIncome],
        ['capital.scaleTax', x.scaleTax],
        ['capital.base', x.base],
        ['capital.cantonalCentimes', x.cantonalCentimes],
        ['capital.reduction12', x.reduction12],
        ['capital.homeCare', x.homeCare],
        ['capital.cantonal', x.cantonal],
        ['capital.communal', x.communal],
        ['capital.icc', x.tax],
      );
    }
    if (c.ifd) {
      out.push(
        ['capital.ifd.scaleIncome', c.ifd.scaleIncome],
        ['capital.ifd.scaleTax', c.ifd.scaleTax],
        ['capital.ifd', c.ifd.tax],
      );
    }
    if (c.total) out.push(['capital.total', c.total]);
  }
  return out.map(([id, line]) => ({ id, line }));
}

export const view: ResultView<TaxResult> = {
  canton: 'GE',
  // Geneva's views predate the cantons: no canton code, no preview notes.
  preview: false,
  german: false,
  where: (r) => `commune ${r.commune}`,
  cantonal(icc) {
    const x = icc.taxes;
    return [
      `Cantonal and communal tax (ICC): ${chf(x.total.amount)} = cantonal income tax ${chf(x.incomeCantonal.amount)} + cantonal wealth tax ${chf(x.wealthCantonal.amount)} + communal tax ${chf(x.communalIncomeTotal.amount + x.communalWealthTotal.amount)} + taxe personnelle ${chf(x.personalTax.amount)}.`,
      `ICC taxable income (revenu imposable) ${chf(icc.taxableIncome.amount)}, rate income (revenu déterminant le taux) ${chf(icc.rateIncome.amount)} (${icc.splitting === 'none' ? 'no splitting' : `${icc.splitting} splitting`}); taxable wealth (fortune imposable) ${chf(icc.wealth.taxableWealth.amount)}.`,
      ...(icc.credits.withholdingTax
        ? [
            `Swiss withholding tax to be credited (impôt anticipé): ${chf(icc.credits.withholdingTax.amount)}, not part of the tax.`,
          ]
        : []),
    ];
  },
  federal: { name: 'Federal direct tax (IFD)', from: '' },
  mainItems: 'Main ICC items',
  term: (i) => i.label.fr,
  structured: (icc) => ({
    total: icc.taxes.total.amount,
    cantonalIncome: icc.taxes.incomeCantonal.amount,
    cantonalWealth: icc.taxes.wealthCantonal.amount,
    communal: icc.taxes.communalIncomeTotal.amount + icc.taxes.communalWealthTotal.amount,
    personalTax: icc.taxes.personalTax.amount,
    taxableIncome: icc.taxableIncome.amount,
    rateIncome: icc.rateIncome.amount,
    splitting: icc.splitting,
    taxableWealth: icc.wealth.taxableWealth.amount,
    ...(icc.credits.withholdingTax
      ? { withholdingTaxCredit: icc.credits.withholdingTax.amount }
      : {}),
  }),
  ifdCode: 'IFD',
  detailNote: '',
  lines,
  detailLines:
    /incomeBase|Cantonal|Reduction|HomeCare|Supplementary|privileged|personalTax|total|scaleTax|childReduction|ifd\.tax$|^capital\./,
  wealthItems: (icc) => [...icc.wealth.items, icc.wealth.socialDeduction],
  rows(r) {
    const out: ViewRow[] = [];
    if (r.icc) {
      out.push({
        id: 'icc',
        label: { en: 'Cantonal and communal tax (ICC)', fr: 'Impôt cantonal et communal (ICC)' },
        line: r.icc.taxes.total,
      });
    }
    if (r.ifd) {
      out.push({
        id: 'ifd',
        label: { en: 'Federal direct tax (IFD)', fr: 'Impôt fédéral direct (IFD)' },
        line: r.ifd.tax,
      });
    }
    return out;
  },
  parts(r) {
    const x = r.icc?.taxes;
    if (!x) return [];
    return [
      {
        id: 'income',
        label: { en: 'Cantonal tax on income', fr: 'Impôt cantonal sur le revenu' },
        line: x.incomeCantonal,
      },
      {
        id: 'wealth',
        label: { en: 'Cantonal tax on wealth', fr: 'Impôt cantonal sur la fortune' },
        line: x.wealthCantonal,
      },
      {
        id: 'communal',
        label: { en: 'Communal tax', fr: 'Impôt communal' },
        line: {
          ...x.communalIncomeTotal,
          amount: x.communalIncomeTotal.amount + x.communalWealthTotal.amount,
        },
      },
      {
        id: 'personal',
        label: { en: 'Personal tax (taxe personnelle)', fr: 'Taxe personnelle' },
        line: x.personalTax,
      },
    ];
  },
  lastYear: compareWithLastYear,
  // The tax on pension capital (98.12): a tax of its own, apart from the return's total. Its rows
  // stand with the return's own, so each says it is not in the total.
  capital(r) {
    const c = r.capital;
    if (!c) return undefined;
    const rows: ViewRow[] = [];
    if (c.icc) {
      rows.push({
        id: 'capital.icc',
        label: {
          en: 'Pension capital, cantonal and communal tax (not in the total)',
          fr: 'Prestations en capital, impôt cantonal et communal (non compris dans le total)',
        },
        line: c.icc.tax,
      });
    }
    if (c.ifd) {
      rows.push({
        id: 'capital.ifd',
        label: {
          en: 'Pension capital, federal direct tax (not in the total)',
          fr: 'Prestations en capital, impôt fédéral direct (non compris dans le total)',
        },
        line: c.ifd.tax,
      });
    }
    return {
      amount: {
        id: 'capital.amount',
        label: {
          en: 'Pension capital of the year (prestations en capital du 2e et 3e pilier A, 98.12)',
          fr: 'Prestations en capital du 2e et 3e pilier A (98.12)',
        },
        line: c.amount,
      },
      rows,
      total: c.total
        ? {
            id: 'capital.total',
            label: {
              en: 'Tax on pension capital, taxed apart',
              fr: 'Impôt sur les prestations en capital, imposées à part',
            },
            line: c.total,
          }
        : null,
    };
  },
  allLines,
  // The income tax: cantonal (base, centimes, 12 % reduction, home care) plus communal, and federal;
  // the wealth tax and the taxe personnelle don't change with a deduction.
  incomeTax(r) {
    if (!r.icc || !r.ifd) return undefined;
    const cantonal = r.icc.taxes.incomeCantonal.amount + r.icc.taxes.communalIncomeTotal.amount;
    const federal = r.ifd.tax.amount;
    return {
      cantonalCentimes: cantonal,
      federalCentimes: federal,
      totalCentimes: cantonal + federal,
    };
  },
};
