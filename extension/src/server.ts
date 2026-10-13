// The MCP surface (SPEC.md section 11). Every tool: narrow description, title, readOnlyHint and
// destructiveHint (C6), concise text plus structuredContent.

import { McpServer } from '@modelcontextprotocol/server';
import { DOCUMENT_KINDS, LedgerError, type FactValue } from '@taxpresso/ledger';
import type { RenderedQuestion, Slot } from '@taxpresso/questionnaire';
import * as z from 'zod/v4';
import { formValues } from './copy-panel.js';
import type { Dashboard } from './dashboard.js';
import { DASHBOARD_VIEW_URI, registerDashboardView } from './dashboard-view.js';
import { DOCUMENT_VALUE_KEYS, ENUM_LABELS, ExtractionError, formValue } from './extraction.js';
import { computeTaxOutput } from './estimate.js';
import { INSTRUCTIONS } from './instructions.js';
import { KIND_LABELS } from './kinds.js';
import { registerHoldingTools } from './holdings-tools.js';
import { registerParityTools } from './parity-tools.js';
import { decide, DecisionInput, planningReady, planningText, planningView } from './planning.js';
import { PRIOR_METHOD, priorStatusText } from './prior.js';
import { registerLastYearTool } from './prior-tool.js';
import { registerDeclarationCheckTool } from './reconcile-tool.js';
import { registerExportTool } from './export-tool.js';
import { registerReviewTool } from './last-year-review.js';
import { securitiesStatusText } from './securities.js';
import { barcodeNote, BARCODE_PENDING, fromBarcode, isBarcodeDocument } from './barcode.js';
import { reviewDocument } from './review.js';
import { buildStatus, StatusSchema, statusText } from './status.js';
import { formatDay, PILLAR3A_2026_FACTS } from '@taxpresso/rules-ge';
import { PLAN_KEYS, WorkspaceError, type Workspace } from './workspace.js';

// MCP Apps: the dashboard in the conversation, and the tool it talks through (./dashboard-view.ts).
export { DASHBOARD_VIEW_URI, MCP_APP_MIME_TYPE } from './dashboard-view.js';

export interface ServerDeps {
  workspace: Workspace;
  dashboard: Dashboard;
}

const RO = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const RW = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};
const WHO: Record<string, string> = { p1: 'you', p2: 'your spouse or partner' };
const chf = (centimes: number) => `CHF ${Math.round(centimes / 100).toLocaleString('en-US')}`;
const ASSUMPTION_TEXT: Record<string, string> = {
  icc_2025_scale: 'Geneva tax uses the 2025 scale; the 2026 scale is published in January 2027.',
  flat_deductions_only:
    'Health premiums, childcare and other costs not given yet are not counted, so the real saving may be a little different.',
  home_commune_rate: 'All income is taken as earned in the home commune.',
  net_from_gross: 'Net salary assumed to be 88 % of the gross; the payslip gives the real figure.',
  commune_default: 'Commune unknown: City of Geneva assumed.',
  no_income_for_some: 'No salary given for one person: counted as zero.',
};

const QuestionOut = z.object({
  id: z.string(),
  person: z.string(),
  type: z.string(),
  text: z.object({ en: z.string(), fr: z.string() }),
  help: z.object({ en: z.string(), fr: z.string() }).optional(),
  explain: z.object({ en: z.string(), fr: z.string() }).optional(),
  /** An official page on the topic, to give the user; label in English. */
  learnMore: z.object({ url: z.string(), label: z.string() }).optional(),
  options: z
    .array(
      z.object({ value: z.string(), en: z.string(), fr: z.string(), notSupported: z.boolean() }),
    )
    .optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  suggested: z
    .object({
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
      text: z.object({ en: z.string(), fr: z.string() }),
      from: z.string(),
    })
    .optional()
    .describe(
      "A value read from a document (last year's declaration), not an answer: the user confirms or changes it.",
    ),
});
type QuestionOut = z.infer<typeof QuestionOut>;

/** "last year's declaration (2025), page 1": where a suggestion was read. */
function suggestionSource(ws: Workspace, slot: Slot): string {
  const source = slot.suggestion?.source;
  const doc = ws.documents.find((d) => d.id === source?.docId);
  const what =
    doc?.kind === 'prior_declaration'
      ? `last year's declaration${doc.taxYear ? ` (${doc.taxYear})` : ''}`
      : `“${doc?.filename ?? 'a document'}”`;
  return `${what}${source?.page ? `, page ${source.page}` : ''}`;
}

