// The final check before filling in the official form (SPEC.md 10.0): one pure function over what
// Taxpresso knows (the engine's result on the current ledger, the values that are not final, the
// "Check this" items, the documents still missing, the check of the official PDF). Fixed rules,
// no model judgement, no tax advice: it only says what the rules applied and where they are written.
//
// The verdict is "ready" only when nothing blocks (SPEC.md 9: an estimate is never filed silently).
// Everything else is listed in two groups, "Fix before filing" and "Good to know", each by kind and,
// within a kind, in the form's order.
//
// Official passages are not attached yet: bundling text from the official documents waits for the
// legal check (SPEC.md 7b, [HUMAN]). Each rule is cited by manifest id, page or article, and the
// official link (../law/official-documents.ts).
import type { ConsistencyCheck, Text } from '../2026/checks.js';
import {
  officialLinks,
  type OfficialDocument,
  type OfficialLink,
} from '../law/official-documents.js';
import { chf, type CapitalTax } from '@taxpresso/rules-ch';
import { ESTIMATE_TEXT } from './explain.js';
import { rubric } from './rubrics.js';
import { dayText } from './part-year.js';
import type {
  AbroadResult,
  EstimateReason,
  LimitApplied,
  PartYearResult,
  TaxResult,
} from './types.js';

const NB = '\u00a0';
const t = (en: string, fr: string): Text => ({ en, fr });

/**
 * How close to a limit counts as "near" (SPEC.md 10.0): within 5 % of the limit, and at least
 * CHF 100, on either side for a threshold, under it for a cap. Taxpresso's own choice to decide what
 * to show, not a tax rule: it changes no amount. A cap that cut an amount is always shown.
 */
export const NEAR_LIMIT = { shareBp: 500, min: 10_000 } as const;

/** The margin around a limit, in centimes: 5 % of it (rounded down), at least CHF 100. */
export function nearMargin(limit: number): number {
  return Math.max(Math.floor((Math.abs(limit) * NEAR_LIMIT.shareBp) / 10_000), NEAR_LIMIT.min);
}

/**
 * Where an amount stands against its limit. over: a cap cut it. at: exactly the limit. under: a
 * little under a cap. below / above: a little under or over a threshold, a minimum or the flat
 * deduction. Undefined when it is not near (nothing to show).
 */
export type LimitPosition = 'over' | 'at' | 'under' | 'below' | 'above';

export function limitPosition(l: Pick<LimitApplied, 'kind' | 'given' | 'limit'>) {
  const gap = l.given - l.limit;
  const near = Math.abs(gap) <= nearMargin(l.limit);
  if (l.kind === 'cap') {
    if (gap > 0) return 'over';
    if (gap === 0) return 'at';
    return near ? 'under' : undefined;
  }
  if (!near) return undefined;
  return gap === 0 ? 'at' : gap > 0 ? 'above' : 'below';
}

/** A value given to Taxpresso that is not final yet: still "Needs your OK", or an estimate. */
export interface PendingValue {
  /** The ledger fact (or line) id. */
  id: string;
  status: 'extracted' | 'estimate';
  label: Text;
  /** The rubric it goes to on the form, when it has one (for the form's order). */
  code?: string;
  person?: string;
  /** Centimes, or the value in words. */
  amount?: number;
  text?: Text;
  /** The document it was read from, and where. */
  document?: string;
  page?: number;
  /** What would make it final. */
  final: Text;
  /** The user confirmed this estimate as their best figure, with this note (SPEC.md 9, case 2). */
  bestFigure?: string;
}

export interface FinalRequirement {
  id: string;
  label: Text;
  reason?: Text;
  person: string;
  optional: boolean;
  status: 'missing' | 'satisfied' | 'estimated' | 'waived';
  have: number;
  need: number;
  source?: string;
}

/** Where the check of the official PDF stands (reconcile_official_pdf, SPEC.md 10.4). */
export type OfficialPdfState =
  | { status: 'none' }
  /** The check reads Geneva declarations only: another canton's has none yet. */
  | { status: 'not_available' }
  | { status: 'pending' }
  | { status: 'unreadable'; file: string }
  | { status: 'other_year'; file: string }
  | { status: 'checked'; file: string; clear: boolean; toFix: number; notFinal: number };

/**
 * The result the check reads: what every canton's engine gives (Geneva's TaxResult, Zurich's
 * ZhTaxResult), with the limits each rule applied.
 */
export type FinalCheckResult = Pick<
  TaxResult,
  'estimates' | 'incomplete' | 'assumptions' | 'notCounted' | 'unsupported' | 'unverifiedRules'
> & {
  limits: readonly LimitApplied[];
  /** The separate tax on pension capital, in a canton that computes it (Geneva). */
  capital?: CapitalTax;
  /** A property abroad, counted for the rate (Geneva). */
  abroad?: AbroadResult;
  /** A year of arrival from abroad or of departure abroad (Geneva). */
  partYear?: PartYearResult;
};

/**
 * What the check says differently in another canton: its form's labels, its software, the names of
 * its two taxes. Without it, Geneva's (docs/design/cantons.md).
 */
export interface FinalCheckCanton {
  /** The label of a line code on the canton's form. */
  label(code: string): Text | undefined;
  /** What was given, for a line with a limit ("Paid into pillar 3a"). */
  given(limit: LimitApplied): Text | undefined;
  /** Lines with a limit in each tax: their title says which tax. */
  inBothTaxes(code: string): boolean;
  /** The names of the two taxes, in the titles of limits. */
  taxes: Record<LimitApplied['tax'], Text>;
  /** For what Taxpresso can't prepare: the canton's own software, or a fiduciary. */
  notSupported: Text;
  /** For a limit that is an estimate: who publishes the final amount. */
  limitEstimate: Text;
  /** The canton's official documents, for the link of each rule cited. */
  documents?: Readonly<Record<string, OfficialDocument>>;
}

