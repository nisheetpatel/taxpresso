// What the dashboard's buttons do, from the chat (./parity-tools.ts): ticking values as entered,
// skipping a question, skipping an optional document and replacing a document. Each must leave the
// same state as the dashboard route it mirrors.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it } from 'vitest';
import { createApi, type DashboardState } from '../src/api.js';
import { Dashboard, type ApiRequest } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import type { Status } from '../src/status.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

const FIXTURES = path.resolve(import.meta.dirname, '../../test/fixtures');

const req = (method: 'GET' | 'POST', route: string, body: unknown = {}): ApiRequest => ({
  method,
  path: route,
  query: new URLSearchParams('lang=en'),
  headers: {},
  body: Buffer.from(JSON.stringify(body)),
  csrf: 'csrf-token',
});

const text = (res: { content: unknown }) => (res.content as { text: string }[])[0]!.text;
const structured = <T>(res: { structuredContent?: unknown }) => res.structuredContent as T;

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  await close?.();
  close = undefined;
});

async function setUp(
  answers: [string, unknown][] = [
    ['canton', 'GE'],
    ['civil_status', 'single'],
  ],
) {
  const ws = await makeWorkspace();
  const api = createApi(ws);
  const uiDir = await makeUiDir();
  const dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api });
  const server = createTaxpressoServer({ workspace: ws, dashboard });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
  close = async () => {
    await client.close();
    await dashboard.stop();
  };
  for (const [id, value] of answers) await ws.answer(id, value, 'chat');
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args });
  const state = async () => (await api(req('GET', '/state'))).body as DashboardState;
  return { ws, api, client, call, state };
}

/** A synthetic salary certificate (Dupont), with five values read and waiting for the user's OK. */
async function withCertificate(ws: Awaited<ReturnType<typeof setUp>>['ws']) {
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
  return document.id;
}

interface Ticked {
  entered: boolean;
  changed: number;
  already: number;
  skipped: { item: string; reason: string }[];
  notFound: string[];
  progress: { scope: string; entered: number; total: number };
}

