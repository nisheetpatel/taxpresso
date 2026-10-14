// Self-employment on the Geneva form (annexe B, activité lucrative indépendante), the simple case: a
// sole proprietor's year from their accounts or simple records, as packages/rules-ch reads it
// (business/self-employment.ts), put on the rubrics of annexe B (ge-2025-declaration-specimen p. 7
// to 10) as the guide for the self-employed explains them (ge-2025-guide-independants p. 10 to 24).
//
// - B2, the profit and loss account: 12.17 total revenue (12.08 + 12.09 + 12.15 + 12.16, p. 13),
//   12.45 total charges (12.21 + 12.22 + 12.23 + 12.24 + 12.41 + 12.42, p. 15), 12.46 the result
//   (12.17 - 12.45, p. 15); positive, 12.01 bénéfice net, to PG2 12.00 in both columns; negative,
//   57.10 perte commerciale (p. 16). 57.20: losses of the seven previous business years not deducted
//   yet (p. 16; LIPP art. 30 let. f; LIFD art. 31); 57.00 = 57.10 + 57.20, to PG3 57.00 (p. 16).
//   12.18, 12.28 and 12.29 (qualified participations, patent box, research) are not supported.
// - B2, the balance sheet: 12.50 gross business assets (12.48 + 12.49) to PG4 12.00; 57.50 business
//   debts to PG4 57.00; 12.52 equity (12.50 - 57.50) (p. 16 and 17).
// - B4: the owner's AVS/AI/APG contributions, 32.10 for the business year and 32.11 for earlier
//   years after final decisions (p. 22), deducted in full in both taxes (LIPP art. 31 let. a; LIFD
//   art. 33 al. 1 let. d and f). 32.40 pillar 3a and the two-earner deduction 32.90 / 32.95 are
//   placed by ./compute.ts with the employment rubrics they replace; 32.00 is their total.
// - PG4 51.60: half the business wealth invested, at most the indexed maximum (LIPP art. 58 al. 2;
//   ge-2025-guide-declaration-pp p. 16; ge-2025-guide-independants p. 17 and 18).
// The codes of annexe B are the same for taxpayer A and B: one sheet per person and per business.
import {
  businessYear,
  chf,
  lossWindow,
  resultHow,
  shareFranc,
  Trace,
  type BusinessFigure,
  type BusinessInput,
  type BusinessYear,
} from '@taxpresso/rules-ch';
import type { YearParams } from './params.js';
import { RUBRICS, type RubricCode } from './rubrics.js';
import type { BusinessSheet, EnginePerson, Item, LimitApplied, Text } from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
export const INDEP = 'ge-2025-guide-independants';
const LIPP = 'ge-na-law-lipp';

/** What a person's business gives the return. */
export interface BusinessItems {
  /** For the return: 12.01 or 57.10, 57.20, 32.10, 32.11, in each tax. */
  icc: Item[];
  ifd: Item[];
  /** For the wealth: 12.50, 57.50, 51.60. */
  wealth: Item[];
  /** The lines the form adds up itself (12.17, 12.45, 12.46, 57.00, 12.52), for the copy panel. */
  sheet: BusinessSheet;
  /** The year's figures (rules-ch). */
  year: BusinessYear;
  /** The result less the owner's AVS/AI/APG contributions, for pillar 3a (guide p. 23). */
  earned: number;
  /** A loss this year (57.10). */
  loss: boolean;
}

/** The notes the business adds to the result. */
export interface BusinessNotes {
  assumption(x: Text): void;
  notCounted(x: Text): void;
  unverified(x: Text): void;
  limit(
    p: { source: string; estimate?: string },
    kind: LimitApplied['kind'],
    at: [string, EnginePerson, LimitApplied['tax']],
    given: number,
    limit: number,
    counted: number,
  ): void;
}