function questionOut(ws: Workspace, slot: Slot): QuestionOut {
  const en: RenderedQuestion = ws.render(slot, 'en');
  const fr: RenderedQuestion = ws.render(slot, 'fr');
  return {
    id: slot.id,
    person: slot.person,
    type: en.type,
    text: { en: en.text, fr: fr.text },
    ...(en.help && fr.help ? { help: { en: en.help, fr: fr.help } } : {}),
    ...(en.explain && fr.explain ? { explain: { en: en.explain, fr: fr.explain } } : {}),
    ...(en.learnMore ? { learnMore: en.learnMore } : {}),
    ...(en.options && en.type !== 'commune'
      ? {
          options: en.options.map((o, i) => ({
            value: o.value,
            en: o.label,
            fr: fr.options?.[i]?.label ?? o.label,
            notSupported: o.notSupported,
          })),
        }
      : {}),
    ...(en.min !== undefined ? { min: en.min } : {}),
    ...(en.max !== undefined ? { max: en.max } : {}),
    ...(slot.suggested !== undefined
      ? {
          suggested: {
            value: slot.suggested,
            text: {
              en: ws.engine.describe(slot, 'en', slot.suggested),
              fr: ws.engine.describe(slot, 'fr', slot.suggested),
            },
            from: suggestionSource(ws, slot),
          },
        }
      : {}),
  };
}

/** A value for Claude: money as printed on a form, dates as on Swiss documents, choices in words. */
function shown(ws: Workspace, key: string, value: FactValue): string {
  const def = ws.keys[key];
  if (!def) return String(value);
  if (def.type === 'boolean') return value ? 'yes' : 'no';
  if (def.type === 'enum') return ENUM_LABELS[key]?.[String(value)]?.en ?? String(value);
  return formValue(def, value) ?? String(value);
}

/** Errors the user or Claude can fix, as a tool error with the reason; anything else is a bug. */
function toolError(err: unknown) {
  if (
    err instanceof WorkspaceError ||
    err instanceof ExtractionError ||
    err instanceof LedgerError ||
    (err instanceof Error && /^No such document|replaced by/.test(err.message))
  ) {
    return { content: [{ type: 'text' as const, text: err.message }], isError: true };
  }
  throw err;
}

function questionText(q: QuestionOut): string {
  const how =
    q.type === 'yesno'
      ? 'Answer: yes or no.'
      : q.type === 'number'
        ? `Answer: a whole number from ${q.min} to ${q.max}.`
        : q.type === 'money'
          ? 'Answer: an amount in CHF as the user said it, e.g. 790 or "1\'250.50".'
          : q.type === 'commune'
            ? 'Answer: the name of the Geneva commune.'
            : `Answer${q.type === 'multi' ? ' (a list, [] for none)' : ''}: ${q.options
                ?.map((o) => `${o.value} = ${o.en}${o.notSupported ? ' [not supported yet]' : ''}`)
                .join('; ')}`;
  const who = q.person === 'p2' ? ` (about ${WHO.p2})` : '';
  return [
    `[${q.id}]${who} ${q.text.fr}`,
    `EN: ${q.text.en}`,
    ...(q.help ? [`Help: ${q.help.en}`] : []),
    ...(q.explain ? [`If the user asks what this means: ${q.explain.en}`] : []),
    ...(q.learnMore ? [`Official page (${q.learnMore.label}): ${q.learnMore.url}`] : []),
    how,
    ...(q.suggested
      ? [
          `Suggested from ${q.suggested.from}: ${q.suggested.text.en || 'none of these'} (${JSON.stringify(q.suggested.value)}). It is not an answer yet: ask whether it is still right this year, then save what the user says with answer_question.`,
        ]
      : []),
  ].join('\n');
}

