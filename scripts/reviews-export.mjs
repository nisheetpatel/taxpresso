#!/usr/bin/env node
// Prints the website's reviews (api/review.mjs saves them in Upstash Redis) as CSV, newest first,
// for a spreadsheet. A maintainer tool, run on your own computer; never part of the extension.
//
//   KV_REST_API_URL=https://... KV_REST_API_READ_ONLY_TOKEN=... node scripts/reviews-export.mjs > reviews.csv
//
// Copy the URL and the read-only token from the database's page in Upstash (or Vercel, Storage).
// Don't save them in the repository. Quote a review on the site only if its "quote" column says yes.

const url = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(
  /\/$/,
  '',
);
const token =
  process.env.KV_REST_API_READ_ONLY_TOKEN ||
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url.startsWith('https://') || !token) {
  console.error('Set KV_REST_API_URL and KV_REST_API_READ_ONLY_TOKEN (see the top of this file).');
  process.exit(1);
}

const res = await fetch(url, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify(['LRANGE', 'reviews', '0', '-1']),
});
if (!res.ok) {
  console.error(`The database answered ${res.status}.`);
  process.exit(1);
}
const { result = [] } = await res.json();

const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const rows = [['date', 'language', 'name', 'quote', 'review']];
for (const raw of result) {
  try {
    const r = JSON.parse(raw);
    rows.push([r.date, r.lang, r.name, r.quote ? 'yes' : 'no', r.text]);
  } catch {
    // A line that isn't a review: skip it.
  }
}
process.stdout.write(rows.map((row) => row.map(cell).join(',')).join('\n') + '\n');
console.error(`${rows.length - 1} review${rows.length === 2 ? '' : 's'}.`);
