// Ticino's form map: the order you fill it in (Modulo 4 for each person, Moduli 6 and 5, then
// Modulo 1's pages 2 to 4), the numbers as printed, one place per line and person on each page,
// every line labelled in Italian, glossed in English and French, and cited; Modulo 4's numbers are
// those rules-ti puts its lines on, and every line rules-ti computes has its place.
import { readFileSync } from 'node:fs';
import { MODULO4, RUBRICS, WEALTH_RUBRICS } from '@taxpresso/rules-ti';
import { describe, expect, it } from 'vitest';
import {
  FORM_TI_2025,
  FORM_TI_2026,
  TI_MODULO4_TOTAL,
  TI_PAGE_IDS,
  ticinoFormMap,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

/** Every manifest id in a source ("id p. 2 (...); other-id p. 10") is an ok entry, with a page. */
function expectCited(source: string, what: string) {
  expect(source, what).toMatch(/^ti-2025-form-modulo-(1-de|4|5|6) p\. \d/);
  for (const part of source.split(';')) {
    const [id, p, page] = part.trim().split(' ');
    expect(lock[id!]?.status, `${what}: ${id}`).toBe('ok');
    expect(`${p} ${page}`, `${what}: ${part}`).toMatch(/^p\. \d+/);
  }
}

describe('Ticino’s form map', () => {
  for (const form of [FORM_TI_2025, FORM_TI_2026]) {
    it(`${form.taxYear}: pages in the order you fill them in, each cited from the 2025 forms`, () => {
      expect(form.pages.map((p) => p.id)).toEqual([...TI_PAGE_IDS]);
      for (const p of form.pages) {
        expect(p.title, p.id).toMatch(new RegExp(String(form.taxYear)));
        expect(p.gloss.en && p.gloss.fr, p.id).toBeTruthy();
        expectCited(p.source, p.id);
        // Each page id fits get_form_values' section (at most 4 characters).
        expect(p.id.length, p.id).toBeLessThanOrEqual(4);
      }
      expect(form.pages.find((p) => p.id === 'M4-1')).toMatchObject({ person: 'A', pdfPage: 1 });
      expect(form.pages.find((p) => p.id === 'M4-2')).toMatchObject({ person: 'B', pdfPage: 2 });
    });

    it(`${form.taxYear}: every line labelled, glossed, placed and cited, no em dash`, () => {
      const seen = new Set<string>();
      for (const r of form.rubrics) {
        const where = `${r.page} ${r.key} ${r.person}`;
        expect(r.label, where).toBeTruthy();
        expect(r.gloss.en && r.gloss.fr, where).toBeTruthy();
        expect(`${r.label} ${r.gloss.en} ${r.gloss.fr}`, where).not.toMatch(/[–—]/);
        expect(r.label, where).not.toMatch(/\p{L}'\p{L}/u);
        const page = form.pages.find((p) => p.id === r.page)!;
        expect(
          page.sections.map((s) => s.id),
          where,
        ).toContain(r.section);
        expectCited(r.source, where);
        // One place per line and person on each page.
        const k = `${r.page}|${r.key}|${r.person}`;
        expect(seen.has(k), `${where} twice`).toBe(false);
        seen.add(k);
      }
    });
  }

  it('2026 uses the 2025 forms, flagged provisional with a note in every language', () => {
    expect(FORM_TI_2025.provisional).toBe(false);
    expect(FORM_TI_2026).toMatchObject({ taxYear: 2026, formYear: 2025, provisional: true });
    expect(FORM_TI_2026.note?.it).toMatch(/eTax PF 2026/);
    expect(() => ticinoFormMap(2024)).toThrow();
  });

  it('places Modulo 4 on the numbers rules-ti uses, each person on their side, and its totals', () => {
    for (const [code, r] of Object.entries(MODULO4)) {
      const n = Number(code);
      const page = n < 450 ? 'M4-1' : 'M4-2';
      const rubric = FORM_TI_2026.rubrics.find((x) => x.key === code);
      expect(rubric, code).toMatchObject({ page, person: page === 'M4-1' ? 'A' : 'B' });
      // The same line of Modulo 4 as rules-ti's label: led by the same cifra.
      expect(rubric!.label.split(' ')[0]!.replace(/\.$/, ''), code).toBe(r.label.it!.split(' ')[0]);
    }
    expect(TI_MODULO4_TOTAL).toEqual({ p1: '438', p2: '488' });
  });

  it('has a supported place for every line rules-ti computes, for each person who can have it', () => {
    const supported = new Set(
      FORM_TI_2026.rubrics.filter((r) => r.supported).map((r) => `${r.key}|${r.person}`),
    );
    const perPerson = new Set(['1.1', '1.2', '3.1', '3.2', '3.3', '3.4', '3.5']);
    for (const code of Object.keys(RUBRICS)) {
      const persons = perPerson.has(code)
        ? ['A', 'B']
        : ['9.1', '11.1', '15.3'].includes(code)
          ? ['A']
          : ['9.2', '11.2', '15.4'].includes(code)
            ? ['B']
            : ['household'];
      for (const p of persons) expect(supported.has(`${code}|${p}`), `${code} ${p}`).toBe(true);
    }
    for (const code of Object.keys(WEALTH_RUBRICS)) {
      expect(supported.has(`${code}|household`), code).toBe(true);
    }
  });
});
