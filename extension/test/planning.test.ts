// Pension fund buy-in, 3a catch-up and TOU through the dashboard API and the MCP tools, with the
// decision stored in decisions.json. Synthetic household: Ana Ribeiro, Meyrin, single parent with
// one child, taxed at source, considering TOU (SPEC.md section 13, item 9).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import { createApi, type DashboardState } from '../src/api.js';
import { CantonRegistry } from '../src/cantons.js';
import { readConfig } from '../src/config.js';
import { Dashboard } from '../src/dashboard.js';
import type { ApiRequest } from '../src/dashboard.js';
import { planningReady, touView } from '../src/planning.js';
import { createTaxpressoServer } from '../src/server.js';
import { Workspace } from '../src/workspace.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

const req = (method: 'GET' | 'POST', p: string, body: unknown = {}): ApiRequest => ({
  method,
  path: p,
  query: new URLSearchParams('lang=en'),
  headers: {},
  body: Buffer.from(JSON.stringify(body)),
  csrf: 'csrf-token',
});

const RIBEIRO: [string, unknown][] = [
  ['canton', 'GE'],
  ['civil_status', 'single'],
  ['children', 1],
  ['children_custody', 'with_household'],
  ['commune', 'meyrin'],
  ['moved', 'no'],
  ['income_sources:p1', ['salary']],
  ['employers:p1', 1],
  ['taxed_at_source:p1', true],
  ['tou:p1', 'considering'],
];

async function ribeiro(ws: Workspace) {
  for (const [id, value] of RIBEIRO) await ws.answer(id, value, 'dashboard');
  const api = createApi(ws);
  await api(req('POST', '/plan', { person: 'p1', field: 'gross', value: 80_000 }));
  return api;
}

const planning = async (api: ReturnType<typeof createApi>, p: string, body: unknown) => {
  const res = await api(req('POST', p, body));
  return { status: res.status, state: res.body as DashboardState };
};

