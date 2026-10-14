// The reader of the ESTV tariff record format (ch-na-is-recordformat-salaires), on a small
// synthetic file laid out like the official ones: every surprise must stop the conversion.
import { describe, expect, it } from 'vitest';
import { compactTariff, expandTariff, parseTariffFile } from '@taxpresso/rules-ch';

const pad = (s: string, n: number) => s.padEnd(n, ' ');
/** One record 06: code, monthly income from and step in centimes, children, rate in 1/100 %. */
const row = (code: string, from: number, step: number, kids: number, rate: number, min = 0) =>
  `0601GE${pad(code, 10)}20260101${String(from).padStart(9, '0')}${String(step).padStart(9, '0')} ${String(kids).padStart(2, '0')}${String(min).padStart(9, '0')}${String(rate).padStart(5, '0')}   `;

function file(records: string[], count = records.length + 2): string {
  return [
    pad('00GE               20251025', 111),
    ...records,
    `99               GE${String(count).padStart(8, '0')}            `,
  ].join('\r\n');
}

const A0 = [
  row('A0N', 0, 244_995, 0, 0),
  row('A0N', 245_000, 5_000, 0, 9),
  row('A0N', 250_000, 5_000, 0, 10),
  row('A0N', 255_000, 10_000, 0, 14),
  row('A0N', 265_000, 40_960_005, 0, 35),
];
const FIXED = '1101GEHEN       20260101000000100999999999 0000000000002500   ';

describe('tariff file reader', () => {
  it('reads the header, the progressive rows and the record count', () => {
    const parsed = parseTariffFile(file([...A0, FIXED]));
    expect(parsed).toMatchObject({
      canton: 'GE',
      created: '2025-10-25',
      validFrom: '2026-01-01',
      records: 8,
    });
    expect(parsed.tariffs['A0N']?.[1]).toEqual({
      from: 245_000,
      step: 5_000,
      children: 0,
      minimum: 0,
      rateBp: 9,
    });
  });

  it('packs a tariff and gives every row back', () => {
    const packed = compactTariff('A0N', parseTariffFile(file(A0)).tariffs['A0N']!);
    expect(packed.top).toBe(265_000 + 40_960_005);
    expect(expandTariff(packed)).toEqual({
      from: [0, 245_000, 250_000, 255_000, 265_000],
      rates: [0, 9, 10, 14, 35],
      top: 41_225_005,
    });
  });

  it('refuses a file that is not exactly as announced', () => {
    expect(() => parseTariffFile(file(A0, 9))).toThrow(/announces 9 records/);
    expect(() => parseTariffFile(A0.join('\n'))).toThrow(/record 00/);
    expect(() => parseTariffFile(file([A0[0]!.replace('0601', '0602')]))).toThrow(/transaction 02/);
    expect(() => parseTariffFile(file([A0[0]!.replace('20260101', '20250101'), A0[1]!]))).toThrow(
      /validity/,
    );
    expect(() => parseTariffFile(file(['0701GE'.padEnd(63, ' ')]))).toThrow(/unknown record 07/);
  });

  it('refuses a tariff with a gap, a falling rate, a minimum tax or the wrong children', () => {
    const rows = (lines: string[]) => parseTariffFile(file(lines)).tariffs['A0N']!;
    const gap = [A0[0]!, A0[1]!, row('A0N', 260_000, 5_000, 0, 10)];
    expect(() => compactTariff('A0N', rows(gap))).toThrow(/gap or overlap/);
    const falling = [A0[0]!, A0[1]!, row('A0N', 250_000, 5_000, 0, 8)];
    expect(() => compactTariff('A0N', rows(falling))).toThrow(/rate decreases/);
    const minimum = [A0[0]!, row('A0N', 245_000, 5_000, 0, 9, 2_000)];
    expect(() => compactTariff('A0N', rows(minimum))).toThrow(/minimum tax/);
    expect(() =>
      compactTariff('A1N', [
        { from: 0, step: 100, children: 0, minimum: 0, rateBp: 0 },
        { from: 100, step: 100, children: 0, minimum: 0, rateBp: 1 },
      ]),
    ).toThrow(/children/);
    expect(() =>
      compactTariff('A0N', [{ from: 0, step: 100, children: 0, minimum: 0, rateBp: 0 }]),
    ).toThrow(/not a progressive tariff/);
  });
});
