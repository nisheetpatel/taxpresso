# Taxpresso

Your taxes, in one espresso. Vos impôts, le temps d’un espresso. Steuern, in einem Espresso erledigt.

Taxpresso helps you prepare your Geneva tax return with Claude, inside Claude Desktop. It runs on your own computer: the extension makes no network requests, and your documents stay in your Taxpresso folder. You review the official declaration and transmit it yourself.

Taxes should be painless, simple and free. Taxpresso is free and open source, and owned by its community.

## Status

Early preview for tax year 2026 (returns filed in early 2027).

- Works today: the questions that matter for your return, in the chat or in a local dashboard; your documents in one folder, for you and your partner; your securities read from a broker export (Interactive Brokers, DEGIRO); and what a pillar 3a payment before 31 December would save you.
- Coming next: Claude reading your documents with you, each value confirmed by you; checks across your documents (wrong year, income counted twice); your tax assessment checked against your return; barcode reading (salary certificate, bank e-tax statement); the full Geneva and federal tax calculation; and Claude filling in the official online declaration (e-démarches) in Claude in Chrome or its built-in browser, while you press transmit yourself.
- Geneva first. The goal is all 26 cantons.

## Install

1. Download the `.mcpb` file of the [latest release](https://github.com/nisheetpatel/taxpresso/releases/latest), or build it (below).
2. Double-click it, or drag it onto Claude Desktop's Settings, Extensions page. Click Install.
3. In a new chat, ask Claude: "Help me with my Geneva taxes."

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

## Contributing

Bug reports, tax rules, translations, new cantons and fixes are all welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md). Never put real personal or tax data in an issue, a pull request or a test.

## Say thanks

Taxpresso costs nothing. If you’d like to say thanks or support a good cause, you can donate to [Precious Plastic Bugoma](https://www.preciousplasticbugoma.com/), which recycles plastic waste around Bugoma forest in Uganda. Taxpresso receives nothing from donations.

## Not tax advice

Taxpresso is independent. It isn’t affiliated with the Geneva cantonal tax administration (AFC) or with Anthropic, and it isn’t tax advice: you remain responsible for your return. Claude is a trademark of Anthropic.

## License

Copyright (C) 2026 Nisheet Patel and the Taxpresso contributors.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full text.

Third-party software keeps its own license: every build lists it in `THIRD_PARTY_NOTICES.txt`. The fonts (Geist and Geist Mono) are under the SIL Open Font License. The official documents in `docs/sources/` belong to their publishers and are not covered by this license.
