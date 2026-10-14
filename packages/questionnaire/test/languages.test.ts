// Every text of every questionnaire and questions file under data/ in all four languages of the
// dashboard (English, French, German, Italian). A text is a map with two or more of en, fr, de and
// it; one that lacks a language shows English in its place (a German dashboard once said "Partner:
// Benefits" for Geneva). Each language keeps the English text's placeholders ({year}, {n}).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const LANGUAGES = ['en', 'fr', 'de', 'it'] as const;
const DATA = fileURLToPath(new URL('../../../data/', import.meta.url));

const FILES = (readdirSync(DATA, { recursive: true }) as string[])
  .filter((f) => /(^|\/)(questionnaire|questions)\.yaml$/.test(f.replaceAll('\\', '/')))
  .sort();

type Language = (typeof LANGUAGES)[number];

interface Found {
  path: string;
  text: Partial<Record<Language, string>>;
}

/** Every text in a parsed file, with a readable path (a list item by its id, use or value). */
function texts(node: unknown, path: string, out: Found[] = []): Found[] {
  if (Array.isArray(node)) {
    node.forEach((item: unknown, i) => {
      const entry = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const name = entry.id ?? entry.use ?? entry.value;
      const named = typeof name === 'string' || typeof name === 'number' ? name : i;
      texts(item, `${path}[${named}]`, out);
    });
  } else if (node && typeof node === 'object') {
    const map = node as Record<string, unknown>;
    const langs = LANGUAGES.filter((l) => l in map);
    if (langs.length >= 2 && langs.every((l) => typeof map[l] === 'string')) {
      out.push({ path, text: Object.fromEntries(langs.map((l) => [l, map[l] as string])) });
    } else {
      for (const [key, value] of Object.entries(map)) texts(value, `${path}.${key}`, out);
    }
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const parsed = FILES.map((file) => ({
  file,
  found: texts(parse(readFileSync(DATA + file, 'utf8')), ''),
}));

describe('the questionnaires’ languages', () => {
  it('finds the shared questions and every canton’s questionnaire, each with texts', () => {
    expect(FILES).toContain('ch/2026/questions.yaml');
    expect(FILES).toContain('ge/2026/questionnaire.yaml');
    expect(FILES.length).toBeGreaterThan(10);
    for (const { file, found } of parsed) expect(found.length, file).toBeGreaterThan(50);
  });

  it('has every text in English, French, German and Italian', () => {
    const missing = parsed.flatMap(({ file, found }) =>
      found.flatMap(({ path, text }) =>
        LANGUAGES.filter((l) => !(l in text)).map((l) => `${l} ${file} ${path.slice(1)}`),
      ),
    );
    expect(missing).toEqual([]);
  });

  it('keeps the English text’s placeholders in every language', () => {
    const differ = parsed.flatMap(({ file, found }) =>
      found.flatMap(({ path, text }) => {
        const english = placeholders(text.en ?? '').join();
        return LANGUAGES.filter((l) => {
          const words = text[l];
          return words !== undefined && placeholders(words).join() !== english;
        }).map((l) => `${l} ${file} ${path.slice(1)}`);
      }),
    );
    expect(differ).toEqual([]);
  });
});
