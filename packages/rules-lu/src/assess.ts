// From the lines of the return to the taxes: the second half of the engine.
//
// Income, in the return's order (page 3, lu-2025-guide-wegleitung p. 17): Total der Einkünfte
// (301) less Total der Abzüge (302) is the Nettoeinkommen (310), the base of the medical costs and
// donations; less the additional deductions (320 to 326) the Reineinkommen (330), the base of the
// degressive social deduction; less the social deductions (340 to 370) the taxable income (380).
// Wealth (page 4, p. 19): Total der Vermögenswerte (450) less the debts (462) is the Reinvermögen
// (470); less the tax-free amounts (472 to 474) the taxable wealth (480).
//
// Taxes (StG § 2, § 57, § 60, § 62, § 232, § 236, § 240): the tariffs give the tax per unit
// (Steuer je Einheit) on income, in whole CHF 100, and on wealth, in whole CHF 1,000; the state, the
// commune and the parish of a church member each levy so many units of it; the income and the
// wealth tax of all three are cut to the maximum burden when higher; the Personalsteuer is added.
import { chf, roundCentime, Trace, type Cited } from '@taxpresso/rules-ch';
import { communeByName, type LuCommune } from './communes.js';
import { NOTE } from './explain.js';
import { churchShares, maxBurden, multipliers, personalTax, tariffSteps } from './law.js';
import { luParamsFor, type LuTaxYear } from './params.js';
import {
  ADDITIONAL,
  ASSETS,
  DEBTS,
  DEDUCTIONS,
  INCOME,
  rubric,
  SOCIAL,
  WEALTH_FREE,
} from './rubrics.js';
import { stepsTotal, unitTaxFraction, wealthTaxFraction, type UnitTariff } from './tariff.js';
import type { CommuneRef, Confession, Item, ItemAmount, Line, LuIccResult, Text } from './types.js';

export class LuInputError extends Error {}

/** A fact the household has not given and the tax depends on: the result says what to answer. */
export class LuUnsupported extends Error {
  constructor(readonly note: Text) {
    super(note.en);
  }
}

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const FORM = 'lu-2025-guide-wegleitung';

export interface LuAssessInput {
  taxYear: LuTaxYear;
  /** The commune of residence on 31 December, by its name in the table of units. */
  commune: string;
  tariff: 'single' | 'family';
  /** The documents that say which tariff applies, when the household needs them. */
  tariffSources?: readonly string[];
  /**
   * The church tax, when asked for: the confession of each member of the family on the return
   * (taxpayers and children; 'none' for a member of no recognised church). Undefined: not asked.
   */
  church?: readonly Confession[];
  incomeItems: readonly (Item | ItemAmount)[];
  wealthItems: readonly (Item | ItemAmount)[];
}

/** An amount as printed, as an item with its line's label. */
export function asItem(item: Item | ItemAmount): Item {
  if ('label' in item) return item;
  const r = rubric(item.code);
  if (!r) throw new LuInputError(`Unknown Ziffer ${item.code} on the Lucerne return.`);
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
    throw new LuInputError(`Not ${what}: ${unknown.map((i) => i.code).join(', ')}.`);
  }
}

/** The commune of a year, or an input error. */
export function communeOf(taxYear: LuTaxYear, name: string): LuCommune {
  const c = communeByName(taxYear, name);
  if (!c) {
    throw new LuInputError(
      `Unknown Lucerne commune for ${taxYear}: ${name}. The canton's table of units gives none for it that year.`,
    );
  }
  return c;
}

export const communeRef = (c: LuCommune): CommuneRef => ({
  bfs: null,
  name: c.name,
  rate: c.units,
});

/** Units in ten-thousandths as the table prints them: 15500 -> "1.55", 2565 -> "0.2565". */
export const units = (tenThousandths: number) => String(tenThousandths / 10_000);

