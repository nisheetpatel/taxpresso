import * as z from 'zod/v4';
import { UI_LANGUAGES } from './config.js';
import { securitiesStatusText } from './securities.js';
import type { Workspace } from './workspace.js';

export const StatusSchema = z.object({
  product: z.literal('Taxpresso'),
  version: z.string(),
  taxYear: z.number().int(),
  canton: z.literal('GE'),
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
    valuesToConfirm: z
      .number()
      .int()
      .describe("Values read from documents that still need the user's OK."),
  }),
  missing: z.array(z.string()).describe('Documents still needed, with whose they are.'),
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
  const notSupported = ws.engine.notSupported(snap).map((n) => n.what.en);
  const documents = ws.activeDocuments();
  const toIdentify = documents.filter((d) => !d.kind).length;
  const toRead = ws.toRead().length;
  const toConfirm = ws.toConfirm().length;
  const checks = ws
    .checks()
    .filter((c) => !c.resolved)
    .map((c) => `${c.title.en} [${c.id}]: ${c.detail.en} ${c.todo.en}`);
  const assessment = ws.assessments()[0];
  const vault = ws.vaultInfo();
  const securitiesView = ws.securities('en');
  const securities = securitiesStatusText(securitiesView);
  const estimates = securitiesView?.rows.some((r) => r.estimate)
    ? [
        "Securities values at the broker's prices and rates, until the official ESTV price list (Kursliste) for the year is available.",
      ]
    : [];

  let nextStep: string;
  if (vault.problem) nextStep = vault.problem;
  else if (notSupported.length) {
    nextStep = `Tell the user plainly that Taxpresso can't prepare this yet: ${notSupported.join('; ')}. Suggest GeTax (the canton's free software) or a fiduciary. Don't work around it.`;
  } else if (open > 0) nextStep = 'Ask the next question: call next_questions.';
  else if (toRead > 0) {
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
      'Everything is collected for now. The tax calculation comes in a later version of Taxpresso: say so, and offer the dashboard.';
  }

  const status: Status = {
    product: 'Taxpresso',
    version: ws.config.version,
    taxYear: ws.config.taxYear,
    canton: 'GE',
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
      valuesToConfirm: toConfirm,
    },
    missing,
    checks,
    notSupported,
    estimates,
    ...(securities ? { securities } : {}),
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

/** Short text for Claude (C6: frugal by default). The full object travels as structuredContent. */
export function statusText(s: Status): string {
  const lines = [
    `Taxpresso ${s.version}, tax year ${s.taxYear}, Geneva`,
    `Household: ${s.household.started ? s.household.summary.join(', ') || 'started' : 'not started'}`,
    `Questions: ${s.progress.questionsAnswered} answered, ${s.progress.questionsOpen} to go`,
    `Documents: ${s.progress.documents}${s.progress.documentsToIdentify ? ` (${s.progress.documentsToIdentify} to identify)` : ''}${s.progress.documentsToRead ? `, ${s.progress.documentsToRead} not read yet` : ''}`,
    ...(s.progress.valuesToConfirm
      ? [`Values that need the user's OK: ${s.progress.valuesToConfirm}`]
      : []),
    `Still missing: ${s.missing.length ? s.missing.join('; ') : 'nothing'}`,
    ...(s.checks.length ? [`Check this: ${s.checks.join(' | ')}`] : []),
  ];
  if (s.notSupported.length) lines.push(`Not supported yet: ${s.notSupported.join('; ')}`);
  if (s.securities) lines.push(s.securities);
  lines.push(
    `Folder: ${s.vault.path}${s.vault.exists ? '' : ' (created with the first answer or document)'}`,
    `Dashboard: ${s.dashboard.running ? 'running' : 'not running'}`,
    'Savings to look at now: list_optimizations (pillar 3a before 31 December).',
    `Next step: ${s.nextStep}`,
  );
  if (s.runtime) {
    lines.push(
      `Runtime: Node ${s.runtime.node} (${s.runtime.platform} ${s.runtime.arch}) at ${s.runtime.execPath}`,
    );
  }
  return lines.join('\n');
}
