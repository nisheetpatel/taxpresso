import { NBSP } from '@taxpresso/questionnaire';
import { describe, expect, it } from 'vitest';
import { createApi, type DashboardState } from '../src/api.js';
import type { ApiRequest } from '../src/dashboard.js';
import { makeWorkspace } from './helpers.js';

const req = (
  method: 'GET' | 'POST',
  path: string,
  body: unknown = {},
  extra: Partial<ApiRequest> = {},
): ApiRequest => ({
  method,
  path,
  query: new URLSearchParams('lang=fr'),
  headers: {},
  body: Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body)),
  csrf: 'csrf-token',
  ...extra,
});

describe('dashboard API', () => {
  it('serves the state in the page language, with the CSRF token', async () => {
    const api = createApi(await makeWorkspace());
    const res = await api(req('GET', '/state'));
    const state = res.body as DashboardState;
    expect(state).toMatchObject({ lang: 'fr', csrf: 'csrf-token', progress: { answered: 0 } });
    // The canton first: the questions that follow are the canton's own.
    expect(state.question?.text).toBe(`Où habitiez-vous au 31 décembre 2026${NBSP}?`);
    expect(state.question?.link).toEqual({
      url: 'https://github.com/nisheetpatel/taxpresso/issues/1',
      label: 'Votez pour le prochain canton',
    });
    const geneva = (await api(req('POST', '/answer', { id: 'canton', value: 'GE' })))
      .body as DashboardState;
    expect(geneva.question?.text).toBe(`Quel était votre état civil au 31 décembre 2026${NBSP}?`);
    // The official page shown under "Page officielle" in the explanation, in the page language.
    expect(geneva.question?.learnMore).toEqual({
      url: 'https://www.ge.ch/document/41995/annexe/file/573038#page=53',
      label: `Guide fiscal 2025, p. 53${NBSP}: Changements de situation`,
    });
  });

  it('answers, skips and records who did it', async () => {
    const ws = await makeWorkspace();
    const api = createApi(ws);
    await api(req('POST', '/answer', { id: 'canton', value: 'GE' }));
    let state = (await api(req('POST', '/answer', { id: 'civil_status', value: 'married' })))
      .body as DashboardState;
    expect(state.chips).toEqual(['Genève', 'Marié(e)']);
    expect(state.people.map((p) => p.label)).toEqual(['Vous', 'Votre conjoint ou partenaire']);
    expect(ws.ledger.get('profile.civil_status')?.source.via).toBe('dashboard');
    state = (await api(req('POST', '/skip', { id: 'children' }))).body as DashboardState;
    expect(state.question?.id).toBe('commune');
    expect(state.activity[0]).toMatchObject({ by: 'you', what: 'skip' });
  });

  it('takes documents, lets the user say what they are, and updates what is missing', async () => {
    const ws = await makeWorkspace();
    const api = createApi(ws);
    await api(req('POST', '/answer', { id: 'canton', value: 'GE' }));
    await api(req('POST', '/answer', { id: 'civil_status', value: 'single' }));
    for (const [id, value] of [
      ['children', 0],
      ['commune', 'meyrin'],
      ['moved', 'no'],
      ['income_sources:p1', ['salary']],
      ['employers:p1', 1],
    ] as const) {
      await api(req('POST', '/answer', { id, value }));
    }
    const upload = req('POST', '/documents', Buffer.from('%PDF synthetic certificate'), {
      headers: { 'x-filename': encodeURIComponent('Certificat de salaire 2026.pdf') },
    });
    let state = (await api(upload)).body as DashboardState;
    const doc = state.documents[0]!;
    expect(doc.filename).toBe('Certificat de salaire 2026.pdf');
    const certificate = state.requirements.find((r) => r.id === 'salary_certificate:p1');
    expect(certificate?.status).toBe('missing');
    expect(certificate?.learnMore?.url).toMatch(/^https:\/\/www\.ge\.ch\//);
    state = (await api(req('POST', '/documents/kind', { id: doc.id, kind: 'salary_certificate' })))
      .body as DashboardState;
    expect(state.documents[0]?.kindLabel).toBe('Certificat de salaire');
    expect(state.requirements.find((r) => r.id === 'salary_certificate:p1')?.status).toBe(
      'satisfied',
    );
    // The same file again is a no-op.
    state = (await api(upload)).body as DashboardState;
    expect(state.documents).toHaveLength(1);
  });

  it('turns mistakes into clear 400s', async () => {
    const api = createApi(await makeWorkspace());
    expect(await api(req('POST', '/answer', { id: 'children', value: 99 }))).toMatchObject({
      status: 400,
    });
    expect(await api(req('POST', '/answer', Buffer.from('not json')))).toMatchObject({
      status: 400,
    });
    expect(await api(req('POST', '/waive', { id: 'salary_certificate:p1' }))).toMatchObject({
      status: 400,
    });
    expect(await api(req('POST', '/nope'))).toMatchObject({ status: 404 });
  });

  it('saves planning inputs and returns the 3a estimate', async () => {
    const ws = await makeWorkspace();
    const api = createApi(ws);
    await api(req('POST', '/answer', { id: 'canton', value: 'GE' }));
    await api(req('POST', '/answer', { id: 'civil_status', value: 'single' }));
    let state = (await api(req('POST', '/plan', { person: 'p1', field: 'gross', value: 95_000 })))
      .body as DashboardState;
    expect(state.plan!.inputs[0]).toMatchObject({
      gross: 9_500_000,
      hasPensionFund: true,
      paid: 0,
    });
    expect(state.plan!.result.saving?.totalCentimes).toBeGreaterThan(0);
    state = (await api(req('POST', '/plan', { person: 'p1', field: 'paid', value: 7_258 })))
      .body as DashboardState;
    expect(state.plan!.result.roomCentimes).toBe(0);
    expect(state.plan!.result.saving?.totalCentimes).toBe(0);
    expect(
      await api(req('POST', '/plan', { person: 'p2', field: 'gross', value: 1 })),
    ).toMatchObject({ status: 400 });
  });
});