/** The subtotals of page 3 of the return, in its order, from the items. */
export function incomeTotals(items: readonly Item[]) {
  only(items, [INCOME, DEDUCTIONS, ADDITIONAL, SOCIAL], 'an income line');
  const income = items.filter((i) => INCOME.has(i.code));
  const deductions = items.filter((i) => DEDUCTIONS.has(i.code));
  const additional = items.filter((i) => ADDITIONAL.has(i.code));
  const social = items.filter((i) => SOCIAL.has(i.code));
  const page3 = `${FORM} p. 17`;
  const total = (lines: readonly Item[], amount: number, label: Text, how: Text) =>
    new Trace()
      .src(page3)
      .from(...lines)
      .line(amount, label, how);
  const gross = sum(income);
  const ded = sum(deductions);
  const net310 = gross + ded;
  const add = sum(additional);
  const net330 = net310 + add;
  const soc = sum(social);
  const taxable = Math.max(0, net330 + soc);
  const grossIncome = total(
    income,
    gross,
    t('Total income (Total der Einkünfte, 301)', 'Total des revenus (Total der Einkünfte, 301)'),
    t(
      `The ${income.length} income lines added up: ${chf(gross)}.`,
      `Les ${income.length} lignes de revenu additionnées${NB}: ${chf(gross)}.`,
    ),
  );
  const totalDeductions = total(
    deductions,
    ded,
    t('Total deductions (Total der Abzüge, 302)', 'Total des déductions (Total der Abzüge, 302)'),
    t(
      `The ${deductions.length} deductions added up: ${chf(-ded)}.`,
      `Les ${deductions.length} déductions additionnées${NB}: ${chf(-ded)}.`,
    ),
  );
  const incomeAfterDeductions = new Trace()
    .src(page3)
    .from(grossIncome, totalDeductions)
    .line(
      net310,
      t('Net income (Nettoeinkommen, 310)', 'Revenu net (Nettoeinkommen, 310)'),
      t(
        `Total income less the deductions: ${chf(net310)}.`,
        `Total des revenus moins les déductions${NB}: ${chf(net310)}.`,
      ),
    );
  const additionalDeductions = total(
    additional,
    add,
    t(
      'Additional deductions (Zusätzliche Abzüge, 320 to 326)',
      'Déductions supplémentaires (Zusätzliche Abzüge, 320 à 326)',
    ),
    t(
      `The ${additional.length} additional deductions added up: ${chf(-add)}.`,
      `Les ${additional.length} déductions supplémentaires additionnées${NB}: ${chf(-add)}.`,
    ),
  );
  const netIncome = new Trace()
    .src(page3)
    .from(incomeAfterDeductions, additionalDeductions)
    .line(
      net330,
      t(
        'Net income after additional deductions (Reineinkommen, 330)',
        'Revenu net après déductions supplémentaires (Reineinkommen, 330)',
      ),
      t(
        `The net income less the additional deductions: ${chf(net330)}.`,
        `Le revenu net moins les déductions supplémentaires${NB}: ${chf(net330)}.`,
      ),
    );
  const socialDeductions = total(
    social,
    soc,
    t(
      'Social deductions (Sozialabzüge, 340 to 370)',
      'Déductions sociales (Sozialabzüge, 340 à 370)',
    ),
    t(
      `The ${social.length} social deductions added up: ${chf(-soc)}.`,
      `Les ${social.length} déductions sociales additionnées${NB}: ${chf(-soc)}.`,
    ),
  );
  const taxableIncome = new Trace()
    .src(page3)
    .from(netIncome, socialDeductions)
    .line(
      taxable,
      t(
        'Taxable income (Steuerbares Einkommen, 380)',
        'Revenu imposable (Steuerbares Einkommen, 380)',
      ),
      t(
        `The Reineinkommen less the social deductions, never below zero: ${chf(taxable)}.`,
        `Le Reineinkommen moins les déductions sociales, jamais négatif${NB}: ${chf(taxable)}.`,
      ),
    );
  return {
    grossIncome,
    totalDeductions,
    incomeAfterDeductions,
    additionalDeductions,
    netIncome,
    socialDeductions,
    taxableIncome,
  };
}