export const BUSINESS_NOTE = {
  accountsAsGiven: {
    en: 'Self-employment: your business result is taken from your accounts or records as you gave them, line by line (annexe B2). Taxpresso adds them up but doesn’t check your accounts: depreciation, provisions and private shares are yours to get right (ge-2025-guide-independants p. 13 to 21).',
    fr: `Activité indépendante${NB}: le résultat de votre activité est repris de vos comptes ou relevés tels que vous les avez donnés, ligne par ligne (annexe B2). Taxpresso les additionne mais ne vérifie pas vos comptes${NB}: amortissements, provisions et parts privées sont à vous de les établir correctement (ge-2025-guide-independants p. 13 à 21).`,
  },
  noAccounts: {
    en: 'Self-employment: your accounts (comptes commerciaux) are not in yet, so your business result is not counted.',
    fr: `Activité indépendante${NB}: vos comptes commerciaux ne sont pas encore là, le résultat de votre activité n’est donc pas compté.`,
  },
  noAvs: {
    en: 'Self-employment: your own AVS/AI/APG contributions (32.10, 32.11) are not in yet, so they are not deducted.',
    fr: `Activité indépendante${NB}: vos propres cotisations AVS/AI, APG (32.10, 32.11) ne sont pas encore là, elles ne sont donc pas déduites.`,
  },
  noBalance: {
    en: 'Self-employment: no balance sheet given (actifs et passifs, 12.48, 12.49, 57.50), so no business wealth is counted.',
    fr: `Activité indépendante${NB}: aucun bilan donné (actifs et passifs, 12.48, 12.49, 57.50), aucune fortune commerciale n’est donc comptée.`,
  },
  wealthBase: {
    en: 'Deduction on business wealth (51.60): the law and the guides give half of the wealth "investie" in the business without saying whether its debts come off first. Taxpresso takes half of the business’s equity (12.52: assets less business debts), the smaller of the two readings. Check it with the AFC or GeTax.',
    fr: `Déduction sur la fortune commerciale investie (51.60)${NB}: la loi et les guides donnent la moitié des éléments de fortune investis dans l’exploitation sans dire si ses dettes sont d’abord soustraites. Taxpresso prend la moitié des fonds propres de l’activité (12.52${NB}: actifs moins passifs commerciaux), la plus petite des deux lectures. Vérifiez-le auprès de l’AFC ou avec GeTax.`,
  },
  lossCarried: {
    en: 'Your income for the year is below zero after your business loss: no income tax. Your assessment (avis de taxation) says how much of the loss you can carry to the next seven years; keep it for next year’s declaration (57.20).',
    fr: `Votre revenu de l’année est négatif après votre perte commerciale${NB}: pas d’impôt sur le revenu. Votre avis de taxation dira quelle part de la perte vous pouvez reporter sur les sept années suivantes${NB}; gardez-le pour la déclaration de l’an prochain (57.20).`,
  },
} as const satisfies Record<string, Text>;

/** An item of annex B, with its rubric's label and source. */
function item(
  code: RubricCode,
  person: EnginePerson | 'household',
  tr: Trace,
  amount: number,
  how: Text,
): Item {
  const r = RUBRICS[code];
  tr.src(r.source);
  return { code, person, ...tr.line(amount, r.label, how) };
}

const traceOf = (...figures: BusinessFigure[]) =>
  new Trace()
    .with(...figures.map((f) => f.trace))
    .src(...figures.flatMap((f) => [...f.trace.sources]));

