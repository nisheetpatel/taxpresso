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
