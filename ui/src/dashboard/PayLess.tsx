// "Pay less" (three-pages.md, A5): the tax now and with what is counted, then the ways to pay less
// that apply, biggest saving first (pillar 3a, a pension fund buy-in, the 3a catch-up, TOU when it
// is a real choice), and the costs you can deduct, one tap each. Rules and assumptions stay behind
// "How it works". Every figure comes from the extension (extension/src/planning.ts).
import type { JSX } from 'preact';
import { api } from './api';
import { AskOne } from './Ask';
import { ck, isMessageKey, type MessageKey, t } from './i18n';
import { tj } from './i18n-journey';
import { pg, type PagesMessageKey } from './i18n-pages';
import { assumptionList, day, tp } from './i18n-planning';
import { ty } from './i18n-years';
import { aboutFrancs, francs, roughFrancs } from './money';
import type { PageProps } from './page-props';
import { CatchUpCard, LppCard, TouCard } from './Planning';
import type { GroupQuestion, PagesFields } from './state-adapter';
import { TaxStrip } from './TaxCard';
import { isPlanned, type PlannedState, type Value } from './types';
import { AmountInput, Icon, Segmented } from './ui';

type Planned = PageProps & { state: PlannedState };

/** The plan question of each person (pillar3a, lpp_buyin), as a Yes or No in its card. */
function PlanQuestions({ p, id }: { p: PageProps; id: 'pillar3a' | 'lpp_buyin' }) {
  const { pages, lang, act } = p;
  const open = pages.groups.plan.filter((q) => q.questionId === id && !q.answered);
  if (!open.length) return null;
  return (
    <>
      {open.map((q) => {
        const label = `plan-${q.id.replace(/[^\w-]/g, '-')}`;
        return (
          <div class="field" key={q.id}>
            <span class="field-title" id={label}>
              {q.text}
              {q.who ? <span class="muted"> · {q.who}</span> : null}
            </span>
            <Segmented
              labelledBy={label}
              options={[
                { value: 'yes', label: pg(lang, 'yes') },
                { value: 'no', label: pg(lang, 'no') },
              ]}
              value={undefined}
              suggested={q.suggested === undefined ? undefined : q.suggested ? 'yes' : 'no'}
              onPick={(v) => void act(() => api.answer(q.id, v === 'yes', lang))}
            />
          </div>
        );
      })}
    </>
  );
}

function Counted({ lang }: { lang: PageProps['lang'] }) {
  return <span class="chip chip-verified">{pg(lang, 'save.counted')}</span>;
}

