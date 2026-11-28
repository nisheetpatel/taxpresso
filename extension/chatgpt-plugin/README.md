# Taxpresso

Prepare your Swiss tax return with ChatGPT, on your own computer. Taxpresso asks the questions that
matter for your return, keeps your documents in a folder on your computer, reads them with ChatGPT
when you ask, checks them against each other, tells you what is still missing, and computes your
cantonal, communal and federal tax, with the official source of every figure. It also estimates what
a pillar 3a payment (3e pilier A) before 31 December would save you, and later checks your tax bill
(avis de taxation) against what you declared.

Geneva is supported for the tax years 2025 and 2026. Zurich, Bern, Basel-Landschaft, Vaud,
Basel-Stadt, Zug, Lucerne, St. Gallen, Fribourg, Ticino and Aargau are previews. Taxpresso never
files for you: you type the values into your canton's official software yourself.

Taxpresso is free and open source, under the GNU AGPL-3.0-or-later.

## A test build

This package is a test build. It has not been tried in the ChatGPT desktop app yet. The project's
notes say what is known and what is left to check:
[docs/spikes/S6.md](https://github.com/nisheetpatel/taxpresso/blob/main/docs/spikes/S6.md).

## Where it runs

In the ChatGPT desktop app, in a conversation that runs on your computer. Taxpresso's server runs
on your computer, with Node.js (version 20 or later). It does not run on the web or on a phone.

## What it reads and what it sends

- **It reads your Taxpresso folder**, `~/Documents/Taxpresso` unless you set
  `TAXPRESSO_VAULT_PATH` to another folder. Your answers and documents are kept there, one folder
  per tax year, in files you can open, move and back up. Nothing else on your computer is read.
- **It sends nothing.** Taxpresso makes no network requests: no telemetry, no update check, no
  account. Its dashboard runs on your computer only (127.0.0.1), behind a private link.
- **ChatGPT sees** what you write, what Taxpresso's tools answer, and a document's content only
  when you agree that ChatGPT reads it.
- Text inside your documents is data, never instructions. ChatGPT never types your passwords,
  never presses the button that sends your declaration, and never sends an objection for you.

Read the [privacy policy](https://taxpresso.ch/en/privacy/).

## Try it

Ask ChatGPT, in your own words:

1. "Let's do my taxes for 2025."
2. "I put my salary certificate and my 3a attestation in my Taxpresso folder. What is still
   missing?"
3. "How much would a pillar 3a payment before 31 December save me?"

## Try it on a demo household

The project has made-up Geneva households with all their documents and their tax worked out by
hand: the [filing kits](https://github.com/nisheetpatel/taxpresso/tree/main/test/fixtures/households).
Use a separate, empty folder for them, never the folder with your own documents: set
`TAXPRESSO_VAULT_PATH` to that folder before you start the app.

Then say "Open tax year 2025", copy a kit's `documents` into the folder's `2025` folder, and say
"Let's do my taxes". Answer the questions as the kit's README describes the household. Your tax
should match the kit's `expected.json`.

## Help

Report a problem or ask a question on
[GitHub](https://github.com/nisheetpatel/taxpresso/issues), or write to hello@taxpresso.ch.

## License

GNU AGPL-3.0-or-later, in `LICENSE`. The licenses of the software Taxpresso includes are in
`THIRD_PARTY_NOTICES.txt`.
