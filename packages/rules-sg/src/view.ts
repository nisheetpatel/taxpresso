// How a St. Gallen result reads (packages/rules-ch, view.ts): the cantonal, communal and church tax
// (Kantons-, Gemeinde- und Kirchensteuer: the tariff gives the einfache Steuer on income and on
// wealth, which the canton and the political commune levy at their Steuerfuss, and the church at its
// own on request) and the federal tax the tax office derives from the same return, with the official
// German terms of the St. Gallen return. The extension's generic views (compute_tax, the estimate
// card, the final check, the plans) read it; nothing is computed here.
import { chf, type ResultView, type Text, type ViewLine, type ViewRow } from '@taxpresso/rules-ch';
import { pc } from './assess.js';
import { allLines } from './compute.js';
import type { SgTaxResult } from './types.js';

const LABEL = {
  icc: {
    en: 'Cantonal, communal and church tax (Kantons-, Gemeinde- und Kirchensteuer)',
    fr: 'Impôts cantonal, communal et ecclésiastique (Kantons-, Gemeinde- und Kirchensteuer)',
    de: 'Kantons-, Gemeinde- und Kirchensteuer',
  },
  ifd: {
    en: 'Federal direct tax (direkte Bundessteuer)',
    fr: 'Impôt fédéral direct (direkte Bundessteuer)',
    de: 'Direkte Bundessteuer',
  },
  cantonalIncome: {
    en: 'Cantonal tax on income (Kantonssteuer vom Einkommen)',
    fr: 'Impôt cantonal sur le revenu (Kantonssteuer vom Einkommen)',
    de: 'Kantonssteuer vom Einkommen',
  },
  communalIncome: {
    en: 'Communal tax on income (Gemeindesteuer vom Einkommen)',
    fr: 'Impôt communal sur le revenu (Gemeindesteuer vom Einkommen)',
    de: 'Gemeindesteuer vom Einkommen',
  },
  cantonalWealth: {
    en: 'Cantonal tax on wealth (Kantonssteuer vom Vermögen)',
    fr: 'Impôt cantonal sur la fortune (Kantonssteuer vom Vermögen)',
    de: 'Kantonssteuer vom Vermögen',
  },
  communalWealth: {
    en: 'Communal tax on wealth (Gemeindesteuer vom Vermögen)',
    fr: 'Impôt communal sur la fortune (Gemeindesteuer vom Vermögen)',
    de: 'Gemeindesteuer vom Vermögen',
  },
  church: {
    en: 'Church tax (Kirchensteuer)',
    fr: 'Impôt ecclésiastique (Kirchensteuer)',
    de: 'Kirchensteuer',
  },
} satisfies Record<string, Text>;

