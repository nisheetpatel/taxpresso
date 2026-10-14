// "Before 31 December" beyond the 3a room, and the TOU decision (SPEC.md section 8, groups B and
// C; docs/design/2-optimizations.html): a pension fund buy-in, the 3a catch-up, and for people
// taxed at source the comparison, the deadline, the irreversibility and an explicit decision.
// Every figure comes from the extension (extension/src/planning.ts); this page only shows them.
import './planning.css';
import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { api } from './api';
import { t, type Language } from './i18n';
import { tj } from './i18n-journey';
import { assumption, assumptionList, day, pck, type PlanningMessageKey, tp } from './i18n-planning';
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
  // Only assumptions that have words: never an empty bullet.
  const how = assumptionList(lang, assumptions);
  return (
    <details class="pl-how">
      <summary>{tp(lang, 'how')}</summary>
      {how.length ? (
        <ul>
          {how.map((a) => (
            <li key={a}>{a}</li>
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

/** The TOU card: shown to people taxed at source, before everything else ("Decide first"). */
export function TouCard({ state, lang, act }: Props): JSX.Element | null {
  const planning: PlanningState = state.planning;
  const tou = planning.tou;
  const [understood, setUnderstood] = useState(false);
  const [changing, setChanging] = useState(false);
  const save = useSave(lang, act);
  if (!tou.applies) {
    // Zurich: TOU is Geneva's; say so to someone who said they are taxed at source.
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

  // TOU already in place or compulsory is a fact ("About you"), never a choice (docs/design/simple.md).
  const fact = tou.mode === 'in_place' || tou.mode === 'compulsory';
  let decision: JSX.Element;
  if (fact) {
    decision = <p class="pl-next">{tp(lang, 'touNextCompulsory', { date: deadline })}</p>;
  } else if (tou.deadlinePassed) {
    decision = <></>;
  } else if (tou.mode === 'unknown' && !tou.decision) {
    // Whether TOU is compulsory isn't known yet: the questions below come first.
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

  return (
    <section class="card pl-tou" aria-labelledby="tou-title">
      <div class="pl-tou-head">
        <div class="pl-tou-intro">
          <span class="pl-eyebrow">{tp(lang, 'touWhen')}</span>
          <h2 id="tou-title">{tp(lang, 'touTitle')}</h2>
          <p class="muted">
            <i>{tp(lang, 'touOfficial')}</i>. {tp(lang, 'touLead')}
          </p>
        </div>
        <span class={`chip ${tou.deadlinePassed ? 'chip-fix' : 'chip-estimate'}`}>
          {tp(lang, tou.deadlinePassed ? 'touDeadlinePassed' : 'touDeadline', { date: deadline })}
        </span>
      </div>

      {fact || tou.mode === 'check' ? (
        <div class={`banner ${fact ? 'banner-estimate' : 'banner-fix'}`}>
          <strong>
            {tp(lang, fact ? 'touCompulsoryYes' : 'touCompulsoryCheck', {
              date: deadline,
            })}
          </strong>
          <ul class="pl-reasons">
            {reasons.map((r) => (
              <li key={r.id}>
                {reasonText(r.id)} <span class="pl-source tnum">({r.source})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tou.problem && tou.problem !== 'no_income' ? (
        <p class="banner banner-fix">
          {tp(
            lang,
            tou.problem === 'mixed_couple'
              ? 'touMixed'
              : tou.problem === 'benefits_unknown'
                ? 'touBenefitsUnknown'
                : 'touIncomeNotCounted',
          )}
        </p>
      ) : (
        <div class="pl-figures">
          <div class="pl-figure">
            <span>{tp(lang, 'touWithheld')}</span>
            <strong class="tnum">
              {tou.withheld ? chf(tou.withheld.totalCentimes, lang) : tp(lang, 'touNotKnown')}
            </strong>
            {tou.withheld ? (
              <span class="pl-hint">
                {tou.withheld.people
                  .map(
                    (p) =>
                      `${couple ? `${whoLabel(p.person, couple, lang)}${lang === 'fr' ? ' : ' : ': '}` : ''}${tp(
                        lang,
                        `from.${p.from}`,
                        { tariff: p.tariff ?? '' },
                      )}`,
                  )
                  .join(' · ')}
              </span>
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
              <span class="pl-hint">{tp(lang, 'touNotKnown')}</span>
            )}
          </div>
        </div>
      )}

      {tou.missingWithheld.length ? (
        <p class="small-text muted">{tp(lang, 'touWithheldLater')}</p>
      ) : null}

      {atSource.some(
        (i) => tou.withheld?.people.find((w) => w.person === i.person)?.from !== 'certificate',
      ) ? (
        // The tax withheld and the tariff come from documents or the chat; corrections here.
        <details class="change">
          <summary>{tj(lang, 'change')}</summary>
          <div class="pl-inputs">
            {tou.missingWithheld.length ? (
              <p class="small-text">{tp(lang, 'touNeedWithheld')}</p>
            ) : null}
            {atSource.map((i) =>
              tou.withheld?.people.find((w) => w.person === i.person)?.from ===
              'certificate' ? null : (
                <fieldset class="pl-person" key={i.person}>
                  {couple ? <legend>{whoLabel(i.person, couple, lang)}</legend> : null}
                  <MoneyField
                    key={`w-${i.withheld ?? ''}`}
                    id={`tou-withheld-${i.person}`}
                    label={tp(lang, 'touWithheldLabel')}
                    centimes={i.withheld}
                    onSave={(v) => save(i.person, 'withheld', v)}
                  />
                  <div class="pl-field">
                    <label for={`tou-tariff-${i.person}`}>{tp(lang, 'touTariffLabel')}</label>
                    <select
                      id={`tou-tariff-${i.person}`}
                      class="select"
                      value={i.tariff ?? ''}
                      onChange={(e) =>
                        save(i.person, 'tariff', (e.target as HTMLSelectElement).value)
                      }
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
                </fieldset>
              ),
            )}
          </div>
        </details>
      ) : null}

      {!fact ? (
        <div class="pl-questions">
          {tou.mode === 'unknown' ? (
            <p class="small-text">{tp(lang, 'touCompulsoryUnknown')}</p>
          ) : null}
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

      <p class="banner banner-fix pl-warn" role="note">
        <strong>{tp(lang, 'touIrrevocable')}</strong>
      </p>

      {decision}

      <How assumptions={tou.assumptions} sources={tou.sources} lang={lang} />
    </section>
  );
}

export function LppCard({ state, lang, act }: Props) {
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
      <details class="change">
        <summary>{tj(lang, 'change')}</summary>
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
      </details>
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

export function CatchUpCard({ state, lang, act }: Props) {
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
      <ul class="pl-statuses small-text">
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
            <li key={i.person}>
              {couple ? <strong>{whoLabel(i.person, couple, lang)}: </strong> : null}
              {status}
              {r?.status === 'pay_this_year_first' ? ` ${tp(lang, 'cuFirst')}` : ''}
            </li>
          );
        })}
      </ul>
      <details class="change">
        <summary>{tj(lang, 'change')}</summary>
        {inputs.map((i) => (
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
          </fieldset>
        ))}
      </details>
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
