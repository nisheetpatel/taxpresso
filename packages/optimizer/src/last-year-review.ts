// "Last year's return, reviewed": from last year's declaration, read into prior.* facts (SPEC.md
// section 5.4, @taxpresso/rules-ge keys-prior.ts), what the household could have saved, what it may
// have missed, and what it can still do. Pure, and every amount comes from the rules engine:
// - the tax of that year is `assess` (the engine's items-to-taxes stage) run on the items the
//   declaration printed, by rubric code and person, with that year's rules (paramsFor(2025));
// - a saving is the same run again with one item changed, the difference of the two taxes
//   (SPEC.md section 8: "run the engine with and without");
// - the 3a limits are the cited 2025 ones (PILLAR3A_2025), and the 3a catch-up is the existing
//   plan (./pillar3a-catchup.ts), handed the gap rather than redone here.
// Deductions that were empty last year are only questions, never amounts. Last year's figures
// never feed this year's calculation: nothing here is an input of computeReturn.
import {
  assess,
  codeFor,
  isTaxYear,
  rubric,
  type AssessedTax,
  type AssessmentView,
  type CommuneSlug,
  type ObjectionDeadline,
  type PriorLine,
  type RubricCode,
} from '@taxpresso/rules-ge';
import {
  federalScale,
  LPP_BUYIN_FACTS,
  PILLAR3A_2025,
  PILLAR3A_CATCHUP_2026,
  PILLAR3A_CATCHUP_FACTS,
  pillar3aCapWithoutFund,
  type ItemAmount,
  type ItemPerson,
} from '@taxpresso/rules-ch';
import { pillar3aCatchUpPlan, type CatchUpPersonResult } from './pillar3a-catchup.js';
import type { TaxEstimate } from './tax-with.js';

export type ReviewPerson = 'p1' | 'p2';

/** The household at the end of the declaration's year, as far as it is known. */
export interface ReviewHousehold {
  commune?: CommuneSlug;
  /** Married or registered partners. Undefined: not known (a contribuable B line says yes). */
  couple?: boolean;
  /** Dependent children, and where they live (the questionnaire's answers). */
  children?: number;
  custody?: 'with_household' | 'shared' | 'elsewhere';
}

/** Where a household value comes from, for the assumptions shown with the review. */
export interface ReviewHouseholdFrom {
  commune?: 'declaration' | 'answers';
  couple?: 'declaration' | 'answers';
  children?: 'answers';
}

export interface ReviewInput {
  /** The printed lines of the declaration that counts (priorLines). Empty: none was read. */
  lines: readonly PriorLine[];
  /** The tax year printed on the declaration; undefined when it wasn't. */
  declarationYear?: number;
  /** The tax year being prepared now (the year a 3a catch-up can be paid). */
  taxYear: number;
  household: ReviewHousehold;
  from?: ReviewHouseholdFrom;
  /** Member of a pension fund now, as the user said: used for last year only when it can't be read. */
  hasPensionFundNow?: Partial<Record<ReviewPerson, boolean>>;
  /** This year's 3a room still open (pillar3aPlan): a catch-up comes only after it is paid. */
  room2026?: Partial<Record<ReviewPerson, number>>;
  /** The tax office's assessments of the declaration's year (assessmentViews), if any. */
  assessments?: readonly AssessmentView[];
  /** Today, YYYY-MM-DD: whether a deadline has passed. */
  today: string;
}

export type ReviewAssumption =
  /** The declaration doesn't print its year: taken as the year before this one. */
  | 'year_not_printed'
  | 'commune_from_answers'
  | 'couple_from_answers'
  | 'children_from_answers'
  | 'no_children_given'
  /** The work communes are not kept from the declaration: all communal tax at the home commune. */
  | 'home_commune_only'
  /**
   * Each saving changes one item and keeps the others as declared, medical costs and donations
   * too, although their limits move with the income: the real saving can differ a little.
   */
  | 'others_as_declared'
  | 'pension_fund_2025_same';

/** What the recomputation waits for. */
export type ReviewNeed = 'commune' | 'civil_status';

