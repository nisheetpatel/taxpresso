// The dashboard's API (/api/*). Same state and same rules as the MCP tools: answering here or in
// the chat with Claude is the same thing (SPEC.md section 6).
import { DOCUMENT_KINDS, LedgerError, VaultError } from '@taxpresso/ledger';
import { NBSP, QuestionnaireError, type Lang } from '@taxpresso/questionnaire';
import * as z from 'zod/v4';
import { copyPanelView, setRowEntered } from './copy-panel.js';
import type { ApiRequest, ApiResponse } from './dashboard.js';
import { documentCards, documentChecks, assessmentCards } from './document-views.js';
import { BARCODE_PENDING, isBarcodeDocument } from './barcode.js';
import { estimateView } from './estimate.js';
import { ExtractionError } from './extraction.js';
import { documentPerson, holdingsView, saveHolding } from './holdings.js';
import { KIND_LABELS } from './kinds.js';
import { reviewOf } from './last-year-review.js';
import {
  decide,
  DecisionInput,
  PLANNING_FIELDS,
  PlanningInput,
  planningReady,
  planningView,
} from './planning.js';
import type { Slot } from '@taxpresso/questionnaire';
import { exportFolder, exportView } from './export.js';
import { declarationCheckReady, declarationCheckView } from './reconcile.js';
import { finalCheckView } from './final-check.js';
import { WorkspaceError, type Workspace } from './workspace.js';

const Answer = z.object({
  id: z.string().max(80),
  value: z.union([
    z.string().max(200),
    z.number(),
    z.boolean(),
    z.array(z.string().max(80)).max(20),
  ]),
});
const Id = z.object({ id: z.string().max(80) });
const Plan = z.object({
  person: z.enum(['p1', 'p2']),
  field: z.enum(['gross', 'net', 'pensionFund', 'paid']),
  value: z.union([z.number().min(0).max(10_000_000), z.boolean()]),
});
const PLAN_FIELD = {
  gross: 'plan.gross_salary',
  net: 'plan.net_salary',
  pensionFund: 'plan.has_pension_fund',
  paid: 'plan.pillar3a_paid',
} as const;
const Waive = z.object({ id: z.string().max(80), waived: z.boolean().default(true) });
const Kind = z.object({
  id: z.string().max(80),
  kind: z.enum(DOCUMENT_KINDS),
  person: z.enum(['p1', 'p2', 'household']).optional(),
});
const FactEdit = z.object({
  id: z.string().max(80),
  value: z.union([z.string().max(60), z.boolean()]),
});
const Entered = z.object({ id: z.string().max(80), entered: z.boolean() });
const RowEntered = z.object({ id: z.string().max(240), entered: z.boolean() });
const Replace = z.object({ id: z.string().max(80), by: z.string().max(80) });
const Resolve = z.object({ id: z.string().max(120), note: z.string().max(500) });
// "Your securities and accounts" (./holdings.ts): an official value, or whose a line is.
const Official = z.object({
  id: z.string().max(64),
  value: z.string().max(40),
  from: z.string().max(200),
});
const LineOwnerChange = z.object({
  id: z.string().max(80),
  origin: z.enum(['broker_export', 'document', 'you']),
  owner: z.enum(['p1', 'p2', 'joint', 'children']),
});
/** "Something else" last in the list of kinds. */
const KIND_ORDER = [...DOCUMENT_KINDS.filter((k) => k !== 'other'), 'other' as const];

/** Where a question's suggestion comes from: last year's declaration, its year and page. */
function suggestedFrom(ws: Workspace, slot: Slot) {
  const source = slot.suggestion?.source;
  if (!source?.docId) return {};
  const doc = ws.documents.find((d) => d.id === source.docId);
  return {
    suggestedFrom: {
      ...(doc?.kind ? { kind: doc.kind } : {}),
      ...(doc?.taxYear ? { year: doc.taxYear } : {}),
      ...(source.page ? { page: source.page } : {}),
    },
  };
}

