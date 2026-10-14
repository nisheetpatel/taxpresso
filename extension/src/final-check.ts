// final_check (SPEC.md 10.0) and the dashboard's "Final check" card: before the user fills in the
// official form, the rules engine runs again on the current ledger and a pure function
// (@taxpresso/rules-ge, finalCheck) lists what to fix first and what is good to know. This file
// gathers its inputs from the workspace and words its result. Read-only: it stores nothing and
// sends nothing. The passages of the official documents are not attached: bundling them waits for
// the legal check (SPEC.md 7b); each rule is cited by manifest id, page or article, and link.
import type { McpServer } from '@modelcontextprotocol/server';
import type { Fact } from '@taxpresso/ledger';
import type { ContentLang as Lang } from './lang.js';
import type { CantonTerms, LimitApplied, Text } from '@taxpresso/rules-ch';
import {
  finalCheck,
  officialLinks,
  type FinalCheck,
  type FinalCheckCanton,
  type FinalCheckInput,
  type FinalCheckItem,
  type PendingValue,
} from '@taxpresso/rules-ge';
import * as z from 'zod/v4';
import { BARCODE_PENDING } from './barcode.js';
import { CANTONS, type CantonEntry } from './cantons.js';
import { ENUM_LABELS } from './extraction.js';
import { holdings } from './holdings.js';
import { declarationCheckReady, declarationCheckView } from './reconcile.js';
import type { Workspace } from './workspace.js';
import { TaxYears } from './years.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = String.fromCharCode(0xa0);

/** Keys the securities list (état des titres) reads: their estimates are told line by line. */
const HOLDING_KEY = /^(accounts|liabilities|securities|wealth)\./;

const FINAL_OK = t(
  'Your OK: tap it in the dashboard (Documents), or confirm it in the chat.',
  `Votre accord${NB}: d’un geste dans le tableau de bord (Documents), ou dans la conversation.`,
);
const FINAL_SALARY = t(
  'Your salary certificate (certificat de salaire): it replaces this rough figure.',
  `Votre certificat de salaire${NB}: il remplace ce montant approximatif.`,
);
const FINAL_DOCUMENT = t(
  'The document that shows it. If none will come in time, you can ask the tax office (AFC) for more time to file instead of filing a guess.',
  'Le document qui le montre. S’il n’arrivera pas à temps, vous pouvez demander un délai à l’administration fiscale (AFC) plutôt que déclarer une estimation.',
);
const FINAL_OFFICIAL_VALUE = t(
  'Its official value from the ESTV price list (liste des cours, ictax.admin.ch), which you look up and give in the dashboard (Your securities and accounts) or in the chat.',
  'Sa valeur officielle selon la liste des cours de l’AFC (ictax.admin.ch), que vous cherchez et indiquez dans le tableau de bord (Vos titres et comptes) ou dans la conversation.',
);
const FINAL_HOLDING = t(
  'A statement that shows it, or tell Taxpresso the amount is right: it is then Confirmed by you.',
  `Un relevé qui le montre, ou dites à Taxpresso que le montant est juste${NB}: il est alors Confirmé par vous.`,
);
/** The official page to ask for more time to file (docs/sources/ge/manifest.json). */
const MORE_TIME = 'ge-na-other-demander-delai';

/** What makes a value final, worded from the official terms of a canton's form. */
interface FinalTexts {
  salary: Text;
  document: Text;
  officialValue: Text;
  /** A line of the securities list, by its name. */
  securities(name: string): Text;
}

/** Geneva's: the defaults, also before the canton is known. */
const GENEVA_TEXTS: FinalTexts = {
  salary: FINAL_SALARY,
  document: FINAL_DOCUMENT,
  officialValue: FINAL_OFFICIAL_VALUE,
  securities: (name) => t(`${name} (état des titres)`, `${name} (état des titres)`),
};

