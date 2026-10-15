// The Aargau form map: the guide's sections in the order it explains them, one place per code and
// person on each page, every line labelled in German as the guide names it, glossed in English and
// French, cited, and flagged provisional (the main form 101.01 isn't published).
import { readFileSync } from 'node:fs';
import { RUBRICS, WEALTH_FREE } from '@taxpresso/rules-ag';
import { describe, expect, it } from 'vitest';
import { AG_PAGE_IDS, aargauFormMap, FORM_AG_2025, FORM_AG_2026 } from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

/** Every manifest id in a source is an ok entry of the library, the guide first with its page. */
function expectCited(source: string, what: string) {
  expect(source, what).toMatch(/^ag-2025-guide-wegleitung p\. \d/);
  for (const part of source.split(';')) {
    const id = part.trim().split(' ')[0]!;
    expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
  }
}

describe('the Aargau form map', () => {
  for (const form of [FORM_AG_2025, FORM_AG_2026]) {
    it(`${form.taxYear}: pages in the guide’s order, each cited`, () => {
      expect(form.pages.map((p) => p.id)).toEqual([...AG_PAGE_IDS]);
      for (const p of form.pages) {
        expect(p.title, p.id).toMatch(new RegExp(String(form.taxYear)));
        expect(p.gloss.en && p.gloss.fr, p.id).toBeTruthy();
        expectCited(p.source, p.id);
        expect(p.id.length, p.id).toBeLessThanOrEqual(4);
      }
    });

    it(`${form.taxYear}: every line labelled, glossed, placed and cited, no em dash`, () => {
      const seen = new Set<string>();
      for (const r of form.rubrics) {
        const where = `${r.page} ${r.key} ${r.person}`;
        expect(r.label, where).toBeTruthy();
        expect(r.gloss.en && r.gloss.fr, where).toBeTruthy();
        expect(`${r.label} ${r.gloss.en} ${r.gloss.fr}`, where).not.toMatch(/[–—]/);
        const page = form.pages.find((p) => p.id === r.page)!;
        expect(
          page.sections.map((s) => s.id),
          where,
        ).toContain(r.section);
        expectCited(r.source, where);
        const k = `${r.page}|${r.key}|${r.person}`;
        expect(seen.has(k), `${where} twice`).toBe(false);
        seen.add(k);
      }
    });
  }

  it('has a place for every line the Aargau engine computes, for each person', () => {
    for (const form of [FORM_AG_2025, FORM_AG_2026]) {
      const supported = form.rubrics.filter((r) => r.supported);
      for (const code of Object.keys(RUBRICS)) {
        const at = supported.filter((r) => r.key === code);
        expect(at.length, `${form.taxYear} ${code}`).toBeGreaterThan(0);
        expect(
          at.every((r) => r.columns.length === 1),
          code,
        ).toBe(true);
      }
      for (const code of WEALTH_FREE) {
        expect(supported.find((r) => r.key === code)?.columns, code).toEqual(['wealth']);
      }
    }
  });

  it('puts the per-person lines in Person 1 and Person 2, the household’s once, in one column', () => {
    const at = (key: string) => FORM_AG_2026.rubrics.filter((r) => r.key === key);
    expect(at('1.1').map((r) => [r.person, r.label])).toEqual([
      ['A', 'Haupterwerb, Person 1'],
      ['B', 'Haupterwerb, Person 2'],
    ]);
    expect(at('14').map((r) => r.person)).toEqual(['household']);
    expect(at('14')[0]).toMatchObject({ role: 'computed', columns: ['amount'] });
    expect(at('20.1')[0]).toMatchObject({ columns: ['wealth'], role: 'report' });
    expect(at('20.1')[0]!.source).toMatch(/101\.05 Wertschriften/);
    expect(at('10.1')[0]!.source).toMatch(/101\.02 Berufskosten/);
    expect(at('17.1')[0]!.source).toMatch(/101\.06 Krankheits/);
    expect(at('19.1')[0]!.gloss.en).toMatch(/Ziffer 22\.1/);
    expect(at('2')[0]!.supported).toBe(false);
    expect(at('einkuenfte')[0]!.code).toBeUndefined();
    expect(at('25')[0]).toMatchObject({ code: '25', role: 'total' });
  });

  it('is provisional for both years and says to check the codes against the form or eTAX AARGAU', () => {
    for (const form of [FORM_AG_2025, FORM_AG_2026]) {
      expect(form.provisional).toBe(true);
      expect(form.note?.en).toMatch(/101\.01/);
      expect(form.note?.en).toMatch(/Check each code against your form or eTAX AARGAU/);
      expect(form.note?.de).toMatch(/eTAX AARGAU/);
    }
    expect(FORM_AG_2026.formYear).toBe(2025);
    expect(aargauFormMap(2026)).toBe(FORM_AG_2026);
    expect(() => aargauFormMap(2027)).toThrow(/No Aargau form map/);
  });
});
