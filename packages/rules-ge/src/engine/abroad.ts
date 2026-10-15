// A home or land abroad in Geneva (SPEC.md section 1, decided 14 October 2026), the simple case:
// one property, owned by one spouse or both, used by the household (or kept for its use or its
// family's), let to tenants, or land. It is taxed where it lies; Geneva and the federal tax count
// it only for the rate (exemption avec réserve de progression). The rules every canton shares are
// packages/rules-ch's (abroad/property.ts); this file puts the property on Geneva's form and
// splits the return.
//
// On the form (ge-2025-declaration-specimen): annexe D, like any property (guide p. 32: "sis à
// Genève, en Suisse ou à l'étranger"), 15.10 for a home the owner uses (D1, p. 15), 15.20 for one
// let and for land (D2, p. 16), the upkeep costs 58.00; the totals go to PG2 15.00 (income), PG3
// 58.00 and PG4 15.00 (wealth), so the subtotals and 95.00 are worldwide. Then PG3 and PG4:
// "95.00 Revenu net total, le cas échéant, revenu net pour le taux", "97.00 Part proportionnelle du
// revenu non imposable", "99.00 Revenu imposable", and the same for wealth (p. 3 and 4).
//
// The figures: the rental value by country and the rents of a property let
// (ge-na-revenu-immobilier-page); the value, the country's tax value or else the purchase price,
// at the rate of 31 December (ge-na-valeur-fiscale-page; guide p. 33); the upkeep, the flat rates
// of the guide (p. 33 and 35; LIPP art. 34 let. d) and of the federal instructions (p. 6). The
// split: debts and debt interest in proportion to where the gross assets lie (LIPP art. 57 for the
// debts; LIFD art. 6 al. 3 and zh-na-zstb-5-3 p. 1 for the interest), the wealth deductions the
// same way (LIPP art. 58 al. 3), the other deductions and the social deductions in proportion to
// the net income (LIFD art. 35 al. 3; zh-na-zstb-5-3 p. 1); the rate of the whole income and
// wealth (LIPP art. 6 al. 1; LIFD art. 7 al. 1).
import {
  ABROAD_RULES,
  chf,
  IFD_UPKEEP_FLAT,
  percent,
  roundFranc,
  shareAbroad,
  splitProblem,
  Trace,
  type IncomeSplit,
} from '@taxpresso/rules-ch';
import { codeFor, RUBRICS, isIncomeCode, type RubricCode } from './rubrics.js';
import type { YearParams } from './params.js';
import type { AbroadPropertyInput, Amount, Item, LimitApplied, Line, Text } from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const GUIDE = 'ge-2025-guide-declaration-pp';
const SPECIMEN = 'ge-2025-declaration-specimen';
const INCOME_PAGE = 'ge-na-revenu-immobilier-page (Votre bien est situé à l’étranger)';
const VALUE_PAGE = 'ge-na-valeur-fiscale-page (Votre bien est situé à l’étranger)';
/** Geneva's law on the split of debts and of the wealth deductions. */
const LIPP_SPLIT = 'ge-na-law-lipp art. 57 and 58 al. 3';
/** Geneva's law: the property abroad is out, the rate is the whole income's and wealth's. */
const LIPP_RATE = 'ge-na-law-lipp art. 5 al. 1 and 3, art. 6 al. 1';

/** The codes of a property abroad: its income and value, and its upkeep costs. */
export const ABROAD_CODES: ReadonlySet<string> = new Set(['15.10', '15.20', '58.00']);

