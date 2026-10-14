// The Fribourg form map: the codes of the return in their order, the annexes that carry to it first,
// one place per code and part, every line labelled in French as the guide heads it, glossed in
// English and French, and cited; flagged provisional (the return itself is not in the library).
import { readFileSync } from 'node:fs';
import { RUBRICS, WEALTH_RUBRICS } from '@taxpresso/rules-fr';
import { describe, expect, it } from 'vitest';
import { FORM_FR_2025, FORM_FR_2026, FR_PAGE_IDS, fribourgFormMap } from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

/** Every source is the 2025 guide, with its page, an ok entry of the library. */
function expectCited(source: string, what: string) {
  expect(source, what).toMatch(/^fr-2025-guide-instructions-generales p\. \d/);
  expect(source, what).not.toMatch(/\?/);
  for (const part of source.split(';')) {
    const id = part.trim().split(' ')[0]!;
    expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
  }
}

describe('the Fribourg form map', () => {
  for (const form of [FORM_FR_2025, FORM_FR_2026]) {
    it(`${form.taxYear}: the annexes that carry to the return first, the chapters' codes, the rest`, () => {
      expect(form.pages.map((p) => p.id)).toEqual([...FR_PAGE_IDS]);
      for (const p of form.pages) {
        expect(p.title, p.id).toMatch(new RegExp(String(form.taxYear)));
        expect(p.gloss.en && p.gloss.fr, p.id).toBeTruthy();
        expectCited(p.source, p.id);
      }
      expect(form.pages.filter((p) => !p.supported).map((p) => p.id)).toEqual([
        'DP',
        'A03',
        'A04',
        'A05',
        'A06',
      ]);
    });

    it(`${form.taxYear}: every line labelled, glossed, placed and cited, no em dash`, () => {
      const seen = new Set<string>();
      for (const r of form.rubrics) {
        const where = `${r.page} ${r.key}`;
        expect(r.code, where).toMatch(/^(\d\.\d{3}|0[1-6]|[A-E])$/);
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
      // The codes 1.110 to 7.910 in the return's order.
      const codes = form.rubrics.map((r) => r.code!).filter((c) => /^\d\.\d{3}$/.test(c));
      expect(codes).toEqual([...codes].sort());
      expect(codes[0]).toBe('1.110');
      expect(codes.at(-1)).toBe('7.910');
    });
  }

  it('has a place for every line the Fribourg engine computes', () => {
    for (const form of [FORM_FR_2025, FORM_FR_2026]) {
      const codes = new Set(form.rubrics.filter((r) => r.supported).map((r) => r.key));
      for (const code of [...Object.keys(RUBRICS), ...Object.keys(WEALTH_RUBRICS)]) {
        expect(codes, `${form.taxYear} ${code}`).toContain(code);
      }
    }
  });

  it('puts each line in its column and on the persons’ parts', () => {
    const at = (key: string) => FORM_FR_2026.rubrics.filter((r) => r.key === key);
    expect(at('1.110')[0]!.parts).toEqual(['A', 'B']);
    expect(at('2.510')[0]!.parts).toBeUndefined();
    expect(at('3.210')[0]!).toMatchObject({ columns: ['icc', 'wealth'], role: 'report' });
    expect(at('3.230')[0]!.columns).toEqual(['wealth']);
    expect(at('4.110')[0]!.role).toBe('computed');
    expect(at('7.910')[0]!).toMatchObject({ columns: ['icc', 'wealth'], role: 'total' });
    expect(at('A01-F')[0]!.columns).toEqual(['wealth']);
    expect(at('1.210')[0]!.supported).toBe(false);
    expect(at('3.310')[0]!.supported).toBe(false);
    expect(at('6.120')[0]!.supported).toBe(false);
  });

  it('flags both years as provisional: the guide’s codes, not the printed return', () => {
    expect(FORM_FR_2025).toMatchObject({ taxYear: 2025, formYear: 2025, provisional: true });
    expect(FORM_FR_2026).toMatchObject({ taxYear: 2026, formYear: 2025, provisional: true });
    expect(FORM_FR_2025.note?.en).toMatch(/doesn’t have the return itself/);
    expect(FORM_FR_2026.note?.en).toMatch(/2026 guide and FriTax 2026 are not published/);
    expect(FORM_FR_2026.note?.de).toBeTruthy();
    expect(fribourgFormMap(2026)).toBe(FORM_FR_2026);
    expect(() => fribourgFormMap(2027)).toThrow(/No Fribourg form map/);
  });
});
