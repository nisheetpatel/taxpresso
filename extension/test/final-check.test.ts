// "Final check" before filling in the official form (SPEC.md 10.0), end to end: the same result
// for Claude (final_check) and in the dashboard, read-only, from the rules engine re-run on the
// current ledger. Synthetic Dupont data on a temporary vault, never the real one.
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import type { DocumentKind } from '@taxpresso/ledger';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FinalCheckState } from '../../ui/src/dashboard/types-final-check.js';
import { createApi, type DashboardState } from '../src/api.js';
import { type ApiRequest, Dashboard } from '../src/dashboard.js';
import { createTaxpressoServer } from '../src/server.js';
import type { Workspace } from '../src/workspace.js';
import { makeUiDir, makeWorkspace } from './helpers.js';

const FIXTURES = path.resolve(import.meta.dirname, '../../test/fixtures');

let client: Client;
let dashboard: Dashboard;
let ws: Workspace;

type Result = Awaited<ReturnType<Client['callTool']>>;
const texts = (res: Result) =>
  (res.content as { type: string; text?: string }[]).map((c) => c.text ?? '').join('\n');
const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args });
const req = (lang = 'en'): ApiRequest => ({
  method: 'GET',
  path: '/state',
  query: new URLSearchParams(`lang=${lang}`),
  headers: {},
  body: Buffer.from('{}'),
  csrf: 'csrf-token',
});
/** The card's part of the state, as the page types it (checked by tsc). */
const card = async (lang = 'en'): Promise<FinalCheckState> => {
  const res = await createApi(ws)(req(lang));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return (res.body as DashboardState).finalCheck;
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
});

afterEach(async () => {
  await client.close();
  await dashboard.stop();
});

let n = 0;
/** A document of the user's with the values they confirmed (synthetic bytes). */
async function confirmed(
  kind: DocumentKind,
  person: 'p1' | 'p2' | 'household',
  values: [string, string][],
  {
    confirm = true,
    taxYear = 2026,
    issuer,
  }: { confirm?: boolean; taxYear?: number; issuer?: string } = {},
) {
  n += 1;
  const { document } = await ws.addDocument(
    Buffer.from(`%PDF-1.7 synthetic document ${n}`),
    `${kind}-${n}.pdf`,
    'dashboard',
  );
  await ws.proposeExtraction(
    document.id,
    { kind, taxYear, person, ...(issuer ? { issuer } : {}) },
    values.map(([key, value]) => ({ key, value, page: 1 })),
  );
  if (confirm) await ws.confirmDocument(document.id, 'dashboard');
  return document;
}

/** The Duponts of Vernier: two salaries, pillar 3a for both, Jean's attestation not confirmed. */
async function dupont() {
  await ws.answer('civil_status', 'married', 'chat');
  await ws.answer('children', 1, 'chat');
  await ws.answer('commune', 'Vernier', 'chat');
  await confirmed('salary_certificate', 'p1', [
    ['salary.base', "98'000.00"],
    ['salary.gross', "98'000.00"],
    ['salary.social_contributions', "5'880.00"],
    ['salary.lpp_ordinary', "4'900.00"],
  ]);
  await confirmed('salary_certificate', 'p2', [
    ['salary.base', "52'000.00"],
    ['salary.gross', "52'000.00"],
    ['salary.social_contributions', "3'120.00"],
    ['salary.lpp_ordinary', "2'600.00"],
  ]);
  await confirmed('pillar3a_attestation', 'p1', [['pillar3a.paid', "7'258.00"]], {
    confirm: false,
  });
  await confirmed('pillar3a_attestation', 'p2', [['pillar3a.paid', "7'258.00"]]);
}

