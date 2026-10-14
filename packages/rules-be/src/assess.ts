// From the lines of the return to the taxes: the second half of the engine, and the part the
// official specimen checks on its own (be-2025-steuererklaerung-formulare-de p. 9, TaxMe's summary
// of the cantonal and communal tax, whose lines are given as printed).
//
// Income, in TaxMe's order: Total Einkünfte; less the Aufwendungen und allgemeine Abzüge (StG
// Art. 31 to 38) is the Reineinkommen, the base of the donations and medical costs (Art. 38a);
// less those and the Sozialabzüge (Art. 40) is the steuerbares Einkommen. Wealth: Total Vermögen
// less the debts (Art. 62) and the Sozialabzüge (Art. 64) is the steuerbares Vermögen.
//
// Taxes (StG Art. 2, Art. 42, Art. 65, Art. 66): the tariffs give the einfache Steuer on income
// (in whole CHF 100) and on wealth (in whole CHF 1,000, nothing under CHF 100,000); the canton, the
// commune and the church each levy a multiple of the same einfache Steuer (their Steueranlagen and
// church tax rate); the wealth tax of all three is cut to the maximum burden when it is higher.
import { chf, roundCentime, Trace, type Cited } from '@taxpresso/rules-ch';
import { churchRate, type BeCommune, type Confession } from './communes.js';
import { NOTE } from './explain.js';
import { churchRates, maxBurden, multipliers, tariffSteps, wealthFreeBelow } from './law.js';
import { beParamsFor, type BeTaxYear } from './params.js';
import { ASSETS, DEBTS, DEDUCTIONS, INCOME, PERSONAL, rubric, WEALTH_SOCIAL } from './rubrics.js';
import { stepsTotal, tariffFraction, type StepTariff } from './tariff.js';
import type { BeIccResult, CommuneRef, Item, ItemAmount, Line, Text } from './types.js';

export class BeInputError extends Error {}

/** A fact the household has not given and the tax depends on: the result says what to answer. */
export class BeUnsupported extends Error {
  constructor(readonly note: Text) {
    super(note.en);
  }
}

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const SUMMARY = 'be-2025-steuererklaerung-formulare-de p. 9';

export interface BeAssessInput {
  taxYear: BeTaxYear;
  /** BFS number of the commune of residence on 31 December. */
  commune: number;
  tariff: 'married' | 'other';
  /** The documents that say which tariff applies, when the household needs them. */
  tariffSources?: readonly string[];
  /**
   * The church tax, when asked for: the household's confession (one; spouses of different
   * confessions are not supported) and the part of the commune where the parishes differ. `none`:
   * the household said it pays no church tax. Undefined: not asked.
   */
  church?: { confession: Confession; part?: string };
  /**
   * Income from wealth for the maximum burden (Art. 66 Abs. 2 and 3): income from securities and
   * accounts less the costs of keeping them and the debt interest. Default zero.
   */
  wealthYield?: Line;
  incomeItems: readonly (Item | ItemAmount)[];
  wealthItems: readonly (Item | ItemAmount)[];
}

