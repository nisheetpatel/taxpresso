// The tax estimate, for Claude (compute_tax) and for the dashboard ("Your estimate"). Every figure
// comes from the rules engine (@taxpresso/rules-ge, with the federal tax and the shared shapes of
// @taxpresso/rules-ch, SPEC.md section 7); nothing is computed here.
// Concise by default (C6), the explanation tree with `detail`.
import type { Lang } from '@taxpresso/questionnaire';
import { chf, type Item, type Line, type Text } from '@taxpresso/rules-ch';
import { compareWithLastYear, type LastYearRow, type TaxResult } from '@taxpresso/rules-ge';
import { zurichEstimateView, zurichTaxOutput } from './estimate-zh.js';
import type { Workspace } from './workspace.js';

const WHO: Record<string, Text> = {
  p1: { en: 'you', fr: 'vous' },
  p2: { en: 'your spouse', fr: 'votre conjoint' },
  household: { en: 'household', fr: 'ménage' },
};

/** The largest items first, at most `n`, shown in the order of the form. */
function mainItems(items: readonly Item[], n: number): Item[] {
  const top = [...items].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, n);
  return items.filter((i) => top.includes(i));
}

const flags = (line: Line) => ({
  ...(line.estimates?.length ? { estimate: true } : {}),
  ...(line.needsOk ? { needsOk: true } : {}),
});

function itemOut(i: Item) {
  return {
    code: i.code,
    person: i.person,
    amount: i.amount,
    label: i.label.fr,
    how: i.how.en,
    sources: i.sources,
    ...flags(i),
  };
}

function lineOut(id: string, l: Line) {
  return {
    id,
    amount: l.amount,
    label: l.label.en,
    how: l.how.en,
    sources: l.sources,
    ...flags(l),
  };
}

/** Every computed line of a result with a stable id, for the explanation tree. */
function lines(r: TaxResult): ReturnType<typeof lineOut>[] {
  const out: ReturnType<typeof lineOut>[] = [];
  if (r.icc) {
    const i = r.icc;
    const x = i.taxes;
    const named: [string, Line][] = [
      ['icc.grossIncome', i.grossIncome],
      ['icc.subtotal9220', i.subtotal9220],
      ['icc.subtotal9240', i.subtotal9240],
      ['icc.netIncome', i.netIncome],
      ['icc.taxableIncome', i.taxableIncome],
      ['icc.rateIncome', i.rateIncome],
      ['icc.wealth.grossWealth', i.wealth.grossWealth],
      ['icc.wealth.netWealth', i.wealth.netWealth],
      ['icc.wealth.taxableWealth', i.wealth.taxableWealth],
      ['icc.incomeBase', x.incomeBase],
      ['icc.incomeCantonalCentimes', x.incomeCantonalCentimes],
      ['icc.incomeReduction12', x.incomeReduction12],
      ['icc.incomeHomeCare', x.incomeHomeCare],
      ['icc.incomeCantonal', x.incomeCantonal],
      ['icc.wealthBase', x.wealthBase],
      ['icc.wealthCantonalCentimes', x.wealthCantonalCentimes],
      ['icc.wealthHomeCare', x.wealthHomeCare],
      ['icc.wealthSupplementary', x.wealthSupplementary],
      ['icc.wealthCantonal', x.wealthCantonal],
      ['icc.communal.privileged.base', x.communalIncome.privileged.base],
      ['icc.communal.privileged.tax', x.communalIncome.privileged.tax],
      ...x.communalIncome.rest.flatMap((s): [string, Line][] => [
        [`icc.communal.${s.commune}.base`, s.base],
        [`icc.communal.${s.commune}.tax`, s.tax],
      ]),
      ['icc.communalIncome', x.communalIncomeTotal],
      ['icc.communalWealth', x.communalWealthTotal],
      ['icc.personalTax', x.personalTax],
      ['icc.total', x.total],
    ];
    if (i.credits.withholdingTax)
      named.push(['icc.credit.withholdingTax', i.credits.withholdingTax]);
    out.push(...named.map(([id, l]) => lineOut(id, l)));
  }
  if (r.ifd) {
    const f = r.ifd;
    const named: [string, Line][] = [
      ['ifd.grossIncome', f.grossIncome],
      ['ifd.subtotal9220', f.subtotal9220],
      ['ifd.subtotal9240', f.subtotal9240],
      ['ifd.netIncome', f.netIncome],
      ['ifd.taxableIncome', f.taxableIncome],
      ['ifd.scaleIncome', f.scaleIncome],
      ['ifd.scaleTax', f.scaleTax],
      ['ifd.childReduction', f.childReduction],
      ['ifd.tax', f.tax],
    ];
    out.push(...named.map(([id, l]) => lineOut(id, l)));
  }
  return out;
}

