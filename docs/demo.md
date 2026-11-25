# Try Taxpresso on a filing kit

A filing kit is a made-up Geneva household with everything it needs to file: its documents, the
answers it gives to Taxpresso's questions, and its tax worked out by hand from the official
documents. Nothing in a kit is real: the people, addresses, employers, banks, insurers, account
numbers and amounts are invented, and every document says so at the bottom of its pages.

The kits are in `test/fixtures/households/`, one folder each:

| Kit | Who | Documents |
|---|---|---|
| `essai-carouge` | Sophie Essai, single, salaried, Carouge | 4: salary certificate (barcode), pillar 3a, health premiums, bank e-tax statement (barcode) |
| `temoin-lancy` | Thomas and Laura Témoin, married, two children in a crèche, Lancy | 10: two salary certificates (barcode), two pillar 3a, premiums, two crèche statements, a donation, a savings account, last year's declaration |
| `exemplo-meyrin` | Tiago and Marta Exemplo, B permits, taxed at source, already in TOU, Meyrin | 5: two salary certificates with the tax taken at source (barcode), pillar 3a, premiums, a bank account |
| `fictif-thonex` | Bernard and Monique Fictif, retired, their own flat with a mortgage, Thônex | 8: two AVS attestations, two pension fund certificates (one with a barcode), premiums, a bank e-tax statement (barcode), the AFC's letter with the flat's values, the mortgage statement |
| `modele-onex` | Nadia Modèle, single, self-employed, Onex | 6: business accounts, AVS contributions, pillar 3a, premiums, a bank account, an Interactive Brokers export |
| `specimen-vernier` | Léa Spécimen, single, lives in Vernier, works in the City of Geneva | 4: salary certificate (barcode), pillar 3a, premiums, a bank account |

Each kit has a `README.md` (who they are), `household.json` (their answers), `extracted.json`
(what Claude should read in the documents without a barcode) and `expected.json` (the tax for
2025 and 2026, each figure with how it was obtained and its official source).

## Before you start: use a separate folder

Never put a kit into a Taxpresso folder that holds your own tax documents. In Claude Desktop, open
Settings, then Extensions, then Taxpresso, and set the Taxpresso folder to an empty folder, for
example `~/Documents/Taxpresso-demo`. Set it back to your own folder when you are done.

## Try it

1. In Claude, say: "Open tax year 2025." The kits' documents are for 2025.
2. Copy the files of the kit's `documents/` folder into the `2025` folder inside your demo
   Taxpresso folder (for example `~/Documents/Taxpresso-demo/2025/`). Taxpresso sorts them within
   a few seconds; you can also say "Check my folder."
3. Say: "Let's do my taxes." Answer each question the way the kit's `README.md` and
   `household.json` describe the household. For `temoin-lancy`, last year's declaration suggests
   most answers: each suggestion is what the household says.
4. Documents with a barcode (salary certificates, e-tax statements, one pension certificate) are
   read by Taxpresso on its own. For a couple, say whose each certificate is when Claude asks.
5. Claude reads the other documents and proposes their values. Check each against
   `extracted.json`, then confirm it in the dashboard (Your tax) or in the chat.
6. For `modele-onex`, give each security's official value when Claude asks: they are in
   `extracted.json` under the export (the ESTV price list values for this made-up household).
7. Say: "What is my tax?" The cantonal and communal tax (ICC), the federal tax (IFD) and the total
   should match `expected.json` for 2025 to the centime, and the dashboard should say Exact.

The quickest kit is `essai-carouge`. The fullest is `fictif-thonex`.

## Tax year 2026

The kits also cover 2026, with the amounts of 2026. Write their 2026 documents into a folder of
your choice, then do the same with the `2026` folder and "Open tax year 2026":

```
node test/fixtures/households/make.mjs --year 2026 --out kits-2026 essai-carouge
```

For 2026, Geneva's scales and indexed amounts are the official ones (the regulation of 8 October
2025, `ge-2026-rcepf`), and so are the federal figures. Only the ceiling for health insurance
premiums of 2026 comes with the 2026 guide in January 2027: the households' premiums are under the
2025 ceiling, and `expected.json` marks the 2026 figures provisional for that reason alone, as
Taxpresso flags them as estimates.

## For developers

- `node test/fixtures/households/make.mjs` rewrites the documents, `household.json` and
  `extracted.json`; `node test/fixtures/households/ground-truth.mjs` rewrites `expected.json`.
  Both are deterministic.
- `extension/test/households.test.ts` runs every kit and year through the extension, from a
  temporary folder, and compares the tax with `expected.json` to the centime. The offline test
  (`pnpm test:offline`) runs `fictif-thonex` through the packaged extension with the network
  guard on.
