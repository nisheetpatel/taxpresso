// The adaptive questionnaire (SPEC.md section 6). Answers are facts in the ledger (status
// "stated"); everything else here (which questions apply, what is still missing, what is not
// supported) is computed from the ledger and the vault documents, so chat and UI always agree.
import {
  formatMoneyPlain,
  invalidValue,
  parseMoney,
  type Fact,
  type FactSource,
  type FactValue,
  type KeyDef,
  type KeyRegistry,
  type Ledger,
  type Owner,
  type Person,
  type Requirement,
  type VaultDocument,
} from '@taxpresso/ledger';
import {
  NBSP,
  type Condition,
  type Question,
  type QuestionnaireFile,
  type Text,
} from './schema.js';

export type Lang = 'en' | 'fr';

export interface CommuneOption {
  slug: string;
  name: string;
}

/** One question for one person (or for the household). */
export interface Slot {
  id: string;
  question: Question;
  person: Owner;
  value?: FactValue;
  fact?: Fact;
  /**
   * A value read from a document (status "extracted", e.g. from last year's declaration) that the
   * user hasn't confirmed: shown with the question as a suggestion, never counted as an answer
   * (SPEC.md C7). Answering the question, with this value or another, replaces it.
   */
  suggested?: FactValue;
  suggestion?: Fact;
}

export interface Snapshot {
  people: Person[];
  /** Questions that apply, in order, with their current answers. */
  slots: Slot[];
  /** Effective answers: only those of questions that still apply. */
  answers: ReadonlyMap<string, FactValue>;
}

export interface RenderedQuestion {
  id: string;
  questionId: string;
  person: Owner;
  /** Whose question it is, when the household has two people. */
  who?: string;
  type: Question['type'];
  text: string;
  help?: string;
  explain?: string;
  /** An official page on the topic, in the user's language. */
  learnMore?: { url: string; label: string };
  options?: { value: string; label: string; notSupported: boolean }[];
  none?: string;
  min?: number;
  max?: number;
  value?: FactValue;
  /** Not an answer yet: a value read from a document, for the user to confirm or change. */
  suggested?: FactValue;
}

export class QuestionnaireError extends Error {}