const en = (list: readonly Text[]) => list.map((x) => x.en);

const PERSON: Record<LastYearRow['person'], Text> = {
  A: { en: 'you', fr: 'vous' },
  B: { en: 'your spouse', fr: 'votre conjoint' },
  household: { en: 'household', fr: 'ménage' },
};

/** "CHF 7'258.00" or "-" when a column is not there. */
const money = (n: number | undefined) => (n === undefined ? '-' : chf(n));

/** One row of the comparison, in plain words, for Claude. */
function lastYearText(x: LastYearRow): string {
  const col = (k: 'icc' | 'ifd', name: string) =>
    x.lastYear[k] === undefined && x.thisYear[k] === undefined
      ? ''
      : `${name} ${money(x.lastYear[k])} last year, ${money(x.thisYear[k])} now`;
  const cols = [col('icc', 'ICC'), col('ifd', 'IFD')].filter(Boolean).join('; ');
  return `${x.code} ${x.official} (${PERSON[x.person].en}): ${cols}${x.lastYearNeedsOk ? ' [last year read, not checked by the user]' : ''}${x.thisYearProvisional ? ' [this year not final]' : ''}`;
}

/** compute_tax: text for Claude and the structured result. */
export function computeTaxOutput(ws: Workspace, detail: boolean) {
  const e = ws.estimate();
  if (e.canton === 'ZH') return zurichTaxOutput(ws, e, detail);
  const { result: r, missing, notes } = e;
  const notSupported = ws.engine.notSupported(ws.snapshot()).map((n) => n.what.en);
  if (!r) {
    const text = `No tax computed yet: Taxpresso needs ${missing.map((m) => m.en).join(' and ')}. Ask with next_questions.`;
    return {
      text,
      structured: { taxYear: ws.config.taxYear, computed: false, missing: en(missing) } as Record<
        string,
        unknown
      >,
    };
  }
  const icc = r.icc;
  const ifd = r.ifd;
  const say: string[] = [];
  const estimated = r.estimates.length > 0;
  say.push(
    `Tax year ${r.taxYear}, commune ${r.commune}. ${estimated ? 'An estimate: see "Estimates" below.' : 'From official values only.'}`,
  );
  if (icc) {
    const x = icc.taxes;
    say.push(
      `Cantonal and communal tax (ICC): ${chf(x.total.amount)} = cantonal income tax ${chf(x.incomeCantonal.amount)} + cantonal wealth tax ${chf(x.wealthCantonal.amount)} + communal tax ${chf(x.communalIncomeTotal.amount + x.communalWealthTotal.amount)} + taxe personnelle ${chf(x.personalTax.amount)}.`,
      `ICC taxable income (revenu imposable) ${chf(icc.taxableIncome.amount)}, rate income (revenu déterminant le taux) ${chf(icc.rateIncome.amount)} (${icc.splitting === 'none' ? 'no splitting' : `${icc.splitting} splitting`}); taxable wealth (fortune imposable) ${chf(icc.wealth.taxableWealth.amount)}.`,
    );
    if (icc.credits.withholdingTax) {
      say.push(
        `Swiss withholding tax to be credited (impôt anticipé): ${chf(icc.credits.withholdingTax.amount)}, not part of the tax.`,
      );
    }
  }
  if (ifd) {
    say.push(
      `Federal direct tax (IFD): ${chf(ifd.tax.amount)}, on a taxable income of ${chf(ifd.taxableIncome.amount)} (${ifd.scale} scale).`,
    );
  }
  if (r.total !== null) say.push(`Total: ${chf(r.total)}.`);
  const items = icc ? mainItems(icc.items, 8) : [];
  if (items.length) {
    say.push(
      `Main ICC items: ${items.map((i) => `${i.code} ${i.label.fr} (${WHO[i.person]?.en ?? i.person}) ${chf(i.amount)}${i.estimates?.length ? ' [estimate]' : ''}${i.needsOk ? " [needs the user's OK]" : ''}`).join('; ')}.`,
    );
  }
  const lastYear = compareWithLastYear(r, ws.countedFacts());
  if (lastYear.length) {
    say.push(
      'Compared with last year (read from last year’s declaration; comparison only, never part of this year’s calculation):',
      ...lastYear.map((x) => `- ${lastYearText(x)}`),
    );
  }
  if (r.estimates.length) say.push(`Estimates: ${r.estimates.map((e) => e.what.en).join(' ')}`);
  if (!r.complete) {
    say.push(
      `Not final: some amounts are known only in part, so these taxes are at least what is shown. ${en(r.incomplete).join(' ')}`,
    );
  }
  if (r.needsOk) {
    say.push(
      `${r.needsOk} item${r.needsOk === 1 ? '' : 's'} rest on values that still need the user's OK (dashboard, Documents).`,
    );
  }
  if (r.unsupported.length) say.push(`Not computed: ${en(r.unsupported).join(' ')}`);
  if (notSupported.length) {
    say.push(`Not supported yet, so left out: ${notSupported.join('; ')}.`);
  }
  if (r.notCounted.length) say.push(`Not counted: ${en(r.notCounted).join(' ')}`);
  if (r.assumptions.length || notes.length) {
    say.push(`Assumptions: ${[...en(r.assumptions), ...en(notes)].join(' ')}`);
  }
  if (r.unverifiedRules.length) {
    say.push(`Rules the documents don't spell out: ${en(r.unverifiedRules).join(' ')}`);
  }
  const structured: Record<string, unknown> = {
    taxYear: r.taxYear,
    commune: r.commune,
    computed: true,
    missing: [],
    total: r.total,
    icc: icc && {
      total: icc.taxes.total.amount,
      cantonalIncome: icc.taxes.incomeCantonal.amount,
      cantonalWealth: icc.taxes.wealthCantonal.amount,
      communal: icc.taxes.communalIncomeTotal.amount + icc.taxes.communalWealthTotal.amount,
      personalTax: icc.taxes.personalTax.amount,
      taxableIncome: icc.taxableIncome.amount,
      rateIncome: icc.rateIncome.amount,
      splitting: icc.splitting,
      taxableWealth: icc.wealth.taxableWealth.amount,
      ...(icc.credits.withholdingTax
        ? { withholdingTaxCredit: icc.credits.withholdingTax.amount }
        : {}),
    },
    ifd: ifd && { tax: ifd.tax.amount, taxableIncome: ifd.taxableIncome.amount, scale: ifd.scale },
    estimates: r.estimates.map((e) => e.what.en),
    needsOk: r.needsOk,
    notCounted: en(r.notCounted),
    assumptions: [...en(r.assumptions), ...en(notes)],
    unsupported: en(r.unsupported),
    notSupported,
    unverifiedRules: en(r.unverifiedRules),
    complete: r.complete,
    ...(r.incomplete.length ? { incomplete: en(r.incomplete) } : {}),
    ...(lastYear.length
      ? {
          lastYear: lastYear.map((x) => ({
            code: x.code,
            form: x.form,
            person: x.person,
            label: x.official,
            lastYear: x.lastYear,
            thisYear: x.thisYear,
            change: x.change,
            lastYearNeedsOk: x.lastYearNeedsOk,
            thisYearProvisional: x.thisYearProvisional,
          })),
        }
      : {}),
  };
  if (detail) {
    structured.detail = {
      iccItems: (icc?.items ?? []).map(itemOut),
      wealthItems: icc ? [...icc.wealth.items, icc.wealth.socialDeduction].map(itemOut) : [],
      ifdItems: (ifd?.items ?? []).map(itemOut),
      lines: lines(r),
    };
    const all = [
      ...(icc ? [...icc.items, ...icc.wealth.items, icc.wealth.socialDeduction] : []),
      ...(ifd ? ifd.items.map((i) => ({ ...i, code: `IFD ${i.code}` })) : []),
    ];
    say.push(
      'Detail, each item with how it was computed and its source:',
      ...all.map(
        (i) =>
          `- ${i.code} ${i.label.fr} (${WHO[i.person]?.en ?? i.person}): ${chf(i.amount)}. ${i.how.en} [${i.sources.join('; ')}]`,
      ),
      ...lines(r)
        .filter((l) =>
          /incomeBase|Cantonal|Reduction|HomeCare|Supplementary|privileged|personalTax|total|scaleTax|childReduction|ifd\.tax$/.test(
            l.id,
          ),
        )
        .map((l) => `- ${l.label}: ${chf(l.amount)}. ${l.how} [${l.sources.join('; ')}]`),
    );
  } else {
    say.push(
      'For how each figure was computed and its source, call compute_tax with detail: true.',
    );
  }
  return { text: say.join('\n'), structured };
}

