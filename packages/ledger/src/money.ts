// Money and dates as printed on documents, read deterministically (SPEC.md section 4: integer
// centimes, never floats). Claude passes what it reads as text ("12'345.60", "12 345,60",
// "CHF 12,345.60"); anything that could mean two different amounts is refused, never guessed.

export type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };

const fail = <T>(reason: string): Parsed<T> => ({ ok: false, reason });

/** Apostrophes and spaces used to group thousands: ' ’ \u02bc \u2032 and normal, no-break, thin spaces. */
const GROUP_CHARS = /['’\u02bc\u2032 \u00a0\u202f\u2009]/;
const SPACES = /[ \u00a0\u202f\u2009]/g;

/** Valid thousands groups: 1 to 3 digits, then groups of exactly 3. */
function groupsValid(groups: string[]): boolean {
  return (
    groups.length > 0 &&
    /^\d{1,3}$/.test(groups[0]!) &&
    groups.slice(1).every((g) => /^\d{3}$/.test(g))
  );
}

/**
 * Reads an amount of money printed on a document and returns it in centimes.
 * Accepts: 12345 · 12345.60 · 12'345.60 · 12’345,60 · 12 345.60 · 12,345.60 (with a decimal point)
 * · 12.345,60 (with a decimal comma) · CHF 1'200.\u2013 · Fr. 80.- · -50.00.
 * Refuses: 12,345 or 12.345 (thousands or decimals?), three or more decimals, mixed grouping.
 */
export function parseMoney(text: string): Parsed<number> {
  if (typeof text !== 'string') return fail('expected the amount as text, e.g. "12\'345.60"');
  let s = text.trim();
  if (s.length === 0) return fail('the amount is empty');
  if (s.length > 40) return fail('the amount is too long');
  // Currency, before or after: CHF, Fr., SFr., Frs.
  s = s.replace(/^(?:CHF|S?Fr\.?|Frs\.?)\s*/i, '').replace(/\s*(?:CHF|S?Fr\.?|Frs\.?)$/i, '');
  let negative = false;
  if (/^[-\u2212]/.test(s)) {
    negative = true;
    s = s.slice(1).trim();
  }
  // "1'200.\u2013" or "80.-": whole francs, no centimes.
  s = s.replace(/[.,][-\u2013\u2014]+$/, '');
  if (!/^\d/.test(s) || !/\d$/.test(s)) return fail(`"${text}" is not an amount`);
  if (/[^\d.,'’\u02bc\u2032 \u00a0\u202f\u2009]/.test(s)) {
    return fail(`"${text}" contains characters that are not part of an amount`);
  }

  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;
  let intPart: string;
  let decimals = '';
  if (dots > 0 && commas > 0) {
    // Both: the last one is the decimal separator, the other groups thousands.
    const decimal = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const group = decimal === '.' ? ',' : '.';
    if ((decimal === '.' ? dots : commas) !== 1)
      return fail(`"${text}" has two decimal separators`);
    const at = s.lastIndexOf(decimal);
    decimals = s.slice(at + 1);
    const groups = s.slice(0, at).split(group);
    if (groups.some((g) => GROUP_CHARS.test(g)) || !groupsValid(groups)) {
      return fail(`"${text}" has thousands groups that don't line up`);
    }
    intPart = groups.join('');
  } else if (dots + commas > 0) {
    const sep = dots > 0 ? '.' : ',';
    const pieces = s.split(sep);
    if (pieces.length > 2) {
      // 1.234.567 or 1,234,567: thousands only.
      if (pieces.some((g) => GROUP_CHARS.test(g)) || !groupsValid(pieces)) {
        return fail(`"${text}" has thousands groups that don't line up`);
      }
      intPart = pieces.join('');
    } else {
      const [head = '', tail = ''] = pieces;
      if (tail.length === 3 && !GROUP_CHARS.test(head)) {
        return fail(
          `"${text}" is ambiguous: is "${sep}" a decimal or a thousands separator? Give it with its centimes, e.g. "1'234.00"`,
        );
      }
      if (tail.length < 1 || tail.length > 2) {
        return fail(`"${text}" has ${tail.length} digits after "${sep}"; an amount has 2 at most`);
      }
      intPart = head;
      decimals = tail;
    }
  } else {
    intPart = s;
  }
  if (!/^\d{1,2}$/.test(decimals) && decimals !== '') {
    return fail(`"${text}" has ${decimals.length} digits after the decimal separator`);
  }

  // Thousands grouped with apostrophes or spaces (one kind only).
  if (GROUP_CHARS.test(intPart)) {
    const kinds = new Set(
      [...intPart.replace(/\d/g, '')].map((c) => (/[ \u00a0\u202f\u2009]/.test(c) ? ' ' : "'")),
    );
    if (kinds.size > 1) return fail(`"${text}" mixes apostrophes and spaces between thousands`);
    const groups = intPart.replace(SPACES, ' ').split(/['’\u02bc\u2032 ]/);
    if (!groupsValid(groups)) return fail(`"${text}" has thousands groups that don't line up`);
    intPart = groups.join('');
  }
  if (!/^\d+$/.test(intPart)) return fail(`"${text}" is not an amount`);
  if (intPart.length > 13) return fail(`"${text}" is too large`);
  const centimes = Number(intPart) * 100 + Number(decimals.padEnd(2, '0'));
  if (!Number.isSafeInteger(centimes)) return fail(`"${text}" is too large`);
  return { ok: true, value: negative && centimes !== 0 ? -centimes : centimes };
}

/** True if `iso` is a real calendar date written YYYY-MM-DD. */
export function isIsoDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** Reads a date written 2027-03-15 or 15.03.2027 (Swiss order). Returns YYYY-MM-DD. */
export function parseDate(text: string): Parsed<string> {
  if (typeof text !== 'string') return fail('expected the date as text, e.g. "2027-03-15"');
  const s = text.trim();
  let iso: string | undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = s;
  const swiss = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (swiss) iso = `${swiss[3]}-${swiss[2]!.padStart(2, '0')}-${swiss[1]!.padStart(2, '0')}`;
  if (!iso) return fail(`"${text}" is not a date written 2027-03-15 or 15.03.2027`);
  if (!isIsoDate(iso)) return fail(`"${text}" is not a real date`);
  return { ok: true, value: iso };
}

/** Centimes as typed on a form: digits, a decimal point, two decimals, no grouping. 1234560 -> "12345.60". */
export function formatMoneyPlain(centimes: number): string {
  const sign = centimes < 0 ? '-' : '';
  const abs = Math.abs(centimes);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