describe('TOU in the dashboard', () => {
  it('compares, then records the decision only with the "can\'t be withdrawn" OK', async () => {
    const ws = await makeWorkspace();
    const api = await ribeiro(ws);
    let { state } = await planning(api, '/planning', { field: 'withheld', value: 9_850 });
    let tou = state.planning.tou;
    expect(tou).toMatchObject({ applies: true, compulsory: 'unknown', deadline: '2027-03-31' });
    expect(tou.withheld).toMatchObject({ totalCentimes: 985_000 });
    expect(tou.differenceCentimes).toBe(985_000 - tou.ordinary!.totalCentimes);
    expect(state.planning.needsTou).toBe(true);

    // TOU is not compulsory once the two remaining questions are answered no.
    await planning(api, '/planning', { field: 'otherIncome', value: false });
    ({ state } = await planning(api, '/planning', { field: 'taxableWealth', value: false }));
    tou = state.planning.tou;
    expect(tou.compulsory).toBe('no');

    const unconfirmed = await planning(api, '/decide', {
      id: 'tou',
      choice: 'request',
      confirmed: false,
    });
    expect(unconfirmed.status).toBe(400);
    const ok = await planning(api, '/decide', { id: 'tou', choice: 'request', confirmed: true });
    expect(ok.status).toBe(200);
    expect(ok.state.planning.tou.decision).toMatchObject({
      optimizationId: 'tou',
      choice: 'request',
      deltaCentimes: tou.differenceCentimes,
      via: 'dashboard',
    });
    expect(ok.state.planning.needsTou).toBe(false);
    expect(ok.state.activity[0]).toMatchObject({ by: 'you', what: 'decide' });
    const file = JSON.parse(await readFile(path.join(ws.vault.dir, 'decisions.json'), 'utf8')) as {
      decisions: unknown[];
    };
    expect(file.decisions).toHaveLength(1);

    // A later decision replaces it; the file keeps both.
    const decline = await planning(api, '/decide', {
      id: 'tou',
      choice: 'decline',
      confirmed: false,
    });
    expect(decline.state.planning.tou.decision?.choice).toBe('decline');

    // Another session on the same folder reads it back.
    const again = new Workspace(
      readConfig({ TAXPRESSO_VAULT_PATH: ws.config.vaultPath }),
      new CantonRegistry(2026),
    );
    await again.ready();
    await planningReady(again);
    expect(touView(again).decision?.choice).toBe('decline');
  });

  it('records nothing without the comparison, when compulsory, or after the deadline', async () => {
    const ws = await makeWorkspace();
    const api = await ribeiro(ws);
    const noFigure = await planning(api, '/decide', {
      id: 'tou',
      choice: 'decline',
      confirmed: false,
    });
    expect(noFigure.status).toBe(400);
    expect((noFigure.state as unknown as { error: string }).error).toMatch(/comparison first/);

    await planning(api, '/planning', { field: 'withheld', value: 30_000 });
    await api(req('POST', '/plan', { person: 'p1', field: 'gross', value: 130_000 }));
    const { state } = await planning(api, '/planning', { field: 'otherIncome', value: false });
    expect(state.planning.tou.compulsory).toBe('yes');
    expect(state.planning.needsTou).toBe(false);
    const compulsory = await planning(api, '/decide', {
      id: 'tou',
      choice: 'decline',
      confirmed: false,
    });
    expect(compulsory.status).toBe(400);
  });

  it('estimates the tax withheld from the payslip tariff, and refuses unknown tariffs', async () => {
    const ws = await makeWorkspace();
    const api = await ribeiro(ws);
    let res = await planning(api, '/planning', { field: 'tariff', value: 'h1' });
    expect(res.state.planning.inputs[0]?.tariff).toBe('H1N');
    const withheld = res.state.planning.tou.withheld!;
    expect(withheld.people[0]).toMatchObject({ from: 'tariff', tariff: 'H1N' });
    expect(withheld.totalCentimes).toBeGreaterThan(0);
    expect(res.state.planning.tou.assumptions).toContain('withheld_from_tariff');
    res = await planning(api, '/planning', { field: 'tariff', value: 'A0Y' });
    expect(res.status).toBe(400);
    res = await planning(api, '/planning', { field: 'tariff', value: 'D0' });
    expect(res.status).toBe(400);
  });

  it('prefers the salary certificate (box 12) and says when it still needs the user’s OK', async () => {
    const ws = await makeWorkspace();
    await ribeiro(ws);
    const { document } = await ws.addDocument(
      Buffer.from('%PDF-1.7 synthetic Ribeiro certificate'),
      'certificat-ribeiro.pdf',
      'dashboard',
    );
    await ws.proposeExtraction(document.id, { kind: 'salary_certificate', taxYear: 2026 }, [
      { key: 'salary.gross', value: "80'000.00", page: 1 },
      { key: 'salary.net', value: "70'500.00", page: 1 },
      { key: 'salary.source_tax', value: "9'612.40", page: 1 },
    ]);
    await ws.setPlan('p1', 'plan.source_tax_withheld', 5_000, 'chat');
    await planningReady(ws);
    const tou = touView(ws);
    expect(tou.withheld?.people[0]).toMatchObject({ from: 'certificate', centimes: 961_240 });
    expect(tou.assumptions).toContain('values_to_confirm');
    await ws.confirmDocument(document.id, 'dashboard');
    expect(touView(ws).assumptions).not.toContain('values_to_confirm');
  });
});

