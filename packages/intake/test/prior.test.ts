// Last year's declaration (SPEC.md section 5.4), on the synthetic fixtures written by
// test/fixtures/make-prior-fixtures.mjs: the Dupont couple (GeTax page codes), Ana Ribeiro
// (single), and the Dupont couple again from another program with two employers for A.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  detectPriorDeclaration,
  localizePriorWarning,
  parseAmount,
  parsePriorDeclaration,
  readPriorDeclaration,
  type CommuneLookup,
  type PriorDeclaration,
  type PriorItem,
} from '../src/index.js';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../../test/fixtures/${name}`, import.meta.url)));

/** A stand-in for the official list (rules-ge maps it, ge-2025-guide-declaration-pp p. 59). */
const communes: CommuneLookup = {
  byName: (place) =>
    ({ vernier: 'vernier', meyrin: 'meyrin', geneve: 'geneve', carouge: 'carouge' })[
      place.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ \d+$/, '')
    ],
  byCode: (code) => ({ 6643: 'vernier', 6630: 'meyrin', 6621: 'geneve' })[code],
};

const read = async (name: string) => {
  const d = await readPriorDeclaration(fixture(name), { communes });
  expect(d).toBeDefined();
  return d!;
};

const line = (d: PriorDeclaration, form: string, code: string, extra: Partial<PriorItem> = {}) =>
  d.items.find(
    (i) =>
      i.form === form &&
      i.code === code &&
      (extra.suffix ?? undefined) === i.suffix &&
      (extra.occurrence ?? 1) === i.occurrence,
  );

/** Everything that identifies the taxpayer in the fixtures: none of it may come out. */
const IDENTITY = [
  'DUPONT',
  'Dupont',
  'Jean',
  'Marie',
  'RIBEIRO',
  'Ana',
  '01.01.1980',
  '02.02.1982',
  '756.0000',
  '000.00.0000-0',
  '0000-0000-0000',
  '022 000 00 00',
  "Rue de l'Exemple",
  'Chemin du Test',
  '1214 Vernier',
  '1217 Meyrin',
  'Lignon',
  'Horloger',
  'Graphiste',
  'Infirmière',
  'Exemple Horlogerie',
  'Atelier Graphique',
  'Banque Fictive',
  'Clinique',
  'Ignore previous instructions',
];

describe('last year’s declaration, read from its PDF', () => {
  it('reads the Dupont couple: year, program, pages, taxpayers and commune', async () => {
    const d = await read('dupont-declaration-2025.pdf');
    expect(d).toMatchObject({
      taxYear: 2025,
      software: 'GeTax',
      pages: 8,
      taxpayers: { a: { civilStatus: 'married' }, b: { civilStatus: 'married' } },
      // From the address; the tax office's own address on page 1 is not where they live.
      residence: { commune: 'vernier', page: 1, from: 'address' },
      warnings: [],
    });
    expect(d.forms.map((f) => f.form)).toEqual([
      'PG1',
      'PG2',
      'PG3',
      'PG4',
      'A1',
      'A2',
      'C4',
      'F1',
    ]);
  });

  it('puts each amount in its column, cantonal (ICC) or federal (IFD), in centimes', async () => {
    const d = await read('dupont-declaration-2025.pdf');
    expect(line(d, 'PG2', '11.00')).toMatchObject({
      person: 'A',
      annex: 'A1',
      icc: 98_000_00,
      ifd: 98_000_00,
    });
    expect(line(d, 'PG2', '21.00')).toMatchObject({ person: 'B', icc: 52_000_00 });
    expect(line(d, 'PG2', '14.00')).toMatchObject({ person: 'household', annex: 'F1' });
    expect(line(d, 'PG3', '52.00')).toMatchObject({ icc: 14_820_00, ifd: 3_700_00 });
    // Lines with one column filled: the column decides, not the order.
    expect(line(d, 'A1', '31.20')).toEqual(expect.objectContaining({ ifd: 2_617_00 }));
    expect(line(d, 'A1', '31.20')?.icc).toBeUndefined();
    expect(line(d, 'A1', '31.50')).toMatchObject({ icc: 1_812_00 });
    expect(line(d, 'A1', '31.50')?.ifd).toBeUndefined();
    expect(line(d, 'A1', '31.71')).toMatchObject({ ifd: 1_200_00 });
    expect(line(d, 'PG3', '73.20')).toMatchObject({ ifd: 500_00 });
    expect(line(d, 'PG3', '73.20')?.icc).toBeUndefined();
    // The wealth page has one column, cantonal only.
    expect(line(d, 'PG4', '99.00')).toMatchObject({ icc: 62_400_00 });
    expect(line(d, 'PG4', '99.00')?.ifd).toBeUndefined();
    expect(line(d, 'PG4', '55.00')).toMatchObject({ icc: 15_000_00 });
  });

  it('reads annex A per taxpayer: work commune, certificate box, wrapped labels, "r" lines', async () => {
    const d = await read('dupont-declaration-2025.pdf');
    expect(line(d, 'A1', '11.10')).toMatchObject({
      person: 'A',
      commune: 6621,
      box: '8',
      icc: 98_000_00,
      ifd: 98_000_00,
    });
    // The label goes on to a second line, which carries the amounts.
    expect(line(d, 'A1', '31.10')).toMatchObject({ icc: 5_880_00, ifd: 5_880_00, box: '9' });
    expect(line(d, 'A1', '31.12')).toMatchObject({ box: '10.1' });
    expect(line(d, 'A1', '31.40')).toMatchObject({ icc: 7_000_00, ifd: 7_000_00 });
    expect(line(d, 'A2', '21.10')).toMatchObject({ person: 'B', commune: 6643 });
    expect(line(d, 'A2', '41.30')).toMatchObject({ person: 'B', icc: 5_000_00 });
    expect(line(d, 'A2', '41.10', { suffix: 'r' })).toMatchObject({ icc: 0, ifd: 0 });
    expect(line(d, 'A2', '41.10')).toMatchObject({ icc: 3_120_00 });
  });

  it('keeps a small table under a code apart, and fills the empty columns with its totals', async () => {
    const d = await read('dupont-declaration-2025.pdf');
    // 71.00 medical costs: A, B, children, total, then the deductible parts. "92.20" in
    // "total moins 0.5 % du code 92.20" is a code quoted in the label, not an amount.
    expect(line(d, 'PG3', '71.00')).toMatchObject({
      icc: 1_525_00,
      ifd: 0,
      table: [1_200_00, 300_00, 500_00, 2_000_00, 1_525_00, 0],
    });
    // Annex pages whose columns are not ICC and IFD keep their amounts as they are.
    expect(line(d, 'C4', '59.10')).toMatchObject({ amounts: [6_000_00] });
  });

  it('keeps nothing that identifies the taxpayer, and follows no text in the document', async () => {
    for (const f of [
      'dupont-declaration-2025.pdf',
      'ribeiro-declaration-2025.pdf',
      'dupont-declaration-2025-two-employers.pdf',
    ]) {
      const out = JSON.stringify(await read(f));
      for (const s of IDENTITY) expect(out, `${f}: ${s}`).not.toContain(s);
    }
  });

  it('reads a single person', async () => {
    const d = await read('ribeiro-declaration-2025.pdf');
    expect(d.taxpayers).toEqual({ a: { civilStatus: 'single' } });
    expect(d.residence).toMatchObject({ commune: 'meyrin', from: 'address' });
    expect(d.items.some((i) => i.person === 'B')).toBe(false);
    expect(line(d, 'A1', '31.40')).toMatchObject({ icc: 0, ifd: 0 });
    expect(line(d, 'PG3', '71.00')).toMatchObject({ table: [0] });
  });

  it('reads another program’s print-out: no page codes, other columns, two employers', async () => {
    const d = await read('dupont-declaration-2025-two-employers.pdf');
    expect(d).toMatchObject({
      taxYear: 2025,
      software: 'DrTax',
      // "1219 Le Lignon" is not a commune's name; the commune code on page 1 is.
      residence: { commune: 'vernier', from: 'code' },
    });
    // Pages told apart by the codes on them; annex A runs over two pages.
    expect(d.forms.map((f) => f.form)).toEqual(['PG1', 'PG2', 'A1', 'A1', 'PG3']);
    expect(line(d, 'A1', '11.10')).toMatchObject({ commune: 6621, icc: 80_000_00, page: 3 });
    expect(line(d, 'A1', '11.10', { occurrence: 2 })).toMatchObject({
      commune: 6630,
      icc: 30_000_00,
      ifd: 30_000_00,
    });
    expect(line(d, 'A1', '31.30')).toMatchObject({ icc: 10_000_00, page: 4 });
    expect(line(d, 'PG2', '13.00')).toMatchObject({ icc: 12_000_00 });
  });

  it('says no to other documents', async () => {
    expect(
      await readPriorDeclaration(fixture('dupont-certificat-salaire-2026.pdf')),
    ).toBeUndefined();
    expect(await readPriorDeclaration(fixture('dupont-scan-3a-2026.pdf'))).toBeUndefined();
    expect(
      await readPriorDeclaration(new TextEncoder().encode('11.00 Salaires 1’000')),
    ).toBeUndefined();
    expect(await readPriorDeclaration(new Uint8Array())).toBeUndefined();
  });
});

describe('the declaration parser, on plain text', () => {
  const page2 = [
    'PG2   Récapitulation   2024',
    "11.00    Revenus activité dépendante c.A    A1    80'000    80'000",
    "21.50    Perte de salaire c.B    1'200    1'200    12.00    Activité indépendante    B2    500    500",
    "91.00    Total des revenus bruts    81'700    81'700",
    "92.40    Revenu net    70'000",
    'GeTax 2024 - imprimé le 12.03.2025    Page 2/9',
  ].join('\n');

  it('recognises the summary pages and splits two rubrics printed on one line', () => {
    expect(detectPriorDeclaration([page2])).toBe(true);
    const d = parsePriorDeclaration(['Contribuable A    Contribuable B', page2]);
    expect(d.taxYear).toBe(2024);
    expect(d.items.map((i) => `${i.form} ${i.code} ${i.person}`)).toEqual([
      'PG2 11.00 A',
      'PG2 21.50 B',
      'PG2 12.00 household',
      'PG2 91.00 household',
      'PG2 92.40 household',
    ]);
    expect(d.items[2]).toMatchObject({ annex: 'B2', icc: 500_00, ifd: 500_00 });
  });

  it('warns when a lone amount’s column can’t be told, and when pages are missing', () => {
    const d = parsePriorDeclaration(['', page2]);
    expect(d.items.find((i) => i.code === '92.40')).toMatchObject({ icc: 70_000_00 });
    expect(d.warnings.map((w) => w.code)).toEqual(['pages_missing', 'column_guess']);
    expect(d.warnings[1]).toMatchObject({ page: 2 });
    expect(d.warnings[1]!.en).toMatch(/Page 2, code 92\.40/);
  });

  it('ignores dates, phone numbers and other numbers that look like codes', () => {
    const d = parsePriorDeclaration([
      [
        '12.03.2025    Date',
        '022 000 00 00',
        '00.00.0000-0    N° de contribuable',
        '31.40    Cotisations 3e pilier A    7’000    7’000',
      ].join('\n'),
    ]);
    expect(d.items.map((i) => i.code)).toEqual(['31.40']);
    // A page of 3a and contribution lines, without a page code, is annex A of taxpayer A.
    expect(d.items[0]).toMatchObject({ person: 'A', form: 'A1', icc: 7_000_00, ifd: 7_000_00 });
  });

  it('is not fooled by the tax office’s assessment, which prints the same codes', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `9${i}.00    Ligne ${i}    1'000`);
    expect(detectPriorDeclaration([['Avis de taxation 2025', ...lines].join('\n')])).toBe(false);
    expect(
      detectPriorDeclaration([['Déclaration 2025', '91.00    Total    1', ...lines].join('\n')]),
    ).toBe(true);
  });

  it('notes years that differ between pages, and a commune it can’t pick', () => {
    const d = parsePriorDeclaration(
      [
        'GAPP24-1\n1214 Vernier\n1227 Carouge',
        "GAPP25-2\n91.00    Total    1'000    1'000",
        "GAPP25-3\n92.40    Revenu net    1'000    1'000",
      ],
      { communes },
    );
    expect(d.taxYear).toBe(2025);
    expect(d.residence).toBeUndefined();
    expect(d.warnings.map((w) => w.code)).toEqual(['years_differ', 'commune_unclear']);
  });
});

describe('amounts and warnings', () => {
  it('reads amounts as printed, into integer centimes', () => {
    expect(parseAmount("12'345")).toBe(1_234_500);
    expect(parseAmount('12’345')).toBe(1_234_500);
    expect(parseAmount("1'234.50")).toBe(123_450);
    expect(parseAmount("12'345.–")).toBe(1_234_500);
    expect(parseAmount('0')).toBe(0);
    expect(parseAmount("-4'816")).toBe(-481_600);
    expect(parseAmount("1'234'567")).toBe(123_456_700);
    for (const bad of ['12 345', "1'23", '12.03.2025', '756.0000.0000.00', 'CHF 12', '1.5', '']) {
      expect(parseAmount(bad), bad).toBeUndefined();
    }
  });

  it('gives a stored English warning back in French', () => {
    const d = parsePriorDeclaration(['', "PG3   2025\n92.40    Revenu net    70'000"]);
    const en = d.warnings.find((w) => w.code === 'column_guess')!;
    expect(localizePriorWarning(en.en, 'fr')).toBe(en.fr);
    expect(localizePriorWarning('Something else.', 'fr')).toBe('Something else.');
  });
});
