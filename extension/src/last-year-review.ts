// "Last year's return, reviewed" (review_last_year, and the dashboard card "Last year, reviewed"):
// from last year's declaration as Taxpresso read it, that year's tax recomputed, what could have
// been saved, the deductions worth asking about, and what can still be done. The review itself is
// a pure function (@taxpresso/optimizer, reviewLastYear) on the rules engine; this file gathers its
// inputs from the workspace and words its result. Read-only, and never part of this year's tax.
// (./review.ts is get_document_for_review, a different thing.)
import type { McpServer } from '@modelcontextprotocol/server';
import type { Fact, FactValue } from '@taxpresso/ledger';
import {
  reviewLastYear,
  type LastYearReview,
  type Missed3a,
  type PrintedCheck,
  type ReviewAssumption,
  type ReviewHousehold,
  type ReviewHouseholdFrom,
  type ReviewPerson,
  type ReviewQuestionId,
  type ReviewUnsupported,
} from '@taxpresso/optimizer';
import {
  assessmentViews,
  COMMUNES_2026,
  PILLAR3A_CATCHUP_FACTS,
  type CommuneSlug,
} from '@taxpresso/rules-ge';
import * as z from 'zod/v4';
import { room2026 } from './planning.js';
import { chfText, lastYearLines } from './prior.js';
import type { Workspace } from './workspace.js';

const COUPLE = new Set(['married', 'registered_partnership']);
const isCommune = (v: FactValue | undefined): v is CommuneSlug =>
  typeof v === 'string' && COMMUNES_2026.some((c) => c.slug === v);

export interface ReviewView extends LastYearReview {
  /** The declaration the review is read from. */
  filename?: string;
  /** The household the tax was recomputed for, and where each value comes from. */
  household: ReviewHousehold;
  from: ReviewHouseholdFrom;
  couple: boolean;
  /** Assessments in the folder whose tax year isn't known yet. */
  unknownYearAssessments: number;
  /** What the 3a catch-up card already has as the 2025 payment, per person (null: nothing). */
  catchUpPaid2025: Partial<Record<ReviewPerson, number | null>>;
}