function Pillar3aCard({ p }: { p: Planned }): JSX.Element {
  const { state, lang, act } = p;
  const { inputs, result } = state.plan;
  const year = state.taxYear;
  const couple = inputs.length > 1;
  const who = (person: string) => pg(lang, person === 'p2' ? 'partner' : 'you');
  const counted = state.journey.savings?.parts.includes('pillar3a') ?? false;
  const noTax = result.assumptions
    .map((a) => `assume.${a}`)
    .find((k): k is MessageKey => k.endsWith('_no_tax') && isMessageKey(k));
  const how = assumptionList(lang, result.assumptions);
  const room = (r: (typeof result.people)[number]) =>
    r.capIsMaximum
      ? t(lang, 'planUpTo', { amount: francs(r.roomCentimes, lang) })
      : francs(r.roomCentimes, lang);
  return (
    <section class={`card save-card${counted ? ' save-card-on' : ''}`} aria-labelledby="p3a-title">
      <div class="save-head">
        <h2 id="p3a-title">{pg(lang, 'p3a.title')}</h2>
        {counted ? <Counted lang={lang} /> : null}
      </div>
      <div class="save-room">
        {result.roomCentimes === 0 ? (
          <p class="muted">{pg(lang, 'p3a.full', { year })}</p>
        ) : !couple && result.people[0] ? (
          <p class="muted">{pg(lang, 'p3a.room', { amount: room(result.people[0]) })}</p>
        ) : result.people.every((r) => room(r) === room(result.people[0]!)) ? (
          <p class="muted">{pg(lang, 'p3a.roomEach', { amount: room(result.people[0]!) })}</p>
        ) : (
          result.people
            .filter((r) => r.roomCentimes > 0)
            .map((r) => (
              <p class="muted" key={r.person}>
                {pg(lang, 'p3a.roomOf', { who: who(r.person), amount: room(r) })}
              </p>
            ))
        )}
      </div>
      <PlanQuestions p={p} id="pillar3a" />
      {result.saving ? (
        <p class="saving">
          {pg(lang, 'save.saves', {
            amount: aboutFrancs(result.saving.totalCentimes, lang),
          })}
        </p>
      ) : noTax ? (
        <p class="muted small-text">{t(lang, noTax)}</p>
      ) : result.roomCentimes > 0 ? (
        <p class="muted small-text">{pg(lang, 'save.needIncome')}</p>
      ) : null}
      {state.planning.needsTou ? (
        <p class="banner banner-estimate">{tp(lang, 'onlyWithTou')}</p>
      ) : null}
      <details class="more">
        <summary>{tj(lang, 'change')}</summary>
        <div class={`people${couple ? ' people-two' : ''}`}>
          {inputs.map((input) => {
            const fund = `p3a-fund-${input.person}`;
            return (
              <div class="person" key={input.person}>
                {couple ? <span class="person-name">{who(input.person)}</span> : null}
                <AmountInput
                  key={`${input.person}:${input.paid}`}
                  id={`p3a-paid-${input.person}`}
                  label={
                    couple
                      ? pg(lang, 'p3a.paidOf', { year, who: who(input.person) })
                      : pg(lang, 'p3a.paid', { year })
                  }
                  centimes={input.paid || null}
                  onSave={(v) => void act(() => api.plan(input.person, 'paid', v, lang))}
                />
                <span class="field-label" id={fund}>
                  {pg(lang, 'p3a.fund')}
                </span>
                <Segmented
                  labelledBy={fund}
                  options={[
                    { value: 'yes', label: pg(lang, 'yes') },
                    { value: 'no', label: pg(lang, 'no') },
                  ]}
                  value={input.hasPensionFund ? 'yes' : 'no'}
                  onPick={(v) =>
                    (v === 'yes') !== input.hasPensionFund &&
                    void act(() => api.plan(input.person, 'pensionFund', v === 'yes', lang))
                  }
                />
              </div>
            );
          })}
        </div>
      </details>
      <details class="more">
        <summary>{pg(lang, 'save.howItWorks')}</summary>
        <div class="how">
          <p>{t(lang, ck('planExplain', state.canton?.code))}</p>
          <p>
            <strong>{t(lang, 'planGood')}</strong>
          </p>
          <ul>
            <li>{t(lang, 'planPro1', { year })}</li>
            <li>{t(lang, 'planPro2')}</li>
          </ul>
          <p>
            <strong>{t(lang, 'planMind')}</strong>
          </p>
          <ul>
            <li>{t(lang, 'planCon1')}</li>
            <li>{t(lang, 'planCon2')}</li>
            <li>{t(lang, 'planCon3', { year })}</li>
            <li>{t(lang, 'planNew')}</li>
          </ul>
          {how.length ? (
            <ul>
              {how.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
          <p class="small-text muted">
            {t(lang, 'planSources')}: <span class="tnum">{result.sources.join(' · ')}</span>
          </p>
        </div>
      </details>
    </section>
  );
}

/** A plan whose figures the user gives inside: its face, and "Check" opens the plan's figures. */
function PlanCard({
  p,
  id,
  title,
  lead,
  saving,
  counted,
  children,
}: {
  p: PageProps;
  id: string;
  title: string;
  lead: string;
  saving: number | undefined;
  counted: boolean;
  children: JSX.Element;
}): JSX.Element {
  const { lang, flags, setFlag } = p;
  const open = flags.has(`plan:${id}`);
  return (
    <section
      class={`card save-card${counted ? ' save-card-on' : ''}`}
      aria-labelledby={`${id}-title`}
    >
      <div class="save-head">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p class="muted">{lead}</p>
          {saving ? (
            <p class="saving">{pg(lang, 'save.saves', { amount: aboutFrancs(saving, lang) })}</p>
          ) : null}
        </div>
        <div class="save-side">
          {counted ? <Counted lang={lang} /> : null}
          <button
            type="button"
            class="ghost"
            aria-expanded={open}
            aria-controls={`${id}-body`}
            onClick={() => setFlag(`plan:${id}`, !open)}
          >
            {pg(lang, open ? 'close' : 'check')}
          </button>
        </div>
      </div>
      {open ? (
        <div class="plan-body" id={`${id}-body`}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** The cards that apply, biggest saving first, those without a figure after. */
export function saveCards(p: Planned): { id: string; saving: number; el: JSX.Element }[] {
  const { state, lang, act } = p;
  const planning = state.planning;
  const parts = state.journey.savings?.parts ?? [];
  const cards: { id: string; saving: number; el: JSX.Element }[] = [
    {
      id: 'pillar3a',
      saving: state.plan.result.saving?.totalCentimes ?? 0,
      el: <Pillar3aCard p={p} />,
    },
    {
      id: 'lpp',
      saving: planning.lpp.saving?.totalCentimes ?? 0,
      el: (
        <PlanCard
          p={p}
          id="lpp"
          title={pg(lang, 'lpp.title')}
          lead={pg(lang, 'lpp.lead')}
          saving={planning.lpp.saving?.totalCentimes}
          counted={parts.includes('lpp_buyin')}
        >
          <>
            <PlanQuestions p={p} id="lpp_buyin" />
            <LppCard state={state} lang={lang} act={act} />
            <button type="button" class="ghost" onClick={() => p.add()}>
              {pg(lang, 'lpp.add')}
            </button>
          </>
        </PlanCard>
      ),
    },
  ];
  if (planning.catchUp.people.some((r) => r.status !== 'no_gap')) {
    cards.push({
      id: 'catchup',
      saving: planning.catchUp.saving?.totalCentimes ?? 0,
      el: (
        <PlanCard
          p={p}
          id="cu"
          title={pg(lang, 'cu.title')}
          lead={pg(lang, 'cu.lead')}
          saving={planning.catchUp.saving?.totalCentimes}
          counted={parts.includes('pillar3a_catchup')}
        >
          <CatchUpCard state={state} lang={lang} act={act} />
        </PlanCard>
      ),
    });
  }
  if (state.journey.touChoice || planning.tou.decision) {
    cards.push({
      id: 'tou',
      saving: Math.max(0, planning.tou.differenceCentimes ?? 0),
      el: (
        <PlanCard
          p={p}
          id="tou"
          title={tp(lang, 'touTitle')}
          lead={pg(lang, 'tou.lead', { date: day(planning.tou.deadline, lang) })}
          saving={undefined}
          counted={false}
        >
          <TouCard state={state} lang={lang} act={act} />
        </PlanCard>
      ),
    });
  }
  return cards.sort((a, b) => b.saving - a.saving);
}

export type CostId =
  | 'commute'
  | 'meals'
  | 'childcare'
  | 'medical_costs'
  | 'donations'
  | 'loan_interest'
  | 'alimony_paid';

export interface CostRow {
  id: CostId;
  /** The question a tap answers or opens. */
  q: GroupQuestion;
  /** For a choice of the payments question: the option a tap adds or takes out. */
  option?: string;
  on: boolean;
  /** What the answer says, in words. */
  summary?: string;
}

const PAYMENTS: CostId[] = ['medical_costs', 'donations', 'loan_interest', 'alimony_paid'];
/** A cost's follow-up questions, by its question. */
const FOLLOWS: Record<string, RegExp> = { commute: /^commute_/, childcare: /^child_care$/ };

/** One row per deduction question that applies, in the design's order. */
export function costRowsOf(pages: PagesFields): CostRow[] {
  const group = pages.groups.deduction;
  const label = (q: GroupQuestion) =>
    q.options?.find((o) => o.value === q.value)?.label ??
    (typeof q.value === 'number' ? String(q.value) : undefined);
  const rows: CostRow[] = [];
  for (const q of group.filter((x) => x.questionId === 'commute')) {
    const summary = q.answered ? label(q) : undefined;
    rows.push({ id: 'commute', q, on: q.answered, ...(summary ? { summary } : {}) });
  }
  for (const q of group.filter((x) => x.questionId === 'meal_days')) {
    rows.push({
      id: 'meals',
      q,
      on: typeof q.value === 'number' && q.value > 0,
      ...(typeof q.value === 'number' && q.value > 0 ? { summary: String(q.value) } : {}),
    });
  }
  const childcare = group.find((x) => x.questionId === 'childcare');
  if (childcare) {
    const summary = childcare.answered ? label(childcare) : undefined;
    rows.push({
      id: 'childcare',
      q: childcare,
      on: childcare.answered && childcare.value !== 'none',
      ...(summary ? { summary } : {}),
    });
  }
  const payments = group.find((x) => x.questionId === 'payments');
  if (payments) {
    for (const id of PAYMENTS) {
      if (!payments.options?.some((o) => o.value === id)) continue;
      rows.push({
        id,
        q: payments,
        option: id,
        on: Array.isArray(payments.value) && payments.value.includes(id),
      });
    }
  }
  return rows;
}

/** "Costs you can deduct": tap what applies; a tap answers, its follow-ups open in place. */
export function Costs(p: PageProps): JSX.Element | null {
  const { state, pages, lang, act, flags, setFlag } = p;
  const rows = costRowsOf(pages);
  if (!rows.length) return null;
  const couple = state.people.length > 1;
  const answer = (id: string, value: Value) => void act(() => api.answer(id, value, lang));
  const open = pages.groups.deduction.filter((q) => !q.answered);
  const payments = rows.find((r) => r.option)?.q;
  const unanswered = rows.filter((r) => !r.q.answered && r.id !== 'commute');
  return (
    <section class="section" aria-labelledby="costs-title">
      <div class="section-head">
        <h2 id="costs-title">{pg(lang, 'costs.title')}</h2>
        <span class="muted small-text">{pg(lang, 'costs.lead')}</span>
      </div>
      <ul class="card rows costs">
        {rows.map((r) => {
          const key = `${r.id}:${r.q.id}`;
          const expanded = flags.has(`cost:${key}`);
          const who =
            couple && (r.q.person === 'p1' || r.q.person === 'p2')
              ? state.people.find((x) => x.id === r.q.person)?.label
              : undefined;
          const follow = r.option
            ? undefined
            : open.find(
                (q) =>
                  FOLLOWS[r.q.questionId]?.test(q.questionId) &&
                  (r.q.person === 'household' || q.person === r.q.person),
              );
          const list = Array.isArray(r.q.value) ? r.q.value : [];
          return (
            <li class={`cost${r.on ? ' cost-on' : ''}`} key={key}>
              <button
                type="button"
                class="cost-btn"
                {...(r.option ? { 'aria-pressed': r.on } : { 'aria-expanded': expanded })}
                onClick={() =>
                  r.option
                    ? answer(
                        r.q.id,
                        r.on ? list.filter((v) => v !== r.option) : [...list, r.option],
                      )
                    : setFlag(`cost:${key}`, !expanded)
                }
              >
                <span class="cost-name">
                  {pg(lang, `cost.${r.id}` as PagesMessageKey)}
                  {who ? <span class="muted"> · {who}</span> : null}
                </span>
                {r.summary ? <span class="cost-value">{r.summary}</span> : null}
                <span class="cost-mark" aria-hidden="true">
                  {r.on ? <Icon.check /> : '+'}
                </span>
              </button>
              {r.option && r.on ? (
                <p class="cost-note small-text">{pg(lang, 'costs.receipts')}</p>
              ) : null}
              {expanded ? (
                <div class="cost-ask">
                  <AskOne
                    key={`${r.q.id}:${lang}:${String(r.q.value)}`}
                    q={r.q}
                    lang={lang}
                    busy={p.busy}
                    showWho={false}
                    onAnswer={(v) => {
                      setFlag(`cost:${key}`, false);
                      answer(r.q.id, v);
                    }}
                  />
                </div>
              ) : follow ? (
                <div class="cost-ask">
                  <AskOne
                    key={`${follow.id}:${lang}`}
                    q={follow}
                    lang={lang}
                    busy={p.busy}
                    showWho={false}
                    onAnswer={(v) => answer(follow.id, v)}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {unanswered.length ? (
        <button
          type="button"
          class="link"
          onClick={() => {
            for (const r of unanswered) {
              if (r.q === payments) continue;
              answer(r.q.id, r.id === 'meals' ? 0 : 'none');
            }
            if (payments && !payments.answered) answer(payments.id, []);
          }}
        >
          {pg(lang, 'costs.none')}
        </button>
      ) : null}
    </section>
  );
}

export function PayLess(p: PageProps): JSX.Element {
  const { state, pages, lang, act } = p;
  const year = state.taxYear;
  if (state.yearOver || !isPlanned(state)) {
    const plans = state.yearOver?.plansIn ?? year + 1;
    const canOpen = state.years.some((y) => y.year === plans);
    return (
      <>
        <TaxStrip state={state} pages={pages} lang={lang} />
        <section class="card plain-card">
          <p>{pg(lang, 'save.over', { year: plans })}</p>
          {canOpen ? (
            <button
              type="button"
              class="primary"
              disabled={p.busy}
              onClick={() => void act(() => api.year(plans, lang), 'year')}
            >
              {ty(lang, 'openPlans', { plans })}
            </button>
          ) : null}
        </section>
        <Costs {...p} />
      </>
    );
  }
  const planned = p as Planned;
  const total = state.estimate?.computed ? state.estimate.total : null;
  const saving = state.journey.savings?.totalCentimes ?? 0;
  const exact = pages.confidence === 'exact';
  return (
    <>
      <TaxStrip state={state} pages={pages} lang={lang}>
        {total !== null && saving > 0 ? (
          <>
            <span class="strip-arrow" aria-hidden="true">
              <Icon.arrow />
            </span>
            <div class="strip-part strip-good">
              <span class="strip-label">{pg(lang, 'save.with')}</span>
              <span class="strip-amount">
                {exact ? null : <span class="strip-about">{pg(lang, 'tax.about')} </span>}
                <span class="tnum">
                  {(exact ? francs : roughFrancs)(Math.max(0, total - saving), lang)}
                </span>
              </span>
            </div>
          </>
        ) : undefined}
      </TaxStrip>
      <div class="page-head">
        <h1>{pg(lang, 'save.title')}</h1>
        <p class="lead">{pg(lang, 'save.lead', { year })}</p>
      </div>
      {saveCards(planned).map((c) => (
        <div key={c.id}>{c.el}</div>
      ))}
      <Costs {...p} />
    </>
  );
}
