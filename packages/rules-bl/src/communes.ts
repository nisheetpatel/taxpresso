// Basel-Landschaft's 86 communes, one table per tax year, generated from the canton's table of rates
// by scripts/bl-communes.mjs. Each commune levies its income and wealth tax on natural persons in
// percent of the normal state tax (normale Staatssteuer), with one Steuerfuss for both, at most 80 %
// (StG § 19 Abs. 2, § 18bis). The table has no federal commune numbers (BFS), so a commune is found by
// its name or slug, accents and case aside. The commune where you lived on 31 December taxes the
// whole year: a move inside the canton does not split the communal tax (bl-2025-wegleitung p. 3).
//
// The church rates are the table's, for 2026 only: the Roman Catholic church in percent of the state
// tax (footnote 2), the Evangelical Reformed and the Christ Catholic churches in percent of the
// taxable income and wealth (footnote 3), and an amount per child (footnote 4) whose column has no
// church heading.
import type { Cited } from '@taxpresso/rules-ch';
import { blParamsFor } from './params.js';

export interface BlChurchRates {
  /** Röm.-kath. Kirche: in hundredths of a percent of the state tax (8 % -> 800). */
  catholic: number;
  /** Evang.-ref. Kirche: in hundredths of a percent of the taxable income and of the taxable wealth. */
  reformed: { income: number; wealth: number };
  /** Christ.kath. Kirche: in hundredths of a percent of the taxable income and of the taxable wealth. */
  christCatholic: { income: number; wealth: number };
  /** The table's Kinderabzug, in centimes per child (footnote 4: in Franken pro Kind). */
  childAmount: number;
}

export interface BlCommune {
  name: string;
  /** Bezirk: Arlesheim, Laufen, Liestal, Sissach or Waldenburg. */
  district: string;
  /** The Steuerfuss on income and wealth, in hundredths of a percent of the state tax (58.5 % -> 5850). */
  rate: number;
  /** The church rates of the year; null when the table does not give them (2025). */
  church: BlChurchRates | null;
}

export function communesFor(taxYear: number): Cited<readonly BlCommune[]> {
  return blParamsFor(taxYear).communes;
}

/** Lower case, accents and punctuation folded: "Burg i.L." and "burg i l" match. */
export function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A commune's slug, for display and for facts stored as slugs: "Burg i.L." -> "burg-i-l". */
export const slugOf = (name: string) => foldName(name).replace(/ /g, '-');

/** The commune of a year by its name or slug, accents, case and punctuation aside. */
export function communeByName(taxYear: number, name: string): BlCommune | undefined {
  const f = foldName(name);
  return communesFor(taxYear).value.find((c) => foldName(c.name) === f);
}