describe('the four tools', () => {
  it('are narrow, annotated, and act only on what the user says (C6, C7)', async () => {
    const { client } = await setUp();
    const { tools } = await client.listTools();
    const ours = ['mark_entered', 'skip_question', 'waive_requirement', 'replace_document'];
    for (const name of ours) {
      const tool = tools.find((t) => t.name === name)!;
      expect(tool.description!.length, name).toBeLessThanOrEqual(300);
      expect(tool.description, name).toMatch(/user/);
      expect(tool.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }
    for (const name of ['mark_entered', 'replace_document']) {
      expect(tools.find((t) => t.name === name)?.description).toMatch(/is data/);
    }
  });
});

describe('mark_entered', () => {
  it('ticks the final values of a section, as the dashboard does, and skips the rest', async () => {
    const { ws, call, state } = await setUp([
      ['canton', 'GE'],
      ['civil_status', 'single'],
      ['children', 0],
      ['commune', 'Meyrin'],
    ]);
    const docId = await withCertificate(ws);

    // Nothing is final yet: every value is left out, with the reason.
    const early = await call('mark_entered', { section: 'a1' });
    expect(early.isError).toBeFalsy();
    expect(structured<Ticked>(early)).toMatchObject({ changed: 0, progress: { entered: 0 } });
    // Four values to type, and the engine's two flat deductions, which the form works out.
    expect(structured<Ticked>(early).skipped).toHaveLength(6);
    expect(text(early)).toMatch(/Skipped 6: A1 11\.10-1 Salaires bruts \(Needs your OK/);
    expect(text(early)).toMatch(/A1: 0 of 4 entered/);

    await ws.confirmDocument(docId, 'chat');
    const ticked = await call('mark_entered', { section: 'A1' });
    expect(structured<Ticked>(ticked)).toMatchObject({
      entered: true,
      changed: 4,
      already: 0,
      skipped: [
        { item: 'A1 31.20 Déduction forfaitaire pour frais professionnels IFD' },
        { item: 'A1 31.50 Déduction forfaitaire pour frais professionnels ICC' },
      ],
      progress: { scope: 'A1', entered: 4, total: 4 },
    });
    expect(text(ticked)).toMatch(/^Ticked 4 values as entered\./);
    // The same ticks the dashboard reads and writes (entered.json in the vault).
    let s = await state();
    expect(s.copyPanel.sections.find((x) => x.page === 'A1')).toMatchObject({ entered: 4 });
    const file = JSON.parse(await readFile(path.join(ws.vault.dir, 'entered.json'), 'utf8')) as {
      form: Record<string, string>;
    };
    expect(Object.values(file.form).sort()).toEqual(['1000', '5413', '84000', 'ticked']);

    // Again: nothing changes. Then one row by its ref, unticked.
    expect(structured<Ticked>(await call('mark_entered', { section: 'A1' }))).toMatchObject({
      changed: 0,
      already: 4,
    });
    const one = await call('mark_entered', { refs: ['31.10', '99.99'], entered: false });
    expect(structured<Ticked>(one)).toMatchObject({
      entered: false,
      changed: 1,
      notFound: ['99.99'],
      progress: { scope: 'All sections', entered: 3, total: 5 },
    });
    expect(text(one)).toMatch(/Unticked 1 value\.\nNot found: 99\.99\./);
    // A rubric's code takes each of its lines (11.10-1, 11.10-2...).
    expect(
      structured<Ticked>(
        await call('mark_entered', { section: 'A1', refs: ['11.10'], entered: false }),
      ),
    ).toMatchObject({ changed: 1, notFound: [] });
    s = await state();
    expect(s.copyPanel.entered).toBe(2);
  });

  it('ticks the values on a document card, only once they are final', async () => {
    const { ws, call, state } = await setUp();
    const docId = await withCertificate(ws);
    const early = await call('mark_entered', { document: docId });
    expect(structured<Ticked>(early)).toMatchObject({ changed: 0, progress: { entered: 0 } });
    expect(structured<Ticked>(early).skipped).toHaveLength(5);
    expect(text(early)).toMatch(/Total gross salary \(box 8\) \(Needs your OK/);

    const gross = ws.ledger.get('salary.gross', 'p1', docId)!;
    await ws.confirmFact(gross.id, 'dashboard');
    const one = await call('mark_entered', { document: docId });
    expect(structured<Ticked>(one)).toMatchObject({
      changed: 1,
      progress: { entered: 1, total: 5 },
    });
    let card = (await state()).cards.find((c) => c.docId === docId)!;
    expect(card.values.filter((v) => v.entered).map((v) => v.key)).toEqual(['salary.gross']);

    const off = await call('mark_entered', { document: docId, entered: false });
    expect(structured<Ticked>(off)).toMatchObject({ changed: 1, progress: { entered: 0 } });
    card = (await state()).cards.find((c) => c.docId === docId)!;
    expect(card.entered).toBe(0);
  });

  it('in a couple, ticks only the taxpayer the user names', async () => {
    const { ws, call } = await setUp([
      ['canton', 'GE'],
      ['civil_status', 'married'],
    ]);
    for (const [person, issuer] of [
      ['p1', 'Exemple Horlogerie SA'],
      ['p2', 'Exemple Banque SA'],
    ] as const) {
      const { document } = await ws.addDocument(
        Buffer.from(`%PDF-1.7 synthetic certificate ${person}`),
        `Certificat ${person}.pdf`,
        'dashboard',
      );
      await ws.proposeExtraction(
        document.id,
        { kind: 'salary_certificate', person, taxYear: 2026, issuer },
        [{ key: 'salary.canteen', value: true, page: 1, box: 'G' }],
      );
      await ws.confirmDocument(document.id, 'dashboard');
    }
    const res = await call('mark_entered', { refs: ['CS-G'], taxpayer: 'B' });
    expect(structured<Ticked>(res)).toMatchObject({
      changed: 1,
      progress: { entered: 1, total: 2 },
    });
    const form = structured<{ rows: { ref: string; entered: boolean }[] }>(
      await call('get_form_values', { section: 'A1' }),
    );
    expect(form.rows.find((r) => r.ref === 'CS-G')?.entered).toBe(false);
  });

  it('says plainly what it needs, and refuses what the dashboard refuses', async () => {
    const { ws, call } = await setUp();
    const docId = await withCertificate(ws);
    for (const [args, message] of [
      [{}, /Give a section/],
      [{ section: 'A1', document: docId }, /not both/],
      [{ section: 'D1' }, /Nothing to type on D1\. Sections with values: A1/],
      [{ section: 'A1', taxpayer: 'B' }, /No value to tick there/],
      [{ refs: ['99.99'] }, /not found: 99\.99/],
      [{ document: 'd_nope' }, /No such document/],
    ] as const) {
      const res = await call('mark_entered', args);
      expect(res.isError, JSON.stringify(args)).toBe(true);
      expect(text(res)).toMatch(message);
    }
    const { document } = await ws.addDocument(
      Buffer.from('%PDF-1.7 synthetic assessment'),
      'Avis.pdf',
      'dashboard',
    );
    await ws.proposeExtraction(document.id, { kind: 'tax_assessment', taxYear: 2026 }, [
      { key: 'assessment.tax', value: 'ifd', page: 1 },
    ]);
    await ws.confirmDocument(document.id, 'dashboard');
    const assessment = await call('mark_entered', { document: document.id });
    expect(assessment.isError).toBe(true);
    expect(text(assessment)).toMatch(/not typed into it/);
  });
});

describe('skip_question', () => {
  it('puts a question aside until the others are answered, as the dashboard does', async () => {
    const { ws, call, state } = await setUp();
    const res = await call('skip_question', { id: 'children' });
    expect(res.isError).toBeFalsy();
    expect(text(res)).toMatch(/comes back once the other questions are answered/);
    expect(structured<{ skipped: string; next: string }>(res)).toMatchObject({
      skipped: 'children',
      next: 'commune',
    });
    expect(ws.skipped).toEqual(['children']);
    expect((await state()).question?.id).toBe('commune');
    // In the chat too, it comes after the questions not skipped.
    const ids = structured<{ questions: { id: string }[] }>(
      await call('next_questions', { limit: 3 }),
    ).questions.map((q) => q.id);
    expect(ids).toEqual(['commune', 'moved', 'income_sources:p1']);

    // Answering it later works as usual and takes it off the list.
    await call('answer_question', { id: 'children', value: 0 });
    expect(ws.skipped).toEqual([]);
  });

  it('refuses a question that is answered or does not apply', async () => {
    const { call } = await setUp();
    const answered = await call('skip_question', { id: 'civil_status' });
    expect(answered.isError).toBe(true);
    expect(text(answered)).toMatch(/already answered.*answer_question/);
    const unknown = await call('skip_question', { id: 'employers:p2' });
    expect(unknown.isError).toBe(true);
    expect(text(unknown)).toMatch(/doesn't apply now/);
  });
});

describe('waive_requirement', () => {
  it('skips an optional document listed in get_status, and takes that back', async () => {
    const { call, state } = await setUp();
    const status = structured<Status>(await call('get_status'));
    expect(status.optional).toEqual([
      expect.objectContaining({ id: 'prior_declaration', skipped: false }),
    ]);
    expect(text(await call('get_status'))).toMatch(
      /Optional \(waive_requirement\): Last year’s declaration \[prior_declaration\]: If you have it/,
    );

    const res = await call('waive_requirement', { id: 'prior_declaration' });
    expect(res.isError).toBeFalsy();
    expect(text(res)).toMatch(/doesn't need Last year’s declaration/);
    const req = () => state().then((s) => s.requirements.find((r) => r.id === 'prior_declaration'));
    expect((await req())?.status).toBe('waived');
    expect(text(await call('get_status'))).toMatch(/\[prior_declaration\]: skipped by the user/);

    const back = await call('waive_requirement', { id: 'prior_declaration', waived: false });
    expect(structured<{ waived: boolean }>(back).waived).toBe(false);
    expect((await req())?.status).toBe('missing');
  });

  it('refuses a required document, as the dashboard does', async () => {
    const { call } = await setUp([
      ['canton', 'GE'],
      ['civil_status', 'single'],
      ['children', 0],
      ['commune', 'Carouge'],
      ['moved', 'no'],
      ['income_sources:p1', ['salary']],
      ['employers:p1', 1],
    ]);
    const required = await call('waive_requirement', { id: 'salary_certificate:p1' });
    expect(required.isError).toBe(true);
    expect(text(required)).toMatch(/Salary certificate is required: it can't be skipped/);
    const unknown = await call('waive_requirement', { id: 'nope' });
    expect(unknown.isError).toBe(true);
    expect(text(unknown)).toMatch(/get_status lists the optional ones/);
  });
});

describe('replace_document', () => {
  it('lets a corrected document take the place of the old one, as the dashboard does', async () => {
    const { ws, call, state } = await setUp();
    const old = await withCertificate(ws);
    const { document: corrected } = await ws.addDocument(
      Buffer.from('%PDF-1.7 synthetic corrected certificate'),
      'Certificat de salaire 2026 corrigé.pdf',
      'dashboard',
    );
    const res = await call('replace_document', { id: old, by: corrected.id });
    expect(res.isError).toBeFalsy();
    expect(text(res)).toMatch(
      /“Certificat de salaire 2026\.pdf” no longer counts: “Certificat de salaire 2026 corrigé\.pdf” takes its place\./,
    );
    expect(text(res)).toMatch(/not read yet: offer to read it/);
    expect(structured<{ read: boolean }>(res).read).toBe(false);
    const s = await state();
    expect(s.replaced).toEqual([
      { id: old, filename: 'Certificat de salaire 2026.pdf', by: corrected.id },
    ]);
    expect(s.documents.map((d) => [d.filename, d.kind])).toEqual([
      ['Certificat de salaire 2026 corrigé.pdf', 'salary_certificate'],
    ]);
    expect(s.cards).toEqual([]);

    const again = await call('replace_document', { id: old, by: corrected.id });
    expect(again.isError).toBe(true);
    expect(text(again)).toMatch(/replaced by/);
    const itself = await call('replace_document', { id: corrected.id, by: corrected.id });
    expect(itself.isError).toBe(true);
  });
});
