// The website's review form (api/review.mjs): what it accepts, what it files, where it sends the
// visitor back. GitHub is never called here: a fake fetch stands in for it.
import { describe, expect, it, vi } from 'vitest';
import handler, { issueFor, parseReview } from '../../api/review.mjs';

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

const env = { REVIEWS_REPO: 'example/taxpresso-reviews', REVIEWS_GITHUB_TOKEN: 'test-token' };

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

  it('accepts a filled honeypot as a bot and files nothing', async () => {
    const fetchImpl = vi.fn();
    const res = fakeRes();
    await handler(
      { method: 'POST', body: { text: 'Buy now', website: 'spam.example', lang: 'fr' } },
      res,
      env,
      fetchImpl,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(303);
    expect(res.headers.location).toBe('/fr/#review-thanks');
  });

  it('files the review privately, as an issue labelled review, and thanks the visitor', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const res = fakeRes();
    await handler(
      { method: 'POST', body: { text: 'Loved it', name: 'Charlie', quote: 'yes', lang: 'en' } },
      res,
      env,
      fetchImpl,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, { body: string; headers: object }];
    expect(url).toBe('https://api.github.com/repos/example/taxpresso-reviews/issues');
    expect(init.headers).toMatchObject({ authorization: 'Bearer test-token' });
    const issue = JSON.parse(init.body) as { title: string; body: string; labels: string[] };
    expect(issue.title).toBe('Review (en): Charlie');
    expect(issue.labels).toEqual(['review']);
    expect(issue.body).toMatch(
      /^Loved it\n\n---\nName to show: Charlie\nMay be quoted on taxpresso.ch: yes/,
    );
    expect(res.headers.location).toBe('/en/#review-thanks');
  });

  it('says it did not go through when the text is missing, GitHub refuses or nothing is set up', async () => {
    const res1 = fakeRes();
    await handler({ method: 'POST', body: { text: '', lang: 'it' } }, res1, env, vi.fn());
    expect(res1.headers.location).toBe('/it/#review-error');

    const res2 = fakeRes();
    await handler(
      { method: 'POST', body: { text: 'Bene', lang: 'it' } },
      res2,
      env,
      vi.fn().mockResolvedValue({ ok: false }),
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

  it('marks an anonymous review that may not be quoted as such', () => {
    const issue = issueFor(
      { text: 'Helpful', name: '', quote: false, lang: 'fr' },
      new Date('2026-10-14T12:00:00Z'),
    );
    expect(issue.title).toBe('Review (fr)');
    expect(issue.body).toContain('Name to show: (anonymous)');
    expect(issue.body).toContain('May be quoted on taxpresso.ch: no');
    expect(issue.body).toContain('Received: 2026-10-14');
  });
});
