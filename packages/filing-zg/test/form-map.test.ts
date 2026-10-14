// Zug's form K map: the order you fill it in, one place per code and person on each page, every line
// labelled in German as printed, glossed in English and French, and cited.
import { readFileSync } from 'node:fs';
import { FEDERAL_SOCIAL, RUBRICS, WEALTH_RUBRICS } from '@taxpresso/rules-zg';
import { describe, expect, it } from 'vitest';
import { FORM_ZG_2025, FORM_ZG_2026, ZG_PAGE_IDS, zugFormMap } from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

/** Every manifest id in a source ("id p. 2; other-id p. 10") is an ok entry of the library. */
function expectCited(source: string, what: string) {
  expect(source, what).toMatch(/^zg-2025-guide-wegleitung p\. 1[789] \(Mustersteuererklärung/);
  for (const part of source.split(';')) {
    const id = part.trim().split(' ')[0]!;
    expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
  }
}

describe('Zug’s form K map', () => {
  for (const form of [FORM_ZG_2025, FORM_ZG_2026]) {
    it(`${form.taxYear}: pages in the order you fill them in, each cited from the 2025 form K`, () => {
      expect(form.pages.map((p) => p.id)).toEqual([...ZG_PAGE_IDS]);
      for (const p of form.pages) {
        expect(p.title, p.id).toMatch(new RegExp(String(form.taxYear)));
        expect(p.gloss.en && p.gloss.fr, p.id).toBeTruthy();
        expectCited(p.source, p.id);
      }
    });

    it(`${form.taxYear}: every line labelled, glossed, placed and cited, no em dash`, () => {
      const seen = new Set<string>();
      for (const r of form.rubrics) {
        const where = `${r.page} ${r.key}`;
        expect(r.code, where).toMatch(/^\d{3}(a|-1)?$/);
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

  it('has a place for every line the Zug engine computes, in each column', () => {
    for (const form of [FORM_ZG_2025, FORM_ZG_2026]) {
      const codes = new Set(form.rubrics.filter((r) => r.supported).map((r) => r.key));
      for (const code of [...Object.keys(RUBRICS), ...Object.keys(WEALTH_RUBRICS)]) {
        // Property and qualifying participations: listed for the guide's sample, never computed.
        if (['181', '410', '610'].includes(code)) continue;
        expect(codes, `${form.taxYear} ${code}`).toContain(code);
      }
      for (const code of FEDERAL_SOCIAL) {
        expect(form.rubrics.find((r) => r.key === code)?.columns, code).toContain('ifd');
      }
    }
  });

  it('puts each line in the columns the form prints', () => {
    const at = (code: string) => FORM_ZG_2026.rubrics.find((r) => r.key === code)!;
    expect(at('100').columns).toEqual(['icc', 'ifd']);
    expect(at('101').person).toBe('B');
    expect(at('190').columns).toEqual(['icc', 'ifd']);
    expect(at('220').columns).toEqual(['icc', 'ifd']);
    expect(at('400').columns).toEqual(['icc']);
    expect(at('401').columns).toEqual(['ifd']);
    expect(at('403').columns).toEqual(['icc', 'ifd']);
    expect(at('407').columns).toEqual(['icc']);
    expect(at('490').columns).toEqual(['icc', 'ifd']);
    expect(at('600').columns).toEqual(['wealth']);
    expect(at('610').supported).toBe(false);
    expect(at('115').supported).toBe(false);
  });

  it('flags 2026 as provisional: the 2025 form K until the 2026 forms are published', () => {
    expect(FORM_ZG_2025.provisional).toBe(false);
    expect(FORM_ZG_2026).toMatchObject({ taxYear: 2026, formYear: 2025, provisional: true });
    expect(FORM_ZG_2026.note?.en).toMatch(/2025 form K/);
    expect(zugFormMap(2026)).toBe(FORM_ZG_2026);
    expect(() => zugFormMap(2027)).toThrow(/No Zug form map/);
  });
});
