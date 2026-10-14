// Whether a tax year is over (docs/design/tax-years.md): derived, never stored.
import { CURRENT_TAX_YEAR } from './config.js';

/** Today, as YYYY-MM-DD. */
export const isoToday = (): string => new Date().toISOString().slice(0, 10);

/**
 * A tax year that is over: one before the year this release prepares by default. What had to be
 * done before its 31 December (paying into 3a, a pension fund buy-in) can't be done for it anymore,
 * so the plans are the default year's. The default year's own estimate and plans work all year.
 */
export function isYearOver(taxYear: number): boolean {
  return taxYear < CURRENT_TAX_YEAR;
}
