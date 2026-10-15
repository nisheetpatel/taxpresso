# Three pages: design note

Decided by the owner on 15 October 2026, after trying 0.2.0-rc.1: the dashboard is redesigned from scratch to be stupidly simple. Mockups: the design canvas "Taxpresso, simple redesign", direction A (screens A1 to A6). This note supersedes `simple.md` for what the dashboard shows and where; `simple.md` section 9 (guidance for Claude) still holds, and so do the states, wording and tone of SPEC.md 11b.

## 1. Principles

1. **The number is the spine.** Your tax for the year is always on top: big on "Your tax", a thin strip on the other pages. Under it, one "how sure" bar in words: Rough estimate, Getting close, Exact. It replaces the five stages.
2. **Three pages**: Your tax, Pay less, File. A Start screen comes first, only while nothing is known.
3. **Nothing is required.** Documents are suggested, never demanded; missing ones say "would make it more exact", never an error.
4. **Documents first, rough numbers as a fallback.** Dropping documents should be enough. Rough numbers exist so someone without documents yet (October planning) sees a number in a minute; a document replaces a rough figure on its own.
5. **One obvious action per screen.** No rows of fields, no lists of twenty boxes.
6. **Only what applies.** A row, chip or card appears only when it fits the household.
7. **No codes, sources or status labels on the main path.** They live behind "Why?". The only statuses shown: the how-sure bar, "Is that right? Yes / Fix it" on a value Claude read, and an estimate's "about".
8. **The chat can do everything the panel does**, and the panel never needs the chat.

## 2. Screens

All screens are one column, designed at the panel's width beside the chat (about 420 px) and stretching to full screen and the browser page.

**Top bar, everywhere.** The logo, and one menu (⋯) holding: tax year, language, the Taxpresso folder, "Stays on this computer", the activity log and the ZIP copy of the folder. Nothing else.

**Page tabs.** "Your tax · Pay less · File", shown once anything is known. The panel opens on the page the next step belongs to (section 4), and never jumps while the user is on another tab.

**Start** (A1), only while nothing is known; it never comes back.
- "Let's do your {year} taxes." / "Start with whatever you have. Nothing here is required, and you can fine-tune later."
- Door 1, **I have documents**: in Claude Desktop's panel, a button "Open my Taxpresso folder" opens the folder in Finder or Explorer; files dropped there are sorted as they land (section 5). In the browser page, a real drop zone and "Choose files".
- Door 2, **No documents yet?**: "Start with rough numbers" opens the basics card.
- "What helps, if you have it": chips for the salary certificate, health insurance, pillar 3a, bank statements, last year's return (only the kinds that exist for the canton).
- Footer: "Or just tell Claude in the chat." and "Stays on this computer".
- If last year's return is in the folder, the basics card opens pre-filled with "From last year, still right?" (the existing suggestions).

**Basics card** (A2). One card, every field skippable, big controls (segmented buttons and steppers, no dropdowns except the commune):
1. Canton, then commune (the commune list follows the canton).
2. Who is filing: Just me / Me and my partner.
3. Children: a stepper.
4. Yearly income, roughly, per person: an amount, and what it comes from (Salary, Benefits, Pension, Own business; default Salary). The partner's row appears only for a couple.
5. Swiss passport or C permit, per person: Swiss / C permit / Other permit (the existing `residence` question). With another permit, the card adds, only then, whether a Swiss employer pays the salary and whether TOU is already in place.
- Button "See my tax". With no income, "Your tax" says "Add a rough income to see your tax" instead of CHF 0.
- For a tax year that is over (2025), the income row is replaced by "Add your documents: they give the exact figures." (rough income is for planning a year still running).

**Your tax** (A3, home).
- **The number card**: "Your {year} tax", "about CHF 8'900" (no "about" once exact), the how-sure bar, and one line on what it rests on ("From what you told us: …", "From your documents", or both). "Change" opens the basics card. A second line, collapsed: "What Taxpresso worked out (3)" holds the About-you facts (taxed at source, barème, TOU in place…), each with "Why?". "Compared with last year" when last year's return or assessment is in.
- **Make it exact**: at most about five rows, only those that fit (from the requirements): the document, a one-line hint ("Usually arrives in January"), "Add" (opens the folder, or the file picker in the browser). A row is ticked when its document is in. Accounts and securities, once there, open the securities list (état des titres). "No document? Type a rough amount instead" only where a rough figure exists.
- **A few more questions (n)**: the remaining questions of group `detail` (section 3), asked one at a time in place, only after the number shows, never blocking it.
- **Anything special this year?**: chips (I own my home, Home abroad, Self-employed, Moved country, Pension payout; only those the canton supports, unsupported ones said plainly when tapped). A chip answers the matching question and asks its follow-up questions in place, one at a time.
- A link "See how to pay less".

**After documents land** (A4). The Make it exact list shows what each file turned out to be:
- a barcode document: ticked, "Read on its own, nothing to check";
- a value Claude read: the value, "Is that right?", Yes / Fix it / See page (the existing confirm and edit);
- a file not identified yet: "Not sure what this is. Claude will take a look."
- The number card says how much it moved ("CHF 660 less than your rough numbers said").

**Pay less** (A5).
- Strip: your tax now → with what you picked.
- Cards sorted by what each saves, only those that apply: pillar 3a (amount, saving, Picked), pension fund buy-in (Check: add the pension certificate), 3a catch-up, and TOU only when it is a real choice (its comparison, deadline and "can't be undone" stay as today).
- **Costs you can deduct**, "Tap what applies": one row per deduction question that applies (getting to work, meals away from home, childcare, donations, medical costs, loan interest, alimony paid). A tap answers the question and opens its follow-up questions in place; where the amount comes from a document, the row says "Add the receipts" and the document joins Make it exact.
- Rules and the saving's assumptions stay behind "How it works".
- For a year that is over: one line, "Plans before 31 December are for {current year}", with the year switch.

