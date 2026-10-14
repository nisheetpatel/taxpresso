// How a Ticino result reads (packages/rules-ch, view.ts): the cantonal and communal tax (imposta
// cantonale e comunale: the tariffs give the cantonal base tax on income and on wealth, which the
// canton levies at its coefficient and the commune at its multiplier, plus the communal personal
// tax) and the federal tax the authority derives from the same return, with the official Italian
// terms of the Ticino return. Its content is Italian on an Italian page (`italian`). The extension's
// generic views (compute_tax, the estimate card, the final check, the plans) read it; nothing is
// computed here.
import { chf, type ResultView, type Text, type ViewLine, type ViewRow } from '@taxpresso/rules-ch';
import { allLines } from './compute.js';
import type { TiTaxResult } from './types.js';

const NB = String.fromCharCode(0xa0);

/** Hundredths of a percent as a percentage: 7750 -> "77.5 %". */
const pc = (hundredths: number) => `${hundredths / 100}${NB}%`;

const LABEL = {
  icc: {
    en: 'Cantonal and communal tax (imposta cantonale e comunale)',
    fr: 'Impôts cantonal et communal (imposta cantonale e comunale)',
    de: 'Kantons- und Gemeindesteuer (imposta cantonale e comunale)',
    it: 'Imposta cantonale e comunale',
  },
  ifd: {
    en: 'Federal direct tax (imposta federale diretta)',
    fr: 'Impôt fédéral direct (imposta federale diretta)',
    de: 'Direkte Bundessteuer (imposta federale diretta)',
    it: 'Imposta federale diretta',
  },
  cantonalIncome: {
    en: 'Cantonal tax on income (imposta cantonale sul reddito)',
    fr: 'Impôt cantonal sur le revenu (imposta cantonale sul reddito)',
    de: 'Kantonssteuer vom Einkommen (imposta cantonale sul reddito)',
    it: 'Imposta cantonale sul reddito',
  },
  communalIncome: {
    en: 'Communal tax on income (imposta comunale sul reddito)',
    fr: 'Impôt communal sur le revenu (imposta comunale sul reddito)',
    de: 'Gemeindesteuer vom Einkommen (imposta comunale sul reddito)',
    it: 'Imposta comunale sul reddito',
  },
  cantonalWealth: {
    en: 'Cantonal tax on wealth (imposta cantonale sulla sostanza)',
    fr: 'Impôt cantonal sur la fortune (imposta cantonale sulla sostanza)',
    de: 'Kantonssteuer vom Vermögen (imposta cantonale sulla sostanza)',
    it: 'Imposta cantonale sulla sostanza',
  },
  communalWealth: {
    en: 'Communal tax on wealth (imposta comunale sulla sostanza)',
    fr: 'Impôt communal sur la fortune (imposta comunale sulla sostanza)',
    de: 'Gemeindesteuer vom Vermögen (imposta comunale sulla sostanza)',
    it: 'Imposta comunale sulla sostanza',
  },
  personal: {
    en: 'Communal personal tax (imposta personale)',
    fr: 'Impôt personnel communal (imposta personale)',
    de: 'Personalsteuer der Gemeinde (imposta personale)',
    it: 'Imposta personale',
  },
} satisfies Record<string, Text>;

