import { SUPPORTED_CANTONS } from '@taxpresso/rules-ch';
import * as z from 'zod/v4';
import { CANTONS, cantonNames } from './cantons.js';
import { UI_LANGUAGES } from './config.js';
import { holdings, holdingsStatusText } from './holdings.js';
import { priorStatusText } from './prior.js';
import { securitiesStatusText } from './securities.js';
import { BARCODE_PENDING, isBarcodeDocument } from './barcode.js';
import type { Workspace } from './workspace.js';

export const StatusSchema = z.object({
  product: z.literal('Taxpresso'),
  version: z.string(),
  taxYear: z.number().int(),
  canton: z
    .enum(SUPPORTED_CANTONS)
    .nullable()
    .describe('The canton of the return: where the user lived on 31 December. null until known.'),
  cantonFrom: z
    .enum(['answer', 'earlier_answers', 'none'])
    .describe(
      'answer: the user said so. earlier_answers: taken from answers only that canton asks (a return started before the canton question); the user can still answer it.',
    ),
  cantonBecause: z
    .array(z.string())
    .describe('With cantonFrom earlier_answers: which answers say so.'),
  household: z.object({
    started: z.boolean(),
    people: z.number().int(),
    summary: z.array(z.string()).describe('Short summaries of the answers so far.'),
  }),
  progress: z.object({
    questionsAnswered: z.number().int(),
    questionsOpen: z.number().int(),
    documents: z.number().int(),
    documentsToIdentify: z.number().int(),
    documentsToRead: z.number().int().describe('Documents Claude has not read yet.'),
    documentsFromBarcode: z
      .number()
      .int()
      .describe('Documents read from their barcode: verified values, nothing for Claude to read.'),
    documentsWaitingForWhose: z
      .number()
      .int()
      .describe(
        'Certificates read from their barcode whose owner the user still has to say (dashboard).',
      ),
    valuesToConfirm: z
      .number()
      .int()
      .describe("Values read from documents that still need the user's OK."),
  }),
  missing: z.array(z.string()).describe('Documents still needed, with whose they are.'),
  optional: z
    .array(
      z.object({ id: z.string(), label: z.string(), reason: z.string(), skipped: z.boolean() }),
    )
    .describe(
      'Optional documents not here yet: the user can skip one, or take that back, with waive_requirement.',
    ),
  checks: z
    .array(z.string())
    .describe('"Check this" items across documents, with their id and what to do.'),
  notSupported: z
    .array(z.string())
    .describe('Parts of the situation Taxpresso cannot prepare yet.'),
  estimates: z.array(z.string()),
  securities: z
    .string()
    .optional()
    .describe('The securities list (état des titres) read from broker exports, in one line.'),
  holdings: z
    .string()
    .optional()
    .describe(
      'The état des titres and other movable wealth as computed: totals, withholding tax claimed back, what is missing.',
    ),
  lastYear: z
    .string()
    .optional()
    .describe(
      "Last year's declaration, read by Taxpresso: suggested answers and figures to compare.",
    ),
  nextStep: z.string(),
  vault: z.object({ path: z.string(), exists: z.boolean(), problem: z.string().optional() }),
  dashboard: z.object({ running: z.boolean() }),
  uiLanguage: z.enum(UI_LANGUAGES),
  runtime: z
    .object({ node: z.string(), platform: z.string(), arch: z.string(), execPath: z.string() })
    .optional()
    .describe('Only with detail: the Node runtime this extension runs on.'),
});
export type Status = z.infer<typeof StatusSchema>;

const WHO: Record<string, string> = { p1: 'you', p2: 'your spouse or partner' };

