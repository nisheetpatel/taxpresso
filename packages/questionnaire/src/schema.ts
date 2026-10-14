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
  /**
   * An answer's key; or a household money key no question asks (a document's amount, such as
   * `childcare.costs`), which stands for what the ledger holds for it, added up.
   */
  key?: string;
  eq?: string | number | boolean;
  in?: string[];
  includes?: string;
  includesAny?: string[];
  gt?: number;
  is?: boolean;
  /** For a per-person key: true if it holds for anyone in the household. */
  anyPerson?: boolean;
  /** The question being asked is this person's (alone, or with other conditions in any/all). */
  person?: 'p1' | 'p2';
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
      person: z.enum(['p1', 'p2']).optional(),
      any: z.array(Condition).optional(),
      all: z.array(Condition).optional(),
    })
    .strict()
    .refine(
      (c) => (c.any || c.all ? !c.key && !c.person : !!c.key !== !!c.person),
      'a condition needs a key, a person, or any/all',
    ),
);

/**
 * A rule that answers a question from the other answers, when the law settles it: the first rule
 * whose condition holds gives the value, which is never asked (and the user can't answer over
 * it). No rule holds: the question is asked. `because` says it in plain words, `source` cites
 * the law or the official document (manifest id and article or page).
 */
export const Derivation = z
  .object({
    when: Condition,
    value: z.union([z.string(), z.number(), z.boolean()]),
    because: Text,
    source: z.string().min(1),
  })
  .strict();
