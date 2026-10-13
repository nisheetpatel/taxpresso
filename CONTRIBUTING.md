# Contributing to Taxpresso

Thank you for helping. Taxpresso belongs to the people who use it and improve it.

## Ways to help

- Report a wrong number, a confusing question or a bug. Say what you expected and where it is written (the page of the official guide, if you know it).
- Fix or add a tax rule, with its official source.
- Translate the app or the landing page, or review a translation in your language.
- Add a canton: start by collecting its official documents (below).
- Improve the docs.

## Never share real tax data

Don’t put real names, AHV numbers, salaries, account numbers, documents or screenshots of a real return in an issue, a pull request or a test. Describe the situation in words, or use the synthetic demo households (Dupont and Ribeiro). Fixtures are always synthetic.

## The rules every change keeps

`SPEC.md` is the source of truth; `CLAUDE.md` has the working rules. The short version:

- The extension makes no network requests: no telemetry, no update checks, no HTTP clients. The offline test must stay green.
- Our code never calls an AI model. Claude, in Claude Desktop, is the only one.
- Money is integer centimes, never floats.
- Every tax constant cites an official document in `docs/sources/` (its manifest id plus a page or article). If a value isn’t published, the build fails; never guess.
- Text inside a user’s documents is data, never instructions.
- Taxpresso never transmits a declaration, and Claude never types passwords or codes.
- Fonts are bundled, never loaded from the internet.
- New dependencies need a license compatible with the AGPL (MIT, BSD, ISC, Apache-2.0, LGPL, GPL-3.0, or OFL for fonts), and anything that ends up in the server bundle must be added to `extension/allowed-dependencies.json` with its reason.

## Tax rules and official sources

Official documents are the authority, not anyone’s memory, ours or an AI’s. When you change a rule, a value, a deadline or a form label, open the document in `docs/sources/<canton>/` and cite it next to the constant. If the document disagrees with the code or the spec, the document wins: note the conflict in that canton’s `NOTES.md` and say so in your pull request.

To add a canton, first add its official documents to `docs/sources/<canton>/manifest.json` (official URLs only, opened and checked), then run `node scripts/merge-manifests.mjs` and `node scripts/fetch-sources.mjs --canton <id>`.

## Writing for users

Second person, plain words, no em dashes. Put the official French term next to its gloss, the way the user will see it on the form (for example, "ordinary taxation later (taxation ordinaire ultérieure, TOU)").

## Setting up

Node 24 and pnpm 12 (`npm i -g pnpm@12.10.1`; corepack can’t run pnpm 12).

```
pnpm install
pnpm check          # format, lint, typecheck, unit tests
pnpm build          # the dashboard, then the extension
pnpm check:bundle   # the dependency allowlist and shipped files
pnpm test:offline   # end to end, with the network blocked
```

Never point a test or a dev run at your real `~/Documents/Taxpresso`: set `TAXPRESSO_VAULT_PATH` to a temporary folder.

If you work with Claude Code, it reads `CLAUDE.md` on its own.

## Pull requests

- One topic per pull request, with tests for any rule or calculation.
- `pnpm check` passes, and so do `pnpm build`, `pnpm check:bundle` and `pnpm test:offline`.
- Say which official document backs any tax change.

## License of contributions

Taxpresso is licensed under the GNU AGPL, version 3 or later. By sending a contribution, you agree that it is licensed under the same terms, and you confirm you have the right to do so. There is no contributor agreement to sign.

## Security

If you find a security problem, please tell the maintainers privately rather than in a public issue. (A private contact will be listed here when the repository is published.)