/** The review of the declaration that counts, from the workspace. */
export function reviewOf(ws: Workspace, today = new Date().toISOString().slice(0, 10)): ReviewView {
  const taxYear = ws.engine.taxYear;
  const doc = ws.priorDocument();
  const tax = (d: { kind?: string }) => d.kind === 'tax_assessment';
  const unknownYearAssessments = ws
    .activeDocuments()
    .filter((d) => tax(d) && d.taxYear === undefined).length;
  if (!doc) {
    return {
      ...reviewLastYear({ lines: [], taxYear, household: {}, today }),
      household: {},
      from: {},
      couple: false,
      unknownYearAssessments,
      catchUpPaid2025: {},
    };
  }
  const year = doc.taxYear ?? taxYear - 1;
  // What the declaration itself said (its suggestion, even once the user answered for this year),
  // then the household's current answer.
  const fromDoc = (key: string) =>
    ws.ledger
      .history(key, 'household')
      .filter((f: Fact) => f.source.docId === doc.id)
      .at(-1)?.value;
  const now = (key: string) => ws.ledger.get(key, 'household')?.value;
  const household: ReviewHousehold = {};
  const from: ReviewHouseholdFrom = {};
  const communeDoc = fromDoc('profile.commune');
  const communeNow = now('profile.commune');
  if (isCommune(communeDoc)) {
    household.commune = communeDoc;
    from.commune = 'declaration';
  } else if (isCommune(communeNow)) {
    household.commune = communeNow;
    from.commune = 'answers';
  }
  const statusDoc = fromDoc('profile.civil_status');
  const statusNow = now('profile.civil_status');
  if (typeof statusDoc === 'string') {
    household.couple = COUPLE.has(statusDoc);
    from.couple = 'declaration';
  } else if (typeof statusNow === 'string') {
    household.couple = COUPLE.has(statusNow);
    from.couple = 'answers';
  }
  const children = now('profile.children_count');
  if (typeof children === 'number') {
    household.children = children;
    from.children = 'answers';
  }
  const custody = now('profile.children_custody');
  if (custody === 'with_household' || custody === 'shared' || custody === 'elsewhere') {
    household.custody = custody;
  }
  const people: ReviewPerson[] = ['p1', 'p2'];
  const hasPensionFundNow: Partial<Record<ReviewPerson, boolean>> = {};
  const catchUpPaid2025: ReviewView['catchUpPaid2025'] = {};
  for (const p of people) {
    const fund = ws.ledger.get('plan.has_pension_fund', p)?.value;
    if (typeof fund === 'boolean') hasPensionFundNow[p] = fund;
    const paid = ws.ledger.get('plan.pillar3a_paid_2025', p)?.value;
    catchUpPaid2025[p] = typeof paid === 'number' && paid >= 0 ? paid : null;
  }
  // The tax office's assessments of that year, with their own values only.
  const assessments = assessmentViews(
    ws.activeDocuments().filter((d) => tax(d) && d.taxYear === year),
    ws.countedFacts(),
  );
  const review = reviewLastYear({
    lines: lastYearLines(ws.ledger, doc.id),
    ...(doc.taxYear !== undefined ? { declarationYear: doc.taxYear } : {}),
    taxYear,
    household,
    from,
    hasPensionFundNow,
    room2026: room2026(ws),
    assessments,
    today,
  });
  return {
    ...review,
    filename: doc.filename,
    household,
    from,
    couple: review.missed3a.some((m) => m.person === 'p2') || household.couple === true,
    unknownYearAssessments,
    catchUpPaid2025,
  };
}

// ---- Words for Claude (English; Claude replies in the user's language) -----------------------

const WHO: Record<string, string> = {
  p1: 'you',
  p2: 'your spouse or partner',
  household: 'household',
};

/** "about CHF 190": a saving is an estimate, shown to the franc in structuredContent. */
const about = (centimes: number) => `about ${chfText(Math.round(centimes / 100) * 100)}`;

const CHECK_LABEL: Record<PrintedCheck['id'], string> = {
  gross_income: 'gross income (revenu brut)',
  subtotal_9220: 'subtotal 92.20',
  subtotal_9240: 'subtotal 92.40',
  net_income: 'total net income (revenu net total)',
  taxable_income: 'taxable income (revenu imposable)',
  gross_wealth: 'gross wealth (fortune brute)',
  net_wealth: 'net wealth (fortune nette)',
  taxable_wealth: 'taxable wealth (fortune imposable)',
  assessed_tax: 'tax on the assessment (montant de l’impôt)',
};

const COLUMN: Record<PrintedCheck['column'], string> = {
  icc: 'ICC',
  ifd: 'IFD',
  total: 'ICC and IFD together',
};

const UNSUPPORTED: Record<ReviewUnsupported, string> = {
  year: 'Taxpresso recomputes only a 2025 declaration (the rules it has).',
  not_read: 'Taxpresso could not read the summary pages (récapitulation, pages 2 and 3).',
  income_elsewhere:
    'Part of the income was taxable elsewhere (97.00): the rate depends on income Taxpresso can’t see.',
  shield:
    'The tax shield (bouclier fiscal, LIPP art. 60) may apply, which Taxpresso doesn’t compute yet.',
  ifd_shared_custody:
    'Shared custody as a single parent: which parent gets the federal parental scale isn’t known.',
};