export type Derivation = z.infer<typeof Derivation>;

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
  'fr.ch', // www.fr.ch (Fribourg's guide, tariffs, FriTax and tax pages), bdlf.fr.ch (laws)
  'ti.ch', // www4.ti.ch (instructions, forms, multipliers, eTax PF), m3.ti.ch (laws), m4.ti.ch
  'ag.ch', // www.ag.ch (guide, lists, leaflets), gesetzessammlungen.ag.ch (laws)
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
    /** Answers taken from the other answers where the law settles them (see Derivation). */
    derive: z.array(Derivation).optional(),
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
    /**
     * The tax year the questions are for. A file can serve several years (`taxYears` in the YAML):
     * it is then read once per year, its texts naming that year ({year}) and citing that year's
     * documents (docs/design/tax-years.md).
     */
    taxYear: z.number().int(),
    /** The canton the file is for, in words: "Geneva" in "not a Geneva commune". */
    place: Text.optional(),
    /**
     * For a canton Taxpresso doesn't prepare for the year: what the canton question says it is,
     * with {canton} and {year} (the shared file's).
     */
    notOffered: Text.optional(),
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
  // The years the canton's file serves: its own, or the shared file's when it gives none.
  const years =
    file.taxYears !== undefined || file.taxYear !== undefined
      ? { ...pickYears(file) }
      : { ...pickYears(base) };
  return {
    ...years,
    ...(file.place ? { place: file.place } : {}),
    ...((file.notOffered ?? base.notOffered)
      ? { notOffered: file.notOffered ?? base.notOffered }
      : {}),
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

/** `taxYear`, or `taxYears`, of a raw file: what it says about the years it serves. */
function pickYears(file: Entry): { taxYear?: unknown; taxYears?: unknown } {
  return {
    ...(file.taxYear !== undefined ? { taxYear: file.taxYear } : {}),
    ...(file.taxYears !== undefined ? { taxYears: file.taxYears } : {}),
  };
}

export class QuestionnaireYearError extends Error {}

/**
 * The tax years a questionnaire file serves (`taxYears: [2025, 2026]`, or its one `taxYear`),
 * with the shared file's when a canton's file gives none. Newest last.
 */
export function servedYears(raw: unknown, shared?: unknown): number[] {
  const own = raw && typeof raw === 'object' ? pickYears(raw as Entry) : {};
  const from =
    own.taxYear !== undefined || own.taxYears !== undefined
      ? own
      : shared && typeof shared === 'object'
        ? pickYears(shared as Entry)
        : {};
  const list = Array.isArray(from.taxYears) ? from.taxYears : [from.taxYear];
  return list.filter((y): y is number => Number.isInteger(y)).sort((a, b) => a - b);
}

/** The manifest ids a source names ("ge-2025-guide-declaration-pp p. 8"), by their tax year. */
const ID_YEAR = /\b[a-z]{2,9}-(\d{4})-[a-z0-9]/g;

/** The tax year of a citation's document; undefined for one without a year (a law, a web page). */
function citedYear(c: unknown): number | undefined {
  if (typeof c === 'string') {
    const years = [...c.matchAll(ID_YEAR)].map((m) => Number(m[1]));
    return years.length ? Math.max(...years) : undefined;
  }
  if (c && typeof c === 'object' && typeof (c as Entry).year === 'number') {
    return (c as Entry).year as number;
  }
  return undefined;
}

/**
 * For tax year `year`, the citation that fits among those given (one, or a list): the one whose
 * document is of the latest year up to `year` (the year's own, or the latest published before it);
 * one without a year (a law, a web page) when no dated one fits. None fits: undefined, never a
 * document of a later year. A learnMore's `year` is only for this choice and is dropped.
 */
export function citationFor(given: unknown, year: number): unknown {
  const list = Array.isArray(given) ? given : [given];
  let best: { c: unknown; y: number } | undefined;
  let undated: unknown;
  for (const c of list) {
    const y = citedYear(c);
    if (y === undefined) undated ??= c;
    else if (y <= year && (!best || y > best.y)) best = { c, y };
  }
  const chosen = best?.c ?? undated;
  if (chosen && typeof chosen === 'object') {
    const rest: Entry = { ...(chosen as Entry) };
    delete rest.year;
    return rest;
  }
  return chosen;
}

/**
 * The questions and documents of a file with the citations of one tax year, and the help or
 * explanation of that year where a text holds for some years only (a list, each with its `year`).
 */
function citationsOf(file: Entry, year: number): Entry {
  const each = (list: unknown) =>
    Array.isArray(list)
      ? list.map((item: Entry) => {
          if (!item || typeof item !== 'object') return item;
          const out: Entry = { ...item };
          for (const field of ['learnMore', 'source', 'help', 'explain']) {
            if (!(field in out)) continue;
            const c = citationFor(out[field], year);
            if (c === undefined) delete out[field];
            else out[field] = c;
          }
          return out;
        })
      : list;
  return { ...file, questions: each(file.questions), requirements: each(file.requirements) };
}

/** The canton question: its options for cantons not offered this year say so (not supported). */
function markNotOffered(file: QuestionnaireFile, offered: readonly string[]): void {
  const q = file.questions.find((x) => x.key === 'profile.canton');
  const template = file.notOffered;
  if (!q?.options || !template) return;
  for (const o of q.options) {
    if (o.value === 'other' || o.notSupported || offered.includes(o.value)) continue;
    const name = o.chip ?? o.label;
    const fill = (lang: 'en' | 'fr' | 'de' | 'it') =>
      (lang === 'de' || lang === 'it' ? (template[lang] ?? template.en) : template[lang])
        .replaceAll(
          '{canton}',
          lang === 'de' || lang === 'it' ? (name[lang] ?? name.en) : name[lang],
        )
        .replaceAll('{year}', String(file.taxYear));
    o.notSupported = {
      en: fill('en'),
      fr: fill('fr'),
      ...(template.de ? { de: fill('de') } : {}),
      ...(template.it ? { it: fill('it') } : {}),
    };
  }
}

export interface QuestionnaireOptions {
  /** The tax year to read the file for; default its latest. */
  taxYear?: number;
  /**
   * The cantons Taxpresso prepares for that year (the canton question's values): the others say
   * they are not available for the year. Default: every option the file offers.
   */
  offered?: readonly string[];
}

/**
 * Validates a questionnaire file for one tax year: the citations of that year (citationFor), the
 * year where a text says {year} ({prevYear}, {nextYear}), the cantons Taxpresso covers where a text
 * says {cantons} or {cantonsOr}, and French typography in every French text. `shared` is the
 * questionnaire every canton shares (data/ch/<year>/questions.yaml), when the file takes from it.
 * A year the file doesn't serve fails (QuestionnaireYearError).
 */
export function parseQuestionnaire(
  raw: unknown,
  shared?: unknown,
  options: QuestionnaireOptions = {},
): QuestionnaireFile {
  const years = servedYears(raw, shared);
  const year = options.taxYear ?? years.at(-1);
  if (year === undefined || !years.includes(year)) {
    throw new QuestionnaireYearError(
      `This questionnaire is for ${years.join(' and ') || 'no year'}, not ${year ?? 'no year'}.`,
    );
  }
  const resolved = (shared === undefined ? raw : resolveShared(raw, shared)) as Entry;
  const rest = citationsOf(resolved, year);
  delete rest.taxYears;
  const file = QuestionnaireFile.parse({ ...rest, taxYear: year });
  if (options.offered) markNotOffered(file, options.offered);
  const lists = cantonLists(file);
  const yearWords: Record<string, string> = {
    '{year}': String(year),
    '{prevYear}': String(year - 1),
    '{nextYear}': String(year + 1),
  };
  const fill = (s: string, lang: 'en' | 'fr' | 'de' | 'it') =>
    (lists ? s.replace(/\{cantons(Or)?\}/g, (m) => lists[m]?.[lang] ?? m) : s).replace(
      /\{(year|prevYear|nextYear)\}/g,
      (m) => yearWords[m]!,
    );
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
