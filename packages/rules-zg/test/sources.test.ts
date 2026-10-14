// Every constant cites a document of the sources library that was downloaded and checked
// (SPEC.md section 13, item 8b): each manifest id in a citation has status "ok" in
// docs/sources/lock.json and is followed by where to look (page, paragraph or the part of a
// document). The citations written into the rules (the form's lines, the laws' rules) too.
// Several Zug documents cover more than one year (the tariff sheets and the table of amounts print
// one page per year; the Steuerbuch states each year's amount): a 2025 constant that cites one of
// them cites its 2025 page or a Steuerbuch chapter, and a 2026 constant cites no 2025 document.
import { readdirSync, readFileSync } from 'node:fs';
import { ifdParamsFor } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  ASSESS_RULES,
  COMPUTE_RULES,
  ESTIMATE_TEXT,
  FEDERAL_NOTE,
  NOTE,
  RUBRICS,
  WEALTH_RUBRICS,
  ZG_OFFICIAL_DOCUMENTS,
  ZG_TERMS,
  zgKeys,
  zgParamsFor,
  type Cited,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

const ID = /\b(?:zg|ch)-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]/g;
/** Where to look in the document, right after its id. */
const PLACE = /^ (p\. \d|§ \d|\()/;

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
  const P = zgParamsFor(year);
  return [
    ['income tariffs', P.income],
    ['wealth tariff', P.wealth],
    ['cantonal Steuerfuss', P.canton],
    ['Evangelical Reformed Steuerfuss', P.reformed],
    ['communes', P.communes],
    ...(Object.entries(P.amounts) as [string, Cited<unknown>][]),
  ];
}

describe('citations', () => {
  for (const year of [2025, 2026] as const) {
    it(`every constant and rule of ${year}`, () => {
      for (const [name, c] of constants(year)) expectCited(c.source, `${year} ${name}`);
      const rules = [...ASSESS_RULES(year), ...COMPUTE_RULES(year)];
      rules.forEach((c, i) => expectCited(c.source, `${year} rule ${i}`));
    });
  }

  it('the 2026 constants cite no 2025 document', () => {
    for (const [name, c] of constants(2026)) {
      expect(c.source.match(ID)?.filter((id) => id.includes('-2025-')) ?? [], name).toEqual([]);
    }
  });

  it('the 2025 constants cite 2025 documents, or the 2025 page or chapter of a later one', () => {
    for (const [name, c] of constants(2025)) {
      for (const id of c.source.match(ID) ?? []) {
        if (!id.includes('-2026-')) continue;
        const after = c.source.slice(c.source.indexOf(id) + id.length);
        const ok =
          (/^zg-2026-(tariff|deductions-sozialabzuege)/.test(id) && after.startsWith(' p. 2')) ||
          id.startsWith('zg-2026-deductions-steuerbuch-') ||
          (id === 'ch-2026-ifd-progression-deductions' && /^[^;]*2025 column/.test(after));
        expect(ok, `2025 ${name}: ${id}${after.slice(0, 30)}`).toBe(true);
      }
    }
  });

  it('every line of form K', () => {
    for (const [code, r] of Object.entries(RUBRICS)) expectCited(r.source, code);
    for (const [code, r] of Object.entries(WEALTH_RUBRICS)) expectCited(r.source, `wealth ${code}`);
  });

  it('the canton’s Steuerfuss is the law’s for each year: 82 % in 2025, 78 % in 2026', () => {
    expect(zgParamsFor(2025).canton.source).toContain('zg-2025-law-steuergesetz § 2 Abs. 2 (p. 1)');
    expect(zgParamsFor(2026).canton.source).toContain(
      'zg-2026-law-steuergesetz § 2 Abs. 2b (p. 2)',
    );
  });

  it('the pillar 3a limits printed by the canton are the federal ones', () => {
    for (const year of [2025, 2026] as const) {
      expect(zgParamsFor(year).amounts.pillar3a.value).toEqual(ifdParamsFor(year).pillar3a.value);
    }
  });

  it('the 2026 professional cost rates are the federal annex’s (Steuerbuch 16.1)', () => {
    const f = ifdParamsFor(2026);
    const a = zgParamsFor(2026).amounts;
    expect(a.meals.value).toEqual(f.meals.value);
    expect(a.otherFlat.value).toEqual(f.professionalFlat.value);
    expect(a.travel.value.carPerKm).toBe(f.commuteKm.value.car);
    expect(a.travel.value.motorbikePerKm).toBe(f.commuteKm.value.motorbike);
    expect(a.travel.value.bikePerYear).toBe(f.commuteBike.value);
  });

  it('every key Zug defines, and the page to ask for more time', () => {
    for (const year of [2025, 2026] as const) {
      for (const [key, def] of Object.entries(zgKeys(year))) {
        if (key.startsWith('zg.') || key === 'profile.commune' || key === 'profile.moved') {
          expectCited(def.source ?? '', `${year} key ${key}`);
        }
      }
    }
    expectCited(ZG_TERMS.moreTimeSource, 'more time');
  });

  it('the texts shown to the user have no en or em dash (CLAUDE.md, user-facing copy)', () => {
    for (const [name, text] of Object.entries({ ...NOTE, ...ESTIMATE_TEXT, ...FEDERAL_NOTE })) {
      expect(`${text.en} ${text.fr}`, name).not.toMatch(/[–—]/);
    }
    for (const year of [2025, 2026] as const) {
      for (const [name, c] of constants(year)) expect(c.source, name).not.toMatch(/[–—]/);
    }
  });
});

describe('the official Zug documents linked', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../../../docs/sources/zg/manifest.json', import.meta.url), 'utf8'),
  ) as { id: string; title: string; url: string; format: string }[];

  it('are the manifest’s, title and link', () => {
    expect(Object.keys(ZG_OFFICIAL_DOCUMENTS).sort()).toEqual(manifest.map((m) => m.id).sort());
    for (const [id, doc] of Object.entries(ZG_OFFICIAL_DOCUMENTS)) {
      const m = manifest.find((x) => x.id === id)!;
      expect(doc, id).toEqual({ title: m.title, url: m.url, pdf: m.format === 'pdf' });
    }
  });

  it('cover every Zug document the rules cite', () => {
    const dir = new URL('../src/', import.meta.url);
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) =>
      f.endsWith('.ts'),
    );
    for (const f of files) {
      const text = readFileSync(new URL(f, dir), 'utf8');
      for (const id of text.match(/\bzg-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]\b/g) ?? []) {
        expect(Object.keys(ZG_OFFICIAL_DOCUMENTS), `${f}: ${id}`).toContain(id);
      }
    }
  });
});
