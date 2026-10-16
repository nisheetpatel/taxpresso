# Nadia Modèle, single, self-employed IT consultant, Onex

An invented Geneva household for testing Taxpresso end to end. Nobody here is real: the names, birth
dates, AHV numbers (756.0000...), address, employers, banks, insurers, account numbers and amounts
are all made up, and every document says so at the bottom of its pages.

Nadia works on her own as an IT consultant from her home in Onex, in her own name (raison individuelle). She keeps simple accounts, pays her AVS contributions as quarterly instalments, has no pension fund and so may pay more into her pillar 3a. She holds two Swiss shares at Interactive Brokers, whose Flex Query export Taxpresso reads; she looks up their official values in the ESTV price list herself.

- Nadia Modèle, born 29.01.1985, Consultante informatique

Commune: Onex.

## Documents (tax year 2025)

- `documents/01-comptes-modele-conseil-informatique-2025.pdf`: the business’s accounts (simple bookkeeping) (read by Claude, values in extracted.json)
- `documents/02-cotisations-avs-nadia-2025.pdf`: AVS contributions statement of a self-employed person (read by Claude, values in extracted.json)
- `documents/03-attestation-3a-nadia-2025.pdf`: pillar 3a attestation (read by Claude, values in extracted.json)
- `documents/04-primes-assurance-maladie-2025.pdf`: health insurance premiums of the year (read by Claude, values in extracted.json)
- `documents/05-attestation-bancaire-banque-exemple-sa-2025.pdf`: bank statement on 31 December (interest and balance) (read by Claude, values in extracted.json)
- `documents/06-interactive-brokers-modele-2025.xml`: Interactive Brokers Flex Query export (XML) (read as a broker export)

## Files

- `household.json`: the answers to Taxpresso's questions.
- `extracted.json`: what Claude would read in the documents without a barcode, per year, with page.
- `expected.json`: the tax worked out by hand from the official documents, for 2025 and 2026, each
  figure with how it was obtained and its source (ground-truth.mjs).

Written by `node test/fixtures/households/make.mjs` and `node test/fixtures/households/ground-truth.mjs`.