/** The same texts for a canton's own form: its salary certificate, tax office and lists. */
function cantonTexts(terms: CantonTerms): FinalTexts {
  return {
    salary: t(
      `Your salary certificate (${terms.salaryCertificate}): it replaces this rough figure.`,
      `Votre certificat de salaire (${terms.salaryCertificate})${NB}: il remplace ce montant approximatif.`,
    ),
    document: t(
      `The document that shows it. If none will come in time, you can ask the tax office (${terms.taxOffice}) for more time to file (${terms.moreTime}) instead of filing a guess.`,
      `Le document qui le montre. S’il n’arrivera pas à temps, vous pouvez demander un délai (${terms.moreTime}) à l’administration fiscale (${terms.taxOffice}) plutôt que déclarer une estimation.`,
    ),
    officialValue: t(
      `Its official value from the ESTV price list (${terms.priceList}, ictax.admin.ch), which you look up and give in the dashboard (Your securities and accounts) or in the chat.`,
      `Sa valeur officielle selon la liste des cours de l’AFC (${terms.priceList}, ictax.admin.ch), que vous cherchez et indiquez dans le tableau de bord (Vos titres et comptes) ou dans la conversation.`,
    ),
    securities: (name) =>
      t(
        `${name} (securities list, ${terms.securitiesList})`,
        `${name} (état des titres, ${terms.securitiesList})`,
      ),
  };
}

/** What was given for a line with a limit, by the rule that set it: the gloss of each term. */
const GIVEN: Readonly<Record<string, readonly [string, string]>> = {
  commute: ['Travel costs', 'Frais de déplacement'],
  meals: ['Meals away from home', 'Repas hors du domicile'],
  'professional.other': [
    'Your actual other professional costs',
    'Vos autres frais professionnels effectifs',
  ],
  pillar3a: ['Paid into pillar 3a', 'Versé au 3e pilier A'],
  training: ['Training paid', 'Frais de formation payés'],
  debt_interest: ['Interest on private debts', 'Intérêts de dettes privées'],
  insurance: [
    'Insurance premiums and savings interest',
    'Primes d’assurances et intérêts d’épargne',
  ],
  party: ['Paid to political parties', 'Versé aux partis politiques'],
  childcare: ['Childcare paid', 'Frais de garde payés'],
  medical: ['Medical costs', 'Frais médicaux'],
  donations: ['Donations', 'Dons'],
};

/** The gloss in English and French with the official term, and the official term alone. */
const g = (en: string, fr: string, term: string): Text => ({
  en: `${en} (${term})`,
  fr: `${fr} (${term})`,
  de: term,
});

/**
 * The final check's words for a canton's own form (docs/design/cantons.md): its labels, the terms
 * of what was given, its two taxes, and its name and software from the registry.
 */
export function cantonCheckWords(canton: CantonEntry, terms: CantonTerms): FinalCheckCanton {
  const sw = canton.software;
  return {
    label: (code) => terms.label(code),
    given: (l: LimitApplied) => {
      const term = l.rule ? terms.given[l.rule] : undefined;
      const gloss = l.rule ? GIVEN[l.rule] : undefined;
      return term && gloss ? g(gloss[0], gloss[1], term) : undefined;
    },
    // The two taxes keep their own limits unless a rule applied alike: always say which tax.
    inBothTaxes: () => true,
    taxes: {
      icc: g('cantonal tax', 'impôt cantonal', terms.taxes.icc),
      ifd: g('federal tax', 'impôt fédéral', terms.taxes.ifd),
      both: g('cantonal and federal tax', 'impôts cantonal et fédéral', terms.taxes.both),
    },
    notSupported: {
      en: `Taxpresso can’t prepare this part. ${sw}, the canton’s free software, or a fiduciary can.`,
      fr: `Taxpresso ne peut pas préparer cette partie. ${sw}, le logiciel gratuit du canton, ou une fiduciaire le peuvent.`,
      de: `Taxpresso kann diesen Teil nicht vorbereiten. ${sw}, die kostenlose Software des Kantons, oder ein Treuhandbüro können das.`,
    },
    limitEstimate: {
      en: ' This limit is an estimate until its amount for the year is published.',
      fr: ` Cette limite est une estimation jusqu’à la publication de son montant pour l’année.`,
      de: ' Diese Grenze ist geschätzt, bis ihr Betrag für das Jahr veröffentlicht ist.',
    },
    documents: terms.documents,
  };
}