/** What the engine says about a property abroad (plain words, with the documents). */
export const ABROAD_NOTE = {
  exempt: t(
    'Your property abroad is taxed where it lies. Geneva and the federal tax count its income and value only to set the rate of what they tax (exemption avec réserve de progression).',
    `Votre immeuble à l’étranger est imposé là où il se trouve. Genève et l’impôt fédéral comptent son revenu et sa valeur seulement pour fixer le taux de ce qu’ils imposent (exemption avec réserve de progression).`,
  ),
  split: t(
    'How the deductions are shared between Switzerland and abroad (97.00): the costs go with the income they belong to, the debt interest by where your gross assets lie, the other deductions and the social deductions in proportion to the net income, as the federal rules say (LIFD art. 6 al. 3 and 35 al. 3; the Zurich tax manual 5.3 sets them out). The Geneva documents name 97.00 "part proportionnelle" without saying how it is worked out, nor how it is rounded (to the franc here). Check with the AFC or GeTax.',
    `Partage des déductions entre la Suisse et l’étranger (97.00)${NB}: les frais suivent le revenu qu’ils concernent, les intérêts passifs la situation de vos actifs bruts, les autres déductions et les déductions sociales au prorata du revenu net, comme le disent les règles fédérales (LIFD art. 6 al. 3 et 35 al. 3${NB}; le manuel fiscal zurichois 5.3 les expose). Les documents genevois nomment le 97.00 «${NB}part proportionnelle${NB}» sans dire comment le calculer, ni l’arrondir (au franc ici). Vérifiez auprès de l’AFC ou avec GeTax.`,
  ),
  rate: t(
    'At the rate of your whole income and wealth: the scale is read at the totals (95.00), its tax applied to what is taxed here (99.00), each line to the nearest 5 centimes; the documents don’t spell out this rounding.',
    `Au taux de l’ensemble de votre revenu et de votre fortune${NB}: le barème est lu aux totaux (95.00), son impôt appliqué à ce qui est imposé ici (99.00), chaque ligne aux 5 centimes les plus proches${NB}; les documents ne précisent pas cet arrondi.`,
  ),
  ifdRate: t(
    'Federal tax at the rate of your whole income (LIFD art. 7): the scale’s tax on the whole income, as a rate, applied to the income taxed in Switzerland, both with the fraction under CHF 100 dropped and the tax rounded down to 5 centimes (Form. 58c notes 1 and 2); the documents don’t say how the rate itself is rounded.',
    `Impôt fédéral au taux de l’ensemble de votre revenu (LIFD art. 7)${NB}: l’impôt du barème sur le revenu entier, en taux, appliqué au revenu imposable en Suisse, les deux sans la fraction inférieure à CHF 100 et l’impôt ramené aux 5 centimes inférieurs (formule 58c notes 1 et 2)${NB}; les documents ne disent pas comment arrondir le taux lui-même.`,
  ),
  noAbattement: t(
    'Property abroad: the 4 % a year reduction for continuous use (abattement) is for property in Geneva (LIPP art. 50 let. e), so it is not applied to its value or its rental value. Check with the AFC.',
    `Immeuble à l’étranger${NB}: l’abattement de 4${NB}% par année d’occupation vaut pour les immeubles situés à Genève (LIPP art. 50 let. e)${NB}; il n’est donc appliqué ni à sa valeur ni à sa valeur locative. Vérifiez auprès de l’AFC.`,
  ),
  lowValue: t(
    'Property abroad: its value is the one the country sets. Where a country’s value is extremely low, Geneva estimates the property like a Geneva one (purchase price or cost of building) instead (ge.ch, la valeur fiscale).',
    `Immeuble à l’étranger${NB}: sa valeur est celle que fixe le pays. Si la valeur du pays est extrêmement basse, Genève estime l’immeuble comme un immeuble genevois (prix d’achat ou coût de construction) (ge.ch, la valeur fiscale).`,
  ),
  flatRentalValue: t(
    'Your home abroad: no rental value from the country is in yet, so 4.5 % of its value is counted, as for a country without a rental value like Switzerland’s. If the country sets one (in France, the taxe d’habitation or the taxes foncières), add its notice: it replaces this.',
    `Votre logement à l’étranger${NB}: aucune valeur locative du pays n’est encore là, donc 4,5${NB}% de sa valeur sont comptés, comme pour un pays sans équivalent à la valeur locative suisse. Si le pays en fixe une (en France, la taxe d’habitation ou les taxes foncières), ajoutez son avis${NB}: il remplace ce montant.`,
  ),
  franceFlat: t(
    'Your home in France: until its taxe d’habitation or taxes foncières notice is read, 4.5 % of its value is counted as an estimate of its rental value. The notice’s value replaces it.',
    `Votre logement en France${NB}: tant que l’avis de taxe d’habitation ou de taxes foncières n’est pas lu, 4,5${NB}% de sa valeur sont comptés comme estimation de sa valeur locative. La valeur de l’avis la remplace.`,
  ),
  noCosts: t(
    'Your property let abroad: no upkeep costs given, so none are counted for the cantonal tax (only the actual costs count there: guide p. 35); the federal tax counts its flat rate.',
    `Votre immeuble loué à l’étranger${NB}: aucun frais d’entretien indiqué, rien n’est donc compté pour l’impôt cantonal (seuls les frais effectifs y comptent${NB}: guide p. 35)${NB}; l’impôt fédéral compte son forfait.`,
  ),
  noValue: t(
    'Your property abroad: its value is not known yet, so it is not counted for the rate, nor are your debts split. The taxes are floors until its documents are in.',
    `Votre immeuble à l’étranger${NB}: sa valeur n’est pas encore connue, elle n’est donc pas comptée pour le taux, et vos dettes ne sont pas réparties. Les impôts sont des minimums jusqu’à ce que ses documents soient là.`,
  ),
  noIncome: t(
    'Your property abroad: its rental value or its rents are not known yet, so they are not counted for the rate. The taxes are floors until its documents are in.',
    `Votre immeuble à l’étranger${NB}: sa valeur locative ou ses loyers ne sont pas encore connus, ils ne sont donc pas comptés pour le taux. Les impôts sont des minimums jusqu’à ce que ses documents soient là.`,
  ),
  ageUnknown: t(
    'Your home abroad: its age on 1 January is not known, so no flat upkeep deduction is counted.',
    `Votre logement à l’étranger${NB}: son âge au 1er janvier n’est pas connu, aucun forfait d’entretien n’est donc compté.`,
  ),
} as const satisfies Record<string, Text>;

