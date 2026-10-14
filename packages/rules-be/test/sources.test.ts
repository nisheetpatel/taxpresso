// Every constant cites a document of the sources library that was downloaded and checked
// (SPEC.md section 13, item 8b): each manifest id in a citation has status "ok" in
// docs/sources/lock.json and is followed by where to look (page, article, sheet or the part of a
// page). The citations written into the rules (the form's lines, the law's rules) too.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BE_OFFICIAL_DOCUMENTS,
  bernKeys,
  beParamsFor,
  parishOptions,
  churchRates,
  maxBurden,
  multipliers,
  RUBRICS,
  sharedChildren,
  tariffRule,
  tariffSteps,
  wealthFreeBelow,
  type Cited,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

const ID = /\b(?:be|ch)-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]/g;
/** Where to look in the document, right after its id. */
const PLACE = /^ (p\. \d|Art\. \d|sheet \S|\()/;

function expectCited(source: string, what: string) {
  const ids = source.match(ID) ?? [];
  expect(ids.length, `${what}: "${source}"`).toBeGreaterThan(0);
  for (const id of ids) {
    expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
    const after = source.slice(source.indexOf(id) + id.length);
    expect(after, `${what}: ${id} without a page, article, sheet or part`).toMatch(PLACE);
  }
}

describe('citations', () => {
  for (const year of [2025, 2026] as const) {
    it(`every constant of ${year}`, () => {
      const P = beParamsFor(year);
      const all: [string, Cited<unknown>][] = [
        ['income married', P.incomeTariff.married],
        ['income other', P.incomeTariff.other],
        ['wealth', P.wealthTariff],
        ['cantonal rate', P.cantonalRate],
        ['communes', P.communes],
        ['multipliers', multipliers(year)],
        ['church rates', churchRates(year)],
        ['tariff steps', tariffSteps(year)],
        ['wealth free below', wealthFreeBelow(year)],
        ['maximum burden', maxBurden(year)],
        ['tariff rule', tariffRule(year)],
        ['shared children', sharedChildren(year)],
        ...(Object.entries(P.amounts) as [string, Cited<unknown>][]),
      ];
      for (const [name, c] of all) expectCited(c.source, `${year} ${name}`);
    });

    it(`the ${year} constants cite ${year} documents (or documents valid for every year)`, () => {
      const P = beParamsFor(year);
      const other = year === 2025 ? '2026' : '2025';
      const own: [string, Cited<unknown>][] = [
        ['income married', P.incomeTariff.married],
        ['income other', P.incomeTariff.other],
        ['wealth', P.wealthTariff],
        ['cantonal rate', P.cantonalRate],
        ['communes', P.communes],
        ...(Object.entries(P.amounts) as [string, Cited<unknown>][]),
      ];
      for (const [name, c] of own) {
        for (const id of c.source.match(ID) ?? []) {
          expect(id.includes(`-${other}-`), `${year} ${name}: ${id}`).toBe(false);
        }
      }
    });
  }

  it('every line of the return', () => {
    for (const [code, r] of Object.entries(RUBRICS)) expectCited(r.source, code);
  });
});

describe('Bern’s keys', () => {
  it('cite Bern’s documents, with the page or article', () => {
    const keys = bernKeys(2026);
    for (const k of [
      'profile.commune',
      'profile.moved',
      'be.own_household',
      'be.church',
      'be.parish',
      'be.married_tariff',
      'be.child_wealth',
      'be.party',
      'be.education',
      'be.child_education',
    ]) {
      expectCited(keys[k]!.source!, k);
    }
    for (const [k, def] of Object.entries(keys)) {
      if (def.source?.startsWith('be-')) expectCited(def.source, k);
    }
  });

  it('offer each part of a commune whose parishes levy different rates, from the table', () => {
    const parts = parishOptions(2026);
    expect(new Set(parts.map((p) => p.bfs)).size).toBe(21);
    expect(bernKeys(2026)['be.parish']!.values).toEqual(parts.map((p) => p.value));
    expect(parts.find((p) => p.bfs === 304)).toMatchObject({
      commune: 'Kallnach',
      part: 'Golaten',
    });
  });
});

describe('the official Bern documents linked', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../../../docs/sources/be/manifest.json', import.meta.url), 'utf8'),
  ) as { id: string; title: string; url: string; format: string }[];

  it('are the manifest’s, title and link', () => {
    expect(Object.keys(BE_OFFICIAL_DOCUMENTS).sort()).toEqual(manifest.map((m) => m.id).sort());
    for (const [id, doc] of Object.entries(BE_OFFICIAL_DOCUMENTS)) {
      const m = manifest.find((x) => x.id === id)!;
      expect(doc, id).toEqual({ title: m.title, url: m.url, pdf: m.format === 'pdf' });
    }
  });

  it('cover every Bern document the rules cite', () => {
    const dir = new URL('../src/', import.meta.url);
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) =>
      f.endsWith('.ts'),
    );
    for (const f of files) {
      const text = readFileSync(new URL(f, dir), 'utf8');
      for (const id of text.match(/\bbe-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]\b/g) ?? []) {
        if (manifest.some((m) => m.id === id)) {
          expect(Object.keys(BE_OFFICIAL_DOCUMENTS), `${f}: ${id}`).toContain(id);
        }
      }
    }
  });
});
