// The number (three-pages.md, principle 1): your tax for the year, big on "Your tax" and a thin
// strip on the other pages, with one "how sure" bar in words (Rough estimate, Getting close,
// Exact). What it rests on in one line; what Taxpresso worked out, last year and the breakdown one
// tap away. Every figure comes from the extension; this only words it.
import type { ComponentChildren, JSX } from 'preact';
import { Estimate } from './Estimate';
import type { Language } from './i18n';
import { pck, tp } from './i18n-planning';
import { isJourneyKey, tj } from './i18n-journey';
import { pg } from './i18n-pages';
import { day } from './i18n-planning';
import { LastYear } from './LastYear';
import { aboutFrancs, francs, roughFrancs } from './money';
import type { PageProps } from './page-props';
import { touReasonText } from './Planning';
import { Review } from './Review';
import { SourceList } from './Sources';
import type { Confidence, PagesFields } from './state-adapter';
import type { JourneyVars, State } from './types';
import { Why } from './ui';

/** The tax as the card says it: "about CHF 8,900", "at least …", or exact francs. */
export function taxFigure(
  state: State,
  confidence: Confidence | null,
  lang: Language,
): { prefix: string; amount: string } | null {
  const est = state.estimate;
  if (!state.journey.hasFigures || !est?.computed || est.total === null) return null;
  const exact = confidence === 'exact';
  return {
    prefix: !est.complete ? pg(lang, 'tax.atLeast') : exact ? '' : pg(lang, 'tax.about'),
    amount: exact ? francs(est.total, lang) : roughFrancs(est.total, lang),
  };
}

/** The how-sure bar: three steps and the word, never color alone. */
export function Meter({ confidence, lang }: { confidence: Confidence; lang: Language }) {
  const n = confidence === 'rough' ? 1 : confidence === 'close' ? 2 : 3;
  return (
    <p class="meter" data-sure={confidence}>
      <span class="meter-bars" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} class={i <= n ? 'on' : undefined} />
        ))}
      </span>
      <span class="sr-only">{pg(lang, 'sure.label', { word: '' })}</span>
      <span class="meter-word">{pg(lang, `sure.${confidence}`)}</span>
    </p>
  );
}

/** "From what you told us: about CHF 95,000 in salary, a couple, 1 child, Carouge." */
export function restsOn(state: State, pages: PagesFields, lang: Language): string | null {
  // The rough figures the tax counts now: those no document replaces yet.
  const told = pages.rough.people.flatMap((p) => p.figures.filter((f) => f.used));
  const docs = state.documents.some(
    (d) => d.kind && !['prior_declaration', 'official_declaration', 'other'].includes(d.kind),
  );
  if (docs) return pg(lang, told.length ? 'tax.both' : 'tax.docs');
  if (!told.length) return null;
  const find = (id: string) => pages.groups.basics.find((q) => q.questionId === id);
  const civil = find('civil_status')?.value;
  const children = find('children')?.value;
  const commune = find('commune');
  const place = commune?.options?.find((o) => o.value === commune.value)?.label;
  const facts = [
    ...told.map((f) => pg(lang, `told.${f.kind}`, { amount: francs(f.amount, lang) })),
    ...(typeof civil === 'string'
      ? [
          pg(
            lang,
            civil === 'married' || civil === 'registered_partnership'
              ? 'told.couple'
              : 'told.single',
          ),
        ]
      : []),
    ...(typeof children === 'number' && children > 0
      ? [children === 1 ? pg(lang, 'told.childOne') : pg(lang, 'told.children', { n: children })]
      : []),
    ...(place ? [place] : []),
  ];
  return pg(lang, 'tax.told', { facts: facts.join(', ') });
}

