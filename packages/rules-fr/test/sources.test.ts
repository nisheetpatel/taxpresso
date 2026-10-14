// Every constant cites a document of the sources library that was downloaded and checked
// (SPEC.md section 13, item 8b): each manifest id in a citation has status "ok" in
// docs/sources/lock.json and is followed by where to look (page, article, sheet or the part of a
// document). The citations written into the rules (the return's lines, the laws' rules) too. A 2026
// constant cites 2026 documents, or documents valid for every year, or the LICD in its version in
// force from 2025, which the BDLF lists as current in 2026 (docs/sources/fr/manifest.json).
import { readFileSync } from 'node:fs';
import { ifdParamsFor } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  ASSESS_RULES,
  COMPUTE_RULES,
  frParamsFor,
  NOTE,
  RUBRICS,
  WEALTH_RUBRICS,
  type Cited,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

const ID = /\b(?:fr|ch)-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]/g;
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

function constants(year: 2025 | 2026): [string, Cited<unknown>][] {
  const P = frParamsFor(year);
  return [
    ['income scale', P.incomeScale],
    ['wealth scale', P.wealthScale],
    ['coefficients', P.coefficients],
    ['communes', P.communes],
    ...(Object.entries(P.amounts) as [string, Cited<unknown>][]),
  ];
}

/** The LICD version in force from 2025, which also governs 2026. */
const LAW_2025 = 'fr-2025-law-licd-consolidee';

describe('citations', () => {
  for (const year of [2025, 2026] as const) {
    it(`every constant of ${year}`, () => {
      const rules = [...ASSESS_RULES(year), ...COMPUTE_RULES()];
      for (const [name, c] of constants(year)) expectCited(c.source, `${year} ${name}`);
      rules.forEach((c, i) => expectCited(c.source, `${year} rule ${i}`));
    });
  }

  it('the 2026 constants cite 2026 documents, documents of every year, or the LICD from 2025', () => {
    for (const [name, c] of constants(2026)) {
      const ids = c.source.match(ID) ?? [];
      const foreign = ids.filter((id) => id.includes('-2025-') && id !== LAW_2025);
      expect(foreign, name).toEqual([]);
    }
  });

  it('every line of the return', () => {
    for (const [code, r] of Object.entries(RUBRICS)) expectCited(r.source, code);
    for (const [code, r] of Object.entries(WEALTH_RUBRICS)) expectCited(r.source, `wealth ${code}`);
  });

  it('the pillar 3a limits are the federal ones', () => {
    for (const year of [2025, 2026] as const) {
      expect(frParamsFor(year).amounts.pillar3a.value).toEqual(ifdParamsFor(year).pillar3a.value);
    }
  });

  it('the texts shown to the user have no en or em dash (CLAUDE.md, user-facing copy)', () => {
    for (const [name, text] of Object.entries(NOTE)) {
      expect(`${text.en} ${text.fr}`, name).not.toMatch(/[–—]/);
    }
  });
});
