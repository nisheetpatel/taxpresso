// Every constant cites a document of the sources library that was downloaded and checked
// (SPEC.md section 13, item 8b): each manifest id in a citation has status "ok" in
// docs/sources/lock.json and is followed by where to look (page, paragraph). The citations written
// into the rules (the form's lines, the law's rules) too.
import { readdirSync, readFileSync } from 'node:fs';
import { ifdParamsFor } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  churchShares,
  ESTIMATE_TEXT,
  FEDERAL_NOTE,
  FEDERAL_RUBRICS,
  familyTariff,
  FORM_ORDER,
  LU_OFFICIAL_DOCUMENTS,
  LU_TERMS,
  luKeys,
  NOTE,
  luParamsFor,
  maxBurden,
  multipliers,
  personalTax,
  RUBRICS,
  sharedChildren,
  tariffSteps,
  WEALTH_RUBRICS,
  type Cited,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

const ID = /\b(?:lu|ch)-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]/g;
/** Where to look in the document, right after its id. */
const PLACE = /^ (p\. \d|§ \d)/;

function expectCited(source: string, what: string) {
  const ids = source.match(ID) ?? [];
  expect(ids.length, `${what}: "${source}"`).toBeGreaterThan(0);
  for (const id of ids) {
    expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
    const after = source.slice(source.indexOf(id) + id.length);
    expect(after, `${what}: ${id} without a page or paragraph`).toMatch(PLACE);
  }
}

describe('citations', () => {
  for (const year of [2025, 2026] as const) {
    const P = luParamsFor(year);
    const own: [string, Cited<unknown>][] = [
      ['income single', P.incomeTariff.single],
      ['income family', P.incomeTariff.family],
      ['wealth', P.wealthTariff],
      ['state units', P.stateUnits],
      ['Christ Catholic units', P.christCatholicUnits],
      ['communes', P.communes],
      ...(Object.entries(P.amounts) as [string, Cited<unknown>][]),
    ];

    it(`every constant of ${year}`, () => {
      const all: [string, Cited<unknown>][] = [
        ...own,
        ['multipliers', multipliers(year)],
        ['tariff steps', tariffSteps(year)],
        ['maximum burden', maxBurden(year)],
        ['personal tax', personalTax(year)],
        ['church shares', churchShares(year)],
        ['family tariff', familyTariff(year)],
        ['shared children', sharedChildren(year)],
      ];
      for (const [name, c] of all) expectCited(c.source, `${year} ${name}`);
    });

    it(`the ${year} constants cite ${year} documents (or documents valid for every year)`, () => {
      const other = year === 2025 ? '2026' : '2025';
      for (const [name, c] of own) {
        for (const id of c.source.match(ID) ?? []) {
          expect(id.includes(`-${other}-`), `${year} ${name}: ${id}`).toBe(false);
        }
      }
    });
  }

  it('every line of the return and of the Ergänzungsblatt, and the form’s order has each line once', () => {
    for (const [code, r] of Object.entries({ ...RUBRICS, ...WEALTH_RUBRICS, ...FEDERAL_RUBRICS })) {
      expectCited(r.source, code);
    }
    expect([...FORM_ORDER].sort()).toEqual(
      [...Object.keys(RUBRICS), ...Object.keys(WEALTH_RUBRICS)].sort(),
    );
  });

  it('pillar 3a: the federal limits are the ones the guides print (7,258; 20 %, 36,288)', () => {
    // lu-2025-guide-wegleitung p. 30, lu-2026-guide-wegleitung-unterjaehrig p. 30.
    for (const year of [2025, 2026]) {
      expect(luParamsFor(year).amounts.pillar3a.value).toEqual({
        withFund: 725_800,
        withoutFundMax: 3_628_800,
        withoutFundShareBp: 2000,
      });
      expect(luParamsFor(year).amounts.pillar3a.value).toEqual(ifdParamsFor(year).pillar3a.value);
    }
  });

  it('the amounts that changed from 2025 to 2026, as the canton’s tables give them', () => {
    // lu-2025-tariff-tariftabellen-abzuege p. 2 and lu-2026-tariff-tariftabellen-abzuege p. 2:
    // child 8,000 -> 8,100; childcare 18,000 -> 18,200 on top of own care; degressive limits
    // 50,000 / 80,000 -> 50,400 / 80,700. lu-2026-deductions-steuerbuch-band1 p. 97: car 0.75.
    const a = luParamsFor(2025).amounts;
    const b = luParamsFor(2026).amounts;
    expect([a.child.value.base, b.child.value.base]).toEqual([800_000, 810_000]);
    expect([
      a.childcareMax.value - a.ownCare.value,
      b.childcareMax.value - b.ownCare.value,
    ]).toEqual([1_800_000, 1_820_000]);
    expect([a.degressive.value.single, b.degressive.value.single]).toEqual([5_000_000, 5_040_000]);
    expect([a.degressive.value.family, b.degressive.value.family]).toEqual([8_000_000, 8_070_000]);
    expect([a.commuteKm.value.car, b.commuteKm.value.car]).toEqual([70, 75]);
    // StV § 14b: each parent's maximum, own care included, and both parents' childcare together.
    expect([a.sharedCare.value.max, b.sharedCare.value.max]).toEqual([1_000_000, 1_010_000]);
    expect(a.sharedCare.value.thirdPartyTotal).toBe(
      2 * (a.sharedCare.value.max - a.sharedCare.value.own),
    );
    expect(b.sharedCare.value.thirdPartyTotal).toBe(
      2 * (b.sharedCare.value.max - b.sharedCare.value.own),
    );
  });
});