export interface FinalCheckInput {
  taxYear: number;
  /** Another canton's words; Geneva's when absent. */
  canton?: FinalCheckCanton;
  /** A couple: say whose each value is. */
  couple: boolean;
  /** The engine's result on the values that count now; null when it can't compute yet. */
  result: FinalCheckResult | null;
  /** What must be answered before the engine can compute anything. */
  missing: readonly Text[];
  /** How the ledger was read: what is left out or assumed. */
  ledgerNotes: readonly Text[];
  /** Parts of the situation Taxpresso doesn't prepare yet. */
  notSupported: readonly Text[];
  /** Questions not answered yet, skipped ones included. */
  questionsOpen: number;
  /** Documents not read yet, without a kind, or waiting for the user to say whose they are. */
  documents: { toRead: number; toIdentify: number; whose: number };
  requirements: readonly FinalRequirement[];
  checks: readonly ConsistencyCheck[];
  values: readonly PendingValue[];
  /** The securities list's own findings (état des titres). */
  holdingIssues?: readonly { severity: 'missing' | 'check'; text: Text; source?: string }[];
  officialPdf: OfficialPdfState;
  /** The place of a rubric code in the official form (lower first); undefined when not on it. */
  formOrder?: (code: string) => number | undefined;
  /** Shown when the form's codes and labels come from an earlier year. */
  formNote?: Text;
}

export type FinalCheckKind =
  | 'cannot_compute'
  | 'not_supported'
  | 'not_computed'
  | 'questions_open'
  | 'missing_document'
  | 'documents_unread'
  | 'needs_ok'
  | 'estimate'
  | 'estimate_rule'
  | 'check'
  | 'incomplete'
  | 'official_pdf'
  | 'limit'
  | 'capital'
  | 'abroad'
  | 'part_year'
  | 'best_figure'
  | 'holding_check'
  | 'not_counted'
  | 'assumption'
  | 'unverified_rule'
  | 'optional_document'
  | 'form_provisional';

/** The status chip of an item (SPEC.md 11b wording: Needs your OK, Estimate, Missing, Fix). */
export type FinalCheckStatus = 'needs_ok' | 'estimate' | 'missing' | 'fix';

export interface FinalCheckItem {
  /** Stable while the situation doesn't change. */
  id: string;
  kind: FinalCheckKind;
  status?: FinalCheckStatus;
  code?: string;
  person?: string;
  title: Text;
  detail: Text;
  /** What makes it final, or what to do. */
  todo?: Text;
  /** Sub-points, e.g. each amount known only in part. */
  list?: Text[];
  /** For a value at or near a limit: the rule as applied and where the amount stands. */
  limit?: LimitApplied & { position: LimitPosition };
  /** The official documents behind it: manifest id, page or article, link. */
  sources: OfficialLink[];
}

export interface FinalCheck {
  taxYear: number;
  /** ready: nothing to fix before filling in the official form. */
  verdict: 'ready' | 'not_ready';
  fix: FinalCheckItem[];
  know: FinalCheckItem[];
  margin: typeof NEAR_LIMIT;
}

const FIX_ORDER: FinalCheckKind[] = [
  'cannot_compute',
  'not_supported',
  'not_computed',
  'questions_open',
  'missing_document',
  'documents_unread',
  'needs_ok',
  'estimate',
  'estimate_rule',
  'check',
  'incomplete',
  'official_pdf',
];
const KNOW_ORDER: FinalCheckKind[] = [
  'part_year',
  'capital',
  'abroad',
  'limit',
  'best_figure',
  'holding_check',
  'not_counted',
  'assumption',
  'unverified_rule',
  'optional_document',
  'official_pdf',
  'form_provisional',
];

const WHO: Record<string, Text> = {
  p1: t('you', 'vous'),
  p2: t('your spouse or partner', 'votre conjoint ou partenaire'),
};

/** What was given, for each rubric with a limit (taxpayer A's code). */
const GIVEN: Record<string, Text> = {
  '31.40': t('Paid into pillar 3a', 'Versé au 3e pilier A'),
  '32.40': t('Paid into pillar 3a', 'Versé au 3e pilier A'),
  '31.60': t('Meals away from home', 'Repas hors du domicile'),
  '31.70': t('Travel costs', 'Frais de déplacement'),
  '31.71': t('Travel costs', 'Frais de déplacement'),
  '31.50': t('Your actual professional costs', 'Vos frais professionnels effectifs'),
  '31.20': t('Your other actual professional costs', 'Vos autres frais professionnels effectifs'),
  '59.50': t('Training paid', 'Frais de formation payés'),
  '52.21': t('Health and accident premiums', 'Primes d’assurance-maladie et accidents'),
  '52.15': t(
    'Life insurance premiums and savings interest',
    'Primes d’assurance-vie et intérêts d’épargne',
  ),
  '52.00': t(
    'Insurance premiums and savings interest',
    'Primes d’assurances et intérêts d’épargne',
  ),
  '55.10': t('Interest on private debts', 'Intérêts de dettes privées'),
  '59.10': t('Childcare paid', 'Frais de garde payés'),
  '59.12': t('Childcare paid', 'Frais de garde payés'),
  '71.00': t('Medical costs', 'Frais médicaux'),
  '73.00': t('Donations', 'Dons'),
  '74.00': t('Paid to political parties', 'Versé aux partis politiques'),
  '51.60': t('Half of your business’s equity', 'La moitié des fonds propres de votre activité'),
};

/** Taxpayer B's code read as A's (41.40 -> 31.40), for the words above. */
const aCode = (code: string) =>
  code[0] === '2' || code[0] === '4' ? `${Number(code[0]) - 1}${code.slice(1)}` : code;

const TAX: Record<LimitApplied['tax'], Text> = {
  icc: t('ICC', 'ICC'),
  ifd: t('IFD', 'IFD'),
  both: t('ICC and IFD', 'ICC et IFD'),
};
/** Rubrics with a limit in each tax: their title says which tax (the others' labels already do). */
const IN_BOTH_TAXES = new Set(['31.60', '55.10', '59.50', '71.00', '73.00', '74.00']);

