// Bern's communes and their multipliers, one table per tax year, generated from the tax
// administration's table of Steueranlagen and checked against the finance administration's printed
// table of the same year (scripts/be-communes.mjs). A commune is identified by its BFS number. Some
// communes have parts whose church parishes levy different rates (Kirchensteuersätze): the table
// then gives one parish per part, and the church tax is computed only once the part is known.
import type { Cited } from '@taxpresso/rules-ch';
import { beParamsFor } from './params.js';

/** The churches with a Bern church tax: the three columns of the official tables. */
export type Confession = 'reformed' | 'catholic' | 'christ_catholic' | 'none';

/** One part of a commune for the church tax, its rates in ten-thousandths of the einfache Steuer. */
export interface BeParish {
  /** The part's name in the official table (the commune's own name when it has one parish). */
  name: string;
  /** Evangelisch-reformiert, römisch-katholisch, christkatholisch; null where the documents differ. */
  reformed: number | null;
  catholic: number | null;
  christCatholic: number | null;
}

export interface BeCommune {
  bfs: number;
  name: string;
  /** Steueranlage of the commune for natural persons, in ten-thousandths (1.54 -> 15400). */
  rate: number;
  parishes: readonly BeParish[];
}

export function communesFor(taxYear: number): Cited<readonly BeCommune[]> {
  return beParamsFor(taxYear).communes;
}

export function communeByBfs(taxYear: number, bfs: number): BeCommune | undefined {
  return communesFor(taxYear).value.find((c) => c.bfs === bfs);
}

/** Lower case, accents and punctuation folded: "Münchenbuchsee" and "munchenbuchsee" match. */
export function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function communeByName(taxYear: number, name: string): BeCommune | undefined {
  const f = foldName(name);
  return communesFor(taxYear).value.find((c) => foldName(c.name) === f);
}

const FIELD = {
  reformed: 'reformed',
  catholic: 'catholic',
  christ_catholic: 'christCatholic',
} as const satisfies Record<Exclude<Confession, 'none'>, keyof BeParish>;

/**
 * The church tax rate of a confession in a commune: the same in every part, or the part's when a
 * part is named. 'part' when the parts differ and none (or an unknown one) was named; 'conflict'
 * when the official documents give different rates.
 */
export function churchRate(
  commune: BeCommune,
  confession: Exclude<Confession, 'none'>,
  part?: string,
): number | 'part' | 'conflict' {
  const field = FIELD[confession];
  const named = part === undefined ? undefined : commune.parishes.find((p) => p.name === part);
  const values = named ? [named[field]] : commune.parishes.map((p) => p[field]);
  if (values.some((v) => v === null)) {
    return named || new Set(values).size === 1 ? 'conflict' : 'part';
  }
  if (new Set(values).size !== 1) return 'part';
  return values[0]!;
}
