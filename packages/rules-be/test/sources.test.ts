// Every constant cites a document of the sources library that was downloaded and checked
// (SPEC.md section 13, item 8b): each manifest id in a citation has status "ok" in
// docs/sources/lock.json and is followed by where to look (page, article, sheet or the part of a
// page). The citations written into the rules (the form's lines, the law's rules) too.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  beParamsFor,
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
