// Basel-Stadt's three communes and how they share the income and wealth tax, one table per tax
// year, generated from the canton's table of rates (scripts/bs-communes.mjs). The city of Basel
// levies no communal tax: the canton levies the full tax there. From the residents of Riehen and
// Bettingen the canton levies its share of the tax computed under the tax law (Kantonssteuerquote)
// and the commune levies its own tax in percent of that tax (Steuerfuss): StG § 2 al. 2 and 3,
// § 228 al. 1. No document of the sources library gives the communes' federal numbers (BFS), so a
// commune is found by its name.
import type { Cited } from '@taxpresso/rules-ch';
import { bsParamsFor } from './params.js';

export interface BsCommune {
  name: string;
  /** The canton's share of the income tax computed under the law, in hundredths of a percent. */
  cantonIncomeShare: number;
  /** The canton's share of the wealth tax computed under the law, in hundredths of a percent. */
  cantonWealthShare: number;
  /** The commune's income tax, in percent of the tax computed under the law, hundredths (40 % -> 4000). */
  incomeRate: number;
  /** The commune's wealth tax, in percent of the tax computed under the law, hundredths. */
  wealthRate: number;
}

export function communesFor(taxYear: number): Cited<readonly BsCommune[]> {
  return bsParamsFor(taxYear).communes;
}

/** Lower case, accents and punctuation folded: "Bâle" stays "bale", "BASEL" is "basel". */
export function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A commune's slug, for display and for facts stored as slugs: "Riehen" -> "riehen". */
export const slugOf = (name: string) => foldName(name).replace(/ /g, '-');

/** The commune of a year by its name or slug, accents, case and punctuation aside. */
export function communeByName(taxYear: number, name: string): BsCommune | undefined {
  const f = foldName(name);
  return communesFor(taxYear).value.find((c) => foldName(c.name) === f);
}
