# Tiago and Marta Exemplo, B permits, taxed at source and already in TOU, two children, Meyrin

An invented Geneva household for testing Taxpresso end to end. Nobody here is real: the names, birth
dates, AHV numbers (756.0000...), address, employers, banks, insurers, account numbers and amounts
are all made up, and every document says so at the bottom of its pages.

Tiago and Marta came to Geneva with B permits and work for two companies in Meyrin, where they live with Leo and Mia, who are at school. Their employers take the tax at source from their salaries (box 12 of the salary certificates); the tax office already taxes them ordinarily afterwards (TOU), so they file a full declaration and the tax taken at source counts towards the tax. Tiago pays into a pillar 3a; both take the tram.

- Tiago Exemplo, born 17.02.1988, Mécanicien (fictif)
- Marta Exemplo, born 30.07.1990, Laborantine

Children:

- Leo, born 08.03.2014
- Mia, born 21.10.2017

Commune: Meyrin.

## Documents (tax year 2025)

- `documents/01-certificat-salaire-tiago-2025.pdf`: salary certificate (certificat de salaire, form 11) (read from its barcode)
- `documents/02-certificat-salaire-marta-2025.pdf`: salary certificate (certificat de salaire, form 11) (read from its barcode)
- `documents/03-attestation-3a-tiago-2025.pdf`: pillar 3a attestation (read by Claude, values in extracted.json)
- `documents/04-primes-assurance-maladie-2025.pdf`: health insurance premiums of the year (read by Claude, values in extracted.json)
- `documents/05-attestation-bancaire-banque-exemple-sa-2025.pdf`: bank statement on 31 December (interest and balance) (read by Claude, values in extracted.json)

## Files

- `household.json`: the answers to Taxpresso's questions.
- `extracted.json`: what Claude would read in the documents without a barcode, per year, with page.
- `expected.json`: the tax worked out by hand from the official documents, for 2025 and 2026, each
  figure with how it was obtained and its source (ground-truth.mjs).

Written by `node test/fixtures/households/make.mjs` and `node test/fixtures/households/ground-truth.mjs`.
