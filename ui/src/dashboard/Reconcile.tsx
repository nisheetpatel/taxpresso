// "Check before you transmit" (SPEC.md 10.4, docs/design/3b-filing-and-reconciliation.html): the
// PDF of this year's declaration, read on this computer, against the values to type. Differences
// first, each with what the PDF says and what to type; matches and the lines the form works out
// folded away. The user transmits the declaration themselves: Taxpresso never does.
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import './reconcile.css';
import { api } from './api';
import type { Language } from './i18n';
import { tr } from './i18n-reconcile';
import type { State } from './types';
import type {
  ByEyeLine,
  CheckCell,
  CheckLine,
  ComputedLine,
  DeclarationCheckState,
} from './types-reconcile';

type Act = (fn: () => Promise<State>, label?: string) => Promise<boolean>;

const COLUMN = { icc: 'ICC', ifd: 'IFD', wealth: 'Fortune', amount: '' } as const;

/** Whole francs as the page's language writes them. */
const francs = (n: number, lang: Language) =>
  new Intl.NumberFormat(`${lang}-CH`, {
    style: 'currency',
    currency: 'CHF',
    maximumFractionDigits: 0,
  }).format(n);

type AnyCell = Pick<CheckCell, 'column' | 'pdf' | 'taxpresso'> & { expected?: number };

function Amounts({
  cells,
  side,
  lang,
}: {
  cells: readonly AnyCell[];
  side: 'pdf' | 'taxpresso';
  lang: Language;
}) {
  const shown = cells.filter((c) => c[side] !== undefined);
  if (!shown.length) return <span class="muted">{tr(lang, 'nothing')}</span>;
  return (
    <span class="rc-amounts tnum">
      {shown.map((c) => (
        <span key={c.column}>
          {COLUMN[c.column] ? <span class="rc-col">{COLUMN[c.column]}</span> : null}
          {francs(c[side]!, lang)}
        </span>
      ))}
    </span>
  );
}

function Who({ line, state }: { line: Pick<CheckLine, 'person' | 'part'>; state: State }): string {
  if (line.part) return `${line.part.label} (${line.part.gloss})`;
  if (state.people.length < 2 || line.person === 'household') return '';
  const p = state.people.find((x) => x.id === (line.person === 'A' ? 'p1' : 'p2'));
  return p ? `${line.person === 'A' ? 'Contr. A' : 'Contr. B'} (${p.label})` : '';
}

function Label({
  line,
  page,
  state,
  lang,
}: {
  line: Pick<CheckLine, 'label' | 'gloss' | 'person' | 'part'> & {
    known?: boolean;
    pdfPage?: number;
  };
  page: string;
  state: State;
  lang: Language;
}) {
  const who = Who({ line, state });
  const meta = [page, who, line.pdfPage ? tr(lang, 'pdfPage', { page: line.pdfPage }) : '']
    .filter(Boolean)
    .join(' · ');
  return (
    <div class="rc-label">
      {line.label ? (
        <span class="rc-official" lang="fr">
          {line.label}
        </span>
      ) : null}
      <span class="rc-gloss">{line.known === false ? tr(lang, 'unknownCode') : line.gloss}</span>
      {meta ? <span class="muted small-text">{meta}</span> : null}
    </div>
  );
}

const KIND = { differs: 'differs', pdf_only: 'pdfOnly', taxpresso_only: 'taxpressoOnly' } as const;

function Difference({
  line,
  page,
  state,
  lang,
}: {
  line: CheckLine;
  page: string;
  state: State;
  lang: Language;
}) {
  const kind = line.outcome === 'match' ? undefined : KIND[line.outcome];
  return (
    <li class="rc-line rc-line-fix" data-ref={line.ref}>
      <span class="rc-ref tnum">{line.ref}</span>
      <Label line={line} page={page} state={state} lang={lang} />
      <div class="rc-status">
        <span class="chip chip-fix">{tr(lang, 'fix')}</span>
        {kind ? <span class="small-text">{tr(lang, kind)}</span> : null}
        {line.final === false ? (
          <span class={`chip ${line.status === 'estimate' ? 'chip-estimate' : 'chip-needs-ok'}`}>
            {tr(lang, line.status === 'estimate' ? 'statusEstimate' : 'statusNeedsOk')}
          </span>
        ) : null}
      </div>
      <dl class="rc-values">
        <div>
          <dt class="small-text muted">{tr(lang, 'inPdf')}</dt>
          <dd>
            <Amounts cells={line.cells} side="pdf" lang={lang} />
          </dd>
        </div>
        <div>
          <dt class="small-text muted">{tr(lang, 'toType')}</dt>
          <dd>
            <Amounts cells={line.cells} side="taxpresso" lang={lang} />
          </dd>
        </div>
      </dl>
    </li>
  );
}

