// Every constant cites a document of the sources library that was downloaded and checked
// (SPEC.md section 13, item 8b): each manifest id in a citation has status "ok" in
// docs/sources/lock.json and is followed by where to look (page, paragraph, article or the part of
// a page). The citations written into the rules (the form's lines, the law's rules, the sources
// the engine adds to a line) too: every id in the package's source files is checked.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AG_OFFICIAL_DOCUMENTS,
  AG_TERMS,
  agKeys,
  agParamsFor,
  churchRule,
  ESTIMATE_TEXT,
  FEDERAL_NOTE,
  FEDERAL_RUBRICS,
  NOTE,
  RUBRIC_ORDER,
  lowIncomeSteps,
  maxBurden,
  multipliers,
  RUBRICS,
  sharedChildren,
  tariffRule,
  tariffSteps,
  taxRounding,
  type Cited,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

const ID = /\b(?:ag|ch)-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]/g;
/** Where to look in the document, right after its id. */
const PLACE = /^ (p\. \d|§ \d|Art\. \d|\(|Änderungstabelle)/;

function expectCited(source: string, what: string) {
  const ids = source.match(ID) ?? [];
  expect(ids.length, `${what}: "${source}"`).toBeGreaterThan(0);
  for (const id of ids) {
    expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
    const after = source.slice(source.indexOf(id) + id.length);
    expect(after, `${what}: ${id} without a page, paragraph or part`).toMatch(PLACE);
  }
}

function constants(year: 2025 | 2026): [string, Cited<unknown>][] {
  const P = agParamsFor(year);
  return [
    ['income tariff', P.incomeTariff],
    ['wealth tariff', P.wealthTariff],
    ['cantonal rate', P.cantonalRate],
    ['communes', P.communes],
    ...(Object.entries(P.amounts) as [string, Cited<unknown>][]),
  ];
}

describe('citations', () => {
  for (const year of [2025, 2026] as const) {
    it(`every constant and rule of ${year}`, () => {
      const all: [string, Cited<unknown>][] = [
        ...constants(year),
        ['multipliers', multipliers(year)],
        ['tax rounding', taxRounding()],
        ['tariff steps', tariffSteps(year)],
        ['tariff rule', tariffRule(year)],
        ['shared children', sharedChildren()],
        ['church rule', churchRule(year)],
        ['maximum burden', maxBurden()],
        ['low-income steps', lowIncomeSteps()],
      ];
      for (const [name, c] of all) expectCited(c.source, `${year} ${name}`);
    });
  }

  it('the 2025 constants cite a 2025 document or the law; the 2026 ones no 2025 document', () => {
    for (const [name, c] of constants(2025)) {
      const ids = c.source.match(ID) ?? [];
      expect(
        ids.some((id) => id.startsWith('ag-2025-') || id.startsWith('ag-na-')),
        `2025 ${name}`,
      ).toBe(true);
    }
    for (const [name, c] of constants(2026)) {
      for (const id of c.source.match(ID) ?? []) {
        expect(id.includes('-2025-'), `2026 ${name}: ${id}`).toBe(false);
      }
    }
  });

  it('every line of the return, each once in the return’s order, and the federal tax’s own line', () => {
    for (const [code, r] of Object.entries(RUBRICS)) expectCited(r.source, code);
    for (const [code, r] of Object.entries(FEDERAL_RUBRICS)) expectCited(r.source, code);
    expect([...RUBRIC_ORDER].sort()).toEqual(Object.keys(RUBRICS).sort());
    expect(new Set(RUBRIC_ORDER).size).toBe(RUBRIC_ORDER.length);
  });

  it('every key Aargau defines, and the page to ask for more time', () => {
    for (const year of [2025, 2026] as const) {
      for (const [key, def] of Object.entries(agKeys(year))) {
        if (key.startsWith('ag.') || key === 'profile.commune' || key === 'profile.moved') {
          expectCited(def.source ?? '', `${year} key ${key}`);
        }
      }
    }
    expectCited(AG_TERMS.moreTimeSource, 'more time');
  });

  it('the texts shown to the user have no en or em dash (CLAUDE.md, user-facing copy)', () => {
    for (const [name, text] of Object.entries({ ...NOTE, ...ESTIMATE_TEXT, ...FEDERAL_NOTE })) {
      expect(`${text.en} ${text.fr}`, name).not.toMatch(/[–—]/);
    }
    for (const [code, r] of Object.entries({ ...RUBRICS, ...FEDERAL_RUBRICS })) {
      expect(JSON.stringify(r.label), code).not.toMatch(/[–—]/);
    }
  });

  it('every id written anywhere in the package is an ok entry of lock.json', () => {
    const dir = new URL('../src/', import.meta.url);
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) =>
      f.endsWith('.ts'),
    );
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      const text = readFileSync(new URL(f, dir), 'utf8');
      for (const id of text.match(ID) ?? []) expect(lock[id]?.status, `${f}: ${id}`).toBe('ok');
    }
  });
});

describe('the official Aargau documents linked', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../../../docs/sources/ag/manifest.json', import.meta.url), 'utf8'),
  ) as { id: string; title: string; url: string; format: string }[];

  it('are the manifest’s, title and link', () => {
    expect(Object.keys(AG_OFFICIAL_DOCUMENTS).sort()).toEqual(manifest.map((m) => m.id).sort());
    for (const [id, doc] of Object.entries(AG_OFFICIAL_DOCUMENTS)) {
      const m = manifest.find((x) => x.id === id)!;
      expect(doc, id).toEqual({ title: m.title, url: m.url, pdf: m.format === 'pdf' });
    }
  });

  it('cover every Aargau document the rules cite', () => {
    const dir = new URL('../src/', import.meta.url);
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) =>
      f.endsWith('.ts'),
    );
    for (const f of files) {
      const text = readFileSync(new URL(f, dir), 'utf8');
      for (const id of text.match(/\bag-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]\b/g) ?? []) {
        expect(Object.keys(AG_OFFICIAL_DOCUMENTS), `${f}: ${id}`).toContain(id);
      }
    }
  });
});
