// Childcare per child, end to end through the extension: the maximum is per child, for the
// cantonal and the federal tax (ge-2025-guide-declaration-pp p. 30; StG ZH § 31 Abs. 1 lit. j;
// ch-2026-ifd-instructions-personnes-physiques p. 8). Crèche invoices for the household come as one
// total: within one child's maximum every split gives the same deduction, and nothing more is
// asked; above it, with several children, the question per child appears and the tax waits for it.
// Synthetic households on a temporary vault, never the real one: the Exemple family in Lancy and
// the Beispiel family in Zürich.
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import type { DocumentKind } from '@taxpresso/ledger';
import { NOTE as GE_NOTE } from '@taxpresso/rules-ge';
import { NOTE as ZH_NOTE, type ZhTaxResult } from '@taxpresso/rules-zh';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApi } from '../src/api.js';
import { Dashboard } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import type { Workspace } from '../src/workspace.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

let client: Client;
let dashboard: Dashboard;
let ws: Workspace;

const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args });

beforeEach(async () => {
  const uiDir = await makeUiDir();
  ws = await makeWorkspace(uiDir);
  dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(ws) });
  const server = createTaxpressoServer({ workspace: ws, dashboard });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
  await ws.ready();
});

afterEach(async () => {
  await client.close();
  await dashboard.stop();
});

async function answer(pairs: [string, unknown][]) {
  for (const [id, value] of pairs) {
    const res = await call('answer_question', { id, value });
    expect(res.isError, `${id}: ${JSON.stringify(res.content)}`).toBeFalsy();
  }
}

/** Every other question, answered with its first plain option (no, none, zero). */
async function answerTheRest() {
  for (let i = 0; i < 60; i++) {
    const slot = ws.next();
    if (!slot) return;
    const q = slot.question;
    const value =
      q.type === 'yesno'
        ? false
        : q.type === 'multi'
          ? []
          : q.type === 'number'
            ? (q.min ?? 0)
            : q.type === 'money'
              ? 0
              : q.options?.find((o) => !o.notSupported)?.value;
    try {
      await ws.answer(slot.id, value, 'chat');
    } catch {
      await ws.skip(slot.id);
    }
  }
}

let n = 0;
/** A document of the user's with the values they confirmed (synthetic bytes). */
async function confirmed(
  kind: DocumentKind,
  person: 'p1' | 'p2' | 'household',
  values: [string, string][],
) {
  n += 1;
  const { document } = await ws.addDocument(
    Buffer.from(`%PDF-1.7 synthetic childcare test document ${n}`),
    `${kind}-${n}.pdf`,
    'dashboard',
  );
  await ws.proposeExtraction(
    document.id,
    { kind, taxYear: 2026, person },
    values.map(([key, value]) => ({ key, value, page: 1 })),
  );
  await ws.confirmDocument(document.id, 'dashboard');
}

/** Two salaries, from the certificates. */
async function salaries() {
  for (const [p, gross] of [
    ['p1', "90'000.00"],
    ['p2', "60'000.00"],
  ] as const) {
    await confirmed('salary_certificate', p, [
      ['salary.base', gross],
      ['salary.gross', gross],
    ]);
  }
}

const invoice = (francs: string) =>
  confirmed('childcare_invoice', 'household', [['childcare.costs', francs]]);
const open = () =>
  ws
    .snapshot()
    .slots.filter((s) => s.value === undefined)
    .map((s) => s.id);
const ded = (items: readonly { code: string; amount: number }[] | undefined, code: string) =>
  -(items?.find((i) => i.code === code)?.amount ?? 0);

describe('childcare paid for two children in Geneva', () => {
  async function exemple() {
    await answer([
      ['canton', 'GE'],
      ['civil_status', 'married'],
      ['children', 2],
      ['children_custody', 'with_household'],
      ['childcare', 'creche_or_daycare'],
      ['commune', 'lancy'],
      ['moved', 'no'],
      ['income_sources:p1', ['salary']],
      ['income_sources:p2', ['salary']],
      ['employers:p1', 1],
      ['employers:p2', 1],
      ['residence:p1', 'swiss'],
    ]);
    await answerTheRest();
    await salaries();
  }

  it('asked per child only above one child’s maximum; the tax waits for it, then each child’s costs at most the maximum', async () => {
    await exemple();
    // 25,000 of invoices: within one child's maximum, every split gives the same.
    await invoice("15'000.00");
    await invoice("10'000.00");
    expect(open()).toEqual([]);
    const within = ws.taxEstimate().result!;
    expect(ded(within.icc?.items, '59.10')).toBe(2_500_000);
    expect(ded(within.ifd?.items, '59.12')).toBe(2_500_000);
    // 35,000: above it, so how it splits decides.
    await invoice("10'000.00");
    expect(open()).toEqual(['child_care:child1', 'child_care:child2']);
    const waiting = ws.taxEstimate().result!;
    expect(waiting.icc).toBeNull();
    expect(waiting.ifd).toBeNull();
    expect(waiting.unsupported).toContainEqual(GE_NOTE.childcareSplit);
    // The chat's next step is the question.
    const next = (await call('next_questions', { limit: 2 })).structuredContent as {
      questions: { id: string }[];
    };
    expect(next.questions.map((q) => q.id)).toEqual(['child_care:child1', 'child_care:child2']);
    expect(JSON.stringify(next.questions[0])).toMatch(
      /How much of the childcare you paid in 2026 was for child 1\?/,
    );
    await answer([
      ['child_care:child1', 30_000],
      ['child_care:child2', 5_000],
    ]);
    expect(open()).toEqual([]);
    // 26,320 + 5,000 for the ICC (59.10), 25,800 + 5,000 for the IFD (59.12).
    const r = ws.taxEstimate().result!;
    expect(ded(r.icc?.items, '59.10')).toBe(3_132_000);
    expect(ded(r.ifd?.items, '59.12')).toBe(3_080_000);
  });
});

describe('childcare paid for two children in Zurich', () => {
  async function beispiel() {
    await answer([
      ['canton', 'ZH'],
      ['civil_status', 'married'],
      ['children', 2],
      ['children_custody', 'with_household'],
      ['childcare', 'nanny'],
      ['commune', '261'],
      ['moved', 'no'],
      ['church:p1', 'none'],
      ['church:p2', 'none'],
      ['income_sources:p1', ['salary']],
      ['income_sources:p2', ['salary']],
      ['employers:p1', 1],
      ['employers:p2', 1],
      ['residence:p1', 'swiss'],
    ]);
    await answerTheRest();
    await salaries();
  }

  it('above one child’s limit: asked per child, then each child’s costs at most the limit', async () => {
    await beispiel();
    await invoice("20'000.00");
    expect(open()).toEqual([]);
    await invoice("10'000.00");
    expect(open()).toEqual(['child_care:child1', 'child_care:child2']);
    const waiting = ws.estimate().result as ZhTaxResult;
    expect(waiting.icc).toBeNull();
    expect(waiting.unsupported).toContainEqual(ZH_NOTE.childcareSplit);
    await answer([
      ['child_care:child1', 26_000],
      ['child_care:child2', 4_000],
    ]);
    // 25,300 + 4,000 for the cantonal tax (376), 25,800 + 4,000 for the federal tax.
    const r = ws.estimate().result as ZhTaxResult;
    expect(ded(r.icc?.items, '376')).toBe(2_930_000);
    expect(ded(r.ifd?.items, '376')).toBe(2_980_000);
  });
});