/** Why the household is outside the simple case, from the figures (fail closed). */
export const ABROAD_UNSUPPORTED = {
  loss_abroad: t(
    'Your property abroad: its costs and its share of your debt interest are more than it brings in (a loss abroad). A loss abroad counts only for the rate (LIFD art. 6 al. 3), and the documents don’t say how the deductions are shared then, so Taxpresso can’t prepare it yet and no tax is computed.',
    `Votre immeuble à l’étranger${NB}: ses frais et sa part de vos intérêts passifs dépassent ce qu’il rapporte (une perte à l’étranger). Une perte à l’étranger ne compte que pour le taux (LIFD art. 6 al. 3), et les documents ne disent pas comment répartir les déductions dans ce cas${NB}: Taxpresso ne peut pas encore le préparer, aucun impôt n’est donc calculé.`,
  ),
  loss_switzerland: t(
    'Your property abroad: your income in Switzerland, after its costs and its share of debt interest, is below zero. The documents don’t say how the split works then, so Taxpresso can’t prepare it yet and no tax is computed.',
    `Votre immeuble à l’étranger${NB}: votre revenu en Suisse, après ses frais et sa part des intérêts passifs, est négatif. Les documents ne disent pas comment répartir dans ce cas${NB}: Taxpresso ne peut pas encore le préparer, aucun impôt n’est donc calculé.`,
  ),
  interest_surplus: t(
    'Your debt interest, split between Switzerland and abroad by where your assets lie, leaves more interest in Switzerland than your Swiss savings and investments bring in. That surplus "can be moved abroad", but no document says how, so Taxpresso can’t prepare it yet and no tax is computed.',
    `Vos intérêts passifs, répartis entre la Suisse et l’étranger selon la situation de vos actifs, laissent en Suisse plus d’intérêts que vos placements suisses ne rapportent. Cet excédent «${NB}peut être reporté à l’étranger${NB}», mais aucun document ne dit comment${NB}: Taxpresso ne peut pas encore le préparer, aucun impôt n’est donc calculé.`,
  ),
  interest_cap: t(
    'Your debt interest is above the limit (the income from your wealth plus CHF 50,000), and the documents don’t say how that limit and the split with your property abroad combine, so Taxpresso can’t prepare it yet and no tax is computed.',
    `Vos intérêts passifs dépassent la limite (le rendement de votre fortune plus CHF 50${NB}000), et les documents ne disent pas comment cette limite et la répartition avec votre immeuble à l’étranger se combinent${NB}: Taxpresso ne peut pas encore le préparer, aucun impôt n’est donc calculé.`,
  ),
  ifd_children: t(
    'Federal tax not computed: with children and a property abroad, the reduction per child (LIFD art. 36 al. 2bis) would apply at the rate of your whole income, and no document says how. The cantonal and communal tax is computed.',
    `Impôt fédéral non calculé${NB}: avec des enfants et un immeuble à l’étranger, la réduction par enfant (LIFD art. 36 al. 2bis) s’appliquerait au taux de l’ensemble de votre revenu, et aucun document ne dit comment. L’impôt cantonal et communal est calculé.`,
  ),
} as const satisfies Record<string, Text>;

