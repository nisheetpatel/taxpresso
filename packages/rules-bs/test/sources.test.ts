// Every constant cites a document of the sources library that was downloaded and checked
// (SPEC.md section 13, item 8b): each manifest id in a citation has status "ok" in
// docs/sources/lock.json and is followed by where to look (page, paragraph, article or the part of
// a page). The citations written into the rules (the form's lines, the laws' rules) too. A 2026
// constant cites 2026 documents, or documents valid for every year; a 2025 constant cites 2025
// documents, except the few that name a later document on purpose (listed below, with why).
import { readFileSync } from 'node:fs';
import { ifdParamsFor } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  ASSESS_RULES,
  bsParamsFor,
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

const ID = /\b(?:bs|ch)-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]/g;
/** Where to look in the document, right after its id. */
const PLACE = /^ (p\. \d|pp\. \d|§ \d|art\. \d|\()/;

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
  const P = bsParamsFor(year);
  return [
    ['income tariff A', P.income.A],
    ['income tariff B', P.income.B],
    ['wealth tariff A', P.wealth.A],
    ['wealth tariff B', P.wealth.B],
    ['communes', P.communes],
    ...(Object.entries(P.amounts) as [string, Cited<unknown>][]),
  ];
}

/**
 * Later documents a 2025 constant may name: the overview of the income tariffs covers 2018 to 2026;
 * the 2026 table prints the 2025 yield factor as final (the 2025 table, as provisional).
 */
const LATER_FOR_2025 = new Set([
  'bs-2026-tariff-einkommenssteuer-uebersicht',
  'bs-2026-communal-ansaetze-abzuege',
]);

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
        const allowed = year === 2025 ? foreign.filter((id) => LATER_FOR_2025.has(id)) : [];
        expect(foreign, `${year} ${name}`).toEqual(allowed);
      }
    });
  }

  it('the 2025 yield factor is the 2026 table’s final value; 2026’s is flagged provisional', () => {
    expect(bsParamsFor(2025).amounts.securitiesFactor.source).toContain(
      'bs-2026-communal-ansaetze-abzuege p. 2 (Kapitalisierungssatz Wertschriften, column 2025)',
    );
    expect(bsParamsFor(2025).amounts.securitiesFactor.estimate).toBeUndefined();
    expect(bsParamsFor(2026).amounts.securitiesFactor.estimate).toBe('bs-2026-provisional');
    for (const year of [2025, 2026] as const) {
      for (const [name, c] of Object.entries(bsParamsFor(year).amounts)) {
        if (name !== 'securitiesFactor') expect('estimate' in c, `${year} ${name}`).toBe(false);
      }
    }
  });

  it('every line of the return', () => {
    for (const [code, r] of Object.entries(RUBRICS)) expectCited(r.source, code);
    for (const [code, r] of Object.entries(WEALTH_RUBRICS)) expectCited(r.source, `wealth ${code}`);
  });

  it('the pillar 3a limits printed by the canton are the federal ones', () => {
    for (const year of [2025, 2026] as const) {
      expect(bsParamsFor(year).amounts.pillar3a.value).toEqual(ifdParamsFor(year).pillar3a.value);
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
