// How a Fribourg result reads (packages/rules-ch, view.ts): the cantonal, communal and church tax
// (impôts cantonal, communal et ecclésiastique: the cantonal base tax on income and wealth, which
// the canton's coefficient, the commune's and the parish's multiply) and the federal tax the tax
// office derives from the return, with the official French terms of the Fribourg return. Fribourg
// is bilingual: the taxes' names are in German too. The extension's generic views (compute_tax,
// the estimate card, the final check, the plans) read it; nothing is computed here.
import { chf, type ResultView, type Text, type ViewLine, type ViewRow } from '@taxpresso/rules-ch';
import { pc } from './assess.js';
import { allLines } from './compute.js';
import type { FrTaxResult } from './types.js';

const LABEL = {
  icc: {
    en: 'Cantonal and communal tax (impôts cantonal et communal)',
    fr: 'Impôts cantonal et communal',
    de: 'Kantons- und Gemeindesteuern (impôts cantonal et communal)',
  },
  ifd: {
    en: 'Federal direct tax (impôt fédéral direct)',
    fr: 'Impôt fédéral direct',
    de: 'Direkte Bundessteuer (impôt fédéral direct)',
  },
  cantonalIncome: {
    en: 'Cantonal tax on income (impôt cantonal sur le revenu)',
    fr: 'Impôt cantonal sur le revenu',
    de: 'Kantonssteuer auf dem Einkommen (impôt cantonal sur le revenu)',
  },
  communalIncome: {
    en: 'Communal tax on income (impôt communal sur le revenu)',
    fr: 'Impôt communal sur le revenu',
    de: 'Gemeindesteuer auf dem Einkommen (impôt communal sur le revenu)',
  },
  cantonalWealth: {
    en: 'Cantonal tax on wealth (impôt cantonal sur la fortune)',
    fr: 'Impôt cantonal sur la fortune',
    de: 'Kantonssteuer auf dem Vermögen (impôt cantonal sur la fortune)',
  },
  communalWealth: {
    en: 'Communal tax on wealth (impôt communal sur la fortune)',
    fr: 'Impôt communal sur la fortune',
    de: 'Gemeindesteuer auf dem Vermögen (impôt communal sur la fortune)',
  },
  churchIncome: {
    en: 'Church tax on income (impôt ecclésiastique sur le revenu)',
    fr: 'Impôt ecclésiastique sur le revenu',
    de: 'Kirchensteuer auf dem Einkommen (impôt ecclésiastique sur le revenu)',
  },
  churchWealth: {
    en: 'Church tax on wealth (impôt ecclésiastique sur la fortune)',
    fr: 'Impôt ecclésiastique sur la fortune',
    de: 'Kirchensteuer auf dem Vermögen (impôt ecclésiastique sur la fortune)',
  },
} satisfies Record<string, Text>;

/** Every computed line with a stable id, for the explanation tree. */
function lines(r: FrTaxResult): ViewLine[] {
  const out: ViewLine[] = [];
  const i = r.icc;
  const f = r.form;
  if (i) {
    const x = i.taxes;
    out.push(
      { id: 'icc.grossIncome', line: i.grossIncome },
      { id: 'icc.netIncome', line: i.netIncome },
      { id: 'icc.incomeAfterCosts', line: i.incomeAfterCosts },
      { id: 'icc.socialIncome', line: i.socialIncome },
      { id: 'icc.taxableIncome', line: i.taxableIncome },
      { id: 'icc.rateIncome', line: i.rateIncome },
      { id: 'icc.wealth.grossWealth', line: i.wealth.grossWealth },
      { id: 'icc.wealth.netWealth', line: i.wealth.netWealth },
      { id: 'icc.wealth.taxableWealth', line: i.wealth.taxableWealth },
      { id: 'icc.incomeBase', line: x.incomeBase },
      { id: 'icc.cantonalIncome', line: x.cantonalIncome },
      { id: 'icc.communalIncome', line: x.communalIncome },
      { id: 'icc.wealthBase', line: x.wealthBase },
      { id: 'icc.cantonalWealth', line: x.cantonalWealth },
      { id: 'icc.communalWealth', line: x.communalWealth },
      ...(x.churchIncome ? [{ id: 'icc.churchIncome', line: x.churchIncome }] : []),
      ...(x.churchWealth ? [{ id: 'icc.churchWealth', line: x.churchWealth }] : []),
      { id: 'icc.total', line: x.total },
    );
  } else if (f) {
    // The return's lines without the taxes (2026, no communal coefficients yet).
    out.push(
      { id: 'form.grossIncome', line: f.grossIncome },
      { id: 'form.netIncome', line: f.netIncome },
      { id: 'form.incomeAfterCosts', line: f.incomeAfterCosts },
      { id: 'form.socialIncome', line: f.socialIncome },
      { id: 'form.taxableIncome', line: f.taxableIncome },
      { id: 'form.wealth.grossWealth', line: f.wealth.grossWealth },
      { id: 'form.wealth.netWealth', line: f.wealth.netWealth },
      { id: 'form.wealth.taxableWealth', line: f.wealth.taxableWealth },
    );
  }
  const d = r.ifd;
  if (d) {
    out.push(
      { id: 'ifd.grossIncome', line: d.grossIncome },
      { id: 'ifd.incomeAfterDeductions', line: d.incomeAfterDeductions },
      { id: 'ifd.netIncome', line: d.netIncome },
      { id: 'ifd.taxableIncome', line: d.taxableIncome },
      { id: 'ifd.scaleIncome', line: d.scaleIncome },
      { id: 'ifd.scaleTax', line: d.scaleTax },
      { id: 'ifd.childReduction', line: d.childReduction },
      { id: 'ifd.tax', line: d.tax },
    );
  }
  return out;
}

