// "Your tax" (three-pages.md, A3 and A4): the number, then "Make it exact" (the documents that
// would make it exact, and what each file turned out to be), a few more questions one at a time,
// and "Anything special this year?". Nothing is required; only what fits the household shows.
import type { JSX } from 'preact';
import { api } from './api';
import { AskOne } from './Ask';
import { CheckItem } from './Checks';
import { ValueCheck } from './DocumentCards';
import { Holdings } from './Holdings';
import { t } from './i18n';
import { pg, type PagesMessageKey } from './i18n-pages';
import type { PageProps } from './page-props';
import type { GroupQuestion, PagesFields } from './state-adapter';
import { TaxCard } from './TaxCard';
import type { DocumentView, RequirementView, State, Value } from './types';
import type { DocumentCard } from './types-docs';
import { AskClaude, Icon } from './ui';

/** What a file in the folder turned out to be. */
export type DocStatus = 'whose' | 'confirm' | 'unknown' | 'read' | 'barcode' | 'done';

/** Kinds that hold nothing to read: they are kept, compared or checked elsewhere. */
const NOTHING_TO_READ = new Set(['other', 'official_declaration', 'prior_declaration']);

export function docStatus(
  state: State,
  d: DocumentView,
): { status: DocStatus; card?: DocumentCard } {
  const card = state.cards.find((c) => c.docId === d.id);
  if (d.barcode === 'pending') return { status: 'whose' };
  if (!d.kind) return { status: 'unknown' };
  if (card && card.toConfirm > 0) return { status: 'confirm', card };
  if (d.barcode === 'read') return { status: 'barcode' };
  if (!card && !NOTHING_TO_READ.has(d.kind)) return { status: 'read' };
  return { status: 'done' };
}

const ACTION_FIRST: Record<DocStatus, number> = {
  whose: 0,
  confirm: 1,
  unknown: 2,
  read: 3,
  barcode: 4,
  done: 4,
};

/** The documents still useful: one row per document, both people of a couple in one row. */
export function missingGroups(state: State): RequirementView[][] {
  const groups = new Map<string, RequirementView[]>();
  for (const r of state.requirements) {
    // Missing, or stood in for by a rough figure: the document would make it exact.
    if (r.status !== 'missing' && r.status !== 'estimated') continue;
    groups.set(r.group, [...(groups.get(r.group) ?? []), r]);
  }
  return [...groups.values()].sort(
    (a, b) => Number(a.every((r) => r.optional)) - Number(b.every((r) => r.optional)),
  );
}

/** "You" or "Partner", as a row names whose document it is. */
const short = (lang: PageProps['lang'], person: string) =>
  t(lang, person === 'p2' ? 'p2Short' : 'p1Short');

/** Rows shown before "Show n more". */
const ROWS = 5;

function Mark({ done }: { done: boolean }) {
  return (
    <span class={`mark${done ? ' mark-done' : ''}`} aria-hidden="true">
      {done ? <Icon.check /> : null}
    </span>
  );
}

