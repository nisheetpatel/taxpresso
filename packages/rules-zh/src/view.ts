// How a Zurich result reads (packages/rules-ch, view.ts): the cantonal and communal tax (Staats- und
// Gemeindesteuern, church tax on request, Personalsteuer) and the federal tax of its Bundessteuer
// column, with the official German terms of the Zurich return. The extension's generic views
// (compute_tax, the estimate card, the final check, the plans) read it; nothing is computed here.
import { chf, type ResultView, type Text, type ViewLine, type ViewRow } from '@taxpresso/rules-ch';
import { allLines } from './compute.js';
import type { ZhTaxResult } from './types.js';

const TARIFF: Record<'basic' | 'married', string> = {
  basic: 'basic tariff (Grundtarif)',
  married: 'married tariff (Verheiratetentarif)',
};

const LABEL = {
  icc: {
    en: 'Cantonal and communal tax (Staats- und Gemeindesteuern)',
    fr: 'Impôt cantonal et communal (Staats- und Gemeindesteuern)',
    de: 'Staats- und Gemeindesteuern',
  },
  ifd: {
    en: 'Federal direct tax (direkte Bundessteuer)',
    fr: 'Impôt fédéral direct (direkte Bundessteuer)',
    de: 'Direkte Bundessteuer',
  },
  cantonal: {
    en: 'Cantonal tax (Staatssteuer)',
    fr: 'Impôt cantonal (Staatssteuer)',
    de: 'Staatssteuer',
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
  personal: {
    en: 'Personal tax (Personalsteuer)',
    fr: 'Taxe personnelle (Personalsteuer)',
    de: 'Personalsteuer',
  },
} satisfies Record<string, Text>;

/** Every computed line with a stable id, for the explanation tree. */
function lines(r: ZhTaxResult): ViewLine[] {
  const out: ViewLine[] = [];
  const i = r.icc;
  if (i) {
    const x = i.taxes;
    out.push(
      { id: 'icc.grossIncome', line: i.grossIncome },
      { id: 'icc.totalDeductions', line: i.totalDeductions },
      { id: 'icc.subtotal310', line: i.subtotal310 },
      { id: 'icc.netIncome', line: i.netIncome },
      { id: 'icc.taxableIncome', line: i.taxableIncome },
      { id: 'icc.wealth.grossWealth', line: i.wealth.grossWealth },
      { id: 'icc.wealth.taxableWealth', line: i.wealth.taxableWealth },
      { id: 'icc.simpleIncome', line: x.simpleIncome },
      { id: 'icc.simpleWealth', line: x.simpleWealth },
      { id: 'icc.simple', line: x.simple },
      { id: 'icc.cantonal', line: x.cantonal },
      { id: 'icc.communal', line: x.communal },
      ...(x.church ? [{ id: 'icc.church', line: x.church }] : []),
      { id: 'icc.personalTax', line: x.personalTax },
      { id: 'icc.total', line: x.total },
    );
  }
  const f = r.ifd;
  if (f) {
    out.push(
      { id: 'ifd.grossIncome', line: f.grossIncome },
      { id: 'ifd.totalDeductions', line: f.totalDeductions },
      { id: 'ifd.subtotal310', line: f.subtotal310 },
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

export const view: ResultView<ZhTaxResult> = {
  canton: 'ZH',
  preview: true,
  german: true,
  where: (r) =>
    `canton of Zurich, commune ${r.commune.name} (BFS ${r.commune.bfs}${r.commune.rate !== null ? `, Steuerfuss ${r.commune.rate} %` : ''})`,
  previewNote: "Zurich is a preview: the rules the documents don't spell out are listed below.",
  cantonal(icc) {
    const x = icc.taxes;
    return [
      `Cantonal and communal tax (Staats- und Gemeindesteuern): ${chf(x.total.amount)} = cantonal tax (Staatssteuer) ${chf(x.cantonal.amount)} + communal tax (Gemeindesteuer) ${chf(x.communal.amount)}${x.church ? ` + church tax (Kirchensteuer) ${chf(x.church.amount)}` : ''} + personal tax (Personalsteuer) ${chf(x.personalTax.amount)}. Each is a percentage (Steuerfuss) of the simple tax (einfache Staatssteuer) ${chf(x.simple.amount)}.`,
      `Taxable income (steuerbares Einkommen, 390) ${chf(icc.taxableIncome.amount)}, ${TARIFF[icc.tariff]}; taxable wealth (steuerbares Vermögen, 490) ${chf(icc.wealth.taxableWealth.amount)}.`,
      ...(x.church
        ? []
        : [
            'No church tax (Kirchensteuer): no one said they are a member of a church that levies it.',
          ]),
    ];
  },
  federal: {
    name: 'Federal direct tax (direkte Bundessteuer)',
    from: ', from the Bundessteuer column of the Zurich return',
  },
  mainItems: 'Main items, cantonal column',
  term: (i) => i.label.de ?? i.label.en,
  structured: (icc) => ({
    total: icc.taxes.total.amount,
    simpleTax: icc.taxes.simple.amount,
    cantonal: icc.taxes.cantonal.amount,
    communal: icc.taxes.communal.amount,
    church: icc.taxes.church?.amount ?? null,
    personalTax: icc.taxes.personalTax.amount,
    taxableIncome: icc.taxableIncome.amount,
    taxableWealth: icc.wealth.taxableWealth.amount,
    tariff: icc.tariff,
  }),
  ifdCode: 'Bund',
  detailNote: ' (Bund: the Bundessteuer column)',
  lines,
  detailLines:
    /simple|cantonal|communal|church|personalTax|total|scaleTax|childReduction|ifd\.tax$/,
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
      { id: 'personal', label: LABEL.personal, line: x.personalTax },
    ];
  },
  allLines,
  // The income tax: cantonal, communal and church tax (the simple tax times each multiplier), and
  // the federal tax of the Bundessteuer column.
  incomeTax(r) {
    if (!r.icc || !r.ifd) return undefined;
    const x = r.icc.taxes;
    const cantonal = x.cantonal.amount + x.communal.amount + (x.church?.amount ?? 0);
    const federal = r.ifd.tax.amount;
    return {
      cantonalCentimes: cantonal,
      federalCentimes: federal,
      totalCentimes: cantonal + federal,
    };
  },
};