/** Why the tax is not recomputed (fail closed). */
export type ReviewUnsupported =
  /** Only that year's rules can recompute it, and Taxpresso has 2025's. */
  | 'year'
  /** The summary pages (récapitulation, PG2 and PG3) were not read. */
  | 'not_read'
  /** Part of the income was taxable elsewhere (97.00): the rate needs income Taxpresso can't see. */
  | 'income_elsewhere'
  /** The tax shield (LIPP art. 60) may apply: the engine doesn't compute it. */
  | 'shield'
  /** Shared custody, single parent: who gets the federal parental scale isn't known. */
  | 'ifd_shared_custody';

export interface Recomputed {
  /** Cantonal and communal tax (ICC), the taxe personnelle included. */
  icc: number;
  /** Federal direct tax (IFD). */
  ifd: number;
  total: number;
  taxableIncome: { icc: number; ifd: number };
  taxableWealth: number;
  sources: string[];
}

/** A total printed on the declaration (or the assessment) next to the engine's. */
export interface PrintedCheck {
  id:
    | 'gross_income'
    | 'subtotal_9220'
    | 'subtotal_9240'
    | 'net_income'
    | 'taxable_income'
    | 'gross_wealth'
    | 'net_wealth'
    | 'taxable_wealth'
    | 'assessed_tax';
  column: 'icc' | 'ifd' | 'total';
  /** The rubric code printed (91.00, 92.20...). */
  code?: string;
  printed: number;
  recomputed: number;
  /** recomputed - printed. */
  difference: number;
  /** Within a franc: the form takes whole francs (ge-2025-guide-declaration-pp p. 9). */
  matches: boolean;
  from: 'declaration' | 'assessment';
  page?: number;
  /** The assessment's value still needs the user's OK. */
  needsOk?: boolean;
}

export interface Missed3aOption {
  hasPensionFund: boolean;
  /** The 2025 limit (PILLAR3A_2025). */
  limit: number;
  /** Without a pension fund and the earned income not read: the most the limit can be. */
  limitIsMaximum: boolean;
  gap: number;
  /** The tax the gap would have saved, cantonal and federal: an estimate. */
  saving?: TaxEstimate;
}

export interface Missed3a {
  person: ReviewPerson;
  /** 31.40 (contribuable A) or 41.40 (B). */
  code: string;
  paid: number;
  page?: number;
  /** Whether the person had a pension fund that year: 'unknown' gives both options. */
  fund: 'yes' | 'no' | 'unknown';
  fundFrom?: 'declaration' | 'answers';
  options: Missed3aOption[];
  sources: string[];
}

export type ReviewQuestionId =
  | 'professional_actual'
  | 'commute'
  | 'meals'
  | 'childcare'
  | 'medical'
  | 'donations'
  | 'pension_buyin';

/** A deduction worth asking about: a question, never an amount. */
export interface ReviewQuestion {
  id: ReviewQuestionId;
  person: ReviewPerson | 'household';
  /** The rubric codes the question is about. */
  codes: string[];
  sources: string[];
}

export interface ReviewCatchUp {
  /** The year the catch-up can be paid. */
  year: number;
  /** The year whose gap it makes up. */
  gapYear: number;
  /** Gaps before this year can never be made up. */
  firstGapYear: number;
  /** From the catch-up plan (./pillar3a-catchup.ts), with last year's 3a as read. */
  people: CatchUpPersonResult[];
  capInYear: number;
  facts: typeof PILLAR3A_CATCHUP_FACTS;
  sources: string[];
}

export interface ReviewAssessment {
  docId: string;
  taxes: AssessedTax[];
  notificationDate?: string;
  deadlines: (ObjectionDeadline & { passed: boolean })[];
  /** Values read from the assessment that still need the user's OK. */
  unconfirmed: number;
}

/**
 * Once final, an assessment is changed only by a revision, which is refused for anything that could
 * have been raised during the ordinary procedure with reasonable care.
 */
export const ASSESSMENT_FINAL = {
  icc: 'ge-na-law-lpfisc art. 55 al. 2',
  ifd: 'ch-na-law-lifd art. 147 al. 2 (p. 76)',
} as const;