function DocRow({ p, d }: { p: PageProps; d: DocumentView }): JSX.Element {
  const { state, lang, act } = p;
  const { status, card } = docStatus(state, d);
  const couple = state.people.length > 1;
  const owner =
    couple && (d.person === 'p1' || d.person === 'p2') ? short(lang, d.person) : undefined;
  const title = d.kind ? `${d.kindLabel ?? d.filename}${owner ? ` · ${owner}` : ''}` : d.filename;
  const done = status === 'barcode' || status === 'done';
  return (
    <li class={`row${status === 'confirm' ? ' row-ask' : ''}`}>
      <Mark done={done} />
      <div class="row-main">
        <span class="row-title">{title}</span>
        {status === 'barcode' ? <span class="row-hint">{pg(lang, 'doc.barcode')}</span> : null}
        {status === 'done' ? <span class="row-hint">{pg(lang, 'doc.done')}</span> : null}
        {status === 'unknown' ? (
          <>
            <span class="row-hint">{pg(lang, 'doc.unknown')}</span>
            <details class="more">
              <summary>{pg(lang, 'doc.sayWhat')}</summary>
              <label class="sr-only" for={`kind-${d.id}`}>
                {t(lang, 'whatIsThis')}
              </label>
              <select
                id={`kind-${d.id}`}
                class="select"
                value=""
                onChange={(e) =>
                  void act(() =>
                    api.setKind(d.id, (e.target as HTMLSelectElement).value, undefined, lang),
                  )
                }
              >
                <option value="" disabled>
                  {t(lang, 'whatIsThis')}
                </option>
                {state.kinds.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </details>
          </>
        ) : null}
        {status === 'read' ? (
          <>
            <span class="row-hint">{pg(lang, 'doc.toRead')}</span>
            <AskClaude
              text={pg(lang, 'doc.readPrompt')}
              label={pg(lang, 'doc.askRead')}
              lang={lang}
            />
          </>
        ) : null}
        {status === 'whose' ? (
          <>
            <span class="row-hint" id={`whose-${d.id}`}>
              {pg(lang, 'doc.whose')}
            </span>
            <div class="row-actions" role="group" aria-labelledby={`whose-${d.id}`}>
              {state.people.map((person) => (
                <button
                  type="button"
                  class="ghost"
                  key={person.id}
                  onClick={() =>
                    void act(() =>
                      api.setKind(d.id, d.kind ?? 'salary_certificate', person.id, lang),
                    )
                  }
                >
                  {short(lang, person.id)}
                </button>
              ))}
            </div>
          </>
        ) : null}
        {status === 'confirm' && card ? (
          <ValueCheck
            key={card.values.find((v) => v.status === 'extracted')?.factId}
            card={card}
            lang={lang}
            act={act}
          />
        ) : null}
      </div>
    </li>
  );
}

function MissingRow({ p, rows }: { p: PageProps; rows: RequirementView[] }): JSX.Element {
  const { state, lang } = p;
  const first = rows[0]!;
  const couple = state.people.length > 1;
  const whom = couple
    ? rows.filter((r) => r.person === 'p1' || r.person === 'p2').map((r) => short(lang, r.person))
    : [];
  const person = rows.length === 1 && first.person !== 'household' ? first.person : undefined;
  return (
    <li class="row">
      <Mark done={false} />
      <div class="row-main">
        <span class="row-title">
          {first.label}
          {whom.length ? <span class="muted"> · {whom.join(', ')}</span> : null}
        </span>
        <span class="row-hint">{first.reason}</span>
      </div>
      <button
        type="button"
        class="ghost row-add"
        aria-label={`${pg(lang, 'add')}: ${first.label}`}
        onClick={() =>
          p.add(first.kind ? { kind: first.kind, ...(person ? { person } : {}) } : undefined)
        }
      >
        {pg(lang, 'add')}
      </button>
    </li>
  );
}

const INCOME_DOCS = new Set(['salary_certificate', 'replacement_income', 'pension']);

export function MakeItExact(p: PageProps): JSX.Element | null {
  const { state, lang, act, embedded } = p;
  const docs = [...state.documents].sort(
    (a, b) => ACTION_FIRST[docStatus(state, a).status] - ACTION_FIRST[docStatus(state, b).status],
  );
  const missing = missingGroups(state);
  const checks = state.checks.filter((c) => !c.resolved);
  const securities = state.holdings || state.securities?.warnings.length;
  const roughLink = !state.yearOver && missing.some((rows) => INCOME_DOCS.has(rows[0]!.group));
  if (!docs.length && !missing.length && !checks.length && !securities) return null;
  const missingRows = (list: RequirementView[][]) =>
    list.map((rows) => <MissingRow key={rows[0]!.group} p={p} rows={rows} />);
  return (
    <section class="section" aria-labelledby="exact-title">
      <div class="section-head">
        <h2 id="exact-title">
          {docs.length
            ? docs.length === 1
              ? pg(lang, 'exact.sortedOne')
              : pg(lang, 'exact.sorted', { n: docs.length })
            : pg(lang, 'exact.title')}
        </h2>
        {docs.length ? null : <span class="muted small-text">{pg(lang, 'exact.optional')}</span>}
      </div>
      {checks.length || docs.length ? (
        <ul class="card rows">
          {checks.map((c) => (
            <li class="row row-ask" key={c.id}>
              <Mark done={false} />
              <div class="row-main">
                <span class="row-label small-text">{pg(lang, 'doc.check')}</span>
                <CheckItem c={c} lang={lang} act={act} embedded={embedded} />
              </div>
            </li>
          ))}
          {docs.map((d) => (
            <DocRow key={d.id} p={p} d={d} />
          ))}
          {securities ? (
            <li class="row">
              <Mark done />
              <details class="row-main more-rows">
                <summary class="row-title">{pg(lang, 'exact.securities')}</summary>
                <Holdings state={state} lang={lang} act={act} />
              </details>
            </li>
          ) : null}
        </ul>
      ) : null}
      {missing.length ? (
        <>
          {docs.length ? <h3 class="sub-head">{pg(lang, 'exact.useful')}</h3> : null}
          <ul class="card rows">
            {missingRows(missing.slice(0, ROWS))}
            {missing.length > ROWS ? (
              <li class="row-more">
                <details>
                  <summary>{pg(lang, 'exact.more', { n: missing.length - ROWS })}</summary>
                  <ul class="rows">{missingRows(missing.slice(ROWS))}</ul>
                </details>
              </li>
            ) : null}
          </ul>
        </>
      ) : null}
      <p class="hint">
        {pg(lang, embedded ? 'exact.folderHint' : 'exact.dropHint')}{' '}
        {roughLink ? (
          <button type="button" class="link" onClick={p.openBasics}>
            {pg(lang, 'exact.rough')}
          </button>
        ) : null}
      </p>
    </section>
  );
}

/** The questions still open in a group, those skipped in this session last. */
const openIn = (list: GroupQuestion[], flags: ReadonlySet<string>) => {
  const open = list.filter((q) => !q.answered);
  const skipped = (q: GroupQuestion) => q.skipped === true || flags.has(`skipped:${q.id}`);
  return [...open.filter((q) => !skipped(q)), ...open.filter(skipped)];
};

/** "A few more questions": the rest of group detail, one at a time, never before the number. */
export function MoreQuestions(p: PageProps): JSX.Element | null {
  const { state, pages, lang, act } = p;
  if (!state.journey.hasFigures) return null;
  const open = openIn(pages.groups.detail, p.flags);
  const q = open[0];
  if (!q) return null;
  return (
    <section class="section" aria-labelledby="more-title">
      <div class="section-head">
        <h2 id="more-title">{pg(lang, 'questions.title', { n: open.length })}</h2>
      </div>
      <p class="muted section-lead">{pg(lang, 'questions.lead')}</p>
      <div class="card ask-card">
        <AskOne
          key={`${q.id}:${lang}`}
          q={q}
          lang={lang}
          busy={p.busy}
          onAnswer={(v) => void act(() => api.answer(q.id, v, lang))}
          onSkip={() => {
            p.setFlag(`skipped:${q.id}`, true);
            void act(() => api.skip(q.id, lang));
          }}
        />
      </div>
    </section>
  );
}

export type ChipId = 'home' | 'abroad' | 'self' | 'moved' | 'capital';
export interface Chip {
  id: ChipId;
  /** The question the chip answers (for "self", each person's income_sources). */
  questions: GroupQuestion[];
  option?: string;
  on: boolean;
  unsupported: boolean;
}

const has = (q: GroupQuestion, option: string) =>
  Array.isArray(q.value) && q.value.includes(option);
const offers = (q: GroupQuestion, option: string) => q.options?.find((o) => o.value === option);

/** The chips the household's canton asks about, in the design's order. */
export function chipsOf(pages: PagesFields): Chip[] {
  const special = pages.groups.special.find((q) => q.questionId === 'special');
  const moved = pages.groups.special.find((q) => q.questionId === 'moved');
  const sources = pages.groups.basics.filter((q) => q.questionId === 'income_sources');
  const fromSpecial = (id: ChipId, option: string): Chip[] => {
    const o = special && offers(special, option);
    return special && o
      ? [
          {
            id,
            questions: [special],
            option,
            on: has(special, option),
            unsupported: o.notSupported,
          },
        ]
      : [];
  };
  const self = sources.filter((q) => offers(q, 'self_employment'));
  return [
    ...fromSpecial('home', 'real_estate'),
    ...fromSpecial('abroad', 'property_abroad'),
    ...(self.length
      ? [
          {
            id: 'self' as const,
            questions: self,
            option: 'self_employment',
            on: self.some((q) => has(q, 'self_employment')),
            unsupported: self.some((q) => offers(q, 'self_employment')!.notSupported),
          },
        ]
      : []),
    ...(moved
      ? [
          {
            id: 'moved' as const,
            questions: [moved],
            on: typeof moved.value === 'string' && moved.value !== 'no',
            unsupported: false,
          },
        ]
      : []),
    ...fromSpecial('capital', 'pension_capital'),
  ];
}

const listOf = (v: Value | undefined): string[] => (Array.isArray(v) ? v : []);

/** "Anything special this year?": chips that answer their question, then its follow-ups in place. */
export function Special(p: PageProps): JSX.Element | null {
  const { state, pages, lang, act, flags, setFlag } = p;
  const chips = chipsOf(pages);
  if (!chips.length) return null;
  const answer = (id: string, value: Value) => void act(() => api.answer(id, value, lang));
  const special = pages.groups.special.find((q) => q.questionId === 'special');
  const moved = pages.groups.special.find((q) => q.questionId === 'moved');
  const pendingUnsupported = chips.find((c) => flags.has(`unsupported:${c.id}`));
  const nothing =
    special?.answered === true &&
    listOf(special.value).length === 0 &&
    (!moved || moved.value === 'no') &&
    !chips.some((c) => c.on);
  const add = (c: Chip, q: GroupQuestion) => answer(q.id, [...listOf(q.value), c.option!]);
  const tap = (c: Chip) => {
    flags.forEach((f) => f.startsWith('unsupported:') && setFlag(f, false));
    if (c.id === 'moved') return setFlag('open:moved', !flags.has('open:moved'));
    if (c.on) {
      for (const q of c.questions) {
        if (has(q, c.option!))
          answer(
            q.id,
            listOf(q.value).filter((v) => v !== c.option),
          );
      }
      return;
    }
    if (c.unsupported) return setFlag(`unsupported:${c.id}`, true);
    if (c.questions.length > 1) return setFlag('who:self', !flags.has('who:self'));
    add(c, c.questions[0]!);
  };
  // The follow-ups: what the chips opened, one at a time.
  const roots = new Set(['special', ...(flags.has('open:moved') ? [] : ['moved'])]);
  const next = openIn(
    pages.groups.special.filter((q) => !roots.has(q.questionId)),
    flags,
  )[0];
  return (
    <section class="section" aria-labelledby="special-title">
      <h2 id="special-title">{pg(lang, 'special.title')}</h2>
      <div class="chips" role="group" aria-labelledby="special-title">
        {chips.map((c) => (
          <button
            type="button"
            key={c.id}
            class="chip-btn"
            aria-pressed={c.on}
            aria-expanded={c.id === 'moved' ? flags.has('open:moved') : undefined}
            onClick={() => tap(c)}
          >
            {c.on ? <Icon.check /> : null}
            {pg(lang, `chip.${c.id}` as PagesMessageKey)}
          </button>
        ))}
        {special || moved ? (
          <button
            type="button"
            class="chip-btn"
            aria-pressed={nothing}
            onClick={() => {
              if (special && !special.answered) answer(special.id, []);
              if (moved && !moved.answered) answer(moved.id, 'no');
            }}
          >
            {pg(lang, 'chip.none')}
          </button>
        ) : null}
      </div>
      {pendingUnsupported ? (
        <div class="banner banner-estimate" role="note">
          <p>{state.notSupportedMessage || pg(lang, 'special.unsupported')}</p>
          <div class="row-actions">
            <button
              type="button"
              class="ghost"
              onClick={() => {
                setFlag(`unsupported:${pendingUnsupported.id}`, false);
                const q = pendingUnsupported.questions[0]!;
                if (pendingUnsupported.questions.length > 1) setFlag('who:self', true);
                else add(pendingUnsupported, q);
              }}
            >
              {pg(lang, 'special.applies')}
            </button>
            <button
              type="button"
              class="link"
              onClick={() => setFlag(`unsupported:${pendingUnsupported.id}`, false)}
            >
              {pg(lang, 'cancel')}
            </button>
          </div>
        </div>
      ) : null}
      {flags.has('who:self') ? (
        <div class="inline-ask">
          <span id="who-self">{pg(lang, 'special.who')}</span>
          <div class="row-actions" role="group" aria-labelledby="who-self">
            {chips
              .find((c) => c.id === 'self')
              ?.questions.map((q) => (
                <button
                  type="button"
                  class="ghost"
                  key={q.id}
                  aria-pressed={has(q, 'self_employment')}
                  onClick={() => {
                    setFlag('who:self', false);
                    if (!has(q, 'self_employment'))
                      answer(q.id, [...listOf(q.value), 'self_employment']);
                  }}
                >
                  {state.people.find((x) => x.id === q.person)?.label ?? q.person}
                </button>
              ))}
          </div>
        </div>
      ) : null}
      {flags.has('open:moved') && moved ? (
        <div class="card ask-card">
          <AskOne
            key={`${moved.id}:${lang}:${String(moved.value)}`}
            q={moved}
            lang={lang}
            busy={p.busy}
            onAnswer={(v) => {
              setFlag('open:moved', false);
              answer(moved.id, v);
            }}
          />
        </div>
      ) : null}
      {next ? (
        <div class="card ask-card">
          <AskOne
            key={`${next.id}:${lang}`}
            q={next}
            lang={lang}
            busy={p.busy}
            onAnswer={(v) => answer(next.id, v)}
            onSkip={() => {
              p.setFlag(`skipped:${next.id}`, true);
              void act(() => api.skip(next.id, lang));
            }}
          />
        </div>
      ) : null}
    </section>
  );
}

export function YourTax(p: PageProps): JSX.Element {
  const { state, lang } = p;
  return (
    <>
      <TaxCard {...p} />
      {state.notSupported.length ? (
        <section class="banner banner-fix" aria-labelledby="ns-title">
          <strong id="ns-title">{t(lang, 'notSupportedTitle')}</strong>
          <ul class="plain-list">
            {state.notSupported.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p class="small-text">{state.notSupportedMessage}</p>
        </section>
      ) : null}
      <MakeItExact {...p} />
      <MoreQuestions {...p} />
      <Special {...p} />
      <button type="button" class="next-link" onClick={() => p.go('save')}>
        <span>{pg(lang, 'tax.seeSave')}</span>
        <Icon.arrow />
      </button>
    </>
  );
}
