# Thomas and Laura Témoin, married, two salaries, two children in a crèche, Lancy

An invented Geneva household for testing Taxpresso end to end. Nobody here is real: the names, birth
dates, AHV numbers (756.0000...), address, employers, banks, insurers, account numbers and amounts
are all made up, and every document says so at the bottom of its pages.

Thomas is an engineer and Laura a biologist; both work for employers in Lancy, where they live with Hugo and Inès, who go to a crèche. Both pay into a pension fund and a pillar 3a. Thomas takes the bus and eats out at lunch; Laura walks to work. They keep their savings in a joint account, give to a children’s charity each year, and kept last year’s declaration, which Taxpresso reads for suggestions.

- Thomas Témoin, born 21.06.1987, Ingénieur (fictif)
- Laura Témoin, born 04.11.1989, Biologiste

Children:

- Hugo, born 10.05.2021
- Inès, born 02.09.2023

Commune: Lancy.

## Documents (tax year 2025)

- `documents/01-certificat-salaire-thomas-2025.pdf`: salary certificate (certificat de salaire, form 11) (read from its barcode)
- `documents/02-certificat-salaire-laura-2025.pdf`: salary certificate (certificat de salaire, form 11) (read from its barcode)
- `documents/03-attestation-3a-thomas-2025.pdf`: pillar 3a attestation (read by Claude, values in extracted.json)
- `documents/04-attestation-3a-laura-2025.pdf`: pillar 3a attestation (read by Claude, values in extracted.json)
- `documents/05-primes-assurance-maladie-2025.pdf`: health insurance premiums of the year (read by Claude, values in extracted.json)
- `documents/06-creche-hugo-2025.pdf`: crèche, yearly statement of the fees paid (read by Claude, values in extracted.json)
- `documents/07-creche-ines-2025.pdf`: crèche, yearly statement of the fees paid (read by Claude, values in extracted.json)
- `documents/08-attestation-dons-2025.pdf`: donation receipt (read by Claude, values in extracted.json)
- `documents/09-attestation-bancaire-banque-exemple-sa-2025.pdf`: bank statement on 31 December (interest and balance) (read by Claude, values in extracted.json)
- `documents/10-declaration-2024.pdf`: last year’s declaration, printed by GeTax (last year’s declaration, gives suggestions)

## Files

- `household.json`: the answers to Taxpresso's questions.
- `extracted.json`: what Claude would read in the documents without a barcode, per year, with page.
- `expected.json`: the tax worked out by hand from the official documents, for 2025 and 2026, each
  figure with how it was obtained and its source (ground-truth.mjs).

Written by `node test/fixtures/households/make.mjs` and `node test/fixtures/households/ground-truth.mjs`.
