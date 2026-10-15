// Amounts arrive as integer centimes (SPEC.md C3); the page only formats them, never computes.
import type { Language } from './i18n';

/** Whole francs: "CHF 8,943", in the page's language. */
export function francs(centimes: number, lang: Language): string {
  return new Intl.NumberFormat(`${lang}-CH`, {
    style: 'currency',
    currency: 'CHF',
    maximumFractionDigits: 0,
  }).format(Math.round(centimes / 100));
}

/** To the nearest CHF 10, as savings are said ("about CHF 1,820"). */
export const aboutFrancs = (centimes: number, lang: Language): string =>
  francs(Math.round(centimes / 1000) * 1000, lang);

/** To the nearest CHF 100, as a rough tax is said ("about CHF 8,900"). */
export const roughFrancs = (centimes: number, lang: Language): string =>
  francs(Math.round(centimes / 10_000) * 10_000, lang);

/** "95000", "95'000", "CHF 95 000", "95k" -> whole francs; empty -> null; not a number -> undefined. */
export function parseFrancs(text: string): number | null | undefined {
  const s = text
    .trim()
    .toLowerCase()
    .replace(/[’'\s,\u00a0\u202f]/g, '')
    .replace(/^chf/, '')
    .replace(/\.[-–]$/, '');
  if (s === '') return null;
  const k = s.endsWith('k');
  const n = Number(k ? s.slice(0, -1) : s);
  return Number.isFinite(n) && n >= 0 ? Math.round(k ? n * 1000 : n) : undefined;
}
