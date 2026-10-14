// Every constant cites a document of the sources library that was downloaded and checked
// (SPEC.md section 13, item 8b): each manifest id in a citation has status "ok" in
// docs/sources/lock.json and is followed by where to look (page, article or the part of a page).
// The citations written into the rules (the form's lines, the laws' rules) too. A 2026 constant
// cites 2026 documents, or documents valid for every year (the tax law); a 2025 constant cites 2025
// documents, or those valid for every year.
import { readFileSync } from 'node:fs';
import { ifdParamsFor } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  ASSESS_RULES,
  COMPUTE_RULES,
  ESTIMATE_TEXT,
  FEDERAL_NOTE,
  FEDERAL_RUBRICS,
  MODULO4,
  NOTE,
  NOTE_VALUABLES,
  RUBRICS,
  TI_OFFICIAL_DOCUMENTS,
  TI_TERMS,
  tiKeys,
  tiParamsFor,
  WEALTH_RUBRICS,
  type Cited,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

const ID = /\b(?:ti|ch)-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]/g;
/** Where to look in the document, right after its id. */
const PLACE = /^ (p\. \d|pp\. \d|art\. \d|\()/;

function expectCited(source: string, what: string) {
  const ids = source.match(ID) ?? [];
  expect(ids.length, `${what}: "${source}"`).toBeGreaterThan(0);
  for (const id of ids) {
    expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
    const after = source.slice(source.indexOf(id) + id.length);
    expect(after, `${what}: ${id} without a page, article or part`).toMatch(PLACE);
  }
}

function constants(year: 2025 | 2026): [string, Cited<unknown>][] {
  const P = tiParamsFor(year);
  return [
    ['income tariff, single', P.income.single],
    ['income tariff, family', P.income.family],
    ['wealth tariff', P.wealth],
    ['communes', P.communes],
    ...(Object.entries(P.amounts).filter(([, c]) => c !== null) as [string, Cited<unknown>][]),
  ];
}

const rules = (year: 2025 | 2026): [string, Cited<unknown>][] =>
  [...ASSESS_RULES(year), ...COMPUTE_RULES(year)].map((r, i) => [`rule ${i}`, r]);

describe('citations', () => {
  for (const year of [2025, 2026] as const) {
    it(`every constant and rule of ${year}`, () => {
      for (const [name, c] of [...constants(year), ...rules(year)]) {
        expectCited(c.source, `${year} ${name}`);
      }
    });

    it(`the ${year} constants cite ${year} documents, or documents valid for every year`, () => {
      const other = year === 2025 ? '2026' : '2025';
      for (const [name, c] of [...constants(year), ...rules(year)]) {
        const foreign = (c.source.match(ID) ?? []).filter((id) => id.includes(`-${other}-`));
        expect(foreign, `${year} ${name}`).toEqual([]);
      }
    });
  }

  it('2026 has no source for the most working days that count for driving: null, not 2025’s', () => {
    expect(tiParamsFor(2025).amounts.commuteMaxDays?.value).toBe(220);
    expect(tiParamsFor(2026).amounts.commuteMaxDays).toBeNull();
  });

  it('no constant is an estimate', () => {
    for (const year of [2025, 2026] as const) {
      for (const [name, c] of constants(year))
        expect('estimate' in c, `${year} ${name}`).toBe(false);
    }
  });

  it('every line of the return and of Modulo 4, and the federal deduction it has no line for', () => {
    for (const [code, r] of Object.entries(RUBRICS)) expectCited(r.source, code);
    for (const [code, r] of Object.entries(WEALTH_RUBRICS)) expectCited(r.source, `wealth ${code}`);
    for (const [code, r] of Object.entries(MODULO4)) expectCited(r.source, `Modulo 4 ${code}`);
    for (const [code, r] of Object.entries(FEDERAL_RUBRICS)) {
      expectCited(r.source, `federal ${code}`);
    }
  });

  it('every key Ticino defines, and the page to ask for more time', () => {
    for (const year of [2025, 2026] as const) {
      for (const [key, def] of Object.entries(tiKeys(year))) {
        if (key.startsWith('ti.') || key === 'profile.commune' || key === 'profile.moved') {
          expectCited(def.source ?? '', `${year} key ${key}`);
        }
      }
    }
    expectCited(TI_TERMS.moreTimeSource, 'more time');
  });

  it('the pillar 3a limits are the federal ones', () => {
    for (const year of [2025, 2026] as const) {
      expect(tiParamsFor(year).amounts.pillar3a.value).toEqual(ifdParamsFor(year).pillar3a.value);
    }
  });

  it('the texts shown to the user have no en or em dash (CLAUDE.md, user-facing copy)', () => {
    for (const [name, text] of Object.entries({
      ...NOTE,
      ...ESTIMATE_TEXT,
      ...FEDERAL_NOTE,
      NOTE_VALUABLES,
    })) {
      expect(`${text.en} ${text.fr} ${text.it ?? ''}`, name).not.toMatch(/[–—]/);
    }
    // Every note the dashboard shows says it in Italian too, with typographic apostrophes.
    for (const [name, text] of Object.entries({ ...NOTE, ...ESTIMATE_TEXT, NOTE_VALUABLES })) {
      expect(text.it, name).toBeTruthy();
      expect(text.it, name).not.toMatch(/\p{L}'\p{L}/u);
    }
    for (const year of [2025, 2026] as const) {
      for (const [name, c] of [...constants(year), ...rules(year)]) {
        expect(c.source, name).not.toMatch(/[–—]/);
      }
    }
  });
});

describe('the official Ticino documents linked', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../../../docs/sources/ti/manifest.json', import.meta.url), 'utf8'),
  ) as { id: string; title: string; url: string; format: string }[];

  it('are the manifest’s, title and link', () => {
    expect(Object.keys(TI_OFFICIAL_DOCUMENTS).sort()).toEqual(manifest.map((m) => m.id).sort());
    for (const [id, doc] of Object.entries(TI_OFFICIAL_DOCUMENTS)) {
      const m = manifest.find((x) => x.id === id)!;
      expect(doc, id).toEqual({ title: m.title, url: m.url, pdf: m.format === 'pdf' });
    }
  });
});