/** Geneva's words, the check's default. */
const GENEVA: FinalCheckCanton = {
  label: (code) => rubric(code)?.label,
  given: (l) => GIVEN[aCode(l.code)],
  inBothTaxes: (code) => IN_BOTH_TAXES.has(aCode(code)),
  taxes: TAX,
  notSupported: t(
    'Taxpresso can’t prepare this part. GeTax, the canton’s free software, or a fiduciary can.',
    'Taxpresso ne peut pas préparer cette partie. GeTax, le logiciel gratuit du canton, ou une fiduciaire le peuvent.',
  ),
  limitEstimate: t(
    ' This limit is an estimate until Geneva publishes its amounts for the year.',
    ` Cette limite est une estimation jusqu’à ce que Genève publie ses montants de l’année.`,
  ),
};

function rubricTitle(
  canton: FinalCheckCanton,
  code: string,
  who: Text | undefined,
  extra?: Text,
): Text {
  const label = canton.label(code) ?? t(code, code);
  const tail = (lang: 'en' | 'fr') =>
    [who?.[lang], extra?.[lang]].filter((x): x is string => Boolean(x)).join(', ');
  return t(
    `${code} ${label.en}${tail('en') ? `, ${tail('en')}` : ''}`,
    `${code} ${label.fr}${tail('fr') ? `, ${tail('fr')}` : ''}`,
  );
}

/** The plain words for a value at or near its limit, with the numbers. */
function limitDetail(canton: FinalCheckCanton, l: LimitApplied, at: LimitPosition): Text {
  const g = canton.given(l) ?? t('Amount', 'Montant');
  const [given, limit, counted] = [chf(l.given), chf(l.limit), chf(l.counted)];
  const gap = chf(Math.abs(l.given - l.limit));
  const said = t(`${g.en}: ${given}`, `${g.fr}${NB}: ${given}`);
  let rest: Text;
  if (l.kind === 'cap') {
    rest =
      at === 'over'
        ? t(
            `; the limit is ${limit}, so ${counted} is deducted and ${gap} is not.`,
            `${NB}; la limite est de ${limit}, donc ${counted} est déduit et ${gap} ne l’est pas.`,
          )
        : at === 'at'
          ? t(
              `, exactly the limit: all of it is deducted.`,
              `, exactement la limite${NB}: tout est déduit.`,
            )
          : t(
              `, ${gap} under the limit of ${limit}: all of it is deducted.`,
              `, ${gap} sous la limite de ${limit}${NB}: tout est déduit.`,
            );
  } else if (l.kind === 'threshold') {
    rest =
      at === 'above'
        ? t(
            `, ${gap} above the threshold of ${limit}: only the part above it, ${counted}, is deducted.`,
            `, ${gap} au-dessus du seuil de ${limit}${NB}: seule la part au-dessus, ${counted}, est déduite.`,
          )
        : t(
            `, ${at === 'at' ? 'exactly' : `${gap} under`} the threshold of ${limit}: nothing is deducted, only the part above it counts.`,
            `, ${at === 'at' ? 'exactement' : `${gap} sous`} le seuil de ${limit}${NB}: rien n’est déduit, seule la part au-dessus compte.`,
          );
  } else if (l.kind === 'minimum') {
    rest =
      at === 'below'
        ? t(
            `, ${gap} under the minimum of ${limit} in the year: nothing is deducted for the federal tax.`,
            `, ${gap} sous le minimum de ${limit} dans l’année${NB}: rien n’est déduit pour l’impôt fédéral.`,
          )
        : t(
            `, just at or above the minimum of ${limit} in the year: they are deducted.`,
            `, juste au minimum de ${limit} dans l’année ou au-dessus${NB}: ils sont déduits.`,
          );
  } else {
    rest =
      at === 'above'
        ? t(
            `, just above the flat deduction of ${limit}: the actual costs are used.`,
            `, juste au-dessus de la déduction forfaitaire de ${limit}${NB}: les frais effectifs sont retenus.`,
          )
        : t(
            `, ${at === 'at' ? 'the same as' : 'just under'} the flat deduction of ${limit}: the flat deduction (déduction forfaitaire) is used.`,
            `, ${at === 'at' ? 'autant que' : 'juste sous'} la déduction forfaitaire de ${limit}${NB}: la déduction forfaitaire est retenue.`,
          );
  }
  const estimate = l.estimate ? canton.limitEstimate : t('', '');
  return t(said.en + rest.en + estimate.en, said.fr + rest.fr + estimate.fr);
}

function limitItems(input: FinalCheckInput): FinalCheckItem[] {
  const out: FinalCheckItem[] = [];
  const canton = input.canton ?? GENEVA;
  for (const l of input.result?.limits ?? []) {
    const position = limitPosition(l);
    if (!position) continue;
    const who = input.couple ? WHO[l.person] : undefined;
    out.push({
      id: `limit:${l.code}:${l.person}:${l.tax}:${l.kind}`,
      kind: 'limit',
      code: l.code,
      person: l.person,
      title: rubricTitle(
        canton,
        l.code,
        who,
        l.tax === 'both' || canton.inBothTaxes(l.code) ? canton.taxes[l.tax] : undefined,
      ),
      detail: limitDetail(canton, l, position),
      limit: { ...l, position },
      sources: officialLinks(l.source, canton.documents),
    });
  }
  return out;
}

const shown = (v: PendingValue): Text =>
  v.amount !== undefined ? t(chf(v.amount), chf(v.amount)) : (v.text ?? t('', ''));

