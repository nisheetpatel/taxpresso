# Bernard and Monique Fictif, retired, their own flat with a mortgage, Thônex

An invented Geneva household for testing Taxpresso end to end. Nobody here is real: the names, birth
dates, AHV numbers (756.0000...), address, employers, banks, insurers, account numbers and amounts
are all made up, and every document says so at the bottom of its pages.

Bernard and Monique are retired and live in the flat they bought in a building in Thônex (propriété par étage) in 2004. Each receives an AVS pension and a pension from a pension fund (Bernard’s certificate carries the Swissdec barcode). The AFC sends them the flat’s tax value and rental value each spring; a mortgage remains, and they keep Swiss shares at a private bank, which sends an e-tax statement.

- Bernard Fictif, born 12.04.1953, Retraité (fictif)
- Monique Fictif, born 25.09.1956, Retraitée

Commune: Thônex.

## Documents (tax year 2025)

- `documents/01-rente-avs-bernard-2025.pdf`: pension certificate (attestation de rente) (read by Claude, values in extracted.json)
- `documents/02-attestation-rente-caisse-pension-bernard-2025.pdf`: pension certificate (attestation de rente) (read from its barcode)
- `documents/03-rente-avs-monique-2025.pdf`: pension certificate (attestation de rente) (read by Claude, values in extracted.json)
- `documents/04-attestation-rente-caisse-pension-monique-2025.pdf`: pension certificate (attestation de rente) (read by Claude, values in extracted.json)
- `documents/05-primes-assurance-maladie-2025.pdf`: health insurance premiums of the year (read by Claude, values in extracted.json)
- `documents/06-releve-fiscal-banque-privee-exemple-sa-2025.pdf`: bank e-tax statement (e-relevé fiscal, eCH-0196) (read from its barcode)
- `documents/07-valeurs-logement-afc-2025.pdf`: the AFC’s letter with the flat’s tax value and rental value (read by Claude, values in extracted.json)
- `documents/08-pret-hypothecaire-banque-hypothecaire-exemple-2025.pdf`: mortgage statement (interest and balance) (read by Claude, values in extracted.json)

## Files

- `household.json`: the answers to Taxpresso's questions.
- `extracted.json`: what Claude would read in the documents without a barcode, per year, with page.
- `expected.json`: the tax worked out by hand from the official documents, for 2025 and 2026, each
  figure with how it was obtained and its source (ground-truth.mjs).

Written by `node test/fixtures/households/make.mjs` and `node test/fixtures/households/ground-truth.mjs`.
