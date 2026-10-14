// The shape of a questionnaire file (data/<canton>/<year>/questionnaire.yaml), checked when it
// loads. The questions every canton asks are written once (data/ch/<year>/questions.yaml); a
// canton's file takes one with `use: <id>`, and may replace any of its fields (a canton's own
// explanation, its official page), which keeps each canton's questions in its own order.
import { DOCUMENT_KINDS } from '@taxpresso/ledger';
import * as z from 'zod/v4';

/** Plain words in English and French; German and Italian where the file gives them. */
export const Text = z.object({
  en: z.string().min(1),
  fr: z.string().min(1),
  de: z.string().min(1).optional(),
  it: z.string().min(1).optional(),
});
export type Text = z.infer<typeof Text>;

const PerPersonText = z.object({ p1: Text, p2: Text });
const Plural = z.object({ zero: Text.optional(), one: Text, other: Text });

export interface Condition {
  key?: string;
  eq?: string | number | boolean;
  in?: string[];
  includes?: string;
  includesAny?: string[];
  gt?: number;
  is?: boolean;
  /** For a per-person key: true if it holds for anyone in the household. */
  anyPerson?: boolean;
  any?: Condition[];
  all?: Condition[];
}

export const Condition: z.ZodType<Condition> = z.lazy(() =>
  z
    .object({
      key: z.string().optional(),
      eq: z.union([z.string(), z.number(), z.boolean()]).optional(),
      in: z.array(z.string()).optional(),
      includes: z.string().optional(),
      includesAny: z.array(z.string()).optional(),
      gt: z.number().optional(),
      is: z.boolean().optional(),
      anyPerson: z.boolean().optional(),
      any: z.array(Condition).optional(),
      all: z.array(Condition).optional(),
    })
    .strict()
    .refine((c) => (c.any || c.all ? !c.key : !!c.key), 'a condition needs a key, or any/all'),
);

/** Government sites whose pages are listed in docs/sources/<canton>/manifest.json (each opened and checked). */
export const OFFICIAL_HOSTS = [
  'ge.ch',
  'getax.ch',
  'silgeneve.ch',
  'zh.ch', // www.zh.ch, notes.zh.ch (ZH-Lex)
  'be.ch', // www.sv.fin.be.ch (guides, TaxInfo), www.fin.be.ch, www.belex.sites.be.ch (BELEX)
  'baselland.ch', // www.baselland.ch, kanton.baselland.ch (Steuerbuch)
  'bl.ch', // statistik.bl.ch (communal and church tax rates), bl.clex.ch (laws)
  'bl-api.webcloud7.ch', // the file host of baselland.ch: Basel-Landschaft's guides and forms
  'vd.ch', // www.vd.ch (guide, forms, tables), prestations.vd.ch (BLV, VaudTax)
  'bs.ch', // www.bs.ch, media.bs.ch (guides, forms), www.gesetzessammlung.bs.ch (laws)
  'zg.ch', // zg.ch (eTax.zug), cdn.zg.ch (Zug's guides and tables), bgs.zg.ch (laws)
  'lu.ch', // steuern.lu.ch (Lucerne's guides, tables and leaflets), srl.lu.ch (laws), steuerbuch.lu.ch
  'sg.ch', // www.sg.ch (guide, forms, tables, Steuerbuch, E-Tax SG), www.gesetzessammlung.sg.ch (laws)
  'ch.ch',
  'admin.ch', // estv.admin.ch, fedlex.admin.ch, bsv.admin.ch
] as const;

