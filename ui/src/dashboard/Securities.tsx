// The securities list (état des titres) read from broker exports (SPEC.md section 5.7): one row
// per security, totals, what to check, and a plain note that values use the broker's prices until
// the official price list for the year is available. Amounts arrive as integer centimes and are
// formatted from exact decimal strings, never through floating point.
import type { JSX } from 'preact';
import { t, type Language } from './i18n';
import './securities.css';

/** extension/src/securities.ts, SecuritiesView. */
export interface SecuritiesView {
  rows: {
    id: string;
    name: string;
    isin?: string;
    currency?: string;
    quantity?: string;
    valueOriginal?: string;
    valueChf?: number;
    incomeChf?: number;
    swissChf?: number;
    foreignChf?: number;
    needsOk: boolean;
    estimate: boolean;
  }[];
  totals: {
    valueChf: number;
    incomeChf: number;
    swissChf: number;
    foreignChf: number;
    incomplete: boolean;
  };
  warnings: string[];
  exports: number;
}

const NB = String.fromCharCode(0xa0);

const text = {
  en: {
    title: 'Securities',
    official: 'état des titres',
    count: '{n} securities',
    countOne: '1 security',
    note: 'Values use your broker’s prices and exchange rates until the official price list for {year} (liste des cours, from the Federal Tax Administration) is available. Check the quantities and income against your broker’s statement.',
    value: 'Value on 31 December (valeur imposable)',
    income: 'Gross income (rendement brut)',
    swiss: 'Swiss tax withheld (impôt anticipé)',
    foreign: 'Foreign tax withheld (impôts étrangers)',
    estimate: 'Estimate',
    noRate: 'No CHF rate',
    total: 'Total',
    incomplete: 'Some CHF amounts are missing: the export has no exchange rate for them.',
    warnings: '{n} things to check',
    warningsOne: '1 thing to check',
    inCurrency: 'Broker value: {amount}',
    held: 'Held on 31 December: {quantity}',
  },
  fr: {
    title: 'Titres',
    official: 'état des titres',
    count: '{n} titres',
    countOne: '1 titre',
    note: 'Les valeurs utilisent les cours et les taux de change de votre courtier jusqu’à la publication de la liste des cours {year} de l’Administration fédérale des contributions. Vérifiez les quantités et les revenus avec le relevé de votre courtier.',
    value: 'Valeur imposable au 31 décembre',
    income: 'Rendement brut',
    swiss: 'Impôt anticipé retenu',
    foreign: 'Impôts étrangers retenus',
    estimate: 'Estimation',
    noRate: 'Pas de taux en CHF',
    total: 'Total',
    incomplete: `Certains montants en CHF manquent${NB}: l’export n’a pas de taux de change pour eux.`,
    warnings: '{n} points à vérifier',
    warningsOne: '1 point à vérifier',
    inCurrency: `Valeur du courtier${NB}: {amount}`,
    held: `Détenus au 31 décembre${NB}: {quantity}`,
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

function chf(centimes: number, lang: Language): string {
  return new Intl.NumberFormat(`${lang}-CH`, {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  }).format(centimesString(centimes));
}

/** A decimal string from the ledger ("3.5"), grouped for the reader, exactly. */
function decimal(value: string, lang: Language, currency?: string): string {
  if (!/^-?\d+(\.\d+)?$/.test(value)) return currency ? `${currency} ${value}` : value;
  return new Intl.NumberFormat(
    `${lang}-CH`,
    currency
      ? { style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: 20 }
      : { maximumFractionDigits: 20 },
  ).format(value as `${number}`);
}

function Amount({ centimes, lang }: { centimes: number | undefined; lang: Language }) {
  return centimes === undefined ? (
    <span class="muted">{tr(lang, 'noRate')}</span>
  ) : (
    <span class="tnum">{chf(centimes, lang)}</span>
  );
}

export function Securities({
  view,
  year,
  lang,
}: {
  view: SecuritiesView | null | undefined;
  year: number;
  lang: Language;
}): JSX.Element | null {
  if (!view) return null;
  const { rows, totals, warnings } = view;
  return (
    <section class="stack" aria-labelledby="sec-title">
      <div class="section-head">
        <h2 id="sec-title">
          {tr(lang, 'title')} <span class="sec-official">({tr(lang, 'official')})</span>
        </h2>
        <span class="muted">
          {rows.length === 1 ? tr(lang, 'countOne') : tr(lang, 'count', { n: rows.length })}
        </span>
      </div>
      <div class="card sec-card">
        {rows.some((r) => r.estimate) ? <p class="sec-note">{tr(lang, 'note', { year })}</p> : null}
        {rows.length ? (
          <ul class="sec-list">
            {rows.map((r) => (
              <li key={r.id} class="sec-row">
                <div class="sec-head">
                  <div class="sec-name">
                    <strong>{r.name}</strong>
                    <span class="muted small-text">
                      {r.isin ? <span class="tnum">{r.isin} · </span> : null}
                      {tr(lang, 'held', { quantity: decimal(r.quantity ?? '0', lang) })}
                    </span>
                  </div>
                  {r.needsOk ? (
                    <span class="chip chip-needs-ok">{t(lang, 'statusNeedsOk')}</span>
                  ) : null}
                </div>
                <dl class="sec-figures">
                  <div>
                    <dt>{tr(lang, 'value')}</dt>
                    <dd>
                      <Amount centimes={r.valueChf} lang={lang} />
                      {r.estimate ? (
                        <span class="chip chip-estimate">{tr(lang, 'estimate')}</span>
                      ) : null}
                      {r.valueOriginal && r.currency && r.currency !== 'CHF' ? (
                        <span class="sec-sub muted">
                          {tr(lang, 'inCurrency', {
                            currency: r.currency,
                            amount: decimal(r.valueOriginal, lang, r.currency),
                          })}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt>{tr(lang, 'income')}</dt>
                    <dd>
                      <Amount centimes={r.incomeChf} lang={lang} />
                    </dd>
                  </div>
                  <div>
                    <dt>{tr(lang, 'swiss')}</dt>
                    <dd>
                      <Amount centimes={r.swissChf} lang={lang} />
                    </dd>
                  </div>
                  <div>
                    <dt>{tr(lang, 'foreign')}</dt>
                    <dd>
                      <Amount centimes={r.foreignChf} lang={lang} />
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        ) : null}
        {rows.length > 1 ? (
          <div class="sec-totals">
            <strong>{tr(lang, 'total')}</strong>
            <dl class="sec-figures">
              <div>
                <dt>{tr(lang, 'value')}</dt>
                <dd class="tnum">{chf(totals.valueChf, lang)}</dd>
              </div>
              <div>
                <dt>{tr(lang, 'income')}</dt>
                <dd class="tnum">{chf(totals.incomeChf, lang)}</dd>
              </div>
              <div>
                <dt>{tr(lang, 'swiss')}</dt>
                <dd class="tnum">{chf(totals.swissChf, lang)}</dd>
              </div>
              <div>
                <dt>{tr(lang, 'foreign')}</dt>
                <dd class="tnum">{chf(totals.foreignChf, lang)}</dd>
              </div>
            </dl>
          </div>
        ) : null}
        {totals.incomplete ? <p class="sec-note">{tr(lang, 'incomplete')}</p> : null}
        {warnings.length ? (
          <details class="sec-warnings" open={warnings.length <= 3}>
            <summary>
              {warnings.length === 1
                ? tr(lang, 'warningsOne')
                : tr(lang, 'warnings', { n: warnings.length })}
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
