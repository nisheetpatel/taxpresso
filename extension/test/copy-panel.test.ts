// The copy panel in the dashboard and for Claude (SPEC.md 10.5): values from the documents the user
// confirmed and their answers, in the form's order, with "Entered" ticks kept in the vault.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import type { CopyPanelState } from '../../ui/src/dashboard/types-copy.js';
import { createApi, type DashboardState } from '../src/api.js';
import type { ApiRequest } from '../src/dashboard.js';
import { Dashboard } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

const FIXTURES = path.resolve(import.meta.dirname, '../../test/fixtures');

const req = (
  method: 'GET' | 'POST',
  route: string,
  body: unknown = {},
  lang = 'fr',
): ApiRequest => ({
  method,
  path: route,
  query: new URLSearchParams(`lang=${lang}`),
  headers: {},
  body: Buffer.from(JSON.stringify(body)),
  csrf: 'csrf-token',
});

async function setUp() {
  const ws = await makeWorkspace();
  const api = createApi(ws);
  for (const [id, value] of [
    ['canton', 'GE'],
    ['civil_status', 'single'],
    ['children', 0],
    ['commune', 'Meyrin'],
  ] as const) {
    await api(req('POST', '/answer', { id, value }));
  }
  const { document } = await ws.addDocument(
    await readFile(path.join(FIXTURES, 'dupont-certificat-salaire-2026.pdf')),
    'Certificat de salaire 2026.pdf',
    'dashboard',
  );
  await ws.proposeExtraction(
    document.id,
    { kind: 'salary_certificate', taxYear: 2026, issuer: 'Exemple Horlogerie SA' },
    [
      { key: 'salary.base', value: "84'000.40", page: 1, box: '1' },
      { key: 'salary.non_periodic', value: "1'000.00", page: 1, box: '3' },
      { key: 'salary.gross', value: "85'000.40", page: 1, box: '8' },
      { key: 'salary.social_contributions', value: "5'412.60", page: 1, box: '9' },
      { key: 'salary.canteen', value: true, page: 1, box: 'G' },
    ],
  );
  const state = async (route = '/state', body?: unknown) => {
    const res = await api(route === '/state' ? req('GET', route) : req('POST', route, body));
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return res.body as DashboardState;
  };
  return { ws, api, state, docId: document.id };
}

const rowsOf = (s: DashboardState) =>
  s.copyPanel.sections.flatMap((x) =>
    x.groups.flatMap((g) => g.rows.map((r) => ({ page: x.page, ...r }))),
  );

