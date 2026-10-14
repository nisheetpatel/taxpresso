// One questionnaire for every tax year it serves (docs/design/tax-years.md): its texts name the
// year, its citations are that year's documents (or the latest published before it), and a canton
// Taxpresso doesn't prepare for the year says so.
import { readFileSync } from 'node:fs';
import { KEYS_CANTON_2026, SUPPORTED_CANTONS } from '@taxpresso/rules-ch';
import { COMMUNES_2026, KEYS_2026 as GENEVA_KEYS } from '@taxpresso/rules-ge';
import { describe, expect, it } from 'vitest';
import {
  citationFor,
  GE_QUESTIONNAIRE_YEARS,
  geQuestionnaire,
  geQuestionnaire2026,
  NBSP,
  parseQuestionnaire,
  QuestionnaireEngine,
  QuestionnaireYearError,
  SHARED_QUESTIONNAIRE_YEARS,
  sharedQuestionnaire,
  sharedQuestionnaire2026,
  type QuestionnaireFile,
} from '../src/index.js';

const KEYS = { ...KEYS_CANTON_2026, ...GENEVA_KEYS };

interface ManifestEntry {
  id: string;
  url: string;
  tax_year: number | null;
}
const manifest = JSON.parse(
  readFileSync(new URL('../../../docs/sources/manifest.json', import.meta.url), 'utf8'),
) as { entries: ManifestEntry[] };
const byUrl = new Map(manifest.entries.map((e) => [e.url, e]));
const byId = new Map(manifest.entries.map((e) => [e.id, e]));

/** Every text of a file (questions, options, chips, documents), without the citations' URLs. */
function texts(file: QuestionnaireFile): string[] {
  const out: string[] = [];
  const walk = (v: unknown, key = ''): void => {
    if (key === 'url' || key === 'source') return;
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) if (k !== 'learnMore') walk(x, k);
  };
  walk(file.questions);
  walk(file.requirements);
  return out;
}