export function buildStatus(
  ws: Workspace,
  opts: { dashboardRunning: boolean; detail?: boolean; execPath?: string },
): Status {
  const snap = ws.snapshot();
  const answered = snap.slots.filter((s) => s.value !== undefined).length;
  const open = snap.slots.length - answered;
  const requirements = ws.requirements();
  const missing = requirements
    .filter((r) => r.status === 'missing' && !r.optional)
    .map((r) => {
      const who = WHO[r.person];
      const count =
        'count' in r.expects && r.expects.count > 1 ? ` (${r.have} of ${r.expects.count})` : '';
      return `${r.label.en}${count}${who && snap.people.length > 1 ? `, ${who}` : ''}`;
    });
  // The dashboard's "still missing" rows with a "Skip" (or "Undo") button, by the same id.
  const optional = requirements
    .filter((r) => r.optional && r.status !== 'satisfied')
    .map((r) => ({
      id: r.id,
      label: `${r.label.en}${WHO[r.person] && snap.people.length > 1 ? `, ${WHO[r.person]}` : ''}`,
      reason: r.reason.en,
      skipped: r.status === 'waived',
    }));
  const notSupported = ws.engine.notSupported(snap).map((n) => n.what.en);
  const canton = ws.canton();
  const software = canton.canton
    ? `${canton.canton.software} (the canton's free software)`
    : "their canton's free tax software";
  const documents = ws.activeDocuments();
  const toIdentify = documents.filter((d) => !d.kind).length;
  const toRead = ws.toRead().length;
  const toConfirm = ws.toConfirm().length;
  const fromBarcode = documents.filter(isBarcodeDocument).length;
  const whose = documents.filter((d) => d.parse.method === BARCODE_PENDING).length;
  const checks = ws
    .checks()
    .filter((c) => !c.resolved)
    .map((c) => `${c.title.en} [${c.id}]: ${c.detail.en} ${c.todo.en}`);
  const assessment = ws.assessments()[0];
  const vault = ws.vaultInfo();
  const securitiesView = ws.securities('en');
  const securities = securitiesStatusText(securitiesView);
  const holdingsText = holdingsStatusText(holdings(ws));
  const lastYear = ws.lastYear('en');
  const priorText = priorStatusText(lastYear);
  const estimates = securitiesView?.rows.some((r) => r.estimate)
    ? [
        "Securities values at the broker's prices and rates, until the official ESTV price list (Kursliste) for the year is available.",
      ]
    : [];

  let nextStep: string;
  if (vault.problem) nextStep = vault.problem;
  else if (notSupported.length) {
    nextStep = `Tell the user plainly that Taxpresso can't prepare this yet: ${notSupported.join('; ')}. Suggest ${software} or a fiduciary. Don't work around it.`;
  } else if (!canton.answer) {
    nextStep = `Ask the first question: where the user lived on 31 December (next_questions). That canton taxes the whole year, and it decides the questions and the tax. Taxpresso prepares ${cantonList()} returns so far.${lastYear?.suggestions ? " It comes with a suggestion from last year's declaration: ask the user whether it is still right, then save their answer with answer_question." : ''}`;
  } else if (
    // Taxpresso reads Geneva's declarations (GeTax, the online declaration) so far.
    canton.canton?.code === 'GE' &&
    open > 0 &&
    snap.slots.every((s) => s.value === undefined || s.question.key === 'profile.canton') &&
    !lastYear &&
    !documents.some((d) => d.kind === 'prior_declaration')
  ) {
    nextStep =
      "Before the next question, ask the user for last year's Geneva tax declaration (the PDF from GeTax, the online declaration or their tax software): Taxpresso reads it on this computer and suggests most answers for them to confirm. They drop it in the dashboard (open_dashboard) or in their Taxpresso folder, then call ingest_vault. If they don't have it, ask the next question: call next_questions.";
  } else if (open > 0) {
    nextStep = lastYear?.suggestions
      ? "Ask the next question: call next_questions. When a question comes with a suggestion from last year's declaration, ask the user whether it is still right, then save their answer with answer_question."
      : 'Ask the next question: call next_questions.';
  } else if (whose > 0) {
    nextStep = `${whose} certificate${whose === 1 ? ' was' : 's were'} read from the barcode; ask the user whose ${whose === 1 ? 'it is' : 'each one is'} (theirs or their partner’s). They choose it in the dashboard (Documents), or tell you and you save it with set_document_owner; then the values fill in.`;
  } else if (toRead > 0) {
    nextStep = `${toRead} document${toRead === 1 ? '' : 's'} not read yet. Offer to read them: get_document_for_review sends that document's content to Claude, so ask the user first. Then propose what you read with propose_extraction. The user can also say what each one is in the dashboard.`;
  } else if (toConfirm > 0) {
    nextStep = `${toConfirm} value${toConfirm === 1 ? '' : 's'} read from documents need the user's OK. Ask them to check each one in the dashboard (Documents), or to confirm in the chat; then save with set_fact.`;
  } else if (checks.length) {
    nextStep =
      'Go through the "Check this" items with the user. Each is settled by replacing the document in the dashboard, or with a short note from the user (set_fact, key check.note, instance = the item id).';
  } else if (toIdentify > 0) {
    nextStep = 'Ask the user to say what each new document is, in the dashboard (open_dashboard).';
  } else if (assessment && assessment.deadlines.length) {
    nextStep = `The assessment is in: go through the differences with the user in the dashboard ("Your assessment"). The deadline to object is in the card, with its legal source; the date printed on the assessment wins. Taxpresso never sends the objection.`;
  } else if (missing.length) {
    nextStep =
      'Ask for the missing documents. The user drops them in the dashboard or puts them in their Taxpresso folder; then call ingest_vault.';
  } else {
    nextStep =
      'Everything is collected for now. Call compute_tax and give the user the tax it computes, with what is an estimate; then offer the dashboard.';
  }

  const status: Status = {
    product: 'Taxpresso',
    version: ws.config.version,
    taxYear: ws.config.taxYear,
    canton: canton.canton?.code ?? null,
    cantonFrom: canton.from,
    cantonBecause: canton.because.map((b) => b.en),
    household: {
      started: answered > 0,
      people: snap.people.length,
      summary: ws.engine.chips(snap, 'en'),
    },
    progress: {
      questionsAnswered: answered,
      questionsOpen: open,
      documents: documents.length,
      documentsToIdentify: toIdentify,
      documentsToRead: toRead,
      documentsFromBarcode: fromBarcode,
      documentsWaitingForWhose: whose,
      valuesToConfirm: toConfirm,
    },
    missing,
    optional,
    checks,
    notSupported,
    estimates,
    ...(securities ? { securities } : {}),
    ...(holdingsText ? { holdings: holdingsText } : {}),
    ...(priorText ? { lastYear: priorText } : {}),
    nextStep,
    vault,
    dashboard: { running: opts.dashboardRunning },
    uiLanguage: ws.config.uiLanguage,
  };
  if (opts.detail) {
    status.runtime = {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      execPath: opts.execPath ?? process.execPath,
    };
  }
  return status;
}

