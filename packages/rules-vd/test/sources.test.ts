// Every constant cites a document of the sources library that was downloaded and checked
// (SPEC.md section 13, item 8b): each manifest id in a citation has status "ok" in
// docs/sources/lock.json and is followed by where to look (page, article, sheet or the part of a
// page). The citations written into the rules (the form's lines, the laws' rules) too. A 2026
// constant cites 2026 documents, or documents valid for every year, except where the 2026 guide
// is missing and the constant says so (a lower bound, or the 2025 guide's convention).
import { readdirSync, readFileSync } from 'node:fs';
import { ifdParamsFor } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  ASSESS_RULES,
  COMPUTE_RULES,
  FEDERAL_NOTE,
  FEDERAL_RUBRICS,
  NOTE,
  partOptions,
  RUBRICS,
  vaudKeys,
  VD_OFFICIAL_DOCUMENTS,
  vdParamsFor,
  WEALTH_RUBRICS,
  type Cited,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

const ID = /\b(?:vd|ch)-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]/g;
/** Where to look in the document, right after its id. */
const PLACE = /^ (p\. \d|art\. \d|sheet \S|\()/;

function expectCited(source: string, what: string) {
  const ids = source.match(ID) ?? [];
  expect(ids.length, `${what}: "${source}"`).toBeGreaterThan(0);
  for (const id of ids) {
    expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
    const after = source.slice(source.indexOf(id) + id.length);
    expect(after, `${what}: ${id} without a page, article, sheet or part`).toMatch(PLACE);
  }
}

function constants(
  year: 2025 | 2026,
): [string, Cited<unknown> & { floorOnly?: true; carriedFrom?: number }][] {
  const P = vdParamsFor(year);
  return [
    ['income scale', P.incomeScale],
    ['wealth scale', P.wealthScale],
    ['cantonal coefficient', P.cantonalCoefficient],
    ['LRIPP reduction', P.lrippReductionBp],
    ['communes', P.communes],
    ...(Object.entries(P.amounts).filter(([, c]) => c !== null) as [string, Cited<unknown>][]),
  ];
}

describe('citations', () => {
  for (const year of [2025, 2026] as const) {
    it(`every constant of ${year}`, () => {
      const rules = [...ASSESS_RULES(year), ...COMPUTE_RULES(year)];
      for (const [name, c] of constants(year)) expectCited(c.source, `${year} ${name}`);
      rules.forEach((c, i) => expectCited(c.source, `${year} rule ${i}`));
    });

    it(`the ${year} constants cite ${year} documents, or say why not`, () => {
      const other = year === 2025 ? '2026' : '2025';
      for (const [name, c] of constants(year)) {
        const foreign = (c.source.match(ID) ?? []).filter((id) => id.includes(`-${other}-`));
        if (foreign.length) {
          expect(year, `${name}: ${foreign.join(', ')}`).toBe(2026);
          expect(Boolean(c.floorOnly) || c.carriedFrom === 2025, name).toBe(true);
          // A lower bound also cites the 2026 law that keeps the amount from going down.
          if (c.floorOnly) expect(c.source).toContain('vd-2026-law-li art. 60');
        }
      }
    });
  }

  it('every line of the return', () => {
    for (const [code, r] of Object.entries(RUBRICS)) expectCited(r.source, code);
    for (const [code, r] of Object.entries(WEALTH_RUBRICS)) expectCited(r.source, `wealth ${code}`);
    for (const [code, r] of Object.entries(FEDERAL_RUBRICS))
      expectCited(r.source, `federal ${code}`);
  });

  it('the 2026 amounts the documents do not print are null or lower bounds', () => {
    const A = vdParamsFor(2026).amounts;
    expect(A.publicTransport).toBeNull();
    expect(A.otherTransport).toBeNull();
    expect(A.rentCap.floorOnly).toBe(true);
    expect(A.quotientCap.floorOnly).toBe(true);
    expect(A.furniture.floorOnly).toBe(true);
    expect(A.yearDays.carriedFrom).toBe(2025);
    const B = vdParamsFor(2025).amounts;
    for (const a of [B.rentCap, B.quotientCap, B.furniture, B.yearDays]) {
      expect('floorOnly' in a || 'carriedFrom' in a).toBe(false);
    }
  });

  it('the pillar 3a limits printed by the canton are the federal ones', () => {
    for (const year of [2025, 2026] as const) {
      expect(vdParamsFor(year).amounts.pillar3a.value).toEqual(ifdParamsFor(year).pillar3a.value);
    }
  });

  it('the texts shown to the user have no en or em dash (CLAUDE.md, user-facing copy)', () => {
    for (const [name, text] of Object.entries({ ...NOTE, ...FEDERAL_NOTE })) {
      expect(`${text.en} ${text.fr}`, name).not.toMatch(/[–—]/);
    }
  });
});

describe('Vaud’s keys', () => {
  it('cite Vaud’s documents, with the page or article', () => {
    const keys = vaudKeys(2026);
    for (const k of [
      'profile.commune',
      'profile.moved',
      'vd.commune_part',
      'vd.own_household',
      'vd.main_upkeep',
      'vd.rent',
      'vd.contents_high',
      'vd.contents_value',
      'vd.child_care',
      'vd.savings_interest',
    ]) {
      expectCited(keys[k]!.source!, k);
    }
    for (const [k, def] of Object.entries(keys)) {
      if (def.source?.startsWith('vd-')) expectCited(def.source, k);
    }
  });

  it('offer each part of L’Abbaye and Le Chenit, from the communal table', () => {
    const parts = partOptions(2026);
    expect(parts.map((p) => p.value)).toEqual([
      'l-abbaye:l-abbaye',
      'l-abbaye:les-bioux',
      'le-chenit:le-chenit',
      'le-chenit:le-brassus',
      'le-chenit:le-sentier',
      'le-chenit:l-orient',
    ]);
    expect(vaudKeys(2026)['vd.commune_part']!.values).toEqual(parts.map((p) => p.value));
  });
});

describe('the official Vaud documents linked', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../../../docs/sources/vd/manifest.json', import.meta.url), 'utf8'),
  ) as { id: string; title: string; url: string; format: string }[];

  it('are the manifest’s, title and link', () => {
    expect(Object.keys(VD_OFFICIAL_DOCUMENTS).sort()).toEqual(manifest.map((m) => m.id).sort());
    for (const [id, doc] of Object.entries(VD_OFFICIAL_DOCUMENTS)) {
      const m = manifest.find((x) => x.id === id)!;
      expect(doc, id).toEqual({ title: m.title, url: m.url, pdf: m.format === 'pdf' });
    }
  });

  it('cover every Vaud document the rules cite', () => {
    const dir = new URL('../src/', import.meta.url);
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) =>
      f.endsWith('.ts'),
    );
    for (const f of files) {
      const text = readFileSync(new URL(f, dir), 'utf8');
      for (const id of text.match(/\bvd-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]\b/g) ?? []) {
        if (manifest.some((m) => m.id === id)) {
          expect(Object.keys(VD_OFFICIAL_DOCUMENTS), `${f}: ${id}`).toContain(id);
        }
      }
    }
  });
});
