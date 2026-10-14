// The website's one form: a review someone chose to leave (the tip menu's free item). It is saved
// in a private database (Upstash Redis, connected to the Vercel project), so nothing is ever
// published by it: the maintainers read reviews there and quote one on taxpresso.ch only when its
// author ticked "you may quote this". No cookie, no tracking, no IP address kept; the visitor goes
// back to the page they came from.
//
// Set up: in Vercel, Storage, connect an Upstash Redis database to the project. Vercel then adds
// KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN),
// which this function and the site build read; the page shows the text box once they exist.
// Read the reviews in Upstash's data browser (the list "reviews"), or with scripts/reviews-export.mjs.

export const LANGS = ['en', 'fr', 'de', 'it', 'es', 'pt'];
export const MAX_TEXT = 2000;
export const MAX_NAME = 60;
/** At most this many reviews a minute, for everyone together: a flood stops, no one is tracked. */
export const PER_MINUTE = 20;
export const LIST = 'reviews';

/** Control characters other than tab, line feed and carriage return. */
const isControl = (code) => (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;

const clean = (value, max) =>
  [...String(value ?? '')]
    .filter((ch) => !isControl(ch.charCodeAt(0)))
    .join('')
    .trim()
    .slice(0, max);

/** The form's fields, checked. A filled honeypot ("website") is a bot: accepted, never saved. */
export function parseReview(body) {
  const b = body && typeof body === 'object' ? body : {};
  const lang = LANGS.includes(b.lang) ? b.lang : 'en';
  if (clean(b.website, 200)) return { ok: true, bot: true, lang };
  const text = clean(b.text, MAX_TEXT);
  if (text.length < 3) return { ok: false, lang };
  return {
    ok: true,
    bot: false,
    lang,
    review: { text, name: clean(b.name, MAX_NAME), quote: b.quote === 'yes', lang },
  };
}

/** What is saved: the text as written, the name and permission chosen, the day. Nothing else. */
export function recordFor(review, now = new Date()) {
  return {
    text: review.text,
    name: review.name,
    quote: review.quote,
    lang: review.lang,
    date: now.toISOString().slice(0, 10),
  };
}

/** The database the project is connected to, from Vercel's environment, or null. */
export function storeFrom(env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token && /^https:\/\//.test(url) ? { url: url.replace(/\/$/, ''), token } : null;
}

/** One Upstash REST command, e.g. ['LPUSH', 'reviews', '{...}']; returns its result. */
async function command(store, args, fetchImpl) {
  const res = await fetchImpl(store.url, {
    method: 'POST',
    headers: { authorization: `Bearer ${store.token}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`store answered ${res.status}`);
  const data = await res.json();
  if (data && data.error) throw new Error('store refused the command');
  return data?.result;
}

/** Saves the review unless this minute already took PER_MINUTE of them. */
export async function saveReview(review, store, { fetchImpl = fetch, now = new Date() } = {}) {
  const minute = `reviews:minute:${now.toISOString().slice(0, 16)}`;
  const count = await command(store, ['INCR', minute], fetchImpl);
  if (count === 1) await command(store, ['EXPIRE', minute, '120'], fetchImpl);
  if (count > PER_MINUTE) return false;
  await command(store, ['LPUSH', LIST, JSON.stringify(recordFor(review, now))], fetchImpl);
  return true;
}

const back = (res, lang, outcome) => {
  res.statusCode = 303;
  res.setHeader('location', `/${lang}/#review-${outcome}`);
  res.setHeader('cache-control', 'no-store');
  res.end();
};

export default async function handler(req, res, env = process.env, fetchImpl = fetch) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('allow', 'POST');
    return res.end();
  }
  const parsed = parseReview(req.body);
  if (!parsed.ok) return back(res, parsed.lang, 'error');
  if (parsed.bot) return back(res, parsed.lang, 'thanks');
  const store = storeFrom(env);
  if (!store) {
    console.error('reviews: no database connected (KV_REST_API_URL and KV_REST_API_TOKEN)');
    return back(res, parsed.lang, 'error');
  }
  try {
    const saved = await saveReview(parsed.review, store, { fetchImpl });
    return back(res, parsed.lang, saved ? 'thanks' : 'error');
  } catch {
    return back(res, parsed.lang, 'error');
  }
}
