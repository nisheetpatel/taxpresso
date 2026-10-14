// Every constant cites a document of the sources library that was downloaded and checked
// (SPEC.md section 13, item 8b): each manifest id in a citation has status "ok" in
// docs/sources/lock.json and is followed by where to look (a page, an article or the part of a
// document). The citations written into the rules (the return's lines, the laws' rules) too. A 2026
// constant cites 2026 documents or documents valid for every year (the ordinance, the Steuerbuch's
// chapters); a 2025 constant cites 2025 documents or those, and the Steuerbuch's list of the
// cantonal multipliers (Stand 2026), which gives every year's.
import { readFileSync } from 'node:fs';
import { ifdParamsFor } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  ASSESS_RULES,
  COMPUTE_RULES,
  ESTIMATE_TEXT,
  LAW_RULES,
  NOTE,
  RUBRICS,
  sgParamsFor,
  WEALTH_RUBRICS,
  type Cited,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

const ID = /\b(?:sg|ch)-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]/g;
/** Where to look in the document, right after its id. */
const PLACE = /^ (p\. \d|Art\. \d|\()/;
/** Valid for every year although filed under 2026: the list of every year's cantonal multiplier. */
const EVERY_YEAR = new Set(['sg-2026-tariff-kantonssteuerfuss']);

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
  const P = sgParamsFor(year);
  return [
    ['income tariff', P.income],
    ['wealth tariff', P.wealth],
    ['cantonal multiplier', P.multiplier],
    ['communes', P.communes],
    ['Christ Catholic rate', P.christCatholic],
    ...(Object.entries(P.amounts) as [string, Cited<unknown>][]),
  ];
}

const rulesOf = (year: 2025 | 2026): [string, Cited<unknown>][] =>
  [...ASSESS_RULES(year), ...COMPUTE_RULES(year), ...LAW_RULES(year)].map((r, i) => [
    `rule ${i}`,
    r,
  ]);

describe('citations', () => {
  for (const year of [2025, 2026] as const) {
    it(`every constant and rule of ${year}`, () => {
      for (const [name, c] of [...constants(year), ...rulesOf(year)]) {
        expectCited(c.source, `${year} ${name}`);
      }
    });

    it(`the ${year} constants cite ${year} documents, or documents valid for every year`, () => {
      const other = year === 2025 ? '2026' : '2025';
      for (const [name, c] of [...constants(year), ...rulesOf(year)]) {
        const foreign = (c.source.match(ID) ?? []).filter(
          (id) => id.includes(`-${other}-`) && !EVERY_YEAR.has(id),
        );
        expect(foreign, `${year} ${name}`).toEqual([]);
      }
    });
  }

  it('every line of the return', () => {
    for (const [code, r] of Object.entries(RUBRICS)) expectCited(r.source, code);
    for (const [code, r] of Object.entries(WEALTH_RUBRICS)) expectCited(r.source, `wealth ${code}`);
  });

  it('the pillar 3a limits and the meal rates are the federal ones (StG Art. 45, StV Art. 19)', () => {
    for (const year of [2025, 2026] as const) {
      const A = sgParamsFor(year).amounts;
      expect(A.pillar3a.value).toEqual(ifdParamsFor(year).pillar3a.value);
      expect(A.meals.value).toEqual(ifdParamsFor(year).meals.value);
    }
  });

  it('the texts shown to the user have no en or em dash (CLAUDE.md, user-facing copy)', () => {
    for (const [name, text] of Object.entries({ ...NOTE, ...ESTIMATE_TEXT })) {
      expect(`${text.en} ${text.fr}`, name).not.toMatch(/[–—]/);
    }
    for (const year of [2025, 2026] as const) {
      for (const [name, c] of constants(year)) expect(c.source, name).not.toMatch(/[–—]/);
    }
  });
});
