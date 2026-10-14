// The Lucerne form map: the order the guide advises to fill it in, one place per code and person on
// each page, every line labelled in German as printed, glossed in English and French, and cited.
import { readFileSync } from 'node:fs';
import { FEDERAL_RUBRICS, RUBRICS, WEALTH_RUBRICS } from '@taxpresso/rules-lu';
import { describe, expect, it } from 'vitest';
import { FORM_LU_2025, FORM_LU_2026, LU_PAGE_IDS, lucerneFormMap } from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

/** Every manifest id in a source ("id p. 2; other-id p. 10") is an ok entry of the library. */
function expectCited(source: string, what: string) {
  expect(source, what).toMatch(
    /^(lu-2025-guide-wegleitung p\. 1[4-9] \(Beispiel|lu-2025-form-ergaenzungsblatt-dbst p\. 1 \()/,
  );
  for (const part of source.split(';')) {
    const id = part.trim().split(' ')[0]!;
    expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
  }
}

describe('the Lucerne form map', () => {
  for (const form of [FORM_LU_2025, FORM_LU_2026]) {
    it(`${form.taxYear}: pages in the order the guide advises, each cited from the 2025 forms`, () => {
      expect(form.pages.map((p) => p.id)).toEqual([...LU_PAGE_IDS]);
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
        expect(r.code, where).toMatch(/^(\d{3}t?|\d{1,2})$/);
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

  it('has a place for every line the Lucerne engine computes, and every line of the Ergänzungsblatt', () => {
    for (const form of [FORM_LU_2025, FORM_LU_2026]) {
      const codes = new Set(form.rubrics.filter((r) => r.supported).map((r) => r.key));
      for (const code of [
        ...Object.keys(RUBRICS),
        ...Object.keys(WEALTH_RUBRICS),
        ...Object.keys(FEDERAL_RUBRICS),
      ]) {
        expect(codes, `${form.taxYear} ${code}`).toContain(code);
      }
    }
  });

  it('puts each line in the column the form prints, and the Ergänzungsblatt in the federal one', () => {
    const at = (key: string) => FORM_LU_2026.rubrics.filter((r) => r.key === key);
    expect(at('100')[0]!.columns).toEqual(['icc']);
    expect(at('101')[0]!.person).toBe('B');
    expect(at('208t')[0]!.role).toBe('computed');
    expect(at('209t')[0]!.person).toBe('B');
    // Form B's total and page 3's line: the same Ziffer printed on both.
    expect(at('238').map((r) => `${r.page} ${r.role}`)).toEqual(['B total', 'S3 report']);
    expect(at('400')[0]!.columns).toEqual(['wealth']);
    expect(at('E13')[0]!.columns).toEqual(['ifd']);
    expect(at('E13')[0]!.code).toBe('13');
    expect(at('E23')[0]!.role).toBe('total');
    expect(at('E4')[0]!.supported).toBe(false);
    expect(at('420')[0]!.supported).toBe(false);
    expect(at('110')[0]!.supported).toBe(false);
  });

  it('flags 2026 as provisional: the 2025 forms until the 2026 ones are published', () => {
    expect(FORM_LU_2025.provisional).toBe(false);
    expect(FORM_LU_2026).toMatchObject({ taxYear: 2026, formYear: 2025, provisional: true });
    expect(FORM_LU_2026.note?.en).toMatch(/2025 Lucerne forms/);
    expect(lucerneFormMap(2026)).toBe(FORM_LU_2026);
    expect(() => lucerneFormMap(2027)).toThrow(/No Lucerne form map/);
  });
});
