// Types for kits.mjs (the filing kits' invented households: test data, never shipped).
export interface Kit {
  slug: string;
  title: string;
  story: string;
  commune: string;
  /** The commune's code (Code lieu, ge-2025-guide-declaration-pp p. 59). */
  communeCode: string;
  civil: 'single' | 'married';
  people: { id: 'p1' | 'p2'; first: string; last: string; born: string; ahv: string }[];
  children: { first: string; born: string }[];
  answers: Record<string, unknown>;
  yearAnswers?: Record<number, Record<string, unknown>>;
  /** The household's facts per tax year (see kits.mjs). */
  years: Record<number, Record<string, unknown>>;
}

export const KITS: Kit[];
export function chf(francs: number): number;