export interface LastYearReview {
  /**
   * 'none': no declaration read. 'needs': the tax waits for an answer (`needs`). 'unsupported': the
   * tax can't be recomputed (`unsupported`). 'ready': recomputed. The 3a gaps, the questions and
   * what can still be done come in every case but 'none'.
   */
  status: 'none' | 'needs' | 'unsupported' | 'ready';
  /** The declaration's tax year. */
  year?: number;
  needs: ReviewNeed[];
  unsupported: ReviewUnsupported[];
  recomputed?: Recomputed;
  /** Printed totals next to the engine's; any that doesn't match is a "check this". */
  checks: PrintedCheck[];
  missed3a: Missed3a[];
  questions: ReviewQuestion[];
  catchUp?: ReviewCatchUp;
  assessments: ReviewAssessment[];
  final: typeof ASSESSMENT_FINAL;
  assumptions: ReviewAssumption[];
  /** The declaration's figures were read by Taxpresso and not checked by the user. */
  needsOk: boolean;
}

type Column = 'icc' | 'ifd';
const COLUMNS: readonly Column[] = ['icc', 'ifd'];
/** The year whose rules and 3a limits Taxpresso has for a review (PILLAR3A_2025, paramsFor). */
const RULES_YEAR = 2025;
/** A franc: the form takes whole francs (ge-2025-guide-declaration-pp p. 9). Not a tax constant. */
const ROUNDING = 100;
const SPECIMEN = 'ge-2025-declaration-specimen p. 2 to 4';
const GUIDE = 'ge-2025-guide-declaration-pp';

const isIncome = (code: string) => code[0] === '1' || code[0] === '2';
/** Totals and information lines of the summary pages (91.00 to 99.00): never items. */
const isTotal = (code: string) => code[0] === '9';
const abs = Math.abs;
const sourceOf = (code: string) => rubric(code)?.source ?? `${GUIDE} p. 13`;
/** Each source once, compound ones ("a; b") split. */
const uniq = (sources: readonly string[]) => [
  ...new Set(sources.flatMap((x) => x.split('; ')).filter(Boolean)),
];

/** A line as printed: one form, code (and person), no suffix line, every occurrence summed. */
function printed(
  lines: readonly PriorLine[],
  form: PriorLine['form'],
  code: string,
  column: Column,
  person?: ItemPerson,
): { value: number; page?: number } | undefined {
  const same = lines.filter(
    (l) =>
      l.form === form &&
      l.code === code &&
      !l.suffix &&
      l[column] !== undefined &&
      (person === undefined || l.person === person),
  );
  if (!same.length) return undefined;
  return {
    value: same.reduce((s, l) => s + (l[column] ?? 0), 0),
    ...(same[0]!.page ? { page: same[0]!.page } : {}),
  };
}

/** Has the line a non-zero amount in either column? */
const shows = (
  lines: readonly PriorLine[],
  form: PriorLine['form'],
  codes: string[],
  person?: ItemPerson,
) =>
  lines.some(
    (l) =>
      l.form === form &&
      codes.includes(l.code) &&
      !l.suffix &&
      (person === undefined || l.person === person) &&
      ((l.icc ?? 0) !== 0 || (l.ifd ?? 0) !== 0),
  );

/** Each taxpayer's annex A (A1, A2) and the codes of their salary, contributions and deductions. */
const SALARY = {
  p1: { form: 'A1', income: '11.00', social: '31.10', deductions: '31.00' },
  p2: { form: 'A2', income: '21.00', social: '41.10', deductions: '41.00' },
} as const;

/**
 * The items of one column, by rubric code and person, as the summary pages print them: income
 * from page 2 (PG2), deductions from page 3 (PG3), positive income and negative deductions the way
 * the engine takes them. A taxpayer's salary or salary deductions missing from the summary page
 * are taken from the total of their annex A.
 */
