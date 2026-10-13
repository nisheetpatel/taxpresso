// What search engines read: absolute addresses, the same page in the other languages (hreflang)
// and structured data (JSON-LD). JSON-LD sits in <script type="application/ld+json">, a data block:
// browsers never run it, so the CSP's script-src 'none' (vercel.json, default-src) doesn't apply
// to it and stays as strict as it is.
import { BASE_URL, CONTACT_EMAIL, DEFAULT_LANG, LANGS } from './content.ts';

/** A path on the site ('/en/start/') as a full address. */
export const absoluteUrl = (path: string) => `${BASE_URL}${path}`;

/**
 * The page in every language, then x-default (English). `at` gives the page's path from a
 * language's prefix ('/en/' -> '/en/start/'), so every page lists the same set: the links are
 * reciprocal by construction.
 */
export function alternates(at: (prefix: string) => string): { hreflang: string; href: string }[] {
  const fallback = LANGS.find((l) => l.lang === DEFAULT_LANG)!;
  return [
    ...LANGS.map((l) => ({ hreflang: l.lang, href: absoluteUrl(at(l.path)) })),
    { hreflang: 'x-default', href: absoluteUrl(at(fallback.path)) },
  ];
}

/** Who publishes the site, for structured data. */
export const ORGANIZATION = {
  '@type': 'Organization',
  name: 'Taxpresso',
  url: `${BASE_URL}/`,
  email: CONTACT_EMAIL,
} as const;

/** Copy with its [text](link) markup turned into plain text. */
export const plain = (s: string) => s.replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1');

/**
 * One JSON-LD block. "<" is escaped so that no string in the data can close the element early.
 */
export const jsonLd = (data: Record<string, unknown>) =>
  `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...data }).replace(/</g, '\\u003c')}</script>`;
