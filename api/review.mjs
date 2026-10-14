// The website's one form: a review someone chose to leave (the tip menu's free item). It is filed
// as an issue in a private GitHub repository, so nothing is ever published by it: the maintainers
// read reviews there and quote one on taxpresso.ch only when its author ticked "you may quote this".
// No cookie, no tracking, no IP address kept here; the visitor goes back to the page they came from.
//
// Set in Vercel (Project settings, Environment variables):
//   REVIEWS_REPO           owner/name of the private repository, e.g. "nisheetpatel/taxpresso-reviews"
//   REVIEWS_GITHUB_TOKEN   a fine-grained token for that repository only, Issues: read and write
//   TAXPRESSO_REVIEWS=on   also read by the site build: only then does the page show the text box

export const LANGS = ['en', 'fr', 'de', 'it', 'es', 'pt'];
export const MAX_TEXT = 2000;
export const MAX_NAME = 60;

/** Control characters other than tab, line feed and carriage return. */
const isControl = (code) => (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;

const clean = (value, max) =>
  [...String(value ?? '')]
    .filter((ch) => !isControl(ch.charCodeAt(0)))
    .join('')
    .trim()
    .slice(0, max);

/** The form's fields, checked. A filled honeypot ("website") is a bot: accepted, never filed. */
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

/** The issue to file: the text as written, then what we may do with it. */
export function issueFor(review, now = new Date()) {
  return {
    title: `Review (${review.lang})${review.name ? `: ${review.name}` : ''}`,
    body: [
      review.text,
      '',
      '---',
      `Name to show: ${review.name || '(anonymous)'}`,
      `May be quoted on taxpresso.ch: ${review.quote ? 'yes' : 'no'}`,
      `Page language: ${review.lang}`,
      `Received: ${now.toISOString().slice(0, 10)}`,
    ].join('\n'),
    labels: ['review'],
  };
}

export async function fileReview(review, { repo, token, fetchImpl = fetch }) {
  const res = await fetchImpl(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'taxpresso-reviews',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify(issueFor(review)),
  });
  return res.ok;
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
  const repo = env.REVIEWS_REPO;
  const token = env.REVIEWS_GITHUB_TOKEN;
  if (!repo || !token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    console.error('reviews: REVIEWS_REPO or REVIEWS_GITHUB_TOKEN is not set');
    return back(res, parsed.lang, 'error');
  }
  try {
    const filed = await fileReview(parsed.review, { repo, token, fetchImpl });
    return back(res, parsed.lang, filed ? 'thanks' : 'error');
  } catch {
    return back(res, parsed.lang, 'error');
  }
}
