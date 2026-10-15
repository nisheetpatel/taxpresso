// Start (three-pages.md, A1), only while nothing is known: two doors. I have documents (inside
// Claude Desktop, the Taxpresso folder opens in Finder or Explorer; in the browser, a drop zone),
// or no documents yet (the basics card). The panel never needs the chat; the chat can do it all.
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { t, type Language } from './i18n';
import { pg } from './i18n-pages';
import type { PageProps } from './page-props';
import { Icon } from './ui';

/** The kinds that help most, those the canton has. */
const HELPS = [
  'salary_certificate',
  'health_premiums',
  'pillar3a_attestation',
  'bank_attestation',
  'prior_declaration',
];

/** A real drop zone and "Choose files" (the browser page only). */
export function DropZone({
  lang,
  onFiles,
  onChoose,
}: {
  lang: Language;
  onFiles: (files: File[]) => void;
  onChoose: () => void;
}): JSX.Element {
  const [over, setOver] = useState(false);
  return (
    <div
      class={`drop${over ? ' drop-over' : ''}`}
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        onFiles(Array.from(e.dataTransfer?.files ?? []));
      }}
    >
      <span class="drop-icon">
        <Icon.upload />
      </span>
      <span class="drop-text">{pg(lang, 'start.drop')}</span>
      <button type="button" class="ghost" onClick={onChoose}>
        {t(lang, 'chooseFiles')}
      </button>
    </div>
  );
}

/** "Open my Taxpresso folder", and where it is. */
export function FolderDoor({ p }: { p: PageProps }): JSX.Element {
  const { lang } = p;
  // The folder's path is in the menu; here the button opens it, and what lands there is sorted
  // within a second (extension/src/folder-watch.ts).
  return (
    <div class="folder-door">
      <button type="button" class="ghost wide" onClick={() => p.add()}>
        <Icon.folder />
        <span>{pg(lang, 'openFolder')}</span>
      </button>
    </div>
  );
}

export function Start(
  p: PageProps & { onFiles: (files: File[]) => void; onChoose: () => void },
): JSX.Element {
  const { state, lang, embedded } = p;
  const helps = HELPS.flatMap((k) => state.kinds.filter((x) => x.value === k));
  return (
    <div class="start">
      <div class="page-head">
        <h1>{pg(lang, 'start.title', { year: state.taxYear })}</h1>
        <p class="lead">{pg(lang, 'start.lead')}</p>
      </div>

      <div class="doors">
        <section class="card door" aria-labelledby="door-docs">
          <div class="door-head">
            <span class="door-icon">
              <Icon.doc />
            </span>
            <div>
              <h2 id="door-docs">{pg(lang, 'start.docs')}</h2>
              <p class="muted">{pg(lang, embedded ? 'start.docsLeadFolder' : 'start.docsLead')}</p>
            </div>
          </div>
          {embedded ? (
            <FolderDoor p={p} />
          ) : (
            <DropZone lang={lang} onFiles={p.onFiles} onChoose={p.onChoose} />
          )}
        </section>

        <section class="card door" aria-labelledby="door-rough">
          <div class="door-head">
            <span class="door-icon">
              <Icon.pen />
            </span>
            <div>
              <h2 id="door-rough">{pg(lang, 'start.rough')}</h2>
              <p class="muted">{pg(lang, 'start.roughLead')}</p>
            </div>
          </div>
          <button type="button" class="primary wide" onClick={p.openBasics}>
            <span>{pg(lang, 'start.roughButton')}</span>
            <Icon.arrow />
          </button>
        </section>
      </div>

      {helps.length ? (
        <section class="helps" aria-labelledby="helps-title">
          <h2 id="helps-title" class="sub-head">
            {pg(lang, 'start.helps')}
          </h2>
          <ul class="tags">
            {helps.map((k) => (
              <li key={k.value} class="tag">
                {k.value === 'prior_declaration' ? pg(lang, 'start.prior') : k.label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer class="start-foot">
        <span>{pg(lang, 'start.chat')}</span>
        <span class="local">
          <Icon.lock />
          {pg(lang, 'local')}
        </span>
      </footer>
    </div>
  );
}