export const view: ResultView<FrTaxResult> = {
  canton: 'FR',
  preview: true,
  german: true,
  where: (r) =>
    `canton of Fribourg, commune ${r.commune.name} (BFS ${r.commune.bfs}; ${
      r.commune.rate === null
        ? `its communal coefficient for ${r.taxYear} is not published yet`
        : `communal coefficient ${pc(r.commune.rate, 'en')} of the cantonal base tax`
    })`,
  previewNote: "Fribourg is a preview: the rules the documents don't spell out are listed below.",
  cantonal(icc) {
    const x = icc.taxes;
    const church =
      x.churchIncome && x.churchWealth
        ? `; church tax (impôt ecclésiastique) ${chf(x.churchIncome.amount)} on income and ${chf(x.churchWealth.amount)} on wealth`
        : '';
    return [
      `Cantonal and communal tax (impôts cantonal et communal): ${chf(x.total.amount)} = on income, cantonal tax (impôt cantonal) ${chf(x.cantonalIncome.amount)} + communal tax (impôt communal) ${chf(x.communalIncome.amount)}; on wealth, cantonal ${chf(x.cantonalWealth.amount)} + communal ${chf(x.communalWealth.amount)}${church}. Each is a percentage of the cantonal base tax (impôt cantonal de base) ${chf(x.incomeBase.amount)} on income, ${chf(x.wealthBase.amount)} on wealth.`,
      `Taxable income (revenu imposable, 7.910) ${chf(icc.taxableIncome.amount)}, ${icc.family ? 'at the rate of half the income (married couples and single parents)' : 'at the rate of the whole income'}; taxable wealth (fortune imposable, 7.910) ${chf(icc.wealth.taxableWealth.amount)}.`,
      ...(x.churchIncome
        ? []
        : [
            'No church tax (impôt ecclésiastique): no one said they are a member of a recognised church.',
          ]),
    ];
  },
  federal: {
    name: 'Federal direct tax (impôt fédéral direct)',
    from: ', as the tax office derives it from the return (the guide’s chapter XI)',
  },
  mainItems: 'Main items of the return',
  term: (i) => i.label.fr,
  structured: (icc) => ({
    total: icc.taxes.total.amount,
    cantonalIncome: icc.taxes.cantonalIncome.amount,
    communalIncome: icc.taxes.communalIncome.amount,
    cantonalWealth: icc.taxes.cantonalWealth.amount,
    communalWealth: icc.taxes.communalWealth.amount,
    church:
      icc.taxes.churchIncome && icc.taxes.churchWealth
        ? icc.taxes.churchIncome.amount + icc.taxes.churchWealth.amount
        : null,
    incomeBaseTax: icc.taxes.incomeBase.amount,
    wealthBaseTax: icc.taxes.wealthBase.amount,
    taxableIncome: icc.taxableIncome.amount,
    rateIncome: icc.rateIncome.amount,
    taxableWealth: icc.wealth.taxableWealth.amount,
  }),
  ifdCode: 'IFD',
  detailNote: ' (IFD: the federal tax, on the codes of the return)',
  lines,
  detailLines:
    /rateIncome|incomeBase|cantonalIncome|communalIncome|wealthBase|cantonalWealth|communalWealth|church|icc\.total|incomeAfterDeductions|scaleTax|childReduction|ifd\.tax$/,
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
      ...(x.churchIncome
        ? [{ id: 'churchIncome', label: LABEL.churchIncome, line: x.churchIncome }]
        : []),
      ...(x.churchWealth
        ? [{ id: 'churchWealth', label: LABEL.churchWealth, line: x.churchWealth }]
        : []),
    ];
  },
  allLines,
  // The income tax: the cantonal, communal and church tax on income (the wealth taxes don't change
  // with a deduction from income), and the federal tax.
  incomeTax(r) {
    if (!r.icc || !r.ifd) return undefined;
    const x = r.icc.taxes;
    const cantonal =
      x.cantonalIncome.amount + x.communalIncome.amount + (x.churchIncome?.amount ?? 0);
    const federal = r.ifd.tax.amount;
    return {
      cantonalCentimes: cantonal,
      federalCentimes: federal,
      totalCentimes: cantonal + federal,
    };
  },
};