function valueItem(v: PendingValue, couple: boolean): FinalCheckItem {
  const who = couple && v.person ? WHO[v.person] : undefined;
  const title = t(
    `${v.code ? `${v.code} ` : ''}${v.label.en}${who ? `, ${who.en}` : ''}`,
    `${v.code ? `${v.code} ` : ''}${v.label.fr}${who ? `, ${who.fr}` : ''}`,
  );
  const value = shown(v);
  const from = v.document
    ? t(
        `, read from “${v.document}”${v.page ? `, page ${v.page}` : ''}`,
        `, lu dans «${NB}${v.document}${NB}»${v.page ? `, page ${v.page}` : ''}`,
      )
    : t('', '');
  if (v.status === 'extracted') {
    return {
      id: `needs_ok:${v.id}`,
      kind: 'needs_ok',
      status: 'needs_ok',
      ...(v.code ? { code: v.code } : {}),
      ...(v.person ? { person: v.person } : {}),
      title,
      detail: t(
        `${value.en}${from.en}: still Needs your OK.`,
        `${value.fr}${from.fr}${NB}: encore À confirmer.`,
      ),
      todo: v.final,
      sources: [],
    };
  }
  if (v.bestFigure) {
    return {
      id: `best_figure:${v.id}`,
      kind: 'best_figure',
      status: 'estimate',
      ...(v.code ? { code: v.code } : {}),
      ...(v.person ? { person: v.person } : {}),
      title,
      detail: t(
        `${value.en}${from.en}: an estimate you confirmed as your best figure: “${v.bestFigure}”.`,
        `${value.fr}${from.fr}${NB}: une estimation que vous avez confirmée comme votre meilleur chiffre${NB}: «${NB}${v.bestFigure}${NB}».`,
      ),
      todo: v.final,
      sources: [],
    };
  }
  return {
    id: `estimate:${v.id}`,
    kind: 'estimate',
    status: 'estimate',
    ...(v.code ? { code: v.code } : {}),
    ...(v.person ? { person: v.person } : {}),
    title,
    detail: t(
      `${value.en}${from.en}: an estimate, not final yet.`,
      `${value.fr}${from.fr}${NB}: une estimation, pas encore définitive.`,
    ),
    todo: v.final,
    sources: [],
  };
}

/** What would make Geneva's estimated constants final. */
const ESTIMATE_RULE_TODO: Record<EstimateReason, (year: number) => Text> = {
  'ge-2026-unpublished': (year) =>
    t(
      `Nothing to do yourself: once Geneva publishes its ${year} guide (January ${year + 1}), install the Taxpresso version that has it. Its figures are then final.`,
      `Rien à faire de votre côté${NB}: quand Genève publie son guide ${year} (janvier ${year + 1}), installez la version de Taxpresso qui le contient. Ses montants sont alors définitifs.`,
    ),
};

/**
 * The lump sums from the 2nd pillar and pillar 3a: unusual items, each with the rule that governs
 * it (SPEC.md 10.0). The tax apart, and the three-year rule on buy-ins for a 2nd pillar lump sum.
 */
function capitalItems(input: FinalCheckInput): FinalCheckItem[] {
  const c = input.result?.capital;
  if (!c) return [];
  const links = (source: string) => officialLinks(source, input.canton?.documents);
  const out: FinalCheckItem[] = [];
  const taxes =
    c.icc && c.ifd && c.total
      ? t(
          ` Its tax: cantonal and communal ${chf(c.icc.tax.amount)}, federal ${chf(c.ifd.tax.amount)}, ${chf(c.total.amount)} together.`,
          ` Son impôt${NB}: cantonal et communal ${chf(c.icc.tax.amount)}, fédéral ${chf(c.ifd.tax.amount)}, ${chf(c.total.amount)} au total.`,
        )
      : t(
          ' Its tax is not computed: see above.',
          ` Son impôt n’est pas calculé${NB}: voir plus haut.`,
        );
  out.push({
    id: 'capital:taxed_apart',
    kind: 'capital',
    code: '98.12',
    title: t(
      '98.12 Pension capital, taxed apart (prestations en capital du 2e et 3e pilier A)',
      '98.12 Prestations en capital du 2e et 3e pilier A, imposées à part',
    ),
    detail: t(
      `${chf(c.amount.amount)} received this year, taxed apart from the rest of your income at a fifth of the scale, every lump sum of the year together.${taxes.en}`,
      `${chf(c.amount.amount)} reçus cette année, imposés à part du reste de vos revenus au cinquième du barème, tous les capitaux de l’année ensemble.${taxes.fr}`,
    ),
    todo: t(
      'Declare the amount at 98.12 and attach each attestation.',
      'Déclarez le montant au 98.12 et joignez chaque attestation.',
    ),
    // The federal instructions exist for 2026 only (docs/design/tax-years.md).
    sources: links(
      `ge-2025-guide-declaration-pp p. 13; ge-na-law-lipp art. 45; ch-na-law-lifd art. 38 (p. 32)${input.taxYear >= 2026 ? '; ch-2026-ifd-instructions-personnes-physiques p. 9' : ''}`,
    ),
  });
  if (c.secondPillar) {
    out.push({
      id: 'capital:buy_ins',
      kind: 'capital',
      code: '98.12',
      title: t(
        'Buy-ins of the three years before a 2nd pillar lump sum',
        'Rachats des trois années avant un capital du 2e pilier',
      ),
      detail: t(
        'Benefits that come from a buy-in can’t be paid as a lump sum for three years. If you bought into your pension fund in the three years before, the tax office can take back those buy-ins’ deductions (rappel d’impôt).',
        `Les prestations qui résultent d’un rachat ne peuvent pas être versées en capital pendant trois ans. Si vous avez fait un rachat dans votre caisse de pension pendant les trois années précédentes, l’administration peut reprendre la déduction de ces rachats (rappel d’impôt).`,
      ),
      todo: t(
        'If you made such a buy-in, ask the AFC what it means for you.',
        'Si vous avez fait un tel rachat, demandez à l’AFC ce que cela implique pour vous.',
      ),
      sources: links('ge-2025-guide-declaration-pp p. 18; ch-na-law-lpp art. 79b al. 3 (p. 66)'),
    });
  }
  return out;
}

