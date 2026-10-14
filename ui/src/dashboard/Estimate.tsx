// "Your estimate": the tax from Taxpresso's rules engine (SPEC.md section 7), with the cantonal
// and communal tax (ICC), the federal tax (IFD), the main items and every estimated value flagged
// (section 9: estimates are flagged everywhere). Amounts arrive as integer centimes from the
// extension (extension/src/estimate.ts, estimateView); nothing is computed here.
import type { JSX } from 'preact';
import { cantonKey, t, type Language } from './i18n';
import './estimate.css';

/** extension/src/estimate.ts, EstimateView. */
export type EstimateView =
  | { computed: false; missing: string[] }
  | {
      computed: true;
      /** Set for a preview canton's return (extension/src/estimate.ts); Geneva's has none. */
      canton?: string;
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
      /** False when some amount is known only in part: the taxes are then floors. */
      complete: boolean;
      /** Zurich, a preview: the rules the documents don't spell out, and what was assumed. */
      unverified?: string[];
      assumptions?: string[];
      /** This year against last year's declaration, rubric by rubric (comparison only). */
      lastYear: {
        code: string;
        label: string;
        official: string;
        who: string;
        lastYear: { icc?: number; ifd?: number };
        thisYear: { icc?: number; ifd?: number };
        provisional: boolean;
      }[];
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
    incomplete: 'At least',
    lastYearTitle: 'This year and last year',
    lastYearNote:
      'Last year’s figures come from your previous declaration. They are only for comparison and never change this year’s tax.',
    lastYearCol: 'Last year',
    thisYearCol: 'This year',
    icc: 'cantonal',
    ifd: 'federal',
    foot: 'Computed on this computer by Taxpresso from the official documents. Ask Claude why any figure is what it is.',
    officialZh: 'Steuern {year}',
    breakdownZh: 'What the cantonal and communal tax (Staats- und Gemeindesteuern) is made of',
    taxableZh:
      'Taxable income (steuerbares Einkommen): cantonal {icc}, federal {ifd}. Taxable wealth (steuerbares Vermögen): {wealth}.',
    preview: '{canton} is a preview: what to check',
    previewNote:
      'Taxpresso computes {canton} from the official documents. A few rules aren’t spelled out in them, and some answers were assumed. Here they are.',
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
    incomplete: 'Au moins',
    lastYearTitle: 'Cette année et l’an dernier',
    lastYearNote:
      'Les montants de l’an dernier viennent de votre déclaration précédente. Ils servent seulement à comparer et ne changent jamais l’impôt de cette année.',
    lastYearCol: 'L’an dernier',
    thisYearCol: 'Cette année',
    icc: 'cantonal',
    ifd: 'fédéral',
    foot: 'Calculé sur cet ordinateur par Taxpresso à partir des documents officiels. Demandez à Claude pourquoi un montant est ce qu’il est.',
    officialZh: 'Steuern {year}',
    breakdownZh: 'Ce qui compose l’impôt cantonal et communal (Staats- und Gemeindesteuern)',
    taxableZh: `Revenu imposable (steuerbares Einkommen)${NB}: cantonal {icc}, fédéral {ifd}. Fortune imposable (steuerbares Vermögen)${NB}: {wealth}.`,
    preview: `{canton} est en avant-première${NB}: ce qu’il faut vérifier`,
    previewNote:
      'Taxpresso calcule {canton} à partir des documents officiels. Quelques règles n’y sont pas détaillées, et certaines réponses ont été supposées. Les voici.',
  },
  de: {
    title: 'Deine Schätzung',
    official: 'impôts {year}',
    estimate: 'Schätzung',
    computed: 'Berechnet',
    total: 'Total',
    missing: 'Um deine Steuern zu berechnen, braucht Taxpresso zuerst: {what}.',
    notComputed: 'Nicht berechnet',
    breakdown: 'Woraus die Kantons- und Gemeindesteuer besteht',
    taxable:
      'Steuerbares Einkommen (revenu imposable): Kanton {icc}, Bund {ifd}. Steuerbares Vermögen (fortune imposable): {wealth}.',
    items: 'Wichtigste Posten',
    estimated: 'Was geschätzt ist',
    needsOk:
      '{n} Werte aus deinen Dokumenten brauchen noch dein OK: Die Zahlen ändern sich, wenn du sie korrigierst.',
    needsOkOne:
      '1 Wert aus deinen Dokumenten braucht noch dein OK: Die Zahlen ändern sich, wenn du ihn korrigierst.',
    notes: 'Nicht in diesen Zahlen',
    incomplete: 'Mindestens',
    lastYearTitle: 'Dieses Jahr und letztes Jahr',
    lastYearNote:
      'Die Zahlen des Vorjahres stammen aus deiner letzten Steuererklärung. Sie dienen nur zum Vergleich und ändern die Steuer dieses Jahres nie.',
    lastYearCol: 'Letztes Jahr',
    thisYearCol: 'Dieses Jahr',
    icc: 'Kanton',
    ifd: 'Bund',
    foot: 'Von Taxpresso auf diesem Computer aus den offiziellen Dokumenten berechnet. Frag Claude, warum eine Zahl so ist, wie sie ist.',
    officialZh: 'Steuern {year}',
    breakdownZh: 'Woraus die Staats- und Gemeindesteuern bestehen',
    taxableZh:
      'Steuerbares Einkommen: Staatssteuer {icc}, Bundessteuer {ifd}. Steuerbares Vermögen: {wealth}.',
    preview: '{canton} ist eine Vorschau: Was du prüfen solltest',
    previewNote:
      'Taxpresso berechnet {canton} aus den offiziellen Dokumenten. Ein paar Regeln sind darin nicht genau festgelegt, und einige Antworten wurden angenommen. Hier sind sie.',
  },
} as const;

