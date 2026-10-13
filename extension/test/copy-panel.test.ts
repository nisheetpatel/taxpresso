// The copy panel in the dashboard and for Claude (SPEC.md 10.5): values from the documents the user
// confirmed and their answers, in the form's order, with "Entered" ticks kept in the vault.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
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
    expect(s.copyPanel).toMatchObject({
      taxYear: 2026,
      formYear: 2025,
      provisional: true,
      couple: false,
    });
    expect(s.copyPanel.sections.map((x) => x.page)).toEqual(['PG1', 'A1']);
    expect(rowsOf(s).map((r) => [r.page, r.ref, r.copy, r.status, r.final])).toEqual([
      ['PG1', 'PG1-COMMUNE', '6630', 'stated', true],
      ['A1', '11.10-1', '84000', 'extracted', false],
      ['A1', '11.15', '1000', 'extracted', false],
      ['A1', 'CS-G', undefined, 'extracted', false],
      ['A1', '31.10', '5413', 'extracted', false],
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
      pending: 4,
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
    expect(s.copyPanel.sections.find((x) => x.page === 'A1')).toMatchObject({
      entered: 1,
      total: 4,
      pending: 0,
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
    expect(text(all)).toMatch(/Entered: 0 of 5; 4 not final yet/);
    expect(text(all)).toMatch(
      /- PG1 Déclaration fiscale 2025 \(Cover page: about you\): 0 of 1 entered\n/,
    );
    expect(text(all)).toMatch(
      /- A1 Activité dépendante 2025 \(Salaried work, taxpayer A\): 0 of 4 entered, 4 not final/,
    );
    expect(all.structuredContent).toMatchObject({
      provisional: true,
      entered: 0,
      total: 5,
      pending: 4,
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
    expect(text(none)).toMatch(/Sections with values: PG1, A1/);
    await client.close();
  });
});