describe('the copy panel in the dashboard', () => {
  it('lists the values in the form’s order, as the form wants them, not final until confirmed', async () => {
    const { state } = await setUp();
    const s = await state();
    // The page's own type for this part of the state (checked by tsc, not at run time).
    const forThePage: CopyPanelState = s.copyPanel;
    expect(forThePage).toMatchObject({
      taxYear: 2026,
      formYear: 2025,
      provisional: true,
      couple: false,
    });
    expect(s.copyPanel.sections.map((x) => x.page)).toEqual(['PG1', 'PG3', 'A1']);
    expect(rowsOf(s).map((r) => [r.page, r.ref, r.copy, r.status, r.final])).toEqual([
      ['PG1', 'PG1-COMMUNE', '6630', 'stated', true],
      // From the tax engine: net and taxable income, ICC then IFD (85,000 - 5,413 - 1,812 and
      // - 2,388), not final while the certificate needs the user's OK.
      ['PG3', '95.00', '77775', 'extracted', false],
      ['PG3', '95.00', '77199', 'extracted', false],
      ['PG3', '99.00', '77775', 'extracted', false],
      ['PG3', '99.00', '77199', 'extracted', false],
      ['A1', '11.10-1', '84000', 'extracted', false],
      ['A1', '11.15', '1000', 'extracted', false],
      ['A1', 'CS-G', undefined, 'extracted', false],
      ['A1', '31.10', '5413', 'extracted', false],
      // The flat professional deductions, IFD (3 % of 79,587) and ICC (maximum 1,812).
      ['A1', '31.20', '2388', 'extracted', false],
      ['A1', '31.50', '1812', 'extracted', false],
    ]);
    const salary = rowsOf(s).find((r) => r.ref === '11.10-1')!;
    expect(salary).toMatchObject({
      label: 'Salaires bruts',
      gloss: 'Salaire (chiffre 1 du certificat de salaire), une ligne par employeur',
      centimes: 8_400_040,
      rounded: true,
      fields: [{ id: 'employer', value: 'Exemple Horlogerie SA' }],
      documents: [{ filename: 'Certificat de salaire 2026.pdf' }],
      enterable: false,
    });
    const a1 = s.copyPanel.sections.find((x) => x.page === 'A1')!;
    expect(a1).toMatchObject({
      entered: 0,
      total: 4,
      pending: 6,
      title: 'Activité dépendante 2025',
    });
  });

  it('ticks a confirmed value as entered, in the vault only, and unticks it when it changes', async () => {
    const { ws, api, state, docId } = await setUp();
    // A value that still needs the user's OK can't be ticked.
    const pending = rowsOf(await state()).find((r) => r.ref === '31.10')!;
    const refused = await api(req('POST', '/form/entered', { id: pending.id, entered: true }));
    expect(refused.status).toBe(400);
    expect((refused.body as { error: string }).error).toMatch(/Confirm this value first/);

    await ws.confirmDocument(docId, 'dashboard');
    let s = await state('/form/entered', { id: pending.id, entered: true });
    // The ICC flat deduction stays an estimate until Geneva publishes its 2026 values.
    expect(s.copyPanel.sections.find((x) => x.page === 'A1')).toMatchObject({
      entered: 1,
      total: 4,
      pending: 1,
    });
    const file = JSON.parse(await readFile(path.join(ws.vault.dir, 'entered.json'), 'utf8')) as {
      form: Record<string, string>;
    };
    expect(file.form).toEqual({ [pending.id]: '5413' });
    expect(ws.ledger.view().some((f) => f.key.startsWith('form'))).toBe(false);

    // The user corrects the value: the tick no longer holds.
    const fact = ws.ledger.get('salary.social_contributions', 'p1', docId)!;
    await ws.editFact(fact.id, "5'500.00", 'dashboard');
    s = await state();
    expect(rowsOf(s).find((r) => r.ref === '31.10')).toMatchObject({
      copy: '5500',
      entered: false,
    });
    s = await state('/form/entered', { id: pending.id, entered: false });
    expect(s.copyPanel.entered).toBe(0);
  });

  it('places the travel and meal lines the engine works out from the answers', async () => {
    const { api, state } = await setUp();
    for (const [id, value] of [
      ['income_sources:p1', ['salary']],
      ['commute:p1', 'public_transport_long'],
      ['commute_transit_cost:p1', "1'200"],
      ['meal_days:p1', 210],
    ] as const) {
      const res = await api(req('POST', '/answer', { id, value }));
      expect(res.status, JSON.stringify(res.body)).toBe(200);
    }
    const rows = rowsOf(await state());
    const row = (ref: string) => rows.find((r) => r.ref === ref);
    // Federal: the pass 1,200 (under 3,300); meals 210 x 7.50, half as box G is ticked (under 1,600).
    expect(row('31.71')).toMatchObject({ copy: '1200', columns: [{ id: 'ifd' }] });
    // Geneva: travel at most 534 and the same meals (a trip of over 2 hours): 2,109 beats the flat
    // 1,812, so actual costs replace 31.50. The Geneva meals rest on the 2025 amounts (an estimate
    // until the 2026 guide), so 31.60 has one line per column.
    expect(row('31.70')).toMatchObject({ copy: '534', columns: [{ id: 'icc' }] });
    expect(
      rows
        .filter((r) => r.ref === '31.60')
        .map((r) => [r.columns.map((c) => c.id), r.copy, r.status]),
    ).toEqual([
      [['icc'], '1575', 'estimate'],
      [['ifd'], '1575', 'computed'],
    ]);
    expect(row('31.50')).toBeUndefined();
  });

  it('shows English glosses next to the official French labels', async () => {
    const { api } = await setUp();
    const s = (await api(req('GET', '/state', {}, 'en'))).body as DashboardState;
    expect(rowsOf(s).find((r) => r.ref === '31.10')).toMatchObject({
      label: 'Cotisations AVS/AI, APG, Chômage, AANP, Amat',
      gloss: 'Social insurance contributions (box 9)',
      columns: [
        { id: 'icc', label: 'ICC' },
        { id: 'ifd', label: 'IFD' },
      ],
    });
    expect(s.copyPanel.note).toMatch(/2025 form/);
  });
});

describe('get_form_values', () => {
  it('gives Claude the sections, then one section’s values, concisely', async () => {
    const { ws, docId } = await setUp();
    const uiDir = await makeUiDir();
    const dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(ws) });
    const server = createTaxpressoServer({ workspace: ws, dashboard });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(clientSide);
    const text = (res: { content: unknown }) => (res.content as { text: string }[])[0]!.text;

    const all = await client.callTool({ name: 'get_form_values', arguments: {} });
    expect(text(all)).toMatch(/Entered: 0 of 5; 10 not final yet/);
    expect(text(all)).toMatch(
      /- PG1 Déclaration fiscale 2025 \(Cover page: about you\): 0 of 1 entered\n/,
    );
    expect(text(all)).toMatch(
      /- A1 Activité dépendante 2025 \(Salaried work, taxpayer A\): 0 of 4 entered, 6 not final/,
    );
    expect(all.structuredContent).toMatchObject({
      provisional: true,
      entered: 0,
      total: 5,
      pending: 10,
    });

    await ws.confirmDocument(docId, 'chat');
    const a1 = await client.callTool({ name: 'get_form_values', arguments: { section: 'a1' } });
    expect(text(a1)).toMatch(
      /- 11\.10-1 Salaires bruts \(Salary \(box 1 of your salary certificate\), one line per employer\) \[ICC et IFD\]: 84000 \(from CHF 84'000\.40, rounded to the franc\); Nom de l’employeur – Adresse du lieu de travail: Exemple Horlogerie SA\. Confirmed by you\./,
    );
    expect(text(a1)).toMatch(
      /- CS-G Contribution aux frais de repas .*: tick the box\. Confirmed by you\./,
    );
    expect(text(a1)).toMatch(/- 31\.10 .*\[ICC \+ IFD\]: 5413 .*Confirmed by you\./);

    const none = await client.callTool({ name: 'get_form_values', arguments: { section: 'D1' } });
    expect(none.isError).toBe(true);
    expect(text(none)).toMatch(/Sections with values: PG1, PG3, A1/);
    await client.close();
  });
});