/**
 * A year of arrival from abroad or of departure abroad: an unusual item (SPEC.md 10.0). The income
 * of the period (99.00) is taxed at the rate of a full year's income (95.00, revenu net pour le
 * taux; 97.00 the rest), with the documents that govern it.
 */
function partYearItems(input: FinalCheckInput): FinalCheckItem[] {
  const p = input.result?.partYear;
  if (!p) return [];
  const arrival = p.kind === 'arrival';
  const day = dayText(arrival ? p.from : p.to);
  const rates = (lang: 'en' | 'fr') =>
    [
      p.icc ? `${chf(p.icc.rateTotal.amount)} ${lang === 'en' ? 'cantonal' : 'cantonal'}` : '',
      p.ifd ? `${chf(p.ifd.rateTotal.amount)} ${lang === 'en' ? 'federal' : 'fédéral'}` : '',
    ]
      .filter(Boolean)
      .join(lang === 'en' ? ' and ' : ' et ');
  const r = { en: rates('en'), fr: rates('fr') };
  return [
    {
      id: 'part_year:period',
      kind: 'part_year',
      title: arrival
        ? t(
            `You arrived on ${day.en}: your income from then, at the rate of a full year (date d’arrivée)`,
            `Arrivée le ${day.fr}${NB}: votre revenu dès cette date, au taux d’une année entière (date d’arrivée)`,
          )
        : t(
            `You leave on ${day.en}: your income until then, at the rate of a full year`,
            `Départ le ${day.fr}${NB}: votre revenu jusqu’à cette date, au taux d’une année entière`,
          ),
      detail: t(
        `Geneva and the federal tax tax the income of your ${p.days} of 360 days (99.00) at the rate of a full year’s income${r.en ? `: the net income for the rate (95.00, revenu net pour le taux) is ${r.en}, and 97.00 is the part not taxed here` : ''}.`,
        `Genève et l’impôt fédéral imposent le revenu de vos ${p.days} jours sur 360 (99.00) au taux d’un revenu annuel${r.fr ? `${NB}: le revenu net pour le taux (95.00) est de ${r.fr}, et le 97.00 est la part non imposable ici` : ''}.`,
      ),
      todo: arrival
        ? t(
            'Write the day you arrived on the first page of the declaration (date d’arrivée), and declare only your income from that day.',
            'Inscrivez le jour de votre arrivée en première page de la déclaration (date d’arrivée), et ne déclarez que vos revenus dès ce jour.',
          )
        : t(
            'Go to the tax office at least 15 days before you leave, with the departure form (questionnaire de départ), last year’s declaration if it isn’t sent, and this year’s, filled in up to the day you leave (GeTax: Fichier > Déclaration Départ/Décès).',
            'Présentez-vous à l’administration fiscale au moins 15 jours avant votre départ, avec le questionnaire de départ, la déclaration de l’an dernier si elle n’est pas envoyée, et celle de cette année, remplie jusqu’au jour du départ (GeTax${NB}: Fichier > Déclaration Départ/Décès).'.replace(
              '${NB}',
              NB,
            ),
          ),
      sources: officialLinks(
        `${arrival ? 'ge-2025-guide-declaration-pp p. 53' : 'ge-2025-guide-declaration-pp p. 54'}; ge-2025-declaration-specimen p. 1 and 3; ge-na-law-lipp art. 62 al. 3 and 4, art. 64 and 65; ch-na-law-lifd art. 40 al. 3 (p. 33); ch-2026-afc-guide-futur-contribuable p. 30`,
        input.canton?.documents,
      ),
    },
  ];
}

/**
 * A property abroad: an unusual item, with the rules that govern it (SPEC.md 10.0). It is on annexe
 * D and counted only for the rate; the debts and their interest are shared with it.
 */
