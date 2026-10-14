// Vaud's communes and their rates, one table per tax year, generated from the official tables of
// the communes' arrêtés d'imposition (scripts/vd-communes.mjs). The tables carry no federal commune
// number (BFS), so a commune is found by its name as the table prints it, accents and case aside.
// The communal income and wealth tax is levied in percent of the cantonal base tax, the main rate
// plus any special earmarked tax (LICom art. 6, al. 1 and 3). Two communes of the Vallée de Joux
// have fractions with a rate of their own (LICom art. 1): who lives in one pays it on top of the
// commune's, so their tax needs the part of the commune.
import type { Cited } from '@taxpresso/rules-ch';
import { vdParamsFor } from './params.js';

export interface VdFraction {
  /** The fraction's name in the official table ("Le Brassus"). */
  name: string;
  /** Its own rate, in hundredths of a percent of the cantonal base tax. */
  rate: number;
}

export interface VdCommune {
  name: string;
  /** The rate on income and wealth (main + special), in hundredths of a percent (78.5 -> 7850). */
  rate: number;
  /** The main rate (impôt revenu, fortune...). */
  main: number;
  /** The special earmarked tax (impôt spécial affecté); 0 when the commune levies none. */
  special: number;
  /** The fixed personal tax (impôt personnel fixe) per adult, in centimes; null when none. */
  personalTax: number | null;
  fractions?: readonly VdFraction[];
}

export function communesFor(taxYear: number): Cited<readonly VdCommune[]> {
  return vdParamsFor(taxYear).communes;
}

/** Lower case, accents and punctuation folded: "Yverdon-les-Bains" and "yverdon les bains" match. */
export function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A commune's slug, for display and for facts stored as slugs: "Château-d'Oex" -> "chateau-d-oex". */
export const slugOf = (name: string) => foldName(name).replace(/ /g, '-');

/** The commune of a year by its name or slug, accents, case and punctuation aside. */
export function communeByName(taxYear: number, name: string): VdCommune | undefined {
  const f = foldName(name);
  return communesFor(taxYear).value.find((c) => foldName(c.name) === f);
}

/**
 * The rate of a part of a commune: the commune's own when it has no fractions; with fractions,
 * the commune's plus the fraction's, or the commune's alone for the rest of the commune (`part` is
 * then the commune's own name). 'part' when the commune has fractions and none (or an unknown
 * one) was named.
 */
export function communeRate(
  commune: VdCommune,
  part?: string,
): { rate: number; fraction: VdFraction | null } | 'part' {
  if (!commune.fractions?.length) return { rate: commune.rate, fraction: null };
  if (part === undefined) return 'part';
  if (foldName(part) === foldName(commune.name)) return { rate: commune.rate, fraction: null };
  const fraction = commune.fractions.find((f) => foldName(f.name) === foldName(part));
  return fraction ? { rate: commune.rate + fraction.rate, fraction } : 'part';
}
