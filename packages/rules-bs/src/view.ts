// How a Basel-Stadt result reads (packages/rules-ch, view.ts): the cantonal and communal tax
// (Kantons- und Gemeindesteuern: in Basel the canton's whole tax, in Riehen and Bettingen the
// canton's share and the commune's tax, on income and on wealth) and the federal tax of the Bund
// column, with the official German terms of the Basel-Stadt return. The extension's generic views
// (compute_tax, the estimate card, the final check, the plans) read it; nothing is computed here.
import { chf, type ResultView, type Text, type ViewLine, type ViewRow } from '@taxpresso/rules-ch';
import { allLines } from './compute.js';
import type { BsTaxResult } from './types.js';

const LABEL = {
  icc: {
    en: 'Cantonal and communal tax (Kantons- und Gemeindesteuern)',
    fr: 'Impôts cantonal et communal (Kantons- und Gemeindesteuern)',
    de: 'Kantons- und Gemeindesteuern',
  },
  ifd: {
    en: 'Federal direct tax (direkte Bundessteuer)',
    fr: 'Impôt fédéral direct (direkte Bundessteuer)',
    de: 'Direkte Bundessteuer',
  },
  cantonalIncome: {
    en: 'Cantonal income tax (kantonale Einkommenssteuer)',
    fr: 'Impôt cantonal sur le revenu (kantonale Einkommenssteuer)',
    de: 'Kantonale Einkommenssteuer',
  },
  communalIncome: {
    en: 'Communal income tax (Gemeindesteuer auf dem Einkommen)',
    fr: 'Impôt communal sur le revenu (Gemeindesteuer auf dem Einkommen)',
    de: 'Gemeindesteuer auf dem Einkommen',
  },
  cantonalWealth: {
    en: 'Cantonal wealth tax (kantonale Vermögenssteuer)',
    fr: 'Impôt cantonal sur la fortune (kantonale Vermögenssteuer)',
    de: 'Kantonale Vermögenssteuer',
  },
  communalWealth: {
    en: 'Communal wealth tax (Gemeindesteuer auf dem Vermögen)',
    fr: 'Impôt communal sur la fortune (Gemeindesteuer auf dem Vermögen)',
    de: 'Gemeindesteuer auf dem Vermögen',
  },
} satisfies Record<string, Text>;

/** Hundredths of a percent as printed: 4000 is "40 %", 3750 "37.5 %". */
const pc = (hundredths: number) => `${hundredths / 100} %`;

/** Every computed line with a stable id, for the explanation tree. */
function lines(r: BsTaxResult): ViewLine[] {
  const out: ViewLine[] = [];
  const i = r.icc;
  if (i) {
    const x = i.taxes;
    out.push(
      { id: 'icc.grossIncome', line: i.grossIncome },
      { id: 'icc.netIncome', line: i.netIncome },
      { id: 'icc.pureIncome', line: i.pureIncome },
      { id: 'icc.taxableIncome', line: i.taxableIncome },
      { id: 'icc.wealth.grossWealth', line: i.wealth.grossWealth },
      { id: 'icc.wealth.netWealth', line: i.wealth.netWealth },
      { id: 'icc.wealth.taxableWealth', line: i.wealth.taxableWealth },
      { id: 'icc.incomeTariffTax', line: x.incomeTariffTax },
      { id: 'icc.cantonalIncome', line: x.cantonalIncome },
      { id: 'icc.communalIncome', line: x.communalIncome },
      { id: 'icc.wealthTariffTax', line: x.wealthTariffTax },
      { id: 'icc.wealthReduction', line: x.wealthReduction },
      { id: 'icc.cantonalWealth', line: x.cantonalWealth },
      { id: 'icc.communalWealth', line: x.communalWealth },
      { id: 'icc.total', line: x.total },
    );
  }
  const f = r.ifd;
  if (f) {
    out.push(
      { id: 'ifd.grossIncome', line: f.grossIncome },
      { id: 'ifd.totalDeductions', line: f.totalDeductions },
      { id: 'ifd.subtotal709', line: f.subtotal709 },
      { id: 'ifd.netIncome', line: f.netIncome },
      { id: 'ifd.taxableIncome', line: f.taxableIncome },
      { id: 'ifd.scaleIncome', line: f.scaleIncome },
      { id: 'ifd.scaleTax', line: f.scaleTax },
      { id: 'ifd.childReduction', line: f.childReduction },
      { id: 'ifd.tax', line: f.tax },
    );
  }
  return out;
}

