// Geneva source tax on salaries (impôt à la source), tax years 2025 and 2026: the progressive
// tariffs A, B, C and H (RISP art. 1 al. 1 let. a, b, c, h) and the tax for a gross amount.
//
// The tables are data (data/ge/<year>/source-tax/tariffs.json), read by
// scripts/source-tax-tables.mjs from the official files ge-<year>-source-tariff-ascii. They are
// monthly (ch-na-is-recordformat-salaires p. 8, ch. 4.3); the readable tables print the same rows
// per year as 12 times the monthly income (ge-<year>-source-tariff-pdf p. 2, columns "Année" and
// "Mois"). Geneva uses the annual model: the rate comes from the income of the whole year, and the
// tax for the year is that income times the rate (ge-<year>-source-directives p. 9 and p. 14, ch. 2
// and 4.2). Geneva publishes these tariffs without church tax only (code letter N): the format
// (ch-na-is-recordformat-salaires p. 7) lets a canton list only one variant, and the files list N.
import ge2025 from '../../../../data/ge/2025/source-tax/tariffs.json';
import ge2026 from '../../../../data/ge/2026/source-tax/tariffs.json';
import { expandTariff, type CompactTariff } from '@taxpresso/rules-ch';

export type SourceTaxYear = 2025 | 2026;
/** The amount is for one month, or for the whole year. */
export type SourceTaxPeriod = 'month' | 'year';

export class SourceTaxError extends Error {}

interface TariffData {
  source: string;
  sha256: string;
  validFrom: string;
  church: string[];
  tariffs: Record<string, CompactTariff>;
}

const DATA: Record<SourceTaxYear, TariffData> = {
  2025: ge2025 as unknown as TariffData,
  2026: ge2026 as unknown as TariffData,
};

export const SOURCE_TAX_YEARS = [2025, 2026] as const satisfies readonly SourceTaxYear[];

/** Where each year's figures and rules are written. */
export const SOURCE_TAX_SOURCES: Record<
  SourceTaxYear,
  { tables: string; readable: string; annualModel: string; format: string }
> = {
  2025: {
    tables: 'ge-2025-source-tariff-ascii',
    readable: 'ge-2025-source-tariff-pdf p. 2',
    annualModel: 'ge-2025-source-directives p. 9, p. 14',
    format: 'ch-na-is-recordformat-salaires p. 3, p. 7, p. 8',
  },
  2026: {
    tables: 'ge-2026-source-tariff-ascii',
    readable: 'ge-2026-source-tariff-pdf p. 2',
    annualModel: 'ge-2026-source-directives p. 9, p. 14',
    format: 'ch-na-is-recordformat-salaires p. 3, p. 7, p. 8',
  },
};

const isYear = (year: number): year is SourceTaxYear =>
  (SOURCE_TAX_YEARS as readonly number[]).includes(year);

function data(year: number): TariffData {
  if (!isYear(year)) {
    throw new SourceTaxError(`No Geneva source-tax tables for ${year} in Taxpresso (2025, 2026).`);
  }
  return DATA[year];
}

/** The tariff codes of a year as published, e.g. "A0N" (tariff A, no child, no church tax). */
export function sourceTaxTariffs(year: number): string[] {
  return Object.keys(data(year).tariffs);
}

/**
 * The official code for what a user or a payslip writes: "a0", "A0" or "A0N" give "A0N".
 * A church-tax variant (Y) or a tariff Taxpresso doesn't have (D, E, G, the cross-border ones)
 * throws: nothing is guessed.
 */
export function normalizeTariff(year: number, code: string): string {
  const d = data(year);
  const c = code.trim().toUpperCase();
  const m = /^([A-Z])(\d)([NY]?)$/.exec(c);
  if (!m) throw new SourceTaxError(`“${code}” is not a source-tax tariff code (like A0 or B2N).`);
  const church = m[3] || 'N';
  if (!d.church.includes(church)) {
    throw new SourceTaxError(
      `Geneva publishes its ${year} source-tax tariffs only without church tax (${d.church.join(', ')}).`,
    );
  }
  const full = `${m[1]}${m[2]}${church}`;
  if (!d.tariffs[full]) {
    throw new SourceTaxError(
      `Taxpresso has the tariffs A, B, C and H only; ${m[1]}${m[2]} isn't one of them.`,
    );
  }
  return full;
}

const expanded = new Map<string, { from: number[]; rates: number[]; top: number }>();

function rows(year: SourceTaxYear, code: string) {
  const key = `${year}:${code}`;
  let r = expanded.get(key);
  if (!r) {
    r = expandTariff(DATA[year].tariffs[code]!);
    expanded.set(key, r);
  }
  return r;
}

export interface SourceTaxResult {
  year: SourceTaxYear;
  /** The official code, e.g. "A0N". */
  tariff: string;
  period: SourceTaxPeriod;
  grossCentimes: number;
  /** In hundredths of a percent: 1035 = 10.35 %. */
  rateBp: number;
  /** Gross times rate, to the nearest centime (the directives print no rounding rule). */
  taxCentimes: number;
  /** The table row in the period's terms: from (included) to (excluded). */
  bracket: { fromCentimes: number; toCentimes: number };
  sources: string[];
}

/**
 * Source tax on a gross amount (the whole gross salary: ge-<year>-source-directives ch. 3) for one
 * month or for the year. For the year, the row is the one whose yearly income (12 times the
 * monthly one) contains the amount, as in the readable tables.
 */
export function sourceTax(
  year: number,
  tariff: string,
  grossCentimes: number,
  period: SourceTaxPeriod,
): SourceTaxResult {
  const code = normalizeTariff(year, tariff);
  const y = year as SourceTaxYear;
  if (!Number.isSafeInteger(grossCentimes) || grossCentimes < 0) {
    throw new SourceTaxError('The gross amount must be a whole number of centimes, 0 or more.');
  }
  const factor = period === 'year' ? 12 : 1;
  const { from, rates, top } = rows(y, code);
  if (grossCentimes >= top * factor) {
    throw new SourceTaxError(`The ${year} table for ${code} stops below this amount.`);
  }
  // Last row whose start is at or below the amount (rows start at 0).
  let lo = 0;
  let hi = from.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (from[mid]! * factor <= grossCentimes) lo = mid;
    else hi = mid - 1;
  }
  const rateBp = rates[lo]!;
  const next = from[lo + 1] ?? top;
  const src = SOURCE_TAX_SOURCES[y];
  return {
    year: y,
    tariff: code,
    period,
    grossCentimes,
    rateBp,
    taxCentimes: Math.round((grossCentimes * rateBp) / 10_000),
    bracket: { fromCentimes: from[lo]! * factor, toCentimes: next * factor },
    sources: [src.tables, src.readable, src.annualModel, src.format],
  };
}
