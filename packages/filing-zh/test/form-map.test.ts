// The Zurich form map: the order you fill it in, one place per code and person on each page,
// every line labelled in German as printed, glossed in English and French, and cited.
import { readFileSync } from 'node:fs';
import { RUBRICS } from '@taxpresso/rules-zh';
import { describe, expect, it } from 'vitest';
import { FORM_ZH_2025, FORM_ZH_2026, ZH_PAGE_IDS, zurichFormMap } from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

/** Every manifest id in a source ("id p. 2; other-id p. 10") is an ok entry of the library. */
function expectCited(source: string, what: string) {
  expect(source, what).toMatch(/^zh-[a-z0-9-]+ p\. \d/);
  for (const part of source.split(';')) {
    const id = part.trim().split(' ')[0]!;
    expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
  }
}

describe('the Zurich form map', () => {
  for (const form of [FORM_ZH_2025, FORM_ZH_2026]) {
    it(`${form.taxYear}: pages in the order you fill them in, each cited`, () => {
      expect(form.pages.map((p) => p.id)).toEqual([...ZH_PAGE_IDS]);
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
        expect(r.code, where).toBe(r.key);
        expect(r.key, where).toMatch(/^\d{3,4}$/);
        expect(r.label, where).toBeTruthy();
        expect(r.gloss.en && r.gloss.fr, where).toBeTruthy();
        expect(`${r.label} ${r.gloss.en} ${r.gloss.fr}`, where).not.toMatch(/—/);
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

  it('has a place for every line the Zurich engine computes', () => {
    const codes = new Set(FORM_ZH_2026.rubrics.filter((r) => r.supported).map((r) => r.key));
    for (const code of Object.keys(RUBRICS)) {
      // 188 and 421: property, not supported (the engine refuses it too).
      if (code === '188' || code === '421') continue;
      expect(codes, code).toContain(code);
    }
  });

  it('puts each line in the columns the form prints', () => {
    const at = (page: string, code: string) =>
      FORM_ZH_2026.rubrics.find((r) => r.page === page && r.key === code)!;
    expect(at('S2', '100').columns).toEqual(['amount']);
    expect(at('S3', '260').columns).toEqual(['icc', 'ifd']);
    expect(at('S3', '365').columns).toEqual(['ifd']);
    expect(at('S4', '400').columns).toEqual(['wealth']);
    expect(at('VP', '601').columns).toEqual(['amount']);
    expect(at('VP', '270').columns).toEqual(['icc', 'ifd']);
    expect(at('BA2', '240').person).toBe('B');
    expect(at('BA2', '221').label).toBe('Abonnementkosten für öffentliche Verkehrsmittel');
  });

  it('flags 2026 as provisional, the annexes being 2026’s', () => {
    expect(FORM_ZH_2025.provisional).toBe(false);
    expect(FORM_ZH_2026).toMatchObject({ taxYear: 2026, formYear: 2025, provisional: true });
    expect(FORM_ZH_2026.note?.en).toMatch(/2025 Zurich return/);
    const ba = FORM_ZH_2026.pages.find((p) => p.id === 'BA1')!;
    expect(ba.source).toBe('zh-2026-deductions-form-berufsauslagen p. 1');
    expect(FORM_ZH_2025.pages.find((p) => p.id === 'BA1')!.source).toBe(
      'zh-2025-form-berufsauslagen p. 1',
    );
    expect(() => zurichFormMap(2024)).toThrow(/No Zurich form map/);
  });
});
