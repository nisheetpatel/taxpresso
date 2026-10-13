// MCP tools for the securities list (état des titres) and the other movable wealth (SPEC.md 11,
// C6: narrow descriptions, annotations, concise results with detail on request).
import type { McpServer } from '@modelcontextprotocol/server';
import { LedgerError } from '@taxpresso/ledger';
import {
  OWNERS,
  RUBRICS_2026,
  SECTIONS_2026,
  WEALTH_KINDS,
  type EtatLine,
} from '@taxpresso/rules-ge';
import * as z from 'zod/v4';
import { chf, holdings, holdingsStatusText, saveHolding } from './holdings.js';
import { WorkspaceError, type Workspace } from './workspace.js';

const ANNOTATIONS = { destructiveHint: false, openWorldHint: false } as const;

function lineText(l: EtatLine): string {
  const value =
    l.valueBasis === 'official'
      ? 'official value'
      : l.valueBasis === 'broker'
        ? "broker's estimate, official value not entered"
        : l.valueBasis === 'you'
          ? 'as the user said'
          : 'from the document';
  const income = l.columns.subjectIa + l.columns.notSubjectIa;
  const parts = [
    `${l.name}${l.reference ? ` (${l.reference})` : ''}`,
    l.owner ? `owner ${l.owner}` : 'owner not known',
    `value ${chf(l.columns.taxableValue)} (${value})`,
    `income ${chf(income)}${l.columns.subjectIa ? `, ${chf(l.columns.subjectIa)} subject to IA` : ''}`,
  ];
  if (l.foreign) {
    parts.push(
      `foreign tax ${chf(l.foreign.withheld)}${l.foreign.nonRecoverable !== undefined ? `, non-recoverable ${chf(l.foreign.nonRecoverable)}` : ''}${l.foreign.recoverableAbroad ? `, ${chf(l.foreign.recoverableAbroad)} only reclaimable abroad` : ''}${l.foreign.problem ? ` (credit not computed: ${l.foreign.problem})` : ''}`,
    );
  }
  if (l.state !== 'confirmed')
    parts.push(l.state === 'needs_ok' ? "needs the user's OK" : 'estimate');
  if (!l.complete) parts.push('incomplete');
  return `- [${l.id}] ${parts.join('; ')}`;
}

