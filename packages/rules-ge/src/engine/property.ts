// A property in Geneva (SPEC.md section 1, decided 14 October 2026), the simple case: one property,
// owned by one spouse or both, either the household's own home (a house, or a flat in PPE) or one
// let all year to someone else, in the commune where the household lives. The federal rules every
// canton shares are packages/rules-ch's (property/swiss.ts); this file puts the property on
// Geneva's form, with Geneva's own rules.
//
// On the form (ge-2025-declaration-specimen): annexe D, 15.10 for a home the owner uses (D1, p. 15:
// "Occupé dès le", "Capital selon estimation fiscale", "Abattement", "Capital après abattement",
// "Valeur locative brute" for the IFD, "Valeur locative après abattement" for the ICC, "Charges et
// frais d'entretien" for each tax, and the "Réduction de la valeur locative après application du
// taux d'effort"), 15.20 for one let (D2, p. 16: "Capital selon estimation", "Loyers encaissés",
// "Charges et frais d'entretien"); the totals go to PG2 15.00 (income), PG3 58.00 (upkeep) and PG4
// 15.00 (wealth).
//
// The rules: the rental value of a home in Geneva is set by the AFC and sent each year before
// 31 March (ge-na-revenu-immobilier-page); the tax value is the AFC's (ge-na-valeur-fiscale-page;
// ge-na-law-lefi; ge-na-law-rivfi), lowered by 4 % a year of continuous use, at most 40 %, for a
// home the owner uses (ge-na-law-lipp art. 50 let. e; guide p. 33); the cantonal rental value is the
// gross one less the same abattement (guide p. 33 and 34; LIPP art. 24 al. 2); it can't exceed the
// taux d'effort (LIPP art. 24 al. 2; guide p. 51); the upkeep is the actual costs or, for one's own
// home, the flat 15 % or 25 % of the cantonal rental value (LIPP art. 34 let. d; guide p. 33;
// ge-na-information-1-2021-frais-entretien p. 4), a property let the actual costs only for the
// cantonal tax (guide p. 35); the federal tax takes the gross rental value or the rents, and the
// actual costs or the flat 10 % or 20 % (packages/rules-ch). The choice is made for each tax
// (information 1/2021 p. 2). The impôt immobilier complémentaire is a tax of its own (LCP art. 76).
import {
  chf,
  federalUpkeep,
  IFD_UPKEEP_FLAT,
  percent,
  rentalValueTaxed,
  RENTAL_VALUE_REFORM,
  round5,
  roundFranc,
  SWISS_PROPERTY_INSTRUCTIONS,
  SWISS_PROPERTY_RULES,
  Trace,
} from '@taxpresso/rules-ch';
import type { IccSplitting } from '../2025/icc.js';
import { ABATTEMENT, EFFORT, IIC } from '../law/property.js';
import { codeFor, RUBRICS, type RubricCode } from './rubrics.js';
import type { YearParams } from './params.js';
import type {
  Item,
  LimitApplied,
  Line,
  PropertyResult,
  SwissPropertyInput,
  Text,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const GUIDE = 'ge-2025-guide-declaration-pp';
const SPECIMEN = 'ge-2025-declaration-specimen';
const INCOME_PAGE = 'ge-na-revenu-immobilier-page (Votre bien est situé dans le canton de Genève)';
const VALUE_PAGE = 'ge-na-valeur-fiscale-page (Votre bien est situé dans le canton de Genève)';
const UPKEEP_INFO = 'ge-na-information-1-2021-frais-entretien p. 2 and 4';

/** The lines of a property in Geneva, by what the form calls them. */
const LABEL = {
  valueOwn: t(
    'Your home, its value after the abattement (capital après abattement, 15.10)',
    'Capital après abattement (15.10)',
  ),
  valueLet: t(
    'Your property let, its tax value (capital selon estimation, 15.20)',
    'Capital selon estimation (15.20)',
  ),
  rentalIcc: t(
    'Rental value of your home after the abattement (valeur locative après abattement, 15.10)',
    'Valeur locative après abattement (15.10)',
  ),
  rentalIfd: t(
    'Rental value of your home (valeur locative brute, 15.10)',
    'Valeur locative brute (15.10)',
  ),
  rents: t('Rents of your property let (loyers encaissés, 15.20)', 'Loyers encaissés (15.20)'),
  upkeep: t(
    'Upkeep of your property (charges et frais d’entretien d’immeuble, 58.00)',
    'Charges et frais d’entretien d’immeuble (58.00)',
  ),
} as const;

/** What the engine says about a property in Geneva (plain words, with the documents). */
export const PROPERTY_NOTE = {
  noValue: t(
    'Your property in Geneva: its tax value is not known yet, so it is not counted in your wealth. The wealth tax is a floor until the AFC’s letter (or your last avis de taxation immobilier) is in.',
    `Votre immeuble à Genève${NB}: sa valeur fiscale n’est pas encore connue, elle n’est donc pas comptée dans votre fortune. L’impôt sur la fortune est un minimum jusqu’à ce que le courrier de l’AFC (ou votre dernier avis de taxation immobilier) soit là.`,
  ),
  noRentalValue: t(
    'Your home in Geneva: its rental value (valeur locative) is not known yet, so it is not counted. The taxes are floors until the AFC’s letter is in.',
    `Votre logement à Genève${NB}: sa valeur locative n’est pas encore connue, elle n’est donc pas comptée. Les impôts sont des minimums jusqu’à ce que le courrier de l’AFC soit là.`,
  ),
  noRents: t(
    'Your property let in Geneva: its rents of the year are not known yet, so they are not counted. The taxes are floors until its management account (compte de gestion) is in.',
    `Votre immeuble loué à Genève${NB}: ses loyers de l’année ne sont pas encore connus, ils ne sont donc pas comptés. Les impôts sont des minimums jusqu’à ce que son compte de gestion soit là.`,
  ),
  ageUnknown: t(
    'Your property in Geneva: its age on 1 January is not known, so no flat upkeep deduction is counted.',
    `Votre immeuble à Genève${NB}: son âge au 1er janvier n’est pas connu, aucun forfait d’entretien n’est donc compté.`,
  ),
  letNoCosts: t(
    'Your property let in Geneva: no actual upkeep costs given, so none are counted for the cantonal tax (only the actual costs count there: guide p. 35); the federal tax counts its flat rate.',
    `Votre immeuble loué à Genève${NB}: aucun frais d’entretien effectif indiqué, rien n’est donc compté pour l’impôt cantonal (seuls les frais effectifs y comptent${NB}: guide p. 35)${NB}; l’impôt fédéral compte son forfait.`,
  ),
  choice: t(
    'Upkeep of your property: for each tax, the higher of the flat deduction and your actual costs counts; the choice can differ between the cantonal and the federal tax (AFC information 1/2021). Keep the invoices: they are not attached, only shown on request.',
    `Entretien de votre immeuble${NB}: pour chaque impôt, le plus élevé du forfait et de vos frais effectifs compte${NB}; le choix peut différer entre l’impôt cantonal et l’impôt fédéral (information AFC 1/2021). Gardez les factures${NB}: elles ne sont pas jointes, seulement montrées sur demande.`,
  ),
  effortChecked: t(
    'The taux d’effort (LIPP art. 24 al. 2) doesn’t lower your rental value: it is under 20 % of your gross income, whichever way that income is read.',
    `Le taux d’effort (LIPP art. 24 al. 2) ne réduit pas votre valeur locative${NB}: elle est inférieure à 20${NB}% de votre revenu brut, de quelque façon qu’on le lise.`,
  ),
  effortInterest: t(
    'The taux d’effort (LIPP art. 24 al. 2) doesn’t lower your rental value: the limited value would count only if the interest that finances your home were not higher than it, and yours is higher.',
    `Le taux d’effort (LIPP art. 24 al. 2) ne réduit pas votre valeur locative${NB}: la valeur limitée ne compterait que si les intérêts qui financent votre logement ne la dépassaient pas, et les vôtres la dépassent.`,
  ),
  iic: t(
    'The impôt immobilier complémentaire (IIC) is a yearly tax of its own on property in Geneva: 1 per mille of its tax value, 0.2 per mille for your main home, without the abattement and without deducting debts (LCP art. 76). It is shown apart, not in the total. A building with a high energy performance standard (HPE, THPE) is exempt for 20 years once the OCEN attests it (LCP art. 78): then it is not due.',
    `L’impôt immobilier complémentaire (IIC) est un impôt annuel à part sur les immeubles à Genève${NB}: 1 pour mille de leur valeur fiscale, 0,2 pour mille pour votre résidence principale, sans abattement et sans déduction des dettes (LCP art. 76). Il est montré à part, hors du total. Un bâtiment de haute ou très haute performance énergétique (HPE, THPE) en est exonéré 20 ans une fois attesté par l’OCEN (LCP art. 78)${NB}: il n’est alors pas dû.`,
  ),
  iicRounding: t(
    'The impôt immobilier complémentaire is taken to the nearest 5 centimes; the documents don’t say how it is rounded.',
    `L’impôt immobilier complémentaire est arrondi aux 5 centimes les plus proches${NB}; les documents ne disent pas comment l’arrondir.`,
  ),
  abattementYears: t(
    'The abattement counts the years of continuous use from the year you moved in to this year, both included, as the guide’s example does (2010 to 2025, 16 years); the years of a spouse, parent or sibling it came to you from count too (LIPP art. 50 let. e).',
    `L’abattement compte les années d’occupation continue de l’année d’emménagement à cette année, toutes deux comprises, comme l’exemple du guide (2010 à 2025, 16 ans)${NB}; celles d’un conjoint, parent ou frère et sœur dont le bien vous vient comptent aussi (LIPP art. 50 let. e).`,
  ),
  documentValues: t(
    'Your property in Geneva: its tax value and its rental value are the AFC’s for the year (its letter before 31 March, or the avis de taxation immobilier); Taxpresso doesn’t compute them (LEFI, RIVFI).',
    `Votre immeuble à Genève${NB}: sa valeur fiscale et sa valeur locative sont celles de l’AFC pour l’année (son courrier avant le 31 mars, ou l’avis de taxation immobilier)${NB}; Taxpresso ne les calcule pas (LEFI, RIVFI).`,
  ),
} as const satisfies Record<string, Text>;

/** Why the household is outside the simple case, from the figures (fail closed). */
export const PROPERTY_UNSUPPORTED = {
  effort: t(
    'Your home’s rental value may be lowered by the taux d’effort: it can’t exceed 20 % of your gross income (LIPP art. 24 al. 2), and the documents don’t say whether that income counts the rental value itself, so Taxpresso can’t prepare it yet and the cantonal and communal tax is not computed. The AFC’s calculation form (search "taux d’effort" on ge.ch) or GeTax works it out. The federal tax is computed.',
    `La valeur locative de votre logement peut être réduite par le taux d’effort${NB}: elle ne peut pas dépasser 20${NB}% de votre revenu brut (LIPP art. 24 al. 2), et les documents ne disent pas si ce revenu compte la valeur locative elle-même${NB}; Taxpresso ne peut pas encore le préparer, l’impôt cantonal et communal n’est donc pas calculé. Le formulaire de calcul de l’AFC (cherchez «${NB}taux d’effort${NB}» sur ge.ch) ou GeTax le fait. L’impôt fédéral est calculé.`,
  ),
  reform: t(
    'From 2029 the rental value of a home its owner lives in is no longer taxed (ch-na-reforme-valeur-locative-2029): Taxpresso has no rules for that year yet, so no tax is computed.',
    `Dès 2029, la valeur locative d’un logement occupé par son propriétaire n’est plus imposée${NB}: Taxpresso n’a pas encore les règles de cette année, aucun impôt n’est donc calculé.`,
  ),
} as const satisfies Record<string, Text>;

export interface PropertyNotes {
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

/** The property's own lines and figures, as computed before the rest of the return. */
export interface PropertyFigures extends Omit<PropertyResult, 'effort'> {
  /** Its income in each tax, in centimes: the rental value (ICC after the abattement) or the rents. */
  income: { icc: number; ifd: number };
  /** Own home: the cantonal rental value, the line the taux d'effort is checked against. */
  rentalIcc?: Item;
  /** Why the household is outside the simple case, from the figures (fail closed). */
  problem?: keyof typeof PROPERTY_UNSUPPORTED;
}

function item(code: RubricCode, tr: Trace, amount: number, how: Text, label: Text): Item {
  tr.src(RUBRICS[code].source);
  return { code: codeFor(code, 'household'), person: 'household', ...tr.line(amount, label, how) };
}

/** amount x bp / 10,000 to the franc (the form's amounts are whole francs: guide p. 34 example). */
const ofBp = (amount: number, bp: number) => roundFranc(amount * bp, 10_000);

/**
 * The lines of a property in Geneva on annexe D: its value for the wealth tax, its income (the
 * rental value, or the rents) and its upkeep in each tax, and the impôt immobilier complémentaire.
 * The taux d'effort is checked once the gross income is known (effortCheck below).
 */
export function propertyItems(
  P: YearParams,
  a: SwissPropertyInput,
  notes: PropertyNotes,
): PropertyFigures {
  const I = P.icc;
  const own = a.use === 'own_home';
  const code: RubricCode = own ? '15.10' : '15.20';
  const out: PropertyFigures = {
    owner: a.owner,
    use: a.use,
    ...(a.kind ? { kind: a.kind } : {}),
    ...(own && a.since !== undefined ? { since: a.since } : {}),
    icc: [],
    ifd: [],
    wealth: [],
    income: { icc: 0, ifd: 0 },
    upkeep: { icc: 'none', ifd: 'none' },
  };
  // The reform ends the rental value of a home its owner lives in on 1 January 2029: never for
  // tax years 2025 and 2026, but a later year has no rules here (fail closed).
  if (!rentalValueTaxed(P.taxYear)) {
    out.problem = 'reform';
    return out;
  }
  notes.unverified(PROPERTY_NOTE.documentValues);

  // The abattement for continuous use by the same owner (own home only): 4 % a year, at most 40 %.
  let bp = 0;
  if (own && a.since !== undefined) {
    const years = Math.max(0, P.taxYear - a.since + 1);
    bp = Math.min(years * ABATTEMENT.value.perYearBp, ABATTEMENT.value.maxBp);
    out.abattementBp = bp;
    notes.unverified(PROPERTY_NOTE.abattementYears);
  }
  const abattementHow = (years: number) =>
    t(
      `${years} year${years === 1 ? '' : 's'} of continuous use since ${a.since} (${years} x 4 %, at most 40 %): ${percent(bp, 'en')}`,
      `${years} an${years === 1 ? '' : 's'} d’occupation continue depuis ${a.since} (${years} x 4${NB}%, au plus 40${NB}%)${NB}: ${percent(bp, 'fr')}`,
    );
  const years = own && a.since !== undefined ? Math.max(0, P.taxYear - a.since + 1) : 0;

  // Its value: the AFC's tax value for the year; for one's own home less the abattement.
  const vTrace = new Trace().src(VALUE_PAGE, `${GUIDE} p. 32 and 33`, 'ge-na-law-lipp art. 50');
  const value = vTrace.a(a.value);
  if (a.value && value > 0) {
    out.value = vTrace.line(
      value,
      t(
        'Its tax value for the year (capital selon estimation fiscale)',
        'Capital selon estimation fiscale',
      ),
      t(
        `The tax value the AFC sets for the year: ${chf(value)}.`,
        `La valeur fiscale fixée par l’AFC pour l’année${NB}: ${chf(value)}.`,
      ),
    );
    if (own) {
      const wTrace = new Trace().from(out.value);
      wTrace.p(ABATTEMENT);
      const off = ofBp(value, bp);
      const after = value - off;
      out.wealth.push(
        item(
          code,
          wTrace,
          after,
          a.since === undefined
            ? t(
                `The tax value ${chf(value)}; the year you moved in is not known, so no abattement: ${chf(after)}.`,
                `La valeur fiscale ${chf(value)}${NB}; l’année d’emménagement n’est pas connue, donc pas d’abattement${NB}: ${chf(after)}.`,
              )
            : t(
                `The tax value ${chf(value)} less the abattement, ${abattementHow(years).en} (${chf(off)}): ${chf(after)}.`,
                `La valeur fiscale ${chf(value)} moins l’abattement, ${abattementHow(years).fr} (${chf(off)})${NB}: ${chf(after)}.`,
              ),
          LABEL.valueOwn,
        ),
      );
    } else {
      out.wealth.push(
        item(
          code,
          new Trace().from(out.value),
          value,
          t(
            `The tax value the AFC sets for the year, with no abattement (the property is let): ${chf(value)}.`,
            `La valeur fiscale fixée par l’AFC pour l’année, sans abattement (l’immeuble est loué)${NB}: ${chf(value)}.`,
          ),
          LABEL.valueLet,
        ),
      );
    }
    // The impôt immobilier complémentaire: on the tax value, without the abattement and debts.
    const iTrace = new Trace().from(out.value);
    const rates = iTrace.p(IIC);
    const rate = own ? rates.mainHome : rates.rate;
    const iic = round5(value * rate, rates.denominator);
    out.iic = iTrace.line(
      iic,
      t(
        'Impôt immobilier complémentaire (IIC), apart from the total',
        'Impôt immobilier complémentaire (IIC)',
      ),
      t(
        `${own ? '0.2' : '1'} per mille of the tax value ${chf(value)}${own ? ' (your main home)' : ''}, without the abattement and without deducting debts, to 5 centimes: ${chf(iic)}.`,
        `${own ? '0,2' : '1'} pour mille de la valeur fiscale ${chf(value)}${own ? ' (votre résidence principale)' : ''}, sans abattement et sans déduction des dettes, aux 5 centimes${NB}: ${chf(iic)}.`,
      ),
    );
    notes.unverified(PROPERTY_NOTE.iic);
    notes.unverified(PROPERTY_NOTE.iicRounding);
  } else {
    notes.incomplete(PROPERTY_NOTE.noValue);
  }

  const actualTrace = new Trace().src(`${GUIDE} p. 33 to 35`, UPKEEP_INFO);
  const actual = actualTrace.a(a.upkeep);
  /** The upkeep line of one tax (58.00), negative. */
  const upkeepItem = (tax: 'icc' | 'ifd', amount: number, tr: Trace, how: Text) => {
    if (amount <= 0) return;
    out[tax].push(item('58.00', tr, -amount, how, LABEL.upkeep));
  };

  if (own) {
    if (!(a.rentalValue && a.rentalValue.value > 0)) {
      notes.incomplete(PROPERTY_NOTE.noRentalValue);
      if (actual > 0) {
        // The actual costs count even before the rental value is known.
        upkeepItem(
          'icc',
          actual,
          new Trace().with(actualTrace).src(...actualTrace.sources),
          t(
            `Actual upkeep costs: ${chf(actual)}.`,
            `Frais d’entretien effectifs${NB}: ${chf(actual)}.`,
          ),
        );
        upkeepItem(
          'ifd',
          actual,
          new Trace().with(actualTrace).src(...actualTrace.sources),
          t(
            `Actual upkeep costs: ${chf(actual)}.`,
            `Frais d’entretien effectifs${NB}: ${chf(actual)}.`,
          ),
        );
        out.upkeep = { icc: 'actual', ifd: 'actual' };
      }
      return out;
    }
    // The rental value the AFC sets (IFD: as it is; ICC: less the abattement).
    const rTrace = new Trace().src(INCOME_PAGE, `${GUIDE} p. 33`, 'ge-na-law-lipp art. 24 al. 2');
    rTrace.src(SWISS_PROPERTY_RULES.income, SWISS_PROPERTY_INSTRUCTIONS[P.taxYear].rentalValue);
    const rv = rTrace.a(a.rentalValue);
    out.rentalValue = rTrace.line(
      rv,
      t('Rental value of your home for the year (valeur locative)', 'Valeur locative'),
      t(
        `The rental value the AFC sets for the year: ${chf(rv)}.`,
        `La valeur locative fixée par l’AFC pour l’année${NB}: ${chf(rv)}.`,
      ),
    );
    const ifdIncome = item(
      code,
      new Trace().from(out.rentalValue),
      rv,
      t(
        `The rental value the AFC sets for the year, as it is for the federal tax: ${chf(rv)}.`,
        `La valeur locative fixée par l’AFC pour l’année, telle quelle pour l’impôt fédéral${NB}: ${chf(rv)}.`,
      ),
      LABEL.rentalIfd,
    );
    out.ifd.push(ifdIncome);
    const cTrace = new Trace().from(out.rentalValue);
    cTrace.p(ABATTEMENT);
    const off = ofBp(rv, bp);
    const rvIcc = rv - off;
    const iccIncome = item(
      code,
      cTrace,
      rvIcc,
      a.since === undefined
        ? t(
            `The rental value ${chf(rv)}; the year you moved in is not known, so no abattement: ${chf(rvIcc)}.`,
            `La valeur locative ${chf(rv)}${NB}; l’année d’emménagement n’est pas connue, donc pas d’abattement${NB}: ${chf(rvIcc)}.`,
          )
        : t(
            `The rental value ${chf(rv)} less the same abattement, ${abattementHow(years).en} (${chf(off)}): ${chf(rvIcc)}.`,
            `La valeur locative ${chf(rv)} moins le même abattement, ${abattementHow(years).fr} (${chf(off)})${NB}: ${chf(rvIcc)}.`,
          ),
      LABEL.rentalIcc,
    );
    out.icc.push(iccIncome);
    out.rentalIcc = iccIncome;
    out.income = { icc: rvIcc, ifd: rv };

    // Upkeep, ICC: the flat 15 % or 25 % of the cantonal rental value, or the actual costs.
    const flatBp =
      a.old === undefined
        ? undefined
        : a.old
          ? I.ownHomeUpkeepFlat.value.oldBp
          : I.ownHomeUpkeepFlat.value.youngBp;
    if (flatBp === undefined) notes.notCounted(PROPERTY_NOTE.ageUnknown);
    const flatIcc = flatBp === undefined ? 0 : ofBp(rvIcc, flatBp);
    const usedIcc = Math.max(flatIcc, actual);
    if (usedIcc > 0) {
      const tr = new Trace().with(actualTrace).from(iccIncome).src(UPKEEP_INFO);
      if (flatBp !== undefined) tr.p(I.ownHomeUpkeepFlat);
      if (actual > 0 && flatBp !== undefined) {
        notes.limit(
          I.ownHomeUpkeepFlat,
          'choice',
          ['58.00', 'household', 'icc'],
          actual,
          flatIcc,
          usedIcc,
        );
      }
      out.upkeep.icc = actual > flatIcc ? 'actual' : 'flat';
      upkeepItem(
        'icc',
        usedIcc,
        tr,
        actual > flatIcc
          ? t(
              `Actual upkeep costs ${chf(actual)}${flatBp !== undefined ? `, more than the flat ${percent(flatBp, 'en')} of the rental value after the abattement (${chf(flatIcc)})` : ''}: ${chf(usedIcc)}.`,
              `Frais d’entretien effectifs ${chf(actual)}${flatBp !== undefined ? `, plus que le forfait de ${percent(flatBp, 'fr')} de la valeur locative après abattement (${chf(flatIcc)})` : ''}${NB}: ${chf(usedIcc)}.`,
            )
          : t(
              `The flat ${percent(flatBp!, 'en')} of the rental value after the abattement, ${chf(rvIcc)} (the building is ${a.old ? 'over' : 'at most'} 10 years old), at least the actual costs (${chf(actual)}): ${chf(usedIcc)}.`,
              `Le forfait de ${percent(flatBp!, 'fr')} de la valeur locative après abattement, ${chf(rvIcc)} (bâtiment ${a.old ? 'de plus de 10 ans' : 'de 10 ans au plus'}), au moins les frais effectifs (${chf(actual)})${NB}: ${chf(usedIcc)}.`,
            ),
      );
    }
    // Upkeep, IFD: the flat 10 % or 20 % of the gross rental value, or the actual costs.
    const federal = federalUpkeep({
      taxYear: P.taxYear,
      income: rv,
      ...(a.old !== undefined ? { old: a.old } : {}),
      actual,
      inputs: [actualTrace],
      base: t('the rental value', 'de la valeur locative'),
    });
    if (federal.used !== 'none') {
      federal.trace.from(ifdIncome);
      if (actual > 0 && federal.flat !== undefined) {
        notes.limit(
          IFD_UPKEEP_FLAT[P.taxYear],
          'choice',
          ['58.00', 'household', 'ifd'],
          actual,
          federal.flat,
          federal.amount,
        );
      }
      out.upkeep.ifd = federal.used;
      upkeepItem('ifd', federal.amount, federal.trace, federal.how);
    }
    if (actual > 0) notes.assumption(PROPERTY_NOTE.choice);
    return out;
  }

  // Let all year: the rents received, in both taxes.
  if (!(a.rents && a.rents.value > 0)) {
    notes.incomplete(PROPERTY_NOTE.noRents);
    return out;
  }
  const rTrace = new Trace().src(
    'ge-na-revenu-immobilier-page (Si vous louez votre bien)',
    `${GUIDE} p. 35`,
    'ge-na-law-lipp art. 24 al. 1 let. a',
    SWISS_PROPERTY_RULES.income,
  );
  const rents = rTrace.a(a.rents);
  const rentsItem = item(
    code,
    rTrace,
    rents,
    t(
      `The rents received in the year (loyers encaissés), from its management account: ${chf(rents)}.`,
      `Les loyers encaissés dans l’année, selon son compte de gestion${NB}: ${chf(rents)}.`,
    ),
    LABEL.rents,
  );
  out.icc.push(rentsItem);
  out.ifd.push(rentsItem);
  out.income = { icc: rents, ifd: rents };
  // Upkeep, ICC: the actual costs only (no flat rate for a property let: guide p. 35).
  if (actual > 0) {
    out.upkeep.icc = 'actual';
    upkeepItem(
      'icc',
      actual,
      new Trace().with(actualTrace).src(`${GUIDE} p. 35`, UPKEEP_INFO),
      t(
        `Actual upkeep, insurance and management costs: ${chf(actual)} (no flat rate for a property let, cantonal tax).`,
        `Frais d’entretien, assurances et gérance effectifs${NB}: ${chf(actual)} (pas de forfait pour un immeuble loué, impôt cantonal).`,
      ),
    );
  } else {
    notes.notCounted(PROPERTY_NOTE.letNoCosts);
  }
  // Upkeep, IFD: the actual costs or the flat 10 % or 20 % of the rents.
  if (a.old === undefined) notes.notCounted(PROPERTY_NOTE.ageUnknown);
  const federal = federalUpkeep({
    taxYear: P.taxYear,
    income: rents,
    ...(a.old !== undefined ? { old: a.old } : {}),
    actual,
    inputs: [actualTrace],
    base: t('the rents', 'des loyers'),
  });
  if (federal.used !== 'none') {
    federal.trace.from(rentsItem);
    if (actual > 0 && federal.flat !== undefined) {
      notes.limit(
        IFD_UPKEEP_FLAT[P.taxYear],
        'choice',
        ['58.00', 'household', 'ifd'],
        actual,
        federal.flat,
        federal.amount,
      );
    }
    out.upkeep.ifd = federal.used;
    upkeepItem('ifd', federal.amount, federal.trace, federal.how);
  }
  if (actual > 0) notes.assumption(PROPERTY_NOTE.choice);
  return out;
}

/**
 * The check of the taux d'effort (LIPP art. 24 al. 2) for one's own home in Geneva: the cantonal
 * rental value can't exceed 20 % of the gross income, taken at least at the first tax-free bracket
 * (x 1, 2 or 1.8 by the splitting). The documents name the gross income 91.00 (guide p. 51), which
 * holds the rental value itself, without saying whether the limit is read before or after the
 * reduction, or without the rental value: when no reading lowers the rental value, it is said and
 * nothing changes; when one could, the cantonal tax fails closed. The limited value counts only if
 * the interest that finances the home is not higher than it: interest above every reading's limit
 * also leaves the rental value as it is.
 */
export function effortCheck(
  P: YearParams,
  input: {
    rentalIcc: Item;
    /** The gross income 91.00 (ICC), the rental value included. */
    grossIncome: Line;
    splitting: IccSplitting;
    /** The interest of the year on the mortgage of the home, when known. */
    mortgageInterest?: number;
  },
): { line: Line; applies: 'no' | 'interest' | 'maybe' } {
  const tr = new Trace().from(input.rentalIcc, input.grossIncome);
  const rule = tr.p(EFFORT);
  const scale = tr.p(P.icc.incomeScale);
  const first = scale.brackets[0]!;
  const freeBracket = first[1] === 0 ? first[0] * 100 : 0;
  const factor = rule.factor[input.splitting];
  const minimum = Math.round((freeBracket * factor) / 10);
  const vla = input.rentalIcc.amount;
  const other = Math.max(0, input.grossIncome.amount - vla);
  const share = (x: number) => roundFranc(x * rule.shareBp, 10_000);
  /** The smallest limit any reading gives, and the largest. */
  const lowest = share(Math.max(other, minimum));
  const highest = Math.max(share(Math.max(other + vla, minimum)), roundFranc(other * 2500, 10_000));
  const interest = input.mortgageInterest;
  const applies: 'no' | 'interest' | 'maybe' =
    vla <= lowest ? 'no' : interest !== undefined && interest > highest ? 'interest' : 'maybe';
  const line = tr.line(
    lowest,
    t(
      'Taux d’effort, the lowest limit of the rental value',
      'Taux d’effort, limite la plus basse de la valeur locative',
    ),
    applies === 'no'
      ? t(
          `20 % of your gross income without the rental value (${chf(other)}), at least of ${chf(minimum)} (the first tax-free bracket${factor === 10 ? '' : factor === 20 ? ' x 2' : ' x 1.8'}): ${chf(lowest)}. Your rental value after the abattement, ${chf(vla)}, is not above it: no reduction.`,
          `20${NB}% de votre revenu brut sans la valeur locative (${chf(other)}), au moins de ${chf(minimum)} (la première tranche exonérée${factor === 10 ? '' : factor === 20 ? ' x 2' : ' x 1,8'})${NB}: ${chf(lowest)}. Votre valeur locative après abattement, ${chf(vla)}, ne la dépasse pas${NB}: pas de réduction.`,
        )
      : applies === 'interest'
        ? t(
            `Your rental value after the abattement, ${chf(vla)}, is above 20 % of your gross income (${chf(lowest)} at the lowest, ${chf(highest)} at the highest reading), but the interest that finances your home, ${chf(interest!)}, is higher than any limited value: no reduction (LIPP art. 24 al. 2, last sentence).`,
            `Votre valeur locative après abattement, ${chf(vla)}, dépasse 20${NB}% de votre revenu brut (${chf(lowest)} au plus bas, ${chf(highest)} au plus haut), mais les intérêts qui financent votre logement, ${chf(interest!)}, dépassent toute valeur limitée${NB}: pas de réduction (LIPP art. 24 al. 2, dernière phrase).`,
          )
        : t(
            `Your rental value after the abattement, ${chf(vla)}, is above 20 % of your gross income read without it (${chf(lowest)}): the taux d’effort may lower it, and how is not spelled out.`,
            `Votre valeur locative après abattement, ${chf(vla)}, dépasse 20${NB}% de votre revenu brut lu sans elle (${chf(lowest)})${NB}: le taux d’effort peut la réduire, et la façon n’est pas précisée.`,
          ),
  );
  return { line, applies };
}

/** The documents that say what the property's lines are, for the result's words. */
export const PROPERTY_SOURCES = {
  form: `${SPECIMEN} p. 2 to 4, 15 and 16`,
  reform: RENTAL_VALUE_REFORM.source,
} as const;