export function dashboardState(ws: Workspace, lang: Lang, csrf: string) {
  const snap = ws.snapshot();
  const people = ws.engine.file.people;
  const who = (person: string) =>
    snap.people.length > 1 && (person === 'p1' || person === 'p2')
      ? people[person][lang]
      : undefined;
  const next = ws.next();
  const canton = ws.canton();
  return {
    version: ws.config.version,
    taxYear: ws.config.taxYear,
    // The canton of the return (./cantons.ts): null until the user says where they lived.
    canton: canton.canton
      ? {
          code: canton.canton.code,
          name: canton.canton.name[lang],
          from: canton.from,
          because: canton.because.map((b) => b[lang]),
        }
      : null,
    lang,
    csrf,
    vault: ws.vaultInfo(),
    people: snap.people.map((p) => ({ id: p, label: people[p as 'p1' | 'p2'][lang] })),
    progress: {
      answered: snap.slots.filter((s) => s.value !== undefined).length,
      total: snap.slots.length,
    },
    question: next
      ? {
          ...ws.render(next, lang),
          skipped: ws.skipped.includes(next.id),
          ...suggestedFrom(ws, next),
        }
      : null,
    chips: ws.engine.chips(snap, lang),
    answers: snap.slots
      .filter((s) => s.value !== undefined)
      .map((s) => ({
        id: s.id,
        question: ws.render(s, lang).text,
        answer: ws.engine.describe(s, lang),
        ...(who(s.person) ? { who: who(s.person) } : {}),
        // Taken from other answers (a return started before the canton question).
        ...(s.assumed ? { assumed: true } : {}),
      })),
    documents: ws.activeDocuments().map((d) => ({
      id: d.id,
      filename: d.filename,
      bytes: d.bytes,
      addedAt: d.addedAt,
      ...(d.kind ? { kind: d.kind, kindLabel: KIND_LABELS[d.kind][lang] } : {}),
      ...(d.kindSource ? { kindSource: d.kindSource } : {}),
      ...(d.person ? { person: d.person } : {}),
      // Read from its barcode; "pending" while whose it is isn't known (./barcode.ts).
      ...(isBarcodeDocument(d)
        ? { barcode: d.parse.method === BARCODE_PENDING ? 'pending' : 'read' }
        : {}),
    })),
    kinds: KIND_ORDER.map((k) => ({ value: k, label: KIND_LABELS[k][lang] })),
    // Values read from documents, the "Check this" items and the assessment (SPEC.md 5.5, 5.8,
    // 10.5 second view, 10.8): ./document-views.ts.
    cards: documentCards(ws, lang),
    replaced: ws.documents
      .filter((d) => d.replacedBy)
      .map((d) => ({ id: d.id, filename: d.filename, by: d.replacedBy! })),
    checks: documentChecks(ws, lang),
    assessments: assessmentCards(ws, lang),
    // The values to type into the official declaration, in the form's order (SPEC.md 10.5).
    copyPanel: copyPanelView(ws, lang),
    // "Check before you transmit": this year's declaration PDF against them (SPEC.md 10.4).
    declarationCheck: declarationCheckView(ws, lang),
    // "A copy of your folder": the ZIP made last, if any (./export.ts).
    folderExport: exportView(ws),
    // "Final check" before filling in the official form (SPEC.md 10.0, ./final-check.ts).
    finalCheck: finalCheckView(ws, lang),
    toConfirm: ws.toConfirm().length,
    requirements: ws.requirements().map((r) => ({
      id: r.id,
      label: r.label[lang],
      reason: r.reason[lang],
      ...(r.explain ? { explain: r.explain[lang] } : {}),
      ...(r.learnMore
        ? { learnMore: { url: r.learnMore.url, label: r.learnMore.label[lang] } }
        : {}),
      group: r.id.split(':')[0] ?? r.id,
      status: r.status,
      have: r.have,
      need: 'count' in r.expects ? r.expects.count : 1,
      kind: 'kinds' in r.expects ? r.expects.kinds[0] : undefined,
      person: r.person,
      optional: r.optional === true,
      ...(who(r.person) ? { who: who(r.person) } : {}),
    })),
    plan: {
      inputs: ws.planInput().people.map((p) => ({
        person: p.person,
        gross: p.grossCentimes ?? null,
        net: p.netCentimes ?? null,
        hasPensionFund: p.hasPensionFund,
        paid: p.paidCentimes,
      })),
      result: ws.plan(),
    },
    // Pension fund buy-in, 3a catch-up and TOU (SPEC.md section 8, groups B and C): ./planning.ts.
    planning: planningView(ws),
    notSupported: ws.engine.notSupported(snap).map((n) => n.what[lang]),
    securities: ws.securities(lang) ?? null,
    // The tax from the rules engine (./estimate.ts).
    estimate: estimateView(ws, lang),
    holdings: holdingsView(ws, lang) ?? null,
    // Last year's declaration: main figures to compare, never filed (SPEC.md 5.4).
    lastYear: ws.lastYear(lang) ?? null,
    // Last year's return, reviewed (./last-year-review.ts): read-only, never this year's tax.
    review: reviewOf(ws),
    notSupportedMessage: ws.engine.notSupportedMessage(lang),
    activity: ws.activity().map((a) => {
      if (a.what === 'answer' && a.detail) {
        const slot = snap.slots.find((s) => s.id === a.detail);
        if (!slot) return { ...a, detail: '' };
        const label = ws.keys[slot.question.key]?.label[lang];
        const answer = ws.engine.describe(slot, lang);
        return {
          ...a,
          detail: label ? `${label}${lang === 'fr' ? `${NBSP}: ` : ': '}${answer}` : answer,
        };
      }
      if (a.what === 'kind' && a.detail && a.detail in KIND_LABELS) {
        return { ...a, detail: KIND_LABELS[a.detail as keyof typeof KIND_LABELS][lang] };
      }
      return a;
    }),
  };
}

export type DashboardState = ReturnType<typeof dashboardState>;

const parse = <T>(schema: z.ZodType<T>, body: Buffer): T => {
  try {
    return schema.parse(JSON.parse(body.toString('utf8') || '{}'));
  } catch {
    throw new WorkspaceError('The request is not valid.');
  }
};