const ASSUMPTION: Record<ReviewAssumption, string> = {
  year_not_printed: 'The declaration doesn’t print its year: taken as last year.',
  commune_from_answers: 'The commune of this year’s answers (the declaration’s wasn’t read).',
  couple_from_answers: 'The civil status of this year’s answers.',
  children_from_answers: 'The children of this year’s answers.',
  no_children_given: 'No children counted (none given in the answers).',
  home_commune_only:
    'All communal tax at the home commune: the work communes aren’t kept from the declaration.',
  others_as_declared:
    'Each saving changes one item and keeps the rest as declared, medical costs and donations too, whose limits move with income: the real saving can differ a little.',
  pension_fund_2025_same: 'Pension fund taken as now, for last year too.',
};

const QUESTION: Record<ReviewQuestionId, string> = {
  professional_actual:
    'the flat deduction for work costs (déduction forfaitaire). Ask whether the actual costs (frais effectifs) were higher, for example tools or union dues.',
  commute:
    'no commuting costs (frais de déplacement). Ask whether they pay to get to work, for example a public transport pass or a bike.',
  meals:
    'no meal costs (frais de repas). Ask whether they eat their main meal away from home on working days.',
  childcare:
    'no childcare costs (frais de garde). Ask whether they pay for a crèche, after-school care (parascolaire) or a nanny for a child under 14.',
  medical:
    'no medical costs (frais médicaux). Ask whether costs the health insurance didn’t cover (dentist, glasses, the deductible) were high: only the part above a share of income counts.',
  donations: 'no donations (dons). Ask whether they give to tax-exempt charities.',
  pension_buyin:
    'no pension fund buy-in (rachat 2e pilier). Their pension certificate shows if they can buy in; a buy-in the fund receives by 31 December counts for this year.',
};

function missedText(m: Missed3a, year: number): string[] {
  const who = WHO[m.person]!;
  const paid = `paid ${chfText(m.paid)} (${m.code}${m.page ? `, page ${m.page}` : ''})`;
  const option = (o: Missed3a['options'][number]) => {
    const limit = `${o.limitIsMaximum ? 'at most ' : ''}${chfText(o.limit)}`;
    const left = o.gap
      ? `${o.limitIsMaximum ? 'up to ' : ''}${chfText(o.gap)} left`
      : 'the maximum was paid';
    const saving = o.saving
      ? `; paying it in full would have saved ${about(o.saving.totalCentimes)} (ICC ${chfText(o.saving.cantonalCentimes)}, IFD ${chfText(o.saving.federalCentimes)}), an estimate`
      : '';
    return `${year} limit ${limit}: ${left}${saving}`;
  };
  if (m.fund === 'unknown') {
    const [withFund, without] = m.options;
    return [
      `- Pillar 3a (3e pilier A), ${who}: ${paid}. Whether they had a pension fund (2e pilier) isn’t known: with one, ${option(withFund!)}; without one, ${option(without!)}. Ask; box 10.1 of the salary certificate shows contributions. [${m.sources.join('; ')}]`,
    ];
  }
  const fund =
    m.fund === 'yes'
      ? m.fundFrom === 'declaration'
        ? 'with a pension fund (the declaration shows contributions)'
        : 'with a pension fund (as now)'
      : m.fundFrom === 'declaration'
        ? 'without a pension fund (more than the limit with one was paid)'
        : 'without a pension fund (as now)';
  return [
    `- Pillar 3a (3e pilier A), ${who}: ${paid}, ${fund}; ${option(m.options[0]!)}. [${m.sources.join('; ')}]`,
  ];
}

