# Design reference

Static HTML mockups of the core flow. Open them in a browser; the step pills link the screens together. Demo data only: Ana Ribeiro, Meyrin, permit B, taxed at source, one child, considering TOU. Every amount is fictional.

| File | Screen | What it must show |
|---|---|---|
| `1-intake.html` | Tell me and drop everything | Adaptive question card, answered-questions chips, drop zone, document list with status, live "still missing" list, running estimate, activity from the chat |
| `2-optimizations.html` | Optimizations | TOU decision first (simulation, irreversibility, deadline), "claim on this return" with CHF deltas, "do before 31 December", choices summary |
| `3-check-and-file.html` | Check, then file | Blocking list of estimates and unconfirmed values, declaration summary with official French labels, how filing works, who fills the form |
| `3b-filing-and-reconciliation.html` | Filing and reconciliation | Field-by-field check against the official PDF, section status, transmit handoff, copy panel fallback, honor-payment card after filing |

What is normative: the flow, the states and their wording (SPEC.md 11b), the hierarchy of each screen, the tone (plain, second person, no jargon without its French label). What is not: exact pixels, spacing, demo numbers.

`simple.md` says how the dashboard puts these screens together since the owner's October review: the chat leads, and the dashboard is a companion panel beside it, with one next step and five stages (About you, Your documents, Your tax, Ways to save, File), one open at a time. Where it and the mockups differ on what shows when, `simple.md` wins; the states, wording and tone above still hold.

The mockups load Geist from Google Fonts for convenience. The product must not (SPEC.md C2): bundle the font files in the extension.
