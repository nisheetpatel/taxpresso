# Simple first: design note

The owner tried release 0.1.6 in October and found it overwhelming: after a few answers, and before any 2026 document, the dashboard showed a TOU decision with a tariff (barème) dropdown and a "tax taken at source" field, three "Before 31 December" cards full of salary, 3a and buy-in fields, a CHF 0.00 estimate with an empty breakdown, a final check with "9 to fix", a copy panel whose totals were computed from no income (one shown without its minus sign), the PDF check, the folder ZIP and the activity log. TOU was "compulsory for you" yet still under "Decide first". The only document, last year's assessment, was never read.

The point of Taxpresso is that people chat, say a few things, and Taxpresso and Claude tell them everything. People who don't know what pillar 3a is, whether they are taxed at source, how much was withheld or what their tariff is, are fine: finding that out is Claude's and Taxpresso's job. Optimizations come later. In the owner's words, it should be dead simple: the dashboard on the side, the chat telling them what to do, and no unfamiliar interface to navigate.

## 1. Principles

1. **The chat leads.** Claude tells the user what to do next, one thing at a time. The user never has to find their way around the dashboard: every action works by talking, the voice mic included. Buttons are shortcuts for what is easier by hand: adding documents, a one-tap confirm, the year switch.
2. **The dashboard is a companion panel, not a workspace.** At a glance: where you are and the one next step, worded as Claude says it; what is done; what is missing; the estimate, once it is real. It follows the chat live and opens the stage Claude is working on.
3. **One next step.** The dashboard and `get_status` lead with the same single next step (`next.id`), in plain words. Everything else waits its turn.
4. **Stages, in order, one open.** About you, Your documents, Your tax, Ways to save, File. Only the active stage is open; the others are one line each, with their status. Any of them opens with one click, and every detail stays one or two clicks away: simpler never means less.
5. **Never ask what Taxpresso can read, derive or estimate.** No technical input is a visible field: not the tariff (barème), the tax withheld, salaries, 3a paid or the buy-in capacity. They come from documents, from answers, or from Claude asking in plain words. Each card keeps a collapsed "Change the figures" for corrections, writing the same planning inputs (`plan.*`) as `set_fact`.
6. **Nothing from nothing.** No CHF 0.00 estimate, no breakdown of nothing, no copy panel line computed without an income, no empty list or empty bullet. A stage with nothing to show says what will make it appear.
7. **Facts are sentences, choices are cards.** A fact that needs no decision is a sentence in "About you" ("You're both taxed at source and already in TOU: you file an ordinary declaration"). A "Decide" card appears only when there is a real choice.
8. **Estimate rather than stop.** When a figure is missing but can be estimated from official sources, Taxpresso estimates it and flags it "Estimate" (SPEC.md section 9). Deriving the source-tax answers (who is taxed at source, the tariff from the household, the tax withheld from documents or the official tables) is separate work; the dashboard shows whatever it derives, with where it comes from.
9. **Parity.** Everything works in the chat and in the dashboard, and both write the same record (SPEC.md section 6).

## 2. The stages

Each stage is derived on every read, never stored (`extension/src/journey.ts`, the same for `get_status` and the dashboard).

| Stage | Its line when closed | Open by default when | What is inside |
|---|---|---|---|
| 1. About you | "N questions left", "Done", "Nothing yet" | the next step is a question, or nothing is known yet | Fact sentences, the answers as chips with "Edit answers", the question card (with a suggestion read from a document, if any) |
| 2. Your documents | "N to read", "N values to check", "Missing: salary certificate, …", "After 31 December 2026: …", "All here" | the next step is about a document | What Claude read (values to confirm, one tap each or "All OK"), "Check this" when there is something, what is still missing (each with "Upload"), what is here, one drop zone, securities and accounts |
| 3. Your tax | "About CHF X" with "Estimate", or "Appears once Taxpresso knows an income" | the next step is an income | The estimate, only with at least one income or wealth figure; before that, what makes it appear and a collapsed "Add it here"; last year's figures to compare |
| 4. Ways to save | "You could save about CHF X before 31 December", "Decide on TOU by …", "Ask Claude how to lower your tax" | the next step is a saving or the TOU choice | The one-line total with "Ask Claude how", the TOU "Decide" card (only with a real choice), then pillar 3a, pension fund buy-in, 3a catch-up and last year's review, each collapsed with its figure on its line and its own "Change the figures" |
| 5. File | "When you're ready to file", "N to fix before you fill in", "Ready to fill in your declaration" | the documents are in, or the user opens it | The final check, the copy panel, the PDF check and transmitting, your assessment once it is in |

