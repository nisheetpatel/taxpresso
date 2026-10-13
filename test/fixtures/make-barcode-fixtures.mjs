#!/usr/bin/env node
// Writes the synthetic barcode fixtures (SPEC.md section 13, item 4), Dupont household only, every
// value made up (AHV 756.0000..., IBANs CH00 0000..., "TXPRS" ISINs):
//
//   node test/fixtures/make-barcode-fixtures.mjs
//
// barcodes/dupont-certificat-salaire-2026-code-barres.pdf  one page that is a single JPEG image
//     (1190 x 1684 pixels, 144 ppi), the salary certificate's PDF417 printed vertically at the
//     left: 14 Swissdec control bytes, a ZIP with one entry "txab", the TxAB XML (ELM 5.0)
// barcodes/dupont-certificat-salaire-2026-vectoriel.pdf    the same barcode drawn as rectangles
// barcodes/dupont-releve-fiscal-2026.pdf                   an e-tax statement (eCH-0196): a
//     content page and a barcode sheet with ZLIB-compressed XML in Macro PDF417 segments,
//     290 x 35 pixel images, and an eCH-0270 Code 128 page barcode on each page
//
// The generators live with the intake tests (packages/intake/test/barcode-fixtures.mjs), which
// also build these documents on the fly; these copies are for the offline test of the packaged
// extension and for trying the dashboard by hand.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  salaryCertificateJpegPdf,
  salaryCertificateVectorPdf,
  statementPdf,
} from '../../packages/intake/test/barcode-fixtures.mjs';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'barcodes');
mkdirSync(dir, { recursive: true });
const files = {
  'dupont-certificat-salaire-2026-code-barres.pdf': await salaryCertificateJpegPdf(),
  'dupont-certificat-salaire-2026-vectoriel.pdf': await salaryCertificateVectorPdf(),
  'dupont-releve-fiscal-2026.pdf': (await statementPdf()).bytes,
};
for (const [name, bytes] of Object.entries(files)) {
  writeFileSync(path.join(dir, name), bytes);
  console.log(`${name}: ${bytes.length} bytes`);
}
