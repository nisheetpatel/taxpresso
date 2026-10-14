// The Basel-Landschaft form map: the order you fill it in, one place per code and person on each
// page, every line labelled in German as printed, glossed in English and French, and cited.
import { readFileSync } from 'node:fs';
import { FEDERAL_SOCIAL, RUBRICS, WEALTH_RUBRICS } from '@taxpresso/rules-bl';
import { describe, expect, it } from 'vitest';
import { BL_PAGE_IDS, baselLandFormMap, FORM_BL_2025, FORM_BL_2026 } from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

/** Every manifest id in a source ("id p. 2; other-id p. 10") is an ok entry of the library. */
function expectCited(source: string, what: string) {
  expect(source, what).toMatch(/^bl-\d{4}-steuererklaerung-form p\. \d/);
  for (const part of source.split(';')) {
    const id = part.trim().split(' ')[0]!;
    expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
  }
}

describe('the Basel-Landschaft form map', () => {
  for (const form of [FORM_BL_2025, FORM_BL_2026]) {
    it(`${form.taxYear}: pages in the order you fill them in, each cited from the year’s return`, () => {
      expect(form.pages.map((p) => p.id)).toEqual([...BL_PAGE_IDS]);
      for (const p of form.pages) {
        expect(p.title, p.id).toMatch(new RegExp(String(form.taxYear)));
        expect(p.gloss.en && p.gloss.fr, p.id).toBeTruthy();
        expectCited(p.source, p.id);
        expect(p.source, p.id).toMatch(new RegExp(`^bl-${form.taxYear}-`));
      }
    });

    it(`${form.taxYear}: every line labelled, glossed, placed and cited, no em dash`, () => {
      const seen = new Set<string>();
      for (const r of form.rubrics) {
        const where = `${r.page} ${r.key}`;
        expect(r.code, where).toMatch(/^\d{3}$/);
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

  it('has a place for every line the Basel-Landschaft engine computes, in each column', () => {
    for (const form of [FORM_BL_2025, FORM_BL_2026]) {
      const codes = new Set(form.rubrics.filter((r) => r.supported).map((r) => r.key));
      for (const code of [...Object.keys(RUBRICS), ...Object.keys(WEALTH_RUBRICS)]) {
        // 771 is the 2026 return's only.
        if (code === '771' && form.taxYear === 2025) continue;
        expect(codes, `${form.taxYear} ${code}`).toContain(code);
      }
      for (const code of FEDERAL_SOCIAL) {
        expect(form.rubrics.find((r) => r.key === code)?.columns, code).toEqual(['ifd']);
      }
    }
    expect(FORM_BL_2025.rubrics.some((r) => r.key === '771')).toBe(false);
  });

  it('puts each line in the columns the form prints', () => {
    const at = (code: string) => FORM_BL_2026.rubrics.find((r) => r.key === code)!;
    expect(at('100').columns).toEqual(['amount']);
    expect(at('105').person).toBe('B');
    expect(at('399').columns).toEqual(['amount']);
    expect(at('399-uebertrag')).toMatchObject({ code: '399', columns: ['icc', 'ifd'] });
    expect(at('499').columns).toEqual(['icc', 'ifd']);
    expect(at('610').columns).toEqual(['icc', 'ifd']);
    expect(at('770').columns).toEqual(['icc']);
    expect(at('770').label).toBe('für AHV-Rentnerinnen/Rentner');
    expect(FORM_BL_2025.rubrics.find((r) => r.key === '770')?.label).toBe(
      'für AHV-/IV-Rentnerinnen/Rentner',
    );
    expect(at('790').columns).toEqual(['icc', 'ifd']);
    expect(at('800').columns).toEqual(['wealth']);
    expect(at('831').supported).toBe(false);
  });

  it('flags 2026 as provisional: the return of 20 March 2026, before the one mailed in 2027', () => {
    expect(FORM_BL_2025.provisional).toBe(false);
    expect(FORM_BL_2026).toMatchObject({ taxYear: 2026, formYear: 2026, provisional: true });
    expect(FORM_BL_2026.note?.en).toMatch(/20 March 2026/);
    expect(baselLandFormMap(2026)).toBe(FORM_BL_2026);
    expect(() => baselLandFormMap(2027)).toThrow(/No Basel-Landschaft form map/);
  });
});
