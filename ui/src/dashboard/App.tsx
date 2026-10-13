// Screen 1, "Tell me and drop everything" (docs/design/1-intake.html): question card, answered
// chips, drop zone, documents, still missing, activity from the chat. Same state as Claude's tools.
import { wordmark } from '../shared/logo';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { api, ApiError } from './api';
import { Assessment } from './Assessment';
import { Checks } from './Checks';
import { CopyPanel } from './CopyPanel';
import { DocumentCards } from './DocumentCards';
import { isMessageKey, t, type Language } from './i18n';
import { Holdings } from './Holdings';
import { tp } from './i18n-planning';
import { LastYear } from './LastYear';
import { MoreBeforeDecember, TouCard } from './Planning';
import type { OfficialLink, Question, RequirementView, State, Value } from './types';

const POLL_MS = 2000;

function readLang(): Language | undefined {
  try {
    const v = localStorage.getItem('taxpresso.lang');
    return v === 'en' || v === 'fr' ? v : undefined;
  } catch {
    return undefined;
  }
}

function saveLang(lang: Language): void {
  try {
    localStorage.setItem('taxpresso.lang', lang);
  } catch {
    /* private window: the choice lasts for this page only */
  }
}

export function App(): JSX.Element {
  const [lang, setLang] = useState<Language | undefined>(readLang());
  const [state, setState] = useState<State | null>(null);
  const [lost, setLost] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Question | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [busy, setBusy] = useState('');
  const L: Language = lang ?? state?.lang ?? 'en';

  const refresh = useCallback(async () => {
    try {
      const next = await api.state(lang);
      setState(next);
      setLost(false);
      if (location.search) history.replaceState(null, '', '/');
    } catch {
      setLost(true);
    }
  }, [lang]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    document.documentElement.lang = L;
    document.title = t(L, 'docTitle');
  }, [L]);

  /** Runs a change, shows its error if any, and takes the fresh state it returns. */
  const act = async (fn: () => Promise<State>, label = ''): Promise<boolean> => {
    setError('');
    setBusy(label || 'busy');
    try {
      setState(await fn());
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t(L, 'lost'));
      return false;
    } finally {
      setBusy('');
    }
  };

  if (!state) {
    return (
      <main class="page">{lost ? <p class="banner banner-fix">{t(L, 'lost')}</p> : null}</main>
    );
  }

  const question = editing ?? state.question;
  const lastAnswer = state.answers.at(-1);

  return (
    <>
      <Header state={state} lang={L} onLang={(l) => (saveLang(l), setLang(l))} />
      <main class="page">
        <div class="columns">
          <div class="main-col">
            <section aria-labelledby="q-title" class="stack">
              <div class="intro">
                <h1>{t(L, 'title', { year: state.taxYear })}</h1>
                <p>{t(L, 'lead')}</p>
              </div>
              {state.vault.problem ? (
                <div class="banner banner-fix" role="alert">
                  <strong>{t(L, 'folderProblem')}</strong> {state.vault.problem}
                </div>
              ) : null}
              <TouCard state={state} lang={L} act={act} />
              <Plan3a state={state} lang={L} act={act} />
              <MoreBeforeDecember state={state} lang={L} act={act} />
              {state.chips.length ? (
                <div class="chips">
                  {state.chips.map((c) => (
                    <span class="chip chip-plain" key={c}>
                      {c}
                    </span>
                  ))}
                  <button type="button" class="link" onClick={() => setShowAnswers(!showAnswers)}>
                    {t(L, showAnswers ? 'hideAnswers' : 'editAnswers')}
                  </button>
                </div>
              ) : null}
              {showAnswers ? (
                <ul class="answers card">
                  {state.answers.map((a) => (
                    <li key={a.id}>
                      <span class="answer-q">
                        {a.who ? <span class="muted">{a.who} · </span> : null}
                        {a.question}
                      </span>
                      <span class="answer-a">{a.answer}</span>
                      <button
                        type="button"
                        class="ghost small"
                        onClick={() => void api.question(a.id, L).then(setEditing, () => undefined)}
                      >
                        {t(L, 'change')}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {question ? (
                <QuestionCard
                  key={`${question.id}:${L}:${editing ? 'edit' : 'ask'}:${JSON.stringify(question.suggested ?? null)}`}
                  q={question}
                  lang={L}
                  taxYear={state.taxYear}
                  editing={editing !== null}
                  position={
                    editing ? null : { n: state.progress.answered + 1, total: state.progress.total }
                  }
                  busy={busy !== ''}
                  error={error}
                  onAnswer={async (value) => {
                    if (await act(() => api.answer(question.id, value, L))) setEditing(null);
                  }}
                  onSkip={() => void act(() => api.skip(question.id, L))}
                  onBack={
                    !editing && lastAnswer
                      ? () => void api.question(lastAnswer.id, L).then(setEditing, () => undefined)
                      : undefined
                  }
                  onCancel={() => (setEditing(null), setError(''))}
                />
              ) : (
                <div class="card done">
                  <h2>{t(L, 'allDone')}</h2>
                  <p class="muted">{t(L, 'allDoneLead')}</p>
                </div>
              )}
            </section>
            <Assessment state={state} lang={L} />
            <Documents state={state} lang={L} busy={busy} act={act} />
            <Holdings state={state} lang={L} act={act} />
            <LastYear view={state.lastYear} year={state.taxYear} lang={L} />
            <DocumentCards state={state} lang={L} act={act} />
            <CopyPanel state={state} lang={L} act={act} />
          </div>
          <aside class="side-col">
            <Missing state={state} lang={L} act={act} />
            <Checks state={state} lang={L} act={act} />
            {state.notSupported.length ? (
              <section class="card side-card" aria-labelledby="ns-title">
                <h2 id="ns-title">{t(L, 'notSupportedTitle')}</h2>
                <ul class="plain-list">
                  {state.notSupported.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
                <p class="muted small-text">{state.notSupportedMessage}</p>
              </section>
            ) : null}
            <ActivityCard state={state} lang={L} />
          </aside>
        </div>
        {lost ? (
          <p class="banner banner-fix" role="status">
            {t(L, 'lost')}
          </p>
        ) : null}
      </main>
      <footer class="foot">
        <span>{t(L, 'footer')}</span>
        <span class="tnum">Taxpresso {state.version}</span>
      </footer>
    </>
  );
}

/** "1 200", "1'200", "95k" -> CHF number; empty -> 0. */
function parseChf(text: string): number | undefined {
  const s = text
    .trim()
    .toLowerCase()
    .replace(/[’'\s,]/g, '')
    .replace(/^chf/, '');
  if (s === '') return 0;
  const k = s.endsWith('k');
  const n = Number(k ? s.slice(0, -1) : s);
  return Number.isFinite(n) && n >= 0 ? Math.round(k ? n * 1000 : n) : undefined;
}

function money(centimes: number, lang: Language): string {
  return new Intl.NumberFormat(`${lang}-CH`, {
    style: 'currency',
    currency: 'CHF',
    maximumFractionDigits: 0,
  }).format(Math.round(centimes / 100));
}

/** "Before 31 December": pillar 3a room and the estimated saving (SPEC.md section 8, group B). */
function Plan3a({ state, lang, act }: { state: State; lang: Language; act: Act }) {
  const { inputs, result } = state.plan;
  const year = state.taxYear;
  const anyMax = result.people.some((p) => p.capIsMaximum);
  return (
    <section class="plan" aria-labelledby="plan-title">
      <span class="plan-when">{t(lang, 'planWhen')}</span>
      <h2 id="plan-title">
        {t(lang, 'planTitle')}
        <Explain text={t(lang, 'planExplain')} topic={t(lang, 'planTopic')} lang={lang} />
      </h2>
      <div class="plan-figures">
        <div class="figure">
          <span>{t(lang, 'planRoom', { year })}</span>
          <strong class="tnum">
            {anyMax
              ? t(lang, 'planUpTo', { amount: money(result.roomCentimes, lang) })
              : money(result.roomCentimes, lang)}
          </strong>
        </div>
        <div class="figure">
          <span>{t(lang, 'planSaving')}</span>
          {result.saving ? (
            <>
              <strong class="tnum saving">
                {money(Math.round(result.saving.totalCentimes / 1000) * 1000, lang)}
              </strong>
              <span class="figure-note tnum">
                {t(lang, 'planSavingSplit', {
                  icc: money(result.saving.cantonalCentimes, lang),
                  ifd: money(result.saving.federalCentimes, lang),
                })}
              </span>
            </>
          ) : (
            <span class="figure-note">{t(lang, 'planNeedSalary')}</span>
          )}
        </div>
      </div>
      <div class={`plan-people${inputs.length > 1 ? ' plan-people-two' : ''}`}>
        {inputs.map((input) => (
          <PlanPerson
            key={input.person}
            input={input}
            two={inputs.length > 1}
            lang={lang}
            act={act}
          />
        ))}
      </div>
      {state.planning.needsTou ? (
        <p class="banner banner-estimate">{tp(lang, 'onlyWithTou')}</p>
      ) : null}
      <div class="plan-points">
        <div>
          <strong>{t(lang, 'planGood')}</strong>
          <ul>
            <li>{t(lang, 'planPro1', { year })}</li>
            <li>{t(lang, 'planPro2')}</li>
          </ul>
        </div>
        <div>
          <strong>{t(lang, 'planMind')}</strong>
          <ul>
            <li>{t(lang, 'planCon1')}</li>
            <li>{t(lang, 'planCon2')}</li>
            <li>{t(lang, 'planCon3', { year })}</li>
            <li>{t(lang, 'planNew')}</li>
          </ul>
        </div>
      </div>
      <details class="plan-how">
        <summary>{t(lang, 'planHow')}</summary>
        <ul>
          {result.assumptions.map((a) => {
            const key = `assume.${a}`;
            return <li key={a}>{isMessageKey(key) ? t(lang, key) : a}</li>;
          })}
        </ul>
        <p>
          {t(lang, 'planSources')}: <span class="tnum">{result.sources.join(' · ')}</span>
        </p>
      </details>
    </section>
  );
}

function PlanPerson({
  input,
  two,
  lang,
  act,
}: {
  input: State['plan']['inputs'][number];
  two: boolean;
  lang: Language;
  act: Act;
}) {
  const shown = (c: number | null) => (c ? String(Math.round(c / 100)) : '');
  const [gross, setGross] = useState(shown(input.gross));
  const [paid, setPaid] = useState(shown(input.paid));
  const save = (field: 'gross' | 'paid', text: string, current: number | null) => {
    const value = parseChf(text);
    if (value === undefined || value * 100 === (current ?? 0)) return;
    void act(() => api.plan(input.person, field, value, lang));
  };
  const id = `plan-${input.person}`;
  return (
    <fieldset class="plan-person">
      {two ? <legend>{t(lang, input.person === 'p2' ? 'p2Short' : 'p1Short')}</legend> : null}
      <label for={`${id}-gross`}>{t(lang, 'planGross')}</label>
      <input
        id={`${id}-gross`}
        class="tnum"
        inputMode="numeric"
        placeholder="CHF"
        value={gross}
        onInput={(e) => setGross((e.target as HTMLInputElement).value)}
        onBlur={() => save('gross', gross, input.gross)}
        onKeyDown={(e) => e.key === 'Enter' && save('gross', gross, input.gross)}
      />
      <label for={`${id}-paid`}>{t(lang, 'planPaid')}</label>
      <input
        id={`${id}-paid`}
        class="tnum"
        inputMode="numeric"
        placeholder="CHF 0"
        value={paid}
        onInput={(e) => setPaid((e.target as HTMLInputElement).value)}
        onBlur={() => save('paid', paid, input.paid)}
        onKeyDown={(e) => e.key === 'Enter' && save('paid', paid, input.paid)}
      />
      <span class="plan-label" id={`${id}-fund`}>
        {t(lang, 'planFund')}
      </span>
      <div class="plan-toggle" role="group" aria-labelledby={`${id}-fund`}>
        {[true, false].map((v) => (
          <button
            type="button"
            key={String(v)}
            aria-pressed={input.hasPensionFund === v}
            onClick={() =>
              input.hasPensionFund !== v &&
              void act(() => api.plan(input.person, 'pensionFund', v, lang))
            }
          >
            {t(lang, v ? 'planFundYes' : 'planFundNo')}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Header({
  state,
  lang,
  onLang,
}: {
  state: State;
  lang: Language;
  onLang: (l: Language) => void;
}) {
  const steps = [t(lang, 'step1'), t(lang, 'step2'), t(lang, 'step3')];
  return (
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" dangerouslySetInnerHTML={{ __html: wordmark(true) }} />
        <span class="pill">{t(lang, 'yearPill', { year: state.taxYear })}</span>
      </div>
      <nav aria-label={t(lang, 'steps')} class="steps">
        {steps.map((label, i) => (
          <span
            key={label}
            class={`step${i === 0 ? ' step-current' : ''}`}
            aria-current={i === 0 ? 'step' : undefined}
            title={i > 0 ? t(lang, 'comingSoon') : undefined}
          >
            <span class="step-num">{i + 1}</span>
            {label}
          </span>
        ))}
      </nav>
      <div class="top-right">
        <button
          type="button"
          class="ghost"
          aria-label={t(lang, 'langButton')}
          onClick={() => onLang(lang === 'en' ? 'fr' : 'en')}
        >
          {lang === 'en' ? 'EN' : 'FR'}
        </button>
        <span class="chip chip-verified">{t(lang, 'localOnly')}</span>
      </div>
    </header>
  );
}

interface CardProps {
  q: Question;
  lang: Language;
  taxYear: number;
  editing: boolean;
  position: { n: number; total: number } | null;
  busy: boolean;
  error: string;
  onAnswer: (value: Value) => void | Promise<void>;
  onSkip: () => void;
  onBack: (() => void) | undefined;
  onCancel: () => void;
}

function initialDraft(q: Question): Value | undefined {
  // A suggestion (from last year's declaration) is preselected: the user confirms or changes it.
  const value = q.value ?? q.suggested;
  if (value === undefined)
    return q.type === 'multi' ? [] : q.type === 'number' ? (q.min ?? 0) : undefined;
  if (q.type === 'yesno') return value ? 'yes' : 'no';
  return value;
}

/** Where a suggestion comes from, in words. */
function suggestionNote(q: Question, lang: Language, taxYear: number): string {
  const from = q.suggestedFrom ?? {};
  const vars = { year: from.year ?? '', page: from.page ?? '', taxYear };
  if (from.kind !== 'prior_declaration') return t(lang, 'suggestedFromDoc', vars);
  return t(lang, from.year ? 'suggestedFromPrior' : 'suggestedFromPriorNoYear', vars);
}

function QuestionCard(p: CardProps) {
  const { q, lang } = p;
  const [draft, setDraft] = useState<Value | undefined>(initialDraft(q));
  const [touchedMulti, setTouchedMulti] = useState(
    q.value !== undefined || q.suggested !== undefined,
  );
  const selected = (v: string) => (Array.isArray(draft) ? draft.includes(v) : draft === v);
  const ready = q.type === 'multi' ? touchedMulti : draft !== undefined && draft !== '';
  const pickedUnsupported = (q.options ?? []).some((o) => o.notSupported && selected(o.value));

  const submit = () => {
    if (!ready || draft === undefined) return;
    void p.onAnswer(q.type === 'yesno' ? draft === 'yes' : draft);
  };

  let control: JSX.Element;
  if (q.type === 'number') {
    const n = typeof draft === 'number' ? draft : (q.min ?? 0);
    const set = (v: number) => setDraft(Math.max(q.min ?? 0, Math.min(q.max ?? 99, v)));
    control = (
      <div class="stepper">
        <button type="button" class="ghost square" aria-label="−1" onClick={() => set(n - 1)}>
          −
        </button>
        <input
          class="tnum"
          type="number"
          inputMode="numeric"
          min={q.min}
          max={q.max}
          value={n}
          aria-labelledby="q-title"
          onInput={(e) => set(Number((e.target as HTMLInputElement).value) || 0)}
        />
        <button type="button" class="ghost square" aria-label="+1" onClick={() => set(n + 1)}>
          +
        </button>
      </div>
    );
  } else if (q.type === 'commune') {
    control = (
      <select
        class="select"
        value={typeof draft === 'string' ? draft : ''}
        aria-labelledby="q-title"
        onChange={(e) => setDraft((e.target as HTMLSelectElement).value)}
      >
        <option value="" disabled>
          {t(lang, 'chooseCommune')}
        </option>
        {q.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else {
    const multi = q.type === 'multi';
    const toggle = (v: string) => {
      if (!multi) return setDraft(v);
      setTouchedMulti(true);
      const list = Array.isArray(draft) ? draft : [];
      setDraft(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
    };
    control = (
      <div
        role="group"
        aria-labelledby="q-title"
        class={`options${(q.options?.length ?? 0) > 3 ? ' options-wide' : ''}`}
      >
        {q.options?.map((o) => (
          <button
            type="button"
            key={o.value}
            class="option"
            aria-pressed={selected(o.value)}
            onClick={() => toggle(o.value)}
          >
            {o.label}
          </button>
        ))}
        {multi ? (
          <button
            type="button"
            class="option option-none"
            aria-pressed={touchedMulti && Array.isArray(draft) && draft.length === 0}
            onClick={() => (setTouchedMulti(true), setDraft([]))}
          >
            {q.none ?? t(lang, 'none')}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div class="card question">
      {p.position ? (
        <div class="q-progress">
          <span>
            {t(lang, 'questionOf', {
              n: p.position.n,
              total: Math.max(p.position.total, p.position.n),
            })}
          </span>
          <div class="bar" aria-hidden="true">
            <div
              class="bar-fill"
              style={{
                width: `${Math.round(((p.position.n - 1) / Math.max(p.position.total, 1)) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : null}
      <div class="q-head">
        {q.who ? <span class="who">{t(lang, 'forWho', { who: q.who })}</span> : null}
        <h2 id="q-title">
          {q.text}
          {q.explain ? (
            <Explain text={q.explain} topic={q.text} lang={lang} link={q.learnMore} question />
          ) : null}
        </h2>
        {q.help ? <p class="muted">{q.help}</p> : null}
        {q.skipped ? <p class="muted small-text">{t(lang, 'skippedNote')}</p> : null}
      </div>
      {q.suggested !== undefined && q.value === undefined ? (
        <p class="suggestion" role="note">
          <span class="chip chip-needs-ok">{t(lang, 'statusNeedsOk')}</span>
          <span>{suggestionNote(q, lang, p.taxYear)}</span>
        </p>
      ) : null}
      {control}
      {pickedUnsupported ? (
        <p class="banner banner-estimate">{t(lang, 'notSupportedPick')}</p>
      ) : null}
      {p.error ? (
        <p class="banner banner-fix" role="alert">
          {p.error}
        </p>
      ) : null}
      <div class="q-actions">
        {p.editing ? (
          <button type="button" class="link" onClick={p.onCancel}>
            {t(lang, 'cancel')}
          </button>
        ) : p.onBack ? (
          <button type="button" class="link" onClick={p.onBack}>
            {t(lang, 'back')}
          </button>
        ) : (
          <span />
        )}
        <div class="q-buttons">
          {p.editing ? null : (
            <button type="button" class="ghost" onClick={p.onSkip} disabled={p.busy}>
              {t(lang, 'skip')}
            </button>
          )}
          <button type="button" class="primary" onClick={submit} disabled={!ready || p.busy}>
            {t(lang, p.editing ? 'save' : q.suggested !== undefined ? 'confirmNext' : 'next')}
          </button>
        </div>
      </div>
    </div>
  );
}

type Act = (fn: () => Promise<State>, label?: string) => Promise<boolean>;

function Documents({
  state,
  lang,
  busy,
  act,
}: {
  state: State;
  lang: Language;
  busy: string;
  act: Act;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const todo = state.documents.filter((d) => !d.kind).length;
  const couple = state.people.length > 1;

  const add = async (files: FileList | File[] | null) => {
    for (const file of Array.from(files ?? [])) {
      await act(() => api.upload(file, lang), t(lang, 'uploading', { name: file.name }));
    }
  };

  return (
    <section aria-labelledby="docs-title" class="stack">
      <div class="section-head">
        <h2 id="docs-title">{t(lang, 'documents')}</h2>
        {state.documents.length ? (
          <span class="muted">
            {state.documents.length === 1
              ? t(lang, 'documentOne')
              : t(lang, 'documentsMany', { n: state.documents.length })}
            {todo ? ` · ${t(lang, 'toIdentify', { todo })}` : ''}
          </span>
        ) : null}
      </div>
      <div
        class={`drop${over ? ' drop-over' : ''}`}
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void add(e.dataTransfer?.files ?? null);
        }}
      >
        <div class="drop-icon" aria-hidden="true">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#16181B"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
          </svg>
        </div>
        <div class="drop-text">
          <strong>{t(lang, 'dropTitle')}</strong>
          <span class="muted">{t(lang, 'dropText')}</span>
          <span class="drop-path tnum small-text muted">{state.vault.path}</span>
          {busy && busy !== 'busy' ? (
            <span class="small-text" role="status">
              {busy}
            </span>
          ) : null}
        </div>
        <div class="drop-buttons">
          <button type="button" class="ghost" onClick={() => input.current?.click()}>
            {t(lang, 'chooseFiles')}
          </button>
          <button type="button" class="link" onClick={() => void act(() => api.scan(lang))}>
            {t(lang, 'checkFolder')}
          </button>
        </div>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const el = e.target as HTMLInputElement;
            void add(el.files).then(() => (el.value = ''));
          }}
        />
      </div>
      {state.documents.length ? (
        <ul class="card doc-list">
          {state.documents.map((d) => (
            <li key={d.id} class="doc">
              <div class="doc-name">
                <span class="doc-file">{d.filename}</span>
                <span class="muted small-text tnum">{formatBytes(d.bytes, lang)}</span>
              </div>
              <div class="doc-controls">
                <label class="sr-only" for={`kind-${d.id}`}>
                  {t(lang, 'whatIsThis')}
                </label>
                <select
                  id={`kind-${d.id}`}
                  class="select small"
                  value={d.kind ?? ''}
                  onChange={(e) =>
                    void act(() =>
                      api.setKind(d.id, (e.target as HTMLSelectElement).value, d.person, lang),
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
                {couple && d.kind ? (
                  <select
                    class="select small"
                    aria-label={t(lang, 'whose')}
                    value={d.person ?? ''}
                    onChange={(e) =>
                      void act(() =>
                        api.setKind(
                          d.id,
                          d.kind!,
                          (e.target as HTMLSelectElement).value || undefined,
                          lang,
                        ),
                      )
                    }
                  >
                    <option value="">{t(lang, 'whose')}</option>
                    {state.people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                    <option value="household">{t(lang, 'both')}</option>
                  </select>
                ) : null}
                {d.barcode === 'pending' ? (
                  <span class="chip chip-needs-ok">{t(lang, 'barcodeWhose')}</span>
                ) : d.barcode === 'read' ? (
                  <span class="chip chip-verified">{t(lang, 'statusFromBarcode')}</span>
                ) : d.kindSource === 'export' || d.kindSource === 'pdf_text' ? (
                  <span class="chip chip-verified">{t(lang, 'statusRecognised')}</span>
                ) : (
                  <span
                    class={`chip ${d.kind && d.kindSource !== 'claude' ? 'chip-stated' : 'chip-needs-ok'}`}
                  >
                    {t(
                      lang,
                      d.kind && d.kindSource !== 'claude' ? 'statusConfirmed' : 'statusNeedsOk',
                    )}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Missing({ state, lang, act }: { state: State; lang: Language; act: Act }) {
  // In a couple, the same document for each person is one row: "Health insurance · You / Partner".
  const groups = new Map<string, RequirementView[]>();
  for (const r of state.requirements) groups.set(r.group, [...(groups.get(r.group) ?? []), r]);
  const all = [...groups.values()];
  const open = all.filter((rows) => rows.some((r) => r.status !== 'satisfied'));
  const done = all.filter((rows) => rows.every((r) => r.status === 'satisfied'));
  const count = open.filter((rows) =>
    rows.some((r) => r.status === 'missing' && !r.optional),
  ).length;
  return (
    <section class="card side-card" aria-labelledby="missing-title">
      <div class="section-head">
        <h2 id="missing-title">{t(lang, 'missingTitle')}</h2>
        <span class="muted tnum">{count}</span>
      </div>
      {open.length === 0 ? <p class="muted">{t(lang, 'missingNone')}</p> : null}
      <ul class="req-list">
        {open.map((rows) =>
          rows.length > 1 ? (
            <RequirementGroup key={rows[0]!.group} rows={rows} lang={lang} act={act} />
          ) : (
            <RequirementRow key={rows[0]!.id} r={rows[0]!} lang={lang} act={act} />
          ),
        )}
      </ul>
      {done.length ? (
        <details class="got">
          <summary>
            {t(lang, 'gotTitle')} <span class="muted tnum">{done.length}</span>
          </summary>
          <ul class="plain-list">
            {done.map((rows) => (
              <li key={rows[0]!.group}>{rows[0]!.label}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/** Uploads files from a "still missing" row; the row already says what they are and whose. */
function useUpload(lang: Language, act: Act) {
  const input = useRef<HTMLInputElement>(null);
  const preset = useRef<{ kind: string; person?: string } | null>(null);
  const pick = (p: { kind: string; person?: string }) => {
    preset.current = p;
    input.current?.click();
  };
  const field = (
    <input
      ref={input}
      type="file"
      multiple
      hidden
      onChange={(e) => {
        const el = e.target as HTMLInputElement;
        const files = Array.from(el.files ?? []);
        const p = preset.current;
        void (async () => {
          for (const file of files) await act(() => api.upload(file, lang, p ?? undefined));
          el.value = '';
        })();
      }}
    />
  );
  return { pick, field };
}

function RequirementGroup({
  rows,
  lang,
  act,
}: {
  rows: RequirementView[];
  lang: Language;
  act: Act;
}) {
  const first = rows[0]!;
  const missing = rows.filter((r) => r.status === 'missing');
  const [whom, setWhom] = useState(
    missing.length > 1 || missing.length === 0 ? 'household' : missing[0]!.person,
  );
  const upload = useUpload(lang, act);
  const short = (person: string) => t(lang, person === 'p2' ? 'p2Short' : 'p1Short');
  return (
    <li class="req">
      <strong>
        {first.label}
        {first.explain ? (
          <Explain text={first.explain} topic={first.label} lang={lang} link={first.learnMore} />
        ) : null}
      </strong>
      <span class="muted small-text">{first.reason}</span>
      <div class="req-actions">
        {rows.map((r) => (
          <span
            key={r.id}
            class={`chip ${r.status === 'satisfied' ? 'chip-stated' : 'chip-missing'}`}
          >
            {t(lang, r.status === 'satisfied' ? 'personHere' : 'personMissing', {
              who: short(r.person),
            })}
          </span>
        ))}
      </div>
      {first.kind ? (
        <div class="req-actions">
          <label class="sr-only" for={`whom-${first.group}`}>
            {t(lang, 'forWhom')}
          </label>
          <select
            id={`whom-${first.group}`}
            class="select small"
            value={whom}
            onChange={(e) => setWhom((e.target as HTMLSelectElement).value)}
          >
            {rows.map((r) => (
              <option key={r.person} value={r.person}>
                {short(r.person)}
              </option>
            ))}
            <option value="household">{t(lang, 'both')}</option>
          </select>
          <button
            type="button"
            class="ghost small"
            onClick={() => upload.pick({ kind: first.kind!, person: whom })}
          >
            {t(lang, 'upload')}
          </button>
          {upload.field}
        </div>
      ) : null}
    </li>
  );
}

function RequirementRow({ r, lang, act }: { r: RequirementView; lang: Language; act: Act }) {
  const upload = useUpload(lang, act);
  const status =
    r.status === 'waived'
      ? { cls: 'chip-computed', label: t(lang, 'statusSkipped') }
      : r.optional
        ? { cls: 'chip-missing', label: t(lang, 'statusOptional') }
        : { cls: 'chip-missing', label: t(lang, 'statusMissing') };
  return (
    <li class="req">
      <strong>
        {r.label}
        {r.who ? <span class="muted"> · {r.who}</span> : null}
        {r.explain ? (
          <Explain text={r.explain} topic={r.label} lang={lang} link={r.learnMore} />
        ) : null}
      </strong>
      <span class="muted small-text">{r.reason}</span>
      <div class="req-actions">
        <span class={`chip ${status.cls}`}>{status.label}</span>
        {r.need > 1 ? (
          <span class="muted small-text tnum">
            {t(lang, 'haveOf', { have: r.have, need: r.need })}
          </span>
        ) : null}
        {r.status !== 'waived' && r.kind ? (
          <button
            type="button"
            class="ghost small"
            onClick={() =>
              upload.pick({
                kind: r.kind!,
                ...(r.person !== 'household' ? { person: r.person } : {}),
              })
            }
          >
            {t(lang, 'upload')}
          </button>
        ) : null}
        {r.optional ? (
          <button
            type="button"
            class="link"
            onClick={() => void act(() => api.waive(r.id, r.status !== 'waived', lang))}
          >
            {t(lang, r.status === 'waived' ? 'undoSkip' : 'skipDoc')}
          </button>
        ) : null}
        {upload.field}
      </div>
    </li>
  );
}

/**
 * A "?" that opens a plain-language explanation on hover, focus or tap, with a way to ask Claude.
 * The page can't talk to Claude itself (our code never calls a model, SPEC.md C1): it copies a
 * ready question for the user's Claude chat, where they can also speak it. An official page on the
 * topic, when there is one, opens in a new tab: a plain link, the extension fetches nothing (C2).
 */
function Explain({
  text,
  topic,
  lang,
  link,
  question = false,
}: {
  text: string;
  topic: string;
  lang: Language;
  link?: OfficialLink | undefined;
  question?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');
  const prompt = t(lang, question ? 'askQuestionPrompt' : 'askPrompt', { topic });
  const ask = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied('yes');
    } catch {
      setCopied('failed');
    }
  };
  return (
    <span
      class="explain"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => (setOpen(false), setCopied('no'))}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <button
        type="button"
        class="explain-btn"
        aria-expanded={open}
        aria-label={question ? t(lang, 'whatMeans') : t(lang, 'whatIs', { topic })}
        onClick={() => setOpen(!open)}
      >
        ?
      </button>
      {open ? (
        <span class="explain-pop" role="tooltip">
          <span class="explain-text">{text}</span>
          {link ? (
            <a class="explain-link" href={link.url} target="_blank" rel="noopener noreferrer">
              <span class="explain-link-text">{t(lang, 'officialPage')}</span>
              <span aria-hidden="true"> ↗</span>
              <span class="explain-note">{link.label}</span>
            </a>
          ) : null}
          <button type="button" class="ask" onClick={() => void ask()}>
            {t(lang, 'askClaude')}
          </button>
          {copied === 'yes' ? <span class="explain-note">{t(lang, 'copied')}</span> : null}
          {copied === 'failed' ? (
            <span class="explain-note">
              {t(lang, 'copyFallback')} <q>{prompt}</q>
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

function ActivityCard({ state, lang }: { state: State; lang: Language }) {
  const time = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' });
  const items = state.activity.filter((a) => isMessageKey(`act.${a.by}.${a.what}`)).slice(0, 8);
  return (
    <section class="card side-card" aria-labelledby="activity-title">
      <h2 id="activity-title">{t(lang, 'activityTitle')}</h2>
      {items.length ? (
        <ol class="activity">
          {items.map((a, i) => {
            const key = `act.${a.by}.${a.what}`;
            return (
              <li key={`${a.at}-${i}`}>
                <time class="tnum" dateTime={a.at}>
                  {time.format(new Date(a.at))}
                </time>{' '}
                {isMessageKey(key) ? t(lang, key, { detail: a.detail ?? '' }) : ''}
              </li>
            );
          })}
        </ol>
      ) : (
        <p class="muted">{t(lang, 'activityEmpty')}</p>
      )}
    </section>
  );
}

function formatBytes(bytes: number, lang: Language): string {
  const f = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  return bytes < 1024 * 1024
    ? `${f.format(Math.max(1, bytes / 1024))} KB`
    : `${f.format(bytes / 1024 / 1024)} MB`;
}
