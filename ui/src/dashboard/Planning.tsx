// "Before 31 December" beyond the 3a room, and the TOU decision (SPEC.md section 8, groups B and
// C; docs/design/2-optimizations.html): a pension fund buy-in, the 3a catch-up, and for people
// taxed at source the comparison, the deadline, the irreversibility and an explicit decision.
// Every figure comes from the extension (extension/src/planning.ts); this page only shows them.
import './planning.css';
import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { api } from './api';
import { t, type Language } from './i18n';
import { assumption, day, pck, type PlanningMessageKey, tp } from './i18n-planning';
import type { PlannedState, State } from './types';
import type { Estimate, PlanningField, PlanningState } from './types-planning';

type Act = (fn: () => Promise<State>, label?: string) => Promise<boolean>;
interface Props {
  /** A year whose plans before 31 December apply (types.ts, isPlanned). */
  state: PlannedState;
  lang: Language;
  act: Act;
}

function chf(centimes: number, lang: Language): string {
  return new Intl.NumberFormat(`${lang}-CH`, {
    style: 'currency',
    currency: 'CHF',
    maximumFractionDigits: 0,
  }).format(Math.round(centimes / 100));
}
/** Estimates are shown to the nearest CHF 10, as on the 3a card. */
const about = (centimes: number, lang: Language) => chf(Math.round(centimes / 1000) * 1000, lang);

