import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMMUNE_CENTIMES_2026, COMMUNES_2026 } from '../../packages/rules-ge/src/2026/communes.ts';
import { BASE_URL, copy, type Lang, LANGS, SOURCE_URL, startPath } from '../src/content.ts';
import { GENEVA_IDS, geneva, genevaPath } from '../src/geneva.ts';
import {
  type Citation,
  cite,
  COMMUNES,
  DEADLINE_IDS,
  DEADLINES,
  DEDUCTION_IDS,
  DEDUCTIONS,
  type Line,
  PILLAR3A,
  TAX_YEAR,
} from '../src/geneva-data.ts';
import { GUIDE_IDS, GUIDE_SOURCES, guidePath, guides, guidesPath } from '../src/guides.ts';
import { builtPages, PAGES, robots, sitemap } from '../src/pages.ts';
import { privacy, privacyPath } from '../src/privacy.ts';
import {
  render,
  renderGeneva,
  renderGenevaPage,
  renderGuide,
  renderGuides,
  renderPrivacy,
  renderStart,
} from '../src/render.ts';

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

describe('privacy policy', () => {
  it('has the same structure in every language as in French, with no en or em dashes', () => {
    for (const { lang } of LANGS) {
      expect(shape(privacy[lang]), lang).toEqual(shape(privacy.fr));
      for (const s of strings(privacy[lang])) expect(s, `${lang}: ${s}`).not.toMatch(DASHES);
    }
  });

  it('renders in every language with its date and the contact address, and is in every footer', () => {
    for (const { lang, path: p } of LANGS) {
      const html = renderPrivacy(lang);
      expect(html).toContain(`<html lang="${lang}">`);
      expect(html).toContain(`<link rel="canonical" href="${BASE_URL}${privacyPath(p)}">`);
      expect(html).toContain('href="mailto:hello@taxpresso.ch"');
      expect(html).toMatch(/<p class="updated">[^<{]*2026<\/p>/);
      expect(html).not.toMatch(RUNNABLE_SCRIPT);
      for (const re of REMOTE_LOAD) expect(html, `${lang} ${String(re)}`).not.toMatch(re);
      for (const page of [render(lang), renderStart(lang), renderGuides(lang), html])
        expect(page).toContain(`<a href="${privacyPath(p)}">${privacy[lang].link}</a>`);
    }
  });
});

describe('Geneva reference pages', () => {
  const lines: { what: string; line: Line }[] = [
    ...DEDUCTION_IDS.flatMap((id) => DEDUCTIONS[id].map((line) => ({ what: id, line }))),
    ...DEADLINE_IDS.map((id) => ({ what: id, line: DEADLINES[id] })),
    { what: 'catch-up', line: PILLAR3A.catchUp },
  ];
  const pagesOf = (lang: Lang) => [
    renderGeneva(lang),
    ...GENEVA_IDS.map((id) => renderGenevaPage(lang, id)),
  ];
  const main = (html: string) => /<main[\s\S]*<\/main>/.exec(html)![0];

  it('have the same structure in every language as in French, with no en or em dashes', () => {
    for (const { lang } of LANGS) {
      expect(shape(geneva[lang]), lang).toEqual(shape(geneva.fr));
      for (const s of strings(geneva[lang])) expect(s, `${lang}: ${s}`).not.toMatch(DASHES);
    }
  });

  it('type no number in the copy: every figure is a {placeholder} filled from the rules engine', () => {
    // Digits that are part of a name, not a figure: pillar 3a, the 2nd pillar.
    const NAMES =
      /\b3a\b|3e pilier A|2e pilier|2nd pillar|2\. Säule|2° pilastro|2\.º pilar|piliers 2 et 3a|\{\w+\}/g;
    for (const { lang } of LANGS)
      for (const s of strings(geneva[lang]))
        expect(s.replace(NAMES, ''), `${lang}: ${s}`).not.toMatch(/\d/);
  });

  it('show every commune with the centimes the rules engine holds, and its source', () => {
    for (const { lang } of LANGS) {
      const html = renderGenevaPage(lang, 'communes');
      const rows = [
        ...html.matchAll(/<tr><th scope="row">([^<]+)<\/th><td[^>]*>(.*?)<\/td><\/tr>/g),
      ];
      expect(rows.map((r) => r[1])).toEqual(COMMUNES_2026.map((c) => c.name));
      for (const [i, c] of COMMUNES_2026.entries()) {
        const shown = rows[i]![2]!.replace(/<[^>]+>/g, '').replace(',', '.');
        expect(Math.round(Number(shown) * 100), `${lang} ${c.name}`).toBe(
          COMMUNE_CENTIMES_2026.value[c.slug],
        );
      }
      expect(html).toContain('href="https://silgeneve.ch/legis/data/rsg_D3_05p30.htm"');
    }
  });

  it('cite only documents from the sources library, linked at their page', async () => {
    const manifest = JSON.parse(
      await readFile(path.join(here, '..', '..', 'docs', 'sources', 'manifest.json'), 'utf8'),
    ) as { entries: { id: string; url: string; format: string }[] };
    const official = new Set(manifest.entries.map((e) => e.url));
    for (const { lang } of LANGS) {
      for (const html of pagesOf(lang)) {
        for (const [, href] of main(html).matchAll(/href="(https:[^"]+)"/g)) {
          expect(href, href).not.toMatch(/[?]/);
          expect(official, href).toContain(href!.replace(/#page=\d+$/, ''));
        }
      }
    }
    for (const { line } of lines)
      for (const c of line.sources) {
        const entry = manifest.entries.find((e) => e.id === c.id)!;
        const page = /\bp\. (\d+)/.exec(c.at)?.[1];
        expect(c.href).toBe(
          entry.format === 'pdf' && page ? `${entry.url}#page=${page}` : entry.url,
        );
      }
    expect(() => cite('ge-2099-not-a-document p. 1')).toThrow(/not in docs\/sources/);
  });

  it('give each figure the tax year of the document it comes from', () => {
    const yearOf = (sources: Citation[]) => sources[0]!.taxYear;
    for (const { what, line } of lines.filter(({ line }) =>
      Object.values(line.figures).some((f) => 'chf' in f || 'pct' in f),
    ))
      if (yearOf(line.sources) !== null) expect(line.year, what).toBe(yearOf(line.sources));
    for (const row of PILLAR3A.rows) expect(row.year).toBe(yearOf(row.sources));
    expect(COMMUNES.year).toBe(yearOf(COMMUNES.sources));
  });

  it('say the tax year, ask you to check the official source and offer Taxpresso, on every page', () => {
    for (const { lang, path: p } of LANGS) {
      for (const html of pagesOf(lang)) {
        expect(html).toContain(
          `<p class="ref-year">${geneva[lang].year.replace('{year}', String(TAX_YEAR))}</p>`,
        );
        expect(html).toContain(geneva[lang].check);
        expect(html).toContain(`<a class="btn btn-crema" href="${startPath(p)}">`);
        expect(html, lang).not.toMatch(/\{\w+\}/);
        expect(html).not.toMatch(RUNNABLE_SCRIPT);
        for (const re of REMOTE_LOAD) expect(html, `${lang} ${String(re)}`).not.toMatch(re);
      }
    }
  });

  it('are linked from every footer and from the guides', () => {
    for (const { lang, path: p } of LANGS) {
      const link = `<a href="${genevaPath(p)}">${geneva[lang].link}</a>`;
      for (const html of [render(lang), renderStart(lang), renderPrivacy(lang), ...pagesOf(lang)])
        expect(html).toContain(link);
      expect(renderGuides(lang)).toContain(`href="${genevaPath(p)}"`);
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
