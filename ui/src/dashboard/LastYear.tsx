// "Last year": the main figures of last year's declaration (SPEC.md section 5.4), read by
// Taxpresso on this computer, to compare with this year. Nothing here is filed. Amounts arrive as
// integer centimes and are formatted from exact decimal strings, never through floating point.
import type { JSX } from 'preact';
import { t, type Language } from './i18n';
import './lastyear.css';

/** extension/src/prior.ts, LastYearView. */
export interface LastYearView {
  docId: string;
  filename: string;
  taxYear?: number;
  software?: string;
  expectedYear?: number;
  sections: {
    id: 'income' | 'deductions' | 'wealth';
    lines: {
      code: string;
      label: string;
      official: string;
      who?: string;
      person: 'A' | 'B' | 'household';
      icc?: number;
      ifd?: number;
      page?: number;
    }[];
  }[];
  suggestions: number;
  warnings: string[];
}

const NB = String.fromCharCode(0xa0);

export const text = {
  en: {
    title: 'Last year',
    official: 'déclaration {year}',
    officialNoYear: 'déclaration de l’an dernier',
    by: 'Printed by {software}',
    note: 'Read by Taxpresso on this computer from your {year} declaration, to compare with {taxYear}. Nothing here goes into your {taxYear} declaration, and Taxpresso keeps no name or number from it.',
    noteNoYear:
      'Read by Taxpresso on this computer from your last declaration, to compare with {taxYear}. Nothing here goes into your {taxYear} declaration, and Taxpresso keeps no name or number from it.',
    suggestionsOne: '1 answer suggested from it: check it with the questions above.',
    suggestions: '{n} answers suggested from it: check them with the questions above.',
    older: 'This is your {year} declaration, not the {expected} one: the figures are from {year}.',
    income: 'Income',
    incomeFr: 'revenus',
    deductions: 'Deductions',
    deductionsFr: 'déductions',
    wealth: 'Wealth',
    wealthFr: 'fortune',
    icc: 'Cantonal tax (ICC)',
    ifd: 'Federal tax (IFD)',
    page: 'page {page}',
    none: 'Taxpresso found none of the main lines in it.',
    linesOne: '1 line',
    lines: '{n} lines',
    warningsOne: '1 thing to check',
    warnings: '{n} things to check',
  },
  fr: {
    title: 'L’an dernier',
    official: 'déclaration {year}',
    officialNoYear: 'déclaration de l’an dernier',
    by: 'Imprimée par {software}',
    note: 'Lu par Taxpresso sur cet ordinateur dans votre déclaration {year}, pour comparer avec {taxYear}. Rien ici ne va dans votre déclaration {taxYear}, et Taxpresso n’en garde aucun nom ni numéro.',
    noteNoYear:
      'Lu par Taxpresso sur cet ordinateur dans votre dernière déclaration, pour comparer avec {taxYear}. Rien ici ne va dans votre déclaration {taxYear}, et Taxpresso n’en garde aucun nom ni numéro.',
    suggestionsOne: `1 réponse proposée à partir de celle-ci${NB}: vérifiez-la avec les questions ci-dessus.`,
    suggestions: `{n} réponses proposées à partir de celle-ci${NB}: vérifiez-les avec les questions ci-dessus.`,
    older: `C’est votre déclaration {year}, pas celle de {expected}${NB}: les montants sont ceux de {year}.`,
    income: 'Revenus',
    incomeFr: '',
    deductions: 'Déductions',
    deductionsFr: '',
    wealth: 'Fortune',
    wealthFr: '',
    icc: 'Impôt cantonal (ICC)',
    ifd: 'Impôt fédéral (IFD)',
    page: 'page {page}',
    none: 'Taxpresso n’y a trouvé aucune des lignes principales.',
    linesOne: '1 ligne',
    lines: '{n} lignes',
    warningsOne: '1 point à vérifier',
    warnings: '{n} points à vérifier',
  },
  de: {
    title: 'Letztes Jahr',
    official: 'déclaration {year}',
    officialNoYear: 'déclaration de l’an dernier',
    by: 'Gedruckt von {software}',
    note: 'Von Taxpresso auf diesem Computer aus deiner Steuererklärung {year} gelesen, zum Vergleich mit {taxYear}. Nichts davon kommt in deine Steuererklärung {taxYear}, und Taxpresso behält keinen Namen und keine Nummer daraus.',
    noteNoYear:
      'Von Taxpresso auf diesem Computer aus deiner letzten Steuererklärung gelesen, zum Vergleich mit {taxYear}. Nichts davon kommt in deine Steuererklärung {taxYear}, und Taxpresso behält keinen Namen und keine Nummer daraus.',
    suggestionsOne: '1 Antwort daraus vorgeschlagen: Prüfe sie bei den Fragen oben.',
    suggestions: '{n} Antworten daraus vorgeschlagen: Prüfe sie bei den Fragen oben.',
    older:
      'Das ist deine Steuererklärung {year}, nicht die von {expected}: Die Zahlen sind von {year}.',
    income: 'Einkünfte',
    incomeFr: 'revenus',
    deductions: 'Abzüge',
    deductionsFr: 'déductions',
    wealth: 'Vermögen',
    wealthFr: 'fortune',
    icc: 'Kantonssteuer (ICC)',
    ifd: 'Bundessteuer (IFD)',
    page: 'Seite {page}',
    none: 'Taxpresso hat darin keine der Hauptzeilen gefunden.',
    linesOne: '1 Zeile',
    lines: '{n} Zeilen',
    warningsOne: '1 Punkt zu prüfen',
    warnings: '{n} Punkte zu prüfen',
  },
  it: {
    title: 'L’anno scorso',
    official: 'déclaration {year}',
    officialNoYear: 'déclaration de l’an dernier',
    by: 'Stampata da {software}',
    note: 'Taxpresso ha letto queste cifre su questo computer nella tua dichiarazione {year}, per confrontarle con il {taxYear}. Niente di quello che vedi qui finisce nella tua dichiarazione {taxYear}, e Taxpresso non ne conserva nessun nome né numero.',
    noteNoYear:
      'Taxpresso ha letto queste cifre su questo computer nella tua ultima dichiarazione, per confrontarle con il {taxYear}. Niente di quello che vedi qui finisce nella tua dichiarazione {taxYear}, e Taxpresso non ne conserva nessun nome né numero.',
    suggestionsOne:
      '1 risposta proposta in base a questa dichiarazione: controllala con le domande qui sopra.',
    suggestions:
      '{n} risposte proposte in base a questa dichiarazione: controllale con le domande qui sopra.',
    older:
      'Questa è la tua dichiarazione {year}, non quella del {expected}: le cifre sono del {year}.',
    income: 'Redditi',
    incomeFr: 'revenus',
    deductions: 'Deduzioni',
    deductionsFr: 'déductions',
    wealth: 'Sostanza',
    wealthFr: 'fortune',
    icc: 'Imposta cantonale (ICC)',
    ifd: 'Imposta federale (IFD)',
    page: 'pagina {page}',
    none: 'Taxpresso non vi ha trovato nessuna delle righe principali.',
    linesOne: '1 riga',
    lines: '{n} righe',
    warningsOne: '1 punto da verificare',
    warnings: '{n} punti da verificare',
  },
} as const;

