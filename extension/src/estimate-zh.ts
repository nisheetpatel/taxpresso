// The Zurich tax, for Claude (compute_tax) and for the dashboard ("Your estimate"): every figure
// from Zurich's rules engine (@taxpresso/rules-zh), the cantonal and communal tax (Staats- und
// Gemeindesteuern, church tax on request, Personalsteuer) and the federal tax of its Bundessteuer
// column (packages/rules-ch); nothing is computed here. Concise by default (C6), with `detail` the
// explanation of every line. The same shapes as Geneva's (./estimate.ts), so the dashboard card and
// Claude read both alike.
import type { Lang } from '@taxpresso/questionnaire';
import { chf, type Item, type Line, type Text } from '@taxpresso/rules-ch';
import type { ZhTaxResult } from '@taxpresso/rules-zh';
import type { Workspace } from './workspace.js';

/** Text in the UI language; English where a text has no German yet. */
const say = (x: Text, lang: Lang | 'de') => (lang === 'de' ? (x.de ?? x.en) : x[lang]);

const WHO: Record<string, Text> = {
  p1: { en: 'you', fr: 'vous', de: 'du' },
  p2: { en: 'your spouse', fr: 'votre conjoint', de: 'dein Partner' },
  household: { en: 'household', fr: 'ménage', de: 'Haushalt' },
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

const en = (list: readonly Text[]) => list.map((x) => x.en);

/** The official German term of an item (Zurich's form), for Claude. */
const term = (i: Item) => i.label.de ?? i.label.en;

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
function lines(r: ZhTaxResult) {
  const out: { id: string; line: Line }[] = [];
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
  return out.map(({ id, line }) => ({
    id,
    amount: line.amount,
    label: line.label.en,
    how: line.how.en,
    sources: line.sources,
    ...flags(line),
  }));
}

function itemOut(i: Item) {
  return {
    code: i.code,
    person: i.person,
    amount: i.amount,
    label: term(i),
    how: i.how.en,
    sources: i.sources,
    ...flags(i),
  };
}

/** compute_tax for a Zurich return: text for Claude and the structured result. */
export function zurichTaxOutput(
  ws: Workspace,
  e: { result: ZhTaxResult | null; missing: Text[]; notes: Text[] },
  detail: boolean,
) {
  const { result: r, missing, notes } = e;
  const notSupported = ws.engine.notSupported(ws.snapshot()).map((n) => n.what.en);
  if (!r) {
    const text = `No tax computed yet: Taxpresso needs ${missing.map((m) => m.en).join(' and ')}. Ask with next_questions.`;
    return {
      text,
      structured: {
        taxYear: ws.config.taxYear,
        canton: 'ZH',
        computed: false,
        missing: en(missing),
      } as Record<string, unknown>,
    };
  }
  const icc = r.icc;
  const ifd = r.ifd;
  const out: string[] = [];
  const estimated = r.estimates.length > 0;
  out.push(
    `Tax year ${r.taxYear}, canton of Zurich, commune ${r.commune.name} (BFS ${r.commune.bfs}${r.commune.rate !== null ? `, Steuerfuss ${r.commune.rate} %` : ''}). ${estimated ? 'An estimate: see "Estimates" below.' : 'From official values only.'} Zurich is a preview: the rules the documents don't spell out are listed below.`,
  );
  if (icc) {
    const x = icc.taxes;
    out.push(
      `Cantonal and communal tax (Staats- und Gemeindesteuern): ${chf(x.total.amount)} = cantonal tax (Staatssteuer) ${chf(x.cantonal.amount)} + communal tax (Gemeindesteuer) ${chf(x.communal.amount)}${x.church ? ` + church tax (Kirchensteuer) ${chf(x.church.amount)}` : ''} + personal tax (Personalsteuer) ${chf(x.personalTax.amount)}. Each is a percentage (Steuerfuss) of the simple tax (einfache Staatssteuer) ${chf(x.simple.amount)}.`,
      `Taxable income (steuerbares Einkommen, 390) ${chf(icc.taxableIncome.amount)}, ${TARIFF[icc.tariff]}; taxable wealth (steuerbares Vermögen, 490) ${chf(icc.wealth.taxableWealth.amount)}.`,
    );
    if (!x.church) {
      out.push(
        'No church tax (Kirchensteuer): no one said they are a member of a church that levies it.',
      );
    }
  }
  if (ifd) {
    out.push(
      `Federal direct tax (direkte Bundessteuer): ${chf(ifd.tax.amount)}, on a taxable income of ${chf(ifd.taxableIncome.amount)} (${ifd.scale} scale), from the Bundessteuer column of the Zurich return.`,
    );
  }
  if (r.total !== null) out.push(`Total: ${chf(r.total)}.`);
  const items = icc ? mainItems(icc.items, 8) : [];
  if (items.length) {
    out.push(
      `Main items, cantonal column: ${items.map((i) => `${i.code} ${term(i)} (${WHO[i.person]?.en ?? i.person}) ${chf(i.amount)}${i.estimates?.length ? ' [estimate]' : ''}${i.needsOk ? " [needs the user's OK]" : ''}`).join('; ')}.`,
    );
  }
  if (r.estimates.length) out.push(`Estimates: ${r.estimates.map((x) => x.what.en).join(' ')}`);
  if (!r.complete) {
    out.push(
      `Not final: some amounts are known only in part, so these taxes are at least what is shown. ${en(r.incomplete).join(' ')}`,
    );
  }
  if (r.needsOk) {
    out.push(
      `${r.needsOk} item${r.needsOk === 1 ? '' : 's'} rest on values that still need the user's OK (dashboard, Documents).`,
    );
  }
  if (r.unsupported.length) out.push(`Not computed: ${en(r.unsupported).join(' ')}`);
  if (notSupported.length) out.push(`Not supported yet, so left out: ${notSupported.join('; ')}.`);
  if (r.notCounted.length) out.push(`Not counted: ${en(r.notCounted).join(' ')}`);
  if (r.assumptions.length || notes.length) {
    out.push(`Assumptions: ${[...en(r.assumptions), ...en(notes)].join(' ')}`);
  }
  if (r.unverifiedRules.length) {
    out.push(`Rules the documents don't spell out: ${en(r.unverifiedRules).join(' ')}`);
  }
  const structured: Record<string, unknown> = {
    taxYear: r.taxYear,
    canton: 'ZH',
    commune: r.commune,
    computed: true,
    missing: [],
    total: r.total,
    icc: icc && {
      total: icc.taxes.total.amount,
      simpleTax: icc.taxes.simple.amount,
      cantonal: icc.taxes.cantonal.amount,
      communal: icc.taxes.communal.amount,
      church: icc.taxes.church?.amount ?? null,
      personalTax: icc.taxes.personalTax.amount,
      taxableIncome: icc.taxableIncome.amount,
      taxableWealth: icc.wealth.taxableWealth.amount,
      tariff: icc.tariff,
    },
    ifd: ifd && { tax: ifd.tax.amount, taxableIncome: ifd.taxableIncome.amount, scale: ifd.scale },
    estimates: r.estimates.map((x) => x.what.en),
    needsOk: r.needsOk,
    notCounted: en(r.notCounted),
    assumptions: [...en(r.assumptions), ...en(notes)],
    unsupported: en(r.unsupported),
    notSupported,
    unverifiedRules: en(r.unverifiedRules),
    complete: r.complete,
    ...(r.incomplete.length ? { incomplete: en(r.incomplete) } : {}),
  };
  if (detail) {
    structured.detail = {
      iccItems: (icc?.items ?? []).map(itemOut),
      wealthItems: (icc?.wealth.items ?? []).map(itemOut),
      ifdItems: (ifd?.items ?? []).map(itemOut),
      lines: lines(r),
    };
    const all = [
      ...(icc ? [...icc.items, ...icc.wealth.items] : []),
      ...(ifd ? ifd.items.map((i) => ({ ...i, code: `Bund ${i.code}` })) : []),
    ];
    out.push(
      'Detail, each item with how it was computed and its source (Bund: the Bundessteuer column):',
      ...all.map(
        (i) =>
          `- ${i.code} ${term(i)} (${WHO[i.person]?.en ?? i.person}): ${chf(i.amount)}. ${i.how.en} [${i.sources.join('; ')}]`,
      ),
      ...lines(r)
        .filter((l) =>
          /simple|cantonal|communal|church|personalTax|total|scaleTax|childReduction|ifd\.tax$/.test(
            l.id,
          ),
        )
        .map((l) => `- ${l.label}: ${chf(l.amount)}. ${l.how} [${l.sources.join('; ')}]`),
    );
  } else {
    out.push(
      'For how each figure was computed and its source, call compute_tax with detail: true.',
    );
  }
  return { text: out.join('\n'), structured };
}

/** "Your estimate" for a Zurich return, in the UI language: the shape of Geneva's card. */
export function zurichEstimateView(
  ws: Workspace,
  e: { result: ZhTaxResult | null; missing: Text[]; notes: Text[] },
  lang: Lang,
) {
  const r = e.result;
  if (!r) return { computed: false as const, missing: e.missing.map((m) => say(m, lang)) };
  const icc = r.icc;
  const ifd = r.ifd;
  const row = (id: string, label: Text, line: Line | null | undefined) =>
    line && {
      id,
      label: say(label, lang),
      amount: line.amount,
      estimate: Boolean(line.estimates?.length),
      needsOk: Boolean(line.needsOk),
    };
  const couple = ws.snapshot().people.length > 1;
  return {
    computed: true as const,
    canton: 'ZH' as const,
    taxYear: r.taxYear,
    total: r.total,
    estimate: r.estimates.length > 0,
    rows: [row('icc', LABEL.icc, icc?.taxes.total), row('ifd', LABEL.ifd, ifd?.tax)].filter(
      (x) => x !== null && x !== undefined,
    ),
    parts: icc
      ? [
          row('cantonal', LABEL.cantonal, icc.taxes.cantonal),
          row('communal', LABEL.communal, icc.taxes.communal),
          row('church', LABEL.church, icc.taxes.church),
          row('personal', LABEL.personal, icc.taxes.personalTax),
        ].filter((x) => x !== null && x !== undefined)
      : [],
    taxable: {
      icc: icc?.taxableIncome.amount ?? null,
      ifd: ifd?.taxableIncome.amount ?? null,
      wealth: icc?.wealth.taxableWealth.amount ?? null,
    },
    items: (icc ? mainItems(icc.items, 8) : []).map((i) => ({
      code: i.code,
      label: say(i.label, lang),
      who: i.person !== 'household' && couple ? say(WHO[i.person] ?? WHO.household!, lang) : '',
      amount: i.amount,
      how: say(i.how, lang),
      estimate: Boolean(i.estimates?.length),
      needsOk: Boolean(i.needsOk),
    })),
    estimates: r.estimates.map((x) => say(x.what, lang)),
    needsOk: r.needsOk,
    notes: [...r.unsupported, ...r.incomplete, ...r.notCounted].map((n) => say(n, lang)),
    complete: r.complete,
    /** Zurich is a preview: the rules the documents don't spell out, and what was assumed. */
    unverified: r.unverifiedRules.map((n) => say(n, lang)),
    assumptions: [...r.assumptions, ...e.notes].map((n) => say(n, lang)),
    lastYear: [] as never[],
  };
}
