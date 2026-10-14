// The dashboard routes for document values, ticks, checks and the assessment (SPEC.md 5.5, 5.8,
// 10.5 second view, 10.8).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApi, type DashboardState } from '../src/api.js';
import type { ApiRequest } from '../src/dashboard.js';
import type { Workspace } from '../src/workspace.js';
import { makeWorkspace } from './helpers.js';

const FIXTURES = path.resolve(import.meta.dirname, '../../test/fixtures');

const req = (
  method: 'GET' | 'POST',
  route: string,
  body: unknown = {},
  query = 'lang=fr',
  headers: Record<string, string> = {},
): ApiRequest => ({
  method,
  path: route,
  query: new URLSearchParams(query),
  headers,
  body: Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body)),
  csrf: 'csrf-token',
});

async function setUp(): Promise<{ ws: Workspace; api: ReturnType<typeof createApi>; id: string }> {
  const ws = await makeWorkspace();
  const api = createApi(ws);
  await api(req('POST', '/answer', { id: 'canton', value: 'GE' }));
  await api(req('POST', '/answer', { id: 'civil_status', value: 'single' }));
  const upload = await api(
    req(
      'POST',
      '/documents',
      await readFile(path.join(FIXTURES, 'dupont-certificat-salaire-2026.pdf')),
      'lang=fr',
      { 'x-filename': encodeURIComponent('Certificat de salaire 2026.pdf') },
    ),
  );
  const id = (upload.body as DashboardState).documents[0]!.id;
  await ws.proposeExtraction(
    id,
    {
      kind: 'salary_certificate',
      taxYear: 2026,
      periodFrom: '2026-01-01',
      periodTo: '2026-12-31',
      issuer: 'Exemple Horlogerie SA',
    },
    [
      { key: 'salary.gross', value: "85'000.00", page: 1, box: '8' },
      { key: 'salary.net', value: "75'352.50", page: 1, box: '11' },
      { key: 'salary.free_transport', value: false, page: 1 },
    ],
  );
  return { ws, api, id };
}

const state = async (api: ReturnType<typeof createApi>, route: string, body: unknown) => {
  const res = await api(req('POST', route, body));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as DashboardState;
};

