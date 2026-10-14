// How a Vaud result reads (packages/rules-ch, view.ts): the cantonal and communal tax (impôt
// cantonal et communal: the cantonal base tax on income and wealth, the LRIPP reduction of the
// cantonal income tax, the cantonal coefficient and the commune's rate) and the federal tax of the
// guide's worksheet, with the official French terms of the Vaud return. The extension's generic
// views (compute_tax, the estimate card, the final check, the plans) read it; nothing is computed
// here.
import { chf, type ResultView, type Text, type ViewLine, type ViewRow } from '@taxpresso/rules-ch';
import { partsText } from './assess.js';
import { allLines } from './compute.js';
import type { VdTaxResult } from './types.js';

const LABEL = {
  icc: {
    en: 'Cantonal and communal tax (impôt cantonal et communal)',
    fr: 'Impôt cantonal et communal',
  },
  ifd: {
    en: 'Federal direct tax (impôt fédéral direct)',
    fr: 'Impôt fédéral direct',
  },
  cantonalIncome: {
    en: 'Cantonal tax on income (impôt cantonal sur le revenu)',
    fr: 'Impôt cantonal sur le revenu',
  },
  communalIncome: {
    en: 'Communal tax on income (impôt communal sur le revenu)',
    fr: 'Impôt communal sur le revenu',
  },
  cantonalWealth: {
    en: 'Cantonal tax on wealth (impôt cantonal sur la fortune)',
    fr: 'Impôt cantonal sur la fortune',
  },
  communalWealth: {
    en: 'Communal tax on wealth (impôt communal sur la fortune)',
    fr: 'Impôt communal sur la fortune',
  },
} satisfies Record<string, Text>;

/** A rate in hundredths of a percent, as the tables print it: 7850 is 78.5 %. */
const rate = (hundredths: number) => `${String(hundredths / 100)} %`;

/** Every computed line with a stable id, for the explanation tree. */
function lines(r: VdTaxResult): ViewLine[] {
  const out: ViewLine[] = [];
  const i = r.icc;
  if (i) {
    const x = i.taxes;
    out.push(
      { id: 'icc.grossIncome', line: i.grossIncome },
      { id: 'icc.netIncome', line: i.netIncome },
      { id: 'icc.incomeBeforeModest', line: i.incomeBeforeModest },
      { id: 'icc.intermediateIncome', line: i.intermediateIncome },
      { id: 'icc.taxableIncome', line: i.taxableIncome },
      { id: 'icc.rateIncome', line: i.rateIncome },
      { id: 'icc.wealth.grossWealth', line: i.wealth.grossWealth },
      { id: 'icc.wealth.taxableWealth', line: i.wealth.taxableWealth },
      { id: 'icc.incomeBase', line: x.incomeBase },
      { id: 'icc.incomeReduction', line: x.incomeReduction },
      { id: 'icc.cantonalIncome', line: x.cantonalIncome },
      { id: 'icc.communalIncome', line: x.communalIncome },
      { id: 'icc.wealthBase', line: x.wealthBase },
      { id: 'icc.cantonalWealth', line: x.cantonalWealth },
      { id: 'icc.communalWealth', line: x.communalWealth },
      { id: 'icc.total', line: x.total },
    );
  }
  const f = r.ifd;
  if (f) {
    out.push(
      { id: 'ifd.grossIncome', line: f.grossIncome },
      { id: 'ifd.intermediateIncome1', line: f.intermediateIncome1 },
      { id: 'ifd.intermediateIncome2', line: f.intermediateIncome2 },
      { id: 'ifd.netIncome', line: f.netIncome },
      { id: 'ifd.socialDeductions', line: f.socialDeductions },
      { id: 'ifd.taxableIncome', line: f.taxableIncome },
      { id: 'ifd.scaleIncome', line: f.scaleIncome },
      { id: 'ifd.scaleTax', line: f.scaleTax },
      { id: 'ifd.childReduction', line: f.childReduction },
      { id: 'ifd.tax', line: f.tax },
    );
  }
  return out;
}

