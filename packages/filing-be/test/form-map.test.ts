// The Bern form map: the forms in the order you fill them in, then TaxMe's two summaries; one place
// per key on each page, every line labelled in German as printed, glossed in English and French,
// and cited to the specimen return (and the guide where it explains the line).
import { readFileSync } from 'node:fs';
import { DEDUCTIONS, INCOME, RUBRICS } from '@taxpresso/rules-be';
import { describe, expect, it } from 'vitest';
import {
  BE_FORM_NOTE,
  BE_PAGE_IDS,
  bernFormMap,
  FORM_BE_2025,
  FORM_BE_2026,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

const SPECIMEN = 'be-2025-steuererklaerung-formulare-de';
const FORMS = new Set(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F8']);

/** The specimen's page first, then every manifest id cited is an ok entry of the library. */
function expectCited(source: string, what: string) {
  expect(source, what).toMatch(new RegExp(`^${SPECIMEN} p\\. \\d+(;|$)`));
  for (const part of source.split(';')) {
    const id = part.trim().split(' ')[0]!;
    expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
    if (id === 'be-2025-wegleitung-np-de') {
      // The guide's PDF page is its own page number ("Seite") plus 9.
      const m = /p\. (\d+) \(Seite (\d+)\)/.exec(part);
      expect(m, `${what}: ${part}`).not.toBeNull();
      expect(Number(m![1]) - Number(m![2]), `${what}: ${part}`).toBe(9);
    }
  }
}

/** The supported places of an engine code, by page. */
const placesOf = (code: string) =>
  FORM_BE_2026.rubrics.filter((r) => r.key === code && r.supported).map((r) => r.page);

describe('the Bern form map', () => {
  for (const form of [FORM_BE_2025, FORM_BE_2026]) {
    it(`${form.taxYear}: pages in the order you fill them in, each cited`, () => {
      expect(form.pages.map((p) => p.id)).toEqual([...BE_PAGE_IDS]);
      for (const p of form.pages) {
        expect(p.title, p.id).toMatch(new RegExp(String(form.taxYear)));
        expect(p.gloss.en && p.gloss.fr, p.id).toBeTruthy();
        expect(p.source, p.id).toBe(`${SPECIMEN} p. ${p.pdfPage}`);
        expectCited(p.source, p.id);
      }
      expect(form.pages.find((p) => p.id === 'F8')!.supported).toBe(false);
    });

    it(`${form.taxYear}: every line labelled, glossed, placed and cited, no em dash`, () => {
      const seen = new Set<string>();
      for (const r of form.rubrics) {
        const where = `${r.page} ${r.key}`;
        expect(r.label, where).toBeTruthy();
        expect(r.gloss.en && r.gloss.fr, where).toBeTruthy();
        expect(`${r.label} ${r.gloss.en} ${r.gloss.fr}`, where).not.toMatch(/—/);
        // French typography: a no-break space before a colon or a semicolon, typographic
        // apostrophes.
        expect(r.gloss.fr, where).not.toMatch(/ [:;]|'/);
        if (r.code !== undefined) expect(r.code, where).toMatch(/^\d+(\.\d+)?$/);
        const page = form.pages.find((p) => p.id === r.page)!;
        expect(
          page.sections.map((s) => s.id),
          where,
        ).toContain(r.section);
        expectCited(r.source, where);
        // One place per key on a page; a person's amounts are parts of one line (Mann, Frau).
        expect(r.person, where).toBe('household');
        if (r.parts) expect(r.parts, where).toEqual(['A', 'B']);
        const k = `${r.page}|${r.key}`;
        expect(seen.has(k), `${where} twice`).toBe(false);
        seen.add(k);
      }
    });
  }

  it('puts the forms’ lines in one column, and the summaries’ in TaxMe’s Steuerbar column', () => {
    for (const r of FORM_BE_2026.rubrics) {
      const where = `${r.page} ${r.key}`;
      if (FORMS.has(r.page)) {
        expect(r.columns, where).toEqual(r.nature === 'wealth' ? ['wealth'] : ['amount']);
      } else {
        expect(r.columns, where).toEqual([r.page === 'ZK' ? 'icc' : 'ifd']);
        // TaxMe works every line out: you only check them.
        expect(['computed', 'total'], where).toContain(r.role);
      }
    }
  });

  it('has a place for every line Bern’s engine computes', () => {
    // On the summaries: every line, the cantonal ones on ZK, the federal ones on ZB.
    const federal = new Set([
      ...INCOME,
      ...DEDUCTIONS,
      '6.5',
      'verheiratet',
      '5.3',
      '5.4',
      '2.1-kinder',
    ]);
    for (const code of Object.keys(RUBRICS)) {
      const pages = placesOf(code);
      if (code !== 'verheiratet') expect(pages, code).toContain('ZK');
      if (federal.has(code)) expect(pages, code).toContain('ZB');
      else expect(pages, code).not.toContain('ZB');
    }
    // On the forms: every line you declare. Not on them, the deductions TaxMe works out on its own
    // and the forms have no line for: the general deduction, the married couple deduction
    // (federal), the two-earner deduction (be-2025-wegleitung-np-de p. 22, Seite 13: "von Amtes
    // wegen"), the child deduction (from the KA box of 2.1), the modest income deduction and the
    // wealth deductions.
    const notOnForms = [
      'zweiverdiener',
      'verheiratet',
      'allgemein',
      '2.1-kinder',
      'bescheiden',
      'vermoegen-verheiratet',
      'vermoegen-kinder',
    ];
    for (const code of Object.keys(RUBRICS)) {
      const onForms = placesOf(code).filter((p) => FORMS.has(p));
      expect(onForms.length, code).toBe(notOnForms.includes(code) ? 0 : 1);
    }
    // And nothing else of the engine's on ZK or ZB than its lines and the summaries' totals.
    for (const r of FORM_BE_2026.rubrics.filter((x) => !FORMS.has(x.page) && x.supported)) {
      const known = r.key in RUBRICS || r.role === 'total';
      expect(known, `${r.page} ${r.key}`).toBe(true);
    }
  });

  it('places pillar 3a and buy-ins where form 1.1 asks for them, per person', () => {
    const at = (page: string, key: string) =>
      FORM_BE_2026.rubrics.find((r) => r.page === page && r.key === key)!;
    for (const key of ['saeule-3a', 'einkauf-bv']) {
      const r = at('F1', key);
      expect(r).toMatchObject({ code: '1.1', role: 'input', parts: ['A', 'B'], format: 'money' });
      expect(r.source).toMatch(/^be-2025-steuererklaerung-formulare-de p\. 1; /);
      expect(r.source).toContain('be-2025-wegleitung-np-de p. 198 (Seite 189)');
    }
    expect(at('F1', 'saeule-3a').source).toContain('p. 201 (Seite 192)');
    expect(at('F1', 'einkauf-bv').source).toContain('p. 199 (Seite 190)');
    expect(at('F1', 'alleinstehend')).toMatchObject({ code: '1.2', format: 'tick' });
  });

  it('labels the lines as the specimen prints them', () => {
    const at = (page: string, key: string) =>
      FORM_BE_2026.rubrics.find((r) => r.page === page && r.key === key)!;
    expect(at('F2', '2.21-haupt').label).toBe(
      'Einkünfte aus unselbstständiger Haupterwerbstätigkeit (Nettolohn)',
    );
    expect(at('F3', '3.0-ertrag')).toMatchObject({ code: '31', role: 'total' });
    expect(at('F3', '3.0-vermoegen')).toMatchObject({ code: '32', columns: ['wealth'] });
    expect(at('F3', '3.0-kosten')).toMatchObject({ code: '51', role: 'input' });
    expect(at('F4', '4.2').label).toBe('Total Versicherungsprämien und Zinsen auf Sparkapitalien');
    expect(at('F5', '5.4').label).toBe('Total selbst getragene Krankheits- und Unfallkosten');
    expect(at('F6', '6.5')).toMatchObject({ format: 'tick', parts: ['A', 'B'] });
    // TaxMe's summaries (p. 9 and 11): the person is the part, "Mann: Haupterwerb".
    expect(at('ZK', '2.21-haupt')).toMatchObject({ label: 'Haupterwerb', code: '2.21' });
    expect(at('ZK', '2.21-haupt').source).toBe(`${SPECIMEN} p. 9`);
    expect(at('ZK', '5.4').label).toBe('Selbstgetragene Krankheitskosten');
    expect(at('ZK', 'steuerbares-einkommen').role).toBe('total');
    expect(at('ZB', 'verheiratet')).toMatchObject({ label: 'Abzug für Verheiratete' });
    expect(at('ZB', 'verheiratet').source).toBe(`${SPECIMEN} p. 11`);
    expect(at('ZK', 'vst-anspruch')).toMatchObject({ supported: false });
    expect(at('ZK', 'vst-anspruch').source).toMatch(new RegExp(`^${SPECIMEN} p\\. 10`));
  });

  it('flags 2026 as provisional, with the 2025 forms, and knows no other year', () => {
    expect(FORM_BE_2025.provisional).toBe(false);
    expect(FORM_BE_2025.note).toBeUndefined();
    expect(FORM_BE_2026).toMatchObject({ taxYear: 2026, formYear: 2025, provisional: true });
    expect(FORM_BE_2026.note).toBe(BE_FORM_NOTE);
    expect(BE_FORM_NOTE.en).toMatch(/2025 Bern return/);
    expect(BE_FORM_NOTE.fr).toContain('\u00a0:');
    expect(BE_FORM_NOTE.de).toMatch(/Berner Steuererklärung 2025/);
    expect(FORM_BE_2026.rubrics.map((r) => `${r.page}|${r.key}`)).toEqual(
      FORM_BE_2025.rubrics.map((r) => `${r.page}|${r.key}`),
    );
    expect(bernFormMap(2025)).toBe(FORM_BE_2025);
    expect(bernFormMap(2026)).toBe(FORM_BE_2026);
    expect(() => bernFormMap(2024)).toThrow(/No Bern form map/);
    expect(() => bernFormMap(2027)).toThrow(/No Bern form map/);
  });
});