function abroadItems(input: FinalCheckInput): FinalCheckItem[] {
  const a = input.result?.abroad;
  if (!a) return [];
  const links = (source: string) => officialLinks(source, input.canton?.documents);
  const code = a.use === 'own_use' ? '15.10' : '15.20';
  const value = a.wealth.find((i) => i.code === code)?.amount;
  const icc = a.icc.find((i) => i.code === code)?.amount;
  const ifd = a.ifd.find((i) => i.code === code)?.amount;
  const where = a.country ? t(` in ${a.country.en}`, ` en ${a.country.fr}`) : t('', '');
  const figures = t(
    [
      value !== undefined ? `its value ${chf(value)}` : '',
      icc !== undefined ? `its ${a.use === 'own_use' ? 'rental value' : 'rents'} ${chf(icc)}` : '',
    ]
      .filter(Boolean)
      .join(', '),
    [
      value !== undefined ? `sa valeur ${chf(value)}` : '',
      icc !== undefined
        ? `${a.use === 'own_use' ? 'sa valeur locative' : 'ses loyers'} ${chf(icc)}`
        : '',
    ]
      .filter(Boolean)
      .join(', '),
  );
  const out: FinalCheckItem[] = [
    {
      id: 'abroad:rate',
      kind: 'abroad',
      code,
      title: t(
        `${code} Your property abroad${where.en}, counted for the rate only (exemption avec réserve de progression)`,
        `${code} Votre immeuble à l’étranger${where.fr}, compté seulement pour le taux (exemption avec réserve de progression)`,
      ),
      detail: t(
        `It is taxed where it lies. Declare it on annexe D with its country${figures.en ? `: ${figures.en}` : ''}${ifd !== undefined && ifd !== icc ? ` (federal ${chf(ifd)})` : ''}. Geneva and the federal tax set your rate on your whole income and wealth (95.00), and tax only the rest (99.00): its share is 97.00.`,
        `Il est imposé là où il se trouve. Déclarez-le à l’annexe D avec son pays${figures.fr ? `${NB}: ${figures.fr}` : ''}${ifd !== undefined && ifd !== icc ? ` (fédéral ${chf(ifd)})` : ''}. Genève et l’impôt fédéral fixent votre taux sur l’ensemble de votre revenu et de votre fortune (95.00), et n’imposent que le reste (99.00)${NB}: sa part est le 97.00.`,
      ),
      todo: t(
        a.use === 'let'
          ? 'Attach the country’s tax value attestation or the deed, and the management account (compte de gestion).'
          : 'Attach the country’s tax value attestation or the deed, and the document of its rental value (in France the taxe d’habitation or taxes foncières), if any.',
        a.use === 'let'
          ? 'Joignez l’attestation de valeur fiscale du pays ou l’acte d’acquisition, et le compte de gestion.'
          : 'Joignez l’attestation de valeur fiscale du pays ou l’acte d’acquisition, et le justificatif de sa valeur locative (en France la taxe d’habitation ou les taxes foncières), s’il y en a un.',
      ),
      sources: links(
        `ge-2025-guide-declaration-pp p. 32 and 33; ge-2025-declaration-specimen p. 3, 4, 15 and 16; ge-na-revenu-immobilier-page (Votre bien est situé à l’étranger); ge-na-valeur-fiscale-page (Votre bien est situé à l’étranger); ge-na-law-lipp art. 5 and 6; ch-na-law-lifd art. 6 al. 1 and art. 7 al. 1 (p. 4 and 5)`,
      ),
    },
  ];
  if (a.debts || a.interestIcc) {
    const pct = `${(a.shareBp / 100).toFixed(2)}`;
    const parts = (lang: 'en' | 'fr') =>
      [
        a.debts ? chf(a.debts.amount) + (lang === 'en' ? ' of your debts' : ' de vos dettes') : '',
        a.interestIcc
          ? chf(a.interestIcc.amount) + (lang === 'en' ? ' of your interest' : ' de vos intérêts')
          : '',
      ]
        .filter(Boolean)
        .join(lang === 'en' ? ' and ' : ' et ');
    out.push({
      id: 'abroad:debts',
      kind: 'abroad',
      code: '55.00',
      title: t(
        '55.00 Your debts and interest, shared with your property abroad',
        '55.00 Vos dettes et intérêts, répartis avec votre immeuble à l’étranger',
      ),
      detail: t(
        `${parts('en')} go abroad, in proportion to where your gross assets lie (${pct} % abroad), wherever the loan was taken out. They come out of what is taxed here through 97.00.`,
        `${parts('fr')} sont attribués à l’étranger, au prorata de la situation de vos actifs bruts (${pct.replace('.', ',')}${NB}% à l’étranger), où que l’emprunt ait été contracté. Ils sortent de ce qui est imposé ici par le 97.00.`,
      ),
      todo: t(
        'Declare every debt on annexe E as usual, the mortgage abroad included (55.20): the form does the split.',
        'Déclarez toutes vos dettes à l’annexe E comme d’habitude, l’hypothèque à l’étranger comprise (55.20)${NB}: le formulaire fait la répartition.'.replace(
          '${NB}',
          NB,
        ),
      ),
      sources: links(
        'ge-na-law-lipp art. 57 and 58 al. 3; ch-na-law-lifd art. 6 al. 3 (p. 4); zh-na-zstb-5-3 p. 1',
      ),
    });
  }
  return out;
}

