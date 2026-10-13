# Several cantons: design note

Milestone 0.3.0 adds Zurich, Bern and Vaud. This note says how, with the least duplication. It is a plan: nothing here is wired yet except `packages/rules-zh` (Zurich's cantonal and communal tax, not used by the extension).

## 1. What stays Geneva and what is Swiss

Today `packages/rules-ge` holds both the Geneva tax (ICC) and the federal tax (IFD), plus helpers every canton needs. The federal tax is the same in every canton; only the form it is declared on changes. Split it into a new package, `packages/rules-ch`, before wiring a second canton.

What moves to `packages/rules-ch` (same code, new home; `rules-ge` re-exports the moved names during the move so no import elsewhere changes at first):

| From `packages/rules-ge/src/` | To `packages/rules-ch/src/` | Why it is Swiss |
|---|---|---|
| `2025/icc.ts` (`Cited<T>` only), `engine/param.ts`, `engine/calc.ts` | `core/cited.ts`, `core/calc.ts` | Cited constants, integer centimes, rounding, `Trace` |
| `engine/types.ts` (`Amount`, `Line`, `Item`, `Text`, the household input) | `core/types.ts` | One input shape and one result shape for every canton (section 2) |
| `2025/ifd.ts`, `2026/ifd.ts`, `2026/ifd-amounts.ts` | `ifd/2025.ts`, `ifd/2026.ts` | Federal scales and deductions (ESTV circulars, Form. 58c) |
| the IFD half of `engine/assess.ts` and of `engine/compute.ts` (`personItems`) | `ifd/assess.ts`, `ifd/items.ts` | Taxable income to tax, art. 36 LIFD; federal deduction items |
| `engine/rules.ts` (flat professional costs, medical threshold, donations, two earners, 3a without a fund, meals) | `core/rules.ts` | Pure functions; each canton passes its own cited parameters |
| `2026/pillar3a.ts`, `2026/pension.ts` | `pension/` | OPP 3 and LPP limits, the 3a catch-up |
| `2026/withholding.ts`, `2026/exchange-rates.ts` | `withholding/` | Swiss withholding tax, DA-1, ESTV rates |
| `source-tax/ascii.ts` (the ESTV record format reader) | `source-tax/ascii.ts` | Federal file format; the Geneva tables stay in `data/ge/` |
| `engine/from-ledger.ts` | `core/from-ledger.ts` | Ledger facts to the household input; canton extras go in `input.cantonal` |
| `2026/keys-securities.ts`, `2026/keys-ech0196.ts`, the salary certificate part of `2026/document-keys.ts` | `keys/` | Federal form 11 boxes, eCH-0196: the same documents in every canton |

What stays in `rules-ge`: the ICC scales and amounts, splitting, the communal centimes and privileged shares, the LCP personal tax, the Geneva rubric codes, the état des titres (F2 to F4), TOU and the Geneva source-tax tables, the consistency checks that cite the Geneva guide, the assessment and objection deadline (LPFisc for the ICC; the LIFD half moves).

Federal items are keyed by concept, not by Geneva rubric: `rules-ch` returns `{ concept: 'professional.flat', person, amount, ... }` and each canton maps a concept to its form code (`31.20` in Geneva, `220` in the Bundessteuer column in Zurich).

Acceptance for the split: not one number changes. `packages/rules-ge/test/households.test.ts`, `ifd.test.ts`, `scales.test.ts` and the private golden cases pass unchanged, and `pnpm check:bundle` shows the same bundle contents.

## 2. The canton interface

Each canton is three packages and one data folder, the shape Geneva already has:

```
packages/rules-<c>/      the cantonal and communal tax, by year; exports `rules: CantonRules`
packages/filing-<c>/     form map, copy panel order, reconciliation; exports `filing: CantonFiling`
data/<c>/<year>/         questionnaire.yaml (and canton data files)
docs/sources/<c>/        manifest.json, NOTES.md (already there for 15 cantons)
```

The interface lives in `packages/rules-ch/src/canton.ts` (types only):

```ts
export interface CantonRules {
  canton: 'GE' | 'ZH' | 'BE' | 'VD';
  taxYears: readonly number[];                     // years with official values; others throw
  communes(taxYear: number): readonly Commune[];    // { bfs, slug, name, rates }, cited
  computeReturn(input: HouseholdInput): TaxResult;  // cantonal + communal + IFD (via rules-ch)
  keys(taxYear: number): KeyRegistry;               // rules-ch shared keys + the canton's own
  documents(taxYear: number): readonly DocumentRule[]; // what to attach, with the guide page
  sourcesIndex: string;                             // docs/sources/<c>, for search_official_docs
}

export interface CantonFiling {
  formMap(taxYear: number): FormMap;                // pages, sections, codes, labels as printed
  formValues(result: TaxResult, facts: LedgerView): FormValues;  // copy panel
  reconcile(pdfText: string, values: FormValues): Reconciliation;
}
```

- `HouseholdInput` is Geneva's `EngineInput` with the Geneva-only fields moved under `cantonal` (Geneva: `splitting`; Zurich: `church`, `communeVariant`; Vaud: the quotient familial parts). `packages/rules-zh/src/types.ts` already follows `EngineInput`'s field names, so `from-ledger` serves both.
- `TaxResult` keeps today's top level (`taxYear`, `commune`, `icc`, `ifd`, `total`, `estimates`, `needsOk`, `complete`, `incomplete`, `assumptions`, `notCounted`, `unsupported`, `unverifiedRules`). `icc` means "cantonal and communal tax" in every canton; its common fields (`items`, `grossIncome`, `netIncome`, `taxableIncome`, `wealth`, `taxes.total`) are read by the dashboard, and `taxes` carries the canton's own lines (Geneva: centimes additionnels, 12 % reduction; Zurich: einfache Staatssteuer, Steuerfuss, Personalsteuer). The dashboard shows `taxes` as an ordered list of lines, so it needs no canton code.
- Communes are identified by their BFS number (federal commune number), which every canton's tables carry; `slug` stays for display and for Geneva's facts already stored as slugs (`profile.commune`).
- The questionnaire engine already takes its file, keys and communes as arguments (`new QuestionnaireEngine(file, keys, communes)`): it needs no change beyond reading `profile.canton` first.
- The extension gets one registry, `extension/src/cantons.ts`: `{ GE: { rules, filing, questionnaire }, ZH: ... }`. `main.ts` stops importing `COMMUNES_2026` and `KEYS_2026` from `rules-ge` and asks the registry for the canton of the year being prepared.
- Prior-return parsing (`packages/intake/src/prior/`) and the état des titres are form-specific: they move behind `CantonFiling` when a second canton needs them; until then Zurich has none.

## 3. Choosing the canton

- The canton is the one you lived in on 31 December of the tax year. That canton taxes the whole year, cantonal, communal and federal tax, when you moved from another canton during the year (zh-2025-guide-natuerliche-personen p. 5 and 6; ge-2025-guide-declaration-pp p. 53). The rates are those in force at the end of the year (Zurich: StG § 53, zh-2026-law-steuergesetz-631-1-stand-2026 p. 27).
- The commune follows the same rule inside Zurich: the commune you lived in at the end of the year taxes the whole year (StG § 190, zh-2026-law-steuergesetz-631-1-stand-2026 p. 73).
- New first question, `profile.canton` (stated, `via: chat | dashboard`), asked before the commune. It is prefilled from last year's return when there is one, never guessed from an address in a document.
- A move between cantons during the year then stops being "not supported" (today `data/ge/2026/questionnaire.yaml`, question `moved`, option `from_other_canton`): the new canton's return covers the whole year. Still out of scope: arriving from or leaving for abroad (part-year liability), and property or a business in another canton (intercantonal allocation).
- A canton Taxpresso does not cover yet: the canton question says so and stops, like any other "not supported" answer.

## 4. Vault layout

No per-canton folder. One tax year has one canton, so `~/Documents/Taxpresso/<year>/` stays as it is and the canton is a fact in that year's ledger (`profile.canton`). Documents are canton-neutral (salary certificates and bank statements are the same everywhere). A household that moves has `2025/` with Geneva and `2026/` with Zurich, each folder saying which canton it is. If the user corrects the canton, the facts stay; answers to questions the new canton doesn't ask are kept but not used, and say so. Last year's review compares across cantons only what is federal.

## 5. What each new canton needs

1. Sources: the consolidated tax law for each year, the tariff (or cold-progression ordinance), the cantonal multiplier decision, the communal multipliers table, the guide and forms, the professional-costs ordinance; fetched, conflicts in `docs/sources/<c>/NOTES.md`.
2. `packages/rules-<c>`: `src/<year>/` cited constants that throw for an unknown year; `src/<year>/communes.ts` generated from the official table by `scripts/<c>-communes.mjs` (with `--check`); `computeReturn` to `TaxResult`; tests on the official worked examples, 4 to 6 synthetic households with hand derivations, and a test that every citation is an `ok` entry of `docs/sources/lock.json`.
3. `data/<c>/<year>/questionnaire.yaml` and `src/<year>/keys.ts`, with the test that keeps them in step (as for Geneva).
4. `packages/filing-<c>`: the form map from the official specimen (codes, labels, pages, cited), the copy panel order, the reconciliation parser for the canton's official PDF.
5. Extension: register the canton in `extension/src/cantons.ts`; server instructions and the "not supported" texts name the canton's own free software (ZHprivateTax, TaxMe-Online in Bern, VaudTax); bundle the canton's source passages (SPEC.md 7b).
6. UI: German strings for Zurich and Bern (SPEC.md section 1 already plans German); official terms in the canton's language next to the gloss.
7. [HUMAN] Golden households entered in the canton's official software, matched to the franc; the canton's field-map capture.

## 6. Order of work

1. `packages/rules-ch` split (section 1), Geneva unchanged to the centime.
2. `CantonRules`, `HouseholdInput`, the registry with Geneva only, and `profile.canton`.
3. Zurich: `packages/rules-zh` (started: tax years 2025 and 2026, cantonal, communal, church tax opt-in, Personalsteuer), then its questionnaire, `packages/filing-zh` and the German UI.
4. Bern: reuses the German UI and the Zurich work on German forms.
5. Vaud: reuses the French UI; first a person opens the communal coefficient tables and the consolidated LI and RDVE in a browser, which the collecting tool could not read (docs/sources/README.md, known conflicts).

## Open points for the lead

- The Zurich communal table gives two or three multipliers for some communes (Uster, Turbenthal in 2026: two school districts) without naming the parts. `rules-zh` asks for the variant and does not compute without it. The questionnaire needs the area names from the commune or the canton.
- Zurich's rounding of taxable amounts and of the tax is not in the documents in the library (`docs/sources/zh/NOTES.md`, "Open points for the rules"); `rules-zh` reports what it assumed in `unverifiedRules`. One official tax example (the online calculator's printout or an assessment) would settle it.
- The 2026 Staatssteuerfuss: the Kantonsrat decision says 95 %, the 2026 source-tax parameter sheet says 98 % (see `docs/sources/zh/NOTES.md`). `rules-zh` uses the decision.
