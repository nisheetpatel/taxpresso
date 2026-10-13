import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Dashboard, type ApiRequest } from '../src/dashboard.js';
import { makeUiDir, request } from './helpers.js';

let uiDir: string;

/** Echoes what the API layer receives. */
const echo = (req: ApiRequest) =>
  Promise.resolve({
    status: 200,
    body: { ok: true, method: req.method, path: req.path, bytes: req.body.length, csrf: req.csrf },
  });
let dashboard: Dashboard | undefined;

beforeAll(async () => {
  uiDir = await makeUiDir();
});

afterEach(async () => {
  await dashboard?.stop();
  dashboard = undefined;
});

async function open() {
  dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: echo });
  const url = await dashboard.start();
  const page = await request(url);
  const cookie = (page.headers['set-cookie']?.[0] ?? '').split(';')[0] ?? '';
  return { url, origin: new URL(url).origin, page, cookie };
}

describe('Dashboard', () => {
  it('binds 127.0.0.1 on a random port and returns the same link when asked again', async () => {
    const { url } = await open();
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/\?t=[\w-]{43}$/);
    expect(await dashboard!.start()).toBe(url);
    expect(dashboard!.running).toBe(true);
    await dashboard!.stop();
    expect(dashboard!.running).toBe(false);
  });

  it('serves the page to the token holder with strict headers and a session cookie', async () => {
    const { page, cookie } = await open();
    expect(page.status).toBe(200);
    expect(page.headers['content-security-policy']).toContain("default-src 'none'");
    expect(page.headers['referrer-policy']).toBe('no-referrer');
    expect(page.headers['access-control-allow-origin']).toBeUndefined();
    expect(page.headers['set-cookie']?.[0]).toMatch(/HttpOnly; SameSite=Strict; Path=\//);
    expect(cookie).toMatch(/^taxpresso_\d+=/);
  });

  it('refuses requests without the token', async () => {
    const { origin, cookie } = await open();
    expect((await request(`${origin}/`)).status).toBe(401);
    expect((await request(`${origin}/?t=wrong`)).status).toBe(401);
    expect(
      (await request(`${origin}/api/state`, { headers: { 'X-Taxpresso-Token': 'x' } })).status,
    ).toBe(401);
    const api = JSON.parse(
      (await request(`${origin}/api/state`, { headers: { Cookie: cookie } })).body,
    ) as Record<string, unknown>;
    expect(api).toMatchObject({ ok: true, method: 'GET', path: '/state' });
  });

  it('answers only to its loopback host names (DNS rebinding)', async () => {
    const { url } = await open();
    const port = new URL(url).port;
    expect((await request(url, { headers: { Host: 'evil.example' } })).status).toBe(421);
    expect((await request(url, { headers: { Host: `evil.example:${port}` } })).status).toBe(421);
    expect((await request(url, { headers: { Host: `localhost:${port}` } })).status).toBe(200);
  });

  it('serves only built files: no traversal, no listing, no unknown types, GET only', async () => {
    const { url, origin, cookie } = await open();
    const get = (p: string) => request(origin, { path: p, headers: { Cookie: cookie } });
    expect((await get('/assets/app.js')).status).toBe(200);
    expect((await get('/assets/')).status).toBe(404);
    expect((await get('/../views/open-dashboard.html')).status).toBe(404);
    expect((await get('/%2e%2e/views/open-dashboard.html')).status).toBe(404);
    expect((await get('/notes.unknown')).status).toBe(404);
    expect((await request(url, { method: 'POST' })).status).toBe(405);
    expect(
      (await request(url, { method: 'PUT', path: '/api/state', headers: { Cookie: cookie } }))
        .status,
    ).toBe(405);
  });

  it('fails clearly when the UI is not built', async () => {
    dashboard = new Dashboard({ dir: path.join(uiDir, 'nowhere'), api: echo });
    await expect(dashboard.start()).rejects.toThrow(/dashboard files are missing/);
    expect(dashboard.running).toBe(false);
  });

  it('accepts changes only from its own page, with the CSRF token', async () => {
    const { origin, cookie } = await open();
    const csrf = (
      JSON.parse((await request(`${origin}/api/state`, { headers: { Cookie: cookie } })).body) as {
        csrf: string;
      }
    ).csrf;
    const post = (headers: Record<string, string>, path = '/api/answer', body = '{}') =>
      request(origin, { method: 'POST', path, body, headers: { Cookie: cookie, ...headers } });
    expect((await post({})).status).toBe(403);
    expect((await post({ 'X-Taxpresso-CSRF': 'nope' })).status).toBe(403);
    expect((await post({ 'X-Taxpresso-CSRF': csrf, Origin: 'https://evil.example' })).status).toBe(
      403,
    );
    expect((await post({ 'X-Taxpresso-CSRF': csrf, Origin: origin })).status).toBe(200);
    expect(
      (
        await request(origin, {
          method: 'POST',
          path: '/api/answer',
          body: '{}',
          headers: { 'X-Taxpresso-CSRF': csrf },
        })
      ).status,
    ).toBe(401);
  });

  it('limits request bodies: 64 KB for changes, 40 MB for documents', async () => {
    const { origin, cookie } = await open();
    const csrf = (
      JSON.parse((await request(`${origin}/api/state`, { headers: { Cookie: cookie } })).body) as {
        csrf: string;
      }
    ).csrf;
    const headers = { Cookie: cookie, 'X-Taxpresso-CSRF': csrf };
    const big = Buffer.alloc(100 * 1024, 1);
    expect(
      (await request(origin, { method: 'POST', path: '/api/answer', body: big, headers })).status,
    ).toBe(413);
    const ok = await request(origin, {
      method: 'POST',
      path: '/api/documents',
      body: big,
      headers,
    });
    expect(JSON.parse(ok.body)).toMatchObject({ bytes: big.length });
  });
});
