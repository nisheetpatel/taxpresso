# Tax years: design note

Taxpresso prepares tax year 2026 by default and, since 14 October 2026 (the owner's decision), tax year 2025 for Geneva: for someone who has not filed yet, or who wants to check the 2025 return they filed and its assessment. This note says how the year is chosen, how the years stay apart, and how a year is added.

## 1. The choice: one open year, kept in the folder

- One tax year is open at a time. 2026 opens until the user chooses another (`DEFAULT_TAX_YEAR`, `extension/src/years.ts`, from `CURRENT_TAX_YEAR` in `config.ts`).
- The user chooses in the chat (Claude calls `open_tax_year`, the voice mic included) or in the dashboard (the year switch in the header, and the "Open 2026 and its plans" button of a year that is over). Both call `TaxYears.open(year, via)` and write the same record.
- The record is the only thing stored: `open-year.json` at the root of the Taxpresso folder, `{ "version": 1, "taxYear": 2025, "via": "chat" | "dashboard", "at": "..." }`. It is written only when the user chooses (reading never creates the folder), atomically, and refused in a folder inside a code repository, like every write. It keeps the choice for the next start of Claude Desktop.
- A missing or unreadable file opens 2026. A file naming a year this version doesn't prepare opens 2026 too, and `get_status` says so (`yearNote`).
- `get_status` always says which year is open: its first lines and `taxYear`, with every year offered and its cantons (`years`). The dashboard shows the open year in its header.

Everything else stays derived, never stored (CLAUDE.md): which years exist (the canton registry, section 3), which cantons a year has, whether a year is over, what is missing, what applies.

## 2. Keeping the years apart

- Each year is its own folder: `<Taxpresso>/2025/` and `<Taxpresso>/2026/`, each with its ledger (every fact carries its `taxYear`, SPEC.md section 4), its documents, the skipped questions and optional documents (`questionnaire.json`), the "Entered" ticks (`entered.json`) and the TOU decisions (`decisions.json`).
- Each year has its own `Workspace` object, with its own canton registry, questionnaire and caches (the decisions, the last export, the activity). `TaxYears` keeps one per year, made on first use.
- A tool call or a dashboard request takes the open year's workspace once, when it starts, and finishes on it even if the user switches meanwhile.
- The dashboard sends the year it shows with every change (`?year=`). If the user switched in the chat meanwhile, the change is refused (409, in the page's language) and the page shows the open year: nothing lands in a year the user wasn't looking at.
- Checks across documents (a document of another year, a 3a attestation of another year) follow the open year. The export bundle is the open year's folder, named `Taxpresso-<year>-export-<day>.zip`.

## 3. The year registry

- Each canton lists the years Taxpresso prepares for it: `CantonEntry.years` (`extension/src/cantons.ts`). Geneva: 2025 and 2026. Every other canton: 2026 only, for now.
- A year is listed only when the canton's rules (`rules.taxYears`), its form map (`filing.formMap(year)` with that `taxYear`, published for a year that is over) and its questions (`questionnaire(year)`) all cover it. `extension/test/years.test.ts` checks this for every canton and year.
- A year is offered when one canton has it (`offeredYears()`). For a year some cantons don't have, the canton question says so for each of them ("Zurich: Taxpresso can't prepare a 2025 return there yet", the shared file's `notOffered`): the answer is "not supported", nothing is computed (`CantonState.notOffered`), the copy panel and the PDF check stay empty, and Claude suggests the canton's own software. Fail closed.
- Geneva's form maps are a table by year (`FORMS`, `packages/filing-ge`); a year without one throws, never another year's form.

## 4. One questionnaire for every year

- A questionnaire file serves the years it lists (`taxYears: [2025, 2026]` in `data/ch/2026/questions.yaml` and `data/ge/2026/questionnaire.yaml`); the other cantons' files serve 2026 (`taxYear: 2026`). `packages/questionnaire` reads a file once per year (`geQuestionnaire(year)`, `sharedQuestionnaire(year, offered)`), and a year the file doesn't serve fails.
- Texts say `{year}` where they name the year ("Where did you live on 31 December {year}?", "Arrived in {year}"); `{prevYear}` and `{nextYear}` exist too.
- Citations carry the year of the document they cite: a learnMore has `year:` (a source names it in its manifest ids). For a tax year, the citation used is the one of the latest document up to that year: 2026 cites the 2025 Geneva guide until the 2026 one is out, and 2025 never cites a 2026 document. A law or a web page has no year and fits any year. When no citation fits, there is none, rather than another year's. A field may list several citations, one per year (YAML anchors keep that short), and a help text that holds for some years only may do the same (the 10 francs of the meal rule are the 2026 federal instructions').
- The 2025 federal instructions (Form. 2a 2025) are not in the library (`docs/sources/ch/NOTES.md`: only in a ZIP). So the shared questions cite no federal page for 2025, and Geneva's 2025 questions cite the 2025 Geneva guide, which covers the federal tax too.
- `packages/questionnaire/test/years.test.ts` checks every year: no placeholder left, no other year named in a text, every citation in the manifest and of that year or earlier, the keys of each year.

## 5. A year that is over

A year before the default year is over (`isYearOver`). The default year's estimate and plans work all year, as before.

- The plans before 31 December (pillar 3a, a pension fund buy-in, the 3a catch-up) are the default year's: payments count in the year they are paid (ge-2025-guide-declaration-pp p. 18). For 2025, `list_optimizations` and the dashboard say these plans apply to 2026 and offer one step back to it (`open_tax_year 2026`; the card's button). Planning figures and TOU decisions for 2025 are refused with the same words.
- TOU for 2025: only its deadline, from the law (31 March of the next year, `touDeadline`, ge-na-law-risp art. 8 al. 1), and that it has passed. The compulsory cases and their amounts are the 2026 directives' and are not shown for 2025.
- Last year's declaration of a 2025 return is the one of the year before. The reader of Geneva declarations reads the page codes GeTax prints (GAPP25-1, GAPP24-1...) and the rubric codes, so it reads it (`test/fixtures/dupont-declaration-2024.pdf`, synthetic). The library has no specimen of that year's form: its rubric codes are taken to be 2025's, and any the reader doesn't know come back as warnings. Reviewing that declaration (`review_last_year`) needs that year's rules, which Taxpresso doesn't have: it says so.
- 2025's figures come from 2025's published values only: no estimate flag. The engine's notes cite 2025's documents (the 2025 guide for travel costs, `ICC_COMMUTE_PRICING`, and the bike flat amount).