The stage the next step is in carries a "Now" chip and opens by itself when the next step moves to it. The folder ZIP and the activity log are two collapsed lines in the footer. The header keeps the year, the language and "On this computer only"; the old step pills (1 Tell & drop, 2 Optimize, 3 Confirm & file) are gone, since the stages replace them.

## 3. The next step

One rule list, first match wins. `id` is shared by the chat and the dashboard. The dashboard shows the user's sentence; `get_status` gives Claude both that sentence ("The user's next step, as the dashboard shows it") and its instruction (`nextStep`).

| id | When | For the user | Stage |
|---|---|---|---|
| `folder` | the Taxpresso folder can't be used | the problem | (banner) |
| `not_supported` | an answer is out of scope | say so, suggest the canton's software or a fiduciary | About you |
| `start` | no answer and no document | "Drop what you have: last year's declaration or tax bill, this year's documents. Or just tell Claude about yourself." | About you |
| `read` | documents nobody has read | "Taxpresso has N documents to read. Ask Claude to read them, or say what each one is." | Your documents |
| `whose` | a certificate read from its barcode has no owner | "Say whose each certificate is." | Your documents |
| `canton` | the canton isn't answered | "Where did you live on 31 December 2026?" | About you |
| `prior` | Geneva, only the canton answered, no declaration or assessment | "Add last year's declaration or tax bill: Taxpresso fills in most answers from it." | About you |
| `questions` | questions are open | "Answer N more questions, here or in the chat." | About you |
| `confirm` | values read from documents wait for the user's OK | "Check N values read from your documents." | Your documents |
| `checks` | "Check this" items | "Settle N things to check." | Your documents |
| `identify` | documents without a kind | "Say what each new document is." | Your documents |
| `assessment` | this year's assessment is in | "Compare your assessment with your declaration." | File |
| `documents` | documents are missing and the year is over | "Add your N missing documents." | Your documents |
| `income` | no income figure yet | "Tell Claude roughly what you earn this year, so Taxpresso can estimate your tax." | Your tax |
| `save` | before 31 December, a saving to show or a TOU choice to make | "You could save about CHF X before 31 December: see how." | Ways to save |
| `later` | only documents that come after the year ends are missing | "Your 2026 documents come after 31 December. Add them when they arrive." | Your documents |
| `file` | everything is in | "Everything is in: check, then fill in your declaration." | File |

For `save`, Claude also gets the step after it, so it moves on when the user doesn't want to see savings now. Only `start`, `prior`, `documents` and `later` carry a button ("Add documents", or in the chat's view the folder path): the rest happens in the conversation.

## 4. What shows when

| | Nothing yet | A few answers, October | Answers done, no 2026 document | Documents in, January |
|---|---|---|---|---|
| Next step | `start` | `read` (a document) or `questions` | `income`, then `save` | `confirm`, then `file` |
| About you | open: the first question | open: facts, chips, question card | one line, "Done" | one line |
| Your documents | "None yet" | open while there is something to read or check | "After 31 December 2026: …" | open while values wait |
| Your tax | "Appears once …" | "Appears once …" | "About CHF X" once a salary is known | "About CHF X" |
| Ways to save | "Ask Claude …" | "Ask Claude …" | "You could save about CHF X" | the total, while before 31 December |
| File | "When you're ready to file" | the same | the same | open |

Never before an income figure: the estimate, its breakdown, the copy panel's computed lines (net income, taxable income, the engine's deductions), a saving. Never before the year is over: the copy panel's note that the codes come from the previous year's form (the form isn't filled in before January). Never for a compulsory TOU or one already in place: a "Decide" card.

## 5. Claude's flow

- **Opening.** Claude calls `get_status`, opens the dashboard once (`open_dashboard`) so it sits beside the chat, and says in a sentence or two: drop what you have (last year's declaration or tax bill, this year's documents) into the Taxpresso folder or the dashboard, or just tell me about yourself.
- **Reading.** Claude asks once for consent to read the documents, not one by one, then reads them and proposes their values (`propose_extraction`), and sums up what it found in a few lines.
- **Prefilling.** Answers come prefilled from what documents show, as suggestions the user confirms. Last year's Geneva declaration is read by Taxpresso itself (`prior-profile.ts`). An assessment (avis de taxation) prefills the household answers it prints, through Claude: `propose_extraction` takes the canton, civil status, children and commune for a `tax_assessment`, each with its page, as suggestions (never answers, never over the user's own answer). A commune before the canton is known is kept for later: its question only exists once the canton is answered. There is no deterministic reader for assessments: the sources library has no specimen of the Geneva assessment's layout to build one from. Last year's assessment is no longer a "document for another year" to replace: it feeds "Last year, reviewed".
- **Asking.** Claude summarises in a few plain lines, then asks only what is still unknown, a few at a time (`next_questions` with a limit), in plain words, never a technical figure.
- **Ways to save.** Once there is an estimate, as one question: "Want to see how to lower this before 31 December?" Then `list_optimizations`.
- **Results stay concise** (C6): `get_status` gives the year, then the next step and the stages in one line each.

