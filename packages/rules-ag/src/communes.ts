// Aargau's communes and their multipliers, one list per tax year, generated from the canton's
// Verzeichnis der Gemeinde- und Kirchensteuerfüsse (scripts/ag-communes.mjs). The list carries no
// BFS number, so a commune is identified by its name as the list prints it ("Brugg (AG)"). Some
// communes have further parishes (Zusatzkirchen) whose members, in part of the commune, pay another
// church rate: the church tax is then computed only once the parish is known.
import type { Cited } from '@taxpresso/rules-ch';
import { agParamsFor } from './params.js';

/** The churches with an Aargau church tax: the three columns of the list. */
export type Confession = 'reformed' | 'catholic' | 'christ_catholic' | 'none';

/** A further parish of a commune (Zusatzkirche), its name as the list's last page prints it. */
export interface AgParish {
  /** "ref. Kirche Rohr", "röm.-kath. Kirche Gebenstorf". */
  parish: string;
  confession: 'reformed' | 'catholic';
  /** Its Steuerfuss, in percent of the einfache Steuer. */
  rate: number;
}

export interface AgCommune {
  name: string;
  /** The commune's Steuerfuss for natural persons, in percent of the einfache Kantonssteuer. */
  rate: number;
  /** The church Steuerfüsse of the commune's own parishes, in percent. */
  church: { reformed: number; catholic: number; christCatholic: number };
  /** Further parishes in part of the commune (Kirche 1 to 5 of the list). */
  extra: readonly AgParish[];
}

export function communesFor(taxYear: number): Cited<readonly AgCommune[]> {
  return agParamsFor(taxYear).communes;
}

/** Lower case, accents and punctuation folded: "Böttstein" and "bottstein" match. */
export function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A commune's slug, for display: its name folded ("Brugg (AG)" -> "brugg-ag"). */
export const slugOf = (name: string) => foldName(name).replace(/ /g, '-');

/** The commune of a year by its name as the list prints it, accents, case and punctuation aside. */
export function communeByName(taxYear: number, name: string): AgCommune | undefined {
  const f = foldName(name);
  return communesFor(taxYear).value.find((c) => foldName(c.name) === f);
}

const FIELD = {
  reformed: 'reformed',
  catholic: 'catholic',
  christ_catholic: 'christCatholic',
} as const satisfies Record<Exclude<Confession, 'none'>, keyof AgCommune['church']>;

/**
 * The church rate of a confession in a commune: the commune's own parish, or a further parish when
 * one is named. 'parish' when the commune has a further parish of that confession and none was
 * named (or an unknown one); a named further parish of another confession is unknown too.
 */
export function churchRate(
  commune: AgCommune,
  confession: Exclude<Confession, 'none'>,
  parish?: string,
): number | 'parish' {
  const extra = commune.extra.filter((p) => p.confession === confession);
  const own = commune.church[FIELD[confession]];
  if (parish === undefined) return extra.length ? 'parish' : own;
  if (foldName(parish) === foldName(commune.name)) return own;
  const named = extra.find((p) => foldName(p.parish) === foldName(parish));
  return named ? named.rate : 'parish';
}

/** Every church rate that could apply in a commune (for the checks that need the highest one). */
export function churchRates(commune: AgCommune): number[] {
  return [
    commune.church.reformed,
    commune.church.catholic,
    commune.church.christCatholic,
    ...commune.extra.map((p) => p.rate),
  ];
}
