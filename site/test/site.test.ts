import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BASE_URL, copy, LANGS, SOURCE_URL } from '../src/content.ts';
import { GUIDE_IDS, GUIDE_SOURCES, guidePath, guides, guidesPath } from '../src/guides.ts';
import { builtPages, PAGES, robots, sitemap } from '../src/pages.ts';
import { render, renderGuide, renderGuides, renderStart } from '../src/render.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const DASHES = new RegExp('[\\u2013\\u2014]');

/** The copy with every string replaced by its type, so languages can be compared by structure. */
const shape = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(shape)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)]))
      : typeof v;

const strings = (v: unknown): string[] =>
  typeof v === 'string'
    ? [v]
    : Array.isArray(v)
      ? v.flatMap(strings)
      : v && typeof v === 'object'
        ? Object.values(v).flatMap(strings)
        : [];

/** The only scripts allowed are JSON-LD data blocks, which browsers never run. */
const RUNNABLE_SCRIPT = /<script(?![^>]*\btype="application\/ld\+json")/i;

/** The JSON-LD blocks of a page, parsed. */
const structured = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(
    (m) => JSON.parse(m[1]!) as Record<string, unknown>,
  );

// Anything the browser would fetch from another server: scripts, styles, fonts, images, frames.
// Canonical and hreflang links name the site's own pages by their full address; nothing loads them.
const REMOTE_LOAD = [
  /<(?:script|img|iframe|source|video|audio)\b[^>]*\bsrc\s*=\s*["']?(?:https?:)?\/\//i,
  /<link\b(?![^>]*\brel="(?:canonical|alternate)")[^>]*\bhref\s*=\s*["']?(?:https?:)?\/\//i,
  /url\(\s*["']?(?:https?:)?\/\//i,
  /@import/i,
];

describe('landing page', () => {
  it('has the same structure in every language as in French', () => {
    for (const { lang } of LANGS) expect(shape(copy[lang]), lang).toEqual(shape(copy.fr));
  });

  it('copy has no en or em dashes (CLAUDE.md copy rule)', () => {
    for (const { lang } of LANGS) {
      for (const s of strings(copy[lang])) expect(s, `${lang}: ${s}`).not.toMatch(DASHES);
    }
  });

  it('renders each language with links to the others, and loads nothing from elsewhere', () => {
    for (const { lang } of LANGS) {
      const html = render(lang);
      expect(html).toContain(`<html lang="${lang}">`);
      for (const other of LANGS)
        expect(html).toContain(`hreflang="${other.lang}" href="${BASE_URL}${other.path}"`);
      expect(html).not.toMatch(RUNNABLE_SCRIPT);
      for (const re of REMOTE_LOAD) expect(html, `${lang} ${String(re)}`).not.toMatch(re);
    }
  });

  it('renders each Get started page with its download link and no script', () => {
    for (const { lang } of LANGS) {
      const html = renderStart(lang);
      expect(html).toContain(`<html lang="${lang}">`);
      expect(html).toContain('/releases/latest');
      expect(html).not.toMatch(RUNNABLE_SCRIPT);
      for (const re of REMOTE_LOAD) expect(html, `${lang} ${String(re)}`).not.toMatch(re);
    }
  });

  it('keeps the tagline as plain text in the heading, with the cup drawn over its last o', () => {
    for (const { lang } of LANGS) {
      const h1 = /<h1>(.*?)<\/h1>/s.exec(render(lang))?.[1] ?? '';
      const text = h1
        .replace(/<svg[\s\S]*?<\/svg>/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&');
      expect(text, lang).toBe(copy[lang].tagline);
      expect(h1, lang).toContain('class="cupo tp-play"');
    }
  });

  it('styles load nothing from elsewhere', async () => {
    for (const file of ['styles.css', 'hero.css']) {
      const css = await readFile(path.join(here, '..', 'src', file), 'utf8');
      for (const re of REMOTE_LOAD) expect(css, file).not.toMatch(re);
    }
  });
});

describe('guides', () => {
  /** Every page the build writes, with its path, so links between pages can be checked. */
  const pages = builtPages().map((page) => ({ path: page.path, html: page.html() }));

  it('have the same structure in every language as in French', () => {
    for (const { lang } of LANGS) expect(shape(guides[lang]), lang).toEqual(shape(guides.fr));
  });

  it('copy has no en or em dashes (CLAUDE.md copy rule)', () => {
    for (const { lang } of LANGS) {
      for (const s of strings(guides[lang])) expect(s, `${lang}: ${s}`).not.toMatch(DASHES);
    }
  });

  it('label every official source in every language', () => {
    for (const { lang } of LANGS) {
      for (const id of GUIDE_IDS) {
        expect(guides[lang].guides[id].sources, `${lang} ${id}`).toHaveLength(
          GUIDE_SOURCES[id].length,
        );
      }
    }
  });

  it('link only to official pages from the sources library, with no parameters', async () => {
    // Each URL was opened and checked when it went into docs/sources/<canton>/manifest.json.
    const manifest = JSON.parse(
      await readFile(path.join(here, '..', '..', 'docs', 'sources', 'manifest.json'), 'utf8'),
    ) as { entries: { url: string }[] };
    const official = new Set(manifest.entries.map((e) => e.url));
    const outbound = [
      ...Object.values(GUIDE_SOURCES).flat(),
      ...strings(guides).flatMap((s) =>
        [...s.matchAll(/\]\((https:[^)\s]+)\)/g)].map((m) => m[1]!),
      ),
    ];
    expect(outbound.length).toBeGreaterThan(GUIDE_IDS.length);
    for (const url of outbound) {
      if (url === SOURCE_URL) continue; // the project's own code, in the privacy guide
      expect(url, url).not.toMatch(/[?]/);
      expect(official, url).toContain(url.replace(/#page=\d+$/, ''));
    }
  });

  it('render every guide in every language, with links to the others, and load nothing from elsewhere', () => {
    for (const { lang, path: p } of LANGS) {
      for (const html of [renderGuides(lang), ...GUIDE_IDS.map((id) => renderGuide(lang, id))]) {
        expect(html).toContain(`<html lang="${lang}">`);
        expect(html).not.toMatch(RUNNABLE_SCRIPT);
        for (const re of REMOTE_LOAD) expect(html, `${lang} ${String(re)}`).not.toMatch(re);
      }
      for (const id of GUIDE_IDS) {
        const html = renderGuide(lang, id);
        for (const other of LANGS)
          expect(html).toContain(
            `hreflang="${other.lang}" href="${BASE_URL}${guidePath(other.path, id)}"`,
          );
        // Official pages open in a new tab, so the guide stays open.
        for (const url of GUIDE_SOURCES[id])
          expect(html).toContain(`href="${url}" target="_blank" rel="noopener"`);
        expect(html).toContain(`href="${guidesPath(p)}"`);
      }
    }
  });

  it('every link on the site leads to a page the build writes', () => {
    const built = new Set(pages.map((page) => page.path));
    const assets = /^\/(styles\.css|favicon\.svg|fonts\/)/;
    for (const page of pages) {
      for (const [, href] of page.html.matchAll(/href="(\/[^"]*)"/g)) {
        if (assets.test(href!)) continue;
        expect(built, `${page.path} links to ${href}`).toContain(href!.replace(/#.*$/, ''));
      }
    }
  });

  it('are linked sparingly: the footer and one line under the questions, and the Get started page', () => {
    for (const { lang, path: p } of LANGS) {
      const link = `href="${guidesPath(p)}"`;
      expect(render(lang).split(link).length - 1, lang).toBe(2);
      expect(renderStart(lang).split(link).length - 1, lang).toBe(2);
    }
  });
});

describe('search', () => {
  const pages = builtPages().map((page) => ({ ...page, html: page.html() }));
  const linkHref = (html: string, attrs: string) =>
    new RegExp(`<link ${attrs} href="([^"]+)">`).exec(html)?.[1];
  const meta = (html: string, attr: string) =>
    new RegExp(`<meta ${attr} content="([^"]*)">`).exec(html)?.[1];

  it('gives every page a canonical link to itself, a description and Open Graph tags', () => {
    for (const { path: p, html } of pages) {
      const url = `${BASE_URL}${p}`;
      expect(linkHref(html, 'rel="canonical"'), p).toBe(url);
      expect(meta(html, 'property="og:url"'), p).toBe(url);
      expect(meta(html, 'name="description"')?.length ?? 0, p).toBeGreaterThan(40);
      expect(meta(html, 'property="og:title"'), p).toBe(/<title>(.*?)<\/title>/.exec(html)?.[1]);
      expect(meta(html, 'property="og:description"'), p).toBe(meta(html, 'name="description"'));
    }
  });

  it('links every page to itself in all six languages plus x-default, and back', () => {
    const byUrl = new Map(pages.map((page) => [`${BASE_URL}${page.path}`, page.html]));
    for (const { path: p, html } of pages) {
      const alts = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)];
      expect(
        alts.map((m) => m[1]),
        p,
      ).toEqual([...LANGS.map((l) => l.lang), 'x-default']);
      expect(alts.find((m) => m[1] === 'x-default')?.[2], p).toBe(
        alts.find((m) => m[1] === 'en')?.[2],
      );
      for (const [, , href] of alts) {
        const other = byUrl.get(href!);
        expect(other, `${p} -> ${href}`).toBeDefined();
        // Reciprocal: the other page lists this one too.
        expect(other, `${href} -> ${p}`).toContain(`href="${BASE_URL}${p}"`);
      }
    }
  });

  it('lists every page in the sitemap, with the same alternates as the page', () => {
    const map = sitemap();
    const locs = [...map.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toHaveLength(PAGES.length * LANGS.length);
    expect(new Set(locs)).toEqual(new Set(pages.map((page) => `${BASE_URL}${page.path}`)));
    for (const block of map.split('<url>').slice(1)) {
      const loc = /<loc>([^<]+)<\/loc>/.exec(block)![1]!;
      const html = pages.find((page) => `${BASE_URL}${page.path}` === loc)!.html;
      for (const [, hreflang, href] of block.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g))
        expect(html, `${loc} ${hreflang}`).toContain(
          `<link rel="alternate" hreflang="${hreflang}" href="${href}">`,
        );
    }
    expect(robots()).toContain(`Sitemap: ${BASE_URL}/sitemap.xml`);
  });

  it('describes the app, the questions, the steps and each guide as structured data', () => {
    for (const { lang, path: p } of LANGS) {
      const home = structured(render(lang)).map((d) => d['@type']);
      expect(home, lang).toEqual(['SoftwareApplication', 'FAQPage']);
      const faq = structured(render(lang))[1] as { mainEntity: unknown[] };
      expect(faq.mainEntity).toHaveLength(copy[lang].faq.items.length);
      expect(structured(renderStart(lang)).map((d) => d['@type'])).toEqual(['HowTo']);
      for (const id of GUIDE_IDS) {
        const [article] = structured(renderGuide(lang, id));
        expect(article, `${lang} ${id}`).toMatchObject({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: guides[lang].guides[id].title,
          url: `${BASE_URL}${guidePath(p, id)}`,
        });
      }
    }
    // Data blocks never contain a raw "<", so nothing in them can close the element.
    for (const { html } of pages)
      for (const [, body] of html.matchAll(
        /<script type="application\/ld\+json">(.*?)<\/script>/gs,
      ))
        expect(body).not.toContain('<');
  });

  it('keeps the JSON-LD blocks allowed by the CSP: data, never run, script-src stays none', async () => {
    const vercel = JSON.parse(
      await readFile(path.join(here, '..', '..', 'vercel.json'), 'utf8'),
    ) as { headers: { headers: { key: string; value: string }[] }[] };
    const csp = vercel.headers
      .flatMap((h) => h.headers)
      .find((h) => h.key === 'Content-Security-Policy')!.value;
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toMatch(/script-src/);
    for (const { html } of pages) expect(html).not.toMatch(RUNNABLE_SCRIPT);
  });
});