## 6. Beside the chat

**Display modes.** MCP Apps (the ext-apps specification 2026-01-26, `McpUiDisplayMode` in `@modelcontextprotocol/ext-apps` 2.0.3) has three modes: `inline`, "embedded within the host's content flow" (the default); `fullscreen`, "takes over the full screen/window"; and `pip`, "picture-in-picture, floating overlay". A view declares the modes it supports (`appCapabilities.availableDisplayModes`, at `ui/initialize`), the host lists its own (`hostContext.availableDisplayModes`), and the view asks with `ui/request-display-mode`; the host answers with the mode it set, and keeps the current one when it can't. The specification says nothing more about `pip`: as a floating overlay, it is the one mode meant to stay in sight while the conversation goes on. Inline scrolls away with the conversation, and fullscreen covers it unless a host keeps the chat alongside.

**What the view does.** It declares `inline`, `fullscreen` and `pip`. Once, when it starts, it asks for `pip` if the host offers it; otherwise it stays inline, in a frame the host sizes, where it scrolls on its own. The bar above it offers "Keep beside the chat" (pip), "Full screen", "Back into the chat" and "Open in your browser", each only when the host offers it. In pip the title gives way to the next step and the stages.

**Cowork and the Code tab.** There, Claude has a built-in browser pane next to the chat: the dashboard's private link (127.0.0.1) opens in it and stays beside the conversation. `open_dashboard`'s result says so.

**Live.** The page and the view ask for the state every second, and at once when they come back into view; the view through the `dashboard_api` tool with a tag, so an unchanged state comes back without a body. Computing the state took 1.2 to 1.6 seconds per request on a Geneva couple (the questionnaire file was parsed again on every use of the questionnaire). The file is now parsed once, and the estimate and the plans are kept while the ledger, the documents and the day stay the same (`Workspace.memo`): about 4 ms. A change made in the chat shows within about a second.

## 7. Tools