/** Geneva's items of one person's business (a sole proprietorship), in each tax and the wealth. */
export function businessItems(
  P: YearParams,
  person: EnginePerson,
  b: BusinessInput,
  notes: BusinessNotes,
): BusinessItems {
  const y = businessYear(b);
  const icc: Item[] = [];
  const ifd: Item[] = [];
  const wealth: Item[] = [];
  const sheet: BusinessSheet = { person, icc: [], ifd: [], wealth: [] };
  const both = (it: Item) => (icc.push(it), ifd.push(it));
  const sheetBoth = (it: Item) => (sheet.icc.push(it), sheet.ifd.push(it));

  if (y.hasAccounts) notes.assumption(BUSINESS_NOTE.accountsAsGiven);
  else notes.notCounted(BUSINESS_NOTE.noAccounts);

  // B2, the profit and loss account (ge-2025-guide-independants p. 12 to 16).
  const result = y.result.amount;
  if (y.hasAccounts) {
    sheetBoth(
      item(
        '12.17',
        person,
        traceOf(y.totalRevenue),
        y.totalRevenue.amount,
        t(
          `12.08 + 12.09 + 12.15 + 12.16: ${chf(y.totalRevenue.amount)}.`,
          `12.08 + 12.09 + 12.15 + 12.16${NB}: ${chf(y.totalRevenue.amount)}.`,
        ),
      ),
    );
    sheetBoth(
      item(
        '12.45',
        person,
        traceOf(y.totalCharges),
        y.totalCharges.amount,
        t(
          `12.21 + 12.22 + 12.23 + 12.24 + 12.41 + 12.42: ${chf(y.totalCharges.amount)}.`,
          `12.21 + 12.22 + 12.23 + 12.24 + 12.41 + 12.42${NB}: ${chf(y.totalCharges.amount)}.`,
        ),
      ),
    );
    sheetBoth(item('12.46', person, traceOf(y.result), result, resultHow(y)));
    if (result >= 0) {
      const it = item(
        '12.01',
        person,
        traceOf(y.result).src(`${LIPP} art. 19 al. 1`),
        result,
        t(
          `The result of the accounts, with no deduction 12.18, 12.28 or 12.29: ${chf(result)}, to PG2 12.00.`,
          `Le résultat des comptes, sans déduction 12.18, 12.28 ou 12.29${NB}: ${chf(result)}, à reporter en PG2 12.00.`,
        ),
      );
      both(it);
      sheetBoth(it);
    } else {
      const it = item(
        '57.10',
        person,
        traceOf(y.result).src(`${LIPP} art. 19 al. 1`),
        result,
        t(
          `The accounts show a loss: ${chf(-result)}, deducted from your other income (PG3 57.00).`,
          `Les comptes présentent une perte${NB}: ${chf(-result)}, déduite de vos autres revenus (PG3 57.00).`,
        ),
      );
      both(it);
      sheetBoth(it);
    }
  }

  // 57.20, losses of the seven previous business years, each tax its own (p. 16).
  const window = lossWindow(P.taxYear);
  const prior = (tax: 'cantonal' | 'federal', list: Item[], sheetList: Item[]) => {
    const f = y.priorLosses[tax];
    if (!(f.amount > 0)) return 0;
    const tr = traceOf(f).src(
      tax === 'cantonal' ? `${LIPP} art. 30 let. f` : 'ch-na-law-lifd art. 31 al. 1 (p. 23)',
    );
    if (window) tr.src(window.source);
    const years = window ? `${window.from} to ${window.to}` : '';
    const ans = window ? `${window.from} à ${window.to}` : '';
    const it = item(
      '57.20',
      person,
      tr,
      -f.amount,
      t(
        `Losses of the seven previous business years (${years}) not deducted yet, as you gave them from your last assessment: ${chf(f.amount)}.`,
        `Pertes des sept exercices précédents (${ans}) pas encore déduites, telles que vous les avez données d’après votre dernier avis de taxation${NB}: ${chf(f.amount)}.`,
      ),
    );
    list.push(it);
    sheetList.push(it);
    return f.amount;
  };
  const lossIcc = prior('cantonal', icc, sheet.icc);
  const lossIfd = prior('federal', ifd, sheet.ifd);
  const net57 = (losses: number) => (result < 0 ? -result : 0) + losses;
  for (const [list, losses] of [
    [sheet.icc, lossIcc],
    [sheet.ifd, lossIfd],
  ] as const) {
    const v = net57(losses);
    if (v > 0) {
      list.push(
        item(
          '57.00',
          person,
          new Trace().from(...list.filter((i) => i.code === '57.10' || i.code === '57.20')),
          -v,
          t(
            `57.10 + 57.20: ${chf(v)}, to PG3 57.00.`,
            `57.10 + 57.20${NB}: ${chf(v)}, à reporter en PG3 57.00.`,
          ),
        ),
      );
    }
  }

  // B4, the owner's AVS/AI/APG contributions (p. 22).
  if (!y.hasAvs) notes.notCounted(BUSINESS_NOTE.noAvs);
  for (const [code, f, en, fr] of [
    [
      '32.10',
      y.avsYear,
      'Your own AVS/AI/APG contributions for the business year, deducted in full',
      'Vos cotisations AVS/AI, APG pour l’exercice, déductibles en totalité',
    ],
    [
      '32.11',
      y.avsEarlier,
      'Further contributions paid after final decisions for earlier years, deducted in full',
      'Cotisations complémentaires payées selon les décisions pour des années antérieures, déductibles en totalité',
    ],
  ] as const) {
    if (!(f.amount > 0)) continue;
    both(
      item(
        code,
        person,
        traceOf(f).src(`${LIPP} art. 31 let. a`),
        -f.amount,
        t(`${en}: ${chf(f.amount)}.`, `${fr}${NB}: ${chf(f.amount)}.`),
      ),
    );
  }

  // B2, the balance sheet, and PG4 51.60 (p. 16 to 18).
  if (!y.hasBalance) notes.notCounted(BUSINESS_NOTE.noBalance);
  else {
    const assets = y.grossAssets.amount;
    const debts = y.liabilities.amount;
    const assetsItem = item(
      '12.50',
      person,
      traceOf(y.grossAssets),
      assets,
      t(
        `12.48 + 12.49, at the close of the business year: ${chf(assets)}, to PG4 12.00.`,
        `12.48 + 12.49, à la clôture de l’exercice${NB}: ${chf(assets)}, à reporter en PG4 12.00.`,
      ),
    );
    wealth.push(assetsItem);
    sheet.wealth.push(assetsItem);
    if (debts > 0) {
      const debtsItem = item(
        '57.50',
        person,
        traceOf(y.liabilities),
        -debts,
        t(
          `Business debts and provisions at the close: ${chf(debts)}, to PG4 57.00.`,
          `Dettes commerciales et provisions à la clôture${NB}: ${chf(debts)}, à reporter en PG4 57.00.`,
        ),
      );
      wealth.push(debtsItem);
      sheet.wealth.push(debtsItem);
    }
    const equity = y.equity.amount;
    sheet.wealth.push(
      item(
        '12.52',
        person,
        traceOf(y.equity),
        equity,
        t(
          `12.50 less 57.50: ${equity < 0 ? `a deficit of ${chf(-equity)}` : chf(equity)}.`,
          `12.50 moins 57.50${NB}: ${equity < 0 ? `un découvert de ${chf(-equity)}` : chf(equity)}.`,
        ),
      ),
    );
    if (equity > 0) {
      const tr = traceOf(y.equity);
      const p = tr.p(P.icc.businessWealth);
      const half = shareFranc(equity, p.shareBp);
      const v = Math.min(half, p.max);
      notes.unverified(BUSINESS_NOTE.wealthBase);
      notes.limit(P.icc.businessWealth, 'cap', ['51.60', person, 'icc'], half, p.max, v);
      const deduction = item(
        '51.60',
        person,
        tr.src(INDEP + ' p. 17 and 18'),
        -v,
        t(
          `Half of the business’s equity (${chf(equity)}), to the franc, at most ${chf(p.max)}: ${chf(v)}.`,
          `La moitié des fonds propres de l’activité (${chf(equity)}), au franc, au plus ${chf(p.max)}${NB}: ${chf(v)}.`,
        ),
      );
      wealth.push(deduction);
      sheet.wealth.push(deduction);
    }
  }

  return {
    icc,
    ifd,
    wealth,
    sheet,
    year: y,
    // Without the accounts the business's income is not known: none is counted.
    earned: y.hasAccounts ? y.earned.amount : 0,
    loss: y.hasAccounts && result < 0,
  };
}