/** A fact as the final check shows it: its label, value, document and page. */
function pending(
  ws: Workspace,
  f: Fact,
  status: PendingValue['status'],
  final: Text,
): PendingValue {
  const def = ws.keys[f.key];
  const doc = f.source.docId ? ws.documents.find((d) => d.id === f.source.docId) : undefined;
  const code = (ws.canton().canton ?? CANTONS.GE).filing.lineOf(f.key, f.person);
  const v = f.value;
  const text: Text | undefined =
    typeof v === 'boolean'
      ? v
        ? t('yes', 'oui')
        : t('no', 'non')
      : typeof v === 'string'
        ? (ENUM_LABELS[f.key]?.[v] ?? t(v, v))
        : Array.isArray(v)
          ? t(v.join(', '), v.join(', '))
          : def?.type !== 'money'
            ? t(String(v), String(v))
            : undefined;
  return {
    id: f.id,
    status,
    label: def?.label ?? t(f.key, f.key),
    ...(code ? { code } : {}),
    person: f.person,
    ...(typeof v === 'number' && def?.type === 'money' ? { amount: v } : {}),
    ...(text ? { text } : {}),
    ...(doc ? { document: doc.filename } : {}),
    ...(f.source.page ? { page: f.source.page } : {}),
    final,
    ...(status === 'estimate' && f.source.method === 'user' && f.note?.trim()
      ? { bestFigure: f.note.trim() }
      : {}),
  };
}

/** Everything the final check reads, from the workspace. */
export function finalCheckInput(ws: Workspace): FinalCheckInput {
  const snap = ws.snapshot();
  const taxYear = ws.engine.taxYear;
  const estimate = ws.estimate();
  // Before the canton is known, the defaults: Geneva's.
  const canton = estimate.entry ?? CANTONS.GE;
  const terms = estimate.entry?.terms;
  const texts = terms ? cantonTexts(terms) : GENEVA_TEXTS;
  const { result, missing, notes } = estimate;
  const docs = ws.activeDocuments();
  const read = ws.toRead();

  // Values that are not final: those waiting for the user's OK, then the estimates the return
  // rests on (a planning figure only when the engine used it as the salary).
  const values: PendingValue[] = ws.toConfirm().map((f) => pending(ws, f, 'extracted', FINAL_OK));
  const lines = result && canton.view.allLines(result);
  const used = new Set((lines ?? []).flatMap((l) => l.facts ?? []));
  for (const f of ws.countedFacts()) {
    if (f.status !== 'estimate' || HOLDING_KEY.test(f.key)) continue;
    if (f.key.startsWith('plan.')) {
      if (f.key === 'plan.gross_salary' && used.has(f.id))
        values.push({
          ...pending(ws, f, 'estimate', texts.salary),
          code: canton.filing.salaryLine(f.person),
        });
      continue;
    }
    values.push(pending(ws, f, 'estimate', texts.document));
  }
  // The securities list, line by line (values waiting for the user's OK are listed above).
  const etat = holdings(ws);
  for (const l of etat.lines) {
    if (l.state !== 'estimate') continue;
    values.push({
      id: `etat:${l.id}`,
      status: 'estimate',
      label: texts.securities(l.name),
      amount: l.columns.taxableValue,
      final:
        l.valueBasis === 'broker'
          ? texts.officialValue
          : l.origin === 'you'
            ? FINAL_HOLDING
            : texts.document,
    });
  }
  for (const o of etat.other) {
    if (o.state !== 'estimate') continue;
    values.push({
      id: `etat:${o.id}`,
      status: 'estimate',
      label: t(o.name, o.name),
      ...(o.value !== undefined
        ? { amount: o.value }
        : o.flow !== undefined
          ? { amount: o.flow }
          : {}),
      final: o.origin === 'you' ? FINAL_HOLDING : texts.document,
    });
  }

  // The check of the official PDF: Geneva's declarations only, so far.
  let officialPdf: FinalCheckInput['officialPdf'] = { status: 'not_available' };
  if (canton.filing.checksPdf) {
    const pdf = declarationCheckView(ws, 'en');
    const file = pdf.document?.filename ?? '';
    officialPdf =
      pdf.status === 'checked' && pdf.check
        ? {
            status: 'checked',
            file,
            clear: pdf.check.clear,
            toFix: pdf.check.counts.toFix,
            notFinal: pdf.check.counts.notFinal,
          }
        : pdf.status === 'unreadable' || pdf.status === 'other_year'
          ? { status: pdf.status, file }
          : { status: pdf.status === 'checked' ? 'pending' : pdf.status };
  }
  const formNote = canton.filing.formNote(taxYear);
  return {
    ...shared(ws, snap, docs, read, values, etat),
    ...(terms ? { canton: cantonCheckWords(canton, terms) } : {}),
    result: result && { ...result, limits: result.limits ?? [] },
    missing,
    ledgerNotes: notes,
    officialPdf,
    // The form's order: the place of each line code on the official form.
    formOrder: canton.filing.formOrder(taxYear),
    ...(formNote ? { formNote } : {}),
  };
}