describe('final check', () => {
  it('says what blocks on an empty folder, and changes nothing', async () => {
    const res = await call('final_check');
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toMatchObject({ taxYear: 2026, verdict: 'not_ready' });
    const ids = (res.structuredContent as FinalCheckState).fix.map((i) => i.id);
    expect(ids.slice(0, 2)).toEqual(['cannot_compute', 'questions_open']);
    expect(texts(res)).toMatch(/NOT READY/);
    expect(texts(res)).toMatch(/1\. \[Missing\] Taxpresso can’t compute your tax yet: It needs/);
    // Looking never creates the folder (read-only).
    expect(ws.vault.exists()).toBe(false);
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === 'final_check')?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    });
  });

  it('lists the value to confirm, Geneva’s estimates, an open check and the limits, in both places', async () => {
    await dupont();
    // A health insurance attestation for last year: a "Check this" item.
    await confirmed('health_premiums', 'household', [['health.premiums', "6'000.00"]], {
      taxYear: 2025,
    });
    const before = await readFile(path.join(ws.config.vaultPath, '2026', 'ledger.json'), 'utf8');

    const res = await call('final_check');
    const out = res.structuredContent as FinalCheckState;
    expect(out.verdict).toBe('not_ready');
    const kinds = out.fix.map((i) => i.kind);
    // By kind, in this order; questions still open come first.
    expect(kinds.indexOf('needs_ok')).toBeLessThan(kinds.indexOf('estimate_rule'));
    expect(kinds.indexOf('estimate_rule')).toBeLessThan(kinds.indexOf('check'));
    const ok = out.fix.find((i) => i.kind === 'needs_ok')!;
    expect(ok).toMatchObject({ status: 'needs_ok', code: '31.40' });
    expect(ok.title).toBe('31.40 Paid into pillar 3a, you');
    expect(ok.detail).toMatch(
      /^CHF 7’258\.00, read from “pillar3a_attestation-\d+\.pdf”, page 1: still Needs your OK\.$/,
    );
    expect(out.fix.find((i) => i.kind === 'check')?.title).toBe('A document for another year');
    expect(out.fix.find((i) => i.kind === 'estimate_rule')?.todo).toMatch(/January 2027/);
    // B's 3a is exactly at the federal limit (A's still needs the user's OK, but it is counted).
    const limit = out.know.find((i) => i.kind === 'limit' && i.code === '41.40')!;
    expect(limit.detail).toBe(
      'Paid into pillar 3a: CHF 7’258.00, exactly the limit: all of it is deducted.',
    );
    expect(limit.sources).toEqual([
      {
        id: 'ch-2026-ifd-instructions-personnes-physiques',
        where: 'p. 7 (chiffre 13)',
        title: '2a - Instruction concernant la déclaration des personnes physiques (Formulaire 2)',
        url: 'https://www.estv.admin.ch/dam/fr/sd-web/oQ0wWcDmCJTS/2a-2026-fr.pdf#page=7',
      },
    ]);
    // For Claude: every blocking item, with what settles it, and the official links.
    const text = texts(res);
    expect(text).toMatch(/\d+\. \[Needs your OK\] 31\.40 Paid into pillar 3a, you: CHF 7’258\.00/);
    expect(text).toMatch(/To settle: Your OK: tap it in the dashboard/);
    expect(text).toMatch(
      /- 41\.40 Pillar 3a \(Cotisations au 3ème pilier A\), your spouse or partner, ICC and IFD: .* \[ch-2026-ifd-instructions-personnes-physiques p\. 7 \(chiffre 13\): https:\/\/www\.estv\.admin\.ch\/.+#page=7\]/,
    );
    expect(text).toMatch(/The passages of the official documents are not bundled yet/);
    expect(texts(await call('final_check', { detail: true }))).toMatch(
      /\(2a - Instruction concernant la déclaration des personnes physiques \(Formulaire 2\)\)/,
    );

    // The dashboard shows the same check, in its language.
    const en = await card();
    expect(en.fix.map((i) => i.id)).toEqual(out.fix.map((i) => i.id));
    expect(en.know.map((i) => i.id)).toEqual(out.know.map((i) => i.id));
    const fr = await card('fr');
    expect(fr.fix.find((i) => i.kind === 'needs_ok')?.detail).toMatch(/encore À confirmer\.$/);
    expect(fr.know.find((i) => i.code === '41.40')?.detail).toBe(
      'Versé au 3e pilier A\u00a0: CHF 7’258.00, exactement la limite\u00a0: tout est déduit.',
    );

    // Read-only: nothing was written.
    expect(await readFile(path.join(ws.config.vaultPath, '2026', 'ledger.json'), 'utf8')).toBe(
      before,
    );
  });

  it('lists a rough salary as an estimate until the salary certificate comes', async () => {
    await ws.answer('civil_status', 'single', 'chat');
    await ws.answer('children', 0, 'chat');
    await ws.answer('commune', 'Meyrin', 'chat');
    await ws.setPlan('p1', 'plan.gross_salary', 85_000, 'chat');
    const out = await card();
    const salary = out.fix.find((i) => i.kind === 'estimate')!;
    expect(salary).toMatchObject({ status: 'estimate', code: '11.10' });
    expect(salary.detail).toBe('CHF 85’000.00: an estimate, not final yet.');
    expect(salary.todo).toMatch(/^Your salary certificate \(certificat de salaire\)/);
    expect(out.moreTime).toMatch(/^https:\/\/www\.ge\.ch\//);
    // A planning figure the return doesn't use is not listed.
    await ws.setPlan('p1', 'plan.pillar3a_paid', 3_000, 'chat');
    expect((await card()).fix.filter((i) => i.kind === 'estimate')).toHaveLength(1);
  });

  it('blocks on the declaration PDF that differs from the values to type', async () => {
    await dupont();
    await ws.addDocument(
      readFileSync(path.join(FIXTURES, 'dupont-declaration-2026.pdf')),
      'declaration-2026.pdf',
      'dashboard',
    );
    const out = await card();
    expect(out.fix.find((i) => i.kind === 'official_pdf')).toMatchObject({
      status: 'fix',
      detail: '“declaration-2026.pdf” differs from the values to type on 4 lines.',
    });
  });
});
