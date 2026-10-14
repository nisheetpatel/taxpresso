// The official documents a statement rests on (SPEC.md 7b): each by its title as published (from
// docs/sources/manifest.json) and where in it, linked to the official page. The user's browser
// opens it; Taxpresso never does. Shared by the final check and the facts of "About you".
import type { JSX } from 'preact';
import type { Language } from './i18n';
import { tf } from './i18n-final-check';
import type { FinalCheckSource } from './types-final-check';

/** "Directives concernant l'impôt à la source 2026, p. 25": the id where there is no title. */
const label = (s: FinalCheckSource) =>
  s.where ? `${s.title ?? s.id}, ${s.where}` : (s.title ?? s.id);

function Source({ source }: { source: FinalCheckSource }): JSX.Element {
  return source.url ? (
    <a href={source.url} target="_blank" rel="noopener noreferrer" lang="fr">
      {label(source)}
    </a>
  ) : (
    <span lang="fr">{label(source)}</span>
  );
}

/** "Sources: …" in one line, after a statement (the final check). */
export function SourcesLine({
  sources,
  lang,
}: {
  sources: FinalCheckSource[];
  lang: Language;
}): JSX.Element | null {
  if (!sources.length) return null;
  return (
    <p class="fc-sources small-text">
      <span class="muted">
        {tf(lang, sources.length > 1 ? 'sources' : 'source')}
        {tf(lang, 'colon')}
      </span>
      {sources.map((s, i) => (
        <span key={`${s.id}:${s.where}`}>
          {i ? '; ' : ''}
          <Source source={s} />
        </span>
      ))}
    </p>
  );
}

/**
 * One document a line, inside a "Sources" disclosure (the facts of "About you"): its title once,
 * then each place cited in it, each linked to its page.
 */
export function SourceList({ sources }: { sources: FinalCheckSource[] }): JSX.Element | null {
  if (!sources.length) return null;
  const documents = new Map<string, FinalCheckSource[]>();
  for (const s of sources) documents.set(s.id, [...(documents.get(s.id) ?? []), s]);
  return (
    <ul class="source-list small-text">
      {[...documents.values()].map((cited) => {
        const first = cited[0]!;
        const places = cited.filter((s) => s.where);
        return (
          <li key={first.id}>
            {places.length ? (
              <>
                <span lang="fr">{first.title ?? first.id}</span>
                {places.map((s, i) => (
                  <span key={s.where}>
                    {i ? '; ' : ', '}
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.where}
                      </a>
                    ) : (
                      s.where
                    )}
                  </span>
                ))}
              </>
            ) : (
              <Source source={first} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