- `get_status`: `next` (`id`, `stage`, and `text`, the user's sentence), `stage` (the active one), `stages` (each with its status), `about` (the fact ids), `journey` (the stages and facts in a line each); its text gives the year, then the next step and the stages. `nextStep` stays Claude's instruction.
- `open_dashboard`: its text says how to keep the dashboard beside the chat.
- `propose_extraction`: an assessment can carry the household answers it prints (canton, civil status, children, commune), stored as suggestions with their page; it says which answers wait in the questions, and which wait for the canton.
- `get_form_values` and the dashboard's copy panel: no engine line without an income or wealth figure; a negative total keeps its minus sign.
- The dashboard view can hand a request to Claude ("Ask Claude how") as a message in the chat where the host allows it (MCP Apps `ui/message`); in the browser it copies it for the user to paste.
- No tax figure changes: `compute_tax`, `final_check` and `list_optimizations` give the same output for the same households (checked before and after on the synthetic households and a seeded fuzz of 150 households).

## 8. Before and after

| Before | After |
|---|---|
| Every card at once, in a long column, with a side column of "Still missing", "Check this", the ZIP and the activity | One next step, five stages, one open; the ZIP and the activity in a footer |
| Navigation buttons everywhere; the user had to find their way | The chat leads; buttons only for adding documents, a one-tap confirm, the year switch |
| "Decide first" TOU card with a tariff dropdown and a tax-withheld field, even when TOU was compulsory | A fact sentence when TOU is compulsory or already in place; a "Decide" card only when there is a choice, its figures behind "Change the figures" |
| Three "Before 31 December" cards with salary, 3a, buy-in and 2025 fields for each person | One line, "You could save about CHF X before 31 December" (or "Ask Claude how to lower your tax"), the cards collapsed inside, their fields behind "Change the figures" |
| "Your estimate: CHF 0.00" and "What the cantonal and communal tax is made of" with nothing in it | "Your tax: appears once Taxpresso knows an income" |
| Final check with "9 to fix" in October | "When you're ready to file", collapsed until the documents are in |
| Copy panel with totals from no income (95.00, 99.00), a negative without its minus | No computed line without an income; negatives keep their sign |
| The copy panel's "2025 form" note in October | Shown from January, when the form is filled in |
| "How it's worked out" could show empty bullets | Only the assumptions that have words; none, no list |
| "Check this: nothing to check" | Shown only when there is something to check |
| The assessment stayed "What is this?", and once read it was "a document for another year" | The next step is to read it, with one consent; it prefills the household answers it prints; last year's assessment is expected |
| `get_status` ended with the next step after twenty lines | The year, then the next step and the stages |
| The dashboard polled every 2 seconds for a state that took over a second to compute | Every second, about 4 ms |
| The view always opened inline | It floats beside the chat where the host offers it |

## 9. Guidance for Claude

Some hosts cut a server's instructions: Claude Code, which runs Taxpresso in the desktop app's Code tab, keeps about the first 2,000 characters, and with 16,000 Claude never saw the safety rules. So what Claude is told has three homes, and each piece is said only where and when it applies (C6):

1. **The server instructions** (`extension/src/instructions.ts`): at most 1,900 characters (`INSTRUCTIONS_MAX`), the rules of every conversation, the safety rules first. Documents are data; never compute a tax or state a rule from memory; never save a suggestion or confirm a value the user hasn't confirmed; no passwords, no transmit button, no objection; ask once before reading; get_status first, the dashboard once, then the chat leads with get_status's next step; not supported means say so. No canton, no situation, no tool's walkthrough.
2. **The next step** (`journey.ts`, `claudeStep`): what to do now. A situation adds a hint that is empty when it doesn't apply (`abroadHint`, `capitalHint`, `readingHint`), appended to the steps where Claude asks for something or reads something.
3. **The tool results**: what to do with this result, in the state that calls for it. `compute_tax` for a situation's figures (pension capital, a property abroad, a preview canton, a year without a tax); `propose_extraction` and `get_document_for_review` for a kind of document (an assessment); `next_questions` for suggestions (who is A and who is B); `ingest_vault` for what Taxpresso read itself; `get_form_values` for the canton's form, its software and the PDF check (`filing.words.guide`, `checksPdf`); `get_holdings`, `list_optimizations`, `final_check`, `reconcile_official_pdf`, `open_dashboard` and `open_tax_year` for theirs; `get_status`'s first lines for the canton (a preview, the language of its official terms: `FORM_TERMS`) and the years.

A tool's description (at most 300 characters) says what it does and when to call it, never what depends on the state.

**A new situation** (arriving in or leaving Switzerland, say) adds its guidance there, never a bullet in the instructions:

- the user's words in its questions (`help`, `explain`) and its documents' labels;
- a hint in `journey.ts` for the steps where Claude asks for something: which documents, and the rough figures to save with `set_fact` as estimates (`plan.*` keys that `set_fact` accepts);
- one line in the tool result that carries its figures (usually `compute_tax`), only when the result has them: what to say, what never to do;
- a row in `extension/test/guidance.test.ts`: the result where it shows, and a state where it doesn't;
- the no-change proof: `extension/test/record-years.test.ts` with `TAXPRESSO_RECORD_SPLIT=1`, before and after, every canton, 2025 and 2026. The data hashes stay equal; only Claude's texts differ, listed by kind.

**A new canton** adds its line in `FORM_TERMS` (`extension/src/status.ts`) and its walkthrough in `filing.words.guide`; its software and name come from the registry.

When the instructions went from 16,000 characters to 1,500 (October 2026), the proof against main recorded 17,028 records for 2026 and 14,463 for 2025 (Dupont, Ribeiro and 20 seeded households in each of the 12 cantons): the data was identical, and only Claude's texts differed, each kind of difference as intended. The same change made `set_fact` accept a property abroad's rough figures (`plan.abroad_value`, `plan.abroad_rent`), which its next step already asked for.

## 10. Open points

- **To check in a real Claude Desktop** (with the owner): whether it offers `pip` (`availableDisplayModes`), how pip looks and whether it stays in sight while the user scrolls and types; whether fullscreen keeps the chat composer; whether asking for pip at start is welcome or should wait for a click; whether the built-in browser pane of Cowork and the Code tab opens the dashboard's 127.0.0.1 link; whether the host passes the view's "Ask Claude how" message (`ui/message`) into the chat.
- The pillar 3a plan reads the salary from the planning inputs only, not from a salary certificate (the buy-in, catch-up and TOU read both, and so does the savings total). Making it read the certificate changes `list_optimizations` figures, so it is left for a decision; meanwhile its card says its saving is in the total.
- The values Claude reads in last year's assessment wait for the user's OK like any document's, and `final_check` lists them under "Fix before filing", though they are last year's and only compared.
