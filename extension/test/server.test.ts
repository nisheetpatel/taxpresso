import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Dashboard } from '../src/dashboard.js';
import { createApi } from '../src/api.js';
import { createTaxpressoServer, DASHBOARD_VIEW_URI } from '../src/server.js';
import type { Workspace } from '../src/workspace.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

let client: Client;
let dashboard: Dashboard;
let ws: Workspace;

const text = (res: { content: unknown }) => (res.content as { text: string }[])[0]!.text;
const structured = <T>(res: { structuredContent?: unknown }) => res.structuredContent as T;

beforeEach(async () => {
  const uiDir = await makeUiDir();
  ws = await makeWorkspace(uiDir);
  dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(ws) });
  const server = createTaxpressoServer({ workspace: ws, dashboard });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
});

afterEach(async () => {
  await client.close();
  await dashboard.stop();
});

const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args });

describe('MCP surface', () => {
  it('sends instructions that start with get_status and the questionnaire', () => {
    expect(client.getInstructions()).toMatch(/Call get_status first/);
    expect(client.getInstructions()).toMatch(/next_questions/);
  });

  it('annotates every tool (C6)', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'answer_question',
      'compute_tax',
      'dashboard_api',
      'decide_optimization',
      'export_bundle',
      'get_document_for_review',
      'get_form_values',
      'get_holdings',
      'get_last_year',
      'get_status',
      'ingest_vault',
      'list_documents',
      'list_optimizations',
      'mark_entered',
      'next_questions',
      'open_dashboard',
      'propose_extraction',
      'reconcile_official_pdf',
      'replace_document',
      'review_last_year',
      'set_document_owner',
      'set_fact',
      'set_holding',
      'skip_question',
      'waive_requirement',
    ]);
    for (const tool of tools) {
      expect(tool.name.length).toBeLessThan(64);
      expect(tool.annotations?.title).toBeTypeOf('string');
      expect(tool.annotations?.readOnlyHint).toBeTypeOf('boolean');
      expect(tool.annotations?.destructiveHint).toBe(false);
      expect(tool.annotations?.openWorldHint).toBe(false);
    }
  });

  it('starts empty, and never creates the folder just by looking', async () => {
    const res = await call('get_status');
    expect(text(res)).toMatch(/Household: not started/);
    expect(structured<{ nextStep: string }>(res).nextStep).toMatch(/next_questions/);
    expect(ws.vault.exists()).toBe(false);
    const detailed = await call('get_status', { detail: true });
    expect(detailed.structuredContent).toHaveProperty('runtime.node', process.version);
  });

  it('asks the questions and saves answers given in the chat', async () => {
    const q = await call('next_questions');
    expect(text(q)).toMatch(/\[civil_status\] Quel était votre état civil/);
    // An official page Claude can give the user, from the sources library.
    expect(text(q)).toMatch(
      /Official page \(Geneva tax guide 2025, p\. 53: [^)]+\): https:\/\/www\.ge\.ch\//,
    );
    expect(
      structured<{ questions: { learnMore?: { url: string } }[] }>(q).questions[0]?.learnMore?.url,
    ).toMatch(/^https:\/\/www\.ge\.ch\/.+#page=53$/);
    const saved = await call('answer_question', { id: 'civil_status', value: 'single' });
    expect(text(saved)).toMatch(/Saved: Single\./);
    expect(text(saved)).toMatch(/Next question:\n\[children\]/);
    expect(ws.vault.exists()).toBe(true);
    expect(ws.ledger.get('profile.civil_status')).toMatchObject({
      status: 'stated',
      source: { via: 'chat' },
    });

    await call('answer_question', { id: 'children', value: 0 });
    await call('answer_question', { id: 'commune', value: 'Carouge' });
    await call('answer_question', { id: 'moved', value: 'no' });
    await call('answer_question', { id: 'income_sources:p1', value: ['salary'] });
    // How many certificates depends on how many employers: asked next.
    const employers = await call('answer_question', { id: 'employers:p1', value: 2 });
    expect(text(employers)).toMatch(/Documents now needed: Salary certificate/);
    const status = structured<{ household: { summary: string[] } }>(await call('get_status'));
    expect(status.household.summary).toEqual(['Single', 'No children', 'Carouge', '2 employers']);
  });

  it('reports wrong answers as tool errors, and unsupported situations plainly', async () => {
    const bad = await call('answer_question', { id: 'commune', value: 'Lausanne' });
    expect(bad.isError).toBe(true);
    expect(text(bad)).toMatch(/not a Geneva commune/);
    await call('answer_question', { id: 'civil_status', value: 'single' });
    await call('answer_question', { id: 'children', value: 0 });
    await call('answer_question', { id: 'commune', value: 'Onex' });
    await call('answer_question', { id: 'moved', value: 'no' });
    const self = await call('answer_question', {
      id: 'income_sources:p1',
      value: ['self_employment'],
    });
    expect(text(self)).toMatch(/Not supported yet: Self-employment \(annexe B\)\. .*GeTax/);
    expect(structured<{ nextStep: string }>(await call('get_status')).nextStep).toMatch(
      /can't prepare this yet/,
    );
  });

  it('finds documents the user put in the folder, and lists them', async () => {
    await call('answer_question', { id: 'civil_status', value: 'single' });
    await writeFile(path.join(ws.vault.dir, 'certificat.pdf'), '%PDF synthetic');
    const ingest = await call('ingest_vault');
    expect(structured<{ added: string[] }>(ingest).added).toEqual(['certificat.pdf']);
    expect(text(await call('list_documents'))).toMatch(/certificat\.pdf: not identified yet/);
    expect(structured<{ added: string[] }>(await call('ingest_vault')).added).toEqual([]);
  });

  it('serves the MCP Apps view for open_dashboard', async () => {
    const { contents } = await client.readResource({ uri: DASHBOARD_VIEW_URI });
    expect(contents[0]).toMatchObject({ mimeType: 'text/html;profile=mcp-app' });
  });

  it('shows the pillar 3a room, then the saving once a rough salary is saved', async () => {
    const before = await call('list_optimizations');
    expect(text(before)).toMatch(/you: room left CHF 7,258/);
    expect(text(before)).toMatch(/No salary yet/);
    await call('answer_question', { id: 'civil_status', value: 'single' });
    const saved = await call('set_fact', { key: 'plan.gross_salary', value: 95_000 });
    expect(saved.isError).toBeFalsy();
    expect(ws.ledger.get('plan.gross_salary', 'p1')).toMatchObject({
      value: 9_500_000,
      status: 'estimate',
    });
    const after = await call('list_optimizations');
    expect(text(after)).toMatch(/Estimated tax saving .* about CHF [\d,]+/);
    expect(text(after)).toMatch(/Don't recommend specific 3a providers/);
    expect(text(after)).toMatch(/ch-2026-ifd-instructions-personnes-physiques p\. 8/);
  });

  it('computes the tax with the rules engine, flags estimates, and explains with detail', async () => {
    const none = await call('compute_tax');
    expect(structured<{ computed: boolean }>(none).computed).toBe(false);
    expect(text(none)).toMatch(/needs your civil status and your commune/);

    await call('answer_question', { id: 'civil_status', value: 'single' });
    await call('answer_question', { id: 'children', value: 0 });
    await call('answer_question', { id: 'commune', value: 'Carouge' });
    await call('set_fact', { key: 'plan.gross_salary', value: 85_000 });
    const res = await call('compute_tax');
    const s = structured<{
      computed: boolean;
      total: number;
      icc: { total: number };
      ifd: { tax: number };
      estimates: string[];
    }>(res);
    expect(s.computed).toBe(true);
    expect(s.total).toBe(s.icc.total + s.ifd.tax);
    expect(s.estimates.join(' ')).toMatch(/January 2027/);
    expect(text(res)).toMatch(/Cantonal and communal tax \(ICC\): CHF/);
    expect(text(res)).toMatch(/11\.10 Salaires bruts \(you\) CHF 85’000\.00 \[estimate\]/);
    expect(text(res)).toMatch(/detail: true/);

    const detailed = await call('compute_tax', { detail: true });
    expect(text(detailed)).toMatch(/- 31\.50 Déduction forfaitaire pour frais professionnels ICC/);
    expect(text(detailed)).toMatch(/ge-2025-guide-declaration-pp p\. 11, p\. 19 \(31\.50\)/);
    expect(structured<{ detail: { lines: { id: string }[] } }>(detailed).detail.lines).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'icc.incomeBase' })]),
    );
  });

  it('refuses facts outside the planning inputs', async () => {
    const res = await client.callTool({
      name: 'set_fact',
      arguments: { key: 'income.salary', value: 1 },
    });
    expect(res.isError).toBe(true);
  });
});
