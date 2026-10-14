// St. Gallen's form map: the order you fill it in (Form 4 for each person, then the return's pages 2
// to 4), the codes as printed, one place per code and person on each page, every line labelled in
// German as printed, led by its Ziffer, glossed in English and French, and cited.
import { readFileSync } from 'node:fs';
import { RUBRICS, WEALTH_RUBRICS } from '@taxpresso/rules-sg';
import { describe, expect, it } from 'vitest';
import {
  FORM_SG_2025,
  FORM_SG_2026,
  SG_FORM4_TOTAL,
  SG_PAGE_IDS,
  stGallenFormMap,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

/** Every manifest id in a source ("id p. 2 (...); other-id p. 10") is an ok entry, with a page. */
function expectCited(source: string, what: string, first: RegExp) {
  expect(source, what).toMatch(first);
  for (const part of source.split(';')) {
    const [id, p, page] = part.trim().split(' ');
    expect(lock[id!]?.status, `${what}: ${id}`).toBe('ok');
    expect(`${p} ${page}`, `${what}: ${part}`).toMatch(/^p\. \d+$/);
  }
}

const LINE =
  /^sg-2025-form-(steuererklaerung p\. [234]|berufskosten p\. [12]) \(Ziffer \d+(\.\d+)?\)/;
const PAGE = /^sg-2025-form-(steuererklaerung p\. [234]|berufskosten p\. [12]) \(Formular [14], /;

/** The codes of a page, in the order printed. */
const codes = (page: string) =>
  FORM_SG_2026.rubrics.filter((r) => r.page === page).map((r) => r.key);

describe('St. Gallen’s form map', () => {
  for (const form of [FORM_SG_2025, FORM_SG_2026]) {
    it(`${form.taxYear}: pages in the order you fill them in, each cited from the 2025 forms`, () => {
      expect(form.pages.map((p) => p.id)).toEqual([...SG_PAGE_IDS]);
      for (const p of form.pages) {
        expect(p.title, p.id).toMatch(new RegExp(String(form.taxYear)));
        expect(p.gloss.en && p.gloss.fr, p.id).toBeTruthy();
        expectCited(p.source, p.id, PAGE);
      }
      expect(form.pages.find((p) => p.id === 'F4-1')).toMatchObject({ person: 'A', pdfPage: 1 });
      expect(form.pages.find((p) => p.id === 'F4-2')).toMatchObject({ person: 'B', pdfPage: 2 });
    });

    it(`${form.taxYear}: every line labelled, glossed, placed and cited, no em dash`, () => {
      const seen = new Set<string>();
      for (const r of form.rubrics) {
        const where = `${r.page} ${r.key}`;
        expect(r.code, where).toBe(r.key);
        expect(r.key, where).toMatch(/^\d{3}$/);
        expect(r.label, where).toBeTruthy();
        expect(r.gloss.en && r.gloss.fr, where).toBeTruthy();
        expect(`${r.label} ${r.gloss.en} ${r.gloss.fr}`, where).not.toMatch(/[–—]/);
        // The Ziffer leads the label, as printed (Form 4's subtotal 406/456 is printed without one).
        if (!['406', '456'].includes(r.key)) {
          const ziffer = /\(Ziffer ([\d.]+)\)/.exec(r.source)![1]!;
          expect(r.label.startsWith(`${ziffer}${ziffer.includes('.') ? '' : '.'} `), where).toBe(
            true,
          );
        }
        const page = form.pages.find((p) => p.id === r.page)!;
        expect(
          page.sections.map((s) => s.id),
          where,
        ).toContain(r.section);
        expectCited(r.source, where, LINE);
        // One place per code and person on each page.
        const k = `${r.page}|${r.key}|${r.person}`;
        expect(seen.has(k), `${where} twice`).toBe(false);
        seen.add(k);
      }
    });
  }

  it('lays out each page as printed, its codes in the form’s order', () => {
    expect(codes('F4-1')).toEqual([
      '400',
      '402',
      '404',
      '406',
      '408',
      '410',
      '412',
      '416',
      '418',
      '426',
      '428',
      '432',
      '434',
      '438',
    ]);
    // Form 4's back: the same lines for Person 2, each code 50 higher (sg-2025-form-berufskosten p. 2).
    expect(codes('F4-2')).toEqual(codes('F4-1').map((c) => String(Number(c) + 50)));
    expect(codes('S2')).toEqual(
      '100 102 104 106 108 110 112 114 120 122 126 128 130 132 134 136 138 140 142 146 147 149 150 712 154 156 158 162 164 168 290 291 292'.split(
        ' ',
      ),
    );
    expect(codes('S3')).toEqual(
      '438 488 500 200 202 204 208 210 218 219 600 716 220 258 555 223 224 222 226 230 234 650 238 240 235 244 248 252 254 256 264 268'.split(
        ' ',
      ),
    );
    expect(codes('S4')).toEqual(
      '300 302 304 306 308 310 710 314 316 318 322 504 506 326 330 332 334 338 950'.split(' '),
    );
  });

  it('gives each person their own side of Form 4, and carries its total to 10.1 and 10.2', () => {
    for (const r of FORM_SG_2026.rubrics) {
      if (r.page === 'F4-1') expect(r.person, r.key).toBe('A');
      if (r.page === 'F4-2') expect(r.person, r.key).toBe('B');
    }
    const at = (page: string, key: string) =>
      FORM_SG_2026.rubrics.find((r) => r.page === page && r.key === key)!;
    expect(SG_FORM4_TOTAL).toEqual({ p1: '438', p2: '488' });
    expect(at('F4-1', '438')).toMatchObject({ person: 'A', role: 'total' });
    expect(at('S3', '438')).toMatchObject({ person: 'A', role: 'report' });
    expect(at('F4-2', '488')).toMatchObject({ person: 'B', role: 'total' });
    expect(at('S3', '488')).toMatchObject({ person: 'B', role: 'report' });
    expect(at('S3', '438').label).toMatch(/^10\.1 /);
    expect(at('S3', '488').label).toMatch(/^10\.2 /);
  });

  it('has a place for every line the St. Gallen engine computes', () => {
    for (const form of [FORM_SG_2025, FORM_SG_2026]) {
      const keys = new Set(form.rubrics.filter((r) => r.supported).map((r) => r.key));
      for (const code of [...Object.keys(RUBRICS), ...Object.keys(WEALTH_RUBRICS)]) {
        expect(keys, `${form.taxYear} ${code}`).toContain(code);
      }
      // And for the totals and 21.1 as the return lays it out.
      for (const code of ['168', '230', '234', '650', '238', '248', '268', '322', '326', '338']) {
        expect(keys, `${form.taxYear} ${code}`).toContain(code);
      }
    }
  });

  it('puts every line in the return’s one column, wealth in its own', () => {
    for (const r of FORM_SG_2026.rubrics) {
      const want = r.page === 'S2' ? ['icc_ifd'] : r.page === 'S4' ? ['wealth'] : ['amount'];
      expect(r.columns, `${r.page} ${r.key}`).toEqual(want);
      expect(r.columns, `${r.page} ${r.key}`).not.toContain('ifd');
    }
  });

  it('lists what Taxpresso doesn’t prepare, marked unsupported', () => {
    const unsupported = new Set(
      FORM_SG_2026.rubrics.filter((r) => !r.supported).map((r) => `${r.page} ${r.key}`),
    );
    expect([...unsupported].sort()).toEqual(
      [
        ...['F4-1 412', 'F4-1 426', 'F4-1 428', 'F4-1 434'],
        ...['F4-2 462', 'F4-2 476', 'F4-2 478', 'F4-2 484'],
        ...['S2 108', 'S2 110', 'S2 112', 'S2 114', 'S2 120', 'S2 122', 'S2 142'],
        ...['S2 147', 'S2 149', 'S2 150', 'S2 712', 'S2 158', 'S2 164'],
        ...['S2 290', 'S2 291', 'S2 292'],
        ...['S3 204', 'S3 716', 'S3 222', 'S3 235', 'S3 264'],
        ...['S4 308', 'S4 710', 'S4 314', 'S4 316', 'S4 318', 'S4 506', 'S4 950'],
      ].sort(),
    );
  });

  it('flags 2026 as provisional: the 2025 return until the 2026 one is published', () => {
    expect(FORM_SG_2025.provisional).toBe(false);
    expect(FORM_SG_2025.note).toBeUndefined();
    expect(FORM_SG_2026).toMatchObject({ taxYear: 2026, formYear: 2025, provisional: true });
    expect(FORM_SG_2026.note?.en).toMatch(/2025 return/);
    expect(FORM_SG_2026.note?.fr).toMatch(/déclaration 2025/);
    expect(stGallenFormMap(2025)).toBe(FORM_SG_2025);
    expect(stGallenFormMap(2026)).toBe(FORM_SG_2026);
    expect(() => stGallenFormMap(2027)).toThrow(/No St. Gallen form map/);
  });
});
