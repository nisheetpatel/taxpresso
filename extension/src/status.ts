import { SUPPORTED_CANTONS, type SupportedCanton } from '@taxpresso/rules-ch';
import * as z from 'zod/v4';
import { CANTONS, cantonNames } from './cantons.js';
import { CURRENT_TAX_YEAR, UI_LANGUAGES } from './config.js';
import { holdings, holdingsStatusText } from './holdings.js';
import { priorStatusText } from './prior.js';
import { securitiesStatusText } from './securities.js';
import { BARCODE_PENDING, isBarcodeDocument } from './barcode.js';
import type { Workspace } from './workspace.js';
import { DEFAULT_TAX_YEAR, TaxYears } from './years.js';
import { journey, journeyText, nextText, STAGES } from './journey.js';

export const StatusSchema = z.object({
  product: z.literal('Taxpresso'),
  version: z.string(),
  taxYear: z.number().int().describe('The open tax year: everything here is about this year.'),
  years: z
    .array(
      z.object({
        year: z.number().int(),
        open: z.boolean(),
        over: z.boolean(),
        cantons: z.array(z.string()),
      }),
    )
    .describe(
      'Every tax year Taxpresso prepares, with its cantons; open_tax_year switches. over: 31 December of that year has passed.',
    ),
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
  yearNote: z
    .string()
    .optional()
    .describe('The Taxpresso folder had a year open that this version does not prepare.'),
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
  next: z
    .object({
      id: z.string(),
      stage: z.enum(STAGES).nullable(),
      text: z.string().describe('The next step in the user’s words, as the dashboard shows it.'),
    })
    .describe('The one next step, the same as the dashboard’s (docs/design/simple.md).'),
  stage: z.enum(STAGES).describe('The stage open in the dashboard.'),
  stages: z.array(z.object({ id: z.enum(STAGES), status: z.string() })),
  about: z.array(z.string()).describe('Facts shown in "About you" that need no decision.'),
  journey: z.array(z.string()).describe('The stages and facts in a few lines.'),
  nextStep: z.string().describe('What Claude does next.'),
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
  opts: { dashboardRunning: boolean; detail?: boolean; execPath?: string; years?: TaxYears },
): Status {
  const years = opts.years ?? TaxYears.of(ws);
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

  // One next step and the stages, the same as the dashboard's (./journey.ts).
  const j = journey(ws);
  const nextStep = j.claude;

  const status: Status = {
    product: 'Taxpresso',
    version: ws.config.version,
    taxYear: ws.taxYear,
    years: years.list().map((y) => ({
      year: y.year,
      // The year of this workspace is the one the answer is about.
      open: y.year === ws.taxYear,
      over: y.over,
      cantons: y.cantons,
    })),
    ...(years.dropped !== undefined
      ? { yearNote: yearDroppedText(years.dropped, ws.taxYear) }
      : {}),
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
    next: { id: j.next.id, stage: j.next.stage, text: nextText(j, ws.taxYear) },
    stage: j.stage,
    stages: j.stages.map((st) => ({ id: st.id, status: st.status })),
    about: j.about.map((f) => f.id),
    journey: journeyText(j),
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
export function cantonList(lang: 'en' | 'fr' | 'de' | 'it' = 'en'): string {
  return cantonNames(SUPPORTED_CANTONS, 'and', lang);
}

/** Why another year opened than the one kept in the folder. */
const yearDroppedText = (dropped: number, open: number) =>
  `The Taxpresso folder had ${dropped} open, which this version doesn't prepare: ${open} is open instead.`;

/**
 * The language of each canton's official form: Claude names a form item with its official term in
 * it (instructions.ts). A canton added to SUPPORTED_CANTONS needs its line here.
 */
const FORM_TERMS: Record<SupportedCanton, string> = {
  GE: 'French',
  VD: 'French',
  FR: 'French',
  TI: 'Italian',
  ZH: 'German',
  // The Bern form is bilingual.
  BE: 'German; for a French-speaking user, the French term too where the question gives one',
  BS: 'German',
  BL: 'German',
  ZG: 'German',
  LU: 'German',
  SG: 'German',
  AG: 'German',
};

/** "Zurich (a preview: say so once; official terms in German)": the canton, for Claude. */
function cantonWords(code: SupportedCanton): string {
  const c = CANTONS[code];
  return `${c.name.en} (${c.view.preview ? 'a preview: say so once; ' : ''}official terms in ${FORM_TERMS[code]})`;
}

/** "Tax year 2026 is open; also 2025 (Geneva only): switch with open_tax_year when the user asks." */
function yearsLine(s: Status): string {
  const all = Object.keys(CANTONS).length;
  const others = s.years
    .filter((y) => y.year !== s.taxYear)
    .map((y) =>
      y.cantons.length < all
        ? `${y.year} (${cantonNames(y.cantons as SupportedCanton[], 'and')} only)`
        : String(y.year),
    );
  const over = s.years.find((y) => y.year === s.taxYear)?.over;
  // Replies about another year than the default start with it (server.ts, yearOf).
  const prefix =
    s.taxYear === DEFAULT_TAX_YEAR
      ? ''
      : ` Replies that start with "Tax year ${s.taxYear}:" are about it.`;
  return `Tax year ${s.taxYear} is open${over ? ` (it is over: the plans before 31 December are ${CURRENT_TAX_YEAR}'s)` : ''}${others.length ? `; also ${others.join(' and ')}: when the user asks for another year, call open_tax_year with it, then get_status` : ''}.${prefix}`;
}

/** Short text for Claude (C6: frugal by default). The full object travels as structuredContent. */
export function statusText(s: Status): string {
  const canton = s.canton ? CANTONS[s.canton].name.en : undefined;
  const over = s.years.find((y) => y.year === s.taxYear)?.over === true;
  // The year first (docs/design/tax-years.md), then the next step and the stages in one line
  // each (docs/design/simple.md).
  const lines = [
    `Taxpresso ${s.version}, tax year ${s.taxYear}, ${s.canton ? cantonWords(s.canton) : 'canton not known yet'}`,
    yearsLine(s),
    ...(s.yearNote ? [s.yearNote] : []),
    `Next step: ${s.nextStep}`,
    `The user's next step, as the dashboard shows it: ${s.next.text}`,
    ...s.journey,
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
    over
      ? `The tax so far: compute_tax. ${s.taxYear} is over: for 3a or a buy-in, list_optimizations says which year's plans apply and how to switch.`
      : 'The tax so far: compute_tax. Ways to save (list_optimizations): offer them once there is a tax, as one question.',
  );
  if (s.runtime) {
    lines.push(
      `Runtime: Node ${s.runtime.node} (${s.runtime.platform} ${s.runtime.arch}) at ${s.runtime.execPath}`,
    );
  }
  return lines.join('\n');
}