/** What the final check reads the same way in every canton. */
function shared(
  ws: Workspace,
  snap: ReturnType<Workspace['snapshot']>,
  docs: ReturnType<Workspace['activeDocuments']>,
  read: ReturnType<Workspace['toRead']>,
  values: PendingValue[],
  etat: ReturnType<typeof holdings>,
) {
  return {
    taxYear: ws.engine.taxYear,
    couple: snap.people.length > 1,
    notSupported: ws.engine.notSupported(snap).map((n) => n.what),
    questionsOpen: snap.slots.filter((s) => s.value === undefined).length,
    documents: {
      toRead: read.filter((d) => d.kind).length,
      toIdentify: docs.filter((d) => !d.kind).length,
      whose: docs.filter((d) => d.parse.method === BARCODE_PENDING).length,
    },
    requirements: ws.requirements().map((r) => ({
      id: r.id,
      label: r.label,
      reason: r.reason,
      person: r.person,
      optional: r.optional === true,
      status: r.status,
      have: r.have,
      need: 'count' in r.expects ? r.expects.count : 1,
      ...(r.source ? { source: r.source } : {}),
    })),
    checks: ws.checks(),
    values,
    holdingIssues: etat.issues.map((i) => ({
      severity: i.severity,
      text: i.text,
      ...(i.source ? { source: i.source } : {}),
    })),
  };
}

// ---- The dashboard's card, in the page's language ---------------------------------------------

export interface FinalCheckItemView {
  id: string;
  kind: FinalCheckItem['kind'];
  status?: FinalCheckItem['status'];
  code?: string;
  title: string;
  detail: string;
  todo?: string;
  list?: string[];
  /** For a value at or near a limit: where it stands and in which tax. */
  limit?: { position: string; tax: string; kind: string; estimate?: boolean };
  sources: { id: string; where: string; title?: string; url?: string }[];
}

export interface FinalCheckView {
  taxYear: number;
  verdict: FinalCheck['verdict'];
  fix: FinalCheckItemView[];
  know: FinalCheckItemView[];
  /** The near-limit margin: a share of the limit in basis points, at least `min` centimes. */
  margin: { shareBp: number; min: number };
  /** The official page to ask the tax office for more time to file. */
  moreTime?: string;
}

function itemView(i: FinalCheckItem, lang: Lang): FinalCheckItemView {
  return {
    id: i.id,
    kind: i.kind,
    ...(i.status ? { status: i.status } : {}),
    ...(i.code ? { code: i.code } : {}),
    title: i.title[lang],
    detail: i.detail[lang],
    ...(i.todo?.[lang] ? { todo: i.todo[lang] } : {}),
    ...(i.list?.length ? { list: i.list.map((x) => x[lang]) } : {}),
    ...(i.limit
      ? {
          limit: {
            position: i.limit.position,
            tax: i.limit.tax,
            kind: i.limit.kind,
            ...(i.limit.estimate ? { estimate: true } : {}),
          },
        }
      : {}),
    sources: i.sources.map((s) => ({
      id: s.id,
      where: s.where,
      ...(s.title ? { title: s.title } : {}),
      ...(s.url ? { url: s.url } : {}),
    })),
  };
}

export function finalCheckView(ws: Workspace, lang: Lang): FinalCheckView {
  const input = finalCheckInput(ws);
  const check = finalCheck(input);
  const terms = ws.canton().canton?.terms;
  const moreTime = check.fix.some((i) => i.kind === 'estimate')
    ? terms
      ? officialLinks(terms.moreTimeSource, terms.documents)[0]?.url
      : officialLinks(MORE_TIME)[0]?.url
    : undefined;
  return {
    taxYear: check.taxYear,
    verdict: check.verdict,
    fix: check.fix.map((i) => itemView(i, lang)),
    know: check.know.map((i) => itemView(i, lang)),
    margin: { ...check.margin },
    ...(moreTime ? { moreTime } : {}),
  };
}

// ---- For Claude: concise text (C6) ------------------------------------------------------------

const CHIP: Record<NonNullable<FinalCheckItem['status']>, string> = {
  needs_ok: 'Needs your OK',
  estimate: 'Estimate',
  missing: 'Missing',
  fix: 'Fix',
};