export const view: ResultView<BsTaxResult> = {
  canton: 'BS',
  preview: true,
  german: true,
  where: (r) =>
    r.commune.rate
      ? `canton of Basel-Stadt, commune ${r.commune.name} (Gemeindesteuer ${pc(r.commune.rate)} of the tax under the law, the canton levying its share)`
      : `canton of Basel-Stadt, commune ${r.commune.name} (no communal tax: the canton levies the whole tax)`,
  previewNote:
    "Basel-Stadt is a preview: the rules the documents don't spell out are listed below.",
  cantonal(icc) {
    const x = icc.taxes;
    const communal = x.communalIncome.amount + x.communalWealth.amount;
    return [
      `Cantonal and communal tax (Kantons- und Gemeindesteuern): ${chf(x.total.amount)} = cantonal income tax (kantonale Einkommenssteuer) ${chf(x.cantonalIncome.amount)}${communal ? ` + communal income tax (Gemeindesteuer) ${chf(x.communalIncome.amount)}` : ''} + cantonal wealth tax (kantonale Vermögenssteuer) ${chf(x.cantonalWealth.amount)}${communal ? ` + communal wealth tax ${chf(x.communalWealth.amount)}` : ''}. The tariff gives an income tax of ${chf(x.incomeTariffTax.amount)} and a wealth tax of ${chf(x.wealthTariffTax.amount)}${x.wealthReduction.amount ? `, less ${chf(-x.wealthReduction.amount)} for a low income (StG § 51)` : ''}.`,
      `Taxable income (steuerbares Einkommen) ${chf(icc.taxableIncome.amount)}, tariff ${icc.incomeTariff}; taxable wealth (steuerbares Vermögen) ${chf(icc.wealth.taxableWealth.amount)}, tariff ${icc.wealth.tariff}.`,
    ];
  },
  federal: {
    name: 'Federal direct tax (direkte Bundessteuer)',
    from: ', from the Bund column of the Basel-Stadt return',
  },
  mainItems: 'Main items, Kanton column',
  term: (i) => i.label.de ?? i.label.en,
  structured: (icc) => ({
    total: icc.taxes.total.amount,
    incomeTariffTax: icc.taxes.incomeTariffTax.amount,
    cantonalIncome: icc.taxes.cantonalIncome.amount,
    communalIncome: icc.taxes.communalIncome.amount,
    wealthTariffTax: icc.taxes.wealthTariffTax.amount,
    wealthReduction: icc.taxes.wealthReduction.amount,
    cantonalWealth: icc.taxes.cantonalWealth.amount,
    communalWealth: icc.taxes.communalWealth.amount,
    taxableIncome: icc.taxableIncome.amount,
    taxableWealth: icc.wealth.taxableWealth.amount,
    incomeTariff: icc.incomeTariff,
    wealthTariff: icc.wealth.tariff,
  }),
  ifdCode: 'Bund',
  detailNote: ' (Bund: the Bund column)',
  lines,
  detailLines:
    /incomeTariffTax|cantonalIncome|communalIncome|wealthTariffTax|wealthReduction|cantonalWealth|communalWealth|icc\.total|scaleTax|childReduction|ifd\.tax$/,
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
    // Basel levies no communal tax: its communal lines are left out.
    const communal = r.commune.rate > 0;
    return [
      { id: 'cantonalIncome', label: LABEL.cantonalIncome, line: x.cantonalIncome },
      ...(communal
        ? [{ id: 'communalIncome', label: LABEL.communalIncome, line: x.communalIncome }]
        : []),
      { id: 'cantonalWealth', label: LABEL.cantonalWealth, line: x.cantonalWealth },
      ...(communal
        ? [{ id: 'communalWealth', label: LABEL.communalWealth, line: x.communalWealth }]
        : []),
    ];
  },
  allLines,
  // The income tax: the canton's and the commune's tax on income, and the federal tax of the Bund
  // column.
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
