// get_last_year (SPEC.md 5.4 and 11): last year's figures as read from the previous declaration,
// for Claude to compare with this year ("your pillar 3a was CHF 7'000 last year"). Read-only,
// never this year's values.
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { lastYearLines, lastYearText } from './prior.js';
import type { Workspace } from './workspace.js';
import { TaxYears } from './years.js';

export function registerLastYearTool(server: McpServer, given: Workspace | TaxYears): void {
  // The open year's workspace, taken once per call (./years.ts).
  const years = TaxYears.of(given);
  server.registerTool(
    'get_last_year',
    {
      title: "Get last year's figures",
      description:
        "Last year's figures as read from the user's previous Geneva declaration, by rubric code (code), whose, cantonal (ICC) and federal (IFD) column, with the page. For comparison only: never use them as this year's values.",
      inputSchema: z.object({
        all: z
          .boolean()
          .optional()
          .describe('Every line read, not only the main ones. Default false.'),
      }),
      outputSchema: z.object({
        found: z.boolean(),
        taxYear: z.number().int().optional(),
        lines: z.array(
          z.object({
            code: z.string(),
            form: z.string().optional(),
            person: z.string(),
            icc: z.number().int().optional(),
            ifd: z.number().int().optional(),
            page: z.number().int().optional(),
          }),
        ),
      }),
      annotations: {
        title: "Get last year's figures",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ all }) => {
      const ws = years.current;
      await ws.ready();
      const view = ws.lastYear('en');
      if (!view) {
        const text =
          "No previous declaration read yet. Ask the user for last year's declaration (PDF from GeTax, the online declaration or their tax software): they drop it in the dashboard or the Taxpresso folder, then call ingest_vault.";
        return {
          content: [{ type: 'text', text }],
          structuredContent: { found: false, lines: [] },
        };
      }
      const lines = lastYearLines(ws.ledger, view.docId);
      const out = all
        ? lines.map((l) => ({
            code: `${l.code}${l.suffix ?? ''}`,
            form: l.form,
            person: l.person,
            ...(l.icc !== undefined ? { icc: l.icc } : {}),
            ...(l.ifd !== undefined ? { ifd: l.ifd } : {}),
            ...(l.page ? { page: l.page } : {}),
          }))
        : view.sections.flatMap((s) =>
            s.lines.map((l) => ({
              code: l.code,
              person: l.person === 'A' ? 'p1' : l.person === 'B' ? 'p2' : 'household',
              ...(l.icc !== undefined ? { icc: l.icc } : {}),
              ...(l.ifd !== undefined ? { ifd: l.ifd } : {}),
              ...(l.page ? { page: l.page } : {}),
            })),
          );
      return {
        content: [{ type: 'text', text: lastYearText(view, lines, all === true) }],
        structuredContent: {
          found: true,
          ...(view.taxYear ? { taxYear: view.taxYear } : {}),
          lines: out,
        },
      };
    },
  );
}
