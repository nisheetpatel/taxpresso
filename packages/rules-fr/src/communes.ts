// Fribourg's communes and their coefficients, one table per tax year, generated from the official
// tables by scripts/fr-communes.mjs. The tables carry the federal commune number (BFS), so a commune
// is found by it, or by its name as the table prints it, accents and case aside. The commune of
// residence on 31 December taxes the whole year only when you lived there all year: a move between
// Fribourg communes splits the communal tax by the time in each (LICo art. 9 al. 2), which the
// engine does not do.
//
// The communal tax on income and wealth is the commune's coefficient, the same for both, times the
// cantonal base tax (LICo art. 3 al. 3, art. 4 al. 3); the church tax is the parish's coefficient,
// one for income and one for wealth, times the same base (fr-2025-guide-instructions-generales p.
// 46). A commune is covered by one or more parishes of each church.
import type { Cited } from '@taxpresso/rules-ch';
import { frParamsFor } from './params.js';

export interface FrParish {
  /** The parish's name in the official table. */
  name: string;
  /** Coefficient on income, in hundredths of a percent of the cantonal base tax (8.5 % -> 850). */
  income: number;
  /** Coefficient on wealth, in hundredths of a percent of the cantonal base tax. */
  wealth: number;
}

export interface FrCommune {
  /** The federal commune number (numéro OFS), as the official tables give it. */
  bfs: number;
  name: string;
  district: string;
  /**
   * The communal coefficient on income and wealth, in hundredths of a percent of the cantonal base
   * tax (74.3 % -> 7430); null when no document gives it for the year.
   */
  rate: number | null;
  catholic: readonly FrParish[];
  reformed: readonly FrParish[];
}

export type Church = 'catholic' | 'reformed';

export function communesFor(taxYear: number): Cited<readonly FrCommune[]> {
  return frParamsFor(taxYear).communes;
}

/** Lower case, accents and punctuation folded: "Châtel-Saint-Denis" and "chatel saint denis" match. */
export function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A commune's slug, for display and for facts stored as slugs: "Cugy (FR)" -> "cugy-fr". */
export const slugOf = (name: string) => foldName(name).replace(/ /g, '-');

/** The commune of a year by its BFS number, or by its name or slug (accents, case aside). */
export function communeByRef(taxYear: number, ref: string | number): FrCommune | undefined {
  const all = communesFor(taxYear).value;
  if (typeof ref === 'number') return all.find((c) => c.bfs === ref);
  const f = foldName(ref);
  return all.find((c) => foldName(c.name) === f);
}

/**
 * The parish of a church for a commune: the one named, or, when no parish is named, the commune's
 * only parish or its parishes when they all have the same coefficients. 'parish' when the
 * commune's parishes differ and none (or an unknown one) was named.
 */
export function parishOf(commune: FrCommune, church: Church, name?: string): FrParish | 'parish' {
  const parishes = commune[church];
  if (name !== undefined) {
    return parishes.find((p) => foldName(p.name) === foldName(name)) ?? 'parish';
  }
  const first = parishes[0];
  if (!first) return 'parish';
  const same = parishes.every((p) => p.income === first.income && p.wealth === first.wealth);
  return same ? first : 'parish';
}
