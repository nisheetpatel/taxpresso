// "Your securities and accounts" (état des titres, SPEC.md 5.7 and 8 group A): the lines in the
// official form's order (accounts F2, securities F3, tax statements F4), whose each is, the
// official value next to the broker's estimate, the Swiss withholding tax you get back, foreign
// tax, the totals, the other wealth and debts, and a place to enter a security's official value.
// Every amount comes computed from the extension, in integer centimes; nothing is computed here.
import { useState } from 'preact/hooks';
import type { ComponentChildren, JSX } from 'preact';
import './holdings.css';
import { api, ApiError } from './api';
import type { Language } from './i18n';
import { formatChf, td } from './i18n-docs';
import { th } from './i18n-holdings';
import type { State } from './types';
import type { HoldingLine, HoldingsView, OtherHolding, ValueState } from './types-holdings';

type Act = (fn: () => Promise<State>, label?: string) => Promise<boolean>;

function StateChip({ state, lang }: { state: ValueState; lang: Language }) {
  const [cls, label] =
    state === 'needs_ok'
      ? ['chip-needs-ok', td(lang, 'statusNeedsOk')]
      : state === 'estimate'
        ? ['chip-estimate', td(lang, 'statusEstimate')]
        : ['chip-stated', td(lang, 'statusConfirmed')];
  return <span class={`chip ${cls}`}>{label}</span>;
}

/** A decimal string from the ledger ("3.5"), grouped for the reader, exactly. */
function decimal(value: string, lang: Language): string {
  if (!/^-?\d+(\.\d+)?$/.test(value)) return value;
  return new Intl.NumberFormat(`${lang}-CH`, { maximumFractionDigits: 20 }).format(
    value as `${number}`,
  );
}

