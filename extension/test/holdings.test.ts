// "Your securities and accounts" end to end: a broker export, a bank statement read by Claude, an
// account the user describes in the chat, the official value of a security, whose each line is,
// the dashboard state and its two endpoints, and the items for the tax engine. Synthetic data
// (the Duponts), always on a temporary vault.
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApi, type DashboardState } from '../src/api.js';
import { type ApiRequest, Dashboard } from '../src/dashboard.js';
import { wealthItems } from '../src/holdings.js';
import { createTaxpressoServer } from '../src/server.js';
import type { Workspace } from '../src/workspace.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

const fixture = (name: string): Buffer =>
  readFileSync(new URL(`../../test/fixtures/brokers/${name}`, import.meta.url));

let client: Client;
let dashboard: Dashboard;
let ws: Workspace;

const text = (res: { content: unknown }) => (res.content as { text: string }[])[0]!.text;
const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args });
const post = async (route: string, body: unknown) => {
  const res = await createApi(ws)({
    method: 'POST',
    path: route,
    query: new URLSearchParams('lang=fr'),
    headers: {},
    body: Buffer.from(JSON.stringify(body)),
    csrf: 'csrf',
  } satisfies ApiRequest);
  return res as { status: number; body: DashboardState & { error?: string } };
};

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
  // Jean and Marie Dupont, married.
  await ws.answer('civil_status', 'married', 'chat');
  await writeFile(path.join(ws.vault.dir, 'ibkr.xml'), fixture('dupont-ibkr-2026.xml'));
  await call('ingest_vault');
});

afterEach(async () => {
  await client.close();
  await dashboard.stop();
});

/** A bank statement Claude read, for both of them. */
async function bankStatement() {
  const { document } = await ws.addDocument(
    Buffer.from('%PDF-1.7 synthetic bank statement, Banque Exemple'),
    'banque-2026.pdf',
    'dashboard',
  );
  await ws.proposeExtraction(
    document.id,
    { kind: 'bank_attestation', person: 'household', issuer: 'Banque Exemple', taxYear: 2026 },
    [
      { key: 'bank.account_number', value: 'CH00 0000 1234 5678 9012 3', page: 1 },
      { key: 'bank.balance', value: "25'000.00", page: 1 },
      { key: 'bank.interest_gross', value: '250.00', page: 1 },
      { key: 'bank.withholding_swiss', value: '87.50', page: 1 },
    ],
  );
  return document;
}