export function registerHoldingTools(server: McpServer, ws: Workspace): void {
  server.registerTool(
    'get_holdings',
    {
      title: 'Get the securities list',
      description:
        "The securities list (état des titres) and other wealth as Taxpresso computes them: each line, whose it is, its value (official or the broker's estimate), income, the withholding tax claimed back, foreign tax, what is missing. detail: amounts by rubric code.",
      inputSchema: z.object({
        detail: z.boolean().optional().describe('Also list the amounts by rubric code and person.'),
      }),
      outputSchema: z.object({
        summary: z.string(),
        lines: z.number().int(),
        missing: z.array(z.string()),
        items: z.array(z.record(z.string(), z.unknown())).optional(),
      }),
      annotations: {
        title: 'Get the securities list',
        readOnlyHint: true,
        idempotentHint: true,
        ...ANNOTATIONS,
      },
    },
    async ({ detail }) => {
      await ws.ready();
      const etat = holdings(ws);
      const summary =
        holdingsStatusText(etat) ??
        'The securities list is empty: no accounts, securities or other wealth yet.';
      const text = [summary];
      for (const section of ['accounts', 'securities', 'statements'] as const) {
        const lines = etat.lines.filter((l) => l.section === section);
        if (!lines.length) continue;
        text.push(
          `${SECTIONS_2026[section].en} (${SECTIONS_2026[section].fr}, ${SECTIONS_2026[section].form}):`,
        );
        text.push(...lines.map(lineText));
      }
      if (etat.other.length) text.push('Other wealth and debts:');
      for (const o of etat.other) {
        const rubric = o.rubric === 'lifeInsurance' ? 'lifeInsuranceValue' : o.rubric;
        text.push(
          `- [${o.id}] ${RUBRICS_2026[rubric].en} (${RUBRICS_2026[rubric].code}): ${o.name}${o.value !== undefined ? `, ${chf(o.value)}` : ''}${o.flow !== undefined ? `, ${o.rubric === 'debts' ? 'interest' : 'premiums'} ${chf(o.flow)}` : ''}`,
        );
      }
      const missing = etat.issues.map(
        (i) => `${i.severity === 'missing' ? 'Missing' : 'Check'}: ${i.text.en}`,
      );
      if (missing.length) text.push(...missing);
      if (etat.lines.some((l) => l.valueBasis === 'broker')) {
        text.push(
          'Official values: the user looks them up in the ESTV price list (ictax.admin.ch) and you save what they give with set_holding. Never give a value from your own knowledge.',
        );
      }
      const items = detail
        ? etat.items.map((i) => ({
            code: i.code,
            part: i.part,
            person: i.person,
            chf: chf(i.centimes),
            estimate: i.estimate,
            complete: i.complete,
          }))
        : undefined;
      if (items)
        text.push(
          ...items.map(
            (i) =>
              `${i.code} ${i.part} ${i.person}: ${i.chf}${i.complete ? '' : ' (incomplete)'}${i.estimate ? ' (estimate)' : ''}`,
          ),
        );
      return {
        content: [{ type: 'text', text: text.join('\n') }],
        structuredContent: {
          summary,
          lines: etat.lines.length,
          missing,
          ...(items ? { items } : {}),
        },
      };
    },
  );

  const amount = z.string().max(40).optional();
  server.registerTool(
    'set_holding',
    {
      title: 'Save a holding the user described',
      description:
        "Saves what the user said about their holdings: a security's official ESTV value (security, officialValue, from), whose a line is, or an account, crypto, loan, life insurance, valuables or debt without a document (item, kind, name, value). Amounts in CHF as text. Only what the user gave.",
      inputSchema: z.object({
        security: z.string().max(64).optional().describe('ISIN of a security in the list.'),
        officialValue: amount.describe(
          'Official taxable value of the whole holding on 31 December, CHF, e.g. "1\'234.00".',
        ),
        from: z
          .string()
          .max(200)
          .optional()
          .describe(
            'Where the official value comes from, e.g. "ESTV price list 2026, CHF 61.70 x 20".',
          ),
        income: amount.describe('Gross income of the year, CHF.'),
        owner: z
          .enum(OWNERS)
          .optional()
          .describe('p1 the user, p2 their partner, joint, or children.'),
        item: z
          .string()
          .max(48)
          .optional()
          .describe('Something without a document: a short id such as "ubs-savings".'),
        kind: z.enum(WEALTH_KINDS).optional().describe('What the item is.'),
        name: z.string().max(120).optional().describe('Bank, insurer, creditor or description.'),
        value: amount.describe('Balance, value, surrender value or debt on 31 December, CHF.'),
        withholdingSwiss: amount.describe('Swiss withholding tax (impôt anticipé) deducted, CHF.'),
        fees: amount.describe('Deductible account fees, CHF.'),
        premiums: amount.describe('Life insurance premiums paid in the year, CHF.'),
        interestPaid: amount.describe('Interest paid on the debt in the year, CHF.'),
        abroad: z.boolean().optional().describe('The account is held abroad.'),
        estimate: z
          .boolean()
          .optional()
          .describe('The user gave a rough figure: saved as an estimate.'),
      }),
      outputSchema: z.object({ saved: z.number().int() }),
      annotations: {
        title: 'Save a holding the user described',
        readOnlyHint: false,
        idempotentHint: false,
        ...ANNOTATIONS,
      },
    },
    async (args) => {
      try {
        const saved = await saveHolding(ws, args, 'chat');
        const summary = holdingsStatusText(holdings(ws));
        return {
          content: [
            {
              type: 'text',
              text: `${saved ? `Saved ${saved} value${saved === 1 ? '' : 's'} as the user said${args.estimate ? ' (estimate, to settle before filing)' : ''}.` : 'Nothing changed: those values were already saved.'}${summary ? `\n${summary}` : ''}`,
            },
          ],
          structuredContent: { saved },
        };
      } catch (err) {
        if (err instanceof WorkspaceError || err instanceof LedgerError) {
          return { content: [{ type: 'text', text: err.message }], isError: true };
        }
        throw err;
      }
    },
  );
}
