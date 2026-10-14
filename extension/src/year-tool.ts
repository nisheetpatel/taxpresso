// open_tax_year: the tax year the user prepares or checks, chosen in the chat (the voice mic
// included) exactly as with the dashboard's year switch: both call TaxYears.open and write the same
// record, open-year.json (docs/design/tax-years.md).
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { cantonNames, CANTONS } from './cantons.js';
import {
  cantonsForYear,
  DEFAULT_TAX_YEAR,
  offeredYears,
  yearsText,
  type TaxYears,
} from './years.js';
import { WorkspaceError } from './workspace.js';

/** "Geneva only" for a year some cantons don't have: what Claude says when the user's canton isn't one. */
function cantonsWords(year: number): string {
  const cantons = cantonsForYear(year);
  const missing = (Object.keys(CANTONS) as (keyof typeof CANTONS)[]).filter(
    (c) => !cantons.includes(c),
  );
  return missing.length
    ? `For ${year}, Taxpresso prepares ${cantonNames(cantons, 'and')} returns only: for ${cantonNames(missing, 'or')}, say plainly that the ${year} return isn't available there yet, and suggest the canton's free software.`
    : `For ${year}, Taxpresso prepares every canton it covers.`;
}

export function registerYearTool(server: McpServer, years: TaxYears): void {
  server.registerTool(
    'open_tax_year',
    {
      title: 'Open a tax year',
      description: `Opens the tax year the user wants to prepare or check (${yearsText()}), like the dashboard's year switch. Each year keeps its own answers, documents and checks. Only when the user asks for another year; then call get_status.`,
      inputSchema: z.object({
        year: z.number().int().describe('The tax year, e.g. 2025.'),
      }),
      outputSchema: z.object({
        open: z.number().int(),
        previous: z.number().int(),
        cantons: z.array(z.string()).describe('The cantons Taxpresso prepares for that year.'),
        over: z.boolean().describe('31 December of that year has passed.'),
        years: z.array(z.number().int()).describe('Every year Taxpresso prepares.'),
      }),
      annotations: {
        title: 'Open a tax year',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ year }) => {
      const previous = years.year;
      try {
        const ws = await years.open(year, 'chat');
        await ws.ready();
        const over = ws.yearOver();
        const lines = [
          previous === year
            ? `Tax year ${year} is open (it already was).`
            : `Tax year ${year} is open now (it was ${previous}). Its answers, documents, checks and ticks are its own; ${previous} stays as it was, and the user can go back to it any time.`,
          cantonsWords(year),
          ...(over
            ? [
                `${year} is over: its return takes what was paid and earned in ${year}, from the documents of ${year}. The plans before 31 December (pillar 3a, a pension fund buy-in, the 3a catch-up) are ${DEFAULT_TAX_YEAR}'s: if the user asks about them, offer to switch back with open_tax_year ${DEFAULT_TAX_YEAR}.`,
              ]
            : []),
          'Call get_status for where this year stands and the next step.',
        ];
        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          structuredContent: {
            open: year,
            previous,
            cantons: cantonsForYear(year),
            over,
            years: offeredYears(),
          },
        };
      } catch (err) {
        if (err instanceof WorkspaceError) {
          return { content: [{ type: 'text', text: err.message }], isError: true };
        }
        throw err;
      }
    },
  );
}