export function finalCheck(input: FinalCheckInput): FinalCheck {
  const links = (source: string) => officialLinks(source, input.canton?.documents);
  const fix: FinalCheckItem[] = [];
  const know: FinalCheckItem[] = [];
  const r = input.result;
  const Y = input.taxYear;

  // The engine can't compute, or not everything.
  if (!r) {
    const needs = input.missing.length
      ? t(
          `It needs ${input.missing.map((m) => m.en).join(' and ')}.`,
          `Il lui faut ${input.missing.map((m) => m.fr).join(' et ')}.`,
        )
      : t('', '');
    fix.push({
      id: 'cannot_compute',
      kind: 'cannot_compute',
      status: 'missing',
      title: t('Taxpresso can’t compute your tax yet', 'Taxpresso ne peut pas encore calculer'),
      detail: needs,
      todo: t('Answer the questions first.', 'Répondez d’abord aux questions.'),
      sources: [],
    });
  }
  input.notSupported.forEach((n, i) =>
    fix.push({
      id: `not_supported:${i}`,
      kind: 'not_supported',
      status: 'fix',
      title: t('Not supported yet', 'Pas encore pris en charge'),
      detail: n,
      todo: (input.canton ?? GENEVA).notSupported,
      sources: [],
    }),
  );
  (r?.unsupported ?? []).forEach((n, i) =>
    fix.push({
      id: `not_computed:${i}`,
      kind: 'not_computed',
      status: 'fix',
      title: t('A tax not computed', 'Un impôt non calculé'),
      detail: n,
      sources: [],
    }),
  );

  // What is still to give.
  if (input.questionsOpen > 0) {
    const n = input.questionsOpen;
    fix.push({
      id: 'questions_open',
      kind: 'questions_open',
      status: 'missing',
      title: t(
        `${n} question${n === 1 ? '' : 's'} still to answer`,
        `${n} question${n === 1 ? '' : 's'} encore sans réponse`,
      ),
      detail: t(
        'Each answer can change what Taxpresso asks for or computes.',
        'Chaque réponse peut changer ce que Taxpresso demande ou calcule.',
      ),
      todo: t(
        'Answer them in the chat or in the dashboard.',
        'Répondez-y dans la conversation ou le tableau de bord.',
      ),
      sources: [],
    });
  }
  for (const q of input.requirements) {
    if (q.status !== 'missing') continue;
    const who = input.couple ? WHO[q.person] : undefined;
    const count = q.need > 1 ? ` (${q.have} / ${q.need})` : '';
    const item: FinalCheckItem = {
      id: `${q.optional ? 'optional_document' : 'missing_document'}:${q.id}`,
      kind: q.optional ? 'optional_document' : 'missing_document',
      ...(q.optional ? {} : { status: 'missing' as const }),
      person: q.person,
      title: t(
        `${q.label.en}${count}${who ? `, ${who.en}` : ''}`,
        `${q.label.fr}${count}${who ? `, ${who.fr}` : ''}`,
      ),
      detail: q.reason ?? t('', ''),
      todo: q.optional
        ? t(
            'Optional: add it if you have it, or say you don’t need it.',
            `Facultatif${NB}: ajoutez-le si vous l’avez, ou dites que vous n’en avez pas besoin.`,
          )
        : t(
            'Add it in the dashboard or your Taxpresso folder.',
            'Ajoutez-le dans le tableau de bord ou votre dossier Taxpresso.',
          ),
      sources: q.source ? links(q.source) : [],
    };
    (q.optional ? know : fix).push(item);
  }
  const d = input.documents;
  if (d.toRead + d.toIdentify + d.whose > 0) {
    const parts: Text[] = [];
    if (d.toRead) parts.push(t(`${d.toRead} not read yet`, `${d.toRead} pas encore lu(s)`));
    if (d.toIdentify)
      parts.push(t(`${d.toIdentify} without a kind`, `${d.toIdentify} sans type indiqué`));
    if (d.whose)
      parts.push(
        t(
          `${d.whose} waiting for you to say whose it is`,
          `${d.whose} en attente de savoir à qui il est`,
        ),
      );
    fix.push({
      id: 'documents_unread',
      kind: 'documents_unread',
      status: 'missing',
      title: t('Documents not read yet', 'Des documents pas encore lus'),
      detail: t(
        `Documents: ${parts.map((p) => p.en).join(', ')}. Their values are not counted yet.`,
        `Documents${NB}: ${parts.map((p) => p.fr).join(', ')}. Leurs montants ne sont pas encore comptés.`,
      ),
      todo: t(
        'Say what each one is and whose it is in the dashboard, or ask Claude to read it.',
        'Indiquez ce qu’est chacun et à qui il est dans le tableau de bord, ou demandez à Claude de le lire.',
      ),
      sources: [],
    });
  }

  // Values that are not final.
  const pendingEstimates = input.values.filter((v) => v.status === 'estimate' && !v.bestFigure);
  for (const v of input.values) {
    const item = valueItem(v, input.couple);
    (item.kind === 'best_figure' ? know : fix).push(item);
  }
  for (const e of r?.estimates ?? []) {
    if (e.id === 'input-estimate') {
      // The engine rests on an estimate the values above don't name: say it as the engine does.
      if (!pendingEstimates.length && !input.values.some((v) => v.bestFigure)) {
        fix.push({
          id: 'estimate:engine',
          kind: 'estimate',
          status: 'estimate',
          title: t('Figures given as estimates', 'Montants donnés comme estimations'),
          detail: e.what,
          todo: t(
            'Replace each one with the document that shows it.',
            'Remplacez chacun par le document qui le montre.',
          ),
          sources: [],
        });
      }
      continue;
    }
    const todo = ESTIMATE_RULE_TODO[e.id as EstimateReason];
    fix.push({
      id: `estimate_rule:${e.id}`,
      kind: 'estimate_rule',
      status: 'estimate',
      title: t(
        `Geneva’s ${Y} amounts are not published yet`,
        `Les montants genevois ${Y} ne sont pas encore publiés`,
      ),
      detail: ESTIMATE_TEXT[e.id as EstimateReason] ?? e.what,
      ...(todo ? { todo: todo(Y) } : {}),
      sources: [],
    });
  }

  // "Check this" items still open.
  for (const c of input.checks) {
    if (c.resolved) continue;
    fix.push({
      id: `check:${c.id}`,
      kind: 'check',
      status: 'fix',
      ...(c.person ? { person: c.person } : {}),
      title: c.title,
      detail: c.detail,
      todo: c.todo,
      sources: c.source ? links(c.source) : [],
    });
  }

  // Amounts known only in part.
  const partial = [
    ...(r?.incomplete ?? []),
    ...(input.holdingIssues ?? []).filter((i) => i.severity === 'missing').map((i) => i.text),
  ];
  if (partial.length) {
    fix.push({
      id: 'incomplete',
      kind: 'incomplete',
      status: 'missing',
      title: t('Amounts known only in part', 'Des montants connus en partie seulement'),
      detail: t(
        'Some amounts are not known yet, so the figures that rest on them are a minimum.',
        `Certains montants ne sont pas encore connus${NB}: les montants qui en dépendent sont des minimums.`,
      ),
      list: partial,
      sources: [],
    });
  }
  const holdingChecks = (input.holdingIssues ?? []).filter((i) => i.severity === 'check');
  holdingChecks.forEach((i, n) =>
    know.push({
      id: `holding_check:${n}`,
      kind: 'holding_check',
      title: t('Your securities list (état des titres)', 'Votre état des titres'),
      detail: i.text,
      sources: i.source ? links(i.source) : [],
    }),
  );

  // The check of the official PDF.
  const pdf = input.officialPdf;
  const transmit = t(
    'You transmit the declaration yourself; Taxpresso and Claude never do.',
    `Vous transmettez la déclaration vous-même${NB}; ni Taxpresso ni Claude ne le font.`,
  );
  if (pdf.status === 'not_available') {
    know.push({
      id: 'official_pdf',
      kind: 'official_pdf',
      title: t('Check of your declaration PDF', 'Vérification du PDF de votre déclaration'),
      detail: t(
        'Not available for this canton yet: Taxpresso checks Geneva declarations only. Compare what you typed with the values to type yourself.',
        `Pas encore disponible pour ce canton${NB}: Taxpresso ne vérifie que les déclarations genevoises. Comparez vous-même ce que vous avez saisi avec les valeurs à saisir.`,
      ),
      todo: transmit,
      sources: [],
    });
  } else if (pdf.status === 'none' || pdf.status === 'pending') {
    know.push({
      id: 'official_pdf',
      kind: 'official_pdf',
      title: t('Check of your declaration PDF', 'Vérification du PDF de votre déclaration'),
      detail:
        pdf.status === 'none'
          ? t(
              'Not run yet. Once you have filled in the official form, download the PDF of your declaration and add it: Taxpresso compares it with the values to type.',
              `Pas encore faite. Une fois le formulaire officiel rempli, téléchargez le PDF de votre déclaration et ajoutez-le${NB}: Taxpresso le compare avec les valeurs à saisir.`,
            )
          : t(
              'Taxpresso is reading the PDF you added.',
              'Taxpresso lit le PDF que vous avez ajouté.',
            ),
      todo: transmit,
      sources: [],
    });
  } else if (pdf.status === 'unreadable' || pdf.status === 'other_year') {
    fix.push({
      id: 'official_pdf',
      kind: 'official_pdf',
      status: 'fix',
      title: t('Check of your declaration PDF', 'Vérification du PDF de votre déclaration'),
      detail:
        pdf.status === 'unreadable'
          ? t(
              `Taxpresso can’t read “${pdf.file}” as a Geneva declaration.`,
              `Taxpresso ne peut pas lire «${NB}${pdf.file}${NB}» comme une déclaration genevoise.`,
            )
          : t(
              `“${pdf.file}” is the declaration of another year.`,
              `«${NB}${pdf.file}${NB}» est la déclaration d’une autre année.`,
            ),
      todo: t(
        `Download the PDF of your ${Y} declaration from GeTax or the online declaration and add it.`,
        `Téléchargez le PDF de votre déclaration ${Y} depuis GeTax ou la déclaration en ligne et ajoutez-le.`,
      ),
      sources: [],
    });
  } else if (pdf.toFix > 0) {
    fix.push({
      id: 'official_pdf',
      kind: 'official_pdf',
      status: 'fix',
      title: t('Check of your declaration PDF', 'Vérification du PDF de votre déclaration'),
      detail: t(
        `“${pdf.file}” differs from the values to type on ${pdf.toFix} line${pdf.toFix === 1 ? '' : 's'}.`,
        `«${NB}${pdf.file}${NB}» diffère des valeurs à saisir sur ${pdf.toFix} ligne${pdf.toFix === 1 ? '' : 's'}.`,
      ),
      todo: t(
        'Fix each one in GeTax or the online declaration, then download the PDF again and add it.',
        'Corrigez chacune dans GeTax ou la déclaration en ligne, puis téléchargez à nouveau le PDF et ajoutez-le.',
      ),
      sources: [],
    });
  } else {
    know.push({
      id: 'official_pdf',
      kind: 'official_pdf',
      title: t('Check of your declaration PDF', 'Vérification du PDF de votre déclaration'),
      detail: pdf.clear
        ? t(
            `“${pdf.file}” matches every value Taxpresso compared.`,
            `«${NB}${pdf.file}${NB}» correspond à chaque valeur comparée par Taxpresso.`,
          )
        : t(
            `“${pdf.file}” matches, but ${pdf.notFinal} compared value${pdf.notFinal === 1 ? ' is' : 's are'} not final yet (listed above).`,
            `«${NB}${pdf.file}${NB}» correspond, mais ${pdf.notFinal} valeur${pdf.notFinal === 1 ? ' comparée n’est' : 's comparées ne sont'} pas encore définitive${pdf.notFinal === 1 ? '' : 's'} (voir plus haut).`,
          ),
      todo: transmit,
      sources: [],
    });
  }

  // Good to know: the lump sums taxed apart, limits, what the engine doesn't count, assumes or
  // can't verify.
  know.push(...capitalItems(input));
  know.push(...abroadItems(input));
  know.push(...partYearItems(input));
  know.push(...limitItems(input));
  (r?.notCounted ?? []).forEach((n, i) =>
    know.push({
      id: `not_counted:${i}`,
      kind: 'not_counted',
      title: t('Not counted', 'Pas compté'),
      detail: n,
      sources: [],
    }),
  );
  [...(r?.assumptions ?? []), ...input.ledgerNotes].forEach((n, i) =>
    know.push({
      id: `assumption:${i}`,
      kind: 'assumption',
      title: t('Assumed', 'Supposé'),
      detail: n,
      sources: [],
    }),
  );
  (r?.unverifiedRules ?? []).forEach((n, i) =>
    know.push({
      id: `unverified_rule:${i}`,
      kind: 'unverified_rule',
      title: t(
        'A rule the documents don’t spell out',
        'Une règle que les documents ne précisent pas',
      ),
      detail: n,
      sources: [],
    }),
  );
  if (input.formNote) {
    know.push({
      id: 'form_provisional',
      kind: 'form_provisional',
      title: t('Codes and labels of the form', 'Codes et libellés du formulaire'),
      detail: input.formNote,
      sources: [],
    });
  }

  const sort = (list: FinalCheckItem[], order: FinalCheckKind[]) => {
    // Without the form's order, codes in their own order; items without a code after them.
    const place = (i: FinalCheckItem) =>
      i.code === undefined
        ? Number.MAX_SAFE_INTEGER
        : input.formOrder
          ? (input.formOrder(i.code) ?? Number.MAX_SAFE_INTEGER - 1)
          : Number(i.code.replace(/\D/g, '')) || Number.MAX_SAFE_INTEGER - 1;
    return list
      .map((item, n) => ({ item, n }))
      .sort(
        (a, b) =>
          order.indexOf(a.item.kind) - order.indexOf(b.item.kind) ||
          place(a.item) - place(b.item) ||
          a.n - b.n,
      )
      .map(({ item }) => item);
  };
  const fixed = sort(fix, FIX_ORDER);
  return {
    taxYear: Y,
    verdict: fixed.length ? 'not_ready' : 'ready',
    fix: fixed,
    know: sort(know, KNOW_ORDER),
    margin: NEAR_LIMIT,
  };
}