type Key = keyof (typeof text)['en'];
const tr = (lang: Language, key: Key, vars: Record<string, string | number> = {}) =>
  text[lang][key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

/** Centimes as an exact decimal string: 123456 -> "1234.56". */
function centimesString(centimes: number): `${number}` {
  const negative = centimes < 0;
  const digits = String(Math.abs(centimes)).padStart(3, '0');
  return `${negative ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}` as `${number}`;
}

/** As the declaration printed it: whole francs, centimes only when there are some. */
function chf(centimes: number, lang: Language): string {
  const whole = centimes % 100 === 0;
  return new Intl.NumberFormat(`${lang}-CH`, {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(centimesString(centimes));
}

function Figure({ label, centimes, lang }: { label: string; centimes?: number; lang: Language }) {
  if (centimes === undefined) return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd class="tnum">{chf(centimes, lang)}</dd>
    </div>
  );
}

export function LastYear({
  view,
  year,
  lang,
}: {
  view: LastYearView | null | undefined;
  year: number;
  lang: Language;
}): JSX.Element | null {
  if (!view) return null;
  const vars = { year: view.taxYear ?? '', taxYear: year };
  return (
    <section class="stack" aria-labelledby="ly-title">
      <div class="section-head">
        <h2 id="ly-title">
          {tr(lang, 'title')}{' '}
          <span class="ly-official">
            ({view.taxYear ? tr(lang, 'official', vars) : tr(lang, 'officialNoYear')})
          </span>
        </h2>
        {view.software ? (
          <span class="muted">{tr(lang, 'by', { software: view.software })}</span>
        ) : null}
      </div>
      <div class="card ly-card">
        <p class="ly-note">{tr(lang, view.taxYear ? 'note' : 'noteNoYear', vars)}</p>
        {view.suggestions ? (
          <p class="ly-suggest">
            <span class="chip chip-needs-ok">{t(lang, 'statusNeedsOk')}</span>
            <span>
              {view.suggestions === 1
                ? tr(lang, 'suggestionsOne')
                : tr(lang, 'suggestions', { n: view.suggestions })}
            </span>
          </p>
        ) : null}
        {view.expectedYear ? (
          <p class="banner banner-estimate">
            {tr(lang, 'older', { year: view.taxYear ?? '', expected: view.expectedYear })}
          </p>
        ) : null}
        {view.sections.length === 0 ? <p class="ly-note">{tr(lang, 'none')}</p> : null}
        {view.sections.map((s, i) => (
          // The first section open; the others one tap away, so the card stays short.
          <details class="ly-section" key={s.id} open={i === 0}>
            <summary>
              <h3>
                {tr(lang, s.id)}
                {tr(lang, `${s.id}Fr`) ? (
                  <span class="ly-official"> ({tr(lang, `${s.id}Fr`)})</span>
                ) : null}
              </h3>
              <span class="muted small-text">
                {s.lines.length === 1
                  ? tr(lang, 'linesOne')
                  : tr(lang, 'lines', { n: s.lines.length })}
              </span>
            </summary>
            <ul class="ly-list">
              {s.lines.map((l) => (
                <li key={`${l.code}-${l.person}`} class="ly-row">
                  <div class="ly-label">
                    <strong>
                      {l.label}
                      {l.who ? <span class="muted"> · {l.who}</span> : null}
                    </strong>
                    <span class="muted small-text">
                      {l.official} · <span class="tnum">{l.code}</span>
                      {l.page ? ` · ${tr(lang, 'page', { page: l.page })}` : ''}
                    </span>
                  </div>
                  <dl class="ly-figures">
                    <Figure label={tr(lang, 'icc')} centimes={l.icc} lang={lang} />
                    {s.id === 'wealth' ? null : (
                      <Figure label={tr(lang, 'ifd')} centimes={l.ifd} lang={lang} />
                    )}
                  </dl>
                </li>
              ))}
            </ul>
          </details>
        ))}
        {view.warnings.length ? (
          <details class="ly-warnings" open={view.warnings.length <= 2}>
            <summary>
              {view.warnings.length === 1
                ? tr(lang, 'warningsOne')
                : tr(lang, 'warnings', { n: view.warnings.length })}
            </summary>
            <ul>
              {view.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}
