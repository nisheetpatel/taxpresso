// reconcile_official_pdf (SPEC.md 10.4 and 11): the chat side of the dashboard's "Check before you
// transmit" card, with the same result. Read-only: it reads the PDF the user added, writes nothing,
// and never transmits anything (C4).
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  declarationCheckReady,
  declarationCheckResult,
  declarationCheckView,
} from './reconcile.js';
import type { Workspace } from './workspace.js';

const Cell = z.object({
  column: z.string(),
  taxpresso: z.number().int().optional(),
  pdf: z.number().int().optional(),
});

export function registerDeclarationCheckTool(server: McpServer, ws: Workspace): void {
  server.registerTool(
    'reconcile_official_pdf',
    {
      title: 'Check the declaration PDF',
      description:
        "Compares the PDF of this year's declaration (from GeTax or the online declaration, added by the user) with the values to type, rubric by rubric, in whole francs: what differs, what is missing. Read-only. The user transmits the declaration themselves.",
      inputSchema: z.object({
        detail: z
          .boolean()
          .optional()
          .describe(
            'Also list the values that match and every line the form works out. Default false.',
          ),
      }),
      outputSchema: z.object({
        found: z.boolean(),
        status: z.string(),
        document: z
          .object({
            id: z.string(),
            filename: z.string(),
            taxYear: z.number().int().optional(),
            software: z.string().optional(),
          })
          .optional(),
        printedYear: z.number().int().optional(),
        clear: z.boolean().optional().describe('Nothing to fix and nothing left unsettled.'),
        counts: z.record(z.string(), z.number().int()).optional(),
        toFix: z
          .array(
            z.object({
              page: z.string(),
              ref: z.string(),
              label: z.string(),
              person: z.string(),
              outcome: z.string(),
              cells: z.array(Cell),
              final: z.boolean().optional(),
            }),
          )
          .optional(),
        matches: z.array(z.record(z.string(), z.unknown())).optional(),
        computedOff: z.array(z.record(z.string(), z.unknown())).optional(),
      }),
      annotations: {
        title: 'Check the declaration PDF',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ detail }) => {
      await ws.ready();
      await declarationCheckReady(ws);
      const { text, structured } = declarationCheckResult(
        declarationCheckView(ws, 'en'),
        detail === true,
      );
      return { content: [{ type: 'text', text }], structuredContent: structured };
    },
  );
}