/** The wealth totals of page 4: 450, 470 (less the debts) and 480 (less the tax-free amounts). */
export function wealthTotals(items: readonly Item[]) {
  only(items, [ASSETS, DEBTS, WEALTH_FREE], 'a wealth line');
  const assets = items.filter((i) => ASSETS.has(i.code));
  const debts = items.filter((i) => DEBTS.has(i.code));
  const free = items.filter((i) => WEALTH_FREE.has(i.code));
  const page4 = `${FORM} p. 19`;
  const gross = sum(assets);
  const net = gross + sum(debts);
  const taxable = Math.max(0, net + sum(free));
  const grossWealth = new Trace()
    .src(page4)
    .from(...assets)
    .line(
      gross,
      t(
        'Total wealth (Total der Vermögenswerte, 450)',
        'Total de la fortune (Total der Vermögenswerte, 450)',
      ),
      t(
        `The ${assets.length} asset${assets.length === 1 ? '' : 's'} added up: ${chf(gross)}.`,
        `Éléments de fortune additionnés (${assets.length})${NB}: ${chf(gross)}.`,
      ),
    );
  const netWealth = new Trace()
    .src(page4)
    .from(grossWealth, ...debts)
    .line(
      net,
      t('Net wealth (Reinvermögen, 470)', 'Fortune nette (Reinvermögen, 470)'),
      t(
        `Total wealth less the debts (${chf(-sum(debts))}): ${chf(net)}.`,
        `Total de la fortune moins les dettes (${chf(-sum(debts))})${NB}: ${chf(net)}.`,
      ),
    );
  const taxableWealth = new Trace()
    .src(page4)
    .from(netWealth, ...free)
    .line(
      taxable,
      t(
        'Taxable wealth (Steuerbares Vermögen, 480)',
        'Fortune imposable (Steuerbares Vermögen, 480)',
      ),
      t(
        `Net wealth less the tax-free amounts (${chf(-sum(free))}), never below zero: ${chf(taxable)}.`,
        `Fortune nette moins les montants exonérés (${chf(-sum(free))}), jamais négatif${NB}: ${chf(taxable)}.`,
      ),
    );
  return { grossWealth, netWealth, taxableWealth };
}

/** The tax per unit on income, the taxable income taken in whole CHF 100. */
function incomeUnitLine(
  param: Cited<UnitTariff>,
  base: Line,
  step: Cited<{ income: number; wealth: number }>,
  tariffName: Text,
  extraSources: readonly string[],
): { line: Line; taxed: number } {
  const tr = new Trace().from(base).src(...extraSources);
  const tariff = tr.p(param);
  const unit = tr.p(step).income;
  const taxed = Math.floor(Math.max(0, base.amount) / unit) * unit;
  const amount = roundCentime(unitTaxFraction(tariff, taxed), 10_000);
  const flat = taxed > tariff.flatAbove * 100;
  const how = flat
    ? t(
        `Taxable income ${chf(base.amount)}, taken as ${chf(taxed)} (in whole CHF 100), above ${chf(tariff.flatAbove * 100)}: ${tariff.flatRate / 100} % of it by the ${tariffName.en}: ${chf(amount)}.`,
        `Revenu imposable ${chf(base.amount)}, pris pour ${chf(taxed)} (par tranches entières de CHF 100), au-delà de ${chf(tariff.flatAbove * 100)}${NB}: ${String(tariff.flatRate / 100).replace('.', ',')}${NB}% de celui-ci selon le ${tariffName.fr}${NB}: ${chf(amount)}.`,
      )
    : t(
        `The ${tariffName.en} applied to the taxable income of ${chf(base.amount)}, taken as ${chf(taxed)} (in whole CHF 100), step by step: ${chf(amount)}.`,
        `Le ${tariffName.fr} appliqué au revenu imposable de ${chf(base.amount)}, pris pour ${chf(taxed)} (par tranches entières de CHF 100), tranche par tranche${NB}: ${chf(amount)}.`,
      );
  if (stepsTotal(tariff) !== tariff.flatAbove) {
    throw new LuInputError('The tariff steps do not end where the top rate starts.');
  }
  return {
    line: tr.line(
      amount,
      t(
        'Tax per unit on income (Steuer je Einheit, Einkommen)',
        'Impôt par unité sur le revenu (Steuer je Einheit, Einkommen)',
      ),
      how,
    ),
    taxed,
  };
}

const CONFESSIONS: readonly Exclude<Confession, 'none'>[] = [
  'catholic',
  'reformed',
  'christ_catholic',
];
const CONFESSION_NAME: Record<Exclude<Confession, 'none'>, Text> = {
  catholic: t('Roman Catholic', 'catholique romaine'),
  reformed: t('Reformed', 'réformée'),
  christ_catholic: t('Christ Catholic', 'catholique-chrétienne'),
};

