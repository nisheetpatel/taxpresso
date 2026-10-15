// "File" (three-pages.md, A6). Before the documents are in: one line, and what is still to do.
// Once in, three steps: 1. Check (the final check, one item at a time), 2. Fill in your
// declaration (with Claude, or the copy panel), 3. Send it yourself, with the check of the
// official PDF. The assessment check shows here once an assessment is in. Taxpresso never sends.
import type { JSX } from 'preact';
import { Assessment } from './Assessment';
import { CopyPanel } from './CopyPanel';
import { FinalCheckStep } from './FinalCheck';
import { pg, type PagesMessageKey } from './i18n-pages';
import type { PageProps } from './page-props';
import type { GroupId, PagesFields } from './state-adapter';
import { Reconcile } from './Reconcile';
import { TaxStrip } from './TaxCard';
import type { State } from './types';
import { AskClaude, Icon } from './ui';
import { docStatus } from './YourTax';

/** What still stands between the household and filing, in words, each where it is done. */
export function stillToDo(state: State, pages: PagesFields, lang: PageProps['lang']): string[] {
  const count = (n: number, many: PagesMessageKey, one: PagesMessageKey) =>
    n ? [n === 1 ? pg(lang, one) : pg(lang, many, { n })] : [];
  const open = (g: GroupId) => pages.groups[g].filter((q) => !q.answered).length;
  const once = (g: GroupId, key: PagesMessageKey) => (open(g) ? [pg(lang, key)] : []);
  const statuses = state.documents.map((d) => docStatus(state, d).status);
  const missing = [
    ...new Set(
      state.requirements.filter((r) => r.status === 'missing' && !r.optional).map((r) => r.label),
    ),
  ];
  return [
    ...once('basics', 'file.todoBasics'),
    ...count(open('detail'), 'file.todoQuestions', 'file.todoQuestionsOne'),
    ...once('special', 'file.todoSpecial'),
    ...once('deduction', 'file.todoCosts'),
    ...once('plan', 'file.todoPlan'),
    ...count(state.toConfirm, 'file.todoConfirm', 'file.todoConfirmOne'),
    ...count(
      state.checks.filter((c) => !c.resolved).length,
      'file.todoChecks',
      'file.todoChecksOne',
    ),
    ...count(statuses.filter((s) => s === 'read').length, 'file.todoRead', 'file.todoReadOne'),
    ...count(
      statuses.filter((s) => s === 'unknown' || s === 'whose').length,
      'file.todoIdentify',
      'file.todoIdentifyOne',
    ),
    ...(missing.length ? [pg(lang, 'file.todoAdd', { list: missing.join(', ') })] : []),
  ];
}

function Step({
  n,
  title,
  done = false,
  active = false,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  active?: boolean;
  children: JSX.Element | (JSX.Element | null)[];
}) {
  return (
    <li class={`card step${active ? ' step-active' : ''}`}>
      <h2 class="step-head">
        <span class={`step-num${done ? ' step-done' : ''}`} aria-hidden="true">
          {done ? <Icon.check /> : n}
        </span>
        {title}
      </h2>
      {children}
    </li>
  );
}

export function FilePage(p: PageProps): JSX.Element {
  const { state, pages, lang, act } = p;
  const strip = <TaxStrip state={state} pages={pages} lang={lang} />;
  if (!state.journey.documentsIn) {
    const todo = stillToDo(state, pages, lang);
    return (
      <>
        {strip}
        <section class="card plain-card" aria-labelledby="file-wait">
          <p id="file-wait" class="plain-lead">
            {pg(lang, 'file.wait')}
          </p>
          {todo.length ? (
            <>
              <h2 class="sub-head">{pg(lang, 'file.todo')}</h2>
              <ul class="todo">
                {todo.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <button type="button" class="ghost" onClick={() => p.go('tax')}>
                {pg(lang, 'step.go')}
              </button>
            </>
          ) : null}
        </section>
        <Assessment state={state} lang={lang} />
      </>
    );
  }
  const check = state.finalCheck;
  const ready = !check || check.verdict === 'ready';
  return (
    <>
      {strip}
      <div class="page-head">
        <h1>{pg(lang, 'file.title')}</h1>
        <p class="lead">{pg(lang, 'file.lead')}</p>
      </div>
      <ol class="steps">
        <Step
          n={1}
          title={
            ready
              ? pg(lang, 'step.check')
              : check.fix.length === 1
                ? pg(lang, 'step.checkOne')
                : pg(lang, 'step.checkN', { n: check.fix.length })
          }
          done={ready}
          active={!ready}
        >
          {check ? (
            <FinalCheckStep
              view={check}
              lang={lang}
              canton={state.canton?.code}
              onGo={() => p.go('tax')}
            />
          ) : (
            <p class="done-line">{pg(lang, 'step.ready')}</p>
          )}
        </Step>
        <Step n={2} title={pg(lang, 'step.fill')} active={ready}>
          <p class="muted">{pg(lang, 'step.fillLead')}</p>
          <div class="row-actions">
            <AskClaude
              text={pg(lang, 'step.fillPrompt', { year: state.taxYear })}
              label={pg(lang, 'step.fillClaude')}
              primary={ready}
              lang={lang}
            />
          </div>
          <details class="more copy-values">
            <summary>{pg(lang, 'step.copy')}</summary>
            <CopyPanel state={state} lang={lang} act={act} />
          </details>
        </Step>
        <Step n={3} title={pg(lang, 'step.send')}>
          <p class="muted">
            {pg(lang, state.canton?.code === 'GE' ? 'step.sendGe' : 'step.sendOther')}
          </p>
          <Reconcile state={state} lang={lang} act={act} />
        </Step>
      </ol>
      <Assessment state={state} lang={lang} />
    </>
  );
}