/** The big card on "Your tax". */
export function TaxCard(p: PageProps): JSX.Element {
  const { state, pages, lang } = p;
  const year = state.taxYear;
  const c = pages.confidence;
  const figure = taxFigure(state, c, lang);
  const est = state.estimate;
  const over = state.yearOver !== null;
  const capital = state.journey.stages.find((s) => s.id === 'tax')?.vars.capital;
  const total = est?.computed ? est.total : null;
  const moved =
    c !== 'rough' && p.roughBefore !== null && total !== null ? total - p.roughBefore : 0;
  const rests = restsOn(state, pages, lang);
  const facts = state.journey.about;
  const lastYear = state.lastYear || (state.review && state.review.status !== 'none');
  return (
    <>
      <section class="hero" aria-labelledby="tax-title">
        <h2 id="tax-title" class="hero-title">
          {pg(lang, 'tax.title', { year })}
        </h2>
        {figure ? (
          <>
            <p class="hero-amount">
              {figure.prefix ? <span class="hero-about">{figure.prefix} </span> : null}
              <span class="tnum">{figure.amount}</span>
            </p>
            {c ? <Meter confidence={c} lang={lang} /> : null}
            {Math.abs(moved) >= 1000 ? (
              <p class="hero-line">
                {pg(lang, moved < 0 ? 'tax.less' : 'tax.more', {
                  amount: aboutFrancs(Math.abs(moved), lang),
                })}
              </p>
            ) : null}
            {capital ? (
              <p class="hero-line">{pg(lang, 'tax.capital', { amount: francs(capital, lang) })}</p>
            ) : null}
            <p class="hero-line">
              {rests ? `${rests} ` : null}
              <button type="button" class="hero-link" onClick={p.openBasics}>
                {pg(lang, 'change')}
              </button>
            </p>
          </>
        ) : (
          <>
            <p class="hero-empty">
              {est && !est.computed && est.missing.length && state.journey.hasFigures
                ? pg(lang, 'tax.needs', { what: est.missing.join(', ') })
                : pg(lang, over ? 'tax.over' : 'tax.noIncome')}
            </p>
            {over ? null : (
              <button type="button" class="hero-btn" onClick={p.openBasics}>
                {pg(lang, 'tax.addIncome')}
              </button>
            )}
          </>
        )}
      </section>
      {facts.length || lastYear || est?.computed ? (
        <div class="card disclosures">
          {facts.length ? (
            <details class="disclosure">
              <summary>{pg(lang, 'tax.worked', { n: facts.length })}</summary>
              <WorkedOut state={state} lang={lang} />
            </details>
          ) : null}
          {lastYear ? (
            <details class="disclosure">
              <summary>{pg(lang, 'tax.lastYear')}</summary>
              <div class="disclosure-body">
                <LastYear view={state.lastYear} year={year} lang={lang} />
                {state.review && state.review.status !== 'none' ? (
                  <Review view={state.review} taxYear={year} lang={lang} />
                ) : null}
              </div>
            </details>
          ) : null}
          {est?.computed ? (
            <details class="disclosure">
              <summary>{pg(lang, 'tax.why')}</summary>
              <div class="disclosure-body">
                <Estimate view={est} lang={lang} cantonName={state.canton?.name} />
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** The thin strip on "Pay less" and "File": the tax, and what the page adds to it. */
export function TaxStrip({
  state,
  pages,
  lang,
  children,
}: {
  state: State;
  pages: PagesFields;
  lang: Language;
  children?: ComponentChildren;
}): JSX.Element {
  const figure = taxFigure(state, pages.confidence, lang);
  return (
    <div class="strip">
      <div class="strip-part">
        <span class="strip-label">{pg(lang, 'tax.title', { year: state.taxYear })}</span>
        <span class="strip-amount">
          {figure ? (
            <>
              {figure.prefix ? <span class="strip-about">{figure.prefix} </span> : null}
              <span class="tnum">{figure.amount}</span>
            </>
          ) : (
            <span class="strip-none">{pg(lang, 'tax.noIncome')}</span>
          )}
        </span>
      </div>
      {children ??
        (figure && pages.confidence ? (
          <span class={`chip ${pages.confidence === 'exact' ? 'chip-verified' : 'chip-estimate'}`}>
            {pg(lang, `sure.${pages.confidence}`)}
          </span>
        ) : null)}
    </div>
  );
}

type Fact = State['journey']['about'][number];

/** A fact's own words in the page's language: German and Italian fall back to English. */
const inLang = (words: Fact['text'], lang: Language): string =>
  words ? (lang === 'de' || lang === 'it' ? (words[lang] ?? words.en) : words[lang]) : '';

function vars(v: JourneyVars, lang: Language): Record<string, string | number> {
  return {
    ...(v.n !== undefined ? { n: v.n } : {}),
    ...(v.year !== undefined ? { year: v.year } : {}),
    ...(v.amount !== undefined ? { amount: francs(v.amount, lang) } : {}),
    ...(v.date !== undefined ? { date: day(v.date, lang) } : {}),
  };
}

/** A fact in one short sentence: the extension's own words, or the TOU facts worded from their id. */
export function factText(f: Fact, state: State, lang: Language): string {
  const own = inLang(f.text, lang);
  if (own) return own;
  if (f.id === 'tou_already') return tj(lang, `fact.tou_already.${f.who ?? 'p1'}`);
  if (f.id === 'tou_geneva_only') return tp(lang, pck('touGenevaOnly', state.canton?.code));
  const key = `fact.${f.id}`;
  return isJourneyKey(key) ? tj(lang, key, vars(f.vars, lang)) : '';
}

/** Why a fact holds: its own words, or for a compulsory TOU the cases that make it so. */
function whyOf(f: Fact, state: State, lang: Language): string[] {
  if (f.why) return [inLang(f.why, lang)];
  const tou = state.planning?.tou;
  if (f.id !== 'tou_compulsory' || !tou) return [];
  return tou.reasons.filter((r) => r.status === 'yes').map((r) => touReasonText(tou, r.id, lang));
}

/** "What Taxpresso worked out": each fact one sentence, why and its sources behind "Why?". */
export function WorkedOut({ state, lang }: { state: State; lang: Language }): JSX.Element {
  return (
    <ul class="facts">
      {state.journey.about.map((f, i) => {
        const text = factText(f, state, lang);
        if (!text) return null;
        const why = whyOf(f, state, lang);
        const sources = f.sources ?? [];
        return (
          <li key={`${f.id}-${i}`} class="fact">
            <p class="fact-text">{text}</p>
            {why.length || sources.length ? (
              <Why lang={lang}>
                {why.length > 1 ? (
                  <ul>
                    {why.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : why.length ? (
                  <p>{why[0]}</p>
                ) : null}
                {sources.length ? (
                  <>
                    <p class="why-sub">{pg(lang, 'sources')}</p>
                    <SourceList sources={sources} />
                  </>
                ) : null}
              </Why>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
