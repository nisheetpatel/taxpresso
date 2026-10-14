// Every constant cites a document of the sources library that was downloaded and checked
// (SPEC.md section 13, item 8b): each manifest id in a citation has status "ok" in
// docs/sources/lock.json and is followed by where to look (page, paragraph, sheet or the part of a
// document). The citations written into the rules (the return's lines, the laws' rules) too. A 2026
// constant cites 2026 documents or documents valid for every year (the StG Stand 2023, the
// Steuerbuch, the Steuerfussdekret); a 2025 constant cites 2025 documents or those.
import { readFileSync } from 'node:fs';
import { ifdParamsFor } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  ASSESS_RULES,
  blParamsFor,
  COMPUTE_RULES,
  ESTIMATE_TEXT,
  NOTE,
  RUBRICS,
  WEALTH_RUBRICS,
  type Cited,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

const ID = /\b(?:bl|ch)-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]/g;
/** Where to look in the document, right after its id. */
const PLACE = /^ (p\. \d|§ \d|sheet \S|\()/;

function expectCited(source: string, what: string) {
  const ids = source.match(ID) ?? [];
  expect(ids.length, `${what}: "${source}"`).toBeGreaterThan(0);
  for (const id of ids) {
    expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
    const after = source.slice(source.indexOf(id) + id.length);
    expect(after, `${what}: ${id} without a page, paragraph, sheet or part`).toMatch(PLACE);
  }
}

function constants(year: 2025 | 2026): [string, Cited<unknown>][] {
  const P = blParamsFor(year);
  return [
    ['income tariff', P.income],
    ['wealth tariff', P.wealth],
    ['cantonal multiplier', P.multiplier],
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

    it(`the ${year} constants cite ${year} documents, or documents valid for every year`, () => {
      const other = year === 2025 ? '2026' : '2025';
      const rules = [...ASSESS_RULES(year), ...COMPUTE_RULES(year)].map(
        (r, i): [string, Cited<unknown>] => [`rule ${i}`, r],
      );
      for (const [name, c] of [...constants(year), ...rules]) {
        const foreign = (c.source.match(ID) ?? []).filter((id) => id.includes(`-${other}-`));
        expect(foreign, `${year} ${name}`).toEqual([]);
      }
    });
  }

  it('every line of the return', () => {
    for (const [code, r] of Object.entries(RUBRICS)) expectCited(r.source, code);
    for (const [code, r] of Object.entries(WEALTH_RUBRICS)) expectCited(r.source, `wealth ${code}`);
  });

  it('the cantonal multiplier is the Steuerfussdekret’s paragraph of the year', () => {
    expect(blParamsFor(2025).multiplier.source).toContain('bl-na-law-steuerfussdekret-331-2 § 17');
    expect(blParamsFor(2026).multiplier.source).toContain('bl-na-law-steuerfussdekret-331-2 § 18');
  });

  it('the pillar 3a limits printed by the canton are the federal ones', () => {
    for (const year of [2025, 2026] as const) {
      expect(blParamsFor(year).amounts.pillar3a.value).toEqual(ifdParamsFor(year).pillar3a.value);
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