describe('the securities list in the chat', () => {
  it('lists each line with what is missing, and asks whose the securities are', async () => {
    const res = await call('get_holdings');
    expect(text(res)).toMatch(/Swiss and foreign securities \(Titres suisses et étrangers, F3\)/);
    expect(text(res)).toMatch(/\[USTXPRS00017\] ESPRESSO INDUSTRIES INC .*broker's estimate/);
    expect(text(res)).toMatch(/Check: CREMA LAC HOLDING SA: say whose it is/);
    // 2026 income: the official list of foreign tax rates is not published yet.
    expect(text(res)).toMatch(/foreign tax CHF 1\.32.*credit not computed: no_list/);
    expect(text(res)).toMatch(/ictax\.admin\.ch/);
    const status = await call('get_status');
    expect(text(status)).toMatch(/État des titres: 0 account line\(s\), 3 securities/);
  });

  it('saves the official value with where it came from, which replaces the estimate', async () => {
    const refused = await call('set_holding', {
      security: 'CHTXPRS00026',
      officialValue: '910.00',
    });
    expect(refused.isError).toBe(true);
    expect(text(refused)).toMatch(/Say where the official value comes from/);

    const saved = await call('set_holding', {
      security: 'CHTXPRS00026',
      officialValue: "1'010.00",
      from: 'ESTV price list 2026, CHF 50.50 x 20',
      owner: 'p1',
    });
    expect(text(saved)).toMatch(/Saved 2 values as the user said/);
    expect(
      ws.ledger.get('securities.value_official_chf', 'household', 'CHTXPRS00026'),
    ).toMatchObject({
      value: 101_000,
      status: 'stated',
      note: 'ESTV price list 2026, CHF 50.50 x 20',
      source: { method: 'user', via: 'chat' },
    });
    const again = await call('set_holding', {
      security: 'CHTXPRS00026',
      officialValue: '1010',
      from: 'ESTV price list 2026, CHF 50.50 x 20',
    });
    expect(text(again)).toMatch(/Nothing changed/);
    expect(text(await call('get_holdings'))).toMatch(
      /\[CHTXPRS00026\] CREMA LAC HOLDING SA \(CHTXPRS00026\); owner p1; value CHF 1’010\.00 \(official value\)/,
    );
    // A security that is not in the list, or a money amount that can't be read: refused.
    expect((await call('set_holding', { security: 'XX000', owner: 'p1' })).isError).toBe(true);
    const bad = await call('set_holding', {
      security: 'CHTXPRS00026',
      officialValue: '1.010',
      from: 'ESTV',
    });
    expect(text(bad)).toMatch(/ambiguous/);
  });

  it('adds an account the user describes, and claims the withholding tax back', async () => {
    await bankStatement();
    const res = await call('set_holding', {
      item: 'ubs-savings',
      kind: 'bank_account',
      name: 'UBS savings',
      value: "12'500.00",
      income: '30.00',
      withholdingSwiss: '10.50',
      owner: 'p2',
    });
    expect(res.isError).toBeFalsy();
    expect(ws.ledger.get('wealth.owner', 'household', 'ubs-savings')?.value).toBe('p2');
    // IA: 35 % of (30 Crema + 250 bank + 30 UBS) = 108.50.
    const items = wealthItems(ws);
    const ia = items.find((i) => i.code === 'F1.IA')!;
    expect(ia).toMatchObject({ centimes: 108_50, person: 'household', estimate: true });
    expect(
      items.find((i) => i.code === '14.00' && i.part === 'wealth' && i.person === 'p2'),
    ).toMatchObject({
      centimes: 12_500_00,
    });
    expect(
      items.find((i) => i.code === '14.00' && i.part === 'wealth' && i.person === 'household')
        ?.centimes,
    ).toBeGreaterThan(25_000_00);
    expect(items.find((i) => i.code === '56.30' && i.person === 'p2')?.centimes).toBe(30_00);
    // A new item needs its name and value; an existing one can't change kind.
    expect(text(await call('set_holding', { item: 'x', kind: 'crypto' }))).toMatch(/name/);
    expect(text(await call('set_holding', { item: 'ubs-savings', kind: 'debt' }))).toMatch(
      /is a bank_account/,
    );
  });
});

describe('the dashboard card', () => {
  it('shows the lines in the form’s order, the IA to get back and what to complete', async () => {
    const statement = await bankStatement();
    const res = await post('/holdings/owner', {
      id: 'USTXPRS00017',
      origin: 'broker_export',
      owner: 'joint',
    });
    const view = res.body.holdings!;
    expect(view.sections.map((s) => [s.form, s.official, s.lines.length])).toEqual([
      ['F2', 'Comptes bancaires et postaux', 1],
      ['F3', 'Titres suisses et étrangers', 3],
      ['F4', 'Relevés fiscaux', 0],
    ]);
    const bank = view.sections[0]!.lines[0]!;
    expect(bank).toMatchObject({
      docId: statement.id,
      owner: 'joint',
      ownerLabel: 'Vous deux',
      civilite: 'A B',
      reference: '67890123',
      state: 'needs_ok',
      columns: { subjectIa: 250_00, taxableValue: 25_000_00, savingsInterest: 250_00 },
    });
    const us = view.sections[1]!.lines.find((l) => l.id === 'USTXPRS00017')!;
    expect(us).toMatchObject({
      owner: 'joint',
      canEnterOfficial: true,
      valueBasis: 'broker',
      brokerChf: 100_400,
    });
    expect(us.issues.map((i) => i.text)).toEqual([
      expect.stringMatching(/la liste officielle des impôts étrangers pour les revenus 2026/),
    ]);
    expect(view.ia).toMatchObject({ claim: 98_00, complete: true }); // 35 % of 280
    expect(view.officialHelp).toMatch(/ictax\.admin\.ch/);
    expect(view.exports).toEqual([
      expect.objectContaining({ filename: 'ibkr.xml', issuer: 'Interactive Brokers' }),
    ]);
    expect(view.exports[0]!.toConfirm).toBeGreaterThan(0);
    expect(view.owners.map((o) => o.value)).toEqual(['p1', 'p2', 'joint', 'children']);

    // The official value from the card.
    const after = await post('/holdings/official', {
      id: 'USTXPRS00017',
      value: '1250.00',
      from: 'Liste des cours AFC 2026',
    });
    const line = after.body.holdings!.sections[1]!.lines.find((l) => l.id === 'USTXPRS00017')!;
    expect(line).toMatchObject({
      valueBasis: 'official',
      official: {
        centimes: 125_000,
        from: 'Liste des cours AFC 2026',
        status: 'stated',
        via: 'dashboard',
      },
      columns: { taxableValue: 1250_00 },
    });
    const refused = await post('/holdings/official', {
      id: 'USTXPRS00017',
      value: 'abc',
      from: 'x',
    });
    expect(refused.status).toBe(400);

    // Whose a document's line is: the document's owner.
    const moved = await post('/holdings/owner', {
      id: statement.id,
      origin: 'document',
      owner: 'p1',
    });
    expect(moved.body.holdings!.sections[0]!.lines[0]!.owner).toBe('p1');
    expect(ws.documents.find((d) => d.id === statement.id)?.person).toBe('p1');
  });

  it('confirms an export’s values in one tap and keeps them confirmed', async () => {
    const doc = ws.documents[0]!;
    const res = await post('/documents/confirm', { id: doc.id });
    expect(res.body.holdings!.exports[0]!.toConfirm).toBe(0);
    const crema = res.body.holdings!.sections[1]!.lines.find((l) => l.id === 'CHTXPRS00026')!;
    // Confirmed by the user, but the value stays the broker's estimate until the official one.
    expect(crema).toMatchObject({ state: 'estimate', valueBasis: 'broker' });
  });
});