export const view: ResultView<VdTaxResult> = {
  canton: 'VD',
  preview: true,
  german: false,
  where: (r) =>
    `canton of Vaud, commune ${r.commune.name} (communal rate ${rate(r.commune.rate)} of the cantonal base tax)`,
  previewNote: "Vaud is a preview: the rules the documents don't spell out are listed below.",
  cantonal(icc) {
    const x = icc.taxes;
    return [
      `Cantonal and communal tax (impôt cantonal et communal): ${chf(x.total.amount)} = on income, cantonal tax (impôt cantonal) ${chf(x.cantonalIncome.amount)} + communal tax (impôt communal) ${chf(x.communalIncome.amount)}; on wealth, cantonal ${chf(x.cantonalWealth.amount)} + communal ${chf(x.communalWealth.amount)}. Each is a percentage of the cantonal base tax (impôt cantonal de base) ${chf(x.incomeBase.amount)} on income, ${chf(x.wealthBase.amount)} on wealth; the cantonal tax on income after the reduction of the LRIPP (${chf(-x.incomeReduction.amount)}).`,
      `Taxable income (revenu imposable, 800) ${chf(icc.taxableIncome.amount)}, ${partsText(icc.parts)} parts (quotient familial, 810), rate-determining income (revenu déterminant pour le taux, 820) ${chf(icc.rateIncome.amount)}; taxable wealth (fortune imposable, 800) ${chf(icc.wealth.taxableWealth.amount)}.`,
    ];
  },
  federal: {
    name: 'Federal direct tax (impôt fédéral direct)',
    from: ", from the Vaud guide's worksheet for the federal tax",
  },
  mainItems: 'Main items, cantonal and communal tax',
  term: (i) => i.label.fr,
  structured: (icc) => ({
    total: icc.taxes.total.amount,
    cantonalIncome: icc.taxes.cantonalIncome.amount,
    communalIncome: icc.taxes.communalIncome.amount,
    cantonalWealth: icc.taxes.cantonalWealth.amount,
    communalWealth: icc.taxes.communalWealth.amount,
    incomeBaseTax: icc.taxes.incomeBase.amount,
    lrippReduction: icc.taxes.incomeReduction.amount,
    taxableIncome: icc.taxableIncome.amount,
    parts: icc.parts / 100,
    rateIncome: icc.rateIncome.amount,
    taxableWealth: icc.wealth.taxableWealth.amount,
  }),
  ifdCode: 'IFD',
  detailNote: " (IFD: the guide's worksheet for the federal tax)",
  lines,
  detailLines:
    /rateIncome|incomeBase|incomeReduction|cantonalIncome|communalIncome|wealthBase|cantonalWealth|communalWealth|icc\.total|intermediateIncome[12]|scaleTax|childReduction|ifd\.tax$/,
  wealthItems: (icc) => icc.wealth.items,
  rows(r) {
    const out: ViewRow[] = [];
    if (r.icc) out.push({ id: 'icc', label: LABEL.icc, line: r.icc.taxes.total });
    if (r.ifd) out.push({ id: 'ifd', label: LABEL.ifd, line: r.ifd.tax });
    return out;
  },
  parts(r) {
    const x = r.icc?.taxes;
    if (!x) return [];
    return [
      { id: 'cantonalIncome', label: LABEL.cantonalIncome, line: x.cantonalIncome },
      { id: 'communalIncome', label: LABEL.communalIncome, line: x.communalIncome },
      { id: 'cantonalWealth', label: LABEL.cantonalWealth, line: x.cantonalWealth },
      { id: 'communalWealth', label: LABEL.communalWealth, line: x.communalWealth },
    ];
  },
  allLines,
  // The income tax: the cantonal and the communal tax on income (the wealth taxes don't change with
  // a deduction from income), and the federal tax of the guide's worksheet.
  incomeTax(r) {
    if (!r.icc || !r.ifd) return undefined;
    const x = r.icc.taxes;
    const cantonal = x.cantonalIncome.amount + x.communalIncome.amount;
    const federal = r.ifd.tax.amount;
    return {
      cantonalCentimes: cantonal,
      federalCentimes: federal,
      totalCentimes: cantonal + federal,
    };
  },
};
