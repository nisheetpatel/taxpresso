// From the lines of the return to the taxes: the second half of the engine, and the part the
// official worked example checks on its own (zh-2025-guide-natuerliche-personen p. 35 to 38,
// whose lines are given as printed).
//
// Income, in the form's order (zh-2025-form-steuererklaerung-hauptformular p. 3): 199 Total der
// Einkünfte; 299 Total der Abzüge; 310 Nettoeinkommen = 199 - 299; 320 medical costs and 324
// donations, both measured on 310; 350 Reineinkommen; 370 and 372 child deductions; 390
// steuerbares Einkommen. Wealth (p. 4): 460 Total der Vermögenswerte, less 470 Schulden, is 490
// steuerbares Vermögen; Zurich has no other wealth deduction, the tariff's first step is tax free.
//
// Taxes (StG § 2, § 35, § 47, § 188, § 199 to § 202): the tariffs give the einfache Staatssteuer
// on income and on wealth; the Staatssteuer is that simple tax times the cantonal multiplier, the
// Gemeindesteuer times the commune's, the Kirchensteuer (on request) times the church's, each a
// percentage of the same simple tax; the Personalsteuer is a fixed amount per adult.
import { chf, pct, roundCentime, Trace } from './calc.js';
import type { Cited } from '@taxpresso/rules-ch';
import { pick } from './communes.js';
import { churchSplit, multipliers, personalTax } from './law.js';
import { zhParamsFor, type ZhTaxYear } from './params.js';
import { ASSETS, DEBTS, DEDUCTIONS, EXTRA, INCOME, rubric, SOCIAL } from './rubrics.js';
import { stepsTotal, tariffFraction, type StepTariff } from './tariff.js';
import type { CommuneRef, Confession, Item, ItemAmount, Line, Text, ZhIccResult } from './types.js';

export class ZhInputError extends Error {}

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const FORM = 'zh-2025-form-steuererklaerung-hauptformular';

export interface ZhAssessInput {
  taxYear: ZhTaxYear;
  /** BFS number of the commune of residence on 31 December. */
  commune: number;
  communeVariant?: number;
  tariff: 'basic' | 'married';
  /** The documents that say which tariff applies, when the household needs them. */
  tariffSources?: readonly string[];
  /** Taxpayers of age who each owe the Personalsteuer: 1, or 2 for spouses. */
  adults: 1 | 2;
  /** Church tax, on request: each adult's church; the parish (1 or 2) where the table has two. */
  church?: { members: readonly Confession[]; parish?: number };
  incomeItems: readonly (Item | ItemAmount)[];
  wealthItems: readonly (Item | ItemAmount)[];
}

/** An amount as printed, as an item with its line's label. */
export function asItem(item: Item | ItemAmount): Item {
  if ('label' in item) return item;
  const r = rubric(item.code);
  if (!r) throw new ZhInputError(`Unknown line code ${item.code} on the Zurich return.`);
  return {
    code: item.code,
    person: item.person,
    amount: item.amount,
    label: r.label,
    how: t('As given.', 'Tel que donné.'),
    sources: [r.source],
  };
}

const sum = (items: readonly Item[]) => items.reduce((s, i) => s + i.amount, 0);
/** Whole francs: the return takes amounts without centimes ("CHF ohne Rappen"). */
const francs = (centimes: number) => Math.floor(centimes / 100) * 100;

export interface IncomeTotals {
  grossIncome: Line;
  totalDeductions: Line;
  subtotal310: Line;
  netIncome: Line;
  taxableIncome: Line;
}