/** "Your estimate" in the dashboard, in the UI language. */
export function estimateView(ws: Workspace, lang: Lang) {
  const e = ws.estimate();
  if (e.canton === 'ZH') return zurichEstimateView(ws, e, lang);
  return genevaEstimateView(ws, e, lang);
}

/** Geneva's "Your estimate" (and what is missing while there is no canton). */
function genevaEstimateView(
  ws: Workspace,
  e: { result: TaxResult | null; missing: Text[] },
  lang: Lang,
) {
  const { result: r, missing } = e;
  if (!r) return { computed: false as const, missing: missing.map((m) => m[lang]) };
  const icc = r.icc;
  const ifd = r.ifd;
  const row = (id: string, label: Text, line: Line | undefined) =>
    line && {
      id,
      label: label[lang],
      amount: line.amount,
      estimate: Boolean(line.estimates?.length),
      needsOk: Boolean(line.needsOk),
    };
  return {
    computed: true as const,
    taxYear: r.taxYear,
    total: r.total,
    estimate: r.estimates.length > 0,
    rows: [
      row(
        'icc',
        { en: 'Cantonal and communal tax (ICC)', fr: 'Impôt cantonal et communal (ICC)' },
        icc?.taxes.total,
      ),
      row('ifd', { en: 'Federal direct tax (IFD)', fr: 'Impôt fédéral direct (IFD)' }, ifd?.tax),
    ].filter((x) => x !== undefined),
    parts: icc
      ? [
          row(
            'income',
            { en: 'Cantonal tax on income', fr: 'Impôt cantonal sur le revenu' },
            icc.taxes.incomeCantonal,
          ),
          row(
            'wealth',
            { en: 'Cantonal tax on wealth', fr: 'Impôt cantonal sur la fortune' },
            icc.taxes.wealthCantonal,
          ),
          row(
            'communal',
            { en: 'Communal tax', fr: 'Impôt communal' },
            {
              ...icc.taxes.communalIncomeTotal,
              amount: icc.taxes.communalIncomeTotal.amount + icc.taxes.communalWealthTotal.amount,
            },
          ),
          row(
            'personal',
            { en: 'Personal tax (taxe personnelle)', fr: 'Taxe personnelle' },
            icc.taxes.personalTax,
          ),
        ].filter((x) => x !== undefined)
      : [],
    taxable: {
      icc: icc?.taxableIncome.amount ?? null,
      ifd: ifd?.taxableIncome.amount ?? null,
      wealth: icc?.wealth.taxableWealth.amount ?? null,
    },
    items: (icc ? mainItems(icc.items, 8) : []).map((i) => ({
      code: i.code,
      label: i.label[lang],
      who:
        r.icc && i.person !== 'household' && ws.snapshot().people.length > 1
          ? (WHO[i.person]?.[lang] ?? '')
          : '',
      amount: i.amount,
      how: i.how[lang],
      estimate: Boolean(i.estimates?.length),
      needsOk: Boolean(i.needsOk),
    })),
    estimates: r.estimates.map((e) => e.what[lang]),
    needsOk: r.needsOk,
    notes: [...r.unsupported, ...r.incomplete, ...r.notCounted].map((n) => n[lang]),
    complete: r.complete,
    lastYear: compareWithLastYear(r, ws.countedFacts()).map((x) => ({
      code: x.code,
      label: x.label[lang],
      official: x.official,
      who:
        ws.snapshot().people.length > 1 && x.person !== 'household' ? PERSON[x.person][lang] : '',
      lastYear: x.lastYear,
      thisYear: x.thisYear,
      provisional: x.lastYearNeedsOk || x.thisYearProvisional,
    })),
  };
}

export type EstimateView = ReturnType<typeof estimateView>;