function Match({
  line,
  page,
  state,
  lang,
}: {
  line: CheckLine;
  page: string;
  state: State;
  lang: Language;
}) {
  return (
    <li class="rc-line" data-ref={line.ref}>
      <span class="rc-ref tnum">{line.ref}</span>
      <Label line={line} page={page} state={state} lang={lang} />
      <div class="rc-status">
        <Amounts cells={line.cells} side="taxpresso" lang={lang} />
        <span class="chip chip-verified">{tr(lang, 'matches')}</span>
        {line.final === false ? (
          <span class={`chip ${line.status === 'estimate' ? 'chip-estimate' : 'chip-needs-ok'}`}>
            {tr(lang, line.status === 'estimate' ? 'statusEstimate' : 'statusNeedsOk')}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function Computed({
  line,
  page,
  state,
  lang,
}: {
  line: ComputedLine;
  page: string;
  state: State;
  lang: Language;
}) {
  const expected = line.cells
    .filter((c) => c.expected !== undefined && c.expected !== c.pdf)
    .map((c) => `${COLUMN[c.column] ? `${COLUMN[c.column]} ` : ''}${francs(c.expected!, lang)}`)
    .join(', ');
  const what =
    line.check === 'adds_up'
      ? line.from
        ? tr(lang, 'sameAs', { page: line.from })
        : tr(lang, 'addsUp')
      : line.check === 'off'
        ? tr(lang, line.from ? 'offFrom' : 'off', { page: line.from ?? '', amount: expected })
        : tr(lang, 'shown');
  return (
    <li class="rc-line" data-ref={line.ref}>
      <span class="rc-ref tnum">{line.ref}</span>
      <Label line={line} page={page} state={state} lang={lang} />
      <div class="rc-status">
        <Amounts cells={line.cells} side="pdf" lang={lang} />
        <span class="chip chip-computed">{tr(lang, 'computed')}</span>
        <span class={`small-text${line.check === 'off' ? ' rc-off' : ' muted'}`}>{what}</span>
      </div>
    </li>
  );
}

function ByEye({ line, page, lang }: { line: ByEyeLine; page: string; lang: Language }) {
  const why =
    line.reason === 'tick'
      ? tr(lang, 'byEyeTick')
      : line.reason === 'columns'
        ? tr(lang, 'byEyeColumns')
        : line.value
          ? tr(lang, 'byEyeText', { value: line.value })
          : tr(lang, 'byEyeTextNoValue');
  return (
    <li>
      <span class="tnum rc-ref-inline">
        {page}
        {/^\d{2}\.\d{2}/.test(line.ref) ? ` ${line.ref}` : ''}
      </span>{' '}
      <span lang="fr">{line.label}</span>
      <span class="muted">
        {' '}
        ({line.gloss}){line.part ? ` · ${line.part.label}` : ''}
      </span>
      {tr(lang, 'colon')}
      {why}
    </li>
  );
}

export function Reconcile({
  state,
  lang,
  act,
}: {
  state: State & { declarationCheck?: DeclarationCheckState };
  lang: Language;
  act: Act;
}): JSX.Element | null {
  const view = state.declarationCheck;
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  if (!view) return null;
  if (view.status === 'none' && state.copyPanel.sections.length === 0) return null;
  if (view.status === 'not_available') {
    return (
      <section class="card rc-card" aria-labelledby="rc-title">
        <div class="section-head">
          <h2 id="rc-title">{tr(lang, 'title')}</h2>
        </div>
        <p class="muted rc-lead">{tr(lang, 'notAvailable')}</p>
      </section>
    );
  }

  const add = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    await act(
      () => api.upload(file, lang, { kind: 'official_declaration' }),
      tr(lang, 'reading', { name: file.name }),
    );
  };
  const check = view.check;
  const doc = view.document;
  const sections = check?.sections ?? [];
  const differences = sections.flatMap((s) =>
    s.lines.filter((l) => l.outcome !== 'match').map((l) => ({ s, l })),
  );
  const matches = sections.flatMap((s) =>
    s.lines.filter((l) => l.outcome === 'match').map((l) => ({ s, l })),
  );
  const computed = sections.flatMap((s) => s.computed.map((l) => ({ s, l })));
  const byEye = sections.flatMap((s) => s.byEye.map((l) => ({ s, l })));
  const c = check?.counts;

  return (
    <section
      class={`card rc-card${over ? ' rc-over' : ''}`}
      aria-labelledby="rc-title"
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void add(e.dataTransfer?.files ?? null);
      }}
    >
      <div class="section-head">
        <h2 id="rc-title">{tr(lang, 'title')}</h2>
        {c ? (
          <span class="muted small-text tnum">
            {tr(lang, 'summary', {
              n: c.match + c.differs + c.pdfOnly + c.taxpressoOnly,
              match: c.match,
              fix: c.toFix,
            })}
          </span>
        ) : null}
      </div>
      <p class="muted rc-lead">{tr(lang, 'lead')}</p>

      {doc ? (
        <p class="small-text rc-doc">
          {tr(lang, 'checkedAgainst', { file: doc.filename })}
          {doc.software ? `, ${tr(lang, 'printedBy', { software: doc.software })}` : ''}
          {view.older
            ? ` · ${tr(lang, view.older === 1 ? 'olderOne' : 'older', { n: view.older })}`
            : ''}
        </p>
      ) : null}

      {view.status === 'pending' ? (
        <p class="banner" role="status">
          {tr(lang, 'pending')}
        </p>
      ) : null}
      {view.status === 'unreadable' && doc ? (
        <p class="banner banner-fix">{tr(lang, 'unreadable', { file: doc.filename })}</p>
      ) : null}
      {view.status === 'other_year' && doc ? (
        <p class="banner banner-fix">
          {tr(lang, 'otherYear', {
            file: doc.filename,
            printed: view.printedYear ?? '',
            year: view.taxYear,
          })}
        </p>
      ) : null}
      {view.warnings.length ? (
        <p class="small-text muted">{tr(lang, 'warnings', { list: view.warnings.join(' ') })}</p>
      ) : null}

      {check ? (
        <>
          {view.provisional ? <p class="banner banner-estimate">{view.provisional}</p> : null}
          {check.clear ? (
            <p class="rc-clear">
              <span class="chip chip-verified">{tr(lang, 'matches')}</span>
              <span>{tr(lang, 'clear')}</span>
            </p>
          ) : null}
          {c && c.notFinal ? (
            <p class="banner banner-estimate">
              {tr(lang, c.notFinal === 1 ? 'notFinalOne' : 'notFinal', { n: c.notFinal })}
            </p>
          ) : null}
          {differences.length ? (
            <>
              <p class="rc-todo">{tr(lang, 'toFixLead')}</p>
              <ul class="rc-lines">
                {differences.map(({ s, l }) => (
                  <Difference key={l.id} line={l} page={s.page} state={state} lang={lang} />
                ))}
              </ul>
            </>
          ) : null}
          {matches.length ? (
            <details class="rc-more">
              <summary>{tr(lang, 'showMatches', { n: matches.length })}</summary>
              <ul class="rc-lines">
                {matches.map(({ s, l }) => (
                  <Match key={l.id} line={l} page={s.page} state={state} lang={lang} />
                ))}
              </ul>
            </details>
          ) : null}
          {computed.length ? (
            <details class="rc-more" open={c ? c.computedOff > 0 : false}>
              <summary>{tr(lang, 'computedTitle', { n: computed.length })}</summary>
              <p class="muted small-text rc-more-lead">{tr(lang, 'computedLead')}</p>
              <ul class="rc-lines">
                {computed.map(({ s, l }) => (
                  <Computed key={l.id} line={l} page={s.page} state={state} lang={lang} />
                ))}
              </ul>
            </details>
          ) : null}
          <div class="rc-eye">
            {byEye.length ? (
              <>
                <strong class="small-text">{tr(lang, 'byEyeTitle')}</strong>
                <ul class="plain-list small-text">
                  {byEye.map(({ s, l }) => (
                    <ByEye key={l.id} line={l} page={s.page} lang={lang} />
                  ))}
                </ul>
              </>
            ) : null}
            <p class="muted small-text">{tr(lang, 'notCompared')}</p>
          </div>
        </>
      ) : null}

      <div class="rc-transmit">
        <strong>{tr(lang, 'transmitTitle')}</strong>
        <ol>
          <li>{tr(lang, 'transmit1')}</li>
          <li>{tr(lang, 'transmit2')}</li>
          <li>{tr(lang, 'transmit3')}</li>
        </ol>
      </div>

      <div class="rc-actions">
        <button
          type="button"
          class={doc ? 'ghost' : 'primary'}
          onClick={() => input.current?.click()}
        >
          {tr(lang, doc ? 'addAgain' : 'add')}
        </button>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            const el = e.target as HTMLInputElement;
            void add(el.files).then(() => (el.value = ''));
          }}
        />
      </div>
    </section>
  );
}