export function createTaxpressoServer({ workspace: ws, dashboard }: ServerDeps): McpServer {
  const server = new McpServer(
    { name: 'taxpresso', title: 'Taxpresso', version: ws.config.version },
    { instructions: INSTRUCTIONS },
  );
  const status = (detail = false) =>
    buildStatus(ws, { dashboardRunning: dashboard.running, detail });

  server.registerTool(
    'get_status',
    {
      title: 'Get tax return status',
      description:
        "Where the user's Geneva tax return stands: household, questions answered, documents, what is still missing, anything not supported, and the next step. Call this first.",
      inputSchema: z.object({
        detail: z
          .boolean()
          .optional()
          .describe('Also return technical details (Node runtime). Default false.'),
      }),
      outputSchema: StatusSchema,
      annotations: { title: 'Get tax return status', ...RO },
    },
    async ({ detail }) => {
      await ws.ready();
      ws.record('claude', 'status');
      const s = status(detail === true);
      return { content: [{ type: 'text', text: statusText(s) }], structuredContent: s };
    },
  );

  server.registerTool(
    'next_questions',
    {
      title: 'Get the next questions',
      description:
        "The next unanswered questions about the user's situation, in French and English with their options. Ask them one at a time in the user's language, then save each answer with answer_question.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(5).optional().describe('How many questions. Default 1.'),
      }),
      outputSchema: z.object({
        questions: z.array(QuestionOut),
        answered: z.number(),
        open: z.number(),
      }),
      annotations: { title: 'Get the next questions', ...RO },
    },
    async ({ limit }) => {
      await ws.ready();
      ws.record('claude', 'questions');
      const snap = ws.snapshot();
      const first = ws.next();
      const open = snap.slots.filter((s) => s.value === undefined);
      // Questions the user skipped come back last, as in the dashboard (skip_question).
      const rest = open.filter((s) => s.id !== first?.id);
      const later = (s: Slot) => ws.skipped.includes(s.id);
      const ordered = first ? [first, ...rest.filter((s) => !later(s)), ...rest.filter(later)] : [];
      const questions = ordered.slice(0, limit ?? 1).map((slot) => questionOut(ws, slot));
      const answered = snap.slots.length - open.length;
      const text = questions.length
        ? `${answered} answered, ${open.length} to go.\n\n${questions.map(questionText).join('\n\n')}`
        : 'All questions are answered. Call get_status for the next step.';
      return {
        content: [{ type: 'text', text }],
        structuredContent: { questions, answered, open: open.length },
      };
    },
  );

  server.registerTool(
    'answer_question',
    {
      title: 'Save an answer',
      description:
        'Saves what the user answered to one question from next_questions. Use the question id exactly. For choices, the option value or the user’s own words both work.',
      inputSchema: z.object({
        id: z
          .string()
          .describe('The question id from next_questions, e.g. "children" or "employers:p2".'),
        value: z
          .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
          .describe(
            'The answer: an option value, yes/no, a number, a commune name, or a list for multi.',
          ),
      }),
      outputSchema: z.object({
        saved: z.string(),
        newlyMissing: z.array(z.string()),
        notSupported: z.array(z.string()),
        next: QuestionOut.optional(),
      }),
      annotations: { title: 'Save an answer', ...RW },
    },
    async ({ id, value }) => {
      try {
        const { added } = await ws.answer(id, value, 'chat');
        const snap = ws.snapshot();
        const slot = snap.slots.find((s) => s.id === id);
        const saved = slot ? ws.engine.describe(slot, 'en') : String(value);
        const newlyMissing = added.filter((r) => r.status === 'missing').map((r) => r.label.en);
        const notSupported = ws.engine
          .notSupported(snap)
          .filter((n) => n.slotId === id)
          .map((n) => n.what.en);
        const nextSlot = ws.next();
        const next = nextSlot ? questionOut(ws, nextSlot) : undefined;
        const lines = [`Saved: ${saved}.`];
        if (newlyMissing.length) lines.push(`Documents now needed: ${newlyMissing.join('; ')}.`);
        if (notSupported.length) {
          lines.push(
            `Not supported yet: ${notSupported.join('; ')}. ${ws.engine.notSupportedMessage('en')}`,
          );
        }
        lines.push(
          next ? `\nNext question:\n${questionText(next)}` : '\nAll questions are answered.',
        );
        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          structuredContent: { saved, newlyMissing, notSupported, ...(next ? { next } : {}) },
        };
      } catch (err) {
        return { content: [{ type: 'text', text: (err as Error).message }], isError: true };
      }
    },
  );

  server.registerTool(
    'list_documents',
    {
      title: 'List documents',
      description:
        "The user's documents in their Taxpresso folder, what each one is, and which documents are still missing.",
      outputSchema: z.object({
        documents: z.array(
          z.object({
            id: z.string(),
            filename: z.string(),
            kind: z.string().optional(),
            person: z.string().optional(),
            read: z.boolean(),
            fromBarcode: z
              .boolean()
              .optional()
              .describe('Read from its barcode: its values are verified, nothing to read.'),
            toConfirm: z.number().int(),
          }),
        ),
        missing: z.array(z.string()),
      }),
      annotations: { title: 'List documents', ...RO },
    },
    async () => {
      await ws.ready();
      const exportNote = (id: string) => {
        const doc = ws.documents.find((d) => d.id === id);
        if (doc?.kind === 'prior_declaration') {
          if (doc.parse.method !== PRIOR_METHOD) return '';
          return doc.parse.ok
            ? ` (${doc.taxYear ?? 'year unknown'}, read by Taxpresso: answers suggested in the questions, figures in get_last_year)`
            : ` (not read by Taxpresso: ${doc.parse.warnings[0] ?? ''})`;
        }
        if (doc?.kind !== 'broker_export') return '';
        const n = doc.parse.warnings.length;
        return ` (${doc.issuer ?? 'not readable'}${n ? `, ${n} warning${n === 1 ? '' : 's'} in the dashboard` : ''})`;
      };
      const pending = ws.toConfirm();
      const documents = ws.activeDocuments().map((d) => ({
        id: d.id,
        filename: d.filename,
        ...(d.kind ? { kind: d.kind } : {}),
        ...(d.person ? { person: d.person } : {}),
        read: d.parse.method !== 'none',
        ...(isBarcodeDocument(d) ? { fromBarcode: true } : {}),
        toConfirm: pending.filter((f) => f.source.docId === d.id).length,
      }));
      const counted = ws.countedFacts();
      const readNote = (id: string) => {
        const doc = ws.documents.find((x) => x.id === id);
        return doc && isBarcodeDocument(doc)
          ? barcodeNote(doc, fromBarcode(counted, id).length)
          : undefined;
      };
      const missing = buildStatus(ws, { dashboardRunning: dashboard.running }).missing;
      const lines = documents.length
        ? documents.map(
            (d) =>
              `- ${d.id} ${d.filename}: ${d.kind ? KIND_LABELS[d.kind].en : 'not identified yet'}${exportNote(d.id)}${d.person ? `, ${WHO[d.person] ?? d.person}` : ''}; ${readNote(d.id) ?? (d.read ? (d.toConfirm ? `${d.toConfirm} value${d.toConfirm === 1 ? ' needs' : 's need'} the user's OK` : 'read') : 'not read yet')}`,
          )
        : ['No documents yet.'];
      const securities = securitiesStatusText(ws.securities('en'));
      if (securities) lines.push(securities);
      const lastYear = priorStatusText(ws.lastYear('en'));
      if (lastYear) lines.push(lastYear);
      lines.push(`Still missing: ${missing.length ? missing.join('; ') : 'nothing'}`);
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        structuredContent: { documents, missing },
      };
    },
  );

  server.registerTool(
    'ingest_vault',
    {
      title: 'Check the Taxpresso folder',
      description:
        "Looks in the user's Taxpresso folder for files they added themselves and reads them on this computer: barcodes (salary certificates, bank e-tax statements), broker exports (IBKR, DEGIRO) and last year's declaration. Call it when the user says they added files.",
      outputSchema: z.object({ added: z.array(z.string()) }),
      annotations: { title: 'Check the Taxpresso folder', ...RW, idempotentHint: true },
    },
    async () => {
      const found = await ws.scan('claude');
      const added = found.map((d) => d.filename);
      const counted = ws.countedFacts();
      const named = found.map((d) => {
        if (d.kind === 'broker_export')
          return `${d.filename} (read as a broker export: ${d.issuer})`;
        if (d.kind === 'prior_declaration')
          return `${d.filename} (read as last year's declaration${d.taxYear ? `, ${d.taxYear}` : ''})`;
        if (d.kind === 'official_declaration')
          return `${d.filename} (this year's declaration: reconcile_official_pdf compares it with the values to type)`;
        if (isBarcodeDocument(d) && d.kind) {
          const what = [KIND_LABELS[d.kind].en, d.taxYear, d.issuer].filter(Boolean).join(', ');
          return `${d.filename} (${what}: ${barcodeNote(d, fromBarcode(counted, d.id).length)})`;
        }
        return d.filename;
      });
      const waiting = found.filter((d) => d.parse.method === BARCODE_PENDING).length;
      const toIdentify = found.some((d) => !d.kind);
      const securities = found.some((d) => d.kind === 'broker_export')
        ? securitiesStatusText(ws.securities('en'))
        : undefined;
      const lastYear = found.some((d) => d.kind === 'prior_declaration')
        ? priorStatusText(ws.lastYear('en'))
        : undefined;
      const text = added.length
        ? [
            `Added ${added.length}: ${named.join(', ')}.${toIdentify ? ' Offer to read the new documents (get_document_for_review), or the user says what each one is in the dashboard.' : ''}${waiting ? ' Ask the user whose each certificate read from its barcode is (theirs or their partner’s); they choose it in the dashboard (Documents).' : ''}`,
            ...(securities ? [securities] : []),
            ...(lastYear ? [lastYear] : []),
          ].join('\n')
        : `No new files in ${ws.vaultInfo().path}.`;
      return { content: [{ type: 'text', text }], structuredContent: { added } };
    },
  );

  // get_last_year: last year's figures, for comparison only (./prior-tool.ts).
  registerLastYearTool(server, ws);
  // review_last_year: last year's return reviewed, read-only (./last-year-review.ts).
  registerReviewTool(server, ws);

  server.registerTool(
    'list_optimizations',
    {
      title: 'List tax savings',
      description:
        'Ways to lower the tax, with their CHF value from the rules engine: before 31 December, pillar 3a, a pension fund buy-in and the 3a catch-up; for people taxed at source, TOU (tax withheld against ordinary tax, when compulsory, the deadline). Estimates, assumptions, facts with sources.',
      outputSchema: z.object({
        pillar3a: z.record(z.string(), z.unknown()),
        lppBuyIn: z.record(z.string(), z.unknown()),
        pillar3aCatchUp: z.record(z.string(), z.unknown()),
        tou: z.record(z.string(), z.unknown()),
      }),
      annotations: { title: 'List tax savings', ...RO },
    },
    async () => {
      await ws.ready();
      await planningReady(ws);
      const plan = ws.plan();
      const planning = planningView(ws);
      const lines = [`Before 31 December ${ws.config.taxYear}: pillar 3a (3e pilier A)`];
      for (const p of plan.people) {
        const cap = p.capIsMaximum
          ? `up to ${chf(p.capCentimes)} (no pension fund: 20 % of earned income)`
          : chf(p.capCentimes);
        lines.push(
          `- ${WHO[p.person]}: room left ${chf(p.roomCentimes)} (limit ${cap}, already paid ${chf(p.paidCentimes)})`,
        );
      }
      if (plan.saving) {
        lines.push(
          `Estimated tax saving if the room is paid in by 31 December: about ${chf(Math.round(plan.saving.totalCentimes / 1000) * 1000)} (cantonal and communal ${chf(plan.saving.cantonalCentimes)}, federal ${chf(plan.saving.federalCentimes)}). Say it is an estimate.`,
        );
      } else {
        lines.push(
          'No salary yet: ask for a rough yearly salary and save it with set_fact (plan.gross_salary) to estimate the saving.',
        );
      }
      lines.push(`Assumptions: ${plan.assumptions.map((a) => ASSUMPTION_TEXT[a] ?? a).join(' ')}`);
      lines.push(
        `Facts with sources: only payments made in ${ws.config.taxYear} count (${PILLAR3A_2026_FACTS.paidInYearOnly}); payouts are taxed (${PILLAR3A_2026_FACTS.payoutsTaxable}); missed years since 2025 can be made up from 2026, under conditions (${PILLAR3A_2026_FACTS.catchUpFrom2026}).`,
        "Don't recommend specific 3a providers or investments.",
        ...planningText(planning, ws.config.taxYear),
      );
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        structuredContent: {
          pillar3a: { ...plan },
          lppBuyIn: { ...planning.lpp },
          pillar3aCatchUp: { ...planning.catchUp },
          tou: { ...planning.tou, needsTou: planning.needsTou },
        },
      };
    },
  );

  server.registerTool(
    'compute_tax',
    {
      title: 'Compute the tax',
      description:
        "The user's Geneva cantonal and communal tax (ICC) and federal tax (IFD) from Taxpresso's rules engine: totals, main items by rubric code, what is an estimate or still needs the user's OK. detail: true explains every line with its official source.",
      inputSchema: z.object({
        detail: z
          .boolean()
          .optional()
          .describe('Also return every item and tax line, how it was computed and its source.'),
      }),
      outputSchema: z.looseObject({
        taxYear: z.number(),
        computed: z.boolean(),
        missing: z.array(z.string()),
      }),
      annotations: { title: 'Compute the tax', ...RO },
    },
    async ({ detail }) => {
      await ws.ready();
      const { text, structured } = computeTaxOutput(ws, detail === true);
      return { content: [{ type: 'text', text }], structuredContent: structured };
    },
  );

  server.registerTool(
    'decide_optimization',
    {
      title: 'Record the user’s TOU decision',
      description:
        "Records the user's own TOU choice (taxation ordinaire ultérieure): ask for it, or not this year. Only once they saw the comparison (list_optimizations), the deadline and that a request can't be withdrawn, and said what they choose. Records only: the user sends the DRIS/TOU form.",
      inputSchema: z.object({
        id: z.literal('tou').describe('The optimization: tou.'),
        choice: z
          .enum(['request', 'decline'])
          .describe('request: the user will ask for TOU. decline: not this year.'),
        confirmed: z
          .boolean()
          .describe(
            "true only if the user said they understand a TOU request can't be withdrawn, even if the result is worse.",
          ),
      }),
      outputSchema: z.object({
        recorded: z.boolean(),
        choice: z.string(),
        deltaCentimes: z.number().int(),
      }),
      annotations: { title: 'Record the user’s TOU decision', ...RW },
    },
    async (args) => {
      try {
        const d = await decide(ws, DecisionInput.parse(args), 'chat');
        const delta = Math.round(Math.abs(d.deltaCentimes) / 100).toLocaleString('en-US');
        const text =
          d.choice === 'request'
            ? `Recorded: the user will ask for TOU (about CHF ${delta} ${d.deltaCentimes >= 0 ? 'back' : 'more'}, estimated). Remind them to send the DRIS/TOU form from their e-démarches space before the deadline: Taxpresso doesn't send it.`
            : 'Recorded: no TOU this year. The tax withheld at source stays final.';
        return {
          content: [{ type: 'text', text }],
          structuredContent: { recorded: true, choice: d.choice, deltaCentimes: d.deltaCentimes },
        };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    'set_fact',
    {
      title: 'Save what the user said',
      description:
        'Saves what the user tells you in the chat: a planning figure for "before 31 December" or TOU (plan.*); a value from a document they confirmed or corrected (instance = document id; confirm: true confirms all its values); or a note settling a "Check this" item (check.note).',
      inputSchema: z.object({
        key: z
          .enum([...PLAN_KEYS, ...DOCUMENT_VALUE_KEYS, 'check.note'])
          .optional()
          .describe('What the value is. Leave out with confirm: true.'),
        person: z
          .enum(['p1', 'p2'])
          .optional()
          .describe('p1 = the user, p2 = their spouse or partner. Default p1.'),
        instance: z
          .string()
          .max(80)
          .optional()
          .describe(
            'For a value from a document: the document id. For check.note: the id of the "Check this" item.',
          ),
        value: z
          .union([z.number().min(0), z.boolean(), z.string().max(500)])
          .optional()
          .describe(
            'plan.*: CHF amount, true/false, or the tariff code on the payslip for plan.source_tax_tariff (e.g. "A0"). Document values: money as text as printed, e.g. "85\'000.00". check.note: the user\'s short note.',
          ),
        confirm: z
          .boolean()
          .optional()
          .describe(
            'true with instance = a document id: the user said every value read from that document is right.',
          ),
      }),
      outputSchema: z.object({ saved: z.boolean(), confirmed: z.number().int().optional() }),
      annotations: { title: 'Save what the user said', ...RW },
    },
    async ({ key, person, instance, value, confirm }) => {
      try {
        if (confirm) {
          if (!instance) throw new WorkspaceError('Give the document id as instance.');
          const confirmed = await ws.confirmDocument(instance, 'chat');
          return {
            content: [
              {
                type: 'text',
                text: `Confirmed ${confirmed} value${confirmed === 1 ? '' : 's'} from that document, as the user said.`,
              },
            ],
            structuredContent: { saved: true, confirmed },
          };
        }
        if (!key || value === undefined) {
          throw new WorkspaceError('Give key and value, or confirm: true with a document id.');
        }
        if ((PLAN_KEYS as readonly string[]).includes(key)) {
          if (typeof value === 'string' && key !== 'plan.source_tax_tariff') {
            throw new WorkspaceError('Give a number or true/false.');
          }
          await ws.setPlan(person ?? 'p1', key as (typeof PLAN_KEYS)[number], value, 'chat');
          return {
            content: [
              {
                type: 'text',
                text: `Saved${typeof value === 'number' ? ' as an estimate' : ''}. Call list_optimizations for the updated figures.`,
              },
            ],
            structuredContent: { saved: true },
          };
        }
        if (!instance) {
          throw new WorkspaceError(
            key === 'check.note'
              ? 'Give the id of the "Check this" item as instance.'
              : 'Give the document id as instance.',
          );
        }
        if (key === 'check.note') {
          if (typeof value !== 'string') throw new WorkspaceError('Give the note as text.');
          await ws.resolveCheck(instance, value, 'chat');
          return {
            content: [{ type: 'text', text: 'Saved the note: this item is settled.' }],
            structuredContent: { saved: true },
          };
        }
        const fact = await ws.setDocumentValue(instance, key, person, value, 'chat');
        return {
          content: [
            {
              type: 'text',
              text: `Saved as confirmed by the user: ${ws.keys[key]?.label.en} = ${shown(ws, key, fact.value)}.`,
            },
          ],
          structuredContent: { saved: true },
        };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    'get_document_for_review',
    {
      title: 'Read a document',
      description:
        "The content of one of the user's documents for you to read: text page by page, or the image of a photo or scanned page. Extracted on this computer. Ask the user before you read a document; then propose what you read with propose_extraction.",
      inputSchema: z.object({
        id: z.string().max(80).describe('The document id from list_documents.'),
        page: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('First page to return, for long documents. Default 1.'),
      }),
      outputSchema: z.object({
        id: z.string(),
        filename: z.string(),
        format: z.string(),
        pages: z.number().int(),
        returned: z.array(z.number().int()),
        nextPage: z.number().int().optional(),
        problem: z.string().optional(),
      }),
      annotations: { title: 'Read a document', ...RO },
    },
    async ({ id, page }) => {
      await ws.ready();
      try {
        const { content, summary } = await reviewDocument(ws, id, page ?? 1);
        return { content, structuredContent: { ...summary } };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    'propose_extraction',
    {
      title: 'Propose values read in a document',
      description:
        'Saves the values you read in one document (get_document_for_review), each with its page and box, and what the document is. They stay "Needs your OK" until the user confirms them. Money exactly as printed. Never guess a value.',
      inputSchema: z.object({
        id: z.string().max(80).describe('The document id.'),
        document: z
          .object({
            kind: z.enum(DOCUMENT_KINDS).optional(),
            person: z
              .enum(['p1', 'p2', 'household'])
              .optional()
              .describe('Whose it is: p1 the user, p2 their spouse or partner, household both.'),
            taxYear: z.number().int().optional().describe('The year it is for, as printed.'),
            periodFrom: z
              .string()
              .max(10)
              .optional()
              .describe('First day it covers, as printed: 2026-01-01 or 01.01.2026.'),
            periodTo: z.string().max(10).optional().describe('Last day it covers.'),
            issuer: z
              .string()
              .max(120)
              .optional()
              .describe('Who issued it: employer, bank, insurer, tax office.'),
          })
          .optional()
          .describe('What the document is, as you read it.'),
        values: z
          .array(
            z.object({
              key: z.enum(DOCUMENT_VALUE_KEYS),
              value: z
                .union([z.string().max(200), z.boolean(), z.number()])
                .describe(
                  'Money as text exactly as printed, e.g. "85\'000.00"; dates as printed; true/false for a ticked box; a choice by its value.',
                ),
              page: z.number().int().min(1).describe('The page you read it on.'),
              box: z
                .string()
                .max(16)
                .optional()
                .describe(
                  'The box (chiffre) or letter on the form, e.g. "8" on a salary certificate.',
                ),
              person: z
                .enum(['p1', 'p2'])
                .optional()
                .describe('Whose value it is, when it differs from the document.'),
            }),
          )
          .max(60)
          .optional(),
      }),
      outputSchema: z.object({
        saved: z.number().int(),
        unchanged: z.number().int(),
        kept: z.array(z.object({ key: z.string(), person: z.string(), value: z.unknown() })),
        toConfirm: z.number().int(),
        checks: z.array(z.string()),
      }),
      annotations: { title: 'Propose values read in a document', ...RW },
    },
    async ({ id, document, values }) => {
      try {
        const result = await ws.proposeExtraction(id, document ?? {}, values ?? []);
        const doc = result.document;
        const toConfirm = ws.toConfirm().filter((f) => f.source.docId === doc.id).length;
        const checks = ws
          .checks()
          .filter((c) => !c.resolved && c.documents.includes(doc.id))
          .map((c) => `${c.title.en} (${c.id}): ${c.detail.en} ${c.todo.en}`);
        const details = [
          doc.kind ? KIND_LABELS[doc.kind].en : undefined,
          doc.person ? (WHO[doc.person] ?? doc.person) : undefined,
          doc.taxYear ? String(doc.taxYear) : undefined,
          doc.periodFrom && doc.periodTo
            ? `${formatDay(doc.periodFrom, 'en')} to ${formatDay(doc.periodTo, 'en')}`
            : undefined,
          doc.issuer,
        ].filter(Boolean);
        const lines = [
          `Saved ${result.saved} value${result.saved === 1 ? '' : 's'} from “${doc.filename}” as Needs your OK${details.length ? ` (${details.join(', ')})` : ''}.${result.unchanged ? ` ${result.unchanged} already there.` : ''}`,
        ];
        if (result.kept.length) {
          lines.push(
            `Kept what the user already confirmed, which differs from what you read: ${result.kept
              .map((k) => `${k.key} = ${shown(ws, k.key, k.value)}`)
              .join('; ')}. Ask the user which is right; they can change it in the dashboard.`,
          );
        }
        lines.push(
          toConfirm
            ? `${toConfirm} value${toConfirm === 1 ? '' : 's'} from this document need the user's OK: show them what you read, with the pages, and ask them to confirm in the dashboard (Documents), or confirm here with set_fact once they say it is right.`
            : 'Nothing from this document is waiting for the user’s OK.',
        );
        if (checks.length) lines.push(`Check this, with the user: ${checks.join(' ')}`);
        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          structuredContent: {
            saved: result.saved,
            unchanged: result.unchanged,
            kept: result.kept,
            toConfirm,
            checks,
          },
        };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // The securities list (état des titres) and other wealth: get_holdings, set_holding.
  registerHoldingTools(server, ws);

  server.registerTool(
    'get_form_values',
    {
      title: 'Get the values to type into the declaration',
      description:
        'The values the user types by hand into the official Geneva declaration, in the form\'s order, as in the dashboard\'s copy panel: rubric code, French label, value as typed, status. No section: the sections with progress. A section (e.g. "A1"): its values.',
      inputSchema: z.object({
        section: z
          .string()
          .max(4)
          .optional()
          .describe('A page of the form, e.g. "PG1", "A1", "C3". Default: the list of sections.'),
      }),
      outputSchema: z.object({
        provisional: z.boolean(),
        entered: z.number().int(),
        total: z.number().int(),
        pending: z.number().int(),
        sections: z.array(
          z.object({
            page: z.string(),
            title: z.string(),
            entered: z.number().int(),
            total: z.number().int(),
            pending: z.number().int(),
          }),
        ),
        rows: z
          .array(
            z.object({
              ref: z.string(),
              label: z.string(),
              copy: z.string().optional(),
              status: z.string(),
              final: z.boolean(),
              role: z.string(),
              entered: z.boolean(),
            }),
          )
          .optional(),
      }),
      annotations: { title: 'Get the values to type into the declaration', ...RO },
    },
    async ({ section }) => {
      await ws.ready();
      try {
        const { text, structured } = formValues(ws, section);
        return { content: [{ type: 'text', text }], structuredContent: structured };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    'open_dashboard',
    {
      title: 'Open the Taxpresso dashboard',
      description:
        'Shows the Taxpresso dashboard in the chat where the app can, and starts it on this computer (127.0.0.1) if needed. Returns its private link for the browser. Give the link to the user.',
      outputSchema: z.object({ url: z.string(), status: StatusSchema }),
      annotations: { title: 'Open the Taxpresso dashboard', ...RO },
      _meta: { ui: { resourceUri: DASHBOARD_VIEW_URI }, 'ui/resourceUri': DASHBOARD_VIEW_URI },
    },
    async () => {
      await ws.ready();
      ws.record('claude', 'dashboard');
      const url = await dashboard.start();
      return {
        content: [
          {
            type: 'text',
            text: `Dashboard: ${url}\nIt only works on this computer while Claude Desktop is running.`,
          },
        ],
        structuredContent: { url, status: status() },
      };
    },
  );

  // What the dashboard's buttons do, from the chat: mark_entered, skip_question,
  // waive_requirement, replace_document (./parity-tools.ts).
  registerParityTools(server, ws);

  // reconcile_official_pdf: this year's declaration PDF against the values to type (./reconcile.ts).
  registerDeclarationCheckTool(server, ws);

  // export_bundle: one ZIP of the tax-year folder, on this computer (./export.ts).
  registerExportTool(server, ws);

  // The dashboard view (ui://) and dashboard_api, which only that view calls.
  registerDashboardView(server, ws, dashboard);

  server.registerPrompt(
    'start_geneva_tax_return',
    {
      title: 'Start my Geneva tax return',
      description: 'Begin or pick up your Geneva tax return with Taxpresso.',
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `I want to work on my Geneva tax return for ${ws.config.taxYear} with Taxpresso. Check where I am and tell me the next step.`,
          },
        },
      ],
    }),
  );

  return server;
}