describe('document cards', () => {
  it('show each value with its official label, box, page, copy text and status', async () => {
    const { api, id } = await setUp();
    const s = (await api(req('GET', '/state'))).body as DashboardState;
    expect(s.toConfirm).toBe(3);
    expect(s.documents[0]).toMatchObject({ kind: 'salary_certificate', kindSource: 'claude' });
    const [card] = s.cards;
    expect(card).toMatchObject({
      docId: id,
      kindLabel: 'Certificat de salaire',
      issuer: 'Exemple Horlogerie SA',
      period: { from: '1er janvier 2026', to: '31 décembre 2026' },
      taxYear: 2026,
      toConfirm: 3,
      entered: 0,
      total: 3,
      enterable: true,
    });
    // In the order of the boxes on the form.
    expect(card!.values.map((v) => [v.key, v.box, v.copy ?? null, v.text ?? null])).toEqual([
      ['salary.gross', '8', '85000.00', null],
      ['salary.net', '11', '75352.50', null],
      ['salary.free_transport', 'F', null, 'Non'],
    ]);
    expect(card!.values[0]).toMatchObject({
      label: 'Salaire brut total',
      official: 'Salaire brut total / rente',
      page: 1,
      centimes: 8_500_000,
      status: 'extracted',
      entered: false,
    });
  });

  it('confirm in one tap, edit with money as text, and confirm the rest', async () => {
    const { api, ws, id } = await setUp();
    const gross = ws.ledger.get('salary.gross', 'p1', id)!;
    let s = await state(api, '/facts/confirm', { id: gross.id });
    expect(s.cards[0]!.values[0]).toMatchObject({ status: 'stated', via: 'dashboard' });
    expect(s.toConfirm).toBe(2);
    // A second tap (the page still holds the old id) changes nothing.
    const size = ws.ledger.size;
    expect((await api(req('POST', '/facts/confirm', { id: gross.id }))).status).toBe(200);
    expect(ws.ledger.size).toBe(size);

    const net = ws.ledger.get('salary.net', 'p1', id)!;
    s = await state(api, '/facts/edit', { id: net.id, value: "75'300.00" });
    expect(s.cards[0]!.values[1]).toMatchObject({ centimes: 7_530_000, status: 'stated' });
    const bad = await api(
      req('POST', '/facts/edit', {
        id: ws.ledger.get('salary.net', 'p1', id)!.id,
        value: '75,300',
      }),
    );
    expect(bad).toMatchObject({ status: 400 });
    expect((bad.body as { error: string }).error).toMatch(/ambiguous/);

    s = await state(api, '/documents/confirm', { id });
    expect(s.toConfirm).toBe(0);
    expect(s.documents[0]!.kindSource).toBe('user');
    // An id that was never a value read from a document is refused.
    expect((await api(req('POST', '/facts/confirm', { id: 'f_0000000000000000' }))).status).toBe(
      400,
    );
    const profile = ws.ledger.get('profile.civil_status')!;
    expect(
      (await api(req('POST', '/facts/edit', { id: profile.id, value: 'married' }))).status,
    ).toBe(400);
  });

  it('keep "Entered" ticks in the vault, not the ledger, and untick when the value changes', async () => {
    const { api, ws, id } = await setUp();
    const gross = ws.ledger.get('salary.gross', 'p1', id)!;
    const facts = ws.ledger.size;
    let s = await state(api, '/facts/entered', { id: gross.id, entered: true });
    expect(s.cards[0]).toMatchObject({ entered: 1, total: 3 });
    expect(ws.ledger.size).toBe(facts);
    const file = JSON.parse(await readFile(path.join(ws.vault.dir, 'entered.json'), 'utf8')) as {
      entered: Record<string, string>;
    };
    expect(file.entered).toEqual({ [`${id}|salary.gross|p1`]: '85000.00' });
    // Confirming keeps the tick (same value); a new value unticks.
    s = await state(api, '/facts/confirm', { id: gross.id });
    expect(s.cards[0]!.values[0]!.entered).toBe(true);
    s = await state(api, '/facts/edit', {
      id: ws.ledger.get('salary.gross', 'p1', id)!.id,
      value: '85100',
    });
    expect(s.cards[0]).toMatchObject({ entered: 0 });
    s = await state(api, '/facts/entered', {
      id: ws.ledger.get('salary.gross', 'p1', id)!.id,
      entered: false,
    });
    expect(s.cards[0]!.entered).toBe(0);
  });
});

