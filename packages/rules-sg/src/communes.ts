// St. Gallen's political communes and their multipliers, one table per tax year, generated from the
// canton's yearly table of multipliers (Steuerfüsse der Gemeinden) by scripts/sg-communes.mjs. Each
// commune levies its income and wealth tax in percent of the einfache Steuer (StG Art. 2, Art. 6
// Abs. 2 lit. b), one Gesamtsteuerfuss for both. The table has no federal commune numbers (BFS), so a
// commune is found by its name or slug, accents, case and punctuation aside.
//
// The church tax (Art. 3 and Art. 6 Abs. 2 lit. b; StV Art. 1) is levied by the church areas
// (Kirchgemeinden): some communes have several, with different rates, and then the church tax needs
// the area. The Christ Catholic rate is one for the whole canton. The table marks some rates with
// footnote 3 (parts of the area belong to parishes outside the canton) or 4 (larger parts belong to
// other parishes): their rate is not that of everyone who lives there.
import type { Cited } from '@taxpresso/rules-ch';
import { sgParamsFor } from './params.js';

export interface SgChurchArea {
  /** The area's name in the table; the commune's own name for a commune's main row. */
  name: string;
  /** Katholisch, in hundredths of a percent of the einfache Steuer (26 % -> 2600). */
  catholic: number;
  /** Evangelisch (Evangelical Reformed), in hundredths of a percent (22.5 % -> 2250). */
  reformed: number;
  /** The table's footnote on a rate: 3 or 4 (see above). */
  notes?: { catholic?: 3 | 4; reformed?: 3 | 4 };
}

export interface SgCommune {
  name: string;
  /** The Gesamtsteuerfuss of the political commune, in hundredths of a percent (138 % -> 13800). */
  rate: number;
  /** The church areas, at least one. */
  areas: readonly SgChurchArea[];
}

/** The churches with a church tax in the table: Catholic, Evangelical Reformed, Christ Catholic. */
export type Confession = 'catholic' | 'reformed' | 'christ_catholic' | 'other' | 'none';

export function communesFor(taxYear: number): Cited<readonly SgCommune[]> {
  return sgParamsFor(taxYear).communes;
}

/** Lower case, accents and punctuation folded: "St. Gallen" and "st gallen" match. */
export function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A commune's slug, for display and for facts stored as slugs: "St. Gallen" -> "st-gallen". */
export const slugOf = (name: string) => foldName(name).replace(/ /g, '-');

/** The commune of a year by its name or slug, accents, case and punctuation aside. */
export function communeByName(taxYear: number, name: string): SgCommune | undefined {
  const f = foldName(name);
  return communesFor(taxYear).value.find((c) => foldName(c.name) === f);
}

/** A church area of a commune by its name or slug, accents, case and punctuation aside. */
export function areaByName(commune: SgCommune, name: string): SgChurchArea | undefined {
  const f = foldName(name);
  return commune.areas.find((a) => foldName(a.name) === f);
}

/**
 * The church rate of a confession (Catholic or Reformed) in a commune: the named area's, or the one
 * rate of all its areas. 'area' when the areas differ and none (or an unknown one) was named.
 */
export function churchRate(
  commune: SgCommune,
  confession: 'catholic' | 'reformed',
  area?: string,
): { rate: number; area: SgChurchArea } | 'area' {
  const named = area === undefined ? undefined : areaByName(commune, area);
  if (area !== undefined && !named) return 'area';
  if (named) return { rate: named[confession], area: named };
  const rates = new Set(commune.areas.map((a) => a[confession]));
  const notes = new Set(commune.areas.map((a) => a.notes?.[confession]));
  if (rates.size !== 1 || notes.size !== 1) return 'area';
  const first = commune.areas[0]!;
  return { rate: first[confession], area: first };
}
