// The Basel-Stadt form map: the order the guide says to fill it in, one place per key and person on
// each page, every line labelled in German as printed, glossed in English and French, and cited.
import { readFileSync } from 'node:fs';
import { FORM_B, FORM_W, RUBRICS, WEALTH_RUBRICS } from '@taxpresso/rules-bs';
import { describe, expect, it } from 'vitest';
import { BS_PAGE_IDS, FORM_BS_2025, FORM_BS_2026, baselFormMap, filing } from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

/** Every manifest id in a source ("id p. 2; other-id p. 10") is an ok entry of the library. */
function expectCited(source: string, what: string) {
  expect(source, what).toMatch(/^bs-[a-z0-9-]+ p\. \d/);
  for (const part of source.split(';')) {
    const id = part.trim().split(' ')[0]!;
    expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
  }
}

describe('the Basel-Stadt form map', () => {
  for (const form of [FORM_BS_2025, FORM_BS_2026]) {
    it(`${form.taxYear}: pages in the order the guide gives, each cited`, () => {
      expect(form.pages.map((p) => p.id)).toEqual([...BS_PAGE_IDS]);
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
        // A line of the main form is keyed by its code; an auxiliary form's line by its form.
        if (r.page.startsWith('H')) expect(r.key, where).toMatch(/^\d{3}$/);
        if (r.code && r.page.startsWith('H')) expect(r.code, where).toBe(r.key);
        expect(r.label, where).toBeTruthy();
        expect(r.gloss.en && r.gloss.fr, where).toBeTruthy();
        expect(`${r.label} ${r.gloss.en} ${r.gloss.fr}`, where).not.toMatch(/[—–]/);
        const page = form.pages.find((p) => p.id === r.page)!;
        expect(
          page.sections.map((s) => s.id),
          where,
        ).toContain(r.section);
        expectCited(r.source, where);
        expect(seen.has(r.key), `${where} twice`).toBe(false);
        seen.add(r.key);
      }
    });
  }

  it('has a place for every line the Basel-Stadt engine computes, and form B’s and W’s lines', () => {
    const keys = new Set(FORM_BS_2026.rubrics.filter((r) => r.supported).map((r) => r.key));
    for (const code of [...Object.keys(RUBRICS), ...Object.keys(WEALTH_RUBRICS)]) {
      // 479 and 821: property, not supported (the engine leaves them out).
      if (code === '479' || code === '821') continue;
      expect(keys, code).toContain(code);
    }
    for (const lines of [FORM_B.p1, FORM_B.p2]) {
      for (const code of Object.values(lines)) expect(keys, code).toContain(code);
    }
    for (const code of Object.values(FORM_W)) expect(keys, code).toContain(code);
  });

  it('puts each line in the columns the form prints', () => {
    const at = (key: string) => FORM_BS_2026.rubrics.find((r) => r.key === key)!;
    expect(at('100').columns).toEqual(['amount']);
    expect(at('100').person).toBe('A');
    expect(at('105').person).toBe('B');
    expect(at('369').columns).toEqual(['icc', 'ifd']);
    expect(at('620').columns).toEqual(['icc', 'ifd']);
    expect(at('632').columns).toEqual(['ifd']);
    expect(at('765').columns).toEqual(['icc']);
    expect(at('800').columns).toEqual(['wealth']);
    expect(at('500').columns).toEqual(['icc']);
    expect(at('516').columns).toEqual(['ifd']);
    expect(at('523').person).toBe('B');
    expect(at('B-539')).toMatchObject({ code: '539', page: 'B2', role: 'total' });
    expect(at('K-725')).toMatchObject({ code: '725', page: 'K', columns: ['icc', 'ifd'] });
    expect(at('W-10').label).toBe('Total Einkünfte aus Guthaben, Wertschriften und Lotterien');
  });

  it('flags 2026 as provisional, on the 2025 forms', () => {
    expect(FORM_BS_2025.provisional).toBe(false);
    expect(FORM_BS_2026).toMatchObject({ taxYear: 2026, formYear: 2025, provisional: true });
    expect(FORM_BS_2026.note?.en).toMatch(/2025 Basel-Stadt return/);
    expect(filing.formNote(2026)?.de).toMatch(/Basler Steuererklärung 2025/);
    expect(filing.formNote(2025)).toBeUndefined();
    expect(() => baselFormMap(2024)).toThrow(/No Basel-Stadt form map/);
  });

  it('orders the lines as the form does, and finds the line of a ledger value', () => {
    const order = filing.formOrder(2026);
    expect(order('W-1')!).toBeLessThan(order('503')!);
    expect(order('503')!).toBeLessThan(order('100')!);
    expect(order('100')!).toBeLessThan(order('620')!);
    expect(order('620')!).toBeLessThan(order('800')!);
    expect(filing.lineOf('pillar3a.paid', 'p2')).toBe('625');
    expect(filing.lineOf('medical.costs', 'household')).toBe('725');
    expect(filing.salaryLine('p1')).toBe('100');
    expect(filing.checksPdf).toBe(false);
  });
});