function columnItems(lines: readonly PriorLine[], column: Column): ItemAmount[] {
  const out: ItemAmount[] = [];
  for (const l of lines) {
    const v = l[column];
    if (v === undefined || v === 0 || l.suffix || isTotal(l.code)) continue;
    if (l.form === 'PG2' && isIncome(l.code))
      out.push({ code: l.code, person: l.person, amount: v });
    if (l.form === 'PG3' && !isIncome(l.code))
      out.push({ code: l.code, person: l.person, amount: -abs(v) });
  }
  for (const person of ['p1', 'p2'] as const) {
    const s = SALARY[person];
    if (!lines.some((l) => l.form === 'PG2' && l.code === s.income && !l.suffix)) {
      const total = printed(lines, s.form, s.income, column);
      if (total?.value) out.push({ code: s.income, person, amount: total.value });
    }
    if (!lines.some((l) => l.form === 'PG3' && l.code === s.deductions && !l.suffix)) {
      const total = printed(lines, s.form, s.deductions, column);
      if (total?.value) out.push({ code: s.deductions, person, amount: -abs(total.value) });
    }
  }
  return out;
}

/** The wealth page (PG4, cantonal only): assets positive, debts and the social deduction negative. */
function wealthItems(lines: readonly PriorLine[]): ItemAmount[] {
  return lines
    .filter((l) => l.form === 'PG4' && !l.suffix && !isTotal(l.code) && l.icc)
    .map((l) => ({
      code: l.code,
      person: l.person,
      amount: isIncome(l.code) ? l.icc! : -abs(l.icc!),
    }));
}

interface Taxes {
  icc: number;
  ifd: number;
}

interface Run {
  taxes: (extra?: readonly ItemAmount[]) => Taxes;
  first: ReturnType<typeof assess>;
}

/**
 * The household's scales, as computeReturn derives them: Geneva's splitting
 * (../../rules-ge/src/engine/compute.ts) and the federal scale (rules-ch, federalScale), which with
 * shared custody and no answer on child support is unknown.
 */
function scales(h: Required<Pick<ReviewHousehold, 'couple'>> & ReviewHousehold) {
  const kids = h.custody === 'elsewhere' ? 0 : (h.children ?? 0);
  const full = h.custody === 'shared' ? 0 : kids;
  const shared = h.custody === 'shared' ? kids : 0;
  const splitting = h.couple || full > 0 ? 'full' : shared > 0 ? 'partial' : 'none';
  const federal = federalScale({ couple: h.couple, full, shared });
  return {
    couple: h.couple,
    splitting,
    ifdScale: federal.scale,
    ifdChildReductions: federal.childReductions,
    wealthCharges: full + shared / 2,
    singleWithChildren: !h.couple && full + shared > 0,
    ifdUnknown: federal.unsupported.length > 0,
  } as const;
}

const save = (before: Taxes, after: Taxes): TaxEstimate => ({
  cantonalCentimes: before.icc - after.icc,
  federalCentimes: before.ifd - after.ifd,
  totalCentimes: before.icc + before.ifd - (after.icc + after.ifd),
});

function deadlineDays(views: readonly AssessmentView[], today: string): ReviewAssessment[] {
  return views.map((v) => ({
    docId: v.docId,
    taxes: v.taxes,
    ...(v.notificationDate ? { notificationDate: v.notificationDate } : {}),
    deadlines: v.deadlines.map((d) => ({ ...d, passed: d.date < today })),
    unconfirmed: v.unconfirmed,
  }));
}