**File** (A6).
- Before the documents are in: one line ("Filing opens when your documents are in. Most arrive in January and February.") and what is still missing.
- Once in, three steps: 1. **Check** (the final check's items, one at a time), 2. **Fill in your declaration**: "Fill in with Claude" or "Copy values" (the copy panel, unchanged inside), 3. **Send it yourself** ("You press Transmettre. Taxpresso never sends anything."), with the official PDF check here for Geneva. The assessment check appears here once an assessment is in.

**Gone from the main path**: the stage accordions, the "Next" card, the rows of answer chips (answers are edited through "Change" and the chips that set them), the activity card (menu), sources and codes (behind "Why?").

## 3. Questions: one group each

Every question in every questionnaire file gets a `group` (data, `packages/questionnaire` schema; a test fails if one lacks it):

| group | where it is asked | examples |
|---|---|---|
| `basics` | the basics card | canton, civil_status, children, commune, income_sources, residence; and, only when they apply, employer_in_switzerland and tou (they decide whether the tax is taken at source) |
| `special` | Anything special, after its chip | moved and the dates, self-employment questions, property, abroad, pension capital |
| `deduction` | Pay less, Costs you can deduct | commute and its follow-ups, meal_days, childcare, child_care, payments |
| `plan` | Pay less cards | pillar3a, lpp_buyin |
| `detail` | Your tax, A few more questions | employers, banks, crypto, children_custody, child_support, lives_with_other_parent |

The questionnaire engine still decides which questions apply and in which order within a group; the groups only decide where they are asked. Derived answers (taxed at source) stay derived.

## 4. What the extension provides

`GET /state` (`extension/src/api.ts`, the same through `dashboard_api`) gains:

- `page`: `{ current: 'start' | 'tax' | 'save' | 'file', tabs: boolean }`. `start` while the next step is `start` (nothing known) or `folder`; otherwise the page of the next step's stage (about, documents, tax → `tax`; save → `save`; file → `file`). `tabs` is false only on Start.
- `confidence`: `'rough' | 'close' | 'exact' | null`. Null when there is no tax. `rough` when any income figure comes from a rough plan figure. `exact` when no input is an estimate, no value waits for the user's OK, and no required document is missing. Otherwise `close`.
- `groups`: for each group, the applicable questions rendered as today (`ws.render`, in the UI language) with their current value and whether they are answered: `{ basics: Q[], special: Q[], deduction: Q[], plan: Q[], detail: Q[] }`.
- `rough`: per person, the rough income and its kind, so the basics card shows them.

New rough income keys, per person, status estimate, used by the engine only when that person has no document for that income (as `plan.gross_salary` today, in `packages/rules-ch` from-ledger, so every canton gets them): `plan.replacement_income` (benefits) and `plan.pension_income` (pension). `plan.business_profit` already exists. The basics card writes the key that matches the kind chosen, and sets `income_sources` to match. Rough income is refused for a year that is over, as today.

`POST /folder/open`: opens the open year's folder in the system's file manager: `execFile` of `open` (macOS), `explorer` (Windows) or `xdg-open` (Linux) with the folder path as the only argument, no shell, nothing else. It needs `node:child_process` in `extension/allowed-dependencies.json` with that reason; nothing else may use it (a test pins the one call site).

**Sorted as they land**: while the extension runs, it watches the open year's folder (`fs.watch`, debounced about a second) and scans new files on its own (the same as `ingest_vault` and the "check folder" button), so the panel shows them within seconds without a button. The browser page keeps its drop zone. The panel inside Claude Desktop still never receives a document's bytes.

## 5. The chat

- `get_status`, the journey, its next step and Claude's guidance stay the source of truth (`simple.md` section 9). The instructions do not change.
- The user-facing names follow the pages: "Your tax", "Pay less", "File". Claude says the next step in the panel's words, and never sends the user around the panel.
- Anything the panel does (basics, chips, a deduction, a plan, a confirm) Claude can do with the existing tools; the panel refreshes.

## 6. Kept, moved, removed

- **Kept, moved**: the copy panel (File, "Copy values"), the final check (File, step 1), the PDF check (File, step 3), the assessment (File), the securities list (Make it exact), document cards for values to OK (inline in Make it exact), the planning cards (Pay less), last year's comparison (a link on the number card), the year switch, language, export and activity (the menu), Sources (behind "Why?").
- **Removed**: StageCard, NextStep, the chip rows, the "about you" fact list as a section of its own (it moves into "What Taxpresso worked out").

## 7. Testing

- The UI tests render each screen without a DOM: Start only while nothing is known; the basics card writes the right answers and rough key per kind; tabs and the page opened; the number card's how-sure word for each `confidence`; Make it exact shows only rows that fit; Pay less shows only cards and rows that apply; File before and after the documents.
- `confidence`, `page` and `groups` have extension tests; every question has a group; the rough income keys change no figure for households without them (no-change proof with the recorder) and give the expected estimate for those with them.
- i18n: every new text in en, fr, de and it (the existing i18n test).
- The offline test: the view still self-contained, `dashboard_api` equals HTTP, `/folder/open` never reached in the offline run (it would open a window), the folder watch picks up a file.
- Screenshots of A1 to A6 in light and dark, at the panel's width and full screen, before merging.

## 8. Not in this step

- Dropping files into the panel inside Claude Desktop, or into the chat (the owner's point 2: how to avoid switching between Claude Desktop and the browser; the plugin bundle may answer it).
- A postcode instead of canton and commune.
- Rough amounts for deductions (receipts give them).
