// The Vaud form map: the form's pages 2 to 4, the annexes 01 to 05 and the guide's worksheet for the
// federal tax, one place per key on each page, every line labelled in French as printed, glossed in
// English and French, and cited to the form or annex and the guide where it explains the line.
import { readFileSync } from 'node:fs';
import { FEDERAL_RUBRICS, RUBRICS, WEALTH_RUBRICS } from '@taxpresso/rules-vd';
import { describe, expect, it } from 'vitest';
import {
  FORM_VD_2025,
  FORM_VD_2026,
  VD_FORM_NOTE,
  VD_PAGE_IDS,
  vaudFormMap,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

const MAIN = new Set(['P2', 'P3']);
const ANNEXES = new Set(['P4', 'A01', 'A02', 'A03', 'A04', 'A05']);
const DASHES = /[–—]/;

/** A document of the library with its page first, then every manifest id cited is an ok entry. */
function expectCited(source: string, what: string) {
  expect(source, what).toMatch(/^vd-2025-[a-z0-9-]+ p\. \d+/);
  for (const part of source.split(';')) {
    const id = part.trim().split(' ')[0]!;
    expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
    expect(part, what).toMatch(/ p\. \d+/);
  }
}

const at = (page: string, key: string) =>
  FORM_VD_2026.rubrics.find((r) => r.page === page && r.key === key)!;
/** The supported places of a key, by page. */
const placesOf = (key: string) => FORM_VD_2026.rubrics.filter((r) => r.key === key && r.supported);

/** The worksheet's lines the federal engine gives (vd-2025-guide p. 65; rules-vd ifd.ts). */
const FEDERAL_CODES = [
  '100',
  '105',
  '140',
  '150',
  '160',
  '165',
  '195',
  '200',
  '210',
  '235',
  '240',
  '250',
  '270',
  '280',
  '300',
  '310',
  '320',
  '410',
  '490',
  '610',
  '618',
  '620',
  '630',
  '670',
  '710',
  '720',
  ...Object.keys(FEDERAL_RUBRICS),
];

describe('the Vaud form map', () => {
  for (const form of [FORM_VD_2025, FORM_VD_2026]) {
    it(`${form.taxYear}: pages in the form's order, each cited, ids get_form_values takes`, () => {
      expect(form.pages.map((p) => p.id)).toEqual([...VD_PAGE_IDS]);
      for (const p of form.pages) {
        expect(p.id.length, p.id).toBeLessThanOrEqual(4);
        expect(p.title, p.id).toMatch(new RegExp(String(form.taxYear)));
        expect(p.gloss.en && p.gloss.fr, p.id).toBeTruthy();
        expect(`${p.title} ${p.gloss.en} ${p.gloss.fr}`, p.id).not.toMatch(DASHES);
        expectCited(p.source, p.id);
        expect(p.sections.length, p.id).toBeGreaterThan(0);
      }
      const source = (id: string) => form.pages.find((p) => p.id === id)!.source;
      expect(source('P2')).toBe('vd-2025-form-21010 p. 2 (form page 2)');
      expect(source('P3')).toBe('vd-2025-form-21010 p. 2 (form page 3)');
      expect(source('P4')).toBe('vd-2025-form-21010 p. 1 (form page 4)');
      expect(source('A01')).toBe('vd-2025-annexe-01 p. 1');
      expect(source('A02')).toBe('vd-2025-annexes-02-03 p. 1 (annexe 02)');
      expect(source('A03')).toBe('vd-2025-annexes-02-03 p. 1 (annexe 03)');
      expect(source('A04')).toMatch(/^vd-2025-annexes-04-05 p\. 1 \(annexe 04/);
      expect(source('A05')).toBe('vd-2025-annexes-04-05 p. 1 (annexe 05)');
      expect(source('IFD')).toBe('vd-2025-guide p. 65');
    });

    it(`${form.taxYear}: every line labelled, glossed, placed and cited, no dash`, () => {
      const seen = new Set<string>();
      for (const r of form.rubrics) {
        const where = `${r.page} ${r.key}`;
        expect(r.label, where).toBeTruthy();
        expect(r.gloss.en && r.gloss.fr, where).toBeTruthy();
        expect(`${r.label} ${r.gloss.en} ${r.gloss.fr}`, where).not.toMatch(DASHES);
        // French typography: a no-break space before a colon or a semicolon, typographic
        // apostrophes.
        expect(`${r.gloss.fr} ${r.label}`, where).not.toMatch(/ [:;]|'/);
        if (r.code !== undefined) expect(r.code, where).toMatch(/^\d{3}(\/\d{3})*$/);
        if (/^\d{3}$/.test(r.key)) expect(r.code?.split('/')[0], where).toBe(r.key);
        const page = form.pages.find((p) => p.id === r.page)!;
        expect(
          page.sections.map((s) => s.id),
          where,
        ).toContain(r.section);
        expectCited(r.source, where);
        // One place per key on a page; a taxpayer's amounts are parts of one line.
        expect(r.person, where).toBe('household');
        if (r.parts) expect(r.parts, where).toEqual(['A', 'B']);
        const k = `${r.page}|${r.key}`;
        expect(seen.has(k), `${where} twice`).toBe(false);
        seen.add(k);
      }
    });
  }

  it('cites the guide where it explains a line of the return', () => {
    const cites = (page: string, key: string, guidePage: string) =>
      expect(at(page, key).source, `${page} ${key}`).toContain(`vd-2025-guide p. ${guidePage}`);
    cites('P2', '100', '17');
    cites('P2', '140', '19 and 20');
    cites('P2', '235', '26');
    cites('P2', '300', '29');
    cites('P2', '310', '30');
    cites('P3', '410', '32');
    cites('P3', '480', '40');
    cites('P3', '618', '42');
    cites('P3', '660', '44');
    cites('P3', '695', '45');
    cites('P3', '710', '48');
    cites('P3', '725', '49');
    cites('P3', '810', '51');
    cites('P3', '820', '52');
    cites('IFD', '300', '62 and 63');
    cites('IFD', 'deduction-enfants', '64');
  });

  it('has a place on the return for every line Vaud’s engine computes, in its column', () => {
    // Income and deductions: once on pages 2 and 3, in the return's income column ("Revenu").
    for (const code of Object.keys(RUBRICS)) {
      const onReturn = placesOf(code).filter((r) => MAIN.has(r.page) && r.columns.includes('icc'));
      expect(onReturn.length, code).toBe(1);
    }
    // Wealth: once on page 3, in the "Fortune" column.
    for (const code of Object.keys(WEALTH_RUBRICS)) {
      const onReturn = placesOf(code).filter((r) => r.page === 'P3');
      expect(
        onReturn.map((r) => r.columns.includes('wealth')),
        code,
      ).toEqual([true]);
    }
    // The totals and the parts the engine gives.
    for (const code of ['650', '690', '700', '800', '810', '820']) {
      expect(at('P3', code).role, code).not.toBe('input');
    }
    expect(at('P3', '800').columns).toEqual(['icc', 'wealth']);
    expect(at('P3', '810')).toMatchObject({ format: 'count', role: 'computed' });
    // The federal worksheet: every line the federal engine gives, and its printed totals.
    for (const code of [...FEDERAL_CODES, 'revenu-intermediaire-1', '730', 'revenu-imposable']) {
      const r = at('IFD', code);
      expect(r?.supported, code).toBe(true);
      expect(r.columns, code).toEqual(['ifd']);
    }
  });

  it('puts each taxpayer’s amounts in their box, and the household’s in the line’s one box', () => {
    const perPerson = FORM_VD_2026.rubrics.filter(
      (r) => r.page === 'P2' && r.code && Number(r.code) <= 398,
    );
    for (const r of perPerson) {
      if (['235', '300'].includes(r.key)) expect(r.parts, r.key).toBeUndefined();
      else expect(r.parts, r.key).toEqual(['A', 'B']);
      expect(r.columns, r.key).toEqual(['icc']);
    }
    // 235 has one box, under Contribuable 2; 300 ("total famille") one, under Contribuable 1.
    expect(at('P2', '235').gloss.en).toMatch(/Contribuable 2 column/);
    expect(at('P2', '300').gloss.en).toMatch(/Contribuable 1 column/);
    expect(at('P2', '399')).toMatchObject({ role: 'report' });
    expect(at('P2', '399').parts).toBeUndefined();
    // 618: a box per taxpayer and their sum (form page 3).
    expect(at('P3', '618')).toMatchObject({ parts: ['A', 'B'], columns: ['icc'] });
    // Annex 04 for each taxpayer: contribuable 1 on the front, 2 on the back.
    for (const code of ['140', '150', '160', '618']) {
      expect(at('A04', code), code).toMatchObject({ parts: ['A', 'B'], columns: ['amount'] });
    }
    expect(at('P4', '280')).toMatchObject({ parts: ['A', 'B'], columns: ['amount'] });
  });

  it('gives each value one place: the return, the annexes and the worksheet in their own columns', () => {
    for (const r of FORM_VD_2026.rubrics) {
      const where = `${r.page} ${r.key}`;
      if (MAIN.has(r.page)) {
        for (const c of r.columns) expect(['icc', 'wealth', 'amount'], where).toContain(c);
        // A box before its code (the rent, the childcare paid, the contents' insurance value).
        if (r.columns.includes('amount')) expect(r.nature, where).toBe('info');
      } else if (ANNEXES.has(r.page)) {
        for (const c of r.columns) expect(['amount', 'value'], where).toContain(c);
      } else {
        expect(r.columns, where).toEqual(['ifd']);
        // VaudTax works every line out: you only check them.
        expect(['computed', 'total'], where).toContain(r.role);
      }
    }
    // The annexes' totals carried to a code, with the code as their key.
    expect(at('A01', '410')).toMatchObject({ role: 'total', columns: ['amount', 'value'] });
    expect(at('A02', '610')).toMatchObject({ role: 'total', columns: ['amount', 'value'] });
    expect(at('A02', '435')).toMatchObject({ role: 'total', columns: ['value'] });
    for (const code of ['710', '620', '720']) {
      expect(at('A05', code), code).toMatchObject({ role: 'total', columns: ['amount'] });
    }
  });

  it('labels the lines as printed', () => {
    expect(at('P2', '100').label).toBe('Principal (total de vos différents revenus)');
    expect(at('P2', '300').label).toBe(
      'Assurances maladie et accidents, assurances sur la vie (total famille)',
    );
    expect(at('P3', '650').label).toBe('Revenu net (total des codes 400 à 640 + 670)');
    expect(at('P3', '660-loyer')).toMatchObject({ code: '660', label: 'Loyer annuel net' });
    expect(at('P3', '670-effectif')).toMatchObject({ code: '670', label: 'Montant effectif' });
    expect(at('P3', '610').columns).toEqual(['icc', 'wealth']);
    expect(at('A01', '410').label).toBe(
      'Totaux des rendements et fortune à reporter sous code 410 de la déclaration d’impôt',
    );
    expect(at('A03', 'a03-menage')).toMatchObject({
      label: 'Tenez-vous un ménage indépendant seul avec cet (ces) enfant(s)\u00a0?',
      format: 'tick',
    });
    expect(at('A05', '720').label).toBe(
      'Montant le plus bas à reporter sous code 720 de la déclaration d’impôt',
    );
    expect(at('IFD', '300')).toMatchObject({
      code: '300/340/480',
      label: 'Primes et cotisations d’assurances et intérêts de capitaux d’épargne',
    });
    expect(at('IFD', '730').label).toBe('Revenu intermédiaire II');
    expect(at('IFD', 'revenu-intermediaire-1').code).toBeUndefined();
    // A label with the year: the tax year's.
    expect(FORM_VD_2025.rubrics.find((r) => r.key === 'a05-dons')!.label).toBe(
      'Total des dons faits en 2025',
    );
  });

  it('lists what Taxpresso doesn’t prepare, marked unsupported', () => {
    const out = [
      ['P2', ['110', '120', '180', '185', '186', '190', '220', '260', '330', '340']],
      ['P3', ['425', '450', '460', '465', '495', '500', '510', '530', '540', '615', '640', '680']],
      ['IFD', ['110', '120', '180', '185', '186', '190', '220', '260', '330', '445', '495']],
    ] as const;
    for (const [page, codes] of out) {
      for (const code of codes) expect(at(page, code).supported, `${page} ${code}`).toBe(false);
    }
    expect(at('A02', '615').supported).toBe(false);
    expect(at('A05', 'a05-handicap').supported).toBe(false);
  });

  it('flags 2026 as provisional, with the 2025 return, and knows no other year', () => {
    expect(FORM_VD_2025.provisional).toBe(false);
    expect(FORM_VD_2025.note).toBeUndefined();
    expect(FORM_VD_2026).toMatchObject({ taxYear: 2026, formYear: 2025, provisional: true });
    expect(FORM_VD_2026.note).toBe(VD_FORM_NOTE);
    expect(VD_FORM_NOTE.en).toMatch(/2025 Vaud return/);
    expect(VD_FORM_NOTE.fr).toContain(' :');
    for (const text of [VD_FORM_NOTE.en, VD_FORM_NOTE.fr, VD_FORM_NOTE.de ?? '']) {
      expect(text).not.toMatch(DASHES);
    }
    expect(FORM_VD_2026.rubrics.map((r) => `${r.page}|${r.key}`)).toEqual(
      FORM_VD_2025.rubrics.map((r) => `${r.page}|${r.key}`),
    );
    expect(vaudFormMap(2025)).toBe(FORM_VD_2025);
    expect(vaudFormMap(2026)).toBe(FORM_VD_2026);
    expect(() => vaudFormMap(2024)).toThrow(/No Vaud form map/);
    expect(() => vaudFormMap(2027)).toThrow(/No Vaud form map/);
  });
});