export function reviewLastYear(input: ReviewInput): LastYearReview {
  const { lines } = input;
  const assumptions: ReviewAssumption[] = [];
  const assume = (a: ReviewAssumption) => assumptions.includes(a) || assumptions.push(a);
  const review: LastYearReview = {
    status: 'none',
    needs: [],
    unsupported: [],
    checks: [],
    missed3a: [],
    questions: [],
    assessments: deadlineDays(input.assessments ?? [], input.today),
    final: ASSESSMENT_FINAL,
    assumptions,
    needsOk: lines.some((l) => l.status === 'extracted'),
  };
  if (!lines.length) return review;

  const year = input.declarationYear ?? input.taxYear - 1;
  review.year = year;
  if (input.declarationYear === undefined) assume('year_not_printed');
  const hasB = lines.some((l) => l.person === 'p2');
  const couple = hasB ? true : input.household.couple;
  const people: ReviewPerson[] = couple ? ['p1', 'p2'] : ['p1'];
  const annexRead = (p: ReviewPerson) => lines.some((l) => l.form === SALARY[p].form);
  const pg3Read = lines.some((l) => l.form === 'PG3');
  const salary = (p: ReviewPerson) =>
    printed(lines, 'PG2', SALARY[p].income, 'icc', p) ??
    printed(lines, SALARY[p].form, SALARY[p].income, 'icc');

  // The tax, recomputed from the printed items with that year's rules.
  let run: Run | undefined;
  if (!isTaxYear(year) || year !== RULES_YEAR) review.unsupported.push('year');
  if (!lines.some((l) => l.form === 'PG2') || !pg3Read) review.unsupported.push('not_read');
  if (COLUMNS.some((c) => (printed(lines, 'PG3', '97.00', c)?.value ?? 0) !== 0)) {
    review.unsupported.push('income_elsewhere');
  }
  if (!input.household.commune) review.needs.push('commune');
  else if (input.from?.commune === 'answers') assume('commune_from_answers');
  if (couple === undefined) review.needs.push('civil_status');
  else if (!hasB && input.from?.couple === 'answers') assume('couple_from_answers');
  if (input.household.children === undefined) assume('no_children_given');
  else if (input.household.children > 0) assume('children_from_answers');

  if (!review.unsupported.length && !review.needs.length) {
    const s = scales({ ...input.household, couple: couple! });
    if (s.ifdUnknown) review.unsupported.push('ifd_shared_custody');
    else {
      const icc = columnItems(lines, 'icc');
      const ifd = columnItems(lines, 'ifd');
      const wealth = wealthItems(lines);
      const at = (extra: readonly ItemAmount[] = []) =>
        assess({
          taxYear: RULES_YEAR,
          commune: input.household.commune!,
          couple: s.couple,
          splitting: s.splitting,
          ifdScale: s.ifdScale,
          ifdChildReductions: s.ifdChildReductions,
          wealthCharges: s.wealthCharges,
          singleWithChildren: s.singleWithChildren,
          iccItems: [...icc, ...extra],
          wealthItems: wealth,
          ifdItems: [...ifd, ...extra],
        });
      const first = at();
      if (first.shieldMayApply) review.unsupported.push('shield');
      else {
        run = {
          first,
          taxes: (extra = []) => {
            const r = extra.length ? at(extra) : first;
            return { icc: r.icc.taxes.total.amount, ifd: r.ifd.tax.amount };
          },
        };
      }
    }
  }
  review.status = review.unsupported.length
    ? 'unsupported'
    : review.needs.length
      ? 'needs'
      : 'ready';

  if (run) {
    const r = run.first;
    const taxes = run.taxes();
    review.recomputed = {
      icc: taxes.icc,
      ifd: taxes.ifd,
      total: taxes.icc + taxes.ifd,
      taxableIncome: { icc: r.icc.taxableIncome.amount, ifd: r.ifd.taxableIncome.amount },
      taxableWealth: r.icc.wealth.taxableWealth.amount,
      sources: uniq([SPECIMEN, ...r.icc.taxes.total.sources, ...r.ifd.tax.sources]),
    };
    if (people.some((p) => (salary(p)?.value ?? 0) > 0)) assume('home_commune_only');
    // Totals printed on the declaration next to the engine's.
    const check = (
      id: PrintedCheck['id'],
      form: PriorLine['form'],
      code: string,
      column: Column,
      recomputed: number,
      fallback?: PriorLine['form'],
    ) => {
      const p =
        printed(lines, form, code, column) ??
        (fallback ? printed(lines, fallback, code, column) : undefined);
      if (!p) return;
      const difference = recomputed - p.value;
      review.checks.push({
        id,
        column,
        code,
        printed: p.value,
        recomputed,
        difference,
        matches: abs(difference) <= ROUNDING,
        from: 'declaration',
        ...(p.page ? { page: p.page } : {}),
      });
    };
    for (const c of COLUMNS) {
      const t = c === 'icc' ? r.icc : r.ifd;
      check('gross_income', 'PG2', '91.00', c, t.grossIncome.amount, 'PG3');
      check('subtotal_9220', 'PG3', '92.20', c, t.subtotal9220.amount);
      check('subtotal_9240', 'PG3', '92.40', c, t.subtotal9240.amount);
      check('net_income', 'PG3', '95.00', c, t.totalIncome.amount);
      check('taxable_income', 'PG3', '99.00', c, t.taxableIncome.amount);
    }
    check('gross_wealth', 'PG4', '91.00', 'icc', r.icc.wealth.grossWealth.amount);
    check('net_wealth', 'PG4', '95.00', 'icc', r.icc.wealth.netWealth.amount);
    check('taxable_wealth', 'PG4', '99.00', 'icc', r.icc.wealth.taxableWealth.amount);
    // The tax the office assessed, when its assessment is in the folder.
    for (const v of input.assessments ?? []) {
      const amount = v.totals.find((x) => x.key === 'assessment.tax_amount')?.assessed;
      if (amount === undefined) continue;
      const column = v.taxes.length === 1 ? v.taxes[0]! : 'total';
      const recomputed =
        column === 'icc' ? taxes.icc : column === 'ifd' ? taxes.ifd : taxes.icc + taxes.ifd;
      const difference = recomputed - amount;
      review.checks.push({
        id: 'assessed_tax',
        column,
        printed: amount,
        recomputed,
        difference,
        matches: abs(difference) <= ROUNDING,
        from: 'assessment',
        ...(v.unconfirmed ? { needsOk: true } : {}),
      });
    }
  }

  // Pillar 3a not paid in full, per person with a salary, against the cited 2025 limits.
  if (year === RULES_YEAR) {
    const lim = PILLAR3A_2025.value;
    for (const p of people) {
      if (!annexRead(p) || !(salary(p)?.value ?? 0)) continue;
      const code = codeFor('31.40', p);
      const paidLine =
        printed(lines, SALARY[p].form, code, 'icc') ?? printed(lines, SALARY[p].form, code, 'ifd');
      const paid = paidLine?.value ?? 0;
      let fund: Missed3a['fund'] = 'unknown';
      let fundFrom: Missed3a['fundFrom'];
      if (shows(lines, SALARY[p].form, [codeFor('31.12', p)])) {
        fund = 'yes';
        fundFrom = 'declaration';
      } else if (paid > lim.capWithPensionFund) {
        fund = 'no';
        fundFrom = 'declaration';
      } else if (input.hasPensionFundNow?.[p] !== undefined) {
        fund = input.hasPensionFundNow[p] ? 'yes' : 'no';
        fundFrom = 'answers';
        assume('pension_fund_2025_same');
      }
      const earned = (() => {
        const gross = salary(p)?.value;
        const social = printed(lines, SALARY[p].form, SALARY[p].social, 'icc');
        return gross === undefined || !social ? undefined : gross - abs(social.value);
      })();
      const options: Missed3aOption[] = [];
      for (const withFund of fund === 'unknown' ? [true, false] : [fund === 'yes']) {
        const limit = withFund
          ? lim.capWithPensionFund
          : earned === undefined
            ? lim.capWithoutPensionFund
            : pillar3aCapWithoutFund(earned, {
                withoutFundMax: lim.capWithoutPensionFund,
                withoutFundShareBp: lim.shareWithoutPensionFundBp,
              });
        const gap = Math.max(0, limit - paid);
        const option: Missed3aOption = {
          hasPensionFund: withFund,
          limit,
          limitIsMaximum: !withFund && earned === undefined,
          gap,
        };
        if (run && gap > 0) {
          option.saving = save(run.taxes(), run.taxes([{ code, person: p, amount: -gap }]));
          assume('others_as_declared');
        }
        options.push(option);
      }
      review.missed3a.push({
        person: p,
        code,
        paid,
        ...(paidLine?.page ? { page: paidLine.page } : {}),
        fund,
        ...(fundFrom ? { fundFrom } : {}),
        options,
        sources: uniq([PILLAR3A_2025.source, sourceOf(code), ...(run ? [SPECIMEN] : [])]),
      });
    }
  }

  // Deductions that were empty last year: questions, never amounts.
  const ask = (
    id: ReviewQuestionId,
    person: ReviewQuestion['person'],
    codes: string[],
    sources: string[],
  ) => review.questions.push({ id, person, codes, sources: uniq(sources) });
  for (const p of people) {
    if (!annexRead(p) || !(salary(p)?.value ?? 0)) continue;
    const form = SALARY[p].form;
    const c = (code: RubricCode) => codeFor(code, p);
    // The flat deduction (31.50 cantonal, 31.20 federal) and no actual costs (meals, other costs).
    if (
      shows(lines, form, [c('31.50'), c('31.20')]) &&
      !shows(lines, form, [c('31.60'), c('31.63')])
    ) {
      ask(
        'professional_actual',
        p,
        [c('31.50'), c('31.20')],
        [sourceOf('31.50'), `${GUIDE} p. 22`],
      );
    }
    if (!shows(lines, form, [c('31.70'), c('31.71')])) {
      ask('commute', p, [c('31.70'), c('31.71')], [sourceOf('31.70'), sourceOf('31.71')]);
    }
    if (!shows(lines, form, [c('31.60')])) ask('meals', p, [c('31.60')], [sourceOf('31.60')]);
    if (shows(lines, form, [c('31.12')]) && !shows(lines, form, [c('31.30')])) {
      ask(
        'pension_buyin',
        p,
        [c('31.30')],
        [sourceOf('31.30'), LPP_BUYIN_FACTS.capacityFromFund, LPP_BUYIN_FACTS.paidInYear],
      );
    }
  }
  if (pg3Read) {
    const kids = input.household.custody === 'elsewhere' ? 0 : (input.household.children ?? 0);
    if (kids > 0 && !(printed(lines, 'PG3', '59.00', 'icc')?.value ?? 0)) {
      ask('childcare', 'household', ['59.10', '59.12'], [sourceOf('59.10')]);
    }
    if (!shows(lines, 'PG3', ['71.00']))
      ask('medical', 'household', ['71.00'], [sourceOf('71.00')]);
    if (!shows(lines, 'PG3', ['73.00', '73.10', '73.20'])) {
      ask('donations', 'household', ['73.00'], [sourceOf('73.00')]);
    }
  }

  // The 3a catch-up: the existing plan, given last year's 3a as read. Its saving stays in the plan.
  const cu = PILLAR3A_CATCHUP_2026.value;
  const sure = review.missed3a.filter((m) => m.fund !== 'unknown');
  if (
    input.taxYear === 2026 &&
    year >= cu.firstGapYear &&
    year >= input.taxYear - cu.lookbackYears &&
    sure.length
  ) {
    const plan = pillar3aCatchUpPlan(
      // No salary: the plan gives the amounts and leaves the saving to the 3a catch-up card.
      {
        couple: Boolean(couple),
        children: 0,
        people: sure.map((m) => ({
          person: m.person,
          hasPensionFund: m.fund === 'yes',
          paidCentimes: 0,
        })),
      },
      sure.map((m) => ({
        person: m.person,
        paid2025Centimes: m.paid,
        hasPensionFund: m.fund === 'yes',
        room2026Centimes: input.room2026?.[m.person] ?? 0,
        limit2025Centimes: m.options[0]!.limit,
      })),
    );
    review.catchUp = {
      year: input.taxYear,
      gapYear: year,
      firstGapYear: cu.firstGapYear,
      people: plan.people,
      capInYear: plan.capInYearCentimes,
      facts: plan.facts,
      // The plan's own sources less the ones of its saving, which it doesn't compute here.
      sources: uniq([PILLAR3A_CATCHUP_2026.source, PILLAR3A_2025.source]),
    };
  }
  return review;
}