/** Basis points as a percentage, from integers: 1500 -> "15", 1280 -> "12.8". */
function percent(bp: number, lang: Language): string {
  const whole = Math.trunc(bp / 100);
  const rest = String(bp % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  return rest ? `${whole}${lang === 'fr' ? ',' : '.'}${rest}` : String(whole);
}

function OwnerChoice({
  line,
  view,
  lang,
  act,
}: {
  line: HoldingLine | OtherHolding;
  view: HoldingsView;
  lang: Language;
  act: Act;
}) {
  if (!view.couple)
    return line.ownerLabel ? <span class="muted small-text">{line.ownerLabel}</span> : null;
  // A line read from a document belongs to whoever the document is for: no "children" there.
  const options = view.owners.filter((o) => line.origin !== 'document' || o.value !== 'children');
  return (
    <label class="hold-owner">
      <span class="small-text muted">{th(lang, 'owner')}</span>
      <select
        value={line.owner ?? ''}
        onChange={(e) => {
          const owner = (e.target as HTMLSelectElement).value as HoldingLine['owner'] & string;
          if (owner) void act(() => api.holdingOwner(line.id, line.origin, owner, lang));
        }}
      >
        {line.owner ? null : <option value="">{th(lang, 'ownerMissing')}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function OfficialForm({
  line,
  year,
  lang,
  act,
  onDone,
}: {
  line: HoldingLine;
  year: number;
  lang: Language;
  act: Act;
  onDone: () => void;
}) {
  const [value, setValue] = useState('');
  const [from, setFrom] = useState(line.official?.from ?? '');
  const [problem, setProblem] = useState('');
  const save = async () => {
    setProblem('');
    try {
      const next = await api.holdingOfficial(line.id, value, from, lang);
      await act(() => Promise.resolve(next));
      onDone();
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : td(lang, 'editFailed'));
    }
  };
  return (
    <form
      class="hold-official-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label>
        <span class="small-text">{th(lang, 'officialAmount')}</span>
        <input
          class="tnum"
          inputMode="decimal"
          required
          value={value}
          onInput={(e) => setValue((e.target as HTMLInputElement).value)}
        />
      </label>
      <label>
        <span class="small-text">{th(lang, 'officialFromLabel')}</span>
        <input
          required
          value={from}
          placeholder={th(lang, 'officialFromHint', { year })}
          onInput={(e) => setFrom((e.target as HTMLInputElement).value)}
        />
      </label>
      <div class="hold-official-actions">
        <button type="submit" class="primary dc-small">
          {td(lang, 'save')}
        </button>
        <button type="button" class="link" onClick={onDone}>
          {td(lang, 'cancel')}
        </button>
      </div>
      {problem ? (
        <p class="small-text dc-problem" role="alert">
          {problem}
        </p>
      ) : null}
    </form>
  );
}

function Figure({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ComponentChildren;
}) {
  return (
    <div class={wide ? 'hold-fig-wide' : undefined}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function LineRow({
  line,
  view,
  lang,
  act,
}: {
  line: HoldingLine;
  view: HoldingsView;
  lang: Language;
  act: Act;
}) {
  const [entering, setEntering] = useState(false);
  const c = line.columns;
  const sub = [
    line.kindLabel,
    line.quantity ? th(lang, 'held', { quantity: decimal(line.quantity, lang) }) : undefined,
    line.civilite ? th(lang, 'civilite', { c: line.civilite }) : undefined,
  ].filter(Boolean);
  return (
    <li class={`hold-row${line.complete ? '' : ' hold-row-missing'}`}>
      <div class="hold-head">
        <div class="hold-name">
          <strong>{line.name}</strong>
          {line.reference || sub.length ? (
            <span class="muted small-text">
              {line.reference ? <span class="tnum">{line.reference}</span> : null}
              {line.reference && sub.length ? ' · ' : ''}
              {sub.join(' · ')}
            </span>
          ) : null}
        </div>
        <div class="hold-head-side">
          <OwnerChoice line={line} view={view} lang={lang} act={act} />
          <StateChip state={line.state} lang={lang} />
        </div>
      </div>
      <dl class="hold-figures">
        <Figure label={th(lang, 'colValue')} wide>
          <span class="tnum hold-amount">{formatChf(c.taxableValue, lang)}</span>
          {line.valueBasis === 'official' && line.official ? (
            <span class="chip chip-stated">
              {td(lang, line.official.via === 'chat' ? 'statusConfirmedChat' : 'statusConfirmed')}
            </span>
          ) : line.valueBasis === 'broker' ? (
            <span class="chip chip-estimate">{td(lang, 'statusEstimate')}</span>
          ) : null}
          {line.valueBasis === 'official' && line.official ? (
            <span class="hold-sub muted">
              {line.official.from
                ? th(lang, 'officialFrom', { from: line.official.from })
                : th(lang, 'official_')}
              {line.brokerChf !== undefined
                ? ` · ${th(lang, 'brokerValue', { amount: formatChf(line.brokerChf, lang) })}`
                : ''}
            </span>
          ) : line.valueBasis === 'broker' ? (
            <span class="hold-sub muted">{th(lang, 'broker')}</span>
          ) : null}
        </Figure>
        <Figure label={th(lang, 'colSubject')}>
          <span class="tnum">{formatChf(c.subjectIa, lang)}</span>
        </Figure>
        <Figure label={th(lang, 'colNotSubject')}>
          <span class="tnum">{formatChf(c.notSubjectIa, lang)}</span>
        </Figure>
        {line.withholdingSwiss ? (
          <Figure label={th(lang, 'colWithheld')}>
            <span class="tnum">{formatChf(line.withholdingSwiss, lang)}</span>
          </Figure>
        ) : null}
        {line.foreign ? (
          <Figure label={th(lang, 'colForeign')}>
            <span class="tnum">{formatChf(line.foreign.withheld, lang)}</span>
            {line.foreign.nonRecoverable !== undefined && line.foreign.rateBp !== undefined ? (
              <span class="hold-sub muted">
                {th(lang, 'nonRecoverable', {
                  amount: formatChf(line.foreign.nonRecoverable, lang),
                  rate: percent(line.foreign.rateBp, lang),
                })}
                {line.foreign.recoverableAbroad
                  ? ` · ${th(lang, 'recoverable', { amount: formatChf(line.foreign.recoverableAbroad, lang) })}`
                  : ''}
              </span>
            ) : null}
          </Figure>
        ) : null}
        {c.fees ? (
          <Figure label={th(lang, 'colFees')}>
            <span class="tnum">{formatChf(c.fees, lang)}</span>
          </Figure>
        ) : null}
      </dl>
      {line.issues.length || line.foreignCaveat ? (
        <ul class="hold-issues">
          {line.issues.map((i, n) => (
            <li key={n} class={i.severity === 'missing' ? 'hold-issue-missing' : undefined}>
              {i.severity === 'missing' ? (
                <span class="chip chip-missing">{th(lang, 'statusMissing')}</span>
              ) : null}
              <span>{i.text}</span>
            </li>
          ))}
          {line.foreignCaveat ? <li class="muted">{line.foreignCaveat}</li> : null}
        </ul>
      ) : null}
      {line.canEnterOfficial ? (
        entering ? (
          <OfficialForm
            line={line}
            year={view.taxYear}
            lang={lang}
            act={act}
            onDone={() => setEntering(false)}
          />
        ) : (
          <div>
            <button type="button" class="ghost small" onClick={() => setEntering(true)}>
              {th(lang, line.official ? 'changeOfficial' : 'enterOfficial')}
            </button>
          </div>
        )
      ) : null}
    </li>
  );
}

function OtherRow({
  item,
  view,
  lang,
  act,
}: {
  item: OtherHolding;
  view: HoldingsView;
  lang: Language;
  act: Act;
}) {
  return (
    <li class={`hold-row${item.complete ? '' : ' hold-row-missing'}`}>
      <div class="hold-head">
        <div class="hold-name">
          <strong>{item.name}</strong>
          <span class="muted small-text">
            {item.label} ({item.code})
          </span>
        </div>
        <div class="hold-head-side">
          <OwnerChoice line={item} view={view} lang={lang} act={act} />
          <StateChip state={item.state} lang={lang} />
        </div>
      </div>
      <dl class="hold-figures">
        {item.value !== undefined ? (
          <Figure label={`${item.label} (${item.code})`}>
            <span class="tnum">{formatChf(item.value, lang)}</span>
          </Figure>
        ) : null}
        {item.flow !== undefined && item.flowLabel ? (
          <Figure label={`${item.flowLabel} (${item.flowCode ?? ''})`}>
            <span class="tnum">{formatChf(item.flow, lang)}</span>
          </Figure>
        ) : null}
      </dl>
      {item.issues.length ? (
        <ul class="hold-issues">
          {item.issues.map((i, n) => (
            <li key={n}>{i.text}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function Holdings({
  state,
  lang,
  act,
}: {
  state: State;
  lang: Language;
  act: Act;
}): JSX.Element | null {
  const view = state.holdings;
  const warnings = state.securities?.warnings ?? [];
  if (!view && !warnings.length) return null;
  const count = view
    ? view.sections.reduce((n, s) => n + s.lines.length, 0) + view.other.length
    : 0;
  return (
    <section class="stack" aria-labelledby="hold-title">
      <div class="section-head">
        <h2 id="hold-title">
          {th(lang, 'title')} <span class="hold-official">({th(lang, 'official')})</span>
        </h2>
        <span class="muted">
          {count === 1 ? th(lang, 'linesOne') : th(lang, 'lines', { n: count })}
        </span>
      </div>
      <div class="card hold-card">
        <p class="hold-lead">{th(lang, 'lead')}</p>
        {view ? <Summary view={view} lang={lang} /> : null}
        {view?.exports
          .filter((e) => e.toConfirm > 0)
          .map((e) => (
            <div class="hold-confirm" key={e.docId}>
              <span>
                {e.toConfirm === 1
                  ? th(lang, 'exportToConfirmOne', { file: e.filename })
                  : th(lang, 'exportToConfirm', { file: e.filename, n: e.toConfirm })}
              </span>
              <button
                type="button"
                class="ghost small"
                onClick={() => void act(() => api.confirmDocument(e.docId, lang))}
              >
                {th(lang, 'confirmExport')}
              </button>
            </div>
          ))}
        {view?.sections
          .filter((s) => s.lines.length)
          .map((s) => (
            <div class="hold-section" key={s.id}>
              <h3>
                <span class="hold-form tnum">{s.form}</span> {s.label}
                {lang === 'en' ? (
                  <span class="hold-official" lang="fr">
                    {' '}
                    ({s.official})
                  </span>
                ) : null}
              </h3>
              <ul class="hold-list">
                {s.lines.map((l) => (
                  <LineRow key={l.id} line={l} view={view} lang={lang} act={act} />
                ))}
              </ul>
              {s.lines.length > 1 ? (
                <dl class="hold-figures hold-subtotal">
                  <Figure label={`${th(lang, 'subtotal')} · ${th(lang, 'colValue')}`}>
                    <span class="tnum">{formatChf(s.subtotal.taxableValue, lang)}</span>
                  </Figure>
                  <Figure label={th(lang, 'colSubject')}>
                    <span class="tnum">{formatChf(s.subtotal.subjectIa, lang)}</span>
                  </Figure>
                  <Figure label={th(lang, 'colNotSubject')}>
                    <span class="tnum">{formatChf(s.subtotal.notSubjectIa, lang)}</span>
                  </Figure>
                </dl>
              ) : null}
            </div>
          ))}
        {view?.other.length ? (
          <div class="hold-section">
            <h3>{th(lang, 'otherTitle')}</h3>
            <ul class="hold-list">
              {view.other.map((o) => (
                <OtherRow key={o.id} item={o} view={view} lang={lang} act={act} />
              ))}
            </ul>
          </div>
        ) : null}
        {view?.general.length ? (
          <ul class="hold-issues">
            {view.general.map((i, n) => (
              <li key={n}>{i.text}</li>
            ))}
          </ul>
        ) : null}
        {view?.sections.some((s) => s.lines.some((l) => l.canEnterOfficial)) ? (
          <details class="hold-details">
            <summary>{th(lang, 'howToFind')}</summary>
            <p>{view.officialHelp}</p>
          </details>
        ) : null}
        {warnings.length ? (
          <details class="hold-details" open={warnings.length <= 3}>
            <summary>
              {warnings.length === 1
                ? th(lang, 'warningsOne')
                : th(lang, 'warnings', { n: warnings.length })}
            </summary>
            <ul>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}

function Summary({ view, lang }: { view: HoldingsView; lang: Language }) {
  const { ia, ies } = view;
  return (
    <div class="hold-summary">
      <div class="hold-stat hold-stat-back">
        <span class="hold-stat-label">{th(lang, 'back')}</span>
        <strong class="tnum">{formatChf(ia.claim, lang)}</strong>
        <span class="small-text muted">
          {th(lang, 'backLead', { subject: formatChf(ia.subject, lang) })}
          {ia.complete ? '' : ` ${th(lang, 'backSoFar')}`}
        </span>
      </div>
      <div class="hold-stat">
        <span class="hold-stat-label">{th(lang, 'value')}</span>
        <strong class="tnum">{formatChf(view.totals.taxableValue, lang)}</strong>
        <span class="small-text muted" lang="fr">
          {th(lang, 'valueOfficial', { code: view.rubrics.wealth })}
        </span>
      </div>
      <div class="hold-stat">
        <span class="hold-stat-label">{th(lang, 'income')}</span>
        <strong class="tnum">{formatChf(view.income, lang)}</strong>
        <span class="small-text muted" lang="fr">
          {th(lang, 'incomeOfficial', { code: view.rubrics.income })}
        </span>
      </div>
      {ies.nonRecoverable || ies.claimable === undefined || ies.recoverableAbroad ? (
        <div class="hold-stat">
          <span class="hold-stat-label">{th(lang, 'foreign')}</span>
          <span class="small-text">
            {ies.claimable
              ? th(lang, 'foreignCredit', { amount: formatChf(ies.requested, lang) })
              : ies.claimable === false
                ? th(lang, 'foreignSmall', { amount: formatChf(ies.incomeReduction, lang) })
                : th(lang, 'foreignPending')}
            {ies.recoverableAbroad
              ? ` ${th(lang, 'foreignAbroad', { amount: formatChf(ies.recoverableAbroad, lang) })}`
              : ''}
          </span>
        </div>
      ) : null}
      {view.estimate ? <p class="small-text muted hold-note">{th(lang, 'estimateNote')}</p> : null}
    </div>
  );
}
