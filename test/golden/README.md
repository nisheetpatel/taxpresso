# Golden cases

What official software computes for made-up Geneva households, kept so the engine can be compared
with it offline at every run (SPEC.md section 13, item 2). Nobody's real figures are here: every
case is a round or odd number chosen to land on a rule's edge.

## `estv/`: the Federal Tax Administration's calculator

`ge-2025.json` and `ge-2026.json`: what https://swisstaxcalculator.estv.admin.ch/ answers, in whole
francs, for 605 cases a year, from the taxable income of each tax and the taxable wealth: four
households, every commune, both sides of every step of the 2025 and 2026 scales.

- Recorded by `node scripts/estv-golden.mjs` (a dev tool, needs network; `--check` reports what
  changed since).
- Compared in `packages/rules-ge/test/estv-golden.test.ts`: every figure within a franc.
- It always counts the taxe personnelle; the engine applies the law's exemption (LCP art. 377
  let. c).

The other cantons have a file a year each too (`zh-2026.json`, `be-2026.json`, ...), recorded by
`node scripts/estv-cantons-golden.mjs`: the multipliers of every commune of the canton, by BFS
number, and 174 cases in its capital (four households, a range of incomes and of wealth, the three
churches). Each canton's engine is compared with its file in `packages/rules-<canton>/test`.

## `afc/`: the Geneva tax administration's estimator

`ge-2025.json` and `ge-2026.json`: what the AFC's "Simulation fiscale"
(https://ge.ch/afcaelp1dmapublic/2026/, from
https://www.ge.ch/paiement-impots/estimer-mon-impot-modifier-mes-acomptes) answers, to 5 centimes
and line by line, for 206 cases a year: a salary as the only income, six households (a person
alone, a couple, with children, a parent alone, shared custody), every commune, every step of the
year's scales.

- Recorded by `node scripts/ge-afc-golden.mjs` (a dev tool, needs network). It fills the form's
  first two steps, reads the result and stops: the fourth step, which asks for new instalments, is
  never opened.
- Compared in `packages/rules-ge/test/afc-golden.test.ts`: every line to the centime.
- Where it parts from the documents, the documents win, and the test pins what it does:
  - with splitting it drops the fraction of the rate income, where the tariff's worked example
    rounds it to the franc (ge-2025-icc-tariff-pdf p. 4, example 4): up to 25 centimes of base tax;
  - it rounds the 12 % reduction on two lines, the tariff once: 5 centimes at most;
  - it always counts the taxe personnelle (as above);
  - it gives a parent alone the federal deduction for married couples, and a child in shared
    custody a whole charge on wealth: see docs/sources/ge/NOTES.md, "The AFC's estimator".

## GeTax

The official desktop software remains the reference for whole declarations with their deductions
(SPEC.md section 13, item 2): entering households into it is the owner's step, and their figures
would go here next to these. The six filing kits (`test/fixtures/households/`) are ready for it:
each has its documents and its tax worked out by hand.

## Real cases

Never here. A developer's own cases stay in a folder outside the repository
(`TAXPRESSO_PRIVATE_GOLDEN`, `packages/rules-ge/test/private-golden.test.ts`).
