// Every text of the dashboard in every language it offers (English, French, German, Italian): each
// table has the same keys in each language as in English, every value is words, with the same
// placeholders as the English one. Italian: plain words, typographic apostrophes, no em dash.
import { describe, expect, it } from 'vitest';
import { text as estimate } from './Estimate';
import { text as folderExport } from './Export';
import { messages as main } from './i18n';
import { messages as copy } from './i18n-copy';
import { messages as docs } from './i18n-docs';
import { messages as finalCheck } from './i18n-final-check';
import { messages as holdings } from './i18n-holdings';
import { messages as planning } from './i18n-planning';
import { messages as reconcile } from './i18n-reconcile';
import { messages as review } from './i18n-review';
import { text as lastYear } from './LastYear';

type Table = Readonly<Record<string, Readonly<Record<string, string>>>>;

const TABLES: Record<string, Table> = {
  main,
  copy,
  docs,
  finalCheck,
  holdings,
  planning,
  reconcile,
  review,
  estimate,
  folderExport,
  lastYear,
};

const LANGUAGES = ['en', 'fr', 'de', 'it'] as const;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('the dashboard’s texts', () => {
  for (const [name, table] of Object.entries(TABLES)) {
    it(`${name}: every key in English, French, German and Italian, with the same placeholders`, () => {
      expect(Object.keys(table).sort()).toEqual([...LANGUAGES].sort());
      const keys = Object.keys(table.en!);
      for (const lang of LANGUAGES) {
        expect(Object.keys(table[lang]!), `${name}.${lang}`).toEqual(keys);
        for (const key of keys) {
          const value = table[lang]![key];
          expect(typeof value, `${name}.${lang}.${key}`).toBe('string');
          // French leaves a few official terms empty where they are the label itself; Italian,
          // like German, says every text English says.
          if (lang === 'it' || lang === 'de') {
            expect(value!.trim().length > 0, `${name}.${lang}.${key}`).toBe(
              table.en![key]!.trim().length > 0,
            );
          }
          expect(placeholders(value!), `${name}.${lang}.${key}`).toEqual(
            placeholders(table.en![key]!),
          );
        }
      }
    });
  }

  it('Italian: no em dash, no straight apostrophe, no space before a colon', () => {
    for (const [name, table] of Object.entries(TABLES)) {
      for (const [key, value] of Object.entries(table.it!)) {
        expect(value, `${name}.it.${key}`).not.toMatch(/[—–]/);
        expect(value, `${name}.it.${key}`).not.toMatch(/\p{L}'\p{L}/u);
        expect(value, `${name}.it.${key}`).not.toMatch(/\s:/);
      }
    }
  });
});
