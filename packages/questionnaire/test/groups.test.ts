// Every question in every questionnaire file under data/ has a group: where the dashboard's pages
// ask it (docs/design/three-pages.md, section 3). A canton's `use:` takes the shared question's
// group unless it gives its own. The examples of the design note's table hold in every canton
// that asks the question.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  agQuestionnaire2026,
  beQuestionnaire2026,
  blQuestionnaire2026,
  bsQuestionnaire2026,
  frQuestionnaire2026,
  geQuestionnaire,
  GE_QUESTIONNAIRE_YEARS,
  luQuestionnaire2026,
  QUESTION_GROUPS,
  resolveShared,
  parseQuestionnaire,
  sgQuestionnaire2026,
  sharedQuestionnaire2026,
  tiQuestionnaire2026,
  vdQuestionnaire2026,
  zgQuestionnaire2026,
  zhQuestionnaire2026,
  type QuestionnaireFile,
} from '../src/index.js';

const DATA = fileURLToPath(new URL('../../../data/', import.meta.url));
const FILES = (readdirSync(DATA, { recursive: true }) as string[])
  .map((f) => f.replaceAll('\\', '/'))
  .filter((f) => /(^|\/)(questionnaire|questions)\.yaml$/.test(f))
  .sort();

type Entry = { id?: string; use?: string; group?: unknown };
const questionsOf = (file: string) =>
  (parse(readFileSync(DATA + file, 'utf8')) as { questions?: Entry[] }).questions ?? [];
const SHARED = new Map(questionsOf('ch/2026/questions.yaml').map((q) => [q.id, q]));
const isGroup = (g: unknown) => (QUESTION_GROUPS as readonly unknown[]).includes(g);

const RESOLVED: Record<string, QuestionnaireFile> = {
  shared: sharedQuestionnaire2026(),
  ...Object.fromEntries(GE_QUESTIONNAIRE_YEARS.map((y) => [`GE ${y}`, geQuestionnaire(y)])),
  ZH: zhQuestionnaire2026(),
  BE: beQuestionnaire2026(),
  BL: blQuestionnaire2026(),
  VD: vdQuestionnaire2026(),
  BS: bsQuestionnaire2026(),
  ZG: zgQuestionnaire2026(),
  LU: luQuestionnaire2026(),
  SG: sgQuestionnaire2026(),
  FR: frQuestionnaire2026(),
  TI: tiQuestionnaire2026(),
  AG: agQuestionnaire2026(),
};

/** The design note's table: each example question and its group. */
const TABLE: Record<string, string> = {
  canton: 'basics',
  civil_status: 'basics',
  children: 'basics',
  commune: 'basics',
  income_sources: 'basics',
  residence: 'basics',
  employer_in_switzerland: 'basics',
  tou: 'basics',
  moved: 'special',
  arrival_date: 'special',
  departure_date: 'special',
  business_form: 'special',
  swiss_property: 'special',
  abroad_property: 'special',
  pension_capital: 'special',
  commute: 'deduction',
  commute_transit_cost: 'deduction',
  meal_days: 'deduction',
  childcare: 'deduction',
  child_care: 'deduction',
  payments: 'deduction',
  pillar3a: 'plan',
  lpp_buyin: 'plan',
  employers: 'detail',
  banks: 'detail',
  crypto: 'detail',
  children_custody: 'detail',
  child_support: 'detail',
  lives_with_other_parent: 'detail',
};

describe('question groups', () => {
  it('finds the shared questions and every canton’s questionnaire', () => {
    expect(FILES).toContain('ch/2026/questions.yaml');
    expect(FILES.length).toBe(Object.keys(RESOLVED).length - GE_QUESTIONNAIRE_YEARS.length + 1);
  });

  it('gives every question in every file a valid group, or takes the shared one’s', () => {
    const wrong = FILES.flatMap((file) =>
      questionsOf(file).flatMap((q) => {
        if (q.use !== undefined) {
          const group = 'group' in q ? q.group : SHARED.get(q.use)?.group;
          return isGroup(group) ? [] : [`${file} use ${q.use}: ${String(group)}`];
        }
        return isGroup(q.group) ? [] : [`${file} ${q.id}: ${String(q.group)}`];
      }),
    );
    expect(wrong).toEqual([]);
  });

  it('keeps a group on every question each canton asks, for every year it serves', () => {
    for (const [name, file] of Object.entries(RESOLVED)) {
      for (const q of file.questions) expect(isGroup(q.group), `${name} ${q.id}`).toBe(true);
    }
  });

  it('puts the design note’s examples where it says, in every canton that asks them', () => {
    const wrong: string[] = [];
    for (const [name, file] of Object.entries(RESOLVED)) {
      for (const q of file.questions) {
        const want = TABLE[q.id];
        if (want && q.group !== want) wrong.push(`${name} ${q.id}: ${q.group}, not ${want}`);
      }
    }
    expect(wrong).toEqual([]);
    // Each group has questions in Geneva's questionnaire.
    const geneva = new Set(geQuestionnaire(2026).questions.map((q) => q.group));
    expect([...geneva].sort()).toEqual([...QUESTION_GROUPS].sort());
  });

  it('lets a canton give a shared question a group of its own, and refuses a question without one', () => {
    const text = { en: 'A?', fr: 'A ?' };
    const people = { p1: text, p2: text, p2Chip: text };
    const shared = {
      taxYear: 2026,
      questions: [{ id: 'a', key: 'k', group: 'detail', type: 'yesno', text }],
    };
    const own = { people, notSupported: text, requirements: [] };
    const inherited = resolveShared({ ...own, questions: [{ use: 'a' }] }, shared) as {
      questions: Entry[];
    };
    expect(inherited.questions[0]?.group).toBe('detail');
    const replaced = parseQuestionnaire(
      { ...own, questions: [{ use: 'a', group: 'basics' }] },
      shared,
    );
    expect(replaced.questions[0]?.group).toBe('basics');
    const none = { taxYear: 2026, questions: [{ id: 'a', key: 'k', type: 'yesno', text }] };
    expect(() => parseQuestionnaire({ ...own, questions: [{ use: 'a' }] }, none)).toThrow();
    expect(() =>
      parseQuestionnaire({ ...own, questions: [{ use: 'a', group: 'later' }] }, shared),
    ).toThrow();
  });
});
