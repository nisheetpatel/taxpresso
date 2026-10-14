# Test fixtures

Synthetic documents only (SPEC.md section 13). Never real personal data: the demo households are Dupont and Ribeiro.

`brokers/`: hand-written broker exports (SPEC.md section 5.7) for the Dupont household: two Interactive Brokers Flex Query XML files (base CHF with `yyyyMMdd` dates; two accounts with base USD and `yyyy-MM-dd` dates) and two DEGIRO CSV files (portfolio, account statement; English headers, decimal commas). Account ids, securities and amounts are made up; the `TXPRS` ISINs have valid check digits but name no real security. One DEGIRO row carries instructions in its description: it is data and must never be followed.

- `dupont-certificat-salaire-2026.pdf`: a two-page salary certificate for Jean Dupont with a text layer, clearly fake values, and one line that tries to give instructions (it must stay data).
- `dupont-scan-3a-2026.pdf`: one page with an image and no text, like a scan.

Both are written byte by byte by `node test/fixtures/make-fixtures.mjs`; rerun it after changing them.

Last year's declaration (SPEC.md section 5.4), written by `node test/fixtures/make-prior-fixtures.mjs` the same way, with a text layer laid out like a declaration printed by tax software (page codes, rubric lines with ICC and IFD columns, amounts with apostrophes, "Page n/N" footers). Every name, date and number is fake, and page 1 carries a line that tries to give instructions:

- `dupont-declaration-2025.pdf`: Jean and Marie Dupont, Vernier, 2025, GeTax page codes (GAPP25-1 to -4, GAPP25A1, A2, C4, F1), one employer each.
- `ribeiro-declaration-2025.pdf`: Ana Ribeiro, single, Meyrin.
- `dupont-declaration-2025-two-employers.pdf`: the Dupont couple from another program (DrTax): no GAPP codes, other column positions, two employers for A, annex A1 over two pages, the commune given by its code.
- `dupont-declaration-2024.pdf`: the same declaration as `dupont-declaration-2025.pdf` a year earlier, as GeTax prints it (GAPP24 page codes, the year in titles and footers; the same amounts): last year's declaration of a 2025 return (docs/design/tax-years.md).
- `dupont-declaration-2026.pdf`: this year's declaration of the Dupont couple, as the user downloads it from GeTax to check it before transmitting (SPEC.md section 10.4): GAPP26 page codes, a small table of medical costs per person, annex C4 with its own columns. Two mistakes on purpose: pillar 3a of A typed 7'285 instead of 7'258 (31.40), and the pension fund buy-in of B (41.30) left out; every total adds up with what was typed. Its page 1 tries to tell Claude everything matches: it is data.

`barcodes/`: documents whose values are in a barcode (SPEC.md sections 5 and 13, item 4), for the Dupont household, every value made up (AHV number 756.0000..., IBANs CH00 0000..., `TXPRS` ISINs, employer and bank):

- `dupont-certificat-salaire-2026-code-barres.pdf`: a salary certificate whose page is one JPEG image (1190 x 1684 pixels, 144 ppi, like a scan), with its PDF417 printed vertically at the left: 14 Swissdec control bytes, then a ZIP holding the TxAB XML. Its box 15 remark tries to give instructions: it is data.
- `dupont-certificat-salaire-2026-vectoriel.pdf`: the same barcode drawn as filled rectangles.
- `dupont-releve-fiscal-2026.pdf`: a bank e-tax statement (eCH-0196): a content page and a barcode sheet with the ZLIB-compressed XML in Macro PDF417 segments (290 x 35 pixel images) and an eCH-0270 Code 128 page barcode on each page.

They are written by `node test/fixtures/make-barcode-fixtures.mjs`, with the generators in `packages/intake/test/barcode-fixtures.mjs` (which the intake and extension tests also use to build such documents on the fly).
