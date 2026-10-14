// How a Zug result reads (packages/rules-ch, view.ts): the cantonal and communal tax with the church
// and Bürgergemeinde tax on request (Kantons- und Gemeindesteuern, Kirchensteuer, Bürgersteuer: the
// tariff gives the einfache Steuer on income and on wealth, and the canton, the commune, the parish
// and the Bürgergemeinde each levy their Steuerfuss of the two together) and the federal tax of form
// K's Bund column, with the official German terms of form K. The extension's generic views
// (compute_tax, the estimate card, the final check, the plans) read it; nothing is computed here.
import { chf, type ResultView, type Text, type ViewLine, type ViewRow } from '@taxpresso/rules-ch';
import { pc } from './assess.js';
import { allLines } from './compute.js';
import type { ZgTaxResult } from './types.js';

const LABEL = {
  // As form K heads its first column: the church and Bürgergemeinde tax are among its parts.
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
  cantonal: {
    en: 'Cantonal tax (Kantonssteuer)',
    fr: 'Impôt cantonal (Kantonssteuer)',
    de: 'Kantonssteuer',
  },
  communal: {
    en: 'Communal tax (Gemeindesteuer)',
    fr: 'Impôt communal (Gemeindesteuer)',
    de: 'Gemeindesteuer',
  },
  church: {
    en: 'Church tax (Kirchensteuer)',
    fr: 'Impôt ecclésiastique (Kirchensteuer)',
    de: 'Kirchensteuer',
  },
  citizens: {
    en: 'Bürgergemeinde tax (Bürgersteuer)',
    fr: 'Impôt de la bourgeoisie (Bürgersteuer)',
    de: 'Bürgersteuer',
  },
} satisfies Record<string, Text>;

/** Every computed line with a stable id, for the explanation tree. */
function lines(r: ZgTaxResult): ViewLine[] {
  const out: ViewLine[] = [];
  const i = r.icc;
  if (i) {
    const x = i.taxes;
    out.push(
      { id: 'icc.grossIncome', line: i.grossIncome },
      { id: 'icc.totalDeductions', line: i.totalDeductions },
      { id: 'icc.subtotal', line: i.subtotal },
      { id: 'icc.netIncome', line: i.netIncome },
      { id: 'icc.taxableIncome', line: i.taxableIncome },
      { id: 'icc.wealth.grossWealth', line: i.wealth.grossWealth },
      { id: 'icc.wealth.netWealth', line: i.wealth.netWealth },
      { id: 'icc.wealth.taxableWealth', line: i.wealth.taxableWealth },
      { id: 'icc.simpleIncome', line: x.simpleIncome },
      { id: 'icc.simpleWealth', line: x.simpleWealth },
      { id: 'icc.simple', line: x.simple },
      { id: 'icc.cantonal', line: x.cantonal },
      { id: 'icc.communal', line: x.communal },
      ...(x.church ? [{ id: 'icc.church', line: x.church }] : []),
      ...(x.citizens ? [{ id: 'icc.citizens', line: x.citizens }] : []),
      { id: 'icc.total', line: x.total },
    );
  }
  const f = r.ifd;
  if (f) {
    out.push(
      { id: 'ifd.grossIncome', line: f.grossIncome },
      { id: 'ifd.totalDeductions', line: f.totalDeductions },
      { id: 'ifd.subtotal', line: f.subtotal },
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

export const view: ResultView<ZgTaxResult> = {
  canton: 'ZG',
  preview: true,
  german: true,
  where: (r) =>
    `canton of Zug, commune ${r.commune.name} (Steuerfuss ${pc(r.commune.rate, 'en')} of the simple tax)`,
  previewNote: "Zug is a preview: the rules the documents don't spell out are listed below.",
  cantonal(icc) {
    const x = icc.taxes;
    const extras = [
      ...(x.church ? [` + church tax (Kirchensteuer) ${chf(x.church.amount)}`] : []),
      ...(x.citizens ? [` + Bürgergemeinde tax (Bürgersteuer) ${chf(x.citizens.amount)}`] : []),
    ].join('');
    return [
      `Cantonal and communal tax (Kantons- und Gemeindesteuern): ${chf(x.total.amount)} = cantonal tax (Kantonssteuer) ${chf(x.cantonal.amount)} + communal tax (Gemeindesteuer) ${chf(x.communal.amount)}${extras}. Each is its Steuerfuss of the simple tax (einfache Steuer) ${chf(x.simple.amount)}: on income ${chf(x.simpleIncome.amount)} and on wealth ${chf(x.simpleWealth.amount)}.`,
      `Taxable income (steuerbares Einkommen) ${chf(icc.taxableIncome.amount)}, ${icc.tariff === 'married' ? 'Mehrpersonentarif (married couples and single parents)' : 'Grundtarif'}; taxable wealth (steuerbares Gesamtvermögen) ${chf(icc.wealth.taxableWealth.amount)}.`,
      ...(x.church
        ? []
        : ['No church tax (Kirchensteuer): no one said they are a member of a parish.']),
      ...(x.citizens
        ? []
        : [
            'No Bürgergemeinde tax (Bürgersteuer): no one said they are an Ortsbürger of a Bürgergemeinde that levies it.',
          ]),
    ];
  },
  federal: {
    name: 'Federal direct tax (direkte Bundessteuer)',
    from: ', from the Bund column of form K',
  },
  mainItems: 'Main items, Kanton column',
  term: (i) => i.label.de ?? i.label.en,
  structured: (icc) => ({
    total: icc.taxes.total.amount,
    simple: icc.taxes.simple.amount,
    cantonal: icc.taxes.cantonal.amount,
    communal: icc.taxes.communal.amount,
    church: icc.taxes.church?.amount ?? null,
    citizens: icc.taxes.citizens?.amount ?? null,
    taxableIncome: icc.taxableIncome.amount,
    taxableWealth: icc.wealth.taxableWealth.amount,
    tariff: icc.tariff,
  }),
  ifdCode: 'Bund',
  detailNote: ' (Bund: the Bund column of form K)',
  lines,
  detailLines: /simple|cantonal|communal|church|citizens|total$|scaleTax|ifd\.tax$/,
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
      { id: 'cantonal', label: LABEL.cantonal, line: x.cantonal },
      { id: 'communal', label: LABEL.communal, line: x.communal },
      ...(x.church ? [{ id: 'church', label: LABEL.church, line: x.church }] : []),
      ...(x.citizens ? [{ id: 'citizens', label: LABEL.citizens, line: x.citizens }] : []),
    ];
  },
  allLines,
  // The income tax: every levy on the simple tax (the plans run without wealth, so it is the simple
  // tax on income), and the federal tax of the Bund column.
  incomeTax(r) {
    if (!r.icc || !r.ifd) return undefined;
    const cantonal = r.icc.taxes.total.amount;
    const federal = r.ifd.tax.amount;
    return {
      cantonalCentimes: cantonal,
      federalCentimes: federal,
      totalCentimes: cantonal + federal,
    };
  },
};