/** Every computed line with a stable id, for the explanation tree. */
function lines(r: SgTaxResult): ViewLine[] {
  const out: ViewLine[] = [];
  const i = r.icc;
  if (i) {
    const x = i.taxes;
    out.push(
      { id: 'icc.grossIncome', line: i.grossIncome },
      { id: 'icc.totalDeductions', line: i.totalDeductions },
      { id: 'icc.netIncomeBase', line: i.netIncomeBase },
      { id: 'icc.netIncome', line: i.netIncome },
      { id: 'icc.taxableIncome', line: i.taxableIncome },
      { id: 'icc.rateIncome', line: i.rateIncome },
      { id: 'icc.wealth.grossWealth', line: i.wealth.grossWealth },
      { id: 'icc.wealth.netWealth', line: i.wealth.netWealth },
      { id: 'icc.wealth.taxableWealth', line: i.wealth.taxableWealth },
      { id: 'icc.simpleIncome', line: x.simpleIncome },
      { id: 'icc.simpleWealth', line: x.simpleWealth },
      { id: 'icc.cantonalIncome', line: x.cantonalIncome },
      { id: 'icc.communalIncome', line: x.communalIncome },
      { id: 'icc.cantonalWealth', line: x.cantonalWealth },
      { id: 'icc.communalWealth', line: x.communalWealth },
      ...(x.church ? [{ id: 'icc.church', line: x.church }] : []),
      { id: 'icc.total', line: x.total },
    );
  }
  const f = r.ifd;
  if (f) {
    out.push(
      { id: 'ifd.grossIncome', line: f.grossIncome },
      { id: 'ifd.totalDeductions', line: f.totalDeductions },
      { id: 'ifd.netIncomeBase', line: f.netIncomeBase },
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

export const view: ResultView<SgTaxResult> = {
  canton: 'SG',
  preview: true,
  german: true,
  where: (r) =>
    `canton of St. Gallen, commune ${r.commune.name} (Gesamtsteuerfuss ${pc(r.commune.rate, 'en')} of the simple tax)`,
  previewNote: "St. Gallen is a preview: the rules the documents don't spell out are listed below.",
  cantonal(icc) {
    const x = icc.taxes;
    return [
      `Cantonal, communal and church tax (Kantons-, Gemeinde- und Kirchensteuer): ${chf(x.total.amount)} = cantonal tax on income (Kantonssteuer) ${chf(x.cantonalIncome.amount)} + communal tax on income (Gemeindesteuer) ${chf(x.communalIncome.amount)} + cantonal tax on wealth ${chf(x.cantonalWealth.amount)} + communal tax on wealth ${chf(x.communalWealth.amount)}${x.church ? ` + church tax (Kirchensteuer) ${chf(x.church.amount)}` : ''}. Each is its Steuerfuss of the simple tax (einfache Steuer): on income ${chf(x.simpleIncome.amount)}, on wealth ${chf(x.simpleWealth.amount)}.`,
      `Taxable income (steuerbares Einkommen) ${chf(icc.taxableIncome.amount)}, ${icc.splitting ? 'Vollsplitting (the rate of half the income, married couples and single parents)' : 'the rate of the whole income'}; taxable wealth (steuerbares Vermögen) ${chf(icc.wealth.taxableWealth.amount)}.`,
      ...(x.church
        ? []
        : ['No church tax (Kirchensteuer): no one said they are a member of a church.']),
    ];
  },
  federal: {
    name: 'Federal direct tax (direkte Bundessteuer)',
    from: ', which the tax office derives from the same return (Merkblatt 32)',
  },
  mainItems: 'Main items, cantonal and communal tax',
  term: (i) => i.label.de ?? i.label.en,
  structured: (icc) => ({
    total: icc.taxes.total.amount,
    simpleIncome: icc.taxes.simpleIncome.amount,
    simpleWealth: icc.taxes.simpleWealth.amount,
    cantonalIncome: icc.taxes.cantonalIncome.amount,
    communalIncome: icc.taxes.communalIncome.amount,
    cantonalWealth: icc.taxes.cantonalWealth.amount,
    communalWealth: icc.taxes.communalWealth.amount,
    church: icc.taxes.church?.amount ?? null,
    taxableIncome: icc.taxableIncome.amount,
    taxableWealth: icc.wealth.taxableWealth.amount,
    splitting: icc.splitting,
  }),
  ifdCode: 'DBSt',
  detailNote: ' (DBSt: the federal tax, on the same lines with the federal amounts)',
  lines,
  detailLines: /simple|cantonal|communal|church|total$|scaleTax|ifd\.tax$/,
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
    const wealth = x.cantonalWealth.amount > 0 || x.communalWealth.amount > 0;
    return [
      { id: 'cantonalIncome', label: LABEL.cantonalIncome, line: x.cantonalIncome },
      { id: 'communalIncome', label: LABEL.communalIncome, line: x.communalIncome },
      ...(wealth
        ? [
            { id: 'cantonalWealth', label: LABEL.cantonalWealth, line: x.cantonalWealth },
            { id: 'communalWealth', label: LABEL.communalWealth, line: x.communalWealth },
          ]
        : []),
      ...(x.church ? [{ id: 'church', label: LABEL.church, line: x.church }] : []),
    ];
  },
  allLines,
  // The income tax: the cantonal and communal tax on income and the church tax (on the simple tax
  // of income and wealth: the plans change only its income part), and the federal tax.
  incomeTax(r) {
    if (!r.icc || !r.ifd) return undefined;
    const x = r.icc.taxes;
    const cantonal = x.cantonalIncome.amount + x.communalIncome.amount + (x.church?.amount ?? 0);
    const federal = r.ifd.tax.amount;
    return {
      cantonalCentimes: cantonal,
      federalCentimes: federal,
      totalCentimes: cantonal + federal,
    };
  },
};