/** Every computed line with a stable id, for the explanation tree. */
function lines(r: TiTaxResult): ViewLine[] {
  const out: ViewLine[] = [];
  const i = r.icc;
  if (i) {
    const x = i.taxes;
    out.push(
      { id: 'icc.grossIncome', line: i.grossIncome },
      { id: 'icc.totalDeductions', line: i.totalDeductions },
      { id: 'icc.netIncome', line: i.netIncome },
      { id: 'icc.netIncome2', line: i.netIncome2 },
      { id: 'icc.netIncome3', line: i.netIncome3 },
      { id: 'icc.netIncome4', line: i.netIncome4 },
      { id: 'icc.taxableIncome', line: i.taxableIncome },
      { id: 'icc.wealth.grossWealth', line: i.wealth.grossWealth },
      { id: 'icc.wealth.netWealth', line: i.wealth.netWealth },
      { id: 'icc.wealth.taxableWealth', line: i.wealth.taxableWealth },
      { id: 'icc.incomeBase', line: x.incomeBase },
      { id: 'icc.wealthBase', line: x.wealthBase },
      { id: 'icc.cantonalIncome', line: x.cantonalIncome },
      { id: 'icc.communalIncome', line: x.communalIncome },
      { id: 'icc.cantonalWealth', line: x.cantonalWealth },
      { id: 'icc.communalWealth', line: x.communalWealth },
      { id: 'icc.personal', line: x.personal },
      { id: 'icc.total', line: x.total },
    );
  }
  const f = r.ifd;
  if (f) {
    out.push(
      { id: 'ifd.grossIncome', line: f.grossIncome },
      { id: 'ifd.totalDeductions', line: f.totalDeductions },
      { id: 'ifd.netIncome', line: f.netIncome },
      { id: 'ifd.netIncome2', line: f.netIncome2 },
      { id: 'ifd.netIncome3', line: f.netIncome3 },
      { id: 'ifd.netIncome4', line: f.netIncome4 },
      { id: 'ifd.taxableIncome', line: f.taxableIncome },
      { id: 'ifd.scaleIncome', line: f.scaleIncome },
      { id: 'ifd.scaleTax', line: f.scaleTax },
      { id: 'ifd.childReduction', line: f.childReduction },
      { id: 'ifd.tax', line: f.tax },
    );
  }
  return out;
}

export const view: ResultView<TiTaxResult> = {
  canton: 'TI',
  preview: true,
  german: false,
  italian: true,
  where: (r) =>
    `canton of Ticino, commune ${r.commune.name} (moltiplicatore ${pc(r.commune.rate)} of the cantonal base tax)`,
  previewNote: "Ticino is a preview: the rules the documents don't spell out are listed below.",
  cantonal(icc) {
    const x = icc.taxes;
    return [
      `Cantonal and communal tax (imposta cantonale e comunale): ${chf(x.total.amount)} = cantonal tax on income (imposta cantonale) ${chf(x.cantonalIncome.amount)} + communal tax on income (imposta comunale) ${chf(x.communalIncome.amount)} + cantonal tax on wealth ${chf(x.cantonalWealth.amount)} + communal tax on wealth ${chf(x.communalWealth.amount)} + communal personal tax (imposta personale) ${chf(x.personal.amount)}. The canton's and the commune's are their coefficient and multiplier of the cantonal base tax (imposta cantonale base): on income ${chf(x.incomeBase.amount)}, on wealth ${chf(x.wealthBase.amount)}.`,
      `Taxable income (reddito imponibile) ${chf(icc.taxableIncome.amount)}, ${icc.incomeTariff === 'family' ? 'the family tariff (LT art. 35 cpv. 2)' : 'the tariff for single people (LT art. 35 cpv. 1)'}; taxable wealth (sostanza imponibile) ${chf(icc.wealth.taxableWealth.amount)}. No church tax: the canton's documents give none for natural persons.`,
    ];
  },
  federal: {
    name: 'Federal direct tax (imposta federale diretta)',
    from: ', which the authority derives from the same return (Tabella di confronto delle deduzioni)',
  },
  mainItems: 'Main items, cantonal and communal tax',
  term: (i) => i.label.it ?? i.label.en,
  structured: (icc) => ({
    total: icc.taxes.total.amount,
    incomeBase: icc.taxes.incomeBase.amount,
    wealthBase: icc.taxes.wealthBase.amount,
    cantonalIncome: icc.taxes.cantonalIncome.amount,
    communalIncome: icc.taxes.communalIncome.amount,
    cantonalWealth: icc.taxes.cantonalWealth.amount,
    communalWealth: icc.taxes.communalWealth.amount,
    personal: icc.taxes.personal.amount,
    taxableIncome: icc.taxableIncome.amount,
    taxableWealth: icc.wealth.taxableWealth.amount,
    incomeTariff: icc.incomeTariff,
  }),
  ifdCode: 'IFD',
  detailNote: ' (IFD: the federal tax, on the same lines with the federal amounts)',
  lines,
  detailLines:
    /Base$|cantonal(Income|Wealth)$|communal(Income|Wealth)$|personal$|total$|scaleTax|ifd\.tax$/,
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
      { id: 'personal', label: LABEL.personal, line: x.personal },
    ];
  },
  allLines,
  // The income tax: the cantonal and communal tax on income (the personal tax doesn't change with
  // income), and the federal tax.
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
