// Every page of the site, in every language, in one list: the build writes them, the sitemap lists
// them, and the tests check the links between them.
import { downloadPath, LANGS, type Lang, startPath } from './content.ts';
import { GUIDE_IDS, guidePath, guidesPath } from './guides.ts';
import { GENEVA_IDS, genevaPagePath, genevaPath } from './geneva.ts';
import { privacyPath } from './privacy.ts';
import { CANTON_PAGES, cantonPath, cantonsPath } from './canton-data.ts';
import {
  render,
  renderCanton,
  renderCantons,
  renderDownload,
  renderGeneva,
  renderGenevaPage,
  renderGuide,
  renderGuides,
  renderPrivacy,
  renderStart,
} from './render.ts';
import { absoluteUrl, alternates } from './seo.ts';

export interface Page {
  /** The page's path from a language's prefix ('/en/' -> '/en/start/'). */
  at: (prefix: string) => string;
  render: (lang: Lang, cssVersion?: string) => string;
  /** Built, but in no sitemap: a page that does something when opened (the download page). */
  unlisted?: boolean;
}

export const PAGES: readonly Page[] = [
  { at: (p) => p, render },
  { at: startPath, render: renderStart },
  { at: downloadPath, render: renderDownload, unlisted: true },
  { at: guidesPath, render: renderGuides },
  ...GUIDE_IDS.map((id): Page => ({
    at: (p) => guidePath(p, id),
    render: (lang, css) => renderGuide(lang, id, css),
  })),
  { at: privacyPath, render: renderPrivacy },
  { at: genevaPath, render: renderGeneva },
  ...GENEVA_IDS.map((id): Page => ({
    at: (p) => genevaPagePath(p, id),
    render: (lang, css) => renderGenevaPage(lang, id, css),
  })),
  { at: cantonsPath, render: renderCantons },
  ...CANTON_PAGES.map((page): Page => ({
    at: (p) => cantonPath(p, page.slug),
    render: (lang, css) => renderCanton(lang, page, css),
  })),
];

/** Every page in every language, with its path. */
export const builtPages = (cssVersion = '') =>
  PAGES.flatMap((page) =>
    LANGS.map(({ lang, path }) => ({
      lang,
      path: page.at(path),
      unlisted: page.unlisted === true,
      html: () => page.render(lang, cssVersion),
    })),
  );

/**
 * sitemap.xml: one <url> per listed page and language, each listing the page in every language
 * (the same alternates as the page's own hreflang links).
 */
export function sitemap(): string {
  const urls = PAGES.filter((page) => !page.unlisted).flatMap((page) =>
    LANGS.map(({ path }) => {
      const links = alternates(page.at)
        .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"/>`)
        .join('\n');
      return `  <url>\n    <loc>${absoluteUrl(page.at(path))}</loc>\n${links}\n  </url>`;
    }),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

export const robots = () => `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`;
