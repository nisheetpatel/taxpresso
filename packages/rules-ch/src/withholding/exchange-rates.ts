// Official exchange rates for the return: income at the year's average rate, wealth at the rate on
// 31 December (ge-2025-taux-donnees-fiscales, "Devises courantes pour l'année fiscale"; the
// federal list behind them is on ICTax). An account in a foreign currency is converted at the
// official rate (ge-2025-guide-declaration-pp p. 40). Amounts on the form are in francs.
//
// The rates for a year are only known after 31 December (the page says so), so the current year
// has none: a conversion without its official rate fails closed, never guesses.

export interface OfficialRate {
  /** CHF for one unit, as printed: the year's average, for income. */
  income: string;
  /** CHF for one unit on 31 December, for wealth. */
  wealth: string;
}

export const OFFICIAL_RATES: Readonly<
  Record<number, { source: string; rates: Readonly<Record<string, OfficialRate>> }>
> = {
  2025: {
    source: 'ge-2025-taux-donnees-fiscales (Devises courantes pour l’année fiscale 2025)',
    rates: {
      EUR: { income: '0.9370347', wealth: '0.930500' },
      GBP: { income: '1.09382235', wealth: '1.065681' },
      USD: { income: '0.83065179', wealth: '0.792250' },
    },
  },
};

export type Conversion =
  | { ok: true; centimes: number; rate: string; source: string }
  | { ok: false; reason: 'no_rates_for_year' | 'no_rate_for_currency' };

/**
 * An amount in hundredths of `currency` in CHF centimes at the official rate for `year`, rounded
 * to the centime (halves up), exactly. CHF passes through unchanged.
 */
export function officialChf(
  hundredths: number,
  currency: string,
  year: number,
  use: 'income' | 'wealth',
): Conversion {
  const code = currency.trim().toUpperCase();
  if (code === 'CHF') return { ok: true, centimes: hundredths, rate: '1', source: '' };
  const table = OFFICIAL_RATES[year];
  if (!table) return { ok: false, reason: 'no_rates_for_year' };
  const rate = table.rates[code]?.[use];
  if (!rate) return { ok: false, reason: 'no_rate_for_currency' };
  const [whole = '0', frac = ''] = rate.split('.');
  const scale = 10n ** BigInt(frac.length);
  const r = BigInt(whole + frac);
  const n = BigInt(Math.abs(hundredths)) * r;
  const q = n / scale;
  const rounded = 2n * (n % scale) >= scale ? q + 1n : q;
  const centimes = Number(rounded) * (hundredths < 0 ? -1 : 1);
  return { ok: true, centimes, rate, source: table.source };
}

/**
 * The official rate of `year`, or, for a later year whose rates are not published yet (they are
 * known only after 31 December), the latest year's official rate, flagged as an estimate until the
 * year's own is in Taxpresso (SPEC.md section 9). For figures that only set a rate (a property
 * abroad, counted for the rate: ../abroad/property.ts), never for an amount taxed here.
 */
export function officialChfOrLatest(
  hundredths: number,
  currency: string,
  year: number,
  use: 'income' | 'wealth',
): Conversion & { estimate?: { year: number } } {
  const own = officialChf(hundredths, currency, year, use);
  if (own.ok || own.reason !== 'no_rates_for_year') return own;
  const latest = Math.max(...Object.keys(OFFICIAL_RATES).map(Number));
  if (!(latest < year)) return own;
  const c = officialChf(hundredths, currency, latest, use);
  return c.ok ? { ...c, estimate: { year: latest } } : c;
}
