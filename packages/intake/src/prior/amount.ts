// Amounts as Geneva declarations print them: whole francs with an apostrophe between thousands
// ("12'345"), sometimes centimes ("1'234.50") or a dash for none ("12'345.–"). Integer centimes
// out, from the digits as text: never floats (SPEC.md section 4).

const APOSTROPHE = `['’ʼ‘´\`]`;
const AMOUNT = new RegExp(
  `^(\\d{1,3}(?:${APOSTROPHE}\\d{3})+|\\d+)(?:\\.(\\d{2}|[-\\u2013\\u2014]))?$`,
);

/** "12'345" -> 1234500; "1'234.50" -> 123450; "-500" -> -50000; anything else -> undefined. */
export function parseAmount(text: string): number | undefined {
  let s = text.trim();
  let negative = false;
  if (/^[-−]\s?\d/.test(s)) {
    negative = true;
    s = s.slice(1).trim();
  }
  const m = AMOUNT.exec(s);
  if (!m) return undefined;
  const whole = m[1]!.replace(new RegExp(APOSTROPHE, 'g'), '');
  if (whole.length > 12) return undefined;
  const cents = m[2] && /^\d{2}$/.test(m[2]) ? Number(m[2]) : 0;
  const value = Number(whole) * 100 + cents;
  if (!Number.isSafeInteger(value)) return undefined;
  return negative ? -value : value;
}

/** Written like an amount for sure: a thousands apostrophe, or centimes ("12'345", "40.50"). */
export function hasAmountShape(text: string): boolean {
  return new RegExp(`${APOSTROPHE}\\d{3}|\\.(\\d{2}|[-\\u2013\\u2014])$`).test(text.trim());
}
