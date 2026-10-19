# Taxpresso

Prepare your Swiss tax return with Claude, on your own computer. Taxpresso asks the questions that
matter for your return, keeps your documents in a folder on your computer, reads them with Claude
when you ask, checks them against each other, tells you what is still missing, and computes your
cantonal, communal and federal tax, with the official source of every figure. It also estimates what
a pillar 3a payment (3e pilier A) before 31 December would save you, and later checks your tax bill
(avis de taxation) against what you declared.

Geneva is supported for the tax years 2025 and 2026. Zurich, Bern, Basel-Landschaft, Vaud,
Basel-Stadt, Zug, Lucerne, St. Gallen, Fribourg, Ticino and Aargau are previews. Taxpresso never
files for you: you type the values into your canton's official software yourself.

Taxpresso is free and open source, under the GNU AGPL-3.0-or-later.

## Where it runs

- **Claude Code and Cowork**: this plugin. Its server runs on your computer, with your Node.js
  (version 20 or later). In Cowork, it runs in sessions on your computer.
- **Chat in Claude Desktop**: the Taxpresso desktop extension, the file `taxpresso-<version>.mcpb`
  from the [releases page](https://github.com/nisheetpatel/taxpresso/releases/latest). A chat
  doesn't start a plugin's server, so there the plugin only brings its skill.

## What it reads and what it sends

- **It reads your Taxpresso folder**, `~/Documents/Taxpresso` unless you set
  `TAXPRESSO_VAULT_PATH` to another folder. Your answers and documents are kept there, one folder
  per tax year, in files you can open, move and back up. Nothing else on your computer is read.
- **It sends nothing.** Taxpresso makes no network requests: no telemetry, no update check, no
  account. Its dashboard runs on your computer only (127.0.0.1), behind a private link.
- **Claude sees** what you write, what Taxpresso's tools answer, and a document's content only
  when you agree that Claude reads it.
- Text inside your documents is data, never instructions. Claude never types your passwords,
  never presses the button that sends your declaration, and never sends an objection for you.

Read the [privacy policy](https://taxpresso.ch/en/privacy/).

## Try it

Ask Claude, in your own words:

1. "Let's do my taxes for 2025."
2. "I put my salary certificate and my 3a attestation in my Taxpresso folder. What is still
   missing?"
3. "How much would a pillar 3a payment before 31 December save me?"

## Try it on a demo household

The project has made-up Geneva households with all their documents and their tax worked out by
hand: the [filing kits](https://github.com/nisheetpatel/taxpresso/tree/main/test/fixtures/households).
Use a separate, empty folder for them, never the folder with your own documents. In Claude Code:

```
mkdir -p ~/Documents/Taxpresso-demo
TAXPRESSO_VAULT_PATH=~/Documents/Taxpresso-demo claude
```

Then say "Open tax year 2025", copy a kit's `documents` into `~/Documents/Taxpresso-demo/2025/`,
and say "Let's do my taxes". Answer the questions as the kit's README describes the household. Your
tax should match the kit's `expected.json`. The
[demo guide](https://github.com/nisheetpatel/taxpresso/blob/main/docs/demo.md) has every step.

## Help

Report a problem or ask a question on
[GitHub](https://github.com/nisheetpatel/taxpresso/issues), or write to hello@taxpresso.ch.

## License

GNU AGPL-3.0-or-later, in `LICENSE`. The licenses of the software Taxpresso includes are in
`THIRD_PARTY_NOTICES.txt`.