/** The totals of p. 3 of the return, in its order, from the items. */
export function incomeTotals(items: readonly Item[]): IncomeTotals {
  const src = `${FORM} p. 3`;
  const income = items.filter((i) => INCOME.has(i.code));
  const deductions = items.filter((i) => DEDUCTIONS.has(i.code));
  const extra = items.filter((i) => EXTRA.has(i.code));
  const social = items.filter((i) => SOCIAL.has(i.code));
  const unknown = items.filter(
    (i) =>
      !INCOME.has(i.code) && !DEDUCTIONS.has(i.code) && !EXTRA.has(i.code) && !SOCIAL.has(i.code),
  );
  if (unknown.length) {
    throw new ZhInputError(`Not an income line: ${unknown.map((i) => i.code).join(', ')}.`);
  }
  const gross = sum(income);
  const ded = sum(deductions);
  const s310 = gross + ded;
  const net = s310 + sum(extra);
  const taxable = Math.max(0, francs(net + sum(social)));
  const grossIncome = new Trace()
    .src(src)
    .from(...income)
    .line(
      gross,
      t('Total income (Total der Einkünfte, 199)', 'Total des revenus (Total der Einkünfte, 199)'),
      t(
        `The ${income.length} income lines added up: ${chf(gross)}.`,
        `Les ${income.length} lignes de revenu additionnées${NB}: ${chf(gross)}.`,
      ),
    );
  const totalDeductions = new Trace()
    .src(src)
    .from(...deductions)
    .line(
      ded,
      t('Total deductions (Total der Abzüge, 299)', 'Total des déductions (Total der Abzüge, 299)'),
      t(
        `The ${deductions.length} deductions added up: ${chf(-ded)}.`,
        `Les ${deductions.length} déductions additionnées${NB}: ${chf(-ded)}.`,
      ),
    );
  const subtotal310 = new Trace()
    .src(src)
    .from(grossIncome, totalDeductions)
    .line(
      s310,
      t('Net income (Nettoeinkommen, 310)', 'Revenu net (Nettoeinkommen, 310)'),
      t(
        `Total income less total deductions: ${chf(s310)}.`,
        `Total des revenus moins total des déductions${NB}: ${chf(s310)}.`,
      ),
    );
  const netIncome = new Trace()
    .src(src)
    .from(subtotal310, ...extra)
    .line(
      net,
      t(
        'Income after medical costs and donations (Reineinkommen, 350)',
        'Revenu après frais médicaux et dons (Reineinkommen, 350)',
      ),
      t(
        `Line 310 less medical costs and donations${extra.length ? '' : ' (none)'}: ${chf(net)}.`,
        `Ligne 310 moins frais médicaux et dons${extra.length ? '' : ' (aucun)'}${NB}: ${chf(net)}.`,
      ),
    );
  const taxableIncome = new Trace()
    .src(src)
    .from(netIncome, ...social)
    .line(
      taxable,
      t(
        'Taxable income (steuerbares Einkommen, 390)',
        'Revenu imposable (steuerbares Einkommen, 390)',
      ),
      t(
        `Line 350 less the child deductions${social.length ? '' : ' (none)'}, in whole francs, never below zero: ${chf(taxable)}.`,
        `Ligne 350 moins les déductions pour enfants${social.length ? '' : ' (aucune)'}, en francs entiers, jamais négatif${NB}: ${chf(taxable)}.`,
      ),
    );
  return { grossIncome, totalDeductions, subtotal310, netIncome, taxableIncome };
}

/** A tariff applied: the exact simple tax, rounded to the centime, with how. */
function tariffLine(
  param: Cited<StepTariff>,
  base: Line,
  label: Text,
  /** What it applies to; in French with its preposition ("au revenu imposable"). */
  what: Text,
  tariffName: Text,
  extraSources: readonly string[],
): Line {
  const tr = new Trace().from(base).src(...extraSources);
  const tariff = tr.p(param);
  const amount = roundCentime(tariffFraction(tariff, base.amount), tariff.denominator);
  const top = stepsTotal(tariff);
  return tr.line(
    amount,
    label,
    t(
      `The ${tariffName.en} applied to ${what.en} of ${chf(base.amount)}, step by step${base.amount > top * 100 ? `, the part above ${chf(top * 100)} at the top rate` : ''}: ${chf(amount)}.`,
      `Le ${tariffName.fr} appliqué ${what.fr} de ${chf(base.amount)}, tranche par tranche${base.amount > top * 100 ? `, la part au-delà de ${chf(top * 100)} au taux maximal` : ''}${NB}: ${chf(amount)}.`,
    ),
  );
}

/** The commune's multiplier, or why it can't be chosen. */
export function communeRate(
  taxYear: ZhTaxYear,
  bfs: number,
  variant?: number,
):
  | { ref: CommuneRef & { rate: number }; choices?: undefined }
  | { ref?: undefined; choices: readonly number[] } {
  const c = zhParamsFor(taxYear).communes.value.find((x) => x.bfs === bfs);
  if (!c) throw new ZhInputError(`Unknown Zurich commune: BFS ${bfs}.`);
  const rate = pick(c.rates, variant);
  if (rate === undefined) return { choices: c.rates };
  return { ref: { bfs: c.bfs, name: c.name, rate } };
}

/** The church multiplier for one confession in the commune, or undefined when the parish is needed. */
function churchRate(
  taxYear: ZhTaxYear,
  bfs: number,
  confession: Confession,
  parish?: number,
): number | undefined {
  if (confession === 'none') return 0;
  const c = zhParamsFor(taxYear).communes.value.find((x) => x.bfs === bfs)!;
  const values =
    confession === 'reformed'
      ? c.reformed
      : confession === 'catholic'
        ? c.catholic
        : c.christCatholic;
  return pick(values, parish);
}

const CONFESSION: Record<Exclude<Confession, 'none'>, Text> = {
  reformed: t('Reformed', 'réformée'),
  catholic: t('Catholic', 'catholique'),
  christ_catholic: t('Christ Catholic', 'catholique-chrétienne'),
};