export function assess(input: LuAssessInput): LuIccResult {
  const P = luParamsFor(input.taxYear);
  const y = input.taxYear;
  const C = communeOf(y, input.commune);
  const items = input.incomeItems.map(asItem);
  const wealthItems = input.wealthItems.map(asItem);
  const totals = incomeTotals(items);
  const wealth = wealthTotals(wealthItems);
  const family = input.tariff === 'family';
  const tariffName = family
    ? t(
        'family tariff (Familientarif, § 57 Abs. 2)',
        'barème des familles (Familientarif, § 57 al. 2)',
      )
    : t(
        'tariff for single persons (Tarif für Alleinstehende, § 57 Abs. 1)',
        'barème des personnes seules (Tarif für Alleinstehende, § 57 al. 1)',
      );
  const steps = tariffSteps(y);

  // The tax per unit (Steuer je Einheit).
  const income = incomeUnitLine(
    family ? P.incomeTariff.family : P.incomeTariff.single,
    totals.taxableIncome,
    steps,
    tariffName,
    input.tariffSources ?? [],
  );
  const incomePerUnit = income.line;
  const wTr = new Trace().from(wealth.taxableWealth);
  const wealthRate = wTr.p(P.wealthTariff).rate;
  const wealthStep = wTr.p(steps).wealth;
  const wealthTaxed =
    Math.floor(Math.max(0, wealth.taxableWealth.amount) / wealthStep) * wealthStep;
  const wealthAmount = roundCentime(wealthTaxFraction({ rate: wealthRate }, wealthTaxed), 100_000);
  const wealthPerUnit = wTr.line(
    wealthAmount,
    t(
      'Tax per unit on wealth (Steuer je Einheit, Vermögen)',
      'Impôt par unité sur la fortune (Steuer je Einheit, Vermögen)',
    ),
    t(
      `0.75 per mille (§ 60 Abs. 1) of the taxable wealth of ${chf(wealth.taxableWealth.amount)}, taken as ${chf(wealthTaxed)} (in whole CHF 1,000): ${chf(wealthAmount)}.`,
      `0,75 pour mille (§ 60 al. 1) de la fortune imposable de ${chf(wealth.taxableWealth.amount)}, prise pour ${chf(wealthTaxed)} (par tranches entières de CHF 1’000)${NB}: ${chf(wealthAmount)}.`,
    ),
  );
  const perUnitAmount = incomePerUnit.amount + wealthPerUnit.amount;
  const perUnit = new Trace()
    .src(multipliers(y).source)
    .from(incomePerUnit, wealthPerUnit)
    .line(
      perUnitAmount,
      t('Tax per unit (Steuer je Einheit)', 'Impôt par unité (Steuer je Einheit)'),
      t(
        `Income ${chf(incomePerUnit.amount)} + wealth ${chf(wealthPerUnit.amount)} = ${chf(perUnitAmount)}. The state, the commune and the parish each levy so many units of it.`,
        `Revenu ${chf(incomePerUnit.amount)} + fortune ${chf(wealthPerUnit.amount)} = ${chf(perUnitAmount)}. L’État, la commune et la paroisse en prélèvent chacun un nombre d’unités.`,
      ),
    );

  const scaled = (amount: number, u: number) => roundCentime(amount * u, 10_000);
  const sTr = new Trace().from(perUnit);
  const stateUnits = sTr.p(P.stateUnits);
  const cantonalAmount = scaled(perUnitAmount, stateUnits);
  const cantonal = sTr.line(
    cantonalAmount,
    t('State tax (Staatssteuer)', 'Impôt cantonal (Staatssteuer)'),
    t(
      `${chf(perUnitAmount)} x ${units(stateUnits)} units (${y}), to the centime: ${chf(cantonalAmount)}.`,
      `${chf(perUnitAmount)} x ${units(stateUnits).replace('.', ',')} unités (${y}), au centime${NB}: ${chf(cantonalAmount)}.`,
    ),
  );
  const communalAmount = scaled(perUnitAmount, C.units);
  const communal = new Trace()
    .from(perUnit)
    .src(P.communes.source)
    .line(
      communalAmount,
      t(
        `Communal tax of ${C.name} (Gemeindesteuer)`,
        `Impôt communal de ${C.name} (Gemeindesteuer)`,
      ),
      t(
        `${chf(perUnitAmount)} x ${units(C.units)} units of the commune, to the centime: ${chf(communalAmount)}.`,
        `${chf(perUnitAmount)} x ${units(C.units).replace('.', ',')} unités de la commune, au centime${NB}: ${chf(communalAmount)}.`,
      ),
    );

  // The church tax: each church's units for its share of the family's members (§ 240 Abs. 2).
  const parishUnits: Record<Exclude<Confession, 'none'>, number> = {
    catholic: C.catholic.units,
    reformed: C.reformed.units,
    christ_catholic: P.christCatholicUnits.value,
  };
  let church: Line | null = null;
  /** The church's units for the household: numerator over (10,000 x members). */
  let churchWeighted = 0;
  let members = 1;
  if (input.church) {
    members = input.church.length;
    if (members === 0) throw new LuInputError('The church tax needs at least one member.');
    const counts = CONFESSIONS.map(
      (c) => [c, input.church!.filter((m) => m === c).length] as const,
    ).filter(([, n]) => n > 0);
    churchWeighted = counts.reduce((s, [c, n]) => s + n * parishUnits[c], 0);
    if (counts.length) {
      const tr = new Trace().from(perUnit).src(P.communes.source, churchShares(y).source);
      if (counts.some(([c]) => c === 'christ_catholic')) tr.p(P.christCatholicUnits);
      const amount = roundCentime(perUnitAmount * churchWeighted, 10_000 * members);
      const [firstChurch, firstCount] = counts[0]!;
      const whole = counts.length === 1 && firstCount === members;
      const parts = counts.map(([c, n]) => ({
        en: `${CONFESSION_NAME[c].en} ${units(parishUnits[c])} for ${n} of ${members} members`,
        fr: `${CONFESSION_NAME[c].fr} ${units(parishUnits[c]).replace('.', ',')} pour ${n} membre${n > 1 ? 's' : ''} sur ${members}`,
      }));
      church = tr.line(
        amount,
        t('Church tax (Kirchensteuer)', 'Impôt ecclésiastique (Kirchensteuer)'),
        whole
          ? t(
              `${chf(perUnitAmount)} x ${units(parishUnits[firstChurch])} units of the ${CONFESSION_NAME[firstChurch].en} parish, to the centime: ${chf(amount)}.`,
              `${chf(perUnitAmount)} x ${units(parishUnits[firstChurch]).replace('.', ',')} unités de la paroisse ${CONFESSION_NAME[firstChurch].fr}, au centime${NB}: ${chf(amount)}.`,
            )
          : t(
              `${chf(perUnitAmount)} x the parishes’ units shared by members (${parts.map((p) => p.en).join('; ')}), to the centime: ${chf(amount)}.`,
              `${chf(perUnitAmount)} x les unités des paroisses partagées selon les membres (${parts.map((p) => p.fr).join(`${NB}; `)}), au centime${NB}: ${chf(amount)}.`,
            ),
      );
    }
  }

  // The maximum burden (§ 62): the income tax and the wealth tax of the state, the commune and the
  // parishes, each at most a share of the taxable income or wealth.
  const mb = maxBurden(y);
  const allUnits = (churchW: number, n: number) => ({
    numerator: (stateUnits + C.units) * n + churchW,
    denominator: 10_000 * n,
  });
  const levied = (amount: number, u: { numerator: number; denominator: number }) =>
    roundCentime(amount * u.numerator, u.denominator);
  const incomeAllowed = roundCentime(
    income.taxed * (family ? mb.value.familyBp : mb.value.singleBp),
    10_000,
  );
  const wealthAllowed = roundCentime(wealthTaxed * mb.value.wealth, 100_000);
  if (!input.church) {
    const highest = Math.max(...Object.values(parishUnits));
    const worst = allUnits(highest, 1);
    if (
      levied(incomePerUnit.amount, worst) > incomeAllowed ||
      levied(wealthPerUnit.amount, worst) > wealthAllowed
    ) {
      throw new LuUnsupported(NOTE.churchForCap);
    }
  }
  const total = allUnits(churchWeighted, members);
  const capLine = (
    perUnitLine: Line,
    allowed: number,
    base: Line,
    what: 'income' | 'wealth',
  ): Line | null => {
    const before = levied(perUnitLine.amount, total);
    if (before <= allowed) return null;
    const cut = before - allowed;
    const tr = new Trace().from(perUnitLine, base, church ?? undefined);
    tr.p(mb);
    const share =
      what === 'income'
        ? t(
            `${family ? '22.4' : '22.8'} % of the taxable income`,
            `${family ? '22,4' : '22,8'}${NB}% du revenu imposable`,
          )
        : t('3.0 per mille of the taxable wealth', '3,0 pour mille de la fortune imposable');
    return tr.line(
      -cut,
      what === 'income'
        ? t(
            'Maximum burden on income (Höchstbelastung)',
            'Charge maximale sur le revenu (Höchstbelastung)',
          )
        : t(
            'Maximum burden on wealth (Höchstbelastung)',
            'Charge maximale sur la fortune (Höchstbelastung)',
          ),
      t(
        `The ${what} tax of the state, the commune${church ? ' and the parish' : ''} (${chf(before)}) is above ${share.en} (${chf(allowed)}): cut by ${chf(cut)}.`,
        `L’impôt sur ${what === 'income' ? 'le revenu' : 'la fortune'} de l’État, de la commune${church ? ' et de la paroisse' : ''} (${chf(before)}) dépasse ${share.fr} (${chf(allowed)})${NB}: réduit de ${chf(cut)}.`,
      ),
    );
  };
  const incomeCap = capLine(incomePerUnit, incomeAllowed, totals.taxableIncome, 'income');
  const wealthCap = capLine(wealthPerUnit, wealthAllowed, wealth.taxableWealth, 'wealth');

  const pTr = new Trace();
  const pt = pTr.p(personalTax(y));
  const personal = pTr.line(
    pt.amount,
    t('Personal tax (Personalsteuer)', 'Impôt personnel (Personalsteuer)'),
    t(
      `${chf(pt.amount)} a year, once for the return (spouses pay one together).`,
      `${chf(pt.amount)} par an, une fois pour la déclaration (les époux en paient un ensemble).`,
    ),
  );

  const totalAmount =
    cantonalAmount +
    communalAmount +
    (church?.amount ?? 0) +
    (incomeCap?.amount ?? 0) +
    (wealthCap?.amount ?? 0) +
    personal.amount;
  const capText = (en: boolean) =>
    [incomeCap, wealthCap]
      .filter((x): x is Line => x !== null)
      .map((x) =>
        en
          ? ` less the maximum burden cut ${chf(-x.amount)}`
          : ` moins la réduction pour charge maximale ${chf(-x.amount)}`,
      )
      .join('');
  const totalLine = new Trace()
    .from(
      cantonal,
      communal,
      church ?? undefined,
      incomeCap ?? undefined,
      wealthCap ?? undefined,
      personal,
    )
    .src(multipliers(y).source)
    .line(
      totalAmount,
      t(
        `State and communal tax${church ? ', church tax' : ''} and personal tax (Staats- und Gemeindesteuern${church ? ', Kirchensteuer' : ''}, Personalsteuer)`,
        `Impôt cantonal et communal${church ? ', impôt ecclésiastique' : ''} et impôt personnel (Staats- und Gemeindesteuern${church ? ', Kirchensteuer' : ''}, Personalsteuer)`,
      ),
      t(
        `State ${chf(cantonalAmount)} + communal ${chf(communalAmount)}${church ? ` + church ${chf(church.amount)}` : ''}${capText(true)} + personal tax ${chf(personal.amount)} = ${chf(totalAmount)}.`,
        `Cantonal ${chf(cantonalAmount)} + communal ${chf(communalAmount)}${church ? ` + ecclésiastique ${chf(church.amount)}` : ''}${capText(false)} + impôt personnel ${chf(personal.amount)} = ${chf(totalAmount)}.`,
      ),
    );

  return {
    items,
    ...totals,
    tariff: input.tariff,
    wealth: { items: wealthItems, ...wealth },
    taxes: {
      incomePerUnit,
      wealthPerUnit,
      perUnit,
      cantonal,
      communal,
      church,
      incomeCap,
      wealthCap,
      personal,
      total: totalLine,
    },
  };
}
