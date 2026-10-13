// "Last year, reviewed": last year's declaration as Taxpresso read it, its tax recomputed with that
// year's rules, what the household could have saved, what to ask, and what can still be done
// (extension/src/last-year-review.ts). Amounts arrive as integer centimes from the rules engine and
// are formatted from exact decimal strings; nothing is computed here. Nothing here is filed.
import type { JSX } from 'preact';
import { day } from './i18n-planning';
import { tr, trId } from './i18n-review';
import type { Language } from './i18n';
import './review.css';

type Person = 'p1' | 'p2';
interface Saving {
  cantonalCentimes: number;
  federalCentimes: number;
  totalCentimes: number;
}

/** extension/src/last-year-review.ts, ReviewView (what this card reads of it). */
export interface ReviewView {
  status: 'none' | 'needs' | 'unsupported' | 'ready';
  year?: number;
  filename?: string;
  couple: boolean;
  needs: ('commune' | 'civil_status')[];
  unsupported: string[];
  recomputed?: {
    icc: number;
    ifd: number;
    total: number;
    taxableIncome: { icc: number; ifd: number };
    taxableWealth: number;
    sources: string[];
  };
  checks: {
    id: string;
    column: 'icc' | 'ifd' | 'total';
    code?: string;
    printed: number;
    recomputed: number;
    difference: number;
    matches: boolean;
    from: 'declaration' | 'assessment';
    page?: number;
  }[];
  missed3a: {
    person: Person;
    code: string;
    paid: number;
    page?: number;
    fund: 'yes' | 'no' | 'unknown';
    options: {
      hasPensionFund: boolean;
      limit: number;
      limitIsMaximum: boolean;
      gap: number;
      saving?: Saving;
    }[];
    sources: string[];
  }[];
  questions: { id: string; person: Person | 'household'; codes: string[]; sources: string[] }[];
  catchUp?: {
    year: number;
    gapYear: number;
    people: { person: Person; status: string; catchUpCentimes: number }[];
    sources: string[];
  };
  assessments: {
    docId: string;
    taxes: ('icc' | 'ifd')[];
    notificationDate?: string;
    deadlines: { tax: 'icc' | 'ifd'; date: string; passed: boolean; sources: string[] }[];
  }[];
  unknownYearAssessments: number;
  /** What the 3a catch-up card already has as the 2025 payment (null: nothing yet). */
  catchUpPaid2025: Partial<Record<Person, number | null>>;
  final: { icc: string; ifd: string };
  assumptions: string[];
}

/** Centimes as an exact decimal string: 123456 -> "1234.56". */
function centimesString(centimes: number): `${number}` {
  const negative = centimes < 0;
  const digits = String(Math.abs(centimes)).padStart(3, '0');
  return `${negative ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}` as `${number}`;
}