export function assess(input: ZhAssessInput): ZhIccResult {
  const P = zhParamsFor(input.taxYear);
  const commune = communeRate(input.taxYear, input.commune, input.communeVariant);
  if (!commune.ref) {
    throw new ZhInputError(
      `This commune has several multipliers (${commune.choices.join(', ')} %): say which part applies.`,
    );
  }
  const C = commune.ref;
  const items = input.incomeItems.map(asItem);
  const wealthItems = input.wealthItems.map(asItem);
  const totals = incomeTotals(items);
  const married = input.tariff === 'married';
  const tariffSources = input.tariffSources ?? [];
  const tariffName = married
    ? t('married tariff (Verheiratetentarif)', 'barème des personnes mariées (Verheiratetentarif)')
    : t('basic tariff (Grundtarif)', 'barème de base (Grundtarif)');

  // Wealth.
  const assets = wealthItems.filter((i) => ASSETS.has(i.code));
  const debts = wealthItems.filter((i) => DEBTS.has(i.code));
  const unknown = wealthItems.filter((i) => !ASSETS.has(i.code) && !DEBTS.has(i.code));
  if (unknown.length) {
    throw new ZhInputError(`Not a wealth line: ${unknown.map((i) => i.code).join(', ')}.`);
  }
  const gross = sum(assets);
  const taxableWealthAmount = Math.max(0, francs(gross + sum(debts)));
  const grossWealth = new Trace()
    .src(`${FORM} p. 4`)
    .from(...assets)
    .line(
      gross,
      t(
        'Total assets (Total der Vermögenswerte, 460)',
        'Total de la fortune (Total der Vermögenswerte, 460)',
      ),
      t(
        `The ${assets.length} asset${assets.length === 1 ? '' : 's'} added up: ${chf(gross)}.`,
        `Éléments de fortune additionnés (${assets.length})${NB}: ${chf(gross)}.`,
      ),
    );
  const taxableWealth = new Trace()
    .src(`${FORM} p. 4`)
    .from(grossWealth, ...debts)
    .line(
      taxableWealthAmount,
      t(
        'Taxable wealth (steuerbares Vermögen, 490)',
        'Fortune imposable (steuerbares Vermögen, 490)',
      ),
      t(
        `Total assets less debts (${chf(-sum(debts))}), in whole francs, never below zero: ${chf(taxableWealthAmount)}.`,
        `Total de la fortune moins les dettes (${chf(-sum(debts))}), en francs entiers, jamais négatif${NB}: ${chf(taxableWealthAmount)}.`,
      ),
    );

  // The einfache Staatssteuer.
  const simpleIncome = tariffLine(
    married ? P.incomeTariff.married : P.incomeTariff.basic,
    totals.taxableIncome,
    t(
      'Simple tax on income (einfache Staatssteuer, Einkommen)',
      'Impôt simple sur le revenu (einfache Staatssteuer, Einkommen)',
    ),
    t('the taxable income', 'au revenu imposable'),
    tariffName,
    tariffSources,
  );
  const simpleWealth = tariffLine(
    married ? P.wealthTariff.married : P.wealthTariff.basic,
    taxableWealth,
    t(
      'Simple tax on wealth (einfache Staatssteuer, Vermögen)',
      'Impôt simple sur la fortune (einfache Staatssteuer, Vermögen)',
    ),
    t('the taxable wealth', 'à la fortune imposable'),
    tariffName,
    tariffSources,
  );
  const simpleAmount = simpleIncome.amount + simpleWealth.amount;
  const simple = new Trace()
    .src(multipliers(input.taxYear).source)
    .from(simpleIncome, simpleWealth)
    .line(
      simpleAmount,
      t('Simple tax (einfache Staatssteuer)', 'Impôt simple (einfache Staatssteuer)'),
      t(
        `Income ${chf(simpleIncome.amount)} + wealth ${chf(simpleWealth.amount)} = ${chf(simpleAmount)}. The canton, the commune and the churches each levy a percentage of it.`,
        `Revenu ${chf(simpleIncome.amount)} + fortune ${chf(simpleWealth.amount)} = ${chf(simpleAmount)}. Le canton, la commune et les Églises en prélèvent chacun un pourcentage.`,
      ),
    );

  const scaled = (rateBp: number) => roundCentime(simpleAmount * rateBp, 10_000);
  const ctTrace = new Trace().from(simple);
  const cantonalRate = ctTrace.p(P.cantonalRate);
  const cantonalAmount = scaled(cantonalRate * 100);
  const cantonal = ctTrace.line(
    cantonalAmount,
    t('Cantonal tax (Staatssteuer)', 'Impôt cantonal (Staatssteuer)'),
    t(
      `${chf(simpleAmount)} x ${pct(cantonalRate)} (Staatssteuerfuss ${input.taxYear}), to the centime: ${chf(cantonalAmount)}.`,
      `${chf(simpleAmount)} x ${pct(cantonalRate)} (Staatssteuerfuss ${input.taxYear}), au centime${NB}: ${chf(cantonalAmount)}.`,
    ),
  );
  const cmTrace = new Trace().from(simple).src(P.communes.source);
  const communalAmount = scaled(C.rate * 100);
  const communal = cmTrace.line(
    communalAmount,
    t(`Communal tax of ${C.name} (Gemeindesteuer)`, `Impôt communal de ${C.name} (Gemeindesteuer)`),
    t(
      `${chf(simpleAmount)} x ${pct(C.rate)} (Gemeindesteuerfuss without church tax), to the centime: ${chf(communalAmount)}.`,
      `${chf(simpleAmount)} x ${pct(C.rate)} (Gemeindesteuerfuss sans impôt ecclésiastique), au centime${NB}: ${chf(communalAmount)}.`,
    ),
  );

  let church: Line | null = null;
  const members = (input.church?.members ?? []).filter((m) => m !== 'none');
  if (input.church && members.length) {
    const chTrace = new Trace().from(simple).src(P.communes.source);
    const split = input.adults === 2 ? chTrace.p(churchSplit(input.taxYear)).spouseShareBp : 10_000;
    let bp = 0;
    const parts: Text[] = [];
    for (const m of members) {
      const rate = churchRate(input.taxYear, input.commune, m, input.church.parish);
      if (rate === undefined) {
        throw new ZhInputError(
          `${C.name} has two ${CONFESSION[m].en} parishes with different multipliers: say which (parish 1 or 2).`,
        );
      }
      bp += (rate * 100 * split) / 10_000;
      const name = CONFESSION[m];
      parts.push(
        split === 10_000
          ? t(`${name.en} ${pct(rate)}`, `${name.fr} ${pct(rate)}`)
          : t(`half of ${name.en} ${pct(rate)}`, `la moitié de ${name.fr} ${pct(rate)}`),
      );
    }
    const amount = scaled(bp);
    church = chTrace.line(
      amount,
      t('Church tax (Kirchensteuer)', 'Impôt ecclésiastique (Kirchensteuer)'),
      t(
        `${chf(simpleAmount)} x ${parts.map((p) => p.en).join(' + ')} = ${pct(bp / 100)}, to the centime: ${chf(amount)}.`,
        `${chf(simpleAmount)} x ${parts.map((p) => p.fr).join(' + ')} = ${pct(bp / 100)}, au centime${NB}: ${chf(amount)}.`,
      ),
    );
  }

  const ptTrace = new Trace();
  const perPerson = ptTrace.p(personalTax(input.taxYear)).perPerson;
  const ptAmount = perPerson * input.adults;
  const personal = ptTrace.line(
    ptAmount,
    t('Personal tax (Personalsteuer)', 'Taxe personnelle (Personalsteuer)'),
    t(
      `${chf(perPerson)} a year for each taxpayer of age${input.adults === 2 ? ', and spouses each owe it' : ''}: ${chf(ptAmount)}.`,
      `${chf(perPerson)} par an et par contribuable majeur${input.adults === 2 ? ', due par chacun des époux' : ''}${NB}: ${chf(ptAmount)}.`,
    ),
  );

  const totalAmount = cantonalAmount + communalAmount + (church?.amount ?? 0) + ptAmount;
  const total = new Trace()
    .from(cantonal, communal, church ?? undefined, personal)
    .src(multipliers(input.taxYear).source)
    .line(
      totalAmount,
      t(
        'Cantonal and communal tax (Staats- und Gemeindesteuern)',
        'Impôt cantonal et communal (Staats- und Gemeindesteuern)',
      ),
      t(
        `Cantonal ${chf(cantonalAmount)} + communal ${chf(communalAmount)}${church ? ` + church ${chf(church.amount)}` : ''} + personal tax ${chf(ptAmount)} = ${chf(totalAmount)}.`,
        `Cantonal ${chf(cantonalAmount)} + communal ${chf(communalAmount)}${church ? ` + ecclésiastique ${chf(church.amount)}` : ''} + taxe personnelle ${chf(ptAmount)} = ${chf(totalAmount)}.`,
      ),
    );

  return {
    items,
    ...totals,
    tariff: input.tariff,
    wealth: { items: wealthItems, grossWealth, taxableWealth },
    taxes: {
      simpleIncome,
      simpleWealth,
      simple,
      cantonal,
      communal,
      church,
      personalTax: personal,
      total,
    },
  };
}
