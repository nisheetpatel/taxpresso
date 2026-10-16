# Filing kits

Five invented Geneva households whose right answer is known, to test Taxpresso end to end without
anyone's real data. Every name, birth date, AHV number (756.0000...), address, employer, bank,
insurer, account number (CH00 0000... IBANs), ISIN ("TXPRS", valid check digit, no real security)
and amount is made up, and every document says so at the bottom of its pages.

| Kit | Household | What it exercises |
|---|---|---|
| `essai-carouge` | single, salaried, Carouge | salary certificate barcode (Swissdec), eCH-0196 barcode, pillar 3a, premiums, travel by public transport |
| `temoin-lancy` | married, two salaries, two children in a crèche, Lancy | two barcodes and their owners, childcare per child, the reduced family charge, the two-earner deductions, meals, a donation, savings interest, last year's declaration and its suggestions |
| `exemplo-meyrin` | B permits, taxed at source, already in TOU, two children, Meyrin | tax at source in box 12, the derived source-tax facts, TOU already in place, family charges and the parental reduction |
| `fictif-thonex` | retired couple, their own flat (PPE) with a mortgage, Thônex | AVS and pension fund pensions (a form 11 pension barcode), the AFC's values letter, abattement, flat upkeep, mortgage interest, the wealth tax and its supplementary tax, 2026's 13th AVS pension |
| `modele-onex` | single, self-employed, Onex | business accounts, the owner's AVS instalments, pillar 3a without a pension fund, an Interactive Brokers Flex Query export with official values given by the user |

Each kit folder holds:

- `documents/`: the 2025 documents (PDFs and the broker export);
- `household.json`: the answers, as `answer_question` takes them (`answersByYear` for a year's own);
- `extracted.json`: per year and document, what Claude would propose with `propose_extraction`
  (value as printed, page), whose a barcode certificate is, or the official values of an export;
- `expected.json`: the tax for 2025 and 2026, worked out by hand: ICC (taxable income, rate
  income, taxable wealth, cantonal income and wealth tax, communal tax, taxe personnelle, total),
  IFD (taxable income, the income the scale is read at, tax) and the total, each figure with how
  it was obtained and its source (manifest id and page or article), every line of the return too;
- `README.md`: who they are.

## How they are made

- `kits.mjs`: the households' facts, per year. Money in centimes.
- `make.mjs`: writes the documents, `household.json`, `extracted.json` and the README, byte for
  byte the same at every run. It reuses the repo's generators: the Swissdec and eCH-0196 barcode
  builders (`packages/intake/test/barcode-fixtures.mjs`) and the declaration layout of
  `../make-prior-fixtures.mjs`. `--year 2026 --out <folder>` writes a year's documents elsewhere.
- `ground-truth.mjs`: the hand calculation. It imports nothing from Taxpresso: its constants were
  read in `docs/sources/ge/files` and `docs/sources/ch/files`, each cited, and it checks its own
  transcription against the documents' worked examples before writing `expected.json`.

Where the documents leave a case open, the households avoid it, and `ground-truth.mjs` throws if
one doesn't: whole francs on every document; even taxable incomes for split households (the rate
income is then a whole franc); cantonal base taxes that are multiples of CHF 50 (the 47.5 %, the
12 % reduction, the 1 % home care and the communal centimes are then exact, since no document says
how they are rounded); no amount at an exact half of 5 centimes; work in the commune of residence
(no share for another commune); bank interest only on statements other than e-tax statements;
travel costs under CHF 3,200; pillar 3a within its limit; a self-employed household under the
wealth social deduction (the 51.60 deduction doesn't matter); a pensioners' net income clearly
over the limit of the 61.30 deduction.

## The test

`extension/test/households.test.ts` runs each kit and year through the extension on a temporary
folder: the documents dropped in and sorted, the questions answered in the order Taxpresso asks
them (each answer must be asked, and only those), the barcode certificates given their owner,
Claude's readings proposed and confirmed in the dashboard, the export's official values given, and
then `compute_tax` compared with `expected.json` to the centime. The dashboard must say the tax is
Exact. `test/offline/run.mjs` runs `fictif-thonex` (2025) through the packaged extension.

To try a kit by hand in Claude Desktop, see `docs/demo.md`.