/** As the declaration prints amounts: whole francs, centimes only when there are some. */
function chf(centimes: number, lang: Language): string {
  const whole = centimes % 100 === 0;
  return new Intl.NumberFormat(`${lang}-CH`, {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(centimesString(centimes));
}

/** A saving is an estimate: shown to the franc, said "about". */
const about = (centimes: number, lang: Language) => chf(Math.round(centimes / 100) * 100, lang);

function who(person: Person | 'household', couple: boolean, lang: Language): string {
  if (person === 'household') return tr(lang, 'household');
  if (!couple) return '';
  return tr(lang, person === 'p1' ? 'you' : 'partner');
}

function Sources({ list }: { list: string[] }) {
  return <span class="muted small-text rv-sources">{list.join(' · ')}</span>;
}

function TaxBlock({ v, lang }: { v: ReviewView; lang: Language }) {
  const year = v.year ?? '';
  const r = v.recomputed;
  const differ = v.checks.filter((c) => !c.matches);
  const same = v.checks.filter((c) => c.matches);
  return (
    <section class="rv-block" aria-labelledby="rv-tax">
      <h3 id="rv-tax">
        {tr(lang, 'taxTitle', { year })}{' '}
        <span class="rv-official">({tr(lang, 'taxOfficial', { year })})</span>
      </h3>
      {r ? (
        <>
          <div class="rv-total">
            <span>{tr(lang, 'total')}</span>
            <span class="rv-amount">
              <strong class="tnum">{chf(r.total, lang)}</strong>
              <span class="chip chip-computed">{tr(lang, 'computed')}</span>
            </span>
          </div>
          <ul class="rv-rows">
            <li class="rv-row">
              <span>{tr(lang, 'icc')}</span>
              <span class="tnum">{chf(r.icc, lang)}</span>
            </li>
            <li class="rv-row">
              <span>{tr(lang, 'ifd')}</span>
              <span class="tnum">{chf(r.ifd, lang)}</span>
            </li>
          </ul>
          <p class="rv-note">{tr(lang, 'taxNote')}</p>
        </>
      ) : v.status === 'needs' ? (
        <p class="banner banner-estimate">
          {tr(lang, v.needs.includes('commune') ? 'needsCommune' : 'needsCivil', { year })}
        </p>
      ) : (
        <p class="rv-note">{v.unsupported.map((u) => trId(lang, 'u', u)).join(' ')}</p>
      )}
      {differ.map((c) => (
        <div class="rv-check" key={`${c.id}-${c.column}-${c.from}`}>
          <span class="chip chip-fix">{tr(lang, 'checkThis')}</span>
          <span class="small-text">
            {tr(lang, 'checkLine', {
              what: trId(lang, 'check', c.id),
              column: tr(lang, `column.${c.column}`),
              printed: chf(c.printed, lang),
              where: tr(lang, c.from === 'assessment' ? 'whereAssessment' : 'whereDeclaration'),
              recomputed: chf(c.recomputed, lang),
            })}
            {c.page ? ` (${tr(lang, 'page', { page: c.page })})` : ''} {tr(lang, 'checkWhy')}
          </span>
        </div>
      ))}
      {same.length ? (
        <p class="rv-note">
          {differ.length
            ? tr(lang, 'someMatch', { n: same.length })
            : tr(lang, 'allMatch', { n: same.length })}
        </p>
      ) : null}
    </section>
  );
}

function SavedBlock({ v, lang }: { v: ReviewView; lang: Language }) {
  const year = v.year ?? '';
  return (
    <section class="rv-block" aria-labelledby="rv-saved">
      <h3 id="rv-saved">{tr(lang, 'savedTitle')}</h3>
      {v.missed3a.length === 0 ? <p class="rv-note">{tr(lang, 'nothingMissed')}</p> : null}
      {v.missed3a.map((m) => {
        const name = who(m.person, v.couple, lang);
        const official = tr(lang, 'pillar3aOfficial');
        return (
          <div class="rv-item" key={m.person}>
            <div class="rv-label">
              <strong>
                {tr(lang, 'pillar3a')}
                {name ? <span class="muted"> · {name}</span> : null}
              </strong>
              <span class="muted small-text">
                {official ? `${official} · ` : ''}
                <span class="tnum">{m.code}</span>
                {m.page ? ` · ${tr(lang, 'page', { page: m.page })}` : ''}
              </span>
            </div>
            {m.options.map((o) => {
              const limit = o.limitIsMaximum
                ? tr(lang, 'upTo', { amount: chf(o.limit, lang) })
                : chf(o.limit, lang);
              const paid = chf(m.paid, lang);
              return (
                <div class="rv-option" key={String(o.hasPensionFund)}>
                  {m.fund === 'unknown' ? (
                    <span class="small-text rv-strong">
                      {tr(lang, o.hasPensionFund ? 'withFund' : 'withoutFund')}
                    </span>
                  ) : null}
                  <p class="rv-text">
                    {o.gap === 0
                      ? tr(lang, 'paidAll', { limit })
                      : tr(lang, m.person === 'p2' && v.couple ? 'paidOfPartner' : 'paidOf', {
                          paid,
                          limit,
                        })}
                  </p>
                  {o.gap > 0 && o.saving ? (
                    <div class="rv-saving">
                      <span class="small-text">{tr(lang, 'saved')}</span>
                      <span class="rv-amount">
                        <strong class="tnum rv-green">{about(o.saving.totalCentimes, lang)}</strong>
                        <span class="chip chip-estimate">{tr(lang, 'estimate')}</span>
                      </span>
                      <span class="muted small-text tnum">
                        {tr(lang, 'tax.icc')} {chf(o.saving.cantonalCentimes, lang)} ·{' '}
                        {tr(lang, 'tax.ifd')} {chf(o.saving.federalCentimes, lang)}
                      </span>
                    </div>
                  ) : o.gap > 0 ? (
                    <p class="muted small-text">
                      {tr(lang, 'left', {
                        amount: o.limitIsMaximum
                          ? tr(lang, 'upTo', { amount: chf(o.gap, lang) })
                          : chf(o.gap, lang),
                      })}
                      . {tr(lang, 'noSaving')}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {m.fund === 'unknown' ? (
              <p class="small-text">{tr(lang, 'fundUnknown', { year })}</p>
            ) : null}
            <Sources list={m.sources} />
          </div>
        );
      })}
      {v.questions.length ? (
        <>
          <h4 class="rv-subtitle">{tr(lang, 'askTitle')}</h4>
          <p class="rv-note">{tr(lang, 'askLead')}</p>
          <ul class="rv-questions">
            {v.questions.map((q) => {
              const name = who(q.person, v.couple, lang);
              return (
                <li key={`${q.id}-${q.person}`} class="rv-question" title={q.sources.join(' · ')}>
                  <span>
                    {name && q.person !== 'household' ? (
                      <strong class="rv-who">{name} · </strong>
                    ) : null}
                    {trId(lang, 'q', q.id)}
                  </span>
                  <span class="muted small-text tnum">{q.codes.join(' · ')}</span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
}

function StillBlock({ v, lang }: { v: ReviewView; lang: Language }) {
  const year = v.year ?? '';
  const cu = v.catchUp;
  const open = cu?.people.filter((p) => p.catchUpCentimes > 0) ?? [];
  return (
    <section class="rv-block" aria-labelledby="rv-still">
      <h3 id="rv-still">{tr(lang, 'stillTitle')}</h3>
      {open.map((p) => {
        const name = who(p.person, v.couple, lang);
        return (
          <div class="rv-item" key={p.person}>
            <p class="rv-text">
              {name ? <strong class="rv-who">{name} · </strong> : null}
              {tr(lang, 'catchUp', {
                gapYear: cu!.gapYear,
                amount: chf(p.catchUpCentimes, lang),
                year: cu!.year,
              })}
              {p.status === 'pay_this_year_first' ? ` ${tr(lang, 'catchUpFirst')}` : ''}
            </p>
            {v.catchUpPaid2025[p.person] === null ? (
              <p class="muted small-text">
                {tr(lang, 'catchUpEnter', {
                  gapYear: cu!.gapYear,
                  paid: chf(v.missed3a.find((m) => m.person === p.person)?.paid ?? 0, lang),
                })}
              </p>
            ) : null}
          </div>
        );
      })}
      {open.length ? (
        <div class="rv-handoff">
          <a class="rv-link" href="#cu-title">
            {tr(lang, 'catchUpLink')}
          </a>
          <Sources list={cu!.sources} />
        </div>
      ) : null}
      {typeof v.year === 'number' && v.year < 2025 ? (
        <p class="rv-note">{tr(lang, 'catchUpNone')}</p>
      ) : null}
      {v.assessments.map((a) => (
        <div class="rv-deadlines" key={a.docId}>
          {a.deadlines.length ? (
            a.deadlines.map((d) => (
              <div class="rv-deadline" key={d.tax}>
                <strong>
                  {tr(lang, 'deadline', { tax: tr(lang, `tax.${d.tax}`), date: day(d.date, lang) })}
                </strong>
                {d.passed ? (
                  <span class="chip chip-missing">{tr(lang, 'deadlinePassed')}</span>
                ) : null}
                <Sources list={d.sources} />
              </div>
            ))
          ) : (
            <p class="banner banner-estimate">{tr(lang, 'deadlineNoDate', { year })}</p>
          )}
          <p class="small-text">{tr(lang, 'deadlineNote')}</p>
        </div>
      ))}
      {v.assessments.length === 0 ? (
        <p class="rv-note">{tr(lang, 'noAssessment', { year })}</p>
      ) : null}
      {v.unknownYearAssessments ? (
        <p class="rv-note">
          {tr(lang, v.unknownYearAssessments === 1 ? 'unknownYear' : 'unknownYears', {
            n: v.unknownYearAssessments,
          })}
        </p>
      ) : null}
      <p class="small-text">
        {tr(lang, 'final')} <Sources list={[v.final.icc, v.final.ifd]} />
      </p>
    </section>
  );
}

export function Review({
  view,
  taxYear,
  lang,
}: {
  view: ReviewView | null | undefined;
  taxYear: number;
  lang: Language;
}): JSX.Element | null {
  if (!view) return null;
  if (view.status === 'none') {
    return (
      <section class="stack" aria-labelledby="rv-title">
        <div class="section-head">
          <h2 id="rv-title">{tr(lang, 'title')}</h2>
        </div>
        <div class="card rv-card">
          <p class="rv-note">{tr(lang, 'noneLead')}</p>
        </div>
      </section>
    );
  }
  const year = view.year ?? '';
  const sources = [...(view.recomputed?.sources ?? [])];
  return (
    <section class="stack" aria-labelledby="rv-title">
      <div class="section-head">
        <h2 id="rv-title">
          {tr(lang, 'title')} <span class="rv-official">({tr(lang, 'official', { year })})</span>
        </h2>
      </div>
      <div class="card rv-card">
        <p class="rv-note">{tr(lang, 'lead', { year, taxYear })}</p>
        <TaxBlock v={view} lang={lang} />
        <SavedBlock v={view} lang={lang} />
        <StillBlock v={view} lang={lang} />
        {view.assumptions.length || sources.length ? (
          <details class="rv-details">
            <summary>{tr(lang, 'how')}</summary>
            {view.assumptions.length ? (
              <>
                <strong class="small-text">{tr(lang, 'assumptions')}</strong>
                <ul>
                  {view.assumptions.map((a) => (
                    <li key={a}>{trId(lang, 'a', a)}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {sources.length ? (
              <>
                <strong class="small-text">{tr(lang, 'sources')}</strong>
                <ul>
                  {sources.map((s) => (
                    <li key={s} class="tnum">
                      {s}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </details>
        ) : null}
      </div>
    </section>
  );
}
