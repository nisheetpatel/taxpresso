import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { copy, LANGS } from '../src/content.ts';
import { render, renderStart } from '../src/render.ts';

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

// Anything the browser would fetch from another server: scripts, styles, fonts, images, frames.
const REMOTE_LOAD = [
  /<(?:script|img|iframe|source|video|audio)\b[^>]*\bsrc\s*=\s*["']?(?:https?:)?\/\//i,
  /<link\b[^>]*\bhref\s*=\s*["']?(?:https?:)?\/\//i,
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
        expect(html).toContain(`hreflang="${other.lang}" href="${other.path}"`);
      expect(html).not.toMatch(/<script/i);
      for (const re of REMOTE_LOAD) expect(html, `${lang} ${String(re)}`).not.toMatch(re);
    }
  });

  it('renders each Get started page with its download link and no script', () => {
    for (const { lang } of LANGS) {
      const html = renderStart(lang);
      expect(html).toContain(`<html lang="${lang}">`);
      expect(html).toContain('/releases/latest');
      expect(html).not.toMatch(/<script/i);
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
