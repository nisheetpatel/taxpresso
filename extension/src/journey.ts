// Simple first (docs/design/simple.md): one next step and five stages, the same for Claude
// (get_status) and the dashboard. Derived from the workspace on every read, never stored. Ids and
// numbers only, plus Claude's instruction in English: the dashboard words each id in the page's
// language (ui/src/dashboard/i18n-journey.ts), get_status in English (journeyText below).
import { SUPPORTED_CANTONS } from '@taxpresso/rules-ch';
import { cantonNames, type CantonEntry } from './cantons.js';
import { BARCODE_PENDING } from './barcode.js';
import { hasFigures } from './estimate.js';
import { planningView, savingsTotal, type SavingsTotal } from './planning.js';
import type { Workspace } from './workspace.js';

export const STAGES = ['about', 'documents', 'tax', 'save', 'file'] as const;
export type StageId = (typeof STAGES)[number];

export type NextId =
  | 'folder'
  | 'not_supported'
  | 'start'
  | 'read'
  | 'whose'
  | 'canton'
  | 'prior'
  | 'questions'
  | 'confirm'
  | 'checks'
  | 'identify'
  | 'assessment'
  | 'documents'
  | 'income'
  | 'save'
  | 'later'
  | 'file';

/** Numbers and dates a sentence needs; the dashboard formats money and dates itself. */
export interface Vars {
  n?: number;
  /** Centimes. */
  amount?: number;
  /** YYYY-MM-DD. */
  date?: string;
  year?: number;
  /** Centimes: the separate tax on pension capital, never in the total (`amount`). */
  capital?: number;
}

export interface StageView {
  id: StageId;
  /** What the stage's one line says (ui i18n-journey: `stage.<id>.<status>`). */
  status: string;
  vars: Vars;
}

/** A fact that needs no decision, as a sentence in "About you". */
export interface Fact {
  id:
    | 'tou_already'
    | 'tou_compulsory'
    | 'tou_chosen_request'
    | 'tou_chosen_decline'
    | 'tou_passed'
    | 'tou_mixed'
    | 'tou_geneva_only';
  /** Who it is about in a couple: you, your spouse or partner, or both of you. */
  who?: 'p1' | 'p2' | 'both';
  vars: Vars;
}

export interface Journey {
  next: { id: NextId; stage: StageId | null; vars: Vars };
  /** The stage open by default: the next step's, else the first that isn't done. */
  stage: StageId;
  stages: StageView[];
  about: Fact[];
  /** At least one income or wealth figure: only then is there a tax to show. */
  hasFigures: boolean;
  /** What Taxpresso can work out for "before 31 December", all plans together. */
  savings: SavingsTotal | null;
  /** The TOU card in "Ways to save": only when there is a real choice. */
  touChoice: boolean;
  /** The documents are in: the File stage opens. */
  documentsIn: boolean;
  /** Claude's instruction for the next step (get_status nextStep). */
  claude: string;
}

