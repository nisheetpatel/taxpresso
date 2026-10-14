// The form map: the official order, one place per code and person, every entry labelled and cited.
import { describe, expect, it } from 'vitest';
import {
  COMMUNE_CODES_2025,
  COMMUNE_CODES_2025_SOURCE,
  FORM_2025,
  FORM_2026,
  FORM_PAGE_IDS,
  type FormRubric,
} from '../src/index.js';
import { COMMUNES_2026 } from '@taxpresso/rules-ge';
import { expectCited } from './cite.js';

const { pages, rubrics } = FORM_2025;

describe('the 2025 form map', () => {
  it('lists the pages in the official order, one per page of the specimen', () => {
    expect(pages.map((p) => p.id)).toEqual([...FORM_PAGE_IDS]);
    pages.forEach((p, i) => expect(p.pdfPage, p.id).toBe(i + 1));
    for (const p of pages) {
      expect(p.title, p.id).toBeTruthy();
      expect(p.gloss.en && p.gloss.fr, p.id).toBeTruthy();
      expect(p.sections.length, p.id).toBeGreaterThan(0);
      expectCited(p.source, p.id);
      expect(p.source, p.id).toContain(`ge-2025-declaration-specimen p. ${p.pdfPage}`);
    }
    // Of annexe D, D1 and D2 take a property abroad (the simple case); D3 and D4 are placeholders,
    // out of scope for now; of annexe B (self-employment, the simple case), B3's stock and
    // depreciation tables are the user's to copy from the accounts.
    expect(pages.filter((p) => !p.supported).map((p) => p.id)).toEqual(['B3', 'D3', 'D4']);
  });

  it('gives every rubric a label, a gloss, a place and a source on its own page', () => {
    const byId = new Map(pages.map((p) => [p.id, p]));
    for (const r of rubrics) {
      const what = `${r.page} ${r.key} ${r.person}`;
      const page = byId.get(r.page)!;
      expect(page, what).toBeDefined();
      expect(page.supported, `${what}: on a placeholder page`).toBe(true);
      expect(
        page.sections.some((s) => s.id === r.section),
        `${what}: section`,
      ).toBe(true);
      expect(r.label.trim(), what).not.toBe('');
      expect(r.gloss.en.trim() && r.gloss.fr.trim(), what).toBeTruthy();
      expectCited(r.source, what);
      expect(r.source, what).toContain(`ge-2025-declaration-specimen p. ${page.pdfPage}`);
      for (const f of r.lineFields ?? []) {
        expect(f.label.trim(), `${what} ${f.id}`).not.toBe('');
        if (f.source) expectCited(f.source, `${what} ${f.id}`);
      }
      // No em dash in anything we wrote (the form's own en dashes stay as printed).
      expect(`${r.gloss.en} ${r.gloss.fr}`, what).not.toMatch(/—/);
    }
  });

  it('keys coded rubrics by their code, and never makes up a code', () => {
    for (const r of rubrics) {
      if (r.code) {
        expect(r.key, r.code).toBe(r.code);
        expect(r.code).toMatch(/^\d{2}\.\d{2}$/);
      } else {
        expect(r.key, r.key).not.toMatch(/^\d{2}\.\d{2}$/);
      }
    }
  });

  it('has each code once per person on a page, and one place per code, person and column', () => {
    const onPage = new Set<string>();
    for (const r of rubrics) {
      const k = `${r.page}|${r.key}|${r.person}`;
      expect(onPage.has(k), k).toBe(false);
      onPage.add(k);
    }
    // A code can show up again on the summary pages, as a report of an annex total; anywhere else
    // a code, a person and a column name one box of the form.
    const boxes = new Set<string>();
    for (const r of rubrics.filter((x) => x.role !== 'report')) {
      for (const c of r.columns.length ? r.columns : ['-']) {
        const k = `${r.key}|${r.person}|${c}`;
        expect(boxes.has(k), k).toBe(false);
        boxes.add(k);
      }
    }
  });

  it('puts per-person amounts only under household rubrics, and taxpayer rubrics on their page', () => {
    for (const r of rubrics) {
      if (r.parts) expect(r.person, r.key).toBe('household');
      const page = pages.find((p) => p.id === r.page)!;
      if (page.person) expect(r.person, `${r.page} ${r.key}`).toBe(page.person);
    }
  });

  it('mirrors annexe A1 for contribuable B on A2 (codes 21.xx and 41.xx)', () => {
    const a1 = rubrics.filter((r) => r.page === 'A1');
    const a2 = rubrics.filter((r) => r.page === 'A2');
    expect(a2.map((r) => r.label)).toEqual(a1.map((r) => r.label));
    const shift = (r: FormRubric) =>
      r.code ? `${Number(r.code[0]) + 1}${r.code.slice(1)}` : r.key;
    expect(a2.map((r) => r.key)).toEqual(a1.map(shift));
    expect(a1.find((r) => r.key === '11.10')).toMatchObject({
      label: 'Salaires bruts',
      csBox: '1',
      repeats: 2,
      columns: ['icc_ifd'],
      role: 'input',
    });
    expect(a2.find((r) => r.key === '41.40')).toMatchObject({
      label: 'Cotisations au 3ème pilier A',
      person: 'B',
      columns: ['icc', 'ifd'],
    });
  });

  it('marks what the form works out, and the totals of what is out of scope', () => {
    const find = (page: string, key: string) =>
      rubrics.find((r) => r.page === page && r.key === key)!;
    expect(find('A1', '31.50')).toMatchObject({ role: 'computed', columns: ['icc'] });
    expect(find('A1', '31.20')).toMatchObject({ role: 'computed', columns: ['ifd'] });
    expect(find('A1', '11.00').role).toBe('total');
    expect(find('PG2', '11.00')).toMatchObject({ role: 'report', person: 'A' });
    // Self-employment and a property abroad, the simple cases: their totals on the summary pages
    // are supported; property costs carried over (58.01) are not.
    expect(find('PG2', '12.00')).toMatchObject({ role: 'report', supported: true });
    expect(find('PG3', '57.00')).toMatchObject({ role: 'report', supported: true });
    expect(find('PG2', '15.00')).toMatchObject({ role: 'report', supported: true });
    expect(find('PG4', '15.00')).toMatchObject({ role: 'report', supported: true });
    expect(find('PG3', '58.00')).toMatchObject({ role: 'report', supported: true });
    expect(find('PG3', '58.01').supported).toBe(false);
    expect(find('D1', '15.10')).toMatchObject({
      label: 'Immeubles occupés par le propriétaire',
      columns: ['wealth', 'ifd', 'icc'],
      repeats: 2,
    });
    expect(find('D2', '15.20')).toMatchObject({ label: 'Immeubles locatifs ou loués' });
    expect(find('E1', '55.20')).toMatchObject({
      label: 'Intérêts et dettes hypothécaires',
      supported: true,
    });
    expect(find('PG3', '71.00')).toMatchObject({ role: 'input', parts: ['A', 'B', 'children'] });
    expect(find('F1', 'F1-RSI').format).toBe('money_cents');
    expect(find('C3', '52.21').columns).toEqual(['icc_ifd']);
  });

  it('counts its rubrics', () => {
    const coded = rubrics.filter((r) => r.code);
    expect(new Set(coded.map((r) => r.code)).size).toBeGreaterThan(120);
    expect(rubrics.length).toBeGreaterThan(170);
  });
});

describe('the 2026 form map', () => {
  it('reuses the 2025 form, flagged provisional until the 2026 form is published', () => {
    expect(FORM_2026).toMatchObject({ taxYear: 2026, formYear: 2025, provisional: true });
    expect(FORM_2026.rubrics).toBe(FORM_2025.rubrics);
    expect(FORM_2026.note?.en).toMatch(/2025 form/);
    expect(FORM_2025.provisional).toBe(false);
  });
});

describe('commune codes', () => {
  it('give every Geneva commune its code lieu, from the guide', () => {
    expectCited(COMMUNE_CODES_2025_SOURCE, 'commune codes');
    expect(Object.keys(COMMUNE_CODES_2025).sort()).toEqual(COMMUNES_2026.map((c) => c.slug).sort());
    expect(COMMUNE_CODES_2025.geneve).toBe('6621');
    expect(COMMUNE_CODES_2025.meyrin).toBe('6630');
    expect(COMMUNE_CODES_2025.vernier).toBe('6643');
    expect(new Set(Object.values(COMMUNE_CODES_2025)).size).toBe(45);
  });
});
