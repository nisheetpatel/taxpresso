// How a Lucerne result reads (packages/rules-ch, view.ts): the state, communal and church tax and
// the Personalsteuer (Staats-, Gemeinde- und Kirchensteuern: the tariffs give the tax per unit,
// Steuer je Einheit, on income and on wealth, and the state, the commune and the parish of a church
// member each levy so many units of it; the Personalsteuer is added) and the federal tax as the
// canton's Ergänzungsblatt Direkte Bundessteuer derives it from the return, with the official German
// terms of the Lucerne return. The extension's generic views (compute_tax, the estimate card, the
// final check, the plans) read it; nothing is computed here.
import { chf, type ResultView, type Text, type ViewLine, type ViewRow } from '@taxpresso/rules-ch';
import { units } from './assess.js';
import { allLines } from './compute.js';
import type { LuTaxResult } from './types.js';

const LABEL = {
  // As the return heads its tax: the church tax and the Personalsteuer are among its parts.
  icc: {
    en: 'State and communal tax (Staats- und Gemeindesteuern)',
    fr: 'Impôts cantonal et communal (Staats- und Gemeindesteuern)',
    de: 'Staats- und Gemeindesteuern',
  },
  ifd: {
    en: 'Federal direct tax (direkte Bundessteuer)',
    fr: 'Impôt fédéral direct (direkte Bundessteuer)',
    de: 'Direkte Bundessteuer',
  },
  cantonal: {
    en: 'State tax (Staatssteuer)',
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
  incomeCap: {
    en: 'Maximum burden on income (Höchstbelastung)',
    fr: 'Charge maximale sur le revenu (Höchstbelastung)',
    de: 'Höchstbelastung Einkommen',
  },
  wealthCap: {
    en: 'Maximum burden on wealth (Höchstbelastung)',
    fr: 'Charge maximale sur la fortune (Höchstbelastung)',
    de: 'Höchstbelastung Vermögen',
  },
  personal: {
    en: 'Personal tax (Personalsteuer)',
    fr: 'Impôt personnel (Personalsteuer)',
    de: 'Personalsteuer',
  },
} satisfies Record<string, Text>;

/** Every computed line with a stable id, for the explanation tree. */
function lines(r: LuTaxResult): ViewLine[] {
  const out: ViewLine[] = [];
  const i = r.icc;
  if (i) {
    const x = i.taxes;
    out.push(
      { id: 'icc.grossIncome', line: i.grossIncome },
      { id: 'icc.totalDeductions', line: i.totalDeductions },
      { id: 'icc.incomeAfterDeductions', line: i.incomeAfterDeductions },
      { id: 'icc.additionalDeductions', line: i.additionalDeductions },
      { id: 'icc.netIncome', line: i.netIncome },
      { id: 'icc.socialDeductions', line: i.socialDeductions },
      { id: 'icc.taxableIncome', line: i.taxableIncome },
      { id: 'icc.wealth.grossWealth', line: i.wealth.grossWealth },
      { id: 'icc.wealth.netWealth', line: i.wealth.netWealth },
      { id: 'icc.wealth.taxableWealth', line: i.wealth.taxableWealth },
      { id: 'icc.incomePerUnit', line: x.incomePerUnit },
      { id: 'icc.wealthPerUnit', line: x.wealthPerUnit },
      { id: 'icc.perUnit', line: x.perUnit },
      { id: 'icc.cantonal', line: x.cantonal },
      { id: 'icc.communal', line: x.communal },
      ...(x.church ? [{ id: 'icc.church', line: x.church }] : []),
      ...(x.incomeCap ? [{ id: 'icc.incomeCap', line: x.incomeCap }] : []),
      ...(x.wealthCap ? [{ id: 'icc.wealthCap', line: x.wealthCap }] : []),
      { id: 'icc.personal', line: x.personal },
      { id: 'icc.total', line: x.total },
    );
  }
  const f = r.ifd;
  if (f) {
    out.push(
      { id: 'ifd.grossIncome', line: f.grossIncome },
      { id: 'ifd.subtotal', line: f.subtotal },
      { id: 'ifd.incomeAfterDeductions', line: f.incomeAfterDeductions },
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

export const view: ResultView<LuTaxResult> = {
  canton: 'LU',
  preview: true,
  german: true,
  where: (r) =>
    `canton of Lucerne, commune ${r.commune.name} (it levies ${units(r.commune.rate)} units, Einheiten, of the tax per unit)`,
  previewNote: "Lucerne is a preview: the rules the documents don't spell out are listed below.",
  cantonal(icc) {
    const x = icc.taxes;
    const caps = [x.incomeCap, x.wealthCap]
      .filter((c) => c !== null)
      .map((c) => ` less the maximum burden (Höchstbelastung) ${chf(-c.amount)}`)
      .join('');
    return [
      `State and communal tax (Staats- und Gemeindesteuern): ${chf(x.total.amount)} = state tax (Staatssteuer) ${chf(x.cantonal.amount)} + communal tax (Gemeindesteuer) ${chf(x.communal.amount)}${x.church ? ` + church tax (Kirchensteuer) ${chf(x.church.amount)}` : ''}${caps} + personal tax (Personalsteuer) ${chf(x.personal.amount)}. The state, the commune and the parish each levy so many units of the tax per unit (Steuer je Einheit) ${chf(x.perUnit.amount)}: on income ${chf(x.incomePerUnit.amount)} and on wealth ${chf(x.wealthPerUnit.amount)}.`,
      `Taxable income (steuerbares Einkommen) ${chf(icc.taxableIncome.amount)}, ${icc.tariff === 'family' ? 'family tariff (Familientarif, married couples and single parents)' : 'tariff for single persons (Tarif für Alleinstehende)'}; taxable wealth (steuerbares Vermögen) ${chf(icc.wealth.taxableWealth.amount)}.`,
      ...(x.church
        ? []
        : ['No church tax (Kirchensteuer): no one said they are a member of a recognised church.']),
    ];
  },
  federal: {
    name: 'Federal direct tax (direkte Bundessteuer)',
    from: ', from the return as the Ergänzungsblatt Direkte Bundessteuer derives it',
  },
  mainItems: 'Main items of the return',
  term: (i) => i.label.de ?? i.label.en,
  structured: (icc) => ({
    total: icc.taxes.total.amount,
    perUnit: icc.taxes.perUnit.amount,
    cantonal: icc.taxes.cantonal.amount,
    communal: icc.taxes.communal.amount,
    church: icc.taxes.church?.amount ?? null,
    personal: icc.taxes.personal.amount,
    maximumBurden: (icc.taxes.incomeCap?.amount ?? 0) + (icc.taxes.wealthCap?.amount ?? 0),
    taxableIncome: icc.taxableIncome.amount,
    taxableWealth: icc.wealth.taxableWealth.amount,
    tariff: icc.tariff,
  }),
  ifdCode: 'Ergänzungsblatt',
  detailNote: ' (Ergänzungsblatt: the Ergänzungsblatt Direkte Bundessteuer, E and its Ziffer)',
  lines,
  detailLines: /perUnit|cantonal|communal|church|Cap|personal|total$|scaleTax|ifd\.tax$/,
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
      ...(x.incomeCap ? [{ id: 'incomeCap', label: LABEL.incomeCap, line: x.incomeCap }] : []),
      ...(x.wealthCap ? [{ id: 'wealthCap', label: LABEL.wealthCap, line: x.wealthCap }] : []),
      { id: 'personal', label: LABEL.personal, line: x.personal },
    ];
  },
  allLines,
  // The income tax: the state, communal and church tax with the Personalsteuer (the plans compare
  // two results, so what doesn't depend on the income cancels out), and the federal tax.
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
