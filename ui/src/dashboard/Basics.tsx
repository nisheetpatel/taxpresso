// The basics card (three-pages.md, A2): one card, every field skippable, big controls. Each tap
// saves at once, as answering in the chat would (answer_question, set_fact), so a field that
// depends on another appears as soon as it applies: the commune after the canton, the partner's
// rows for a couple, the permit's follow-ups only with another permit. "See my tax" closes it.
import type { JSX } from 'preact';
import type { PlanField } from './api';
import { t, type Language } from './i18n';
import { pg } from './i18n-pages';
import type {
  GroupQuestion,
  PagesFields,
  RoughKind,
  RoughPerson,
  RoughView,
} from './state-adapter';
import type { State, Value } from './types';
import { AmountInput, Icon, Segmented, Stepper } from './ui';

/** One change the card makes: an answer, or a rough figure (an estimate). */
export type Write =
  | { answer: { id: string; value: Value } }
  | { plan: { person: 'p1' | 'p2'; field: PlanField; value: number } };

export interface BasicsActions {
  write: (writes: Write[]) => void;
  close: () => void;
}

const COUPLE = new Set(['married', 'registered_partnership']);
const sourcesOf = (q: GroupQuestion | undefined): string[] =>
  Array.isArray(q?.value) ? q.value : Array.isArray(q?.suggested) ? q.suggested : [];

/** The one kind an answer of income_sources says, when it says exactly one of those offered. */
function onlyKind(q: GroupQuestion | undefined, kinds: RoughView['kinds']): RoughKind | null {
  const said = kinds.filter((k) => sourcesOf(q).includes(k.kind));
  return said.length === 1 ? said[0]!.kind : null;
}

/** The kind the card shows chosen: the rough figure's, the answer's, else a salary. */
export const shownKind = (
  rough: RoughPerson | undefined,
  q: GroupQuestion | undefined,
  kinds: RoughView['kinds'],
): RoughKind => rough?.kind ?? onlyKind(q, kinds) ?? 'salary';

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * What choosing a kind, or typing an amount, changes for one person: income_sources says the kind
 * (the one it replaces taken out); the figure of a kind it replaces is cleared (0), then the
 * amount goes to the new kind's field (extension/src/api.ts, POST /plan).
 */
export function incomeWrites(p: {
  person: 'p1' | 'p2';
  kind: RoughKind;
  /** The amount typed now, whole francs; null when only the kind changes. */
  francs: number | null;
  rough: RoughPerson | undefined;
  sources: GroupQuestion | undefined;
  kinds: RoughView['kinds'];
}): Write[] {
  const field = (k: RoughKind) => p.kinds.find((x) => x.kind === k)?.field;
  const out: Write[] = [];
  const before = p.rough?.kind ?? onlyKind(p.sources, p.kinds);
  if (p.sources) {
    const current = Array.isArray(p.sources.value) ? p.sources.value : [];
    const kept = before && before !== p.kind ? current.filter((v) => v !== before) : current;
    const want = kept.includes(p.kind) ? kept : [...kept, p.kind];
    if (!p.sources.answered || !same(want, current)) {
      out.push({ answer: { id: p.sources.id, value: want } });
    }
  }
  const had = p.rough?.amount ?? null;
  const amount = p.francs ?? (had !== null ? Math.round(had / 100) : null);
  const to = field(p.kind);
  if (amount === null || !to) return out;
  const old =
    p.rough?.kind && p.rough.kind !== p.kind && had !== null ? field(p.rough.kind) : undefined;
  if (old) out.push({ plan: { person: p.person, field: old, value: 0 } });
  if (p.francs !== null || old) out.push({ plan: { person: p.person, field: to, value: amount } });
  return out;
}

/** "Just me" or "Me and my partner", keeping the exact status already given when it fits. */
export function filingWrite(q: GroupQuestion, choice: 'single' | 'couple'): Write | null {
  const now = typeof q.value === 'string' ? q.value : undefined;
  const fits = now !== undefined && COUPLE.has(now) === (choice === 'couple');
  if (fits && q.answered) return null;
  return {
    answer: { id: q.id, value: fits ? now : choice === 'couple' ? 'married' : 'single' },
  };
}

/** Every suggestion from last year still waiting in the card, answered as it is. */
export function confirmAll(basics: GroupQuestion[]): Write[] {
  return basics
    .filter((q) => !q.answered && q.suggested !== undefined)
    .map((q) => ({ answer: { id: q.id, value: q.suggested! } }));
}

const RES_SHORT = ['swiss', 'permit_c', 'permit_other'] as const;
/** Questions the card lays out itself; any other question of the group gets a plain control. */
const OWN = new Set([
  'canton',
  'commune',
  'civil_status',
  'children',
  'income_sources',
  'residence',
]);