/** review_last_year's text: concise, every figure with its source (C6). */
export function reviewText(v: ReviewView, detail: boolean): string {
  if (v.status === 'none') {
    return "No previous declaration read yet, so there is nothing to review. Ask the user for last year's declaration (the PDF from GeTax, the online declaration or their tax software): they drop it in the dashboard or the Taxpresso folder, then call ingest_vault. Taxpresso reads it on this computer and keeps no name or number from it.";
  }
  const year = v.year!;
  const out = [
    `Last year's return (${year}), reviewed from “${v.filename}”: figures read by Taxpresso on this computer${v.needsOk ? ', not checked by the user' : ''}. Every amount comes from Taxpresso's rules engine with the ${year} rules; savings are estimates. Last year's figures never change this year's tax.`,
  ];

  // 1. The tax, recomputed.
  const h = v.household;
  if (h.commune || h.couple !== undefined) {
    const said = (f?: string) =>
      f === 'declaration' ? 'read from the declaration' : 'from this year’s answers';
    const parts = [
      ...(h.commune ? [`commune ${h.commune} (${said(v.from.commune)})`] : []),
      ...(h.couple !== undefined
        ? [`${h.couple ? 'a couple' : 'single'} (${said(v.from.couple)})`]
        : []),
      `${h.children ?? 0} child${h.children === 1 ? '' : 'ren'}${h.children === undefined ? ' (none given)' : ' (from this year’s answers)'}`,
    ];
    out.push(`Household for ${year}: ${parts.join(', ')}.`);
  }
  if (v.recomputed) {
    const r = v.recomputed;
    out.push(
      `Tax ${year}, recomputed: cantonal and communal (ICC) ${chfText(r.icc)}, federal (IFD) ${chfText(r.ifd)}, total ${chfText(r.total)}. Taxable income (revenu imposable): ICC ${chfText(r.taxableIncome.icc)}, IFD ${chfText(r.taxableIncome.ifd)}; taxable wealth ${chfText(r.taxableWealth)}. The declaration itself doesn't print the tax. [${r.sources.join('; ')}]`,
    );
  } else if (v.status === 'needs') {
    const needs = v.needs.map((n) => (n === 'commune' ? 'the commune' : 'the civil status'));
    out.push(
      `Not recomputed yet: Taxpresso needs ${needs.join(' and ')} (next_questions asks for it).`,
    );
  } else if (v.status === 'unsupported') {
    out.push(`Not recomputed: ${v.unsupported.map((u) => UNSUPPORTED[u]).join(' ')}`);
  }
  const differ = v.checks.filter((c) => !c.matches);
  const same = v.checks.filter((c) => c.matches);
  for (const c of differ) {
    const where =
      c.from === 'assessment'
        ? `the assessment${c.needsOk ? ' (value not confirmed by the user yet)' : ''}`
        : `the declaration (${c.code}${c.page ? `, page ${c.page}` : ''})`;
    out.push(
      `Check this: ${CHECK_LABEL[c.id]}, ${COLUMN[c.column]}: ${chfText(c.printed)} on ${where}, ${chfText(c.recomputed)} recomputed (${c.difference > 0 ? '+' : ''}${chfText(c.difference)}). It may be a reading problem or a rule Taxpresso doesn't cover: say so plainly, and never say the tax office was wrong.`,
    );
  }
  if (same.length) {
    const list = same.map((c) =>
      c.id.endsWith('wealth')
        ? `${c.code} wealth`
        : `${c.code ?? CHECK_LABEL[c.id]} ${COLUMN[c.column]}`,
    );
    out.push(
      detail || !differ.length
        ? `The recomputed totals match the ones printed: ${list.join(', ')}.`
        : `${same.length} other printed total${same.length === 1 ? '' : 's'} match.`,
    );
  }

  // 2. What could have been saved, and what to ask.
  if (v.missed3a.length) {
    out.push('Pillar 3a not paid in full:');
    for (const m of v.missed3a) out.push(...missedText(m, year));
  }
  if (v.questions.length) {
    out.push(
      'Worth asking (only questions, never an amount; last year these codes were empty or at the flat rate):',
    );
    for (const q of v.questions) {
      out.push(
        `- ${WHO[q.person]}, ${q.codes.join(', ')}: ${QUESTION[q.id]} [${q.sources.join('; ')}]`,
      );
    }
  }

  // 3. What can still be done.
  out.push('What can still be done:');
  const cu = v.catchUp;
  if (cu) {
    for (const p of cu.people) {
      if (p.status === 'no_gap' || p.status === 'unknown') continue;
      const paid = v.missed3a.find((m) => m.person === p.person)?.paid ?? 0;
      const card = v.catchUpPaid2025[p.person];
      const hint =
        card === null || card === undefined
          ? ` The plan needs what was paid in ${cu.gapYear}: ${chfText(paid)} on the declaration; save it with set_fact (plan.pillar3a_paid_${cu.gapYear}) once the user confirms it.`
          : card !== paid
            ? ` The plan has ${chfText(card)} as paid in ${cu.gapYear}, the declaration ${chfText(paid)}: check which is right with the user.`
            : '';
      out.push(
        `- 3a catch-up (rachat 3a), ${WHO[p.person]}: up to ${chfText(p.catchUpCentimes)} can still be paid in ${cu.year} to make up ${cu.gapYear}${p.status === 'pay_this_year_first' ? `, after paying this year's 3a in full` : ''}. For its saving and rules, use the 3a catch-up plan (list_optimizations; in the dashboard “Make up for 2025 in your 3a”).${hint} [${cu.sources.join('; ')}]`,
      );
    }
  } else if (year < 2025) {
    out.push(
      `- A 3a gap from before 2025 can never be made up (${PILLAR3A_CATCHUP_FACTS.onlyGapsFrom2025}).`,
    );
  }
  for (const a of v.assessments) {
    const dated = a.notificationDate ? ` dated ${a.notificationDate}` : '';
    const deadlines = a.deadlines.length
      ? a.deadlines
          .map(
            (d) =>
              `${d.tax.toUpperCase()} ${d.date}${d.passed ? ' (passed)' : ''} [${d.sources.join('; ')}]`,
          )
          .join(', ')
      : 'not shown, the date of the assessment isn’t known: the deadline is printed on it';
    out.push(
      `- The ${year} assessment (avis de taxation)${dated}: deadline to object (réclamation) ${deadlines}. Give it as a fact; the date printed on the assessment wins. Don't advise objecting.`,
    );
  }
  if (!v.assessments.length) {
    out.push(
      `- No ${year} assessment (avis de taxation) in the folder. If the user has it, they can drop it in: Taxpresso shows its deadline to object.`,
    );
  }
  if (v.unknownYearAssessments) {
    out.push(
      `- ${v.unknownYearAssessments} assessment${v.unknownYearAssessments === 1 ? '' : 's'} in the folder without a tax year: ask which year, and give it with propose_extraction (document.taxYear).`,
    );
  }
  out.push(
    `- Once an assessment is final, it can't simply be changed: a revision (révision) is refused for anything that could have been raised before with reasonable care (${v.final.icc}; ${v.final.ifd}). Say so plainly; never advise contesting.`,
  );
  if (v.assumptions.length) {
    out.push(`Assumptions: ${v.assumptions.map((a) => ASSUMPTION[a]).join(' ')}`);
  }
  return out.join('\n');
}

export function registerReviewTool(server: McpServer, ws: Workspace): void {
  server.registerTool(
    'review_last_year',
    {
      title: "Review last year's return",
      description:
        "Reviews the user's last Geneva declaration: that year's tax recomputed, pillar 3a left unpaid and what it would have saved, empty deductions worth asking about, the 3a catch-up still possible, an assessment's objection deadline. Estimates with sources.",
      inputSchema: z.object({
        detail: z.boolean().optional().describe('Also list every printed total that matches.'),
      }),
      outputSchema: z.looseObject({
        found: z.boolean(),
        status: z.enum(['none', 'needs', 'unsupported', 'ready']),
        year: z.number().int().optional(),
      }),
      annotations: {
        title: "Review last year's return",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ detail }) => {
      await ws.ready();
      const view = reviewOf(ws);
      return {
        content: [{ type: 'text', text: reviewText(view, detail === true) }],
        structuredContent: { found: view.status !== 'none', ...view },
      };
    },
  );
}
