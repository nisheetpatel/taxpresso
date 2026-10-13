// "Your estimate": the tax from Taxpresso's rules engine (SPEC.md section 7), with the cantonal
// and communal tax (ICC), the federal tax (IFD), the main items and every estimated value flagged
// (section 9: estimates are flagged everywhere). Amounts arrive as integer centimes from the
// extension (extension/src/estimate.ts, estimateView); nothing is computed here.
import type { JSX } from 'preact';
import { t, type Language } from './i18n';
import './estimate.css';

/** extension/src/estimate.ts, EstimateView. */
export type EstimateView =
  | { computed: false; missing: string[] }
  | {
      computed: true;
      taxYear: number;
      total: number | null;
      estimate: boolean;
      rows: Row[];
      parts: Row[];
      taxable: { icc: number | null; ifd: number | null; wealth: number | null };
      items: {
        code: string;
        label: string;
        who: string;
        amount: number;
        how: string;
        estimate: boolean;
        needsOk: boolean;
      }[];
      estimates: string[];
      needsOk: number;
      notes: string[];
    };

interface Row {
  id: string;
  label: string;
  amount: number;
  estimate: boolean;
  needsOk: boolean;
}

const NB = String.fromCharCode(0xa0);

const text = {
  en: {
    title: 'Your estimate',
    official: 'impôts {year}',
    estimate: 'Estimate',
    computed: 'Computed',
    total: 'Total',
    missing: 'To compute your tax, Taxpresso first needs {what}.',
    notComputed: 'Not computed',
    breakdown: 'What the cantonal and communal tax is made of',
    taxable:
      'Taxable income (revenu imposable): cantonal {icc}, federal {ifd}. Taxable wealth (fortune imposable): {wealth}.',
    items: 'Main items',
    estimated: 'What is an estimate',
    needsOk:
      '{n} values read from your documents still need your OK: the figures will change if you correct them.',
    needsOkOne:
      '1 value read from your documents still needs your OK: the figures will change if you correct it.',
    notes: 'Not in these figures',
    foot: 'Computed on this computer by Taxpresso from the official documents. Ask Claude why any figure is what it is.',
  },
  fr: {
    title: 'Votre estimation',
    official: 'impôts {year}',
    estimate: 'Estimation',
    computed: 'Calculé',
    total: 'Total',
    missing: `Pour calculer votre impôt, Taxpresso a d’abord besoin de${NB}: {what}.`,
    notComputed: 'Non calculé',
    breakdown: 'Ce qui compose l’impôt cantonal et communal',
    taxable: `Revenu imposable${NB}: cantonal {icc}, fédéral {ifd}. Fortune imposable${NB}: {wealth}.`,
    items: 'Principaux éléments',
    estimated: 'Ce qui est estimé',
    needsOk: `{n} montants lus dans vos documents attendent votre confirmation${NB}: les chiffres changeront si vous les corrigez.`,
    needsOkOne: `1 montant lu dans vos documents attend votre confirmation${NB}: les chiffres changeront si vous le corrigez.`,
    notes: 'Pas compris dans ces chiffres',
    foot: 'Calculé sur cet ordinateur par Taxpresso à partir des documents officiels. Demandez à Claude pourquoi un montant est ce qu’il est.',
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

function chf(centimes: number | null, lang: Language): string {
  if (centimes === null) return '-';
  return new Intl.NumberFormat(`${lang}-CH`, {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  }).format(centimesString(centimes));
}

function Flags({
  estimate,
  needsOk,
  lang,
}: {
  estimate: boolean;
  needsOk: boolean;
  lang: Language;
}) {
  return (
    <>
      {estimate ? <span class="chip chip-estimate">{tr(lang, 'estimate')}</span> : null}
      {needsOk ? <span class="chip chip-needs-ok">{t(lang, 'statusNeedsOk')}</span> : null}
    </>
  );
}

export function Estimate({
  view,
  lang,
}: {
  view: EstimateView | undefined;
  lang: Language;
}): JSX.Element | null {
  if (!view) return null;
  if (!view.computed) {
    return (
      <section class="stack" aria-labelledby="est-title">
        <div class="section-head">
          <h2 id="est-title">{tr(lang, 'title')}</h2>
        </div>
        <div class="card est-card">
          <p class="est-note">
            {tr(lang, 'missing', { what: view.missing.join(lang === 'fr' ? ' et ' : ' and ') })}
          </p>
        </div>
      </section>
    );
  }
  return (
    <section class="stack" aria-labelledby="est-title">
      <div class="section-head">
        <h2 id="est-title">
          {tr(lang, 'title')}{' '}
          <span class="est-official">({tr(lang, 'official', { year: view.taxYear })})</span>
        </h2>
        <span class={`chip ${view.estimate ? 'chip-estimate' : 'chip-computed'}`}>
          {tr(lang, view.estimate ? 'estimate' : 'computed')}
        </span>
      </div>
      <div class="card est-card">
        <div class="est-total">
          <span>{tr(lang, 'total')}</span>
          <strong class="tnum">
            {view.total === null ? tr(lang, 'notComputed') : chf(view.total, lang)}
          </strong>
        </div>
        <ul class="est-rows">
          {view.rows.map((r) => (
            <li key={r.id} class="est-row">
              <span class="est-label">{r.label}</span>
              <span class="est-amount">
                <span class="tnum">{chf(r.amount, lang)}</span>
                <Flags estimate={r.estimate} needsOk={r.needsOk} lang={lang} />
              </span>
            </li>
          ))}
        </ul>
        {view.parts.length ? (
          <details class="est-details">
            <summary>{tr(lang, 'breakdown')}</summary>
            <ul class="est-rows">
              {view.parts.map((r) => (
                <li key={r.id} class="est-row">
                  <span class="est-label">{r.label}</span>
                  <span class="tnum">{chf(r.amount, lang)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <p class="est-note">
          {tr(lang, 'taxable', {
            icc: chf(view.taxable.icc, lang),
            ifd: chf(view.taxable.ifd, lang),
            wealth: chf(view.taxable.wealth, lang),
          })}
        </p>
        {view.items.length ? (
          <>
            <h3 class="est-subtitle">{tr(lang, 'items')}</h3>
            <ul class="est-items">
              {view.items.map((i) => (
                <li key={`${i.code}-${i.who}`} class="est-item" title={i.how}>
                  <span class="est-label">
                    <span class="tnum est-code">{i.code}</span> {i.label}
                    {i.who ? <span class="muted"> · {i.who}</span> : null}
                  </span>
                  <span class="est-amount">
                    <span class="tnum">{chf(i.amount, lang)}</span>
                    <Flags estimate={i.estimate} needsOk={i.needsOk} lang={lang} />
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {view.estimates.length ? (
          <div class="est-flagged">
            <strong>{tr(lang, 'estimated')}</strong>
            <ul>
              {view.estimates.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {view.needsOk ? (
          <p class="est-note">
            {view.needsOk === 1 ? tr(lang, 'needsOkOne') : tr(lang, 'needsOk', { n: view.needsOk })}
          </p>
        ) : null}
        {view.notes.length ? (
          <details class="est-details">
            <summary>{tr(lang, 'notes')}</summary>
            <ul>
              {view.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </details>
        ) : null}
        <p class="est-note">{tr(lang, 'foot')}</p>
      </div>
    </section>
  );
}