export function BasicsCard({
  state,
  pages,
  lang,
  busy,
  actions,
}: {
  state: State;
  pages: PagesFields;
  lang: Language;
  busy: boolean;
  actions: BasicsActions;
}): JSX.Element {
  const basics = pages.groups.basics;
  const find = (questionId: string, person?: string) =>
    basics.find((q) => q.questionId === questionId && (person ? q.person === person : true));
  const people = state.people.map((p) => p.id as 'p1' | 'p2');
  const couple = people.length > 1;
  const whoLabel = (p: string) => pg(lang, p === 'p2' ? 'partner' : 'you');
  const answer = (q: GroupQuestion, value: Value) =>
    actions.write([{ answer: { id: q.id, value } }]);
  const canton = find('canton');
  const commune = find('commune');
  const civil = find('civil_status');
  const children = find('children');
  const pending = confirmAll(basics);
  const over = !pages.rough.open;
  const kinds = pages.rough.kinds;
  const civilValue = typeof civil?.value === 'string' ? civil.value : undefined;
  const civilSuggested = typeof civil?.suggested === 'string' ? civil.suggested : undefined;
  const filing = (v: string | undefined) =>
    v === undefined ? undefined : COUPLE.has(v) ? 'couple' : 'single';
  const extra = basics.filter((q) => !OWN.has(q.questionId));

  return (
    <section class="basics" aria-labelledby="basics-title">
      <button type="button" class="back" onClick={actions.close}>
        <Icon.back />
        <span>{pg(lang, 'back')}</span>
      </button>
      <div class="page-head">
        <h1 id="basics-title">{pg(lang, 'basics.title')}</h1>
        <p class="lead">{pg(lang, 'basics.lead')}</p>
      </div>

      {pending.length ? (
        <div class="note-card" role="note">
          <p>{pg(lang, 'basics.lastYear')}</p>
          <button
            type="button"
            class="ghost"
            disabled={busy}
            onClick={() => actions.write(pending)}
          >
            {pg(lang, 'basics.allRight')}
          </button>
        </div>
      ) : null}

      <div class="card basics-card">
        {canton ? (
          <div class="field">
            <span class="field-title" id="b-where">
              {pg(lang, 'basics.where')}
            </span>
            <div class="where">
              <label class="sr-only" for="b-canton">
                {pg(lang, 'basics.canton')}
              </label>
              <select
                id="b-canton"
                class="select"
                value={typeof canton.value === 'string' ? canton.value : ''}
                aria-describedby="b-where-hint"
                onChange={(e) => answer(canton, (e.target as HTMLSelectElement).value)}
              >
                <option value="" disabled>
                  {pg(lang, 'basics.chooseCanton')}
                </option>
                {(canton.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {commune ? (
                <>
                  <label class="sr-only" for="b-commune">
                    {pg(lang, 'basics.commune')}
                  </label>
                  <select
                    id="b-commune"
                    class="select"
                    value={typeof commune.value === 'string' ? commune.value : ''}
                    onChange={(e) => answer(commune, (e.target as HTMLSelectElement).value)}
                  >
                    <option value="" disabled>
                      {t(lang, 'chooseCommune')}
                    </option>
                    {(commune.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
            </div>
            <span class="field-hint" id="b-where-hint">
              {pg(lang, 'basics.whereHint', { year: state.taxYear })}
            </span>
          </div>
        ) : null}

        {civil ? (
          <div class="field">
            <span class="field-title" id="b-who">
              {pg(lang, 'basics.who')}
            </span>
            <Segmented
              labelledBy="b-who"
              options={[
                { value: 'single', label: pg(lang, 'basics.justMe') },
                { value: 'couple', label: pg(lang, 'basics.couple') },
              ]}
              value={filing(civilValue)}
              suggested={filing(civilSuggested)}
              onPick={(v) => {
                const w = filingWrite(civil, v as 'single' | 'couple');
                if (w) actions.write([w]);
              }}
            />
            <span class="field-hint">{pg(lang, 'basics.coupleHint')}</span>
            <details class="more">
              <summary>{pg(lang, 'basics.otherStatus')}</summary>
              <Segmented
                labelledBy="b-who"
                columns={2}
                options={civil.options ?? []}
                value={civilValue}
                suggested={civilSuggested}
                onPick={(v) => answer(civil, v)}
              />
            </details>
          </div>
        ) : null}

        {children ? (
          <div class="field field-row">
            <span class="field-title" id="b-children">
              {pg(lang, 'basics.children')}
            </span>
            <Stepper
              labelledBy="b-children"
              value={
                typeof children.value === 'number'
                  ? children.value
                  : typeof children.suggested === 'number'
                    ? children.suggested
                    : 0
              }
              min={children.min ?? 0}
              max={children.max ?? 12}
              fewer={pg(lang, 'basics.fewer')}
              more={pg(lang, 'basics.more')}
              onChange={(n) => answer(children, n)}
            />
          </div>
        ) : null}

        <div class="field">
          <span class="field-title" id="b-income">
            {pg(lang, 'basics.income')}
          </span>
          {over ? <span class="field-hint">{pg(lang, 'basics.over')}</span> : null}
          <div class={`people${couple ? ' people-two' : ''}`}>
            {people.map((p) => {
              const sources = find('income_sources', p);
              const rough = pages.rough.people.find((r) => r.person === p);
              const kind = shownKind(rough, sources, kinds);
              const who = whoLabel(p);
              return (
                <div class="person" key={p}>
                  {couple ? <span class="person-name">{who}</span> : null}
                  {over ? null : (
                    <AmountInput
                      key={`${p}:${rough?.amount ?? ''}`}
                      id={`b-amount-${p}`}
                      label={pg(lang, 'basics.incomeOf', { who })}
                      hideLabel
                      centimes={rough?.amount ?? null}
                      describedBy="b-income-hint"
                      onSave={(francs) =>
                        actions.write(
                          incomeWrites({ person: p, kind, francs, rough, sources, kinds }),
                        )
                      }
                    />
                  )}
                  <span class="sr-only" id={`b-kind-${p}`}>
                    {pg(lang, 'basics.fromOf', { who })}
                  </span>
                  <Segmented
                    labelledBy={`b-kind-${p}`}
                    columns={2}
                    options={kinds
                      .filter(
                        (k) => !sources?.options || sources.options.some((o) => o.value === k.kind),
                      )
                      .map((k) => ({ value: k.kind, label: pg(lang, `kind.${k.kind}`) }))}
                    value={kind}
                    onPick={(k) =>
                      actions.write(
                        incomeWrites({
                          person: p,
                          kind: k as RoughKind,
                          francs: null,
                          rough,
                          sources,
                          kinds,
                        }),
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
          {over ? null : (
            <span class="field-hint" id="b-income-hint">
              {pg(lang, 'basics.incomeHint')}
            </span>
          )}
        </div>

        {people.some((p) => find('residence', p)) ? (
          <div class="field">
            <span class="field-title" id="b-res">
              {pg(lang, 'basics.residence')}
            </span>
            <div class={`people${couple ? ' people-two' : ''}`}>
              {people.map((p) => {
                const q = find('residence', p);
                if (!q) return null;
                const value = typeof q.value === 'string' ? q.value : undefined;
                const suggested = typeof q.suggested === 'string' ? q.suggested : undefined;
                return (
                  <div class="person" key={p}>
                    {couple ? (
                      <span class="person-name" id={`b-res-${p}`}>
                        {whoLabel(p)}
                      </span>
                    ) : null}
                    <Segmented
                      labelledBy={couple ? `b-res b-res-${p}` : 'b-res'}
                      options={RES_SHORT.filter((v) =>
                        (q.options ?? []).some((o) => o.value === v),
                      ).map((v) => ({ value: v, label: pg(lang, `res.${v}`) }))}
                      value={value}
                      suggested={suggested}
                      onPick={(v) => answer(q, v)}
                    />
                    {(q.options ?? []).some((o) => o.value === 'other') ? (
                      <button
                        type="button"
                        class="link small-link"
                        aria-pressed={value === 'other'}
                        onClick={() => answer(q, 'other')}
                      >
                        {pg(lang, 'basics.residenceOther')}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <span class="field-hint">{pg(lang, 'basics.residenceHint')}</span>
          </div>
        ) : null}

        {extra.map((q) => (
          <PlainField key={q.id} q={q} lang={lang} onAnswer={(v) => answer(q, v)} />
        ))}
      </div>

      <button type="button" class="primary big" onClick={actions.close}>
        {pg(lang, 'basics.see')}
      </button>
    </section>
  );
}

/** A question of the group the card has no layout of its own for: yes or no, a choice, a count. */
function PlainField({
  q,
  lang,
  onAnswer,
}: {
  q: GroupQuestion;
  lang: Language;
  onAnswer: (value: Value) => void;
}): JSX.Element | null {
  const id = `b-${q.id.replace(/[^\w-]/g, '-')}`;
  const title = (
    <span class="field-title" id={id}>
      {q.text}
      {q.who ? <span class="muted"> · {q.who}</span> : null}
    </span>
  );
  if (q.type === 'yesno') {
    const value = q.value === undefined ? undefined : q.value ? 'yes' : 'no';
    return (
      <div class="field">
        {title}
        <Segmented
          labelledBy={id}
          options={[
            { value: 'yes', label: pg(lang, 'yes') },
            { value: 'no', label: pg(lang, 'no') },
          ]}
          value={value}
          suggested={q.suggested === undefined ? undefined : q.suggested ? 'yes' : 'no'}
          onPick={(v) => onAnswer(v === 'yes')}
        />
      </div>
    );
  }
  if (q.type === 'choice' && q.options) {
    return (
      <div class="field">
        {title}
        <Segmented
          labelledBy={id}
          columns={q.options.length > 2 ? 1 : 2}
          options={q.options}
          value={typeof q.value === 'string' ? q.value : undefined}
          suggested={typeof q.suggested === 'string' ? q.suggested : undefined}
          onPick={onAnswer}
        />
      </div>
    );
  }
  if (q.type === 'number') {
    return (
      <div class="field field-row">
        {title}
        <Stepper
          labelledBy={id}
          value={typeof q.value === 'number' ? q.value : (q.min ?? 0)}
          min={q.min ?? 0}
          max={q.max ?? 99}
          fewer="−1"
          more="+1"
          onChange={onAnswer}
        />
      </div>
    );
  }
  return null;
}
