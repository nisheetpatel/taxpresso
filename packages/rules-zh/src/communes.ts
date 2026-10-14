// Zurich's communes and their multipliers (Gemeindesteuerfüsse), one table per tax year, generated
// from the canton's statistics office table (scripts/zh-communes.mjs). A commune is identified by
// its BFS number. Some communes have parts with different multipliers (school districts, church
// parishes): the table then gives two or three values, without naming the parts, and the engine
// computes only once it is told which applies.
import type { Cited } from './cited.js';
import { zhParamsFor } from './params.js';

export interface CommuneRates {
  bfs: number;
  name: string;
  /** Total communal multiplier without church tax, in percent of the einfache Staatssteuer. */
  rates: readonly number[];
  /** Church multipliers (reformiert, katholisch, christkatholisch), in percent. */
  reformed: readonly number[];
  catholic: readonly number[];
  christCatholic: readonly number[];
}

export function communesFor(taxYear: number): Cited<readonly CommuneRates[]> {
  return zhParamsFor(taxYear).communes;
}

export function communeByBfs(taxYear: number, bfs: number): CommuneRates | undefined {
  return communesFor(taxYear).value.find((c) => c.bfs === bfs);
}

/** Lower case, accents and punctuation folded: "Wädenswil" and "wadenswil" match. */
export function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function communeByName(taxYear: number, name: string): CommuneRates | undefined {
  const f = foldName(name);
  return communesFor(taxYear).value.find((c) => foldName(c.name) === f);
}

/**
 * One multiplier from a list: the only one, or the one asked for (1-based) when the parts of the
 * commune differ. Undefined when it differs by part and no part was given, or the part is unknown.
 */
export function pick(values: readonly number[], variant?: number): number | undefined {
  const distinct = new Set(values);
  if (distinct.size === 1) return values[0];
  if (variant === undefined) return undefined;
  return values[variant - 1];
}
