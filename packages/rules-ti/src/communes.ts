// Ticino's communes and their multipliers, one table per tax year, generated from the canton's
// table of multipliers (scripts/ti-communes.mjs). The communal tax is the commune's multiplier
// applied to the cantonal base tax (LT art. 276 cpv. 2), in the commune of residence at the end of
// the tax period (art. 277 cpv. 1). Communes merge: a year's list is the communes the table gives a
// multiplier for that year. The table carries no federal commune number (BFS), so a commune is
// found by its name as the table prints it ("BRIONE S/MINUSIO"), accents, case and punctuation
// aside.
import type { Cited } from '@taxpresso/rules-ch';
import { tiParamsFor } from './params.js';

export interface TiCommune {
  /** As the official table prints it, in capitals. */
  name: string;
  /** The multiplier for natural persons (PF), in hundredths of a percent of the cantonal base tax (77 % -> 7700). */
  rate: number;
}

export function communesFor(taxYear: number): Cited<readonly TiCommune[]> {
  return tiParamsFor(taxYear).communes;
}

/** Lower case, accents and punctuation folded: "Collina d’Oro" and "COLLINA D'ORO" match. */
export function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A commune's slug, for display and for facts stored as slugs: "BRIONE S/MINUSIO" -> "brione-s-minusio". */
export const slugOf = (name: string) => foldName(name).replace(/ /g, '-');

/** The commune of a year by its name or slug, accents, case and punctuation aside. */
export function communeByName(taxYear: number, name: string): TiCommune | undefined {
  const f = foldName(name);
  return communesFor(taxYear).value.find((c) => foldName(c.name) === f);
}
