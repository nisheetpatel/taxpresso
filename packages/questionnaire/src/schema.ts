// The shape of a questionnaire file (data/ge/<year>/questionnaire.yaml), checked when it loads.
import { DOCUMENT_KINDS } from '@taxpresso/ledger';
import * as z from 'zod/v4';

export const Text = z.object({ en: z.string().min(1), fr: z.string().min(1) });
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

const Option = z
  .object({
    value: z.string(),
    label: Text,
    chip: Text.optional(),
    notSupported: Text.optional(),
  })
  .strict();

export const Question = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    key: z.string(),
    /** money: an amount in CHF, stored as centimes (SPEC.md section 4). */
    type: z.enum(['choice', 'yesno', 'number', 'money', 'multi', 'commune']),
    perPerson: z.boolean().default(false),
    when: Condition.optional(),
    text: z.union([Text, PerPersonText]),
    help: Text.optional(),
    /** Plain-language "what is this?", shown on hover and given to Claude. */
    explain: Text.optional(),
    learnMore: LearnMore.optional(),
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
    people: z.object({ p1: Text, p2: Text, p2Chip: Text }),
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

/** Validates a parsed questionnaire file and applies French typography to every French text. */
export function parseQuestionnaire(raw: unknown): QuestionnaireFile {
  const file = QuestionnaireFile.parse(raw);
  const fix = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(fix);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.fr === 'string' && typeof o.en === 'string') o.fr = frenchSpacing(o.fr);
      Object.values(o).forEach(fix);
    }
  };
  fix(file);
  return file;
}