/** The cantons Taxpresso prepares returns for, in words: "Geneva, Zurich and Bern". */
export function cantonList(lang: 'en' | 'fr' | 'de' = 'en'): string {
  return cantonNames(SUPPORTED_CANTONS, lang);
}

/** Short text for Claude (C6: frugal by default). The full object travels as structuredContent. */
export function statusText(s: Status): string {
  const canton = s.canton ? CANTONS[s.canton].name.en : undefined;
  const lines = [
    `Taxpresso ${s.version}, tax year ${s.taxYear}, ${canton ?? 'canton not known yet'}`,
    ...(s.cantonFrom === 'earlier_answers' && canton
      ? [
          `Canton: ${canton}, taken from the user's earlier answers (${s.cantonBecause.join('; ')}). Taxpresso now asks for the canton first; if it is wrong, the user answers the canton question.`,
        ]
      : []),
    `Household: ${s.household.started ? s.household.summary.join(', ') || 'started' : 'not started'}`,
    `Questions: ${s.progress.questionsAnswered} answered, ${s.progress.questionsOpen} to go`,
    `Documents: ${s.progress.documents}${s.progress.documentsToIdentify ? ` (${s.progress.documentsToIdentify} to identify)` : ''}${s.progress.documentsFromBarcode ? `, ${s.progress.documentsFromBarcode} read from the barcode` : ''}${s.progress.documentsWaitingForWhose ? ` (${s.progress.documentsWaitingForWhose} waiting for the user to say whose it is)` : ''}${s.progress.documentsToRead ? `, ${s.progress.documentsToRead} not read yet` : ''}`,
    ...(s.progress.valuesToConfirm
      ? [`Values that need the user's OK: ${s.progress.valuesToConfirm}`]
      : []),
    `Still missing: ${s.missing.length ? s.missing.join('; ') : 'nothing'}`,
    ...(s.optional.length
      ? [
          `Optional (waive_requirement): ${s.optional.map((o) => `${o.label} [${o.id}]: ${o.skipped ? 'skipped by the user' : o.reason}`).join(' | ')}`,
        ]
      : []),
    ...(s.checks.length ? [`Check this: ${s.checks.join(' | ')}`] : []),
  ];
  if (s.notSupported.length) lines.push(`Not supported yet: ${s.notSupported.join('; ')}`);
  if (s.securities) lines.push(s.securities);
  if (s.holdings) lines.push(s.holdings);
  if (s.lastYear) lines.push(s.lastYear);
  lines.push(
    `Folder: ${s.vault.path}${s.vault.exists ? '' : ' (created with the first answer or document)'}`,
    `Dashboard: ${s.dashboard.running ? 'running' : 'not running'}`,
    'The tax so far: compute_tax. Savings to look at now: list_optimizations (before 31 December: pillar 3a, pension fund buy-in, 3a catch-up; TOU for people taxed at source).',
    `Next step: ${s.nextStep}`,
  );
  if (s.runtime) {
    lines.push(
      `Runtime: Node ${s.runtime.node} (${s.runtime.platform} ${s.runtime.arch}) at ${s.runtime.execPath}`,
    );
  }
  return lines.join('\n');
}
