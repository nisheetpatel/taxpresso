// How a Bern result reads (packages/rules-ch, view.ts): the cantonal, communal and church tax
// (Kantons-, Gemeinde- und Kirchensteuern, each a multiple of the einfache Steuer, the church tax on
// request, the cut of the maximum burden) and the federal tax of TaxMe's federal summary, with the
// official German terms of the Bern return. The extension's generic views (compute_tax, the
// estimate card, the final check, the plans) read it; nothing is computed here.
import { chf, type ResultView, type Text, type ViewLine, type ViewRow } from '@taxpresso/rules-ch';
import { allLines } from './compute.js';
import type { BeTaxResult } from './types.js';

const TARIFF: Record<'married' | 'other', string> = {
  married: 'tariff for married couples and single parents (Art. 42 Abs. 1)',
  other: 'tariff for everyone else (Art. 42 Abs. 2)',
};

const LABEL = {
  icc: {
    en: 'Cantonal, communal and church tax (Kantons-, Gemeinde- und Kirchensteuern)',
    fr: 'Impôts cantonal, communal et paroissial (Kantons-, Gemeinde- und Kirchensteuern)',
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
    fr: 'Impôt paroissial (Kirchensteuer)',
    de: 'Kirchensteuer',
  },
  wealthCap: {
    en: 'Cut by the maximum burden (Höchstbelastung)',
    fr: 'Réduction pour charge maximale (Höchstbelastung)',
    de: 'Kürzung durch die Höchstbelastung',
  },
} satisfies Record<string, Text>;

/** A multiple of the einfache Steuer, as the tables print it: 15400 ten-thousandths is 1.54. */
const anlage = (rate: number) => String(rate / 10_000);

/** Every computed line with a stable id, for the explanation tree. */
function lines(r: BeTaxResult): ViewLine[] {
  const out: ViewLine[] = [];
  const i = r.icc;
  if (i) {
    const x = i.taxes;
    out.push(
      { id: 'icc.grossIncome', line: i.grossIncome },
      { id: 'icc.totalDeductions', line: i.totalDeductions },
      { id: 'icc.netIncome', line: i.netIncome },
      { id: 'icc.personalDeductions', line: i.personalDeductions },
      { id: 'icc.taxableIncome', line: i.taxableIncome },
      { id: 'icc.wealth.grossWealth', line: i.wealth.grossWealth },
      { id: 'icc.wealth.taxableWealth', line: i.wealth.taxableWealth },
      { id: 'icc.simpleIncome', line: x.simpleIncome },
      { id: 'icc.simpleWealth', line: x.simpleWealth },
      { id: 'icc.simple', line: x.simple },
      { id: 'icc.cantonal', line: x.cantonal },
      { id: 'icc.communal', line: x.communal },
      ...(x.church ? [{ id: 'icc.church', line: x.church }] : []),
      ...(x.wealthCap ? [{ id: 'icc.wealthCap', line: x.wealthCap }] : []),
      { id: 'icc.total', line: x.total },
    );
  }
  const f = r.ifd;
  if (f) {
    out.push(
      { id: 'ifd.grossIncome', line: f.grossIncome },
      { id: 'ifd.totalDeductions', line: f.totalDeductions },
      { id: 'ifd.netIncome', line: f.netIncome },
      { id: 'ifd.personalDeductions', line: f.personalDeductions },
      { id: 'ifd.taxableIncome', line: f.taxableIncome },
      { id: 'ifd.scaleIncome', line: f.scaleIncome },
      { id: 'ifd.scaleTax', line: f.scaleTax },
      { id: 'ifd.childReduction', line: f.childReduction },
      { id: 'ifd.tax', line: f.tax },
    );
  }
  return out;
}

export const view: ResultView<BeTaxResult> = {
  canton: 'BE',
  preview: true,
  german: true,
  where: (r) =>
    `canton of Bern, commune ${r.commune.name} (BFS ${r.commune.bfs}, Steueranlage ${anlage(r.commune.rate)})`,
  previewNote: "Bern is a preview: the rules the documents don't spell out are listed below.",
  cantonal(icc) {
    const x = icc.taxes;
    return [
      `Cantonal, communal and church tax (Kantons-, Gemeinde- und Kirchensteuern): ${chf(x.total.amount)} = cantonal tax (Kantonssteuer) ${chf(x.cantonal.amount)} + communal tax (Gemeindesteuer) ${chf(x.communal.amount)}${x.church ? ` + church tax (Kirchensteuer) ${chf(x.church.amount)}` : ''}${x.wealthCap ? ` - cut by the maximum burden (Höchstbelastung) ${chf(-x.wealthCap.amount)}` : ''}. Each is a multiple (Steueranlage) of the simple tax (einfache Steuer) ${chf(x.simple.amount)}.`,
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
    from: ", from TaxMe's federal summary of the Bern return",
  },
  mainItems: 'Main items, cantonal column',
  term: (i) => i.label.de ?? i.label.en,
  structured: (icc) => ({
    total: icc.taxes.total.amount,
    simpleTax: icc.taxes.simple.amount,
    cantonal: icc.taxes.cantonal.amount,
    communal: icc.taxes.communal.amount,
    church: icc.taxes.church?.amount ?? null,
    wealthCap: icc.taxes.wealthCap?.amount ?? null,
    taxableIncome: icc.taxableIncome.amount,
    taxableWealth: icc.wealth.taxableWealth.amount,
    tariff: icc.tariff,
  }),
  ifdCode: 'Bund',
  detailNote: " (Bund: TaxMe's federal summary)",
  lines,
  detailLines: /simple|cantonal|communal|church|wealthCap|total|scaleTax|childReduction|ifd\.tax$/,
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
      ...(x.wealthCap ? [{ id: 'wealthCap', label: LABEL.wealthCap, line: x.wealthCap }] : []),
    ];
  },
  allLines,
  // The income tax: cantonal, communal and church tax (each a multiple of the einfache Steuer, on
  // income when there is no wealth), and the federal tax of TaxMe's federal summary.
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
