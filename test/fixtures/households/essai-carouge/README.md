# Sophie Essai, single, salaried, Carouge

An invented Geneva household for testing Taxpresso end to end. Nobody here is real: the names, birth
dates, AHV numbers (756.0000...), address, employers, banks, insurers, account numbers and amounts
are all made up, and every document says so at the bottom of its pages.

Sophie is an architect employed full time by a firm in Carouge, where she lives. She pays into a pension fund through her employer and the maximum into her pillar 3a, takes the tram to work and keeps her savings at one bank, which sends her an e-tax statement (a current account and a Swiss equity fund).

- Sophie Essai, born 14.03.1993, Architecte

Commune: Carouge.

## Documents (tax year 2025)

- `documents/01-certificat-salaire-sophie-2025.pdf`: salary certificate (certificat de salaire, form 11) (read from its barcode)
- `documents/02-attestation-3a-sophie-2025.pdf`: pillar 3a attestation (read by Claude, values in extracted.json)
- `documents/03-primes-assurance-maladie-2025.pdf`: health insurance premiums of the year (read by Claude, values in extracted.json)
- `documents/04-releve-fiscal-banque-exemple-sa-2025.pdf`: bank e-tax statement (e-relevé fiscal, eCH-0196) (read from its barcode)

## Files

- `household.json`: the answers to Taxpresso's questions.
- `extracted.json`: what Claude would read in the documents without a barcode, per year, with page.
- `expected.json`: the tax worked out by hand from the official documents, for 2025 and 2026, each
  figure with how it was obtained and its source (ground-truth.mjs).

Written by `node test/fixtures/households/make.mjs` and `node test/fixtures/households/ground-truth.mjs`.
