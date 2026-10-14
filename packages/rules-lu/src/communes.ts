// Lucerne's communes and their tax units (Steuereinheiten), one table per tax year, generated from
// the Dienststelle Steuern's table of units for natural persons (scripts/lu-communes.mjs). The tax
// is the tax per unit (Steuer je Einheit, StG § 2 Abs. 1) times the units of the state, of the
// commune (Einwohnergemeinde) and, for members of a recognised church, of their parish
// (Kirchgemeinde): StG § 2 Abs. 2, § 236 Abs. 2, § 240 Abs. 1. The table carries no federal
// commune number (BFS), so a commune is found by its name as the table prints it, accents, case and
// punctuation aside. The commune that taxes is the one of residence at the end of the tax period
// (StG § 237 Abs. 1).
import type { Cited } from '@taxpresso/rules-ch';
import { luParamsFor } from './params.js';

/** A parish (Kirchgemeinde) as the table prints it: its units, and its name. */
export interface LuParish {
  /** Units in ten-thousandths (0.2565 -> 2565). */
  units: number;
  /**
   * The parish's name as the table prints it. The table names the Roman Catholic parish only when
   * it is not the commune's own (Dierikon: "Root"); null then means the commune's own parish.
   */
  parish: string | null;
}

export interface LuCommune {
  /** As the official table prints it. */
  name: string;
  /** Units of the Einwohnergemeinde, in ten-thousandths (1.95 -> 19500). */
  units: number;
  /** Römisch-katholische Kirchgemeinde. */
  catholic: LuParish;
  /** Evangelisch-reformierte Kirchgemeinde (the table always names it). */
  reformed: LuParish;
}

export function communesFor(taxYear: number): Cited<readonly LuCommune[]> {
  return luParamsFor(taxYear).communes;
}

/** Lower case, accents and punctuation folded: "Römerswil" and "romerswil" match. */
export function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A commune's slug, for display and for facts stored as slugs: "Escholzmatt-Marbach" -> "escholzmatt-marbach". */
export const slugOf = (name: string) => foldName(name).replace(/ /g, '-');

/** The commune of a year by its name or slug, accents, case and punctuation aside. */
export function communeByName(taxYear: number, name: string): LuCommune | undefined {
  const f = foldName(name);
  return communesFor(taxYear).value.find((c) => foldName(c.name) === f);
}
