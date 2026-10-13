// "Your assessment" (SPEC.md 10.8): what the tax office assessed against what was declared, item
// by item, and the deadline to object (réclamation) with the law that sets it. Taxpresso never
// files the objection.
import './documents.css';
import type { Language } from './i18n';
import { formatChf, showOfficial, td } from './i18n-docs';
import type { State } from './types';
import type { AssessmentCard } from './types-docs';

function One({ a, lang }: { a: AssessmentCard; lang: Language }) {
  return (
    <section class="card dc-assessment" aria-labelledby={`as-${a.docId}`}>
      <div class="section-head">
        <h2 id={`as-${a.docId}`}>{td(lang, 'assessmentTitle')}</h2>
        <span class="muted small-text">
          {a.taxes.join(' · ')}
          {a.notificationDate ? ` · ${td(lang, 'notifiedOn', { date: a.notificationDate })}` : ''}
        </span>
      </div>
      <p class="muted dc-lead">{td(lang, 'assessmentLead')}</p>

      {a.deadlines.length ? (
        <div class="dc-deadlines">
          {a.deadlines.map((d) => (
            <div class="dc-deadline" key={d.tax}>
              <span class="small-text">{td(lang, 'objectFor', { tax: d.tax })}</span>
              <strong>{td(lang, 'objectBy', { date: d.date })}</strong>
              <span class="muted small-text tnum">
                {td(lang, 'deadlineLaw', { law: d.law })} · {d.sources.join(' · ')}
              </span>
            </div>
          ))}
          <p class="small-text dc-note-text">{a.text.counting}</p>
        </div>
      ) : (
        <p class="banner banner-estimate">{a.text.noDate}</p>
      )}

      {a.unconfirmed ? (
        <p class="small-text muted">{td(lang, 'unconfirmed', { n: a.unconfirmed })}</p>
      ) : null}

      {a.items.length ? (
        <div class="dc-table-wrap">
          <table class="dc-table">
            <thead>
              <tr>
                <th scope="col">{td(lang, 'item')}</th>
                <th scope="col" class="dc-num">
                  {td(lang, 'declared')}
                </th>
                <th scope="col" class="dc-num">
                  {td(lang, 'assessed')}
                </th>
                <th scope="col">{td(lang, 'difference')}</th>
              </tr>
            </thead>
            <tbody>
              {a.items.map((i) => (
                <tr key={i.key}>
                  <th scope="row">
                    <span class="dc-gloss">{i.label}</span>
                    {showOfficial(i.label, i.official) ? (
                      <span class="dc-official" lang="fr">
                        {i.official}
                      </span>
                    ) : null}
                    {i.unconfirmed ? (
                      <span class="muted small-text">
                        {td(lang, 'declaredUnconfirmed', { n: i.unconfirmed })}
                      </span>
                    ) : null}
                  </th>
                  <td class="dc-num tnum">
                    {i.declared !== undefined ? formatChf(i.declared, lang) : ''}
                  </td>
                  <td class="dc-num tnum">{formatChf(i.assessed, lang)}</td>
                  <td>
                    {i.difference === undefined ? (
                      <span class="chip chip-missing">{td(lang, 'notDeclared')}</span>
                    ) : i.difference === 0 ? (
                      <span class="chip chip-stated">{td(lang, 'same')}</span>
                    ) : (
                      <span class="chip chip-fix tnum">
                        {td(lang, 'different', {
                          amount: `${i.difference > 0 ? '+' : ''}${formatChf(i.difference, lang)}`,
                        })}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {a.totals.length ? (
        <div class="dc-totals">
          <strong class="small-text">{td(lang, 'totalsTitle')}</strong>
          <ul class="plain-list">
            {a.totals.map((t) => (
              <li key={t.key}>
                {t.label}
                {showOfficial(t.label, t.official) ? (
                  <span class="dc-official" lang="fr">
                    {' '}
                    ({t.official})
                  </span>
                ) : null}
                {td(lang, 'colon')}
                <span class="tnum">{formatChf(t.assessed, lang)}</span>
              </li>
            ))}
          </ul>
          <span class="muted small-text">{td(lang, 'totalsNote')}</span>
        </div>
      ) : null}

      <p class="small-text">{a.text.notAMistake}</p>
      <p class="small-text">
        <strong>{a.text.never}</strong>
      </p>
    </section>
  );
}

export function Assessment({ state, lang }: { state: State; lang: Language }) {
  if (state.assessments.length === 0) return null;
  return (
    <>
      {state.assessments.map((a) => (
        <One key={a.docId} a={a} lang={lang} />
      ))}
    </>
  );
}
