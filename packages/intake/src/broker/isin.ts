// ISIN (ISO 6166): two letters, nine letters or digits, one check digit (Luhn over the digits,
// letters counted as 10 to 35).

const SHAPE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

export function isValidIsin(value: string): boolean {
  if (!SHAPE.test(value)) return false;
  const digits = [...value]
    .map((c) => (c >= '0' && c <= '9' ? c : String(c.charCodeAt(0) - 55)))
    .join('');
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits.charCodeAt(digits.length - 1 - i) - 48;
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/**
 * The country in an ISIN's prefix, when it is one. XS (international bonds), EU and the
 * user-assigned codes name no country.
 */
export function isinCountry(isin: string): string | undefined {
  const prefix = isin.slice(0, 2);
  if (!/^[A-Z]{2}$/.test(prefix) || /^(X[A-Z]|Q[M-Z]|EU|AA|ZZ)$/.test(prefix)) {
    return undefined;
  }
  return prefix;
}

/** A two-letter country code as brokers give it (e.g. IBKR issuerCountryCode). */
export function cleanCountry(value: string | undefined): string | undefined {
  const v = value?.trim().toUpperCase();
  return v && /^[A-Z]{2}$/.test(v) && isinCountry(`${v}0000000000`) ? v : undefined;
}

/** A stable instance id for a position without an ISIN, e.g. "ibkr-265598". */
export function fallbackId(prefix: string, value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${prefix}-${slug || 'unknown'}`;
}