/** An amount as printed, as an item with its line's label. */
export function asItem(item: Item | ItemAmount): Item {
  if ('label' in item) return item;
  const r = rubric(item.code);
  if (!r) throw new BeInputError(`Unknown line code ${item.code} on the Bern return.`);
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

function only(items: readonly Item[], groups: readonly Set<string>[], what: string) {
  const unknown = items.filter((i) => !groups.some((g) => g.has(i.code)));
  if (unknown.length) {
    throw new BeInputError(`Not ${what}: ${unknown.map((i) => i.code).join(', ')}.`);
  }
}

export interface IncomeTotals {
  grossIncome: Line;
  totalDeductions: Line;
  netIncome: Line;
  personalDeductions: Line;
  taxableIncome: Line;
}

/** The totals of TaxMe's summary, in its order, from the items. */
export function incomeTotals(items: readonly Item[]): IncomeTotals {
  only(items, [INCOME, DEDUCTIONS, PERSONAL], 'an income line');
  const income = items.filter((i) => INCOME.has(i.code));
  const deductions = items.filter((i) => DEDUCTIONS.has(i.code));
  const personal = items.filter((i) => PERSONAL.has(i.code));
  const gross = sum(income);
  const ded = sum(deductions);
  const net = gross + ded;
  const pers = sum(personal);
  const taxable = Math.max(0, net + pers);
  const grossIncome = new Trace()
    .src(SUMMARY)
    .from(...income)
    .line(
      gross,
      t('Total income (Total Einkünfte)', 'Total des revenus (Total Einkünfte)'),
      t(
        `The ${income.length} income lines added up: ${chf(gross)}.`,
        `Les ${income.length} lignes de revenu additionnées${NB}: ${chf(gross)}.`,
      ),
    );
  const totalDeductions = new Trace()
    .src(SUMMARY)
    .from(...deductions)
    .line(
      ded,
      t(
        'Total expenses and general deductions (Total Aufwendungen und allgemeine Abzüge)',
        'Total des frais et déductions générales (Total Aufwendungen und allgemeine Abzüge)',
      ),
      t(
        `The ${deductions.length} deductions added up: ${chf(-ded)}.`,
        `Les ${deductions.length} déductions additionnées${NB}: ${chf(-ded)}.`,
      ),
    );
  const netIncome = new Trace()
    .src(SUMMARY)
    .from(grossIncome, totalDeductions)
    .line(
      net,
      t('Net income (Reineinkommen)', 'Revenu net (Reineinkommen)'),
      t(
        `Total income less the expenses and general deductions: ${chf(net)}.`,
        `Total des revenus moins les frais et déductions générales${NB}: ${chf(net)}.`,
      ),
    );
  const personalDeductions = new Trace()
    .src(SUMMARY)
    .from(...personal)
    .line(
      pers,
      t(
        'Total personal and social deductions (Total persönliche Abzüge / Sozialabzüge)',
        'Total des déductions personnelles et sociales (Total persönliche Abzüge / Sozialabzüge)',
      ),
      t(
        `The ${personal.length} deductions added up: ${chf(-pers)}.`,
        `Les ${personal.length} déductions additionnées${NB}: ${chf(-pers)}.`,
      ),
    );
  const taxableIncome = new Trace()
    .src(SUMMARY)
    .from(netIncome, personalDeductions)
    .line(
      taxable,
      t('Taxable income (steuerbares Einkommen)', 'Revenu imposable (steuerbares Einkommen)'),
      t(
        `Net income less the personal and social deductions, never below zero: ${chf(taxable)}.`,
        `Revenu net moins les déductions personnelles et sociales, jamais négatif${NB}: ${chf(taxable)}.`,
      ),
    );
  return { grossIncome, totalDeductions, netIncome, personalDeductions, taxableIncome };
}

/** The wealth totals: Total Vermögen, then less the debts and the Sozialabzüge, never below zero. */
export function wealthTotals(items: readonly Item[]): { grossWealth: Line; taxableWealth: Line } {
  only(items, [ASSETS, DEBTS, WEALTH_SOCIAL], 'a wealth line');
  const assets = items.filter((i) => ASSETS.has(i.code));
  const less = items.filter((i) => !ASSETS.has(i.code));
  const gross = sum(assets);
  const taxable = Math.max(0, gross + sum(less));
  const grossWealth = new Trace()
    .src(SUMMARY)
    .from(...assets)
    .line(
      gross,
      t('Total wealth (Total Vermögen)', 'Total de la fortune (Total Vermögen)'),
      t(
        `The ${assets.length} asset${assets.length === 1 ? '' : 's'} added up: ${chf(gross)}.`,
        `Éléments de fortune additionnés (${assets.length})${NB}: ${chf(gross)}.`,
      ),
    );
  const taxableWealth = new Trace()
    .src(SUMMARY)
    .from(grossWealth, ...less)
    .line(
      taxable,
      t('Taxable wealth (steuerbares Vermögen)', 'Fortune imposable (steuerbares Vermögen)'),
      t(
        `Total wealth less the debts and the wealth deductions (${chf(-sum(less))}), never below zero: ${chf(taxable)}.`,
        `Total de la fortune moins les dettes et les déductions sur la fortune (${chf(-sum(less))}), jamais négatif${NB}: ${chf(taxable)}.`,
      ),
    );
  return { grossWealth, taxableWealth };
}

/** A tariff applied to an amount rounded down to the step: the einfache Steuer, with how. */
function tariffLine(
  param: Cited<StepTariff>,
  base: Line,
  step: Cited<number>,
  label: Text,
  what: Text,
  tariffName: Text,
  extraSources: readonly string[],
): Line {
  const tr = new Trace().from(base).src(...extraSources);
  const tariff = tr.p(param);
  const unit = tr.p(step);
  const amountTaxed = Math.floor(Math.max(0, base.amount) / unit) * unit;
  const amount = roundCentime(tariffFraction(tariff, amountTaxed), tariff.denominator);
  const top = stepsTotal(tariff) * 100;
  return tr.line(
    amount,
    label,
    t(
      `The ${tariffName.en} applied to ${what.en} of ${chf(base.amount)}, taken as ${chf(amountTaxed)} (in whole CHF ${unit / 100}), step by step${amountTaxed > top ? `, the part above ${chf(top)} at the last rate` : ''}: ${chf(amount)}.`,
      `Le ${tariffName.fr} appliqué ${what.fr} de ${chf(base.amount)}, pris pour ${chf(amountTaxed)} (par tranches entières de CHF ${unit / 100}), tranche par tranche${amountTaxed > top ? `, la part au-delà de ${chf(top)} au dernier taux` : ''}${NB}: ${chf(amount)}.`,
    ),
  );
}

/** A multiplier in ten-thousandths as the documents print it: 29750 -> "2.975", 1840 -> "0.184". */
export const multiple = (tenThousandths: number) => String(tenThousandths / 10_000);

/** The commune of a year, or an input error. */
export function communeOf(taxYear: BeTaxYear, bfs: number): BeCommune {
  const c = beParamsFor(taxYear).communes.value.find((x) => x.bfs === bfs);
  if (!c) throw new BeInputError(`Unknown Bern commune: BFS ${bfs}.`);
  return c;
}

export const communeRef = (c: BeCommune): CommuneRef => ({
  bfs: c.bfs,
  name: c.name,
  rate: c.rate,
});

const CONFESSION: Record<Exclude<Confession, 'none'>, Text> = {
  reformed: t('Reformed', 'réformée'),
  catholic: t('Roman Catholic', 'catholique romaine'),
  christ_catholic: t('Christ Catholic', 'catholique-chrétienne'),
};

/** The highest church tax rate that could apply in the commune (for the maximum burden). */
function highestChurchRate(taxYear: BeTaxYear, c: BeCommune): number {
  const rates = (x: BeCommune) =>
    x.parishes.flatMap((p) => [p.reformed, p.catholic, p.christCatholic]);
  const own = rates(c);
  // A rate the documents give differently: any rate of the year's table bounds both values.
  const pool = own.includes(null) ? beParamsFor(taxYear).communes.value.flatMap(rates) : own;
  return Math.max(...pool.filter((v): v is number => v !== null));
}

export function assess(input: BeAssessInput): BeIccResult {
  const P = beParamsFor(input.taxYear);
  const C = communeOf(input.taxYear, input.commune);
  const items = input.incomeItems.map(asItem);
  const wealthItems = input.wealthItems.map(asItem);
  const totals = incomeTotals(items);
  const wealth = wealthTotals(wealthItems);
  const married = input.tariff === 'married';
  const tariffName = married
    ? t(
        'tariff for married couples and single parents (Art. 42 Abs. 1)',
        'barème des couples mariés et familles monoparentales (art. 42 al. 1)',
      )
    : t(
        'tariff for other taxpayers (Art. 42 Abs. 2)',
        'barème des autres contribuables (art. 42 al. 2)',
      );
  const steps = tariffSteps(input.taxYear);

  // The einfache Steuer.
  const simpleIncome = tariffLine(
    married ? P.incomeTariff.married : P.incomeTariff.other,
    totals.taxableIncome,
    { value: steps.value.income, source: steps.source },
    t(
      'Simple tax on income (einfache Steuer, Einkommen)',
      'Impôt simple sur le revenu (einfache Steuer, Einkommen)',
    ),
    t('the taxable income', 'au revenu imposable'),
    tariffName,
    input.tariffSources ?? [],
  );
  const free = wealthFreeBelow(input.taxYear);
  let simpleWealth: Line;
  if (wealth.taxableWealth.amount < free.value) {
    simpleWealth = new Trace()
      .from(wealth.taxableWealth)
      .src(free.source)
      .line(
        0,
        t(
          'Simple tax on wealth (einfache Steuer, Vermögen)',
          'Impôt simple sur la fortune (einfache Steuer, Vermögen)',
        ),
        t(
          `Taxable wealth ${chf(wealth.taxableWealth.amount)} is under ${chf(free.value)}: no wealth tax.`,
          `Fortune imposable ${chf(wealth.taxableWealth.amount)} inférieure à ${chf(free.value)}${NB}: pas d’impôt sur la fortune.`,
        ),
      );
  } else {
    simpleWealth = tariffLine(
      P.wealthTariff,
      wealth.taxableWealth,
      { value: steps.value.wealth, source: steps.source },
      t(
        'Simple tax on wealth (einfache Steuer, Vermögen)',
        'Impôt simple sur la fortune (einfache Steuer, Vermögen)',
      ),
      t('the taxable wealth', 'à la fortune imposable'),
      t('wealth tariff (Art. 65)', 'barème de la fortune (art. 65)'),
      [free.source],
    );
  }
  const simpleAmount = simpleIncome.amount + simpleWealth.amount;
  const simple = new Trace()
    .src(multipliers(input.taxYear).source)
    .from(simpleIncome, simpleWealth)
    .line(
      simpleAmount,
      t('Simple tax (einfache Steuer)', 'Impôt simple (einfache Steuer)'),
      t(
        `Income ${chf(simpleIncome.amount)} + wealth ${chf(simpleWealth.amount)} = ${chf(simpleAmount)}. The canton, the commune and the church each levy a multiple of it.`,
        `Revenu ${chf(simpleIncome.amount)} + fortune ${chf(simpleWealth.amount)} = ${chf(simpleAmount)}. Le canton, la commune et l’Église en prélèvent chacun un multiple.`,
      ),
    );

  const scaled = (amount: number, rate: number) => roundCentime(amount * rate, 10_000);
  const ctTrace = new Trace().from(simple);
  const cantonalRate = ctTrace.p(P.cantonalRate);
  const cantonalAmount = scaled(simpleAmount, cantonalRate);
  const cantonal = ctTrace.line(
    cantonalAmount,
    t('Cantonal tax (Kantonssteuer)', 'Impôt cantonal (Kantonssteuer)'),
    t(
      `${chf(simpleAmount)} x ${multiple(cantonalRate)} (Steueranlage ${input.taxYear}), to the centime: ${chf(cantonalAmount)}.`,
      `${chf(simpleAmount)} x ${multiple(cantonalRate)} (quotité ${input.taxYear}), au centime${NB}: ${chf(cantonalAmount)}.`,
    ),
  );
  const communalAmount = scaled(simpleAmount, C.rate);
  const communal = new Trace()
    .from(simple)
    .src(P.communes.source)
    .line(
      communalAmount,
      t(
        `Communal tax of ${C.name} (Gemeindesteuer)`,
        `Impôt communal de ${C.name} (Gemeindesteuer)`,
      ),
      t(
        `${chf(simpleAmount)} x ${multiple(C.rate)} (the commune’s Steueranlage), to the centime: ${chf(communalAmount)}.`,
        `${chf(simpleAmount)} x ${multiple(C.rate)} (quotité de la commune), au centime${NB}: ${chf(communalAmount)}.`,
      ),
    );

  let church: Line | null = null;
  let churchRateUsed = 0;
  if (input.church && input.church.confession !== 'none') {
    const confession = input.church.confession;
    const rate = churchRate(C, confession, input.church.part);
    if (rate === 'part') throw new BeUnsupported(NOTE.part);
    if (rate === 'conflict') throw new BeUnsupported(NOTE.churchConflict);
    churchRateUsed = rate;
    const amount = scaled(simpleAmount, rate);
    const name = CONFESSION[confession];
    church = new Trace()
      .from(simple)
      .src(P.communes.source, churchRates(input.taxYear).source)
      .line(
        amount,
        t('Church tax (Kirchensteuer)', 'Impôt ecclésiastique (Kirchensteuer)'),
        t(
          `${chf(simpleAmount)} x ${multiple(rate)} (${name.en} church rate${C.parishes.length > 1 && input.church.part ? `, ${input.church.part}` : ''}), to the centime: ${chf(amount)}.`,
          `${chf(simpleAmount)} x ${multiple(rate)} (taux de l’Église ${name.fr}${C.parishes.length > 1 && input.church.part ? `, ${input.church.part}` : ''}), au centime${NB}: ${chf(amount)}.`,
        ),
      );
  }

  // The maximum burden on wealth (Art. 66).
  let wealthCap: Line | null = null;
  if (simpleWealth.amount > 0) {
    const tr = new Trace().from(simpleWealth, wealth.taxableWealth);
    if (input.wealthYield) tr.from(input.wealthYield);
    const mb = tr.p(maxBurden(input.taxYear));
    const yieldAmount = Math.max(0, input.wealthYield?.amount ?? 0);
    const allowed = Math.max(
      roundCentime(yieldAmount * mb.yieldShareBp, 10_000),
      roundCentime(wealth.taxableWealth.amount * mb.floorBp, 10_000),
    );
    const levied = (k: number) => scaled(simpleWealth.amount, cantonalRate + C.rate + k);
    if (!input.church && levied(highestChurchRate(input.taxYear, C)) > allowed) {
      throw new BeUnsupported(NOTE.churchForCap);
    }
    const before = levied(churchRateUsed);
    if (before > allowed) {
      const cut = before - allowed;
      wealthCap = tr.line(
        -cut,
        t(
          'Maximum burden on wealth (Höchstbelastung)',
          'Charge maximale sur la fortune (Höchstbelastung)',
        ),
        t(
          `The wealth tax of the canton, the commune${churchRateUsed ? ' and the church' : ''} (${chf(simpleWealth.amount)} x ${multiple(cantonalRate + C.rate + churchRateUsed)} = ${chf(before)}) is above 25 % of the income from wealth (${chf(yieldAmount)}) and 2.4 per mille of the taxable wealth; it is cut to the higher of the two, ${chf(allowed)}: ${chf(-cut)}.`,
          `L’impôt sur la fortune du canton, de la commune${churchRateUsed ? ' et de l’Église' : ''} (${chf(simpleWealth.amount)} x ${multiple(cantonalRate + C.rate + churchRateUsed)} = ${chf(before)}) dépasse 25${NB}% du rendement de la fortune (${chf(yieldAmount)}) et 2,4 pour mille de la fortune imposable${NB}; il est ramené au plus élevé des deux, ${chf(allowed)}${NB}: ${chf(-cut)}.`,
        ),
      );
    }
  }

  const totalAmount =
    cantonalAmount + communalAmount + (church?.amount ?? 0) + (wealthCap?.amount ?? 0);
  const total = new Trace()
    .from(cantonal, communal, church ?? undefined, wealthCap ?? undefined)
    .src(multipliers(input.taxYear).source)
    .line(
      totalAmount,
      t(
        `Cantonal and communal tax${church ? ' and church tax' : ''} (Kantons- und Gemeindesteuern${church ? ', Kirchensteuer' : ''})`,
        `Impôt cantonal et communal${church ? ' et impôt ecclésiastique' : ''} (Kantons- und Gemeindesteuern${church ? ', Kirchensteuer' : ''})`,
      ),
      t(
        `Cantonal ${chf(cantonalAmount)} + communal ${chf(communalAmount)}${church ? ` + church ${chf(church.amount)}` : ''}${wealthCap ? ` less the maximum burden cut ${chf(-wealthCap.amount)}` : ''} = ${chf(totalAmount)}.`,
        `Cantonal ${chf(cantonalAmount)} + communal ${chf(communalAmount)}${church ? ` + ecclésiastique ${chf(church.amount)}` : ''}${wealthCap ? ` moins la réduction pour charge maximale ${chf(-wealthCap.amount)}` : ''} = ${chf(totalAmount)}.`,
      ),
    );

  return {
    items,
    ...totals,
    tariff: input.tariff,
    wealth: { items: wealthItems, ...wealth },
    taxes: { simpleIncome, simpleWealth, simple, cantonal, communal, church, wealthCap, total },
  };
}