describe('pension fund buy-in and 3a catch-up in the dashboard', () => {
  it('shows the saving for an amount within what the fund allows', async () => {
    const ws = await makeWorkspace();
    const api = await ribeiro(ws);
    await planning(api, '/planning', { field: 'lppCapacity', value: 31_000 });
    let { state } = await planning(api, '/planning', { field: 'lppAmount', value: 5_000 });
    expect(state.planning.inputs[0]).toMatchObject({ lppCapacity: 3_100_000, lppAmount: 500_000 });
    expect(state.planning.lpp.saving?.totalCentimes).toBeGreaterThan(0);
    ({ state } = await planning(api, '/planning', { field: 'lppAmount', value: 40_000 }));
    expect(state.planning.lpp.problem).toBe('over_capacity');
    expect(state.planning.lpp.saving).toBeUndefined();
  });

  it('makes up a 2025 gap once the 2026 3a is paid in full', async () => {
    const ws = await makeWorkspace();
    const api = await ribeiro(ws);
    const { state } = await planning(api, '/planning', { field: 'paid2025', value: 0 });
    expect(state.planning.inputs[0]?.paid2025).toBe(0);
    expect(state.planning.catchUp.people[0]).toMatchObject({
      status: 'pay_this_year_first',
      catchUpCentimes: 725_800,
    });
    await api(req('POST', '/plan', { person: 'p1', field: 'paid', value: 7_258 }));
    const after = (await api(req('GET', '/state'))).body as DashboardState;
    expect(after.planning.catchUp.people[0]?.status).toBe('possible');
    expect(after.planning.catchUp.saving?.totalCentimes).toBeGreaterThan(0);
  });
});

describe('the MCP tools', () => {
  async function connect() {
    const uiDir = await makeUiDir();
    const ws = await makeWorkspace(uiDir);
    const dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(ws) });
    const server = createTaxpressoServer({ workspace: ws, dashboard });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(clientSide);
    const call = (name: string, args: Record<string, unknown> = {}) =>
      client.callTool({ name, arguments: args });
    return { ws, call, close: () => client.close() };
  }
  const text = (res: { content: unknown }) => (res.content as { text: string }[])[0]!.text;

  it('lists the buy-in, the catch-up and TOU with their sources, and records the choice', async () => {
    const { ws, call, close } = await connect();
    try {
      for (const [id, value] of RIBEIRO) await call('answer_question', { id, value });
      await call('set_fact', { key: 'plan.gross_salary', value: 80_000 });
      const tariff = await call('set_fact', { key: 'plan.source_tax_tariff', value: 'h1' });
      expect(tariff.isError).toBeFalsy();
      expect(ws.ledger.get('plan.source_tax_tariff', 'p1')?.value).toBe('H1N');
      const refused = await call('decide_optimization', {
        id: 'tou',
        choice: 'request',
        confirmed: false,
      });
      expect(refused.isError).toBe(true);
      expect(text(refused)).toMatch(/can’t be withdrawn/);

      const list = text(await call('list_optimizations'));
      expect(list).toMatch(/Pension fund buy-in \(rachat 2e pilier\)/);
      expect(list).toMatch(/ch-na-law-lpp p\. 66 \(art\. 79b al\. 3\)/);
      expect(list).toMatch(/3a catch-up \(rachat 3a, new from 2026\)/);
      expect(list).toMatch(/ch-na-law-opp3 p\. 9/);
      expect(list).toMatch(/TOU \(taxation ordinaire ultérieure\)/);
      expect(list).toMatch(/from the H1N tariff on the gross salary/);
      expect(list).toMatch(/Deadline: 2027-03-31 \(ge-na-law-risp art\. 8 al\. 1/);
      expect(list).toMatch(/can't be withdrawn, even if the result is worse/);
      expect(list).toMatch(/lower the tax only with TOU/);
      expect(list).toMatch(/No decision yet/);

      const ok = await call('decide_optimization', {
        id: 'tou',
        choice: 'request',
        confirmed: true,
      });
      expect(ok.isError).toBeFalsy();
      expect(text(ok)).toMatch(/DRIS\/TOU form/);
      expect(text(await call('list_optimizations'))).toMatch(/Decision recorded: will request TOU/);
      expect(ws.activity()[0]).toMatchObject({ by: 'claude', what: 'decide' });
    } finally {
      await close();
    }
  });
});