describe('the keys, the terms and the texts', () => {
  it('every key Lucerne defines, and the page to ask for more time', () => {
    for (const year of [2025, 2026] as const) {
      for (const [key, def] of Object.entries(luKeys(year))) {
        if (key.startsWith('lu.') || key === 'profile.commune' || key === 'profile.moved') {
          expectCited(def.source ?? '', `${year} key ${key}`);
        }
      }
    }
    expectCited(LU_TERMS.moreTimeSource, 'more time');
  });

  it('the texts shown to the user have no en or em dash (CLAUDE.md, user-facing copy)', () => {
    for (const [name, text] of Object.entries({ ...NOTE, ...ESTIMATE_TEXT, ...FEDERAL_NOTE })) {
      expect(`${text.en} ${text.fr}`, name).not.toMatch(/[–—]/);
    }
    for (const [code, r] of Object.entries(FEDERAL_RUBRICS)) {
      expect(`${r.label.en} ${r.label.fr} ${r.label.de}`, code).not.toMatch(/[–—]/);
    }
  });
});

describe('the official Lucerne documents linked', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../../../docs/sources/lu/manifest.json', import.meta.url), 'utf8'),
  ) as { id: string; title: string; url: string; format: string }[];

  it('are the manifest’s, title and link', () => {
    expect(Object.keys(LU_OFFICIAL_DOCUMENTS).sort()).toEqual(manifest.map((m) => m.id).sort());
    for (const [id, doc] of Object.entries(LU_OFFICIAL_DOCUMENTS)) {
      const m = manifest.find((x) => x.id === id)!;
      expect(doc, id).toEqual({ title: m.title, url: m.url, pdf: m.format === 'pdf' });
    }
  });

  it('cover every Lucerne document the rules cite', () => {
    const dir = new URL('../src/', import.meta.url);
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) =>
      f.endsWith('.ts'),
    );
    for (const f of files) {
      const text = readFileSync(new URL(f, dir), 'utf8');
      for (const id of text.match(/\blu-(?:\d{4}|na)-[a-z0-9-]+[a-z0-9]\b/g) ?? []) {
        expect(Object.keys(LU_OFFICIAL_DOCUMENTS), `${f}: ${id}`).toContain(id);
      }
    }
  });
});