const isOfficialPage = (raw: string): boolean => {
  if (!URL.canParse(raw)) return false;
  const url = new URL(raw);
  return (
    url.protocol === 'https:' &&
    !url.search && // no tracking or other parameters
    !url.username &&
    OFFICIAL_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`)) &&
    (!url.hash || /^#page=\d+$/.test(url.hash)) // a PDF can open at its page
  );
};

/**
 * An official page that explains the topic, chosen from docs/sources/<canton>/manifest.json. The
 * dashboard shows it as "Official page" next to the explanation, and Claude can point to it.
 */
export const LearnMore = z
  .object({
    url: z.url().refine(isOfficialPage, 'learnMore.url must be an official https page'),
    label: Text,
  })
  .strict();
export type LearnMore = z.infer<typeof LearnMore>;

/** The project's own pages: the votes for the next cantons and languages (README.md). */
const PROJECT = 'https://github.com/nisheetpatel/taxpresso/';

/**
 * A page of the Taxpresso project itself (not an official one), such as the vote for the next
 * canton. Only the project's own GitHub pages, without parameters.
 */
export const ProjectLink = z
  .object({
    url: z
      .url()
      .refine(
        (u) => u.startsWith(PROJECT) && URL.canParse(u) && !new URL(u).search && !new URL(u).hash,
        'link.url must be a page of the Taxpresso project on GitHub',
      ),
    label: Text,
  })
  .strict();
export type ProjectLink = z.infer<typeof ProjectLink>;

const Option = z
  .object({
    value: z.string(),
    label: Text,
    chip: Text.optional(),
    notSupported: Text.optional(),
    /** Offered only when this holds (a commune's own parishes): the other options are hidden. */
    when: Condition.optional(),
  })
  .strict();

export const Question = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    key: z.string(),
    /** money: an amount in CHF, stored as centimes (SPEC.md section 4). */
    type: z.enum(['choice', 'yesno', 'number', 'money', 'multi', 'commune']),
    perPerson: z.boolean().default(false),
    /**
     * Asked once per child of the household (child1, child2...: profile.children_count), on a key
     * that is per person; `{n}` in its texts is the child's number.
     */
    perChild: z.boolean().optional(),
    when: Condition.optional(),
    text: z.union([Text, PerPersonText]),
    help: Text.optional(),
    /** Plain-language "what is this?", shown on hover and given to Claude. */
    explain: Text.optional(),
    learnMore: LearnMore.optional(),
    /** A page of the project, e.g. where to vote for the next canton. */
    link: ProjectLink.optional(),
    /** A yes/no question whose "yes" puts the return outside what Taxpresso supports: what it is. */
    yesNotSupported: Text.optional(),
    options: z.array(Option).optional(),
    none: Text.optional(),
    min: z.number().int().optional(),
    max: z.number().int().optional(),
    chip: z.union([Plural, Text]).optional(),
  })
  .strict();
export type Question = z.infer<typeof Question>;

export const RequirementDef = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    perPerson: z.boolean().default(false),
    optional: z.boolean().default(false),
    when: Condition.optional(),
    expects: z.object({
      kinds: z.array(z.enum(DOCUMENT_KINDS)).min(1),
      countKey: z.string().optional(),
    }),
    label: Text,
    reason: Text,
    explain: Text.optional(),
    learnMore: LearnMore.optional(),
    source: z.string().optional(),
  })
  .strict();
export type RequirementDef = z.infer<typeof RequirementDef>;

export const QuestionnaireFile = z
  .object({
    taxYear: z.number().int(),
    /** The canton the file is for, in words: "Geneva" in "not a Geneva commune". */
    place: Text.optional(),
    people: z.object({
      p1: Text,
      p2: Text,
      p2Chip: Text,
      /** A child, for questions asked per child: "Child {n}". */
      child: Text.optional(),
    }),
    notSupported: Text,
    questions: z.array(Question).min(1),
    requirements: z.array(RequirementDef),
  })
  .strict();
export type QuestionnaireFile = z.infer<typeof QuestionnaireFile>;

/** U+00A0, written as a code so no formatter turns it into an invisible character. */
export const NBSP = String.fromCharCode(0xa0);

/** French typography: non-breaking space before ? ! : ; and inside « ». */
export function frenchSpacing(s: string): string {
  return s.replace(/ ([?!:;»])/g, `${NBSP}$1`).replace(/« /g, `«${NBSP}`);
}

type Entry = Record<string, unknown>;

/**
 * A canton's file with the shared questions and documents it takes (`use: <id>`) written out: the
 * shared definition, then the canton's own fields over it. The people and the "not supported"
 * message come from the shared file when the canton's file has none.
 */
export function resolveShared(raw: unknown, shared: unknown): unknown {
  if (!raw || typeof raw !== 'object' || !shared || typeof shared !== 'object') return raw;
  const file = raw as Entry;
  const base = shared as Entry;
  const take = (list: unknown, from: unknown, what: string): unknown => {
    if (!Array.isArray(list)) return list;
    const pool = Array.isArray(from) ? (from as Entry[]) : [];
    return list.map((item: Entry) => {
      if (!item || typeof item !== 'object' || !('use' in item)) return item;
      const { use, ...over } = item;
      const def = pool.find((x) => x.id === use);
      if (!def) throw new Error(`${what} ${String(use)} is not in the shared questionnaire`);
      return { ...def, ...over };
    });
  };
  return {
    taxYear: file.taxYear ?? base.taxYear,
    ...(file.place ? { place: file.place } : {}),
    people: file.people ?? base.people,
    notSupported: file.notSupported ?? base.notSupported,
    questions: take(file.questions, base.questions, 'question'),
    requirements: take(file.requirements, base.requirements, 'requirement'),
  };
}

/** The words that join the last two names of a list, by language. */
const JOIN = {
  and: { en: 'and', fr: 'et', de: 'und', it: 'e' },
  or: { en: 'or', fr: 'ou', de: 'oder', it: 'o' },
} as const;

/**
 * The cantons Taxpresso prepares returns for, in words, from the canton question's own options
 * (those it supports, by their short name): "{cantons}" is "Geneva, Zurich and Bern", "{cantonsOr}"
 * "Geneva, Zurich or Bern". The options are the canton keys' values (SUPPORTED_CANTONS, a test
 * checks), so a canton added there is named everywhere without editing any sentence.
 */
function cantonLists(file: QuestionnaireFile): Record<string, Text> | undefined {
  const q = file.questions.find((x) => x.key === 'profile.canton');
  if (!q?.options) return undefined;
  const names = q.options.filter((o) => !o.notSupported).map((o) => o.chip ?? o.label);
  const list = (lang: 'en' | 'fr' | 'de' | 'it', join: keyof typeof JOIN) => {
    const words = names.map((n) => (lang === 'de' || lang === 'it' ? (n[lang] ?? n.en) : n[lang]));
    return words.length > 1
      ? `${words.slice(0, -1).join(', ')} ${JOIN[join][lang]} ${words.at(-1)}`
      : words.join('');
  };
  const text = (join: keyof typeof JOIN): Text => ({
    en: list('en', join),
    fr: list('fr', join),
    de: list('de', join),
    it: list('it', join),
  });
  return { '{cantons}': text('and'), '{cantonsOr}': text('or') };
}

/**
 * Validates a questionnaire file, names the cantons Taxpresso covers where a text says
 * {cantons} or {cantonsOr}, and applies French typography to every French text. `shared` is the
 * questionnaire every canton shares (data/ch/<year>/questions.yaml), when the file takes from it.
 */
export function parseQuestionnaire(raw: unknown, shared?: unknown): QuestionnaireFile {
  const file = QuestionnaireFile.parse(shared === undefined ? raw : resolveShared(raw, shared));
  const lists = cantonLists(file);
  const fill = (s: string, lang: 'en' | 'fr' | 'de' | 'it') =>
    lists ? s.replace(/\{cantons(Or)?\}/g, (m) => lists[m]?.[lang] ?? m) : s;
  const fix = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(fix);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.fr === 'string' && typeof o.en === 'string') {
        o.en = fill(o.en, 'en');
        o.fr = frenchSpacing(fill(o.fr, 'fr'));
        if (typeof o.de === 'string') o.de = fill(o.de, 'de');
        if (typeof o.it === 'string') o.it = fill(o.it, 'it');
      }
      Object.values(o).forEach(fix);
    }
  };
  fix(file);
  return file;
}