/** The documents a file cites: each learnMore page and each source's manifest ids. */
function cited(file: QuestionnaireFile): { where: string; entry: ManifestEntry | undefined }[] {
  const out: { where: string; entry: ManifestEntry | undefined }[] = [];
  for (const item of [...file.questions, ...file.requirements]) {
    if (item.learnMore) {
      out.push({
        where: `${item.id} learnMore`,
        entry: byUrl.get(item.learnMore.url.replace(/#page=\d+$/, '')),
      });
    }
    const source = 'source' in item ? item.source : undefined;
    for (const m of source?.matchAll(/\b([a-z]{2,9}-(?:\d{4}|na)-[a-z0-9-]+)/g) ?? []) {
      out.push({ where: `${item.id} source`, entry: byId.get(m[1]!) });
    }
  }
  return out;
}

describe('the tax years a questionnaire serves', () => {
  it('Geneva and the shared questions serve 2025 and 2026', () => {
    expect(GE_QUESTIONNAIRE_YEARS).toEqual([2025, 2026]);
    expect(SHARED_QUESTIONNAIRE_YEARS).toEqual([2025, 2026]);
    expect(geQuestionnaire(2025).taxYear).toBe(2025);
    expect(geQuestionnaire2026()).toEqual(geQuestionnaire(2026));
  });

  it('refuses a year it does not serve (fail closed)', () => {
    expect(() => geQuestionnaire(2027)).toThrow(QuestionnaireYearError);
    expect(() => sharedQuestionnaire(2019)).toThrow(QuestionnaireYearError);
  });

  it('matches the Geneva keys and communes for both years (the keys test, per year)', () => {
    for (const year of GE_QUESTIONNAIRE_YEARS) {
      const engine = new QuestionnaireEngine(geQuestionnaire(year), KEYS, COMMUNES_2026);
      expect(engine.check()).toEqual([]);
    }
  });
});

describe('texts name the open year', () => {
  for (const year of [2025, 2026]) {
    it(`${year}: every placeholder is filled, and no other year is named`, () => {
      const file = geQuestionnaire(year);
      const all = texts(file);
      expect(all.filter((t) => /\{(year|prevYear|nextYear)\}/.test(t))).toEqual([]);
      const other = String(year === 2025 ? 2026 : 2025);
      // The Geneva guide is 2025's: its name may appear in a citation's label only.
      expect(all.filter((t) => t.includes(other))).toEqual([]);
    });
  }

  it('2025 reads as 2025: the canton, the move and its chip', () => {
    const file = geQuestionnaire(2025);
    const q = (id: string) => file.questions.find((x) => x.id === id)!;
    /** A household question's text (not one per person). */
    const say = (id: string, lang: 'en' | 'fr') => {
      const text = q(id).text;
      return 'p1' in text ? undefined : text[lang];
    };
    expect(say('canton', 'en')).toBe('Where did you live on 31 December 2025?');
    expect(say('moved', 'fr')).toBe(`Avez-vous déménagé en 2025${NBSP}?`);
    expect(q('moved').options?.find((o) => o.value === 'from_abroad')?.chip?.en).toBe(
      'Arrived in 2025',
    );
    expect(
      geQuestionnaire(2026).questions.find((x) => x.id === 'moved')?.options?.[2]?.chip?.en,
    ).toBe('Arrived in 2026');
  });

  it('a help text that holds for one year only is that year’s (the 10 francs of 2026)', () => {
    const help = (year: number) =>
      geQuestionnaire(year).questions.find((x) => x.id === 'meal_days')?.help?.en ?? '';
    expect(help(2026)).toMatch(/more than 10 francs/);
    expect(help(2025)).not.toMatch(/10 francs/);
    expect(help(2025)).toMatch(/more than a meal at home/);
  });
});

describe("citations are the year's documents", () => {
  for (const year of [2025, 2026]) {
    it(`${year}: every learnMore and source is in the manifest, of ${year} or earlier, or of no year`, () => {
      for (const file of [geQuestionnaire(year), sharedQuestionnaire(year)]) {
        for (const { where, entry } of cited(file)) {
          expect(entry, where).toBeDefined();
          if (entry!.tax_year !== null) expect(entry!.tax_year, where).toBeLessThanOrEqual(year);
        }
      }
    });
  }

  it('2026 keeps the 2026 federal instructions; 2025 cites the 2025 Geneva guide instead', () => {
    const page = (year: number, id: string) =>
      geQuestionnaire(year).questions.find((x) => x.id === id)?.learnMore?.url;
    expect(page(2026, 'commute')).toMatch(/2a-2026-fr\.pdf#page=6$/);
    expect(page(2025, 'commute')).toBe(
      'https://www.ge.ch/document/41995/annexe/file/573038#page=20',
    );
    // The shared civil status question cites the 2026 instructions: none for 2025 before the
    // canton (the 2025 instructions are not in the library), Geneva's guide once it is Geneva.
    const civil = (f: QuestionnaireFile) => f.questions.find((x) => x.id === 'civil_status');
    expect(civil(sharedQuestionnaire(2025))?.learnMore).toBeUndefined();
    expect(civil(geQuestionnaire(2025))?.learnMore?.url).toMatch(/573038#page=53$/);
  });

  it('chooses the latest document up to the year, an undated one otherwise, never a later one', () => {
    const law = { url: 'law', label: { en: 'law', fr: 'loi' } };
    const y25 = { year: 2025, url: 'a', label: { en: 'a', fr: 'a' } };
    const y26 = { year: 2026, url: 'b', label: { en: 'b', fr: 'b' } };
    expect(citationFor([y25, y26], 2026)).toEqual({ url: 'b', label: y26.label });
    expect(citationFor([y25, y26], 2025)).toEqual({ url: 'a', label: y25.label });
    expect(citationFor([y26], 2025)).toBeUndefined();
    expect(citationFor([y26, law], 2025)).toEqual(law);
    expect(citationFor(y25, 2027)).toEqual({ url: 'a', label: y25.label });
    expect(citationFor('ge-2025-guide-declaration-pp p. 8', 2026)).toBe(
      'ge-2025-guide-declaration-pp p. 8',
    );
    expect(citationFor('ch-2026-ifd-instructions-personnes-physiques p. 1', 2025)).toBeUndefined();
  });
});

describe('a canton not offered for the year', () => {
  it('says so in the canton question, and the lists name only the cantons offered', () => {
    const file = sharedQuestionnaire(2025, ['GE']);
    const canton = file.questions[0]!;
    const zh = canton.options!.find((o) => o.value === 'ZH')!;
    expect(zh.notSupported).toEqual({
      en: 'Zurich: Taxpresso can’t prepare a 2025 return there yet',
      fr: `Zurich${NBSP}: Taxpresso ne peut pas encore y préparer une déclaration 2025`,
      de: 'Zürich: Eine Steuererklärung 2025 kann Taxpresso dort noch nicht vorbereiten',
      it: 'Zurigo: Taxpresso non può ancora prepararvi una dichiarazione 2025',
    });
    expect(canton.options!.find((o) => o.value === 'GE')!.notSupported).toBeUndefined();
    expect(canton.explain?.en).toMatch(/prepares returns for Geneva so far\.$/);
  });

  it('changes nothing for a year every canton has', () => {
    expect(sharedQuestionnaire(2026, SUPPORTED_CANTONS)).toEqual(sharedQuestionnaire2026());
  });

  it('a file of one year (a canton without taxYears) serves only that year', () => {
    const raw = { taxYear: 2026, people: {}, notSupported: {}, questions: [], requirements: [] };
    expect(() => parseQuestionnaire(raw, undefined, { taxYear: 2025 })).toThrow(
      QuestionnaireYearError,
    );
  });
});