export function createApi(ws: Workspace): (req: ApiRequest) => Promise<ApiResponse> {
  return async (req) => {
    const lang: Lang =
      req.query.get('lang') === 'fr'
        ? 'fr'
        : req.query.get('lang') === 'en'
          ? 'en'
          : ws.config.uiLanguage;
    const state = () => ({ status: 200, body: dashboardState(ws, lang, req.csrf) });
    try {
      await ws.ready();
      await planningReady(ws);
      await declarationCheckReady(ws); // reads this year's declaration PDF once, never throws
      if (req.method === 'GET') {
        if (req.path === '/state') return state();
        if (req.path === '/question') {
          const slot = ws.snapshot().slots.find((s) => s.id === req.query.get('id'));
          if (!slot) return { status: 404, body: { error: 'This question doesn’t apply now.' } };
          return { status: 200, body: ws.render(slot, lang) };
        }
        return { status: 404, body: { error: 'Not found.' } };
      }
      switch (req.path) {
        case '/answer': {
          const { id, value } = parse(Answer, req.body);
          await ws.answer(id, value, 'dashboard');
          return state();
        }
        case '/skip':
          await ws.skip(parse(Id, req.body).id);
          return state();
        case '/waive': {
          const { id, waived } = parse(Waive, req.body);
          await ws.waive(id, waived);
          return state();
        }
        case '/plan': {
          const { person, field, value } = parse(Plan, req.body);
          await ws.setPlan(person, PLAN_FIELD[field], value, 'dashboard');
          return state();
        }
        case '/planning': {
          const { person, field, value } = parse(PlanningInput, req.body);
          await ws.setPlan(person, PLANNING_FIELDS[field], value, 'dashboard');
          return state();
        }
        case '/decide':
          await decide(ws, parse(DecisionInput, req.body), 'dashboard');
          return state();
        case '/scan':
          await ws.scan('you');
          return state();
        case '/documents': {
          const raw = req.headers['x-filename'];
          const name =
            decodeURIComponent(Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')) || 'document';
          const { document } = await ws.addDocument(req.body, name, 'dashboard');
          // Uploaded to replace another document (a "Check this" item or a card).
          const replace = req.query.get('replace');
          if (replace && replace !== document.id) await ws.replaceDocument(replace, document.id);
          // Uploaded from a "still missing" row: the user already said what it is.
          const kind = Kind.shape.kind.safeParse(req.query.get('kind'));
          const person = Kind.shape.person.safeParse(req.query.get('person') ?? undefined);
          if (kind.success && !document.kind) {
            await ws.setDocumentKind(
              document.id,
              kind.data,
              person.success ? person.data : undefined,
            );
          }
          return state();
        }
        case '/documents/kind': {
          const { id, kind, person } = parse(Kind, req.body);
          await ws.setDocumentKind(id, kind, person);
          return state();
        }
        case '/documents/confirm':
          await ws.confirmDocument(parse(Id, req.body).id, 'dashboard');
          return state();
        case '/documents/replace': {
          const { id, by } = parse(Replace, req.body);
          await ws.replaceDocument(id, by);
          return state();
        }
        case '/facts/confirm':
          await ws.confirmFact(parse(Id, req.body).id, 'dashboard');
          return state();
        case '/facts/edit': {
          const { id, value } = parse(FactEdit, req.body);
          await ws.editFact(id, value, 'dashboard');
          return state();
        }
        case '/facts/entered': {
          const { id, entered } = parse(Entered, req.body);
          await ws.setEntered(id, entered);
          return state();
        }
        case '/form/entered': {
          const { id, entered } = parse(RowEntered, req.body);
          await setRowEntered(ws, id, entered);
          return state();
        }
        case '/holdings/official': {
          const { id, value, from } = parse(Official, req.body);
          await saveHolding(ws, { security: id, officialValue: value, from }, 'dashboard');
          return state();
        }
        case '/holdings/owner': {
          const { id, origin, owner } = parse(LineOwnerChange, req.body);
          if (origin === 'document') {
            // Lines read from a document belong to whoever the document is for.
            const doc = ws.activeDocuments().find((d) => d.id === id);
            const person = documentPerson(owner);
            if (!doc?.kind || !person) throw new WorkspaceError('This line can’t take that owner.');
            await ws.setDocumentKind(doc.id, doc.kind, person);
          } else {
            await saveHolding(
              ws,
              origin === 'you' ? { item: id, owner } : { security: id, owner },
              'dashboard',
            );
          }
          return state();
        }
        case '/export':
          await exportFolder(ws);
          return state();
        case '/checks/resolve': {
          const { id, note } = parse(Resolve, req.body);
          await ws.resolveCheck(id, note, 'dashboard');
          return state();
        }
        default:
          return { status: 404, body: { error: 'Not found.' } };
      }
    } catch (err) {
      if (
        err instanceof WorkspaceError ||
        err instanceof ExtractionError ||
        err instanceof QuestionnaireError ||
        err instanceof VaultError ||
        err instanceof LedgerError ||
        err instanceof URIError
      ) {
        return { status: 400, body: { error: err.message } };
      }
      throw err;
    }
  };
}
