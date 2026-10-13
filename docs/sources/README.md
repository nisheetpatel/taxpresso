# Official sources library

Official tax documents for Geneva, its neighbours and the large cantons, plus federal tax and the eCH data standards. Collected 13 October 2026 by one agent per canton, every URL opened and checked against its title and tax year. Official government sites only.

## How these documents are used

They are not a rulebook to transcribe. They are the authority you go back to:

- whenever there is any doubt about a rule, a value, a deadline or a form label;
- at every final check: a phase's acceptance check while building, and the pre-filing check at runtime.

When a document and the code, the spec or Claude's own knowledge disagree, the document wins. Stop, record the conflict, and ask the human. Every tax constant in the rules engine cites the id of the entry it comes from (SPEC.md section 7).

## Layout

- `<canton>/manifest.json`: verified documents for that canton (edit these).
- `<canton>/NOTES.md`: filing channels, third-party software rules, deadlines, source tax (TOU/NOV), what's new, and gaps, each fact with its source URL.
- `<canton>/files/`: the downloaded documents, named `<id>.<format>` (created by the fetch script).
- `manifest.json`: all entries merged. Regenerate with `node scripts/merge-manifests.mjs`.
- `lock.json`: size, sha256 and retrieval time of every downloaded file (created by the fetch script).

Folders: `ge` `vd` `vs` `fr` `ne` `ju` `be` `ti` `bs` `bl` `zh`, plus `ch` (federal: IFD tariffs and deductions, source tax, withholding tax) and `standards` (eCH-0196, eCH-0270, eCH-0278, eCH-0119, salary certificate guide).

## Getting the files

The documents were found from an environment whose network policy blocks downloads from the cantonal sites, so the files are not in this folder yet. On a normal connection:

```
node scripts/fetch-sources.mjs            # everything (a few hundred MB at most)
node scripts/fetch-sources.mjs --core     # core documents only
node scripts/fetch-sources.mjs --canton ge,ch,standards
node scripts/fetch-sources.mjs --check    # report documents whose content changed since lock.json
```

The script checks that each file really is what the manifest says (a PDF starts with `%PDF`, and so on), so a canton serving an HTML error page instead of a PDF is caught. It exits non-zero if any core document fails. The files are not committed: they belong to their publishers. `lock.json` records the size and sha256 of every file, so `--check` tells you when a canton changed or moved a document (they do: Geneva's 2025 communal arrêté already moved).

## Coverage

| Folder | Entries | Core | PDFs | Tax year 2026 items |
|---|---|---|---|---|
| ge | 22 | 16 | 7 | 2 |
| vd | 22 | 15 | 17 | 3 |
| vs | 13 | 11 | 5 | 3 |
| fr | 24 | 15 | 12 | 3 |
| ne | 17 | 11 | 10 | 2 |
| ju | 21 | 14 | 9 | 5 |
| be | 13 | 11 | 13 | 2 |
| ti | 25 | 20 | 12 | 3 |
| bs | 26 | 15 | 22 | 4 |
| bl | 22 | 15 | 7 | 2 |
| zh | 24 | 16 | 12 | 6 |
| ch | 14 | 10 | 11 | 5 |
| standards | 9 | 6 | 6 | 0 |

"html" entries are official pages, either because the document only exists as a page or because the PDF behind it couldn't be fetched by the collecting tool. The fetch script saves a snapshot of each page; the first person to run it should open these and add the direct PDF links they lead to.

## Known conflicts and open points (check before relying on them)

- Barcode compression: the eCH-0196 barcode annex describes ZLIB-compressed XML, while eCH-0270 says "ZIP". The decoder must handle both until a real bank statement settles it (spike S2).
- Salary certificate 2D barcode: no official specification was found on the ESTV or CSI pages reviewed. Don't assume it follows eCH-0270; determine it from a real certificate (spike S2).
- eCH-0278 status: the cover says approved 2026-02-05, but the body mentions a later decision and calls it a proposal. Confirm before building on it. Its XSD and Excel annexes weren't found.
- Federal law texts (LIFD, LHID, source-tax ordinance, professional-expense ordinance) are missing: fedlex only renders in a browser. Add them from fedlex.admin.ch by hand.
- Pillar 3a 2025 maximum: the federal key-figures table extracted the same value for 2025 and 2026. Read it from the PDF before hard-coding anything.
- Federal 2027 cold-progression circular is already published: never reuse 2026 amounts for 2027.
- Geneva: the published approved-software list stops at tax year 2024 (Dr. Tax). Ask the AFC how approval works today.
- Valais: the 2025 guide says 15 days to correct after online filing, the VSTax FAQ says 10.
- Vaud: the communal coefficient tables and the consolidated LI and RDVE texts could not be read by the tool; open them in a browser.
- Several agents could read PDF text only through automated summaries. Never copy a number from a NOTES.md file; read it in the document.

## Legal

These are official publications, but redistributing copies inside a commercial product needs a check (Swiss copyright law exempts laws, ordinances and official decisions, not necessarily every guide). Until a lawyer confirms, the shipped extension bundles extracted text with source links, not the original PDFs (SPEC.md section 7b).