/** The property's own lines and figures, before the split. */
export interface AbroadFigures {
  /** 15.10 or 15.20 income and 58.00 costs, per tax. */
  icc: Item[];
  ifd: Item[];
  /** Its value (wealth), 15.10 or 15.20. */
  wealth: Item[];
  /** Its income and its own costs, per tax, in centimes. */
  income: { icc: number; ifd: number };
  costs: { icc: number; ifd: number };
  /** Its value, in centimes (0 when unknown). */
  value: number;
}

export interface AbroadNotes {
  assumption(x: Text): void;
  notCounted(x: Text): void;
  unverified(x: Text): void;
  incomplete(x: Text): void;
  limit(
    p: { source: string; estimate?: string },
    kind: LimitApplied['kind'],
    at: [string, 'household', LimitApplied['tax']],
    given: number,
    limit: number,
    counted: number,
  ): void;
}

function item(code: RubricCode, tr: Trace, amount: number, how: Text, label?: Text): Item {
  const r = RUBRICS[code];
  tr.src(r.source);
  return {
    code: codeFor(code, 'household'),
    person: 'household',
    ...tr.line(amount, label ?? r.label, how),
  };
}

/** amount x bp / 10,000 to the franc (Geneva's flat deductions are in whole francs: guide p. 19). */
const ofBp = (amount: number, bp: number) => roundFranc(amount * bp, 10_000);

/**
 * The lines of the property abroad on annexe D: its income (the rental value, or the rents) and
 * its upkeep costs in each tax, and its value. Nothing is split here.
 */
