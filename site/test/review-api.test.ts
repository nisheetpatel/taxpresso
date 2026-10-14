// The website's review form (api/review.mjs): what it accepts, what it saves, where it sends the
// visitor back. The database is never called here: a fake fetch stands in for Upstash's REST API.
import { describe, expect, it, vi } from 'vitest';
import handler, { parseReview, recordFor, saveReview, storeFrom } from '../../api/review.mjs';

interface FakeRes {
  statusCode: number;
  headers: Record<string, string>;
  setHeader(name: string, value: string): void;
  end(): void;
}

const fakeRes = (): FakeRes => ({
  statusCode: 200,
  headers: {},
  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
  },
  end() {},
});

const env = { KV_REST_API_URL: 'https://example.upstash.io', KV_REST_API_TOKEN: 'test-token' };

/** A fake Upstash: answers each command, counts INCR per key, keeps what LPUSH saves. */
function fakeStore() {
  const counts = new Map<string, number>();
  const saved: string[] = [];
  const commands: string[][] = [];
  const fetchImpl = vi.fn((_url: string, init: { body: string }) => {
    const args = JSON.parse(init.body) as string[];
    commands.push(args);
    let result: unknown = 'OK';
    if (args[0] === 'INCR') {
      const n = (counts.get(args[1]!) ?? 0) + 1;
      counts.set(args[1]!, n);
      result = n;
    }
    if (args[0] === 'LPUSH') {
      saved.push(args[2]!);
      result = saved.length;
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ result }) });
  });
  return { fetchImpl, saved, commands };
}

describe('the review form', () => {
  it('keeps what the person wrote, trimmed, with the name and permission they chose', () => {
    expect(
      parseReview({ text: '  So easy!\u0007  ', name: ' Lea ', quote: 'yes', lang: 'de' }),
    ).toEqual({
      ok: true,
      bot: false,
      lang: 'de',
      review: { text: 'So easy!', name: 'Lea', quote: true, lang: 'de' },
    });
    expect(parseReview({ text: 'ok' })).toEqual({ ok: false, lang: 'en' });
    const long = parseReview({ text: 'x'.repeat(5000) });
    if (!long.ok || long.bot) throw new Error('expected a review');
    expect(long.review.text).toHaveLength(2000);
    expect(parseReview({ text: 'Fine', lang: 'xx' }).lang).toBe('en');
  });

  it('accepts a filled honeypot as a bot and saves nothing', async () => {
    const store = fakeStore();
    const res = fakeRes();
    await handler(
      { method: 'POST', body: { text: 'Buy now', website: 'spam.example', lang: 'fr' } },
      res,
      env,
      store.fetchImpl,
    );
    expect(store.fetchImpl).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(303);
    expect(res.headers.location).toBe('/fr/#review-thanks');
  });

  it('saves the review in the private list, and thanks the visitor', async () => {
    const store = fakeStore();
    const res = fakeRes();
    await handler(
      { method: 'POST', body: { text: 'Loved it', name: 'Charlie', quote: 'yes', lang: 'en' } },
      res,
      env,
      store.fetchImpl,
    );
    const [url, init] = store.fetchImpl.mock.calls[0] as unknown as [string, { headers: object }];
    expect(url).toBe('https://example.upstash.io');
    expect(init.headers).toMatchObject({ authorization: 'Bearer test-token' });
    expect(store.saved).toHaveLength(1);
    expect(JSON.parse(store.saved[0]!)).toMatchObject({
      text: 'Loved it',
      name: 'Charlie',
      quote: true,
      lang: 'en',
    });
    expect(store.commands.find((c) => c[0] === 'LPUSH')?.[1]).toBe('reviews');
    expect(res.headers.location).toBe('/en/#review-thanks');
  });

  it('stops a flood: at most 20 a minute, for everyone together, with no IP kept', async () => {
    const store = fakeStore();
    const now = new Date('2026-10-14T12:00:30Z');
    const review = { text: 'Hi', name: '', quote: false, lang: 'en' };
    const results: boolean[] = [];
    for (let i = 0; i < 22; i++) {
      results.push(
        await saveReview(
          review,
          { url: 'https://x', token: 't' },
          { fetchImpl: store.fetchImpl, now },
        ),
      );
    }
    expect(results.filter(Boolean)).toHaveLength(20);
    expect(store.saved).toHaveLength(20);
    expect(store.commands.filter((c) => c[0] === 'EXPIRE')).toHaveLength(1);
    expect(JSON.stringify(store.commands)).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  it('says it did not go through when the text is missing, the database fails or none is connected', async () => {
    const res1 = fakeRes();
    await handler({ method: 'POST', body: { text: '', lang: 'it' } }, res1, env, vi.fn());
    expect(res1.headers.location).toBe('/it/#review-error');

    const res2 = fakeRes();
    await handler(
      { method: 'POST', body: { text: 'Bene', lang: 'it' } },
      res2,
      env,
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }),
    );
    expect(res2.headers.location).toBe('/it/#review-error');

    const res3 = fakeRes();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handler({ method: 'POST', body: { text: 'Bene', lang: 'it' } }, res3, {}, vi.fn());
    spy.mockRestore();
    expect(res3.headers.location).toBe('/it/#review-error');
  });

  it('only takes a POST', async () => {
    const res = fakeRes();
    await handler({ method: 'GET' }, res, env, vi.fn());
    expect(res.statusCode).toBe(405);
  });

  it('reads either name Vercel gives the database, and saves only what the person chose', () => {
    expect(storeFrom(env)).toEqual({ url: 'https://example.upstash.io', token: 'test-token' });
    expect(
      storeFrom({ UPSTASH_REDIS_REST_URL: 'https://y.upstash.io/', UPSTASH_REDIS_REST_TOKEN: 'z' }),
    ).toEqual({ url: 'https://y.upstash.io', token: 'z' });
    expect(storeFrom({ KV_REST_API_URL: 'http://plain', KV_REST_API_TOKEN: 't' })).toBeNull();
    expect(storeFrom({})).toBeNull();
    expect(
      recordFor(
        { text: 'Helpful', name: '', quote: false, lang: 'fr' },
        new Date('2026-10-14T12:00:00Z'),
      ),
    ).toEqual({ text: 'Helpful', name: '', quote: false, lang: 'fr', date: '2026-10-14' });
  });
});
