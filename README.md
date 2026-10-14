# Taxpresso

Your taxes, done over an espresso. Vos impôts, le temps d’un espresso.

Taxpresso helps you prepare your Swiss tax return with Claude, inside Claude Desktop: Geneva in full, and more cantons as a preview. It runs on your own computer: the extension makes no network requests, and your documents stay in your Taxpresso folder. You review the official declaration and transmit it yourself.

Taxes should be painless, simple and free. Taxpresso is free and open source, and owned by its community.

## Status

Early preview for tax year 2026 (returns filed in early 2027), and for tax year 2025 in Geneva: if you haven't filed it yet, or to check the return you filed and your assessment.

- Works today, in the chat or in a local dashboard:
  - the questions that matter for your return, for you and your partner;
  - last year's Geneva declaration, read on your computer: it suggests answers for you to confirm, and your estimate is shown next to last year's figures;
  - your documents in one folder: salary certificates and bank e-tax statements read from their barcodes, other documents read with Claude (PDFs and photos, read on your computer), each value confirmed by you, with checks across documents;
  - your estimate: Geneva cantonal and communal tax (ICC) and federal tax (IFD), income and wealth, every line explained with its official source;
  - Zurich, as a preview: the canton is the first question; Zurich's own questions (commune, church tax), your cantonal, communal, church and federal tax (Staats- und Gemeindesteuern, direkte Bundessteuer), and the values to type in the Zurich form's order, its annexes included, with the few rules the documents don't spell out shown to you;
  - Bern, as a preview: Bern's own questions in English, French and German (your own household, church tax and parish, shared custody, payments to political parties, education costs per child), your cantonal, communal, church and federal tax (Kantons-, Gemeinde- und Kirchensteuern, direkte Bundessteuer) laid out as TaxMe's summaries, and the values to type form by form, with the few rules the documents don't spell out shown to you;
  - the dashboard in English, French, German or Italian;
  - the tax year, chosen in the chat or in the dashboard: each year keeps its own answers, documents and checks;
  - your securities list (état des titres): bank accounts, broker exports (Interactive Brokers, DEGIRO), crypto and bank tax statements, with the Swiss withholding tax you get back and the foreign tax credit;
  - before 31 December: a pillar 3a payment, a pension fund buy-in and the 3a catch-up, each with what it saves on your actual tax;
  - for people taxed at source: source tax next to the ordinary tax (TOU), with the 31 March deadline;
  - every value in the official form's order, ready to copy into your declaration;
  - your tax assessment checked against your return, with the deadline to object.
- Coming next: a check of the official PDF before you transmit, a review of what you could have saved last year, Geneva's 2026 rates when the canton publishes them, and Claude filling in the official online declaration (e-démarches) in Claude in Chrome or its built-in browser, while you press transmit yourself.
- Geneva; and as a preview, Zurich, Bern, Vaud, Basel-Stadt, Basel-Landschaft, Zug, Lucerne, St. Gallen, Fribourg and Ticino. Aargau comes next. The goal is all 26 cantons.

## Install

1. Download the `.mcpb` file of the [latest release](https://github.com/nisheetpatel/taxpresso/releases/latest), or build it (below).
2. Double-click it, or drag it onto Claude Desktop's Settings, Extensions page. Click Install.
3. In a new chat, ask Claude: "Help me with my taxes using Taxpresso."

Your tax folder is `~/Documents/Taxpresso` unless you choose another one at install. The website has a [Get started](https://taxpresso.ch/en/start/) page with every step.

Nothing leaves your computer, except what you share with the AI you use: today that's Claude, under your own account and your own privacy settings. ChatGPT isn't available yet.

## Build from source

Node 24 and pnpm 12 (`npm i -g pnpm@12.10.1`).

```
pnpm install
pnpm check          # format, lint, typecheck, unit tests
pnpm build:mcpb     # build/taxpresso-<version>.mcpb
pnpm test:offline   # end to end, with the network blocked
pnpm build:site     # the landing page, into site/dist
```

`SPEC.md` is the source of truth for what Taxpresso does and how. `CLAUDE.md` lists the rules for working on the code, with or without Claude Code.

## Contact

hello@taxpresso.ch

## Contributing

Bug reports, tax rules, translations, new cantons and fixes are all welcome. To ask for your canton or language, add a 👍 in the pinned votes: [cantons](https://github.com/nisheetpatel/taxpresso/issues/1), [languages](https://github.com/nisheetpatel/taxpresso/issues/2). Start with [CONTRIBUTING.md](CONTRIBUTING.md). Never put real personal or tax data in an issue, a pull request or a test.

## Say thanks

Taxpresso costs nothing. If you’d like to say thanks or support a good cause, you can donate to [Precious Plastic Bugoma](https://www.preciousplasticbugoma.com/), which recycles plastic waste around Bugoma forest in Uganda. Taxpresso receives nothing from donations.

## Not tax advice

Taxpresso is an independent, free and open-source software project. It is not affiliated with, sponsored by or associated with any accounting firm, fiduciary or tax-services company, in Switzerland or elsewhere, nor with the Geneva cantonal tax administration (AFC) or Anthropic. It isn’t tax advice: you remain responsible for your return. Claude is a trademark of Anthropic.

## License

Taxpresso is free and open source, under the GNU Affero General Public License, version 3 or later (AGPL-3.0-or-later). The copyright notice below is the one the license itself asks for: it is what lets the license keep Taxpresso free.

Copyright (C) 2026 Nisheet Patel and the Taxpresso contributors.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full text.

Third-party software keeps its own license: every build lists it in `THIRD_PARTY_NOTICES.txt`. The fonts (Geist and Geist Mono) are under the SIL Open Font License. The official documents in `docs/sources/` belong to their publishers and are not covered by this license.
