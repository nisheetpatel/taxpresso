// export_folder (SPEC.md 10.6 and 11): the chat side of the dashboard's "Save a copy" button, with
// the same result. It writes one new file on this computer and sends nothing anywhere.
import type { McpServer } from '@modelcontextprotocol/server';
import { LedgerError, VaultError } from '@taxpresso/ledger';
import * as z from 'zod/v4';
import { exportFolder, sizeText } from './export.js';
import { WorkspaceError, type Workspace } from './workspace.js';

export function registerExportTool(server: McpServer, ws: Workspace): void {
  server.registerTool(
    'export_folder',
    {
      title: 'Save a copy of the tax folder',
      description:
        "Writes one ZIP of the user's tax-year folder (their documents and what Taxpresso keeps) into their Taxpresso folder on this computer, named with the date. Never overwrites a file and sends nothing anywhere. Returns its path. Only when the user asks.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        path: z.string(),
        file: z.string(),
        folder: z.string(),
        entries: z.number().int(),
        bytes: z.number().int(),
      }),
      annotations: {
        title: 'Save a copy of the tax folder',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const done = await exportFolder(ws);
        const text = `Saved a copy of the ${ws.engine.taxYear} folder: ${done.path} (${done.entries} file${done.entries === 1 ? '' : 's'}, ${sizeText(done.bytes)}). It stays on this computer: Taxpresso sent nothing. It holds the user's documents, so they keep it somewhere private, like the folder itself.`;
        const { path, file, folder, entries, bytes } = done;
        return {
          content: [{ type: 'text', text }],
          structuredContent: { path, file, folder, entries, bytes },
        };
      } catch (err) {
        if (
          err instanceof WorkspaceError ||
          err instanceof VaultError ||
          err instanceof LedgerError
        ) {
          return { content: [{ type: 'text', text: err.message }], isError: true };
        }
        throw err;
      }
    },
  );
}
