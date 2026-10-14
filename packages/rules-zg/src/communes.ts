// Zug's 11 communes, one table per tax year, generated from the Steuerverwaltung's table of
// Steuerfüsse by scripts/zg-communes.mjs. Each Einwohnergemeinde, Roman Catholic parish and
// Bürgergemeinde levies its tax in percent of the einfache Steuer, like the canton (StG § 2 Abs. 1,
// §§ 168 to 170); the table prints the multipliers with the year's rebates already taken off. The
// table has no federal commune numbers (BFS), so a commune is found by its name or slug, accents
// and case aside. The commune where you lived on 31 December taxes the whole year (§ 171).
import type { Cited } from '@taxpresso/rules-ch';
import { zgParamsFor } from './params.js';

export interface ZgCommune {
  name: string;
  /** The Einwohnergemeinde's Steuerfuss, in hundredths of a percent (52.11 % -> 5211). */
  rate: number;
  /** The Roman Catholic parish's Steuerfuss (Katholische Kirchgemeinde), in hundredths. */
  catholic: number;
  /**
   * The Bürgergemeinde's Steuerfuss on its Ortsbürger, in hundredths; null: it levies no tax ("-");
   * 'special': it taxes only income under special taxes (the table's footnote), none on ordinary
   * income and wealth.
   */
  citizens: number | null | 'special';
}

export function communesFor(taxYear: number): Cited<readonly ZgCommune[]> {
  return zgParamsFor(taxYear).communes;
}

/** Lower case, accents and punctuation folded: "Hünenberg" and "hunenberg" match. */
export function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A commune's slug, for display and for facts stored as slugs: "Oberägeri" -> "oberageri". */
export const slugOf = (name: string) => foldName(name).replace(/ /g, '-');

/** The commune of a year by its name or slug, accents, case and punctuation aside. */
export function communeByName(taxYear: number, name: string): ZgCommune | undefined {
  const f = foldName(name.replace(/-/g, ' '));
  return communesFor(taxYear).value.find((c) => foldName(c.name) === f);
}
