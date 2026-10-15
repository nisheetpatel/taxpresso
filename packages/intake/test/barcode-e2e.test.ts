// Barcodes end to end (SPEC.md section 13, item 4): synthetic documents made here are read back
// through the same path the extension uses: PDF.js finds the images and the vector rectangles,
// ZXing (WebAssembly, loaded from disk) reads the symbols, then the payload is joined, unpacked,
// checked against the schema and mapped.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readBarcodes } from '../src/index.js';
import {
  FAKE_AHV,
  ech0196Xml,
  encodeJpeg,
  pdf417Matrix,
  render,
  salaryCertificateJpegPdf,
  salaryCertificateVectorPdf,
  statementPdf,
  txabSymbols,
  txabXml,
  txabZip,
  zip,
  zlibCompress,
} from './barcode-fixtures.mjs';

const TIMEOUT = 300_000;

describe('salary certificate barcode, end to end', () => {
  it(
    'reads a scanned JPEG page: rotated PDF417, Swissdec header, ZIP, XML, boxes',
    async () => {
      const pdf = await salaryCertificateJpegPdf();
      const result = await readBarcodes(pdf, 'certificat.pdf');
      expect(result.found).toBe('txab');
      if (result.found !== 'txab') return;
      const c = result.certificate;
      expect(c).toMatchObject({
        version: 'elm5',
        form: 'S',
        docId: 'TXPRS-2026-0001',
        periodFrom: '2026-01-01',
        periodTo: '2026-12-31',
        employer: 'Espresso Industries SA',
        employee: { firstName: 'Jean', lastName: 'Dupont' },
      });
      const byPath = Object.fromEntries(c.values.map((v) => [v.path, v]));
      expect(byPath['S/GrossIncome']).toEqual({
        path: 'S/GrossIncome',
        box: '8',
        centimes: 8_500_000,
      });
      expect(byPath['S/NetIncome']?.centimes).toBe(7_535_250);
      expect(byPath['S/CanteenLunchCheck']).toMatchObject({ box: 'G', flag: true });
      expect(result.diagnostics).toMatchObject({
        sources: ['image'],
        txab: { layout: 'swissdec', symbols: 1 },
      });
      // id 12345678, "z", size (3 bytes), first page, version 3, symbol 01 of 01.
      expect(result.diagnostics.txab?.headers[0]).toMatch(/^123456787a[0-9a-f]{6}0103000100 ?01$/);
      // The AHV number is checked, never handed back.
      expect(JSON.stringify(result)).not.toContain(FAKE_AHV);
    },
    TIMEOUT,
  );

  it(
    'reads scans whose modules are fractions of a pixel over 1 (12 mil at 144 ppi is about 1.7)',
    async () => {
      for (const module of [1.75, 1.5, 1.25]) {
        const result = await readBarcodes(
          await salaryCertificateJpegPdf({ module, quality: 70 }),
          'scan.pdf',
        );
        expect(result.found, `module ${module}`).toBe('txab');
      }
    },
    TIMEOUT,
  );

  it(
    'reads a certificate split over two symbols, joined by their counters',
    async () => {
      const result = await readBarcodes(await salaryCertificateJpegPdf({ parts: 2 }), 'x.pdf');
      expect(result.found).toBe('txab');
      expect(result.diagnostics.txab?.symbols).toBe(2);
    },
    TIMEOUT,
  );

  it(
    'reads a barcode drawn as vector rectangles',
    async () => {
      const result = await readBarcodes(await salaryCertificateVectorPdf(), 'vector.pdf');
      expect(result.found).toBe('txab');
      expect(result.diagnostics.sources).toEqual(['vector']);
    },
    TIMEOUT,
  );

  it(
    'reads a photo of the barcode (PNG or JPEG file)',
    async () => {
      const [symbol] = txabSymbols(txabZip(txabXml({ version: 'elm6' })));
      const img = render(await pdf417Matrix(symbol!), { module: 3, row: 9, quiet: 30 });
      const result = await readBarcodes(encodeJpeg(img, 90), 'photo.jpg');
      expect(result.found).toBe('txab');
      if (result.found === 'txab') expect(result.certificate.version).toBe('elm6');
    },
    TIMEOUT,
  );
});

describe('e-tax statement barcode, end to end', () => {
  it(
    'joins Macro PDF417 segments from 290 x 35 images, in any order on the sheet',
    async () => {
      const { bytes, segments } = await statementPdf({ order: [3, 1, 0, 2] });
      expect(segments).toBe(4);
      const result = await readBarcodes(bytes, 'releve.pdf');
      expect(result.found).toBe('ech0196');
      if (result.found !== 'ech0196') return;
      expect(result.diagnostics.ech0196).toEqual({ segments: 4, compression: 'zlib' });
      const s = result.statement;
      expect(s).toMatchObject({ taxPeriod: 2026, institution: 'Banque Fictive Espresso SA' });
      expect(s.accounts.map((a) => [a.id, a.valueChf, a.incomeA, a.withholding])).toEqual([
        ['CH0000000000000000001', 1_234_565, 25_000, 8_750],
        ['CH0000000000000000002', 95_000, 0, 0],
      ]);
      expect(JSON.stringify(s)).not.toContain('TXP-000001');
    },
    TIMEOUT,
  );

  it(
    'says what is missing when a segment is gone, and still knows the kind from the page barcode',
    async () => {
      const { bytes } = await statementPdf({ drop: [1] });
      const result = await readBarcodes(bytes, 'releve.pdf');
      expect(result.found).toBe('none');
      if (result.found !== 'none') return;
      expect(result.classified).toBe('ech0196_statement');
      expect(result.diagnostics.problems.join(' ')).toMatch(/3 of 4 barcode segments/);
    },
    TIMEOUT,
  );

  it(
    'accepts a ZIP payload as well as ZLIB (the standards disagree)',
    async () => {
      const { bytes } = await statementPdf({
        compress: (xml) => zip([{ name: 'taxstatement.xml', data: Buffer.from(xml) }]),
      });
      const result = await readBarcodes(bytes, 'releve.pdf');
      expect(result.found).toBe('ech0196');
      expect(result.diagnostics.ech0196?.compression).toBe('zip');
    },
    TIMEOUT,
  );

  it(
    'reads a statement carried by one plain PDF417 symbol',
    async () => {
      // Only the accounts: small enough for one symbol.
      const xml = ech0196Xml().replace(/<listOfLiabilities[\s\S]*<\/listOfSecurities>/, '');
      const img = render(await pdf417Matrix(zlibCompress(xml), { columns: 20 }), {
        module: 2,
        row: 6,
        quiet: 20,
      });
      const result = await readBarcodes(encodeJpeg(img, 92), 'one.jpg');
      expect(result.found).toBe('ech0196');
    },
    TIMEOUT,
  );
});

describe('documents without a usable barcode', () => {
  it('finds nothing in a text PDF, quickly', async () => {
    const pdf = readFileSync(
      new URL('../../../test/fixtures/dupont-certificat-salaire-2026.pdf', import.meta.url),
    );
    const result = await readBarcodes(new Uint8Array(pdf), 'cert.pdf');
    expect(result).toMatchObject({ found: 'none', diagnostics: { pdf417: 0 } });
  });

  it('never throws for a broken file', async () => {
    const result = await readBarcodes(Buffer.from('%PDF-1.7 not really'), 'x.pdf');
    expect(result.found).toBe('none');
  });
});
