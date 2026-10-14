// How an Aargau result reads (packages/rules-ch, view.ts): the cantonal, communal and church tax
// (Kantons-, Gemeinde- und Kirchensteuern: the tariffs give the simple tax, einfache Steuer, on
// income and on wealth, which the canton, the commune and the church each levy at their Steuerfuss;
// the maximum burden, Höchstbelastung, may cut them) and the federal tax, computed with the federal
// rules since the Aargau return has no federal column (./ifd.ts), with the official German terms of
// the Aargau guide. The extension's generic views (compute_tax, the estimate card, the final check,
// the plans) read it; nothing is computed here.
import { chf, type ResultView, type Text, type ViewLine, type ViewRow } from '@taxpresso/rules-ch';
import { allLines } from './compute.js';
import type { AgTaxResult } from './types.js';

const LABEL = {
  icc: {
    en: 'Cantonal, communal and church tax (Kantons-, Gemeinde- und Kirchensteuern)',
    fr: 'Impôts cantonal, communal et ecclésiastique (Kantons-, Gemeinde- und Kirchensteuern)',
    de: 'Kantons-, Gemeinde- und Kirchensteuern',
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
  maxBurden: {
    en: 'Maximum burden cut (Höchstbelastung)',
    fr: 'Réduction pour charge maximale (Höchstbelastung)',
    de: 'Höchstbelastung',
  },
} satisfies Record<string, Text>;

/** "Tarif B (the rate of half the income: ...)" or "Tarif A". */
const TARIFF = {
  A: 'Tarif A',
  B: 'Tarif B (the rate of half the income: married couples, and parents living with a child they have the child deduction for)',
} as const;

/** Every computed line with a stable id, for the explanation tree. */
function lines(r: AgTaxResult): ViewLine[] {
  const out: ViewLine[] = [];
  const i = r.icc;
  if (i) {
    const x = i.taxes;
    out.push(
      { id: 'icc.grossIncome', line: i.grossIncome },
      { id: 'icc.totalDeductions', line: i.totalDeductions },
      { id: 'icc.netIncome', line: i.netIncome },
      { id: 'icc.socialDeductions', line: i.socialDeductions },
      { id: 'icc.afterSocial', line: i.afterSocial },
      { id: 'icc.taxableIncome', line: i.taxableIncome },
      { id: 'icc.wealth.grossWealth', line: i.wealth.grossWealth },
      { id: 'icc.wealth.taxableWealth', line: i.wealth.taxableWealth },
      { id: 'icc.simpleIncome', line: x.simpleIncome },
      { id: 'icc.simpleWealth', line: x.simpleWealth },
      { id: 'icc.simple', line: x.simple },
      { id: 'icc.cantonal', line: x.cantonal },
      { id: 'icc.communal', line: x.communal },
      ...(x.church ? [{ id: 'icc.church', line: x.church }] : []),
      ...(x.maxBurden ? [{ id: 'icc.maxBurden', line: x.maxBurden }] : []),
      { id: 'icc.total', line: x.total },
    );
  }
  const f = r.ifd;
  if (f) {
    out.push(
      { id: 'ifd.grossIncome', line: f.grossIncome },
      { id: 'ifd.totalDeductions', line: f.totalDeductions },
      { id: 'ifd.baseIncome', line: f.baseIncome },
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

export const view: ResultView<AgTaxResult> = {
  canton: 'AG',
  preview: true,
  german: true,
  where: (r) =>
    `canton of Aargau, commune ${r.commune.name} (Steuerfuss ${r.commune.rate} % of the simple tax)`,
  previewNote: "Aargau is a preview: the rules the documents don't spell out are listed below.",
  cantonal(icc) {
    const x = icc.taxes;
    return [
      `Cantonal, communal and church tax (Kantons-, Gemeinde- und Kirchensteuern): ${chf(x.total.amount)} = cantonal tax (Kantonssteuer) ${chf(x.cantonal.amount)} + communal tax (Gemeindesteuer) ${chf(x.communal.amount)}${x.church ? ` + church tax (Kirchensteuer) ${chf(x.church.amount)}` : ''}${x.maxBurden ? ` less the maximum burden cut (Höchstbelastung) ${chf(-x.maxBurden.amount)}` : ''}. Each is a percentage (Steuerfuss) of the simple tax (einfache Steuer) ${chf(x.simple.amount)}: on income ${chf(x.simpleIncome.amount)}, on wealth ${chf(x.simpleWealth.amount)}.`,
      `Taxable income (steuerbares Einkommen) ${chf(icc.taxableIncome.amount)}, ${TARIFF[icc.tariff]}; taxable wealth (steuerbares Vermögen) ${chf(icc.wealth.taxableWealth.amount)}.`,
      ...(x.church
        ? []
        : [
            'No church tax (Kirchensteuer): no one said they are a member of a church that levies it.',
          ]),
    ];
  },
  federal: {
    name: 'Federal direct tax (direkte Bundessteuer)',
    from: ', computed with the federal rules: the Aargau return has no federal column, the tax office puts the federal deductions in place of the cantonal ones',
  },
  mainItems: 'Main items of the Aargau return',
  term: (i) => i.label.de ?? i.label.en,
  structured: (icc) => ({
    total: icc.taxes.total.amount,
    cantonal: icc.taxes.cantonal.amount,
    communal: icc.taxes.communal.amount,
    church: icc.taxes.church?.amount ?? null,
    maxBurden: icc.taxes.maxBurden?.amount ?? null,
    simpleIncome: icc.taxes.simpleIncome.amount,
    simpleWealth: icc.taxes.simpleWealth.amount,
    taxableIncome: icc.taxableIncome.amount,
    taxableWealth: icc.wealth.taxableWealth.amount,
    tariff: icc.tariff,
  }),
  ifdCode: 'Bund',
  detailNote: ' (Bund: the federal tax, on the Aargau line of the same deduction)',
  lines,
  detailLines: /simple|cantonal|communal|church|maxBurden|total$|scaleTax|ifd\.tax$/,
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
      ...(x.maxBurden ? [{ id: 'maxBurden', label: LABEL.maxBurden, line: x.maxBurden }] : []),
    ];
  },
  allLines,
  // The cantonal, communal and church tax and the federal tax. The canton, the commune and the
  // church levy one percentage of the simple tax on income and wealth together (StG § 2), so the
  // cantonal part is the whole of it: the wealth part doesn't change with a deduction, and what the
  // plans compare is the difference.
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