export function abroadItems(
  P: YearParams,
  a: AbroadPropertyInput,
  notes: AbroadNotes,
): AbroadFigures {
  const I = P.icc;
  const ifdFlat = IFD_UPKEEP_FLAT[P.taxYear];
  const out: AbroadFigures = {
    icc: [],
    ifd: [],
    wealth: [],
    income: { icc: 0, ifd: 0 },
    costs: { icc: 0, ifd: 0 },
    value: 0,
  };
  const code: RubricCode = a.use === 'own_use' ? '15.10' : '15.20';
  const where = a.country ? ` (${a.country.en})` : '';
  const whereFr = a.country ? ` (${a.country.fr})` : '';
  notes.unverified(ABROAD_NOTE.noAbattement);

  // Its value on 31 December: the country's tax value, else the purchase price (wealth, PG4 15.00).
  const vTrace = new Trace().src(VALUE_PAGE, `${GUIDE} p. 33`);
  const value = vTrace.a(a.value);
  if (a.value && value > 0) {
    const basis =
      a.valueBasis === 'tax_value'
        ? t('the tax value set by the country', 'la valeur fiscale fixée par le pays')
        : a.valueBasis === 'purchase_price'
          ? t(
              'the purchase price (the country sets no tax value)',
              'le prix d’achat (le pays ne fixe pas de valeur fiscale)',
            )
          : t('your own estimate', 'votre propre estimation');
    if (a.valueBasis === 'tax_value') notes.unverified(ABROAD_NOTE.lowValue);
    out.value = value;
    out.wealth.push(
      item(
        code,
        vTrace,
        value,
        t(
          `Your property abroad${where}, ${basis.en}, in francs at the rate of 31 December: ${chf(value)}. Counted for the rate only.`,
          `Votre immeuble à l’étranger${whereFr}, ${basis.fr}, en francs au cours du 31 décembre${NB}: ${chf(value)}. Compté seulement pour le taux.`,
        ),
        t(
          `Property abroad, value on 31 December (${RUBRICS[code].label.fr})`,
          `${RUBRICS[code].label.fr}, à l’étranger, valeur au 31 décembre`,
        ),
      ),
    );
  } else {
    notes.incomplete(ABROAD_NOTE.noValue);
  }

  /** Income on 15.10 or 15.20 in both taxes, and the costs in each (58.00). */
  const income = (amount: number, tr: Trace, how: Text) => {
    if (amount <= 0) return;
    const it = item(code, tr, amount, how);
    out.icc.push(it);
    out.ifd.push(it);
    out.income = { icc: amount, ifd: amount };
  };
  const costs = (tax: 'icc' | 'ifd', amount: number, tr: Trace, how: Text) => {
    if (amount <= 0) return;
    out[tax].push(item('58.00', tr, -amount, how));
    out.costs[tax] = amount;
  };
  /** The flat upkeep rate by the building's age, in basis points, or undefined when unknown. */
  const flatBp = (rates: { young: number; old: number }) =>
    a.old === undefined ? undefined : a.old ? rates.old : rates.young;

  if (a.use === 'own_use') {
    // The rental value: the country's (France: the taxe d'habitation's, or twice the taxes
    // foncières' base), with the flat upkeep; or, without one, 4.5 % of the value, net.
    if (a.rentalValue && a.rentalValue.value > 0) {
      const rTrace = new Trace().src(INCOME_PAGE);
      let rv = rTrace.a(a.rentalValue);
      let how: Text;
      if (a.rentalBasis === 'france_land_tax') {
        const factor = rTrace.p(I.franceLandTaxFactor);
        const base = rv;
        rv = base * factor;
        how = t(
          `Your home in France${where}: the taxes foncières’ base (${chf(base)}, “Commune” column) times ${factor}, in francs at the year’s average rate: ${chf(rv)}.`,
          `Votre logement en France${whereFr}${NB}: la base des taxes foncières (${chf(base)}, colonne «${NB}Commune${NB}») fois ${factor}, en francs au cours moyen de l’année${NB}: ${chf(rv)}.`,
        );
      } else {
        how =
          a.rentalBasis === 'france_habitation'
            ? t(
                `Your home in France${where}: the taxe d’habitation’s “Base d’imposition (valeur locative brute)”, in francs at the year’s average rate: ${chf(rv)}.`,
                `Votre logement en France${whereFr}${NB}: la «${NB}Base d’imposition (valeur locative brute)${NB}» de la taxe d’habitation, en francs au cours moyen de l’année${NB}: ${chf(rv)}.`,
              )
            : t(
                `Your home abroad${where}: the rental value the country sets, in francs at the year’s average rate: ${chf(rv)}.`,
                `Votre logement à l’étranger${whereFr}${NB}: la valeur locative fixée par le pays, en francs au cours moyen de l’année${NB}: ${chf(rv)}.`,
              );
      }
      income(rv, rTrace, how);
      // The flat upkeep, instead of the actual costs: 15 % or 25 % (ICC), 10 % or 20 % (IFD).
      const iccBp = flatBp({
        young: I.ownHomeUpkeepFlat.value.youngBp,
        old: I.ownHomeUpkeepFlat.value.oldBp,
      });
      const ifdBp = flatBp(ifdFlat.value);
      if (iccBp === undefined || ifdBp === undefined) {
        notes.notCounted(ABROAD_NOTE.ageUnknown);
      } else {
        const ci = new Trace().from(out.icc[0]);
        ci.p(I.ownHomeUpkeepFlat);
        costs(
          'icc',
          ofBp(rv, iccBp),
          ci,
          t(
            `Flat upkeep, ${percent(iccBp, 'en')} of the rental value (the building is ${a.old ? 'over' : 'at most'} 10 years old): ${chf(ofBp(rv, iccBp))}.`,
            `Forfait d’entretien, ${percent(iccBp, 'fr')} de la valeur locative (bâtiment ${a.old ? 'de plus de 10 ans' : 'de 10 ans au plus'})${NB}: ${chf(ofBp(rv, iccBp))}.`,
          ),
        );
        const cf = new Trace().from(out.ifd[0]);
        cf.p(ifdFlat);
        costs(
          'ifd',
          ofBp(rv, ifdBp),
          cf,
          t(
            `Flat upkeep, ${percent(ifdBp, 'en')} of the rental value (federal): ${chf(ofBp(rv, ifdBp))}.`,
            `Forfait d’entretien, ${percent(ifdBp, 'fr')} de la valeur locative (fédéral)${NB}: ${chf(ofBp(rv, ifdBp))}.`,
          ),
        );
      }
    } else if (out.value > 0) {
      // No rental value from the country: 4.5 % of the value, a net flat amount, no upkeep.
      const rTrace = new Trace().from(out.wealth[0]).src(INCOME_PAGE);
      const bp = rTrace.p(I.abroadRentalValueBp);
      const rv = ofBp(out.value, bp);
      if (a.france) {
        rTrace.estimates.add('input-estimate');
        notes.assumption(ABROAD_NOTE.franceFlat);
      } else {
        notes.assumption(ABROAD_NOTE.flatRentalValue);
      }
      income(
        rv,
        rTrace,
        t(
          `Your home abroad${where}: ${percent(bp, 'en')} of its value (${chf(out.value)}), a net flat rental value, no upkeep deducted: ${chf(rv)}.`,
          `Votre logement à l’étranger${whereFr}${NB}: ${percent(bp, 'fr')} de sa valeur (${chf(out.value)}), une valeur locative forfaitaire nette, sans frais d’entretien${NB}: ${chf(rv)}.`,
        ),
      );
    } else {
      notes.incomplete(ABROAD_NOTE.noIncome);
    }
  } else if (a.use === 'let') {
    if (a.rents && a.rents.value > 0) {
      const rTrace = new Trace().src(INCOME_PAGE, `${GUIDE} p. 35`);
      const rents = rTrace.a(a.rents);
      income(
        rents,
        rTrace,
        t(
          `Your property let abroad${where}: the rents received in the year, in francs at the year’s average rate: ${chf(rents)}.`,
          `Votre immeuble loué à l’étranger${whereFr}${NB}: les loyers encaissés dans l’année, en francs au cours moyen de l’année${NB}: ${chf(rents)}.`,
        ),
      );
      // Upkeep: the actual costs for the cantonal tax (no flat rate: guide p. 35); for the federal
      // tax the actual costs or the flat rate, whichever is higher (federal instructions p. 6).
      const kTrace = new Trace().src(`${GUIDE} p. 35`);
      const actual = kTrace.a(a.costs);
      if (actual > 0) {
        costs(
          'icc',
          actual,
          kTrace,
          t(
            `Actual upkeep, insurance and management costs: ${chf(actual)}.`,
            `Frais d’entretien, assurances et gérance effectifs${NB}: ${chf(actual)}.`,
          ),
        );
      } else {
        notes.notCounted(ABROAD_NOTE.noCosts);
      }
      const ifdBp = flatBp(ifdFlat.value);
      const flat = ifdBp === undefined ? 0 : ofBp(rents, ifdBp);
      if (ifdBp === undefined) notes.notCounted(ABROAD_NOTE.ageUnknown);
      const used = Math.max(actual, flat);
      if (used > 0) {
        const cf = new Trace().with(kTrace).from(out.ifd[0]);
        cf.p(ifdFlat);
        notes.limit(ifdFlat, 'choice', ['58.00', 'household', 'ifd'], actual, flat, used);
        costs(
          'ifd',
          used,
          cf,
          actual > flat
            ? t(
                `Actual costs (${chf(actual)}), higher than the flat ${percent(ifdBp ?? 0, 'en')} of the rents (${chf(flat)}): ${chf(used)}.`,
                `Frais effectifs (${chf(actual)}), plus élevés que le forfait de ${percent(ifdBp ?? 0, 'fr')} des loyers (${chf(flat)})${NB}: ${chf(used)}.`,
              )
            : t(
                `The flat ${percent(ifdBp ?? 0, 'en')} of the rents (the building is ${a.old ? 'over' : 'at most'} 10 years old), at least the actual costs (${chf(actual)}): ${chf(used)}.`,
                `Le forfait de ${percent(ifdBp ?? 0, 'fr')} des loyers (bâtiment ${a.old ? 'de plus de 10 ans' : 'de 10 ans au plus'}), au moins les frais effectifs (${chf(actual)})${NB}: ${chf(used)}.`,
              ),
        );
      }
    } else {
      notes.incomplete(ABROAD_NOTE.noIncome);
    }
  }
  return out;
}