## 6. Adding a year

A year is data, with no new plumbing:

1. the rules: the year in the canton's `TAX_YEARS` and its cited parameters, and the federal ones (`packages/rules-ch`, `ifdParamsFor`);
2. the form map: the year's map in the canton's form table (`FORMS` for Geneva);
3. the questions: the year in the file's `taxYears`, and each citation of the year's documents next to the others, with its `year`; texts that hold for that year only, as a year's variant;
4. the year in the canton's `years` (`extension/src/cantons.ts`), and its per-year notes (`ICC_COMMUTE_PRICING`, `BIKE_FLAT_NOTE`, the 3a attestation check's source), which TypeScript asks for where a table is typed by year.

The tests then check the rest: the registry test (rules, form, questions), the questionnaire's citations against the manifest, and the year's texts.

## 7. Other cantons and 2025

As of 14 October 2026, every other canton's rules package covers 2025 with official, cited values, and each wired canton's filing package has a 2025 form map. They are not offered for 2025 because their questions are 2026's only (texts that say 2026, citations of 2026 documents); some also have gaps for 2025: Basel-Landschaft has no 2025 church tax rates, Bern has five parishes without a Roman Catholic rate, and no document gives the 2025 federal rate of a side job. Offering one is the checklist of section 6, step 3 and 4, for that canton's file.

## 8. How it was checked

The no-change proof for 2026: every tool result, dashboard state and API response for the synthetic households (Dupont, Ribeiro, with their declarations, certificates, broker exports and barcodes) and a seeded fuzz of households in every canton walked through the questions, documents and plans (`extension/test/record-years.test.ts`), recorded before and after the change and normalized for random ids, tokens, times and temporary paths. From the branch point: 94 households (the four synthetic ones and 10 of each of the nine cantons), 6,329 records, none missing; once the additions are taken out (the dashboard state's `years` and `yearOver`, null for 2026, in 924 states; `get_status`'s `years` and its line naming the open year, in 526 statuses), all are identical. The base recorded twice gives the same file. The 2025 recording (`TAXPRESSO_RECORD_YEAR=2025`) was searched for any 2026 document in what the user sees: only the plans' year (2026, by design), the law's consolidation date in the LIFD link, and the user's own file names remain.