const cite = (s: FinalCheckItemView['sources'], titles: boolean) =>
  s.length
    ? ` [${s.map((x) => `${x.id} ${x.where}${titles && x.title ? ` (${x.title})` : ''}${x.url ? `: ${x.url}` : ''}`).join('; ')}]`
    : '';

/** `office`: the canton's tax office as its form names it, when it is not Geneva's AFC. */
export function finalCheckText(v: FinalCheckView, detail: boolean, office?: string): string {
  const out = [
    `Final check before filling in the official form (tax year ${v.taxYear}), re-run on the current values: ${v.verdict === 'ready' ? 'READY TO FILL IN' : 'NOT READY'}. Fix before filing: ${v.fix.length}. Good to know: ${v.know.length}.`,
  ];
  if (v.verdict === 'ready') {
    out.push(
      'Nothing blocks: tell the user they are ready to fill in the official form. Still go through "Good to know" with them first.',
    );
  } else {
    out.push(
      'Go through each item under "Fix before filing" with the user, in this order, before they fill in the official form; only say they are ready to fill in once final_check says so.',
    );
  }
  out.push(
    'Cite each rule by the document id, page and link given here, never from your own knowledge. The passages of the official documents are not bundled yet.',
  );
  if (v.fix.length) {
    out.push('Fix before filing:');
    v.fix.forEach((i, n) => {
      out.push(
        `${n + 1}. ${i.status ? `[${CHIP[i.status]}] ` : ''}${i.title}: ${i.detail}${i.todo ? ` To settle: ${i.todo}` : ''}${cite(i.sources, detail)}`,
      );
      for (const x of i.list ?? []) out.push(`   - ${x}`);
    });
    if (v.moreTime) {
      out.push(
        `If a document won't arrive in time, the user can ask ${office ? `the tax office (${office})` : 'the AFC'} for more time to file (official page: ${v.moreTime}); Taxpresso doesn't do it for them.`,
      );
    }
  }
  if (v.know.length) {
    out.push('Good to know (does not block):');
    for (const i of v.know) {
      out.push(`- ${i.title}: ${i.detail}${i.todo ? ` ${i.todo}` : ''}${cite(i.sources, detail)}`);
    }
  }
  if (detail) {
    out.push(
      `"Near" a limit means within ${v.margin.shareBp / 100} % of it, and at least CHF ${v.margin.min / 100}: Taxpresso's own choice of what to show, not a tax rule. A cap that cut an amount is always listed.`,
    );
  } else {
    out.push('detail: true adds the title of each official document.');
  }
  out.push(
    'Never give tax advice beyond these rules. The user fills in and transmits the declaration themselves; never press the transmit button.',
  );
  return out.join('\n');
}

const Source = z.object({
  id: z.string(),
  where: z.string(),
  title: z.string().optional(),
  url: z.string().optional(),
});
const Item = z.looseObject({
  id: z.string(),
  kind: z.string(),
  status: z.string().optional(),
  code: z.string().optional(),
  title: z.string(),
  detail: z.string(),
  todo: z.string().optional(),
  sources: z.array(Source),
});

export function registerFinalCheckTool(server: McpServer, given: Workspace | TaxYears): void {
  // The open year's workspace, taken once per call (./years.ts).
  const years = TaxYears.of(given);
  server.registerTool(
    'final_check',
    {
      title: 'Final check before filing',
      description:
        "Run before the user fills in the official form. Re-runs the tax engine and lists what to fix first (values needing the user's OK, estimates, open checks, missing documents, the PDF check) and what is good to know (values at or near a limit, each with its official source). Read-only.",
      inputSchema: z.object({
        detail: z
          .boolean()
          .optional()
          .describe('Also give the title of each official document cited. Default false.'),
      }),
      outputSchema: z.looseObject({
        taxYear: z.number().int(),
        verdict: z.enum(['ready', 'not_ready']),
        fix: z.array(Item),
        know: z.array(Item),
      }),
      annotations: {
        title: 'Final check before filing',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ detail }) => {
      const ws = years.current;
      await ws.ready();
      await declarationCheckReady(ws);
      const view = finalCheckView(ws, 'en');
      return {
        content: [
          {
            type: 'text',
            text: finalCheckText(view, detail === true, ws.canton().canton?.terms?.taxOffice),
          },
        ],
        structuredContent: { ...view },
      };
    },
  );
}