/** The split of the return between Switzerland and abroad, in each tax and for wealth. */
export interface AbroadSplit {
  icc: IncomeSplit;
  ifd: IncomeSplit;
  /** The gross assets: abroad (the property) and in all. */
  wealth: { foreign: number; total: number };
  /** Why it can't be made (fail closed), when it can't. */
  problem?: keyof typeof ABROAD_UNSUPPORTED;
  debts?: Line;
  interestIcc?: Line;
  interestIfd?: Line;
  shareBp: number;
}

/** Codes whose deductions go with an income (annexe A and B, securities' costs, property, interest). */
const linked = (code: string) =>
  /^(31|41|32|42)\./.test(code) || code === '56.20' || code === '58.00' || code === '55.10';

/**
 * The split, from every item of the return: the gross assets here and abroad, the debts and the
 * debt interest that go abroad, the property's net income after its share of interest, and the
 * whole net income before the deductions that aren't linked to an income, in each tax.
 */
export function abroadSplit(input: {
  figures: AbroadFigures;
  icc: readonly Item[];
  ifd: readonly Item[];
  wealthItems: readonly Item[];
  /** The gross income from wealth in Switzerland (14.00 and the état des titres). */
  swissWealthIncome: number;
  /** The interest given, before any limit, and the limit's extra amount (50,000). */
  interestGiven: number;
  interestExtra: number;
}): AbroadSplit {
  const { figures } = input;
  const foreignGross = figures.value;
  // The property abroad's own value is its item: a property in Geneva on the same codes (15.10,
  // 15.20) is a Swiss asset.
  const swissGross = input.wealthItems
    .filter((i) => isIncomeCode(i.code) && !figures.wealth.includes(i))
    .reduce((s, i) => s + Math.max(0, i.amount), 0);
  const total = swissGross + foreignGross;
  const shareBp = total > 0 ? Math.round((foreignGross * 10_000) / total) : 0;
  const debtsAll = -input.wealthItems
    .filter((i) => !isIncomeCode(i.code) && i.code !== '51.50' && i.amount < 0)
    .reduce((s, i) => s + i.amount, 0);
  const sources = [LIPP_SPLIT, ABROAD_RULES.debts];
  const how = (what: Text, all: number, part: number): Text =>
    t(
      `${what.en}: ${chf(all)} in proportion to where your gross assets lie, ${chf(foreignGross)} abroad of ${chf(total)} (${(shareBp / 100).toFixed(2)} %): ${chf(part)} abroad.`,
      `${what.fr}${NB}: ${chf(all)} au prorata de la situation de vos actifs bruts, ${chf(foreignGross)} à l’étranger sur ${chf(total)} (${(shareBp / 100).toFixed(2).replace('.', ',')}${NB}%)${NB}: ${chf(part)} à l’étranger.`,
    );
  const foreignDebts = shareAbroad(debtsAll, foreignGross, total);
  const debtLine =
    debtsAll > 0
      ? new Trace()
          .src(...sources)
          .from(...input.wealthItems.filter((i) => i.code === '55.10'))
          .line(
            foreignDebts,
            t('Debts that go abroad', 'Dettes attribuées à l’étranger'),
            how(t('Your debts', 'Vos dettes'), debtsAll, foreignDebts),
          )
      : undefined;
  const one = (items: readonly Item[], tax: 'icc' | 'ifd') => {
    const interest = -items.filter((i) => i.code === '55.10').reduce((s, i) => s + i.amount, 0);
    const foreignInterest = shareAbroad(interest, foreignGross, total);
    const world = items
      .filter((i) => isIncomeCode(i.code) || linked(i.code))
      .reduce((s, i) => s + i.amount, 0);
    const foreign = figures.income[tax] - figures.costs[tax] - foreignInterest;
    const line =
      interest > 0
        ? new Trace()
            .src(...sources)
            .from(...items.filter((i) => i.code === '55.10'))
            .line(
              foreignInterest,
              t(
                `Debt interest that goes abroad, ${tax.toUpperCase()}`,
                `Intérêts passifs attribués à l’étranger, ${tax.toUpperCase()}`,
              ),
              how(t('Your debt interest', 'Vos intérêts passifs'), interest, foreignInterest),
            )
        : undefined;
    return { split: { foreign, world }, interest, foreignInterest, line };
  };
  const icc = one(input.icc, 'icc');
  const ifd = one(input.ifd, 'ifd');
  let problem: AbroadSplit['problem'];
  if (input.interestGiven > input.swissWealthIncome + input.interestExtra) problem = 'interest_cap';
  for (const x of [icc, ifd]) {
    problem ??= splitProblem(x.split, {
      swissShare: x.interest - x.foreignInterest,
      swissWealthIncome: input.swissWealthIncome,
    });
  }
  return {
    icc: icc.split,
    ifd: ifd.split,
    wealth: { foreign: foreignGross, total },
    ...(problem ? { problem } : {}),
    ...(debtLine ? { debts: debtLine } : {}),
    ...(icc.line ? { interestIcc: icc.line } : {}),
    ...(ifd.line ? { interestIfd: ifd.line } : {}),
    shareBp,
  };
}

/** The documents that say how the return is split and taxed at the rate of the whole. */
export const ABROAD_SOURCES = {
  income: [LIPP_RATE, ABROAD_RULES.exempt, ABROAD_RULES.deductions, `${SPECIMEN} p. 3`],
  wealth: [LIPP_RATE, LIPP_SPLIT, `${SPECIMEN} p. 4`],
  ifd: [ABROAD_RULES.exempt, ABROAD_RULES.rate, ABROAD_RULES.deductions, `${SPECIMEN} p. 3`],
} as const;

/** The value a figure of the property comes from, for the explanations. */
export const amountValue = (a: Amount | undefined) => a?.value ?? 0;