const STAGE_OF: Record<NextId, StageId | null> = {
  folder: null,
  not_supported: 'about',
  start: 'about',
  read: 'documents',
  whose: 'documents',
  canton: 'about',
  prior: 'about',
  questions: 'about',
  confirm: 'documents',
  checks: 'documents',
  identify: 'documents',
  assessment: 'file',
  documents: 'documents',
  income: 'tax',
  save: 'save',
  later: 'documents',
  file: 'file',
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const chf = (centimes: number) => `CHF ${Math.round(centimes / 100).toLocaleString('en-US')}`;
const about = (centimes: number) => chf(Math.round(centimes / 1000) * 1000);

/** The last day of the tax year: what is paid in by then counts for it. */
const yearEnd = (ws: Workspace) => `${ws.taxYear}-12-31`;

function touFacts(ws: Workspace, planning: ReturnType<typeof planningView> | null): Fact[] {
  if (!planning) return [];
  const atSource = planning.inputs.filter((i) => i.taxedAtSource).map((i) => i.person);
  const couple = planning.inputs.length > 1;
  const who = (): Fact['who'] =>
    couple ? (atSource.length > 1 ? 'both' : (atSource[0] ?? 'p1')) : 'p1';
  if (planning.touGenevaOnly) {
    return atSource.length ? [{ id: 'tou_geneva_only', who: who(), vars: {} }] : [];
  }
  const tou = planning.tou;
  if (!tou.applies) return [];
  if (tou.problem === 'mixed_couple') return [{ id: 'tou_mixed', vars: {} }];
  if (tou.compulsory === 'yes') {
    // In TOU already (asked for in an earlier year): it goes on every year (TOU_FACTS.everyYearAfter).
    const only = tou.reasons.filter((r) => r.status === 'yes').map((r) => r.id);
    const already = only.length > 0 && only.every((r) => r === 'previous_tou');
    return [
      already
        ? { id: 'tou_already', who: who(), vars: {} }
        : { id: 'tou_compulsory', who: who(), vars: { date: tou.deadline } },
    ];
  }
  if (tou.decision) {
    return [
      {
        id: tou.decision.choice === 'request' ? 'tou_chosen_request' : 'tou_chosen_decline',
        vars: { date: tou.deadline },
      },
    ];
  }
  if (tou.deadlinePassed) return [{ id: 'tou_passed', vars: { date: tou.deadline } }];
  return [];
}

export function journey(ws: Workspace): Journey {
  const snap = ws.snapshot();
  const answered = snap.slots.filter((s) => s.value !== undefined).length;
  const open = snap.slots.length - answered;
  const canton = ws.canton();
  const vault = ws.vaultInfo();
  const notSupported = ws.engine.notSupported(snap);
  const requirements = ws.requirements();
  const missing = requirements.filter((r) => r.status === 'missing' && !r.optional);
  const documents = ws.activeDocuments();
  const toRead = ws.toRead().length;
  const toConfirm = ws.toConfirm().length;
  const toIdentify = documents.filter((d) => !d.kind).length;
  const whose = documents.filter((d) => d.parse.method === BARCODE_PENDING).length;
  const checks = ws.checks().filter((c) => !c.resolved).length;
  // This year's assessment: one of an earlier year feeds "Last year, reviewed" instead.
  const thisYear = new Set(
    documents
      .filter((d) => d.kind === 'tax_assessment' && (d.taxYear ?? ws.taxYear) === ws.taxYear)
      .map((d) => d.id),
  );
  const assessment = ws.assessments().find((a) => thisYear.has(a.docId) && a.deadlines.length);
  const yearEnded = ws.today() > yearEnd(ws);
  const lastYearIn =
    ws.lastYear('en') !== undefined ||
    documents.some((d) => d.kind === 'prior_declaration' || d.kind === 'tax_assessment');
  const figures = hasFigures(ws);
  const planning = ws.yearOver() ? null : planningView(ws);
  const savings = planning && !yearEnded ? (savingsTotal(ws) ?? null) : null;
  const tou = planning?.tou;
  const touChoice = Boolean(
    planning &&
    !planning.touGenevaOnly &&
    tou?.applies &&
    tou.compulsory !== 'yes' &&
    !tou.deadlinePassed &&
    tou.problem !== 'mixed_couple' &&
    !tou.decision,
  );
  const documentsIn =
    missing.length === 0 &&
    toRead === 0 &&
    toConfirm === 0 &&
    checks === 0 &&
    toIdentify === 0 &&
    whose === 0 &&
    open === 0 &&
    documents.length > 0;

  // --- The next step: the first rule that holds (docs/design/simple.md, section 3).
  const step = (): { id: NextId; vars: Vars } => {
    if (vault.problem) return { id: 'folder', vars: {} };
    if (notSupported.length) return { id: 'not_supported', vars: {} };
    if (answered === 0 && documents.length === 0) return { id: 'start', vars: {} };
    if (toRead > 0) return { id: 'read', vars: { n: toRead } };
    if (whose > 0) return { id: 'whose', vars: { n: whose } };
    if (!canton.answer) return { id: 'canton', vars: {} };
    if (
      canton.canton?.code === 'GE' &&
      open > 0 &&
      snap.slots.every((s) => s.value === undefined || s.question.key === 'profile.canton') &&
      !lastYearIn
    ) {
      return { id: 'prior', vars: {} };
    }
    if (open > 0) return { id: 'questions', vars: { n: open } };
    if (toConfirm > 0) return { id: 'confirm', vars: { n: toConfirm } };
    if (checks > 0) return { id: 'checks', vars: { n: checks } };
    if (toIdentify > 0) return { id: 'identify', vars: { n: toIdentify } };
    if (assessment) return { id: 'assessment', vars: {} };
    if (missing.length && yearEnded) return { id: 'documents', vars: { n: missing.length } };
    if (!figures && ws.estimate().result) return { id: 'income', vars: {} };
    if (savings) return { id: 'save', vars: { amount: savings.totalCentimes, date: yearEnd(ws) } };
    if (touChoice) return { id: 'save', vars: { date: tou?.deadline ?? yearEnd(ws) } };
    if (missing.length) return { id: 'later', vars: { n: missing.length, year: ws.taxYear } };
    return { id: 'file', vars: {} };
  };
  const { id, vars } = step();

  // --- The stages, each in one line.
  const aboutStage: StageView =
    notSupported.length > 0
      ? { id: 'about', status: 'not_supported', vars: {} }
      : answered === 0
        ? { id: 'about', status: 'start', vars: {} }
        : open > 0
          ? { id: 'about', status: 'open', vars: { n: open } }
          : { id: 'about', status: 'done', vars: { n: answered } };
  const docStage: StageView =
    answered === 0 && documents.length === 0
      ? { id: 'documents', status: 'empty', vars: {} }
      : toRead > 0
        ? { id: 'documents', status: 'read', vars: { n: toRead } }
        : whose > 0
          ? { id: 'documents', status: 'whose', vars: { n: whose } }
          : toConfirm > 0
            ? { id: 'documents', status: 'confirm', vars: { n: toConfirm } }
            : checks > 0
              ? { id: 'documents', status: 'checks', vars: { n: checks } }
              : toIdentify > 0
                ? { id: 'documents', status: 'identify', vars: { n: toIdentify } }
                : missing.length > 0
                  ? {
                      id: 'documents',
                      status: yearEnded ? 'missing' : 'later',
                      vars: { n: missing.length, year: ws.taxYear },
                    }
                  : documents.length
                    ? { id: 'documents', status: 'done', vars: { n: documents.length } }
                    : { id: 'documents', status: 'empty', vars: {} };
  const result = ws.estimate().result;
  const taxStage: StageView =
    figures && result?.total !== null && result?.total !== undefined
      ? {
          id: 'tax',
          status: result.estimates.length || !result.complete ? 'estimate' : 'computed',
          vars: {
            amount: result.total,
            // The tax on a lump sum of pension capital: its own line, never in the total.
            ...(result.capital?.total ? { capital: result.capital.total.amount } : {}),
          },
        }
      : { id: 'tax', status: 'waiting', vars: {} };
  const saveStage: StageView = ws.yearOver()
    ? { id: 'save', status: 'over', vars: { year: ws.taxYear } }
    : savings
      ? { id: 'save', status: 'total', vars: { amount: savings.totalCentimes, date: yearEnd(ws) } }
      : touChoice && tou
        ? { id: 'save', status: 'tou', vars: { date: tou.deadline } }
        : { id: 'save', status: 'ask', vars: {} };
  const fileStage: StageView = documentsIn
    ? { id: 'file', status: 'open', vars: {} }
    : { id: 'file', status: 'later', vars: {} };
  const stages = [aboutStage, docStage, taxStage, saveStage, fileStage];

  const stage: StageId =
    STAGE_OF[id] ??
    (stages.find((s) => !['done', 'computed', 'estimate'].includes(s.status))?.id || 'about');
  return {
    next: { id, stage: STAGE_OF[id], vars },
    stage,
    stages,
    about: touFacts(ws, planning),
    hasFigures: figures,
    savings,
    touChoice,
    documentsIn,
    claude: claudeStep(ws, id, vars, {
      canton: canton.canton ?? canton.notOffered,
      notSupported: notSupported.map((n) => n.what.en),
      problem: vault.problem,
      suggestions: ws.lastYear('en')?.suggestions !== undefined || hasSuggestions(snap),
      savings,
      touChoice,
      then: () => {
        // What comes after the savings, for when the user doesn't want to look at them now.
        if (missing.length) return 'later';
        return 'file';
      },
    }),
  };
}

const hasSuggestions = (snap: ReturnType<Workspace['snapshot']>) =>
  snap.slots.some((s) => s.value === undefined && s.suggested !== undefined);

interface StepContext {
  canton: CantonEntry | undefined;
  notSupported: string[];
  problem: string | undefined;
  suggestions: boolean;
  savings: SavingsTotal | null;
  touChoice: boolean;
  then: () => NextId;
}

/** Someone in a Geneva household works for themselves (annexe B, the simple case). */
function selfEmployedInGeneva(ws: Workspace): boolean {
  if (ws.canton().canton?.code !== 'GE') return false;
  const answers = ws.snapshot().answers;
  return (['p1', 'p2'] as const).some((p) => {
    const sources = answers.get(`profile.income_sources|${p}`);
    return Array.isArray(sources) && sources.includes('self_employment');
  });
}

/** Claude's instruction for each next step: short, in English (C6). */
function claudeStep(ws: Workspace, id: NextId, vars: Vars, c: StepContext): string {
  const software = c.canton
    ? `${c.canton.software} (the canton's free software)`
    : "their canton's free tax software";
  const n = vars.n ?? 0;
  const suggestion =
    " When a question comes with a suggestion from last year's declaration or tax bill, ask the user whether it is still right, then save their answer with answer_question.";
  switch (id) {
    case 'folder':
      return c.problem ?? '';
    case 'not_supported':
      return `Tell the user plainly that Taxpresso can't prepare this yet: ${c.notSupported.join('; ')}. Suggest ${software} or a fiduciary. Don't work around it.`;
    case 'start':
      return 'Nothing yet. In a sentence or two, say they can drop what they have (last year’s declaration or tax bill, this year’s documents) into their Taxpresso folder or the dashboard (open_dashboard), or just tell you about themselves. When they add files, call ingest_vault. When they’d rather talk, start with where the user lived on 31 December (next_questions).';
    case 'read':
      return `${plural(n, 'document')} not read yet. Reading sends a document’s content to you, so ask the user first, once for all of them. Then read each (get_document_for_review) and propose what it shows with propose_extraction: an assessment (avis de taxation) also proposes the household answers it prints, each with its page. Then sum up what you found in a few plain lines. The user can also say what each one is in the dashboard.`;
    case 'whose':
      return `${n} certificate${n === 1 ? ' was' : 's were'} read from the barcode; ask the user whose ${n === 1 ? 'it is' : 'each one is'} (theirs or their partner’s). They choose it in the dashboard (Documents), or tell you and you save it with set_document_owner; then the values fill in.`;
    case 'canton':
      return `Ask the first question: where the user lived on 31 December (next_questions). That canton taxes the whole year, and it decides the questions and the tax. Taxpresso prepares ${cantonNames(SUPPORTED_CANTONS, 'and')} returns so far.${c.suggestions ? suggestion : ''}`;
    case 'prior':
      return "Before the next question, ask the user for last year's Geneva tax declaration (the PDF from GeTax, the online declaration or their tax software) or last year's tax bill (avis de taxation): Taxpresso suggests most answers from it for them to confirm. They drop it in the dashboard (open_dashboard) or in their Taxpresso folder, then call ingest_vault. If they don't have it, ask the next questions: call next_questions.";
    case 'questions':
      return `Sum up what Taxpresso knows in a few plain lines (About you), then ask only what is still unknown, a few at a time (next_questions with limit 3), in plain words. Never ask for a technical figure (tariff, tax withheld): Taxpresso reads or estimates those.${c.suggestions ? suggestion : ''} If the user doesn't know an answer, call skip_question.`;
    case 'confirm':
      return `${n} value${n === 1 ? '' : 's'} read from documents need the user's OK. Ask them to check each one in the dashboard (Documents), or to confirm in the chat; then save with set_fact.`;
    case 'checks':
      return 'Go through the "Check this" items with the user. Each is settled by replacing the document in the dashboard, or with a short note from the user (set_fact, key check.note, instance = the item id).';
    case 'identify':
      return 'Ask the user to say what each new document is, in the dashboard (open_dashboard).';
    case 'assessment':
      return 'The assessment is in: go through the differences with the user in the dashboard ("Your assessment"). The deadline to object is in the card, with its legal source; the date printed on the assessment wins. Taxpresso never sends the objection.';
    case 'documents':
      return 'Ask for the missing documents. The user drops them in the dashboard or puts them in their Taxpresso folder; then call ingest_vault.';
    case 'income':
      return `There is no income figure yet, so there is no tax to show. Ask, in plain words, roughly what the user (and their partner) earn this year and save it with set_fact (plan.gross_salary, an estimate); or they add a salary certificate.${selfEmployedInGeneva(ws) ? " For a business of their own, ask roughly what profit (bénéfice net) it makes this year, after their own AVS contributions, and save it with set_fact (plan.business_profit); or they add the business's accounts." : ''} Then call compute_tax.`;
    case 'save': {
      const then = c.then() === 'later' ? 'their documents come after 31 December' : 'file';
      const what = c.savings
        ? `Taxpresso works out about ${about(c.savings.totalCentimes)} of savings before 31 December ${ws.taxYear}${c.savings.onlyWithTou ? ', only with TOU' : ''}, an estimate.`
        : 'A TOU choice is open (taxation ordinaire ultérieure).';
      return `Give the tax (compute_tax) in a line. ${what} Offer it once, as one question: "Want to see how to lower this before 31 December?" If yes, call list_optimizations and go through it. If not, move on: ${then}.`;
    }
    case 'later':
      return `Nothing to do now: the ${ws.taxYear} documents still missing (${n}) come after 31 December. Tell the user to add them when they arrive (dashboard or Taxpresso folder, then ingest_vault). Meanwhile, compute_tax gives the tax so far.`;
    case 'file':
      return 'Everything is collected for now. Call compute_tax and give the user the tax it computes, with what is an estimate; then call final_check and go through it before they fill in the official form.';
  }
}

// --- For Claude: the stages in one line each (get_status) ----------------------------------------

/** The tax on pension capital, said apart from the total. */
const apart = (s: StageView) =>
  s.vars.capital !== undefined
    ? `; the tax on pension capital, apart from it: ${chf(s.vars.capital)}`
    : '';

const STAGE_NAME: Record<StageId, string> = {
  about: 'About you',
  documents: 'Your documents',
  tax: 'Your tax',
  save: 'Ways to save',
  file: 'File',
};

function stageLine(s: StageView): string {
  const n = s.vars.n ?? 0;
  switch (`${s.id}.${s.status}`) {
    case 'about.start':
      return 'nothing yet';
    case 'about.open':
      return `${plural(n, 'question')} left`;
    case 'about.done':
      return 'done';
    case 'about.not_supported':
      return 'part of it is not supported';
    case 'documents.read':
      return `${n} to read`;
    case 'documents.whose':
      return `${n} waiting for whose`;
    case 'documents.confirm':
      return `${plural(n, 'value')} to check`;
    case 'documents.checks':
      return `${n} to check`;
    case 'documents.identify':
      return `${n} to identify`;
    case 'documents.missing':
      return `${n} missing`;
    case 'documents.later':
      return `${plural(n, 'document')} to add after 31 December ${s.vars.year}`;
    case 'documents.done':
      return 'all here';
    case 'documents.empty':
      return 'none yet';
    case 'tax.estimate':
      return `about ${chf(s.vars.amount ?? 0)} (estimate)${apart(s)}`;
    case 'tax.computed':
      return `${chf(s.vars.amount ?? 0)}${apart(s)}`;
    case 'tax.waiting':
      return 'no income figure yet';
    case 'save.total':
      return `about ${about(s.vars.amount ?? 0)} if paid in by 31 December (estimate)`;
    case 'save.tou':
      return `TOU choice open until ${s.vars.date}`;
    case 'save.ask':
      return 'nothing worked out yet';
    case 'save.over':
      return `${s.vars.year} is over`;
    case 'file.open':
      return 'ready to check';
    case 'file.later':
      return 'later';
    default:
      return s.status;
  }
}

const FACT_TEXT: Record<Fact['id'], (f: Fact) => string> = {
  tou_already: (f) =>
    `${f.who === 'both' ? 'Both are' : f.who === 'p2' ? 'The partner is' : 'The user is'} taxed at source and already in TOU: an ordinary declaration is filed, nothing to decide.`,
  tou_compulsory: (f) =>
    `TOU is compulsory: announce it with the DRIS/TOU form by ${f.vars.date}, then an ordinary declaration is filed. Nothing to decide.`,
  tou_chosen_request: (f) =>
    `The user chose to ask for TOU: they send the DRIS/TOU form by ${f.vars.date}.`,
  tou_chosen_decline: () => 'The user chose no TOU this year: the tax withheld at source is final.',
  tou_passed: (f) => `The TOU deadline (${f.vars.date}) has passed.`,
  tou_mixed: () => 'Only one of the couple is taxed at source: no TOU comparison; suggest the AFC.',
  tou_geneva_only: () =>
    'Taxed at source in a canton other than Geneva: not supported yet (TOU is Geneva’s).',
};

/** get_status's lines for the journey: the stages and the facts, concise. */
export function journeyText(j: Journey): string[] {
  const stages = j.stages
    .map(
      (s) =>
        `${s.id === j.stage ? '[' : ''}${STAGE_NAME[s.id]}: ${stageLine(s)}${s.id === j.stage ? ']' : ''}`,
    )
    .join(' · ');
  return [
    `Stages (the open one in brackets): ${stages}`,
    ...(j.about.length ? [`Facts: ${j.about.map((f) => FACT_TEXT[f.id](f)).join(' ')}`] : []),
  ];
}

/** The user's sentence for the next step, in English (the dashboard says the same in its language). */
export function nextText(j: Journey, year: number): string {
  const n = j.next.vars.n ?? 0;
  switch (j.next.id) {
    case 'folder':
      return 'Your Taxpresso folder can’t be used.';
    case 'not_supported':
      return 'Taxpresso can’t prepare part of your situation yet.';
    case 'start':
      return 'Drop what you have: last year’s declaration or tax bill, this year’s documents. Or just tell Claude about yourself.';
    case 'read':
      return n === 1
        ? 'Taxpresso has a document to read. Ask Claude to read it, or say what it is.'
        : `Taxpresso has ${n} documents to read. Ask Claude to read them, or say what each one is.`;
    case 'whose':
      return `Say whose ${n === 1 ? 'this certificate is' : 'each certificate is'}.`;
    case 'canton':
      return `Where did you live on 31 December ${year}?`;
    case 'prior':
      return 'Add last year’s declaration or tax bill: Taxpresso fills in most answers from it.';
    case 'questions':
      return `Answer ${n === 1 ? 'one more question' : `${n} more questions`}, here or in the chat.`;
    case 'confirm':
      return `Check ${plural(n, 'value')} read from your documents.`;
    case 'checks':
      return `Settle ${n === 1 ? 'one thing' : `${n} things`} to check.`;
    case 'identify':
      return 'Say what each new document is.';
    case 'assessment':
      return 'Compare your assessment with your declaration.';
    case 'documents':
      return `Add your ${plural(n, 'missing document')}.`;
    case 'income':
      return 'Tell Claude roughly what you earn this year, so Taxpresso can estimate your tax.';
    case 'save':
      return j.savings
        ? `You could save about ${about(j.savings.totalCentimes)} before 31 December: see how.`
        : 'Decide whether to ask for TOU.';
    case 'later':
      return `Your ${year} documents come after 31 December. Add them when they arrive.`;
    case 'file':
      return 'Everything is in: check, then fill in your declaration.';
  }
}
