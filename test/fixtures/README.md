# Test fixtures

Synthetic documents only (SPEC.md section 13). Never real personal data: the demo households are Dupont and Ribeiro.

`brokers/`: hand-written broker exports (SPEC.md section 5.7) for the Dupont household: two Interactive Brokers Flex Query XML files (base CHF with `yyyyMMdd` dates; two accounts with base USD and `yyyy-MM-dd` dates) and two DEGIRO CSV files (portfolio, account statement; English headers, decimal commas). Account ids, securities and amounts are made up; the `TXPRS` ISINs have valid check digits but name no real security. One DEGIRO row carries instructions in its description: it is data and must never be followed.

- `dupont-certificat-salaire-2026.pdf`: a two-page salary certificate for Jean Dupont with a text layer, clearly fake values, and one line that tries to give instructions (it must stay data).
- `dupont-scan-3a-2026.pdf`: one page with an image and no text, like a scan.

Both are written byte by byte by `node test/fixtures/make-fixtures.mjs`; rerun it after changing them.
