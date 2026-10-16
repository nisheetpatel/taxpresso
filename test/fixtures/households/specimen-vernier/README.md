# Léa Spécimen, single, lives in Vernier, works in the City of Geneva

An invented Geneva household for testing Taxpresso end to end. Nobody here is real: the names, birth
dates, AHV numbers (756.0000...), address, employers, banks, insurers, account numbers and amounts
are all made up, and every document says so at the bottom of its pages.

Léa is a lawyer employed full time by a firm in the City of Geneva; she lives in Vernier and takes the tram to work. She pays into a pension fund through her employer and the maximum into her pillar 3a, and keeps her savings in a current account that earns no interest. Her salary is all her income, so the part of her communal tax that doesn’t stay in Vernier goes to Genève.

- Léa Spécimen, born 02.07.1990, Juriste

Commune: Vernier.

## Documents (tax year 2025)

- `documents/01-certificat-salaire-lea-2025.pdf`: salary certificate (certificat de salaire, form 11) (read from its barcode)
- `documents/02-attestation-3a-lea-2025.pdf`: pillar 3a attestation (read by Claude, values in extracted.json)
- `documents/03-primes-assurance-maladie-2025.pdf`: health insurance premiums of the year (read by Claude, values in extracted.json)
- `documents/04-attestation-bancaire-banque-exemple-sa-2025.pdf`: bank statement on 31 December (interest and balance) (read by Claude, values in extracted.json)

## Files

- `household.json`: the answers to Taxpresso's questions.
- `extracted.json`: what Claude would read in the documents without a barcode, per year, with page.
- `expected.json`: the tax worked out by hand from the official documents, for 2025 and 2026, each
  figure with how it was obtained and its source (ground-truth.mjs).

Written by `node test/fixtures/households/make.mjs` and `node test/fixtures/households/ground-truth.mjs`.