describe('checks and replacing documents', () => {
  it('lists "Check this" items, settles one with a note, and replaces a document', async () => {
    const { api, ws, id } = await setUp();
    await ws.proposeExtraction(id, { taxYear: 2025 }, []);
    let s = (await api(req('GET', '/state'))).body as DashboardState;
    expect(s.checks).toEqual([
      expect.objectContaining({
        id: `other_year:${id}`,
        rule: 'other_year',
        title: 'Un document d’une autre année',
        documents: [{ id, filename: 'Certificat de salaire 2026.pdf' }],
      }),
    ]);
    s = await state(api, '/checks/resolve', {
      id: `other_year:${id}`,
      note: 'Gardé pour comparer.',
    });
    expect(s.checks[0]!.resolved?.note).toBe('Gardé pour comparer.');
    expect(
      (await api(req('POST', '/checks/resolve', { id: 'other_year:d_nope', note: 'x' }))).status,
    ).toBe(400);

    // Replace it with a new file: the old one stops counting, its values go.
    const upload = await api(
      req(
        'POST',
        '/documents',
        Buffer.from('%PDF-1.7 synthetic 2026 certificate'),
        `lang=fr&replace=${id}`,
        {
          'x-filename': encodeURIComponent('Certificat 2026 bis.pdf'),
        },
      ),
    );
    s = upload.body as DashboardState;
    expect(s.documents.map((d) => d.filename)).toEqual(['Certificat 2026 bis.pdf']);
    expect(s.documents[0]!.kind).toBe('salary_certificate');
    expect(s.replaced).toEqual([
      { id, filename: 'Certificat de salaire 2026.pdf', by: s.documents[0]!.id },
    ]);
    expect(s.checks).toEqual([]);
    expect(s.cards).toEqual([]);
    expect(s.toConfirm).toBe(0);
  });

  it('counts a duplicate once', async () => {
    const { api, ws } = await setUp();
    const a = await ws.addDocument(Buffer.from('%PDF-1.7 3a one'), '3a.pdf', 'dashboard');
    const b = await ws.addDocument(Buffer.from('%PDF-1.7 3a two'), '3a (1).pdf', 'dashboard');
    for (const d of [a, b]) {
      await ws.proposeExtraction(
        d.document.id,
        { kind: 'pillar3a_attestation', taxYear: 2026, issuer: 'Banque Exemple' },
        [],
      );
    }
    let s = (await api(req('GET', '/state'))).body as DashboardState;
    expect(s.checks.map((c) => c.rule)).toEqual(['duplicate']);
    s = await state(api, '/documents/replace', { id: b.document.id, by: a.document.id });
    expect(s.checks).toEqual([]);
    expect(
      (await api(req('POST', '/documents/replace', { id: a.document.id, by: a.document.id })))
        .status,
    ).toBe(400);
  });
});

describe('the assessment card', () => {
  it('compares assessed and declared, and shows the deadline with its law', async () => {
    const { api, ws, id } = await setUp();
    await ws.confirmDocument(id, 'dashboard');
    const { document } = await ws.addDocument(
      Buffer.from('%PDF-1.7 synthetic assessment'),
      'Avis.pdf',
      'dashboard',
    );
    await ws.proposeExtraction(document.id, { kind: 'tax_assessment', taxYear: 2026 }, [
      { key: 'assessment.tax', value: 'ifd', page: 1 },
      { key: 'assessment.notification_date', value: '2027-05-14', page: 1 },
      { key: 'assessment.salary_gross', value: "86'000.00", page: 2 },
      { key: 'assessment.taxable_income', value: "70'000.00", page: 1 },
    ]);
    const s = (await api(req('GET', '/state'))).body as DashboardState;
    const [a] = s.assessments;
    expect(a).toMatchObject({
      filename: 'Avis.pdf',
      taxes: ['Impôt fédéral direct (IFD)'],
      notificationDate: '14 mai 2027',
      unconfirmed: 4,
    });
    expect(a!.deadlines).toEqual([
      {
        tax: 'Impôt fédéral direct (IFD)',
        date: '14 juin 2027',
        iso: '2027-06-14',
        movedFromWeekend: true,
        law: 'LIFD (RS 642.11)',
        sources: ['ch-na-law-lifd art. 132 al. 1 (p. 71)', 'ch-na-law-lifd art. 133 al. 1 (p. 71)'],
      },
    ]);
    expect(a!.items).toEqual([
      expect.objectContaining({
        key: 'assessment.salary_gross',
        label: 'Salaire brut total',
        official: 'Salaires bruts',
        assessed: 8_600_000,
        declared: 8_500_000,
        difference: 100_000,
      }),
    ]);
    expect(a!.totals).toEqual([
      expect.objectContaining({ key: 'assessment.taxable_income', assessed: 7_000_000 }),
    ]);
    expect(a!.text.never).toMatch(/Taxpresso ne l’envoie jamais/);
    // The assessment's own values are checked, not typed: no copy, no "Entered".
    expect(s.cards.find((c) => c.docId === document.id)).toMatchObject({
      enterable: false,
      total: 0,
    });
  });
});