/** "1 200", "1'200", "95k" -> CHF; empty -> undefined. */
function parseChf(text: string): number | undefined {
  const s = text
    .trim()
    .toLowerCase()
    .replace(/[’'\s,]/g, '')
    .replace(/^chf/, '');
  if (s === '') return undefined;
  const k = s.endsWith('k');
  const n = Number(k ? s.slice(0, -1) : s);
  return Number.isFinite(n) && n >= 0 ? Math.round(k ? n * 1000 : n) : undefined;
}

/** A CHF field that saves on blur or Enter. Emptying it clears the figure. */
function MoneyField(p: {
  id: string;
  label: string;
  hint?: string;
  centimes: number | null;
  onSave: (chf: number) => void;
}) {
  const [text, setText] = useState(p.centimes === null ? '' : String(Math.round(p.centimes / 100)));
  const save = () => {
    const value = parseChf(text);
    if (value === undefined) {
      if (text.trim() === '' && p.centimes !== null) p.onSave(0);
      return;
    }
    if (p.centimes === null || value * 100 !== p.centimes) p.onSave(value);
  };
  return (
    <div class="pl-field">
      <label for={p.id}>{p.label}</label>
      <input
        id={p.id}
        class="tnum"
        inputMode="numeric"
        placeholder="CHF"
        value={text}
        aria-describedby={p.hint ? `${p.id}-hint` : undefined}
        onInput={(e) => setText((e.target as HTMLInputElement).value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
      {p.hint ? (
        <span id={`${p.id}-hint`} class="pl-hint">
          {p.hint}
        </span>
      ) : null}
    </div>
  );
}

function Saving({
  saving,
  lang,
  canton,
}: {
  saving: Estimate;
  lang: Language;
  canton: string | undefined;
}) {
  return (
    <div class="pl-figure pl-figure-good">
      <span>{tp(lang, 'saving')}</span>
      <strong class="tnum">{about(saving.totalCentimes, lang)}</strong>
      <span class="pl-hint tnum">
        {tp(lang, pck('split', canton), {
          icc: chf(saving.cantonalCentimes, lang),
          ifd: chf(saving.federalCentimes, lang),
        })}
      </span>
    </div>
  );
}

function How({
  assumptions,
  sources,
  lang,
}: {
  assumptions: string[];
  sources: string[];
  lang: Language;
}) {
  return (
    <details class="pl-how">
      <summary>{tp(lang, 'how')}</summary>
      {assumptions.length ? (
        <ul>
          {assumptions.map((a) => (
            <li key={a}>{assumption(lang, a)}</li>
          ))}
        </ul>
      ) : null}
      <p>
        {tp(lang, 'sources')}: <span class="tnum">{[...new Set(sources)].join(' · ')}</span>
      </p>
    </details>
  );
}

const whoLabel = (person: string, couple: boolean, lang: Language) =>
  couple ? t(lang, person === 'p2' ? 'p2Short' : 'p1Short') : undefined;

function useSave(lang: Language, act: Act) {
  return (person: string, field: PlanningField, value: number | boolean | string) =>
    void act(() => api.planning(person, field, value, lang));
}

/** Tax at source as facts (extension/src/source-tax.ts): plain sentences, each with its source. */
function SourceTaxFacts({ state, lang }: { state: PlannedState; lang: Language }) {
  const lines = state.sourceTax?.lines ?? [];
  if (!lines.length) return null;
  const couple = state.people.length > 1;
  return (
    <div class="pl-facts">
      <h3 class="pl-facts-title">{tp(lang, 'touSourceTax')}</h3>
      <ul>
        {lines.map((l, i) => (
          <li key={i}>
            {couple && l.person ? (
              <span class="muted">
                {whoLabel(l.person, couple, lang)}
                {' · '}
              </span>
            ) : null}
            {l.text}
            {l.estimate ? (
              <>
                {' '}
                <span class="chip chip-estimate">{tp(lang, 'estimate')}</span>
              </>
            ) : null}
            {l.source ? <span class="pl-source tnum"> ({l.source})</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The TOU card, for households taxed at source. TOU already in place, or compulsory, is a fact:
 * the card says so, with what to do, and asks nothing. Only when TOU is a real choice does it show
 * the comparison, that a request can't be withdrawn, and the decision ("Decide first").
 */
export function TouCard({ state, lang, act }: Props): JSX.Element | null {
  const planning: PlanningState = state.planning;
  const tou = planning.tou;
  const [understood, setUnderstood] = useState(false);
  const [changing, setChanging] = useState(false);
  const save = useSave(lang, act);
  if (!tou.applies) {
    // Zurich: TOU is Geneva's; say so to someone who is taxed at source.
    if (planning.touGenevaOnly && planning.inputs.some((i) => i.taxedAtSource)) {
      return (
        <section class="card pl-card" aria-labelledby="tou-title">
          <h2 id="tou-title">{tp(lang, 'touTitle')}</h2>
          <p class="muted small-text">{tp(lang, pck('touGenevaOnly', state.canton?.code))}</p>
        </section>
      );
    }
    return null;
  }
  const mode = tou.mode ?? 'choice';
  const fact = mode === 'in_place' || mode === 'compulsory';
  const couple = state.people.length > 1;
  const deadline = day(tou.deadline, lang);
  const diff = tou.differenceCentimes;
  const reasons = tou.reasons.filter((r) => r.status === 'yes' || r.status === 'check');
  const reasonText = (id: string) =>
    tp(lang, `reason.${id}` as PlanningMessageKey, {
      amount: chf(
        id === 'gross' ? tou.thresholds.grossCentimes : tou.thresholds.otherIncomeCentimes,
        lang,
      ),
      single: chf(tou.thresholds.wealthFree.single, lang),
      couple: chf(tou.thresholds.wealthFree.coupleOrSingleParent, lang),
      child: chf(tou.thresholds.wealthFree.perDependant, lang),
    });
  const decide = async (choice: 'request' | 'decline') => {
    if (await act(() => api.decide(choice, understood, lang))) {
      setChanging(false);
      setUnderstood(false);
    }
  };
  const atSource = planning.inputs.filter((i) => i.taxedAtSource);

  let decision: JSX.Element;
  if (fact || tou.deadlinePassed) {
    decision = <></>;
  } else if (mode === 'unknown') {
    decision = <p class="muted small-text">{tp(lang, 'touAnswerFirst')}</p>;
  } else if (tou.decision && !changing) {
    const date = day(tou.decision.decidedAt, lang);
    decision = (
      <div class="pl-decided">
        <p>
          <strong>
            {tp(lang, tou.decision.choice === 'request' ? 'touChosenRequest' : 'touChosenDecline', {
              date,
            })}
          </strong>
        </p>
        {tou.decision.choice === 'request' ? (
          <p class="pl-next">{tp(lang, 'touNextRequest', { date: deadline })}</p>
        ) : null}
        <button type="button" class="link" onClick={() => setChanging(true)}>
          {tp(lang, 'touChange')}
        </button>
      </div>
    );
  } else if (diff === undefined) {
    decision = <p class="muted small-text">{tp(lang, 'touNeedComparison')}</p>;
  } else {
    decision = (
      <div class="pl-decide">
        <label class="pl-check">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood((e.target as HTMLInputElement).checked)}
          />
          <span>{tp(lang, 'touUnderstand')}</span>
        </label>
        <div class="pl-buttons">
          <button
            type="button"
            class="primary"
            disabled={!understood}
            onClick={() => void decide('request')}
          >
            {tp(lang, 'touRequest')}
          </button>
          <button type="button" class="ghost" onClick={() => void decide('decline')}>
            {tp(lang, 'touDecline')}
          </button>
        </div>
      </div>
    );
  }

  const problem =
    tou.problem === 'mixed_couple'
      ? 'touMixed'
      : tou.problem === 'benefits_unknown'
        ? 'touBenefitsUnknown'
        : tou.problem === 'income_not_counted'
          ? 'touIncomeNotCounted'
          : undefined;

  return (
    <section class={`card ${fact ? 'pl-card' : 'pl-tou'}`} aria-labelledby="tou-title">
      <div class="pl-tou-head">
        <div class="pl-tou-intro">
          <span class="pl-eyebrow">{tp(lang, fact ? 'touFacts' : 'touWhen')}</span>
          <h2 id="tou-title">
            {tp(
              lang,
              mode === 'in_place'
                ? 'touTitleInPlace'
                : mode === 'compulsory'
                  ? 'touTitleCompulsory'
                  : 'touTitle',
            )}
          </h2>
          <p class="muted">
            <i>{tp(lang, 'touOfficial')}</i>.{' '}
            {tp(
              lang,
              mode === 'in_place'
                ? 'touInPlaceLead'
                : mode === 'compulsory'
                  ? 'touCompulsoryLead'
                  : 'touLead',
              { date: deadline },
            )}
          </p>
        </div>
        {!fact ? (
          <span class={`chip ${tou.deadlinePassed ? 'chip-fix' : 'chip-estimate'}`}>
            {tp(lang, tou.deadlinePassed ? 'touDeadlinePassed' : 'touDeadline', {
              date: deadline,
            })}
          </span>
        ) : null}
      </div>

      {mode === 'compulsory' || mode === 'check' ? (
        <div class={`banner ${mode === 'compulsory' ? 'banner-estimate' : 'banner-fix'}`}>
          {mode === 'check' ? <strong>{tp(lang, 'touCompulsoryCheck')}</strong> : null}
          <ul class="pl-reasons">
            {reasons.map((r) => (
              <li key={r.id}>
                {reasonText(r.id)} <span class="pl-source tnum">({r.source})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <SourceTaxFacts state={state} lang={lang} />

      {fact ? null : problem ? (
        <p class="banner banner-fix">{tp(lang, problem)}</p>
      ) : (
        <div class="pl-figures">
          <div class="pl-figure">
            <span>{tp(lang, 'touWithheld')}</span>
            <strong class="tnum">
              {tou.withheld && !tou.missingWithheld.length
                ? chf(tou.withheld.totalCentimes, lang)
                : '?'}
            </strong>
            {tou.withheld?.people.some((p) => p.from === 'tariff') ? (
              <span class="chip chip-estimate">{tp(lang, 'estimate')}</span>
            ) : null}
          </div>
          <div class="pl-figure">
            <span>{tp(lang, 'touOrdinary')}</span>
            {tou.ordinary ? (
              <strong class="tnum">{about(tou.ordinary.totalCentimes, lang)}</strong>
            ) : (
              <span class="pl-hint">{tp(lang, 'touNeedSalary')}</span>
            )}
          </div>
          <div class={`pl-figure${diff !== undefined && diff > 0 ? ' pl-figure-good' : ''}`}>
            <span>{tp(lang, 'touDifference')}</span>
            {diff !== undefined ? (
              <span class="chip chip-estimate">{tp(lang, 'estimate')}</span>
            ) : null}
            {diff !== undefined ? (
              <strong class="tnum">
                {Math.abs(diff) < 1000
                  ? tp(lang, 'touSame')
                  : tp(lang, diff > 0 ? 'touBack' : 'touMore', {
                      amount: about(Math.abs(diff), lang),
                    })}
              </strong>
            ) : (
              <strong class="tnum">?</strong>
            )}
          </div>
        </div>
      )}

      {/* A barème read from a payslip wins over the one worked out: never asked, only noted. */}
      {atSource.length && planning.tariffs.length ? (
        <details class="pl-how">
          <summary>{tp(lang, 'touPayslip')}</summary>
          <p class="small-text muted">{tp(lang, 'touPayslipHint')}</p>
          {atSource.map((i) => (
            <div class="pl-field" key={i.person}>
              <label for={`tou-tariff-${i.person}`}>
                {couple ? `${whoLabel(i.person, couple, lang)} · ` : ''}
                {tp(lang, 'touTariffLabel')}
              </label>
              <select
                id={`tou-tariff-${i.person}`}
                class="select"
                value={i.tariff ?? ''}
                onChange={(e) => save(i.person, 'tariff', (e.target as HTMLSelectElement).value)}
              >
                <option value="" disabled>
                  {tp(lang, 'touTariffNone')}
                </option>
                {planning.tariffs.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </details>
      ) : null}

      {!fact ? (
        <div class="pl-questions">
          {mode === 'unknown' ? <p class="small-text">{tp(lang, 'touCompulsoryUnknown')}</p> : null}
          {(
            [
              ['other_income', 'otherIncome', planning.otherIncome],
              ['taxable_wealth', 'taxableWealth', planning.taxableWealth],
            ] as const
          ).map(([id, field, value]) => (
            <div class="pl-question" key={id}>
              <span id={`tou-q-${id}`}>{reasonText(id)}</span>
              <div class="pl-toggle" role="group" aria-labelledby={`tou-q-${id}`}>
                {[true, false].map((v) => (
                  <button
                    type="button"
                    key={String(v)}
                    aria-pressed={value === v}
                    onClick={() => value !== v && save('p1', field, v)}
                  >
                    {tp(lang, v ? 'yes' : 'no')}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!fact ? (
        <p class="banner banner-fix pl-warn" role="note">
          <strong>{tp(lang, 'touIrrevocable')}</strong>
        </p>
      ) : null}

      {decision}

      <How assumptions={tou.assumptions} sources={tou.sources} lang={lang} />
    </section>
  );
}

function LppCard({ state, lang, act }: Props) {
  const { lpp, inputs, needsTou } = state.planning;
  const canton = state.canton?.code;
  const save = useSave(lang, act);
  const couple = inputs.length > 1;
  const year = state.taxYear;
  const over = lpp.people.find((p) => p.overCapacity);
  return (
    <section class="card pl-card" aria-labelledby="lpp-title">
      <span class="pl-eyebrow">{tp(lang, 'when')}</span>
      <h2 id="lpp-title">
        {tp(lang, 'lppTitle')}{' '}
        <span class="pl-official">({tp(lang, pck('lppOfficial', canton))})</span>
      </h2>
      <p class="muted small-text">{tp(lang, 'lppLead')}</p>
      {inputs.map((i) => (
        <fieldset class="pl-person" key={i.person}>
          {couple ? <legend>{whoLabel(i.person, couple, lang)}</legend> : null}
          <MoneyField
            key={`c-${i.lppCapacity ?? ''}`}
            id={`lpp-cap-${i.person}`}
            label={tp(lang, 'lppCapacity')}
            hint={tp(lang, 'lppCapacityHint')}
            centimes={i.lppCapacity}
            onSave={(v) => save(i.person, 'lppCapacity', v)}
          />
          <MoneyField
            key={`a-${i.lppAmount ?? ''}`}
            id={`lpp-amount-${i.person}`}
            label={tp(lang, 'lppAmount')}
            centimes={i.lppAmount}
            onSave={(v) => save(i.person, 'lppAmount', v)}
          />
        </fieldset>
      ))}
      {over ? (
        <p class="banner banner-fix">
          {tp(lang, 'lppOver', { cap: chf(over.capacityCentimes ?? 0, lang) })}
        </p>
      ) : lpp.saving ? (
        <Saving saving={lpp.saving} lang={lang} canton={canton} />
      ) : (
        <p class="pl-hint">
          {lpp.problem === 'no_tax'
            ? lpp.assumptions.map((a) => assumption(lang, a)).join(' ')
            : tp(lang, lpp.problem === 'no_income' ? 'lppNoSalary' : 'lppNoAmount')}
        </p>
      )}
      {lpp.capacityUnknown && !over ? (
        <p class="small-text">{tp(lang, 'lppCapacityUnknown')}</p>
      ) : null}
      {needsTou ? <p class="banner banner-estimate">{tp(lang, 'onlyWithTou')}</p> : null}
      <ul class="pl-facts">
        <li>
          <strong>{tp(lang, 'lppThreeYears')}</strong>
        </li>
        <li>{tp(lang, 'lppPaidInYear', { year })}</li>
        <li>{tp(lang, 'lppHome')}</li>
        <li>{tp(lang, pck('lppAttestation', canton))}</li>
      </ul>
      <How assumptions={lpp.assumptions} sources={lpp.sources} lang={lang} />
    </section>
  );
}

function CatchUpCard({ state, lang, act }: Props) {
  const canton = state.canton?.code;
  const { catchUp, inputs, needsTou } = state.planning;
  const save = useSave(lang, act);
  const couple = inputs.length > 1;
  const cap = chf(catchUp.capInYearCentimes, lang);
  return (
    <section class="card pl-card" aria-labelledby="cu-title">
      <span class="pl-eyebrow">{tp(lang, 'when')}</span>
      <h2 id="cu-title">
        {tp(lang, 'cuTitle')}{' '}
        <span class="pl-official">({tp(lang, pck('cuOfficial', canton))})</span>
      </h2>
      <p class="muted small-text">{tp(lang, 'cuLead')}</p>
      {inputs.map((i) => {
        const r = catchUp.people.find((p) => p.person === i.person);
        const amount = chf(r?.catchUpCentimes ?? 0, lang);
        const status =
          !r || r.status === 'unknown'
            ? tp(lang, 'cuUnknown')
            : r.status === 'no_gap'
              ? tp(lang, 'cuNoGap')
              : tp(lang, r.isMaximum ? 'cuPossibleMax' : 'cuPossible', { amount });
        return (
          <fieldset class="pl-person" key={i.person}>
            {couple ? <legend>{whoLabel(i.person, couple, lang)}</legend> : null}
            <MoneyField
              key={`p-${i.paid2025 ?? ''}`}
              id={`cu-paid-${i.person}`}
              label={tp(lang, 'cuPaid2025')}
              hint={tp(lang, 'cuPaid2025Hint')}
              centimes={i.paid2025}
              onSave={(v) => save(i.person, 'paid2025', v)}
            />
            <p class="pl-status small-text">
              {status}
              {r?.status === 'pay_this_year_first' ? ` ${tp(lang, 'cuFirst')}` : ''}
            </p>
          </fieldset>
        );
      })}
      {catchUp.saving ? <Saving saving={catchUp.saving} lang={lang} canton={canton} /> : null}
      {needsTou && catchUp.catchUpCentimes > 0 ? (
        <p class="banner banner-estimate">{tp(lang, 'onlyWithTou')}</p>
      ) : null}
      <ul class="pl-facts">
        <li>{tp(lang, 'cuRuleGaps', { cap })}</li>
        <li>{tp(lang, pck('cuRuleIncome', canton))}</li>
        <li>{tp(lang, 'cuRuleOnce')}</li>
        <li>{tp(lang, 'cuRuleAsk')}</li>
      </ul>
      <How assumptions={catchUp.assumptions} sources={catchUp.sources} lang={lang} />
    </section>
  );
}

/** The pension fund buy-in and the 3a catch-up, next to each other below the 3a card. */
export function MoreBeforeDecember(props: Props): JSX.Element {
  return (
    <div class="pl-grid">
      <LppCard {...props} />
      <CatchUpCard {...props} />
    </div>
  );
}