const YES_NO: Record<Lang, [string, string]> = { en: ['Yes', 'No'], fr: ['Oui', 'Non'] };
const COUPLE = new Set(['married', 'registered_partnership']);
const slotKey = (key: string, owner: Owner) => `${key}|${owner}`;

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export class QuestionnaireEngine {
  readonly file: QuestionnaireFile;
  readonly keys: KeyRegistry;
  readonly communes: readonly CommuneOption[];

  constructor(file: QuestionnaireFile, keys: KeyRegistry, communes: readonly CommuneOption[]) {
    this.file = file;
    this.keys = keys;
    this.communes = communes;
    const problems = this.check();
    if (problems.length) throw new QuestionnaireError(problems.join('\n'));
  }

  get taxYear(): number {
    return this.file.taxYear;
  }

  /** Inconsistencies between the questionnaire and the key registry. Empty when all is well. */
  check(): string[] {
    const problems: string[] = [];
    const ids = new Set<string>();
    const keysSeen = new Set<string>();
    const KIND: Record<Question['type'], KeyDef['type']> = {
      choice: 'enum',
      commune: 'enum',
      yesno: 'boolean',
      number: 'integer',
      money: 'money',
      multi: 'enum_list',
    };
    const checkCondition = (c: Condition | undefined, where: string): void => {
      if (!c) return;
      if (c.key && !this.keys[c.key]) problems.push(`${where}: unknown key ${c.key}`);
      c.any?.forEach((x) => checkCondition(x, where));
      c.all?.forEach((x) => checkCondition(x, where));
    };
    for (const q of this.file.questions) {
      if (ids.has(q.id)) problems.push(`duplicate question id ${q.id}`);
      ids.add(q.id);
      if (keysSeen.has(q.key)) problems.push(`${q.id}: key ${q.key} is asked twice`);
      keysSeen.add(q.key);
      const def = this.keys[q.key];
      if (!def) {
        problems.push(`${q.id}: unknown key ${q.key}`);
        continue;
      }
      if (def.type !== KIND[q.type])
        problems.push(`${q.id}: ${q.type} needs a ${KIND[q.type]} key`);
      if (def.perPerson !== q.perPerson) problems.push(`${q.id}: perPerson differs from ${q.key}`);
      if (!q.perPerson && 'p1' in q.text)
        problems.push(`${q.id}: per-person text on a household question`);
      const values =
        q.type === 'commune'
          ? this.communes.map((c) => c.slug)
          : (q.options ?? []).map((o) => o.value);
      if (q.type === 'choice' || q.type === 'multi' || q.type === 'commune') {
        const expected = [...(def.values ?? [])].sort().join(',');
        if ([...values].sort().join(',') !== expected) {
          problems.push(`${q.id}: options must be exactly the values of ${q.key}`);
        }
      }
      checkCondition(q.when, q.id);
    }
    for (const r of this.file.requirements) {
      checkCondition(r.when, `requirement ${r.id}`);
      const count = r.expects.countKey;
      if (count && this.keys[count]?.type !== 'integer') {
        problems.push(`requirement ${r.id}: countKey ${count} must be an integer key`);
      }
    }
    return problems;
  }

  snapshot(ledger: Ledger): Snapshot {
    const answers = new Map<string, FactValue>();
    const people = (): Person[] =>
      COUPLE.has(String(answers.get(slotKey('profile.civil_status', 'household'))))
        ? ['p1', 'p2']
        : ['p1'];
    const slots: Slot[] = [];
    for (const question of this.file.questions) {
      const owners: Owner[] = question.perPerson ? people() : ['household'];
      for (const person of owners) {
        if (question.when && !this.#holds(question.when, person, answers, people())) continue;
        const stored = ledger.get(question.key, person);
        // An answer the key no longer accepts (an option that was replaced) is asked again.
        const def = this.keys[question.key];
        const fact = stored && def && invalidValue(def, stored.value) ? undefined : stored;
        // Read from a document and not confirmed yet: a suggestion, not an answer.
        const suggestion = fact?.status === 'extracted' ? fact : undefined;
        const answer = suggestion ? undefined : fact;
        const slot: Slot = {
          id: question.perPerson ? `${question.id}:${person}` : question.id,
          question,
          person,
          ...(answer ? { value: answer.value, fact: answer } : {}),
          ...(suggestion ? { suggested: suggestion.value, suggestion } : {}),
        };
        if (answer) answers.set(slotKey(question.key, person), answer.value);
        slots.push(slot);
      }
    }
    return { people: people(), slots, answers };
  }

  /** The next question: the first unanswered one, skipped ones last. */
  next(snapshot: Snapshot, skipped: readonly string[] = []): Slot | undefined {
    const open = snapshot.slots.filter((s) => s.value === undefined);
    return open.find((s) => !skipped.includes(s.id)) ?? open[0];
  }

  /** Stores an answer as a "stated" fact. The question must apply right now. */
  answer(ledger: Ledger, slotId: string, raw: unknown, source: FactSource): Fact {
    const slot = this.snapshot(ledger).slots.find((s) => s.id === slotId);
    if (!slot) throw new QuestionnaireError(`Question ${slotId} doesn't apply now.`);
    const value = this.#coerce(slot.question, raw);
    try {
      return ledger.append({
        key: slot.question.key,
        person: slot.person,
        value,
        status: 'stated',
        source,
      });
    } catch (err) {
      throw new QuestionnaireError((err as Error).message);
    }
  }

  /** What the "still missing" list shows, derived from the answers and the documents. */
  requirements(
    snapshot: Snapshot,
    documents: readonly VaultDocument[],
    waived: readonly string[] = [],
  ): Requirement[] {
    const out: Requirement[] = [];
    for (const def of this.file.requirements) {
      const owners: Owner[] = def.perPerson ? snapshot.people : ['household'];
      for (const person of owners) {
        if (def.when && !this.#holds(def.when, person, snapshot.answers, snapshot.people)) continue;
        const countKey = def.expects.countKey;
        const need = countKey
          ? Number(
              snapshot.answers.get(
                slotKey(countKey, this.keys[countKey]?.perPerson ? person : 'household'),
              ) ?? 0,
            )
          : 1;
        if (need <= 0) continue;
        const have = documents.filter(
          (d) =>
            d.kind !== undefined &&
            def.expects.kinds.includes(d.kind) &&
            (person === 'household' ||
              d.person === person ||
              d.person === 'household' ||
              (d.person === undefined && snapshot.people.length === 1)),
        ).length;
        const id = def.perPerson ? `${def.id}:${person}` : def.id;
        out.push({
          id,
          label: def.label,
          reason: def.reason,
          ...(def.explain ? { explain: def.explain } : {}),
          ...(def.learnMore ? { learnMore: def.learnMore } : {}),
          expects: { kinds: [...def.expects.kinds], count: need },
          person,
          status: have >= need ? 'satisfied' : waived.includes(id) ? 'waived' : 'missing',
          have: Math.min(have, need),
          ...(def.optional ? { optional: true } : {}),
          ...(def.source ? { source: def.source } : {}),
        });
      }
    }
    return out;
  }

  /** Answers that put the return outside what Taxpresso supports (SPEC.md section 1). */
  notSupported(snapshot: Snapshot): { slotId: string; what: Text }[] {
    const out: { slotId: string; what: Text }[] = [];
    for (const slot of snapshot.slots) {
      for (const option of this.#selected(slot)) {
        if (option.notSupported) out.push({ slotId: slot.id, what: option.notSupported });
      }
    }
    return out;
  }

  /** Short summaries of the answers, like the chips on screen 1. */
  chips(snapshot: Snapshot, lang: Lang): string[] {
    const chips: string[] = [];
    for (const slot of snapshot.slots) {
      if (slot.value === undefined) continue;
      const q = slot.question;
      let texts: string[] = [];
      if (q.type === 'commune') {
        texts = [this.#communeName(String(slot.value))];
      } else if (q.type === 'choice' || q.type === 'multi') {
        const selected = this.#selected(slot);
        const anyChips = (q.options ?? []).some((o) => o.chip);
        texts = selected.flatMap((o) =>
          o.chip ? [o.chip[lang]] : anyChips ? [] : [o.label[lang]],
        );
      } else if (q.type === 'yesno') {
        if (slot.value === true && q.chip && 'en' in q.chip) texts = [q.chip[lang]];
      } else if (q.type === 'number' && q.chip && 'one' in q.chip) {
        const n = Number(slot.value);
        const form = n === 0 ? q.chip.zero : n === 1 ? q.chip.one : q.chip.other;
        if (form) texts = [form[lang].replace('{n}', String(n))];
      }
      const prefix =
        slot.person === 'p2'
          ? `${this.file.people.p2Chip[lang]}${lang === 'fr' ? `${NBSP}: ` : ': '}`
          : '';
      chips.push(...texts.map((t) => prefix + t));
    }
    return chips;
  }

  render(slot: Slot, snapshot: Snapshot, lang: Lang): RenderedQuestion {
    const q = slot.question;
    const text = 'p1' in q.text ? q.text[slot.person === 'p2' ? 'p2' : 'p1'][lang] : q.text[lang];
    const options =
      q.type === 'commune'
        ? this.communes.map((c) => ({ value: c.slug, label: c.name, notSupported: false }))
        : q.type === 'yesno'
          ? [
              { value: 'yes', label: YES_NO[lang][0], notSupported: false },
              { value: 'no', label: YES_NO[lang][1], notSupported: false },
            ]
          : q.options?.map((o) => ({
              value: o.value,
              label: o.label[lang],
              notSupported: !!o.notSupported,
            }));
    return {
      id: slot.id,
      questionId: q.id,
      person: slot.person,
      ...(q.perPerson &&
      snapshot.people.length > 1 &&
      (slot.person === 'p1' || slot.person === 'p2')
        ? { who: this.file.people[slot.person][lang] }
        : {}),
      type: q.type,
      text,
      ...(q.help ? { help: q.help[lang] } : {}),
      ...(q.explain ? { explain: q.explain[lang] } : {}),
      ...(q.learnMore
        ? { learnMore: { url: q.learnMore.url, label: q.learnMore.label[lang] } }
        : {}),
      ...(options ? { options } : {}),
      ...(q.none ? { none: q.none[lang] } : {}),
      ...(q.min !== undefined ? { min: q.min } : {}),
      ...(q.max !== undefined ? { max: q.max } : {}),
      ...(slot.value !== undefined ? { value: slot.value } : {}),
      ...(slot.suggested !== undefined ? { suggested: slot.suggested } : {}),
    };
  }

  /** The answer of a slot in words (or another value of it, such as its suggestion). */
  describe(slot: Slot, lang: Lang, value: FactValue | undefined = slot.value): string {
    const q = slot.question;
    if (value === undefined) return '';
    if (q.type === 'commune') return this.#communeName(String(value));
    if (q.type === 'yesno') return YES_NO[lang][value ? 0 : 1];
    if (q.type === 'number') return String(value);
    if (q.type === 'money') return typeof value === 'number' ? chfText(value) : String(value);
    const labels = this.#selected(slot, value).map((o) => o.label[lang]);
    return labels.length ? labels.join(', ') : (q.none?.[lang] ?? '');
  }

  notSupportedMessage(lang: Lang): string {
    return this.file.notSupported[lang];
  }

  #selected(slot: Slot, value: FactValue | undefined = slot.value) {
    const values = Array.isArray(value) ? value : [String(value)];
    return (slot.question.options ?? []).filter(
      (o) => value !== undefined && values.includes(o.value),
    );
  }

  #communeName(slug: string): string {
    return this.communes.find((c) => c.slug === slug)?.name ?? slug;
  }

  #holds(
    c: Condition,
    person: Owner,
    answers: ReadonlyMap<string, FactValue>,
    people: Person[],
  ): boolean {
    if (c.any) return c.any.some((x) => this.#holds(x, person, answers, people));
    if (c.all) return c.all.every((x) => this.#holds(x, person, answers, people));
    const key = c.key!;
    const def = this.keys[key];
    if (!def) return false;
    const test = (v: FactValue | undefined): boolean => {
      if (v === undefined) return false;
      if (c.eq !== undefined && v !== c.eq) return false;
      if (c.in && !c.in.includes(String(v))) return false;
      if (c.includes !== undefined && !(Array.isArray(v) && v.includes(c.includes))) return false;
      if (c.includesAny && !(Array.isArray(v) && c.includesAny.some((x) => v.includes(x))))
        return false;
      if (c.gt !== undefined && !(typeof v === 'number' && v > c.gt)) return false;
      if (c.is !== undefined && v !== c.is) return false;
      return true;
    };
    if (!def.perPerson) return test(answers.get(slotKey(key, 'household')));
    if (c.anyPerson || person === 'household') {
      return people.some((p) => test(answers.get(slotKey(key, p))));
    }
    return test(answers.get(slotKey(key, person)));
  }

  #coerce(q: Question, raw: unknown): FactValue {
    const bad = (why: string): never => {
      throw new QuestionnaireError(`${q.id}: ${why}`);
    };
    const option = (input: unknown): string => {
      if (typeof input !== 'string') return bad('expected one of the options');
      const values = (q.options ?? []).map((o) => o.value);
      if (values.includes(input)) return input;
      const f = fold(input);
      const byLabel = (q.options ?? []).find(
        (o) => fold(o.label.en) === f || fold(o.label.fr) === f,
      );
      return byLabel?.value ?? bad(`"${input}" is not one of ${values.join(', ')}`);
    };
    switch (q.type) {
      case 'choice':
        return option(raw);
      case 'multi': {
        const list = Array.isArray(raw)
          ? raw
          : raw === undefined || raw === null || raw === ''
            ? []
            : [raw];
        return [...new Set(list.map(option))];
      }
      case 'commune': {
        if (typeof raw !== 'string') return bad('expected a commune');
        const f = fold(raw.replace(/^(ville de|commune de|le|la)\s+/i, ''));
        const hit = this.communes.find((c) => c.slug === raw || fold(c.name) === f);
        return hit?.slug ?? bad(`"${raw}" is not a Geneva commune`);
      }
      case 'yesno': {
        if (typeof raw === 'boolean') return raw;
        const f = fold(String(raw));
        if (['yes', 'oui', 'true', 'y'].includes(f)) return true;
        if (['no', 'non', 'false', 'n'].includes(f)) return false;
        return bad('expected yes or no');
      }
      case 'number': {
        const n =
          typeof raw === 'number'
            ? raw
            : typeof raw === 'string' && raw.trim() !== ''
              ? Number(raw)
              : NaN;
        if (!Number.isInteger(n)) return bad('expected a whole number');
        if ((q.min !== undefined && n < q.min) || (q.max !== undefined && n > q.max)) {
          return bad(`expected a number from ${q.min} to ${q.max}`);
        }
        return n;
      }
      case 'money': {
        // Francs as a number (790, 790.5) or as text ("1'250.50", "CHF 790"), never via floats:
        // the text is read digit by digit into centimes.
        const text =
          typeof raw === 'number' && Number.isFinite(raw)
            ? String(raw)
            : typeof raw === 'string'
              ? raw
              : '';
        const parsed = parseMoney(text);
        if (!parsed.ok)
          return bad(`expected an amount in CHF, e.g. 790 or 1'250.50 (${parsed.reason})`);
        if (parsed.value < 0) return bad('expected an amount of zero or more');
        const max = this.keys[q.key]?.max;
        if (max !== undefined && parsed.value > max) return bad(`expected at most ${chfText(max)}`);
        return parsed.value;
      }
    }
  }
}

/** "CHF 1250.50": centimes as the form writes them, with the currency. */
const chfText = (centimes: number) => `CHF ${formatMoneyPlain(centimes)}`;
