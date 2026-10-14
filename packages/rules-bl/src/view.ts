// How a Basel-Landschaft result reads (packages/rules-ch, view.ts): the state, communal and church
// tax (Staats-, Gemeinde- und Kirchensteuer: the tariff's tax less the child reduction is the normal
// state tax, which the canton and the commune levy at their Steuerfuss; the wealth tax likewise; the
// church tax on request) and the federal tax of the return's Bundessteuer column, with the official
// German terms of the Basel-Landschaft return. The extension's generic views (compute_tax, the
// estimate card, the final check, the plans) read it; nothing is computed here.
import { chf, type ResultView, type Text, type ViewLine, type ViewRow } from '@taxpresso/rules-ch';
import { pc, rateText } from './assess.js';
import { allLines } from './compute.js';
import type { BlTaxResult } from './types.js';

const LABEL = {
  icc: {
    en: 'State, communal and church tax (Staats-, Gemeinde- und Kirchensteuer)',
    fr: 'Impôts cantonal, communal et ecclésiastique (Staats-, Gemeinde- und Kirchensteuer)',
    de: 'Staats-, Gemeinde- und Kirchensteuer',
  },
  ifd: {
    en: 'Federal direct tax (direkte Bundessteuer)',
    fr: 'Impôt fédéral direct (direkte Bundessteuer)',
    de: 'Direkte Bundessteuer',
  },
  cantonalIncome: {
    en: 'State tax on income (Staatssteuer vom Einkommen)',
    fr: 'Impôt cantonal sur le revenu (Staatssteuer vom Einkommen)',
    de: 'Staatssteuer vom Einkommen',
  },
  communalIncome: {
    en: 'Communal tax on income (Gemeindesteuer vom Einkommen)',
    fr: 'Impôt communal sur le revenu (Gemeindesteuer vom Einkommen)',
    de: 'Gemeindesteuer vom Einkommen',
  },
  cantonalWealth: {
    en: 'State tax on wealth (Staatssteuer vom Vermögen)',
    fr: 'Impôt cantonal sur la fortune (Staatssteuer vom Vermögen)',
    de: 'Staatssteuer vom Vermögen',
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
function lines(r: BlTaxResult): ViewLine[] {
  const out: ViewLine[] = [];
  const i = r.icc;
  if (i) {
    const x = i.taxes;
    out.push(
      { id: 'icc.grossIncome', line: i.grossIncome },
      { id: 'icc.netIncome', line: i.netIncome },
      { id: 'icc.totalDeductions', line: i.totalDeductions },
      { id: 'icc.taxableIncome', line: i.taxableIncome },
      { id: 'icc.rateIncome', line: i.rateIncome },
      { id: 'icc.wealth.grossWealth', line: i.wealth.grossWealth },
      { id: 'icc.wealth.netWealth', line: i.wealth.netWealth },
      { id: 'icc.wealth.taxableWealth', line: i.wealth.taxableWealth },
      { id: 'icc.incomeTariffTax', line: x.incomeTariffTax },
      { id: 'icc.childReduction', line: x.childReduction },
      { id: 'icc.normalIncome', line: x.normalIncome },
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
      { id: 'ifd.netIncome', line: f.netIncome },
      { id: 'ifd.totalDeductions', line: f.totalDeductions },
      { id: 'ifd.taxableIncome', line: f.taxableIncome },
      { id: 'ifd.scaleIncome', line: f.scaleIncome },
      { id: 'ifd.scaleTax', line: f.scaleTax },
      { id: 'ifd.childReduction', line: f.childReduction },
      { id: 'ifd.tax', line: f.tax },
    );
  }
  return out;
}

export const view: ResultView<BlTaxResult> = {
  canton: 'BL',
  preview: true,
  german: true,
  where: (r) =>
    `canton of Basel-Landschaft, commune ${r.commune.name} (Steuerfuss ${pc(r.commune.rate, 'en')} of the state tax)`,
  previewNote:
    "Basel-Landschaft is a preview: the rules the documents don't spell out are listed below.",
  cantonal(icc) {
    const x = icc.taxes;
    return [
      `State, communal and church tax (Staats-, Gemeinde- und Kirchensteuer): ${chf(x.total.amount)} = state tax on income (Staatssteuer vom Einkommen) ${chf(x.cantonalIncome.amount)} + communal tax on income (Gemeindesteuer) ${chf(x.communalIncome.amount)} + state tax on wealth (Staatssteuer vom Vermögen) ${chf(x.cantonalWealth.amount)} + communal tax on wealth ${chf(x.communalWealth.amount)}${x.church ? ` + church tax (Kirchensteuer) ${chf(x.church.amount)}` : ''}. The canton and the commune levy their Steuerfuss on the normal state tax on income (normale Staatssteuer) ${chf(x.normalIncome.amount)}: the tariff's tax ${chf(x.incomeTariffTax.amount)} less the child reduction (Kinderabzug vom Steuerbetrag) ${chf(-x.childReduction.amount)}.`,
      `Taxable income (steuerbares Einkommen) ${chf(icc.taxableIncome.amount)}, ${icc.splitting ? 'Vollsplitting (the rate of half the income, married couples and single parents)' : 'the rate of the whole income'}, rate ${rateText(icc.rate, 'en')}; taxable wealth (steuerbares Vermögen) ${chf(icc.wealth.taxableWealth.amount)}.`,
      ...(x.church
        ? []
        : [
            'No church tax (Kirchensteuer): no one said they are a member of a church that levies it.',
          ]),
    ];
  },
  federal: {
    name: 'Federal direct tax (direkte Bundessteuer)',
    from: ', from the Bundessteuer column of the Basel-Landschaft return',
  },
  mainItems: 'Main items, Staatssteuer column',
  term: (i) => i.label.de ?? i.label.en,
  structured: (icc) => ({
    total: icc.taxes.total.amount,
    cantonalIncome: icc.taxes.cantonalIncome.amount,
    communalIncome: icc.taxes.communalIncome.amount,
    cantonalWealth: icc.taxes.cantonalWealth.amount,
    communalWealth: icc.taxes.communalWealth.amount,
    church: icc.taxes.church?.amount ?? null,
    childReduction: icc.taxes.childReduction.amount,
    taxableIncome: icc.taxableIncome.amount,
    taxableWealth: icc.wealth.taxableWealth.amount,
    splitting: icc.splitting,
  }),
  ifdCode: 'Bund',
  detailNote: ' (Bund: the Bundessteuer column)',
  lines,
  detailLines:
    /incomeTariffTax|childReduction|normalIncome|cantonal|communal|church|total$|scaleTax|ifd\.tax$/,
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
  // The income tax: the state and communal tax on income and the church tax (on the state tax),
  // and the federal tax of the Bundessteuer column.
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