type Key = keyof (typeof text)['en'];
const AND: Record<Language, string> = { en: ' and ', fr: ' et ', de: ' und ' };
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

/** One figure, or the cantonal and federal ones when they differ. */
function pair(p: { icc?: number; ifd?: number }, lang: Language): string {
  if (p.icc !== undefined && p.ifd !== undefined && p.icc !== p.ifd) {
    return `${chf(p.icc, lang)} (${tr(lang, 'icc')}), ${chf(p.ifd, lang)} (${tr(lang, 'ifd')})`;
  }
  return chf(p.icc ?? p.ifd ?? null, lang);
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
  cantonName,
}: {
  view: EstimateView | undefined;
  lang: Language;
  /** The canton's name in the page's language, for a preview canton's notes. */
  cantonName?: string | undefined;
}): JSX.Element | null {
  if (!view) return null;
  if (!view.computed) {
    return (
      <section class="stack" aria-labelledby="est-title">
        <div class="section-head">
          <h2 id="est-title">{tr(lang, 'title')}</h2>
        </div>
        <div class="card est-card">
          <p class="est-note">{tr(lang, 'missing', { what: view.missing.join(AND[lang]) })}</p>
        </div>
      </section>
    );
  }
  const own = (key: Key) => cantonKey(text.en, key, view.canton);
  const preview = [...(view.unverified ?? []), ...(view.assumptions ?? [])];
  return (
    <section class="stack" aria-labelledby="est-title">
      <div class="section-head">
        <h2 id="est-title">
          {tr(lang, 'title')}{' '}
          <span class="est-official">({tr(lang, own('official'), { year: view.taxYear })})</span>
        </h2>
        <span class={`chip ${view.estimate ? 'chip-estimate' : 'chip-computed'}`}>
          {tr(lang, view.estimate ? 'estimate' : 'computed')}
        </span>
      </div>
      <div class="card est-card">
        <div class="est-total">
          <span>{tr(lang, 'total')}</span>
          <strong class="tnum">
            {view.total === null
              ? tr(lang, 'notComputed')
              : `${view.complete ? '' : `${tr(lang, 'incomplete')} `}${chf(view.total, lang)}`}
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
            <summary>{tr(lang, own('breakdown'))}</summary>
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
          {tr(lang, own('taxable'), {
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
        {view.lastYear.length ? (
          <details class="est-details">
            <summary>{tr(lang, 'lastYearTitle')}</summary>
            <p class="est-note">{tr(lang, 'lastYearNote')}</p>
            <ul class="est-items">
              {view.lastYear.map((x) => (
                <li key={`${x.code}-${x.who}`} class="est-item" title={x.official}>
                  <span class="est-label">
                    <span class="tnum est-code">{x.code}</span> {x.label}
                    {x.who ? <span class="muted"> · {x.who}</span> : null}
                  </span>
                  <span class="est-amount">
                    <span class="muted">{tr(lang, 'lastYearCol')}</span>
                    <span class="tnum">{pair(x.lastYear, lang)}</span>
                    <span class="muted">{tr(lang, 'thisYearCol')}</span>
                    <span class="tnum">{pair(x.thisYear, lang)}</span>
                    {x.provisional ? (
                      <span class="chip chip-estimate">{tr(lang, 'estimate')}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </details>
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
        {preview.length ? (
          <details class="est-details">
            <summary>{tr(lang, 'preview', { canton: cantonName ?? '' })}</summary>
            <p class="est-note">{tr(lang, 'previewNote', { canton: cantonName ?? '' })}</p>
            <ul>
              {preview.map((n) => (
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
