// Every constant cites a document of the sources library that was downloaded and checked
// (SPEC.md section 13, item 8b): each manifest id in a citation has status "ok" in
// docs/sources/lock.json and is followed by where to look (page, paragraph or sheet).
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  churchSplit,
  multipliers,
  personalTax,
  RUBRICS,
  tariffRule,
  ZH_OFFICIAL_DOCUMENTS,
  zhParamsFor,
  zurichKeys,
  type Cited,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

const ID = /\b(?:zh|ch)-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]/g;

function expectCited(source: string, what: string) {
  const ids = source.match(ID) ?? [];
  expect(ids.length, `${what}: "${source}"`).toBeGreaterThan(0);
  for (const id of ids) {
    expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
    const after = source.slice(source.indexOf(id) + id.length);
    expect(after, `${what}: ${id} without a page, paragraph or sheet`).toMatch(
      /^ (p\. \d|§ \d|sheet [A-Z])/,
    );
  }
}

describe('citations', () => {
  for (const year of [2025, 2026] as const) {
    it(`every constant of ${year}`, () => {
      const P = zhParamsFor(year);
      const all: [string, Cited<unknown>][] = [
        ['income basic', P.incomeTariff.basic],
        ['income married', P.incomeTariff.married],
        ['wealth basic', P.wealthTariff.basic],
        ['wealth married', P.wealthTariff.married],
        ['cantonal rate', P.cantonalRate],
        ['communes', P.communes],
        ['personal tax', personalTax(year)],
        ['church split', churchSplit(year)],
        ['multipliers', multipliers(year)],
        ['tariff rule', tariffRule(year)],
        ...(Object.entries(P.amounts) as [string, Cited<unknown>][]),
      ];
      for (const [name, c] of all) expectCited(c.source, `${year} ${name}`);
    });

    it(`the ${year} constants cite ${year} documents (or documents valid for every year)`, () => {
      const P = zhParamsFor(year);
      const other = year === 2025 ? '2026' : '2025';
      for (const [name, c] of Object.entries(P.amounts) as [string, Cited<unknown>][]) {
        for (const id of c.source.match(ID) ?? []) {
          expect(id.includes(`-${other}-`), `${year} ${name}: ${id}`).toBe(false);
        }
      }
    });
  }

  it('every line of the return', () => {
    for (const [code, r] of Object.entries(RUBRICS)) expectCited(r.source, code);
  });

  it('Zurich’s own keys and the Zurich terms it gives the shared ones', () => {
    const keys = zurichKeys(2026);
    for (const k of ['profile.commune', 'profile.moved', 'zh.church', 'zh.parish']) {
      expectCited(keys[k]!.source!, k);
    }
    for (const [k, def] of Object.entries(keys)) {
      if (def.source?.startsWith('zh-')) expectCited(def.source, k);
    }
  });
});

describe('the official Zurich documents linked', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../../../docs/sources/zh/manifest.json', import.meta.url), 'utf8'),
  ) as { id: string; title: string; url: string; format: string }[];

  it('are the manifest’s, title and link', () => {
    for (const [id, doc] of Object.entries(ZH_OFFICIAL_DOCUMENTS)) {
      const m = manifest.find((x) => x.id === id);
      expect(m, id).toBeDefined();
      expect(doc, id).toEqual({ title: m!.title, url: m!.url, pdf: m!.format === 'pdf' });
    }
  });

  it('cover every Zurich document the rules cite', () => {
    const dir = new URL('../src/', import.meta.url);
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) =>
      f.endsWith('.ts'),
    );
    for (const f of files) {
      const text = readFileSync(new URL(f, dir), 'utf8');
      for (const id of text.match(/\bzh-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]\b/g) ?? []) {
        if (manifest.some((m) => m.id === id)) {
          expect(Object.keys(ZH_OFFICIAL_DOCUMENTS), `${f}: ${id}`).toContain(id);
        }
      }
    }
  });
});
