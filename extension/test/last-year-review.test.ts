// review_last_year and the dashboard's "Last year, reviewed" on the synthetic Dupont declaration
// (test/fixtures/dupont-declaration-2025.pdf): read-only, the same review in the chat and in the
// dashboard, never part of this year's tax. Always on a temporary vault.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApi, type DashboardState } from '../src/api.js';
import { type ApiRequest, Dashboard } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import type { Workspace } from '../src/workspace.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

const FIXTURES = path.resolve(import.meta.dirname, '../../test/fixtures');
const CHF = (n: number) => Math.round(n * 100);

let client: Client;
let dashboard: Dashboard;
let ws: Workspace;

type Result = Awaited<ReturnType<Client['callTool']>>;
const texts = (res: Result) =>
  (res.content as { type: string; text?: string }[]).map((c) => c.text ?? '').join('\n');
const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args });
const req = (): ApiRequest => ({
  method: 'GET',
  path: '/state',
  query: new URLSearchParams('lang=fr'),
  headers: {},
  body: Buffer.from('{}'),
  csrf: 'csrf-token',
});
const state = async () => (await createApi(ws)(req())).body as DashboardState;
const upload = async () =>
  (
    await ws.addDocument(
      readFileSync(path.join(FIXTURES, 'dupont-declaration-2025.pdf')),
      'declaration-2025.pdf',
      'dashboard',
    )
  ).document;

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

describe('review_last_year', () => {
  it('is read-only and annotated', async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'review_last_year')!;
    expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(tool.description!.length).toBeLessThanOrEqual(300);
  });

  it('says what to drop in when there is no declaration', async () => {
    const res = await call('review_last_year');
    expect(res.structuredContent).toMatchObject({ found: false, status: 'none' });
    expect(texts(res)).toMatch(/last year's declaration \(the PDF from GeTax/);
    expect((await state()).review).toMatchObject({ status: 'none' });
  });

  it('reviews the Dupont declaration: tax, 3a, questions, catch-up, deadlines', async () => {
    await upload();
    const res = await call('review_last_year');
    const r = res.structuredContent as Record<string, unknown> & {
      recomputed: { ifd: number; taxableIncome: { icc: number; ifd: number } };
    };
    expect(r).toMatchObject({ found: true, status: 'ready', year: 2025, couple: true });
    // The commune and the civil status come from the declaration itself (Vernier, married); no
    // children in the answers, so the married scale without the child reduction: 103,443 read at
    // 103,400, 1,561 + 85 x 5 = 1,986 (ch-2025-ifd-frais-professionnels-progression p. 3).
    expect(r.recomputed.taxableIncome).toEqual({ icc: CHF(93_031), ifd: CHF(103_443) });
    expect(r.recomputed.ifd).toBe(CHF(1_986));
    const text = texts(res);
    expect(text).toMatch(/Tax 2025, recomputed: cantonal and communal \(ICC\) CHF/);
    expect(text).toMatch(/doesn't print the tax/);
    expect(text).toMatch(
      /Pillar 3a \(3e pilier A\), you: paid CHF 7’000 \(31\.40, page 5\), with a pension fund \(the declaration shows contributions\); 2025 limit CHF 7’258: CHF 258 left; paying it in full would have saved about CHF/,
    );
    expect(text).toMatch(/flat deduction for work costs \(déduction forfaitaire\)/);
    expect(text).toMatch(/3a catch-up \(rachat 3a\), you: up to CHF 258 can still be paid in 2026/);
    expect(text).toMatch(/set_fact \(plan\.pillar3a_paid_2025\) once the user confirms it/);
    expect(text).toMatch(/No 2025 assessment \(avis de taxation\) in the folder/);
    expect(text).toMatch(/ge-na-law-lpfisc art\. 55 al\. 2; ch-na-law-lifd art\. 147 al\. 2/);
    expect(text).not.toMatch(/—/);
    // The dashboard gets the same review.
    const s = await state();
    expect(s.review).toMatchObject({ status: 'ready', recomputed: { ifd: CHF(1_986) } });
    expect(s.review.filename).toBe('declaration-2025.pdf');
  });

  it('gives the deadline of last year’s assessment, and the assessed tax next to its own', async () => {
    await upload();
    const avis = await ws.addDocument(Buffer.from('%PDF-1.7 avis 2025'), 'avis.pdf', 'chat');
    await ws.proposeExtraction(avis.document.id, { kind: 'tax_assessment', taxYear: 2025 }, [
      { key: 'assessment.tax', value: 'ifd', page: 1 },
      { key: 'assessment.notification_date', value: '15.09.2026', page: 1 },
      { key: 'assessment.tax_amount', value: "1'986.00", page: 1 },
    ]);
    const res = await call('review_last_year');
    const r = res.structuredContent as {
      assessments: { deadlines: { tax: string; date: string }[] }[];
      checks: { id: string; column: string; matches: boolean }[];
    };
    expect(r.assessments[0]!.deadlines).toMatchObject([{ tax: 'ifd', date: '2026-10-15' }]);
    expect(r.checks.at(-1)).toMatchObject({ id: 'assessed_tax', column: 'ifd', matches: true });
    expect(texts(res)).toMatch(/deadline to object \(réclamation\) IFD 2026-10-15/);
  });

  it('never changes this year’s tax', async () => {
    await call('answer_question', { id: 'civil_status', value: 'married' });
    await call('answer_question', { id: 'commune', value: 'Vernier' });
    const before = ws.taxEstimate();
    await upload();
    await call('review_last_year');
    expect(ws.taxEstimate().result).toEqual(before.result);
    expect(before.result).not.toBeNull();
  });
});
